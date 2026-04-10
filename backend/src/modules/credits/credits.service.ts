import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config';
import { AppError } from '../../common/middleware';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

interface SaleRow extends RowDataPacket {
  id: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string | null;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  payment_method: string;
  amount_paid: number;
  change_amount: number;
  credit_status: string | null;
  due_date: Date | null;
  status: string;
  created_at: Date;
}

interface CreditPaymentRow extends RowDataPacket {
  id: string;
  sale_id: string;
  customer_id: string;
  amount: number;
  payment_method: string;
  receipt_number: string | null;
  notes: string | null;
  received_by: string | null;
  created_at: Date;
}

interface CountRow extends RowDataPacket {
  total: number;
}

interface SumRow extends RowDataPacket {
  total_pending: number;
  total_credits: number;
  customers_with_debt: number;
}

export interface CreditPayment {
  id: string;
  saleId: string;
  customerId: string;
  amount: number;
  paymentMethod: string;
  receiptNumber?: string;
  notes?: string;
  receivedBy?: string;
  createdAt: Date;
}

export interface CreditDetail {
  sale: {
    id: string;
    invoiceNumber: string;
    customerId: string;
    customerName: string;
    customerPhone?: string;
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    status: string;
    dueDate?: Date;
    createdAt: Date;
  };
  totalAmount: number;
  paidAmount: number;
  remainingBalance: number;
  status: 'pendiente' | 'parcial' | 'pagado';
  payments: CreditPayment[];
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class CreditsService {
  private mapCreditPayment(row: CreditPaymentRow): CreditPayment {
    return {
      id: row.id,
      saleId: row.sale_id,
      customerId: row.customer_id,
      amount: Number(row.amount),
      paymentMethod: row.payment_method,
      receiptNumber: row.receipt_number || undefined,
      notes: row.notes || undefined,
      receivedBy: row.received_by || undefined,
      createdAt: row.created_at,
    };
  }

  async findAllPendingCredits(
    tenantId: string,
    page = 1,
    limit = 10,
    customerId?: string,
    status?: string
  ): Promise<PaginatedResponse<CreditDetail>> {
    const offset = (page - 1) * limit;

    let whereClause = "WHERE s.tenant_id = ? AND s.payment_method = 'fiado' AND s.status = 'completada'";
    const params: string[] = [tenantId];

    if (customerId) {
      whereClause += ' AND s.customer_id = ?';
      params.push(customerId);
    }

    if (status && status !== 'all') {
      whereClause += ' AND s.credit_status = ?';
      params.push(status);
    } else {
      whereClause += " AND s.credit_status IN ('pendiente', 'parcial')";
    }

    const [countResult] = await db.execute<CountRow[]>(
      `SELECT COUNT(*) as total FROM sales s ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    const [rows] = await db.execute<SaleRow[]>(
      `SELECT s.* FROM sales s ${whereClause} ORDER BY s.created_at DESC LIMIT ? OFFSET ?`,
      [...params, String(limit), String(offset)]
    );

    const credits: CreditDetail[] = [];
    for (const row of rows) {
      const creditDetail = await this.getCreditDetail(tenantId, row.id);
      credits.push(creditDetail);
    }

    return {
      data: credits,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getCreditDetail(tenantId: string, saleId: string): Promise<CreditDetail> {
    const [saleRows] = await db.execute<SaleRow[]>(
      `SELECT * FROM sales WHERE id = ? AND tenant_id = ? AND payment_method = 'fiado'`,
      [saleId, tenantId]
    );

    if (saleRows.length === 0) {
      throw new AppError('Credito no encontrado', 404);
    }

    const sale = saleRows[0];

    const [paymentRows] = await db.execute<CreditPaymentRow[]>(
      'SELECT * FROM credit_payments WHERE sale_id = ? ORDER BY created_at DESC',
      [saleId]
    );

    const paidAmount = paymentRows.reduce((sum, p) => sum + Number(p.amount), 0);
    const remainingBalance = Number(sale.total) - paidAmount;

    let status: 'pendiente' | 'parcial' | 'pagado' = 'pendiente';
    if (paidAmount >= Number(sale.total)) {
      status = 'pagado';
    } else if (paidAmount > 0) {
      status = 'parcial';
    }

    return {
      sale: {
        id: sale.id,
        invoiceNumber: sale.invoice_number,
        customerId: sale.customer_id,
        customerName: sale.customer_name,
        customerPhone: sale.customer_phone || undefined,
        subtotal: Number(sale.subtotal),
        tax: Number(sale.tax),
        discount: Number(sale.discount),
        total: Number(sale.total),
        status: sale.status,
        dueDate: sale.due_date || undefined,
        createdAt: sale.created_at,
      },
      totalAmount: Number(sale.total),
      paidAmount,
      remainingBalance,
      status,
      payments: paymentRows.map((p) => this.mapCreditPayment(p)),
    };
  }

  async getPaymentHistory(saleId: string): Promise<CreditPayment[]> {
    const [rows] = await db.execute<CreditPaymentRow[]>(
      'SELECT * FROM credit_payments WHERE sale_id = ? ORDER BY created_at DESC',
      [saleId]
    );

    return rows.map((row) => this.mapCreditPayment(row));
  }

  async registerPayment(
    tenantId: string,
    saleId: string,
    data: {
      amount: number;
      paymentMethod: 'efectivo' | 'tarjeta' | 'transferencia';
      notes?: string;
    },
    userId: string | null
  ): Promise<CreditPayment> {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      // Obtener la venta
      const [saleRows] = await connection.execute<SaleRow[]>(
        `SELECT * FROM sales WHERE id = ? AND payment_method = 'fiado' FOR UPDATE`,
        [saleId]
      );

      if (saleRows.length === 0) {
        throw new AppError('Credito no encontrado', 404);
      }

      const sale = saleRows[0];

      if (sale.status === 'anulada') {
        throw new AppError('No se puede abonar a una venta anulada', 400);
      }

      // Calcular saldo actual
      const [paidRows] = await connection.execute<RowDataPacket[]>(
        'SELECT COALESCE(SUM(amount), 0) as total_paid FROM credit_payments WHERE sale_id = ?',
        [saleId]
      );
      const totalPaid = Number(paidRows[0].total_paid);
      const remainingBalance = Number(sale.total) - totalPaid;

      if (data.amount <= 0) {
        throw new AppError('El monto debe ser mayor a 0', 400);
      }

      if (data.amount > remainingBalance) {
        throw new AppError(
          `El monto excede el saldo pendiente de $${remainingBalance.toLocaleString('es-CO')}`,
          400
        );
      }

      // Generar numero de recibo
      const [seqRows] = await connection.execute<RowDataPacket[]>(
        'SELECT current_number, prefix FROM payment_receipt_sequence WHERE tenant_id = ? FOR UPDATE',
        [tenantId]
      );

      let receiptNumber: string;
      if (seqRows.length > 0) {
        const newNumber = seqRows[0].current_number + 1;
        await connection.execute(
          'UPDATE payment_receipt_sequence SET current_number = ? WHERE tenant_id = ?',
          [newNumber, tenantId]
        );
        receiptNumber = `${seqRows[0].prefix}-${String(newNumber).padStart(5, '0')}`;
      } else {
        receiptNumber = `REC-${Date.now()}`;
      }

      // Crear el pago
      const paymentId = uuidv4();
      await connection.execute<ResultSetHeader>(
        `INSERT INTO credit_payments (id, tenant_id, sale_id, customer_id, amount, payment_method, receipt_number, notes, received_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          paymentId,
          tenantId,
          saleId,
          sale.customer_id,
          data.amount,
          data.paymentMethod,
          receiptNumber,
          data.notes || null,
          userId,
        ]
      );

      // Actualizar estado del credito
      const newTotalPaid = totalPaid + data.amount;
      let newStatus: string;
      if (newTotalPaid >= Number(sale.total)) {
        newStatus = 'pagado';
      } else {
        newStatus = 'parcial';
      }

      await connection.execute(
        'UPDATE sales SET credit_status = ?, amount_paid = ? WHERE id = ?',
        [newStatus, newTotalPaid, saleId]
      );

      await connection.commit();

      return {
        id: paymentId,
        saleId,
        customerId: sale.customer_id,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        receiptNumber,
        notes: data.notes,
        receivedBy: userId ?? undefined,
        createdAt: new Date(),
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async getSummary(tenantId: string): Promise<{
    totalPending: number;
    totalCredits: number;
    customersWithDebt: number;
  }> {
    const [rows] = await db.execute<SumRow[]>(`
      SELECT
        COALESCE(SUM(s.total), 0) - COALESCE((
          SELECT SUM(cp.amount)
          FROM credit_payments cp
          WHERE cp.sale_id IN (
            SELECT s2.id FROM sales s2
            WHERE s2.tenant_id = ?
              AND s2.payment_method = 'fiado'
              AND s2.status = 'completada'
              AND s2.credit_status IN ('pendiente', 'parcial')
          )
        ), 0) AS total_pending,
        COUNT(DISTINCT s.id) AS total_credits,
        COUNT(DISTINCT s.customer_id) AS customers_with_debt
      FROM sales s
      WHERE s.tenant_id = ?
        AND s.payment_method = 'fiado'
        AND s.status = 'completada'
        AND s.credit_status IN ('pendiente', 'parcial')
    `, [tenantId, tenantId]);

    return {
      totalPending: Number(rows[0].total_pending) || 0,
      totalCredits: Number(rows[0].total_credits) || 0,
      customersWithDebt: Number(rows[0].customers_with_debt) || 0,
    };
  }
}

export const creditsService = new CreditsService();
