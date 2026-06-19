/**
 * agent.service.ts
 * Core AI pipeline — shared by chatbot (web), WhatsApp, and voice channels.
 * All channel-specific HTTP handling stays in their own route files.
 */
import pool from '../../config/database';
import { v4 as uuidv4 } from 'uuid';
import { buildDynamicContext, DynamicContext } from './agent.rag';
import {
  executeAgentTool,
  RESERVATION_TOOL_DECLARATIONS,
  LEAD_TOOL_DECLARATION,
  ORDER_TOOL_DECLARATION,
} from './agent.tools';
import { decrypt } from '../../utils/crypto';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface ProductMatch {
  id: string;
  name: string;
  salePrice: number;
  imageUrl: string | null;
  category: string | null;
  stock: number;
}

const EMPTY_CONTEXT: DynamicContext = {
  storeName: '',
  storeSlug: '',
  storePhone: null,
  storeEmail: null,
  storeAddress: null,
  storeSchedule: null,
  storeWhatsapp: null,
  storeInstagram: null,
  paymentMethods: null,
  categories: [],
  services: [],
  featuredProducts: [],
  reservationsEnabled: false,
};

// ─────────────────────────────────────────────────────────────
// AI keys — multi-provider
// ─────────────────────────────────────────────────────────────

export async function getAIKeys(): Promise<{
  geminiKey: string;
  openaiKey: string;
  groqKey: string;
  defaultProvider: 'gemini' | 'openai' | 'groq';
  openaiBaseUrl: string;
  openaiModel: string;
}> {
  const [rows] = await pool.query(
    "SELECT setting_key, setting_value FROM platform_settings WHERE setting_key IN ('ai_gemini_key','ai_openai_key','ai_groq_key','ai_default_provider','ai_openai_base_url','ai_openai_model')"
  ) as any;

  const settings: Record<string, string> = {};
  for (const row of (rows as any[])) {
    try { settings[row.setting_key] = decrypt(row.setting_value || ''); }
    catch { settings[row.setting_key] = row.setting_value || ''; }
  }

  const geminiKey = settings['ai_gemini_key'] || process.env.GEMINI_API_KEY || '';
  const openaiKey = settings['ai_openai_key'] || process.env.OPENAI_API_KEY || '';
  const groqKey = settings['ai_groq_key'] || process.env.GROQ_API_KEY || '';

  const rawProvider = (settings['ai_default_provider'] || process.env.AI_DEFAULT_PROVIDER || 'openai').trim().toLowerCase();
  let defaultProvider: 'gemini' | 'openai' | 'groq' = ['gemini', 'openai', 'groq'].includes(rawProvider) ? rawProvider as any : 'openai';

  // "Solo pegar la clave": si el proveedor elegido NO tiene clave configurada,
  // usa automáticamente el primero que sí la tenga (Groq → Gemini → OpenAI/OpenCode).
  const hasKey: Record<'gemini' | 'openai' | 'groq', boolean> = { gemini: !!geminiKey, openai: !!openaiKey, groq: !!groqKey };
  if (!hasKey[defaultProvider]) {
    defaultProvider = (['groq', 'gemini', 'openai'] as const).find(p => hasKey[p]) || defaultProvider;
  }

  return {
    geminiKey,
    openaiKey,
    groqKey,
    defaultProvider,
    // Por defecto usamos OpenCode Zen (plan del cliente): así basta con pegar la key sk- de OpenCode.
    // Si alguien quiere OpenAI oficial u otro compatible, pone su Base URL/modelo en el panel.
    openaiBaseUrl: (settings['ai_openai_base_url'] || process.env.OPENAI_BASE_URL || 'https://opencode.ai/zen/v1').replace(/\/+$/, ''),
    openaiModel: settings['ai_openai_model'] || process.env.OPENAI_MODEL || 'deepseek-v4-flash',
  };
}

/** Returns the API key for the default provider (backward-compatible). */
export async function getAIKey(): Promise<string> {
  const keys = await getAIKeys();
  switch (keys.defaultProvider) {
    case 'gemini': return keys.geminiKey;
    case 'groq':   return keys.groqKey;
    default:       return keys.openaiKey;
  }
}

