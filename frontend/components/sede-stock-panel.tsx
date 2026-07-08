"use client"

/**
 * Multibodega — panel "Bodegas": desglose de stock por sede y transferencias.
 *
 * Matriz: cada producto muestra su total y cuánto hay asignado en cada sede;
 * las celdas se editan inline (distribuir). Transferencias: flujo
 * solicitada → en tránsito (sale de origen) → recibida (entra a destino).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Search, ArrowRightLeft, Warehouse, Plus, Trash2, Check, Truck, X, PackageOpen, AlertTriangle } from 'lucide-react'

interface Sede { id: string; name: string; type?: string; isActive?: number }

interface MatrixProduct { id: string; name: string; totalStock: number; assigned: number; defaultSedeId: string | null }
interface MatrixCell { sedeId: string; stock: number; reservedStock: number; minStock: number; warehouseLocation?: string | null }

interface Transfer {
  id: string
  transferNumber: string
  fromSedeId: string
  toSedeId: string
  fromSedeName: string
  toSedeName: string
  items: { productId: string; productName: string; quantity: number }[]
  status: 'solicitada' | 'en_transito' | 'recibida' | 'cancelada'
  notes?: string
  requestedByName?: string
  sentByName?: string
  receivedByName?: string
  createdAt: string
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  solicitada:  { label: 'Solicitada',  cls: 'bg-amber-500/15 text-amber-600' },
  en_transito: { label: 'En tránsito', cls: 'bg-blue-500/15 text-blue-600' },
  recibida:    { label: 'Recibida',    cls: 'bg-green-500/15 text-green-600' },
  cancelada:   { label: 'Cancelada',   cls: 'bg-zinc-500/15 text-zinc-500' },
}

export function SedeStockPanel({ open, onClose, sedes }: { open: boolean; onClose: () => void; sedes: Sede[] }) {
  const [tab, setTab] = useState<'matriz' | 'transferencias'>('matriz')

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Warehouse className="h-5 w-5 text-primary" />
            Bodegas — stock por sede
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 border-b border-border pb-2">
          <button
            onClick={() => setTab('matriz')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'matriz' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}
          >
            Stock por sede
          </button>
          <button
            onClick={() => setTab('transferencias')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'transferencias' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}
          >
            <span className="inline-flex items-center gap-1"><ArrowRightLeft className="h-3.5 w-3.5" /> Transferencias</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pt-2">
          {tab === 'matriz' ? <StockMatrix sedes={sedes} /> : <TransfersView sedes={sedes} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Matriz de stock ────────────────────────────────────────────────────────────

function StockMatrix({ sedes }: { sedes: Sede[] }) {
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [products, setProducts] = useState<MatrixProduct[]>([])
  const [breakdown, setBreakdown] = useState<Record<string, MatrixCell[]>>({})
  const [editing, setEditing] = useState<{ productId: string; sedeId: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [lowStock, setLowStock] = useState<any[]>([])

  const load = useCallback(async (q?: string) => {
    setLoading(true)
    try {
      const res = await api.getSedesStockMatrix(q)
      if (res.success && res.data) {
        setProducts(res.data.products || [])
        setBreakdown(res.data.breakdown || {})
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    api.getSedeLowStock().then(r => { if (r.success && Array.isArray(r.data)) setLowStock(r.data as any[]) }).catch(() => {})
  }, [])

  useEffect(() => {
    const t = setTimeout(() => load(search || undefined), 350)
    return () => clearTimeout(t)
  }, [search, load])

  const cellOf = (productId: string, sedeId: string): MatrixCell | undefined =>
    (breakdown[productId] || []).find(c => c.sedeId === sedeId)

  const startEdit = (productId: string, sedeId: string) => {
    setError('')
    setEditing({ productId, sedeId })
    const cell = cellOf(productId, sedeId)
    setEditValue(String(cell?.stock ?? 0))
    setEditLocation(cell?.warehouseLocation || '')
  }

  const saveEdit = async () => {
    if (!editing) return
    setSaving(true)
    setError('')
    try {
      const res = await api.setSedeStock(editing.sedeId, editing.productId, {
        stock: Number(editValue) || 0,
        warehouseLocation: editLocation.trim() || null,
      })
      if (res.success) {
        await load(search || undefined)
        setEditing(null)
      } else {
        setError((res as any).error || (res as any).message || 'No se pudo guardar')
      }
    } catch (e: any) {
      setError(e?.message || 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar producto…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
      </div>

      {error && <p className="text-xs text-red-500 bg-red-500/10 rounded-md px-3 py-2">{error}</p>}

      {/* Alerta de stock bajo por sede */}
      {lowStock.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-500/5 p-3">
          <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5 mb-2">
            <AlertTriangle className="h-4 w-4" /> {lowStock.length} producto{lowStock.length !== 1 ? 's' : ''} bajo su mínimo por sede
          </p>
          <div className="flex flex-wrap gap-1.5">
            {lowStock.slice(0, 12).map((l, i) => (
              <span key={i} className={`text-[11px] rounded-full px-2 py-0.5 border ${l.stock <= 0 ? 'border-red-300 bg-red-500/10 text-red-600' : 'border-amber-300 bg-amber-500/10 text-amber-700'}`}
                title={l.availableElsewhere > 0 ? `Hay ${l.availableElsewhere} en otras sedes — transfiere` : 'Sin stock en otras sedes'}>
                {l.productName} · {l.sedeName}: {l.stock}/{l.minStock}
                {l.availableElsewhere > 0 && <span className="opacity-70"> · ↔{l.availableElsewhere}</span>}
              </span>
            ))}
            {lowStock.length > 12 && <span className="text-[11px] text-muted-foreground">+{lowStock.length - 12} más</span>}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : products.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">Sin productos</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary/50 text-left">
                <th className="px-3 py-2 font-medium text-muted-foreground">Producto</th>
                <th className="px-3 py-2 font-medium text-muted-foreground text-right">Total</th>
                {sedes.map(s => (
                  <th key={s.id} className="px-3 py-2 font-medium text-muted-foreground text-right whitespace-nowrap">{s.name}</th>
                ))}
                <th className="px-3 py-2 font-medium text-muted-foreground text-right">Sin asignar</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => {
                const unassigned = p.totalStock - p.assigned
                return (
                  <tr key={p.id} className="border-t border-border hover:bg-secondary/30">
                    <td className="px-3 py-2 text-foreground max-w-[220px] truncate" title={p.name}>{p.name}</td>
                    <td className="px-3 py-2 text-right font-semibold text-foreground">{p.totalStock}</td>
                    {sedes.map(s => {
                      const cell = cellOf(p.id, s.id)
                      const isEditing = editing?.productId === p.id && editing?.sedeId === s.id
                      return (
                        <td key={s.id} className="px-3 py-1.5 text-right">
                          {isEditing ? (
                            <span className="inline-flex items-center gap-1">
                              <Input
                                autoFocus
                                type="number"
                                min={0}
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(null) }}
                                className="h-7 w-20 text-right text-sm"
                              />
                              <Input
                                value={editLocation}
                                onChange={e => setEditLocation(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(null) }}
                                placeholder="Ubic. P1-B2"
                                title="Ubicación en esta bodega (pasillo-bloque-nivel)"
                                className="h-7 w-24 text-xs font-mono"
                              />
                              <button onClick={saveEdit} disabled={saving} className="text-green-600 hover:text-green-500">
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                              </button>
                              <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground">
                                <X className="h-4 w-4" />
                              </button>
                            </span>
                          ) : (
                            <button
                              onClick={() => startEdit(p.id, s.id)}
                              className={`px-2 py-0.5 rounded hover:bg-primary/10 transition-colors ${cell && cell.stock > 0 ? 'text-foreground font-medium' : 'text-muted-foreground/50'}`}
                              title={`Clic para distribuir${cell?.warehouseLocation ? ` · ubicación ${cell.warehouseLocation}` : ''}`}
                            >
                              {cell?.stock ?? 0}
                              {cell?.warehouseLocation && (
                                <span className="block text-[9px] font-mono text-primary/70 leading-none">{cell.warehouseLocation}</span>
                              )}
                            </button>
                          )}
                        </td>
                      )
                    })}
                    <td className={`px-3 py-2 text-right text-xs ${unassigned > 0 ? 'text-amber-600 font-medium' : unassigned < 0 ? 'text-red-500 font-medium' : 'text-muted-foreground/50'}`}>
                      {unassigned}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        El total es el stock del producto; cada columna es lo asignado a esa sede. Clic en una celda para distribuir. "Sin asignar" = total − suma de sedes.
      </p>
    </div>
  )
}

