'use client'

/**
 * ============================================================================
 *  TEMA 2 — Página de Inicio (Marketplace) · estilo institucional
 * ============================================================================
 *  Shell completo verde institucional (#00833E) + dorado (#F0A500):
 *  header con buscador → navbar verde con mega-menú → banner de alerta →
 *  hero carrusel (4s) → accesos rápidos → tabs → grid de comercios / ofertas /
 *  novedades + sidebar de estadísticas y eventos → footer.
 *
 *  - Las tarjetas de presentación de los comercios se renderizan TAL CUAL
 *    (mismo markup que la landing original).
 *  - El carrusel reutiliza los slides gestionados en superadmin.
 * ============================================================================
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronLeft, ChevronRight, Store, UtensilsCrossed, Zap, Tag, Package,
  Sparkles, ShoppingBag, Pill, Apple, Wrench, Scissors, Dog, Wine,
  Croissant, Coffee, Shirt, Gem, Flower2, ArrowRight, Search, User,
  ChevronDown, MapPin, Flame, Bell, Facebook, Instagram, Phone,
  Mail, TrendingUp, X, Menu,
} from 'lucide-react'

// ── Paleta institucional ────────────────────────────────────────────────────
const GREEN = '#00833E'
const GREEN_DARK = '#005C2A'
const GOLD = '#F0A500'

// ── Tipos compartidos ─────────────────────────────────────────────────────────
export interface HeroSlide {
  id: string
  type: 'image' | 'video'
  url: string
  link?: string
  title?: string
  subtitle?: string
}

export interface RubroCategory {
  type: string
  count: number
}

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
  isVerified?: number | boolean
  openState?: 'open' | 'closed'
  nextOpenLabel?: string | null
  sedeCount?: number
  productCount: number
  theme?: string
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
}

// ── Iconos por rubro ────────────────────────────────────────────────────────────
const RUBRO_ICONS: Record<string, React.ReactNode> = {
  restaurante: <UtensilsCrossed className="w-full h-full" />,
  comida: <UtensilsCrossed className="w-full h-full" />,
  gastrobar: <UtensilsCrossed className="w-full h-full" />,
  tecnologia: <Zap className="w-full h-full" />,
  'tecnología': <Zap className="w-full h-full" />,
  ropa: <Shirt className="w-full h-full" />,
  moda: <Shirt className="w-full h-full" />,
  calzado: <ShoppingBag className="w-full h-full" />,
  drogueria: <Pill className="w-full h-full" />,
  'droguería': <Pill className="w-full h-full" />,
  farmacia: <Pill className="w-full h-full" />,
  fruver: <Apple className="w-full h-full" />,
  supermercado: <ShoppingBag className="w-full h-full" />,
  ferreteria: <Wrench className="w-full h-full" />,
  'ferretería': <Wrench className="w-full h-full" />,
  tapiceria: <Wrench className="w-full h-full" />,
  'tapicería': <Wrench className="w-full h-full" />,
  belleza: <Scissors className="w-full h-full" />,
  peluqueria: <Scissors className="w-full h-full" />,
  mascotas: <Dog className="w-full h-full" />,
  licores: <Wine className="w-full h-full" />,
  panaderia: <Croissant className="w-full h-full" />,
  'panadería': <Croissant className="w-full h-full" />,
  cafe: <Coffee className="w-full h-full" />,
  'café': <Coffee className="w-full h-full" />,
  joyeria: <Gem className="w-full h-full" />,
  'joyería': <Gem className="w-full h-full" />,
  flores: <Flower2 className="w-full h-full" />,
  perfumeria: <Sparkles className="w-full h-full" />,
  'perfumería': <Sparkles className="w-full h-full" />,
}

const rubroIcon = (type: string): React.ReactNode =>
  RUBRO_ICONS[type.toLowerCase()] ?? <Store className="w-full h-full" />

const fmtCOP = (v: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v || 0)

// ════════════════════════════════════════════════════════════════════════════
//  HERO CAROUSEL (reutilizable)
// ════════════════════════════════════════════════════════════════════════════
export function HomeHeroCarousel({
  slides,
  isMobile = false,
  intervalMs = 5500,
}: {
  slides: HeroSlide[]
  isMobile?: boolean
  intervalMs?: number
}) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const valid = (slides || []).filter(s => s && s.url)

  useEffect(() => {
    if (paused || valid.length <= 1) return
    const id = setInterval(() => setIndex(i => (i + 1) % valid.length), intervalMs)
    return () => clearInterval(id)
  }, [paused, valid.length, intervalMs])

  useEffect(() => {
    if (index >= valid.length) setIndex(0)
  }, [valid.length, index])

  if (valid.length === 0) return null

  const go = (dir: number) => setIndex(i => (i + dir + valid.length) % valid.length)
  const heightClass = isMobile ? 'h-[44vw] max-h-[260px] min-h-[170px]' : 'h-[clamp(260px,38vw,460px)]'

  return (
    <section
      className="relative w-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-label="Carrusel principal"
    >
      <div className={`relative w-full overflow-hidden bg-black ${heightClass} rounded-xl`}>
        {valid.map((slide, i) => {
          const active = i === index
          const media = slide.type === 'video' ? (
            <video src={slide.url} autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={slide.url} alt={slide.title || `Banner ${i + 1}`} className="absolute inset-0 w-full h-full object-cover" loading={i === 0 ? 'eager' : 'lazy'} />
          )
          const overlay = (slide.title || slide.subtitle) && (
            <>
              <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/25 to-transparent pointer-events-none" />
              <div className="absolute inset-0 flex flex-col justify-center px-6 sm:px-12 max-w-2xl pointer-events-none">
                {slide.title && <h2 className="text-white text-xl sm:text-3xl md:text-4xl font-bold tracking-tight drop-shadow-lg leading-tight">{slide.title}</h2>}
                {slide.subtitle && <p className="text-white/85 text-sm sm:text-lg mt-2 sm:mt-3 drop-shadow-md max-w-lg">{slide.subtitle}</p>}
                {slide.link && (
                  <span className="mt-4 inline-flex items-center gap-1.5 self-start text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-full" style={{ background: GOLD }}>
                    Ver más <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
            </>
          )
          const inner = (
            <div className={`absolute inset-0 transition-opacity duration-700 ease-out ${active ? 'opacity-100 z-10' : 'opacity-0 z-0'}`} aria-hidden={!active}>
              {media}{overlay}
            </div>
          )
          return slide.link ? (
            <a key={slide.id || i} href={slide.link} target={slide.link.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className={active ? 'block cursor-pointer' : 'pointer-events-none'}>{inner}</a>
          ) : (
            <div key={slide.id || i}>{inner}</div>
          )
        })}

        {valid.length > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Anterior" className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-black/45 hover:bg-black/70 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white transition-all"><ChevronLeft className="w-5 h-5" /></button>
            <button type="button" onClick={() => go(1)} aria-label="Siguiente" className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-black/45 hover:bg-black/70 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white transition-all"><ChevronRight className="w-5 h-5" /></button>
          </>
        )}
        {valid.length > 1 && (
          <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
            {valid.map((_, i) => (
              <button key={i} type="button" aria-label={`Ir al slide ${i + 1}`} onClick={() => setIndex(i)} className="h-1.5 rounded-full transition-all duration-300" style={{ width: i === index ? 24 : 6, background: i === index ? GOLD : 'rgba(255,255,255,.5)' }} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  CATEGORY RAIL (legado — usado por la landing en modo Tema 1 alterno)
// ════════════════════════════════════════════════════════════════════════════
export function HomeCategoryRail({
  categories, active, total, onSelect,
}: {
  categories: RubroCategory[]
  active: string
  total: number
  onSelect: (type: string) => void
}) {
  const cats = (categories || []).filter(c => c.type)
  if (cats.length === 0) return null
  return (
    <section className="landing-section-bg relative py-5 sm:py-7">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
        <div className="flex gap-2 sm:gap-2.5 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
          <button onClick={() => onSelect('all')} className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-full border text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${active === 'all' ? 'bg-white text-black border-white shadow' : 'bg-white/5 text-white/70 border-white/12 hover:border-white/35 hover:text-white'}`}>
            <Store className="w-4 h-4" /> Todos
          </button>
          {cats.map(({ type, count }) => {
            const selected = active === type
            return (
              <button key={type} onClick={() => onSelect(type)} className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-full border text-xs sm:text-sm font-medium whitespace-nowrap capitalize transition-all ${selected ? 'bg-white text-black border-white shadow' : 'bg-white/5 text-white/70 border-white/12 hover:border-white/35 hover:text-white'}`}>
                <span className="w-4 h-4 inline-flex">{rubroIcon(type)}</span>{type}
                <span className="text-[10px] rounded-full px-1.5 py-0.5 bg-white/10 text-white/50">{count}</span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  TARJETA DE COMERCIO (idéntica a la landing original)
// ════════════════════════════════════════════════════════════════════════════
function StoreCard({
  store, onOpenStore, hasServices, ensureAbsoluteUrl,
}: {
  store: MarketStore
  onOpenStore: (s: MarketStore) => void
  hasServices: boolean
  ensureAbsoluteUrl: (u: string) => string
}) {
  const isEmpty = store.productCount === 0
  return (
    <button
      onClick={() => { if (!isEmpty) onOpenStore(store) }}
      className={`group relative bg-[#171717] rounded-2xl overflow-hidden text-left flex flex-col shadow-sm transition-all duration-300 border ${isEmpty ? 'cursor-default border-white/5 opacity-70' : 'hover:shadow-xl border-white/10 hover:border-white/25 cursor-pointer'}`}
    >
      {isEmpty && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/80 backdrop-blur-[2px] rounded-2xl">
          <span style={{ fontSize: '1.6rem', lineHeight: 1, marginBottom: '0.4rem' }}>🚧</span>
          <p style={{ color: '#d97706', fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Próximamente</p>
        </div>
      )}
      {hasServices && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: 80, height: 80, zIndex: 30, pointerEvents: 'none', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 18, left: -22, width: 100, transform: 'rotate(-45deg)', background: 'linear-gradient(90deg,#7c3aed,#a855f7)', color: '#fff', fontSize: 8, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.18em', padding: '3px 0', textAlign: 'center' }}>
            Servicios
          </div>
        </div>
      )}
      <div className="relative w-full bg-[#0e0e0e] overflow-hidden shrink-0" style={{ aspectRatio: '16/10' }}>
        {(store.coverUrl || store.logoUrl) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ensureAbsoluteUrl((store.coverUrl || store.logoUrl) as string)} alt={store.name} className={`w-full h-full ${store.coverUrl ? 'object-cover' : 'object-contain p-4'} ${isEmpty ? '' : 'group-hover:scale-105'} transition-transform duration-500`} />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><Store className="w-10 h-10 text-white/15" /></div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#171717] to-transparent pointer-events-none" />
        {!isEmpty && (
          <span className={`absolute top-2.5 right-2.5 flex items-center gap-1 text-[9px] sm:text-[10px] font-bold px-2 py-1 rounded-full backdrop-blur-sm ${store.openState === 'closed' ? 'bg-red-500/20 text-red-300 border border-red-400/40' : 'bg-green-500/20 text-green-300 border border-green-400/50'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${store.openState === 'closed' ? 'bg-red-400' : 'bg-green-400'}`} />
            {store.openState === 'closed' ? 'CERRADO' : 'ABIERTO'}
          </span>
        )}
      </div>
      <div className="px-4 -mt-7 relative z-10 flex">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden bg-[#1f1f1f] border-2 border-[#171717] shadow-lg flex items-center justify-center shrink-0">
          {store.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ensureAbsoluteUrl(store.logoUrl)} alt={store.name} className="w-full h-full object-cover" />
          ) : (
            <Store className="w-6 h-6 text-white/30" />
          )}
        </div>
      </div>
      <div className="px-4 pt-2 pb-4 flex flex-col gap-1 mt-auto">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm sm:text-base font-bold text-white truncate">{store.name}</h3>
          {Boolean(store.isVerified) && (
            <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" role="img" aria-label="Verificado">
              <path fill="#3b82f6" d="M12 1l2.4 1.8 3 .2.9 2.9 2.4 1.8-.9 2.9.9 2.9-2.4 1.8-.9 2.9-3 .2L12 23l-2.4-1.8-3-.2-.9-2.9L3.3 16l.9-2.9-.9-2.9 2.4-1.8.9-2.9 3-.2z"/>
              <path fill="#fff" d="M10.6 14.6l-2.2-2.2-1.1 1.1 3.3 3.3 6-6-1.1-1.1z"/>
            </svg>
          )}
        </div>
        {(store.cardDescription || store.businessType) && (
          <p className="text-[11px] sm:text-xs text-white/50 truncate">{store.cardDescription || store.businessType}</p>
        )}
        <div className="flex items-center gap-1 mt-1 text-[11px] text-white/40">
          <MapPin className="w-3 h-3 text-rose-400 shrink-0" />
          <span className="truncate">
            {[
              typeof store.sedeCount === 'number' ? `${store.sedeCount} Sede(s)` : null,
              store.city || (!store.city && typeof store.sedeCount !== 'number' ? store.address : null),
            ].filter(Boolean).join(' · ')}
          </span>
        </div>
        {store.openState === 'closed' && store.nextOpenLabel && (
          <p className="text-[11px] text-amber-400/90 mt-0.5 truncate">🕒 {store.nextOpenLabel}</p>
        )}
      </div>
    </button>
  )
}

// ── Tarjeta de producto (estilo claro institucional) ──────────────────────────
function ProductCard({ product, onOpen }: { product: MarketProduct; onOpen: (p: MarketProduct) => void }) {
  const isOffer = !!(product.isOnOffer && product.offerPrice)
  const discount = isOffer ? Math.round(((product.salePrice - (product.offerPrice as number)) / product.salePrice) * 100) : 0
  return (
    <button onClick={() => onOpen(product)} className="group text-left bg-white rounded-xl overflow-hidden border border-gray-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 flex flex-col">
      <div className="relative aspect-[4/3] bg-gray-50 overflow-hidden">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><Package className="w-8 h-8 text-gray-300" /></div>
        )}
        {isOffer && (
          <span className="absolute top-2 left-2 flex items-center gap-1 text-white text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: '#dc2626' }}>
            <Flame className="w-2.5 h-2.5" />-{discount}%
          </span>
        )}
      </div>
      <div className="p-3 flex flex-col gap-0.5">
        <p className="text-sm font-medium text-gray-800 line-clamp-2 leading-snug">{product.name}</p>
        {product.storeName && <p className="text-[10px] uppercase tracking-wide text-gray-400 truncate">{product.storeName}</p>}
        <div className="flex items-center gap-2 mt-1">
          {isOffer ? (
            <>
              <span className="text-xs text-gray-400 line-through">{fmtCOP(product.salePrice)}</span>
              <span className="text-sm font-bold" style={{ color: GREEN }}>{fmtCOP(product.offerPrice as number)}</span>
            </>
          ) : (
            <span className="text-sm font-bold" style={{ color: GREEN }}>{fmtCOP(product.salePrice)}</span>
          )}
        </div>
      </div>
    </button>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  PÁGINA PRINCIPAL — Marketplace estilo institucional
// ════════════════════════════════════════════════════════════════════════════
type MainTab = 'comercios' | 'ofertas' | 'novedades'

export function MarketplaceHomeGovCo({
  stores,
  products,
  featured,
  offers,
  heroSlides,
  businessTypeFilter,
  onSelectBusinessType,
  onOpenStore,
  onOpenProduct,
  loadingStores,
  storesWithServices,
  ensureAbsoluteUrl,
  onGoToLogin,
  heroTitle,
  heroSubtitle,
}: {
  stores: MarketStore[]
  products: MarketProduct[]
  featured: MarketProduct[]
  offers: MarketProduct[]
  heroSlides: HeroSlide[]
  businessTypeFilter: string
  onSelectBusinessType: (t: string) => void
  onOpenStore: (s: MarketStore) => void
  onOpenProduct: (p: MarketProduct) => void
  loadingStores: boolean
  storesWithServices: Set<string>
  ensureAbsoluteUrl: (u: string) => string
  onGoToLogin: () => void
  heroTitle?: string
  heroSubtitle?: string
}) {
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<MainTab>('comercios')
  const [megaOpen, setMegaOpen] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [alertOpen, setAlertOpen] = useState(true)
  const gridRef = useRef<HTMLDivElement>(null)

  // Rubros con conteo
  const rubros = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of stores) {
      const key = (s.businessType || 'General') as string
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    return Array.from(counts.entries()).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count)
  }, [stores])

  // Filtro por búsqueda + rubro
  const q = query.trim().toLowerCase()
  const visibleStores = useMemo(() =>
    stores
      .filter(s => businessTypeFilter === 'all' || s.businessType === businessTypeFilter)
      .filter(s => !q || s.name.toLowerCase().includes(q) || (s.cardDescription || '').toLowerCase().includes(q) || (s.businessType || '').toLowerCase().includes(q))
      .sort((a, b) => (b.productCount > 0 ? 1 : 0) - (a.productCount > 0 ? 1 : 0)),
    [stores, businessTypeFilter, q])

  const visibleOffers = useMemo(() =>
    offers.filter(p => !q || p.name.toLowerCase().includes(q) || (p.storeName || '').toLowerCase().includes(q)),
    [offers, q])
  const visibleFeatured = useMemo(() =>
    (featured.length ? featured : products).filter(p => !q || p.name.toLowerCase().includes(q) || (p.storeName || '').toLowerCase().includes(q)),
    [featured, products, q])

  const scrollToGrid = () => gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const pickRubro = (type: string) => {
    onSelectBusinessType(type)
    setTab('comercios')
    setMegaOpen(false)
    setMobileNav(false)
    setTimeout(scrollToGrid, 50)
  }

  const navItems: { key: MainTab | 'categorias'; label: string }[] = [
    { key: 'comercios', label: 'Comercios' },
    { key: 'ofertas', label: 'Ofertas' },
    { key: 'novedades', label: 'Novedades' },
  ]

  // Estadísticas del mes
  const stats = {
    comercios: stores.length,
    productos: stores.reduce((s, x) => s + (x.productCount || 0), 0),
    ofertas: offers.length,
    verificados: stores.filter(s => Boolean(s.isVerified)).length,
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 flex flex-col">
      {/* ══ Header ══ */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3 sm:gap-5">
          <button onClick={scrollToGrid} className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-white font-extrabold" style={{ background: GREEN }}>L</span>
            <span className="text-lg sm:text-xl font-extrabold tracking-tight" style={{ color: GREEN_DARK }}>Lopbuk</span>
          </button>

          <div className="relative flex-1 max-w-2xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar comercios, productos o categorías…"
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ ['--tw-ring-color' as any]: GREEN }}
            />
          </div>

          <button onClick={onGoToLogin} className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white shrink-0 transition-colors" style={{ background: GREEN }}>
            <User className="w-4 h-4" /> Acceder
          </button>
          <button onClick={() => setMobileNav(v => !v)} className="sm:hidden p-2 rounded-lg border border-gray-300 text-gray-600" aria-label="Menú">
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ══ Navbar verde ══ */}
      <nav className="text-white sticky top-[57px] z-30 shadow-sm" style={{ background: GREEN }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`${mobileNav ? 'flex' : 'hidden'} sm:flex flex-col sm:flex-row sm:items-stretch`}>
            <button onClick={() => { setTab('comercios'); onSelectBusinessType('all'); setMobileNav(false); setTimeout(scrollToGrid, 50) }} className="relative text-left px-4 py-3 text-sm font-medium hover:bg-black/10 transition-colors">
              Inicio
            </button>
            {/* Mega-menú categorías */}
            <div className="relative" onMouseEnter={() => setMegaOpen(true)} onMouseLeave={() => setMegaOpen(false)}>
              <button onClick={() => setMegaOpen(v => !v)} className="w-full sm:w-auto flex items-center gap-1 px-4 py-3 text-sm font-medium hover:bg-black/10 transition-colors">
                Categorías <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {megaOpen && rubros.length > 0 && (
                <div className="absolute left-0 top-full z-40 w-[min(92vw,640px)] bg-white text-gray-800 rounded-b-xl shadow-2xl border border-gray-200 p-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <button onClick={() => pickRubro('all')} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 text-sm">
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ background: GREEN }}><Store className="w-4 h-4" /></span>
                      Todos los comercios
                    </button>
                    {rubros.map(({ type, count }) => (
                      <button key={type} onClick={() => pickRubro(type)} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 text-sm capitalize">
                        <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: GREEN }}><span className="w-4 h-4 inline-flex">{rubroIcon(type)}</span></span>
                        <span className="min-w-0 truncate">{type}</span>
                        <span className="ml-auto text-[10px] text-gray-400">{count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {navItems.filter(n => n.key !== 'comercios').map(item => {
              const active = tab === item.key
              return (
                <button
                  key={item.key}
                  onClick={() => { setTab(item.key as MainTab); setMobileNav(false); setTimeout(scrollToGrid, 50) }}
                  className="relative px-4 py-3 text-sm font-medium hover:bg-black/10 transition-colors text-left"
                  style={active ? { boxShadow: `inset 0 -3px 0 ${GOLD}` } : undefined}
                >
                  {item.label}
                </button>
              )
            })}
            <a href="https://api.whatsapp.com/send" target="_blank" rel="noopener noreferrer" className="px-4 py-3 text-sm font-medium hover:bg-black/10 transition-colors">Contacto</a>
          </div>
        </div>
      </nav>

      {/* ══ Banner de alerta ══ */}
      {alertOpen && (
        <div className="text-gray-900" style={{ background: GOLD }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-2 text-sm">
            <Bell className="w-4 h-4 shrink-0" />
            <span className="flex-1">{heroTitle || 'Bienvenido a Lopbuk — descubre los comercios locales y sus productos.'}</span>
            <button onClick={() => setAlertOpen(false)} className="p-1 hover:bg-black/10 rounded" aria-label="Cerrar"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* ══ Contenido ══ */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 space-y-7">

          {/* Hero */}
          {heroSlides.filter(s => s.url).length > 0 ? (
            <HomeHeroCarousel slides={heroSlides} intervalMs={4000} />
          ) : (
            <section className="relative rounded-xl overflow-hidden p-8 sm:p-12 text-white" style={{ background: `linear-gradient(120deg, ${GREEN_DARK}, ${GREEN})` }}>
              <h1 className="text-2xl sm:text-4xl font-extrabold max-w-2xl">{heroTitle || 'Tu marketplace de comercios locales'}</h1>
              <p className="mt-2 text-white/85 max-w-xl">{heroSubtitle || 'Explora tiendas, ofertas y novedades en un solo lugar.'}</p>
            </section>
          )}

          {/* Accesos rápidos (rubros) */}
          {rubros.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: GREEN_DARK }}>Accesos rápidos</h2>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-3">
                <button onClick={() => pickRubro('all')} className={`flex flex-col items-center justify-center gap-2 rounded-xl border px-2 py-4 text-center transition-all ${businessTypeFilter === 'all' ? 'border-transparent shadow-md text-white' : 'bg-white border-gray-200 hover:shadow-md hover:-translate-y-0.5 text-gray-700'}`} style={businessTypeFilter === 'all' ? { background: GREEN } : undefined}>
                  <span className={`w-10 h-10 rounded-lg flex items-center justify-center ${businessTypeFilter === 'all' ? 'bg-white/20 text-white' : 'text-white'}`} style={businessTypeFilter === 'all' ? undefined : { background: GREEN }}><Store className="w-5 h-5" /></span>
                  <span className="text-[11px] font-medium">Todos</span>
                </button>
                {rubros.slice(0, 11).map(({ type, count }) => {
                  const selected = businessTypeFilter === type
                  return (
                    <button key={type} onClick={() => pickRubro(type)} className={`flex flex-col items-center justify-center gap-2 rounded-xl border px-2 py-4 text-center transition-all ${selected ? 'border-transparent shadow-md text-white' : 'bg-white border-gray-200 hover:shadow-md hover:-translate-y-0.5 text-gray-700'}`} style={selected ? { background: GREEN } : undefined}>
                      <span className="w-10 h-10 rounded-lg flex items-center justify-center text-white" style={{ background: selected ? 'rgba(255,255,255,.2)' : GREEN }}><span className="w-5 h-5 inline-flex">{rubroIcon(type)}</span></span>
                      <span className="text-[11px] font-medium capitalize line-clamp-1">{type}</span>
                      <span className={`text-[10px] ${selected ? 'text-white/80' : 'text-gray-400'}`}>{count}</span>
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {/* Tabs + layout 2 columnas */}
          <div ref={gridRef} className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
            {/* Columna principal */}
            <div className="min-w-0 space-y-5">
              {/* Tabs */}
              <div className="flex items-center gap-1 border-b border-gray-200">
                {(['comercios', 'ofertas', 'novedades'] as MainTab[]).map(t => (
                  <button key={t} onClick={() => setTab(t)} className="relative px-4 py-2.5 text-sm font-semibold capitalize transition-colors" style={tab === t ? { color: GREEN_DARK, boxShadow: `inset 0 -3px 0 ${GOLD}` } : { color: '#6b7280' }}>
                    {t === 'comercios' ? 'Comercios' : t === 'ofertas' ? 'Ofertas' : 'Novedades'}
                  </button>
                ))}
              </div>

              {/* COMERCIOS */}
              {tab === 'comercios' && (
                <div>
                  {loadingStores ? (
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                      {[0, 1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="bg-white rounded-2xl overflow-hidden animate-pulse shadow-sm border border-gray-100">
                          <div className="bg-gray-100" style={{ aspectRatio: '16/9' }} />
                          <div className="p-3 space-y-2"><div className="h-3 bg-gray-200 rounded w-2/3" /><div className="h-2 bg-gray-100 rounded w-1/3" /></div>
                        </div>
                      ))}
                    </div>
                  ) : visibleStores.length === 0 ? (
                    <div className="text-center py-16 space-y-3">
                      <Store className="w-12 h-12 text-gray-300 mx-auto" />
                      <p className="text-gray-500 text-sm">No hay comercios para esta búsqueda</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-gray-500 mb-3">{visibleStores.length} comercio{visibleStores.length !== 1 ? 's' : ''}</p>
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                        {visibleStores.map(store => (
                          <StoreCard key={store.id} store={store} onOpenStore={onOpenStore} hasServices={storesWithServices.has(store.slug)} ensureAbsoluteUrl={ensureAbsoluteUrl} />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* OFERTAS */}
              {tab === 'ofertas' && (
                <div>
                  {visibleOffers.length === 0 ? (
                    <div className="text-center py-16 space-y-3"><Tag className="w-12 h-12 text-gray-300 mx-auto" /><p className="text-gray-500 text-sm">No hay ofertas activas</p></div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                      {visibleOffers.map(p => <ProductCard key={p.id} product={p} onOpen={onOpenProduct} />)}
                    </div>
                  )}
                </div>
              )}

              {/* NOVEDADES */}
              {tab === 'novedades' && (
                <div>
                  {visibleFeatured.length === 0 ? (
                    <div className="text-center py-16 space-y-3"><Sparkles className="w-12 h-12 text-gray-300 mx-auto" /><p className="text-gray-500 text-sm">Aún no hay productos para mostrar</p></div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                      {visibleFeatured.slice(0, 24).map(p => <ProductCard key={p.id} product={p} onOpen={onOpenProduct} />)}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sidebar */}
            <aside className="space-y-5">
              {/* Estadísticas */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: GREEN_DARK }}><TrendingUp className="w-4 h-4" /> Estadísticas</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Comercios', value: stats.comercios },
                    { label: 'Productos', value: stats.productos },
                    { label: 'Ofertas', value: stats.ofertas },
                    { label: 'Verificados', value: stats.verificados },
                  ].map(s => (
                    <div key={s.label} className="rounded-lg bg-gray-50 p-3 text-center">
                      <p className="text-xl font-extrabold" style={{ color: GREEN }}>{s.value}</p>
                      <p className="text-[11px] text-gray-500">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Eventos / Promos */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: GREEN_DARK }}><Flame className="w-4 h-4" /> Promos del momento</h3>
                {offers.length === 0 ? (
                  <p className="text-xs text-gray-400">No hay promociones activas.</p>
                ) : (
                  <div className="space-y-2.5">
                    {offers.slice(0, 4).map(p => {
                      const disc = p.offerPrice ? Math.round(((p.salePrice - p.offerPrice) / p.salePrice) * 100) : 0
                      return (
                        <button key={p.id} onClick={() => onOpenProduct(p)} className="flex items-center gap-2.5 w-full text-left group">
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center">
                            {p.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                            ) : <Package className="w-5 h-5 text-gray-300" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-gray-800 truncate group-hover:underline">{p.name}</p>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold" style={{ color: GREEN }}>{fmtCOP(p.offerPrice || p.salePrice)}</span>
                              {disc > 0 && <span className="text-[10px] font-bold text-red-600">-{disc}%</span>}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Enlaces */}
              <div className="rounded-xl p-4 text-white" style={{ background: GREEN_DARK }}>
                <h3 className="text-sm font-bold mb-2">¿Tienes un comercio?</h3>
                <p className="text-xs text-white/80 mb-3">Publica tus productos y llega a más clientes en Lopbuk.</p>
                <button onClick={onGoToLogin} className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg text-gray-900" style={{ background: GOLD }}>
                  Empezar <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </aside>
          </div>
        </div>
      </main>

      {/* ══ Footer ══ */}
      <footer className="text-white mt-6" style={{ background: GREEN_DARK }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg font-extrabold text-gray-900" style={{ background: GOLD }}>L</span>
              <span className="text-lg font-extrabold">Lopbuk</span>
            </div>
            <p className="text-sm text-white/70">Marketplace de comercios locales. Encuentra tiendas, productos y ofertas cerca de ti.</p>
            <div className="flex items-center gap-2 mt-4">
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"><Facebook className="w-4 h-4" /></a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"><Instagram className="w-4 h-4" /></a>
              <a href="https://api.whatsapp.com/send" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"><Phone className="w-4 h-4" /></a>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-bold mb-3" style={{ color: GOLD }}>Comercios</h4>
            <ul className="space-y-2 text-sm text-white/70">
              <li><button onClick={() => pickRubro('all')} className="hover:text-white">Ver todos</button></li>
              {rubros.slice(0, 4).map(r => <li key={r.type}><button onClick={() => pickRubro(r.type)} className="hover:text-white capitalize">{r.type}</button></li>)}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-bold mb-3" style={{ color: GOLD }}>Ayuda</h4>
            <ul className="space-y-2 text-sm text-white/70">
              <li><button onClick={() => setTab('ofertas')} className="hover:text-white">Ofertas</button></li>
              <li><button onClick={() => setTab('novedades')} className="hover:text-white">Novedades</button></li>
              <li><a href="https://api.whatsapp.com/send" target="_blank" rel="noopener noreferrer" className="hover:text-white">Contacto</a></li>
              <li><button onClick={onGoToLogin} className="hover:text-white">Acceder</button></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-bold mb-3" style={{ color: GOLD }}>Contacto</h4>
            <ul className="space-y-2 text-sm text-white/70">
              <li className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> hola@lopbuk.com</li>
              <li className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> +57 300 000 0000</li>
              <li className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /> Colombia</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/60">
            <p>© {new Date().getFullYear()} Lopbuk. Todos los derechos reservados.</p>
            <div className="flex items-center gap-4">
              <a href="#" className="hover:text-white">Términos</a>
              <a href="#" className="hover:text-white">Privacidad</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
