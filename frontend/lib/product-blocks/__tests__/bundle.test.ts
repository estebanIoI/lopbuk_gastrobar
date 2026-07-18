import { describe, it, expect } from 'vitest'
import { getBlock, blockDefaults, parseSettings, BLOCK_TYPES } from '../registry'

/**
 * El bloque `bundle` integra el Bundle Builder con el Product Experience Builder.
 * La lógica de precio vive en el backend (product-bundles.service); aquí se
 * verifica el contrato del bloque y que replique la fórmula de reparto que usa
 * el carrito, porque un descuadre se traduce en cobrar de más o de menos.
 */

// Espejo de la fórmula del backend (computeBundlePrice) — debe coincidir.
function computeBundlePrice(regular: number, type: string, value: number): number {
  const v = Number(value) || 0
  let p = regular
  if (type === 'percent') p = regular * (1 - v / 100)
  else if (type === 'amount_off') p = regular - v
  else if (type === 'fixed_total') p = v
  return Math.round(Math.max(0, p) * 100) / 100
}

// Espejo del reparto que hace addBundleToCart / agregarBundleAlCarrito.
function distribute(items: Array<{ unitPrice: number; quantity: number }>, bundlePrice: number) {
  const regular = items.reduce((s, it) => s + it.unitPrice * it.quantity, 0)
  const ratio = regular > 0 ? bundlePrice / regular : 1
  const lines = items.map(it => ({ qty: it.quantity, unit: Math.round(it.unitPrice * ratio) }))
  const summed = lines.reduce((s, l) => s + l.unit * l.qty, 0)
  const last = lines[lines.length - 1]
  last.unit = Math.max(0, last.unit + Math.round((bundlePrice - summed) / last.qty))
  return lines
}

describe('Bundle · bloque en el registry', () => {
  it('está registrado y expone el contrato completo', () => {
    expect(BLOCK_TYPES).toContain('bundle')
    const b = getBlock('bundle')!
    expect(b.category).toBe('conversion')
    expect(typeof b.Render).toBe('function')
    expect(typeof b.Editor).toBe('function')
  })
  it('defaults estables y tolerante a basura', () => {
    expect(blockDefaults('bundle').title).toBeTypeOf('string')
    for (const v of [null, 'x', 42, { maxBundles: 'no' }]) {
      expect(() => parseSettings('bundle', v)).not.toThrow()
    }
  })
})

describe('Bundle · cálculo de precio (fórmula compartida backend/carrito)', () => {
  it('percent: 20% sobre 100.000 = 80.000', () => {
    expect(computeBundlePrice(100000, 'percent', 20)).toBe(80000)
  })
  it('amount_off: 100.000 − 30.000 = 70.000', () => {
    expect(computeBundlePrice(100000, 'amount_off', 30000)).toBe(70000)
  })
  it('fixed_total: precio final fijo', () => {
    expect(computeBundlePrice(100000, 'fixed_total', 89900)).toBe(89900)
  })
  it('nunca negativo', () => {
    expect(computeBundlePrice(50000, 'amount_off', 80000)).toBe(0)
    expect(computeBundlePrice(50000, 'percent', 150)).toBe(0)
  })
})

describe('Bundle · reparto en el carrito suma EXACTO el precio del combo', () => {
  it('reparto proporcional con ajuste de redondeo (2 ítems)', () => {
    const items = [{ unitPrice: 59900, quantity: 1 }, { unitPrice: 109900, quantity: 1 }]
    const regular = 169800
    const price = computeBundlePrice(regular, 'percent', 15) // 144330
    const lines = distribute(items, price)
    const total = lines.reduce((s, l) => s + l.unit * l.qty, 0)
    expect(total).toBe(price)
  })
  it('reparto con cantidades > 1 cuadra exacto', () => {
    const items = [{ unitPrice: 89966, quantity: 3 }]
    const price = computeBundlePrice(269898, 'fixed_total', 249900)
    const lines = distribute(items, price)
    const total = lines.reduce((s, l) => s + l.unit * l.qty, 0)
    expect(total).toBe(price)
  })
  it('tres ítems dispares cuadran al centavo redondeado', () => {
    const items = [
      { unitPrice: 33333, quantity: 1 },
      { unitPrice: 33333, quantity: 2 },
      { unitPrice: 100001, quantity: 1 },
    ]
    const regular = 33333 + 66666 + 100001
    const price = computeBundlePrice(regular, 'percent', 17)
    const lines = distribute(items, price)
    const total = lines.reduce((s, l) => s + l.unit * l.qty, 0)
    expect(total).toBe(price)
  })
})
