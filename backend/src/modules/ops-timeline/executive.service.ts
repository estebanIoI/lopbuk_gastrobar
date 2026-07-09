/**
 * Dashboard Gerencial (ferretería F6) — la única pantalla que el gerente abre
 * cada mañana: ventas, embudo de operación, logística, talento, inventario y
 * finanzas en UN payload (todas las consultas en paralelo).
 *
 * También: mapa de calor de ventas por zona (dónde compran → informa rutas y
 * expansión) y sugerencia de compra (consumo real 30d vs stock → qué pedir).
 */
import pool from '../../config/database';
import { RowDataPacket } from 'mysql2/promise';

class ExecutiveService {
  async dashboard(tenantId: string) {
    const [
      [salesToday], [salesWeek], [salesMonth],
      [funnel], [pickingQueue], [atRiskCount],
      vehicles, [fleetMonth],
      [staff], pickingToday,
      [inventory],
      [sedeLowStock],
      [quotesMonth],
      [stageAvg],
    ] = await Promise.all([
      // Ventas POS (completadas)
      pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS count, COALESCE(SUM(total),0) AS amount, COALESCE(AVG(total),0) AS avgTicket
           FROM sales WHERE tenant_id = ? AND status = 'completada' AND DATE(created_at) = CURDATE()`, [tenantId]),
      pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS count, COALESCE(SUM(total),0) AS amount
           FROM sales WHERE tenant_id = ? AND status = 'completada' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`, [tenantId]),
      pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS count, COALESCE(SUM(total),0) AS amount
           FROM sales WHERE tenant_id = ? AND status = 'completada' AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')`, [tenantId]),
      // Embudo de pedidos abiertos + entregados hoy + valor en la calle
      pool.query<RowDataPacket[]>(
        `SELECT
           SUM(status NOT IN ('entregado','cancelado') AND dispatch_status = 'pendiente') AS pendientes,
           SUM(status = 'preparando' AND dispatch_status = 'pendiente') AS preparados,
           SUM(dispatch_status IN ('en_pista','cargado')) AS cargando,
           SUM(dispatch_status = 'despachado') AS enRuta,
           SUM(dispatch_status = 'entregado' AND DATE(delivery_delivered_at) = CURDATE()) AS entregadosHoy,
           COALESCE(SUM(CASE WHEN dispatch_status = 'despachado' THEN total ELSE 0 END), 0) AS valorEnCalle,
           COALESCE(SUM(CASE WHEN dispatch_status = 'entregado' AND DATE(delivery_delivered_at) = CURDATE() THEN total ELSE 0 END), 0) AS valorEntregadoHoy
         FROM storefront_orders WHERE tenant_id = ?`, [tenantId]),
      pool.query<RowDataPacket[]>(
        `SELECT SUM(status = 'pendiente') AS pendientes, SUM(status = 'en_preparacion') AS enPreparacion
           FROM picking_tasks WHERE tenant_id = ?`, [tenantId]),
      pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS n FROM storefront_orders
          WHERE tenant_id = ? AND status NOT IN ('entregado','cancelado') AND dispatch_status != 'entregado'
            AND promised_at IS NOT NULL AND promised_at < NOW()`, [tenantId]),
      // Flota
      pool.query<RowDataPacket[]>(
        `SELECT status, COUNT(*) AS n FROM fleet_vehicles WHERE tenant_id = ? GROUP BY status`, [tenantId]
      ).then(([rows]) => rows),
      pool.query<RowDataPacket[]>(
        `SELECT
           (SELECT COALESCE(SUM(amount),0) FROM fleet_vehicle_expenses WHERE tenant_id = ? AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')) AS expensesMonth,
           (SELECT COUNT(*) FROM storefront_orders WHERE tenant_id = ? AND dispatch_status = 'entregado' AND delivery_delivered_at >= DATE_FORMAT(NOW(), '%Y-%m-01')) AS deliveriesMonth`,
        [tenantId, tenantId]),
      // Talento
      pool.query<RowDataPacket[]>(
        `SELECT
           SUM(role = 'repartidor' AND is_active = 1) AS drivers,
           SUM(role = 'auxiliar_bodega' AND is_active = 1) AS auxiliaries,
           SUM(role NOT IN ('cliente','superadmin') AND is_active = 1) AS totalStaff
         FROM users WHERE tenant_id = ?`, [tenantId]),
      pool.query<RowDataPacket[]>(
        `SELECT u.name, COUNT(*) AS tasks
           FROM picking_tasks pt JOIN users u ON u.id = pt.assigned_to
          WHERE pt.tenant_id = ? AND pt.status = 'preparada' AND pt.completed_at >= CURDATE()
          GROUP BY pt.assigned_to, u.name ORDER BY tasks DESC LIMIT 5`, [tenantId]
      ).then(([rows]) => rows),
      // Inventario
      pool.query<RowDataPacket[]>(
        `SELECT
           SUM(stock <= 0) AS outOfStock,
           SUM(stock > 0 AND stock <= reorder_point) AS lowStock,
           COALESCE(SUM(stock * purchase_price), 0) AS inventoryValue,
           COALESCE(SUM(reserved_stock), 0) AS reservedUnits
         FROM products WHERE tenant_id = ?`, [tenantId]),
      // Alertas de stock bajo POR SEDE (multibodega)
      pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS n FROM sede_stock WHERE tenant_id = ? AND min_stock > 0 AND stock <= min_stock`, [tenantId]),
      // Cotizaciones del mes (conversión)
      pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total, SUM(status = 'facturada') AS converted,
                COALESCE(SUM(CASE WHEN status IN ('borrador','enviada','aceptada') THEN total ELSE 0 END), 0) AS pipeline
           FROM quotes WHERE tenant_id = ? AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')`, [tenantId]),
      // Ciclo operativo promedio (30 días)
      pool.query<RowDataPacket[]>(
        `SELECT ROUND(AVG(total)/60, 1) AS avgCycleMin FROM (
           SELECT order_id, SUM(duration_seconds) AS total FROM order_stage_events
            WHERE tenant_id = ? AND duration_seconds IS NOT NULL
              AND order_id IN (SELECT order_id FROM order_stage_events WHERE stage = 'entregado')
              AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY order_id) t`, [tenantId]),
    ]) as any[];

