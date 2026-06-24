import { Router, Request, Response } from 'express';
import pool from '../../config/database';
import { authenticate } from '../../common/middleware';
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
      res.json({
        success: true,
        data: { reply: 'Un asesor te atenderá en breve.', sessionToken: token },
      });
      return;
    }

    // Se procesa ANTES de guardar el mensaje del usuario: así el historial que ve el
    // modelo no incluye el mensaje actual (se anexa una sola vez dentro del pipeline),
    // evitando el duplicado. Si el pipeline falla, no queda un mensaje huérfano.
    const { reply, suggestedProducts } = await processAgentMessage(
      tenantId, sessionId, message.trim(), config,
      Array.isArray(excludeProductIds) ? excludeProductIds.map(String) : []
    );

    await saveMessage(sessionId, tenantId, 'user', message.trim());
    await saveMessage(sessionId, tenantId, 'assistant', reply);

    res.json({
      success: true,
      data: {
        reply,
        sessionToken: token,
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
      "SELECT setting_key, setting_value FROM platform_settings WHERE setting_key IN ('cloudinary_cloud_name','cloudinary_upload_preset','ai_gemini_key','ai_openai_key','ai_groq_key','ai_opencode_go_key','ai_opencode_go_model','ai_text_model_main','ai_text_model_small','ai_default_provider','ai_openai_base_url','ai_openai_model','ai_vision_provider','ai_vision_model')"
    ) as any;

    const settings: Record<string, string> = {};
    for (const row of (rows as any[])) {
      const val = row.setting_value || '';
      // Decrypt AI keys (Cloudinary values are plaintext)
      if (['ai_gemini_key', 'ai_openai_key', 'ai_groq_key', 'ai_opencode_go_key'].includes(row.setting_key)) {
        try { settings[row.setting_key] = decrypt(val); }
        catch { settings[row.setting_key] = val; }
      } else {
        settings[row.setting_key] = val;
      }
    }

    res.json({
      success: true,
      data: {
        cloudinaryCloudName:    settings['cloudinary_cloud_name']      || '',
        cloudinaryUploadPreset: settings['cloudinary_upload_preset']   || '',
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

    const { cloudinaryCloudName, cloudinaryUploadPreset, geminiApiKey, openaiApiKey, groqApiKey, opencodeGoApiKey, opencodeGoModel, textModelMain, textModelSmall, defaultAiProvider, openaiBaseUrl, openaiModel, visionProvider, visionModel } = req.body;

    const updates: [string, string][] = [
      ['cloudinary_cloud_name',    cloudinaryCloudName    || ''],
      ['cloudinary_upload_preset', cloudinaryUploadPreset || ''],
    ];
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
    const realKey = (v: any) => typeof v === 'string' && v.length > 0 && !v.includes('•');
    const pushKey = (k: string, v: any) => {
      if (v === '__CLEAR__') updates.push([k, '']);
      else if (realKey(v)) updates.push([k, encrypt(v)]);
    };
    pushKey('ai_gemini_key', geminiApiKey);
    pushKey('ai_openai_key', openaiApiKey);
    pushKey('ai_groq_key',   groqApiKey);
    pushKey('ai_opencode_go_key', opencodeGoApiKey);

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
