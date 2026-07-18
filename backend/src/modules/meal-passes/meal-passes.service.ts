import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config';
import { AppError } from '../../common/middleware';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

/**
 * Tiqueteras / Meal Pass (Fase 4 GastroBar).
 *
 * Un cliente compra N almuerzos por adelantado y los consume hasta agotarse. El
 * saldo (`remaining`) se decrementa transaccionalmente; cada movimiento queda con
 * `balance_after` para auditoría. Guardas: no se consume de una tiquetera
 * agotada/vencida/anulada, ni por debajo de 0.
 *
 * La integración con el POS/cobro (asignar ítems a tiquetera) es F5; aquí el
 * módulo es autónomo (CRUD + búsqueda + recarga + consumo + historial).
 */

export type MealPassStatus = 'activa' | 'agotada' | 'vencida' | 'anulada';
export type MovementType = 'recarga' | 'consumo' | 'ajuste' | 'anulacion';

export interface MealPass {
  id: string;
  customerName: string;
  document: string | null;
  phone: string | null;
  convenio: string | null;
  empresa: string | null;
  totalMeals: number;
  remaining: number;
  purchasedAt: string | null;
  expiresAt: string | null;
  status: MealPassStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MealPassInput {
  customerName: string;
  document?: string | null;
  phone?: string | null;
  convenio?: string | null;
  empresa?: string | null;
  totalMeals?: number;      // almuerzos iniciales (recarga de apertura)
  purchasedAt?: string | null;
  expiresAt?: string | null;
  notes?: string | null;
}

function mapPass(r: any): MealPass {
  return {
    id: r.id,
    customerName: r.customer_name,
    document: r.document || null,
    phone: r.phone || null,
    convenio: r.convenio || null,
    empresa: r.empresa || null,
    totalMeals: Number(r.total_meals) || 0,
    remaining: Number(r.remaining) || 0,
    purchasedAt: r.purchased_at || null,
    expiresAt: r.expires_at || null,
    status: r.status,
    notes: r.notes || null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** ¿La tiquetera está vencida por fecha? (a partir de expires_at) */
function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < new Date(new Date().toISOString().slice(0, 10)).getTime();
}

/** Estado derivado real desde saldo + vencimiento (no pisa 'anulada'). */
function deriveStatus(remaining: number, expiresAt: string | null, current: MealPassStatus): MealPassStatus {
  if (current === 'anulada') return 'anulada';
  if (isExpired(expiresAt)) return 'vencida';
  if (remaining <= 0) return 'agotada';
  return 'activa';
}

export class MealPassesService {
  async list(tenantId: string, opts: { search?: string; status?: string } = {}): Promise<MealPass[]> {
    const where: string[] = ['tenant_id = ?', 'is_active = 1'];
    const vals: any[] = [tenantId];
    if (opts.status) { where.push('status = ?'); vals.push(opts.status); }
    if (opts.search) {
      // Búsqueda rápida: nombre / documento / teléfono / convenio / empresa
      where.push('(customer_name LIKE ? OR document LIKE ? OR phone LIKE ? OR convenio LIKE ? OR empresa LIKE ?)');
      const s = `%${opts.search}%`;
      vals.push(s, s, s, s, s);
    }
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT * FROM meal_passes WHERE ${where.join(' AND ')} ORDER BY updated_at DESC LIMIT 200`,
      vals
    );
    return rows.map(mapPass);
  }

  async findById(tenantId: string, id: string): Promise<MealPass> {
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT * FROM meal_passes WHERE id = ? AND tenant_id = ? AND is_active = 1',
      [id, tenantId]
    );
    if (rows.length === 0) throw new AppError('Tiquetera no encontrada', 404);
    return mapPass(rows[0]);
  }

  private validate(input: MealPassInput) {
    if (!input.customerName || !input.customerName.trim()) throw new AppError('El nombre del cliente es requerido', 400);
    if (input.totalMeals != null && Number(input.totalMeals) < 0) throw new AppError('Los almuerzos no pueden ser negativos', 400);
  }

  async create(tenantId: string, input: MealPassInput): Promise<MealPass> {
    this.validate(input);
    const id = uuidv4();
    const initial = Math.max(0, Number(input.totalMeals) || 0);
    const status = deriveStatus(initial, input.expiresAt || null, 'activa');
    await db.execute(
      `INSERT INTO meal_passes
        (id, tenant_id, customer_name, document, phone, convenio, empresa, total_meals, remaining, purchased_at, expires_at, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, tenantId, input.customerName.trim(), input.document?.trim() || null, input.phone?.trim() || null,
        input.convenio?.trim() || null, input.empresa?.trim() || null, initial, initial,
        input.purchasedAt || null, input.expiresAt || null, status, input.notes?.trim() || null,
      ]
    );
    // Movimiento de recarga inicial (si arrancó con saldo)
    if (initial > 0) {
      await db.execute(
        `INSERT INTO meal_pass_movements (id, meal_pass_id, type, meals, balance_after, note)
         VALUES (?, ?, 'recarga', ?, ?, 'Apertura de tiquetera')`,
        [uuidv4(), id, initial, initial]
      );
    }
    return this.findById(tenantId, id);
  }

  async update(tenantId: string, id: string, input: MealPassInput): Promise<MealPass> {
    const current = await this.findById(tenantId, id);
    this.validate(input);
    const status = deriveStatus(current.remaining, input.expiresAt ?? current.expiresAt, current.status);
    await db.execute(
      `UPDATE meal_passes SET customer_name = ?, document = ?, phone = ?, convenio = ?, empresa = ?,
              purchased_at = ?, expires_at = ?, notes = ?, status = ?
        WHERE id = ? AND tenant_id = ?`,
      [
        input.customerName.trim(), input.document?.trim() || null, input.phone?.trim() || null,
        input.convenio?.trim() || null, input.empresa?.trim() || null,
        input.purchasedAt ?? current.purchasedAt, input.expiresAt ?? current.expiresAt,
        input.notes?.trim() ?? current.notes, status, id, tenantId,
      ]
    );
    return this.findById(tenantId, id);
  }

  /** Recarga: suma almuerzos y registra el movimiento (transaccional). */
  async recharge(tenantId: string, id: string, meals: number, note?: string): Promise<MealPass> {
    const n = Math.floor(Number(meals));
    if (!n || n <= 0) throw new AppError('La cantidad a recargar debe ser mayor a 0', 400);
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.execute<RowDataPacket[]>(
        'SELECT * FROM meal_passes WHERE id = ? AND tenant_id = ? AND is_active = 1 FOR UPDATE',
        [id, tenantId]
      );
      if (rows.length === 0) throw new AppError('Tiquetera no encontrada', 404);
      if (rows[0].status === 'anulada') throw new AppError('La tiquetera está anulada', 409);
      const newRemaining = Number(rows[0].remaining) + n;
      const newTotal = Number(rows[0].total_meals) + n;
      const status = deriveStatus(newRemaining, rows[0].expires_at, rows[0].status);
      await conn.execute(
        'UPDATE meal_passes SET remaining = ?, total_meals = ?, status = ? WHERE id = ?',
        [newRemaining, newTotal, status, id]
      );
      await conn.execute(
        `INSERT INTO meal_pass_movements (id, meal_pass_id, type, meals, balance_after, note)
         VALUES (?, ?, 'recarga', ?, ?, ?)`,
        [uuidv4(), id, n, newRemaining, note?.slice(0, 255) || null]
      );
      await conn.commit();
    } catch (e) { await conn.rollback(); throw e; }
    finally { conn.release(); }
    return this.findById(tenantId, id);
  }

