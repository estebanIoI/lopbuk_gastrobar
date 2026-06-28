/**
 * Progression Engine · domain/calculators/completion-rate
 * -----------------------------------------------------------------------------
 * Matemática pura. Tasa de cumplimiento respecto al objetivo de reps.
 *
 * completionRate = Σ reps_realizadas / (targetReps × nº de series)
 *
 * Se acota a [0, 1]: superar el objetivo no produce > 1 (subir es discreto,
 * no proporcional al exceso).
 */

export function calculateCompletionRate(targetReps: number, completedReps: number[]): number {
  if (targetReps <= 0 || completedReps.length === 0) return 0;
  const totalTarget = targetReps * completedReps.length;
  const totalCompleted = completedReps.reduce((a, b) => a + Math.max(0, b), 0);
  const rate = totalCompleted / totalTarget;
  return Math.min(1, Math.max(0, rate));
}

/** Promedio de reps por serie (sin acotar). */
export function calculateAverageReps(completedReps: number[]): number {
  if (completedReps.length === 0) return 0;
  const total = completedReps.reduce((a, b) => a + Math.max(0, b), 0);
  return total / completedReps.length;
}
