import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../../config/database';
import { authenticate } from '../../common/middleware';

const router: ReturnType<typeof Router> = Router();

/** Verifica que el producto pertenezca al tenant. */
async function productBelongsToTenant(productId: string, tenantId: string): Promise<boolean> {
  const [rows] = await pool.query(
    'SELECT id FROM products WHERE id = ? AND tenant_id = ? LIMIT 1',
    [productId, tenantId]
  ) as any;
  return (rows as any[]).length > 0;
}

/** Lee grupos + opciones de un producto. activeOnly filtra opciones inactivas. */
async function readModifiers(productId: string, activeOnly: boolean): Promise<any[]> {
  const [groups] = await pool.query(
    `SELECT id, name, selection_type AS selectionType, is_required AS isRequired,
            min_select AS minSelect, max_select AS maxSelect, sort_order AS sortOrder
     FROM product_modifier_groups WHERE product_id = ? ORDER BY sort_order ASC, name ASC`,
    [productId]
  ) as any;

  const result: any[] = [];
  for (const g of groups as any[]) {
    const [opts] = await pool.query(
      `SELECT id, name, image_url AS imageUrl, price_delta AS priceDelta, is_active AS isActive, sort_order AS sortOrder
       FROM product_modifier_options
       WHERE group_id = ? ${activeOnly ? 'AND is_active = 1' : ''}
       ORDER BY sort_order ASC, name ASC`,
      [g.id]
    ) as any;
    result.push({
      ...g,
      isRequired: !!g.isRequired,
      options: (opts as any[]).map(o => ({ ...o, priceDelta: Number(o.priceDelta), isActive: !!o.isActive })),
    });
  }
  return result;
}

// GET /api/modifiers/product/:productId — Merchant: grupos+opciones del producto propio
router.get('/product/:productId', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { productId } = req.params;
    if (!(await productBelongsToTenant(productId, tenantId))) {
      res.status(404).json({ success: false, error: 'Producto no encontrado' });
      return;
    }
    const data = await readModifiers(productId, false);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Get modifiers error:', error);
    res.status(500).json({ success: false, error: 'Error al obtener modificadores' });
  }
});

// PUT /api/modifiers/product/:productId — Merchant: reemplaza todos los grupos+opciones
router.put('/product/:productId', authenticate, async (req: Request, res: Response) => {
  const conn = await pool.getConnection();
  try {
    const tenantId = (req as any).user.tenantId;
    const { productId } = req.params;
    const groups = Array.isArray(req.body?.groups) ? req.body.groups : [];

    if (!(await productBelongsToTenant(productId, tenantId))) {
      res.status(404).json({ success: false, error: 'Producto no encontrado' });
      return;
    }

    await conn.beginTransaction();
    // Borra grupos y opciones existentes del producto
    const [existing] = await conn.query(
      'SELECT id FROM product_modifier_groups WHERE product_id = ? AND tenant_id = ?',
      [productId, tenantId]
    ) as any;
    const existingIds = (existing as any[]).map(r => r.id);
    if (existingIds.length) {
      await conn.query(`DELETE FROM product_modifier_options WHERE group_id IN (${existingIds.map(() => '?').join(',')})`, existingIds);
      await conn.query('DELETE FROM product_modifier_groups WHERE product_id = ? AND tenant_id = ?', [productId, tenantId]);
    }

    // Inserta los nuevos
    let gi = 0;
    for (const g of groups) {
      const groupId = uuidv4();
      const selType = g.selectionType === 'single' ? 'single' : 'multiple';
      await conn.query(
        `INSERT INTO product_modifier_groups
           (id, tenant_id, product_id, name, selection_type, is_required, min_select, max_select, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          groupId, tenantId, productId,
          String(g.name || 'Opciones').slice(0, 150),
          selType,
          g.isRequired ? 1 : 0,
          Number.isFinite(+g.minSelect) ? Math.max(0, +g.minSelect) : 0,
          g.maxSelect == null || g.maxSelect === '' ? null : Math.max(1, +g.maxSelect),
          gi++,
        ]
      );
      let oi = 0;
      for (const o of (Array.isArray(g.options) ? g.options : [])) {
        await conn.query(
          `INSERT INTO product_modifier_options
             (id, tenant_id, group_id, name, image_url, price_delta, is_active, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(), tenantId, groupId,
            String(o.name || '').slice(0, 150),
            o.imageUrl ? String(o.imageUrl).slice(0, 500) : null,
            Number.isFinite(+o.priceDelta) ? +o.priceDelta : 0,
            o.isActive === false ? 0 : 1,
            oi++,
          ]
        );
      }
    }

    await conn.commit();
    const data = await readModifiers(productId, false);
    res.json({ success: true, data, message: 'Modificadores guardados' });
  } catch (error) {
    await conn.rollback().catch(() => {});
    console.error('Save modifiers error:', error);
    res.status(500).json({ success: false, error: 'Error al guardar modificadores' });
  } finally {
    conn.release();
  }
});

