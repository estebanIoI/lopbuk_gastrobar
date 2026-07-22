'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, ArrowRight, Store } from 'lucide-react'
import { cldImg } from '@/utils/img'
import { GOLD, prefersReducedMotion } from './theme'
import { rubroIcon } from './icons'
import type { HeroSlide, RubroCategory } from './types'

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
    // Respeta "reducir movimiento": no auto-avanza el carrusel.
    if (paused || valid.length <= 1 || prefersReducedMotion()) return
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
      {/* La altura del contenedor = altura natural de la imagen activa (móvil y escritorio),
          para mostrar el banner COMPLETO sin recortarlo, con bordes redondeados. */}
      <div className="relative w-full overflow-hidden bg-gray-100 rounded-xl">
        {activeSlide && activeSlide.type !== 'video' ? (
          // Sizer invisible solo en móvil: define la altura exacta de la imagen activa.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cldImg((isMobile && activeSlide.mobileUrl) ? activeSlide.mobileUrl : activeSlide.url, 1200)} alt="" aria-hidden="true" className="block w-full h-auto invisible select-none pointer-events-none" />
        ) : (
          <div className="w-full aspect-video" />
        )}
        {valid.map((slide, i) => {
          const active = i === index
          // En móvil usa la media móvil si existe (fallback a la de escritorio).
          const mediaUrl = (isMobile && slide.mobileUrl) ? slide.mobileUrl : slide.url
          // En móvil el contenedor ENVUELVE la imagen (object-contain, no la corta), como el tema 1
          // de las tiendas; en escritorio se mantiene a sangre (object-cover).
          const media = slide.type === 'video' ? (
            <video src={mediaUrl} autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-contain" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cldImg(mediaUrl, 1600)} alt={slide.title || `Banner ${i + 1}`} className="absolute inset-0 w-full h-full object-contain" loading={i === 0 ? 'eager' : 'lazy'} fetchPriority={i === 0 ? 'high' : 'auto'} decoding="async" />
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
