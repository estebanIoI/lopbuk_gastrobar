import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config';
import { AppError } from '../../common/middleware';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

/**
 * Product Bundle Builder (Fase 3).
 *
 * Un bundle agrupa productos/variantes con un descuento y se ofrece en el PDP del
 * producto ancla. Regla de oro: el bundle guarda ESTRUCTURA (qué productos, qué
 * descuento), nunca precios del producto. El precio final y el ahorro se calculan
 * en runtime desde los precios reales de cada ítem. La disponibilidad se deriva
 * del stock real (variante si aplica, o producto − reservado).
 */

export type DiscountType = 'fixed_total' | 'percent' | 'amount_off';
export type BundleStatus = 'draft' | 'published' | 'archived';

export interface BundleItemInput {
  productId: string;
  variantId?: string | null;
  quantity?: number;
  sortOrder?: number;
}

export interface BundleInput {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  label?: string | null;
  discountType?: DiscountType;
  discountValue?: number;
  anchorProductId?: string | null;
  items?: BundleItemInput[];
}

export interface ResolvedBundleItem {
  id: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  sortOrder: number;
  name: string;
  variantName: string | null;
  imageUrl: string | null;
  unitPrice: number;      // precio efectivo (oferta si aplica / override de variante)
  lineRegular: number;    // unitPrice * quantity
  available: number;      // stock disponible real
  inStock: boolean;       // available >= quantity
}

export interface ResolvedBundle {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  label: string | null;
  discountType: DiscountType;
  discountValue: number;
  anchorProductId: string | null;
  status: BundleStatus;
  items: ResolvedBundleItem[];
  regularTotal: number;   // suma de precios normales
  bundlePrice: number;    // precio con descuento (nunca < 0)
  savings: number;        // regularTotal - bundlePrice
  savingsPct: number;
  inStock: boolean;       // todos los ítems disponibles
  createdAt: string;
  updatedAt: string;
}

const clamp0 = (n: number) => (n < 0 ? 0 : n);
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Precio final del bundle según su tipo de descuento (nunca negativo). */
export function computeBundlePrice(regularTotal: number, type: DiscountType, value: number): number {
  const v = Number(value) || 0;
  let price = regularTotal;
  if (type === 'percent') price = regularTotal * (1 - v / 100);
  else if (type === 'amount_off') price = regularTotal - v;
  else if (type === 'fixed_total') price = v;
  return round2(clamp0(price));
}

