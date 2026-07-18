'use client'

/**
 * training-session.tsx
 * Mobile-first session player. El usuario registra series, ve el timer
 * de descanso automático y puede navegar entre ejercicios.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { Play, Pause, SkipForward, SkipBack, Check, Plus, Timer, Dumbbell, ChevronRight, X, List, Flag } from 'lucide-react'
import { api } from '@/lib/api'

interface SessionExercise {
  sessionExerciseId: string
  exerciseId: string
  exerciseName: string
  sets: SessionSet[]
  sortOrder: number
  notes?: string
}

interface SessionSet {
  id?: string
  setNumber: number
  weightKg: number | null
  reps: number | null
  rpe: number | null
  isWarmup: boolean
  isFailure: boolean
  isSkipped: boolean
  isExtra: boolean
}

export function TrainingSessionPlayer({ assignment, onEnd }: { assignment?: any; onEnd?: () => void }) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [exercises, setExercises] = useState<SessionExercise[]>([])
  const [currentExIdx, setCurrentExIdx] = useState(0)
  const [loading, setLoading] = useState(false)
  const [timerActive, setTimerActive] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [showExerciseList, setShowExerciseList] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const currentEx = exercises[currentExIdx]

  const initSession = useCallback(async () => {
    if (assignment) {
      const firstDay = assignment.template?.exercises?.[0]?.days?.[0]
      if (!firstDay) return
      const exs: any[] = firstDay.exercises || []
      setExercises(exs.map((e: any, i: number) => ({
        sessionExerciseId: '',
        exerciseId: e.exerciseId || e.exercise?.id || '',
        exerciseName: e.exercise?.name || e.exerciseName || `Ejercicio ${i+1}`,
        sets: Array.from({ length: e.targetSets || 3 }, (_, si) => ({
          setNumber: si + 1,
          weightKg: e.startWeight || null,
          reps: null,
          rpe: e.rpeTarget || null,
          isWarmup: si === 0,
          isFailure: false,
          isSkipped: false,
          isExtra: false,
        })),
        sortOrder: i,
      })))
    } else {
      // Quick start — solo push-ups como ejemplo
      setExercises([{
        sessionExerciseId: '',
        exerciseId: 'quick',
        exerciseName: 'Flexiones',
        sets: [
          { setNumber: 1, weightKg: null, reps: null, rpe: null, isWarmup: true, isFailure: false, isSkipped: false, isExtra: false },
          { setNumber: 2, weightKg: null, reps: null, rpe: null, isWarmup: false, isFailure: false, isSkipped: false, isExtra: false },
          { setNumber: 3, weightKg: null, reps: null, rpe: null, isWarmup: false, isFailure: false, isSkipped: false, isExtra: false },
        ],
        sortOrder: 0,
      }])
    }
  }, [assignment])

  useEffect(() => { initSession() }, [initSession])

  const startSession = async () => {
    setLoading(true)
    const r: any = await api.startTrainingSession(assignment?.memberId || '', {
      assignmentId: assignment?.id || null,
      exercises: exercises.map((e, i) => ({
        exerciseId: e.exerciseId,
        exerciseName: e.exerciseName,
        sortOrder: i,
      })),
    })
    setLoading(false)
    if (r.success && r.data) {
      const sid = r.data.id
      setSessionId(sid)
      // Update sessionExerciseIds from response
      const updated = exercises.map((ex, i) => ({
        ...ex,
        sessionExerciseId: r.data.exercises?.[i]?.id || ex.sessionExerciseId,
        sets: r.data.exercises?.[i]?.sets?.map((s: any, si: number) => ({
          ...ex.sets[si] || ex.sets[0],
          id: s.id,
          setNumber: s.setNumber,
        })) || ex.sets,
      }))
      setExercises(updated)
    }
  }

  const updateSet = (setIdx: number, field: string, value: any) => {
    setExercises(prev => prev.map((ex, i) => {
      if (i !== currentExIdx) return ex
      return {
        ...ex,
        sets: ex.sets.map((s, si) => si === setIdx ? { ...s, [field]: value } : s),
      }
    }))
  }

  const logSet = async (setIdx: number) => {
    const set = currentEx?.sets[setIdx]
    if (!sessionId || !currentEx?.sessionExerciseId) return

    const r = await api.logTrainingSet(sessionId, {
      sessionExerciseId: currentEx.sessionExerciseId,
      setNumber: set.setNumber,
      weightKg: set.weightKg,
      reps: set.reps,
      rpe: set.rpe,
      isWarmup: set.isWarmup,
      isFailure: set.isFailure,
      isSkipped: false,
    })
    if (r.success) {
      setExercises(prev => prev.map((ex, i) => {
        if (i !== currentExIdx) return ex
        return {
          ...ex,
          sets: ex.sets.map((s, si) => si === setIdx ? { ...s, id: r.data.id } : s),
        }
      }))
    }
  }

  const skipSet = (setIdx: number) => {
    setExercises(prev => prev.map((ex, i) => {
      if (i !== currentExIdx) return ex
      return {
        ...ex,
        sets: ex.sets.map((s, si) => si === setIdx ? { ...s, isSkipped: true } : s),
      }
    }))
  }

  const addSet = () => {
    setExercises(prev => prev.map((ex, i) => {
      if (i !== currentExIdx) return ex
      return {
        ...ex,
        sets: [...ex.sets, {
          setNumber: ex.sets.length + 1,
          weightKg: ex.sets[ex.sets.length - 1]?.weightKg || null,
          reps: null,
          rpe: null,
          isWarmup: false,
          isFailure: false,
          isSkipped: false,
          isExtra: true,
        }],
      }
    }))
  }

  const startRestTimer = () => {
    setTimerSeconds(0)
    setTimerActive(true)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTimerSeconds(prev => prev + 1)
    }, 1000)
  }

  const stopTimer = () => {
    setTimerActive(false)
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  const nextExercise = () => {
    if (currentExIdx < exercises.length - 1) {
      setCurrentExIdx(currentExIdx + 1)
      stopTimer()
    }
  }

  const prevExercise = () => {
    if (currentExIdx > 0) {
      setCurrentExIdx(currentExIdx - 1)
      stopTimer()
    }
  }

  const endSession = async () => {
    if (!sessionId) return
    stopTimer()
    setLoading(true)
    const r = await api.endTrainingSession(sessionId)
    setLoading(false)
    if (r.success) onEnd?.()
  }

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  if (!sessionId) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <Dumbbell className="w-12 h-12 text-violet-400 mb-4" />
        <div className="text-lg font-bold mb-1">Iniciar entrenamiento</div>
        <div className="text-sm text-gray-500 mb-6 text-center">
          {assignment ? `Plantilla: ${assignment.template?.name || ''}` : 'Entrenamiento libre'}
        </div>
        {exercises.length > 0 && (
          <div className="w-full max-w-sm mb-4 space-y-1">
            {exercises.map((e, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-gray-500 py-1">
                <div className="w-5 h-5 bg-violet-100 rounded-full flex items-center justify-center text-[10px] font-bold text-violet-600">{i+1}</div>
                <span>{e.exerciseName}</span>
                <span className="ml-auto text-xs text-gray-300">{e.sets.length}x</span>
              </div>
            ))}
          </div>
        )}
        <button onClick={startSession} disabled={loading}
          className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-8 py-3 rounded-xl font-bold text-sm flex items-center gap-2">
          <Play className="w-4 h-4" /> {loading ? 'Iniciando...' : 'Comenzar entrenamiento'}
        </button>
      </div>
    )
  }

  const completedSets = currentEx?.sets.filter(s => !s.isSkipped && (s.reps || s.weightKg || s.id)).length || 0
  const totalSets = currentEx?.sets.filter(s => !s.isSkipped).length || 0

  return (
    <div className="flex flex-col h-full max-w-md mx-auto">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-gray-100">
        <div>
          <div className="text-lg font-bold">Ejercicio {currentExIdx + 1}/{exercises.length}</div>
          <div className="text-xs text-gray-400">{completedSets}/{totalSets} series completadas</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowExerciseList(true)}
            className="p-2 rounded-lg hover:bg-gray-100"><List className="w-5 h-5 text-gray-500" /></button>
          <button onClick={endSession} disabled={loading}
            className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-xs font-medium">
            <Flag className="w-3.5 h-3.5" /> Finalizar
          </button>
        </div>
      </div>

      {/* Exercise name + timer */}
      <div className="px-4 py-3 bg-violet-50">
        <div className="text-base font-bold text-violet-800">{currentEx?.exerciseName}</div>
        {timerActive && (
          <div className="flex items-center gap-2 mt-2">
            <Timer className="w-5 h-5 text-violet-600 animate-pulse" />
            <div className="text-3xl font-bold text-violet-700 tabular-nums">
              {Math.floor(timerSeconds / 60)}:{String(timerSeconds % 60).padStart(2, '0')}
            </div>
            <button onClick={stopTimer}
              className="ml-2 p-1.5 bg-violet-200 hover:bg-violet-300 rounded-lg">
              <Pause className="w-4 h-4 text-violet-700" />
            </button>
          </div>
        )}
      </div>

      {/* Sets */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {currentEx?.sets.filter(s => !s.isSkipped).map((set, si) => (
          <div key={si} className={`p-3 rounded-xl border ${set.id ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200'}`}>
            <div className="flex items-center gap-1 mb-2">
              <span className="text-xs font-bold text-gray-400">Serie {set.setNumber}</span>
              {set.isWarmup && <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full">Calent.</span>}
              {set.isExtra && <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">Extra</span>}
              {set.id && <span className="ml-auto text-xs text-emerald-500 flex items-center gap-0.5"><Check className="w-3 h-3" /> Listo</span>}
              {!set.id && (
                <button onClick={() => skipSet(si)} className="ml-auto text-[10px] text-gray-300 hover:text-red-400">Saltar</button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <div className="text-[10px] text-gray-400 mb-1">Peso (kg)</div>
                <input type="number" value={set.weightKg ?? ''} onChange={e => updateSet(si, 'weightKg', e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-violet-400 text-center" placeholder="—" />
              </div>
              <div>
                <div className="text-[10px] text-gray-400 mb-1">Reps</div>
                <input type="number" value={set.reps ?? ''} onChange={e => updateSet(si, 'reps', e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-violet-400 text-center" placeholder="—" />
              </div>
              <div>
                <div className="text-[10px] text-gray-400 mb-1">RPE</div>
                <input type="number" value={set.rpe ?? ''} onChange={e => updateSet(si, 'rpe', e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-violet-400 text-center" placeholder="—" />
              </div>
            </div>

            {!set.id && (
              <div className="flex gap-2 mt-2">
                <label className="flex items-center gap-1 text-[10px] text-gray-500">
                  <input type="checkbox" checked={set.isFailure} onChange={e => updateSet(si, 'isFailure', e.target.checked)} /> Fallo
                </label>
                <button onClick={() => { logSet(si); startRestTimer() }}
                  className="ml-auto flex items-center gap-1 bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium">
                  <Check className="w-3 h-3" /> Registrar
                </button>
              </div>
            )}
          </div>
        ))}

        <button onClick={addSet}
          className="w-full py-2 border border-dashed border-gray-300 rounded-lg text-xs text-gray-400 hover:text-violet-600 hover:border-violet-300 flex items-center justify-center gap-1">
          <Plus className="w-3.5 h-3.5" /> Agregar serie extra
        </button>
      </div>

      {/* Navigation */}
      <div className="p-4 border-t border-gray-100 flex items-center gap-3">
        <button onClick={prevExercise} disabled={currentExIdx === 0}
          className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-30">
          <SkipBack className="w-5 h-5" />
        </button>
        {!timerActive ? (
          <button onClick={startRestTimer}
            className="flex-1 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white py-3 rounded-xl font-medium text-sm">
            <Timer className="w-4 h-4" /> Iniciar descanso
          </button>
        ) : (
          <button onClick={stopTimer}
            className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-medium text-sm">
            <Pause className="w-4 h-4" /> Detener descanso
          </button>
        )}
        <button onClick={nextExercise} disabled={currentExIdx >= exercises.length - 1}
          className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-30">
          <SkipForward className="w-5 h-5" />
        </button>
      </div>

      {/* Exercise list modal */}
      {showExerciseList && (
        <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/40" onClick={() => setShowExerciseList(false)}>
          <div className="bg-white rounded-t-2xl shadow-2xl w-full max-w-md max-h-[60vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="font-semibold text-sm">Ejercicios</div>
              <button onClick={() => setShowExerciseList(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-2">
              {exercises.map((e, i) => (
                <button key={i} onClick={() => { setCurrentExIdx(i); setShowExerciseList(false) }}
                  className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 ${i === currentExIdx ? 'bg-violet-50' : 'hover:bg-gray-50'}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${i === currentExIdx ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-500'}`}>{i+1}</div>
                  <div className="flex-1 text-sm font-medium">{e.exerciseName}</div>
                  <div className="text-xs text-gray-400">{e.sets.filter(s => !s.isSkipped && (s.reps || s.weightKg || s.id)).length}/{e.sets.filter(s => !s.isSkipped).length}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
