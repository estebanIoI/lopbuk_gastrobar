'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  ChefHat, RefreshCcw, RefreshCw, Clock, LogOut,
  CheckCircle2, AlertCircle, Timer, Zap, Flame,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

// ─── Types ────────────────────────────────────────────────────────────────────

interface KitchenItem {
  itemId:   string
  name:     string
  quantity: number
  status:   'pendiente' | 'en_preparacion' | 'listo' | 'entregado' | 'cancelado'
  notes?:   string
}

interface KitchenOrder {
  orderId:     string
  orderNumber: string
  tableNumber: number | string
  waiterName:  string
  openedAt:    string
  orderNotes?: string
  items:       KitchenItem[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function elapsedMin(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
}

function urgencyBg(min: number): string {
  if (min < 8)  return 'bg-emerald-500/10 border-emerald-500/30'
  if (min < 15) return 'bg-amber-500/10 border-amber-500/30'
  return 'bg-red-500/10 border-red-500/30'
}

function urgencyText(min: number): string {
  if (min < 8)  return 'text-emerald-400'
  if (min < 15) return 'text-amber-400'
  return 'text-red-400'
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pendiente:      { label: 'Pendiente',   cls: 'bg-zinc-700/60 text-zinc-300' },
  en_preparacion: { label: 'Cocinando',  cls: 'bg-orange-500/20 text-orange-400' },
  listo:          { label: 'Listo ✓',    cls: 'bg-green-500/20 text-green-400' },
  entregado:      { label: 'Entregado',  cls: 'bg-blue-500/20 text-blue-400' },
  cancelado:      { label: 'Cancelado',  cls: 'bg-red-500/20 text-red-400' },
}

type FilterStatus = 'todos' | 'pendiente' | 'en_preparacion' | 'listo'

// ─── Main Export ──────────────────────────────────────────────────────────────

export function CocineroPanel() {
  const { user, logout } = useAuthStore()

  const [orders,      setOrders]      = useState<KitchenOrder[]>([])
  const [loading,     setLoading]     = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdate,  setLastUpdate]  = useState(new Date())
  const [currentTime, setCurrentTime] = useState(new Date())
  const [filter,      setFilter]      = useState<FilterStatus>('todos')
  const [updating,    setUpdating]    = useState<string | null>(null)

  const autoRef     = useRef(autoRefresh)
  const updatingRef = useRef(false)
  autoRef.current   = autoRefresh

  // ── Clock ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // ── Data fetch ────────────────────────────────────────────────────────────
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    const r = await api.getKitchenDisplay()
    if (r.success) {
      setOrders(r.data ?? [])
      setLastUpdate(new Date())
    }
    if (!silent) setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Auto-refresh every 5 s
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

  // ── Status advance ────────────────────────────────────────────────────────
  const advance = async (itemId: string, nextStatus: string) => {
    setUpdating(itemId)
    updatingRef.current = true
    const r = await api.updateRestbarItemStatus(itemId, nextStatus)
    if (r.success) {
      setOrders(prev => prev.map(o => ({
        ...o,
        items: o.items.map(i =>
          i.itemId === itemId ? { ...i, status: nextStatus as KitchenItem['status'] } : i
        ),
      })))
      toast.success(nextStatus === 'en_preparacion' ? '🔥 Cocinando...' : '✅ ¡Listo para servir!')
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

  // ── Filtered & sorted orders ───────────────────────────────────────────────
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
    .sort((a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime())

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col select-none">

      {/* ── Header ── */}
      <header className="border-b border-border bg-card px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-orange-500/15 flex items-center justify-center">
            <ChefHat className="h-4 w-4 text-orange-400" />
          </div>
          <div>
            <p className="font-bold text-sm text-foreground leading-none">Pantalla Cocina</p>
            <p className="text-[11px] text-muted-foreground leading-none mt-0.5">{user?.name ?? ''}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground border border-border rounded-lg px-2.5 py-1.5">
            <Clock className="h-3.5 w-3.5" />
            {currentTime.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>

          <button
            onClick={() => setAutoRefresh(v => !v)}
            title={autoRefresh ? 'Auto-refresh activo' : 'Auto-refresh pausado'}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
              autoRefresh
                ? 'border-orange-500/50 bg-orange-500/10 text-orange-400'
                : 'border-border text-muted-foreground hover:text-foreground'
            )}
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{autoRefresh ? 'Auto' : 'Pausado'}</span>
          </button>

          <button
            onClick={() => load()}
            className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>

          <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={logout}>
            <LogOut className="h-3.5 w-3.5 sm:mr-1" />
            <span className="hidden sm:inline">Salir</span>
          </Button>
        </div>
      </header>

      {/* ── Stats strip ── */}
      <div className="flex gap-3 px-4 pt-4 pb-2 overflow-x-auto shrink-0">
        {[
          {
            icon:  <Zap className="h-4 w-4 text-zinc-400" />,
            label: 'En cola',
            value: pendingCount,
            cls:   pendingCount > 0 ? 'border-zinc-500/40 bg-zinc-500/10' : 'border-border',
            val:   'text-zinc-300',
          },
          {
            icon:  <Flame className="h-4 w-4 text-orange-400" />,
            label: 'Cocinando',
            value: prepCount,
            cls:   prepCount > 0 ? 'border-orange-500/40 bg-orange-500/10' : 'border-border',
            val:   'text-orange-400',
          },
          {
            icon:  <CheckCircle2 className="h-4 w-4 text-green-400" />,
            label: 'Listos',
            value: readyCount,
            cls:   readyCount > 0 ? 'border-green-500/40 bg-green-500/10' : 'border-border',
            val:   'text-green-400',
          },
          {
            icon:  <ChefHat className="h-4 w-4 text-orange-300" />,
            label: 'Comandas',
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

      {/* ── Filter pills ── */}
      <div className="flex gap-2 px-4 pb-3 shrink-0 overflow-x-auto">
        {([
          { id: 'todos',          label: 'Todos' },
          { id: 'pendiente',      label: `En cola (${pendingCount})` },
          { id: 'en_preparacion', label: `Cocinando (${prepCount})` },
          { id: 'listo',          label: `Listos (${readyCount})` },
        ] as { id: FilterStatus; label: string }[]).map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors shrink-0',
              filter === f.id
                ? 'bg-orange-500 text-white border-orange-500'
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── KDS grid ── */}
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
  order: KitchenOrder
  updating: string | null
  onAdvance: (itemId: string, status: string) => void
}) {
  const elapsed    = elapsedMin(order.openedAt)
  const hasPending = order.items.some(i => i.status === 'pendiente')
  const hasPrep    = order.items.some(i => i.status === 'en_preparacion')
  const allReady   = order.items.every(i => i.status === 'listo')

  const cardBorder = hasPending
    ? elapsed >= 15 ? 'border-red-500/60'
    : elapsed >= 8  ? 'border-amber-500/50'
    : 'border-orange-500/30'
    : hasPrep ? 'border-orange-500/40' : 'border-green-500/30'

  const headerBg = hasPending && elapsed >= 15
    ? 'bg-red-500/15'
    : hasPending && elapsed >= 8
    ? 'bg-amber-500/15'
    : allReady
    ? 'bg-green-500/8'
    : 'bg-accent/40'

  // Parse order notes — skip internal JSON guest structure
  let displayNote: string | undefined
  if (order.orderNotes) {
    try {
      const parsed = JSON.parse(order.orderNotes)
      displayNote = parsed?.note || undefined
    } catch {
      displayNote = order.orderNotes
    }
  }

  return (
    <div className={cn('rounded-2xl border-2 bg-card overflow-hidden transition-all', cardBorder)}>

      {/* Header */}
      <div className={cn('flex items-center justify-between px-3 py-2.5', headerBg)}>
        <div>
          <p className="font-bold text-sm text-foreground leading-none">
            #{order.orderNumber} — Mesa {order.tableNumber}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-none">{order.waiterName}</p>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <div className={cn('flex items-center gap-1 text-xs font-bold tabular-nums', urgencyText(elapsed))}>
            <Timer className="h-3 w-3" />
            {elapsed} min
          </div>
          {allReady && (
            <span className="text-[10px] font-bold text-green-400 uppercase tracking-wide">Todo listo</span>
          )}
        </div>
      </div>

      {/* Note */}
      {displayNote && (
        <div className="px-3 py-2 bg-amber-500/8 border-b border-amber-500/20">
          <p className="text-xs text-amber-400 flex items-center gap-1.5">
            <AlertCircle className="h-3 w-3 shrink-0" /> {displayNote}
          </p>
        </div>
      )}

      {/* Items */}
      <div className="divide-y divide-border/50">
        {order.items.map(item => {
          const meta = STATUS_META[item.status] ?? STATUS_META.pendiente
          const isUpdating = updating === item.itemId

          return (
            <div key={item.itemId} className={cn(
              'px-3 py-2.5 transition-opacity',
              isUpdating && 'opacity-50'
            )}>
              {/* Item row */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold leading-tight">
                    <span className="text-orange-400 mr-1">{item.quantity}×</span>
                    {item.name}
                  </p>
                  {item.notes && (
                    <p className="text-[11px] text-amber-400/80 mt-0.5 italic leading-tight">
                      ↳ {item.notes}
                    </p>
                  )}
                </div>
                <span className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0 whitespace-nowrap',
                  meta.cls
                )}>
                  {meta.label}
                </span>
              </div>

              {/* Action buttons */}
              <div className="flex gap-1.5">
                {item.status === 'pendiente' && (
                  <button
                    onClick={() => onAdvance(item.itemId, 'en_preparacion')}
                    disabled={isUpdating}
                    className="flex-1 rounded-lg bg-orange-500/15 text-orange-400 text-xs font-semibold py-1.5 hover:bg-orange-500/25 active:scale-[0.97] transition-all flex items-center justify-center gap-1"
                  >
                    <Flame className="h-3 w-3" /> Cocinar
                  </button>
                )}
                {item.status === 'en_preparacion' && (
                  <button
                    onClick={() => onAdvance(item.itemId, 'listo')}
                    disabled={isUpdating}
                    className="flex-1 rounded-lg bg-green-500/15 text-green-400 text-xs font-semibold py-1.5 hover:bg-green-500/25 active:scale-[0.97] transition-all flex items-center justify-center gap-1"
                  >
                    <CheckCircle2 className="h-3 w-3" /> Listo para servir
                  </button>
                )}
                {item.status === 'listo' && (
                  <div className="flex-1 rounded-lg bg-green-500/8 border border-green-500/20 text-green-400/60 text-xs text-center py-1.5">
                    Esperando mesero
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer urgency bar */}
      <div className={cn('h-1', urgencyBg(elapsed).split(' ')[0].replace('bg-', 'bg-').replace('/10', '/40'))} />
    </div>
  )
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState({ filter }: { filter: FilterStatus }) {
  const msgs: Record<FilterStatus, string> = {
    todos:          'No hay comandas en cocina',
    pendiente:      'No hay ítems en cola',
    en_preparacion: 'No hay ítems cocinando',
    listo:          'No hay ítems listos',
  }
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
      <div className="h-16 w-16 rounded-2xl bg-accent flex items-center justify-center">
        <ChefHat className="h-8 w-8 opacity-30" />
      </div>
      <p className="font-semibold">{msgs[filter]}</p>
      <p className="text-sm">Se actualiza automáticamente cada 5 segundos</p>
    </div>
  )
}
