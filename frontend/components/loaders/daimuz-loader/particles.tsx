'use client'

import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { generateLogoPoints, type LogoPoint } from './logo-points'
import type { LoaderPhase } from './useLoaderTimeline'

interface ParticlesProps {
  phase: LoaderPhase
  progress: number
  count?: number
}

const TOTAL = 5000
const AMBIENT_COUNT = 800

// Colores del tema DAIMUZ
const GLOW = new THREE.Color('#3B82F6')
const ACCENT = new THREE.Color('#60A5FA')
const WHITE = new THREE.Color('#E0F2FE')
const DIM_BLUE = new THREE.Color('#1E3A5F')

function randomSphere(radius: number): THREE.Vector3 {
  const theta = Math.random() * Math.PI * 2
  const phi = Math.acos(2 * Math.random() - 1)
  const r = radius * (0.5 + Math.random() * 0.5)
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.sin(phi) * Math.sin(theta),
    r * Math.cos(phi)
  )
}

function randomInView(): THREE.Vector3 {
  return new THREE.Vector3(
    (Math.random() - 0.5) * 8,
    (Math.random() - 0.5) * 4,
    Math.random() * 4 - 2
  )
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export function Particles({ phase, progress, count = TOTAL }: ParticlesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const targetRef = useRef<THREE.Vector3[]>([])
  const currentRef = useRef<THREE.Vector3[]>([])
  const sizesRef = useRef<Float32Array>(new Float32Array(0))
  const initialized = useRef(false)
  const logoPoints = useRef<LogoPoint[]>([])
  const ambientTargets = useRef<THREE.Vector3[]>([])
  const { viewport } = useThree()

  // Generate target points on mount
  const buildCount = useMemo(() => {
    logoPoints.current = generateLogoPoints()
    return logoPoints.current.length
  }, [])

  // Initialize positions
  const { buildPositions, ambientPositions, allTargets, allCurrent } = useMemo(() => {
    const pts = logoPoints.current
    const scaleX = viewport.width * 0.6
    const scaleY = viewport.height * 0.25

    const build: THREE.Vector3[] = []
    const ambient: THREE.Vector3[] = []

    // Build targets: map logo points to 3D space
    for (let i = 0; i < buildCount; i++) {
      const p = pts[i]
      // Spread them along Z for depth
      const z = (Math.random() - 0.5) * 1.5
      build.push(new THREE.Vector3(
        p.x * scaleX,
        p.y * scaleY,
        z
      ))
    }

    // Fill remaining with ambient particles
    const remaining = count - buildCount
    for (let i = 0; i < remaining; i++) {
      ambient.push(randomInView())
    }

    const allT = [...build, ...ambient]
    const allC = allT.map(() => randomSphere(5))

    ambientTargets.current = ambient.map(() => randomInView())

    return {
      buildPositions: build,
      ambientPositions: ambient,
      allTargets: allT,
      allCurrent: allC,
    }
  }, [buildCount, count, viewport.width, viewport.height])

  useMemo(() => {
    targetRef.current = allTargets
    currentRef.current = allCurrent
    sizesRef.current = new Float32Array(count).fill(1)
    initialized.current = true
  }, [allTargets, allCurrent, count])

  useFrame((state, delta) => {
    if (!meshRef.current || !initialized.current) return
    const mesh = meshRef.current
    const dummy = new THREE.Object3D()
    const targets = targetRef.current
    const currents = currentRef.current
    const sizes = sizesRef.current
    const t = state.clock.elapsedTime

    for (let i = 0; i < count; i++) {
      const isBuild = i < buildCount
      const target = targets[i]
      const current = currents[i]

      if (phase === 'idle' || phase === 'awakening') {
        // Drift slowly in darkness
        const driftSpeed = phase === 'awakening' ? 0.3 : 0.08
        current.x += Math.sin(t * 0.3 + i * 0.01) * delta * driftSpeed
        current.y += Math.cos(t * 0.4 + i * 0.01) * delta * driftSpeed * 0.5
        current.z += Math.sin(t * 0.2 + i * 0.02) * delta * driftSpeed * 0.3
        sizes[i] = lerp(sizes[i], phase === 'awakening' ? 2 : 1.2, delta * 2)
      } else if (phase === 'forming') {
        if (isBuild) {
          const eased = easeOutExpo(progress)
          // Particles rise from below and converge
          const fromY = -3 - Math.random() * 2
          const riseTarget = new THREE.Vector3(target.x, target.y, target.z)
          const currentTarget = new THREE.Vector3(
            target.x,
            lerp(fromY, target.y, eased),
            target.z
          )
          current.lerp(currentTarget, delta * 3)
          sizes[i] = lerp(sizes[i], 1.5 + Math.random() * 0.5, delta * 2)
        } else {
          // Ambient particles float around
          current.lerp(ambientTargets.current[i - buildCount], delta * 1.5)
          sizes[i] = lerp(sizes[i], 0.8, delta * 2)
        }
      } else if (phase === 'stabilizing' || phase === 'completed') {
        if (isBuild) {
          // Micro-vibration on target position
          const vibrate = (phase === 'completed') ? 0.01 : 0.03
          const vx = target.x + Math.sin(t * 8 + i) * vibrate
          const vy = target.y + Math.cos(t * 9 + i * 1.3) * vibrate
          const vz = target.z + Math.sin(t * 7 + i * 0.7) * vibrate * 0.5
          current.lerp(new THREE.Vector3(vx, vy, vz), delta * 5)
          sizes[i] = lerp(sizes[i], 1.8 + Math.sin(t * 3 + i * 0.1) * 0.3, delta * 3)
        } else {
          // Slow orbit
          const orbit = ambientTargets.current[i - buildCount]
          orbit.x += Math.sin(t * 0.5 + i) * delta * 0.3
          orbit.y += Math.cos(t * 0.6 + i) * delta * 0.2
          current.lerp(orbit, delta * 1.5)
          sizes[i] = lerp(sizes[i], 0.6, delta * 2)
        }
      } else if (phase === 'fadeout') {
        // Dissolve outward and shrink
        const dissolve = (progress - 1) / 0.8 // 0 to 1
        const outward = current.clone().normalize().multiplyScalar(8 * dissolve * dissolve)
        const fadeTarget = current.clone().add(outward)
        current.lerp(fadeTarget, delta * 2)
        sizes[i] = lerp(sizes[i], 0, delta * 3)
      }

      // Apply position and scale
      dummy.position.copy(current)
      dummy.scale.setScalar(Math.max(0.02, sizes[i]))

      // Vary color based on position and type
      const colorRatio = isBuild ? 1 : 0
      if (phase === 'forming' || phase === 'stabilizing' || phase === 'completed') {
        // Color gradient: center = white/glow, edges = accent/dim
        const distFromCenter = Math.abs(current.y) / 2
        const warm = isBuild ? distFromCenter : 1
        dummy.userData = dummy.userData || {}
        // Use per-instance color (simpler: set on material, but not per-instance)
      }

      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }

    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      frustumCulled={false}
    >
      <sphereGeometry args={[0.015, 8, 8]} />
      <meshBasicMaterial
        color={phase === 'awakening' ? DIM_BLUE : (phase === 'forming' ? GLOW : ACCENT)}
        transparent
        opacity={phase === 'fadeout' ? Math.max(0, 1 - (progress - 1) / 0.8) : 1}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </instancedMesh>
  )
}
