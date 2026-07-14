'use client'

import { useRef, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { MenuTile } from './MenuTile'
import type { MenuItem } from './PosShell'

interface MenuGridProps {
  items: MenuItem[]
  onItemClick: (item: MenuItem) => void
  seat: number
  course: number
}

const COLS = 4

export function MenuGrid({ items, onItemClick, seat, course }: MenuGridProps) {
  const parentRef = useRef<HTMLDivElement>(null)

  const rows = useMemo(() => {
    const r: MenuItem[][] = []
    for (let i = 0; i < items.length; i += COLS) {
      r.push(items.slice(i, i + COLS))
    }
    return r
  }, [items])

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
              className="grid grid-cols-4 gap-2"
            >
              {row.map(item => (
                <MenuTile
                  key={item.id}
                  item={item}
                  onClick={() => onItemClick(item)}
                />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
