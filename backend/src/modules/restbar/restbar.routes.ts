import { Router, Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import { restbarController } from './restbar.controller';
import { authenticate, authorize } from '../../common/middleware';
import { validateRequest } from '../../utils/validators';
import pool from '../../config/database';

const router: ReturnType<typeof Router> = Router();

// ── PUBLIC: menú sin autenticación ───────────────────────────────────────────
router.get('/public-menu/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const [tenants] = await pool.query(
      'SELECT id, name FROM tenants WHERE slug = ? AND status = ? AND public_menu_enabled = 1 LIMIT 1',
      [slug, 'activo']
    ) as any;
    if (!tenants?.length) {
      res.status(404).json({ success: false, error: 'Menú no disponible' });
      return;
    }
    const tenantId = tenants[0].id;
    const storeName = tenants[0].name;

    const [items] = await pool.query(
      `SELECT p.id, p.name, p.category, p.description, p.sale_price AS price,
              p.image_url AS imageUrl, p.preparation_area AS preparationArea,
              p.prep_time_minutes AS prepTimeMinutes
       FROM products p
       WHERE p.tenant_id = ? AND p.is_menu_item = 1 AND p.available_in_menu = 1
       ORDER BY p.category, p.name`,
      [tenantId]
    ) as any;

    // Group by category
    const grouped: Record<string, any[]> = {};
    for (const item of items) {
      const cat = item.category || 'General';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push({
        id: item.id,
        name: item.name,
        description: item.description,
        price: Number(item.price),
        imageUrl: item.imageUrl,
        preparationArea: item.preparationArea,
        prepTimeMinutes: item.prepTimeMinutes,
      });
    }

    res.json({ success: true, data: { storeName, slug, categories: grouped } });
  } catch (error) {
    console.error('Public menu error:', error);
    res.status(500).json({ success: false, error: 'Error al obtener el menú' });
  }
});

router.use(authenticate);

const ADMIN_ROLES   = ['superadmin', 'comerciante', 'administrador_rb'];
// vendedor tiene los mismos permisos que mesero dentro del módulo RestBar
const WAITER_ROLES  = [...ADMIN_ROLES, 'mesero', 'vendedor'];
const KITCHEN_ROLES = [...ADMIN_ROLES, 'cocinero', 'bartender'];
const CASHIER_ROLES = [...ADMIN_ROLES, 'cajero', 'vendedor'];
const ALL_RB_ROLES  = [...new Set([...WAITER_ROLES, ...KITCHEN_ROLES, ...CASHIER_ROLES])];

// ── TABLES ────────────────────────────────────────────────────────────────────
router.get('/tables', authorize(...ALL_RB_ROLES), restbarController.getTables.bind(restbarController));

router.post(
  '/tables',
  authorize(...ADMIN_ROLES),
  [
    body('number').notEmpty().withMessage('El número o nombre de la mesa es requerido'),
    body('capacity').optional().isInt({ min: 1, max: 100 }),
    body('area').optional().isString(),
    validateRequest,
  ],
  restbarController.createTable.bind(restbarController)
);

router.put(
  '/tables/:id',
  authorize(...ADMIN_ROLES),
  [param('id').notEmpty(), validateRequest],
  restbarController.updateTable.bind(restbarController)
);

router.patch(
  '/tables/:id/status',
  authorize(...ALL_RB_ROLES),
  [
    param('id').notEmpty(),
    body('status').isIn(['libre','ocupada','reservada','inactiva'])
      .withMessage('Estado inválido'),
    validateRequest,
  ],
  restbarController.updateTableStatus.bind(restbarController)
);

router.delete(
  '/tables/:id',
  authorize(...ADMIN_ROLES),
  [param('id').notEmpty(), validateRequest],
  restbarController.deleteTable.bind(restbarController)
);

// ── MENU ──────────────────────────────────────────────────────────────────────
router.get('/menu', authorize(...ALL_RB_ROLES), restbarController.getMenu.bind(restbarController));

router.get(
  '/menu/:id/yield',
  authorize(...ALL_RB_ROLES),
  [param('id').notEmpty(), validateRequest],
  restbarController.getMenuItemYield.bind(restbarController)
);

router.get('/menu/catalog', authorize(...ADMIN_ROLES), restbarController.getMenuCatalog.bind(restbarController));

