import { AppError } from '../../common/middleware';
import { getAIKey } from '../agent/agent.service';

/**
 * ============================================================================
 *  Tema automático desde el logo (colorimetría con IA + validación WCAG)
 * ============================================================================
 *  1. Preprocesa el logo (sharp → WebP 512x512) para abaratar tokens/latencia.
 *  2. Lo envía a la IA de visión configurada (Gemini / OpenAI / Groq).
 *  3. La IA devuelve una paleta JSON (tienda inmersiva + acento del panel).
 *  4. Se valida el contraste (WCAG AA ≥ 4.5:1) y se ajusta la luminosidad si
 *     hace falta antes de devolver/persistir.
 * ============================================================================
 */

const GEMINI_VISION_MODEL = process.env.GEMINI_VISION_MODEL || process.env.GEMINI_MODEL || 'gemini-flash-latest';
const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';

// sharp es opcional: si no está instalado, se usa la imagen original.
// Se carga con require dinámico para no romper el build si aún no se instaló.
function loadSharp(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const req = eval('require') as NodeRequire;
    return req('sharp');
  } catch {
    return null;
  }
}

const SYSTEM_PROMPT = `Eres un experto en UI/UX y teoría del color. Analiza el logo proporcionado.
Tu tarea es extraer los colores principales y generar una paleta de interfaz de usuario (UI) accesible y estética.
Evita usar colores saturados del logo para fondos grandes; úsalos para acentos.
Devuelve ÚNICAMENTE un objeto JSON válido (sin markdown, sin texto extra) con esta estructura, usando códigos HEX:
{
  "theme_type": "light o dark (según lo que mejor resalte el logo)",
  "colors": {
    "primary": "Color principal para botones de llamada a la acción (CTA)",
    "primary_hover": "Versión ligeramente más oscura/clara del primary",
    "secondary": "Color secundario para elementos menos destacados",
    "background_store": "Color de fondo general para la página de la tienda (debe contrastar con el logo)",
    "surface_store": "Color para tarjetas o contenedores en la tienda",
    "text_main": "Color del texto principal (alto contraste con background_store)",
    "admin_accent": "Color del logo para resaltar elementos en el panel de control"
  }
}`;

export interface ThemePalette {
  theme_type: 'light' | 'dark';
  colors: {
    primary: string;
    primary_hover: string;
    secondary: string;
    background_store: string;
    surface_store: string;
    text_main: string;
    admin_accent: string;
  };
}

// ─── Color utils (WCAG) ─────────────────────────────────────────────────────────
function normalizeHex(hex: string, fallback = '#000000'): string {
  if (!hex) return fallback;
  let h = hex.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(h)) h = h.split('').map(c => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return fallback;
  return `#${h.toLowerCase()}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = normalizeHex(hex).slice(1);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function relLuminance([r, g, b]: [number, number, number]): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrastRatio(a: string, b: string): number {
  const la = relLuminance(hexToRgb(a));
  const lb = relLuminance(hexToRgb(b));
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  h /= 360; s /= 100; l /= 100;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (s === 0) { r = g = b = l; }
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1 / 3);
  }
  return rgbToHex(r * 255, g * 255, b * 255);
}

/** Ajusta la luminosidad de fg hasta cumplir el contraste mínimo contra bg. */
function ensureContrast(fg: string, bg: string, target = 4.5): string {
  if (contrastRatio(fg, bg) >= target) return normalizeHex(fg);
  const [h, s] = rgbToHsl(...hexToRgb(fg));
  const bgL = relLuminance(hexToRgb(bg));
  // Si el fondo es oscuro, aclaramos el texto; si es claro, lo oscurecemos.
  const goLighter = bgL < 0.5;
  let best = normalizeHex(fg);
  for (let l = goLighter ? 0 : 100; goLighter ? l <= 100 : l >= 0; l += goLighter ? 4 : -4) {
    const cand = hslToHex(h, s, l);
    if (contrastRatio(cand, bg) >= target) { best = cand; break; }
    best = cand;
  }
  return best;
}

// ─── Llamadas a IA de visión ──────────────────────────────────────────────────
async function visionToText(apiKey: string, base64: string, mimeType: string): Promise<{ text: string; provider: string }> {
  if (apiKey.startsWith('AIza')) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_VISION_MODEL}:generateContent?key=${apiKey}`;
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: SYSTEM_PROMPT }, { inline_data: { mime_type: mimeType, data: base64 } }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024, responseMimeType: 'application/json' },
      }),
    });
    if (!r.ok) throw new AppError(`Error de Gemini Vision: ${(await r.text()).slice(0, 200)}`, 502);
    const d = await r.json() as any;
    return { text: d.candidates?.[0]?.content?.parts?.[0]?.text || '', provider: 'gemini' };
  }
  if (apiKey.startsWith('gsk_') || apiKey.startsWith('sk-')) {
    const isGroq = apiKey.startsWith('gsk_');
    const url = isGroq ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
    const body: any = {
      model: isGroq ? GROQ_VISION_MODEL : 'gpt-4o',
      messages: [{ role: 'user', content: [{ type: 'text', text: SYSTEM_PROMPT }, { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } }] }],
      temperature: 0.2,
      max_tokens: 1024,
    };
    if (!isGroq) body.response_format = { type: 'json_object' };
    const r = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new AppError(`Error de ${isGroq ? 'Groq' : 'OpenAI'} Vision: ${(await r.text()).slice(0, 200)}`, 502);
    const d = await r.json() as any;
    return { text: d.choices?.[0]?.message?.content || '', provider: isGroq ? 'groq' : 'openai' };
  }
  throw new AppError('La IA configurada no admite lectura de imágenes. Configura una clave de Gemini (AIza…), Groq (gsk_…) u OpenAI (sk-…).', 400);
}

