'use client'

/**
 * WorkoutSummary — pantalla de cierre. Renderiza el resumen que devuelve el
 * backend: duración, volumen, PRs y las DECISIONES del progression engine
 * (acción + próximo peso). El front no decide nada; solo lo muestra.
 */
import { TrendingUp, Minus, TrendingDown, Trophy, Clock, Layers, ArrowRight } from 'lucide-react'
import type { WorkoutSummary as Summary, ProgressionAction } from '@/lib/workout-api'

const ACTION: Record<ProgressionAction, { label: string; cls: string; Icon: typeof TrendingUp }> = {
  increase: { label: 'Sube peso', cls: 'text-emerald-400 bg-emerald-500/10', Icon: TrendingUp },
  maintain: { label: 'Mantén', cls: 'text-amber-300 bg-amber-400/10', Icon: Minus },
  decrease: { label: 'Baja peso', cls: 'text-rose-400 bg-rose-500/10', Icon: TrendingDown },
}

function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m} min${s ? ` ${s}s` : ''}` : `${s}s`
}

export default function WorkoutSummary({ summary, onClose }: { summary: Summary; onClose: () => void }) {
  const Stat = ({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) => (
    <div className="flex-1 rounded-2xl bg-white/[0.04] p-3 text-center">
      <div className="flex items-center justify-center text-amber-300 mb-1">{icon}</div>
      <p className="text-xl font-extrabold text-white leading-none">{value}</p>
      <p className="text-[11px] text-white/45 mt-1">{label}</p>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950 px-5 py-8">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/15 mb-3">
            <Trophy className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">¡Rutina completada!</h1>
          <p className="text-sm text-white/50 mt-1">Esto es evolucionar, no llenar formularios.</p>
        </div>

        <div className="flex gap-2.5 mb-3">
          <Stat icon={<Clock className="w-5 h-5" />} value={fmtDuration(summary.durationSeconds)} label="Duración" />
          <Stat icon={<Layers className="w-5 h-5" />} value={`${summary.totalVolume.toLocaleString()}`} label="Volumen (kg)" />
          <Stat icon={<Trophy className="w-5 h-5" />} value={`${summary.prCount}`} label="Récords" />
        </div>

        <h2 className="text-xs font-bold uppercase tracking-widest text-white/40 mt-6 mb-2">Tu progresión</h2>
        <div className="space-y-2">
          {summary.decisions.length === 0 && (
            <p className="text-sm text-white/40 py-4 text-center">No se registraron series completadas.</p>
          )}
          {summary.decisions.map((d) => {
            const a = ACTION[d.action]
            return (
              <div key={d.exerciseId} className="rounded-2xl bg-white/[0.04] p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-white">{d.name || d.exerciseId}</p>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${a.cls}`}>
                    <a.Icon className="w-3.5 h-3.5" /> {a.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2 text-sm">
                  <span className="text-white/50 tabular-nums">{d.currentWeight}kg</span>
                  <ArrowRight className="w-4 h-4 text-white/30" />
                  <span className="font-extrabold text-white tabular-nums">{d.nextWeight}kg</span>
                  <span className="text-[11px] text-white/40 ml-auto">próxima sesión</span>
                </div>
                {d.reasons[1] && <p className="text-[11px] text-white/40 mt-1.5">{d.reasons[1]}</p>}
              </div>
            )
          })}
        </div>

        <button onClick={onClose} className="w-full mt-7 rounded-2xl bg-amber-400 text-slate-900 font-bold py-3.5 active:scale-[0.98]">
          Volver al inicio
        </button>
      </div>
    </div>
  )
}
