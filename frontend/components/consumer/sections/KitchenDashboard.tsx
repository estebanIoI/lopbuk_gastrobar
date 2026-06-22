'use client'

/**
 * KitchenDashboard — "Cocina" como dashboard de widgets (desktop).
 * 2 columnas a la vez (sin subtabs): Despensa | Recetas ("puedo cocinar" + mis recetas).
 * Reusa DespensaView y RecipeModal.
 */
import { useState } from 'react'
import { Plus, Trash2, ChefHat, Clock, Sparkles } from 'lucide-react'
import { api } from '@/lib/api'
import { DespensaView, RecipeModal } from '@/components/consumer-routine'

export default function KitchenDashboard({ despensa, recetas, puedoHacer, onReload }: any) {
  const [showRecipe, setShowRecipe] = useState(false)

  return (
    <div className="p-6 max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      {/* Despensa */}
      <div>
        <h3 className="text-sm font-bold text-neutral-800 mb-2">Despensa</h3>
        <DespensaView items={despensa} onReload={onReload} />
      </div>

      {/* Recetas */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-neutral-800">Recetas</h3>
          <button onClick={() => setShowRecipe(true)} className="text-sm bg-orange-500 text-white rounded-full px-3 py-1.5 flex items-center gap-1 font-medium"><Plus className="w-4 h-4" />Nueva</button>
        </div>

        {/* Puedo cocinar ahora */}
        <div className="rounded-2xl bg-white border border-black/[0.07] shadow-sm p-4">
          <p className="text-sm font-bold text-neutral-800 mb-2 flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-violet-500" /> Puedo cocinar ahora</p>
          {puedoHacer?.length ? (
            <div className="space-y-2.5">
              {puedoHacer.slice(0, 8).map((r: any) => (
                <div key={r.id}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{r.name}</span>
                    <span className={`text-xs font-bold ${r.canCook ? 'text-emerald-600' : 'text-neutral-400'}`}>{r.matchPct}%</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-neutral-100 overflow-hidden"><div className={`h-full ${r.canCook ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: `${r.matchPct}%` }} /></div>
                  {r.missing?.length > 0 && (
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-[11px] text-neutral-400 truncate">Falta: {r.missing.join(', ')}</span>
                      <button onClick={async () => { await api.recetaALista(r.id); alert('Agregado a tu lista de compras') }} className="text-[11px] text-sky-600 shrink-0 ml-2 font-medium">+ Lista</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-neutral-400 py-2">Registra despensa y recetas para ver qué puedes cocinar.</p>}
        </div>

        {/* Mis recetas */}
        <div className="rounded-2xl bg-white border border-black/[0.07] shadow-sm p-4">
          <p className="text-sm font-bold text-neutral-800 mb-2">Mis recetas</p>
          {recetas?.length ? (
            <div className="space-y-2">
              {recetas.map((r: any) => (
                <div key={r.id} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0"><ChefHat className="w-4 h-4 text-amber-500" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{r.name}</div>
                    <div className="text-[11px] text-neutral-400 flex items-center gap-2">
                      {r.prepMinutes ? <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{r.prepMinutes}m</span> : null}
                      {r.calories ? <span>{r.calories} kcal</span> : null}
                    </div>
                  </div>
                  <button onClick={async () => { await api.deleteRutinaReceta(r.id); onReload() }} className="text-neutral-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-neutral-400 py-2">Aún no tienes recetas guardadas.</p>}
        </div>
      </div>

      {showRecipe && <RecipeModal onClose={() => setShowRecipe(false)} onSaved={() => { setShowRecipe(false); onReload() }} />}
    </div>
  )
}
