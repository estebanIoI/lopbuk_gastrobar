'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Trash2, Plus, AlertTriangle, TrendingDown, Package, BarChart3,
  Flame, Clock, ChefHat, GlassWater, RefreshCw, Calendar
} from 'lucide-react'
import { format, subDays } from 'date-fns'
import { es } from 'date-fns/locale'

// ── Types ─────────────────────────────────────────────────────────────────────
type WasteType = 'natural' | 'operativa' | 'administrativa' | 'vencimiento'
type WasteReason = 'quemado' | 'vencido' | 'mal_corte' | 'devolucion' | 'consumo_interno' | 'robo' | 'cortesia' | 'sobreporcion' | 'dano' | 'otro'
type Area = 'cocina' | 'bar' | 'general'

interface WasteRecord {
  id: string
  product_name: string
  quantity: number
  unit: string
  waste_type: WasteType
  reason: WasteReason
  cost_value: number
  area: Area
  responsible_name: string | null
  notes: string | null
  recorded_by_name: string
  created_at: string
}

interface DashboardData {
  summary: { totalCost: number; totalQty: number; wastePercent: number; purchasesTotal: number }
  byArea: { area: string; cost: number; records: number }[]
  byType: { waste_type: string; cost: number; records: number }[]
  byReason: { reason: string; cost: number; records: number }[]
  topProducts: { product_name: string; cost: number; qty: number; records: number }[]
  dailyTrend: { day: string; cost: number; records: number }[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const WASTE_TYPES: Record<WasteType, string> = {
  natural: 'Natural',
  operativa: 'Operativa',
  administrativa: 'Administrativa',
  vencimiento: 'Vencimiento',
}

const REASONS: Record<WasteReason, string> = {
  quemado: 'Quemado',
  vencido: 'Vencido',
  mal_corte: 'Mal corte',
  devolucion: 'Devolución',
  consumo_interno: 'Consumo interno',
  robo: 'Robo',
  cortesia: 'Cortesía',
  sobreporcion: 'Sobreporción',
  dano: 'Daño',
  otro: 'Otro',
}

const AREAS: Record<Area, string> = {
  cocina: 'Cocina',
  bar: 'Bar',
  general: 'General',
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
}

function wasteStatusColor(pct: number) {
  if (pct <= 5) return 'text-green-600 bg-green-50'
  if (pct <= 8) return 'text-amber-600 bg-amber-50'
  return 'text-red-600 bg-red-50'
}

function areaIcon(area: string) {
  if (area === 'cocina') return <ChefHat className="h-4 w-4" />
  if (area === 'bar') return <GlassWater className="h-4 w-4" />
  return <Package className="h-4 w-4" />
}

// ── Component ─────────────────────────────────────────────────────────────────
export function Merma() {
  const [tab, setTab] = useState<'dashboard' | 'registros' | 'par'>('dashboard')
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [records, setRecords] = useState<WasteRecord[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [parLevels, setParLevels] = useState<any[]>([])

  // Form state
  const [form, setForm] = useState({
    product_id: '',
    product_name: '',
    quantity: '',
    unit: 'unidad',
    waste_type: 'operativa' as WasteType,
    reason: 'otro' as WasteReason,
    area: 'cocina' as Area,
    cost_value: '',
    responsible_name: '',
    notes: '',
  })

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    const res = await api.getMermaDashboard(dateFrom, dateTo)
    if (res.success) setDashboard(res.data)
    setLoading(false)
  }, [dateFrom, dateTo])

  const loadRecords = useCallback(async () => {
    const res = await api.listWasteRecords({ dateFrom, dateTo })
    if (res.success) setRecords(res.data ?? [])
  }, [dateFrom, dateTo])

  const loadProducts = useCallback(async () => {
    const res = await api.getProducts({ limit: 200 })
    if (res.success) setProducts((res.data as any)?.products ?? res.data ?? [])
  }, [])

  const loadParLevels = useCallback(async () => {
    const res = await api.listParLevels()
    if (res.success) setParLevels(res.data ?? [])
  }, [])

  useEffect(() => {
    loadDashboard()
    loadProducts()
  }, [loadDashboard, loadProducts])

  useEffect(() => {
    if (tab === 'registros') loadRecords()
    if (tab === 'par') loadParLevels()
  }, [tab, loadRecords, loadParLevels])

  const handleProductSelect = (productId: string) => {
    const p = products.find(p => p.id === productId)
    if (p) {
      setForm(f => ({
        ...f,
        product_id: p.id,
        product_name: p.name,
        unit: p.weight_unit ?? 'unidad',
        area: p.preparation_area === 'bar' ? 'bar' : 'cocina',
      }))
    }
  }

  const handleSubmit = async () => {
    if (!form.product_name || !form.quantity) {
      toast.error('Completa los campos requeridos')
      return
    }
    const res = await api.createWasteRecord({
      ...form,
      product_id: form.product_id || undefined,
      quantity: Number(form.quantity),
      cost_value: form.cost_value ? Number(form.cost_value) : 0,
    })
    if (res.success) {
      toast.success('Merma registrada')
      setShowForm(false)
      setForm({ product_id: '', product_name: '', quantity: '', unit: 'unidad', waste_type: 'operativa', reason: 'otro', area: 'cocina', cost_value: '', responsible_name: '', notes: '' })
      loadDashboard()
      if (tab === 'registros') loadRecords()
    } else {
      toast.error(res.error ?? 'Error al registrar')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este registro?')) return
    const res = await api.deleteWasteRecord(id)
    if (res.success) { toast.success('Eliminado'); loadRecords(); loadDashboard() }
    else toast.error(res.error ?? 'Error')
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Control de Merma</h1>
          <p className="text-sm text-gray-500">Registra y analiza las pérdidas de tu gastrobar</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showForm} onOpenChange={setShowForm}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white gap-1">
                <Plus className="h-4 w-4" />
                Registrar Merma
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Registrar Merma</DialogTitle>
              </DialogHeader>
              <WasteForm
                form={form}
                setForm={setForm}
                products={products}
                onProductSelect={handleProductSelect}
                onSubmit={handleSubmit}
                onCancel={() => setShowForm(false)}
              />
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" onClick={loadDashboard} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Date range */}
      <div className="flex flex-wrap items-center gap-3 bg-gray-50 rounded-xl p-3">
        <Calendar className="h-4 w-4 text-gray-400" />
        <div className="flex items-center gap-2">
          <Label className="text-xs text-gray-500 whitespace-nowrap">Desde</Label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="h-8 text-sm w-36" />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-gray-500 whitespace-nowrap">Hasta</Label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="h-8 text-sm w-36" />
        </div>
        <Button size="sm" variant="outline" onClick={() => { loadDashboard(); if (tab === 'registros') loadRecords() }}>
          Filtrar
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(['dashboard', 'registros', 'par'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'dashboard' ? 'Dashboard' : t === 'registros' ? 'Registros' : 'Niveles PAR'}
          </button>
        ))}
      </div>

