'use client'

/**
 * exercise-library.tsx
 * Biblioteca profesional de ejercicios. Búsqueda instantánea, filtros,
 * vista detalle con GIF/video, favoritos.
 */
import { useState, useEffect, useCallback } from 'react'
import { Search, Filter, Dumbbell, Star, Play, ChevronRight, X, Zap, Timer, Gauge } from 'lucide-react'
import { api } from '@/lib/api'

const MUSCLE_GROUPS = ['pecho','espalda','pierna','hombro','biceps','triceps','core','cardio','movilidad']
const EQUIPMENT = ['barra','mancuerna','maquina','cable','polea','peso_corporal','banda','kettlebell']
const DIFFICULTIES = ['principiante','intermedio','avanzado']

export function ExerciseLibrary({ onSelect, compact, selectedId }: { onSelect?: (e: any) => void; compact?: boolean; selectedId?: string }) {
  const [exercises, setExercises] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<string,string>>({})
  const [showFilters, setShowFilters] = useState(false)
  const [detail, setDetail] = useState<any>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await api.listTrainingExercises({ search, ...filters })
    if (r.success && r.data) { setExercises(r.data.rows); setTotal(r.data.total) }
    setLoading(false)
  }, [search, filters])

  useEffect(() => { load() }, [load])

  const toggleFilter = (k: string, v: string) => {
    setFilters(prev => prev[k] === v ? Object.fromEntries(Object.entries(prev).filter(([key]) => key !== k)) : { ...prev, [k]: v })
  }

  const viewDetail = async (id: string) => {
    const r = await api.getTrainingExercise(id)
    if (r.success) setDetail(r.data)
  }

  return (
    <div className={compact ? '' : 'p-4'}>
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-violet-400"
            placeholder="Buscar ejercicios..." />
        </div>
        <button onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border ${showFilters || Object.keys(filters).length ? 'border-violet-300 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-600'}`}>
          <Filter className="w-3.5 h-3.5" /> Filtros
        </button>
        {onSelect && <button onClick={() => onSelect(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>}
      </div>

      {showFilters && (
        <div className="mb-3 space-y-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
          <div className="text-[11px] font-medium text-gray-500 uppercase">Grupo Muscular</div>
          <div className="flex flex-wrap gap-1.5">
            {MUSCLE_GROUPS.map(g => (
              <button key={g} onClick={() => toggleFilter('muscleGroup', g)}
                className={`px-2.5 py-1 rounded-full text-xs ${filters.muscleGroup === g ? 'bg-violet-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>{g}</button>
            ))}
          </div>
          <div className="text-[11px] font-medium text-gray-500 uppercase mt-1">Equipo</div>
          <div className="flex flex-wrap gap-1.5">
            {EQUIPMENT.map(e => (
              <button key={e} onClick={() => toggleFilter('equipment', e)}
                className={`px-2.5 py-1 rounded-full text-xs ${filters.equipment === e ? 'bg-violet-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>{e.replace(/_/g,' ')}</button>
            ))}
          </div>
          <div className="text-[11px] font-medium text-gray-500 uppercase mt-1">Dificultad</div>
          <div className="flex flex-wrap gap-1.5">
            {DIFFICULTIES.map(d => (
              <button key={d} onClick={() => toggleFilter('difficulty', d)}
                className={`px-2.5 py-1 rounded-full text-xs ${filters.difficulty === d ? 'bg-violet-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>{d}</button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : exercises.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-400">
          <Dumbbell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          No se encontraron ejercicios
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {exercises.map((e: any) => (
            <button key={e.id} onClick={() => onSelect ? onSelect(e) : viewDetail(e.id)}
              className={`flex items-center gap-3 p-3 rounded-lg border text-left hover:bg-gray-50 transition-colors ${selectedId === e.id ? 'border-violet-300 bg-violet-50 ring-1 ring-violet-200' : 'border-gray-100'}`}>
              <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Dumbbell className="w-5 h-5 text-violet-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{e.name}</div>
                <div className="text-[11px] text-gray-400">{e.muscleGroup}{e.equipment ? ` · ${e.equipment}` : ''}</div>
              </div>
              <div className="flex items-center gap-1">
                {e.isFavorite && <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />}
                {!onSelect && <ChevronRight className="w-4 h-4 text-gray-300" />}
              </div>
            </button>
          ))}
        </div>
      )}

      {!compact && total > 0 && (
        <div className="mt-2 text-xs text-gray-400 text-center">{total} ejercicios</div>
      )}

      {detail && (
        <ExerciseDetailModal exercise={detail} onClose={() => setDetail(null)}
          onToggleFav={() => { api.toggleExerciseFavorite(detail.id); setDetail({ ...detail, isFavorite: !detail.isFavorite }) }} />
      )}
    </div>
  )
}

function ExerciseDetailModal({ exercise, onClose, onToggleFav }: any) {
  const media = exercise.media?.find((m: any) => m.kind === 'gif') || exercise.media?.[0]
  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between px-5 h-14 border-b border-gray-100 z-10">
          <h3 className="font-semibold text-sm">{exercise.name}</h3>
          <div className="flex items-center gap-2">
            <button onClick={onToggleFav} className={`p-1.5 rounded-lg ${exercise.isFavorite ? 'text-amber-500' : 'text-gray-300'}`}>
              <Star className={`w-5 h-5 ${exercise.isFavorite ? 'fill-amber-400' : ''}`} />
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {media && (
            <div className="bg-black rounded-xl overflow-hidden aspect-video flex items-center justify-center">
              {media.kind === 'gif' ? (
                <img src={media.url} alt={exercise.name} className="w-full h-full object-contain" />
              ) : media.kind === 'video' ? (
                <div className="flex items-center gap-2 text-white"><Play className="w-6 h-6" /> Ver video</div>
              ) : (
                <img src={media.url} alt={exercise.name} className="w-full h-full object-contain" />
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <InfoPill icon={Dumbbell} label="Grupo" value={exercise.muscleGroup} />
            <InfoPill icon={Zap} label="Equipo" value={exercise.equipment || '—'} />
            <InfoPill icon={Gauge} label="Nivel" value={exercise.difficulty} />
            {exercise.restSeconds && <InfoPill icon={Timer} label="Descanso" value={`${exercise.restSeconds}s`} />}
            {exercise.rpeRecommendation && <InfoPill icon={Gauge} label="RPE" value={String(exercise.rpeRecommendation)} />}
            {exercise.estimatedKcal && <InfoPill icon={Zap} label="Kcal" value={String(exercise.estimatedKcal)} />}
          </div>

          {exercise.description && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Descripción</div>
              <p className="text-sm text-gray-600">{exercise.description}</p>
            </div>
          )}

          {exercise.tips && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Tips</div>
              <p className="text-sm text-gray-600">{exercise.tips}</p>
            </div>
          )}

          {exercise.commonErrors && (
            <div>
              <div className="text-xs font-semibold text-red-500 uppercase mb-1">Errores comunes</div>
              <p className="text-sm text-red-600">{exercise.commonErrors}</p>
            </div>
          )}

          {exercise.tempo && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Tempo</div>
              <code className="text-sm bg-gray-100 px-2 py-1 rounded">{exercise.tempo}</code>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function InfoPill({ icon: Icon, label, value }: any) {
  return (
    <div className="bg-gray-50 rounded-lg p-2.5 text-center">
      <Icon className="w-3.5 h-3.5 mx-auto text-gray-400 mb-1" />
      <div className="text-xs font-medium">{value}</div>
      <div className="text-[10px] text-gray-400">{label}</div>
    </div>
  )
}
