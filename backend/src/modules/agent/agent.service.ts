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
// type-only: no crea ciclo en runtime (el orchestrator importa getAIKeys de aquí).
import type { ToolDef } from '../ai/orchestrator.service';

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
  opencodeGoKey: string;
  opencodeGoModel: string;
  // Tiering (IA5): modelo "main" (chat/agente complejo) y "small" (tareas livianas/baratas).
  opencodeGoModelMain: string;
  opencodeGoModelSmall: string;
  defaultProvider: 'gemini' | 'openai' | 'groq' | 'opencode_go';
  openaiBaseUrl: string;
  openaiModel: string;
  // Visión (IA3): proveedor + modelo para imagen→texto. NUNCA es un modelo de Go.
  visionProvider: 'gemini' | 'openai' | 'groq';
  visionModel: string;
}> {
  const [rows] = await pool.query(
    "SELECT setting_key, setting_value FROM platform_settings WHERE setting_key IN ('ai_gemini_key','ai_openai_key','ai_groq_key','ai_opencode_go_key','ai_opencode_go_model','ai_text_model_main','ai_text_model_small','ai_default_provider','ai_openai_base_url','ai_openai_model','ai_vision_provider','ai_vision_model')"
  ) as any;

  const settings: Record<string, string> = {};
  for (const row of (rows as any[])) {
    try { settings[row.setting_key] = decrypt(row.setting_value || ''); }
    catch { settings[row.setting_key] = row.setting_value || ''; }
  }

  const geminiKey = settings['ai_gemini_key'] || process.env.GEMINI_API_KEY || '';
  const openaiKey = settings['ai_openai_key'] || process.env.OPENAI_API_KEY || '';
  const groqKey = settings['ai_groq_key'] || process.env.GROQ_API_KEY || '';
  const opencodeGoKey = settings['ai_opencode_go_key'] || process.env.OPENCODE_GO_API_KEY || '';

  const rawProvider = (settings['ai_default_provider'] || process.env.AI_DEFAULT_PROVIDER || 'opencode_go').trim().toLowerCase();
  const validProviders = ['gemini', 'openai', 'groq', 'opencode_go'];
  let defaultProvider: 'gemini' | 'openai' | 'groq' | 'opencode_go' = validProviders.includes(rawProvider) ? rawProvider as any : 'opencode_go';

  // "Solo pegar la clave": si el proveedor elegido NO tiene clave configurada,
  // usa automáticamente el primero que sí la tenga (OpenCode Go → Groq → Gemini → OpenAI/OpenCode).
  const hasKey: Record<string, boolean> = {
    opencode_go: !!opencodeGoKey,
    groq: !!groqKey,
    gemini: !!geminiKey,
    openai: !!openaiKey,
  };
  if (!hasKey[defaultProvider]) {
    defaultProvider = (['opencode_go', 'groq', 'gemini', 'openai'] as const).find(p => hasKey[p]) as any || defaultProvider;
  }

  // Visión: proveedor multimodal (Go NO ve imágenes). Si el guardado trajera 'opencode_go'
  // o algo inválido, se cae a un proveedor de visión real (preferimos Gemini por costo).
  const rawVision = (settings['ai_vision_provider'] || process.env.AI_VISION_PROVIDER || 'gemini').trim().toLowerCase();
  const visionProvider: 'gemini' | 'openai' | 'groq' = (['gemini', 'openai', 'groq'].includes(rawVision) ? rawVision : 'gemini') as any;
  const visionModel = settings['ai_vision_model'] || process.env.AI_VISION_MODEL || '';

  const opencodeGoModel = settings['ai_opencode_go_model'] || process.env.OPENCODE_GO_MODEL || 'opencode-go/deepseek-v4-flash';
  // main: por defecto el modelo Go configurado. small: el más barato (DeepSeek Flash).
  const opencodeGoModelMain = settings['ai_text_model_main'] || process.env.OPENCODE_GO_MODEL_MAIN || opencodeGoModel;
  const opencodeGoModelSmall = settings['ai_text_model_small'] || process.env.OPENCODE_GO_MODEL_SMALL || 'opencode-go/deepseek-v4-flash';

  return {
    geminiKey,
    openaiKey,
    groqKey,
    opencodeGoKey,
    opencodeGoModel,
    opencodeGoModelMain,
    opencodeGoModelSmall,
    defaultProvider,
    // Por defecto usamos OpenCode Zen (plan del cliente): así basta con pegar la key sk- de OpenCode.
    // Si alguien quiere OpenAI oficial u otro compatible, pone su Base URL/modelo en el panel.
    openaiBaseUrl: (settings['ai_openai_base_url'] || process.env.OPENAI_BASE_URL || 'https://opencode.ai/zen/v1').replace(/\/+$/, ''),
    openaiModel: settings['ai_openai_model'] || process.env.OPENAI_MODEL || 'deepseek-v4-flash',
    visionProvider,
    visionModel,
  };
}

