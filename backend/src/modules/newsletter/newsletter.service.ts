import { db } from '../../config';
import { AppError } from '../../common/middleware';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';

interface NewsletterRow extends RowDataPacket {
  id: number;
  tenant_id: string;
  email: string;
  accepted_terms: number;
  subscribed_at: string;
  unsubscribed_at: string | null;
  is_active: number;
}

export interface NewsletterItem {
  id: number;
  email: string;
  acceptedTerms: boolean;
  subscribedAt: string;
  unsubscribedAt: string | null;
  isActive: boolean;
}

export class NewsletterService {
  private mapItem(row: NewsletterRow): NewsletterItem {
    return {
      id: row.id,
      email: row.email,
      acceptedTerms: row.accepted_terms !== 0,
      subscribedAt: row.subscribed_at,
      unsubscribedAt: row.unsubscribed_at || null,
      isActive: row.is_active !== 0,
    };
  }

  async subscribe(tenantId: string, email: string, acceptedTerms: boolean): Promise<NewsletterItem> {
    const [existing] = await db.execute<NewsletterRow[]>(
      'SELECT * FROM newsletter_subscribers WHERE tenant_id = ? AND email = ?',
      [tenantId, email]
    );

    if (existing.length > 0) {
      const row = existing[0];
      if (row.is_active) {
        return this.mapItem(row);
      }
      await db.execute<ResultSetHeader>(
        'UPDATE newsletter_subscribers SET is_active = 1, unsubscribed_at = NULL, subscribed_at = NOW() WHERE id = ?',
        [row.id]
      );
      return this.mapItem({ ...row, is_active: 1, unsubscribed_at: null });
    }

    await db.execute<ResultSetHeader>(
      'INSERT INTO newsletter_subscribers (id, tenant_id, email, accepted_terms, is_active) VALUES (?, ?, ?, ?, 1)',
      [uuidv4(), tenantId, email, acceptedTerms ? 1 : 0]
    );

    const [rows] = await db.execute<NewsletterRow[]>(
      'SELECT * FROM newsletter_subscribers WHERE tenant_id = ? AND email = ?',
      [tenantId, email]
    );
    return this.mapItem(rows[0]);
  }

  async unsubscribe(tenantId: string, email: string): Promise<void> {
    const [result] = await db.execute<ResultSetHeader>(
      'UPDATE newsletter_subscribers SET is_active = 0, unsubscribed_at = NOW() WHERE tenant_id = ? AND email = ? AND is_active = 1',
      [tenantId, email]
    );

    if (result.affectedRows === 0) {
      throw new AppError('Suscriptor no encontrado', 404);
    }
  }

  async findAll(tenantId: string, page = 1, limit = 20): Promise<{ items: NewsletterItem[]; total: number }> {
    // Enteros validados e interpolados: mysql2 `execute` con `LIMIT ?`/`OFFSET ?` falla
    // (envía los placeholders como string y MySQL los rechaza).
    const lim = Math.max(1, Math.min(1000, Math.floor(Number(limit) || 20)));
    const off = Math.max(0, (Math.max(1, Math.floor(Number(page) || 1)) - 1) * lim);

    const [countRows] = await db.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as total FROM newsletter_subscribers WHERE tenant_id = ?',
      [tenantId]
    );
    const total = countRows[0].total as number;

    const [rows] = await db.execute<NewsletterRow[]>(
      `SELECT * FROM newsletter_subscribers WHERE tenant_id = ? ORDER BY subscribed_at DESC LIMIT ${lim} OFFSET ${off}`,
      [tenantId]
    );

    return {
      items: rows.map(this.mapItem.bind(this)),
      total,
    };
  }

  async exportCSV(tenantId: string): Promise<NewsletterItem[]> {
    const [rows] = await db.execute<NewsletterRow[]>(
      'SELECT * FROM newsletter_subscribers WHERE tenant_id = ? AND is_active = 1 ORDER BY subscribed_at DESC',
      [tenantId]
    );
    return rows.map(this.mapItem.bind(this));
  }
}

export const newsletterService = new NewsletterService();
