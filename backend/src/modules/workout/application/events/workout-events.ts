/**
 * Workout Runtime · application/events
 * -----------------------------------------------------------------------------
 * Contratos de eventos de dominio del runtime. Forma estable para que otros
 * módulos (analytics, gamificación XP, IA coach, push) reaccionen sin acoplarse.
 * La PUBLICACIÓN real a un bus se cablea aparte; aquí viven contrato + builders.
 *
 * El evento de progresión vive en el módulo `progression` y se reexporta.
 */

import { ProgressionDecision } from '../../../progression';

export const WORKOUT_STARTED = 'workout_started' as const;
export const SET_COMPLETED = 'set_completed' as const;
export const EXERCISE_COMPLETED = 'exercise_completed' as const;
export const WORKOUT_COMPLETED = 'workout_completed' as const;

export type WorkoutEventType =
  | typeof WORKOUT_STARTED
  | typeof SET_COMPLETED
  | typeof EXERCISE_COMPLETED
  | typeof WORKOUT_COMPLETED;

interface BaseEvent {
  userId: string;
  sessionId: string;
  occurredAt: string;
}

export interface WorkoutStartedEvent extends BaseEvent {
  type: typeof WORKOUT_STARTED;
  exerciseCount: number;
}
export interface SetCompletedEvent extends BaseEvent {
  type: typeof SET_COMPLETED;
  exerciseSessionId: string;
  setId: string;
  completedReps: number;
  usedWeight: number;
}
export interface ExerciseCompletedEvent extends BaseEvent {
  type: typeof EXERCISE_COMPLETED;
  exerciseSessionId: string;
}
export interface WorkoutCompletedEvent extends BaseEvent {
  type: typeof WORKOUT_COMPLETED;
  durationSeconds: number;
  totalVolume: number;
  decisions: Array<{ exerciseId: string } & Pick<ProgressionDecision, 'action' | 'nextWeight'>>;
}

export type WorkoutEvent =
  | WorkoutStartedEvent
  | SetCompletedEvent
  | ExerciseCompletedEvent
  | WorkoutCompletedEvent;

const nowIso = (d?: Date) => (d ?? new Date()).toISOString();

export const WorkoutEvents = {
  started(userId: string, sessionId: string, exerciseCount: number): WorkoutStartedEvent {
    return { type: WORKOUT_STARTED, userId, sessionId, exerciseCount, occurredAt: nowIso() };
  },
  setCompleted(
    userId: string,
    sessionId: string,
    exerciseSessionId: string,
    setId: string,
    completedReps: number,
    usedWeight: number
  ): SetCompletedEvent {
    return {
      type: SET_COMPLETED, userId, sessionId, exerciseSessionId, setId,
      completedReps, usedWeight, occurredAt: nowIso(),
    };
  },
  exerciseCompleted(userId: string, sessionId: string, exerciseSessionId: string): ExerciseCompletedEvent {
    return { type: EXERCISE_COMPLETED, userId, sessionId, exerciseSessionId, occurredAt: nowIso() };
  },
  workoutCompleted(
    userId: string,
    sessionId: string,
    durationSeconds: number,
    totalVolume: number,
    decisions: WorkoutCompletedEvent['decisions']
  ): WorkoutCompletedEvent {
    return {
      type: WORKOUT_COMPLETED, userId, sessionId, durationSeconds, totalVolume, decisions,
      occurredAt: nowIso(),
    };
  },
};
