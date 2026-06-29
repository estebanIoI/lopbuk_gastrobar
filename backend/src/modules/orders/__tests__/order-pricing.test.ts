/**
 * Tests · order-pricing (runner nativo node:test, sin deps, funciones puras).
 * Cubre las 4 capas del blindaje Nivel 2 resolubles en backend:
 *   productos sin variante · ofertas · drops · cupones.
 *
 * Ejecutar (sobre el JS transpilado):  node --test dist/modules/orders/__tests__/
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  isWindowActive,
  resolveProductBasePrice,
  resolveNonVariantUnitPrice,
  computeCouponDiscount,
  sumModifierDeltas,
  type ResolvedModifierOption,
} from '../order-pricing'

const NOW = new Date('2026-06-29T12:00:00Z')

// ── isWindowActive ──────────────────────────────────────────────────────────────
test('isWindowActive: sin límites → activo', () => {
  assert.equal(isWindowActive(null, null, NOW), true)
})
test('isWindowActive: antes del inicio → inactivo', () => {
  assert.equal(isWindowActive('2026-07-01T00:00:00Z', null, NOW), false)
})
test('isWindowActive: después del fin → inactivo', () => {
  assert.equal(isWindowActive(null, '2026-06-01T00:00:00Z', NOW), false)
})
test('isWindowActive: dentro de la ventana → activo', () => {
  assert.equal(isWindowActive('2026-06-01T00:00:00Z', '2026-07-01T00:00:00Z', NOW), true)
})

// ── Capa: productos sin variante (precio de lista) ───────────────────────────────
test('producto base: sin oferta ni drop → sale_price', () => {
  assert.equal(resolveProductBasePrice({ salePrice: 98000 }, NOW), 98000)
})

// ── Capa: ofertas ────────────────────────────────────────────────────────────────
test('oferta activa → offer_price', () => {
  const price = resolveProductBasePrice(
    { salePrice: 98000, isOnOffer: 1, offerPrice: 70000, offerStart: '2026-06-01', offerEnd: '2026-07-01' },
    NOW
  )
  assert.equal(price, 70000)
})
test('oferta fuera de ventana → ignora offer_price, usa sale_price', () => {
  const price = resolveProductBasePrice(
    { salePrice: 98000, isOnOffer: 1, offerPrice: 70000, offerEnd: '2026-06-01' },
    NOW
  )
  assert.equal(price, 98000)
})
test('is_on_offer=0 → ignora offer_price aunque esté seteado', () => {
  const price = resolveProductBasePrice({ salePrice: 98000, isOnOffer: 0, offerPrice: 70000 }, NOW)
  assert.equal(price, 98000)
})

// ── Capa: drops ──────────────────────────────────────────────────────────────────
test('drop activo → sale_price × (1 − descuento)', () => {
  const price = resolveProductBasePrice({ salePrice: 100000, dropDiscountPct: 40 }, NOW)
  assert.equal(price, 60000)
})
test('drop tiene precedencia sobre oferta', () => {
  const price = resolveProductBasePrice(
    { salePrice: 100000, dropDiscountPct: 40, isOnOffer: 1, offerPrice: 80000 },
    NOW
  )
  assert.equal(price, 60000) // drop (60k) gana sobre oferta (80k)
})

// ── Precio unitario final (piso autoritativo + preserva extras) ──────────────────
test('unitPrice: manipulación a la baja → impone el base', () => {
  // Atacante manda $1; el base es 98000 → se reimpone
  const price = resolveNonVariantUnitPrice({ salePrice: 98000 }, 1, NOW)
  assert.equal(price, 98000)
})
test('unitPrice: extra legítimo por encima del base (modificador) → se preserva', () => {
  // base 98000 + adición 5000 = 103000 → se respeta
  const price = resolveNonVariantUnitPrice({ salePrice: 98000 }, 103000, NOW)
  assert.equal(price, 103000)
})
test('unitPrice: oferta activa + intento de pagar el de lista → cobra al menos la oferta', () => {
  const price = resolveNonVariantUnitPrice(
    { salePrice: 98000, isOnOffer: 1, offerPrice: 70000, offerEnd: '2026-07-01' },
    70000,
    NOW
  )
  assert.equal(price, 70000)
})

// ── Capa: modificadores (adiciones) ──────────────────────────────────────────────
const MODS = new Map<string, ResolvedModifierOption>([
  ['o1', { id: 'o1', priceDelta: 5000, productId: 'P1' }],
  ['o2', { id: 'o2', priceDelta: 3000, productId: 'P1' }],
  ['oX', { id: 'oX', priceDelta: 9000, productId: 'P2' }], // de OTRO producto
])
test('modificadores: suma deltas de opciones del producto', () => {
  assert.equal(sumModifierDeltas(['o1', 'o2'], 'P1', MODS), 8000)
})
test('modificadores: ignora opción de otro producto (seguridad)', () => {
  // oX pertenece a P2 → no debe sumarse al ítem de P1 aunque el front lo mande
  assert.equal(sumModifierDeltas(['o1', 'oX'], 'P1', MODS), 5000)
})
test('modificadores: ID inexistente se ignora', () => {
  assert.equal(sumModifierDeltas(['o1', 'fantasma'], 'P1', MODS), 5000)
})
test('modificadores: sin selección → 0', () => {
  assert.equal(sumModifierDeltas(undefined, 'P1', MODS), 0)
  assert.equal(sumModifierDeltas([], 'P1', MODS), 0)
})

// ── Capa: cupones ────────────────────────────────────────────────────────────────
test('cupón porcentaje → redondeo', () => {
  const r = computeCouponDiscount({ discountType: 'porcentaje', discountValue: 10 }, 103000, NOW)
  assert.deepEqual(r, { discount: 10300, valid: true })
})
test('cupón fijo → tope al subtotal', () => {
  const r = computeCouponDiscount({ discountType: 'fijo', discountValue: 50000 }, 30000, NOW)
  assert.equal(r.discount, 30000) // no descuenta más que el subtotal
})
test('cupón expirado → 0', () => {
  const r = computeCouponDiscount(
    { discountType: 'fijo', discountValue: 50000, expiresAt: '2026-06-01' },
    100000,
    NOW
  )
  assert.deepEqual(r, { discount: 0, valid: false, reason: 'expirado' })
})
test('cupón sin alcanzar compra mínima → 0', () => {
  const r = computeCouponDiscount(
    { discountType: 'porcentaje', discountValue: 10, minPurchase: 200000 },
    100000,
    NOW
  )
  assert.equal(r.valid, false)
  assert.equal(r.reason, 'min_compra')
})
test('cupón con límite de usos agotado → 0', () => {
  const r = computeCouponDiscount(
    { discountType: 'fijo', discountValue: 10000, maxUses: 5, timesUsed: 5 },
    100000,
    NOW
  )
  assert.equal(r.reason, 'limite')
})
test('cupón inactivo → 0', () => {
  const r = computeCouponDiscount({ discountType: 'fijo', discountValue: 10000, isActive: 0 }, 100000, NOW)
  assert.equal(r.reason, 'inactivo')
})
