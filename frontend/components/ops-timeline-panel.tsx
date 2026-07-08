"use client"

/**
 * Tiempos de Operación (ferretería F4) — la vista del gerente para saber DÓNDE se
 * pierde el tiempo, con datos:
 *  1. Cuellos de botella: minutos promedio por etapa (picking→preparado→cargado→
 *     despachado→entregado) + ciclo total, con la etapa más lenta resaltada.
 *  2. Pedidos en riesgo: promesa vencida/próxima o abiertos más de lo normal,
 *     para actuar ANTES de que el cliente reclame.
 *  3. Recepción de mercancía: tiempo llegada→almacenado por proveedor.
 */

import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useStore } from '@/lib/store'
import { formatCOP } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  Timer, AlertTriangle, TrendingDown, RefreshCw, Loader2, Truck,
  PackageCheck, Clock, MessageCircle, Gauge,
} from 'lucide-react'

const fmtMin = (m: number | null | undefined) => {
  if (m == null) return '—'
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const min = Math.round(m % 60)
  return min ? `${h}h ${min}m` : `${h}h`
}

export function OpsTimelinePanel() {
  const { sedes, fetchSedes } = useStore()
  const [analytics, setAnalytics] = useState<any | null>(null)
  const [risk, setRisk] = useState<any | null>(null)
  const [reception, setReception] = useState<any | null>(null)
  const [purchases, setPurchases] = useState<any[]>([])
  const [days, setDays] = useState(30)
  const [sedeFilter, setSedeFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [pAction, setPAction] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [a, r, rec, pur] = await Promise.all([
        api.getStageAnalytics(days, sedeFilter || undefined),
        api.getAtRiskOrders(),
        api.getReceptionAnalytics(90),
        api.getRecentPurchases(),
      ])
      if (a.success) setAnalytics(a.data)
      if (r.success) setRisk(r.data)
      if (rec.success) setReception(rec.data)
      if (pur.success && Array.isArray(pur.data)) setPurchases(pur.data)
    } finally {
      setLoading(false)
    }
  }, [days, sedeFilter])

  const markArrival = async (id: string, sedeId: string) => {
    setPAction(id)
    try {
      const res = await api.markPurchaseArrival(id, sedeId || null)
      if (res.success) { toast.success('Llegada registrada'); await load() }
      else toast.error((res as any).error || 'No se pudo')
    } finally { setPAction(null) }
  }
  const markReceived = async (id: string) => {
    setPAction(id)
    try {
      const res = await api.markPurchaseReceived(id)
      if (res.success) {
        const n = (res.data as any)?.distributedItems || 0
        toast.success(n > 0 ? `Recibida — ${n} producto(s) sumados a la bodega` : 'Recepción registrada')
        await load()
      } else toast.error((res as any).error || 'No se pudo')
    } finally { setPAction(null) }
  }

  useEffect(() => { if (!sedes.length) fetchSedes() }, [sedes.length, fetchSedes])
  useEffect(() => { load() }, [load])

  const maxAvg = analytics?.stages?.reduce((m: number, s: any) => Math.max(m, s.avgMinutes || 0), 0) || 1

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-foreground flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" /> Tiempos de operación
          </h2>
          <p className="text-sm text-muted-foreground">Dónde se pierde el tiempo entre facturar y entregar — con datos, no intuición</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {sedes.length >= 2 && (
            <select value={sedeFilter} onChange={e => setSedeFilter(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
              <option value="">Todas las sedes</option>
              {sedes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <select value={days} onChange={e => setDays(Number(e.target.value))} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            <option value={7}>7 días</option>
            <option value={30}>30 días</option>
            <option value={90}>90 días</option>
          </select>
          <Button variant="outline" size="sm" className="h-9 gap-1" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {loading && !analytics ? (
        <div className="flex justify-center py-14"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Cuellos de botella */}
          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-primary" /> Tiempo por etapa
                </p>
                <div className="flex items-center gap-3 text-xs">
                  {analytics?.cycle?.avgMinutes != null && (
                    <span className="text-muted-foreground">Ciclo total: <span className="font-bold text-foreground">{fmtMin(analytics.cycle.avgMinutes)}</span> ({analytics.cycle.delivered} entregados)</span>
                  )}
                  {analytics?.bottleneck && (
                    <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                      <AlertTriangle className="h-3.5 w-3.5" /> Cuello: {analytics.bottleneck.label}
                    </span>
                  )}
                </div>
              </div>

              {(!analytics?.stages || analytics.stages.every((s: any) => s.avgMinutes == null)) ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Aún no hay suficientes pedidos con etapas registradas en el rango.</p>
              ) : (
                <div className="space-y-2">
                  {analytics.stages.map((s: any) => {
                    const isBottleneck = analytics.bottleneck?.stage === s.stage
                    const pct = s.avgMinutes ? Math.max(3, (s.avgMinutes / maxAvg) * 100) : 0
                    return (
                      <div key={s.stage} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-24 shrink-0">{s.label}</span>
                        <div className="flex-1 h-6 bg-secondary/50 rounded overflow-hidden relative">
                          <div className={`h-full rounded ${isBottleneck ? 'bg-amber-500' : 'bg-primary/60'}`} style={{ width: `${pct}%` }} />
                          <span className="absolute inset-y-0 left-2 flex items-center text-[11px] font-medium text-foreground">
                            {fmtMin(s.avgMinutes)}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground w-16 shrink-0 text-right">{s.samples} pedidos</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pedidos en riesgo */}
          <Card className="border-border">
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-red-500" /> Pedidos en riesgo
                {risk?.orders?.length > 0 && <span className="text-xs bg-red-500/15 text-red-600 rounded-full px-2 py-0.5">{risk.orders.length}</span>}
              </p>
              <p className="text-[11px] text-muted-foreground mb-3">
                Umbral: abiertos más de {fmtMin(risk?.thresholdMin)} (promedio del comercio: {fmtMin(risk?.avgCycleMin)})
              </p>

              {!risk?.orders?.length ? (
                <div className="text-center py-6 text-muted-foreground">
                  <PackageCheck className="h-8 w-8 mx-auto opacity-30 mb-1 text-green-600" />
                  <p className="text-sm">Ningún pedido en riesgo ahora mismo 🎉</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {risk.orders.map((o: any) => (
                    <div key={o.id} className={`rounded-md border p-2.5 flex items-center justify-between gap-2 flex-wrap ${o.overdue ? 'border-red-300 bg-red-500/5' : 'border-amber-300 bg-amber-500/5'}`}>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{o.orderNumber}</span>
                          <span className="text-xs bg-secondary rounded-full px-2 py-0.5 text-muted-foreground">{o.dispatchStatus}</span>
                          {o.sedeName && <span className="text-[10px] text-muted-foreground">📍 {o.sedeName}</span>}
                        </div>
                        <p className={`text-[11px] mt-0.5 flex items-center gap-1 ${o.overdue ? 'text-red-600 font-medium' : 'text-amber-600'}`}>
                          <Clock className="h-3 w-3" /> {o.reason}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{o.customerName} · {formatCOP(o.total)}</p>
                      </div>
                      {o.customerPhone && (
                        <a
                          href={`https://wa.me/${String(o.customerPhone).replace(/\D/g, '')}`}
                          target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-500 border border-green-300 rounded-md px-2 py-1 shrink-0"
                        >
                          <MessageCircle className="h-3.5 w-3.5" /> Avisar
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recepción de mercancía */}
          <Card className="border-border">
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                <Truck className="h-4 w-4 text-primary" /> Recepción de mercancía
                {reception?.pendingReception > 0 && (
                  <span className="text-xs bg-amber-500/15 text-amber-600 rounded-full px-2 py-0.5">{reception.pendingReception} en descargue</span>
                )}
              </p>
              {!reception?.suppliers?.length ? (
                <p className="text-sm text-muted-foreground py-2 text-center">
                  Sin recepciones medidas aún. Marca la llegada y el almacenado de tus compras para medir el tiempo por proveedor.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {reception.suppliers.map((s: any) => (
                    <div key={s.supplierId || s.supplierName} className="flex items-center justify-between text-sm rounded-md bg-secondary/40 px-3 py-2">
                      <span className="text-foreground truncate">{s.supplierName}</span>
                      <span className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                        <span>{s.receptions} recepciones</span>
                        <span className="inline-flex items-center gap-1 font-medium text-foreground"><Timer className="h-3 w-3" /> {fmtMin(s.avgMinutes)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Tablero accionable: registrar llegada (con bodega) y almacenado */}
              {purchases.length > 0 && (
                <div className="mt-4 pt-3 border-t border-border space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Compras recientes</p>
                  {purchases.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2 rounded-md bg-secondary/30 px-3 py-2 flex-wrap">
                      <div className="min-w-0">
                        <p className="text-sm text-foreground truncate">{p.invoiceNumber} · {p.supplierName}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {p.itemCount} ítems · {formatCOP(p.total)}{p.sedeName ? ` · 📍 ${p.sedeName}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {p.state === 'recibida' ? (
                          <span className="text-[11px] text-green-600 font-medium inline-flex items-center gap-1"><PackageCheck className="h-3.5 w-3.5" /> Recibida</span>
                        ) : p.state === 'en_descargue' ? (
                          <Button size="sm" className="h-7 text-xs gap-1" disabled={pAction === p.id} onClick={() => markReceived(p.id)}>
                            {pAction === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <PackageCheck className="h-3 w-3" />} Almacenada
                          </Button>
                        ) : (
                          <>
                            {sedes.length >= 1 && (
                              <select
                                defaultValue={p.sedeId || ''}
                                onChange={(e) => (p._pickSede = e.target.value)}
                                className="h-7 rounded-md border border-input bg-background px-1.5 text-xs"
                              >
                                <option value="">Bodega…</option>
                                {sedes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </select>
                            )}
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={pAction === p.id}
                              onClick={() => markArrival(p.id, p._pickSede ?? p.sedeId ?? '')}>
                              {pAction === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Truck className="h-3 w-3" />} Llegó
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  <p className="text-[10px] text-muted-foreground pt-1">Al marcar "Almacenada", el stock de la compra entra a la bodega seleccionada.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
