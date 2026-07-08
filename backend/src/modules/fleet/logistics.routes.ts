/**
 * Sistema Operativo Logístico (ferretería multi-sede) — extensión del módulo fleet.
 * Rutas agrupadas, gastos reales por vehículo, tablero de operaciones en vivo,
 * estados del personal, sugerencias de agrupación y analítica de rentabilidad.
 * Se monta bajo /api/fleet (importado por fleet.routes.ts).
 */
import { Router, Response } from 'express';
import { body, param, query } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { authorize, AuthRequest } from '../../common/middleware';
import { validateRequest } from '../../utils/validators';
import pool from '../../config/database';
import { logStage } from '../ops-timeline/ops-timeline.service';

const router: ReturnType<typeof Router> = Router();

const OPS_ROLES = ['comerciante', 'superadmin', 'despachador'] as const;

/** Emite un evento al centro de operaciones del tenant (tablero en vivo). */
export function emitOps(tenantId: string, event: string, payload: Record<string, unknown>): void {
  const io = (global as any).__deliveryIO;
  if (io) io.to(`ops:${tenantId}`).emit(event, payload);
}

/**
 * Notificación transaccional al cliente por WhatsApp (gestión del pedido — base
 * contractual, no marketing: no requiere opt-in de marketing). Best-effort.
 */
async function notifyCustomers(
  tenantId: string, orderIds: string[],
  template: (orderNumber: string, trackingUrl?: string) => string
): Promise<void> {
  try {
    if (orderIds.length === 0) return;
    const [cfg] = await pool.query(
      'SELECT evolution_instance FROM chatbot_config WHERE tenant_id = ? LIMIT 1', [tenantId]
    ) as any;
    const instance = cfg?.[0]?.evolution_instance;
    if (!instance) return;

    // Tracking (F5): asegurar token público para cada pedido → link de seguimiento
    await ensureTrackingTokens(tenantId, orderIds);

    const [orders] = await pool.query(
      `SELECT order_number, customer_phone, tracking_token FROM storefront_orders
        WHERE tenant_id = ? AND id IN (${orderIds.map(() => '?').join(',')})`,
      [tenantId, ...orderIds]
    ) as any;
    const frontendUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
    const { sendTextMessage } = await import('../whatsapp/whatsapp.service');
    for (const o of orders as any[]) {
      const phone = String(o.customer_phone || '').replace(/\D/g, '');
      if (phone.length < 7) continue;
      const trackingUrl = frontendUrl && o.tracking_token ? `${frontendUrl}/seguimiento/${o.tracking_token}` : undefined;
      await sendTextMessage(instance, phone, template(o.order_number, trackingUrl)).catch(() => {});
    }
  } catch (e: any) {
    console.error('[logistics] customer notify failed:', e?.message || e);
  }
}

/** Tracking (F5): genera el token público de seguimiento a los pedidos que no lo tengan. */
async function ensureTrackingTokens(tenantId: string, orderIds: string[]): Promise<void> {
  if (!orderIds.length) return;
  const [rows] = await pool.query(
    `SELECT id FROM storefront_orders
      WHERE tenant_id = ? AND tracking_token IS NULL AND id IN (${orderIds.map(() => '?').join(',')})`,
    [tenantId, ...orderIds]
  ) as any;
  const { randomBytes } = await import('crypto');
  for (const r of rows as any[]) {
    const token = randomBytes(18).toString('base64url'); // 24 chars URL-safe
    await pool.query('UPDATE storefront_orders SET tracking_token = ? WHERE id = ?', [token, r.id]);
  }
}

/** Trazabilidad: registra la transición de estado en order_status_history. */
async function logTransition(
  tenantId: string, orderId: string, from: string | null, to: string, changedBy: string, note?: string,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO order_status_history (order_id, tenant_id, from_status, to_status, changed_by, note)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [orderId, tenantId, from, to, changedBy, note || null]
    );
  } catch (e: any) {
    console.error('[logistics] history write failed:', e?.message || e);
  }
}

// =============================================
// PERFIL EMPRESARIAL DEL VEHÍCULO (documentos, odómetro, consumo)
// PUT /api/fleet/vehicles/:id/profile
// =============================================
router.put(
  '/vehicles/:id/profile',
  authorize('comerciante', 'superadmin'),
  [
    param('id').notEmpty(),
    body('soatExpiry').optional({ nullable: true }).isISO8601(),
    body('tecnoExpiry').optional({ nullable: true }).isISO8601(),
    body('insuranceExpiry').optional({ nullable: true }).isISO8601(),
    body('odometerKm').optional().isInt({ min: 0 }),
    body('fuelType').optional().isString().isLength({ max: 20 }),
    body('volumeM3').optional({ nullable: true }).isFloat({ min: 0 }),
    body('maintenanceEveryKm').optional().isInt({ min: 0 }),
    body('lastMaintenanceKm').optional().isInt({ min: 0 }),
    body('nextMaintenanceDate').optional({ nullable: true }).isISO8601(),
    validateRequest,
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const fields: Record<string, string> = {
        soatExpiry: 'soat_expiry', tecnoExpiry: 'tecno_expiry', insuranceExpiry: 'insurance_expiry',
        odometerKm: 'odometer_km', fuelType: 'fuel_type', volumeM3: 'volume_m3',
        maintenanceEveryKm: 'maintenance_every_km', lastMaintenanceKm: 'last_maintenance_km',
        nextMaintenanceDate: 'next_maintenance_date',
      };
      const updates: string[] = [];
      const values: any[] = [];
      for (const [key, col] of Object.entries(fields)) {
        if (req.body[key] !== undefined) { updates.push(`${col} = ?`); values.push(req.body[key] === '' ? null : req.body[key]); }
      }
      if (updates.length === 0) { res.status(400).json({ success: false, error: 'Nada para actualizar' }); return; }
      values.push(req.params.id, tenantId);
      const [result] = await pool.query(
        `UPDATE fleet_vehicles SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`, values
      ) as any;
      if (!result.affectedRows) { res.status(404).json({ success: false, error: 'Vehículo no encontrado' }); return; }
      res.json({ success: true, data: { updated: true } });
    } catch (error) {
      console.error('Vehicle profile error:', error);
      res.status(500).json({ success: false, error: 'Error al actualizar el perfil del vehículo' });
    }
  }
);

