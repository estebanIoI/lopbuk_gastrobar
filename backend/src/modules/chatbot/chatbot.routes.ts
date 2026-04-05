import { Router, Request, Response } from 'express';
import pool from '../../config/database';
import { authenticate } from '../../common/middleware';
import { v4 as uuidv4 } from 'uuid';

const router: ReturnType<typeof Router> = Router();

// =============================================
// HELPERS
// =============================================

async function getAIKey(): Promise<string> {
  const [rows] = await pool.query(
    "SELECT setting_value FROM platform_settings WHERE setting_key = 'openai_api_key' LIMIT 1"
  ) as any;
  return rows?.[0]?.setting_value?.trim() || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || '';
}

async function callGemini(
  apiKey: string,
  systemPrompt: string,
  messages: { role: string; content: string }[]
): Promise<string> {
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: { maxOutputTokens: 600, temperature: 0.7 },
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );

  if (!response.ok) {
    const err = await response.text();
    if (response.status === 429) {
      return 'Estoy recibiendo muchas consultas en este momento. Por favor espera unos segundos e intenta nuevamente. 🙏';
    }
    throw new Error(`Gemini error: ${err}`);
  }
  const data = await response.json() as any;
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Lo siento, no pude procesar tu mensaje.';
}

async function callOpenAI(
  apiKey: string,
  systemPrompt: string,
  messages: { role: string; content: string }[]
): Promise<string> {
  const allMessages = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ];
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages: allMessages, max_tokens: 600, temperature: 0.7 }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI error: ${err}`);
  }
  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content || 'Lo siento, no pude procesar tu mensaje.';
}

async function callAI(
  apiKey: string,
  systemPrompt: string,
  messages: { role: string; content: string }[]
): Promise<string> {
  // Auto-detect: Gemini keys start with "AIza", OpenAI keys start with "sk-"
  if (apiKey.startsWith('AIza')) {
    return callGemini(apiKey, systemPrompt, messages);
  }
  return callOpenAI(apiKey, systemPrompt, messages);
}

// =============================================
// PRODUCT SEARCH HELPER
// =============================================

interface ProductMatch {
  id: string;
  name: string;
  salePrice: number;
  imageUrl: string | null;
  category: string | null;
  stock: number;
}

async function searchProductsForChatbot(tenantId: string, query: string): Promise<ProductMatch[]> {
  if (!query || query.trim().length < 2) return [];

  const stopwords = new Set(['el','la','los','las','un','una','de','del','al','en','y','o','a','que','me','quiero','necesito','busco','hay','tiene','como','cuanto','precio','cuesta','comprar','ver','si','no','por','para','con','tengo','tienes','hola','buenas','gracias','favor','quisiera','podria','tienes']);
  const cleaned = query.toLowerCase().replace(/[¿?¡!.,;:]/g, '').trim();

  // Always try full phrase first
  const phraseParam = `%${cleaned}%`;

  // Then individual meaningful words
  const words = cleaned
    .split(/\s+/)
    .filter(w => w.length > 1 && !stopwords.has(w));

  // Build OR clauses: phrase match OR any word match
  const phraseClauses = '(p.name LIKE ? OR p.description LIKE ? OR p.category LIKE ? OR p.brand LIKE ?)';
  const wordClauses = words.map(() => '(p.name LIKE ? OR p.description LIKE ? OR p.category LIKE ? OR p.brand LIKE ?)').join(' OR ');

  const combinedWhere = wordClauses ? `${phraseClauses} OR ${wordClauses}` : phraseClauses;

  const likeValues: string[] = [phraseParam, phraseParam, phraseParam, phraseParam];
  for (const w of words) {
    likeValues.push(`%${w}%`, `%${w}%`, `%${w}%`, `%${w}%`);
  }

  const [rows] = await pool.query(
    `SELECT p.id, p.name, p.sale_price as salePrice, p.image_url as imageUrl, p.category, p.stock
     FROM products p
     WHERE p.tenant_id = ? AND p.published_in_store = 1 AND p.stock > 0
       AND (${combinedWhere})
     ORDER BY
       CASE WHEN p.name LIKE ? THEN 0 ELSE 1 END,
       p.stock DESC
     LIMIT 5`,
    [tenantId, ...likeValues, phraseParam]
  ) as any;

  return (rows as any[]).map((r: any) => ({
    id: String(r.id),
    name: r.name,
    salePrice: Number(r.salePrice),
    imageUrl: r.imageUrl || null,
    category: r.category || null,
    stock: Number(r.stock),
  }));
}

function buildSystemPrompt(config: any, storeInfo: any, products: ProductMatch[] = []): string {
  const tone = config.tone === 'amigable' ? 'amigable y cercano'
    : config.tone === 'formal' ? 'formal y respetuoso'
    : config.tone === 'casual' ? 'casual y relajado'
    : 'profesional y cordial';

  let prompt = `Eres ${config.bot_name || 'Asistente'}, el asistente virtual de ${storeInfo?.name || 'esta tienda'}.
