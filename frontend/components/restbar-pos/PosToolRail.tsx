'use client'

import { useState } from 'react'
import { Hash, DollarSign, StickyNote, Users, Layers, UserPlus, Trash2, Copy, RefreshCw } from 'lucide-react'

interface PosToolRailProps {
  pendingQuantity: number | null
  onSetQuantity: (q: number | null) => void
  onSetPrice: (p: number | null) => void
  activeSeat: number
  onSetSeat: (seat: number) => void
  activeCourse: number
  onSetCourse: (course: number) => void
  onClearPending: () => void
}

export function PosToolRail({
  pendingQuantity, onSetQuantity, onSetPrice,
  activeSeat, onSetSeat, activeCourse, onSetCourse, onClearPending,
}: PosToolRailProps) {
  const [showQuantity, setShowQuantity] = useState(false)
  const [showPrice, setShowPrice] = useState(false)
  const [qtyInput, setQtyInput] = useState('')
  const [priceInput, setPriceInput] = useState('')

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

  const tools = [
    { label: 'Cantidad', icon: Hash, active: pendingQuantity != null,
      badge: pendingQuantity ? `x${pendingQuantity}` : null,
      onClick: () => setShowQuantity(!showQuantity) },
    { label: 'Precio', icon: DollarSign, active: false,
      onClick: () => setShowPrice(!showPrice) },
    { label: `Asiento ${activeSeat}`, icon: Users, active: true,
      badge: String(activeSeat),
      onClick: () => onSetSeat(activeSeat >= 8 ? 1 : activeSeat + 1) },
    { label: `Curso ${activeCourse}`, icon: Layers, active: true,
      badge: String(activeCourse),
      onClick: () => onSetCourse(activeCourse >= 3 ? 1 : activeCourse + 1) },
  ]

  return (
    <div className="w-16 bg-zinc-900 border-r border-zinc-800 flex flex-col items-center gap-1 py-2 shrink-0">
      {/* Seat selector */}
      <div className="px-2 w-full">
        <button onClick={() => onSetSeat(activeSeat >= 8 ? 1 : activeSeat + 1)}
          className="w-full aspect-square rounded-lg bg-zinc-800 hover:bg-zinc-700 flex flex-col items-center justify-center gap-0.5 transition-colors">
          <Users className="h-4 w-4 text-zinc-400" />
          <span className="text-xs font-bold text-zinc-300">{activeSeat}</span>
        </button>
      </div>

      {/* Course selector */}
      <div className="px-2 w-full">
        <button onClick={() => onSetCourse(activeCourse >= 3 ? 1 : activeCourse + 1)}
          className="w-full aspect-square rounded-lg bg-zinc-800 hover:bg-zinc-700 flex flex-col items-center justify-center gap-0.5 transition-colors">
          <Layers className="h-4 w-4 text-zinc-400" />
          <span className="text-[10px] font-bold text-zinc-300">C{activeCourse}</span>
        </button>
      </div>

      <div className="w-8 h-px bg-zinc-800 my-1" />

      {/* Quantity */}
      <div className="px-2 w-full">
        <button onClick={() => setShowQuantity(!showQuantity)}
          className={`w-full aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 transition-colors
            ${pendingQuantity != null ? 'bg-emerald-600/30 text-emerald-400' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'}`}>
          <Hash className="h-4 w-4" />
          <span className="text-[10px] font-bold">{pendingQuantity ? `x${pendingQuantity}` : 'Qty'}</span>
        </button>
      </div>

      {/* Price */}
      <div className="px-2 w-full">
        <button onClick={() => setShowPrice(!showPrice)}
          className="w-full aspect-square rounded-lg bg-zinc-800 hover:bg-zinc-700 flex flex-col items-center justify-center gap-0.5 transition-colors text-zinc-400">
          <DollarSign className="h-4 w-4" />
          <span className="text-[10px] font-bold">Precio</span>
        </button>
      </div>

      <div className="w-8 h-px bg-zinc-800 my-1" />

      {/* Clear pending */}
      {(pendingQuantity != null || false) && (
        <div className="px-2 w-full">
          <button onClick={onClearPending}
            className="w-full aspect-square rounded-lg bg-red-600/20 hover:bg-red-600/30 flex items-center justify-center transition-colors text-red-400">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Quantity modal */}
      {showQuantity && (
        <QuantityModal
          value={qtyInput}
          onChange={setQtyInput}
          onApply={applyQuantity}
          onClose={() => setShowQuantity(false)}
          onClear={() => { onSetQuantity(null); setShowQuantity(false); setQtyInput('') }}
        />
      )}

      {/* Price modal */}
      {showPrice && (
        <QuantityModal
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

function QuantityModal({ value, onChange, onApply, onClose, onClear, label, placeholder }: {
  value: string; onChange: (v: string) => void; onApply: () => void; onClose: () => void;
  onClear: () => void; label?: string; placeholder?: string;
}) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center" onClick={onClose}>
      <div className="bg-zinc-800 border border-zinc-600 rounded-xl p-4 w-64 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="text-sm font-semibold text-zinc-300 mb-2">{label || 'Cantidad'}</div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[1,2,3,4,5,6,7,8,9].map(n => (
            <button key={n} onClick={() => onChange(value + String(n))}
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
