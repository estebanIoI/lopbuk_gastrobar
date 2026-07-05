import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config';
import { AppError } from '../../common/middleware';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { normalizeSections, TemplateSection } from './section-types';

export interface ProductTemplate {
  id: string;
  name: string;
  description: string | null;
  sections: TemplateSection[];
  status: 'draft' | 'published' | 'archived';
  productCount?: number;
  createdAt: string;
  updatedAt: string;
}

function parseSections(raw: unknown): TemplateSection[] {
  if (Array.isArray(raw)) return raw as TemplateSection[];
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return [];
}

function mapRow(r: any): ProductTemplate {
  return {
    id: r.id,
    name: r.name,
    description: r.description || null,
    sections: parseSections(r.sections),
    status: r.status,
    productCount: r.productCount != null ? Number(r.productCount) : undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ── Caché en memoria del endpoint público (60s por producto) ──────────────────
const pageCache = new Map<string, { at: number; data: { sections: TemplateSection[]; pageContent: any } }>();
const PAGE_CACHE_TTL = 60_000;

function invalidatePageCache(): void {
  // Cambios de plantilla/asignación son poco frecuentes: limpiar todo es suficiente
  pageCache.clear();
}

export class ProductTemplatesService {
  async list(tenantId: string): Promise<ProductTemplate[]> {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT t.*, (SELECT COUNT(*) FROM products p
                     WHERE p.template_id = t.id AND p.tenant_id = t.tenant_id) AS productCount
         FROM product_templates t
        WHERE t.tenant_id = ? AND t.is_active = 1
        ORDER BY t.updated_at DESC`,
      [tenantId]
    );
    return rows.map(mapRow);
  }

  async findById(tenantId: string, id: string): Promise<ProductTemplate> {
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT * FROM product_templates WHERE id = ? AND tenant_id = ? AND is_active = 1',
      [id, tenantId]
    );
    if (rows.length === 0) throw new AppError('Plantilla no encontrada', 404);
    return mapRow(rows[0]);
  }

  async create(tenantId: string, data: { name: string; description?: string; sections?: unknown }): Promise<ProductTemplate> {
    let sections: TemplateSection[] = [];
    try { sections = normalizeSections(data.sections ?? []); }
    catch (e: any) { throw new AppError(e.message, 400); }

    const id = uuidv4();
    await db.execute(
      `INSERT INTO product_templates (id, tenant_id, name, description, sections, status)
       VALUES (?, ?, ?, ?, ?, 'draft')`,
      [id, tenantId, data.name.trim(), data.description?.trim() || null, JSON.stringify(sections)]
    );
    return this.findById(tenantId, id);
  }

  async update(tenantId: string, id: string, data: { name?: string; description?: string; sections?: unknown }): Promise<ProductTemplate> {
    await this.findById(tenantId, id);

    const updates: string[] = [];
    const values: unknown[] = [];
    if (data.name !== undefined) { updates.push('name = ?'); values.push(String(data.name).trim()); }
    if (data.description !== undefined) { updates.push('description = ?'); values.push(String(data.description).trim() || null); }
    if (data.sections !== undefined) {
      let sections: TemplateSection[];
      try { sections = normalizeSections(data.sections); }
      catch (e: any) { throw new AppError(e.message, 400); }
      updates.push('sections = ?');
      values.push(JSON.stringify(sections));
    }
    if (updates.length === 0) throw new AppError('No hay datos para actualizar', 400);

    values.push(id, tenantId);
    await db.execute(
      `UPDATE product_templates SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`,
      values
    );
    invalidatePageCache();
    return this.findById(tenantId, id);
  }

  async setStatus(tenantId: string, id: string, status: 'draft' | 'published' | 'archived'): Promise<void> {
    const [result] = await db.execute<ResultSetHeader>(
      'UPDATE product_templates SET status = ? WHERE id = ? AND tenant_id = ? AND is_active = 1',
      [status, id, tenantId]
    );
    if (result.affectedRows === 0) throw new AppError('Plantilla no encontrada', 404);
    invalidatePageCache();
  }

  async duplicate(tenantId: string, id: string): Promise<ProductTemplate> {
    const original = await this.findById(tenantId, id);
    return this.create(tenantId, {
      name: `${original.name} (copia)`.slice(0, 120),
      description: original.description || undefined,
      sections: original.sections,
    });
  }

  // Soft delete: los productos asignados conservan el template_id huérfano y el
  // render público lo ignora con gracia (devuelve sections vacías).
  async delete(tenantId: string, id: string): Promise<void> {
    const [result] = await db.execute<ResultSetHeader>(
      'UPDATE product_templates SET is_active = 0 WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (result.affectedRows === 0) throw new AppError('Plantilla no encontrada', 404);
    invalidatePageCache();
  }

  /** Asignación (masiva): templateId null = quitar plantilla. */
  async assign(tenantId: string, productIds: string[], templateId: string | null): Promise<number> {
    if (templateId) await this.findById(tenantId, templateId); // valida pertenencia al tenant
    if (productIds.length === 0) return 0;

    const placeholders = productIds.map(() => '?').join(',');
    const [result] = await db.execute<ResultSetHeader>(
      `UPDATE products SET template_id = ? WHERE tenant_id = ? AND id IN (${placeholders})`,
      [templateId, tenantId, ...productIds]
    );
    invalidatePageCache();
    return result.affectedRows;
  }

  /** Contenido único del producto (page_content) — lo consumen las secciones. */
  async setPageContent(tenantId: string, productId: string, pageContent: unknown): Promise<void> {
    const json = pageContent == null ? null : JSON.stringify(pageContent);
    if (json && json.length > 40000) throw new AppError('El contenido de página es demasiado grande', 400);
    const [result] = await db.execute<ResultSetHeader>(
      'UPDATE products SET page_content = ? WHERE id = ? AND tenant_id = ?',
      [json, productId, tenantId]
    );
    if (result.affectedRows === 0) throw new AppError('Producto no encontrado', 404);
    invalidatePageCache();
  }

  // ── Público: página del producto (secciones publicadas + page_content) ──────
  async getPublicProductPage(productId: string): Promise<{ sections: TemplateSection[]; pageContent: any; tenantId: string | null }> {
    const cached = pageCache.get(productId);
    if (cached && Date.now() - cached.at < PAGE_CACHE_TTL) {
      return { ...cached.data, tenantId: null };
    }

    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT p.tenant_id AS tenantId, p.page_content AS pageContent, t.sections, t.status, t.is_active AS tplActive
         FROM products p
         LEFT JOIN product_templates t ON t.id = p.template_id AND t.tenant_id = p.tenant_id
        WHERE p.id = ? AND p.published_in_store = 1
        LIMIT 1`,
      [productId]
    );
    if (rows.length === 0) {
      return { sections: [], pageContent: null, tenantId: null };
    }
    const r: any = rows[0];
    const usable = r.sections != null && r.status === 'published' && r.tplActive === 1;
    const data = {
      sections: usable ? parseSections(r.sections).filter(s => s.visible !== false) : [],
      pageContent: typeof r.pageContent === 'string'
        ? (() => { try { return JSON.parse(r.pageContent); } catch { return null; } })()
        : (r.pageContent || null),
    };
    pageCache.set(productId, { at: Date.now(), data });
    return { ...data, tenantId: r.tenantId };
  }
}

export const productTemplatesService = new ProductTemplatesService();
