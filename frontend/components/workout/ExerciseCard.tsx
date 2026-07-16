'use client'

/**
 * ExerciseCard — un ejercicio de la sesión: cabecera (nombre, objetivo, peso
 * sugerido por el motor) + sus series. UI pura.
 */
import { Dumbbell, CheckCircle2, Trophy, History } from 'lucide-react'
import type { WorkoutExercise, ExerciseHistory } from '@/lib/workout-api'
import { exerciseMediaFor } from '@/lib/exercise-media'
import SetTracker from './SetTracker'

export default function ExerciseCard({
  exercise,
  index,
  onSetComplete,
  history,
}: {
  exercise: WorkoutExercise
  index: number
  onSetComplete: (setId: string, reps: number, weight: number) => Promise<void>
  history?: ExerciseHistory
}) {
  const doneSets = exercise.sets.filter((s) => s.completed).length
  const media = exerciseMediaFor(exercise.exerciseId)
  const hasHistory = !!history && (history.lastWeight != null || history.prWeight != null)

  return (
    <div className={`rounded-3xl border p-4 transition-colors ${exercise.completed ? 'border-emerald-500/30 bg-emerald-500/[0.06]' : 'border-white/10 bg-white/[0.03]'}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 min-w-0">
          {media && (
            /* Demo de ejemplo del movimiento (fallback a la foto si el gif falla) */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={media.gif}
              alt={exercise.name || 'Ejercicio'}
              loading="lazy"
              onError={(e) => { const img = e.currentTarget; if (!img.dataset.fb) { img.dataset.fb = '1'; img.src = media.image } }}
              className="w-16 h-16 rounded-xl object-cover bg-white/10 shrink-0"
            />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-white/40">{String(index + 1).padStart(2, '0')}</span>
              <h3 className="text-lg font-extrabold text-white leading-tight">{exercise.name || exercise.exerciseId}</h3>
            </div>
            <p className="text-xs text-white/50 mt-0.5">
              {exercise.targetSets} × {exercise.targetReps} reps · objetivo {exercise.suggestedWeight}kg
            </p>
          </div>
        </div>
        {exercise.completed ? (
          <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
        ) : (
          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-white/60">
            <Dumbbell className="w-3.5 h-3.5" /> {doneSets}/{exercise.sets.length}
          </span>
        )}
      </div>

      {/* Historial y récord (P5) — motiva antes de la primera serie */}
      {hasHistory && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {history!.lastWeight != null && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1 text-[11px] text-white/70">
              <History className="w-3.5 h-3.5 text-white/40" />
              Última vez <b className="text-white">{history!.lastWeight}kg</b>
              {history!.lastReps != null && <> × {history!.lastReps}</>}
            </span>
          )}
          {history!.prWeight != null && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400/10 px-2.5 py-1 text-[11px] text-amber-300/90">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              PR <b className="text-amber-300">{history!.prWeight}kg</b>
              {history!.prReps != null && <> × {history!.prReps}</>}
            </span>
          )}
        </div>
      )}

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
