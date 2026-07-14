'use client'

import { useMemo } from 'react'
import type { Order, OrderItem } from './PosShell'
import { TicketItem } from './TicketItem'
import { Clock, Users, ChefHat, GlassWater, CheckCircle2 } from 'lucide-react'

interface OrderTicketProps {
  order: Order | null
  selectedItems: Set<string>
  onToggleItem: (id: string) => void
  onUpdateQty: (id: string, qty: number) => void
  onRemoveItem: (id: string) => void
  onDuplicate: (id: string) => void
  sentItems: Set<string>
}

const formatCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

export function OrderTicket({ order, selectedItems, onToggleItem, onUpdateQty, onRemoveItem, onDuplicate }: OrderTicketProps) {
  const currentItems = order?.items.filter(i => i.status !== 'cancelado') ?? []

  const grouped = useMemo(() => {
    const seats: Record<number, { guestNumber: number; courses: Record<number, OrderItem[]> }> = {}
    const noSeat: OrderItem[] = []
    for (const item of currentItems) {
      const seat = item.guestNumber ?? 0
      const course = item.courseNumber ?? 1
      if (seat === 0) {
        noSeat.push(item)
        continue
      }
      if (!seats[seat]) seats[seat] = { guestNumber: seat, courses: {} }
      if (!seats[seat].courses[course]) seats[seat].courses[course] = []
      seats[seat].courses[course].push(item)
    }
    return { seats: Object.values(seats).sort((a, b) => a.guestNumber - b.guestNumber), noSeat }
  }, [currentItems])

  const elapsed = useMemo(() => {
    if (!order?.openedAt) return ''
    const ms = Date.now() - new Date(order.openedAt).getTime()
    const mins = Math.floor(ms / 60000)
    if (mins < 60) return `${mins}min`
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return `${h}h ${m}m`
  }, [order?.openedAt])

  if (!order) {
    return (
      <div className="w-80 bg-zinc-900 border-l border-zinc-800 flex items-center justify-center text-zinc-600 text-sm shrink-0 p-4 text-center">
        Selecciona una mesa para comenzar
      </div>
    )
  }

  return (
    <div className="w-80 bg-zinc-900 border-l border-zinc-800 flex flex-col shrink-0">
      {/* Header */}
      <div className="p-3 border-b border-zinc-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-zinc-100">
            Mesa {order.tableNumber}
          </span>
          <span className="text-xs text-zinc-400">{order.orderNumber}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {order.guestsCount}</span>
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {elapsed}</span>
        </div>
        {/* Status chips */}
        <div className="flex gap-1.5 flex-wrap">
          {currentItems.some(i => i.preparationArea === 'cocina' || i.preparationArea === 'ambos') && (
            <span className="text-[10px] bg-red-500/20 text-red-400 rounded px-1.5 py-0.5 font-semibold flex items-center gap-0.5">
              <ChefHat className="h-3 w-3" /> Cocina
            </span>
          )}
          {currentItems.some(i => i.preparationArea === 'bar' || i.preparationArea === 'ambos') && (
            <span className="text-[10px] bg-blue-500/20 text-blue-400 rounded px-1.5 py-0.5 font-semibold flex items-center gap-0.5">
              <GlassWater className="h-3 w-3" /> Bar
            </span>
          )}
          {order.status === 'abierta' && (
            <span className="text-[10px] bg-amber-500/20 text-amber-400 rounded px-1.5 py-0.5 font-semibold">Parcial</span>
          )}
          {order.status === 'lista' && (
            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 rounded px-1.5 py-0.5 font-semibold flex items-center gap-0.5">
              <CheckCircle2 className="h-3 w-3" /> Listo
            </span>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-auto">
        {currentItems.length === 0 && (
          <div className="p-4 text-center text-zinc-600 text-xs">Comanda vacía</div>
        )}

        {/* Grouped by Seat > Course */}
        {grouped.seats.map(seat => (
          <div key={seat.guestNumber}>
            <div className="px-3 py-1.5 bg-zinc-800/50 text-xs font-bold text-zinc-400 border-y border-zinc-800">
              Seat {seat.guestNumber}
            </div>
            {Object.entries(seat.courses).map(([courseNum, items]) => (
              <div key={courseNum}>
                {Object.keys(seat.courses).length > 1 && (
                  <div className="px-3 py-0.5 bg-zinc-800/30 text-[10px] font-semibold text-zinc-500">
                    Curso {courseNum}
                  </div>
                )}
                {items.map(item => (
                  <TicketItem
                    key={item.id}
                    item={item}
                    selected={selectedItems.has(item.id)}
                    onToggle={() => onToggleItem(item.id)}
                    onUpdateQty={onUpdateQty}
                    onRemove={onRemoveItem}
                    onDuplicate={onDuplicate}
                  />
                ))}
              </div>
            ))}
          </div>
        ))}

        {/* No seat */}
        {grouped.noSeat.length > 0 && (
          <div>
            <div className="px-3 py-1.5 bg-zinc-800/50 text-xs font-bold text-zinc-400 border-y border-zinc-800">
              General
            </div>
            {grouped.noSeat.map(item => (
              <TicketItem
                key={item.id}
                item={item}
                selected={selectedItems.has(item.id)}
                onToggle={() => onToggleItem(item.id)}
                onUpdateQty={onUpdateQty}
                onRemove={onRemoveItem}
                onDuplicate={onDuplicate}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer totals */}
      <div className="border-t border-zinc-800 p-3 space-y-1">
        <div className="flex justify-between text-xs text-zinc-400">
          <span>Subtotal</span>
          <span>{formatCOP(order.subtotal)}</span>
        </div>
        {order.discount > 0 && (
          <div className="flex justify-between text-xs text-red-400">
            <span>Descuento</span>
            <span>-{formatCOP(order.discount)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-bold text-zinc-100 pt-1 border-t border-zinc-800">
          <span>Total</span>
          <span>{formatCOP(order.total)}</span>
        </div>
      </div>
    </div>
  )
}
