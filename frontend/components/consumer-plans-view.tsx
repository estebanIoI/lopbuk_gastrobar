'use client'

/**
 * consumer-plans-view.tsx — Pestaña "Planes" del panel del consumidor (G4).
 * Estado del plan (Free / LEGEND) + contador regresivo en vivo + canje de código
 * + beneficios. El reveal animado + theme engine completo es G5; aquí queda la
 * base funcional (canje, /me, countdown) y un estado LEGEND premium.
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import { Crown, Loader2, Check, Ticket, Sparkles, Brain, Palette, Star, Tag, Boxes, Lock, Flame, Trophy } from 'lucide-react'
import { api } from '@/lib/api'
import LegendBadge from '@/components/legend-badge'
import { refreshEntitlements } from '@/components/consumer/hooks/useEntitlements'

interface TierState {
  tier: string
  status: string
  startedAt: string | null
  expiresAt: string | null
  remainingSeconds: number
  isExpired: boolean
  entitlements: string[]
  powerDays: number
  milestones: string[]
}

const MILESTONES = [
  { key: 'constante', label: 'Constante', days: 30 },
  { key: 'elite', label: 'Elite', days: 90 },
  { key: 'glow', label: 'Glow', days: 180 },
  { key: 'founder', label: 'Founder Legend', days: 365 },
]

const BENEFITS: { key: string; label: string; icon: any }[] = [
  { key: 'routine_ai', label: 'IA avanzada de rutinas', icon: Brain },
  { key: 'premium_theme', label: 'Tema exclusivo LEGEND', icon: Palette },
  { key: 'coach_priority', label: 'Prioridad con entrenadores', icon: Star },
  { key: 'discounts', label: 'Descuentos en combos', icon: Tag },
  { key: 'smart_combos', label: 'Combos inteligentes', icon: Boxes },
  { key: 'content_vault', label: 'Contenido exclusivo', icon: Sparkles },
]

function fmtRemaining(total: number): string {
  if (total <= 0) return '0s'
  const d = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = Math.floor(total % 60)
  if (d > 0) return `${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
  return `${m}m ${String(s).padStart(2, '0')}s`
}

export default function PlanesView({ onUpgrade }: { onUpgrade?: (state: TierState) => void }) {
  const [state, setState] = useState<TierState | null>(null)
  const [loading, setLoading] = useState(true)
  const [code, setCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [now, setNow] = useState(Date.now())
  const tick = useRef<ReturnType<typeof setInterval> | null>(null)
  const [pricing, setPricing] = useState<any[]>([])
  const [buyingPlan, setBuyingPlan] = useState<string | null>(null)

  useEffect(() => { api.getLegendPricing().then(r => { if (r.success) setPricing(r.data || []) }).catch(() => {}) }, [])
  const buyLegend = async (plan: string) => {
    if (buyingPlan) return
    setBuyingPlan(plan)
    const r = await api.createLegendCheckout(plan)
    if (r.success && r.data?.checkoutUrl) { window.location.href = r.data.checkoutUrl; return }
    setBuyingPlan(null)
  }

  const fetchPlan = useCallback(async () => {
    setLoading(true)
    try { const r = await api.getMyPlan(); if (r.success) setState(r.data) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchPlan() }, [fetchPlan])

  // Contador en vivo (solo corre si hay plan activo).
  useEffect(() => {
    if (tick.current) clearInterval(tick.current)
    if (state && !state.isExpired) { tick.current = setInterval(() => setNow(Date.now()), 1000) }
    return () => { if (tick.current) clearInterval(tick.current) }
  }, [state])

  const isLegend = !!state && !state.isExpired && state.tier === 'legend'
  const expiresMs = state?.expiresAt ? new Date(state.expiresAt).getTime() : 0
  const remaining = isLegend ? Math.max(0, Math.floor((expiresMs - now) / 1000)) : 0
  const topMilestone = isLegend && state!.milestones.length ? state!.milestones[state!.milestones.length - 1] : undefined
  const nextMilestone = isLegend ? MILESTONES.find(m => !state!.milestones.includes(m.key)) : undefined

  const redeem = async () => {
    if (!code.trim() || redeeming) return
    setRedeeming(true); setError(''); setSuccess('')
    try {
      const r = await api.redeemPlanCode(code.trim().toUpperCase())
      if (r.success) {
        setState(r.data)
        setCode('')
        setSuccess('¡Código activado! Bienvenido a LEGEND.')
        refreshEntitlements()   // invalida el cache para que los gates se desbloqueen ya
        api.trackConsumerEvent('legend_redeemed').catch(() => {})
        onUpgrade?.(r.data)
      } else {
        setError(r.error || 'No se pudo activar el código')
      }
    } catch (e: any) {
      setError(e?.message || 'No se pudo activar el código')
    } finally { setRedeeming(false) }
  }

  if (loading) return <div className="flex justify-center py-12 text-neutral-300"><Loader2 className="w-7 h-7 animate-spin" /></div>

  return (
    <div className="px-4 py-5 space-y-4">
      {/* Estado del plan */}
      {isLegend ? (
        <div className="rounded-2xl p-5 text-white shadow-lg" style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2410 60%, #3a2f0a 100%)', border: '1px solid rgba(212,175,55,0.4)' }}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-lg font-extrabold tracking-wide flex items-center gap-2" style={{ color: '#D4AF37' }}>
              <Crown className="w-6 h-6" /> LEGEND ACTIVE
            </span>
            <LegendBadge level={topMilestone} glow={state!.milestones.includes('glow') || state!.milestones.includes('founder')} />
          </div>
          <p className="mt-3 text-3xl font-black tabular-nums">{fmtRemaining(remaining)}</p>
          <p className="text-xs text-white/50 mt-1">restantes de tu acceso premium</p>
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-white/[0.06] px-3 py-2">
            <Flame className="w-4 h-4" style={{ color: '#D4AF37' }} />
            <span className="text-sm font-bold">{state!.powerDays}</span>
            <span className="text-xs text-white/60">días de poder seguidos</span>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl p-5 bg-white border border-black/10">
          <div className="flex items-center gap-2 text-neutral-700">
            <Crown className="w-5 h-5 text-neutral-300" />
            <span className="font-bold">Plan Free</span>
          </div>
          <p className="text-sm text-neutral-500 mt-1">Activa un código LEGEND para desbloquear todos los beneficios.</p>
        </div>
      )}

      {/* Canje de código */}
      <div className="rounded-2xl p-4 bg-white border border-black/10">
        <p className="text-sm font-semibold text-neutral-800 mb-2 flex items-center gap-1.5"><Ticket className="w-4 h-4" /> Código de descuento</p>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={e => { setCode(e.target.value.toUpperCase()); setError('') }}
            onKeyDown={e => { if (e.key === 'Enter') redeem() }}
            placeholder="LEGEND-XXXX"
            className="flex-1 min-w-0 rounded-lg border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400"
          />
          <button onClick={redeem} disabled={redeeming || !code.trim()} className="px-4 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: '#D4AF37' }}>
            {redeeming ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Activar'}
          </button>
        </div>
        {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
        {success && <p className="text-xs text-green-600 mt-1.5 flex items-center gap-1"><Check className="w-3.5 h-3.5" />{success}</p>}
      </div>

      {/* Pricing self-serve (solo si NO es LEGEND) */}
      {!isLegend && pricing.length > 0 && (
        <div className="rounded-2xl p-4 bg-white border border-black/10">
          <p className="text-sm font-semibold text-neutral-800 mb-1 flex items-center gap-1.5"><Crown className="w-4 h-4" style={{ color: '#D4AF37' }} /> Hazte LEGEND</p>
          <p className="text-xs text-neutral-500 mb-3">Paga en línea y desbloquea todo al instante.</p>
          <div className="grid grid-cols-3 gap-2">
            {pricing.map((p: any) => {
              const popular = p.badge === 'Más popular'
              return (
                <button key={p.key} onClick={() => buyLegend(p.key)} disabled={!!buyingPlan}
                  className={`relative rounded-xl border p-3 text-center transition-all disabled:opacity-60 ${popular ? 'border-amber-400 bg-amber-50' : 'border-neutral-200 bg-neutral-50 hover:border-neutral-300'}`}>
                  {p.badge && <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[8px] font-bold uppercase tracking-wide text-white rounded-full px-2 py-0.5" style={{ backgroundColor: popular ? '#D4AF37' : '#9ca3af' }}>{p.badge}</span>}
                  <p className="text-[11px] font-bold text-neutral-700 mt-1">{p.label}</p>
                  <p className="text-base font-extrabold text-neutral-900 mt-1">{buyingPlan === p.key ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : `$${(p.priceCop / 1000).toLocaleString('es-CO')}k`}</p>
                  <p className="text-[9px] text-neutral-400">${(p.perMonthCop / 1000).toFixed(0)}k/mes</p>
                </button>
              )
            })}
          </div>
          <p className="text-[10px] text-neutral-400 text-center mt-2">Pago seguro con Wompi · se activa automáticamente</p>
        </div>
      )}

      {/* Milestones / días de poder */}
      {isLegend && (
        <div className="rounded-2xl p-4 bg-white border border-black/10">
          <p className="text-sm font-semibold text-neutral-800 mb-3 flex items-center gap-1.5"><Trophy className="w-4 h-4 text-amber-500" /> Logros de continuidad</p>
          <div className="grid grid-cols-4 gap-2">
            {MILESTONES.map(m => {
              const done = state!.milestones.includes(m.key)
              return (
                <div key={m.key} className={`rounded-xl border p-2 text-center ${done ? 'border-amber-300 bg-amber-50' : 'border-neutral-200 bg-neutral-50'}`}>
                  <Crown className={`w-5 h-5 mx-auto ${done ? 'text-amber-500' : 'text-neutral-300'}`} />
                  <p className={`text-[10px] font-bold mt-1 ${done ? 'text-amber-700' : 'text-neutral-400'}`}>{m.label}</p>
                  <p className="text-[9px] text-neutral-400">{m.days}d</p>
                </div>
              )
            })}
          </div>
          {nextMilestone && (
            <p className="text-[11px] text-neutral-500 mt-2.5 text-center">
              Te faltan <span className="font-bold text-amber-600">{nextMilestone.days - state!.powerDays} días</span> para <span className="font-semibold">{nextMilestone.label}</span>.
            </p>
          )}
        </div>
      )}

      {/* Beneficios */}
      <div className="rounded-2xl p-4 bg-white border border-black/10">
        <p className="text-sm font-semibold text-neutral-800 mb-3">Beneficios LEGEND</p>
        <div className="space-y-2.5">
          {BENEFITS.map(({ key, label, icon: Icon }) => {
            const on = isLegend && state!.entitlements.includes(key)
            return (
              <div key={key} className="flex items-center gap-3">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${on ? 'text-white' : 'bg-neutral-100 text-neutral-300'}`} style={on ? { backgroundColor: '#D4AF37' } : undefined}>
                  {on ? <Icon className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />}
                </span>
                <span className={`text-sm ${on ? 'text-neutral-800 font-medium' : 'text-neutral-400'}`}>{label}</span>
                {on && <Check className="w-4 h-4 text-green-500 ml-auto" />}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
