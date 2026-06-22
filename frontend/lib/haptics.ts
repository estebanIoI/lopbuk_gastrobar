/**
 * haptics — microfeedback táctil en móvil (C7.6). Usa la Vibration API si existe;
 * silencioso/no-op donde no está soportada (desktop, iOS Safari). No bloquea nada.
 */
export function haptic(pattern: number | number[] = 10): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern)
    }
  } catch { /* no-op */ }
}

export const hapticTap = () => haptic(8)              // toque ligero
export const hapticSuccess = () => haptic([10, 40, 24]) // confirmación
export const hapticLegend = () => haptic([0, 30, 30, 60]) // premium / milestone
