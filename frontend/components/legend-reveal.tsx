'use client'

/**
 * legend-reveal.tsx — Reveal full-screen al activar LEGEND (G5).
 * Animación corta (≤ config.revealDuration, def. 2.5s) y SKIPPABLE (tap para saltar).
 * Glitch dorado inspirado en el botón Chat Daimuz; no persistente.
 */
import { useEffect, useRef } from 'react'
import { Crown } from 'lucide-react'
import { hapticLegend } from '@/lib/haptics'

export interface LegendRevealConfig {
  animation?: 'chat-daimuz' | 'flame' | 'confetti'
  primary?: string
  accent?: string
  revealDuration?: number
}

export default function LegendReveal({ config, onDone }: { config?: LegendRevealConfig; onDone: () => void }) {
  const primary = config?.primary || '#D4AF37'
  const duration = Math.min(2500, Math.max(800, config?.revealDuration || 2500))
  const doneRef = useRef(false)
  const finish = () => { if (doneRef.current) return; doneRef.current = true; onDone() }

  useEffect(() => {
    hapticLegend()
    const t = setTimeout(finish, duration)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center cursor-pointer overflow-hidden"
      style={{ background: 'radial-gradient(circle at 50% 40%, #2a2410 0%, #0a0a0a 70%)' }}
      onClick={finish}
      role="button"
      aria-label="Saltar animación"
    >
      <style>{`
        .lg-glitch, .lg-glitch::after {
          font-size: clamp(40px, 14vw, 90px);
          font-weight: 900;
          letter-spacing: 8px;
          line-height: 1;
          color: ${primary};
          position: relative;
          text-shadow: 0 0 18px ${primary}99;
        }
        .lg-glitch::after {
          --s0: inset(50% 50% 50% 50%);
          --s1: inset(80% -6px 0 0);
          --s2: inset(50% -6px 30% 0);
          --s3: inset(10% -6px 85% 0);
          --s4: inset(40% -6px 43% 0);
          --s5: inset(80% -6px 5% 0);
          content: "LEGEND";
          position: absolute; top: 0; left: 0; right: 0; bottom: 0;
          color: #fff;
          text-shadow: -3px 0 ${primary}, 3px 0 #00e6f6;
          clip-path: var(--s0);
          animation: lgGlitch 1.1s steps(2,end) 2;
        }
        @keyframes lgGlitch {
          0%{clip-path:var(--s1);transform:translate(-14px,-6px)}
          20%{clip-path:var(--s3);transform:translate(8px,6px)}
          40%{clip-path:var(--s2);transform:translate(-6px,0)}
          60%{clip-path:var(--s4);transform:translate(6px,6px)}
          80%{clip-path:var(--s5);transform:translate(12px,-6px)}
          100%{clip-path:var(--s0);transform:translate(0)}
        }
        .lg-pop { animation: lgPop .5s ease-out both; }
        @keyframes lgPop { 0%{opacity:0;transform:scale(.6)} 100%{opacity:1;transform:scale(1)} }
        .lg-fade { animation: lgFade .6s ease-out .25s both; }
        @keyframes lgFade { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      <Crown className="lg-pop mb-5" style={{ width: 64, height: 64, color: primary }} />
      <div className="lg-glitch select-none">LEGEND</div>
      <p className="lg-fade mt-5 text-sm tracking-[0.3em] uppercase text-white/70">Acceso desbloqueado</p>
      <p className="lg-fade mt-8 text-[11px] text-white/30">toca para continuar</p>
    </div>
  )
}
