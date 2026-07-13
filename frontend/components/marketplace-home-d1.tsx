'use client'

import { useState, useEffect } from 'react'
import { Store, MapPin, Search, ShoppingCart, Truck, Shield, Phone } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

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

export function MarketplaceHomeD1() {
  const [stores, setStores] = useState<any[]>([])
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [platformSettings, setPlatformSettings] = useState<any>(null)

  useEffect(() => {
    let cancelled = false

    const fetchData = async () => {
      try {
        const [storesRes, platformRes, featuredRes] = await Promise.all([
          fetch(`${API_URL}/storefront/stores`),
          fetch(`${API_URL}/storefront/platform-settings`),
          fetch(`${API_URL}/storefront/platform-featured`),
        ])

        const storesJson = await storesRes.json()
        const platformJson = await platformRes.json()
        const featuredJson = await featuredRes.json()

        if (cancelled) return

        if (storesJson.success && storesJson.data) setStores(storesJson.data)
        if (platformJson.success && platformJson.data) setPlatformSettings(platformJson.data)
        if (featuredJson.success && featuredJson.data) setFeaturedProducts(featuredJson.data)
      } catch (e) {
        console.error('Error loading D1 marketplace:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()
    return () => { cancelled = true }
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

  if (loading) {
    return (
      <div style={{ background: '#F6F5F2', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: 8, background: '#E30613', margin: '0 auto 16px' }} />
          <p style={{ color: '#6B6660', fontSize: 14 }}>Cargando comercios...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: '#F6F5F2', minHeight: '100vh' }}>
      {/* ── TOPBAR — shipping options ── */}
      <div style={{ background: '#A80410', color: '#fff', fontSize: 12, padding: '6px 20px', display: 'flex', gap: 24, justifyContent: 'center' }}>
        <span>📦 Envío Programado</span>
        <span>⚡ Envío D1 Express</span>
      </div>

      {/* ── HEADER — red bar ── */}
      <header style={{ background: '#E30613', position: 'sticky', top: 0, zIndex: 50, boxShadow: '0 2px 8px rgba(0,0,0,.15)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ background: '#fff', color: '#E30613', fontFamily: 'Arial Black, sans-serif', fontSize: 26, padding: '4px 10px', borderRadius: 4 }}>D1</div>
          <div style={{ background: '#fff', borderRadius: 6, display: 'flex', alignItems: 'center', padding: '0 14px', height: 42, flex: 1 }}>
            <Search size={16} color="#6B6660" />
            <input
              placeholder="¿Qué estás buscando?"
              style={{ border: 'none', outline: 'none', flex: 1, fontSize: 14, marginLeft: 8, background: 'transparent' }}
            />
            <span style={{ color: '#6B6660', fontSize: 11, whiteSpace: 'nowrap', display: 'none' }} className="dq-search-hint">Búsquedas populares: extraordinarios, queso, congelados...</span>
          </div>
          <div style={{ display: 'flex', gap: 20, color: '#fff', fontSize: 13, fontWeight: 600 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <MapPin size={14} /> Dirección
            </span>
            <span style={{ cursor: 'pointer' }}>👤 Perfil</span>
            <div style={{ background: '#FFC629', color: '#1A1A1A', borderRadius: 6, padding: '8px 12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <ShoppingCart size={16} /> Carrito
            </div>
          </div>
        </div>
      </header>

      {/* ── CATEGORY STRIP ── */}
      <nav style={{ background: '#fff', borderBottom: '1px solid #E7E4DE', overflowX: 'auto', whiteSpace: 'nowrap' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '10px 20px', display: 'flex', gap: 22, fontSize: 13, fontWeight: 600 }}>
          {businessTypes.length > 0 ? (
            <>
              <a style={{ padding: '4px 0', borderBottom: '2px solid #E30613', color: '#E30613', cursor: 'pointer' }}>{businessTypes[0]}</a>
              {businessTypes.slice(1).map(type => (
                <a key={type} style={{ padding: '4px 0', color: '#1A1A1A', cursor: 'pointer' }}>{type}</a>
              ))}
            </>
          ) : (
            <>
              <a style={{ padding: '4px 0', borderBottom: '2px solid #E30613', color: '#E30613', cursor: 'pointer' }}>Extraordinarios</a>
              <a style={{ padding: '4px 0', color: '#1A1A1A', cursor: 'pointer' }}>Alimentos y despensa</a>
              <a style={{ padding: '4px 0', color: '#1A1A1A', cursor: 'pointer' }}>Bebidas</a>
              <a style={{ padding: '4px 0', color: '#1A1A1A', cursor: 'pointer' }}>Lácteos y huevos</a>
              <a style={{ padding: '4px 0', color: '#1A1A1A', cursor: 'pointer' }}>Cuidado personal</a>
              <a style={{ padding: '4px 0', color: '#1A1A1A', cursor: 'pointer' }}>Licor y vinos</a>
              <a style={{ padding: '4px 0', color: '#1A1A1A', cursor: 'pointer' }}>Congelados</a>
              <a style={{ padding: '4px 0', color: '#1A1A1A', cursor: 'pointer' }}>Hogar</a>
              <a style={{ padding: '4px 0', color: '#1A1A1A', cursor: 'pointer' }}>Aseo y limpieza</a>
            </>
          )}
        </div>
      </nav>

      {/* ── MAIN ── */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px 60px' }}>
        {/* ── HERO BANNER ── */}
        <section style={{ background: 'linear-gradient(120deg, #E30613, #A80410)', borderRadius: 14, color: '#fff', padding: '40px 36px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24, marginBottom: 36, flexWrap: 'wrap' }}>
          <div style={{ maxWidth: 520 }}>
            <span style={{ background: '#FFC629', color: '#1A1A1A', display: 'inline-block', padding: '4px 10px', borderRadius: 4, fontSize: 12, fontWeight: 800 }}>
              Temporada de ofertas
            </span>
            <h1 style={{ fontSize: 34, fontFamily: 'Arial Black, sans-serif', margin: '12px 0 8px', lineHeight: 1.15 }}>
              {platformSettings?.hero_title || '¡Si lo quieres, lo tienes!'}
            </h1>
            <p style={{ fontSize: 15, opacity: 0.92, marginBottom: 18, lineHeight: 1.5 }}>
              {platformSettings?.hero_subtitle || 'Descubre los mejores comercios y productos en un solo lugar. Calidad, variedad y los precios más bajos.'}
            </p>
            <button
              style={{ background: '#FFC629', color: '#1A1A1A', border: 'none', padding: '12px 22px', borderRadius: 6, fontWeight: 800, cursor: 'pointer', fontSize: 14 }}
              onClick={() => document.getElementById('dq-stores-section')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Explorar comercios
            </button>
          </div>
          <div style={{ background: '#fff', color: '#E30613', width: 130, height: 130, borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial Black, sans-serif', boxShadow: '0 6px 18px rgba(0,0,0,.2)', flexShrink: 0 }}>
            <span style={{ fontSize: 26, lineHeight: 1 }}>{stores.length}</span>
            <span style={{ fontSize: 11, fontWeight: 600 }}>COMERCIOS</span>
          </div>
        </section>

        {/* ── CATEGORY GRID ── */}
        {businessTypes.length > 0 && (
          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 22, fontFamily: 'Arial Black, sans-serif', marginBottom: 16, color: '#1A1A1A' }}>Explora por categoría</h2>
            <div className="dq-grid-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14 }}>
              {businessTypes.map(type => (
                <div
                  key={type}
                  style={{ background: '#fff', border: '1px solid #E7E4DE', borderRadius: 12, padding: '18px 10px', textAlign: 'center', cursor: 'pointer' }}
                >
                  <div style={{ width: 56, height: 56, borderRadius: '50%', margin: '0 auto 10px', background: 'linear-gradient(135deg, #FFC629, #E30613)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                    {BUSINESS_TYPE_ICONS[type] || '🏪'}
                  </div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#1A1A1A', lineHeight: 1.3 }}>{type}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── FEATURED STORES ── */}
        <section id="dq-stores-section" style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 22, fontFamily: 'Arial Black, sans-serif', marginBottom: 16, color: '#1A1A1A' }}>Comercios destacados</h2>
          {stores.length === 0 ? (
            <p style={{ color: '#6B6660', fontSize: 14 }}>No hay comercios disponibles aún.</p>
          ) : (
            <div className="dq-grid-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14 }}>
              {stores.slice(0, 12).map(store => (
                <div
                  key={store.id}
                  style={{ background: '#fff', border: '1px solid #E7E4DE', borderRadius: 10, padding: 14, cursor: 'pointer', transition: 'box-shadow 0.2s' }}
                  onClick={() => gotoStore(store.slug)}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.08)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                >
                  <div style={{ height: 100, borderRadius: 6, background: '#f1efe9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10, overflow: 'hidden' }}>
                    {store.logoUrl ? (
                      <img src={store.logoUrl} alt={store.name} style={{ maxHeight: 60, maxWidth: '80%', objectFit: 'contain' }} />
                    ) : (
                      <Store size={40} color="#ccc" />
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: '#6B6660', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>
                    {store.businessType || 'Tienda'}
                  </div>
                  <p style={{ fontSize: 12, fontWeight: 600, margin: '4px 0 8px', lineHeight: 1.3, color: '#1A1A1A' }}>{store.name}</p>
                  {store.isVerified && <span style={{ fontSize: 11, color: '#E30613', fontWeight: 600 }}>✓ Verificado</span>}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── TOP STORES ── */}
        {stores.length > 0 && (
          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 22, fontFamily: 'Arial Black, sans-serif', marginBottom: 16, color: '#1A1A1A' }}>Los más visitados</h2>
            <div className="dq-grid-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14 }}>
              {stores.slice(0, 6).map(store => (
                <div
                  key={store.id}
                  style={{ background: '#fff', border: '1px solid #E7E4DE', borderRadius: 10, padding: 14, cursor: 'pointer', transition: 'box-shadow 0.2s' }}
                  onClick={() => gotoStore(store.slug)}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.08)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                >
                  <div style={{ height: 100, borderRadius: 6, background: '#f1efe9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10, overflow: 'hidden' }}>
                    {store.logoUrl ? (
                      <img src={store.logoUrl} alt={store.name} style={{ maxHeight: 60, objectFit: 'contain' }} />
                    ) : (
                      <Store size={40} color="#ccc" />
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: '#6B6660', fontWeight: 700 }}>
                    {store.productCount || store.totalProducts || 0} productos
                  </div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A', marginTop: 4 }}>{store.name}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── PLATFORM FEATURED PRODUCTS ── */}
        {featuredProducts.length > 0 && (
          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 22, fontFamily: 'Arial Black, sans-serif', marginBottom: 16, color: '#1A1A1A' }}>Productos destacados</h2>
            <div className="dq-grid-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14 }}>
              {featuredProducts.slice(0, 12).map((product: any) => (
                <div
                  key={product.id}
                  style={{ background: '#fff', border: '1px solid #E7E4DE', borderRadius: 10, padding: 14, cursor: 'pointer', transition: 'box-shadow 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.08)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                >
                  <div style={{ height: 100, borderRadius: 6, background: '#f1efe9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10, overflow: 'hidden' }}>
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} style={{ maxHeight: 80, maxWidth: '80%', objectFit: 'contain' }} />
                    ) : (
                      <ShoppingCart size={36} color="#ccc" />
                    )}
                  </div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#1A1A1A', lineHeight: 1.3, marginBottom: 4 }}>{product.name}</p>
                  {product.price && (
                    <p style={{ fontSize: 13, fontWeight: 800, color: '#E30613' }}>
                      ${Number(product.price).toLocaleString('es-CO')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── TRUST BADGES ── */}
        <section style={{ marginBottom: 40 }}>
          <div className="dq-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div style={{ background: '#fff', border: '1px solid #E7E4DE', borderRadius: 12, padding: 20 }}>
              <Truck size={28} color="#E30613" style={{ marginBottom: 12 }} />
              <h3 style={{ fontSize: 15, marginBottom: 6, color: '#1A1A1A', fontWeight: 700 }}>Envíos a todo el país</h3>
              <p style={{ fontSize: 13, color: '#6B6660', lineHeight: 1.4 }}>Disfruta de los mejores productos y recíbelos en la puerta de tu casa.</p>
            </div>
            <div style={{ background: '#fff', border: '1px solid #E7E4DE', borderRadius: 12, padding: 20 }}>
              <Shield size={28} color="#E30613" style={{ marginBottom: 12 }} />
              <h3 style={{ fontSize: 15, marginBottom: 6, color: '#1A1A1A', fontWeight: 700 }}>Compras seguras</h3>
              <p style={{ fontSize: 13, color: '#6B6660', lineHeight: 1.4 }}>Contamos con un sistema seguro para la protección de tus datos personales.</p>
            </div>
            <div style={{ background: '#fff', border: '1px solid #E7E4DE', borderRadius: 12, padding: 20 }}>
              <Phone size={28} color="#E30613" style={{ marginBottom: 12 }} />
              <h3 style={{ fontSize: 15, marginBottom: 6, color: '#1A1A1A', fontWeight: 700 }}>Soporte dedicado</h3>
              <p style={{ fontSize: 13, color: '#6B6660', lineHeight: 1.4 }}>Conoce nuestras líneas de atención para resolver tus inquietudes.</p>
            </div>
          </div>
        </section>

        {/* ── NEWSLETTER ── */}
        <section style={{ background: '#1A1A1A', color: '#fff', borderRadius: 14, padding: '32px 36px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24, marginBottom: 40, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ fontSize: 20, marginBottom: 4, fontWeight: 700 }}>Suscríbete</h3>
            <p style={{ fontSize: 13, opacity: 0.8 }}>Déjanos tu correo y recibe las mejores ofertas de nuestros comercios</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <input
              type="email"
              placeholder="Correo electrónico"
              style={{ padding: '11px 14px', borderRadius: 6, border: 'none', width: 240, fontSize: 14, outline: 'none' }}
            />
            <button style={{ background: '#FFC629', color: '#1A1A1A', border: 'none', padding: '11px 20px', borderRadius: 6, fontWeight: 800, cursor: 'pointer', fontSize: 14 }}>
              Suscribirme
            </button>
          </div>
        </section>
      </main>

      {/* ── FOOTER ── */}
      <footer style={{ background: '#A80410', color: '#fff', padding: '44px 20px 20px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '1.5fr repeat(3, 1fr)', gap: 28 }}>
          <div>
            <div style={{ background: '#fff', color: '#E30613', fontFamily: 'Arial Black, sans-serif', fontSize: 26, padding: '4px 10px', borderRadius: 4, display: 'inline-block', marginBottom: 14 }}>D1</div>
            <p style={{ fontSize: 12, opacity: 0.85, marginBottom: 8, lineHeight: 1.5 }}>
              Atención al cliente<br />
              soporte@daimuz.com
            </p>
            <p style={{ fontSize: 12, opacity: 0.7 }}>2026 &copy; DAIMUZ</p>
          </div>
          <div>
            <h4 style={{ fontSize: 13, marginBottom: 14, textTransform: 'uppercase', color: '#FFC629', fontWeight: 700 }}>Comercios</h4>
            <ul style={{ listStyle: 'none', padding: 0, fontSize: 12, opacity: 0.85, lineHeight: 2 }}>
              <li>Gastronómicos</li>
              <li>Tiendas</li>
              <li>Servicios</li>
              <li>Ferreterías</li>
            </ul>
          </div>
          <div>
            <h4 style={{ fontSize: 13, marginBottom: 14, textTransform: 'uppercase', color: '#FFC629', fontWeight: 700 }}>Ayuda</h4>
            <ul style={{ listStyle: 'none', padding: 0, fontSize: 12, opacity: 0.85, lineHeight: 2 }}>
              <li>Preguntas frecuentes</li>
              <li>Contacto</li>
              <li>Términos</li>
              <li>Privacidad</li>
            </ul>
          </div>
          <div>
            <h4 style={{ fontSize: 13, marginBottom: 14, textTransform: 'uppercase', color: '#FFC629', fontWeight: 700 }}>Links</h4>
            <ul style={{ listStyle: 'none', padding: 0, fontSize: 12, opacity: 0.85, lineHeight: 2 }}>
              <li>Facturación</li>
              <li>Rastrear pedido</li>
              <li>Google Play</li>
              <li>App Store</li>
            </ul>
          </div>
        </div>
        <div style={{ maxWidth: 1200, margin: '36px auto 0', paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.15)', display: 'flex', justifyContent: 'space-between', fontSize: 12, opacity: 0.75 }}>
          <span>Medios de pago y sitio seguro</span>
          <span>Síguenos</span>
        </div>
      </footer>

      <style>{`
        @media (max-width: 1024px) {
          .dq-grid-6 { grid-template-columns: repeat(4, 1fr) !important; }
        }
        @media (max-width: 768px) {
          .dq-grid-6 { grid-template-columns: repeat(3, 1fr) !important; }
          .dq-grid-3 { grid-template-columns: 1fr !important; }
          .dq-search-hint { display: none !important; }
        }
        @media (max-width: 480px) {
          .dq-grid-6 { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  )
}
