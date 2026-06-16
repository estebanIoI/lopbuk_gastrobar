/**
 * restbar.backup.routes.ts — Respaldo y restauración (Fase 4, delta D).
 *
 * SEGURIDAD (governance/approval-policy): operación sobre datos reales.
 *  - EXPORT: solo lectura. Vuelca el catálogo/config + operaciones del restaurante a JSON.
 *  - RESTORE: SOLO catálogo/config (menú, mesas, fidelización, info/banners de tienda),
 *    NUNCA pedidos/pagos/transacciones (para no corromper la contabilidad). Es un UPSERT
 *    aditivo (no borra), exige rol alto + frase de confirmación, y fuerza tenant_id del JWT.
 * Montado en /api/restbar/backup.
 */
import { Router, Response } from 'express';
import pool from '../../config/database';
import { authenticate, authorize, AuthRequest } from '../../common/middleware';
import { UserRole } from '../../common/types';

const router: ReturnType<typeof Router> = Router();
const ADMIN_ROLES: UserRole[] = ['superadmin', 'comerciante', 'administrador_rb'];
const RESTORE_ROLES: UserRole[] = ['superadmin', 'comerciante'];
const CONFIRM = 'RESTAURAR';

const ok = (res: Response, data: any) => res.json({ success: true, data });
const bad = (res: Response, msg: string, code = 400) => res.status(code).json({ success: false, error: msg });

// Tablas que se exportan (todas filtradas por tenant_id).
const EXPORT_TABLES = [
  'rb_tables', 'rb_orders', 'rb_order_items', 'rb_payments', 'rb_reservations',
  'loyalty_config', 'loyalty_accounts', 'loyalty_transactions', 'loyalty_rewards',
  'rb_jukebox_config', 'store_info', 'store_banners',
];
// Solo estas se RESTAURAN (catálogo/config; nunca operaciones ni dinero).
const RESTORE_TABLES = [
  'rb_tables', 'loyalty_config', 'loyalty_rewards', 'rb_jukebox_config', 'store_info', 'store_banners',
];

async function dumpTable(table: string, tenantId: string): Promise<any[]> {
  try {
    const [rows] = (await pool.query(`SELECT * FROM \`${table}\` WHERE tenant_id = ?`, [tenantId])) as any;
    return rows;
  } catch { return []; }
}

// Menú: productos marcados como ítems de menú (subconjunto de products).
async function dumpMenu(tenantId: string): Promise<any[]> {
  try {
    const [rows] = (await pool.query(
      `SELECT id, tenant_id, name, sku, category, description, sale_price, image_url,
              is_menu_item, available_in_menu, preparation_area, prep_time_minutes
         FROM products WHERE tenant_id = ? AND is_menu_item = 1`, [tenantId])) as any;
    return rows;
  } catch { return []; }
}

// ─────────── EXPORT (solo lectura) ───────────
router.get('/export', authenticate, authorize(...ADMIN_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId!;
    const data: Record<string, any[]> = { menu_products: await dumpMenu(tenantId) };
    for (const t of EXPORT_TABLES) data[t] = await dumpTable(t, tenantId);
    ok(res, { version: 1, tenantId, exportedAt: new Date().toISOString(), data });
  } catch (e: any) { bad(res, e?.message || 'Error al exportar', 500); }
});

// Normaliza filas para restaurar: fuerza tenant_id y elimina timestamps (los pone la BD).
function sanitize(rows: any[], tenantId: string): any[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const r: any = { ...row, tenant_id: tenantId };
    for (const k of Object.keys(r)) if (k.endsWith('_at')) delete r[k];
    return r;
  });
}

function plan(backup: any, tenantId: string) {
  const data = backup?.data || {};
  const summary: Record<string, number> = {};
  summary['menu_products'] = sanitize(data.menu_products || [], tenantId).length;
  for (const t of RESTORE_TABLES) summary[t] = sanitize(data[t] || [], tenantId).length;
  return summary;
}

// ─────────── RESTORE: vista previa (dry-run, sin escribir) ───────────
router.post('/restore/preview', authenticate, authorize(...ADMIN_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const backup = req.body?.backup;
    if (!backup?.data) return bad(res, 'Respaldo inválido');
    ok(res, { willUpsert: plan(backup, req.user!.tenantId!), note: 'Solo se restaura catálogo/config. Pedidos, pagos y transacciones NO se modifican.' });
  } catch (e: any) { bad(res, e?.message || 'Error en la vista previa', 500); }
});

async function upsertInto(table: string, rows: any[]): Promise<{ ok: number; failed: number }> {
  let okN = 0, failed = 0;
  for (const r of rows) {
    const cols = Object.keys(r);
    if (!cols.length) continue;
    const ph = cols.map(() => '?').join(',');
    const upd = cols.filter((c) => c !== 'id').map((c) => `\`${c}\`=VALUES(\`${c}\`)`).join(',');
    const sql = `INSERT INTO \`${table}\` (${cols.map((c) => `\`${c}\``).join(',')}) VALUES (${ph})` +
      (upd ? ` ON DUPLICATE KEY UPDATE ${upd}` : '');
    try { await pool.query(sql, cols.map((c) => r[c])); okN++; } catch { failed++; }
  }
  return { ok: okN, failed };
}

// ─────────── RESTORE (escribe; requiere confirmación) ───────────
router.post('/restore', authenticate, authorize(...RESTORE_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const backup = req.body?.backup;
    if (String(req.body?.confirm || '') !== CONFIRM) return bad(res, `Para confirmar, envía confirm: "${CONFIRM}"`);
    if (!backup?.data) return bad(res, 'Respaldo inválido');
    const tenantId = req.user!.tenantId!;
    const result: Record<string, any> = {};

    // Menú primero (otras tablas pueden referenciarlo).
    const menu = sanitize(backup.data.menu_products || [], tenantId)
      .map((r: any) => ({ ...r, is_menu_item: 1 }));
    if (menu.length) result['menu_products'] = await upsertInto('products', menu);

    for (const t of RESTORE_TABLES) {
      const rows = sanitize(backup.data[t] || [], tenantId);
      if (rows.length) result[t] = await upsertInto(t, rows);
    }
    ok(res, { restored: result, skipped: 'pedidos/pagos/transacciones no se tocan' });
  } catch (e: any) { bad(res, e?.message || 'Error al restaurar', 500); }
});

export default router;
