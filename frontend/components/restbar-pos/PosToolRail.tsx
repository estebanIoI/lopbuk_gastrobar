'use client'

import { useState } from 'react'
import { Hash, DollarSign, StickyNote, Users, Layers, ReceiptText, Trash2, Copy, MoveRight, RefreshCw, UserPlus, Send, RotateCcw, ArrowRightLeft } from 'lucide-react'
import type { OrderItem } from './PosShell'

interface PosToolRailProps {
  hasOrder: boolean
  selectedCount: number
  selectedItem: OrderItem | null

  // Table-level (no item selected)
  activeSeat: number
  onSetSeat: (seat: number) => void
  activeCourse: number
  onSetCourse: (course: number) => void
  onPrintBill: () => void
  onRepeatLast: () => void

  // Item-level (1 item selected)
  pendingQuantity: number | null
  onSetQuantity: (q: number | null) => void
  onSetPrice: (p: number | null) => void
  onMoveSeat: (itemId: string, toSeat: number) => void
  onDuplicate: (itemId: string) => void
  onRemoveItem: (itemId: string) => void
  onMoveToTable: (itemId: string) => void

  // Batch-level (N>1 items)
  onSendSelected: () => void
  onDeleteSelected: () => void
}

export function PosToolRail({
  hasOrder, selectedCount, selectedItem,
  activeSeat, onSetSeat, activeCourse, onSetCourse, onPrintBill, onRepeatLast,
  pendingQuantity, onSetQuantity, onSetPrice,
  onMoveSeat, onDuplicate, onRemoveItem, onMoveToTable,
  onSendSelected, onDeleteSelected,
}: PosToolRailProps) {
  const [showQuantity, setShowQuantity] = useState(false)
  const [showPrice, setShowPrice] = useState(false)
  const [showMoveSeat, setShowMoveSeat] = useState(false)
  const [qtyInput, setQtyInput] = useState('')
  const [priceInput, setPriceInput] = useState('')
  const [moveSeatInput, setMoveSeatInput] = useState('')

  const applyQuantity = () => {
    const n = parseInt(qtyInput) || null
    onSetQuantity(n)
    setShowQuantity(false)
    setQtyInput('')
  }

  const applyPrice = () => {
    const n = parseFloat(priceInput) || null
    onSetPrice(n)
    setShowPrice(false)
    setPriceInput('')
  }

  const applyMoveSeat = () => {
    const n = parseInt(moveSeatInput)
    if (n && selectedItem) {
      onMoveSeat(selectedItem.id, n)
    }
    setShowMoveSeat(false)
    setMoveSeatInput('')
  }

  if (!hasOrder) {
    return (
      <div className="w-16 bg-zinc-900 border-r border-zinc-800 flex flex-col items-center justify-center shrink-0">
        <span className="text-[10px] text-zinc-600 text-center px-1 leading-tight">Abre una mesa</span>
      </div>
    )
  }

  // ── Context: batch selection (2+ items) ──────────────────────────────────
  if (selectedCount > 1) {
    return (
      <div className="w-16 bg-zinc-900 border-r border-zinc-800 flex flex-col items-center gap-2 py-2 shrink-0">
        <div className="px-2 w-full">
          <button onClick={onSendSelected}
            className="w-full aspect-square rounded-lg bg-emerald-600/30 hover:bg-emerald-600/40 flex flex-col items-center justify-center gap-0.5 transition-colors text-emerald-400">
            <Send className="h-4 w-4" />
            <span className="text-[10px] font-bold">{selectedCount}</span>
          </button>
        </div>
        <div className="px-2 w-full">
          <button onClick={onDeleteSelected}
            className="w-full aspect-square rounded-lg bg-red-600/20 hover:bg-red-600/40 flex flex-col items-center justify-center gap-0.5 transition-colors text-red-400">
            <Trash2 className="h-4 w-4" />
            <span className="text-[10px] font-bold">{selectedCount}</span>
          </button>
        </div>
      </div>
    )
  }

  // ── Context: table-level (no item selected) ──────────────────────────────
  if (selectedCount === 0) {
    return (
      <div className="w-16 bg-zinc-900 border-r border-zinc-800 flex flex-col items-center gap-1 py-2 shrink-0">
        {/* Seat selector */}
        <div className="px-2 w-full">
          <button onClick={() => onSetSeat(activeSeat >= 8 ? 1 : activeSeat + 1)}
            title={`Comensal ${activeSeat} · a qué persona de la mesa se le carga el próximo producto (toca para cambiar)`}
            className="w-full aspect-square rounded-lg bg-zinc-800 hover:bg-zinc-700 flex flex-col items-center justify-center gap-0.5 transition-colors">
            <Users className="h-4 w-4 text-zinc-400" />
            <span className="text-[9px] font-bold text-zinc-300 leading-none">Pers.{activeSeat}</span>
          </button>
        </div>

        {/* Course selector */}
        <div className="px-2 w-full">
          <button onClick={() => onSetCourse(activeCourse >= 3 ? 1 : activeCourse + 1)}
            title={`Tiempo ${activeCourse} · en qué momento sale el plato (1º entrada, 2º fuerte, 3º postre). Toca para cambiar`}
            className="w-full aspect-square rounded-lg bg-zinc-800 hover:bg-zinc-700 flex flex-col items-center justify-center gap-0.5 transition-colors">
            <Layers className="h-4 w-4 text-zinc-400" />
            <span className="text-[9px] font-bold text-zinc-300 leading-none">Tiempo{activeCourse}</span>
          </button>
        </div>

        <div className="w-8 h-px bg-zinc-800 my-1" />

        {/* Quantity pre-set */}
        <div className="px-2 w-full">
          <button onClick={() => setShowQuantity(!showQuantity)}
            title="Cantidad · fija cuántas unidades tendrá el próximo producto que toques"
            className={`w-full aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 transition-colors
              ${pendingQuantity != null ? 'bg-emerald-600/30 text-emerald-400' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'}`}>
            <Hash className="h-4 w-4" />
            <span className="text-[9px] font-bold leading-none">{pendingQuantity ? `x${pendingQuantity}` : 'Cant.'}</span>
          </button>
        </div>

        {/* Price override pre-set */}
        <div className="px-2 w-full">
          <button onClick={() => setShowPrice(!showPrice)}
            title="Precio manual · sobrescribe el precio del próximo producto (ej. cortesía o ajuste)"
            className="w-full aspect-square rounded-lg bg-zinc-800 hover:bg-zinc-700 flex flex-col items-center justify-center gap-0.5 transition-colors text-zinc-400">
            <DollarSign className="h-4 w-4" />
            <span className="text-[9px] font-bold leading-none">Precio</span>
          </button>
        </div>

        <div className="w-8 h-px bg-zinc-800 my-1" />

        {/* Print bill */}
        <div className="px-2 w-full">
          <button onClick={onPrintBill}
            title="Imprimir la pre-cuenta para que el cliente revise su consumo"
            className="w-full aspect-square rounded-lg bg-zinc-800 hover:bg-zinc-700 flex flex-col items-center justify-center gap-0.5 transition-colors text-zinc-400">
            <ReceiptText className="h-4 w-4" />
            <span className="text-[9px] font-bold leading-none">Cuenta</span>
          </button>
        </div>

        {/* Repeat last order */}
        <div className="px-2 w-full">
          <button onClick={onRepeatLast}
            title="Repetir · agrega otra vez el último producto que pusiste en la comanda"
            className="w-full aspect-square rounded-lg bg-zinc-800 hover:bg-zinc-700 flex flex-col items-center justify-center gap-0.5 transition-colors text-zinc-400">
            <RotateCcw className="h-4 w-4" />
            <span className="text-[9px] font-bold leading-none">Repetir</span>
          </button>
        </div>

        {/* Clear pending */}
        {pendingQuantity != null && (
          <div className="px-2 w-full">
            <button onClick={() => onSetQuantity(null)}
              className="w-full aspect-square rounded-lg bg-red-600/20 hover:bg-red-600/30 flex items-center justify-center transition-colors text-red-400">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Quantity modal */}
        {showQuantity && (
          <NumPadModal
            value={qtyInput}
            onChange={setQtyInput}
            onApply={applyQuantity}
            onClose={() => setShowQuantity(false)}
            onClear={() => { onSetQuantity(null); setShowQuantity(false); setQtyInput('') }}
            label="Cantidad"
          />
        )}
        {showPrice && (
          <NumPadModal
            value={priceInput}
            onChange={setPriceInput}
            onApply={applyPrice}
            onClose={() => setShowPrice(false)}
            onClear={() => { onSetPrice(null); setShowPrice(false); setPriceInput('') }}
            label="Precio manual"
            placeholder="0"
          />
        )}
      </div>
    )
  }

  // ── Context: single item selected ────────────────────────────────────────
  return (
    <div className="w-16 bg-zinc-900 border-r border-zinc-800 flex flex-col items-center gap-1 py-2 shrink-0">
      {/* Quantity */}
      <div className="px-2 w-full">
        <button onClick={() => setShowQuantity(!showQuantity)}
          className="w-full aspect-square rounded-lg bg-zinc-800 hover:bg-zinc-700 flex flex-col items-center justify-center gap-0.5 transition-colors text-zinc-400">
          <Hash className="h-4 w-4" />
          <span className="text-[10px] font-bold">{selectedItem ? `x${selectedItem.quantity}` : 'Qty'}</span>
        </button>
      </div>

      {/* Move seat */}
      <div className="px-2 w-full">
        <button onClick={() => setShowMoveSeat(!showMoveSeat)}
          className="w-full aspect-square rounded-lg bg-zinc-800 hover:bg-zinc-700 flex flex-col items-center justify-center gap-0.5 transition-colors text-zinc-400">
          <MoveRight className="h-4 w-4" />
          <span className="text-[10px] font-bold">Mover</span>
        </button>
      </div>

      {/* Duplicate */}
      <div className="px-2 w-full">
        <button onClick={() => selectedItem && onDuplicate(selectedItem.id)}
          className="w-full aspect-square rounded-lg bg-zinc-800 hover:bg-zinc-700 flex flex-col items-center justify-center gap-0.5 transition-colors text-zinc-400">
          <Copy className="h-4 w-4" />
          <span className="text-[10px] font-bold">Dup</span>
        </button>
      </div>

      {/* Price override */}
      <div className="px-2 w-full">
        <button onClick={() => setShowPrice(!showPrice)}
          className="w-full aspect-square rounded-lg bg-zinc-800 hover:bg-zinc-700 flex flex-col items-center justify-center gap-0.5 transition-colors text-zinc-400">
          <DollarSign className="h-4 w-4" />
          <span className="text-[10px] font-bold">Precio</span>
        </button>
      </div>

      <div className="w-8 h-px bg-zinc-800 my-1" />

      {/* Move to table */}
      <div className="px-2 w-full">
        <button onClick={() => selectedItem && onMoveToTable(selectedItem.id)}
          className="w-full aspect-square rounded-lg bg-zinc-800 hover:bg-zinc-700 flex flex-col items-center justify-center gap-0.5 transition-colors text-zinc-400">
          <ArrowRightLeft className="h-4 w-4" />
          <span className="text-[10px] font-bold">Mover</span>
        </button>
      </div>

      {/* Delete */}
      <div className="px-2 w-full">
        <button onClick={() => selectedItem && onRemoveItem(selectedItem.id)}
          className="w-full aspect-square rounded-lg bg-red-600/20 hover:bg-red-600/40 flex flex-col items-center justify-center gap-0.5 transition-colors text-red-400">
          <Trash2 className="h-4 w-4" />
          <span className="text-[10px] font-bold">Elim</span>
        </button>
      </div>

      {/* Quantity modal */}
      {showQuantity && (
        <NumPadModal
          value={qtyInput}
          onChange={setQtyInput}
          onApply={applyQuantity}
          onClose={() => setShowQuantity(false)}
          onClear={() => { onSetQuantity(null); setShowQuantity(false); setQtyInput('') }}
          label="Cantidad"
        />
      )}
      {showPrice && (
        <NumPadModal
          value={priceInput}
          onChange={setPriceInput}
          onApply={applyPrice}
          onClose={() => setShowPrice(false)}
          onClear={() => { onSetPrice(null); setShowPrice(false); setPriceInput('') }}
          label="Precio manual"
          placeholder="0"
        />
      )}
      {showMoveSeat && (
        <NumPadModal
          value={moveSeatInput}
          onChange={setMoveSeatInput}
          onApply={applyMoveSeat}
          onClose={() => setShowMoveSeat(false)}
          onClear={() => { setShowMoveSeat(false); setMoveSeatInput('') }}
          label="Mover a Seat #"
          placeholder="1"
          maxDigits={1}
        />
      )}
    </div>
  )
}

function NumPadModal({ value, onChange, onApply, onClose, onClear, label, placeholder, maxDigits }: {
  value: string; onChange: (v: string) => void; onApply: () => void; onClose: () => void;
  onClear: () => void; label?: string; placeholder?: string; maxDigits?: number;
}) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center" onClick={onClose}>
      <div className="bg-zinc-800 border border-zinc-600 rounded-xl p-4 w-64 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="text-sm font-semibold text-zinc-300 mb-2">{label || 'Cantidad'}</div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[1,2,3,4,5,6,7,8,9].map(n => (
            <button key={n} onClick={() => { if (!maxDigits || value.length < maxDigits) onChange(value + String(n)) }}
              className="h-10 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm font-bold text-zinc-200 transition-colors">
              {n}
            </button>
          ))}
          <button onClick={() => onChange(value.slice(0, -1))}
            className="h-10 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm font-bold text-zinc-200 transition-colors">
            &larr;
          </button>
          <button onClick={() => onChange('0')}
            className="h-10 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm font-bold text-zinc-200 transition-colors">
            0
          </button>
          <button onClick={onClear}
            className="h-10 bg-red-600/30 hover:bg-red-600/50 rounded-lg text-sm font-bold text-red-300 transition-colors">
            C
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={onClear}
            className="flex-1 h-10 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm text-zinc-400 transition-colors">
            Limpiar
          </button>
          <button onClick={onApply}
            className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-bold text-white transition-colors">
            Aplicar
          </button>
        </div>
      </div>
    </div>
  )
}
