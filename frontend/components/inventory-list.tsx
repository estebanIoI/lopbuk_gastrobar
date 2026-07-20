'use client'

import React from "react"

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useStore, getStockStatus } from '@/lib/store'
import { api } from '@/lib/api'
import { type Product, type Category, type ProductType, type Sede, type ProductVariant } from '@/lib/types'
import { PRODUCT_TYPES, FIELD_DEFINITIONS, getFieldsForProductType } from '@/lib/product-config'
import { formatCOP } from '@/lib/utils'
import { fileToDownscaledDataUrl } from '@/lib/image'
import { resolveColorHex } from '@/lib/colors'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { CloudinaryUpload } from '@/components/ui/cloudinary-upload'
import { LocationPicker } from '@/components/ui/location-picker'
import { VariantManager } from '@/components/variant-manager'
import { ProductModifiersManager } from '@/components/product-modifiers-manager'
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Package,
  Filter,
  Tags,
  ScanLine,
  Smartphone,
  Upload,
  Layers,
  SlidersHorizontal,
  MapPin,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Settings2,
  FileDown,
  ImageIcon,
  Eye,
  EyeOff,
  Palette,
  GripVertical,
  CheckSquare,
  CheckCircle2,
  X,
  Check,
  Cloud,
  Warehouse,
  Sparkles,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { BarcodeScanner } from '@/components/barcode-scanner'
import { RemoteScanner } from '@/components/remote-scanner'
import { BulkUploadDialog } from '@/components/bulk-upload-dialog'
import { HormaManager } from '@/components/horma-manager'
import { SedeStockPanel } from '@/components/sede-stock-panel'
import { CloudinaryPickerModal } from '@/components/cloudinary-bulk-wizard/CloudinaryPickerModal'

// Orden estándar de confección — se usa en todos lados donde se muestran tallas
// (picker rápido, fila expandida, resumen) para que el orden sea siempre el mismo,
// sin importar qué horma esté seleccionada ni en qué orden vengan de la base de datos.
const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
function sortSizes(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => {
    const ia = SIZE_ORDER.indexOf(a.toUpperCase())
    const ib = SIZE_ORDER.indexOf(b.toUpperCase())
    if (ia === -1 && ib === -1) return a.localeCompare(b)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
}

// ── Selector rápido Horma → Talla → Color — solo CONSULTA el stock de esa
// combinación exacta (no se edita acá; para eso está el lápiz de la fila expandida
// o "Variantes / Tiers"). Estado compartido por las dos formas de mostrarlo: en una
// sola columna (mobile, VariantQuickPicker) o repartido en columnas (escritorio,
// VariantPickerColumns). Cada fila/instancia tiene su propio estado de selección.
function useVariantPicker(
  variants: ProductVariant[],
  onHormaChange?: (hormaId: string | null) => void,
  onSizeChange?: (size: string | null) => void,
  onColorChange?: (color: string | null) => void,
  hormaById?: Record<string, any>,
) {
  const hormaIds = useMemo(() => {
    const ids = Array.from(new Set(variants.map(v => v.hormaId).filter(Boolean))) as string[]
    // Orden estable: sort_order de la horma → garantiza que siempre aparecen en el mismo orden
    if (hormaById) ids.sort((a, b) => (hormaById[a]?.sortOrder ?? 999) - (hormaById[b]?.sortOrder ?? 999))
    return ids
  }, [variants, hormaById])
  const [selHorma, setSelHormaState] = useState<string | null>(hormaIds[0] ?? null)
  const [selSize, setSelSizeState] = useState<string | null>(null)
  const [selColor, setSelColorState] = useState<string | null>(null)

  // Siempre tener la primera horma seleccionada cuando cambia la lista
  useEffect(() => {
    setSelHormaState(prev => {
      if (hormaIds.length === 0) return null
      if (prev && hormaIds.includes(prev)) return prev // mantener si sigue existiendo
      return hormaIds[0] // default: primera horma en orden
    })
  }, [hormaIds])

  // Elegir horma acá también sincroniza el filtro de la fila expandida ("Ver variantes"),
  // para no tener que elegirla dos veces si después abrís el detalle completo.
  const setSelHorma = (hid: string | null) => {
    setSelHormaState(hid)
    onHormaChange?.(hid)
  }
  // Elegir talla/color en el picker rápido TAMBIÉN filtra la tabla de variantes
  // de la fila expandida — así "elegir talla y color" funciona como filtro real,
  // no solo como consulta del stock de esa combinación exacta.
  const setSelSize = (sz: string | null) => {
    setSelSizeState(sz)
    onSizeChange?.(sz)
  }
  const setSelColor = (c: string | null) => {
    setSelColorState(c)
    onColorChange?.(c)
  }

  const scoped = useMemo(
    () => (selHorma ? variants.filter(v => v.hormaId === selHorma) : variants),
    [variants, selHorma]
  )
  // Orden siempre igual (S/M/L/XL/XXL y colores A-Z) — al cambiar de horma se filtra
  // a las tallas/colores de ESA horma, pero el orden no "salta" de un lado a otro.
  const sizes = useMemo(
    () => sortSizes(Array.from(new Set(scoped.map(v => v.size).filter(Boolean))) as string[]),
    [scoped]
  )
  const colors = useMemo(() => {
    const seen = new Map<string, { color: string; hex?: string }>()
    for (const v of scoped) {
      if (v.color && !seen.has(v.color.toLowerCase())) seen.set(v.color.toLowerCase(), { color: v.color, hex: v.colorHex })
    }
    return Array.from(seen.values()).sort((a, b) => a.color.localeCompare(b.color))
  }, [scoped])

  const matched = useMemo(() => {
    if (!selSize || !selColor) return null
    return scoped.find(v => v.size === selSize && v.color === selColor) || null
  }, [scoped, selSize, selColor])

  return { hormaIds, selHorma, setSelHorma, selSize, setSelSize, selColor, setSelColor, sizes, colors, matched }
}

// Mobile: todo apilado en un solo bloque (debajo de los botones de acción de la tarjeta).
function VariantQuickPicker({
  variants, hormaById, getVariantStockStatus, onHormaChange, onSizeChange, onColorChange,
}: {
  variants: ProductVariant[]
  hormaById: Record<string, any>
  getVariantStockStatus: (v: ProductVariant) => 'suficiente' | 'bajo' | 'agotado'
  onHormaChange?: (hormaId: string | null) => void
  onSizeChange?: (size: string | null) => void
  onColorChange?: (color: string | null) => void
}) {
  const p = useVariantPicker(variants, onHormaChange, onSizeChange, onColorChange, hormaById)

  if (variants.length === 0) {
    return <span className="text-xs text-muted-foreground">Sin variantes</span>
  }

  return (
    <div className="space-y-1.5 min-w-[150px]">
      {p.hormaIds.length > 1 ? (
        <div className="flex flex-wrap gap-1">
          {p.hormaIds.map(hid => (
            <button
              key={hid}
              type="button"
              onClick={() => { p.setSelHorma(hid === p.selHorma ? null : hid); p.setSelSize(null); p.setSelColor(null) }}
              className={`text-[10px] px-1.5 py-0.5 rounded border cursor-pointer transition-colors ${
                p.selHorma === hid ? 'border-primary bg-primary/10 text-foreground' : 'border-input text-muted-foreground hover:bg-muted hover:border-primary/50'
              }`}
            >
              {hormaById[hid]?.name || 'Horma'}
            </button>
          ))}
        </div>
      ) : p.hormaIds.length === 1 ? (
        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Layers className="h-2.5 w-2.5" /> {hormaById[p.hormaIds[0]]?.name || 'Horma'}
        </p>
      ) : null}
      {p.sizes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {p.sizes.map(sz => (
            <button
              key={sz}
              type="button"
              onClick={() => p.setSelSize(sz === p.selSize ? null : sz)}
              className={`text-[10px] px-1.5 py-0.5 rounded border font-medium cursor-pointer transition-colors ${
                p.selSize === sz ? 'border-primary bg-primary text-primary-foreground' : 'border-input text-muted-foreground hover:bg-muted hover:border-primary/50'
              }`}
            >
              {sz}
            </button>
          ))}
        </div>
      )}
      {p.colors.length > 0 && (
        <div className="flex flex-wrap gap-1 items-center">
          {p.colors.map(c => (
            <button
              key={c.color}
              type="button"
              title={c.color}
              onClick={() => p.setSelColor(c.color === p.selColor ? null : c.color)}
              className={`h-4 w-4 rounded-full border shrink-0 cursor-pointer transition-transform hover:scale-125 ${
                p.selColor === c.color ? 'ring-2 ring-primary ring-offset-1' : 'hover:ring-2 hover:ring-muted-foreground/40'
              }`}
              style={{ backgroundColor: resolveColorHex(c.color, c.hex) }}
            />
          ))}
        </div>
      )}
      {p.matched ? (
        <div className="flex items-center gap-1.5 pt-0.5">
          {(() => {
            const st = getVariantStockStatus(p.matched)
            return (
              <>
                <span className={`h-2 w-2 rounded-full ${st === 'suficiente' ? 'bg-primary' : st === 'bajo' ? 'bg-warning' : 'bg-destructive'}`} />
                <span className={`text-xs font-medium ${st === 'suficiente' ? 'text-primary' : st === 'bajo' ? 'text-warning' : 'text-destructive'}`}>
                  {p.matched.stock} en stock
                </span>
              </>
            )
          })()}
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground">Elige talla y color para ver el stock</p>
      )}
    </div>
  )
}

