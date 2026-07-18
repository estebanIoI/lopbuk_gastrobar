/**
 * members/types.ts
 * Tipos del dominio Personas (Gimnasio).
 * La entidad central es gym_members — el miembro sobrevive a cambios de plan,
 * cancelaciones y reingresos. Todo referencia member_id, nunca user_id directo.
 */

export interface GymMember {
  id: string
  tenantId: string
  userId: string
  memberNumber: string
  photoUrl: string | null
  coverPhotoUrl: string | null
  avatarColor: string
  status: MemberStatus
  joinDate: string | null
  trainerId: string | null
  createdAt: string
  updatedAt: string
}

export type MemberStatus = 'activo' | 'inactivo' | 'congelado' | 'lesionado' | 'dado_de_baja'

export interface GymMemberProfile {
  id: string
  memberId: string
  birthDate: string | null
  sex: 'M' | 'F' | 'otro' | null
  heightCm: number | null
  initialWeightKg: number | null
  bloodType: string | null
  objectiveId: string | null
  level: 'principiante' | 'intermedio' | 'avanzado' | 'elite'
  occupation: string | null
  emergencyContact: string | null
  emergencyPhone: string | null
  medicalNotes: string | null
  allergies: string[] | null
  conditions: string[] | null
  medications: { name: string; dose: string }[] | null
  socialInstagram: string | null
  socialFacebook: string | null
  socialTiktok: string | null
  observations: string | null
  createdAt: string
  updatedAt: string
}

export interface GymObjective {
  id: string
  key: string
  name: string
  icon: string
  isActive: boolean
  sortOrder: number
}

export interface TimelineEvent {
  id: string
  tenantId: string
  memberId: string
  eventType: string
  eventLabel: string
  entityType: string | null
  entityId: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

export interface MemberFullProfile {
  member: GymMember
  user: {
    name: string
    email: string
    phone: string | null
    avatar: string | null
  }
  profile: GymMemberProfile | null
  objective: GymObjective | null
  trainer: {
    id: string
    name: string
  } | null
  stats: {
    totalVisits: number
    currentStreak: number
    lastVisit: string | null
    avgWeight: number | null
    latestBodyFat: number | null
  }
  timeline: TimelineEvent[]
}

export interface CreateMemberInput {
  email: string
  memberNumber?: string
  planName?: string
  price?: number
  paymentCycle?: 'mensual' | 'trimestral' | 'semestral' | 'anual'
  photoUrl?: string
  joinDate?: string
  trainerId?: string
}

export interface UpdateMemberInput {
  photoUrl?: string | null
  coverPhotoUrl?: string | null
  status?: MemberStatus
  trainerId?: string | null
}

export interface UpdateMemberProfileInput {
  birthDate?: string | null
  sex?: 'M' | 'F' | 'otro' | null
  heightCm?: number | null
  initialWeightKg?: number | null
  bloodType?: string | null
  objectiveId?: string | null
  level?: 'principiante' | 'intermedio' | 'avanzado' | 'elite'
  occupation?: string | null
  emergencyContact?: string | null
  emergencyPhone?: string | null
  medicalNotes?: string | null
  allergies?: string[] | null
  conditions?: string[] | null
  medications?: { name: string; dose: string }[] | null
  socialInstagram?: string | null
  socialFacebook?: string | null
  socialTiktok?: string | null
  observations?: string | null
}

export interface MemberListFilters {
  status?: MemberStatus
  trainerId?: string
  objectiveId?: string
  search?: string
  limit?: number
  offset?: number
}
