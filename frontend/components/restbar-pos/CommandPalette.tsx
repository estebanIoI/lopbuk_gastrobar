'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, ArrowRight, Table2, Package, Banknote, Printer, FileText, RefreshCw, X } from 'lucide-react'
import type { PosTable, MenuItem, Order } from './PosShell'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  tables: PosTable[]
  menu: MenuItem[]
  selectedOrder: Order | null
  onOpenTable: (tableId: string) => void
  onOpenPayment: () => void
  onPrintBill: () => void
  onRepeatLast: () => void
  onSearchProduct: (sku: string) => void
}

interface CommandItem {
  id: string
  label: string
  description: string
  icon: React.ReactNode
  category: string
  action: () => void
}

export function CommandPalette({
  open, onClose, tables, menu, selectedOrder,
  onOpenTable, onOpenPayment, onPrintBill, onRepeatLast, onSearchProduct,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const results = useRef<CommandItem[]>([])

  const buildResults = useCallback(() => {
    const items: CommandItem[] = []
    const q = query.toLowerCase().trim()

    if (!q) {
      // Quick actions when no query
      if (selectedOrder) {
        items.push({ id: 'pay', label: 'Cobrar', description: `Mesa ${selectedOrder.tableNumber}`, icon: <Banknote className="h-4 w-4" />, category: 'Acciones', action: () => { onOpenPayment(); onClose() } })
        items.push({ id: 'print', label: 'Imprimir pre-cuenta', description: selectedOrder.orderNumber, icon: <Printer className="h-4 w-4" />, category: 'Acciones', action: () => { onPrintBill(); onClose() } })
        items.push({ id: 'repeat', label: 'Repetir última orden', description: '', icon: <RefreshCw className="h-4 w-4" />, category: 'Acciones', action: () => { onRepeatLast(); onClose() } })
      }
      // Show occupied tables
      tables.filter(t => t.status === 'ocupada' && t.activeOrder).slice(0, 5).forEach(t => {
        items.push({ id: `table-${t.id}`, label: `Mesa ${t.number}`, description: `${t.activeOrder!.orderNumber} · ${t.capacity}p`, icon: <Table2 className="h-4 w-4" />, category: 'Mesas', action: () => { onOpenTable(t.id); onClose() } })
      })
    } else {
      // Search tables
      tables.filter(t => t.number.toLowerCase().includes(q) || (t.area && t.area.toLowerCase().includes(q))).slice(0, 5).forEach(t => {
        items.push({ id: `table-${t.id}`, label: `Mesa ${t.number}`, description: `${t.status} · ${t.capacity}p`, icon: <Table2 className="h-4 w-4" />, category: 'Mesas', action: () => { onOpenTable(t.id); onClose() } })
      })

      // Search products
      menu.filter(m => {
        const name = m.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        const sku = (m.sku || '').toLowerCase()
        return name.includes(q) || sku.includes(q)
      }).slice(0, 8).forEach(m => {
        items.push({ id: `prod-${m.id}`, label: m.name, description: formatCOP(m.price), icon: <Package className="h-4 w-4" />, category: 'Productos', action: () => { onSearchProduct(m.sku); onClose() } })
      })

      // Global actions
      if (selectedOrder) {
        items.push({ id: 'pay', label: 'Cobrar comanda', description: selectedOrder.orderNumber, icon: <Banknote className="h-4 w-4" />, category: 'Acciones', action: () => { onOpenPayment(); onClose() } })
      }
    }

    results.current = items
    return items
  }, [query])

  const items = buildResults()
  const maxIdx = Math.max(0, items.length - 1)
  const safeIdx = Math.min(selectedIdx, maxIdx)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, maxIdx)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && items[safeIdx]) { e.preventDefault(); items[safeIdx].action() }
    else if (e.key === 'Escape') { onClose() }
  }

  // Scroll selected into view
  useEffect(() => {
    if (listRef.current) {
      const el = listRef.current.querySelector(`[data-cmd-idx="${safeIdx}"]`) as HTMLElement
      el?.scrollIntoView({ block: 'nearest' })
    }
  }, [safeIdx])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[500] bg-black/60 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="bg-zinc-800 border border-zinc-600 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-700">
          <Search className="h-5 w-5 text-zinc-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIdx(0) }}
            onKeyDown={handleKeyDown}
            placeholder="Buscar mesa, producto o acción..."
            className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400 font-mono">esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-72 overflow-y-auto p-1">
          {items.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-zinc-500">
              Sin resultados para "{query}"
            </div>
          )}
          {items.map((item, idx) => (
            <button
              key={item.id}
              data-cmd-idx={idx}
              onClick={item.action}
              onMouseEnter={() => setSelectedIdx(idx)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors
                ${idx === safeIdx ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-750'}`}
            >
              <span className="shrink-0">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{item.label}</div>
                {item.description && (
                  <div className="text-[11px] text-zinc-500 truncate">{item.description}</div>
                )}
              </div>
              <span className="text-[10px] text-zinc-600">{item.category}</span>
              <ArrowRight className={`h-3 w-3 shrink-0 ${idx === safeIdx ? 'text-zinc-300' : 'opacity-0'}`} />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const formatCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
