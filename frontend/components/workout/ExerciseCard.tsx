'use client'

/**
 * ExerciseCard — un ejercicio de la sesión: cabecera (nombre, objetivo, peso
 * sugerido por el motor) + sus series. UI pura.
 */
import { Dumbbell, CheckCircle2 } from 'lucide-react'
import type { WorkoutExercise } from '@/lib/workout-api'
import SetTracker from './SetTracker'

export default function ExerciseCard({
  exercise,
  index,
  onSetComplete,
}: {
  exercise: WorkoutExercise
  index: number
  onSetComplete: (setId: string, reps: number, weight: number) => Promise<void>
}) {
  const doneSets = exercise.sets.filter((s) => s.completed).length

  return (
    <div className={`rounded-3xl border p-4 transition-colors ${exercise.completed ? 'border-emerald-500/30 bg-emerald-500/[0.06]' : 'border-white/10 bg-white/[0.03]'}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-white/40">{String(index + 1).padStart(2, '0')}</span>
            <h3 className="text-lg font-extrabold text-white leading-tight">{exercise.name || exercise.exerciseId}</h3>
          </div>
          <p className="text-xs text-white/50 mt-0.5">
            {exercise.targetSets} × {exercise.targetReps} reps · objetivo {exercise.suggestedWeight}kg
          </p>
        </div>
        {exercise.completed ? (
          <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
        ) : (
          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-white/60">
            <Dumbbell className="w-3.5 h-3.5" /> {doneSets}/{exercise.sets.length}
          </span>
        )}
      </div>

      <div className="space-y-2">
        {exercise.sets.map((s) => (
          <SetTracker
            key={s.id}
            set={s}
            suggestedWeight={exercise.suggestedWeight}
            onComplete={(reps, weight) => onSetComplete(s.id, reps, weight)}
          />
        ))}
      </div>
    </div>
  )
}