// ─────────────────────────────────────────────────────────────
// Gemini
// ─────────────────────────────────────────────────────────────

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export async function callGemini(
  apiKey: string,
  systemPrompt: string,
  messages: { role: string; content: string }[],
): Promise<string> {
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { maxOutputTokens: 250, temperature: 0.7 },
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      return 'Estoy recibiendo muchas consultas. Por favor espera unos segundos e intenta nuevamente. 🙏';
    }
    throw new Error(`Gemini error: ${await response.text()}`);
  }
  const data = await response.json() as any;
  return data.candidates?.[0]?.content?.parts?.[0]?.text
    || 'Lo siento, no pude procesar tu mensaje.';
}

// Gemini with function calling — executes at most one tool per turn.
export async function callGeminiWithTools(
  apiKey: string,
  systemPrompt: string,
  messages: { role: string; content: string }[],
  toolDeclarations: any[],
  tenantId: string,
  sessionId: string,
): Promise<string> {
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  // First call — model may return a function call or plain text
  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      tools: [{ functionDeclarations: toolDeclarations }],
      tool_config: { function_calling_config: { mode: 'AUTO' } },
      generationConfig: { maxOutputTokens: 250, temperature: 0.7 },
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      return 'Estoy recibiendo muchas consultas. Por favor espera unos segundos e intenta nuevamente. 🙏';
    }
    throw new Error(`Gemini error: ${await response.text()}`);
  }

  const data = await response.json() as any;
  const candidate = data.candidates?.[0]?.content;
  if (!candidate) return 'Lo siento, no pude procesar tu mensaje.';

  // Plain text response
  const functionCallPart = candidate.parts?.find((p: any) => p.functionCall);
  if (!functionCallPart) {
    return candidate.parts?.find((p: any) => p.text)?.text
      || 'Lo siento, no pude procesar tu mensaje.';
  }

  // Execute tool
  const { name, args } = functionCallPart.functionCall;
  const toolResult = await executeAgentTool(name, args, tenantId, sessionId);

  // Second call — model produces natural-language response from tool result
  const response2 = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [
        ...contents,
        { role: 'model', parts: [{ functionCall: { name, args } }] },
        {
          role: 'user',
          parts: [{
            functionResponse: {
              name,
              response: { content: toolResult.userMessage || JSON.stringify(toolResult.data || {}) },
            },
          }],
        },
      ],
      generationConfig: { maxOutputTokens: 250, temperature: 0.7 },
    }),
  });

  if (!response2.ok) return toolResult.userMessage || 'Lo siento, no pude completar la acción.';
  const data2 = await response2.json() as any;
  return data2.candidates?.[0]?.content?.parts?.[0]?.text || toolResult.userMessage;
}

// ─────────────────────────────────────────────────────────────
// OpenAI
// ─────────────────────────────────────────────────────────────

export async function callOpenAI(
  apiKey: string,
  systemPrompt: string,
  messages: { role: string; content: string }[],
  baseUrl?: string,
  model?: string,
): Promise<string> {
  // Base URL/modelo configurables (OpenAI oficial o compatibles como OpenCode/OpenRouter).
  const url = (baseUrl || process.env.OPENAI_BASE_URL || 'https://opencode.ai/zen/v1').replace(/\/+$/, '') + '/chat/completions';
  const mdl = model || process.env.OPENAI_MODEL || 'deepseek-v4-flash';
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: mdl,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      max_tokens: 250,
      temperature: 0.7,
    }),
  });
  if (!response.ok) throw new Error(`OpenAI error: ${await response.text()}`);
  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content || 'Lo siento, no pude procesar tu mensaje.';
}

// ─────────────────────────────────────────────────────────────
// Groq (OpenAI-compatible API)
// ─────────────────────────────────────────────────────────────

const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

export async function callGroq(
  apiKey: string,
  systemPrompt: string,
  messages: { role: string; content: string }[],
): Promise<string> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      max_tokens: 250,
      temperature: 0.7,
    }),
  });
  if (!response.ok) {
    if (response.status === 429) {
      return 'Estoy recibiendo muchas consultas. Por favor espera unos segundos e intenta nuevamente. 🙏';
    }
    throw new Error(`Groq error: ${await response.text()}`);
  }
  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content || 'Lo siento, no pude procesar tu mensaje.';
}

