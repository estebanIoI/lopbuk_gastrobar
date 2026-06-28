/**
 * Progression Engine · application/events
 * -----------------------------------------------------------------------------
 * Evento de dominio emitido tras computar una decisión. Forma estable para que
 * otros módulos (analytics, gamificación, IA coach, notificaciones) reaccionen
 * sin acoplarse al motor. El motor NO publica nada por sí mismo todavía
 * (la publicación se cablea en Fase 5); aquí definimos solo el contrato + factory.
 */

import { ProgressionDecision } from '../../domain/entities/types';
import { GoalType } from '../../shared/enums';

export const PROGRESSION_COMPUTED = 'progression_computed' as const;

export interface ProgressionComputedEvent {
  type: typeof PROGRESSION_COMPUTED;
  userId: string;
  exerciseId: string;
  goal: GoalType;
  oldWeight: number;
  newWeight: number;
  action: ProgressionDecision['action'];
  completionRate: number;
  occurredAt: string; // ISO 8601
}

export function buildProgressionComputedEvent(params: {
  userId: string;
  exerciseId: string;
  goal: GoalType;
  oldWeight: number;
  decision: ProgressionDecision;
  occurredAt?: Date;
}): ProgressionComputedEvent {
  return {
    type: PROGRESSION_COMPUTED,
    userId: params.userId,
    exerciseId: params.exerciseId,
    goal: params.goal,
    oldWeight: params.oldWeight,
    newWeight: params.decision.nextWeight,
    action: params.decision.action,
    completionRate: params.decision.metrics.completionRate,
    occurredAt: (params.occurredAt ?? new Date()).toISOString(),
  };
}
