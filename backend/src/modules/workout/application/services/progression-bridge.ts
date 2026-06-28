/**
 * Workout Runtime · application/services/progression-bridge
 * -----------------------------------------------------------------------------
 * Puente PURO entre el runtime y el progression engine. Traduce un ejercicio
 * ejecutado en un input válido del motor y devuelve la decisión + snapshot.
 *
 * No toca DB. No decide nada por su cuenta: delega 100% en ProgressionService.
 * Si el ejercicio no tiene sets completados, devuelve null (no hay señal).
 */

import { progressionService, ProgressionDecision, GoalType } from '../../../progression';
import { WorkoutExercise } from '../../domain/entities/types';
import { ExerciseProgressionSnapshot } from '../../domain/entities/types';
import { workingWeight, completedRepsOf } from '../../domain/calculators/session-metrics';

export interface ExerciseProgressionResult {
  exerciseId: string;
  decision: ProgressionDecision;
  snapshot: ExerciseProgressionSnapshot;
  currentWeight: number;
}

export function computeExerciseProgression(
  exercise: WorkoutExercise,
  goal: GoalType
): ExerciseProgressionResult | null {
  const reps = completedRepsOf(exercise.sets);
  if (reps.length === 0) return null;

  const current = workingWeight(exercise.sets) ?? exercise.suggestedWeight;

  const decision = progressionService.compute({
    goal,
    movementPattern: exercise.movementPattern ?? undefined,
    currentWeight: current,
    targetReps: exercise.targetReps,
    reps,
  });

  const snapshot: ExerciseProgressionSnapshot = {
    exerciseId: exercise.exerciseId,
    currentWeight: current,
    nextWeight: decision.nextWeight,
    action: decision.action,
    completionRate: decision.metrics.completionRate,
    estimated1RM: decision.metrics.estimated1RM,
  };

  return { exerciseId: exercise.exerciseId, decision, snapshot, currentWeight: current };
}
