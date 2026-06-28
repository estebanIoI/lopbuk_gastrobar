import { v4 as uuidv4 } from 'uuid';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { db } from '../../config';
import { ProductVariant, VariantPriceTier, ResolvedPrice, InventoryMovement } from '../../common/types';
import { AppError } from '../../common/middleware';
import { hormasService } from '../hormas/hormas.service';

const MAX_VARIANT_IMAGES = 4;

// ─── Row interfaces ───────────────────────────────────────────────────────────

interface VariantRow extends RowDataPacket {
  id: string; tenant_id: string; product_id: string;
  sku: string; barcode: string | null;
  color: string | null; color_hex: string | null; size: string | null; material: string | null;
  stock: number; reserved_stock: number; min_stock: number;
  cost_price: number | null; price_override: number | null;
  supplier_id: string | null; images: string | null;
  sort_order: number; is_active: number;
  preorder_limit: number | null; preorder_count: number | null;
  horma_id: string | null;
  created_at: Date; updated_at: Date;
  // joined
  product_name: string | null; base_price: number | null; horma_name: string | null;
}

interface TierRow extends RowDataPacket {
  id: string; tenant_id: string; variant_id: string;
  min_qty: number; price: number; tenant_margin_pct: number;
  is_active: number; created_at: Date; updated_at: Date;
}

interface MovRow extends RowDataPacket {
  id: string; tenant_id: string; variant_id: string | null;
  product_id: string; type: string; quantity: number;
  reason: string; reference_type: string | null; reference_id: string | null;
  created_by: string | null; created_at: Date;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapVariant(row: VariantRow): ProductVariant {
  const color = row.color ?? undefined;
  const size  = row.size  ?? undefined;
  const label = [color, size].filter(Boolean).join(' / ') || undefined;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    productId: row.product_id,
    sku: row.sku,
    barcode: row.barcode ?? undefined,
    color,
    colorHex: row.color_hex ?? undefined,
    size,
    material: row.material ?? undefined,
    stock: Number(row.stock),
    reservedStock: Number(row.reserved_stock),
    minStock: Number(row.min_stock),
    costPrice: row.cost_price != null ? Number(row.cost_price) : undefined,
    priceOverride: row.price_override != null ? Number(row.price_override) : undefined,
    supplierId: row.supplier_id ?? undefined,
    images: row.images
      ? (typeof row.images === 'string' ? JSON.parse(row.images) : row.images)
      : undefined,
    sortOrder: row.sort_order,
    isActive: Boolean(row.is_active),
    preorderLimit: row.preorder_limit != null ? Number(row.preorder_limit) : null,
    preorderCount: row.preorder_count != null ? Number(row.preorder_count) : 0,
    hormaId: row.horma_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    productName: row.product_name ?? undefined,
    basePrice: row.base_price != null ? Number(row.base_price) : undefined,
    hormaName: row.horma_name ?? undefined,
    label,
  };
}

