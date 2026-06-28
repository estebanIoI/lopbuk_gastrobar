/**
 * Progression Engine · domain/strategies/double-progression
 * -----------------------------------------------------------------------------
 * DOUBLE PROGRESSION (hipertrofia, rango 8-12):
 *   - Todas las series llegan al tope del rango (completion rate ≥ 1.0) → SUBIR.
 *   - Rango cumplido parcialmente (rate ≥ 0.8, sin caer bajo el mínimo) → MANTENER.
 *   - Promedio bajo el mínimo del rango o rate < 0.8 → BAJAR.
 *
 * 100% determinística: misma entrada → misma decisión. Sin IA, sin aleatoriedad.
 */

import { ProgressionStrategy, StrategyInput } from './progression.strategy';
import { ProgressionDecision } from '../entities/types';
import { evaluatePerformance } from '../evaluators/performance.evaluator';
import { MIN_WEIGHT_KG } from '../../shared/constants';

/** Redondea una carga al múltiplo del incremento más cercano (rejilla de discos). */
function roundToIncrement(weight: number, increment: number): number {
  if (increment <= 0) return weight;
  const rounded = Math.round(weight / increment) * increment;
  // Evita ruido de coma flotante (p. ej. 22.500000000000004).
  return Math.round(rounded * 1000) / 1000;
}

export class DoubleProgressionStrategy implements ProgressionStrategy {
  readonly type = 'double_progression';

  execute(input: StrategyInput): ProgressionDecision {
    const { currentWeight, targetReps, reps, increment, rules } = input;

    const evaln = evaluatePerformance(reps, currentWeight, targetReps, rules);
    const { completionRate, avgReps, totalVolume, estimated1RM } = evaln;

    const metrics = {
      completionRate: Math.round(completionRate * 1000) / 1000,
      totalVolume,
      avgReps: Math.round(avgReps * 100) / 100,
      estimated1RM,
    };

    // ---- SUBIR: todas las series alcanzaron el tope del rango ----------------
    if (evaln.fullyCompleted) {
      return {
        action: 'increase',
        nextWeight: roundToIncrement(currentWeight + increment, increment),
        confidence: 1,
        reasons: [
          'completed_all_sets',
          `Completaste el objetivo (${targetReps} reps) en todas las series. Sube ${increment}kg.`,
        ],
        metrics,
      };
    }

    // ---- BAJAR: fallo duro (bajo el mínimo del rango o rate < mantener) -------
    if (evaln.belowRange || !evaln.partiallyCompleted) {
      // Confianza mayor cuanto más lejos del umbral de mantenimiento.
      const gap = rules.progression.maintainThreshold - completionRate;
      const confidence = Math.min(1, Math.max(0.6, 0.6 + gap));
      return {
        action: 'decrease',
        nextWeight: roundToIncrement(Math.max(MIN_WEIGHT_KG, currentWeight - increment), increment),
        confidence: Math.round(confidence * 100) / 100,
        reasons: [
          'failed_hard',
          `Promedio de ${metrics.avgReps} reps bajo el rango ${rules.repRange.min}-${rules.repRange.max}. Baja ${increment}kg.`,
        ],
        metrics,
      };
    }

    // ---- MANTENER: dentro del rango, aún no en el tope -----------------------
    // Confianza proporcional a la posición dentro de la banda [mantener, subir).
    const band = rules.progression.increaseThreshold - rules.progression.maintainThreshold;
    const pos = band > 0 ? (completionRate - rules.progression.maintainThreshold) / band : 0;
    const confidence = Math.round((0.7 + 0.2 * Math.min(1, Math.max(0, pos))) * 100) / 100;
    return {
      action: 'maintain',
      nextWeight: roundToIncrement(currentWeight, increment),
      confidence,
      reasons: [
        'in_range_not_max',
        `Estás dentro del rango (${rules.repRange.min}-${rules.repRange.max}) pero aún no en el tope. Repite ${currentWeight}kg para consolidar.`,
      ],
      metrics,
    };
  }
}
