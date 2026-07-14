'use client'

import { useState, useEffect, useMemo } from 'react'
import { Store, MapPin, Search, ShoppingCart, Truck, Shield, Phone, ExternalLink } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

// Estética minimalista: monocromo negro/blanco (el acento es casi-negro).
const FALLBACK_ACCENT = '#1A1A1A'
const FALLBACK_DARK = '#000000'

const BUSINESS_TYPE_ICONS: Record<string, string> = {
  'Gastronómico': '🍽️',
  'Restaurante': '🍽️',
  'Tienda': '🛍️',
  'Ferretería': '🔧',
  'Servicio': '💼',
  'Supermercado': '🛒',
  'Licorera': '🍷',
  'Panadería': '🍞',
  'Farmacia': '💊',
  'Ropa': '👕',
  'Tecnología': '💻',
  'Hogar': '🏠',
}

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; color?: string; style?: any; className?: string }>> = {
  Truck, Shield, Phone, ShoppingCart, Store, MapPin, Search,
}

/* ── StoreCard (glassmorphism sobre fondo D1) ── */
function StoreCardD1({ store, onClick }: { store: any; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="dq-glass rounded-xl overflow-hidden cursor-pointer group"
    >
      <div className="h-28 flex items-center justify-center overflow-hidden relative" style={{ background: 'var(--dq-img)' }}>
        {store.logoUrl ? (
          <img src={store.logoUrl} alt={store.name} className="max-h-16 max-w-[80%] object-contain group-hover:scale-105 transition-transform" loading="lazy" />
        ) : store.coverUrl ? (
          <img src={store.coverUrl} alt={store.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
        ) : (
          <Store size={40} color="#ccc" />
        )}
        {store.isVerified && (
          <span className="absolute top-2 right-2 bg-[var(--dq-accent, #1A1A1A)] text-white text-[9px] font-bold px-1.5 py-0.5 rounded">VERIFICADO</span>
        )}
      </div>
      <div className="p-3 space-y-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--dq-muted)' }}>{store.businessType || 'Tienda'}</span>
        <h3 className="text-sm font-semibold line-clamp-1" style={{ color: 'var(--dq-text)' }}>{store.name}</h3>
        <div className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--dq-muted)' }}>
          <MapPin className="w-3 h-3 shrink-0" />
          <span className="truncate">{store.city || store.address || ''}</span>
        </div>
        {store.openState === 'closed' && store.nextOpenLabel && (
          <p className="text-[11px] truncate" style={{ color: 'var(--dq-muted)' }}>🕒 {store.nextOpenLabel}</p>
        )}
      </div>
    </div>
  )
}

