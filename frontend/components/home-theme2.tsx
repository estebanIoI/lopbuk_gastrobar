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

import { useEffect, useMemo, useRef, useState, type ReactNode, type CSSProperties } from 'react'
import { BRAND } from '@/lib/brand'
import { DaimuzWelcomeFrame } from '@/components/daimuz-welcome-frame'
import { FlameButton } from '@/components/ui/flame-button'
import {
  ChevronLeft, ChevronRight, Store, UtensilsCrossed, Zap, Tag, Package,
  Sparkles, ShoppingBag, Pill, Apple, Wrench, Scissors, Dog, Wine,
  Croissant, Coffee, Shirt, Gem, Flower2, ArrowRight, Search,
  ChevronDown, MapPin, Flame, Bell, Facebook, Instagram, Phone,
  Mail, TrendingUp, X, Menu,
} from 'lucide-react'

// ── Paleta institucional ────────────────────────────────────────────────────
// Colores de marca como variables CSS con fallback al verde DAIMUZ.
// Cuando el superadmin genera una colorimetría, se inyectan --brand-green /
// --brand-green-dark en la raíz del home y TODO se tiñe automáticamente
// (los estilos inline las resuelven en tiempo de render).
const GREEN = 'var(--brand-green, #00833E)'
const GREEN_DARK = 'var(--brand-green-dark, #005C2A)'
// El acento "destacado" sigue la paleta: cuando el superadmin genera/edita una
// colorimetría se inyecta --brand-gold (y su color de texto legible). Sin paleta,
// cae al dorado DAIMUZ por defecto.
const GOLD = 'var(--brand-gold, #F0A500)'
const GOLD_TEXT = 'var(--brand-gold-text, #111827)'

function hexToRgb(hex?: string | null): [number, number, number] | null {
  if (!hex || typeof hex !== 'string') return null
  const m = hex.replace('#', '')
  const h = m.length === 3 ? m.split('').map(c => c + c).join('') : m
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return [r, g, b].some(Number.isNaN) ? null : [r, g, b]
}

