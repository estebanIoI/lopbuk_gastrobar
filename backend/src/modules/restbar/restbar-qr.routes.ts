/**
 * restbar-qr.routes.ts — QR de mesa con sesión de cliente.
 *
 * Flujo: el mesero genera un QR para la mesa → el cliente lo escanea, entra con
 * un nombre, ve el menú y pide desde su móvil. Los pedidos entran a la comanda
 * real (reutiliza restbarService → KDS). La sesión se invalida al cobrar/cancelar.
 *
 * Rutas auth (mesero): POST /tables/:tableId/session
 * Rutas públicas (token): GET /session/:token · POST /session/:token/join · /order
 */
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../../config/database';
import { authenticate, AuthRequest } from '../../common/middleware';
import { restbarService } from './restbar.service';
import { ensureLoyaltyTables, getLoyaltyConfig, ensureAccount } from '../loyalty/loyalty.routes';

const router: ReturnType<typeof Router> = Router();

let ensured = false;
async function ensureTables() {
  if (ensured) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS rb_table_sessions (
    id VARCHAR(36) PRIMARY KEY, tenant_id VARCHAR(36) NOT NULL, table_id VARCHAR(36) NOT NULL,
    token VARCHAR(48) NOT NULL, waiter_id VARCHAR(36) NOT NULL, waiter_name VARCHAR(255) NOT NULL, order_id VARCHAR(36) NULL,
    status ENUM('active','closed') NOT NULL DEFAULT 'active', expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_rbts_token (token), INDEX idx_rbts_table (table_id, status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await pool.query(`CREATE TABLE IF NOT EXISTS rb_table_guests (
    id VARCHAR(36) PRIMARY KEY, session_id VARCHAR(36) NOT NULL, name VARCHAR(120) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_rbtg_session (session_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await pool.query('ALTER TABLE rb_table_sessions ADD COLUMN IF NOT EXISTS order_id VARCHAR(36) NULL').catch(() => {});
  await pool.query(`CREATE TABLE IF NOT EXISTS rb_jukebox_queue (
    id VARCHAR(36) PRIMARY KEY, tenant_id VARCHAR(36) NOT NULL, table_session_id VARCHAR(36) NULL,
    title VARCHAR(200) NOT NULL, url VARCHAR(500) NULL, requested_by VARCHAR(120) NULL,
    status ENUM('queued','playing','played','skipped') NOT NULL DEFAULT 'queued',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_jukebox_tenant (tenant_id, status, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await pool.query(`CREATE TABLE IF NOT EXISTS rb_jukebox_config (
    tenant_id VARCHAR(36) PRIMARY KEY, enabled TINYINT NOT NULL DEFAULT 1, threshold DECIMAL(12,2) NOT NULL DEFAULT 50000
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  ensured = true;
}

/** Config de la rocola del local (con defaults si no existe fila). */
async function jukeboxConfig(tenantId: string): Promise<{ enabled: boolean; threshold: number }> {
  const [r] = (await pool.query('SELECT enabled, threshold FROM rb_jukebox_config WHERE tenant_id = ?', [tenantId])) as any;
  if (r[0]) return { enabled: !!r[0].enabled, threshold: Number(r[0].threshold) };
  return { enabled: true, threshold: 50000 };
}

/** Total actual de la comanda ligada a la sesión (0 si no hay). */
async function sessionTotal(orderId: string | null): Promise<number> {
  if (!orderId) return 0;
  const [[o]] = (await pool.query('SELECT total FROM rb_orders WHERE id = ?', [orderId])) as any;
  return Number(o?.total || 0);
}

const ok = (res: Response, data: any, code = 200) => res.status(code).json({ success: true, data });
const bad = (res: Response, msg: string, code = 400) => res.status(code).json({ success: false, error: msg });

/** Carga una sesión válida (activa y no expirada) por token. */
async function loadSession(token: string): Promise<any | null> {
  const [rows] = (await pool.query(
    `SELECT s.* FROM rb_table_sessions s
       LEFT JOIN rb_orders o ON o.id = s.order_id
      WHERE s.token = ? AND s.status = 'active'
        AND (s.expires_at IS NULL OR s.expires_at > NOW())
        AND (s.order_id IS NULL OR o.status NOT IN ('cerrada','cancelada')) LIMIT 1`, [token]
  )) as any;
  return rows[0] || null;
}

/** Pedido abierto de la mesa o lo crea (reutiliza la lógica de restbar). */
async function getOrCreateOrderId(tenantId: string, tableId: string, waiterId: string, waiterName: string): Promise<string> {
  const [open] = (await pool.query(
    `SELECT id FROM rb_orders WHERE tenant_id = ? AND table_id = ? AND status NOT IN ('cerrada','cancelada') ORDER BY created_at DESC LIMIT 1`,
    [tenantId, tableId]
  )) as any;
  if (open[0]) return open[0].id;
  await restbarService.createOrder(tenantId, waiterId, waiterName, { tableId });
  const [created] = (await pool.query(
    `SELECT id FROM rb_orders WHERE tenant_id = ? AND table_id = ? AND status NOT IN ('cerrada','cancelada') ORDER BY created_at DESC LIMIT 1`,
    [tenantId, tableId]
  )) as any;
  return created[0]?.id;
}

// ─────────── AUTH: el mesero genera/rota el QR de la mesa ───────────
router.post('/tables/:tableId/session', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await ensureTables();
    const tenantId = req.user!.tenantId!;
    const tableId = req.params.tableId;
    const [t] = (await pool.query('SELECT id, number FROM rb_tables WHERE id = ? AND tenant_id = ? AND is_active = 1', [tableId, tenantId])) as any;
    if (!t[0]) return bad(res, 'Mesa no encontrada', 404);

    const [u] = (await pool.query('SELECT name FROM users WHERE id = ? LIMIT 1', [req.user!.userId])) as any;
    const waiterName = u[0]?.name || 'Mesero';

    await pool.query("UPDATE rb_table_sessions SET status = 'closed' WHERE table_id = ? AND tenant_id = ? AND status = 'active'", [tableId, tenantId]);
    const id = uuidv4();
    const token = uuidv4().replace(/-/g, '') + Math.random().toString(36).slice(2, 6);
    await pool.query(
      `INSERT INTO rb_table_sessions (id, tenant_id, table_id, token, waiter_id, waiter_name, status, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', DATE_ADD(NOW(), INTERVAL 12 HOUR))`,
      [id, tenantId, tableId, token, req.user!.userId, waiterName]
    );
    ok(res, { token, tableNumber: t[0].number, path: `/mesa/${token}` });
  } catch (e: any) { bad(res, e?.message || 'No se pudo generar el QR', 500); }
});

// ─────────── AUTH: el mesero administra el QR activo de la mesa ───────────
// Devuelve la sesión activa con invitados y el consumo de cada uno (parseado de
// la etiqueta [nombre] que se guarda en las notas de cada ítem del pedido).
router.get('/tables/:tableId/session', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await ensureTables();
    const tenantId = req.user!.tenantId!;
    const tableId = req.params.tableId;
    const [rows] = (await pool.query(
      `SELECT s.* FROM rb_table_sessions s
         LEFT JOIN rb_orders o ON o.id = s.order_id
        WHERE s.table_id = ? AND s.tenant_id = ? AND s.status = 'active'
          AND (s.expires_at IS NULL OR s.expires_at > NOW())
          AND (s.order_id IS NULL OR o.status NOT IN ('cerrada','cancelada'))
        ORDER BY s.created_at DESC LIMIT 1`,
      [tableId, tenantId]
    )) as any;
    const s = rows[0];
    if (!s) return ok(res, { active: false });

    const [t] = (await pool.query('SELECT number FROM rb_tables WHERE id = ?', [s.table_id])) as any;
    const [guests] = (await pool.query(
      'SELECT id, name, created_at AS createdAt FROM rb_table_guests WHERE session_id = ? ORDER BY created_at ASC', [s.id]
    )) as any;

    // Consumo por persona (match por la etiqueta [nombre] del item_notes).
    const norm = (x: string) => x.trim().toLowerCase();
    const guestMap = new Map<string, { id: string | null; name: string; total: number; items: any[] }>();
    for (const g of guests) guestMap.set(norm(g.name), { id: g.id, name: g.name, total: 0, items: [] });
    const unassigned = { total: 0, items: [] as any[] };
    let orderTotal = 0;

    if (s.order_id) {
      const [its] = (await pool.query(
        `SELECT menu_item_name AS name, quantity, subtotal, item_notes AS notes
           FROM rb_order_items WHERE order_id = ? AND status <> 'cancelado' ORDER BY created_at ASC`,
        [s.order_id]
      )) as any;
      for (const it of its) {
        const sub = Number(it.subtotal || 0);
        orderTotal += sub;
        const m = /^\s*\[([^\]]+)\]/.exec(String(it.notes || ''));
        const entry = m ? guestMap.get(norm(m[1])) : undefined;
        const rec = { name: it.name, quantity: it.quantity, subtotal: sub };
        if (entry) { entry.total += sub; entry.items.push(rec); }
        else { unassigned.total += sub; unassigned.items.push(rec); }
      }
    }

    ok(res, {
      active: true,
      token: s.token,
      path: `/mesa/${s.token}`,
      tableNumber: t[0]?.number ?? '',
      waiterName: s.waiter_name,
      expiresAt: s.expires_at,
      createdAt: s.created_at,
      guestCount: guests.length,
      guests: Array.from(guestMap.values()),
      unassigned,
      orderTotal,
    });
  } catch (e: any) { bad(res, e?.message || 'Error al cargar la sesión', 500); }
});

// AUTH: cerrar/eliminar el QR activo (invalida el token; el pedido de la mesa NO se cierra).
router.post('/tables/:tableId/session/close', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await ensureTables();
    const tenantId = req.user!.tenantId!;
    const [r] = (await pool.query(
      "UPDATE rb_table_sessions SET status = 'closed' WHERE table_id = ? AND tenant_id = ? AND status = 'active'",
      [req.params.tableId, tenantId]
    )) as any;
    ok(res, { closed: r.affectedRows });
  } catch (e: any) { bad(res, e?.message || 'No se pudo cerrar el QR', 500); }
});

