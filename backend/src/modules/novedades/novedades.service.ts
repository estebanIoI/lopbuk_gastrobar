import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config';
import { AppError } from '../../common/middleware';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NovedadType =
  | 'vacaciones'
  | 'permiso_remunerado'
  | 'permiso_no_remunerado'
  | 'incapacidad'
  | 'calamidad'
  | 'licencia_maternidad'
  | 'suspension'
  | 'otro';

export type NovedadStatus = 'pendiente' | 'aprobado' | 'rechazado';

interface NovedadRow extends RowDataPacket {
  id: string;
  tenant_id: string;
  user_id: string;
  user_name: string;
  type: NovedadType;
  start_date: string;
  end_date: string;
  days_count: number;
  deducts_salary: number;
  deduct_amount: number;
  deducts_vacation: number;
  description: string | null;
  attachment_url: string | null;
  status: NovedadStatus;
  rejection_reason: string | null;
  created_by: string | null;
  created_at: Date;
}

interface VacationRow extends RowDataPacket {
  id: string;
  tenant_id: string;
  user_id: string;
  user_name: string;
  year: number;
  days_granted: number;
  days_used: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Rules for each novelty type */
const NOVELTY_RULES: Record<NovedadType, { deductsSalary: boolean; deductsVacation: boolean }> = {
  vacaciones:              { deductsSalary: false, deductsVacation: true  },
  permiso_remunerado:      { deductsSalary: false, deductsVacation: true  },
  permiso_no_remunerado:   { deductsSalary: true,  deductsVacation: false },
  incapacidad:             { deductsSalary: false, deductsVacation: false }, // EPS covers
  calamidad:               { deductsSalary: false, deductsVacation: false },
  licencia_maternidad:     { deductsSalary: false, deductsVacation: false },
  suspension:              { deductsSalary: true,  deductsVacation: false },
  otro:                    { deductsSalary: false, deductsVacation: false },
};

/** Calculate working days between two dates (Mon–Sat) */
function calcDays(startDate: string, endDate: string): number {
  const start = new Date(startDate + 'T00:00:00');
  const end   = new Date(endDate   + 'T00:00:00');
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay(); // 0=Sun
    if (day !== 0) count++; // exclude Sunday
    cur.setDate(cur.getDate() + 1);
  }
  return Math.max(count, 1);
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class NovedadesService {

  // ── Novedades CRUD ─────────────────────────────────────────────────────────

  async findAll(tenantId: string, filters?: {
    userId?: string;
    type?: NovedadType;
    status?: NovedadStatus;
    from?: string;
    to?: string;
  }) {
    let sql = `
      SELECT n.*, u.salary_base
      FROM employee_novelties n
      JOIN users u ON n.user_id = u.id
      WHERE n.tenant_id = ?
    `;
    const params: any[] = [tenantId];

    if (filters?.userId) { sql += ' AND n.user_id = ?'; params.push(filters.userId); }
    if (filters?.type)   { sql += ' AND n.type = ?';    params.push(filters.type); }
    if (filters?.status) { sql += ' AND n.status = ?';  params.push(filters.status); }
    if (filters?.from)   { sql += ' AND n.start_date >= ?'; params.push(filters.from); }
    if (filters?.to)     { sql += ' AND n.end_date <= ?';   params.push(filters.to); }

    sql += ' ORDER BY n.start_date DESC';

    const [rows] = await db.execute<NovedadRow[]>(sql, params);
    return rows.map(this.mapNovelty);
  }

  async create(tenantId: string, data: {
    userId: string;
    type: NovedadType;
    startDate: string;
    endDate: string;
    description?: string;
    attachmentUrl?: string;
    createdBy?: string;
  }) {
    // Validate user exists in tenant
    const [userRows] = await db.execute<RowDataPacket[]>(
      'SELECT id, name, salary_base FROM users WHERE id = ? AND tenant_id = ?',
      [data.userId, tenantId]
    );
    if (userRows.length === 0) throw new AppError('Empleado no encontrado', 404);
    const user = userRows[0];

    const rules = NOVELTY_RULES[data.type];
    const days = calcDays(data.startDate, data.endDate);

    // Calculate salary deduction (daily rate = salary_base / 30)
    let deductAmount = 0;
    if (rules.deductsSalary && user.salary_base > 0) {
      const dailyRate = Number(user.salary_base) / 30;
      deductAmount = Math.round(dailyRate * days * 100) / 100;
    }

    const id = uuidv4();
    await db.execute<ResultSetHeader>(
      `INSERT INTO employee_novelties
       (id, tenant_id, user_id, user_name, type, start_date, end_date, days_count,
        deducts_salary, deduct_amount, deducts_vacation, description, attachment_url, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, tenantId, data.userId, user.name, data.type,
        data.startDate, data.endDate, days,
        rules.deductsSalary ? 1 : 0, deductAmount,
        rules.deductsVacation ? 1 : 0,
        data.description || null, data.attachmentUrl || null,
        data.createdBy || null,
      ]
    );

    return this.findById(tenantId, id);
  }

  async updateStatus(tenantId: string, id: string, status: NovedadStatus, rejectionReason?: string) {
    const novelty = await this.findById(tenantId, id);

    await db.execute(
      'UPDATE employee_novelties SET status = ?, rejection_reason = ? WHERE id = ? AND tenant_id = ?',
      [status, rejectionReason || null, id, tenantId]
    );

    // If approved and deducts vacation → update vacation balance
    if (status === 'aprobado' && novelty.deductsVacation && novelty.status !== 'aprobado') {
      await this.adjustVacationBalance(tenantId, novelty.userId, novelty.startDate, novelty.daysCount);
    }
    // If un-approved (rejected after approved) → reverse vacation balance
    if (status === 'rechazado' && novelty.deductsVacation && novelty.status === 'aprobado') {
      await this.adjustVacationBalance(tenantId, novelty.userId, novelty.startDate, -novelty.daysCount);
    }

    return this.findById(tenantId, id);
  }

  async delete(tenantId: string, id: string) {
    const novelty = await this.findById(tenantId, id);

    // Reverse vacation balance if was approved
    if (novelty.status === 'aprobado' && novelty.deductsVacation) {
      await this.adjustVacationBalance(tenantId, novelty.userId, novelty.startDate, -novelty.daysCount);
    }

    const [result] = await db.execute<ResultSetHeader>(
      'DELETE FROM employee_novelties WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (result.affectedRows === 0) throw new AppError('Novedad no encontrada', 404);
  }

  async findById(tenantId: string, id: string) {
    const [rows] = await db.execute<NovedadRow[]>(
      'SELECT * FROM employee_novelties WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (rows.length === 0) throw new AppError('Novedad no encontrada', 404);
    return this.mapNovelty(rows[0]);
  }

  // ── Vacation Balances ──────────────────────────────────────────────────────

  async getVacationBalances(tenantId: string, year?: number) {
    const targetYear = year || new Date().getFullYear();

    // Get all employees + their balance for the year (auto-create if missing)
    // Includes all roles managed by the comerciante
    const [employees] = await db.execute<RowDataPacket[]>(
      `SELECT u.id, u.name, u.role, u.cargo_id, ec.name AS cargo_name
       FROM users u
       LEFT JOIN employee_cargos ec ON u.cargo_id = ec.id
       WHERE u.tenant_id = ?
         AND u.role IN ('vendedor','mesero','cocinero','cajero','bartender','administrador_rb')
         AND u.is_active = 1
       ORDER BY u.name ASC`,
      [tenantId]
    );

    const result = [];
    for (const emp of employees) {
      const [balRows] = await db.execute<VacationRow[]>(
        'SELECT * FROM employee_vacation_balances WHERE tenant_id = ? AND user_id = ? AND year = ?',
        [tenantId, emp.id, targetYear]
      );

      let balance;
      if (balRows.length === 0) {
        // Auto-create balance record
        const newId = uuidv4();
        await db.execute(
          'INSERT INTO employee_vacation_balances (id, tenant_id, user_id, year, days_granted, days_used) VALUES (?, ?, ?, ?, 15, 0)',
          [newId, tenantId, emp.id, targetYear]
        );
        balance = { daysGranted: 15, daysUsed: 0 };
      } else {
        balance = { daysGranted: balRows[0].days_granted, daysUsed: balRows[0].days_used };
      }

      result.push({
        userId: emp.id,
        userName: emp.name,
        role: emp.role,
        cargoName: emp.cargo_name || null,
        year: targetYear,
        daysGranted: balance.daysGranted,
        daysUsed: balance.daysUsed,
        daysRemaining: balance.daysGranted - balance.daysUsed,
      });
    }

    return result;
  }

  async updateVacationBalance(tenantId: string, userId: string, year: number, daysGranted: number) {
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT id FROM employee_vacation_balances WHERE tenant_id = ? AND user_id = ? AND year = ?',
      [tenantId, userId, year]
    );

    if (rows.length === 0) {
      await db.execute(
        'INSERT INTO employee_vacation_balances (id, tenant_id, user_id, year, days_granted, days_used) VALUES (?, ?, ?, ?, ?, 0)',
        [uuidv4(), tenantId, userId, year, daysGranted]
      );
    } else {
      await db.execute(
        'UPDATE employee_vacation_balances SET days_granted = ? WHERE tenant_id = ? AND user_id = ? AND year = ?',
        [daysGranted, tenantId, userId, year]
      );
    }
  }

  private async adjustVacationBalance(tenantId: string, userId: string, date: string, deltaDays: number) {
    const year = new Date(date).getFullYear();
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT id, days_used FROM employee_vacation_balances WHERE tenant_id = ? AND user_id = ? AND year = ?',
      [tenantId, userId, year]
    );

    if (rows.length === 0) {
      await db.execute(
        'INSERT INTO employee_vacation_balances (id, tenant_id, user_id, year, days_granted, days_used) VALUES (?, ?, ?, ?, 15, ?)',
        [uuidv4(), tenantId, userId, year, Math.max(0, deltaDays)]
      );
    } else {
      const newUsed = Math.max(0, Number(rows[0].days_used) + deltaDays);
      await db.execute(
        'UPDATE employee_vacation_balances SET days_used = ? WHERE id = ?',
        [newUsed, rows[0].id]
      );
    }
  }

  private mapNovelty(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      userName: row.user_name,
      type: row.type as NovedadType,
      startDate: row.start_date,
      endDate: row.end_date,
      daysCount: row.days_count,
      deductsSalary: row.deducts_salary === 1,
      deductAmount: Number(row.deduct_amount),
      deductsVacation: row.deducts_vacation === 1,
      description: row.description,
      attachmentUrl: row.attachment_url,
      status: row.status as NovedadStatus,
      rejectionReason: row.rejection_reason,
      createdBy: row.created_by,
      createdAt: row.created_at,
    };
  }
}

export const novedadesService = new NovedadesService();