/** Devuelve '#fff' o '#111827' según el contraste sobre un color hex. */
function readableOn(hex?: string | null): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return '#111827'
  const L = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255
  return L > 0.6 ? '#111827' : '#ffffff'
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
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
function hslToHex(h: number, s: number, l: number): string {
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
function complementaryAccent(hex?: string | null): string | null {
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

const PRODUCT_CARD_KEYS = new Set(['novedades', 'ofertas', 'recomendado', 'tendencia'])

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
}

// ── Iconos por rubro ────────────────────────────────────────────────────────────
const RUBRO_ICONS: Record<string, ReactNode> = {
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

const rubroIcon = (type: string): ReactNode =>
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
  const activeSlide = valid[index] || valid[0]

  return (
    <section
      className="relative w-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-label="Carrusel principal"
    >
      {/* Móvil: la altura del contenedor = altura natural de la imagen (sin franjas arriba/abajo).
          Desktop: altura fija a sangre (object-cover). */}
      <div className="relative w-full overflow-hidden bg-gray-100 sm:bg-black rounded-xl sm:h-[clamp(260px,38vw,460px)]">
        {activeSlide && activeSlide.type !== 'video' ? (
          // Sizer invisible solo en móvil: define la altura exacta de la imagen activa.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={activeSlide.url} alt="" aria-hidden="true" className="block w-full h-auto sm:hidden invisible select-none pointer-events-none" />
        ) : (
          <div className="w-full aspect-video sm:hidden" />
        )}
        {valid.map((slide, i) => {
          const active = i === index
          // En móvil el contenedor ENVUELVE la imagen (object-contain, no la corta), como el tema 1
          // de las tiendas; en escritorio se mantiene a sangre (object-cover).
          const media = slide.type === 'video' ? (
            <video src={slide.url} autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-contain sm:object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={slide.url} alt={slide.title || `Banner ${i + 1}`} className="absolute inset-0 w-full h-full object-contain sm:object-cover" loading={i === 0 ? 'eager' : 'lazy'} />
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
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
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
  const isExternal = !!store.externalUrl
  const isEmpty = !isExternal && store.productCount === 0
  return (
    <button
      onClick={() => { if (isExternal || !isEmpty) onOpenStore(store) }}
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
          <div className="w-full h-full flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={BRAND.isotipo} alt={BRAND.name} className="w-16 h-16 object-contain opacity-30" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#171717] to-transparent pointer-events-none" />
        {isExternal ? (
          <span className="absolute top-2.5 right-2.5 flex items-center gap-1 text-[9px] sm:text-[10px] font-bold px-2 py-1 rounded-full backdrop-blur-sm bg-violet-500/20 text-violet-200 border border-violet-400/50">
            VISITAR ↗
          </span>
        ) : !isEmpty && (
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
            // eslint-disable-next-line @next/next/no-img-element
            <img src={BRAND.isotipo} alt={BRAND.name} className="w-full h-full object-contain p-1.5" />
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
          <p className="text-[11px] text-gray-300 mt-0.5 truncate">🕒 {store.nextOpenLabel}</p>
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
          <div className="w-full h-full flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={BRAND.isotipo} alt={BRAND.name} className="w-12 h-12 object-contain opacity-40" />
          </div>
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
  heroSplit = '60-40',
  heroRight = 'producto',
  promoConfig,
  welcomeEnabled = true,
  welcomeTitle,
  welcomeSubtitle,
  brandLogo = BRAND.icon,
  themeColors,
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
  /** Proporción del hero: '70-30' | '60-40' | '50-50' */
  heroSplit?: string
  /** Contenido del panel derecho: 'producto' | 'comercio' | 'cta' */
  heroRight?: string
  /** Tarjetas del carrusel "Para ti" (orden + tipo + etiqueta). Si no se pasa, usa el set por defecto. */
  promoConfig?: PromoCardConfig[]
  /** Barra de bienvenida (activable + contenido editable desde superadmin). */
  welcomeEnabled?: boolean
  welcomeTitle?: string
  welcomeSubtitle?: string
  /** Logo de la plataforma (configurable desde superadmin). */
  brandLogo?: string
  /** Paleta de marca generada por IA (superadmin). Tiñe todo el home. */
  themeColors?: { primary?: string; primary_hover?: string; secondary?: string } | null
}) {
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<MainTab>('comercios')
  const [megaOpen, setMegaOpen] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [alertOpen, setAlertOpen] = useState(true)
  const gridRef = useRef<HTMLDivElement>(null)
  const accesosRef = useRef<HTMLDivElement>(null)

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

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 flex flex-col" style={brandVars}>
      {/* ══ Header ══ */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3 sm:gap-5">
          <button onClick={scrollToGrid} className="flex items-center gap-2 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={brandLogo} alt={BRAND.name} className="w-9 h-9 object-contain rounded-lg shrink-0" />
            <span className="text-lg sm:text-xl font-extrabold tracking-tight" style={{ color: GREEN_DARK }}>{BRAND.name}</span>
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

          <span className="hidden sm:block shrink-0 pt-3">
            <FlameButton onClick={onGoToLogin}>Acceder</FlameButton>
          </span>
          <button onClick={() => setMobileNav(v => !v)} className="sm:hidden p-2 rounded-lg border border-gray-300 text-gray-600" aria-label="Menú">
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ══ Navbar verde ══ */}
      <nav className="text-white sticky top-[57px] z-30 shadow-sm" style={{ background: GREEN }}>
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
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
      <main className="flex-1">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 space-y-7">

          {/* Hero — split configurable: editorial/carrusel (izq) + panel (der) */}
          <section className={`grid grid-cols-1 ${splitClass} gap-4`}>
            {/* Columna izquierda */}
            <div className="min-w-0">
              {heroSlides.filter(s => s.url).length > 0 ? (
                <HomeHeroCarousel slides={heroSlides} intervalMs={4000} />
              ) : (
                <section className="relative rounded-xl overflow-hidden p-8 sm:p-12 text-white h-full min-h-[240px] flex flex-col justify-center" style={{ background: `linear-gradient(120deg, ${GREEN_DARK}, ${GREEN})` }}>
                  <h1 className="text-2xl sm:text-4xl font-extrabold max-w-2xl">{heroTitle || 'Tu marketplace de comercios locales'}</h1>
                  <p className="mt-2 text-white/85 max-w-xl">{heroSubtitle || 'Explora tiendas, ofertas y novedades en un solo lugar.'}</p>
                </section>
              )}
            </div>

            {/* Columna derecha — según configuración (producto / comercio / cta) */}
            <aside className="flex flex-col gap-4">
              {heroRight === 'comercio' && topStore ? (
                <button onClick={() => onOpenStore(topStore)} className="group relative rounded-xl overflow-hidden text-left flex-1 min-h-[160px] bg-gray-900">
                  {(topStore.coverUrl || topStore.logoUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ensureAbsoluteUrl((topStore.coverUrl || topStore.logoUrl) as string)} alt={topStore.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
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
                          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain p-1" />
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
      <footer className="text-white mt-6" style={{ background: GREEN_DARK }}>
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={brandLogo} alt={BRAND.name} className="w-8 h-8 object-contain rounded-lg" />
              <span className="text-lg font-extrabold">{BRAND.name}</span>
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
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/60">
            <p>© {new Date().getFullYear()} {BRAND.name}. Todos los derechos reservados.</p>
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
