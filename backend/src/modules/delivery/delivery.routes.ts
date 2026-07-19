import { Router, Response, NextFunction } from 'express';
import { body, param } from 'express-validator';
import { authenticate, authorize, AuthRequest } from '../../common/middleware';
import { validateRequest } from '../../utils/validators';
import pool from '../../config/database';
import { decryptNullable } from '../../utils/crypto';

const router: ReturnType<typeof Router> = Router();

router.use(authenticate);

/**
 * Alcance de comercios de un repartidor para filtrar pedidos.
 * - Repartidor de UN comercio (tenantId presente): solo ese comercio (como siempre).
 * - Repartidor de plataforma (tenantId NULL): solo los comercios que el superadmin le
 *   asignó en `courier_tenants`. Sin asignaciones → el IN (…) no matchea nada → no ve
 *   nada. Esto evita que un repartidor sin comercio vea pedidos de TODOS los tenants.
 */
function courierTenantScope(alias: string, tenantId: string | null | undefined, driverId: string): { clause: string; params: any[] } {
  const col = alias ? `${alias}.tenant_id` : 'tenant_id';
  if (tenantId) return { clause: `AND ${col} = ?`, params: [tenantId] };
  return {
    clause: `AND ${col} IN (SELECT ct.tenant_id FROM courier_tenants ct WHERE ct.courier_user_id = ?)`,
    params: [driverId],
  };
}

// =============================================
// REPARTIDOR endpoints
// =============================================

// GET /api/delivery/my-orders — Pedidos asignados al repartidor
router.get(
  '/my-orders',
  authorize('repartidor'),
  async (req: AuthRequest, res: Response) => {
    try {
      const driverId = req.user!.userId;
      const tenantId = req.user!.tenantId;

      const sql = `
        SELECT o.id, o.order_number as orderNumber, o.customer_name as customerName,
               o.customer_phone as customerPhone, o.department, o.municipality,
               o.address, o.neighborhood, o.delivery_latitude as deliveryLatitude,
               o.delivery_longitude as deliveryLongitude, o.delivery_status as deliveryStatus,
               o.total, o.status, o.notes, o.created_at as createdAt,
               t.name as storeName,
               o.vehicle_id as vehicleId, o.dispatch_status as dispatchStatus,
               o.total_weight_kg as totalWeightKg,
               fv.name as vehicleName, fv.plate as vehiclePlate, fv.type as vehicleType
        FROM storefront_orders o
        LEFT JOIN tenants t ON t.id = o.tenant_id
        LEFT JOIN fleet_vehicles fv ON fv.id = o.vehicle_id
        WHERE o.delivery_driver_id = ?
          ${courierTenantScope('o', tenantId, driverId).clause}
          AND o.status NOT IN ('cancelado')
          AND o.delivery_status != 'entregado'
        ORDER BY o.created_at DESC`;

      const params: any[] = [driverId, ...courierTenantScope('o', tenantId, driverId).params];

      const [orders] = await pool.query(sql, params) as any;

      for (const order of orders) {
        const [items] = await pool.query(
          `SELECT product_name as productName, quantity, unit_price as unitPrice
           FROM storefront_order_items WHERE order_id = ?`,
          [order.id]
        ) as any;
        order.items = items;
      }

      res.json({ success: true, data: orders });
    } catch (error) {
      console.error('Get driver orders error:', error);
      res.status(500).json({ success: false, error: 'Error al obtener pedidos' });
    }
  }
);

// GET /api/delivery/my-history — Pedidos entregados por el repartidor
router.get(
  '/my-rating',
  authorize('repartidor'),
  async (req: AuthRequest, res: Response) => {
    try {
      // Promedio construido con datos reales: una calificación por pedido
      // entregado (uk_courier_rating_order). Nada simulado.
      const [[agg]] = await pool.query(
        `SELECT ROUND(AVG(stars), 2) AS avgStars, COUNT(stars) AS ratings,
                SUM(reported = 1) AS reports
           FROM courier_ratings WHERE courier_user_id = ?`,
        [req.user!.userId]
      ) as any;
      const [recent] = await pool.query(
        `SELECT stars, comment, created_at AS createdAt
           FROM courier_ratings
          WHERE courier_user_id = ? AND stars IS NOT NULL AND comment IS NOT NULL
          ORDER BY created_at DESC LIMIT 5`,
        [req.user!.userId]
      ) as any;
      res.json({
        success: true,
        data: {
          average: agg?.avgStars != null ? Number(agg.avgStars) : null,
          ratings: Number(agg?.ratings || 0),
          reports: Number(agg?.reports || 0),
          recent,
        },
      });
    } catch (error) {
      console.error('My rating error:', error);
      res.status(500).json({ success: false, error: 'Error al obtener tu calificación' });
    }
  }
);

