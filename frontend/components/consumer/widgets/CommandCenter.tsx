'use client'

/**
 * CommandCenter — panel derecho del DesktopShell (C3). "AI Insights" que hacen
 * sentir el OS vivo e inteligente. Por ahora heurístico (derivado de resumen +
 * plan LEGEND), sin llamar a la IA; en C6 se enchufa el asistente real.
 */
import { Sparkles, Flame, Drumstick, Crown, Tag, Trophy } from 'lucide-react'

const MILESTONES = [
  { key: 'constante', days: 30 }, { key: 'elite', days: 90 },
  { key: 'glow', days: 180 }, { key: 'founder', days: 365 },
]

interface Insight { icon: any; text: string; tone: 'gold' | 'green' | 'rose' | 'neutral' }

export default function CommandCenter({
  resumen, planState, legend, onExplore,
}: { resumen: any; planState: any; legend: boolean; onExplore: () => void }) {
  const insights: Insight[] = []
  const n = resumen?.nutricion

  // Proteína baja vs plan
  if (n?.proteinaPlan && n.proteinaPlan > 0) {
    const pct = (Number(n.proteinaConsumida || 0) / Number(n.proteinaPlan)) * 100
    if (pct < 60) insights.push({ icon: Drumstick, text: `Vas bajo en proteína hoy (${Math.round(pct)}% de tu meta).`, tone: 'rose' })
  }
  // Calorías restantes
  const target = resumen?.perfil?.dailyCalorieTarget || 0
  if (target > 0) {
    const rem = Math.max(0, target - Number(n?.caloriasConsumidas || 0))
    insights.push({ icon: Flame, text: `Te quedan ${rem} kcal para tu objetivo de hoy.`, tone: 'neutral' })
  }
  // Streak LEGEND + próximo milestone
  if (legend && planState?.powerDays != null) {
    insights.push({ icon: Crown, text: `Mantienes una racha de ${planState.powerDays} días LEGEND. 🔥`, tone: 'gold' })
    const next = MILESTONES.find(m => !(planState.milestones || []).includes(m.key))
    if (next) insights.push({ icon: Trophy, text: `Te faltan ${next.days - planState.powerDays} días para tu próximo logro.`, tone: 'gold' })
  }
  // Recomendación de tienda
  insights.push({ icon: Tag, text: 'Tenemos productos recomendados para tu objetivo.', tone: 'green' })

  const toneCls: Record<Insight['tone'], string> = {
    gold: 'text-amber-600 bg-amber-50 border-amber-200',
    green: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    rose: 'text-rose-600 bg-rose-50 border-rose-200',
    neutral: 'text-neutral-600 bg-neutral-50 border-neutral-200',
  }

  return (
    <aside className="hidden xl:flex w-80 shrink-0 flex-col border-l border-black/10 bg-white/70 backdrop-blur p-4 overflow-y-auto">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-4 h-4 text-violet-500" />
        <span className="text-sm font-bold text-neutral-800">Command Center</span>
      </div>
      <div className="space-y-2.5">
        {insights.map((it, i) => {
          const Icon = it.icon
          return (
            <div key={i} className={`flex items-start gap-2.5 rounded-xl border p-3 ${toneCls[it.tone]}`}>
              <Icon className="w-4 h-4 mt-0.5 shrink-0" />
              <p className="text-[13px] leading-snug">{it.text}</p>
            </div>
          )
        })}
      </div>
      <button onClick={onExplore} className="mt-4 w-full rounded-xl bg-neutral-900 text-white text-sm font-semibold py-2.5 hover:bg-black">
        Ver recomendaciones
      </button>
    </aside>
  )
}
