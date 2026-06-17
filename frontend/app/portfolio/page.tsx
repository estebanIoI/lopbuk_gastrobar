'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { LanyardShowpiece } from '@/components/portfolio/lanyard-showpiece'
import { RobotAssistant } from '@/components/portfolio/robot-assistant'
import { Starfield } from '@/components/portfolio/starfield'
import { PortfolioPreloader } from '@/components/portfolio/portfolio-preloader'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface FeaturedStore {
  id: string
  slug: string
  plan: string
  storeName: string | null
  logoUrl: string | null
  description: string | null
}

interface TeamCard {
  id: number
  name: string
  role: string
  bio: string
  photo_url: string
  band_image_url: string
  accent_color: string
  sort_order: number
  github_url: string
  linkedin_url: string
}

interface PortfolioData {
  heroTitle: string
  heroSubtitle: string
  heroImageUrl: string | null
  brandDescription: string | null
  showPricing: boolean
  showFeaturedStores: boolean
  contactEmail: string | null
  contactWhatsapp: string | null
  contactInstagram: string | null
  accentColor: string
  isPublished: boolean
  featuredStores: FeaturedStore[]
  robotSplineUrl?: string
}

// ─── Planes DAIMUZ ────────────────────────────────────────────────────────────
const PLANS = [
  {
    name: 'Micro',
    tag: 'Tienda única',
    price: '$80.000',
    period: '/mes',
    specs: ['1 sede', '1–3 usuarios', 'POS + Inventario', 'Tienda online básica'],
    highlighted: false,
  },
  {
    name: 'Pyme',
    tag: 'Negocio en crecimiento',
    price: '$300.000',
    period: '/mes',
    specs: ['2–5 sedes', '4–15 usuarios', 'Tienda + RestBar', 'Reportes avanzados'],
    highlighted: true,
  },
  {
    name: 'Mediana',
    tag: 'Empresa establecida',
    price: '$4.000.000',
    period: '/mes',
    specs: ['6–20 sedes', '16–60 usuarios', 'Multi-sede + Finanzas', 'Soporte prioritario'],
    highlighted: false,
  },
  {
    name: 'Enterprise',
    tag: '+20 sedes',
    price: 'Desde $5.000.000',
    period: '/mes',
    specs: ['Sedes ilimitadas', 'Usuarios ilimitados', 'SLA garantizado', 'Soporte 24/7 dedicado'],
    highlighted: false,
    isEnterprise: true,
  },
]

const EXTRAS = [
  { label: 'Implementación / Onboarding', value: '$300.000 – $3.000.000' },
  { label: 'Soporte premium / 24×7', value: '+20% a +50%' },
  { label: 'Hardware (impresoras, lector, cajas)', value: 'Se cotiza aparte' },
  { label: 'Personalizaciones a medida', value: '$100.000/hora o bolsa mensual' },
]

const FEATURES = [
  { icon: '🛒', title: 'Punto de Venta', desc: 'POS rápido, intuitivo y con soporte offline para tu equipo.' },
  { icon: '📦', title: 'Inventario Inteligente', desc: 'Control de stock, recetas BOM y alertas de reorden automáticas.' },
  { icon: '🏪', title: 'Tienda Online', desc: 'Tu catálogo en línea con carrito, cupones y domicilios.' },
  { icon: '🍽️', title: 'RestBar', desc: 'Mesas, comandas, cocina y barra integrados en tiempo real.' },
  { icon: '📊', title: 'Finanzas & Reportes', desc: 'Ingresos, egresos, presupuestos y análisis con gráficos.' },
  { icon: '👥', title: 'Multi-sede & Roles', desc: 'Sucursales, cargos y permisos granulares por empleado.' },
]

// ─── Constructor de plan — catálogo de servicios ──────────────────────────────
interface ServiceOption {
  title: string
  desc?: string
  savings?: string
  price: number
  isPopular?: boolean
}
interface ServiceCategory {
  id: string
  icon: string
  label: string
  type: 'package' | 'subscription' | 'addon'
  options: ServiceOption[]
}
interface CartItem {
  categoryId: string
  categoryLabel: string
  optionTitle: string
  optionDesc?: string
  price: number
  type: string
}

const SERVICE_CATALOG: ServiceCategory[] = [
  {
    id: 'landing_pages',
    icon: '🖥️',
    label: 'Landing Pages',
    type: 'package',
    options: [
      { title: '1 Landing Page', price: 80000 },
      { title: 'Pack x10 Landings', savings: 'Ahorro 12%', price: 700000 },
      { title: 'Pack x20 Landings', savings: 'Ahorro 18%', price: 1300000 },
      { title: 'Pack x40 Landings', savings: 'Ahorro 25%', price: 2400000 },
      { title: 'Pack x50 Landings', savings: 'Ahorro 31%', price: 2750000 },
      { title: 'Pack x100 Agency', savings: 'Ahorro 37%', price: 5000000 },
    ],
  },
  {
    id: 'web_corporativa',
    icon: '🏢',
    label: 'Web Corporativa',
    type: 'package',
    options: [
      { title: 'Esencial', desc: '1 página, 3 secciones completas', price: 500000 },
      { title: 'Profesional', desc: '6 páginas, blog, correo corporativo', price: 850000, isPopular: true },
      { title: 'Élite', desc: 'Catálogo online, reservas, SEO optimizado', price: 1200000 },
    ],
  },
  {
    id: 'ecommerce',
    icon: '🛒',
    label: 'E-Commerce Pro',
    type: 'package',
    options: [
      { title: 'Tienda Starter', desc: 'Hasta 30 productos, pasarelas de pago', price: 1200000 },
      { title: 'Tienda Growth', desc: '100 productos, recuperación de carrito', price: 1800000, isPopular: true },
      { title: 'Tienda Escala Custom', desc: 'Productos ilimitados, integración ERP', price: 2800000 },
    ],
  },
  {
    id: 'redes_ads',
    icon: '📣',
    label: 'Redes Ads',
    type: 'subscription',
    options: [
      { title: 'Content Starter', desc: '12 posts IA + 1 red gestionada /mes', price: 1188000 },
      { title: 'Growth B2B', desc: '15 posts + 4 carruseles de autoridad /mes', price: 1988000, isPopular: true },
      { title: 'Authority Pro', desc: 'Growth B2B + publicación directa + métricas /mes', price: 3188000 },
    ],
  },
  {
    id: 'voice_ai',
    icon: '🎙️',
    label: 'Voice AI',
    type: 'package',
    options: [
      { title: 'WhatsApp Async Agent', price: 1500000 },
      { title: 'Inbound Telefónico', price: 3500000 },
      { title: 'Call Center Outbound Pro', price: 5000000 },
    ],
  },
  {
    id: 'data_analytics',
    icon: '📊',
    label: 'Data Analytics',
    type: 'package',
    options: [
      { title: 'Looker Studio Dashboard', price: 1200000 },
      { title: 'Power BI Corporativo', price: 2800000 },
      { title: 'Big Data & IA Ecosystem', price: 4500000 },
    ],
  },
  {
    id: 'ia_addons',
    icon: '🤖',
    label: 'IA Add-ons',
    type: 'addon',
    options: [
      { title: 'Chatbot IA Conversacional', price: 1188000 },
      { title: 'IA Personal Shopper', price: 1588000 },
      { title: 'IA Automatización Operativa', price: 1988000 },
    ],
  },
]

const CURRENCIES = {
  COP: { symbol: '$', rate: 1,        label: 'COP (Col$)' },
  USD: { symbol: 'US$', rate: 1/4200, label: 'USD ($)'    },
  EUR: { symbol: '€',  rate: 1/4600, label: 'EUR (€)'    },
} as const
type CurrencyKey = keyof typeof CURRENCIES

