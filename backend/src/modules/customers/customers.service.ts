import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config';
import { AppError } from '../../common/middleware';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

interface CustomerRow extends RowDataPacket {
  id: string;
  cedula: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  credit_limit: number;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

interface CustomerBalanceRow extends RowDataPacket {
  customer_id: string;
  cedula: string;
  customer_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  credit_limit: number;
  notes: string | null;
  total_credit: number;
  total_paid: number;
  balance: number;
  created_at: Date;
  updated_at: Date;
}

interface CountRow extends RowDataPacket {
  total: number;
}

export interface Customer {
  id: string;
  cedula: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  creditLimit: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerWithBalance extends Customer {
  totalCredit: number;
  totalPaid: number;
  balance: number;
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

export class CustomersService {
  private mapCustomer(row: CustomerRow): Customer {
    return {
      id: row.id,
      cedula: row.cedula,
      name: row.name,
      phone: row.phone || undefined,
      email: row.email || undefined,
      address: row.address || undefined,
      creditLimit: Number(row.credit_limit) || 0,
      notes: row.notes || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapCustomerWithBalance(row: CustomerBalanceRow): CustomerWithBalance {
    return {
      id: row.customer_id,
      cedula: row.cedula,
      name: row.customer_name,
      phone: row.phone || undefined,
      email: row.email || undefined,
      address: row.address || undefined,
      creditLimit: Number(row.credit_limit) || 0,
      notes: row.notes || undefined,
      totalCredit: Number(row.total_credit) || 0,
      totalPaid: Number(row.total_paid) || 0,
      balance: Number(row.balance) || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findAll(
    tenantId: string,
    page = 1,
    limit = 10,
    search?: string
  ): Promise<PaginatedResponse<CustomerWithBalance>> {
    const offset = (page - 1) * limit;

    let countQuery = 'SELECT COUNT(*) as total FROM customers WHERE tenant_id = ? AND is_active = 1';
    let dataQuery = `
      SELECT
        c.id as customer_id,
        c.cedula,
        c.name as customer_name,
        c.phone,
        c.email,
        c.address,
        c.credit_limit,
        c.notes,
        COALESCE((
          SELECT SUM(s.total)
          FROM sales s
          WHERE s.customer_id = c.id
          AND s.payment_method = 'fiado'
          AND s.status = 'completada'
        ), 0) AS total_credit,
        COALESCE((
          SELECT SUM(cp.amount)
          FROM credit_payments cp
          WHERE cp.customer_id = c.id
        ), 0) AS total_paid,
        COALESCE((
          SELECT SUM(s.total)
          FROM sales s
          WHERE s.customer_id = c.id
          AND s.payment_method = 'fiado'
          AND s.status = 'completada'
        ), 0) - COALESCE((
          SELECT SUM(cp.amount)
          FROM credit_payments cp
          WHERE cp.customer_id = c.id
        ), 0) AS balance,
        c.created_at,
        c.updated_at
      FROM customers c
      WHERE c.tenant_id = ? AND c.is_active = 1
    `;
    const params: string[] = [tenantId];
    const countParams: string[] = [tenantId];

    if (search) {
      const searchCondition = ' AND (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR c.cedula LIKE ?)';
      countQuery += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ? OR cedula LIKE ?)';
      dataQuery += searchCondition;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
      countParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    dataQuery += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';

    const [countResult] = await db.execute<CountRow[]>(countQuery, countParams);
    const total = countResult[0].total;

    const [rows] = await db.execute<CustomerBalanceRow[]>(dataQuery, [
      ...params,
      String(limit),
      String(offset),
    ]);

    return {
      data: rows.map((row) => this.mapCustomerWithBalance(row)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async search(tenantId: string, query: string): Promise<CustomerWithBalance[]> {
    const searchPattern = `%${query}%`;

    const [rows] = await db.execute<CustomerBalanceRow[]>(
      `
      SELECT
        c.id as customer_id,
        c.cedula,
        c.name as customer_name,
        c.phone,
        c.email,
        c.address,
        c.credit_limit,
        c.notes,
        COALESCE((
          SELECT SUM(s.total)
          FROM sales s
          WHERE s.customer_id = c.id
          AND s.payment_method = 'fiado'
          AND s.status = 'completada'
        ), 0) AS total_credit,
        COALESCE((
          SELECT SUM(cp.amount)
          FROM credit_payments cp
          WHERE cp.customer_id = c.id
        ), 0) AS total_paid,
        COALESCE((
          SELECT SUM(s.total)
          FROM sales s
          WHERE s.customer_id = c.id
          AND s.payment_method = 'fiado'
          AND s.status = 'completada'
        ), 0) - COALESCE((
          SELECT SUM(cp.amount)
          FROM credit_payments cp
          WHERE cp.customer_id = c.id
        ), 0) AS balance,
        c.created_at,
        c.updated_at
      FROM customers c
      WHERE c.tenant_id = ? AND c.is_active = 1 AND (c.name LIKE ? OR c.phone LIKE ? OR c.cedula LIKE ?)
      ORDER BY c.name ASC
      LIMIT 10
      `,
      [tenantId, searchPattern, searchPattern, searchPattern]
    );

    return rows.map((row) => this.mapCustomerWithBalance(row));
  }

  async findById(id: string): Promise<CustomerWithBalance> {
    const [rows] = await db.execute<CustomerBalanceRow[]>(
      `
      SELECT
        c.id as customer_id,
        c.cedula,
        c.name as customer_name,
        c.phone,
        c.email,
        c.address,
        c.credit_limit,
        c.notes,
        COALESCE((
          SELECT SUM(s.total)
          FROM sales s
          WHERE s.customer_id = c.id
          AND s.payment_method = 'fiado'
          AND s.status = 'completada'
        ), 0) AS total_credit,
        COALESCE((
          SELECT SUM(cp.amount)
          FROM credit_payments cp
          WHERE cp.customer_id = c.id
        ), 0) AS total_paid,
        COALESCE((
          SELECT SUM(s.total)
          FROM sales s
          WHERE s.customer_id = c.id
          AND s.payment_method = 'fiado'
          AND s.status = 'completada'
        ), 0) - COALESCE((
          SELECT SUM(cp.amount)
          FROM credit_payments cp
          WHERE cp.customer_id = c.id
        ), 0) AS balance,
        c.created_at,
        c.updated_at
      FROM customers c
      WHERE c.id = ?
      `,
      [id]
    );

    if (rows.length === 0) {
      throw new AppError('Cliente no encontrado', 404);
    }

    return this.mapCustomerWithBalance(rows[0]);
  }

  async create(tenantId: string, data: {
    cedula: string;
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    creditLimit?: number;
    notes?: string;
  }): Promise<Customer> {
    // Verificar que la cédula no esté duplicada en el tenant
    const [existing] = await db.execute<CustomerRow[]>(
      'SELECT id FROM customers WHERE cedula = ? AND tenant_id = ?',
      [data.cedula, tenantId]
    );
    if (existing.length > 0) {
      throw new AppError('Ya existe un cliente con esta cédula', 409);
    }

    const id = uuidv4();

    await db.execute<ResultSetHeader>(
      'INSERT INTO customers (id, tenant_id, cedula, name, phone, email, address, credit_limit, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        tenantId,
        data.cedula,
        data.name,
        data.phone || null,
        data.email || null,
        data.address || null,
        data.creditLimit || 0,
        data.notes || null,
      ]
    );

    const [rows] = await db.execute<CustomerRow[]>(
      'SELECT * FROM customers WHERE id = ?',
      [id]
    );

    return this.mapCustomer(rows[0]);
  }

  async update(
    tenantId: string,
    id: string,
    data: {
      cedula?: string;
      name?: string;
      phone?: string;
      email?: string;
      address?: string;
      creditLimit?: number;
      notes?: string;
    }
  ): Promise<Customer> {
    await this.findById(id);

    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (data.cedula !== undefined) {
      // Verificar que la cédula no esté en uso por otro cliente del mismo tenant
      const [existing] = await db.execute<CustomerRow[]>(
        'SELECT id FROM customers WHERE cedula = ? AND tenant_id = ? AND id != ?',
        [data.cedula, tenantId, id]
      );
      if (existing.length > 0) {
        throw new AppError('Ya existe otro cliente con esta cédula', 409);
      }
      updates.push('cedula = ?');
      values.push(data.cedula);
    }

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }

    if (data.phone !== undefined) {
      updates.push('phone = ?');
      values.push(data.phone || null);
    }

    if (data.email !== undefined) {
      updates.push('email = ?');
      values.push(data.email || null);
    }

    if (data.address !== undefined) {
      updates.push('address = ?');
      values.push(data.address || null);
    }

    if (data.creditLimit !== undefined) {
      updates.push('credit_limit = ?');
      values.push(data.creditLimit);
    }

    if (data.notes !== undefined) {
      updates.push('notes = ?');
      values.push(data.notes || null);
    }

    if (updates.length === 0) {
      throw new AppError('No hay datos para actualizar', 400);
    }

    values.push(id);

    await db.execute(`UPDATE customers SET ${updates.join(', ')} WHERE id = ?`, values);

    const [rows] = await db.execute<CustomerRow[]>(
      'SELECT * FROM customers WHERE id = ?',
      [id]
    );

    return this.mapCustomer(rows[0]);
  }

  // Soft delete (regla universal: nunca DELETE físico en datos de negocio).
  // El borrado real de PII es la anonimización del módulo privacy (derecho al olvido).
  async delete(id: string): Promise<void> {
    const customer = await this.findById(id);

    // No permitir eliminar clientes con saldo pendiente
    if (customer.balance > 0) {
      throw new AppError(
        'No se puede eliminar un cliente con saldo pendiente',
        400
      );
    }

    const [result] = await db.execute<ResultSetHeader>(
      'UPDATE customers SET is_active = 0, deleted_at = NOW() WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      throw new AppError('No se pudo eliminar el cliente', 500);
    }
  }

  async getBalance(customerId: string): Promise<{
    totalCredit: number;
    totalPaid: number;
    balance: number;
  }> {
    const customer = await this.findById(customerId);
    return {
      totalCredit: customer.totalCredit,
      totalPaid: customer.totalPaid,
      balance: customer.balance,
    };
  }
}

export const customersService = new CustomersService();
