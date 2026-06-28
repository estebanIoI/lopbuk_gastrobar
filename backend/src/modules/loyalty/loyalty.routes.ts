/**
 * loyalty.routes.ts — Fidelización por puntos (Fase 3).
 *
 * El comercio configura cuántos puntos se ganan por consumo y un catálogo de
 * recompensas. Las cuentas de cliente se identifican por teléfono. El cliente
 * consulta su saldo y canjea recompensas desde la sesión de mesa (ver restbar-qr).
 *
 * NOTA: no se toca el flujo de pago. El acúmulo de puntos se hace vía
 * `POST /loyalty/earn` (lo puede llamar el cajero/admin tras cobrar).
 */
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../../config/database';
import { authenticate, authorize, AuthRequest } from '../../common/middleware';
import { UserRole } from '../../common/types';

const router: ReturnType<typeof Router> = Router();
const ADMIN_ROLES: UserRole[] = ['superadmin', 'comerciante', 'administrador_rb', 'cajero'];

const ok = (res: Response, data: any, code = 200) => res.status(code).json({ success: true, data });
const bad = (res: Response, msg: string, code = 400) => res.status(code).json({ success: false, error: msg });

// DDL congelado: las tablas loyalty_* viven en el baseline Drizzle (src/db/migrations).
// Función no-op conservada porque la invocan varios handlers. Ver CLAUDE.md.
export async function ensureLoyaltyTables() { /* no-op: esquema en migraciones */ }

export async function getLoyaltyConfig(tenantId: string): Promise<{ enabled: boolean; pointsPerThousand: number }> {
  const [r] = (await pool.query('SELECT enabled, points_per_thousand FROM loyalty_config WHERE tenant_id = ?', [tenantId])) as any;
  if (r[0]) return { enabled: !!r[0].enabled, pointsPerThousand: Number(r[0].points_per_thousand) };
  return { enabled: true, pointsPerThousand: 1 };
}

export async function ensureAccount(tenantId: string, phone: string, name?: string): Promise<any> {
  const ph = phone.replace(/\s/g, '').slice(0, 40);
  const [r] = (await pool.query('SELECT * FROM loyalty_accounts WHERE tenant_id = ? AND customer_phone = ? LIMIT 1', [tenantId, ph])) as any;
  if (r[0]) {
    if (name && !r[0].customer_name) await pool.query('UPDATE loyalty_accounts SET customer_name = ? WHERE id = ?', [name.slice(0, 120), r[0].id]);
    return r[0];
  }
  const id = uuidv4();
  await pool.query('INSERT INTO loyalty_accounts (id, tenant_id, customer_name, customer_phone) VALUES (?, ?, ?, ?)', [id, tenantId, name?.slice(0, 120) || null, ph]);
  const [c] = (await pool.query('SELECT * FROM loyalty_accounts WHERE id = ?', [id])) as any;
  return c[0];
}

// Acredita puntos por un consumo. Exportada para reuso (p.ej. tras cobrar).
export async function earnPoints(tenantId: string, phone: string, name: string | undefined, amount: number, orderId?: string | null) {
  const cfg = await getLoyaltyConfig(tenantId);
  if (!cfg.enabled) return { points: 0, balance: 0, skipped: true };
  const acct = await ensureAccount(tenantId, phone, name);
  const points = Math.floor((amount / 1000) * cfg.pointsPerThousand);
  if (points <= 0) return { points: 0, balance: acct.points_balance, accountId: acct.id };
  await pool.query('UPDATE loyalty_accounts SET points_balance = points_balance + ?, total_earned = total_earned + ? WHERE id = ?', [points, points, acct.id]);
  await pool.query('INSERT INTO loyalty_transactions (id, tenant_id, account_id, type, points, reason, order_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [uuidv4(), tenantId, acct.id, 'earn', points, `Consumo ${amount.toLocaleString('es-CO')}`, orderId || null]);
  return { points, balance: acct.points_balance + points, accountId: acct.id };
}

// ─────────── ADMIN: configuración ───────────
router.get('/config', authenticate, authorize(...ADMIN_ROLES), async (req: AuthRequest, res: Response) => {
  try { await ensureLoyaltyTables(); ok(res, await getLoyaltyConfig(req.user!.tenantId!)); }
  catch (e: any) { bad(res, e?.message || 'Error', 500); }
});

router.put('/config', authenticate, authorize(...ADMIN_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    await ensureLoyaltyTables();
    const enabled = req.body?.enabled ? 1 : 0;
    const ppt = Math.max(0, Number(req.body?.pointsPerThousand ?? 1));
    await pool.query(
      `INSERT INTO loyalty_config (tenant_id, enabled, points_per_thousand) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), points_per_thousand = VALUES(points_per_thousand)`,
      [req.user!.tenantId!, enabled, ppt]
    );
    ok(res, { enabled: !!enabled, pointsPerThousand: ppt });
  } catch (e: any) { bad(res, e?.message || 'Error', 500); }
});

// ─────────── ADMIN: recompensas ───────────
router.get('/rewards', authenticate, authorize(...ADMIN_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    await ensureLoyaltyTables();
    const [rows] = (await pool.query(
      'SELECT id, name, description, points_cost AS pointsCost, is_active AS isActive FROM loyalty_rewards WHERE tenant_id = ? ORDER BY is_active DESC, points_cost ASC',
      [req.user!.tenantId!]
    )) as any;
    ok(res, { rewards: rows });
  } catch (e: any) { bad(res, e?.message || 'Error', 500); }
});

