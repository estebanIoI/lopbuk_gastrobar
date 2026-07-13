import { db } from '../../config';
import { AppError } from '../../common/middleware';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';

interface PopularSearchRow extends RowDataPacket {
  id: string;
  tenant_id: string;
  term: string;
  sort_order: number;
  is_active: number;
}

export interface PopularSearchItem {
  id: string;
  term: string;
  sortOrder: number;
  isActive: boolean;
}

export class PopularSearchesService {
  private mapItem(row: PopularSearchRow): PopularSearchItem {
    return {
      id: row.id,
      term: row.term,
      sortOrder: row.sort_order ?? 0,
      isActive: row.is_active !== 0,
    };
  }

  async findAll(tenantId: string): Promise<PopularSearchItem[]> {
    const [rows] = await db.execute<PopularSearchRow[]>(
      'SELECT * FROM popular_searches WHERE tenant_id = ? ORDER BY sort_order ASC',
      [tenantId]
    );
    return rows.map(this.mapItem.bind(this));
  }

  async create(tenantId: string, data: { term: string; sortOrder?: number }): Promise<PopularSearchItem> {
    const sortOrder = data.sortOrder ?? 0;
    const id = uuidv4();

    await db.execute<ResultSetHeader>(
      'INSERT INTO popular_searches (id, tenant_id, term, sort_order, is_active) VALUES (?, ?, ?, ?, 1)',
      [id, tenantId, data.term, sortOrder]
    );

    return { id, term: data.term, sortOrder, isActive: true };
  }

  async update(tenantId: string, id: string, data: { term?: string; sortOrder?: number }): Promise<PopularSearchItem> {
    const [rows] = await db.execute<PopularSearchRow[]>(
      'SELECT * FROM popular_searches WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (rows.length === 0) throw new AppError('Búsqueda no encontrada', 404);

    const current = rows[0];
    const term = data.term ?? current.term;
    const sortOrder = data.sortOrder ?? current.sort_order ?? 0;

    await db.execute<ResultSetHeader>(
      'UPDATE popular_searches SET term = ?, sort_order = ? WHERE id = ? AND tenant_id = ?',
      [term, sortOrder, id, tenantId]
    );

    return this.mapItem({ ...current, term, sort_order: sortOrder });
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const [result] = await db.execute<ResultSetHeader>(
      'UPDATE popular_searches SET is_active = 0 WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );

    if (result.affectedRows === 0) {
      throw new AppError('Búsqueda no encontrada', 404);
    }
  }

  async findPublic(tenantSlug: string): Promise<PopularSearchItem[]> {
    const [tenants] = await db.execute<RowDataPacket[]>(
      "SELECT id FROM tenants WHERE slug = ? AND status = 'activo' LIMIT 1",
      [tenantSlug]
    );
    if (tenants.length === 0) return [];

    const tenantId = tenants[0].id as string;
    const [rows] = await db.execute<PopularSearchRow[]>(
      'SELECT * FROM popular_searches WHERE tenant_id = ? AND is_active = 1 ORDER BY sort_order ASC',
      [tenantId]
    );
    return rows.map(this.mapItem.bind(this));
  }
}

export const popularSearchesService = new PopularSearchesService();
