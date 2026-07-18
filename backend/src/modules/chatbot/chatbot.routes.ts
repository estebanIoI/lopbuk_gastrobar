import { Router, Request, Response } from 'express';
import pool from '../../config/database';
import { authenticate, AuthRequest } from '../../common/middleware';
import { sendTextMessage } from '../whatsapp/whatsapp.service';
import { v4 as uuidv4 } from 'uuid';
import {
  getOrCreateSession,
  isHumanTakeover,
  saveMessage,
  processAgentMessage,
} from '../agent/agent.service';
import { runPublicAssistant, isPlatformAssistantEnabled } from '../assistant/assistant.service';
import { encrypt, decrypt } from '../../utils/crypto';

const router: ReturnType<typeof Router> = Router();

// =============================================
// PUBLIC: GET chatbot status for a store
// GET /api/chatbot/status/:slug
// =============================================
router.get('/status/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const [tenants] = await pool.query(
      "SELECT id FROM tenants WHERE slug = ? AND status = 'activo' LIMIT 1",
      [slug]
    ) as any;
    if (!tenants?.length) {
      res.json({ success: true, data: { enabled: false } });
      return;
    }
    const tenantId = tenants[0].id;

    const [rows] = await pool.query(
      'SELECT is_enabled, bot_name, bot_avatar_url, accent_color FROM chatbot_config WHERE tenant_id = ? LIMIT 1',
      [tenantId]
    ) as any;

    if (!rows?.length || !rows[0].is_enabled) {
      res.json({ success: true, data: { enabled: false } });
      return;
    }

    res.json({
      success: true,
      data: {
        enabled:      true,
        botName:      rows[0].bot_name      || 'Asistente',
        botAvatarUrl: rows[0].bot_avatar_url || null,
        accentColor:  rows[0].accent_color   || '#f59e0b',
      },
    });
  } catch {
    res.json({ success: true, data: { enabled: false } });
  }
});

// =============================================
// PUBLIC: POST chat message
// POST /api/chatbot/message
// Body: { slug, sessionToken, message, customerName? }
// =============================================
router.post('/message', async (req: Request, res: Response) => {
  try {
    const { slug, sessionToken, message, customerName, excludeProductIds } = req.body;
    if (!slug || !message?.trim()) {
      res.status(400).json({ success: false, error: 'slug y message son requeridos' });
      return;
    }

    const [tenants] = await pool.query(
      "SELECT id FROM tenants WHERE slug = ? AND status = 'activo' LIMIT 1",
      [slug]
    ) as any;
    if (!tenants?.length) {
      res.status(404).json({ success: false, error: 'Tienda no encontrada' });
      return;
    }
    const tenantId = tenants[0].id;

    const [cfgRows] = await pool.query(
      'SELECT * FROM chatbot_config WHERE tenant_id = ? AND is_enabled = 1 LIMIT 1',
      [tenantId]
    ) as any;
    if (!cfgRows?.length) {
      res.status(403).json({ success: false, error: 'Chatbot no disponible para esta tienda' });
      return;
    }
    const config = cfgRows[0];

    const token     = sessionToken || uuidv4();
    const sessionId = await getOrCreateSession(token, tenantId, { customerName });

    if (await isHumanTakeover(sessionId)) {
      await saveMessage(sessionId, tenantId, 'user', message.trim());
      // El widget entra en modo "asesor humano": hace polling de session-updates
      // para recibir las respuestas manuales del comerciante.
      const [maxRows] = await pool.query(
        'SELECT COALESCE(MAX(id), 0) AS maxId FROM chatbot_messages WHERE session_id = ?',
        [sessionId]
      ) as any;
      res.json({
        success: true,
        data: {
          reply: 'Un asesor te atenderá en breve.',
          sessionToken: token,
          takeover: true,
          lastMessageId: Number(maxRows?.[0]?.maxId || 0),
        },
      });
      return;
    }

    // Se procesa ANTES de guardar el mensaje del usuario: así el historial que ve el
    // modelo no incluye el mensaje actual (se anexa una sola vez dentro del pipeline),
    // evitando el duplicado. Si el pipeline falla, no queda un mensaje huérfano.
    const { reply, suggestedProducts, suggestedReplies } = await processAgentMessage(
      tenantId, sessionId, message.trim(), config,
      Array.isArray(excludeProductIds) ? excludeProductIds.map(String) : []
    );

    await saveMessage(sessionId, tenantId, 'user', message.trim());
    const lastMessageId = await saveMessage(sessionId, tenantId, 'assistant', reply);

    res.json({
      success: true,
      data: {
        reply,
        sessionToken: token,
        lastMessageId,
        suggestedReplies: suggestedReplies.length > 0 ? suggestedReplies : undefined,
        suggestedProducts: suggestedProducts.length > 0
          ? suggestedProducts.map(p => ({
              id:        p.id,
              name:      p.name,
              salePrice: p.salePrice,
              imageUrl:  p.imageUrl,
              category:  p.category,
            }))
          : undefined,
      },
    });
  } catch (error) {
    console.error('Chatbot message error:', error);
    res.status(500).json({ success: false, error: 'Error al procesar el mensaje' });
  }
});

