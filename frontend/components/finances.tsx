'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Wallet, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft,
  Plus, Trash2, RefreshCw, BarChart3, Tag, PiggyBank, Filter,
  Edit2, Check, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

// ─── helpers ─────────────────────────────────────────────────────────────────
const formatCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

type Tab = 'resumen' | 'transacciones' | 'categorias' | 'presupuesto'

// ─── Main component ───────────────────────────────────────────────────────────
export function Finances() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState<Tab>('resumen')
  const [initialized, setInitialized] = useState(false)

  // Seed categories on first load
  useEffect(() => {
    if (!initialized) {
      api.seedFinanceCategories().then(() => setInitialized(true))
    }
  }, [initialized])

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'resumen',       label: 'Resumen',       icon: BarChart3 },
    { id: 'transacciones', label: 'Transacciones', icon: Wallet },
    { id: 'categorias',    label: 'Categorías',    icon: Tag },
    { id: 'presupuesto',   label: 'Presupuesto',   icon: PiggyBank },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Finanzas</h1>
            <p className="text-xs text-muted-foreground">Control de ingresos y egresos del negocio</p>
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto scrollbar-thin">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all',
                tab === t.id ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}>
              <t.icon className="h-3.5 w-3.5" />{t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {tab === 'resumen'       && <ResumenTab />}
        {tab === 'transacciones' && <TransaccionesTab />}
        {tab === 'categorias'    && <CategoriasTab />}
        {tab === 'presupuesto'   && <PresupuestoTab />}
      </div>
    </div>
  )
}

