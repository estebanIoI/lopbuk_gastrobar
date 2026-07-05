'use client'

/**
 * Editor visual de Plantillas Dinámicas de Producto (JSON-driven, tipo Shopify).
 * - Lista de plantillas con estados draft/published/archived + duplicar.
 * - Editor por secciones: agregar del catálogo, reordenar (drag nativo + flechas),
 *   ocultar/duplicar/eliminar, settings por tipo, vista previa en vivo con el
 *   MISMO SectionRenderer que usa la tienda (un solo código de render).
 * - Asignación masiva a productos + contenido único por producto (page_content).
 */

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  LayoutTemplate, Plus, Copy, Archive, Pencil, GripVertical, Eye, EyeOff,
  Trash2, ChevronUp, ChevronDown, Loader2, Sparkles, PackageCheck, Search, ArrowLeft,
} from 'lucide-react'
import { SectionRenderer, type TemplateSection, type SectionType } from '@/components/product-template/SectionRenderer'

// ── Catálogo de secciones (labels + settings por defecto) ──────────────────────

const SECTION_CATALOG: Array<{ type: SectionType; label: string; desc: string; defaults: Record<string, any> }> = [
  { type: 'benefits', label: '✓ Beneficios', desc: 'Bloques de valor (envío, garantía, calidad)', defaults: { title: '¿Por qué elegir {{product.title}}?', columns: 2, items: [{ icon: '🚚', text: 'Envío rápido a todo el país' }, { icon: '✅', text: 'Calidad garantizada' }] } },
  { type: 'rich_text', label: '📝 Texto enriquecido', desc: 'Título + texto con negritas y listas + imagen', defaults: { title: '', body: '{{product.description}}', imageUrl: '', imagePosition: 'right' } },
  { type: 'video', label: '🎬 Video', desc: 'YouTube, TikTok o MP4', defaults: { title: 'Míralo en acción', url: '' } },
  { type: 'faq', label: '❓ FAQ', desc: 'Preguntas frecuentes en acordeón', defaults: { title: 'Preguntas frecuentes', items: [{ q: '¿Cuánto tarda el envío?', a: 'Entre 2 y 5 días hábiles según tu ciudad.' }] } },
  { type: 'testimonials', label: '⭐ Testimonios', desc: 'Reviews aprobadas del producto (automático)', defaults: { title: 'Lo que dicen nuestros clientes', maxItems: 6 } },
  { type: 'comparison', label: '⚖️ Comparación', desc: 'Tu producto vs la competencia', defaults: { title: '{{product.title}} vs otros', ourLabel: '{{product.title}}', theirLabel: 'Otros', rows: [{ feature: 'Garantía', ours: '✓ Incluida', theirs: '✗' }] } },
  { type: 'urgency', label: '🔥 Urgencia', desc: 'Stock real y/o cuenta regresiva', defaults: { message: '🔥 Quedan {{product.stock}} unidades', showStock: true, deadline: '' } },
  { type: 'guarantees', label: '🛡️ Garantías', desc: 'Trust badges de confianza', defaults: { items: [{ icon: '🛡️', title: 'Garantía', text: 'Por defectos de fábrica' }, { icon: '💵', title: 'Contra entrega', text: 'Paga al recibir' }] } },
  { type: 'image_banner', label: '🖼️ Banner', desc: 'Imagen full-width con texto y botón', defaults: { imageUrl: '', title: '', subtitle: '', ctaText: '' } },
  { type: 'related', label: '🛍️ Relacionados', desc: 'Productos de la misma categoría/marca', defaults: { title: 'También te puede gustar', maxItems: 4 } },
]

const catalogFor = (type: SectionType) => SECTION_CATALOG.find(c => c.type === type)

