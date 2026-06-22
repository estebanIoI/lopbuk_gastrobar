'use client'

/**
 * PlanDashboard — "Plan" de comidas como dashboard de widgets (desktop).
 * Header de macros + grid de comidas por tipo (Desayuno…Snack). Reusa PlanModal.
 */
import { useState } from 'react'
import { Plus, Trash2, Check, CalendarDays } from 'lucide-react'
import { api } from '@/lib/api'
import { PlanModal } from '@/components/consumer-routine'

const MEALS = [
  { key: 'desayuno', label: 'Desayuno' },
  { key: 'media_manana', label: 'Media mañana' },
  { key: 'almuerzo', label: 'Almuerzo' },
  { key: 'onces', label: 'Onces' },
  { key: 'cena', label: 'Cena' },
  { key: 'snack', label: 'Snack' },
]

export default function PlanDashboard({ plan, today, onReload }: { plan: any[]; today: string; onReload: () => void }) {
  const [open, setOpen] = useState(false)
  const totals = (plan || []).reduce((a: any, m: any) => ({
    cal: a.cal + (m.calories || 0), pro: a.pro + (m.proteinG || 0), carb: a.carb + (m.carbsG || 0), fat: a.fat + (m.fatG || 0),
  }), { cal: 0, pro: 0, carb: 0, fat: 0 })

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      {/* Header + macros */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-bold text-neutral-700 flex items-center gap-2"><CalendarDays className="w-4 h-4 text-orange-500" /> Hoy · {today}</div>
        <button onClick={() => setOpen(true)} className="text-sm bg-orange-500 text-white rounded-full px-4 py-2 flex items-center gap-1.5 font-medium"><Plus className="w-4 h-4" />Agregar comida</button>
      </div>

      <div className="rounded-2xl bg-white border border-black/[0.07] shadow-sm p-4 grid grid-cols-4 gap-2 text-center">
        {[['Kcal', totals.cal], ['Prot', totals.pro + 'g'], ['Carb', totals.carb + 'g'], ['Grasa', totals.fat + 'g']].map(([l, v]) => (
          <div key={l as string}><div className="text-xl font-bold text-neutral-900">{v}</div><div className="text-[10px] text-neutral-400 uppercase tracking-wide">{l}</div></div>
        ))}
      </div>

      {/* Grid de comidas por tipo */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {MEALS.map(meal => {
          const items = (plan || []).filter((m: any) => m.mealType === meal.key)
          return (
            <div key={meal.key} className="rounded-2xl bg-white border border-black/[0.07] shadow-sm p-4 transition-all duration-200 hover:shadow-md">
              <p className="text-sm font-bold text-neutral-800 mb-2">{meal.label}</p>
              {items.length ? (
                <div className="space-y-2">
                  {items.map((m: any) => (
                    <div key={m.id} className="flex items-center gap-3">
                      <button onClick={async () => { await api.togglePlanComida(m.id); onReload() }} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${m.isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-neutral-300'}`}>{m.isDone && <Check className="w-3.5 h-3.5" />}</button>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm ${m.isDone ? 'line-through text-neutral-400' : 'font-medium'}`}>{m.title || 'Comida'}</div>
                        <div className="text-[11px] text-neutral-400">{m.calories ? `${m.calories} kcal` : ''}{m.proteinG ? ` · P${m.proteinG} C${m.carbsG || 0} G${m.fatG || 0}` : ''}</div>
                      </div>
                      <button onClick={async () => { await api.deletePlanComida(m.id); onReload() }} className="text-neutral-300 hover:text-red-500 shrink-0"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-neutral-300 py-2">Sin comidas.</p>}
            </div>
          )
        })}
      </div>

      {open && <PlanModal today={today} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); onReload() }} />}
    </div>
  )
}
