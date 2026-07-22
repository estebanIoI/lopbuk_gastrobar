// Tipos y catálogos compartidos del marketplace (extraído de home-theme2.tsx).
// ── Tipos compartidos ─────────────────────────────────────────────────────────
export interface HeroSlide {
  id: string
  type: 'image' | 'video'
  url: string
  /** Media alterna para pantallas móviles (imagen/GIF/video). Si está vacía, se usa `url`. */
  mobileUrl?: string
  link?: string
  title?: string
  subtitle?: string
}

export interface RubroCategory {
  type: string
  count: number
}

// ── Tarjetas configurables del carrusel "Para ti" ──────────────────────────────
export interface PromoCardConfig {
  key: string   // identifica el tipo de tarjeta (ver PROMO_CARD_CATALOG)
  label: string // título visible
}

// Catálogo de tarjetas disponibles para el superadmin
export const PROMO_CARD_CATALOG: { key: string; label: string; kind: 'product' | 'accion'; desc: string }[] = [
  { key: 'novedades',   label: 'Novedades',   kind: 'product', desc: 'Producto reciente del marketplace' },
  { key: 'ofertas',     label: 'En oferta',   kind: 'product', desc: 'Producto con descuento activo' },
  { key: 'recomendado', label: 'Recomendado', kind: 'product', desc: 'Producto destacado por la plataforma' },
  { key: 'tendencia',   label: 'Tendencia',   kind: 'product', desc: 'Producto popular' },
  { key: 'accion_comercios',  label: 'Comercios',  kind: 'accion', desc: 'Acceso: ver todos los comercios' },
  { key: 'accion_ofertas',    label: 'Ofertas',    kind: 'accion', desc: 'Acceso: ver ofertas' },
  { key: 'accion_novedades',  label: 'Novedades',  kind: 'accion', desc: 'Acceso: ver novedades' },
]

export const DEFAULT_PROMO_CARDS: PromoCardConfig[] = [
  { key: 'novedades', label: 'Novedades' },
  { key: 'ofertas', label: 'En oferta' },
  { key: 'recomendado', label: 'Recomendado' },
  { key: 'tendencia', label: 'Tendencia' },
  { key: 'accion_comercios', label: 'Comercios' },
  { key: 'accion_ofertas', label: 'Ofertas' },
  { key: 'accion_novedades', label: 'Novedades' },
]

export const PRODUCT_CARD_KEYS = new Set(['novedades', 'ofertas', 'recomendado', 'tendencia'])

export interface MarketStore {
  id: string
  name: string
  slug: string
  businessType?: string | null
  logoUrl?: string | null
  coverUrl?: string | null
  cardDescription?: string | null
  city?: string | null
  address?: string | null
  department?: string | null
  schedule?: string | null
  latitude?: number | null
  longitude?: number | null
  isVerified?: number | boolean
  openState?: 'open' | 'closed'
  nextOpenLabel?: string | null
  sedeCount?: number
  productCount: number
  theme?: string
  /** Si está presente, la tarjeta es externa: al abrirla redirige a este link. */
  externalUrl?: string | null
}

export interface MarketProduct {
  id: string
  name: string
  imageUrl?: string | null
  salePrice: number
  offerPrice?: number | null
  isOnOffer?: boolean
  storeName?: string
  category?: string
  storeSlug?: string
  tenantSlug?: string
  createdAt?: string | null
}
