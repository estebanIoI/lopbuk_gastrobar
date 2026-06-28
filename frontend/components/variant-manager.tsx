'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '@/lib/api'
import type { ProductVariant } from '@/lib/types'
import { formatCOP } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { CloudinaryUpload } from '@/components/ui/cloudinary-upload'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Plus, Trash2, Edit2, Package, Tag, TrendingUp, Upload, ChevronDown, ChevronUp,
  Wand2, Sparkles, Layers, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { resolveColorHex } from '@/lib/colors'

interface Props {
  productId: string
  productName: string
  hormaId?: string
  open: boolean
  onClose: () => void
}

const MAX_VARIANT_IMAGES = 4
const EMPTY_VARIANT = {
  sku: '', color: '', colorHex: '', size: '', material: '', stock: 0, minStock: 0, costPrice: '', priceOverride: '',
  images: ['', '', '', ''] as string[], hormaId: '',
  presale: false, presaleDate: '', presaleLimit: '', presaleDepositPct: '50',
}
const EMPTY_TIER    = { minQty: 1, price: '', tenantMarginPct: 0 }

// ── Ejes del modo guiado (mapeados a las columnas reales del backend) ──
// El backend solo tiene 3 columnas de variante: color, size, material.
const GUIDED_AXES = [
  { key: 'color' as const,    label: 'Color',                  placeholder: 'Negro, Blanco, Rojo, Azul' },
  { key: 'size' as const,     label: 'Talla / Tamaño / Peso',  placeholder: 'S, M, L, XL  ·  250g, 500g, 1kg' },
  { key: 'material' as const, label: 'Material / Sabor / Tipo', placeholder: 'Algodón, Cuero  ·  Vainilla, Chocolate' },
]

const stripDiacritics = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
const slug = (s: string) => stripDiacritics(s.toUpperCase()).replace(/[^A-Z0-9]/g, '').slice(0, 6)
// Para el tag de HORMA en el SKU no se puede truncar a 6: "Oversize Fit" y
// "Oversize Americana" comparten el prefijo "OVERSI" y quedaban indistinguibles
// ("0009-OVERSI-BLANCO-S" para las dos). El slug completo SÍ es único por definición
// (UNIQUE KEY uk_horma_slug_tenant), así que no hace falta truncarlo.
const hormaTagFull = (s: string) => stripDiacritics(s.toUpperCase()).replace(/[^A-Z0-9]/g, '')
const parseVals = (s: string) => Array.from(new Set(s.split(/[,\n]/).map(t => t.trim()).filter(Boolean)))

