/**
 * Workout Runtime · application/services/set-tracking
 * -----------------------------------------------------------------------------
 * Registro de sets durante la sesión. Solo se puede registrar en una sesión
 * 'active'. No calcula progresión (eso ocurre al completar la sesión).
 */

import { AppError } from '../../../../common/middleware';
import * as repo from '../../infrastructure/repositories/workout.repository';
import { CompleteSetSchema } from '../../shared/schema';
import { WorkoutEvents } from '../events/workout-events';
import { publishWorkoutEvent } from '../events/publisher';
import { WorkoutSession } from '../../domain/entities/types';

export interface CompleteSetResult {
  session: WorkoutSession;
  exerciseCompleted: boolean;
}

export async function completeSet(
  userId: string,
  sessionId: string,
  setId: string,
  rawBody: unknown
): Promise<CompleteSetResult> {
  const { completedReps, usedWeight } = CompleteSetSchema.parse(rawBody);

  const status = await repo.getSessionStatus(userId, sessionId);
  if (!status) throw new AppError('Sesión de entrenamiento no encontrada', 404);
  if (status.status !== 'active') {
    throw new AppError(`No se pueden registrar sets en una sesión '${status.status}'`, 409);
  }

  const exerciseSessionId = await repo.completeSet(userId, sessionId, setId, completedReps, usedWeight);
  if (!exerciseSessionId) throw new AppError('Set no encontrado en esta sesión', 404);

  publishWorkoutEvent(
    WorkoutEvents.setCompleted(userId, sessionId, exerciseSessionId, setId, completedReps, usedWeight)
  );

  const exerciseCompleted = await repo.refreshExerciseCompletion(userId, exerciseSessionId);
  if (exerciseCompleted) {
    publishWorkoutEvent(WorkoutEvents.exerciseCompleted(userId, sessionId, exerciseSessionId));
  }

  const session = await repo.getDeepSession(userId, sessionId);
  if (!session) throw new AppError('Sesión de entrenamiento no encontrada', 404);
  return { session, exerciseCompleted };
}
