/**
 * ai/orchestrator.service — Capa única de orquestación de IA (IA1).
 *
 * `textLLM()` es el ÚNICO punto por el que debe pasar toda generación de TEXTO
 * del sistema (chatbots, Q&A, agente, rutina, contenido). Centraliza la elección
 * de proveedor + una cadena de respaldo robusta:
 *
 *   default (OpenCode Go) → Groq → Gemini → OpenAI/compat
 *
 * Honra maxTokens/temperature (los helpers viejos los tenían fijos). La visión
 * (imagen→texto) y el tiering por modelo entran en IA2/IA5; aquí queda la base.
 */
import { createHash } from 'crypto';
import { getAIKeys } from '../agent/agent.service';
import { db } from '../../config';

export type AiProvider = 'gemini' | 'openai' | 'groq' | 'opencode_go';
export type AiTier = 'small' | 'main';

export interface TextLLMRequest {
  system: string;
  messages: { role: string; content: string }[];
  maxTokens?: number;     // def. 250
  temperature?: number;   // def. 0.7
  tier?: AiTier;          // IA5: 'small' (barato) | 'main' (chat/agente). Elige el modelo Go.
  model?: string;         // override del modelo de texto
  tenantId?: string | null; // IA6: para telemetría por comercio
}

const GO_URL = 'https://opencode.ai/zen/go/v1/chat/completions';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';

const norm = (m: { role: string; content: string }) => ({
  role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user',
  content: m.content,
});

/**
 * Modelo Go según tier (IA5). `model` explícito gana siempre. Si no, `tier`
 * elige entre el modelo "small" (barato: títulos, clasificación, respuestas
 * cortas) y "main" (chat/agente complejo). Sin tier → el modelo Go configurado.
 */
function goModelFor(keys: any, req: { tier?: AiTier; model?: string }): string {
  let m: string;
  if (req.model) m = req.model;
  else if (req.tier === 'small') m = keys.opencodeGoModelSmall || keys.opencodeGoModel;
  else if (req.tier === 'main') m = keys.opencodeGoModelMain || keys.opencodeGoModel;
  else m = keys.opencodeGoModel;
  // La API de OpenCode espera el id del modelo PELADO (ej. "deepseek-v4-flash").
  // El prefijo "opencode-go/" o "opencode/" es solo para el config del CLI y la API
  // responde 401 ModelError ("Model ... is not supported") si se manda con prefijo.
  return String(m || '').replace(/^opencode(?:-go)?\//i, '');
}

// ── Telemetría (IA6): tokens + costo por llamada ──────────────────────────────
interface Usage { prompt: number; completion: number; total: number }
const ZERO_USAGE: Usage = { prompt: 0, completion: 0, total: 0 };
type LLMResult = { text: string; usage: Usage };

// ── Llamadas por proveedor (todas honran maxTokens/temperature) ───────────────
async function openaiCompat(url: string, apiKey: string, model: string, req: TextLLMRequest): Promise<LLMResult> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: req.system }, ...req.messages.map(norm)],
      max_tokens: req.maxTokens ?? 250,
      temperature: req.temperature ?? 0.7,
    }),
  });
  if (!r.ok) throw new Error(`${url} ${r.status}: ${await r.text()}`);
  const d = await r.json() as any;
  const u = d.usage || {};
  return {
    text: d.choices?.[0]?.message?.content || '',
    usage: { prompt: u.prompt_tokens || 0, completion: u.completion_tokens || 0, total: u.total_tokens || (u.prompt_tokens || 0) + (u.completion_tokens || 0) },
  };
}

async function groq(apiKey: string, req: TextLLMRequest): Promise<LLMResult> {
  return openaiCompat(GROQ_URL, apiKey, GROQ_MODEL, req);
}

