'use client'

import { useRef, useState, useCallback } from 'react'
import type { OrderItem } from './PosShell'
import { Minus, Plus, Copy, Trash2, CheckSquare, Square, Send, XCircle, Gift, Percent, UserPlus, Layers, MoreHorizontal } from 'lucide-react'

interface TicketItemProps {
  item: OrderItem
  selected: boolean
  onToggle: () => void
  onUpdateQty: (id: string, qty: number) => void
  onRemove: (id: string) => void
  onDuplicate: (id: string) => void
  onSendSolo?: (id: string) => void
  onCancel?: (id: string) => void
  onDiscount?: (id: string) => void
  moveSeat?: (id: string, seat: number) => void
  moveCourse?: (id: string, course: number) => void
}

const SWIPE_THRESHOLD = 60
const LONG_PRESS_MS = 500

const formatCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string; dot: string }> = {
    pendiente:       { bg: 'bg-zinc-700/50',      text: 'text-zinc-400',      label: 'Pendiente',   dot: 'bg-zinc-400' },
    en_preparacion:  { bg: 'bg-amber-500/10',     text: 'text-amber-400',     label: 'Preparando',  dot: 'bg-amber-400' },
    listo:           { bg: 'bg-emerald-500/10',    text: 'text-emerald-400',   label: 'Listo',       dot: 'bg-emerald-400 animate-pulse' },
    entregado:       { bg: 'bg-blue-500/10',      text: 'text-blue-400',      label: 'Entregado',   dot: 'bg-blue-400' },
    cancelado:       { bg: 'bg-red-500/10',       text: 'text-red-400/60',    label: 'Cancelado',   dot: 'bg-red-400' },
  }
  const c = config[status] || config.pendiente
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}

export function TicketItem({
  item, selected, onToggle, onUpdateQty, onRemove, onDuplicate,
  onSendSolo, onCancel, onDiscount, moveSeat, moveCourse,
}: TicketItemProps) {
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isPressing = useRef(false)
  const [translateX, setTranslateX] = useState(0)
  const [showMenu, setShowMenu] = useState(false)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    isPressing.current = true
    longPressTimer.current = setTimeout(() => {
      if (isPressing.current) {
        setShowMenu(true)
        isPressing.current = false
      }
    }, LONG_PRESS_MS)
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    isPressing.current = false
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
    const dx = e.touches[0].clientX - touchStartX.current
    const dy = e.touches[0].clientY - touchStartY.current
    if (Math.abs(dx) > Math.abs(dy)) {
      setTranslateX(dx)
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    isPressing.current = false
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
    if (translateX > SWIPE_THRESHOLD) {
      onUpdateQty(item.id, item.quantity + 1)
    } else if (translateX < -SWIPE_THRESHOLD) {
      onRemove(item.id)
    }
    setTranslateX(0)
  }, [translateX, item.id, item.quantity, onUpdateQty, onRemove])

  const isSelected = selected
  const isDelivered = item.status === 'entregado' || item.status === 'cancelado'

  return (
    <div className="pos-ticket-enter">
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={() => { isPressing.current = true; longPressTimer.current = setTimeout(() => { if (isPressing.current) setShowMenu(true) }, LONG_PRESS_MS) }}
        onMouseUp={() => { isPressing.current = false; if (longPressTimer.current) clearTimeout(longPressTimer.current) }}
        onMouseLeave={() => { isPressing.current = false; if (longPressTimer.current) clearTimeout(longPressTimer.current) }}
        className={`px-3 py-2.5 transition-all relative select-none
          ${isSelected ? 'bg-zinc-800/80 ring-1 ring-emerald-500/30 rounded-lg mx-1' : 'hover:bg-zinc-800/30'}
          ${isDelivered ? 'opacity-50' : ''}`}
        style={{ transform: `translateX(${translateX}px)`, transition: translateX === 0 ? 'transform 0.2s ease' : 'none' }}
      >
        <div className="flex items-start gap-2">
          {/* Checkbox */}
          <button onClick={onToggle}
            className="mt-0.5 shrink-0 text-zinc-500 hover:text-emerald-400 transition-colors">
            {isSelected
              ? <CheckSquare className="h-4 w-4 text-emerald-400" />
              : <Square className="h-4 w-4" />}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-zinc-200">
                {item.quantity > 1 && <span className="text-zinc-500 mr-1">{item.quantity}x</span>}
                {item.menuItemName}
              </span>
              <span className="text-xs font-bold text-zinc-400 shrink-0">
                {formatCOP(item.subtotal)}
              </span>
            </div>

            {item.itemNotes && (
              <div className="text-[10px] text-zinc-500 mt-0.5 italic">"{item.itemNotes}"</div>
            )}

            {item.originalPrice && item.unitPrice < item.originalPrice && (
              <div className="text-[10px] text-amber-500 mt-0.5">
                Desc. {formatCOP(item.originalPrice - item.unitPrice)}
              </div>
            )}

            {/* Status + seat + course */}
            <div className="flex items-center gap-2 mt-1.5">
              <StatusBadge status={item.status} />
              {item.guestNumber && (
                <span className="text-[10px] text-zinc-600">S{item.guestNumber}</span>
              )}
              {item.courseNumber && item.courseNumber > 1 && (
                <span className="text-[10px] text-zinc-600">C{item.courseNumber}</span>
              )}
            </div>
          </div>

          {/* Quick Qty (desktop hover) */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button onClick={() => onUpdateQty(item.id, Math.max(1, item.quantity - 1))}
              className="h-6 w-6 flex items-center justify-center rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-400">
              <Minus className="h-3 w-3" />
            </button>
            <span className="text-[10px] font-bold text-zinc-400 w-4 text-center">{item.quantity}</span>
            <button onClick={() => onUpdateQty(item.id, item.quantity + 1)}
              className="h-6 w-6 flex items-center justify-center rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-400">
              <Plus className="h-3 w-3" />
            </button>
            <button onClick={() => setShowMenu(true)}
              className="h-6 w-6 flex items-center justify-center rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-400 ml-1">
              <MoreHorizontal className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Contextual menu (long press or ... button) */}
      {showMenu && (
        <ItemContextMenu
          item={item}
          onClose={() => setShowMenu(false)}
          onDuplicate={onDuplicate}
          onSendSolo={onSendSolo}
          onCancel={onCancel}
          onDiscount={onDiscount}
          moveSeat={moveSeat}
          moveCourse={moveCourse}
          onRemove={onRemove}
        />
      )}
    </div>
  )
}

