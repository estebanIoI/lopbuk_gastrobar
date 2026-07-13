import { db } from '../../config';
import { AppError } from '../../common/middleware';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

interface FaqCategoryRow extends RowDataPacket {
  id: string;
  tenant_id: string;
  name: string;
  sort_order: number;
  is_active: number;
}

interface FaqItemRow extends RowDataPacket {
  id: string;
  tenant_id: string;
  category_id: string;
  question: string;
  answer: string;
  sort_order: number;
  is_active: number;
}

export interface FaqCategory {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface FaqItem {
  id: string;
  categoryId: string;
  question: string;
  answer: string;
  sortOrder: number;
  isActive: boolean;
}

export interface FaqCategoryWithItems extends FaqCategory {
  items: FaqItem[];
}

export class FaqService {
  private mapCategory(row: FaqCategoryRow): FaqCategory {
    return {
      id: row.id,
      name: row.name,
      sortOrder: row.sort_order ?? 0,
      isActive: row.is_active !== 0,
    };
  }

  private mapItem(row: FaqItemRow): FaqItem {
    return {
      id: row.id,
      categoryId: row.category_id,
      question: row.question,
      answer: row.answer,
      sortOrder: row.sort_order ?? 0,
      isActive: row.is_active !== 0,
    };
  }

  async findAllCategories(tenantId: string): Promise<FaqCategory[]> {
    const [rows] = await db.execute<FaqCategoryRow[]>(
      `SELECT id, tenant_id, name, COALESCE(sort_order, 0) AS sort_order,
              COALESCE(is_active, 1) AS is_active
       FROM faq_categories
       WHERE tenant_id = ?
       ORDER BY sort_order ASC, name ASC`,
      [tenantId]
    );
    return rows.map(this.mapCategory.bind(this));
  }

  async createCategory(tenantId: string, data: { name: string; sortOrder?: number }): Promise<FaqCategory> {
    const id = crypto.randomUUID();
    const sortOrder = data.sortOrder ?? 0;

    await db.execute<ResultSetHeader>(
      `INSERT INTO faq_categories (id, tenant_id, name, sort_order, is_active)
       VALUES (?, ?, ?, ?, 1)`,
      [id, tenantId, data.name, sortOrder]
    );

    return { id, name: data.name, sortOrder, isActive: true };
  }

