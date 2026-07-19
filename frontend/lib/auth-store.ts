'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from './types'
import { api } from './api'
import { useStore } from './store'

/**
 * Descarta el estado persistido que pertenece al usuario/comercio anterior.
 * `store.ts` no importa este módulo, así que no hay ciclo.
 * Nunca puede tumbar el login/logout: si algo falla, se ignora.
 */
function resetAppSession() {
  try { useStore.getState().resetSession() } catch { /* no bloquea la sesión */ }
}

interface AuthStore {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  isCheckingAuth: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; attemptsLeft?: number; lockedUntil?: number }>
  googleLogin: (credential: string, storeSlug?: string) => Promise<{ success: boolean; error?: string }>
  register: (email: string, password: string, name: string, role: 'comerciante' | 'vendedor') => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  updateProfile: (updates: {
    name?: string; avatar?: string; phone?: string; cedula?: string;
    department?: string; municipality?: string; address?: string;
    neighborhood?: string; deliveryLatitude?: number; deliveryLongitude?: number;
  }) => Promise<{ success: boolean; error?: string }>
  checkAuth: () => Promise<void>
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isCheckingAuth: true,

      login: async (email: string, password: string) => {
        set({ isLoading: true })

        const result = await api.login(email, password)

        if (result.success && result.data) {
          // Si entra un usuario distinto al del navegador, se descarta el
          // estado persistido del anterior (sección abierta, carrito del POS,
          // datos de facturación). Sin esto se veía la pantalla de la sesión
          // previa al iniciar con otras credenciales.
          if (get().user?.id !== result.data.user?.id) resetAppSession()
          set({
            user: result.data.user,
            isAuthenticated: true,
            isLoading: false
          })
          return { success: true }
        }

        set({ isLoading: false })
        return { success: false, error: result.error, attemptsLeft: result.attemptsLeft, lockedUntil: result.lockedUntil }
      },

      googleLogin: async (credential: string, storeSlug?: string) => {
        set({ isLoading: true })

        const result = await api.googleLogin(credential, storeSlug)

        if (result.success && result.data) {
          if (get().user?.id !== result.data.user?.id) resetAppSession()
          set({
            user: result.data.user,
            isAuthenticated: true,
            isLoading: false
          })
          return { success: true }
        }

        set({ isLoading: false })
        return { success: false, error: result.error || 'Error al iniciar sesion con Google' }
      },

      register: async (email: string, password: string, name: string, role: 'comerciante' | 'vendedor') => {
        set({ isLoading: true })

        if (password.length < 6) {
          set({ isLoading: false })
          return { success: false, error: 'La contraseña debe tener al menos 6 caracteres' }
        }

        const result = await api.register(email, password, name, role)

        if (result.success && result.data) {
          set({
            user: result.data.user,
            isAuthenticated: true,
            isLoading: false
          })
          return { success: true }
        }

        set({ isLoading: false })
        return { success: false, error: result.error || 'Error al registrar usuario' }
      },

      logout: async () => {
        await api.logout()
        resetAppSession()
        set({
          user: null,
          isAuthenticated: false
        })
      },

      updateProfile: async (updates: {
        name?: string; avatar?: string; phone?: string; cedula?: string;
        department?: string; municipality?: string; address?: string;
        neighborhood?: string; deliveryLatitude?: number; deliveryLongitude?: number;
      }) => {
        const result = await api.updateProfile(updates)

        if (result.success && result.data) {
          set(state => ({
            user: state.user ? { ...state.user, ...result.data } : null
          }))
          return { success: true }
        }

        return { success: false, error: result.error || 'Error al actualizar perfil' }
      },

      checkAuth: async () => {
        set({ isCheckingAuth: true })
        // Token is in an httpOnly cookie — invisible to JS.
        // Always call getProfile(); the browser sends the cookie automatically.
        const result = await api.getProfile()
        if (result.success && result.data) {
          set({
            user: result.data,
            isAuthenticated: true,
            isCheckingAuth: false,
          })
        } else {
          await api.logout()
          set({ user: null, isAuthenticated: false, isCheckingAuth: false })
        }
      }
    }),
    {
      name: 'lopbuk-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
)
