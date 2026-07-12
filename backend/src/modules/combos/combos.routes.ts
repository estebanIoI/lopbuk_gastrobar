import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../../config/database';
import { authenticate, AuthRequest } from '../../common/middleware';

const router: ReturnType<typeof Router> = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────
function normalizeDays(input: any): number[] {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.map((x: any) => Number(x)).filter((n: number) => Number.isInteger(n) && n >= 0 && n <= 6))];
}
function normalizeSizes(input: any): { count: number; price: number }[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((s: any) => ({ count: Math.max(1, Math.floor(+s?.count) || 0), price: Math.max(0, +s?.price || 0) }))
    .filter((s) => s.count >= 1)
    .sort((a, b) => a.count - b.count);
}
const parseJ = (v: any, fallback: any) => {
  if (v == null) return fallback;
  if (typeof v === 'string') { try { return JSON.parse(v); } catch { return fallback; } }
  return v;
};

// Día de la semana en zona Colombia (UTC-5, sin DST). 0=Dom … 6=Sáb
function bogotaWeekday(): number {
  return new Date(Date.now() - 5 * 3600 * 1000).getUTCDay();
}

/** Adjunta a cada combo sus ítems elegibles (producto: id, nombre, precio, foto). */
async function attachItems(combos: any[]): Promise<any[]> {
  if (!combos.length) return combos;
  const ids = combos.map((c) => c.id);
  const [rows] = await pool.query(
    `SELECT ci.combo_id AS comboId, p.id, p.name, p.sale_price AS price, p.image_url AS imageUrl, ci.sort_order AS sortOrder
     FROM combo_items ci JOIN products p ON p.id = ci.product_id
     WHERE ci.combo_id IN (${ids.map(() => '?').join(',')})
     ORDER BY ci.sort_order ASC`,
    ids
  ) as any;
  const byCombo = new Map<string, any[]>();
  for (const r of rows as any[]) {
    const list = byCombo.get(r.comboId) || [];
    list.push({ id: r.id, name: r.name, price: Number(r.price) || 0, imageUrl: r.imageUrl || null });
    byCombo.set(r.comboId, list);
  }
  return combos.map((c) => ({ ...c, items: byCombo.get(c.id) || [] }));
}

const mapCombo = (r: any) => ({
  id: r.id, name: r.name,
  activeDays: parseJ(r.active_days ?? r.activeDays, []),
  sizes: parseJ(r.sizes, []),
  includes: r.includes ?? null,
  imageUrl: r.image_url ?? r.imageUrl ?? null,
  isActive: r.is_active != null ? !!r.is_active : true,
});

/**
 * Resolución autoritativa de un combo para un pedido (server-side).
 * Valida que el combo exista, esté activo, que el tamaño (count) sea válido y que
 * los ítems elegidos pertenezcan al combo y sean exactamente `sizeCount`.
 * Devuelve el precio fijo del tamaño (NO se confía del frontend), un nombre legible
 * y los product_id de los componentes (para descontar stock).
 */
export async function resolveComboOrderItem(
  tenantId: string,
  reqItem: { comboId: string; sizeCount: number; itemIds: string[] }
): Promise<
  | { ok: true; price: number; name: string; componentIds: string[]; componentNames: string[] }
  | { ok: false; error: string }
> {
  const comboId = String(reqItem.comboId || '');
  const sizeCount = Number(reqItem.sizeCount);
  const chosen = [...new Set((Array.isArray(reqItem.itemIds) ? reqItem.itemIds : []).map((x) => String(x)))];
  if (!comboId) return { ok: false, error: 'Combo inválido' };

  const [rows] = await pool.query(
    'SELECT name, sizes, is_active FROM combos WHERE id = ? AND tenant_id = ? LIMIT 1',
    [comboId, tenantId]
  ) as any;
  if (!rows.length) return { ok: false, error: 'Combo no encontrado' };
  const combo = rows[0];
  if (!combo.is_active) return { ok: false, error: 'Este combo ya no está disponible' };

  const sizes = normalizeSizes(parseJ(combo.sizes, []));
  const size = sizes.find((s) => s.count === sizeCount);
  if (!size) return { ok: false, error: 'Tamaño de combo inválido' };
  if (chosen.length !== sizeCount) return { ok: false, error: `Debes elegir exactamente ${sizeCount} ítems para este combo` };

  const [ciRows] = await pool.query('SELECT product_id AS productId FROM combo_items WHERE combo_id = ?', [comboId]) as any;
  const allowed = new Set((ciRows as any[]).map((r) => String(r.productId)));
  if (!chosen.every((id) => allowed.has(id))) return { ok: false, error: 'Un ítem elegido no pertenece al combo' };

  const [pn] = await pool.query(
    `SELECT id, name FROM products WHERE tenant_id = ? AND id IN (${chosen.map(() => '?').join(',')})`,
    [tenantId, ...chosen]
  ) as any;
  const nameMap = new Map((pn as any[]).map((r) => [String(r.id), r.name]));
  const label = `${combo.name} (x${size.count}): ${chosen.map((id) => nameMap.get(id) || id).join(' + ')}`;

  return { ok: true, price: size.price, name: label, componentIds: chosen, componentNames: chosen.map((id) => nameMap.get(id) || id) };
}

