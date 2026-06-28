'use client'

/**
 * SetTracker — una serie. Ajusta reps/peso y marca completada. UI pura: envía
 * lo realizado al backend, no calcula progresión.
 */
import { useState } from 'react'
import { Check } from 'lucide-react'
import type { WorkoutSet } from '@/lib/workout-api'

export default function SetTracker({
  set,
  suggestedWeight,
  disabled,
  onComplete,
}: {
  set: WorkoutSet
  suggestedWeight: number
  disabled?: boolean
  onComplete: (reps: number, weight: number) => Promise<void> | void
}) {
  const [reps, setReps] = useState<number>(set.completedReps ?? set.targetReps)
  const [weight, setWeight] = useState<number>(set.usedWeight ?? suggestedWeight ?? set.targetWeight)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (saving || set.completed || disabled) return
    setSaving(true)
    try { await onComplete(reps, weight) } finally { setSaving(false) }
  }

  const Stepper = ({ value, set: setVal, step, suffix }: { value: number; set: (n: number) => void; step: number; suffix: string }) => (
    <div className="flex items-center rounded-xl bg-white/5 overflow-hidden">
      <button disabled={set.completed} onClick={() => setVal(Math.max(0, +(value - step).toFixed(2)))} className="px-3 py-2 text-white/70 disabled:opacity-30 active:bg-white/10">−</button>
      <span className="min-w-[3.2rem] text-center text-white font-bold tabular-nums">{value}<span className="text-[10px] text-white/40 ml-0.5">{suffix}</span></span>
      <button disabled={set.completed} onClick={() => setVal(+(value + step).toFixed(2))} className="px-3 py-2 text-white/70 disabled:opacity-30 active:bg-white/10">+</button>
    </div>
  )

  return (
    <div className={`flex items-center gap-2.5 rounded-2xl px-3 py-2.5 ${set.completed ? 'bg-emerald-500/10' : 'bg-white/[0.04]'}`}>
      <span className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-xs font-bold ${set.completed ? 'bg-emerald-500 text-slate-900' : 'bg-white/10 text-white/70'}`}>
        {set.setNumber}
      </span>
      <Stepper value={weight} set={setWeight} step={2.5} suffix="kg" />
      <Stepper value={reps} set={setReps} step={1} suffix="reps" />
      <button
        onClick={submit}
        disabled={set.completed || disabled || saving}
        className={`ml-auto w-10 h-10 shrink-0 rounded-xl flex items-center justify-center font-bold transition-colors ${
          set.completed ? 'bg-emerald-500 text-slate-900' : 'bg-amber-400 text-slate-900 active:scale-95 disabled:opacity-40'
        }`}
        aria-label="Completar serie"
      >
        <Check className="w-5 h-5" />
      </button>
    </div>
  )
}
