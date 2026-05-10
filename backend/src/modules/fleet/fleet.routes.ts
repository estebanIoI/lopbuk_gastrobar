import { Router, Response, NextFunction } from 'express';
import { body, param, query } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, authorize, AuthRequest } from '../../common/middleware';
import { validateRequest } from '../../utils/validators';
import pool from '../../config/database';

const router: ReturnType<typeof Router> = Router();

router.use(authenticate);

// ─── Utilidad: convertir peso a kg ───────────────────────────────────────────
function toKg(weight: number, unit: string | null | undefined): number {
  switch (unit) {
    case 'ton': return weight * 1000;
    case 'lb':  return weight * 0.453592;
    case 'g':   return weight / 1000;
    default:    return weight; // kg o sin unidad
  }
}

// ─── Utilidad: asignar vehículo por peso ─────────────────────────────────────
async function autoAssignVehicle(tenantId: string, weightKg: number): Promise<string | null> {
  // Busca el vehículo disponible más pequeño que pueda con el peso
  const [rows] = await pool.query(
    `SELECT id FROM fleet_vehicles
     WHERE tenant_id = ? AND status = 'disponible' AND max_weight_kg >= ?
     ORDER BY max_weight_kg ASC
     LIMIT 1`,
    [tenantId, weightKg]
  ) as any;
  return rows.length > 0 ? rows[0].id : null;
}

// ─── Utilidad: calcular peso total de items de una orden ─────────────────────
async function calcOrderWeight(items: Array<{ productId: string; quantity: number }>): Promise<number> {
  let total = 0;
  for (const item of items) {
    if (!item.productId) continue;
    const [rows] = await pool.query(
      'SELECT weight, hardware_weight_unit FROM products WHERE id = ?',
      [item.productId]
    ) as any;
    if (rows.length > 0 && rows[0].weight) {
      total += toKg(Number(rows[0].weight), rows[0].hardware_weight_unit) * item.quantity;
    }
  }
  return Math.round(total * 1000) / 1000;
}

// =============================================
// VEHÍCULOS — CRUD
// =============================================

// GET /api/fleet/vehicles — Listar vehículos del tenant
router.get(
  '/vehicles',
  authorize('comerciante', 'superadmin', 'despachador'),
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const status = req.query.status as string | undefined;

      let sql = `SELECT id, name, plate, type, max_weight_kg as maxWeightKg,
                        status, year, brand, model, notes, created_at as createdAt
                 FROM fleet_vehicles
                 WHERE tenant_id = ?`;
      const params: any[] = [tenantId];

      if (status) {
        sql += ' AND status = ?';
        params.push(status);
      }
      sql += ' ORDER BY type ASC, name ASC';

      const [vehicles] = await pool.query(sql, params) as any;
      res.json({ success: true, data: vehicles });
    } catch (error) {
      console.error('Get vehicles error:', error);
      res.status(500).json({ success: false, error: 'Error al obtener vehículos' });
    }
  }
);

// GET /api/fleet/vehicles/:id — Detalle de vehículo con métricas
router.get(
  '/vehicles/:id',
  authorize('comerciante', 'superadmin', 'despachador'),
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const { id } = req.params;

      const [rows] = await pool.query(
        `SELECT id, name, plate, type, max_weight_kg as maxWeightKg, status,
                year, brand, model, notes, created_at as createdAt
         FROM fleet_vehicles WHERE id = ? AND tenant_id = ?`,
        [id, tenantId]
      ) as any;

      if (rows.length === 0) {
        res.status(404).json({ success: false, error: 'Vehículo no encontrado' });
        return;
      }

      // Métricas del vehículo (pedidos hoy y totales)
      const [metrics] = await pool.query(
        `SELECT
           COUNT(*) as totalOrders,
           SUM(CASE WHEN DATE(dispatched_at) = CURDATE() THEN 1 ELSE 0 END) as ordersToday,
           SUM(COALESCE(total_weight_kg, 0)) as totalWeightKg,
           SUM(CASE WHEN DATE(dispatched_at) = CURDATE() THEN COALESCE(total_weight_kg, 0) ELSE 0 END) as weightToday
         FROM storefront_orders
         WHERE vehicle_id = ? AND dispatch_status = 'entregado'`,
        [id]
      ) as any;

      // Mantenimientos próximos
      const [upcoming] = await pool.query(
        `SELECT id, type, description, scheduled_date as scheduledDate, status
         FROM fleet_maintenance
         WHERE vehicle_id = ? AND status IN ('pendiente','en_proceso')
         ORDER BY scheduled_date ASC LIMIT 3`,
        [id]
      ) as any;

      res.json({
        success: true,
        data: { ...rows[0], metrics: metrics[0], upcomingMaintenance: upcoming }
      });
    } catch (error) {
      console.error('Get vehicle detail error:', error);
      res.status(500).json({ success: false, error: 'Error al obtener vehículo' });
    }
  }
);

