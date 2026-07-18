'use client'

/**
 * Editor visual de Plantillas Dinámicas de Producto (JSON-driven, tipo Shopify).
 *
 * Fase 1.5: no conoce ningún bloque. Catálogo, defaults, formulario, preview y
 * render se derivan del Block Registry (`lib/product-blocks`), única fuente de
 * verdad. Agregar un bloque no requiere tocar este archivo.
 *
 * - Lista de plantillas con estados draft/published/archived + duplicar.
 * - Editor por secciones: agregar del catálogo, reordenar (drag nativo + flechas),
 *   ocultar/duplicar/eliminar, settings por tipo, vista previa en vivo con el
 *   MISMO SectionRenderer que usa la tienda (un solo código de render).
 * - Versionado real: guardar escribe el borrador; publicar crea versión y
 *   refresca la tienda; historial con rollback.
 * - Asignación masiva a productos + contenido único por producto (page_content).
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  LayoutTemplate, Plus, Copy, Archive, Pencil, GripVertical, Eye, EyeOff,
  Trash2, ChevronUp, ChevronDown, Loader2, Sparkles, PackageCheck, Search, ArrowLeft,
  History, RotateCcw, Monitor, Smartphone, Sun, Moon, AlertTriangle,
} from 'lucide-react'
import { SectionRenderer } from '@/components/product-template/SectionRenderer'
import type { TemplateSection, SectionRendererCtx } from '@/lib/product-blocks/types'
import { BLOCKS, getBlock, newSection } from '@/lib/product-blocks/registry'
import { ListEditor } from '@/lib/product-blocks/shared'

// Producto de muestra para previsualizar sin depender de la tienda real
const SAMPLE_IMG = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600'
const SAMPLE_CTX: SectionRendererCtx = {
  product: {
    name: 'Producto de ejemplo', salePrice: 99000, offerPrice: 79000, isOnOffer: true, stock: 7,
    brand: 'Mi Marca', category: 'General', description: 'Descripción de ejemplo del producto para previsualizar la plantilla.',
    images: [SAMPLE_IMG, SAMPLE_IMG + '&sat=-50'], imageUrl: SAMPLE_IMG,
  },
  store: { name: 'Mi Tienda', whatsapp: '3000000000' },
  formatPrice: (v: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v),
  reviews: [
    { rating: 5, text: '¡Excelente calidad, llegó rapidísimo!', author: 'Cliente feliz', verified: true },
    { rating: 4, text: 'Muy buen producto, lo recomiendo.', author: 'Compradora', verified: true },
  ],
  relatedProducts: [
    { id: '1', name: 'Producto relacionado A', price: 59000, imageUrl: null },
    { id: '2', name: 'Producto relacionado B', price: 89000, imageUrl: null },
  ],
  isLightBg: true,
}

interface TemplateRow {
  id: string
  name: string
  description: string | null
  sections: TemplateSection[]
  status: 'draft' | 'published' | 'archived'
  productCount?: number
  hasDraft?: boolean
}

interface VersionRow {
  id: string
  version: number
  status: 'draft' | 'published' | 'archived'
  sectionCount: number
  publishedAt: string | null
  createdAt: string
}

const STATUS_LABEL: Record<string, string> = { draft: 'Borrador', published: 'Publicada', archived: 'Archivada' }

const parseMaybeJson = (v: any) => {
  if (!v) return null
  if (typeof v !== 'string') return v
  try { return JSON.parse(v) } catch { return null }
}

// ── Modal de contenido único por producto (page_content) ──────────────────────

function PageContentModal({ product, onClose }: { product: any; onClose: () => void }) {
  const [content, setContent] = useState<any>(() => {
    const parsed = parseMaybeJson(product.pageContent) || {}
    return { videoUrl: '', benefits: [], faqs: [], testimonials: [], ...parsed }
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    const clean = {
      videoUrl: content.videoUrl || undefined,
      benefits: (content.benefits || []).filter((b: any) => b?.text),
      faqs: (content.faqs || []).filter((f: any) => f?.q && f?.a),
      testimonials: (content.testimonials || []).filter((t: any) => t?.text).map((t: any) => ({
        ...t,
        // Rating opcional: si no lo puso, NO se inventa 5★ — el bloque lo
        // muestra sin estrellas y etiquetado como "Testimonio".
        rating: t.rating ? Number(t.rating) : undefined,
      })),
    }
    const empty = !clean.videoUrl && !clean.benefits.length && !clean.faqs.length && !clean.testimonials.length
    const res = await api.setProductPageContent(String(product.id), empty ? null : clean)
    setSaving(false)
    if (res.success) onClose()
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Contenido de página · {product.name}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Contenido ÚNICO de este producto. Las secciones de la plantilla lo suman automáticamente
            (video propio, beneficios, FAQs y testimonios adicionales).
          </p>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium mb-1 block">Video propio (YouTube/TikTok/MP4)</label>
            <Input value={content.videoUrl || ''} onChange={e => setContent({ ...content, videoUrl: e.target.value })} className="h-8 text-xs" />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Beneficios propios</label>
            <ListEditor items={content.benefits || []} onChange={v => setContent({ ...content, benefits: v })}
              addLabel="Agregar beneficio" fields={[{ key: 'icon', label: 'Emoji' }, { key: 'text', label: 'Texto' }]} />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">FAQs propias</label>
            <ListEditor items={content.faqs || []} onChange={v => setContent({ ...content, faqs: v })}
              addLabel="Agregar pregunta" fields={[{ key: 'q', label: 'Pregunta' }, { key: 'a', label: 'Respuesta', long: true }]} />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Testimonios manuales</label>
            <ListEditor items={content.testimonials || []} onChange={v => setContent({ ...content, testimonials: v })}
              addLabel="Agregar testimonio"
              fields={[
                { key: 'name', label: 'Nombre' },
                { key: 'rating', label: 'Calificación 1-5 (opcional)' },
                { key: 'text', label: 'Testimonio', long: true },
              ]} />
            <p className="text-[10px] text-muted-foreground mt-1.5">
              Estos testimonios se muestran etiquetados como “Testimonio”, nunca como “Compra
              verificada”: ese distintivo lo llevan solo las reseñas de compras reales. Si no pones
              calificación, no se muestran estrellas.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar contenido'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Modal de asignación a productos ────────────────────────────────────────────

function AssignModal({ template, onClose, onAssigned }: { template: TemplateRow; onClose: () => void; onAssigned: () => void }) {
  const [products, setProducts] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [contentFor, setContentFor] = useState<any | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.getProducts({ limit: 100, search: search || undefined }).then(res => {
      if (cancelled) return
      const list = (res as any)?.data?.products || (res as any)?.data || []
      setProducts(Array.isArray(list) ? list : [])
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [search])

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const assign = async (templateId: string | null) => {
    if (selected.size === 0) return
    setSaving(true)
    const res = await api.assignProductTemplate([...selected], templateId)
    setSaving(false)
    if (res.success) { onAssigned(); onClose() }
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Asignar &quot;{template.name}&quot; a productos</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Buscar producto o categoría…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
        </div>
        <div className="max-h-72 overflow-y-auto border rounded-lg divide-y">
          {loading ? (
            <p className="text-xs text-muted-foreground text-center py-6">Cargando productos…</p>
          ) : products.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Sin resultados</p>
          ) : products.map((p: any) => (
            <label key={p.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-muted/50">
              <input type="checkbox" checked={selected.has(String(p.id))} onChange={() => toggle(String(p.id))} />
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-medium truncate">{p.name}</span>
                <span className="block text-[10px] text-muted-foreground">{p.category}{p.templateId ? ' · ya tiene plantilla' : ''}</span>
              </span>
              <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2 shrink-0"
                onClick={e => { e.preventDefault(); setContentFor(p) }}>
                Contenido
              </Button>
            </label>
          ))}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => assign(null)} disabled={selected.size === 0 || saving}>
            Quitar plantilla
          </Button>
          <Button size="sm" onClick={() => assign(template.id)} disabled={selected.size === 0 || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><PackageCheck className="h-4 w-4 mr-1.5" />Asignar a {selected.size}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
      {contentFor && <PageContentModal product={contentFor} onClose={() => setContentFor(null)} />}
    </Dialog>
  )
}

// ── Modal de historial de versiones ───────────────────────────────────────────

function VersionsModal({ template, onClose, onRolledBack }: {
  template: TemplateRow; onClose: () => void; onRolledBack: () => void
}) {
  const [versions, setVersions] = useState<VersionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<number | null>(null)

  const load = useCallback(async () => {
    const res = await api.getProductTemplateVersions(template.id)
    if (res.success && Array.isArray(res.data)) setVersions(res.data)
    setLoading(false)
  }, [template.id])

  useEffect(() => { load() }, [load])

  const rollback = async (version: number) => {
    setBusy(version)
    const res = await api.rollbackProductTemplate(template.id, version)
    setBusy(null)
    if (res.success) { onRolledBack(); onClose() }
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />Historial de versiones
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Volver a una versión la copia en una versión nueva y la publica. Nada se sobrescribe.
            La tienda puede tardar hasta 60 s en reflejarlo (caché).
          </p>
        </DialogHeader>
        {loading ? (
          <p className="text-xs text-muted-foreground text-center py-6">Cargando…</p>
        ) : (
          <div className="max-h-80 overflow-y-auto border rounded-lg divide-y">
            {versions.map(v => (
              <div key={v.id} className="flex items-center gap-2 px-3 py-2.5">
                <span className="text-xs font-semibold w-9 shrink-0">v{v.version}</span>
                <span className="flex-1 min-w-0">
                  <Badge variant={v.status === 'published' ? 'default' : v.status === 'draft' ? 'secondary' : 'outline'} className="text-[10px]">
                    {STATUS_LABEL[v.status]}
                  </Badge>
                  <span className="block text-[10px] text-muted-foreground mt-0.5">
                    {v.sectionCount} secciones · {new Date(v.publishedAt || v.createdAt).toLocaleString('es-CO')}
                  </span>
                </span>
                {v.status !== 'published' && (
                  <Button variant="outline" size="sm" className="h-7 text-[10px] shrink-0"
                    onClick={() => rollback(v.version)} disabled={busy != null}>
                    {busy === v.version ? <Loader2 className="h-3 w-3 animate-spin" /> : <><RotateCcw className="h-3 w-3 mr-1" />Volver aquí</>}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Componente principal ───────────────────────────────────────────────────────

export function ProductTemplateEditor() {
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<TemplateRow | null>(null)
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(true)
  const [saving, setSaving] = useState(false)
  const [assignFor, setAssignFor] = useState<TemplateRow | null>(null)
  const [versionsFor, setVersionsFor] = useState<TemplateRow | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  // Preview
  const [previewMobile, setPreviewMobile] = useState(false)
  const [previewLight, setPreviewLight] = useState(true)
  const [previewProducts, setPreviewProducts] = useState<any[]>([])
  const [previewProductId, setPreviewProductId] = useState<string>('')

  // Dirty state: instantánea de lo último guardado vs lo que hay en pantalla.
  // Estado DERIVADO (no useEffect + setState): no puede quedar desincronizado.
  const [savedSnapshot, setSavedSnapshot] = useState('')

  const fetchTemplates = useCallback(async () => {
    const res = await api.getProductTemplates()
    if (res.success && Array.isArray(res.data)) setTemplates(res.data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  // Productos reales para la vista previa
  useEffect(() => {
    api.getProducts({ limit: 50 }).then(res => {
      const list = (res as any)?.data?.products || (res as any)?.data || []
      if (Array.isArray(list)) setPreviewProducts(list)
    }).catch(() => { /* preview cae al producto de ejemplo */ })
  }, [])

  const snapshotOf = (t: TemplateRow | null) =>
    t ? JSON.stringify({ name: t.name, description: t.description, sections: t.sections }) : ''

  const dirty = useMemo(
    () => !!editing && snapshotOf(editing) !== savedSnapshot,
    [editing, savedSnapshot],
  )

  // Protección del navegador (recargar/cerrar pestaña)
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const openEditor = (t: TemplateRow) => {
    setSavedSnapshot(snapshotOf(t))
    setEditing(t)
    setSelectedSectionId(t.sections[0]?.id || null)
  }

  const closeEditor = () => {
    if (dirty && !window.confirm('Tienes cambios sin guardar. ¿Salir y perderlos?')) return
    setEditing(null)
  }

  const seedDefaults = async () => {
    setLoading(true)
    await api.seedDefaultTemplates()
    await fetchTemplates()
  }

  const createBlank = async () => {
    const res = await api.createProductTemplate({ name: 'Nueva plantilla', sections: [] })
    if (res.success && res.data) {
      await fetchTemplates()
      openEditor(res.data)
    }
  }

  // ── Mutaciones locales del editor (se persisten con Guardar) ──
  const updSections = (fn: (secs: TemplateSection[]) => TemplateSection[]) => {
    setEditing(prev => prev ? { ...prev, sections: fn(prev.sections).map((s, i) => ({ ...s, order: i })) } : prev)
  }

  const addSection = (type: string) => {
    setEditing(prev => {
      if (!prev) return prev
      const sec = newSection(type, prev.sections.length)
      setSelectedSectionId(sec.id)
      return { ...prev, sections: [...prev.sections, sec].map((s, i) => ({ ...s, order: i })) }
    })
  }

  const move = (from: number, to: number) => {
    updSections(secs => {
      if (to < 0 || to >= secs.length) return secs
      const next = [...secs]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }

  const save = async (publish?: boolean) => {
    if (!editing) return
    setSaving(true)
    const res = await api.updateProductTemplate(editing.id, {
      name: editing.name,
      description: editing.description || undefined,
      sections: editing.sections,
    })
    if (res.success && publish) {
      await api.setProductTemplateStatus(editing.id, 'published')
    }
    setSaving(false)
    if (res.success) {
      setSavedSnapshot(snapshotOf(editing))
      await fetchTemplates()
      if (publish) setEditing(null)
    }
  }

  // Contexto de preview: producto real elegido, o el de ejemplo
  const previewCtx: SectionRendererCtx = useMemo(() => {
    const base: SectionRendererCtx = { ...SAMPLE_CTX, isLightBg: previewLight }
    if (!previewProductId) return base
    const p = previewProducts.find(x => String(x.id) === previewProductId)
    if (!p) return base
    return {
      ...base,
      product: {
        name: p.name,
        salePrice: p.salePrice,
        offerPrice: p.offerPrice ?? null,
        isOnOffer: p.isOnOffer,
        stock: p.stock,
        brand: p.brand || null,
        category: p.category || null,
        description: p.description || null,
        images: Array.isArray(p.images) ? p.images : null,
        imageUrl: p.imageUrl || null,
      },
      pageContent: parseMaybeJson(p.pageContent),
      // Sin reseñas reales cargadas aquí: el bloque de testimonios mostrará solo
      // los testimonios manuales del producto, que es justo lo que se está editando.
      reviews: [],
    }
  }, [previewProductId, previewProducts, previewLight])

  // ═══════════ Vista LISTA ═══════════
  if (!editing) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <LayoutTemplate className="h-4 w-4" />
              Plantillas de producto
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Convierte cada producto en una landing de venta: diseña secciones una vez y reutilízalas en cientos de productos.
            </p>
          </div>
          <div className="flex gap-2">
            {templates.length === 0 && !loading && (
              <Button variant="outline" size="sm" onClick={seedDefaults}>
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />Crear ejemplos
              </Button>
            )}
            <Button size="sm" onClick={createBlank}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />Nueva
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Cargando…</p>
          ) : templates.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <LayoutTemplate className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Aún no tienes plantillas. Crea las de ejemplo (Moda, Tecnología, Belleza) o empieza desde cero.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map(t => (
                <div key={t.id} className="rounded-xl border p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold leading-tight">{t.name}</p>
                    <Badge variant={t.status === 'published' ? 'default' : t.status === 'draft' ? 'secondary' : 'outline'}>
                      {STATUS_LABEL[t.status]}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t.sections.length} secciones · {t.productCount || 0} productos
                  </p>
                  {t.hasDraft && (
                    <p className="text-[10px] text-amber-600 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />Borrador sin publicar
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <Button variant="outline" size="sm" onClick={() => openEditor(t)}>
                      <Pencil className="h-3 w-3 mr-1" />Editar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setAssignFor(t)} disabled={t.status !== 'published'}
                      title={t.status !== 'published' ? 'Publica la plantilla para asignarla' : undefined}>
                      <PackageCheck className="h-3 w-3 mr-1" />Asignar
                    </Button>
                    <Button variant="ghost" size="icon" title="Historial de versiones" onClick={() => setVersionsFor(t)}>
                      <History className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Duplicar"
                      onClick={async () => { await api.duplicateProductTemplate(t.id); fetchTemplates() }}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Archivar" className="text-muted-foreground"
                      onClick={async () => { await api.deleteProductTemplate(t.id); fetchTemplates() }}>
                      <Archive className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
        {assignFor && (
          <AssignModal template={assignFor} onClose={() => setAssignFor(null)} onAssigned={fetchTemplates} />
        )}
        {versionsFor && (
          <VersionsModal template={versionsFor} onClose={() => setVersionsFor(null)} onRolledBack={fetchTemplates} />
        )}
      </Card>
    )
  }

  // ═══════════ Vista EDITOR ═══════════
  const selected = editing.sections.find(s => s.id === selectedSectionId) || null
  const selectedDef = selected ? getBlock(selected.type) : null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Button variant="ghost" size="icon" onClick={closeEditor} title="Volver">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}
            className="h-9 text-sm font-semibold max-w-xs" />
          <Badge variant={editing.status === 'published' ? 'default' : 'secondary'}>{STATUS_LABEL[editing.status]}</Badge>
          {dirty && (
            <span className="text-[11px] font-medium text-amber-600 flex items-center gap-1 shrink-0">
              <AlertTriangle className="h-3 w-3" />Cambios sin guardar
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setVersionsFor(editing)} title="Historial de versiones">
            <History className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowPreview(v => !v)}>
            <Eye className="h-3.5 w-3.5 mr-1.5" />{showPreview ? 'Ocultar vista' : 'Vista previa'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => save(false)} disabled={saving || !dirty}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Guardar borrador'}
          </Button>
          <Button size="sm" onClick={() => save(true)} disabled={saving}>
            Publicar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {editing.status === 'published' && (
          <p className="text-[11px] text-muted-foreground mb-3">
            Esta plantilla está en vivo. Guardar borrador NO afecta la tienda: los cambios llegan al publicar.
          </p>
        )}
        <div className="grid gap-4 lg:grid-cols-[280px_320px_1fr]">
          {/* Columna 1: secciones (drag nativo + flechas) + catálogo */}
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Secciones</p>
              {editing.sections.length === 0 && (
                <p className="text-xs text-muted-foreground border rounded-lg p-3">Agrega secciones del catálogo de abajo ↓</p>
              )}
              <div className="space-y-1.5">
                {editing.sections.map((s, i) => (
                  <div
                    key={s.id}
                    draggable
                    onDragStart={() => setDragIndex(i)}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => { if (dragIndex !== null && dragIndex !== i) move(dragIndex, i); setDragIndex(null) }}
                    onClick={() => setSelectedSectionId(s.id)}
                    className={`flex items-center gap-1.5 rounded-lg border px-2 py-2 cursor-pointer transition-colors ${
                      selectedSectionId === s.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                    } ${s.visible === false ? 'opacity-50' : ''}`}
                  >
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab shrink-0" />
                    <span className="flex-1 text-xs font-medium truncate">{getBlock(s.type)?.label || s.type}</span>
                    <button onClick={e => { e.stopPropagation(); move(i, i - 1) }} className="text-muted-foreground hover:text-foreground" title="Subir">
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={e => { e.stopPropagation(); move(i, i + 1) }} className="text-muted-foreground hover:text-foreground" title="Bajar">
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); updSections(secs => secs.map(x => x.id === s.id ? { ...x, visible: x.visible === false } : x)) }}
                      className="text-muted-foreground hover:text-foreground" title={s.visible === false ? 'Mostrar' : 'Ocultar'}>
                      {s.visible === false ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        const id = `sec-${Date.now().toString(36)}`
                        updSections(secs => {
                          const next = [...secs]
                          next.splice(i + 1, 0, { ...s, id, settings: JSON.parse(JSON.stringify(s.settings)) })
                          return next
                        })
                      }}
                      className="text-muted-foreground hover:text-foreground" title="Duplicar">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); updSections(secs => secs.filter(x => x.id !== s.id)); if (selectedSectionId === s.id) setSelectedSectionId(null) }}
                      className="text-muted-foreground hover:text-destructive" title="Eliminar">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Agregar sección</p>
              <div className="grid grid-cols-2 gap-1.5">
                {BLOCKS.map(b => (
                  <button key={b.type} onClick={() => addSection(b.type)} title={b.desc}
                    className="text-left text-[11px] font-medium rounded-lg border px-2 py-2 hover:bg-muted/60 transition-colors">
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Columna 2: settings de la sección seleccionada (formulario del registry) */}
          <div className="border rounded-xl p-3 max-h-[560px] overflow-y-auto">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              {selected ? `Configurar: ${selectedDef?.label || selected.type}` : 'Configuración'}
            </p>
            {selected && selectedDef ? (
              <selectedDef.Editor
                key={selected.id}
                settings={selected.settings}
                set={(key, value) => updSections(secs => secs.map(x =>
                  x.id === selected.id ? { ...x, settings: { ...x.settings, [key]: value } } : x
                ))}
              />
            ) : selected ? (
              <p className="text-xs text-muted-foreground">
                Bloque «{selected.type}» desconocido en esta versión. Se conserva tal cual y se ignora al renderizar.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Selecciona una sección para configurarla. Puedes usar variables como {'{{product.title}}'}, {'{{product.price}}'} o {'{{product.stock}}'}.</p>
            )}
          </div>

          {/* Columna 3: vista previa (mismo renderer que la tienda) */}
          {showPreview && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <select value={previewProductId} onChange={e => setPreviewProductId(e.target.value)}
                  className="h-7 text-[11px] border rounded-md bg-background px-1.5 max-w-[160px]">
                  <option value="">Producto de ejemplo</option>
                  {previewProducts.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                </select>
                <div className="flex rounded-md border overflow-hidden">
                  <button onClick={() => setPreviewMobile(false)} title="Escritorio"
                    className={`px-1.5 py-1 ${!previewMobile ? 'bg-muted' : ''}`}><Monitor className="h-3.5 w-3.5" /></button>
                  <button onClick={() => setPreviewMobile(true)} title="Móvil"
                    className={`px-1.5 py-1 ${previewMobile ? 'bg-muted' : ''}`}><Smartphone className="h-3.5 w-3.5" /></button>
                </div>
                <div className="flex rounded-md border overflow-hidden">
                  <button onClick={() => setPreviewLight(true)} title="Tema claro"
                    className={`px-1.5 py-1 ${previewLight ? 'bg-muted' : ''}`}><Sun className="h-3.5 w-3.5" /></button>
                  <button onClick={() => setPreviewLight(false)} title="Tema oscuro"
                    className={`px-1.5 py-1 ${!previewLight ? 'bg-muted' : ''}`}><Moon className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              <div className={`border rounded-xl p-4 max-h-[560px] overflow-y-auto ${previewLight ? 'bg-white' : 'bg-neutral-900'}`}>
                <div className={previewMobile ? 'max-w-[380px] mx-auto' : ''}>
                  <p className={`text-[10px] font-semibold uppercase tracking-wider mb-4 ${previewLight ? 'text-gray-400' : 'text-white/40'}`}>
                    Vista previa · {previewProductId ? 'producto real' : 'producto de ejemplo'}
                  </p>
                  {editing.sections.length === 0 ? (
                    <p className={`text-xs ${previewLight ? 'text-gray-400' : 'text-white/40'}`}>La vista previa aparecerá al agregar secciones.</p>
                  ) : (
                    <SectionRenderer sections={editing.sections} ctx={previewCtx} />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
      {versionsFor && (
        <VersionsModal template={versionsFor} onClose={() => setVersionsFor(null)}
          onRolledBack={async () => { await fetchTemplates(); setEditing(null) }} />
      )}
    </Card>
  )
}
