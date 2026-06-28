/**
 * Progression Engine · domain/calculators/estimated-1rm
 * -----------------------------------------------------------------------------
 * Matemática pura. 1RM estimado (fórmula de Epley): peso × (1 + reps/30).
 * Útil para analytics y detección de récords; el motor de progresión NO depende
 * de este número para decidir (la decisión es por rango de reps).
 */

export function estimate1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  const oneRm = weight * (1 + reps / 30);
  return Math.round(oneRm * 100) / 100;
}

/** 1RM estimado a partir de la mejor serie (mayor peso×reps efectivo). */
export function bestEstimated1RM(reps: number[], weight: number): number {
  if (reps.length === 0) return 0;
  const bestReps = Math.max(...reps.map((r) => Math.max(0, r)));
  return estimate1RM(weight, bestReps);
}