// GET /api/fleet/maintenance-due — vehículos con servicio pendiente (km o fecha)
router.get('/maintenance-due', authorize(...OPS_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const [rows] = await pool.query(
      `SELECT id, name, plate, odometer_km AS odometerKm, last_maintenance_km AS lastMaintenanceKm,
              maintenance_every_km AS maintenanceEveryKm, next_maintenance_date AS nextMaintenanceDate,
              (odometer_km - last_maintenance_km) AS kmSinceService,
              CASE WHEN maintenance_every_km > 0
                   THEN (odometer_km - last_maintenance_km) - maintenance_every_km END AS kmOver,
              CASE WHEN next_maintenance_date IS NOT NULL
                   THEN DATEDIFF(next_maintenance_date, CURDATE()) END AS daysToService
         FROM fleet_vehicles
        WHERE tenant_id = ? AND status != 'inactivo'
          AND ((maintenance_every_km > 0 AND (odometer_km - last_maintenance_km) >= maintenance_every_km * 0.9)
               OR (next_maintenance_date IS NOT NULL AND DATEDIFF(next_maintenance_date, CURDATE()) <= 7))
        ORDER BY kmOver DESC, daysToService ASC`,
      [tenantId]
    ) as any;
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Maintenance due error:', error);
    res.status(500).json({ success: false, error: 'Error al cargar mantenimientos' });
  }
});

// POST /api/fleet/vehicles/:id/service-done — registra mantenimiento hecho (reinicia contadores)
router.post(
  '/vehicles/:id/service-done',
  authorize('comerciante', 'superadmin', 'despachador'),
  [param('id').notEmpty(), body('nextDate').optional({ nullable: true }).isISO8601(), validateRequest],
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const [result] = await pool.query(
        `UPDATE fleet_vehicles
            SET last_maintenance_km = odometer_km, next_maintenance_date = ?
          WHERE id = ? AND tenant_id = ?`,
        [req.body.nextDate || null, req.params.id, tenantId]
      ) as any;
      if (!result.affectedRows) { res.status(404).json({ success: false, error: 'Vehículo no encontrado' }); return; }
      res.json({ success: true, data: { serviced: true } });
    } catch (error) {
      console.error('Service done error:', error);
      res.status(500).json({ success: false, error: 'Error al registrar el mantenimiento' });
    }
  }
);

// =============================================
// GASTOS REALES POR VEHÍCULO (combustible, peajes, repuestos)
// =============================================

// GET /api/fleet/expenses?vehicleId=&days=
router.get(
  '/expenses',
  authorize(...OPS_ROLES),
  [query('vehicleId').optional().isString(), query('days').optional().isInt({ min: 1, max: 365 }), validateRequest],
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const days = Number(req.query.days || 90);
      let sql = `SELECT e.id, e.vehicle_id AS vehicleId, v.name AS vehicleName, e.type, e.amount,
                        e.gallons, e.odometer_km AS odometerKm, e.route_id AS routeId, e.notes,
                        e.created_at AS createdAt, u.name AS createdByName
                   FROM fleet_vehicle_expenses e
                   JOIN fleet_vehicles v ON v.id = e.vehicle_id
                   LEFT JOIN users u ON u.id = e.created_by
                  WHERE e.tenant_id = ? AND e.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`;
      const params: any[] = [tenantId, days];
      if (req.query.vehicleId) { sql += ' AND e.vehicle_id = ?'; params.push(req.query.vehicleId); }
      sql += ' ORDER BY e.created_at DESC LIMIT 300';
      const [rows] = await pool.query(sql, params) as any;
      res.json({ success: true, data: rows });
    } catch (error) {
      console.error('Get expenses error:', error);
      res.status(500).json({ success: false, error: 'Error al obtener gastos' });
    }
  }
);

