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
  /** true si hay una versión draft con cambios aún no publicados */
  hasDraft?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateVersion {
  id: string;
  version: number;
  status: 'draft' | 'published' | 'archived';
  sectionCount: number;
  publishedAt: string | null;
  createdAt: string;
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

  /**
   * Lectura de ADMIN: devuelve la copia editable (draft si existe, si no la
   * publicada). El público NO pasa por aquí: lee el espejo `sections` vía
   * getPublicProductPage, que no cambió.
   */
  async findById(tenantId: string, id: string): Promise<ProductTemplate> {
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT * FROM product_templates WHERE id = ? AND tenant_id = ? AND is_active = 1',
      [id, tenantId]
    );
    if (rows.length === 0) throw new AppError('Plantilla no encontrada', 404);
    const tpl = mapRow(rows[0]);

    await this.ensureVersions(id, rows[0]);
    const editable = await this.getEditableVersion(id);
    if (editable) {
      tpl.sections = parseSections(editable.sections);
      tpl.hasDraft = editable.status === 'draft' && tpl.status === 'published';
    }
    return tpl;
  }

  // ── Versionado ──────────────────────────────────────────────────────────────
  // Invariantes (mismo patrón que routine_versions del módulo Gym):
  //  · como máximo UNA versión 'draft' y UNA 'published' por plantilla
  //  · `product_templates.sections` es el ESPEJO de la publicada → el endpoint
  //    público sigue funcionando sin tocar una línea (compatibilidad total)
  //  · el rollback CREA una versión nueva, nunca revive una vieja

  /** Backfill perezoso: una plantilla sin versiones estrena v1 desde el espejo. */
  private async ensureVersions(templateId: string, row: any): Promise<void> {
    const [v] = await db.execute<RowDataPacket[]>(
      'SELECT COUNT(*) AS n FROM product_template_versions WHERE template_id = ?',
      [templateId]
    );
    if (Number(v[0]?.n || 0) > 0) return;
    const status = row.status === 'published' ? 'published' : row.status === 'archived' ? 'archived' : 'draft';
    await db.execute(
      `INSERT INTO product_template_versions (id, template_id, version, sections, status, published_at)
       VALUES (?, ?, 1, ?, ?, ${status === 'published' ? 'NOW()' : 'NULL'})`,
      [uuidv4(), templateId, JSON.stringify(parseSections(row.sections)), status]
    );
  }

  /** Versión editable: el draft si existe; si no, la publicada. */
  private async getEditableVersion(templateId: string): Promise<any | null> {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT * FROM product_template_versions
        WHERE template_id = ? AND status IN ('draft','published')
        ORDER BY (status = 'draft') DESC, version DESC
        LIMIT 1`,
      [templateId]
    );
    return rows[0] || null;
  }

  private async nextVersion(templateId: string): Promise<number> {
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT COALESCE(MAX(version), 0) + 1 AS n FROM product_template_versions WHERE template_id = ?',
      [templateId]
    );
    return Number(rows[0]?.n || 1);
  }

  /** Escribe secciones en la versión draft (la crea si no existe). */
  private async writeDraft(templateId: string, sections: TemplateSection[]): Promise<void> {
    const json = JSON.stringify(sections);
    const [d] = await db.execute<RowDataPacket[]>(
      "SELECT id FROM product_template_versions WHERE template_id = ? AND status = 'draft' LIMIT 1",
      [templateId]
    );
    if (d.length > 0) {
      await db.execute('UPDATE product_template_versions SET sections = ? WHERE id = ?', [json, d[0].id]);
      return;
    }
    await db.execute(
      `INSERT INTO product_template_versions (id, template_id, version, sections, status)
       VALUES (?, ?, ?, ?, 'draft')`,
      [uuidv4(), templateId, await this.nextVersion(templateId), json]
    );
  }

  async listVersions(tenantId: string, id: string): Promise<TemplateVersion[]> {
    await this.findById(tenantId, id); // valida tenant + dispara backfill
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT id, version, status, published_at, created_at, JSON_LENGTH(sections) AS sectionCount
         FROM product_template_versions
        WHERE template_id = ?
        ORDER BY version DESC`,
      [id]
    );
    return rows.map((r: any) => ({
      id: r.id,
      version: Number(r.version),
      status: r.status,
      sectionCount: Number(r.sectionCount || 0),
      publishedAt: r.published_at || null,
      createdAt: r.created_at,
    }));
  }

  /** Publica el draft: archiva la publicada anterior y refresca el espejo. */
  async publish(tenantId: string, id: string): Promise<void> {
    await this.findById(tenantId, id);
    const [d] = await db.execute<RowDataPacket[]>(
      "SELECT id, sections FROM product_template_versions WHERE template_id = ? AND status = 'draft' ORDER BY version DESC LIMIT 1",
      [id]
    );
    const target: any = d[0] || null;
    if (target) {
      await db.execute(
        "UPDATE product_template_versions SET status = 'archived' WHERE template_id = ? AND status = 'published'",
        [id]
      );
      await db.execute(
        "UPDATE product_template_versions SET status = 'published', published_at = NOW() WHERE id = ?",
        [target.id]
      );
      // Espejo → lo que sirve la tienda
      await db.execute(
        'UPDATE product_templates SET sections = ? WHERE id = ? AND tenant_id = ?',
        [JSON.stringify(parseSections(target.sections)), id, tenantId]
      );
    }
    await db.execute(
      "UPDATE product_templates SET status = 'published' WHERE id = ? AND tenant_id = ?",
      [id, tenantId]
    );
    invalidatePageCache();
  }

  /**
   * Rollback: copia vN en una versión NUEVA y la publica. No revive filas
   * viejas (rompería el histórico y el unique(template_id, version)); así queda
   * traza de que hubo rollback. El draft en curso se archiva, no se pierde.
   */
  async rollback(tenantId: string, id: string, version: number): Promise<void> {
    await this.findById(tenantId, id);
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT sections FROM product_template_versions WHERE template_id = ? AND version = ? LIMIT 1',
      [id, version]
    );
    if (rows.length === 0) throw new AppError('Versión no encontrada', 404);
    const sections = parseSections(rows[0].sections);
    await db.execute(
      "UPDATE product_template_versions SET status = 'archived' WHERE template_id = ? AND status = 'draft'",
      [id]
    );
    await this.writeDraft(id, sections);
    await this.publish(tenantId, id);
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

  /**
   * Las secciones van SIEMPRE a la versión draft. Si la plantilla está
   * publicada, el espejo NO se toca: guardar deja de publicar en vivo (era el
   * bug de fondo del editor). Los cambios llegan a la tienda solo al publicar.
   */
  async update(tenantId: string, id: string, data: { name?: string; description?: string; sections?: unknown }): Promise<ProductTemplate> {
    const current = await this.findById(tenantId, id);

    const updates: string[] = [];
    const values: unknown[] = [];
    if (data.name !== undefined) { updates.push('name = ?'); values.push(String(data.name).trim()); }
    if (data.description !== undefined) { updates.push('description = ?'); values.push(String(data.description).trim() || null); }
    if (updates.length === 0 && data.sections === undefined) {
      throw new AppError('No hay datos para actualizar', 400);
    }

    if (updates.length > 0) {
      values.push(id, tenantId);
      await db.execute(
        `UPDATE product_templates SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`,
        values
      );
    }

    if (data.sections !== undefined) {
      let sections: TemplateSection[];
      try { sections = normalizeSections(data.sections); }
      catch (e: any) { throw new AppError(e.message, 400); }

      await this.writeDraft(id, sections);

      // Espejo solo mientras la plantilla no esté publicada: así el borrador de
      // una plantilla en vivo no altera la tienda.
      if (current.status !== 'published') {
        await db.execute(
          'UPDATE product_templates SET sections = ? WHERE id = ? AND tenant_id = ?',
          [JSON.stringify(sections), id, tenantId]
        );
      }
    }

    invalidatePageCache();
    return this.findById(tenantId, id);
  }

  async setStatus(tenantId: string, id: string, status: 'draft' | 'published' | 'archived'): Promise<void> {
    if (status === 'published') { await this.publish(tenantId, id); return; }

    const [result] = await db.execute<ResultSetHeader>(
      'UPDATE product_templates SET status = ? WHERE id = ? AND tenant_id = ? AND is_active = 1',
      [status, id, tenantId]
    );
    if (result.affectedRows === 0) throw new AppError('Plantilla no encontrada', 404);
    if (status === 'archived') {
      await db.execute(
        "UPDATE product_template_versions SET status = 'archived' WHERE template_id = ? AND status = 'published'",
        [id]
      );
    }
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
