'use client'

/**
 * WorkoutSessionScreen — modo entrenamiento inmersivo. Carga la sesión, deja
 * registrar series (con descanso automático), y al terminar muestra el resumen
 * con la progresión que decidió el backend. Cero lógica fitness en el cliente.
 */
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Loader2, Flag } from 'lucide-react'
import { workoutApi, type WorkoutSession, type WorkoutSummary as Summary } from '@/lib/workout-api'
import ExerciseCard from './ExerciseCard'
import RestTimer from './RestTimer'
import WorkoutSummaryView from './WorkoutSummary'

const REST_SECONDS = 90 // hipertrofia 60-90s

export default function WorkoutSessionScreen({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const [session, setSession] = useState<WorkoutSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [restOpen, setRestOpen] = useState(false)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [finishing, setFinishing] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    let on = true
    workoutApi.get(sessionId).then((r) => {
      if (!on) return
      if (r.success && r.data) setSession(r.data)
      else setError(r.error || 'No se pudo cargar la sesión')
      setLoading(false)
    })
    return () => { on = false }
  }, [sessionId])

  // Cronómetro de sesión
  useEffect(() => {
    if (!session?.startedAt || session.status !== 'active') return
    const start = new Date(session.startedAt).getTime()
    const tick = () => setElapsed(Math.max(0, Math.round((Date.now() - start) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [session?.startedAt, session?.status])

  const onSetComplete = useCallback(async (setId: string, reps: number, weight: number) => {
    const r = await workoutApi.completeSet(sessionId, setId, reps, weight)
    if (r.success && r.data) {
      setSession(r.data.session)
      setRestOpen(true)
      try { navigator.vibrate?.(30) } catch { /* noop */ }
    }
  }, [sessionId])

  const finish = async () => {
    if (finishing) return
    setFinishing(true)
    const r = await workoutApi.complete(sessionId)
    if (r.success && r.data) setSummary(r.data)
    else { setError(r.error || 'No se pudo completar'); setFinishing(false) }
  }

  const cancel = async () => {
    await workoutApi.cancel(sessionId)
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
      </div>
    )
  }
  if (error || !session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-6 text-center">
        <p className="text-white/70 mb-4">{error || 'Sesión no encontrada'}</p>
        <button onClick={() => router.push('/')} className="rounded-xl bg-amber-400 text-slate-900 font-bold px-5 py-2.5">Volver</button>
      </div>
    )
  }

  const totalSets = session.exercises.reduce((a, e) => a + e.sets.length, 0)
  const doneSets = session.exercises.reduce((a, e) => a + e.sets.filter((s) => s.completed).length, 0)
  const pct = totalSets ? Math.round((doneSets / totalSets) * 100) : 0
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')

  return (
    <div className="min-h-screen bg-slate-950 pb-28">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur border-b border-white/5 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <button onClick={cancel} className="flex items-center gap-1 text-white/60 text-sm font-medium active:text-white">
            <ChevronLeft className="w-5 h-5" /> Salir
          </button>
          <span className="text-white/80 font-bold tabular-nums">{mm}:{ss}</span>
        </div>
        <div className="mt-2">
          <div className="flex items-center justify-between mb-1.5">
            <h1 className="text-white font-extrabold">Modo entrenamiento</h1>
            <span className="text-[11px] text-white/45">{doneSets}/{totalSets} series · {pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {/* Ejercicios */}
      <div className="px-4 pt-4 space-y-3 max-w-md mx-auto">
        {session.exercises.map((ex, i) => (
          <ExerciseCard key={ex.id} exercise={ex} index={i} onSetComplete={onSetComplete} />
        ))}
      </div>

      {/* CTA finalizar */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent px-4 pt-6 pb-5">
        <div className="max-w-md mx-auto">
          <button
            onClick={finish}
            disabled={finishing}
            className="w-full rounded-2xl bg-amber-400 text-slate-900 font-extrabold py-3.5 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60"
          >
            {finishing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Flag className="w-5 h-5" />}
            {finishing ? 'Guardando…' : 'Completar entrenamiento'}
          </button>
        </div>
      </div>

      {restOpen && <RestTimer seconds={REST_SECONDS} onClose={() => setRestOpen(false)} />}
      {summary && <WorkoutSummaryView summary={summary} onClose={() => router.push('/')} />}
    </div>
  )
}
