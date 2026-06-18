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
import { useEffect, useMemo, useState } from 'react'
import { Check } from 'lucide-react'

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
  available: number
  priceOverride?: number
  tiers: { minQty: number; price: number }[]
  image: string | null
}

const AXES: { key: 'color' | 'size' | 'material'; defaultLabel: string }[] = [
  { key: 'color', defaultLabel: 'Color' },
  { key: 'size', defaultLabel: 'Talla' },
  { key: 'material', defaultLabel: 'Material' },
]

// Mapa de nombres de color (ES/EN) → CSS, para los swatches
const COLOR_MAP: Record<string, string> = {
  negro: '#111111', black: '#111111',
  blanco: '#f8f8f8', white: '#f8f8f8',
  gris: '#9ca3af', gray: '#9ca3af', grey: '#9ca3af',
  rojo: '#dc2626', red: '#dc2626',
  azul: '#2563eb', blue: '#2563eb',
  'azul marino': '#1e3a8a', navy: '#1e3a8a',
  verde: '#16a34a', green: '#16a34a',
  amarillo: '#facc15', yellow: '#facc15',
  naranja: '#f97316', orange: '#f97316',
  morado: '#7c3aed', purple: '#7c3aed', violeta: '#7c3aed',
  rosado: '#ec4899', rosa: '#ec4899', pink: '#ec4899',
  cafe: '#78350f', café: '#78350f', marron: '#78350f', marrón: '#78350f', brown: '#78350f',
  beige: '#e7d8c0', crema: '#f5e9d6',
  dorado: '#d4af37', gold: '#d4af37',
  plateado: '#c0c0c0', plata: '#c0c0c0', silver: '#c0c0c0',
  turquesa: '#06b6d4', celeste: '#7dd3fc',
  vino: '#7f1d1d', bordo: '#7f1d1d', bordó: '#7f1d1d',
}

function colorToCss(name?: string): string | null {
  if (!name) return null
  const n = name.trim().toLowerCase()
  if (COLOR_MAP[n]) return COLOR_MAP[n]
  // ¿es un color CSS válido directamente? (#hex, nombres en inglés)
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(n)) return n
  return null
}

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
  return {
    id: String(v.id),
    sku: v.sku,
    color: v.color?.trim() || undefined,
    colorHex: (v.colorHex ?? v.color_hex ?? undefined)?.trim() || undefined,
    size: v.size?.trim() || undefined,
    material: v.material?.trim() || undefined,
    available: Math.max(0, stock - reserved),
    priceOverride: num(v.price_override ?? v.priceOverride),
    tiers,
    image: images[0] || null,
  }
}

function variantUnitPrice(v: NormVariant, basePrice: number): number {
  if (v.priceOverride != null) return v.priceOverride
  if (v.tiers.length > 0) return v.tiers[0].price
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
  onChange,
  formatPrice,
}: {
  variants: RawVariant[]
  basePrice: number
  isLightBg?: boolean
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

  // Ejes presentes (con al menos un valor no vacío)
  const axes = useMemo(() => {
    return AXES.map(a => {
      const values = Array.from(new Set(norm.map(v => v[a.key]).filter(Boolean) as string[]))
      const label = a.key === 'size' ? sizeAxisLabel(values) : a.defaultLabel
      return { ...a, values, label }
    }).filter(a => a.values.length > 0)
  }, [norm])

  const [sel, setSel] = useState<Record<string, string>>({})

  // Reinicia la selección si cambia el set de variantes
  useEffect(() => { setSel({}) }, [variants])

  // ¿Existe alguna variante en stock consistente con `partial`?
  const hasStockFor = (partial: Record<string, string>): boolean =>
    norm.some(v => v.available > 0 && Object.entries(partial).every(([k, val]) => (v as any)[k] === val))

  // Variante resuelta: todos los ejes elegidos y coincide exactamente
  const selectedVariant = useMemo(() => {
    if (axes.length === 0) return null
    if (!axes.every(a => sel[a.key])) return null
    return norm.find(v => axes.every(a => (v as any)[a.key] === sel[a.key])) || null
  }, [norm, axes, sel])

  // Reporta al padre
  useEffect(() => {
    if (!onChange) return
    if (!selectedVariant) { onChange(null); return }
    const price = variantUnitPrice(selectedVariant, basePrice)
    const labelParts = axes.map(a => (selectedVariant as any)[a.key]).filter(Boolean)
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
  const chipActive = isLightBg
    ? 'border-black bg-black text-white'
    : 'border-white bg-white text-black'
  const chipDisabled = isLightBg
    ? 'border-black/10 text-black/25 line-through cursor-not-allowed'
    : 'border-white/10 text-white/25 line-through cursor-not-allowed'

  const toggle = (key: string, value: string) => {
    setSel(prev => (prev[key] === value ? (() => { const c = { ...prev }; delete c[key]; return c })() : { ...prev, [key]: value }))
  }

  // Precio a mostrar: variante elegida, o "Desde X" del rango
  const allPrices = norm.map(v => variantUnitPrice(v, basePrice))
  const minPrice = allPrices.length ? Math.min(...allPrices) : basePrice
  const selPrice = selectedVariant ? variantUnitPrice(selectedVariant, basePrice) : null

  return (
    <div className="space-y-4">
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
                const css = colorHexByName[val] || colorToCss(val) || (isLightBg ? '#5b5b5b' : '#cfcfcf')
                return (
                  <button
                    key={val}
                    type="button"
                    title={val + (available ? '' : ' (agotado)')}
                    disabled={!available}
                    onClick={() => toggle(axis.key, val)}
                    className={`relative w-9 h-9 rounded-full transition-all ${available ? 'cursor-pointer' : 'opacity-30 cursor-not-allowed'}`}
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
                    {!available && <span className="absolute inset-0 m-auto w-[120%] h-[1px] bg-current rotate-45 origin-center" />}
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
                return (
                  <button
                    key={val}
                    type="button"
                    disabled={!available}
                    onClick={() => toggle(axis.key, val)}
                    className={`px-4 py-2 rounded-full border-2 text-sm font-medium transition-all ${active ? chipActive : available ? chipIdle : chipDisabled}`}
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
            <p className="text-sm">
              {selectedVariant.available > 0 ? (
                <span className={selectedVariant.available <= 5 ? 'text-amber-500 font-medium' : strong}>
                  {selectedVariant.available <= 5 ? `¡Solo quedan ${selectedVariant.available}!` : `${selectedVariant.available} disponibles`}
                </span>
              ) : (
                <span className="text-red-500 font-medium">Agotado</span>
              )}
            </p>
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
