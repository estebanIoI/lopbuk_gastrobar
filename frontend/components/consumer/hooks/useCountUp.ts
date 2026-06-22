'use client'

/**
 * useCountUp — anima un número de 0 → target con easing (microinteracción C5).
 * Para contadores premium (días de poder, kcal, etc.). Respeta prefers-reduced-motion.
 */
import { useEffect, useRef, useState } from 'react'

export function useCountUp(target: number, durationMs = 700): number {
  const [val, setVal] = useState(0)
  const raf = useRef<number | null>(null)

  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce || !Number.isFinite(target)) { setVal(target || 0); return }
    const start = performance.now()
    const from = 0
    const ease = (t: number) => 1 - Math.pow(1 - t, 3) // easeOutCubic
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs)
      setVal(Math.round(from + (target - from) * ease(p)))
      if (p < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [target, durationMs])

  return val
}