// GET /api/modifiers/public/:productId — Público: solo opciones activas
router.get('/public/:productId', async (req: Request, res: Response) => {
  try {
    const data = await readModifiers(req.params.productId, true);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Public modifiers error:', error);
    res.json({ success: true, data: [] });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PLANTILLAS DE MODIFICADORES + aplicación masiva por categoría
// ═══════════════════════════════════════════════════════════════════════════

type NormGroup = {
  name: string; selectionType: 'single' | 'multiple'; isRequired: boolean;
  minSelect: number; maxSelect: number | null;
  options: { name: string; imageUrl: string | null; priceDelta: number; isActive: number }[];
};

/** Sanitiza la estructura de grupos (viene de un ítem o del cliente). */
function normalizeGroups(input: any): NormGroup[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((g: any) => ({
      name: String(g?.name || 'Opciones').slice(0, 150),
      selectionType: g?.selectionType === 'single' ? 'single' as const : 'multiple' as const,
      isRequired: !!g?.isRequired,
      minSelect: Number.isFinite(+g?.minSelect) ? Math.max(0, +g.minSelect) : 0,
      maxSelect: g?.maxSelect == null || g?.maxSelect === '' ? null : Math.max(1, +g.maxSelect),
      options: (Array.isArray(g?.options) ? g.options : [])
        .map((o: any) => ({
          name: String(o?.name || '').slice(0, 150),
          imageUrl: o?.imageUrl ? String(o.imageUrl).slice(0, 500) : null,
          priceDelta: Number.isFinite(+o?.priceDelta) ? +o.priceDelta : 0,
          isActive: o?.isActive === false ? 0 : 1,
        }))
        .filter((o: any) => o.name),
    }))
    .filter((g) => g.name && g.options.length > 0);
}

/** Inserta un grupo + sus opciones en un producto. */
async function insertGroup(conn: any, tenantId: string, productId: string, g: NormGroup, sortOrder: number): Promise<void> {
  const groupId = uuidv4();
  await conn.query(
    `INSERT INTO product_modifier_groups
       (id, tenant_id, product_id, name, selection_type, is_required, min_select, max_select, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [groupId, tenantId, productId, g.name, g.selectionType, g.isRequired ? 1 : 0, g.minSelect, g.maxSelect, sortOrder]
  );
  let oi = 0;
  for (const o of g.options) {
    await conn.query(
      `INSERT INTO product_modifier_options
         (id, tenant_id, group_id, name, image_url, price_delta, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), tenantId, groupId, o.name, o.imageUrl, o.priceDelta, o.isActive, oi++]
    );
  }
}

/** Resuelve los grupos a partir de templateId o fromProductId. */
async function resolveGroups(body: any, tenantId: string): Promise<{ groups: NormGroup[]; error?: string; code?: number }> {
  if (body?.templateId) {
    const [[t]] = await pool.query('SELECT `groups` FROM modifier_templates WHERE id = ? AND tenant_id = ?', [body.templateId, tenantId]) as any;
    if (!t) return { groups: [], error: 'Plantilla no encontrada', code: 404 };
    return { groups: normalizeGroups(typeof t.groups === 'string' ? JSON.parse(t.groups) : t.groups) };
  }
  if (body?.fromProductId) {
    if (!(await productBelongsToTenant(body.fromProductId, tenantId))) return { groups: [], error: 'Producto no encontrado', code: 404 };
    return { groups: normalizeGroups(await readModifiers(body.fromProductId, false)) };
  }
  return { groups: normalizeGroups(body?.groups) };
}

// GET /api/modifiers/templates — lista las plantillas del tenant
router.get('/templates', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const [rows] = await pool.query(
      'SELECT id, name, `groups`, created_at AS createdAt FROM modifier_templates WHERE tenant_id = ? ORDER BY created_at DESC',
      [tenantId]
    ) as any;
    const data = (rows as any[]).map(r => ({ ...r, groups: typeof r.groups === 'string' ? JSON.parse(r.groups) : r.groups }));
    res.json({ success: true, data });
  } catch (error) {
    console.error('List templates error:', error);
    res.status(500).json({ success: false, error: 'Error al listar plantillas' });
  }
});

