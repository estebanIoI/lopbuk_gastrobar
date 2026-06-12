'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTourStore } from '@/lib/tour-store'
import { getTour } from '@/lib/tour-catalog'
import { X, ChevronRight, ChevronLeft } from 'lucide-react'

const DONE_KEY = 'lopbuk_tour_v1_done'
const PAD = 6          // padding del recorte alrededor del elemento
const TIP_W = 320      // ancho del tooltip

type Rect = { top: number; left: number; width: number; height: number }

export function GuidedTour({ autoStart = false }: { autoStart?: boolean }) {
  const { active, start, stop, startIndex, tourKey } = useTourStore()
  const TOUR_STEPS = getTour(tourKey)
  const [mounted, setMounted] = useState(false)
  const [idx, setIdx] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [tip, setTip] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const tipRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  // Auto-iniciar una sola vez (solo si no fue vista) — comportamiento de bienvenida.
  // Espera a que el panel esté realmente pintado (la navegación en el DOM) antes de
  // arrancar, para que el primer recorrido no salga "centrado" sobre una pantalla a
  // medio cargar. Si tras varios intentos el panel no está listo, no auto-inicia
  // (el comerciante siempre puede abrirla con el botón "Guía").
  useEffect(() => {
    if (!mounted || !autoStart) return
    let alreadyDone = false
    try { alreadyDone = !!localStorage.getItem(DONE_KEY) } catch { /* ignore */ }
    if (alreadyDone) return

    let tries = 0
    let timer: ReturnType<typeof setTimeout>
    const attempt = () => {
      const navReady = document.querySelector('[data-tour^="nav-"], [data-tour^="navg-"]')
      const visible = typeof document !== 'undefined' && document.visibilityState !== 'hidden'
      if (navReady && visible) {
        start()
        return
      }
      if (tries++ < 12) {
        timer = setTimeout(attempt, 500)
      }
    }
    timer = setTimeout(attempt, 1000)
    return () => clearTimeout(timer)
  }, [mounted, autoStart, start])

  // Al activarse, arrancar en el paso solicitado (0 por defecto)
  useEffect(() => { if (active) setIdx(startIndex) }, [active, startIndex])

  // Fallback: al cambiar de guía (tourKey) el idx puede quedar fuera de rango por un
  // render antes de que el efecto lo reinicie. Evita "Cannot read 'title' of undefined".
  const safeIdx = idx < TOUR_STEPS.length ? idx : 0
  const step = TOUR_STEPS[safeIdx] ?? TOUR_STEPS[0]

  const findTarget = useCallback((): HTMLElement | null => {
    if (!step?.targets) return null
    for (const t of step.targets) {
      const el = document.querySelector(`[data-tour="${t}"]`)
      if (el) return el as HTMLElement
    }
    return null
  }, [step])

  // Medir el elemento objetivo (con scroll a la vista)
  const measure = useCallback((doScroll: boolean) => {
    const el = findTarget()
    if (el) {
      if (doScroll) {
        try { el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' }) } catch { /* noop */ }
      }
      setRect(el.getBoundingClientRect())
    } else {
      setRect(null)
    }
  }, [findTarget])

  useLayoutEffect(() => {
    if (!active) return
    measure(true)
  }, [active, idx, measure])

  // Re-medir ante scroll/resize/cambios de layout (ej: sidebar que se expande)
  useEffect(() => {
    if (!active) return
    const onMove = () => measure(false)
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    const interval = setInterval(onMove, 350)
    return () => {
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
      clearInterval(interval)
    }
  }, [active, measure])

  const finish = useCallback(() => {
    try { localStorage.setItem(DONE_KEY, '1') } catch { /* ignore */ }
    stop()
  }, [stop])

  const next = useCallback(() => {
    setIdx(i => (i < TOUR_STEPS.length - 1 ? i + 1 : i))
    if (idx >= TOUR_STEPS.length - 1) finish()
  }, [idx, finish, TOUR_STEPS.length])

  const prev = useCallback(() => setIdx(i => Math.max(0, i - 1)), [])

  // Teclado
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, finish, next, prev])

  // Calcular posición del tooltip cuando hay rect (o centrado si no)
  const r: Rect | null = rect
    ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
    : null
  const vw = mounted ? window.innerWidth : 0
  const vh = mounted ? window.innerHeight : 0
  const onScreen = !!(r && r.width > 0 && (r.left + r.width) > 24 && r.left < vw - 24 && (r.top + r.height) > 24 && r.top < vh - 24)

  useLayoutEffect(() => {
    if (!active || !mounted) return
    const tw = tipRef.current?.offsetWidth ?? TIP_W
    const th = tipRef.current?.offsetHeight ?? 160
    // Recalcular desde `rect` (estado estable) — NO desde objetos derivados en cada render,
    // para no provocar un bucle de actualización (React #185).
    const vis = !!(rect && rect.width > 0 && (rect.left + rect.width) > 24 && rect.left < vw - 24 && (rect.top + rect.height) > 24 && rect.top < vh - 24)
    let top: number, left: number
    if (!vis || !rect) {
      top = Math.max(12, vh / 2 - th / 2)
      left = Math.max(12, vw / 2 - tw / 2)
    } else {
      const rb = rect.top + rect.height, rr = rect.left + rect.width
      const space = { bottom: vh - rb, top: rect.top, right: vw - rr, left: rect.left }
      if (space.bottom >= th + 16) { top = rb + 12; left = rect.left + rect.width / 2 - tw / 2 }
      else if (space.right >= tw + 16) { left = rr + 12; top = rect.top + rect.height / 2 - th / 2 }
      else if (space.top >= th + 16) { top = rect.top - th - 12; left = rect.left + rect.width / 2 - tw / 2 }
      else if (space.left >= tw + 16) { left = rect.left - tw - 12; top = rect.top + rect.height / 2 - th / 2 }
      else { top = rb + 12; left = rect.left + rect.width / 2 - tw / 2 }
      left = Math.max(12, Math.min(left, vw - tw - 12))
      top = Math.max(12, Math.min(top, vh - th - 12))
    }
    // Guardar solo si cambió, para cortar cualquier re-render innecesario.
    setTip(prev => (prev.top === top && prev.left === left ? prev : { top, left }))
  }, [active, mounted, rect, idx, vw, vh])

  if (!mounted || !active) return null

  const isLast = safeIdx === TOUR_STEPS.length - 1
  const isFirst = safeIdx === 0
  const accent = '#00833E'

  const hole = onScreen && r
    ? { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 }
    : null

  const overlayBg = 'rgba(15, 23, 20, 0.62)'

  return createPortal(
    <div aria-modal="true" role="dialog" style={{ position: 'fixed', inset: 0, zIndex: 2147483000 }}>
      {/* ── Overlay con recorte (4 franjas) o pantalla completa ── */}
      {hole ? (
        <>
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: Math.max(0, hole.top), background: overlayBg }} />
          <div style={{ position: 'fixed', top: hole.top + hole.height, left: 0, width: '100%', height: Math.max(0, vh - (hole.top + hole.height)), background: overlayBg }} />
          <div style={{ position: 'fixed', top: hole.top, left: 0, width: Math.max(0, hole.left), height: hole.height, background: overlayBg }} />
          <div style={{ position: 'fixed', top: hole.top, left: hole.left + hole.width, width: Math.max(0, vw - (hole.left + hole.width)), height: hole.height, background: overlayBg }} />
          {/* anillo resaltado */}
          <div style={{
            position: 'fixed', top: hole.top, left: hole.left, width: hole.width, height: hole.height,
            border: `2px solid ${accent}`, borderRadius: 10, boxShadow: `0 0 0 3px rgba(0,131,62,0.25)`,
            pointerEvents: 'none', transition: 'all .2s ease',
          }} />
        </>
      ) : (
        <div style={{ position: 'fixed', inset: 0, background: overlayBg }} />
      )}

      {/* ── Tooltip / tarjeta ── */}
      <div
        ref={tipRef}
        style={{
          position: 'fixed', top: tip.top, left: tip.left, width: TIP_W, maxWidth: 'calc(100vw - 24px)',
          background: '#fff', borderRadius: 14, boxShadow: '0 18px 50px rgba(0,0,0,0.30)',
          overflow: 'hidden', fontFamily: "'Segoe UI', system-ui, sans-serif",
          animation: 'pcTourIn .18s ease',
        }}
      >
        <style>{`@keyframes pcTourIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>

        {/* header */}
        <div style={{ background: `linear-gradient(135deg, ${accent} 0%, #00a04c 100%)`, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{step.title}</span>
          <button onClick={finish} aria-label="Cerrar guía" style={{ background: 'rgba(255,255,255,0.18)', border: 'none', color: '#fff', width: 24, height: 24, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={14} />
          </button>
        </div>

        {/* body */}
        <div style={{ padding: '14px 16px' }}>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: '#1A1A1A' }}>{step.body}</p>

          {/* dots */}
          <div style={{ display: 'flex', gap: 5, marginTop: 14, flexWrap: 'wrap' }}>
            {TOUR_STEPS.map((_, i) => (
              <span key={i} onClick={() => setIdx(i)} style={{
                width: i === safeIdx ? 18 : 7, height: 7, borderRadius: 4, cursor: 'pointer',
                background: i === safeIdx ? accent : '#D5DBD7', transition: 'all .2s',
              }} />
            ))}
          </div>

          {/* acciones */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
            <button onClick={finish} style={{ background: 'none', border: 'none', color: '#8A8F8C', fontSize: 12.5, cursor: 'pointer', padding: 4 }}>
              Omitir
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              {!isFirst && (
                <button onClick={prev} style={{ background: '#F0F2F0', border: 'none', color: '#3A3F3C', fontSize: 12.5, fontWeight: 600, padding: '7px 12px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <ChevronLeft size={14} /> Atrás
                </button>
              )}
              <button onClick={next} style={{ background: accent, border: 'none', color: '#fff', fontSize: 12.5, fontWeight: 700, padding: '7px 14px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                {isLast ? 'Finalizar' : 'Siguiente'} {isLast ? '✓' : <ChevronRight size={14} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
