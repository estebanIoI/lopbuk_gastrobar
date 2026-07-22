// Tokens de marca + utilidades puras (extraído de home-theme2.tsx).
// Sin React/JSX: colores, contraste, formato COP, WhatsApp y reduced-motion.

// ── Paleta institucional ────────────────────────────────────────────────────
// Colores de marca como variables CSS con fallback al verde DAIMUZ.
// Cuando el superadmin genera una colorimetría, se inyectan --brand-green /
// --brand-green-dark en la raíz del home y TODO se tiñe automáticamente
// (los estilos inline las resuelven en tiempo de render).
export const GREEN = 'var(--brand-green, #00833E)'
export const GREEN_DARK = 'var(--brand-green-dark, #005C2A)'
// El acento "destacado" sigue la paleta: cuando el superadmin genera/edita una
// colorimetría se inyecta --brand-gold (y su color de texto legible). Sin paleta,
// cae al dorado DAIMUZ por defecto.
export const GOLD = 'var(--brand-gold, #F0A500)'
export const GOLD_TEXT = 'var(--brand-gold-text, #111827)'

export function hexToRgb(hex?: string | null): [number, number, number] | null {
  if (!hex || typeof hex !== 'string') return null
  const m = hex.replace('#', '')
  const h = m.length === 3 ? m.split('').map(c => c + c).join('') : m
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return [r, g, b].some(Number.isNaN) ? null : [r, g, b]
}

/** Devuelve '#fff' o '#111827' según el contraste sobre un color hex. */
export function readableOn(hex?: string | null): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return '#111827'
  const L = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255
  return L > 0.6 ? '#111827' : '#ffffff'
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0; const l = (max + min) / 2
  const d = max - min
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    h *= 60
  }
  return [h, s, l]
}
export function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs((h / 60) % 2 - 1))
  const m = l - c / 2
  let r = 0, g = 0, b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const to = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase()
}

/**
 * Acento "destacado" complementario al color primario de la paleta: rota el
 * matiz ~165° (split-complementario, evita el naranja puro) y sube saturación,
 * para que las insignias resalten sobre el header sin salirse de la colorimetría.
 */
export function complementaryAccent(hex?: string | null): string | null {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2])
  // Si el color es casi gris (sin matiz), no tiene complemento útil.
  if (s < 0.08) return null
  const h2 = h + 165
  const s2 = Math.min(0.92, Math.max(0.6, s + 0.15))
  const l2 = Math.min(0.6, Math.max(0.46, l))
  return hslToHex(h2, s2, l2)
}

export const fmtCOP = (v: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v || 0)

// ── Contacto por WhatsApp ────────────────────────────────────────────────────
// Número de la plataforma configurable por entorno (NEXT_PUBLIC_WHATSAPP, solo
// dígitos con código de país, p.ej. 573001234567). Puede sobreescribirse por prop.
export const PLATFORM_WHATSAPP = (process.env.NEXT_PUBLIC_WHATSAPP || '').replace(/\D/g, '')
/** Enlace wa.me válido, o '' si no hay número configurado (evita links rotos). */
export function waLink(phone?: string | null, text = 'Hola 👋, quiero más información sobre DAIMUZ.'): string {
  const p = (phone || '').replace(/\D/g, '')
  return p ? `https://wa.me/${p}?text=${encodeURIComponent(text)}` : ''
}

/** Preferencia de "reducir movimiento" (seguro en SSR). */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}
