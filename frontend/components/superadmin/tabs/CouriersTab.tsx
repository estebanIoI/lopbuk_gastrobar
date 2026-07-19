'use client'

/**
 * CouriersTab — Panel superadmin de repartidores de plataforma (Courier F2).
 * Crea repartidores sin comercio fijo (tenant_id NULL) y les asigna el GRUPO de
 * comercios que pueden atender. El repartidor solo ve pedidos de ese grupo.
 */
import { useEffect, useState, useCallback, useMemo } from 'react'
import { RefreshCw, Truck, Plus, Store, Search, Check, X, Power, Map as MapIcon, Star, AlertTriangle, ShieldCheck, Undo2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { api } from '@/lib/api'

type Courier = {
  id: string; name: string; email: string; phone?: string | null; isActive: number; tenantsCount: number
  // F6 — avgStars es null si nunca lo calificaron (no mostrar 0)
  avgStars: number | null; ratingsCount: number; openReports: number
}
type Tenant = { id: string; name: string; businessType?: string | null }

export function CouriersTab() {
  const [couriers, setCouriers] = useState<Courier[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(false)

  // Crear repartidor
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', phone: '' })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Gestionar comercios de un repartidor
  const [manageFor, setManageFor] = useState<Courier | null>(null)
  const [assigned, setAssigned] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [rubro, setRubro] = useState<string>('__all__')
  const [saving, setSaving] = useState(false)

  // Config de mapas (seguimiento en vivo)
  const [maps, setMaps] = useState<{ provider: 'none' | 'google' | 'mapbox'; hasKey: boolean }>({ provider: 'none', hasKey: false })
  const [mapsKey, setMapsKey] = useState('')
  const [mapsSaving, setMapsSaving] = useState(false)
  const [mapsSaved, setMapsSaved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [cRes, tRes, mRes] = await Promise.all([api.getPlatformCouriers(), api.getSuperadminTenantsList(), api.getMapsConfig()])
    if (cRes.success) setCouriers(cRes.data || [])
    if (tRes.success) setTenants((tRes.data || []) as Tenant[])
    if (mRes.success && mRes.data) setMaps(mRes.data)
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const saveMaps = async () => {
    setMapsSaving(true); setMapsSaved(false)
    const res = await api.setMapsConfig({
      provider: maps.provider,
      apiKey: maps.provider !== 'none' && mapsKey.trim() ? mapsKey.trim() : undefined,
    })
    setMapsSaving(false)
    if (res.success) { setMapsKey(''); setMapsSaved(true); const m = await api.getMapsConfig(); if (m.success && m.data) setMaps(m.data) }
  }

  const rubros = useMemo(
    () => Array.from(new Set(tenants.map(t => t.businessType).filter(Boolean) as string[])).sort(),
    [tenants]
  )
  const filteredTenants = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tenants.filter(t =>
      (rubro === '__all__' || t.businessType === rubro) &&
      (!q || t.name.toLowerCase().includes(q))
    )
  }, [tenants, search, rubro])

  const submitCreate = async () => {
    setCreateError(null)
    if (!createForm.name.trim() || !createForm.email.trim() || createForm.password.length < 6) {
      setCreateError('Nombre, email y contraseña (mín. 6) requeridos'); return
    }
    setCreating(true)
    const res = await api.createPlatformCourier({
      name: createForm.name.trim(), email: createForm.email.trim(),
      password: createForm.password, phone: createForm.phone.trim() || undefined,
    })
    setCreating(false)
    if (res.success) {
      setShowCreate(false)
      setCreateForm({ name: '', email: '', password: '', phone: '' })
      await load()
    } else setCreateError(res.error || 'No se pudo crear')
  }

  const openManage = async (c: Courier) => {
    setManageFor(c); setSearch(''); setRubro('__all__')
    const res = await api.getCourierTenants(c.id)
    setAssigned(new Set(res.success ? (res.data || []).map(t => t.id) : []))
  }
  const toggleTenant = (id: string) =>
    setAssigned(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const saveManage = async () => {
    if (!manageFor) return
    setSaving(true)
    const res = await api.setCourierTenants(manageFor.id, [...assigned])
    setSaving(false)
    if (res.success) { setManageFor(null); await load() }
  }
  const toggleActive = async (c: Courier) => {
    await api.setCourierActive(c.id, !c.isActive)
    await load()
  }

  const bizLabel = (b?: string | null) => b || 'Sin rubro'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Truck className="h-5 w-5 text-primary" /> Repartidores de plataforma
          </h2>
          <p className="text-sm text-muted-foreground">
            Repartidores sin comercio fijo. Asígnales el grupo de comercios que pueden atender; solo verán esos pedidos.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={load} title="Recargar"><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={() => { setCreateError(null); setShowCreate(true) }}>
            <Plus className="mr-1 h-4 w-4" /> Nuevo repartidor
          </Button>
        </div>
      </div>

      {/* F6 · Moderación de reportes de clientes */}
      <CourierReportsPanel onReviewed={load} />

      {/* Config del seguimiento en vivo — API de mapas (opcional) */}
      <Card>
        <CardContent className="space-y-3 pt-5">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold">
              <MapIcon className="h-4 w-4 text-primary" /> Seguimiento en vivo — API de mapas
            </p>
            <p className="text-xs text-muted-foreground">
              El mapa del cliente funciona gratis con OpenStreetMap. Configura un proveedor solo si quieres <b>ruta trazada + ETA por tráfico</b>. La llave se guarda cifrada y nunca se expone al cliente.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Proveedor</Label>
              <Select value={maps.provider} onValueChange={(v) => setMaps(m => ({ ...m, provider: v as any }))}>
                <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ninguno (OSM gratis)</SelectItem>
                  <SelectItem value="google">Google Maps</SelectItem>
                  <SelectItem value="mapbox">Mapbox</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {maps.provider !== 'none' && (
              <div className="flex-1 min-w-[200px] space-y-1.5">
                <Label className="text-xs">API key {maps.hasKey && <span className="text-emerald-600">· guardada ✓</span>}</Label>
                <Input type="password" placeholder={maps.hasKey ? '•••••••• (dejar vacío para conservar)' : 'Pega la API key'}
                  value={mapsKey} onChange={e => setMapsKey(e.target.value)} className="h-9" />
              </div>
            )}
            <Button onClick={saveMaps} disabled={mapsSaving} className="h-9">
              {mapsSaving ? 'Guardando…' : 'Guardar'}
            </Button>
            {mapsSaved && <span className="text-xs text-emerald-600">Guardado ✓</span>}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : couriers.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-14 text-center">
          <Truck className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium text-muted-foreground">Sin repartidores de plataforma</p>
          <p className="mb-4 text-sm text-muted-foreground">Crea uno y asígnale sus comercios</p>
          <Button onClick={() => setShowCreate(true)}><Plus className="mr-1 h-4 w-4" /> Nuevo repartidor</Button>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {couriers.map(c => (
            <Card key={c.id} className={c.isActive ? '' : 'opacity-60'}>
              <CardContent className="space-y-3 pt-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                    {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                  </div>
                  <button onClick={() => toggleActive(c)} title={c.isActive ? 'Activo — clic para desactivar' : 'Inactivo — clic para activar'}>
                    <Power className={`h-5 w-5 ${c.isActive ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                  </button>
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <Store className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{c.tenantsCount}</span>
                  <span className="text-muted-foreground">comercio(s) asignado(s)</span>
                </div>

                {/* Calidad real: sin calificaciones no se inventa un número */}
                <div className="flex items-center gap-3 text-sm">
                  {c.avgStars != null ? (
                    <span className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      <span className="font-medium">{c.avgStars}</span>
                      <span className="text-xs text-muted-foreground">({c.ratingsCount})</span>
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sin calificaciones</span>
                  )}
                  {c.openReports > 0 && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {c.openReports} reporte{c.openReports > 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
                <Button variant="outline" size="sm" className="w-full" onClick={() => openManage(c)}>
                  <Store className="mr-1 h-3.5 w-3.5" /> Gestionar comercios
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Crear repartidor ─────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={(o) => { if (!creating) setShowCreate(o) }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nuevo repartidor de plataforma</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Nombre <span className="text-destructive">*</span></Label>
              <Input placeholder="Carlos Pérez" value={createForm.name}
                onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Email <span className="text-destructive">*</span></Label>
              <Input type="email" placeholder="carlos@correo.com" value={createForm.email}
                onChange={e => setCreateForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Contraseña <span className="text-destructive">*</span></Label>
                <Input type="password" placeholder="Mín. 6" value={createForm.password}
                  onChange={e => setCreateForm(p => ({ ...p, password: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Teléfono</Label>
                <Input placeholder="300 123 4567" value={createForm.phone}
                  onChange={e => setCreateForm(p => ({ ...p, phone: e.target.value }))} />
              </div>
            </div>
            {createError && <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{createError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} disabled={creating}>Cancelar</Button>
            <Button onClick={submitCreate} disabled={creating}>{creating ? 'Creando…' : 'Crear repartidor'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Gestionar comercios del repartidor ───────────── */}
      <Dialog open={!!manageFor} onOpenChange={(o) => { if (!o) setManageFor(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Comercios de {manageFor?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar comercio…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9" />
              </div>
              <Select value={rubro} onValueChange={setRubro}>
                <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos los rubros</SelectItem>
                  {rubros.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{assigned.size} seleccionado(s)</span>
              <div className="flex gap-2">
                <button className="hover:text-primary" onClick={() => setAssigned(new Set([...assigned, ...filteredTenants.map(t => t.id)]))}>Seleccionar visibles</button>
                <button className="hover:text-primary" onClick={() => { const n = new Set(assigned); filteredTenants.forEach(t => n.delete(t.id)); setAssigned(n) }}>Quitar visibles</button>
              </div>
            </div>

            <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-1.5">
              {filteredTenants.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Sin comercios para ese filtro</p>
              ) : filteredTenants.map(t => {
                const checked = assigned.has(t.id)
                return (
                  <button key={t.id} type="button" onClick={() => toggleTenant(t.id)}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors ${checked ? 'bg-primary/10' : 'hover:bg-accent'}`}>
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40'}`}>
                      {checked && <Check className="h-3 w-3" />}
                    </span>
                    <span className="flex-1 truncate">{t.name}</span>
                    <Badge variant="outline" className="text-[10px]">{bizLabel(t.businessType)}</Badge>
                  </button>
                )
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageFor(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={saveManage} disabled={saving}>{saving ? 'Guardando…' : 'Guardar asignación'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

const REASON_LABELS: Record<string, string> = {
  tarde: 'Llegó tarde',
  trato: 'Mal trato',
  producto: 'Pedido en mal estado',
  no_entregado: 'No entregado',
  otro: 'Otro',
}

/**
 * F6 · Moderación de reportes de repartidores.
 * Los clientes reportan desde el seguimiento (F5). Aquí se revisan.
 * Marcar como revisado NO borra el reporte: queda el historial de quién y cuándo,
 * y siempre se puede reabrir.
 */
function CourierReportsPanel({ onReviewed }: { onReviewed: () => void }) {
  type Report = {
    id: string; stars: number | null; comment: string | null; reportReason: string
    createdAt: string; reviewedAt: string | null; reviewedByName: string | null
    courierId: string; courierName: string; courierPhone: string | null
    tenantName: string | null; orderNumber: string | null; total: number | null
  }
  const [status, setStatus] = useState<'pendientes' | 'revisados' | 'todos'>('pendientes')
  const [reports, setReports] = useState<Report[]>([])
  const [pending, setPending] = useState(0)
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await api.getCourierReports(status)
    if (res.success && res.data) {
      setReports(res.data.reports as Report[])
      setPending(res.data.pending)
    }
    setLoading(false)
  }, [status])

  useEffect(() => { load() }, [load])

  const review = async (id: string, reopen: boolean) => {
    setBusyId(id)
    const res = await api.reviewCourierReport(id, reopen)
    if (res.success) { await load(); onReviewed() }
    setBusyId(null)
  }

  // Sin reportes pendientes y sin filtro activo: no ocupar espacio en la pantalla.
  if (!loading && reports.length === 0 && status === 'pendientes' && pending === 0) return null

  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4 text-destructive" /> Reportes de clientes
              {pending > 0 && <Badge variant="destructive">{pending} sin revisar</Badge>}
            </p>
            <p className="text-xs text-muted-foreground">
              Reportados por clientes al calificar su entrega. Revisar deja constancia; no borra el reporte.
            </p>
          </div>
          <div className="flex gap-1">
            {(['pendientes', 'revisados', 'todos'] as const).map(s => (
              <Button key={s} size="sm" variant={status === s ? 'default' : 'outline'}
                onClick={() => setStatus(s)} className="capitalize">{s}</Button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-6 text-center"><RefreshCw className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : reports.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {status === 'pendientes' ? 'No hay reportes sin revisar 🎉' : 'Sin reportes en este filtro'}
          </p>
        ) : (
          <div className="space-y-2">
            {reports.map(r => (
              <div key={r.id} className={`rounded-lg border p-3 ${r.reviewedAt ? 'bg-muted/30' : 'border-destructive/30 bg-destructive/5'}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{r.courierName}</span>
                      <Badge variant="outline">{REASON_LABELS[r.reportReason] || r.reportReason}</Badge>
                      {r.stars != null && (
                        <span className="flex items-center gap-0.5 text-xs">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />{r.stars}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {r.tenantName || 'Sin comercio'}
                      {r.orderNumber ? ` · Pedido #${r.orderNumber}` : ''}
                      {' · '}{new Date(r.createdAt).toLocaleString('es-CO')}
                    </p>
                    {r.comment && <p className="mt-1.5 text-sm italic">“{r.comment}”</p>}
                    {r.reviewedAt && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        <ShieldCheck className="mr-1 inline h-3 w-3" />
                        Revisado por {r.reviewedByName || 'superadmin'} el {new Date(r.reviewedAt).toLocaleDateString('es-CO')}
                      </p>
                    )}
                  </div>
                  <Button size="sm" variant={r.reviewedAt ? 'outline' : 'default'}
                    disabled={busyId === r.id} onClick={() => review(r.id, !!r.reviewedAt)}>
                    {busyId === r.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      : r.reviewedAt ? <><Undo2 className="mr-1 h-3.5 w-3.5" /> Reabrir</>
                      : <><Check className="mr-1 h-3.5 w-3.5" /> Marcar revisado</>}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