// ── Transferencias ─────────────────────────────────────────────────────────────

function TransfersView({ sedes }: { sedes: Sede[] }) {
  const [loading, setLoading] = useState(true)
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [creating, setCreating] = useState(false)
  const [actingId, setActingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getSedeTransfers()
      if (res.success && res.data) setTransfers(res.data as Transfer[])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const advance = async (t: Transfer, status: 'en_transito' | 'recibida' | 'cancelada') => {
    setActingId(t.id)
    setError('')
    try {
      const res = await api.setSedeTransferStatus(t.id, status)
      if (res.success) await load()
      else setError((res as any).error || (res as any).message || 'No se pudo actualizar')
    } catch (e: any) {
      setError(e?.message || 'No se pudo actualizar')
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Mueve mercancía entre sedes. Al marcar "En tránsito" sale de la bodega de origen; al "Recibir" entra al destino.</p>
        <Button size="sm" onClick={() => setCreating(true)} className="gap-1 h-8 text-xs shrink-0">
          <Plus className="h-3.5 w-3.5" /> Nueva transferencia
        </Button>
      </div>

      {error && <p className="text-xs text-red-500 bg-red-500/10 rounded-md px-3 py-2">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : transfers.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <PackageOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Aún no hay transferencias</p>
        </div>
      ) : (
        <div className="space-y-2">
          {transfers.map(t => {
            const meta = STATUS_META[t.status]
            return (
              <div key={t.id} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{t.transferNumber}</span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${meta.cls}`}>{meta.label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  <span className="text-foreground font-medium">{t.fromSedeName}</span> → <span className="text-foreground font-medium">{t.toSedeName}</span>
                  {t.notes && <span className="ml-2 italic">· {t.notes}</span>}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {t.items.map((it, i) => (
                    <span key={i} className="text-[11px] bg-secondary rounded-full px-2 py-0.5 text-muted-foreground">
                      {it.productName} × {it.quantity}
                    </span>
                  ))}
                </div>
                {(t.status === 'solicitada' || t.status === 'en_transito') && (
                  <div className="flex gap-2 pt-1">
                    {t.status === 'solicitada' && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={actingId === t.id} onClick={() => advance(t, 'en_transito')}>
                        {actingId === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Truck className="h-3 w-3" />} Enviar (sale de origen)
                      </Button>
                    )}
                    {t.status === 'en_transito' && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-green-600 border-green-300" disabled={actingId === t.id} onClick={() => advance(t, 'recibida')}>
                        {actingId === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Recibir en destino
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-red-500 border-red-300" disabled={actingId === t.id} onClick={() => advance(t, 'cancelada')}>
                      <Trash2 className="h-3 w-3" /> Cancelar
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {creating && (
        <CreateTransferModal
          sedes={sedes}
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); load() }}
        />
      )}
    </div>
  )
}

function CreateTransferModal({ sedes, onClose, onCreated }: { sedes: Sede[]; onClose: () => void; onCreated: () => void }) {
  const [fromSedeId, setFromSedeId] = useState('')
  const [toSedeId, setToSedeId] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<{ productId: string; productName: string; quantity: number; available: number }[]>([])
  const [originStock, setOriginStock] = useState<{ productId: string; productName: string; stock: number; reservedStock: number }[]>([])
  const [loadingStock, setLoadingStock] = useState(false)
  const [productPick, setProductPick] = useState('')
  const [qty, setQty] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Al elegir origen, cargar qué hay físicamente allá
  useEffect(() => {
    if (!fromSedeId) { setOriginStock([]); return }
    setLoadingStock(true)
    api.getSedeStock(fromSedeId)
      .then(res => setOriginStock(res.success && res.data ? (res.data as any[]) : []))
      .finally(() => setLoadingStock(false))
    setItems([])
    setProductPick('')
  }, [fromSedeId])

  const pickable = useMemo(
    () => originStock.filter(p => !items.some(i => i.productId === p.productId)),
    [originStock, items]
  )

  const addItem = () => {
    const prod = originStock.find(p => p.productId === productPick)
    const q = Number(qty)
    if (!prod || !q || q <= 0) return
    const available = Number(prod.stock) - Number(prod.reservedStock)
    if (q > available) { setError(`Solo hay ${available} disponibles de "${prod.productName}" en la sede de origen`); return }
    setError('')
    setItems(prev => [...prev, { productId: prod.productId, productName: prod.productName, quantity: q, available }])
    setProductPick('')
    setQty('')
  }

  const submit = async () => {
    if (!fromSedeId || !toSedeId || items.length === 0) return
    setSaving(true)
    setError('')
    try {
      const res = await api.createSedeTransfer({
        fromSedeId, toSedeId, notes: notes || undefined,
        items: items.map(({ productId, productName, quantity }) => ({ productId, productName, quantity })),
      })
      if (res.success) onCreated()
      else setError((res as any).error || (res as any).message || 'No se pudo crear')
    } catch (e: any) {
      setError(e?.message || 'No se pudo crear')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Nueva transferencia entre sedes</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Origen</Label>
              <Select value={fromSedeId} onValueChange={setFromSedeId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Sede origen" /></SelectTrigger>
                <SelectContent>
                  {sedes.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Destino</Label>
              <Select value={toSedeId} onValueChange={setToSedeId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Sede destino" /></SelectTrigger>
                <SelectContent>
                  {sedes.filter(s => s.id !== fromSedeId).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {fromSedeId && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Productos (stock físico en la sede de origen)</Label>
              {loadingStock ? (
                <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
              ) : originStock.length === 0 ? (
                <p className="text-xs text-muted-foreground bg-secondary/50 rounded-md px-3 py-2">
                  Esta sede no tiene stock asignado. Distribuye stock en la pestaña "Stock por sede" primero.
                </p>
              ) : (
                <div className="flex gap-2">
                  <Select value={productPick} onValueChange={setProductPick}>
                    <SelectTrigger className="h-9 text-sm flex-1"><SelectValue placeholder="Producto" /></SelectTrigger>
                    <SelectContent>
                      {pickable.map(p => (
                        <SelectItem key={p.productId} value={p.productId}>
                          {p.productName} — disp: {Number(p.stock) - Number(p.reservedStock)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input type="number" min={1} placeholder="Cant." value={qty} onChange={e => setQty(e.target.value)} className="h-9 w-20 text-sm" />
                  <Button size="sm" variant="outline" className="h-9" onClick={addItem} disabled={!productPick || !qty}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {items.length > 0 && (
                <div className="space-y-1">
                  {items.map((it, i) => (
                    <div key={it.productId} className="flex items-center justify-between text-sm bg-secondary/50 rounded-md px-3 py-1.5">
                      <span className="text-foreground truncate">{it.productName} × {it.quantity}</span>
                      <button onClick={() => setItems(prev => prev.filter((_, j) => j !== i))} className="text-red-500 hover:text-red-400 ml-2">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <Label className="text-xs text-muted-foreground">Notas (opcional)</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ej: urgente para obra del cliente X" className="h-9 text-sm" />
          </div>

          {error && <p className="text-xs text-red-500 bg-red-500/10 rounded-md px-3 py-2">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" onClick={submit} disabled={saving || !fromSedeId || !toSedeId || items.length === 0} className="gap-1">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
              Crear transferencia
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
