"use client"

/**
 * Dashboard Gerencial (ferretería F6) — la pantalla que el gerente abre cada
 * mañana: ventas, embudo de operación en vivo, logística, talento, inventario
 * y las dos herramientas de decisión: mapa de calor de ventas por zona y
 * sugerencia de compra por consumo real.
 */

import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { formatCOP } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard, RefreshCw, Loader2, ShoppingCart, TrendingUp, Truck,
  Users, Package, AlertTriangle, MapPin, ShoppingBag, Flame, Timer,
  CheckCircle2, FileSpreadsheet, Boxes, Warehouse, Star,
} from 'lucide-react'

const fmtMin = (m: number | null | undefined) => {
  if (m == null) return '—'
  if (m < 60) return `${Math.round(m)} min`
  const h = Math.floor(m / 60)
  return `${h}h ${Math.round(m % 60)}m`
}

export function ExecutiveDashboard() {
  const [d, setD] = useState<any | null>(null)
  const [heatmap, setHeatmap] = useState<any[]>([])
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [dash, heat, sug] = await Promise.all([
        api.getExecutiveDashboard(),
        api.getSalesHeatmap(30),
        api.getOpsPurchaseSuggestions(),
      ])
      if (dash.success) setD(dash.data)
      if (heat.success && Array.isArray(heat.data)) setHeatmap(heat.data)
      if (sug.success && Array.isArray(sug.data)) setSuggestions(sug.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading && !d) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  }
  if (!d) return null

  const maxHeat = heatmap.reduce((m, z) => Math.max(m, z.revenue), 1)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-foreground flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-primary" /> Gerencia
          </h2>
          <p className="text-sm text-muted-foreground">Toda la operación en una pantalla — {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <Button variant="outline" size="sm" className="h-9 gap-1" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
        </Button>
      </div>

      {/* Ventas */}
      <Section title="Ventas" icon={<ShoppingCart className="h-4 w-4" />}>
        <Kpi label="Hoy" value={formatCOP(d.sales.today.amount)} sub={`${d.sales.today.count} ventas · ticket ${formatCOP(d.sales.today.avgTicket)}`} accent="text-green-600" />
        <Kpi label="Semana" value={formatCOP(d.sales.week.amount)} sub={`${d.sales.week.count} ventas`} />
        <Kpi label="Mes" value={formatCOP(d.sales.month.amount)} sub={`${d.sales.month.count} ventas`} />
        <Kpi label="Cotizaciones" value={`${d.sales.quotes.conversionRate}%`} sub={`${d.sales.quotes.converted}/${d.sales.quotes.month} facturadas · pipeline ${formatCOP(d.sales.quotes.pipeline)}`} icon={<FileSpreadsheet className="h-3.5 w-3.5" />} />
        {d.operation?.satisfaction?.avg != null && (
          <Kpi label="Satisfacción" value={`${d.operation.satisfaction.avg} ★`} sub={`${d.operation.satisfaction.count} calificaciones (30 días)`} accent={d.operation.satisfaction.avg >= 4 ? 'text-green-600' : d.operation.satisfaction.avg >= 3 ? 'text-amber-600' : 'text-red-600'} icon={<Star className="h-3.5 w-3.5" />} />
        )}
      </Section>

      {/* Operación: embudo en vivo */}
      <Card className="border-border">
        <CardContent className="p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-3">
            <Flame className="h-4 w-4 text-primary" /> Operación en vivo
            {d.operation.enRiesgo > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-red-600 normal-case font-medium">
                <AlertTriangle className="h-3.5 w-3.5" /> {d.operation.enRiesgo} en riesgo
              </span>
            )}
            {d.operation.otif?.rate != null && (
              <span className={`ml-auto inline-flex items-center gap-1 normal-case font-medium ${d.operation.otif.rate >= 90 ? 'text-green-600' : d.operation.otif.rate >= 75 ? 'text-amber-600' : 'text-red-600'}`}
                title={`${d.operation.otif.onTime}/${d.operation.otif.withPromise} entregados a tiempo (30 días)`}>
                <CheckCircle2 className="h-3.5 w-3.5" /> OTIF {d.operation.otif.rate}%
              </span>
            )}
            {d.operation.avgCycleMin != null && (
              <span className={`inline-flex items-center gap-1 text-muted-foreground normal-case ${d.operation.otif?.rate != null ? '' : 'ml-auto'}`}>
                <Timer className="h-3.5 w-3.5" /> ciclo promedio {fmtMin(d.operation.avgCycleMin)}
              </span>
            )}
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            <FunnelStep label="Pendientes" value={d.operation.pendientes} tone="amber" />
            <FunnelStep label="En picking" value={d.operation.enPicking} tone="blue" />
            <FunnelStep label="Preparados" value={d.operation.preparados} tone="indigo" />
            <FunnelStep label="Cargando" value={d.operation.cargando} tone="violet" />
            <FunnelStep label="En ruta" value={d.operation.enRuta} tone="orange" />
            <FunnelStep label="Entregados hoy" value={d.operation.entregadosHoy} tone="green" />
          </div>
        </CardContent>
      </Card>

      {/* Logística + Talento */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Section title="Logística" icon={<Truck className="h-4 w-4" />}>
          <Kpi label="Vehículos" value={`${d.logistics.vehicles.disponibles} disp.`} sub={`${d.logistics.vehicles.enRuta} en ruta · ${d.logistics.vehicles.mantenimiento} en taller${d.logistics.maintenanceDue ? ` · 🔧 ${d.logistics.maintenanceDue} req. servicio` : ''}`} accent={d.logistics.maintenanceDue > 0 ? 'text-amber-600' : undefined} />
          <Kpi label="Valor en la calle" value={formatCOP(d.logistics.valorEnCalle)} sub={`entregado hoy: ${formatCOP(d.logistics.valorEntregadoHoy)}`} />
          <Kpi label="Costo logístico/entrega" value={d.logistics.costPerDelivery != null ? formatCOP(d.logistics.costPerDelivery) : '—'} sub={`${d.logistics.deliveriesMonth} entregas · gastos mes ${formatCOP(d.logistics.expensesMonth)}`} />
          <Kpi label="Utilización de flota" value={d.logistics.utilizationPct != null ? `${d.logistics.utilizationPct}%` : '—'} sub="tiempo en ruta (7 días)" accent={d.logistics.utilizationPct != null && d.logistics.utilizationPct < 30 ? 'text-amber-600' : undefined} />
        </Section>
        <Section title="Talento" icon={<Users className="h-4 w-4" />}>
          <Kpi label="Equipo activo" value={String(d.staff.totalStaff)} sub={`${d.staff.drivers} conductores · ${d.staff.auxiliaries} auxiliares`} />
          <div className="col-span-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Top picking hoy</p>
            {d.staff.topPickersToday.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin tareas completadas hoy</p>
            ) : (
              <div className="space-y-1">
                {d.staff.topPickersToday.map((p: any, i: number) => (
                  <p key={i} className="text-xs text-foreground flex justify-between">
                    <span>{i + 1}º {p.name}</span><span className="font-semibold">{p.tasks} pedidos</span>
                  </p>
                ))}
              </div>
            )}
          </div>
        </Section>
      </div>

      {/* Inventario + Sugerencia de compra */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="border-border">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-3">
              <Package className="h-4 w-4 text-primary" /> Inventario
            </p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <Kpi label="Valor inventario" value={formatCOP(d.inventory.inventoryValue)} sub={`${d.inventory.reservedUnits} und. reservadas`} />
              <Kpi label="Rotación (mes)" value={d.inventory.rotationMonthly != null ? `${d.inventory.rotationMonthly}×` : '—'} sub={d.inventory.accuracy != null ? `exactitud ${d.inventory.accuracy}%` : (d.inventory.daysOfInventory != null ? `${d.inventory.daysOfInventory} días de inventario` : 'sin ventas del mes')} accent={d.inventory.accuracy != null && d.inventory.accuracy < 95 ? 'text-amber-600' : undefined} />
              <Kpi label="Alertas" value={`${d.inventory.outOfStock + d.inventory.lowStock}`} sub={`${d.inventory.outOfStock} agotados · ${d.inventory.lowStock} bajos${d.inventory.sedeLowStock ? ` · ${d.inventory.sedeLowStock} bajo mín. sede` : ''}`} accent={d.inventory.outOfStock > 0 ? 'text-red-500' : undefined} />
            </div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
              <ShoppingBag className="h-3 w-3" /> Sugerencia de compra (consumo real 30 días)
            </p>
            {suggestions.length === 0 ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Nada urgente por pedir</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {suggestions.map((s: any) => (
                  <div key={s.productId} className={`flex items-center justify-between text-xs rounded-md px-2.5 py-1.5 ${s.urgent ? 'bg-red-500/10' : 'bg-secondary/40'}`}>
                    <div className="min-w-0">
                      <p className="text-foreground truncate">{s.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        stock {s.stock}{s.daysLeft != null ? ` · alcanza ${s.daysLeft} día${s.daysLeft !== 1 ? 's' : ''}` : ''}{s.supplier ? ` · ${s.supplier}` : ''}
                      </p>
                    </div>
                    <span className={`shrink-0 ml-2 font-bold ${s.urgent ? 'text-red-600' : 'text-primary'}`}>pedir {s.suggestedQty}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mapa de calor */}
        <Card className="border-border">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-3">
              <MapPin className="h-4 w-4 text-primary" /> Mapa de calor de ventas (30 días)
            </p>
            {heatmap.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3 text-center">Sin pedidos con zona registrada aún</p>
            ) : (
              <div className="space-y-1.5">
                {heatmap.map((z: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-foreground w-36 truncate shrink-0" title={`${z.zone}, ${z.municipality}`}>
                      {z.zone}
                    </span>
                    <div className="flex-1 h-5 bg-secondary/50 rounded overflow-hidden relative">
                      <div className="h-full bg-gradient-to-r from-primary/70 to-primary rounded" style={{ width: `${Math.max(4, (z.revenue / maxHeat) * 100)}%` }} />
                      <span className="absolute inset-y-0 left-2 flex items-center text-[10px] font-medium text-foreground">
                        {formatCOP(z.revenue)}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground w-14 text-right shrink-0">{z.orders} ped.</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="border-border">
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-3">
          <span className="text-primary">{icon}</span> {title}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{children}</div>
      </CardContent>
    </Card>
  )
}

function Kpi({ label, value, sub, accent, icon }: { label: string; value: string; sub?: string; accent?: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-md bg-secondary/30 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">{icon}{label}</p>
      <p className={`text-base font-bold leading-tight mt-0.5 ${accent || 'text-foreground'}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

const FUNNEL_TONE: Record<string, string> = {
  amber: 'border-amber-300 text-amber-600', blue: 'border-blue-300 text-blue-600',
  indigo: 'border-indigo-300 text-indigo-600', violet: 'border-violet-300 text-violet-600',
  orange: 'border-orange-300 text-orange-600', green: 'border-green-300 text-green-600',
}

function FunnelStep({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-lg border-2 ${FUNNEL_TONE[tone]} bg-card px-2 py-2 text-center`}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
    </div>
  )
}