/* ── Section renderers ── */
function renderHero(config: Record<string, any>, storeCount: number, platformSettings: any) {
  return (
    <section style={{ background: 'linear-gradient(120deg, rgba(24,24,24,0.80), rgba(0,0,0,0.68))', backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)', border: '1px solid rgba(255,255,255,0.14)', boxShadow: '0 16px 50px rgba(0,0,0,0.26)', borderRadius: 14, color: '#fff', padding: '40px 36px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24, marginBottom: 36, flexWrap: 'wrap' }}>
      <div style={{ maxWidth: 520 }}>
        {config.eyebrow && (
          <span style={{ background: '#fff', color: '#111', display: 'inline-block', padding: '4px 10px', borderRadius: 4, fontSize: 12, fontWeight: 800 }}>
            {config.eyebrow}
          </span>
        )}
        <h1 style={{ fontSize: 34, fontFamily: 'Arial Black, sans-serif', margin: '12px 0 8px', lineHeight: 1.15 }}>
          {config.title || platformSettings?.hero_title || '¡Si lo quieres, lo tienes!'}
        </h1>
        <p style={{ fontSize: 15, opacity: 0.92, marginBottom: 18, lineHeight: 1.5 }}>
          {config.subtitle || platformSettings?.hero_subtitle || 'Descubre los mejores comercios y productos en un solo lugar. Calidad, variedad y los precios más bajos.'}
        </p>
        {config.ctaText && (
          <button
            style={{ background: '#fff', color: '#111', border: 'none', padding: '12px 22px', borderRadius: 6, fontWeight: 800, cursor: 'pointer', fontSize: 14 }}
            onClick={() => document.getElementById('dq-stores-section')?.scrollIntoView({ behavior: 'smooth' })}
          >
            {config.ctaText}
          </button>
        )}
      </div>
      {config.showCounter !== false && (
        <div style={{ background: 'rgba(255,255,255,0.78)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,0.7)', color: 'var(--dq-accent, #1A1A1A)', width: 130, height: 130, borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial Black, sans-serif', boxShadow: '0 10px 30px rgba(0,0,0,.18)', flexShrink: 0 }}>
          <span style={{ fontSize: 26, lineHeight: 1 }}>{storeCount}</span>
          <span style={{ fontSize: 11, fontWeight: 600 }}>COMERCIOS</span>
        </div>
      )}
    </section>
  )
}

function renderTrustBadges(badges: any[] | null) {
  if (!badges?.length) return null
  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(badges.length, 3)}, 1fr)`, gap: 16 }}>
        {badges.slice(0, 3).map((b: any) => {
          const Icon = ICON_MAP[b.icon] || Shield
          return (
            <div key={b.id} className="dq-glass" style={{ borderRadius: 12, padding: 20 }}>
              <Icon size={28} color="var(--dq-accent, #1A1A1A)" style={{ marginBottom: 12 }} />
              <h3 style={{ fontSize: 15, marginBottom: 6, color: 'var(--dq-text)', fontWeight: 700 }}>{b.title}</h3>
              <p style={{ fontSize: 13, color: 'var(--dq-muted)', lineHeight: 1.4 }}>{b.description}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function renderNewsletter(config: Record<string, any>) {
  return (
    <section style={{ background: config.bgColor || 'rgba(26,26,26,0.55)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.10)', boxShadow: '0 12px 40px rgba(0,0,0,0.18)', color: '#fff', borderRadius: 14, padding: '32px 36px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24, marginBottom: 40, flexWrap: 'wrap' }}>
      <div>
        <h3 style={{ fontSize: 20, marginBottom: 4, fontWeight: 700 }}>{config.title || 'Suscríbete'}</h3>
        <p style={{ fontSize: 13, opacity: 0.8 }}>{config.subtitle || 'Déjanos tu correo y recibe las mejores ofertas de nuestros comercios'}</p>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <input
          type="email"
          placeholder={config.emailPlaceholder || 'Correo electrónico'}
          style={{ padding: '11px 14px', borderRadius: 6, border: 'none', width: 240, fontSize: 14, outline: 'none' }}
        />
        <button style={{ background: '#fff', color: '#111', border: 'none', padding: '11px 20px', borderRadius: 6, fontWeight: 800, cursor: 'pointer', fontSize: 14 }}>
          {config.buttonText || 'Suscribirme'}
        </button>
      </div>
    </section>
  )
}

function renderFooter(config: Record<string, any>, platformSettings: any) {
  const cols: any[] = config.columns || []
  return (
    <footer style={{ background: 'rgba(17,17,17,0.86)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.12)', color: '#fff', padding: '44px 20px 20px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '1.5fr repeat(3, 1fr)', gap: 28 }}>
        <div>
          <div style={{ background: '#fff', color: 'var(--dq-accent, #1A1A1A)', fontFamily: 'Arial Black, sans-serif', fontSize: 26, padding: '4px 10px', borderRadius: 4, display: 'inline-block', marginBottom: 14 }}>D1</div>
          <p style={{ fontSize: 12, opacity: 0.85, marginBottom: 8, lineHeight: 1.5 }}>
            {config.contactEmail && <>Atención al cliente<br />{config.contactEmail}</>}
          </p>
          <p style={{ fontSize: 12, opacity: 0.7 }}>{config.copyright || '2026 \u00a9 DAIMUZ'}</p>
        </div>
        {cols.map((col: any, i: number) => {
          const links = col.links ? col.links.split(',').map((l: string) => {
            const parts = l.split('|').map(s => s.trim())
            return { label: parts[0], href: parts[1] || '#' }
          }) : []
          return (
            <div key={i}>
              {col.title && <h4 style={{ fontSize: 13, marginBottom: 14, textTransform: 'uppercase', color: '#fff', fontWeight: 700, letterSpacing: '.04em' }}>{col.title}</h4>}
              <ul style={{ listStyle: 'none', padding: 0, fontSize: 12, opacity: 0.85, lineHeight: 2 }}>
                {links.map((l: any, j: number) => (
                  <li key={j}><a href={l.href} style={{ color: 'inherit', textDecoration: 'none' }}>{l.label}</a></li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
      <div style={{ maxWidth: 1200, margin: '36px auto 0', paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.15)', display: 'flex', justifyContent: 'space-between', fontSize: 12, opacity: 0.75 }}>
        <span>Medios de pago y sitio seguro</span>
        <span>Síguenos</span>
      </div>
    </footer>
  )
}

/* ── Main component ── */
export function MarketplaceHomeD1() {
  const [stores, setStores] = useState<any[]>([])
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [platformSettings, setPlatformSettings] = useState<any>(null)
  const [sections, setSections] = useState<any[]>([])
  const [trustBadges, setTrustBadges] = useState<any[] | null>(null)

  // Estética minimalista negro/blanco — el acento es siempre monocromo (casi-negro),
  // independiente de la colorimetría de la plataforma.
  const accent = useMemo(() => ({ primary: FALLBACK_ACCENT, dark: FALLBACK_DARK }), [])

  useEffect(() => {
    let cancelled = false

    const fetchData = async () => {
      try {
        const [storesRes, platformRes, featuredRes, sectionsRes, badgesRes] = await Promise.all([
          fetch(`${API_URL}/storefront/stores`),
          fetch(`${API_URL}/storefront/platform-settings`),
          fetch(`${API_URL}/storefront/platform-featured`),
          fetch(`${API_URL}/homepage/platform`),
          fetch(`${API_URL}/trust-badges/public?store=_platform`),
        ])

        if (cancelled) return
        const [storesJson, platformJson, featuredJson, sectionsJson, badgesJson] =
          await Promise.all([storesRes.json(), platformRes.json(), featuredRes.json(), sectionsRes.json(), badgesRes.json()])

        if (storesJson.success && storesJson.data) setStores(storesJson.data)
        if (platformJson.success && platformJson.data) setPlatformSettings(platformJson.data)
        if (featuredJson.success && featuredJson.data) setFeaturedProducts(featuredJson.data)
        if (sectionsJson.success && sectionsJson.data?.length > 0) {
          const mapped = sectionsJson.data.map((s: any) => ({
            ...s,
            type: s.sectionType || s.type,
          })).filter((s: any) => s.enabled).sort((a: any, b: any) => a.sortOrder - b.sortOrder)
          setSections(mapped)
        }
        if (badgesJson.success && badgesJson.data?.length > 0) setTrustBadges(badgesJson.data)
      } catch (e) {
        console.error('Error loading D1 marketplace:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()
    return () => { cancelled = false }
  }, [])

  const businessTypes = Array.from(
    new Set(
      stores
        .map(s => s.businessType)
        .filter((t): t is string => !!t)
    )
  ).sort()

  const gotoStore = (slug: string) => {
    window.location.href = `/t/${slug}`
  }

  // ── Dynamic sections ──
  const heroSection = sections.find(s => s.type === 'hero')
  const footerSection = sections.find(s => s.type === 'footer')
  const newsletterSection = sections.find(s => s.type === 'newsletter')
  const trustSection = sections.find(s => s.type === 'trustBadges')
  const categoryGridSection = sections.find(s => s.type === 'categoryGrid')

  if (loading) {
    return (
      <div style={{ background: '#F6F5F2', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--dq-accent, #1A1A1A)', margin: '0 auto 16px' }} />
          <p style={{ color: '#6B6660', fontSize: 14 }}>Cargando comercios...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="dq-root" style={{ minHeight: '100vh', background: 'var(--dq-page)', backgroundAttachment: 'fixed' }}>
      <style>{`
        :root {
          --dq-accent: ${accent.primary};
          --dq-accent-dark: ${accent.dark};
        }
        /* Paleta clara (por defecto) */
        .dq-root {
          --dq-surface: rgba(255,255,255,0.58);
          --dq-surface-border: rgba(255,255,255,0.60);
          --dq-surface-border-hover: rgba(255,255,255,0.85);
          --dq-img: rgba(255,255,255,0.35);
          --dq-text: #1A1A1A;
          --dq-muted: #6B6660;
          --dq-shadow: 0 12px 36px rgba(0,0,0,0.07);
          --dq-shadow-hover: 0 22px 60px rgba(0,0,0,0.13);
          --dq-page: radial-gradient(1100px 620px at 8% -8%, rgba(0,0,0,0.05), transparent 60%), radial-gradient(980px 560px at 100% 4%, rgba(0,0,0,0.035), transparent 55%), radial-gradient(1000px 780px at 55% 120%, rgba(0,0,0,0.045), transparent 60%), linear-gradient(150deg,#FAFAFA,#F3F3F3 60%,#F6F6F6);
        }
        /* Paleta oscura — next-themes usa la clase .dark */
        .dark .dq-root {
          --dq-surface: rgba(17,24,39,0.60);
          --dq-surface-border: rgba(255,255,255,0.08);
          --dq-surface-border-hover: rgba(255,255,255,0.16);
          --dq-img: rgba(255,255,255,0.05);
          --dq-text: #F1F5F9;
          --dq-muted: #94A3B8;
          --dq-shadow: 0 12px 36px rgba(0,0,0,0.45);
          --dq-shadow-hover: 0 22px 60px rgba(0,0,0,0.58);
          --dq-page: radial-gradient(1100px 620px at 8% -8%, rgba(255,255,255,0.045), transparent 60%), radial-gradient(980px 560px at 100% 4%, rgba(255,255,255,0.03), transparent 55%), radial-gradient(1000px 780px at 55% 120%, rgba(255,255,255,0.035), transparent 60%), linear-gradient(150deg,#0E0E0E,#0A0A0A 60%,#101010);
        }
        .dq-glass {
          background: var(--dq-surface);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          border: 1px solid var(--dq-surface-border);
          box-shadow: var(--dq-shadow);
          transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
        }
        .dq-glass:hover {
          transform: translateY(-2px);
          box-shadow: var(--dq-shadow-hover);
          border-color: var(--dq-surface-border-hover);
        }
      `}</style>
      {/* ── TOPBAR — shipping options ── */}
      <div style={{ background: 'rgba(17,17,17,0.62)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', color: '#fff', fontSize: 12, padding: '6px 20px', display: 'flex', gap: 24, justifyContent: 'center', borderBottom: '1px solid rgba(255,255,255,0.10)' }}>
        <span>📦 Envío Programado</span>
        <span>⚡ Envío D1 Express</span>
      </div>

      {/* ── HEADER — glass tintado (rojo D1 translúcido) ── */}
      <header style={{ background: 'rgba(17,17,17,0.74)', backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)', position: 'sticky', top: 0, zIndex: 50, boxShadow: '0 8px 30px rgba(0,0,0,0.30)', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ background: '#fff', color: 'var(--dq-accent, #1A1A1A)', fontFamily: 'Arial Black, sans-serif', fontSize: 26, padding: '4px 10px', borderRadius: 4 }}>D1</div>
          <div style={{ background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 6, display: 'flex', alignItems: 'center', padding: '0 14px', height: 42, flex: 1 }}>
            <Search size={16} color="#6B6660" />
            <input
              placeholder="¿Qué estás buscando?"
              style={{ border: 'none', outline: 'none', flex: 1, fontSize: 14, marginLeft: 8, background: 'transparent' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 20, color: '#fff', fontSize: 13, fontWeight: 600 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <MapPin size={14} /> Dirección
            </span>
            <span style={{ cursor: 'pointer' }}>👤 Perfil</span>
            <div style={{ background: '#fff', color: '#111', borderRadius: 6, padding: '8px 12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <ShoppingCart size={16} /> Carrito
            </div>
          </div>
        </div>
      </header>

      {/* ── CATEGORY STRIP ── */}
      <nav style={{ background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', borderBottom: '1px solid rgba(255,255,255,0.6)', overflowX: 'auto', whiteSpace: 'nowrap' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '10px 20px', display: 'flex', gap: 22, fontSize: 13, fontWeight: 600 }}>
          {businessTypes.length > 0 ? (
            <>
              <a style={{ padding: '4px 0', borderBottom: '2px solid var(--dq-accent, #1A1A1A)', color: 'var(--dq-accent, #1A1A1A)', cursor: 'pointer' }}>{businessTypes[0]}</a>
              {businessTypes.slice(1).map(type => (
                <a key={type} style={{ padding: '4px 0', color: 'var(--dq-text)', cursor: 'pointer' }}>{type}</a>
              ))}
            </>
          ) : (
            <>
              <a style={{ padding: '4px 0', borderBottom: '2px solid var(--dq-accent, #1A1A1A)', color: 'var(--dq-accent, #1A1A1A)', cursor: 'pointer' }}>Extraordinarios</a>
              <a style={{ padding: '4px 0', color: 'var(--dq-text)', cursor: 'pointer' }}>Alimentos y despensa</a>
              <a style={{ padding: '4px 0', color: 'var(--dq-text)', cursor: 'pointer' }}>Bebidas</a>
              <a style={{ padding: '4px 0', color: 'var(--dq-text)', cursor: 'pointer' }}>Lácteos y huevos</a>
              <a style={{ padding: '4px 0', color: 'var(--dq-text)', cursor: 'pointer' }}>Cuidado personal</a>
              <a style={{ padding: '4px 0', color: 'var(--dq-text)', cursor: 'pointer' }}>Licor y vinos</a>
              <a style={{ padding: '4px 0', color: 'var(--dq-text)', cursor: 'pointer' }}>Congelados</a>
              <a style={{ padding: '4px 0', color: 'var(--dq-text)', cursor: 'pointer' }}>Hogar</a>
              <a style={{ padding: '4px 0', color: 'var(--dq-text)', cursor: 'pointer' }}>Aseo y limpieza</a>
            </>
          )}
        </div>
      </nav>

      {/* ── MAIN ── */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px 60px' }}>
        {/* ── HERO (dynamic or default) ── */}
        {heroSection ? renderHero(heroSection.config, stores.length, platformSettings) : renderHero({}, stores.length, platformSettings)}

        {/* ── CATEGORY GRID ── */}
        {categoryGridSection?.config?.showBusinessTypes !== false && businessTypes.length > 0 && (
          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 22, fontFamily: 'Arial Black, sans-serif', marginBottom: 16, color: 'var(--dq-text)' }}>
              {categoryGridSection?.config?.sectionTitle || 'Explora por categoría'}
            </h2>
            <div className="dq-grid-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14 }}>
              {businessTypes.map(type => (
                <div
                  key={type}
                  className="dq-glass"
                  style={{ borderRadius: 12, padding: '18px 10px', textAlign: 'center', cursor: 'pointer' }}
                >
                  <div style={{ width: 56, height: 56, borderRadius: '50%', margin: '0 auto 10px', background: 'linear-gradient(135deg, #EDEDED, #1A1A1A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                    {BUSINESS_TYPE_ICONS[type] || '🏪'}
                  </div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--dq-text)', lineHeight: 1.3 }}>{type}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── FEATURED STORES (Tema 2 style cards) ── */}
        <section id="dq-stores-section" style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 22, fontFamily: 'Arial Black, sans-serif', marginBottom: 16, color: 'var(--dq-text)' }}>Comercios destacados</h2>
          {stores.length === 0 ? (
            <p style={{ color: 'var(--dq-muted)', fontSize: 14 }}>No hay comercios disponibles aún.</p>
          ) : (
            <div className="dq-grid-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14 }}>
              {stores.slice(0, 12).map(store => (
                <StoreCardD1 key={store.id} store={store} onClick={() => gotoStore(store.slug)} />
              ))}
            </div>
          )}
        </section>

        {/* ── TOP STORES ── */}
        {stores.length > 0 && (
          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 22, fontFamily: 'Arial Black, sans-serif', marginBottom: 16, color: 'var(--dq-text)' }}>Los más visitados</h2>
            <div className="dq-grid-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14 }}>
              {stores.slice(0, 6).map(store => (
                <StoreCardD1 key={store.id} store={store} onClick={() => gotoStore(store.slug)} />
              ))}
            </div>
          </section>
        )}

        {/* ── PLATFORM FEATURED PRODUCTS ── */}
        {featuredProducts.length > 0 && (
          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 22, fontFamily: 'Arial Black, sans-serif', marginBottom: 16, color: 'var(--dq-text)' }}>Productos destacados</h2>
            <div className="dq-grid-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14 }}>
              {featuredProducts.slice(0, 12).map((product: any) => (
                <div
                  key={product.id}
                  className="dq-glass"
                  style={{ borderRadius: 10, padding: 14, cursor: 'pointer' }}
                >
                  <div style={{ height: 100, borderRadius: 6, background: 'var(--dq-img)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10, overflow: 'hidden' }}>
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} style={{ maxHeight: 80, maxWidth: '80%', objectFit: 'contain' }} />
                    ) : (
                      <ShoppingCart size={36} color="#ccc" />
                    )}
                  </div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--dq-text)', lineHeight: 1.3, marginBottom: 4 }}>{product.name}</p>
                  {product.price && (
                    <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--dq-accent, #1A1A1A)' }}>
                      ${Number(product.price).toLocaleString('es-CO')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── TRUST BADGES (dynamic) ── */}
        {renderTrustBadges(trustBadges)}

        {/* ── NEWSLETTER (dynamic or default) ── */}
        {renderNewsletter(newsletterSection?.config || {})}
      </main>

      {/* ── FOOTER (dynamic or default) ── */}
      {renderFooter(footerSection?.config || {}, platformSettings)}

      <style>{`
        @media (max-width: 1024px) {
          .dq-grid-6 { grid-template-columns: repeat(4, 1fr) !important; }
        }
        @media (max-width: 768px) {
          .dq-grid-6 { grid-template-columns: repeat(3, 1fr) !important; }
        }
        @media (max-width: 480px) {
          .dq-grid-6 { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  )
}
