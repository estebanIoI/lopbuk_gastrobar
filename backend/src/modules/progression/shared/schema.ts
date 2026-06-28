/**
 * Progression Engine · shared/schema
 * -----------------------------------------------------------------------------
 * CONTRATOS de entrada/salida. El motor SOLO consume datos validados por aquí.
 *
 * No usamos `zod` todavía (no está instalado y CLAUDE.md prohíbe tocar deps sin
 * pedir permiso). Implementamos una validación pura con la MISMA API que zod
 * (`Schema.parse(data)` → devuelve el valor tipado o lanza). Migrar a zod luego
 * es un reemplazo 1:1 de este archivo, sin tocar el resto del motor.
 */

import {
  GoalType,
  ProgressionType,
  MovementPattern,
  isGoalType,
  isProgressionType,
  isMovementPattern,
} from './enums';
import { MIN_WEIGHT_KG, MAX_WEIGHT_KG, MAX_REPS } from './constants';

/** Error de validación de contrato. Determinístico, sin dependencias de Express. */
export class ProgressionValidationError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(`ProgressionValidationError: ${issues.join('; ')}`);
    this.name = 'ProgressionValidationError';
    this.issues = issues;
  }
}

/** Forma cruda de entrada al motor de progresión (lo que llega del exterior). */
export interface ProgressionInputRaw {
  goal: GoalType;
  progressionType?: ProgressionType;
  movementPattern?: MovementPattern;
  currentWeight: number;
  /** Override explícito del incremento (kg). Si falta, se deriva del patrón. */
  increment?: number;
  /** Reps objetivo por serie (tope del rango para hipertrofia). */
  targetReps: number;
  /** Reps realizadas en cada serie completada, en orden. */
  reps: number[];
}

const isFiniteNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);

const isIntInRange = (v: unknown, min: number, max: number): v is number =>
  isFiniteNumber(v) && Number.isInteger(v) && v >= min && v <= max;

/**
 * Valida y normaliza la entrada del motor.
 * Misma semántica que `zod.parse`: devuelve el objeto tipado o lanza.
 */
export const ProgressionInputSchema = {
  parse(data: unknown): ProgressionInputRaw {
    const issues: string[] = [];
    const d = (data ?? {}) as Record<string, unknown>;

    if (!isGoalType(d.goal)) {
      issues.push("goal: debe ser 'hypertrophy' | 'strength' | 'endurance'");
    }

    if (d.progressionType !== undefined && !isProgressionType(d.progressionType)) {
      issues.push("progressionType: valor no permitido");
    }

    if (d.movementPattern !== undefined && !isMovementPattern(d.movementPattern)) {
      issues.push("movementPattern: debe ser 'upper' | 'lower'");
    }

    if (!isFiniteNumber(d.currentWeight) || d.currentWeight < MIN_WEIGHT_KG || d.currentWeight > MAX_WEIGHT_KG) {
      issues.push(`currentWeight: número entre ${MIN_WEIGHT_KG} y ${MAX_WEIGHT_KG}`);
    }

    if (d.increment !== undefined && (!isFiniteNumber(d.increment) || d.increment <= 0)) {
      issues.push('increment: número positivo');
    }

    if (!isIntInRange(d.targetReps, 1, MAX_REPS)) {
      issues.push(`targetReps: entero entre 1 y ${MAX_REPS}`);
    }

    if (!Array.isArray(d.reps) || d.reps.length === 0) {
      issues.push('reps: arreglo no vacío de reps por serie');
    } else if (!d.reps.every((r) => isIntInRange(r, 0, MAX_REPS))) {
      issues.push(`reps: cada valor entero entre 0 y ${MAX_REPS}`);
    }

    if (issues.length > 0) throw new ProgressionValidationError(issues);

    return {
      goal: d.goal as GoalType,
      progressionType: d.progressionType as ProgressionType | undefined,
      movementPattern: d.movementPattern as MovementPattern | undefined,
      currentWeight: d.currentWeight as number,
      increment: d.increment as number | undefined,
      targetReps: d.targetReps as number,
      reps: (d.reps as number[]).slice(),
    };
  },

  /** Variante segura: no lanza, devuelve discriminated union estilo zod safeParse. */
  safeParse(
    data: unknown
  ): { success: true; data: ProgressionInputRaw } | { success: false; error: ProgressionValidationError } {
    try {
      return { success: true, data: ProgressionInputSchema.parse(data) };
    } catch (e) {
      if (e instanceof ProgressionValidationError) return { success: false, error: e };
      throw e;
    }
  },
};