Tu tono debe ser ${tone}. Responde siempre en español.
Tu objetivo es ayudar a los clientes con información sobre productos, precios, disponibilidad, horarios y proceso de compra.
NUNCA inventes información que no tengas. Si no sabes algo, indícalo con amabilidad y sugiere contactar directamente a la tienda.
Sé conciso pero completo. Máximo 3 párrafos por respuesta.`;

  if (config.business_info) {
    prompt += `\n\n## INFORMACIÓN DEL NEGOCIO:\n${config.business_info}`;
  }
  if (config.system_prompt) {
    prompt += `\n\n## INSTRUCCIONES ADICIONALES:\n${config.system_prompt}`;
  }
  if (config.faqs) {
    prompt += `\n\n## PREGUNTAS FRECUENTES:\n${config.faqs}`;
  }
  if (storeInfo?.phone || storeInfo?.email) {
    prompt += `\n\n## CONTACTO DIRECTO:\nTeléfono: ${storeInfo.phone || 'No disponible'} | Email: ${storeInfo.email || 'No disponible'}`;
  }

  if (products.length > 0) {
    const fmt = (v: number) => `$${v.toLocaleString('es-CO')}`;
    prompt += `\n\n## PRODUCTOS DISPONIBLES EN LA TIENDA (úsalos para responder):\n`;
    products.forEach(p => {
      prompt += `- ${p.name} — Precio: ${fmt(p.salePrice)} | Categoría: ${p.category || 'General'} | Stock: ${p.stock} unidades disponibles\n`;
    });
    prompt += `\nCuando el cliente mencione estos productos, informa precio, disponibilidad y anímalo a hacer clic en el botón de la tarjeta para verlo en la tienda.`;
  }

  return prompt;
}

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
        enabled: true,
        botName: rows[0].bot_name || 'Asistente',
        botAvatarUrl: rows[0].bot_avatar_url || null,
        accentColor: rows[0].accent_color || '#f59e0b',
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
    const { slug, sessionToken, message, customerName } = req.body;
    if (!slug || !message?.trim()) {
      res.status(400).json({ success: false, error: 'slug y message son requeridos' });
      return;
    }

    // Get tenant
    const [tenants] = await pool.query(
      "SELECT t.id, si.name as storeName, si.phone, si.email FROM tenants t LEFT JOIN store_info si ON si.tenant_id = t.id WHERE t.slug = ? AND t.status = 'activo' LIMIT 1",
      [slug]
    ) as any;
    if (!tenants?.length) {
      res.status(404).json({ success: false, error: 'Tienda no encontrada' });
      return;
    }
    const tenantId = tenants[0].id;
    const storeInfo = tenants[0];

    // Check chatbot is enabled
    const [cfgRows] = await pool.query(
      'SELECT * FROM chatbot_config WHERE tenant_id = ? AND is_enabled = 1 LIMIT 1',
      [tenantId]
    ) as any;
    if (!cfgRows?.length) {
      res.status(403).json({ success: false, error: 'Chatbot no disponible para esta tienda' });
      return;
    }
    const config = cfgRows[0];

    // Get or create session
    let sessionId: string;
    const token = sessionToken || uuidv4();
    const [existingSessions] = await pool.query(
      'SELECT id FROM chatbot_sessions WHERE session_token = ? AND tenant_id = ? LIMIT 1',
      [token, tenantId]
    ) as any;

    if (existingSessions?.length) {
      sessionId = existingSessions[0].id;
      await pool.query(
        'UPDATE chatbot_sessions SET last_activity = NOW(), customer_name = COALESCE(?, customer_name) WHERE id = ?',
        [customerName || null, sessionId]
      );
    } else {
      sessionId = uuidv4();
      await pool.query(
        'INSERT INTO chatbot_sessions (id, tenant_id, session_token, customer_name) VALUES (?, ?, ?, ?)',
        [sessionId, tenantId, token, customerName || null]
      );
    }

    // Get conversation history (last 10 messages)
    const [history] = await pool.query(
      'SELECT role, content FROM chatbot_messages WHERE session_id = ? ORDER BY created_at DESC LIMIT 10',
      [sessionId]
    ) as any;
    const historyMessages = (history as any[]).reverse().map((m: any) => ({
      role: m.role,
      content: m.content,
    }));

    // Save user message
    await pool.query(
      'INSERT INTO chatbot_messages (session_id, tenant_id, role, content) VALUES (?, ?, ?, ?)',
      [sessionId, tenantId, 'user', message.trim()]
    );

    // Search products matching the user message
    const matchedProducts = await searchProductsForChatbot(tenantId, message.trim()).catch(() => [] as ProductMatch[]);

    // Build prompt and conversation
    const systemPrompt = buildSystemPrompt(config, storeInfo, matchedProducts);
    const conversationMessages = [
      ...historyMessages,
      { role: 'user', content: message.trim() },
    ];

    // Call AI
    const apiKey = await getAIKey();
    if (!apiKey) {
      res.status(503).json({ success: false, error: 'Servicio de IA no configurado' });
      return;
    }
    const rawReply = await callAI(apiKey, systemPrompt, conversationMessages);

    // Clean any stray [COMPRAR:id] markers the AI may have included
    const reply = rawReply.replace(/\[COMPRAR:[^\]]+\]/gi, '').replace(/\n{3,}/g, '\n\n').trim();

    // Always show matched products — don't depend on AI placing markers
    const suggestedProducts = matchedProducts.slice(0, 3).map(p => ({
      id: p.id,
      name: p.name,
      salePrice: p.salePrice,
      imageUrl: p.imageUrl,
      category: p.category,
    }));

    // Save assistant response (clean, without markers)
    await pool.query(
      'INSERT INTO chatbot_messages (session_id, tenant_id, role, content) VALUES (?, ?, ?, ?)',
      [sessionId, tenantId, 'assistant', reply]
    );

    res.json({
      success: true,
      data: {
        reply,
        sessionToken: token,
        suggestedProducts: suggestedProducts.length > 0 ? suggestedProducts : undefined,
      },
    });
  } catch (error) {
    console.error('Chatbot message error:', error);
    res.status(500).json({ success: false, error: 'Error al procesar el mensaje' });
  }
});

