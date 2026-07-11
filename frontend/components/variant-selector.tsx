'use client'

/**
 * VariantSelector — selector de variantes para el cliente, estilo Mercado Libre.
 *
 * Recibe el array `variants` que el backend adjunta a cada producto de la tienda
 * (campos: color, size, material, stock, reserved_stock, price_override, images,
 * priceTiers, min_price) y arma automáticamente los ejes presentes:
 *   - Color  → swatches circulares con el color real.
 *   - Talla / Peso / Cantidad → chips (detecta si los valores son pesos/volúmenes).
 *   - Material → chips.
 * Al elegir una opción de cada eje resuelve la variante exacta y la reporta vía
 * onChange, junto con su precio, stock e imagen. Muestra además el precio por
 * cantidad (tiers) cuando existe.
 *
 * Es autocontenido y tematizable (claro/oscuro) para encajar en cualquier tienda.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Check } from 'lucide-react'
import { colorToCss } from '@/lib/colors'

// ── Forma cruda que llega del backend (snake_case + algunos camelCase) ──
export interface RawVariant {
  id: string | number
  sku?: string
  color?: string | null
  colorHex?: string | null
  color_hex?: string | null
  size?: string | null
  material?: string | null
  stock?: number
  reserved_stock?: number
  reservedStock?: number
  price_override?: number | null
  priceOverride?: number | null
  images?: string[] | null
  priceTiers?: { minQty: number; price: number; marginPct?: number }[]
  min_price?: number | null
  minPrice?: number | null
  /** Horma (silueta/fit) de ESTA variante — un producto puede ofrecerse en varias. */
  hormaId?: string | number | null
  hormaName?: string | null
  /** Precio base de la horma */
  hormaBasePrice?: number | null
  /** Peso y composición heredados de la horma */
  hormaWeightGrams?: number | null
  hormaComposition?: string | null
  /** Precompra — esta variante se vende antes de tener stock físico */
  presale?: boolean | number
  presaleDate?: string | null
  presaleLimit?: number | null
  presaleSold?: number
  presaleDepositPct?: number
  /** Atributos con nombre (ferretería/genérico): Diámetro, Ángulo, Presión… */
  attributes?: Array<{ name: string; value: string }> | null
}

// ── Variante seleccionada que se reporta al padre ──
export interface SelectedVariant {
  id: string
  label: string
  price: number
  image: string | null
  available: number
  sku?: string
}

interface NormVariant {
  id: string
  sku?: string
  color?: string
  colorHex?: string
  size?: string
  material?: string
  horma?: string
  available: number
  priceOverride?: number
  hormaBasePrice?: number | null
  tiers: { minQty: number; price: number }[]
  image: string | null
  weightGrams?: number | null
  composition?: string | null
  /** Atributos con nombre: mapa name→value + lista ordenada (para la ficha técnica) */
  attrs: Record<string, string>
  attrList: { name: string; value: string }[]
}

// Eje de selección: legacy (color/size/material/horma) o atributo con nombre (attr:<Name>)
type Axis = { key: string; label: string; values: string[]; attr?: string; isColor?: boolean }

// Valor de un eje en una variante (funciona para legacy y para atributos con nombre)
function valueForKey(v: NormVariant, key: string): string | undefined {
  if (key.startsWith('attr:')) return v.attrs[key.slice(5)]
  return (v as any)[key]
}

// "horma" va primero a propósito: es la elección más amplia (ej. "Oversize Fit" vs
// "Camiseta Clásica") — tiene sentido elegirla antes de color/talla, ya que cada
// horma puede traer su propia paleta de colores y tabla de tallas.
const AXES: { key: 'horma' | 'color' | 'size' | 'material'; defaultLabel: string }[] = [
  { key: 'horma', defaultLabel: 'Modelo' },
  { key: 'color', defaultLabel: 'Color' },
  { key: 'size', defaultLabel: 'Talla' },
  { key: 'material', defaultLabel: 'Material' },
]

const num = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === '') return undefined
  const n = Number(v)
  return isNaN(n) ? undefined : n
}

