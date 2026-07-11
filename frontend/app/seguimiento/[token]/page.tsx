"use client"

/**
 * Portal público de seguimiento (F5) — "¿dónde va mi pedido?"
 * El cliente abre el link que le llega por WhatsApp al despachar y ve el estado
 * en vivo sin llamar a la ferretería: línea de tiempo, posición aproximada del
 * vehículo mientras va en ruta, y la prueba de entrega al final.
 * Sin login: el token aleatorio del pedido es la llave.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  Package, CheckCircle2, Truck, Clock, MapPin, Store, Phone,
  RefreshCw, PackageX, ClipboardList, Boxes, Star, Loader2,
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

const STAGE_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  confirmado:  { label: 'Pedido confirmado',    icon: CheckCircle2 },
  en_picking:  { label: 'Preparando en bodega', icon: Boxes },
  preparado:   { label: 'Listo para cargar',    icon: ClipboardList },
  cargado:     { label: 'Cargado al vehículo',  icon: Package },
  despachado:  { label: 'En camino 🚚',         icon: Truck },
  entregado:   { label: 'Entregado ✅',          icon: CheckCircle2 },
}

// Orden canónico para pintar el progreso aunque falten eventos intermedios
const DISPATCH_PROGRESS: Record<string, number> = {
  pendiente: 1, en_pista: 2, cargado: 3, despachado: 4, entregado: 5,
}

export default function TrackingPage() {
  const params = useParams<{ token: string }>()
  const token = params?.token
  const [data, setData] = useState<any | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`${API_URL}/storefront/tracking/${token}`)
      if (res.status === 404) { setNotFound(true); setLoading(false); return }
      const json = await res.json()
      if (json.success) setData(json.data)
    } catch { /* red caída: se reintenta en el próximo ciclo */ }
    setLoading(false)
  }, [token])

  // En tránsito refresca cada 12s (mapa en vivo); si no, cada 60s.
  const inTransit = !!data?.vehicle
  useEffect(() => {
    load()
    const t = setInterval(load, inTransit ? 12000 : 60000)
    return () => clearInterval(t)
  }, [load, inTransit])

  // ── Mapa en vivo (Leaflet + OpenStreetMap, gratis) ────────────────────────
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const Lref = useRef<any>(null)
  const courierMarkerRef = useRef<any>(null)
  const destMarkerRef = useRef<any>(null)
  const routeLineRef = useRef<any>(null)

  const vehicle = data?.vehicle as { lat: number; lng: number } | null | undefined
  const destCoords = data?.destinationCoords as { lat: number; lng: number } | null | undefined
  const routeGeometry = data?.routeGeometry as [number, number][] | null | undefined
  const eta = data?.eta as { minutes: number; source: string } | null | undefined

  // Inicializa el mapa una vez que hay posición del vehículo y el contenedor existe
  useEffect(() => {
    let cancelled = false
    if (!vehicle || mapRef.current) return
    ;(async () => {
      if (typeof window === 'undefined' || !mapContainerRef.current) return
      try {
        await new Promise<void>((resolve) => {
          if (document.querySelector('link[href*="leaflet"]')) { resolve(); return }
          const link = document.createElement('link')
          link.rel = 'stylesheet'; link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
          link.onload = () => resolve(); link.onerror = () => resolve()
          document.head.appendChild(link)
        })
        if (cancelled || !mapContainerRef.current) return
        const L = (await import('leaflet')).default
        if (cancelled || !mapContainerRef.current || (mapContainerRef.current as any)._leaflet_id) return
        Lref.current = L
        const map = L.map(mapContainerRef.current, { center: [vehicle.lat, vehicle.lng], zoom: 14, zoomControl: false })
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(map)
        // Destino
        if (destCoords) {
          destMarkerRef.current = L.circleMarker([destCoords.lat, destCoords.lng], {
            radius: 8, color: '#059669', fillColor: '#10b981', fillOpacity: 0.9, weight: 2,
          }).addTo(map).bindTooltip('Destino')
        }
        // Repartidor
        courierMarkerRef.current = L.circleMarker([vehicle.lat, vehicle.lng], {
          radius: 9, color: '#4f46e5', fillColor: '#6366f1', fillOpacity: 1, weight: 3,
        }).addTo(map).bindTooltip('Repartidor')
        mapRef.current = map
        setTimeout(() => map.invalidateSize(), 250)
      } catch { /* mapa opcional: si falla, queda el link a Google Maps */ }
    })()
    return () => { cancelled = true }
  }, [vehicle, destCoords])

  // Mueve el marcador del repartidor, dibuja la ruta (si hay proveedor) y reencuadra
  useEffect(() => {
    const L = Lref.current; const map = mapRef.current
    if (!L || !map || !vehicle) return
    if (courierMarkerRef.current) courierMarkerRef.current.setLatLng([vehicle.lat, vehicle.lng])
    // Línea de ruta (solo si el proveedor la devuelve)
    if (routeGeometry && routeGeometry.length > 1) {
      if (routeLineRef.current) routeLineRef.current.setLatLngs(routeGeometry)
      else routeLineRef.current = L.polyline(routeGeometry, { color: '#6366f1', weight: 4, opacity: 0.7 }).addTo(map)
    } else if (routeLineRef.current) {
      routeLineRef.current.remove(); routeLineRef.current = null
    }
    const pts: [number, number][] = routeGeometry && routeGeometry.length > 1
      ? routeGeometry.slice()
      : [[vehicle.lat, vehicle.lng]]
    if (destCoords) pts.push([destCoords.lat, destCoords.lng])
    try { map.fitBounds(L.latLngBounds(pts).pad(0.25), { maxZoom: 16 }) } catch {}
  }, [vehicle?.lat, vehicle?.lng, destCoords, routeGeometry])

  // Cierra el mapa cuando termina la entrega (deja de venir vehicle)
  useEffect(() => {
    if (!vehicle && mapRef.current) {
      try { mapRef.current.remove() } catch {}
      mapRef.current = null; courierMarkerRef.current = null; destMarkerRef.current = null
    }
  }, [vehicle])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <PackageX className="h-12 w-12 text-gray-300 mb-3" />
        <h1 className="text-lg font-bold text-gray-800">Seguimiento no encontrado</h1>
        <p className="text-sm text-gray-500 mt-1">Verifica el link que recibiste por WhatsApp o contacta a la tienda.</p>
      </div>
    )
  }

  const delivered = data.dispatchStatus === 'entregado' || data.status === 'entregado'
  const progress = delivered ? 5 : (DISPATCH_PROGRESS[data.dispatchStatus] ?? 1)

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 text-white px-5 pt-8 pb-10 rounded-b-3xl">
        <p className="text-white/70 text-xs uppercase tracking-widest flex items-center gap-1">
          <Store className="h-3.5 w-3.5" /> {data.storeName || 'Tu tienda'}
        </p>
        <h1 className="text-2xl font-bold mt-1">Pedido #{data.orderNumber}</h1>
        <p className="text-white/80 text-sm mt-1">
          {delivered
            ? `¡Entregado${data.customerFirstName ? `, ${data.customerFirstName}` : ''}! 🎉`
            : data.dispatchStatus === 'despachado'
            ? `¡Va en camino${data.customerFirstName ? `, ${data.customerFirstName}` : ''}!`
            : 'Lo estamos preparando para ti'}
        </p>
        {data.destination && (
          <p className="text-white/60 text-xs mt-2 flex items-center gap-1"><MapPin className="h-3 w-3" /> {data.destination}</p>
        )}
      </div>

      <div className="max-w-md mx-auto px-4 -mt-6 space-y-4">
        {/* Barra de progreso */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-2">
            {['Confirmado', 'Preparando', 'Cargado', 'En camino', 'Entregado'].map((label, i) => (
              <div key={label} className="flex flex-col items-center flex-1">
                <div className={`w-3 h-3 rounded-full ${i < progress ? 'bg-indigo-600' : 'bg-gray-200'}`} />
                <span className={`text-[9px] mt-1 text-center leading-tight ${i < progress ? 'text-indigo-600 font-medium' : 'text-gray-400'}`}>{label}</span>
              </div>
            ))}
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-600 rounded-full transition-all" style={{ width: `${(progress / 5) * 100}%` }} />
          </div>
          {data.promisedAt && !delivered && (
            <p className="text-[11px] text-gray-500 mt-2 flex items-center gap-1">
              <Clock className="h-3 w-3" /> Entrega estimada: {new Date(data.promisedAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          )}
        </div>

        {/* Mapa en vivo del repartidor (solo mientras va en ruta) */}
        {data.vehicle && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <div>
                <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <Truck className="h-4 w-4 text-indigo-600 animate-pulse" /> Tu pedido va en camino
                </p>
                {data.eta && (
                  <p className="text-xs text-indigo-600 font-medium mt-0.5 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Llega en ~{data.eta.minutes} min
                    {data.eta.source === 'directo' && <span className="text-gray-400 font-normal">(aprox.)</span>}
                  </p>
                )}
              </div>
              <span className="text-[11px] text-gray-400">
                {data.vehicle.lastPingAt ? `Actualizado ${new Date(data.vehicle.lastPingAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}` : ''}
              </span>
            </div>
            <div ref={mapContainerRef} className="h-56 w-full bg-gray-100" />
            <div className="flex items-center justify-between px-4 py-2.5 text-xs">
              <span className="flex items-center gap-3 text-gray-500">
                <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-indigo-500" /> Repartidor</span>
                {data.destinationCoords && <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" /> Destino</span>}
              </span>
              <a
                href={`https://www.google.com/maps?q=${data.vehicle.lat},${data.vehicle.lng}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-indigo-600 font-medium hover:underline"
              >
                <MapPin className="h-3.5 w-3.5" /> Abrir en Maps
              </a>
            </div>
          </div>
        )}

        {/* Prueba de entrega */}
        {data.pod && delivered && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" /> Prueba de entrega
            </p>
            {data.pod.receivedBy && <p className="text-xs text-gray-600 mb-2">Recibió: <span className="font-medium">{data.pod.receivedBy}</span></p>}
            {data.pod.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.pod.photoUrl} alt="Entrega" className="w-full max-h-64 object-cover rounded-xl border" />
            )}
          </div>
        )}

        {/* Calificación (satisfacción post-entrega) */}
        {delivered && <RatingBlock token={token!} existing={data.rating} onRated={load} />}

        {/* Línea de tiempo */}
        {data.stages?.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-sm font-semibold text-gray-800 mb-3">Historial</p>
            <div className="space-y-3">
              {data.stages.map((s: any, i: number) => {
                const meta = STAGE_META[s.stage] || { label: s.stage, icon: Clock }
                const Icon = meta.icon
                return (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                      <Icon className="h-3.5 w-3.5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-800">{meta.label}</p>
                      <p className="text-[11px] text-gray-400">{new Date(s.at).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Productos */}
        {data.items?.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-sm font-semibold text-gray-800 mb-2">Tu pedido</p>
            <div className="space-y-1">
              {data.items.map((i: any, idx: number) => (
                <p key={idx} className="text-sm text-gray-600 flex justify-between">
                  <span className="truncate">{i.productName}</span>
                  <span className="text-gray-400 shrink-0 ml-2">× {i.quantity}</span>
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Contacto */}
        {data.storePhone && (
          <a
            href={`https://wa.me/${String(data.storePhone).replace(/\D/g, '')}`}
            target="_blank" rel="noopener noreferrer"
            className="block text-center text-sm text-gray-500 py-2"
          >
            <Phone className="h-3.5 w-3.5 inline mr-1" /> ¿Dudas? Escríbenos
          </a>
        )}
      </div>
    </div>
  )
}

function RatingBlock({ token, existing, onRated }: { token: string; existing: { stars: number; comment: string | null } | null; onRated: () => void }) {
  const [stars, setStars] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  // Ya calificado (por este cliente antes) → mostrar agradecimiento
  if (existing || done) {
    const s = existing?.stars ?? stars
    return (
      <div id="calificar" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center">
        <p className="text-sm font-semibold text-gray-800 mb-1">¡Gracias por tu calificación! 🙏</p>
        <div className="flex justify-center gap-1 my-2">
          {[1, 2, 3, 4, 5].map(i => (
            <Star key={i} className={`h-6 w-6 ${i <= s ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
          ))}
        </div>
        {existing?.comment && <p className="text-xs text-gray-500 italic">"{existing.comment}"</p>}
      </div>
    )
  }

  const submit = async () => {
    if (stars < 1) return
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/storefront/tracking/${token}/rating`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stars, comment: comment.trim() || undefined }),
      })
      const json = await res.json()
      if (json.success) { setDone(true); onRated() }
    } catch { /* red caída: el cliente puede reintentar */ }
    setSaving(false)
  }

  return (
    <div id="calificar" className="bg-white rounded-2xl shadow-sm border border-indigo-100 p-4 text-center">
      <p className="text-sm font-semibold text-gray-800">¿Cómo estuvo tu entrega?</p>
      <p className="text-xs text-gray-500 mb-2">Tu opinión nos ayuda a mejorar</p>
      <div className="flex justify-center gap-1 my-2">
        {[1, 2, 3, 4, 5].map(i => (
          <button key={i} onClick={() => setStars(i)} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(0)} className="p-1">
            <Star className={`h-8 w-8 transition-colors ${i <= (hover || stars) ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
          </button>
        ))}
      </div>
      {stars > 0 && (
        <>
          <textarea
            value={comment} onChange={e => setComment(e.target.value)}
            placeholder="Cuéntanos más (opcional)…" rows={2} maxLength={500}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 resize-none"
          />
          <button
            onClick={submit} disabled={saving}
            className="mt-2 w-full py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />} Enviar calificación
          </button>
        </>
      )}
    </div>
  )
}
