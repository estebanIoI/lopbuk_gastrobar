'use client'

import { create } from 'zustand'

interface TourState {
  active: boolean
  /** Clave de la guía activa ('main', 'pos', …). */
  tourKey: string
  /** Paso en el que arranca la guía cuando se active. */
  startIndex: number
  /** Lanza una guía (por defecto la principal desde el paso 0). */
  start: (tourKey?: string, atIndex?: number) => void
  /** Cierra la guía. */
  stop: () => void
}

export const useTourStore = create<TourState>((set) => ({
  active: false,
  tourKey: 'main',
  startIndex: 0,
  start: (tourKey = 'main', atIndex = 0) =>
    set({ active: true, tourKey: typeof tourKey === 'string' ? tourKey : 'main', startIndex: atIndex }),
  stop: () => set({ active: false }),
}))
