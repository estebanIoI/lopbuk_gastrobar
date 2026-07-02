'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface HiddenStore {
  id: string
  name: string
  slug: string
  logoUrl?: string
  coverUrl?: string
  cardDescription?: string
  hiddenTheme: string
  vipIntroEnabled: boolean
  grant?: string
}

type Phase = 'init' | 'scan' | 'validate' | 'reveal' | 'granted' | 'denied' | 'expired'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

// ── Aurora de fondo (dos blobs radiales que derivan lento) ──────────────────────
function Aurora() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute rounded-full" style={{
        width: '55vmax', height: '55vmax', left: '-10vmax', top: '-15vmax',
        background: 'radial-gradient(circle, rgba(0,200,90,0.16), transparent 60%)',
        filter: 'blur(30px)', animation: 'aurora-a 14s ease-in-out infinite',
      }} />
      <div className="absolute rounded-full" style={{
        width: '50vmax', height: '50vmax', right: '-12vmax', bottom: '-18vmax',
        background: 'radial-gradient(circle, rgba(0,140,120,0.14), transparent 60%)',
        filter: 'blur(30px)', animation: 'aurora-b 18s ease-in-out infinite',
      }} />
      {/* Rejilla de perspectiva sutil */}
      <div className="absolute inset-0 opacity-[0.06]" style={{
        backgroundImage: 'linear-gradient(rgba(0,255,120,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,120,0.5) 1px, transparent 1px)',
        backgroundSize: '46px 46px',
        maskImage: 'radial-gradient(ellipse 70% 60% at 50% 45%, #000 40%, transparent 80%)',
        WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 45%, #000 40%, transparent 80%)',
      }} />
    </div>
  )
}

// ── Partículas flotantes (con brillo) ──────────────────────────────────────────
function Particles({ count = 30, celebrate = false }: { count?: number; celebrate?: boolean }) {
  const [particles, setParticles] = useState<Array<React.CSSProperties>>([])
  useEffect(() => {
    setParticles(
      Array.from({ length: count }).map((_, i) => {
        const size = Math.random() * 3 + 1
        return {
          width: `${size}px`, height: `${size}px`,
          background: `rgba(${i % 3 === 0 ? '150,255,170' : '0,220,110'}, ${Math.random() * 0.7 + 0.3})`,
          left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
          boxShadow: `0 0 ${size * 3}px rgba(0,255,120,0.6)`,
          animation: `${celebrate ? 'rise-particle' : 'float-particle'} ${3 + Math.random() * 4}s ease-in-out ${Math.random() * 3}s infinite`,
        }
      })
    )
  }, [count, celebrate])
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((style, i) => <div key={i} className="absolute rounded-full" style={style} />)}
    </div>
  )
}

