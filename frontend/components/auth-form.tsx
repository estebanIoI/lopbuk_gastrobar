'use client'

import { useState, useEffect, useRef } from 'react'
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google'
import { useAuthStore } from '@/lib/auth-store'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Mail, Lock, User, AlertCircle, Eye, EyeOff, ArrowLeft, ShieldX, Phone, Timer,
  Code2, Smartphone, Globe, FileSpreadsheet, Megaphone, Wrench, Bot, MessageCircle, MousePointerClick, PartyPopper, Sparkles, ArrowRight,
  MapPin, Home, Building2, CreditCard,
} from 'lucide-react'
import { departamentosMunicipios } from '@/constants'
import { AboutModal } from '@/components/about-modal'
import { DataPolicyModal } from '@/components/data-policy-modal'
import { ContactModal } from '@/components/contact-modal'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

const services = [
  { icon: Code2, title: 'Desarrollo de Software', description: 'Aplicaciones web y de escritorio a medida', color: 'emerald' },
  { icon: Smartphone, title: 'Apps Móviles (APK)', description: 'Aplicaciones nativas para Android', color: 'blue' },
  { icon: Globe, title: 'Páginas Web', description: 'Sitios de conversión y landing pages', color: 'purple' },
  { icon: FileSpreadsheet, title: 'Plantillas Excel', description: 'Asesoría y plantillas personalizadas', color: 'teal' },
  { icon: Megaphone, title: 'Marketing Digital', description: 'Estrategias para hacer crecer tu negocio', color: 'amber' },
  { icon: Wrench, title: 'Mantenimiento & Instalación', description: 'Componentes, aplicativos y soporte técnico', color: 'rose' },
  { icon: Bot, title: 'Automatización con IA', description: 'Procesos inteligentes para tu empresa', color: 'cyan' },
  { icon: MessageCircle, title: 'Chatbots para Negocios', description: 'Atención automática en la era digital', color: 'green' },
  { icon: MousePointerClick, title: 'Landing de Ventas', description: 'Páginas de conversión y redirección a WhatsApp', color: 'orange' },
  { icon: PartyPopper, title: 'Tarjetas Digitales', description: 'Invitaciones digitales para tus eventos', color: 'pink' },
]

