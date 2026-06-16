/**
 * restbar.reports.routes.ts — Reportes de restaurante (Fase 4).
 *
 * Resumen de ventas/pagos, top de productos y rendimiento por mesero y por mesa,
 * en un rango de fechas. Reutiliza rb_orders / rb_payments / rb_order_items.
 * Solo lectura, scoped por tenant_id. Montado en /api/restbar/reports.
 */
import { Router, Response } from 'express';
import pool from '../../config/database';
import { authenticate, authorize, AuthRequest } from '../../common/middleware';
import { UserRole } from '../../common/types';

const router: ReturnType<typeof Router> = Router();
const ADMIN_ROLES: UserRole[] = ['superadmin', 'comerciante', 'administrador_rb'];

const ok = (res: Response, data: any) => res.json({ success: true, data });

function range(req: AuthRequest): { from: string; to: string } {
  const today = new Date();
  const def = new Date(today.getTime() - 29 * 86400000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const from = String(req.query.from || iso(def)).slice(0, 10);
  const to = String(req.query.to || iso(today)).slice(0, 10);
  return { from, to };
}

// GET /api/restbar/reports/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/summary', authenticate, authorize(...ADMIN_ROLES), async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenantId!;
  const { from, to } = range(req);
  const result: any = { from, to, payments: [], topProducts: [], waiters: [], tables: [], kpis: {} };

  // Resumen de pagos por método
  try {
    const [rows] = (await pool.query(
      `SELECT payment_method AS method, COUNT(*) AS count, SUM(amount) AS total
         FROM rb_payments
        WHERE tenant_id = ? AND created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)
        GROUP BY payment_method ORDER BY total DESC`,
      [tenantId, from, to]
    )) as any;
    result.payments = rows.map((r: any) => ({ method: r.method, count: Number(r.count), total: Number(r.total) }));
  } catch { /* tabla puede no existir aún */ }

  // Comandas cerradas en el rango (KPIs)
  try {
    const [[o]] = (await pool.query(
      `SELECT COUNT(*) AS orders, COALESCE(SUM(total),0) AS sales, COALESCE(AVG(total),0) AS avgTicket
         FROM rb_orders
        WHERE tenant_id = ? AND status = 'cerrada'
          AND closed_at >= ? AND closed_at < DATE_ADD(?, INTERVAL 1 DAY)`,
      [tenantId, from, to]
    )) as any;
    result.kpis = {
      orders: Number(o?.orders || 0),
      sales: Number(o?.sales || 0),
      avgTicket: Math.round(Number(o?.avgTicket || 0)),
      paymentsTotal: result.payments.reduce((s: number, p: any) => s + p.total, 0),
    };
  } catch { /* ignore */ }

  // Top de productos
  try {
    const [rows] = (await pool.query(
      `SELECT oi.menu_item_name AS name, SUM(oi.quantity) AS qty, SUM(oi.subtotal) AS revenue
         FROM rb_order_items oi
         JOIN rb_orders o ON o.id = oi.order_id
        WHERE oi.tenant_id = ? AND o.status = 'cerrada' AND oi.status <> 'cancelado'
          AND o.closed_at >= ? AND o.closed_at < DATE_ADD(?, INTERVAL 1 DAY)
        GROUP BY oi.menu_item_name ORDER BY qty DESC LIMIT 15`,
      [tenantId, from, to]
    )) as any;
    result.topProducts = rows.map((r: any) => ({ name: r.name, qty: Number(r.qty), revenue: Number(r.revenue) }));
  } catch { /* ignore */ }

  // Rendimiento por mesero
  try {
    const [rows] = (await pool.query(
      `SELECT waiter_name AS name, COUNT(*) AS orders, COALESCE(SUM(total),0) AS sales
         FROM rb_orders
        WHERE tenant_id = ? AND status = 'cerrada'
          AND closed_at >= ? AND closed_at < DATE_ADD(?, INTERVAL 1 DAY)
        GROUP BY waiter_id, waiter_name ORDER BY sales DESC`,
      [tenantId, from, to]
    )) as any;
    result.waiters = rows.map((r: any) => ({ name: r.name, orders: Number(r.orders), sales: Number(r.sales) }));
  } catch { /* ignore */ }

  // Rendimiento por mesa
  try {
    const [rows] = (await pool.query(
      `SELECT t.number AS tableNumber, COUNT(*) AS orders, COALESCE(SUM(o.total),0) AS sales
         FROM rb_orders o JOIN rb_tables t ON t.id = o.table_id
        WHERE o.tenant_id = ? AND o.status = 'cerrada'
          AND o.closed_at >= ? AND o.closed_at < DATE_ADD(?, INTERVAL 1 DAY)
        GROUP BY t.id, t.number ORDER BY sales DESC`,
      [tenantId, from, to]
    )) as any;
    result.tables = rows.map((r: any) => ({ tableNumber: r.tableNumber, orders: Number(r.orders), sales: Number(r.sales) }));
  } catch { /* ignore */ }

  ok(res, result);
});

export default router;
