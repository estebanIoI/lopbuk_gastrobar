'use client'

import { Star, TrendingUp, Clock, Tag, AlertTriangle, Package } from 'lucide-react'

export type QuickFilter = 'all' | 'favorites' | 'bestsellers' | 'recent' | 'promos' | 'lowstock' | 'outofstock'

interface QuickFiltersProps {
  active: QuickFilter
  onSelect: (filter: QuickFilter) => void
  counts: Record<QuickFilter, number>
}

const FILTERS: { key: QuickFilter; label: string; icon: React.ReactNode; color: string }[] = [
  { key: 'all', label: 'Todos', icon: <Package className="h-3 w-3" />, color: 'text-zinc-300' },
  { key: 'favorites', label: 'Favoritos', icon: <Star className="h-3 w-3" />, color: 'text-amber-400' },
  { key: 'bestsellers', label: '+Vendidos', icon: <TrendingUp className="h-3 w-3" />, color: 'text-emerald-400' },
  { key: 'recent', label: 'Recientes', icon: <Clock className="h-3 w-3" />, color: 'text-blue-400' },
  { key: 'promos', label: 'Promos', icon: <Tag className="h-3 w-3" />, color: 'text-purple-400' },
  { key: 'lowstock', label: 'Stock bajo', icon: <AlertTriangle className="h-3 w-3" />, color: 'text-orange-400' },
  { key: 'outofstock', label: 'Agotado', icon: <AlertTriangle className="h-3 w-3" />, color: 'text-red-400' },
]

export function QuickFilters({ active, onSelect, counts }: QuickFiltersProps) {
  return (
    <div className="flex items-center gap-1 px-3 py-1.5 bg-zinc-900/50 border-b border-zinc-800 overflow-x-auto shrink-0 no-scrollbar">
      {FILTERS.map(f => {
        const isActive = active === f.key
        const count = counts[f.key]
        return (
          <button
            key={f.key}
            onClick={() => onSelect(f.key)}
            className={`shrink-0 h-7 px-2.5 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1.5
              ${isActive
                ? 'bg-zinc-700 text-zinc-100 ring-1 ring-zinc-500/40'
                : 'bg-zinc-800/50 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}`}
          >
            <span className={f.color}>{f.icon}</span>
            {f.label}
            {count > 0 && (
              <span className={`text-[10px] ${isActive ? 'text-zinc-400' : 'text-zinc-600'}`}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
