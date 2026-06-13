'use client'

/**
 * ============================================================================
 *  TEMA 2 — Página de Inicio (Marketplace) · estilo Mercado Libre
 * ============================================================================
 *  Componentes presentacionales puros usados por landing-page.tsx cuando el
 *  superadmin activa `home_theme = 'theme2'`. NO contienen lógica de negocio:
 *  reciben datos + callbacks por props.
 *
 *  - HomeHeroCarousel : carrusel de banners / GIF / video (Hero 1).
 *  - HomeCategoryRail : barra superior de rubros + grid de categorías.
 *
 *  Las tarjetas de presentación de los comercios NO se tocan: siguen
 *  renderizándose en landing-page.tsx tal cual.
 * ============================================================================
 */

import { useEffect, useRef, useState } from 'react'
import {
  ChevronLeft, ChevronRight, Store, UtensilsCrossed, Zap, Tag, Package,
  Sparkles, ShoppingBag, Pill, Apple, Wrench, Scissors, Dog, Wine,
  Croissant, Coffee, Shirt, Gem, Flower2, ArrowRight,
} from 'lucide-react'

// ── Tipos compartidos ───────────────────────────────────────────────────────
export interface HeroSlide {
  id: string
  type: 'image' | 'video'
  url: string
  link?: string
  title?: string
  subtitle?: string
}

export interface RubroCategory {
  type: string          // valor real del businessType (o 'General')
  count: number         // nº de comercios
}

