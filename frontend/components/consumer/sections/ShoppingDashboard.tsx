'use client'

/**
 * ShoppingDashboard — "Compras" como dashboard (desktop). Add bar + 2 columnas:
 * Pendientes | Comprados. Misma lógica que ComprasView (toggle/eliminar/agregar).
 */
import { useState } from 'react'
import { Plus, Trash2, Check, ShoppingBasket } from 'lucide-react'
import { api } from '@/lib/api'

function Row({ it, onReload }: { it: any; onReload: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white border border-black/[0.07] px-3 py-2.5">
      <button onClick={async () => { await api.toggleListaCompra(it.id); onReload() }} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${it.isPurchased ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-neutral-300'}`}>{it.isPurchased && <Check className="w-3.5 h-3.5" />}</button>
      <div className="flex-1 min-w-0">
        <div className={`text-sm ${it.isPurchased ? 'line-through text-neutral-400' : 'font-medium'}`}>{it.name}</div>
        <div className="text-[11px] text-neutral-400">{it.quantity}{it.unit ? ` ${it.unit}` : ''}{it.tenantName && <span className="text-sky-600 ml-1">· {it.tenantName}</span>}</div>
      </div>
      <button onClick={async () => { await api.deleteListaCompra(it.id); onReload() }} className="text-neutral-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
    </div>
  )
}

export default function ShoppingDashboard({ items, onReload }: { items: any[]; onReload: () => void }) {
  const [name, setName] = useState('')
  const add = async () => { if (!name.trim()) return; await api.addListaCompra({ name: name.trim() }); setName(''); onReload() }
  const pend = (items || []).filter((i: any) => !i.isPurchased)
  const done = (items || []).filter((i: any) => i.isPurchased)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex gap-2">
        <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add() }} placeholder="Ej: Leche, huevos…" className="flex-1 rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
        <button onClick={add} className="bg-orange-500 text-white rounded-xl px-4 shrink-0"><Plus className="w-5 h-5" /></button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div>
          <p className="text-sm font-bold text-neutral-800 mb-2">Por comprar ({pend.length})</p>
          {pend.length ? <div className="space-y-2">{pend.map((it: any) => <Row key={it.id} it={it} onReload={onReload} />)}</div>
            : <div className="rounded-2xl border border-dashed border-neutral-200 p-8 text-center text-neutral-400"><ShoppingBasket className="w-7 h-7 mx-auto mb-1" /><p className="text-xs">Tu lista está vacía.</p></div>}
        </div>
        <div>
          <p className="text-sm font-bold text-neutral-800 mb-2">Comprados ({done.length})</p>
          {done.length ? <div className="space-y-2">{done.map((it: any) => <Row key={it.id} it={it} onReload={onReload} />)}</div>
            : <p className="text-xs text-neutral-300 py-2">Nada comprado aún.</p>}
        </div>
      </div>
    </div>
  )
}
