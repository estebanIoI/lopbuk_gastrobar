import { db } from '../../config';
import { RowDataPacket } from 'mysql2';
import { AppError } from '../../common/middleware';
import { getAIKey } from '../agent/agent.service';

/**
 * ============================================================================
 *  OCR de Facturas de Compra con IA (visión)
 * ============================================================================
 *  Toma la imagen de una factura de proveedor, la envía al modelo de IA
 *  configurado en `platform_settings` (Gemini Vision o OpenAI GPT-4o) y
 *  devuelve los datos estructurados, ya cruzados contra el inventario y los
 *  proveedores del tenant para autocompletar el formulario de compra.
 * ============================================================================
 */

const GEMINI_MODEL =
  process.env.GEMINI_VISION_MODEL || process.env.GEMINI_MODEL || 'gemini-flash-latest';

const OCR_PROMPT = `Eres un asistente experto en digitalizar facturas de compra de proveedores (Colombia).
Analiza la imagen de la factura y responde EXCLUSIVAMENTE con un JSON válido, sin texto adicional ni markdown, con esta forma exacta:
{
  "invoiceNumber": string|null,
  "supplierName": string|null,
  "supplierTaxId": string|null,
  "purchaseDate": "YYYY-MM-DD"|null,
  "paymentMethod": "efectivo"|"transferencia"|"tarjeta"|"credito_proveedor"|null,
  "subtotal": number|null,
  "discount": number|null,
  "total": number|null,
  "items": [ { "description": string, "quantity": number, "unitCost": number, "total": number } ]
}
Reglas:
- Usa punto decimal. No uses separadores de miles ni símbolos de moneda (ej: 12500.50).
- "unitCost" es el costo unitario (precio por unidad), no el total de la línea.
- "supplierTaxId" es el NIT/RUT del proveedor (solo dígitos y guion final si aplica).
- Si un dato no aparece en la factura, usa null. Si no hay productos, usa [].
- No inventes valores que no estén en la imagen.`;

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface RawInvoiceItem {
  description: string;
  quantity: number;
  unitCost: number;
  total?: number | null;
}

export interface RawInvoice {
  invoiceNumber?: string | null;
  supplierName?: string | null;
  supplierTaxId?: string | null;
  purchaseDate?: string | null;
  paymentMethod?: string | null;
  subtotal?: number | null;
  discount?: number | null;
  total?: number | null;
  items: RawInvoiceItem[];
}

export interface MatchedInvoiceItem extends RawInvoiceItem {
  productId: string | null;
  productName: string | null;
  productSku: string | null;
  lastPurchasePrice: number | null;
  matched: boolean;
}

export interface OcrInvoiceResult {
  header: {
    invoiceNumber: string | null;
    purchaseDate: string | null;
    paymentMethod: string | null;
    subtotal: number | null;
    discount: number | null;
    total: number | null;
  };
  supplier: {
    matchedId: string | null;
    name: string | null;
    taxId: string | null;
  };
  items: MatchedInvoiceItem[];
  provider: 'gemini' | 'openai';
}

// ─── Llamada a IA con visión ────────────────────────────────────────────────────
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
            { text: OCR_PROMPT },
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
            { type: 'text', text: OCR_PROMPT },
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

// ─── Parseo robusto del JSON devuelto ──────────────────────────────────────────
function parseInvoiceJson(raw: string): RawInvoice {
  let text = (raw || '').trim();
  // Quita fences de markdown si existen
  text = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  // Recorta al primer objeto JSON válido
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) text = text.slice(start, end + 1);

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AppError('No se pudo interpretar la factura. Intenta con una foto más nítida y bien iluminada.', 422);
  }

  const num = (v: any): number | null => {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : null;
  };

  const items: RawInvoiceItem[] = Array.isArray(parsed.items)
    ? parsed.items
        .map((it: any) => ({
          description: String(it.description || it.name || '').trim(),
          quantity: num(it.quantity) ?? 1,
          unitCost: num(it.unitCost ?? it.unit_cost ?? it.price) ?? 0,
          total: num(it.total),
        }))
        .filter((it: RawInvoiceItem) => it.description)
    : [];

  return {
    invoiceNumber: parsed.invoiceNumber ? String(parsed.invoiceNumber).trim() : null,
    supplierName: parsed.supplierName ? String(parsed.supplierName).trim() : null,
    supplierTaxId: parsed.supplierTaxId ? String(parsed.supplierTaxId).trim() : null,
    purchaseDate: parsed.purchaseDate ? String(parsed.purchaseDate).trim() : null,
    paymentMethod: parsed.paymentMethod ? String(parsed.paymentMethod).trim() : null,
    subtotal: num(parsed.subtotal),
    discount: num(parsed.discount),
    total: num(parsed.total),
    items,
  };
}

