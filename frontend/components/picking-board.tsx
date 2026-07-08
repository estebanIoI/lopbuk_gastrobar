"use client"

/**
 * Tablero de Picking (ferretería F3) — la cola de preparación de la bodega.
 *
 * Tres columnas: Pendientes → En preparación → Preparadas hoy.
 * El auxiliar TOMA una tarea, recorre la bodega guiado por las ubicaciones
 * (ordenadas = ruta dentro de la bodega) y la marca PREPARADA antes de que
 * llegue el vehículo. Abajo: productividad del equipo (tareas + tiempo promedio).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { useStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import {
  ClipboardList, Loader2, RefreshCw, Hand, CheckCircle2, X, MapPin,
  Timer, Trophy, PackageOpen, Zap,
} from 'lucide-react'

interface PickingItem { productId: string; productName: string; quantity: number; location: string | null }
interface PickingTask {
  id: string; orderId: string; orderNumber: string; customerName?: string
  sedeId?: string | null; sedeName?: string | null
  items: PickingItem[]; status: string; priority: number; notes?: string
  assignedTo?: string | null; assignedToName?: string | null
  takenAt?: string | null; completedAt?: string | null; createdAt: string
  dispatchStatus?: string
}

export function PickingBoard() {
  const { sedes, fetchSedes } = useStore()
  const [board, setBoard] = useState<{ pendientes: PickingTask[]; enPreparacion: PickingTask[]; preparadasHoy: PickingTask[] } | null>(null)
  const [productivity, setProductivity] = useState<any[]>([])
  const [sedeFilter, setSedeFilter] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [actingId, setActingId] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [bRes, pRes] = await Promise.all([
        api.getPickingBoard(sedeFilter || undefined),
        api.getPickingProductivity(30),
      ])
      if (bRes.success && bRes.data) setBoard(bRes.data as any)
      if (pRes.success && Array.isArray(pRes.data)) setProductivity(pRes.data)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [sedeFilter])

  useEffect(() => { if (!sedes.length) fetchSedes() }, [sedes.length, fetchSedes])
  useEffect(() => { load() }, [load])

  // Refresco periódico: la bodega es un ambiente compartido (varios auxiliares)
  useEffect(() => {
    pollRef.current = setInterval(() => load(true), 20000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [load])

  const generate = async () => {
    setGenerating(true)
    try {
      const res = await api.generatePendingPickingTasks()
      if (res.success) {
        const n = (res.data as any)?.created ?? 0
        toast.success(n > 0 ? `${n} tarea${n !== 1 ? 's' : ''} de picking creada${n !== 1 ? 's' : ''}` : 'No hay pedidos confirmados sin tarea')
        await load(true)
      }
    } finally {
      setGenerating(false)
    }
  }

  const act = async (id: string, fn: () => Promise<any>, okMsg: string) => {
    setActingId(id)
    try {
      const res = await fn()
      if (res.success) { toast.success(okMsg); await load(true) }
      else toast.error((res as any).error || (res as any).message || 'No se pudo')
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo')
    } finally {
      setActingId(null)
    }
  }

  const cols: { key: 'pendientes' | 'enPreparacion' | 'preparadasHoy'; title: string; accent: string }[] = [
    { key: 'pendientes', title: 'Pendientes', accent: 'border-t-amber-500' },
    { key: 'enPreparacion', title: 'En preparación', accent: 'border-t-blue-500' },
    { key: 'preparadasHoy', title: 'Preparadas hoy', accent: 'border-t-green-500' },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-foreground flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" /> Picking de bodega
          </h2>
          <p className="text-sm text-muted-foreground">Prepara los pedidos antes de que llegue el vehículo — nunca esperar</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {sedes.length >= 2 && (
            <select
              value={sedeFilter}
              onChange={e => setSedeFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Todas las sedes</option>
              {sedes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <Button variant="outline" size="sm" className="h-9 gap-1" onClick={() => load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" className="h-9 gap-1" onClick={generate} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Generar desde pedidos
          </Button>
        </div>
      </div>

      {/* Tablero */}
      {loading && !board ? (
        <div className="flex justify-center py-14"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {cols.map(col => {
            const tasks = board?.[col.key] || []
            return (
              <div key={col.key} className={`rounded-lg border border-border border-t-4 ${col.accent} bg-secondary/20`}>
                <div className="px-3 py-2 flex items-center justify-between border-b border-border">
                  <span className="text-sm font-semibold text-foreground">{col.title}</span>
                  <span className="text-xs bg-secondary rounded-full px-2 py-0.5 text-muted-foreground">{tasks.length}</span>
                </div>
                <div className="p-2 space-y-2 min-h-[120px] max-h-[60vh] overflow-y-auto">
                  {tasks.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <PackageOpen className="h-6 w-6 mx-auto opacity-30 mb-1" />
                      <p className="text-xs">Sin tareas</p>
                    </div>
                  ) : tasks.map(t => (
                    <TaskCard key={t.id} task={t} busy={actingId === t.id}
                      onTake={() => act(t.id, () => api.takePickingTask(t.id), `Tarea ${t.orderNumber} tomada — ¡a recorrer la bodega!`)}
                      onComplete={() => act(t.id, () => api.completePickingTask(t.id), `${t.orderNumber} preparado — listo para cargar`)}
                      onCancel={() => act(t.id, () => api.cancelPickingTask(t.id), 'Tarea cancelada')}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Productividad del equipo */}
      {productivity.length > 0 && (
        <Card className="border-border">
          <CardContent className="p-3 lg:p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-2">
              <Trophy className="h-3.5 w-3.5 text-amber-500" /> Productividad del equipo (últimos 30 días)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {productivity.map((p, idx) => (
                <div key={p.userId} className="flex items-center gap-2 rounded-md bg-secondary/40 px-3 py-2">
                  <span className={`text-sm font-bold w-5 ${idx === 0 ? 'text-amber-500' : 'text-muted-foreground'}`}>{idx + 1}º</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {p.completedTasks} preparadas · {p.completedToday} hoy
                      {p.avgMinutes !== null && ` · ⏱ ${p.avgMinutes} min prom.`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function TaskCard({ task, busy, onTake, onComplete, onCancel }: {
  task: PickingTask; busy: boolean; onTake: () => void; onComplete: () => void; onCancel: () => void
}) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (task.status !== 'en_preparacion') return
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [task.status])

  const elapsedMin = task.takenAt ? Math.max(0, Math.round((now - new Date(task.takenAt).getTime()) / 60000)) : null
  const prepMin = task.takenAt && task.completedAt
    ? Math.max(0, Math.round((new Date(task.completedAt).getTime() - new Date(task.takenAt).getTime()) / 60000))
    : null
  const waitingMin = task.status === 'pendiente'
    ? Math.max(0, Math.round((now - new Date(task.createdAt).getTime()) / 60000))
    : null

  return (
    <div className="rounded-md border border-border bg-card p-2.5 space-y-1.5">
      <div className="flex items-center justify-between gap-1">
        <span className="text-sm font-semibold text-foreground">{task.orderNumber}</span>
        <span className="text-[10px] text-muted-foreground">
          {task.status === 'pendiente' && waitingMin !== null && (
            <span className={waitingMin > 30 ? 'text-red-500 font-medium' : ''}>espera {waitingMin} min</span>
          )}
          {task.status === 'en_preparacion' && elapsedMin !== null && (
            <span className="inline-flex items-center gap-0.5 text-blue-600"><Timer className="h-3 w-3" /> {elapsedMin} min</span>
          )}
          {task.status === 'preparada' && prepMin !== null && (
            <span className="text-green-600">⏱ {prepMin} min</span>
          )}
        </span>
      </div>

      <p className="text-[11px] text-muted-foreground truncate">
        {task.customerName || 'Cliente'}{task.sedeName ? ` · 📍 ${task.sedeName}` : ''}
        {task.assignedToName ? ` · 👤 ${task.assignedToName}` : ''}
      </p>

      {/* Lista de recorrido: ítems ordenados por ubicación */}
      <div className="space-y-0.5">
        {task.items.slice(0, 6).map((i, idx) => (
          <div key={idx} className="flex items-center justify-between text-[11px]">
            <span className="text-foreground truncate flex-1">{i.productName} <span className="text-muted-foreground">× {i.quantity}</span></span>
            {i.location ? (
              <span className="inline-flex items-center gap-0.5 text-primary font-mono shrink-0 ml-1">
                <MapPin className="h-2.5 w-2.5" /> {i.location}
              </span>
            ) : (
              <span className="text-muted-foreground/50 shrink-0 ml-1">sin ubic.</span>
            )}
          </div>
        ))}
        {task.items.length > 6 && <p className="text-[10px] text-muted-foreground">+{task.items.length - 6} ítems más…</p>}
      </div>

      <div className="flex gap-1.5 pt-0.5">
        {task.status === 'pendiente' && (
          <>
            <Button size="sm" className="h-7 text-xs gap-1 flex-1" disabled={busy} onClick={onTake}>
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Hand className="h-3 w-3" />} Tomar
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs text-red-500 border-red-300" disabled={busy} onClick={onCancel}>
              <X className="h-3 w-3" />
            </Button>
          </>
        )}
        {task.status === 'en_preparacion' && (
          <Button size="sm" className="h-7 text-xs gap-1 flex-1 bg-green-600 hover:bg-green-700" disabled={busy} onClick={onComplete}>
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />} Preparado ✓
          </Button>
        )}
        {task.status === 'preparada' && (
          <p className="text-[10px] text-green-600 font-medium flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Listo para cargar{task.dispatchStatus && task.dispatchStatus !== 'pendiente' ? ` · ${task.dispatchStatus}` : ''}</p>
        )}
      </div>
    </div>
  )
}
