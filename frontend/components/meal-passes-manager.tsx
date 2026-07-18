'use client'

/**
 * Tiqueteras / Meal Pass (Fase 4 GastroBar · M4) — administración autónoma.
 * Crear, buscar (nombre/documento/teléfono/convenio/empresa), editar, recargar,
 * ver saldo e historial de consumos. La integración con el cobro del POS es F5.
 */

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Ticket, Plus, Search, Loader2, Building2, Phone, IdCard, Plus as PlusIcon, History, Ban, Trash2 } from 'lucide-react'

const STATUS: Record<string, { label: string; color: string }> = {
  activa:   { label: 'Activa',   color: 'bg-emerald-500/15 text-emerald-500' },
  agotada:  { label: 'Agotada',  color: 'bg-zinc-500/15 text-zinc-400' },
  vencida:  { label: 'Vencida',  color: 'bg-amber-500/15 text-amber-500' },
  anulada:  { label: 'Anulada',  color: 'bg-red-500/15 text-red-500' },
}

interface Pass {
  id: string; customerName: string; document: string | null; phone: string | null
  convenio: string | null; empresa: string | null; totalMeals: number; remaining: number
  purchasedAt: string | null; expiresAt: string | null; status: string; notes: string | null
}

const blank = () => ({ customerName: '', document: '', phone: '', convenio: '', empresa: '', totalMeals: '', expiresAt: '', notes: '' })

export function MealPassesManager() {
  const [passes, setPasses] = useState<Pass[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [detail, setDetail] = useState<Pass | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await api.getMealPasses({ search: search || undefined })
    if (r.success && Array.isArray(r.data)) setPasses(r.data)
    setLoading(false)
  }, [search])

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [load])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Ticket className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Tiqueteras</h2>
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">{passes.length}</span>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="h-3.5 w-3.5 mr-1.5" />Nueva tiquetera</Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, documento, teléfono, convenio o empresa…" className="pl-9" />
      </div>

      {loading ? (
        <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
      ) : passes.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
          <Ticket className="h-10 w-10 mx-auto mb-2 opacity-40" />
          {search ? 'Sin resultados.' : 'Aún no hay tiqueteras. Crea la primera.'}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {passes.map(p => (
            <button key={p.id} onClick={() => setDetail(p)} className="text-left rounded-xl border border-border p-4 hover:border-primary/40 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-sm leading-tight">{p.customerName}</p>
                <Badge className={STATUS[p.status]?.color}>{STATUS[p.status]?.label}</Badge>
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-black tabular-nums">{p.remaining}</span>
                <span className="text-xs text-muted-foreground">/ {p.totalMeals} almuerzos</span>
              </div>
              <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                {p.document && <p className="flex items-center gap-1"><IdCard className="h-3 w-3" />{p.document}</p>}
                {p.empresa && <p className="flex items-center gap-1"><Building2 className="h-3 w-3" />{p.empresa}{p.convenio ? ` · ${p.convenio}` : ''}</p>}
                {p.expiresAt && <p>Vence: {p.expiresAt}</p>}
              </div>
            </button>
          ))}
        </div>
      )}

      {showCreate && <CreateDialog onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load() }} />}
      {detail && <DetailDialog pass={detail} onClose={() => setDetail(null)} onChanged={() => { load(); setDetail(null) }} />}
    </div>
  )
}

// ── Crear ───────────────────────────────────────────────────────────────────
function CreateDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [f, setF] = useState(blank())
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setF(prev => ({ ...prev, [k]: v }))

  const save = async () => {
    if (!f.customerName.trim()) { toast.error('El nombre es requerido'); return }
    setSaving(true)
    const r = await api.createMealPass({
      customerName: f.customerName, document: f.document, phone: f.phone, convenio: f.convenio, empresa: f.empresa,
      totalMeals: Number(f.totalMeals) || 0, expiresAt: f.expiresAt || null, notes: f.notes,
    })
    setSaving(false)
    if (r.success) { toast.success('Tiquetera creada'); onCreated() } else toast.error(r.error)
  }

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-base">Nueva tiquetera</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Nombre del cliente *"><Input value={f.customerName} onChange={e => set('customerName', e.target.value)} className="h-9 text-sm" /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Documento"><Input value={f.document} onChange={e => set('document', e.target.value)} className="h-9 text-sm" /></Field>
            <Field label="Teléfono"><Input value={f.phone} onChange={e => set('phone', e.target.value)} className="h-9 text-sm" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Empresa"><Input value={f.empresa} onChange={e => set('empresa', e.target.value)} className="h-9 text-sm" /></Field>
            <Field label="Convenio"><Input value={f.convenio} onChange={e => set('convenio', e.target.value)} className="h-9 text-sm" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Almuerzos comprados"><Input type="number" min={0} value={f.totalMeals} onChange={e => set('totalMeals', e.target.value)} className="h-9 text-sm" /></Field>
            <Field label="Vence (opcional)"><Input type="date" value={f.expiresAt} onChange={e => set('expiresAt', e.target.value)} className="h-9 text-sm" /></Field>
          </div>
          <Field label="Notas"><Textarea rows={2} value={f.notes} onChange={e => set('notes', e.target.value)} className="text-sm" /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Crear'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Detalle: saldo, recarga, historial, anular ─────────────────────────────────
