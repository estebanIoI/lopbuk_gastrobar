'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Widget flotante de WhatsApp con notificación animada.
 * Secuencia: idle → typing (a los typingDelayMs) → message (tras messageDelayMs).
 * - Burbuja "¿Cómo podemos ayudarte?" + badge "1" con bounce.
 * - Sonido tipo Messenger (con fallback por políticas de autoplay).
 * - Parpadeo del título de la pestaña mientras el mensaje esté sin leer y la
 *   pestaña no esté activa.
 * - Respeta prefers-reduced-motion. SSR-safe (todo en useEffect).
 */
export interface WhatsAppFloatingWidgetProps {
  phoneNumber: string
  welcomeMessage?: string
  prefilledText?: string
  typingDelayMs?: number
  messageDelayMs?: number
  soundUrl?: string
  enableSound?: boolean
  enableTabBlink?: boolean
  /** Si se pasa, se llama al hacer clic en vez de abrir wa.me (p.ej. abrir un modal propio). */
  onOpen?: () => void
  /** Sube el botón para no chocar con la barra de carrito en móvil. */
  raised?: boolean
}

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)

export function WhatsAppFloatingWidget({
  phoneNumber,
  welcomeMessage = '¿Cómo podemos ayudarte?',
  prefilledText,
  typingDelayMs = 3000,
  messageDelayMs = 2000,
  soundUrl = '/sounds/messenger-notification.mp3',
  enableSound = true,
  enableTabBlink = true,
  onOpen,
  raised = false,
}: WhatsAppFloatingWidgetProps) {
  const [phase, setPhase] = useState<'idle' | 'typing' | 'message'>('idle')
  const [bubbleClosed, setBubbleClosed] = useState(false)
  const [unread, setUnread] = useState(false)
  const pendingSound = useRef(false)

  // ── Sonido con fallback por autoplay ──
  const playSound = () => {
    if (!enableSound) return
    const tryPlay = () => {
      try {
        const a = new Audio(soundUrl)
        return a.play()
      } catch {
        return Promise.reject()
      }
    }
    const p = tryPlay()
    if (p && typeof p.then === 'function') {
      p.catch(() => armFallback())
    }
  }

  const armFallback = () => {
    if (pendingSound.current) return
    pendingSound.current = true
    const handler = () => {
      if (!pendingSound.current) return
      pendingSound.current = false
      try { new Audio(soundUrl).play().catch(() => {}) } catch { /* noop */ }
      window.removeEventListener('click', handler)
      window.removeEventListener('scroll', handler)
      window.removeEventListener('keydown', handler)
    }
    window.addEventListener('click', handler, { once: true })
    window.addEventListener('scroll', handler, { once: true })
    window.addEventListener('keydown', handler, { once: true })
  }

  // ── Secuencia de fases ──
  useEffect(() => {
    if (typeof window === 'undefined' || !phoneNumber) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
    const timers: ReturnType<typeof setTimeout>[] = []

    const showMessage = () => {
      setPhase('message')
      setUnread(true)
      playSound()
    }

    if (reduced) {
      timers.push(setTimeout(showMessage, typingDelayMs))
    } else {
      timers.push(setTimeout(() => setPhase('typing'), typingDelayMs))
      timers.push(setTimeout(showMessage, typingDelayMs + messageDelayMs))
    }
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneNumber])

  // ── Parpadeo del título de la pestaña ──
  useEffect(() => {
    if (!enableTabBlink || phase !== 'message' || !unread) return
    const original = document.title
    let on = false
    let interval: ReturnType<typeof setInterval> | null = null
    const start = () => {
      if (interval) return
      interval = setInterval(() => {
        on = !on
        document.title = on ? '💬 ¡Nuevo mensaje!' : original
      }, 1000)
    }
    const stop = () => {
      if (interval) { clearInterval(interval); interval = null }
      document.title = original
    }
    const onVis = () => { if (document.hidden) start(); else stop() }
    if (document.hidden) start()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      stop()
    }
  }, [phase, unread, enableTabBlink])

  if (!phoneNumber) return null

  const handleOpen = () => {
    setUnread(false)
    setBubbleClosed(true)
    if (onOpen) { onOpen(); return }
    const text = encodeURIComponent(prefilledText || welcomeMessage || '')
    const url = `https://wa.me/${phoneNumber.replace(/\D/g, '')}?text=${text}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const showBubble = phase === 'message' && !bubbleClosed
  const bottom = raised ? 'bottom-24' : 'bottom-6'

  return (
    <div className={`wfw-root fixed ${bottom} right-6 z-[9999] flex flex-col items-end gap-2`}>
      <style>{`
        @keyframes wfw-bounce { 0%,100%{transform:translateY(0)} 25%{transform:translateY(-6px)} 50%{transform:translateY(0)} 75%{transform:translateY(-3px)} }
        @keyframes wfw-pop { from{opacity:0;transform:scale(.6)} to{opacity:1;transform:scale(1)} }
        @keyframes wfw-slideup { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes wfw-dot { 0%,80%,100%{opacity:.3;transform:scale(.8)} 40%{opacity:1;transform:scale(1)} }
        .wfw-badge{animation:wfw-bounce 1s ease-in-out infinite}
        .wfw-bubble{animation:wfw-slideup .25s ease-out}
        .wfw-typing{animation:wfw-pop .2s ease-out}
        .wfw-dot{width:7px;height:7px;border-radius:9999px;background:#9ca3af;display:inline-block;animation:wfw-dot 1.2s infinite ease-in-out}
        .wfw-dot:nth-child(2){animation-delay:.2s}
        .wfw-dot:nth-child(3){animation-delay:.4s}
        @media (prefers-reduced-motion: reduce){
          .wfw-badge,.wfw-bubble,.wfw-typing,.wfw-dot{animation:none!important}
        }
      `}</style>

      {/* Indicador "escribiendo…" */}
      {phase === 'typing' && (
        <div className="wfw-typing bg-white rounded-2xl rounded-br-sm shadow-lg border border-gray-100 px-3.5 py-2.5 flex items-center gap-1">
          <span className="wfw-dot" /><span className="wfw-dot" /><span className="wfw-dot" />
        </div>
      )}

      {/* Burbuja de mensaje */}
      {showBubble && (
        <div className="wfw-bubble relative bg-white rounded-2xl rounded-br-sm shadow-lg border border-gray-100 px-4 py-3 max-w-[240px]">
          <button
            onClick={() => { setBubbleClosed(true); setUnread(false) }}
            aria-label="Cerrar mensaje"
            className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-600 text-xs flex items-center justify-center shadow"
          >
            ×
          </button>
          <button onClick={handleOpen} className="text-left">
            <p className="text-sm text-gray-800 leading-snug">{welcomeMessage}</p>
          </button>
        </div>
      )}

      {/* Botón flotante */}
      <button
        type="button"
        onClick={handleOpen}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpen() } }}
        aria-label="Abrir chat de WhatsApp"
        role="button"
        className="relative bg-[#25D366] hover:brightness-105 active:scale-95 text-white w-14 h-14 rounded-full shadow-2xl shadow-green-600/40 flex items-center justify-center transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-green-400/40"
      >
        <WhatsAppIcon className="w-7 h-7" />
        {unread && (
          <span className="wfw-badge absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center border-2 border-white">
            1
          </span>
        )}
      </button>
    </div>
  )
}