async function gemini(apiKey: string, req: TextLLMRequest): Promise<LLMResult> {
  const contents = req.messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: req.system }] },
      contents,
      generationConfig: { maxOutputTokens: req.maxTokens ?? 250, temperature: req.temperature ?? 0.7 },
    }),
  });
  if (!r.ok) throw new Error(`gemini ${r.status}: ${await r.text()}`);
  const d = await r.json() as any;
  const m = d.usageMetadata || {};
  return {
    text: d.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text || '',
    usage: { prompt: m.promptTokenCount || 0, completion: m.candidatesTokenCount || 0, total: m.totalTokenCount || 0 },
  };
}

// Tarifas aproximadas USD por 1M tokens [entrada, salida]. Default para modelos no listados.
const RATES: Record<string, [number, number]> = {
  // ids pelados (los que realmente se mandan a la API tras quitar el prefijo)
  'deepseek-v4-flash': [0.14, 0.28],
  'deepseek-v4-flash-free': [0, 0],
  'mimo-v2.5': [0.14, 0.28],
  'glm-5.2': [1.4, 4.4],
  'kimi-k2.6': [0.95, 4.0],
  'llama-3.3-70b-versatile': [0, 0],            // Groq free tier
  'gemini-flash-latest': [0.075, 0.30],
  'gpt-4o': [2.5, 10],
  'gpt-4o-mini': [0.15, 0.6],
};
function estCost(model: string, u: Usage): number {
  const [rin, rout] = RATES[model] || [0.3, 0.6];
  return (u.prompt / 1e6) * rin + (u.completion / 1e6) * rout;
}

/** Registra el consumo de una llamada (best-effort, nunca rompe el flujo). */
async function logUsage(provider: string, model: string, tier: string | undefined, u: Usage, tenantId: string | null | undefined, ok: boolean): Promise<void> {
  try {
    await db.query(
      'INSERT INTO ai_usage_log (tenant_id, provider, model, tier, prompt_tokens, completion_tokens, total_tokens, est_cost, ok) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [tenantId || null, provider, model || null, tier || null, u.prompt, u.completion, u.total, estCost(model, u), ok ? 1 : 0],
    );
    statsCache = null; // invalida el cache de ventanas
  } catch { /* telemetría no debe afectar al usuario */ }
}

// Límites del plan Go (USD): 5h / semana / mes. Overridables por env.
const LIMITS = {
  h5: Number(process.env.AI_LIMIT_5H || 12),
  week: Number(process.env.AI_LIMIT_WEEK || 30),
  month: Number(process.env.AI_LIMIT_MONTH || 60),
};
export interface UsageStats { spend5h: number; spendWeek: number; spendMonth: number; limit5h: number; limitWeek: number; limitMonth: number }
let statsCache: { at: number; data: UsageStats } | null = null;

/** Gasto estimado (opencode_go) en ventanas móviles, cacheado 60s. */
export async function getUsageStats(): Promise<UsageStats> {
  if (statsCache && Date.now() - statsCache.at < 60_000) return statsCache.data;
  let spend5h = 0, spendWeek = 0, spendMonth = 0;
  try {
    const [rows]: any = await db.query(
      `SELECT
         COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL 5 HOUR THEN est_cost ELSE 0 END), 0) AS s5,
         COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL 7 DAY  THEN est_cost ELSE 0 END), 0) AS sw,
         COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL 30 DAY THEN est_cost ELSE 0 END), 0) AS sm
       FROM ai_usage_log WHERE provider = 'opencode_go'`,
    );
    spend5h = Number(rows?.[0]?.s5 || 0);
    spendWeek = Number(rows?.[0]?.sw || 0);
    spendMonth = Number(rows?.[0]?.sm || 0);
  } catch { /* tabla aún no migrada */ }
  const data: UsageStats = { spend5h, spendWeek, spendMonth, limit5h: LIMITS.h5, limitWeek: LIMITS.week, limitMonth: LIMITS.month };
  statsCache = { at: Date.now(), data };
  return data;
}

/**
 * Guarda de límite (IA6): si el gasto en Go se acerca al tope (≥80% en cualquier
 * ventana) degrada el tier main→small. Si ya lo superó (≥100%), evita Go y deja
 * que la cadena caiga a Groq/Gemini.
 */