  async updateCategory(tenantId: string, id: string, data: { name?: string; sortOrder?: number }): Promise<FaqCategory> {
    const [rows] = await db.execute<FaqCategoryRow[]>(
      'SELECT * FROM faq_categories WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (rows.length === 0) throw new AppError('Categoría no encontrada', 404);

    const current = rows[0];
    const name = data.name ?? current.name;
    const sortOrder = data.sortOrder !== undefined ? data.sortOrder : (current.sort_order ?? 0);

    await db.execute<ResultSetHeader>(
      'UPDATE faq_categories SET name = ?, sort_order = ? WHERE id = ? AND tenant_id = ?',
      [name, sortOrder, id, tenantId]
    );

    return this.mapCategory({ ...current, name, sort_order: sortOrder });
  }

  async deleteCategory(tenantId: string, id: string): Promise<void> {
    const [rows] = await db.execute<FaqCategoryRow[]>(
      'SELECT id FROM faq_categories WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (rows.length === 0) throw new AppError('Categoría no encontrada', 404);

    await db.execute<ResultSetHeader>(
      'DELETE FROM faq_items WHERE category_id = ? AND tenant_id = ?',
      [id, tenantId]
    );

    await db.execute<ResultSetHeader>(
      'DELETE FROM faq_categories WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
  }

  async findAllItems(tenantId: string, categoryId?: string): Promise<FaqItem[]> {
    let query = `
      SELECT id, tenant_id, category_id, question, answer,
             COALESCE(sort_order, 0) AS sort_order,
             COALESCE(is_active, 1) AS is_active
      FROM faq_items
      WHERE tenant_id = ?
    `;
    const params: (string | undefined)[] = [tenantId];

    if (categoryId) {
      query += ' AND category_id = ?';
      params.push(categoryId);
    }

    query += ' ORDER BY sort_order ASC, question ASC';

    const [rows] = await db.execute<FaqItemRow[]>(query, params);
    return rows.map(this.mapItem.bind(this));
  }

  async createItem(tenantId: string, data: { categoryId: string; question: string; answer: string; sortOrder?: number }): Promise<FaqItem> {
    const [catRows] = await db.execute<FaqCategoryRow[]>(
      'SELECT id FROM faq_categories WHERE id = ? AND tenant_id = ?',
      [data.categoryId, tenantId]
    );
    if (catRows.length === 0) throw new AppError('Categoría no encontrada', 404);

    const id = crypto.randomUUID();
    const sortOrder = data.sortOrder ?? 0;

    await db.execute<ResultSetHeader>(
      `INSERT INTO faq_items (id, tenant_id, category_id, question, answer, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [id, tenantId, data.categoryId, data.question, data.answer, sortOrder]
    );

    return { id, categoryId: data.categoryId, question: data.question, answer: data.answer, sortOrder, isActive: true };
  }

  async updateItem(tenantId: string, id: string, data: { categoryId?: string; question?: string; answer?: string; sortOrder?: number }): Promise<FaqItem> {
    const [rows] = await db.execute<FaqItemRow[]>(
      'SELECT * FROM faq_items WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (rows.length === 0) throw new AppError('Item no encontrado', 404);

    const current = rows[0];

    if (data.categoryId) {
      const [catRows] = await db.execute<FaqCategoryRow[]>(
        'SELECT id FROM faq_categories WHERE id = ? AND tenant_id = ?',
        [data.categoryId, tenantId]
      );
      if (catRows.length === 0) throw new AppError('Categoría no encontrada', 404);
    }

    const categoryId = data.categoryId ?? current.category_id;
    const question = data.question ?? current.question;
    const answer = data.answer ?? current.answer;
    const sortOrder = data.sortOrder !== undefined ? data.sortOrder : (current.sort_order ?? 0);

    await db.execute<ResultSetHeader>(
      'UPDATE faq_items SET category_id = ?, question = ?, answer = ?, sort_order = ? WHERE id = ? AND tenant_id = ?',
      [categoryId, question, answer, sortOrder, id, tenantId]
    );

    return this.mapItem({ ...current, category_id: categoryId, question, answer, sort_order: sortOrder });
  }

  async deleteItem(tenantId: string, id: string): Promise<void> {
    const [result] = await db.execute<ResultSetHeader>(
      'DELETE FROM faq_items WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (result.affectedRows === 0) {
      throw new AppError('Item no encontrado', 404);
    }
  }

  async findPublic(tenantSlug: string): Promise<FaqCategoryWithItems[]> {
    const [tenantRows] = await db.execute<RowDataPacket[]>(
      `SELECT id FROM tenants WHERE slug = ? AND status = 'activo' LIMIT 1`,
      [tenantSlug]
    );
    if (tenantRows.length === 0) throw new AppError('Tienda no encontrada', 404);

    const tenantId = tenantRows[0].id;

    const [categories] = await db.execute<FaqCategoryRow[]>(
      `SELECT id, tenant_id, name, COALESCE(sort_order, 0) AS sort_order,
              COALESCE(is_active, 1) AS is_active
       FROM faq_categories
       WHERE tenant_id = ? AND is_active = 1
       ORDER BY sort_order ASC, name ASC`,
      [tenantId]
    );

    const [items] = await db.execute<FaqItemRow[]>(
      `SELECT id, tenant_id, category_id, question, answer,
              COALESCE(sort_order, 0) AS sort_order,
              COALESCE(is_active, 1) AS is_active
       FROM faq_items
       WHERE tenant_id = ? AND is_active = 1
       ORDER BY sort_order ASC, question ASC`,
      [tenantId]
    );

    const itemMap = new Map<string, FaqItem[]>();
    for (const item of items) {
      const list = itemMap.get(item.category_id) || [];
      list.push(this.mapItem(item));
      itemMap.set(item.category_id, list);
    }

    return categories.map((cat) => ({
      ...this.mapCategory(cat),
      items: itemMap.get(cat.id) || [],
    }));
  }
}

export const faqService = new FaqService();
