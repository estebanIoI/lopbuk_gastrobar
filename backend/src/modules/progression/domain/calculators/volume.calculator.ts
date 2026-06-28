/**
 * Progression Engine · domain/calculators/volume
 * -----------------------------------------------------------------------------
 * Matemática pura. Volumen total = Σ (reps_i × peso). Función sin estado.
 */

/**
 * Volumen total de un ejercicio a una carga fija.
 * @param reps reps por serie
 * @param weight carga usada (kg) — constante dentro del ejercicio en V1
 */
export function calculateVolume(reps: number[], weight: number): number {
  if (weight < 0) return 0;
  return reps.reduce((acc, r) => acc + Math.max(0, r) * weight, 0);
}