async function limitGuard(req: { tier?: AiTier }): Promise<{ tier?: AiTier; avoidOpencodeGo: boolean }> {
  const s = await getUsageStats();
  const frac = Math.max(s.spend5h / s.limit5h, s.spendWeek / s.limitWeek, s.spendMonth / s.limitMonth);
  if (frac >= 1) return { tier: 'small', avoidOpencodeGo: true };
  if (frac >= 0.8 && req.tier === 'main') return { tier: 'small', avoidOpencodeGo: false };
  return { tier: req.tier, avoidOpencodeGo: false };
}

/** Orden de intento: el default primero, luego el resto que tenga clave. */
function providerChain(keys: any): AiProvider[] {
  const has: Record<AiProvider, boolean> = {
    opencode_go: !!keys.opencodeGoKey, groq: !!keys.groqKey, gemini: !!keys.geminiKey, openai: !!keys.openaiKey,
  };
  // Groq va de ÚLTIMO recurso: su free tier (12k TPM) se satura rápido. OpenCode Go
  // (plan con suscripción, alta capacidad) y los demás se prefieren antes que Groq.
  const rest: AiProvider[] = ['opencode_go', 'gemini', 'openai', 'groq'];
  const ordered = [keys.defaultProvider, ...rest.filter(p => p !== keys.defaultProvider)] as AiProvider[];
  return ordered.filter(p => has[p]);
}

/**
 * Resuelve el endpoint OpenAI-compatible de TEXTO según el proveedor default.
 * Centraliza la selección url/model/apiKey para los call sites que hacen
 * function-calling (mandan su propio body con `tools`) y por eso no pueden usar
 * `textLLM` directo. Devuelve también `provider` para ramificar (p.ej. Gemini).
 * Para `gemini` no aplica (usa su propio formato): se marca y el caller decide.
 */
export function resolveTextProvider(keys: any, tier: AiTier = 'main'): { provider: AiProvider; url: string; model: string; apiKey: string } {
  const goModel = goModelFor(keys, { tier });
  const p = keys.defaultProvider as AiProvider;
  if (p === 'opencode_go' && keys.opencodeGoKey)
    return { provider: 'opencode_go', url: GO_URL, model: goModel, apiKey: keys.opencodeGoKey };
  if (p === 'groq' && keys.groqKey)
    return { provider: 'groq', url: GROQ_URL, model: GROQ_MODEL, apiKey: keys.groqKey };
  if (p === 'gemini' && keys.geminiKey)
    return { provider: 'gemini', url: '', model: GEMINI_MODEL, apiKey: keys.geminiKey };
  if (p === 'openai' && keys.openaiKey)
    return { provider: 'openai', url: keys.openaiBaseUrl + '/chat/completions', model: keys.openaiModel, apiKey: keys.openaiKey };
  // El default no tiene key: cae al primero OpenAI-compatible disponible.
  if (keys.opencodeGoKey) return { provider: 'opencode_go', url: GO_URL, model: goModel, apiKey: keys.opencodeGoKey };
  if (keys.groqKey) return { provider: 'groq', url: GROQ_URL, model: GROQ_MODEL, apiKey: keys.groqKey };
  if (keys.openaiKey) return { provider: 'openai', url: keys.openaiBaseUrl + '/chat/completions', model: keys.openaiModel, apiKey: keys.openaiKey };
  if (keys.geminiKey) return { provider: 'gemini', url: '', model: GEMINI_MODEL, apiKey: keys.geminiKey };
  throw new Error('NO_AI_KEY');
}

