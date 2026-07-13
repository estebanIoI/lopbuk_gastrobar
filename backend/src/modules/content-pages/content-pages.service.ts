import { db } from '../../config';
import { AppError } from '../../common/middleware';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';

interface ContentPageRow extends RowDataPacket {
  id: number;
  tenant_id: string;
  slug: string;
  title: string;
  content: string;
  meta_title: string | null;
  meta_description: string | null;
  page_type: string;
  is_published: number;
  sort_order: number;
}

export interface ContentPageItem {
  id: number;
  slug: string;
  title: string;
  content: string;
  metaTitle?: string;
  metaDescription?: string;
  pageType: string;
  isPublished: boolean;
  sortOrder: number;
}

export class ContentPagesService {
  private mapItem(row: ContentPageRow): ContentPageItem {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      content: row.content,
      metaTitle: row.meta_title || undefined,
      metaDescription: row.meta_description || undefined,
      pageType: row.page_type,
      isPublished: row.is_published !== 0,
      sortOrder: row.sort_order ?? 0,
    };
  }

  async findAll(tenantId: string): Promise<ContentPageItem[]> {
    const [rows] = await db.execute<ContentPageRow[]>(
      'SELECT * FROM content_pages WHERE tenant_id = ? ORDER BY sort_order ASC, title ASC',
      [tenantId]
    );
    return rows.map(this.mapItem.bind(this));
  }

  async findById(tenantId: string, id: number): Promise<ContentPageItem> {
    const [rows] = await db.execute<ContentPageRow[]>(
      'SELECT * FROM content_pages WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (rows.length === 0) throw new AppError('Página no encontrada', 404);
    return this.mapItem(rows[0]);
  }

  async findBySlug(tenantId: string, slug: string): Promise<ContentPageItem> {
    const [rows] = await db.execute<ContentPageRow[]>(
      'SELECT * FROM content_pages WHERE slug = ? AND tenant_id = ?',
      [slug, tenantId]
    );
    if (rows.length === 0) throw new AppError('Página no encontrada', 404);
    return this.mapItem(rows[0]);
  }

  async create(tenantId: string, data: {
    slug: string;
    title: string;
    content: string;
    metaTitle?: string;
    metaDescription?: string;
    pageType?: string;
    isPublished?: boolean;
  }): Promise<ContentPageItem> {
    const [maxRow] = await db.execute<RowDataPacket[]>(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 as nextOrder FROM content_pages WHERE tenant_id = ?',
      [tenantId]
    );
    const nextOrder = maxRow[0].nextOrder as number;

    // id es varchar(36) (no auto-increment) → generar uuid; no usar insertId.
    const id = uuidv4();
    await db.execute<ResultSetHeader>(
      `INSERT INTO content_pages (id, tenant_id, slug, title, content, meta_title, meta_description, page_type, is_published, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        tenantId,
        data.slug,
        data.title,
        data.content,
        data.metaTitle || null,
        data.metaDescription || null,
        data.pageType || 'custom',
        data.isPublished !== false ? 1 : 0,
        nextOrder,
      ]
    );

    const [rows] = await db.execute<ContentPageRow[]>(
      'SELECT * FROM content_pages WHERE id = ?',
      [id]
    );
    return this.mapItem(rows[0]);
  }

  async update(tenantId: string, id: number, data: {
    slug?: string;
    title?: string;
    content?: string;
    metaTitle?: string;
    metaDescription?: string;
    pageType?: string;
    isPublished?: boolean;
    sortOrder?: number;
  }): Promise<ContentPageItem> {
    const [rows] = await db.execute<ContentPageRow[]>(
      'SELECT * FROM content_pages WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (rows.length === 0) throw new AppError('Página no encontrada', 404);

    const current = rows[0];
    const slug = data.slug ?? current.slug;
    const title = data.title ?? current.title;
    const content = data.content ?? current.content;
    const metaTitle = data.metaTitle !== undefined ? data.metaTitle : current.meta_title;
    const metaDescription = data.metaDescription !== undefined ? data.metaDescription : current.meta_description;
    const pageType = data.pageType ?? current.page_type;
    const isPublished = data.isPublished !== undefined ? (data.isPublished ? 1 : 0) : current.is_published;
    const sortOrder = data.sortOrder ?? current.sort_order ?? 0;

    await db.execute<ResultSetHeader>(
      `UPDATE content_pages
       SET slug = ?, title = ?, content = ?, meta_title = ?, meta_description = ?, page_type = ?, is_published = ?, sort_order = ?
       WHERE id = ? AND tenant_id = ?`,
      [slug, title, content, metaTitle, metaDescription, pageType, isPublished, sortOrder, id, tenantId]
    );

    return this.mapItem({ ...current, slug, title, content, meta_title: metaTitle ?? null, meta_description: metaDescription ?? null, page_type: pageType, is_published: isPublished, sort_order: sortOrder });
  }

  async delete(tenantId: string, id: number): Promise<void> {
    const [result] = await db.execute<ResultSetHeader>(
      'DELETE FROM content_pages WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );

    if (result.affectedRows === 0) {
      throw new AppError('Página no encontrada', 404);
    }
  }

  async findPublicBySlug(tenantSlug: string, pageSlug: string): Promise<ContentPageItem> {
    const [tenants] = await db.execute<RowDataPacket[]>(
      "SELECT id FROM tenants WHERE slug = ? AND status = 'activo' LIMIT 1",
      [tenantSlug]
    );
    if (tenants.length === 0) throw new AppError('Tienda no encontrada', 404);

    const tenantId = tenants[0].id as string;
    const [rows] = await db.execute<ContentPageRow[]>(
      'SELECT * FROM content_pages WHERE tenant_id = ? AND slug = ? AND is_published = 1',
      [tenantId, pageSlug]
    );
    if (rows.length === 0) throw new AppError('Página no encontrada', 404);
    return this.mapItem(rows[0]);
  }
}

export const contentPagesService = new ContentPagesService();
