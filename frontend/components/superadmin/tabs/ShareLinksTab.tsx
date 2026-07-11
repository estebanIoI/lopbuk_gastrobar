'use client'

/**
 * ShareLinksTab — Generador de links de campaña (ShareLinks F3).
 * El superadmin crea links para historias IG/TikTok que abren la app filtrada:
 *  - producto  → abre el item listo para pedir
 *  - tienda    → la tienda del comerciante
 *  - colección → marketplace filtrado (solo restaurantes / comercios elegidos)
 * Con QR descargable, copiar URL y contador de clics.
 */
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import {
  RefreshCw, Link2, Plus, Copy, Check, QrCode, Trash2, Power, Store, Tag, Package, Layers, Download,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { api } from '@/lib/api'

type ShareLink = { id: string; code: string; type: 'product' | 'store' | 'collection'; config: any; title: string | null; clicks: number; isActive: number; createdAt: string }
type Tenant = { id: string; name: string; slug?: string; businessType?: string | null }

const TYPE_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  product: { label: 'Producto', icon: Package },
  store: { label: 'Tienda', icon: Store },
  collection: { label: 'Colección', icon: Layers },
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

export function ShareLinksTab() {
  const [links, setLinks] = useState<ShareLink[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [qrFor, setQrFor] = useState<ShareLink | null>(null)

  // Crear
  const [showCreate, setShowCreate] = useState(false)
  const [type, setType] = useState<'product' | 'store' | 'collection'>('collection')
  const [title, setTitle] = useState('')
  const [storeSlug, setStoreSlug] = useState('')
  const [productId, setProductId] = useState('')
  const [products, setProducts] = useState<{ id: string; name: string }[]>([])
  const [rubros, setRubros] = useState<Set<string>>(new Set())
  const [tenantIds, setTenantIds] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const fullUrl = (code: string) => `${origin}/l/${code}`

  const load = useCallback(async () => {
    setLoading(true)
    const [lRes, tRes] = await Promise.all([api.getShareLinks(), api.getSuperadminTenantsList()])
    if (lRes.success) setLinks(lRes.data || [])
    if (tRes.success) setTenants((tRes.data || []) as Tenant[])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const allRubros = useMemo(() => Array.from(new Set(tenants.map(t => t.businessType).filter(Boolean) as string[])).sort(), [tenants])

  const copy = async (code: string) => {
    try { await navigator.clipboard.writeText(fullUrl(code)); setCopied(code); setTimeout(() => setCopied(null), 1500) } catch {}
  }

  // Al elegir tienda en modo producto, cargar sus productos
  const loadProducts = async (slug: string) => {
    setProducts([]); setProductId('')
    if (!slug) return
    try {
      const r = await fetch(`${API_URL}/storefront/products?store=${encodeURIComponent(slug)}&limit=200`).then(x => x.json())
      const list = (r?.data?.products || r?.data || []).map((p: any) => ({ id: p.id, name: p.name }))
      setProducts(list)
    } catch {}
  }

  const resetCreate = () => { setType('collection'); setTitle(''); setStoreSlug(''); setProductId(''); setProducts([]); setRubros(new Set()); setTenantIds(new Set()); setCreateError(null) }

  const submit = async () => {
    setCreateError(null)
    let config: any = null
    if (type === 'store') { if (!storeSlug) return setCreateError('Elige un comercio'); config = { slug: storeSlug } }
    else if (type === 'product') { if (!storeSlug || !productId) return setCreateError('Elige comercio y producto'); config = { slug: storeSlug, productId } }
    else { if (rubros.size === 0 && tenantIds.size === 0) return setCreateError('Elige al menos un rubro o comercio'); config = { businessTypes: [...rubros], tenantIds: [...tenantIds] } }
    setCreating(true)
    const res = await api.createShareLink({ type, config, title: title.trim() || undefined })
    setCreating(false)
    if (res.success) { setShowCreate(false); resetCreate(); await load() }
    else setCreateError(res.error || 'No se pudo crear')
  }

  const toggle = async (l: ShareLink) => { await api.patchShareLink(l.id, { isActive: !l.isActive }); await load() }
  const remove = async (l: ShareLink) => { if (!confirm('¿Eliminar este link?')) return; await api.deleteShareLink(l.id); await load() }

  const linkSubtitle = (l: ShareLink) => {
    if (l.type === 'store') return `/t/${l.config?.slug}`
    if (l.type === 'product') return `${l.config?.slug} · producto`
    const bt = (l.config?.businessTypes || []).length
    const tn = (l.config?.tenantIds || []).length
    return [bt ? `${bt} rubro(s)` : null, tn ? `${tn} comercio(s)` : null].filter(Boolean).join(' + ')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Link2 className="h-5 w-5 text-primary" /> Links de campaña</h2>
          <p className="text-sm text-muted-foreground">Links para historias que abren la app filtrada (solo restaurantes, una tienda, o un producto). Con QR y contador de clics.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={load} title="Recargar"><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={() => { resetCreate(); setShowCreate(true) }}><Plus className="mr-1 h-4 w-4" /> Nuevo link</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : links.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-14 text-center">
          <Link2 className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium text-muted-foreground">Sin links todavía</p>
          <p className="mb-4 text-sm text-muted-foreground">Crea uno y pégalo en tu historia</p>
          <Button onClick={() => { resetCreate(); setShowCreate(true) }}><Plus className="mr-1 h-4 w-4" /> Nuevo link</Button>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {links.map(l => {
            const Icon = TYPE_META[l.type].icon
            return (
              <Card key={l.id} className={l.isActive ? '' : 'opacity-60'}>
                <CardContent className="space-y-2 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 font-semibold">
                        <Icon className="h-4 w-4 text-primary shrink-0" />
                        <span className="truncate">{l.title || TYPE_META[l.type].label}</span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{linkSubtitle(l)}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[10px] capitalize">{TYPE_META[l.type].label}</Badge>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-md border bg-muted/30 px-2 py-1.5">
                    <code className="flex-1 truncate text-xs">{fullUrl(l.code)}</code>
                    <button onClick={() => copy(l.code)} title="Copiar" className="shrink-0 text-muted-foreground hover:text-primary">
                      {copied === l.code ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-muted-foreground">{l.clicks} clic(s)</span>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setQrFor(l)}><QrCode className="mr-1 h-3.5 w-3.5" /> QR</Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggle(l)} title={l.isActive ? 'Activo' : 'Inactivo'}>
                        <Power className={`h-4 w-4 ${l.isActive ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(l)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ── Crear link ─────────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={(o) => { if (!creating) setShowCreate(o) }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nuevo link de campaña</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de link</Label>
              <Select value={type} onValueChange={(v) => { setType(v as any); setStoreSlug(''); setProductId(''); setProducts([]) }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="collection">Colección (solo cierto rubro/comercios)</SelectItem>
                  <SelectItem value="store">Tienda (un comercio)</SelectItem>
                  <SelectItem value="product">Producto (un item)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Título / portada (opcional)</Label>
              <Input placeholder="Ej: Antojos de hoy 🍔" value={title} onChange={e => setTitle(e.target.value)} />
            </div>

            {type === 'collection' && (
              <>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs"><Tag className="h-3.5 w-3.5" /> Rubros (todos los de ese tipo)</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {allRubros.length === 0 && <span className="text-xs text-muted-foreground italic">Sin rubros</span>}
                    {allRubros.map(r => {
                      const on = rubros.has(r)
                      return (
                        <button key={r} type="button" onClick={() => setRubros(p => { const n = new Set(p); n.has(r) ? n.delete(r) : n.add(r); return n })}
                          className={`rounded-full border px-2.5 py-1 text-xs capitalize ${on ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:border-primary'}`}>
                          {r}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs"><Store className="h-3.5 w-3.5" /> Comercios específicos (opcional)</Label>
                  <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-1.5">
                    {tenants.map(t => {
                      const on = tenantIds.has(t.id)
                      return (
                        <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent">
                          <input type="checkbox" className="h-4 w-4" checked={on}
                            onChange={() => setTenantIds(p => { const n = new Set(p); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n })} />
                          <span className="flex-1 truncate">{t.name}</span>
                          {t.businessType && <Badge variant="outline" className="text-[10px]">{t.businessType}</Badge>}
                        </label>
                      )
                    })}
                  </div>
                </div>
              </>
            )}

            {(type === 'store' || type === 'product') && (
              <div className="space-y-1.5">
                <Label className="text-xs">Comercio</Label>
                <Select value={storeSlug} onValueChange={(v) => { setStoreSlug(v); if (type === 'product') loadProducts(v) }}>
                  <SelectTrigger><SelectValue placeholder="Elige un comercio" /></SelectTrigger>
                  <SelectContent>
                    {tenants.filter(t => t.slug).map(t => <SelectItem key={t.id} value={t.slug!}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {type === 'product' && storeSlug && (
              <div className="space-y-1.5">
                <Label className="text-xs">Producto</Label>
                {products.length > 0 ? (
                  <Select value={productId} onValueChange={setProductId}>
                    <SelectTrigger><SelectValue placeholder="Elige un producto" /></SelectTrigger>
                    <SelectContent className="max-h-64">
                      {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input placeholder="Pega el ID del producto (de la URL ?product=…)" value={productId} onChange={e => setProductId(e.target.value)} />
                )}
              </div>
            )}

            {createError && <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{createError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} disabled={creating}>Cancelar</Button>
            <Button onClick={submit} disabled={creating}>{creating ? 'Creando…' : 'Crear link'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── QR ─────────────────────────────────────────────── */}
      <Dialog open={!!qrFor} onOpenChange={(o) => { if (!o) setQrFor(null) }}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle className="text-base">{qrFor?.title || 'Código QR'}</DialogTitle></DialogHeader>
          {qrFor && <QrView url={fullUrl(qrFor.code)} title={qrFor.title || qrFor.code} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function QrView({ url, title }: { url: string; title: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const download = () => {
    const canvas = ref.current?.querySelector('canvas')
    if (!canvas) return
    const a = document.createElement('a')
    a.href = (canvas as HTMLCanvasElement).toDataURL('image/png')
    a.download = `qr-${title.replace(/[^\w]+/g, '-').slice(0, 30)}.png`
    a.click()
  }
  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <div ref={ref} className="rounded-lg bg-white p-3">
        <QRCodeCanvas value={url} size={180} level="M" includeMargin />
      </div>
      <code className="max-w-full truncate text-xs text-muted-foreground">{url}</code>
      <Button variant="outline" size="sm" onClick={download}><Download className="mr-1 h-4 w-4" /> Descargar PNG</Button>
    </div>
  )
}
