/**
 * Utilidades para aplicar la paleta generada por IA como variables CSS.
 * - Tienda (storefront): tema inmersivo (fondos, superficies, botones, texto).
 * - Panel admin: solo acento (sobrescribe --primary/--ring de shadcn) para no
 *   cansar la vista; el resto del panel queda neutro.
 */

export interface ThemePaletteColors {
  primary: string
  primary_hover: string
  secondary: string
  background_store: string
  surface_store: string
  text_main: string
  admin_accent: string
}

export interface ThemePalette {
  theme_type: 'light' | 'dark'
  colors: ThemePaletteColors
}

function hexToRgb(hex: string): [number, number, number] {
  let h = (hex || '').trim().replace(/^#/, '')
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return [0, 0, 0]
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

/** Devuelve "H S% L%" (formato que usa shadcn en sus variables). */
export function hexToHslString(hex: string): string {
  let [r, g, b] = hexToRgb(hex)
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0; const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h /= 6
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

/** Genera el CSS (string) con las variables del tema de la tienda. */
export function buildStoreThemeCss(palette: ThemePalette): string {
  const c = palette.colors
  return `
    --color-primary:${c.primary};
    --color-primary-hover:${c.primary_hover};
    --color-secondary:${c.secondary};
    --color-bg-store:${c.background_store};
    --color-surface:${c.surface_store};
    --color-text:${c.text_main};
    --color-admin-accent:${c.admin_accent};
  `.replace(/\s+/g, '')
}

/** Aplica el acento de la marca en el panel admin (sobrescribe primary/ring). */
export function applyAdminAccent(hex: string | null | undefined) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (!hex) {
    root.style.removeProperty('--primary')
    root.style.removeProperty('--ring')
    root.style.removeProperty('--color-admin-accent')
    return
  }
  const hsl = hexToHslString(hex)
  root.style.setProperty('--primary', hsl)
  root.style.setProperty('--ring', hsl)
  root.style.setProperty('--color-admin-accent', hex)
}
