import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config';
import { CashSession, CashMovement, CashSessionStatus, ClosingStatus, PaginatedResponse } from '../../common/types';
import { AppError } from '../../common/middleware';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

interface CashSessionRow extends RowDataPacket {
  id: string;
  opened_by: string;
  opened_by_name: string;
  opening_amount: number;
  opened_at: Date;
  closed_by: string | null;
  closed_by_name: string | null;
  closed_at: Date | null;
  total_cash_sales: number;
  total_card_sales: number;
  total_transfer_sales: number;
  total_fiado_sales: number;
  total_credit_payments_efectivo: number;
  total_credit_payments_tarjeta: number;
  total_credit_payments_transfer: number;
  total_sales_count: number;
  total_change_given: number;
  total_cash_entries: number;
  total_cash_withdrawals: number;
  expected_cash: number | null;
  actual_cash: number | null;
  difference: number | null;
  status: CashSessionStatus;
  closing_status: ClosingStatus | null;
  observations: string | null;
  created_at: Date;
  updated_at: Date;
}

interface CashMovementRow extends RowDataPacket {
  id: string;
  session_id: string;
  type: 'entrada' | 'salida';
  amount: number;
  reason: string;
  notes: string | null;
  created_by: string;
  created_by_name: string;
  created_at: Date;
}

interface CountRow extends RowDataPacket {
  total: number;
}

interface SalesTotalRow extends RowDataPacket {
  payment_method: string;
  total_amount: number;
  total_change: number;
  count: number;
}

interface MovementTotalRow extends RowDataPacket {
  type: string;
  total: number;
}

interface CreditPaymentTotalRow extends RowDataPacket {
  payment_method: string;
  total_amount: number;
}

export interface CashSessionFilters {
  status?: CashSessionStatus;
}

export interface CashSessionTotals {
  cashSales: number;
  cardSales: number;
  transferSales: number;
  fiadoSales: number;
  mixedSales: number;
  mixedEfectivoTotal: number;
  mixedSecondTotal: number;
  salesCount: number;
  changeGiven: number;
  cashEntries: number;
  cashWithdrawals: number;
  creditPaymentsEfectivo: number;
  creditPaymentsTarjeta: number;
  creditPaymentsTransferencia: number;
  creditPaymentsTotal: number;
}

