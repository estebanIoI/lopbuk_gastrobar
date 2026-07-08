/**
 * Multibodega — stock por sede y transferencias entre bodegas.
 *
 * Modelo: products.stock sigue siendo el TOTAL consolidado (fuente de verdad de
 * todos los flujos existentes: ventas, compras, merma, restbar…). sede_stock es
 * el DESGLOSE de ese total por sede/bodega.
 *  - Distribuir: asigna desglose sin tocar el total (valida suma ≤ total).
 *  - Transferir: mueve desglose entre sedes; el total no cambia (la auditoría
 *    vive en stock_transfers: quién solicitó/envió/recibió y cuándo).
 *  - Vender: el flujo de ventas descuenta total + desglose de la sede de la venta.
 */
import { v4 as uuidv4 } from 'uuid';
import { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise';
import pool from '../../config/database';
import { AppError } from '../../common/middleware';

export interface TransferItem {
  productId: string;
  productName: string;
  quantity: number;
}

class SedesService {
  // ── Sedes ──────────────────────────────────────────────────────────────────

  async listSedes(tenantId: string, includeInactive = false) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT s.id, s.name, s.address, s.type, s.phone, s.is_active AS isActive,
              s.manager_id AS managerId, m.name AS managerName, s.created_at AS createdAt,
              (SELECT COUNT(*) FROM users u WHERE u.sede_id = s.id AND u.is_active = 1) AS staffCount
         FROM sedes s
         LEFT JOIN users m ON m.id = s.manager_id
        WHERE s.tenant_id = ?${includeInactive ? '' : ' AND s.is_active = 1'}
        ORDER BY s.created_at ASC`,
      [tenantId]
    );
    return rows;
  }

  // ── Stock por sede ─────────────────────────────────────────────────────────

  /** Desglose de stock de TODOS los productos por sede (matriz para el inventario). */
  async getStockMatrix(tenantId: string, search?: string, limit = 300) {
    const params: any[] = [tenantId];
    let where = 'p.tenant_id = ?';
    if (search) {
      where += ' AND p.name LIKE ?';
      params.push(`%${search}%`);
    }
    params.push(limit);
    const [products] = await pool.query<RowDataPacket[]>(
      `SELECT p.id, p.name, p.stock AS totalStock, p.sede_id AS defaultSedeId
         FROM products p
        WHERE ${where}
        ORDER BY p.name ASC
        LIMIT ?`,
      params
    );
    if (!products.length) return { products: [], breakdown: {} };

    const ids = products.map(p => p.id);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT product_id AS productId, sede_id AS sedeId, stock, reserved_stock AS reservedStock,
              min_stock AS minStock, warehouse_location AS warehouseLocation
         FROM sede_stock
        WHERE tenant_id = ? AND product_id IN (?)`,
      [tenantId, ids]
    );
    const breakdown: Record<string, { sedeId: string; stock: number; reservedStock: number; minStock: number; warehouseLocation: string | null }[]> = {};
    for (const r of rows) {
      (breakdown[r.productId] ||= []).push({
        sedeId: r.sedeId,
        stock: Number(r.stock),
        reservedStock: Number(r.reservedStock),
        minStock: Number(r.minStock),
        warehouseLocation: r.warehouseLocation || null,
      });
    }
    return {
      products: products.map(p => ({
        id: p.id,
        name: p.name,
        totalStock: Number(p.totalStock),
        defaultSedeId: p.defaultSedeId || null,
        assigned: (breakdown[p.id] || []).reduce((a, b) => a + b.stock, 0),
      })),
      breakdown,
    };
  }

  /** Inventario de UNA sede (lo que físicamente hay allá). */
  async getSedeStock(tenantId: string, sedeId: string) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT ss.product_id AS productId, p.name AS productName, ss.stock,
              ss.reserved_stock AS reservedStock, ss.min_stock AS minStock, p.stock AS totalStock
         FROM sede_stock ss
         JOIN products p ON p.id = ss.product_id
        WHERE ss.tenant_id = ? AND ss.sede_id = ? AND ss.stock > 0
        ORDER BY p.name ASC`,
      [tenantId, sedeId]
    );
    return rows.map(r => ({ ...r, stock: Number(r.stock), reservedStock: Number(r.reservedStock), minStock: Number(r.minStock), totalStock: Number(r.totalStock) }));
  }

  /**
   * Distribuir: fija el desglose de un producto en una sede (ajuste manual).
   * Valida que la suma de desgloses no supere el stock total del producto.
   */
  async setSedeStock(tenantId: string, sedeId: string, productId: string, stock: number, minStock?: number, warehouseLocation?: string | null) {
    if (stock < 0) throw new AppError('El stock no puede ser negativo', 400);
    const [[product]] = await pool.query<RowDataPacket[]>(
      'SELECT id, stock FROM products WHERE id = ? AND tenant_id = ?',
      [productId, tenantId]
    ) as any;
    if (!product) throw new AppError('Producto no encontrado', 404);

    const [[sede]] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM sedes WHERE id = ? AND tenant_id = ?', [sedeId, tenantId]
    ) as any;
    if (!sede) throw new AppError('Sede no encontrada', 404);

    // Suma de las demás sedes + lo nuevo no puede superar el total
    const [[{ otherSum }]] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(stock), 0) AS otherSum
         FROM sede_stock WHERE tenant_id = ? AND product_id = ? AND sede_id != ?`,
      [tenantId, productId, sedeId]
    ) as any;
    const total = Number(product.stock);
    const available = total - Number(otherSum);
    if (stock > available) {
      throw new AppError(
        `Solo hay ${available} unidades sin asignar de este producto (total ${total}). Ajusta el stock total o reduce otras sedes.`,
        400
      );
    }

    await pool.query<ResultSetHeader>(
      `INSERT INTO sede_stock (id, tenant_id, sede_id, product_id, stock, min_stock, warehouse_location)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE stock = VALUES(stock), min_stock = COALESCE(?, min_stock),
                               warehouse_location = COALESCE(?, warehouse_location)`,
      [uuidv4(), tenantId, sedeId, productId, stock, minStock ?? 0, warehouseLocation ?? null, minStock ?? null, warehouseLocation ?? null]
    );
    return { sedeId, productId, stock, available: available - stock };
  }

  // ── Transferencias ─────────────────────────────────────────────────────────

  async listTransfers(tenantId: string, status?: string) {
    const params: any[] = [tenantId];
    let where = 't.tenant_id = ?';
    if (status) { where += ' AND t.status = ?'; params.push(status); }
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT t.id, t.transfer_number AS transferNumber, t.from_sede_id AS fromSedeId,
              t.to_sede_id AS toSedeId, sf.name AS fromSedeName, st.name AS toSedeName,
              t.items, t.status, t.notes,
              ur.name AS requestedByName, us.name AS sentByName, ux.name AS receivedByName,
              t.sent_at AS sentAt, t.received_at AS receivedAt, t.created_at AS createdAt
         FROM stock_transfers t
         LEFT JOIN sedes sf ON sf.id = t.from_sede_id
         LEFT JOIN sedes st ON st.id = t.to_sede_id
         LEFT JOIN users ur ON ur.id = t.requested_by
         LEFT JOIN users us ON us.id = t.sent_by
         LEFT JOIN users ux ON ux.id = t.received_by
        WHERE ${where}
        ORDER BY t.created_at DESC
        LIMIT 100`,
      params
    );
    return rows.map(r => ({ ...r, items: typeof r.items === 'string' ? JSON.parse(r.items) : r.items }));
  }

  async createTransfer(
    tenantId: string,
    userId: string,
    data: { fromSedeId: string; toSedeId: string; items: TransferItem[]; notes?: string }
  ) {
    const { fromSedeId, toSedeId, notes } = data;
    if (fromSedeId === toSedeId) throw new AppError('La sede de origen y destino no pueden ser la misma', 400);
    const items = (data.items || []).filter(i => i.productId && Number(i.quantity) > 0);
    if (!items.length) throw new AppError('La transferencia debe tener al menos un producto', 400);

    const [sedeRows] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM sedes WHERE tenant_id = ? AND id IN (?, ?)', [tenantId, fromSedeId, toSedeId]
    );
    if (sedeRows.length !== 2) throw new AppError('Sede de origen o destino inválida', 400);

    // Validar disponibilidad en la sede de origen (stock - reservado)
    for (const item of items) {
      const [[row]] = await pool.query<RowDataPacket[]>(
        `SELECT stock, reserved_stock FROM sede_stock
          WHERE tenant_id = ? AND sede_id = ? AND product_id = ?`,
        [tenantId, fromSedeId, item.productId]
      ) as any;
      const availableQty = row ? Number(row.stock) - Number(row.reserved_stock) : 0;
      if (availableQty < Number(item.quantity)) {
        throw new AppError(
          `Stock insuficiente de "${item.productName}" en la sede de origen (disponible: ${availableQty}, solicitado: ${item.quantity})`,
          400
        );
      }
    }

    const id = uuidv4();
    const transferNumber = `TRF-${Date.now().toString(36).toUpperCase()}`;
    await pool.query<ResultSetHeader>(
      `INSERT INTO stock_transfers (id, tenant_id, transfer_number, from_sede_id, to_sede_id, items, status, notes, requested_by)
       VALUES (?, ?, ?, ?, ?, ?, 'solicitada', ?, ?)`,
      [id, tenantId, transferNumber, fromSedeId, toSedeId, JSON.stringify(items), notes || null, userId]
    );
    return { id, transferNumber, status: 'solicitada' };
  }

  /**
   * Cascada de estados con efectos en el desglose:
   *  en_transito → descuenta la sede de origen · recibida → suma en destino ·
   *  cancelada estando en_transito → devuelve a origen.
   */
  async setTransferStatus(tenantId: string, userId: string, transferId: string, newStatus: string) {
    const valid = ['en_transito', 'recibida', 'cancelada'];
    if (!valid.includes(newStatus)) throw new AppError('Estado inválido', 400);

    const connection: PoolConnection = await (pool as any).getConnection();
    try {
      await connection.beginTransaction();
      const [[transfer]] = await connection.query<RowDataPacket[]>(
        'SELECT * FROM stock_transfers WHERE id = ? AND tenant_id = ? FOR UPDATE',
        [transferId, tenantId]
      ) as any;
      if (!transfer) throw new AppError('Transferencia no encontrada', 404);

      const allowed: Record<string, string[]> = {
        solicitada: ['en_transito', 'cancelada'],
        en_transito: ['recibida', 'cancelada'],
      };
      if (!allowed[transfer.status]?.includes(newStatus)) {
        throw new AppError(`No se puede pasar de "${transfer.status}" a "${newStatus}"`, 400);
      }

      const items: TransferItem[] = typeof transfer.items === 'string' ? JSON.parse(transfer.items) : transfer.items;

      if (newStatus === 'en_transito') {
        // Sale de la bodega de origen (revalida disponibilidad bajo lock)
        for (const item of items) {
          const [result] = await connection.query<ResultSetHeader>(
            `UPDATE sede_stock SET stock = stock - ?
              WHERE tenant_id = ? AND sede_id = ? AND product_id = ? AND stock - reserved_stock >= ?`,
            [item.quantity, tenantId, transfer.from_sede_id, item.productId, item.quantity]
          );
          if (result.affectedRows === 0) {
            throw new AppError(`Stock insuficiente de "${item.productName}" en la sede de origen`, 400);
          }
        }
        await connection.query(
          `UPDATE stock_transfers SET status = 'en_transito', sent_by = ?, sent_at = NOW() WHERE id = ?`,
          [userId, transferId]
        );
      } else if (newStatus === 'recibida') {
        // Entra a la bodega de destino
        for (const item of items) {
          await connection.query(
            `INSERT INTO sede_stock (id, tenant_id, sede_id, product_id, stock)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE stock = stock + VALUES(stock)`,
            [uuidv4(), tenantId, transfer.to_sede_id, item.productId, item.quantity]
          );
        }
        await connection.query(
          `UPDATE stock_transfers SET status = 'recibida', received_by = ?, received_at = NOW() WHERE id = ?`,
          [userId, transferId]
        );
      } else if (newStatus === 'cancelada') {
        // Si ya salió de origen, la mercancía vuelve
        if (transfer.status === 'en_transito') {
          for (const item of items) {
            await connection.query(
              `INSERT INTO sede_stock (id, tenant_id, sede_id, product_id, stock)
               VALUES (?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE stock = stock + VALUES(stock)`,
              [uuidv4(), tenantId, transfer.from_sede_id, item.productId, item.quantity]
            );
          }
        }
        await connection.query(
          `UPDATE stock_transfers SET status = 'cancelada' WHERE id = ?`, [transferId]
        );
      }

      await connection.commit();
      return { id: transferId, status: newStatus };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  /** Productos bajo su mínimo POR SEDE (alerta de reposición/transferencia). */
  async lowStockBySede(tenantId: string, sedeId?: string) {
    const params: any[] = [tenantId];
    let where = 'ss.tenant_id = ? AND ss.min_stock > 0 AND ss.stock <= ss.min_stock';
    if (sedeId) { where += ' AND ss.sede_id = ?'; params.push(sedeId); }
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT ss.sede_id AS sedeId, s.name AS sedeName, ss.product_id AS productId,
              p.name AS productName, ss.stock, ss.min_stock AS minStock,
              ss.warehouse_location AS warehouseLocation, p.stock AS totalStock
         FROM sede_stock ss
         JOIN sedes s ON s.id = ss.sede_id
         JOIN products p ON p.id = ss.product_id
        WHERE ${where}
        ORDER BY (ss.stock = 0) DESC, ss.stock ASC
        LIMIT 100`,
      params
    );
    return (rows as any[]).map(r => ({
      sedeId: r.sedeId, sedeName: r.sedeName, productId: r.productId, productName: r.productName,
      stock: Number(r.stock), minStock: Number(r.minStock), totalStock: Number(r.totalStock),
      warehouseLocation: r.warehouseLocation || null,
      // ¿hay stock en otra sede para transferir? (total − esta sede)
      availableElsewhere: Number(r.totalStock) - Number(r.stock),
    }));
  }

  // ── Disponibilidad para el POS ─────────────────────────────────────────────

  /** ¿Dónde hay stock de este producto? (para sugerir venta con despacho desde otra sede) */
  async getProductAvailability(tenantId: string, productId: string) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT ss.sede_id AS sedeId, s.name AS sedeName, s.type,
              ss.stock, ss.reserved_stock AS reservedStock
         FROM sede_stock ss
         JOIN sedes s ON s.id = ss.sede_id
        WHERE ss.tenant_id = ? AND ss.product_id = ? AND ss.stock > 0
        ORDER BY ss.stock DESC`,
      [tenantId, productId]
    );
    return rows.map(r => ({ ...r, stock: Number(r.stock), reservedStock: Number(r.reservedStock), available: Number(r.stock) - Number(r.reservedStock) }));
  }
}

export default new SedesService();