// =============================================
// PUBLIC: GET actualizaciones de sesión (polling del widget en takeover)
// GET /api/chatbot/session-updates?slug=&sessionToken=&afterId=
// Devuelve las respuestas manuales del comerciante (role=assistant) posteriores
// a afterId. Solo tiene sentido mientras human_takeover está activo.
// =============================================
router.get('/session-updates', async (req: Request, res: Response) => {
  try {
    const slug = String(req.query.slug || '');
    const sessionToken = String(req.query.sessionToken || '');
    const afterId = Number(req.query.afterId || 0);
    if (!slug || !sessionToken) {
      res.status(400).json({ success: false, error: 'slug y sessionToken son requeridos' });
      return;
    }
    const [tenants] = await pool.query(
      "SELECT id FROM tenants WHERE slug = ? AND status = 'activo' LIMIT 1", [slug]
    ) as any;
    if (!tenants?.length) { res.status(404).json({ success: false, error: 'Tienda no encontrada' }); return; }
    const [sessions] = await pool.query(
      'SELECT id, human_takeover FROM chatbot_sessions WHERE session_token = ? AND tenant_id = ? LIMIT 1',
      [sessionToken, tenants[0].id]
    ) as any;
    if (!sessions?.length) { res.json({ success: true, data: { takeover: false, messages: [] } }); return; }

    const [msgs] = await pool.query(
      `SELECT id, content FROM chatbot_messages
        WHERE session_id = ? AND role = 'assistant' AND id > ?
        ORDER BY id ASC LIMIT 20`,
      [sessions[0].id, afterId]
    ) as any;
    res.json({
      success: true,
      data: {
        takeover: !!sessions[0].human_takeover,
        messages: ((msgs as any[]) || []).map((m: any) => ({ id: Number(m.id), content: m.content })),
      },
    });
  } catch (error) {
    console.error('Chatbot session-updates error:', error);
    res.status(500).json({ success: false, error: 'Error al consultar la sesión' });
  }
});

// =============================================
// MERCHANT: conversaciones del chatbot (asesoría + cierre humano)
// =============================================

// GET /api/chatbot/sessions — sesiones del tenant con último mensaje
router.get('/sessions', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const [rows] = await pool.query(
      `SELECT s.id, s.session_token AS sessionToken, s.customer_name AS customerName,
              s.customer_phone AS customerPhone, s.human_takeover AS humanTakeover,
              s.channel, s.last_activity AS lastActivity,
              (SELECT content FROM chatbot_messages m WHERE m.session_id = s.id ORDER BY m.id DESC LIMIT 1) AS lastMessage,
              (SELECT COUNT(*) FROM chatbot_messages m WHERE m.session_id = s.id) AS messageCount
         FROM chatbot_sessions s
        WHERE s.tenant_id = ?
        ORDER BY s.last_activity DESC
        LIMIT 100`,
      [tenantId]
    ) as any;
    res.json({
      success: true,
      data: ((rows as any[]) || []).map((r: any) => ({
        ...r,
        humanTakeover: !!r.humanTakeover,
        channel: String(r.sessionToken || '').startsWith('wa:') ? 'whatsapp' : (r.channel || 'web'),
      })),
    });
  } catch (error) {
    console.error('Chatbot sessions error:', error);
    res.status(500).json({ success: false, error: 'Error al listar conversaciones' });
  }
});

