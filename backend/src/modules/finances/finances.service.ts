import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config';
import { AppError } from '../../common/middleware';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// ─── Row interfaces ───────────────────────────────────────────────────────────

interface CategoryRow extends RowDataPacket {
  id: string; tenant_id: string; type: string; name: string;
  icon: string | null; color: string | null; is_system: number;
  is_active: number; sort_order: number;
}

interface TransactionRow extends RowDataPacket {
  id: string; tenant_id: string; type: string; category_id: string;
  category_name: string; description: string; amount: number;
  transaction_date: Date; payment_method: string; receipt_url: string | null;
  receipt_number: string | null; is_recurring: number; recurrence_type: string | null;
  recurrence_day: number | null; source_type: string; source_id: string | null;
  notes: string | null; tags: string | null;
  created_by: string | null; created_by_name: string | null; created_at: Date;
}

interface BudgetRow extends RowDataPacket {
  id: string; tenant_id: string; category_id: string; year: number;
  month: number; budgeted_amount: number; notes: string | null;
  category_name: string; category_type: string; category_icon: string | null; category_color: string | null;
}

interface SummaryRow extends RowDataPacket { total: number; }

// ─── Default categories seeded for new restaurant tenants ────────────────────

const DEFAULT_CATEGORIES = [
  // Egresos
  { type: 'egreso', name: 'Arriendo / Alquiler',      icon: '🏠', color: '#e74c3c', sort: 1 },
  { type: 'egreso', name: 'Servicios públicos',        icon: '💡', color: '#e67e22', sort: 2 },
  { type: 'egreso', name: 'Nómina y salarios',         icon: '👥', color: '#8e44ad', sort: 3 },
  { type: 'egreso', name: 'Compra de insumos',         icon: '🛒', color: '#2980b9', sort: 4 },
  { type: 'egreso', name: 'Mantenimiento',             icon: '🔧', color: '#7f8c8d', sort: 5 },
  { type: 'egreso', name: 'Mercadeo y publicidad',     icon: '📢', color: '#16a085', sort: 6 },
  { type: 'egreso', name: 'Cuota préstamo / deuda',    icon: '🏦', color: '#c0392b', sort: 7 },
  { type: 'egreso', name: 'Impuestos y obligaciones',  icon: '📋', color: '#d35400', sort: 8 },
  { type: 'egreso', name: 'Gastos varios',             icon: '📌', color: '#95a5a6', sort: 9 },
  // Ingresos
  { type: 'ingreso', name: 'Ventas',            icon: '💰', color: '#27ae60', sort: 1 },
  { type: 'ingreso', name: 'Préstamo recibido', icon: '🏦', color: '#2ecc71', sort: 2 },
  { type: 'ingreso', name: 'Aporte de capital', icon: '💵', color: '#1abc9c', sort: 3 },
  { type: 'ingreso', name: 'Otros ingresos',    icon: '➕', color: '#3498db', sort: 4 },
];

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface CreateCategoryData {
  type: 'ingreso' | 'egreso'; name: string; icon?: string; color?: string; sortOrder?: number;
}

export interface CreateTransactionData {
  type: 'ingreso' | 'egreso'; categoryId: string; description: string;
  amount: number; transactionDate: string;
  paymentMethod?: string; receiptUrl?: string; receiptNumber?: string;
  isRecurring?: boolean; recurrenceType?: string; recurrenceDay?: number;
  notes?: string; tags?: string[];
}

export interface TransactionFilters {
  type?: string; categoryId?: string; from?: string; to?: string;
  sourceType?: string; page?: number; limit?: number;
}

export interface UpsertBudgetData {
  categoryId: string; year: number; month: number;
  budgetedAmount: number; notes?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

class FinancesService {

  // ── CATEGORIES ────────────────────────────────────────────────────────────

  async getCategories(tenantId: string, type?: string) {
    const whereType = type ? `AND type = '${type}'` : '';
    const [rows] = await db.execute<CategoryRow[]>(
      `SELECT * FROM finance_categories
       WHERE tenant_id = ? AND is_active = 1 ${whereType}
       ORDER BY type, sort_order, name`,
      [tenantId]
    );
    return rows.map(this.mapCategory);
  }

