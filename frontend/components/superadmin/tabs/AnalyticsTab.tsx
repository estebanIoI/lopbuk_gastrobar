'use client'

import { BarChart2, RefreshCw, ShoppingBag, Store, TrendingUp, TrendingDown, Minus, Users, Ticket } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCOP } from '@/lib/utils'
import { useAnalytics, deltaPct, getMaxRevenue, type TenantTimeline, type HeatmapData } from '../hooks/useAnalytics'

// ── Palette ───────────────────────────────────────────────────────────────────

const TENANT_COLORS = [
  '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#14b8a6',
]

// ── Period selector ───────────────────────────────────────────────────────────

const PERIODS = [7, 14, 30, 60, 90]

// ── Delta chip ────────────────────────────────────────────────────────────────

function Delta({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-muted-foreground">sin datos prev.</span>
  if (pct === 0) return (
    <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
      <Minus className="h-3 w-3" /> 0%
    </span>
  )
  const positive = pct > 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${positive ? 'text-green-600' : 'text-red-500'}`}>
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {positive ? '+' : ''}{pct}%
    </span>
  )
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, delta, subtext, icon: _icon, color,
}: {
  label: string
  value: string
  delta?: number | null
  subtext?: string
  icon: React.ElementType
  color: string
}) {
  const Icon = _icon as React.ComponentType<{ className?: string }>
  return (
    <Card className="border-border bg-card">
      <CardContent className="p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{label}</span>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        <p className={`text-xl font-bold leading-none ${color}`}>{value}</p>
        <div className="flex items-center justify-between">
          {delta !== undefined ? <Delta pct={delta} /> : <span />}
          {subtext && <span className="text-xs text-muted-foreground">{subtext}</span>}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Heatmap ───────────────────────────────────────────────────────────────────

// Days ordered Mon–Sun for display; dayOfWeek: 0=Sun,1=Mon..6=Sat
const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
// Display order: Mon first
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

function cellColor(count: number, max: number): string {
  if (max === 0 || count === 0) return 'hsl(215 28% 94%)'
  const t = count / max
  // Light blue (empty) → deep indigo (full)
  const h = 225
  const s = Math.round(30 + t * 60)
  const l = Math.round(92 - t * 58)
  return `hsl(${h} ${s}% ${l}%)`
}

function Heatmap({ data }: { data: HeatmapData }) {
  // Build lookup: dayOfWeek → hour → count
  const lookup: Record<number, Record<number, number>> = {}
  for (const cell of data.cells) {
    if (!lookup[cell.dayOfWeek]) lookup[cell.dayOfWeek] = {}
    lookup[cell.dayOfWeek][cell.hour] = cell.orderCount
  }

  const peakCell = data.cells.reduce<{ day: number; hour: number; count: number } | null>((best, c) =>
    !best || c.orderCount > best.count ? { day: c.dayOfWeek, hour: c.hour, count: c.orderCount } : best
  , null)

  return (
    <div className="space-y-3">
      {peakCell && (
        <p className="text-xs text-muted-foreground">
          Pico: <span className="font-medium text-foreground">{DAY_LABELS[peakCell.day]} a las {peakCell.hour}:00</span>
          {' '}con <span className="font-medium text-foreground">{peakCell.count}</span> pedidos
        </p>
      )}
      <div className="overflow-x-auto">
        <div className="min-w-[520px]">
          {/* Day headers */}
          <div className="flex mb-1 ml-8">
            {DAY_ORDER.map(d => (
              <div key={d} className="flex-1 text-center text-[10px] font-semibold text-muted-foreground">
                {DAY_LABELS[d]}
              </div>
            ))}
          </div>

          {/* Hour rows */}
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="flex items-center gap-0 mb-px">
              {/* Hour label */}
              <div className="w-8 text-right pr-1.5 text-[9px] text-muted-foreground leading-none py-px">
                {h % 3 === 0 ? `${String(h).padStart(2, '0')}h` : ''}
              </div>
              {/* Cells */}
              {DAY_ORDER.map(d => {
                const count = lookup[d]?.[h] ?? 0
                return (
                  <div
                    key={d}
                    title={`${DAY_LABELS[d]} ${String(h).padStart(2, '0')}:00 → ${count} pedidos`}
                    className="flex-1 h-4 rounded-[2px] mx-px cursor-default transition-opacity hover:opacity-70"
                    style={{ backgroundColor: cellColor(count, data.maxCount) }}
                  />
                )
              })}
            </div>
          ))}

          {/* Color legend */}
          <div className="flex items-center gap-2 mt-3 ml-8">
            <span className="text-[9px] text-muted-foreground">0</span>
            <div className="flex gap-px flex-1 max-w-[120px]">
              {Array.from({ length: 8 }, (_, i) => (
                <div
                  key={i}
                  className="flex-1 h-2.5 rounded-[1px]"
                  style={{ backgroundColor: cellColor(i + 1, 8) }}
                />
              ))}
            </div>
            <span className="text-[9px] text-muted-foreground">máx</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Bar chart per tenant ──────────────────────────────────────────────────────

function TenantChart({ tenant, color, maxRev }: { tenant: TenantTimeline; color: string; maxRev: number }) {
  const mid = Math.floor(tenant.timeline.length / 2)
  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1.5 px-1">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <span className="text-sm font-medium truncate max-w-[200px]">{tenant.tenantName}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <ShoppingBag className="h-3 w-3" /> {tenant.totalOrders}
          </span>
          <span className="font-semibold tabular-nums" style={{ color }}>
            {formatCOP(tenant.totalRevenue)}
          </span>
        </div>
      </div>
      <div className="flex items-end gap-px h-10 bg-muted/30 rounded px-1">
        {tenant.timeline.map((day, di) => {
          const h = maxRev > 0 ? Math.max((day.revenue / maxRev) * 100, day.revenue > 0 ? 6 : 0) : 0
          return (
            <div
              key={di}
              title={`${day.date}: ${formatCOP(day.revenue)} (${day.orderCount})`}
              className="flex-1 rounded-sm cursor-default hover:opacity-75 transition-opacity"
              style={{
                height: `${h}%`,
                minHeight: day.revenue > 0 ? 3 : 0,
                backgroundColor: day.revenue > 0 ? color : 'transparent',
                opacity: 0.85,
              }}
            />
          )
        })}
      </div>
      <div className="flex justify-between px-1 mt-0.5">
        {[0, mid, tenant.timeline.length - 1].map(i => (
          <span key={i} className="text-[10px] text-muted-foreground/60">
            {tenant.timeline[i]?.date
              ? new Date(tenant.timeline[i].date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
              : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export function AnalyticsTab() {
  const {
    period, setPeriod,
    timelineData, isLoadingTimeline,
    platformData, isLoadingPlatform,
    heatmapData, isLoadingHeatmap,
    isLoading, fetchAll,
  } = useAnalytics()

  const maxRev = timelineData ? getMaxRevenue(timelineData.tenants) : 1

  return (
    <div className="space-y-6">

      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">Período:</span>
        {PERIODS.map(d => (
          <button
            key={d}
            onClick={() => setPeriod(d)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              period === d
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {d}d
          </button>
        ))}
        <Button
          variant="outline" size="sm"
          onClick={() => fetchAll(period)}
          disabled={isLoading}
          className="ml-auto gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* ── KPI cards ────────────────────────────────────────────────────── */}
      {(platformData || isLoadingPlatform) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {isLoadingPlatform && !platformData ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="border-border bg-card">
                <CardContent className="p-4 h-[88px] flex items-center justify-center">
                  <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                </CardContent>
              </Card>
            ))
          ) : platformData ? (
            <>
              <KpiCard
                label="Ingresos (plataforma)"
                value={formatCOP(platformData.currentRevenue)}
                delta={deltaPct(platformData.currentRevenue, platformData.prevRevenue)}
                subtext={`prev: ${formatCOP(platformData.prevRevenue)}`}
                icon={TrendingUp}
                color="text-green-500"
              />
              <KpiCard
                label="Pedidos totales"
                value={String(platformData.currentOrders)}
                delta={deltaPct(platformData.currentOrders, platformData.prevOrders)}
                subtext={`prev: ${platformData.prevOrders}`}
                icon={ShoppingBag}
                color="text-blue-500"
              />
              <KpiCard
                label="Ticket promedio"
                value={formatCOP(platformData.avgTicket)}
                icon={Ticket}
                color="text-violet-500"
              />
              <KpiCard
                label="Comercios activos"
                value={String(platformData.activeTenants)}
                subtext={platformData.newTenants > 0 ? `+${platformData.newTenants} nuevos` : undefined}
                icon={Store}
                color="text-amber-500"
              />
              <KpiCard
                label="Mejor comercio"
                value={platformData.topTenantName ?? '—'}
                subtext={platformData.topTenantRevenue > 0 ? formatCOP(platformData.topTenantRevenue) : undefined}
                icon={BarChart2}
                color="text-indigo-500"
              />
              <KpiCard
                label="Período analizado"
                value={`${period} días`}
                icon={RefreshCw}
                color="text-muted-foreground"
              />
            </>
          ) : null}
        </div>
      )}

      {/* ── Sin datos ─────────────────────────────────────────────────────── */}
      {!isLoading && !timelineData?.tenants.length && (
        <Card className="border-border bg-card">
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <TrendingUp className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">Sin datos de ventas en este período</p>
            <p className="text-xs mt-1">Las ventas de los comercios aparecerán aquí</p>
          </CardContent>
        </Card>
      )}

      {/* ── Timeline chart ────────────────────────────────────────────────── */}
      {timelineData && timelineData.tenants.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-primary" />
              Ingresos por Comercio — últimos {period} días
            </CardTitle>
            <CardDescription>
              Hover sobre una barra para ver el valor. Combina ventas POS + pedidos online.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {isLoadingTimeline ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4 min-w-[500px]">
                {timelineData.tenants.map((tenant, idx) => (
                  <TenantChart
                    key={tenant.tenantId}
                    tenant={tenant}
                    color={TENANT_COLORS[idx % TENANT_COLORS.length]}
                    maxRev={maxRev}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Heatmap ───────────────────────────────────────────────────────── */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Heatmap de Actividad
          </CardTitle>
          <CardDescription>
            Cuándo piden más tus clientes — por día y hora. Útil para decisiones de staffing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingHeatmap || !heatmapData ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : heatmapData.maxCount === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8 italic">
              No hay datos suficientes para el heatmap en este período
            </p>
          ) : (
            <Heatmap data={heatmapData} />
          )}
        </CardContent>
      </Card>

      {/* ── Ranking ───────────────────────────────────────────────────────── */}
      {timelineData && timelineData.tenants.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Store className="h-5 w-5 text-amber-500" />
              Ranking de Comercios
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {timelineData.tenants.map((tenant, idx) => {
                const maxRev2 = timelineData.tenants[0]?.totalRevenue || 1
                const pct = Math.round((tenant.totalRevenue / maxRev2) * 100)
                const color = TENANT_COLORS[idx % TENANT_COLORS.length]
                return (
                  <div key={tenant.tenantId} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-muted-foreground w-5 text-right shrink-0">
                      #{idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-sm font-medium truncate">{tenant.tenantName}</span>
                        <span className="text-sm font-bold shrink-0 ml-2 tabular-nums" style={{ color }}>
                          {formatCOP(tenant.totalRevenue)}
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, backgroundColor: color }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground w-16 text-right shrink-0">
                      {tenant.totalOrders} ped.
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
