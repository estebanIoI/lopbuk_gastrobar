'use client'

import { useRef, useEffect } from 'react'

interface CategoryTabsProps {
  categories: string[]
  categoryCounts: Record<string, number>
  selected: string | null
  onSelect: (cat: string | null) => void
}

const CAT_ICONS: Record<string, string> = {
  Bebidas: '🍹', Entradas: '🥗', Sushi: '🍣', Carnes: '🥩',
  Postres: '🍰', Hamburguesas: '🍔', Pizzas: '🍕', Ensaladas: '🥬',
  Sopas: '🍜', Platos: '🍽️', '': '📋',
}

export function CategoryTabs({ categories, categoryCounts, selected, onSelect }: CategoryTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const allCount = Object.values(categoryCounts).reduce((a, b) => a + b, 0)

  useEffect(() => {
    if (scrollRef.current && selected) {
      const el = scrollRef.current.querySelector(`[data-cat="${selected}"]`) as HTMLElement
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }, [selected])

  return (
    <div ref={scrollRef} className="h-14 bg-zinc-900 border-t border-zinc-800 flex items-center gap-1 px-2 overflow-x-auto shrink-0 no-scrollbar">
      <button
        onClick={() => onSelect(null)}
        data-cat="all"
        className={`shrink-0 h-10 px-3 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5
          ${!selected ? 'bg-zinc-700 text-zinc-100' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-750'}`}>
        <span className="text-sm">📋</span>
        Todo ({allCount})
      </button>
      {categories.map(cat => (
        <button
          key={cat}
          onClick={() => onSelect(selected === cat ? null : cat)}
          data-cat={cat}
          className={`shrink-0 h-10 px-3 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5
            ${selected === cat ? 'bg-zinc-700 text-zinc-100' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-750'}`}>
          <span className="text-sm">{CAT_ICONS[cat] || '📋'}</span>
          {cat} ({categoryCounts[cat] || 0})
        </button>
      ))}
    </div>
  )
}
