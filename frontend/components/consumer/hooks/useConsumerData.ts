'use client'

/**
 * useConsumerData — Core de datos del Consumer OS (C1).
 *
 * Extrae TODA la carga de datos del panel del consumidor (antes inline en
 * `consumer-routine.tsx`) para que la compartan ambos shells (Mobile y Desktop)
 * sin duplicar lógica. No contiene UI; solo estado + fetching.
 *
 * Reusa los mismos endpoints (`api.*`) — comportamiento idéntico al panel actual.
 */
import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'

export type ConsumerTab = 'hoy' | 'rutina' | 'cocina' | 'plan' | 'compras' | 'gym' | 'planes' | 'explore' | 'coach' | 'vault' | 'comunidad' | 'wallet'

export interface GymData {
  membresias: any[]
  plan: any[]
  progreso: any[]
  asistencia: any
  acceso: any
}

export function useConsumerData(initialTab: ConsumerTab = 'hoy') {
  const [tab, setTab] = useState<ConsumerTab>(initialTab)
  const [loading, setLoading] = useState(false)

  // Flags de plataforma / membresía (ambos shells los necesitan)
  const [assistantOn, setAssistantOn] = useState(false)
  const [hasGym, setHasGym] = useState(false)
  const [legend, setLegend] = useState(false)
  const [legendCfg, setLegendCfg] = useState<any>(null)
  const [planState, setPlanState] = useState<any>(null)   // /me LEGEND completo (powerDays, milestones…)
  const [streak, setStreak] = useState(0)                 // racha de actividad (C7.7)
  const [activeProgram, setActiveProgram] = useState<any>(null)  // programa de coach activo (T3)

  // Datos por sección
  const [resumen, setResumen] = useState<any>(null)
  const [despensa, setDespensa] = useState<any[]>([])
  const [recetas, setRecetas] = useState<any[]>([])
  const [puedoHacer, setPuedoHacer] = useState<any[]>([])
  const [rutinas, setRutinas] = useState<any[]>([])
  const [plan, setPlan] = useState<any[]>([])
  const [compras, setCompras] = useState<any[]>([])
  const [gym, setGym] = useState<GymData>({ membresias: [], plan: [], progreso: [], asistencia: null, acceso: null })

  const today = new Date().toISOString().slice(0, 10)

  // Carga inicial de flags (membresía, asistente, plan LEGEND + config)
  useEffect(() => {
    api.getMisMembresias().then(r => { if (r.success && (r.data || []).length) setHasGym(true) }).catch(() => {})
    api.getPlatformAssistant().then(r => { if (r.success && r.data?.enabled) setAssistantOn(true) }).catch(() => {})
    api.getMyPlan().then(r => { if (r.success && r.data) { setPlanState(r.data); setLegend(!r.data.isExpired && r.data.tier === 'legend') } }).catch(() => {})
    api.getLegendConfig().then(r => { if (r.success) setLegendCfg(r.data) }).catch(() => {})
    // Streak: registra actividad de hoy y trae la racha (C7.7).
    api.pingConsumer().then(r => { if (r.success && r.data) setStreak(Number(r.data.streak) || 0) }).catch(() => {})
    api.getActiveProgram().then(r => { if (r.success) setActiveProgram(r.data) }).catch(() => {})
  }, [])

  const load = useCallback(async (t: ConsumerTab) => {
    setLoading(true)
    try {
      if (t === 'hoy') {
        const [r, p, ru] = await Promise.all([api.getRutinaResumen(), api.getPlanComidas(today, today), api.getRutinas()])
        if (r.success) setResumen(r.data)
        if (p.success) setPlan(p.data || [])
        if (ru.success) setRutinas(ru.data || [])
      } else if (t === 'rutina') {
        const r = await api.getRutinas(); if (r.success) setRutinas(r.data || [])
      } else if (t === 'cocina') {
        const [d, a, b] = await Promise.all([api.getDespensa(), api.getRutinaRecetas(), api.getRecetasQuePuedoHacer()])
        if (d.success) setDespensa(d.data || [])
        if (a.success) setRecetas(a.data || [])
        if (b.success) setPuedoHacer(b.data || [])
      } else if (t === 'plan') {
        const r = await api.getPlanComidas(today, today); if (r.success) setPlan(r.data || [])
      } else if (t === 'compras') {
        const r = await api.getListaCompras(); if (r.success) setCompras(r.data || [])
      } else if (t === 'gym') {
        const [mem, pl, pr, as, ac] = await Promise.all([
          api.getMisMembresias(), api.getMiPlanGym(), api.getMiProgresoGym(), api.getMiAsistenciaGym(), api.getMiAccesoGym(),
        ])
        setGym({
          membresias: mem.success ? mem.data || [] : [],
          plan: pl.success ? pl.data || [] : [],
          progreso: pr.success ? pr.data || [] : [],
          asistencia: as.success ? as.data : null,
          acceso: ac.success ? ac.data : null,
        })
      }
      // 'planes' se gestiona dentro de su propia sección (PlanesView), sin carga aquí.
    } finally { setLoading(false) }
  }, [today])

  // Recarga cuando cambia la pestaña activa.
  useEffect(() => { load(tab) }, [tab, load])

  const reload = useCallback(() => load(tab), [load, tab])

  return {
    // nav
    tab, setTab, today, loading,
    // flags
    assistantOn, hasGym, legend, setLegend, legendCfg, planState, streak, activeProgram,
    // datos
    resumen, despensa, recetas, puedoHacer, rutinas, plan, compras, gym,
    // acciones
    load, reload,
  }
}
