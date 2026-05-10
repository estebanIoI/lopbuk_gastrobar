import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config';
import { AppError } from '../../common/middleware';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DevRequestType = 'objetivo' | 'mejora' | 'actualizacion' | 'bug' | 'otro';
export type DevRequestPriority = 'baja' | 'media' | 'alta';
export type DevRequestStatus =
  | 'pendiente'
  | 'en_revision'
  | 'cotizado'
  | 'aprobado'
  | 'en_progreso'
  | 'completado'
  | 'rechazado';

interface DevRequestRow extends RowDataPacket {
  id: string;
  tenant_id: string;
  user_id: string;
  tenant_name: string | null;
  requester_name: string;
  title: string;
  description: string;
  type: DevRequestType;
  priority: DevRequestPriority;
  status: DevRequestStatus;
  estimated_hours: number | null;
  price_per_hour: number | null;
  total_price: number | null;
  admin_notes: string | null;
  rejection_reason: string | null;
  paid_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class DevRequestsService {

  // ── Comerciante: ver sus solicitudes ──────────────────────────────────────

  async findByTenant(tenantId: string, filters?: { status?: DevRequestStatus; type?: DevRequestType }) {
    let sql = `SELECT * FROM dev_requests WHERE tenant_id = ?`;
    const params: any[] = [tenantId];

    if (filters?.status) { sql += ' AND status = ?'; params.push(filters.status); }
    if (filters?.type)   { sql += ' AND type = ?';   params.push(filters.type); }

    sql += ' ORDER BY created_at DESC';
    const [rows] = await db.execute<DevRequestRow[]>(sql, params);
    return rows.map(this.mapRow);
  }

  // ── Comerciante: crear solicitud ──────────────────────────────────────────

  async create(tenantId: string, userId: string, data: {
    title: string;
    description: string;
    type: DevRequestType;
    priority: DevRequestPriority;
    requesterName: string;
    tenantName?: string;
  }) {
    const id = uuidv4();
    await db.execute<ResultSetHeader>(
      `INSERT INTO dev_requests
       (id, tenant_id, user_id, tenant_name, requester_name, title, description, type, priority)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, tenantId, userId, data.tenantName || null, data.requesterName,
       data.title, data.description, data.type, data.priority]
    );
    return this.findById(id);
  }

  // ── Comerciante: eliminar solicitud pendiente ─────────────────────────────

  async confirmQuoteByTenant(tenantId: string, id: string) {
    const [rows] = await db.execute<DevRequestRow[]>(
      'SELECT id, status FROM dev_requests WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (rows.length === 0) throw new AppError('Solicitud no encontrada', 404);
    if (rows[0].status !== 'cotizado') {
      throw new AppError('Solo se pueden confirmar solicitudes en estado cotizado', 400);
    }
    await db.execute(
      `UPDATE dev_requests SET status = 'aprobado', updated_at = NOW() WHERE id = ?`,
      [id]
    );
    return this.findById(id);
  }

  async deleteByTenant(tenantId: string, id: string) {
    const [rows] = await db.execute<DevRequestRow[]>(
      'SELECT id, status FROM dev_requests WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (rows.length === 0) throw new AppError('Solicitud no encontrada', 404);
    if (rows[0].status !== 'pendiente') {
      throw new AppError('Solo se pueden eliminar solicitudes en estado pendiente', 400);
    }
    await db.execute('DELETE FROM dev_requests WHERE id = ?', [id]);
  }

  // ── Superadmin: ver todas las solicitudes ─────────────────────────────────

  async findAll(filters?: {
    status?: DevRequestStatus;
    type?: DevRequestType;
    tenantId?: string;
  }) {
    let sql = `SELECT * FROM dev_requests WHERE 1=1`;
    const params: any[] = [];

    if (filters?.status)   { sql += ' AND status = ?';    params.push(filters.status); }
    if (filters?.type)     { sql += ' AND type = ?';      params.push(filters.type); }
    if (filters?.tenantId) { sql += ' AND tenant_id = ?'; params.push(filters.tenantId); }

    sql += ' ORDER BY created_at DESC';
    const [rows] = await db.execute<DevRequestRow[]>(sql, params);
    return rows.map(this.mapRow);
  }

  // ── Superadmin: cotizar solicitud ─────────────────────────────────────────

  async quote(id: string, data: { estimatedHours: number; pricePerHour: number; adminNotes?: string }) {
    const totalPrice = Math.round(data.estimatedHours * data.pricePerHour * 100) / 100;
    await db.execute(
      `UPDATE dev_requests
       SET estimated_hours = ?, price_per_hour = ?, total_price = ?, admin_notes = ?, status = 'cotizado', updated_at = NOW()
       WHERE id = ?`,
      [data.estimatedHours, data.pricePerHour, totalPrice, data.adminNotes || null, id]
    );
    return this.findById(id);
  }

  // ── Superadmin: actualizar estado ─────────────────────────────────────────

  async updateStatus(id: string, status: DevRequestStatus, options?: {
    adminNotes?: string;
    rejectionReason?: string;
  }) {
    const fields: string[] = ['status = ?', 'updated_at = NOW()'];
    const params: any[] = [status];

    if (options?.adminNotes)     { fields.push('admin_notes = ?');    params.push(options.adminNotes); }
    if (options?.rejectionReason){ fields.push('rejection_reason = ?'); params.push(options.rejectionReason); }
    if (status === 'completado') { fields.push('completed_at = NOW()'); }

    params.push(id);
    await db.execute(`UPDATE dev_requests SET ${fields.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  }

  // ── Configuración de tarifa horaria ──────────────────────────────────────

  async getSettings(): Promise<{ hourlyRate: number; whatsapp: string }> {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT setting_key, setting_value FROM platform_settings
       WHERE setting_key IN ('dev_hourly_rate', 'dev_whatsapp')`
    );
    const map: Record<string, string> = {};
    for (const r of rows) map[r.setting_key] = r.setting_value;
    return {
      hourlyRate: Number(map['dev_hourly_rate']) || 0,
      whatsapp: map['dev_whatsapp'] || '',
    };
  }

  async saveSettings(data: { hourlyRate?: number; whatsapp?: string }) {
    if (data.hourlyRate !== undefined) {
      await db.execute(
        `INSERT INTO platform_settings (setting_key, setting_value) VALUES ('dev_hourly_rate', ?)
         ON DUPLICATE KEY UPDATE setting_value = ?`,
        [String(data.hourlyRate), String(data.hourlyRate)]
      );
    }
    if (data.whatsapp !== undefined) {
      await db.execute(
        `INSERT INTO platform_settings (setting_key, setting_value) VALUES ('dev_whatsapp', ?)
         ON DUPLICATE KEY UPDATE setting_value = ?`,
        [data.whatsapp, data.whatsapp]
      );
    }
    return this.getSettings();
  }

  async createCheckout(tenantId: string, id: string, backUrl: string) {
    const [rows] = await db.execute<DevRequestRow[]>(
      'SELECT * FROM dev_requests WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (rows.length === 0) throw new AppError('Solicitud no encontrada', 404);
    const req = rows[0];
    if (req.status !== 'cotizado') throw new AppError('Solo se pueden pagar solicitudes cotizadas', 400);
    if (!req.total_price) throw new AppError('La solicitud no tiene precio asignado', 400);

    // Get MP access token
    const [mpRows] = await db.execute<RowDataPacket[]>(
      `SELECT setting_value FROM platform_settings WHERE setting_key = 'mp_access_token' LIMIT 1`
    );
    const mpToken: string | null = (mpRows as any[])[0]?.setting_value ?? null;
    if (!mpToken) throw new AppError('MercadoPago no está configurado. Contacta al administrador.', 400);

    const { MercadoPagoConfig, Preference } = await import('mercadopago');
    const client = new MercadoPagoConfig({ accessToken: mpToken });
    const preferenceApi = new Preference(client);

    const pref = await preferenceApi.create({
      body: {
        items: [{
          title: `Desarrollo: ${req.title}`,
          quantity: 1,
          unit_price: Math.round(Number(req.total_price)),
          currency_id: 'COP',
        }],
        back_urls: { success: backUrl, failure: backUrl, pending: backUrl },
        auto_return: 'approved',
        external_reference: id,
      } as any,
    });

    // Mark as approved once checkout is initiated
    await db.execute(
      `UPDATE dev_requests SET status = 'aprobado', paid_at = NOW(), updated_at = NOW() WHERE id = ?`,
      [id]
    );

    return {
      initPoint: pref.init_point,
      sandboxInitPoint: (pref as any).sandbox_init_point,
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async findById(id: string) {
    const [rows] = await db.execute<DevRequestRow[]>('SELECT * FROM dev_requests WHERE id = ?', [id]);
    if (rows.length === 0) throw new AppError('Solicitud no encontrada', 404);
    return this.mapRow(rows[0]);
  }

  private mapRow(row: DevRequestRow) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      tenantName: row.tenant_name,
      requesterName: row.requester_name,
      title: row.title,
      description: row.description,
      type: row.type,
      priority: row.priority,
      status: row.status,
      estimatedHours: row.estimated_hours !== null ? Number(row.estimated_hours) : null,
      pricePerHour: row.price_per_hour !== null ? Number(row.price_per_hour) : null,
      totalPrice: row.total_price !== null ? Number(row.total_price) : null,
      adminNotes: row.admin_notes,
      rejectionReason: row.rejection_reason,
      paidAt: row.paid_at,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const devRequestsService = new DevRequestsService();
