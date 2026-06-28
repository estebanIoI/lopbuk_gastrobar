'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing'
import * as THREE from 'three'
import { Particles } from './particles'
import type { LoaderPhase } from './useLoaderTimeline'

interface SceneProps {
  phase: LoaderPhase
  progress: number
}

function EnergyLines({ phase }: { phase: LoaderPhase }) {
  const linesRef = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (!linesRef.current) return
    const t = clock.elapsedTime
    const active = phase === 'awakening' || phase === 'forming'

    linesRef.current.children.forEach((line, i) => {
      const material = (line as THREE.Line).material as THREE.LineBasicMaterial
      material.opacity = active ? THREE.MathUtils.lerp(0, 0.15, Math.sin(t * 2 + i) * 0.5 + 0.5) : 0
    })
  })

  const lines = useRef<THREE.Vector3[][]>(
    Array.from({ length: 6 }, (_, i) => {
      const x = (i - 2.5) * 1.2
      return [
        new THREE.Vector3(x, -3, 0),
        new THREE.Vector3(x + (Math.random() - 0.5) * 0.5, 1 + Math.random(), (Math.random() - 0.5) * 2),
        new THREE.Vector3(x + (Math.random() - 0.5) * 0.3, 3, (Math.random() - 0.5)),
      ]
    })
  )

  return (
    <group ref={linesRef}>
      {lines.current.map((points: THREE.Vector3[], i: number) => {
        const curve = new THREE.CatmullRomCurve3(points)
        const geometry = new THREE.TubeGeometry(curve, 32, 0.003, 4, false)
        return (
          <mesh key={i} geometry={geometry}>
            <meshBasicMaterial
              color="#3B82F6"
              transparent
              opacity={0}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        )
      })}
    </group>
  )
}

export function Scene({ phase, progress }: SceneProps) {
  const isVisible = phase !== 'idle'

  return (
    <>
      <fogExp2 attach="fog" args={['#050816', 0.015]} />

      <CameraController phase={phase} />

      <ambientLight
        intensity={0.2 + (phase === 'completed' ? 0.4 : phase === 'forming' ? 0.3 : 0)}
        color="#1a2a4a"
      />

      <Particles phase={phase} progress={progress} />

      <EnergyLines phase={phase} />

      <EffectComposer multisampling={4}>
        <Bloom
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          intensity={isVisible ? 1.5 : 0.3}
          radius={0.8}
          mipmapBlur
        />
        <Noise opacity={0.02} />
        <Vignette
          offset={0.3}
          darkness={0.6}
          eskil={false}
        />
      </EffectComposer>
    </>
  )
}

function CameraController({ phase }: { phase: LoaderPhase }) {
  useFrame(({ camera, clock }) => {
    const t = clock.elapsedTime

    switch (phase) {
      case 'idle':
        camera.position.set(0, 0, 8)
        break
      case 'awakening':
        camera.position.lerp(
          new THREE.Vector3(Math.sin(t * 0.2) * 0.5, -0.5, 6.5),
          0.02
        )
        break
      case 'forming':
        camera.position.lerp(
          new THREE.Vector3(Math.sin(t * 0.15) * 0.3, 0.2, 5.5),
          0.03
        )
        break
      case 'stabilizing':
      case 'completed':
        camera.position.lerp(
          new THREE.Vector3(Math.sin(t * 0.1) * 0.2, 0, 5),
          0.04
        )
        break
      case 'fadeout':
        camera.position.lerp(
          new THREE.Vector3(0, 0, 2),
          0.03
        )
        break
    }

    camera.lookAt(0, 0, 0)
  })

  return null
}