// ─────────── PÚBLICO: el cliente abre el QR ───────────
router.get('/session/:token', async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const s = await loadSession(req.params.token);
    if (!s) return bad(res, 'Esta mesa ya no está disponible. Pide al mesero un nuevo QR.', 410);
    const [t] = (await pool.query('SELECT number, status FROM rb_tables WHERE id = ?', [s.table_id])) as any;
    const [store] = (await pool.query('SELECT name FROM store_info WHERE tenant_id = ? LIMIT 1', [s.tenant_id])) as any;
    const [guests] = (await pool.query('SELECT id, name FROM rb_table_guests WHERE session_id = ? ORDER BY created_at ASC', [s.id])) as any;
    const menu = await restbarService.getMenu(s.tenant_id);
    ok(res, { tableNumber: t[0]?.number || '', brand: store[0]?.name || 'Restaurante', guests, menu });
  } catch (e: any) { bad(res, e?.message || 'Error al cargar la mesa', 500); }
});

router.post('/session/:token/join', async (req: Request, res: Response) => {
  try {
    const s = await loadSession(req.params.token);
    if (!s) return bad(res, 'Sesión no válida', 410);
    const name = String(req.body?.name || '').trim().slice(0, 120);
    if (!name) return bad(res, 'Escribe tu nombre');
    const id = uuidv4();
    await pool.query('INSERT INTO rb_table_guests (id, session_id, name) VALUES (?, ?, ?)', [id, s.id, name]);
    ok(res, { guestId: id, name });
  } catch (e: any) { bad(res, e?.message || 'Error al unirse', 500); }
});