// ── PÚBLICO: combos activos HOY ───────────────────────────────────────────────
// GET /api/combos/public?store=slug
router.get('/public', async (req: Request, res: Response) => {
  try {
    const store = String(req.query.store || '');
    if (!store) { res.status(400).json({ success: false, error: 'store requerido' }); return; }
    const [tenants] = await pool.query("SELECT id FROM tenants WHERE slug = ? AND status = 'activo' LIMIT 1", [store]) as any;
    if (!tenants.length) { res.status(404).json({ success: false, error: 'Tienda no encontrada' }); return; }
    const tenantId = tenants[0].id;
    const dow = bogotaWeekday();
    const [rows] = await pool.query(
      `SELECT id, name, active_days, sizes, includes, image_url
       FROM combos
       WHERE tenant_id = ? AND is_active = 1 AND JSON_CONTAINS(active_days, ?)
       ORDER BY sort_order ASC, name ASC`,
      [tenantId, String(dow)]
    ) as any;
    const combos = await attachItems((rows as any[]).map(mapCombo));
    // Solo combos con al menos 1 ítem elegible
    res.json({ success: true, data: combos.filter((c) => (c.items || []).length > 0) });
  } catch (error) {
    console.error('Public combos error:', error);
    res.json({ success: true, data: [] });
  }
});

// ── COMERCIANTE ───────────────────────────────────────────────────────────────
router.use(authenticate);

// GET /api/combos — lista los combos del tenant con sus ítems
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId!;
    const [rows] = await pool.query(
      'SELECT id, name, active_days, sizes, includes, image_url, is_active FROM combos WHERE tenant_id = ? ORDER BY sort_order ASC, created_at DESC',
      [tenantId]
    ) as any;
    const data = await attachItems((rows as any[]).map(mapCombo));
    res.json({ success: true, data });
  } catch (error) {
    console.error('List combos error:', error);
    res.status(500).json({ success: false, error: 'Error al listar combos' });
  }
});

async function setComboItems(comboId: string, tenantId: string, itemIds: string[]): Promise<void> {
  await pool.query('DELETE FROM combo_items WHERE combo_id = ?', [comboId]);
  const clean = [...new Set((itemIds || []).map((x) => String(x).trim()).filter(Boolean))];
  let i = 0;
  for (const pid of clean) {
    await pool.query(
      'INSERT INTO combo_items (id, tenant_id, combo_id, product_id, sort_order) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), tenantId, comboId, pid, i++]
    );
  }
}

// POST /api/combos — crear
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId!;
    const name = String(req.body?.name || '').trim();
    const activeDays = normalizeDays(req.body?.activeDays);
    const sizes = normalizeSizes(req.body?.sizes);
    const itemIds: string[] = Array.isArray(req.body?.itemIds) ? req.body.itemIds : [];
    if (!name) { res.status(400).json({ success: false, error: 'Nombre requerido' }); return; }
    if (!activeDays.length) { res.status(400).json({ success: false, error: 'Elige al menos un día' }); return; }
    if (!sizes.length) { res.status(400).json({ success: false, error: 'Define al menos un tamaño (ej. x2 con su precio)' }); return; }
    if (!itemIds.length) { res.status(400).json({ success: false, error: 'Elige los ítems que entran al combo' }); return; }

    const id = uuidv4();
    await pool.query(
      'INSERT INTO combos (id, tenant_id, name, active_days, sizes, includes, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, tenantId, name, JSON.stringify(activeDays), JSON.stringify(sizes), req.body?.includes?.trim() || null, req.body?.imageUrl?.trim() || null]
    );
    await setComboItems(id, tenantId, itemIds);
    res.status(201).json({ success: true, data: { id } });
  } catch (error) {
    console.error('Create combo error:', error);
    res.status(500).json({ success: false, error: 'Error al crear el combo' });
  }
});

// PUT /api/combos/:id — actualizar (campos + ítems)
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId!;
    const [own] = await pool.query('SELECT id FROM combos WHERE id = ? AND tenant_id = ?', [req.params.id, tenantId]) as any;
    if (!own.length) { res.status(404).json({ success: false, error: 'Combo no encontrado' }); return; }

    const sets: string[] = []; const vals: any[] = [];
    if (typeof req.body?.name === 'string' && req.body.name.trim()) { sets.push('name = ?'); vals.push(req.body.name.trim().slice(0, 150)); }
    if (req.body?.activeDays !== undefined) { sets.push('active_days = ?'); vals.push(JSON.stringify(normalizeDays(req.body.activeDays))); }
    if (req.body?.sizes !== undefined) { sets.push('sizes = ?'); vals.push(JSON.stringify(normalizeSizes(req.body.sizes))); }
    if (req.body?.includes !== undefined) { sets.push('includes = ?'); vals.push(String(req.body.includes || '').trim() || null); }
    if (req.body?.imageUrl !== undefined) { sets.push('image_url = ?'); vals.push(String(req.body.imageUrl || '').trim() || null); }
    if (sets.length) {
      vals.push(req.params.id, tenantId);
      await pool.query(`UPDATE combos SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`, vals);
    }
    if (Array.isArray(req.body?.itemIds)) await setComboItems(req.params.id, tenantId, req.body.itemIds);
    res.json({ success: true });
  } catch (error) {
    console.error('Update combo error:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar el combo' });
  }
});

// PATCH /api/combos/:id — activar/desactivar
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId!;
    const [r] = await pool.query('UPDATE combos SET is_active = ? WHERE id = ? AND tenant_id = ?', [req.body?.isActive ? 1 : 0, req.params.id, tenantId]) as any;
    if (!r.affectedRows) { res.status(404).json({ success: false, error: 'Combo no encontrado' }); return; }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error al actualizar el combo' });
  }
});

// DELETE /api/combos/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId!;
    const [r] = await pool.query('DELETE FROM combos WHERE id = ? AND tenant_id = ?', [req.params.id, tenantId]) as any;
    if (!r.affectedRows) { res.status(404).json({ success: false, error: 'Combo no encontrado' }); return; }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error al eliminar el combo' });
  }
});

export default router;