export class CashSessionsService {
  private mapSession(row: CashSessionRow): CashSession {
    return {
      id: row.id,
      openedBy: row.opened_by,
      openedByName: row.opened_by_name,
      openingAmount: Number(row.opening_amount),
      openedAt: row.opened_at,
      closedBy: row.closed_by || undefined,
      closedByName: row.closed_by_name || undefined,
      closedAt: row.closed_at || undefined,
      totalCashSales: Number(row.total_cash_sales),
      totalCardSales: Number(row.total_card_sales),
      totalTransferSales: Number(row.total_transfer_sales),
      totalFiadoSales: Number(row.total_fiado_sales),
      totalCreditPaymentsEfectivo: Number(row.total_credit_payments_efectivo) || 0,
      totalCreditPaymentsTarjeta: Number(row.total_credit_payments_tarjeta) || 0,
      totalCreditPaymentsTransferencia: Number(row.total_credit_payments_transfer) || 0,
      totalSalesCount: Number(row.total_sales_count),
      totalChangeGiven: Number(row.total_change_given),
      totalCashEntries: Number(row.total_cash_entries),
      totalCashWithdrawals: Number(row.total_cash_withdrawals),
      expectedCash: row.expected_cash != null ? Number(row.expected_cash) : undefined,
      actualCash: row.actual_cash != null ? Number(row.actual_cash) : undefined,
      difference: row.difference != null ? Number(row.difference) : undefined,
      status: row.status,
      closingStatus: row.closing_status || undefined,
      observations: row.observations || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapMovement(row: CashMovementRow): CashMovement {
    return {
      id: row.id,
      sessionId: row.session_id,
      type: row.type,
      amount: Number(row.amount),
      reason: row.reason,
      notes: row.notes || undefined,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      createdAt: row.created_at,
    };
  }

  async getActiveSession(tenantId: string): Promise<CashSession | null> {
    const [rows] = await db.execute<CashSessionRow[]>(
      'SELECT * FROM cash_sessions WHERE tenant_id = ? AND status = ? LIMIT 1',
      [tenantId, 'abierta']
    );

    if (rows.length === 0) return null;
    return this.mapSession(rows[0]);
  }

  async findById(id: string): Promise<CashSession> {
    const [rows] = await db.execute<CashSessionRow[]>(
      'SELECT * FROM cash_sessions WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      throw new AppError('Sesion de caja no encontrada', 404);
    }

    return this.mapSession(rows[0]);
  }

  async findAll(
    tenantId: string,
    page = 1,
    limit = 10,
    filters?: CashSessionFilters
  ): Promise<PaginatedResponse<CashSession>> {
    const offset = (page - 1) * limit;
    const conditions: string[] = ['tenant_id = ?'];
    const values: (string | number)[] = [tenantId];

    if (filters?.status) {
      conditions.push('status = ?');
      values.push(filters.status);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const [countResult] = await db.execute<CountRow[]>(
      `SELECT COUNT(*) as total FROM cash_sessions ${whereClause}`,
      values
    );
    const total = countResult[0].total;

    const [rows] = await db.execute<CashSessionRow[]>(
      `SELECT * FROM cash_sessions ${whereClause} ORDER BY opened_at DESC LIMIT ? OFFSET ?`,
      [...values, String(limit), String(offset)]
    );

    return {
      data: rows.map((row) => this.mapSession(row)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async openSession(
    tenantId: string,
    userId: string,
    userName: string,
    openingAmount: number
  ): Promise<CashSession> {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      // Check no open session exists for this tenant (with lock)
      const [existing] = await connection.execute<CashSessionRow[]>(
        'SELECT id FROM cash_sessions WHERE tenant_id = ? AND status = ? FOR UPDATE',
        [tenantId, 'abierta']
      );

      if (existing.length > 0) {
        throw new AppError('Ya existe una sesion de caja abierta. Cierre la sesion actual antes de abrir una nueva.', 400);
      }

      const id = uuidv4();

      await connection.execute<ResultSetHeader>(
        `INSERT INTO cash_sessions (id, tenant_id, opened_by, opened_by_name, opening_amount, status)
         VALUES (?, ?, ?, ?, ?, 'abierta')`,
        [id, tenantId, userId, userName, openingAmount]
      );

      await connection.commit();

      return this.findById(id);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async addCashMovement(
    tenantId: string,
    sessionId: string,
    type: 'entrada' | 'salida',
    amount: number,
    reason: string,
    notes: string | undefined,
    userId: string,
    userName: string
  ): Promise<CashMovement> {
    // Verify session is open
    const session = await this.findById(sessionId);
    if (session.status !== 'abierta') {
      throw new AppError('La sesion de caja ya esta cerrada', 400);
    }

    const id = uuidv4();

    await db.execute<ResultSetHeader>(
      `INSERT INTO cash_movements (id, tenant_id, session_id, type, amount, reason, notes, created_by, created_by_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, tenantId, sessionId, type, amount, reason, notes || null, userId, userName]
    );

    const [rows] = await db.execute<CashMovementRow[]>(
      'SELECT * FROM cash_movements WHERE id = ?',
      [id]
    );

    return this.mapMovement(rows[0]);
  }

  async getSessionMovements(sessionId: string): Promise<CashMovement[]> {
    const [rows] = await db.execute<CashMovementRow[]>(
      'SELECT * FROM cash_movements WHERE session_id = ? ORDER BY created_at DESC',
      [sessionId]
    );

    return rows.map((row) => this.mapMovement(row));
  }

  async calculateSessionTotals(sessionId: string): Promise<CashSessionTotals> {
    // Sum sales by payment method
    const [salesRows] = await db.execute<SalesTotalRow[]>(
      `SELECT payment_method,
              COALESCE(SUM(total), 0) as total_amount,
              COALESCE(SUM(change_amount), 0) as total_change,
              COALESCE(SUM(mixed_efectivo_amount), 0) as total_mixed_efectivo,
              COALESCE(SUM(mixed_second_amount), 0) as total_mixed_second,
              COUNT(*) as count
       FROM sales
       WHERE cash_session_id = ? AND status = 'completada'
       GROUP BY payment_method`,
      [sessionId]
    );

    let cashSales = 0;
    let cardSales = 0;
    let transferSales = 0;
    let fiadoSales = 0;
    let mixedSales = 0;
    let mixedEfectivoTotal = 0;
    let mixedSecondTotal = 0;
    let salesCount = 0;
    let changeGiven = 0;

    for (const row of salesRows) {
      const amount = Number(row.total_amount);
      salesCount += Number(row.count);

      switch (row.payment_method) {
        case 'efectivo':
          cashSales = amount;
          changeGiven = Number(row.total_change);
          break;
        case 'tarjeta':
        case 'addi':
        case 'sistecredito':
          cardSales += amount;
          break;
        case 'transferencia':
          transferSales += amount;
          break;
        case 'mixto':
          mixedSales += amount;
          mixedEfectivoTotal += Number((row as any).total_mixed_efectivo || 0);
          mixedSecondTotal += Number((row as any).total_mixed_second || 0);
          break;
        case 'fiado':
          fiadoSales = amount;
          break;
      }
    }

    // Sum cash movements
    const [movementRows] = await db.execute<MovementTotalRow[]>(
      `SELECT type, COALESCE(SUM(amount), 0) as total
       FROM cash_movements
       WHERE session_id = ?
       GROUP BY type`,
      [sessionId]
    );

    let cashEntries = 0;
    let cashWithdrawals = 0;

    for (const row of movementRows) {
      if (row.type === 'entrada') cashEntries = Number(row.total);
      if (row.type === 'salida') cashWithdrawals = Number(row.total);
    }

    // Sum credit payments (abonos de fiados) registered during this session
    const [creditRows] = await db.execute<CreditPaymentTotalRow[]>(
      `SELECT cp.payment_method, COALESCE(SUM(cp.amount), 0) as total_amount
       FROM credit_payments cp
       JOIN cash_sessions cs ON cs.tenant_id = cp.tenant_id
       WHERE cs.id = ?
         AND cp.created_at >= cs.opened_at
         AND cp.created_at <= COALESCE(cs.closed_at, NOW())
       GROUP BY cp.payment_method`,
      [sessionId]
    );

    let creditPaymentsEfectivo = 0;
    let creditPaymentsTarjeta = 0;
    let creditPaymentsTransferencia = 0;

    for (const row of creditRows) {
      const amount = Number(row.total_amount);
      if (row.payment_method === 'efectivo') creditPaymentsEfectivo = amount;
      else if (row.payment_method === 'tarjeta') creditPaymentsTarjeta = amount;
      else if (row.payment_method === 'transferencia') creditPaymentsTransferencia = amount;
    }

    const creditPaymentsTotal = creditPaymentsEfectivo + creditPaymentsTarjeta + creditPaymentsTransferencia;

    return {
      cashSales,
      cardSales,
      transferSales,
      fiadoSales,
      mixedSales,
      mixedEfectivoTotal,
      mixedSecondTotal,
      salesCount,
      changeGiven,
      cashEntries,
      cashWithdrawals,
      creditPaymentsEfectivo,
      creditPaymentsTarjeta,
      creditPaymentsTransferencia,
      creditPaymentsTotal,
    };
  }

  async closeSession(
    sessionId: string,
    closedBy: string,
    closedByName: string,
    actualCash: number,
    observations?: string
  ): Promise<CashSession> {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      // Lock the session row
      const [sessionRows] = await connection.execute<CashSessionRow[]>(
        'SELECT * FROM cash_sessions WHERE id = ? FOR UPDATE',
        [sessionId]
      );

      if (sessionRows.length === 0) {
        throw new AppError('Sesion de caja no encontrada', 404);
      }

      if (sessionRows[0].status === 'cerrada') {
        throw new AppError('La sesion ya esta cerrada', 400);
      }

      const openingAmount = Number(sessionRows[0].opening_amount);

      // Calculate totals from sales linked to this session
      const [salesRows] = await connection.execute<SalesTotalRow[]>(
        `SELECT payment_method,
                COALESCE(SUM(total), 0) as total_amount,
                COALESCE(SUM(change_amount), 0) as total_change,
                COALESCE(SUM(mixed_efectivo_amount), 0) as total_mixed_efectivo,
                COALESCE(SUM(mixed_second_amount), 0) as total_mixed_second,
                COUNT(*) as count
         FROM sales
         WHERE cash_session_id = ? AND status = 'completada'
         GROUP BY payment_method`,
        [sessionId]
      );

      let totalCashSales = 0;
      let totalCardSales = 0;
      let totalTransferSales = 0;
      let totalFiadoSales = 0;
      let totalMixedSales = 0;
      let totalSalesCount = 0;
      let totalChangeGiven = 0;

      for (const row of salesRows) {
        const amount = Number(row.total_amount);
        totalSalesCount += Number(row.count);

        switch (row.payment_method) {
          case 'efectivo':
            totalCashSales = amount;
            totalChangeGiven = Number(row.total_change);
            break;
          case 'tarjeta':
          case 'addi':
          case 'sistecredito':
            totalCardSales += amount;
            break;
          case 'transferencia':
            totalTransferSales += amount;
            break;
          case 'mixto':
            totalMixedSales += amount;
            break;
          case 'fiado':
            totalFiadoSales = amount;
            break;
        }
      }

      // Calculate cash movements
      const [movementRows] = await connection.execute<MovementTotalRow[]>(
        `SELECT type, COALESCE(SUM(amount), 0) as total
         FROM cash_movements
         WHERE session_id = ?
         GROUP BY type`,
        [sessionId]
      );

      let totalCashEntries = 0;
      let totalCashWithdrawals = 0;

      for (const row of movementRows) {
        if (row.type === 'entrada') totalCashEntries = Number(row.total);
        if (row.type === 'salida') totalCashWithdrawals = Number(row.total);
      }

      // Sum credit payments (abonos de fiados) received during this session
      const [creditRows] = await connection.execute<CreditPaymentTotalRow[]>(
        `SELECT cp.payment_method, COALESCE(SUM(cp.amount), 0) as total_amount
         FROM credit_payments cp
         JOIN cash_sessions cs ON cs.tenant_id = cp.tenant_id
         WHERE cs.id = ?
           AND cp.created_at >= cs.opened_at
           AND cp.created_at <= NOW()
         GROUP BY cp.payment_method`,
        [sessionId]
      );

      let totalCreditPaymentsEfectivo = 0;
      let totalCreditPaymentsTarjeta = 0;
      let totalCreditPaymentsTransfer = 0;

      for (const row of creditRows) {
        const amount = Number(row.total_amount);
        if (row.payment_method === 'efectivo') totalCreditPaymentsEfectivo = amount;
        else if (row.payment_method === 'tarjeta') totalCreditPaymentsTarjeta = amount;
        else if (row.payment_method === 'transferencia') totalCreditPaymentsTransfer = amount;
      }

      // Calculate expected cash (only physical cash matters)
      // Note: totalCashSales uses sales.total (net sale amount), NOT amount_paid by customer.
      // Change given to customers comes from their payment, not from the register's funds,
      // so it must NOT be subtracted here to avoid double-counting.
      // Cash abonos (credit payments in efectivo) DO enter the register physically.
      const expectedCash = openingAmount + totalCashSales + totalCashEntries - totalCashWithdrawals + totalCreditPaymentsEfectivo;
      const difference = actualCash - expectedCash;

      let closingStatus: ClosingStatus;
      if (Math.abs(difference) < 0.01) {
        closingStatus = 'cuadrado';
      } else if (difference > 0) {
        closingStatus = 'sobrante';
      } else {
        closingStatus = 'faltante';
      }

      // Update session with all calculated values
      await connection.execute(
        `UPDATE cash_sessions SET
          closed_by = ?, closed_by_name = ?, closed_at = NOW(),
          total_cash_sales = ?, total_card_sales = ?, total_transfer_sales = ?, total_fiado_sales = ?,
          total_credit_payments_efectivo = ?, total_credit_payments_tarjeta = ?, total_credit_payments_transfer = ?,
          total_sales_count = ?, total_change_given = ?,
          total_cash_entries = ?, total_cash_withdrawals = ?,
          expected_cash = ?, actual_cash = ?, difference = ?,
          status = 'cerrada', closing_status = ?, observations = ?
         WHERE id = ?`,
        [
          closedBy, closedByName,
          totalCashSales, totalCardSales, totalTransferSales, totalFiadoSales,
          totalCreditPaymentsEfectivo, totalCreditPaymentsTarjeta, totalCreditPaymentsTransfer,
          totalSalesCount, totalChangeGiven,
          totalCashEntries, totalCashWithdrawals,
          expectedCash, actualCash, difference,
          closingStatus, observations || null,
          sessionId,
        ]
      );

      await connection.commit();

      return this.findById(sessionId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

export const cashSessionsService = new CashSessionsService();
