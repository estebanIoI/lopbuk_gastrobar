/**
 * Workout Runtime · API pública del módulo
 * -----------------------------------------------------------------------------
 * V1 (Fase 5): persistencia + endpoints + puente al progression engine.
 * Sin frontend, sin sockets, sin IA runtime, sin fatigue engine todavía.
 */

export { default as workoutRoutes } from './workout.routes';
export { ensureWorkoutSchema } from './infrastructure/persistence/schema';

// Servicios (por si otros módulos del backend los necesitan)
export * as workoutSessionService from './application/services/workout-session.service';
export * as setTrackingService from './application/services/set-tracking.service';

// Integración de eventos (para suscriptores futuros: analytics, XP, IA)
export { onWorkoutEvent, publishWorkoutEvent } from './application/events/publisher';
export {
  WORKOUT_STARTED, SET_COMPLETED, EXERCISE_COMPLETED, WORKOUT_COMPLETED,
} from './application/events/workout-events';
export type { WorkoutEvent } from './application/events/workout-events';

// Entidades / state machine (reutilizables y testeables)
export type { WorkoutSession, WorkoutExercise, WorkoutSet } from './domain/entities/types';
export { SessionStateMachine, InvalidSessionTransitionError } from './domain/state-machine/session-state-machine';
export { SESSION_STATUSES } from './shared/enums';
export type { SessionStatus } from './shared/enums';
