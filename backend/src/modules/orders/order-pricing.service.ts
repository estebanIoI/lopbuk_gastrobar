/**
 * order-pricing.service — capa de DB del blindaje de precios Nivel 2.
 *
 * Recalcula, server-side, el precio unitario autoritativo de CADA ítem del pedido y el
 * descuento del cupón, ignorando lo que mande el frontend. Reúne:
 *   - variantes (tiers de volumen + mix&match)  → delega en variantsService.resolveOrderPrices
 *   - productos sin variante / ofertas / drops  → resuelve acá con datos de la BD
 *   - cupones                                    → re-valida discount_coupons
 *
 * La aritmética vive en `order-pricing.ts` (puro, testeable). Acá solo se consultan datos
 * y se aplica. Todo es defensivo: ante cualquier fallo de consulta, respeta el precio
 * recibido / descuento 0 para nunca tumbar un pedido.
 */
import pool from '../../config/database'
import { variantsService } from '../variants/variants.service'
import {
  resolveNonVariantUnitPrice,
  resolveProductBasePrice,
  computeCouponDiscount,
  sumModifierDeltas,
  type ProductPricingData,
  type ResolvedModifierOption,
} from './order-pricing'

interface OrderItemLike {
  variantId?: string | null
  productId: number | string
  quantity: number
  unitPrice: number
  /** IDs de las opciones de modificador (adiciones) elegidas para este ítem. */
  modifierOptionIds?: string[] | null
}

class OrderPricingService {
  /**
   * Devuelve el precio unitario autoritativo de cada ítem, alineado por índice con `items`.
   * - Ítems CON variante: tier de volumen (mix&match) vía variantsService.
   * - Ítems SIN variante: drop activo > oferta activa > precio de lista, como piso
   *   (preservando extras del frontend como modificadores).
   */
  async resolveItemPrices(tenantId: string, items: OrderItemLike[]): Promise<number[]> {
    // 1) Variantes. Dos resoluciones:
    //    - legacy (con extra del frontend): fallback para ítems SIN IDs de modificador.
    //    - pura (solo tier): base para ítems CON IDs (los modificadores se suman aparte).
    let variantLegacy: number[] = []
    let variantPure: number[] = []
    try {
      variantLegacy = await variantsService.resolveOrderPrices(tenantId, items, true)
      variantPure = await variantsService.resolveOrderPrices(tenantId, items, false)
    } catch {
      variantLegacy = items.map((i) => Number(i.unitPrice) || 0)
      variantPure = variantLegacy
    }

    // 2) Datos de productos sin variante (precio de lista + oferta) y drops activos.
    const nonVariantIds = Array.from(
      new Set(items.filter((i) => !i.variantId).map((i) => String(i.productId)))
    )
    const productData = await this.fetchProductPricing(tenantId, nonVariantIds)
    const dropDiscounts = await this.fetchActiveDropDiscounts(tenantId, nonVariantIds)

    // 3) Modificadores: resolver los priceDelta reales de TODAS las opciones referenciadas.
    const allModIds = Array.from(
      new Set(items.flatMap((i) => (Array.isArray(i.modifierOptionIds) ? i.modifierOptionIds : [])))
    )
    const modOptions = await this.fetchModifierOptions(tenantId, allModIds)

    // 4) Resolver por ítem.
    return items.map((it, idx) => {
      const front = Number(it.unitPrice) || 0
      const hasMods = Array.isArray(it.modifierOptionIds) && it.modifierOptionIds.length > 0
      const pd = it.variantId ? null : productData.get(String(it.productId))

      // Precio base PURO (sin extras del frontend)
      const pureBase = it.variantId
        ? (variantPure[idx] ?? front)
        : pd
          ? resolveProductBasePrice({ ...pd, dropDiscountPct: dropDiscounts.get(String(it.productId)) ?? null })
          : front

      if (hasMods) {
        // Blindaje total: base autoritativo + deltas reales validados (ignora el precio del front)
        return pureBase + sumModifierDeltas(it.modifierOptionIds, it.productId, modOptions)
      }

      // Fallback (ítem sin IDs de modificador): comportamiento previo, preserva extras del front.
      if (it.variantId) return variantLegacy[idx] ?? front
      if (!pd) return front // producto no encontrado → no romper
      return resolveNonVariantUnitPrice(
        { ...pd, dropDiscountPct: dropDiscounts.get(String(it.productId)) ?? null },
        front
      )
    })
  }

