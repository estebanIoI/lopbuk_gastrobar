'use client'

/**
 * auth-form.tsx — Login premium cinematográfico (solo inicio de sesión).
 *
 * Filosofía visual:
 * - Desktop: card alineada a la derecha, el fondo respira a la izquierda.
 * - Mobile: centrada full-width, mejor contraste para legibilidad.
 * - Glass card: rgba(10,10,10,.62) + backdrop-blur(18px).
 * - Capas de fondo: imagen → overlay → vignette → noise → luz radial.
 * - Botón de Google personalizado (botón oscuro propio + widget transparente
 *   encima que captura el click y conserva el flujo seguro de ID-token).
 */
import { useState, useEffect, useRef } from 'react'
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google'
import { BRAND } from '@/lib/brand'
import { useAuthStore } from '@/lib/auth-store'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { AboutModal } from '@/components/about-modal'
import { DataPolicyModal } from '@/components/data-policy-modal'
import { ContactModal } from '@/components/contact-modal'

// ── Noise SVG (muy sutil, da textura premium) ──
const NOISE_SVG = `data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E`

// Logo "G" de Google (oficial multicolor) para el botón custom.
function GoogleG({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  )
}

export function AuthForm({ onGoBack }: { onGoBack?: () => void } = {}) {
  const { login, googleLogin } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [loginBgUrl, setLoginBgUrl] = useState('')
  const googleBtnRef = useRef<HTMLDivElement>(null)
  const [googleBtnWidth, setGoogleBtnWidth] = useState(360)
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null)
  const [lockUntil, setLockUntil] = useState<number | null>(null)
  const [lockRemaining, setLockRemaining] = useState(0)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

  // ── Mouse tracking para parallax (solo desktop tiene mouse) ──
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      setMousePos({
        x: (e.clientX / window.innerWidth - 0.5) * 2,
        y: (e.clientY / window.innerHeight - 0.5) * 2,
      })
    }
    window.addEventListener('mousemove', handleMouse, { passive: true })
    return () => window.removeEventListener('mousemove', handleMouse)
  }, [])

  // ── Card entrance animation ──
  const [mounted, setMounted] = useState(false)
  useEffect(() => { requestAnimationFrame(() => setMounted(true)) }, [])

  // ── Ancho del botón de Google (se ajusta al contenedor) ──
  useEffect(() => {
    const el = googleBtnRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const w = Math.floor(entries[0].contentRect.width)
      if (w > 0) setGoogleBtnWidth(Math.min(w, 400))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── Restore lock state from localStorage ──
  useEffect(() => {
    try {
      const stored = localStorage.getItem('login_lock')
      if (stored) {
        const { until, attempts } = JSON.parse(stored)
        if (until && Date.now() < until) {
          setLockUntil(until)
          setLockRemaining(Math.ceil((until - Date.now()) / 1000))
          setAttemptsLeft(0)
        } else if (attempts) {
          setAttemptsLeft(attempts >= 3 ? 6 - attempts : null)
          if (!until) localStorage.setItem('login_lock', JSON.stringify({ until: null, attempts }))
        } else {
          localStorage.removeItem('login_lock')
        }
      }
    } catch { localStorage.removeItem('login_lock') }
  }, [])

  // ── Countdown while locked ──
  useEffect(() => {
    if (!lockUntil) return
    const interval = setInterval(() => {
      const remaining = lockUntil - Date.now()
      if (remaining <= 0) {
        setLockUntil(null)
        setLockRemaining(0)
        setAttemptsLeft(null)
        localStorage.removeItem('login_lock')
        clearInterval(interval)
      } else {
        setLockRemaining(Math.ceil(remaining / 1000))
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [lockUntil])

  // ── Fetch login background image ──
  useEffect(() => {
    fetch(`${API_URL.replace('/api', '')}/api/storefront/platform-settings`)
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        const url = json?.data?.login_image_url
        if (url) setLoginBgUrl(url)
      })
      .catch(() => {})
  }, [API_URL])

  const formatLockTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}s`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (lockUntil) return
    setLoading(true)
    try {
      const result = await login(email, password)
      if (!result.success) {
        if (result.lockedUntil) {
          setLockUntil(result.lockedUntil)
          setLockRemaining(Math.ceil((result.lockedUntil - Date.now()) / 1000))
          setAttemptsLeft(0)
          localStorage.setItem('login_lock', JSON.stringify({ until: result.lockedUntil, attempts: 6 }))
        } else if (result.attemptsLeft !== undefined && result.attemptsLeft !== null) {
          setAttemptsLeft(result.attemptsLeft)
          localStorage.setItem('login_lock', JSON.stringify({ until: null, attempts: 6 - result.attemptsLeft }))
        }
        setError(result.error || 'Error al iniciar sesión')
      } else {
        setAttemptsLeft(null)
        setLockUntil(null)
        localStorage.removeItem('login_lock')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSuccess = async (response: CredentialResponse) => {
    if (!response.credential) {
      setError('No se recibió respuesta de Google')
      return
    }
    setGoogleLoading(true)
    setError('')
    try {
      const result = await googleLogin(response.credential)
      if (!result.success) {
        setError(result.error || 'Error al iniciar sesión con Google')
      }
    } catch {
      setError('Error de conexión con Google')
    } finally {
      setGoogleLoading(false)
    }
  }

  const pX = mousePos.x * -8
  const pY = mousePos.y * -8
  const lightX = mousePos.x * 20
  const lightY = mousePos.y * 20

  const canSubmit = !loading && !googleLoading && !lockUntil
  const inputBase = 'w-full h-[52px] pl-11 pr-4 rounded-xl bg-white/[0.04] border border-white/[0.09] text-white placeholder-white/30 text-sm font-light outline-none transition-all duration-200 focus:bg-white/[0.06] focus:border-white/25'
  const labelBase = 'text-[10px] uppercase tracking-[0.22em] text-white/45 font-light'

  return (
    <div className="relative min-h-screen overflow-hidden bg-black">
      {/* ═══════════════ CAPAS DE FONDO ═══════════════ */}

      {/* Layer 1: Imagen con parallax */}
      {loginBgUrl && (
        <div
          className="absolute inset-0 transition-transform duration-[2000ms] ease-out will-change-transform"
          style={{ transform: `translate(${pX}px, ${pY}px) scale(1.04)` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={loginBgUrl}
            alt=""
            className="w-full h-full object-cover opacity-40"
            onError={(e) => { (e.target as HTMLElement).style.display = 'none' }}
          />
        </div>
      )}

      {/* Layer 2: Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/60 to-black/75" />

      {/* Layer 3: Cinematic vignette */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 35% 45%, transparent 28%, rgba(0,0,0,0.7) 75%)' }}
      />

      {/* Layer 4: Noise texture */}
      <div
        className="absolute inset-0 opacity-[0.018]"
        style={{ backgroundImage: `url("${NOISE_SVG}")`, backgroundRepeat: 'repeat' }}
      />

      {/* Layer 5: Radial light source (sigue al mouse) */}
      <div
        className="absolute w-[700px] h-[700px] rounded-full bg-white/[0.025] blur-[160px] pointer-events-none will-change-transform"
        style={{
          top: `calc(30% + ${lightY}px)`,
          right: `calc(10% - ${lightX}px)`,
          transform: 'translate(30%, -30%)',
        }}
      />

      {/* ═══════════════ CONTENEDOR PRINCIPAL ═══════════════ */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 sm:px-6 lg:justify-end lg:pr-[clamp(4rem,8vw,12rem)] lg:pl-12">
        {/* Back button (solo si el contexto lo provee, p.ej. desde la landing) */}
        {onGoBack && (
          <button
            onClick={onGoBack}
            className="absolute top-6 left-6 z-20 text-white/40 hover:text-white/80 transition-colors text-xs uppercase tracking-[0.2em] font-light"
          >
            ← Volver
          </button>
        )}

        {/* ═══════════════ GLASS AUTH CARD ═══════════════ */}
        <div
          className={`w-full max-w-[420px] transition-all duration-700 ease-out ${mounted ? 'opacity-100 translate-y-0 blur-0' : 'opacity-0 translate-y-4 blur-[6px]'}`}
        >
          <div
            className="rounded-[28px] p-7 sm:p-10 border border-white/[0.08] backdrop-blur-[18px] shadow-[0_12px_50px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)]"
            style={{ background: 'rgba(10,10,10,0.66)' }}
          >
            <div className="space-y-7">
              {/* ── Logo ── */}
              <div className="flex flex-col items-center gap-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={BRAND.isotipo}
                  alt={BRAND.name}
                  width={48}
                  height={48}
                  className="rounded-xl object-contain bg-white/90 p-1.5"
                />
                <span className="text-[10px] font-light text-white/55 tracking-[0.35em] uppercase">
                  {BRAND.name}
                </span>
              </div>

              {/* ── Heading ── */}
              <div className="space-y-1.5 text-center">
                <h2 className="text-[23px] font-light text-white tracking-tight">
                  Bienvenido de vuelta
                </h2>
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/40 font-light">
                  Ingresa para continuar
                </p>
              </div>

              {/* ── Google (botón custom oscuro + widget transparente encima) ── */}
              {!lockUntil && (
                <div className="relative w-full select-none" ref={googleBtnRef}>
                  {/* Botón visual integrado al tema oscuro */}
                  <div
                    className={`flex items-center justify-center gap-3 h-[52px] w-full rounded-xl border border-white/15 bg-white/[0.05] text-white text-sm font-light transition-colors ${googleLoading ? 'opacity-60' : 'hover:bg-white/[0.09]'}`}
                  >
                    {googleLoading ? (
                      <>
                        <span className="w-4 h-4 border border-white/20 border-t-white/60 rounded-full animate-spin" />
                        Conectando con Google…
                      </>
                    ) : (
                      <>
                        <GoogleG />
                        Continuar con Google
                      </>
                    )}
                  </div>
                  {/* Widget real de Google (ID-token), transparente, captura el click */}
                  {!googleLoading && (
                    <div className="absolute inset-0 z-10 opacity-0 [color-scheme:light] flex items-center justify-center overflow-hidden">
                      <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={() => setError('Error al conectar con Google')}
                        theme="filled_black"
                        size="large"
                        width={googleBtnWidth}
                        text="continue_with"
                        shape="pill"
                        logo_alignment="center"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* ── Divider ── */}
              {!lockUntil && (
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-white/[0.08]" />
                  <span className="text-[9px] uppercase tracking-[0.3em] text-white/30 font-light">
                    o con correo
                  </span>
                  <div className="flex-1 h-px bg-white/[0.08]" />
                </div>
              )}

              {/* ── Form ── */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email */}
                <div className="space-y-1.5">
                  <label htmlFor="email" className={labelBase}>Correo electrónico</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30 pointer-events-none" />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      placeholder="correo@ejemplo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputBase}
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label htmlFor="password" className={labelBase}>Contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30 pointer-events-none" />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${inputBase} pr-11`}
                      required
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* ── Avisos compactos ── */}

                {/* Lockout pill */}
                {lockUntil && lockRemaining > 0 && (
                  <div className="flex items-center gap-2 rounded-full bg-red-500/12 border border-red-500/20 px-4 py-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                    <p className="text-xs text-red-300 font-light">
                      Bloqueado · {formatLockTime(lockRemaining)}
                    </p>
                  </div>
                )}

                {/* Attempts warning pill */}
                {!lockUntil && attemptsLeft !== null && attemptsLeft > 0 && (
                  <div className="flex items-center gap-2 rounded-full bg-amber-500/10 border border-amber-500/20 px-4 py-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                    <p className="text-xs text-amber-300/90 font-light">
                      {attemptsLeft} intento{attemptsLeft !== 1 ? 's' : ''} restante{attemptsLeft !== 1 ? 's' : ''}
                    </p>
                  </div>
                )}

                {/* Error pills */}
                {error && !lockUntil && (
                  error.includes('desactivada') || error.includes('suspendido') ? (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3">
                      <p className="text-xs text-amber-300/90 font-light">{error}</p>
                      <p className="text-[10px] text-white/30 mt-1.5">Si crees que es un error, contacta a soporte.</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-full bg-red-500/10 border border-red-500/20 px-4 py-2.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                      <p className="text-xs text-red-300/90 font-light">{error}</p>
                    </div>
                  )
                )}

                {/* ── Submit button (Apple-style) ── */}
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full h-[52px] rounded-xl bg-[#f5f5f5] text-[#111] text-xs uppercase tracking-[0.2em] font-medium hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 hover:-translate-y-px flex items-center justify-center gap-2.5"
                >
                  {loading ? (
                    <><span className="w-3.5 h-3.5 border border-black/15 border-t-black/50 rounded-full animate-spin" /> Verificando...</>
                  ) : 'Iniciar sesión'}
                </button>
              </form>

              {/* ── Footer ── */}
              <div className="pt-4 border-t border-white/[0.07] space-y-3">
                <p className="text-[10px] leading-relaxed text-center text-white/30 font-light">
                  Al continuar aceptas los Términos de Servicio y la Política de Datos de{' '}
                  <span className="text-white/45">DAIMUZ</span>.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
                  <AboutModal />
                  <span className="text-white/15 hidden sm:inline">·</span>
                  <DataPolicyModal />
                  <span className="text-white/15 hidden sm:inline">·</span>
                  <ContactModal />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