// Producto de muestra para la vista previa del editor
const SAMPLE_CTX = {
  product: { name: 'Producto de ejemplo', salePrice: 99000, offerPrice: 79000, isOnOffer: true, stock: 7, brand: 'Mi Marca', category: 'General', description: 'Descripción de ejemplo del producto para previsualizar la plantilla.' },
  store: { name: 'Mi Tienda', whatsapp: '3000000000' },
  reviews: [
    { rating: 5, text: '¡Excelente calidad, llegó rapidísimo!', author: 'Cliente feliz' },
    { rating: 4, text: 'Muy buen producto, lo recomiendo.', author: 'Compradora verificada' },
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
}

const STATUS_LABEL: Record<string, string> = { draft: 'Borrador', published: 'Publicada', archived: 'Archivada' }

// ── Sub-editores de listas (items de beneficios/faq/filas) ─────────────────────

function ListEditor({ items, fields, onChange, addLabel }: {
  items: any[]
  fields: Array<{ key: string; label: string; long?: boolean }>
  onChange: (items: any[]) => void
  addLabel: string
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="rounded-lg border p-2 space-y-1.5 relative">
          <button
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="absolute top-1.5 right-1.5 text-muted-foreground hover:text-destructive"
            title="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          {fields.map(f => (
            f.long ? (
              <Textarea key={f.key} rows={2} placeholder={f.label} value={item[f.key] || ''}
                onChange={e => onChange(items.map((it, j) => j === i ? { ...it, [f.key]: e.target.value } : it))}
                className="text-xs" />
            ) : (
              <Input key={f.key} placeholder={f.label} value={item[f.key] || ''}
                onChange={e => onChange(items.map((it, j) => j === i ? { ...it, [f.key]: e.target.value } : it))}
                className={`text-xs h-8 ${f.key === 'icon' ? 'w-20 inline-block mr-1.5' : ''}`} />
            )
          ))}
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full" onClick={() => onChange([...items, {}])}>
        <Plus className="h-3.5 w-3.5 mr-1.5" />{addLabel}
      </Button>
    </div>
  )
}

// ── Form de settings por tipo de sección ───────────────────────────────────────

