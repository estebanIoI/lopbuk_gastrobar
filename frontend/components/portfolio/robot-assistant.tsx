'use client'

// Robot flotante (Spline) conectado al asistente público de DAIMUZ.
// - Robot: web component <spline-viewer> cargado por CDN (sin deps npm).
// - Chat debajo; las respuestas aparecen como "nubecitas" arriba del robot.
import { useEffect, useRef, useState, createElement, type CSSProperties } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
const SPLINE_VIEWER_SRC = 'https://unpkg.com/@splinetool/viewer/build/spline-viewer.js'
// Escena del robot de portafolioesteban.
const DEFAULT_SCENE = 'https://prod.spline.design/FcZ66SFMX1YbF-0I/scene.splinecode'

type Msg = { role: 'user' | 'assistant'; content: string }

export function RobotAssistant({
  sceneUrl = DEFAULT_SCENE,
  accent = '#6366f1',
}: { sceneUrl?: string; accent?: string }) {
  const [ready, setReady] = useState(false)
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<Msg[]>([])
  const [bubble, setBubble] = useState<string>('¡Hola! Soy el asistente de DAIMUZ 👋 Pregúntame lo que quieras.')
  const [typing, setTyping] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Cargar el web component de Spline una sola vez.
  useEffect(() => {
    const existing = document.querySelector(`script[src="${SPLINE_VIEWER_SRC}"]`)
    if (existing) { setReady(true); return }
    const sc = document.createElement('script')
    sc.type = 'module'
    sc.src = SPLINE_VIEWER_SRC
    sc.onload = () => setReady(true)
    sc.onerror = () => setReady(false)
    document.head.appendChild(sc)
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [history, typing])

  const send = async () => {
    const text = input.trim()
    if (!text || typing) return
    setInput('')
    const nextHistory = [...history, { role: 'user' as const, content: text }]
    setHistory(nextHistory)
    setBubble('…')
    setTyping(true)
    try {
      const res = await fetch(`${API_URL}/chatbot/platform-assistant/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: nextHistory.slice(-8) }),
      })
      const json = await res.json()
      const reply = json?.data?.reply || json?.error || 'No pude responder ahora mismo.'
      setHistory(h => [...h, { role: 'assistant', content: reply }])
      revealBubble(reply)
    } catch {
      const reply = 'Ups, no me pude conectar. Intenta de nuevo en un momento.'
      setHistory(h => [...h, { role: 'assistant', content: reply }])
      setBubble(reply)
    } finally {
      setTyping(false)
    }
  }

  // Efecto "nubecita" que escribe la respuesta poco a poco.
  const revealBubble = (full: string) => {
    let i = 0
    setBubble('')
    const step = () => {
      i += 2
      setBubble(full.slice(0, i))
      if (i < full.length) setTimeout(step, 18)
    }
    step()
  }

  return (
    <div className="ra-wrap">
      <style>{`
        .ra-wrap { width: 100%; max-width: 460px; margin: 0 auto; }
        .ra-stage { position: relative; width: 100%; height: 360px; }
        .ra-stage spline-viewer { width: 100%; height: 100%; display: block; }
        .ra-fallback { width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:72px; }
        .ra-bubble {
          position: absolute; top: 6px; left: 50%; transform: translateX(-50%);
          max-width: 84%; background: #fff; color: #111827;
          border-radius: 18px; padding: 12px 16px; font-size: 14px; line-height: 1.4;
          box-shadow: 0 12px 30px rgba(0,0,0,.25); z-index: 5;
          animation: ra-pop .25s ease both;
        }
        .ra-bubble::after {
          content: ''; position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%);
          border-left: 9px solid transparent; border-right: 9px solid transparent; border-top: 9px solid #fff;
        }
        .ra-dots span { display:inline-block; width:6px; height:6px; border-radius:50%; background:#9ca3af; margin:0 2px; animation: ra-blink 1s infinite; }
        .ra-dots span:nth-child(2){ animation-delay:.2s } .ra-dots span:nth-child(3){ animation-delay:.4s }
        @keyframes ra-blink { 0%,80%,100%{opacity:.3} 40%{opacity:1} }
        @keyframes ra-pop { from{opacity:0; transform:translateX(-50%) translateY(6px) scale(.96)} to{opacity:1; transform:translateX(-50%) translateY(0) scale(1)} }
        .ra-log { max-height: 150px; overflow-y: auto; display:flex; flex-direction:column; gap:8px; margin-bottom:10px; }
        .ra-msg { font-size:13px; line-height:1.4; padding:8px 12px; border-radius:14px; max-width:85%; }
        .ra-msg.user { align-self:flex-end; background: var(--ra-accent); color:#fff; border-bottom-right-radius:4px; }
        .ra-msg.bot  { align-self:flex-start; background: rgba(255,255,255,.08); color:#e5e7eb; border-bottom-left-radius:4px; }
        .ra-form { display:flex; gap:8px; }
        .ra-input { flex:1; border-radius:999px; border:1px solid rgba(255,255,255,.18); background:rgba(255,255,255,.06); color:#fff; padding:11px 16px; font-size:14px; outline:none; }
        .ra-input::placeholder { color: rgba(255,255,255,.45); }
        .ra-send { border:none; border-radius:999px; padding:0 18px; color:#fff; font-weight:700; cursor:pointer; background: var(--ra-accent); }
        .ra-send:disabled { opacity:.5; cursor:not-allowed; }
      `}</style>

      <div className="ra-stage" style={{ ['--ra-accent' as string]: accent } as CSSProperties}>
        {bubble && (
          <div className="ra-bubble">
            {bubble === '…'
              ? <span className="ra-dots"><span /><span /><span /></span>
              : bubble}
          </div>
        )}
        {ready
          ? createElement('spline-viewer' as any, { url: sceneUrl, 'events-target': 'global' })
          : <div className="ra-fallback" aria-hidden="true">🤖</div>}
      </div>

      <div style={{ ['--ra-accent' as string]: accent } as CSSProperties}>
        {history.length > 0 && (
          <div className="ra-log" ref={scrollRef}>
            {history.map((m, i) => (
              <div key={i} className={`ra-msg ${m.role === 'user' ? 'user' : 'bot'}`}>{m.content}</div>
            ))}
          </div>
        )}
        <form className="ra-form" onSubmit={(e) => { e.preventDefault(); send() }}>
          <input
            className="ra-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escríbele al robot…"
            aria-label="Mensaje para el asistente"
          />
          <button className="ra-send" type="submit" disabled={typing || !input.trim()}>Enviar</button>
        </form>
      </div>
    </div>
  )
}

export default RobotAssistant
