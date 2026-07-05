'use client'

/**
 * Sistema Operativo Logístico — UI del panel.
 * - <LogisticsOps/>: centro de operaciones en vivo (kanban con semáforo de espera,
 *   vehículos con carga activa, personal con estado) + rutas agrupadas
 *   (sugerencias automáticas por zona, crear ruta, avanzar estados en cascada).
 * - <FleetInsights/>: analítica de rentabilidad por vehículo/conductor +
 *   documentos del vehículo (SOAT/tecno/seguro) + gastos reales.
 */

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Truck, Users, Route as RouteIcon, RefreshCw, Loader2, Zap, PackageCheck,
  Fuel, FileWarning, TrendingUp, Play, CheckCircle2, XCircle, Plus,
} from 'lucide-react'

const fmtCOP = (v: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v)

const DISPATCH_COLUMNS = [
  { key: 'pendiente', label: 'Pendientes' },
  { key: 'en_pista', label: 'En pista' },
  { key: 'cargado', label: 'Cargados' },
  { key: 'despachado', label: 'En ruta' },
] as const

const STAFF_STATUS = ['disponible', 'en_ruta', 'descargando', 'almuerzo', 'fuera_turno', 'incapacidad'] as const
const STAFF_LABEL: Record<string, string> = {
  disponible: '🟢 Disponible', en_ruta: '🚚 En ruta', descargando: '📦 Descargando',
  almuerzo: '🍽️ Almuerzo', fuera_turno: '🌙 Fuera de turno', incapacidad: '🏥 Incapacidad',
}

/** Semáforo por tiempo de espera sin despachar */
const waitColor = (mins: number) =>
  mins > 60 ? 'border-red-500/60 bg-red-500/5' : mins > 30 ? 'border-amber-500/60 bg-amber-500/5' : 'border-border'

// ═══════════════════════════════════════════════════════════════════
// CENTRO DE OPERACIONES + RUTAS
// ═══════════════════════════════════════════════════════════════════