// =============================================
// MERCHANT: GET chatbot config (knowledge base)
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
        is_enabled: false,
        bot_name: 'Asistente',
        bot_avatar_url: null,
        system_prompt: '',
        business_info: '',
        faqs: '',
        tone: 'amigable',
        notify_email: true,
        notify_whatsapp: true,
      },
    });
  } catch (error) {
    console.error('Chatbot config GET error:', error);
    res.status(500).json({ success: false, error: 'Error al obtener configuración del chatbot' });
  }
});

// =============================================
// MERCHANT: PUT chatbot knowledge base config
// PUT /api/chatbot/config
// =============================================
router.put('/config', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { botName, botAvatarUrl, accentColor, systemPrompt, businessInfo, faqs, tone, notifyEmail, notifyWhatsapp } = req.body;

    await pool.query(
      `INSERT INTO chatbot_config (tenant_id, bot_name, bot_avatar_url, accent_color, system_prompt, business_info, faqs, tone, notify_email, notify_whatsapp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         bot_name = VALUES(bot_name),
         bot_avatar_url = VALUES(bot_avatar_url),
         accent_color = VALUES(accent_color),
         system_prompt = VALUES(system_prompt),
         business_info = VALUES(business_info),
         faqs = VALUES(faqs),
         tone = VALUES(tone),
         notify_email = VALUES(notify_email),
         notify_whatsapp = VALUES(notify_whatsapp),
         updated_at = NOW()`,
      [
        tenantId,
        botName || 'Asistente',
        botAvatarUrl || null,
        accentColor || '#f59e0b',
        systemPrompt || null,
        businessInfo || null,
        faqs || null,
        tone || 'amigable',
        notifyEmail !== false ? 1 : 0,
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
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error al marcar notificaciones' });
  }
});