// POST /api/fleet/expenses — reporta gasto (despachador/comerciante o el CONDUCTOR desde su panel)
router.post(
  '/expenses',
  authorize('comerciante', 'superadmin', 'despachador', 'repartidor'),
  [
    body('vehicleId').notEmpty(),
    body('type').isIn(['combustible', 'peaje', 'repuesto', 'lavado', 'otro']),
    body('amount').isFloat({ min: 0.01 }),
    body('gallons').optional({ nullable: true }).isFloat({ min: 0 }),
    body('odometerKm').optional({ nullable: true }).isInt({ min: 0 }),
    body('routeId').optional({ nullable: true }).isString(),
    body('notes').optional().isString().isLength({ max: 300 }),
    validateRequest,
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const { vehicleId, type, amount, gallons, odometerKm, routeId, notes } = req.body;
      const [veh] = await pool.query(
        'SELECT id, odometer_km FROM fleet_vehicles WHERE id = ? AND tenant_id = ?', [vehicleId, tenantId]
      ) as any;
      if (!veh.length) { res.status(404).json({ success: false, error: 'Vehículo no encontrado' }); return; }

      const id = uuidv4();
      await pool.query(
        `INSERT INTO fleet_vehicle_expenses (id, tenant_id, vehicle_id, type, amount, gallons, odometer_km, route_id, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, tenantId, vehicleId, type, amount, gallons || null, odometerKm || null, routeId || null, notes || null, req.user!.userId]
      );
      // El odómetro reportado actualiza el del vehículo si avanza
      if (odometerKm && Number(odometerKm) > Number(veh[0].odometer_km || 0)) {
        await pool.query('UPDATE fleet_vehicles SET odometer_km = ? WHERE id = ?', [odometerKm, vehicleId]);
      }
      res.status(201).json({ success: true, data: { id } });
    } catch (error) {
      console.error('Create expense error:', error);
      res.status(500).json({ success: false, error: 'Error al registrar el gasto' });
    }
  }
);

// =============================================
// ESTADOS DEL PERSONAL (asignación inteligente + tablero)
// PUT /api/fleet/staff-status — propio (repartidor) o de otro (despachador)
// =============================================
router.put(
  '/staff-status',
  authorize('comerciante', 'superadmin', 'despachador', 'repartidor'),
  [
    body('status').isIn(['disponible', 'en_ruta', 'descargando', 'almuerzo', 'fuera_turno', 'incapacidad']),
    body('userId').optional().isString(),
    validateRequest,
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      // El repartidor solo puede cambiar SU estado; los roles de operación, el de cualquiera
      const targetId = (req.user!.role === 'repartidor') ? req.user!.userId : (req.body.userId || req.user!.userId);
      await pool.query(
        `INSERT INTO courier_availability (user_id, tenant_id, status, is_online)
         VALUES (?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE status = VALUES(status), last_seen_at = NOW()`,
        [targetId, tenantId, req.body.status]
      );
      emitOps(tenantId!, 'staff-status-changed', { userId: targetId, status: req.body.status });
      res.json({ success: true, data: { userId: targetId, status: req.body.status } });
    } catch (error) {
      console.error('Staff status error:', error);
      res.status(500).json({ success: false, error: 'Error al cambiar estado del personal' });
    }
  }
);

// =============================================
// RUTAS AGRUPADAS
// =============================================

/** Sugerencia de # de auxiliares por peso (umbrales del negocio). */
function suggestAuxiliaries(weightKg: number): number {
  if (weightKg > 800) return 2;
  if (weightKg > 300) return 1;
  return 0;
}

// GET /api/fleet/routes?status= — rutas del tenant con sus paradas
router.get(
  '/routes',
  authorize(...OPS_ROLES),
  [query('status').optional().isString(), validateRequest],
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      let sql = `SELECT r.id, r.route_number AS routeNumber, r.status, r.total_weight_kg AS totalWeightKg,
                        r.stops_count AS stopsCount, r.zone_label AS zoneLabel, r.auxiliaries,
                        r.started_at AS startedAt, r.closed_at AS closedAt, r.created_at AS createdAt,
                        v.id AS vehicleId, v.name AS vehicleName, v.plate, v.max_weight_kg AS maxWeightKg,
                        u.id AS driverId, u.name AS driverName
                   FROM dispatch_routes r
                   LEFT JOIN fleet_vehicles v ON v.id = r.vehicle_id
                   LEFT JOIN users u ON u.id = r.driver_id
                  WHERE r.tenant_id = ?`;
      const params: any[] = [tenantId];
      if (req.query.status) { sql += ' AND r.status = ?'; params.push(req.query.status); }
      else { sql += " AND r.status NOT IN ('cerrada','cancelada')"; }
      sql += ' ORDER BY r.created_at DESC LIMIT 100';
      const [routes] = await pool.query(sql, params) as any;

      // Paradas de cada ruta (una consulta para todas)
      if (routes.length > 0) {
        const ids = routes.map((r: any) => r.id);
        const [stops] = await pool.query(
          `SELECT id, route_id AS routeId, order_number AS orderNumber, customer_name AS customerName,
                  address, neighborhood, total_weight_kg AS weightKg, dispatch_status AS dispatchStatus,
                  route_sequence AS sequence
             FROM storefront_orders
            WHERE route_id IN (${ids.map(() => '?').join(',')})
            ORDER BY route_sequence ASC`,
          ids
        ) as any;
        for (const r of routes) {
          r.stops = (stops as any[]).filter(s => s.routeId === r.id);
          r.auxiliaries = typeof r.auxiliaries === 'string' ? (() => { try { return JSON.parse(r.auxiliaries) } catch { return [] } })() : (r.auxiliaries || []);
        }
      }
      res.json({ success: true, data: routes });
    } catch (error) {
      console.error('Get routes error:', error);
      res.status(500).json({ success: false, error: 'Error al obtener rutas' });
    }
  }
);

// GET /api/fleet/routes/suggestions — agrupación automática por zona (barrio/municipio)
router.get(
  '/routes/suggestions',
  authorize(...OPS_ROLES),
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      // Pedidos pendientes de despacho, sin ruta, agrupados por zona textual
      const [orders] = await pool.query(
        `SELECT id, order_number AS orderNumber, customer_name AS customerName, address,
                COALESCE(NULLIF(TRIM(neighborhood), ''), NULLIF(TRIM(municipality), ''), 'Sin zona') AS zone,
                COALESCE(total_weight_kg, 0) AS weightKg, created_at AS createdAt
           FROM storefront_orders
          WHERE tenant_id = ? AND route_id IS NULL
            AND dispatch_status IN ('pendiente', 'en_pista')
            AND status NOT IN ('cancelado', 'entregado')
          ORDER BY created_at ASC LIMIT 200`,
        [tenantId]
      ) as any;

      // Vehículos disponibles (para proponer el más ajustado por grupo)
      const [vehicles] = await pool.query(
        `SELECT id, name, plate, type, max_weight_kg AS maxWeightKg
           FROM fleet_vehicles WHERE tenant_id = ? AND status = 'disponible'
          ORDER BY max_weight_kg ASC`,
        [tenantId]
      ) as any;

      // Rutas activas con capacidad restante → primero sugerir SUMAR a ruta existente
      const [activeRoutes] = await pool.query(
        `SELECT r.id, r.route_number AS routeNumber, r.zone_label AS zoneLabel, r.total_weight_kg AS totalWeightKg,
                v.max_weight_kg AS maxWeightKg, v.name AS vehicleName
           FROM dispatch_routes r JOIN fleet_vehicles v ON v.id = r.vehicle_id
          WHERE r.tenant_id = ? AND r.status IN ('planificada', 'cargando')`,
        [tenantId]
      ) as any;

      // Agrupar por zona
      const groups = new Map<string, any[]>();
      for (const o of orders as any[]) {
        const list = groups.get(o.zone) || [];
        list.push(o);
        groups.set(o.zone, list);
      }

      const suggestions: any[] = [];
      for (const [zone, zoneOrders] of groups) {
        if (zoneOrders.length < 2 && zone === 'Sin zona') continue;
        const totalWeight = zoneOrders.reduce((s, o) => s + Number(o.weightKg), 0);

        // ¿Cabe en una ruta activa de la misma zona? (ahorro real: no sacar otro vehículo)
        const joinable = (activeRoutes as any[]).find(r =>
          r.zoneLabel === zone && Number(r.totalWeightKg) + totalWeight <= Number(r.maxWeightKg)
        );
        // Vehículo disponible más pequeño que aguante el grupo
        const vehicle = (vehicles as any[]).find(v => Number(v.maxWeightKg) >= totalWeight) || null;

        suggestions.push({
          zone,
          orders: zoneOrders,
          orderCount: zoneOrders.length,
          totalWeightKg: Math.round(totalWeight * 1000) / 1000,
          suggestedAuxiliaries: suggestAuxiliaries(totalWeight),
          joinRoute: joinable ? { id: joinable.id, routeNumber: joinable.routeNumber, vehicleName: joinable.vehicleName } : null,
          suggestedVehicle: vehicle,
        });
      }
      // Grupos con más pedidos primero (mayor ahorro)
      suggestions.sort((a, b) => b.orderCount - a.orderCount);
      res.json({ success: true, data: suggestions });
    } catch (error) {
      console.error('Route suggestions error:', error);
      res.status(500).json({ success: false, error: 'Error al calcular sugerencias' });
    }
  }
);

// POST /api/fleet/routes — crear ruta desde una selección de pedidos
router.post(
  '/routes',
  authorize(...OPS_ROLES),
  [
    body('orderIds').isArray({ min: 1 }),
    body('vehicleId').notEmpty(),
    body('driverId').optional({ nullable: true }).isString(),
    body('auxiliaries').optional().isArray(),
    body('zoneLabel').optional().isString().isLength({ max: 120 }),
    body('sedeId').optional({ nullable: true }).isString(),
    body('notes').optional().isString().isLength({ max: 300 }),
    validateRequest,
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { orderIds, vehicleId, driverId, auxiliaries, zoneLabel, sedeId, notes } = req.body;

      // Vehículo del tenant + capacidad
      const [veh] = await pool.query(
        'SELECT id, name, max_weight_kg FROM fleet_vehicles WHERE id = ? AND tenant_id = ?',
        [vehicleId, tenantId]
      ) as any;
      if (!veh.length) { res.status(404).json({ success: false, error: 'Vehículo no encontrado' }); return; }

      // Pedidos válidos: del tenant, sin ruta previa
      const placeholders = (orderIds as string[]).map(() => '?').join(',');
      const [orders] = await pool.query(
        `SELECT id, COALESCE(total_weight_kg, 0) AS weightKg, dispatch_status
           FROM storefront_orders
          WHERE tenant_id = ? AND id IN (${placeholders}) AND route_id IS NULL`,
        [tenantId, ...orderIds]
      ) as any;
      if (orders.length !== orderIds.length) {
        res.status(400).json({ success: false, error: 'Algún pedido no existe o ya está en otra ruta' });
        return;
      }
      const totalWeight = (orders as any[]).reduce((s, o) => s + Number(o.weightKg), 0);
      if (totalWeight > Number(veh[0].max_weight_kg)) {
        res.status(400).json({
          success: false,
          error: `La carga (${totalWeight.toFixed(1)} kg) supera la capacidad de ${veh[0].name} (${veh[0].max_weight_kg} kg)`,
        });
        return;
      }

      const routeId = uuidv4();
      const routeNumber = 'RT' + Date.now().toString(36).toUpperCase().slice(-6);
      await pool.query(
        `INSERT INTO dispatch_routes
           (id, tenant_id, route_number, vehicle_id, driver_id, auxiliaries, status, total_weight_kg, stops_count, zone_label, sede_id, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, 'planificada', ?, ?, ?, ?, ?, ?)`,
        [routeId, tenantId, routeNumber, vehicleId, driverId || null,
          JSON.stringify(auxiliaries || []), totalWeight, orderIds.length,
          zoneLabel || null, sedeId || null, notes || null, req.user!.userId]
      );

      // Vincular pedidos con secuencia de parada + asignar vehículo/conductor
      for (let i = 0; i < orderIds.length; i++) {
        await pool.query(
          `UPDATE storefront_orders
              SET route_id = ?, route_sequence = ?, vehicle_id = ?,
                  delivery_driver_id = COALESCE(?, delivery_driver_id),
                  delivery_status = CASE WHEN ? IS NOT NULL THEN 'asignado' ELSE delivery_status END,
                  delivery_assigned_at = CASE WHEN ? IS NOT NULL THEN NOW() ELSE delivery_assigned_at END,
                  sede_id = COALESCE(?, sede_id)
            WHERE id = ? AND tenant_id = ?`,
          [routeId, i + 1, vehicleId, driverId || null, driverId || null, driverId || null, sedeId || null, orderIds[i], tenantId]
        );
        await logTransition(tenantId, orderIds[i], null, `ruta:${routeNumber}`, req.user!.userId, `Agregado a ruta ${routeNumber} (parada ${i + 1})`);
      }

      emitOps(tenantId, 'dispatch-changed', { kind: 'route-created', routeId, routeNumber });
      res.status(201).json({
        success: true,
        data: { routeId, routeNumber, totalWeightKg: totalWeight, stops: orderIds.length, suggestedAuxiliaries: suggestAuxiliaries(totalWeight) },
      });
    } catch (error) {
      console.error('Create route error:', error);
      res.status(500).json({ success: false, error: 'Error al crear la ruta' });
    }
  }
);

// PATCH /api/fleet/routes/:id/status — mueve la ruta y CASCADA a sus pedidos
const ROUTE_TO_DISPATCH: Record<string, string | null> = {
  planificada: null,
  cargando: 'cargado',
  en_ruta: 'despachado',
  retornando: null,
  cerrada: 'entregado',
  cancelada: null,
};
router.patch(
  '/routes/:id/status',
  authorize(...OPS_ROLES),
  [
    param('id').notEmpty(),
    body('status').isIn(['planificada', 'cargando', 'en_ruta', 'retornando', 'cerrada', 'cancelada']),
    validateRequest,
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { status } = req.body;
      const [routes] = await pool.query(
        'SELECT id, route_number, status, vehicle_id FROM dispatch_routes WHERE id = ? AND tenant_id = ?',
        [req.params.id, tenantId]
      ) as any;
      if (!routes.length) { res.status(404).json({ success: false, error: 'Ruta no encontrada' }); return; }
      const route = routes[0];

      const extra = status === 'en_ruta' ? ', started_at = NOW()'
        : (status === 'cerrada' || status === 'cancelada') ? ', closed_at = NOW()' : '';
      await pool.query(
        `UPDATE dispatch_routes SET status = ?${extra} WHERE id = ?`,
        [status, route.id]
      );

      // Cascada al estado de despacho de los pedidos de la ruta
      const dispatchStatus = ROUTE_TO_DISPATCH[status];
      if (dispatchStatus) {
        const dispatchedAt = dispatchStatus === 'despachado' ? ', dispatched_at = NOW()' : '';
        const deliverySync = dispatchStatus === 'entregado'
          ? ", delivery_status = 'entregado', delivery_delivered_at = NOW(), status = 'entregado'"
          : dispatchStatus === 'despachado' ? ", delivery_status = 'en_camino'" : '';
        await pool.query(
          `UPDATE storefront_orders SET dispatch_status = ?${dispatchedAt}${deliverySync}
            WHERE route_id = ? AND tenant_id = ? AND dispatch_status != 'entregado'`,
          [dispatchStatus, route.id, tenantId]
        );
        // Promesa de entrega automática (F4/F5): al salir a ruta, si el pedido no tiene
        // promesa, se estima NOW + ventana según nº de paradas (~40 min/parada, tope 6h).
        if (status === 'en_ruta') {
          const [[cnt]] = await pool.query(
            `SELECT COUNT(*) AS n FROM storefront_orders WHERE route_id = ? AND dispatch_status != 'entregado'`,
            [route.id]
          ) as any;
          const etaMinutes = Math.min(360, 30 + (Number(cnt?.n) || 1) * 40);
          await pool.query(
            `UPDATE storefront_orders
                SET promised_at = DATE_ADD(NOW(), INTERVAL ? MINUTE)
              WHERE route_id = ? AND tenant_id = ? AND dispatch_status != 'entregado' AND promised_at IS NULL`,
            [etaMinutes, route.id, tenantId]
          );
        }
        const [stops] = await pool.query(
          'SELECT id FROM storefront_orders WHERE route_id = ?', [route.id]
        ) as any;
        for (const s of stops as any[]) {
          await logTransition(tenantId, s.id, route.status, dispatchStatus, req.user!.userId, `Ruta ${route.route_number} → ${status}`);
          // Línea de tiempo por etapa (F4): solo etapas canónicas de despacho
          if (['cargado', 'despachado', 'entregado'].includes(dispatchStatus)) {
            logStage(tenantId, s.id, dispatchStatus as any, req.user!.userId).catch(() => {});
          }
        }
      }
      // Cancelada: liberar pedidos para re-agrupar
      if (status === 'cancelada') {
        await pool.query(
          `UPDATE storefront_orders SET route_id = NULL, route_sequence = NULL
            WHERE route_id = ? AND tenant_id = ? AND dispatch_status != 'entregado'`,
          [route.id, tenantId]
        );
      }

      // Estado del vehículo en espejo con la ruta
      if (route.vehicle_id) {
        const vehicleStatus = status === 'en_ruta' ? 'en_ruta'
          : (status === 'cerrada' || status === 'cancelada') ? 'disponible' : null;
        if (vehicleStatus) {
          await pool.query('UPDATE fleet_vehicles SET status = ? WHERE id = ?', [vehicleStatus, route.vehicle_id]);
        }
      }

      // WhatsApp al cliente: "tu pedido salió" / "entregado" (transaccional)
      if (status === 'en_ruta' || status === 'cerrada') {
        const [stopIds] = await pool.query(
          'SELECT id FROM storefront_orders WHERE route_id = ?', [route.id]
        ) as any;
        const ids = (stopIds as any[]).map(s => s.id);
        if (status === 'en_ruta') {
          notifyCustomers(tenantId, ids, (n, url) =>
            `🚚 ¡Tu pedido #${n} salió y va en camino! Te avisamos al llegar.${url ? `\n\n📍 Síguelo en vivo aquí:\n${url}` : ''}`
          ).catch(() => {});
        } else {
          notifyCustomers(tenantId, ids, n => `✅ Tu pedido #${n} fue entregado. ¡Gracias por tu compra!`).catch(() => {});
        }
      }

      emitOps(tenantId, 'dispatch-changed', { kind: 'route-status', routeId: route.id, status });
      res.json({ success: true, data: { status } });
    } catch (error) {
      console.error('Route status error:', error);
      res.status(500).json({ success: false, error: 'Error al cambiar el estado de la ruta' });
    }
  }
);

