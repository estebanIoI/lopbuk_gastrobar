'use client'

import { useMemo, useState } from 'react'
import type { Order, OrderItem } from './PosShell'
import { TicketItem } from './TicketItem'
import { Clock, Users, ChefHat, GlassWater, CheckCircle2, Send, Utensils, Package, Banknote, Receipt } from 'lucide-react'

interface OrderTicketProps {
  order: Order | null
  selectedItems: Set<string>
  onToggleItem: (id: string) => void
  onUpdateQty: (id: string, qty: number) => void
  onRemoveItem: (id: string) => void
  onDuplicate: (id: string) => void
  sentItems: Set<string>
  onOpenPayment: () => void
  onSendSolo?: (id: string) => void
  onCancelItem?: (id: string) => void
  onDiscountItem?: (id: string) => void
  onMoveSeat?: (id: string, seat: number) => void
  onMoveCourse?: (id: string, course: number) => void
  canPay?: boolean
}

const formatCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

function formatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

function elapsedMinutes(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const ms = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `${mins}min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h ${m}m`
}

interface TimelineEvent { time: string; label: string; icon: 'open'|'kitchen'|'bar'|'ready'|'delivered'|'bill'|'general'; itemName?: string }

const STATUS_GROUPS = ['pendiente', 'en_preparacion', 'listo', 'entregado'] as const
const GROUP_DEFS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pendiente:      { label: 'Pendientes',     color: 'text-zinc-400',    icon: <Clock className="h-3 w-3" /> },
  en_preparacion: { label: 'Preparando',     color: 'text-amber-400',   icon: <ChefHat className="h-3 w-3" /> },
  listo:          { label: 'Listos',         color: 'text-emerald-400', icon: <CheckCircle2 className="h-3 w-3" /> },
  entregado:      { label: 'Entregados',     color: 'text-blue-400',    icon: <Package className="h-3 w-3" /> },
}

