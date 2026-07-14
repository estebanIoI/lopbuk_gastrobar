'use client'

/**
 * CombosManager — módulo "Combos por día" del panel del comerciante.
 * Crea combos recurrentes (lun perros x2/x3, mié hamburguesas…): días activos,
 * ítems elegibles seleccionados de la categoría, tamaños a precio fijo e inclusiones.
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '@/lib/api'
import { formatCOP } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Layers, Plus, Edit, Trash2, Power, X, Search, Check, RefreshCw, CalendarDays,
} from 'lucide-react'
import { toast } from 'sonner'

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

type Combo = { id: string; name: string; activeDays: number[]; sizes: { count: number; price: number }[]; includes: string | null; imageUrl: string | null; isActive: boolean; items: { id: string; name: string; price: number }[] }
type Product = { id: string; name: string; category?: string; sale_price?: number; salePrice?: number }

const emptyForm = () => ({ name: '', activeDays: [] as number[], sizes: [{ count: 2, price: 0 }], includes: '', imageUrl: '', itemIds: [] as string[] })

export function CombosManager() {
  const [combos, setCombos] = useState<Combo[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Combo | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [catFilter, setCatFilter] = useState('__all__')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [cRes, pRes, catRes] = await Promise.all([api.getCombos(), api.getProducts({ limit: 1000 }), api.getCategories()])
    if (cRes.success) setCombos(cRes.data || [])
    // getProducts devuelve { products, pagination } → tomar .products (no es un array directo).
    if (pRes.success) setProducts(Array.isArray(pRes.data) ? pRes.data : ((pRes.data as any)?.products || []))
    if (catRes.success) setCategories((catRes.data || []).map((c: any) => ({ id: c.id, name: c.name })))
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setCatFilter('__all__'); setSearch(''); setError(null); setShowForm(true) }
  const openEdit = (c: Combo) => {
    setEditing(c)
    setForm({
      name: c.name, activeDays: c.activeDays || [], sizes: c.sizes?.length ? c.sizes : [{ count: 2, price: 0 }],
      includes: c.includes || '', imageUrl: c.imageUrl || '', itemIds: (c.items || []).map(i => i.id),
    })
    setCatFilter('__all__'); setSearch(''); setError(null); setShowForm(true)
  }

  const toggleDay = (d: number) => setForm(f => ({ ...f, activeDays: f.activeDays.includes(d) ? f.activeDays.filter(x => x !== d) : [...f.activeDays, d].sort() }))
  const toggleItem = (id: string) => setForm(f => ({ ...f, itemIds: f.itemIds.includes(id) ? f.itemIds.filter(x => x !== id) : [...f.itemIds, id] }))
  const setSize = (i: number, patch: Partial<{ count: number; price: number }>) => setForm(f => ({ ...f, sizes: f.sizes.map((s, j) => j === i ? { ...s, ...patch } : s) }))
  const addSize = () => setForm(f => ({ ...f, sizes: [...f.sizes, { count: (f.sizes.at(-1)?.count || 1) + 1, price: 0 }] }))
  const removeSize = (i: number) => setForm(f => ({ ...f, sizes: f.sizes.filter((_, j) => j !== i) }))

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter(p =>
      (catFilter === '__all__' || p.category === catFilter) &&
      (!q || p.name.toLowerCase().includes(q))
    )
  }, [products, catFilter, search])

  const submit = async () => {
    setError(null)
    const sizes = form.sizes.map(s => ({ count: Math.max(1, Math.floor(Number(s.count) || 0)), price: Math.max(0, Number(s.price) || 0) })).filter(s => s.count >= 1)
    if (!form.name.trim()) return setError('Ponle un nombre al combo')
    if (form.activeDays.length === 0) return setError('Elige al menos un día')
    if (sizes.length === 0 || sizes.some(s => s.price <= 0)) return setError('Cada tamaño necesita un precio')
    if (form.itemIds.length === 0) return setError('Elige los ítems que entran al combo')
    // El cliente debe escoger `count` ítems distintos por tamaño → se necesitan al
    // menos tantos ítems elegibles como el tamaño más grande, o el combo queda
    // imposible de completar en la tienda.
    const maxCount = Math.max(...sizes.map(s => s.count))
    if (form.itemIds.length < maxCount) return setError(`Para el tamaño x${maxCount} necesitas al menos ${maxCount} ítems elegibles (tienes ${form.itemIds.length})`)

    setSaving(true)
    const payload = { name: form.name.trim(), activeDays: form.activeDays, sizes, includes: form.includes.trim() || undefined, imageUrl: form.imageUrl.trim() || undefined, itemIds: form.itemIds }
    const res = editing ? await api.updateCombo(editing.id, payload) : await api.createCombo(payload)
    setSaving(false)
    if (res.success) { toast.success(editing ? 'Combo actualizado' : 'Combo creado'); setShowForm(false); await load() }
    else setError(res.error || 'No se pudo guardar')
  }

  const toggle = async (c: Combo) => { await api.toggleCombo(c.id, !c.isActive); await load() }
  const remove = async (c: Combo) => { if (!confirm(`¿Eliminar el combo "${c.name}"?`)) return; await api.deleteCombo(c.id); await load() }

  if (loading) return <div className="flex justify-center py-20"><RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Layers className="h-6 w-6 text-primary" /> Combos por día</h1>
          <p className="text-sm text-muted-foreground">Ofertas que se activan ciertos días (ej. lunes de perros x2/x3). Solo aparecen en la tienda el día que elijas.</p>
        </div>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Nuevo combo</Button>
      </div>

      {combos.length === 0 ? (
        <Card variant="glass"><CardContent className="flex flex-col items-center py-16 text-center">
          <Layers className="mb-3 h-12 w-12 text-muted-foreground/40" />
          <p className="font-medium text-muted-foreground">Sin combos aún</p>
          <p className="mb-4 text-sm text-muted-foreground">Crea tu primer combo por día</p>
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Nuevo combo</Button>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {combos.map(c => (
            <Card key={c.id} className={c.isActive ? '' : 'opacity-60'}>
              <CardContent className="space-y-3 pt-5">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{c.name}</p>
                  <button onClick={() => toggle(c)} title={c.isActive ? 'Activo' : 'Inactivo'}>
                    <Power className={`h-5 w-5 ${c.isActive ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {c.activeDays?.length ? c.activeDays.map(d => <Badge key={d} variant="outline" className="text-[10px]">{DAYS[d]}</Badge>) : <span className="text-xs text-muted-foreground">Sin días</span>}
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {c.sizes?.map((s, i) => <span key={i} className="rounded bg-primary/10 px-2 py-0.5 font-medium text-primary">x{s.count} · {formatCOP(s.price)}</span>)}
                </div>
                <p className="text-xs text-muted-foreground">{(c.items || []).length} ítem(s) elegible(s)</p>
                <div className="flex gap-1 pt-1">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(c)}><Edit className="mr-1 h-3.5 w-3.5" /> Editar</Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(c)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Crear / editar combo ─────────────────────────────── */}
      <Dialog open={showForm} onOpenChange={(o) => { if (!saving) setShowForm(o) }}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar combo' : 'Nuevo combo'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nombre del combo</Label>
              <Input placeholder="Ej: Lunes de perros" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Días activos</Label>
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map((d, i) => (
                  <button key={i} type="button" onClick={() => toggleDay(i)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium ${form.activeDays.includes(i) ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:border-primary'}`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Tamaños y precios</Label>
              <div className="space-y-2">
                {form.sizes.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Combo por</span>
                    <Input type="number" min={1} value={s.count} onChange={e => setSize(i, { count: Number(e.target.value) })} className="w-20" />
                    <span className="text-sm text-muted-foreground">ítems ·</span>
                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input type="number" min={0} value={s.price} onChange={e => setSize(i, { price: Number(e.target.value) })} className="pl-6" placeholder="Precio del combo" />
                    </div>
                    {form.sizes.length > 1 && <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeSize(i)}><X className="h-4 w-4" /></Button>}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addSize}><Plus className="mr-1 h-3.5 w-3.5" /> Agregar tamaño</Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Incluye (opcional)</Label>
              <Textarea rows={2} placeholder="Ej: Papas rústicas + Coca-Cola mini" value={form.includes} onChange={e => setForm(f => ({ ...f, includes: e.target.value }))} />
            </div>

            <div className="space-y-1.5">
              <Label>Ítems que entran al combo ({form.itemIds.length} elegidos)</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Buscar producto…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9" />
                </div>
                <Select value={catFilter} onValueChange={setCatFilter}>
                  <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas las categorías</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-1.5">
                {filteredProducts.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Sin productos para ese filtro</p>
                ) : filteredProducts.map(p => {
                  const on = form.itemIds.includes(p.id)
                  return (
                    <button key={p.id} type="button" onClick={() => toggleItem(p.id)}
                      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors ${on ? 'bg-primary/10' : 'hover:bg-accent'}`}>
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40'}`}>
                        {on && <Check className="h-3 w-3" />}
                      </span>
                      <span className="flex-1 truncate">{p.name}</span>
                      <span className="text-xs text-muted-foreground">{formatCOP(Number(p.salePrice ?? p.sale_price ?? 0))}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {error && <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={submit} disabled={saving}>{saving ? 'Guardando…' : editing ? 'Actualizar' : 'Crear combo'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
