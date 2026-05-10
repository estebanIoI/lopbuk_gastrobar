'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'

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

// ─── Carnet 3D interactivo ─────────────────────────────────────────────────────
function EngineerCard({ card, brandTitle, isActive }: {
  card: TeamCard
  brandTitle: string
  isActive: boolean
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [rot, setRot] = useState({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)
  const accent = card.accent_color || '#06b6d4'

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = (e.clientX - cx) / (rect.width / 2)
    const dy = (e.clientY - cy) / (rect.height / 2)
    setRot({ x: -dy * 16, y: dx * 16 })
  }, [])

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false)
    setRot({ x: 0, y: 0 })
  }, [])

  const passiveRot = isActive && !isHovered
    ? `rotateY(${Math.sin(Date.now() / 1800) * 10}deg) rotateX(${Math.cos(Date.now() / 2200) * 4}deg)`
    : undefined

  return (
    <div className="flex flex-col items-center select-none" style={{ perspective: '900px' }}>
      {/* Clip / cuerda */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Gancho metálico */}
        <div style={{
          width: 18, height: 14,
          borderRadius: '50% 50% 0 0 / 100% 100% 0 0',
          border: '3px solid #888',
          borderBottom: 'none',
          marginBottom: -1,
        }} />
        {/* Cuerda */}
        <div style={{
          width: 2,
          height: 64,
          background: `linear-gradient(to bottom, #666, ${accent}cc)`,
        }} />
      </div>

      {/* Tarjeta */}
      <div
        ref={cardRef}
        onMouseMove={(e) => { setIsHovered(true); handleMouseMove(e) }}
        onMouseLeave={handleMouseLeave}
        style={{
          width: 180,
          height: 260,
          transformStyle: 'preserve-3d',
          transform: isHovered
            ? `rotateX(${rot.x}deg) rotateY(${rot.y}deg) scale(1.04)`
            : passiveRot || 'rotateX(0deg) rotateY(0deg)',
          transition: isHovered ? 'none' : 'transform 0.8s cubic-bezier(.23,1,.32,1)',
          animation: isActive && !isHovered ? 'carnet-float 4s ease-in-out infinite' : 'none',
          cursor: 'pointer',
          borderRadius: 20,
          boxShadow: `0 24px 60px rgba(0,0,0,0.7), 0 0 40px ${accent}44`,
        }}
      >
        {/* Frente */}
        <div style={{
          position: 'absolute', inset: 0,
          borderRadius: 20,
          overflow: 'hidden',
          background: `linear-gradient(160deg, #0d0d1f 0%, #111827 50%, ${accent}22 100%)`,
          border: `1.5px solid ${accent}55`,
          backfaceVisibility: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Header de marca */}
          <div style={{
            padding: '10px 12px 8px',
            background: `linear-gradient(90deg, ${accent}22 0%, transparent 100%)`,
            borderBottom: `1px solid ${accent}33`,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              background: accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 900, color: '#fff',
            }}>
              {brandTitle.charAt(0)}
            </div>
            <div>
              <p style={{ color: '#fff', fontSize: 9, fontWeight: 700, letterSpacing: 2, lineHeight: 1.2 }}>
                {brandTitle.toUpperCase()}
              </p>
              <p style={{ color: accent, fontSize: 7, letterSpacing: 1 }}>DESARROLLADOR</p>
            </div>
          </div>

          {/* Foto */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {card.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={card.photo_url}
                alt={card.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
              />
            ) : (
              <div style={{
                width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `linear-gradient(135deg, ${accent}22, #0d0d1f)`,
                fontSize: 48, fontWeight: 900,
                color: `${accent}88`,
              }}>
                {card.name.charAt(0).toUpperCase()}
              </div>
            )}
            {/* Overlay degradado inferior */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: '45%',
              background: 'linear-gradient(to top, #0d0d1f 0%, transparent 100%)',
            }} />
            {/* Nombre sobre la foto */}
            <div style={{ position: 'absolute', bottom: 8, left: 12, right: 12 }}>
              <p style={{
                color: '#fff', fontSize: 15, fontWeight: 900,
                textTransform: 'uppercase', letterSpacing: 1,
                lineHeight: 1.1,
                textShadow: `0 0 20px ${accent}`,
              }}>
                {card.name}
              </p>
              <p style={{ color: accent, fontSize: 9, fontWeight: 600, letterSpacing: 1 }}>
                {card.role}
              </p>
            </div>
          </div>

          {/* Footer con links */}
          <div style={{
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: `1px solid ${accent}22`,
          }}>
            <div style={{
              width: 28, height: 18, borderRadius: 3,
              background: `linear-gradient(135deg, ${accent}66, ${accent}22)`,
            }} />
            <div style={{ display: 'flex', gap: 8 }}>
              {card.github_url && (
                <a href={card.github_url} target="_blank" rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  style={{ color: '#666', transition: 'color 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#666')}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 14, height: 14 }}>
                    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                  </svg>
                </a>
              )}
              {card.linkedin_url && (
                <a href={card.linkedin_url} target="_blank" rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  style={{ color: '#666', transition: 'color 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = accent)}
                  onMouseLeave={e => (e.currentTarget.style.color = '#666')}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 14, height: 14 }}>
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                </a>
              )}
            </div>
          </div>

          {/* Shine effect */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 20,
            background: `linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 50%, rgba(255,255,255,0.02) 100%)`,
            pointerEvents: 'none',
          }} />
        </div>
      </div>

      {/* Nombre debajo */}
      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <p style={{ color: accent, fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>
          {card.name}
        </p>
        <p style={{ color: '#666', fontSize: 10, marginTop: 2 }}>{card.role}</p>
      </div>
    </div>
  )
}

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

      {/* Carnet activo */}
      <EngineerCard key={card.id} card={card} brandTitle={brandTitle} isActive={true} />

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
    <section id="constructor" className="py-24 px-6 max-w-6xl mx-auto">
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
              className="relative flex flex-col items-center gap-1.5 px-4 py-3 rounded-2xl border transition-all min-w-[80px]"
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
              <span className="text-[10px] font-semibold leading-tight text-center">{cat.label}</span>
            </button>
          )
        })}
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
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
        <div className="lg:sticky lg:top-24">
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
    <section className="py-24 px-6">
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
        <div className="relative mx-auto" style={{ width: '100%', maxWidth: 700, height: 500, overflow: 'hidden' }}>

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

          {/* Nodo central */}
          <div style={{
            position: 'absolute', left: '50%', top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 76, height: 76, borderRadius: '50%',
            background: `radial-gradient(circle, ${accentColor}44, ${accentColor}0a)`,
            border: `2.5px solid ${accentColor}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10,
            boxShadow: `0 0 36px ${accentColor}55, 0 0 70px ${accentColor}22`,
          }}>
            <span style={{ color: '#fff', fontWeight: 900, fontSize: 18, letterSpacing: 1 }}>
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
function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
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

  useEffect(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('pf-theme') : null
    if (saved === 'light') setIsDark(false)
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

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

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section id="inicio" className="relative min-h-screen flex items-center justify-center px-6 overflow-hidden">
        {/* Fondo decorativo */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${accent}22 0%, transparent 70%)` }}
        />
        <div
          className="glow-pulse absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${accent}18 0%, transparent 70%)` }}
        />

        <div className="relative z-10 max-w-3xl mx-auto w-full flex flex-col items-center text-center gap-6 py-32">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest border"
            style={{ borderColor: `${accent}44`, color: accent, background: `${accent}11` }}
          >
            <span>⚡</span> Plataforma SaaS Multi-Negocio
          </div>

          <h1 className="text-5xl sm:text-7xl font-black tracking-tight leading-none">
            {title}
          </h1>

          <p className="text-xl text-gray-400 leading-relaxed">{subtitle}</p>

          {description && (
            <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
          )}

          <div className="flex flex-wrap justify-center gap-3 pt-2">
            {data?.contactWhatsapp && (
              <a
                href={`https://wa.me/${data.contactWhatsapp.replace(/\D/g, '')}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold text-white transition-all hover:scale-105 active:scale-95"
                style={{ background: accent }}
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
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1.5 mx-auto"
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

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 animate-bounce">
          <div className="w-px h-6 bg-gradient-to-b from-transparent to-gray-600" />
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-gray-600">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </section>

      {/* ── EQUIPO + COMERCIOS DESTACADOS ────────────────────────────────── */}
      {(teamCards.length > 0 || (data?.showFeaturedStores && (data?.featuredStores?.length ?? 0) > 0)) && (
        <section id="equipo" className="py-24 px-6">
          <div className="max-w-6xl mx-auto">
            <div className={`grid gap-16 items-start ${teamCards.length > 0 && data?.showFeaturedStores && (data?.featuredStores?.length ?? 0) > 0 ? 'lg:grid-cols-2' : ''}`}>

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
                  <div className="space-y-3">
                    {data.featuredStores.map(store => (
                      <a
                        key={store.id}
                        href={`/links/${store.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-4 p-4 rounded-2xl border transition-all duration-200 hover:scale-[1.01] group"
                        style={{ borderColor: 'var(--pf-border)', background: 'var(--pf-card)' }}
                      >
                        {/* Logo / inicial */}
                        {store.logoUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={store.logoUrl}
                            alt={store.storeName || store.slug}
                            className="w-12 h-12 rounded-xl object-cover shrink-0"
                          />
                        ) : (
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg shrink-0"
                            style={{ background: `${accent}22`, color: accent }}
                          >
                            {(store.storeName || store.slug)[0].toUpperCase()}
                          </div>
                        )}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm leading-tight" style={{ color: 'var(--pf-text)' }}>
                            {store.storeName || store.slug}
                          </p>
                          {store.description && (
                            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--pf-muted)' }}>
                              {store.description}
                            </p>
                          )}
                        </div>

                        {/* Plan badge */}
                        <span
                          className="text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wide shrink-0"
                          style={{ background: `${accent}20`, color: accent }}
                        >
                          {store.plan}
                        </span>

                        {/* Arrow */}
                        <svg
                          viewBox="0 0 20 20" fill="currentColor"
                          className="w-4 h-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1 group-hover:translate-x-0 duration-200"
                          style={{ color: accent }}
                        >
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Derecha: Carrusel del equipo ── */}
              {teamCards.length > 0 && (
                <div className={teamCards.length > 0 && !(data?.showFeaturedStores && (data?.featuredStores?.length ?? 0) > 0) ? 'flex flex-col items-center' : ''}>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: accent }}>
                    Nuestro equipo
                  </p>
                  <h2 className="text-3xl sm:text-4xl font-bold mb-8">Los desarrolladores</h2>
                  <TeamCarousel cards={teamCards} brandTitle={title} accentColor={accent} />
                </div>
              )}

            </div>
          </div>
        </section>
      )}

      {/* ── CARACTERÍSTICAS ───────────────────────────────────────────────── */}
      <section id="caracteristicas" className="py-24 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: accent }}>
            Plataforma completa
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold">Todo lo que tu negocio necesita</h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
        <section id="precios" className="py-24 px-6 relative overflow-hidden">
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

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
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
        <section className="py-24 px-6 max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: accent }}>
              Nuestros clientes
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold">Negocios que confían en DAIMUZ</h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
      <section id="contacto" className="py-24 px-6">
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
            <div className={`grid gap-3 ${[data?.contactWhatsapp, data?.contactEmail, data?.contactInstagram].filter(Boolean).length === 1 ? 'grid-cols-1 max-w-sm mx-auto' : [data?.contactWhatsapp, data?.contactEmail, data?.contactInstagram].filter(Boolean).length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-3'}`}>
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