// ─── Carrusel de carnets ──────────────────────────────────────────────────────
function TeamCarousel({ cards, brandTitle, accentColor }: {
  cards: TeamCard[]
  brandTitle: string
  accentColor: string
}) {
  const [active, setActive] = useState(0)
  const [autoplay, setAutoplay] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const next = useCallback(() => setActive(i => (i + 1) % cards.length), [cards.length])
  const prev = useCallback(() => setActive(i => (i - 1 + cards.length) % cards.length), [cards.length])

  useEffect(() => {
    if (!autoplay || cards.length <= 1) return
    intervalRef.current = setInterval(next, 4000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [autoplay, next, cards.length])

  const handleNav = (dir: 'prev' | 'next') => {
    setAutoplay(false)
    if (intervalRef.current) clearInterval(intervalRef.current)
    dir === 'next' ? next() : prev()
  }

  if (cards.length === 0) return null

  const card = cards[active]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, minWidth: 260 }}>
      {/* Info del carnet activo */}
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${card.accent_color}33`,
        borderRadius: 14,
        padding: '10px 16px',
        minWidth: 200,
        textAlign: 'center',
      }}>
        <p style={{ color: '#fff', fontWeight: 700, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' }}>
          DESARROLLADORES
        </p>
        <p style={{ color: '#aaa', fontSize: 11, marginTop: 2 }}>{card.name}</p>
        <p style={{ color: '#666', fontSize: 10 }}>{active + 1} de {cards.length}</p>
      </div>

      {/* Controles nav + autoplay */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => handleNav('prev')}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8, padding: '5px 10px', color: '#aaa', fontSize: 11, cursor: 'pointer',
          }}
        >
          ← Navegar
        </button>
        <button
          onClick={() => setAutoplay(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8, padding: '5px 10px', color: autoplay ? '#ef4444' : '#aaa',
            fontSize: 11, cursor: 'pointer',
          }}
        >
          {autoplay ? '● ' : '▶ '}{autoplay ? 'Pausar' : 'Auto'}
        </button>
        <button
          onClick={() => handleNav('next')}
          style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8, padding: '5px 10px', color: '#aaa', fontSize: 11, cursor: 'pointer',
          }}
        >
          Manual
        </button>
      </div>

      {/* Tarjeta del desarrollador = carnet 3D colgante (Lanyard).
          La foto se mapea sobre el carnet; la banda/cordon es configurable por tarjeta. */}
      {/* Altura adaptativa: más baja en celular, alta en escritorio.
          El canvas llena el alto del contenedor (height="100%"). */}
      <div className="h-[460px] sm:h-[540px] lg:h-[600px] -mt-6 sm:-mt-8 lg:-mt-10 w-[300px] sm:w-[380px] lg:w-[440px]" style={{ maxWidth: '92vw' }}>
        <LanyardShowpiece
          height="100%"
          cardImageUrl={card.photo_url || ''}
          bandImageUrl={card.band_image_url || ''}
        />
      </div>

      {/* Flechas de navegación (si hay más de 1) */}
      {cards.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 8 }}>
          <button
            onClick={() => handleNav('prev')}
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16,
            }}
          >‹</button>

          {/* Dots */}
          <div style={{ display: 'flex', gap: 6 }}>
            {cards.map((c, i) => (
              <button
                key={c.id}
                onClick={() => { setActive(i); setAutoplay(false) }}
                style={{
                  width: i === active ? 20 : 6,
                  height: 6, borderRadius: 3,
                  background: i === active ? card.accent_color : 'rgba(255,255,255,0.2)',
                  border: 'none', cursor: 'pointer',
                  transition: 'all 0.3s',
                }}
              />
            ))}
          </div>

          <button
            onClick={() => handleNav('next')}
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16,
            }}
          >›</button>
        </div>
      )}
    </div>
  )
}

// ─── Constructor interactivo de plan ─────────────────────────────────────────
function PricingBuilder({ accentColor, contactWhatsapp, apiUrl, catalog }: {
  accentColor: string
  contactWhatsapp: string | null
  apiUrl: string
  catalog?: ServiceCategory[]
}) {
  const cats = catalog?.length ? catalog : SERVICE_CATALOG
  const [selectedCat, setSelectedCat] = useState<string>(() => cats[0]?.id || '')
  const [cart, setCart] = useState<CartItem[]>([])
  const [currency, setCurrency] = useState<CurrencyKey>('COP')
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [showAppt, setShowAppt] = useState(false)
  const [appt, setAppt] = useState({ name: '', phone: '', date: '', time: '', notes: '' })

  useEffect(() => {
    if (catalog?.length) {
      setSelectedCat(prev => catalog.find(c => c.id === prev) ? prev : (catalog[0]?.id || ''))
    }
  }, [catalog])

  const currentCat = cats.find(c => c.id === selectedCat)
  const { symbol, rate } = CURRENCIES[currency]

  const inCart = useCallback(
    (catId: string, title: string) => cart.some(i => i.categoryId === catId && i.optionTitle === title),
    [cart]
  )

  const toggleItem = (cat: ServiceCategory, opt: ServiceOption) => {
    if (inCart(cat.id, opt.title)) {
      setCart(prev => prev.filter(i => !(i.categoryId === cat.id && i.optionTitle === opt.title)))
    } else {
      setCart(prev => [
        ...prev.filter(i => i.categoryId !== cat.id),
        { categoryId: cat.id, categoryLabel: cat.label, optionTitle: opt.title, optionDesc: opt.desc, price: opt.price, type: cat.type },
      ])
    }
  }

  const formatPrice = (cop: number) => {
    const v = cop * rate
    return currency === 'COP'
      ? `${symbol}${v.toLocaleString('es-CO')}`
      : `${symbol}${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  }

  const total = cart.reduce((s, i) => s + i.price, 0)

  const sendAppt = () => {
    if (!contactWhatsapp || !cart.length) return
    const lines = cart.map(i => `• ${i.optionTitle}: ${formatPrice(i.price)} ${currency}`)
    const parts: string[] = [
      `Hola! Quiero agendar una cita para cotizar los siguientes servicios:`,
      `\n📋 *Servicios de interés:*\n${lines.join('\n')}\n💰 *Total estimado: ${formatPrice(total)} ${currency}*`,
    ]
    if (appt.name)  parts.push(`\n👤 *Nombre:* ${appt.name}`)
    if (appt.phone) parts.push(`📞 *Teléfono:* ${appt.phone}`)
    if (appt.date)  parts.push(`📅 *Fecha preferida:* ${new Date(appt.date + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`)
    if (appt.time)  parts.push(`🕐 *Hora preferida:* ${appt.time}`)
    if (appt.notes) parts.push(`📝 *Nota:* ${appt.notes}`)
    window.open(`https://wa.me/${contactWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(parts.join('\n'))}`, '_blank')
    setShowAppt(false)
    setAppt({ name: '', phone: '', date: '', time: '', notes: '' })
  }

  const handleMPCheckout = async () => {
    if (!cart.length) return
    setCheckoutLoading(true)
    setCheckoutError(null)
    try {
      const backUrl = typeof window !== 'undefined' ? window.location.href : '/'
      const res = await fetch(`${apiUrl}/portfolio/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map(i => ({ title: `${i.categoryLabel} — ${i.optionTitle}`, quantity: 1, unit_price: i.price })),
          backUrl,
        }),
      })
      const data = await res.json()
      if (data.success && data.data?.init_point) {
        window.location.href = data.data.init_point
      } else {
        setCheckoutError(data.error || 'Error al crear el pago. Usa WhatsApp para continuar.')
      }
    } catch {
      setCheckoutError('Error de conexión. Por favor usa el botón de WhatsApp.')
    }
    setCheckoutLoading(false)
  }

  return (
    <section id="constructor" className="py-16 sm:py-24 px-6 max-w-6xl mx-auto">
      <div className="text-center mb-12">
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: accentColor }}>
          Constructor de plan
        </p>
        <h2 className="text-3xl sm:text-4xl font-bold">Construye tu inversión</h2>
        <p className="text-sm mt-2" style={{ color: 'var(--pf-muted)' }}>Selecciona los servicios que necesitas y calcula el total al instante</p>
      </div>

      {/* Selector de categorías */}
      <div className="flex flex-wrap gap-2 justify-center mb-10">
        {cats.map(cat => {
          const active = selectedCat === cat.id
          const hasItem = cart.some(i => i.categoryId === cat.id)
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCat(cat.id)}
              className="relative flex flex-col items-center gap-1.5 px-2.5 sm:px-4 py-2.5 sm:py-3 rounded-2xl border transition-all text-center"
              style={
                active
                  ? { borderColor: accentColor, background: `${accentColor}18`, color: accentColor }
                  : { borderColor: 'var(--pf-border)', background: 'var(--pf-card)', color: 'var(--pf-muted)' }
              }
            >
              {hasItem && (
                <span
                  className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full border-2"
                  style={{ background: accentColor, borderColor: 'var(--pf-bg)' }}
                />
              )}
              <span className="text-2xl">{cat.icon}</span>
              <span className="text-[10px] font-semibold leading-tight text-center whitespace-nowrap">{cat.label}</span>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Panel de opciones */}
        <div>
          {currentCat && (
            <>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{currentCat.icon}</span>
                <div>
                  <h3 className="font-bold" style={{ color: 'var(--pf-text)' }}>{currentCat.label}</h3>
                  <p className="text-xs" style={{ color: 'var(--pf-muted)' }}>
                    {currentCat.type === 'subscription' ? 'Suscripción mensual recurrente'
                      : currentCat.type === 'addon' ? 'Add-on complementario'
                      : 'Pago único'}
                  </p>
                </div>
                {currentCat.type === 'subscription' && (
                  <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-semibold">/mes</span>
                )}
              </div>

              <div className="space-y-2">
                {currentCat.options.map(opt => {
                  const selected = inCart(currentCat.id, opt.title)
                  return (
                    <button
                      key={opt.title}
                      onClick={() => toggleItem(currentCat, opt)}
                      className="w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all"
                      style={
                        selected
                          ? { borderColor: accentColor, background: `${accentColor}12` }
                          : { borderColor: 'var(--pf-border)', background: 'var(--pf-card)' }
                      }
                    >
                      <div
                        className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                        style={selected ? { borderColor: accentColor, background: accentColor } : { borderColor: 'var(--pf-subtle)' }}
                      >
                        {selected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold" style={{ color: 'var(--pf-text)' }}>{opt.title}</p>
                          {opt.savings && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 font-semibold">
                              {opt.savings}
                            </span>
                          )}
                          {opt.isPopular && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold text-white" style={{ background: accentColor }}>
                              Popular
                            </span>
                          )}
                        </div>
                        {opt.desc && <p className="text-xs mt-0.5" style={{ color: 'var(--pf-muted)' }}>{opt.desc}</p>}
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className="font-bold" style={{ color: 'var(--pf-text)' }}>{formatPrice(opt.price)}</p>
                        <p className="text-[10px]" style={{ color: 'var(--pf-muted)' }}>{currency}{currentCat.type === 'subscription' ? '/mes' : ''}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Panel resumen */}
        <div className="sticky top-24 max-h-fit">
          <div className="rounded-2xl border p-5 space-y-4" style={{ borderColor: 'var(--pf-border)', background: 'var(--pf-card)' }}>
            <p className="font-bold text-sm" style={{ color: 'var(--pf-text)' }}>Resumen de Inversión</p>

            {cart.length === 0 ? (
              <p className="text-xs text-center py-6" style={{ color: 'var(--pf-muted)' }}>Aún no has seleccionado ningún servicio.</p>
            ) : (
              <div className="space-y-2.5">
                {cart.map(item => (
                  <div key={`${item.categoryId}-${item.optionTitle}`} className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium leading-tight truncate" style={{ color: 'var(--pf-text)' }}>{item.optionTitle}</p>
                      <p className="text-[10px]" style={{ color: 'var(--pf-muted)' }}>{item.categoryLabel}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <p className="text-xs font-semibold whitespace-nowrap" style={{ color: 'var(--pf-text)' }}>{formatPrice(item.price)}</p>
                      <button
                        onClick={() => setCart(prev => prev.filter(i => !(i.categoryId === item.categoryId && i.optionTitle === item.optionTitle)))}
                        className="transition-colors hover:text-red-400"
                        style={{ color: 'var(--pf-muted)' }}
                      >
                        <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
                <div className="pt-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--pf-border)' }}>
                  <p className="text-xs" style={{ color: 'var(--pf-muted)' }}>Total estimado</p>
                  <p className="font-black text-lg" style={{ color: accentColor }}>{formatPrice(total)}</p>
                </div>
              </div>
            )}

            {/* Selector de moneda */}
            <div className="flex items-center justify-between text-xs">
              <span style={{ color: 'var(--pf-muted)' }}>Moneda</span>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value as CurrencyKey)}
                className="border rounded-lg px-2 py-1 text-xs cursor-pointer focus:outline-none"
                style={{ background: 'var(--pf-card)', color: 'var(--pf-text)', borderColor: 'var(--pf-border)' }}
              >
                {(Object.entries(CURRENCIES) as [CurrencyKey, typeof CURRENCIES[CurrencyKey]][]).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
            </div>

            {/* ── Elige cómo continuar ── */}
            {cart.length > 0 && (
              <div className="pt-1 space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-center" style={{ color: 'var(--pf-subtle)' }}>
                  ¿Cómo quieres continuar?
                </p>

                <div className="grid grid-cols-2 gap-2">
                  {/* Agendar cita — abre formulario */}
                  {contactWhatsapp ? (
                    <button
                      onClick={() => setShowAppt(true)}
                      className="flex flex-col items-center gap-2 p-3.5 rounded-xl border-2 transition-all hover:scale-[1.03] active:scale-[0.97] text-center"
                      style={{ borderColor: '#25d366', background: 'rgba(37,211,102,0.08)' }}
                    >
                      <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: '#25d366' }}>
                        <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-green-400">Agendar cita</p>
                        <p className="text-[10px]" style={{ color: 'var(--pf-muted)' }}>Por WhatsApp</p>
                      </div>
                    </button>
                  ) : (
                    <div className="flex flex-col items-center gap-2 p-3.5 rounded-xl border-2 opacity-40 text-center cursor-not-allowed"
                      style={{ borderColor: 'var(--pf-border)', background: 'var(--pf-card)' }}>
                      <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'var(--pf-border)' }}>
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" style={{ color: 'var(--pf-muted)' }}>
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs font-bold" style={{ color: 'var(--pf-muted)' }}>Agendar cita</p>
                        <p className="text-[10px]" style={{ color: 'var(--pf-subtle)' }}>No configurado</p>
                      </div>
                    </div>
                  )}

                  {/* Pagar en línea */}
                  <button
                    onClick={handleMPCheckout}
                    disabled={checkoutLoading}
                    className="flex flex-col items-center gap-2 p-3.5 rounded-xl border-2 transition-all hover:scale-[1.03] active:scale-[0.97] text-center disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ borderColor: '#009ee3', background: 'rgba(0,158,227,0.08)' }}
                  >
                    <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: '#009ee3' }}>
                      {checkoutLoading ? (
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
                          <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" className="w-4 h-4">
                          <rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#009ee3]">{checkoutLoading ? 'Procesando…' : 'Pagar ahora'}</p>
                      <p className="text-[10px]" style={{ color: 'var(--pf-muted)' }}>MercadoPago</p>
                    </div>
                  </button>
                </div>

                {checkoutError && (
                  <p className="text-[11px] text-red-400 text-center leading-snug">{checkoutError}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal de agendamiento ─────────────────────────────────────── */}
      {showAppt && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowAppt(false) }}
        >
          <div
            className="w-full max-w-md rounded-2xl border p-6 space-y-5 shadow-2xl"
            style={{ background: 'var(--pf-bg2, var(--pf-bg))', borderColor: 'var(--pf-border)', color: 'var(--pf-text)' }}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-lg leading-tight">Agendar cita</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--pf-muted)' }}>
                  Completa tus datos y te contactaremos por WhatsApp
                </p>
              </div>
              <button
                onClick={() => setShowAppt(false)}
                className="mt-0.5 transition-colors hover:text-red-400 shrink-0"
                style={{ color: 'var(--pf-muted)' }}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Resumen del carrito */}
            <div className="rounded-xl p-3 space-y-1.5" style={{ background: 'var(--pf-card)', borderColor: 'var(--pf-border)' }}>
              {cart.map(item => (
                <div key={`${item.categoryId}-${item.optionTitle}`} className="flex justify-between items-center gap-2 text-xs">
                  <span className="truncate" style={{ color: 'var(--pf-muted)' }}>{item.optionTitle}</span>
                  <span className="font-semibold shrink-0" style={{ color: 'var(--pf-text)' }}>{formatPrice(item.price)}</span>
                </div>
              ))}
              <div className="pt-1.5 border-t flex justify-between items-center font-bold text-sm" style={{ borderColor: 'var(--pf-border)', color: accentColor }}>
                <span>Total</span><span>{formatPrice(total)}</span>
              </div>
            </div>

            {/* Campos */}
            {(
              [
                { key: 'name',  label: 'Nombre *',           type: 'text',  placeholder: 'Tu nombre completo' },
                { key: 'phone', label: 'WhatsApp / Teléfono', type: 'tel',   placeholder: 'Ej: +57 300 123 4567' },
                { key: 'date',  label: 'Fecha preferida',     type: 'date',  placeholder: '' },
                { key: 'time',  label: 'Hora preferida',      type: 'time',  placeholder: '' },
              ] as const
            ).map(({ key, label, type, placeholder }) => (
              <div key={key} className="space-y-1.5">
                <label className="text-xs font-semibold" style={{ color: 'var(--pf-text)' }}>{label}</label>
                <input
                  type={type}
                  value={appt[key]}
                  onChange={e => setAppt(prev => ({ ...prev, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none focus:ring-2 transition-all"
                  style={{
                    background: 'var(--pf-card)',
                    borderColor: 'var(--pf-border)',
                    color: 'var(--pf-text)',
                    colorScheme: 'dark',
                  } as React.CSSProperties}
                  onFocus={e => (e.target.style.borderColor = accentColor)}
                  onBlur={e => (e.target.style.borderColor = 'var(--pf-border)')}
                />
              </div>
            ))}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold" style={{ color: 'var(--pf-text)' }}>Notas adicionales</label>
              <textarea
                value={appt.notes}
                onChange={e => setAppt(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="¿Algo que debamos saber antes de la reunión?"
                rows={3}
                className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none focus:ring-2 transition-all resize-none"
                style={{
                  background: 'var(--pf-card)',
                  borderColor: 'var(--pf-border)',
                  color: 'var(--pf-text)',
                } as React.CSSProperties}
                onFocus={e => (e.target.style.borderColor = accentColor)}
                onBlur={e => (e.target.style.borderColor = 'var(--pf-border)')}
              />
            </div>

            {/* Botón enviar */}
            <button
              onClick={sendAppt}
              disabled={!appt.name.trim()}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: '#25d366', color: '#fff' }}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Enviar por WhatsApp
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

// ─── Grafo de ecosistemas conectados ─────────────────────────────────────────
const ECO_NODES = [
  { id: 'mercadopago', label: 'MercadoPago', icon: '💳', color: '#009ee3', angle: 0   },
  { id: 'whatsapp',   label: 'WhatsApp API', icon: '💬', color: '#25d366', angle: 30  },
  { id: 'openai',     label: 'OpenAI (IA)',  icon: '🤖', color: '#10a37f', angle: 60  },
  { id: 'cloudinary', label: 'Media Cloud',  icon: '☁️', color: '#3448c5', angle: 90  },
  { id: 'storefront', label: 'Tienda Online', icon: '🛒', color: '#f59e0b', angle: 120 },
  { id: 'restbar',    label: 'RestBar',       icon: '🍽️', color: '#ef4444', angle: 150 },
  { id: 'inventario', label: 'Inventario',    icon: '📦', color: '#8b5cf6', angle: 180 },
  { id: 'finanzas',   label: 'Finanzas',      icon: '💰', color: '#10b981', angle: 210 },
  { id: 'domicilios', label: 'Delivery',      icon: '🚴', color: '#f97316', angle: 240 },
  { id: 'reportes',   label: 'Reportes',      icon: '📊', color: '#06b6d4', angle: 270 },
  { id: 'multisede',  label: 'Multi-sede',    icon: '🏪', color: '#a78bfa', angle: 300 },
  { id: 'pos',        label: 'POS Caja',      icon: '🖥️', color: '#64748b', angle: 330 },
] as const

type EcoNodeId = typeof ECO_NODES[number]['id']

const ECO_CONNECTIONS: Record<EcoNodeId, EcoNodeId[]> = {
  mercadopago: ['storefront', 'pos', 'finanzas'],
  whatsapp:    ['domicilios', 'openai', 'storefront'],
  openai:      ['whatsapp', 'storefront', 'inventario'],
  cloudinary:  ['storefront', 'inventario'],
  storefront:  ['mercadopago', 'domicilios', 'cloudinary', 'whatsapp', 'openai', 'inventario'],
  restbar:     ['pos', 'inventario'],
  inventario:  ['pos', 'storefront', 'cloudinary', 'restbar', 'openai'],
  finanzas:    ['pos', 'mercadopago', 'reportes'],
  domicilios:  ['whatsapp', 'storefront', 'multisede'],
  reportes:    ['finanzas', 'inventario', 'multisede'],
  multisede:   ['reportes', 'domicilios', 'pos'],
  pos:         ['inventario', 'mercadopago', 'finanzas', 'restbar', 'multisede'],
}

function EcosistemaConectado({ accentColor, brandTitle }: { accentColor: string; brandTitle: string }) {
  const [activeNode, setActiveNode] = useState<EcoNodeId | null>(null)

  const getPos = (angle: number) => {
    const rad = ((angle - 90) * Math.PI) / 180
    return { left: 50 + 38 * Math.cos(rad), top: 50 + 26.5 * Math.sin(rad) }
  }

  const isHighlighted = (id: EcoNodeId) =>
    !activeNode || id === activeNode || ECO_CONNECTIONS[activeNode]?.includes(id)

  const isLineActive = (a: EcoNodeId, b: EcoNodeId) =>
    !!activeNode && (
      (activeNode === a && ECO_CONNECTIONS[a]?.includes(b)) ||
      (activeNode === b && ECO_CONNECTIONS[b]?.includes(a))
    )

  const activeData = ECO_NODES.find(n => n.id === activeNode)

  return (
    <section className="py-16 sm:py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: accentColor }}>
            Ecosistema integrado
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold">Ecosistemas Conectados</h2>
          <p className="text-sm text-gray-500 mt-2 max-w-xl mx-auto leading-relaxed">
            Tu negocio no necesita más herramientas aisladas o planillas. Necesita un{' '}
            <span className="text-white font-semibold">sistema nervioso central</span> omnicanal.
          </p>
        </div>

        {/* Contenedor del grafo — overflow hidden, sin scroll */}
        <div className="relative mx-auto w-full max-w-md sm:max-w-lg md:max-w-2xl" style={{ height: 'auto', minHeight: 400, aspectRatio: '1', overflow: 'hidden' }}>

          {/* SVG líneas — sin overflow, sin dasharray, sin transiciones */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>

            {/* Líneas base entre satélites (siempre visibles, muy tenues) */}
            {ECO_NODES.flatMap(nA =>
              ECO_CONNECTIONS[nA.id].map(bId => {
                const nB = ECO_NODES.find(n => n.id === bId)!
                if (nA.id >= nB.id) return null
                const pA = getPos(nA.angle)
                const pB = getPos(nB.angle)
                const active = isLineActive(nA.id, bId)
                return (
                  <line
                    key={`${nA.id}-${bId}`}
                    x1={`${pA.left}%`} y1={`${pA.top}%`}
                    x2={`${pB.left}%`} y2={`${pB.top}%`}
                    stroke={active ? accentColor : 'rgba(255,255,255,0.07)'}
                    strokeWidth={active ? 2 : 1}
                  />
                )
              })
            ).filter(Boolean)}

            {/* Líneas sólidas del centro a los nodos conectados al activo */}
            {activeNode && ECO_CONNECTIONS[activeNode].map(toId => {
              const to = ECO_NODES.find(n => n.id === toId)!
              const pos = getPos(to.angle)
              return (
                <line
                  key={`c-${toId}`}
                  x1="50%" y1="50%"
                  x2={`${pos.left}%`} y2={`${pos.top}%`}
                  stroke={accentColor}
                  strokeWidth="1.5"
                  strokeOpacity="0.4"
                />
              )
            })}

            {/* Línea principal del centro al nodo activo */}
            {activeData && (() => {
              const pos = getPos(activeData.angle)
              return (
                <line
                  x1="50%" y1="50%"
                  x2={`${pos.left}%`} y2={`${pos.top}%`}
                  stroke={activeData.color}
                  strokeWidth="2.5"
                  strokeOpacity="0.85"
                />
              )
            })()}
          </svg>

          {/* Núcleo central = cerebro DAIMUZ (pulsos neuronales) */}
          <style>{`
            @keyframes dz-brain-pulse { 0% { transform: scale(0.55); opacity: 0.55; } 100% { transform: scale(2.6); opacity: 0; } }
            @keyframes dz-brain-core { 0%,100% { box-shadow: 0 0 34px ${accentColor}66, 0 0 78px ${accentColor}2e; } 50% { box-shadow: 0 0 56px ${accentColor}b3, 0 0 130px ${accentColor}55; } }
          `}</style>
          {[0, 1, 2].map(i => (
            <span key={i} aria-hidden style={{
              position: 'absolute', left: '50%', top: '50%', marginLeft: -38, marginTop: -38,
              width: 76, height: 76, borderRadius: '50%', border: `1.5px solid ${accentColor}`,
              zIndex: 9, pointerEvents: 'none',
              animation: `dz-brain-pulse 3s ease-out ${i}s infinite`,
            }} />
          ))}
          <div style={{
            position: 'absolute', left: '50%', top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 84, height: 84, borderRadius: '50%',
            background: `radial-gradient(circle, ${accentColor}55, ${accentColor}0a)`,
            border: `2.5px solid ${accentColor}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            zIndex: 10,
            animation: 'dz-brain-core 2.6s ease-in-out infinite',
          }}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>🧠</span>
            <span style={{ color: '#fff', fontWeight: 900, fontSize: 13, letterSpacing: 1, marginTop: 1 }}>
              {brandTitle.slice(0, 2).toUpperCase()}
            </span>
          </div>

          {/* Nodos satélite — sin transform scale, solo opacity */}
          {ECO_NODES.map(node => {
            const pos = getPos(node.angle)
            const active = activeNode === node.id
            return (
              <div
                key={node.id}
                style={{
                  position: 'absolute',
                  left: `${pos.left}%`, top: `${pos.top}%`,
                  transform: 'translate(-50%, -50%)',
                  opacity: isHighlighted(node.id) ? 1 : 0.2,
                  transition: 'opacity 0.2s',
                  cursor: 'pointer', zIndex: 5, userSelect: 'none',
                }}
                onClick={() => setActiveNode(activeNode === node.id ? null : node.id)}
                onMouseEnter={() => setActiveNode(node.id)}
                onMouseLeave={() => setActiveNode(null)}
              >
                <div style={{
                  width: 54, height: 54, borderRadius: '50%',
                  background: active ? `${node.color}2a` : 'rgba(255,255,255,0.06)',
                  border: `2px solid ${active ? node.color : 'rgba(255,255,255,0.12)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22,
                  boxShadow: active ? `0 0 22px ${node.color}88` : 'none',
                  transition: 'border-color 0.2s, background 0.2s, box-shadow 0.2s',
                }}>
                  {node.icon}
                </div>
                <p style={{
                  textAlign: 'center', fontSize: 9,
                  color: active ? '#fff' : '#777',
                  marginTop: 5, lineHeight: 1.2, whiteSpace: 'nowrap',
                  transition: 'color 0.2s',
                }}>
                  {node.label}
                </p>
              </div>
            )
          })}

          {/* Tooltip — dentro del contenedor, arriba del centro */}
          {activeData && (
            <div style={{
              position: 'absolute', left: '50%', bottom: 10,
              transform: 'translateX(-50%)',
              background: `${activeData.color}18`,
              border: `1px solid ${activeData.color}55`,
              borderRadius: 10, padding: '6px 16px',
              whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 20,
            }}>
              <p style={{ color: '#fff', fontSize: 11, fontWeight: 700, textAlign: 'center' }}>
                {activeData.label}
              </p>
              <p style={{ color: '#888', fontSize: 9.5, textAlign: 'center', marginTop: 1 }}>
                {'Conecta con: '}
                {ECO_CONNECTIONS[activeData.id]
                  .map(id => ECO_NODES.find(n => n.id === id)?.label)
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          Pasa el cursor o toca un nodo para ver sus conexiones
        </p>
      </div>
    </section>
  )
}

// ─── Íconos redes sociales ────────────────────────────────────────────────────
function WhatsAppIcon({ size = 'w-5 h-5' }: { size?: string } = {}) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={size}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}
function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  )
}
function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  )
}

// ─── Header fijo ─────────────────────────────────────────────────────────────
function PortfolioHeader({
  title, accent, scrolled, isDark, onToggle,
}: {
  title: string; accent: string; scrolled: boolean; isDark: boolean; onToggle: () => void
}) {
  const nav = [
    { label: 'Inicio',          href: '#inicio'          },
    { label: 'Características', href: '#caracteristicas' },
    { label: 'Servicios',       href: '#constructor'     },
    { label: 'Planes',          href: '#precios'         },
    { label: 'Contacto',        href: '#contacto'        },
  ]
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background:          scrolled ? 'var(--pf-nav-bg)'           : 'transparent',
        backdropFilter:      scrolled ? 'blur(14px) saturate(1.6)'   : 'none',
        WebkitBackdropFilter:scrolled ? 'blur(14px) saturate(1.6)'   : 'none',
        borderBottom:        scrolled ? '1px solid var(--pf-border)' : '1px solid transparent',
      }}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
        {/* Brand */}
        <a
          href="#inicio"
          className="flex items-center gap-2.5 font-black text-[15px] tracking-tight select-none shrink-0"
          style={{ color: 'var(--pf-text)' }}
          onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
        >
          <span className="w-2 h-2 rounded-full" style={{ background: accent }} />
          {title}
        </a>

        {/* Nav links — hidden on mobile */}
        <nav className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
          {nav.map(item => (
            <a
              key={item.href}
              href={item.href}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-opacity opacity-50 hover:opacity-100 whitespace-nowrap"
              style={{ color: 'var(--pf-text)' }}
              onClick={e => {
                e.preventDefault()
                const el = document.querySelector(item.href)
                el?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Theme toggle */}
        <AnimatedThemeToggler
          isDark={isDark}
          onToggle={onToggle}
          variant="circle"
          duration={450}
          className="w-9 h-9 flex items-center justify-center rounded-full border transition-all duration-200 hover:scale-105 active:scale-95 shrink-0"
          style={{
            borderColor: 'var(--pf-border)',
            background:  'var(--pf-card)',
            color:       'var(--pf-text)',
          } as React.CSSProperties}
        />
      </div>
    </header>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function PortfolioPage() {
  const [data, setData] = useState<PortfolioData | null>(null)
  const [teamCards, setTeamCards] = useState<TeamCard[]>([])
  const [loading, setLoading] = useState(true)
  const [showQr, setShowQr] = useState(false)
  const pageUrl = typeof window !== 'undefined' ? window.location.href : ''
  const qrRef = useRef<SVGSVGElement>(null)
  const [isDark, setIsDark] = useState(true)
  const [scrolled, setScrolled] = useState(false)
  const [features, setFeatures] = useState(FEATURES)
  const [serviceCatalog, setServiceCatalog] = useState<ServiceCategory[]>(SERVICE_CATALOG)
  // Floating CTA: aparece cuando el botón del hero sale de la vista
  const heroCTARef = useRef<HTMLAnchorElement>(null)
  const [showFloatingCta, setShowFloatingCta] = useState(false)

  useEffect(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('pf-theme') : null
    if (saved === 'light') setIsDark(false)
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Observa el botón CTA del hero — muestra el flotante cuando sale de la vista
  useEffect(() => {
    const el = heroCTARef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setShowFloatingCta(!entry.isIntersecting),
      { threshold: 0, rootMargin: '-64px 0px 0px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [data])

  const toggleTheme = useCallback(() => {
    setIsDark(prev => {
      const next = !prev
      if (typeof localStorage !== 'undefined') localStorage.setItem('pf-theme', next ? 'dark' : 'light')
      return next
    })
  }, [])

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/portfolio/public`).then(r => r.json()),
      fetch(`${API_URL}/portfolio/team`).then(r => r.json()),
      fetch(`${API_URL}/portfolio/features`).then(r => r.json()).catch(() => ({ success: false })),
      fetch(`${API_URL}/portfolio/services`).then(r => r.json()).catch(() => ({ success: false })),
    ])
      .then(([pJson, tJson, fJson, sJson]) => {
        if (pJson.success) setData(pJson.data)
        if (tJson.success) setTeamCards(tJson.data || [])
        if (fJson.success && fJson.data?.length > 0) {
          setFeatures(fJson.data.map((f: any) => ({ icon: f.icon, title: f.title, desc: f.description })))
        }
        if (sJson.success && sJson.data?.length > 0) {
          setServiceCatalog(sJson.data.map((cat: any) => ({
            id: String(cat.id),
            icon: cat.icon,
            label: cat.label,
            type: cat.type as 'package' | 'subscription' | 'addon',
            options: (cat.options || []).map((opt: any) => ({
              title: opt.title,
              desc: opt.description || undefined,
              savings: opt.savings || undefined,
              price: Number(opt.price),
              isPopular: Boolean(opt.is_popular),
            })),
          })))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: isDark ? '#0a0a0f' : '#f8fafc' }}
    >
      <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  )

  const accent = data?.accentColor || '#6366f1'
  const title = data?.heroTitle || 'DAIMUZ'
  const subtitle = data?.heroSubtitle || 'Soluciones de gestión para tu negocio'
  const description = data?.brandDescription

  const pfVars = isDark ? {
    '--pf-bg':     '#0a0a0f',
    '--pf-bg2':    '#0d0d1f',
    '--pf-text':   '#ffffff',
    '--pf-muted':  '#9ca3af',
    '--pf-subtle': '#6b7280',
    '--pf-card':   'rgba(255,255,255,0.03)',
    '--pf-card-h': 'rgba(255,255,255,0.06)',
    '--pf-border': 'rgba(255,255,255,0.08)',
    '--pf-nav-bg': 'rgba(10,10,15,0.85)',
  } : {
    '--pf-bg':     '#f8fafc',
    '--pf-bg2':    '#f1f5f9',
    '--pf-text':   '#0f172a',
    '--pf-muted':  '#475569',
    '--pf-subtle': '#64748b',
    '--pf-card':   'rgba(0,0,0,0.04)',
    '--pf-card-h': 'rgba(0,0,0,0.07)',
    '--pf-border': 'rgba(0,0,0,0.09)',
    '--pf-nav-bg': 'rgba(248,250,252,0.85)',
  }

  return (
    <div
      data-pf-theme={isDark ? 'dark' : 'light'}
      className="min-h-screen overflow-x-hidden"
      style={{
        ...pfVars as React.CSSProperties,
        background: isDark ? '#0a0a0f' : '#f8fafc',
        color:      isDark ? '#ffffff' : '#0f172a',
        transition: 'background 0.35s ease, color 0.35s ease',
      }}
    >
      <style>{`
        @keyframes carnet-float {
          0%, 100% { transform: translateY(0) rotateY(-8deg) rotateX(3deg); }
          50%       { transform: translateY(-14px) rotateY(8deg) rotateX(-2deg); }
        }
        @keyframes float-slow {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-12px); }
        }
        .float-slow { animation: float-slow 6s ease-in-out infinite; }
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.3; }
          50%       { opacity: 0.7; }
        }
        .glow-pulse { animation: glow-pulse 3s ease-in-out infinite; }
      `}</style>

      <PortfolioHeader
        title={title}
        accent={accent}
        scrolled={scrolled}
        isDark={isDark}
        onToggle={toggleTheme}
      />

      {/* ── BOTÓN FLOTANTE MOBILE (pill centrado, aparece al hacer scroll) ─ */}
      {data?.contactWhatsapp && (
        <div
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex justify-center"
          style={{
            paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)',
            paddingTop: '16px',
            background: isDark
              ? 'linear-gradient(to top, rgba(10,10,15,0.97) 60%, transparent)'
              : 'linear-gradient(to top, rgba(248,250,252,0.98) 60%, transparent)',
            transform: showFloatingCta ? 'translateY(0)' : 'translateY(110%)',
            transition: 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)',
            pointerEvents: showFloatingCta ? 'auto' : 'none',
          }}
        >
          <a
            href={`https://wa.me/${data.contactWhatsapp.replace(/\D/g, '')}`}
            target="_blank" rel="noopener noreferrer"
            aria-label="Solicitar demo por WhatsApp"
            className="flex items-center gap-2.5 px-7 py-3.5 rounded-full active:scale-95 hover:brightness-110"
            style={{
              // Fondo más sólido (degradado oscuro del acento) para que el texto blanco
              // se lea siempre, incluso con acentos claros (lavanda) en móvil.
              background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
              color: '#ffffff',
              fontSize: '15px',
              fontWeight: 800,
              letterSpacing: '0.2px',
              textShadow: '0 1px 3px rgba(0,0,0,0.55)',
              boxShadow: `0 6px 30px ${accent}65, 0 2px 8px rgba(0,0,0,0.35)`,
              border: '1px solid rgba(0,0,0,0.18)',
              transition: 'filter 0.2s, transform 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            <WhatsAppIcon size="w-5 h-5" /> Solicitar demo
          </a>
        </div>
      )}

      <Starfield color={accent} />
      <PortfolioPreloader
        brand={title}
        tagline={subtitle}
        accent={accent}
        socials={{ instagram: data?.contactInstagram, whatsapp: data?.contactWhatsapp, email: data?.contactEmail }}
      />

      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <section id="inicio" className="relative min-h-screen flex items-center justify-center px-6 overflow-hidden">

        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${accent}22 0%, transparent 70%)` }}
        />
        <div
          className="glow-pulse absolute top-0 left-1/2 -translate-x-1/2 w-72 sm:w-96 md:w-[600px] h-72 sm:h-96 md:h-[600px] rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${accent}18 0%, transparent 70%)` }}
        />

        <div className="relative z-10 max-w-6xl mx-auto w-full grid lg:grid-cols-2 gap-10 items-center py-28">
          <div className="flex flex-col items-center lg:items-start text-center lg:text-left gap-6">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest border"
            style={{ borderColor: `${accent}44`, color: accent, background: `${accent}11` }}
          >
            <span>⚡</span> Plataforma SaaS Multi-Negocio
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-7xl font-black tracking-tight leading-none">
            {title}
          </h1>

          <p className="text-base sm:text-lg md:text-xl text-gray-400 leading-relaxed max-w-2xl">{subtitle}</p>

          {description && (
            <p className="text-xs sm:text-sm text-gray-500 leading-relaxed max-w-2xl">{description}</p>
          )}

          <div className="flex flex-wrap justify-center lg:justify-start gap-3 pt-2">
            {data?.contactWhatsapp && (
              <a
                ref={heroCTARef}
                href={`https://wa.me/${data.contactWhatsapp.replace(/\D/g, '')}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold transition-all hover:scale-105 active:scale-95 border-2"
                style={{ 
                  background: '#ffffff',
                  color: '#000000',
                  borderColor: accent,
                  boxShadow: `0 4px 24px ${accent}44`
                }}
              >
                <WhatsAppIcon /> Solicitar demo
              </a>
            )}
            <button
              onClick={() => document.getElementById('precios')?.scrollIntoView({ behavior: 'smooth' })}
              className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold border border-white/10 bg-white/5 hover:bg-white/10 transition-all hover:scale-105"
            >
              Ver planes →
            </button>
          </div>

          {/* QR compartir */}
          <div>
            <button
              onClick={() => setShowQr(v => !v)}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1.5 mx-auto lg:mx-0"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" /><path d="M14 14h3v3m0 4h4m-4-4v4m-4 0h4" />
              </svg>
              {showQr ? 'Ocultar QR' : 'Compartir QR'}
            </button>
            {showQr && (
              <div className="mt-3 inline-block p-3 bg-white rounded-xl shadow-xl">
                <QRCodeSVG ref={qrRef} value={pageUrl} size={120} />
              </div>
            )}
          </div>
          </div>

          {/* Columna derecha — Tarjetas del equipo (devs). Si no hay, robot. */}
          <div className="relative z-10 w-full flex flex-col items-center justify-center">
            {teamCards.length > 0 ? (
              <TeamCarousel cards={teamCards} brandTitle={title} accentColor={accent} />
            ) : (
              <RobotAssistant accent={accent} sceneUrl={data?.robotSplineUrl || undefined} robotHeight={300} />
            )}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 animate-bounce">
          <div className="w-px h-6 bg-gradient-to-b from-transparent to-gray-600" />
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-gray-600">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </section>

      {/* ── COMERCIOS DESTACADOS + ASISTENTE (chatbot) ───────────────────── */}
      {((data?.showFeaturedStores && (data?.featuredStores?.length ?? 0) > 0) || teamCards.length > 0) && (
        <section id="equipo" className="py-16 sm:py-24 px-6">
          <div className="max-w-6xl mx-auto">
            <div className={`grid gap-8 sm:gap-16 items-center ${(data?.showFeaturedStores && (data?.featuredStores?.length ?? 0) > 0) && teamCards.length > 0 ? 'grid-cols-1 lg:grid-cols-2' : ''}`}>

              {/* ── Izquierda: Comercios destacados ── */}
              {data?.showFeaturedStores && (data?.featuredStores?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: accent }}>
                    Comercios destacados
                  </p>
                  <h2 className="text-3xl sm:text-4xl font-bold mb-2">Negocios que confían en nosotros</h2>
                  <p className="text-sm mb-8" style={{ color: 'var(--pf-muted)' }}>
                    Empresas reales que ya operan con nuestra plataforma.
                  </p>
                  {/* Tarjetas de comercio (estilo home), responsivas: 1 col en celular, 2 en sm+. */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {data.featuredStores.map(store => (
                      <a
                        key={store.id}
                        href={`/links/${store.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group rounded-2xl border overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-xl flex flex-col"
                        style={{ borderColor: 'var(--pf-border)', background: 'var(--pf-card)' }}
                      >
                        {/* Portada: logo grande sobre acento */}
                        <div
                          className="relative h-28 sm:h-32 flex items-center justify-center overflow-hidden"
                          style={{ background: `linear-gradient(135deg, ${accent}26, transparent)` }}
                        >
                          {store.logoUrl ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={store.logoUrl} alt={store.storeName || store.slug} className="w-16 h-16 rounded-2xl object-cover shadow-lg" />
                          ) : (
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl shadow-lg" style={{ background: `${accent}33`, color: accent }}>
                              {(store.storeName || store.slug)[0].toUpperCase()}
                            </div>
                          )}
                          <span
                            className="absolute top-2 right-2 text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wide"
                            style={{ background: `${accent}22`, color: accent, backdropFilter: 'blur(4px)' }}
                          >
                            {store.plan}
                          </span>
                        </div>
                        {/* Info */}
                        <div className="p-4 flex flex-col flex-1">
                          <p className="font-bold text-sm leading-tight" style={{ color: 'var(--pf-text)' }}>
                            {store.storeName || store.slug}
                          </p>
                          {store.description && (
                            <p className="text-xs mt-1 line-clamp-2 flex-1" style={{ color: 'var(--pf-muted)' }}>
                              {store.description}
                            </p>
                          )}
                          <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold" style={{ color: accent }}>
                            Ver tienda
                            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1">
                              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                            </svg>
                          </span>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Derecha: Asistente / Robot DAIMUZ (chatbot) ── */}
              {teamCards.length > 0 && (
                <div className="w-full flex flex-col items-center text-center lg:items-start lg:text-left">
                  <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: accent }}>
                    Asistente DAIMUZ
                  </p>
                  <h2 className="text-3xl sm:text-4xl font-bold mb-6">Conoce el ecosistema</h2>
                  <div className="w-full max-w-md mx-auto lg:mx-0">
                    <RobotAssistant accent={accent} sceneUrl={data?.robotSplineUrl || undefined} robotHeight={300} />
                  </div>
                </div>
              )}

            </div>
          </div>
        </section>
      )}

      {/* ── CARACTERÍSTICAS ───────────────────────────────────────────────── */}
      <section id="caracteristicas" className="py-16 sm:py-24 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: accent }}>
            Plataforma completa
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold">Todo lo que tu negocio necesita</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map(f => (
            <div
              key={f.title}
              className="group p-6 rounded-2xl border border-white/5 bg-white/[0.03] hover:border-white/10 hover:bg-white/[0.06] transition-all"
            >
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="text-base font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CONSTRUCTOR DE PLAN ──────────────────────────────────────────── */}
      <div id="constructor" />
      <PricingBuilder
        accentColor={accent}
        contactWhatsapp={data?.contactWhatsapp || null}
        apiUrl={API_URL}
        catalog={serviceCatalog}
      />

      {/* ── PRECIOS ───────────────────────────────────────────────────────── */}
      {data?.showPricing !== false && (
        <section id="precios" className="py-16 sm:py-24 px-6 relative overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: `radial-gradient(ellipse 80% 50% at 50% 50%, ${accent}0f 0%, transparent 70%)` }}
          />
          <div className="relative max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: accent }}>
                Planes & Precios
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold">Escala tu negocio con el plan perfecto</h2>
              <p className="text-sm text-gray-500 mt-2">Precios en COP · IVA no incluido · Contrato mensual</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
              {PLANS.map(plan => (
                <div
                  key={plan.name}
                  className={`relative flex flex-col p-6 rounded-2xl border transition-all ${
                    plan.highlighted ? 'border-opacity-100 scale-[1.02]' : 'border-white/5 bg-white/[0.03]'
                  }`}
                  style={plan.highlighted ? { borderColor: accent, background: `${accent}0f` } : {}}
                >
                  {plan.highlighted && (
                    <div
                      className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-white"
                      style={{ background: accent }}
                    >
                      Popular
                    </div>
                  )}
                  {plan.isEnterprise && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-yellow-500 text-black">
                      Enterprise
                    </div>
                  )}
                  <div className="mb-4">
                    <p className="font-bold text-lg">{plan.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{plan.tag}</p>
                  </div>
                  <div className="mb-5">
                    <span className="text-2xl font-black">{plan.price}</span>
                    <span className="text-sm text-gray-500">{plan.period}</span>
                  </div>
                  <ul className="space-y-2 flex-1 mb-6">
                    {plan.specs.map(s => (
                      <li key={s} className="flex items-center gap-2 text-sm text-gray-400">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 flex-shrink-0" style={{ color: accent }}>
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        {s}
                      </li>
                    ))}
                  </ul>
                  {data?.contactWhatsapp && (
                    <a
                      href={`https://wa.me/${data.contactWhatsapp.replace(/\D/g, '')}?text=Hola! Me interesa el plan ${plan.name} de DAIMUZ`}
                      target="_blank" rel="noopener noreferrer"
                      className="block text-center py-2.5 px-4 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
                      style={
                        plan.highlighted
                          ? { background: accent, color: '#fff' }
                          : { background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.08)' }
                      }
                    >
                      Consultar
                    </a>
                  )}
                </div>
              ))}
            </div>

            {/* Extras */}
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
              <p className="text-sm font-semibold text-gray-300 mb-4">Pagos extra frecuentes</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {EXTRAS.map(e => (
                  <div key={e.label} className="flex items-start justify-between gap-4 text-sm">
                    <span className="text-gray-500">{e.label}</span>
                    <span className="text-gray-300 font-medium text-right">{e.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── ECOSISTEMAS CONECTADOS ───────────────────────────────────────── */}
      <div id="ecosistema" />
      <EcosistemaConectado accentColor={accent} brandTitle={title} />

      {/* ── COMERCIOS INTEGRADOS ──────────────────────────────────────────── */}
      {data?.showFeaturedStores && (data?.featuredStores?.length ?? 0) > 0 && (
        <section className="py-16 sm:py-24 px-6 max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: accent }}>
              Nuestros clientes
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold">Negocios que confían en DAIMUZ</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {data!.featuredStores.map(store => (
              <div
                key={store.id}
                className="group flex items-center gap-4 p-5 rounded-2xl border border-white/5 bg-white/[0.03] hover:border-white/10 hover:bg-white/[0.06] transition-all"
              >
                <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-800 flex-shrink-0">
                  {store.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={store.logoUrl} alt={store.storeName || ''} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-lg font-bold text-gray-500">
                      {(store.storeName || '?').charAt(0)}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{store.storeName || store.slug}</p>
                  {store.description && (
                    <p className="text-xs text-gray-500 truncate mt-0.5">{store.description}</p>
                  )}
                  <span
                    className="inline-block text-[10px] px-2 py-0.5 rounded-full mt-1.5 capitalize"
                    style={{ background: `${accent}22`, color: accent }}
                  >
                    {store.plan}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── CONTACTO ──────────────────────────────────────────────────── */}
      <section id="contacto" className="py-16 sm:py-24 px-6 pb-32 md:pb-16">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12 space-y-3">
            <p className="uppercase tracking-[0.5em] text-xs font-medium" style={{ color: accent }}>
              Contacto
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold">¿Listo para escalar tu negocio?</h2>
            <p className="text-lg max-w-md mx-auto leading-relaxed" style={{ color: 'var(--pf-muted)' }}>
              Agenda una demo sin costo y descubre cómo DAIMUZ puede transformar tu operación.
            </p>
          </div>

          {/* Canales de contacto */}
          {(data?.contactWhatsapp || data?.contactEmail || data?.contactInstagram) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-4xl mx-auto">
              {data?.contactWhatsapp && (
                <a
                  href={`https://wa.me/${data.contactWhatsapp.replace(/\D/g, '')}?text=Hola!%20Quiero%20agendar%20una%20demo%20de%20DAIMUZ`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-4 p-5 rounded-2xl border transition-all duration-200 hover:scale-[1.02] hover:shadow-lg group"
                  style={{ borderColor: 'var(--pf-border)', background: 'var(--pf-card)' }}
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>
                    <WhatsAppIcon />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">WhatsApp</p>
                    <p className="text-xs truncate" style={{ color: 'var(--pf-muted)' }}>Respuesta inmediata</p>
                  </div>
                </a>
              )}
              {data?.contactEmail && (
                <a
                  href={`mailto:${data.contactEmail}?subject=Demo%20DAIMUZ`}
                  className="flex items-center gap-4 p-5 rounded-2xl border transition-all duration-200 hover:scale-[1.02] hover:shadow-lg group"
                  style={{ borderColor: 'var(--pf-border)', background: 'var(--pf-card)' }}
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
                    <MailIcon />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">Correo</p>
                    <p className="text-xs truncate" style={{ color: 'var(--pf-muted)' }}>{data.contactEmail}</p>
                  </div>
                </a>
              )}
              {data?.contactInstagram && (
                <a
                  href={data.contactInstagram}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-4 p-5 rounded-2xl border transition-all duration-200 hover:scale-[1.02] hover:shadow-lg group"
                  style={{ borderColor: 'var(--pf-border)', background: 'var(--pf-card)' }}
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(236,72,153,0.15)', color: '#f472b6' }}>
                    <InstagramIcon />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">Instagram</p>
                    <p className="text-xs truncate" style={{ color: 'var(--pf-muted)' }}>Síguenos</p>
                  </div>
                </a>
              )}
            </div>
          )}

          {/* Fallback si no hay datos de contacto configurados */}
          {!data?.contactWhatsapp && !data?.contactEmail && !data?.contactInstagram && (
            <p className="text-center text-sm" style={{ color: 'var(--pf-subtle)' }}>
              Configura tus canales de contacto desde el panel de administración.
            </p>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center border-t border-white/5" style={{ borderColor: 'var(--pf-border)' }}>
        <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--pf-subtle)' }}>
          {title} · {new Date().getFullYear()} · Powered by Lopbuk
        </p>
      </footer>
    </div>
  )
}
