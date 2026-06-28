'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { Scene } from './scene'
import { useLoaderTimeline, type LoaderPhase } from './useLoaderTimeline'
import { clearCache } from './logo-points'

interface DaimuzLoaderProps {
  /**
   * When true, the loader plays the cinematic sequence and calls onLoaded when done.
   * When false, it fades out immediately.
   */
  loading?: boolean
  /**
   * Called when the cinematic sequence completes and fadeout finishes.
   */
  onLoaded?: () => void
  /**
   * Fast variant for internal navigation (shorter animation).
   */
  fast?: boolean
}

export function DaimuzLoader({ loading = true, onLoaded, fast = false }: DaimuzLoaderProps) {
  const [exiting, setExiting] = useState(false)

  const handleComplete = useCallback(() => {
    setExiting(true)
    // Wait for fadeout animation before calling onLoaded
    setTimeout(() => {
      onLoaded?.()
    }, 900)
  }, [onLoaded])

  const { phase, progress } = useLoaderTimeline(
    loading ? handleComplete : undefined,
    fast
      ? { awakeningDelay: 0.2, formingDuration: 0.8, stabilizingDelay: 0.2, completedDelay: 0.2 }
      : undefined
  )

  // Clear logo point cache on unmount
  useEffect(() => {
    return () => {
      clearCache()
    }
  }, [])

  if (exiting && phase === 'fadeout') {
    return (
      <div
        className="fixed inset-0 z-50 pointer-events-none"
        style={{
          background: '#050816',
          opacity: Math.max(0, 1 - (progress - 1) / 0.8),
          transition: 'opacity 0.1s linear',
        }}
      >
        <Canvas
          dpr={[1, 2]}
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
          }}
          camera={{ position: [0, 0, 5], fov: 45 }}
          style={{ background: '#050816' }}
        >
          <Suspense fallback={null}>
            <Scene phase={phase} progress={progress} />
          </Suspense>
        </Canvas>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50" style={{ background: '#050816' }}>
      <Canvas
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          stencil: false,
          depth: true,
        }}
        camera={{ position: [0, 0, 8], fov: 45 }}
        style={{ background: '#050816' }}
      >
        <Suspense fallback={null}>
          <Scene phase={phase} progress={progress} />
        </Suspense>
      </Canvas>

      {/* HUD text overlay - appears during stabilizing */}
      {phase === 'stabilizing' || phase === 'completed' ? (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{
            opacity: phase === 'completed' ? 1 : progress,
            transition: 'opacity 0.3s ease',
          }}
        >
          <h1
            className="text-4xl md:text-6xl font-black tracking-[0.15em] select-none"
            style={{
              fontFamily: '"Inter", "Space Grotesk", "Sora", sans-serif',
              color: '#E0F2FE',
              textShadow: '0 0 40px rgba(59,130,246,0.5), 0 0 80px rgba(59,130,246,0.2)',
              letterSpacing: '0.15em',
            }}
          >
            DAIMUZ
          </h1>
        </div>
      ) : null}
    </div>
  )
}

/**
 * Full-page wrapper. Drop-in replacement for FullPageLoader.
 * Use with Suspense or as standalone loading screen.
 */
export function DaimuzFullPageLoader({
  onLoaded,
  fast,
}: {
  onLoaded?: () => void
  fast?: boolean
}) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 100)
    return () => clearTimeout(timer)
  }, [])

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#050816' }}>
        {/* Immediate dark screen while JS hydrates */}
      </div>
    )
  }

  return <DaimuzLoader loading={true} onLoaded={onLoaded} fast={fast} />
}
