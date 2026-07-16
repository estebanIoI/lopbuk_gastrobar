'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, ArrowUp, ArrowDown, Search, Loader2, Dumbbell, ListChecks, Rocket, FilePlus2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { api } from '@/lib/api'
import { toast } from 'sonner'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
const EXEC_TYPES = ['NORMAL', 'SUPERSET', 'CIRCUIT', 'DROPSET', 'EMOM', 'AMRAP']

interface RoutineEx {
  exercise_id: string
  name: string
  image_url?: string | null
  gif_url?: string | null
  body_part?: string | null
  group_id?: string | null
  execution_type?: string
  target_sets: number
  target_reps: number
  start_weight: number
  rest_seconds?: number | null
}
interface Version {
  id: string; version: number; status: 'draft' | 'published' | 'archived'
  movement_pattern?: string | null; published_at?: string | null
  exercise_count?: number; exercises: RoutineEx[]
}
interface Routine {
  id: string; name: string; description?: string | null; goal: string
  is_active: number; sort_order: number; versions: Version[]
}
interface LibExercise {
  id: string; name: string; body_part?: string | null; equipment?: string | null
  image_url?: string | null; gif_url?: string | null
}

export function RoutinesTab() {
  const [routines, setRoutines] = useState<Routine[]>([])
  const [selId, setSelId] = useState<string | null>(null)
  const [detail, setDetail] = useState<Routine | null>(null)
  const [draftEx, setDraftEx] = useState<RoutineEx[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPattern, setNewPattern] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)

  const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${api.getToken()}` })
  const draft = detail?.versions.find(v => v.status === 'draft') || null
  const published = detail?.versions.find(v => v.status === 'published') || null

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const j = await fetch(`${API_URL}/routines`).then(r => r.json())
      if (j.success) setRoutines(j.data)
    } catch { /* silent */ }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const loadDetail = useCallback(async (id: string) => {
    try {
      const j = await fetch(`${API_URL}/routines/${id}`).then(r => r.json())
      if (j.success) {
        setDetail(j.data)
        const d = j.data.versions.find((v: Version) => v.status === 'draft')
        setDraftEx(d ? [...d.exercises] : [])
      }
    } catch { /* silent */ }
  }, [])
  useEffect(() => { if (selId) loadDetail(selId); else setDetail(null) }, [selId, loadDetail])

  const createRoutine = async () => {
    if (!newName.trim()) { toast.error('Ponle un nombre a la rutina'); return }
    try {
      const j = await fetch(`${API_URL}/routines`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ name: newName.trim(), movementPattern: newPattern || null }),
      }).then(r => r.json())
      if (j.success) { toast.success('Rutina creada (borrador v1)'); setNewName(''); setNewPattern(''); await load(); setSelId(j.data.id) }
      else toast.error(j.error || 'Error al crear')
    } catch { toast.error('Error de conexión') }
  }

  const removeRoutine = async (id: string) => {
    try {
      await fetch(`${API_URL}/routines/${id}`, { method: 'DELETE', headers: authHeaders() })
      toast.success('Rutina eliminada'); setSelId(null); load()
    } catch { toast.error('Error al eliminar') }
  }

  const openDraft = async () => {
    if (!selId) return
    try {
      const j = await fetch(`${API_URL}/routines/${selId}/draft`, { method: 'POST', headers: authHeaders() }).then(r => r.json())
      if (j.success) { toast.success('Borrador abierto'); setDetail(j.data); const d = j.data.versions.find((v: Version) => v.status === 'draft'); setDraftEx(d ? [...d.exercises] : []); load() }
      else toast.error(j.error || 'Error')
    } catch { toast.error('Error de conexión') }
  }

  const saveDraft = async () => {
    if (!draft) return
    setSaving(true)
    try {
      const j = await fetch(`${API_URL}/routines/versions/${draft.id}/exercises`, {
        method: 'PUT', headers: authHeaders(),
        body: JSON.stringify({
          exercises: draftEx.map(d => ({
            exerciseId: d.exercise_id, displayName: d.name,
            groupId: d.group_id || null, executionType: d.execution_type || 'NORMAL',
            targetSets: d.target_sets, targetReps: d.target_reps, startWeight: d.start_weight,
            restSeconds: d.rest_seconds ?? null,
          })),
        }),
      }).then(r => r.json())
      if (j.success) { toast.success('Borrador guardado'); setDetail(j.data); load() } else toast.error(j.error || 'Error al guardar')
    } catch { toast.error('Error de conexión') }
    setSaving(false)
  }

  const publish = async () => {
    if (!draft) return
    try {
      const j = await fetch(`${API_URL}/routines/versions/${draft.id}/publish`, { method: 'POST', headers: authHeaders() }).then(r => r.json())
      if (j.success) { toast.success(`v${draft.version} publicada`); setDetail(j.data); setDraftEx([]); load() }
      else toast.error(j.error || 'Error al publicar')
    } catch { toast.error('Error de conexión') }
  }

  const addExercise = (ex: LibExercise) => {
    setDraftEx(d => [...d, {
      exercise_id: ex.id, name: ex.name, image_url: ex.image_url, gif_url: ex.gif_url,
      body_part: ex.body_part, execution_type: 'NORMAL', group_id: null,
      target_sets: 3, target_reps: 12, start_weight: 0, rest_seconds: null,
    }])
    setPickerOpen(false)
  }
  const patch = (i: number, p: Partial<RoutineEx>) => setDraftEx(d => d.map((x, j) => (j === i ? { ...x, ...p } : x)))
  const move = (i: number, dir: -1 | 1) => setDraftEx(d => {
    const j = i + dir; if (j < 0 || j >= d.length) return d
    const c = [...d]; ;[c[i], c[j]] = [c[j], c[i]]; return c
  })

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2"><ListChecks className="h-5 w-5 text-primary" /> Rutinas</h2>
        <p className="text-sm text-muted-foreground">Versionadas: editas un <b>borrador</b> y al <b>publicar</b> se congela. Quien ya entrena con la versión anterior no se ve afectado.</p>
      </div>

      <Card className="p-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5 flex-1 min-w-[180px]">
          <Label className="text-xs">Nueva rutina</Label>
          <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ej: Tren superior" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Enfoque</Label>
          <select value={newPattern} onChange={e => setNewPattern(e.target.value)} className="h-9 text-sm border rounded-md bg-background px-2">
            <option value="">Full body</option>
            <option value="upper">Tren superior</option>
            <option value="lower">Tren inferior</option>
          </select>
        </div>
        <Button onClick={createRoutine} className="gap-1"><Plus className="h-4 w-4" /> Crear</Button>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        <Card className="p-3 space-y-2 h-fit">
          {loading && routines.length === 0 ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : routines.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aún no hay rutinas.</p>
          ) : routines.map(r => {
            const pub = r.versions.find(v => v.status === 'published')
            const dr = r.versions.find(v => v.status === 'draft')
            return (
              <button key={r.id} onClick={() => setSelId(r.id)}
                className={`w-full text-left rounded-lg border p-3 transition-colors ${selId === r.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'}`}>
                <span className="text-sm font-medium truncate block">{r.name}</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {pub && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600">v{pub.version} publicada</span>}
                  {dr && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600">v{dr.version} borrador</span>}
                  {!pub && !dr && <span className="text-[9px] text-muted-foreground">sin versiones</span>}
                </div>
              </button>
            )
          })}
        </Card>

        <Card className="p-4">
          {!detail ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Dumbbell className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-sm">Elige una rutina para editarla.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{detail.name}</h3>
                  <p className="text-[11px] text-muted-foreground">
                    {published ? `Publicada: v${published.version}` : 'Sin versión publicada'}
                    {draft ? ` · Editando borrador v${draft.version}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  {draft ? (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)} className="gap-1"><Plus className="h-4 w-4" /> Ejercicio</Button>
                      <Button size="sm" variant="outline" onClick={saveDraft} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
                      <Button size="sm" onClick={publish} className="gap-1"><Rocket className="h-4 w-4" /> Publicar v{draft.version}</Button>
                    </>
                  ) : (
                    <Button size="sm" onClick={openDraft} className="gap-1"><FilePlus2 className="h-4 w-4" /> Nuevo borrador</Button>
                  )}
                  <Button size="sm" variant="ghost" className="text-destructive/70 hover:text-destructive" onClick={() => removeRoutine(detail.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>

              {!draft ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    {published
                      ? `v${published.version} está publicada e inmutable (${published.exercises.length} ejercicios). Abre un borrador para cambiarla.`
                      : 'Abre un borrador para agregar ejercicios.'}
                  </p>
                </div>
              ) : draftEx.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">Borrador vacío. Agrega el primer ejercicio.</p>
              ) : draftEx.map((d, i) => (
                <div key={`${d.exercise_id}-${i}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2">
                  {d.gif_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.gif_url} alt={d.name} loading="lazy" className="w-12 h-12 rounded-md object-cover bg-muted shrink-0" />
                  )}
                  <div className="flex-1 min-w-[140px]">
                    <Input value={d.name} onChange={e => patch(i, { name: e.target.value })} className="h-7 text-xs" />
                    <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{d.body_part} · #{d.exercise_id}</p>
                  </div>
                  <select value={d.execution_type || 'NORMAL'} onChange={e => patch(i, { execution_type: e.target.value })} className="h-7 text-[10px] border rounded bg-background px-1" title="Tipo de ejecución">
                    {EXEC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <Input value={d.group_id || ''} onChange={e => patch(i, { group_id: e.target.value || null })} placeholder="A1" className="h-7 w-12 text-xs" title="Grupo (superserie)" />
                  <div className="flex items-center gap-1">
                    <Input type="number" min={1} value={d.target_sets} onChange={e => patch(i, { target_sets: Number(e.target.value) || 1 })} className="h-7 w-11 text-xs" title="Series" />
                    <span className="text-[10px] text-muted-foreground">×</span>
                    <Input type="number" min={1} value={d.target_reps} onChange={e => patch(i, { target_reps: Number(e.target.value) || 1 })} className="h-7 w-11 text-xs" title="Reps" />
                    <Input type="number" min={0} step="0.5" value={d.start_weight} onChange={e => patch(i, { start_weight: Number(e.target.value) || 0 })} className="h-7 w-14 text-xs" title="Peso inicial (kg)" />
                    <Input type="number" min={0} value={d.rest_seconds ?? ''} onChange={e => patch(i, { rest_seconds: e.target.value ? Number(e.target.value) : null })} placeholder="s" className="h-7 w-12 text-xs" title="Descanso (seg)" />
                  </div>
                  <div className="flex flex-col shrink-0">
                    <button onClick={() => move(i, -1)} disabled={i === 0} className="disabled:opacity-30 text-muted-foreground hover:text-foreground"><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button onClick={() => move(i, 1)} disabled={i === draftEx.length - 1} className="disabled:opacity-30 text-muted-foreground hover:text-foreground"><ArrowDown className="h-3.5 w-3.5" /></button>
                  </div>
                  <button onClick={() => setDraftEx(x => x.filter((_, j) => j !== i))} className="text-destructive/60 hover:text-destructive shrink-0"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <ExercisePicker open={pickerOpen} onOpenChange={setPickerOpen} onPick={addExercise} />
    </div>
  )
}

