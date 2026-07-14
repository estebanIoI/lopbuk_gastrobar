'use client'

import { Search, X, ChefHat, GlassWater, FileText, Banknote, TableProperties, CheckSquare } from 'lucide-react'

interface PosTopBarProps {
  onDone: () => void
  onSearch: (q: string) => void
  searchQuery: string
  onSendKitchen: () => void
  onSendBar: () => void
  onPrintBill: () => void
  onOpenPayment: () => void
  onOpenTableMap: () => void
  selectedOrder: any | null
  selectedCount: number
  onSendSelected: () => void
}

export function PosTopBar({
  onDone, onSearch, searchQuery, onSendKitchen, onSendBar,
  onPrintBill, onOpenPayment, onOpenTableMap, selectedOrder,
  selectedCount, onSendSelected,
}: PosTopBarProps) {
  return (
    <div className="h-14 bg-zinc-900 border-b border-zinc-800 flex items-center gap-2 px-3 shrink-0">
      {/* Done */}
      <button onClick={onDone}
        className="h-10 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-semibold transition-colors">
        Done
      </button>

      {/* Search */}
      <div className="flex-1 relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => onSearch(e.target.value)}
          placeholder="Buscar o PLU..."
          className="w-full h-10 pl-9 pr-3 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100
            placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
        />
        {searchQuery && (
          <button onClick={() => onSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Table name */}
      {selectedOrder && (
        <div className="px-3 py-1.5 bg-zinc-800 rounded-lg text-sm font-mono font-semibold text-amber-400">
          Mesa {selectedOrder.tableNumber}
        </div>
      )}

      <div className="flex-1" />

      {/* Selected count */}
      {selectedCount > 0 && (
        <button onClick={onSendSelected}
          className="h-10 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
          title="Enviar selección">
          <CheckSquare className="h-4 w-4" />
          {selectedCount}
        </button>
      )}

      {/* Action buttons */}
      <button onClick={onSendKitchen}
        disabled={!selectedOrder}
        className="h-10 px-4 bg-red-700 hover:bg-red-600 text-white rounded-lg text-sm font-bold flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        title="Enviar a Cocina">
        <ChefHat className="h-4 w-4" /> COCINA
      </button>

      <button onClick={onSendBar}
        disabled={!selectedOrder}
        className="h-10 px-4 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-sm font-bold flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        title="Enviar a Bar">
        <GlassWater className="h-4 w-4" /> BAR
      </button>

      <button onClick={onPrintBill}
        disabled={!selectedOrder}
        className="h-10 px-4 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-bold flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        title="Imprimir pre-cuenta">
        <FileText className="h-4 w-4" /> CUENTA
      </button>

      <button onClick={onOpenPayment}
        disabled={!selectedOrder}
        className="h-10 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        title="Cobrar">
        <Banknote className="h-4 w-4" /> COBRAR
      </button>

      {/* Table map */}
      <button onClick={onOpenTableMap}
        className="h-10 w-10 bg-zinc-800 hover:bg-zinc-700 rounded-lg flex items-center justify-center transition-colors"
        title="Mapa de mesas">
        <TableProperties className="h-5 w-5 text-zinc-400" />
      </button>
    </div>
  )
}