// POST /api/fleet/vehicles — Crear vehículo
router.post(
  '/vehicles',
  authorize('comerciante', 'superadmin'),
  [
    body('name').notEmpty().withMessage('Nombre del vehículo requerido'),
    body('type').isIn(['planta', 'ligera', 'moto']).withMessage('Tipo inválido'),
    body('maxWeightKg').isFloat({ min: 0.1 }).withMessage('Capacidad de carga requerida'),
    body('plate').optional().notEmpty(),
    body('year').optional().isInt({ min: 1990, max: 2100 }),
    body('brand').optional().notEmpty(),
    body('model').optional().notEmpty(),
    body('notes').optional(),
    validateRequest,
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const { name, plate, type, maxWeightKg, year, brand, model, notes } = req.body;
      const id = uuidv4();

      await pool.query(
        `INSERT INTO fleet_vehicles (id, tenant_id, name, plate, type, max_weight_kg, year, brand, model, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, tenantId, name, plate || null, type, maxWeightKg, year || null, brand || null, model || null, notes || null]
      );

      res.status(201).json({ success: true, data: { id }, message: 'Vehículo creado exitosamente' });
    } catch (error) {
      console.error('Create vehicle error:', error);
      res.status(500).json({ success: false, error: 'Error al crear vehículo' });
    }
  }
);

// PUT /api/fleet/vehicles/:id — Actualizar vehículo
router.put(
  '/vehicles/:id',
  authorize('comerciante', 'superadmin'),
  [
    param('id').notEmpty(),
    body('name').optional().notEmpty(),
    body('type').optional().isIn(['planta', 'ligera', 'moto']),
    body('maxWeightKg').optional().isFloat({ min: 0.1 }),
    body('status').optional().isIn(['disponible', 'en_ruta', 'mantenimiento', 'inactivo']),
    body('plate').optional(),
    body('year').optional().isInt({ min: 1990, max: 2100 }),
    body('brand').optional(),
    body('model').optional(),
    body('notes').optional(),
    validateRequest,
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const { id } = req.params;
      const { name, plate, type, maxWeightKg, status, year, brand, model, notes } = req.body;

      const [existing] = await pool.query(
        'SELECT id FROM fleet_vehicles WHERE id = ? AND tenant_id = ?',
        [id, tenantId]
      ) as any;

      if ((existing as any[]).length === 0) {
        res.status(404).json({ success: false, error: 'Vehículo no encontrado' });
        return;
      }

      const fields: string[] = [];
      const values: any[] = [];

      if (name !== undefined)       { fields.push('name = ?');           values.push(name); }
      if (plate !== undefined)      { fields.push('plate = ?');          values.push(plate || null); }
      if (type !== undefined)       { fields.push('type = ?');           values.push(type); }
      if (maxWeightKg !== undefined){ fields.push('max_weight_kg = ?');  values.push(maxWeightKg); }
      if (status !== undefined)     { fields.push('status = ?');         values.push(status); }
      if (year !== undefined)       { fields.push('year = ?');           values.push(year || null); }
      if (brand !== undefined)      { fields.push('brand = ?');          values.push(brand || null); }
      if (model !== undefined)      { fields.push('model = ?');          values.push(model || null); }
      if (notes !== undefined)      { fields.push('notes = ?');          values.push(notes || null); }

      if (fields.length === 0) {
        res.status(400).json({ success: false, error: 'No hay campos para actualizar' });
        return;
      }

      values.push(id);
      await pool.query(`UPDATE fleet_vehicles SET ${fields.join(', ')} WHERE id = ?`, values);

      res.json({ success: true, message: 'Vehículo actualizado' });
    } catch (error) {
      console.error('Update vehicle error:', error);
      res.status(500).json({ success: false, error: 'Error al actualizar vehículo' });
    }
  }
);

// DELETE /api/fleet/vehicles/:id — Eliminar vehículo (solo si no tiene pedidos activos)
router.delete(
  '/vehicles/:id',
  authorize('comerciante', 'superadmin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const { id } = req.params;

      const [active] = await pool.query(
        `SELECT COUNT(*) as cnt FROM storefront_orders
         WHERE vehicle_id = ? AND dispatch_status NOT IN ('entregado')
           AND status NOT IN ('cancelado')`,
        [id]
      ) as any;

      if (active[0].cnt > 0) {
        res.status(400).json({ success: false, error: 'No se puede eliminar: el vehículo tiene pedidos activos' });
        return;
      }

      await pool.query(
        'DELETE FROM fleet_vehicles WHERE id = ? AND tenant_id = ?',
        [id, tenantId]
      );

      res.json({ success: true, message: 'Vehículo eliminado' });
    } catch (error) {
      console.error('Delete vehicle error:', error);
      res.status(500).json({ success: false, error: 'Error al eliminar vehículo' });
    }
  }
);

// =============================================
// MANTENIMIENTOS
// =============================================

// GET /api/fleet/maintenance — Listar mantenimientos
router.get(
  '/maintenance',
  authorize('comerciante', 'superadmin', 'despachador'),
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const vehicleId = req.query.vehicleId as string | undefined;
      const status = req.query.status as string | undefined;

      let sql = `SELECT m.id, m.vehicle_id as vehicleId, v.name as vehicleName,
                        m.type, m.description, m.scheduled_date as scheduledDate,
                        m.completed_date as completedDate, m.cost, m.status, m.notes,
                        m.created_at as createdAt
                 FROM fleet_maintenance m
                 INNER JOIN fleet_vehicles v ON v.id = m.vehicle_id
                 WHERE m.tenant_id = ?`;
      const params: any[] = [tenantId];

      if (vehicleId) { sql += ' AND m.vehicle_id = ?'; params.push(vehicleId); }
      if (status)    { sql += ' AND m.status = ?';     params.push(status); }

      sql += ' ORDER BY m.scheduled_date ASC, m.created_at DESC';

      const [records] = await pool.query(sql, params) as any;
      res.json({ success: true, data: records });
    } catch (error) {
      console.error('Get maintenance error:', error);
      res.status(500).json({ success: false, error: 'Error al obtener mantenimientos' });
    }
  }
);

// POST /api/fleet/maintenance — Crear registro de mantenimiento
router.post(
  '/maintenance',
  authorize('comerciante', 'superadmin'),
  [
    body('vehicleId').notEmpty().withMessage('vehicleId requerido'),
    body('type').isIn(['preventivo', 'correctivo', 'revision']).withMessage('Tipo inválido'),
    body('description').notEmpty().withMessage('Descripción requerida'),
    body('scheduledDate').optional().isISO8601(),
    body('cost').optional().isFloat({ min: 0 }),
    body('notes').optional(),
    validateRequest,
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const userId = req.user!.userId;
      const { vehicleId, type, description, scheduledDate, cost, notes } = req.body;

      const [veh] = await pool.query(
        'SELECT id FROM fleet_vehicles WHERE id = ? AND tenant_id = ?',
        [vehicleId, tenantId]
      ) as any;

      if ((veh as any[]).length === 0) {
        res.status(404).json({ success: false, error: 'Vehículo no encontrado' });
        return;
      }

      const id = uuidv4();
      await pool.query(
        `INSERT INTO fleet_maintenance (id, tenant_id, vehicle_id, type, description, scheduled_date, cost, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, tenantId, vehicleId, type, description, scheduledDate || null, cost || 0, notes || null, userId]
      );

      res.status(201).json({ success: true, data: { id }, message: 'Mantenimiento registrado' });
    } catch (error) {
      console.error('Create maintenance error:', error);
      res.status(500).json({ success: false, error: 'Error al registrar mantenimiento' });
    }
  }
);