function SectionSettingsForm({ section, onChange }: { section: TemplateSection; onChange: (settings: Record<string, any>) => void }) {
  const s = section.settings
  const set = (key: string, value: any) => onChange({ ...s, [key]: value })
  const text = (key: string, label: string) => (
    <div>
      <label className="text-xs font-medium mb-1 block">{label}</label>
      <Input value={s[key] || ''} onChange={e => set(key, e.target.value)} className="h-8 text-xs" />
    </div>
  )

  switch (section.type) {
    case 'benefits':
      return (<div className="space-y-3">
        {text('title', 'Título')}
        <div>
          <label className="text-xs font-medium mb-1 block">Columnas</label>
          <select value={String(s.columns || 2)} onChange={e => set('columns', Number(e.target.value))} className="w-full h-8 text-xs border rounded-md bg-background px-2">
            <option value="2">2 columnas</option><option value="3">3 columnas</option>
          </select>
        </div>
        <ListEditor items={s.items || []} onChange={v => set('items', v)} addLabel="Agregar beneficio"
          fields={[{ key: 'icon', label: 'Emoji' }, { key: 'text', label: 'Texto del beneficio' }]} />
      </div>)
    case 'rich_text':
      return (<div className="space-y-3">
        {text('title', 'Título')}
        <div>
          <label className="text-xs font-medium mb-1 block">Texto (usa **negrita**, "- " para listas y {'{{product.description}}'})</label>
          <Textarea rows={6} value={s.body || ''} onChange={e => set('body', e.target.value)} className="text-xs" />
        </div>
        {text('imageUrl', 'URL de imagen (opcional)')}
        <div>
          <label className="text-xs font-medium mb-1 block">Posición de la imagen</label>
          <select value={s.imagePosition || 'right'} onChange={e => set('imagePosition', e.target.value)} className="w-full h-8 text-xs border rounded-md bg-background px-2">
            <option value="right">Derecha</option><option value="left">Izquierda</option>
          </select>
        </div>
      </div>)
    case 'video':
      return (<div className="space-y-3">
        {text('title', 'Título')}
        {text('url', 'URL (YouTube, TikTok o .mp4)')}
        <p className="text-[10px] text-muted-foreground">Si se deja vacío, usa el video propio del producto (contenido de página).</p>
      </div>)
    case 'faq':
      return (<div className="space-y-3">
        {text('title', 'Título')}
        <ListEditor items={s.items || []} onChange={v => set('items', v)} addLabel="Agregar pregunta"
          fields={[{ key: 'q', label: 'Pregunta' }, { key: 'a', label: 'Respuesta', long: true }]} />
        <p className="text-[10px] text-muted-foreground">Las FAQs propias de cada producto se suman automáticamente.</p>
      </div>)
    case 'testimonials':
      return (<div className="space-y-3">
        {text('title', 'Título')}
        <div>
          <label className="text-xs font-medium mb-1 block">Máximo a mostrar</label>
          <Input type="number" min={1} max={12} value={s.maxItems || 6} onChange={e => set('maxItems', Number(e.target.value))} className="h-8 text-xs w-24" />
        </div>
        <p className="text-[10px] text-muted-foreground">Muestra automáticamente las reseñas APROBADAS del producto + los testimonios manuales del contenido de página.</p>
      </div>)
    case 'comparison':
      return (<div className="space-y-3">
        {text('title', 'Título')}
        {text('ourLabel', 'Etiqueta de tu producto')}
        {text('theirLabel', 'Etiqueta de la competencia')}
        <ListEditor items={s.rows || []} onChange={v => set('rows', v)} addLabel="Agregar fila"
          fields={[{ key: 'feature', label: 'Característica' }, { key: 'ours', label: 'Tu producto (ej: ✓ Incluida)' }, { key: 'theirs', label: 'Otros (ej: ✗)' }]} />
      </div>)
    case 'urgency':
      return (<div className="space-y-3">
        {text('message', 'Mensaje (usa {{product.stock}})')}
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={s.showStock !== false} onChange={e => set('showStock', e.target.checked)} />
          Mostrar solo si hay stock real
        </label>
        <div>
          <label className="text-xs font-medium mb-1 block">Fecha límite (cuenta regresiva, opcional)</label>
          <Input type="datetime-local" value={s.deadline || ''} onChange={e => set('deadline', e.target.value)} className="h-8 text-xs" />
        </div>
      </div>)
    case 'guarantees':
      return (<ListEditor items={s.items || []} onChange={v => set('items', v)} addLabel="Agregar garantía"
        fields={[{ key: 'icon', label: 'Emoji' }, { key: 'title', label: 'Título' }, { key: 'text', label: 'Descripción' }]} />)
    case 'image_banner':
      return (<div className="space-y-3">
        {text('imageUrl', 'URL de imagen de fondo')}
        {text('title', 'Título')}
        {text('subtitle', 'Subtítulo')}
        {text('ctaText', 'Texto del botón (vacío = sin botón)')}
      </div>)
    case 'related':
      return (<div className="space-y-3">
        {text('title', 'Título')}
        <div>
          <label className="text-xs font-medium mb-1 block">Máximo a mostrar</label>
          <Input type="number" min={2} max={8} value={s.maxItems || 4} onChange={e => set('maxItems', Number(e.target.value))} className="h-8 text-xs w-24" />
        </div>
        <p className="text-[10px] text-muted-foreground">Reemplaza la sección nativa de relacionados (misma categoría/marca).</p>
      </div>)
    default:
      return <p className="text-xs text-muted-foreground">Sin configuración</p>
  }
}

// ── Modal de contenido único por producto (page_content) ──────────────────────