router.patch(
  '/menu/:id/settings',
  authorize(...ADMIN_ROLES),
  [
    param('id').notEmpty(),
    body('isMenuItem').isBoolean().withMessage('isMenuItem debe ser booleano'),
    body('preparationArea').optional({ nullable: true }).isIn(['cocina','bar','ambos']),
    body('prepTimeMinutes').optional({ nullable: true }).isInt({ min: 1 }),
    validateRequest,
  ],
  restbarController.updateMenuSettings.bind(restbarController)
);

router.patch(
  '/menu/:id/availability',
  authorize(...ADMIN_ROLES),
  [param('id').notEmpty(), validateRequest],
  restbarController.toggleAvailability.bind(restbarController)
);

// ── ORDERS ────────────────────────────────────────────────────────────────────
router.get(
  '/orders',
  authorize(...ALL_RB_ROLES),
  [query('status').optional().isIn(['abierta','en_proceso','lista','entregada','cerrada','cancelada']), validateRequest],
  restbarController.getOrders.bind(restbarController)
);

router.post(
  '/orders',
  authorize(...WAITER_ROLES),
  [
    body('tableId').notEmpty().withMessage('La mesa es requerida'),
    body('guestsCount').optional().isInt({ min: 1 }),
    body('notes').optional().isString(),
    validateRequest,
  ],
  restbarController.createOrder.bind(restbarController)
);

router.get(
  '/orders/:id',
  authorize(...ALL_RB_ROLES),
  [param('id').notEmpty(), validateRequest],
  restbarController.getOrderById.bind(restbarController)
);

router.patch(
  '/orders/:id/notes',
  authorize(...WAITER_ROLES),
  [param('id').notEmpty(), body('notes').optional({ nullable: true }).isString(), validateRequest],
  restbarController.updateOrderNotes.bind(restbarController)
);

router.post(
  '/orders/:id/items',
  authorize(...WAITER_ROLES),
  [
    param('id').notEmpty(),
    body('menuItemId').notEmpty().withMessage('El ítem de menú es requerido'),
    body('quantity').isInt({ min: 1 }).withMessage('La cantidad debe ser mayor a 0'),
    body('itemNotes').optional().isString(),
    body('guestNumber').optional().isInt({ min: 1 }),
    validateRequest,
  ],
  restbarController.addItem.bind(restbarController)
);

router.put(
  '/orders/:id/items/:itemId',
  authorize(...WAITER_ROLES),
  [
    param('id').notEmpty(), param('itemId').notEmpty(),
    body('quantity').optional().isInt({ min: 1 }),
    body('itemNotes').optional().isString(),
    body('guestNumber').optional({ nullable: true }).isInt({ min: 1 }),
    validateRequest,
  ],
  restbarController.updateItem.bind(restbarController)
);

router.delete(
  '/orders/:id/items/:itemId',
  authorize(...WAITER_ROLES),
  [param('id').notEmpty(), param('itemId').notEmpty(), validateRequest],
  restbarController.removeItem.bind(restbarController)
);

router.post(
  '/orders/:id/send',
  authorize(...WAITER_ROLES),
  [param('id').notEmpty(), validateRequest],
  restbarController.sendToKitchen.bind(restbarController)
);

router.delete(
  '/orders/:id',
  authorize(...WAITER_ROLES),
  [param('id').notEmpty(), validateRequest],
  restbarController.cancelOrder.bind(restbarController)
);

// ── KITCHEN / BAR DISPLAY ─────────────────────────────────────────────────────
router.get('/kitchen', authorize(...KITCHEN_ROLES, ...ADMIN_ROLES), restbarController.getKitchenDisplay.bind(restbarController));
router.get('/bar',     authorize(...KITCHEN_ROLES, ...ADMIN_ROLES), restbarController.getBarDisplay.bind(restbarController));

router.patch(
  '/items/:itemId/status',
  authorize(...KITCHEN_ROLES, ...WAITER_ROLES, ...ADMIN_ROLES),
  [
    param('itemId').notEmpty(),
    body('status').isIn(['en_preparacion','listo','entregado','cancelado'])
      .withMessage('Estado inválido'),
    validateRequest,
  ],
  restbarController.updateItemStatus.bind(restbarController)
);

// ── PAYMENT ───────────────────────────────────────────────────────────────────
router.get(
  '/orders/:id/guests',
  authorize(...ALL_RB_ROLES),
  [param('id').notEmpty(), validateRequest],
  restbarController.getGuestBreakdown.bind(restbarController)
);

