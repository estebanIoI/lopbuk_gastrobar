/**
 * Progression Engine · domain/evaluators/performance
 * -----------------------------------------------------------------------------
 * Interpreta el rendimiento crudo contra las reglas del objetivo y produce un
 * veredicto NEUTRAL (sin decidir carga todavía). Las estrategias consumen esto.
 */

import { GoalRules } from '../entities/types';
import {
  calculateCompletionRate,
  calculateAverageReps,
} from '../calculators/completion-rate.calculator';
import { calculateVolume } from '../calculators/volume.calculator';
import { bestEstimated1RM } from '../calculators/estimated-1rm.calculator';

export interface PerformanceEvaluation {
  completionRate: number;
  avgReps: number;
  totalVolume: number;
  estimated1RM: number;
  /** Todas las series alcanzaron/superaron el objetivo (rate ≥ increaseThreshold). */
  fullyCompleted: boolean;
  /** Cumplió el umbral de mantenimiento (rate ≥ maintainThreshold). */
  partiallyCompleted: boolean;
  /** El promedio de reps cayó por debajo del mínimo del rango → fallo duro. */
  belowRange: boolean;
}

/**
 * Evalúa una serie de reps a una carga, según las reglas del objetivo.
 * @param reps reps realizadas por serie
 * @param weight carga usada (kg)
 * @param targetReps objetivo de reps por serie (tope del rango en hipertrofia)
 * @param rules reglas del objetivo (del RuleEngine)
 */
export function evaluatePerformance(
  reps: number[],
  weight: number,
  targetReps: number,
  rules: GoalRules
): PerformanceEvaluation {
  const completionRate = calculateCompletionRate(targetReps, reps);
  const avgReps = calculateAverageReps(reps);
  const totalVolume = calculateVolume(reps, weight);
  const estimated1RM = bestEstimated1RM(reps, weight);

  const fullyCompleted = completionRate >= rules.progression.increaseThreshold;
  const partiallyCompleted = completionRate >= rules.progression.maintainThreshold;
  const belowRange = avgReps < rules.repRange.min;

  return {
    completionRate,
    avgReps,
    totalVolume,
    estimated1RM,
    fullyCompleted,
    partiallyCompleted,
    belowRange,
  };
}