function ExercisePicker({ open, onOpenChange, onPick }: {
  open: boolean; onOpenChange: (v: boolean) => void; onPick: (ex: LibExercise) => void
}) {
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<LibExercise[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { const t = setTimeout(() => setSearch(q.trim()), 350); return () => clearTimeout(t) }, [q])
  useEffect(() => {
    if (!open) return
    setLoading(true)
    const qs = new URLSearchParams({ limit: '40', active: '1', lang: 'es' })
    if (search) qs.set('search', search)
    fetch(`${API_URL}/exercises?${qs}`).then(r => r.json())
      .then(j => { if (j.success) setItems(j.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open, search])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Elegir ejercicio</DialogTitle></DialogHeader>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar en la librería…" className="pl-9" autoFocus />
        </div>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Sin resultados.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {items.map(ex => (
              <button key={ex.id} onClick={() => onPick(ex)} className="text-left rounded-lg border border-border overflow-hidden hover:border-primary transition-colors">
                <div className="aspect-square bg-muted">
                  {ex.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ex.gif_url || ex.image_url} alt={ex.name} loading="lazy" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="p-1.5">
                  <p className="text-[11px] font-medium leading-tight line-clamp-2 capitalize">{ex.name}</p>
                  <p className="text-[9px] text-muted-foreground capitalize">{ex.body_part}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
