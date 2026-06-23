'use client'

/**
 * consumer-routine.tsx — Shell móvil del Consumer OS (rediseño premium).
 *
 * Filosofía mobile: 1 objetivo visible por bloque de scroll.
 * 3 capas: Priority (hero sin scroll) → Context (comidas/coach) → Meta (gamificación).
 *
 * Tabs reducidos a 4: Hoy · Plan · Coach · Más
 * "Más" abre un drawer con: Rutina, Cocina, Compras, Planes, Explore, Gym.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  X, Home, ChefHat, CalendarDays, ShoppingBasket, Plus, Trash2, Check, Clock,
  AlertTriangle, Sparkles, Loader2, Dumbbell, Flame, TrendingUp, Settings,
  Droplet, Target, Carrot, ListChecks, Utensils, Repeat, QrCode, ShieldCheck, ShieldX, ShieldAlert, Crown, Compass, Award, KeyRound,
  MoreHorizontal, ChevronDown, ChevronUp, ChevronRight, LogOut, Users,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/auth-store'
import PlanesView from '@/components/consumer-plans-view'
import LegendReveal from '@/components/legend-reveal'
import { useConsumerData, type ConsumerTab } from '@/components/consumer/hooks/useConsumerData'
import ExploreSection from '@/components/consumer/sections/explore/ExploreSection'
import CoachSection from '@/components/consumer/sections/CoachSection'
import VaultSection from '@/components/consumer/sections/VaultSection'
import CommunitySection from '@/components/consumer/sections/CommunitySection'
import AchievementShelf from '@/components/consumer/AchievementShelf'
import AdaptiveCards from '@/components/consumer/widgets/AdaptiveCards'
import MissionControl from '@/components/consumer/widgets/MissionControl'
import ProgressCard from '@/components/consumer/widgets/ProgressCard'
import CartButton from '@/components/consumer/widgets/CartButton'
import ActiveProgramBanner from '@/components/consumer/widgets/ActiveProgramBanner'
import { useEntitlements } from '@/components/consumer/hooks/useEntitlements'
import LegendShine from '@/components/consumer/widgets/LegendShine'

type Tab = ConsumerTab

const MEALS = [
  { key: 'desayuno', label: 'Desayuno' },
  { key: 'media_manana', label: 'Media mañana' },
  { key: 'almuerzo', label: 'Almuerzo' },
  { key: 'onces', label: 'Onces' },
  { key: 'cena', label: 'Cena' },
  { key: 'snack', label: 'Snack' },
]
const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const GOAL_LABEL: Record<string, string> = {
  bajar_peso: 'Bajar de peso', subir_masa: 'Subir masa', mantener: 'Mantener', salud_general: 'Salud general',
}

// ── 4 tabs principales (móvil) + "Más" = 5 ítems ──
const MAIN_TABS: { k: ConsumerTab; icon: any; label: string }[] = [
  { k: 'hoy', icon: Home, label: 'Hoy' },
  { k: 'rutina', icon: Repeat, label: 'Rutina' },
  { k: 'plan', icon: CalendarDays, label: 'Plan' },
  { k: 'comunidad', icon: Users, label: 'Comunidad' },
]

// ── Tabs overflow (dentro de "Más") ──
function getOverflowTabs(hasGym: boolean): { k: ConsumerTab; icon: any; label: string }[] {
  const base = [
    { k: 'coach' as ConsumerTab, icon: Award, label: 'Coach' },
    { k: 'cocina' as ConsumerTab, icon: ChefHat, label: 'Cocina' },
    { k: 'compras' as ConsumerTab, icon: ShoppingBasket, label: 'Compras' },
    { k: 'vault' as ConsumerTab, icon: KeyRound, label: 'The Vault' },
    { k: 'planes' as ConsumerTab, icon: Crown, label: 'Planes' },
    { k: 'explore' as ConsumerTab, icon: Compass, label: 'Explore' },
  ]
  if (hasGym) base.push({ k: 'gym' as ConsumerTab, icon: Dumbbell, label: 'Gym' })
  return base
}

export default function ConsumerRoutine({ onClose }: { onClose: () => void }) {
  const {
    tab, setTab, today, loading,
    assistantOn, hasGym, legend, setLegend, legendCfg, planState, streak, activeProgram,
    resumen, despensa, recetas, puedoHacer, rutinas, plan, compras, gym,
    load,
  } = useConsumerData('hoy')

  const [showPerfil, setShowPerfil] = useState(false)
  const [showAssistant, setShowAssistant] = useState(false)
  const [showReveal, setShowReveal] = useState(false)
  const [showMas, setShowMas] = useState(false)
  const [showMacros, setShowMacros] = useState(false)

  const overflowTabs = getOverflowTabs(hasGym)

  const handleOverflowSelect = (k: ConsumerTab) => {
    setShowMas(false)
    setTab(k)
  }

  const n = resumen?.nutricion
  const target = resumen?.perfil?.dailyCalorieTarget || 0
  const consumed = Number(n?.caloriasConsumidas || 0)
  const remaining = Math.max(0, target - consumed)
  const proteinPct = n?.proteinaPlan > 0 ? Math.round((Number(n?.proteinaConsumida || 0) / Number(n?.proteinaPlan)) * 100) : 0

  const isLegend = !!legend

  return (
    <div className="fixed inset-0 z-[80] bg-neutral-50 text-neutral-900 flex flex-col md:hidden">
      {/* ═══ COMPACT HERO HEADER ═══ */}
      <div
        className="relative overflow-hidden flex-shrink-0 text-white"
        style={isLegend ? { background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a0d 55%, #2a1a05 100%)' } : { background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)' }}
      >
        {isLegend && <LegendShine />}
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 pt-4 pb-1">
          <div className="flex items-center gap-2">
            {isLegend ? <Crown className="w-5 h-5" style={{ color: '#D4AF37' }} /> : <Sparkles className="w-5 h-5 text-white/70" />}
            <span className="text-sm font-semibold tracking-wide uppercase" style={isLegend ? { color: '#D4AF37' } : { color: 'rgba(255,255,255,0.8)' }}>
              {isLegend ? 'LEGEND' : 'Mi Rutina'}
            </span>
            {streak > 1 && (
              <span className="text-[11px] font-bold bg-white/15 rounded-full px-2 py-0.5">🔥 {streak}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {assistantOn && (
              <button onClick={() => setShowAssistant(true)} className="p-2 rounded-full hover:bg-white/10" title={isLegend ? 'AI Coach LEGEND' : 'Asistente IA'}>
                {isLegend ? <Crown className="w-4 h-4" style={{ color: '#D4AF37' }} /> : <Sparkles className="w-4 h-4" />}
              </button>
            )}
            <CartButton className="p-2 rounded-full hover:bg-white/10" />
            <button onClick={() => setTab('vault')} className="p-2 rounded-full hover:bg-white/10" title="The Vault">
              <KeyRound className="w-4 h-4" />
            </button>
            <button onClick={() => setShowPerfil(true)} className="p-2 rounded-full hover:bg-white/10" title="Mi perfil">
              <Settings className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Compact nutrition line (solo en tab Hoy) */}
        {tab === 'hoy' && (
          <button onClick={() => setShowMacros(!showMacros)} className="w-full px-4 py-3 flex items-center gap-3">
            <div className="flex-1 text-left">
              <div className="text-[26px] font-black tracking-tight">
                {target ? `${remaining}` : (n?.caloriasPlan || '—')}
                <span className="text-sm font-medium text-white/60 ml-1">{target ? 'kcal rest.' : 'kcal plan'}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-white/60 mt-0.5">
                {target > 0 && <span>{consumed}/{target} kcal</span>}
                {proteinPct > 0 && <span>· Proteína {proteinPct}%</span>}
                {showMacros ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </div>
            </div>
            {/* Mini ring */}
            <CompactRing value={consumed} max={target || 1} color="#fff" />
          </button>
        )}

        {/* Expandable macros */}
        {tab === 'hoy' && showMacros && (
          <div className="px-4 pb-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <MacroBar label="Proteína" value={n?.proteinaConsumida || 0} max={n?.proteinaPlan || 0} color="#34d399" />
            <MacroBar label="Carbos" value={n?.carbsConsumidos || 0} max={n?.carbsPlan || 0} color="#fbbf24" />
            <MacroBar label="Grasa" value={n?.grasaConsumida || 0} max={n?.grasaPlan || 0} color="#f472b6" />
          </div>
        )}
      </div>

      {/* ═══ CONTENT ═══ */}
      <div className="flex-1 overflow-y-auto pb-16">
        {loading && <div className="flex justify-center py-12 text-neutral-300"><Loader2 className="w-7 h-7 animate-spin" /></div>}

        {/* ── HOY (3-capas) ── */}
        {!loading && tab === 'hoy' && (
          <div className="pb-4">
            {/* Mission Control: ¿qué hago hoy? (activación) */}
            <MissionControl onGoTo={setTab} />

            {/* CAPA 1 — PRIORITY: programa activo del coach */}
            {activeProgram && (
              <div className="px-4 pt-3">
                <ActiveProgramBanner program={activeProgram} onOpen={() => setTab('coach')} />
              </div>
            )}

            {/* Adaptive nudges compactos */}
            <AdaptiveCards onGoTo={setTab} />

            {/* Progreso de transformación */}
            <ProgressCard />

            {/* CAPA 2 — CONTEXTO: Comidas + Día */}
            <HoyViewCompact resumen={resumen} plan={plan} rutinas={rutinas} onReload={() => load('hoy')} onGoTo={setTab} />

            {/* CAPA 3 — META/GAMIFICACIÓN: Nudges, streak, progreso */}
            {isLegend && (
              <div className="px-4 pt-1">
                <LegendStatusCard planState={planState} streak={streak} onGoTo={() => setTab('planes')} />
              </div>
            )}
          </div>
        )}

        {!loading && tab === 'rutina' && <RutinaView rutinas={rutinas} onReload={() => load('rutina')} />}
        {!loading && tab === 'cocina' && <CocinaView despensa={despensa} recetas={recetas} puedoHacer={puedoHacer} onReload={() => load('cocina')} />}
        {!loading && tab === 'plan' && <PlanView plan={plan} recetas={recetas} onReload={() => load('plan')} today={today} />}
        {!loading && tab === 'compras' && <ComprasView items={compras} onReload={() => load('compras')} />}
        {tab === 'planes' && <PlanesView onUpgrade={() => { setLegend(true); setShowReveal(true) }} />}
        {tab === 'explore' && <ExploreSection goal={resumen?.perfil?.goal} onFullStore={onClose} onGoPlanes={() => setTab('planes')} />}
        {tab === 'coach' && <CoachSection />}
        {tab === 'vault' && <VaultSection />}
        {tab === 'comunidad' && <div className="p-4"><CommunitySection /></div>}
        {!loading && tab === 'gym' && <GymView data={gym} onReload={() => load('gym')} />}
      </div>

      {/* ═══ TAB BAR (4 tabs) ═══ */}
      <div
        className="absolute bottom-0 left-0 right-0 h-16 border-t border-black/10 bg-white flex items-center shadow-[0_-2px_10px_rgba(0,0,0,0.04)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {MAIN_TABS.map(({ k, icon: Icon, label }) => (
          <button
            key={k}
            onClick={() => setTab(k as Tab)}
            className={`flex flex-col items-center gap-0.5 flex-1 h-full justify-center transition-colors ${
              tab === k ? (isLegend ? '' : 'text-neutral-900') : 'text-neutral-400'
            }`}
            style={tab === k && isLegend ? { color: '#D4AF37' } : undefined}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        ))}
        {/* Botón "Más" */}
        <button
          onClick={() => setShowMas(true)}
          className={`flex flex-col items-center gap-0.5 flex-1 h-full justify-center transition-colors ${
            showMas || overflowTabs.some(t => t.k === tab) ? (isLegend ? '' : 'text-neutral-900') : 'text-neutral-400'
          }`}
          style={showMas || overflowTabs.some(t => t.k === tab) && isLegend ? { color: '#D4AF37' } : undefined}
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="text-[10px] font-medium">Más</span>
        </button>
      </div>

      {/* ═══ MÁS DRAWER ═══ */}
      {showMas && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowMas(false)} />
          <div
            className="relative bg-white rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom duration-300"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
          >
            <div className="flex items-center justify-between px-5 h-14 border-b border-black/5">
              <h3 className="font-bold text-sm">Más</h3>
              <button onClick={() => setShowMas(false)} className="text-neutral-400 hover:text-neutral-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 grid grid-cols-3 gap-2">
              {overflowTabs.map(({ k, icon: Icon, label }) => (
                <button
                  key={k}
                  onClick={() => handleOverflowSelect(k)}
                  className="flex flex-col items-center gap-2 py-4 rounded-2xl hover:bg-neutral-50 transition-colors"
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    tab === k
                      ? isLegend ? 'bg-amber-100' : 'bg-neutral-900'
                      : 'bg-neutral-100'
                  }`}>
                    <Icon
                      className="w-5 h-5"
                      style={tab === k && isLegend ? { color: '#D4AF37' } : tab === k ? { color: '#fff' } : { color: '#737373' }}
                    />
                  </div>
                  <span className={`text-[11px] font-medium ${tab === k ? 'text-neutral-900' : 'text-neutral-500'}`}>
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODALES ═══ */}
      {showPerfil && <PerfilModal onClose={() => setShowPerfil(false)} onSaved={() => { setShowPerfil(false); load('hoy') }} />}
      {showAssistant && <ChatAssistant onClose={() => setShowAssistant(false)} onChanged={() => load(tab)} />}
      {showReveal && <LegendReveal config={legendCfg} onDone={() => setShowReveal(false)} />}
    </div>
  )
}

// ═══════════════════ COMPACT RING (hero) ═══════════════════
function CompactRing({ value, max, color = '#fff' }: { value: number; max: number; color?: string }) {
  const size = 44, stroke = 4
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = max > 0 ? Math.min(1, value / max) : 0
  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round" />
      </svg>
      <div className="absolute text-[10px] font-bold leading-none">{Math.round(pct * 100)}%</div>
    </div>
  )
}

// ═══════════════════ CTA STREAK ═══════════════════
function CTAStreak({ onGoTo }: { onGoTo: () => void }) {
  return (
    <button onClick={onGoTo} className="w-full rounded-xl px-4 py-3 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-200 text-left flex items-center justify-between">
      <div>
        <p className="text-sm font-bold text-amber-700">🔥 Retoma tu racha</p>
        <p className="text-xs text-amber-600/70">Registra tu actividad de hoy.</p>
      </div>
      <ChevronRight className="w-4 h-4 text-amber-500" />
    </button>
  )
}

// ═══════════════════ LEGEND STATUS CARD (compacto) ═══════════════════
function LegendStatusCard({ planState, streak, onGoTo }: { planState: any; streak: number; onGoTo: () => void }) {
  const powerDays = planState?.powerDays
  return (
    <button onClick={onGoTo} className="w-full rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a0a 100%)', border: '1px solid rgba(212,175,55,0.15)' }}>
      <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(212,175,55,0.15)' }}>
        <Crown className="w-4 h-4" style={{ color: '#D4AF37' }} />
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className="text-xs font-bold text-white/90">LEGEND Activo</p>
        {powerDays != null && <p className="text-[11px] text-white/50">{powerDays} días de poder{streak > 1 ? ` · Racha ${streak}` : ''}</p>}
        {powerDays == null && streak > 1 && <p className="text-[11px] text-white/50">{streak} días seguidos · Ver logros</p>}
        {powerDays == null && streak <= 1 && <p className="text-[11px] text-white/50">Mantén tu racha para desbloquear logros</p>}
      </div>
      <ChevronRight className="w-4 h-4 text-amber-500/50" />
    </button>
  )
}

// ═══════════════════ ASISTENTE IA (chat) ═══════════════════
function ChatAssistant({ onClose, onChanged }: any) {
  const { has: hasEnt } = useEntitlements()
  const advanced = hasEnt('routine_ai')
  const [msgs, setMsgs] = useState<any[]>([
    { role: 'assistant', content: '¡Hola! Soy tu asistente de bienestar. Cuéntame tu objetivo (bajar de peso, ganar músculo, salud…) y armo tu rutina y plan a tu medida. ¿Empezamos?' },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])
  useEffect(() => { if (advanced) api.trackConsumerEvent('ai_advanced_opened').catch(() => {}) }, [advanced])

  const send = async () => {
    const text = input.trim()
    if (!text || sending) return
    setInput(''); setSending(true)
    const history = msgs.map(m => ({ role: m.role, content: m.content }))
    setMsgs(m => [...m, { role: 'user', content: text }])
    const r = await api.assistantSend(text, history)
    setSending(false)
    if (r.success) {
      setMsgs(m => [...m, { role: 'assistant', content: r.data.reply, products: r.data.products, action: r.data.action }])
      if (r.data.action && r.data.action !== 'productos') onChanged?.()
    } else {
      setMsgs(m => [...m, { role: 'assistant', content: r.error || 'No pude procesar eso. Intenta de nuevo.' }])
    }
  }

  return (
    <div className="fixed inset-0 z-[95] bg-white flex flex-col">
      <div className="flex items-center justify-between px-4 h-14 border-b border-black/10 text-white flex-shrink-0"
        style={advanced ? { background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a0d 100%)' } : { background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)' }}>
        <div className="flex items-center gap-2">
          {advanced ? <Crown className="w-5 h-5" style={{ color: '#D4AF37' }} /> : <Sparkles className="w-5 h-5" />}
          <span className="font-semibold" style={advanced ? { color: '#D4AF37' } : undefined}>{advanced ? 'AI Coach LEGEND' : 'Asistente de bienestar'}</span>
        </div>
        <button onClick={onClose} className="p-2 -mr-2 hover:bg-white/20 rounded-full"><X className="w-5 h-5" /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-neutral-50">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${m.role === 'user' ? 'bg-neutral-900 text-white' : 'bg-white border border-black/5 shadow-sm'}`}>
              <div className="whitespace-pre-wrap">{m.content}</div>
              {m.products?.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {m.products.map((p: any) => (
                    <div key={p.id} className="flex items-center gap-2 bg-neutral-50 rounded-lg p-2 border border-black/5">
                      <div className="w-9 h-9 rounded-lg bg-neutral-200 overflow-hidden flex-shrink-0">
                        {p.imageUrl && <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate text-neutral-900">{p.name}</div>
                        <div className="text-[11px] text-neutral-500">${Number(p.salePrice).toLocaleString('es-CO')} · {p.tenantName}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {sending && <div className="flex justify-start"><div className="bg-white border border-black/5 rounded-2xl px-3.5 py-2.5"><Loader2 className="w-4 h-4 animate-spin text-neutral-600" /></div></div>}
        <div ref={endRef} />
      </div>

      <div className="p-3 border-t border-black/10 bg-white flex gap-2 flex-shrink-0" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Escribe tu mensaje…" className={inputCls} />
        <button onClick={send} disabled={sending} className="bg-neutral-900 text-white rounded-xl px-4 flex-shrink-0 disabled:opacity-50 font-medium text-sm">Enviar</button>
      </div>
    </div>
  )
}

// ═══════════════════ UI helpers ═══════════════════
function MacroBar({ label, value, max, color }: any) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-1 opacity-70"><span>{label}</span><span>{Math.round(value)}{max ? `/${Math.round(max)}` : ''}g</span></div>
      <div className="h-1 rounded-full bg-white/15 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} /></div>
    </div>
  )
}
function Section({ title, action, children }: any) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2"><h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wide">{title}</h3>{action}</div>
      {children}
    </div>
  )
}
function Empty({ icon: Icon, text }: any) {
  return <div className="text-center py-6 text-neutral-300"><Icon className="w-6 h-6 mx-auto mb-1.5 opacity-30" /><p className="text-xs">{text}</p></div>
}
function Card({ children, className = '' }: any) {
  return <div className={`rounded-xl bg-white border border-black/5 shadow-sm ${className}`}>{children}</div>
}
const inputCls = 'w-full bg-neutral-100 border border-transparent focus:border-neutral-400 focus:bg-white rounded-xl px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-neutral-400'

// ═══════════════════ HOY VIEW (compacta, 3-capas) ═══════════════════
function HoyViewCompact({ resumen, plan, rutinas, onReload, onGoTo }: any) {
  const dow = new Date().getDay()
  const todayActs = (rutinas || []).flatMap((r: any) =>
    (r.activities || []).filter((a: any) => a.dayOfWeek === null || a.dayOfWeek === dow).map((a: any) => ({ ...a, rutina: r.name }))
  ).sort((a: any, b: any) => (a.startTime || '').localeCompare(b.startTime || ''))

  // Solo mostrar comidas pendientes (más relevante)
  const pendingMeals = (plan || []).filter((m: any) => !m.isDone).slice(0, 3)
  const hasMore = (plan || []).length > pendingMeals.length || (plan || []).some((m: any) => m.isDone)

  return (
    <div className="px-4 space-y-4 pt-4">
      {/* CAPA 2: Comidas pendientes (lo más accionable) */}
      {pendingMeals.length > 0 && (
        <Section title="Comidas pendientes" action={
          <button onClick={() => onGoTo('plan')} className="text-[11px] text-neutral-900 font-medium">Ver plan</button>
        }>
          <div className="space-y-1.5">
            {pendingMeals.map((m: any) => (
              <button
                key={m.id}
                onClick={async () => { await api.togglePlanComida(m.id); onReload() }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white border border-black/5 shadow-sm text-left"
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 border-neutral-300`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{m.title || 'Comida'}</div>
                  <div className="text-[11px] text-neutral-400 capitalize">
                    {String(m.mealType).replace('_', ' ')}{m.calories ? ` · ${m.calories} kcal` : ''}
                  </div>
                </div>
              </button>
            ))}
            {hasMore && (
              <button onClick={() => onGoTo('plan')} className="w-full text-[11px] text-neutral-500 py-1 text-center">
                + {(plan || []).length - pendingMeals.length} más
              </button>
            )}
          </div>
        </Section>
      )}

      {/* CAPA 2: Actividades de hoy (compactas) */}
      <Section title="Tu día" action={
        <button onClick={() => onGoTo('rutina')} className="text-[11px] text-neutral-900 font-medium">Rutina</button>
      }>
        {todayActs.length > 0 ? (
          <div className="space-y-1.5">
            {todayActs.slice(0, 4).map((a: any) => (
              <div key={a.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white border border-black/5 shadow-sm">
                <div className="text-[11px] font-bold text-neutral-400 w-10 shrink-0">{a.startTime ? a.startTime.slice(0, 5) : '—'}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{a.title}</div>
                  <div className="text-[11px] text-neutral-400 capitalize">{a.type} · {a.rutina}</div>
                </div>
              </div>
            ))}
            {todayActs.length > 4 && (
              <button onClick={() => onGoTo('rutina')} className="w-full text-[11px] text-neutral-500 py-1 text-center">
                + {todayActs.length - 4} actividades más
              </button>
            )}
          </div>
        ) : (
          <Empty icon={ListChecks} text="Sin actividades para hoy. Crea tu rutina." />
        )}
      </Section>

      {/* CAPA 2: Coach insight (si hay coach) */}
      {resumen?.coachInsight && (
        <div className="rounded-xl bg-gradient-to-r from-sky-50 to-cyan-50 border border-sky-100 px-4 py-3">
          <p className="text-xs font-medium text-sky-800">{resumen.coachInsight}</p>
        </div>
      )}

      {/* Stat chips compactos (al final, secundarios) */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: Carrot, label: 'Despensa', value: resumen?.despensaCount ?? 0, color: 'text-emerald-600 bg-emerald-50' },
          { icon: AlertTriangle, label: 'Por vencer', value: resumen?.porVencerCount ?? 0, color: 'text-orange-600 bg-orange-50' },
          { icon: ShoppingBasket, label: 'Comprar', value: resumen?.comprasPendientes ?? 0, color: 'text-neutral-600 bg-neutral-100' },
        ].map(c => (
          <button
            key={c.label}
            onClick={() => onGoTo(c.label === 'Comprar' ? 'compras' : 'cocina')}
            className="rounded-xl bg-white border border-black/5 shadow-sm p-3 text-left flex items-center gap-2.5"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${c.color}`}>
              <c.icon className="w-4 h-4" />
            </div>
            <div>
              <div className="text-base font-bold">{c.value}</div>
              <div className="text-[10px] text-neutral-400">{c.label}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════ HOY VIEW ORIGINAL (mantenida para export) ═══════════════════
function HoyView({ resumen, plan, rutinas, onReload, onGoTo }: any) {
  const dow = new Date().getDay()
  const todayActs = (rutinas || []).flatMap((r: any) =>
    (r.activities || []).filter((a: any) => a.dayOfWeek === null || a.dayOfWeek === dow).map((a: any) => ({ ...a, rutina: r.name }))
  ).sort((a: any, b: any) => (a.startTime || '').localeCompare(b.startTime || ''))

  const chips = [
    { icon: Carrot, label: 'Despensa', value: resumen?.despensaCount ?? 0, color: 'text-emerald-600 bg-emerald-50' },
    { icon: AlertTriangle, label: 'Por vencer', value: resumen?.porVencerCount ?? 0, color: 'text-orange-600 bg-orange-50' },
    { icon: ShoppingBasket, label: 'Comprar', value: resumen?.comprasPendientes ?? 0, color: 'text-sky-600 bg-sky-50' },
  ]
  const water = resumen?.perfil?.waterTargetMl
  const weight = resumen?.perfil?.weightKg, tgt = resumen?.perfil?.targetWeightKg

  return (
    <div className="p-4 space-y-5">
      {(water || (weight && tgt) || resumen?.perfil?.goal) && (
        <div className="flex gap-2 flex-wrap">
          {resumen?.perfil?.goal && <span className="text-xs px-3 py-1.5 rounded-full bg-violet-50 text-violet-700 flex items-center gap-1"><Target className="w-3.5 h-3.5" />{GOAL_LABEL[resumen.perfil.goal] || resumen.perfil.goal}</span>}
          {water ? <span className="text-xs px-3 py-1.5 rounded-full bg-sky-50 text-sky-700 flex items-center gap-1"><Droplet className="w-3.5 h-3.5" />{water} ml/día</span> : null}
          {weight && tgt ? <span className="text-xs px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" />{weight}→{tgt} kg</span> : null}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {chips.map(c => (
          <button key={c.label} onClick={() => onGoTo(c.label === 'Comprar' ? 'compras' : 'cocina')} className="rounded-2xl bg-white border border-black/5 shadow-sm p-3 text-left">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${c.color}`}><c.icon className="w-4 h-4" /></div>
            <div className="text-xl font-bold mt-2">{c.value}</div>
            <div className="text-[10px] text-neutral-500">{c.label}</div>
          </button>
        ))}
      </div>

      <Section title="Comidas de hoy" action={<button onClick={() => onGoTo('plan')} className="text-xs text-orange-600 font-medium">Ver plan</button>}>
        {plan?.length ? (
          <div className="space-y-2">
            {plan.map((m: any) => (
              <Card key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                <button onClick={async () => { await api.togglePlanComida(m.id); onReload() }} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${m.isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-neutral-300'}`}>
                  {m.isDone && <Check className="w-3.5 h-3.5" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm truncate ${m.isDone ? 'line-through text-neutral-400' : 'font-medium'}`}>{m.title || 'Comida'}</div>
                  <div className="text-[11px] text-neutral-400 capitalize">{String(m.mealType).replace('_', ' ')}{m.calories ? ` · ${m.calories} kcal` : ''}</div>
                </div>
              </Card>
            ))}
          </div>
        ) : <Empty icon={Utensils} text="Sin comidas planeadas para hoy." />}
      </Section>

      <Section title="Tu día" action={<button onClick={() => onGoTo('rutina')} className="text-xs text-orange-600 font-medium">Editar rutina</button>}>
        {todayActs.length ? (
          <div className="space-y-2">
            {todayActs.map((a: any) => (
              <Card key={a.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="w-12 text-center flex-shrink-0">
                  <div className="text-xs font-bold text-orange-600">{a.startTime ? a.startTime.slice(0, 5) : '—'}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{a.title}</div>
                  <div className="text-[11px] text-neutral-400 capitalize">{a.type} · {a.rutina}</div>
                </div>
              </Card>
            ))}
          </div>
        ) : <Empty icon={ListChecks} text="No tienes actividades para hoy. Crea tu rutina." />}
      </Section>
    </div>
  )
}

// ═══════════════════ RUTINA (actividades) ═══════════════════
function RutinaView({ rutinas, onReload }: any) {
  const [newName, setNewName] = useState('')
  const [addingTo, setAddingTo] = useState<string | null>(null)

  const crear = async () => { if (!newName.trim()) return; await api.createRutina({ name: newName, type: 'general' }); setNewName(''); onReload() }

  return (
    <div className="p-4 space-y-5">
      <WeekStrip rutinas={rutinas} />

      <div className="flex gap-2">
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nueva rutina (ej: Mañanas)" className={inputCls} />
        <button onClick={crear} className="bg-neutral-900 text-white rounded-xl px-3 flex-shrink-0"><Plus className="w-5 h-5" /></button>
      </div>

      {rutinas?.length ? rutinas.map((r: any) => (
        <Card key={r.id} className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2"><Repeat className="w-4 h-4 text-neutral-600" /><span className="font-semibold">{r.name}</span></div>
            <button onClick={async () => { await api.deleteRutina(r.id); onReload() }} className="text-neutral-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
          </div>
          <div className="space-y-1.5">
            {(r.activities || []).map((a: any) => (
              <div key={a.id} className="flex items-center gap-2 text-sm bg-neutral-50 rounded-lg px-3 py-2">
                <span className="text-[11px] font-bold text-neutral-600 w-10">{a.startTime ? a.startTime.slice(0, 5) : '—'}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-200 text-neutral-600">{a.dayOfWeek === null ? 'Diario' : DAYS[a.dayOfWeek]}</span>
                <span className="flex-1 truncate">{a.title}</span>
                <button onClick={async () => { await api.deleteActividad(a.id); onReload() }} className="text-neutral-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
          {addingTo === r.id
            ? <ActividadForm rutinaId={r.id} onDone={() => { setAddingTo(null); onReload() }} onCancel={() => setAddingTo(null)} />
            : <button onClick={() => setAddingTo(r.id)} className="mt-2 text-xs text-neutral-900 flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Agregar actividad</button>}
        </Card>
      )) : <Empty icon={Repeat} text="Crea tu primera rutina para organizar tu día." />}
    </div>
  )
}

function WeekStrip({ rutinas }: any) {
  const [logs, setLogs] = useState<Set<string>>(new Set())
  const [attDays, setAttDays] = useState<Set<string>>(new Set())

  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i)
    return { date: d.toISOString().slice(0, 10), dow: d.getDay() }
  })
  const [sel, setSel] = useState(() => { const idx = week.findIndex(w => w.date === todayStr); return idx < 0 ? 0 : idx })

  const from = week[0].date, to = week[6].date
  const load = useCallback(async () => {
    const [lg, as] = await Promise.all([api.getActividadesLog(from, to), api.getMiAsistenciaGym()])
    if (lg.success) setLogs(new Set((lg.data || []).map((l: any) => `${l.actividadId}|${String(l.logDate).slice(0, 10)}`)))
    if (as.success) setAttDays(new Set((as.data?.recentDays) || []))
  }, [from, to])
  useEffect(() => { load() }, [load])

  const acts = (rutinas || []).flatMap((r: any) => (r.activities || []).map((a: any) => ({ ...a, rutina: r.name })))
  const dayActs = acts.filter((a: any) => a.dayOfWeek === null || a.dayOfWeek === week[sel].dow)
    .sort((a: any, b: any) => (a.startTime || '').localeCompare(b.startTime || ''))
  const isDone = (a: any) => logs.has(`${a.id}|${week[sel].date}`)
  const toggle = async (a: any) => { await api.toggleActividadLog(a.id, week[sel].date); load() }

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold">Mi semana</h3>
        <span className="text-[10px] text-neutral-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-violet-500" /> asistencia al gym</span>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {week.map((w, i) => (
          <button key={w.date} onClick={() => setSel(i)}
            className={`flex flex-col items-center py-2 rounded-xl transition-colors ${i === sel ? 'bg-neutral-900 text-white' : w.date === todayStr ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-500'}`}>
            <span className="text-[9px] uppercase">{DAYS[w.dow]}</span>
            <span className="text-sm font-bold">{w.date.slice(8, 10)}</span>
            <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${attDays.has(w.date) ? (i === sel ? 'bg-white' : 'bg-violet-500') : 'bg-transparent'}`} />
          </button>
        ))}
      </div>
      <div className="mt-3 space-y-2">
        {dayActs.length ? dayActs.map((a: any) => (
          <div key={a.id} className="flex items-center gap-3 bg-neutral-50 rounded-xl px-3 py-2.5">
            <button onClick={() => toggle(a)} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isDone(a) ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-neutral-300'}`}>{isDone(a) && <Check className="w-3.5 h-3.5" />}</button>
            <div className="flex-1 min-w-0">
              <div className={`text-sm truncate ${isDone(a) ? 'line-through text-neutral-400' : 'font-medium'}`}>{a.title}</div>
              <div className="text-[11px] text-neutral-400 capitalize">{a.startTime ? a.startTime.slice(0, 5) + ' · ' : ''}{a.type} · {a.rutina}</div>
            </div>
          </div>
        )) : <p className="text-xs text-neutral-400 py-2 text-center">Sin actividades para este día.</p>}
      </div>
    </Card>
  )
}

function ActividadForm({ rutinaId, onDone, onCancel }: any) {
  const [f, setF] = useState({ title: '', startTime: '', dayOfWeek: '', type: 'habito' })
  const save = async () => {
    if (!f.title.trim()) return
    await api.addActividad(rutinaId, {
      title: f.title, startTime: f.startTime || null,
      dayOfWeek: f.dayOfWeek === '' ? null : Number(f.dayOfWeek), type: f.type,
    })
    onDone()
  }
  return (
    <div className="mt-3 space-y-2 bg-neutral-50 rounded-xl p-3">
      <input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="¿Qué actividad?" className={inputCls} />
      <div className="grid grid-cols-3 gap-2">
        <input type="time" value={f.startTime} onChange={e => setF({ ...f, startTime: e.target.value })} className={inputCls} />
        <select value={f.dayOfWeek} onChange={e => setF({ ...f, dayOfWeek: e.target.value })} className={inputCls}>
          <option value="">Diario</option>
          {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
        </select>
        <select value={f.type} onChange={e => setF({ ...f, type: e.target.value })} className={inputCls}>
          <option value="habito">Hábito</option><option value="ejercicio">Ejercicio</option>
          <option value="comida">Comida</option><option value="compra">Compra</option><option value="otro">Otro</option>
        </select>
      </div>
      <div className="flex gap-2">
        <button onClick={save} className="flex-1 bg-neutral-900 text-white rounded-xl py-2 text-sm font-medium">Guardar</button>
        <button onClick={onCancel} className="px-4 text-sm text-neutral-500">Cancelar</button>
      </div>
    </div>
  )
}

// ═══════════════════ COCINA (despensa + recetas) ═══════════════════
function CocinaView({ despensa, recetas, puedoHacer, onReload }: any) {
  const [sub, setSub] = useState<'despensa' | 'recetas'>('despensa')
  const [showRecipe, setShowRecipe] = useState(false)
  return (
    <div className="p-4 space-y-4">
      <div className="flex bg-neutral-100 rounded-xl p-1">
        {([['despensa', 'Despensa'], ['recetas', 'Recetas']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setSub(k)} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${sub === k ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500'}`}>{l}</button>
        ))}
      </div>

      {sub === 'despensa' ? <DespensaView items={despensa} onReload={onReload} /> : (
        <div className="space-y-5">
          <button onClick={() => setShowRecipe(true)} className="w-full bg-neutral-900 text-white rounded-xl py-2.5 text-sm font-medium flex items-center justify-center gap-2"><Plus className="w-4 h-4" />Nueva receta</button>
          <Section title="Puedo cocinar ahora">
            {puedoHacer?.length ? (
              <div className="space-y-2">
                {puedoHacer.slice(0, 8).map((r: any) => (
                  <Card key={r.id} className="px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{r.name}</span>
                      <span className={`text-xs font-bold ${r.canCook ? 'text-emerald-600' : 'text-neutral-400'}`}>{r.matchPct}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-neutral-100 overflow-hidden"><div className={`h-full ${r.canCook ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: `${r.matchPct}%` }} /></div>
                    {r.missing?.length > 0 && (
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="text-[11px] text-neutral-400 truncate">Falta: {r.missing.join(', ')}</span>
                        <button onClick={async () => { await api.recetaALista(r.id); alert('Agregado a tu lista de compras') }} className="text-[11px] text-neutral-900 flex-shrink-0 ml-2 font-medium">+ Lista</button>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            ) : <Empty icon={Sparkles} text="Registra despensa y recetas para ver qué puedes cocinar." />}
          </Section>
          <Section title="Mis recetas">
            {recetas?.length ? (
              <div className="space-y-2">
                {recetas.map((r: any) => (
                  <Card key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0"><ChefHat className="w-4 h-4 text-amber-500" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{r.name}</div>
                      <div className="text-[11px] text-neutral-400 flex items-center gap-2">
                        {r.prepMinutes ? <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{r.prepMinutes}m</span> : null}
                        {r.calories ? <span>{r.calories} kcal</span> : null}
                      </div>
                    </div>
                    <button onClick={async () => { await api.deleteRutinaReceta(r.id); onReload() }} className="text-neutral-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </Card>
                ))}
              </div>
            ) : <Empty icon={ChefHat} text="Aún no tienes recetas guardadas." />}
          </Section>
        </div>
      )}

      {showRecipe && <RecipeModal onClose={() => setShowRecipe(false)} onSaved={() => { setShowRecipe(false); onReload() }} />}
    </div>
  )
}

function DespensaView({ items, onReload }: any) {
  const [f, setF] = useState({ name: '', quantity: '', unit: '', category: '', expiresAt: '' })
  const [saving, setSaving] = useState(false)
  const add = async () => {
    if (!f.name.trim()) return
    setSaving(true)
    await api.addDespensa({ name: f.name, quantity: Number(f.quantity) || 0, unit: f.unit || null, category: f.category || null, expiresAt: f.expiresAt || null })
    setF({ name: '', quantity: '', unit: '', category: '', expiresAt: '' }); setSaving(false); onReload()
  }
  const expSoon = (d: string | null) => d && new Date(d) <= new Date(Date.now() + 3 * 864e5)
  return (
    <div className="space-y-3">
      <Card className="p-3 space-y-2">
        <input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Ej: Pechuga de pollo" className={inputCls} />
        <div className="grid grid-cols-4 gap-2">
          <input value={f.quantity} onChange={e => setF({ ...f, quantity: e.target.value })} placeholder="Cant." inputMode="decimal" className={inputCls} />
          <input value={f.unit} onChange={e => setF({ ...f, unit: e.target.value })} placeholder="g/ud" className={inputCls} />
          <input value={f.category} onChange={e => setF({ ...f, category: e.target.value })} placeholder="Categoría" className={`${inputCls} col-span-2`} />
        </div>
        <div className="flex gap-2">
          <input type="date" value={f.expiresAt} onChange={e => setF({ ...f, expiresAt: e.target.value })} className={inputCls} />
          <button onClick={add} disabled={saving} className="bg-neutral-900 text-white rounded-xl px-4 flex-shrink-0 disabled:opacity-50"><Plus className="w-5 h-5" /></button>
        </div>
      </Card>
      {items?.length ? items.map((it: any) => (
        <Card key={it.id} className="flex items-center gap-3 px-3 py-2.5">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0"><Carrot className="w-4 h-4 text-emerald-500" /></div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{it.name}</div>
            <div className="text-[11px] text-neutral-400">
              {it.quantity}{it.unit ? ` ${it.unit}` : ''}{it.category ? ` · ${it.category}` : ''}
              {it.expiresAt && <span className={expSoon(it.expiresAt) ? 'text-orange-500 ml-1 font-medium' : 'text-neutral-300 ml-1'}>· vence {String(it.expiresAt).slice(0, 10)}</span>}
            </div>
          </div>
          <button onClick={async () => { await api.deleteDespensa(it.id); onReload() }} className="text-neutral-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
        </Card>
      )) : <Empty icon={Carrot} text="Tu despensa está vacía. Agrega lo que tienes en casa." />}
    </div>
  )
}

function RecipeModal({ onClose, onSaved }: any) {
  const [f, setF] = useState({ name: '', servings: '1', prepMinutes: '', calories: '', proteinG: '', carbsG: '', fatG: '', difficulty: '', mealType: 'cualquiera', instructions: '' })
  const [ings, setIngs] = useState<any[]>([{ name: '', quantity: '', unit: '' }])
  const [saving, setSaving] = useState(false)
  const save = async () => {
    if (!f.name.trim()) return
    setSaving(true)
    await api.createRutinaReceta({
      name: f.name, servings: Number(f.servings) || 1, prepMinutes: Number(f.prepMinutes) || null,
      calories: Number(f.calories) || null, proteinG: Number(f.proteinG) || null, carbsG: Number(f.carbsG) || null,
      fatG: Number(f.fatG) || null, difficulty: f.difficulty || null, mealType: f.mealType, instructions: f.instructions || null,
      ingredients: ings.filter(i => i.name.trim()).map(i => ({ name: i.name, quantity: Number(i.quantity) || 0, unit: i.unit || null })),
    })
    setSaving(false); onSaved()
  }
  return (
    <Modal title="Nueva receta" onClose={onClose}>
      <div className="space-y-3">
        <input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Nombre de la receta" className={inputCls} />
        <div className="grid grid-cols-3 gap-2">
          <LabeledInput label="Porciones" value={f.servings} onChange={(v: string) => setF({ ...f, servings: v })} />
          <LabeledInput label="Min" value={f.prepMinutes} onChange={(v: string) => setF({ ...f, prepMinutes: v })} />
          <LabeledInput label="Kcal" value={f.calories} onChange={(v: string) => setF({ ...f, calories: v })} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <LabeledInput label="Proteína g" value={f.proteinG} onChange={(v: string) => setF({ ...f, proteinG: v })} />
          <LabeledInput label="Carbos g" value={f.carbsG} onChange={(v: string) => setF({ ...f, carbsG: v })} />
          <LabeledInput label="Grasa g" value={f.fatG} onChange={(v: string) => setF({ ...f, fatG: v })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select value={f.difficulty} onChange={e => setF({ ...f, difficulty: e.target.value })} className={inputCls}>
            <option value="">Dificultad</option><option value="fácil">Fácil</option><option value="medio">Medio</option><option value="difícil">Difícil</option>
          </select>
          <select value={f.mealType} onChange={e => setF({ ...f, mealType: e.target.value })} className={inputCls}>
            <option value="cualquiera">Cualquiera</option><option value="desayuno">Desayuno</option><option value="almuerzo">Almuerzo</option><option value="cena">Cena</option><option value="snack">Snack</option>
          </select>
        </div>
        <div>
          <div className="text-xs font-medium text-neutral-500 mb-1">Ingredientes</div>
          <div className="space-y-2">
            {ings.map((ing, i) => (
              <div key={i} className="grid grid-cols-12 gap-2">
                <input value={ing.name} onChange={e => { const n = [...ings]; n[i].name = e.target.value; setIngs(n) }} placeholder="Ingrediente" className={`${inputCls} col-span-7`} />
                <input value={ing.quantity} onChange={e => { const n = [...ings]; n[i].quantity = e.target.value; setIngs(n) }} placeholder="Cant" inputMode="decimal" className={`${inputCls} col-span-2`} />
                <input value={ing.unit} onChange={e => { const n = [...ings]; n[i].unit = e.target.value; setIngs(n) }} placeholder="ud" className={`${inputCls} col-span-3`} />
              </div>
            ))}
          </div>
          <button onClick={() => setIngs([...ings, { name: '', quantity: '', unit: '' }])} className="mt-2 text-xs text-neutral-900 flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Ingrediente</button>
        </div>
        <textarea value={f.instructions} onChange={e => setF({ ...f, instructions: e.target.value })} placeholder="Preparación (opcional)" rows={2} className={inputCls} />
        <button onClick={save} disabled={saving} className="w-full bg-neutral-900 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar receta'}</button>
      </div>
    </Modal>
  )
}

// ═══════════════════ PLAN ═══════════════════
function PlanView({ plan, onReload, today }: any) {
  const [open, setOpen] = useState(false)
  const totals = (plan || []).reduce((a: any, m: any) => ({
    cal: a.cal + (m.calories || 0), pro: a.pro + (m.proteinG || 0), carb: a.carb + (m.carbsG || 0), fat: a.fat + (m.fatG || 0),
  }), { cal: 0, pro: 0, carb: 0, fat: 0 })

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold">Hoy · {today}</div>
        <button onClick={() => setOpen(true)} className="text-xs bg-neutral-900 text-white rounded-full px-3 py-1.5 flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Comida</button>
      </div>

      <Card className="p-4 grid grid-cols-4 gap-2 text-center">
        {[['Kcal', totals.cal], ['Prot', totals.pro + 'g'], ['Carb', totals.carb + 'g'], ['Grasa', totals.fat + 'g']].map(([l, v]) => (
          <div key={l as string}><div className="text-lg font-bold">{v}</div><div className="text-[10px] text-neutral-400">{l}</div></div>
        ))}
      </Card>

      {MEALS.map(meal => {
        const items = (plan || []).filter((m: any) => m.mealType === meal.key)
        if (!items.length) return null
        return (
          <Section key={meal.key} title={meal.label}>
            <div className="space-y-2">
              {items.map((m: any) => (
                <Card key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                  <button onClick={async () => { await api.togglePlanComida(m.id); onReload() }} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${m.isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-neutral-300'}`}>{m.isDone && <Check className="w-3.5 h-3.5" />}</button>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm ${m.isDone ? 'line-through text-neutral-400' : 'font-medium'}`}>{m.title || 'Comida'}</div>
                    <div className="text-[11px] text-neutral-400">{m.calories ? `${m.calories} kcal` : ''}{m.proteinG ? ` · P${m.proteinG} C${m.carbsG || 0} G${m.fatG || 0}` : ''}</div>
                  </div>
                  <button onClick={async () => { await api.deletePlanComida(m.id); onReload() }} className="text-neutral-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </Card>
              ))}
            </div>
          </Section>
        )
      })}
      {!plan?.length && <Empty icon={CalendarDays} text="Sin comidas planeadas. Agrega la primera." />}

      {open && <PlanModal today={today} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); onReload() }} />}
    </div>
  )
}

function PlanModal({ today, onClose, onSaved }: any) {
  const [f, setF] = useState({ mealType: 'almuerzo', title: '', calories: '', proteinG: '', carbsG: '', fatG: '' })
  const save = async () => {
    if (!f.title.trim()) return
    await api.addPlanComida({ planDate: today, mealType: f.mealType, title: f.title, calories: Number(f.calories) || null, proteinG: Number(f.proteinG) || null, carbsG: Number(f.carbsG) || null, fatG: Number(f.fatG) || null })
    onSaved()
  }
  return (
    <Modal title="Agregar comida" onClose={onClose}>
      <div className="space-y-3">
        <select value={f.mealType} onChange={e => setF({ ...f, mealType: e.target.value })} className={inputCls}>
          {MEALS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
        <input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="¿Qué vas a comer?" className={inputCls} />
        <div className="grid grid-cols-4 gap-2">
          <LabeledInput label="Kcal" value={f.calories} onChange={(v: string) => setF({ ...f, calories: v })} />
          <LabeledInput label="Prot" value={f.proteinG} onChange={(v: string) => setF({ ...f, proteinG: v })} />
          <LabeledInput label="Carb" value={f.carbsG} onChange={(v: string) => setF({ ...f, carbsG: v })} />
          <LabeledInput label="Grasa" value={f.fatG} onChange={(v: string) => setF({ ...f, fatG: v })} />
        </div>
        <button onClick={save} className="w-full bg-neutral-900 text-white rounded-xl py-2.5 text-sm font-medium">Agregar</button>
      </div>
    </Modal>
  )
}

// ═══════════════════ COMPRAS ═══════════════════
function ComprasView({ items, onReload }: any) {
  const [name, setName] = useState('')
  const add = async () => { if (!name.trim()) return; await api.addListaCompra({ name }); setName(''); onReload() }
  const pend = (items || []).filter((i: any) => !i.isPurchased)
  const done = (items || []).filter((i: any) => i.isPurchased)
  const Row = (it: any) => (
    <Card key={it.id} className="flex items-center gap-3 px-3 py-2.5">
      <button onClick={async () => { await api.toggleListaCompra(it.id); onReload() }} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${it.isPurchased ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-neutral-300'}`}>{it.isPurchased && <Check className="w-3.5 h-3.5" />}</button>
      <div className="flex-1 min-w-0">
        <div className={`text-sm ${it.isPurchased ? 'line-through text-neutral-400' : 'font-medium'}`}>{it.name}</div>
        <div className="text-[11px] text-neutral-400">{it.quantity}{it.unit ? ` ${it.unit}` : ''}{it.tenantName && <span className="text-sky-600 ml-1">· {it.tenantName}</span>}</div>
      </div>
      <button onClick={async () => { await api.deleteListaCompra(it.id); onReload() }} className="text-neutral-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
    </Card>
  )
  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-2">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Leche, huevos…" className={inputCls} />
        <button onClick={add} className="bg-neutral-900 text-white rounded-xl px-4 flex-shrink-0"><Plus className="w-5 h-5" /></button>
      </div>
      {pend.length ? <div className="space-y-2">{pend.map(Row)}</div> : <Empty icon={ShoppingBasket} text="Tu lista está vacía." />}
      {done.length > 0 && <Section title={`Comprados (${done.length})`}><div className="space-y-2">{done.map(Row)}</div></Section>}
    </div>
  )
}

// ═══════════════════ GYM ═══════════════════
function GymView({ data, onReload }: any) {
  const { membresias, plan, progreso, asistencia, acceso } = data
  const [showQR, setShowQR] = useState(false)
  const ultimoPeso = progreso?.length ? progreso[progreso.length - 1].weightKg : null
  const openTenant = asistencia?.openCheckIn?.tenantId || null
  const doCheckIn = async (tenantId: string) => { await api.miGymCheckIn(tenantId); onReload?.() }
  const doCheckOut = async () => { await api.miGymCheckOut(); onReload?.() }

  const acc = acceso?.memberships?.[0] || null
  const accCfg: Record<string, any> = {
    permitido: { icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', label: 'Acceso permitido' },
    por_vencer: { icon: ShieldAlert, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', label: 'Por vencer' },
    denegado: { icon: ShieldX, color: 'text-red-600', bg: 'bg-red-50 border-red-200', label: 'Acceso denegado' },
  }
  const cfg = acc ? accCfg[acc.status] : null

  return (
    <div className="p-4 space-y-5">
      {acceso && (
        <Card className={`p-4 border ${cfg ? cfg.bg : 'border-black/5'}`}>
          <div className="flex items-center gap-3">
            {cfg && <cfg.icon className={`w-8 h-8 ${cfg.color}`} />}
            <div className="flex-1 min-w-0">
              <div className={`font-bold ${cfg ? cfg.color : ''}`}>{cfg ? cfg.label : 'Mi acceso'}</div>
              <div className="text-xs text-neutral-500">{acc?.reason || 'Presenta tu QR en recepción'}{acc?.daysRemaining != null && acc.status !== 'denegado' ? ` · ${acc.daysRemaining} días` : ''}</div>
            </div>
            <button onClick={() => setShowQR(true)} className="bg-violet-600 text-white rounded-xl px-3 py-2 text-xs font-medium flex items-center gap-1.5"><QrCode className="w-4 h-4" />Mi QR</button>
          </div>
          {acc?.status === 'denegado' && (
            <p className="mt-2 text-xs text-red-600">Tu membresía no está vigente. Acércate a recepción para renovar.</p>
          )}
        </Card>
      )}

      {membresias?.map((m: any) => (
        <Card key={m.tenantId} className="p-4 bg-violet-50 border-violet-100">
          <div className="flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-violet-600" /><span className="font-semibold">{m.gymName}</span>
            <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-violet-200 text-violet-800 capitalize">{m.status}</span>
          </div>
          <div className="text-xs text-neutral-500 mt-1">{m.planName || 'Plan'}{m.nextPaymentAt ? ` · próx. pago ${String(m.nextPaymentAt).slice(0, 10)}` : ''}</div>
          {m.status === 'activa' && (
            openTenant === m.tenantId
              ? <button onClick={doCheckOut} className="mt-3 w-full bg-neutral-800 text-white rounded-xl py-2 text-sm font-medium flex items-center justify-center gap-2"><Check className="w-4 h-4" />Marcar salida</button>
              : <button onClick={() => doCheckIn(m.tenantId)} className="mt-3 w-full bg-violet-600 text-white rounded-xl py-2 text-sm font-medium flex items-center justify-center gap-2"><Dumbbell className="w-4 h-4" />Registrar entrada</button>
          )}
        </Card>
      ))}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Flame, color: 'text-orange-500', val: asistencia?.streak ?? 0, lbl: 'Racha (días)' },
          { icon: CalendarDays, color: 'text-sky-500', val: asistencia?.last30 ?? 0, lbl: 'Visitas (30d)' },
          { icon: TrendingUp, color: 'text-emerald-500', val: ultimoPeso ?? '—', lbl: 'Peso (kg)' },
        ].map((s, i) => (
          <Card key={i} className="p-4 text-center"><s.icon className={`w-5 h-5 mx-auto ${s.color}`} /><div className="text-2xl font-bold mt-1">{s.val}</div><div className="text-[10px] text-neutral-500">{s.lbl}</div></Card>
        ))}
      </div>
      <Section title="Mi plan">
        {plan?.length ? plan.map((p: any) => (
          <Card key={p.id} className="p-3 mb-2">
            <div className="text-sm font-medium">{p.name}{p.daysPerWeek ? ` · ${p.daysPerWeek}x/sem` : ''}</div>
            <div className="mt-2 space-y-1">
              {(p.exercises || []).map((e: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs text-neutral-600">
                  <span>{e.dayLabel ? `${e.dayLabel} · ` : ''}{e.name}</span>
                  <span className="text-neutral-400">{e.sets ? `${e.sets}x` : ''}{e.reps || ''}{e.weightKg ? ` · ${e.weightKg}kg` : ''}</span>
                </div>
              ))}
            </div>
          </Card>
        )) : <Empty icon={Dumbbell} text="Tu gimnasio aún no te ha asignado un plan." />}
      </Section>
      {progreso?.length > 0 && (
        <Section title="Progreso reciente">
          <div className="space-y-1.5">
            {progreso.slice(-6).reverse().map((p: any, i: number) => (
              <Card key={i} className="flex items-center justify-between text-xs px-3 py-2">
                <span className="text-neutral-500">{String(p.logDate).slice(0, 10)}</span>
                <span>{p.weightKg ? `${p.weightKg} kg` : ''}{p.bodyFatPct ? ` · ${p.bodyFatPct}% grasa` : ''}</span>
              </Card>
            ))}
          </div>
        </Section>
      )}

      {showQR && acceso && (
        <Modal title="Mi código de acceso" onClose={() => setShowQR(false)}>
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="bg-white p-4 rounded-2xl border border-black/10">
              <QRCodeSVG value={acceso.qrCode} size={220} level="M" />
            </div>
            <p className="text-sm text-neutral-500 text-center">Muéstralo en la recepción del gimnasio para registrar tu ingreso.</p>
            {cfg && <div className={`text-sm font-medium ${cfg.color} flex items-center gap-1.5`}><cfg.icon className="w-4 h-4" />{cfg.label}{acc?.daysRemaining != null && acc.status !== 'denegado' ? ` · ${acc.daysRemaining} días` : ''}</div>}
          </div>
        </Modal>
      )}
    </div>
  )
}

// ═══════════════════ PERFIL ═══════════════════
function PerfilModal({ onClose, onSaved }: any) {
  const [f, setF] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    api.getRutinaPerfil().then(r => setF({
      sex: r.data?.sex || '', heightCm: r.data?.height_cm || '', weightKg: r.data?.weight_kg || '',
      targetWeightKg: r.data?.target_weight_kg || '', goal: r.data?.goal || '', activityLevel: r.data?.activity_level || '',
      dailyCalorieTarget: r.data?.daily_calorie_target || '', waterTargetMl: r.data?.water_target_ml || '', city: r.data?.city || '',
    }))
  }, [])
  const save = async () => {
    setSaving(true)
    await api.saveRutinaPerfil({
      sex: f.sex || null, heightCm: Number(f.heightCm) || null, weightKg: Number(f.weightKg) || null,
      targetWeightKg: Number(f.targetWeightKg) || null, goal: f.goal || null, activityLevel: f.activityLevel || null,
      dailyCalorieTarget: Number(f.dailyCalorieTarget) || null, waterTargetMl: Number(f.waterTargetMl) || null, city: f.city || null,
    })
    setSaving(false); onSaved()
  }
  return (
    <Modal title="Mi perfil" onClose={onClose}>
      {!f ? <div className="flex justify-center py-8 text-neutral-300"><Loader2 className="w-5 h-5 animate-spin" /></div> : (
        <div className="space-y-3">
          <select value={f.goal} onChange={e => setF({ ...f, goal: e.target.value })} className={inputCls}>
            <option value="">Objetivo</option><option value="bajar_peso">Bajar de peso</option><option value="subir_masa">Subir masa</option><option value="mantener">Mantener</option><option value="salud_general">Salud general</option>
          </select>
          <div className="grid grid-cols-3 gap-2">
            <LabeledInput label="Estatura cm" value={f.heightCm} onChange={(v: string) => setF({ ...f, heightCm: v })} />
            <LabeledInput label="Peso kg" value={f.weightKg} onChange={(v: string) => setF({ ...f, weightKg: v })} />
            <LabeledInput label="Meta kg" value={f.targetWeightKg} onChange={(v: string) => setF({ ...f, targetWeightKg: v })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <LabeledInput label="Meta kcal/día" value={f.dailyCalorieTarget} onChange={(v: string) => setF({ ...f, dailyCalorieTarget: v })} />
            <LabeledInput label="Agua ml/día" value={f.waterTargetMl} onChange={(v: string) => setF({ ...f, waterTargetMl: v })} />
          </div>
          <select value={f.activityLevel} onChange={e => setF({ ...f, activityLevel: e.target.value })} className={inputCls}>
            <option value="">Nivel de actividad</option><option value="sedentario">Sedentario</option><option value="ligero">Ligero</option><option value="moderado">Moderado</option><option value="activo">Activo</option><option value="muy_activo">Muy activo</option>
          </select>
          <input value={f.city} onChange={e => setF({ ...f, city: e.target.value })} placeholder="Ciudad" className={inputCls} />
          <button onClick={save} disabled={saving} className="w-full bg-neutral-900 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar perfil'}</button>
          <div className="pt-3 border-t border-black/5"><AchievementShelf compact /></div>
          <button onClick={() => { if (confirm('¿Cerrar sesión?')) useAuthStore.getState().logout() }} className="w-full flex items-center justify-center gap-2 text-sm font-medium text-red-500 hover:bg-red-50 rounded-xl py-2.5 mt-1">
            <LogOut className="w-4 h-4" /> Cerrar sesión
          </button>
        </div>
      )}
    </Modal>
  )
}

// ═══════════════════ Modal + LabeledInput ═══════════════════
function Modal({ title, onClose, children }: any) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 h-14 border-b border-black/5 sticky top-0 bg-white z-10">
          <h3 className="font-bold">{title}</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
function LabeledInput({ label, value, onChange }: any) {
  return (
    <label className="block">
      <span className="text-[10px] text-neutral-500 mb-1 block">{label}</span>
      <input value={value} onChange={e => onChange(e.target.value)} inputMode="decimal" className={inputCls} />
    </label>
  )
}

// ── Secciones reutilizables por DesktopShell ──
export {
  HoyView, RutinaView, CocinaView, PlanView, ComprasView, GymView,
  HeaderRings, PerfilModal, ChatAssistant, WeekStrip, ActividadForm, PlanModal,
  DespensaView, RecipeModal,
}

// HeaderRings (versión legacy para compatibilidad desktop)
function HeaderRings({ resumen }: any) {
  const n = resumen?.nutricion
  const target = resumen?.perfil?.dailyCalorieTarget || 0
  const consumed = n?.caloriasConsumidas || 0
  const remaining = Math.max(0, target - consumed)
  return (
    <div className="mt-4 flex items-center gap-4">
      <CompactRing value={consumed} max={target || 1} color="#fff" />
      <div className="flex-1 space-y-2">
        <MacroBar label="Proteína" value={n?.proteinaConsumida || 0} max={n?.proteinaPlan || 0} color="#34d399" />
        <MacroBar label="Carbos" value={n?.carbsConsumidos || 0} max={n?.carbsPlan || 0} color="#fbbf24" />
        <MacroBar label="Grasa" value={n?.grasaConsumida || 0} max={n?.grasaPlan || 0} color="#f472b6" />
      </div>
    </div>
  )
}