router.get(
  '/my-history',
  authorize('repartidor'),
  async (req: AuthRequest, res: Response) => {
    try {
      const driverId = req.user!.userId;
      const tenantId = req.user!.tenantId;

      const sql = `
        SELECT o.id, o.order_number as orderNumber, o.customer_name as customerName,
               o.delivery_status as deliveryStatus, o.total,
               o.delivery_delivered_at as deliveredAt, o.created_at as createdAt,
               t.name as storeName
        FROM storefront_orders o
        LEFT JOIN tenants t ON t.id = o.tenant_id
        WHERE o.delivery_driver_id = ?
          ${courierTenantScope('o', tenantId, driverId).clause}
          AND o.delivery_status = 'entregado'
        ORDER BY o.delivery_delivered_at DESC
        LIMIT 50`;

      const params: any[] = [driverId, ...courierTenantScope('o', tenantId, driverId).params];

      const [orders] = await pool.query(sql, params) as any;

      res.json({ success: true, data: orders });
    } catch (error) {
      console.error('Get driver history error:', error);
      res.status(500).json({ success: false, error: 'Error al obtener historial' });
    }
  }
);

// GET /api/delivery/available — Pedidos disponibles para tomar
router.get(
  '/available',
  authorize('repartidor'),
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const driverId = req.user!.userId;
      const scope = courierTenantScope('o', tenantId, driverId);

      const sql = `
        SELECT o.id, o.order_number as orderNumber, o.customer_name as customerName,
               o.customer_phone as customerPhone, o.department, o.municipality,
               o.address, o.neighborhood, o.delivery_latitude as deliveryLatitude,
               o.delivery_longitude as deliveryLongitude, o.total, o.notes,
               o.created_at as createdAt,
               t.name as storeName,
               o.vehicle_id as vehicleId, o.dispatch_status as dispatchStatus,
               o.total_weight_kg as totalWeightKg,
               fv.name as vehicleName, fv.plate as vehiclePlate, fv.type as vehicleType
        FROM storefront_orders o
        LEFT JOIN tenants t ON t.id = o.tenant_id
        LEFT JOIN fleet_vehicles fv ON fv.id = o.vehicle_id
        WHERE o.delivery_driver_id IS NULL
          ${scope.clause}
          AND o.delivery_status = 'sin_asignar'
          AND o.status IN ('pendiente', 'confirmado', 'preparando', 'enviado')
          -- F3: NULL = tienda fuera del modo plataforma → se lista como siempre.
          -- 0 = el cliente eligió recoger / domicilio propio → no se difunde.
          AND (o.courier_requested IS NULL OR o.courier_requested = 1)
        ORDER BY o.created_at ASC`;

      const params: any[] = [...scope.params];

      const [orders] = await pool.query(sql, params) as any;

      for (const order of orders) {
        const [items] = await pool.query(
          `SELECT product_name as productName, quantity, unit_price as unitPrice
           FROM storefront_order_items WHERE order_id = ?`,
          [order.id]
        ) as any;
        order.items = items;
      }

      res.json({ success: true, data: orders });
    } catch (error) {
      console.error('Get available orders error:', error);
      res.status(500).json({ success: false, error: 'Error al obtener pedidos disponibles' });
    }
  }
);

