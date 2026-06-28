/**
 * Workout Runtime · domain/entities
 * -----------------------------------------------------------------------------
 * Entidades runtime. Forma estable que viaja entre repository ↔ service ↔ API.
 */

import { SessionStatus } from '../../shared/enums';
import { GoalType, MovementPattern } from '../../../progression';

export interface WorkoutSet {
  id: string;
  setNumber: number;
  targetReps: number;
  completedReps: number | null;
  targetWeight: number;
  usedWeight: number | null;
  completed: boolean;
  completedAt: string | null;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  name: string | null;
  order: number;
  targetSets: number;
  targetReps: number;
  suggestedWeight: number;
  movementPattern: MovementPattern | null;
  completed: boolean;
  sets: WorkoutSet[];
}

export interface WorkoutSession {
  id: string;
  userId: string;
  routineId: string | null;
  goal: GoalType;
  status: SessionStatus;
  startedAt: string | null;
  completedAt: string | null;
  durationSeconds: number | null;
  totalVolume: number;
  currentExerciseIndex: number;
  exercises: WorkoutExercise[];
}

/** Snapshot de progresión persistido por ejercicio (source of truth, no recálculo). */
export interface ExerciseProgressionSnapshot {
  exerciseId: string;
  currentWeight: number;
  nextWeight: number;
  action: 'increase' | 'maintain' | 'decrease';
  completionRate: number;
  estimated1RM: number;
}
