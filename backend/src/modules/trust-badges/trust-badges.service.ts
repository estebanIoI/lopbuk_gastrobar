import { db } from '../../config';
import { AppError } from '../../common/middleware';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';

interface TrustBadgeRow extends RowDataPacket {
  id: string;
  tenant_id: string;
  icon: string;
  title: string;
  description: string;
  sort_order: number;
  is_active: number;
}

export interface TrustBadgeItem {
  id: string;
  icon: string;
  title: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
}

export class TrustBadgesService {
  private mapItem(row: TrustBadgeRow): TrustBadgeItem {
    return {
      id: row.id,
      icon: row.icon,
      title: row.title,
      description: row.description,
      sortOrder: row.sort_order ?? 0,
      isActive: row.is_active !== 0,
    };
  }

  async findAll(tenantId: string): Promise<TrustBadgeItem[]> {
    const [rows] = await db.execute<TrustBadgeRow[]>(
      'SELECT * FROM trust_badges WHERE tenant_id = ? ORDER BY sort_order ASC',
      [tenantId]
    );
    return rows.map(this.mapItem.bind(this));
  }

  async create(tenantId: string, data: { icon: string; title: string; description: string }): Promise<TrustBadgeItem> {
    const [maxRow] = await db.execute<RowDataPacket[]>(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 as nextOrder FROM trust_badges WHERE tenant_id = ?',
      [tenantId]
    );
    const nextOrder = maxRow[0].nextOrder as number;
    const id = uuidv4();

    await db.execute<ResultSetHeader>(
      'INSERT INTO trust_badges (id, tenant_id, icon, title, description, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [id, tenantId, data.icon, data.title, data.description, nextOrder]
    );

    return { id, icon: data.icon, title: data.title, description: data.description, sortOrder: nextOrder, isActive: true };
  }

  async update(tenantId: string, id: string, data: { icon?: string; title?: string; description?: string; sortOrder?: number }): Promise<TrustBadgeItem> {
    const [rows] = await db.execute<TrustBadgeRow[]>(
      'SELECT * FROM trust_badges WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (rows.length === 0) throw new AppError('Insignia no encontrada', 404);

    const current = rows[0];
    const icon = data.icon ?? current.icon;
    const title = data.title ?? current.title;
    const description = data.description ?? current.description;
    const sortOrder = data.sortOrder ?? current.sort_order ?? 0;

    await db.execute<ResultSetHeader>(
      'UPDATE trust_badges SET icon = ?, title = ?, description = ?, sort_order = ? WHERE id = ? AND tenant_id = ?',
      [icon, title, description, sortOrder, id, tenantId]
    );

    return this.mapItem({ ...current, icon, title, description, sort_order: sortOrder });
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const [result] = await db.execute<ResultSetHeader>(
      'UPDATE trust_badges SET is_active = 0 WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );

    if (result.affectedRows === 0) {
      throw new AppError('Insignia no encontrada', 404);
    }
  }

  async findPublic(tenantSlug: string): Promise<TrustBadgeItem[]> {
    const [tenants] = await db.execute<RowDataPacket[]>(
      "SELECT id FROM tenants WHERE slug = ? AND status = 'activo' LIMIT 1",
      [tenantSlug]
    );
    if (tenants.length === 0) return [];

    const tenantId = tenants[0].id as string;
    const [rows] = await db.execute<TrustBadgeRow[]>(
      'SELECT * FROM trust_badges WHERE tenant_id = ? AND is_active = 1 ORDER BY sort_order ASC',
      [tenantId]
    );
    return rows.map(this.mapItem.bind(this));
  }
}

export const trustBadgesService = new TrustBadgesService();