export function OrderTicket({ order, selectedItems, onToggleItem, onUpdateQty, onRemoveItem, onDuplicate, onOpenPayment, onSendSolo, onCancelItem, onDiscountItem, onMoveSeat, onMoveCourse, canPay = true }: OrderTicketProps) {
  const currentItems = order?.items.filter(i => i.status !== 'cancelado') ?? []
  const [groupBy, setGroupBy] = useState<'status' | 'seat'>('status')

  const groupedSeats = useMemo(() => {
    const seats: Record<number, { guestNumber: number; courses: Record<number, OrderItem[]> }> = {}
    const noSeat: OrderItem[] = []
    for (const item of currentItems) {
      const seat = item.guestNumber ?? 0
      const course = item.courseNumber ?? 1
      if (seat === 0) { noSeat.push(item); continue }
      if (!seats[seat]) seats[seat] = { guestNumber: seat, courses: {} }
      if (!seats[seat].courses[course]) seats[seat].courses[course] = []
      seats[seat].courses[course].push(item)
    }
    return { seats: Object.values(seats).sort((a, b) => a.guestNumber - b.guestNumber), noSeat }
  }, [currentItems])

  const groupedStatus = useMemo(() => {
    const m: Record<string, OrderItem[]> = { pendiente: [], en_preparacion: [], listo: [], entregado: [] }
    for (const item of currentItems) {
      (m[item.status] ??= []).push(item)
    }
    return m
  }, [currentItems])

  const timeline = useMemo<TimelineEvent[]>(() => {
    if (!order) return []
    const events: TimelineEvent[] = []
    if (order.openedAt) events.push({ time: formatTime(order.openedAt), label: 'Comanda abierta', icon: 'open' })
    for (const item of currentItems) {
      if (item.sentToKitchenAt) {
        const area = item.preparationArea === 'bar' ? 'Bar' : item.preparationArea === 'ambos' ? 'Cocina+Bar' : 'Cocina'
        events.push({ time: formatTime(item.sentToKitchenAt), label: `Enviado ${area}`, icon: item.preparationArea === 'bar' ? 'bar' : 'kitchen', itemName: item.menuItemName })
      }
      if (item.readyAt) events.push({ time: formatTime(item.readyAt), label: 'Listo', icon: 'ready', itemName: item.menuItemName })
      if (item.deliveredAt) events.push({ time: formatTime(item.deliveredAt), label: 'Entregado', icon: 'delivered', itemName: item.menuItemName })
    }
    return events.sort((a, b) => a.time < b.time ? -1 : a.time > b.time ? 1 : 0).slice(-8)
  }, [order, currentItems])

  const pendingCount = currentItems.filter(i => i.status === 'pendiente' && !i.sentToKitchenAt).length
  const preparingCount = currentItems.filter(i => i.status === 'en_preparacion').length
  const readyCount = currentItems.filter(i => i.status === 'listo').length

  const renderItem = (item: OrderItem) => (
    <TicketItem key={item.id} item={item} selected={selectedItems.has(item.id)}
      onToggle={() => onToggleItem(item.id)} onUpdateQty={onUpdateQty} onRemove={onRemoveItem}
      onDuplicate={onDuplicate} onSendSolo={onSendSolo} onCancel={onCancelItem}
      onDiscount={onDiscountItem} moveSeat={onMoveSeat} moveCourse={onMoveCourse} />
  )

  if (!order) {
    return (
      <div className="w-80 bg-zinc-900 border-l border-zinc-800 flex items-center justify-center text-zinc-600 text-sm shrink-0 p-4 text-center">
        Selecciona una mesa para comenzar
      </div>
    )
  }

  return (
    <div className="w-80 bg-zinc-900 border-l border-zinc-800 flex flex-col shrink-0">
      <div className="p-3 border-b border-zinc-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-zinc-100">Mesa {order.tableNumber}</span>
          <span className="text-xs text-zinc-500 font-mono">{order.orderNumber}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {order.guestsCount}</span>
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {elapsedMinutes(order.openedAt)}</span>
          <span className="text-zinc-600">— {order.waiterName}</span>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {currentItems.some(i => i.preparationArea === 'cocina' || i.preparationArea === 'ambos') && (
            <span className="text-[10px] bg-red-500/20 text-red-400 rounded px-1.5 py-0.5 font-semibold flex items-center gap-0.5"><ChefHat className="h-3 w-3" /> Cocina</span>
          )}
          {currentItems.some(i => i.preparationArea === 'bar' || i.preparationArea === 'ambos') && (
            <span className="text-[10px] bg-blue-500/20 text-blue-400 rounded px-1.5 py-0.5 font-semibold flex items-center gap-0.5"><GlassWater className="h-3 w-3" /> Bar</span>
          )}
          {pendingCount > 0 && <span className="text-[10px] bg-zinc-500/20 text-zinc-400 rounded px-1.5 py-0.5 font-semibold">{pendingCount} pend</span>}
          {preparingCount > 0 && <span className="text-[10px] bg-amber-500/20 text-amber-400 rounded px-1.5 py-0.5 font-semibold">{preparingCount} prep</span>}
          {readyCount > 0 && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 rounded px-1.5 py-0.5 font-semibold animate-pulse flex items-center gap-0.5"><CheckCircle2 className="h-3 w-3" /> {readyCount}</span>}
        </div>
      </div>

      {timeline.length > 0 && (
        <div className="px-3 py-2 border-b border-zinc-800 space-y-1.5 max-h-32 overflow-y-auto">
          {timeline.map((ev, i) => {
            const Icon = ev.icon === 'open' ? Clock : ev.icon === 'kitchen' ? ChefHat : ev.icon === 'bar' ? GlassWater : ev.icon === 'ready' ? Utensils : ev.icon === 'delivered' ? CheckCircle2 : ev.icon === 'bill' ? Receipt : Send
            return (
              <div key={i} className="flex items-start gap-2 text-[10px]">
                <span className="text-zinc-600 shrink-0 w-8 text-right">{ev.time}</span>
                <Icon className="h-2.5 w-2.5 shrink-0 mt-0.5 text-zinc-500" />
                <div className="flex-1 min-w-0"><span className="text-zinc-400">{ev.label}</span>{ev.itemName && <span className="text-zinc-600 ml-1 truncate">— {ev.itemName}</span>}</div>
              </div>
            )
          })}
        </div>
      )}

      {/* Group toggle */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-zinc-800">
        <button onClick={() => setGroupBy('status')} className={`text-[10px] px-2 py-0.5 rounded font-semibold transition-colors ${groupBy === 'status' ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-600 hover:text-zinc-400'}`}>Estado</button>
        <button onClick={() => setGroupBy('seat')} className={`text-[10px] px-2 py-0.5 rounded font-semibold transition-colors ${groupBy === 'seat' ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-600 hover:text-zinc-400'}`}>Seat</button>
      </div>

      <div className="flex-1 overflow-auto">
        {currentItems.length === 0 && <div className="p-4 text-center text-zinc-600 text-xs">Comanda vacía</div>}

        {groupBy === 'status' ? (
          STATUS_GROUPS.map(status => {
            const items = groupedStatus[status] || []
            if (items.length === 0) return null
            const def = GROUP_DEFS[status]
            const total = items.reduce((s, i) => s + i.subtotal, 0)
            return (
              <div key={status}>
                <div className="px-3 py-1.5 bg-zinc-800/50 text-xs font-bold text-zinc-400 border-y border-zinc-800 flex items-center justify-between">
                  <span className={`flex items-center gap-1.5 ${def.color}`}>{def.icon}{def.label} ({items.length})</span>
                  <span className="text-[10px] text-zinc-500">{formatCOP(total)}</span>
                </div>
                {items.map(renderItem)}
              </div>
            )
          })
        ) : (
          <>
            {groupedSeats.seats.map(seat => (
              <div key={seat.guestNumber}>
                <div className="px-3 py-1.5 bg-zinc-800/50 text-xs font-bold text-zinc-400 border-y border-zinc-800">Seat {seat.guestNumber}</div>
                {Object.entries(seat.courses).map(([c, items]) => (
                  <div key={c}>
                    {Object.keys(seat.courses).length > 1 && <div className="px-3 py-0.5 bg-zinc-800/30 text-[10px] font-semibold text-zinc-500">Curso {c}</div>}
                    {items.map(renderItem)}
                  </div>
                ))}
              </div>
            ))}
            {groupedSeats.noSeat.length > 0 && (
              <div>
                <div className="px-3 py-1.5 bg-zinc-800/50 text-xs font-bold text-zinc-400 border-y border-zinc-800">General</div>
                {groupedSeats.noSeat.map(renderItem)}
              </div>
            )}
          </>
        )}
      </div>

      <div className="border-t border-zinc-800 p-3 space-y-2">
        <div className="flex justify-between text-xs text-zinc-400"><span>Subtotal</span><span>{formatCOP(order.subtotal)}</span></div>
        {order.tax > 0 && <div className="flex justify-between text-xs text-zinc-400"><span>IVA</span><span>{formatCOP(order.tax)}</span></div>}
        {order.discount > 0 && <div className="flex justify-between text-xs text-red-400"><span>Descuento</span><span>-{formatCOP(order.discount)}</span></div>}
        <div className="flex justify-between text-sm font-bold text-zinc-100 pt-1 border-t border-zinc-800"><span>Total</span><span>{formatCOP(order.total)}</span></div>
        {canPay && (
          <button onClick={onOpenPayment}
            className="w-full h-12 mt-2 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white rounded-xl text-base font-extrabold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/30">
            <Banknote className="h-5 w-5" /> COBRAR {formatCOP(order.total)}
          </button>
        )}
      </div>
    </div>
  )
}