export function VariantManager({ productId, productName, hormaId, open, onClose }: Props) {
  const [variants, setVariants]           = useState<ProductVariant[]>([])
  const [loading, setLoading]             = useState(false)
  const [expandedId, setExpandedId]       = useState<string | null>(null)

  // Hormas: única forma de generar variantes "por plantilla" — unificado con lo que
  // antes vivía aparte en el formulario de "Agregar Producto". La horma solo sugiere
  // (color×talla×hex) al generar; la variante ya creada es dueña de su propia data.
  const [hormasList, setHormasList] = useState<any[]>([])
  const [useHorma, setUseHorma] = useState(false)
  const [selectedHormaIds, setSelectedHormaIds] = useState<string[]>([])
  const [hormaMatrix, setHormaMatrix] = useState<Record<string, Record<string, Record<string, string>>>>({})

  // Modo guiado (libre, sin horma)
  const [guided, setGuided]               = useState(true)
  const [axisColor, setAxisColor]         = useState('')
  const [axisSize, setAxisSize]           = useState('')
  const [axisMaterial, setAxisMaterial]   = useState('')
  const [gStock, setGStock]               = useState(10)
  const [gPrice, setGPrice]               = useState('')
  const [skuPrefix, setSkuPrefix]         = useState('')
  const [generating, setGenerating]       = useState(false)
  const [genProgress, setGenProgress]     = useState<{ done: number; total: number } | null>(null)

  // Forms (modo avanzado)
  const [showAddVariant, setShowAddVariant]   = useState(false)
  const [editingVariant, setEditingVariant]   = useState<ProductVariant | null>(null)
  const [variantForm, setVariantForm]         = useState(EMPTY_VARIANT)
  const [savingVariant, setSavingVariant]     = useState(false)

  const [showAddTier, setShowAddTier]         = useState<string | null>(null)
  const [tierForm, setTierForm]               = useState(EMPTY_TIER)
  const [savingTier, setSavingTier]           = useState(false)

  const [stockVariant, setStockVariant]       = useState<ProductVariant | null>(null)
  const [stockForm, setStockForm]             = useState({ quantity: 0, type: 'entrada', reason: '' })
  const [savingStock, setSavingStock]         = useState(false)

  const [showImport, setShowImport]           = useState(false)
  const [csvText, setCsvText]                 = useState('')
  const [importing, setImporting]             = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getVariantsByProduct(productId)
      const list = Array.isArray(data) ? data : (data as any)?.data ?? []
      setVariants(list)
      // Si ya hay variantes, abre directo en modo lista; si no, en modo guiado
      setGuided(list.length === 0)
    } catch { toast.error('Error cargando variantes') }
    finally { setLoading(false) }
  }, [productId])

  useEffect(() => { if (open) { load(); setSkuPrefix(slug(productName)) } }, [open, load, productName])
  useEffect(() => {
    if (!open) return
    api.getHormas().then(r => { if (r.success && r.data) setHormasList(r.data as any[]) })
    // hormaId (prop legacy) = horma "principal" del producto → preselecciona el modo horma.
    if (hormaId) { setUseHorma(true); setSelectedHormaIds([hormaId]) }
  }, [open, hormaId])

  const hormaById = useMemo(() => {
    const map: Record<string, any> = {}
    for (const h of hormasList) map[h.id] = h
    return map
  }, [hormasList])

  // Hormas en juego entre las variantes YA creadas (para el encabezado del diálogo).
  const existingHormaNames = useMemo(() => {
    const seen = new Map<string, string>()
    for (const v of variants) {
      if (v.hormaId && !seen.has(v.hormaId)) seen.set(v.hormaId, v.hormaName || hormaById[v.hormaId]?.name || 'Horma')
    }
    return Array.from(seen.values())
  }, [variants, hormaById])

  // Inicializa/actualiza la matriz color×talla de una horma recién seleccionada.
  const toggleHorma = (hid: string) => {
    if (selectedHormaIds.includes(hid)) {
      setSelectedHormaIds(prev => prev.filter(id => id !== hid))
      setHormaMatrix(prev => { const next = { ...prev }; delete next[hid]; return next })
      return
    }
    const h = hormasList.find(x => x.id === hid)
    const sizes: string[] = h?.sizeChart ? Object.keys(h.sizeChart) : []
    const cols: string[] = (h?.colors || []).map((c: any) => c.color)
    const matrix: Record<string, Record<string, string>> = {}
    for (const c of cols) { matrix[c] = {}; for (const sz of sizes) matrix[c][sz] = '' }
    setHormaMatrix(prev => ({ ...prev, [hid]: matrix }))
    setSelectedHormaIds(prev => [...prev, hid])
  }

  const setHormaMatrixCell = (hid: string, color: string, size: string, val: string) => {
    setHormaMatrix(prev => ({
      ...prev,
      [hid]: { ...(prev[hid] || {}), [color]: { ...(prev[hid]?.[color] || {}), [size]: val } },
    }))
  }

  // ── Modo guiado: matriz de combinaciones ────────────────────────────────────
  const combos = useMemo(() => {
    const colors = parseVals(axisColor)
    const sizes  = parseVals(axisSize)
    const mats   = parseVals(axisMaterial)
    const cAxis = colors.length ? colors : [undefined]
    const sAxis = sizes.length ? sizes : [undefined]
    const mAxis = mats.length ? mats : [undefined]
    const out: { color?: string; size?: string; material?: string }[] = []
    for (const c of cAxis) for (const s of sAxis) for (const m of mAxis) {
      if (!c && !s && !m) continue
      out.push({ color: c, size: s, material: m })
    }
    return out
  }, [axisColor, axisSize, axisMaterial])

  const existingSkus = useMemo(() => new Set(variants.map(v => v.sku)), [variants])

  // Aviso proactivo: SKU duplicado contra variantes ya cargadas (excluye la que se edita).
  const skuTrimmed = variantForm.sku.trim()
  const skuDuplicate = !!skuTrimmed && variants.some(v => v.sku === skuTrimmed && v.id !== editingVariant?.id)

  const buildSku = (combo: { color?: string; size?: string; material?: string }) => {
    const parts = [combo.color, combo.size, combo.material].filter(Boolean).map(v => slug(v as string))
    return [skuPrefix || 'VAR', ...parts].filter(Boolean).join('-')
  }

  // ── Modo guiado: matriz por horma (color×talla, con hex heredado) ───────────
  const hormaCombos = useMemo(() => {
    if (!useHorma) return []
    const multiHorma = selectedHormaIds.length > 1
    const used = new Set<string>()
    const out: { color: string; size: string; hormaId: string; colorHex?: string; sku: string }[] = []
    for (const hid of selectedHormaIds) {
      const h = hormasList.find(x => x.id === hid)
      if (!h) continue
      const sizes: string[] = h.sizeChart ? Object.keys(h.sizeChart) : []
      const colorsList: { color: string; hex?: string }[] = h.colors || []
      const hormaTag = hormaTagFull(h.slug || h.name || 'H')
      for (const c of colorsList) {
        for (const size of sizes) {
          let sku = multiHorma
            ? `${skuPrefix || 'VAR'}-${hormaTag}-${slug(c.color)}-${size}`
            : `${skuPrefix || 'VAR'}-${slug(c.color)}-${size}`
          let n = 2
          while (used.has(sku)) { sku = `${sku}-${n}`; n++ }
          used.add(sku)
          out.push({ color: c.color, size, hormaId: hid, colorHex: c.hex, sku })
        }
      }
    }
    return out
  }, [useHorma, selectedHormaIds, hormasList, skuPrefix])

  const generate = async () => {
    const total = useHorma ? hormaCombos.length : combos.length
    if (total === 0) {
      toast.error(useHorma ? 'Selecciona al menos una horma con colores y tallas' : 'Agrega al menos un valor en algún eje')
      return
    }
    setGenerating(true)
    setGenProgress({ done: 0, total })
    let created = 0, skipped = 0, failed = 0
    for (let i = 0; i < total; i++) {
      const sku = useHorma ? hormaCombos[i].sku : buildSku(combos[i])
      if (existingSkus.has(sku)) { skipped++; setGenProgress({ done: i + 1, total }); continue }
      try {
        if (useHorma) {
          const hc = hormaCombos[i]
          const raw = hormaMatrix[hc.hormaId]?.[hc.color]?.[hc.size]
          await api.createVariant(productId, {
            sku, color: hc.color, size: hc.size, hormaId: hc.hormaId,
            colorHex: hc.colorHex || undefined,
            stock: Number(raw) || 0,
            minStock: 0,
            priceOverride: gPrice ? Number(gPrice) : undefined,
          })
        } else {
          const combo = combos[i]
          await api.createVariant(productId, {
            sku,
            color: combo.color || undefined,
            size: combo.size || undefined,
            material: combo.material || undefined,
            stock: Number(gStock) || 0,
            minStock: 0,
            priceOverride: gPrice ? Number(gPrice) : undefined,
          })
        }
        created++
      } catch { failed++ }
      setGenProgress({ done: i + 1, total })
    }
    setGenerating(false)
    setGenProgress(null)
    if (created) toast.success(`${created} variante(s) creada(s)${skipped ? ` · ${skipped} ya existían` : ''}`)
    else if (skipped) toast.info('Todas esas combinaciones ya existían')
    if (failed) toast.warning(`${failed} no se pudieron crear`)
    setAxisColor(''); setAxisSize(''); setAxisMaterial('')
    setSelectedHormaIds([]); setHormaMatrix({})
    await load()
    setGuided(false)
  }

  // ── Variant CRUD (avanzado) ─────────────────────────────────────────────────
  const openAdd = () => {
    setVariantForm({ ...EMPTY_VARIANT, hormaId: selectedHormaIds[0] || hormaId || '' })
    setEditingVariant(null)
    setShowAddVariant(true)
  }
  const openEdit = (v: ProductVariant) => {
    const imgs = v.images || []
    setVariantForm({
      sku: v.sku, color: v.color || '', colorHex: v.colorHex || '', size: v.size || '',
      material: v.material || '', stock: v.stock,
      minStock: v.minStock, costPrice: v.costPrice?.toString() || '',
      priceOverride: v.priceOverride?.toString() || '',
      images: [imgs[0] || '', imgs[1] || '', imgs[2] || '', imgs[3] || ''],
      hormaId: v.hormaId || '',
      presale: !!(v.presale),
      presaleDate: v.presaleDate ?? '',
      presaleLimit: v.presaleLimit != null ? String(v.presaleLimit) : '',
      presaleDepositPct: v.presaleDepositPct != null ? String(v.presaleDepositPct) : '50',
    })
    setEditingVariant(v)
    setShowAddVariant(true)
  }

  const saveVariant = async () => {
    if (!variantForm.sku.trim()) return toast.error('SKU requerido')
    setSavingVariant(true)
    try {
      const payload = {
        sku: variantForm.sku.trim(),
        color: variantForm.color || undefined,
        colorHex: variantForm.colorHex.trim(),
        size: variantForm.size || undefined,
        material: variantForm.material || undefined,
        hormaId: variantForm.hormaId || null,
        stock: Number(variantForm.stock),
        minStock: Number(variantForm.minStock),
        costPrice: variantForm.costPrice ? Number(variantForm.costPrice) : undefined,
        priceOverride: variantForm.priceOverride ? Number(variantForm.priceOverride) : undefined,
        images: variantForm.images.map(u => u.trim()).filter(Boolean).slice(0, MAX_VARIANT_IMAGES),
        presale: variantForm.presale,
        presaleDate: variantForm.presaleDate || null,
        presaleLimit: variantForm.presaleLimit !== '' ? Number(variantForm.presaleLimit) : null,
        presaleDepositPct: variantForm.presaleDepositPct !== '' ? Number(variantForm.presaleDepositPct) : 50,
      }
      const result = editingVariant
        ? await api.updateVariant(editingVariant.id, payload)
        : await api.createVariant(productId, payload)
      if (!result.success) {
        toast.error(result.error || 'No se pudo guardar la variante')
        return
      }
      toast.success(editingVariant ? 'Variante actualizada' : 'Variante creada')
      setShowAddVariant(false)
      load()
    } catch (e: any) { toast.error(e?.message || 'Error guardando variante') }
    finally { setSavingVariant(false) }
  }

  const deleteVariant = async (id: string) => {
    if (!confirm('¿Eliminar variante?')) return
    try {
      await api.deleteVariant(id)
      toast.success('Variante eliminada')
      load()
    } catch { toast.error('Error eliminando variante') }
  }

  // ── Price Tiers ─────────────────────────────────────────────────────────────
  const saveTier = async () => {
    if (!showAddTier) return
    if (!tierForm.price) return toast.error('Precio requerido')
    setSavingTier(true)
    try {
      await api.createVariantTier(showAddTier, {
        minQty: Number(tierForm.minQty),
        price: Number(tierForm.price),
        tenantMarginPct: Number(tierForm.tenantMarginPct),
      })
      toast.success('Tier creado')
      setShowAddTier(null)
      setTierForm(EMPTY_TIER)
      load()
    } catch (e: any) { toast.error(e?.message || 'Error creando tier') }
    finally { setSavingTier(false) }
  }

  const deleteTier = async (tierId: string) => {
    if (!confirm('¿Eliminar tier?')) return
    try {
      await api.deleteVariantTier(tierId)
      toast.success('Tier eliminado')
      load()
    } catch { toast.error('Error eliminando tier') }
  }

  // ── Stock Adjustment ────────────────────────────────────────────────────────
  const saveStock = async () => {
    if (!stockVariant) return
    if (!stockForm.reason.trim()) return toast.error('Motivo requerido')
    setSavingStock(true)
    try {
      await api.adjustVariantStock(stockVariant.id, {
        quantity: Number(stockForm.quantity),
        type: stockForm.type,
        reason: stockForm.reason,
      })
      toast.success('Stock ajustado')
      setStockVariant(null)
      setStockForm({ quantity: 0, type: 'entrada', reason: '' })
      load()
    } catch (e: any) { toast.error(e?.message || 'Error ajustando stock') }
    finally { setSavingStock(false) }
  }

  // ── CSV Import ──────────────────────────────────────────────────────────────
  const importCsv = async () => {
    if (!csvText.trim()) return toast.error('CSV vacío')
    setImporting(true)
    try {
      const result = await api.importVariantsCsv(csvText)
      const r = result?.data ?? result
      toast.success(`Importado: ${r.variantsCreated} variantes, ${r.productsCreated} productos nuevos`)
      if (r.errors?.length) toast.warning(`${r.variantsFailed} errores`)
      setShowImport(false)
      setCsvText('')
      load()
    } catch (e: any) { toast.error(e?.message || 'Error importando CSV') }
    finally { setImporting(false) }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <Dialog open={open} onOpenChange={v => !v && onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Variantes — {productName}{existingHormaNames.length > 0 ? ` · Horma${existingHormaNames.length > 1 ? 's' : ''}: ${existingHormaNames.join(', ')}` : ''}
            </DialogTitle>
          </DialogHeader>

          {/* Conmutador Guiado / Lista */}
          <div className="flex items-center gap-2 mb-1">
            <Button size="sm" variant={guided ? 'default' : 'outline'} onClick={() => setGuided(true)} className="gap-1.5">
              <Wand2 className="w-4 h-4" /> Crear rápido
            </Button>
            <Button size="sm" variant={!guided ? 'default' : 'outline'} onClick={() => setGuided(false)} className="gap-1.5">
              <Layers className="w-4 h-4" /> Lista {variants.length > 0 && <Badge variant="secondary" className="ml-1">{variants.length}</Badge>}
            </Button>
          </div>

          {/* ─────────── MODO GUIADO ─────────── */}
          {guided ? (
            <div className="space-y-4">
              {/* Conmutador Horma / Libre */}
              <div className="flex items-center gap-2">
                <Button size="sm" variant={useHorma ? 'default' : 'outline'} onClick={() => setUseHorma(true)} className="gap-1.5">
                  <Layers className="w-4 h-4" /> Usar horma
                </Button>
                <Button size="sm" variant={!useHorma ? 'default' : 'outline'} onClick={() => setUseHorma(false)} className="gap-1.5">
                  <Sparkles className="w-4 h-4" /> Libre (color/talla/material)
                </Button>
              </div>

              {useHorma ? (
                <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                  <div className="flex items-start gap-2">
                    <Layers className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      Elige una o varias hormas. Por cada una se arma su tabla de stock por color×talla — el color hereda el hex de la paleta de la horma si lo tiene.
                    </p>
                  </div>

                  {hormasList.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No hay hormas creadas todavía (Inventario → Hormas).</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {hormasList.map(h => {
                        const active = selectedHormaIds.includes(h.id)
                        return (
                          <button
                            key={h.id}
                            type="button"
                            onClick={() => toggleHorma(h.id)}
                            className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                              active ? 'border-primary bg-primary/10 text-foreground' : 'border-input text-muted-foreground hover:bg-muted'
                            }`}
                          >
                            {h.name}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {selectedHormaIds.map(hid => {
                    const h = hormasList.find(x => x.id === hid)
                    if (!h) return null
                    const sizes: string[] = h.sizeChart ? Object.keys(h.sizeChart) : []
                    const colorsList: { color: string; hex?: string }[] = h.colors || []
                    if (sizes.length === 0 || colorsList.length === 0) return null
                    return (
                      <div key={hid} className="space-y-2 rounded-lg border border-border p-3 bg-background">
                        <Label className="text-xs font-medium">{h.name}</Label>
                        <div className="overflow-x-auto border rounded-md">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-muted/40">
                                <th className="text-left p-2 font-medium">Color</th>
                                {sizes.map(s => <th key={s} className="p-2 font-medium text-center">{s}</th>)}
                              </tr>
                            </thead>
                            <tbody>
                              {colorsList.map(c => (
                                <tr key={c.color} className="border-b last:border-0">
                                  <td className="p-2 whitespace-nowrap">
                                    <span className="inline-flex items-center gap-1.5">
                                      <span className="h-3 w-3 rounded-full border shrink-0" style={{ backgroundColor: resolveColorHex(c.color, c.hex) }} />
                                      {c.color}
                                    </span>
                                  </td>
                                  {sizes.map(size => (
                                    <td key={size} className="p-1 text-center">
                                      <Input type="number" min={0} className="h-8 w-16 text-center mx-auto"
                                        value={hormaMatrix[hid]?.[c.color]?.[size] ?? ''}
                                        onChange={e => setHormaMatrixCell(hid, c.color, size, e.target.value)} />
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                  })}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Precio (opcional)</Label>
                      <Input type="number" min={0} placeholder="Usa precio base" value={gPrice} onChange={e => setGPrice(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Prefijo SKU</Label>
                      <Input value={skuPrefix} onChange={e => setSkuPrefix(e.target.value.toUpperCase())} className="mt-1" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      Escribe los valores de cada eje separados por comas. El sistema arma <strong>todas las combinaciones</strong> con su SKU, stock y precio. Deja un eje vacío si no aplica.
                    </p>
                  </div>

                  {GUIDED_AXES.map(axis => {
                    const val = axis.key === 'color' ? axisColor : axis.key === 'size' ? axisSize : axisMaterial
                    const setVal = axis.key === 'color' ? setAxisColor : axis.key === 'size' ? setAxisSize : setAxisMaterial
                    const chips = parseVals(val)
                    return (
                      <div key={axis.key}>
                        <Label className="text-xs font-medium">{axis.label}</Label>
                        <Input
                          placeholder={axis.placeholder}
                          value={val}
                          onChange={e => setVal(e.target.value)}
                          className="mt-1"
                        />
                        {chips.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {chips.map(c => (
                              <Badge key={c} variant="secondary" className="gap-1">
                                {c}
                                <button onClick={() => setVal(chips.filter(x => x !== c).join(', '))} className="hover:text-destructive">
                                  <X className="w-3 h-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Stock por variante</Label>
                      <Input type="number" min={0} value={gStock} onChange={e => setGStock(Number(e.target.value))} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Precio (opcional)</Label>
                      <Input type="number" min={0} placeholder="Usa precio base" value={gPrice} onChange={e => setGPrice(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Prefijo SKU</Label>
                      <Input value={skuPrefix} onChange={e => setSkuPrefix(e.target.value.toUpperCase())} className="mt-1" />
                    </div>
                  </div>
                </div>
              )}

              {/* Vista previa */}
              {useHorma ? (
                hormaCombos.length > 0 && (
                  <div className="rounded-lg border overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2 bg-muted/40">
                      <p className="text-sm font-medium">Se crearán {hormaCombos.filter(c => !existingSkus.has(c.sku)).length} variante(s)</p>
                      <span className="text-xs text-muted-foreground">{hormaCombos.length} combinaciones</span>
                    </div>
                    <div className="max-h-56 overflow-y-auto divide-y">
                      {hormaCombos.map((c, i) => {
                        const dup = existingSkus.has(c.sku)
                        const stock = Number(hormaMatrix[c.hormaId]?.[c.color]?.[c.size]) || 0
                        return (
                          <div key={i} className="flex items-center gap-3 px-4 py-2 text-sm">
                            <span className="flex-1">{c.color} / {c.size}</span>
                            <Badge variant="outline" className="font-mono text-[10px]">{c.sku}</Badge>
                            {dup
                              ? <span className="text-[10px] text-amber-600 w-16 text-right">Ya existe</span>
                              : <span className="text-[10px] text-muted-foreground w-16 text-right">Stock {stock}</span>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              ) : (
                combos.length > 0 && (
                  <div className="rounded-lg border overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2 bg-muted/40">
                      <p className="text-sm font-medium">Se crearán {combos.filter(c => !existingSkus.has(buildSku(c))).length} variante(s)</p>
                      <span className="text-xs text-muted-foreground">{combos.length} combinaciones</span>
                    </div>
                    <div className="max-h-56 overflow-y-auto divide-y">
                      {combos.map((c, i) => {
                        const sku = buildSku(c)
                        const dup = existingSkus.has(sku)
                        const label = [c.color, c.size, c.material].filter(Boolean).join(' / ')
                        return (
                          <div key={i} className="flex items-center gap-3 px-4 py-2 text-sm">
                            <span className="flex-1">{label || '—'}</span>
                            <Badge variant="outline" className="font-mono text-[10px]">{sku}</Badge>
                            {dup
                              ? <span className="text-[10px] text-amber-600 w-16 text-right">Ya existe</span>
                              : <span className="text-[10px] text-muted-foreground w-16 text-right">Stock {gStock}</span>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              )}

              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {genProgress
                    ? `Creando ${genProgress.done}/${genProgress.total}…`
                    : useHorma ? 'Tip: elige varias hormas si el mismo diseño se ofrece en distintos modelos.' : 'Tip: “Negro, Blanco” × “S, M, L” = 6 variantes.'}
                </p>
                <Button onClick={generate} disabled={generating || (useHorma ? hormaCombos.length === 0 : combos.length === 0)} className="gap-1.5">
                  <Wand2 className="w-4 h-4" />
                  {generating
                    ? 'Generando…'
                    : useHorma
                      ? `Generar ${hormaCombos.filter(c => !existingSkus.has(c.sku)).length || ''} variantes`
                      : `Generar ${combos.filter(c => !existingSkus.has(buildSku(c))).length || ''} variantes`}
                </Button>
              </div>
            </div>
          ) : (
            /* ─────────── MODO LISTA (avanzado) ─────────── */
            <>
              <div className="flex flex-wrap gap-2 mb-1">
                <Button size="sm" variant="outline" onClick={openAdd}>
                  <Plus className="w-4 h-4 mr-1" /> Variante manual
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowImport(true)}>
                  <Upload className="w-4 h-4 mr-1" /> Importar CSV
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <a href={api.getVariantImportTemplateUrl()} download>Descargar plantilla</a>
                </Button>
              </div>

              {loading ? (
                <p className="text-muted-foreground text-sm py-4 text-center">Cargando variantes…</p>
              ) : variants.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p>No hay variantes todavía.</p>
                  <Button size="sm" variant="link" onClick={() => setGuided(true)}>Crear rápido con el asistente →</Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {variants.map(v => (
                    <div key={v.id} className="border rounded-lg overflow-hidden">
                      <div
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50"
                        onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}
                      >
                        <div className="flex-1 flex items-center gap-3 flex-wrap">
                          <span className="font-medium text-sm">{v.label || v.sku}</span>
                          <Badge variant="outline" className="text-xs">{v.sku}</Badge>
                          <Badge
                            variant={v.stock === 0 ? 'destructive' : v.stock <= v.minStock ? 'secondary' : 'default'}
                            className="text-xs"
                          >
                            Stock: {v.stock}
                          </Badge>
                          {v.costPrice != null && (
                            <span className="text-xs text-muted-foreground">Costo: {formatCOP(v.costPrice)}</span>
                          )}
                          {v.priceOverride != null && (
                            <span className="text-xs font-semibold text-primary">Venta: {formatCOP(v.priceOverride)}</span>
                          )}
                          {v.priceTiers && v.priceTiers.length > 0 && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <Tag className="w-3 h-3" /> {v.priceTiers.length} tiers
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); setStockVariant(v); setStockForm({ quantity: 0, type: 'entrada', reason: '' }) }}>
                            <TrendingUp className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); openEdit(v) }}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={e => { e.stopPropagation(); deleteVariant(v.id) }}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          {expandedId === v.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>

                      {expandedId === v.id && (
                        <div className="border-t px-4 py-3 bg-muted/20">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium">Precios por cantidad (mayoreo)</p>
                            <Button size="sm" variant="outline" onClick={() => { setShowAddTier(v.id); setTierForm(EMPTY_TIER) }}>
                              <Plus className="w-3 h-3 mr-1" /> Agregar
                            </Button>
                          </div>
                          {(!v.priceTiers || v.priceTiers.length === 0) ? (
                            <p className="text-xs text-muted-foreground">Sin precios por cantidad — se usa el precio base o el override.</p>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-xs">Desde (uds.)</TableHead>
                                  <TableHead className="text-xs">Precio</TableHead>
                                  <TableHead className="text-xs">Margen plataforma</TableHead>
                                  <TableHead className="text-xs">Precio proveedor</TableHead>
                                  <TableHead />
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {v.priceTiers.map((t, idx) => {
                                  const nextMin = v.priceTiers![idx + 1]?.minQty
                                  const rangeLabel = nextMin ? `${t.minQty} – ${nextMin - 1} uds.` : `${t.minQty}+ uds.`
                                  const providerPrice = v.costPrice ? t.price * (1 - t.tenantMarginPct / 100) : null
                                  return (
                                    <TableRow key={t.id}>
                                      <TableCell className="text-xs">{rangeLabel}</TableCell>
                                      <TableCell className="text-xs font-medium">{formatCOP(t.price)}</TableCell>
                                      <TableCell className="text-xs">{t.tenantMarginPct}%</TableCell>
                                      <TableCell className="text-xs text-muted-foreground">{providerPrice ? formatCOP(providerPrice) : '—'}</TableCell>
                                      <TableCell>
                                        <Button size="sm" variant="ghost" className="text-destructive h-6 w-6 p-0" onClick={() => deleteTier(t.id)}>
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  )
                                })}
                              </TableBody>
                            </Table>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add / Edit Variant Dialog ── */}
      <Dialog open={showAddVariant} onOpenChange={v => !v && setShowAddVariant(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingVariant ? 'Editar variante' : 'Nueva variante'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">SKU *</Label>
                <Input placeholder="SE-SISO-BLK" value={variantForm.sku}
                  onChange={e => setVariantForm(p => ({ ...p, sku: e.target.value }))}
                  className={skuDuplicate ? 'border-destructive focus-visible:ring-destructive' : undefined} />
                {skuDuplicate && <p className="text-[10px] text-destructive mt-1">⚠ Ese SKU ya existe en otra variante. Usa uno diferente.</p>}
              </div>
              <div>
                <Label className="text-xs">Horma</Label>
                <Select value={variantForm.hormaId || 'none'} onValueChange={v => setVariantForm(p => ({ ...p, hormaId: v === 'none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Sin horma" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin horma</SelectItem>
                    {hormasList.map(h => (
                      <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Color (nombre)</Label>
                <div className="flex items-center gap-2">
                  <Input placeholder="Ej: Vainilla, Negro…" value={variantForm.color}
                    onChange={e => setVariantForm(p => ({ ...p, color: e.target.value }))} />
                  <input
                    type="color"
                    aria-label="Color exacto"
                    title="Color exacto para el círculo en la tienda"
                    value={/^#[0-9a-fA-F]{6}$/.test(variantForm.colorHex) ? variantForm.colorHex : '#000000'}
                    onChange={e => setVariantForm(p => ({ ...p, colorHex: e.target.value.toUpperCase() }))}
                    className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  El cliente ve el nombre; la paleta fija el <strong>color exacto</strong> del círculo en la tienda
                  {variantForm.colorHex ? ` (${variantForm.colorHex})` : ''}.
                </p>
              </div>
              <div>
                <Label className="text-xs">Talla / Tamaño</Label>
                <Input placeholder="M / 500g" value={variantForm.size}
                  onChange={e => setVariantForm(p => ({ ...p, size: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Material / Tipo</Label>
                <Input placeholder="Algodón" value={variantForm.material}
                  onChange={e => setVariantForm(p => ({ ...p, material: e.target.value }))} />
              </div>
              {!editingVariant && (
                <div>
                  <Label className="text-xs">Stock inicial</Label>
                  <Input type="number" min={0} value={variantForm.stock}
                    onChange={e => setVariantForm(p => ({ ...p, stock: Number(e.target.value) }))} />
                </div>
              )}
              <div>
                <Label className="text-xs">Stock mínimo</Label>
                <Input type="number" min={0} value={variantForm.minStock}
                  onChange={e => setVariantForm(p => ({ ...p, minStock: Number(e.target.value) }))} />
              </div>
              <div>
                <Label className="text-xs">Precio compra / costo</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                  <Input type="number" min={0} placeholder="0" value={variantForm.costPrice}
                    onChange={e => setVariantForm(p => ({ ...p, costPrice: e.target.value }))}
                    className="pl-6" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Precio de venta</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                  <Input type="number" min={0} placeholder="Usa precio base del producto si vacío" value={variantForm.priceOverride}
                    onChange={e => setVariantForm(p => ({ ...p, priceOverride: e.target.value }))}
                    className="pl-6" />
                </div>
              </div>
              <div className="col-span-2 rounded-lg border border-border bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-semibold">Pre-orden (preventa)</Label>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Permite vender esta variante antes de tener stock físico.</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={variantForm.presale}
                    onClick={() => setVariantForm(p => ({ ...p, presale: !p.presale }))}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${variantForm.presale ? 'bg-amber-500' : 'bg-input'}`}
                  >
                    <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${variantForm.presale ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
                {variantForm.presale && (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[10px]">Anticipo (%)</Label>
                      <Input type="number" min={0} max={100} step={5} value={variantForm.presaleDepositPct}
                        onChange={e => setVariantForm(p => ({ ...p, presaleDepositPct: e.target.value }))}
                        className="h-7 text-xs" />
                      <p className="text-[9px] text-muted-foreground mt-0.5">% que paga el cliente ahora</p>
                    </div>
                    <div>
                      <Label className="text-[10px]">Cupo máximo</Label>
                      <Input type="number" min={0} placeholder="∞ ilimitado" value={variantForm.presaleLimit}
                        onChange={e => setVariantForm(p => ({ ...p, presaleLimit: e.target.value }))}
                        className="h-7 text-xs" />
                      <p className="text-[9px] text-muted-foreground mt-0.5">Unidades disponibles</p>
                    </div>
                    <div>
                      <Label className="text-[10px]">Fecha estimada de entrega</Label>
                      <Input type="date" value={variantForm.presaleDate}
                        onChange={e => setVariantForm(p => ({ ...p, presaleDate: e.target.value }))}
                        className="h-7 text-xs" />
                      <p className="text-[9px] text-muted-foreground mt-0.5">Interna, no visible al cliente</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Imágenes del color (máx. {MAX_VARIANT_IMAGES})</Label>
                <p className="text-[11px] text-muted-foreground mb-2">
                  La primera es la principal: al elegir este color en la tienda, la foto cambia a esta galería.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {variantForm.images.map((url, idx) => (
                    <div key={idx} className="rounded-lg border border-border p-1.5 bg-secondary/20">
                      <p className="text-[10px] font-medium text-muted-foreground mb-1">
                        {idx === 0 ? 'Principal ★' : `Imagen ${idx + 1}`}
                      </p>
                      <CloudinaryUpload
                        value={url}
                        onChange={(newUrl) => setVariantForm(p => {
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddVariant(false)}>Cancelar</Button>
            <Button onClick={saveVariant} disabled={savingVariant || skuDuplicate}>
              {savingVariant ? 'Guardando…' : skuDuplicate ? 'SKU duplicado' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Tier Dialog ── */}
      <Dialog open={!!showAddTier} onOpenChange={v => !v && setShowAddTier(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Precio por cantidad</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label className="text-xs">Cantidad mínima (uds.)</Label>
              <Input type="number" min={1} value={tierForm.minQty}
                onChange={e => setTierForm(p => ({ ...p, minQty: Number(e.target.value) }))} />
              <p className="text-xs text-muted-foreground mt-1">
                Aplica desde esta cantidad en adelante hasta el siguiente nivel.
              </p>
            </div>
            <div>
              <Label className="text-xs">Precio unitario *</Label>
              <Input type="number" min={0} placeholder="45000" value={tierForm.price}
                onChange={e => setTierForm(p => ({ ...p, price: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Margen plataforma (%)</Label>
              <Input type="number" min={0} max={100} value={tierForm.tenantMarginPct}
                onChange={e => setTierForm(p => ({ ...p, tenantMarginPct: Number(e.target.value) }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTier(null)}>Cancelar</Button>
            <Button onClick={saveTier} disabled={savingTier}>
              {savingTier ? 'Guardando…' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Stock Adjustment Dialog ── */}
      <Dialog open={!!stockVariant} onOpenChange={v => !v && setStockVariant(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ajustar stock — {stockVariant?.label || stockVariant?.sku}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={stockForm.type}
                onValueChange={v => setStockForm(p => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="salida">Salida</SelectItem>
                  <SelectItem value="ajuste">Ajuste (cantidad exacta)</SelectItem>
                  <SelectItem value="merma">Merma</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Cantidad</Label>
              <Input type="number" min={0} value={stockForm.quantity}
                onChange={e => setStockForm(p => ({ ...p, quantity: Number(e.target.value) }))} />
            </div>
            <div>
              <Label className="text-xs">Motivo *</Label>
              <Input placeholder="Ej: Recepción pedido proveedor" value={stockForm.reason}
                onChange={e => setStockForm(p => ({ ...p, reason: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStockVariant(null)}>Cancelar</Button>
            <Button onClick={saveStock} disabled={savingStock}>
              {savingStock ? 'Guardando…' : 'Ajustar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── CSV Import Dialog ── */}
      <Dialog open={showImport} onOpenChange={v => !v && setShowImport(false)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar variantes desde CSV</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Columnas requeridas: <code>Handle, Product Name, Variant SKU</code>. Opcionales: Color, Size, Variant Stock, Base Price, Cost Price, Supplier.
          </p>
          <textarea
            className="w-full h-48 text-xs font-mono border rounded p-2 resize-none"
            placeholder="Handle,Product Name,Attribute: Color,Attribute: Size,Variant SKU,Variant Stock,Base Price,Cost Price&#10;body-siso,Body Siso Premium,Negro,Única,SE-BLK,15,45000,30000"
            value={csvText}
            onChange={e => setCsvText(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" asChild>
              <a href={api.getVariantImportTemplateUrl()} download>Descargar plantilla</a>
            </Button>
            <Button variant="outline" onClick={() => setShowImport(false)}>Cancelar</Button>
            <Button onClick={importCsv} disabled={importing}>
              {importing ? 'Importando…' : 'Importar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
