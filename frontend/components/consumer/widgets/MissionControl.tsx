'use client'

/**
 * MissionControl — el "Hoy" enfocado en la misión (P0 activación). Responde
 * "¿qué hago hoy?": hero con día N + sesión del día + macros, checklist diario
 * accionable, y CTA para iniciar la rutina. Convierte el dashboard en un plan.
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Flame, Dumbbell, Check, ChevronRight, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { workoutApi } from '@/lib/workout-api'
import type { ConsumerTab } from '../hooks/useConsumerData'
import LegendUpsell from './LegendUpsell'
import XpWidget from './XpWidget'

const GOAL_LABEL: Record<string, string> = {
  bajar_peso: 'Bajar grasa', subir_masa: 'Ganar masa', mantener: 'Mantener', salud_general: 'Salud general',
  recomposicion: 'Recomposición', rendimiento: 'Rendimiento', volver_entrenar: 'Volver a entrenar', perder_grasa: 'Bajar grasa', ganar_musculo: 'Ganar masa',
}

export default function MissionControl({ onGoTo }: { onGoTo: (t: ConsumerTab) => void }) {
  const router = useRouter()
  const [m, setM] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)

  const load = async () => { const r = await api.getTodayMission(); if (r.success) setM(r.data); setLoading(false) }
  useEffect(() => { load() }, [])

  const toggle = async (item: string, done: boolean) => {
    // Optimista
    setM((prev: any) => prev ? { ...prev, checklist: prev.checklist.map((c: any) => c.key === item ? { ...c, done } : c), completed: prev.completed + (done ? 1 : -1) } : prev)
    const r = await api.toggleDailyCheck(item, done)
    if (r.success) setM(r.data)
  }

  // Inicia la sesión de hoy en el backend (que arma el plan + pesos sugeridos)
  // y entra al modo entrenamiento. Si falla, cae a la pestaña de rutina.
  const startWorkout = async () => {
    if (starting) return
    setStarting(true)
    const r = await workoutApi.startToday(m?.todaySession || undefined)
    if (r.success && r.data) router.push(`/workout/session/${r.data.id}`)
    else { setStarting(false); onGoTo('rutina') }
  }

  if (loading) return <div className="px-4 pt-3"><div className="rounded-2xl bg-neutral-100 animate-pulse h-32" /></div>
  if (!m) return null

  const pct = m.total ? Math.round((m.completed / m.total) * 100) : 0

  return (
    <div className="px-4 pt-3 space-y-3">
      {/* Hero */}
      <div className="rounded-2xl p-4 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #b45309 130%)' }}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] uppercase tracking-wide text-white/50 font-bold">Día {m.dayNumber}{m.goal ? ` · ${GOAL_LABEL[m.goal] || m.goal}` : ''}</span>
          <XpWidget compact />
        </div>
        <p className="text-[11px] text-amber-300 font-semibold mt-2 uppercase tracking-wide">Hoy toca</p>
        <p className="text-xl font-extrabold leading-tight">{m.todaySession}</p>
        <p className="text-xs text-white/60 mt-1">
          {[m.calorieTarget ? `${m.calorieTarget} kcal` : '', m.proteinG ? `${m.proteinG}g proteína` : '', m.waterMl ? `${(m.waterMl / 1000).toFixed(1)}L agua` : ''].filter(Boolean).join(' · ')}
        </p>
        {!m.isRestDay && (
          <button onClick={startWorkout} disabled={starting} className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-amber-400 text-neutral-900 font-bold text-sm px-4 py-2 active:scale-[0.98] disabled:opacity-70">
            {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Dumbbell className="w-4 h-4" />}
            {starting ? 'Preparando…' : 'Iniciar rutina'}
            {!starting && <ChevronRight className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Checklist diario */}
      <div className="rounded-2xl border border-black/[0.06] bg-white p-4">
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-sm font-bold text-neutral-800">Tu día</p>
          <span className="text-[11px] text-neutral-400">{m.completed}/{m.total} · {pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden mb-3">
          <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="grid grid-cols-1 gap-1.5">
          {m.checklist.map((c: any) => (
            <button key={c.key} onClick={() => toggle(c.key, !c.done)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${c.done ? 'bg-emerald-50' : 'bg-neutral-50 hover:bg-neutral-100'}`}>
              <span className="text-lg">{c.emoji}</span>
              <span className={`flex-1 text-sm font-medium ${c.done ? 'text-emerald-700 line-through' : 'text-neutral-700'}`}>{c.label}</span>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${c.done ? 'bg-emerald-500 text-white' : 'border-2 border-neutral-300'}`}>
                {c.done && <Check className="w-3.5 h-3.5" />}
              </span>
            </button>
          ))}
        </div>
        {pct === 100 && <p className="text-xs text-emerald-600 font-semibold mt-2 flex items-center gap-1"><Flame className="w-3.5 h-3.5" /> ¡Día completo! Así se construye.</p>}
      </div>

      {/* Upsell contextual: solo a FREE cuando ya hizo su día */}
      {pct >= 60 && <LegendUpsell reason="Vas en serio. Lleva tu progreso al siguiente nivel." onGoTo={onGoTo} />}
    </div>
  )
}
