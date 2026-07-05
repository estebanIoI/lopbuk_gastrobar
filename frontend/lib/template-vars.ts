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
  } | null
  store?: {
    name?: string | null
    whatsapp?: string | null
  } | null
}

const fmtCOP = (v: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)

export function resolveTemplateVars(text: string, ctx: TemplateVarsContext): string {
  if (!text || !text.includes('{{')) return text
  const p = ctx.product
  const s = ctx.store
  const effectivePrice = p ? (p.isOnOffer && p.offerPrice ? Number(p.offerPrice) : Number(p.salePrice || 0)) : 0

  const vars: Record<string, string> = {
    'product.title': p?.name || '',
    'product.name': p?.name || '',
    'product.price': p ? fmtCOP(effectivePrice) : '',
    'product.compare_price': p?.salePrice != null ? fmtCOP(Number(p.salePrice)) : '',
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
