/**
 * Picking (ferretería F3) — cola de preparación de pedidos en bodega.
 *
 * Flujo: el despachador (o el sistema) genera tareas desde los pedidos
 * confirmados → el auxiliar TOMA una tarea → recorre la bodega guiado por
 * ubicaciones (sede_stock.warehouse_location, fallback products.location_in_store,
 * ordenadas alfabéticamente = ruta dentro de la bodega) → la marca PREPARADA.
 * Cuando llega el vehículo, el pedido ya está listo para cargar.
 *
 * Productividad por auxiliar: tareas completadas + tiempo promedio de preparación
 * (completed_at − taken_at). Alimenta el tablero y el dossier de Jerarquía.
 */
import { v4 as uuidv4 } from 'uuid';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import pool from '../../config/database';
import { AppError } from '../../common/middleware';
import { logStage } from '../ops-timeline/ops-timeline.service';

class PickingService {
  /** Ítems del pedido con su ubicación en la sede, ordenados por ubicación. */
  private async buildItems(tenantId: string, orderId: string, sedeId: string | null) {
    const [items] = await pool.query<RowDataPacket[]>(
      `SELECT oi.product_id AS productId, oi.product_name AS productName, oi.quantity,
              COALESCE(ss.warehouse_location, p.location_in_store) AS location
         FROM storefront_order_items oi
         LEFT JOIN products p ON p.id = oi.product_id
         LEFT JOIN sede_stock ss ON ss.product_id = oi.product_id AND ss.sede_id = ?
        WHERE oi.order_id = ?`,
      [sedeId, orderId]
    );
    if (!items.length) throw new AppError('El pedido no tiene ítems', 400);
    // Ruta dentro de la bodega: ubicaciones en orden; sin ubicación al final
    return (items as any[]).sort((a, b) =>
      String(a.location || 'zzz').localeCompare(String(b.location || 'zzz'), 'es', { numeric: true })
    );
  }

  /** Crea la tarea de picking de un pedido (una por pedido). */
  async createTask(tenantId: string, orderId: string) {
    const [[order]] = await pool.query<RowDataPacket[]>(
      `SELECT id, order_number, customer_name, sede_id, status
         FROM storefront_orders WHERE id = ? AND tenant_id = ?`,
      [orderId, tenantId]
    ) as any;
    if (!order) throw new AppError('Pedido no encontrado', 404);
    if (['cancelado', 'entregado'].includes(order.status)) {
      throw new AppError(`El pedido está ${order.status} — no se puede preparar`, 400);
    }

    const [[existing]] = await pool.query<RowDataPacket[]>(
      'SELECT id, status FROM picking_tasks WHERE order_id = ?', [orderId]
    ) as any;
    if (existing) throw new AppError(`Este pedido ya tiene tarea de picking (${existing.status})`, 400);

    const items = await this.buildItems(tenantId, orderId, order.sede_id);
    const id = uuidv4();
    await pool.query<ResultSetHeader>(
      `INSERT INTO picking_tasks (id, tenant_id, order_id, order_number, customer_name, sede_id, items)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, tenantId, orderId, order.order_number, order.customer_name, order.sede_id, JSON.stringify(items)]
    );
    return { id, orderId, orderNumber: order.order_number, itemCount: items.length };
  }

  /** 1 clic del despachador: tareas para todos los pedidos confirmados sin tarea. */
  async generatePending(tenantId: string) {
    const [orders] = await pool.query<RowDataPacket[]>(
      `SELECT o.id FROM storefront_orders o
         LEFT JOIN picking_tasks pt ON pt.order_id = o.id
        WHERE o.tenant_id = ? AND pt.id IS NULL
          AND o.status IN ('confirmado', 'preparando')
          AND o.dispatch_status = 'pendiente'
        ORDER BY o.created_at ASC
        LIMIT 100`,
      [tenantId]
    );
    const created: string[] = [];
    for (const o of orders as any[]) {
      try {
        const t = await this.createTask(tenantId, o.id);
        created.push(t.id);
      } catch { /* pedido sin ítems o carrera — se omite */ }
    }
    return { created: created.length };
  }

  /** Tablero de bodega: cola por estado (+ filtro por sede). */
  async board(tenantId: string, sedeId?: string) {
    const params: any[] = [tenantId];
    let where = `pt.tenant_id = ? AND (pt.status IN ('pendiente','en_preparacion')
                 OR (pt.status = 'preparada' AND pt.completed_at >= CURDATE()))`;
    if (sedeId) { where += ' AND pt.sede_id = ?'; params.push(sedeId); }
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT pt.id, pt.order_id AS orderId, pt.order_number AS orderNumber,
              pt.customer_name AS customerName, pt.sede_id AS sedeId, s.name AS sedeName,
              pt.items, pt.status, pt.priority, pt.notes,
              pt.assigned_to AS assignedTo, u.name AS assignedToName,
              pt.taken_at AS takenAt, pt.completed_at AS completedAt, pt.created_at AS createdAt,
              o.dispatch_status AS dispatchStatus
         FROM picking_tasks pt
         LEFT JOIN users u ON u.id = pt.assigned_to
         LEFT JOIN sedes s ON s.id = pt.sede_id
         LEFT JOIN storefront_orders o ON o.id = pt.order_id
        WHERE ${where}
        ORDER BY pt.priority DESC, pt.created_at ASC`,
      params
    );
    const tasks = (rows as any[]).map(r => ({
      ...r,
      items: typeof r.items === 'string' ? JSON.parse(r.items) : r.items,
    }));
    return {
      pendientes: tasks.filter(t => t.status === 'pendiente'),
      enPreparacion: tasks.filter(t => t.status === 'en_preparacion'),
      preparadasHoy: tasks.filter(t => t.status === 'preparada'),
    };
  }

