/**
 * Tiempos por etapa (ferretería F4) — mide DÓNDE se pierde el tiempo entre que se
 * factura un pedido y se entrega, para que el gerente vea cuellos de botella con
 * datos, no por intuición.
 *
 * logStage() se llama en cada transición (picking, despacho, entrega) y guarda el
 * evento con duration_seconds = tiempo transcurrido desde la etapa anterior
 * (o desde la creación del pedido para la primera). Así la analítica es un AVG
 * simple agrupado por etapa.
 *
 * También detecta pedidos EN RIESGO: promesa de entrega vencida/próxima, o
 * pedidos abiertos que llevan más tiempo del promedio del comercio.
 */
import pool from '../../config/database';
import { RowDataPacket } from 'mysql2/promise';

export type Stage = 'confirmado' | 'en_picking' | 'preparado' | 'cargado' | 'despachado' | 'entregado' | 'cancelado';

const STAGE_ORDER: Stage[] = ['confirmado', 'en_picking', 'preparado', 'cargado', 'despachado', 'entregado'];
const STAGE_LABEL: Record<string, string> = {
  confirmado: 'Confirmado', en_picking: 'En picking', preparado: 'Preparado',
  cargado: 'Cargado', despachado: 'Despachado', entregado: 'Entregado', cancelada: 'Cancelado', cancelado: 'Cancelado',
};

/**
 * Registra una etapa del pedido. Best-effort (no rompe la transacción de negocio
 * si falla). duration_seconds = ahora − (último evento del pedido || created_at).
 */