// ─── RESUMEN TAB ──────────────────────────────────────────────────────────────
function ResumenTab() {
  const now = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [summary, setSummary] = useState<any>(null)
  const [cashflow, setCashflow] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [sR, cR] = await Promise.all([
      api.getFinanceSummary(year, month),
      api.getFinanceCashflow(`${year - 1}-${String(month).padStart(2,'0')}-01`, `${year}-12-31`),
    ])
    if (sR.success) setSummary(sR.data)
    if (cR.success) setCashflow(cR.data ?? [])
    setLoading(false)
  }, [year, month])

  useEffect(() => { load() }, [load])

  const chartData = cashflow.map(c => ({
    mes: c.period.slice(0, 7),
    Ingresos: c.income,
    Egresos: c.expense,
    Balance: c.balance,
  }))

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Period selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <select className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          value={month} onChange={e => setMonth(Number(e.target.value))}>
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          value={year} onChange={e => setYear(Number(e.target.value))}>
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <Button size="sm" variant="ghost" onClick={load}><RefreshCw className="h-3.5 w-3.5" /></Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : !summary ? null : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-5">
              <div className="flex items-center gap-2 mb-1">
                <ArrowUpRight className="h-4 w-4 text-green-400" />
                <span className="text-xs text-muted-foreground">Ingresos del mes</span>
              </div>
              <p className="text-2xl font-bold text-green-400">{formatCOP(summary.totalIncome)}</p>
            </div>
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
              <div className="flex items-center gap-2 mb-1">
                <ArrowDownLeft className="h-4 w-4 text-red-400" />
                <span className="text-xs text-muted-foreground">Egresos del mes</span>
              </div>
              <p className="text-2xl font-bold text-red-400">{formatCOP(summary.totalExpense)}</p>
            </div>
            <div className={cn('rounded-xl border p-5', summary.balance >= 0
              ? 'border-primary/20 bg-primary/5' : 'border-amber-500/20 bg-amber-500/5')}>
              <div className="flex items-center gap-2 mb-1">
                {summary.balance >= 0 ? <TrendingUp className="h-4 w-4 text-primary" /> : <TrendingDown className="h-4 w-4 text-amber-400" />}
                <span className="text-xs text-muted-foreground">Utilidad del mes</span>
              </div>
              <p className={cn('text-2xl font-bold', summary.balance >= 0 ? 'text-primary' : 'text-amber-400')}>
                {formatCOP(summary.balance)}
              </p>
            </div>
          </div>

          {/* Category breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(['ingreso', 'egreso'] as const).map(type => {
              const cats = summary.byCategory.filter((c: any) => c.type === type && c.total > 0)
              return (
                <div key={type} className="rounded-xl border border-border bg-card p-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    {type === 'ingreso'
                      ? <ArrowUpRight className="h-4 w-4 text-green-400" />
                      : <ArrowDownLeft className="h-4 w-4 text-red-400" />}
                    {type === 'ingreso' ? 'Desglose de Ingresos' : 'Desglose de Egresos'}
                  </h3>
                  {cats.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">Sin registros este mes</p>
                  ) : (
                    <div className="space-y-2">
                      {cats.sort((a: any, b: any) => b.total - a.total).map((c: any) => {
                        const total = type === 'ingreso' ? summary.totalIncome : summary.totalExpense
                        const pct = total > 0 ? Math.round((c.total / total) * 100) : 0
                        return (
                          <div key={c.category}>
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-muted-foreground flex items-center gap-1">
                                {c.icon && <span>{c.icon}</span>}
                                {c.category}
                              </span>
                              <span className="font-semibold">{formatCOP(c.total)}</span>
                            </div>
                            <div className="mt-1 h-1.5 rounded-full bg-border overflow-hidden">
                              <div className={cn('h-full rounded-full transition-all', type === 'ingreso' ? 'bg-green-500' : 'bg-red-500')}
                                style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Cashflow chart */}
          {chartData.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold mb-4">Flujo de caja histórico</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={v => `$${(v/1000000).toFixed(1)}M`} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: any) => formatCOP(v)} />
                  <Legend />
                  <Bar dataKey="Ingresos" fill="#22c55e" radius={[3,3,0,0]} />
                  <Bar dataKey="Egresos"  fill="#ef4444" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── TRANSACCIONES TAB ────────────────────────────────────────────────────────
function TransaccionesTab() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [pagination, setPagination] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filters, setFilters] = useState({ type: '', categoryId: '', from: '', to: '' })
  const [form, setForm] = useState({
    type: 'egreso', categoryId: '', description: '', amount: '',
    transactionDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'efectivo', receiptNumber: '', notes: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    const [tR, cR] = await Promise.all([
      api.getFinanceTransactions({ ...filters, limit: 50 }),
      api.getFinanceCategories(),
    ])
    if (tR.success) { setTransactions(tR.data ?? []); setPagination((tR as any).pagination) }
    if (cR.success) setCategories(cR.data ?? [])
    setLoading(false)
  }, [filters])

  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!form.categoryId || !form.description || !form.amount) { toast.error('Completa todos los campos requeridos'); return }
    const r = await api.createFinanceTransaction({
      ...form, amount: Number(form.amount),
      paymentMethod: form.paymentMethod,
      receiptNumber: form.receiptNumber || undefined,
      notes: form.notes || undefined,
    })
    if (r.success) {
      toast.success('Transacción registrada')
      setShowForm(false)
      setForm({ type: 'egreso', categoryId: '', description: '', amount: '', transactionDate: new Date().toISOString().split('T')[0], paymentMethod: 'efectivo', receiptNumber: '', notes: '' })
      load()
    } else toast.error(r.error)
  }

  const del = async (id: string) => {
    if (!confirm('¿Eliminar esta transacción?')) return
    const r = await api.deleteFinanceTransaction(id)
    if (r.success) { toast.success('Eliminada'); load() }
    else toast.error(r.error)
  }

  const filteredCats = categories.filter(c => !form.type || c.type === form.type)

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <select className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}>
          <option value="">Todos</option>
          <option value="ingreso">Ingresos</option>
          <option value="egreso">Egresos</option>
        </select>
        <input type="date" className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} />
        <span className="text-xs text-muted-foreground">—</span>
        <input type="date" className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} />
        <Button size="sm" variant="ghost" onClick={load}><RefreshCw className="h-3.5 w-3.5" /></Button>
        <div className="ml-auto">
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-3.5 w-3.5 mr-1" />Registrar
          </Button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h3 className="text-sm font-bold">Registrar transacción</h3>
          <div className="grid grid-cols-2 gap-4">
            {/* Type */}
            <div className="col-span-2">
              <div className="flex gap-2">
                {['egreso', 'ingreso'].map(t => (
                  <button key={t} onClick={() => setForm(f => ({ ...f, type: t, categoryId: '' }))}
                    className={cn('flex-1 rounded-lg border py-2 text-sm font-medium transition-all',
                      form.type === t
                        ? t === 'egreso' ? 'border-red-500/40 bg-red-500/10 text-red-400' : 'border-green-500/40 bg-green-500/10 text-green-400'
                        : 'border-border text-muted-foreground hover:bg-accent'
                    )}>
                    {t === 'egreso' ? '↓ Egreso' : '↑ Ingreso'}
                  </button>
                ))}
              </div>
            </div>
            {/* Category */}
            <div>
              <label className="text-xs text-muted-foreground">Categoría *</label>
              <select className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}>
                <option value="">Selecciona...</option>
                {filteredCats.map(c => <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ''}{c.name}</option>)}
              </select>
            </div>
            {/* Amount */}
            <div>
              <label className="text-xs text-muted-foreground">Monto *</label>
              <input type="number" placeholder="0"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            {/* Description */}
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Descripción *</label>
              <input placeholder="Ej: Pago arriendo enero 2026"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            {/* Date & method */}
            <div>
              <label className="text-xs text-muted-foreground">Fecha</label>
              <input type="date" className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                value={form.transactionDate} onChange={e => setForm(f => ({ ...f, transactionDate: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Método de pago</label>
              <select className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                {['efectivo','tarjeta','transferencia','nequi','daviplata','cheque','otro'].map(m => (
                  <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                ))}
              </select>
            </div>
            {/* Receipt & notes */}
            <div>
              <label className="text-xs text-muted-foreground">N° Recibo / Factura</label>
              <input className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                value={form.receiptNumber} onChange={e => setForm(f => ({ ...f, receiptNumber: e.target.value }))} placeholder="Opcional" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Notas</label>
              <input className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Opcional" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button size="sm" onClick={save}>Registrar</Button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-10"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : transactions.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
          <Wallet className="h-8 w-8 opacity-30" />
          <p className="text-sm">Sin transacciones. Registra la primera.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-accent/30">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Fecha</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Descripción</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Categoría</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">Monto</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Método</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {transactions.map(t => (
                <tr key={t.id} className="border-b border-border/50 hover:bg-accent/20 transition-colors">
                  <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(t.transactionDate).toLocaleDateString('es-CO')}
                  </td>
                  <td className="px-4 py-2.5">
                    <p className="font-medium truncate max-w-[200px]">{t.description}</p>
                    {t.receiptNumber && <p className="text-[10px] text-muted-foreground">Rec: {t.receiptNumber}</p>}
                    {t.sourceType !== 'manual' && (
                      <span className="text-[10px] text-blue-400 bg-blue-500/10 rounded px-1">{t.sourceType}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{t.categoryName}</td>
                  <td className={cn('px-4 py-2.5 text-right font-semibold', t.type === 'ingreso' ? 'text-green-400' : 'text-red-400')}>
                    {t.type === 'ingreso' ? '+' : '-'}{formatCOP(t.amount)}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground capitalize">{t.paymentMethod}</td>
                  <td className="px-4 py-2.5">
                    {t.sourceType === 'manual' && (
                      <button onClick={() => del(t.id)} className="text-red-400/60 hover:text-red-400 p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pagination && (
            <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
              {pagination.total} transacciones en total
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── CATEGORÍAS TAB ───────────────────────────────────────────────────────────
function CategoriasTab() {
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type: 'egreso', name: '', icon: '', color: '#6366f1' })

  const load = useCallback(async () => {
    setLoading(true)
    const r = await api.getFinanceCategories()
    if (r.success) setCategories(r.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!form.name) { toast.error('El nombre es requerido'); return }
    const r = await api.createFinanceCategory({ type: form.type as 'ingreso' | 'egreso', name: form.name, icon: form.icon || undefined, color: form.color })
    if (r.success) { toast.success('Categoría creada'); setShowForm(false); setForm({ type: 'egreso', name: '', icon: '', color: '#6366f1' }); load() }
    else toast.error(r.error)
  }

  const del = async (id: string) => {
    const r = await api.deleteFinanceCategory(id)
    if (r.success) { toast.success('Eliminada'); load() }
    else toast.error(r.error)
  }

  const ingresos = categories.filter(c => c.type === 'ingreso')
  const egresos  = categories.filter(c => c.type === 'egreso')

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-semibold">Categorías</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => api.seedFinanceCategories().then(load)}>
            Restaurar por defecto
          </Button>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-3.5 w-3.5 mr-1" />Nueva
          </Button>
        </div>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Tipo</label>
              <select className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="egreso">Egreso</option>
                <option value="ingreso">Ingreso</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Nombre *</label>
              <input className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Reparaciones" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Emoji</label>
              <input className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} placeholder="🔧" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Color</label>
              <input type="color" className="mt-1 h-8 w-full rounded-md border border-border bg-background px-1 py-0.5 cursor-pointer"
                value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button size="sm" onClick={save}>Guardar</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[{ list: egresos, label: 'Egresos', colorClass: 'text-red-400' }, { list: ingresos, label: 'Ingresos', colorClass: 'text-green-400' }].map(group => (
            <div key={group.label} className="rounded-xl border border-border bg-card p-4">
              <h3 className={cn('text-sm font-semibold mb-3', group.colorClass)}>{group.label}</h3>
              <div className="space-y-1.5">
                {group.list.map(c => (
                  <div key={c.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/30 group">
                    <div className="h-5 w-5 rounded-full shrink-0" style={{ backgroundColor: c.color ?? '#6366f1' }} />
                    <span className="text-sm flex-1">{c.icon && `${c.icon} `}{c.name}</span>
                    {c.isSystem && <span className="text-[10px] text-muted-foreground bg-zinc-800 rounded px-1">sistema</span>}
                    {!c.isSystem && (
                      <button onClick={() => del(c.id)} className="opacity-0 group-hover:opacity-100 text-red-400/60 hover:text-red-400 p-0.5 transition-opacity">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
                {group.list.length === 0 && <p className="text-xs text-muted-foreground py-2 text-center">Sin categorías</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── PRESUPUESTO TAB ──────────────────────────────────────────────────────────
function PresupuestoTab() {
  const now = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [budgets, setBudgets] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [bR, cR] = await Promise.all([
      api.getFinanceBudgets(year, month),
      api.getFinanceCategories('egreso'),
    ])
    if (bR.success) setBudgets(bR.data ?? [])
    if (cR.success) setCategories(cR.data ?? [])
    setLoading(false)
  }, [year, month])

  useEffect(() => { load() }, [load])

  const save = async (categoryId: string) => {
    const amount = Number(editValue)
    if (isNaN(amount) || amount < 0) { toast.error('Monto inválido'); return }
    const r = await api.upsertFinanceBudget({ categoryId, year, month, budgetedAmount: amount })
    if (r.success) { toast.success('Presupuesto guardado'); setEditing(null); load() }
    else toast.error(r.error)
  }

  // Merge budgets with all categories
  const rows = categories.map(cat => {
    const budget = budgets.find(b => b.categoryId === cat.id)
    return {
      categoryId: cat.id,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      budgeted: budget?.budgetedAmount ?? 0,
      actual: budget?.actualAmount ?? 0,
      difference: (budget?.budgetedAmount ?? 0) - (budget?.actualAmount ?? 0),
    }
  }).filter(r => r.budgeted > 0 || r.actual > 0)

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3 flex-wrap">
        <select className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          value={month} onChange={e => setMonth(Number(e.target.value))}>
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          value={year} onChange={e => setYear(Number(e.target.value))}>
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <Button size="sm" variant="ghost" onClick={load}><RefreshCw className="h-3.5 w-3.5" /></Button>
      </div>

      <p className="text-xs text-muted-foreground">Haz clic en cualquier categoría para asignar o editar su presupuesto mensual.</p>

      {loading ? (
        <div className="flex justify-center py-8"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-accent/30">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Categoría</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">Presupuesto</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">Real</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(cat => {
                const row = rows.find(r => r.categoryId === cat.id) ?? { budgeted: 0, actual: 0, difference: 0 }
                const isEditing = editing === cat.id
                const pct = row.budgeted > 0 ? Math.min(100, Math.round((row.actual / row.budgeted) * 100)) : 0
                return (
                  <tr key={cat.id} className="border-b border-border/50 hover:bg-accent/20">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {cat.icon && <span>{cat.icon}</span>}
                        <span>{cat.name}</span>
                      </div>
                      {row.budgeted > 0 && (
                        <div className="mt-1 h-1.5 rounded-full bg-border overflow-hidden">
                          <div className={cn('h-full rounded-full transition-all', pct > 100 ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-primary')}
                            style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {isEditing ? (
                        <div className="flex items-center gap-1 justify-end">
                          <input type="number" className="w-28 rounded-md border border-border bg-background px-2 py-1 text-xs text-right"
                            value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus />
                          <button onClick={() => save(cat.id)} className="text-green-400 hover:text-green-300 p-0.5"><Check className="h-3.5 w-3.5" /></button>
                          <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground p-0.5"><X className="h-3.5 w-3.5" /></button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditing(cat.id); setEditValue(String(row.budgeted)) }}
                          className="font-medium hover:text-primary flex items-center gap-1 justify-end w-full group">
                          {row.budgeted > 0 ? formatCOP(row.budgeted) : <span className="text-muted-foreground text-xs">Asignar</span>}
                          <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-100 text-muted-foreground" />
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">{row.actual > 0 ? formatCOP(row.actual) : <span className="text-muted-foreground text-xs">—</span>}</td>
                    <td className={cn('px-4 py-2.5 text-right font-semibold', row.difference >= 0 ? 'text-green-400' : 'text-red-400')}>
                      {row.budgeted > 0 || row.actual > 0 ? (
                        <>{row.difference >= 0 ? '+' : ''}{formatCOP(row.difference)}</>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {categories.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Sin categorías. Ve a la pestaña <strong>Categorías</strong> y crea las primeras.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