// POST /api/fleet/my-route/ping — el teléfono del conductor reporta su posición (F5)
router.post(
  '/my-route/ping',
  authorize('comerciante', 'superadmin', 'despachador', 'repartidor'),
  [body('lat').isFloat({ min: -90, max: 90 }), body('lng').isFloat({ min: -180, max: 180 }), validateRequest],
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const [result] = await pool.query(
        `UPDATE dispatch_routes
            SET last_lat = ?, last_lng = ?, last_ping_at = NOW()
          WHERE tenant_id = ? AND driver_id = ? AND status IN ('en_ruta','retornando')
          ORDER BY started_at DESC LIMIT 1`,
        [req.body.lat, req.body.lng, tenantId, req.user!.userId]
      ) as any;
      if (result.affectedRows > 0) {
        emitOps(tenantId, 'route-ping', { driverId: req.user!.userId, lat: req.body.lat, lng: req.body.lng });
      }
      res.json({ success: true, data: { tracked: result.affectedRows > 0 } });
    } catch (error) {
      console.error('Route ping error:', error);
      res.status(500).json({ success: false, error: 'Error al reportar la posición' });
    }
  }
);

// PATCH /api/fleet/routes/:id/stops/:orderId/delivered — entrega parada por parada (conductor)
// Acepta prueba de entrega (F5): foto + nombre de quien recibe.
router.patch(
  '/routes/:id/stops/:orderId/delivered',
  authorize('comerciante', 'superadmin', 'despachador', 'repartidor'),
  [
    param('id').notEmpty(), param('orderId').notEmpty(),
    body('podPhotoUrl').optional({ nullable: true }).isString().isLength({ max: 500 }),
    body('podReceivedBy').optional({ nullable: true }).isString().isLength({ max: 120 }),
    validateRequest,
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const [result] = await pool.query(
        `UPDATE storefront_orders
            SET dispatch_status = 'entregado', delivery_status = 'entregado',
                delivery_delivered_at = NOW(), status = 'entregado',
                pod_photo_url = COALESCE(?, pod_photo_url),
                pod_received_by = COALESCE(?, pod_received_by)
          WHERE id = ? AND route_id = ? AND tenant_id = ?`,
        [req.body.podPhotoUrl || null, req.body.podReceivedBy || null, req.params.orderId, req.params.id, tenantId]
      ) as any;
      if (!result.affectedRows) { res.status(404).json({ success: false, error: 'Parada no encontrada' }); return; }
      await logTransition(tenantId, req.params.orderId, 'despachado', 'entregado', req.user!.userId, 'Entregado en ruta');
      logStage(tenantId, req.params.orderId, 'entregado', req.user!.userId).catch(() => {});

      // ¿Era la última parada? → cerrar la ruta y liberar vehículo automáticamente
      const [pending] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM storefront_orders
          WHERE route_id = ? AND dispatch_status != 'entregado'`,
        [req.params.id]
      ) as any;
      let routeClosed = false;
      if (Number(pending[0].cnt) === 0) {
        await pool.query(
          `UPDATE dispatch_routes SET status = 'cerrada', closed_at = NOW() WHERE id = ? AND tenant_id = ?`,
          [req.params.id, tenantId]
        );
        await pool.query(
          `UPDATE fleet_vehicles fv JOIN dispatch_routes r ON r.vehicle_id = fv.id
              SET fv.status = 'disponible' WHERE r.id = ?`,
          [req.params.id]
        );
        routeClosed = true;
      }
      notifyCustomers(tenantId, [req.params.orderId], n => `✅ Tu pedido #${n} fue entregado. ¡Gracias por tu compra!`).catch(() => {});
      emitOps(tenantId, 'dispatch-changed', { kind: 'stop-delivered', routeId: req.params.id, orderId: req.params.orderId, routeClosed });
      res.json({ success: true, data: { delivered: true, routeClosed } });
    } catch (error) {
      console.error('Stop delivered error:', error);
      res.status(500).json({ success: false, error: 'Error al marcar la entrega' });
    }
  }
);

