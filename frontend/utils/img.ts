import { ensureAbsoluteUrl } from '@/utils/url'

/**
 * Optimización de imágenes vía Cloudinary (transform en la entrega, sin re-subir).
 *
 * Inserta un transform en la URL de Cloudinary para:
 *   - redimensionar al tamaño real de render (no bajar el original full-size),
 *   - servir WebP/AVIF según el navegador (`f_auto`),
 *   - comprimir con calidad automática (`q_auto`),
 *   - ajustar por densidad de pantalla (`dpr_auto`).
 *
 * URLs que NO son de Cloudinary (data:, relativas, otros hosts) pasan sin tocar
 * —solo se normalizan a absolutas— para no romper logos/imágenes externas de tenants.
 */
export function cldImg(url?: string | null, w = 400, h?: number): string {
  const abs = ensureAbsoluteUrl(url || '')
  if (!abs) return ''
  // Solo transformamos URLs de Cloudinary con el segmento /upload/
  if (!abs.includes('res.cloudinary.com') || !abs.includes('/upload/')) return abs
  // GIFs animados: NO redimensionar/convertir. Cloudinary devuelve 400 al transformar
  // GIFs grandes (límite de píxeles × frames) y el f_auto puede romper la animación.
  // Se entregan tal cual (ya vienen "optimizados" como animación).
  if (/\.gif($|\?)/i.test(abs)) return abs
  // Evita duplicar transform si la URL ya trae uno (…/upload/w_…/…)
  if (/\/upload\/[a-z]+_/.test(abs)) return abs
  const t = `w_${w},${h ? `h_${h},c_fill,` : ''}q_auto,f_auto,dpr_auto`
  return abs.replace('/upload/', `/upload/${t}/`)
}

/**
 * `srcset` responsive para imágenes de catálogo: el navegador elige el ancho según
 * el viewport/densidad. Combínalo con un atributo `sizes` en el <img>.
 */
export function cldSrcSet(url?: string | null, widths: number[] = [200, 400, 800]): string {
  const abs = ensureAbsoluteUrl(url || '')
  if (!abs || !abs.includes('res.cloudinary.com') || !abs.includes('/upload/')) return ''
  if (/\/upload\/[a-z]+_/.test(abs)) return ''
  return widths.map((w) => `${cldImg(url, w)} ${w}w`).join(', ')
}
