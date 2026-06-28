'use client'

import { useState, useEffect } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Loader2, CheckCircle2, XCircle, Package, ChevronRight,
  ChevronLeft, Image as ImageIcon, Settings, Layers, Eye,
} from 'lucide-react'
import { api, type CloudinaryImage } from '@/lib/api'
import { toast } from 'sonner'
import { useHormaMatrix, type Horma } from './useHormaMatrix'
import { resolveColorHex } from '@/lib/colors'

// ── Helpers ───────────────────────────────────────────────────────────────────

function suggestName(img: CloudinaryImage): string {
  return (img.original_filename || img.public_id?.split('/').pop() || '')
    .replace(/\.\w+$/, '')          // quitar extensión si queda en el filename
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim()
}

function suggestSku(img: CloudinaryImage, index: number): string {
  const base = (img.original_filename || img.public_id?.split('/').pop() || `prod-${index}`)
    .replace(/\.\w+$/, '')
    .replace(/[^a-zA-Z0-9]/g, '-')
    .toUpperCase()
    .slice(0, 20)
  return base
}

type RowStatus = 'pending' | 'creating' | 'done' | 'error'

interface ProductRow {
  image: CloudinaryImage
  name: string
  status: RowStatus
  error: string | null
  variantsCreated: number
}

type Step = 1 | 2 | 3 | 4

// ── Step indicators ───────────────────────────────────────────────────────────

const STEPS = [
  { n: 1 as Step, label: 'Resumen',  icon: ImageIcon },
  { n: 2 as Step, label: 'Config',   icon: Settings  },
  { n: 3 as Step, label: 'Hormas',   icon: Layers    },
  { n: 4 as Step, label: 'Crear',    icon: Eye       },
]

