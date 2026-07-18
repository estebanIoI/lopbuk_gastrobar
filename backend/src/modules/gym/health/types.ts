/**
 * health/types.ts
 * Tipos del dominio Health (Gimnasio).
 * Evaluaciones, mediciones, fotos de progreso, lesiones, analytics.
 */

export interface HealthAssessment {
  id: string
  tenantId: string
  memberId: string
  trainerId: string | null
  assessmentDate: string
  type: 'inicial' | 'periodica' | 'especial' | 'alta'
  weightKg: number | null
  heightCm: number | null
  imc: number | null
  bodyFatPct: number | null
  muscleMassKg: number | null
  bodyWaterPct: number | null
  visceralFat: number | null
  metabolicAge: number | null
  boneMassKg: number | null
  restingHrBpm: number | null
  systolicBp: number | null
  diastolicBp: number | null
  flexibilityScore: number | null
  postureScore: number | null
  mobilityScore: number | null
  painLevel: number | null
  stressLevel: number | null
  sleepHours: number | null
  waterIntakeMl: number | null
  observations: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  measurements?: BodyMeasurements
  photos?: ProgressPhoto[]
  files?: AssessmentFile[]
}

export interface BodyMeasurements {
  id: string
  assessmentId: string | null
  memberId: string
  measurementDate: string
  neckCm: number | null
  shouldersCm: number | null
  chestCm: number | null
  leftArmCm: number | null
  rightArmCm: number | null
  leftForearmCm: number | null
  rightForearmCm: number | null
  waistCm: number | null
  hipCm: number | null
  leftThighCm: number | null
  rightThighCm: number | null
  leftCalfCm: number | null
  rightCalfCm: number | null
  waistHipRatio: number | null
  notes: string | null
  createdAt: string
}

export interface ProgressPhoto {
  id: string
  tenantId: string
  memberId: string
  assessmentId: string | null
  category: 'progreso' | 'evaluacion' | 'lesion' | 'otro'
  label: string | null
  photoUrl: string
  thumbnailUrl: string | null
  viewAngle: 'frontal' | 'lateral' | 'espalda' | 'otro'
  takenAt: string | null
  dayLabel: string | null
  sortOrder: number
  uploadedBy: string | null
  createdAt: string
}

export interface AssessmentFile {
  id: string
  tenantId: string
  memberId: string
  assessmentId: string | null
  category: 'certificado' | 'examen' | 'incapacidad' | 'rx' | 'informe' | 'otro'
  title: string
  fileUrl: string
  fileType: string | null
  fileSize: number | null
  notes: string | null
  uploadedBy: string | null
  createdAt: string
}

export interface MedicalCondition {
  id: string
  tenantId: string
  memberId: string
  type: 'lesion' | 'enfermedad' | 'alergia' | 'condicion' | 'restriccion' | 'cirugia'
  zone: string | null
  description: string
  dateReported: string | null
  status: 'activa' | 'recuperando' | 'recuperada' | 'cronica' | 'controlada'
  severity: 'leve' | 'moderada' | 'grave'
  restrictedExercises: string[] | null
  restrictedMovements: string[] | null
  documentUrl: string | null
  recoveryDate: string | null
  recoveryNotes: string | null
  reportedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface MemberHealthDashboard {
  memberId: string
  latestAssessment: HealthAssessment | null
  assessments: HealthAssessment[]
  photos: ProgressPhoto[]
  conditions: MedicalCondition[]
  activeConditions: MedicalCondition[]
  comparatives: HealthComparatives
  analytics: HealthAnalytics
}

export interface HealthComparatives {
  weight: MetricComparison | null
  bodyFat: MetricComparison | null
  muscleMass: MetricComparison | null
  imc: MetricComparison | null
  waist: MetricComparison | null
  hip: MetricComparison | null
  chest: MetricComparison | null
}

export interface MetricComparison {
  current: number | null
  previous: number | null
  change: number | null
  changePct: number | null
  trend: 'up' | 'down' | 'stable'
  initialValue: number | null
  bestValue: number | null
}

export interface HealthAnalytics {
  totalAssessments: number
  weightLostKg: number | null
  muscleGainedKg: number | null
  bodyFatLostPct: number | null
  daysTracked: number
  firstAssessmentDate: string | null
  lastAssessmentDate: string | null
  imcCategory: string | null
  weeklyAvgWeight: number | null
  bmiImproved: boolean
  bodyFatImproved: boolean
}

export interface CreateAssessmentInput {
  assessmentDate?: string
  type?: 'inicial' | 'periodica' | 'especial' | 'alta'
  weightKg?: number | null
  heightCm?: number | null
  bodyFatPct?: number | null
  muscleMassKg?: number | null
  bodyWaterPct?: number | null
  visceralFat?: number | null
  metabolicAge?: number | null
  boneMassKg?: number | null
  restingHrBpm?: number | null
  systolicBp?: number | null
  diastolicBp?: number | null
  flexibilityScore?: number | null
  postureScore?: number | null
  mobilityScore?: number | null
  painLevel?: number | null
  stressLevel?: number | null
  sleepHours?: number | null
  waterIntakeMl?: number | null
  observations?: string | null
  measurements?: Partial<Omit<BodyMeasurements, 'id' | 'assessmentId' | 'memberId' | 'createdAt'>>
  photos?: { photoUrl: string; viewAngle?: string; label?: string }[]
}

export interface CreatePhotoInput {
  photoUrl: string
  thumbnailUrl?: string | null
  category?: string
  label?: string | null
  viewAngle?: string
  takenAt?: string | null
  dayLabel?: string | null
  assessmentId?: string | null
}

export interface CreateMedicalConditionInput {
  type: 'lesion' | 'enfermedad' | 'alergia' | 'condicion' | 'restriccion' | 'cirugia'
  zone?: string | null
  description: string
  dateReported?: string | null
  status?: string
  severity?: string
  restrictedExercises?: string[] | null
  restrictedMovements?: string[] | null
  documentUrl?: string | null
}
