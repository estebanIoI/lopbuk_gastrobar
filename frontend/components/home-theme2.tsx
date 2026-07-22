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
 *  - Fase 1 rediseño móvil: branch mobile-first (ver if (isMobile)).
 * ============================================================================
 */

import { useEffect, useMemo, useRef, useState, type ReactNode, type CSSProperties } from 'react'
import { BRAND } from '@/lib/brand'
import { DaimuzWelcomeFrame } from '@/components/daimuz-welcome-frame'
import { FlameButton } from '@/components/ui/flame-button'
import { useIsDesktop } from '@/components/consumer/hooks/useIsDesktop'
import { cldImg } from '@/utils/img'
import { StoresSection } from '@/components/stores-map'
import { fillTemplate, DEFAULT_TERMS, DEFAULT_PRIVACY_POLICY } from '@/lib/legal-templates'
import {
  ChevronLeft, ChevronRight, Store, Zap, Tag, Package, Sparkles, ShoppingBag,
  ArrowRight, Search, ChevronDown, MapPin, Flame, Facebook, Instagram, Phone,
  Mail, TrendingUp, X, Menu, Compass, User as UserIcon, Home as HomeIcon, ShoppingCart,
  ShieldCheck, Truck,
} from 'lucide-react'

// ── Módulos del marketplace (extraídos para reducir el tamaño de este archivo) ──
import {
  GREEN, GREEN_DARK, GOLD, GOLD_TEXT, readableOn, complementaryAccent,
  fmtCOP, waLink, PLATFORM_WHATSAPP, prefersReducedMotion,
} from './marketplace/theme'
import { PRODUCT_CARD_KEYS, DEFAULT_PROMO_CARDS } from './marketplace/types'
import type { HeroSlide, PromoCardConfig, MarketStore, MarketProduct } from './marketplace/types'
import { StoreCard, ProductCard } from './marketplace/cards'
import { HomeHeroCarousel } from './marketplace/hero'

