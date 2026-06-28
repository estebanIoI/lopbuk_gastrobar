/**
 * notifications.routes.ts — Notificaciones dirigidas al comercio (tenant).
 *
 * GET    /api/notifications              → últimas notificaciones del tenant
 * GET    /api/notifications/unread-count → contador de no leídas
 * POST   /api/notifications/:id/read     → marcar una como leída
 * POST   /api/notifications/read-all     → marcar todas como leídas
 *
 * `createNotification` se exporta para que otros módulos emitan avisos.
 */
import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../../config/database';
import { authenticate, AuthRequest } from '../../common/middleware';

const router: ReturnType<typeof Router> = Router();

const ok = (res: Response, data: any) => res.json({ success: true, data });
const fail = (res: Response, e: any, msg: string) => {
  console.error(`${msg}:`, e);
  res.status(500).json({ success: false, error: e?.message || msg });
};

// Auto-crea la tabla si no existe (evita 500 en instalaciones nuevas)
async function ensureTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id         VARCHAR(36) PRIMARY KEY,
      tenant_id  VARCHAR(36) NOT NULL,
      type       VARCHAR(40)  NOT NULL DEFAULT 'general',
      title      VARCHAR(200) NOT NULL,
      body       VARCHAR(500) NULL,
      link       VARCHAR(500) NULL,
      is_read    BOOLEAN      NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
      KEY idx_notif_tenant (tenant_id, is_read, created_at)
    )
  `);
}

// Ejecutar al arrancar el módulo (no bloquea el servidor)
ensureTable().catch(e => console.error('notifications ensureTable error:', e));

/** Crea una notificación para un tenant (reutilizable por otros módulos). */
export async function createNotification(
  tenantId: string,
  n: { type?: string; title: string; body?: string | null; link?: string | null }
): Promise<void> {
  if (!tenantId) return;
  try {
    await pool.query(
      'INSERT INTO notifications (id, tenant_id, type, title, body, link) VALUES (?,?,?,?,?,?)',
      [uuidv4(), tenantId, n.type || 'general', n.title, n.body || null, n.link || null]
    );
  } catch (e) {
    // No interrumpe el flujo principal si la tabla aún no existe / falla.
    console.error('createNotification error:', e);
  }
}

router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    if (!tenantId) return ok(res, []);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'), 10)));
    const [rows] = (await pool.query(
      'SELECT id, type, title, body, link, is_read AS isRead, created_at AS createdAt FROM notifications WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?',
      [tenantId, limit]
    )) as any;
    ok(res, (rows || []).map((r: any) => ({ ...r, isRead: !!r.isRead })));
  } catch (e) { fail(res, e, 'Error al obtener notificaciones'); }
});

router.get('/unread-count', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    if (!tenantId) return ok(res, { count: 0 });
    const [[r]] = (await pool.query(
      'SELECT COUNT(*) AS count FROM notifications WHERE tenant_id = ? AND is_read = 0', [tenantId]
    )) as any;
    ok(res, { count: Number(r?.count || 0) });
  } catch (e) { fail(res, e, 'Error al contar notificaciones'); }
});

router.post('/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    await pool.query('UPDATE notifications SET is_read = 1 WHERE id = ? AND tenant_id = ?', [req.params.id, req.user!.tenantId]);
    ok(res, { read: true });
  } catch (e) { fail(res, e, 'Error al marcar como leída'); }
});

router.post('/read-all', async (req: AuthRequest, res: Response) => {
  try {
    await pool.query('UPDATE notifications SET is_read = 1 WHERE tenant_id = ? AND is_read = 0', [req.user!.tenantId]);
    ok(res, { read: true });
  } catch (e) { fail(res, e, 'Error al marcar todas'); }
});

export default router;
