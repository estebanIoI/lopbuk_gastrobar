'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'

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

// ─── Página principal ─────────────────────────────────────────────────────────
export default function PortfolioPage() {
  const [data, setData] = useState<PortfolioData | null>(null)
  const [teamCards, setTeamCards] = useState<TeamCard[]>([])
  const [loading, setLoading] = useState(true)
  const [showQr, setShowQr] = useState(false)
  const pageUrl = typeof window !== 'undefined' ? window.location.href : ''
  const qrRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/portfolio/public`).then(r => r.json()),
      fetch(`${API_URL}/portfolio/team`).then(r => r.json()),
    ])
      .then(([pJson, tJson]) => {
        if (pJson.success) setData(pJson.data)
        if (tJson.success) setTeamCards(tJson.data || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
      <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  )

  const accent = data?.accentColor || '#6366f1'
  const title = data?.heroTitle || 'DAIMUZ'
  const subtitle = data?.heroSubtitle || 'Soluciones de gestión para tu negocio'
  const description = data?.brandDescription

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">
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

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center px-6 overflow-hidden">
        {/* Fondo decorativo */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${accent}22 0%, transparent 70%)` }}
        />
        <div
          className="glow-pulse absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${accent}18 0%, transparent 70%)` }}
        />

        <div className="relative z-10 max-w-6xl mx-auto w-full grid lg:grid-cols-2 gap-16 items-center py-24">
          {/* Texto */}
          <div className="space-y-6">
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest border"
              style={{ borderColor: `${accent}44`, color: accent, background: `${accent}11` }}
            >
              <span>⚡</span> Plataforma SaaS Multi-Negocio
            </div>

            <h1 className="text-5xl sm:text-7xl font-black tracking-tight leading-none">
              {title}
            </h1>

            <p className="text-xl text-gray-400 leading-relaxed max-w-lg">{subtitle}</p>

            {description && (
              <p className="text-sm text-gray-500 leading-relaxed max-w-lg">{description}</p>
            )}

            <div className="flex flex-wrap gap-3 pt-2">
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
            <div className="pt-2">
              <button
                onClick={() => setShowQr(v => !v)}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1.5"
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

          {/* Carrusel de carnets 3D */}
          <div className="hidden lg:flex justify-center items-start pt-4">
            {teamCards.length > 0 ? (
              <TeamCarousel cards={teamCards} brandTitle={title} accentColor={accent} />
            ) : (
              /* Fallback: carnet genérico si no hay team cards */
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', perspective: 900 }}>
                <div style={{ width: 2, height: 64, background: `linear-gradient(to bottom, #666, ${accent}cc)` }} />
                <div style={{
                  width: 180, height: 260,
                  borderRadius: 20,
                  background: `linear-gradient(160deg, #0d0d1f 0%, #111827 50%, ${accent}22 100%)`,
                  border: `1.5px solid ${accent}55`,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  animation: 'carnet-float 4s ease-in-out infinite',
                  boxShadow: `0 24px 60px rgba(0,0,0,0.7), 0 0 40px ${accent}44`,
                }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 12,
                  }}>{title.charAt(0)}</div>
                  <p style={{ color: '#fff', fontWeight: 700, fontSize: 13, letterSpacing: 2 }}>{title.toUpperCase()}</p>
                  <p style={{ color: accent, fontSize: 9, letterSpacing: 1, marginTop: 4 }}>PLATAFORMA SAAS</p>
                </div>
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

      {/* ── EQUIPO (móvil — carrusel horizontal) ─────────────────────────── */}
      {teamCards.length > 0 && (
        <section className="lg:hidden py-16 px-6">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: accent }}>
              Nuestro equipo
            </p>
            <h2 className="text-2xl font-bold">Desarrolladores</h2>
          </div>
          <div className="flex gap-8 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide justify-start pl-4">
            {teamCards.map(card => (
              <div key={card.id} className="snap-center flex-shrink-0">
                <EngineerCard card={card} brandTitle={title} isActive={false} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── CARACTERÍSTICAS ───────────────────────────────────────────────── */}
      <section className="py-24 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: accent }}>
            Plataforma completa
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold">Todo lo que tu negocio necesita</h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(f => (
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
              <h2 className="text-3xl sm:text-4xl font-bold">Rango orientativo (SaaS mensual)</h2>
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

      {/* ── CTA CONTACTO ──────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div
          className="max-w-3xl mx-auto rounded-3xl p-10 text-center space-y-6 border"
          style={{
            background: `linear-gradient(135deg, ${accent}15 0%, transparent 100%)`,
            borderColor: `${accent}33`,
          }}
        >
          <h2 className="text-3xl sm:text-4xl font-bold">¿Listo para escalar tu negocio?</h2>
          <p className="text-gray-400 text-lg">
            Agenda una demo sin costo y descubre cómo DAIMUZ puede transformar tu operación.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            {data?.contactWhatsapp && (
              <a
                href={`https://wa.me/${data.contactWhatsapp.replace(/\D/g, '')}?text=Hola! Quiero agendar una demo de DAIMUZ`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold text-white transition-all hover:scale-105 active:scale-95"
                style={{ background: accent }}
              >
                <WhatsAppIcon /> WhatsApp
              </a>
            )}
            {data?.contactEmail && (
              <a
                href={`mailto:${data.contactEmail}`}
                className="flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold border border-white/10 bg-white/5 hover:bg-white/10 transition-all hover:scale-105"
              >
                <MailIcon /> Correo
              </a>
            )}
            {data?.contactInstagram && (
              <a
                href={data.contactInstagram}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold border border-white/10 bg-white/5 hover:bg-white/10 transition-all hover:scale-105"
              >
                <InstagramIcon /> Instagram
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center border-t border-white/5">
        <p className="text-xs text-gray-600 uppercase tracking-widest">
          {title} · {new Date().getFullYear()} · Powered by Lopbuk
        </p>
      </footer>
    </div>
  )
}
