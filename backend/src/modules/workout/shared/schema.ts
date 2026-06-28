/**
 * Workout Runtime · shared/schema
 * -----------------------------------------------------------------------------
 * Contratos de entrada del runtime. Validación pura estilo zod (`.parse()`),
 * sin dependencias — idéntico criterio que el progression engine.
 */

import { GOAL_TYPES, GoalType, MOVEMENT_PATTERNS, MovementPattern } from '../../progression';

export class WorkoutValidationError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(`WorkoutValidationError: ${issues.join('; ')}`);
    this.name = 'WorkoutValidationError';
    this.issues = issues;
  }
}

const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isInt = (v: unknown, min: number, max: number): v is number =>
  isNum(v) && Number.isInteger(v) && v >= min && v <= max;

/** Un ejercicio planificado al iniciar la sesión. */
export interface StartExerciseInput {
  exerciseId: string;
  name?: string;
  order?: number;
  targetSets: number;
  targetReps: number;
  suggestedWeight: number;
  movementPattern?: MovementPattern;
}

export interface StartSessionInput {
  routineId?: string;
  goal: GoalType;
  exercises: StartExerciseInput[];
}

export const StartSessionSchema = {
  parse(data: unknown): StartSessionInput {
    const issues: string[] = [];
    const d = (data ?? {}) as Record<string, unknown>;

    const goal = (d.goal ?? 'hypertrophy') as unknown;
    if (typeof goal !== 'string' || !(GOAL_TYPES as readonly string[]).includes(goal)) {
      issues.push(`goal: uno de ${GOAL_TYPES.join('|')}`);
    }

    if (d.routineId !== undefined && d.routineId !== null && typeof d.routineId !== 'string') {
      issues.push('routineId: string opcional');
    }

    const rawEx = d.exercises;
    const exercises: StartExerciseInput[] = [];
    if (!Array.isArray(rawEx) || rawEx.length === 0) {
      issues.push('exercises: arreglo no vacío');
    } else {
      rawEx.forEach((raw, i) => {
        const e = (raw ?? {}) as Record<string, unknown>;
        const tag = `exercises[${i}]`;
        if (!isStr(e.exerciseId)) issues.push(`${tag}.exerciseId: requerido`);
        if (!isInt(e.targetSets, 1, 20)) issues.push(`${tag}.targetSets: entero 1..20`);
        if (!isInt(e.targetReps, 1, 100)) issues.push(`${tag}.targetReps: entero 1..100`);
        if (!isNum(e.suggestedWeight) || (e.suggestedWeight as number) < 0)
          issues.push(`${tag}.suggestedWeight: número ≥ 0`);
        if (
          e.movementPattern !== undefined &&
          !(MOVEMENT_PATTERNS as readonly string[]).includes(e.movementPattern as string)
        )
          issues.push(`${tag}.movementPattern: upper|lower`);

        if (issues.length === 0) {
          exercises.push({
            exerciseId: (e.exerciseId as string).trim(),
            name: isStr(e.name) ? (e.name as string).trim() : undefined,
            order: isInt(e.order, 0, 999) ? (e.order as number) : i,
            targetSets: e.targetSets as number,
            targetReps: e.targetReps as number,
            suggestedWeight: e.suggestedWeight as number,
            movementPattern: e.movementPattern as MovementPattern | undefined,
          });
        }
      });
    }

    if (issues.length > 0) throw new WorkoutValidationError(issues);

    return {
      routineId: typeof d.routineId === 'string' ? d.routineId : undefined,
      goal: goal as GoalType,
      exercises,
    };
  },
};

export interface CompleteSetInput {
  completedReps: number;
  usedWeight: number;
}

export const CompleteSetSchema = {
  parse(data: unknown): CompleteSetInput {
    const issues: string[] = [];
    const d = (data ?? {}) as Record<string, unknown>;
    if (!isInt(d.completedReps, 0, 100)) issues.push('completedReps: entero 0..100');
    if (!isNum(d.usedWeight) || (d.usedWeight as number) < 0 || (d.usedWeight as number) > 1000)
      issues.push('usedWeight: número 0..1000');
    if (issues.length > 0) throw new WorkoutValidationError(issues);
    return { completedReps: d.completedReps as number, usedWeight: d.usedWeight as number };
  },
};