function DetailDialog({ pass, onClose, onChanged }: { pass: Pass; onClose: () => void; onChanged: () => void }) {
  const [p, setP] = useState<Pass>(pass)
  const [movements, setMovements] = useState<any[]>([])
  const [rechargeQty, setRechargeQty] = useState('')
  const [busy, setBusy] = useState(false)

  const loadMovements = useCallback(async () => {
    const r = await api.getMealPassMovements(pass.id)
    if (r.success && Array.isArray(r.data)) setMovements(r.data)
  }, [pass.id])
  useEffect(() => { loadMovements() }, [loadMovements])

  const recharge = async () => {
    const n = Number(rechargeQty)
    if (!n || n <= 0) { toast.error('Cantidad inválida'); return }
    setBusy(true)
    const r = await api.rechargeMealPass(pass.id, n)
    setBusy(false)
    if (r.success) { setP(r.data); setRechargeQty(''); loadMovements(); toast.success(`+${n} almuerzos`) } else toast.error(r.error)
  }
  const annul = async () => {
    if (!confirm('¿Anular esta tiquetera? No podrá consumir más.')) return
    setBusy(true)
    const r = await api.annulMealPass(pass.id)
    setBusy(false)
    if (r.success) { toast.success('Tiquetera anulada'); onChanged() } else toast.error(r.error)
  }
  const remove = async () => {
    if (!confirm('¿Eliminar esta tiquetera del listado?')) return
    setBusy(true)
    const r = await api.deleteMealPass(pass.id)
    setBusy(false)
    if (r.success) { toast.success('Eliminada'); onChanged() } else toast.error(r.error)
  }

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">{p.customerName}<Badge className={STATUS[p.status]?.color}>{STATUS[p.status]?.label}</Badge></DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Card><CardContent className="p-4 text-center">
            <p className="text-4xl font-black tabular-nums">{p.remaining}</p>
            <p className="text-xs text-muted-foreground">almuerzos disponibles de {p.totalMeals}</p>
          </CardContent></Card>

          <div className="text-xs text-muted-foreground space-y-0.5">
            {p.document && <p className="flex items-center gap-1"><IdCard className="h-3 w-3" />{p.document}</p>}
            {p.phone && <p className="flex items-center gap-1"><Phone className="h-3 w-3" />{p.phone}</p>}
            {p.empresa && <p className="flex items-center gap-1"><Building2 className="h-3 w-3" />{p.empresa}{p.convenio ? ` · ${p.convenio}` : ''}</p>}
            {p.expiresAt && <p>Vence: {p.expiresAt}</p>}
          </div>

          {/* Recarga */}
          {p.status !== 'anulada' && (
            <div className="flex items-end gap-2">
              <Field label="Recargar almuerzos" className="flex-1">
                <Input type="number" min={1} value={rechargeQty} onChange={e => setRechargeQty(e.target.value)} placeholder="Ej: 30" className="h-9 text-sm" />
              </Field>
              <Button size="sm" onClick={recharge} disabled={busy}><PlusIcon className="h-3.5 w-3.5 mr-1" />Recargar</Button>
            </div>
          )}

          {/* Historial */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1"><History className="h-3.5 w-3.5" />Historial</p>
            <div className="max-h-52 overflow-y-auto border border-border rounded-lg divide-y divide-border">
              {movements.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Sin movimientos</p>
              ) : movements.map(m => (
                <div key={m.id} className="flex items-center justify-between px-3 py-2 text-xs">
                  <div>
                    <span className={`font-medium ${m.meals >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>{m.meals >= 0 ? '+' : ''}{m.meals}</span>
                    <span className="text-muted-foreground ml-2 capitalize">{m.type}</span>
                    {m.tableNumber && <span className="text-muted-foreground ml-1">· Mesa {m.tableNumber}</span>}
                    {m.note && <span className="text-muted-foreground ml-1">· {m.note}</span>}
                  </div>
                  <div className="text-right text-muted-foreground">
                    <span className="tabular-nums">→ {m.balanceAfter}</span>
                    <span className="block text-[10px]">{new Date(m.createdAt).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          {p.status !== 'anulada' && <Button variant="outline" size="sm" onClick={annul} disabled={busy} className="text-amber-600"><Ban className="h-3.5 w-3.5 mr-1" />Anular</Button>}
          <Button variant="ghost" size="sm" onClick={remove} disabled={busy} className="text-muted-foreground"><Trash2 className="h-3.5 w-3.5 mr-1" />Eliminar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="text-xs font-medium mb-1 block text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}