/** Genera texto con respaldo automático entre proveedores + telemetría + guardas (IA6). */
export async function textLLM(req: TextLLMRequest): Promise<string> {
  const keys = await getAIKeys();
  // Guarda de límite: ajusta tier y evita Go si se topó el plan.
  const guard = await limitGuard(req);
  const effReq: TextLLMRequest = { ...req, tier: guard.tier };
  let chain = providerChain(keys);
  if (guard.avoidOpencodeGo && chain.some(p => p !== 'opencode_go')) chain = chain.filter(p => p !== 'opencode_go');
  if (chain.length === 0) throw new Error('NO_AI_KEY');

  let lastErr: any;
  for (const p of chain) {
    const model = p === 'opencode_go' ? goModelFor(keys, effReq)
      : p === 'groq' ? GROQ_MODEL
      : p === 'gemini' ? GEMINI_MODEL
      : (effReq.model || keys.openaiModel);
    try {
      let res: LLMResult;
      if (p === 'opencode_go') res = await openaiCompat(GO_URL, keys.opencodeGoKey, model, effReq);
      else if (p === 'groq') res = await groq(keys.groqKey, effReq);
      else if (p === 'gemini') res = await gemini(keys.geminiKey, effReq);
      else res = await openaiCompat(keys.openaiBaseUrl + '/chat/completions', keys.openaiKey, model, effReq);
      void logUsage(p, model, effReq.tier, res.usage, req.tenantId, true);
      return res.text;
    } catch (e) {
      lastErr = e;
      void logUsage(p, model, effReq.tier, ZERO_USAGE, req.tenantId, false);
      // siguiente proveedor de la cadena
    }
  }
  throw lastErr || new Error('AI_UNAVAILABLE');
}

/** Helper conveniente: arma messages desde (mensaje + historial) y responde texto. */
export async function textReply(
  system: string,
  message: string,
  history: { role: string; content: string }[] = [],
  opts: { maxTokens?: number; temperature?: number; historyLimit?: number; model?: string; tier?: AiTier } = {},
): Promise<string> {
  const lim = opts.historyLimit ?? 8;
  const messages = [...history.slice(-lim).map(norm), { role: 'user', content: message }];
  return textLLM({ system, messages, maxTokens: opts.maxTokens, temperature: opts.temperature, model: opts.model, tier: opts.tier });
}

// ─────────────────────────────────────────────────────────────────────────────
// VISIÓN (IA2): imagen → TEXTO. La visión es cara; se hace UNA vez y se cachea.
// Los modelos de OpenCode Go no ven imágenes; la visión usa Gemini/OpenAI/Groq.
// ─────────────────────────────────────────────────────────────────────────────
const VISION_PROMPT =
  'Describe esta imagen en texto claro y detallado en español. Si contiene texto, transcríbelo completo y literal. ' +
  'Si es una foto de progreso físico, comida, producto o documento, describe lo relevante. Responde SOLO con la descripción, sin preámbulos.';

export interface ImageInput { url?: string; base64?: string; mimeType?: string }

async function toBase64(img: ImageInput): Promise<{ base64: string; mimeType: string }> {
  if (img.base64) return { base64: img.base64, mimeType: img.mimeType || 'image/jpeg' };
  if (!img.url) throw new Error('VISION_NO_IMAGE');
  const r = await fetch(img.url);
  if (!r.ok) throw new Error(`VISION_FETCH ${r.status}`);
  const mimeType = img.mimeType || r.headers.get('content-type') || 'image/jpeg';
  const buf = Buffer.from(await r.arrayBuffer());
  return { base64: buf.toString('base64'), mimeType };
}

async function visionGemini(apiKey: string, base64: string, mimeType: string, prompt: string, model = GEMINI_MODEL): Promise<LLMResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const r = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64 } }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 1024 } }),
  });
  if (!r.ok) throw new Error(`gemini-vision ${r.status}: ${await r.text()}`);
  const d = await r.json() as any;
  const m = d.usageMetadata || {};
  return {
    text: d.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text || '',
    usage: { prompt: m.promptTokenCount || 0, completion: m.candidatesTokenCount || 0, total: m.totalTokenCount || 0 },
  };
}
async function visionOpenAICompat(url: string, apiKey: string, model: string, base64: string, mimeType: string, prompt: string): Promise<LLMResult> {
  const r = await fetch(url, {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } }] }], max_tokens: 1024, temperature: 0.2 }),
  });
  if (!r.ok) throw new Error(`vision ${r.status}: ${await r.text()}`);
  const d = await r.json() as any;
  const u = d.usage || {};
  return {
    text: d.choices?.[0]?.message?.content || '',
    usage: { prompt: u.prompt_tokens || 0, completion: u.completion_tokens || 0, total: u.total_tokens || 0 },
  };
}

