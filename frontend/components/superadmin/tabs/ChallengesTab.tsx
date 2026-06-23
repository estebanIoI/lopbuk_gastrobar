'use client'

/**
 * ChallengesTab — Panel superadmin de retos de temporada (F5.1).
 * Programa retos (métrica + meta + ventana), lista y cancela.
 */
import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Target, Plus, Ban, Power, Gift } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'

const METRIC_LABEL: Record<string, string> = { streak: '🔥 Días activos', drops: '⚡ Drops', achievements: '🏅 Logros' }
const UNLOCKS = ['', 'inner_circle', 'secret_theme', 'hidden_catalog', 'drops', 'leaderboard', 'coach_room']
const fmt = (d?: string) => (d ? new Date(d).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—')

export function ChallengesTab() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [err, setErr] = useState('')
  const [f, setF] = useState({ title: '', description: '', metric: 'streak', goalValue: '7', reward: '', rewardUnlock: '', startsAt: '', endsAt: '' })

  const load = useCallback(async () => {
    setLoading(true)
    const r = await api.adminListChallenges()
    if (r.success) setItems(r.data || [])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!f.title.trim() || !f.startsAt || !f.endsAt || !f.goalValue) { setErr('Completa título, meta y fechas.'); return }
    setCreating(true); setErr('')
    const r = await api.adminCreateChallenge({
      title: f.title.trim(), description: f.description.trim() || undefined, metric: f.metric,
      goalValue: Number(f.goalValue), reward: f.reward.trim() || undefined, rewardUnlock: f.rewardUnlock || undefined,
      startsAt: new Date(f.startsAt).toISOString(), endsAt: new Date(f.endsAt).toISOString(),
    } as any)
    setCreating(false)
    if (!r.success) { setErr(r.error || 'No se pudo crear'); return }
    setF({ title: '', description: '', metric: 'streak', goalValue: '7', reward: '', rewardUnlock: '', startsAt: '', endsAt: '' })
    load()
  }
  const setStatus = async (id: string, status: 'active' | 'cancelled') => { await api.adminUpdateChallenge(id, { status }); load() }
  const settle = async (id: string) => {
    if (!confirm('¿Premiar a quienes alcanzaron la meta? Otorga el unlock + badge y publica en el feed.')) return
    const r = await api.adminSettleChallenge(id)
    if (r.success) alert(`Liquidado. Ganadores premiados: ${r.data?.winners ?? 0}`)
    else alert(r.error || 'No se pudo liquidar')
    load()
  }

  const isActive = (c: any) => c.status === 'active' && new Date(c.endsAt).getTime() > Date.now()

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-violet-500" /> Nuevo reto de temporada</CardTitle>
          <CardDescription>Un reto comunitario con métrica, meta y ventana de tiempo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div><Label className="text-xs">Título</Label><Input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="Summer Cut Challenge" /></div>
            <div><Label className="text-xs">Recompensa (opcional)</Label><Input value={f.reward} onChange={e => setF({ ...f, reward: e.target.value })} placeholder="Vault Key Inner Circle" /></div>
          </div>
          <div><Label className="text-xs">Descripción</Label><Input value={f.description} onChange={e => setF({ ...f, description: e.target.value })} placeholder="Mantén tu racha 21 días" /></div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Métrica</Label>
              <select value={f.metric} onChange={e => setF({ ...f, metric: e.target.value })} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                <option value="streak">Días activos</option>
                <option value="drops">Drops reclamados</option>
                <option value="achievements">Logros</option>
              </select>
            </div>
            <div><Label className="text-xs">Meta</Label><Input value={f.goalValue} onChange={e => setF({ ...f, goalValue: e.target.value.replace(/[^0-9]/g, '') })} placeholder="21" /></div>
            <div className="grid grid-cols-1 gap-1">
              <Label className="text-xs">Inicio / Fin</Label>
              <Input type="datetime-local" value={f.startsAt} onChange={e => setF({ ...f, startsAt: e.target.value })} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><Label className="text-xs">Fin</Label><Input type="datetime-local" value={f.endsAt} onChange={e => setF({ ...f, endsAt: e.target.value })} /></div>
            <div>
              <Label className="text-xs">Premio: desbloqueo (al ganar)</Label>
              <select value={f.rewardUnlock} onChange={e => setF({ ...f, rewardUnlock: e.target.value })} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                {UNLOCKS.map(u => <option key={u || 'none'} value={u}>{u || 'Sin desbloqueo'}</option>)}
              </select>
            </div>
          </div>
          {err && <p className="text-sm text-red-500">{err}</p>}
          <Button onClick={create} disabled={creating}>
            {creating ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />} Crear reto
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Retos</CardTitle>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">Aún no has creado retos.</p>
          ) : (
            <div className="space-y-2">
              {items.map(c => (
                <div key={c.id} className="border rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-foreground">{c.title}</p>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isActive(c) ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-200 text-neutral-500'}`}>{isActive(c) ? 'Activo' : c.status === 'cancelled' ? 'Cancelado' : 'Cerrado'}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{METRIC_LABEL[c.metric] || c.metric} · meta {c.goalValue} · {fmt(c.startsAt)} → {fmt(c.endsAt)}{c.reward ? ` · 🎁 ${c.reward}` : ''}{c.rewardUnlock ? ` · 🔑 ${c.rewardUnlock}` : ''}{c.settledAt ? ' · ✅ premiado' : ''}</p>
                  </div>
                  <div className="shrink-0 flex gap-1.5">
                    {!c.settledAt && c.status !== 'cancelled' && (
                      <Button size="sm" onClick={() => settle(c.id)} className="bg-violet-600 hover:bg-violet-700"><Gift className="h-3.5 w-3.5 mr-1" /> Premiar</Button>
                    )}
                    {c.status === 'cancelled'
                      ? <Button size="sm" variant="outline" onClick={() => setStatus(c.id, 'active')}><Power className="h-3.5 w-3.5 mr-1" /> Reactivar</Button>
                      : <Button size="sm" variant="outline" className="text-red-600" onClick={() => setStatus(c.id, 'cancelled')}><Ban className="h-3.5 w-3.5 mr-1" /> Cancelar</Button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