function parsePalette(raw: string): ThemePalette {
  let text = (raw || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const a = text.indexOf('{'); const b = text.lastIndexOf('}');
  if (a >= 0 && b > a) text = text.slice(a, b + 1);
  let p: any;
  try { p = JSON.parse(text); } catch { throw new AppError('No se pudo interpretar la paleta. Intenta con otro logo.', 422); }
  const c = p.colors || {};
  return {
    theme_type: p.theme_type === 'dark' ? 'dark' : 'light',
    colors: {
      primary: normalizeHex(c.primary, '#00833E'),
      primary_hover: normalizeHex(c.primary_hover, '#005C2A'),
      secondary: normalizeHex(c.secondary, '#666666'),
      background_store: normalizeHex(c.background_store, p.theme_type === 'dark' ? '#0e0e0e' : '#ffffff'),
      surface_store: normalizeHex(c.surface_store, p.theme_type === 'dark' ? '#1a1a1a' : '#f5f5f5'),
      text_main: normalizeHex(c.text_main, p.theme_type === 'dark' ? '#ffffff' : '#111111'),
      admin_accent: normalizeHex(c.admin_accent, '#00833E'),
    },
  };
}

/** Aplica reglas de accesibilidad: ajusta texto/superficie contra el fondo. */
function applyAccessibility(palette: ThemePalette): ThemePalette {
  const { colors } = palette;
  colors.text_main = ensureContrast(colors.text_main, colors.background_store, 4.5);
  // Superficie debe diferenciarse del fondo (contraste sutil ≥ 1.08)
  if (contrastRatio(colors.surface_store, colors.background_store) < 1.08) {
    const [h, s, l] = rgbToHsl(...hexToRgb(colors.surface_store));
    const bgL = relLuminance(hexToRgb(colors.background_store));
    colors.surface_store = hslToHex(h, s, bgL < 0.5 ? Math.min(l + 6, 100) : Math.max(l - 4, 0));
  }
  return palette;
}

export class ThemePaletteService {
  /** Redimensiona/optimiza el logo a 512x512 WebP (si sharp está disponible). */
  private async preprocess(base64: string, mimeType: string): Promise<{ base64: string; mimeType: string }> {
    const sharp = loadSharp();
    if (!sharp) return { base64, mimeType };
    try {
      const input = Buffer.from(base64, 'base64');
      const out = await sharp(input)
        .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
        .flatten({ background: '#ffffff' })
        .webp({ quality: 80 })
        .toBuffer();
      return { base64: out.toString('base64'), mimeType: 'image/webp' };
    } catch {
      return { base64, mimeType };
    }
  }

  async generateFromImage(base64: string, mimeType: string): Promise<{ palette: ThemePalette; provider: string }> {
    const apiKey = (await getAIKey())?.trim();
    if (!apiKey) throw new AppError('La IA no está configurada. Agrega una clave en Integraciones.', 400);
    const pre = await this.preprocess(base64, mimeType);
    const { text, provider } = await visionToText(apiKey, pre.base64, pre.mimeType);
    const palette = applyAccessibility(parsePalette(text));
    return { palette, provider };
  }
}

export const themePaletteService = new ThemePaletteService();