function ItemContextMenu({
  item, onClose,
  onDuplicate, onSendSolo, onCancel, onDiscount, moveSeat, moveCourse, onRemove,
}: {
  item: OrderItem
  onClose: () => void
  onDuplicate: (id: string) => void
  onSendSolo?: (id: string) => void
  onCancel?: (id: string) => void
  onDiscount?: (id: string) => void
  moveSeat?: (id: string, seat: number) => void
  moveCourse?: (id: string, course: number) => void
  onRemove: (id: string) => void
}) {
  const actions: { label: string; icon: React.ReactNode; color: string; action: () => void }[] = [
    { label: 'Duplicar', icon: <Copy className="h-3.5 w-3.5" />, color: 'text-zinc-300', action: () => { onDuplicate(item.id); onClose() } },
  ]
  if (onSendSolo) {
    actions.push({ label: 'Enviar solo', icon: <Send className="h-3.5 w-3.5" />, color: 'text-emerald-400', action: () => { onSendSolo(item.id); onClose() } })
  }
  if (onDiscount) {
    actions.push({ label: 'Descuento', icon: <Percent className="h-3.5 w-3.5" />, color: 'text-amber-400', action: () => { onDiscount(item.id); onClose() } })
  }
  if (moveSeat) {
    actions.push({ label: 'Cambiar Seat', icon: <UserPlus className="h-3.5 w-3.5" />, color: 'text-blue-400', action: () => {
      const seat = prompt('Mover a Seat #:')
      if (seat && !isNaN(+seat)) { moveSeat(item.id, +seat); onClose() }
    }})
  }
  if (moveCourse) {
    actions.push({ label: 'Cambiar Curso', icon: <Layers className="h-3.5 w-3.5" />, color: 'text-purple-400', action: () => {
      const course = prompt('Mover a Curso #:')
      if (course && !isNaN(+course)) { moveCourse(item.id, +course); onClose() }
    }})
  }
  if (onCancel) {
    actions.push({ label: 'Cancelar ítem', icon: <XCircle className="h-3.5 w-3.5" />, color: 'text-red-400', action: () => { onCancel(item.id); onClose() } })
  }
  actions.push({ label: 'Eliminar', icon: <Trash2 className="h-3.5 w-3.5" />, color: 'text-red-400', action: () => { onRemove(item.id); onClose() } })

  return (
    <div className="fixed inset-0 z-[400] bg-black/40 flex items-center justify-center" onClick={onClose}>
      <div className="bg-zinc-800 border border-zinc-600 rounded-2xl p-3 w-52 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="text-[10px] font-semibold text-zinc-400 mb-2 px-2 truncate">
          {item.quantity}x {item.menuItemName}
        </div>
        <div className="space-y-0.5">
          {actions.map((a, i) => (
            <button key={i} onClick={a.action}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors
                hover:bg-zinc-700 ${a.color}`}>
              {a.icon}
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