export async function callAI(
  apiKey: string,
  systemPrompt: string,
  messages: { role: string; content: string }[],
): Promise<string> {
  if (apiKey.startsWith('AIza')) return callGemini(apiKey, systemPrompt, messages);
  if (apiKey.startsWith('gsk_')) return callGroq(apiKey, systemPrompt, messages);
  return callOpenAI(apiKey, systemPrompt, messages);
}

// ─────────────────────────────────────────────────────────────
// Product search
// ─────────────────────────────────────────────────────────────

export async function searchProductsForChatbot(
  tenantId: string,
  query: string,
): Promise<ProductMatch[]> {
  if (!query || query.trim().length < 2) return [];

  const stopwords = new Set([
    'el','la','los','las','un','una','unos','unas','de','del','al','en','y','o','a','que','me',
    'quiero','necesito','busco','hay','tiene','como','cuanto','precio','cuesta',
    'comprar','ver','si','no','por','para','con','tengo','tienes','tienen','hola','buenas',
    'gracias','favor','quisiera','podria','dame','deme','dame','ponme','tráeme','traeme',
    // palabras comodín que no aportan al match de productos
    'algo','alguna','alguno','algunos','algunas','tipo','pedir','ordenar',
  ]);
  const cleaned = query.toLowerCase().replace(/[¿?¡!.,;:]/g, '').trim();
  const phraseParam = `%${cleaned}%`;
  const words = cleaned.split(/\s+/).filter(w => w.length > 1 && !stopwords.has(w));

  const phraseClauses = '(p.name LIKE ? OR p.description LIKE ? OR p.category LIKE ? OR p.brand LIKE ?)';
  const wordClauses   = words
    .map(() => '(p.name LIKE ? OR p.description LIKE ? OR p.category LIKE ? OR p.brand LIKE ?)')
    .join(' OR ');
  const combinedWhere = wordClauses ? `${phraseClauses} OR ${wordClauses}` : phraseClauses;

  const likeValues: string[] = [phraseParam, phraseParam, phraseParam, phraseParam];
  for (const w of words) likeValues.push(`%${w}%`, `%${w}%`, `%${w}%`, `%${w}%`);

  const [rows] = await pool.query(
    `SELECT p.id, p.name, p.sale_price AS salePrice, p.image_url AS imageUrl, p.category, p.stock
     FROM products p
     WHERE p.tenant_id = ? AND p.published_in_store = 1 AND p.stock > 0
       AND (${combinedWhere})
     ORDER BY CASE WHEN p.name LIKE ? THEN 0 ELSE 1 END, p.stock DESC
     LIMIT 5`,
    [tenantId, ...likeValues, phraseParam],
  ) as any;

  const allResults = (rows as any[]).map((r: any) => ({
    id: String(r.id),
    name: r.name,
    salePrice: Number(r.salePrice),
    imageUrl: r.imageUrl || null,
    category: r.category || null,
    stock: Number(r.stock),
  }));

  // Prefer products whose NAME contains at least one content word.
  // This avoids returning items that only matched via description
  // (e.g. "Tacos de Carne Asada" having "guacamole" in its description).
  if (words.length > 0) {
    const nameMatches = allResults.filter(p =>
      words.some(w => p.name.toLowerCase().includes(w)),
    );
    if (nameMatches.length > 0) return nameMatches.slice(0, 3);
  }

  return allResults.slice(0, 3);
}

// ─────────────────────────────────────────────────────────────
// System prompt
// ─────────────────────────────────────────────────────────────

