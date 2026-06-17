import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { db } from '../../config';
import { AppError } from '../../common/middleware';
import { PaginatedResponse } from '../../common/types';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { computeOpenState, parseBusinessHours, hasAnySchedule } from '../../utils/store-hours';

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
  trial_ends_at: Date | null;
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
  trialEndsAt?: string | null;
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
      trialEndsAt: row.trial_ends_at ? new Date(row.trial_ends_at).toISOString() : null,
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
        t.max_users, t.max_products, t.bg_color, t.trial_ends_at, t.created_at, t.updated_at,
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
        t.max_users, t.max_products, t.bg_color, t.trial_ends_at, t.created_at, t.updated_at,
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

      // Create RestBar sequences for tenant
      await connection.execute<ResultSetHeader>(
        `INSERT INTO rb_order_sequence (tenant_id, prefix, current_number) VALUES (?, 'C', 0)`,
        [tenantId]
      );
      await connection.execute<ResultSetHeader>(
        `INSERT INTO rb_reservation_sequence (tenant_id, prefix, current_number) VALUES (?, 'R', 0)`,
        [tenantId]
      );

      // Create singleton config tables for tenant
      await connection.execute<ResultSetHeader>(
        `INSERT IGNORE INTO store_announcement_bar (tenant_id, text, is_active) VALUES (?, '', FALSE)`,
        [tenantId]
      );
      await connection.execute<ResultSetHeader>(
        `INSERT IGNORE INTO store_order_bump (tenant_id, is_enabled) VALUES (?, FALSE)`,
        [tenantId]
      );
      await connection.execute<ResultSetHeader>(
        `INSERT IGNORE INTO chatbot_config (tenant_id, is_enabled) VALUES (?, 0)`,
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
      slug?: string;
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
    if (data.slug !== undefined) {
      const [existing] = await db.execute<RowDataPacket[]>(
        'SELECT id FROM tenants WHERE slug = ? AND id != ?',
        [data.slug, id]
      );
      if ((existing as any[]).length > 0) throw new AppError('El slug ya está en uso por otro comercio', 409);
      updates.push('slug = ?');
      values.push(data.slug);
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

  async activateTrial(id: string, days: number = 7): Promise<TenantWithSummary> {
    await this.findById(id);
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + Math.max(1, Math.min(days, 365)));
    await db.execute(
      'UPDATE tenants SET plan = ?, trial_ends_at = ? WHERE id = ?',
      ['empresarial', trialEnd, id]
    );
    return this.findById(id);
  }

  /** Desactiva el trial: limpia la fecha y revierte el plan a básico. */
  async deactivateTrial(id: string, revertPlan: string = 'basico'): Promise<TenantWithSummary> {
    await this.findById(id);
    const plan = ['basico', 'profesional', 'empresarial'].includes(revertPlan) ? revertPlan : 'basico';
    await db.execute(
      'UPDATE tenants SET plan = ?, trial_ends_at = NULL WHERE id = ?',
      [plan, id]
    );
    return this.findById(id);
  }

  /**
   * Borrado DEFINITIVO de un comercio y TODOS sus datos (productos, ventas,
   * pedidos, usuarios, etc.). Irreversible. Elimina en cascada todas las filas
   * con `tenant_id` del tenant, más sus usuarios y el propio tenant.
   */
  async destroy(id: string): Promise<{ id: string; name: string; deletedRows: number }> {
    const tenant = await this.findById(id);
    const connection = await db.getConnection();
    let deletedRows = 0;
    try {
      // Descubre solo las TABLAS BASE (no vistas) del esquema con columna tenant_id.
      // Importante: excluir vistas (TABLE_TYPE='VIEW', p.ej. v_customer_balances)
      // porque no son actualizables/borrables.
      const [colRows] = await connection.query<RowDataPacket[]>(
        `SELECT c.TABLE_NAME AS t
           FROM information_schema.COLUMNS c
           JOIN information_schema.TABLES tb
             ON tb.TABLE_SCHEMA = c.TABLE_SCHEMA AND tb.TABLE_NAME = c.TABLE_NAME
          WHERE c.TABLE_SCHEMA = DATABASE()
            AND c.COLUMN_NAME = 'tenant_id'
            AND tb.TABLE_TYPE = 'BASE TABLE'`
      );
      const tenantTables = colRows
        .map(r => String(r.t))
        .filter(t => t.toLowerCase() !== 'tenants'); // la tabla tenants se borra al final

      await connection.beginTransaction();
      // Desactiva FKs para no depender del orden de borrado
      await connection.query('SET FOREIGN_KEY_CHECKS = 0');

      for (const table of tenantTables) {
        // Nombre de tabla viene de information_schema (no de input del usuario)
        const [res] = await connection.query<ResultSetHeader>(
          `DELETE FROM \`${table}\` WHERE tenant_id = ?`,
          [id]
        );
        deletedRows += res.affectedRows || 0;
      }

      // Usuarios del tenant (por si la columna se llama distinto o quedaron sueltos)
      const [uRes] = await connection.query<ResultSetHeader>(
        'DELETE FROM users WHERE tenant_id = ?',
        [id]
      );
      deletedRows += uRes.affectedRows || 0;

      // Finalmente, el tenant
      await connection.query('DELETE FROM tenants WHERE id = ?', [id]);

      await connection.query('SET FOREIGN_KEY_CHECKS = 1');
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      try { await connection.query('SET FOREIGN_KEY_CHECKS = 1'); } catch { /* noop */ }
      throw error;
    } finally {
      connection.release();
    }
    return { id, name: tenant.name, deletedRows };
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

  async getModules(tenantId: string): Promise<{ enabledModules: string[] | null; businessType: string | null }> {
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT enabled_modules, business_type FROM tenants WHERE id = ?',
      [tenantId]
    );
    if (rows.length === 0) throw new AppError('Tenant no encontrado', 404);
    const row = rows[0];
    const raw = row.enabled_modules;
    const enabledModules: string[] | null = raw
      ? (typeof raw === 'string' ? JSON.parse(raw) : raw)
      : null;
    return { enabledModules, businessType: row.business_type ?? null };
  }

  async updateModules(tenantId: string, modules: string[]): Promise<{ enabledModules: string[] }> {
    const [rows] = await db.execute<RowDataPacket[]>('SELECT id FROM tenants WHERE id = ?', [tenantId]);
    if (rows.length === 0) throw new AppError('Tenant no encontrado', 404);
    await db.execute('UPDATE tenants SET enabled_modules = ? WHERE id = ?', [JSON.stringify(modules), tenantId]);
    return { enabledModules: modules };
  }

  // ── Tarjetas del marketplace (página principal) ─────────────────────────────
  async getMarketplaceCards(): Promise<any[]> {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT t.id, t.name, t.slug, t.business_type AS businessType, t.status,
              si.logo_url        AS logoUrl,
              si.card_cover_url  AS coverUrl,
              si.card_description AS cardDescription,
              si.municipality    AS city,
              si.business_hours   AS businessHours,
              COALESCE(si.is_verified, 0)          AS isVerified,
              COALESCE(si.open_state, 'open')      AS openStateFallback,
              COALESCE(si.marketplace_visible, 1)  AS marketplaceVisible,
              COALESCE(si.marketplace_order, 0)    AS marketplaceOrder,
              (SELECT COUNT(*) FROM sedes s WHERE s.tenant_id = t.id) AS sedeCount,
              (SELECT COUNT(*) FROM products p WHERE p.tenant_id = t.id AND p.stock > 0 AND p.published_in_store = 1) AS productCount
       FROM tenants t
       LEFT JOIN store_info si ON si.tenant_id = t.id
       WHERE t.status = 'activo'
       ORDER BY COALESCE(si.marketplace_order, 0) ASC, t.name ASC`
    );
    return rows.map((r) => {
      const { businessHours, openStateFallback, ...rest } = r as any;
      return {
        ...rest,
        isVerified: Boolean(r.isVerified),
        marketplaceVisible: Boolean(r.marketplaceVisible),
        hasSchedule: hasAnySchedule(parseBusinessHours(businessHours)),
        openState: computeOpenState(businessHours, openStateFallback === 'closed' ? 'closed' : 'open'),
      };
    });
  }

  async updateMarketplaceCard(
    tenantId: string,
    data: {
      coverUrl?: string | null;
      cardDescription?: string | null;
      isVerified?: boolean;
      openState?: 'open' | 'closed';
      marketplaceVisible?: boolean;
      marketplaceOrder?: number;
    }
  ): Promise<void> {
    const [tRows] = await db.execute<RowDataPacket[]>('SELECT id, name FROM tenants WHERE id = ?', [tenantId]);
    if (tRows.length === 0) throw new AppError('Tenant no encontrado', 404);

    // Construye SET dinámico solo con los campos provistos
    const fields: string[] = [];
    const values: any[] = [];
    if (data.coverUrl !== undefined)         { fields.push('card_cover_url = ?');     values.push(data.coverUrl || null); }
    if (data.cardDescription !== undefined)  { fields.push('card_description = ?');    values.push(data.cardDescription || null); }
    if (data.isVerified !== undefined)       { fields.push('is_verified = ?');        values.push(data.isVerified ? 1 : 0); }
    if (data.openState !== undefined)        { fields.push('open_state = ?');         values.push(data.openState === 'closed' ? 'closed' : 'open'); }
    if (data.marketplaceVisible !== undefined){ fields.push('marketplace_visible = ?'); values.push(data.marketplaceVisible ? 1 : 0); }
    if (data.marketplaceOrder !== undefined) { fields.push('marketplace_order = ?');   values.push(Number(data.marketplaceOrder) || 0); }

    if (fields.length === 0) return;

    const [result] = await db.execute<ResultSetHeader>(
      `UPDATE store_info SET ${fields.join(', ')} WHERE tenant_id = ?`,
      [...values, tenantId]
    );

    // Tenant legacy sin fila en store_info: la creamos y reintentamos
    if (result.affectedRows === 0) {
      await db.execute(
        'INSERT INTO store_info (tenant_id, name) VALUES (?, ?)',
        [tenantId, tRows[0].name]
      );
      await db.execute(
        `UPDATE store_info SET ${fields.join(', ')} WHERE tenant_id = ?`,
        [...values, tenantId]
      );
    }
  }

  // ── Tarjetas externas (comercios fuera del aplicativo) ──────────────────────
  // Tarjetas de la página principal que NO son tenants: redirigen a un link externo.
  private externalEnsured = false;
  async ensureExternalCardsTable(): Promise<void> {
    if (this.externalEnsured) return;
    await db.execute(
      `CREATE TABLE IF NOT EXISTS marketplace_external_cards (
        id           VARCHAR(36) PRIMARY KEY,
        name         VARCHAR(255) NOT NULL,
        slug         VARCHAR(255) NULL,
        logo_url     VARCHAR(800) NULL,
        cover_url    VARCHAR(800) NULL,
        description  VARCHAR(500) NULL,
        external_url VARCHAR(1000) NOT NULL,
        city         VARCHAR(255) NULL,
        is_verified  TINYINT(1) NOT NULL DEFAULT 0,
        is_visible   TINYINT(1) NOT NULL DEFAULT 1,
        sort_order   INT NOT NULL DEFAULT 0,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_mec_visible (is_visible, sort_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
    this.externalEnsured = true;
  }

  private mapExternalCard = (r: any) => ({
    id: r.id, name: r.name, slug: r.slug, logoUrl: r.logo_url, coverUrl: r.cover_url,
    cardDescription: r.description, externalUrl: r.external_url, city: r.city,
    isVerified: Boolean(r.is_verified), marketplaceVisible: Boolean(r.is_visible),
    marketplaceOrder: Number(r.sort_order) || 0,
  });

  async listExternalCards(): Promise<any[]> {
    await this.ensureExternalCardsTable();
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT * FROM marketplace_external_cards ORDER BY sort_order ASC, name ASC'
    );
    return rows.map(this.mapExternalCard);
  }

  async createExternalCard(data: any): Promise<any> {
    await this.ensureExternalCardsTable();
    if (!String(data?.name || '').trim()) throw new AppError('El nombre es requerido', 400);
    if (!String(data?.externalUrl || '').trim()) throw new AppError('El link externo es requerido', 400);
    const id = uuidv4();
    await db.execute(
      `INSERT INTO marketplace_external_cards
         (id, name, slug, logo_url, cover_url, description, external_url, city, is_verified, is_visible, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, String(data.name).trim(), data.slug || null, data.logoUrl || null, data.coverUrl || null,
       data.cardDescription || null, String(data.externalUrl).trim(), data.city || null,
       data.isVerified ? 1 : 0, data.marketplaceVisible === false ? 0 : 1, Number(data.marketplaceOrder) || 0]
    );
    return { id };
  }

  async updateExternalCard(id: string, data: any): Promise<void> {
    await this.ensureExternalCardsTable();
    const fields: string[] = [];
    const values: any[] = [];
    if (data.name !== undefined)              { fields.push('name = ?');         values.push(String(data.name).trim()); }
    if (data.slug !== undefined)              { fields.push('slug = ?');         values.push(data.slug || null); }
    if (data.logoUrl !== undefined)           { fields.push('logo_url = ?');     values.push(data.logoUrl || null); }
    if (data.coverUrl !== undefined)          { fields.push('cover_url = ?');    values.push(data.coverUrl || null); }
    if (data.cardDescription !== undefined)   { fields.push('description = ?');  values.push(data.cardDescription || null); }
    if (data.externalUrl !== undefined)       { fields.push('external_url = ?'); values.push(String(data.externalUrl).trim()); }
    if (data.city !== undefined)              { fields.push('city = ?');         values.push(data.city || null); }
    if (data.isVerified !== undefined)        { fields.push('is_verified = ?');  values.push(data.isVerified ? 1 : 0); }
    if (data.marketplaceVisible !== undefined){ fields.push('is_visible = ?');   values.push(data.marketplaceVisible ? 1 : 0); }
    if (data.marketplaceOrder !== undefined)  { fields.push('sort_order = ?');   values.push(Number(data.marketplaceOrder) || 0); }
    if (fields.length === 0) return;
    const [result] = await db.execute<ResultSetHeader>(
      `UPDATE marketplace_external_cards SET ${fields.join(', ')} WHERE id = ?`, [...values, id]
    );
    if (result.affectedRows === 0) throw new AppError('Tarjeta externa no encontrada', 404);
  }

  async deleteExternalCard(id: string): Promise<void> {
    await this.ensureExternalCardsTable();
    await db.execute('DELETE FROM marketplace_external_cards WHERE id = ?', [id]);
  }
}

export const tenantsService = new TenantsService();