export class ProductBundlesService {
  // ── Resolución de ítems: precios y stock reales ─────────────────────────────
  private async resolveItems(tenantId: string, bundleId: string): Promise<ResolvedBundleItem[]> {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT bi.id, bi.product_id AS productId, bi.variant_id AS variantId,
              bi.quantity, bi.sort_order AS sortOrder,
              p.name, p.image_url AS imageUrl,
              p.sale_price AS salePrice, p.is_on_offer AS isOnOffer, p.offer_price AS offerPrice,
              p.stock AS pStock, p.reserved_stock AS pReserved,
              v.sku AS variantSku, v.price_override AS variantPrice,
              v.stock AS vStock, v.reserved_stock AS vReserved
         FROM product_bundle_items bi
         JOIN products p ON p.id = bi.product_id AND p.tenant_id = ?
         LEFT JOIN product_variants v ON v.id = bi.variant_id
        WHERE bi.bundle_id = ?
        ORDER BY bi.sort_order, bi.id`,
      [tenantId, bundleId]
    );

    return rows.map((r: any) => {
      const onOffer = Number(r.isOnOffer) === 1 && r.offerPrice != null;
      const base = onOffer ? Number(r.offerPrice) : Number(r.salePrice);
      const unitPrice = r.variantPrice != null ? Number(r.variantPrice) : base;
      const qty = Math.max(1, Number(r.quantity) || 1);
      const available = r.variantId
        ? clamp0(Number(r.vStock || 0) - Number(r.vReserved || 0))
        : clamp0(Number(r.pStock || 0) - Number(r.pReserved || 0));
      return {
        id: r.id,
        productId: r.productId,
        variantId: r.variantId || null,
        quantity: qty,
        sortOrder: Number(r.sortOrder) || 0,
        name: r.name,
        variantName: r.variantSku || null,
        imageUrl: r.imageUrl || null,
        unitPrice: round2(unitPrice),
        lineRegular: round2(unitPrice * qty),
        available,
        inStock: available >= qty,
      };
    });
  }

  private assemble(row: any, items: ResolvedBundleItem[]): ResolvedBundle {
    const regularTotal = round2(items.reduce((s, it) => s + it.lineRegular, 0));
    const bundlePrice = computeBundlePrice(regularTotal, row.discount_type, Number(row.discount_value));
    const savings = round2(clamp0(regularTotal - bundlePrice));
    return {
      id: row.id,
      name: row.name,
      description: row.description || null,
      imageUrl: row.image_url || null,
      label: row.label || null,
      discountType: row.discount_type,
      discountValue: Number(row.discount_value),
      anchorProductId: row.anchor_product_id || null,
      status: row.status,
      items,
      regularTotal,
      bundlePrice,
      savings,
      savingsPct: regularTotal > 0 ? Math.round((savings / regularTotal) * 100) : 0,
      inStock: items.length > 0 && items.every(it => it.inStock),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ── CRUD ────────────────────────────────────────────────────────────────────
  async list(tenantId: string): Promise<ResolvedBundle[]> {
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT * FROM product_bundles WHERE tenant_id = ? AND is_active = 1 ORDER BY updated_at DESC',
      [tenantId]
    );
    const out: ResolvedBundle[] = [];
    for (const row of rows) out.push(this.assemble(row, await this.resolveItems(tenantId, row.id)));
    return out;
  }

  async findById(tenantId: string, id: string): Promise<ResolvedBundle> {
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT * FROM product_bundles WHERE id = ? AND tenant_id = ? AND is_active = 1',
      [id, tenantId]
    );
    if (rows.length === 0) throw new AppError('Bundle no encontrado', 404);
    return this.assemble(rows[0], await this.resolveItems(tenantId, id));
  }

  private validate(input: BundleInput) {
    if (!input.name || !input.name.trim()) throw new AppError('El nombre es requerido', 400);
    const t = input.discountType || 'percent';
    const v = Number(input.discountValue) || 0;
    if (t === 'percent' && (v < 0 || v > 100)) throw new AppError('El porcentaje debe estar entre 0 y 100', 400);
    if (v < 0) throw new AppError('El descuento no puede ser negativo', 400);
  }

  private async replaceItems(bundleId: string, items: BundleItemInput[]): Promise<void> {
    await db.execute('DELETE FROM product_bundle_items WHERE bundle_id = ?', [bundleId]);
    let i = 0;
    for (const it of items) {
      if (!it.productId) continue;
      await db.execute(
        `INSERT INTO product_bundle_items (id, bundle_id, product_id, variant_id, quantity, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [uuidv4(), bundleId, it.productId, it.variantId || null, Math.max(1, Number(it.quantity) || 1), it.sortOrder ?? i]
      );
      i++;
    }
  }

  async create(tenantId: string, input: BundleInput): Promise<ResolvedBundle> {
    this.validate(input);
    const id = uuidv4();
    await db.execute(
      `INSERT INTO product_bundles
        (id, tenant_id, name, description, image_url, label, discount_type, discount_value, anchor_product_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
      [
        id, tenantId, input.name.trim(), input.description?.trim() || null, input.imageUrl?.trim() || null,
        input.label?.trim() || null, input.discountType || 'percent', Number(input.discountValue) || 0,
        input.anchorProductId || null,
      ]
    );
    if (input.items) await this.replaceItems(id, input.items);
    return this.findById(tenantId, id);
  }

  async update(tenantId: string, id: string, input: BundleInput): Promise<ResolvedBundle> {
    await this.findById(tenantId, id);
    this.validate(input);
    await db.execute(
      `UPDATE product_bundles
          SET name = ?, description = ?, image_url = ?, label = ?, discount_type = ?, discount_value = ?, anchor_product_id = ?
        WHERE id = ? AND tenant_id = ?`,
      [
        input.name.trim(), input.description?.trim() || null, input.imageUrl?.trim() || null,
        input.label?.trim() || null, input.discountType || 'percent', Number(input.discountValue) || 0,
        input.anchorProductId || null, id, tenantId,
      ]
    );
    if (input.items) await this.replaceItems(id, input.items);
    return this.findById(tenantId, id);
  }

  async setStatus(tenantId: string, id: string, status: BundleStatus): Promise<void> {
    const [r] = await db.execute<ResultSetHeader>(
      'UPDATE product_bundles SET status = ? WHERE id = ? AND tenant_id = ? AND is_active = 1',
      [status, id, tenantId]
    );
    if (r.affectedRows === 0) throw new AppError('Bundle no encontrado', 404);
  }

  async duplicate(tenantId: string, id: string): Promise<ResolvedBundle> {
    const orig = await this.findById(tenantId, id);
    return this.create(tenantId, {
      name: `${orig.name} (copia)`.slice(0, 160),
      description: orig.description, imageUrl: orig.imageUrl, label: orig.label,
      discountType: orig.discountType, discountValue: orig.discountValue,
      anchorProductId: orig.anchorProductId,
      items: orig.items.map(it => ({ productId: it.productId, variantId: it.variantId, quantity: it.quantity, sortOrder: it.sortOrder })),
    });
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const [r] = await db.execute<ResultSetHeader>(
      'UPDATE product_bundles SET is_active = 0 WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (r.affectedRows === 0) throw new AppError('Bundle no encontrado', 404);
  }

  /** Asigna el producto ancla (dónde aparece el bundle en el PDP). */
  async setAnchor(tenantId: string, id: string, anchorProductId: string | null): Promise<ResolvedBundle> {
    await this.findById(tenantId, id);
    await db.execute(
      'UPDATE product_bundles SET anchor_product_id = ? WHERE id = ? AND tenant_id = ?',
      [anchorProductId, id, tenantId]
    );
    return this.findById(tenantId, id);
  }

  // ── Público: bundles publicados que aplican al PDP de un producto ────────────
  // (ancla = este producto, o sin ancla y el producto es uno de los ítems)
  async getPublicForProduct(productId: string): Promise<ResolvedBundle[]> {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT DISTINCT b.*
         FROM product_bundles b
         LEFT JOIN product_bundle_items bi ON bi.bundle_id = b.id
        WHERE b.status = 'published' AND b.is_active = 1
          AND (b.anchor_product_id = ? OR (b.anchor_product_id IS NULL AND bi.product_id = ?))
        ORDER BY b.updated_at DESC`,
      [productId, productId]
    );
    const out: ResolvedBundle[] = [];
    for (const row of rows) {
      const items = await this.resolveItems(row.tenant_id, row.id);
      const resolved = this.assemble(row, items);
      // Solo se ofrecen bundles disponibles y con ítems
      if (resolved.items.length > 0 && resolved.inStock) out.push(resolved);
    }
    return out;
  }
}

export const productBundlesService = new ProductBundlesService();