  async createCategory(tenantId: string, data: CreateCategoryData, isSystem = false) {
    const id = uuidv4();
    await db.execute(
      `INSERT INTO finance_categories (id, tenant_id, type, name, icon, color, is_system, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, tenantId, data.type, data.name, data.icon ?? null, data.color ?? null,
       isSystem ? 1 : 0, data.sortOrder ?? 0]
    );
    return this.getCategoryById(tenantId, id);
  }

  async updateCategory(tenantId: string, id: string, data: Partial<CreateCategoryData>) {
    // Verificar que no sea del sistema
    const [cat] = await db.execute<CategoryRow[]>(
      `SELECT is_system FROM finance_categories WHERE id = ? AND tenant_id = ?`,
      [id, tenantId]
    );
    if (cat.length === 0) throw new AppError('Categoría no encontrada', 404);

    const fields: string[] = [];
    const values: unknown[] = [];
    if (data.name !== undefined)      { fields.push('name = ?');       values.push(data.name); }
    if (data.icon !== undefined)      { fields.push('icon = ?');       values.push(data.icon); }
    if (data.color !== undefined)     { fields.push('color = ?');      values.push(data.color); }
    if (data.sortOrder !== undefined) { fields.push('sort_order = ?'); values.push(data.sortOrder); }
    if (fields.length === 0) throw new AppError('Nada que actualizar', 400);
    values.push(id, tenantId);
    await db.execute(`UPDATE finance_categories SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`, values);
    return this.getCategoryById(tenantId, id);
  }

  async deleteCategory(tenantId: string, id: string) {
    const [cat] = await db.execute<CategoryRow[]>(
      `SELECT is_system FROM finance_categories WHERE id = ? AND tenant_id = ?`,
      [id, tenantId]
    );
    if (cat.length === 0) throw new AppError('Categoría no encontrada', 404);
    if (cat[0].is_system) throw new AppError('Las categorías del sistema no se pueden eliminar', 409);

    const [used] = await db.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM finance_transactions WHERE category_id = ? AND tenant_id = ?`,
      [id, tenantId]
    );
    if ((used[0] as any).total > 0)
      throw new AppError('La categoría tiene transacciones registradas. Desactívala en lugar de eliminarla.', 409);

    await db.execute(`DELETE FROM finance_categories WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
  }

  /** Insertar categorías por defecto cuando se activa el módulo para un tenant */
  async seedDefaultCategories(tenantId: string) {
    // INSERT IGNORE evita duplicados aunque se llame concurrentemente varias veces
    for (const cat of DEFAULT_CATEGORIES) {
      const id = uuidv4();
      await db.execute(
        `INSERT IGNORE INTO finance_categories (id, tenant_id, type, name, icon, color, is_system, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
        [id, tenantId, cat.type, cat.name, cat.icon, cat.color, cat.sort]
      );
    }
  }

  // ── TRANSACTIONS ──────────────────────────────────────────────────────────