/** Convierte una imagen a texto (con cache por hash). Defensivo: devuelve '' si falla. */
export async function visionToText(img: ImageInput, prompt = VISION_PROMPT): Promise<string> {
  try {
    const { base64, mimeType } = await toBase64(img);
    const hash = createHash('sha256').update(base64).update(prompt).digest('hex');
    try {
      const [rows]: any = await db.query('SELECT text FROM ai_vision_cache WHERE hash = ? LIMIT 1', [hash]);
      if (rows?.[0]?.text) return rows[0].text;
    } catch { /* tabla aún no migrada */ }

    const keys = await getAIKeys();
    // Proveedor de visión: el configurado primero (nunca Go), luego cae al que tenga key.
    const order: ('gemini' | 'openai' | 'groq')[] = [
      keys.visionProvider,
      ...(['gemini', 'openai', 'groq'] as const).filter(p => p !== keys.visionProvider),
    ];
    const hasVisionKey = { gemini: !!keys.geminiKey, openai: !!keys.openaiKey, groq: !!keys.groqKey };
    const provider = order.find(p => hasVisionKey[p]);
    if (!provider) return '';

    // El modelo configurado solo aplica al proveedor elegido; un fallback usa su default.
    const cfgModel = provider === keys.visionProvider ? keys.visionModel : '';
    let res: LLMResult; let usedModel: string;
    if (provider === 'gemini') { usedModel = cfgModel || GEMINI_MODEL; res = await visionGemini(keys.geminiKey, base64, mimeType, prompt, usedModel); }
    else if (provider === 'openai') { usedModel = cfgModel || 'gpt-4o'; res = await visionOpenAICompat('https://api.openai.com/v1/chat/completions', keys.openaiKey, usedModel, base64, mimeType, prompt); }
    else { usedModel = cfgModel || process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct'; res = await visionOpenAICompat('https://api.groq.com/openai/v1/chat/completions', keys.groqKey, usedModel, base64, mimeType, prompt); }
    const text = res.text;
    void logUsage(provider, usedModel, 'vision', res.usage, null, !!text);

    if (text) { try { await db.query('INSERT INTO ai_vision_cache (hash, text, provider) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE text = VALUES(text)', [hash, text, provider]); } catch { /* sin cache */ } }
    return text;
  } catch { return ''; }
}

export interface RunRequest {
  system: string;
  message: string;
  history?: { role: string; content: string }[];
  images?: ImageInput[];
  maxTokens?: number;
  temperature?: number;
  historyLimit?: number;
  model?: string;
  tier?: AiTier;
}

/**
 * Orquesta una petición con (texto + imágenes): primero pasa cada imagen a TEXTO
 * (visión, cacheado) y luego razona TODO con el modelo de texto barato (Go).
 * Este es el pipeline que optimiza el consumo.
 */
export async function run(req: RunRequest): Promise<string> {
  let augmented = req.message;
  if (req.images && req.images.length) {
    const transcriptions: string[] = [];
    for (let i = 0; i < req.images.length; i++) {
      const t = await visionToText(req.images[i]);
      if (t) transcriptions.push(`[Imagen ${i + 1}: ${t}]`);
    }
    if (transcriptions.length) augmented = `${req.message}\n\n${transcriptions.join('\n')}`;
  }
  return textReply(req.system, augmented, req.history || [], {
    maxTokens: req.maxTokens, temperature: req.temperature, historyLimit: req.historyLimit, model: req.model, tier: req.tier,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// AGENTE CON HERRAMIENTAS (IA7): function-calling PROVIDER-AGNÓSTICO.
// Un solo loop que funciona con OpenCode Go / OpenAI / Groq (formato OpenAI
// `tools`) y con Gemini (`functionDeclarations`). El call site define sus tools
// en JSON-schema (tipos en minúscula: object/string/number/integer/array/boolean)
// y un `execute(name, args)` que ejecuta la acción real y devuelve texto.
// Así cualquier agente (AI Coach, etc.) corre con la IA que el admin configure.
// ─────────────────────────────────────────────────────────────────────────────
export interface ToolDef { name: string; description: string; parameters: any }
export type ToolExecutor = (name: string, args: any) => Promise<string>;
export interface AgentRequest {
  system: string;
  messages: { role: string; content: string }[];
  tools: ToolDef[];
  execute: ToolExecutor;
  maxRounds?: number;     // def. 6
  maxTokens?: number;     // def. 700
  temperature?: number;   // def. 0.6
  tier?: AiTier;
  tenantId?: string | null;
}
export interface AgentResult { reply: string; rounds: number; usedProvider: AiProvider | null }

// Gemini exige tipos de schema en MAYÚSCULA (OBJECT/STRING/...).
function geminiSchema(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema;
  if (Array.isArray(schema)) return schema.map(geminiSchema);
  const out: any = {};
  for (const [k, v] of Object.entries(schema)) {
    if (k === 'type' && typeof v === 'string') out[k] = v.toUpperCase();
    else out[k] = geminiSchema(v);
  }
  return out;
}

const addUsage = (a: Usage, b: Usage): Usage => ({ prompt: a.prompt + b.prompt, completion: a.completion + b.completion, total: a.total + b.total });

// Loop OpenAI-compatible (OpenCode Go / OpenAI / Groq).
async function agentOpenAICompat(url: string, apiKey: string, model: string, req: AgentRequest, flag: { executed: boolean }): Promise<LLMResult & { rounds: number }> {
  const tools = req.tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
  const messages: any[] = [{ role: 'system', content: req.system }, ...req.messages.map(norm)];
  let usage = { ...ZERO_USAGE };
  const maxRounds = req.maxRounds ?? 6;
  let rounds = 0;
  for (let i = 0; i < maxRounds; i++) {
    rounds++;
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, tools, tool_choice: 'auto', max_tokens: req.maxTokens ?? 700, temperature: req.temperature ?? 0.6 }),
    });
    if (!r.ok) throw new Error(`${url} ${r.status}: ${await r.text()}`);
    const d = await r.json() as any;
    const u = d.usage || {};
    usage = addUsage(usage, { prompt: u.prompt_tokens || 0, completion: u.completion_tokens || 0, total: u.total_tokens || 0 });
    const msg = d.choices?.[0]?.message;
    const calls = msg?.tool_calls;
    if (!calls || calls.length === 0) return { text: msg?.content || '', usage, rounds };
    messages.push({ role: 'assistant', content: msg.content ?? null, tool_calls: calls });
    for (const c of calls) {
      let args: any = {}; try { args = JSON.parse(c.function?.arguments || '{}'); } catch { /* sin args */ }
      flag.executed = true;
      const result = await req.execute(c.function?.name, args);
      messages.push({ role: 'tool', tool_call_id: c.id, content: result });
    }
  }
  // Se agotaron las rondas con tools: cierre forzado pidiendo texto final (sin tools).
  const rf = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, max_tokens: req.maxTokens ?? 700, temperature: req.temperature ?? 0.6 }),
  });
  if (!rf.ok) return { text: '', usage, rounds };
  const df = await rf.json() as any;
  return { text: df.choices?.[0]?.message?.content || '', usage, rounds };
}