// ── Mapa de íconos por rubro ──────────────────────────────────────────────────
const RUBRO_ICONS: Record<string, React.ReactNode> = {
  restaurante: <UtensilsCrossed className="w-full h-full" />,
  comida: <UtensilsCrossed className="w-full h-full" />,
  gastrobar: <UtensilsCrossed className="w-full h-full" />,
  tecnologia: <Zap className="w-full h-full" />,
  'tecnología': <Zap className="w-full h-full" />,
  ropa: <Shirt className="w-full h-full" />,
  moda: <Shirt className="w-full h-full" />,
  drogueria: <Pill className="w-full h-full" />,
  'droguería': <Pill className="w-full h-full" />,
  farmacia: <Pill className="w-full h-full" />,
  fruver: <Apple className="w-full h-full" />,
  supermercado: <ShoppingBag className="w-full h-full" />,
  ferreteria: <Wrench className="w-full h-full" />,
  'ferretería': <Wrench className="w-full h-full" />,
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

// Gradientes que rotan para los tiles de rubro
const RUBRO_GRADIENTS = [
  'from-rose-500 to-orange-500',
  'from-indigo-500 to-violet-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-yellow-500',
  'from-sky-500 to-blue-500',
  'from-fuchsia-500 to-pink-500',
  'from-lime-500 to-green-500',
  'from-cyan-500 to-sky-500',
]

const rubroIcon = (type: string): React.ReactNode =>
  RUBRO_ICONS[type.toLowerCase()] ?? <Store className="w-full h-full" />

// ════════════════════════════════════════════════════════════════════════════
//  HERO CAROUSEL
// ════════════════════════════════════════════════════════════════════════════
export function HomeHeroCarousel({
  slides,
  isMobile = false,
}: {
  slides: HeroSlide[]
  isMobile?: boolean
}) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const valid = (slides || []).filter(s => s && s.url)

  // Auto-avance cada 5.5s (se pausa al pasar el cursor)
  useEffect(() => {
    if (paused || valid.length <= 1) return
    const id = setInterval(() => setIndex(i => (i + 1) % valid.length), 5500)
    return () => clearInterval(id)
  }, [paused, valid.length])

  // Si cambia el set de slides, asegura índice válido
  useEffect(() => {
    if (index >= valid.length) setIndex(0)
  }, [valid.length, index])

  if (valid.length === 0) return null

  const go = (dir: number) =>
    setIndex(i => (i + dir + valid.length) % valid.length)

  const heightClass = isMobile
    ? 'h-[44vw] max-h-[260px] min-h-[170px]'
    : 'h-[clamp(280px,42vw,560px)]'

  return (
    <section
      className={`relative w-full ${isMobile ? '' : 'px-3 sm:px-4 pt-3'}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-label="Carrusel principal"
    >
      <div
        data-dark
        className={`relative w-full overflow-hidden bg-black ${heightClass} ${isMobile ? '' : 'rounded-2xl'}`}
      >
        {/* Slides */}
        {valid.map((slide, i) => {
          const active = i === index
          const media =
            slide.type === 'video' ? (
              <video
                src={slide.url}
                autoPlay
                muted
                loop
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={slide.url}
                alt={slide.title || `Banner ${i + 1}`}
                className="absolute inset-0 w-full h-full object-cover"
                loading={i === 0 ? 'eager' : 'lazy'}
              />
            )

          const overlay = (slide.title || slide.subtitle) && (
            <>
              <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/20 to-transparent pointer-events-none" />
              <div className="absolute inset-0 flex flex-col justify-center px-6 sm:px-12 max-w-2xl pointer-events-none">
                {slide.title && (
                  <h2 className="text-white text-xl sm:text-3xl md:text-5xl font-bold tracking-tight drop-shadow-lg leading-tight">
                    {slide.title}
                  </h2>
                )}
                {slide.subtitle && (
                  <p className="text-white/80 text-sm sm:text-lg mt-2 sm:mt-3 font-light drop-shadow-md max-w-lg">
                    {slide.subtitle}
                  </p>
                )}
                {slide.link && (
                  <span className="mt-4 inline-flex items-center gap-1.5 self-start bg-white text-black text-xs sm:text-sm font-semibold px-4 py-2 rounded-full pointer-events-none">
                    Ver más <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
            </>
          )

          const inner = (
            <div
              className={`absolute inset-0 transition-opacity duration-700 ease-out ${active ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
              aria-hidden={!active}
            >
              {media}
              {overlay}
            </div>
          )

          return slide.link ? (
            <a
              key={slide.id || i}
              href={slide.link}
              target={slide.link.startsWith('http') ? '_blank' : undefined}
              rel="noopener noreferrer"
              className={active ? 'block cursor-pointer' : 'pointer-events-none'}
            >
              {inner}
            </a>
          ) : (
            <div key={slide.id || i}>{inner}</div>
          )
        })}

        {/* Flechas */}
        {valid.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Anterior"
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-black/45 hover:bg-black/70 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Siguiente"
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-black/45 hover:bg-black/70 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Indicadores (dots) */}
        {valid.length > 1 && (
          <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
            {valid.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Ir al slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/45 hover:bg-white/70'}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  CATEGORY RAIL (barra + grid de rubros)
// ════════════════════════════════════════════════════════════════════════════
export function HomeCategoryRail({
  categories,
  active,
  total,
  onSelect,
}: {
  categories: RubroCategory[]
  active: string                       // businessTypeFilter actual ('all' o un rubro)
  total: number                        // total de comercios (para "Todos")
  onSelect: (type: string) => void     // setBusinessTypeFilter + scroll
}) {
  const barRef = useRef<HTMLDivElement>(null)
  const cats = (categories || []).filter(c => c.type)

  if (cats.length === 0) return null

  return (
    <section className="landing-section-bg relative py-5 sm:py-7">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">

        {/* ── Barra horizontal de rubros (chips con ícono) ── */}
        <div className="relative">
          <div
            ref={barRef}
            className="flex gap-2 sm:gap-2.5 overflow-x-auto scrollbar-hide scroll-smooth pb-1 -mx-1 px-1"
          >
            {/* Todos */}
            <button
              onClick={() => onSelect('all')}
              className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-full border text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
                active === 'all'
                  ? 'bg-white text-black border-white shadow'
                  : 'bg-white/5 text-white/70 border-white/12 hover:border-white/35 hover:text-white'
              }`}
            >
              <Store className="w-4 h-4" />
              Todos
              <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${active === 'all' ? 'bg-black/10 text-black/60' : 'bg-white/10 text-white/50'}`}>
                {total}
              </span>
            </button>

            {cats.map(({ type, count }) => {
              const selected = active === type
              return (
                <button
                  key={type}
                  onClick={() => onSelect(type)}
                  className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-full border text-xs sm:text-sm font-medium whitespace-nowrap capitalize transition-all ${
                    selected
                      ? 'bg-white text-black border-white shadow'
                      : 'bg-white/5 text-white/70 border-white/12 hover:border-white/35 hover:text-white'
                  }`}
                >
                  <span className="w-4 h-4 inline-flex">{rubroIcon(type)}</span>
                  {type}
                  <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${selected ? 'bg-black/10 text-black/60' : 'bg-white/10 text-white/50'}`}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Grid de tarjetas de rubro ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] uppercase tracking-[0.3em] text-white/35 font-light">
              Explora por categoría
            </span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-3">
            {cats.map(({ type, count }, idx) => {
              const selected = active === type
              return (
                <button
                  key={type}
                  onClick={() => onSelect(selected ? 'all' : type)}
                  className={`group relative flex flex-col items-center justify-center gap-2 rounded-2xl border px-2 py-4 sm:py-5 text-center transition-all duration-300 ${
                    selected
                      ? 'border-white/40 bg-white/10 shadow-lg'
                      : 'border-white/8 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20 hover:-translate-y-0.5'
                  }`}
                >
                  <span
                    className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${RUBRO_GRADIENTS[idx % RUBRO_GRADIENTS.length]} flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform`}
                  >
                    <span className="w-5 h-5 sm:w-6 sm:h-6 inline-flex">{rubroIcon(type)}</span>
                  </span>
                  <span className="text-[11px] sm:text-xs font-medium text-white/85 capitalize leading-tight line-clamp-2">
                    {type}
                  </span>
                  <span className="text-[10px] text-white/40">
                    {count} {count === 1 ? 'comercio' : 'comercios'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