  /** Opciones de modificador (priceDelta + producto dueño) por ID, validadas y activas. */
  private async fetchModifierOptions(
    tenantId: string,
    optionIds: string[]
  ): Promise<Map<string, ResolvedModifierOption>> {
    const map = new Map<string, ResolvedModifierOption>()
    if (optionIds.length === 0) return map
    try {
      const placeholders = optionIds.map(() => '?').join(',')
      const [rows] = (await pool.query(
        `SELECT o.id, o.price_delta AS priceDelta, g.product_id AS productId
         FROM product_modifier_options o
         JOIN product_modifier_groups g ON g.id = o.group_id
         WHERE o.tenant_id = ? AND o.is_active = 1 AND o.id IN (${placeholders})`,
        [tenantId, ...optionIds]
      )) as any[]
      for (const r of rows as any[]) {
        map.set(String(r.id), {
          id: String(r.id),
          priceDelta: Number(r.priceDelta) || 0,
          productId: String(r.productId),
        })
      }
    } catch {
      /* tablas ausentes → mapa vacío (no se suman modificadores) */
    }
    return map
  }

  /** Precio de lista + datos de oferta de los productos indicados. */
  private async fetchProductPricing(
    tenantId: string,
    productIds: string[]
  ): Promise<Map<string, ProductPricingData>> {
    const map = new Map<string, ProductPricingData>()
    if (productIds.length === 0) return map
    try {
      const placeholders = productIds.map(() => '?').join(',')
      const [rows] = (await pool.query(
        `SELECT id, sale_price AS salePrice, is_on_offer AS isOnOffer, offer_price AS offerPrice,
                offer_start AS offerStart, offer_end AS offerEnd
         FROM products WHERE tenant_id = ? AND id IN (${placeholders})`,
        [tenantId, ...productIds]
      )) as any[]
      for (const r of rows as any[]) {
        map.set(String(r.id), {
          salePrice: Number(r.salePrice) || 0,
          isOnOffer: r.isOnOffer,
          offerPrice: r.offerPrice != null ? Number(r.offerPrice) : null,
          offerStart: r.offerStart ?? null,
          offerEnd: r.offerEnd ?? null,
        })
      }
    } catch {
      /* tabla/columnas ausentes → mapa vacío, se respeta el precio del frontend */
    }
    return map
  }

  /**
   * Descuento % del drop ACTIVO (ventana vigente) que contiene a cada producto.
   * Si un producto está en varios drops activos, toma el mayor descuento.
   */
  private async fetchActiveDropDiscounts(
    tenantId: string,
    productIds: string[]
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>()
    if (productIds.length === 0) return map
    try {
      const placeholders = productIds.map(() => '?').join(',')
      const [rows] = (await pool.query(
        `SELECT sdp.product_id AS productId,
                COALESCE(sdp.custom_discount, sd.global_discount) AS discountPct
         FROM store_drop_products sdp
         JOIN store_drops sd ON sd.id = sdp.drop_id
         WHERE sd.tenant_id = ?
           AND sd.is_active = 1
           AND (sd.starts_at IS NULL OR sd.starts_at <= NOW())
           AND (sd.ends_at   IS NULL OR sd.ends_at   >= NOW())
           AND sdp.product_id IN (${placeholders})`,
        [tenantId, ...productIds]
      )) as any[]
      for (const r of rows as any[]) {
        const pid = String(r.productId)
        const pct = Number(r.discountPct) || 0
        if (pct > (map.get(pid) ?? 0)) map.set(pid, pct)
      }
    } catch {
      /* sin drops → mapa vacío */
    }
    return map
  }

  /**
   * Recalcula el descuento de un cupón contra el subtotal autoritativo. Espeja la
   * validación de `/coupons/validate` (cupones globales: sin filtro de tenant, igual que ahí).
   * Devuelve 0 si no hay código o el cupón no aplica.
   */
  async resolveCouponDiscount(code: string | null | undefined, subtotal: number): Promise<number> {
    if (!code) return 0
    try {
      const [rows] = (await pool.query(
        `SELECT discount_type AS discountType, discount_value AS discountValue,
                min_purchase AS minPurchase, expires_at AS expiresAt,
                max_uses AS maxUses, times_used AS timesUsed, is_active AS isActive
         FROM discount_coupons WHERE code = ? AND is_active = 1 LIMIT 1`,
        [String(code).toUpperCase()]
      )) as any[]
      if (!rows || rows.length === 0) return 0
      const r = rows[0] as any
      const { discount } = computeCouponDiscount(
        {
          discountType: r.discountType,
          discountValue: Number(r.discountValue),
          minPurchase: r.minPurchase != null ? Number(r.minPurchase) : null,
          expiresAt: r.expiresAt ?? null,
          maxUses: r.maxUses != null ? Number(r.maxUses) : null,
          timesUsed: r.timesUsed != null ? Number(r.timesUsed) : 0,
          isActive: r.isActive,
        },
        subtotal
      )
      return discount
    } catch {
      return 0
    }
  }
}

export const orderPricingService = new OrderPricingService()
