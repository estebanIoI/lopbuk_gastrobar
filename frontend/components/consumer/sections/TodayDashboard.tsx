'use client'

/**
 * TodayDashboard — "Today" como GRID DE WIDGETS para escritorio (C3b).
 * No reusa la vista móvil en columna: compone widgets propios (macros, comidas,
 * agenda, LEGEND) aprovechando el ancho. Datos vía props del hook compartido.
 */
import { Check, Utensils, ListChecks, Flame, Crown, ChevronRight, ShoppingBag } from 'lucide-react'
import { api } from '@/lib/api'
import { useCountUp } from '@/components/consumer/hooks/useCountUp'

function Ring({ value, max, color = '#ea580c', center, sub }: { value: number; max: number; color?: string; center: string; sub: string }) {
  const r = 42, c = 2 * Math.PI * r
  const pct = max > 0 ? Math.min(1, value / max) : 0
  return (
    <svg viewBox="0 0 100 100" className="w-28 h-28 -rotate-90">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#eee" strokeWidth="9" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: 'stroke-dashoffset .6s ease' }} />
      <g className="rotate-90" style={{ transformOrigin: '50px 50px' }}>
        <text x="50" y="47" textAnchor="middle" className="fill-neutral-900 font-extrabold" style={{ fontSize: 17 }}>{center}</text>
        <text x="50" y="62" textAnchor="middle" className="fill-neutral-400" style={{ fontSize: 8 }}>{sub}</text>
      </g>
    </svg>
  )
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div>
      <div className="flex justify-between text-[11px] text-neutral-500 mb-1"><span>{label}</span><span>{Math.round(value)}/{Math.round(max)} g</span></div>
      <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

function WCard({ title, action, children, className = '' }: any) {
  return (
    <div className={`rounded-2xl bg-white border border-black/[0.07] p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${className}`}>
      {title && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-neutral-800">{title}</h3>
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

export default function TodayDashboard({ resumen, plan, rutinas, planState, legend, onReload, onGoTo, onExplore }: any) {
  const powerDays = useCountUp(Number(planState?.powerDays ?? 0))
  const n = resumen?.nutricion
  const target = resumen?.perfil?.dailyCalorieTarget || 0
  const consumed = Number(n?.caloriasConsumidas || 0)
  const remaining = Math.max(0, target - consumed)

  const dow = new Date().getDay()
  const todayActs = (rutinas || []).flatMap((r: any) =>
    (r.activities || []).filter((a: any) => a.dayOfWeek === null || a.dayOfWeek === dow).map((a: any) => ({ ...a, rutina: r.name }))
  ).sort((a: any, b: any) => (a.startTime || '').localeCompare(b.startTime || ''))

  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Macros */}
      <WCard title="Nutrición de hoy">
        <div className="flex items-center gap-5">
          <Ring value={consumed} max={target || 1} center={target ? String(remaining) : String(n?.caloriasPlan || 0)} sub={target ? 'kcal rest.' : 'kcal plan'} />
          <div className="flex-1 space-y-2.5">
            <Bar label="Proteína" value={Number(n?.proteinaConsumida || 0)} max={Number(n?.proteinaPlan || 0)} color="#34d399" />
            <Bar label="Carbos" value={Number(n?.carbsConsumidos || 0)} max={Number(n?.carbsPlan || 0)} color="#fbbf24" />
            <Bar label="Grasa" value={Number(n?.grasaConsumida || 0)} max={Number(n?.grasaPlan || 0)} color="#f472b6" />
          </div>
        </div>
      </WCard>

      {/* LEGEND / streak o CTA */}
      {legend ? (
        <WCard className="bg-gradient-to-br from-[#1a1a1a] to-[#3a2f0a] !border-amber-500/30">
          <div className="flex items-center gap-2 text-amber-400 font-extrabold"><Crown className="w-5 h-5" /> LEGEND</div>
          <div className="mt-3 flex items-center gap-2 text-white">
            <Flame className="w-5 h-5 text-amber-400" />
            <span className="text-3xl font-black tabular-nums">{powerDays}</span>
            <span className="text-sm text-white/60">días de poder</span>
          </div>
          <button onClick={() => onGoTo('planes')} className="mt-3 text-xs text-amber-300 font-medium inline-flex items-center gap-1">Ver beneficios <ChevronRight className="w-3.5 h-3.5" /></button>
        </WCard>
      ) : (
        <WCard className="bg-gradient-to-br from-amber-50 to-white !border-amber-200">
          <div className="flex items-center gap-2 text-amber-600 font-extrabold"><Crown className="w-5 h-5" /> Sube a LEGEND</div>
          <p className="text-sm text-neutral-600 mt-2">Desbloquea IA avanzada, descuentos y temas exclusivos con un código.</p>
          <button onClick={() => onGoTo('planes')} className="mt-3 rounded-lg bg-amber-500 text-white text-sm font-semibold px-3 py-2">Activar código</button>
        </WCard>
      )}

      {/* Comidas de hoy */}
      <WCard title="Comidas de hoy" action={<button onClick={() => onGoTo('plan')} className="text-xs text-orange-600 font-medium">Ver plan</button>}>
        {plan?.length ? (
          <div className="space-y-2">
            {plan.map((m: any) => (
              <div key={m.id} className="flex items-center gap-3">
                <button onClick={async () => { await api.togglePlanComida(m.id); onReload() }} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${m.isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-neutral-300'}`}>
                  {m.isDone && <Check className="w-3.5 h-3.5" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm truncate ${m.isDone ? 'line-through text-neutral-400' : 'font-medium'}`}>{m.title || 'Comida'}</div>
                  <div className="text-[11px] text-neutral-400 capitalize">{String(m.mealType).replace('_', ' ')}{m.calories ? ` · ${m.calories} kcal` : ''}</div>
                </div>
              </div>
            ))}
          </div>
        ) : <div className="flex flex-col items-center text-neutral-300 py-6"><Utensils className="w-7 h-7 mb-1" /><span className="text-xs">Sin comidas planeadas.</span></div>}
      </WCard>

      {/* Agenda del día */}
      <WCard title="Tu día" action={<button onClick={() => onGoTo('rutina')} className="text-xs text-orange-600 font-medium">Editar rutina</button>}>
        {todayActs.length ? (
          <div className="space-y-2">
            {todayActs.map((a: any) => (
              <div key={a.id} className="flex items-center gap-3">
                <div className="text-xs font-bold text-orange-600 w-12">{a.startTime ? a.startTime.slice(0, 5) : '—'}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{a.title}</div>
                  <div className="text-[11px] text-neutral-400 capitalize">{a.type} · {a.rutina}</div>
                </div>
              </div>
            ))}
          </div>
        ) : <div className="flex flex-col items-center text-neutral-300 py-6"><ListChecks className="w-7 h-7 mb-1" /><span className="text-xs">Sin actividades hoy.</span></div>}
      </WCard>

      {/* Explore CTA (ancho completo) */}
      <WCard className="lg:col-span-2 flex items-center justify-between !bg-neutral-900 !border-neutral-800">
        <div className="flex items-center gap-3 text-white">
          <ShoppingBag className="w-5 h-5 text-emerald-400" />
          <div>
            <p className="text-sm font-bold">Explora productos para tu objetivo</p>
            <p className="text-xs text-white/50">Proteínas, snacks, gear y más de comercios DAIMUZ.</p>
          </div>
        </div>
        <button onClick={onExplore} className="rounded-lg bg-white text-neutral-900 text-sm font-semibold px-4 py-2">Explore</button>
      </WCard>
    </div>
  )
}
