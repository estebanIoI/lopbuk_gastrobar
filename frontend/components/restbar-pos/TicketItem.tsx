'use client'

import type { OrderItem } from './PosShell'
import { Minus, Plus, Copy, Trash2, CheckSquare, Square } from 'lucide-react'

interface TicketItemProps {
  item: OrderItem
  selected: boolean
  onToggle: () => void
  onUpdateQty: (id: string, qty: number) => void
  onRemove: (id: string) => void
  onDuplicate: (id: string) => void
}

const STATUS_CLASSES: Record<string, string> = {
  pendiente: 'border-l-zinc-500',
  en_preparacion: 'border-l-amber-500',
  listo: 'border-l-green-500',
  entregado: 'border-l-blue-500',
}

const formatCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

export function TicketItem({ item, selected, onToggle, onUpdateQty, onRemove, onDuplicate }: TicketItemProps) {
  const borderColor = STATUS_CLASSES[item.status] || 'border-l-zinc-500'

  return (
    <div className={`px-3 py-2 border-l-4 ${borderColor} hover:bg-zinc-800/50 transition-colors group relative
      ${selected ? 'bg-zinc-800/80 ring-1 ring-emerald-500/30' : ''}
      ${item.status === 'entregado' ? 'opacity-50' : ''}`}
    >
      <div className="flex items-start gap-2">
        {/* Checkbox */}
        <button onClick={onToggle} className="mt-0.5 shrink-0 text-zinc-500 hover:text-emerald-400 transition-colors">
          {selected
            ? <CheckSquare className="h-4 w-4 text-emerald-400" />
            : <Square className="h-4 w-4" />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-semibold text-zinc-200 truncate">
              {item.quantity}x {item.menuItemName}
            </span>
            <span className="text-xs font-bold text-zinc-400 shrink-0">
              {formatCOP(item.subtotal)}
            </span>
          </div>

          {item.itemNotes && (
            <div className="text-[10px] text-zinc-500 mt-0.5 truncate italic">
              {item.itemNotes}
            </div>
          )}

          {item.originalPrice && item.unitPrice < item.originalPrice && (
            <div className="text-[10px] text-amber-500 mt-0.5">
              Descuento: {formatCOP(item.originalPrice - item.unitPrice)}
            </div>
          )}

          {/* Status */}
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold
              ${item.status === 'pendiente' ? 'bg-zinc-700 text-zinc-400' : ''}
              ${item.status === 'en_preparacion' ? 'bg-amber-500/20 text-amber-400' : ''}
              ${item.status === 'listo' ? 'bg-green-500/20 text-green-400' : ''}
              ${item.status === 'entregado' ? 'bg-blue-500/20 text-blue-400' : ''}`}
            >
              {item.status === 'pendiente' ? '○ Pendiente'
                : item.status === 'en_preparacion' ? '🔵 Preparando'
                : item.status === 'listo' ? '🟢 Listo'
                : item.status === 'entregado' ? '⚫ Entregado' : item.status}
            </span>
          </div>
        </div>

        {/* Actions (visible on hover) */}
        <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <div className="flex items-center gap-0.5">
            <button onClick={() => onUpdateQty(item.id, Math.max(1, item.quantity - 1))}
              className="h-5 w-5 flex items-center justify-center rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-400">
              <Minus className="h-2.5 w-2.5" />
            </button>
            <span className="text-[10px] font-bold text-zinc-400 w-4 text-center">{item.quantity}</span>
            <button onClick={() => onUpdateQty(item.id, item.quantity + 1)}
              className="h-5 w-5 flex items-center justify-center rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-400">
              <Plus className="h-2.5 w-2.5" />
            </button>
          </div>
          <div className="flex items-center gap-0.5 justify-end">
            <button onClick={() => onDuplicate(item.id)}
              className="h-5 w-5 flex items-center justify-center rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-400"
              title="Duplicar">
              <Copy className="h-2.5 w-2.5" />
            </button>
            <button onClick={() => onRemove(item.id)}
              className="h-5 w-5 flex items-center justify-center rounded bg-zinc-700 hover:bg-red-600 text-zinc-400 hover:text-white"
              title="Eliminar">
              <Trash2 className="h-2.5 w-2.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