router.post(
  '/orders/:id/pay',
  authorize(...CASHIER_ROLES),
  [
    param('id').notEmpty(),
    body('paymentMethod').isIn(['efectivo','tarjeta','nequi','bancolombia','bbva','transferencia','mixto'])
      .withMessage('Método de pago inválido'),
    body('amountPaid').isFloat({ min: 0 }).withMessage('El monto recibido es requerido'),
    body('cashSessionId').optional().isString(),
    body('guestNumber').optional({ nullable: true }).isInt({ min: 1 }),
    validateRequest,
  ],
  restbarController.processPayment.bind(restbarController)
);

// ── REPORTS ───────────────────────────────────────────────────────────────────
router.get(
  '/reports/summary',
  authorize(...CASHIER_ROLES),
  [query('date').optional().isISO8601(), validateRequest],
  restbarController.getDailySummary.bind(restbarController)
);

router.get('/reports/analytics', authorize(...ADMIN_ROLES), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    const tz = 'America/Bogota';
    // Default: last 30 days in Colombia timezone
    const toDate   = (req.query.to   as string) || new Date().toLocaleDateString('en-CA', { timeZone: tz });
    const fromDate = (req.query.from as string) || (() => {
      const d = new Date(); d.setDate(d.getDate() - 29);
      return d.toLocaleDateString('en-CA', { timeZone: tz });
    })();

    const tzExpr = `CONVERT_TZ(o.opened_at, '+00:00', '-05:00')`;
    const dateCond = `DATE(${tzExpr}) BETWEEN ? AND ?`;

    const payDateCond = `DATE(CONVERT_TZ(p.created_at, '+00:00', '-05:00')) BETWEEN ? AND ?`;

    // 1a. Order counts (by opened_at)
    const [kpiOrders] = await pool.query(`
      SELECT
        COUNT(DISTINCT o.id)                                               AS total_orders,
        COUNT(DISTINCT CASE WHEN o.status='cerrada' THEN o.id END)         AS closed_orders
      FROM rb_orders o
      WHERE o.tenant_id = ? AND ${dateCond}
    `, [tenantId, fromDate, toDate]) as any;

    // 1b. Revenue from rb_payments (by payment date, matches Análisis/invoices)
    const [kpiRevenue] = await pool.query(`
      SELECT
        COALESCE(SUM(p.amount), 0)                                              AS revenue,
        COALESCE(SUM(p.amount) / NULLIF(COUNT(DISTINCT p.order_id), 0), 0)     AS avg_ticket
      FROM rb_payments p
      WHERE p.tenant_id = ? AND ${payDateCond}
    `, [tenantId, fromDate, toDate]) as any;

    // 1c. Item counts (by opened_at)
    const [kpiItems] = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN oi.status!='cancelado' THEN oi.quantity END), 0) AS items_sold,
        COUNT(DISTINCT CASE WHEN oi.status='cancelado' THEN oi.id END)           AS items_cancelled
      FROM rb_order_items oi
      JOIN rb_orders o ON o.id = oi.order_id
      WHERE oi.tenant_id = ? AND ${dateCond}
    `, [tenantId, fromDate, toDate]) as any;

    const kpi = [{ ...kpiOrders[0], ...kpiRevenue[0], ...kpiItems[0] }];

    // 2. Daily revenue trend
    // 2. Daily revenue — use rb_payments by payment date (matches Análisis), DATE_FORMAT forces string
    const [daily] = await pool.query(`
      SELECT DATE_FORMAT(CONVERT_TZ(p.created_at, '+00:00', '-05:00'), '%Y-%m-%d') AS day,
             COALESCE(SUM(p.amount), 0)       AS revenue,
             COUNT(DISTINCT p.order_id)       AS orders
      FROM rb_payments p
      WHERE p.tenant_id = ? AND ${payDateCond}
      GROUP BY day ORDER BY day
    `, [tenantId, fromDate, toDate]) as any;

    // 3. Hourly distribution (hour 0-23)
    const [hourly] = await pool.query(`
      SELECT HOUR(${tzExpr}) AS hr,
             COUNT(DISTINCT o.id) AS orders,
             COALESCE(SUM(CASE WHEN o.status='cerrada' THEN o.total END), 0) AS revenue
      FROM rb_orders o
      WHERE o.tenant_id = ? AND ${dateCond}
      GROUP BY hr ORDER BY hr
    `, [tenantId, fromDate, toDate]) as any;

    // 4. Day of week (1=Sunday … 7=Saturday in MySQL DAYOFWEEK)
    const [byDow] = await pool.query(`
      SELECT DAYOFWEEK(${tzExpr}) AS dow,
             COALESCE(SUM(CASE WHEN o.status='cerrada' THEN o.total END), 0) AS revenue,
             COUNT(DISTINCT o.id) AS orders
      FROM rb_orders o
      WHERE o.tenant_id = ? AND ${dateCond}
      GROUP BY dow ORDER BY dow
    `, [tenantId, fromDate, toDate]) as any;

    // 5. Payment methods breakdown
    const [byMethod] = await pool.query(`
      SELECT p.payment_method, SUM(p.amount) AS total, COUNT(*) AS txn
      FROM rb_payments p
      JOIN rb_orders o ON o.id = p.order_id
      WHERE p.tenant_id = ? AND ${dateCond}
      GROUP BY p.payment_method ORDER BY total DESC
    `, [tenantId, fromDate, toDate]) as any;

    // 6. Top 10 products by qty and revenue
    const [topItems] = await pool.query(`
      SELECT oi.menu_item_name AS name,
             SUM(oi.quantity)  AS qty,
             SUM(oi.subtotal)  AS revenue,
             oi.preparation_area AS area
      FROM rb_order_items oi
      JOIN rb_orders o ON o.id = oi.order_id
      WHERE oi.tenant_id = ? AND ${dateCond} AND oi.status != 'cancelado'
      GROUP BY oi.menu_item_id, oi.menu_item_name, oi.preparation_area
      ORDER BY revenue DESC LIMIT 10
    `, [tenantId, fromDate, toDate]) as any;

    // 7. Waiter performance
    const [waiters] = await pool.query(`
      SELECT o.waiter_name,
             COUNT(DISTINCT o.id)                                               AS orders,
             COALESCE(SUM(CASE WHEN o.status='cerrada' THEN o.total END), 0)   AS revenue,
             COALESCE(AVG(CASE WHEN o.status='cerrada' THEN o.total END), 0)   AS avg_ticket,
             COUNT(DISTINCT CASE WHEN oi.status='cancelado' THEN oi.id END)    AS cancelled_items
      FROM rb_orders o
      LEFT JOIN rb_order_items oi ON oi.order_id = o.id
      WHERE o.tenant_id = ? AND ${dateCond}
      GROUP BY o.waiter_id, o.waiter_name ORDER BY revenue DESC LIMIT 10
    `, [tenantId, fromDate, toDate]) as any;

    // 8. Table performance
    const [tables] = await pool.query(`
      SELECT t.number AS table_number, t.area,
             COUNT(DISTINCT o.id)                                              AS visits,
             COALESCE(SUM(CASE WHEN o.status='cerrada' THEN o.total END), 0)  AS revenue,
             COALESCE(AVG(o.guests_count), 0)                                 AS avg_guests,
             COALESCE(AVG(TIMESTAMPDIFF(MINUTE, o.opened_at, o.closed_at)), 0) AS avg_minutes
      FROM rb_tables t
      LEFT JOIN rb_orders o ON o.table_id = t.id AND o.tenant_id = t.tenant_id
        AND ${dateCond}
      WHERE t.tenant_id = ? AND t.is_active = 1
      GROUP BY t.id, t.number, t.area ORDER BY revenue DESC
    `, [tenantId, fromDate, toDate]) as any;

    // 9. Preparation area breakdown (cocina vs bar)
    const [byArea] = await pool.query(`
      SELECT oi.preparation_area AS area,
             SUM(oi.quantity) AS qty,
             SUM(oi.subtotal) AS revenue
      FROM rb_order_items oi
      JOIN rb_orders o ON o.id = oi.order_id
      WHERE oi.tenant_id = ? AND ${dateCond} AND oi.status != 'cancelado'
      GROUP BY oi.preparation_area
    `, [tenantId, fromDate, toDate]) as any;

    // 10. Avg prep time (minutes from sent_to_kitchen to ready)
    const [prepTime] = await pool.query(`
      SELECT oi.preparation_area AS area,
             ROUND(AVG(TIMESTAMPDIFF(MINUTE, oi.sent_to_kitchen_at, oi.ready_at)), 1) AS avg_min
      FROM rb_order_items oi
      JOIN rb_orders o ON o.id = oi.order_id
      WHERE oi.tenant_id = ? AND ${dateCond}
        AND oi.sent_to_kitchen_at IS NOT NULL AND oi.ready_at IS NOT NULL
        AND oi.status NOT IN ('cancelado')
      GROUP BY oi.preparation_area
    `, [tenantId, fromDate, toDate]) as any;

    res.json({
      success: true,
      data: {
        period: { from: fromDate, to: toDate },
        kpi: {
          totalOrders:    Number(kpi[0].total_orders),
          closedOrders:   Number(kpi[0].closed_orders),
          revenue:        Number(kpi[0].revenue),
          avgTicket:      Number(kpi[0].avg_ticket),
          itemsSold:      Number(kpi[0].items_sold),
          itemsCancelled: Number(kpi[0].items_cancelled),
          closeRate:      kpi[0].total_orders > 0
            ? Math.round((kpi[0].closed_orders / kpi[0].total_orders) * 100) : 0,
        },
        daily:    daily.map((r: any) => ({ day: r.day, revenue: Number(r.revenue), orders: Number(r.orders) })),
        hourly:   hourly.map((r: any) => ({ hr: Number(r.hr), orders: Number(r.orders), revenue: Number(r.revenue) })),
        byDow:    byDow.map((r: any) => ({ dow: Number(r.dow), revenue: Number(r.revenue), orders: Number(r.orders) })),
        byMethod: byMethod.map((r: any) => ({ method: r.payment_method, total: Number(r.total), txn: Number(r.txn) })),
        topItems: topItems.map((r: any) => ({ name: r.name, qty: Number(r.qty), revenue: Number(r.revenue), area: r.area })),
        waiters:  waiters.map((r: any) => ({
          name: r.waiter_name, orders: Number(r.orders),
          revenue: Number(r.revenue), avgTicket: Number(r.avg_ticket),
          cancelledItems: Number(r.cancelled_items),
        })),
        tables: tables.map((r: any) => ({
          number: r.table_number, area: r.area,
          visits: Number(r.visits), revenue: Number(r.revenue),
          avgGuests: Number(r.avg_guests), avgMinutes: Number(r.avg_minutes),
        })),
        byArea:   byArea.map((r: any) => ({ area: r.area, qty: Number(r.qty), revenue: Number(r.revenue) })),
        prepTime: prepTime.map((r: any) => ({ area: r.area, avgMin: Number(r.avg_min) })),
      },
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ success: false, error: 'Error al generar analytics' });
  }
});

router.get('/reports/payments', authorize(...CASHIER_ROLES), async (req: Request, res: Response) => {
  try {
    const tenantId  = (req as any).user?.tenantId;
    const cashierId = (req as any).user?.userId || (req as any).user?.id;
    // Use Colombia timezone (UTC-5) for "today"
    const colombiaDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const [rows] = await pool.query(
      `SELECT
         p.id, p.payment_method, p.amount, p.amount_paid, p.change_amount,
         p.cashier_name, p.guest_number, p.created_at,
         o.order_number,
         t.number AS table_number
       FROM rb_payments p
       JOIN rb_orders o ON o.id = p.order_id
       LEFT JOIN rb_tables t ON t.id = o.table_id
       WHERE p.tenant_id = ?
         AND p.cashier_id = ?
         AND DATE(CONVERT_TZ(p.created_at, '+00:00', '-05:00')) = ?
       ORDER BY p.created_at DESC`,
      [tenantId, cashierId, colombiaDate]
    ) as any;
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error al obtener historial de pagos' });
  }
});

// ── PUBLIC MENU SETTINGS ──────────────────────────────────────────────────────
router.get('/settings/public-menu', authorize(...ADMIN_ROLES), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    const [rows] = await pool.query(
      'SELECT public_menu_enabled, slug FROM tenants WHERE id = ? LIMIT 1',
      [tenantId]
    ) as any;
    if (!rows?.length) { res.status(404).json({ success: false, error: 'Tenant no encontrado' }); return; }
    res.json({ success: true, data: { enabled: !!rows[0].public_menu_enabled, slug: rows[0].slug } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error al obtener configuración' });
  }
});

router.patch('/settings/public-menu', authorize(...ADMIN_ROLES), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') { res.status(400).json({ success: false, error: 'enabled debe ser boolean' }); return; }
    await pool.query(
      'UPDATE tenants SET public_menu_enabled = ? WHERE id = ?',
      [enabled ? 1 : 0, tenantId]
    );
    const [rows] = await pool.query('SELECT slug FROM tenants WHERE id = ? LIMIT 1', [tenantId]) as any;
    res.json({ success: true, data: { enabled, slug: rows[0]?.slug } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error al actualizar configuración' });
  }
});

export default router;
