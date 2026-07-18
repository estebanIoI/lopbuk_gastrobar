'use client'

/**
 * Bundle Builder (Fase 3) — el comerciante crea combos de productos con descuento
 * y los asigna al PDP de un producto ancla. Precio y ahorro se calculan en backend
 * desde los precios reales; aquí se muestran resueltos. CRUD + estado + duplicar +
 * asignación de ancla. Se renderiza en el PDP con el bloque `bundle` del Registry.
 */

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  Package2, Plus, Copy, Trash2, Pencil, ArrowLeft, Loader2, Search, X, PackageCheck, AlertTriangle,
} from 'lucide-react'

const fmt = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n || 0)
const STATUS_LABEL: Record<string, string> = { draft: 'Borrador', published: 'Publicado', archived: 'Archivado' }

interface BundleItem {
  id?: string
  productId: string
  variantId?: string | null
  quantity: number
  sortOrder?: number
  name?: string
  imageUrl?: string | null
  unitPrice?: number
  inStock?: boolean
}
interface Bundle {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  label: string | null
  discountType: 'fixed_total' | 'percent' | 'amount_off'
  discountValue: number
  anchorProductId: string | null
  status: 'draft' | 'published' | 'archived'
  items: BundleItem[]
  regularTotal: number
  bundlePrice: number
  savings: number
  savingsPct: number
  inStock: boolean
}

// Cálculo local para vista previa mientras se edita (espeja el backend)
function previewPrice(items: BundleItem[], type: string, value: number) {
  const regular = items.reduce((s, it) => s + (Number(it.unitPrice) || 0) * Math.max(1, it.quantity || 1), 0)
  let price = regular
  const v = Number(value) || 0
  if (type === 'percent') price = regular * (1 - v / 100)
  else if (type === 'amount_off') price = regular - v
  else if (type === 'fixed_total') price = v
  price = Math.max(0, Math.round(price * 100) / 100)
  return { regular, price, savings: Math.max(0, regular - price) }
}