export function buildEnrichedSystemPrompt(
  config: any,
  ctx: DynamicContext,
  products: ProductMatch[],
): string {
  const fmt = (v: number) => `$${v.toLocaleString('es-CO')}`;

  const tone = config.tone === 'amigable' ? 'amigable y cercano'
    : config.tone === 'formal'    ? 'formal y respetuoso'
    : config.tone === 'casual'    ? 'casual y relajado'
    : 'profesional y cordial';

  let prompt =
    `Eres ${config.bot_name || 'Asistente'}, el asistente virtual de ${ctx.storeName || 'este negocio'}.\n` +
    `Tu tono debe ser ${tone}. Responde siempre en español.\n\n` +
    `## CÓMO HABLAS (MUY IMPORTANTE)\n` +
    `Estás chateando como una persona real por WhatsApp, no escribiendo un correo ni un folleto.\n` +
    `- Mensajes MUY cortos: 1 o 2 frases por respuesta. Casi nunca más de 40 palabras.\n` +
    `- Una sola idea o una sola pregunta por mensaje. NO hagas varias preguntas juntas.\n` +
    `- Nada de párrafos largos, listas largas ni "muros de texto". Si tienes que dar varias cosas, dale lo esencial y pregunta si quiere más.\n` +
    `- Habla natural y cercano, como un vendedor amable: "¡Claro!", "Perfecto", "De una". Puedes usar 1 emoji ocasional, sin abusar.\n` +
    `- No repitas tu presentación ("Soy el asistente virtual de...") en cada mensaje. Solo salúdalo una vez al inicio.\n` +
    `- Si el cliente saluda o dice algo corto, responde corto. No le sueltes todo el catálogo de golpe.\n` +
    `- Cuando muestres productos, di máximo 1 o 2 y pregunta cuál le interesa, en vez de listar todo.\n\n` +
    `## OBJETIVO\n` +
    `(1) Ayudar con productos, precios y disponibilidad, (2) hacer reservas cuando aplique, ` +
    `(3) tomar pedidos a domicilio o para llevar.\n` +
    `Avanza la conversación paso a paso: pregunta una cosa, espera respuesta, sigue.\n\n` +
    `## REGLAS\n` +
    `NUNCA inventes información.\n` +
    `CRÍTICO: NUNCA digas que un producto NO existe o no está disponible a menos que ` +
    `aparezca explícitamente en "PRODUCTOS QUE COINCIDEN CON LA CONSULTA" con stock 0. ` +
    `Si el cliente pide algo que no ves en tu contexto, dile que lo verificas y que puede confirmar con el negocio, ` +
    `pero NO afirmes que no lo tienen.`;

  if (config.business_info) prompt += `\n\n## INFORMACIÓN DEL NEGOCIO:\n${config.business_info}`;

  const contact: string[] = [];
  if (ctx.storePhone)    contact.push(`Teléfono: ${ctx.storePhone}`);
  if (ctx.storeWhatsapp) contact.push(`WhatsApp: ${ctx.storeWhatsapp}`);
  if (ctx.storeEmail)    contact.push(`Email: ${ctx.storeEmail}`);
  if (ctx.storeAddress)  contact.push(`Dirección: ${ctx.storeAddress}`);
  if (contact.length)    prompt += `\n\n## CONTACTO:\n${contact.join(' | ')}`;

  if (ctx.storeSchedule)   prompt += `\n\n## HORARIO:\n${ctx.storeSchedule}`;
  if (ctx.paymentMethods)  prompt += `\n\n## MÉTODOS DE PAGO:\n${ctx.paymentMethods}`;
  if (ctx.categories.length > 0) prompt += `\n\n## CATEGORÍAS:\n${ctx.categories.join(', ')}`;

  if (ctx.services.length > 0) {
    prompt += `\n\n## SERVICIOS:\n`;
    ctx.services.forEach(s => {
      const price = s.priceType === 'gratis'     ? 'Gratis'
        : s.priceType === 'cotizacion' ? 'A cotizar'
        : s.priceType === 'desde'      ? `Desde ${fmt(s.price)}`
        : fmt(s.price);
      const dur = s.durationMinutes ? ` (${s.durationMinutes} min)` : '';
      prompt += `- ${s.name}: ${price}${dur}\n`;
    });
  }

  if (ctx.reservationsEnabled) {
    prompt += `\n\n## RESERVAS:\nEste negocio acepta reservas online.`;
    if (ctx.reservationOpenTime && ctx.reservationCloseTime) {
      prompt += ` Horario: ${ctx.reservationOpenTime.slice(0,5)} – ${ctx.reservationCloseTime.slice(0,5)}.`;
    }
    if (ctx.reservationOccasions?.length) {
      prompt += ` Ocasiones: ${ctx.reservationOccasions.join(', ')}.`;
    }
    prompt += `\nPara reservar necesitas: nombre completo, teléfono, fecha, personas. Primero verifica disponibilidad.`;
  }

  // Menú destacado — siempre visible al AI para que pueda sugerir proactivamente
  if (ctx.featuredProducts.length > 0) {
    prompt += `\n\n## MENÚ / PRODUCTOS DISPONIBLES:\n`;
    ctx.featuredProducts.forEach(p => {
      prompt += `- ${p.name} — ${fmt(p.salePrice)}${p.category ? ` | ${p.category}` : ''}\n`;
    });
    prompt += `\nPuedes mencionar estos productos cuando sea relevante. Si el cliente quiere pedir, usa la herramienta registrar_pedido.`;
  }

  // Productos que coincidieron con la búsqueda del cliente
  if (products.length > 0) {
    prompt += `\n\n## PRODUCTOS QUE COINCIDEN CON LA CONSULTA:\n`;
    products.forEach(p => {
      prompt += `- ${p.name} — ${fmt(p.salePrice)} | ${p.category || 'General'} | Stock: ${p.stock}\n`;
    });
    prompt +=
      `\nEstos productos aparecerán como tarjetas interactivas en el chat. ` +
      `Cuando los menciones, indica al cliente que puede tocar el botón "Ver" en cada tarjeta ` +
      `para ver la información completa del plato y hacer su pedido directamente desde ahí.`;
  }

  // Instrucciones de pedidos/domicilio
  prompt += `\n\n## PEDIDOS Y DOMICILIOS:\n` +
    `Para tomar un pedido necesitas: nombre completo, teléfono, lista de productos con cantidades, ` +
    `y si es domicilio la dirección de entrega. ` +
    `Usa la herramienta registrar_pedido para confirmar el pedido y notificar al negocio.`;
  if (ctx.storeWhatsapp) {
    prompt += ` El cliente también puede contactar directamente por WhatsApp al ${ctx.storeWhatsapp}.`;
  }

  if (config.system_prompt) prompt += `\n\n## INSTRUCCIONES ADICIONALES:\n${config.system_prompt}`;
  if (config.faqs)           prompt += `\n\n## PREGUNTAS FRECUENTES:\n${config.faqs}`;

  return prompt;
}

