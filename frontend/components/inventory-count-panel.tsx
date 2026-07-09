"use client"

/**
 * Conteo de inventario — exactitud físico vs. sistema (criterio "99%").
 * Abrir un conteo por bodega congela el esperado; el auxiliar captura lo contado;
 * al cerrar se aplica el ajuste auditado y se calcula el % de exactitud.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { useStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  ClipboardCheck, Plus, Loader2, Search, Check, X, ArrowLeft, MapPin,
  AlertTriangle, PackageCheck, RefreshCw,
} from 'lucide-react'

interface CountRow {
  id: string; countNumber: string; sedeId: string | null; sedeName: string | null
  status: string; accuracyPct: number | null; itemsTotal: number; itemsCounted: number; itemsDiff: number
  notes?: string; createdAt: string; closedAt?: string | null
}
interface CountItem {
  id: string; productId: string; productName: string; warehouseLocation: string | null
  expectedQty: number; countedQty: number | null; difference: number | null
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  abierto:   { label: 'Abierto',   cls: 'bg-blue-500/15 text-blue-600' },
  cerrado:   { label: 'Cerrado',   cls: 'bg-green-500/15 text-green-600' },
  cancelado: { label: 'Cancelado', cls: 'bg-zinc-500/15 text-zinc-500' },
}

export function InventoryCountPanel() {
  const { sedes, fetchSedes } = useStore()
  const [counts, setCounts] = useState<CountRow[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [openCountId, setOpenCountId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getInventoryCounts()
      if (res.success && Array.isArray(res.data)) setCounts(res.data as CountRow[])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { if (!sedes.length) fetchSedes() }, [sedes.length, fetchSedes])
  useEffect(() => { load() }, [load])

  if (openCountId) {
    return <CountDetail countId={openCountId} onBack={() => { setOpenCountId(null); load() }} />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-foreground flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" /> Conteo de inventario
          </h2>
          <p className="text-sm text-muted-foreground">Cuenta el físico, concilia contra el sistema y aplica el ajuste — mide tu exactitud</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9 gap-1" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" className="h-9 gap-1" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Nuevo conteo
          </Button>
        </div>
      </div>

      {loading && !counts.length ? (
        <div className="flex justify-center py-14"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : counts.length === 0 ? (
        <Card className="border-border">
          <CardContent className="flex flex-col items-center py-12 text-muted-foreground">
            <ClipboardCheck className="h-10 w-10 opacity-30 mb-3" />
            <p className="text-sm font-medium">Sin conteos todavía</p>
            <p className="text-xs mt-1">Crea el primero con "Nuevo conteo"</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {counts.map(c => {
            const meta = STATUS_META[c.status]
            return (
              <Card key={c.id} className="border-border hover:border-primary/40 cursor-pointer transition-colors" onClick={() => setOpenCountId(c.id)}>
                <CardContent className="p-3 flex items-center justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-sm">{c.countNumber}</span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${meta.cls}`}>{meta.label}</span>
                      {c.sedeName && <span className="text-[10px] text-muted-foreground inline-flex items-center gap-0.5"><MapPin className="h-3 w-3" /> {c.sedeName}</span>}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {c.itemsCounted}/{c.itemsTotal} contados · {c.itemsDiff} con diferencia · {new Date(c.createdAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                  {c.accuracyPct != null && (
                    <span className={`text-sm font-bold ${c.accuracyPct >= 99 ? 'text-green-600' : c.accuracyPct >= 95 ? 'text-amber-600' : 'text-red-600'}`}>
                      {c.accuracyPct}% exactitud
                    </span>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {creating && (
        <CreateCountModal
          sedes={sedes}
          onClose={() => setCreating(false)}
          onCreated={(id) => { setCreating(false); load(); setOpenCountId(id) }}
        />
      )}
    </div>
  )
}

function CreateCountModal({ sedes, onClose, onCreated }: { sedes: any[]; onClose: () => void; onCreated: (id: string) => void }) {
  const [sedeId, setSedeId] = useState(sedes[0]?.id || '')
  const [search, setSearch] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setSaving(true); setError('')
    try {
      const res = await api.createInventoryCount({ sedeId: sedeId || null, search: search.trim() || undefined, notes: notes.trim() || undefined })
      if (res.success) { toast.success(`Conteo ${(res.data as any)?.countNumber} abierto — ${(res.data as any)?.itemsTotal} ítems`); onCreated((res.data as any).id) }
      else setError((res as any).error || (res as any).message || 'No se pudo crear')
    } catch (e: any) { setError(e?.message || 'No se pudo crear') }
    finally { setSaving(false) }
  }

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle className="text-base">Nuevo conteo de inventario</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-1">
          {sedes.length >= 1 && (
            <div>
              <label className="text-xs text-muted-foreground">Bodega a contar</label>
              <select value={sedeId} onChange={e => setSedeId(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm mt-1">
                <option value="">Inventario general (sin sede)</option>
                {sedes.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs text-muted-foreground">Filtro de productos (opcional)</label>
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ej: cemento (para contar solo esa línea)" className="h-9 text-sm mt-1" />
            <p className="text-[10px] text-muted-foreground mt-1">Déjalo vacío para contar todos los productos de la bodega.</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Notas (opcional)</label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} className="h-9 text-sm mt-1" />
          </div>
          {error && <p className="text-xs text-red-500 bg-red-500/10 rounded-md px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" onClick={submit} disabled={saving} className="gap-1">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Abrir conteo
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CountDetail({ countId, onBack }: { countId: string; onBack: () => void }) {
  const [data, setData] = useState<{ count: any; items: CountItem[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getInventoryCount(countId)
      if (res.success) setData(res.data as any)
    } finally { setLoading(false) }
  }, [countId])
  useEffect(() => { load() }, [load])

  const setCounted = async (item: CountItem, value: string) => {
    const qty = value === '' ? null : Math.max(0, Number(value) || 0)
    setSavingId(item.id)
    try {
      const res = await api.setInventoryCountItem(countId, item.id, qty)
      if (res.success) {
        setData(d => d ? {
          ...d,
          items: d.items.map(i => i.id === item.id ? { ...i, countedQty: qty, difference: qty != null ? qty - i.expectedQty : null } : i),
        } : d)
      }
    } finally { setSavingId(null) }
  }

  const close = async () => {
    if (!confirm('Al cerrar se aplicará el ajuste al inventario. ¿Continuar?')) return
    setClosing(true)
    try {
      const res = await api.closeInventoryCount(countId)
      if (res.success) {
        const r = res.data as any
        toast.success(`Conteo cerrado — ${r.accuracyPct}% exactitud, ${r.itemsAdjusted} ajustes aplicados`)
        onBack()
      } else toast.error((res as any).error || (res as any).message || 'No se pudo cerrar')
    } catch (e: any) { toast.error(e?.message || 'No se pudo cerrar') }
    finally { setClosing(false) }
  }

  const filtered = useMemo(() => {
    if (!data) return []
    const term = search.toLowerCase()
    return term ? data.items.filter(i => i.productName.toLowerCase().includes(term) || (i.warehouseLocation || '').toLowerCase().includes(term)) : data.items
  }, [data, search])

  if (loading || !data) return <div className="flex justify-center py-14"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>

  const { count } = data
  const isOpen = count.status === 'abierto'
  const countedN = data.items.filter(i => i.countedQty != null).length
  const diffN = data.items.filter(i => i.difference != null && i.difference !== 0).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              {count.countNumber}
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_META[count.status].cls}`}>{STATUS_META[count.status].label}</span>
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {count.sedeName ? `📍 ${count.sedeName} · ` : ''}{countedN}/{data.items.length} contados · {diffN} con diferencia
              {count.accuracyPct != null && ` · ${count.accuracyPct}% exactitud`}
            </p>
          </div>
        </div>
        {isOpen && (
          <Button size="sm" className="h-9 gap-1" onClick={close} disabled={closing || countedN === 0}>
            {closing ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />} Cerrar y aplicar ajuste
          </Button>
        )}
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar producto o ubicación…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-secondary/50 text-left">
              <th className="px-3 py-2 font-medium text-muted-foreground">Producto</th>
              <th className="px-3 py-2 font-medium text-muted-foreground text-right">Sistema</th>
              <th className="px-3 py-2 font-medium text-muted-foreground text-right">Físico</th>
              <th className="px-3 py-2 font-medium text-muted-foreground text-right">Dif.</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(i => (
              <tr key={i.id} className="border-t border-border hover:bg-secondary/30">
                <td className="px-3 py-1.5 text-foreground">
                  <span className="truncate block max-w-[220px]" title={i.productName}>{i.productName}</span>
                  {i.warehouseLocation && <span className="text-[10px] font-mono text-primary/70">{i.warehouseLocation}</span>}
                </td>
                <td className="px-3 py-1.5 text-right text-muted-foreground">{i.expectedQty}</td>
                <td className="px-3 py-1.5 text-right">
                  {isOpen ? (
                    <span className="inline-flex items-center gap-1 justify-end">
                      <Input
                        type="number" min={0} defaultValue={i.countedQty ?? ''}
                        onBlur={e => { if (e.target.value !== String(i.countedQty ?? '')) setCounted(i, e.target.value) }}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                        placeholder="—"
                        className="h-7 w-20 text-right text-sm"
                      />
                      {savingId === i.id && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                    </span>
                  ) : (
                    <span className="text-foreground font-medium">{i.countedQty ?? '—'}</span>
                  )}
                </td>
                <td className={`px-3 py-1.5 text-right font-medium ${i.difference == null ? 'text-muted-foreground/40' : i.difference === 0 ? 'text-green-600' : i.difference < 0 ? 'text-red-600' : 'text-amber-600'}`}>
                  {i.difference == null ? '—' : i.difference === 0 ? <Check className="h-3.5 w-3.5 inline" /> : (i.difference > 0 ? `+${i.difference}` : i.difference)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isOpen && diffN > 0 && (
        <p className="text-[11px] text-amber-600 flex items-center gap-1">
          <AlertTriangle className="h-3.5 w-3.5" /> {diffN} producto(s) con diferencia. Al cerrar, el sistema se ajusta al conteo físico y queda auditado en movimientos de stock.
        </p>
      )}
    </div>
  )
}