router.post('/session/:token/order', async (req: Request, res: Response) => {
  try {
    const s = await loadSession(req.params.token);
    if (!s) return bad(res, 'Sesión no válida', 410);
    const name = String(req.body?.name || '').trim().slice(0, 120);
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) return bad(res, 'Tu pedido está vacío');

    const orderId = await getOrCreateOrderId(s.tenant_id, s.table_id, s.waiter_id, s.waiter_name);
    if (!orderId) return bad(res, 'No se pudo abrir la comanda', 500);

    for (const it of items) {
      const menuItemId = String(it.menuItemId || '');
      const quantity = Math.max(1, parseInt(String(it.quantity || 1), 10));
      if (!menuItemId) continue;
      const note = `${name ? `[${name}] ` : ''}${String(it.notes || '').slice(0, 200)}`.trim();
      await restbarService.addItem(s.tenant_id, orderId, { menuItemId, quantity, itemNotes: note || undefined });
    }
    await restbarService.sendToKitchen(s.tenant_id, orderId);
    await pool.query('UPDATE rb_table_sessions SET order_id = ? WHERE id = ?', [orderId, s.id]);
    ok(res, { orderId, message: 'Pedido enviado a cocina' });
  } catch (e: any) { bad(res, e?.message || 'No se pudo enviar el pedido', 500); }
});