function StepBar({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-0 mb-5">
      {STEPS.map((s, i) => {
        const Icon = s.icon
        const done    = current > s.n
        const active  = current === s.n
        return (
          <div key={s.n} className="flex items-center gap-0 flex-1">
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors flex-1 justify-center
              ${active  ? 'bg-primary text-primary-foreground' : ''}
              ${done    ? 'bg-primary/20 text-primary' : ''}
              ${!active && !done ? 'text-muted-foreground' : ''}
            `}>
              {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Thumbnail compacto ────────────────────────────────────────────────────────

function Thumb({ img, size = 40 }: { img: CloudinaryImage; size?: number }) {
  const src = img.secure_url.replace('/upload/', `/upload/w_${size * 2},h_${size * 2},c_fill,q_auto,f_auto/`)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={img.original_filename}
      loading="lazy"
      className="rounded object-cover shrink-0"
      style={{ width: size, height: size }}
    />
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  images: CloudinaryImage[]
  open: boolean
  onClose: () => void
  onComplete?: (count: number) => void
}

// ── Componente principal ──────────────────────────────────────────────────────

export function CloudinaryBulkWizard({ images, open, onClose, onComplete }: Props) {
  const [step, setStep] = useState<Step>(1)

  // Step 1 — nombres
  const [rows, setRows] = useState<ProductRow[]>([])

  // Step 2 — config general
  const [category, setCategory]         = useState('')
  const [brand, setBrand]               = useState('')
  const [productType, setProductType]   = useState('ropa')
  const [status, setStatus]             = useState('1')
  const [categories, setCategories]     = useState<any[]>([])

  // Step 3 — hormas
  const horma = useHormaMatrix()
  const [hormasList, setHormasList]     = useState<Horma[]>([])
  const [hormasLoading, setHormasLoading] = useState(false)

  // Step 4 — creación
  const [creating, setCreating]         = useState(false)
  const [progress, setProgress]         = useState(0)

  // ── Init al abrir ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    setStep(1)
    setRows(images.map(img => ({
      image: img,
      name: suggestName(img),
      status: 'pending',
      error: null,
      variantsCreated: 0,
    })))
    setCategory('')
    setBrand('')
    setProductType('ropa')
    setStatus('1')
    setProgress(0)
    horma.reset()

    // Cargar datos en paralelo
    api.getCategories().then(r => {
      if (r.success && Array.isArray(r.data)) setCategories(r.data)
    })
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cargar hormas al llegar al Step 3
  useEffect(() => {
    if (step !== 3 || hormasList.length > 0) return
    setHormasLoading(true)
    api.getHormas().then(r => {
      if (r.success && r.data) setHormasList(r.data as Horma[])
    }).finally(() => setHormasLoading(false))
  }, [step, hormasList.length])

  // ── Handlers de nombre ────────────────────────────────────────────────────
  const updateName = (idx: number, val: string) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, name: val } : r))
  }

  // ── Validación por step ───────────────────────────────────────────────────
  const canNext = (): boolean => {
    if (step === 1) return rows.every(r => r.name.trim().length > 0)
    if (step === 2) return category.length > 0  // categoría requerida por el backend
    if (step === 3) return horma.selectedHormaIds.length > 0
    return false
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  const buildItemPayload = (row: ProductRow, idx: number) => {
    const slugify = (s: string) =>
      s.trim().toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9-]/g, '')
    const skuBase = (row.image.original_filename || row.image.public_id?.split('/').pop() || `prod-${idx}`)
      .replace(/\.\w+$/, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 14)
    // índice asegura SKUs únicos dentro del lote
    const productSku = `${skuBase}-${idx.toString(36).toUpperCase().padStart(2,'0')}`

    const product: any = {
      name:          row.name.trim(),
      imageUrl:      row.image.secure_url,
      stock:         0,
      reorderPoint:  0,
      purchasePrice: 0,
      salePrice:     0,
      is_active:     Number(status),
      productType,
      category,
      entryDate:     new Date().toISOString().split('T')[0],
      sku:           productSku,
    }
    if (brand) product.brand = brand

    const variantBase = skuBase.slice(0, 12) + (idx > 0 ? idx.toString(36).toUpperCase() : '0')
    const variants: any[] = []
    for (const hid of horma.selectedHormaIds) {
      const h = hormasList.find((x: any) => String(x.id) === String(hid))
      if (!h) continue
      const colors = h.colors || []
      const sizes  = h.sizeChart ? Object.keys(h.sizeChart) : []
      const prices = horma.hormaPrices[hid] || { purchasePrice: '', salePrice: '' }
      for (const colorObj of colors) {
        for (const size of sizes) {
          variants.push({
            sku:           `${variantBase}-${slugify(h.name || hid)}-${slugify(colorObj.color)}-${slugify(size)}`,
            color:         colorObj.color,
            colorHex:      colorObj.hex || null,
            size,
            hormaId:       hid,
            stock:         0,
            minStock:      0,
            costPrice:     prices.purchasePrice !== '' ? Number(prices.purchasePrice) : null,
            priceOverride: prices.salePrice     !== '' ? Number(prices.salePrice)     : null,
          })
        }
      }
    }

    return { product, variants }
  }

  // ── Creación masiva optimizada (Step 4) ───────────────────────────────────
  // Envía lotes de BATCH_SIZE productos por request → 1 transacción por lote
  // Para 200 productos × 215 variantes: 8 requests × 25 productos = 43,000 variantes
  const BATCH_SIZE = 25

  const handleCreate = async () => {
    const pending = rows.filter(r => r.status === 'pending')
    if (pending.length === 0) return

    setCreating(true)

    // Marcar todos como "creating" de una sola vez para no re-renderizar N veces
    setRows(prev => prev.map(r => r.status === 'pending' ? { ...r, status: 'creating' } : r))

    // Construir todos los payloads upfront
    const allItems = rows.map((row, idx) => ({ rowIdx: idx, ...buildItemPayload(row, idx) }))

    let totalDone = 0
    let totalErrors = 0

    // Dividir en batches de BATCH_SIZE
    for (let b = 0; b < allItems.length; b += BATCH_SIZE) {
      const batch = allItems.slice(b, b + BATCH_SIZE)
      const items = batch.map(({ product, variants }) => ({ product, variants }))

      try {
        const res = await api.bulkCreateProductsWithVariants(items)
        const data = (res as any).data

        if (!res.success && !data) {
          // Error completo del batch
          setRows(prev => {
            const next = [...prev]
            for (const item of batch) {
              next[item.rowIdx] = { ...next[item.rowIdx], status: 'error', error: (res as any).error || 'Error de lote' }
            }
            return next
          })
          totalErrors += batch.length
        } else {
          // Éxito parcial o total — leer results por posición
          const results: any[] = data?.results || []
          setRows(prev => {
            const next = [...prev]
            for (let k = 0; k < batch.length; k++) {
              const item   = batch[k]
              const result = results[k]
              if (result?.error) {
                next[item.rowIdx] = { ...next[item.rowIdx], status: 'error', error: result.error }
                totalErrors++
              } else {
                next[item.rowIdx] = { ...next[item.rowIdx], status: 'done', variantsCreated: result?.variantsCreated ?? 0 }
                totalDone++
              }
            }
            return next
          })
        }
      } catch (err: any) {
        setRows(prev => {
          const next = [...prev]
          for (const item of batch) {
            next[item.rowIdx] = { ...next[item.rowIdx], status: 'error', error: err.message || 'Error de red' }
          }
          return next
        })
        totalErrors += batch.length
      }

      // Actualizar progress después de cada batch
      const processed = Math.min(b + BATCH_SIZE, allItems.length)
      setProgress(Math.round((processed / allItems.length) * 100))
    }

    setCreating(false)
    if (totalDone > 0)   toast.success(`${totalDone} productos creados correctamente`)
    if (totalErrors > 0) toast.error(`${totalErrors} productos fallaron`)
    if (totalDone > 0 && onComplete) onComplete(totalDone)
  }

  // ── Estimados ─────────────────────────────────────────────────────────────
  const variantsPerProduct = horma.computeVariantCount(hormasList)
  const totalVariants      = rows.length * variantsPerProduct

  const pendingCount = rows.filter(r => r.status === 'pending').length
  const doneCount    = rows.filter(r => r.status === 'done').length
  const allDone      = doneCount === rows.length

  // ── Render por step ───────────────────────────────────────────────────────

  const renderStep1 = () => (
    <div className="flex-1 overflow-auto space-y-3">
      <p className="text-xs text-muted-foreground">
        Revisa y edita los nombres sugeridos. Cada imagen se convertirá en un producto.
      </p>
      <div className="rounded-lg border border-border overflow-auto max-h-[50vh]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/60 backdrop-blur">
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-12">Img</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Nombre del producto
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.image.public_id} className="border-b border-border/50 hover:bg-accent/10">
                <td className="px-3 py-2">
                  <Thumb img={row.image} size={40} />
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={row.name}
                    onChange={e => updateName(idx, e.target.value)}
                    placeholder="Nombre del producto"
                    className="h-8 text-xs"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Package className="h-3.5 w-3.5" />
        <span>{rows.length} productos · nombres auto-sugeridos desde el nombre de archivo</span>
      </div>
    </div>
  )

  const renderStep2 = () => (
    <div className="flex-1 overflow-auto space-y-4">
      <p className="text-xs text-muted-foreground">
        Esta configuración se aplicará a <strong>todos</strong> los {rows.length} productos.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Tipo de producto */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Tipo de producto</Label>
          <Select value={productType} onValueChange={setProductType}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ropa">👕 Ropa / Textiles</SelectItem>
              <SelectItem value="general">📦 General</SelectItem>
              <SelectItem value="electronica">💻 Electrónica</SelectItem>
              <SelectItem value="alimentos">🍔 Alimentos</SelectItem>
              <SelectItem value="bebidas">🥤 Bebidas</SelectItem>
              <SelectItem value="deportes">🏋️ Deportes</SelectItem>
              <SelectItem value="cosmetica">💄 Cosmética</SelectItem>
              <SelectItem value="hogar">🏠 Hogar</SelectItem>
              <SelectItem value="otros">📋 Otros</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Estado */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Estado</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">● Activo</SelectItem>
              <SelectItem value="0">○ Inactivo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Categoría */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Categoría <span className="text-destructive">*</span></Label>
          <Select value={category || '__none__'} onValueChange={v => setCategory(v === '__none__' ? '' : v)}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Sin categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sin categoría</SelectItem>
              {categories.map(c => (
                <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Marca */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Marca <span className="text-muted-foreground">(opcional)</span></Label>
          <Input
            value={brand}
            onChange={e => setBrand(e.target.value)}
            placeholder="Ej: Nike, Adidas..."
            className="h-9 text-sm"
          />
        </div>
      </div>

      <div className="rounded-lg bg-muted/40 border border-border p-3 text-xs text-muted-foreground">
        💡 Los colores, tallas y stock se configuran en el paso siguiente mediante hormas.
        Puedes ajustar precio, SKU e imágenes adicionales por producto después desde el inventario.
      </div>
    </div>
  )

  const renderStep3 = () => (
    <div className="flex-1 overflow-auto space-y-4">
      <p className="text-xs text-muted-foreground">
        Selecciona las hormas. Se crearán las mismas variantes (color × talla) para <strong>todos</strong> los {rows.length} productos.
      </p>

      {hormasLoading ? (
        <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando hormas...
        </div>
      ) : hormasList.length === 0 ? (
        <div className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
          No tienes hormas configuradas. Ve a <strong>Inventario → Hormas</strong> para crearlas.
        </div>
      ) : (
        <div className="space-y-2 max-h-[45vh] overflow-auto">
          {hormasList.map((h: Horma) => {
            const isSelected = horma.selectedHormaIds.includes(String(h.id))
            const colors     = h.colors || []
            const sizes      = h.sizeChart ? Object.keys(h.sizeChart) : []
            const variants   = colors.length * sizes.length
            return (
              <div
                key={h.id}
                onClick={() => horma.toggleHorma(String(h.id), hormasList)}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/40'
                }`}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => horma.toggleHorma(String(h.id), hormasList)}
                  onClick={e => e.stopPropagation()}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{h.name}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {colors.slice(0, 5).map(c => (
                      <span
                        key={c.color}
                        title={c.color}
                        className="h-3 w-3 rounded-full border shrink-0"
                        style={{ backgroundColor: resolveColorHex(c.color, c.hex) }}
                      />
                    ))}
                    {colors.length > 5 && (
                      <span className="text-[10px] text-muted-foreground">+{colors.length - 5}</span>
                    )}
                    {sizes.length > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        · Tallas: {sizes.slice(0, 4).join(', ')}{sizes.length > 4 ? '...' : ''}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <Badge variant={isSelected ? 'default' : 'secondary'} className="text-[10px]">
                    {variants} vars
                  </Badge>
                  {h.basePrice != null && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      ${Number(h.basePrice).toLocaleString('es-CO')}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Estimado */}
      {horma.selectedHormaIds.length > 0 && (
        <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs space-y-1">
          <p className="font-semibold text-foreground">Estimado de creación:</p>
          {horma.selectedHormaIds.map(hid => {
            const h = hormasList.find(x => String(x.id) === hid)
            if (!h) return null
            const c = (h.colors || []).length
            const s = h.sizeChart ? Object.keys(h.sizeChart).length : 0
            return (
              <p key={hid} className="text-muted-foreground">
                {h.name}: {c} colores × {s} tallas = {c * s} vars/producto
              </p>
            )
          })}
          <p className="font-semibold text-primary mt-1">
            Total: {rows.length} productos × {variantsPerProduct} vars = {totalVariants} variantes
          </p>
        </div>
      )}
    </div>
  )

  const renderStep4 = () => (
    <div className="flex-1 overflow-auto space-y-4">
      {/* Resumen de config */}
      {!creating && !allDone && (
        <div className="rounded-lg bg-muted/40 border border-border p-3 text-xs space-y-1">
          <p className="font-medium text-foreground">Configuración final</p>
          <div className="flex flex-wrap gap-2 mt-1">
            <Badge variant="secondary">{rows.length} productos</Badge>
            {horma.selectedHormaIds.length > 0 && (
              <Badge variant="secondary">{totalVariants} variantes totales</Badge>
            )}
            {category && <Badge variant="outline">{category}</Badge>}
            {brand && <Badge variant="outline">{brand}</Badge>}
            <Badge variant="outline">{productType}</Badge>
            <Badge variant={status === '1' ? 'default' : 'secondary'}>
              {status === '1' ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>
        </div>
      )}

      {/* Progress bar */}
      {(creating || doneCount > 0) && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Creando productos...</span>
            <span>{doneCount}/{rows.length}</span>
          </div>
          <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300 rounded-full"
              style={{ width: `${allDone ? 100 : progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Tabla de estado */}
      <div className="rounded-lg border border-border overflow-auto max-h-[45vh]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/60 backdrop-blur">
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-12">Img</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Nombre</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground w-28">Variantes</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground w-20">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.image.public_id} className="border-b border-border/50">
                <td className="px-3 py-2">
                  <Thumb img={row.image} size={36} />
                </td>
                <td className="px-3 py-2 text-xs text-foreground truncate max-w-[200px]">
                  {row.name}
                </td>
                <td className="px-3 py-2 text-center text-xs text-muted-foreground">
                  {row.status === 'done'
                    ? row.variantsCreated > 0
                      ? <span className="text-green-600 dark:text-green-400 font-medium">{row.variantsCreated} vars</span>
                      : <span className="text-muted-foreground">sin vars</span>
                    : row.status === 'creating'
                    ? <span className="text-primary">creando...</span>
                    : variantsPerProduct > 0
                    ? <span className="text-muted-foreground/60">{variantsPerProduct} est.</span>
                    : '—'
                  }
                </td>
                <td className="px-3 py-2 text-center">
                  {row.status === 'pending'  && <Badge variant="secondary" className="text-[10px]">Pendiente</Badge>}
                  {row.status === 'creating' && <Loader2 className="h-4 w-4 animate-spin mx-auto text-primary" />}
                  {row.status === 'done'     && <CheckCircle2 className="h-4 w-4 mx-auto text-green-500" />}
                  {row.status === 'error'    && (
                    <span title={row.error || 'Error'}>
                      <XCircle className="h-4 w-4 mx-auto text-destructive" />
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {allDone && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-sm text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          ¡Listo! {doneCount} productos creados con {totalVariants} variantes.
        </div>
      )}
    </div>
  )

  // ── Footer navigation ─────────────────────────────────────────────────────

  const handleBack = () => setStep(prev => (prev - 1) as Step)
  const handleNext = () => {
    if (!canNext()) return
    if (step < 4) setStep(prev => (prev + 1) as Step)
  }

  return (
    <Dialog open={open} onOpenChange={creating ? undefined : onClose}>
      <DialogContent aria-describedby={undefined} className="!w-[min(720px,95vw)] !max-w-none max-h-[92vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4" />
            Crear {rows.length} productos desde Cloudinary
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden px-5 pt-4 pb-0">
          <StepBar current={step} />
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border flex items-center justify-between gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={step === 1 ? onClose : handleBack}
            disabled={creating}
            className="gap-1.5"
          >
            <ChevronLeft className="h-4 w-4" />
            {step === 1 ? 'Cancelar' : 'Atrás'}
          </Button>

          <div className="flex items-center gap-2">
            {step < 4 && (
              <Button
                size="sm"
                onClick={handleNext}
                disabled={!canNext()}
                className="gap-1.5"
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}

            {step === 4 && !allDone && (
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={creating || pendingCount === 0}
                className="gap-1.5"
              >
                {creating
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Creando...</>
                  : <>🚀 Crear {pendingCount} productos</>
                }
              </Button>
            )}

            {step === 4 && allDone && (
              <Button size="sm" onClick={onClose} className="gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                Cerrar
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