// PUT /api/fleet/maintenance/:id — Actualizar mantenimiento
router.put(
  '/maintenance/:id',
  authorize('comerciante', 'superadmin'),
  [
    param('id').notEmpty(),
    body('status').optional().isIn(['pendiente', 'en_proceso', 'completado', 'cancelado']),
    body('completedDate').optional().isISO8601(),
    body('cost').optional().isFloat({ min: 0 }),
    body('notes').optional(),
    validateRequest,
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const { id } = req.params;
      const { status, completedDate, cost, notes, description, scheduledDate, type } = req.body;

      const fields: string[] = [];
      const values: any[] = [];

      if (status !== undefined)        { fields.push('status = ?');          values.push(status); }
      if (completedDate !== undefined) { fields.push('completed_date = ?');  values.push(completedDate || null); }
      if (cost !== undefined)          { fields.push('cost = ?');            values.push(cost); }
      if (notes !== undefined)         { fields.push('notes = ?');           values.push(notes || null); }
      if (description !== undefined)   { fields.push('description = ?');     values.push(description); }
      if (scheduledDate !== undefined) { fields.push('scheduled_date = ?');  values.push(scheduledDate || null); }
      if (type !== undefined)          { fields.push('type = ?');            values.push(type); }

      if (fields.length === 0) {
        res.status(400).json({ success: false, error: 'No hay campos para actualizar' });
        return;
      }

      values.push(id, tenantId);
      await pool.query(
        `UPDATE fleet_maintenance SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`,
        values
      );

      res.json({ success: true, message: 'Mantenimiento actualizado' });
    } catch (error) {
      console.error('Update maintenance error:', error);
      res.status(500).json({ success: false, error: 'Error al actualizar mantenimiento' });
    }
  }
);

