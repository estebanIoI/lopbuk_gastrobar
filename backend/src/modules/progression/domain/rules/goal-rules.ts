/**
 * Progression Engine · domain/rules
 * -----------------------------------------------------------------------------
 * EL RULE ENGINE. Centraliza TODAS las reglas fitness. Prohibido escribir
 * `if (goal === 'hypertrophy')` en cualquier otro lugar del sistema: todo sale
 * de aquí vía RuleEngine.
 *
 * V1: solo 'hypertrophy' está implementado. 'strength'/'endurance' lanzan
 * explícitamente (no se inventan reglas → anti-alucinación).
 */

import { GoalRules } from '../entities/types';
import {
  GoalType,
  MovementPattern,
  ProgressionType,
} from '../../shared/enums';
import {
  COMPLETION_THRESHOLD,
  WEIGHT_INCREMENT_KG,
  DEFAULT_INCREMENT_KG,
} from '../../shared/constants';

/** Tabla maestra de reglas por objetivo. Única fuente de verdad. */
export const GOAL_RULES: Partial<Record<GoalType, GoalRules>> = {
  hypertrophy: {
    goal: 'hypertrophy',
    repRange: { min: 8, max: 12 },
    progression: {
      type: 'double_progression',
      increaseThreshold: COMPLETION_THRESHOLD.INCREASE,
      maintainThreshold: COMPLETION_THRESHOLD.MAINTAIN,
    },
    restSeconds: { min: 60, max: 90 },
  },
  // strength / endurance → V2/V3. No definidos = no soportados (a propósito).
};

export class UnsupportedGoalError extends Error {
  constructor(goal: string) {
    super(`UnsupportedGoalError: objetivo '${goal}' no soportado en esta versión del motor`);
    this.name = 'UnsupportedGoalError';
  }
}

export const RuleEngine = {
  /** Reglas del objetivo. Lanza si el objetivo no está implementado. */
  getGoalRules(goal: GoalType): GoalRules {
    const rules = GOAL_RULES[goal];
    if (!rules) throw new UnsupportedGoalError(goal);
    return rules;
  },

  /** ¿El motor soporta este objetivo hoy? */
  isGoalSupported(goal: GoalType): boolean {
    return !!GOAL_RULES[goal];
  },

  /** Tipo de progresión canónico del objetivo. */
  getProgressionType(goal: GoalType): ProgressionType {
    return RuleEngine.getGoalRules(goal).progression.type;
  },

  /** Rango de descanso (s) del objetivo. */
  getRestSeconds(goal: GoalType): { min: number; max: number } {
    return RuleEngine.getGoalRules(goal).restSeconds;
  },

  /**
   * Incremento de carga (kg). Prioridad:
   *  1) override explícito,
   *  2) por patrón de movimiento,
   *  3) default.
   */
  getIncrement(opts: { increment?: number; movementPattern?: MovementPattern }): number {
    if (typeof opts.increment === 'number' && opts.increment > 0) return opts.increment;
    if (opts.movementPattern) return WEIGHT_INCREMENT_KG[opts.movementPattern];
    return DEFAULT_INCREMENT_KG;
  },
};