// ─────────── PÚBLICO: el cliente ve el estado de su pedido ───────────
router.get('/session/:token/order', async (req: Request, res: Response) => {
  try {
    const s = await loadSession(req.params.token);
    if (!s) return bad(res, 'Sesion no valida', 410);
    if (!s.order_id) return ok(res, { items: [], total: 0 });
    const [items] = (await pool.query(
      `SELECT menu_item_name AS name, quantity, status, item_notes AS notes
         FROM rb_order_items WHERE order_id = ? AND status <> 'cancelado' ORDER BY created_at ASC`,
      [s.order_id]
    )) as any;
    const [[o]] = (await pool.query('SELECT total FROM rb_orders WHERE id = ?', [s.order_id])) as any;
    ok(res, { items, total: Number(o?.total || 0) });
  } catch (e: any) { bad(res, e?.message || 'Error al cargar tu pedido', 500); }
});

// ─────────── PÚBLICO: regalar a otra mesa ───────────
// Lista las otras mesas ocupadas (con sesión activa) a las que se puede regalar.
router.get('/session/:token/tables', async (req: Request, res: Response) => {
  try {
    const s = await loadSession(req.params.token);
    if (!s) return bad(res, 'Sesion no valida', 410);
    const [rows] = (await pool.query(
      `SELECT DISTINCT t.id, t.number, t.area
         FROM rb_table_sessions ts
         JOIN rb_tables t ON t.id = ts.table_id
        WHERE ts.tenant_id = ? AND ts.status = 'active' AND ts.table_id <> ?
          AND (ts.expires_at IS NULL OR ts.expires_at > NOW())
        ORDER BY t.number ASC`,
      [s.tenant_id, s.table_id]
    )) as any;
    ok(res, { tables: rows });
  } catch (e: any) { bad(res, e?.message || 'Error al listar mesas', 500); }
});