// =============================================
// MÉTRICAS DE FLOTA
// =============================================

// GET /api/fleet/metrics — Métricas de rendimiento de la flota
router.get(
  '/metrics',
  authorize('comerciante', 'superadmin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;

      // Métricas por vehículo
      const [vehicleMetrics] = await pool.query(
        `SELECT v.id, v.name, v.plate, v.type, v.status, v.max_weight_kg as maxWeightKg,
                COUNT(o.id) as totalOrders,
                SUM(CASE WHEN DATE(o.dispatched_at) = CURDATE() THEN 1 ELSE 0 END) as ordersToday,
                SUM(COALESCE(o.total_weight_kg, 0)) as totalWeightKg,
                SUM(CASE WHEN DATE(o.dispatched_at) = CURDATE() THEN COALESCE(o.total_weight_kg, 0) ELSE 0 END) as weightToday
         FROM fleet_vehicles v
         LEFT JOIN storefront_orders o ON o.vehicle_id = v.id AND o.dispatch_status = 'entregado'
         WHERE v.tenant_id = ?
         GROUP BY v.id
         ORDER BY v.type ASC, v.name ASC`,
        [tenantId]
      ) as any;

      // Resumen general del día
      const [dayStats] = await pool.query(
        `SELECT
           COUNT(*) as totalOrdersToday,
           SUM(CASE WHEN dispatch_status = 'entregado' THEN 1 ELSE 0 END) as deliveredToday,
           SUM(CASE WHEN dispatch_status = 'despachado' THEN 1 ELSE 0 END) as inRouteToday,
           SUM(CASE WHEN dispatch_status = 'pendiente' THEN 1 ELSE 0 END) as pendingToday,
           SUM(CASE WHEN vehicle_id IS NULL AND status NOT IN ('cancelado') THEN 1 ELSE 0 END) as unassigned
         FROM storefront_orders
         WHERE tenant_id = ? AND DATE(created_at) = CURDATE()`,
        [tenantId]
      ) as any;

      // Mantenimientos próximos (próximos 30 días)
      const [upcomingMaint] = await pool.query(
        `SELECT m.id, m.type, m.description, m.scheduled_date as scheduledDate,
                v.name as vehicleName, v.plate
         FROM fleet_maintenance m
         INNER JOIN fleet_vehicles v ON v.id = m.vehicle_id
         WHERE m.tenant_id = ? AND m.status IN ('pendiente','en_proceso')
           AND m.scheduled_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
         ORDER BY m.scheduled_date ASC`,
        [tenantId]
      ) as any;

      res.json({
        success: true,
        data: {
          vehicles: vehicleMetrics,
          dayStats: dayStats[0],
          upcomingMaintenance: upcomingMaint,
        }
      });
    } catch (error) {
      console.error('Fleet metrics error:', error);
      res.status(500).json({ success: false, error: 'Error al obtener métricas' });
    }
  }
);

// =============================================
// DESPACHO — Panel despachador
// =============================================

