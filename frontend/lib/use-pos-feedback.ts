'use client'

/**
 * usePosFeedback — retroalimentación sensorial del POS táctil (Polish).
 *
 * Sonidos + vibración para los eventos clave del servicio, ambos configurables
 * y persistidos en localStorage. Los sonidos se SINTETIZAN con la Web Audio API
 * (no hay archivos de audio → cero assets, cero problemas de CSP/carga).
 *
 * Eventos:
 *   add   → producto agregado a la comanda  (✔ blip corto)
 *   sent  → enviado a cocina/bar            (📨 dos notas ascendentes)
 *   paid  → pago exitoso                    (💰 acorde de tres notas)
 *   ready → cocina/bar marcó listo          (🔔 doble campanita)
 *   error → acción rechazada                (buzz grave)
 *
 * Se instancia UNA vez (en PosShell) y se comparten flags/toggles hacia abajo,
 * porque cada `useState` es independiente por componente.
 */
import { useCallback, useEffect, useState } from 'react'

export type PosSound = 'add' | 'sent' | 'paid' | 'ready' | 'error'

const SOUND_KEY = 'lopbuk_pos_sound'
const VIB_KEY = 'lopbuk_pos_vibration'

// AudioContext perezoso y único. Se crea/reanuda tras el primer gesto del usuario
// (el POS siempre se toca antes de necesitar sonido, así que no queda suspendido).
let audioCtx: AudioContext | null = null
function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctor) return null
    if (!audioCtx) audioCtx = new Ctor()
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {})
    return audioCtx
  } catch { return null }
}

type Note = { f: number; t: number; d: number; type?: OscillatorType; g?: number }

function playTones(notes: Note[]) {
  const ctx = getCtx()
  if (!ctx) return
  const now = ctx.currentTime
  for (const n of notes) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = n.type ?? 'sine'
    osc.frequency.value = n.f
    const start = now + n.t
    const peak = n.g ?? 0.13
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + n.d)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(start)
    osc.stop(start + n.d + 0.03)
  }
}

const SOUND_DEFS: Record<PosSound, Note[]> = {
  add:   [{ f: 880, t: 0, d: 0.09 }],
  sent:  [{ f: 660, t: 0, d: 0.08 }, { f: 988, t: 0.09, d: 0.12 }],
  paid:  [{ f: 784, t: 0, d: 0.08 }, { f: 1047, t: 0.09, d: 0.09 }, { f: 1319, t: 0.18, d: 0.16 }],
  ready: [{ f: 1319, t: 0, d: 0.10, type: 'triangle' }, { f: 1319, t: 0.16, d: 0.13, type: 'triangle' }],
  error: [{ f: 200, t: 0, d: 0.20, type: 'sawtooth', g: 0.10 }],
}

const VIB_DEFS: Record<PosSound, number[]> = {
  add: [15], sent: [30], paid: [20, 40, 20], ready: [50, 40, 50], error: [90],
}

export function usePosFeedback() {
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [vibrationEnabled, setVibrationEnabled] = useState(true)

  useEffect(() => {
    try {
      const s = localStorage.getItem(SOUND_KEY)
      if (s !== null) setSoundEnabled(s === '1')
      const v = localStorage.getItem(VIB_KEY)
      if (v !== null) setVibrationEnabled(v === '1')
    } catch {}
  }, [])

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      const next = !prev
      try { localStorage.setItem(SOUND_KEY, next ? '1' : '0') } catch {}
      if (next) playTones(SOUND_DEFS.add) // confirma audible al activar
      return next
    })
  }, [])

  const toggleVibration = useCallback(() => {
    setVibrationEnabled(prev => {
      const next = !prev
      try { localStorage.setItem(VIB_KEY, next ? '1' : '0') } catch {}
      if (next && typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(20) } catch {}
      }
      return next
    })
  }, [])

  const play = useCallback((event: PosSound) => {
    if (soundEnabled) playTones(SOUND_DEFS[event])
    if (vibrationEnabled && typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(VIB_DEFS[event]) } catch {}
    }
  }, [soundEnabled, vibrationEnabled])

  return { play, soundEnabled, vibrationEnabled, toggleSound, toggleVibration }
}
