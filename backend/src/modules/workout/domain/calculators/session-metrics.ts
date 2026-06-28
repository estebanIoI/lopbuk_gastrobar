/**
 * Workout Runtime · domain/calculators/session-metrics
 * -----------------------------------------------------------------------------
 * Matemática pura del runtime. Volumen y derivación del "peso de trabajo" a
 * partir de los sets completados (insumo para el progression engine).
 */

import { WorkoutExercise, WorkoutSet } from '../entities/types';

/** Volumen de un set = reps × peso (solo sets completados con datos). */
export function setVolume(set: WorkoutSet): number {
  if (!set.completed || set.completedReps == null || set.usedWeight == null) return 0;
  return Math.max(0, set.completedReps) * Math.max(0, set.usedWeight);
}

/** Volumen total de la sesión = Σ volumen de sets completados. */
export function sessionVolume(exercises: WorkoutExercise[]): number {
  let total = 0;
  for (const ex of exercises) for (const s of ex.sets) total += setVolume(s);
  return Math.round(total * 100) / 100;
}

/**
 * Peso de trabajo de un ejercicio = la carga (used_weight) más frecuente entre
 * sets completados; ante empate, la mayor. Si no hay sets completados → null.
 * Es el `currentWeight` que consume la progresión.
 */
export function workingWeight(sets: WorkoutSet[]): number | null {
  const weights = sets
    .filter((s) => s.completed && s.usedWeight != null)
    .map((s) => s.usedWeight as number);
  if (weights.length === 0) return null;

  const freq = new Map<number, number>();
  for (const w of weights) freq.set(w, (freq.get(w) ?? 0) + 1);

  let best = weights[0];
  let bestCount = 0;
  for (const [w, c] of freq) {
    if (c > bestCount || (c === bestCount && w > best)) {
      best = w;
      bestCount = c;
    }
  }
  return best;
}

/** Reps completadas, en orden, de los sets completados. */
export function completedRepsOf(sets: WorkoutSet[]): number[] {
  return sets
    .filter((s) => s.completed && s.completedReps != null)
    .map((s) => s.completedReps as number);
}
