import { db } from '../../config';
import { AppError } from '../../common/middleware';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';

interface HomepageSectionRow extends RowDataPacket {
  id: number;
  tenant_id: string;
  section_type: string;
  title: string;
  enabled: number;
  config: string;
  sort_order: number;
}

export interface HomepageSectionItem {
  id?: number;
  sectionType: string;
  title: string;
  enabled: boolean;
  config: Record<string, unknown>;
  sortOrder: number;
}

export interface HomepageConfig {
  sections: HomepageSectionItem[];
}

export class HomepageService {
  private mapItem(row: HomepageSectionRow): HomepageSectionItem {
    let config: Record<string, unknown> = {};
    if (row.config) {
      try {
        config = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
      } catch {
        config = {};
      }
    }
    return {
      id: row.id,
      sectionType: row.section_type,
      title: row.title,
      enabled: row.enabled !== 0,
      config,
      sortOrder: row.sort_order ?? 0,
    };
  }

  async getConfig(tenantId: string): Promise<HomepageConfig> {
    const [rows] = await db.execute<HomepageSectionRow[]>(
      'SELECT * FROM homepage_sections WHERE tenant_id = ? ORDER BY sort_order ASC',
      [tenantId]
    );
    return {
      sections: rows.map(this.mapItem.bind(this)),
    };
  }

  async saveConfig(tenantId: string, sections: HomepageSectionItem[]): Promise<HomepageConfig> {
    await db.execute<ResultSetHeader>(
      'DELETE FROM homepage_sections WHERE tenant_id = ?',
      [tenantId]
    );

    if (sections.length === 0) {
      return { sections: [] };
    }

    const values: string[] = [];
    const params: (string | number)[] = [];

    sections.forEach((section, index) => {
      values.push('(?, ?, ?, ?, ?, ?, ?)');
      params.push(
        uuidv4(),                         // id varchar(36) — no auto-increment
        tenantId,
        section.sectionType,
        section.title ?? null,
        section.enabled ? 1 : 0,
        JSON.stringify(section.config || {}),
        section.sortOrder ?? index
      );
    });

    await db.execute<ResultSetHeader>(
      `INSERT INTO homepage_sections (id, tenant_id, section_type, title, enabled, config, sort_order) VALUES ${values.join(', ')}`,
      params
    );

    return this.getConfig(tenantId);
  }

  async findPublic(tenantSlug: string): Promise<HomepageSectionItem[]> {
    const [tenants] = await db.execute<RowDataPacket[]>(
      "SELECT id FROM tenants WHERE slug = ? AND status = 'activo' LIMIT 1",
      [tenantSlug]
    );
    if (tenants.length === 0) return [];

    const tenantId = tenants[0].id as string;
    const [rows] = await db.execute<HomepageSectionRow[]>(
      'SELECT * FROM homepage_sections WHERE tenant_id = ? AND enabled = 1 ORDER BY sort_order ASC',
      [tenantId]
    );
    return rows.map(this.mapItem.bind(this));
  }
}

export const homepageService = new HomepageService();
