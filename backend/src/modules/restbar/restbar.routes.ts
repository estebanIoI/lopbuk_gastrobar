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
              p.image_url AS imageUrl, ms.preparation_area AS preparationArea,
              ms.prep_time_minutes AS prepTimeMinutes
       FROM products p
       INNER JOIN rb_menu_settings ms ON ms.product_id = p.id AND ms.tenant_id = p.tenant_id
       WHERE p.tenant_id = ? AND ms.is_menu_item = 1 AND ms.available_in_menu = 1
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

router.get('/reports/payments', authorize(...CASHIER_ROLES), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const [rows] = await pool.query(
      `SELECT
         p.id, p.payment_method, p.amount, p.amount_paid, p.change_amount,
         p.cashier_name, p.guest_number, p.created_at,
         o.order_number, o.total AS order_total,
         t.number AS table_number,
         COALESCE(
           (SELECT GROUP_CONCAT(CONCAT(oi.quantity,'x ',oi.menu_item_name) SEPARATOR ', ')
            FROM rb_order_items oi
            WHERE oi.order_id = o.id
              AND (p.guest_number IS NULL OR oi.guest_number = p.guest_number)
              AND oi.status != 'cancelado'
           ), ''
         ) AS items_summary
       FROM rb_payments p
       JOIN rb_orders o ON o.id = p.order_id
       LEFT JOIN rb_tables t ON t.id = o.table_id
       WHERE p.tenant_id = ? AND DATE(p.created_at) = ?
       ORDER BY p.created_at DESC`,
      [tenantId, date]
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
