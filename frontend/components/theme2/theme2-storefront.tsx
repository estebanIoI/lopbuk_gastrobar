'use client'

import { useEffect, useState } from 'react'
import {
  ChevronDown, ArrowRight, ShoppingBag, CalendarDays, MapPin, Clock,
  Instagram, Facebook, MessageCircle, Store,
} from 'lucide-react'
import { Theme2OrderFlow } from '@/components/theme2/theme2-order-flow'
import { BoxLoader } from '@/components/box-loader'
import { Theme2ReserveFlow } from '@/components/theme2/theme2-reserve-flow'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
const ASSET_BASE = API_URL.replace(/\/api$/, '')
const abs = (u?: string | null) => (!u ? '' : u.startsWith('http') ? u : `${ASSET_BASE}${u}`)

const COP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0)

/** Renderiza HTML personalizado del comerciante en un iframe aislado (auto-altura). */
function HtmlSectionFrame({ name, html }: { name: string; html: string }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    const blob = new Blob([html], { type: 'text/html; charset=utf-8' })
    const url = URL.createObjectURL(blob)
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [html])
  if (!src) return null
  return (
    <iframe
      src={src}
      title={name}
      scrolling="no"
      style={{ width: '100%', border: 'none', display: 'block', minHeight: '100px' }}
      onLoad={(e) => {
        try {
          const iframe = e.currentTarget as HTMLIFrameElement
          const body = iframe.contentDocument?.body
          if (body) iframe.style.height = body.scrollHeight + 'px'
        } catch { /* blob cross-origin, ignore */ }
      }}
    />
  )
}

interface Product {
  id: string
  name: string
  description?: string | null
  salePrice: number
  imageUrl?: string | null
  category?: string | null
}
interface Sede { id: string; name: string; address?: string | null }
interface StoreInfo {
  name?: string
  logoUrl?: string | null
  cardCoverUrl?: string | null
  cardDescription?: string | null
  socialInstagram?: string | null
  socialFacebook?: string | null
  socialWhatsapp?: string | null
  locationMapUrl?: string | null
  address?: string | null
}

/**
 * Tema 2 (gastronómico) — Home de la tienda pública.
 * Componente independiente: no toca el Tema 1. Toma los datos públicos por slug.
 * Los flujos de pedido/reserva se conectan por fases; por ahora las acciones
 * llevan al catálogo y reserva existentes.
 */