function normalize(v: RawVariant): NormVariant {
  const stock = Number(v.stock ?? 0)
  const reserved = Number(v.reserved_stock ?? v.reservedStock ?? 0)
  const images = Array.isArray(v.images) ? v.images : []
  const tiers = Array.isArray(v.priceTiers)
    ? v.priceTiers.map(t => ({ minQty: Number(t.minQty), price: Number(t.price) })).sort((a, b) => a.minQty - b.minQty)
    : []
  const attrList = Array.isArray(v.attributes)
    ? v.attributes
        .filter(a => a && a.name != null && a.value != null)
        .map(a => ({ name: String(a.name).trim(), value: String(a.value).trim() }))
        .filter(a => a.name && a.value)
    : []
  const attrs: Record<string, string> = {}
  for (const a of attrList) if (!(a.name in attrs)) attrs[a.name] = a.value
  return {
    id: String(v.id),
    sku: v.sku,
    color: v.color?.trim() || undefined,
    colorHex: (v.colorHex ?? v.color_hex ?? undefined)?.trim() || undefined,
    size: v.size?.trim() || undefined,
    material: v.material?.trim() || undefined,
    horma: v.hormaName?.trim() || undefined,
    available: Math.max(0, stock - reserved),
    priceOverride: num(v.price_override ?? v.priceOverride),
    hormaBasePrice: num(v.hormaBasePrice) ?? null,
    tiers,
    image: images[0] || null,
    weightGrams: v.hormaWeightGrams ?? null,
    composition: v.hormaComposition ?? null,
    attrs,
    attrList,
  }
}

function variantUnitPrice(v: NormVariant, basePrice: number): number {
  if (v.priceOverride != null) return v.priceOverride
  if (v.tiers.length > 0) return v.tiers[0].price
  if (v.hormaBasePrice != null && v.hormaBasePrice > 0) return v.hormaBasePrice
  return basePrice
}

// ¿Los valores parecen pesos / volúmenes? → etiqueta "Peso / Cantidad"
function sizeAxisLabel(values: string[]): string {
  const weighty = values.length > 0 && values.every(x => /\d\s*(g|kg|gr|ml|l|lt|lb|oz|cc)\b/i.test(x))
  return weighty ? 'Peso / Cantidad' : 'Talla'
}

