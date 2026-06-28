'use client'

import { useRef, useCallback, useState, useEffect } from 'react'

export type LoaderPhase =
  | 'idle'
  | 'awakening'
  | 'forming'
  | 'stabilizing'
  | 'completed'
  | 'fadeout'

interface TimelineConfig {
  awakeningDelay: number
  formingDuration: number
  stabilizingDelay: number
  completedDelay: number
  fadeoutDuration: number
}

const DEFAULT_CONFIG: TimelineConfig = {
  awakeningDelay: 0.5,
  formingDuration: 2.0,
  stabilizingDelay: 0.8,
  completedDelay: 0.5,
  fadeoutDuration: 0.8,
}

export function useLoaderTimeline(
  onComplete?: () => void,
  config: Partial<TimelineConfig> = {}
) {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const [phase, setPhase] = useState<LoaderPhase>('idle')
  const [progress, setProgress] = useState(0)
  const startTime = useRef(0)
  const frameRef = useRef(0)
  const completedRef = useRef(false)

  const getElapsed = useCallback(() => {
    return (performance.now() - startTime.current) / 1000
  }, [])

  useEffect(() => {
    startTime.current = performance.now()

    const tick = () => {
      const t = getElapsed()

      if (t < cfg.awakeningDelay) {
        setPhase('awakening')
        setProgress(0)
      } else if (t < cfg.awakeningDelay + cfg.formingDuration) {
        setPhase('forming')
        const p = (t - cfg.awakeningDelay) / cfg.formingDuration
        setProgress(Math.min(p, 1))
      } else if (t < cfg.awakeningDelay + cfg.formingDuration + cfg.stabilizingDelay) {
        setPhase('stabilizing')
        setProgress(1)
      } else if (t < cfg.awakeningDelay + cfg.formingDuration + cfg.stabilizingDelay + cfg.completedDelay) {
        setPhase('completed')
        if (!completedRef.current) {
          completedRef.current = true
          onComplete?.()
        }
      } else {
        setPhase('fadeout')
        const totalDuration = cfg.awakeningDelay + cfg.formingDuration + cfg.stabilizingDelay + cfg.completedDelay
        const fp = (t - totalDuration) / cfg.fadeoutDuration
        setProgress(1 + Math.min(fp, 1))
      }

      frameRef.current = requestAnimationFrame(tick)
    }

    frameRef.current = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frameRef.current)
    }
  }, [])

  return { phase, progress, getElapsed }
}
