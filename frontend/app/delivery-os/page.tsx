'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import { loginHref } from '@/lib/login-path'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import {
  Truck, MapPin, Users, Package, Clock, RefreshCw,
  Plus, Edit3, Trash2, CheckCircle2, AlertCircle, X,
  MessageCircle, Activity, ZapOff, Zap, LogOut, Map as MapIcon,
} from 'lucide-react'
import { DeliveryChat } from '@/components/delivery-chat'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

// ── helpers ──────────────────────────────────────────────────────────────────
function formatCOP(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n)
}
function timeAgo(d: string) {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (diff < 60) return `hace ${diff}s`
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`
  return `hace ${Math.floor(diff / 3600)}h`
}

async function apiFetch(path: string, options?: RequestInit) {
  const token = api.getToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${API}${path}`, { ...options, headers: { ...headers, ...(options?.headers as any) }, credentials: 'include' })
  return res.json()
}

// ── STATUS COLORS ─────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  sin_asignar: 'bg-gray-100 text-gray-600',
  asignado: 'bg-blue-100 text-blue-700',
  recogido: 'bg-yellow-100 text-yellow-700',
  en_camino: 'bg-orange-100 text-orange-700',
  entregado: 'bg-green-100 text-green-700',
}
const STATUS_LABEL: Record<string, string> = {
  sin_asignar: 'Sin asignar', asignado: 'Asignado',
  recogido: 'Recogido', en_camino: 'En camino', entregado: 'Entregado',
}
const markerHtml = (color: string, emoji: string, size = 30) =>
  `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;font-size:12px">${emoji}</div>`

// ── TYPES ─────────────────────────────────────────────────────────────────────
interface OpsStats { onlineCouriers: number; activeOrders: number; pendingOrders: number; deliveredToday: number; avgDeliveryMinutes: number | null }
interface ActiveCourier { id: string; name: string; phone: string; isOnline: boolean; lat: number | null; lng: number | null; lastSeenAt: string; currentOrderStatus?: string; currentOrderNumber?: string }
interface ActiveOrder { id: string; orderNumber: string; customerName: string; lat: number | null; lng: number | null; deliveryStatus: string; address: string; total: number; createdAt: string; driverName?: string }
interface ChatRoom { id: string; orderId: string; orderNumber: string; customerName: string; deliveryStatus: string; driverName?: string; lastMessage?: string; lastMessageAt?: string; unreadCount: number }
interface Zone { id: string; name: string; city: string; polygon?: any; isActive: boolean; deliveryFeeBase: number; maxRadiusKm?: number; minOrderAmount: number; estimatedMinutes: number; color?: string }

