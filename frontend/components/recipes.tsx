'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { api } from '@/lib/api'
import { formatCOP } from '@/lib/utils'
import type { Product } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Search,
  Plus,
  Edit,
  Trash2,
  FlaskConical,
  Package,
  X,
  DollarSign,
  ChevronDown,
  Check,
  Layers,
  Sparkles,
  AlertCircle,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RecipeIngredient {
  id: string
  ingredientId: string
  ingredientName: string
  ingredientSku: string
  quantity: number
  unitCost: number
  totalCost: number
  includeInCost: boolean
}

interface RecipeGroup {
  productId: string
  productName: string
  productSku: string
  totalCost: number
  ingredients: RecipeIngredient[]
}

interface IngredientFormItem {
  ingredientId: string
  quantity: string
  includeInCost: boolean
}

interface SizeFormula {
  productId: string
  ingredients: IngredientFormItem[]
}

const EMPTY_INGREDIENT = (): IngredientFormItem => ({
  ingredientId: '',
  quantity: '',
  includeInCost: true,
})

const EXTRACTO_SIZES = [
  { key: '30ml', label: '30 ML', defaultQty: '13' },
  { key: '50ml', label: '50 ML', defaultQty: '22' },
  { key: '100ml', label: '100 ML', defaultQty: '43' },
] as const

// ─── SearchableCombobox ────────────────────────────────────────────────────────

