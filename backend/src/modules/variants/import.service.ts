import { v4 as uuidv4 } from 'uuid';
import { RowDataPacket } from 'mysql2/promise';
import { db } from '../../config';
import { AppError } from '../../common/middleware';
import { variantsService } from './variants.service';

export interface ImportRow {
  handle: string;          // Slug único del producto (agrupa variantes)
  productName: string;
  color?: string;
  size?: string;
  material?: string;
  variantSku: string;
  variantStock?: number;
  basePrice?: number;
  costPrice?: number;
  supplierName?: string;
}

export interface ImportResult {
  totalRows: number;
  productsCreated: number;
  productsUpdated: number;
  variantsCreated: number;
  variantsFailed: number;
  errors: Array<{ row: number; handle: string; sku: string; error: string }>;
}

export class ImportService {

  async importFromCsv(tenantId: string, rows: ImportRow[]): Promise<ImportResult> {
    // DDL hace COMMIT implícito en MySQL — debe correr ANTES de abrir la transacción.
    await variantsService.ensureTables();
    const conn = await (db as any).getConnection();
    const result: ImportResult = {
      totalRows: rows.length,
      productsCreated: 0, productsUpdated: 0,
      variantsCreated: 0, variantsFailed: 0,
      errors: [],
    };

    try {
      await conn.beginTransaction();

      // Cache de productos y proveedores existentes
      const [existingProds] = await conn.execute(
        'SELECT id, name FROM products WHERE tenant_id = ?', [tenantId]
      ) as [RowDataPacket[], any];
      const prodByName = new Map<string, string>(existingProds.map((r: any) => [r.name.toLowerCase().trim(), r.id]));

      const [existingSkus] = await conn.execute(
        'SELECT sku FROM product_variants WHERE tenant_id = ?', [tenantId]
      ) as [RowDataPacket[], any];
      const skuSet = new Set<string>(existingSkus.map((r: any) => r.sku));

      // Caché proveedores
      const [existingSuppliers] = await conn.execute(
        'SELECT id, name FROM suppliers WHERE tenant_id = ? AND is_active = 1', [tenantId]
      ) as [RowDataPacket[], any];
      const supplierByName = new Map<string, string>(
        existingSuppliers.map((r: any) => [r.name.toLowerCase().trim(), r.id])
      );

      // Agrupar por handle
      const byHandle = new Map<string, ImportRow[]>();
      for (const row of rows) {
        const handle = row.handle?.trim();
        if (!handle) continue;
        if (!byHandle.has(handle)) byHandle.set(handle, []);
        byHandle.get(handle)!.push(row);
      }

      let rowNum = 2;
      for (const [handle, handleRows] of byHandle) {
        const first = handleRows[0];

        // Resolver / crear producto base
        let productId: string;
        const nameLower = first.productName.toLowerCase().trim();
        if (prodByName.has(nameLower)) {
          productId = prodByName.get(nameLower)!;
          result.productsUpdated++;
        } else {
          productId = uuidv4();
          const basePrice = first.basePrice ?? 0;
          await conn.execute(
            `INSERT INTO products (id, tenant_id, name, sale_price, base_price, sku, stock, reorder_point)
             VALUES (?, ?, ?, ?, ?, ?, 0, 0)`,
            [productId, tenantId, first.productName, basePrice, basePrice,
             `${handle}-base-${productId.slice(0, 6)}`]
          );
          prodByName.set(nameLower, productId);
          result.productsCreated++;
        }

        // Resolver proveedor si viene en el CSV
        let supplierId: string | null = null;
        if (first.supplierName?.trim()) {
          const sName = first.supplierName.trim();
          const sLower = sName.toLowerCase();
          if (supplierByName.has(sLower)) {
            supplierId = supplierByName.get(sLower)!;
          } else {
            supplierId = uuidv4();
            await conn.execute(
              'INSERT INTO suppliers (id, tenant_id, name) VALUES (?, ?, ?)',
              [supplierId, tenantId, sName]
            );
            supplierByName.set(sLower, supplierId);
          }
        }

        // Crear variantes
        for (const row of handleRows) {
          try {
            const sku = row.variantSku?.trim();
            if (!sku) throw new Error('SKU de variante vacío');
            if (skuSet.has(sku)) throw new Error(`SKU "${sku}" duplicado`);

            const variantId = uuidv4();
            await conn.execute(
              `INSERT INTO product_variants
                 (id, tenant_id, product_id, sku, color, size, material,
                  stock, reserved_stock, min_stock, cost_price, price_override, supplier_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)`,
              [
                variantId, tenantId, productId, sku,
                row.color ?? null, row.size ?? null, row.material ?? null,
                row.variantStock ?? 0,
                row.costPrice ?? null,
                row.basePrice ?? null,
                supplierId,
              ]
            );
            skuSet.add(sku);

            // Tier base: min_qty = 1, price = basePrice
            if (row.basePrice) {
              await conn.execute(
                `INSERT INTO variant_price_tiers (id, tenant_id, variant_id, min_qty, price, tenant_margin_pct)
                 VALUES (?, ?, ?, 1, ?, 0)`,
                [uuidv4(), tenantId, variantId, row.basePrice]
              );
            }

            // Movimiento inicial
            if (row.variantStock && row.variantStock > 0) {
              await conn.execute(
                `INSERT INTO inventory_movements
                   (id, tenant_id, variant_id, product_id, type, quantity, reason)
                 VALUES (?, ?, ?, ?, 'entrada', ?, 'Importación CSV')`,
                [uuidv4(), tenantId, variantId, productId, row.variantStock]
              );
            }

            result.variantsCreated++;
          } catch (err: any) {
            result.variantsFailed++;
            result.errors.push({ row: rowNum, handle, sku: row.variantSku || '?', error: err.message });
          }
          rowNum++;
        }
      }

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    return result;
  }

  /** Parsea un CSV con cabecera y devuelve filas tipadas */
  static parseCsv(csvText: string): ImportRow[] {
    const lines = csvText.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) throw new AppError('CSV vacío o sin datos', 400);

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase()
      .replace(/[\s:]+/g, '_').replace(/[^a-z0-9_]/g, ''));