// ── ZONE FORM ─────────────────────────────────────────────────────────────────
function ZoneForm({ zone, onSave, onCancel }: { zone?: Zone | null; onSave: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    name: zone?.name || '',
    city: zone?.city || '',
    deliveryFeeBase: zone?.deliveryFeeBase ?? 0,
    minOrderAmount: zone?.minOrderAmount ?? 0,
    estimatedMinutes: zone?.estimatedMinutes ?? 30,
    color: zone?.color || '#3B82F6',
    isActive: zone?.isActive ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    if (!form.name || !form.city) { setError('Nombre y ciudad son requeridos'); return }
    setSaving(true)
    try {
      const path = zone ? `/coverage/zones/${zone.id}` : '/coverage/zones'
      const res = await apiFetch(path, { method: zone ? 'PUT' : 'POST', body: JSON.stringify(form) })
      if (res.success) { onSave() } else { setError(res.error || 'Error al guardar') }
    } catch { setError('Error de conexión') }
    setSaving(false)
  }

  const f = (field: string, value: any) => setForm(p => ({ ...p, [field]: value }))

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h3 className="font-semibold text-gray-900">{zone ? 'Editar zona' : 'Nueva zona de cobertura'}</h3>
      {error && <p className="text-xs text-red-600 bg-red-50 rounded p-2">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Nombre de zona *</label>
          <input value={form.name} onChange={e => f('name', e.target.value)} placeholder="ej: Mocoa Centro"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Ciudad *</label>
          <input value={form.city} onChange={e => f('city', e.target.value)} placeholder="ej: Mocoa"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Tarifa base ($)</label>
          <input type="number" value={form.deliveryFeeBase} onChange={e => f('deliveryFeeBase', Number(e.target.value))}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Pedido mínimo ($)</label>
          <input type="number" value={form.minOrderAmount} onChange={e => f('minOrderAmount', Number(e.target.value))}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Tiempo estimado (min)</label>
          <input type="number" value={form.estimatedMinutes} onChange={e => f('estimatedMinutes', Number(e.target.value))}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Color en mapa</label>
          <div className="flex gap-2 items-center">
            <input type="color" value={form.color} onChange={e => f('color', e.target.value)} className="h-9 w-14 rounded border border-gray-200 cursor-pointer" />
            <span className="text-xs text-gray-400">{form.color}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="zoneActive" checked={form.isActive} onChange={e => f('isActive', e.target.checked)} className="rounded" />
        <label htmlFor="zoneActive" className="text-sm text-gray-700">Zona activa</label>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={save} disabled={saving}
          className="flex-1 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
          {saving ? 'Guardando...' : (zone ? 'Actualizar' : 'Crear zona')}
        </button>
        <button onClick={onCancel} className="px-4 py-2 text-gray-600 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function DeliveryOSPage() {
  const { user, isAuthenticated, isCheckingAuth, checkAuth, logout } = useAuthStore()
  const router = useRouter()

  const [tab, setTab] = useState<'operations' | 'zones' | 'chat'>('operations')
  const [stats, setStats] = useState<OpsStats | null>(null)
  const [couriers, setCouriers] = useState<ActiveCourier[]>([])
  const [orders, setOrders] = useState<ActiveOrder[]>([])
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(false)
  const [showZoneForm, setShowZoneForm] = useState(false)
  const [editingZone, setEditingZone] = useState<Zone | null>(null)
  const [chatOrderId, setChatOrderId] = useState<string | null>(null)
  const [chatOrderNumber, setChatOrderNumber] = useState<string | undefined>()

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const Lref = useRef<any>(null)
  const markersRef = useRef<Map<string, any>>(new Map())

  // Auth guard
  useEffect(() => { checkAuth() }, [checkAuth])
  useEffect(() => {
    if (isCheckingAuth) return
    if (!isAuthenticated) router.replace(loginHref('/delivery-os'))
  }, [isAuthenticated, isCheckingAuth, router])

  // Load ops data
  const loadOps = useCallback(async () => {
    setLoading(true)
    try {
      const [statsRes, couriersRes, ordersRes] = await Promise.all([
        apiFetch('/delivery/ops-stats'),
        apiFetch('/delivery/active-couriers'),
        apiFetch('/delivery/active-orders-map'),
      ])
      if (statsRes.success) setStats(statsRes.data)
      if (couriersRes.success) setCouriers(couriersRes.data || [])
      if (ordersRes.success) setOrders(ordersRes.data || [])
    } catch {}
    setLoading(false)
  }, [])

  const loadZones = useCallback(async () => {
    const res = await apiFetch('/coverage/zones')
    if (res.success) setZones(res.data || [])
  }, [])

  const loadChatRooms = useCallback(async () => {
    const res = await apiFetch('/delivery-chat/active-rooms')
    if (res.success) setChatRooms(res.data || [])
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return
    loadOps()
    loadZones()
    loadChatRooms()
  }, [isAuthenticated, loadOps, loadZones, loadChatRooms])

  // Auto-refresh ops every 30 seconds
  useEffect(() => {
    if (!isAuthenticated) return
    const interval = setInterval(() => {
      loadOps()
      if (tab === 'chat') loadChatRooms()
    }, 30_000)
    return () => clearInterval(interval)
  }, [isAuthenticated, tab, loadOps, loadChatRooms])

  // Init Leaflet map
  useEffect(() => {
    if (tab !== 'operations') return
    let cancelled = false
    let invalidateTimer: ReturnType<typeof setTimeout> | undefined
    ;(async () => {
      if (typeof window === 'undefined' || !mapContainerRef.current) return
      try {
        await new Promise<void>(resolve => {
          if (document.querySelector('link[href*="leaflet"]')) { resolve(); return }
          const link = document.createElement('link')
          link.rel = 'stylesheet'
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
          link.onload = () => resolve(); link.onerror = () => resolve()
          document.head.appendChild(link)
        })
        if (cancelled) return
        const L = (await import('leaflet')).default
        if (cancelled || !mapContainerRef.current) return
        if ((mapContainerRef.current as any)._leaflet_id) { Lref.current = L; return }
        Lref.current = L
        delete (L.Icon.Default.prototype as any)._getIconUrl
        const map = L.map(mapContainerRef.current, { center: [1.15, -76.65], zoom: 13 })
        if (cancelled) { map.remove(); return }
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(map)
        mapRef.current = map
        invalidateTimer = setTimeout(() => { if (!cancelled) map.invalidateSize() }, 300)
      } catch {}
    })()
    return () => { cancelled = true; if (invalidateTimer) clearTimeout(invalidateTimer) }
  }, [tab])

  // Update markers when data changes
  useEffect(() => {
    const L = Lref.current; const map = mapRef.current
    if (!L || !map || tab !== 'operations') return
    markersRef.current.forEach(m => m.remove()); markersRef.current.clear()
    const bounds: [number, number][] = []

    for (const c of couriers) {
      if (!c.lat || !c.lng) continue
      const icon = L.divIcon({ className: '', iconSize: [30, 30], iconAnchor: [15, 15], html: markerHtml('#4F46E5', '🛵') })
      const m = L.marker([Number(c.lat), Number(c.lng)], { icon })
        .addTo(map)
        .bindPopup(`<b>${c.name}</b><br>${c.currentOrderNumber ? `Pedido: ${c.currentOrderNumber}` : 'Sin pedido activo'}`)
      markersRef.current.set(`c-${c.id}`, m)
      bounds.push([Number(c.lat), Number(c.lng)])
    }

    for (const o of orders) {
      if (!o.lat || !o.lng) continue
      const color = o.deliveryStatus === 'sin_asignar' ? '#6B7280'
        : o.deliveryStatus === 'en_camino' ? '#F59E0B' : '#16A34A'
      const emoji = o.deliveryStatus === 'sin_asignar' ? '📦'
        : o.deliveryStatus === 'en_camino' ? '🚴' : '📍'
      const icon = L.divIcon({ className: '', iconSize: [28, 28], iconAnchor: [14, 14], html: markerHtml(color, emoji, 28) })
      const m = L.marker([Number(o.lat), Number(o.lng)], { icon })
        .addTo(map)
        .bindPopup(`<b>${o.orderNumber}</b><br>${o.customerName}<br>${STATUS_LABEL[o.deliveryStatus]}${o.driverName ? `<br>🛵 ${o.driverName}` : ''}`)
      markersRef.current.set(`o-${o.id}`, m)
      bounds.push([Number(o.lat), Number(o.lng)])
    }

    if (bounds.length > 1) { try { map.fitBounds(bounds, { padding: [50, 50] }) } catch {} }
    else if (bounds.length === 1) map.setView(bounds[0], 14)
  }, [couriers, orders, tab])

  const deleteZone = async (id: string) => {
    if (!confirm('¿Desactivar esta zona?')) return
    await apiFetch(`/coverage/zones/${id}`, { method: 'DELETE' })
    loadZones()
  }

  if (isCheckingAuth) return (
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <RefreshCw className="h-6 w-6 animate-spin text-indigo-500" />
    </div>
  )

  return (
    <div className="h-screen flex flex-col bg-gray-950 overflow-hidden text-white">
      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <header className="bg-gray-900 border-b border-white/10 px-4 py-2.5 flex items-center gap-4 shrink-0 z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">DAIMUZ Delivery OS</h1>
            <p className="text-[10px] text-white/40 leading-tight">Centro de Operaciones</p>
          </div>
        </div>

        {/* Stats bar */}
        {stats && (
          <div className="flex items-center gap-4 ml-4">
            <StatChip icon={<Users className="h-3 w-3" />} value={stats.onlineCouriers} label="Online" color="text-emerald-400" />
            <StatChip icon={<Truck className="h-3 w-3" />} value={stats.activeOrders} label="Activos" color="text-blue-400" />
            <StatChip icon={<AlertCircle className="h-3 w-3" />} value={stats.pendingOrders} label="Pendientes" color="text-amber-400" />
            <StatChip icon={<CheckCircle2 className="h-3 w-3" />} value={stats.deliveredToday} label="Hoy" color="text-green-400" />
            {stats.avgDeliveryMinutes && (
              <StatChip icon={<Clock className="h-3 w-3" />} value={`${stats.avgDeliveryMinutes}m`} label="Promedio" color="text-purple-400" />
            )}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => { loadOps(); loadZones(); loadChatRooms() }} disabled={loading}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors" title="Actualizar">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={logout} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-red-400 transition-colors" title="Salir">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div className="flex border-b border-white/10 bg-gray-900 shrink-0">
        {([
          { key: 'operations', label: 'Operaciones', icon: <MapIcon className="h-3.5 w-3.5" /> },
          { key: 'zones',      label: 'Zonas',       icon: <MapPin className="h-3.5 w-3.5" /> },
          { key: 'chat',       label: 'Chat',         icon: <MessageCircle className="h-3.5 w-3.5" /> },
        ] as const).map(({ key, label, icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              tab === key ? 'border-indigo-500 text-white' : 'border-transparent text-white/40 hover:text-white/70'
            }`}>
            {icon}{label}
            {key === 'chat' && chatRooms.some(r => r.unreadCount > 0) && (
              <span className="w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                {chatRooms.reduce((s, r) => s + r.unreadCount, 0)}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden min-h-0">

        {/* ── OPERATIONS tab ─────────────────────────────────────────────── */}
        {tab === 'operations' && (
          <div className="flex h-full">
            {/* Map */}
            <div className="flex-1 relative">
              <div ref={mapContainerRef} style={{ position: 'absolute', inset: 0 }} />
              {/* Legend */}
              <div className="absolute bottom-4 left-4 z-[400] bg-gray-900/90 backdrop-blur rounded-xl p-3 space-y-1.5 border border-white/10 text-xs">
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-indigo-500 inline-block" />Repartidor online ({couriers.length})</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-gray-500 inline-block" />Sin asignar</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />En camino</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" />Asignado</div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="w-80 bg-gray-900 border-l border-white/10 flex flex-col overflow-hidden">
              {/* Couriers */}
              <div className="px-3 pt-3 pb-2 border-b border-white/10">
                <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Repartidores Activos</p>
                {couriers.length === 0 ? (
                  <p className="text-xs text-white/30 py-2">Ninguno online ahora</p>
                ) : (
                  <div className="space-y-1.5">
                    {couriers.map(c => (
                      <div key={c.id} className="flex items-center gap-2.5 bg-white/5 rounded-lg px-2.5 py-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-600/50 flex items-center justify-center text-xs font-bold shrink-0">
                          {c.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white leading-tight truncate">{c.name}</p>
                          <p className="text-[10px] text-white/40">{c.currentOrderNumber ? `📦 ${c.currentOrderNumber}` : 'Libre'}</p>
                        </div>
                        <Zap className="h-3 w-3 text-emerald-400 shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Active orders */}
              <div className="flex-1 overflow-y-auto px-3 pt-3">
                <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Pedidos Activos</p>
                <div className="space-y-2">
                  {orders.map(o => (
                    <div key={o.id} className="bg-white/5 rounded-lg p-2.5 border border-white/10">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-semibold text-white">{o.orderNumber}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLOR[o.deliveryStatus]}`}>
                          {STATUS_LABEL[o.deliveryStatus]}
                        </span>
                      </div>
                      <p className="text-[11px] text-white/60 truncate">{o.customerName}</p>
                      {o.address && <p className="text-[10px] text-white/40 truncate">{o.address}</p>}
                      {o.driverName && <p className="text-[10px] text-indigo-400 mt-0.5">🛵 {o.driverName}</p>}
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] text-white/30">{timeAgo(o.createdAt)}</span>
                        <button
                          onClick={() => { setChatOrderId(o.id); setChatOrderNumber(o.orderNumber); setTab('chat') }}
                          className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5"
                        >
                          <MessageCircle className="h-3 w-3" />Chat
                        </button>
                      </div>
                    </div>
                  ))}
                  {orders.length === 0 && (
                    <div className="text-center py-8 text-white/20">
                      <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-xs">Sin pedidos activos</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── ZONES tab ───────────────────────────────────────────────────── */}
        {tab === 'zones' && (
          <div className="h-full overflow-y-auto p-4 bg-gray-950">
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white">Zonas de Cobertura</h2>
                  <p className="text-xs text-white/40 mt-0.5">Define dónde ofreces servicio de entrega</p>
                </div>
                {!showZoneForm && (
                  <button onClick={() => { setShowZoneForm(true); setEditingZone(null) }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors">
                    <Plus className="h-3.5 w-3.5" />Nueva zona
                  </button>
                )}
              </div>

              {showZoneForm && (
                <ZoneForm
                  zone={editingZone}
                  onSave={() => { setShowZoneForm(false); setEditingZone(null); loadZones() }}
                  onCancel={() => { setShowZoneForm(false); setEditingZone(null) }}
                />
              )}

              <div className="space-y-3">
                {zones.map(z => (
                  <div key={z.id} className={`bg-gray-900 rounded-xl border p-4 ${z.isActive ? 'border-white/10' : 'border-white/5 opacity-60'}`}>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: z.color || '#3B82F6' }}>
                        <MapPin className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="text-sm font-semibold text-white">{z.name}</h3>
                          <span className="text-[10px] text-white/40">{z.city}</span>
                          {!z.isActive && <span className="text-[10px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded-full">Inactiva</span>}
                        </div>
                        <div className="flex flex-wrap gap-3 mt-1.5">
                          <span className="text-[11px] text-white/50">⏱ {z.estimatedMinutes} min</span>
                          <span className="text-[11px] text-white/50">🚚 {formatCOP(z.deliveryFeeBase)}</span>
                          <span className="text-[11px] text-white/50">📦 mín {formatCOP(z.minOrderAmount)}</span>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => { setEditingZone(z); setShowZoneForm(true) }}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors">
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => deleteZone(z.id)}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {zones.length === 0 && !showZoneForm && (
                  <div className="text-center py-16 text-white/20">
                    <MapPin className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No hay zonas de cobertura</p>
                    <p className="text-xs mt-1">Crea la primera para empezar a recibir domicilios</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── CHAT tab ────────────────────────────────────────────────────── */}
        {tab === 'chat' && (
          <div className="flex h-full">
            {/* Room list */}
            <div className="w-72 bg-gray-900 border-r border-white/10 flex flex-col overflow-hidden">
              <div className="px-3 py-3 border-b border-white/10 shrink-0">
                <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Chats Activos</p>
              </div>
              <div className="flex-1 overflow-y-auto">
                {chatRooms.length === 0 && (
                  <div className="text-center py-16 text-white/20">
                    <MessageCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-xs">Sin chats activos</p>
                  </div>
                )}
                {chatRooms.map(r => (
                  <button
                    key={r.id}
                    onClick={() => { setChatOrderId(r.orderId); setChatOrderNumber(r.orderNumber) }}
                    className={`w-full px-3 py-3 text-left hover:bg-white/5 transition-colors border-b border-white/5 ${chatOrderId === r.orderId ? 'bg-white/10' : ''}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-indigo-600/40 flex items-center justify-center text-xs shrink-0 mt-0.5">
                        {r.customerName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-semibold text-white truncate">{r.orderNumber}</span>
                          {r.unreadCount > 0 && (
                            <span className="w-4 h-4 bg-indigo-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold shrink-0">
                              {r.unreadCount}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-white/50 truncate">{r.customerName}</p>
                        {r.lastMessage && <p className="text-[10px] text-white/30 truncate mt-0.5">{r.lastMessage}</p>}
                        {r.driverName && <p className="text-[10px] text-indigo-400 mt-0.5">🛵 {r.driverName}</p>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Chat panel */}
            <div className="flex-1 min-w-0">
              {chatOrderId ? (
                <DeliveryChat
                  orderId={chatOrderId}
                  orderNumber={chatOrderNumber}
                  currentUserId={user?.id || ''}
                  currentUserName={user?.name || 'Admin'}
                  onClose={() => setChatOrderId(null)}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-white/20">
                  <div className="text-center">
                    <MessageCircle className="h-14 w-14 mx-auto mb-4 opacity-20" />
                    <p className="text-sm">Selecciona un chat para abrir</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatChip({ icon, value, label, color }: { icon: React.ReactNode; value: number | string; label: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={color}>{icon}</span>
      <div>
        <span className={`text-sm font-bold ${color}`}>{value}</span>
        <span className="text-[10px] text-white/30 ml-1">{label}</span>
      </div>
    </div>
  )
}