// ─── Normalización para matching ────────────────────────────────────────────────
function normalize(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenScore(a: string, b: string): number {
  const ta = new Set(normalize(a).split(' ').filter(t => t.length > 2));
  const tb = new Set(normalize(b).split(' ').filter(t => t.length > 2));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.min(ta.size, tb.size);
}

// ─── Servicio principal ──────────────────────────────────────────────────────────
export class InvoiceOcrService {
  async extractAndMatch(tenantId: string, base64: string, mimeType: string): Promise<OcrInvoiceResult> {
    const apiKey = (await getAIKey())?.trim();
    if (!apiKey) {
      throw new AppError('La IA no está configurada. Agrega una clave de Gemini u OpenAI en Integraciones.', 400);
    }

    let provider: 'gemini' | 'openai';
    let rawText: string;
    if (apiKey.startsWith('AIza')) {
      provider = 'gemini';
      rawText = await callGeminiVision(apiKey, base64, mimeType);
    } else if (apiKey.startsWith('sk-')) {
      provider = 'openai';
      rawText = await callOpenAIVision(apiKey, base64, mimeType);
    } else {
      throw new AppError(
        'La IA configurada no admite lectura de imágenes (OCR). Configura una clave de Gemini (AIza…) u OpenAI (sk-…).',
        400
      );
    }

    const raw = parseInvoiceJson(rawText);

    // ── Cargar inventario y proveedores del tenant para matching ──
    const [productRows] = await db.execute<RowDataPacket[]>(
      'SELECT id, name, sku, barcode, purchase_price FROM products WHERE tenant_id = ?',
      [tenantId]
    );
    const [supplierRows] = await db.execute<RowDataPacket[]>(
      'SELECT id, name, tax_id FROM suppliers WHERE tenant_id = ? AND is_active = TRUE',
      [tenantId]
    );

    // ── Matching de ítems ──
    const items: MatchedInvoiceItem[] = raw.items.map((it) => {
      let best: RowDataPacket | null = null;
      let bestScore = 0;
      const descNorm = normalize(it.description);
      for (const p of productRows) {
        // Coincidencia exacta por SKU o código de barras dentro de la descripción
        const sku = String(p.sku || '');
        const barcode = String(p.barcode || '');
        if (sku && descNorm.includes(normalize(sku))) { best = p; bestScore = 1; break; }
        if (barcode && it.description.includes(barcode)) { best = p; bestScore = 1; break; }
        const score = tokenScore(it.description, String(p.name || ''));
        if (score > bestScore) { bestScore = score; best = p; }
      }
      const matched = !!best && bestScore >= 0.5;
      return {
        ...it,
        productId: matched ? String(best!.id) : null,
        productName: matched ? String(best!.name) : null,
        productSku: matched ? String(best!.sku) : null,
        lastPurchasePrice: matched && best!.purchase_price != null ? Number(best!.purchase_price) : null,
        matched,
      };
    });

    // ── Matching de proveedor (por NIT primero, luego por nombre) ──
    let matchedSupplierId: string | null = null;
    const taxNorm = raw.supplierTaxId ? normalize(raw.supplierTaxId) : '';
    const nameNorm = raw.supplierName ? normalize(raw.supplierName) : '';
    for (const s of supplierRows) {
      const sTax = s.tax_id ? normalize(String(s.tax_id)) : '';
      if (taxNorm && sTax && sTax === taxNorm) { matchedSupplierId = String(s.id); break; }
    }
    if (!matchedSupplierId && nameNorm) {
      for (const s of supplierRows) {
        const sName = normalize(String(s.name || ''));
        if (sName && (sName === nameNorm || sName.includes(nameNorm) || nameNorm.includes(sName))) {
          matchedSupplierId = String(s.id);
          break;
        }
      }
    }

    // Normaliza método de pago a los valores aceptados por el formulario
    const allowedMethods = ['efectivo', 'transferencia', 'tarjeta', 'credito_proveedor', 'nequi', 'daviplata', 'mixto'];
    const paymentMethod = raw.paymentMethod && allowedMethods.includes(raw.paymentMethod)
      ? raw.paymentMethod
      : null;

    return {
      header: {
        invoiceNumber: raw.invoiceNumber ?? null,
        purchaseDate: raw.purchaseDate ?? null,
        paymentMethod,
        subtotal: raw.subtotal ?? null,
        discount: raw.discount ?? null,
        total: raw.total ?? null,
      },
      supplier: {
        matchedId: matchedSupplierId,
        name: raw.supplierName ?? null,
        taxId: raw.supplierTaxId ?? null,
      },
      items,
      provider,
    };
  }
}

export const invoiceOcrService = new InvoiceOcrService();
