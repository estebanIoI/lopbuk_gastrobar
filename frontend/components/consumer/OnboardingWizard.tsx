'use client'

/**
 * OnboardingWizard — Activación (P0). Pantalla completa, inmersiva: recoge objetivo,
 * datos físicos, experiencia, lugar, dieta, tiempo y motivación; genera el programa
 * (rutina + nutrición + roadmap) y lo revela. Convierte "veo módulos" en "tengo un plan".
 */
import { useState, useEffect } from 'react'
import { ArrowLeft, ArrowRight, Check, Flame, Dumbbell, Home, Building2, Target, Sparkles, Trophy } from 'lucide-react'
import { api } from '@/lib/api'

const GOALS = [
  { k: 'bajar_peso', emoji: '🔥', label: 'Bajar grasa' },
  { k: 'subir_masa', emoji: '💪', label: 'Ganar masa muscular' },
  { k: 'salud_general', emoji: '❤️', label: 'Mantenerme saludable' },
  { k: 'recomposicion', emoji: '⚡', label: 'Recomposición corporal' },
  { k: 'rendimiento', emoji: '🏃', label: 'Mejorar rendimiento' },
  { k: 'volver_entrenar', emoji: '🔄', label: 'Volver a entrenar' },
]
const EXPERIENCE = [{ k: 'principiante', label: 'Principiante' }, { k: 'intermedio', label: 'Intermedio' }, { k: 'avanzado', label: 'Avanzado' }]
const LOCATIONS = [{ k: 'gym', label: 'Gimnasio', icon: Dumbbell }, { k: 'casa', label: 'Casa', icon: Home }, { k: 'hibrido', label: 'Híbrido', icon: Building2 }]
const DIETS = [
  { k: 'normal', label: 'Normal' }, { k: 'alta_proteina', label: 'Alta proteína' }, { k: 'vegetariano', label: 'Vegetariano' },
  { k: 'vegano', label: 'Vegano' }, { k: 'keto', label: 'Keto' }, { k: 'sin_restricciones', label: 'Sin restricciones' },
]
const TIMES = [{ k: 20, label: '20 min' }, { k: 45, label: '45 min' }, { k: 75, label: '1h+' }]
const MOTIVATIONS = ['Quiero verme mejor', 'Quiero recuperar mi salud', 'Quiero subir mi autoestima', 'Quiero aumentar masa', 'Quiero sentirme con más energía']

const TOTAL = 7