// PUT /api/delivery/accept/:orderId — Repartidor toma un pedido
router.put(
  '/accept/:orderId',
  authorize('repartidor'),
  [param('orderId').notEmpty(), validateRequest],
  async (req: AuthRequest, res: Response) => {
    try {
      const driverId = req.user!.userId;
      const tenantId = req.user!.tenantId;
      const { orderId } = req.params;

      const scope = courierTenantScope('', tenantId, driverId);
      // Asignación atómica: con difusión, varios repartidores compiten por el
      // mismo pedido. El UPDATE lleva las condiciones en el WHERE, así que solo
      // uno puede afectar la fila; los demás obtienen affectedRows = 0.
      const [upd] = await pool.query(
        `UPDATE storefront_orders
         SET delivery_driver_id = ?, delivery_status = 'asignado', delivery_assigned_at = NOW()
         WHERE id = ?
           ${scope.clause}
           AND delivery_driver_id IS NULL
           AND delivery_status = 'sin_asignar'`,
        [driverId, orderId, ...scope.params]
      ) as any;

      if (!upd || upd.affectedRows === 0) {
        res.status(400).json({ success: false, error: 'El pedido ya fue tomado o no está disponible' });
        return;
      }

      // Avisar al cliente que su pedido dejó de estar "buscando repartidor".
      try {
        const [rows] = await pool.query(
          `SELECT o.tenant_id AS tenantId, o.tracking_token AS trackingToken,
                  u.name AS courierName, u.phone AS courierPhone
             FROM storefront_orders o
             LEFT JOIN users u ON u.id = o.delivery_driver_id
            WHERE o.id = ? LIMIT 1`,
          [orderId]
        ) as any;
        const row = rows?.[0];
        const io = (global as any).__deliveryIO;
        if (row && io) {
          if (row.trackingToken) {
            io.to(`tracking:${row.trackingToken}`).emit('delivery-courier-assigned', {
              orderId, courierName: row.courierName || 'Repartidor',
              // users.phone está cifrado en la BD
              courierPhone: decryptNullable(row.courierPhone), deliveryStatus: 'asignado',
            });
          }
          // Los demás repartidores quitan el pedido de su lista sin refrescar.
          io.to(`ops:${row.tenantId}`).emit('delivery-order-taken', { orderId, courierId: driverId });
        }
      } catch (_) { /* el aviso en vivo no puede tumbar la aceptación */ }

      res.json({ success: true, message: 'Pedido aceptado exitosamente' });
    } catch (error) {
      console.error('Accept order error:', error);
      res.status(500).json({ success: false, error: 'Error al aceptar pedido' });
    }
  }
);