// GET /api/chatbot/sessions/:id/messages — historial completo de una sesión
router.get('/sessions/:id/messages', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const [sessions] = await pool.query(
      'SELECT id FROM chatbot_sessions WHERE id = ? AND tenant_id = ? LIMIT 1',
      [req.params.id, tenantId]
    ) as any;
    if (!sessions?.length) { res.status(404).json({ success: false, error: 'Conversación no encontrada' }); return; }
    const [msgs] = await pool.query(
      'SELECT id, role, content, created_at AS createdAt FROM chatbot_messages WHERE session_id = ? ORDER BY id ASC LIMIT 300',
      [req.params.id]
    ) as any;
    res.json({ success: true, data: msgs });
  } catch (error) {
    console.error('Chatbot session messages error:', error);
    res.status(500).json({ success: false, error: 'Error al cargar la conversación' });
  }
});

// PATCH /api/chatbot/sessions/:id/takeover — el comerciante toma o devuelve el control
router.patch('/sessions/:id/takeover', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const takeover = req.body?.takeover === true || req.body?.takeover === 'true';
    const [result] = await pool.query(
      'UPDATE chatbot_sessions SET human_takeover = ? WHERE id = ? AND tenant_id = ?',
      [takeover ? 1 : 0, req.params.id, tenantId]
    ) as any;
    if (!result?.affectedRows) { res.status(404).json({ success: false, error: 'Conversación no encontrada' }); return; }
    res.json({ success: true, data: { takeover } });
  } catch (error) {
    console.error('Chatbot takeover error:', error);
    res.status(500).json({ success: false, error: 'Error al cambiar el modo de atención' });
  }
});

// POST /api/chatbot/sessions/:id/reply — respuesta manual del comerciante.
// Se guarda como assistant (el widget web la recibe por polling); si la sesión es
// de WhatsApp (wa:<phone>), también se envía por Evolution API.
router.post('/sessions/:id/reply', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const message = String(req.body?.message || '').trim();
    if (!message) { res.status(400).json({ success: false, error: 'message es requerido' }); return; }

    const [sessions] = await pool.query(
      'SELECT id, session_token AS sessionToken FROM chatbot_sessions WHERE id = ? AND tenant_id = ? LIMIT 1',
      [req.params.id, tenantId]
    ) as any;
    if (!sessions?.length) { res.status(404).json({ success: false, error: 'Conversación no encontrada' }); return; }

    const messageId = await saveMessage(sessions[0].id, tenantId!, 'assistant', message);
    await pool.query('UPDATE chatbot_sessions SET last_activity = NOW() WHERE id = ?', [sessions[0].id]);

    // Canal WhatsApp: entregar el mensaje real al teléfono del cliente
    let whatsappSent = false;
    const token = String(sessions[0].sessionToken || '');
    if (token.startsWith('wa:')) {
      const [cfgRows] = await pool.query(
        'SELECT evolution_instance FROM chatbot_config WHERE tenant_id = ? LIMIT 1', [tenantId]
      ) as any;
      const instance = cfgRows?.[0]?.evolution_instance;
      if (instance) {
        await sendTextMessage(instance, token.slice(3), message)
          .then(() => { whatsappSent = true; })
          .catch((e: any) => console.error('Manual reply WA send failed:', e?.message || e));
      }
    }

    res.json({ success: true, data: { messageId, whatsappSent } });
  } catch (error) {
    console.error('Chatbot manual reply error:', error);
    res.status(500).json({ success: false, error: 'Error al enviar la respuesta' });
  }
});