function PageContentModal({ product, onClose }: { product: any; onClose: () => void }) {
  const [content, setContent] = useState<any>(() => {
    const pc = product.pageContent
    if (!pc) return { videoUrl: '', benefits: [], faqs: [], testimonials: [] }
    const parsed = typeof pc === 'string' ? (() => { try { return JSON.parse(pc) } catch { return {} } })() : pc
    return { videoUrl: '', benefits: [], faqs: [], testimonials: [], ...parsed }
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    const clean = {
      videoUrl: content.videoUrl || undefined,
      benefits: (content.benefits || []).filter((b: any) => b?.text),
      faqs: (content.faqs || []).filter((f: any) => f?.q && f?.a),
      testimonials: (content.testimonials || []).filter((t: any) => t?.text),
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
              addLabel="Agregar testimonio" fields={[{ key: 'name', label: 'Nombre' }, { key: 'text', label: 'Testimonio', long: true }]} />
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
      const list = res?.data?.products || res?.data || []
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
          <DialogTitle className="text-base">Asignar "{template.name}" a productos</DialogTitle>
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

// ── Componente principal ───────────────────────────────────────────────────────

export function ProductTemplateEditor() {
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<TemplateRow | null>(null)
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(true)
  const [saving, setSaving] = useState(false)
  const [assignFor, setAssignFor] = useState<TemplateRow | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const fetchTemplates = useCallback(async () => {
    const res = await api.getProductTemplates()
    if (res.success && Array.isArray(res.data)) setTemplates(res.data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  const seedDefaults = async () => {
    setLoading(true)
    await api.seedDefaultTemplates()
    await fetchTemplates()
  }

  const createBlank = async () => {
    const res = await api.createProductTemplate({ name: 'Nueva plantilla', sections: [] })
    if (res.success && res.data) {
      await fetchTemplates()
      setEditing(res.data)
    }
  }

  // ── Mutaciones locales del editor (se persisten con Guardar) ──
  const updSections = (fn: (secs: TemplateSection[]) => TemplateSection[]) => {
    setEditing(prev => prev ? { ...prev, sections: fn(prev.sections).map((s, i) => ({ ...s, order: i })) } : prev)
  }

  const addSection = (type: SectionType) => {
    const cat = catalogFor(type)!
    const id = `sec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    updSections(secs => [...secs, { id, type, settings: JSON.parse(JSON.stringify(cat.defaults)), order: secs.length, visible: true }])
    setSelectedSectionId(id)
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
    if (res.success && publish !== undefined) {
      await api.setProductTemplateStatus(editing.id, publish ? 'published' : 'draft')
    }
    setSaving(false)
    if (res.success) {
      await fetchTemplates()
      if (publish !== undefined) setEditing(null)
    }
  }

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
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <Button variant="outline" size="sm" onClick={() => { setEditing(t); setSelectedSectionId(t.sections[0]?.id || null) }}>
                      <Pencil className="h-3 w-3 mr-1" />Editar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setAssignFor(t)} disabled={t.status !== 'published'}
                      title={t.status !== 'published' ? 'Publica la plantilla para asignarla' : undefined}>
                      <PackageCheck className="h-3 w-3 mr-1" />Asignar
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
      </Card>
    )
  }

  // ═══════════ Vista EDITOR ═══════════
  const selected = editing.sections.find(s => s.id === selectedSectionId) || null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => setEditing(null)} title="Volver">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}
            className="h-9 text-sm font-semibold max-w-xs" />
          <Badge variant={editing.status === 'published' ? 'default' : 'secondary'}>{STATUS_LABEL[editing.status]}</Badge>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setShowPreview(v => !v)}>
            <Eye className="h-3.5 w-3.5 mr-1.5" />{showPreview ? 'Ocultar vista' : 'Vista previa'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => save(false)} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Guardar borrador'}
          </Button>
          <Button size="sm" onClick={() => save(true)} disabled={saving}>
            Publicar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
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
                    <span className="flex-1 text-xs font-medium truncate">{catalogFor(s.type)?.label || s.type}</span>
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
                {SECTION_CATALOG.map(c => (
                  <button key={c.type} onClick={() => addSection(c.type)} title={c.desc}
                    className="text-left text-[11px] font-medium rounded-lg border px-2 py-2 hover:bg-muted/60 transition-colors">
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Columna 2: settings de la sección seleccionada */}
          <div className="border rounded-xl p-3 max-h-[560px] overflow-y-auto">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              {selected ? `Configurar: ${catalogFor(selected.type)?.label || selected.type}` : 'Configuración'}
            </p>
            {selected ? (
              <SectionSettingsForm
                key={selected.id}
                section={selected}
                onChange={settings => updSections(secs => secs.map(x => x.id === selected.id ? { ...x, settings } : x))}
              />
            ) : (
              <p className="text-xs text-muted-foreground">Selecciona una sección para configurarla. Puedes usar variables como {'{{product.title}}'}, {'{{product.price}}'} o {'{{product.stock}}'}.</p>
            )}
          </div>

          {/* Columna 3: vista previa (mismo renderer que la tienda) */}
          {showPreview && (
            <div className="border rounded-xl p-4 bg-white max-h-[560px] overflow-y-auto">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-4">Vista previa · producto de ejemplo</p>
              {editing.sections.length === 0 ? (
                <p className="text-xs text-gray-400">La vista previa aparecerá al agregar secciones.</p>
              ) : (
                <SectionRenderer sections={editing.sections} ctx={SAMPLE_CTX} />
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