  /** El auxiliar toma la tarea (se la asigna y arranca el cronómetro). */
  async take(tenantId: string, taskId: string, userId: string) {
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE picking_tasks SET status = 'en_preparacion', assigned_to = ?, taken_at = NOW()
        WHERE id = ? AND tenant_id = ? AND status = 'pendiente'`,
      [userId, taskId, tenantId]
    );
    if (result.affectedRows === 0) {
      throw new AppError('La tarea ya fue tomada por otro auxiliar o no está pendiente', 409);
    }
    // Línea de tiempo: el pedido entra a picking
    const [[t]] = await pool.query<RowDataPacket[]>('SELECT order_id, sede_id FROM picking_tasks WHERE id = ?', [taskId]) as any;
    if (t?.order_id) logStage(tenantId, t.order_id, 'en_picking', userId, t.sede_id).catch(() => {});
    return { id: taskId, status: 'en_preparacion' };
  }

  /** Marca preparada (lista para cargar) y sincroniza el pedido a "preparando". */
  async complete(tenantId: string, taskId: string, userId: string) {
    const [[task]] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM picking_tasks WHERE id = ? AND tenant_id = ?', [taskId, tenantId]
    ) as any;
    if (!task) throw new AppError('Tarea no encontrada', 404);
    if (task.status !== 'en_preparacion') {
      throw new AppError(`Solo se completa una tarea en preparación (actual: ${task.status})`, 400);
    }
    if (task.assigned_to && task.assigned_to !== userId) {
      // Otro auxiliar la tenía — se permite pero queda registrado quién la cerró
    }
    await pool.query(
      `UPDATE picking_tasks SET status = 'preparada', completed_at = NOW(),
              assigned_to = COALESCE(assigned_to, ?) WHERE id = ?`,
      [userId, taskId]
    );
    // El pedido avanza a "preparando" (listo para cargar en el Centro de Comando)
    await pool.query(
      `UPDATE storefront_orders SET status = 'preparando' WHERE id = ? AND status = 'confirmado'`,
      [task.order_id]
    );
    logStage(tenantId, task.order_id, 'preparado', userId, task.sede_id).catch(() => {});
    return { id: taskId, status: 'preparada' };
  }

  async cancel(tenantId: string, taskId: string) {
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE picking_tasks SET status = 'cancelada'
        WHERE id = ? AND tenant_id = ? AND status IN ('pendiente','en_preparacion')`,
      [taskId, tenantId]
    );
    if (result.affectedRows === 0) throw new AppError('La tarea no se puede cancelar', 400);
    return { id: taskId, status: 'cancelada' };
  }

  /** Productividad por auxiliar: completadas + tiempo promedio (min) en el rango. */
  async productivity(tenantId: string, days = 30) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT pt.assigned_to AS userId, u.name,
              COUNT(*) AS completedTasks,
              SUM(pt.completed_at >= CURDATE()) AS completedToday,
              ROUND(AVG(TIMESTAMPDIFF(SECOND, pt.taken_at, pt.completed_at)) / 60, 1) AS avgMinutes,
              COALESCE(SUM(JSON_LENGTH(pt.items)), 0) AS totalLines
         FROM picking_tasks pt
         JOIN users u ON u.id = pt.assigned_to
        WHERE pt.tenant_id = ? AND pt.status = 'preparada'
          AND pt.completed_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
          AND pt.taken_at IS NOT NULL
        GROUP BY pt.assigned_to, u.name
        ORDER BY completedTasks DESC`,
      [tenantId, days]
    );
    return (rows as any[]).map(r => ({
      userId: r.userId,
      name: r.name,
      completedTasks: Number(r.completedTasks),
      completedToday: Number(r.completedToday),
      avgMinutes: r.avgMinutes !== null ? Number(r.avgMinutes) : null,
      totalLines: Number(r.totalLines) || 0,
    }));
  }

  /** Resumen para el dossier de Jerarquía de UN colaborador. */
  async userStats(tenantId: string, userId: string) {
    const [[row]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS completedTasks,
              SUM(completed_at >= DATE_FORMAT(NOW(), '%Y-%m-01')) AS thisMonth,
              ROUND(AVG(TIMESTAMPDIFF(SECOND, taken_at, completed_at)) / 60, 1) AS avgMinutes
         FROM picking_tasks
        WHERE tenant_id = ? AND assigned_to = ? AND status = 'preparada' AND taken_at IS NOT NULL`,
      [tenantId, userId]
    ) as any;
    return {
      completedTasks: Number(row?.completedTasks) || 0,
      thisMonth: Number(row?.thisMonth) || 0,
      avgMinutes: row?.avgMinutes !== null && row?.avgMinutes !== undefined ? Number(row.avgMinutes) : null,
    };
  }
}

export default new PickingService();
