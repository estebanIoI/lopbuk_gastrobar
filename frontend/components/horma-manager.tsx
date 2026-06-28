'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '@/lib/api'
import { formatCOP } from '@/lib/utils'
import { normalizeColorName, resolveColorHex } from '@/lib/colors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Plus, Trash2, Edit2, Ruler, Palette, X, Layers, Package } from 'lucide-react'
import { toast } from 'sonner'

// ── Tipos ──────────────────────────────────────────────────────────────────
interface SizeMeasures { ancho?: number; largo?: number; manga?: number }
type SizeChart = Record<string, SizeMeasures>
interface HormaColor { id: string; color: string; hex?: string; sortOrder: number; shelf?: string[] | null }
type Sexo = 'unisex' | 'hombre' | 'mujer'
interface Horma {
  id: string
  name: string
  slug: string
  baseCost: number
  basePrice: number
  weightGrams?: number | null
  composition?: string | null
  shelf?: string[] | null
  sizeChart?: SizeChart
  hasSleeves: boolean
  sexo?: Sexo
  sortOrder: number
  colors?: HormaColor[]
}

// ── ShelfTagInput ───────────────────────────────────────────────────────────
function ShelfTagInput({
  shelves, onChange, placeholder,
}: { shelves: string[]; onChange: (next: string[]) => void; placeholder?: string }) {
  const [input, setInput] = useState('')
  function addShelf() {
    const v = input.trim()
    if (!v || shelves.includes(v)) { setInput(''); return }
    onChange([...shelves, v])
    setInput('')
  }
  return (
    <div className="flex flex-col gap-1.5">
      {shelves.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {shelves.map(s => (
            <span key={s} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
              {s}
              <button type="button" onClick={() => onChange(shelves.filter(x => x !== s))}
                className="text-muted-foreground hover:text-destructive transition-colors">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-1.5">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addShelf() } }}
          placeholder={placeholder ?? 'Ej: A-3, Piso 2…'}
          className="h-7 text-xs"
        />
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={addShelf}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}

interface Props {
  open: boolean
  onClose: () => void
}

const SIZES = ['S', 'M', 'L', 'XL', 'XXL'] as const

const SEXOS: { value: Sexo; label: string }[] = [
  { value: 'unisex', label: 'Unisex' },
  { value: 'hombre', label: 'Hombre' },
  { value: 'mujer', label: 'Mujer' },
]

const EMPTY_FORM = {
  name: '',
  baseCost: '' as number | string,
  basePrice: '' as number | string,
  weightGrams: '' as number | string,
  composition: '',
  hasSleeves: true,
  sexo: 'unisex' as Sexo,
  sortOrder: 0,
}

function emptyChart(hasSleeves: boolean): SizeChart {
  const chart: SizeChart = {}
  for (const s of SIZES) chart[s] = hasSleeves ? { ancho: undefined, largo: undefined, manga: undefined } : { ancho: undefined, largo: undefined }
  return chart
}

export function HormaManager({ open, onClose }: Props) {
  const [hormas, setHormas]   = useState<Horma[]>([])
  const [loading, setLoading] = useState(false)

  // Form de creación/edición
  const [editing, setEditing] = useState<Horma | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]   = useState<typeof EMPTY_FORM>(EMPTY_FORM)
  const [chart, setChart] = useState<SizeChart>(emptyChart(true))
  const [colors, setColors] = useState<{ color: string; hex?: string }[]>([])
  const [newColor, setNewColor] = useState('')
  const [newColorHex, setNewColorHex] = useState('')
  // Casilleros de bodega
  const [shelfPerColor, setShelfPerColor] = useState(false)      // true = estante distinto por color
  const [sharedShelves, setSharedShelves] = useState<string[]>([]) // estantes compartidos (todos los colores)
  const [colorShelves, setColorShelves] = useState<Record<string, string[]>>({}) // color → shelves[]
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Horma | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await api.getHormas()
    if (res.success && res.data) setHormas(res.data as Horma[])
    else toast.error(res.error || 'No se pudieron cargar las hormas')
    setLoading(false)
  }, [])

  useEffect(() => { if (open) load() }, [open, load])

  // Catálogo de colores existentes: deduplicado de las paletas de TODAS las hormas,
  // para poder seleccionarlos como círculos en vez de re-tipearlos/redefinir su hex.
  const existingColorCatalog = useMemo(() => {
    const seen = new Map<string, { color: string; hex?: string }>()
    for (const h of hormas) {
      for (const c of h.colors || []) {
        const key = normalizeColorName(c.color)
        const prev = seen.get(key)
        if (!prev || (!prev.hex && c.hex)) seen.set(key, { color: c.color, hex: c.hex })
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.color.localeCompare(b.color))
  }, [hormas])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setChart(emptyChart(true))
    setColors([])
    setNewColor('')
    setNewColorHex('')
    setShelfPerColor(false)
    setSharedShelves([])
    setColorShelves({})
    setShowForm(true)
  }

  function openEdit(h: Horma) {
    setEditing(h)
    setForm({
      name: h.name,
      baseCost: h.baseCost ?? '',
      basePrice: h.basePrice ?? '',
      weightGrams: h.weightGrams ?? '',
      composition: h.composition ?? '',
      hasSleeves: h.hasSleeves,
      sexo: h.sexo ?? 'unisex',
      sortOrder: h.sortOrder ?? 0,
    })
    const base = emptyChart(h.hasSleeves)
    if (h.sizeChart) for (const s of SIZES) if (h.sizeChart[s]) base[s] = { ...h.sizeChart[s] }
    setChart(base)
    const cols = (h.colors || []).map(c => ({ color: c.color, hex: c.hex, shelf: c.shelf }))
    setColors(cols)
    // Detectar automáticamente si hay casilleros por color o compartidos
    const hasPerColor = cols.some(c => c.shelf?.length)
    setShelfPerColor(hasPerColor)
    setSharedShelves(hasPerColor ? [] : (h.shelf ?? []))
    setColorShelves(
      hasPerColor
        ? Object.fromEntries(cols.filter(c => c.shelf?.length).map(c => [c.color, c.shelf!]))
        : {}
    )
    setNewColor('')
    setNewColorHex('')
    setShowForm(true)
  }

  function setMeasure(size: string, field: keyof SizeMeasures, value: string) {
    setChart(prev => ({
      ...prev,
      [size]: { ...prev[size], [field]: value === '' ? undefined : Number(value) },
    }))
  }

  function isColorSelected(color: string) {
    return colors.some(x => x.color.toLowerCase() === color.toLowerCase())
  }

  // Click en un círculo de "colores existentes": selecciona/des-selecciona.
  function toggleExistingColor(c: { color: string; hex?: string }) {
    if (isColorSelected(c.color)) {
      removeColorChip(c.color)
    } else {
      setColors(prev => [...prev, { color: c.color, hex: c.hex }])
    }
  }

  function addColorChip() {
    const c = newColor.trim()
    if (!c) return
    if (isColorSelected(c)) {
      toast.error('Ese color ya está en la paleta')
      return
    }
    const hex = /^#[0-9A-Fa-f]{6}$/.test(newColorHex) ? newColorHex.toUpperCase() : undefined
    setColors(prev => [...prev, { color: c, hex }])
    setNewColor('')
    setNewColorHex('')
  }

  function removeColorChip(color: string) {
    setColors(prev => prev.filter(c => c.color.toLowerCase() !== color.toLowerCase()))
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('El nombre de la horma es requerido'); return }
    setSaving(true)

    // Limpia size_chart: solo tallas con al menos un valor
    const cleanChart: SizeChart = {}
    for (const s of SIZES) {
      const m = chart[s] || {}
      const entry: SizeMeasures = {}
      if (m.ancho != null) entry.ancho = m.ancho
      if (m.largo != null) entry.largo = m.largo
      if (form.hasSleeves && m.manga != null) entry.manga = m.manga
      if (Object.keys(entry).length) cleanChart[s] = entry
    }

    const payload = {
      name: form.name.trim(),
      baseCost: Number(form.baseCost) || 0,
      basePrice: Number(form.basePrice) || 0,
      weightGrams: form.weightGrams === '' ? null : Number(form.weightGrams),
      composition: form.composition.trim() || null,
      shelf: shelfPerColor ? null : (sharedShelves.length ? sharedShelves : null),
      hasSleeves: form.hasSleeves,
      sexo: form.sexo,
      sortOrder: Number(form.sortOrder) || 0,
      sizeChart: cleanChart,
    }

    // Función auxiliar: resuelve los shelves de un color según el modo
    const resolveShelf = (colorName: string): string[] | null =>
      shelfPerColor ? (colorShelves[colorName]?.length ? colorShelves[colorName] : null) : null

    let hormaId: string | null = null
    if (editing) {
      const res = await api.updateHorma(editing.id, payload)
      if (!res.success) { toast.error(res.error || 'Error al actualizar'); setSaving(false); return }
      hormaId = editing.id
      // Sincroniza colores: agrega los nuevos, quita los que ya no están
      const existing = editing.colors || []
      const wantedLc = colors.map(c => c.color.toLowerCase())
      for (const ex of existing) {
        if (!wantedLc.includes(ex.color.toLowerCase())) await api.removeHormaColor(ex.id)
      }
      const existingLc = existing.map(c => c.color.toLowerCase())
      let order = 1
      for (const c of colors) {
        const shelf = resolveShelf(c.color)
        if (!existingLc.includes(c.color.toLowerCase())) {
          await api.addHormaColor(editing.id, { color: c.color, hex: c.hex, sortOrder: order, shelf })
        } else {
          // Actualizar shelf del color existente si cambió
          const ex = existing.find(e => e.color.toLowerCase() === c.color.toLowerCase())
          if (ex && JSON.stringify(ex.shelf ?? null) !== JSON.stringify(shelf ?? null)) {
            await api.updateHormaColor(ex.id, { shelf })
          }
        }
        order++
      }
    } else {
      const colorsWithShelf = colors.map(c => ({ ...c, shelf: resolveShelf(c.color) }))
      const res = await api.createHorma({ ...payload, colors: colorsWithShelf })
      if (!res.success) { toast.error(res.error || 'Error al crear'); setSaving(false); return }
      hormaId = res.data?.id
    }

    toast.success(editing ? 'Horma actualizada' : 'Horma creada')
    setSaving(false)
    setShowForm(false)
    await load()
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const res = await api.deleteHorma(deleteTarget.id)
    setDeleting(false)
    if (res.success) { toast.success('Horma eliminada'); setDeleteTarget(null); await load() }
    else toast.error(res.error || 'No se pudo eliminar')
  }


  return (
    <>
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" /> Hormas (siluetas)
          </DialogTitle>
        </DialogHeader>

        {!showForm ? (
          <>
            <div className="flex justify-end">
              <Button onClick={openCreate} size="sm">
                <Plus className="h-4 w-4 mr-1" /> Nueva horma
              </Button>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Cargando…</p>
            ) : hormas.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Aún no hay hormas. Crea la primera (ej: Oversize Fit).
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Horma</TableHead>
                    <TableHead>Sexo</TableHead>
                    <TableHead>Costo</TableHead>
                    <TableHead>Precio</TableHead>
                    <TableHead>Colores</TableHead>
                    <TableHead>Peso / Composición</TableHead>
                    <TableHead>Manga</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hormas.map(h => (
                    <TableRow key={h.id}>
                      <TableCell className="font-medium">{h.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {SEXOS.find(s => s.value === (h.sexo ?? 'unisex'))?.label ?? 'Unisex'}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCOP(h.baseCost)}</TableCell>
                      <TableCell>{formatCOP(h.basePrice)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <div className="flex -space-x-1.5">
                            {(h.colors || []).slice(0, 5).map(c => (
                              <span
                                key={c.id}
                                title={c.color}
                                className="h-4 w-4 rounded-full border border-background shadow-sm"
                                style={{ backgroundColor: resolveColorHex(c.color, c.hex) }}
                              />
                            ))}
                          </div>
                          <Badge variant="secondary">{h.colors?.length ?? 0}</Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>{h.weightGrams != null ? `${h.weightGrams} g` : '—'}</div>
                        {h.composition && <div className="text-xs text-muted-foreground">{h.composition}</div>}
                      </TableCell>
                      <TableCell>{h.hasSleeves ? 'Sí' : 'No'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(h)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(h)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        ) : (
          <div className="space-y-5">
            {/* Datos base */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label htmlFor="h-name">Nombre *</Label>
                <Input id="h-name" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Oversize Fit" />
              </div>
              <div>
                <Label htmlFor="h-cost">Costo base (COP)</Label>
                <Input id="h-cost" type="number" value={form.baseCost}
                  onChange={e => setForm(f => ({ ...f, baseCost: e.target.value }))}
                  placeholder="36000" />
              </div>
              <div>
                <Label htmlFor="h-price">Precio venta base (COP)</Label>
                <Input id="h-price" type="number" value={form.basePrice}
                  onChange={e => setForm(f => ({ ...f, basePrice: e.target.value }))}
                  placeholder="72000" />
              </div>
              <div>
                <Label htmlFor="h-weight">Peso (gramos)</Label>
                <Input id="h-weight" type="number" value={form.weightGrams}
                  onChange={e => setForm(f => ({ ...f, weightGrams: e.target.value }))}
                  placeholder="230" />
              </div>
              <div>
                <Label htmlFor="h-composition">Composición</Label>
                <Input id="h-composition" value={form.composition}
                  onChange={e => setForm(f => ({ ...f, composition: e.target.value }))}
                  placeholder="100% Algodón" />
              </div>
              <div>
                <Label htmlFor="h-sexo">Sexo</Label>
                <Select value={form.sexo} onValueChange={(v: Sexo) => setForm(f => ({ ...f, sexo: v }))}>
                  <SelectTrigger id="h-sexo"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SEXOS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3 sm:col-span-2">
                <Switch id="h-sleeves" checked={form.hasSleeves}
                  onCheckedChange={(v) => setForm(f => ({ ...f, hasSleeves: v }))} />
                <Label htmlFor="h-sleeves">Tiene mangas (apagar para esqueleto)</Label>
              </div>
            </div>

            {/* Tabla de medidas */}
            <div>
              <Label className="flex items-center gap-2 mb-2"><Ruler className="h-4 w-4" /> Tabla de medidas (cm)</Label>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left p-1 font-medium"></th>
                      {SIZES.map(s => <th key={s} className="p-1 font-medium text-center">{s}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {(['ancho', 'largo', ...(form.hasSleeves ? ['manga'] : [])] as (keyof SizeMeasures)[]).map(field => (
                      <tr key={field}>
                        <td className="p-1 capitalize text-muted-foreground">{field}</td>
                        {SIZES.map(s => (
                          <td key={s} className="p-1">
                            <Input
                              type="number"
                              className="h-8 text-center"
                              value={chart[s]?.[field] ?? ''}
                              onChange={e => setMeasure(s, field, e.target.value)}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Paleta de colores */}
            <div className="space-y-4">
              <Label className="flex items-center gap-2"><Palette className="h-4 w-4" /> Paleta de colores</Label>

              {/* Colores existentes: círculos seleccionables */}
              {existingColorCatalog.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Colores existentes — clic para agregar o quitar</p>
                  <div className="flex flex-wrap gap-2">
                    {existingColorCatalog.map(c => {
                      const selected = isColorSelected(c.color)
                      return (
                        <button
                          key={c.color}
                          type="button"
                          onClick={() => toggleExistingColor(c)}
                          title={c.color}
                          className={`flex items-center gap-1.5 rounded-full border pl-1 pr-2.5 py-1 text-xs transition-colors ${
                            selected ? 'border-primary bg-primary/10' : 'border-input hover:bg-muted'
                          }`}
                        >
                          <span className="h-5 w-5 rounded-full border shadow-sm shrink-0"
                            style={{ backgroundColor: resolveColorHex(c.color, c.hex) }} />
                          <span>{c.color}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Agregar color nuevo */}
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Agregar color nuevo</p>
                <div className="flex gap-2">
                  <Input value={newColor} onChange={e => setNewColor(e.target.value)}
                    placeholder="Negro, Blanco, V. Botella…"
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addColorChip() } }} />
                  <input type="color" aria-label="Hex exacto"
                    value={/^#[0-9a-fA-F]{6}$/.test(newColorHex) ? newColorHex : (newColor ? resolveColorHex(newColor) : '#000000')}
                    onChange={e => setNewColorHex(e.target.value.toUpperCase())}
                    className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1" />
                  <Button type="button" variant="secondary" onClick={addColorChip}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Paleta seleccionada — con casilleros inline */}
              <div className="space-y-2">
                {colors.length === 0
                  ? <p className="text-xs text-muted-foreground">Sin colores aún</p>
                  : colors.map(c => (
                    <div key={c.color} className="rounded-md border border-border bg-background px-2.5 py-2">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="h-3.5 w-3.5 rounded-full border shrink-0"
                          style={{ backgroundColor: resolveColorHex(c.color, c.hex) }} />
                        <span className="text-xs font-medium flex-1">{c.color}</span>
                        <button type="button" onClick={() => removeColorChip(c.color)}
                          className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {shelfPerColor && (
                        <div className="flex items-start gap-1.5">
                          <Package className="h-3 w-3 text-muted-foreground shrink-0 mt-1.5" />
                          <div className="flex-1">
                            <ShelfTagInput
                              shelves={colorShelves[c.color] ?? []}
                              onChange={next => setColorShelves(prev => ({ ...prev, [c.color]: next }))}
                              placeholder={`Estante para ${c.color}…`}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                }
              </div>

              {/* Estantes compartidos (visible cuando NO es por-color) */}
              {!shelfPerColor && colors.length > 0 && (
                <div className="flex items-start gap-1.5 rounded-md border border-dashed border-border px-2.5 py-2">
                  <Package className="h-3 w-3 text-muted-foreground shrink-0 mt-1.5" />
                  <div className="flex-1">
                    <p className="text-[11px] text-muted-foreground mb-1">Estantes compartidos (todos los colores)</p>
                    <ShelfTagInput
                      shelves={sharedShelves}
                      onChange={setSharedShelves}
                      placeholder="Ej: A-3, Piso 2…"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ── Switch estante compartido / por color ── */}
            {colors.length > 0 && (
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5 bg-muted/30">
                <div className="space-y-0.5">
                  <p className="text-xs font-medium">
                    {shelfPerColor ? 'Estante distinto por color' : 'Estante compartido para todos los colores'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {shelfPerColor
                      ? 'Cada color puede tener uno o más casilleros propios.'
                      : 'Todos los colores comparten los mismos estantes en bodega.'}
                  </p>
                </div>
                <Switch
                  checked={shelfPerColor}
                  onCheckedChange={v => {
                    setShelfPerColor(v)
                    if (!v) setColorShelves({})
                    else setSharedShelves([])
                  }}
                />
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowForm(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear horma'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* Modal de confirmación de borrado */}
    <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o && !deleting) setDeleteTarget(null) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar horma</DialogTitle>
          <DialogDescription>
            ¿Seguro que deseas eliminar &quot;{deleteTarget?.name}&quot;? Los productos que la usan no se borran, solo pierden la referencia. Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancelar</Button>
          <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
            {deleting ? 'Eliminando…' : 'Eliminar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