// Re-exports: preservan el contrato público que consumen landing-page.tsx y otros.
export type { HeroSlide, RubroCategory, PromoCardConfig, MarketStore, MarketProduct } from './marketplace/types'
export { PROMO_CARD_CATALOG, DEFAULT_PROMO_CARDS } from './marketplace/types'
export { HomeHeroCarousel, HomeCategoryRail } from './marketplace/hero'

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
  heroIntervalMs,
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
  heroSplit = '60-40',
  heroRight = 'producto',
  heroFeaturedEnabled = false,
  promoConfig,
  welcomeEnabled = true,
  welcomeTitle,
  welcomeSubtitle,
  brandLogo = BRAND.icon,
  themeColors,
  contactWhatsApp,
}: {
  stores: MarketStore[]
  products: MarketProduct[]
  featured: MarketProduct[]
  offers: MarketProduct[]
  heroSlides: HeroSlide[]
  heroIntervalMs?: number
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
  /** Proporción del hero: '70-30' | '60-40' | '50-50' */
  heroSplit?: string
  /** Contenido del panel derecho: 'producto' | 'comercio' | 'cta' */
  heroRight?: string
  /** Muestra u oculta el panel destacado a la derecha del hero (configurable desde superadmin). */
  heroFeaturedEnabled?: boolean
  /** Tarjetas del carrusel "Para ti" (orden + tipo + etiqueta). Si no se pasa, usa el set por defecto. */
  promoConfig?: PromoCardConfig[]
  /** Barra de bienvenida (activable + contenido editable desde superadmin). */
  welcomeEnabled?: boolean
  welcomeTitle?: string
  welcomeSubtitle?: string
  /** Logo de la plataforma (configurable desde superadmin). */
  brandLogo?: string
  /** Paleta de marca generada por IA (superadmin). Tiñe todo el home. */
  themeColors?: { primary?: string; primary_hover?: string; secondary?: string; admin_accent?: string } | null
  /** WhatsApp de contacto (solo dígitos con código de país). Si no se pasa, usa NEXT_PUBLIC_WHATSAPP. */
  contactWhatsApp?: string
}) {
  // Enlace de contacto WhatsApp resuelto una sola vez (vacío = sin número → no se pintan links rotos).
  const waHref = waLink(contactWhatsApp || PLATFORM_WHATSAPP)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<MainTab>('comercios')
  const [megaOpen, setMegaOpen] = useState(false)
  const [catMenuOpen, setCatMenuOpen] = useState(false) // mega-catálogo de productos (izquierda)
  const [catSel, setCatSel] = useState<string | null>(null)
  const [showStoresMap, setShowStoresMap] = useState(false) // mapa interactivo de comercios
  const [mobileNav, setMobileNav] = useState(false)
  const [alertOpen, setAlertOpen] = useState(true)
  const [scrolled, setScrolled] = useState(false)
  const [legalDoc, setLegalDoc] = useState<'terminos' | 'privacidad' | null>(null)
  // Hero: el panel destacado (der.) se muestra según el ajuste persistente del superadmin.
  // Sin él, solo se ve el banner en primer plano a ancho completo.
  const showFeatured = heroFeaturedEnabled
  const gridRef = useRef<HTMLDivElement>(null)
  const accesosRef = useRef<HTMLDivElement>(null)
  const storesSecRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Placeholder rotativo del buscador — comunica el alcance del ecosistema DAIMUZ.
  const SEARCH_HINTS = [
    'Buscar comercios, productos o categorías…',
    'Buscar restaurantes cerca de ti…',
    'Buscar servicios: técnicos, salud, belleza…',
    'Buscar ofertas y novedades del día…',
    'Pregúntale a la IA qué necesitas hoy…',
  ]
  const [hintIdx, setHintIdx] = useState(0)
  useEffect(() => {
    // El placeholder no rota si el usuario pidió reducir movimiento.
    if (prefersReducedMotion()) return
    const t = setInterval(() => setHintIdx(i => (i + 1) % SEARCH_HINTS.length), 3200)
    return () => clearInterval(t)
  }, [])

  // ── Branch responsive (Fase 1 rediseño móvil) ──────────────────────────────
  // useIsDesktop devuelve null hasta montar → SSR/primer render = desktop (sin
  // mismatch de hidratación); tras montar, si es móvil, se renderiza el shell
  // mobile-first. Mismo componente, mismos datos y handlers (sin doble fetch).
  const isDesktop = useIsDesktop()
  const isMobile = isDesktop === false
  const [mobileNavTab, setMobileNavTab] = useState<'inicio' | 'explorar' | 'tiendas' | 'ofertas'>('inicio')
  const mTopRef = useRef<HTMLDivElement>(null)
  const mOffersRef = useRef<HTMLDivElement>(null)
  const mNewRef = useRef<HTMLDivElement>(null)

  // Producto destacado para el panel derecho del hero (60/40)
  const topFeatured: MarketProduct | undefined = featured[0] || offers[0] || products[0]

  // Tarjetas del carrusel "Para ti" resueltas desde la configuración
  const renderedCards = useMemo(() => {
    const cfg = (promoConfig && promoConfig.length ? promoConfig : DEFAULT_PROMO_CARDS)
    const poolFor = (key: string): MarketProduct[] =>
      key === 'ofertas' ? offers
      : key === 'tendencia' ? (offers.length ? offers : products)
      : (featured.length ? featured : products)
    const seen = new Set<string>()
    const out: ({ kind: 'product'; label: string; product: MarketProduct } | { kind: 'accion'; key: string; label: string })[] = []
    for (const c of cfg) {
      if (PRODUCT_CARD_KEYS.has(c.key)) {
        const p = poolFor(c.key).find(x => x && !seen.has(x.id))
        if (p) { seen.add(p.id); out.push({ kind: 'product', label: c.label, product: p }) }
      } else {
        out.push({ kind: 'accion', key: c.key, label: c.label })
      }
    }
    return out
  }, [promoConfig, featured, offers, products])

  // Comercio destacado (para panel derecho del hero, opción 'comercio')
  const topStore: MarketStore | undefined =
    stores.find(s => Boolean(s.isVerified) && s.productCount > 0) ||
    stores.find(s => s.productCount > 0) || stores[0]

  // Clase del split del hero según configuración del superadmin
  const splitClass = heroSplit === '70-30'
    ? 'lg:grid-cols-[1fr_300px]'
    : heroSplit === '50-50'
      ? 'lg:grid-cols-[1fr_1fr]'
      : 'lg:grid-cols-[1fr_340px]'

  // Rubros con conteo
  const rubros = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of stores) {
      const key = (s.businessType || 'General') as string
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    return Array.from(counts.entries()).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count)
  }, [stores])

  // Catálogo global: agrupa TODOS los productos (de todas las tiendas) por categoría.
  const allCategories = useMemo(() => {
    const map = new Map<string, MarketProduct[]>()
    for (const p of products) {
      const c = (p.category || '').trim() || 'Otros'
      if (!map.has(c)) map.set(c, [])
      map.get(c)!.push(p)
    }
    return Array.from(map.entries())
      .map(([name, items]) => ({ name, items, count: items.length }))
      .sort((a, b) => b.count - a.count)
  }, [products])
  const catActive = catSel ?? allCategories[0]?.name ?? null
  const catProducts = useMemo(
    () => allCategories.find(c => c.name === catActive)?.items.slice(0, 12) ?? [],
    [allCategories, catActive])

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
  const visibleFeatured = useMemo(() => {
    // Novedades = destacados del superadmin; si no hay, muestra los productos
    // más recientes (por createdAt desc). El backend ordena is_on_offer DESC,
    // así que sin reordenar por fecha Novedades clonaba las Ofertas.
    const recencyTs = (p: MarketProduct) => {
      const t = p.createdAt ? Date.parse(p.createdAt) : NaN
      return Number.isNaN(t) ? 0 : t
    }
    const base = featured.length
      ? featured
      : [...products].sort((a, b) => recencyTs(b) - recencyTs(a))
    return base.filter(p => !q || p.name.toLowerCase().includes(q) || (p.storeName || '').toLowerCase().includes(q))
  }, [featured, products, q])

  const scrollToGrid = () => gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  // Volver a Inicio (lo hace el logo): resetea filtros y sube al tope.
  const goHome = () => {
    setTab('comercios'); onSelectBusinessType('all'); setQuery(''); setShowStoresMap(false)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

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

  // Variables de marca: si hay paleta IA, tiñe todo el home (header verde,
  // gradientes, chips, acentos). Si no, conserva el verde DAIMUZ por defecto.
  const paletteActive = !!(themeColors?.primary || themeColors?.primary_hover)
  // Acento "destacado": complementario calculado del primario (resalta sobre el
  // header) y, si el color es gris/sin matiz, cae al acento panel o primario.
  const goldAccent = complementaryAccent(themeColors?.primary || themeColors?.primary_hover)
    || themeColors?.admin_accent || themeColors?.primary_hover || themeColors?.primary
  const brandVars = paletteActive
    ? ({
        ['--brand-green' as string]: themeColors?.primary || themeColors?.primary_hover,
        ['--brand-green-dark' as string]: themeColors?.primary_hover || themeColors?.primary,
        ['--brand-gold' as string]: goldAccent,
        ['--brand-gold-text' as string]: readableOn(goldAccent),
      } as CSSProperties)
    : undefined

  // ════════════════════════════════════════════════════════════════════════════
  //  RENDER MÓVIL (Fase 1 rediseño) — mobile-first, sin tabs/navbar redundantes.
  //  Reusa los mismos datos, handlers y tarjetas (StoreCard/ProductCard) que el
  //  desktop. Desktop queda intacto debajo.
  // ════════════════════════════════════════════════════════════════════════════
  if (isMobile) {
    const goTop = () => { setMobileNavTab('inicio'); mTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
    const goStores = () => { setMobileNavTab('tiendas'); gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
    const goOffers = () => { setMobileNavTab('ofertas'); mOffersRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
    const goExplore = () => { setMobileNavTab('explorar'); mNewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
    const heroHasSlides = heroSlides.filter(s => s.url).length > 0
    const navItemsM: { key: typeof mobileNavTab | 'cuenta'; label: string; icon: ReactNode; onClick: () => void }[] = [
      { key: 'inicio', label: 'Inicio', icon: <HomeIcon className="w-5 h-5" />, onClick: goTop },
      { key: 'explorar', label: 'Explorar', icon: <Compass className="w-5 h-5" />, onClick: goExplore },
      { key: 'tiendas', label: 'Tiendas', icon: <Store className="w-5 h-5" />, onClick: goStores },
      { key: 'ofertas', label: 'Ofertas', icon: <Tag className="w-5 h-5" />, onClick: goOffers },
      { key: 'cuenta', label: 'Cuenta', icon: <UserIcon className="w-5 h-5" />, onClick: onGoToLogin },
    ]
    const chipStyle = (selected: boolean): CSSProperties =>
      selected ? { background: GREEN, color: '#fff', borderColor: GREEN } : { color: '#4b5563', borderColor: '#d7dbe0', background: '#fff' }
    return (
      <div ref={mTopRef} className="min-h-screen bg-gray-50 text-gray-800 flex flex-col pb-24 relative" style={brandVars}>
        <a href="#contenido" className="skip-link">Saltar al contenido</a>
        <h1 className="sr-only">DAIMUZ — Marketplace de comercios locales: tiendas, ofertas y domicilios cerca de ti</h1>
        {/* Profundidad ambiental (en el verde/gold de la marca) — coherente con el sistema glass */}
        <div aria-hidden className="fixed inset-0 pointer-events-none" style={{ zIndex: 0, background: 'radial-gradient(1000px 560px at 6% -6%, rgba(0,131,62,0.07), transparent 60%), radial-gradient(900px 520px at 100% 2%, rgba(240,165,0,0.08), transparent 55%)' }} />
        {/* ── TopBar: logo + búsqueda + acceder ── */}
        <header className="bg-white/95 backdrop-blur sticky top-0 z-40 border-b border-gray-200">
          <div className="px-4 py-2.5 flex items-center gap-2.5">
            <button onClick={goTop} className="shrink-0" aria-label="Inicio">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={brandLogo} alt={BRAND.name} className="w-8 h-8 object-contain rounded-lg" />
            </button>
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="search"
                aria-label="Buscar comercios y productos"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={SEARCH_HINTS[hintIdx]}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-gray-100 text-sm focus:outline-none focus:ring-2 focus:bg-white"
                style={{ ['--tw-ring-color' as string]: GREEN } as CSSProperties}
              />
            </div>
            <button onClick={onGoToLogin} className="text-sm font-semibold shrink-0" style={{ color: GREEN_DARK }}>Acceder</button>
          </div>
          {/* ── Chips de categoría: única capa de filtro ── */}
          {rubros.length > 0 && (
            <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 pb-2.5">
              <button onClick={() => onSelectBusinessType('all')} className="shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium border whitespace-nowrap transition-colors" style={chipStyle(businessTypeFilter === 'all')}>Todos</button>
              {rubros.slice(0, 8).map(({ type }) => (
                <button key={type} onClick={() => onSelectBusinessType(type)} className="shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium border whitespace-nowrap capitalize transition-colors" style={chipStyle(businessTypeFilter === type)}>{type}</button>
              ))}
            </div>
          )}
        </header>

        <main id="contenido" className="flex-1 px-4 py-4 space-y-8">
          {/* ── Hero único ── */}
          <section>
            {heroHasSlides ? (
              <div className="rounded-2xl overflow-hidden"><HomeHeroCarousel slides={heroSlides} isMobile intervalMs={heroIntervalMs ?? 5000} /></div>
            ) : (
              <div className="relative rounded-2xl overflow-hidden p-6 min-h-[200px] flex flex-col justify-end text-white" style={{ background: `linear-gradient(135deg, ${GREEN_DARK}, ${GREEN})` }}>
                <h2 className="text-xl font-extrabold leading-tight max-w-[220px]">{heroTitle || 'Tu marketplace local'}</h2>
                <p className="text-white/80 text-sm mt-1.5 max-w-[240px]">{heroSubtitle || 'Tiendas, ofertas y novedades en un solo lugar.'}</p>
                <button onClick={goStores} className="mt-4 self-start text-sm font-semibold px-5 py-2 rounded-full" style={{ background: GOLD, color: GOLD_TEXT }}>Explorar</button>
              </div>
            )}
          </section>

          {/* ── Comercios (1 columna, cards grandes) ── */}
          <section ref={gridRef}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[15px] font-bold" style={{ color: GREEN_DARK }}>Comercios</h2>
              {!loadingStores && <span className="text-xs text-gray-400">{visibleStores.length}</span>}
            </div>
            {loadingStores ? (
              <div className="grid grid-cols-1 gap-3">
                {[0, 1, 2].map(i => (
                  <div key={i} className="bg-white rounded-2xl overflow-hidden animate-pulse border border-gray-100">
                    <div className="bg-gray-100" style={{ aspectRatio: '16/9' }} />
                    <div className="p-3 space-y-2"><div className="h-3 bg-gray-200 rounded w-2/3" /><div className="h-2 bg-gray-100 rounded w-1/3" /></div>
                  </div>
                ))}
              </div>
            ) : visibleStores.length === 0 ? (
              <div className="text-center py-12 space-y-2"><Store className="w-10 h-10 text-gray-300 mx-auto" /><p className="text-gray-500 text-sm">No hay comercios para esta búsqueda</p></div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {visibleStores.map(store => (
                  <StoreCard key={store.id} store={store} onOpenStore={onOpenStore} hasServices={storesWithServices.has(store.slug)} ensureAbsoluteUrl={ensureAbsoluteUrl} />
                ))}
              </div>
            )}
          </section>

          {/* ── Ofertas ── */}
          {visibleOffers.length > 0 && (
            <section ref={mOffersRef}>
              <h2 className="text-[15px] font-bold mb-3" style={{ color: GREEN_DARK }}>Ofertas</h2>
              <div className="grid grid-cols-2 gap-3">
                {visibleOffers.slice(0, 12).map(p => <ProductCard key={p.id} product={p} onOpen={onOpenProduct} />)}
              </div>
            </section>
          )}

          {/* ── Novedades ── */}
          {visibleFeatured.length > 0 && (
            <section ref={mNewRef}>
              <h2 className="text-[15px] font-bold mb-3" style={{ color: GREEN_DARK }}>Novedades</h2>
              <div className="grid grid-cols-2 gap-3">
                {visibleFeatured.slice(0, 12).map(p => <ProductCard key={p.id} product={p} onOpen={onOpenProduct} />)}
              </div>
            </section>
          )}

          {/* ── Únete (banner simple, no 3 cards) ── */}
          <section className="rounded-2xl p-5 text-white" style={{ background: `linear-gradient(135deg, ${GREEN_DARK}, ${GREEN})` }}>
            <h3 className="font-bold text-base">¿Tienes un comercio?</h3>
            <p className="text-white/80 text-sm mt-1">Publica tu tienda y recibe pedidos online desde un solo panel.</p>
            <button onClick={onGoToLogin} className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold px-4 py-2.5 rounded-xl" style={{ background: GOLD, color: GOLD_TEXT }}>Registrar mi comercio <ArrowRight className="w-4 h-4" /></button>
          </section>
        </main>

        {/* ── Bottom nav flotante ── */}
        <nav className="fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur border-t border-gray-200" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="grid grid-cols-5">
            {navItemsM.map(it => {
              const active = mobileNavTab === it.key
              return (
                <button key={it.key} onClick={it.onClick} className="flex flex-col items-center gap-0.5 py-2 transition-colors" style={{ color: active ? GREEN : '#9aa0a8' }}>
                  {it.icon}
                  <span className="text-[10px] font-medium">{it.label}</span>
                </button>
              )
            })}
          </div>
        </nav>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 flex flex-col relative" style={brandVars}>
      {/* Salto al contenido (accesibilidad — visible solo con teclado) */}
      <a href="#contenido" className="skip-link">Saltar al contenido</a>
      {/* H1 único de la página (la marca + propuesta de valor). Los banners son imágenes,
          por eso el H1 va aquí de forma accesible para SEO y lectores de pantalla. */}
      <h1 className="sr-only">DAIMUZ — Marketplace de comercios locales: tiendas, ofertas y domicilios cerca de ti</h1>
      {/* Profundidad ambiental (en el verde/gold de la marca) — coherente con el sistema glass */}
      <div aria-hidden className="fixed inset-0 pointer-events-none" style={{ zIndex: 0, background: 'radial-gradient(1000px 560px at 6% -6%, rgba(0,131,62,0.07), transparent 60%), radial-gradient(900px 520px at 100% 2%, rgba(240,165,0,0.08), transparent 55%)' }} />
      {/* ══ CAPA 1: Top Info Bar — panel vivo de métricas del ecosistema ══ */}
      <div className="hidden sm:flex items-center justify-center h-[34px] shrink-0 overflow-hidden" style={{ background: GREEN_DARK }}>
        <div className="flex items-center gap-5 text-white/85 text-[11px] font-medium tracking-wide select-none">
          <span className="flex items-center gap-1.5"><Zap className="w-3 h-3 text-amber-300" /> <b className="text-white font-bold">{stores.length}</b> comercios activos</span>
          <span className="w-px h-3 bg-white/20" />
          <span className="flex items-center gap-1.5"><Tag className="w-3 h-3 text-amber-300" /> <b className="text-white font-bold">{offers.length}</b> ofertas hoy</span>
          <span className="w-px h-3 bg-white/20" />
          <span className="flex items-center gap-1.5"><Sparkles className="w-3 h-3 text-amber-300" /> IA disponible <b className="text-white font-bold">24/7</b></span>
          <span className="w-px h-3 bg-white/20" />
          <button onClick={onGoToLogin} aria-label="Ingresar a tu cuenta" className="flex items-center gap-1 font-semibold text-white/90 hover:text-white transition-colors">Ingresar <span aria-hidden>→</span></button>
        </div>
      </div>

      {/* ══ CAPA 2: Main Header (glassmorphism · sticky · morphing) ══ */}
      <header
        className="sticky top-0 z-40 transition-all duration-300"
        style={{
          height: scrolled ? '60px' : '72px',
          background: scrolled ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: scrolled ? '0 4px 24px rgba(0,0,0,0.10)' : '0 1px 0 rgba(0,0,0,0.07)',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center gap-3 sm:gap-4">
          {/* Logo — vuelve a Inicio */}
          <button onClick={goHome} className="flex items-center gap-2.5 shrink-0 group" title="Ir a inicio">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={brandLogo} alt={BRAND.name}
              className="object-contain rounded-xl transition-all duration-300 shrink-0"
              style={{ width: scrolled ? '34px' : '42px', height: scrolled ? '34px' : '42px' }}
            />
            <span
              className="font-extrabold tracking-tight hidden sm:block transition-all duration-300 group-hover:opacity-80"
              style={{ fontSize: scrolled ? '17px' : '20px', color: GREEN_DARK }}
            >
              {BRAND.name}
            </span>
          </button>

          {/* Categorías — mega-catálogo global de productos (izquierda) */}
          <div className="relative shrink-0 hidden md:block">
            <button
              onClick={() => setCatMenuOpen(v => !v)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-sm font-semibold border transition-all duration-200 hover:-translate-y-0.5"
              style={{ borderColor: 'rgba(0,0,0,0.12)', color: GREEN_DARK, background: catMenuOpen ? 'color-mix(in srgb, var(--brand-green,#00833E) 8%, white)' : '#fff' }}
            >
              <Menu className="w-4 h-4" /> Categorías
              <ChevronDown className={`w-3.5 h-3.5 opacity-60 transition-transform ${catMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {catMenuOpen && allCategories.length > 0 && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setCatMenuOpen(false)} />
                <div
                  className="absolute left-0 top-full mt-2 z-50 w-[min(94vw,900px)] max-h-[74vh] overflow-hidden rounded-2xl bg-white shadow-2xl border border-gray-100 flex"
                  onMouseLeave={() => setCatMenuOpen(false)}
                >
                  {/* Izquierda: lista de categorías */}
                  <div className="w-[42%] max-w-[320px] border-r border-gray-100 overflow-y-auto py-2">
                    {allCategories.map(c => {
                      const on = c.name === catActive
                      return (
                        <button
                          key={c.name}
                          onMouseEnter={() => setCatSel(c.name)}
                          onClick={() => { setQuery(c.name); setCatMenuOpen(false); setTimeout(scrollToGrid, 50) }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors"
                          style={on ? { background: 'color-mix(in srgb, var(--brand-green,#00833E) 8%, white)', color: GREEN_DARK, fontWeight: 600, boxShadow: `inset 3px 0 0 var(--brand-green,#00833E)` } : { color: '#374151' }}
                        >
                          <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--brand-green,#00833E) 12%, white)', color: GREEN_DARK }}><Tag className="w-3.5 h-3.5" /></span>
                          <span className="flex-1 min-w-0 truncate">{c.name}</span>
                          <span className="text-[10px] text-gray-400 shrink-0">{c.count}</span>
                          <ChevronRight className="w-3.5 h-3.5 opacity-40 shrink-0" />
                        </button>
                      )
                    })}
                  </div>
                  {/* Derecha: productos de la categoría activa */}
                  <div className="flex-1 overflow-y-auto p-4 min-w-0">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-extrabold text-gray-800 truncate">{catActive}</h3>
                      <button
                        onClick={() => { if (catActive) setQuery(catActive); setCatMenuOpen(false); setTimeout(scrollToGrid, 50) }}
                        className="text-xs font-bold underline underline-offset-2 shrink-0" style={{ color: GREEN_DARK }}
                      >Ver todo →</button>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-1.5">
                      {catProducts.map(p => (
                        <button
                          key={p.id}
                          onClick={() => { onOpenProduct(p); setCatMenuOpen(false) }}
                          className="flex items-center gap-2 p-2 rounded-xl hover:bg-gray-50 text-left transition-colors"
                        >
                          <span className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {p.imageUrl ? <img src={cldImg(p.imageUrl, 80)} alt="" className="w-full h-full object-cover" loading="lazy" /> : <Package className="w-4 h-4 text-gray-300" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-medium text-gray-800 truncate">{p.name}</span>
                            <span className="block text-[11px] font-bold" style={{ color: GREEN_DARK }}>{fmtCOP((p.isOnOffer && p.offerPrice) ? p.offerPrice : p.salePrice)}</span>
                          </span>
                        </button>
                      ))}
                      {catProducts.length === 0 && <p className="text-sm text-gray-400 col-span-full py-8 text-center">Sin productos en esta categoría.</p>}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Search — protagonista */}
          <div className="relative flex-1 max-w-2xl group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-green-600 transition-colors pointer-events-none" />
            <input
              type="search"
              aria-label="Buscar comercios y productos"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={SEARCH_HINTS[hintIdx]}
              className="w-full pl-10 pr-16 rounded-2xl border text-sm bg-gray-50/80 focus:bg-white focus:outline-none transition-all duration-200"
              style={{
                height: scrolled ? '38px' : '44px',
                borderColor: 'rgba(0,0,0,0.12)',
                boxShadow: 'none',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--brand-green, #00833E)'; e.currentTarget.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--brand-green,#00833E) 12%, transparent)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)'; e.currentTarget.style.boxShadow = 'none' }}
            />
            {/* AI badge dentro del buscador */}
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full pointer-events-none"
              style={{ background: 'color-mix(in srgb, var(--brand-green,#00833E) 10%, transparent)', color: 'var(--brand-green-dark,#005C2A)' }}>
              <Sparkles className="w-2.5 h-2.5" /> IA
            </span>
          </div>

          {/* Comercios — muestra/oculta la sección integrada del mapa */}
          <button
            onClick={() => {
              setShowStoresMap(v => {
                const next = !v
                if (next) setTimeout(() => storesSecRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
                return next
              })
            }}
            className="hidden lg:flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold shrink-0 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
            style={{
              background: `linear-gradient(135deg, var(--brand-green,#00833E), var(--brand-green-dark,#005C2A))`,
              color: '#fff',
              boxShadow: '0 4px 14px color-mix(in srgb, var(--brand-green,#00833E) 35%, transparent)',
            }}
          >
            <MapPin className="w-3.5 h-3.5" />
            Comercios
          </button>

          {/* Perfil */}
          <button
            onClick={onGoToLogin}
            title="Perfil"
            className="hidden sm:flex flex-col items-center justify-center px-2 shrink-0 transition-transform duration-200 hover:-translate-y-0.5"
            style={{ color: GREEN_DARK }}
          >
            <UserIcon className="w-5 h-5" />
            <span className="text-[10px] font-semibold mt-0.5 leading-none">Perfil</span>
          </button>

          {/* Carrito */}
          <button
            onClick={onGoToLogin}
            title="Carrito"
            aria-label="Carrito de compras"
            className="hidden sm:flex flex-col items-center justify-center px-2 shrink-0 transition-transform duration-200 hover:-translate-y-0.5"
            style={{ color: GREEN_DARK }}
          >
            <ShoppingCart className="w-5 h-5" aria-hidden />
            <span className="text-[10px] font-semibold mt-0.5 leading-none">$ 0.00</span>
          </button>

          {/* Mobile hamburger */}
          <button onClick={() => setMobileNav(v => !v)} className="sm:hidden p-2 rounded-xl border border-gray-200 text-gray-600" aria-label="Menú">
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ══ CAPA 3: Nav chips (glassmorphism · sticky bajo el header) ══ */}
      <nav
        className="sticky z-30 transition-all duration-300"
        style={{
          top: scrolled ? '60px' : '72px',
          background: 'rgba(255,255,255,0.80)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        }}
      >
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`${mobileNav ? 'flex' : 'hidden'} sm:flex flex-col sm:flex-row sm:flex-nowrap sm:items-center sm:overflow-x-auto scrollbar-hide gap-1.5 py-2`}>
            {/* Tabs de contenido como chips */}
            {navItems.filter(n => n.key !== 'comercios').map(item => {
              const active = tab === item.key
              return (
                <button
                  key={item.key}
                  onClick={() => { setTab(item.key as MainTab); setMobileNav(false); setTimeout(scrollToGrid, 50) }}
                  className="shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 text-left"
                  style={active
                    ? { background: `var(--brand-green,#00833E)`, color: '#fff', border: '1px solid transparent', boxShadow: '0 2px 8px rgba(0,131,62,0.25)' }
                    : { color: '#374151', background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.08)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                >
                  {item.label}
                </button>
              )
            })}

            {/* Categorías de negocios ACTIVOS (derivadas de las tiendas reales) —
                solo se muestran los rubros con comercios, evitando el doble renglón. */}
            {rubros.map(({ type }) => {
              const active = businessTypeFilter === type
              return (
                <button
                  key={type}
                  onClick={() => { pickRubro(type) }}
                  className="shrink-0 px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-all duration-200 hover:-translate-y-0.5 text-left"
                  style={active
                    ? { background: `var(--brand-green,#00833E)`, color: '#fff', border: '1px solid transparent', boxShadow: '0 2px 8px rgba(0,131,62,0.25)' }
                    : { color: '#374151', background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.08)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                >
                  {type}
                </button>
              )
            })}

            {/* Contacto */}
            <a
              href={waHref || '#contacto'}
              {...(waHref ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              aria-label={waHref ? 'Contactar por WhatsApp' : 'Ir a contacto'}
              className="shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 hover:-translate-y-0.5"
              style={{ color: '#374151', background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.08)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
            >
              Contacto
            </a>
          </div>
        </div>
      </nav>

      {/* ══ Banner de bienvenida (activable + editable desde superadmin) ══ */}
      {welcomeEnabled && alertOpen && (() => {
        const wTitle = (welcomeTitle && welcomeTitle.trim()) || heroTitle || `Bienvenido a ${BRAND.name}`
        const wSub = (welcomeSubtitle && welcomeSubtitle.trim()) || 'Descubre los comercios locales y sus productos'
        return (
          <div className="relative w-full flex justify-center py-2.5 px-10">
            {/* Desktop: marco animado (Uiverse). Móvil: banner limpio sin recorte de texto. */}
            <div className="hidden sm:block">
              <DaimuzWelcomeFrame text1={wTitle} text2={wSub} />
            </div>
            <div className="sm:hidden w-full max-w-sm text-center rounded-xl border border-gray-200 bg-white/80 backdrop-blur px-4 py-2">
              <p className="text-sm font-extrabold leading-tight" style={{ color: GREEN_DARK }}>{wTitle}</p>
              {wSub && <p className="text-[11px] text-gray-500 leading-snug mt-0.5">{wSub}</p>}
            </div>
            <button onClick={() => setAlertOpen(false)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700 rounded" aria-label="Cerrar"><X className="w-4 h-4" /></button>
          </div>
        )
      })()}

      {/* ══ Contenido ══ */}
      <main id="contenido" className="flex-1">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 space-y-7">

          {/* ══ Sección "Comercios" — mapa interactivo integrado (botón "Comercios") ══ */}
          {showStoresMap && (
            <section ref={storesSecRef} className="scroll-mt-28">
              <StoresSection
                inline
                stores={stores.map(s => ({ id: s.id, name: s.name, slug: s.slug, logoUrl: s.logoUrl, city: s.city, address: s.address, department: s.department, schedule: s.schedule, openState: s.openState, nextOpenLabel: s.nextOpenLabel, latitude: s.latitude, longitude: s.longitude }))}
                brandColor={GREEN}
                brandDark={GREEN_DARK}
                onClose={() => setShowStoresMap(false)}
                onOpenStore={(slug) => { const st = stores.find(x => x.slug === slug); if (st) onOpenStore(st as any) }}
              />
            </section>
          )}

          {/* Hero — banner en primer plano; el panel destacado (der.) es opcional (ajuste del superadmin) */}
          <section className={`grid grid-cols-1 ${showFeatured ? splitClass : ''} gap-4`}>
            {/* Columna izquierda */}
            <div className="min-w-0">
              {heroSlides.filter(s => s.url).length > 0 ? (
                <HomeHeroCarousel slides={heroSlides} intervalMs={heroIntervalMs ?? 4000} />
              ) : (
                <section className="relative rounded-xl overflow-hidden p-8 sm:p-12 text-white h-full min-h-[240px] flex flex-col justify-center" style={{ background: `linear-gradient(120deg, ${GREEN_DARK}, ${GREEN})` }}>
                  <h2 className="text-2xl sm:text-4xl font-extrabold max-w-2xl">{heroTitle || 'Tu marketplace de comercios locales'}</h2>
                  <p className="mt-2 text-white/85 max-w-xl">{heroSubtitle || 'Explora tiendas, ofertas y novedades en un solo lugar.'}</p>
                </section>
              )}
            </div>

            {/* Columna derecha — panel destacado (opcional): producto / comercio / cta */}
            {showFeatured && (
            <aside className="flex flex-col gap-4">
              {heroRight === 'comercio' && topStore ? (
                <button onClick={() => onOpenStore(topStore)} className="group relative rounded-xl overflow-hidden text-left flex-1 min-h-[160px] bg-gray-900">
                  {(topStore.coverUrl || topStore.logoUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cldImg((topStore.coverUrl || topStore.logoUrl) as string, 500)} loading="lazy" decoding="async" alt={topStore.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="absolute inset-0" style={{ background: `linear-gradient(120deg, ${GREEN_DARK}, ${GREEN})` }} />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <span className="absolute top-3 left-3 text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: GOLD, color: GOLD_TEXT }}>COMERCIO DESTACADO</span>
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <div className="flex items-center gap-1.5">
                      <p className="text-white font-semibold text-base line-clamp-1">{topStore.name}</p>
                      {Boolean(topStore.isVerified) && (
                        <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" role="img" aria-label="Verificado"><path fill="#3b82f6" d="M12 1l2.4 1.8 3 .2.9 2.9 2.4 1.8-.9 2.9.9 2.9-2.4 1.8-.9 2.9-3 .2L12 23l-2.4-1.8-3-.2-.9-2.9L3.3 16l.9-2.9-.9-2.9 2.4-1.8.9-2.9 3-.2z"/><path fill="#fff" d="M10.6 14.6l-2.2-2.2-1.1 1.1 3.3 3.3 6-6-1.1-1.1z"/></svg>
                      )}
                    </div>
                    {(topStore.cardDescription || topStore.businessType) && <p className="text-white/70 text-[11px] line-clamp-1">{topStore.cardDescription || topStore.businessType}</p>}
                    <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full" style={{ background: GOLD, color: GOLD_TEXT }}>Ver comercio <ArrowRight className="w-3.5 h-3.5" /></span>
                  </div>
                </button>
              ) : heroRight === 'cta' || !topFeatured ? (
                <div className="rounded-xl p-5 text-white flex-1 flex flex-col justify-center" style={{ background: `linear-gradient(120deg, ${GREEN_DARK}, ${GREEN})` }}>
                  <h3 className="font-bold text-lg">{heroTitle || '¿Tienes un comercio?'}</h3>
                  <p className="text-white/80 text-sm mt-1">{heroSubtitle || 'Publica tus productos y llega a más clientes.'}</p>
                  <FlameButton onClick={onGoToLogin} className="mt-7 self-start">Empezar</FlameButton>
                </div>
              ) : (
                <button onClick={() => topFeatured && onOpenProduct(topFeatured)} className="group relative rounded-xl overflow-hidden text-left flex-1 min-h-[160px] bg-gray-900">
                  {topFeatured!.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={topFeatured!.imageUrl} alt={topFeatured!.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="absolute inset-0" style={{ background: `linear-gradient(120deg, ${GREEN_DARK}, ${GREEN})` }} />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <span className="absolute top-3 left-3 text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: GOLD, color: GOLD_TEXT }}>DESTACADO</span>
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <p className="text-white font-semibold text-sm line-clamp-2">{topFeatured!.name}</p>
                    {topFeatured!.storeName && <p className="text-white/70 text-[11px] uppercase tracking-wide">{topFeatured!.storeName}</p>}
                    <p className="text-white font-bold mt-1">{fmtCOP(topFeatured!.offerPrice || topFeatured!.salePrice)}</p>
                  </div>
                </button>
              )}
              {/* CTA secundario */}
              <button onClick={onGoToLogin} className="rounded-xl border border-gray-200 bg-white p-4 text-left hover:shadow-md transition-shadow flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold" style={{ color: GREEN_DARK }}>Únete a {BRAND.name}</p>
                  <p className="text-[11px] text-gray-500">{stats.comercios} comercios · {stats.ofertas} ofertas</p>
                </div>
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-white shrink-0" style={{ background: GOLD }}><ArrowRight className="w-4 h-4" /></span>
              </button>
            </aside>
            )}
          </section>

          {/* ── Franja de confianza — señales reales (verificados, ofertas), sin testimonios inventados ── */}
          <section aria-label="Por qué comprar en DAIMUZ" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { icon: <ShieldCheck className="w-5 h-5" aria-hidden />, title: 'Comercios verificados', desc: `${stats.verificados} con sello de confianza` },
              { icon: <Truck className="w-5 h-5" aria-hidden />, title: 'Domicilios locales', desc: 'Entregas en tu ciudad' },
              { icon: <Sparkles className="w-5 h-5" aria-hidden />, title: 'Asistente con IA 24/7', desc: 'Resuelve y compra al instante' },
              { icon: <Tag className="w-5 h-5" aria-hidden />, title: 'Ofertas cada día', desc: `${stats.ofertas} activas hoy` },
            ].map((f) => (
              <div key={f.title} className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white/80 backdrop-blur px-4 py-3 transition-shadow hover:shadow-sm">
                <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#EAF3DE', color: GREEN_DARK }}>{f.icon}</span>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-gray-800 leading-tight truncate">{f.title}</p>
                  <p className="text-[11px] text-gray-500 leading-tight truncate">{f.desc}</p>
                </div>
              </div>
            ))}
          </section>

          {/* Carrusel de tarjetas (productos + accesos institucionales) */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: GREEN_DARK }}>Para ti</h2>
              <div className="hidden sm:flex items-center gap-1.5">
                <button onClick={() => accesosRef.current?.scrollBy({ left: -360, behavior: 'smooth' })} className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100" aria-label="Anterior"><ChevronLeft className="w-4 h-4" /></button>
                <button onClick={() => accesosRef.current?.scrollBy({ left: 360, behavior: 'smooth' })} className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100" aria-label="Siguiente"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
            <div ref={accesosRef} className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth snap-x pb-1 -mx-1 px-1">
              {renderedCards.map((c, i) => {
                if (c.kind === 'product') {
                  const product = c.product
                  const isOffer = !!(product.isOnOffer && product.offerPrice)
                  const disc = isOffer ? Math.round(((product.salePrice - (product.offerPrice as number)) / product.salePrice) * 100) : 0
                  return (
                    <button key={`p-${i}-${product.id}`} onClick={() => onOpenProduct(product)} className="snap-start shrink-0 w-44 sm:w-52 bg-white rounded-2xl border border-gray-200 hover:shadow-lg hover:border-gray-300 transition-all p-3 text-left flex flex-col">
                      <span className="self-start text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-2" style={{ background: '#EAF3DE', color: GREEN_DARK }}>{c.label}</span>
                      <div className="relative aspect-square bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center mb-2.5">
                        {product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={product.imageUrl} alt={product.name} loading="lazy" decoding="async" className="w-full h-full object-contain p-1" />
                        ) : <Package className="w-8 h-8 text-gray-300" />}
                        {isOffer && (
                          <span className="absolute top-1.5 right-1.5 text-[10px] font-extrabold px-1.5 py-0.5 rounded-md text-white shadow-sm" style={{ background: GREEN }}>-{disc}%</span>
                        )}
                      </div>
                      <p className="text-[13px] font-semibold text-gray-800 line-clamp-2 leading-snug min-h-[34px]">{product.name}</p>
                      <div className="mt-auto pt-2">
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                          <span className="text-base font-extrabold text-gray-900">{fmtCOP(isOffer ? (product.offerPrice as number) : product.salePrice)}</span>
                          {isOffer && <span className="text-[11px] text-gray-400 line-through">{fmtCOP(product.salePrice)}</span>}
                        </div>
                        <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold" style={{ color: GREEN }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: GREEN }} /> Disponible
                        </span>
                      </div>
                    </button>
                  )
                }
                const meta: Record<string, { desc: string; cta: string; icon: ReactNode; onClick: () => void }> = {
                  accion_comercios: { desc: 'Explora todas las tiendas locales.', cta: 'Ver comercios', icon: <Store className="w-7 h-7" />, onClick: () => { onSelectBusinessType('all'); setTab('comercios'); setTimeout(scrollToGrid, 50) } },
                  accion_ofertas: { desc: 'Productos con descuento hoy.', cta: 'Ver ofertas', icon: <Tag className="w-7 h-7" />, onClick: () => { setTab('ofertas'); setTimeout(scrollToGrid, 50) } },
                  accion_novedades: { desc: 'Lo más reciente del marketplace.', cta: 'Explorar', icon: <Sparkles className="w-7 h-7" />, onClick: () => { setTab('novedades'); setTimeout(scrollToGrid, 50) } },
                }
                const m = meta[c.key] || { desc: '', cta: 'Ver', icon: <Store className="w-7 h-7" />, onClick: () => setTimeout(scrollToGrid, 50) }
                return (
                  <div key={`a-${i}-${c.key}`} className="snap-start shrink-0 w-44 sm:w-52 bg-white rounded-2xl border border-gray-200 hover:shadow-lg hover:border-gray-300 transition-all p-3 flex flex-col items-center text-center">
                    <span className="self-start text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-2" style={{ background: '#EAF3DE', color: GREEN_DARK }}>{c.label}</span>
                    <span className="w-16 h-16 rounded-full flex items-center justify-center my-3" style={{ background: '#EAF3DE', color: GREEN }}>{m.icon}</span>
                    <p className="text-xs text-gray-500 leading-snug mb-4 px-1">{m.desc}</p>
                    <button onClick={m.onClick} className="mt-auto w-full py-2 rounded-lg text-xs font-semibold border transition-colors" style={{ borderColor: GREEN, color: GREEN }} onMouseEnter={e => { e.currentTarget.style.background = GREEN; e.currentTarget.style.color = '#fff' }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = GREEN }}>
                      {m.cta}
                    </button>
                  </div>
                )
              })}
            </div>
          </section>

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
                  {/* Chips de rubro */}
                  {rubros.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 mb-3 -mx-1 px-1">
                      <button onClick={() => onSelectBusinessType('all')} className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors" style={businessTypeFilter === 'all' ? { background: GREEN, color: '#fff', borderColor: GREEN } : { color: '#4b5563', borderColor: '#d1d5db' }}>Todos</button>
                      {rubros.map(({ type, count }) => {
                        const selected = businessTypeFilter === type
                        return (
                          <button key={type} onClick={() => onSelectBusinessType(type)} className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap capitalize transition-colors" style={selected ? { background: GREEN, color: '#fff', borderColor: GREEN } : { color: '#4b5563', borderColor: '#d1d5db' }}>
                            {type} <span className={selected ? 'text-white/70' : 'text-gray-400'}>({count})</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
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
                      <p className="text-xl font-extrabold" style={{ color: GREEN }}>{s.value.toLocaleString('es-CO')}</p>
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
                <p className="text-xs text-white/80 mb-3">Publica tus productos y llega a más clientes en {BRAND.name}.</p>
                <button onClick={onGoToLogin} className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg text-gray-900" style={{ background: GOLD }}>
                  Empezar <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </aside>
          </div>

          {/* ══ Únete a DAIMUZ — propuesta de valor para los 3 públicos ══ */}
          <section className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
            <div className="px-5 sm:px-8 pt-6 pb-1 text-center">
              <p className="text-[10px] uppercase tracking-[0.3em] font-semibold" style={{ color: GREEN }}>Haz parte de la comunidad</p>
              <h2 className="text-2xl sm:text-3xl font-extrabold mt-1" style={{ color: GREEN_DARK }}>Únete a {BRAND.name}</h2>
              <p className="text-sm text-gray-500 mt-1 max-w-xl mx-auto">Una sola plataforma, tres formas de ganar: compra local, vende más o gana promocionando.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 sm:p-8">
              {/* Cliente */}
              <div className="rounded-xl border border-gray-200 bg-white p-5 flex flex-col">
                <span className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ background: '#EAF3DE', color: GREEN }}><ShoppingBag className="w-6 h-6" /></span>
                <h3 className="font-bold text-gray-900">Soy cliente</h3>
                <p className="text-sm text-gray-500 mt-1 flex-1">Descubre comercios y productos de tu ciudad, pide a domicilio y aprovecha ofertas exclusivas.</p>
                <ul className="text-[12px] text-gray-600 space-y-1 my-3">
                  <li className="flex gap-2"><span style={{ color: GREEN }}>✓</span> Ofertas y novedades cada día</li>
                  <li className="flex gap-2"><span style={{ color: GREEN }}>✓</span> Pide por WhatsApp o domicilio</li>
                  <li className="flex gap-2"><span style={{ color: GREEN }}>✓</span> Acumula puntos de fidelidad</li>
                </ul>
                <button onClick={() => { onSelectBusinessType('all'); setTab('comercios'); setTimeout(scrollToGrid, 50) }} className="mt-auto w-full py-2.5 rounded-lg text-sm font-semibold border transition-colors hover:bg-[#EAF3DE]" style={{ borderColor: GREEN, color: GREEN }}>Explorar comercios</button>
              </div>
              {/* Comerciante — destacada */}
              <div className="rounded-xl p-5 flex flex-col text-white relative overflow-hidden" style={{ background: `linear-gradient(150deg, ${GREEN_DARK}, ${GREEN})` }}>
                <span className="absolute top-3 right-3 text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: GOLD, color: GOLD_TEXT }}>MÁS POPULAR</span>
                <span className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 bg-white/15"><Store className="w-6 h-6" /></span>
                <h3 className="font-bold">Tengo un comercio</h3>
                <p className="text-sm text-white/80 mt-1 flex-1">Publica tu tienda, recibe pedidos online y gestiona ventas, inventario y domicilios desde un solo panel.</p>
                <ul className="text-[12px] text-white/90 space-y-1 my-3">
                  <li className="flex gap-2">✓ Tienda y catálogo online</li>
                  <li className="flex gap-2">✓ Pedidos, POS e inventario</li>
                  <li className="flex gap-2">✓ Promotores que te traen clientes</li>
                </ul>
                <button onClick={onGoToLogin} className="mt-auto w-full py-2.5 rounded-lg text-sm font-bold text-gray-900" style={{ background: GOLD }}>Registrar mi comercio</button>
              </div>
              {/* Promotor */}
              <div className="rounded-xl border border-gray-200 bg-white p-5 flex flex-col">
                <span className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ background: '#FFF4D6', color: '#B8860B' }}><TrendingUp className="w-6 h-6" /></span>
                <h3 className="font-bold text-gray-900">Quiero ser promotor</h3>
                <p className="text-sm text-gray-500 mt-1 flex-1">Promociona comercios y eventos en tus redes y gana comisiones por cada venta o por paquetes de contenido.</p>
                <ul className="text-[12px] text-gray-600 space-y-1 my-3">
                  <li className="flex gap-2"><span style={{ color: GREEN }}>✓</span> Comisión por cada venta atribuida</li>
                  <li className="flex gap-2"><span style={{ color: GREEN }}>✓</span> Pago inmediato por paquetes</li>
                  <li className="flex gap-2"><span style={{ color: GREEN }}>✓</span> Niveles, misiones y ranking</li>
                </ul>
                <button onClick={onGoToLogin} className="mt-auto w-full py-2.5 rounded-lg text-sm font-semibold border transition-colors hover:bg-[#EAF3DE]" style={{ borderColor: GREEN, color: GREEN }}>Ser promotor</button>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* ══ Footer ══ */}
      <footer id="contacto" className="text-white mt-6" style={{ background: GREEN_DARK }}>
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={brandLogo} alt={BRAND.name} className="w-8 h-8 object-contain rounded-lg" />
              <span className="text-lg font-extrabold">{BRAND.name}</span>
            </div>
            <p className="text-sm text-white/70">Marketplace de comercios locales. Encuentra tiendas, productos y ofertas cerca de ti.</p>
            <div className="flex items-center gap-2 mt-4">
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook de DAIMUZ" className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"><Facebook className="w-4 h-4" aria-hidden /></a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram de DAIMUZ" className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"><Instagram className="w-4 h-4" aria-hidden /></a>
              {waHref && (
                <a href={waHref} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp de DAIMUZ" className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"><Phone className="w-4 h-4" aria-hidden /></a>
              )}
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
              <li><a href={waHref || '#contacto'} {...(waHref ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className="hover:text-white">Contacto</a></li>
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
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/60">
            <p>© {new Date().getFullYear()} {BRAND.name}. Todos los derechos reservados.</p>
            <div className="flex items-center gap-4">
              {/* Antes eran href="#" — no llevaban a ninguna parte. */}
              <button onClick={() => setLegalDoc('terminos')} className="hover:text-white">Términos</button>
              <button onClick={() => setLegalDoc('privacidad')} className="hover:text-white">Privacidad</button>
            </div>
          </div>
        </div>
      </footer>

      {/* Términos y Privacidad: antes eran enlaces muertos (href="#") */}
      {legalDoc && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setLegalDoc(null)} />
          <div className="relative bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 h-14 border-b border-gray-100 shrink-0">
              <h3 className="text-sm font-semibold text-gray-900">
                {legalDoc === 'terminos' ? 'Términos y condiciones' : 'Política de privacidad'}
              </h3>
              <button onClick={() => setLegalDoc(null)} aria-label="Cerrar" className="text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4">
              <pre className="whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-gray-600">
                {fillTemplate(legalDoc === 'terminos' ? DEFAULT_TERMS : DEFAULT_PRIVACY_POLICY, { storeName: BRAND.name })}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