// Loop Gemini (functionDeclarations).
async function agentGemini(apiKey: string, model: string, req: AgentRequest, flag: { executed: boolean }): Promise<LLMResult & { rounds: number }> {
  const decls = req.tools.map(t => ({ name: t.name, description: t.description, parameters: geminiSchema(t.parameters) }));
  const contents: any[] = req.messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  let usage = { ...ZERO_USAGE };
  const maxRounds = req.maxRounds ?? 6;
  let rounds = 0;
  const base = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  for (let i = 0; i < maxRounds; i++) {
    rounds++;
    const body: any = {
      system_instruction: { parts: [{ text: req.system }] },
      contents,
      tools: [{ function_declarations: decls }],
      tool_config: { function_calling_config: { mode: 'AUTO' } },
      generationConfig: { maxOutputTokens: req.maxTokens ?? 700, temperature: req.temperature ?? 0.6 },
    };
    const r = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`gemini ${r.status}: ${await r.text()}`);
    const d = await r.json() as any;
    const m = d.usageMetadata || {};
    usage = addUsage(usage, { prompt: m.promptTokenCount || 0, completion: m.candidatesTokenCount || 0, total: m.totalTokenCount || 0 });
    const parts = d.candidates?.[0]?.content?.parts || [];
    const fc = parts.find((p: any) => p.functionCall)?.functionCall;
    if (!fc) return { text: parts.find((p: any) => p.text)?.text || '', usage, rounds };
    contents.push({ role: 'model', parts: [{ functionCall: fc }] });
    flag.executed = true;
    const result = await req.execute(fc.name, fc.args || {});
    contents.push({ role: 'user', parts: [{ functionResponse: { name: fc.name, response: { content: result } } }] });
  }
  // Cierre forzado: una llamada final sin tools para obtener texto.
  const rf = await fetch(base, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system_instruction: { parts: [{ text: req.system }] }, contents, generationConfig: { maxOutputTokens: req.maxTokens ?? 700, temperature: req.temperature ?? 0.6 } }),
  });
  if (!rf.ok) return { text: '', usage, rounds };
  const df = await rf.json() as any;
  return { text: df.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text || '', usage, rounds };
}

