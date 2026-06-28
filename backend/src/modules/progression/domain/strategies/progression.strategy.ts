/**
 * Progression Engine · domain/strategies/progression.strategy
 * -----------------------------------------------------------------------------
 * Contrato de una estrategia de progresión. Cada estrategia vive aislada y
 * produce una ProgressionDecision a partir de un input normalizado + reglas.
 *
 * Para añadir fuerza/resistencia: se crea una NUEVA estrategia que implementa
 * esta interfaz. NO se toca el resto del motor (Open/Closed).
 */

import { GoalRules, ProgressionDecision } from '../entities/types';
import { MovementPattern } from '../../shared/enums';

export interface StrategyInput {
  currentWeight: number;
  targetReps: number;
  reps: number[];
  increment: number;
  movementPattern?: MovementPattern;
  rules: GoalRules;
}

export interface ProgressionStrategy {
  readonly type: string;
  execute(input: StrategyInput): ProgressionDecision;
}