// =============================================
// PUBLIC: POST asistente de plataforma (robot del portafolio)
// POST /api/chatbot/platform-assistant/message
// =============================================
router.post('/platform-assistant/message', async (req: Request, res: Response) => {
  try {
    if (!(await isPlatformAssistantEnabled())) {
      res.status(403).json({ success: false, error: 'El asistente no esta habilitado' });
      return;
    }
    const { message, history } = req.body || {};
    if (!message?.trim()) { res.status(400).json({ success: false, error: 'Mensaje requerido' }); return; }
    const data = await runPublicAssistant(message.trim(), Array.isArray(history) ? history : []);
    res.json({ success: true, data });
  } catch (err) {
    console.error('Public assistant error:', err);
    res.status(500).json({ success: false, error: 'Error en el asistente' });
  }
});

// =============================================
// MERCHANT: GET chatbot config
// GET /api/chatbot/config
// =============================================
router.get('/config', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const [rows] = await pool.query(
      'SELECT * FROM chatbot_config WHERE tenant_id = ? LIMIT 1',
      [tenantId]
    ) as any;

    res.json({
      success: true,
      data: rows?.[0] || {
        is_enabled:      false,
        bot_name:        'Asistente',
        bot_avatar_url:  null,
        system_prompt:   '',
        business_info:   '',
        faqs:            '',
        tone:            'amigable',
        notify_email:    true,
        notify_whatsapp: true,
      },
    });
  } catch (error) {
    console.error('Chatbot config GET error:', error);
    res.status(500).json({ success: false, error: 'Error al obtener configuración del chatbot' });
  }
});

// =============================================
// MERCHANT: PUT chatbot config
// PUT /api/chatbot/config
// =============================================
router.put('/config', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const {
      botName, botAvatarUrl, accentColor, systemPrompt,
      businessInfo, faqs, tone, notifyEmail, notifyWhatsapp,
    } = req.body;

    await pool.query(
      `INSERT INTO chatbot_config
         (tenant_id, bot_name, bot_avatar_url, accent_color, system_prompt,
          business_info, faqs, tone, notify_email, notify_whatsapp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         bot_name       = VALUES(bot_name),
         bot_avatar_url = VALUES(bot_avatar_url),
         accent_color   = VALUES(accent_color),
         system_prompt  = VALUES(system_prompt),
         business_info  = VALUES(business_info),
         faqs           = VALUES(faqs),
         tone           = VALUES(tone),
         notify_email   = VALUES(notify_email),
         notify_whatsapp = VALUES(notify_whatsapp),
         updated_at     = NOW()`,
      [
        tenantId,
        botName      || 'Asistente',
        botAvatarUrl || null,
        accentColor  || '#f59e0b',
        systemPrompt || null,
        businessInfo || null,
        faqs         || null,
        tone         || 'amigable',
        notifyEmail  !== false ? 1 : 0,
        notifyWhatsapp !== false ? 1 : 0,
      ]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Chatbot config PUT error:', error);
    res.status(500).json({ success: false, error: 'Error al guardar configuración del chatbot' });
  }
});

