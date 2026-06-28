/**
 * workout-api.ts
 * Cliente del WORKOUT RUNTIME. Módulo aparte (no toca el api.ts gigante).
 * Reutiliza el mismo esquema de auth: cookie httpOnly (credentials:'include')
 * + Bearer en memoria como fallback (tomado del ApiService existente).
 *
 * REGLA: el front NO calcula progresión. Solo envía lo realizado y RENDERIZA
 * las decisiones (`action`, `nextWeight`) que devuelve el backend.
 */

import { api } from './api'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

export type ProgressionAction = 'increase' | 'maintain' | 'decrease'

export interface WorkoutSet {
  id: string
  setNumber: number
  targetReps: number
  completedReps: number | null
  targetWeight: number
  usedWeight: number | null
  completed: boolean
  completedAt: string | null
}

export interface WorkoutExercise {
  id: string
  exerciseId: string
  name: string | null
  order: number
  targetSets: number
  targetReps: number
  suggestedWeight: number
  movementPattern: 'upper' | 'lower' | null
  completed: boolean
  sets: WorkoutSet[]
}

export interface WorkoutSession {
  id: string
  userId: string
  routineId: string | null
  goal: string
  status: 'pending' | 'active' | 'paused' | 'completed' | 'cancelled'
  startedAt: string | null
  completedAt: string | null
  durationSeconds: number | null
  totalVolume: number
  currentExerciseIndex: number
  exercises: WorkoutExercise[]
}

export interface ProgressionDecisionView {
  exerciseId: string
  name: string | null
  action: ProgressionAction
  currentWeight: number
  nextWeight: number
  reasons: string[]
  completionRate: number
}

export interface WorkoutSummary {
  session: WorkoutSession
  durationSeconds: number
  totalVolume: number
  decisions: ProgressionDecisionView[]
  prCount: number
}

interface Envelope<T> { success: boolean; data?: T; error?: string }

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<Envelope<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers as Record<string, string> || {}) }
  const token = api.getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  try {
    const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers, credentials: 'include' })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return { success: false, error: json?.error || json?.message || 'Error en la solicitud' }
    return json as Envelope<T>
  } catch (e: any) {
    return { success: false, error: e?.message || 'Error de red' }
  }
}

export const workoutApi = {
  /** Inicia la sesión de hoy (backend ensambla plan + pesos sugeridos). */
  startToday(sessionTitle?: string, routineId?: string) {
    return request<WorkoutSession>('/workouts/start-today', {
      method: 'POST',
      body: JSON.stringify({ sessionTitle, routineId }),
    })
  },
  get(sessionId: string) {
    return request<WorkoutSession>(`/workouts/${sessionId}`)
  },
  completeSet(sessionId: string, setId: string, completedReps: number, usedWeight: number) {
    return request<{ session: WorkoutSession; exerciseCompleted: boolean }>(
      `/workouts/${sessionId}/sets/${setId}/complete`,
      { method: 'POST', body: JSON.stringify({ completedReps, usedWeight }) }
    )
  },
  pause(sessionId: string) { return request<WorkoutSession>(`/workouts/${sessionId}/pause`, { method: 'POST' }) },
  resume(sessionId: string) { return request<WorkoutSession>(`/workouts/${sessionId}/resume`, { method: 'POST' }) },
  cancel(sessionId: string) { return request<WorkoutSession>(`/workouts/${sessionId}/cancel`, { method: 'POST' }) },
  complete(sessionId: string) { return request<WorkoutSummary>(`/workouts/${sessionId}/complete`, { method: 'POST' }) },
}
