'use client'

import type { PosTable } from './PosShell'
import { Clock, Users, AlertTriangle, ChefHat, Utensils, ReceiptText } from 'lucide-react'

interface LobbyDashboardProps {
  tables: PosTable[]
  openingTable: boolean
  loading?: boolean
  onSelect: (tableId: string) => void
}

const formatCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

function elapsedMinutes(openedAt: string | null | undefined): number {
  if (!openedAt) return 0
  return Math.floor((Date.now() - new Date(openedAt).getTime()) / 60000)
}

function elapsedLabel(mins: number): string {
  if (mins < 1) return 'ahora'
  if (mins < 60) return `${mins}min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h ${m}m`
}

function NeedsAttention({ table, mins }: { table: PosTable; mins: number }) {
  if (!table.activeOrder) return null
  // Red: > 60min waiting
  if (mins >= 60) return <span className="text-[10px] bg-red-500/30 text-red-300 rounded-full px-1.5 py-0.5 font-bold flex items-center gap-0.5"><AlertTriangle className="h-2.5 w-2.5" />{elapsedLabel(mins)}</span>
  // Orange: > 45min
  if (mins >= 45) return <span className="text-[10px] bg-orange-500/30 text-orange-300 rounded-full px-1.5 py-0.5 font-bold">{elapsedLabel(mins)}</span>
  // Normal
  return <span className="text-[10px] text-zinc-500">{elapsedLabel(mins)}</span>
}

export function LobbyDashboard({ tables, openingTable, loading, onSelect }: LobbyDashboardProps) {
  // Skeleton durante la carga inicial — se siente más rápido que un spinner
  // y evita el parpadeo de "0 ocupadas · 0 libres" con datos aún vacíos.
  if (loading && tables.length === 0) {
    return (
      <div className="flex-1 overflow-auto p-6 min-h-0 space-y-6">
        <div className="space-y-2">
          <div className="pos-skeleton h-6 w-28 rounded-md" />
          <div className="pos-skeleton h-4 w-56 rounded" />
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="pos-skeleton h-24 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  const occupied = tables
    .filter(t => t.status === 'ocupada' && t.activeOrder)
    .sort((a, b) => {
      const aMins = elapsedMinutes(a.activeOrder?.openedAt)
      const bMins = elapsedMinutes(b.activeOrder?.openedAt)
      // Most recent first (higher minutes = opened longer ago = needs attention)
      return bMins - aMins
    })

  const reserved = tables.filter(t => t.status === 'reservada')
  const free = tables.filter(t => t.status === 'libre')

  if (openingTable) {
    return (
      <div className="flex items-center justify-center gap-3 text-zinc-400 text-sm py-20">
        <span className="h-5 w-5 rounded-full border-2 border-zinc-600 border-t-emerald-400 animate-spin" />
        Abriendo comanda…
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto p-6 min-h-0 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-zinc-100">Salón</h2>
        <p className="text-sm text-zinc-400 mt-0.5">
          {occupied.length} ocupadas · {reserved.length} reservadas · {free.length} libres
        </p>
      </div>

      {/* Occupied */}
      {occupied.length > 0 && (
        <section>
          <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Ocupadas ({occupied.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {occupied.map(t => {
              const mins = elapsedMinutes(t.activeOrder?.openedAt)
              const isUrgent = mins >= 45
              return (
                <button key={t.id}
                  onClick={() => onSelect(t.id)}
                  className={`p-3 rounded-xl border text-left transition-all hover:scale-[1.02] hover:brightness-110 relative overflow-hidden
                    ${isUrgent ? 'border-red-500/50 bg-red-500/5 animate-pulse' : 'border-amber-500/30 bg-amber-500/5'}`}>
                  {/* Time progress bar */}
                  {t.activeOrder && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-800">
                      <div
                        className={`h-full transition-all duration-[30s] ${mins >= 60 ? 'bg-red-500' : mins >= 30 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(100, (mins / 90) * 100)}%` }}
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-zinc-100">{t.number}</span>
                    <NeedsAttention table={t} mins={mins} />
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                    <span className="flex items-center gap-0.5"><Users className="h-2.5 w-2.5" />{t.capacity}</span>
                    {t.activeOrder && t.activeOrder.itemsCount > 0 && (
                      <span className="text-amber-400 font-bold">{t.activeOrder.itemsCount} ítems</span>
                    )}
                  </div>
                  {t.activeOrder && (
                    <div className="mt-1.5 text-sm font-bold text-zinc-200">
                      {formatCOP(t.activeOrder.total)}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* Reserved */}
      {reserved.length > 0 && (
        <section>
          <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            Reservadas ({reserved.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {reserved.map(t => (
              <button key={t.id}
                onClick={() => onSelect(t.id)}
                className="p-3 rounded-xl border border-blue-500/30 bg-blue-500/5 text-left transition-all hover:scale-[1.02] hover:brightness-110">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-zinc-100">{t.number}</span>
                  <span className="text-[10px] text-blue-400 font-semibold">Reservada</span>
                </div>
                <div className="text-[11px] text-zinc-400">{t.capacity}p</div>
                {t.area && <div className="text-[10px] text-zinc-500 mt-0.5">{t.area}</div>}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Free */}
      {free.length > 0 && (
        <section>
          <h3 className="text-xs font-bold text-green-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            Libres ({free.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {free.map(t => (
              <button key={t.id}
                onClick={() => onSelect(t.id)}
                className="p-3 rounded-xl border border-green-500/20 bg-green-500/5 text-left transition-all hover:scale-[1.02] hover:brightness-110">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-zinc-100">{t.number}</span>
                  <span className="text-[10px] text-green-400 font-semibold">Libre</span>
                </div>
                <div className="text-[11px] text-zinc-400">{t.capacity}p</div>
                {t.area && <div className="text-[10px] text-zinc-500 mt-0.5">{t.area}</div>}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {occupied.length === 0 && reserved.length === 0 && free.length === 0 && (
        <div className="text-center py-16">
          <div className="text-4xl mb-3 opacity-30">🍽️</div>
          <p className="text-zinc-500 text-sm">No hay mesas configuradas</p>
          <p className="text-zinc-600 text-xs mt-1">Créalas en el módulo Salón</p>
        </div>
      )}
    </div>
  )
}