router.post('/rewards', authenticate, authorize(...ADMIN_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    await ensureLoyaltyTables();
    const name = String(req.body?.name || '').trim().slice(0, 120);
    const cost = parseInt(String(req.body?.pointsCost || 0), 10);
    if (!name) return bad(res, 'Nombre requerido');
    if (!(cost > 0)) return bad(res, 'El costo en puntos debe ser mayor a 0');
    const id = uuidv4();
    await pool.query('INSERT INTO loyalty_rewards (id, tenant_id, name, description, points_cost) VALUES (?, ?, ?, ?, ?)',
      [id, req.user!.tenantId!, name, String(req.body?.description || '').slice(0, 300) || null, cost]);
    ok(res, { id });
  } catch (e: any) { bad(res, e?.message || 'Error', 500); }
});

router.patch('/rewards/:id', authenticate, authorize(...ADMIN_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const fields: string[] = []; const vals: any[] = [];
    if (req.body?.name !== undefined) { fields.push('name = ?'); vals.push(String(req.body.name).slice(0, 120)); }
    if (req.body?.description !== undefined) { fields.push('description = ?'); vals.push(String(req.body.description).slice(0, 300) || null); }
    if (req.body?.pointsCost !== undefined) { fields.push('points_cost = ?'); vals.push(parseInt(String(req.body.pointsCost), 10)); }
    if (req.body?.isActive !== undefined) { fields.push('is_active = ?'); vals.push(req.body.isActive ? 1 : 0); }
    if (!fields.length) return bad(res, 'Nada que actualizar');
    vals.push(req.params.id, req.user!.tenantId!);
    const [r] = (await pool.query(`UPDATE loyalty_rewards SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`, vals)) as any;
    if (r.affectedRows === 0) return bad(res, 'Recompensa no encontrada', 404);
    ok(res, { id: req.params.id });
  } catch (e: any) { bad(res, e?.message || 'Error', 500); }
});

router.delete('/rewards/:id', authenticate, authorize(...ADMIN_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    await pool.query('UPDATE loyalty_rewards SET is_active = 0 WHERE id = ? AND tenant_id = ?', [req.params.id, req.user!.tenantId!]);
    ok(res, { id: req.params.id });
  } catch (e: any) { bad(res, e?.message || 'Error', 500); }
});

// ─────────── ADMIN: cuentas y movimientos ───────────
router.get('/accounts', authenticate, authorize(...ADMIN_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    await ensureLoyaltyTables();
    const search = `%${String(req.query.search || '').trim()}%`;
    const [rows] = (await pool.query(
      `SELECT id, customer_name AS name, customer_phone AS phone, points_balance AS balance, total_earned AS totalEarned
         FROM loyalty_accounts WHERE tenant_id = ? AND (customer_name LIKE ? OR customer_phone LIKE ?)
         ORDER BY points_balance DESC LIMIT 100`,
      [req.user!.tenantId!, search, search]
    )) as any;
    ok(res, { accounts: rows });
  } catch (e: any) { bad(res, e?.message || 'Error', 500); }
});

router.get('/accounts/:id/transactions', authenticate, authorize(...ADMIN_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const [rows] = (await pool.query(
      `SELECT type, points, reason, created_at AS createdAt FROM loyalty_transactions
         WHERE tenant_id = ? AND account_id = ? ORDER BY created_at DESC LIMIT 100`,
      [req.user!.tenantId!, req.params.id]
    )) as any;
    ok(res, { transactions: rows });
  } catch (e: any) { bad(res, e?.message || 'Error', 500); }
});

router.post('/earn', authenticate, authorize(...ADMIN_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    await ensureLoyaltyTables();
    const phone = String(req.body?.phone || '').trim();
    const amount = Number(req.body?.amount || 0);
    if (!phone) return bad(res, 'Teléfono requerido');
    if (!(amount > 0)) return bad(res, 'Monto inválido');
    const r = await earnPoints(req.user!.tenantId!, phone, req.body?.name, amount, req.body?.orderId);
    ok(res, r);
  } catch (e: any) { bad(res, e?.message || 'Error', 500); }
});

router.post('/accounts/:id/adjust', authenticate, authorize(...ADMIN_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const points = parseInt(String(req.body?.points || 0), 10);
    const reason = String(req.body?.reason || 'Ajuste manual').slice(0, 200);
    if (!points) return bad(res, 'Puntos inválidos');
    const [r] = (await pool.query('UPDATE loyalty_accounts SET points_balance = points_balance + ? WHERE id = ? AND tenant_id = ?',
      [points, req.params.id, req.user!.tenantId!])) as any;
    if (r.affectedRows === 0) return bad(res, 'Cuenta no encontrada', 404);
    await pool.query('INSERT INTO loyalty_transactions (id, tenant_id, account_id, type, points, reason) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), req.user!.tenantId!, req.params.id, 'adjust', points, reason]);
    ok(res, { id: req.params.id, points });
  } catch (e: any) { bad(res, e?.message || 'Error', 500); }
});

export default router;