// ─────────────────────────────────────────────────────────────
// Session helpers
// ─────────────────────────────────────────────────────────────

export async function getOrCreateSession(
  token: string,
  tenantId: string,
  opts: { customerName?: string; customerPhone?: string } = {},
): Promise<string> {
  const [existing] = await pool.query(
    'SELECT id FROM chatbot_sessions WHERE session_token = ? AND tenant_id = ? LIMIT 1',
    [token, tenantId],
  ) as any;

  if (existing?.length) {
    await pool.query(
      `UPDATE chatbot_sessions
       SET last_activity  = NOW(),
           customer_name  = COALESCE(?, customer_name),
           customer_phone = COALESCE(?, customer_phone)
       WHERE id = ?`,
      [opts.customerName || null, opts.customerPhone || null, existing[0].id],
    );
    return existing[0].id;
  }

  const sessionId = uuidv4();
  await pool.query(
    `INSERT INTO chatbot_sessions (id, tenant_id, session_token, customer_name, customer_phone)
     VALUES (?, ?, ?, ?, ?)`,
    [sessionId, tenantId, token, opts.customerName || null, opts.customerPhone || null],
  );
  return sessionId;
}

export async function isHumanTakeover(sessionId: string): Promise<boolean> {
  try {
    const [rows] = await pool.query(
      'SELECT human_takeover FROM chatbot_sessions WHERE id = ? LIMIT 1',
      [sessionId],
    ) as any;
    return !!rows?.[0]?.human_takeover;
  } catch {
    return false; // column may not exist yet
  }
}

export async function getConversationHistory(
  sessionId: string,
): Promise<{ role: string; content: string }[]> {
  const [history] = await pool.query(
    'SELECT role, content FROM chatbot_messages WHERE session_id = ? ORDER BY created_at DESC LIMIT 10',
    [sessionId],
  ) as any;
  return (history as any[]).reverse().map((m: any) => ({ role: m.role, content: m.content }));
}

export async function saveMessage(
  sessionId: string,
  tenantId: string,
  role: 'user' | 'assistant',
  content: string,
): Promise<void> {
  await pool.query(
    'INSERT INTO chatbot_messages (session_id, tenant_id, role, content) VALUES (?, ?, ?, ?)',
    [sessionId, tenantId, role, content],
  );
}

