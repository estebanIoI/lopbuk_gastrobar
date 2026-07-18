'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Search, Dumbbell, Eye, EyeOff, Loader2, TrendingUp } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
const LIMIT = 48

interface Exercise {
  id: string
  name: string
  body_part?: string | null
  equipment?: string | null
  target?: string | null
  image_url?: string | null
  gif_url?: string | null
  is_active: number
}

interface FilterOption { value: string; count: number }

interface LibraryStats {
  total: number; active: number; usedLast7Days: number; neverUsed: number
  inRoutines: number; completedSessions: number; totalVolume: number
  top: Array<{ id: string; name: string; uses: number; users: number; gif_url?: string | null }>
  byBodyPart: FilterOption[]
}

/** Panel de analíticas de la librería (P6): qué se usa y qué está muerto. */
function StatsPanel({ stats }: { stats: LibraryStats }) {
  const cards = [
    { label: 'Ejercicios', value: stats.total, hint: `${stats.active} activos` },
    { label: 'En rutinas', value: stats.inRoutines, hint: 'publicados o en borrador' },
    { label: 'Usados (7 días)', value: stats.usedLast7Days, hint: 'ejercicios distintos' },
    { label: 'Nunca usados', value: stats.neverUsed, hint: 'candidatos a limpiar' },
  ]
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(c => (
          <Card key={c.label} className="p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{c.label}</p>
            <p className="text-2xl font-bold tabular-nums leading-tight">{c.value.toLocaleString('es-CO')}</p>
            <p className="text-[10px] text-muted-foreground">{c.hint}</p>
          </Card>
        ))}
      </div>
      {stats.top.length > 0 && (
        <Card className="p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" /> Más usados
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {stats.top.map(t => (
              <div key={t.id} className="shrink-0 w-24 text-center">
                <div className="aspect-square rounded-md bg-muted overflow-hidden mb-1">
                  {t.gif_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.gif_url} alt={t.name} loading="lazy" className="w-full h-full object-cover" />
                  )}
                </div>
                <p className="text-[10px] font-medium leading-tight line-clamp-2 capitalize">{t.name}</p>
                <p className="text-[10px] text-muted-foreground">{t.uses} usos</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

export function ExercisesTab() {
  const [items, setItems] = useState<Exercise[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [bodyPart, setBodyPart] = useState('')
  const [equipment, setEquipment] = useState('')
  const [filters, setFilters] = useState<{ bodyParts: FilterOption[]; equipment: FilterOption[] }>({ bodyParts: [], equipment: [] })
  const [stats, setStats] = useState<LibraryStats | null>(null)
  const offsetRef = useRef(0)

  // Debounce del buscador
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    fetch(`${API_URL}/exercises/filters`).then(r => r.json()).then(j => { if (j.success) setFilters(j.data) }).catch(() => {})
    fetch(`${API_URL}/exercises/stats`).then(r => r.json()).then(j => { if (j.success) setStats(j.data) }).catch(() => {})
  }, [])

  const fetchPage = useCallback(async (off: number, reset: boolean) => {
    setLoading(true)
    const qs = new URLSearchParams({ limit: String(LIMIT), offset: String(off) })
    if (search) qs.set('search', search)
    if (bodyPart) qs.set('bodyPart', bodyPart)
    if (equipment) qs.set('equipment', equipment)
    try {
      const j = await fetch(`${API_URL}/exercises?${qs}`).then(r => r.json())
      if (j.success) {
        setTotal(j.total)
        setItems(prev => (reset ? j.data : [...prev, ...j.data]))
        offsetRef.current = off + j.data.length
      }
    } catch { /* silent */ }
    setLoading(false)
  }, [search, bodyPart, equipment])

  useEffect(() => { offsetRef.current = 0; fetchPage(0, true) }, [fetchPage])

  const toggle = async (ex: Exercise) => {
    const next = ex.is_active ? 0 : 1
    setItems(prev => prev.map(x => (x.id === ex.id ? { ...x, is_active: next } : x)))
    try {
      await fetch(`${API_URL}/exercises/${ex.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${api.getToken()}` },
        body: JSON.stringify({ isActive: !!next }),
      })
    } catch { /* revert on error */
      setItems(prev => prev.map(x => (x.id === ex.id ? { ...x, is_active: ex.is_active } : x)))
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2"><Dumbbell className="h-5 w-5 text-primary" /> Librería de ejercicios</h2>
        <p className="text-sm text-muted-foreground">{total} ejercicios con imagen de ejemplo. Búscalos, fíltralos y activa/oculta los que se usan en las rutinas.</p>
      </div>

      {/* Analíticas de la librería (P6) */}
      {stats && <StatsPanel stats={stats} />}

      {/* Buscador + filtros */}
      <Card className="p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Buscar por nombre, músculo…" className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setBodyPart('')} className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${bodyPart === '' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}>Todos</button>
          {filters.bodyParts.map(b => (
            <button key={b.value} onClick={() => setBodyPart(b.value)} className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${bodyPart === b.value ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}>
              {b.value} <span className="opacity-60">({b.count})</span>
            </button>
          ))}
        </div>
        {filters.equipment.length > 0 && (
          <select value={equipment} onChange={e => setEquipment(e.target.value)} className="h-9 text-sm border rounded-md bg-background px-2 w-full sm:w-64">
            <option value="">Todo el equipo</option>
            {filters.equipment.map(e => <option key={e.value} value={e.value}>{e.value} ({e.count})</option>)}
          </select>
        )}
      </Card>

      {/* Grid */}
      {items.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border border-dashed border-border rounded-lg">
          <Dumbbell className="h-10 w-10 mb-2 opacity-40" />
          <p className="text-sm">Sin ejercicios. Corre el seed: <code className="text-xs">npx ts-node src/db/seed-exercises.ts</code></p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {items.map(ex => (
            <Card key={ex.id} className={`overflow-hidden transition-opacity ${ex.is_active ? '' : 'opacity-50'}`}>
              <div className="aspect-square bg-muted relative">
                {ex.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ex.gif_url || ex.image_url} alt={ex.name} loading="lazy" className="w-full h-full object-cover" />
                )}
                <button
                  onClick={() => toggle(ex)}
                  title={ex.is_active ? 'Ocultar' : 'Activar'}
                  className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white hover:bg-black/80"
                >
                  {ex.is_active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </button>
              </div>
              <div className="p-2">
                <p className="text-xs font-medium leading-tight line-clamp-2 capitalize">{ex.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{ex.body_part}{ex.equipment ? ` · ${ex.equipment}` : ''}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="flex justify-center py-2">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : items.length < total ? (
          <Button variant="outline" size="sm" onClick={() => fetchPage(offsetRef.current, false)}>Cargar más ({items.length}/{total})</Button>
        ) : null}
      </div>
    </div>
  )
}
