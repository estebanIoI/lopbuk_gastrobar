'use client'

import { create } from 'zustand'
import { api } from './api'
import type { CashSession, CashMovement, CashSessionTotals } from './types'

interface CashStore {
  activeSession: CashSession | null
  totals: CashSessionTotals | null
  movements: CashMovement[]
  sessionHistory: CashSession[]
  isLoading: boolean

  fetchActiveSession: () => Promise<void>
  fetchTotals: () => Promise<void>
  fetchMovements: () => Promise<void>
  fetchHistory: () => Promise<void>

  openSession: (openingAmount: number, userName: string, opts?: {
    shiftType?: 'mañana' | 'tarde' | 'unico'
    employees?: { userId?: string | null; name: string; role?: string | null; shiftValue?: number }[]
  }) => Promise<{ success: boolean; data?: CashSession; error?: string }>

  closeSession: (actualCash: number, userName: string, opts?: {
    observations?: string
    bonuses?: { shiftEmpId: string; type: 'bono' | 'descuento'; amount: number; concept?: string | null }[]
  }) => Promise<{ success: boolean; data?: CashSession; error?: string }>

  addMovement: (data: {
    type: 'entrada' | 'salida'
    amount: number
    reason: string
    notes?: string
    userName?: string
  }) => Promise<{ success: boolean; error?: string }>

  reset: () => void
}

export const useCashStore = create<CashStore>((set, get) => ({
  activeSession: null,
  totals: null,
  movements: [],
  sessionHistory: [],
  isLoading: true,

  fetchActiveSession: async () => {
    set({ isLoading: true })
    const result = await api.getActiveCashSession()
    set({
      activeSession: result.success ? (result.data || null) : null,
      isLoading: false,
    })
  },

  fetchTotals: async () => {
    const { activeSession } = get()
    if (!activeSession) return
    const result = await api.getCashSessionTotals(activeSession.id)
    if (result.success && result.data) set({ totals: result.data })
  },

  fetchMovements: async () => {
    const { activeSession } = get()
    if (!activeSession) return
    const result = await api.getCashMovements(activeSession.id)
    if (result.success && result.data) {
      set({ movements: Array.isArray(result.data) ? result.data : [] })
    }
  },

  fetchHistory: async () => {
    const result = await api.getCashSessions({ limit: 10, status: 'cerrada' })
    if (result.success && result.data) {
      set({ sessionHistory: Array.isArray(result.data) ? result.data : [] })
    }
  },

  openSession: async (openingAmount, userName, opts) => {
    const result = await api.openCashSession(openingAmount, userName, opts)
    if (result.success && result.data) {
      set({ activeSession: result.data, totals: null, movements: [] })
      return { success: true, data: result.data }
    }
    return { success: false, error: result.error }
  },

  closeSession: async (actualCash, userName, opts) => {
    const { activeSession } = get()
    if (!activeSession) return { success: false, error: 'No hay sesión activa' }
    const result = await api.closeCashSession(activeSession.id, {
      actualCash,
      observations: opts?.observations,
      userName,
      bonuses: opts?.bonuses,
    })
    return result
  },

  addMovement: async (data) => {
    const { activeSession } = get()
    if (!activeSession) return { success: false, error: 'No hay sesión activa' }
    const result = await api.addCashMovement(activeSession.id, data)
    return result
  },

  reset: () => {
    set({ activeSession: null, totals: null, movements: [] })
  },
}))
