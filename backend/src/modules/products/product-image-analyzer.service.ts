import { db } from '../../config';
import { RowDataPacket } from 'mysql2';
import { AppError } from '../../common/middleware';
import { getAIKey } from '../agent/agent.service';

/**
 * ============================================================================
 *  Analizador de Productos por Imagen con IA (visión)
 * ============================================================================
 *  Toma la foto de un catálogo/publicación de producto (p. ej. una imagen de
 *  WhatsApp o Instagram con nombre, colores disponibles con su stock y precios
 *  detal/mayorista) y la envía al modelo de IA configurado en `platform_settings`
 *  (Gemini Vision, Groq Llama-4 o OpenAI GPT-4o). Devuelve los datos
 *  estructurados para autocompletar el formulario de creación de producto:
 *  nombre, descripción, categoría, tipo, variantes por color con stock y los
 *  precios escalonados (detal / mayorista) como price-tiers.
 *
 *  Espejo de `purchases/invoice-ocr.service.ts` — misma estrategia multi-proveedor.
 * ============================================================================
 */

const GEMINI_MODEL =
  process.env.GEMINI_VISION_MODEL || process.env.GEMINI_MODEL || 'gemini-flash-latest';

const GROQ_VISION_MODEL =
  process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';

const ANALYZE_PROMPT = `Eres un asistente experto en digitalizar publicaciones/catálogos de productos para comercios (Colombia).
Analiza la imagen del producto y responde EXCLUSIVAMENTE con un JSON válido, sin texto adicional ni markdown, con esta forma exacta:
{
  "name": string,
  "description": string|null,
  "category": string|null,
  "productType": "general"|"alimentos"|"bebidas"|"ropa"|"electronica"|"farmacia"|"ferreteria"|"libreria"|"juguetes"|"cosmetica"|"perfumes"|"deportes"|"hogar"|"mascotas"|"otros",
  "variants": [ { "color": string, "colorHex": string|null, "stock": number } ],
  "priceTiers": [ { "minQty": number, "price": number, "label": string|null } ],
  "totalStock": number|null
}
Reglas:
- "name" es el título del producto tal como aparece (ej: "ENTERIZO LARGO EN T PREMIUM").
- "productType": clasifica el producto. Si es prenda de vestir usa "ropa".
- "variants": una entrada por cada color/variante listada, con su cantidad disponible en "stock" (número entero). Si no hay colores, devuelve [].
- "colorHex": color aproximado en hex (#rrggbb) SOLO si es evidente por el nombre del color; si no, null.
- "priceTiers": los niveles de precio por cantidad. Ej: "Detal desde 1 unidad $132.000" → { "minQty": 1, "price": 132000, "label": "Detal" }; "Mayorista desde 6 uds $88.000" → { "minQty": 6, "price": 88000, "label": "Mayorista" }.
- Precios: usa punto decimal, sin separadores de miles ni símbolos de moneda (ej: 132000). "$132.000" en Colombia = 132000.
- Si un dato no aparece, usa null (o [] para listas). No inventes valores que no estén en la imagen.`;

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface RawAnalyzedVariant {
  color: string;
  colorHex: string | null;
  stock: number;
}

export interface RawAnalyzedTier {
  minQty: number;
  price: number;
  label: string | null;
}

export interface RawAnalyzedProduct {
  name: string;
  description: string | null;
  category: string | null;
  productType: string | null;
  variants: RawAnalyzedVariant[];
  priceTiers: RawAnalyzedTier[];
  totalStock: number | null;
}

export interface AnalyzedProductResult extends RawAnalyzedProduct {
  /** id de la categoría del tenant si coincide con la sugerida, o null */
  matchedCategoryId: string | null;
  provider: 'gemini' | 'openai' | 'groq';
}

const VALID_TYPES = [
  'general', 'alimentos', 'bebidas', 'ropa', 'electronica', 'farmacia',
  'ferreteria', 'libreria', 'juguetes', 'cosmetica', 'perfumes', 'deportes',
  'hogar', 'mascotas', 'otros',
];

// ─── Llamadas a IA con visión ───────────────────────────────────────────────────
async function callGeminiVision(apiKey: string, base64: string, mimeType: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: ANALYZE_PROMPT },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      },
    }),
  });
  if (!response.ok) {
    const txt = await response.text();
    if (response.status === 429) throw new AppError('La IA está recibiendo muchas solicitudes. Intenta de nuevo en unos segundos.', 429);
    throw new AppError(`Error de Gemini Vision: ${txt.slice(0, 300)}`, 502);
  }
  const data = (await response.json()) as any;
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callOpenAIVision(apiKey: string, base64: string, mimeType: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: ANALYZE_PROMPT },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 2048,
      temperature: 0.1,
    }),
  });
  if (!response.ok) {
    const txt = await response.text();
    if (response.status === 429) throw new AppError('La IA está recibiendo muchas solicitudes. Intenta de nuevo en unos segundos.', 429);
    throw new AppError(`Error de OpenAI Vision: ${txt.slice(0, 300)}`, 502);
  }
  const data = (await response.json()) as any;
  return data.choices?.[0]?.message?.content || '';
}

