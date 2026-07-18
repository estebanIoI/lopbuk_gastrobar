/**
 * Variables dinámicas de las plantillas de producto (JSON-driven).
 * La plantilla guarda estructura; el contenido llega del producto/tienda:
 *   {{product.title}} {{product.price}} {{product.stock}} {{product.brand}}
 *   {{product.category}} {{product.description}} {{store.name}} {{store.whatsapp}}
 */

export interface TemplateVarsContext {
  product?: {
    name?: string
    salePrice?: number
    offerPrice?: number | null
    isOnOffer?: boolean | number
    stock?: number
    brand?: string | null
    category?: string | null
    description?: string | null
    /** Galería del producto — la consume el Hero (slider). Datos reales, no literales. */
    images?: string[] | null
    imageUrl?: string | null
  } | null
  store?: {
    name?: string | null
    whatsapp?: string | null
  } | null
}

/** Descuento % calculado desde precios reales (0 si no está en oferta). */
export function productDiscountPct(p: TemplateVarsContext['product']): number {
  if (!p || !p.isOnOffer || p.offerPrice == null) return 0
  const base = Number(p.salePrice || 0)
  const off = Number(p.offerPrice)
  if (base <= 0 || off <= 0 || off >= base) return 0
  return Math.round(((base - off) / base) * 100)
}

/** Lista de imágenes del producto (galería, con fallback a imageUrl). */
export function productImages(p: TemplateVarsContext['product']): string[] {
  if (!p) return []
  const imgs = Array.isArray(p.images) ? p.images.filter(Boolean) : []
  if (imgs.length) return imgs
  return p.imageUrl ? [p.imageUrl] : []
}

const fmtCOP = (v: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)

export function resolveTemplateVars(text: string, ctx: TemplateVarsContext): string {
  if (!text || !text.includes('{{')) return text
  const p = ctx.product
  const s = ctx.store
  const effectivePrice = p ? (p.isOnOffer && p.offerPrice ? Number(p.offerPrice) : Number(p.salePrice || 0)) : 0

  const onOffer = !!(p && p.isOnOffer && p.offerPrice)
  const comparePrice = onOffer && p?.salePrice != null ? fmtCOP(Number(p.salePrice)) : ''
  const discount = productDiscountPct(p)

  const vars: Record<string, string> = {
    'product.title': p?.name || '',
    'product.name': p?.name || '',
    'product.price': p ? fmtCOP(effectivePrice) : '',
    // Precio tachado: solo si de verdad hay oferta (si no, vacío → no se muestra).
    'product.compare_price': comparePrice,
    'product.compareAtPrice': comparePrice,
    'product.discount': discount > 0 ? `${discount}%` : '',
    'product.stock': p?.stock != null ? String(p.stock) : '',
    'product.brand': p?.brand || '',
    'product.category': p?.category || '',
    'product.description': p?.description || '',
    'store.name': s?.name || '',
    'store.whatsapp': s?.whatsapp || '',
  }

  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) =>
    key in vars ? vars[key] : match
  )
}
