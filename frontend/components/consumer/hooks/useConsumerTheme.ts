'use client'

/**
 * useConsumerTheme — ambiente del Consumer OS (C5). La membresía CAMBIA el ambiente,
 * no solo desbloquea funciones: FREE = limpio/gris, LEGEND = oro/glow/depth.
 * Centraliza acento + estilos para que shells y secciones no los hardcodeen.
 */
import { useMemo } from 'react'

export interface ConsumerTheme {
  legend: boolean
  accent: string
  /** Fondo ambiental del shell (depth). */
  ambient: string
  /** Variables CSS para inyectar en el contenedor del OS. */
  vars: Record<string, string>
  glow: boolean
}

export function useConsumerTheme(legend: boolean, cfg?: any): ConsumerTheme {
  return useMemo(() => {
    const accent = legend ? (cfg?.primary || '#D4AF37') : '#ea580c'
    const ambient = legend
      ? 'radial-gradient(circle at 20% 0%, #1a1a1a, #0a0a0a 70%)'
      : '#f5f5f5'
    return {
      legend,
      accent,
      ambient,
      glow: legend && (cfg?.glow ?? true),
      vars: {
        '--c-accent': accent,
        '--c-accent-soft': legend ? 'rgba(212,175,55,0.15)' : 'rgba(234,88,12,0.10)',
      },
    }
  }, [legend, cfg])
}