    const vehiclesByStatus: Record<string, number> = {};
    for (const v of vehicles as any[]) vehiclesByStatus[v.status] = Number(v.n);
    // Vehículos con mantenimiento pendiente (km o fecha)
    const [[maintDue]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS n FROM fleet_vehicles
        WHERE tenant_id = ? AND status != 'inactivo'
          AND ((maintenance_every_km > 0 AND (odometer_km - last_maintenance_km) >= maintenance_every_km)
               OR (next_maintenance_date IS NOT NULL AND next_maintenance_date <= CURDATE()))`,
      [tenantId]
    ) as any;
    const deliveriesMonth = Number(fleetMonth[0]?.deliveriesMonth) || 0;
    const expensesMonth = Number(fleetMonth[0]?.expensesMonth) || 0;
    const quotesTotal = Number(quotesMonth[0]?.total) || 0;
    const quotesConverted = Number(quotesMonth[0]?.converted) || 0;

    // ── KPIs añadidos (Bloque A) ────────────────────────────────────────────
    const HORAS_HABILES_DIA = 10; // ventana operativa para utilización de flota
    const [[otif], [util], [rotation]] = await Promise.all([
      // OTIF: entregados a tiempo (delivery ≤ promesa) sobre los que TENÍAN promesa (30d)
      pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS delivered,
                SUM(promised_at IS NOT NULL) AS withPromise,
                SUM(CASE WHEN promised_at IS NOT NULL AND delivery_delivered_at <= promised_at THEN 1 ELSE 0 END) AS onTime
           FROM storefront_orders
          WHERE tenant_id = ? AND dispatch_status = 'entregado'
            AND delivery_delivered_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`, [tenantId]),
      // Utilización de flota: minutos de ruta activa (7d) vs capacidad de la flota
      pool.query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(TIMESTAMPDIFF(MINUTE, started_at, COALESCE(closed_at, NOW()))), 0) AS activeMin
           FROM dispatch_routes
          WHERE tenant_id = ? AND started_at IS NOT NULL
            AND started_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`, [tenantId]),
      // Rotación de inventario: costo de ventas 30d / valor de inventario
      pool.query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(m.quantity * p.purchase_price), 0) AS cogs30
           FROM stock_movements m JOIN products p ON p.id = m.product_id
          WHERE m.tenant_id = ? AND m.type = 'venta'
            AND m.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`, [tenantId]),
    ]) as any[];

    const withPromise = Number(otif[0]?.withPromise) || 0;
    const onTime = Number(otif[0]?.onTime) || 0;
    const fleetSize = (vehiclesByStatus['disponible'] || 0) + (vehiclesByStatus['en_ruta'] || 0) + (vehiclesByStatus['mantenimiento'] || 0);
    const capacityMin = fleetSize * 7 * HORAS_HABILES_DIA * 60;
    const activeMin = Number(util[0]?.activeMin) || 0;
    const invValue = Number(inventory[0].inventoryValue) || 0;
    const cogs30 = Number(rotation[0]?.cogs30) || 0;
    const rotationMonthly = invValue > 0 ? Math.round((cogs30 / invValue) * 100) / 100 : null;
    // Exactitud de inventario: promedio de conteos cerrados (90 días)
    const [[acc]] = await pool.query<RowDataPacket[]>(
      `SELECT ROUND(AVG(accuracy_pct), 1) AS avgAccuracy FROM inventory_counts
        WHERE tenant_id = ? AND status = 'cerrado' AND closed_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)`,
      [tenantId]
    ) as any;
    const inventoryAccuracy = acc?.avgAccuracy != null ? Number(acc.avgAccuracy) : null;
    // Satisfacción del cliente: promedio de calificaciones (30 días)
    const [[sat]] = await pool.query<RowDataPacket[]>(
      `SELECT ROUND(AVG(rating), 2) AS avgRating, COUNT(rating) AS ratings
         FROM storefront_orders
        WHERE tenant_id = ? AND rating IS NOT NULL AND rating_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      [tenantId]
    ) as any;

    return {
      sales: {
        today: { count: Number(salesToday[0].count), amount: Number(salesToday[0].amount), avgTicket: Math.round(Number(salesToday[0].avgTicket)) },
        week: { count: Number(salesWeek[0].count), amount: Number(salesWeek[0].amount) },
        month: { count: Number(salesMonth[0].count), amount: Number(salesMonth[0].amount) },
        quotes: {
          month: quotesTotal,
          converted: quotesConverted,
          conversionRate: quotesTotal > 0 ? Math.round((quotesConverted / quotesTotal) * 100) : 0,
          pipeline: Number(quotesMonth[0]?.pipeline) || 0,
        },
      },
      operation: {
        pendientes: Number(funnel[0].pendientes) || 0,
        enPicking: (Number(pickingQueue[0]?.pendientes) || 0) + (Number(pickingQueue[0]?.enPreparacion) || 0),
        preparados: Number(funnel[0].preparados) || 0,
        cargando: Number(funnel[0].cargando) || 0,
        enRuta: Number(funnel[0].enRuta) || 0,
        entregadosHoy: Number(funnel[0].entregadosHoy) || 0,
        enRiesgo: Number(atRiskCount[0].n) || 0,
        avgCycleMin: stageAvg[0]?.avgCycleMin != null ? Number(stageAvg[0].avgCycleMin) : null,
        // OTIF (On-Time In Full): % entregado a tiempo sobre los que tenían promesa (30d)
        otif: {
          rate: withPromise > 0 ? Math.round((onTime / withPromise) * 100) : null,
          onTime, withPromise, delivered: Number(otif[0]?.delivered) || 0,
        },
        // Satisfacción del cliente: promedio de estrellas (30d)
        satisfaction: {
          avg: sat?.avgRating != null ? Number(sat.avgRating) : null,
          count: Number(sat?.ratings) || 0,
        },
      },
      logistics: {
        vehicles: {
          disponibles: vehiclesByStatus['disponible'] || 0,
          enRuta: vehiclesByStatus['en_ruta'] || 0,
          mantenimiento: vehiclesByStatus['mantenimiento'] || 0,
          inactivos: vehiclesByStatus['inactivo'] || 0,
        },
        expensesMonth,
        deliveriesMonth,
        maintenanceDue: Number(maintDue?.n) || 0,
        costPerDelivery: deliveriesMonth > 0 ? Math.round(expensesMonth / deliveriesMonth) : null,
        valorEnCalle: Number(funnel[0].valorEnCalle) || 0,
        valorEntregadoHoy: Number(funnel[0].valorEntregadoHoy) || 0,
        // Utilización de flota: % de la capacidad (vehículos × 7d × 10h) usada en ruta
        utilizationPct: capacityMin > 0 ? Math.min(100, Math.round((activeMin / capacityMin) * 100)) : null,
      },
      staff: {
        drivers: Number(staff[0].drivers) || 0,
        auxiliaries: Number(staff[0].auxiliaries) || 0,
        totalStaff: Number(staff[0].totalStaff) || 0,
        topPickersToday: (pickingToday as any[]).map(p => ({ name: p.name, tasks: Number(p.tasks) })),
      },
      inventory: {
        outOfStock: Number(inventory[0].outOfStock) || 0,
        lowStock: Number(inventory[0].lowStock) || 0,
        inventoryValue: Number(inventory[0].inventoryValue) || 0,
        reservedUnits: Number(inventory[0].reservedUnits) || 0,
        sedeLowStock: Number(sedeLowStock[0]?.n) || 0,
        // Rotación de inventario (mensual) = costo de ventas 30d / valor de inventario
        rotationMonthly,
        daysOfInventory: rotationMonthly && rotationMonthly > 0 ? Math.round(30 / rotationMonthly) : null,
        // Exactitud físico vs. sistema (promedio de conteos cerrados 90d)
        accuracy: inventoryAccuracy,
      },
    };
  }

  /** Mapa de calor: qué zonas compran más (informa rutas y próxima sede). */
  async salesHeatmap(tenantId: string, days = 30) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(NULLIF(TRIM(neighborhood), ''), 'Sin barrio') AS zone,
              COALESCE(NULLIF(TRIM(municipality), ''), 'Sin municipio') AS municipality,
              COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue
         FROM storefront_orders
        WHERE tenant_id = ? AND status != 'cancelado'
          AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY zone, municipality
        ORDER BY revenue DESC
        LIMIT 15`,
      [tenantId, days]
    );
    return (rows as any[]).map(r => ({
      zone: r.zone, municipality: r.municipality,
      orders: Number(r.orders), revenue: Number(r.revenue),
    }));
  }

  /**
   * Sugerencia de compra: consumo real (ventas 30d en stock_movements) vs stock
   * disponible → "pide N antes de que se agote".
   */
  async purchaseSuggestions(tenantId: string) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT p.id, p.name, p.stock, p.reserved_stock AS reservedStock, p.reorder_point AS reorderPoint,
              p.supplier, COALESCE(c.consumed, 0) AS consumed30d
         FROM products p
         LEFT JOIN (
           SELECT product_id, SUM(quantity) AS consumed
             FROM stock_movements
            WHERE tenant_id = ? AND type = 'venta' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY product_id
         ) c ON c.product_id = p.id
        WHERE p.tenant_id = ?
          AND (p.stock <= p.reorder_point OR (c.consumed IS NOT NULL AND c.consumed > 0 AND p.stock / (c.consumed / 30) < 7))
        ORDER BY (p.stock <= 0) DESC, c.consumed DESC
        LIMIT 20`,
      [tenantId, tenantId]
    );
    return (rows as any[]).map(r => {
      const consumed = Number(r.consumed30d);
      const stock = Number(r.stock);
      const dailyRate = consumed / 30;
      const daysLeft = dailyRate > 0 ? Math.floor(stock / dailyRate) : null;
      // Sugerencia: cubrir 30 días de consumo menos lo que hay (mínimo el punto de reorden)
      const suggested = Math.max(Math.ceil(consumed - stock), Number(r.reorderPoint) || 1, 1);
      return {
        productId: r.id, name: r.name, stock,
        reservedStock: Number(r.reservedStock) || 0,
        reorderPoint: Number(r.reorderPoint) || 0,
        supplier: r.supplier || null,
        consumed30d: consumed, daysLeft,
        suggestedQty: suggested,
        urgent: stock <= 0 || (daysLeft !== null && daysLeft <= 3),
      };
    });
  }
}

export default new ExecutiveService();