// POST /api/modifiers/templates — crea (desde un ítem con fromProductId, o groups directos)
router.post('/templates', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const name = String(req.body?.name || '').trim();
    if (!name) { res.status(400).json({ success: false, error: 'Nombre requerido' }); return; }
    const { groups, error, code } = await resolveGroups(req.body, tenantId);
    if (error) { res.status(code || 400).json({ success: false, error }); return; }
    if (!groups.length) { res.status(400).json({ success: false, error: 'La plantilla no tiene grupos de modificadores' }); return; }
    const id = uuidv4();
    await pool.query('INSERT INTO modifier_templates (id, tenant_id, name, `groups`) VALUES (?, ?, ?, ?)', [id, tenantId, name, JSON.stringify(groups)]);
    res.status(201).json({ success: true, data: { id, name, groups } });
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({ success: false, error: 'Error al crear la plantilla' });
  }
});

// PATCH /api/modifiers/templates/:id — renombrar y/o reemplazar grupos
router.patch('/templates/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const sets: string[] = []; const vals: any[] = [];
    if (typeof req.body?.name === 'string' && req.body.name.trim()) { sets.push('name = ?'); vals.push(req.body.name.trim().slice(0, 150)); }
    if (req.body?.groups !== undefined || req.body?.fromProductId) {
      const { groups, error, code } = await resolveGroups(req.body, tenantId);
      if (error) { res.status(code || 400).json({ success: false, error }); return; }
      if (!groups.length) { res.status(400).json({ success: false, error: 'La plantilla no tiene grupos' }); return; }
      sets.push('`groups` = ?'); vals.push(JSON.stringify(groups));
    }
    if (!sets.length) { res.status(400).json({ success: false, error: 'Sin cambios' }); return; }
    vals.push(req.params.id, tenantId);
    const [r] = await pool.query(`UPDATE modifier_templates SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`, vals) as any;
    if (!r.affectedRows) { res.status(404).json({ success: false, error: 'Plantilla no encontrada' }); return; }
    res.json({ success: true });
  } catch (error) {
    console.error('Update template error:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar la plantilla' });
  }
});

// DELETE /api/modifiers/templates/:id
router.delete('/templates/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const [r] = await pool.query('DELETE FROM modifier_templates WHERE id = ? AND tenant_id = ?', [req.params.id, tenantId]) as any;
    if (!r.affectedRows) { res.status(404).json({ success: false, error: 'Plantilla no encontrada' }); return; }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error al eliminar la plantilla' });
  }
});

// POST /api/modifiers/apply-bulk — aplica a TODOS los productos de las categorías,
// AGREGANDO sin borrar: omite los grupos cuyo nombre ya exista en el producto.
router.post('/apply-bulk', authenticate, async (req: Request, res: Response) => {
  const conn = await pool.getConnection();
  try {
    const tenantId = (req as any).user.tenantId;
    const categoryIds: string[] = Array.isArray(req.body?.categoryIds)
      ? [...new Set(req.body.categoryIds.map((x: any) => String(x).trim()).filter(Boolean) as string[])] : [];
    if (!categoryIds.length) { res.status(400).json({ success: false, error: 'Elige al menos una categoría' }); return; }

    const { groups, error, code } = await resolveGroups(req.body, tenantId);
    if (error) { res.status(code || 400).json({ success: false, error }); return; }
    if (!groups.length) { res.status(400).json({ success: false, error: 'No hay modificadores para aplicar' }); return; }

    const ph = categoryIds.map(() => '?').join(',');
    const [prods] = await conn.query(
      `SELECT id FROM products WHERE tenant_id = ? AND category IN (${ph})`,
      [tenantId, ...categoryIds]
    ) as any;

    await conn.beginTransaction();
    let productsAffected = 0, groupsAdded = 0;
    for (const p of (prods as any[])) {
      const [existing] = await conn.query(
        'SELECT name, sort_order AS sortOrder FROM product_modifier_groups WHERE product_id = ? AND tenant_id = ?',
        [p.id, tenantId]
      ) as any;
      const existingNames = new Set((existing as any[]).map(e => String(e.name).toLowerCase()));
      let maxSort = (existing as any[]).reduce((m, e) => Math.max(m, Number(e.sortOrder ?? 0)), -1);
      let addedHere = 0;
      for (const g of groups) {
        if (existingNames.has(g.name.toLowerCase())) continue; // ya lo tiene → no duplicar
        await insertGroup(conn, tenantId, p.id, g, ++maxSort);
        existingNames.add(g.name.toLowerCase());
        groupsAdded++; addedHere++;
      }
      if (addedHere > 0) productsAffected++;
    }
    await conn.commit();
    res.json({ success: true, data: { productsScanned: (prods as any[]).length, productsAffected, groupsAdded } });
  } catch (error) {
    await conn.rollback().catch(() => {});
    console.error('Apply bulk modifiers error:', error);
    res.status(500).json({ success: false, error: 'Error al aplicar los modificadores' });
  } finally {
    conn.release();
  }
});

export default router;
