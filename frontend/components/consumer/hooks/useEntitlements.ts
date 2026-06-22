'use client'

/**
 * useEntitlements — Access profile del Consumer OS (C7.1/C7.2). Fuente única para
 * gatear features por membresía. Lee `/me` (getMyPlan) y expone `has(key)`.
 * Cache de 60s a nivel módulo porque se llama MUCHO (gates en toda la UI).
 *
 * Regla: Free ve el producto básico; LEGEND el mejorado; si vence, vuelve a Free
 * solo (sin romper nada) — `has()` devuelve false en cuanto `/me` reporta expirado.
 */
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

let cache: any = null
let cacheAt = 0
const TTL = 60_000

export interface AccessProfile {
  tier: string
  isLegend: boolean
  entitlements: string[]
  expiresAt: string | null
  remainingSeconds: number
  powerDays: number
  milestones: string[]
  loading: boolean
  has: (key: string) => boolean
}

/** Invalida el cache (p.ej. tras canjear un código). */
export function refreshEntitlements() { cache = null; cacheAt = 0 }

export function useEntitlements(): AccessProfile {
  const [data, setData] = useState<any>(cache)
  const [loading, setLoading] = useState(!cache)

  useEffect(() => {
    if (cache && Date.now() - cacheAt < TTL) { setData(cache); setLoading(false); return }
    let alive = true
    api.getMyPlan().then(r => {
      if (!alive) return
      if (r.success && r.data) { cache = r.data; cacheAt = Date.now(); setData(r.data) }
      setLoading(false)
    }).catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const ents: string[] = data?.entitlements || []
  const isLegend = !!data && !data.isExpired && data.tier === 'legend'

  return {
    tier: data?.tier || 'free',
    isLegend,
    entitlements: ents,
    expiresAt: data?.expiresAt ?? null,
    remainingSeconds: data?.remainingSeconds ?? 0,
    powerDays: data?.powerDays ?? 0,
    milestones: data?.milestones ?? [],
    loading,
    has: (key: string) => isLegend && ents.includes(key),
  }
}