// =============================================
// TABLERO DE OPERACIONES (pantalla de bodega)
// GET /api/fleet/ops-board
// =============================================
router.get(
  '/ops-board',
  authorize(...OPS_ROLES),
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const [[orders], [vehicles], [couriers], [routes]] = await Promise.all([
        // Pedidos activos con minutos de espera (semáforo en el frontend)
        pool.query(
          `SELECT id, order_number AS orderNumber, customer_name AS customerName, neighborhood, municipality,
                  COALESCE(total_weight_kg, 0) AS weightKg, dispatch_status AS dispatchStatus,
                  route_id AS routeId, vehicle_id AS vehicleId, created_at AS createdAt,
                  TIMESTAMPDIFF(MINUTE, created_at, NOW()) AS waitingMinutes
             FROM storefront_orders
            WHERE tenant_id = ? AND status NOT IN ('cancelado')
              AND dispatch_status IN ('pendiente', 'en_pista', 'cargado', 'despachado')
            ORDER BY created_at ASC LIMIT 150`,
          [tenantId]
        ) as Promise<any>,
        // Vehículos con su carga activa
        pool.query(
          `SELECT v.id, v.name, v.plate, v.type, v.status, v.max_weight_kg AS maxWeightKg,
                  r.id AS routeId, r.route_number AS routeNumber, r.total_weight_kg AS routeWeightKg,
                  r.status AS routeStatus, r.started_at AS startedAt
             FROM fleet_vehicles v
             LEFT JOIN dispatch_routes r ON r.vehicle_id = v.id AND r.status IN ('planificada','cargando','en_ruta','retornando')
            WHERE v.tenant_id = ? AND v.status != 'inactivo'
            ORDER BY v.type, v.name`,
          [tenantId]
        ) as Promise<any>,
        // Personal con estado + entregas de hoy
        pool.query(
          `SELECT u.id, u.name, ca.status, ca.is_online AS isOnline, ca.last_seen_at AS lastSeenAt,
                  (SELECT COUNT(*) FROM storefront_orders o
                    WHERE o.delivery_driver_id = u.id AND o.delivery_status = 'entregado'
                      AND DATE(o.delivery_delivered_at) = CURDATE()) AS deliveredToday
             FROM users u
             LEFT JOIN courier_availability ca ON ca.user_id = u.id
            WHERE u.tenant_id = ? AND u.role = 'repartidor' AND u.is_active = 1`,
          [tenantId]
        ) as Promise<any>,
        pool.query(
          `SELECT COUNT(*) AS active FROM dispatch_routes WHERE tenant_id = ? AND status IN ('planificada','cargando','en_ruta','retornando')`,
          [tenantId]
        ) as Promise<any>,
      ]);

      res.json({
        success: true,
        data: {
          orders,
          vehicles,
          couriers,
          activeRoutes: Number((routes as any)[0]?.active || 0),
        },
      });
    } catch (error) {
      console.error('Ops board error:', error);
      res.status(500).json({ success: false, error: 'Error al cargar el tablero' });
    }
  }
);

