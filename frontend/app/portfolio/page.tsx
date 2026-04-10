'use client'

import { useEffect, useState, useRef } from 'react'
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

// ─── Componente CSS Lanyard 3D ────────────────────────────────────────────────
function LanyardCard({ accentColor, title }: { accentColor: string; title: string }) {
  return (
    <div className="flex flex-col items-center select-none">
      {/* Cuerda */}
      <div
        style={{
          width: 2,
          height: 80,
          background: `linear-gradient(to bottom, #888, ${accentColor})`,
          borderRadius: 1,
        }}
      />
      {/* Tarjeta 3D */}
      <div
        className="lanyard-card"
        style={
          {
            '--accent': accentColor,
          } as React.CSSProperties
        }
      >
        <div className="lanyard-card-inner">
          {/* Frente */}
          <div className="lanyard-card-face lanyard-front">
            <div
              className="absolute inset-0 rounded-2xl"
              style={{ background: `linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, ${accentColor}33 100%)` }}
            />
            <div className="relative z-10 flex flex-col h-full justify-between p-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: accentColor }}>D</div>
                <span className="text-white font-bold text-sm tracking-widest">DAIMUZ</span>
              </div>
              <div>
                <div className="h-6 w-10 rounded mb-2" style={{ background: `${accentColor}88` }} />
                <p className="text-gray-400 text-[10px] uppercase tracking-widest">Plataforma SaaS</p>
                <p className="text-white text-xs font-semibold mt-0.5">{title}</p>
              </div>
            </div>
          </div>
          {/* Dorso */}
          <div className="lanyard-card-face lanyard-back">
            <div
              className="absolute inset-0 rounded-2xl"
              style={{ background: `linear-gradient(135deg, ${accentColor}44 0%, #0a0a1a 100%)` }}
            />
            <div className="relative z-10 flex flex-col items-center justify-center h-full gap-2">
              <div className="text-2xl">⚡</div>
              <p className="text-white text-xs font-semibold tracking-widest">DAIMUZ</p>
              <p className="text-gray-500 text-[10px]">Gestión para tu negocio</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Toggle3DButton ───────────────────────────────────────────────────────────
function Toggle3DButton({ is3dEnabled, toggle, accentColor }: {
  is3dEnabled: boolean
  toggle: () => void
  accentColor: string
}) {
  return (
    <button
      onClick={toggle}
      title={`${is3dEnabled ? 'Ocultar' : 'Mostrar'} elemento 3D`}
      className="fixed top-24 right-4 z-50 p-3 rounded-full border backdrop-blur-sm transition-all duration-300 hover:scale-110"
      style={
        is3dEnabled
          ? {
              background: `${accentColor}33`,
              borderColor: accentColor,
              color: accentColor,
              boxShadow: `0 0 14px 3px ${accentColor}55`,
            }
          : {
              background: 'rgba(30,30,50,0.5)',
              borderColor: '#444',
              color: '#666',
            }
      }
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
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
  const [loading, setLoading] = useState(true)
  const [is3dEnabled, setIs3dEnabled] = useState(true)
  const [showQr, setShowQr] = useState(false)
  const pageUrl = typeof window !== 'undefined' ? window.location.href : ''
  const qrRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    fetch(`${API_URL}/portfolio/public`)
      .then(r => r.json())
      .then(json => { if (json.success) setData(json.data) })
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
        @keyframes lanyard-swing {
          0%, 100% { transform: rotateY(-12deg) rotateX(4deg); }
          50%       { transform: rotateY(12deg)  rotateX(-2deg); }
        }
        .lanyard-card {
          perspective: 900px;
          width: 160px;
          height: 240px;
        }
        .lanyard-card-inner {
          position: relative;
          width: 100%;
          height: 100%;
          transform-style: preserve-3d;
          animation: lanyard-swing 4s ease-in-out infinite;
        }
        .lanyard-card-face {
          position: absolute;
          inset: 0;
          backface-visibility: hidden;
          border-radius: 1rem;
          border: 1px solid rgba(255,255,255,0.08);
          overflow: hidden;
        }
        .lanyard-back {
          transform: rotateY(180deg);
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

      {/* Toggle3D */}
      <Toggle3DButton
        is3dEnabled={is3dEnabled}
        toggle={() => setIs3dEnabled(v => !v)}
        accentColor={accent}
      />

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center px-6 overflow-hidden">
        {/* Fondo decorativo */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${accent}22 0%, transparent 70%)`,
          }}
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

            <p className="text-xl text-gray-400 leading-relaxed max-w-lg">
              {subtitle}
            </p>

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
                  <QRCodeSVG value={pageUrl} size={120} />
                </div>
              )}
            </div>
          </div>

          {/* Lanyard 3D decorativo */}
          {is3dEnabled && (
            <div className="hidden lg:flex justify-center items-start float-slow pt-8">
              <LanyardCard accentColor={accent} title={title} />
            </div>
          )}
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 animate-bounce">
          <div className="w-px h-6 bg-gradient-to-b from-transparent to-gray-600" />
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-gray-600">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </section>

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
                    plan.highlighted
                      ? 'border-opacity-100 scale-[1.02]'
                      : 'border-white/5 bg-white/[0.03]'
                  }`}
                  style={
                    plan.highlighted
                      ? { borderColor: accent, background: `${accent}0f` }
                      : {}
                  }
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
