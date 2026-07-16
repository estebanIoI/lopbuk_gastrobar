'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Property {
  id: string; code: string; title: string; description: string | null;
  property_type: string; operation_type: string; status: string;
  price: number; admin_fee: number | null;
  address: string | null; city: string | null; neighborhood: string | null;
  state_province: string | null; stratum: number | null;
  area_m2: number | null; built_area_m2: number | null;
  bedrooms: number; bathrooms: number; garages: number;
  cover_image_url: string | null; tags: string[]; seo_slug: string | null;
  is_featured: number; age_years: number | null;
  features?: string[]; media?: any[];
}

interface Tenant { id: string; name: string; slug: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const COP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

const TYPE_LABELS: Record<string, string> = {
  casa: 'Casa', apartamento: 'Apartamento', local: 'Local',
  oficina: 'Oficina', bodega: 'Bodega', lote: 'Lote',
  finca: 'Finca', consultorio: 'Consultorio', hotel: 'Hotel', proyecto: 'Proyecto',
}

const OP_LABELS: Record<string, string> = {
  venta: 'Venta', arriendo: 'Arriendo', venta_arriendo: 'Venta / Arriendo',
}

const FEATURE_LABELS: Record<string, string> = {
  piscina: 'Piscina', ascensor: 'Ascensor', vigilancia: 'Vigilancia',
  terraza: 'Terraza', patio: 'Patio', balcon: 'Balcón',
  aire_acondicionado: 'A/C', parqueadero: 'Parqueadero', bodega: 'Bodega',
  amoblado: 'Amoblado', mascotas: 'Mascotas OK', gym: 'Gimnasio',
  sauna: 'Sauna', salon_comunal: 'Salón comunal', cancha: 'Cancha',
  porteria: 'Portería',
}

// ─── Lead Form Modal ──────────────────────────────────────────────────────────

function LeadModal({ slug, propertyId, onClose }: { slug: string; propertyId?: string; onClose: () => void }) {
  const [form, setForm] = useState({ full_name: '', phone: '', email: '', interested_in: 'venta' })
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const send = async () => {
    if (!form.full_name.trim() || !form.phone.trim()) return
    setLoading(true)
    await api.registerRELead(slug, { ...form, property_id: propertyId, source: 'portal' })
    setSent(true)
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {sent ? (
          <div className="text-center py-8">
            <div className="text-5xl mb-4">✅</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">¡Solicitud enviada!</h3>
            <p className="text-gray-500 mb-6">Un asesor se pondrá en contacto contigo pronto.</p>
            <button onClick={onClose} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-medium">
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <h3 className="text-xl font-bold text-gray-900 mb-1">Solicitar información</h3>
            <p className="text-gray-500 text-sm mb-5">Un asesor se comunicará contigo a la brevedad.</p>
            <div className="space-y-3">
              <input
                type="text" placeholder="Tu nombre completo *"
                className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              />
              <input
                type="tel" placeholder="WhatsApp / teléfono *"
                className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              />
              <input
                type="email" placeholder="Correo (opcional)"
                className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              />
              <select
                className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.interested_in} onChange={e => setForm(f => ({ ...f, interested_in: e.target.value }))}
              >
                <option value="venta">Quiero comprar</option>
                <option value="arriendo">Quiero arrendar</option>
                <option value="ambos">Comprar o arrendar</option>
              </select>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl font-medium text-sm">
                Cancelar
              </button>
              <button
                onClick={send} disabled={loading || !form.full_name || !form.phone}
                className="flex-1 bg-blue-600 disabled:opacity-50 text-white py-3 rounded-xl font-medium text-sm"
              >
                {loading ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Property Detail Modal ────────────────────────────────────────────────────

function PropertyDetail({
  property, slug, onClose,
}: { property: Property; slug: string; onClose: () => void }) {
  const [detail, setDetail] = useState<Property | null>(null)
  const [imgIdx, setImgIdx] = useState(0)
  const [showLead, setShowLead] = useState(false)

  useEffect(() => {
    api.getPublicREPropertyDetail(slug, property.id).then(r => {
      if (r.success && r.data?.property) setDetail(r.data.property)
    })
  }, [slug, property.id])

  const prop = detail ?? property
  const media = detail?.media ?? []
  const photos = media.filter((m: any) => m.media_type === 'foto' || m.media_type === 'video')

  return (
    <div className="fixed inset-0 z-40 bg-black/70 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-2xl sm:rounded-2xl max-h-[95svh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Gallery */}
        <div className="relative aspect-video bg-gray-100">
          {photos.length > 0 ? (
            <>
              <img src={photos[imgIdx]?.url} alt="" className="w-full h-full object-cover" />
              {photos.length > 1 && (
                <>
                  <button
                    onClick={() => setImgIdx(i => (i - 1 + photos.length) % photos.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white w-9 h-9 rounded-full flex items-center justify-center text-lg"
                  >‹</button>
                  <button
                    onClick={() => setImgIdx(i => (i + 1) % photos.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white w-9 h-9 rounded-full flex items-center justify-center text-lg"
                  >›</button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                    {photos.map((_: any, i: number) => (
                      <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === imgIdx ? 'bg-white' : 'bg-white/50'}`} />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-300">
              <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
            </div>
          )}
          <button onClick={onClose} className="absolute top-3 right-3 bg-black/50 text-white w-8 h-8 rounded-full flex items-center justify-center text-lg">×</button>
          {prop.is_featured === 1 && (
            <span className="absolute top-3 left-3 bg-amber-400 text-amber-900 text-xs font-bold px-2 py-1 rounded-full">Destacado</span>
          )}
        </div>

        {/* Content */}
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{prop.title}</h2>
              {prop.neighborhood && <p className="text-sm text-gray-500">{prop.neighborhood}{prop.city ? `, ${prop.city}` : ''}</p>}
            </div>
            <div className="text-right shrink-0">
              <p className="text-xl font-bold text-blue-600">{COP(prop.price)}</p>
              {prop.admin_fee && <p className="text-xs text-gray-500">+ adm. {COP(prop.admin_fee)}/mes</p>}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <span className="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full font-medium">{TYPE_LABELS[prop.property_type] ?? prop.property_type}</span>
            <span className="bg-green-50 text-green-700 text-xs px-2 py-1 rounded-full font-medium">{OP_LABELS[prop.operation_type] ?? prop.operation_type}</span>
            {prop.stratum && <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">Estrato {prop.stratum}</span>}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-2 mb-4 bg-gray-50 rounded-xl p-3">
            {[
              { label: 'Habitaciones', value: prop.bedrooms, icon: '🛏️' },
              { label: 'Baños', value: prop.bathrooms, icon: '🚿' },
              { label: 'Garajes', value: prop.garages, icon: '🚗' },
              { label: 'Área m²', value: prop.area_m2 ?? '—', icon: '📐' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="text-lg">{s.icon}</div>
                <div className="text-sm font-bold text-gray-800">{s.value}</div>
                <div className="text-xs text-gray-400">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Description */}
          {prop.description && (
            <div className="mb-4">
              <h4 className="font-semibold text-gray-800 mb-1">Descripción</h4>
              <p className="text-sm text-gray-600 leading-relaxed">{prop.description}</p>
            </div>
          )}

          {/* Features */}
          {prop.features && prop.features.length > 0 && (
            <div className="mb-4">
              <h4 className="font-semibold text-gray-800 mb-2">Características</h4>
              <div className="flex flex-wrap gap-2">
                {prop.features.map((f: string) => (
                  <span key={f} className="bg-emerald-50 text-emerald-700 text-xs px-2 py-1 rounded-full border border-emerald-200">
                    {FEATURE_LABELS[f] ?? f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Address */}
          {prop.address && (
            <p className="text-sm text-gray-500 mb-4">📍 {prop.address}</p>
          )}

          <button
            onClick={() => setShowLead(true)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl transition-colors"
          >
            Solicitar información
          </button>
        </div>

        {showLead && (
          <LeadModal slug={slug} propertyId={prop.id} onClose={() => setShowLead(false)} />
        )}
      </div>
    </div>
  )
}

// ─── Property Card ────────────────────────────────────────────────────────────

function PropertyCard({ property, onClick }: { property: Property; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow border border-gray-100 text-left group"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
        {property.cover_image_url ? (
          <img
            src={property.cover_image_url}
            alt={property.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-300">
            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
          </div>
        )}
        {property.is_featured === 1 && (
          <span className="absolute top-2 left-2 bg-amber-400 text-amber-900 text-xs font-bold px-2 py-0.5 rounded-full">Destacado</span>
        )}
        <span className="absolute top-2 right-2 bg-white/90 text-gray-700 text-xs font-semibold px-2 py-0.5 rounded-full">
          {OP_LABELS[property.operation_type] ?? property.operation_type}
        </span>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="font-bold text-blue-600 text-base">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', notation: 'compact', maximumFractionDigits: 1 }).format(property.price)}</p>
        <h3 className="font-semibold text-gray-900 text-sm leading-tight mt-0.5 line-clamp-1">{property.title}</h3>
        {property.neighborhood && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">📍 {property.neighborhood}{property.city ? `, ${property.city}` : ''}</p>
        )}
        <div className="flex gap-2 mt-2 text-xs text-gray-500">
          {property.bedrooms > 0 && <span>🛏️ {property.bedrooms}</span>}
          {property.bathrooms > 0 && <span>🚿 {property.bathrooms}</span>}
          {property.area_m2 && <span>📐 {property.area_m2}m²</span>}
        </div>
        <p className="text-xs text-gray-400 mt-1">{TYPE_LABELS[property.property_type] ?? property.property_type}</p>
      </div>
    </button>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InmobiliariaPublicPage() {
  const { slug } = useParams<{ slug: string }>()

  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [selected, setSelected] = useState<Property | null>(null)
  const [showLeadGlobal, setShowLeadGlobal] = useState(false)

  // Filters
  const [filters, setFilters] = useState({
    operation_type: '', property_type: '', city: '', minPrice: '', maxPrice: '',
    bedrooms: '', search: '',
  })

  const loadProperties = useCallback(async (f = filters) => {
    setLoading(true)
    const params: Record<string, string> = {}
    if (f.operation_type) params.operation_type = f.operation_type
    if (f.property_type)  params.property_type  = f.property_type
    if (f.city)           params.city           = f.city
    if (f.minPrice)       params.minPrice       = f.minPrice
    if (f.maxPrice)       params.maxPrice       = f.maxPrice
    if (f.bedrooms)       params.bedrooms       = f.bedrooms
    if (f.search)         params.search         = f.search

    const r = await api.getPublicREProperties(slug, params)
    setLoading(false)
    if (!r.success || !r.data) { setNotFound(true); return }
    setTenant(r.data.tenant)
    setProperties(r.data.properties ?? [])
  }, [slug, filters])

  useEffect(() => { loadProperties() }, [slug])

  const handleSearch = () => loadProperties(filters)

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-6xl mb-4">🏠</div>
          <h1 className="text-2xl font-bold text-gray-700 mb-2">Portal no disponible</h1>
          <p className="text-gray-500">Este portal inmobiliario no está activo o no existe.</p>
        </div>
      </div>
    )
  }

  const cities = [...new Set(properties.map(p => p.city).filter(Boolean))] as string[]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">{tenant?.name ?? '...'}</h1>
            <p className="text-xs text-gray-500">Portal Inmobiliario</p>
          </div>
          <button
            onClick={() => setShowLeadGlobal(true)}
            className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-xl"
          >
            Contactar asesor
          </button>
        </div>
      </header>

      {/* Hero search bar */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-500 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-white text-2xl font-bold mb-1 text-center">Encuentra tu próximo hogar</h2>
          <p className="text-blue-100 text-sm text-center mb-5">Propiedades disponibles en tu ciudad</p>
          <div className="bg-white rounded-2xl p-3 shadow-xl flex flex-wrap gap-2">
            <input
              type="text" placeholder="Buscar por nombre, barrio..."
              className="flex-1 min-w-[140px] border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
            <select
              className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={filters.operation_type} onChange={e => setFilters(f => ({ ...f, operation_type: e.target.value }))}
            >
              <option value="">Todo</option>
              <option value="venta">Venta</option>
              <option value="arriendo">Arriendo</option>
            </select>
            <select
              className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={filters.property_type} onChange={e => setFilters(f => ({ ...f, property_type: e.target.value }))}
            >
              <option value="">Tipo</option>
              {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {cities.length > 0 && (
              <select
                className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={filters.city} onChange={e => setFilters(f => ({ ...f, city: e.target.value }))}
              >
                <option value="">Ciudad</option>
                {cities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <button
              onClick={handleSearch}
              className="bg-blue-600 text-white px-5 py-2 rounded-xl font-medium text-sm"
            >
              Buscar
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            {loading ? 'Cargando...' : `${properties.length} propiedad${properties.length !== 1 ? 'es' : ''} disponible${properties.length !== 1 ? 's' : ''}`}
          </p>
          {Object.values(filters).some(Boolean) && (
            <button
              onClick={() => { setFilters({ operation_type: '', property_type: '', city: '', minPrice: '', maxPrice: '', bedrooms: '', search: '' }); loadProperties({ operation_type: '', property_type: '', city: '', minPrice: '', maxPrice: '', bedrooms: '', search: '' }); }}
              className="text-xs text-blue-600 underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden animate-pulse">
                <div className="aspect-[4/3] bg-gray-200" />
                <div className="p-3 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                  <div className="h-3 bg-gray-200 rounded" />
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : properties.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-xl font-bold text-gray-700 mb-2">Sin resultados</h3>
            <p className="text-gray-500">No encontramos propiedades con esos filtros.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {properties.map(p => (
              <PropertyCard key={p.id} property={p} onClick={() => setSelected(p)} />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-gray-400 border-t mt-8">
        Portal gestionado con <span className="text-blue-500 font-medium">Daimuz</span>
      </footer>

      {/* Modals */}
      {selected && (
        <PropertyDetail property={selected} slug={slug} onClose={() => setSelected(null)} />
      )}
      {showLeadGlobal && (
        <LeadModal slug={slug} onClose={() => setShowLeadGlobal(false)} />
      )}
    </div>
  )
}