const colorMap: Record<string, { icon: string; bg: string; border: string }> = {
  emerald: { icon: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  blue: { icon: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  purple: { icon: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  teal: { icon: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/20' },
  amber: { icon: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  rose: { icon: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
  cyan: { icon: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  green: { icon: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
  orange: { icon: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  pink: { icon: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/20' },
}

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
  const [loginBgUrl, setLoginBgUrl] = useState('/image/giflogin.gif')
  const googleBtnRef = useRef<HTMLDivElement>(null)
  const [googleBtnWidth, setGoogleBtnWidth] = useState(380)
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null)
  const [lockUntil, setLockUntil] = useState<number | null>(null)
  const [lockRemaining, setLockRemaining] = useState(0)

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

  // Restore lock state from localStorage on mount
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

  // Countdown timer while locked
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

  useEffect(() => {
    fetch(`${API_URL.replace('/api', '')}/api/storefront/platform-settings`)
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        const url = json?.data?.login_image_url
        if (url) setLoginBgUrl(url)
      })
      .catch(() => {/* mantiene el gif por defecto */})
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
    return m > 0 ? `${m}:${s.toString().padStart(2, '0')} min` : `${s}s`
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
          // Sync server-side rate limit info
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
        // Client registration via register-client endpoint (global, no storeSlug)
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
            phone: formData.phone       || undefined,
            cedula: formData.cedula     || undefined,
            department: formData.department   || undefined,
            municipality: formData.municipality || undefined,
            address: formData.address   || undefined,
            neighborhood: formData.neighborhood || undefined,
          }),
        })
        const json = await res.json()
        if (json.success && json.data) {
          // Auto-login after registration
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
      setError('No se recibio respuesta de Google')
      return
    }
    setGoogleLoading(true)
    setError('')
    try {
      const result = await googleLogin(response.credential)
      if (!result.success) {
        setError(result.error || 'Error al iniciar sesion con Google')
      }
    } catch {
      setError('Error de conexion con Google')
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-[#0a0a0a]">

      {/* ═══ LEFT — Branding panel ═══ */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden">
        {/* Background image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={loginBgUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-black/90 via-black/75 to-black/60" />

        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full overflow-y-auto">
          {/* Logo */}
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/image/lopbukicon.png" alt="Lopbuk" width={40} height={40} className="rounded-lg" />
            <span className="text-lg font-light tracking-[0.15em] uppercase">Lopbuk</span>
          </div>

          {/* Hero copy */}
          <div className="space-y-8 my-10">
            <div className="space-y-3">
              <p className="text-[10px] uppercase tracking-[0.4em] text-white/30 font-light">Plataforma integral</p>
              <h1 className="text-4xl font-extralight leading-tight tracking-tight">
                Gestión de<br />
                <span className="font-light text-white/70">inventario & ventas</span>
              </h1>
              <p className="text-sm text-white/40 font-light max-w-sm leading-relaxed">
                Controla tu stock, gestiona ventas, domicilios y haz crecer tu negocio desde un solo lugar.
              </p>
            </div>

            {/* Services grid */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-[9px] uppercase tracking-[0.35em] text-white/25 font-light flex items-center gap-2">
                  <Sparkles className="w-3 h-3" /> DAIMUZ · Soluciones digitales
                </span>
                <div className="h-px flex-1 bg-white/10" />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {services.slice(0, 8).map((service) => (
                  <div
                    key={service.title}
                    className="flex items-center gap-2.5 px-3 py-2.5 border border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
                  >
                    <service.icon className="w-3 h-3 text-white/25 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-light text-white/60 leading-tight truncate">{service.title}</p>
                      <p className="text-[8px] text-white/25 leading-snug mt-0.5 truncate">{service.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              <a
                href="https://api.whatsapp.com/message/56AISNOZMVW5N1?autoload=1&app_absent=0"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 border border-white/15 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-[11px] uppercase tracking-[0.2em] font-light transition-all duration-300"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                Contáctanos por WhatsApp
                <ArrowRight className="w-3 h-3" />
              </a>
            </div>
          </div>

          <p className="text-[9px] text-white/20 font-light uppercase tracking-widest">
            © 2026 Lopbuk · DAIMUZ · Desarrollo, Asesoría & Innovación
          </p>
        </div>
      </div>

      {/* ═══ RIGHT — Form panel ═══ */}
      <div className="w-full lg:w-[48%] flex flex-col bg-[#0a0a0a] border-l border-white/[0.06]">

        {/* Top bar */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-white/[0.06]">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/image/lopbukicon.png" alt="Lopbuk" width={28} height={28} className="rounded-md" />
            <span className="text-sm font-light text-white/70 tracking-widest uppercase">Lopbuk</span>
          </div>
          <div className="hidden lg:block" />

          {onGoBack && (
            <button
              onClick={onGoBack}
              className="flex items-center gap-1.5 text-[11px] text-white/30 hover:text-white/70 transition-colors uppercase tracking-widest font-light"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Volver
            </button>
          )}
        </div>

        {/* Scrollable form area */}
        <div className="flex-1 overflow-y-auto flex items-start lg:items-center justify-center p-8 sm:p-12">
          <div className="w-full max-w-sm space-y-8">

            {/* Heading */}
            <div className="space-y-1.5">
              <h2 className="text-2xl font-light text-white tracking-tight">
                {isLogin ? 'Bienvenido de vuelta' : 'Crear cuenta'}
              </h2>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/30 font-light">
                {isLogin ? 'Ingresa tus credenciales para continuar' : 'Completa tus datos para registrarte'}
              </p>
            </div>

            {/* Google first */}
            {!lockUntil && (
              <div className="w-full flex justify-center">
                {googleLoading ? (
                  <div className="flex items-center gap-2 text-[11px] text-white/30 py-2 font-light">
                    <div className="w-3.5 h-3.5 border border-white/20 border-t-white/60 rounded-full animate-spin" />
                    Conectando con Google...
                  </div>
                ) : (
                  <div ref={googleBtnRef} className="w-full">
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

            {/* Divider */}
            {!lockUntil && (
              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-white/[0.08]" />
                <span className="text-[9px] uppercase tracking-[0.3em] text-white/20 font-light">o continúa con correo</span>
                <div className="flex-1 h-px bg-white/[0.08]" />
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-[9px] uppercase tracking-[0.25em] text-white/30 font-light">Nombre Completo</Label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Tu nombre"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="pl-10 h-11 bg-white/[0.04] border border-white/10 text-white placeholder-white/20 rounded-none focus:border-white/40 focus:ring-0 font-light text-sm"
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[9px] uppercase tracking-[0.25em] text-white/30 font-light">Correo Electrónico</Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" />
                <Input
                  id="email"
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="pl-10 h-11 bg-white/[0.04] border border-white/10 text-white placeholder-white/20 rounded-none focus:border-white/40 focus:ring-0 font-light text-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[9px] uppercase tracking-[0.25em] text-white/30 font-light">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pl-10 pr-10 h-11 bg-white/[0.04] border border-white/10 text-white placeholder-white/20 rounded-none focus:border-white/40 focus:ring-0 font-light text-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/60 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-medium">Teléfono <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="3001234567"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="pl-10 h-12 bg-secondary border-none rounded-xl"
                    />
                  </div>
                </div>

                {/* ── Dirección de domicilio ── */}
                <div className="space-y-3 pt-1">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-1.5 px-1">
                      <MapPin className="w-3.5 h-3.5" />
                      Dirección de domicilio
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  <p className="text-xs text-muted-foreground/70 text-center -mt-1">
                    Opcional — te permitirá recibir pedidos a domicilio
                  </p>

                  {/* Cédula */}
                  <div className="space-y-2">
                    <Label htmlFor="cedula" className="text-sm font-medium">Cédula <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="cedula"
                        type="text"
                        placeholder="1234567890"
                        value={formData.cedula}
                        onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
                        className="pl-10 h-12 bg-secondary border-none rounded-xl"
                      />
                    </div>
                  </div>

                  {/* Departamento */}
                  <div className="space-y-2">
                    <Label htmlFor="department" className="text-sm font-medium">Departamento <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
                      <select
                        id="department"
                        value={formData.department}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value, municipality: '' })}
                        className="w-full h-12 pl-10 pr-4 rounded-xl bg-secondary border-none text-sm text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">Selecciona departamento</option>
                        {Object.keys(departamentosMunicipios).sort().map(dep => (
                          <option key={dep} value={dep}>{dep}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Municipio */}
                  <div className="space-y-2">
                    <Label htmlFor="municipality" className="text-sm font-medium">Municipio <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
                      <select
                        id="municipality"
                        value={formData.municipality}
                        onChange={(e) => setFormData({ ...formData, municipality: e.target.value })}
                        disabled={!formData.department}
                        className="w-full h-12 pl-10 pr-4 rounded-xl bg-secondary border-none text-sm text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-40 disabled:cursor-not-allowed"
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

                  {/* Dirección */}
                  <div className="space-y-2">
                    <Label htmlFor="address" className="text-sm font-medium">Dirección <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                    <div className="relative">
                      <Home className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="address"
                        type="text"
                        placeholder="Calle 10 #5-20"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className="pl-10 h-12 bg-secondary border-none rounded-xl"
                      />
                    </div>
                  </div>

                  {/* Barrio */}
                  <div className="space-y-2">
                    <Label htmlFor="neighborhood" className="text-sm font-medium">Barrio <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="neighborhood"
                        type="text"
                        placeholder="Nombre del barrio"
                        value={formData.neighborhood}
                        onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                        className="pl-10 h-12 bg-secondary border-none rounded-xl"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Locked out banner */}
            {lockUntil && lockRemaining > 0 && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-500/15">
                    <Timer className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-red-500">Acceso bloqueado temporalmente</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Demasiados intentos fallidos</p>
                  </div>
                </div>
                <p className="text-sm font-mono text-center text-red-600 dark:text-red-400 bg-red-500/10 rounded-lg py-2">
                  Intenta de nuevo en {formatLockTime(lockRemaining)}
                </p>
              </div>
            )}

            {/* Attempts warning */}
            {!lockUntil && attemptsLeft !== null && attemptsLeft > 0 && (
              <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                <p className="text-sm text-orange-600 dark:text-orange-400">
                  <span className="font-semibold">¡Atención!</span> Solo te quedan{' '}
                  <span className="font-bold">{attemptsLeft} intento{attemptsLeft !== 1 ? 's' : ''}</span>.
                  Después serás bloqueado por 15 minutos.
                </p>
              </div>
            )}

            {error && !lockUntil && (
              error.includes('desactivada') || error.includes('suspendido') ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-500/15">
                      <ShieldX className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-amber-500">Acceso restringido</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground/70 pl-[52px]">
                    Si crees que esto es un error, comunícate con soporte.
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )
            )}

            <button
              type="submit"
              disabled={loading || googleLoading || !!lockUntil}
              className="w-full h-11 bg-white text-black text-[11px] uppercase tracking-[0.3em] font-light hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
            >
              {loading
                ? <><span className="w-3.5 h-3.5 border border-black/20 border-t-black rounded-full animate-spin" /> Cargando...</>
                : isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
            </button>
          </form>

          {/* Footer links */}
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 pt-2 border-t border-white/[0.06]">
            <AboutModal />
            <span className="text-white/10 hidden sm:inline">|</span>
            <DataPolicyModal />
            <span className="text-white/10 hidden sm:inline">|</span>
            <ContactModal />
          </div>

          </div>
        </div>
      </div>
    </div>
  )
}
