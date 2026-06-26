// ── Colores: fuente única de verdad para "nombre de color → hex" ───────────
//
// Antes esto estaba duplicado (copiado y pegado) en horma-manager.tsx,
// inventory-list.tsx y variant-selector.tsx, cada uno con su propia lista.
// Ahora los tres importan de aquí.
//
// Sigue siendo solo un FALLBACK visual: si una horma o variante ya tiene un hex
// real guardado (horma_colors.hex / product_variants.colorHex), ESE manda — este
// mapa solo entra a tallar cuando no hay hex explícito, para que el círculo nunca
// se vea gris/vacío.

export const COLOR_HEX_FALLBACK: Record<string, string> = {
  negro: '#000000', black: '#000000',
  blanco: '#FFFFFF', white: '#FFFFFF',
  gris: '#808080', gray: '#808080', grey: '#808080',
  'gris jaspe': '#9CA3AF',
  rojo: '#DC2626', red: '#DC2626',
  'vino botella': '#5B0E16', 'v. botella': '#5B0E16',
  vino: '#7F1D1D', bordo: '#7F1D1D', bordó: '#7F1D1D',
  vainilla: '#F3E5AB',
  rosado: '#F4A7C0', rosa: '#EC4899', pink: '#EC4899',
  camel: '#C19A6B', nude: '#E3BCA0',
  lila: '#C8A2C8', morado: '#7C3AED', purple: '#7C3AED', violeta: '#7C3AED',
  pardo: '#7B5232', cafe: '#78350F', café: '#78350F', marron: '#78350F', marrón: '#78350F', brown: '#78350F',
  verde: '#15803D', green: '#16A34A',
  'v. militar': '#4B5320', 'v. cali': '#3F8F4F', 'v. pistacho': '#93C572',
  azul: '#2563EB', blue: '#2563EB',
  'azul navy': '#1F2A4D', 'azul marino': '#1E3A8A', navy: '#1E3A8A', 'azul rey': '#1E3A8A',
  'azul agua': '#7DD3E0', celeste: '#7DD3FC', turquesa: '#06B6D4',
  'azul medio': '#3B6FB6',
  amarillo: '#FACC15', yellow: '#FACC15',
  naranja: '#F97316', orange: '#F97316',
  beige: '#E7D8C0', crema: '#F5E9D6',
  dorado: '#D4AF37', gold: '#D4AF37',
  plateado: '#C0C0C0', plata: '#C0C0C0', silver: '#C0C0C0',
}

export function normalizeColorName(name: string): string {
  return name.trim().toLowerCase()
}

/** Hash determinístico nombre → hex, para colores que no están en el mapa de arriba. */
export function hashHex(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash << 5) - hash + name.charCodeAt(i) | 0
  const hue = Math.abs(hash) % 360
  // HSL → hex aproximado, fijo en saturación/luz media para que se vea como "color de tela"
  const s = 0.45, l = 0.45
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0, g = 0, b = 0
  if (hue < 60) { r = c; g = x; b = 0 }
  else if (hue < 120) { r = x; g = c; b = 0 }
  else if (hue < 180) { r = 0; g = c; b = x }
  else if (hue < 240) { r = 0; g = x; b = c }
  else if (hue < 300) { r = x; g = 0; b = c }
  else { r = c; g = 0; b = x }
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
}

/**
 * Resuelve el hex a pintar para un color: el real (si viene y es válido) → el
 * conocido del mapa → un hash estable por nombre (para que SIEMPRE haya un
 * círculo visible, nunca gris liso).
 */
export function resolveColorHex(name: string, hex?: string | null): string {
  if (hex && /^#[0-9A-Fa-f]{6}$/.test(hex)) return hex.toUpperCase()
  const n = normalizeColorName(name)
  return COLOR_HEX_FALLBACK[n] || hashHex(n)
}

/** Variante "suave" para fondos oscuros/claros del storefront (acepta también #hex crudo). */
export function colorToCss(name?: string | null): string | null {
  if (!name) return null
  const n = normalizeColorName(name)
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(n)) return n
  return COLOR_HEX_FALLBACK[n] || null
}