function SearchableCombobox({
  options,
  value,
  onChange,
  placeholder = 'Buscar...',
  disabled = false,
  showPrice = false,
}: {
  options: Product[]
  value: string
  onChange: (val: string) => void
  placeholder?: string
  disabled?: boolean
  showPrice?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = useMemo(() => options.find((o) => o.id === value), [options, value])

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = useMemo(() => {
    if (!query.trim()) return options.slice(0, 25)
    const q = query.toLowerCase()
    return options
      .filter(
        (o) =>
          (o.articulo || o.name).toLowerCase().includes(q) ||
          o.sku.toLowerCase().includes(q)
      )
      .slice(0, 25)
  }, [options, query])

  const handleOpen = () => {
    if (disabled) return
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 30)
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={handleOpen}
        className={[
          'flex h-9 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-sm',
          'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-accent/40',
        ].join(' ')}
      >
        {selected ? (
          <div className="flex flex-1 items-center gap-2 min-w-0">
            <span className="truncate font-medium">{selected.articulo || selected.name}</span>
            <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0 h-4">
              {selected.sku}
            </Badge>
          </div>
        ) : (
          <span className="flex-1 text-left text-muted-foreground">{placeholder}</span>
        )}
        {value && !disabled && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation()
              onChange('')
            }}
            onKeyDown={(e) => e.key === 'Enter' && onChange('')}
            className="shrink-0 rounded-sm p-0.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
          >
            <X className="h-3 w-3" />
          </span>
        )}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {open && !disabled && (
        <div className="absolute left-0 z-50 mt-1 rounded-md border bg-popover shadow-lg min-w-[260px] w-full max-w-[420px]">
          {/* Search input */}
          <div className="flex items-center border-b px-2 py-1.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0 mr-1.5" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrar por nombre o SKU..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          {/* Options list */}
          <div className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                Sin resultados para &quot;{query}&quot;
              </div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    onChange(o.id)
                    setOpen(false)
                  }}
                  className={[
                    'flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left',
                    value === o.id ? 'bg-accent/60' : '',
                  ].join(' ')}
                >
                  <Check
                    className={`h-3.5 w-3.5 shrink-0 text-primary ${value === o.id ? 'opacity-100' : 'opacity-0'}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium leading-tight">{o.articulo || o.name}</p>
                    <p className="text-xs text-muted-foreground flex gap-2 mt-0.5">
                      <span className="font-mono">{o.sku}</span>
                      {showPrice && o.purchasePrice > 0 && (
                        <span className="text-primary">{formatCOP(o.purchasePrice)}</span>
                      )}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
          {filtered.length === 25 && (
            <p className="border-t px-3 py-1.5 text-xs text-muted-foreground text-center">
              Escribe para filtrar más resultados
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── IngredientRow ─────────────────────────────────────────────────────────────

function IngredientRow({
  item,
  index,
  products,
  canRemove,
  onUpdate,
  onRemove,
}: {
  item: IngredientFormItem
  index: number
  products: Product[]
  canRemove: boolean
  onUpdate: (index: number, field: keyof IngredientFormItem, value: string | boolean) => void
  onRemove: (index: number) => void
}) {
  const prod = products.find((p) => p.id === item.ingredientId)
  const lineCost =
    prod && item.quantity && item.includeInCost
      ? prod.purchasePrice * parseFloat(item.quantity)
      : null

  return (
    <div className="rounded-lg border bg-card p-2 space-y-1.5">
      {/* Fila principal: número + combobox */}
      <div className="flex items-center gap-1.5">
        <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <SearchableCombobox
            options={products}
            value={item.ingredientId}
            onChange={(val) => onUpdate(index, 'ingredientId', val)}
            placeholder="Buscar insumo..."
            showPrice
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onRemove(index)}
          disabled={!canRemove}
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Fila secundaria: cantidad + toggle + costo */}
      <div className="flex items-center gap-1.5 pl-6">
        <Input
          type="number"
          step="0.001"
          min="0.001"
          placeholder="Cant."
          value={item.quantity}
          onChange={(e) => onUpdate(index, 'quantity', e.target.value)}
          className="h-7 w-20 shrink-0 text-xs text-center"
        />
        <button
          type="button"
          onClick={() => onUpdate(index, 'includeInCost', !item.includeInCost)}
          title={item.includeInCost ? 'Incluido en costo' : 'Solo inventario'}
          className={[
            'shrink-0 flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium border transition-colors',
            item.includeInCost
              ? 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/20'
              : 'border-border bg-muted text-muted-foreground hover:bg-muted/80',
          ].join(' ')}
        >
          <DollarSign className="h-3 w-3" />
          {item.includeInCost ? 'Costo' : 'Inv.'}
        </button>
        {lineCost !== null && (
          <span className="ml-auto text-[11px] font-semibold text-primary tabular-nums">
            {formatCOP(lineCost)}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── FormulaSection ────────────────────────────────────────────────────────────

function FormulaSection({
  productId,
  onProductChange,
  ingredients,
  onIngredientsChange,
  products,
  availableProducts,
  productDisabled = false,
}: {
  productId: string
  onProductChange: (id: string) => void
  ingredients: IngredientFormItem[]
  onIngredientsChange: (items: IngredientFormItem[]) => void
  products: Product[]
  availableProducts: Product[]
  productDisabled?: boolean
}) {
  const totalCost = useMemo(() => {
    let t = 0
    for (const item of ingredients) {
      if (!item.ingredientId || !item.quantity || !item.includeInCost) continue
      const p = products.find((p) => p.id === item.ingredientId)
      if (p) t += p.purchasePrice * parseFloat(item.quantity)
    }
    return t
  }, [ingredients, products])

  const addRow = () => onIngredientsChange([...ingredients, EMPTY_INGREDIENT()])
  const removeRow = (i: number) => {
    if (ingredients.length <= 1) return
    onIngredientsChange(ingredients.filter((_, idx) => idx !== i))
  }
  const updateRow = (i: number, field: keyof IngredientFormItem, val: string | boolean) => {
    const updated = [...ingredients]
    updated[i] = { ...updated[i], [field]: val }
    onIngredientsChange(updated)
  }

  const filledCount = ingredients.filter((i) => i.ingredientId && parseFloat(i.quantity) > 0).length

  return (
    <div className="space-y-3 min-w-0">
      {/* Producto terminado */}
      <div className="space-y-1">
        <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Producto terminado *
        </Label>
        <SearchableCombobox
          options={availableProducts}
          value={productId}
          onChange={onProductChange}
          placeholder="Buscar producto..."
          disabled={productDisabled}
        />
      </div>

      {/* Ingredientes */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Ingredientes
            </Label>
            {filledCount > 0 && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                {filledCount}
              </Badge>
            )}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addRow} className="h-6 gap-1 text-xs px-2">
            <Plus className="h-3 w-3" />
            Agregar
          </Button>
        </div>

        <div className="space-y-1.5">
          {ingredients.map((item, idx) => (
            <IngredientRow
              key={idx}
              item={item}
              index={idx}
              products={products}
              canRemove={ingredients.length > 1}
              onUpdate={updateRow}
              onRemove={removeRow}
            />
          ))}
        </div>
      </div>

      {/* Costo total */}
      <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Package className="h-3.5 w-3.5" />
          Costo estimado
        </div>
        <span className="text-base font-bold text-primary tabular-nums">{formatCOP(totalCost)}</span>
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function Recipes() {
  const [recipes, setRecipes] = useState<RecipeGroup[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Single recipe dialog
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingRecipe, setEditingRecipe] = useState<RecipeGroup | null>(null)
  const [selectedProductId, setSelectedProductId] = useState('')
  const [ingredientsList, setIngredientsList] = useState<IngredientFormItem[]>([EMPTY_INGREDIENT()])
  const [isSaving, setIsSaving] = useState(false)

  // Extracto wizard dialog
  const [isExtractoOpen, setIsExtractoOpen] = useState(false)
  const [extractoId, setExtractoId] = useState('')
  const [extractoFormulas, setExtractoFormulas] = useState<Record<string, SizeFormula>>(
    Object.fromEntries(
      EXTRACTO_SIZES.map((s) => [
        s.key,
        { productId: '', ingredients: [EMPTY_INGREDIENT()] },
      ])
    )
  )
  const [isSavingExtracto, setIsSavingExtracto] = useState(false)
  const [activeTab, setActiveTab] = useState('30ml')

  // Delete dialog
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deletingRecipe, setDeletingRecipe] = useState<RecipeGroup | null>(null)

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [recipesRes, productsRes] = await Promise.all([
        api.getRecipes(),
        api.getProducts({ limit: 5000 }),
      ])
      if (recipesRes.success && recipesRes.data) setRecipes(recipesRes.data as any)
      if (productsRes.success && productsRes.data) {
        const prods = (productsRes.data as any).products || productsRes.data
        setProducts(Array.isArray(prods) ? prods : [])
      }
    } catch (e) {
      console.error('Error loading recipes:', e)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const finishedProducts = useMemo(() => products.filter((p) => p.salePrice > 0), [products])
  const usedProductIds = useMemo(() => new Set(recipes.map((r) => r.productId)), [recipes])
  const availableFinishedProducts = useMemo(
    () => (editingRecipe ? finishedProducts : finishedProducts.filter((p) => !usedProductIds.has(p.id))),
    [finishedProducts, usedProductIds, editingRecipe]
  )

  const filteredRecipes = useMemo(() => {
    if (!search) return recipes
    const q = search.toLowerCase()
    return recipes.filter(
      (r) => r.productName.toLowerCase().includes(q) || r.productSku.toLowerCase().includes(q)
    )
  }, [recipes, search])

  // ── Single recipe handlers ──
  const openCreate = () => {
    setEditingRecipe(null)
    setSelectedProductId('')
    setIngredientsList([EMPTY_INGREDIENT()])
    setIsFormOpen(true)
  }

  const openEdit = (recipe: RecipeGroup) => {
    setEditingRecipe(recipe)
    setSelectedProductId(recipe.productId)
    setIngredientsList(
      recipe.ingredients.map((ing) => ({
        ingredientId: ing.ingredientId,
        quantity: String(ing.quantity),
        includeInCost: ing.includeInCost !== false,
      }))
    )
    setIsFormOpen(true)
  }

  const handleSave = async () => {
    if (!selectedProductId) return
    const valid = ingredientsList.filter((i) => i.ingredientId && parseFloat(i.quantity) > 0)
    if (!valid.length) return
    setIsSaving(true)
    try {
      const result = await api.saveRecipe(
        selectedProductId,
        valid.map((i) => ({
          ingredientId: i.ingredientId,
          quantity: parseFloat(i.quantity),
          includeInCost: i.includeInCost,
        }))
      )
      if (result.success) {
        setIsFormOpen(false)
        await loadData()
      } else {
        alert(result.error || 'Error al guardar la receta')
      }
    } catch {
      alert('Error al guardar la receta')
    }
    setIsSaving(false)
  }

  // ── Extracto wizard handlers ──
  const openExtractoWizard = () => {
    setExtractoId('')
    setExtractoFormulas(
      Object.fromEntries(
        EXTRACTO_SIZES.map((s) => [s.key, { productId: '', ingredients: [EMPTY_INGREDIENT()] }])
      )
    )
    setActiveTab('30ml')
    setIsExtractoOpen(true)
  }

  // When user picks an extracto, pre-fill the ingredient rows with it
  const handleExtractoSelect = (id: string) => {
    setExtractoId(id)
    setExtractoFormulas(
      Object.fromEntries(
        EXTRACTO_SIZES.map((s) => [
          s.key,
          {
            productId: extractoFormulas[s.key].productId,
            ingredients: [
              { ingredientId: id, quantity: s.defaultQty, includeInCost: true },
              EMPTY_INGREDIENT(),
              EMPTY_INGREDIENT(),
            ],
          },
        ])
      )
    )
  }

  const updateExtractoFormula = (sizeKey: string, formula: SizeFormula) => {
    setExtractoFormulas((prev) => ({ ...prev, [sizeKey]: formula }))
  }

  const extractoTabStatus = (sizeKey: string) => {
    const f = extractoFormulas[sizeKey]
    const hasProduct = !!f.productId
    const hasIngredients = f.ingredients.some((i) => i.ingredientId && parseFloat(i.quantity) > 0)
    if (hasProduct && hasIngredients) return 'complete'
    if (hasProduct || hasIngredients) return 'partial'
    return 'empty'
  }

  const handleSaveAllExtracto = async () => {
    const toSave = EXTRACTO_SIZES.map((s) => {
      const f = extractoFormulas[s.key]
      const valid = f.ingredients.filter((i) => i.ingredientId && parseFloat(i.quantity) > 0)
      return { productId: f.productId, valid }
    }).filter((s) => s.productId && s.valid.length > 0)

    if (!toSave.length) return
    setIsSavingExtracto(true)
    try {
      const results = await Promise.all(
        toSave.map((s) =>
          api.saveRecipe(
            s.productId,
            s.valid.map((i) => ({
              ingredientId: i.ingredientId,
              quantity: parseFloat(i.quantity),
              includeInCost: i.includeInCost,
            }))
          )
        )
      )
      const errors = results.filter((r) => !r.success)
      if (errors.length) {
        alert(`Se guardaron ${results.length - errors.length} de ${results.length} recetas. Algunos errores ocurrieron.`)
      }
      setIsExtractoOpen(false)
      await loadData()
    } catch {
      alert('Error al guardar las fórmulas')
    }
    setIsSavingExtracto(false)
  }

  const extractoReadyCount = EXTRACTO_SIZES.filter((s) => extractoTabStatus(s.key) === 'complete').length

  // ── Delete handlers ──
  const openDelete = (recipe: RecipeGroup) => {
    setDeletingRecipe(recipe)
    setIsDeleteOpen(true)
  }

  const handleDelete = async () => {
    if (!deletingRecipe) return
    try {
      const result = await api.deleteRecipe(deletingRecipe.productId)
      if (result.success) {
        setIsDeleteOpen(false)
        setDeletingRecipe(null)
        await loadData()
      } else {
        alert(result.error || 'Error al eliminar la receta')
      }
    } catch {
      alert('Error al eliminar')
    }
  }

  // ── Render ──
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-6 w-6 text-primary" />
              <CardTitle className="text-2xl">Recetas BOM</CardTitle>
              <Badge variant="secondary" className="ml-1">
                {recipes.length}
              </Badge>
            </div>
            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={openExtractoWizard}
                className="gap-2 border-primary/40 text-primary hover:bg-primary/10"
              >
                <Layers className="h-4 w-4" />
                Fórmulas por Extracto
              </Button>
              <Button onClick={openCreate} className="gap-2">
                <Plus className="h-4 w-4" />
                Nueva Receta
              </Button>
            </div>
          </div>
          <div className="relative mt-2 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filteredRecipes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <FlaskConical className="h-12 w-12 opacity-20" />
              <p className="text-lg font-medium">No hay recetas</p>
              <p className="text-sm text-center max-w-xs">
                Crea una receta para definir los ingredientes de un producto compuesto
              </p>
              <div className="flex gap-2 mt-2">
                <Button variant="outline" size="sm" onClick={openExtractoWizard} className="gap-1.5">
                  <Layers className="h-3.5 w-3.5" />
                  Por extracto
                </Button>
                <Button size="sm" onClick={openCreate} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  Individual
                </Button>
              </div>
            </div>
          ) : (
            <>
            {/* ── Tarjetas (móvil) ── */}
            <div className="md:hidden space-y-2.5">
              {filteredRecipes.map((recipe) => (
                <div key={recipe.productId} className="rounded-lg border border-border bg-background p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm leading-snug">{recipe.productName}</p>
                      <Badge variant="outline" className="font-mono text-[10px] mt-0.5">{recipe.productSku}</Badge>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-primary text-sm tabular-nums">{formatCOP(recipe.totalCost)}</p>
                      <div className="flex justify-end gap-1 mt-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(recipe)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/70 hover:text-destructive" onClick={() => openDelete(recipe)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {recipe.ingredients.map((ing) => (
                      <Badge key={ing.id} variant={ing.includeInCost ? 'secondary' : 'outline'} className="text-[10px] gap-1">
                        <span className="max-w-[120px] truncate">{ing.ingredientName}</span>
                        <span className="opacity-70">×{ing.quantity}</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Tabla (escritorio) ── */}
            <div className="hidden md:block rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-[35%]">Producto</TableHead>
                    <TableHead className="w-[12%]">SKU</TableHead>
                    <TableHead>Ingredientes</TableHead>
                    <TableHead className="text-right w-[14%]">Costo</TableHead>
                    <TableHead className="text-right w-[10%]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecipes.map((recipe) => (
                    <TableRow key={recipe.productId} className="hover:bg-muted/30">
                      <TableCell>
                        <span className="font-medium line-clamp-2 leading-snug">
                          {recipe.productName}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {recipe.productSku}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {recipe.ingredients.map((ing) => (
                            <Badge
                              key={ing.id}
                              variant={ing.includeInCost ? 'secondary' : 'outline'}
                              className="text-xs gap-1"
                            >
                              <span className="max-w-[120px] truncate">{ing.ingredientName}</span>
                              <span className="opacity-70">×{ing.quantity}</span>
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-primary tabular-nums">
                        {formatCOP(recipe.totalCost)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(recipe)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDelete(recipe)}
                            className="text-destructive/70 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Single Recipe Dialog ── */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="w-[96vw] max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-primary" />
              {editingRecipe ? 'Editar Receta' : 'Nueva Receta'}
            </DialogTitle>
            <DialogDescription>
              Define los ingredientes y cantidades para producir una unidad del producto terminado.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <FormulaSection
              productId={selectedProductId}
              onProductChange={setSelectedProductId}
              ingredients={ingredientsList}
              onIngredientsChange={setIngredientsList}
              products={products}
              availableProducts={availableFinishedProducts}
              productDisabled={!!editingRecipe}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                isSaving ||
                !selectedProductId ||
                !ingredientsList.some((i) => i.ingredientId && parseFloat(i.quantity) > 0)
              }
            >
              {isSaving ? 'Guardando...' : 'Guardar Receta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Extracto Wizard Dialog ── */}
      <Dialog open={isExtractoOpen} onOpenChange={setIsExtractoOpen}>
        <DialogContent className="w-[98vw] max-w-[98vw] xl:max-w-7xl max-h-[95vh] overflow-y-auto p-0">
          {/* Header fijo */}
          <div className="sticky top-0 z-10 bg-background border-b px-6 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <Layers className="h-5 w-5 text-primary" />
                  Crear Fórmulas por Extracto
                </DialogTitle>
                <DialogDescription className="mt-1">
                  Selecciona el extracto base y define las 3 presentaciones. En PC se ven las 3 columnas a la vez.
                </DialogDescription>
              </div>
              {/* Status + Save en el header para PC */}
              <div className="hidden sm:flex items-center gap-3 shrink-0">
                {extractoReadyCount > 0 && (
                  <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400 font-medium">
                    <Check className="h-4 w-4" />
                    {extractoReadyCount}/3 listas
                  </span>
                )}
                <Button variant="outline" size="sm" onClick={() => setIsExtractoOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveAllExtracto}
                  disabled={isSavingExtracto || extractoReadyCount === 0}
                  className="gap-2"
                >
                  <Layers className="h-4 w-4" />
                  {isSavingExtracto ? 'Guardando...' : `Guardar ${extractoReadyCount || ''} fórmula${extractoReadyCount !== 1 ? 's' : ''}`}
                </Button>
              </div>
            </div>

            {/* Extracto selector — siempre visible en header */}
            <div className="mt-3 flex items-center gap-3">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <div className="flex-1 max-w-md">
                <SearchableCombobox
                  options={products}
                  value={extractoId}
                  onChange={handleExtractoSelect}
                  placeholder="Selecciona el extracto base..."
                  showPrice
                />
              </div>
              {extractoId && (
                <span className="text-xs text-muted-foreground hidden sm:block">
                  Pre-llena: 13 / 22 / 43 und. por tamaño
                </span>
              )}
            </div>
          </div>

          {/* Cuerpo: 3 columnas en desktop, tabs en mobile */}
          <div className="px-3 py-3 sm:px-4">

            {/* ── DESKTOP: 3 columnas ── */}
            <div className="hidden sm:grid sm:grid-cols-3 gap-3">
              {EXTRACTO_SIZES.map((s) => {
                const formula = extractoFormulas[s.key]
                const status = extractoTabStatus(s.key)
                const availableForCol = finishedProducts.filter(
                  (p) => !usedProductIds.has(p.id) || p.id === formula.productId
                )
                return (
                  <div
                    key={s.key}
                    className={[
                      'rounded-xl border-2 p-3 flex flex-col gap-3 transition-colors min-w-0',
                      status === 'complete' ? 'border-green-500/40 bg-green-500/5' :
                      status === 'partial'  ? 'border-amber-400/40 bg-amber-400/5' :
                                             'border-border bg-card',
                    ].join(' ')}
                  >
                    {/* Cabecera columna */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          className={[
                            'text-sm font-bold px-2.5 py-0.5',
                            status === 'complete' ? 'bg-green-500 text-white hover:bg-green-500' :
                            status === 'partial'  ? 'bg-amber-400 text-white hover:bg-amber-400' :
                                                   '',
                          ].join(' ')}
                          variant={status === 'empty' ? 'secondary' : 'default'}
                        >
                          {s.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{s.defaultQty} und.</span>
                      </div>
                      {status === 'complete' && <Check className="h-4 w-4 text-green-500" />}
                    </div>

                    <FormulaSection
                      productId={formula.productId}
                      onProductChange={(id) =>
                        updateExtractoFormula(s.key, { ...formula, productId: id })
                      }
                      ingredients={formula.ingredients}
                      onIngredientsChange={(items) =>
                        updateExtractoFormula(s.key, { ...formula, ingredients: items })
                      }
                      products={products}
                      availableProducts={availableForCol}
                    />
                  </div>
                )
              })}
            </div>

            {/* ── MOBILE: tabs ── */}
            <div className="sm:hidden">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="w-full grid grid-cols-3">
                  {EXTRACTO_SIZES.map((s) => {
                    const status = extractoTabStatus(s.key)
                    return (
                      <TabsTrigger key={s.key} value={s.key} className="gap-1.5">
                        {s.label}
                        {status === 'complete' && <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />}
                        {status === 'partial'  && <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />}
                      </TabsTrigger>
                    )
                  })}
                </TabsList>
                {EXTRACTO_SIZES.map((s) => {
                  const formula = extractoFormulas[s.key]
                  const availableForTab = finishedProducts.filter(
                    (p) => !usedProductIds.has(p.id) || p.id === formula.productId
                  )
                  return (
                    <TabsContent key={s.key} value={s.key} className="mt-4">
                      <div className="rounded-lg border p-4">
                        <FormulaSection
                          productId={formula.productId}
                          onProductChange={(id) =>
                            updateExtractoFormula(s.key, { ...formula, productId: id })
                          }
                          ingredients={formula.ingredients}
                          onIngredientsChange={(items) =>
                            updateExtractoFormula(s.key, { ...formula, ingredients: items })
                          }
                          products={products}
                          availableProducts={availableForTab}
                        />
                      </div>
                    </TabsContent>
                  )
                })}
              </Tabs>

              {/* Footer mobile */}
              <div className="mt-4 flex flex-col gap-2">
                {extractoReadyCount > 0 && (
                  <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2.5 text-sm text-green-700 dark:text-green-400">
                    <Check className="h-4 w-4 shrink-0" />
                    <strong>{extractoReadyCount}</strong>&nbsp;de 3 fórmulas listas
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setIsExtractoOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1 gap-2"
                    onClick={handleSaveAllExtracto}
                    disabled={isSavingExtracto || extractoReadyCount === 0}
                  >
                    <Layers className="h-4 w-4" />
                    {isSavingExtracto ? 'Guardando...' : `Guardar ${extractoReadyCount || ''} fórmula${extractoReadyCount !== 1 ? 's' : ''}`}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Footer PC vacío — los botones están en el header */}
          <div className="hidden sm:block" />
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Receta</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de eliminar la receta de{' '}
              <strong>{deletingRecipe?.productName}</strong>? El producto dejará de ser compuesto y
              esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