export async function logStage(
  tenantId: string, orderId: string, stage: Stage, userId?: string | null, sedeId?: string | null
): Promise<void> {
  try {
    const [[last]] = await pool.query<RowDataPacket[]>(
      `SELECT stage, created_at FROM order_stage_events WHERE order_id = ? ORDER BY id DESC LIMIT 1`,
      [orderId]
    ) as any;

    let fromStage: string | null = null;
    let baseTime: string | null = null;
    if (last) {
      fromStage = last.stage;
      baseTime = last.created_at;
    } else {
      const [[order]] = await pool.query<RowDataPacket[]>(
        `SELECT created_at, sede_id FROM storefront_orders WHERE id = ?`, [orderId]
      ) as any;
      baseTime = order?.created_at || null;
      if (!sedeId) sedeId = order?.sede_id || null;
    }

    // duration = ahora − baseTime, en segundos (calculado por MySQL para evitar TZ)
    const [[calc]] = await pool.query<RowDataPacket[]>(
      baseTime ? `SELECT TIMESTAMPDIFF(SECOND, ?, NOW()) AS secs` : `SELECT NULL AS secs`,
      baseTime ? [baseTime] : []
    ) as any;
    const durationSeconds = calc?.secs != null ? Math.max(0, Number(calc.secs)) : null;

    await pool.query(
      `INSERT INTO order_stage_events (tenant_id, order_id, stage, from_stage, duration_seconds, sede_id, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, orderId, stage, fromStage, durationSeconds, sedeId || null, userId || null]
    );
  } catch (e: any) {
    console.error('[ops-timeline] logStage failed:', e?.message || e);
  }
}

class OpsTimelineService {
  /** Tiempo promedio para ALCANZAR cada etapa (desde la anterior), en el rango. */
  async stageAnalytics(tenantId: string, days = 30, sedeId?: string) {
    const params: any[] = [tenantId];
    let sedeWhere = '';
    if (sedeId) { sedeWhere = ' AND sede_id = ?'; params.push(sedeId); }
    params.push(days);

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT stage,
              COUNT(*) AS samples,
              ROUND(AVG(duration_seconds) / 60, 1) AS avgMinutes,
              ROUND(MAX(duration_seconds) / 60, 1) AS maxMinutes
         FROM order_stage_events
        WHERE tenant_id = ?${sedeWhere}
          AND duration_seconds IS NOT NULL
          AND stage != 'cancelado'
          AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY stage`,
      params
    );
    const byStage = new Map((rows as any[]).map(r => [r.stage, r]));

    // Orden canónico + etiqueta; el cuello de botella = etapa de mayor promedio
    const stages = STAGE_ORDER.filter(s => s !== 'confirmado').map(stage => {
      const r = byStage.get(stage);
      return {
        stage,
        label: STAGE_LABEL[stage],
        samples: r ? Number(r.samples) : 0,
        avgMinutes: r ? Number(r.avgMinutes) : null,
        maxMinutes: r ? Number(r.maxMinutes) : null,
      };
    });
    const withData = stages.filter(s => s.avgMinutes != null);
    const bottleneck = withData.length
      ? withData.reduce((a, b) => (b.avgMinutes! > a.avgMinutes! ? b : a))
      : null;

    // Tiempo total promedio de ciclo confirmado→entregado (por pedido)
    const [[cycle]] = await pool.query<RowDataPacket[]>(
      `SELECT ROUND(AVG(total) / 60, 1) AS avgMinutes, COUNT(*) AS delivered
         FROM (
           SELECT order_id, SUM(duration_seconds) AS total
             FROM order_stage_events
            WHERE tenant_id = ?${sedeWhere ? ' AND sede_id = ?' : ''}
              AND duration_seconds IS NOT NULL AND stage != 'cancelado'
              AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
              AND order_id IN (SELECT order_id FROM order_stage_events WHERE stage = 'entregado')
            GROUP BY order_id
         ) t`,
      params
    ) as any;

    return {
      stages,
      bottleneck: bottleneck ? { stage: bottleneck.stage, label: bottleneck.label, avgMinutes: bottleneck.avgMinutes } : null,
      cycle: { avgMinutes: cycle?.avgMinutes != null ? Number(cycle.avgMinutes) : null, delivered: Number(cycle?.delivered) || 0 },
      rangeDays: days,
    };
  }

  /**
   * Pedidos EN RIESGO de incumplir: promesa vencida/próxima (≤2h), o pedidos
   * abiertos que llevan abiertos más de 1.5× el ciclo promedio del comercio.
   * Devuelve el motivo para actuar ANTES de que el cliente reclame.
   */
  async atRisk(tenantId: string) {
    // Ciclo promedio (min) para el umbral relativo; fallback 240 min
    const [[cyc]] = await pool.query<RowDataPacket[]>(
      `SELECT AVG(total) / 60 AS avgMin FROM (
         SELECT order_id, SUM(duration_seconds) AS total FROM order_stage_events
          WHERE tenant_id = ? AND duration_seconds IS NOT NULL
            AND order_id IN (SELECT order_id FROM order_stage_events WHERE stage = 'entregado')
            AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
          GROUP BY order_id) t`,
      [tenantId]
    ) as any;
    const avgCycleMin = cyc?.avgMin ? Number(cyc.avgMin) : 240;
    const thresholdMin = Math.round(avgCycleMin * 1.5);

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT o.id, o.order_number AS orderNumber, o.customer_name AS customerName,
              o.customer_phone AS customerPhone, o.status, o.dispatch_status AS dispatchStatus,
              o.promised_at AS promisedAt, o.total, o.sede_id AS sedeId, s.name AS sedeName,
              TIMESTAMPDIFF(MINUTE, o.created_at, NOW()) AS ageMinutes,
              CASE WHEN o.promised_at IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, NOW(), o.promised_at) END AS minutesToPromise
         FROM storefront_orders o
         LEFT JOIN sedes s ON s.id = o.sede_id
        WHERE o.tenant_id = ?
          AND o.status NOT IN ('entregado','cancelado')
          AND o.dispatch_status != 'entregado'
          AND (
            (o.promised_at IS NOT NULL AND o.promised_at <= DATE_ADD(NOW(), INTERVAL 2 HOUR))
            OR TIMESTAMPDIFF(MINUTE, o.created_at, NOW()) >= ?
          )
        ORDER BY (o.promised_at IS NOT NULL) DESC, o.promised_at ASC, ageMinutes DESC
        LIMIT 50`,
      [tenantId, thresholdMin]
    );

    return {
      thresholdMin,
      avgCycleMin: Math.round(avgCycleMin),
      orders: (rows as any[]).map(o => {
        const overdue = o.minutesToPromise != null && Number(o.minutesToPromise) < 0;
        let reason: string;
        if (overdue) reason = `Promesa vencida hace ${Math.abs(Number(o.minutesToPromise))} min`;
        else if (o.minutesToPromise != null) reason = `Entrega prometida en ${Number(o.minutesToPromise)} min`;
        else reason = `Abierto ${Number(o.ageMinutes)} min (promedio ${Math.round(avgCycleMin)})`;
        return {
          id: o.id, orderNumber: o.orderNumber, customerName: o.customerName, customerPhone: o.customerPhone,
          status: o.status, dispatchStatus: o.dispatchStatus, total: Number(o.total),
          sedeId: o.sedeId, sedeName: o.sedeName,
          ageMinutes: Number(o.ageMinutes),
          promisedAt: o.promisedAt, minutesToPromise: o.minutesToPromise != null ? Number(o.minutesToPromise) : null,
          overdue, reason,
        };
      }),
    };
  }

  /** Línea de tiempo de UN pedido (para el detalle). */
  async orderTimeline(tenantId: string, orderId: string) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT e.stage, e.from_stage AS fromStage, e.duration_seconds AS durationSeconds,
              e.user_id AS userId, u.name AS userName, e.created_at AS createdAt
         FROM order_stage_events e
         LEFT JOIN users u ON u.id = e.user_id
        WHERE e.tenant_id = ? AND e.order_id = ?
        ORDER BY e.id ASC`,
      [tenantId, orderId]
    );
    return (rows as any[]).map(r => ({
      stage: r.stage, label: STAGE_LABEL[r.stage] || r.stage, fromStage: r.fromStage,
      durationMinutes: r.durationSeconds != null ? Math.round(Number(r.durationSeconds) / 60) : null,
      userName: r.userName, createdAt: r.createdAt,
    }));
  }

  /** Fija/actualiza la promesa de entrega de un pedido (base del at-risk). */
  async setPromise(tenantId: string, orderId: string, promisedAt: string | null) {
    const [result] = await pool.query(
      `UPDATE storefront_orders SET promised_at = ? WHERE id = ? AND tenant_id = ?`,
      [promisedAt, orderId, tenantId]
    ) as any;
    if (result.affectedRows === 0) throw new Error('Pedido no encontrado');
    return { orderId, promisedAt };
  }

  // ── Recepción de mercancía ─────────────────────────────────────────────────

  /** Marca la llegada de una compra (arranca el cronómetro) y fija la bodega destino. */
  async markArrival(tenantId: string, purchaseId: string, sedeId?: string | null) {
    const sets = ['arrival_at = COALESCE(arrival_at, NOW())'];
    const values: any[] = [];
    if (sedeId !== undefined) { sets.push('sede_id = ?'); values.push(sedeId || null); }
    values.push(purchaseId, tenantId);
    const [result] = await pool.query(
      `UPDATE purchase_invoices SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`,
      values
    ) as any;
    if (result.affectedRows === 0) throw new Error('Compra no encontrada');
    return { purchaseId, arrivalAt: new Date().toISOString(), sedeId: sedeId ?? undefined };
  }

  /**
   * Marca la mercancía como recibida/almacenada (cierra el cronómetro) y, si la
   * compra tiene bodega destino, SUMA los ítems al desglose sede_stock de esa sede.
   * Idempotente: solo distribuye la primera vez (mientras received_at era NULL).
   */
  async markReceived(tenantId: string, purchaseId: string, userId: string) {
    const [[invoice]] = await pool.query<RowDataPacket[]>(
      `SELECT id, sede_id AS sedeId, received_at AS receivedAt FROM purchase_invoices WHERE id = ? AND tenant_id = ?`,
      [purchaseId, tenantId]
    ) as any;
    if (!invoice) throw new Error('Compra no encontrada');

    const firstReception = !invoice.receivedAt;
    await pool.query(
      `UPDATE purchase_invoices
          SET arrival_at = COALESCE(arrival_at, NOW()), received_at = NOW(), received_by = ?
        WHERE id = ? AND tenant_id = ?`,
      [userId, purchaseId, tenantId]
    );

    let distributed = 0;
    if (firstReception && invoice.sedeId) {
      const [items] = await pool.query<RowDataPacket[]>(
        `SELECT product_id AS productId, quantity FROM purchase_invoice_items WHERE invoice_id = ?`,
        [purchaseId]
      );
      const { v4: uuidv4 } = await import('uuid');
      for (const it of items as any[]) {
        await pool.query(
          `INSERT INTO sede_stock (id, tenant_id, sede_id, product_id, stock)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE stock = stock + VALUES(stock)`,
          [uuidv4(), tenantId, invoice.sedeId, it.productId, Number(it.quantity)]
        );
        distributed++;
      }
    }
    return { purchaseId, received: true, sedeId: invoice.sedeId || null, distributedItems: distributed };
  }

  /** Compras recientes con su estado de recepción (para el tablero de recepción). */
  async recentPurchases(tenantId: string, limit = 20) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT pi.id, pi.invoice_number AS invoiceNumber, pi.supplier_name AS supplierName,
              pi.total, pi.purchase_date AS purchaseDate,
              pi.arrival_at AS arrivalAt, pi.received_at AS receivedAt,
              pi.sede_id AS sedeId, s.name AS sedeName,
              (SELECT COUNT(*) FROM purchase_invoice_items WHERE invoice_id = pi.id) AS itemCount
         FROM purchase_invoices pi
         LEFT JOIN sedes s ON s.id = pi.sede_id
        WHERE pi.tenant_id = ?
        ORDER BY pi.created_at DESC
        LIMIT ?`,
      [tenantId, limit]
    );
    return (rows as any[]).map(r => ({
      id: r.id, invoiceNumber: r.invoiceNumber, supplierName: r.supplierName,
      total: Number(r.total), purchaseDate: r.purchaseDate,
      arrivalAt: r.arrivalAt, receivedAt: r.receivedAt,
      sedeId: r.sedeId, sedeName: r.sedeName, itemCount: Number(r.itemCount),
      state: r.receivedAt ? 'recibida' : r.arrivalAt ? 'en_descargue' : 'por_llegar',
    }));
  }

  /** Tiempo de recepción promedio por proveedor (llegada→almacenado). */
  async receptionAnalytics(tenantId: string, days = 90) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT supplier_id AS supplierId, supplier_name AS supplierName,
              COUNT(*) AS receptions,
              ROUND(AVG(TIMESTAMPDIFF(MINUTE, arrival_at, received_at)), 1) AS avgMinutes
         FROM purchase_invoices
        WHERE tenant_id = ? AND arrival_at IS NOT NULL AND received_at IS NOT NULL
          AND received_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY supplier_id, supplier_name
        ORDER BY avgMinutes DESC`,
      [tenantId, days]
    );
    const [[pending]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS n FROM purchase_invoices
        WHERE tenant_id = ? AND arrival_at IS NOT NULL AND received_at IS NULL`,
      [tenantId]
    ) as any;
    return {
      suppliers: (rows as any[]).map(r => ({
        supplierId: r.supplierId, supplierName: r.supplierName,
        receptions: Number(r.receptions), avgMinutes: r.avgMinutes != null ? Number(r.avgMinutes) : null,
      })),
      pendingReception: Number(pending?.n) || 0,
    };
  }
}

export default new OpsTimelineService();
