'use client'

/**
 * auth-form.tsx — Experiencia de login premium cinematográfica.
 *
 * Filosofía visual:
 * - Desktop: card right-aligned, fondo respira a la izquierda
 * - Mobile: centrado full-width, overlay más oscuro
 * - Glass card: rgba(10,10,10,.62) + backdrop-blur(18px)
 * - Capas de fondo: imagen → overlay → vignette → noise → luz radial
 * - Parallax sutil al mover el mouse
 * - Entrada animada: blur(10px)→0 + translateY(12px)→0
 */
import { useState, useEffect, useRef } from 'react'
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google'
import { BRAND } from '@/lib/brand'
import { useAuthStore } from '@/lib/auth-store'
import {
  Mail, Lock, User, Eye, EyeOff, Phone,
  MapPin, Home, Building2, CreditCard,
} from 'lucide-react'
import { departamentosMunicipios } from '@/constants'
import { AboutModal } from '@/components/about-modal'
import { DataPolicyModal } from '@/components/data-policy-modal'
import { ContactModal } from '@/components/contact-modal'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

// ── Noise SVG (muy sutil, da textura premium) ──
const NOISE_SVG = `data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E`

interface AuthFormProps {
  onGoBack?: () => void
}

export function AuthForm({ onGoBack }: AuthFormProps) {
  const { login, googleLogin } = useAuthStore()
  const [isLogin, setIsLogin] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [loginBgUrl, setLoginBgUrl] = useState('')
  const googleBtnRef = useRef<HTMLDivElement>(null)
  const [googleBtnWidth, setGoogleBtnWidth] = useState(380)
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null)
  const [lockUntil, setLockUntil] = useState<number | null>(null)
  const [lockRemaining, setLockRemaining] = useState(0)

  // ── Mouse tracking para parallax ──
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

  // ── Google button width ──
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
  }, [])

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    cedula: '',
    department: '',
    municipality: '',
    address: '',
    neighborhood: '',
  })

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
      if (isLogin) {
        const result = await login(formData.email, formData.password)
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
      } else {
        if (!formData.name.trim()) {
          setError('El nombre es requerido')
          setLoading(false)
          return
        }
        const res = await fetch(`${API_URL}/auth/register-client`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            name: formData.name,
            phone: formData.phone || undefined,
            cedula: formData.cedula || undefined,
            department: formData.department || undefined,
            municipality: formData.municipality || undefined,
            address: formData.address || undefined,
            neighborhood: formData.neighborhood || undefined,
          }),
        })
        const json = await res.json()
        if (json.success && json.data) {
          const loginResult = await login(formData.email, formData.password)
          if (!loginResult.success) {
            setError(loginResult.error || 'Cuenta creada pero error al iniciar sesión. Intenta iniciar sesión manualmente.')
          }
        } else {
          setError(json.message || 'Error al registrarse')
        }
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
  const inputBase = 'w-full h-[52px] pl-10 pr-4 bg-white/[0.025] border border-white/[0.05] text-white placeholder-white/15 text-sm font-light outline-none transition-all duration-200 focus:bg-white/[0.04] focus:border-white/[0.14]'
  const labelBase = 'text-[10px] uppercase tracking-[0.22em] text-white/25 font-light'

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
            className="w-full h-full object-cover opacity-35"
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
        {/* Back button */}
        {onGoBack && (
          <button
            onClick={onGoBack}
            className="absolute top-6 left-6 z-20 text-white/30 hover:text-white/70 transition-colors text-xs uppercase tracking-[0.2em] font-light"
          >
            ← Volver
          </button>
        )}

        {/* ═══════════════ GLASS AUTH CARD ═══════════════ */}
        <div
          className={`w-full max-w-[430px] transition-all duration-700 ease-out ${mounted ? 'opacity-100 translate-y-0 blur-0' : 'opacity-0 translate-y-4 blur-[6px]'}`}
        >
          <div
            className="rounded-[28px] p-10 sm:p-[42px] border border-white/[0.06] backdrop-blur-[18px] shadow-[0_12px_50px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)] max-h-[94vh] overflow-y-auto"
            style={{ background: 'rgba(10,10,10,0.62)' }}
          >
            <div className="space-y-8">
              {/* ── Logo ── */}
              <div className="flex flex-col items-center gap-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={BRAND.isotipo}
                  alt={BRAND.name}
                  width={44}
                  height={44}
                  className="rounded-xl object-contain bg-white/90 p-1.5"
                />
                <span className="text-[10px] font-light text-white/40 tracking-[0.35em] uppercase">
                  {BRAND.name}
                </span>
              </div>

              {/* ── Heading ── */}
              <div className="space-y-1.5 text-center">
                <h2 className="text-[22px] font-light text-white tracking-tight">
                  {isLogin ? 'Bienvenido de vuelta' : 'Crear cuenta'}
                </h2>
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/20 font-light">
                  {isLogin ? 'Ingresa para continuar' : 'Regístrate en la plataforma'}
                </p>
              </div>

              {/* ── Google ── */}
              {!lockUntil && (
                <div className="w-full flex justify-center">
                  {googleLoading ? (
                    <div className="flex items-center gap-2.5 text-[11px] text-white/25 py-2 font-light">
                      <div className="w-3.5 h-3.5 border border-white/15 border-t-white/40 rounded-full animate-spin" />
                      Conectando con Google...
                    </div>
                  ) : (
                    <div ref={googleBtnRef} className="w-full opacity-80 hover:opacity-100 transition-opacity duration-300">
                      <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={() => setError('Error al conectar con Google')}
                        theme="filled_black"
                        size="large"
                        width={googleBtnWidth}
                        text={isLogin ? 'signin_with' : 'signup_with'}
                        shape="rectangular"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* ── Divider ── */}
              {!lockUntil && (
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-white/[0.06]" />
                  <span className="text-[9px] uppercase tracking-[0.3em] text-white/15 font-light">
                    o con correo
                  </span>
                  <div className="flex-1 h-px bg-white/[0.06]" />
                </div>
              )}

              {/* ── Form ── */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name (register only) */}
                {!isLogin && (
                  <div className="space-y-1.5">
                    <label htmlFor="name" className={labelBase}>Nombre completo</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/15 pointer-events-none" />
                      <input
                        id="name"
                        type="text"
                        placeholder="Tu nombre"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className={inputBase}
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Email */}
                <div className="space-y-1.5">
                  <label htmlFor="email" className={labelBase}>Correo electrónico</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/15 pointer-events-none" />
                    <input
                      id="email"
                      type="email"
                      placeholder="correo@ejemplo.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className={inputBase}
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label htmlFor="password" className={labelBase}>Contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/15 pointer-events-none" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className={`${inputBase} pr-11`}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/15 hover:text-white/40 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* ── Registration extra fields ── */}
                {!isLogin && (
                  <div className="space-y-4 pt-1">
                    {/* Phone */}
                    <div className="space-y-1.5">
                      <label htmlFor="phone" className={labelBase}>Teléfono <span className="text-white/10">— opcional</span></label>
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/15 pointer-events-none" />
                        <input
                          id="phone"
                          type="tel"
                          placeholder="3001234567"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className={inputBase}
                        />
                      </div>
                    </div>

                    {/* Address section divider */}
                    <div className="flex items-center gap-2 pt-1">
                      <div className="flex-1 h-px bg-white/[0.04]" />
                      <span className="text-[9px] uppercase tracking-[0.2em] text-white/15 font-light flex items-center gap-1.5">
                        <MapPin className="w-3 h-3" /> Dirección
                      </span>
                      <div className="flex-1 h-px bg-white/[0.04]" />
                    </div>

                    {/* Cédula */}
                    <div className="space-y-1.5">
                      <label htmlFor="cedula" className={labelBase}>Cédula <span className="text-white/10">— opcional</span></label>
                      <div className="relative">
                        <CreditCard className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/15 pointer-events-none" />
                        <input
                          id="cedula"
                          type="text"
                          placeholder="1234567890"
                          value={formData.cedula}
                          onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
                          className={inputBase}
                        />
                      </div>
                    </div>

                    {/* Department */}
                    <div className="space-y-1.5">
                      <label htmlFor="department" className={labelBase}>Departamento <span className="text-white/10">— opcional</span></label>
                      <div className="relative">
                        <Building2 className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/15 pointer-events-none z-10" />
                        <select
                          id="department"
                          value={formData.department}
                          onChange={(e) => setFormData({ ...formData, department: e.target.value, municipality: '' })}
                          className={`${inputBase} appearance-none`}
                        >
                          <option value="">Selecciona departamento</option>
                          {Object.keys(departamentosMunicipios).sort().map(dep => (
                            <option key={dep} value={dep}>{dep}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Municipality */}
                    <div className="space-y-1.5">
                      <label htmlFor="municipality" className={labelBase}>Municipio <span className="text-white/10">— opcional</span></label>
                      <div className="relative">
                        <MapPin className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/15 pointer-events-none z-10" />
                        <select
                          id="municipality"
                          value={formData.municipality}
                          onChange={(e) => setFormData({ ...formData, municipality: e.target.value })}
                          disabled={!formData.department}
                          className={`${inputBase} appearance-none disabled:opacity-20`}
                        >
                          <option value="">
                            {formData.department ? 'Selecciona municipio' : 'Primero selecciona departamento'}
                          </option>
                          {formData.department && departamentosMunicipios[formData.department]?.map(mun => (
                            <option key={mun} value={mun}>{mun}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Address */}
                    <div className="space-y-1.5">
                      <label htmlFor="address" className={labelBase}>Dirección <span className="text-white/10">— opcional</span></label>
                      <div className="relative">
                        <Home className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/15 pointer-events-none" />
                        <input
                          id="address"
                          type="text"
                          placeholder="Calle 10 #5-20"
                          value={formData.address}
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                          className={inputBase}
                        />
                      </div>
                    </div>

                    {/* Neighborhood */}
                    <div className="space-y-1.5">
                      <label htmlFor="neighborhood" className={labelBase}>Barrio <span className="text-white/10">— opcional</span></label>
                      <div className="relative">
                        <MapPin className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/15 pointer-events-none" />
                        <input
                          id="neighborhood"
                          type="text"
                          placeholder="Nombre del barrio"
                          value={formData.neighborhood}
                          onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                          className={inputBase}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Compact warnings ── */}

                {/* Lockout pill */}
                {lockUntil && lockRemaining > 0 && (
                  <div className="flex items-center gap-2 rounded-full bg-red-500/10 border border-red-500/15 px-4 py-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                    <p className="text-xs text-red-400 font-light">
                      Bloqueado · {formatLockTime(lockRemaining)}
                    </p>
                  </div>
                )}

                {/* Attempts warning pill */}
                {!lockUntil && attemptsLeft !== null && attemptsLeft > 0 && (
                  <div className="flex items-center gap-2 rounded-full bg-amber-500/8 border border-amber-500/12 px-4 py-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                    <p className="text-xs text-amber-400/80 font-light">
                      {attemptsLeft} intento{attemptsLeft !== 1 ? 's' : ''} restante{attemptsLeft !== 1 ? 's' : ''}
                    </p>
                  </div>
                )}

                {/* Error pills */}
                {error && !lockUntil && (
                  error.includes('desactivada') || error.includes('suspendido') ? (
                    <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] px-4 py-3">
                      <p className="text-xs text-amber-400/80 font-light">{error}</p>
                      <p className="text-[10px] text-white/15 mt-1.5">Si crees que es un error, contacta a soporte.</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-full bg-red-500/8 border border-red-500/12 px-4 py-2.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500/80 shrink-0" />
                      <p className="text-xs text-red-400/80 font-light">{error}</p>
                    </div>
                  )
                )}

                {/* ── Submit button (Apple-style) ── */}
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full h-[52px] bg-[#f5f5f5] text-[#111] text-xs uppercase tracking-[0.2em] font-medium hover:bg-white disabled:opacity-25 disabled:cursor-not-allowed transition-all duration-200 hover:-translate-y-px flex items-center justify-center gap-2.5"
                >
                  {loading ? (
                    <><span className="w-3.5 h-3.5 border border-black/15 border-t-black/50 rounded-full animate-spin" /> Verificando...</>
                  ) : isLogin ? 'Iniciar sesión' : 'Crear cuenta'}
                </button>
              </form>

              {/* ── Toggle login/register ── */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { setIsLogin(!isLogin); setError('') }}
                  className="text-[11px] text-white/25 hover:text-white/50 transition-colors font-light"
                >
                  {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
                </button>
              </div>

              {/* ── Footer ── */}
              <div className="pt-4 border-t border-white/[0.05] space-y-3">
                <p className="text-[10px] leading-relaxed text-center text-white/15 font-light">
                  Al continuar aceptas los Términos de Servicio y la Política de Datos de{' '}
                  <span className="text-white/25">DAIMUZ</span>.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
                  <AboutModal />
                  <span className="text-white/8 hidden sm:inline">·</span>
                  <DataPolicyModal />
                  <span className="text-white/8 hidden sm:inline">·</span>
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