export function VariantSelector({
  variants,
  basePrice,
  isLightBg = false,
  allowOutOfStock = false,
  onChange,
  formatPrice,
}: {
  variants: RawVariant[]
  basePrice: number
  isLightBg?: boolean
  /** Preventa/backorder: permite elegir variantes agotadas (no se deshabilitan). */
  allowOutOfStock?: boolean
  onChange?: (selected: SelectedVariant | null) => void
  formatPrice?: (n: number) => string
}) {
  const fmt = formatPrice ?? ((n: number) => `$${Number(n || 0).toLocaleString('es-CO')}`)
  const norm = useMemo(() => (variants || []).map(normalize), [variants])

  // Color exacto (hex) por nombre de color, definido por el comercio en la variante.
  const colorHexByName = useMemo(() => {
    const m: Record<string, string> = {}
    for (const v of norm) {
      if (v.color && v.colorHex && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.colorHex)) m[v.color] = v.colorHex
    }
    return m
  }, [norm])

  const [sel, setSel] = useState<Record<string, string>>({})

  // Ejes presentes — color y talla filtrados por la horma activa + ejes de atributos con nombre
  const axes = useMemo<Axis[]>(() => {
    const activeHorma = sel['horma']
    // Ejes legacy (horma/color/talla/material)
    const legacy: Axis[] = AXES.map(a => {
      const scopedNorm = (a.key === 'color' || a.key === 'size') && activeHorma
        ? norm.filter(v => v.horma === activeHorma)
        : norm
      const values = Array.from(new Set(scopedNorm.map(v => v[a.key]).filter(Boolean) as string[]))
      const label = a.key === 'size' ? sizeAxisLabel(values) : a.defaultLabel
      return { key: a.key, label, values, isColor: a.key === 'color' }
    }).filter(a => a.values.length > 0)

    // Ejes de atributos con nombre (ferretería/genérico) — orden de primera aparición
    const attrNames: string[] = []
    for (const v of norm) for (const a of v.attrList) if (!attrNames.includes(a.name)) attrNames.push(a.name)
    const attrAxes: Axis[] = attrNames.map(name => {
      const values = Array.from(new Set(norm.map(v => v.attrs[name]).filter(Boolean) as string[]))
      return { key: `attr:${name}`, label: name, values, attr: name }
    }).filter(a => a.values.length > 0)

    return [...legacy, ...attrAxes]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [norm, sel['horma']])

  // ── Composición ── mapa bidireccional hormaName ↔ { composition, weightGrams }
  const { compositionToHorma, hormaToComposition, compositionToWeight, hormaToWeight, uniqueCompositions } = useMemo(() => {
    const c2h: Record<string, string> = {}
    const h2c: Record<string, string> = {}
    const c2w: Record<string, number | null> = {}
    const h2w: Record<string, number | null> = {}
    for (const v of norm) {
      if (v.composition) {
        if (v.horma) { c2h[v.composition] = v.horma; h2c[v.horma] = v.composition }
        if (!(v.composition in c2w)) c2w[v.composition] = v.weightGrams ?? null
      }
      if (v.horma) h2w[v.horma] = v.weightGrams ?? null
    }
    const unique = Array.from(new Set(Object.keys(c2h)))
    return { compositionToHorma: c2h, hormaToComposition: h2c, compositionToWeight: c2w, hormaToWeight: h2w, uniqueCompositions: unique }
  }, [norm])

  // Hormas únicas ordenadas (por orden en que aparecen)
  const allHormas = useMemo(
    () => Array.from(new Set(norm.map(v => v.horma).filter(Boolean) as string[])),
    [norm]
  )

  // Reinicia selección cuando cambian variantes, auto-seleccionando la primera opción de cada eje
  useEffect(() => {
    if (norm.length === 0) { setSel({}); return }
    const next: Record<string, string> = {}
    const firstHorma = allHormas[0]
    if (firstHorma) next.horma = firstHorma
    const scoped = firstHorma ? norm.filter(v => v.horma === firstHorma) : norm
    const firstColor = Array.from(new Set(scoped.map(v => v.color).filter(Boolean) as string[]))[0]
    const firstSize = Array.from(new Set(scoped.map(v => v.size).filter(Boolean) as string[]))[0]
    if (firstColor) next.color = firstColor
    if (firstSize) next.size = firstSize
    // Sembrar ejes de atributos con nombre (ferretería/genérico)
    const attrNames: string[] = []
    for (const v of norm) for (const a of v.attrList) if (!attrNames.includes(a.name)) attrNames.push(a.name)
    for (const name of attrNames) {
      const firstVal = Array.from(new Set(norm.map(v => v.attrs[name]).filter(Boolean) as string[]))[0]
      if (firstVal) next[`attr:${name}`] = firstVal
    }
    setSel(next)
  }, [variants]) // eslint-disable-line react-hooks/exhaustive-deps

  // La composición activa se deriva de la horma seleccionada (sin estado propio).
  const activeComposition = sel['horma'] ? (hormaToComposition[sel['horma']] ?? null) : null

  // Seleccionar una composición = seleccionar su horma correspondiente.
  const selectComposition = (comp: string) => {
    const hormaName = compositionToHorma[comp]
    if (!hormaName) return
    setSel(prev => {
      if (prev['horma'] === hormaName) return prev
      const scoped = norm.filter(v => v.horma === hormaName)
      const firstColor = Array.from(new Set(scoped.map(v => v.color).filter(Boolean) as string[]))[0]
      const firstSize = Array.from(new Set(scoped.map(v => v.size).filter(Boolean) as string[]))[0]
      return { horma: hormaName, ...(firstColor ? { color: firstColor } : {}), ...(firstSize ? { size: firstSize } : {}) }
    })
  }

  // ¿Existe alguna variante en stock consistente con `partial`? (claves = axis.key)
  const hasStockFor = (partial: Record<string, string>): boolean =>
    norm.some(v => v.available > 0 && Object.entries(partial).every(([k, val]) => valueForKey(v, k) === val))

  // Variante resuelta: todos los ejes elegidos y coincide exactamente
  const selectedVariant = useMemo(() => {
    if (axes.length === 0) return null
    if (!axes.every(a => sel[a.key])) return null
    return norm.find(v => axes.every(a => valueForKey(v, a.key) === sel[a.key])) || null
  }, [norm, axes, sel])

  // Reporta al padre
  useEffect(() => {
    if (!onChange) return
    if (!selectedVariant) { onChange(null); return }
    const price = variantUnitPrice(selectedVariant, basePrice)
    const labelParts = axes.map(a => valueForKey(selectedVariant, a.key)).filter(Boolean)
    onChange({
      id: selectedVariant.id,
      label: labelParts.join(' / '),
      price,
      image: selectedVariant.image,
      available: selectedVariant.available,
      sku: selectedVariant.sku,
    })
  }, [selectedVariant]) // eslint-disable-line react-hooks/exhaustive-deps

  if (axes.length === 0) return null

  const muted = isLightBg ? 'text-black/45' : 'text-white/45'
  const strong = isLightBg ? 'text-black/80' : 'text-white/85'
  const chipIdle = isLightBg
    ? 'border-black/15 text-black/70 hover:border-black/40'
    : 'border-white/20 text-white/80 hover:border-white/50'
  // OJO: NO usar las clases text-white/text-black aquí. En tema claro, globals.css tiene
  // `[data-pf-theme="light"] .text-white { color:#0f172a !important }`, que pisaría incluso
  // el style inline → texto invisible sobre el pill. El color del chip activo se aplica
  // SOLO por activeChipStyle (sin clase de color, así nada lo sobrescribe).
  const chipActive = isLightBg
    ? 'border-black bg-black'
    : 'border-white bg-white'
  // Estilo inline para el chip seleccionado: contraste negro/blanco garantizado.
  const activeChipStyle: CSSProperties = isLightBg
    ? { backgroundColor: '#111', color: '#fff', borderColor: '#111' }
    : { backgroundColor: '#fff', color: '#111', borderColor: '#fff' }
  const chipDisabled = isLightBg
    ? 'border-black/10 text-black/25 line-through cursor-not-allowed'
    : 'border-white/10 text-white/25 line-through cursor-not-allowed'
  // Preventa: agotada pero seleccionable (gris, sin tachado, borde punteado)
  const chipPreorder = isLightBg
    ? 'border-dashed border-black/25 text-black/45 hover:border-black/50 cursor-pointer'
    : 'border-dashed border-white/25 text-white/45 hover:border-white/50 cursor-pointer'

  const toggle = (key: string, value: string) => {
    setSel(prev => {
      if (key === 'horma') {
        if (prev[key] === value) return prev // no deseleccionar la horma activa
        // Al cambiar horma, auto-seleccionar primer color y talla de la nueva horma
        const scoped = norm.filter(v => v.horma === value)
        const firstColor = Array.from(new Set(scoped.map(v => v.color).filter(Boolean) as string[]))[0]
        const firstSize = Array.from(new Set(scoped.map(v => v.size).filter(Boolean) as string[]))[0]
        return { horma: value, ...(firstColor ? { color: firstColor } : {}), ...(firstSize ? { size: firstSize } : {}) }
      }
      // Color, talla y atributos con nombre son obligatorios — no se desmarcan, solo cambian
      if ((key === 'color' || key === 'size' || key.startsWith('attr:')) && prev[key] === value) return prev
      return prev[key] === value
        ? (() => { const c = { ...prev }; delete c[key]; return c })()
        : { ...prev, [key]: value }
    })
  }

  // Precio a mostrar: variante elegida, o "Desde X" del rango
  const allPrices = norm.map(v => variantUnitPrice(v, basePrice))
  const minPrice = allPrices.length ? Math.min(...allPrices) : basePrice
  const selPrice = selectedVariant ? variantUnitPrice(selectedVariant, basePrice) : null

  return (
    <div className="space-y-4">
      {/* Composición / Calidad — aparece solo si hay composiciones registradas */}
      {uniqueCompositions.length > 0 && (
        <div>
          <p className={`text-[11px] uppercase tracking-widest mb-2.5 ${muted}`}>
            Composición / Calidad
          </p>
          {uniqueCompositions.length === 1 ? (
            // Solo hay una composición → se muestra como dato estático, pero el peso refleja la horma activa
            <div className="space-y-0.5">
              {(sel['horma'] ? hormaToWeight[sel['horma']] : compositionToWeight[uniqueCompositions[0]]) != null && (
                <p className={`text-sm font-semibold ${strong}`}>
                  {sel['horma'] ? hormaToWeight[sel['horma']] : compositionToWeight[uniqueCompositions[0]]} g
                </p>
              )}
              <p className={`text-sm ${strong}`}>
                {sel['horma'] ? (hormaToComposition[sel['horma']] ?? uniqueCompositions[0]) : uniqueCompositions[0]}
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {uniqueCompositions.map(comp => {
                const active = activeComposition === comp
                const hormaName = compositionToHorma[comp]
                const available = hasStockFor({ horma: hormaName })
                const blocked = !available && !allowOutOfStock
                const weight = hormaName ? (hormaToWeight[hormaName] ?? compositionToWeight[comp]) : compositionToWeight[comp]
                return (
                  <button
                    key={comp}
                    type="button"
                    disabled={blocked}
                    onClick={() => selectComposition(comp)}
                    // Inline en el activo: contraste negro/blanco garantizado (gana sobre el remap de tema)
                    style={active ? activeChipStyle : undefined}
                    className={`px-4 py-2 rounded-full border-2 text-sm font-medium transition-all ${active ? chipActive : available ? chipIdle : allowOutOfStock ? chipPreorder : chipDisabled}`}
                  >
                    {weight != null && <span className="block text-[10px] font-semibold leading-tight">{weight} g</span>}
                    {comp}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
      {axes.map(axis => (
        <div key={axis.key}>
          <p className={`text-[11px] uppercase tracking-widest mb-2.5 ${muted}`}>
            {axis.label}
            {sel[axis.key] && <span className={`ml-1.5 normal-case tracking-normal ${strong}`}>— {sel[axis.key]}</span>}
          </p>

          {axis.key === 'color' ? (
            <div className="flex flex-wrap gap-2.5">
              {axis.values.map(val => {
                const active = sel[axis.key] === val
                const otherSel = Object.fromEntries(Object.entries(sel).filter(([k]) => k !== axis.key))
                const available = hasStockFor({ ...otherSel, [axis.key]: val })
                const blocked = !available && !allowOutOfStock
                const css = colorHexByName[val] || colorToCss(val) || (isLightBg ? '#5b5b5b' : '#cfcfcf')
                return (
                  <button
                    key={val}
                    type="button"
                    title={val + (available ? '' : allowOutOfStock ? ' (preventa)' : ' (agotado)')}
                    disabled={blocked}
                    onClick={() => toggle(axis.key, val)}
                    className={`relative w-9 h-9 rounded-full transition-all ${available ? 'cursor-pointer' : blocked ? 'opacity-30 cursor-not-allowed' : 'opacity-60 cursor-pointer'}`}
                    style={{
                      backgroundColor: css,
                      boxShadow: active
                        ? `inset 0 0 0 2px #fff, 0 0 0 2px ${isLightBg ? '#111' : '#fff'}`
                        : 'inset 0 0 0 1px rgba(127,127,127,0.35)',
                    }}
                  >
                    {active && (
                      <Check className="w-4 h-4 absolute inset-0 m-auto" style={{ color: /f|e|d|c/i.test(css[1] || '') ? '#111' : '#fff' }} />
                    )}
                    {blocked && <span className="absolute inset-0 m-auto w-[120%] h-[1px] bg-current rotate-45 origin-center" />}
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {axis.values.map(val => {
                const active = sel[axis.key] === val
                const otherSel = Object.fromEntries(Object.entries(sel).filter(([k]) => k !== axis.key))
                const available = hasStockFor({ ...otherSel, [axis.key]: val })
                const blocked = !available && !allowOutOfStock
                return (
                  <button
                    key={val}
                    type="button"
                    disabled={blocked}
                    onClick={() => toggle(axis.key, val)}
                    // Inline en el activo: contraste negro/blanco garantizado (gana sobre el remap de tema)
                    style={active ? activeChipStyle : undefined}
                    className={`px-4 py-2 rounded-full border-2 text-sm font-medium transition-all ${active ? chipActive : available ? chipIdle : allowOutOfStock ? chipPreorder : chipDisabled}`}
                  >
                    {val}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      ))}

      {/* Estado de la selección: precio + stock + tiers */}
      <div className={`pt-1 ${muted}`}>
        {selectedVariant ? (
          <div className="space-y-2">
            {/* Precio de la variante seleccionada */}
            <p className={`text-xl font-bold ${strong}`}>{fmt(selPrice!)}</p>
            <p className="text-sm">
              {selectedVariant.available > 0 ? (
                <span className={selectedVariant.available <= 5 ? 'text-amber-500 font-medium' : strong}>
                  {selectedVariant.available <= 5 ? `¡Solo quedan ${selectedVariant.available}!` : `${selectedVariant.available} disponibles`}
                </span>
              ) : allowOutOfStock ? (
                <span className="text-amber-500 font-medium">Disponible en preventa</span>
              ) : (
                <span className="text-red-500 font-medium">Agotado</span>
              )}
            </p>
            {selectedVariant.weightGrams != null && (
              <p className={`text-xs ${muted}`}>⚖ {selectedVariant.weightGrams} g</p>
            )}
            {selectedVariant.tiers.length > 1 && (
              <div className={`rounded-lg border ${isLightBg ? 'border-black/10' : 'border-white/15'} overflow-hidden text-xs`}>
                <p className={`px-3 py-1.5 ${isLightBg ? 'bg-black/[0.03]' : 'bg-white/[0.05]'} ${strong} font-medium`}>Precio por cantidad</p>
                <div className={`divide-y ${isLightBg ? 'divide-black/5' : 'divide-white/10'}`}>
                  {selectedVariant.tiers.map((t, i) => {
                    const next = selectedVariant.tiers[i + 1]?.minQty
                    const range = next ? `${t.minQty}–${next - 1} u.` : `${t.minQty}+ u.`
                    return (
                      <div key={i} className="flex items-center justify-between px-3 py-1.5">
                        <span className={muted}>{range}</span>
                        <span className={`font-semibold ${strong}`}>{fmt(t.price)} c/u</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Ficha técnica — atributos de la variante elegida (ferretería/genérico) */}
            {(() => {
              const specRows = [
                ...selectedVariant.attrList,
                ...(selectedVariant.color ? [{ name: 'Color', value: selectedVariant.color }] : []),
                ...(selectedVariant.size ? [{ name: 'Talla', value: selectedVariant.size }] : []),
                ...(selectedVariant.material ? [{ name: 'Material', value: selectedVariant.material }] : []),
                ...(selectedVariant.sku ? [{ name: 'SKU', value: selectedVariant.sku }] : []),
              ]
              if (specRows.length === 0) return null
              return (
                <div className={`rounded-lg border ${isLightBg ? 'border-black/10' : 'border-white/15'} overflow-hidden text-xs`}>
                  <p className={`px-3 py-1.5 ${isLightBg ? 'bg-black/[0.03]' : 'bg-white/[0.05]'} ${strong} font-medium`}>Ficha técnica</p>
                  <div className={`divide-y ${isLightBg ? 'divide-black/5' : 'divide-white/10'}`}>
                    {specRows.map((s, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 px-3 py-1.5">
                        <span className={muted}>{s.name}</span>
                        <span className={`font-medium text-right ${strong}`}>{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>
        ) : (
          <p className="text-sm">
            <span className={muted}>Desde </span>
            <span className={`font-semibold ${strong}`}>{fmt(minPrice)}</span>
            <span className={`ml-2 ${muted}`}>· Elige una opción</span>
          </p>
        )}
      </div>
    </div>
  )
}
