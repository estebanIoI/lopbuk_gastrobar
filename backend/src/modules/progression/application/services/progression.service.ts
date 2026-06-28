/**
 * Progression Engine · application/services
 * -----------------------------------------------------------------------------
 * Orquesta el dominio. NO contiene lógica fitness propia: valida el contrato,
 * pide reglas al RuleEngine, resuelve la estrategia y la ejecuta.
 *
 *   entrada cruda → validación → reglas → estrategia → ProgressionDecision
 */

import { ProgressionDecision } from '../../domain/entities/types';
import { RuleEngine } from '../../domain/rules/goal-rules';
import { ProgressionStrategyFactory } from '../../domain/strategies/progression-strategy.factory';
import {
  ProgressionInputSchema,
  ProgressionInputRaw,
} from '../../shared/schema';

export class ProgressionService {
  /**
   * Computa la decisión de progresión a partir de datos crudos (no confiables).
   * Lanza ProgressionValidationError / UnsupportedGoalError / UnknownStrategyError
   * ante entradas u objetivos no soportados — nunca improvisa.
   */
  computeFromRaw(rawInput: unknown): ProgressionDecision {
    const input = ProgressionInputSchema.parse(rawInput);
    return this.compute(input);
  }

  /** Computa a partir de un input ya validado/tipado. */
  compute(input: ProgressionInputRaw): ProgressionDecision {
    const rules = RuleEngine.getGoalRules(input.goal);

    const progressionType = input.progressionType ?? rules.progression.type;
    const strategy = ProgressionStrategyFactory.resolve(progressionType);

    const increment = RuleEngine.getIncrement({
      increment: input.increment,
      movementPattern: input.movementPattern,
    });

    return strategy.execute({
      currentWeight: input.currentWeight,
      targetReps: input.targetReps,
      reps: input.reps,
      increment,
      movementPattern: input.movementPattern,
      rules,
    });
  }
}

/** Instancia compartida (servicio sin estado). */
export const progressionService = new ProgressionService();
