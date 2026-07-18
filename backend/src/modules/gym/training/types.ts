/**
 * training/types.ts
 * Tipos del dominio Training (Gimnasio).
 * Biblioteca de ejercicios, plantillas, asignaciones, sesiones, records.
 */

export interface ExerciseCategory {
  id: string
  name: string
  icon: string | null
  sortOrder: number
}

export interface ExerciseLibraryItem {
  id: string
  tenantId: string
  categoryId: string | null
  name: string
  slug: string | null
  description: string | null
  muscleGroup: string
  secondaryMuscles: string[] | null
  equipment: string | null
  difficulty: 'principiante' | 'intermedio' | 'avanzado'
  movementPattern: string | null
  tips: string | null
  commonErrors: string | null
  alternatives: { id: string; name: string }[] | null
  rpeRecommendation: number | null
  tempo: string | null
  restSeconds: number | null
  estimatedKcal: number | null
  estimatedSeconds: number | null
  isActive: boolean
  popularity: number
  createdBy: string | null
  createdAt: string
  updatedAt: string
  categoryName?: string
  media?: ExerciseMedia[]
  isFavorite?: boolean
}

export interface ExerciseMedia {
  id: string
  exerciseId: string
  kind: 'gif' | 'video' | 'image'
  url: string
  thumbnailUrl: string | null
  width: number | null
  height: number | null
  attribution: string | null
  sortOrder: number
}

export interface ExerciseFavorite {
  id: string
  tenantId: string
  exerciseId: string
  staffUserId: string
  createdAt: string
}

export interface WorkoutTemplate {
  id: string
  tenantId: string
  name: string
  description: string | null
  category: string | null
  weeks: number
  daysPerWeek: number | null
  isActive: boolean
  createdBy: string | null
  createdAt: string
  updatedAt: string
  exercises?: WorkoutTemplateExerciseGrouped[]
}

export interface WorkoutTemplateExercise {
  id: string
  templateId: string
  exerciseId: string
  weekNumber: number
  dayNumber: number
  dayLabel: string | null
  targetSets: number
  targetReps: string | null
  startWeight: number | null
  rpeTarget: number | null
  tempo: string | null
  restSeconds: number | null
  progressionType: 'linear' | 'double_progression' | 'wave' | 'rpe' | 'manual'
  progressionConfig: Record<string, unknown> | null
  notes: string | null
  sortOrder: number
  exercise?: ExerciseLibraryItem
}

export interface WorkoutTemplateExerciseGrouped {
  weekNumber: number
  days: {
    dayNumber: number
    dayLabel: string | null
    exercises: WorkoutTemplateExercise[]
  }[]
}

export interface WorkoutAssignment {
  id: string
  tenantId: string
  templateId: string
  memberId: string
  startDate: string | null
  startWeek: number
  status: 'activo' | 'completado' | 'abandonado' | 'pausado'
  assignedBy: string | null
  completedAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  template?: WorkoutTemplate
  memberName?: string
}

export interface WorkoutSession {
  id: string
  tenantId: string
  memberId: string
  assignmentId: string | null
  weekNumber: number | null
  dayNumber: number | null
  dayLabel: string | null
  startedAt: string
  endedAt: string | null
  durationMin: number | null
  perceivedEffort: number | null
  notes: string | null
  createdAt: string
  exercises?: WorkoutSessionExercise[]
}

export interface WorkoutSessionExercise {
  id: string
  sessionId: string
  exerciseId: string | null
  exerciseName: string
  sortOrder: number
  notes: string | null
  sets?: WorkoutSet[]
  exercise?: ExerciseLibraryItem
}

export interface WorkoutSet {
  id: string
  sessionExerciseId: string
  setNumber: number
  weightKg: number | null
  reps: number | null
  rpe: number | null
  isWarmup: boolean
  isFailure: boolean
  isSkipped: boolean
  isExtra: boolean
  restSeconds: number | null
  durationSeconds: number | null
  notes: string | null
  createdAt: string
}

export interface PersonalRecord {
  id: string
  tenantId: string
  memberId: string
  exerciseId: string | null
  exerciseName: string
  recordType: 'max_weight' | 'max_reps' | 'max_volume' | 'max_tonnage' | 'max_duration' | 'max_frequency'
  value: number
  unit: string
  sessionId: string | null
  achievedAt: string
  previousValue: number | null
  createdAt: string
}

// ─── Inputs ──────────────────────────────────────────────────────────

export interface CreateExerciseInput {
  name: string
  categoryId?: string | null
  description?: string | null
  muscleGroup: string
  secondaryMuscles?: string[] | null
  equipment?: string | null
  difficulty?: 'principiante' | 'intermedio' | 'avanzado'
  movementPattern?: string | null
  tips?: string | null
  commonErrors?: string | null
  alternatives?: { id: string; name: string }[] | null
  rpeRecommendation?: number | null
  tempo?: string | null
  restSeconds?: number | null
  estimatedKcal?: number | null
  estimatedSeconds?: number | null
  media?: Omit<ExerciseMedia, 'id' | 'exerciseId'>[]
}

export interface CreateTemplateInput {
  name: string
  description?: string | null
  category?: string | null
  weeks?: number
  daysPerWeek?: number | null
  exercises?: Omit<WorkoutTemplateExercise, 'id' | 'templateId' | 'exercise'>[]
}

export interface AssignTemplateInput {
  templateId: string
  memberIds: string[]
  startDate?: string
  startWeek?: number
}

export interface StartSessionInput {
  assignmentId?: string | null
  weekNumber?: number | null
  dayNumber?: number | null
  dayLabel?: string | null
  exercises: { exerciseId: string; exerciseName: string; sortOrder: number }[]
}

export interface LogSetInput {
  sessionExerciseId: string
  setNumber: number
  weightKg?: number | null
  reps?: number | null
  rpe?: number | null
  isWarmup?: boolean
  isFailure?: boolean
  isSkipped?: boolean
  isExtra?: boolean
  restSeconds?: number | null
  durationSeconds?: number | null
  notes?: string | null
}

export interface TrainingFilters {
  muscleGroup?: string
  equipment?: string
  difficulty?: string
  categoryId?: string
  search?: string
  limit?: number
  offset?: number
}