  async getTransactions(tenantId: string, filters: TransactionFilters = {}) {
    const page   = Math.max(1, Math.floor(Number(filters.page  ?? 1)));
    const limit  = Math.min(Math.max(1, Math.floor(Number(filters.limit ?? 50))), 200);
    const offset = (page - 1) * limit;

    const conditions: string[] = ['ft.tenant_id = ?'];
    const params: unknown[] = [tenantId];

    if (filters.type)       { conditions.push('ft.type = ?');        params.push(filters.type); }
    if (filters.categoryId) { conditions.push('ft.category_id = ?'); params.push(filters.categoryId); }
    if (filters.sourceType) { conditions.push('ft.source_type = ?'); params.push(filters.sourceType); }
    if (filters.from)       { conditions.push('ft.transaction_date >= ?'); params.push(filters.from); }
    if (filters.to)         { conditions.push('ft.transaction_date <= ?'); params.push(filters.to); }

    const where = conditions.join(' AND ');

    const [countRows] = await db.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM finance_transactions ft WHERE ${where}`,
      params
    );
    const total = (countRows[0] as any).total;

    // LIMIT/OFFSET se interpolan directamente como enteros (mysql2 prepared statements no los acepta como parámetros)
    const [rows] = await db.execute<TransactionRow[]>(
      `SELECT ft.* FROM finance_transactions ft
       WHERE ${where}
       ORDER BY ft.transaction_date DESC, ft.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    return {
      data: rows.map(this.mapTransaction),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async createTransaction(tenantId: string, userId: string, userName: string, data: CreateTransactionData) {
    // Verify category
    const cat = await this.getCategoryById(tenantId, data.categoryId);
    if (cat.type !== data.type)
      throw new AppError(`La categoría "${cat.name}" es de tipo ${cat.type}, no ${data.type}`, 400);

    const id = uuidv4();
    await db.execute(
      `INSERT INTO finance_transactions
         (id, tenant_id, type, category_id, category_name, description, amount,
          transaction_date, payment_method, receipt_url, receipt_number,
          is_recurring, recurrence_type, recurrence_day,
          source_type, notes, tags, created_by, created_by_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?, ?, ?)`,
      [id, tenantId, data.type, data.categoryId, cat.name, data.description,
       data.amount, data.transactionDate,
       data.paymentMethod ?? 'efectivo',
       data.receiptUrl ?? null, data.receiptNumber ?? null,
       data.isRecurring ? 1 : 0, data.recurrenceType ?? null, data.recurrenceDay ?? null,
       data.notes ?? null,
       data.tags ? JSON.stringify(data.tags) : null,
       userId, userName]
    );
    return this.getTransactionById(tenantId, id);
  }

  async updateTransaction(tenantId: string, id: string, data: Partial<CreateTransactionData>) {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.categoryId !== undefined) {
      const cat = await this.getCategoryById(tenantId, data.categoryId);
      fields.push('category_id = ?', 'category_name = ?');
      values.push(data.categoryId, cat.name);
    }
    if (data.description !== undefined)   { fields.push('description = ?');      values.push(data.description); }
    if (data.amount !== undefined)        { fields.push('amount = ?');            values.push(data.amount); }
    if (data.transactionDate !== undefined){ fields.push('transaction_date = ?'); values.push(data.transactionDate); }
    if (data.paymentMethod !== undefined) { fields.push('payment_method = ?');   values.push(data.paymentMethod); }
    if (data.receiptUrl !== undefined)    { fields.push('receipt_url = ?');       values.push(data.receiptUrl); }
    if (data.receiptNumber !== undefined) { fields.push('receipt_number = ?');   values.push(data.receiptNumber); }
    if (data.notes !== undefined)         { fields.push('notes = ?');             values.push(data.notes); }
    if (data.tags !== undefined)          { fields.push('tags = ?');              values.push(JSON.stringify(data.tags)); }
    if (fields.length === 0) throw new AppError('Nada que actualizar', 400);

    values.push(id, tenantId);
    const [result] = await db.execute<ResultSetHeader>(
      `UPDATE finance_transactions SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`,
      values
    );
    if (result.affectedRows === 0) throw new AppError('Transacción no encontrada', 404);
    return this.getTransactionById(tenantId, id);
  }

  async deleteTransaction(tenantId: string, id: string) {
    const [tx] = await db.execute<TransactionRow[]>(
      `SELECT source_type FROM finance_transactions WHERE id = ? AND tenant_id = ?`,
      [id, tenantId]
    );
    if (tx.length === 0) throw new AppError('Transacción no encontrada', 404);
    if (tx[0].source_type !== 'manual')
      throw new AppError('Solo se pueden eliminar transacciones registradas manualmente', 409);
    await db.execute(`DELETE FROM finance_transactions WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
  }

  // ── SUMMARY ───────────────────────────────────────────────────────────────

  async getSummary(tenantId: string, year: number, month: number) {
    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const to   = new Date(year, month, 0).toISOString().split('T')[0];

    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT
         type,
         COALESCE(SUM(amount), 0) AS total
       FROM finance_transactions
       WHERE tenant_id = ? AND transaction_date BETWEEN ? AND ?
       GROUP BY type`,
      [tenantId, from, to]
    );

    let totalIncome = 0, totalExpense = 0;
    for (const r of rows) {
      if (r.type === 'ingreso') totalIncome = Number(r.total);
      else totalExpense = Number(r.total);
    }

    // Desglose por categoría
    const [byCat] = await db.execute<RowDataPacket[]>(
      `SELECT
         fc.type, fc.name AS category, fc.icon, fc.color,
         COALESCE(SUM(ft.amount), 0) AS total
       FROM finance_categories fc
       LEFT JOIN finance_transactions ft
         ON ft.category_id = fc.id AND ft.transaction_date BETWEEN ? AND ?
       WHERE fc.tenant_id = ? AND fc.is_active = 1
       GROUP BY fc.id, fc.type, fc.name, fc.icon, fc.color
       ORDER BY fc.type, total DESC`,
      [from, to, tenantId]
    );

    return {
      period: { year, month, from, to },
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      byCategory: byCat.map(r => ({
        type: r.type, category: r.category, icon: r.icon,
        color: r.color, total: Number(r.total),
      })),
    };
  }

  async getCashflow(tenantId: string, from: string, to: string) {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT
         DATE_FORMAT(transaction_date, '%Y-%m') AS period,
         SUM(CASE WHEN type = 'ingreso' THEN amount ELSE 0 END) AS income,
         SUM(CASE WHEN type = 'egreso'  THEN amount ELSE 0 END) AS expense
       FROM finance_transactions
       WHERE tenant_id = ? AND transaction_date BETWEEN ? AND ?
       GROUP BY period
       ORDER BY period`,
      [tenantId, from, to]
    );
    return rows.map(r => ({
      period: r.period,
      income: Number(r.income),
      expense: Number(r.expense),
      balance: Number(r.income) - Number(r.expense),
    }));
  }

  // ── BUDGETS ───────────────────────────────────────────────────────────────

  async getBudgets(tenantId: string, year: number, month: number) {
    const [rows] = await db.execute<BudgetRow[]>(
      `SELECT fb.*,
              fc.name AS category_name, fc.type AS category_type,
              fc.icon AS category_icon, fc.color AS category_color,
              COALESCE((
                SELECT SUM(ft.amount) FROM finance_transactions ft
                WHERE ft.category_id = fb.category_id
                  AND ft.tenant_id = ?
                  AND YEAR(ft.transaction_date) = fb.year
                  AND MONTH(ft.transaction_date) = fb.month
              ), 0) AS actual_amount
       FROM finance_budgets fb
       JOIN finance_categories fc ON fc.id = fb.category_id
       WHERE fb.tenant_id = ? AND fb.year = ? AND fb.month = ?
       ORDER BY fc.type, fc.sort_order`,
      [tenantId, tenantId, year, month]
    );
    return rows.map(r => ({
      id: r.id, categoryId: r.category_id, year: r.year, month: r.month,
      categoryName: r.category_name, categoryType: r.category_type,
      icon: r.category_icon, color: r.category_color,
      budgetedAmount: Number(r.budgeted_amount),
      actualAmount: Number((r as any).actual_amount),
      difference: Number(r.budgeted_amount) - Number((r as any).actual_amount),
    }));
  }

  async upsertBudget(tenantId: string, data: UpsertBudgetData) {
    const [existing] = await db.execute<BudgetRow[]>(
      `SELECT id FROM finance_budgets
       WHERE tenant_id = ? AND category_id = ? AND year = ? AND month = ?`,
      [tenantId, data.categoryId, data.year, data.month]
    );

    if (existing.length > 0) {
      await db.execute(
        `UPDATE finance_budgets SET budgeted_amount = ?, notes = ?
         WHERE id = ? AND tenant_id = ?`,
        [data.budgetedAmount, data.notes ?? null, existing[0].id, tenantId]
      );
      return this.getBudgetById(existing[0].id, tenantId);
    } else {
      const id = uuidv4();
      await db.execute(
        `INSERT INTO finance_budgets (id, tenant_id, category_id, year, month, budgeted_amount, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, tenantId, data.categoryId, data.year, data.month, data.budgetedAmount, data.notes ?? null]
      );
      return this.getBudgetById(id, tenantId);
    }
  }