/** Returns the API key for the default provider (backward-compatible). */
export async function getAIKey(): Promise<string> {
  const keys = await getAIKeys();
  switch (keys.defaultProvider) {
    case 'gemini': return keys.geminiKey;
    case 'groq':   return keys.groqKey;
    case 'opencode_go': return keys.opencodeGoKey;
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
    `Eres un ASESOR COMERCIAL, no un contestador automático. Chateas como persona real por WhatsApp.\n` +
    `- Mensajes MUY cortos: 1 o 2 frases, casi nunca más de 40 palabras. Una sola idea o pregunta por mensaje.\n` +
    `- Nada de párrafos largos, listas largas ni "muros de texto". No repitas tu presentación en cada mensaje.\n` +
    `- Tono cercano y seguro: "¡Claro!", "Perfecto", "De una". Máximo 1 emoji ocasional.\n` +
    `- Habla de BENEFICIOS, no solo de características. Adapta el lenguaje al cliente.\n\n` +
    `## CÓMO VENDES (asesor consultivo)\n` +
    `1) ENTIENDE antes de ofrecer: detecta qué necesita y qué tan listo está para comprar. Si falta info, haz 1 pregunta corta.\n` +
    `2) RECOMIENDA UNA sola opción principal, la que mejor encaja (no la más cara). Si comparas, máximo 2 y di cuál conviene.\n` +
    `3) Resuelve dudas (precio, entrega, pago, disponibilidad) con seguridad: valida la duda y vuelve al beneficio.\n` +
    `4) Usa microcompromisos: que el cliente elija, confirme o responda algo corto para avanzar.\n` +
    `5) Detecta señales de compra (pregunta por precio, pago o entrega) y CIERRA: guía el pedido sin seguir explicando.\n\n` +
    `## QUÉ PRODUCTOS MOSTRAR (REGLA CLAVE)\n` +
    `- Solo menciona o sugieres productos que el cliente PIDIÓ o que encajan con lo que busca. NUNCA ofrezcas el catálogo completo ni productos al azar.\n` +
    `- Si el cliente no preguntó por un producto, no lo metas: ayúdalo con lo que sí pidió.\n` +
    `- Cuando el cliente YA dijo que quiere pedir un producto, NO se lo vuelvas a presentar ni repitas su tarjeta: avanza el pedido (primero la cantidad, luego nombre, teléfono y dirección si es domicilio).\n\n` +
    `## OBJETIVO\n` +
    `(1) Asesorar con productos, precios y disponibilidad, (2) hacer reservas cuando aplique, ` +
    `(3) tomar pedidos a domicilio o para llevar.\n` +
    `Avanza paso a paso: una cosa a la vez.\n\n` +
    `## REGLAS\n` +
    `NUNCA inventes información ni precios; usa solo lo que está en tu contexto.\n` +
    `SIEMPRE responde con un mensaje de TEXTO claro al cliente (jamás dejes la respuesta en blanco). Cuando el cliente diga qué quiere, lo PRIMERO es recomendarle el producto que encaja con su nombre y precio, y avanzar la venta; no saltes a pedir datos en seco.\n` +
    `NO registres el pedido (registrar_pedido) hasta tener TODOS los datos: nombre, teléfono, productos con cantidad, y si es a domicilio o para recoger. Ve pidiéndolos de a uno, con naturalidad.\n` +
    `Habla SIEMPRE en lenguaje natural y conversacional. Haz UNA sola pregunta por mensaje (nunca dos o tres juntas).\n` +
    `JAMÁS escribas llamados de herramientas como texto: nada de etiquetas tipo <function...>, <tool_call>, ni JSON de pedidos en el mensaje. El sistema ejecuta las herramientas por su cuenta. Si te falta un dato para registrar un pedido (nombre, teléfono, etc.), pídelo con naturalidad, de a uno.\n` +
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

  // Carta SOLO para consulta interna: el bot conoce qué existe y a qué precio,
  // pero NO debe ofrecer estos productos a menos que el cliente los pida o encajen.
  if (ctx.featuredProducts.length > 0) {
    prompt += `\n\n## CARTA (consulta interna — NO la listes al cliente):\n`;
    ctx.featuredProducts.forEach(p => {
      prompt += `- ${p.name} — ${fmt(p.salePrice)}${p.category ? ` | ${p.category}` : ''}\n`;
    });
    prompt += `\nUsa esta carta solo para responder con precisión lo que el cliente pregunte. Menciona un producto únicamente si lo pide o encaja con lo que busca; NUNCA la enumeres completa ni ofrezcas productos al azar. Si el cliente quiere pedir, usa la herramienta registrar_pedido.`;
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
// Conversión de declaraciones de herramientas → ToolDef del orchestrator
// (las declaraciones nativas son formato Gemini con tipos en MAYÚSCULA; el
//  agentLoop espera JSON-schema estándar y lo adapta a cada proveedor).
// ─────────────────────────────────────────────────────────────
function lowercaseTypes(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema;
  if (Array.isArray(schema)) return schema.map(lowercaseTypes);
  const out: any = {};
  for (const [k, v] of Object.entries(schema)) {
    out[k] = (k === 'type' && typeof v === 'string') ? v.toLowerCase() : lowercaseTypes(v);
  }
  return out;
}
function toToolDefs(decls: any[]): ToolDef[] {
  return decls.map(d => ({ name: d.name, description: d.description, parameters: lowercaseTypes(d.parameters) }));
}

// ─────────────────────────────────────────────────────────────
// Tool-calls escritos COMO TEXTO (<function=NAME>{json}</function>).
// Algunos proveedores no hacen function-calling nativo y el modelo escribe el
// llamado en el mensaje. Los detectamos para (1) ejecutarlos de verdad si traen
// los datos requeridos, y (2) no mostrar ese texto crudo al cliente.
// ─────────────────────────────────────────────────────────────
const TOOL_REQUIRED: Record<string, string[]> = {
  registrar_pedido: ['nombre', 'telefono', 'items', 'tipo'],
  crear_reserva: ['nombre', 'telefono', 'fecha', 'hora', 'personas'],
  registrar_interes_cliente: ['nombre', 'telefono', 'interes'],
  verificar_disponibilidad_reserva: ['fecha', 'personas'],
};
const FIELD_PROMPT: Record<string, string> = {
  nombre: '¿A nombre de quién registro el pedido?',
  telefono: '¿Me compartes tu número de teléfono para coordinar el pedido? 📱',
  direccion: '¿Cuál es la dirección exacta de entrega? 📍',
  items: '¿Qué te gustaría pedir?',
  tipo: '¿Lo quieres a domicilio o para recoger?',
  fecha: '¿Para qué fecha lo necesitas?',
  hora: '¿A qué hora?',
  personas: '¿Para cuántas personas?',
};
function extractInlineCalls(text: string): { name: string; args: any }[] {
  const out: { name: string; args: any }[] = [];
  const re = /<function=?\s*([a-zA-Z_]+)\s*>\s*([\s\S]*?)\s*<\/function>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    let args: any = {};
    try { args = JSON.parse(m[2]); } catch { /* json roto: se ignora */ }
    out.push({ name: m[1], args });
  }
  return out;
}
const TOOL_TAG_RE = /<function[^>]*>[\s\S]*?<\/function>|<function[\s\S]*$|<\/?function[^>]*>|<tool_call>[\s\S]*?<\/tool_call>|<\/?tool_call[^>]*>|<\|[^>]*\|>|\[COMPRAR:[^\]]+\]/gi;

// ─────────────────────────────────────────────────────────────
// Main pipeline — channel-agnostic
// ─────────────────────────────────────────────────────────────

export async function processAgentMessage(
  tenantId: string,
  sessionId: string,
  message: string,
  config: any,
  excludeProductIds: string[] = [],   // productos que el cliente ya está pidiendo: no repetir su tarjeta
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

  // IA7: TODOS los proveedores pasan por el agentLoop con las herramientas reales del
  // negocio (reservas/leads/pedidos). Antes solo Gemini ejecutaba herramientas; ahora el
  // bot registra pedidos con la IA configurada (OpenCode Go, etc.), con respaldo y
  // telemetría centralizados. Import dinámico para evitar ciclo de módulos.
  // Sugerencias de producto: solo coincidencias reales con la consulta (sin relleno al azar)
  // y excluyendo lo que el cliente ya está pidiendo (no repetir su tarjeta). Se calcula
  // ANTES del LLM para poder devolverlas incluso si la IA falla (rate limit, etc.).
  const exclude = new Set((excludeProductIds || []).map(String));
  const suggestedProducts: ProductMatch[] = matchedProducts
    .filter(p => !exclude.has(String(p.id)))
    .slice(0, 3);

  const { agentLoop } = await import('../ai/orchestrator.service');
  const toolDecls = [
    ...(dynamicCtx.reservationsEnabled ? RESERVATION_TOOL_DECLARATIONS : []),
    LEAD_TOOL_DECLARATION,
    ORDER_TOOL_DECLARATION,
  ];
  // Dedupe por turno: evita ejecutar dos veces la MISMA acción (mismo nombre+args),
  // protegiendo contra pedidos/reservas duplicados si el modelo reintenta.
  const executedTools = new Map<string, string>();
  let rawReply: string;
  try {
    const result = await agentLoop({
      system: systemPrompt,
      messages: conversationMessages,
      tools: toToolDefs(toolDecls),
      execute: async (name, args) => {
        const sig = `${name}:${JSON.stringify(args || {})}`;
        const prev = executedTools.get(sig);
        if (prev !== undefined) return prev;
        const r = await executeAgentTool(name, args || {}, tenantId, sessionId);
        const out = r.userMessage || JSON.stringify(r.data || {});
        executedTools.set(sig, out);
        return out;
      },
      maxTokens: 260,
      temperature: 0.7,
      maxRounds: 4,
      tier: 'main',
      tenantId,
    });
    rawReply = result.reply;
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg === 'NO_AI_KEY') throw new Error('Servicio de IA no configurado');
    // Errores de IA (rate limit del proveedor, caída temporal): respuesta amable, NUNCA 500.
    // El front muestra el texto y conserva las tarjetas de producto que ya encontramos.
    if (msg.includes('429') || /rate.?limit|tokens per minute|\bTPM\b|quota/i.test(msg)) {
      return { reply: 'Estoy recibiendo muchas consultas ahora mismo 🙏 Dame unos segundos y vuelve a escribirme.', suggestedProducts };
    }
    console.warn('[chatbot] Error de IA:', msg.slice(0, 200));
    return { reply: 'Tuve un problemita para responder. Intenta de nuevo en un momento. 🙂', suggestedProducts };
  }

  // Si el modelo escribió el/los llamado(s) como TEXTO, los procesamos: ejecutamos los
  // que traen los datos requeridos (para que el pedido SÍ se registre) y, si faltan datos,
  // pedimos el primero faltante con naturalidad.
  const inlineMsgs: string[] = [];
  let missingPrompt = '';
  for (const c of extractInlineCalls(rawReply)) {
    const reqd = TOOL_REQUIRED[c.name];
    if (reqd) {
      const miss = reqd.filter(k => !String(c.args?.[k] ?? '').trim());
      if (c.name === 'registrar_pedido' && c.args?.tipo === 'domicilio' && !String(c.args?.direccion ?? '').trim()) miss.push('direccion');
      if (miss.length > 0) { if (!missingPrompt) missingPrompt = FIELD_PROMPT[miss[0]] || 'Me falta un dato para completar tu pedido, ¿me lo confirmas?'; continue; }
    }
    const sig = `${c.name}:${JSON.stringify(c.args || {})}`;
    if (executedTools.has(sig)) { const prev = executedTools.get(sig); if (prev) inlineMsgs.push(prev); continue; }
    try {
      const r = await executeAgentTool(c.name, c.args || {}, tenantId, sessionId);
      const out = r.userMessage || '';
      executedTools.set(sig, out);
      if (out) inlineMsgs.push(out);
    } catch { /* noop */ }
  }

  // Limpieza: quita TODA etiqueta de herramienta del texto para que no se vea cruda.
  const cleaned = rawReply.replace(TOOL_TAG_RE, '').replace(/\n{3,}/g, '\n\n').trim();
  // Reply final = texto conversacional limpio + confirmaciones de herramientas ejecutadas.
  let reply = [cleaned, ...inlineMsgs].filter(Boolean).join('\n\n').trim();
  if (!reply) {
    // El modelo no devolvió texto (suele pasar al intentar un tool-call vacío). En vez de
    // un genérico, damos una respuesta de VENTA: si hay un producto que coincide con lo
    // que pidió, lo mencionamos con su precio y avanzamos; si faltaba un dato, lo pedimos.
    if (missingPrompt) reply = missingPrompt;
    else if (suggestedProducts.length > 0) {
      const p0 = suggestedProducts[0];
      reply = `¡Claro que sí! Tenemos ${p0.name} a $${Number(p0.salePrice).toLocaleString('es-CO')}. ¿Cuántos necesitas o te muestro más opciones? 🙂`;
    } else {
      reply = '¡Con gusto te ayudo! Cuéntame qué producto buscas. 🙂';
    }
  }
  return { reply, suggestedProducts };
}
