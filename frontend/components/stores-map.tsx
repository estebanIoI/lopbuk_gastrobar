'use client'

/**
 * StoresSection — modal "Comercios" del marketplace (estilo D1 "Nuestras tiendas").
 * Se muestra como un modal (overlay con backdrop) sobre la página, NO como una sección
 * que empuja el contenido. Incluye buscador por departamento/ciudad + lista de comercios
 * junto a un mapa interactivo (Leaflet). Cada comercio se ubica en su lat/lng real; al
 * tocar una tarjeta (lista o pin) se abre Google Maps con la ubicación marcada.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { X, MapPin, List as ListIcon, Map as MapIcon, ExternalLink, Store as StoreIcon, Clock } from 'lucide-react'
import { cldImg } from '@/utils/img'

export interface MapStore {
  id: string
  name: string
  slug: string
  logoUrl?: string | null
  city?: string | null
  address?: string | null
  department?: string | null
  schedule?: string | null
  openState?: 'open' | 'closed'
  nextOpenLabel?: string | null
  latitude?: number | string | null
  longitude?: number | string | null
}

const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : NaN }
// Distancia Haversine en km entre dos coordenadas.
function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371, toRad = (d: number) => d * Math.PI / 180
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng)
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
}
const gmapsUrl = (lat: number, lng: number) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
const hasCoords = (s: MapStore) => { const a = num(s.latitude), b = num(s.longitude); return Number.isFinite(a) && Number.isFinite(b) && (a !== 0 || b !== 0) }

export function StoresSection({ stores, brandColor = '#00833E', brandDark = '#005C2A', onClose, onOpenStore, inline = false }: {
  stores: MapStore[]
  brandColor?: string
  brandDark?: string
  onClose: () => void
  onOpenStore?: (slug: string) => void
  /** Renderiza como sección integrada (empuja el contenido) en vez de modal overlay. */
  inline?: boolean
}) {
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null)
  const mapElRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const layerRef = useRef<any>(null)
  const [cssReady, setCssReady] = useState(false)
  const [mode, setMode] = useState<'lista' | 'mapa'>('lista') // toggle solo afecta a móvil
  const [dept, setDept] = useState('')
  const [city, setCity] = useState('')

  const departments = useMemo(() =>
    Array.from(new Set(stores.map(s => (s.department || '').trim()).filter(Boolean))).sort(), [stores])
  const cities = useMemo(() =>
    Array.from(new Set(stores
      .filter(s => !dept || (s.department || '').trim() === dept)
      .map(s => (s.city || '').trim()).filter(Boolean))).sort(), [stores, dept])

  const filtered = useMemo(() => {
    const list = stores
      .filter(s => (!dept || (s.department || '').trim() === dept) && (!city || (s.city || '').trim() === city))
      .map(s => {
        let distanceKm: number | null = null
        if (userLoc && hasCoords(s)) distanceKm = haversineKm(userLoc.lat, userLoc.lng, num(s.latitude), num(s.longitude))
        return { store: s, distanceKm }
      })
    // Si tenemos ubicación, ordena por cercanía (los sin coords al final).
    if (userLoc) list.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
    return list
  }, [stores, dept, city, userLoc])
  const located = useMemo(() => filtered.map(f => f.store).filter(hasCoords), [filtered])

  // Filtrado dinámico por lo visible en el mapa: al hacer zoom/mover, la lista solo
  // muestra los comercios cuyo pin está dentro del encuadre actual. `viewBounds` es un
  // L.LatLngBounds que se actualiza en cada moveend/zoomend. Los comercios sin coordenadas
  // se mantienen siempre (no se pueden ubicar en el mapa).
  const [viewBounds, setViewBounds] = useState<any>(null)
  const inView = useMemo(() => {
    if (!viewBounds) return filtered
    return filtered.filter(({ store: s }) => {
      if (!hasCoords(s)) return true
      try { return viewBounds.contains([num(s.latitude), num(s.longitude)]) } catch { return true }
    })
  }, [filtered, viewBounds])

  // Pide la ubicación del usuario (para mostrar distancias y ordenar por cercanía).
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      pos => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}, // si el usuario niega el permiso, seguimos sin distancias
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    )
  }, [])

  // Cerrar con ESC (solo en modo modal)
  useEffect(() => {
    if (inline) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, inline])

  // Cargar CSS de Leaflet
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement('link'); link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(link)
    }
    setCssReady(true)
  }, [])

  // Inicializar mapa
  useEffect(() => {
    if (!cssReady || !mapElRef.current || mapRef.current) return
    let cancelled = false
    ;(async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !mapElRef.current) return
      const map = L.map(mapElRef.current, { zoomControl: true, attributionControl: false })
      mapRef.current = map
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map)
      layerRef.current = L.layerGroup().addTo(map)
      map.setView([4.57, -74.29], 5) // Colombia por defecto
      // Cada vez que el usuario acerca/mueve el mapa, actualizamos el encuadre para
      // filtrar la lista de comercios visibles.
      map.on('moveend zoomend', () => { if (!cancelled) setViewBounds(map.getBounds()) })
      setViewBounds(map.getBounds())
      setTimeout(() => map.invalidateSize(), 80)
    })()
    return () => { cancelled = true }
  }, [cssReady])

  useEffect(() => () => { mapRef.current?.remove?.(); mapRef.current = null }, [])

  // Redibujar marcadores al cambiar el filtro
  useEffect(() => {
    if (!mapRef.current || !layerRef.current) return
    let cancelled = false
    ;(async () => {
      const L = (await import('leaflet')).default
      if (cancelled) return
      layerRef.current.clearLayers()
      const bounds = L.latLngBounds([])
      for (const s of located) {
        const lat = num(s.latitude), lng = num(s.longitude)
        const logo = s.logoUrl ? cldImg(s.logoUrl, 80) : ''
        const html = `
          <div class="sm-float" title="Ver en Google Maps">
            <span class="sm-logo">${logo ? `<img src="${logo}" alt="" />` : '<span class="sm-ph"></span>'}</span>
            <span class="sm-name">${escapeHtml(s.name)}</span>
            <span class="sm-pin" style="background:${brandColor}"></span>
          </div>`
        const icon = L.divIcon({ className: 'sm-icon', html, iconSize: [0, 0], iconAnchor: [0, 46] })
        const marker = L.marker([lat, lng], { icon }).addTo(layerRef.current)
        marker.on('click', () => window.open(gmapsUrl(lat, lng), '_blank', 'noopener'))
        bounds.extend([lat, lng])
      }
      if (located.length === 1) mapRef.current.setView(bounds.getCenter(), 15)
      else if (located.length > 1) mapRef.current.fitBounds(bounds.pad(0.25))
      setTimeout(() => mapRef.current?.invalidateSize?.(), 60)
    })()
    return () => { cancelled = true }
  }, [located, brandColor, mode])

  const focusStore = (s: MapStore) => {
    const lat = num(s.latitude), lng = num(s.longitude)
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      setMode('mapa')
      mapRef.current?.setView?.([lat, lng], 16)
    }
  }

  return (
    // Inline: sección integrada que empuja el contenido. Modal: overlay con backdrop.
    <div
      className={inline
        ? 'relative w-full'
        : 'fixed inset-0 z-[110] flex items-stretch sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4'}
      onClick={inline ? undefined : onClose}
    >
      <style>{`
        .sm-icon { background: transparent; border: 0; }
        .sm-float { display: inline-flex; align-items: center; gap: 6px; transform: translate(-50%, -100%);
          background: #fff; border: 1px solid rgba(0,0,0,0.08); border-radius: 9999px; padding: 4px 10px 4px 4px;
          box-shadow: 0 6px 20px rgba(0,0,0,0.18); cursor: pointer; white-space: nowrap; transition: box-shadow .15s ease; }
        .sm-float:hover { box-shadow: 0 10px 26px rgba(0,0,0,0.26); }
        .sm-logo { width: 26px; height: 26px; border-radius: 9999px; overflow: hidden; background: #f1f1f1; display: inline-flex; align-items: center; justify-content: center; flex: none; }
        .sm-logo img { width: 100%; height: 100%; object-fit: cover; }
        .sm-ph { width: 12px; height: 12px; border-radius: 3px; background: #cbd5e1; }
        .sm-name { font-size: 12px; font-weight: 700; color: #111827; max-width: 160px; overflow: hidden; text-overflow: ellipsis; }
        .sm-pin { position: absolute; left: 50%; bottom: -7px; width: 12px; height: 12px; transform: translateX(-50%) rotate(45deg); border-radius: 2px; box-shadow: 2px 2px 4px rgba(0,0,0,0.15); }
      `}</style>

      {/* Panel (modal) o tarjeta (inline) */}
      <div
        className={inline
          ? 'bg-white w-full rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col'
          : 'bg-white w-full sm:w-[96vw] sm:max-w-6xl h-[100dvh] sm:h-auto sm:max-h-[90vh] sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col'}
        onClick={inline ? undefined : (e => e.stopPropagation())}
      >
        {/* Cabecera del modal */}
        <div className="flex items-center justify-between px-5 sm:px-6 h-14 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5" style={{ color: brandColor }} />
            <h2 className="text-lg font-black tracking-tight" style={{ color: brandDark }}>Nuestros comercios</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100" aria-label="Cerrar"><X className="w-5 h-5" /></button>
        </div>

        {/* Contenido scrolleable */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          <p className="text-base font-bold text-gray-900 mb-3">Busca tu comercio más cercano</p>
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => setMode('lista')}
              className="px-4 py-2 rounded-full text-sm font-semibold border transition-colors flex items-center gap-1.5"
              style={mode === 'lista' ? { background: brandColor, color: '#fff', borderColor: brandColor } : { color: brandDark, borderColor: `${brandColor}55`, background: '#fff' }}>
              <ListIcon className="w-4 h-4" /> Por departamento o ciudad
            </button>
            <button onClick={() => setMode('mapa')}
              className="px-4 py-2 rounded-full text-sm font-semibold border transition-colors flex items-center gap-1.5"
              style={mode === 'mapa' ? { background: brandColor, color: '#fff', borderColor: brandColor } : { color: brandDark, borderColor: `${brandColor}55`, background: '#fff' }}>
              <MapIcon className="w-4 h-4" /> Por mapa
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Departamento</label>
              <select value={dept} onChange={e => { setDept(e.target.value); setCity(''); setViewBounds(null) }}
                className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 focus:outline-none">
                <option value="">Todos los departamentos</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Ciudad</label>
              <select value={city} onChange={e => { setCity(e.target.value); setViewBounds(null) }}
                className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 focus:outline-none">
                <option value="">Todas las ciudades</option>
                {cities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
            <MapIcon className="w-3.5 h-3.5" style={{ color: brandColor }} />
            <span>
              Mostrando <b style={{ color: brandDark }}>{inView.length}</b>
              {filtered.length !== inView.length ? ` de ${filtered.length}` : ''} comercio{inView.length === 1 ? '' : 's'} · acerca o mueve el mapa para filtrar
            </span>
          </div>

          {/* Lista + Mapa */}
          <div className="grid grid-cols-1 md:grid-cols-[360px_1fr] gap-4">
            <div className={`${mode === 'mapa' ? 'hidden md:block' : ''} rounded-2xl border border-gray-200 overflow-hidden`}>
              <div className="max-h-[440px] overflow-y-auto divide-y divide-gray-100">
                {inView.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <StoreIcon className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm">
                      {filtered.length > 0 && viewBounds
                        ? 'No hay comercios en esta zona del mapa. Aleja o mueve el mapa para ver más.'
                        : 'No hay comercios para ese filtro.'}
                    </p>
                  </div>
                ) : inView.map(({ store: s, distanceKm }) => {
                  const lat = num(s.latitude), lng = num(s.longitude)
                  const geo = Number.isFinite(lat) && Number.isFinite(lng)
                  return (
                    <div key={s.id} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <button onClick={() => geo && focusStore(s)} className="text-left min-w-0">
                          <span className="font-bold" style={{ color: brandDark }}>{s.name}</span>
                        </button>
                        {distanceKm != null && (
                          <span className="text-xs font-semibold text-gray-500 shrink-0 whitespace-nowrap">
                            {distanceKm < 10 ? distanceKm.toFixed(1) : Math.round(distanceKm)} km
                          </span>
                        )}
                      </div>
                      {s.openState && (
                        <span className={`inline-flex items-center gap-1 mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${s.openState === 'closed' ? 'bg-red-500/10 text-red-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.openState === 'closed' ? 'bg-red-500' : 'bg-emerald-500'}`} />
                          {s.openState === 'closed' ? `Cerrado${s.nextOpenLabel ? ` · ${s.nextOpenLabel}` : ''}` : 'Abierto'}
                        </span>
                      )}
                      {(s.address || s.city) && (
                        <p className="text-xs text-gray-500 mt-1 flex items-start gap-1">
                          <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                          <span>{[s.address, s.city].filter(Boolean).join(' · ')}</span>
                        </p>
                      )}
                      {s.schedule && (
                        <p className="text-[11px] text-gray-400 mt-1 flex items-start gap-1">
                          <Clock className="w-3 h-3 mt-0.5 shrink-0" />
                          <span>{s.schedule}</span>
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        {onOpenStore && (
                          <button onClick={() => { onOpenStore(s.slug); onClose() }}
                            className="text-xs font-bold hover:underline" style={{ color: brandColor }}>
                            Ver tienda
                          </button>
                        )}
                        {geo && (
                          <a href={gmapsUrl(lat, lng)} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-700">
                            <ExternalLink className="w-3 h-3" /> Cómo llegar
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className={`${mode === 'lista' ? 'hidden md:block' : ''} rounded-2xl overflow-hidden border border-gray-200 h-[360px] md:h-[440px] relative`}>
              <div ref={mapElRef} className="absolute inset-0" />
              {located.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-center px-6 text-gray-400 text-sm pointer-events-none">
                  Los comercios aparecerán aquí cuando registren su ubicación.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}
