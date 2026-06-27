import { v4 as uuidv4 } from 'uuid';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { db } from '../../config';
import { Supplier, SupplierProduct } from '../../common/types';
import { AppError } from '../../common/middleware';
import { variantsService } from '../variants/variants.service';

interface SupplierRow extends RowDataPacket {
  id: string; tenant_id: string; name: string;
  contact_info: string | null; phone: string | null; email: string | null;
  payment_terms: string | null; is_active: number;
  created_at: Date; updated_at: Date;
}

interface SpRow extends RowDataPacket {
  id: string; tenant_id: string; supplier_id: string; product_id: string;
  supplier_sku: string | null; supplier_price: number | null;
  lead_time_days: number | null; is_preferred: number; is_active: number;
  created_at: Date; updated_at: Date;
}

function mapSupplier(r: SupplierRow): Supplier {
  return {
    id: r.id, tenantId: r.tenant_id, name: r.name,
    contactInfo: r.contact_info ?? undefined, phone: r.phone ?? undefined,
    email: r.email ?? undefined, paymentTerms: r.payment_terms ?? undefined,
    isActive: Boolean(r.is_active), createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

function mapSp(r: SpRow): SupplierProduct {
  return {
    id: r.id, tenantId: r.tenant_id, supplierId: r.supplier_id, productId: r.product_id,
    supplierSku: r.supplier_sku ?? undefined,
    supplierPrice: r.supplier_price != null ? Number(r.supplier_price) : undefined,
    leadTimeDays: r.lead_time_days ?? undefined,
    isPreferred: Boolean(r.is_preferred), isActive: Boolean(r.is_active),
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export class SuppliersService {

  async findAll(tenantId: string): Promise<Supplier[]> {
    await variantsService.ensureTables();
    const [rows] = await db.execute<SupplierRow[]>(
      'SELECT * FROM suppliers WHERE tenant_id = ? AND is_active = 1 ORDER BY name ASC',
      [tenantId]
    );
    return rows.map(mapSupplier);
  }

  async findById(id: string, tenantId: string): Promise<Supplier> {
    await variantsService.ensureTables();
    const [rows] = await db.execute<SupplierRow[]>(
      'SELECT * FROM suppliers WHERE id = ? AND tenant_id = ? AND is_active = 1',
      [id, tenantId]
    );
    if (rows.length === 0) throw new AppError('Proveedor no encontrado', 404);
    return mapSupplier(rows[0]);
  }

  async create(tenantId: string, data: {
    name: string; contactInfo?: string; phone?: string; email?: string; paymentTerms?: string;
  }): Promise<Supplier> {
    const id = uuidv4();
    await db.execute(
      `INSERT INTO suppliers (id, tenant_id, name, contact_info, phone, email, payment_terms)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, tenantId, data.name, data.contactInfo ?? null, data.phone ?? null,
       data.email ?? null, data.paymentTerms ?? null]
    );
    return this.findById(id, tenantId);
  }

  async update(id: string, tenantId: string, data: Partial<{
    name: string; contactInfo: string; phone: string; email: string; paymentTerms: string;
  }>): Promise<Supplier> {
    await this.findById(id, tenantId);
    const fieldMap: Record<string, string> = {
      name: 'name', contactInfo: 'contact_info', phone: 'phone',
      email: 'email', paymentTerms: 'payment_terms',
    };
    const sets: string[] = []; const vals: any[] = [];
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      const col = fieldMap[k]; if (!col) continue;
      sets.push(`${col} = ?`); vals.push(v);
    }
    if (sets.length === 0) throw new AppError('No hay datos para actualizar', 400);
    vals.push(id, tenantId);
    await db.execute(`UPDATE suppliers SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`, vals);
    return this.findById(id, tenantId);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.findById(id, tenantId);
    await db.execute('UPDATE suppliers SET is_active = 0 WHERE id = ? AND tenant_id = ?', [id, tenantId]);
  }

  // ── Supplier Products ──────────────────────────────────────────────────────

  async getProducts(supplierId: string, tenantId: string): Promise<SupplierProduct[]> {
    await variantsService.ensureTables();
    const [rows] = await db.execute<SpRow[]>(
      `SELECT sp.*, sp.tenant_id FROM supplier_products sp
       WHERE sp.supplier_id = ? AND sp.tenant_id = ? AND sp.is_active = 1`,
      [supplierId, tenantId]
    );
    return rows.map(mapSp);
  }

  async linkProduct(supplierId: string, tenantId: string, data: {
    productId: string; supplierSku?: string; supplierPrice?: number;
    leadTimeDays?: number; isPreferred?: boolean;
  }): Promise<SupplierProduct> {
    await this.findById(supplierId, tenantId);
    const [dup] = await db.execute<RowDataPacket[]>(
      'SELECT id FROM supplier_products WHERE supplier_id = ? AND product_id = ? AND is_active = 1',
      [supplierId, data.productId]
    );
    if (dup.length > 0) throw new AppError('Este producto ya está vinculado al proveedor', 400);

    const id = uuidv4();
    await db.execute(
      `INSERT INTO supplier_products
         (id, tenant_id, supplier_id, product_id, supplier_sku, supplier_price, lead_time_days, is_preferred)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, tenantId, supplierId, data.productId, data.supplierSku ?? null,
       data.supplierPrice ?? null, data.leadTimeDays ?? null, data.isPreferred ? 1 : 0]
    );
    const [rows] = await db.execute<SpRow[]>(
      'SELECT sp.*, sp.tenant_id FROM supplier_products sp WHERE sp.id = ?', [id]
    );
    return mapSp(rows[0]);
  }

  async unlinkProduct(supplierId: string, productId: string, tenantId: string): Promise<void> {
    await variantsService.ensureTables();
    await db.execute(
      'UPDATE supplier_products SET is_active = 0 WHERE supplier_id = ? AND product_id = ? AND tenant_id = ?',
      [supplierId, productId, tenantId]
    );
  }
}

export const suppliersService = new SuppliersService();
