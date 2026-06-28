'use client'

/**
 * RestTimer — overlay de descanso entre series. Cuenta regresiva con anillo
 * circular, vibración al terminar, y controles para saltar o ajustar. Es UI
 * pura: no decide nada de entrenamiento.
 */
import { useEffect, useRef, useState } from 'react'
import { X, Plus, Minus } from 'lucide-react'

export default function RestTimer({ seconds, onClose }: { seconds: number; onClose: () => void }) {
  const [total, setTotal] = useState(seconds)
  const [remaining, setRemaining] = useState(seconds)
  const done = useRef(false)

  useEffect(() => {
    if (remaining <= 0) {
      if (!done.current) {
        done.current = true
        try { navigator.vibrate?.([120, 60, 120]) } catch { /* noop */ }
      }
      return
    }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000)
    return () => clearTimeout(t)
  }, [remaining])

  const pct = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0
  const R = 54
  const C = 2 * Math.PI * R
  const mm = String(Math.floor(Math.max(0, remaining) / 60)).padStart(1, '0')
  const ss = String(Math.max(0, remaining) % 60).padStart(2, '0')
  const finished = remaining <= 0

  const adjust = (d: number) => {
    setRemaining((r) => Math.max(0, r + d))
    setTotal((t) => Math.max(1, t + d))
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-sm px-6">
      <button onClick={onClose} className="absolute top-5 right-5 text-white/50 hover:text-white" aria-label="Cerrar">
        <X className="w-7 h-7" />
      </button>

      <p className="text-amber-300 text-xs font-bold uppercase tracking-widest mb-6">
        {finished ? '¡A darle!' : 'Descanso'}
      </p>

      <div className="relative w-44 h-44">
        <svg viewBox="0 0 128 128" className="w-full h-full -rotate-90">
          <circle cx="64" cy="64" r={R} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="8" />
          <circle
            cx="64" cy="64" r={R} fill="none"
            stroke={finished ? '#34d399' : '#fbbf24'} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - pct)}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-4xl font-extrabold text-white tabular-nums">{mm}:{ss}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-8">
        <button onClick={() => adjust(-15)} className="flex items-center gap-1 rounded-xl bg-white/10 text-white text-sm font-semibold px-4 py-2.5 active:scale-95">
          <Minus className="w-4 h-4" /> 15s
        </button>
        <button onClick={onClose} className="rounded-xl bg-amber-400 text-slate-900 font-bold px-6 py-2.5 active:scale-95">
          {finished ? 'Siguiente serie' : 'Saltar'}
        </button>
        <button onClick={() => adjust(15)} className="flex items-center gap-1 rounded-xl bg-white/10 text-white text-sm font-semibold px-4 py-2.5 active:scale-95">
          <Plus className="w-4 h-4" /> 15s
        </button>
      </div>
    </div>
  )
}