/**
 * Ejecuta un agente con herramientas usando el proveedor configurado, con respaldo
 * automático, telemetría, tiering y guardas de límite. Si un proveedor falla ANTES
 * de ejecutar cualquier herramienta, cae al siguiente; una vez que se ejecutó una
 * herramienta (efecto en BD) NO cambia de proveedor para evitar doble ejecución.
 */
export async function agentLoop(req: AgentRequest): Promise<AgentResult> {
  const keys = await getAIKeys();
  const guard = await limitGuard({ tier: req.tier });
  const tier = guard.tier;
  let chain = providerChain(keys);
  if (guard.avoidOpencodeGo && chain.some(p => p !== 'opencode_go')) chain = chain.filter(p => p !== 'opencode_go');
  if (chain.length === 0) throw new Error('NO_AI_KEY');

  const flag = { executed: false };
  let lastErr: any;
  for (const p of chain) {
    const model = p === 'opencode_go' ? goModelFor(keys, { tier })
      : p === 'groq' ? GROQ_MODEL
      : p === 'gemini' ? GEMINI_MODEL
      : keys.openaiModel;
    try {
      let res: LLMResult & { rounds: number };
      const r2 = { ...req, tier };
      if (p === 'gemini') res = await agentGemini(keys.geminiKey, model, r2, flag);
      else if (p === 'opencode_go') res = await agentOpenAICompat(GO_URL, keys.opencodeGoKey, model, r2, flag);
      else if (p === 'groq') res = await agentOpenAICompat(GROQ_URL, keys.groqKey, model, r2, flag);
      else res = await agentOpenAICompat(keys.openaiBaseUrl + '/chat/completions', keys.openaiKey, model, r2, flag);
      void logUsage(p, model, tier ? `agent-${tier}` : 'agent', res.usage, req.tenantId, true);
      return { reply: res.text, rounds: res.rounds, usedProvider: p };
    } catch (e) {
      lastErr = e;
      // Diagnóstico: registra POR QUÉ falló cada proveedor (clave para ver si Go
      // rechaza el function-calling y por eso cae a Groq). Truncado para no inundar.
      console.warn(`[ai] agente: proveedor "${p}" (${model}) falló → ${String((e as any)?.message || e).slice(0, 220)}`);
      void logUsage(p, model, 'agent', ZERO_USAGE, req.tenantId, false);
      if (flag.executed) break; // ya hubo efectos: no reintentar en otro proveedor
    }
  }
  throw lastErr || new Error('AI_UNAVAILABLE');
}
