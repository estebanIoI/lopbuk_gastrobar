'use client'

/**
 * Unir / separar mesas — Mesa General (Fase 6).
 *
 * Al unir, el backend consolida las comandas en UNA sola (la más antigua manda) y
 * mueve los ítems; cada ítem recuerda su mesa de origen para poder devolverlo al
 * separar. Aquí solo se eligen las mesas.
 */

import { useState } from 'react'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { Link2, Unlink, Loader2, Check } from 'lucide-react'
import type { PosTable } from './PosShell'

const formatCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n || 0)

export function MergeTablesDialog({ tables, currentTableId, onClose, onDone }: {
  tables: PosTable[]
  currentTableId: string | null
  onClose: () => void
  onDone: () => void
}) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(currentTableId ? [currentTableId] : []))
  const [busy, setBusy] = useState(false)

  // Mesas ya unidas (mismo grupo) — el backend expone merge_group en la mesa
  const groupOf = (t: any) => t.mergeGroup ?? t.merge_group ?? null
  const currentTable = tables.find(t => t.id === currentTableId)
  const currentGroup = currentTable ? groupOf(currentTable) : null
  const grouped = currentGroup ? tables.filter(t => groupOf(t) === currentGroup) : []

  const toggle = (id: string) => setPicked(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  const merge = async () => {
    if (picked.size < 2) { toast.error('Selecciona al menos 2 mesas'); return }
    setBusy(true)
    const r = await api.mergeTables([...picked])
    setBusy(false)
    if (r.success) {
      const abs = (r.data as any)?.absorbedOrders ?? 0
      toast.success(abs > 0 ? `Mesas unidas · ${abs} comanda(s) consolidada(s) en una` : 'Mesas unidas')
      onDone()
    } else toast.error(r.error ?? 'No se pudieron unir')
  }

  const unmerge = async () => {
    if (!currentGroup) { toast.error('Esta mesa no está unida'); return }
    if (!confirm('¿Separar las mesas? Cada pedido vuelve a su mesa de origen.')) return
    setBusy(true)
    const r = await api.unmergeTables({ groupId: currentGroup })
    setBusy(false)
    if (r.success) { toast.success('Mesas separadas · pedidos devueltos'); onDone() }
    else toast.error(r.error ?? 'No se pudieron separar')
  }

  return (
    <div className="fixed inset-0 z-[300] bg-black/70 flex items-center justify-center p-4" onClick={() => !busy && onClose()}>
      <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-1">
          <Link2 className="h-5 w-5 text-amber-400" />
          <h2 className="text-base font-bold text-zinc-100">Unir mesas</h2>
        </div>
        <p className="text-xs text-zinc-400 mb-4">
          Las mesas unidas comparten <b className="text-zinc-200">una sola comanda</b>: todo lo que agregues va ahí.
        </p>

        {grouped.length > 1 && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="text-xs text-amber-300 mb-2">
              Esta mesa ya está unida con: <b>{grouped.map(t => t.number).join(', ')}</b>
            </p>
            <button onClick={unmerge} disabled={busy}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/40 py-2 text-xs font-bold text-amber-300 disabled:opacity-50">
              <Unlink className="h-3.5 w-3.5" /> Separar mesas
            </button>
          </div>
        )}

        <div className="max-h-64 overflow-y-auto grid grid-cols-3 gap-2 mb-4">
          {tables.map(t => {
            const on = picked.has(t.id)
            const busyTable = !!t.activeOrder
            return (
              <button key={t.id} onClick={() => toggle(t.id)}
                className={`relative rounded-lg border-2 p-2.5 text-left transition-colors ${
                  on ? 'border-amber-500 bg-amber-500/15' : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600'
                }`}>
                {on && <Check className="absolute top-1 right-1 h-3.5 w-3.5 text-amber-400" />}
                <div className="text-sm font-bold text-zinc-100">Mesa {t.number}</div>
                <div className="text-[10px] text-zinc-400">
                  {busyTable ? formatCOP(t.activeOrder!.total) : 'Libre'}
                </div>
              </button>
            )
          })}
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} disabled={busy}
            className="flex-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 py-2.5 text-sm font-bold text-zinc-300 disabled:opacity-50">
            Cancelar
          </button>
          <button onClick={merge} disabled={busy || picked.size < 2}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 py-2.5 text-sm font-bold text-white disabled:opacity-40">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Link2 className="h-4 w-4" /> Unir {picked.size > 0 ? `(${picked.size})` : ''}</>}
          </button>
        </div>
      </div>
    </div>
  )
}
