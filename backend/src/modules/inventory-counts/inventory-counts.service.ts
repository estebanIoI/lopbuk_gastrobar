/**
 * Conteo cíclico de inventario — exactitud físico vs. sistema (criterio "99%").
 *
 * Flujo:
 *   1) Abrir conteo por sede → CONGELA el esperado (snapshot de sede_stock o,
 *      sin sede, de products.stock).
 *   2) El auxiliar captura lo contado ítem por ítem.
 *   3) Cerrar → aplica el ajuste AUDITADO: lleva el sistema a lo contado,
 *      genera stock_movements 'ajuste', y calcula la exactitud (% de ítems
 *      sin diferencia).
 *
 * Multibodega: si el conteo es de una sede, ajusta sede_stock de esa sede Y el
 * total products.stock por la misma diferencia (mantiene ambos coherentes).
 */
import { v4 as uuidv4 } from 'uuid';
import { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise';
import pool from '../../config/database';
import { AppError } from '../../common/middleware';

class InventoryCountsService {
  private async generateNumber(tenantId: string): Promise<string> {
    const [[row]] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS n FROM inventory_counts WHERE tenant_id = ?', [tenantId]
    ) as any;
    return `CNT-${String(Number(row.n) + 1).padStart(5, '0')}`;
  }

  /** Abre un conteo y congela el esperado. Si hay sede → sede_stock; si no → products.stock. */
  async create(tenantId: string, userId: string, data: { sedeId?: string | null; search?: string; notes?: string }) {
    const sedeId = data.sedeId || null;
    let rows: RowDataPacket[];

    if (sedeId) {
      const [[sede]] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM sedes WHERE id = ? AND tenant_id = ?', [sedeId, tenantId]
      ) as any;
      if (!sede) throw new AppError('Sede no encontrada', 404);
      const params: any[] = [sedeId, tenantId];
      let where = 'ss.sede_id = ? AND ss.tenant_id = ?';
      if (data.search) { where += ' AND p.name LIKE ?'; params.push(`%${data.search}%`); }
      [rows] = await pool.query<RowDataPacket[]>(
        `SELECT ss.product_id AS productId, p.name AS productName,
                ss.stock AS expectedQty, ss.warehouse_location AS warehouseLocation
           FROM sede_stock ss JOIN products p ON p.id = ss.product_id
          WHERE ${where}
          ORDER BY p.name ASC`,
        params
      );
    } else {
      const params: any[] = [tenantId];
      let where = 'tenant_id = ?';
      if (data.search) { where += ' AND name LIKE ?'; params.push(`%${data.search}%`); }
      [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id AS productId, name AS productName, stock AS expectedQty, location_in_store AS warehouseLocation
           FROM products WHERE ${where} ORDER BY name ASC`,
        params
      );
    }

    if (!rows.length) throw new AppError('No hay productos para contar con ese criterio', 400);

    const id = uuidv4();
    const countNumber = await this.generateNumber(tenantId);
    await pool.query<ResultSetHeader>(
      `INSERT INTO inventory_counts (id, tenant_id, count_number, sede_id, status, items_total, notes, created_by)
       VALUES (?, ?, ?, ?, 'abierto', ?, ?, ?)`,
      [id, tenantId, countNumber, sedeId, rows.length, data.notes || null, userId]
    );
    // Insertar ítems en lote
    const values = rows.map(r => [uuidv4(), tenantId, id, r.productId, r.productName, r.warehouseLocation || null, Number(r.expectedQty)]);
    await pool.query(
      `INSERT INTO inventory_count_items (id, tenant_id, count_id, product_id, product_name, warehouse_location, expected_qty)
       VALUES ?`, [values]
    );
    return { id, countNumber, itemsTotal: rows.length, sedeId };
  }

  async list(tenantId: string) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT c.id, c.count_number AS countNumber, c.sede_id AS sedeId, s.name AS sedeName,
              c.status, c.accuracy_pct AS accuracyPct, c.items_total AS itemsTotal,
              c.items_counted AS itemsCounted, c.items_diff AS itemsDiff, c.notes,
              c.created_at AS createdAt, c.closed_at AS closedAt
         FROM inventory_counts c
         LEFT JOIN sedes s ON s.id = c.sede_id
        WHERE c.tenant_id = ?
        ORDER BY c.created_at DESC
        LIMIT 100`,
      [tenantId]
    );
    return (rows as any[]).map(r => ({ ...r, accuracyPct: r.accuracyPct != null ? Number(r.accuracyPct) : null }));
  }

  async getItems(tenantId: string, countId: string) {
    const [[count]] = await pool.query<RowDataPacket[]>(
      `SELECT c.*, s.name AS sedeName FROM inventory_counts c LEFT JOIN sedes s ON s.id = c.sede_id
        WHERE c.id = ? AND c.tenant_id = ?`, [countId, tenantId]
    ) as any;
    if (!count) throw new AppError('Conteo no encontrado', 404);
    const [items] = await pool.query<RowDataPacket[]>(
      `SELECT id, product_id AS productId, product_name AS productName, warehouse_location AS warehouseLocation,
              expected_qty AS expectedQty, counted_qty AS countedQty
         FROM inventory_count_items WHERE count_id = ? ORDER BY product_name ASC`,
      [countId]
    );
    return {
      count: {
        id: count.id, countNumber: count.count_number, sedeId: count.sede_id, sedeName: count.sedeName,
        status: count.status, accuracyPct: count.accuracy_pct != null ? Number(count.accuracy_pct) : null,
        itemsTotal: count.items_total, itemsCounted: count.items_counted, itemsDiff: count.items_diff, notes: count.notes,
      },
      items: (items as any[]).map(i => {
        const expected = Number(i.expectedQty);
        const counted = i.countedQty != null ? Number(i.countedQty) : null;
        return {
          id: i.id, productId: i.productId, productName: i.productName, warehouseLocation: i.warehouseLocation,
          expectedQty: expected, countedQty: counted,
          difference: counted != null ? counted - expected : null,
        };
      }),
    };
  }

  /** Captura la cantidad contada de un ítem (solo con conteo abierto). */
  async setCounted(tenantId: string, countId: string, itemId: string, countedQty: number | null) {
    const [[count]] = await pool.query<RowDataPacket[]>(
      'SELECT status FROM inventory_counts WHERE id = ? AND tenant_id = ?', [countId, tenantId]
    ) as any;
    if (!count) throw new AppError('Conteo no encontrado', 404);
    if (count.status !== 'abierto') throw new AppError('El conteo ya está cerrado', 400);

    await pool.query(
      `UPDATE inventory_count_items SET counted_qty = ? WHERE id = ? AND count_id = ? AND tenant_id = ?`,
      [countedQty, itemId, countId, tenantId]
    );
    // Recalcular contadores del conteo
    const [[agg]] = await pool.query<RowDataPacket[]>(
      `SELECT SUM(counted_qty IS NOT NULL) AS counted,
              SUM(counted_qty IS NOT NULL AND counted_qty <> expected_qty) AS diff
         FROM inventory_count_items WHERE count_id = ?`, [countId]
    ) as any;
    await pool.query(
      `UPDATE inventory_counts SET items_counted = ?, items_diff = ? WHERE id = ?`,
      [Number(agg.counted) || 0, Number(agg.diff) || 0, countId]
    );
    return { itemId, countedQty };
  }

  /**
   * Cierra el conteo: aplica el ajuste auditado de cada ítem contado con
   * diferencia, calcula la exactitud y deja el conteo inmutable.
   */
  async close(tenantId: string, countId: string, userId: string) {
    const connection: PoolConnection = await (pool as any).getConnection();
    try {
      await connection.beginTransaction();
      const [[count]] = await connection.query<RowDataPacket[]>(
        'SELECT * FROM inventory_counts WHERE id = ? AND tenant_id = ? FOR UPDATE', [countId, tenantId]
      ) as any;
      if (!count) throw new AppError('Conteo no encontrado', 404);
      if (count.status !== 'abierto') throw new AppError('El conteo ya está cerrado', 400);

      const [items] = await connection.query<RowDataPacket[]>(
        `SELECT product_id AS productId, product_name AS productName, expected_qty AS expectedQty, counted_qty AS countedQty
           FROM inventory_count_items WHERE count_id = ? AND counted_qty IS NOT NULL`,
        [countId]
      );
      const counted = items as any[];
      if (!counted.length) throw new AppError('No hay ítems contados para cerrar', 400);

      let matches = 0;
      let adjusted = 0;
      for (const it of counted) {
        const expected = Number(it.expectedQty);
        const real = Number(it.countedQty);
        const diff = real - expected; // + sobrante, − faltante
        if (diff === 0) { matches++; continue; }
        adjusted++;

        // Ajustar total products.stock por la diferencia
        const [[prod]] = await connection.query<RowDataPacket[]>(
          'SELECT stock FROM products WHERE id = ? FOR UPDATE', [it.productId]
        ) as any;
        const prevTotal = Number(prod?.stock ?? 0);
        await connection.query(
          'UPDATE products SET stock = GREATEST(0, stock + ?) WHERE id = ? AND tenant_id = ?',
          [diff, it.productId, tenantId]
        );
        // Ajustar el desglose de la sede al valor contado (verdad física de esa bodega)
        if (count.sede_id) {
          await connection.query(
            `INSERT INTO sede_stock (id, tenant_id, sede_id, product_id, stock)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE stock = VALUES(stock)`,
            [uuidv4(), tenantId, count.sede_id, it.productId, real]
          );
        }
        // Movimiento auditado
        await connection.query(
          `INSERT INTO stock_movements (id, tenant_id, product_id, type, quantity, previous_stock, new_stock, reason, reference_id, user_id)
           VALUES (?, ?, ?, 'ajuste', ?, ?, ?, ?, ?, ?)`,
          [uuidv4(), tenantId, it.productId, Math.abs(diff), prevTotal, Math.max(0, prevTotal + diff),
           `Conteo ${count.count_number}${count.sede_id ? ' (sede)' : ''}`, countId, userId]
        );
      }

      const accuracy = counted.length > 0 ? Math.round((matches / counted.length) * 10000) / 100 : 100;
      await connection.query(
        `UPDATE inventory_counts
            SET status = 'cerrado', accuracy_pct = ?, items_counted = ?, items_diff = ?, closed_by = ?, closed_at = NOW()
          WHERE id = ?`,
        [accuracy, counted.length, adjusted, userId, countId]
      );

      await connection.commit();
      return { id: countId, status: 'cerrado', accuracyPct: accuracy, itemsCounted: counted.length, itemsAdjusted: adjusted };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  async cancel(tenantId: string, countId: string) {
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE inventory_counts SET status = 'cancelado' WHERE id = ? AND tenant_id = ? AND status = 'abierto'`,
      [countId, tenantId]
    );
    if (result.affectedRows === 0) throw new AppError('El conteo no se puede cancelar', 400);
    return { id: countId, status: 'cancelado' };
  }

  /** Exactitud promedio de los conteos cerrados en el período (para Gerencia). */
  async accuracy(tenantId: string, days = 90) {
    const [[row]] = await pool.query<RowDataPacket[]>(
      `SELECT ROUND(AVG(accuracy_pct), 1) AS avgAccuracy, COUNT(*) AS counts
         FROM inventory_counts
        WHERE tenant_id = ? AND status = 'cerrado'
          AND closed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [tenantId, days]
    ) as any;
    return {
      avgAccuracy: row?.avgAccuracy != null ? Number(row.avgAccuracy) : null,
      counts: Number(row?.counts) || 0,
    };
  }
}

export default new InventoryCountsService();