export default function OnboardingWizard({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)
  const [phase, setPhase] = useState<'form' | 'generating' | 'ready'>('form')
  const [result, setResult] = useState<any>(null)
  const [err, setErr] = useState('')

  const [d, setD] = useState<any>({
    goal: '', sex: '', weightKg: '', heightCm: '', age: '',
    experience: '', trainingLocation: '', diet: '', timePerDay: 0, daysPerWeek: 4, motivation: '',
  })
  const set = (patch: any) => setD((p: any) => ({ ...p, ...patch }))

  const canNext = () => {
    switch (step) {
      case 0: return !!d.goal
      case 1: return d.weightKg && d.heightCm && d.age && d.sex
      case 2: return !!d.experience
      case 3: return !!d.trainingLocation
      case 4: return !!d.diet
      case 5: return !!d.timePerDay
      case 6: return !!d.motivation
      default: return true
    }
  }

  const submit = async () => {
    setPhase('generating'); setErr('')
    const activityLevel = d.daysPerWeek <= 2 ? 'ligero' : d.daysPerWeek >= 5 ? 'activo' : 'moderado'
    const payload = {
      goal: d.goal, sex: d.sex, weightKg: Number(d.weightKg), heightCm: Number(d.heightCm), age: Number(d.age),
      activityLevel, experience: d.experience, trainingLocation: d.trainingLocation,
      dietaryPrefs: [d.diet], timePerDay: d.timePerDay, daysPerWeek: d.daysPerWeek, motivation: d.motivation,
    }
    // Pausa mínima para que el reveal se sienta (la IA "piensa").
    const [r] = await Promise.all([api.completeOnboarding(payload), new Promise(res => setTimeout(res, 2600))])
    if (r.success && r.data) { setResult(r.data); setPhase('ready') }
    else { setErr(r.error || 'No se pudo crear tu plan.'); setPhase('form') }
  }

  const next = () => { if (step < TOTAL - 1) setStep(step + 1); else submit() }
  const back = () => setStep(s => Math.max(0, s - 1))

  if (phase === 'generating') return <Generating />
  if (phase === 'ready') return <PlanReady result={result} onStart={onDone} />

  return (
    <div className="fixed inset-0 z-[200] bg-neutral-950 text-white flex flex-col">
      {/* Progreso */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-3">
          {step > 0 ? <button onClick={back} className="text-white/50 hover:text-white"><ArrowLeft className="w-5 h-5" /></button> : <span className="w-5" />}
          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-amber-400 transition-all duration-300" style={{ width: `${((step + 1) / TOTAL) * 100}%` }} />
          </div>
          <span className="text-xs text-white/40 tabular-nums">{step + 1}/{TOTAL}</span>
        </div>
      </div>

      {/* Contenido del paso */}
      <div className="flex-1 overflow-y-auto px-5 sm:px-8 pb-4">
        <div className="max-w-lg mx-auto">
          {step === 0 && (
            <Step title="¿Cuál es tu objetivo?" subtitle="Tu plan se construye alrededor de esto.">
              <div className="grid grid-cols-2 gap-3">
                {GOALS.map(g => <Card key={g.k} active={d.goal === g.k} onClick={() => set({ goal: g.k })}><div className="text-3xl">{g.emoji}</div><p className="font-semibold mt-1.5 text-sm">{g.label}</p></Card>)}
              </div>
            </Step>
          )}
          {step === 1 && (
            <Step title="Cuéntanos de ti" subtitle="Para calcular tus calorías y macros exactos.">
              <div className="flex gap-2 mb-3">
                {['m', 'f'].map(s => <button key={s} onClick={() => set({ sex: s })} className={`flex-1 py-3 rounded-xl border text-sm font-semibold ${d.sex === s ? 'bg-amber-400 text-neutral-900 border-amber-400' : 'border-white/15 text-white/70'}`}>{s === 'm' ? 'Hombre' : 'Mujer'}</button>)}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Peso (kg)" value={d.weightKg} onChange={(v: string) => set({ weightKg: v })} />
                <Field label="Altura (cm)" value={d.heightCm} onChange={(v: string) => set({ heightCm: v })} />
                <Field label="Edad" value={d.age} onChange={(v: string) => set({ age: v })} />
              </div>
            </Step>
          )}
          {step === 2 && (
            <Step title="Tu experiencia" subtitle="Ajustamos la dificultad a tu nivel.">
              <div className="space-y-2">{EXPERIENCE.map(e => <Bar key={e.k} active={d.experience === e.k} onClick={() => set({ experience: e.k })}>{e.label}</Bar>)}</div>
            </Step>
          )}
          {step === 3 && (
            <Step title="¿Dónde entrenas?" subtitle="Tu rutina se adapta a tu equipo.">
              <div className="grid grid-cols-3 gap-3">{LOCATIONS.map(l => <Card key={l.k} active={d.trainingLocation === l.k} onClick={() => set({ trainingLocation: l.k })}><l.icon className="w-7 h-7 mx-auto text-amber-400" /><p className="font-semibold mt-2 text-sm">{l.label}</p></Card>)}</div>
            </Step>
          )}
          {step === 4 && (
            <Step title="Tu alimentación" subtitle="Personalizamos tu plan nutricional.">
              <div className="grid grid-cols-2 gap-2">{DIETS.map(x => <Bar key={x.k} active={d.diet === x.k} onClick={() => set({ diet: x.k })}>{x.label}</Bar>)}</div>
            </Step>
          )}
          {step === 5 && (
            <Step title="Tu tiempo" subtitle="¿Cuánto puedes dedicarle?">
              <p className="text-xs text-white/40 mb-1.5">Minutos por sesión</p>
              <div className="grid grid-cols-3 gap-2 mb-4">{TIMES.map(t => <Bar key={t.k} active={d.timePerDay === t.k} onClick={() => set({ timePerDay: t.k })}>{t.label}</Bar>)}</div>
              <p className="text-xs text-white/40 mb-1.5">Días por semana: <b className="text-white">{d.daysPerWeek}</b></p>
              <input type="range" min={2} max={6} value={d.daysPerWeek} onChange={e => set({ daysPerWeek: Number(e.target.value) })} className="w-full accent-amber-400" />
            </Step>
          )}
          {step === 6 && (
            <Step title="¿Qué te mueve?" subtitle="Esto nos ayuda a motivarte cada día.">
              <div className="space-y-2">{MOTIVATIONS.map(m => <Bar key={m} active={d.motivation === m} onClick={() => set({ motivation: m })}>{m}</Bar>)}</div>
            </Step>
          )}
          {err && <p className="text-sm text-red-400 mt-3">{err}</p>}
        </div>
      </div>

      {/* CTA */}
      <div className="px-5 sm:px-8 py-4 border-t border-white/[0.06]">
        <button onClick={next} disabled={!canNext()} className="max-w-lg mx-auto w-full rounded-xl bg-amber-400 text-neutral-900 font-bold py-3.5 disabled:opacity-30 flex items-center justify-center gap-2">
          {step === TOTAL - 1 ? <>Crear mi plan <Sparkles className="w-4 h-4" /></> : <>Continuar <ArrowRight className="w-4 h-4" /></>}
        </button>
      </div>
    </div>
  )
}

function Generating() {
  const msgs = ['Analizando tu perfil…', 'Calculando tus calorías y macros…', 'Creando tu rutina personalizada…', 'Configurando tu nutrición…', 'Trazando tu roadmap…']
  const [i, setI] = useState(0)
  useEffect(() => { const t = setInterval(() => setI(v => (v + 1) % msgs.length), 600); return () => clearInterval(t) }, [])
  return (
    <div className="fixed inset-0 z-[200] bg-neutral-950 text-white flex flex-col items-center justify-center gap-5">
      <div className="relative">
        <div className="w-20 h-20 rounded-full border-2 border-amber-400/20 border-t-amber-400 animate-spin" />
        <Flame className="w-8 h-8 text-amber-400 absolute inset-0 m-auto" />
      </div>
      <p className="text-white/70 text-sm animate-pulse">{msgs[i]}</p>
    </div>
  )
}

function PlanReady({ result, onStart }: { result: any; onStart: () => void }) {
  const r = result || {}
  return (
    <div className="fixed inset-0 z-[200] bg-neutral-950 text-white flex flex-col">
      <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-8">
        <div className="max-w-lg mx-auto text-center">
          <div className="w-16 h-16 rounded-full bg-amber-400 text-neutral-900 flex items-center justify-center mx-auto animate-in zoom-in duration-300"><Check className="w-9 h-9" /></div>
          <h1 className="text-2xl font-extrabold mt-4">¡Tu programa está listo!</h1>
          <p className="text-white/50 text-sm mt-1">Construido para tu objetivo. Empieza hoy.</p>

          <div className="grid grid-cols-2 gap-3 mt-6 text-left">
            <Stat icon={Target} label="Objetivo diario" value={`${r.calories || 0} kcal`} />
            <Stat icon={Dumbbell} label="Tu split" value={r.split || '—'} />
            <Stat icon={Flame} label="Proteína" value={`${r.macros?.proteinG || 0} g`} />
            <Stat icon={Trophy} label="Entrenos/sem" value={`${r.daysPerWeek || 0} días`} />
          </div>

          <div className="mt-6 text-left">
            <p className="text-xs uppercase tracking-wide text-white/40 mb-2">Tu roadmap</p>
            <div className="space-y-2">
              {(r.roadmap || []).map((rm: any) => (
                <div key={rm.week} className="flex items-start gap-3 rounded-xl bg-white/[0.04] border border-white/[0.06] p-3">
                  <span className="text-amber-400 font-extrabold text-sm shrink-0">S{rm.week}</span>
                  <div><p className="font-semibold text-sm">{rm.title}</p><p className="text-xs text-white/50">{rm.detail}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="px-5 sm:px-8 py-4 border-t border-white/[0.06]">
        <button onClick={onStart} className="max-w-lg mx-auto w-full rounded-xl bg-amber-400 text-neutral-900 font-bold py-3.5 flex items-center justify-center gap-2">
          <Flame className="w-4 h-4" /> Comenzar mi transformación
        </button>
      </div>
    </div>
  )
}

// ── Primitivos ──
function Step({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="pt-4">
      <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
      {subtitle && <p className="text-white/50 text-sm mt-1 mb-6">{subtitle}</p>}
      {children}
    </div>
  )
}
function Card({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`rounded-2xl border p-4 text-center transition-all ${active ? 'bg-amber-400/15 border-amber-400' : 'bg-white/[0.03] border-white/10 hover:border-white/25'}`}>{children}</button>
}
function Bar({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`w-full text-left rounded-xl border px-4 py-3 text-sm font-medium transition-all ${active ? 'bg-amber-400/15 border-amber-400 text-white' : 'bg-white/[0.03] border-white/10 text-white/70 hover:border-white/25'}`}>{children}</button>
}
function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-[11px] text-white/40">{label}</span>
      <input inputMode="numeric" value={value} onChange={e => onChange(e.target.value.replace(/[^0-9.]/g, ''))} className="w-full mt-1 rounded-xl bg-white/[0.05] border border-white/10 px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" />
    </label>
  )
}
function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-3">
      <Icon className="w-4 h-4 text-amber-400" />
      <p className="font-bold mt-1.5 leading-tight">{value}</p>
      <p className="text-[11px] text-white/40">{label}</p>
    </div>
  )
}
