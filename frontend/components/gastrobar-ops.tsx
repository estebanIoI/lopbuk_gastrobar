'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  TrendingUp, TrendingDown, ShoppingCart, AlertTriangle, CheckCircle,
  ChefHat, GlassWater, Package, RefreshCw, Calendar, Flame, Info,
  BarChart3, ShoppingBag, Star
} from 'lucide-react'
import { format, subDays } from 'date-fns'
import { es } from 'date-fns/locale'

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
}

function fmtPct(n: number) {
  return `${Math.round(n * 10) / 10}%`
}

type SemaforoColor = 'verde' | 'amarillo' | 'rojo'

function SemaforoLight({ color, label }: { color: SemaforoColor; label: string }) {
  const cls = color === 'verde'
    ? 'bg-green-500 shadow-green-200'
    : color === 'amarillo'
    ? 'bg-amber-400 shadow-amber-200'
    : 'bg-red-500 shadow-red-200'

  const textCls = color === 'verde' ? 'text-green-700' : color === 'amarillo' ? 'text-amber-700' : 'text-red-700'
  const bgCls  = color === 'verde' ? 'bg-green-50'   : color === 'amarillo' ? 'bg-amber-50'   : 'bg-red-50'

  return (
    <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl ${bgCls}`}>
      <div className={`h-3 w-3 rounded-full shadow-lg ${cls}`} />
      <span className={`text-sm font-medium ${textCls}`}>{label}</span>
    </div>
  )
}

function KpiCard({ label, value, sub, icon: _icon, accent }: {
  label: string; value: string; sub?: string; icon: React.ElementType; accent: string
}) {
  const Icon = _icon as React.ComponentType<{ className?: string }>
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className="text-xl font-bold text-gray-900">{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
          </div>
          <div className={`p-2 rounded-xl ${accent}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Food Cost Badge ───────────────────────────────────────────────────────────
function FoodCostBadge({ pct, range }: { pct: number; range: string }) {
  const [min, max] = range.replace(/%/g, '').split('-').map(Number)
  const ok = pct >= min && pct <= max
  const warn = pct > max && pct <= max + 10
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
      ok   ? 'bg-green-100 text-green-700' :
      warn ? 'bg-amber-100 text-amber-700' :
             'bg-red-100 text-red-700'
    }`}>
      {fmtPct(pct)}
    </span>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export function GastrobarOps() {
  const [tab, setTab] = useState<'dueno' | 'foodcost' | 'compras' | 'tendencia'>('dueno')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [modoDueno, setModoDueno] = useState<any>(null)
  const [foodCost, setFoodCost] = useState<any[]>([])
  const [suggestions, setSuggestions] = useState<any>(null)
  const [trend, setTrend] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [fcSearch, setFcSearch] = useState('')

  const loadModoDueno = useCallback(async () => {
    setLoading(true)
    const res = await api.getModoDueno(date)
    if (res.success) setModoDueno(res.data)
    else toast.error('Error al cargar dashboard')
    setLoading(false)
  }, [date])

  const loadFoodCost = useCallback(async () => {
    const res = await api.getFoodCost()
    if (res.success) setFoodCost(res.data ?? [])
  }, [])

  const loadSuggestions = useCallback(async () => {
    const res = await api.getPurchaseSuggestions()
    if (res.success) setSuggestions(res.data)
  }, [])

  const loadTrend = useCallback(async () => {
    const res = await api.getWeeklyTrend()
    if (res.success) setTrend(res.data ?? [])
  }, [])

  useEffect(() => { loadModoDueno() }, [loadModoDueno])

  useEffect(() => {
    if (tab === 'foodcost') loadFoodCost()
    if (tab === 'compras') loadSuggestions()
    if (tab === 'tendencia') loadTrend()
  }, [tab, loadFoodCost, loadSuggestions, loadTrend])

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Centro de Mando</h1>
          <p className="text-sm text-gray-500">Visión operacional completa de tu gastrobar</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => {
          if (tab === 'dueno') loadModoDueno()
          else if (tab === 'foodcost') loadFoodCost()
          else if (tab === 'compras') loadSuggestions()
          else loadTrend()
        }} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {([
          ['dueno',     'Modo Dueño'],
          ['foodcost',  'Food Cost'],
          ['compras',   'Compras'],
          ['tendencia', 'Tendencia'],
        ] as [string, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id as any)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Date picker (Modo Dueño only) */}
      {tab === 'dueno' && (
        <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 w-fit">
          <Calendar className="h-4 w-4 text-gray-400" />
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-8 text-sm w-40" />
          <Button size="sm" variant="outline" onClick={loadModoDueno}>Ver</Button>
        </div>
      )}

      {/* Modo Dueño */}
      {tab === 'dueno' && modoDueno && <ModoDuenoView data={modoDueno} />}

      {/* Food Cost */}
      {tab === 'foodcost' && (
        <FoodCostView items={foodCost} search={fcSearch} setSearch={setFcSearch} />
      )}

      {/* Purchase Suggestions */}
      {tab === 'compras' && suggestions && (
        <PurchaseSuggestionsView data={suggestions} />
      )}

      {/* Weekly Trend */}
      {tab === 'tendencia' && (
        <TrendView data={trend} />
      )}
    </div>
  )
}

// ── Modo Dueño View ───────────────────────────────────────────────────────────
function ModoDuenoView({ data }: { data: any }) {
  const { kpis, semaforo, alerts, topItems } = data

  return (
    <div className="space-y-4">
      {/* Semáforo operacional */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-gray-700">Estado operacional</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <SemaforoLight color={semaforo.cocina} label="Cocina" />
            <SemaforoLight color={semaforo.bar} label="Bar" />
            <SemaforoLight color={semaforo.inventario} label="Inventario" />
            <SemaforoLight color={semaforo.merma} label="Merma" />
          </div>
        </CardContent>
      </Card>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Ventas del día"
          value={fmt(kpis.totalSales)}
          sub={`${kpis.totalOrders} pedidos`}
          icon={ShoppingCart}
          accent="bg-blue-50 text-blue-500"
        />
        <KpiCard
          label="Ganancia bruta"
          value={fmt(kpis.grossProfit)}
          sub={kpis.totalSales > 0 ? `Margen: ${fmtPct((kpis.grossProfit / kpis.totalSales) * 100)}` : undefined}
          icon={TrendingUp}
          accent="bg-green-50 text-green-500"
        />
        <KpiCard
          label="Food cost"
          value={fmtPct(kpis.foodCostPercent)}
          sub="Meta: 25-35% cocina"
          icon={Flame}
          accent={kpis.foodCostPercent > 35 ? 'bg-red-50 text-red-500' : 'bg-orange-50 text-orange-500'}
        />
        <KpiCard
          label="Ganancia real"
          value={fmt(kpis.realProfit)}
          sub={`Merma: ${fmt(kpis.wasteCost)}`}
          icon={kpis.realProfit >= 0 ? TrendingUp : TrendingDown}
          accent={kpis.realProfit >= 0 ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Top platos */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-400" />
              Más vendidos hoy
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {(topItems ?? []).length === 0 ? (
              <p className="text-xs text-gray-400">Sin ventas registradas hoy</p>
            ) : topItems.map((item: any, i: number) => (
              <div key={item.product_name} className="flex items-center gap-2">
                <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center ${
                  i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                }`}>{i + 1}</span>
                <span className="text-sm flex-1 truncate">{item.product_name}</span>
                <Badge variant="outline" className="text-xs">{item.qty} uds</Badge>
                <span className="text-sm font-semibold text-gray-700">{fmt(item.revenue)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Alertas */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              Alertas críticas
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {(alerts.lowStock ?? []).length === 0 && (alerts.parAlerts ?? []).length === 0 ? (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">Todo en orden</span>
              </div>
            ) : (
              <>
                {(alerts.parAlerts ?? []).map((a: any) => (
                  <div key={a.name} className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-xs flex-1 truncate">{a.name}</span>
                    <span className="text-xs font-medium">Stock: {Number(a.stock ?? 0).toFixed(1)} / PAR: {Number(a.par_level ?? 0).toFixed(1)}</span>
                  </div>
                ))}
                {(alerts.lowStock ?? []).map((p: any) => (
                  <div key={p.name} className="flex items-center gap-2 text-amber-600">
                    <Package className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-xs flex-1 truncate">{p.name}</span>
                    <span className="text-xs font-medium">{p.stock ?? 0} / {p.reorder_point ?? 0}</span>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cost breakdown */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-500">Costo ingredientes</p>
              <p className="text-lg font-bold text-gray-700">{fmt(kpis.totalCost)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Pérdida por merma</p>
              <p className="text-lg font-bold text-red-500">{fmt(kpis.wasteCost)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Ganancia neta estimada</p>
              <p className={`text-lg font-bold ${kpis.realProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {fmt(kpis.realProfit)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Food Cost View ────────────────────────────────────────────────────────────
function FoodCostView({ items, search, setSearch }: { items: any[]; search: string; setSearch: (s: string) => void }) {
  const filtered = items.filter(i =>
    !search || i.name.toLowerCase().includes(search.toLowerCase())
  )

  const danger  = items.filter(i => i.status === 'danger').length
  const warning = items.filter(i => i.status === 'warning').length
  const ok      = items.filter(i => i.status === 'ok' && i.ingredientCount > 0).length

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-green-50 text-center">
          <p className="text-xl font-bold text-green-700">{ok}</p>
          <p className="text-xs text-green-600">Rentables</p>
        </div>
        <div className="p-3 rounded-xl bg-amber-50 text-center">
          <p className="text-xl font-bold text-amber-700">{warning}</p>
          <p className="text-xs text-amber-600">Revisar</p>
        </div>
        <div className="p-3 rounded-xl bg-red-50 text-center">
          <p className="text-xl font-bold text-red-700">{danger}</p>
          <p className="text-xs text-red-600">Costosos</p>
        </div>
      </div>

      <Input placeholder="Buscar plato..." value={search} onChange={e => setSearch(e.target.value)}
        className="h-9 max-w-xs" />

      {items.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Sin platos de menú con receta configurada</p>
          <p className="text-xs mt-1">Ve a Recetas BOM y agrega los ingredientes de cada plato para ver el food cost real</p>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(item => (
          <div key={item.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
            item.status === 'danger'  ? 'bg-red-50 border-red-200' :
            item.status === 'warning' ? 'bg-amber-50 border-amber-200' :
                                        'bg-white border-gray-100'
          }`}>
            <div className={`p-2 rounded-lg ${item.area === 'bar' ? 'bg-blue-50' : 'bg-orange-50'}`}>
              {item.area === 'bar' ? <GlassWater className="h-4 w-4 text-blue-500" /> : <ChefHat className="h-4 w-4 text-orange-500" />}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                {item.ingredientCount === 0 && (
                  <Badge variant="outline" className="text-xs text-gray-400">Sin receta</Badge>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Costo: {fmt(item.recipeCost)} · Venta: {fmt(item.salePrice)} · Margen: {fmt(item.grossMargin)}
              </p>
            </div>

            <div className="text-right shrink-0">
              <FoodCostBadge pct={item.foodCostPct} range={item.idealRange} />
              <p className="text-xs text-gray-400 mt-1">Meta: {item.idealRange}</p>
            </div>

            {item.status === 'danger' && <Flame className="h-4 w-4 text-red-400 shrink-0" />}
            {item.status === 'warning' && <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />}
            {item.status === 'ok' && item.ingredientCount > 0 && <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />}
          </div>
        ))}
      </div>

      <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500 space-y-1">
        <p className="font-medium text-gray-700">¿Cómo leer el Food Cost?</p>
        <p><span className="text-green-600 font-medium">Verde (25-35% cocina / 18-28% bar):</span> Rango sano — el plato deja buena utilidad.</p>
        <p><span className="text-amber-600 font-medium">Amarillo (&gt;35%):</span> Revisar precio de venta o reducir porciones.</p>
        <p><span className="text-red-600 font-medium">Rojo (&gt;45%):</span> Estás vendiendo con pérdida — actúa de inmediato.</p>
      </div>
    </div>
  )
}

// ── Purchase Suggestions View ─────────────────────────────────────────────────
function PurchaseSuggestionsView({ data }: { data: any }) {
  const { parBased, stockBased, summary } = data
  const allItems = [...(parBased ?? []), ...(stockBased ?? [])]

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
          <p className="text-2xl font-bold text-blue-700">{summary.totalItems}</p>
          <p className="text-sm text-blue-600">productos a comprar</p>
        </div>
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
          <p className="text-2xl font-bold text-blue-700">{fmt(summary.totalEstimatedCost)}</p>
          <p className="text-sm text-blue-600">costo estimado</p>
        </div>
      </div>

      {allItems.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-30 text-green-400" />
          <p className="text-sm">¡Todo está en orden!</p>
          <p className="text-xs mt-1">No hay productos que necesiten reposición en este momento</p>
        </div>
      ) : (
        <>
          {parBased?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Basado en niveles PAR</p>
              {parBased.map((item: any) => (
                <SuggestionRow key={item.id} item={item} />
              ))}
            </div>
          )}

          {stockBased?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Stock bajo reorder point</p>
              {stockBased.map((item: any) => (
                <SuggestionRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </>
      )}

      <div className="bg-amber-50 rounded-xl p-4 text-xs text-amber-700 flex items-start gap-2">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium mb-1">Tip: compras basadas en datos</p>
          <p>Configura niveles PAR en Merma → Niveles PAR para recibir sugerencias más precisas basadas en tu uso diario real.</p>
        </div>
      </div>
    </div>
  )
}

function SuggestionRow({ item }: { item: any }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-orange-200">
      <div className={`p-2 rounded-lg ${item.area === 'bar' ? 'bg-blue-50' : 'bg-orange-50'}`}>
        {item.area === 'bar' ? <GlassWater className="h-4 w-4 text-blue-500" /> : <ChefHat className="h-4 w-4 text-orange-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
        <p className="text-xs text-gray-500">
          Stock actual: {Number(item.stock).toFixed(1)} · {item.supplier_name ? `Proveedor: ${item.supplier_name}` : 'Sin proveedor'}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-orange-600">+{Number(item.to_order).toFixed(1)} uds</p>
        <p className="text-xs text-gray-500">{fmt(item.estimated_cost)}</p>
      </div>
      <ShoppingBag className="h-4 w-4 text-orange-400 shrink-0" />
    </div>
  )
}

// ── Trend View ────────────────────────────────────────────────────────────────
function TrendView({ data }: { data: any[] }) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Sin datos de tendencia</p>
      </div>
    )
  }

  const maxRevenue = Math.max(...data.map(d => d.revenue), 1)

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-gray-700">Ventas vs Merma — últimos 14 días</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          {data.map(d => (
            <div key={d.day} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 w-20 shrink-0">
                  {format(new Date(String(d.day).substring(0, 10) + 'T12:00:00'), 'EEE d/M', { locale: es })}
                </span>
                <span className="text-xs text-gray-700 font-medium">{fmt(d.revenue)}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                  <div className="bg-blue-400 h-2.5 rounded-full" style={{ width: `${(d.revenue / maxRevenue) * 100}%` }} />
                </div>
                {d.wasteCost > 0 && (
                  <div className="w-24 bg-gray-100 rounded-full h-2.5">
                    <div className="bg-red-400 h-2.5 rounded-full" style={{ width: `${d.revenue > 0 ? Math.min(100, (d.wasteCost / d.revenue) * 100 * 10) : 0}%` }} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-center gap-6 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-blue-400" /> Ventas
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" /> Merma (escalada)
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-gray-50 text-center">
          <p className="text-lg font-bold text-gray-900">{fmt(data.reduce((s, d) => s + d.revenue, 0))}</p>
          <p className="text-xs text-gray-500">Total ventas</p>
        </div>
        <div className="p-3 rounded-xl bg-gray-50 text-center">
          <p className="text-lg font-bold text-gray-900">{Math.round(data.reduce((s, d) => s + d.orders, 0) / data.length)}</p>
          <p className="text-xs text-gray-500">Pedidos/día prom.</p>
        </div>
        <div className="p-3 rounded-xl bg-red-50 text-center">
          <p className="text-lg font-bold text-red-600">{fmt(data.reduce((s, d) => s + d.wasteCost, 0))}</p>
          <p className="text-xs text-red-500">Total merma</p>
        </div>
      </div>
    </div>
  )
}