  async deleteBudget(tenantId: string, id: string) {
    const [result] = await db.execute<ResultSetHeader>(
      `DELETE FROM finance_budgets WHERE id = ? AND tenant_id = ?`,
      [id, tenantId]
    );
    if (result.affectedRows === 0) throw new AppError('Presupuesto no encontrado', 404);
  }

  // ── AUTO-RECORD (integración con otros módulos) ───────────────────────────

  /**
   * Registra automáticamente una transacción financiera desde otro módulo.
   * Es idempotente: si ya existe una transacción con ese source_type + source_id, no hace nada.
   * No lanza error: si falla, solo loguea (no debe bloquear la operación principal).
   */
  async autoRecord(params: {
    tenantId: string;
    type: 'ingreso' | 'egreso';
    categoryName: string;
    description: string;
    amount: number;
    paymentMethod?: string;
    sourceType: 'sale' | 'purchase_invoice' | 'payroll' | 'cash_movement';
    sourceId: string;
    createdById?: string;
    createdByName?: string;
  }): Promise<void> {
    try {
      // Idempotencia: no registrar dos veces el mismo origen
      const [existing] = await db.execute<RowDataPacket[]>(
        `SELECT id FROM finance_transactions WHERE source_type = ? AND source_id = ? AND tenant_id = ?`,
        [params.sourceType, params.sourceId, params.tenantId]
      );
      if ((existing as any[]).length > 0) return;

      // Buscar categoría por nombre
      const [catRows] = await db.execute<RowDataPacket[]>(
        `SELECT id, name FROM finance_categories WHERE tenant_id = ? AND type = ? AND name = ? LIMIT 1`,
        [params.tenantId, params.type, params.categoryName]
      );

      let categoryId: string;
      let categoryName: string;

      if ((catRows as any[]).length > 0) {
        categoryId = (catRows as any[])[0].id;
        categoryName = (catRows as any[])[0].name;
      } else {
        // Crear la categoría si no existe (ej: primer uso antes del seed)
        const cat = await this.createCategory(
          params.tenantId,
          { type: params.type, name: params.categoryName },
          true
        );
        categoryId = cat.id;
        categoryName = cat.name;
      }

      const id = uuidv4();
      await db.execute(
        `INSERT INTO finance_transactions
           (id, tenant_id, type, category_id, category_name, description, amount,
            transaction_date, payment_method, source_type, source_id, created_by, created_by_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, CURDATE(), ?, ?, ?, ?, ?)`,
        [
          id, params.tenantId, params.type, categoryId, categoryName,
          params.description, params.amount,
          params.paymentMethod ?? 'efectivo',
          params.sourceType, params.sourceId,
          params.createdById ?? null, params.createdByName ?? null,
        ]
      );
    } catch (err) {
      // No lanzar — solo loguear para no romper la operación principal
      console.error('[FinancesService.autoRecord] Error:', err);
    }
  }