      {/* Dashboard tab */}
      {tab === 'dashboard' && dashboard && (
        <DashboardView dashboard={dashboard} />
      )}

      {/* Records tab */}
      {tab === 'registros' && (
        <RecordsView records={records} onDelete={handleDelete} />
      )}

      {/* PAR levels tab */}
      {tab === 'par' && (
        <ParLevelsView parLevels={parLevels} products={products} onRefresh={loadParLevels} />
      )}
    </div>
  )
}

// ── Dashboard View ────────────────────────────────────────────────────────────
function DashboardView({ dashboard }: { dashboard: DashboardData }) {
  const { summary, byArea, byType, topProducts, dailyTrend } = dashboard
  const statusCls = wasteStatusColor(summary.wastePercent)

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card variant="glass" className="glass">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 mb-1">Pérdida total</p>
            <p className="text-xl font-bold text-red-600">{fmt(summary.totalCost)}</p>
          </CardContent>
        </Card>
        <Card variant="glass" className="glass">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 mb-1">% de merma</p>
            <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-bold ${statusCls}`}>
              {summary.wastePercent}%
            </div>
            <p className="text-xs text-gray-400 mt-1">Meta: &lt;5%</p>
          </CardContent>
        </Card>
        <Card variant="glass" className="glass">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 mb-1">Registros</p>
            <p className="text-xl font-bold text-gray-900">{summary.totalQty.toFixed(1)}</p>
            <p className="text-xs text-gray-400">unidades perdidas</p>
          </CardContent>
        </Card>
        <Card variant="glass" className="glass">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 mb-1">vs Compras</p>
            <p className="text-sm font-semibold text-gray-700">{fmt(summary.purchasesTotal)}</p>
            <p className="text-xs text-gray-400">total comprado</p>
          </CardContent>
        </Card>
      </div>

      {/* Status indicator */}
      {summary.wastePercent > 5 && (
        <div className={`flex items-start gap-3 p-4 rounded-xl border ${summary.wastePercent > 8 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
          <AlertTriangle className={`h-5 w-5 mt-0.5 flex-shrink-0 ${summary.wastePercent > 8 ? 'text-red-500' : 'text-amber-500'}`} />
          <div>
            <p className="font-semibold text-sm">{summary.wastePercent > 8 ? 'Merma crítica' : 'Merma elevada'}</p>
            <p className="text-xs text-gray-600 mt-0.5">
              {summary.wastePercent > 8
                ? 'Tu merma supera el 8%. Revisa rotación, porciones y posibles fugas.'
                : 'Tu merma está entre 5-8%. Analiza los productos con más pérdida.'}
            </p>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* By area */}
        <Card variant="glass" className="glass">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-gray-700">Pérdidas por área</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {byArea.map(a => (
              <div key={a.area} className="flex items-center gap-2">
                <span className="text-gray-400">{areaIcon(a.area)}</span>
                <span className="text-sm capitalize flex-1">{AREAS[a.area as Area] ?? a.area}</span>
                <span className="text-xs text-gray-500">{a.records} reg.</span>
                <span className="text-sm font-semibold text-red-600">{fmt(a.cost)}</span>
              </div>
            ))}
            {byArea.length === 0 && <p className="text-xs text-gray-400">Sin datos</p>}
          </CardContent>
        </Card>

        {/* Top products */}
        <Card variant="glass" className="glass">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-gray-700">Top productos con más merma</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {topProducts.map((p, i) => (
              <div key={p.product_name} className="flex items-center gap-2">
                <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center ${
                  i === 0 ? 'bg-red-100 text-red-600' : i === 1 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'
                }`}>{i + 1}</span>
                <span className="text-sm flex-1 truncate">{p.product_name}</span>
                <span className="text-sm font-semibold text-red-600">{fmt(p.cost)}</span>
              </div>
            ))}
            {topProducts.length === 0 && <p className="text-xs text-gray-400">Sin datos</p>}
          </CardContent>
        </Card>

        {/* By type */}
        <Card variant="glass" className="glass">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-gray-700">Por tipo de merma</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {byType.map(t => (
              <div key={t.waste_type} className="flex items-center gap-2">
                <span className="text-sm flex-1">{WASTE_TYPES[t.waste_type as WasteType] ?? t.waste_type}</span>
                <Badge variant="outline" className="text-xs">{t.records}</Badge>
                <span className="text-sm font-semibold text-red-600">{fmt(t.cost)}</span>
              </div>
            ))}
            {byType.length === 0 && <p className="text-xs text-gray-400">Sin datos</p>}
          </CardContent>
        </Card>

        {/* Daily trend */}
        <Card variant="glass" className="glass">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-gray-700">Tendencia diaria</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {dailyTrend.length === 0 ? (
              <p className="text-xs text-gray-400">Sin datos</p>
            ) : (
              <div className="space-y-1.5">
                {dailyTrend.slice(-7).map(d => {
                  const maxCost = Math.max(...dailyTrend.map(x => x.cost), 1)
                  const pct = (d.cost / maxCost) * 100
                  return (
                    <div key={d.day} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-20 shrink-0">
                        {format(new Date(String(d.day).substring(0, 10) + 'T12:00:00'), 'EEE d/M', { locale: es })}
                      </span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div className="bg-red-400 h-2 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-medium text-gray-700 w-20 text-right">{fmt(d.cost)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ── Records View ──────────────────────────────────────────────────────────────
function RecordsView({ records, onDelete }: { records: WasteRecord[]; onDelete: (id: string) => void }) {
  return (
    <div className="space-y-2">
      {records.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <TrendingDown className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay registros de merma en este período</p>
        </div>
      )}
      {records.map(r => (
        <div key={r.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
          <div className={`p-2 rounded-lg ${r.area === 'cocina' ? 'bg-orange-50' : r.area === 'bar' ? 'bg-blue-50' : 'bg-gray-50'}`}>
            {areaIcon(r.area)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{r.product_name}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs text-gray-500">{r.quantity} {r.unit}</span>
              <span className="text-xs text-gray-300">•</span>
              <Badge variant="outline" className="text-xs py-0">{REASONS[r.reason]}</Badge>
              <Badge variant="outline" className="text-xs py-0">{WASTE_TYPES[r.waste_type]}</Badge>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-semibold text-red-600">{fmt(r.cost_value)}</p>
            <p className="text-xs text-gray-400">{r.created_at ? format(new Date(r.created_at), 'dd/MM HH:mm') : '—'}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-500" onClick={() => onDelete(r.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
  )
}

// ── PAR Levels View ───────────────────────────────────────────────────────────
function ParLevelsView({ parLevels, products, onRefresh }: { parLevels: any[]; products: any[]; onRefresh: () => void }) {
  const [showForm, setShowForm] = useState(false)
  const [parForm, setParForm] = useState({
    product_id: '',
    daily_usage: '',
    days_between_orders: '1',
    safety_stock: '',
    area: 'cocina' as Area,
    notes: '',
  })

  const handleSavePar = async () => {
    if (!parForm.product_id || !parForm.daily_usage) { toast.error('Completa los campos requeridos'); return }
    const res = await api.upsertParLevel({
      ...parForm,
      daily_usage: Number(parForm.daily_usage),
      days_between_orders: Number(parForm.days_between_orders),
      safety_stock: Number(parForm.safety_stock || 0),
    })
    if (res.success) {
      toast.success('Nivel PAR guardado')
      setShowForm(false)
      setParForm({ product_id: '', daily_usage: '', days_between_orders: '1', safety_stock: '', area: 'cocina', notes: '' })
      onRefresh()
    } else {
      toast.error(res.error ?? 'Error')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Define cuánto debes tener de cada producto. <span className="font-medium">PAR = (Uso diario × Días entre compras) + Stock de seguridad</span>
        </p>
        <Button size="sm" onClick={() => setShowForm(true)} className="gap-1">
          <Plus className="h-4 w-4" /> Agregar PAR
        </Button>
      </div>

      {showForm && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Producto *</Label>
                <Select value={parForm.product_id} onValueChange={v => setParForm(f => ({ ...f, product_id: v }))}>
                  <SelectTrigger className="h-9 mt-1">
                    <SelectValue placeholder="Selecciona producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Uso diario promedio *</Label>
                <Input className="h-9 mt-1" type="number" min="0" step="0.1" placeholder="ej: 20"
                  value={parForm.daily_usage} onChange={e => setParForm(f => ({ ...f, daily_usage: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Días entre compras *</Label>
                <Input className="h-9 mt-1" type="number" min="1" placeholder="ej: 1"
                  value={parForm.days_between_orders} onChange={e => setParForm(f => ({ ...f, days_between_orders: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Stock de seguridad</Label>
                <Input className="h-9 mt-1" type="number" min="0" step="0.1" placeholder="ej: 5"
                  value={parForm.safety_stock} onChange={e => setParForm(f => ({ ...f, safety_stock: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Área</Label>
                <Select value={parForm.area} onValueChange={v => setParForm(f => ({ ...f, area: v as Area }))}>
                  <SelectTrigger className="h-9 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cocina">Cocina</SelectItem>
                    <SelectItem value="bar">Bar</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {parForm.daily_usage && parForm.days_between_orders && (
              <div className="bg-white rounded-lg p-3 text-sm">
                <span className="text-gray-500">PAR calculado: </span>
                <span className="font-bold text-amber-700">
                  {(Number(parForm.daily_usage) * Number(parForm.days_between_orders) + Number(parForm.safety_stock || 0)).toFixed(1)} unidades
                </span>
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSavePar}>Guardar</Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {parLevels.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Sin niveles PAR configurados</p>
          <p className="text-xs mt-1">Configura niveles PAR para recibir sugerencias de compra automáticas</p>
        </div>
      ) : (
        <div className="space-y-2">
          {parLevels.map((pl: any) => {
            const parLevel = Number(pl.par_level)
            const stock = Number(pl.current_stock ?? 0)
            const gap = stock - parLevel
            const needsRestock = gap < 0

            return (
              <div key={pl.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                needsRestock ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'
              }`}>
                <div className={`p-2 rounded-lg ${needsRestock ? 'bg-red-100' : 'bg-green-50'}`}>
                  {areaIcon(pl.area)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{pl.product_name}</p>
                  <p className="text-xs text-gray-500">
                    Uso: {pl.daily_usage}/día × {pl.days_between_orders}d + {pl.safety_stock} seg = <span className="font-medium">{parLevel.toFixed(1)} PAR</span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold ${needsRestock ? 'text-red-600' : 'text-green-600'}`}>
                    {stock.toFixed(1)} / {parLevel.toFixed(1)}
                  </p>
                  {needsRestock && (
                    <p className="text-xs text-red-500">Comprar: {Math.abs(gap).toFixed(1)}</p>
                  )}
                </div>
                {needsRestock && <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Waste Form ────────────────────────────────────────────────────────────────
function WasteForm({ form, setForm, products, onProductSelect, onSubmit, onCancel }: {
  form: any; setForm: any; products: any[]; onProductSelect: (id: string) => void;
  onSubmit: () => void; onCancel: () => void
}) {
  return (
    <div className="space-y-3 pt-2">
      <div>
        <Label className="text-xs">Producto</Label>
        <Select value={form.product_id} onValueChange={v => { onProductSelect(v) }}>
          <SelectTrigger className="h-9 mt-1">
            <SelectValue placeholder="Seleccionar del inventario (opcional)" />
          </SelectTrigger>
          <SelectContent>
            {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs">Nombre del producto *</Label>
        <Input className="h-9 mt-1" placeholder="ej: Pechuga de pollo"
          value={form.product_name} onChange={e => setForm((f: any) => ({ ...f, product_name: e.target.value }))} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Cantidad *</Label>
          <Input className="h-9 mt-1" type="number" min="0.001" step="0.1" placeholder="ej: 1.5"
            value={form.quantity} onChange={e => setForm((f: any) => ({ ...f, quantity: e.target.value }))} />
        </div>
        <div>
          <Label className="text-xs">Unidad</Label>
          <Select value={form.unit} onValueChange={v => setForm((f: any) => ({ ...f, unit: v }))}>
            <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['unidad', 'kg', 'g', 'L', 'mL', 'botella', 'paquete', 'porción'].map(u =>
                <SelectItem key={u} value={u}>{u}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Tipo de merma *</Label>
          <Select value={form.waste_type} onValueChange={v => setForm((f: any) => ({ ...f, waste_type: v }))}>
            <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(WASTE_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Motivo *</Label>
          <Select value={form.reason} onValueChange={v => setForm((f: any) => ({ ...f, reason: v }))}>
            <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(REASONS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Área *</Label>
          <Select value={form.area} onValueChange={v => setForm((f: any) => ({ ...f, area: v }))}>
            <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cocina">Cocina</SelectItem>
              <SelectItem value="bar">Bar</SelectItem>
              <SelectItem value="general">General</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Costo estimado ($)</Label>
          <Input className="h-9 mt-1" type="number" min="0" placeholder="Auto si hay producto"
            value={form.cost_value} onChange={e => setForm((f: any) => ({ ...f, cost_value: e.target.value }))} />
        </div>
      </div>

      <div>
        <Label className="text-xs">Responsable (opcional)</Label>
        <Input className="h-9 mt-1" placeholder="Nombre del empleado"
          value={form.responsible_name} onChange={e => setForm((f: any) => ({ ...f, responsible_name: e.target.value }))} />
      </div>

      <div>
        <Label className="text-xs">Notas (opcional)</Label>
        <Input className="h-9 mt-1" placeholder="Descripción adicional"
          value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} />
      </div>

      <div className="flex gap-2 pt-2">
        <Button onClick={onSubmit} className="flex-1 bg-red-600 hover:bg-red-700 text-white">
          Registrar Merma
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  )
}