// Escritorio: las mismas 3 elecciones (Horma/Talla/Color) repartidas en 3 columnas
// separadas, y una 4ta celda de Stock que muestra el total agregado por defecto, o el
// stock de la variante exacta (solo lectura) en cuanto se elige talla + color.
function VariantPickerColumns({
  variants, hormaById, getVariantStockStatus,
  fallbackStock, fallbackStatus, onHormaChange, onSizeChange, onColorChange, onMatchedVariant,
}: {
  variants: ProductVariant[]
  hormaById: Record<string, any>
  getVariantStockStatus: (v: ProductVariant) => 'suficiente' | 'bajo' | 'agotado'
  fallbackStock: number
  fallbackStatus: 'suficiente' | 'bajo' | 'agotado'
  onHormaChange?: (hormaId: string | null) => void
  onSizeChange?: (size: string | null) => void
  onColorChange?: (color: string | null) => void
  onMatchedVariant?: (v: ProductVariant | null) => void
}) {
  const p = useVariantPicker(variants, onHormaChange, onSizeChange, onColorChange, hormaById)

  // Notificar al padre cuando cambia la variante matched (para actualizar precio en columna externa)
  useEffect(() => { onMatchedVariant?.(p.matched) }, [p.matched]) // eslint-disable-line react-hooks/exhaustive-deps
  const dot = (st: string) => st === 'suficiente' ? 'bg-primary' : st === 'bajo' ? 'bg-warning' : 'bg-destructive'
  const text = (st: string) => st === 'suficiente' ? 'text-primary' : st === 'bajo' ? 'text-warning' : 'text-destructive'

  if (variants.length === 0) {
    return (
      <>
        <TableCell><span className="text-xs text-muted-foreground">—</span></TableCell>
        <TableCell><span className="text-xs text-muted-foreground">—</span></TableCell>
        <TableCell><span className="text-xs text-muted-foreground">—</span></TableCell>
        <TableCell className="text-center">
          <div className="flex items-center justify-center gap-2">
            <span className={`h-2 w-2 lg:h-2.5 lg:w-2.5 rounded-full ${dot(fallbackStatus)}`} />
            <span className={`font-medium text-sm lg:text-base ${text(fallbackStatus)}`}>{fallbackStock}</span>
          </div>
        </TableCell>
        <TableCell><span className="text-xs text-muted-foreground">—</span></TableCell>
      </>
    )
  }

  const matchedStatus = p.matched ? getVariantStockStatus(p.matched) : fallbackStatus

  return (
    <>
      <TableCell>
        {p.hormaIds.length > 1 ? (
          <div className="flex flex-wrap gap-1">
            {p.hormaIds.map(hid => (
              <button
                key={hid}
                type="button"
                onClick={() => { p.setSelHorma(hid === p.selHorma ? null : hid); p.setSelSize(null); p.setSelColor(null) }}
                className={`text-[10px] px-1.5 py-0.5 rounded border cursor-pointer transition-colors ${
                  p.selHorma === hid ? 'border-primary bg-primary/10 text-foreground' : 'border-input text-muted-foreground hover:bg-muted hover:border-primary/50'
                }`}
              >
                {hormaById[hid]?.name || 'Horma'}
              </button>
            ))}
          </div>
        ) : p.hormaIds.length === 1 ? (
          <span className="text-xs text-muted-foreground">{hormaById[p.hormaIds[0]]?.name || 'Horma'}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        {p.sizes.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {p.sizes.map(sz => (
              <button
                key={sz}
                type="button"
                onClick={() => p.setSelSize(sz === p.selSize ? null : sz)}
                className={`text-[10px] px-1.5 py-0.5 rounded border font-medium cursor-pointer transition-colors ${
                  p.selSize === sz ? 'border-primary bg-primary text-primary-foreground' : 'border-input text-muted-foreground hover:bg-muted hover:border-primary/50'
                }`}
              >
                {sz}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        {p.colors.length > 0 ? (
          <div className="flex flex-wrap gap-1 items-center">
            {p.colors.map(c => (
              <button
                key={c.color}
                type="button"
                title={c.color}
                onClick={() => p.setSelColor(c.color === p.selColor ? null : c.color)}
                className={`h-4 w-4 rounded-full border shrink-0 cursor-pointer transition-transform hover:scale-125 ${
                  p.selColor === c.color ? 'ring-2 ring-primary ring-offset-1' : 'hover:ring-2 hover:ring-muted-foreground/40'
                }`}
                style={{ backgroundColor: resolveColorHex(c.color, c.hex) }}
              />
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-center">
        <div className="flex items-center justify-center gap-2">
          <span className={`h-2 w-2 lg:h-2.5 lg:w-2.5 rounded-full ${dot(matchedStatus)}`} />
          <span className={`font-medium text-sm lg:text-base ${text(matchedStatus)}`}>
            {p.matched ? p.matched.stock : fallbackStock}
          </span>
        </div>
        {!p.matched && (p.selSize || p.selColor) && (
          <p className="text-[10px] text-muted-foreground mt-0.5">Elige talla y color</p>
        )}
        {!p.matched && !p.selSize && !p.selColor && (
          <p className="text-[10px] text-muted-foreground mt-0.5">suma de {variants.length} variante(s)</p>
        )}
        {p.matched && (
          <p className="text-[10px] text-muted-foreground mt-0.5">de esta variante</p>
        )}
      </TableCell>
      {(() => {
        // Muestra peso/composición de la horma activa (seleccionada o única).
        const activeHormaId = p.selHorma ?? (p.hormaIds.length === 1 ? p.hormaIds[0] : null)
        const h = activeHormaId ? hormaById[activeHormaId] : null
        return (
          <TableCell>
            {h ? (
              <div className="space-y-0.5">
                {h.weightGrams != null && (
                  <p className="text-xs font-medium text-foreground">{h.weightGrams} g</p>
                )}
                {h.composition && (
                  <p className="text-[10px] text-muted-foreground leading-tight">{h.composition}</p>
                )}
                {h.weightGrams == null && !h.composition && (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </TableCell>
        )
      })()}
    </>
  )
}

export function InventoryList() {
  const { products, isLoadingProducts, fetchProducts, addProduct, updateProduct, deleteProduct, bulkDeleteProducts, categories, fetchCategories, addCategory, updateCategory, toggleCategoryVisibility, deleteCategory, inventoryStockFilter, inventorySearchQuery, clearInventoryFilters, sedes, fetchSedes, addSede, updateSede, deleteSede } = useStore()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [stockFilter, setStockFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [activeSede, setActiveSede] = useState<string>('all')
  // Paginación: solo se renderizan PAGE_SIZE productos por página (evita montar
  // miles de filas con imágenes/variantes de golpe). El resto se monta al cambiar de página.
  const PAGE_SIZE = 100
  const [page, setPage] = useState(1)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [variantProduct, setVariantProduct] = useState<Product | null>(null)
  const [modifiersProduct, setModifiersProduct] = useState<Product | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false)
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false)
  const [isHormaManagerOpen, setIsHormaManagerOpen] = useState(false)
  const [isSedeDialogOpen, setIsSedeDialogOpen] = useState(false)
  const [isSedeStockOpen, setIsSedeStockOpen] = useState(false)
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false)
  const [imageDialogData, setImageDialogData] = useState<{ imageUrl: string; images: string[] }>({ imageUrl: '', images: ['', '', '', ''] })
  const [isSavingImages, setIsSavingImages] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  // ── Variantes (color x talla) inline en la tabla de inventario ──
  // Se cargan TODAS de una vez (no por producto) para poder mostrar en la fila
  // principal el stock total y todos los colores sin tener que expandir cada fila.
  const [allVariants, setAllVariants] = useState<ProductVariant[]>([])
  const [loadingAllVariants, setLoadingAllVariants] = useState(false)
  const [hormasList, setHormasList] = useState<any[]>([])
  const [expandedVariantIds, setExpandedVariantIds] = useState<Set<string>>(new Set())
  // Filtro por horma/talla/color dentro de la fila expandida — por producto,
  // null/undefined = mostrar todas. Talla y color se alimentan del mismo picker
  // rápido (Horma/Talla/Color) que ya vive en la fila principal: elegir ahí
  // ahora también filtra la tabla completa de variantes, no solo el stock de esa
  // combinación exacta.
  const [expandedHormaFilter, setExpandedHormaFilter] = useState<Record<string, string | null>>({})
  const [expandedSizeFilter, setExpandedSizeFilter] = useState<Record<string, string | null>>({})
  const [expandedColorFilter, setExpandedColorFilter] = useState<Record<string, string | null>>({})
  const [expandedMatchedVariant, setExpandedMatchedVariant] = useState<Record<string, ProductVariant | null>>({})

  // ── Edición en grupo (bulk) de variantes ──
  // Selección global de variant IDs (no por producto) — permite, por ejemplo,
  // filtrar por talla M en dos productos distintos y editar ambos grupos a la vez.
  const [bulkVariantMode, setBulkVariantMode] = useState(false)
  const [selectedVariantIds, setSelectedVariantIds] = useState<Set<string>>(new Set())
  const [isBulkVariantEditOpen, setIsBulkVariantEditOpen] = useState(false)
  const [savingBulkVariant, setSavingBulkVariant] = useState(false)
  const [bulkVariantForm, setBulkVariantForm] = useState({
    stockMode: 'none' as 'none' | 'set' | 'add' | 'subtract',
    stockValue: '',
    stockReason: '',
    changePrice: false,
    priceOverride: '',
    changeCost: false,
    costPrice: '',
    changeMinStock: false,
    minStock: '',
  })

  const loadVariantsSummary = useCallback(async () => {
    setLoadingAllVariants(true)
    try {
      const res: any = await api.getVariantsSummary()
      if (Array.isArray(res)) {
        setAllVariants(res)
      } else if (res?.success) {
        setAllVariants(res.data ?? [])
      } else {
        toast.error(res?.error || 'No se pudieron cargar las variantes')
      }
    } catch {
      toast.error('No se pudieron cargar las variantes')
    } finally {
      setLoadingAllVariants(false)
    }
  }, [])

  useEffect(() => {
    loadVariantsSummary()
    api.getHormas().then(r => { if (r.success && r.data) setHormasList(r.data as any[]) })
  }, [loadVariantsSummary])

  const variantsByProductId = useMemo(() => {
    const map: Record<string, ProductVariant[]> = {}
    for (const v of allVariants) {
      if (!map[v.productId]) map[v.productId] = []
      map[v.productId].push(v)
    }
    return map
  }, [allVariants])

  const hormaById = useMemo(() => {
    const map: Record<string, any> = {}
    for (const h of hormasList) map[h.id] = h
    return map
  }, [hormasList])

  // Stock "general" de un producto: si tiene variantes, es la SUMA de todas
  // (la fuente de verdad real); si no, el stock propio del producto.
  const getDisplayStock = (product: Product) => {
    const variants = variantsByProductId[product.id]
    if (variants && variants.length > 0) return variants.reduce((sum, v) => sum + v.stock, 0)
    return product.stock
  }

  const getDisplayStockStatus = (product: Product): 'suficiente' | 'bajo' | 'agotado' => {
    const stock = getDisplayStock(product)
    if (stock === 0) return 'agotado'
    if (stock <= product.reorderPoint) return 'bajo'
    return 'suficiente'
  }

  // Tallas distintas de un producto, ordenadas en el orden estándar de confección.
  const getDisplayTallas = (product: Product): string[] => {
    const variants = variantsByProductId[product.id]
    if (!variants) return []
    const seen = new Set<string>()
    for (const v of variants) if (v.size) seen.add(v.size)
    return sortSizes(Array.from(seen))
  }

  // Colores distintos de un producto (deduplicados por nombre), para pintar
  // TODOS los círculos en la fila principal — no solo los primeros.
  const getDisplayColors = (product: Product): { color: string; hex?: string }[] => {
    const variants = variantsByProductId[product.id]
    if (!variants) return []
    const seen = new Map<string, { color: string; hex?: string }>()
    for (const v of variants) {
      if (!v.color) continue
      const key = v.color.toLowerCase()
      if (!seen.has(key)) seen.set(key, { color: v.color, hex: v.colorHex })
    }
    return Array.from(seen.values())
  }

  // Todas las hormas distintas en juego para un producto. Ya NO asumimos una sola
  // (product.hormaId) — un producto puede tener variantes repartidas en varias hormas
  // (ej. el mismo diseño impreso sobre Oversize Fit Y sobre Camiseta Clásica), así que
  // se derivan de las variantes reales; product.hormaId queda solo de fallback legacy.
  const getDisplayHormas = (product: Product): { id: string; name: string }[] => {
    const variants = variantsByProductId[product.id]
    if (variants && variants.length > 0) {
      const seen = new Map<string, { id: string; name: string }>()
      for (const v of variants) {
        if (!v.hormaId) continue
        if (!seen.has(v.hormaId)) seen.set(v.hormaId, { id: v.hormaId, name: v.hormaName || hormaById[v.hormaId]?.name || 'Horma' })
      }
      return Array.from(seen.values())
    }
    if (product.hormaId && hormaById[product.hormaId]) {
      return [{ id: product.hormaId, name: hormaById[product.hormaId].name }]
    }
    return []
  }

  const toggleVariantRow = (productId: string) => {
    setExpandedVariantIds(prev => {
      const next = new Set(prev)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }

  const setHormaFilterFor = (productId: string, hormaIdOrNull: string | null) => {
    setExpandedHormaFilter(prev => ({ ...prev, [productId]: hormaIdOrNull }))
  }
  const setSizeFilterFor = (productId: string, sizeOrNull: string | null) => {
    setExpandedSizeFilter(prev => ({ ...prev, [productId]: sizeOrNull }))
  }
  const setColorFilterFor = (productId: string, colorOrNull: string | null) => {
    setExpandedColorFilter(prev => ({ ...prev, [productId]: colorOrNull }))
  }

  // Variantes de un producto aplicando horma + talla + color a la vez (las tres
  // se alimentan del mismo picker rápido). Centralizado para que la fila expandida
  // (mobile y escritorio) y la selección "grupo visible" usen siempre el mismo cálculo.
  const getFilteredVariantsFor = (productId: string, variants: ProductVariant[] | undefined): ProductVariant[] => {
    if (!variants) return []
    const horma = expandedHormaFilter[productId] || null
    const size = expandedSizeFilter[productId] || null
    const color = expandedColorFilter[productId] || null
    if (!horma && !size && !color) return variants
    return variants.filter(v =>
      (!horma || v.hormaId === horma) &&
      (!size || v.size === size) &&
      (!color || v.color === color)
    )
  }

  // ── Edición en grupo (bulk) de variantes ──
  const toggleVariantSelect = (id: string) =>
    setSelectedVariantIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  const isVariantSelected = (id: string) => selectedVariantIds.has(id)
  // Selecciona/deselecciona en bloque todas las variantes de una lista (ej. el
  // grupo que está visible bajo el filtro actual de talla/color).
  const toggleSelectVariantGroup = (variants: ProductVariant[]) => {
    setSelectedVariantIds(prev => {
      const ids = variants.map(v => v.id)
      const allSelected = ids.length > 0 && ids.every(id => prev.has(id))
      const next = new Set(prev)
      if (allSelected) ids.forEach(id => next.delete(id))
      else ids.forEach(id => next.add(id))
      return next
    })
  }
  const exitBulkVariantMode = () => { setBulkVariantMode(false); setSelectedVariantIds(new Set()) }

  const openBulkVariantEdit = () => {
    setBulkVariantForm({
      stockMode: 'none', stockValue: '', stockReason: '',
      changePrice: false, priceOverride: '',
      changeCost: false, costPrice: '',
      changeMinStock: false, minStock: '',
    })
    setIsBulkVariantEditOpen(true)
  }

  const applyBulkVariantEdit = async () => {
    const ids = Array.from(selectedVariantIds)
    if (ids.length === 0) return
    const f = bulkVariantForm
    if (f.stockMode !== 'none' && !f.stockReason.trim()) {
      toast.error('El ajuste de stock requiere un motivo')
      return
    }
    const payload: Parameters<typeof api.bulkUpdateVariants>[0] = { variantIds: ids }
    if (f.stockMode !== 'none') {
      payload.stock = {
        type: f.stockMode === 'set' ? 'ajuste' : f.stockMode === 'add' ? 'entrada' : 'salida',
        quantity: Number(f.stockValue) || 0,
        reason: f.stockReason.trim(),
      }
    }
    if (f.changePrice) payload.priceOverride = f.priceOverride === '' ? null : Number(f.priceOverride)
    if (f.changeCost) payload.costPrice = f.costPrice === '' ? null : Number(f.costPrice)
    if (f.changeMinStock) payload.minStock = Number(f.minStock) || 0

    setSavingBulkVariant(true)
    try {
      const r = await api.bulkUpdateVariants(payload)
      if (!r.success) { toast.error(r.error || 'No se pudo aplicar la edición en grupo'); return }
      const d = r.data as { updated: number; failed: { id: string; error: string }[] }
      toast.success(`${d.updated} variante(s) actualizada(s)${d.failed?.length ? ` · ${d.failed.length} con errores` : ''}`)
      setIsBulkVariantEditOpen(false)
      exitBulkVariantMode()
      await loadVariantsSummary()
    } finally {
      setSavingBulkVariant(false)
    }
  }

  const getVariantStockStatus = (v: ProductVariant): 'suficiente' | 'bajo' | 'agotado' => {
    if (v.stock === 0) return 'agotado'
    if (v.stock <= v.minStock) return 'bajo'
    return 'suficiente'
  }

  // Orden de la fila expandida: agrupado por Horma → Color → Talla, para poder
  // ver de un vistazo todo el stock sin que las combinaciones salgan mezcladas
  // (el orden que trae la base de datos depende de cuándo se creó cada variante).
  const sortVariantsForDisplay = (variants: ProductVariant[]): ProductVariant[] => {
    const sizeIndex = (s?: string) => {
      if (!s) return 999
      const i = SIZE_ORDER.indexOf(s.toUpperCase())
      return i === -1 ? 998 : i
    }
    return [...variants].sort((a, b) => {
      const ha = (a.hormaName || (a.hormaId ? hormaById[a.hormaId]?.name : '') || '').toLowerCase()
      const hb = (b.hormaName || (b.hormaId ? hormaById[b.hormaId]?.name : '') || '').toLowerCase()
      if (ha !== hb) return ha.localeCompare(hb)
      const ca = (a.color || '').toLowerCase()
      const cb = (b.color || '').toLowerCase()
      if (ca !== cb) return ca.localeCompare(cb)
      return sizeIndex(a.size) - sizeIndex(b.size)
    })
  }

  // ── Editar / Eliminar variante directo desde la fila expandida ──
  const MAX_VARIANT_IMAGES = 4
  const [editingQuickVariant, setEditingQuickVariant] = useState<ProductVariant | null>(null)
  const [quickVariantForm, setQuickVariantForm] = useState({
    color: '', colorHex: '', size: '', costPrice: '', priceOverride: '',
    images: ['', '', '', ''] as string[],
  })
  const [savingQuickVariant, setSavingQuickVariant] = useState(false)
  const [deletingQuickVariant, setDeletingQuickVariant] = useState<ProductVariant | null>(null)
  const [isDeletingQuickVariant, setIsDeletingQuickVariant] = useState(false)

  const openQuickEditVariant = (v: ProductVariant) => {
    setEditingQuickVariant(v)
    const imgs = v.images || []
    setQuickVariantForm({
      color: v.color || '',
      colorHex: v.colorHex || '',
      size: v.size || '',
      costPrice: v.costPrice != null ? String(v.costPrice) : '',
      priceOverride: v.priceOverride != null ? String(v.priceOverride) : '',
      images: [imgs[0] || '', imgs[1] || '', imgs[2] || '', imgs[3] || ''],
    })
  }

  const saveQuickVariantEdit = async () => {
    if (!editingQuickVariant) return
    setSavingQuickVariant(true)
    try {
      const r = await api.updateVariant(editingQuickVariant.id, {
        color: quickVariantForm.color.trim() || undefined,
        colorHex: quickVariantForm.colorHex.trim(),
        size: quickVariantForm.size.trim() || undefined,
        costPrice: quickVariantForm.costPrice !== '' ? Number(quickVariantForm.costPrice) : undefined,
        priceOverride: quickVariantForm.priceOverride !== '' ? Number(quickVariantForm.priceOverride) : undefined,
        images: quickVariantForm.images.map(u => u.trim()).filter(Boolean).slice(0, MAX_VARIANT_IMAGES),
      })
      if (!r.success) { toast.error(r.error || 'No se pudo actualizar la variante'); return }
      toast.success('Variante actualizada')
      setEditingQuickVariant(null)
      await loadVariantsSummary()
    } finally {
      setSavingQuickVariant(false)
    }
  }

  const confirmDeleteQuickVariant = async () => {
    if (!deletingQuickVariant) return
    setIsDeletingQuickVariant(true)
    try {
      const r = await api.deleteVariant(deletingQuickVariant.id)
      if (!r.success) { toast.error(r.error || 'No se pudo eliminar la variante'); return }
      toast.success('Variante eliminada')
      setDeletingQuickVariant(null)
      await loadVariantsSummary()
    } finally {
      setIsDeletingQuickVariant(false)
    }
  }

  // ── Imagen rápida de la variante (modal de inserción rápida) ──
  const [imageVariant, setImageVariant] = useState<ProductVariant | null>(null)
  const [variantImageForm, setVariantImageForm] = useState<string[]>(['', '', '', ''])
  const [savingVariantImage, setSavingVariantImage] = useState(false)

  const openVariantImageDialog = (v: ProductVariant) => {
    const imgs = v.images || []
    setVariantImageForm([imgs[0] || '', imgs[1] || '', imgs[2] || '', imgs[3] || ''])
    setImageVariant(v)
  }

  const saveVariantImage = async () => {
    if (!imageVariant) return
    setSavingVariantImage(true)
    try {
      const r = await api.updateVariant(imageVariant.id, {
        images: variantImageForm.map(u => u.trim()).filter(Boolean).slice(0, MAX_VARIANT_IMAGES),
      })
      if (!r.success) { toast.error(r.error || 'No se pudo guardar la imagen'); return }
      toast.success('Imagen de la variante actualizada')
      setImageVariant(null)
      await loadVariantsSummary()
    } finally {
      setSavingVariantImage(false)
    }
  }

  // Producto, Horma, Talla, Color, Stock, Peso/Comp, SKU, Tipo, Categoria, [Sede], Precio, Acciones
  const inventoryColSpan = (sedes.length >= 2 ? 12 : 11) + (selectMode ? 1 : 0)

  const handleExportCsv = async () => {
    setIsExporting(true)
    try {
      const params: Record<string, string> = {}
      if (search) params.search = search
      if (categoryFilter !== 'all') params.category = categoryFilter
      if (stockFilter !== 'all') params.stockStatus = stockFilter
      if (typeFilter !== 'all') params.productType = typeFilter

      const blob = await api.exportProductsCSV(params)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `inventario_${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Inventario exportado correctamente')
    } catch {
      toast.error('Error al exportar el inventario')
    } finally {
      setIsExporting(false)
    }
  }
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '', color: '#6366f1' })
  const [showHiddenCategories, setShowHiddenCategories] = useState(false)
  const [editingCategory, setEditingCategory] = useState<any>(null)
  const [editingCategoryForm, setEditingCategoryForm] = useState({ name: '', description: '', color: '#6366f1' })
  const [sedeForm, setSedeForm] = useState({ name: '', address: '' })
  const [editingSede, setEditingSede] = useState<Sede | null>(null)
  const [highlightedProduct, setHighlightedProduct] = useState<string | null>(null)
  const [isCloudinaryPickerOpen, setIsCloudinaryPickerOpen] = useState(false)

  useEffect(() => {
    fetchProducts()
    fetchCategories()
    fetchSedes()
  }, [fetchProducts, fetchCategories, fetchSedes])

  // When category dialog opens/closes or showHiddenCategories changes, reload categories
  useEffect(() => {
    if (isCategoryDialogOpen) {
      fetchCategories(showHiddenCategories)
    }
  }, [isCategoryDialogOpen, showHiddenCategories, fetchCategories])

  // Apply filters from notification navigation
  useEffect(() => {
    if (inventoryStockFilter) {
      setStockFilter(inventoryStockFilter)
    }
    if (inventorySearchQuery) {
      setSearch(inventorySearchQuery)
      // Find the product to highlight and scroll to it
      const product = products.find(p => p.name === inventorySearchQuery)
      if (product) {
        setHighlightedProduct(product.id)
        // Scroll to the product row after render
        setTimeout(() => {
          const el = document.getElementById(`product-${product.id}`)
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 100)
        // Remove highlight after 3 seconds
        setTimeout(() => setHighlightedProduct(null), 3000)
      }
    }
    if (inventoryStockFilter || inventorySearchQuery) {
      clearInventoryFilters()
    }
  }, [inventoryStockFilter, inventorySearchQuery, clearInventoryFilters, products])

  const getCategoryName = (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId)
    return cat ? cat.name : categoryId
  }

  // Derive used types and categories from products
  const usedTypes = new Set(products.map(p => p.productType).filter(Boolean))
  const usedCategories = new Set(products.map(p => p.category).filter(Boolean))

  // Filter products
  const filteredProducts = products.filter(product => {
    const matchesSearch =
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      (product.articulo && product.articulo.toLowerCase().includes(search.toLowerCase())) ||
      product.sku.toLowerCase().includes(search.toLowerCase()) ||
      (product.brand && product.brand.toLowerCase().includes(search.toLowerCase())) ||
      (product.barcode && product.barcode.toLowerCase().includes(search.toLowerCase()))

    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter
    const matchesType = typeFilter === 'all' || product.productType === typeFilter
    const matchesSede = activeSede === 'all' || product.sedeId === activeSede || !product.sedeId

    const status = getStockStatus(product)
    const matchesStock = stockFilter === 'all' ||
      (stockFilter === 'suficiente' && status === 'suficiente') ||
      (stockFilter === 'bajo' && status === 'bajo') ||
      (stockFilter === 'agotado' && status === 'agotado')

    return matchesSearch && matchesCategory && matchesStock && matchesType && matchesSede
  })

  // ── Paginación (cliente): 100 por página ──
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE))
  // Volver a la página 1 cuando cambian los filtros/búsqueda (el set resultante es otro).
  useEffect(() => { setPage(1) }, [search, categoryFilter, stockFilter, typeFilter, activeSede])
  // Si la página actual queda fuera de rango (p. ej. tras filtrar), la ajustamos.
  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [page, totalPages])
  const safePage = Math.min(page, totalPages)
  const pageStart = (safePage - 1) * PAGE_SIZE
  const pagedProducts = filteredProducts.slice(pageStart, pageStart + PAGE_SIZE)

  const activeSedeObj = sedes.find(s => s.id === activeSede)

  const handleEdit = (product: Product) => {
    setSelectedProduct(product)
    setIsEditDialogOpen(true)
  }

  const handleDelete = (product: Product) => {
    setSelectedProduct(product)
    setIsDeleteDialogOpen(true)
  }

  const handleOpenImageDialog = (product: Product) => {
    const imagesArr = Array.isArray(product.images) ? product.images : []
    setSelectedProduct(product)
    setImageDialogData({
      imageUrl: product.imageUrl || imagesArr[0] || '',
      images: [
        product.imageUrl || imagesArr[0] || '',
        imagesArr[1] || '',
        imagesArr[2] || '',
        imagesArr[3] || '',
      ],
    })
    setIsImageDialogOpen(true)
  }

  const handleSaveImages = async () => {
    if (!selectedProduct) return
    setIsSavingImages(true)
    const trimmed = imageDialogData.images.map(u => u.trim())
    const result = await updateProduct(selectedProduct.id, {
      imageUrl: trimmed[0],
      images: trimmed,
    })
    setIsSavingImages(false)
    if (result.success) {
      setIsImageDialogOpen(false)
      setSelectedProduct(null)
      toast.success('Imágenes actualizadas')
    } else {
      toast.error('Error al guardar imágenes')
    }
  }

  const confirmDelete = async () => {
    if (selectedProduct) {
      const result = await deleteProduct(selectedProduct.id)
      if (result.success) {
        setIsDeleteDialogOpen(false)
        setSelectedProduct(null)
      } else {
        toast.error(result.error || 'Error al eliminar producto')
      }
    }
  }

  // ── Multi-selección + acciones bulk ──
  const toggleSelect = (id: string) =>
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  const selectAll = () =>
    setSelectedIds(
      selectedIds.size === filteredProducts.length
        ? new Set()
        : new Set(filteredProducts.map(p => p.id))
    )
  const exitSelectMode = () => { setSelectMode(false); setSelectedIds(new Set()) }
  const confirmBulkDelete = async () => {
    setIsBulkDeleting(true)
    const ids = Array.from(selectedIds)
    const result = await bulkDeleteProducts(ids)
    setIsBulkDeleting(false)
    if (result.success) {
      const d = result.data?.deleted ?? ids.length
      const s = result.data?.skipped ?? 0
      toast.success(`${d} producto(s) eliminado(s)${s ? ` · ${s} omitido(s) (tienen ventas asociadas)` : ''}`)
      setIsBulkDeleteOpen(false)
      exitSelectMode()
    } else {
      toast.error(result.error || 'Error al eliminar productos')
    }
  }

  const getProductTypeInfo = (type: ProductType) => {
    return PRODUCT_TYPES[type] || PRODUCT_TYPES.general
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Sticky sede badge — only shows when there are 2+ sedes */}
      {sedes.length >= 2 && (
        <div className="sticky top-0 z-20 -mx-4 px-4 py-2 bg-background/95 backdrop-blur border-b border-border flex items-center gap-3 flex-wrap">
          <MapPin className="h-4 w-4 text-primary shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sede:</span>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setActiveSede('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${activeSede === 'all' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}
            >
              Todas
            </button>
            {sedes.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSede(s.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${activeSede === s.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}
              >
                {s.name}
              </button>
            ))}
          </div>
          <button
            onClick={() => { setEditingSede(null); setSedeForm({ name: '', address: '' }); setIsSedeDialogOpen(true) }}
            className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings2 className="h-3 w-3" />
            Gestionar sedes
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-foreground">Productos</h2>
          <p className="text-sm lg:text-base text-muted-foreground">
            {filteredProducts.length} de {products.length} productos
            {activeSedeObj && <span className="ml-2 text-primary">— Sede: {activeSedeObj.name}</span>}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => { setEditingSede(null); setSedeForm({ name: '', address: '' }); setIsSedeDialogOpen(true) }} className="gap-2 h-10 lg:h-11 text-sm lg:text-base">
            <MapPin className="h-4 w-4 lg:h-5 lg:w-5" />
            Sedes
          </Button>
          {sedes.length >= 2 && (
            <Button variant="outline" onClick={() => setIsSedeStockOpen(true)} className="gap-2 h-10 lg:h-11 text-sm lg:text-base">
              <Warehouse className="h-4 w-4 lg:h-5 lg:w-5" />
              Bodegas
            </Button>
          )}
          <Button variant="outline" onClick={() => setIsCategoryDialogOpen(true)} className="gap-2 h-10 lg:h-11 text-sm lg:text-base">
            <Tags className="h-4 w-4 lg:h-5 lg:w-5" />
            Categorías
          </Button>
          <Button variant="outline" onClick={() => setIsHormaManagerOpen(true)} className="gap-2 h-10 lg:h-11 text-sm lg:text-base">
            <Layers className="h-4 w-4 lg:h-5 lg:w-5" />
            Hormas
          </Button>
          <Button variant="outline" onClick={() => setIsBulkUploadOpen(true)} className="gap-2 h-10 lg:h-11 text-sm lg:text-base">
            <Upload className="h-4 w-4 lg:h-5 lg:w-5" />
            Importar CSV
          </Button>
          <Button variant="outline" onClick={handleExportCsv} disabled={isExporting} className="gap-2 h-10 lg:h-11 text-sm lg:text-base">
            <FileDown className="h-4 w-4 lg:h-5 lg:w-5" />
            {isExporting ? 'Exportando...' : 'Exportar CSV'}
          </Button>
          <Button
            variant={selectMode ? 'default' : 'outline'}
            onClick={() => { setSelectMode(v => !v); setSelectedIds(new Set()) }}
            className="gap-2 h-10 lg:h-11 text-sm lg:text-base"
          >
            <CheckSquare className="h-4 w-4 lg:h-5 lg:w-5" />
            {selectMode ? 'Cancelar selección' : 'Seleccionar'}
          </Button>
          <Button
            variant={bulkVariantMode ? 'default' : 'outline'}
            onClick={() => { if (bulkVariantMode) exitBulkVariantMode(); else setBulkVariantMode(true) }}
            className="gap-2 h-10 lg:h-11 text-sm lg:text-base"
            title="Selecciona variantes desde 'Ver colores/tallas' en cualquier producto para editarlas en grupo"
          >
            <Layers className="h-4 w-4 lg:h-5 lg:w-5" />
            {bulkVariantMode ? 'Cancelar edición' : 'Editar variantes'}
          </Button>
          <Button variant="outline" onClick={() => setIsCloudinaryPickerOpen(true)} className="gap-2 h-10 lg:h-11 text-sm lg:text-base">
            <Cloud className="h-4 w-4 lg:h-5 lg:w-5" />
            Importar Cloudinary
          </Button>
          <Button data-tour="inv-new" onClick={() => setIsAddDialogOpen(true)} className="gap-2 h-10 lg:h-11 text-sm lg:text-base">
            <Plus className="h-4 w-4 lg:h-5 lg:w-5" />
            Agregar Producto
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-border bg-card">
        <CardContent className="p-4 lg:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center" data-tour="inv-filters">
            <div className="relative flex-1" data-tour="inv-search">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, SKU, marca o codigo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-secondary border-none h-10 lg:h-11"
              />
            </div>
            <div className="flex gap-2 sm:gap-3 flex-wrap">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[130px] sm:w-[160px] bg-secondary border-none h-10 lg:h-11">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {Object.values(PRODUCT_TYPES).filter(t => usedTypes.has(t.id)).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.icon} {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[130px] sm:w-[160px] bg-secondary border-none h-10 lg:h-11">
                  <Filter className="mr-2 h-4 w-4 hidden sm:block" />
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categories.filter(cat => usedCategories.has(cat.id)).map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={stockFilter} onValueChange={setStockFilter}>
                <SelectTrigger className="w-[110px] sm:w-[140px] bg-secondary border-none h-10 lg:h-11">
                  <SelectValue placeholder="Stock" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo</SelectItem>
                  <SelectItem value="suficiente">Suficiente</SelectItem>
                  <SelectItem value="bajo">Bajo</SelectItem>
                  <SelectItem value="agotado">Agotado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Barra de acciones bulk */}
      {selectMode && selectedIds.size > 0 && (
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/60 backdrop-blur p-3">
          <span className="text-sm font-medium">{selectedIds.size} producto(s) seleccionado(s)</span>
          <Button size="sm" variant="ghost" onClick={selectAll}>
            {selectedIds.size === filteredProducts.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
          </Button>
          <Button size="sm" variant="destructive" className="ml-auto gap-1" onClick={() => setIsBulkDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" /> Eliminar seleccionados
          </Button>
        </div>
      )}

      {/* Barra de acciones — edición en grupo de variantes (talla/color/lote) */}
      {bulkVariantMode && (
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 backdrop-blur p-3">
          <Layers className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-medium">
            {selectedVariantIds.size > 0 ? `${selectedVariantIds.size} variante(s) seleccionada(s)` : 'Edición en grupo — marca variantes en "Ver colores/tallas"'}
          </span>
          <Button size="sm" variant="ghost" onClick={exitBulkVariantMode} className="ml-auto">
            Cancelar
          </Button>
          <Button size="sm" disabled={selectedVariantIds.size === 0} onClick={openBulkVariantEdit} className="gap-1.5">
            <Edit2 className="h-3.5 w-3.5" /> Editar {selectedVariantIds.size > 0 ? `(${selectedVariantIds.size})` : ''}
          </Button>
        </div>
      )}

      {/* Products Table */}
      <Card className="border-border bg-card">
        <CardContent className="p-0">
          {/* ── Tarjetas (móvil) ── */}
          <div className="md:hidden">
            {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12">
                <Package className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No se encontraron productos</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {pagedProducts.map((product) => {
                  const typeInfo = getProductTypeInfo(product.productType)
                  const mainImg = product.imageUrl || (Array.isArray(product.images) ? product.images[0] : '') || ''
                  const isVariantRowExpanded = expandedVariantIds.has(product.id)
                  const productVariants = variantsByProductId[product.id]
                  const displayStock = getDisplayStock(product)
                  const status = getDisplayStockStatus(product)
                  const displayHormas = getDisplayHormas(product)
                  return (
                    <div
                      key={product.id}
                      id={`product-m-${product.id}`}
                      className={`relative p-3 ${highlightedProduct === product.id ? 'bg-primary/10' : ''} ${selectMode && selectedIds.has(product.id) ? 'bg-primary/5 ring-1 ring-primary/40' : ''}`}
                    >
                      {selectMode && (
                        <button
                          type="button"
                          onClick={() => toggleSelect(product.id)}
                          aria-label="Seleccionar"
                          className={`absolute top-2 left-2 z-10 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                            selectedIds.has(product.id) ? 'bg-primary border-primary text-primary-foreground' : 'bg-background border-muted-foreground/40'
                          }`}
                        >
                          {selectedIds.has(product.id) && <CheckCircle2 className="h-4 w-4" />}
                        </button>
                      )}
                      <div className={`flex gap-3 ${selectMode ? 'pl-8' : ''}`}>
                        <button
                          type="button"
                          onClick={() => handleOpenImageDialog(product)}
                          className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary text-lg"
                        >
                          {mainImg ? <img src={mainImg} alt={product.name} className="h-full w-full object-cover" /> : <span>{typeInfo.icon}</span>}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm text-foreground truncate">{product.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{product.sku}</p>
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            <Badge variant="secondary" className="bg-secondary text-muted-foreground text-[10px]">{typeInfo.icon} {typeInfo.name}</Badge>
                            <Badge variant="secondary" className="bg-secondary text-muted-foreground text-[10px]">{getCategoryName(product.category)}</Badge>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold text-sm">{formatCOP(product.salePrice)}</p>
                          <p className="text-[11px] text-muted-foreground">Costo {formatCOP(product.purchasePrice)}</p>
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <span className={`h-2 w-2 rounded-full ${status === 'suficiente' ? 'bg-primary' : status === 'bajo' ? 'bg-warning' : 'bg-destructive'}`} />
                            <span className={`text-xs font-medium ${status === 'suficiente' ? 'text-primary' : status === 'bajo' ? 'text-warning' : 'text-destructive'}`}>{displayStock}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-1 mt-2 pt-2 border-t border-border/60">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleVariantRow(product.id)}
                          className="h-8 px-2 text-xs text-muted-foreground gap-1"
                        >
                          {isVariantRowExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          Ver colores/tallas
                        </Button>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" title="Variantes / Tiers" onClick={() => setVariantProduct(product)} className="h-8 w-8 text-primary"><Layers className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" title="Modificadores" onClick={() => setModifiersProduct(product)} className="h-8 w-8 text-primary"><SlidersHorizontal className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(product)} className="h-8 w-8"><Edit2 className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(product)} className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                      {productVariants && productVariants.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border/60">
                          <VariantQuickPicker
                            variants={productVariants}
                            hormaById={hormaById}
                            getVariantStockStatus={getVariantStockStatus}
                            onHormaChange={(hid) => setHormaFilterFor(product.id, hid)}
                            onSizeChange={(sz) => setSizeFilterFor(product.id, sz)}
                            onColorChange={(c) => setColorFilterFor(product.id, c)}
                          />
                        </div>
                      )}
                      {isVariantRowExpanded && (() => {
                        const activeHormaFilter = expandedHormaFilter[product.id] || null
                        const activeSizeFilter = expandedSizeFilter[product.id] || null
                        const activeColorFilter = expandedColorFilter[product.id] || null
                        const isFiltered = !!(activeHormaFilter || activeSizeFilter || activeColorFilter)
                        const filteredVariants = getFilteredVariantsFor(product.id, productVariants)
                        const productSizes = getDisplayTallas(product)
                        const productColors = getDisplayColors(product)
                        const allVisibleSelected = filteredVariants.length > 0 && filteredVariants.every(v => selectedVariantIds.has(v.id))
                        return (
                        <div className="mt-2 pt-2 border-t border-border/60">
                          {(displayHormas.length > 1 || productSizes.length > 0 || productColors.length > 0) && (
                            <div className="flex flex-wrap items-center gap-1.5 mb-2">
                              {displayHormas.length > 1 && (
                                <Select value={activeHormaFilter || 'all'} onValueChange={(v) => setHormaFilterFor(product.id, v === 'all' ? null : v)}>
                                  <SelectTrigger className="h-7 w-auto min-w-[92px] text-[11px] bg-secondary border-none px-2"><SelectValue placeholder="Horma" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">Todas las hormas</SelectItem>
                                    {displayHormas.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              )}
                              {productSizes.length > 0 && (
                                <Select value={activeSizeFilter || 'all'} onValueChange={(v) => setSizeFilterFor(product.id, v === 'all' ? null : v)}>
                                  <SelectTrigger className="h-7 w-auto min-w-[80px] text-[11px] bg-secondary border-none px-2"><SelectValue placeholder="Talla" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">Todas las tallas</SelectItem>
                                    {productSizes.map(sz => <SelectItem key={sz} value={sz}>{sz}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              )}
                              {productColors.length > 0 && (
                                <Select value={activeColorFilter || 'all'} onValueChange={(v) => setColorFilterFor(product.id, v === 'all' ? null : v)}>
                                  <SelectTrigger className="h-7 w-auto min-w-[90px] text-[11px] bg-secondary border-none px-2"><SelectValue placeholder="Color" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">Todos los colores</SelectItem>
                                    {productColors.map(c => (
                                      <SelectItem key={c.color} value={c.color}>
                                        <span className="inline-flex items-center gap-1.5">
                                          <span className="h-2.5 w-2.5 rounded-full border shrink-0" style={{ backgroundColor: resolveColorHex(c.color, c.hex) }} />
                                          {c.color}
                                        </span>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                              {isFiltered && (
                                <button
                                  type="button"
                                  onClick={() => { setHormaFilterFor(product.id, null); setSizeFilterFor(product.id, null); setColorFilterFor(product.id, null) }}
                                  className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  <X className="h-3 w-3" /> Limpiar
                                </button>
                              )}
                            </div>
                          )}
                          {bulkVariantMode && filteredVariants.length > 0 && (
                            <label className="flex items-center gap-2 mb-1.5 cursor-pointer select-none">
                              <Checkbox checked={allVisibleSelected} onCheckedChange={() => toggleSelectVariantGroup(filteredVariants)} />
                              <span className="text-[11px] text-muted-foreground">
                                Seleccionar {isFiltered ? 'este grupo' : 'todas'} ({filteredVariants.length})
                              </span>
                            </label>
                          )}
                          {!filteredVariants || filteredVariants.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-1">
                              {isFiltered ? 'Ninguna variante coincide con el filtro.' : 'Sin variantes (color/talla) registradas.'}
                            </p>
                          ) : (
                            <div className="space-y-1.5">
                              {sortVariantsForDisplay(filteredVariants).map((v, idx, arr) => {
                                const vStatus = getVariantStockStatus(v)
                                const price = v.priceOverride ?? v.basePrice
                                const vHorma = v.hormaName || (v.hormaId ? hormaById[v.hormaId]?.name : null)
                                const prevHorma = idx > 0 ? (arr[idx - 1].hormaName || (arr[idx - 1].hormaId ? hormaById[arr[idx - 1].hormaId!]?.name : null)) : null
                                const showHormaLabel = displayHormas.length > 1 && vHorma !== prevHorma
                                return (
                                  <div key={v.id}>
                                    {showHormaLabel && (
                                      <p className="text-[10px] font-semibold text-foreground mt-2 mb-1 first:mt-0">{vHorma || 'Sin horma'}</p>
                                    )}
                                    <div className="flex items-center gap-2 text-xs">
                                      {bulkVariantMode && (
                                        <Checkbox
                                          checked={isVariantSelected(v.id)}
                                          onCheckedChange={() => toggleVariantSelect(v.id)}
                                          aria-label={`Seleccionar ${v.sku}`}
                                          className="shrink-0"
                                        />
                                      )}
                                      {v.color && (
                                        <span
                                          className="h-3 w-3 rounded-full border shrink-0"
                                          style={{ backgroundColor: resolveColorHex(v.color || '', v.colorHex) }}
                                        />
                                      )}
                                      <span className="flex-1 truncate">{v.color || '—'}{v.size ? ` · ${v.size}` : ''}</span>
                                      <code className="text-[10px] text-muted-foreground bg-muted rounded px-1 py-0.5">{v.sku}</code>
                                      {price != null && <span className="text-muted-foreground">{formatCOP(price)}</span>}
                                      <span className={`font-medium ${
                                        vStatus === 'suficiente' ? 'text-primary' :
                                        vStatus === 'bajo' ? 'text-warning' : 'text-destructive'
                                      }`}>
                                        {v.stock}
                                      </span>
                                      {!bulkVariantMode && (
                                        <>
                                          <Button variant="ghost" size="icon" title="Editar variante" onClick={() => openQuickEditVariant(v)} className="h-6 w-6 shrink-0"><Edit2 className="h-3 w-3" /></Button>
                                          <Button variant="ghost" size="icon" title="Eliminar variante" onClick={() => setDeletingQuickVariant(v)} className="h-6 w-6 shrink-0 text-destructive"><Trash2 className="h-3 w-3" /></Button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                        )
                      })()}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Tabla (escritorio) ── */}
          <div className="hidden md:block overflow-x-auto">
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                {selectMode && (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filteredProducts.length > 0 && selectedIds.size === filteredProducts.length}
                      onCheckedChange={selectAll}
                      aria-label="Seleccionar todo"
                    />
                  </TableHead>
                )}
                <TableHead className="text-muted-foreground text-sm lg:text-base">Producto</TableHead>
                <TableHead className="text-muted-foreground text-sm lg:text-base">Horma</TableHead>
                <TableHead className="text-muted-foreground text-sm lg:text-base">Talla</TableHead>
                <TableHead className="text-muted-foreground text-sm lg:text-base">Color</TableHead>
                <TableHead className="text-muted-foreground text-sm lg:text-base text-center">Stock</TableHead>
                <TableHead className="text-muted-foreground text-sm lg:text-base">Peso / Composición</TableHead>
                <TableHead className="text-muted-foreground text-sm lg:text-base">SKU</TableHead>
                <TableHead className="text-muted-foreground text-sm lg:text-base">Tipo</TableHead>
                <TableHead className="text-muted-foreground text-sm lg:text-base">Categoria</TableHead>
                {sedes.length >= 2 && <TableHead className="text-muted-foreground text-sm lg:text-base">Sede</TableHead>}
                <TableHead className="text-muted-foreground text-sm lg:text-base text-right">Precio</TableHead>
                <TableHead className="text-muted-foreground text-sm lg:text-base text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={inventoryColSpan} className="h-24 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="h-8 w-8 lg:h-10 lg:w-10 text-muted-foreground" />
                      <p className="text-sm lg:text-base text-muted-foreground">No se encontraron productos</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                pagedProducts.map((product) => {
                  const typeInfo = getProductTypeInfo(product.productType)
                  const isVariantRowExpanded = expandedVariantIds.has(product.id)
                  const productVariants = variantsByProductId[product.id]
                  const displayStock = getDisplayStock(product)
                  const status = getDisplayStockStatus(product)
                  const displayHormas = getDisplayHormas(product)
                  return (
                    <React.Fragment key={product.id}>
                    <TableRow
                      id={`product-${product.id}`}
                      className={`border-border transition-colors duration-1000 ${
                        highlightedProduct === product.id ? 'bg-primary/15 ring-1 ring-primary/30' : ''
                      } ${selectMode && selectedIds.has(product.id) ? 'bg-primary/10' : ''}`}
                    >
                      {selectMode && (
                        <TableCell className="w-10">
                          <Checkbox
                            checked={selectedIds.has(product.id)}
                            onCheckedChange={() => toggleSelect(product.id)}
                            aria-label={`Seleccionar ${product.name}`}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => toggleVariantRow(product.id)}
                            title="Ver variantes (color / talla / stock)"
                            className="shrink-0 h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground"
                          >
                            {isVariantRowExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                          {(() => {
                            const mainImg = product.imageUrl || (Array.isArray(product.images) ? product.images[0] : '') || ''
                            return (
                              <button
                                type="button"
                                onClick={() => handleOpenImageDialog(product)}
                                title="Gestionar imágenes"
                                className="group relative flex h-10 w-10 lg:h-12 lg:w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary text-lg transition-shadow hover:ring-2 hover:ring-primary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                              >
                                {mainImg ? (
                                  <img src={mainImg} alt={product.name} className="h-full w-full object-cover" />
                                ) : (
                                  <span>{typeInfo.icon}</span>
                                )}
                                <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                                  <ImageIcon className="h-4 w-4 text-white" />
                                </span>
                              </button>
                            )
                          })()}
                          <div>
                            <p className="font-medium text-sm lg:text-base text-foreground">{product.name}</p>
                            {product.articulo && (
                              <p className="text-xs text-muted-foreground/70 italic">Inv: {product.articulo}</p>
                            )}
                            <p className="text-xs lg:text-sm text-muted-foreground">
                              {product.brand || ''}{product.brand && product.color ? ' | ' : ''}{product.color || ''}
                              {product.size ? ` | ${product.size}` : ''}
                            </p>
                            {product.productType === 'ferreteria' && product.weight != null && product.weight > 0 && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 mt-0.5">
                                ⚖ {product.weight} {product.hardwareWeightUnit || 'kg'}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <VariantPickerColumns
                        variants={productVariants || []}
                        hormaById={hormaById}
                        getVariantStockStatus={getVariantStockStatus}
                        fallbackStock={displayStock}
                        fallbackStatus={status}
                        onHormaChange={(hid) => setHormaFilterFor(product.id, hid)}
                        onSizeChange={(sz) => setSizeFilterFor(product.id, sz)}
                        onColorChange={(c) => setColorFilterFor(product.id, c)}
                        onMatchedVariant={(v) => setExpandedMatchedVariant(prev => ({ ...prev, [product.id]: v }))}
                      />
                      <TableCell>
                        <code className="text-muted-foreground text-xs lg:text-sm bg-muted rounded px-1.5 py-0.5">{product.sku}</code>
                      </TableCell>
                      {/* Peso / Composición ya viene dentro de VariantPickerColumns */}
                      <TableCell>
                        <Badge variant="secondary" className="bg-secondary text-muted-foreground text-xs">
                          {typeInfo.icon} {typeInfo.name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-secondary text-muted-foreground text-xs lg:text-sm">
                          {getCategoryName(product.category)}
                        </Badge>
                      </TableCell>
                      {sedes.length >= 2 && (
                        <TableCell>
                          {product.sedeId ? (
                            <Badge variant="outline" className="text-xs border-primary/40 text-primary/80">
                              <MapPin className="h-2.5 w-2.5 mr-1" />
                              {sedes.find(s => s.id === product.sedeId)?.name || '—'}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Todas</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        {(() => {
                          const isRopa = product.productType === 'ropa'
                          // 1. Variante exacta seleccionada (talla + color)
                          const matchedV = expandedMatchedVariant[product.id] ?? null
                          if (isRopa && matchedV) {
                            return (
                              <div>
                                <p className="font-medium text-sm lg:text-base text-foreground">
                                  {matchedV.priceOverride != null ? formatCOP(matchedV.priceOverride) : <span className="text-muted-foreground text-xs">Sin precio</span>}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Costo: {matchedV.costPrice != null ? formatCOP(matchedV.costPrice) : '—'}
                                </p>
                                <p className="text-[10px] text-primary/70 mt-0.5">variante exacta</p>
                              </div>
                            )
                          }
                          // 2. Horma seleccionada (precio de la horma)
                          if (isRopa && productVariants?.length) {
                            const activeHormaId = expandedHormaFilter[product.id] ?? (() => {
                              const ids = Array.from(new Set(productVariants.map(v => v.hormaId).filter(Boolean))) as string[]
                              ids.sort((a, b) => (hormaById[a]?.sortOrder ?? 999) - (hormaById[b]?.sortOrder ?? 999))
                              return ids[0] ?? null
                            })()
                            const hv = activeHormaId ? productVariants.filter(v => v.hormaId === activeHormaId) : productVariants
                            const hp = hv.find(v => v.priceOverride != null)?.priceOverride ?? null
                            const hc = hv.find(v => v.costPrice != null)?.costPrice ?? null
                            return (
                              <div>
                                <p className="font-medium text-sm lg:text-base text-foreground">
                                  {hp != null ? formatCOP(hp) : <span className="text-muted-foreground text-xs">Sin precio</span>}
                                </p>
                                <p className="text-xs text-muted-foreground">Costo: {hc != null ? formatCOP(hc) : '—'}</p>
                              </div>
                            )
                          }
                          // 3. Producto sin variantes / no ropa
                          return (
                            <div>
                              <p className="font-medium text-sm lg:text-base text-foreground">{formatCOP(product.salePrice)}</p>
                              <p className="text-xs text-muted-foreground">Costo: {formatCOP(product.purchasePrice)}</p>
                            </div>
                          )
                        })()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Variantes / Tiers"
                            onClick={() => setVariantProduct(product)}
                            className="h-8 w-8 lg:h-9 lg:w-9 text-primary hover:text-primary"
                          >
                            <Layers className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Modificadores (adiciones, combos, sin X)"
                            onClick={() => setModifiersProduct(product)}
                            className="h-8 w-8 lg:h-9 lg:w-9 text-primary hover:text-primary"
                          >
                            <SlidersHorizontal className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(product)}
                            className="h-8 w-8 lg:h-9 lg:w-9"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(product)}
                            className="h-8 w-8 lg:h-9 lg:w-9 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isVariantRowExpanded && (() => {
                      const activeHormaFilter = expandedHormaFilter[product.id] || null
                      const activeSizeFilter = expandedSizeFilter[product.id] || null
                      const activeColorFilter = expandedColorFilter[product.id] || null
                      const isFiltered = !!(activeHormaFilter || activeSizeFilter || activeColorFilter)
                      const filteredVariants = getFilteredVariantsFor(product.id, productVariants)
                      const productSizes = getDisplayTallas(product)
                      const productColors = getDisplayColors(product)
                      const allVisibleSelected = filteredVariants.length > 0 && filteredVariants.every(v => selectedVariantIds.has(v.id))
                      return (
                      <TableRow className="border-border bg-muted/10 hover:bg-muted/10">
                        <TableCell colSpan={inventoryColSpan} className="p-0">
                          <div className="px-4 py-3">
                            {(displayHormas.length > 1 || productSizes.length > 0 || productColors.length > 0) && (
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                {displayHormas.length > 1 && (
                                  <Select value={activeHormaFilter || 'all'} onValueChange={(v) => setHormaFilterFor(product.id, v === 'all' ? null : v)}>
                                    <SelectTrigger className="h-8 w-auto min-w-[140px] text-xs bg-secondary border-none px-2.5"><SelectValue placeholder="Horma" /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="all">Todas las hormas</SelectItem>
                                      {displayHormas.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                )}
                                {productSizes.length > 0 && (
                                  <Select value={activeSizeFilter || 'all'} onValueChange={(v) => setSizeFilterFor(product.id, v === 'all' ? null : v)}>
                                    <SelectTrigger className="h-8 w-auto min-w-[110px] text-xs bg-secondary border-none px-2.5"><SelectValue placeholder="Talla" /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="all">Todas las tallas</SelectItem>
                                      {productSizes.map(sz => <SelectItem key={sz} value={sz}>{sz}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                )}
                                {productColors.length > 0 && (
                                  <Select value={activeColorFilter || 'all'} onValueChange={(v) => setColorFilterFor(product.id, v === 'all' ? null : v)}>
                                    <SelectTrigger className="h-8 w-auto min-w-[120px] text-xs bg-secondary border-none px-2.5"><SelectValue placeholder="Color" /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="all">Todos los colores</SelectItem>
                                      {productColors.map(c => (
                                        <SelectItem key={c.color} value={c.color}>
                                          <span className="inline-flex items-center gap-1.5">
                                            <span className="h-2.5 w-2.5 rounded-full border shrink-0" style={{ backgroundColor: resolveColorHex(c.color, c.hex) }} />
                                            {c.color}
                                          </span>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                                {isFiltered && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
                                    onClick={() => { setHormaFilterFor(product.id, null); setSizeFilterFor(product.id, null); setColorFilterFor(product.id, null) }}
                                  >
                                    <X className="h-3 w-3" /> Limpiar
                                  </Button>
                                )}
                              </div>
                            )}
                            {!filteredVariants || filteredVariants.length === 0 ? (
                              <p className="text-xs text-muted-foreground py-2">
                                {isFiltered ? 'Ninguna variante coincide con el filtro.' : 'Este producto no tiene variantes (color/talla) registradas.'}
                              </p>
                            ) : (
                              <div className="rounded-lg border border-border overflow-x-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="border-border hover:bg-transparent">
                                      {bulkVariantMode && (
                                        <TableHead className="w-8">
                                          <Checkbox
                                            checked={allVisibleSelected}
                                            onCheckedChange={() => toggleSelectVariantGroup(filteredVariants)}
                                            aria-label="Seleccionar grupo visible"
                                          />
                                        </TableHead>
                                      )}
                                      {displayHormas.length > 1 && <TableHead className="text-muted-foreground text-xs lg:text-sm">Horma</TableHead>}
                                      <TableHead className="text-muted-foreground text-xs lg:text-sm w-12">Img</TableHead>
                                      <TableHead className="text-muted-foreground text-xs lg:text-sm">Color</TableHead>
                                      <TableHead className="text-muted-foreground text-xs lg:text-sm">Talla</TableHead>
                                      <TableHead className="text-muted-foreground text-xs lg:text-sm">SKU</TableHead>
                                      <TableHead className="text-muted-foreground text-xs lg:text-sm text-right">Precio</TableHead>
                                      <TableHead className="text-muted-foreground text-xs lg:text-sm text-center">Stock</TableHead>
                                      <TableHead className="text-muted-foreground text-xs lg:text-sm text-right">Acciones</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {sortVariantsForDisplay(filteredVariants).map(v => {
                                      const vStatus = getVariantStockStatus(v)
                                      const price = v.priceOverride ?? v.basePrice
                                      return (
                                        <TableRow key={v.id} className={`border-border ${bulkVariantMode && isVariantSelected(v.id) ? 'bg-primary/5' : ''}`}>
                                          {bulkVariantMode && (
                                            <TableCell className="w-8">
                                              <Checkbox
                                                checked={isVariantSelected(v.id)}
                                                onCheckedChange={() => toggleVariantSelect(v.id)}
                                                aria-label={`Seleccionar ${v.sku}`}
                                              />
                                            </TableCell>
                                          )}
                                          {displayHormas.length > 1 && (
                                            <TableCell className="text-xs lg:text-sm text-muted-foreground">
                                              {v.hormaName || (v.hormaId ? hormaById[v.hormaId]?.name : null) || '—'}
                                            </TableCell>
                                          )}
                                          {/* Imagen: variante → producto → placeholder. Clic = configurar imagen. */}
                                          <TableCell className="w-12">
                                            {(() => {
                                              const variantImg = Array.isArray(v.images) ? v.images[0] : (v as any).imageUrl
                                              const productImg = product.imageUrl || (Array.isArray(product.images) ? product.images[0] : '')
                                              const imgSrc = variantImg || productImg || ''
                                              return (
                                                <button
                                                  type="button"
                                                  onClick={() => openVariantImageDialog(v)}
                                                  title="Configurar imagen de la variante"
                                                  className="h-9 w-9 rounded-md border border-border overflow-hidden bg-secondary/30 flex items-center justify-center hover:ring-2 hover:ring-primary/40 transition shrink-0"
                                                >
                                                  {imgSrc ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                      src={imgSrc.replace('/upload/', '/upload/w_48,h_48,c_fill,q_auto,f_auto/')}
                                                      alt={v.sku || ''}
                                                      loading="lazy"
                                                      className="w-full h-full object-cover"
                                                    />
                                                  ) : (
                                                    <ImageIcon className="h-3.5 w-3.5 text-muted-foreground/40" />
                                                  )}
                                                </button>
                                              )
                                            })()}
                                          </TableCell>
                                          <TableCell>
                                            {v.color ? (
                                              <span
                                                title={v.color}
                                                className="inline-block h-5 w-5 rounded-full border shadow-sm"
                                                style={{ backgroundColor: resolveColorHex(v.color || '', v.colorHex) }}
                                              />
                                            ) : (
                                              <span className="text-sm text-muted-foreground">—</span>
                                            )}
                                          </TableCell>
                                          <TableCell className="text-sm lg:text-base text-foreground">{v.size || '—'}</TableCell>
                                          <TableCell>
                                            <code className="text-muted-foreground text-xs lg:text-sm bg-muted rounded px-1.5 py-0.5">{v.sku}</code>
                                          </TableCell>
                                          <TableCell className="text-right text-sm lg:text-base text-muted-foreground">
                                            {price != null ? formatCOP(price) : '—'}
                                          </TableCell>
                                          <TableCell className="text-center">
                                            <span className={`font-medium text-sm lg:text-base ${
                                              vStatus === 'suficiente' ? 'text-primary' :
                                              vStatus === 'bajo' ? 'text-warning' : 'text-destructive'
                                            }`}>
                                              {v.stock}
                                            </span>
                                          </TableCell>
                                          <TableCell className="text-right">
                                            {!bulkVariantMode && (
                                              <div className="flex items-center justify-end gap-2">
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  title="Editar variante"
                                                  onClick={() => openQuickEditVariant(v)}
                                                  className="h-8 w-8 lg:h-9 lg:w-9"
                                                >
                                                  <Edit2 className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  title="Eliminar variante"
                                                  onClick={() => setDeletingQuickVariant(v)}
                                                  className="h-8 w-8 lg:h-9 lg:w-9 text-destructive hover:text-destructive"
                                                >
                                                  <Trash2 className="h-4 w-4" />
                                                </Button>
                                              </div>
                                            )}
                                          </TableCell>
                                        </TableRow>
                                      )
                                    })}
                                  </TableBody>
                                </Table>
                                <div className="flex items-center justify-end gap-2 px-4 py-2 border-t border-border bg-muted/20 text-sm">
                                  <span className="text-muted-foreground">Stock {isFiltered ? 'del filtro' : 'total'}:</span>
                                  <span className="font-semibold text-foreground">{filteredVariants.reduce((s, v) => s + v.stock, 0)}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      )
                    })()}
                    </React.Fragment>
                  )
                })
              )}
            </TableBody>
          </Table>
          </div>

          {/* ── Paginación ── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-3 sm:px-4 flex-wrap">
              <p className="text-xs sm:text-sm text-muted-foreground">
                Mostrando <span className="font-medium text-foreground">{pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filteredProducts.length)}</span> de{' '}
                <span className="font-medium text-foreground">{filteredProducts.length}</span>
              </p>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="h-8 px-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline ml-1">Anterior</span>
                </Button>
                <span className="text-xs sm:text-sm text-muted-foreground px-2 whitespace-nowrap">
                  Página {safePage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="h-8 px-2"
                >
                  <span className="hidden sm:inline mr-1">Siguiente</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Product Dialog */}
      <ProductFormDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSubmit={async (data, variants) => {
          const result = await addProduct(data)
          if (result.success) {
            const newId = (result as any).data?.id
            if (newId && variants && variants.length) {
              const r = await api.bulkCreateVariants(newId, variants)
              if (r.success) {
                const { created, skipped } = r.data || {}
                toast.success(`Producto creado con ${created} variante(s)${skipped ? ` (${skipped} SKUs duplicados omitidos)` : ''}`)
              } else {
                toast.error(`Producto creado pero error en variantes: ${r.error}`)
              }
              await fetchProducts()
              await loadVariantsSummary()
            } else {
              toast.success('Producto creado exitosamente')
            }
            setIsAddDialogOpen(false)
          } else {
            toast.error(result.error || 'Error al crear producto')
            console.error('Error creando producto:', result.error, 'Datos enviados:', data)
          }
        }}
        title="Agregar Producto"
        description="Complete los datos del nuevo producto"
        sedes={sedes}
        defaultSedeId={activeSede !== 'all' ? activeSede : undefined}
      />

      {/* Edit Product Dialog */}
      {selectedProduct && (
        <ProductFormDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onSubmit={async (data) => {
            const result = await updateProduct(selectedProduct.id, data)
            if (result.success) {
              setIsEditDialogOpen(false)
              setSelectedProduct(null)
              toast.success('Producto actualizado exitosamente')
            } else {
              toast.error(result.error || 'Error al actualizar producto')
            }
          }}
          title="Editar Producto"
          description="Modifique los datos del producto"
          initialData={selectedProduct}
          sedes={sedes}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Producto</DialogTitle>
            <DialogDescription>
              Esta seguro que desea eliminar &quot;{selectedProduct?.name}&quot;? Esta accion no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation */}
      <Dialog open={isBulkDeleteOpen} onOpenChange={(v) => !isBulkDeleting && setIsBulkDeleteOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar productos seleccionados</DialogTitle>
            <DialogDescription>
              ¿Seguro que deseas eliminar {selectedIds.size} producto(s)? Esta acción no se puede deshacer.
              Los productos con ventas asociadas se omitirán.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkDeleteOpen(false)} disabled={isBulkDeleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmBulkDelete} disabled={isBulkDeleting}>
              {isBulkDeleting ? 'Eliminando…' : `Eliminar ${selectedIds.size}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Image Upload Dialog */}
      {selectedProduct && (
        <Dialog open={isImageDialogOpen} onOpenChange={(open) => { setIsImageDialogOpen(open); if (!open) setSelectedProduct(null) }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Imágenes del Producto</DialogTitle>
              <DialogDescription>
                {selectedProduct.name} — Cargue hasta 4 imágenes. La primera es la imagen principal.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 py-2">
              {[0, 1, 2, 3].map((idx) => (
                <div key={idx} className="rounded-lg border border-border p-2 bg-secondary/20">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    {idx === 0 ? 'Imagen principal ★' : `Imagen ${idx + 1}`}
                  </p>
                  <CloudinaryUpload
                    value={imageDialogData.images[idx] || ''}
                    onChange={(url) => {
                      const next = [...imageDialogData.images]
                      next[idx] = url
                      setImageDialogData({ imageUrl: next[0] || '', images: next })
                    }}
                    previewClassName="h-20 w-full object-cover rounded border"
                    accept="image/*,image/gif"
                  />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsImageDialogOpen(false); setSelectedProduct(null) }}>
                Cancelar
              </Button>
              <Button onClick={handleSaveImages} disabled={isSavingImages}>
                {isSavingImages ? 'Guardando...' : 'Guardar Imágenes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Quick Image Upload Dialog — Variante */}
      {imageVariant && (
        <Dialog open={!!imageVariant} onOpenChange={(open) => { if (!open) setImageVariant(null) }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Imagen de la variante</DialogTitle>
              <DialogDescription>
                {imageVariant.sku} — Cargue hasta 4 imágenes. La primera es la imagen principal de la variante.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 py-2">
              {[0, 1, 2, 3].map((idx) => (
                <div key={idx} className="rounded-lg border border-border p-2 bg-secondary/20">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    {idx === 0 ? 'Imagen principal ★' : `Imagen ${idx + 1}`}
                  </p>
                  <CloudinaryUpload
                    value={variantImageForm[idx] || ''}
                    onChange={(url) => {
                      const next = [...variantImageForm]
                      next[idx] = url
                      setVariantImageForm(next)
                    }}
                    previewClassName="h-20 w-full object-cover rounded border"
                    accept="image/*,image/gif"
                  />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setImageVariant(null)}>Cancelar</Button>
              <Button onClick={saveVariantImage} disabled={savingVariantImage}>
                {savingVariantImage ? 'Guardando…' : 'Guardar imagen'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Category Management Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={(open) => {
        setIsCategoryDialogOpen(open)
        if (!open) { setEditingCategory(null); setShowHiddenCategories(false) }
      }}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tags className="h-4 w-4 text-primary" />
              Gestionar Categor\u00edas
            </DialogTitle>
            <DialogDescription>
              Crea, edita, oculta y elimina categor\u00edas de tus productos
            </DialogDescription>
          </DialogHeader>

          {/* Existing categories list */}
          <div className="flex-1 overflow-y-auto space-y-2 py-2 min-h-0">
            {/* Header row */}
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {categories.length} categor\u00eda{categories.length !== 1 ? 's' : ''}
              </span>
              <button
                type="button"
                onClick={() => setShowHiddenCategories(v => !v)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showHiddenCategories ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {showHiddenCategories ? 'Ocultar inactivas' : 'Mostrar inactivas'}
              </button>
            </div>

            {categories.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Sin categor\u00edas a\u00fan</p>
            )}

            {categories.map(cat => (
              <div
                key={cat.id}
                className={`rounded-lg border border-border p-3 transition-all ${cat.isActive === false ? 'opacity-50 bg-secondary/20' : 'bg-secondary/30'}`}
              >
                {editingCategory?.id === cat.id ? (
                  /* \u2500\u2500 Inline edit form \u2500\u2500 */
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        value={editingCategoryForm.name}
                        onChange={e => setEditingCategoryForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Nombre"
                        className="h-8 text-sm flex-1"
                        autoFocus
                      />
                      <div className="flex items-center gap-1">
                        <label className="flex items-center gap-1 cursor-pointer text-xs text-muted-foreground">
                          <Palette className="h-3 w-3" />
                          <input
                            type="color"
                            value={editingCategoryForm.color}
                            onChange={e => setEditingCategoryForm(f => ({ ...f, color: e.target.value }))}
                            className="w-7 h-7 rounded border-0 cursor-pointer bg-transparent"
                          />
                        </label>
                      </div>
                    </div>
                    <Input
                      value={editingCategoryForm.description}
                      onChange={e => setEditingCategoryForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Descripci\u00f3n (opcional)"
                      className="h-8 text-sm"
                    />
                    <div className="flex gap-2 justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setEditingCategory(null)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={async () => {
                          if (!editingCategoryForm.name.trim()) return
                          const result = await updateCategory(cat.id, {
                            name: editingCategoryForm.name,
                            description: editingCategoryForm.description || undefined,
                            color: editingCategoryForm.color,
                          })
                          if (result.success) {
                            toast.success('Categor\u00eda actualizada')
                            setEditingCategory(null)
                          } else {
                            toast.error(result.error || 'Error al actualizar')
                          }
                        }}
                      >
                        Guardar
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* \u2500\u2500 Display row \u2500\u2500 */
                  <div className="flex items-center gap-3">
                    {/* Color dot */}
                    <div
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color || '#6366f1' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${cat.isActive === false ? 'line-through text-muted-foreground' : ''}`}>
                        {cat.name}
                      </p>
                      {cat.description && (
                        <p className="text-xs text-muted-foreground truncate">{cat.description}</p>
                      )}
                    </div>
                    {cat.isActive === false && (
                      <span className="text-[10px] bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded shrink-0">oculta</span>
                    )}
                    {/* Actions */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        title="Editar"
                        className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => {
                          setEditingCategory(cat)
                          setEditingCategoryForm({
                            name: cat.name,
                            description: cat.description || '',
                            color: cat.color || '#6366f1',
                          })
                        }}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title={cat.isActive === false ? 'Mostrar' : 'Ocultar'}
                        className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        onClick={async () => {
                          const result = await toggleCategoryVisibility(cat.id)
                          if (result.success) {
                            toast.success(cat.isActive === false ? 'Categor\u00eda visible' : 'Categor\u00eda oculta')
                            fetchCategories(showHiddenCategories)
                          } else {
                            toast.error(result.error || 'Error al cambiar visibilidad')
                          }
                        }}
                      >
                        {cat.isActive === false ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        type="button"
                        title="Eliminar"
                        className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        onClick={async () => {
                          if (!confirm(`\u00bfEliminar categor\u00eda "${cat.name}"? No se puede deshacer.`)) return
                          const result = await deleteCategory(cat.id)
                          if (result.success) {
                            toast.success('Categor\u00eda eliminada')
                            fetchCategories(showHiddenCategories)
                          } else {
                            toast.error(result.error || 'Error al eliminar')
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Separator */}
          <div className="border-t border-border pt-3 mt-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Nueva categor\u00eda</p>
            <form onSubmit={async (e) => {
              e.preventDefault()
              const id = categoryForm.name
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '')
              const result = await addCategory({
                id,
                name: categoryForm.name,
                description: categoryForm.description || undefined,
                color: categoryForm.color,
              })
              if (result.success) {
                toast.success('Categor\u00eda creada')
                setCategoryForm({ name: '', description: '', color: '#6366f1' })
                fetchCategories(showHiddenCategories)
              } else {
                toast.error(result.error || 'Error al crear categor\u00eda')
              }
            }}>
              <div className="flex gap-2 mb-2">
                <Input
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  placeholder="Nombre de la categor\u00eda"
                  required
                  className="h-9 text-sm flex-1"
                />
                <label className="flex items-center gap-1 cursor-pointer shrink-0" title="Color">
                  <div
                    className="h-9 w-9 rounded border border-border flex items-center justify-center"
                    style={{ backgroundColor: categoryForm.color + '33' }}
                  >
                    <Palette className="h-4 w-4" style={{ color: categoryForm.color }} />
                  </div>
                  <input
                    type="color"
                    value={categoryForm.color}
                    onChange={e => setCategoryForm({ ...categoryForm, color: e.target.value })}
                    className="sr-only"
                  />
                </label>
              </div>
              <div className="flex gap-2">
                <Input
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  placeholder="Descripci\u00f3n (opcional)"
                  className="h-9 text-sm flex-1"
                />
                <Button type="submit" size="sm" className="h-9 px-4 shrink-0">
                  <Plus className="h-4 w-4 mr-1" />
                  Crear
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sede Management Dialog */}
      <Dialog open={isSedeDialogOpen} onOpenChange={setIsSedeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gestionar Sedes</DialogTitle>
            <DialogDescription>Agrega o edita las sucursales de tu negocio</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Existing sedes list */}
            {sedes.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs uppercase text-muted-foreground tracking-wider">Sedes existentes</Label>
                {sedes.map(s => (
                  <div key={s.id} className="flex items-center justify-between gap-2 p-2 rounded-lg border border-border bg-secondary/30">
                    <div>
                      <p className="font-medium text-sm">{s.name}</p>
                      {s.address && <p className="text-xs text-muted-foreground">{s.address}</p>}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                        setEditingSede(s)
                        setSedeForm({ name: s.name, address: s.address || '' })
                      }}>
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={async () => {
                        await deleteSede(s.id)
                        if (activeSede === s.id) setActiveSede('all')
                        toast.success('Sede eliminada')
                      }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* Add / Edit form */}
            <form onSubmit={async (e) => {
              e.preventDefault()
              if (!sedeForm.name.trim()) return
              if (editingSede) {
                const result = await updateSede(editingSede.id, { name: sedeForm.name.trim(), address: sedeForm.address || undefined })
                if (result.success) { setEditingSede(null); setSedeForm({ name: '', address: '' }); toast.success('Sede actualizada') }
                else toast.error(result.error || 'Error al actualizar')
              } else {
                const result = await addSede({ name: sedeForm.name.trim(), address: sedeForm.address || undefined })
                if (result.success) { setSedeForm({ name: '', address: '' }); toast.success('Sede creada') }
                else toast.error(result.error || 'Error al crear')
              }
            }} className="space-y-3 border-t border-border pt-4">
              <Label className="text-xs uppercase text-muted-foreground tracking-wider">
                {editingSede ? `Editando: ${editingSede.name}` : 'Nueva sede'}
              </Label>
              <Input
                placeholder="Nombre de la sede (ej: Sede Centro)"
                value={sedeForm.name}
                onChange={e => setSedeForm(p => ({ ...p, name: e.target.value }))}
                required
              />
              <Input
                placeholder="Dirección (opcional)"
                value={sedeForm.address}
                onChange={e => setSedeForm(p => ({ ...p, address: e.target.value }))}
              />
              <div className="flex gap-2">
                {editingSede && (
                  <Button type="button" variant="outline" onClick={() => { setEditingSede(null); setSedeForm({ name: '', address: '' }) }} className="flex-1">
                    Cancelar
                  </Button>
                )}
                <Button type="submit" className="flex-1">
                  {editingSede ? 'Guardar cambios' : 'Agregar sede'}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Upload Dialog */}
      <BulkUploadDialog
        open={isBulkUploadOpen}
        onOpenChange={setIsBulkUploadOpen}
      />

      {/* Horma Manager */}
      <HormaManager open={isHormaManagerOpen} onClose={() => setIsHormaManagerOpen(false)} />

      {/* Multibodega: stock por sede + transferencias */}
      {isSedeStockOpen && (
        <SedeStockPanel open={isSedeStockOpen} onClose={() => { setIsSedeStockOpen(false); fetchProducts() }} sedes={sedes} />
      )}

      {/* Cloudinary Picker — importar imágenes y crear productos masivamente */}
      <CloudinaryPickerModal
        open={isCloudinaryPickerOpen}
        onClose={() => setIsCloudinaryPickerOpen(false)}
        onProductsCreated={(_count) => { fetchProducts(); setIsCloudinaryPickerOpen(false) }}
      />

      {/* Variant Manager */}
      {variantProduct && (
        <VariantManager
          productId={variantProduct.id}
          productName={variantProduct.name}
          hormaId={(variantProduct as any).hormaId}
          open={!!variantProduct}
          onClose={() => { setVariantProduct(null); loadVariantsSummary() }}
        />
      )}

      {modifiersProduct && (
        <ProductModifiersManager
          productId={modifiersProduct.id}
          productName={modifiersProduct.name}
          onClose={() => setModifiersProduct(null)}
        />
      )}

      {/* Editar variante (rápido, desde la tabla de inventario) */}
      <Dialog open={!!editingQuickVariant} onOpenChange={(o) => { if (!o) setEditingQuickVariant(null) }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar variante — {editingQuickVariant?.sku}</DialogTitle>
            <DialogDescription>Para ajustar stock, usa el botón &quot;Variantes / Tiers&quot; del producto.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label className="text-xs">Color (nombre)</Label>
              <div className="flex items-center gap-2">
                <Input value={quickVariantForm.color}
                  onChange={e => setQuickVariantForm(p => ({ ...p, color: e.target.value }))} />
                <input
                  type="color"
                  aria-label="Color exacto"
                  value={/^#[0-9a-fA-F]{6}$/.test(quickVariantForm.colorHex) ? quickVariantForm.colorHex : '#000000'}
                  onChange={e => setQuickVariantForm(p => ({ ...p, colorHex: e.target.value.toUpperCase() }))}
                  className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Talla / Tamaño</Label>
              <Input value={quickVariantForm.size}
                onChange={e => setQuickVariantForm(p => ({ ...p, size: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Costo</Label>
                <Input type="number" min={0} value={quickVariantForm.costPrice}
                  onChange={e => setQuickVariantForm(p => ({ ...p, costPrice: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Precio override</Label>
                <Input type="number" min={0} placeholder="Usa precio base" value={quickVariantForm.priceOverride}
                  onChange={e => setQuickVariantForm(p => ({ ...p, priceOverride: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Imágenes del color (máx. {MAX_VARIANT_IMAGES})</Label>
              <p className="text-[11px] text-muted-foreground mb-2">
                La primera es la principal: al elegir este color en la tienda, la foto cambia a esta galería.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {quickVariantForm.images.map((url, idx) => (
                  <div key={idx} className="rounded-lg border border-border p-1.5 bg-secondary/20">
                    <p className="text-[10px] font-medium text-muted-foreground mb-1">
                      {idx === 0 ? 'Principal ★' : `Imagen ${idx + 1}`}
                    </p>
                    <CloudinaryUpload
                      value={url}
                      onChange={(newUrl) => setQuickVariantForm(p => {
                        const next = [...p.images]
                        next[idx] = newUrl
                        return { ...p, images: next }
                      })}
                      previewClassName="h-16 w-full object-cover rounded border"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingQuickVariant(null)} disabled={savingQuickVariant}>Cancelar</Button>
            <Button onClick={saveQuickVariantEdit} disabled={savingQuickVariant}>
              {savingQuickVariant ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Eliminar variante (confirmación) */}
      <Dialog open={!!deletingQuickVariant} onOpenChange={(o) => { if (!o && !isDeletingQuickVariant) setDeletingQuickVariant(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar variante</DialogTitle>
            <DialogDescription>
              ¿Seguro que deseas eliminar la variante &quot;{deletingQuickVariant?.color || '—'}{deletingQuickVariant?.size ? ` / ${deletingQuickVariant.size}` : ''}&quot; ({deletingQuickVariant?.sku})? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingQuickVariant(null)} disabled={isDeletingQuickVariant}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDeleteQuickVariant} disabled={isDeletingQuickVariant}>
              {isDeletingQuickVariant ? 'Eliminando…' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edición en grupo de variantes — aplica el mismo cambio a todas las
          variantes seleccionadas (ej. todas las de talla M, o todo un color). */}
      <Dialog open={isBulkVariantEditOpen} onOpenChange={(o) => { if (!o && !savingBulkVariant) setIsBulkVariantEditOpen(false) }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar {selectedVariantIds.size} variante(s) en grupo</DialogTitle>
            <DialogDescription>
              El cambio se aplica a todas las variantes seleccionadas. Deja una sección sin marcar para no tocar ese campo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            {/* Stock */}
            <div className="rounded-lg border border-border p-3 space-y-2">
              <Label className="text-xs font-medium">Stock</Label>
              <Select
                value={bulkVariantForm.stockMode}
                onValueChange={(v) => setBulkVariantForm(p => ({ ...p, stockMode: v as typeof p.stockMode }))}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin cambios</SelectItem>
                  <SelectItem value="add">Sumar (entrada)</SelectItem>
                  <SelectItem value="subtract">Restar (salida)</SelectItem>
                  <SelectItem value="set">Establecer cantidad exacta (ajuste)</SelectItem>
                </SelectContent>
              </Select>
              {bulkVariantForm.stockMode !== 'none' && (
                <>
                  <Input
                    type="number" min={0}
                    placeholder={bulkVariantForm.stockMode === 'set' ? 'Cantidad final' : 'Cantidad'}
                    value={bulkVariantForm.stockValue}
                    onChange={e => setBulkVariantForm(p => ({ ...p, stockValue: e.target.value }))}
                  />
                  <Input
                    placeholder="Motivo (requerido) — ej: Recepción pedido proveedor"
                    value={bulkVariantForm.stockReason}
                    onChange={e => setBulkVariantForm(p => ({ ...p, stockReason: e.target.value }))}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {bulkVariantForm.stockMode === 'set'
                      ? 'Cada variante seleccionada quedará con esta cantidad exacta.'
                      : `Esta cantidad se ${bulkVariantForm.stockMode === 'add' ? 'sumará' : 'restará'} al stock actual de cada variante (no es un total).`}
                  </p>
                </>
              )}
            </div>

            {/* Precio override */}
            <div className="rounded-lg border border-border p-3 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={bulkVariantForm.changePrice}
                  onCheckedChange={(v) => setBulkVariantForm(p => ({ ...p, changePrice: !!v }))}
                />
                <span className="text-xs font-medium">Cambiar precio override</span>
              </label>
              {bulkVariantForm.changePrice && (
                <Input
                  type="number" min={0}
                  placeholder="Vacío = quitar override (usar precio base)"
                  value={bulkVariantForm.priceOverride}
                  onChange={e => setBulkVariantForm(p => ({ ...p, priceOverride: e.target.value }))}
                />
              )}
            </div>

            {/* Costo */}
            <div className="rounded-lg border border-border p-3 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={bulkVariantForm.changeCost}
                  onCheckedChange={(v) => setBulkVariantForm(p => ({ ...p, changeCost: !!v }))}
                />
                <span className="text-xs font-medium">Cambiar costo (proveedor)</span>
              </label>
              {bulkVariantForm.changeCost && (
                <Input
                  type="number" min={0}
                  placeholder="0"
                  value={bulkVariantForm.costPrice}
                  onChange={e => setBulkVariantForm(p => ({ ...p, costPrice: e.target.value }))}
                />
              )}
            </div>

            {/* Stock mínimo */}
            <div className="rounded-lg border border-border p-3 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={bulkVariantForm.changeMinStock}
                  onCheckedChange={(v) => setBulkVariantForm(p => ({ ...p, changeMinStock: !!v }))}
                />
                <span className="text-xs font-medium">Cambiar stock mínimo (alerta)</span>
              </label>
              {bulkVariantForm.changeMinStock && (
                <Input
                  type="number" min={0}
                  placeholder="0"
                  value={bulkVariantForm.minStock}
                  onChange={e => setBulkVariantForm(p => ({ ...p, minStock: e.target.value }))}
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkVariantEditOpen(false)} disabled={savingBulkVariant}>Cancelar</Button>
            <Button
              onClick={applyBulkVariantEdit}
              disabled={
                savingBulkVariant ||
                (bulkVariantForm.stockMode === 'none' && !bulkVariantForm.changePrice && !bulkVariantForm.changeCost && !bulkVariantForm.changeMinStock) ||
                (bulkVariantForm.stockMode !== 'none' && !bulkVariantForm.stockReason.trim())
              }
            >
              {savingBulkVariant ? 'Aplicando…' : `Aplicar a ${selectedVariantIds.size} variante(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Tabla de stock Color × Talla con precios y relleno rápido ─────────────────
function HormaStockTable({
  hormaId, hormaName, colors, sizes, matrix,
  purchasePrice, salePrice,
  onCellChange, onFillRow, onFillCol, onFillAll,
  onPurchasePriceChange, onSalePriceChange,
}: {
  hormaId: string
  hormaName: string
  colors: { color: string; hex?: string }[]
  sizes: string[]
  matrix: Record<string, Record<string, string>>
  purchasePrice: string
  salePrice: string
  onCellChange: (color: string, size: string, val: string) => void
  onFillRow: (color: string, val: string) => void
  onFillCol: (size: string, val: string) => void
  onFillAll: (val: string) => void
  onPurchasePriceChange: (val: string) => void
  onSalePriceChange: (val: string) => void
}) {
  const [bulkVal, setBulkVal] = useState('0')

  // Total stock de esta horma
  const totalStock = Object.values(matrix).reduce((sum, row) =>
    sum + Object.values(row).reduce((s, v) => s + (Number(v) || 0), 0), 0)

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header: nombre + precios */}
      <div className="px-4 py-3 border-b border-border bg-muted/30 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-3.5 w-3.5 text-primary" />
            <p className="text-xs font-semibold">{hormaName}</p>
            <span className="text-[10px] text-muted-foreground">({colors.length} colores · {sizes.length} tallas)</span>
          </div>
          <span className="text-[10px] text-muted-foreground">
            Total unidades: <strong className="text-foreground">{totalStock}</strong>
          </span>
        </div>

        {/* Precios de la horma */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Precio compra (COP)</Label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
              <Input
                type="number" min="0" placeholder="50000"
                value={purchasePrice}
                onChange={e => onPurchasePriceChange(e.target.value)}
                className="pl-6 h-8 text-xs"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Precio venta (COP)</Label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
              <Input
                type="number" min="0" placeholder="249999"
                value={salePrice}
                onChange={e => onSalePriceChange(e.target.value)}
                className="pl-6 h-8 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Relleno rápido */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">Llenar stock con</span>
          <Input
            type="number" min="0"
            value={bulkVal}
            onChange={e => setBulkVal(e.target.value)}
            className="h-6 w-14 text-xs text-center px-1"
          />
          <button
            type="button"
            onClick={() => onFillAll(bulkVal)}
            className="text-[10px] px-2 py-1 rounded border border-primary/40 text-primary hover:bg-primary/10 transition-colors font-medium whitespace-nowrap"
          >
            Toda la tabla
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/20">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">Color</th>
              {sizes.map(sz => (
                <th key={sz} className="px-1 py-2 text-center font-medium text-muted-foreground min-w-[64px]">
                  <div className="flex flex-col items-center gap-0.5">
                    <span>{sz}</span>
                    <button
                      type="button"
                      onClick={() => onFillCol(sz, bulkVal)}
                      className="text-[9px] text-primary/60 hover:text-primary leading-none"
                      title={`Llenar columna ${sz} con ${bulkVal}`}
                    >↓ col</button>
                  </div>
                </th>
              ))}
              <th className="px-2 py-2 text-center text-muted-foreground/50 text-[10px] font-normal">→ fila</th>
            </tr>
          </thead>
          <tbody>
            {colors.map(c => (
              <tr key={c.color} className="border-t border-border hover:bg-muted/10 transition-colors">
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <span className="h-3.5 w-3.5 rounded-full border border-border shrink-0" style={{ background: c.hex || resolveColorHex(c.color) || '#ccc' }} />
                    <span className="font-medium">{c.color}</span>
                  </div>
                </td>
                {sizes.map(sz => (
                  <td key={sz} className="px-1 py-1">
                    <Input
                      type="number" min="0" placeholder="0"
                      value={matrix[c.color]?.[sz] ?? ''}
                      onChange={e => onCellChange(c.color, sz, e.target.value)}
                      className="h-8 w-16 text-center px-1 text-xs"
                    />
                  </td>
                ))}
                <td className="px-2 py-1 text-center">
                  <button
                    type="button"
                    onClick={() => onFillRow(c.color, bulkVal)}
                    className="text-[10px] px-1.5 py-0.5 rounded border border-primary/30 text-primary/60 hover:text-primary hover:border-primary/60 transition-colors"
                    title={`Llenar fila con ${bulkVal}`}
                  >llenar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

interface ProductFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: any, variants?: any[]) => void
  title: string
  description: string
  initialData?: Product
  sedes?: Sede[]
  defaultSedeId?: string
}

function ProductFormDialog({
  open,
  onOpenChange,
  onSubmit,
  title,
  description,
  initialData,
  sedes = [],
  defaultSedeId,
}: ProductFormDialogProps) {
  const { categories, products } = useStore()
  const [showScanner, setShowScanner] = useState(false)
  const [showRemoteScanner, setShowRemoteScanner] = useState(false)
  const [formData, setFormData] = useState<Record<string, any>>(() => getInitialFormData(initialData, categories, defaultSedeId))
  const [hormasList, setHormasList] = useState<any[]>([])

  // Reset form and scanner state when dialog opens/closes or initialData changes
  useEffect(() => {
    if (open) {
      const initial = getInitialFormData(initialData, categories, defaultSedeId)
      if (!initialData) {
        initial.sku = generateNextSku(products)
      }
      setFormData(initial)
      setShowScanner(false)
      setShowRemoteScanner(false)
      // Reset del panel de IA
      setAiActive(false)
      setAiVariants([])
      setAiTiers([])
      setAiProvider(null)
      setAiError(null)
      setAiAnalyzing(false)
      // Cargar hormas para productos tipo ropa
      api.getHormas().then(r => { if (r.success && r.data) setHormasList(r.data as any[]) })
    }
  }, [open, initialData, categories, defaultSedeId, products])

  const productType = (formData.productType || 'general') as ProductType
  const typeFields = getFieldsForProductType(productType)

  const updateField = (name: string, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // ── Promo de cantidad (2da unidad % + niveles) — derivada de formData.qtyPromo (JSON) ──
  const parsePromo = (raw: any): { secondUnitPct: number; tiers: { minQty: number; discountPct: number }[] } => {
    try {
      const o = raw ? JSON.parse(raw) : {}
      return { secondUnitPct: Number(o.secondUnitPct) || 0, tiers: Array.isArray(o.tiers) ? o.tiers : [] }
    } catch { return { secondUnitPct: 0, tiers: [] } }
  }
  const promo = parsePromo(formData.qtyPromo)
  const writePromo = (pct: number, tiers: { minQty: number; discountPct: number }[]) => {
    const clean = tiers.filter(t => t.minQty >= 2 && t.discountPct > 0)
    const obj: any = {}
    if (pct > 0) obj.secondUnitPct = pct
    if (clean.length) obj.tiers = clean
    updateField('qtyPromo', Object.keys(obj).length ? JSON.stringify(obj) : '')
  }

  // ── Multi-horma (ropa) ──
  const [selectedHormaIds, setSelectedHormaIds] = useState<string[]>([])
  // hormaMatrix: { [hormaId]: { [color]: { [size]: stockValue } } }
  const [hormaMatrix, setHormaMatrix] = useState<Record<string, Record<string, Record<string, string>>>>({})
  // Precios por horma: { [hormaId]: { purchasePrice: string, salePrice: string } }
  const [hormaPrices, setHormaPrices] = useState<Record<string, { purchasePrice: string; salePrice: string }>>({})

  // ── IA: análisis de imagen → producto + variantes + precios ──────────────────
  const aiFileInputRef = useRef<HTMLInputElement>(null)
  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiProvider, setAiProvider] = useState<string | null>(null)
  // aiActive: cuando hay un análisis cargado, el panel rápido reemplaza la matriz de hormas
  const [aiActive, setAiActive] = useState(false)
  const [aiVariants, setAiVariants] = useState<Array<{ color: string; colorHex: string; stock: string }>>([])
  const [aiTiers, setAiTiers] = useState<Array<{ minQty: string; price: string; label: string }>>([])

  const triggerAiPicker = () => aiFileInputRef.current?.click()

  const handleAiFile = async (file: File | null | undefined) => {
    if (!file) return
    setAiError(null)
    setAiAnalyzing(true)
    setAiProvider(null)
    try {
      // Se reduce antes de subir: una foto de cámara sin comprimir supera el límite
      // del body del backend y tumba la petición en el proxy (502).
      const dataUrl = await fileToDownscaledDataUrl(file)
      const res = await api.analyzeProductImage({ imageBase64: dataUrl, mimeType: 'image/jpeg' })
      if (!res.success || !res.data) {
        setAiError(res.error || 'No se pudo analizar la imagen')
        return
      }
      const d = res.data
      setAiProvider(d.provider)
      // Precargar campos del producto
      setFormData(prev => {
        const next = { ...prev }
        if (d.name) next.name = d.name
        if (d.description) next.description = d.description
        if (d.productType) next.productType = d.productType
        if (d.matchedCategoryId) next.category = d.matchedCategoryId
        // Para ropa el stock/precio viven en variantes → dejar en 0
        if (d.productType === 'ropa') { next.stock = 0; next.reorderPoint = next.reorderPoint ?? 0 }
        // Precio de venta del producto = tier más bajo (detal), como referencia
        if (d.priceTiers?.length) {
          const detal = [...d.priceTiers].sort((a, b) => a.minQty - b.minQty)[0]
          if (detal?.price) next.salePrice = detal.price
        }
        return next
      })
      // Panel editable de variantes por color
      setAiVariants(
        (d.variants || []).map(v => ({
          color: v.color,
          colorHex: v.colorHex || '',
          stock: String(v.stock ?? 0),
        }))
      )
      // Panel editable de precios escalonados
      setAiTiers(
        (d.priceTiers || []).map(t => ({
          minQty: String(t.minQty ?? 1),
          price: String(t.price ?? 0),
          label: t.label || '',
        }))
      )
      setAiActive(true)
      // Si no vino una categoría reconocida, avisar suavemente
      if (!d.matchedCategoryId && d.category) {
        toast.info(`Categoría sugerida: "${d.category}" — selecciónala o crea una`)
      }
    } catch (e: any) {
      setAiError(e?.message || 'Error al analizar la imagen')
    } finally {
      setAiAnalyzing(false)
      if (aiFileInputRef.current) aiFileInputRef.current.value = ''
    }
  }

  const updateAiVariant = (idx: number, patch: Partial<{ color: string; colorHex: string; stock: string }>) =>
    setAiVariants(prev => prev.map((v, i) => (i === idx ? { ...v, ...patch } : v)))
  const removeAiVariant = (idx: number) => setAiVariants(prev => prev.filter((_, i) => i !== idx))
  const addAiVariant = () => setAiVariants(prev => [...prev, { color: '', colorHex: '', stock: '0' }])

  const updateAiTier = (idx: number, patch: Partial<{ minQty: string; price: string; label: string }>) =>
    setAiTiers(prev => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)))
  const removeAiTier = (idx: number) => setAiTiers(prev => prev.filter((_, i) => i !== idx))
  const addAiTier = () => setAiTiers(prev => [...prev, { minQty: '1', price: '', label: '' }])

  const clearAi = () => {
    setAiActive(false)
    setAiVariants([])
    setAiTiers([])
    setAiProvider(null)
    setAiError(null)
  }

  const toggleHorma = (hid: string) => {
    setSelectedHormaIds(prev => {
      const next = prev.includes(hid) ? prev.filter(x => x !== hid) : [...prev, hid]
      const h = hormasList.find((x: any) => String(x.id) === String(hid))
      // Inicializar matriz
      setHormaMatrix(prevM => {
        const m = { ...prevM }
        for (const id of next) {
          if (!m[id]) {
            const horma = hormasList.find((x: any) => String(x.id) === String(id))
            if (horma) {
              const sizes: string[] = horma.sizeChart ? Object.keys(horma.sizeChart) : []
              const colors: { color: string }[] = horma.colors || []
              m[id] = {}
              for (const c of colors) { m[id][c.color] = {}; for (const sz of sizes) m[id][c.color][sz] = '' }
            }
          }
        }
        for (const id of Object.keys(m)) { if (!next.includes(id)) delete m[id] }
        return m
      })
      // Inicializar precios con los de la horma (baseCost / basePrice)
      setHormaPrices(prevP => {
        const p = { ...prevP }
        if (!p[hid] && h) {
          p[hid] = {
            purchasePrice: h.baseCost ? String(h.baseCost) : '',
            salePrice: h.basePrice ? String(h.basePrice) : '',
          }
        }
        for (const id of Object.keys(p)) { if (!next.includes(id)) delete p[id] }
        return p
      })
      return next
    })
  }

  const setHormaPrice = (hid: string, field: 'purchasePrice' | 'salePrice', val: string) => {
    setHormaPrices(prev => ({ ...prev, [hid]: { ...(prev[hid] || { purchasePrice: '', salePrice: '' }), [field]: val } }))
  }

  // Reset al abrir/cerrar dialog
  useEffect(() => {
    if (!open) { setSelectedHormaIds([]); setHormaMatrix({}); setHormaPrices({}) }
  }, [open])

  const setMatrixCell = (hormaId: string, color: string, size: string, val: string) => {
    setHormaMatrix(prev => ({
      ...prev,
      [hormaId]: { ...(prev[hormaId] || {}), [color]: { ...(prev[hormaId]?.[color] || {}), [size]: val } },
    }))
  }

  const fillRow = (hormaId: string, color: string, sizes: string[], val: string) => {
    setHormaMatrix(prev => {
      const m = { ...prev, [hormaId]: { ...(prev[hormaId] || {}) } }
      m[hormaId][color] = {}
      for (const sz of sizes) m[hormaId][color][sz] = val
      return m
    })
  }

  const fillCol = (hormaId: string, colors: string[], size: string, val: string) => {
    setHormaMatrix(prev => {
      const m = { ...prev, [hormaId]: { ...(prev[hormaId] || {}) } }
      for (const c of colors) m[hormaId][c] = { ...(m[hormaId][c] || {}), [size]: val }
      return m
    })
  }

  const fillAll = (hormaId: string, colors: string[], sizes: string[], val: string) => {
    setHormaMatrix(prev => {
      const m: Record<string, Record<string, Record<string, string>>> = { ...prev, [hormaId]: {} }
      for (const c of colors) { m[hormaId][c] = {}; for (const sz of sizes) m[hormaId][c][sz] = val }
      return m
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Clean up empty/whitespace-only strings to not send them.
    // Excepción: qtyPromo SIEMPRE viaja (incluso '') para poder BORRAR la promo (backend → NULL).
    const cleaned: Record<string, any> = {}
    for (const [key, value] of Object.entries(formData)) {
      if (key === 'qtyPromo') { cleaned[key] = value ?? ''; continue }
      if (value === '' || value === undefined || value === null) continue
      if (typeof value === 'string' && value.trim() === '') continue
      // countryOfOrigin es objeto { country, state, city } → serializar como string legible
      if (key === 'countryOfOrigin' && typeof value === 'object') {
        const parts = [value.country, value.state, value.city].filter(Boolean)
        if (parts.length) cleaned[key] = parts.join(', ')
        continue
      }
      cleaned[key] = typeof value === 'string' ? value.trim() : value
    }

    // Construir variantes desde la matriz multi-horma
    let variants: any[] | undefined
    if (aiActive && aiVariants.length > 0) {
      // ── Variantes detectadas por IA: una por color, con precios detal/mayorista ──
      const skuBase = (cleaned.sku || 'VAR').toUpperCase().replace(/[^A-Z0-9]/g, '')
      const slug = (s: string) => s.trim().toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9-]/g, '')
      const tiers = aiTiers
        .map(t => ({ minQty: parseInt(t.minQty) || 1, price: parseFloat(t.price) || 0 }))
        .filter(t => t.price > 0)
      const seenSku = new Set<string>()
      variants = aiVariants
        .filter(v => v.color.trim())
        .map(v => {
          let sku = `${skuBase}-${slug(v.color)}`
          while (seenSku.has(sku)) sku = `${sku}-1`
          seenSku.add(sku)
          return {
            sku,
            color: v.color.trim(),
            colorHex: v.colorHex || '',
            stock: parseInt(v.stock) || 0,
            minStock: 0,
            priceTiers: tiers,
          }
        })
      // Para ropa: stock/precio a nivel producto son 0 — los reales viven en variantes
      if (productType === 'ropa') {
        cleaned.stock = 0
        cleaned.reorderPoint = cleaned.reorderPoint ?? 0
        cleaned.purchasePrice = cleaned.purchasePrice ?? 0
        cleaned.salePrice = cleaned.salePrice ?? (tiers[0]?.price ?? 0)
      }
    } else if (selectedHormaIds.length > 0 && Object.keys(hormaMatrix).length > 0) {
      const skuBase = (cleaned.sku || 'VAR').toUpperCase().replace(/[^A-Z0-9]/g, '')
      const slug = (s: string) => s.trim().toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9-]/g, '')
      variants = []
      for (const hid of selectedHormaIds) {
        const h = hormasList.find((x: any) => String(x.id) === String(hid))
        const prices = hormaPrices[hid] || { purchasePrice: '', salePrice: '' }
        const colorMap = hormaMatrix[hid] || {}
        for (const [color, sizes] of Object.entries(colorMap)) {
          const colorEntry = (h?.colors || []).find((c: any) => c.color === color)
          for (const [size, stockVal] of Object.entries(sizes as Record<string, string>)) {
            variants!.push({
              sku: `${skuBase}-${slug(h?.name || hid)}-${slug(color)}-${slug(size)}`,
              color,
              colorHex: colorEntry?.hex || '',
              size,
              hormaId: hid,
              stock: Number(stockVal) || 0,
              minStock: 0,
              costPrice: prices.purchasePrice !== '' ? Number(prices.purchasePrice) : null,
              priceOverride: prices.salePrice !== '' ? Number(prices.salePrice) : null,
            })
          }
        }
      }
      // Para ropa: stock/precio a nivel producto son 0 — los reales viven en variantes
      cleaned.stock = 0
      cleaned.reorderPoint = cleaned.reorderPoint ?? 0
      cleaned.purchasePrice = cleaned.purchasePrice ?? 0
      cleaned.salePrice = cleaned.salePrice ?? 0
    }

    onSubmit(cleaned, variants)
  }

  // Campos dinámicos del tipo — para ropa, excluir 'color' y 'size' (los maneja la tabla de variantes)
  const visibleTypeFields = productType === 'ropa'
    ? typeFields.filter(f => f.name !== 'color' && f.name !== 'size')
    : typeFields

  // Helper para el slot de imágenes
  const renderImageSlot = (idx: number) => {
    const imagesArr: string[] = Array.isArray(formData.images) ? formData.images : []
    const slotValue = idx === 0 ? (formData.imageUrl || imagesArr[0] || '') : (imagesArr[idx] || '')
    const handleSlotChange = (url: string) => {
      const next = [...Array(4)].map((_, i) => {
        if (i === 0) return idx === 0 ? url : (formData.imageUrl || imagesArr[0] || '')
        return i === idx ? url : (imagesArr[i] || '')
      })
      updateField('images', next.map(u => u.trim()))
      if (idx === 0) updateField('imageUrl', url)
    }
    return (
      <div key={idx} className="rounded-lg border border-border p-2 bg-secondary/20">
        <p className="text-xs font-medium text-muted-foreground mb-1.5">
          {idx === 0 ? 'Principal ★' : `Imagen ${idx + 1}`}
        </p>
        <CloudinaryUpload
          value={slotValue}
          onChange={handleSlotChange}
          previewClassName="h-16 w-full object-cover rounded border"
          accept="image/*,image/gif"
        />
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Modal ancho: 95vw con máximo 1200px en desktop */}
      <DialogContent className="!w-[min(1200px,95vw)] !max-w-none max-h-[92vh] flex flex-col p-0 gap-0">
        {/* Header fijo */}
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0">
          <DialogTitle className="text-base">{title}</DialogTitle>
          <DialogDescription className="text-xs">{description}</DialogDescription>
        </DialogHeader>

        {/* Contenido scrollable */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 px-5 py-4">

            {/* ══ Tipo de producto — compacto ══ */}
            <div className="mb-4">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">Tipo de Producto</Label>
              <div className="flex flex-wrap gap-1.5">
                {Object.values(PRODUCT_TYPES).map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => updateField('productType', type.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                      productType === type.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground'
                    }`}
                  >
                    <span>{type.icon}</span>
                    <span>{type.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ══ Crear con IA desde una imagen (solo al crear) ══ */}
            {!initialData && (
              <div className="mb-4 rounded-lg border border-primary/30 bg-primary/[0.03] p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">Crear con IA desde una imagen</p>
                      <p className="text-[11px] text-muted-foreground">Sube la foto del catálogo y la IA detecta nombre, colores, stock y precios.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {aiProvider && !aiAnalyzing && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-green-600">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {aiProvider === 'gemini' ? 'Gemini' : aiProvider === 'groq' ? 'Groq' : 'OpenAI'}
                      </span>
                    )}
                    <Button type="button" size="sm" variant="outline" onClick={triggerAiPicker} disabled={aiAnalyzing}>
                      {aiAnalyzing
                        ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Analizando…</>
                        : <><Sparkles className="h-3.5 w-3.5 mr-1.5" /> {aiActive ? 'Analizar otra' : 'Analizar imagen'}</>}
                    </Button>
                    {aiActive && (
                      <Button type="button" size="sm" variant="ghost" onClick={clearAi} disabled={aiAnalyzing} className="text-muted-foreground">
                        <X className="h-3.5 w-3.5 mr-1" /> Descartar
                      </Button>
                    )}
                  </div>
                </div>

                <input
                  ref={aiFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => handleAiFile(e.target.files?.[0])}
                />

                {aiError && (
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] text-red-500">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {aiError}
                  </p>
                )}

                {aiActive && (
                  <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {/* ── Variantes por color ── */}
                    <div className="rounded-md border border-border bg-card p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Colores / variantes</p>
                        <button type="button" onClick={addAiVariant} className="text-[11px] text-primary hover:underline inline-flex items-center gap-0.5">
                          <Plus className="h-3 w-3" /> Agregar
                        </button>
                      </div>
                      <div className="space-y-1.5 max-h-56 overflow-y-auto">
                        {aiVariants.length === 0 && <p className="text-[11px] text-muted-foreground">Sin colores detectados.</p>}
                        {aiVariants.map((v, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <input
                              type="color"
                              value={/^#[0-9a-fA-F]{6}$/.test(v.colorHex) ? v.colorHex : '#cccccc'}
                              onChange={e => updateAiVariant(i, { colorHex: e.target.value })}
                              className="h-8 w-8 rounded border border-border cursor-pointer shrink-0 p-0.5"
                              title="Color"
                            />
                            <Input
                              value={v.color}
                              onChange={e => updateAiVariant(i, { color: e.target.value })}
                              placeholder="Nombre del color"
                              className="h-8 text-xs flex-1"
                            />
                            <Input
                              type="number"
                              min="0"
                              value={v.stock}
                              onChange={e => updateAiVariant(i, { stock: e.target.value })}
                              placeholder="Stock"
                              className="h-8 text-xs w-16"
                            />
                            <button type="button" onClick={() => removeAiVariant(i)} className="text-muted-foreground hover:text-red-500 shrink-0">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* ── Precios escalonados (detal / mayorista) ── */}
                    <div className="rounded-md border border-border bg-card p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Precios por cantidad</p>
                        <button type="button" onClick={addAiTier} className="text-[11px] text-primary hover:underline inline-flex items-center gap-0.5">
                          <Plus className="h-3 w-3" /> Agregar
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5 mb-1 px-0.5">
                        <span className="text-[10px] text-muted-foreground w-20">Desde (uds)</span>
                        <span className="text-[10px] text-muted-foreground flex-1">Precio (COP)</span>
                        <span className="text-[10px] text-muted-foreground w-20">Etiqueta</span>
                        <span className="w-4" />
                      </div>
                      <div className="space-y-1.5 max-h-56 overflow-y-auto">
                        {aiTiers.length === 0 && <p className="text-[11px] text-muted-foreground">Sin precios detectados.</p>}
                        {aiTiers.map((t, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <Input
                              type="number"
                              min="1"
                              value={t.minQty}
                              onChange={e => updateAiTier(i, { minQty: e.target.value })}
                              className="h-8 text-xs w-20"
                            />
                            <Input
                              type="number"
                              min="0"
                              value={t.price}
                              onChange={e => updateAiTier(i, { price: e.target.value })}
                              placeholder="0"
                              className="h-8 text-xs flex-1"
                            />
                            <Input
                              value={t.label}
                              onChange={e => updateAiTier(i, { label: e.target.value })}
                              placeholder="Detal…"
                              className="h-8 text-xs w-20"
                            />
                            <button type="button" onClick={() => removeAiTier(i)} className="text-muted-foreground hover:text-red-500 shrink-0">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <p className="mt-2 text-[10px] text-muted-foreground">Estos precios se aplican a todos los colores como price-tiers.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ══ Grid 2 columnas (desktop) ══ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* ── Columna izquierda: Información básica ── */}
              <div className="rounded-lg border border-border p-4 space-y-3 bg-card">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Información básica</p>

                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs">Nombre en tienda *</Label>
                  <Input id="name" value={formData.name || ''} onChange={e => updateField('name', e.target.value)} placeholder="Nombre visible para clientes" required className="h-9" />
                </div>

                {/* ── Hormas (solo ropa) — aparece como 2do campo ── */}
                {productType === 'ropa' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Hormas disponibles *</Label>
                    <p className="text-[10px] text-muted-foreground -mt-0.5">Selecciona todas las hormas en las que viene este producto</p>
                    {hormasList.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Sin hormas — crea una primero en Inventario → Hormas</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {hormasList.map((h: any) => {
                          const active = selectedHormaIds.includes(String(h.id))
                          return (
                            <button
                              key={h.id}
                              type="button"
                              onClick={() => toggleHorma(String(h.id))}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors ${
                                active
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                              }`}
                            >
                              {active && <Check className="h-3 w-3" />}
                              {h.name}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="articulo" className="text-xs">Artículo (inventario)</Label>
                    <Input id="articulo" value={formData.articulo || ''} onChange={e => updateField('articulo', e.target.value)} placeholder="Nombre interno" className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="category" className="text-xs">Categoría *</Label>
                    <Select value={formData.category || ''} onValueChange={v => updateField('category', v)}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>
                        {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

            {/* ── Precios ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="purchasePrice">Precio de compra (COP) *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    id="purchasePrice"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="50000"
                    value={formData.purchasePrice || ''}
                    onChange={(e) => updateField('purchasePrice', parseFloat(e.target.value) || 0)}
                    className="pl-7"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="salePrice">Precio de venta (COP) {formData.category !== 'insumos' && '*'}</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    id="salePrice"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={formData.category === 'insumos' ? '0' : '249999'}
                    value={formData.salePrice || ''}
                    onChange={(e) => updateField('salePrice', parseFloat(e.target.value) || 0)}
                    className="pl-7"
                  />
                </div>
              </div>
            </div>

            {/* ── Promo de cantidad (estilo "2da unidad con descuento") ── */}
            <div className="space-y-3 rounded-lg border border-dashed p-3">
              <div>
                <Label className="text-sm font-medium">Promo de cantidad (opcional)</Label>
                <p className="text-xs text-muted-foreground">Se muestra en el detalle estilo Mercado Libre como "Compra 1 / Compra 2…" y aplica el precio combinado al carrito.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="secondUnitPct" className="text-xs">2da unidad con descuento (%)</Label>
                <Input
                  id="secondUnitPct"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Ej: 43 (la 2da unidad un 43% más barata)"
                  value={promo.secondUnitPct || ''}
                  onChange={(e) => { const v = Math.max(0, Math.min(100, parseInt(e.target.value) || 0)); writePromo(v, promo.tiers) }}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Niveles por cantidad</Label>
                {promo.tiers.map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input type="number" min="2" placeholder="Cantidad" className="w-24" value={t.minQty || ''}
                      onChange={(e) => { const next = promo.tiers.map((x, j) => j === i ? { ...x, minQty: parseInt(e.target.value) || 0 } : x); writePromo(promo.secondUnitPct, next) }} />
                    <span className="text-xs text-muted-foreground">uds →</span>
                    <Input type="number" min="1" max="100" placeholder="% desc." className="w-24" value={t.discountPct || ''}
                      onChange={(e) => { const next = promo.tiers.map((x, j) => j === i ? { ...x, discountPct: parseInt(e.target.value) || 0 } : x); writePromo(promo.secondUnitPct, next) }} />
                    <button type="button" onClick={() => { const next = promo.tiers.filter((_, j) => j !== i); writePromo(promo.secondUnitPct, next) }} className="text-xs text-muted-foreground hover:text-red-500">Quitar</button>
                  </div>
                ))}
                <button type="button" onClick={() => { const next = [...promo.tiers, { minQty: 2, discountPct: 10 }]; writePromo(promo.secondUnitPct, next) }} className="text-xs text-primary hover:underline">+ Agregar nivel</button>
              </div>
            </div>

            {/* ── Stock + Reorden + Fecha ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stock">Stock *</Label>
                <Input
                  id="stock"
                  type="number"
                  min="0"
                  placeholder="10"
                  value={formData.stock ?? ''}
                  onChange={(e) => updateField('stock', parseInt(e.target.value) || 0)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reorderPoint">Punto de reorden *</Label>
                <Input
                  id="reorderPoint"
                  type="number"
                  min="0"
                  placeholder="5"
                  value={formData.reorderPoint ?? ''}
                  onChange={(e) => updateField('reorderPoint', parseInt(e.target.value) || 0)}
                  required
                />
              </div>
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label htmlFor="entryDate">Fecha de ingreso *</Label>
                <Input
                  id="entryDate"
                  type="date"
                  value={formData.entryDate || ''}
                  onChange={(e) => updateField('entryDate', e.target.value)}
                  required
                />
              </div>
            </div>

            {/* ── Proveedor ── */}
            <div className="space-y-2">
              <Label htmlFor="supplier">Proveedor</Label>
              <Input
                id="supplier"
                value={formData.supplier || ''}
                onChange={(e) => updateField('supplier', e.target.value)}
                placeholder="Nombre del proveedor"
              />
            </div>

            {/* ── Sede ── */}
            {sedes.length >= 1 && (
              <div className="space-y-2">
                <Label htmlFor="sedeId">Sede / Sucursal</Label>
                <Select
                  value={formData.sedeId || 'all'}
                  onValueChange={(val) => updateField('sedeId', val === 'all' ? '' : val)}
                >
                  <SelectTrigger>
                    <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Todas las sedes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las sedes</SelectItem>
                    {sedes.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Dejar en &quot;Todas&quot; para que aparezca en todas las sedes</p>
              </div>
            )}
            </div>

            {/* ── Galería de imágenes (hasta 4) ── */}
            <div className="space-y-3">
              <Label>Imágenes del Producto (máx. 4)</Label>
              <p className="text-xs text-muted-foreground -mt-1">
                La primera imagen es la principal que se muestra en listas y tienda.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[0, 1, 2, 3].map((idx) => {
                  const imagesArr: string[] = Array.isArray(formData.images) ? formData.images : []
                  const slotValue = idx === 0
                    ? (formData.imageUrl || imagesArr[0] || '')
                    : (imagesArr[idx] || '')

                  const handleSlotChange = (url: string) => {
                    const next = [...Array(4)].map((_, i) => {
                      if (i === 0) return idx === 0 ? url : (formData.imageUrl || imagesArr[0] || '')
                      return i === idx ? url : (imagesArr[i] || '')
                    })
                    const trimmed = next.map(u => u.trim())
                    updateField('images', trimmed)
                    if (idx === 0) updateField('imageUrl', url)
                  }

                  return (
                    <div key={idx} className="rounded-lg border border-border p-2 bg-secondary/20">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        {idx === 0 ? 'Imagen principal ★' : `Imagen ${idx + 1}`}
                      </p>
                      <CloudinaryUpload
                        value={slotValue}
                        onChange={handleSlotChange}
                        previewClassName="h-20 w-full object-cover rounded border"
                        accept="image/*,image/gif"
                      />
                    </div>
                  )
                })}
                  <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="sku" className="text-xs">SKU *</Label>
                      {!initialData && <span className="text-[10px] text-muted-foreground">Auto · editable</span>}
                    </div>
                    <Input id="sku" value={formData.sku || ''} onChange={e => updateField('sku', e.target.value)} required className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="barcode" className="text-xs">Código de barras</Label>
                    <div className="flex gap-1">
                      <div className="flex-1 relative">
                        <Input id="barcode" value={formData.barcode || ''} onChange={e => updateField('barcode', e.target.value)} placeholder="Escanea o ingresa" className={`h-9 ${formData.barcode ? 'border-green-500' : ''}`} />
                        {formData.barcode && <div className="absolute right-2 top-1/2 -translate-y-1/2"><svg className="h-3.5 w-3.5 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg></div>}
                      </div>
                      <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => setShowScanner(true)} title="Cámara local"><ScanLine className="h-3.5 w-3.5" /></Button>
                      <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => setShowRemoteScanner(true)} title="Cámara remota"><Smartphone className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

              {/* ── Columna derecha: Inventario ── */}
              <div className="rounded-lg border border-border p-4 space-y-3 bg-card">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Inventario</p>

                {productType !== 'ropa' && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="purchasePrice" className="text-xs">Precio compra (COP) *</Label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                          <Input id="purchasePrice" type="number" min="0" step="0.01" placeholder="50000" value={formData.purchasePrice || ''} onChange={e => updateField('purchasePrice', parseFloat(e.target.value) || 0)} className="pl-6 h-9" required />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="salePrice" className="text-xs">Precio venta (COP) {formData.category !== 'insumos' && '*'}</Label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                          <Input id="salePrice" type="number" min="0" step="0.01" placeholder="249999" value={formData.salePrice || ''} onChange={e => updateField('salePrice', parseFloat(e.target.value) || 0)} className="pl-6 h-9" />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="stock" className="text-xs">Stock *</Label>
                        <Input id="stock" type="number" min="0" placeholder="10" value={formData.stock ?? ''} onChange={e => updateField('stock', parseInt(e.target.value) || 0)} required className="h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="reorderPoint" className="text-xs">Punto reorden *</Label>
                        <Input id="reorderPoint" type="number" min="0" placeholder="5" value={formData.reorderPoint ?? ''} onChange={e => updateField('reorderPoint', parseInt(e.target.value) || 0)} required className="h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="entryDate" className="text-xs">Fecha ingreso *</Label>
                        <Input id="entryDate" type="date" value={formData.entryDate || ''} onChange={e => updateField('entryDate', e.target.value)} required className="h-9" />
                      </div>
                    </div>
                  </>
                )}

                {productType === 'ropa' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="entryDate" className="text-xs">Fecha ingreso *</Label>
                    <Input id="entryDate" type="date" value={formData.entryDate || ''} onChange={e => updateField('entryDate', e.target.value)} required className="h-9" />
                    <p className="text-[10px] text-muted-foreground">Precios y stock se configuran por horma abajo ↓</p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="supplier" className="text-xs">Proveedor</Label>
                  <Input id="supplier" value={formData.supplier || ''} onChange={e => updateField('supplier', e.target.value)} placeholder="Nombre del proveedor" className="h-9" />
                </div>

                {sedes.length >= 1 && (
                  <div className="space-y-1.5">
                    <Label htmlFor="sedeId" className="text-xs">Sede / Sucursal</Label>
                    <Select value={formData.sedeId || 'all'} onValueChange={val => updateField('sedeId', val === 'all' ? '' : val)}>
                      <SelectTrigger className="h-9">
                        <MapPin className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                        <SelectValue placeholder="Todas las sedes" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas las sedes</SelectItem>
                        {sedes.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* ── Características (campos dinámicos del tipo) ── */}
              {visibleTypeFields.length > 0 && (
                <div className="rounded-lg border border-border p-4 space-y-3 bg-card">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {PRODUCT_TYPES[productType]?.icon} Características · {PRODUCT_TYPES[productType]?.name}
                  </p>
                  {productType === 'ferreteria' && (
                    <div className="flex items-start gap-2 rounded-md bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 px-3 py-2">
                      <span className="text-orange-500 text-sm leading-none mt-0.5">🚛</span>
                      <p className="text-xs text-orange-700 dark:text-orange-300">
                        <strong>Peso</strong> y <strong>Unidad de Peso</strong> asignan el vehículo de despacho automáticamente.
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {visibleTypeFields.map(field => (
                      <DynamicField key={field.name} field={field} value={formData[field.name]} onChange={v => updateField(field.name, v)} />
                    ))}
                  </div>
                </div>
              )}

              {/* ── Galería de imágenes ── */}
              <div className="rounded-lg border border-border p-4 space-y-3 bg-card">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Imágenes del producto</p>
                <p className="text-xs text-muted-foreground -mt-1">La primera es la imagen principal en listas y tienda.</p>
                <div className="grid grid-cols-2 gap-2">
                  {[0, 1, 2, 3].map(renderImageSlot)}
                </div>
              </div>

            </div>{/* fin grid 2 cols */}

            {/* ══ Matrices de stock por horma — ancho completo ══ */}
            {productType === 'ropa' && selectedHormaIds.length > 0 && (
              <div className="space-y-4 mt-4">
                {selectedHormaIds.map(hid => {
                  const h = hormasList.find((x: any) => String(x.id) === hid)
                  if (!h) return null
                  const sizes: string[] = h.sizeChart ? Object.keys(h.sizeChart) : []
                  const colors: { color: string; hex?: string }[] = h.colors || []
                  if (!sizes.length || !colors.length) return (
                    <div key={hid} className="rounded-lg border border-border p-4 bg-card">
                      <p className="text-xs font-semibold text-muted-foreground">{h.name} — sin colores o tallas configurados</p>
                    </div>
                  )
                  return (
                    <HormaStockTable
                      key={hid}
                      hormaId={hid}
                      hormaName={h.name}
                      colors={colors}
                      sizes={sizes}
                      matrix={hormaMatrix[hid] || {}}
                      purchasePrice={hormaPrices[hid]?.purchasePrice ?? ''}
                      salePrice={hormaPrices[hid]?.salePrice ?? ''}
                      onCellChange={(color, size, val) => setMatrixCell(hid, color, size, val)}
                      onFillRow={(color, val) => fillRow(hid, color, sizes, val)}
                      onFillCol={(size, val) => fillCol(hid, colors.map(c => c.color), size, val)}
                      onFillAll={(val) => fillAll(hid, colors.map(c => c.color), sizes, val)}
                      onPurchasePriceChange={val => setHormaPrice(hid, 'purchasePrice', val)}
                      onSalePriceChange={val => setHormaPrice(hid, 'salePrice', val)}
                    />
                  )
                })}
              </div>
            )}

          </div>{/* fin scrollable */}

          {/* Footer fijo */}
          <div className="shrink-0 border-t border-border px-5 py-3 flex items-center justify-end gap-2 bg-background">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              {initialData ? 'Guardar Cambios' : 'Agregar Producto'}
            </Button>
          </div>
        </form>
      </DialogContent>

      {showScanner && (
        <BarcodeScanner
          onScan={(barcode) => setFormData(prev => ({ ...prev, barcode }))}
          onClose={() => setShowScanner(false)}
        />
      )}

      {showRemoteScanner && (
        <RemoteScanner
          onScan={(barcode) => {
            setFormData(prev => ({ ...prev, barcode }))
            setShowRemoteScanner(false)
          }}
          onClose={() => setShowRemoteScanner(false)}
        />
      )}
    </Dialog>
  )
}

function DynamicField({ field, value, onChange }: {
  field: { name: string; label: string; type: string; placeholder?: string; description?: string; min?: number; max?: number; step?: number; options?: Array<{ value: string; label: string }>; defaultValue?: any }
  value: any
  onChange: (value: any) => void
}) {
  const isFullWidth = field.type === 'textarea' || field.type === 'location'

  const wrapper = (children: React.ReactNode) => (
    <div className={`space-y-2 ${isFullWidth ? 'col-span-2' : ''}`}>
      <Label htmlFor={field.name}>{field.label}</Label>
      {children}
      {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
    </div>
  )

  // ── Tipo location: 3 selects encadenados País → Departamento → Municipio ──
  if (field.type === 'location') {
    const loc = typeof value === 'object' && value !== null ? value : {}
    return (
      <div className="col-span-2">
        <LocationPicker
          value={loc}
          onChange={onChange}
          showCity={true}
        />
      </div>
    )
  }

  if (field.type === 'select' && field.options) {
    return wrapper(
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Seleccionar" />
        </SelectTrigger>
        <SelectContent>
          {field.options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (field.type === 'boolean') {
    return wrapper(
      <div className="flex items-center gap-2 pt-1">
        <Checkbox
          id={field.name}
          checked={!!value}
          onCheckedChange={(checked) => onChange(!!checked)}
        />
        <Label htmlFor={field.name} className="text-sm font-normal cursor-pointer">
          {value ? 'Si' : 'No'}
        </Label>
      </div>
    )
  }

  if (field.type === 'textarea') {
    return wrapper(
      <Textarea
        id={field.name}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        rows={2}
      />
    )
  }

  if (field.type === 'number') {
    return wrapper(
      <Input
        id={field.name}
        type="number"
        min={field.min}
        max={field.max}
        step={field.step}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : '')}
        placeholder={field.placeholder}
      />
    )
  }

  if (field.type === 'date') {
    return wrapper(
      <Input
        id={field.name}
        type="date"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  }

  // Default: text
  return wrapper(
    <Input
      id={field.name}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
    />
  )
}

function generateNextSku(products: Product[]): string {
  if (!products.length) return '0001'
  const nums = products
    .map(p => p.sku.match(/(\d+)$/))
    .filter(Boolean)
    .map(m => parseInt(m![1], 10))
  if (!nums.length) return '0001'
  const next = Math.max(...nums) + 1
  const digits = Math.max(4, String(next).length)
  return String(next).padStart(digits, '0')
}

function getInitialFormData(initialData: Product | undefined, categories: Array<{ id: string }>, defaultSedeId?: string) {
  if (initialData) {
    // Return all non-undefined properties from initialData
    const data: Record<string, any> = {}
    for (const [key, value] of Object.entries(initialData)) {
      if (key === 'id' || key === 'createdAt' || key === 'updatedAt' || key === 'stockStatus') continue
      if (value !== undefined && value !== null) {
        data[key] = value
      }
    }
    // Fecha automática: al abrir el modal de edición, si el producto no tiene fecha de
    // ingreso (campo obligatorio), se rellena con la de hoy para que nunca quede vacío.
    if (!data.entryDate) {
      data.entryDate = new Date().toISOString().split('T')[0]
    }
    return data
  }

  return {
    name: '',
    category: categories[0]?.id || '',
    productType: 'general' as ProductType,
    purchasePrice: 0,
    salePrice: 0,
    sku: '',
    barcode: '',
    stock: 0,
    reorderPoint: 5,
    supplier: '',
    imageUrl: '',
    images: [] as string[],
    entryDate: new Date().toISOString().split('T')[0],
    sedeId: defaultSedeId || '',
  }
}