// Envía uno o varios items como regalo a otra mesa: entra a la comanda de ESA mesa.
router.post('/session/:token/gift', async (req: Request, res: Response) => {
  try {
    const s = await loadSession(req.params.token);
    if (!s) return bad(res, 'Sesion no valida', 410);
    const fromName = String(req.body?.name || '').trim().slice(0, 120);
    const targetTableId = String(req.body?.targetTableId || '');
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!targetTableId) return bad(res, 'Elige una mesa de destino');
    if (targetTableId === s.table_id) return bad(res, 'No puedes regalarte a tu propia mesa');
    if (!items.length) return bad(res, 'Elige al menos un producto para regalar');

    // La mesa destino debe existir y tener una sesión activa (estar ocupada).
    const [tgt] = (await pool.query(
      `SELECT t.id, t.number FROM rb_tables t
         JOIN rb_table_sessions ts ON ts.table_id = t.id AND ts.status = 'active'
        WHERE t.id = ? AND t.tenant_id = ? AND t.is_active = 1
          AND (ts.expires_at IS NULL OR ts.expires_at > NOW()) LIMIT 1`,
      [targetTableId, s.tenant_id]
    )) as any;
    if (!tgt[0]) return bad(res, 'Esa mesa ya no está disponible', 410);

    const [myTable] = (await pool.query('SELECT number FROM rb_tables WHERE id = ?', [s.table_id])) as any;
    const orderId = await getOrCreateOrderId(s.tenant_id, targetTableId, s.waiter_id, s.waiter_name);
    if (!orderId) return bad(res, 'No se pudo abrir la comanda destino', 500);

    const tag = `🎁 Regalo de ${fromName || 'la mesa ' + (myTable[0]?.number ?? '')} (Mesa ${myTable[0]?.number ?? '?'})`;
    for (const it of items) {
      const menuItemId = String(it.menuItemId || '');
      const quantity = Math.max(1, parseInt(String(it.quantity || 1), 10));
      if (!menuItemId) continue;
      await restbarService.addItem(s.tenant_id, orderId, { menuItemId, quantity, itemNotes: tag });
    }
    await restbarService.sendToKitchen(s.tenant_id, orderId);
    ok(res, { message: `Regalo enviado a la Mesa ${tgt[0].number}`, tableNumber: tgt[0].number });
  } catch (e: any) { bad(res, e?.message || 'No se pudo enviar el regalo', 500); }
});

// ─────────── PÚBLICO: rocola / pedir canción (se desbloquea por consumo) ───────────
router.get('/session/:token/jukebox', async (req: Request, res: Response) => {
  try {
    const s = await loadSession(req.params.token);
    if (!s) return bad(res, 'Sesion no valida', 410);
    const cfg = await jukeboxConfig(s.tenant_id);
    const total = await sessionTotal(s.order_id);
    const [queue] = (await pool.query(
      `SELECT title, requested_by AS requestedBy, status FROM rb_jukebox_queue
        WHERE tenant_id = ? AND status IN ('queued','playing') ORDER BY created_at ASC LIMIT 30`,
      [s.tenant_id]
    )) as any;
    ok(res, { enabled: cfg.enabled, threshold: cfg.threshold, total, unlocked: cfg.enabled && total >= cfg.threshold, queue });
  } catch (e: any) { bad(res, e?.message || 'Error al cargar la rocola', 500); }
});

router.post('/session/:token/jukebox', async (req: Request, res: Response) => {
  try {
    const s = await loadSession(req.params.token);
    if (!s) return bad(res, 'Sesion no valida', 410);
    const cfg = await jukeboxConfig(s.tenant_id);
    if (!cfg.enabled) return bad(res, 'La rocola no está disponible', 403);
    const total = await sessionTotal(s.order_id);
    if (total < cfg.threshold) return bad(res, 'Aún no alcanzas el mínimo de consumo para pedir canción', 403);
    const title = String(req.body?.title || '').trim().slice(0, 200);
    if (!title) return bad(res, 'Escribe el nombre de la canción');
    const url = String(req.body?.url || '').trim().slice(0, 500) || null;
    const by = String(req.body?.name || '').trim().slice(0, 120) || null;
    await pool.query(
      'INSERT INTO rb_jukebox_queue (id, tenant_id, table_session_id, title, url, requested_by) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), s.tenant_id, s.id, title, url, by]
    );
    ok(res, { message: '¡Canción agregada a la cola!' });
  } catch (e: any) { bad(res, e?.message || 'No se pudo agregar la canción', 500); }
});

// ─────────── STAFF: cola de la rocola del local ───────────
router.get('/jukebox', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await ensureTables();
    const [queue] = (await pool.query(
      `SELECT id, title, url, requested_by AS requestedBy, status, created_at AS createdAt
         FROM rb_jukebox_queue WHERE tenant_id = ? AND status IN ('queued','playing') ORDER BY created_at ASC`,
      [req.user!.tenantId!]
    )) as any;
    ok(res, { queue });
  } catch (e: any) { bad(res, e?.message || 'Error al cargar la cola', 500); }
});

