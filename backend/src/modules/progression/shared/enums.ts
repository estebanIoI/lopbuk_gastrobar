/**
 * Progression Engine · shared/enums
 * -----------------------------------------------------------------------------
 * Vocabulario cerrado del dominio. NADA fuera de estos valores entra al motor.
 * El agente NO puede añadir acciones nuevas sin pasar por aquí (anti-alucinación).
 */

/** Decisión que el motor puede emitir. Conjunto cerrado. */
export const PROGRESSION_ACTIONS = ['increase', 'maintain', 'decrease'] as const;
export type ProgressionAction = (typeof PROGRESSION_ACTIONS)[number];

/** Objetivo de entrenamiento. V1 solo implementa 'hypertrophy'. */
export const GOAL_TYPES = ['hypertrophy', 'strength', 'endurance'] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

/** Tipo de progresión disponible. V1 solo implementa 'double_progression'. */
export const PROGRESSION_TYPES = ['double_progression', 'linear', 'rir_based'] as const;
export type ProgressionType = (typeof PROGRESSION_TYPES)[number];

/**
 * Patrón del movimiento — determina el incremento de carga aplicable.
 * 'upper' = tren superior (saltos finos), 'lower' = tren inferior (saltos mayores).
 */
export const MOVEMENT_PATTERNS = ['upper', 'lower'] as const;
export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number];

/** Helpers de guardia de tipo — usados por la capa de validación. */
export const isGoalType = (v: unknown): v is GoalType =>
  typeof v === 'string' && (GOAL_TYPES as readonly string[]).includes(v);

export const isProgressionType = (v: unknown): v is ProgressionType =>
  typeof v === 'string' && (PROGRESSION_TYPES as readonly string[]).includes(v);

export const isMovementPattern = (v: unknown): v is MovementPattern =>
  typeof v === 'string' && (MOVEMENT_PATTERNS as readonly string[]).includes(v);