// ─────────────────────────────────────────────────────────────
// Intent guard — only search products when the message is
// clearly about catalog, prices, or menu items.
// ─────────────────────────────────────────────────────────────

const PRODUCT_SIGNALS = [
  // precio / disponibilidad
  'precio', 'precios', 'cuánto', 'cuanto', 'cuesta', 'cuestan', 'vale', 'valen',
  // existencia
  'tienen', 'tienes', 'tiene', 'hay ', 'habrá', 'habra',
  // catálogo
  'menú', 'menu', 'carta', 'catálogo', 'catalogo',
  'disponible', 'stock', 'producto', 'productos',
  // pedido / compra / intención directa de ordenar
  'pedido', 'pedir', 'ordenar', 'comprar', 'quiero pedir', 'para llevar', 'a domicilio',
  'quiero ', 'quisiera', 'me das', 'me trae', 'tráeme', 'dame ', 'deme ', 'ponme ',
  'quiero una', 'quiero un', 'quiero unos', 'quiero unas',
  // consultas por ingrediente o tipo
  'algo de', 'algo con',
  // recomendaciones
  'recomiend', 'sugier',
  // qué ofrecen
  'qué tienen', 'que tienen', 'qué hay', 'que hay',
  // platos / bebidas
  'plato', 'platos', 'platillo', 'platillos', 'comer', 'tomar', 'bebida', 'bebidas',
];

function isProductQuery(message: string): boolean {
  const lower = message.toLowerCase();
  return PRODUCT_SIGNALS.some(w => lower.includes(w));
}

// ─────────────────────────────────────────────────────────────
// Main pipeline — channel-agnostic
// ─────────────────────────────────────────────────────────────

export async function processAgentMessage(
  tenantId: string,
  sessionId: string,
  message: string,
  config: any,
): Promise<{ reply: string; suggestedProducts: ProductMatch[] }> {
  const historyMessages = await getConversationHistory(sessionId);

  const productQuery = isProductQuery(message);

  const [matchedProducts, dynamicCtx] = await Promise.all([
    productQuery
      ? searchProductsForChatbot(tenantId, message).catch(() => [] as ProductMatch[])
      : Promise.resolve([] as ProductMatch[]),
    buildDynamicContext(tenantId).catch(() => EMPTY_CONTEXT),
  ]);

  const systemPrompt        = buildEnrichedSystemPrompt(config, dynamicCtx, matchedProducts);
  const conversationMessages = [...historyMessages, { role: 'user', content: message }];

  const { geminiKey, openaiKey, groqKey, defaultProvider, openaiBaseUrl, openaiModel } = await getAIKeys();
  const apiKey = defaultProvider === 'gemini' ? geminiKey : defaultProvider === 'groq' ? groqKey : openaiKey;
  if (!apiKey) throw new Error('Servicio de IA no configurado');

  let rawReply: string;
  if (defaultProvider === 'gemini') {
    const tools = [
      ...(dynamicCtx.reservationsEnabled ? RESERVATION_TOOL_DECLARATIONS : []),
      LEAD_TOOL_DECLARATION,
      ORDER_TOOL_DECLARATION,
    ];
    rawReply = await callGeminiWithTools(geminiKey, systemPrompt, conversationMessages, tools, tenantId, sessionId);
  } else if (defaultProvider === 'groq') {
    rawReply = await callGroq(groqKey, systemPrompt, conversationMessages);
  } else {
    rawReply = await callOpenAI(openaiKey, systemPrompt, conversationMessages, openaiBaseUrl, openaiModel);
  }

  const reply = rawReply.replace(/\[COMPRAR:[^\]]+\]/gi, '').replace(/\n{3,}/g, '\n\n').trim();

  // Build suggestions: matched products first; if none found on a product query,
  // fall back to featured products so cards always appear when the AI mentions menu items.
  let suggestedProducts: ProductMatch[] = matchedProducts.slice(0, 3);
  if (suggestedProducts.length === 0 && productQuery && dynamicCtx.featuredProducts.length > 0) {
    suggestedProducts = dynamicCtx.featuredProducts.slice(0, 3).map(fp => ({
      id: fp.id,
      name: fp.name,
      salePrice: fp.salePrice,
      imageUrl: fp.imageUrl,
      category: fp.category,
      stock: 1,
    }));
  }

  return { reply, suggestedProducts };
}