    const colIndex = (aliases: string[]): number =>
      aliases.reduce((found, a) => found >= 0 ? found : headers.indexOf(a), -1);

    const idx = {
      handle:       colIndex(['handle', 'slug']),
      productName:  colIndex(['product_name', 'nombre', 'name']),
      color:        colIndex(['attribute_color', 'color', 'attributecolor']),
      size:         colIndex(['attribute_size', 'talla', 'size', 'attributesize']),
      material:     colIndex(['attribute_material', 'material']),
      variantSku:   colIndex(['variant_sku', 'sku', 'variantsku']),
      variantStock: colIndex(['variant_stock', 'stock', 'variantstock']),
      basePrice:    colIndex(['base_price', 'precio', 'price', 'baseprice']),
      costPrice:    colIndex(['cost_price', 'costo', 'costprice']),
      supplierName: colIndex(['supplier', 'supplier_name', 'proveedor']),
    };

    if (idx.handle < 0 || idx.productName < 0 || idx.variantSku < 0) {
      throw new AppError('CSV debe tener columnas: Handle, Product Name, Variant SKU', 400);
    }

    return lines.slice(1).map(line => {
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      const g = (i: number) => i >= 0 ? cols[i] || undefined : undefined;
      const gNum = (i: number) => { const v = g(i); return v ? Number(v) : undefined; };
      return {
        handle:       cols[idx.handle] || '',
        productName:  cols[idx.productName] || '',
        color:        g(idx.color),
        size:         g(idx.size),
        material:     g(idx.material),
        variantSku:   cols[idx.variantSku] || '',
        variantStock: gNum(idx.variantStock),
        basePrice:    gNum(idx.basePrice),
        costPrice:    gNum(idx.costPrice),
        supplierName: g(idx.supplierName),
      };
    }).filter(r => r.handle && r.variantSku);
  }
}

export const importService = new ImportService();