export function Theme2Storefront({ slug }: { slug: string }) {
  const [loading, setLoading] = useState(true)
  const [info, setInfo] = useState<StoreInfo>({})
  const [openState, setOpenState] = useState<'open' | 'closed'>('open')
  const [nextOpenLabel, setNextOpenLabel] = useState<string | null>(null)
  const [favorites, setFavorites] = useState<Product[]>([])
  const [sedes, setSedes] = useState<Sede[]>([])
  const [categories, setCategories] = useState<{ name: string; displayName?: string }[]>([])
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const [featuredIds, setFeaturedIds] = useState<Set<string>>(new Set())
  const [trendingIds, setTrendingIds] = useState<Set<string>>(new Set())
  const [orderOpen, setOrderOpen] = useState(false)
  const [orderProductId, setOrderProductId] = useState<string | null>(null)
  const [reserveOpen, setReserveOpen] = useState(false)
  const [customSections, setCustomSections] = useState<{ id: number; name: string; htmlContent?: string }[]>([])

  // Atribución de afiliado: guarda el ?ref=TOKEN del enlace para usarlo en el checkout.
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get('ref')
      if (ref) localStorage.setItem('dz_ref', JSON.stringify({ token: ref, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 }))
    } catch { /* sin acceso a localStorage */ }
  }, [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [cfgRes, sedesRes] = await Promise.all([
          fetch(`${API_URL}/storefront/store-config/${slug}`).then(r => r.json()).catch(() => null),
          fetch(`${API_URL}/storefront/sedes?store=${slug}`).then(r => r.json()).catch(() => null),
        ])
        if (!alive) return
        const data = cfgRes?.data
        if (data) {
          setInfo(data.storeInfo || {})
          setOpenState(data.openState === 'closed' ? 'closed' : 'open')
          setNextOpenLabel(data.nextOpenLabel ?? null)
          setCategories(data.categories || [])
          const ids = (arr: any[]) => new Set<string>((arr || []).map((x: any) => String(x.id)))
          setNewIds(ids(data.newLaunches))
          setFeaturedIds(ids(data.featuredProducts))
          setTrendingIds(ids(data.trendingProducts))
          setCustomSections(data.customSections || [])
          let favs: Product[] = (data.featuredProducts || []).slice(0, 6)
          if (favs.length === 0) {
            const prodRes = await fetch(`${API_URL}/storefront/products?limit=6&store=${slug}`).then(r => r.json()).catch(() => null)
            const prodList = Array.isArray(prodRes?.data)
              ? prodRes.data
              : (Array.isArray(prodRes?.data?.products) ? prodRes.data.products : [])
            favs = prodList.slice(0, 6)
          }
          setFavorites(favs)
        }
        if (Array.isArray(sedesRes?.data)) setSedes(sedesRes.data)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [slug])

  const scrollToSedes = () => document.getElementById('t2-sedes')?.scrollIntoView({ behavior: 'smooth' })
  const goReservar = () => setReserveOpen(true)
  const goOrder = () => { setOrderProductId(null); setOrderOpen(true) }
  // Abre el flujo de pedido con un producto ya agregado al carrito (Favoritos → Ordenar Ahora).
  const goOrderProduct = (id: string) => { setOrderProductId(id); setOrderOpen(true) }
  const waLink = info.socialWhatsapp
    ? `https://wa.me/${String(info.socialWhatsapp).replace(/\D/g, '')}`
    : null
  const mapLink = info.locationMapUrl
    || (info.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(info.address)}` : null)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]" style={{ ['--dz-bg' as any]: '#0a0a0a' }}>
        <BoxLoader />
      </div>
    )
  }

  const cover = abs(info.cardCoverUrl || info.logoUrl)
  const title = (info.cardDescription || info.name || '').toUpperCase()

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* ═══ NAV ═══ */}
      <header className="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-5 sm:px-10 py-4">
        <div className="flex items-center gap-3">
          {info.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={abs(info.logoUrl)} alt={info.name || ''} className="w-9 h-9 rounded-full object-cover border border-white/20" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><Store className="w-4 h-4" /></div>
          )}
          <span className="text-sm font-semibold tracking-wide uppercase truncate max-w-[55vw]">{info.name}</span>
        </div>
        <nav className="flex items-center gap-3 sm:gap-5 text-xs sm:text-sm">
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="hidden sm:block text-white/70 hover:text-white transition-colors">Inicio</button>
          <button onClick={scrollToSedes} className="hidden sm:block text-white/70 hover:text-white transition-colors">Nosotros</button>
          <button onClick={goOrder} className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 px-4 py-2 text-xs font-semibold text-black hover:opacity-90 transition-opacity">
            <ShoppingBag className="w-3.5 h-3.5" /> Pedir Ahora
          </button>
        </nav>
      </header>

      {/* ═══ HERO ═══ */}
      <section className="relative min-h-[88vh] flex flex-col items-center justify-center text-center px-6 overflow-hidden">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/40 to-black" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/55 to-[#0a0a0a]" />

        <div className="relative z-10 flex flex-col items-center gap-6 max-w-3xl">
          {info.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={abs(info.logoUrl)} alt={info.name || ''} className="w-24 h-24 rounded-full object-cover border-2 border-white/20 shadow-2xl" />
          )}
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight drop-shadow-lg">{title}</h1>
          {openState === 'closed' && nextOpenLabel && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-red-500/20 text-red-300 border border-red-400/40">
              <Clock className="w-3.5 h-3.5" /> Cerrado · {nextOpenLabel}
            </span>
          )}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
            <button onClick={goOrder} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 px-7 py-3.5 text-sm font-bold text-black hover:opacity-90 transition-opacity">
              PEDIR AHORA <ArrowRight className="w-4 h-4" />
            </button>
            <button onClick={goReservar} className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/5 backdrop-blur px-7 py-3.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors">
              <CalendarDays className="w-4 h-4" /> RESERVAR
            </button>
          </div>
        </div>
        <button onClick={scrollToSedes} className="absolute bottom-6 z-10 text-white/40 hover:text-white/80 transition-colors animate-bounce">
          <ChevronDown className="w-7 h-7" />
        </button>
      </section>

      {/* ═══ NUESTROS FAVORITOS ═══ */}
      {favorites.length > 0 && (
        <section className="px-5 sm:px-10 py-16 max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-[10px] uppercase tracking-[0.35em] text-cyan-400/70 font-medium">Experiencia gastronómica</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold mt-2">
              NUESTROS <span className="text-cyan-400">FAVORITOS</span>
            </h2>
            <div className="w-16 h-1 bg-cyan-400 mx-auto mt-3 rounded-full" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {favorites.map(p => (
              <div key={p.id} className="group relative rounded-2xl p-[1.5px] bg-gradient-to-br from-cyan-400/50 via-white/10 to-fuchsia-500/40 hover:from-cyan-300/70 hover:to-fuchsia-400/60 transition-colors">
                <div className="relative rounded-[15px] overflow-hidden bg-[#141414] flex flex-col h-full">
                  {/* Brillo premium al pasar el cursor */}
                  <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 z-10 rotate-12 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-10 group-hover:translate-x-[420%] transition-transform duration-700 ease-out" />
                  <div className="relative aspect-[4/3] bg-[#0e0e0e] overflow-hidden">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={abs(p.imageUrl)} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Store className="w-8 h-8 text-white/10" /></div>
                    )}
                    <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 bg-black/70 text-amber-300 text-[10px] font-bold px-2 py-1 rounded-full backdrop-blur">★ Premium</span>
                    <span className="absolute top-2.5 right-2.5 bg-black/70 text-white text-xs font-bold px-2.5 py-1 rounded-full backdrop-blur">{COP(p.salePrice)}</span>
                  </div>
                  <div className="p-4 flex flex-col gap-2 flex-1">
                    <h3 className="font-bold text-cyan-400">{p.name}</h3>
                    {p.description && <p className="text-xs text-white/45 line-clamp-2 flex-1">{p.description}</p>}
                    <button onClick={() => goOrderProduct(String(p.id))} className="mt-2 inline-flex items-center justify-center gap-2 w-full rounded-lg border border-white/10 bg-white/[0.03] py-2.5 text-xs font-semibold text-white/80 hover:bg-white/[0.07] hover:text-white transition-colors">
                      Ordenar Ahora <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <button onClick={goOrder} className="text-xs text-white/40 hover:text-cyan-400 transition-colors uppercase tracking-widest">
              Ver menú completo →
            </button>
          </div>
        </section>
      )}

      {/* ═══ NUESTRA HISTORIA ═══ */}
      <section className="px-5 sm:px-10 py-16 max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-8 items-center rounded-3xl bg-[#111] border border-white/[0.06] p-6 sm:p-10">
          <div className="rounded-2xl overflow-hidden aspect-video bg-[#0e0e0e]">
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover} alt="" className="w-full h-full object-cover" />
            ) : <div className="w-full h-full flex items-center justify-center"><Store className="w-10 h-10 text-white/10" /></div>}
          </div>
          <div className="space-y-4">
            <p className="text-[10px] uppercase tracking-[0.35em] text-cyan-400/70 font-medium">Nuestra historia</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold leading-tight">
              La mejor experiencia <span className="text-cyan-400">para ti.</span>
            </h2>
            <p className="text-sm text-white/45 leading-relaxed">{info.cardDescription || 'Somos el antojo de todos.'}</p>
            {(info.socialInstagram || info.socialFacebook) && (
              <a
                href={info.socialInstagram || info.socialFacebook || '#'}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-xs font-semibold hover:bg-white/10 transition-colors"
              >
                Ir a nuestras redes <ArrowRight className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ═══ SÍGUENOS EN REDES ═══ */}
      {(info.socialInstagram || info.socialFacebook) && (
        <section className="px-5 sm:px-10 py-12 max-w-3xl mx-auto text-center">
          <p className="text-[10px] uppercase tracking-[0.35em] text-white/30 font-medium">Comunidad</p>
          <h2 className="text-2xl sm:text-3xl font-extrabold mt-2 mb-6">Síguenos <span className="text-cyan-400">en Redes</span></h2>
          <div className="grid grid-cols-2 gap-4">
            {info.socialInstagram && (
              <a href={info.socialInstagram} target="_blank" rel="noopener noreferrer" className="rounded-2xl bg-[#141414] border border-white/[0.06] hover:border-cyan-400/40 p-6 flex flex-col items-center gap-2 transition-colors">
                <Instagram className="w-7 h-7 text-pink-400" />
                <span className="text-sm font-semibold">Instagram</span>
              </a>
            )}
            {info.socialFacebook && (
              <a href={info.socialFacebook} target="_blank" rel="noopener noreferrer" className="rounded-2xl bg-[#141414] border border-white/[0.06] hover:border-cyan-400/40 p-6 flex flex-col items-center gap-2 transition-colors">
                <Facebook className="w-7 h-7 text-blue-400" />
                <span className="text-sm font-semibold">Facebook</span>
              </a>
            )}
          </div>
        </section>
      )}

      {/* ═══ ENCUENTRA TU SEDE ═══ */}
      <section id="t2-sedes" className="px-5 sm:px-10 py-16 max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-[10px] uppercase tracking-[0.35em] text-white/30 font-medium">Visítanos</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold mt-2">Encuentra <span className="text-cyan-400">tu Sede</span></h2>
          <p className="text-sm text-white/40 max-w-md mx-auto mt-3">Selecciona la sede más cercana y vive la experiencia. Pide a domicilio o visítanos.</p>
        </div>

        {sedes.length === 0 ? (
          <div className="rounded-2xl bg-[#141414] border border-white/[0.06] p-6 text-center max-w-md mx-auto space-y-4">
            <p className="text-sm text-white/60">{info.address || 'Consulta con nosotros para hacer tu pedido.'}</p>
            <button onClick={goOrder} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 px-6 py-3 text-sm font-bold text-black">
              <ShoppingBag className="w-4 h-4" /> Hacer Pedido
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {sedes.map(s => (
              <div key={s.id} className="rounded-2xl overflow-hidden bg-[#141414] border border-white/[0.06] flex flex-col">
                <div className="p-4 space-y-3 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold">{s.name}</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${openState === 'closed' ? 'bg-red-500/15 text-red-400' : 'bg-green-500/15 text-green-400'}`}>
                      {openState === 'closed' ? 'Cerrado' : 'Abierto'}
                    </span>
                  </div>
                  {s.address && (
                    <p className="text-xs text-white/50 flex items-start gap-1.5"><MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />{s.address}</p>
                  )}
                  {openState === 'closed' && nextOpenLabel && (
                    <p className="text-[11px] text-amber-400/80 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{nextOpenLabel}</p>
                  )}
                </div>
                <div className="p-4 pt-0 space-y-2">
                  <button onClick={goOrder} className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 py-2.5 text-sm font-bold text-black hover:opacity-90 transition-opacity">
                    <ShoppingBag className="w-4 h-4" /> Hacer Pedido
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    {waLink && (
                      <a href={waLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-green-500/30 bg-green-500/10 py-2 text-xs font-semibold text-green-400 hover:bg-green-500/20 transition-colors">
                        <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                      </a>
                    )}
                    {mapLink && (
                      <a href={mapLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] py-2 text-xs font-semibold text-white/70 hover:bg-white/[0.07] transition-colors">
                        <MapPin className="w-3.5 h-3.5" /> Mapa
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ═══ SECCIONES HTML PERSONALIZADAS ═══ */}
      {customSections.length > 0 && (
        <section className="w-full">
          {customSections.map(s => s.htmlContent
            ? <HtmlSectionFrame key={s.id} name={s.name} html={s.htmlContent} />
            : null)}
        </section>
      )}

      {/* ═══ FOOTER ═══ */}
      <footer className="px-5 sm:px-10 py-10 border-t border-white/[0.06] text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          {info.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={abs(info.logoUrl)} alt="" className="w-6 h-6 rounded-full object-cover" />
          )}
          <span className="text-sm font-semibold uppercase tracking-wide">{info.name}</span>
        </div>
        <p className="text-[11px] text-white/25">Hecho con DAIMUZ · Soluciones Digitales</p>
      </footer>

      {/* ═══ FLUJO DE PEDIDO (Fase 2) ═══ */}
      {orderOpen && (
        <Theme2OrderFlow
          slug={slug}
          info={info}
          sedes={sedes}
          openState={openState}
          nextOpenLabel={nextOpenLabel}
          categories={categories}
          newIds={newIds}
          featuredIds={featuredIds}
          trendingIds={trendingIds}
          initialProductId={orderProductId}
          onClose={() => { setOrderOpen(false); setOrderProductId(null) }}
        />
      )}

      {/* ═══ RESERVA (Fase 4) ═══ */}
      {reserveOpen && (
        <Theme2ReserveFlow
          slug={slug}
          info={info}
          sedes={sedes}
          onClose={() => setReserveOpen(false)}
        />
      )}
    </div>
  )
}
