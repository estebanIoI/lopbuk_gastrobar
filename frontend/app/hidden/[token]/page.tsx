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
}

type Phase = 'init' | 'scan' | 'validate' | 'reveal' | 'granted' | 'denied' | 'expired'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

// ── Componente de partículas ──────────────────────────────────────────────────
function Particles() {
  const [particles, setParticles] = useState<Array<React.CSSProperties>>([])

  useEffect(() => {
    setParticles(
      Array.from({ length: 24 }).map((_, i) => ({
        width: `${Math.random() * 3 + 1}px`,
        height: `${Math.random() * 3 + 1}px`,
        background: `rgba(${i % 2 === 0 ? '120,255,120' : '0,200,100'}, ${Math.random() * 0.7 + 0.3})`,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        animation: `float-particle ${3 + Math.random() * 4}s ease-in-out ${Math.random() * 3}s infinite`,
      }))
    )
  }, [])

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((style, i) => (
        <div key={i} className="absolute rounded-full" style={style} />
      ))}
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
        <div key={i} className="flex items-start gap-2" style={{ animation: `fade-in-line 0.4s ease ${i * 0.15}s both` }}>
          <span style={{ color: 'rgba(0,255,100,0.6)' }}>›</span>
          <span style={{ color: 'rgba(200,255,200,0.85)' }}>{line}</span>
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
  const phaseRef = useRef<Phase>('init')

  const setPhaseSync = (p: Phase) => {
    phaseRef.current = p
    setPhase(p)
  }

  // ── Animación por fases ───────────────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setPhaseSync('denied')
      return
    }

    const run = async () => {
      // Fase 1: SCAN
      setPhaseSync('scan')
      await delay(1200)

      // Fase 2: VALIDATE
      setPhaseSync('validate')
      let result: any
      try {
        const res = await fetch(`${API}/hidden-access/validate-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        result = await res.json()
      } catch {
        setPhaseSync('denied')
        return
      }

      if (!result.success) {
        await delay(600)
        setPhaseSync(result.error?.includes('expir') ? 'expired' : 'denied')
        return
      }

      await delay(900)

      // Fase 3: REVEAL
      setPhaseSync('reveal')
      setStore(result.data.store)
      await delay(1800)

      // Fase 4: GRANTED
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: manualCode.trim() }),
      })
      const result = await res.json()
      if (!result.success) {
        setCodeError(result.error || 'Código inválido')
        setSubmittingCode(false)
        return
      }
      setStore(result.data.store)
      setPhaseSync('reveal')
      await delay(1800)
      setPhaseSync('granted')
    } catch {
      setCodeError('Error de conexión')
      setSubmittingCode(false)
    }
  }

  const goToStore = () => {
    if (!store) return
    router.push(`/?store=${store.slug}`)
  }

  // ── Render por fase ───────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes float-particle {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.6; }
          50% { transform: translateY(-20px) scale(1.2); opacity: 1; }
        }
        @keyframes scan-line {
          0% { top: -2px; }
          100% { top: 100%; }
        }
        @keyframes fade-in-line {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0,255,100,0.6); }
          70% { transform: scale(1); box-shadow: 0 0 0 20px rgba(0,255,100,0); }
          100% { transform: scale(0.95); }
        }
        @keyframes reveal-blur {
          from { filter: blur(30px); opacity: 0; transform: scale(0.8); }
          to { filter: blur(0); opacity: 1; transform: scale(1); }
        }
        @keyframes glow-pulse {
          0%, 100% { text-shadow: 0 0 8px rgba(0,255,100,0.4); }
          50% { text-shadow: 0 0 24px rgba(0,255,100,0.9), 0 0 48px rgba(0,200,80,0.4); }
        }
        @keyframes logo-emerge {
          from { filter: blur(20px) brightness(3); opacity: 0; transform: scale(1.3); }
          to { filter: blur(0) brightness(1); opacity: 1; transform: scale(1); }
        }
        @keyframes granted-glow {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin-slow { to { transform: rotate(360deg); } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      `}</style>

      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ background: '#020a04', color: '#e0ffe0' }}
      >
        <Particles />
        <ScanLines active={phase === 'scan' || phase === 'validate'} />

        {/* ── Ruido estático ── */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.025]"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")', backgroundSize: '150px' }} />

        {/* ── FASE: INIT / SCAN ── */}
        {(phase === 'init' || phase === 'scan') && (
          <div className="relative z-10 text-center space-y-8 px-6" style={{ animation: 'granted-glow 0.5s ease both' }}>
            <div className="mx-auto w-20 h-20 rounded-full border-2 flex items-center justify-center"
              style={{ borderColor: 'rgba(0,255,100,0.4)', animation: 'pulse-ring 1.5s ease infinite', boxShadow: '0 0 30px rgba(0,200,80,0.3)' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(0,255,100,0.9)" strokeWidth="1.5" strokeLinecap="round">
                <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
                <rect x="7" y="7" width="10" height="10" rx="1" />
              </svg>
            </div>
            <div>
              <p className="text-xs tracking-[0.3em] uppercase mb-2" style={{ color: 'rgba(0,255,100,0.5)' }}>DAIMUZ HIDDEN LAYER</p>
              <p className="text-lg font-light tracking-widest" style={{ animation: 'glow-pulse 2s ease infinite' }}>
                Inicializando acceso
                <span style={{ animation: 'blink 1s step-end infinite' }}>_</span>
              </p>
            </div>
          </div>
        )}

        {/* ── FASE: VALIDATE ── */}
        {phase === 'validate' && (
          <div className="relative z-10 w-full max-w-sm px-6 space-y-6" style={{ animation: 'granted-glow 0.4s ease both' }}>
            <p className="text-[10px] tracking-[0.3em] uppercase text-center" style={{ color: 'rgba(0,255,100,0.4)' }}>VALIDANDO CREDENCIALES</p>
            <div className="rounded-xl border p-4 space-y-2"
              style={{ borderColor: 'rgba(0,255,100,0.15)', background: 'rgba(0,40,10,0.6)', backdropFilter: 'blur(12px)' }}>
              <Terminal lines={[
                'Verificando firma del token...',
                'Consultando capa privada...',
                'Validando ventana de acceso...',
              ]} />
            </div>
            <div className="flex justify-center">
              <div className="w-6 h-6 rounded-full border-2 border-t-transparent"
                style={{ borderColor: 'rgba(0,255,100,0.6)', borderTopColor: 'transparent', animation: 'spin-slow 0.8s linear infinite' }} />
            </div>
          </div>
        )}

        {/* ── FASE: REVEAL ── */}
        {phase === 'reveal' && store && (
          <div className="relative z-10 text-center px-6 space-y-8" style={{ animation: 'reveal-blur 0.8s ease both' }}>
            <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'rgba(0,255,100,0.5)' }}>CAPA OCULTA DETECTADA</p>

            <div className="relative mx-auto w-28 h-28">
              {/* Anillo exterior */}
              <div className="absolute inset-0 rounded-full border-2 opacity-40"
                style={{ borderColor: 'rgba(0,255,100,0.6)', animation: 'spin-slow 3s linear infinite' }} />
              <div className="absolute inset-2 rounded-full border opacity-20"
                style={{ borderColor: 'rgba(0,255,100,0.4)', animation: 'spin-slow 5s linear reverse infinite' }} />
              {/* Logo o iniciales */}
              <div className="absolute inset-4 rounded-full flex items-center justify-center overflow-hidden"
                style={{ background: 'rgba(0,20,5,0.9)', boxShadow: '0 0 40px rgba(0,200,80,0.4)', animation: 'logo-emerge 1s ease 0.3s both' }}>
                {store.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={store.logoUrl} alt={store.name} className="w-full h-full object-contain p-2" />
                ) : (
                  <span className="text-2xl font-black" style={{ color: 'rgba(0,255,100,0.9)' }}>
                    {store.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
            </div>

            <div style={{ animation: 'granted-glow 0.6s ease 0.6s both', opacity: 0 }}>
              <p className="text-xl font-bold tracking-wide" style={{ animation: 'glow-pulse 2s ease infinite' }}>{store.name}</p>
              {store.cardDescription && (
                <p className="text-sm mt-1" style={{ color: 'rgba(200,255,200,0.5)' }}>{store.cardDescription}</p>
              )}
            </div>
          </div>
        )}

        {/* ── FASE: GRANTED ── */}
        {phase === 'granted' && store && (
          <div className="relative z-10 w-full max-w-xs px-6 space-y-6 text-center" style={{ animation: 'granted-glow 0.6s ease both' }}>
            <div>
              <div className="mx-auto mb-4 w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(0,180,60,0.15)', border: '1px solid rgba(0,255,100,0.4)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(0,255,100,0.9)" strokeWidth="2" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-[10px] tracking-[0.3em] uppercase mb-1" style={{ color: 'rgba(0,255,100,0.4)' }}>ACCESO CONCEDIDO</p>
              <p className="text-base font-semibold">Bienvenido a la capa privada</p>
            </div>

            {/* Store card premium */}
            <div className="rounded-2xl overflow-hidden border text-left"
              style={{ borderColor: 'rgba(0,255,100,0.15)', background: 'rgba(0,30,8,0.8)', backdropFilter: 'blur(20px)' }}>
              {store.coverUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={store.coverUrl} alt={store.name} className="w-full h-24 object-cover opacity-60" />
              )}
              <div className="p-4 flex items-center gap-3">
                {store.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={store.logoUrl} alt={store.name}
                    className="w-10 h-10 rounded-xl object-contain shrink-0"
                    style={{ background: 'rgba(0,40,10,0.9)' }} />
                ) : (
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold"
                    style={{ background: 'rgba(0,180,60,0.2)', color: 'rgba(0,255,100,0.9)' }}>
                    {store.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{store.name}</p>
                  {store.cardDescription && (
                    <p className="text-xs truncate" style={{ color: 'rgba(200,255,200,0.5)' }}>{store.cardDescription}</p>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={goToStore}
              className="w-full py-3.5 rounded-2xl font-semibold text-sm transition-all hover:brightness-110 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #00b840, #005c2a)',
                color: '#fff',
                boxShadow: '0 8px 32px rgba(0,180,60,0.35)',
              }}
            >
              Entrar a la tienda →
            </button>

            <p className="text-[10px]" style={{ color: 'rgba(200,255,200,0.25)' }}>
              Este acceso es personal. No compartas este enlace.
            </p>
          </div>
        )}

        {/* ── FASE: DENIED ── */}
        {phase === 'denied' && (
          <div className="relative z-10 w-full max-w-xs px-6 space-y-6 text-center" style={{ animation: 'granted-glow 0.5s ease both' }}>
            <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center border"
              style={{ borderColor: 'rgba(255,60,60,0.4)', background: 'rgba(60,0,0,0.4)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,80,80,0.9)" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] tracking-[0.3em] uppercase mb-1" style={{ color: 'rgba(255,80,80,0.5)' }}>ACCESO DENEGADO</p>
              <p className="text-sm font-light" style={{ color: 'rgba(255,200,200,0.7)' }}>
                Este enlace no es válido o no tienes permiso de acceso.
              </p>
            </div>

            {/* Entrada por código manual como fallback */}
            <div className="space-y-3">
              <p className="text-xs" style={{ color: 'rgba(200,255,200,0.35)' }}>¿Tienes un código de acceso?</p>
              <div className="flex gap-2">
                <input
                  value={manualCode}
                  onChange={e => setManualCode(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && submitCode()}
                  placeholder="XXXX-WORD-000"
                  maxLength={20}
                  className="flex-1 px-3 py-2.5 rounded-xl text-sm font-mono text-center outline-none"
                  style={{
                    background: 'rgba(0,30,8,0.9)',
                    border: '1px solid rgba(0,255,100,0.2)',
                    color: 'rgba(200,255,200,0.9)',
                  }}
                />
                <button
                  onClick={submitCode}
                  disabled={submittingCode}
                  className="px-4 rounded-xl text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-50"
                  style={{ background: 'rgba(0,180,60,0.2)', border: '1px solid rgba(0,255,100,0.2)', color: 'rgba(0,255,100,0.9)' }}
                >
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
            <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center border"
              style={{ borderColor: 'rgba(255,180,0,0.4)', background: 'rgba(40,20,0,0.5)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,180,0,0.9)" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'rgba(255,180,0,0.5)' }}>ACCESO EXPIRADO</p>
            <p className="text-sm" style={{ color: 'rgba(255,220,150,0.7)' }}>
              Este enlace de acceso ya venció. Solicita uno nuevo al comercio.
            </p>
          </div>
        )}

        {/* ── Marca de agua inferior ── */}
        <div className="absolute bottom-6 left-0 right-0 text-center">
          <p className="text-[9px] tracking-[0.25em] uppercase" style={{ color: 'rgba(0,255,100,0.12)' }}>
            DAIMUZ HIDDEN LAYER™
          </p>
        </div>
      </div>
    </>
  )
}

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}