// GET /api/fleet/pending-dispatch — Pedidos pendientes de despacho
router.get(
  '/pending-dispatch',
  authorize('comerciante', 'superadmin', 'despachador'),
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const dispatchStatus = req.query.dispatchStatus as string | undefined;

      let where = 'WHERE o.tenant_id = ? AND o.status NOT IN (\'cancelado\')';
      const params: any[] = [tenantId];

      if (dispatchStatus) {
        where += ' AND o.dispatch_status = ?';
        params.push(dispatchStatus);
      } else {
        where += ' AND o.dispatch_status IN (\'pendiente\',\'en_pista\',\'cargado\',\'despachado\')';
      }

      const [orders] = await pool.query(
        `SELECT o.id, o.order_number as orderNumber, o.customer_name as customerName,
                o.customer_phone as customerPhone, o.address, o.municipality, o.neighborhood,
                o.total, o.total_weight_kg as totalWeightKg, o.dispatch_status as dispatchStatus,
                o.dispatch_notes as dispatchNotes, o.dispatched_at as dispatchedAt,
                o.status, o.created_at as createdAt, o.payment_method as paymentMethod,
                o.delivery_latitude as deliveryLatitude, o.delivery_longitude as deliveryLongitude,
                o.vehicle_id as vehicleId, v.name as vehicleName, v.plate as vehiclePlate,
                v.type as vehicleType, o.delivery_driver_id as driverId, u.name as driverName
         FROM storefront_orders o
         LEFT JOIN fleet_vehicles v ON v.id = o.vehicle_id
         LEFT JOIN users u ON u.id = o.delivery_driver_id
         ${where}
         ORDER BY o.created_at ASC`,
        params
      ) as any;

      // Items de cada pedido
      for (const order of orders) {
        const [items] = await pool.query(
          `SELECT oi.product_name as productName, oi.quantity, oi.unit_price as unitPrice,
                  oi.total_price as totalPrice
           FROM storefront_order_items oi WHERE oi.order_id = ?`,
          [order.id]
        ) as any;
        order.items = items;
      }

      res.json({ success: true, data: orders });
    } catch (error) {
      console.error('Get pending dispatch error:', error);
      res.status(500).json({ success: false, error: 'Error al obtener pedidos de despacho' });
    }
  }
);