// PUT /api/delivery/status/:orderId — Cambiar estado de entrega
router.put(
  '/status/:orderId',
  authorize('repartidor'),
  [
    param('orderId').notEmpty(),
    body('deliveryStatus').isIn(['recogido', 'en_camino', 'entregado']).withMessage('Estado de entrega inválido'),
    body('podPhotoUrl').optional({ nullable: true }).isString().isLength({ max: 500 }),
    body('podReceivedBy').optional({ nullable: true }).isString().isLength({ max: 120 }),
    body('clientActionId').optional({ nullable: true }).isString().isLength({ max: 64 }),
    validateRequest,
  ],
  async (req: AuthRequest, res: Response) => {
    const tenantId = req.user!.tenantId!;
    const cid: string | undefined = req.body.clientActionId || undefined;
    try {
      const driverId = req.user!.userId;
      const { orderId } = req.params;
      const { deliveryStatus } = req.body;

      // Idempotencia (offline): reclamar la llave ANTES de aplicar. Duplicado → no re-aplica.
      if (cid) {
        try {
          await pool.query(
            'INSERT INTO idempotency_keys (id, tenant_id, action, user_id) VALUES (?, ?, ?, ?)',
            [cid, tenantId, `delivery:${deliveryStatus}`, driverId]
          );
        } catch (e: any) {
          if (e?.code === 'ER_DUP_ENTRY') { res.json({ success: true, message: 'Acción ya registrada', data: { duplicate: true } }); return; }
          throw e;
        }
      }

      const [orderRows] = await pool.query(
        `SELECT id, status FROM storefront_orders WHERE id = ? AND delivery_driver_id = ?`,
        [orderId, driverId]
      ) as any;

      if (orderRows.length === 0) {
        res.status(404).json({ success: false, error: 'Pedido no encontrado o no asignado a ti' });
        return;
      }

      const updates: string[] = ['delivery_status = ?'];
      const values: any[] = [deliveryStatus];

      if (deliveryStatus === 'recogido') {
        updates.push('delivery_picked_at = NOW()');
      } else if (deliveryStatus === 'entregado') {
        updates.push('delivery_delivered_at = NOW()');
        updates.push('status = \'entregado\'');
        updates.push('dispatch_status = \'entregado\'');
        // Prueba de entrega (F5): foto + quién recibió
        if (req.body.podPhotoUrl) { updates.push('pod_photo_url = ?'); values.push(req.body.podPhotoUrl); }
        if (req.body.podReceivedBy) { updates.push('pod_received_by = ?'); values.push(req.body.podReceivedBy); }
      }

      values.push(orderId);

      await pool.query(
        `UPDATE storefront_orders SET ${updates.join(', ')} WHERE id = ?`,
        values
      );

      // Si el pedido pertenece a una ruta agrupada y era la última parada,
      // cerrar la ruta y liberar el vehículo automáticamente.
      if (deliveryStatus === 'entregado') {
        // F4: el chat vive lo que vive el pedido → al entregar se cierra.
        // El POST de mensajes responde 409 y la UI del cliente pasa a solo lectura.
        try {
          await pool.query(
            `UPDATE delivery_chat_rooms SET status = 'closed', closed_at = NOW()
              WHERE order_id = ? AND status <> 'closed'`,
            [orderId]
          );
          const io = (global as any).__deliveryIO;
          const [[rm]] = await pool.query(
            'SELECT id FROM delivery_chat_rooms WHERE order_id = ? LIMIT 1', [orderId]
          ) as any;
          if (io && rm?.id) io.to(`delivery-chat:${rm.id}`).emit('delivery-chat-closed', { orderId, roomId: rm.id });
        } catch { /* el cierre del chat no puede tumbar la entrega */ }
        try {
          // Línea de tiempo (F4): etapa entregado también por el flujo delivery
          const { logStage } = await import('../ops-timeline/ops-timeline.service');
          const [tRow] = await pool.query('SELECT tenant_id FROM storefront_orders WHERE id = ?', [orderId]) as any;
          if (tRow?.[0]?.tenant_id) logStage(tRow[0].tenant_id, orderId, 'entregado', driverId).catch(() => {});
        } catch { /* best-effort */ }
        try {
          const [routeRow] = await pool.query(
            'SELECT route_id, tenant_id FROM storefront_orders WHERE id = ?', [orderId]
          ) as any;
          const routeId = routeRow?.[0]?.route_id;
          const tenantId = routeRow?.[0]?.tenant_id;
          if (routeId) {
            const [pending] = await pool.query(
              `SELECT COUNT(*) AS cnt FROM storefront_orders WHERE route_id = ? AND dispatch_status != 'entregado'`,
              [routeId]
            ) as any;
            if (Number(pending[0].cnt) === 0) {
              await pool.query(
                `UPDATE dispatch_routes SET status = 'cerrada', closed_at = NOW() WHERE id = ?`, [routeId]
              );
              await pool.query(
                `UPDATE fleet_vehicles fv JOIN dispatch_routes r ON r.vehicle_id = fv.id
                    SET fv.status = 'disponible' WHERE r.id = ?`, [routeId]
              );
            }
            const { emitOps } = await import('../fleet/logistics.routes');
            emitOps(tenantId, 'dispatch-changed', { kind: 'stop-delivered', routeId, orderId });
          }
        } catch (e: any) {
          console.error('Route auto-close failed:', e?.message || e);
        }
      }

      res.json({ success: true, message: `Estado actualizado a: ${deliveryStatus}` });
    } catch (error) {
      // Liberar la llave de idempotencia para permitir un reintento legítimo
      if (cid) await pool.query('DELETE FROM idempotency_keys WHERE id = ?', [cid]).catch(() => {});
      console.error('Update delivery status error:', error);
      res.status(500).json({ success: false, error: 'Error al actualizar estado' });
    }
  }
);

// =============================================
// COMERCIANTE / SUPERADMIN endpoints
// =============================================

// GET /api/delivery/drivers — Listar repartidores del tenant
router.get(
  '/drivers',
  authorize('comerciante', 'superadmin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;

      const [drivers] = await pool.query(
        `SELECT id, name, email, phone, is_active as isActive
         FROM users
         WHERE ${tenantId ? 'tenant_id = ? AND' : 'tenant_id IS NULL AND'}
               role = 'repartidor'
         ORDER BY name`,
        tenantId ? [tenantId] : []
      ) as any;

      res.json({ success: true, data: drivers });
    } catch (error) {
      console.error('Get drivers error:', error);
      res.status(500).json({ success: false, error: 'Error al obtener repartidores' });
    }
  }
);

