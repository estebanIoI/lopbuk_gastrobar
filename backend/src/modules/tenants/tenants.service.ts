import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { db } from '../../config';
import { AppError } from '../../common/middleware';
import { PaginatedResponse } from '../../common/types';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

interface TenantRow extends RowDataPacket {
  id: string;
  name: string;
  slug: string;
  owner_id: string | null;
  plan: string;
  status: string;
  max_users: number;
  max_products: number;
  created_at: Date;
  updated_at: Date;
}

interface TenantSummaryRow extends RowDataPacket {
  id: string;
  name: string;
  slug: string;
  business_type: string | null;
  owner_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
  plan: string;
  status: string;
  max_users: number;
  max_products: number;
  bg_color: string | null;
  total_users: number;
  total_products: number;
  total_sales: number;
  created_at: Date;
  updated_at: Date;
}

interface CountRow extends RowDataPacket {
  total: number;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  ownerId?: string;
  plan: string;
  status: string;
  maxUsers: number;
  maxProducts: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantWithSummary extends Tenant {
  businessType?: string;
  ownerName?: string;
  ownerEmail?: string;
  bgColor?: string;
  totalUsers: number;
  totalProducts: number;
  totalSales: number;
}

export class TenantsService {
  private mapTenant(row: TenantRow): Tenant {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      ownerId: row.owner_id || undefined,
      plan: row.plan,
      status: row.status,
      maxUsers: row.max_users,
      maxProducts: row.max_products,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapTenantSummary(row: TenantSummaryRow): TenantWithSummary {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      businessType: row.business_type || undefined,
      ownerId: row.owner_id || undefined,
      ownerName: row.owner_name || undefined,
      ownerEmail: row.owner_email || undefined,
      bgColor: row.bg_color || undefined,
      plan: row.plan,
      status: row.status,
      maxUsers: row.max_users,
      maxProducts: row.max_products,
      totalUsers: Number(row.total_users) || 0,
      totalProducts: Number(row.total_products) || 0,
      totalSales: Number(row.total_sales) || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findAll(
    page = 1,
    limit = 10,
    search?: string
  ): Promise<PaginatedResponse<TenantWithSummary>> {
    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const params: string[] = [];

    if (search) {
      conditions.push('(t.name LIKE ? OR t.slug LIKE ?)');
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countResult] = await db.execute<CountRow[]>(
      `SELECT COUNT(*) as total FROM tenants t ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    const [rows] = await db.execute<TenantSummaryRow[]>(
      `SELECT
        t.id, t.name, t.slug, t.business_type, t.owner_id, t.plan, t.status,
        t.max_users, t.max_products, t.bg_color, t.created_at, t.updated_at,
        u.name as owner_name, u.email as owner_email,
        (SELECT COUNT(*) FROM users WHERE tenant_id = t.id) as total_users,
        (SELECT COUNT(*) FROM products WHERE tenant_id = t.id) as total_products,
        (SELECT COUNT(*) FROM sales WHERE tenant_id = t.id AND status = 'completada') as total_sales
      FROM tenants t
      LEFT JOIN users u ON t.owner_id = u.id
      ${whereClause}
      ORDER BY t.created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, String(limit), String(offset)]
    );

    return {
      data: rows.map((r) => this.mapTenantSummary(r)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string): Promise<TenantWithSummary> {
    const [rows] = await db.execute<TenantSummaryRow[]>(
      `SELECT
        t.id, t.name, t.slug, t.business_type, t.owner_id, t.plan, t.status,
        t.max_users, t.max_products, t.bg_color, t.created_at, t.updated_at,
        u.name as owner_name, u.email as owner_email,
        (SELECT COUNT(*) FROM users WHERE tenant_id = t.id) as total_users,
        (SELECT COUNT(*) FROM products WHERE tenant_id = t.id) as total_products,
        (SELECT COUNT(*) FROM sales WHERE tenant_id = t.id AND status = 'completada') as total_sales
      FROM tenants t
      LEFT JOIN users u ON t.owner_id = u.id
      WHERE t.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      throw new AppError('Tenant no encontrado', 404);
    }

    return this.mapTenantSummary(rows[0]);
  }

  async create(data: {
    name: string;
    slug: string;
    businessType?: string;
    plan?: string;
    maxUsers?: number;
    maxProducts?: number;
    ownerName: string;
    ownerEmail: string;
    ownerPassword: string;
  }): Promise<TenantWithSummary> {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      // Check slug uniqueness
      const [existingSlug] = await connection.execute<TenantRow[]>(
        'SELECT id FROM tenants WHERE slug = ?',
        [data.slug]
      );
      if (existingSlug.length > 0) {
        throw new AppError('Ya existe un tenant con este slug', 409);
      }

      // Check email uniqueness
      const [existingEmail] = await connection.execute<RowDataPacket[]>(
        'SELECT id FROM users WHERE email = ?',
        [data.ownerEmail]
      );
      if (existingEmail.length > 0) {
        throw new AppError('Ya existe un usuario con este email', 409);
      }

      // Create tenant
      const tenantId = uuidv4();
      await connection.execute<ResultSetHeader>(
        `INSERT INTO tenants (id, name, slug, business_type, plan, max_users, max_products, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'activo')`,
        [
          tenantId,
          data.name,
          data.slug,
          data.businessType || null,
          data.plan || 'basico',
          data.maxUsers || 5,
          data.maxProducts || 500,
        ]
      );

      // Create owner user (comerciante)
      const ownerId = uuidv4();
      const hashedPassword = await bcrypt.hash(data.ownerPassword, 10);
      await connection.execute<ResultSetHeader>(
        `INSERT INTO users (id, tenant_id, name, email, password, role, is_active)
         VALUES (?, ?, ?, ?, ?, 'comerciante', true)`,
        [ownerId, tenantId, data.ownerName, data.ownerEmail, hashedPassword]
      );

      // Set owner on tenant
      await connection.execute(
        'UPDATE tenants SET owner_id = ? WHERE id = ?',
        [ownerId, tenantId]
      );

      // Create store_info for tenant
      await connection.execute<ResultSetHeader>(
        `INSERT INTO store_info (tenant_id, name, address, phone, tax_id, email)
         VALUES (?, ?, '', '', '', ?)`,
        [tenantId, data.name, data.ownerEmail]
      );

      // Create invoice_sequence for tenant
      await connection.execute<ResultSetHeader>(
        `INSERT INTO invoice_sequence (tenant_id, prefix, current_number)
         VALUES (?, 'FAC', 0)`,
        [tenantId]
      );

      // Create payment_receipt_sequence for tenant
      await connection.execute<ResultSetHeader>(
        `INSERT INTO payment_receipt_sequence (tenant_id, prefix, current_number)
         VALUES (?, 'REC', 0)`,
        [tenantId]
      );

      // Create default categories for tenant
      const defaultCategories = [
        { id: 'general', name: 'General', description: 'Productos generales' },
        { id: 'alimentos', name: 'Alimentos', description: 'Productos alimenticios' },
        { id: 'bebidas', name: 'Bebidas', description: 'Bebidas y refrescos' },
        { id: 'limpieza', name: 'Limpieza', description: 'Productos de aseo y limpieza' },
        { id: 'electronica', name: 'Electronica', description: 'Dispositivos electronicos' },
        { id: 'ropa', name: 'Ropa', description: 'Prendas de vestir' },
        { id: 'hogar', name: 'Hogar', description: 'Articulos para el hogar' },
        { id: 'otros', name: 'Otros', description: 'Otros productos' },
      ];

      for (const cat of defaultCategories) {
        await connection.execute<ResultSetHeader>(
          'INSERT IGNORE INTO categories (id, tenant_id, name, description) VALUES (?, ?, ?, ?)',
          [cat.id, tenantId, cat.name, cat.description]
        );
      }

      await connection.commit();

      return this.findById(tenantId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async update(
    id: string,
    data: {
      name?: string;
      businessType?: string;
      plan?: string;
      status?: string;
      maxUsers?: number;
      maxProducts?: number;
      bgColor?: string;
    }
  ): Promise<TenantWithSummary> {
    await this.findById(id);

    const updates: string[] = [];
    const values: (string | number)[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.businessType !== undefined) {
      updates.push('business_type = ?');
      values.push(data.businessType);
    }
    if (data.plan !== undefined) {
      updates.push('plan = ?');
      values.push(data.plan);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      values.push(data.status);
    }
    if (data.maxUsers !== undefined) {
      updates.push('max_users = ?');
      values.push(data.maxUsers);
    }
    if (data.maxProducts !== undefined) {
      updates.push('max_products = ?');
      values.push(data.maxProducts);
    }
    if (data.bgColor !== undefined) {
      updates.push('bg_color = ?');
      values.push(data.bgColor);
    }

    if (updates.length === 0) {
      throw new AppError('No hay datos para actualizar', 400);
    }

    values.push(id);
    await db.execute(
      `UPDATE tenants SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return this.findById(id);
  }

  async toggleStatus(id: string): Promise<TenantWithSummary> {
    const tenant = await this.findById(id);
    const newStatus = tenant.status === 'activo' ? 'suspendido' : 'activo';

    await db.execute('UPDATE tenants SET status = ? WHERE id = ?', [newStatus, id]);

    // Also toggle all users of this tenant
    await db.execute('UPDATE users SET is_active = ? WHERE tenant_id = ?', [
      newStatus === 'activo',
      id,
    ]);

    return this.findById(id);
  }

  async getStats(): Promise<{
    totalTenants: number;
    activeTenants: number;
    suspendedTenants: number;
    totalUsers: number;
    totalProducts: number;
    totalSales: number;
  }> {
    const [rows] = await db.execute<RowDataPacket[]>(`
      SELECT
        (SELECT COUNT(*) FROM tenants) as total_tenants,
        (SELECT COUNT(*) FROM tenants WHERE status = 'activo') as active_tenants,
        (SELECT COUNT(*) FROM tenants WHERE status = 'suspendido') as suspended_tenants,
        (SELECT COUNT(*) FROM users WHERE role != 'superadmin') as total_users,
        (SELECT COUNT(*) FROM products) as total_products,
        (SELECT COUNT(*) FROM sales WHERE status = 'completada') as total_sales
    `);

    return {
      totalTenants: rows[0].total_tenants,
      activeTenants: rows[0].active_tenants,
      suspendedTenants: rows[0].suspended_tenants,
      totalUsers: rows[0].total_users,
      totalProducts: rows[0].total_products,
      totalSales: rows[0].total_sales,
    };
  }

  async getPlatformSettings(): Promise<Record<string, string>> {
    try {
      const [rows] = await db.execute<RowDataPacket[]>(
        'SELECT setting_key, setting_value FROM platform_settings'
      );
      const settings: Record<string, string> = {};
      for (const row of rows) {
        settings[row.setting_key] = row.setting_value;
      }
      return settings;
    } catch {
      return { bg_color: '#000000' };
    }
  }

  async updatePlatformSetting(key: string, value: string): Promise<void> {
    await db.execute(
      `INSERT INTO platform_settings (setting_key, setting_value) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = ?, updated_at = CURRENT_TIMESTAMP`,
      [key, value, value]
    );
  }

  async activateTrial(id: string): Promise<TenantWithSummary> {
    await this.findById(id);
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 7);
    await db.execute(
      'UPDATE tenants SET plan = ?, trial_ends_at = ? WHERE id = ?',
      ['empresarial', trialEnd, id]
    );
    return this.findById(id);
  }

  async getBusinessTypes(): Promise<string[]> {
    try {
      const [rows] = await db.execute<RowDataPacket[]>(
        "SELECT setting_value FROM platform_settings WHERE setting_key = 'business_types'"
      );
      if (rows.length > 0 && rows[0].setting_value) {
        return JSON.parse(rows[0].setting_value) as string[];
      }
    } catch {
      // fallback to defaults
    }
    return ['Restaurante', 'Cafetería', 'Bar', 'Panadería', 'Tienda', 'Otro'];
  }

  async createBusinessType(name: string): Promise<string[]> {
    const types = await this.getBusinessTypes();
    const normalized = name.trim();
    if (!normalized) throw new AppError('Nombre inválido', 400);
    if (types.includes(normalized)) throw new AppError('La categoría ya existe', 409);
    types.push(normalized);
    await this.updatePlatformSetting('business_types', JSON.stringify(types));
    return types;
  }

  async deleteBusinessType(name: string): Promise<string[]> {
    const types = await this.getBusinessTypes();
    const filtered = types.filter((t) => t !== name);
    if (filtered.length === types.length) throw new AppError('Categoría no encontrada', 404);
    await this.updatePlatformSetting('business_types', JSON.stringify(filtered));
    return filtered;
  }
}

export const tenantsService = new TenantsService();