// POST /api/fleet/assign-vehicle — Asignar vehículo a un pedido
router.post(
  '/assign-vehicle',
  authorize('comerciante', 'superadmin', 'despachador'),
  [
    body('orderId').notEmpty().withMessage('orderId requerido'),
    body('vehicleId').optional().notEmpty(),
    body('driverId').optional().notEmpty(),
    validateRequest,
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const { orderId, vehicleId, driverId } = req.body;

      // Verificar que la orden pertenece al tenant
      const [orderRows] = await pool.query(
        'SELECT id, total_weight_kg FROM storefront_orders WHERE id = ? AND tenant_id = ?',
        [orderId, tenantId]
      ) as any;

      if ((orderRows as any[]).length === 0) {
        res.status(404).json({ success: false, error: 'Pedido no encontrado' });
        return;
      }

      let resolvedVehicleId = vehicleId;

      // Auto-asignar si no se envía vehicleId
      if (!resolvedVehicleId) {
        if (!tenantId) { res.status(400).json({ success: false, error: 'tenantId requerido' }); return; }
        const weightKg = orderRows[0].total_weight_kg || 0;
        const autoVehicle = await autoAssignVehicle(tenantId, weightKg);
        if (!autoVehicle) {
          res.status(400).json({ success: false, error: 'No hay vehículos disponibles para el peso del pedido' });
          return;
        }
        resolvedVehicleId = autoVehicle;
      } else {
        // Verificar que el vehículo pertenece al tenant
        const [vehRows] = await pool.query(
          'SELECT id FROM fleet_vehicles WHERE id = ? AND tenant_id = ?',
          [resolvedVehicleId, tenantId]
        ) as any;
        if ((vehRows as any[]).length === 0) {
          res.status(404).json({ success: false, error: 'Vehículo no encontrado' });
          return;
        }
      }

      const updateFields: string[] = ['vehicle_id = ?'];
      const updateValues: any[] = [resolvedVehicleId];

      if (driverId !== undefined) {
        updateFields.push('delivery_driver_id = ?');
        updateValues.push(driverId || null);
        if (driverId) {
          updateFields.push('delivery_status = \'asignado\'');
          updateFields.push('delivery_assigned_at = NOW()');
        }
      }

      updateValues.push(orderId);
      await pool.query(
        `UPDATE storefront_orders SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );

      res.json({ success: true, vehicleId: resolvedVehicleId, message: 'Vehículo asignado' });
    } catch (error) {
      console.error('Assign vehicle error:', error);
      res.status(500).json({ success: false, error: 'Error al asignar vehículo' });
    }
  }
);

// PUT /api/fleet/dispatch-status/:orderId — Cambiar estado de despacho
router.put(
  '/dispatch-status/:orderId',
  authorize('comerciante', 'superadmin', 'despachador'),
  [
    param('orderId').notEmpty(),
    body('dispatchStatus').isIn(['pendiente', 'en_pista', 'cargado', 'despachado', 'entregado'])
      .withMessage('Estado de despacho inválido'),
    body('dispatchNotes').optional(),
    validateRequest,
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const { orderId } = req.params;
      const { dispatchStatus, dispatchNotes } = req.body;

      const updates: string[] = ['dispatch_status = ?'];
      const values: any[] = [dispatchStatus];

      if (dispatchNotes !== undefined) {
        updates.push('dispatch_notes = ?');
        values.push(dispatchNotes);
      }

      // Cuando sale de la pista → marcar hora de despacho y poner vehículo en_ruta
      if (dispatchStatus === 'despachado') {
        updates.push('dispatched_at = NOW()');

        // Marcar vehículo como en_ruta
        await pool.query(
          `UPDATE fleet_vehicles fv
           INNER JOIN storefront_orders o ON o.vehicle_id = fv.id
           SET fv.status = 'en_ruta'
           WHERE o.id = ? AND fv.tenant_id = ?`,
          [orderId, tenantId]
        );
      }

      // Cuando se entrega → marcar vehículo disponible si no tiene más rutas activas
      if (dispatchStatus === 'entregado') {
        const [orderRow] = await pool.query(
          'SELECT vehicle_id FROM storefront_orders WHERE id = ? AND tenant_id = ?',
          [orderId, tenantId]
        ) as any;

        if (orderRow.length > 0 && orderRow[0].vehicle_id) {
          const vehicleId = orderRow[0].vehicle_id;
          const [activeRoutes] = await pool.query(
            `SELECT COUNT(*) as cnt FROM storefront_orders
             WHERE vehicle_id = ? AND dispatch_status = 'despachado' AND id != ?`,
            [vehicleId, orderId]
          ) as any;

          if (activeRoutes[0].cnt === 0) {
            await pool.query(
              "UPDATE fleet_vehicles SET status = 'disponible' WHERE id = ?",
              [vehicleId]
            );
          }
        }
      }

      values.push(orderId, tenantId);
      await pool.query(
        `UPDATE storefront_orders SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`,
        values
      );

      res.json({ success: true, message: `Estado actualizado a: ${dispatchStatus}` });
    } catch (error) {
      console.error('Update dispatch status error:', error);
      res.status(500).json({ success: false, error: 'Error al actualizar estado de despacho' });
    }
  }
);

// GET /api/fleet/active-routes — Vehículos en ruta (para mapa en tiempo real)
router.get(
  '/active-routes',
  authorize('comerciante', 'superadmin', 'despachador'),
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;

      const [routes] = await pool.query(
        `SELECT v.id as vehicleId, v.name as vehicleName, v.plate, v.type,
                o.id as orderId, o.order_number as orderNumber,
                o.customer_name as customerName, o.address, o.municipality,
                o.delivery_latitude as latitude, o.delivery_longitude as longitude,
                o.dispatch_status as dispatchStatus, o.dispatched_at as dispatchedAt,
                u.name as driverName, u.phone as driverPhone
         FROM fleet_vehicles v
         INNER JOIN storefront_orders o ON o.vehicle_id = v.id
         LEFT JOIN users u ON u.id = o.delivery_driver_id
         WHERE v.tenant_id = ?
           AND v.status = 'en_ruta'
           AND o.dispatch_status = 'despachado'
         ORDER BY o.dispatched_at ASC`,
        [tenantId]
      ) as any;

      res.json({ success: true, data: routes });
    } catch (error) {
      console.error('Get active routes error:', error);
      res.status(500).json({ success: false, error: 'Error al obtener rutas activas' });
    }
  }
);

// POST /api/fleet/calculate-weight — Calcular peso de un conjunto de items
router.post(
  '/calculate-weight',
  [
    body('items').isArray({ min: 1 }).withMessage('Items requeridos'),
    body('items.*.productId').notEmpty(),
    body('items.*.quantity').isInt({ min: 1 }),
    validateRequest,
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const { items } = req.body;
      const totalWeightKg = await calcOrderWeight(items);
      const vehicleType = totalWeightKg < 50 ? 'moto' : totalWeightKg <= 500 ? 'ligera' : 'planta';

      res.json({ success: true, data: { totalWeightKg, recommendedVehicleType: vehicleType } });
    } catch (error) {
      console.error('Calculate weight error:', error);
      res.status(500).json({ success: false, error: 'Error al calcular peso' });
    }
  }
);

export { router as fleetRoutes, autoAssignVehicle, calcOrderWeight };