// =============================================
// PUT /api/delivery/availability — Toggle online/offline
// =============================================
router.put(
  '/availability',
  authorize('repartidor'),
  [
    body('isOnline').isBoolean().withMessage('isOnline debe ser boolean'),
    validateRequest,
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId!;
      const tenantId = req.user!.tenantId || '';
      const { isOnline, lat, lng } = req.body;

      await pool.query(
        `INSERT INTO courier_availability (user_id, tenant_id, is_online, current_lat, current_lng, last_seen_at)
         VALUES (?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE is_online = ?, current_lat = ?, current_lng = ?, last_seen_at = NOW()`,
        [
          userId, tenantId, isOnline ? 1 : 0, lat || null, lng || null,
          isOnline ? 1 : 0, lat || null, lng || null,
        ]
      );

      res.json({ success: true, data: { isOnline } });
    } catch (error) {
      console.error('Availability toggle error:', error);
      res.status(500).json({ success: false, error: 'Error al actualizar disponibilidad' });
    }
  }
);

// =============================================
// PUT /api/delivery/location — Actualizar posición GPS del repartidor
// =============================================
router.put(
  '/location',
  authorize('repartidor'),
  [
    body('lat').isFloat({ min: -90, max: 90 }),
    body('lng').isFloat({ min: -180, max: 180 }),
    validateRequest,
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId!;
      const tenantId = req.user!.tenantId || '';
      const { lat, lng } = req.body;

      await pool.query(
        `INSERT INTO courier_availability (user_id, tenant_id, is_online, current_lat, current_lng, last_seen_at)
         VALUES (?, ?, 1, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE current_lat = ?, current_lng = ?, last_seen_at = NOW(), is_online = 1`,
        [userId, tenantId, lat, lng, lat, lng]
      );

      // Emitir posición en tiempo real a los que están en el ops center
      const io = (global as any).__deliveryIO;
      if (io) {
        io.to(`ops:${tenantId}`).emit('courier-location', { courierId: userId, lat, lng });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Location update error:', error);
      res.status(500).json({ success: false, error: 'Error al actualizar posición' });
    }
  }
);

// =============================================
// GET /api/delivery/ops-stats — Stats para el centro de operaciones
// =============================================
router.get(
  '/ops-stats',
  authorize('comerciante', 'superadmin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const params = [tenantId];

      const q = async (sql: string, p: any[] = params) => {
        try {
          const [r] = await pool.query(sql, p) as any;
          return r as any[];
        } catch { return []; }
      };

      const [onlineCouriers] = await q(
        'SELECT COUNT(*) n FROM courier_availability WHERE tenant_id = ? AND is_online = 1 AND last_seen_at > DATE_SUB(NOW(), INTERVAL 10 MINUTE)'
      );
      const [activeOrders] = await q(
        "SELECT COUNT(*) n FROM storefront_orders WHERE tenant_id = ? AND delivery_status IN ('asignado','recogido','en_camino')"
      );
      const [pendingOrders] = await q(
        "SELECT COUNT(*) n FROM storefront_orders WHERE tenant_id = ? AND delivery_status = 'sin_asignar' AND status IN ('pendiente','confirmado','preparando')"
      );
      const [deliveredToday] = await q(
        "SELECT COUNT(*) n FROM storefront_orders WHERE tenant_id = ? AND delivery_status = 'entregado' AND DATE(delivery_delivered_at) = CURDATE()"
      );
      const [avgMinutes] = await q(
        "SELECT ROUND(AVG(TIMESTAMPDIFF(MINUTE, delivery_assigned_at, delivery_delivered_at))) avg FROM storefront_orders WHERE tenant_id = ? AND delivery_status = 'entregado' AND delivery_delivered_at IS NOT NULL AND delivery_assigned_at IS NOT NULL AND DATE(delivery_delivered_at) = CURDATE()"
      );

      res.json({
        success: true,
        data: {
          onlineCouriers: Number(onlineCouriers?.n || 0),
          activeOrders: Number(activeOrders?.n || 0),
          pendingOrders: Number(pendingOrders?.n || 0),
          deliveredToday: Number(deliveredToday?.n || 0),
          avgDeliveryMinutes: Number(avgMinutes?.avg || 0) || null,
        },
      });
    } catch (error) {
      console.error('Ops stats error:', error);
      res.status(500).json({ success: false, error: 'Error al obtener estadísticas' });
    }
  }
);

