/**
 * qty-promo — Promociones de cantidad del MISMO producto (tipo "2da unidad con
 * descuento" y niveles por cantidad). Unifica ambos motores en un solo cálculo.
 *
 * Importante: el backend de pedidos confía en el `unitPrice` que envía el carrito
 * (total = unitPrice·quantity). Por eso la promo se materializa como un **precio
 * unitario combinado** (total del combo ÷ cantidad) — así el cobro siempre cuadra
 * sin tocar la lógica de pedido.
 */

export interface QtyTier {
  /** Cantidad mínima para activar el nivel. */
  minQty: number
  /** % de descuento sobre el precio unitario al alcanzar minQty. */
  discountPct: number
}

export interface QtyPromo {
  /** % de descuento aplicado a la 2da unidad (y cada 2da unidad del par). */
  secondUnitPct?: number
  /** Niveles por cantidad. */
  tiers?: QtyTier[]
}

export interface QtyPromoOption {
  qty: number
  /** Precio total del combo para esa cantidad. */
  total: number
  /** Precio unitario combinado (total ÷ qty) — es lo que se manda al carrito. */
  unitPrice: number
  /** Ahorro vs comprar qty unidades a precio lleno. */
  savings: number
  discountPct: number
  label: string
  sublabel?: string
}

const round = (n: number) => Math.round(n)

/** Parsea el qty_promo que llega del backend (string JSON | objeto | null). */
export function parseQtyPromo(raw: unknown): QtyPromo | null {
  if (!raw) return null
  let obj: any = raw
  if (typeof raw === 'string') {
    try { obj = JSON.parse(raw) } catch { return null }
  }
  if (!obj || typeof obj !== 'object') return null
  const secondUnitPct = Number(obj.secondUnitPct) > 0 ? Number(obj.secondUnitPct) : undefined
  const tiers: QtyTier[] = Array.isArray(obj.tiers)
    ? obj.tiers
        .map((t: any) => ({ minQty: Number(t.minQty), discountPct: Number(t.discountPct) }))
        .filter((t: QtyTier) => t.minQty >= 2 && t.discountPct > 0)
    : []
  if (!secondUnitPct && tiers.length === 0) return null
  return { secondUnitPct, tiers }
}

export function hasQtyPromo(p?: QtyPromo | null): boolean {
  if (!p) return false
  return (!!p.secondUnitPct && p.secondUnitPct > 0) || !!(p.tiers && p.tiers.some(t => t.minQty >= 2 && t.discountPct > 0))
}

/**
 * Devuelve las opciones de compra (incluida "Compra 1") ordenadas por cantidad.
 * `base` es el precio unitario lleno (oferta/variante ya resuelta).
 */
export function qtyPromoOptions(base: number, promo?: QtyPromo | null): QtyPromoOption[] {
  const opts = new Map<number, QtyPromoOption>()

  // Opción base: 1 unidad
  opts.set(1, { qty: 1, total: base, unitPrice: base, savings: 0, discountPct: 0, label: 'Compra 1 unidad' })

  if (promo?.secondUnitPct && promo.secondUnitPct > 0) {
    const pct = Math.min(100, promo.secondUnitPct)
    const total = round(base + base * (1 - pct / 100)) // 1ra llena + 2da con descuento
    const savings = round(base * 2 - total)
    opts.set(2, {
      qty: 2,
      total,
      unitPrice: round(total / 2),
      savings,
      discountPct: pct,
      label: 'Compra 2 unidades',
      sublabel: `La 2da unidad con ${pct}% menos`,
    })
  }

  for (const t of promo?.tiers ?? []) {
    if (t.minQty < 2 || t.discountPct <= 0) continue
    const pct = Math.min(100, t.discountPct)
    const total = round(t.minQty * base * (1 - pct / 100))
    const savings = round(t.minQty * base - total)
    const existing = opts.get(t.minQty)
    if (!existing || total < existing.total) {
      opts.set(t.minQty, {
        qty: t.minQty,
        total,
        unitPrice: round(total / t.minQty),
        savings,
        discountPct: pct,
        label: `Compra ${t.minQty} unidades`,
        sublabel: `${pct}% de descuento`,
      })
    }
  }

  return Array.from(opts.values()).sort((a, b) => a.qty - b.qty)
}

/**
 * Precio unitario combinado para una línea de carrito de cantidad arbitraria.
 * Escala la promo a cualquier `qty` (no solo a las opciones discretas):
 *  - secondUnitPct → cada 2da unidad del par con descuento (floor(qty/2) pares).
 *  - tiers → mejor nivel alcanzado (minQty ≤ qty) descuenta TODAS las unidades.
 * Se elige el total más bajo entre ambas estrategias. Devuelve `base` si no aplica.
 */
export function qtyPromoUnit(base: number, qty: number, promo?: QtyPromo | null): number {
  if (!promo || qty < 2 || base <= 0) return base
  const full = base * qty
  let best = full

  if (promo.secondUnitPct && promo.secondUnitPct > 0) {
    const pct = Math.min(100, promo.secondUnitPct)
    const pairs = Math.floor(qty / 2)
    const singles = qty - pairs * 2
    const total = round(pairs * (base + base * (1 - pct / 100)) + singles * base)
    if (total < best) best = total
  }

  let bestTierPct = 0
  for (const t of promo.tiers ?? []) {
    if (t.minQty >= 2 && t.discountPct > 0 && qty >= t.minQty && t.discountPct > bestTierPct) {
      bestTierPct = Math.min(100, t.discountPct)
    }
  }
  if (bestTierPct > 0) {
    const total = round(base * qty * (1 - bestTierPct / 100))
    if (total < best) best = total
  }

  return round(best / qty)
}