export function LogisticsOps() {
  const [board, setBoard] = useState<any | null>(null)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [routes, setRoutes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState<any | null>(null) // sugerencia elegida para crear ruta

  const refresh = useCallback(async () => {
    const [b, s, r] = await Promise.all([
      api.getOpsBoard(),
      api.getRouteSuggestions(),
      api.getDispatchRoutes(),
    ])
    if (b.success) setBoard(b.data)
    if (s.success && Array.isArray(s.data)) setSuggestions(s.data)
    if (r.success && Array.isArray(r.data)) setRoutes(r.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 20000) // tablero vivo: refresco cada 20s
    return () => clearInterval(interval)
  }, [refresh])

  const changeStaffStatus = async (userId: string, status: string) => {
    await api.setStaffStatus(status, userId)
    refresh()
  }

  const advanceRoute = async (route: any) => {
    const next: Record<string, string> = { planificada: 'cargando', cargando: 'en_ruta', en_ruta: 'retornando', retornando: 'cerrada' }
    const to = next[route.status]
    if (!to) return
    await api.setRouteStatus(route.id, to)
    refresh()
  }

  if (loading) return <p className="text-sm text-muted-foreground text-center py-10">Cargando centro de operaciones…</p>

  const ordersByStatus = (status: string) => (board?.orders || []).filter((o: any) => o.dispatchStatus === status)

  return (
    <div className="space-y-5">
      {/* ── Sugerencias de agrupación (el ahorro real) ── */}
      {suggestions.filter(s => s.orderCount >= 2).length > 0 && (
        <Card className="border-emerald-500/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-500" />
              Agrupaciones sugeridas — menos viajes, más entregas
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {suggestions.filter(s => s.orderCount >= 2).slice(0, 6).map((s, i) => (
              <div key={i} className="rounded-xl border p-3 space-y-1.5">
                <p className="text-sm font-semibold">{s.zone}</p>
                <p className="text-xs text-muted-foreground">
                  {s.orderCount} pedidos · {Number(s.totalWeightKg).toFixed(1)} kg
                  {s.suggestedAuxiliaries > 0 && ` · ${s.suggestedAuxiliaries} auxiliar(es)`}
                </p>
                {s.joinRoute ? (
                  <p className="text-xs text-emerald-600 font-medium">→ Cabe en la ruta {s.joinRoute.routeNumber} ({s.joinRoute.vehicleName})</p>
                ) : s.suggestedVehicle ? (
                  <p className="text-xs text-muted-foreground">Vehículo sugerido: <span className="font-medium">{s.suggestedVehicle.name}</span> ({s.suggestedVehicle.maxWeightKg} kg)</p>
                ) : (
                  <p className="text-xs text-amber-600">Sin vehículo disponible con capacidad</p>
                )}
                <Button size="sm" className="w-full mt-1" disabled={!s.suggestedVehicle && !s.joinRoute}
                  onClick={() => setCreating(s)}>
                  <RouteIcon className="h-3.5 w-3.5 mr-1.5" />Crear ruta
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Kanban de pedidos con semáforo ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {DISPATCH_COLUMNS.map(col => {
          const items = ordersByStatus(col.key)
          return (
            <Card key={col.key}>
              <CardHeader className="py-3">
                <CardTitle className="text-xs uppercase tracking-wider flex items-center justify-between">
                  {col.label}
                  <Badge variant="secondary">{items.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[380px] overflow-y-auto">
                {items.length === 0 && <p className="text-[11px] text-muted-foreground text-center py-3">—</p>}
                {items.map((o: any) => (
                  <div key={o.id} className={`rounded-lg border p-2 ${col.key !== 'despachado' ? waitColor(o.waitingMinutes) : 'border-border'}`}>
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-semibold truncate">#{o.orderNumber}</p>
                      {col.key !== 'despachado' && (
                        <span className={`text-[10px] font-medium shrink-0 ${o.waitingMinutes > 60 ? 'text-red-500' : o.waitingMinutes > 30 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                          {o.waitingMinutes} min
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{o.customerName}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {o.neighborhood || o.municipality || 'Sin zona'} · {Number(o.weightKg).toFixed(1)} kg
                      {o.routeId && ' · 🛣️ en ruta'}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* ── Rutas activas ── */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm flex items-center gap-2">
            <RouteIcon className="h-4 w-4" />Rutas activas ({routes.length})
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={refresh}><RefreshCw className="h-3.5 w-3.5" /></Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {routes.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No hay rutas activas. Crea una desde las sugerencias o seleccionando pedidos.</p>}
          {routes.map(r => (
            <div key={r.id} className="rounded-xl border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">
                    {r.routeNumber} <Badge variant="outline" className="ml-1">{r.status}</Badge>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.vehicleName || 'Sin vehículo'}{r.plate ? ` (${r.plate})` : ''} · {r.driverName || 'Sin conductor'} ·{' '}
                    {Number(r.totalWeightKg).toFixed(1)}/{Number(r.maxWeightKg || 0).toFixed(0)} kg · {r.stopsCount} paradas
                    {r.zoneLabel ? ` · ${r.zoneLabel}` : ''}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {r.status !== 'cerrada' && r.status !== 'cancelada' && (
                    <>
                      <Button size="sm" onClick={() => advanceRoute(r)}>
                        <Play className="h-3 w-3 mr-1" />
                        {r.status === 'planificada' ? 'Iniciar cargue' : r.status === 'cargando' ? 'Despachar' : r.status === 'en_ruta' ? 'Retornando' : 'Cerrar'}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive"
                        onClick={async () => { await api.setRouteStatus(r.id, 'cancelada'); refresh() }}>
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {(r.stops || []).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {r.stops.map((s: any) => (
                    <span key={s.id} className={`text-[10px] px-2 py-1 rounded-full border ${s.dispatchStatus === 'entregado' ? 'border-emerald-500/50 text-emerald-600' : 'border-border text-muted-foreground'}`}>
                      {s.sequence}. #{s.orderNumber} {s.dispatchStatus === 'entregado' ? '✓' : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── Vehículos + Personal ── */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Truck className="h-4 w-4" />Vehículos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {(board?.vehicles || []).map((v: any) => {
              const load = v.routeWeightKg != null ? Math.min(100, Math.round((Number(v.routeWeightKg) / Number(v.maxWeightKg)) * 100)) : 0
              return (
                <div key={v.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{v.name}{v.plate ? ` · ${v.plate}` : ''}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {v.status}{v.routeNumber ? ` · ruta ${v.routeNumber} (${load}% carga)` : ''}
                    </p>
                  </div>
                  {v.routeId && (
                    <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden shrink-0">
                      <div className={`h-full ${load > 90 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${load}%` }} />
                    </div>
                  )}
                  <Badge variant={v.status === 'disponible' ? 'default' : 'secondary'} className="shrink-0 text-[10px]">
                    {Number(v.maxWeightKg).toFixed(0)} kg
                  </Badge>
                </div>
              )
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" />Personal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {(board?.couriers || []).length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Sin repartidores registrados</p>}
            {(board?.couriers || []).map((c: any) => (
              <div key={c.id} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{c.name}</p>
                  <p className="text-[10px] text-muted-foreground">{c.deliveredToday || 0} entregas hoy</p>
                </div>
                <select
                  value={c.status || 'disponible'}
                  onChange={e => changeStaffStatus(c.id, e.target.value)}
                  className="text-[11px] border rounded-md bg-background px-1.5 py-1"
                >
                  {STAFF_STATUS.map(s => <option key={s} value={s}>{STAFF_LABEL[s]}</option>)}
                </select>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {creating && (
        <CreateRouteModal
          suggestion={creating}
          onClose={() => setCreating(null)}
          onCreated={() => { setCreating(null); refresh() }}
        />
      )}
    </div>
  )
}

// ── Modal: crear ruta desde una sugerencia ─────────────────────────────────────

function CreateRouteModal({ suggestion, onClose, onCreated }: { suggestion: any; onClose: () => void; onCreated: () => void }) {
  const [vehicles, setVehicles] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [vehicleId, setVehicleId] = useState(suggestion.suggestedVehicle?.id || '')
  const [driverId, setDriverId] = useState('')
  const [auxCount, setAuxCount] = useState(suggestion.suggestedAuxiliaries || 0)
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(
    new Set((suggestion.orders || []).map((o: any) => String(o.id)))
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getFleetVehicles('disponible').then((r: any) => { if (r.success) setVehicles(r.data || []) })
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/delivery/drivers`, { credentials: 'include' })
      .then(r => r.json())
      .then(j => { if (j.success) setDrivers(j.data || []) })
      .catch(() => {})
  }, [])

  const create = async () => {
    if (!vehicleId || selectedOrders.size === 0) { setError('Elige vehículo y al menos un pedido'); return }
    setSaving(true)
    setError('')
    const res = await api.createDispatchRoute({
      orderIds: [...selectedOrders],
      vehicleId,
      driverId: driverId || undefined,
      auxiliaries: Array.from({ length: auxCount }, (_, i) => ({ name: `Auxiliar ${i + 1}` })),
      zoneLabel: suggestion.zone,
    })
    setSaving(false)
    if (res.success) onCreated()
    else setError(res.error || 'No se pudo crear la ruta')
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Crear ruta · {suggestion.zone}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="max-h-40 overflow-y-auto border rounded-lg divide-y">
            {(suggestion.orders || []).map((o: any) => (
              <label key={o.id} className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-muted/50">
                <input type="checkbox" checked={selectedOrders.has(String(o.id))}
                  onChange={() => setSelectedOrders(prev => {
                    const next = new Set(prev)
                    if (next.has(String(o.id))) next.delete(String(o.id)); else next.add(String(o.id))
                    return next
                  })} />
                <span className="flex-1 truncate">#{o.orderNumber} · {o.customerName}</span>
                <span className="text-muted-foreground shrink-0">{Number(o.weightKg).toFixed(1)} kg</span>
              </label>
            ))}
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Vehículo</label>
            <select value={vehicleId} onChange={e => setVehicleId(e.target.value)} className="w-full h-9 text-sm border rounded-md bg-background px-2">
              <option value="">Seleccionar…</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.maxWeightKg} kg)</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Conductor (opcional)</label>
            <select value={driverId} onChange={e => setDriverId(e.target.value)} className="w-full h-9 text-sm border rounded-md bg-background px-2">
              <option value="">Asignar después…</option>
              {drivers.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Auxiliares de cargue (sugerido: {suggestion.suggestedAuxiliaries})</label>
            <Input type="number" min={0} max={4} value={auxCount} onChange={e => setAuxCount(Number(e.target.value))} className="h-9 w-24 text-sm" />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={create} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><PackageCheck className="h-4 w-4 mr-1.5" />Crear ruta ({selectedOrders.size})</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ═══════════════════════════════════════════════════════════════════
// ANALÍTICA + DOCUMENTOS/GASTOS (para el comerciante)
// ═══════════════════════════════════════════════════════════════════

export function FleetInsights() {
  const [tab, setTab] = useState<'analitica' | 'gastos'>('analitica')
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button size="sm" variant={tab === 'analitica' ? 'default' : 'outline'} onClick={() => setTab('analitica')}>
          <TrendingUp className="h-3.5 w-3.5 mr-1.5" />Analítica
        </Button>
        <Button size="sm" variant={tab === 'gastos' ? 'default' : 'outline'} onClick={() => setTab('gastos')}>
          <Fuel className="h-3.5 w-3.5 mr-1.5" />Gastos & Documentos
        </Button>
      </div>
      {tab === 'analitica' ? <FleetAnalytics /> : <FleetExpensesDocs />}
    </div>
  )
}

function FleetAnalytics() {
  const [data, setData] = useState<any | null>(null)
  const [days, setDays] = useState(30)

  useEffect(() => {
    api.getFleetAnalytics(days).then(r => { if (r.success) setData(r.data) })
  }, [days])

  if (!data) return <p className="text-sm text-muted-foreground text-center py-8">Cargando analítica…</p>
  const ops = data.operations || {}

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {[7, 30, 90].map(d => (
          <Button key={d} size="sm" variant={days === d ? 'default' : 'outline'} onClick={() => setDays(d)}>{d} días</Button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: 'Pedidos', value: ops.totalOrders || 0 },
          { label: 'Entregados', value: ops.delivered || 0 },
          { label: 'Min. prom. a despacho', value: ops.avgMinutesToDispatch ?? '—' },
          { label: 'Min. prom. de entrega', value: ops.avgMinutesToDeliver ?? '—' },
        ].map((k, i) => (
          <Card key={i}><CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold">{k.value}</p>
            <p className="text-xs text-muted-foreground">{k.label}</p>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Rentabilidad por vehículo</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-2">Vehículo</th>
                <th className="text-right py-2">Entregas</th>
                <th className="text-right py-2">Facturación movilizada</th>
                <th className="text-right py-2">Costos reales</th>
                <th className="text-right py-2">Utilidad est.</th>
                <th className="text-right py-2">Costo/entrega</th>
              </tr>
            </thead>
            <tbody>
              {(data.vehicles || []).map((v: any) => (
                <tr key={v.id} className="border-b last:border-0">
                  <td className="py-2 font-medium">{v.name}{v.plate ? ` (${v.plate})` : ''}</td>
                  <td className="text-right">{v.deliveries}</td>
                  <td className="text-right">{fmtCOP(Number(v.revenueMoved))}</td>
                  <td className="text-right">{fmtCOP(Number(v.totalCost))}</td>
                  <td className={`text-right font-semibold ${Number(v.estimatedProfit) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {fmtCOP(Number(v.estimatedProfit))}
                  </td>
                  <td className="text-right">{v.costPerDelivery != null ? fmtCOP(v.costPerDelivery) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Ranking de conductores</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          {(data.drivers || []).length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Sin entregas en el período</p>}
          {(data.drivers || []).map((d: any, i: number) => (
            <div key={d.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
              <span className="text-sm font-bold text-muted-foreground w-6">#{i + 1}</span>
              <span className="flex-1 text-xs font-medium truncate">{d.name}</span>
              <span className="text-xs text-muted-foreground">{d.deliveries} entregas</span>
              <Badge variant="outline" className="text-[10px]">{d.avgMinutesPerDelivery ?? '—'} min/entrega</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function FleetExpensesDocs() {
  const [vehicles, setVehicles] = useState<any[]>([])
  const [selected, setSelected] = useState<string>('')
  const [expenses, setExpenses] = useState<any[]>([])
  const [profile, setProfile] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [expForm, setExpForm] = useState<any>({ type: 'combustible', amount: '', gallons: '', odometerKm: '', notes: '' })

  useEffect(() => {
    api.getFleetVehicles().then((r: any) => {
      if (r.success && r.data?.length) { setVehicles(r.data); setSelected(r.data[0].id) }
    })
  }, [])

  useEffect(() => {
    if (!selected) return
    api.getFleetExpenses({ vehicleId: selected, days: 90 }).then((r: any) => { if (r.success) setExpenses(r.data || []) })
    api.getFleetVehicle(selected).then((r: any) => {
      const v = r.data?.vehicle || r.data || {}
      setProfile({
        soatExpiry: v.soatExpiry?.slice?.(0, 10) || '', tecnoExpiry: v.tecnoExpiry?.slice?.(0, 10) || '',
        insuranceExpiry: v.insuranceExpiry?.slice?.(0, 10) || '', odometerKm: v.odometerKm || 0,
        fuelType: v.fuelType || '', maintenanceEveryKm: v.maintenanceEveryKm || 0,
      })
    })
  }, [selected])

  const saveProfile = async () => {
    setSaving(true)
    await api.updateVehicleProfile(selected, {
      soatExpiry: profile.soatExpiry || undefined,
      tecnoExpiry: profile.tecnoExpiry || undefined,
      insuranceExpiry: profile.insuranceExpiry || undefined,
      odometerKm: Number(profile.odometerKm) || 0,
      fuelType: profile.fuelType || undefined,
      maintenanceEveryKm: Number(profile.maintenanceEveryKm) || 0,
    })
    setSaving(false)
  }

  const addExpense = async () => {
    if (!expForm.amount) return
    const res = await api.createFleetExpense({
      vehicleId: selected, type: expForm.type, amount: Number(expForm.amount),
      gallons: expForm.gallons ? Number(expForm.gallons) : undefined,
      odometerKm: expForm.odometerKm ? Number(expForm.odometerKm) : undefined,
      notes: expForm.notes || undefined,
    })
    if (res.success) {
      setExpForm({ type: 'combustible', amount: '', gallons: '', odometerKm: '', notes: '' })
      api.getFleetExpenses({ vehicleId: selected, days: 90 }).then((r: any) => { if (r.success) setExpenses(r.data || []) })
    }
  }

  const docField = (key: string, label: string) => (
    <div>
      <label className="text-xs font-medium mb-1 block">{label}</label>
      <Input type="date" value={profile[key] || ''} onChange={e => setProfile({ ...profile, [key]: e.target.value })} className="h-9 text-sm" />
    </div>
  )

  return (
    <div className="space-y-4">
      <select value={selected} onChange={e => setSelected(e.target.value)} className="h-9 text-sm border rounded-md bg-background px-2 min-w-[220px]">
        {vehicles.map(v => <option key={v.id} value={v.id}>{v.name}{v.plate ? ` (${v.plate})` : ''}</option>)}
      </select>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><FileWarning className="h-4 w-4" />Documentos y mantenimiento preventivo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            {docField('soatExpiry', 'Vence SOAT')}
            {docField('tecnoExpiry', 'Vence Tecnomecánica')}
            {docField('insuranceExpiry', 'Vence Seguro')}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Odómetro (km)</label>
              <Input type="number" min={0} value={profile.odometerKm ?? 0} onChange={e => setProfile({ ...profile, odometerKm: e.target.value })} className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Combustible</label>
              <Input placeholder="Diesel / Gasolina" value={profile.fuelType || ''} onChange={e => setProfile({ ...profile, fuelType: e.target.value })} className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Mantenimiento cada (km)</label>
              <Input type="number" min={0} value={profile.maintenanceEveryKm ?? 0} onChange={e => setProfile({ ...profile, maintenanceEveryKm: e.target.value })} className="h-9 text-sm" />
            </div>
          </div>
          <Button size="sm" onClick={saveProfile} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar perfil'}
          </Button>
          <p className="text-[10px] text-muted-foreground">
            Las alertas de vencimiento y mantenimiento llegan automáticamente a tus notificaciones (revisión diaria).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Fuel className="h-4 w-4" />Gastos del vehículo (90 días)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <select value={expForm.type} onChange={e => setExpForm({ ...expForm, type: e.target.value })} className="h-9 text-sm border rounded-md bg-background px-2">
              {['combustible', 'peaje', 'repuesto', 'lavado', 'otro'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <Input type="number" placeholder="Valor $" value={expForm.amount} onChange={e => setExpForm({ ...expForm, amount: e.target.value })} className="h-9 w-28 text-sm" />
            {expForm.type === 'combustible' && (
              <Input type="number" placeholder="Galones" value={expForm.gallons} onChange={e => setExpForm({ ...expForm, gallons: e.target.value })} className="h-9 w-24 text-sm" />
            )}
            <Input type="number" placeholder="Odómetro km" value={expForm.odometerKm} onChange={e => setExpForm({ ...expForm, odometerKm: e.target.value })} className="h-9 w-32 text-sm" />
            <Button size="sm" onClick={addExpense}><Plus className="h-3.5 w-3.5 mr-1" />Registrar</Button>
          </div>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {expenses.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Sin gastos registrados</p>}
            {expenses.map((e: any) => (
              <div key={e.id} className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs">
                <Badge variant="outline" className="text-[10px] capitalize shrink-0">{e.type}</Badge>
                <span className="font-semibold">{fmtCOP(Number(e.amount))}</span>
                {e.gallons && <span className="text-muted-foreground">{e.gallons} gal</span>}
                {e.odometerKm && <span className="text-muted-foreground">{e.odometerKm} km</span>}
                <span className="flex-1" />
                <span className="text-muted-foreground shrink-0">
                  {new Date(e.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                  {e.createdByName ? ` · ${e.createdByName}` : ''}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