// =============================================
// GET /api/delivery/active-couriers — Repartidores online con posición
// =============================================
router.get(
  '/active-couriers',
  authorize('comerciante', 'superadmin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;

      const [couriers] = await pool.query(
        `SELECT ca.user_id as id, u.name, u.phone,
                ca.is_online as isOnline, ca.current_lat as lat, ca.current_lng as lng,
                ca.last_seen_at as lastSeenAt,
                (SELECT delivery_status FROM storefront_orders
                 WHERE delivery_driver_id = ca.user_id
                   AND delivery_status NOT IN ('entregado','sin_asignar')
                 ORDER BY created_at DESC LIMIT 1) as currentOrderStatus,
                (SELECT order_number FROM storefront_orders
                 WHERE delivery_driver_id = ca.user_id
                   AND delivery_status NOT IN ('entregado','sin_asignar')
                 ORDER BY created_at DESC LIMIT 1) as currentOrderNumber
         FROM courier_availability ca
         JOIN users u ON u.id = ca.user_id
         WHERE ca.tenant_id = ?
           AND ca.is_online = 1
           AND ca.last_seen_at > DATE_SUB(NOW(), INTERVAL 10 MINUTE)
         ORDER BY u.name`,
        [tenantId]
      ) as any;

      res.json({ success: true, data: couriers });
    } catch (error) {
      console.error('Active couriers error:', error);
      res.status(500).json({ success: false, error: 'Error al obtener repartidores activos' });
    }
  }
);

// =============================================
// GET /api/delivery/active-orders-map — Pedidos activos con coordenadas
// =============================================
router.get(
  '/active-orders-map',
  authorize('comerciante', 'superadmin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;

      const [orders] = await pool.query(
        `SELECT o.id, o.order_number as orderNumber, o.customer_name as customerName,
                o.delivery_latitude as lat, o.delivery_longitude as lng,
                o.delivery_status as deliveryStatus, o.address, o.municipality,
                o.total, o.created_at as createdAt,
                u.name as driverName, u.phone as driverPhone
         FROM storefront_orders o
         LEFT JOIN users u ON u.id = o.delivery_driver_id
         WHERE o.tenant_id = ?
           AND o.delivery_status IN ('sin_asignar','asignado','recogido','en_camino')
           AND o.delivery_latitude IS NOT NULL
           AND o.delivery_longitude IS NOT NULL
         ORDER BY o.created_at DESC`,
        [tenantId]
      ) as any;

      res.json({ success: true, data: orders });
    } catch (error) {
      console.error('Active orders map error:', error);
      res.status(500).json({ success: false, error: 'Error al obtener pedidos activos' });
    }
  }
);

// PUT /api/delivery/assign/:orderId — Asignar repartidor a pedido
router.put(
  '/assign/:orderId',
  authorize('comerciante', 'superadmin'),
  [
    param('orderId').notEmpty(),
    body('driverId').notEmpty().withMessage('ID del repartidor es requerido'),
    validateRequest,
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const { orderId } = req.params;
      const { driverId } = req.body;

      // Verify driver exists (tenant or global)
      const [driverRows] = await pool.query(
        `SELECT id FROM users
         WHERE id = ? AND role = 'repartidor' AND is_active = TRUE
           AND (tenant_id = ? OR tenant_id IS NULL)`,
        [driverId, tenantId || '']
      ) as any;

      if (driverRows.length === 0) {
        res.status(404).json({ success: false, error: 'Repartidor no encontrado' });
        return;
      }

      const checkSql = `SELECT id FROM storefront_orders WHERE id = ? ${tenantId ? 'AND tenant_id = ?' : ''}`;
      const checkParams = tenantId ? [orderId, tenantId] : [orderId];
      const [orderRows] = await pool.query(checkSql, checkParams) as any;

      if (orderRows.length === 0) {
        res.status(404).json({ success: false, error: 'Pedido no encontrado' });
        return;
      }

      await pool.query(
        `UPDATE storefront_orders
         SET delivery_driver_id = ?, delivery_status = 'asignado', delivery_assigned_at = NOW()
         WHERE id = ?`,
        [driverId, orderId]
      );

      res.json({ success: true, message: 'Repartidor asignado exitosamente' });
    } catch (error) {
      console.error('Assign driver error:', error);
      res.status(500).json({ success: false, error: 'Error al asignar repartidor' });
    }
  }
);

export default router;