// =============================================
// ANALÍTICA DE FLOTA Y CONDUCTORES
// GET /api/fleet/analytics?days=30
// =============================================
router.get(
  '/analytics',
  authorize('comerciante', 'superadmin'),
  [query('days').optional().isInt({ min: 1, max: 365 }), validateRequest],
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const days = Number(req.query.days || 30);

      const [[vehicles], [drivers], [ops]] = await Promise.all([
        // Por vehículo: entregas, facturación movilizada, costos reales, consumo
        pool.query(
          `SELECT v.id, v.name, v.plate, v.type, v.odometer_km AS odometerKm,
                  COALESCE(o.deliveries, 0) AS deliveries,
                  COALESCE(o.revenueMoved, 0) AS revenueMoved,
                  COALESCE(e.totalExpenses, 0) AS totalExpenses,
                  COALESCE(e.fuelCost, 0) AS fuelCost,
                  COALESCE(e.gallons, 0) AS gallons,
                  COALESCE(m.maintenanceCost, 0) AS maintenanceCost,
                  COALESCE(m.maintenanceCount, 0) AS maintenanceCount
             FROM fleet_vehicles v
             LEFT JOIN (SELECT vehicle_id, COUNT(*) AS deliveries, SUM(total) AS revenueMoved
                          FROM storefront_orders
                         WHERE tenant_id = ? AND dispatch_status = 'entregado'
                           AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                         GROUP BY vehicle_id) o ON o.vehicle_id = v.id
             LEFT JOIN (SELECT vehicle_id, SUM(amount) AS totalExpenses,
                               SUM(CASE WHEN type = 'combustible' THEN amount ELSE 0 END) AS fuelCost,
                               SUM(CASE WHEN type = 'combustible' THEN COALESCE(gallons, 0) ELSE 0 END) AS gallons
                          FROM fleet_vehicle_expenses
                         WHERE tenant_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                         GROUP BY vehicle_id) e ON e.vehicle_id = v.id
             LEFT JOIN (SELECT vehicle_id, SUM(cost) AS maintenanceCost, COUNT(*) AS maintenanceCount
                          FROM fleet_maintenance
                         WHERE tenant_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                         GROUP BY vehicle_id) m ON m.vehicle_id = v.id
            WHERE v.tenant_id = ?
            ORDER BY revenueMoved DESC`,
          [tenantId, days, tenantId, days, tenantId, days, tenantId]
        ) as Promise<any>,
        // Por conductor: entregas y tiempo promedio asignación→entrega
        pool.query(
          `SELECT u.id, u.name,
                  COUNT(o.id) AS deliveries,
                  ROUND(AVG(TIMESTAMPDIFF(MINUTE, o.delivery_assigned_at, o.delivery_delivered_at)), 1) AS avgMinutesPerDelivery
             FROM users u
             JOIN storefront_orders o ON o.delivery_driver_id = u.id
            WHERE u.tenant_id = ? AND o.delivery_status = 'entregado'
              AND o.delivery_delivered_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY u.id, u.name
            ORDER BY deliveries DESC`,
          [tenantId, days]
        ) as Promise<any>,
        // Operación general
        pool.query(
          `SELECT COUNT(*) AS totalOrders,
                  SUM(CASE WHEN dispatch_status = 'entregado' THEN 1 ELSE 0 END) AS delivered,
                  SUM(CASE WHEN dispatch_status IN ('pendiente','en_pista') AND TIMESTAMPDIFF(MINUTE, created_at, NOW()) > 60 THEN 1 ELSE 0 END) AS delayedOrders,
                  ROUND(AVG(CASE WHEN dispatched_at IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, created_at, dispatched_at) END), 1) AS avgMinutesToDispatch,
                  ROUND(AVG(CASE WHEN delivery_delivered_at IS NOT NULL AND dispatched_at IS NOT NULL
                                 THEN TIMESTAMPDIFF(MINUTE, dispatched_at, delivery_delivered_at) END), 1) AS avgMinutesToDeliver
             FROM storefront_orders
            WHERE tenant_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
              AND status != 'cancelado'`,
          [tenantId, days]
        ) as Promise<any>,
      ]);

      // Enriquecer vehículos: rentabilidad y consumo por km
      const enriched = (vehicles as any[]).map(v => {
        const totalCost = Number(v.totalExpenses) + Number(v.maintenanceCost);
        return {
          ...v,
          totalCost,
          estimatedProfit: Number(v.revenueMoved) - totalCost,
          costPerDelivery: Number(v.deliveries) > 0 ? Math.round(totalCost / Number(v.deliveries)) : null,
        };
      });

      res.json({ success: true, data: { days, vehicles: enriched, drivers, operations: (ops as any)[0] || {} } });
    } catch (error) {
      console.error('Fleet analytics error:', error);
      res.status(500).json({ success: false, error: 'Error al calcular la analítica' });
    }
  }
);

export default router;