  /**
   * Consumo: descuenta `meals` del saldo con guardas (activa, no vencida, saldo
   * suficiente). Transaccional con FOR UPDATE para evitar doble descuento en
   * concurrencia. F5 la llamará desde el cobro con order_id/order_item_id.
   */
  async consume(
    tenantId: string, id: string, meals: number,
    ctx: { orderId?: string; orderItemId?: string; tableNumber?: string; employeeId?: string; employeeName?: string; note?: string } = {}
  ): Promise<{ pass: MealPass; consumed: number }> {
    const n = Math.floor(Number(meals));
    if (!n || n <= 0) throw new AppError('La cantidad a consumir debe ser mayor a 0', 400);
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.execute<RowDataPacket[]>(
        'SELECT * FROM meal_passes WHERE id = ? AND tenant_id = ? AND is_active = 1 FOR UPDATE',
        [id, tenantId]
      );
      if (rows.length === 0) throw new AppError('Tiquetera no encontrada', 404);
      const p = rows[0];
      if (p.status === 'anulada') throw new AppError('La tiquetera está anulada', 409);
      if (isExpired(p.expires_at)) throw new AppError('La tiquetera está vencida', 409);
      if (Number(p.remaining) < n) throw new AppError(`Saldo insuficiente: quedan ${p.remaining} almuerzos`, 409);

      const newRemaining = Number(p.remaining) - n;
      const status = deriveStatus(newRemaining, p.expires_at, p.status);
      await conn.execute('UPDATE meal_passes SET remaining = ?, status = ? WHERE id = ?', [newRemaining, status, id]);
      await conn.execute(
        `INSERT INTO meal_pass_movements
          (id, meal_pass_id, type, meals, balance_after, order_id, order_item_id, table_number, employee_id, employee_name, note)
         VALUES (?, ?, 'consumo', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), id, -n, newRemaining, ctx.orderId || null, ctx.orderItemId || null,
         ctx.tableNumber || null, ctx.employeeId || null, ctx.employeeName || null, ctx.note?.slice(0, 255) || null]
      );
      await conn.commit();
    } catch (e) { await conn.rollback(); throw e; }
    finally { conn.release(); }
    return { pass: await this.findById(tenantId, id), consumed: n };
  }

  /** Anula la tiquetera (soft): queda como referencia, no consume más. */
  async annul(tenantId: string, id: string, note?: string): Promise<MealPass> {
    const p = await this.findById(tenantId, id);
    await db.execute("UPDATE meal_passes SET status = 'anulada' WHERE id = ? AND tenant_id = ?", [id, tenantId]);
    await db.execute(
      `INSERT INTO meal_pass_movements (id, meal_pass_id, type, meals, balance_after, note)
       VALUES (?, ?, 'anulacion', 0, ?, ?)`,
      [uuidv4(), id, p.remaining, note?.slice(0, 255) || 'Tiquetera anulada']
    );
    return this.findById(tenantId, id);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const [r] = await db.execute<ResultSetHeader>(
      'UPDATE meal_passes SET is_active = 0 WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (r.affectedRows === 0) throw new AppError('Tiquetera no encontrada', 404);
  }

  /** Historial de movimientos (recargas y consumos) de una tiquetera. */
  async getMovements(tenantId: string, id: string): Promise<any[]> {
    await this.findById(tenantId, id); // valida pertenencia
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT id, type, meals, balance_after AS balanceAfter, order_id AS orderId, order_item_id AS orderItemId,
              table_number AS tableNumber, employee_id AS employeeId, employee_name AS employeeName, note, created_at AS createdAt
         FROM meal_pass_movements WHERE meal_pass_id = ? ORDER BY created_at DESC`,
      [id]
    );
    return rows.map((r: any) => ({ ...r, meals: Number(r.meals), balanceAfter: Number(r.balanceAfter) }));
  }
}

export const mealPassesService = new MealPassesService();
