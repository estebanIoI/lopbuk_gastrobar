'use client'

import { useRef, useEffect, useMemo } from 'react'
import type { PosTable } from './PosShell'
import { Clock, Users, ChefHat, GlassWater } from 'lucide-react'

interface TableTabsProps {
  tables: PosTable[]
  activeTableId: string | null
  onSelect: (tableId: string) => void
}

const STATUS_DEF: Record<string, { color: string; bg: string; border: string; label: string }> = {
  libre:     { color: 'text-green-400',   bg: 'bg-green-500/10',   border: 'border-green-500/40', label: 'Libre' },
  ocupada:   { color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/40', label: 'Ocupada' },
  reservada: { color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/40',  label: 'Reservada' },
}

const formatCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

function elapsedMinutes(openedAt: string | null | undefined): string {
  if (!openedAt) return ''
  const ms = Date.now() - new Date(openedAt).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `${mins}min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h ${m}m`
}

export function TableTabs({ tables, activeTableId, onSelect }: TableTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const sorted = useMemo(() => {
    // Ocupadas primero, luego reservadas, luego libres
    const order = { ocupada: 0, reservada: 1, libre: 2 }
    return [...tables]
      .filter(t => t.status !== 'inactiva')
      .sort((a, b) => (order[a.status as keyof typeof order] ?? 9) - (order[b.status as keyof typeof order] ?? 9))
  }, [tables])

  useEffect(() => {
    if (scrollRef.current && activeTableId) {
      const el = scrollRef.current.querySelector(`[data-table="${activeTableId}"]`) as HTMLElement
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }, [activeTableId])

  return (
    <div ref={scrollRef} className="h-16 bg-zinc-900/80 border-b border-zinc-800 flex items-center gap-1.5 px-2 overflow-x-auto shrink-0 no-scrollbar">
      {sorted.map(t => {
        const def = STATUS_DEF[t.status] || STATUS_DEF.libre
        const isActive = t.id === activeTableId
        const isOccupied = t.status === 'ocupada' && t.activeOrder
        const areaLabel = (!isOccupied || t.capacity < 6) ? null : 'cocina' // simplified for now

        return (
          <button
            key={t.id}
            data-table={t.id}
            onClick={() => onSelect(t.id)}
            className={`shrink-0 h-12 min-w-[88px] px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex flex-col justify-center gap-0.5 border
              ${isActive
                ? 'bg-amber-500/25 border-amber-400 text-amber-50 ring-2 ring-amber-400/70 scale-[1.04] shadow-lg shadow-amber-900/30'
                : `${def.bg} ${def.border} hover:brightness-125`}`}
          >
            {/* Top row: number + status dot */}
            <div className="flex items-center justify-between">
              <span className={`text-sm font-bold ${isActive ? 'text-amber-100' : def.color}`}>
                {isActive && '▶ '}{t.number}
              </span>
              <span className={`w-1.5 h-1.5 rounded-full ${isOccupied ? 'bg-amber-400' : t.status === 'reservada' ? 'bg-blue-400' : 'bg-green-400'}`} />
            </div>

            {/* Middle row: guests + time or status label */}
            {isOccupied ? (
              <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                <span className="flex items-center gap-0.5"><Users className="h-2.5 w-2.5" />{t.capacity}</span>
                {t.activeOrder?.openedAt && (
                  <span className="flex items-center gap-0.5 text-amber-400/70"><Clock className="h-2.5 w-2.5" />{elapsedMinutes(t.activeOrder.openedAt)}</span>
                )}
                {t.activeOrder && t.activeOrder.itemsCount > 0 && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-400 rounded-full px-1.5 py-px font-bold">{t.activeOrder.itemsCount}</span>
                )}
              </div>
            ) : (
              <div className="text-[10px] text-zinc-500">{def.label}</div>
            )}

            {/* Bottom row: total */}
            {isOccupied && t.activeOrder && (
              <div className="text-[11px] font-bold text-zinc-300 truncate">
                {formatCOP(t.activeOrder.total)}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
