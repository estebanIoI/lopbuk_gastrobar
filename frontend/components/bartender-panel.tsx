'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  GlassWater, RefreshCcw, RefreshCw, Clock, LogOut,
  CheckCircle2, AlertCircle, Timer, Zap, ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BarItem {
  itemId:   string
  name:     string
  quantity: number
  status:   'pendiente' | 'en_preparacion' | 'listo' | 'entregado' | 'cancelado'
  notes?:   string
}

interface BarOrder {
  orderId:     string
  orderNumber: string
  tableNumber: number | string
  waiterName:  string
  openedAt:    string
  orderNotes?: string
  items:       BarItem[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Elapsed minutes since a date string */
function elapsedMin(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
}

/** Color class based on wait time */
function urgencyColor(min: number): string {
  if (min < 5)  return 'text-green-400'
  if (min < 10) return 'text-amber-400'
  return 'text-red-400'
}

function urgencyBg(min: number): string {
  if (min < 5)  return 'bg-green-500/10 border-green-500/30'
  if (min < 10) return 'bg-amber-500/10 border-amber-500/30'
  return 'bg-red-500/10 border-red-500/30'
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pendiente:      { label: 'Pendiente',    cls: 'bg-zinc-700/60 text-zinc-300' },
  en_preparacion: { label: 'Preparando',   cls: 'bg-amber-500/20 text-amber-400' },
  listo:          { label: 'Listo ✓',      cls: 'bg-green-500/20 text-green-400' },
  entregado:      { label: 'Entregado',    cls: 'bg-blue-500/20 text-blue-400' },
  cancelado:      { label: 'Cancelado',    cls: 'bg-red-500/20 text-red-400' },
}

type FilterStatus = 'todos' | 'pendiente' | 'en_preparacion' | 'listo'

// ─── Main Export ──────────────────────────────────────────────────────────────

export function BartenderPanel() {
  const { user, logout } = useAuthStore()

  const [orders,      setOrders]      = useState<BarOrder[]>([])
  const [loading,     setLoading]     = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdate,  setLastUpdate]  = useState(new Date())
  const [currentTime, setCurrentTime] = useState(new Date())
  const [filter,      setFilter]      = useState<FilterStatus>('todos')
  const [updating,    setUpdating]    = useState<string | null>(null) // itemId being updated

  const autoRef    = useRef(autoRefresh)
  const updatingRef = useRef(false)
  autoRef.current  = autoRefresh

  // ── Clock ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // ── Data fetch ────────────────────────────────────────────────────────────
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    const r = await api.getBarDisplay()
    if (r.success) {
      setOrders(r.data ?? [])
      setLastUpdate(new Date())
    }
    if (!silent) setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Auto-refresh every 5 seconds
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const schedule = () => {
      timer = setTimeout(async () => {
        if (autoRef.current && !updatingRef.current) await load(true)
        schedule()
      }, 5000)
    }
    schedule()
    return () => clearTimeout(timer)
  }, [load])

  // ── Status update ─────────────────────────────────────────────────────────
  const advance = async (itemId: string, nextStatus: string) => {
    setUpdating(itemId)
    updatingRef.current = true
    const r = await api.updateRestbarItemStatus(itemId, nextStatus)
    if (r.success) {
      // Optimistic update
      setOrders(prev => prev.map(o => ({
        ...o,
        items: o.items.map(i => i.itemId === itemId ? { ...i, status: nextStatus as BarItem['status'] } : i),
      })))
      toast.success(nextStatus === 'en_preparacion' ? 'Preparando...' : '¡Listo!')
    } else {
      toast.error(r.error ?? 'Error al actualizar')
      await load(true)
    }
    setUpdating(null)
    updatingRef.current = false
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const allItems     = orders.flatMap(o => o.items.filter(i => i.status !== 'cancelado' && i.status !== 'entregado'))
  const pendingCount = allItems.filter(i => i.status === 'pendiente').length
  const prepCount    = allItems.filter(i => i.status === 'en_preparacion').length
  const readyCount   = allItems.filter(i => i.status === 'listo').length

  // ── Filtered orders ───────────────────────────────────────────────────────
  const displayed = orders
    .map(o => ({
      ...o,
      items: o.items.filter(i => {
        if (i.status === 'cancelado' || i.status === 'entregado') return false
        if (filter === 'todos') return true
        return i.status === filter
      }),
    }))
    .filter(o => o.items.length > 0)

  // Sort: urgency (oldest first)
  displayed.sort((a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime())

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col select-none">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="border-b border-border bg-card px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <GlassWater className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="font-bold text-sm text-foreground leading-none">Panel de Bar</p>
            <p className="text-[11px] text-muted-foreground leading-none mt-0.5">{user?.name ?? ''}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Timer */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground border border-border rounded-lg px-2.5 py-1.5">
            <Clock className="h-3.5 w-3.5" />
            {currentTime.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>

          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh(v => !v)}
            title={autoRefresh ? 'Auto-refresh activo (cada 5 s)' : 'Auto-refresh pausado'}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
              autoRefresh
                ? 'border-primary/50 bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            )}
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{autoRefresh ? 'Auto' : 'Pausado'}</span>
          </button>

          {/* Manual refresh */}
          <button
            onClick={() => load()}
            title="Sincronizar ahora"
            className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>

          {/* Logout */}
          <Button
            size="sm" variant="ghost"
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
            onClick={logout}
          >
            <LogOut className="h-3.5 w-3.5 sm:mr-1" />
            <span className="hidden sm:inline">Salir</span>
          </Button>
        </div>
      </header>

      {/* ── Stats strip ───────────────────────────────────────────────────── */}
      <div className="flex gap-3 px-4 pt-4 pb-2 overflow-x-auto shrink-0">
        {[
          {
            icon:  <Zap        className="h-4 w-4 text-zinc-400" />,
            label: 'Pendientes',
            value: pendingCount,
            cls:   pendingCount > 0 ? 'border-zinc-500/40 bg-zinc-500/10' : 'border-border',
            val:   'text-zinc-300',
          },
          {
            icon:  <Timer      className="h-4 w-4 text-amber-400" />,
            label: 'Preparando',
            value: prepCount,
            cls:   prepCount > 0 ? 'border-amber-500/40 bg-amber-500/10' : 'border-border',
            val:   'text-amber-400',
          },
          {
            icon:  <CheckCircle2 className="h-4 w-4 text-green-400" />,
            label: 'Listos',
            value: readyCount,
            cls:   readyCount > 0 ? 'border-green-500/40 bg-green-500/10' : 'border-border',
            val:   'text-green-400',
          },
          {
            icon:  <GlassWater className="h-4 w-4 text-blue-400" />,
            label: 'Comandas activas',
            value: orders.length,
            cls:   'border-border',
            val:   'text-foreground',
          },
        ].map(s => (
          <div key={s.label} className={cn('flex items-center gap-3 rounded-xl border px-4 py-2.5 shrink-0', s.cls)}>
            {s.icon}
            <div>
              <p className="text-[10px] text-muted-foreground leading-none">{s.label}</p>
              <p className={cn('text-xl font-bold leading-none mt-1', s.val)}>{s.value}</p>
            </div>
          </div>
        ))}

        <div className="ml-auto flex items-center shrink-0">
          <p className="text-[10px] text-muted-foreground">
            Actualizado: {lastUpdate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        </div>
      </div>

      {/* ── Filter pills ──────────────────────────────────────────────────── */}
      <div className="flex gap-2 px-4 pb-3 shrink-0 overflow-x-auto">
        {([
          { id: 'todos',          label: 'Todos' },
          { id: 'pendiente',      label: `Pendientes (${pendingCount})` },
          { id: 'en_preparacion', label: `Preparando (${prepCount})` },
          { id: 'listo',          label: `Listos (${readyCount})` },
        ] as { id: FilterStatus; label: string }[]).map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors shrink-0',
              filter === f.id
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── KDS grid ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading && orders.length === 0 ? (
          <div className="flex justify-center py-20">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : displayed.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {displayed.map(order => (
              <OrderCard
                key={order.orderId}
                order={order}
                updating={updating}
                onAdvance={advance}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── OrderCard ────────────────────────────────────────────────────────────────

function OrderCard({
  order, updating, onAdvance,
}: {
  order: BarOrder
  updating: string | null
  onAdvance: (itemId: string, status: string) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const elapsed = elapsedMin(order.openedAt)
  const hasPending = order.items.some(i => i.status === 'pendiente')
  const hasPrep    = order.items.some(i => i.status === 'en_preparacion')
  const allReady   = order.items.every(i => i.status === 'listo')

  // Card urgency border
  const cardBorder = hasPending
    ? elapsed >= 10 ? 'border-red-500/50'
    : elapsed >= 5  ? 'border-amber-500/50'
    : 'border-border'
    : hasPrep ? 'border-amber-500/30' : 'border-green-500/30'

  return (
    <div className={cn('rounded-2xl border-2 bg-card overflow-hidden transition-all', cardBorder)}>

      {/* Card header */}
      <div className={cn(
        'flex items-center justify-between px-3 py-2.5',
        hasPending && elapsed >= 10
          ? 'bg-red-500/10'
          : hasPending && elapsed >= 5
          ? 'bg-amber-500/10'
          : allReady
          ? 'bg-green-500/5'
          : 'bg-accent/40'
      )}>
        <div>
          <p className="font-bold text-sm text-foreground leading-none">
            #{order.orderNumber} — Mesa {order.tableNumber}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-none">
            {order.waiterName}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Elapsed time badge */}
          <div className={cn(
            'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold',
            urgencyBg(elapsed)
          )}>
            <Clock className={cn('h-3 w-3', urgencyColor(elapsed))} />
            <span className={urgencyColor(elapsed)}>{elapsed}m</span>
          </div>

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(v => !v)}
            className="rounded-md p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <ChevronDown className={cn('h-4 w-4 transition-transform', collapsed && '-rotate-90')} />
          </button>
        </div>
      </div>

      {/* Order notes */}
      {order.orderNotes && !collapsed && (
        <div className="border-t border-amber-500/20 bg-amber-500/5 px-3 py-2">
          <p className="text-xs text-amber-400 flex items-center gap-1.5">
            <AlertCircle className="h-3 w-3 shrink-0" />
            {order.orderNotes}
          </p>
        </div>
      )}

      {/* Items */}
      {!collapsed && (
        <div className="p-2 space-y-1.5">
          {order.items.map(item => (
            <BarItemRow
              key={item.itemId}
              item={item}
              updating={updating === item.itemId}
              onAdvance={onAdvance}
            />
          ))}
        </div>
      )}

      {/* Collapsed summary */}
      {collapsed && (
        <div className="px-3 py-2 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{order.items.length} ítem(s)</span>
          {hasPending && (
            <span className="rounded-full bg-zinc-700/60 px-2 py-0.5 text-[10px] text-zinc-300">
              {order.items.filter(i => i.status === 'pendiente').length} pendiente(s)
            </span>
          )}
          {hasPrep && (
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-400">
              {order.items.filter(i => i.status === 'en_preparacion').length} prep.
            </span>
          )}
          {allReady && (
            <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] text-green-400">
              Todo listo ✓
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── BarItemRow ───────────────────────────────────────────────────────────────

function BarItemRow({
  item, updating, onAdvance,
}: {
  item: BarItem
  updating: boolean
  onAdvance: (itemId: string, status: string) => void
}) {
  const meta = STATUS_META[item.status] ?? STATUS_META.pendiente

  return (
    <div className={cn(
      'rounded-xl border p-2.5 transition-all',
      item.status === 'listo'          ? 'border-green-500/20 bg-green-500/5' :
      item.status === 'en_preparacion' ? 'border-amber-500/20 bg-amber-500/5' :
                                         'border-border bg-background'
    )}>
      {/* Item name + qty */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-tight">
            <span className={cn(
              'inline-flex items-center justify-center h-5 w-5 rounded-full text-[11px] font-bold mr-1.5',
              item.status === 'listo'          ? 'bg-green-500/20 text-green-400' :
              item.status === 'en_preparacion' ? 'bg-amber-500/20 text-amber-400' :
                                                 'bg-zinc-700/60 text-zinc-300'
            )}>
              {item.quantity}
            </span>
            {item.name}
          </p>
          {item.notes && (
            <p className="text-xs text-amber-400 mt-1 italic flex items-center gap-1">
              <AlertCircle className="h-3 w-3 shrink-0" />{item.notes}
            </p>
          )}
        </div>
        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0', meta.cls)}>
          {meta.label}
        </span>
      </div>

      {/* Action buttons */}
      {item.status === 'pendiente' && (
        <button
          onClick={() => onAdvance(item.itemId, 'en_preparacion')}
          disabled={updating}
          className="mt-2 w-full rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-semibold py-1.5 hover:bg-amber-500/25 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          <GlassWater className="h-3.5 w-3.5" />
          {updating ? 'Actualizando...' : 'Empezar a preparar'}
        </button>
      )}

      {item.status === 'en_preparacion' && (
        <button
          onClick={() => onAdvance(item.itemId, 'listo')}
          disabled={updating}
          className="mt-2 w-full rounded-lg bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-semibold py-1.5 hover:bg-green-500/25 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {updating ? 'Actualizando...' : 'Marcar como listo'}
        </button>
      )}

      {item.status === 'listo' && (
        <div className="mt-2 flex items-center justify-center gap-1.5 py-1 text-xs text-green-400 font-medium">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Listo — en espera del mesero
        </div>
      )}
    </div>
  )
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState({ filter }: { filter: FilterStatus }) {
  const messages: Record<FilterStatus, { title: string; sub: string }> = {
    todos:          { title: 'Todo al día',               sub: 'No hay pedidos activos para el bar en este momento.' },
    pendiente:      { title: 'Sin pedidos pendientes',    sub: 'Todos los ítems del bar están en preparación o listos.' },
    en_preparacion: { title: 'Nada en preparación',       sub: 'No hay ítems siendo preparados actualmente.' },
    listo:          { title: 'Sin pedidos listos',        sub: 'Termina de preparar los pedidos pendientes.' },
  }
  const { title, sub } = messages[filter]

  return (
    <div className="flex flex-col items-center gap-4 py-24 text-muted-foreground">
      <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
        <GlassWater className="h-8 w-8 text-primary/50" />
      </div>
      <div className="text-center">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-sm mt-1">{sub}</p>
      </div>
    </div>
  )
}