function mapTier(row: TierRow): VariantPriceTier {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    variantId: row.variant_id,
    minQty: row.min_qty,
    price: Number(row.price),
    tenantMarginPct: Number(row.tenant_margin_pct),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMovement(row: MovRow): InventoryMovement {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    variantId: row.variant_id ?? undefined,
    productId: row.product_id,
    type: row.type as any,
    quantity: Number(row.quantity),
    reason: row.reason,
    referenceType: row.reference_type ?? undefined,
    referenceId: row.reference_id ?? undefined,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class VariantsService {

  // Auto-migración idempotente: crea las tablas de variantes/proveedores si no existen.
  // El esquema "oficial" vive en src/migrations/004_variants_and_suppliers.sql,
  // pero esa migración debe correrse a mano — en tenants donde nunca se ejecutó,
  // product_variants/variant_price_tiers/inventory_movements/suppliers no existían
  // (ER_NO_SUCH_TABLE). Este auto-heal evita depender de ese paso manual.
  // Público porque otros services (import.service, suppliers.service) también
  // tocan estas mismas tablas directamente.
  private tablesEnsured = false;
  async ensureTables(): Promise<void> {
    if (this.tablesEnsured) return;
    // Las queries de variantes hacen LEFT JOIN a `hormas` (horma_id por variante) —
    // hay que asegurar que esa tabla exista antes, sin importar quién pidió primero.
    await hormasService.ensureTables();
    await db.query(`CREATE TABLE IF NOT EXISTS suppliers (
      id            VARCHAR(36)  NOT NULL PRIMARY KEY,
      tenant_id     VARCHAR(36)  NOT NULL,
      name          VARCHAR(255) NOT NULL,
      contact_info  TEXT,
      phone         VARCHAR(50),
      email         VARCHAR(255),
      payment_terms TEXT,
      is_active     TINYINT(1)   DEFAULT 1,
      created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
      updated_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_suppliers_tenant (tenant_id, is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await db.query(`CREATE TABLE IF NOT EXISTS supplier_products (
      id              VARCHAR(36)  NOT NULL PRIMARY KEY,
      supplier_id     VARCHAR(36)  NOT NULL,
      product_id      VARCHAR(36)  NOT NULL,
      supplier_sku    VARCHAR(100),
      cost_price      DECIMAL(12,2) DEFAULT 0,
      lead_time_days  INT          DEFAULT 0,
      is_preferred    TINYINT(1)   DEFAULT 0,
      is_active       TINYINT(1)   DEFAULT 1,
      created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_sp_supplier (supplier_id),
      INDEX idx_sp_product (product_id),
      INDEX idx_sp_supplier_product (supplier_id, product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await db.query(`CREATE TABLE IF NOT EXISTS product_variants (
      id              VARCHAR(36)  NOT NULL PRIMARY KEY,
      tenant_id       VARCHAR(36)  NOT NULL,
      product_id      VARCHAR(36)  NOT NULL,
      sku             VARCHAR(100) NOT NULL,
      barcode         VARCHAR(100),
      color           VARCHAR(100),
      color_hex       VARCHAR(9),
      size            VARCHAR(50),
      material        VARCHAR(100),
      stock           INT          DEFAULT 0,
      reserved_stock  INT          DEFAULT 0,
      min_stock       INT          DEFAULT 0,
      cost_price      DECIMAL(12,2) DEFAULT 0,
      price_override  DECIMAL(12,2),
      supplier_id     VARCHAR(36),
      images          JSON,
      sort_order      INT          DEFAULT 0,
      is_active       TINYINT(1)   DEFAULT 1,
      preorder_limit  INT NULL COMMENT 'Cupo máximo de preventa (NULL = ilimitado)',
      preorder_count  INT NOT NULL DEFAULT 0 COMMENT 'Unidades vendidas/reservadas en preventa',
      horma_id        VARCHAR(36) NULL COMMENT 'Horma de ESTA variante — un producto puede tener variantes en distintas hormas',
      created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_pv_product (product_id),
      INDEX idx_pv_tenant_product (tenant_id, product_id),
      INDEX idx_pv_supplier (supplier_id),
      INDEX idx_pv_sku (tenant_id, sku),
      INDEX idx_pv_horma (horma_id),
      UNIQUE KEY uk_pv_sku_tenant (sku, tenant_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await db.query(`CREATE TABLE IF NOT EXISTS variant_price_tiers (
      id                VARCHAR(36)  NOT NULL PRIMARY KEY,
      tenant_id         VARCHAR(36)  NOT NULL,
      variant_id        VARCHAR(36)  NOT NULL,
      min_qty           INT          NOT NULL DEFAULT 1,
      price             DECIMAL(12,2) NOT NULL,
      tenant_margin_pct DECIMAL(5,2) DEFAULT 0,
      is_active         TINYINT(1)   DEFAULT 1,
      created_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
      updated_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_vpt_variant (variant_id),
      INDEX idx_vpt_variant_minqty (variant_id, tenant_id, min_qty),
      INDEX idx_vpt_tenant (tenant_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await db.query(`CREATE TABLE IF NOT EXISTS inventory_movements (
      id              VARCHAR(36)  NOT NULL PRIMARY KEY,
      tenant_id       VARCHAR(36)  NOT NULL,
      variant_id      VARCHAR(36),
      product_id      VARCHAR(36)  NOT NULL,
      type            ENUM('entrada','salida','ajuste','merma','transferencia','reserva','liberacion') NOT NULL,
      quantity        INT          NOT NULL,
      reason          TEXT         NOT NULL,
      reference_type  VARCHAR(50),
      reference_id    VARCHAR(36),
      created_by      VARCHAR(36),
      created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_im_variant (variant_id),
      INDEX idx_im_product (product_id),
      INDEX idx_im_tenant (tenant_id),
      INDEX idx_im_created (tenant_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    // Si estas tablas ya habían quedado creadas (por una corrida anterior de este
    // mismo auto-heal, antes de fijar el COLLATE arriba) con el collation default
    // del servidor (ej. utf8mb4_0900_ai_ci en MySQL 8), cualquier JOIN/WHERE contra
    // `products` (utf8mb4_unicode_ci) truena con ER_CANT_AGGREGATE_2COLLATIONS.
    // Forzamos el collation correcto de forma idempotente (no-op si ya coincide).
    for (const t of ['suppliers', 'supplier_products', 'product_variants', 'variant_price_tiers', 'inventory_movements']) {
      try {
        await db.query(`ALTER TABLE ${t} CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      } catch (e: any) {
        console.error(`[variants.ensureTables] No se pudo fijar collation de ${t}:`, e?.message || e);
      }
    }

    // products.base_price: fallback de precio que usa resolvePrice() cuando la
    // variante no tiene price_override ni tiers. Si la tabla products es vieja
    // (sin esta columna) la rellenamos desde sale_price.
    try {
      await db.query('ALTER TABLE products ADD COLUMN base_price DECIMAL(12,2) NULL');
      await db.query('UPDATE products SET base_price = sale_price WHERE base_price IS NULL');
    } catch (e: any) {
      if (e?.errno !== 1060) { /* 1060 = columna ya existe */ }
    }

    // horma_id por variante: si product_variants YA existía (de antes de este cambio),
    // el CREATE TABLE IF NOT EXISTS de arriba no le agrega la columna — hay que alterarla.
    try {
      await db.query("ALTER TABLE product_variants ADD COLUMN horma_id VARCHAR(36) NULL COMMENT 'Horma de ESTA variante'");
      await db.query('ALTER TABLE product_variants ADD INDEX idx_pv_horma (horma_id)');
      // Backfill: si el producto ya tenía una sola horma (products.horma_id), úsala
      // como punto de partida para sus variantes existentes sin horma propia.
      await db.query(`
        UPDATE product_variants pv
        JOIN products p ON p.id = pv.product_id
        SET pv.horma_id = p.horma_id
        WHERE pv.horma_id IS NULL AND p.horma_id IS NOT NULL
      `);
    } catch (e: any) {
      if (e?.errno !== 1060) { /* 1060 = columna/índice ya existe */ }
    }

    // ── Limpieza única de SKUs bloqueados ───────────────────────────────────
    // 1) Variantes huérfanas: su producto ya no existe (porque products.delete()
    //    antes no las borraba). Quedaban "activas" ocupando su SKU para siempre.
    // 2) Variantes desactivadas de antes de este fix, que softDelete() aún no
    //    había renombrado. Libera su SKU para que se pueda reusar.
    try {
      await db.query(`
        DELETE vpt FROM variant_price_tiers vpt
        LEFT JOIN product_variants pv ON pv.id = vpt.variant_id
        WHERE pv.id IS NULL
      `);
      await db.query(`
        DELETE pv FROM product_variants pv
        LEFT JOIN products p ON p.id = pv.product_id
        WHERE p.id IS NULL
      `);
      await db.query(`
        UPDATE product_variants
        SET sku = CONCAT(sku, '-DEL-', SUBSTRING(id, 1, 8))
        WHERE is_active = 0 AND sku NOT LIKE '%-DEL-%'
      `);
    } catch (e: any) {
      console.error('[variants.ensureTables] limpieza de SKUs bloqueados falló:', e?.message || e);
    }

    this.tablesEnsured = true;
  }

  // ── Variants CRUD ──────────────────────────────────────────────────────────

  /**
   * Todas las variantes activas del tenant, en un solo viaje (sin eager-load de tiers,
   * a propósito — esto alimenta el resumen de "stock total" y "colores" en la tabla
   * de inventario, que necesita ser liviano para todos los productos a la vez).
   */
  async findAllByTenant(tenantId: string): Promise<ProductVariant[]> {
    await this.ensureTables();
    const [rows] = await db.execute<VariantRow[]>(
      `SELECT pv.*, p.name AS product_name, COALESCE(p.base_price, p.sale_price) AS base_price, h.name AS horma_name
       FROM product_variants pv
       LEFT JOIN products p ON p.id = pv.product_id
       LEFT JOIN hormas h ON h.id = pv.horma_id
       WHERE pv.tenant_id = ? AND pv.is_active = 1
       ORDER BY pv.product_id, pv.sort_order ASC, pv.created_at ASC`,
      [tenantId]
    );
    return rows.map(mapVariant);
  }

  async findByProduct(productId: string, tenantId: string): Promise<ProductVariant[]> {
    await this.ensureTables();
    const [rows] = await db.execute<VariantRow[]>(
      `SELECT pv.*, p.name AS product_name, COALESCE(p.base_price, p.sale_price) AS base_price, h.name AS horma_name
       FROM product_variants pv
       LEFT JOIN products p ON p.id = pv.product_id
       LEFT JOIN hormas h ON h.id = pv.horma_id
       WHERE pv.product_id = ? AND pv.tenant_id = ? AND pv.is_active = 1
       ORDER BY pv.sort_order ASC, pv.created_at ASC`,
      [productId, tenantId]
    );
    const variants = rows.map(mapVariant);

    // Eager-load tiers
    for (const v of variants) {
      v.priceTiers = await this.findTiersByVariant(v.id, tenantId);
    }
    return variants;
  }

  async findById(id: string, tenantId: string): Promise<ProductVariant> {
    await this.ensureTables();
    const [rows] = await db.execute<VariantRow[]>(
      `SELECT pv.*, p.name AS product_name, COALESCE(p.base_price, p.sale_price) AS base_price, h.name AS horma_name
       FROM product_variants pv
       LEFT JOIN products p ON p.id = pv.product_id
       LEFT JOIN hormas h ON h.id = pv.horma_id
       WHERE pv.id = ? AND pv.tenant_id = ? AND pv.is_active = 1`,
      [id, tenantId]
    );
    if (rows.length === 0) throw new AppError('Variante no encontrada', 404);
    const v = mapVariant(rows[0]);
    v.priceTiers = await this.findTiersByVariant(id, tenantId);
    return v;
  }

  // DDL congelado: la columna product_variants.color_hex vive en el baseline Drizzle
  // (src/db/migrations). Método no-op conservado porque lo invocan varios métodos. Ver CLAUDE.md.
  private async ensureColorHex(): Promise<void> { /* no-op: esquema en migraciones */
  }

  async create(productId: string, tenantId: string, data: {
    sku: string; barcode?: string; color?: string; colorHex?: string; size?: string; material?: string;
    stock?: number; minStock?: number; costPrice?: number; priceOverride?: number;
    supplierId?: string; images?: string[]; sortOrder?: number; preorderLimit?: number | null;
    hormaId?: string | null;
  }): Promise<ProductVariant> {
    await this.ensureTables();
    await this.ensureColorHex();
    if (data.images && data.images.length > MAX_VARIANT_IMAGES) {
      throw new AppError(`Máximo ${MAX_VARIANT_IMAGES} imágenes por color`, 400);
    }
    // SKU único por tenant (solo entre activas — una eliminada no debe bloquear el SKU)
    const [dup] = await db.execute<RowDataPacket[]>(
      'SELECT id FROM product_variants WHERE sku = ? AND tenant_id = ? AND is_active = 1',
      [data.sku, tenantId]
    );
    if (dup.length > 0) throw new AppError('El SKU de la variante ya existe', 400);

    // Si viene horma_id, valida que el color esté en la paleta de ESA horma
    // (no la del producto — un producto puede tener variantes en varias hormas).
    if (data.hormaId && data.color) {
      const allowed = await hormasService.isColorAllowed(data.hormaId, data.color, tenantId);
      if (!allowed) throw new AppError(`El color "${data.color}" no está en la paleta de esta horma`, 400);
    }

    const id = uuidv4();
    await db.execute(
      `INSERT INTO product_variants
         (id, tenant_id, product_id, sku, barcode, color, color_hex, size, material,
          stock, reserved_stock, min_stock, cost_price, price_override,
          supplier_id, images, sort_order, preorder_limit, horma_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, tenantId, productId,
        data.sku, data.barcode ?? null, data.color ?? null, data.colorHex ?? null, data.size ?? null, data.material ?? null,
        data.stock ?? 0, data.minStock ?? 0,
        data.costPrice ?? null, data.priceOverride ?? null,
        data.supplierId ?? null,
        data.images ? JSON.stringify(data.images) : null,
        data.sortOrder ?? 0,
        data.preorderLimit ?? null,
        data.hormaId ?? null,
      ]
    );

    // Registrar movimiento de inventario inicial si hay stock
    if (data.stock && data.stock > 0) {
      await this._recordMovement({
        tenantId, variantId: id, productId,
        type: 'entrada', quantity: data.stock,
        reason: 'Stock inicial al crear variante',
      });
    }

    return this.findById(id, tenantId);
  }

  async update(id: string, tenantId: string, data: Partial<{
    sku: string; barcode: string; color: string; colorHex: string; size: string; material: string;
    minStock: number; costPrice: number; priceOverride: number;
    supplierId: string; images: string[]; sortOrder: number; isActive: boolean; preorderLimit: number | null;
    hormaId: string | null;
  }>): Promise<ProductVariant> {
    await this.ensureColorHex();
    await this.findById(id, tenantId);
    if (data.images && data.images.length > MAX_VARIANT_IMAGES) {
      throw new AppError(`Máximo ${MAX_VARIANT_IMAGES} imágenes por color`, 400);
    }

    if (data.sku) {
      const [dup] = await db.execute<RowDataPacket[]>(
        'SELECT id FROM product_variants WHERE sku = ? AND tenant_id = ? AND id != ? AND is_active = 1',
        [data.sku, tenantId, id]
      );
      if (dup.length > 0) throw new AppError('El SKU de la variante ya existe', 400);
    }

    const fieldMap: Record<string, string> = {
      sku: 'sku', barcode: 'barcode', color: 'color', colorHex: 'color_hex', size: 'size', material: 'material',
      minStock: 'min_stock', costPrice: 'cost_price', priceOverride: 'price_override',
      supplierId: 'supplier_id', sortOrder: 'sort_order', isActive: 'is_active',
      preorderLimit: 'preorder_limit', hormaId: 'horma_id',
    };

    const sets: string[] = [];
    const vals: any[] = [];
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      if (k === 'images') { sets.push('images = ?'); vals.push(JSON.stringify(v)); continue; }
      const col = fieldMap[k];
      if (!col) continue;
      sets.push(`${col} = ?`);
      vals.push(v);
    }
    if (sets.length === 0) throw new AppError('No hay datos para actualizar', 400);
    vals.push(id, tenantId);

    await db.execute(`UPDATE product_variants SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`, vals);
    return this.findById(id, tenantId);
  }

  async softDelete(id: string, tenantId: string): Promise<void> {
    await this.findById(id, tenantId);
    // Renombra el SKU al desactivar — el UNIQUE KEY (sku, tenant_id) no distingue
    // is_active, así que sin esto el SKU queda bloqueado para siempre y una variante
    // NUEVA que intente reusarlo (ej. al recrear el mismo producto) choca con
    // "El SKU de la variante ya existe" contra una fila que el usuario ya borró.
    await db.execute(
      "UPDATE product_variants SET is_active = 0, sku = CONCAT(sku, '-DEL-', SUBSTRING(id, 1, 8)) WHERE id = ? AND tenant_id = ?",
      [id, tenantId]
    );
  }

  // ── Stock Atómico ──────────────────────────────────────────────────────────

  async adjustStock(params: {
    variantId: string; productId: string; tenantId: string;
    quantity: number; type: 'entrada' | 'salida' | 'ajuste' | 'merma';
    reason: string; referenceType?: string; referenceId?: string; createdBy?: string;
  }): Promise<ProductVariant> {
    await this.ensureTables();
    if (!params.reason?.trim()) throw new AppError('Debe especificar el motivo del movimiento', 400);

    const isDecrease = params.type === 'salida' || params.type === 'merma';

    if (isDecrease) {
      // UPDATE atómico — race condition safe
      const [result] = await db.execute<ResultSetHeader>(
        'UPDATE product_variants SET stock = stock - ? WHERE id = ? AND tenant_id = ? AND stock >= ?',
        [params.quantity, params.variantId, params.tenantId, params.quantity]
      );
      if (result.affectedRows === 0) throw new AppError('Stock insuficiente', 400);
    } else if (params.type === 'ajuste') {
      await db.execute(
        'UPDATE product_variants SET stock = ? WHERE id = ? AND tenant_id = ?',
        [params.quantity, params.variantId, params.tenantId]
      );
    } else {
      // entrada
      await db.execute(
        'UPDATE product_variants SET stock = stock + ? WHERE id = ? AND tenant_id = ?',
        [params.quantity, params.variantId, params.tenantId]
      );
    }

    await this._recordMovement(params);
    return this.findById(params.variantId, params.tenantId);
  }

  /** Decrementar stock dentro de una transacción existente (usado por sales.service) */
  async decrementStockInTransaction(
    conn: any,
    variantId: string, tenantId: string, quantity: number
  ): Promise<void> {
    await this.ensureTables();
    const [result] = await conn.execute(
      'UPDATE product_variants SET stock = stock - ? WHERE id = ? AND tenant_id = ? AND stock >= ?',
      [quantity, variantId, tenantId, quantity]
    ) as [ResultSetHeader, any];
    if (result.affectedRows === 0) throw new AppError('Stock de variante insuficiente', 400);
  }

  /**
   * Reserva (soft-hold) el stock de variantes para un pedido del storefront.
   * Incrementa `reserved_stock` de forma atómica (race-safe) verificando que haya
   * disponibilidad real (stock - reserved_stock >= qty). Registra un movimiento
   * 'reserva' por cada variante. Es transaccional: si una variante no tiene stock,
   * revierte TODO y devuelve { ok:false, conflict }.
   *
   * Mantiene la misma filosofía que los `inventory_holds` de productos sin variante:
   * no destruye stock (reversible al cancelar), pero la tienda deja de mostrar el
   * combo agotado de inmediato (la query pública filtra por stock - reserved_stock > 0).
   */
  async reserveForPublicOrder(params: {
    tenantId: string; orderId: string; orderNumber: string;
    items: { variantId?: string; productId: string; quantity: number; productName?: string; isPreorder?: boolean }[];
  }): Promise<{ ok: boolean; conflict?: string }> {
    const variantItems = params.items.filter(i => i.variantId);
    if (variantItems.length === 0) return { ok: true };
    await this.ensureTables();

    const conn = await (db as any).getConnection();
    try {
      await conn.beginTransaction();
      for (const it of variantItems) {
        if (it.isPreorder) {
          // PREVENTA (backorder): no toca stock; cuenta contra el cupo de preventa (si lo hay).
          const [r] = await conn.execute(
            `UPDATE product_variants SET preorder_count = preorder_count + ?
             WHERE id = ? AND tenant_id = ? AND is_active = 1
               AND (preorder_limit IS NULL OR preorder_count + ? <= preorder_limit)`,
            [it.quantity, it.variantId, params.tenantId, it.quantity]
          ) as [ResultSetHeader, any];
          if (r.affectedRows === 0) {
            await conn.rollback(); conn.release();
            return { ok: false, conflict: it.productName || it.variantId! };
          }
          await conn.execute(
            `INSERT INTO inventory_movements
               (id, tenant_id, variant_id, product_id, type, quantity, reason, reference_type, reference_id)
             VALUES (?, ?, ?, ?, 'reserva', ?, ?, 'storefront_order_preorder', ?)`,
            [uuidv4(), params.tenantId, it.variantId, it.productId, it.quantity,
             `Preventa por pedido ${params.orderNumber}`, params.orderId]
          );
        } else {
          // Reserva normal: incrementa reserved_stock verificando disponibilidad real.
          const [r] = await conn.execute(
            `UPDATE product_variants SET reserved_stock = reserved_stock + ?
             WHERE id = ? AND tenant_id = ? AND is_active = 1 AND (stock - reserved_stock) >= ?`,
            [it.quantity, it.variantId, params.tenantId, it.quantity]
          ) as [ResultSetHeader, any];
          if (r.affectedRows === 0) {
            await conn.rollback(); conn.release();
            return { ok: false, conflict: it.productName || it.variantId! };
          }
          await conn.execute(
            `INSERT INTO inventory_movements
               (id, tenant_id, variant_id, product_id, type, quantity, reason, reference_type, reference_id)
             VALUES (?, ?, ?, ?, 'reserva', ?, ?, 'storefront_order', ?)`,
            [uuidv4(), params.tenantId, it.variantId, it.productId, it.quantity,
             `Reserva por pedido ${params.orderNumber}`, params.orderId]
          );
        }
      }
      await conn.commit(); conn.release();
      return { ok: true };
    } catch (e) {
      try { await conn.rollback(); } catch { /* noop */ }
      try { conn.release(); } catch { /* noop */ }
      throw e;
    }
  }

  /**
   * Libera las reservas de variante de un pedido (al cancelar o si falla la inserción).
   * Distingue por `reference_type`: 'storefront_order' → reserved_stock; 'storefront_order_preorder'
   * → preorder_count. Registra un movimiento 'liberacion'. Idempotente: sin reservas, no hace nada.
   */
  async releaseForOrder(orderId: string, tenantId: string): Promise<void> {
    await this.ensureTables();
    const [movs] = await db.execute<RowDataPacket[]>(
      `SELECT variant_id, product_id, reference_type, SUM(quantity) AS qty
       FROM inventory_movements
       WHERE reference_id = ? AND tenant_id = ? AND type = 'reserva'
         AND reference_type IN ('storefront_order', 'storefront_order_preorder')
       GROUP BY variant_id, product_id, reference_type`,
      [orderId, tenantId]
    );
    for (const m of movs as any[]) {
      if (!m.variant_id) continue;
      const qty = Number(m.qty);
      if (m.reference_type === 'storefront_order_preorder') {
        await db.execute(
          `UPDATE product_variants SET preorder_count = GREATEST(0, preorder_count - ?)
           WHERE id = ? AND tenant_id = ?`,
          [qty, m.variant_id, tenantId]
        );
      } else {
        await db.execute(
          `UPDATE product_variants SET reserved_stock = GREATEST(0, reserved_stock - ?)
           WHERE id = ? AND tenant_id = ?`,
          [qty, m.variant_id, tenantId]
        );
      }
      await this._recordMovement({
        tenantId, variantId: m.variant_id, productId: m.product_id,
        type: 'liberacion', quantity: qty,
        reason: 'Liberación de reserva (pedido cancelado/anulado)',
        referenceType: m.reference_type, referenceId: orderId,
      });
    }
  }

  /**
   * Asienta la venta de una variante al confirmar/entregar un pedido (dentro de una
   * transacción existente): descuenta el stock real y, si NO era preventa, libera la
   * reserva (reserved_stock) que tomó al crear el pedido. En preventa el stock puede
   * quedar negativo (backorder real). Registra movimiento 'salida' y devuelve sku + costo
   * para congelar en sale_items.
   */
  async settleVariantForSale(conn: any, params: {
    variantId: string; productId: string; tenantId: string; quantity: number;
    isPreorder?: boolean; reason: string; referenceId: string;
  }): Promise<{ sku: string; costPrice: number }> {
    await this.ensureTables();
    const [rows] = await conn.execute(
      'SELECT sku, cost_price FROM product_variants WHERE id = ? AND tenant_id = ? FOR UPDATE',
      [params.variantId, params.tenantId]
    ) as [RowDataPacket[], any];
    const v = (rows as any[])[0];
    const sku = v?.sku ?? 'VAR';
    const costPrice = v?.cost_price != null ? Number(v.cost_price) : 0;

    if (params.isPreorder) {
      await conn.execute(
        'UPDATE product_variants SET stock = stock - ? WHERE id = ? AND tenant_id = ?',
        [params.quantity, params.variantId, params.tenantId]
      );
    } else {
      await conn.execute(
        `UPDATE product_variants SET stock = stock - ?, reserved_stock = GREATEST(0, reserved_stock - ?)
         WHERE id = ? AND tenant_id = ?`,
        [params.quantity, params.quantity, params.variantId, params.tenantId]
      );
    }
    await conn.execute(
      `INSERT INTO inventory_movements
         (id, tenant_id, variant_id, product_id, type, quantity, reason, reference_type, reference_id)
       VALUES (?, ?, ?, ?, 'salida', ?, ?, 'sale', ?)`,
      [uuidv4(), params.tenantId, params.variantId, params.productId, params.quantity, params.reason, params.referenceId]
    );
    return { sku, costPrice };
  }

  // ── Price Tiers ────────────────────────────────────────────────────────────

  async findTiersByVariant(variantId: string, tenantId: string): Promise<VariantPriceTier[]> {
    await this.ensureTables();
    const [rows] = await db.execute<TierRow[]>(
      `SELECT * FROM variant_price_tiers
       WHERE variant_id = ? AND tenant_id = ? AND is_active = 1
       ORDER BY min_qty ASC`,
      [variantId, tenantId]
    );
    return rows.map(mapTier);
  }

  async resolvePrice(variantId: string, qty: number, tenantId: string): Promise<ResolvedPrice> {
    await this.ensureTables();
    // Buscar el tier más alto con min_qty <= qty
    const [tiers] = await db.execute<TierRow[]>(
      `SELECT * FROM variant_price_tiers
       WHERE variant_id = ? AND tenant_id = ? AND min_qty <= ? AND is_active = 1
       ORDER BY min_qty DESC
       LIMIT 1`,
      [variantId, tenantId, qty]
    );

    if (tiers.length > 0) {
      return { price: Number(tiers[0].price), tenantMarginPct: Number(tiers[0].tenant_margin_pct), source: 'tier' };
    }

    // Fallback: price_override o base_price del producto padre
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT pv.price_override, COALESCE(p.base_price, p.sale_price) AS base_price
       FROM product_variants pv
       LEFT JOIN products p ON p.id = pv.product_id
       WHERE pv.id = ? AND pv.tenant_id = ?`,
      [variantId, tenantId]
    );
    if (rows.length === 0) throw new AppError('Variante no encontrada', 404);

    const row = rows[0] as any;
    if (row.price_override != null) {
      return { price: Number(row.price_override), tenantMarginPct: 0, source: 'override' };
    }
    return { price: Number(row.base_price ?? 0), tenantMarginPct: 0, source: 'base' };
  }

  async createTier(variantId: string, tenantId: string, data: {
    minQty: number; price: number; tenantMarginPct?: number;
  }): Promise<VariantPriceTier> {
    await this.findById(variantId, tenantId); // validates ownership

    const [dup] = await db.execute<RowDataPacket[]>(
      'SELECT id FROM variant_price_tiers WHERE variant_id = ? AND min_qty = ?',
      [variantId, data.minQty]
    );
    if (dup.length > 0) throw new AppError(`Ya existe un tier para min_qty = ${data.minQty}`, 400);

    const id = uuidv4();
    await db.execute(
      `INSERT INTO variant_price_tiers (id, tenant_id, variant_id, min_qty, price, tenant_margin_pct)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, tenantId, variantId, data.minQty, data.price, data.tenantMarginPct ?? 0]
    );

    const [rows] = await db.execute<TierRow[]>(
      'SELECT * FROM variant_price_tiers WHERE id = ?', [id]
    );
    return mapTier(rows[0]);
  }

  async updateTier(tierId: string, tenantId: string, data: {
    price?: number; tenantMarginPct?: number; isActive?: boolean;
  }): Promise<VariantPriceTier> {
    await this.ensureTables();
    const [existing] = await db.execute<TierRow[]>(
      'SELECT * FROM variant_price_tiers WHERE id = ? AND tenant_id = ?',
      [tierId, tenantId]
    );
    if (existing.length === 0) throw new AppError('Tier no encontrado', 404);

    const sets: string[] = [];
    const vals: any[] = [];
    if (data.price !== undefined)          { sets.push('price = ?');             vals.push(data.price); }
    if (data.tenantMarginPct !== undefined) { sets.push('tenant_margin_pct = ?'); vals.push(data.tenantMarginPct); }
    if (data.isActive !== undefined)        { sets.push('is_active = ?');         vals.push(data.isActive ? 1 : 0); }
    if (sets.length === 0) throw new AppError('No hay datos para actualizar', 400);

    vals.push(tierId, tenantId);
    await db.execute(`UPDATE variant_price_tiers SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`, vals);

    const [rows] = await db.execute<TierRow[]>('SELECT * FROM variant_price_tiers WHERE id = ?', [tierId]);
    return mapTier(rows[0]);
  }

  async deleteTier(tierId: string, tenantId: string): Promise<void> {
    await this.ensureTables();
    const [existing] = await db.execute<RowDataPacket[]>(
      'SELECT id FROM variant_price_tiers WHERE id = ? AND tenant_id = ?', [tierId, tenantId]
    );
    if (existing.length === 0) throw new AppError('Tier no encontrado', 404);
    await db.execute(
      'UPDATE variant_price_tiers SET is_active = 0 WHERE id = ? AND tenant_id = ?',
      [tierId, tenantId]
    );
  }

  // ── Edición masiva (grupos) ────────────────────────────────────────────────
  // Aplica el mismo cambio a un lote de variantes — pensado para "editar por
  // grupos" desde el panel de inventario (ej. seleccionar todas las de talla M
  // y sumar 50 unidades, o fijar un nuevo precio override a todo un color).
  // No es transaccional entre variantes a propósito: si una falla (ej. stock
  // insuficiente al restar), las demás deben seguir aplicándose — se reporta
  // por variante en `failed` en vez de abortar todo el lote.
  async bulkUpdate(tenantId: string, params: {
    variantIds: string[];
    stock?: { type: 'entrada' | 'salida' | 'ajuste' | 'merma'; quantity: number; reason: string };
    priceOverride?: number | null;
    costPrice?: number | null;
    minStock?: number;
    createdBy?: string;
  }): Promise<{ updated: number; failed: { id: string; error: string }[] }> {
    await this.ensureTables();
    if (!params.variantIds || params.variantIds.length === 0) {
      throw new AppError('Debe seleccionar al menos una variante', 400);
    }
    if (!params.stock && params.priceOverride === undefined && params.costPrice === undefined && params.minStock === undefined) {
      throw new AppError('No hay cambios para aplicar', 400);
    }
    if (params.stock && !params.stock.reason?.trim()) {
      throw new AppError('Debe especificar el motivo del ajuste de stock', 400);
    }

    const fieldUpdate: Partial<{ priceOverride: number | null; costPrice: number | null; minStock: number }> = {};
    if (params.priceOverride !== undefined) fieldUpdate.priceOverride = params.priceOverride;
    if (params.costPrice !== undefined) fieldUpdate.costPrice = params.costPrice;
    if (params.minStock !== undefined) fieldUpdate.minStock = params.minStock;

    let updated = 0;
    const failed: { id: string; error: string }[] = [];

    for (const variantId of params.variantIds) {
      try {
        const variant = await this.findById(variantId, tenantId);

        if (params.stock) {
          await this.adjustStock({
            variantId, productId: variant.productId, tenantId,
            quantity: params.stock.quantity, type: params.stock.type,
            reason: params.stock.reason, referenceType: 'bulk_edit', createdBy: params.createdBy,
          });
        }

        if (Object.keys(fieldUpdate).length > 0) {
          await this.update(variantId, tenantId, fieldUpdate);
        }

        updated++;
      } catch (e: any) {
        failed.push({ id: variantId, error: e?.message || 'Error desconocido' });
      }
    }

    return { updated, failed };
  }

  // ── Inventory Movements ────────────────────────────────────────────────────

  async getMovements(variantId: string, tenantId: string): Promise<InventoryMovement[]> {
    await this.ensureTables();
    const [rows] = await db.execute<MovRow[]>(
      `SELECT * FROM inventory_movements
       WHERE variant_id = ? AND tenant_id = ?
       ORDER BY created_at DESC LIMIT 100`,
      [variantId, tenantId]
    );
    return rows.map(mapMovement);
  }

  private async _recordMovement(params: {
    tenantId: string; variantId: string; productId: string;
    type: string; quantity: number; reason: string;
    referenceType?: string; referenceId?: string; createdBy?: string;
  }): Promise<void> {
    await db.execute(
      `INSERT INTO inventory_movements
         (id, tenant_id, variant_id, product_id, type, quantity, reason, reference_type, reference_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(), params.tenantId, params.variantId, params.productId,
        params.type, params.quantity, params.reason,
        params.referenceType ?? null, params.referenceId ?? null, params.createdBy ?? null,
      ]
    );
  }
}

export const variantsService = new VariantsService();
