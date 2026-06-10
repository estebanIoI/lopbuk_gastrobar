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

export default router;