  // ── PRIVATE HELPERS ───────────────────────────────────────────────────────

  private async getCategoryById(tenantId: string, id: string) {
    const [rows] = await db.execute<CategoryRow[]>(
      `SELECT * FROM finance_categories WHERE id = ? AND tenant_id = ?`,
      [id, tenantId]
    );
    if (rows.length === 0) throw new AppError('Categoría no encontrada', 404);
    return this.mapCategory(rows[0]);
  }

  private async getTransactionById(tenantId: string, id: string) {
    const [rows] = await db.execute<TransactionRow[]>(
      `SELECT * FROM finance_transactions WHERE id = ? AND tenant_id = ?`,
      [id, tenantId]
    );
    if (rows.length === 0) throw new AppError('Transacción no encontrada', 404);
    return this.mapTransaction(rows[0]);
  }

  private async getBudgetById(id: string, tenantId: string) {
    const [rows] = await db.execute<BudgetRow[]>(
      `SELECT fb.*, fc.name AS category_name, fc.type AS category_type,
              fc.icon AS category_icon, fc.color AS category_color
       FROM finance_budgets fb
       JOIN finance_categories fc ON fc.id = fb.category_id
       WHERE fb.id = ? AND fb.tenant_id = ?`,
      [id, tenantId]
    );
    if (rows.length === 0) throw new AppError('Presupuesto no encontrado', 404);
    const r = rows[0];
    return {
      id: r.id, categoryId: r.category_id, year: r.year, month: r.month,
      categoryName: r.category_name, categoryType: r.category_type,
      budgetedAmount: Number(r.budgeted_amount), notes: r.notes,
    };
  }

  private mapCategory(r: CategoryRow) {
    return {
      id: r.id, type: r.type, name: r.name, icon: r.icon, color: r.color,
      isSystem: r.is_system === 1, isActive: r.is_active === 1, sortOrder: r.sort_order,
    };
  }

  private mapTransaction(r: TransactionRow) {
    return {
      id: r.id, type: r.type, categoryId: r.category_id, categoryName: r.category_name,
      description: r.description, amount: Number(r.amount),
      transactionDate: r.transaction_date, paymentMethod: r.payment_method,
      receiptUrl: r.receipt_url, receiptNumber: r.receipt_number,
      isRecurring: r.is_recurring === 1, recurrenceType: r.recurrence_type,
      recurrenceDay: r.recurrence_day, sourceType: r.source_type, sourceId: r.source_id,
      notes: r.notes, tags: r.tags ? JSON.parse(r.tags) : null,
      createdByName: r.created_by_name, createdAt: r.created_at,
    };
  }
}

export const financesService = new FinancesService();