// ── Selector de productos ─────────────────────────────────────────────────────
function ProductPicker({ onPick, onClose }: { onPick: (p: any) => void; onClose: () => void }) {
  const [products, setProducts] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancel = false
    setLoading(true)
    api.getProducts({ limit: 60, search: search || undefined }).then(res => {
      if (cancel) return
      const list = (res as any)?.data?.products || (res as any)?.data || []
      setProducts(Array.isArray(list) ? list : [])
      setLoading(false)
    })
    return () => { cancel = true }
  }, [search])

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="text-base">Agregar producto al combo</DialogTitle></DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Buscar producto…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
        </div>
        <div className="max-h-72 overflow-y-auto border rounded-lg divide-y">
          {loading ? <p className="text-xs text-muted-foreground text-center py-6">Cargando…</p>
            : products.length === 0 ? <p className="text-xs text-muted-foreground text-center py-6">Sin resultados</p>
            : products.map(p => (
              <button key={p.id} onClick={() => { onPick(p); onClose() }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/50">
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-medium truncate">{p.name}</span>
                  <span className="block text-[10px] text-muted-foreground">{fmt(p.isOnOffer && p.offerPrice ? p.offerPrice : p.salePrice)} · stock {p.stock}</span>
                </span>
              </button>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Editor de un bundle ────────────────────────────────────────────────────────
function BundleEditor({ initial, onBack, onSaved }: { initial: Bundle; onBack: () => void; onSaved: () => void }) {
  const [b, setB] = useState<Bundle>(initial)
  const [saving, setSaving] = useState(false)
  const [picking, setPicking] = useState(false)
  const [anchorProducts, setAnchorProducts] = useState<any[]>([])

  useEffect(() => {
    api.getProducts({ limit: 100 }).then(res => {
      const list = (res as any)?.data?.products || (res as any)?.data || []
      if (Array.isArray(list)) setAnchorProducts(list)
    })
  }, [])

  const set = (patch: Partial<Bundle>) => setB(prev => ({ ...prev, ...patch }))
  const preview = previewPrice(b.items, b.discountType, b.discountValue)

  const addItem = (p: any) => {
    const unit = p.isOnOffer && p.offerPrice ? Number(p.offerPrice) : Number(p.salePrice)
    set({ items: [...b.items, { productId: String(p.id), quantity: 1, name: p.name, imageUrl: p.imageUrl, unitPrice: unit, inStock: p.stock > 0 }] })
  }
  const updItem = (i: number, patch: Partial<BundleItem>) => set({ items: b.items.map((it, j) => j === i ? { ...it, ...patch } : it) })
  const delItem = (i: number) => set({ items: b.items.filter((_, j) => j !== i) })

  const save = async (publish?: boolean) => {
    setSaving(true)
    const payload = {
      name: b.name, description: b.description, imageUrl: b.imageUrl, label: b.label,
      discountType: b.discountType, discountValue: b.discountValue, anchorProductId: b.anchorProductId,
      items: b.items.map((it, i) => ({ productId: it.productId, variantId: it.variantId || null, quantity: it.quantity, sortOrder: i })),
    }
    const res = b.id ? await api.updateProductBundle(b.id, payload) : await api.createProductBundle(payload)
    if (res.success && publish && res.data?.id) await api.setProductBundleStatus(res.data.id, 'published')
    setSaving(false)
    if (res.success) onSaved()
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
          <Input value={b.name} onChange={e => set({ name: e.target.value })} placeholder="Nombre del combo" className="h-9 text-sm font-semibold max-w-xs" />
          <Badge variant={b.status === 'published' ? 'default' : 'secondary'}>{STATUS_LABEL[b.status]}</Badge>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => save(false)} disabled={saving || !b.name.trim()}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Guardar'}
          </Button>
          <Button size="sm" onClick={() => save(true)} disabled={saving || b.items.length < 2 || !b.name.trim()}>Publicar</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium mb-1 block">Etiqueta (ej: Pack ahorro)</label>
            <Input value={b.label || ''} onChange={e => set({ label: e.target.value })} className="h-8 text-xs" />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Aparece en el PDP de</label>
            <select value={b.anchorProductId || ''} onChange={e => set({ anchorProductId: e.target.value || null })}
              className="w-full h-8 text-xs border rounded-md bg-background px-2">
              <option value="">Cualquier producto del combo</option>
              {anchorProducts.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block">Descripción (opcional)</label>
          <Textarea rows={2} value={b.description || ''} onChange={e => set({ description: e.target.value })} className="text-xs" />
        </div>

        {/* Ítems */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Productos del combo</label>
            <Button variant="outline" size="sm" onClick={() => setPicking(true)}><Plus className="h-3.5 w-3.5 mr-1" />Agregar</Button>
          </div>
          {b.items.length === 0 ? (
            <p className="text-xs text-muted-foreground border border-dashed rounded-lg p-4 text-center">Agrega al menos 2 productos.</p>
          ) : (
            <div className="space-y-2">
              {b.items.map((it, i) => (
                <div key={i} className="flex items-center gap-2 border rounded-lg p-2">
                  <div className="w-10 h-10 rounded bg-muted overflow-hidden shrink-0">
                    {it.imageUrl && (/* eslint-disable-next-line @next/next/no-img-element */
                      <img src={it.imageUrl} alt={it.name} className="w-full h-full object-cover" />)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{it.name || it.productId}</p>
                    <p className="text-[10px] text-muted-foreground">{fmt(it.unitPrice || 0)} c/u {it.inStock === false && <span className="text-red-500">· sin stock</span>}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] text-muted-foreground">x</span>
                    <Input type="number" min={1} value={it.quantity} onChange={e => updItem(i, { quantity: Math.max(1, Number(e.target.value)) })} className="h-7 w-14 text-xs" />
                  </div>
                  <button onClick={() => delItem(i)} className="text-muted-foreground hover:text-destructive shrink-0"><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Descuento + preview */}
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end">
          <div>
            <label className="text-xs font-medium mb-1 block">Tipo de descuento</label>
            <select value={b.discountType} onChange={e => set({ discountType: e.target.value as any })}
              className="w-full h-8 text-xs border rounded-md bg-background px-2">
              <option value="percent">% sobre el total</option>
              <option value="amount_off">$ de descuento</option>
              <option value="fixed_total">Precio fijo final</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">{b.discountType === 'percent' ? 'Porcentaje' : 'Valor'}</label>
            <Input type="number" min={0} value={b.discountValue} onChange={e => set({ discountValue: Number(e.target.value) })} className="h-8 text-xs" />
          </div>
        </div>

        <div className="rounded-xl border bg-muted/30 p-4 flex flex-wrap items-center gap-x-6 gap-y-1">
          <div><span className="text-[10px] uppercase text-muted-foreground block">Precio normal</span><span className="text-sm line-through text-muted-foreground">{fmt(preview.regular)}</span></div>
          <div><span className="text-[10px] uppercase text-muted-foreground block">Precio combo</span><span className="text-lg font-black">{fmt(preview.price)}</span></div>
          <div><span className="text-[10px] uppercase text-muted-foreground block">Ahorro</span><span className="text-sm font-bold text-emerald-600">{fmt(preview.savings)}</span></div>
        </div>
      </CardContent>
      {picking && <ProductPicker onPick={addItem} onClose={() => setPicking(false)} />}
    </Card>
  )
}

// ── Componente principal ───────────────────────────────────────────────────────
export function BundleBuilder() {
  const [bundles, setBundles] = useState<Bundle[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Bundle | null>(null)

  const fetchBundles = useCallback(async () => {
    const res = await api.getProductBundles()
    if (res.success && Array.isArray(res.data)) setBundles(res.data)
    setLoading(false)
  }, [])
  useEffect(() => { fetchBundles() }, [fetchBundles])

  const blank = (): Bundle => ({
    id: '', name: 'Nuevo combo', description: null, imageUrl: null, label: null,
    discountType: 'percent', discountValue: 10, anchorProductId: null, status: 'draft',
    items: [], regularTotal: 0, bundlePrice: 0, savings: 0, savingsPct: 0, inStock: false,
  })

  if (editing) {
    return <BundleEditor initial={editing} onBack={() => setEditing(null)} onSaved={() => { setEditing(null); fetchBundles() }} />
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2"><Package2 className="h-4 w-4" />Combos (Bundle Builder)</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Agrupa productos con descuento y ofrécelos en el PDP. El precio y el ahorro se calculan solos.</p>
        </div>
        <Button size="sm" onClick={() => setEditing(blank())}><Plus className="h-3.5 w-3.5 mr-1.5" />Nuevo combo</Button>
      </CardHeader>
      <CardContent>
        {loading ? <p className="text-sm text-muted-foreground text-center py-8">Cargando…</p>
          : bundles.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <Package2 className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Aún no tienes combos. Crea el primero para ofrecer packs con ahorro.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {bundles.map(bn => (
                <div key={bn.id} className="rounded-xl border p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      {bn.label && <span className="text-[10px] font-bold uppercase text-primary">{bn.label}</span>}
                      <p className="text-sm font-semibold leading-tight">{bn.name}</p>
                    </div>
                    <Badge variant={bn.status === 'published' ? 'default' : 'secondary'}>{STATUS_LABEL[bn.status]}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{bn.items.length} productos · {fmt(bn.bundlePrice)} <span className="text-emerald-600 font-medium">(−{fmt(bn.savings)})</span></p>
                  {!bn.inStock && <p className="text-[10px] text-amber-600 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Algún producto sin stock</p>}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <Button variant="outline" size="sm" onClick={() => setEditing(bn)}><Pencil className="h-3 w-3 mr-1" />Editar</Button>
                    {bn.status !== 'published'
                      ? <Button variant="outline" size="sm" onClick={async () => { await api.setProductBundleStatus(bn.id, 'published'); fetchBundles() }} disabled={bn.items.length < 2}><PackageCheck className="h-3 w-3 mr-1" />Publicar</Button>
                      : <Button variant="outline" size="sm" onClick={async () => { await api.setProductBundleStatus(bn.id, 'draft'); fetchBundles() }}>Despublicar</Button>}
                    <Button variant="ghost" size="icon" title="Duplicar" onClick={async () => { await api.duplicateProductBundle(bn.id); fetchBundles() }}><Copy className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" title="Eliminar" className="text-muted-foreground" onClick={async () => { await api.deleteProductBundle(bn.id); fetchBundles() }}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
      </CardContent>
    </Card>
  )
}
