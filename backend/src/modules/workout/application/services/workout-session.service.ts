/**
 * Workout Runtime · application/services/workout-session
 * -----------------------------------------------------------------------------
 * Orquesta el ciclo de vida de la sesión. NO contiene reglas fitness ni de
 * progresión (eso vive en el progression engine). Toda transición de estado
 * pasa por la máquina de estados; toda DB pasa por el repository.
 */

import { AppError } from '../../../../common/middleware';
import * as repo from '../../infrastructure/repositories/workout.repository';
import { WorkoutSession } from '../../domain/entities/types';
import { SessionStatus } from '../../shared/enums';
import { StartSessionSchema } from '../../shared/schema';
import { SessionStateMachine } from '../../domain/state-machine/session-state-machine';
import { sessionVolume } from '../../domain/calculators/session-metrics';
import { computeExerciseProgression } from './progression-bridge';
import { WorkoutEvents } from '../events/workout-events';
import { publishWorkoutEvent } from '../events/publisher';
import { buildProgressionComputedEvent } from '../../../progression';

async function loadOrThrow(userId: string, sessionId: string): Promise<WorkoutSession> {
  const session = await repo.getDeepSession(userId, sessionId);
  if (!session) throw new AppError('Sesión de entrenamiento no encontrada', 404);
  return session;
}

/** Inicia una sesión a partir de la rutina/ejercicios provistos. */
export async function startSession(userId: string, rawBody: unknown): Promise<WorkoutSession> {
  const input = StartSessionSchema.parse(rawBody);
  const id = await repo.createSession(userId, input);
  publishWorkoutEvent(WorkoutEvents.started(userId, id, input.exercises.length));
  return loadOrThrow(userId, id);
}

export async function getSession(userId: string, sessionId: string): Promise<WorkoutSession> {
  return loadOrThrow(userId, sessionId);
}

export async function listSessions(userId: string, limit?: number) {
  return repo.listSessions(userId, limit);
}

/** Transición de estado simple (pause/resume/cancel) validada por la máquina. */
async function transition(userId: string, sessionId: string, to: SessionStatus): Promise<WorkoutSession> {
  const current = await repo.getSessionStatus(userId, sessionId);
  if (!current) throw new AppError('Sesión de entrenamiento no encontrada', 404);
  SessionStateMachine.assertTransition(current.status, to);
  await repo.updateStatus(userId, sessionId, to);
  return loadOrThrow(userId, sessionId);
}

export const pauseSession = (userId: string, sessionId: string) => transition(userId, sessionId, 'paused');
export const resumeSession = (userId: string, sessionId: string) => transition(userId, sessionId, 'active');
export const cancelSession = (userId: string, sessionId: string) => transition(userId, sessionId, 'cancelled');

export interface WorkoutSummary {
  session: WorkoutSession;
  durationSeconds: number;
  totalVolume: number;
  decisions: Array<{
    exerciseId: string;
    name: string | null;
    action: 'increase' | 'maintain' | 'decrease';
    currentWeight: number;
    nextWeight: number;
    reasons: string[];
    completionRate: number;
  }>;
  prCount: number;
}

/**
 * Completa la sesión: calcula duración/volumen, corre el progression engine por
 * cada ejercicio con sets completados, persiste snapshots y publica eventos.
 * AQUÍ nace la conexión entre el runtime y el motor determinístico.
 */
export async function completeSession(userId: string, sessionId: string): Promise<WorkoutSummary> {
  const status = await repo.getSessionStatus(userId, sessionId);
  if (!status) throw new AppError('Sesión de entrenamiento no encontrada', 404);
  // active → completed (también permitimos desde paused reanudando lógicamente).
  if (status.status === 'paused') {
    SessionStateMachine.assertTransition('paused', 'active');
    await repo.updateStatus(userId, sessionId, 'active');
  }
  SessionStateMachine.assertTransition('active', 'completed');

  const session = await loadOrThrow(userId, sessionId);

  const completedAt = new Date();
  const startedAt = session.startedAt ? new Date(session.startedAt) : completedAt;
  const durationSeconds = Math.max(0, Math.round((completedAt.getTime() - startedAt.getTime()) / 1000));
  const totalVolume = sessionVolume(session.exercises);

  const decisions: WorkoutSummary['decisions'] = [];
  let prCount = 0;

  for (const exercise of session.exercises) {
    const result = computeExerciseProgression(exercise, session.goal);
    if (!result) continue;

    const prev = await repo.getProgression(userId, exercise.exerciseId);
    await repo.upsertProgression(userId, result.snapshot);

    // PR simple: superó la mejor carga histórica conocida.
    if (prev && result.snapshot.currentWeight > prev.currentWeight && result.decision.action === 'increase') prCount++;
    else if (!prev && result.decision.action === 'increase') prCount++;

    decisions.push({
      exerciseId: exercise.exerciseId,
      name: exercise.name,
      action: result.decision.action,
      currentWeight: result.currentWeight,
      nextWeight: result.decision.nextWeight,
      reasons: result.decision.reasons,
      completionRate: result.decision.metrics.completionRate,
    });

    publishWorkoutEvent(
      buildProgressionComputedEvent({
        userId,
        exerciseId: exercise.exerciseId,
        goal: session.goal,
        oldWeight: result.currentWeight,
        decision: result.decision,
        occurredAt: completedAt,
      })
    );
  }

  await repo.updateStatus(userId, sessionId, 'completed', { completedAt, durationSeconds, totalVolume });

  publishWorkoutEvent(
    WorkoutEvents.workoutCompleted(
      userId,
      sessionId,
      durationSeconds,
      totalVolume,
      decisions.map((d) => ({ exerciseId: d.exerciseId, action: d.action, nextWeight: d.nextWeight }))
    )
  );

  const finalSession = await loadOrThrow(userId, sessionId);
  return { session: finalSession, durationSeconds, totalVolume, decisions, prCount };
}
