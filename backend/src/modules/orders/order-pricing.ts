/**
 * order-pricing — Resolución de precios AUTORITATIVA (server-side), pura y testeable.
 *
 * El frontend solo decide QUÉ se compra (producto, variante, cantidad). El precio
 * y el descuento del pedido se recalculan acá desde datos de la BD, ignorando lo que
 * mande el request. Estas funciones son puras (sin DB) para poder testearlas con
 * `node:test`; la capa de DB vive en `order-pricing.service.ts`.
 *
 * Capas cubiertas (Nivel 2 del blindaje de precios):
 *   - Productos sin variante  → precio base = products.sale_price
 *   - Ofertas                 → offer_price si la oferta está activa (ventana válida)
 *   - Drops                   → sale_price × (1 − descuento) si hay drop activo
 *   - Cupones                 → re-cálculo del descuento de carrito
 *
 * Precedencia de precio (igual que el frontend): drop > oferta > base.
 * (Las variantes con tiers de volumen se resuelven aparte en variants.service.)
 */

// ── Productos / ofertas / drops ────────────────────────────────────────────────

export interface ProductPricingData {
  /** products.sale_price */
  salePrice: number
  /** products.is_on_offer */
  isOnOffer?: boolean | number | null
  /** products.offer_price */
  offerPrice?: number | null
  /** products.offer_start (datetime) */
  offerStart?: string | null
  /** products.offer_end (datetime) */
  offerEnd?: string | null
  /** Descuento % del drop ACTIVO que contiene al producto (custom ?? global). null si no hay. */
  dropDiscountPct?: number | null
}

/** ¿`now` cae dentro de la ventana [start, end]? Nulls = sin límite por ese lado. */
export function isWindowActive(
  start: string | null | undefined,
  end: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (start && new Date(start).getTime() > now.getTime()) return false
  if (end && new Date(end).getTime() < now.getTime()) return false
  return true
}

/**
 * Precio base autoritativo de un producto SIN variante.
 * Precedencia: drop activo > oferta activa > precio de lista.
 */
export function resolveProductBasePrice(p: ProductPricingData, now: Date = new Date()): number {
  const sale = Number(p.salePrice) || 0

  // 1) Drop activo manda (el descuento ya viene resuelto: custom ?? global, y solo si hay drop vigente)
  if (p.dropDiscountPct != null && p.dropDiscountPct > 0 && sale > 0) {
    return Math.round(sale * (1 - Number(p.dropDiscountPct) / 100))
  }

  // 2) Oferta activa con ventana válida
  if (
    Boolean(Number(p.isOnOffer)) &&
    p.offerPrice != null &&
    Number(p.offerPrice) > 0 &&
    isWindowActive(p.offerStart, p.offerEnd, now)
  ) {
    return Number(p.offerPrice)
  }

  // 3) Precio de lista
  return sale
}

/**
 * Precio unitario final de un ítem SIN variante.
 * Impone el precio base autoritativo como PISO, pero preserva cualquier extra legítimo
 * que el frontend haya sumado por encima (p.ej. modificadores/adiciones — que todavía no
 * se validan server-side porque el pedido no trae sus IDs). Nunca cobra por debajo del base.
 */
export function resolveNonVariantUnitPrice(
  p: ProductPricingData,
  frontendUnitPrice: number,
  now: Date = new Date()
): number {
  const base = resolveProductBasePrice(p, now)
  const front = Number(frontendUnitPrice) || 0
  return Math.max(base, front)
}

// ── Modificadores (adiciones) ────────────────────────────────────────────────────

export interface ResolvedModifierOption {
  id: string
  priceDelta: number
  /** Producto al que pertenece la opción (vía su grupo) — para validar pertenencia. */
  productId: string
}

/**
 * Suma los `priceDelta` de las opciones de modificador seleccionadas, validando que
 * cada opción pertenezca al producto del ítem. Opciones ajenas/inexistentes se ignoran
 * (seguridad: nadie puede referenciar una opción de otro producto o inventada). Solo
 * suma deltas positivos legítimos resueltos desde la BD.
 */
export function sumModifierDeltas(
  selectedIds: string[] | undefined | null,
  productId: number | string,
  resolved: Map<string, ResolvedModifierOption>
): number {
  if (!Array.isArray(selectedIds) || selectedIds.length === 0) return 0
  let total = 0
  for (const rawId of selectedIds) {
    const o = resolved.get(String(rawId))
    if (o && String(o.productId) === String(productId)) {
      total += Number(o.priceDelta) || 0
    }
  }
  return total
}

// ── Cupones ─────────────────────────────────────────────────────────────────────

export interface CouponData {
  discountType: 'porcentaje' | 'fijo'
  discountValue: number
  minPurchase?: number | null
  expiresAt?: string | null
  maxUses?: number | null
  timesUsed?: number | null
  isActive?: boolean | number | null
}

export interface CouponResult {
  discount: number
  valid: boolean
  reason?: 'inactivo' | 'expirado' | 'limite' | 'min_compra'
}

/**
 * Recalcula el descuento de un cupón contra el subtotal AUTORITATIVO (ya con precios
 * de ítem blindados). Espeja la validación de `/coupons/validate` pero como función pura.
 * Devuelve discount=0 si el cupón no aplica.
 */
export function computeCouponDiscount(
  c: CouponData | null | undefined,
  subtotal: number,
  now: Date = new Date()
): CouponResult {
  if (!c || !Number(c.isActive ?? 1)) return { discount: 0, valid: false, reason: 'inactivo' }
  if (c.expiresAt && new Date(c.expiresAt).getTime() < now.getTime())
    return { discount: 0, valid: false, reason: 'expirado' }
  if (c.maxUses != null && Number(c.timesUsed ?? 0) >= Number(c.maxUses))
    return { discount: 0, valid: false, reason: 'limite' }
  if (c.minPurchase != null && subtotal < Number(c.minPurchase))
    return { discount: 0, valid: false, reason: 'min_compra' }

  let discount = 0
  if (c.discountType === 'porcentaje') {
    discount = Math.round(subtotal * (Number(c.discountValue) / 100))
  } else {
    discount = Math.min(Number(c.discountValue), subtotal)
  }
  // El descuento nunca supera el subtotal ni es negativo
  discount = Math.max(0, Math.min(discount, subtotal))
  return { discount, valid: true }
}
