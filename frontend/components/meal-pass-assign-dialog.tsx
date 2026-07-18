'use client'

/**
 * Smart Checkout (Fase 5 GastroBar · M4) — asignar ítems de una comanda a una
 * tiquetera. Cubre los 3 casos del requerimiento:
 *   · un ítem      → seleccionar solo ese almuerzo
 *   · algunos      → seleccionar varios (el resto se paga normal)
 *   · toda la mesa → botón "Seleccionar todos"
 *
 * Solo se pueden cargar productos marcados como almuerzo; el backend lo valida
 * igual y avisa si el saldo no alcanza.
 */

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Ticket, Search, Loader2, Check } from 'lucide-react'

interface OrderItem {
  id: string
  menuItemName: string
  quantity: number
  subtotal: number
  status: string
  mealPassId?: string | null
}

interface Pass {
  id: string; customerName: string; document: string | null
  empresa: string | null; remaining: number; status: string
}

const fmt = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n || 0)

export function MealPassAssignDialog({ orderId, items, onClose, onAssigned }: {
  orderId: string
  items: OrderItem[]
  onClose: () => void
  onAssigned: () => void
}) {
  // Solo ítems aún no pagados/cancelados
  const assignable = items.filter(i => i.status !== 'cancelado' && i.status !== 'entregado')
  const [selected, setSelected] = useState<Set<string>>(() => new Set(assignable.filter(i => i.mealPassId).map(i => i.id)))
  const [passes, setPasses] = useState<Pass[]>([])
  const [search, setSearch] = useState('')
  const [pickedPass, setPickedPass] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadPasses = useCallback(async () => {
    setLoading(true)
    const r = await api.getMealPasses({ search: search || undefined, status: 'activa' })
    if (r.success && Array.isArray(r.data)) setPasses(r.data)
    setLoading(false)
  }, [search])
  useEffect(() => { const t = setTimeout(loadPasses, 250); return () => clearTimeout(t) }, [loadPasses])

  const toggle = (id: string) => setSelected(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
  })
  const selectAll = () => setSelected(new Set(assignable.map(i => i.id)))
  const clearAll = () => setSelected(new Set())

  // Cupos que se consumirían (1 por unidad de almuerzo)
  const cupos = assignable.filter(i => selected.has(i.id)).reduce((s, i) => s + i.quantity, 0)
  const pass = passes.find(p => p.id === pickedPass)
  const insufficient = !!pass && cupos > pass.remaining

  const assign = async () => {
    if (selected.size === 0) { toast.error('Selecciona al menos un ítem'); return }
    if (!pickedPass) { toast.error('Selecciona una tiquetera'); return }
    setSaving(true)
    const r = await api.assignOrderItemsToMealPass(orderId, [...selected], pickedPass)
    setSaving(false)
    if (r.success) { toast.success(`${cupos} almuerzo(s) cargados a la tiquetera`); onAssigned() }
    else toast.error(r.error ?? 'No se pudo asignar')
  }

  const unassign = async () => {
    const assigned = assignable.filter(i => i.mealPassId).map(i => i.id)
    if (assigned.length === 0) { toast.error('No hay ítems en tiquetera'); return }
    setSaving(true)
    const r = await api.assignOrderItemsToMealPass(orderId, assigned, null)
    setSaving(false)
    if (r.success) { toast.success('Ítems devueltos a pago normal'); onAssigned() }
    else toast.error(r.error ?? 'No se pudo quitar')
  }

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2"><Ticket className="h-4 w-4" />Cargar a tiquetera</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Ítems */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ítems de la comanda</p>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={selectAll}>Toda la mesa</Button>
                <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={clearAll}>Ninguno</Button>
              </div>
            </div>
            <div className="border border-border rounded-lg divide-y divide-border max-h-48 overflow-y-auto">
              {assignable.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Sin ítems pendientes</p>
              ) : assignable.map(i => (
                <label key={i.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-muted/40">
                  <input type="checkbox" checked={selected.has(i.id)} onChange={() => toggle(i.id)} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-medium truncate">{i.quantity}× {i.menuItemName}</span>
                    <span className="block text-[10px] text-muted-foreground">{fmt(i.subtotal)}</span>
                  </span>
                  {i.mealPassId && <Badge className="bg-emerald-500/15 text-emerald-500 text-[10px]">En tiquetera</Badge>}
                </label>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Solo los productos marcados como <b>almuerzo</b> se pueden cargar. El resto se cobra normal.
            </p>
          </div>

          {/* Tiquetera */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Tiquetera</p>
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nombre, documento, teléfono, empresa…" className="pl-8 h-8 text-xs" />
            </div>
            <div className="border border-border rounded-lg divide-y divide-border max-h-40 overflow-y-auto">
              {loading ? (
                <div className="py-4 text-center"><Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" /></div>
              ) : passes.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Sin tiqueteras activas</p>
              ) : passes.map(p => (
                <button key={p.id} onClick={() => setPickedPass(p.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/40 ${pickedPass === p.id ? 'bg-primary/10' : ''}`}>
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-medium truncate">{p.customerName}</span>
                    <span className="block text-[10px] text-muted-foreground">{p.document || ''}{p.empresa ? ` · ${p.empresa}` : ''}</span>
                  </span>
                  <span className="text-xs font-bold tabular-nums shrink-0">{p.remaining}</span>
                  {pickedPass === p.id && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* Resumen */}
          {pickedPass && (
            <div className={`rounded-lg border p-3 text-xs ${insufficient ? 'border-red-500/40 bg-red-500/10' : 'border-border bg-muted/30'}`}>
              {insufficient
                ? <span className="text-red-500 font-medium">Saldo insuficiente: se necesitan {cupos} y {pass?.customerName} tiene {pass?.remaining}.</span>
                : <span>Se descontarán <b>{cupos}</b> almuerzo(s) de <b>{pass?.customerName}</b> · quedarían <b>{(pass?.remaining ?? 0) - cupos}</b>.</span>}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={unassign} disabled={saving}>Quitar de tiquetera</Button>
          <Button size="sm" onClick={assign} disabled={saving || insufficient || selected.size === 0 || !pickedPass}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cargar a tiquetera'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