// =============================================
// MERCHANT: GET notifications
// GET /api/chatbot/notifications
// =============================================
router.get('/notifications', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const [rows] = await pool.query(
      `SELECT id, type, title, message, data, is_read, created_at
       FROM merchant_notifications
       WHERE tenant_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [tenantId]
    ) as any;

    const unreadCount = (rows as any[]).filter((r: any) => !r.is_read).length;
    res.json({ success: true, data: { notifications: rows, unreadCount } });
  } catch (error) {
    console.error('Notifications GET error:', error);
    res.status(500).json({ success: false, error: 'Error al obtener notificaciones' });
  }
});

// =============================================
// MERCHANT: Mark notifications as read
// PUT /api/chatbot/notifications/read
// =============================================
router.put('/notifications/read', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    await pool.query(
      'UPDATE merchant_notifications SET is_read = 1 WHERE tenant_id = ?',
      [tenantId]
    );
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'Error al marcar notificaciones' });
  }
});

// =============================================
// MERCHANT: GET Cloudinary config
// GET /api/chatbot/cloudinary-config
// =============================================
router.get('/cloudinary-config', authenticate, async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query(
      "SELECT setting_key, setting_value FROM platform_settings WHERE setting_key IN ('cloudinary_cloud_name','cloudinary_upload_preset')"
    ) as any;

    const settings: Record<string, string> = {};
    for (const row of (rows as any[])) {
      settings[row.setting_key] = row.setting_value || '';
    }

    res.json({
      success: true,
      data: {
        cloudName:    settings['cloudinary_cloud_name']    || '',
        uploadPreset: settings['cloudinary_upload_preset'] || '',
      },
    });
  } catch (error) {
    console.error('Cloudinary config GET error:', error);
    res.status(500).json({ success: false, error: 'Error al obtener configuración de Cloudinary' });
  }
});

// =============================================
// PLATFORM ASSISTANT: estado (cualquier usuario autenticado)
// GET /api/chatbot/platform-assistant
// =============================================
router.get('/platform-assistant', authenticate, async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query(
      "SELECT setting_value FROM platform_settings WHERE setting_key = 'platform_assistant_enabled' LIMIT 1"
    ) as any;
    const enabled = rows?.[0]?.setting_value === '1' || rows?.[0]?.setting_value === 'true';
    res.json({ success: true, data: { enabled } });
  } catch {
    res.json({ success: true, data: { enabled: false } });
  }
});

// =============================================
// SUPERADMIN: activar/desactivar asistente de plataforma
// PUT /api/chatbot/superadmin/platform-assistant  Body: { enabled }
// =============================================
router.put('/superadmin/platform-assistant', authenticate, async (req: Request, res: Response) => {
  try {
    if ((req as any).user.role !== 'superadmin') {
      res.status(403).json({ success: false, error: 'Solo superadmin' });
      return;
    }
    const value = req.body?.enabled ? '1' : '0';
    await pool.query(
      "INSERT INTO platform_settings (setting_key, setting_value) VALUES ('platform_assistant_enabled', ?) ON DUPLICATE KEY UPDATE setting_value = ?",
      [value, value]
    );
    res.json({ success: true, data: { enabled: value === '1' } });
  } catch (error) {
    console.error('Platform assistant toggle error:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar el asistente de plataforma' });
  }
});

// =============================================
// SUPERADMIN: GET integrations
// =============================================
router.get('/superadmin/integrations', authenticate, async (req: Request, res: Response) => {
  try {
    if ((req as any).user.role !== 'superadmin') {
      res.status(403).json({ success: false, error: 'Solo superadmin' });
      return;
    }

    const [rows] = await pool.query(
      "SELECT setting_key, setting_value FROM platform_settings WHERE setting_key IN ('cloudinary_cloud_name','cloudinary_upload_preset','cloudinary_api_key','cloudinary_api_secret','ai_gemini_key','ai_openai_key','ai_groq_key','ai_opencode_go_key','ai_opencode_go_model','ai_text_model_main','ai_text_model_small','ai_default_provider','ai_openai_base_url','ai_openai_model','ai_vision_provider','ai_vision_model','google_wallet_credentials')"
    ) as any;

    const settings: Record<string, string> = {};
    for (const row of (rows as any[])) {
      const val = row.setting_value || '';
      // Decrypt AI keys (Cloudinary values are plaintext)
      if (['ai_gemini_key', 'ai_openai_key', 'ai_groq_key', 'ai_opencode_go_key', 'google_wallet_credentials'].includes(row.setting_key)) {
        try { settings[row.setting_key] = decrypt(val); }
        catch { settings[row.setting_key] = val; }
      } else {
        settings[row.setting_key] = val;
      }
    }

    // Google Wallet: contiene una clave privada → NUNCA se devuelve. Solo si está
    // configurada y el issuerId (dato no sensible) para que el admin lo verifique.
    let walletIssuerId = '';
    if (settings['google_wallet_credentials']) {
      try { walletIssuerId = JSON.parse(settings['google_wallet_credentials'])?.issuerId || ''; }
      catch { /* json inválido guardado */ }
    }

    res.json({
      success: true,
      data: {
        cloudinaryCloudName:    settings['cloudinary_cloud_name']      || '',
        cloudinaryUploadPreset: settings['cloudinary_upload_preset']   || '',
        // Api Key se muestra enmascarada; Api Secret NUNCA sale (solo flag de si existe)
        cloudinaryApiKey:       settings['cloudinary_api_key'] ? '••••••' + settings['cloudinary_api_key'].slice(-4) : '',
        cloudinaryApiKeySet:    !!settings['cloudinary_api_key'],
        cloudinaryApiSecretSet: !!settings['cloudinary_api_secret'],
        // Las AI keys se devuelven ENMASCARADAS (nunca el secreto completo al navegador).
        // El front muestra la máscara para el toggle show/hide; los flags *Set indican si hay key.
        geminiApiKey:           settings['ai_gemini_key'] ? '••••••' + settings['ai_gemini_key'].slice(-4) : '',
        openaiApiKey:           settings['ai_openai_key'] ? '••••••' + settings['ai_openai_key'].slice(-4) : '',
        groqApiKey:             settings['ai_groq_key']   ? '••••••' + settings['ai_groq_key'].slice(-4)   : '',
        opencodeGoApiKey:       settings['ai_opencode_go_key'] ? '••••••' + settings['ai_opencode_go_key'].slice(-4) : '',
        geminiApiKeySet:        !!settings['ai_gemini_key'],
        openaiApiKeySet:        !!settings['ai_openai_key'],
        groqApiKeySet:          !!settings['ai_groq_key'],
        opencodeGoApiKeySet:    !!settings['ai_opencode_go_key'],
        opencodeGoModel:        settings['ai_opencode_go_model']        || 'opencode-go/deepseek-v4-flash',
        textModelMain:          settings['ai_text_model_main']          || '',
        textModelSmall:         settings['ai_text_model_small']         || '',
        defaultAiProvider:      settings['ai_default_provider']        || 'opencode_go',
        openaiBaseUrl:          settings['ai_openai_base_url']         || '',
        openaiModel:            settings['ai_openai_model']            || '',
        visionProvider:         settings['ai_vision_provider']         || 'gemini',
        visionModel:            settings['ai_vision_model']            || '',
        // Google Wallet: la clave privada nunca sale del servidor
        googleWalletSet:        !!settings['google_wallet_credentials'],
        googleWalletIssuerId:   walletIssuerId,
      },
    });
  } catch (error) {
    console.error('Integrations GET error:', error);
    res.status(500).json({ success: false, error: 'Error al obtener integraciones' });
  }
});

// =============================================
// SUPERADMIN: telemetría de consumo de IA (IA6)
// GET /api/chatbot/superadmin/ai-usage
// =============================================
router.get('/superadmin/ai-usage', authenticate, async (req: Request, res: Response) => {
  try {
    if ((req as any).user.role !== 'superadmin') {
      res.status(403).json({ success: false, error: 'Solo superadmin' });
      return;
    }
    const { getUsageStats } = await import('../ai/orchestrator.service');
    const stats = await getUsageStats();

    // Desglose por proveedor/modelo en los últimos 30 días.
    let breakdown: any[] = [];
    let calls30d = 0;
    try {
      const [rows] = await pool.query(
        `SELECT provider, model,
                COUNT(*) AS calls,
                COALESCE(SUM(total_tokens),0) AS tokens,
                COALESCE(SUM(est_cost),0) AS cost
         FROM ai_usage_log
         WHERE created_at >= NOW() - INTERVAL 30 DAY
         GROUP BY provider, model
         ORDER BY cost DESC
         LIMIT 30`
      ) as any;
      breakdown = (rows as any[]).map(r => ({
        provider: r.provider, model: r.model,
        calls: Number(r.calls), tokens: Number(r.tokens), cost: Number(r.cost),
      }));
      calls30d = breakdown.reduce((s, r) => s + r.calls, 0);
    } catch { /* tabla aún no migrada */ }

    res.json({ success: true, data: { ...stats, calls30d, breakdown } });
  } catch (error) {
    console.error('AI usage GET error:', error);
    res.status(500).json({ success: false, error: 'Error al obtener el consumo de IA' });
  }
});

// =============================================
// SUPERADMIN: revelar una AI key en claro (bajo demanda)
// =============================================
router.get('/superadmin/integrations/reveal/:provider', authenticate, async (req: Request, res: Response) => {
  try {
    if ((req as any).user.role !== 'superadmin') {
      res.status(403).json({ success: false, error: 'Solo superadmin' });
      return;
    }
    const map: Record<string, string> = { gemini: 'ai_gemini_key', openai: 'ai_openai_key', groq: 'ai_groq_key', opencode_go: 'ai_opencode_go_key' };
    const settingKey = map[req.params.provider];
    if (!settingKey) {
      res.status(400).json({ success: false, error: 'Proveedor inválido' });
      return;
    }
    const [rows] = await pool.query(
      'SELECT setting_value FROM platform_settings WHERE setting_key = ? LIMIT 1', [settingKey]
    ) as any;
    const raw = rows?.[0]?.setting_value || '';
    let key = '';
    if (raw) { try { key = decrypt(raw); } catch { key = raw; } }
    res.json({ success: true, data: { key } });
  } catch (error) {
    console.error('Integrations reveal error:', error);
    res.status(500).json({ success: false, error: 'Error al revelar la clave' });
  }
});

// =============================================
// SUPERADMIN: PUT integrations
// =============================================
router.put('/superadmin/integrations', authenticate, async (req: Request, res: Response) => {
  try {
    if ((req as any).user.role !== 'superadmin') {
      res.status(403).json({ success: false, error: 'Solo superadmin' });
      return;
    }

    const { cloudinaryCloudName, cloudinaryUploadPreset, cloudinaryApiKey, cloudinaryApiSecret, geminiApiKey, openaiApiKey, groqApiKey, opencodeGoApiKey, opencodeGoModel, textModelMain, textModelSmall, defaultAiProvider, openaiBaseUrl, openaiModel, visionProvider, visionModel } = req.body;

    const updates: [string, string][] = [
      ['cloudinary_cloud_name',    cloudinaryCloudName    || ''],
      ['cloudinary_upload_preset', cloudinaryUploadPreset || ''],
    ];
    // Api Key y Api Secret: misma lógica que las AI keys (no pisar con máscara •, __CLEAR__ borra)
    const realKey = (v: any) => typeof v === 'string' && v.length > 0 && !v.includes('•');
    if (cloudinaryApiKey === '__CLEAR__') updates.push(['cloudinary_api_key', '']);
    else if (realKey(cloudinaryApiKey)) updates.push(['cloudinary_api_key', cloudinaryApiKey]);
    if (cloudinaryApiSecret === '__CLEAR__') updates.push(['cloudinary_api_secret', '']);
    else if (realKey(cloudinaryApiSecret)) updates.push(['cloudinary_api_secret', cloudinaryApiSecret]);
    if (defaultAiProvider !== undefined) updates.push(['ai_default_provider', String(defaultAiProvider || 'opencode_go')]);
    if (openaiBaseUrl !== undefined) updates.push(['ai_openai_base_url', String(openaiBaseUrl || '')]);
    if (openaiModel !== undefined)   updates.push(['ai_openai_model',    String(openaiModel || '')]);
    if (opencodeGoModel !== undefined) updates.push(['ai_opencode_go_model', String(opencodeGoModel || 'opencode-go/deepseek-v4-flash')]);
    // Tiering (IA5): modelos main/small de texto. Vacío = usa el default.
    if (textModelMain !== undefined)  updates.push(['ai_text_model_main',  String(textModelMain  || '')]);
    if (textModelSmall !== undefined) updates.push(['ai_text_model_small', String(textModelSmall || '')]);
    // Visión (IA3): el proveedor de visión nunca es Go; si llegara algo inválido se cae a gemini.
    if (visionProvider !== undefined) {
      const vp = String(visionProvider || 'gemini').toLowerCase();
      updates.push(['ai_vision_provider', ['gemini', 'openai', 'groq'].includes(vp) ? vp : 'gemini']);
    }
    if (visionModel !== undefined) updates.push(['ai_vision_model', String(visionModel || '')]);

    // Solo se actualiza una AI key si llega un valor REAL (no el enmascarado con •).
    // Así el GET puede devolver las keys ofuscadas sin que un guardado las pise con la máscara.
    // Para borrar una key se envía la cadena exacta "__CLEAR__".
    const pushKey = (k: string, v: any) => {
      if (v === '__CLEAR__') updates.push([k, '']);
      else if (realKey(v)) updates.push([k, encrypt(v)]);
    };
    pushKey('ai_gemini_key', geminiApiKey);
    pushKey('ai_openai_key', openaiApiKey);
    pushKey('ai_groq_key',   groqApiKey);
    pushKey('ai_opencode_go_key', opencodeGoApiKey);

    // ── Google Wallet: JSON del service account + issuerId ──────────────────
    // Se valida ANTES de guardar: un JSON mal pegado se detecta aquí y no
    // después, cuando la wallet fallaría en silencio al emitir un pase.
    const gw = (req.body as any).googleWalletCredentials;
    if (gw === '__CLEAR__') {
      updates.push(['google_wallet_credentials', '']);
    } else if (typeof gw === 'string' && gw.trim() && !gw.includes('•')) {
      let parsed: any;
      try { parsed = JSON.parse(gw); }
      catch {
        res.status(400).json({ success: false, error: 'El JSON de Google Wallet no es válido. Pega el archivo del service account completo.' });
        return;
      }
      const missing = ['issuerId', 'client_email', 'private_key'].filter(k => !parsed?.[k]);
      if (missing.length) {
        res.status(400).json({
          success: false,
          error: `Faltan campos en el JSON de Google Wallet: ${missing.join(', ')}. Agrega "issuerId" al JSON del service account.`,
        });
        return;
      }
      if (!String(parsed.private_key).includes('BEGIN PRIVATE KEY')) {
        res.status(400).json({ success: false, error: 'La private_key no parece válida (debe incluir "BEGIN PRIVATE KEY").' });
        return;
      }
      updates.push(['google_wallet_credentials', encrypt(JSON.stringify(parsed))]);
    }

    for (const [key, value] of updates) {
      await pool.query(
        'INSERT INTO platform_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
        [key, value, value]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Integrations PUT error:', error);
    res.status(500).json({ success: false, error: 'Error al guardar integraciones' });
  }
});

// =============================================
// SUPERADMIN: GET all tenants with chatbot status
// =============================================
router.get('/superadmin/tenants', authenticate, async (req: Request, res: Response) => {
  try {
    if ((req as any).user.role !== 'superadmin') {
      res.status(403).json({ success: false, error: 'Solo superadmin' });
      return;
    }

    const [rows] = await pool.query(
      `SELECT t.id, t.name, t.slug, t.status,
              cc.is_enabled    AS chatbotEnabled,
              cc.bot_name      AS botName,
              cc.updated_at    AS chatbotUpdatedAt
       FROM tenants t
       LEFT JOIN chatbot_config cc ON cc.tenant_id = t.id
       WHERE t.status = 'activo'
       ORDER BY t.name ASC`
    ) as any;

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Superadmin tenants chatbot GET error:', error);
    res.status(500).json({ success: false, error: 'Error al obtener comercios' });
  }
});

// =============================================
// SUPERADMIN: Toggle chatbot for a tenant
// PUT /api/chatbot/superadmin/tenant/:tenantId
// =============================================
router.put('/superadmin/tenant/:tenantId', authenticate, async (req: Request, res: Response) => {
  try {
    if ((req as any).user.role !== 'superadmin') {
      res.status(403).json({ success: false, error: 'Solo superadmin' });
      return;
    }

    const { tenantId } = req.params;
    const { enabled }  = req.body;

    await pool.query(
      `INSERT INTO chatbot_config (tenant_id, is_enabled) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE is_enabled = VALUES(is_enabled), updated_at = NOW()`,
      [tenantId, enabled ? 1 : 0]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Superadmin toggle chatbot error:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar chatbot' });
  }
});

export { router as chatbotRoutes };