router.patch('/jukebox/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const status = String(req.body?.status || '');
    if (!['queued', 'playing', 'played', 'skipped'].includes(status)) return bad(res, 'Estado inválido');
    const [r] = (await pool.query('UPDATE rb_jukebox_queue SET status = ? WHERE id = ? AND tenant_id = ?',
      [status, req.params.id, req.user!.tenantId!])) as any;
    if (r.affectedRows === 0) return bad(res, 'Canción no encontrada', 404);
    ok(res, { id: req.params.id, status });
  } catch (e: any) { bad(res, e?.message || 'No se pudo actualizar', 500); }
});

// ─────────── PÚBLICO: fidelización (consultar saldo / canjear) ───────────
router.get('/session/:token/loyalty', async (req: Request, res: Response) => {
  try {
    const s = await loadSession(req.params.token);
    if (!s) return bad(res, 'Sesion no valida', 410);
    await ensureLoyaltyTables();
    const cfg = await getLoyaltyConfig(s.tenant_id);
    const phone = String(req.query.phone || '').trim();
    let balance = 0; let accountName: string | null = null;
    if (phone) {
      const [a] = (await pool.query('SELECT customer_name, points_balance FROM loyalty_accounts WHERE tenant_id = ? AND customer_phone = ? LIMIT 1', [s.tenant_id, phone.replace(/\s/g, '')])) as any;
      if (a[0]) { balance = Number(a[0].points_balance); accountName = a[0].customer_name; }
    }
    const [rewards] = (await pool.query(
      'SELECT id, name, description, points_cost AS pointsCost FROM loyalty_rewards WHERE tenant_id = ? AND is_active = 1 ORDER BY points_cost ASC',
      [s.tenant_id]
    )) as any;
    ok(res, { enabled: cfg.enabled, pointsPerThousand: cfg.pointsPerThousand, balance, accountName, rewards });
  } catch (e: any) { bad(res, e?.message || 'Error al cargar puntos', 500); }
});

router.post('/session/:token/loyalty/redeem', async (req: Request, res: Response) => {
  try {
    const s = await loadSession(req.params.token);
    if (!s) return bad(res, 'Sesion no valida', 410);
    await ensureLoyaltyTables();
    const cfg = await getLoyaltyConfig(s.tenant_id);
    if (!cfg.enabled) return bad(res, 'La fidelización no está activa', 403);
    const phone = String(req.body?.phone || '').trim();
    const rewardId = String(req.body?.rewardId || '');
    if (!phone) return bad(res, 'Ingresa tu teléfono');
    if (!rewardId) return bad(res, 'Elige una recompensa');

    const [rw] = (await pool.query('SELECT id, name, points_cost FROM loyalty_rewards WHERE id = ? AND tenant_id = ? AND is_active = 1 LIMIT 1', [rewardId, s.tenant_id])) as any;
    if (!rw[0]) return bad(res, 'Recompensa no disponible', 404);
    const cost = Number(rw[0].points_cost);

    const acct = await ensureAccount(s.tenant_id, phone, req.body?.name);
    if (Number(acct.points_balance) < cost) return bad(res, `Te faltan ${cost - Number(acct.points_balance)} puntos para esta recompensa`);

    const code = 'C' + Math.floor(10000 + Math.random() * 89999).toString();
    await pool.query('UPDATE loyalty_accounts SET points_balance = points_balance - ? WHERE id = ?', [cost, acct.id]);
    await pool.query('INSERT INTO loyalty_transactions (id, tenant_id, account_id, type, points, reason, order_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), s.tenant_id, acct.id, 'redeem', -cost, `Canje: ${rw[0].name} [${code}]`, s.order_id || null]);
    ok(res, { code, reward: rw[0].name, cost, remaining: Number(acct.points_balance) - cost });
  } catch (e: any) { bad(res, e?.message || 'No se pudo canjear', 500); }
});

export default router;