// ── Líneas de escaneo ─────────────────────────────────────────────────────────
function ScanLines({ active }: { active: boolean }) {
  return (
    <div className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${active ? 'opacity-100' : 'opacity-0'}`}>
      <div className="absolute inset-0" style={{
        background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,200,100,0.04) 2px, rgba(0,200,100,0.04) 4px)',
      }} />
      <div className="absolute left-0 right-0 h-[2px]" style={{
        background: 'linear-gradient(90deg, transparent, rgba(0,255,100,0.8), transparent)',
        animation: 'scan-line 2s ease-in-out infinite',
      }} />
    </div>
  )
}

// ── Terminal de texto ─────────────────────────────────────────────────────────
function Terminal({ lines }: { lines: string[] }) {
  return (
    <div className="font-mono text-xs space-y-1">
      {lines.map((line, i) => (
        <div key={i} className="flex items-start gap-2" style={{ animation: `fade-in-line 0.4s ease ${i * 0.35}s both` }}>
          <span style={{ color: 'rgba(0,255,100,0.6)' }}>›</span>
          <span style={{ color: 'rgba(200,255,200,0.85)' }}>{line}</span>
          <span className="ml-auto text-[10px]" style={{ color: 'rgba(0,255,100,0.5)', animation: `fade-in-line 0.3s ease ${i * 0.35 + 0.9}s both` }}>OK</span>
        </div>
      ))}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function HiddenAccessPage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('init')
  const [store, setStore] = useState<HiddenStore | null>(null)
  const [manualCode, setManualCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const [submittingCode, setSubmittingCode] = useState(false)
  const [progress, setProgress] = useState(0)
  const [entering, setEntering] = useState(false)
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 })
  const [codeFocus, setCodeFocus] = useState(false)
  const phaseRef = useRef<Phase>('init')

  // Parallax 3D sutil: la tarjeta se inclina siguiendo el cursor/dedo.
  const onTilt = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    setTilt({ rx: +(py * -10).toFixed(2), ry: +(px * 12).toFixed(2) })
  }
  const resetTilt = () => setTilt({ rx: 0, ry: 0 })

  const setPhaseSync = (p: Phase) => {
    phaseRef.current = p
    setPhase(p)
  }

  // Contador de progreso durante escaneo/validación (sensación de "descifrado").
  useEffect(() => {
    if (phase === 'scan' || phase === 'validate') {
      const id = setInterval(() => setProgress(p => Math.min(p + Math.random() * 8 + 2, 96)), 110)
      return () => clearInterval(id)
    }
    if (phase === 'reveal' || phase === 'granted') setProgress(100)
    if (phase === 'denied' || phase === 'expired') setProgress(0)
  }, [phase])

  // ── Animación por fases ───────────────────────────────────────────────────
  useEffect(() => {
    if (!token) { setPhaseSync('denied'); return }
    const run = async () => {
      setPhaseSync('scan')
      await delay(1300)
      setPhaseSync('validate')
      let result: any
      try {
        const res = await fetch(`${API}/hidden-access/validate-token`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        result = await res.json()
      } catch { setPhaseSync('denied'); return }
      if (!result.success) {
        await delay(700)
        setPhaseSync(result.error?.includes('expir') ? 'expired' : 'denied')
        return
      }
      await delay(1000)
      setPhaseSync('reveal')
      setStore(result.data.store)
      await delay(2000)
      setPhaseSync('granted')
    }
    run()
  }, [token])

  // ── Validar código manual ─────────────────────────────────────────────────
  const submitCode = async () => {
    if (!manualCode.trim()) return
    setSubmittingCode(true)
    setCodeError('')
    try {
      const res = await fetch(`${API}/hidden-access/validate-code`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: manualCode.trim() }),
      })
      const result = await res.json()
      if (!result.success) { setCodeError(result.error || 'Código inválido'); setSubmittingCode(false); return }
      setStore(result.data.store)
      setPhaseSync('reveal')
      await delay(2000)
      setPhaseSync('granted')
    } catch { setCodeError('Error de conexión'); setSubmittingCode(false) }
  }

  const goToStore = () => {
    if (!store) return
    setEntering(true)
    // Persistimos el grant (clave de acceso a la tienda oculta) para que el
    // storefront lo envíe en cada request; sin él, el slug "a pelo" da 404.
    if (store.grant && typeof sessionStorage !== 'undefined') {
      try { sessionStorage.setItem(`hg:${store.slug}`, store.grant) } catch { /* noop */ }
    }
    const hg = store.grant ? `&hg=${encodeURIComponent(store.grant)}` : ''
    setTimeout(() => router.push(`/?store=${store.slug}${hg}`), 620)
  }

  const pct = Math.round(progress)

  // ── Render por fase ───────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes float-particle { 0%,100% { transform: translateY(0) scale(1); opacity:.6 } 50% { transform: translateY(-20px) scale(1.2); opacity:1 } }
        @keyframes rise-particle { 0% { transform: translateY(20px) scale(.6); opacity:0 } 30% { opacity:1 } 100% { transform: translateY(-60px) scale(1.1); opacity:0 } }
        @keyframes scan-line { 0% { top:-2px } 100% { top:100% } }
        @keyframes fade-in-line { from { opacity:0; transform: translateX(-8px) } to { opacity:1; transform: translateX(0) } }
        @keyframes pulse-ring { 0% { transform: scale(.95); box-shadow: 0 0 0 0 rgba(0,255,100,.6) } 70% { transform: scale(1); box-shadow: 0 0 0 22px rgba(0,255,100,0) } 100% { transform: scale(.95) } }
        @keyframes reveal-blur { from { filter: blur(30px); opacity:0; transform: scale(.8) } to { filter: blur(0); opacity:1; transform: scale(1) } }
        @keyframes glow-pulse { 0%,100% { text-shadow: 0 0 8px rgba(0,255,100,.4) } 50% { text-shadow: 0 0 24px rgba(0,255,100,.9), 0 0 48px rgba(0,200,80,.4) } }
        @keyframes logo-emerge { from { filter: blur(20px) brightness(3); opacity:0; transform: scale(1.3) } to { filter: blur(0) brightness(1); opacity:1; transform: scale(1) } }
        @keyframes granted-glow { from { opacity:0; transform: translateY(16px) } to { opacity:1; transform: translateY(0) } }
        @keyframes spin-slow { to { transform: rotate(360deg) } }
        @keyframes blink { 0%,100% { opacity:1 } 50% { opacity:0 } }
        @keyframes aurora-a { 0%,100% { transform: translate(0,0) scale(1) } 50% { transform: translate(8vmax,6vmax) scale(1.15) } }
        @keyframes aurora-b { 0%,100% { transform: translate(0,0) scale(1) } 50% { transform: translate(-7vmax,-5vmax) scale(1.1) } }
        @keyframes radar-sweep { to { transform: rotate(360deg) } }
        @keyframes energy-burst { 0% { transform: scale(.4); opacity:.8 } 100% { transform: scale(2.4); opacity:0 } }
        @keyframes ripple { 0% { transform: scale(.6); opacity:.7 } 100% { transform: scale(2.2); opacity:0 } }
        @keyframes check-draw { to { stroke-dashoffset: 0 } }
        @keyframes shine-sweep { 0% { transform: translateX(-130%) skewX(-20deg) } 60%,100% { transform: translateX(230%) skewX(-20deg) } }
        @keyframes card-shine { 0% { transform: translateX(-120%) rotate(8deg) } 100% { transform: translateX(320%) rotate(8deg) } }
        @keyframes progress-glow { 0%,100% { box-shadow: 0 0 8px rgba(0,255,120,.5) } 50% { box-shadow: 0 0 18px rgba(0,255,120,.9) } }
        @keyframes flash-out { from { opacity:0 } to { opacity:1 } }
        @keyframes holo-rotate { to { transform: rotate(360deg) } }
        @keyframes seal-in { 0% { opacity:0; transform: scale(.4) rotate(-18deg) } 60% { transform: scale(1.12) rotate(4deg) } 100% { opacity:1; transform: scale(1) rotate(0) } }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; transition-duration: .001ms !important; }
        }
      `}</style>

      <div className="fixed inset-0 flex items-center justify-center overflow-hidden" style={{ background: 'radial-gradient(ellipse at 50% 35%, #04160b 0%, #020a04 60%, #010502 100%)', color: '#e0ffe0' }}>
        <Aurora />
        <Particles celebrate={phase === 'granted'} count={phase === 'granted' ? 40 : 28} />
        <ScanLines active={phase === 'scan' || phase === 'validate'} />

        {/* Ruido estático */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.025]"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")', backgroundSize: '150px' }} />

        {/* ── FASE: INIT / SCAN ── */}
        {(phase === 'init' || phase === 'scan') && (
          <div className="relative z-10 text-center space-y-8 px-6" style={{ animation: 'granted-glow 0.5s ease both' }}>
            <div className="relative mx-auto w-28 h-28 flex items-center justify-center">
              {/* Radar sweep */}
              <div className="absolute inset-0 rounded-full overflow-hidden" style={{ opacity: 0.5 }}>
                <div className="absolute inset-0" style={{ background: 'conic-gradient(from 0deg, transparent 0deg, rgba(0,255,120,0.35) 40deg, transparent 60deg)', animation: 'radar-sweep 1.8s linear infinite' }} />
              </div>
              <div className="absolute inset-2 rounded-full border" style={{ borderColor: 'rgba(0,255,100,0.15)' }} />
              <div className="w-20 h-20 rounded-full border-2 flex items-center justify-center"
                style={{ borderColor: 'rgba(0,255,100,0.4)', animation: 'pulse-ring 1.5s ease infinite', boxShadow: '0 0 30px rgba(0,200,80,0.3)' }}>
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="rgba(0,255,100,0.9)" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
                  <rect x="7" y="7" width="10" height="10" rx="1" />
                </svg>
              </div>
            </div>
            <div>
              <p className="text-xs tracking-[0.3em] uppercase mb-2" style={{ color: 'rgba(0,255,100,0.5)' }}>DAIMUZ HIDDEN LAYER</p>
              <p className="text-lg font-light tracking-widest" style={{ animation: 'glow-pulse 2s ease infinite' }}>
                Estableciendo enlace seguro<span style={{ animation: 'blink 1s step-end infinite' }}>_</span>
              </p>
            </div>
          </div>
        )}

        {/* ── FASE: VALIDATE ── */}
        {phase === 'validate' && (
          <div className="relative z-10 w-full max-w-sm px-6 space-y-6" style={{ animation: 'granted-glow 0.4s ease both' }}>
            <div className="text-center">
              <p className="text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: 'rgba(0,255,100,0.4)' }}>DESCIFRANDO CAPA PRIVADA</p>
              <p className="font-mono text-5xl font-bold tabular-nums" style={{ color: 'rgba(120,255,160,0.95)', textShadow: '0 0 24px rgba(0,255,120,0.5)' }}>
                {pct}<span className="text-2xl align-top opacity-60">%</span>
              </p>
            </div>
            {/* Barra de progreso */}
            <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'rgba(0,80,30,0.4)' }}>
              <div className="h-full rounded-full transition-all duration-150" style={{
                width: `${pct}%`,
                background: 'linear-gradient(90deg, #00b840, #6fffa8)',
                animation: 'progress-glow 1.2s ease infinite',
              }} />
            </div>
            <div className="rounded-xl border p-4 space-y-2" style={{ borderColor: 'rgba(0,255,100,0.15)', background: 'rgba(0,40,10,0.6)', backdropFilter: 'blur(12px)' }}>
              <Terminal lines={[
                'Verificando firma del token…',
                'Consultando capa privada…',
                'Validando ventana de acceso…',
              ]} />
            </div>
          </div>
        )}

        {/* ── FASE: REVEAL ── */}
        {phase === 'reveal' && store && (
          <div className="relative z-10 text-center px-6 space-y-8" style={{ animation: 'reveal-blur 0.8s ease both' }}>
            <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'rgba(0,255,100,0.5)' }}>CAPA OCULTA DETECTADA</p>
            <div className="relative mx-auto w-32 h-32">
              {/* Ráfagas de energía */}
              {[0, 0.5, 1].map((d, i) => (
                <div key={i} className="absolute inset-0 rounded-full border" style={{ borderColor: 'rgba(0,255,120,0.5)', animation: `energy-burst 1.8s ease ${d}s infinite` }} />
              ))}
              <div className="absolute inset-0 rounded-full border-2 opacity-40" style={{ borderColor: 'rgba(0,255,100,0.6)', animation: 'spin-slow 3s linear infinite' }} />
              <div className="absolute inset-2 rounded-full border opacity-20" style={{ borderColor: 'rgba(0,255,100,0.4)', animation: 'spin-slow 5s linear reverse infinite' }} />
              <div className="absolute inset-5 rounded-full flex items-center justify-center overflow-hidden"
                style={{ background: 'rgba(0,20,5,0.9)', boxShadow: '0 0 50px rgba(0,220,90,0.5)', animation: 'logo-emerge 1s ease 0.3s both' }}>
                {store.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={store.logoUrl} alt={store.name} className="w-full h-full object-contain p-2" />
                ) : (
                  <span className="text-3xl font-black" style={{ color: 'rgba(0,255,100,0.9)' }}>{store.name.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
            </div>
            <div style={{ animation: 'granted-glow 0.6s ease 0.6s both', opacity: 0 }}>
              <p className="text-2xl font-bold tracking-wide" style={{ animation: 'glow-pulse 2s ease infinite' }}>{store.name}</p>
              {store.cardDescription && <p className="text-sm mt-1" style={{ color: 'rgba(200,255,200,0.5)' }}>{store.cardDescription}</p>}
            </div>
          </div>
        )}

        {/* ── FASE: GRANTED ── */}
        {phase === 'granted' && store && (
          <div className="relative z-10 w-full max-w-xs px-6 space-y-6 text-center" style={{ animation: 'granted-glow 0.6s ease both' }}>
            <div className="relative">
              {/* Ondas de éxito */}
              <div className="absolute left-1/2 top-6 -translate-x-1/2 w-14 h-14">
                {[0, 0.4, 0.8].map((d, i) => (
                  <div key={i} className="absolute inset-0 rounded-full border" style={{ borderColor: 'rgba(0,255,120,0.5)', animation: `ripple 1.8s ease ${d}s infinite` }} />
                ))}
              </div>
              {/* Check animado */}
              <div className="relative mx-auto mb-4 w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(0,180,60,0.18)', border: '1px solid rgba(0,255,100,0.5)', boxShadow: '0 0 28px rgba(0,220,90,0.45)' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="rgba(120,255,160,1)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" style={{ strokeDasharray: 30, strokeDashoffset: 30, animation: 'check-draw 0.5s ease 0.2s forwards' }} />
                </svg>
              </div>
              <p className="text-[10px] tracking-[0.3em] uppercase mb-1" style={{ color: 'rgba(0,255,100,0.5)' }}>ACCESO CONCEDIDO</p>
              <p className="text-base font-semibold">Bienvenido a la capa privada</p>
            </div>

            {/* Store card premium: borde holográfico + parallax 3D + sello VIP */}
            <div style={{ perspective: '900px' }}>
              <div
                onPointerMove={onTilt}
                onPointerLeave={resetTilt}
                className="relative rounded-[20px] p-[1.5px]"
                style={{
                  transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
                  transition: 'transform 0.25s ease',
                  transformStyle: 'preserve-3d',
                }}
              >
                {/* Borde holográfico animado */}
                <div className="absolute inset-0 rounded-[20px] overflow-hidden pointer-events-none" style={{ opacity: 0.9 }}>
                  <div className="absolute -inset-[40%]" style={{
                    background: 'conic-gradient(from 0deg, transparent, rgba(0,255,140,0.7), transparent 25%, rgba(80,255,180,0.5) 50%, transparent 62%, rgba(0,200,120,0.6) 80%, transparent)',
                    animation: 'holo-rotate 6s linear infinite',
                  }} />
                </div>

                {/* Sello VIP */}
                <div className="absolute -top-2.5 -right-2.5 z-20 px-2.5 py-1 rounded-full text-[9px] font-bold tracking-[0.18em]"
                  style={{ background: 'linear-gradient(135deg,#0b3, #085)', color: '#eafff0', boxShadow: '0 4px 14px rgba(0,200,90,0.5)', border: '1px solid rgba(180,255,200,0.5)', animation: 'seal-in 0.6s ease 0.35s both' }}>
                  ★ VIP
                </div>

                <div className="relative rounded-[19px] overflow-hidden text-left"
                  style={{ background: 'rgba(0,26,8,0.92)', backdropFilter: 'blur(20px)' }}>
                  <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
                    <div className="absolute top-0 bottom-0 w-1/3" style={{ background: 'linear-gradient(90deg, transparent, rgba(180,255,200,0.16), transparent)', animation: 'card-shine 3.2s ease 0.8s infinite' }} />
                  </div>
                  {store.coverUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={store.coverUrl} alt={store.name} className="w-full h-24 object-cover opacity-60" />
                  )}
                  <div className="p-4 flex items-center gap-3 relative z-0">
                    {store.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={store.logoUrl} alt={store.name} className="w-11 h-11 rounded-xl object-contain shrink-0" style={{ background: 'rgba(0,40,10,0.9)' }} />
                    ) : (
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold" style={{ background: 'rgba(0,180,60,0.2)', color: 'rgba(0,255,100,0.9)' }}>
                        {store.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{store.name}</p>
                      {store.cardDescription
                        ? <p className="text-xs truncate" style={{ color: 'rgba(200,255,200,0.5)' }}>{store.cardDescription}</p>
                        : <p className="text-[11px]" style={{ color: 'rgba(0,255,120,0.55)' }}>Colección privada · solo por invitación</p>}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA con brillo que barre */}
            <button
              onClick={goToStore}
              disabled={entering}
              className="relative w-full py-3.5 rounded-2xl font-semibold text-sm overflow-hidden transition-transform active:scale-95 disabled:opacity-80"
              style={{ background: 'linear-gradient(135deg, #00c246, #006b30)', color: '#fff', boxShadow: '0 10px 34px rgba(0,190,70,0.4)' }}
            >
              <span className="pointer-events-none absolute inset-0 w-1/3" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)', animation: 'shine-sweep 2.6s ease infinite' }} />
              <span className="relative inline-flex items-center justify-center gap-2">
                {entering
                  ? <><span className="w-4 h-4 rounded-full border-2 border-white/70 border-t-transparent" style={{ animation: 'spin-slow 0.7s linear infinite' }} /> Entrando…</>
                  : <>Entrar a la tienda <span style={{ animation: 'glow-pulse 1.8s ease infinite' }}>→</span></>}
              </span>
            </button>

            <p className="text-[10px]" style={{ color: 'rgba(200,255,200,0.28)' }}>
              Este acceso es personal. No compartas este enlace.
            </p>
          </div>
        )}

        {/* ── FASE: DENIED ── */}
        {phase === 'denied' && (
          <div className="relative z-10 w-full max-w-xs px-6 space-y-6 text-center" style={{ animation: 'granted-glow 0.5s ease both' }}>
            <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center border" style={{ borderColor: 'rgba(255,60,60,0.4)', background: 'rgba(60,0,0,0.4)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,80,80,0.9)" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] tracking-[0.3em] uppercase mb-1" style={{ color: 'rgba(255,80,80,0.5)' }}>ACCESO DENEGADO</p>
              <p className="text-sm font-light" style={{ color: 'rgba(255,200,200,0.7)' }}>Este enlace no es válido o no tienes permiso de acceso.</p>
            </div>
            <div className="space-y-3">
              <p className="text-xs" style={{ color: 'rgba(200,255,200,0.35)' }}>¿Tienes un código de acceso?</p>
              <div className="flex gap-2">
                <input
                  value={manualCode}
                  onChange={e => setManualCode(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && submitCode()}
                  onFocus={() => setCodeFocus(true)}
                  onBlur={() => setCodeFocus(false)}
                  placeholder="XXXX-WORD-000" maxLength={20}
                  className="flex-1 px-3 py-2.5 rounded-xl text-sm font-mono text-center outline-none transition-all"
                  style={{
                    background: 'rgba(0,30,8,0.9)',
                    border: `1px solid ${codeFocus ? 'rgba(0,255,120,0.7)' : 'rgba(0,255,100,0.2)'}`,
                    color: 'rgba(200,255,200,0.95)',
                    letterSpacing: '0.12em',
                    boxShadow: codeFocus ? '0 0 20px rgba(0,255,120,0.35)' : 'none',
                  }}
                />
                <button onClick={submitCode} disabled={submittingCode}
                  className="px-4 rounded-xl text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-50"
                  style={{ background: 'rgba(0,180,60,0.2)', border: '1px solid rgba(0,255,100,0.2)', color: 'rgba(0,255,100,0.9)' }}>
                  OK
                </button>
              </div>
              {codeError && <p className="text-xs" style={{ color: 'rgba(255,100,100,0.8)' }}>{codeError}</p>}
            </div>
          </div>
        )}

        {/* ── FASE: EXPIRED ── */}
        {phase === 'expired' && (
          <div className="relative z-10 w-full max-w-xs px-6 space-y-5 text-center" style={{ animation: 'granted-glow 0.5s ease both' }}>
            <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center border" style={{ borderColor: 'rgba(255,180,0,0.4)', background: 'rgba(40,20,0,0.5)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,180,0,0.9)" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'rgba(255,180,0,0.5)' }}>ACCESO EXPIRADO</p>
            <p className="text-sm" style={{ color: 'rgba(255,220,150,0.7)' }}>Este enlace de acceso ya venció. Solicita uno nuevo al comercio.</p>
          </div>
        )}

        {/* Flash de entrada al pulsar CTA */}
        {entering && <div className="absolute inset-0 z-20 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 60%, rgba(120,255,170,0.9), rgba(0,60,25,0.4) 60%, transparent)', animation: 'flash-out 0.6s ease forwards' }} />}

        {/* Marca de agua inferior */}
        <div className="absolute bottom-6 left-0 right-0 text-center">
          <p className="text-[9px] tracking-[0.25em] uppercase" style={{ color: 'rgba(0,255,100,0.14)' }}>DAIMUZ HIDDEN LAYER™</p>
        </div>
      </div>
    </>
  )
}

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}