// =============================================
// PUBLIC (authenticated): GET Cloudinary config
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
        cloudName: settings['cloudinary_cloud_name'] || '',
        uploadPreset: settings['cloudinary_upload_preset'] || '',
      },
    });
  } catch (error) {
    console.error('Cloudinary config GET error:', error);
    res.status(500).json({ success: false, error: 'Error al obtener configuración de Cloudinary' });
  }
});

// =============================================
// SUPERADMIN: GET integrations (Cloudinary + OpenAI)
// GET /api/chatbot/superadmin/integrations
// =============================================
router.get('/superadmin/integrations', authenticate, async (req: Request, res: Response) => {
  try {
    if ((req as any).user.role !== 'superadmin') {
      res.status(403).json({ success: false, error: 'Solo superadmin' });
      return;
    }

    const [rows] = await pool.query(
      "SELECT setting_key, setting_value FROM platform_settings WHERE setting_key IN ('cloudinary_cloud_name','cloudinary_upload_preset','openai_api_key')"
    ) as any;

    const settings: Record<string, string> = {};
    for (const row of (rows as any[])) {
      settings[row.setting_key] = row.setting_value || '';
    }

    res.json({
      success: true,
      data: {
        cloudinaryCloudName: settings['cloudinary_cloud_name'] || '',
        cloudinaryUploadPreset: settings['cloudinary_upload_preset'] || '',
        openaiApiKey: settings['openai_api_key'] || '',
      },
    });
  } catch (error) {
    console.error('Integrations GET error:', error);
    res.status(500).json({ success: false, error: 'Error al obtener integraciones' });
  }
});

// =============================================
// SUPERADMIN: PUT integrations
// PUT /api/chatbot/superadmin/integrations
// =============================================
router.put('/superadmin/integrations', authenticate, async (req: Request, res: Response) => {
  try {
    if ((req as any).user.role !== 'superadmin') {
      res.status(403).json({ success: false, error: 'Solo superadmin' });
      return;
    }

    const { cloudinaryCloudName, cloudinaryUploadPreset, openaiApiKey } = req.body;

    const updates = [
      ['cloudinary_cloud_name', cloudinaryCloudName || ''],
      ['cloudinary_upload_preset', cloudinaryUploadPreset || ''],
      ['openai_api_key', openaiApiKey || ''],
    ];

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
// GET /api/chatbot/superadmin/tenants
// =============================================
router.get('/superadmin/tenants', authenticate, async (req: Request, res: Response) => {
  try {
    if ((req as any).user.role !== 'superadmin') {
      res.status(403).json({ success: false, error: 'Solo superadmin' });
      return;
    }

    const [rows] = await pool.query(
      `SELECT t.id, t.name, t.slug, t.status,
              cc.is_enabled as chatbotEnabled,
              cc.bot_name as botName,
              cc.updated_at as chatbotUpdatedAt
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
// Body: { enabled: boolean }
// =============================================
router.put('/superadmin/tenant/:tenantId', authenticate, async (req: Request, res: Response) => {
  try {
    if ((req as any).user.role !== 'superadmin') {
      res.status(403).json({ success: false, error: 'Solo superadmin' });
      return;
    }

    const { tenantId } = req.params;
    const { enabled } = req.body;

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
