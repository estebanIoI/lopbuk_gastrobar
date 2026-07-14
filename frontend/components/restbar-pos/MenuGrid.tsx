'use client'

import { useRef, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { MenuTile } from './MenuTile'
import type { MenuItem } from './PosShell'

interface MenuGridProps {
  items: MenuItem[]
  onItemClick: (item: MenuItem) => void
  onItemDoubleClick?: (item: MenuItem) => void
  onItemLongPress?: (item: MenuItem) => void
  favoriteIds?: Set<string>
  onToggleFavorite?: (itemId: string) => void
  itemPopularity?: Record<string, number>
  cols?: number
  seat: number
  course: number
}

export function MenuGrid({ items, onItemClick, onItemDoubleClick, onItemLongPress, favoriteIds, onToggleFavorite, itemPopularity, cols = 4, seat, course }: MenuGridProps) {
  const parentRef = useRef<HTMLDivElement>(null)

  const rows = useMemo(() => {
    const r: MenuItem[][] = []
    for (let i = 0; i < items.length; i += cols) {
      r.push(items.slice(i, i + cols))
    }
    return r
  }, [items, cols])

  const gridClass = cols === 6 ? 'grid-cols-6' : cols === 5 ? 'grid-cols-5' : 'grid-cols-4'

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120,
    overscan: 3,
  })

  return (
    <div ref={parentRef} className="flex-1 overflow-auto p-2 min-h-0">
      {items.length === 0 && (
        <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
          Sin resultados
        </div>
      )}
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map(virtualRow => {
          const row = rows[virtualRow.index]
          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className={`grid ${gridClass} gap-2`}
            >
              {row.map(item => (
                <MenuTile
                  key={item.id}
                  item={item}
                  onClick={() => onItemClick(item)}
                  onDoubleClick={onItemDoubleClick ? () => onItemDoubleClick(item) : undefined}
                  onLongPress={onItemLongPress ? () => onItemLongPress(item) : undefined}
                  isFavorite={favoriteIds?.has(item.id)}
                  onToggleFavorite={onToggleFavorite ? () => onToggleFavorite(item.id) : undefined}
                  popularity={itemPopularity?.[item.id]}
                />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