async function callGroqVision(apiKey: string, base64: string, mimeType: string): Promise<string> {
  // API compatible con OpenAI. Llama 4 Scout admite imágenes vía image_url.
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: GROQ_VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: ANALYZE_PROMPT },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
          ],
        },
      ],
      max_completion_tokens: 2048,
      temperature: 0.1,
      top_p: 1,
      stream: false,
    }),
  });
  if (!response.ok) {
    const txt = await response.text();
    if (response.status === 429) throw new AppError('La IA está recibiendo muchas solicitudes. Intenta de nuevo en unos segundos.', 429);
    throw new AppError(`Error de Groq Vision: ${txt.slice(0, 300)}`, 502);
  }
  const data = (await response.json()) as any;
  return data.choices?.[0]?.message?.content || '';
}

// ─── Parseo robusto del JSON devuelto ──────────────────────────────────────────
function num(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseProductJson(raw: string): RawAnalyzedProduct {
  let text = (raw || '').trim();
  text = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) text = text.slice(start, end + 1);

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AppError('No se pudo interpretar la imagen del producto. Intenta con una foto más nítida y bien iluminada.', 422);
  }

  const name = String(parsed.name || '').trim();
  if (!name) {
    throw new AppError('No se detectó el nombre del producto en la imagen. Intenta con una foto más clara.', 422);
  }

  const hex = (v: any): string | null => {
    const s = String(v || '').trim();
    return /^#?[0-9a-fA-F]{6}$/.test(s) ? (s.startsWith('#') ? s : `#${s}`) : null;
  };

  const variants: RawAnalyzedVariant[] = Array.isArray(parsed.variants)
    ? parsed.variants
        .map((v: any) => ({
          color: String(v.color || v.name || '').trim(),
          colorHex: hex(v.colorHex ?? v.hex),
          stock: Math.max(0, Math.round(num(v.stock) ?? 0)),
        }))
        .filter((v: RawAnalyzedVariant) => v.color)
    : [];

  const priceTiers: RawAnalyzedTier[] = Array.isArray(parsed.priceTiers)
    ? parsed.priceTiers
        .map((t: any) => ({
          minQty: Math.max(1, Math.round(num(t.minQty ?? t.min_qty) ?? 1)),
          price: num(t.price) ?? 0,
          label: t.label ? String(t.label).trim() : null,
        }))
        .filter((t: RawAnalyzedTier) => t.price > 0)
        // dedupe por minQty (nos quedamos con el primero) y orden ascendente
        .filter((t: RawAnalyzedTier, i: number, arr: RawAnalyzedTier[]) =>
          arr.findIndex((x) => x.minQty === t.minQty) === i)
        .sort((a: RawAnalyzedTier, b: RawAnalyzedTier) => a.minQty - b.minQty)
    : [];

  const rawType = String(parsed.productType || '').toLowerCase().trim();
  const productType = VALID_TYPES.includes(rawType) ? rawType : null;

  return {
    name,
    description: parsed.description ? String(parsed.description).trim() : null,
    category: parsed.category ? String(parsed.category).trim() : null,
    productType,
    variants,
    priceTiers,
    totalStock: num(parsed.totalStock),
  };
}

function normalize(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Servicio principal ──────────────────────────────────────────────────────────
export class ProductImageAnalyzerService {
  async analyze(tenantId: string, base64: string, mimeType: string): Promise<AnalyzedProductResult> {
    const apiKey = (await getAIKey())?.trim();
    if (!apiKey) {
      throw new AppError('La IA no está configurada. Agrega una clave de Gemini, Groq u OpenAI en Integraciones.', 400);
    }

    let provider: 'gemini' | 'openai' | 'groq';
    let rawText: string;
    if (apiKey.startsWith('AIza')) {
      provider = 'gemini';
      rawText = await callGeminiVision(apiKey, base64, mimeType);
    } else if (apiKey.startsWith('gsk_')) {
      provider = 'groq';
      rawText = await callGroqVision(apiKey, base64, mimeType);
    } else if (apiKey.startsWith('sk-')) {
      provider = 'openai';
      rawText = await callOpenAIVision(apiKey, base64, mimeType);
    } else {
      throw new AppError(
        'La IA configurada no admite lectura de imágenes. Configura una clave de Gemini (AIza…), Groq (gsk_…) u OpenAI (sk-…).',
        400
      );
    }

    const raw = parseProductJson(rawText);

    // ── Cruzar categoría sugerida con las del tenant (solo match, no crea) ──
    let matchedCategoryId: string | null = null;
    if (raw.category) {
      const [catRows] = await db.execute<RowDataPacket[]>(
        'SELECT id, name FROM categories WHERE tenant_id = ?',
        [tenantId]
      );
      const target = normalize(raw.category);
      for (const c of catRows) {
        const cName = normalize(String(c.name || ''));
        if (cName && (cName === target || cName.includes(target) || target.includes(cName))) {
          matchedCategoryId = String(c.id);
          break;
        }
      }
    }

    return {
      ...raw,
      matchedCategoryId,
      provider,
    };
  }
}

export const productImageAnalyzerService = new ProductImageAnalyzerService();
