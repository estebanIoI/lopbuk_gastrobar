import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config';
import { AppError } from '../../common/middleware';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SellerConfig {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  canLogin: boolean;
  commissionType: 'sin_comision' | 'porcentaje' | 'fijo_por_venta' | 'fijo_por_item';
  commissionValue: number;
  salaryBase: number;
  monthlyGoal: number;
  goalBonus: number;
}

export interface PayrollAdjustment {
  id: string;
  tenantId: string;
  sellerId: string;
  sellerName: string;
  periodFrom: string;
  periodTo: string;
  type: 'bono' | 'descuento';
  concept: string;
  amount: number;
  createdAt: Date;
}

export interface PayrollRecord {
  id: string;
  tenantId: string;
  periodFrom: string;
  periodTo: string;
  periodLabel: string;
  sellerId: string;
  sellerName: string;
  totalVentas: number;
  totalMonto: number;
  salaryBase: number;
  commissionType: string;
  commissionValue: number;
  commissionEarned: number;
  monthlyGoal: number;
  goalBonusEarned: number;
  totalBonos: number;
  totalDescuentos: number;
  totalPagar: number;
  status: 'borrador' | 'pagado';
  notes?: string;
  generatedAt: Date;
  paidAt?: Date;
}

interface UserRow extends RowDataPacket {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  can_login: boolean;
  commission_type: string;
  commission_value: number;
  salary_base: number;
  monthly_goal: number;
  goal_bonus: number;
}

interface AdjRow extends RowDataPacket {
  id: string;
  tenant_id: string;
  seller_id: string;
  seller_name: string;
  period_from: Date;
  period_to: Date;
  type: string;
  concept: string;
  amount: number;
  created_at: Date;
}

interface PayrollRow extends RowDataPacket {
  id: string;
  tenant_id: string;
  period_from: Date;
  period_to: Date;
  period_label: string;
  seller_id: string;
  seller_name: string;
  total_ventas: number;
  total_monto: number;
  salary_base: number;
  commission_type: string;
  commission_value: number;
  commission_earned: number;
  monthly_goal: number;
  goal_bonus_earned: number;
  total_bonos: number;
  total_descuentos: number;
  total_pagar: number;
  status: string;
  notes: string | null;
  generated_at: Date;
  paid_at: Date | null;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class VendedoresService {
  // ── Helpers ────────────────────────────────────────────────────────────────

  private mapSeller(row: UserRow): SellerConfig {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      isActive: Boolean(row.is_active),
      canLogin: row.can_login !== false && row.can_login !== 0 as any,
      commissionType: (row.commission_type || 'sin_comision') as SellerConfig['commissionType'],
      commissionValue: Number(row.commission_value || 0),
      salaryBase: Number(row.salary_base || 0),
      monthlyGoal: Number(row.monthly_goal || 0),
      goalBonus: Number(row.goal_bonus || 0),
    };
  }

  private mapAdj(row: AdjRow): PayrollAdjustment {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      sellerId: row.seller_id,
      sellerName: row.seller_name,
      periodFrom: row.period_from instanceof Date ? row.period_from.toISOString().slice(0, 10) : String(row.period_from).slice(0, 10),
      periodTo: row.period_to instanceof Date ? row.period_to.toISOString().slice(0, 10) : String(row.period_to).slice(0, 10),
      type: row.type as 'bono' | 'descuento',
      concept: row.concept,
      amount: Number(row.amount),
      createdAt: row.created_at,
    };
  }

  private mapPayroll(row: PayrollRow): PayrollRecord {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      periodFrom: row.period_from instanceof Date ? row.period_from.toISOString().slice(0, 10) : String(row.period_from).slice(0, 10),
      periodTo: row.period_to instanceof Date ? row.period_to.toISOString().slice(0, 10) : String(row.period_to).slice(0, 10),
      periodLabel: row.period_label,
      sellerId: row.seller_id,
      sellerName: row.seller_name,
      totalVentas: Number(row.total_ventas),
      totalMonto: Number(row.total_monto),
      salaryBase: Number(row.salary_base),
      commissionType: row.commission_type,
      commissionValue: Number(row.commission_value),
      commissionEarned: Number(row.commission_earned),
      monthlyGoal: Number(row.monthly_goal),
      goalBonusEarned: Number(row.goal_bonus_earned),
      totalBonos: Number(row.total_bonos),
      totalDescuentos: Number(row.total_descuentos),
      totalPagar: Number(row.total_pagar),
      status: row.status as 'borrador' | 'pagado',
      notes: row.notes || undefined,
      generatedAt: row.generated_at,
      paidAt: row.paid_at || undefined,
    };
  }

  // ── Sellers list + config ──────────────────────────────────────────────────

  async getSellers(tenantId: string): Promise<SellerConfig[]> {
    const [rows] = await db.execute<UserRow[]>(
      `SELECT id, name, email, role, is_active, can_login,
              COALESCE(commission_type, 'sin_comision') AS commission_type,
              COALESCE(commission_value, 0)             AS commission_value,
              COALESCE(salary_base, 0)                  AS salary_base,
              COALESCE(monthly_goal, 0)                 AS monthly_goal,
              COALESCE(goal_bonus, 0)                   AS goal_bonus
       FROM users
       WHERE tenant_id = ? AND role IN ('vendedor', 'comerciante')
       ORDER BY name ASC`,
      [tenantId]
    );
    return rows.map(this.mapSeller.bind(this));
  }

  async updateSellerConfig(
    tenantId: string,
    sellerId: string,
    data: {
      commissionType: string;
      commissionValue: number;
      salaryBase: number;
      monthlyGoal: number;
      goalBonus: number;
    }
  ): Promise<SellerConfig> {
    // Verify seller belongs to tenant
    const [check] = await db.execute<RowDataPacket[]>(
      'SELECT id FROM users WHERE id = ? AND tenant_id = ?',
      [sellerId, tenantId]
    );
    if (check.length === 0) throw new AppError('Vendedor no encontrado', 404);

    await db.execute(
      `UPDATE users
       SET commission_type = ?, commission_value = ?, salary_base = ?, monthly_goal = ?, goal_bonus = ?
       WHERE id = ? AND tenant_id = ?`,
      [data.commissionType, data.commissionValue, data.salaryBase, data.monthlyGoal, data.goalBonus, sellerId, tenantId]
    );

    const [rows] = await db.execute<UserRow[]>(
      `SELECT id, name, email, role, is_active, can_login,
              COALESCE(commission_type, 'sin_comision') AS commission_type,
              COALESCE(commission_value, 0)             AS commission_value,
              COALESCE(salary_base, 0)                  AS salary_base,
              COALESCE(monthly_goal, 0)                 AS monthly_goal,
              COALESCE(goal_bonus, 0)                   AS goal_bonus
       FROM users WHERE id = ?`,
      [sellerId]
    );
    return this.mapSeller(rows[0]);
  }

  // ── Performance (ventas + comisión calculada) ──────────────────────────────

  async getPerformance(tenantId: string, from?: string, to?: string): Promise<any[]> {
    const conds = ['s.tenant_id = ?', "s.status = 'completada'"];
    const params: (string | Date)[] = [tenantId];

    if (from) { conds.push('s.created_at >= ?'); params.push(new Date(from + 'T00:00:00')); }
    if (to)   { conds.push('s.created_at <= ?'); params.push(new Date(to   + 'T23:59:59')); }

    const where = conds.join(' AND ');

    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT
         s.seller_id,
         s.seller_name,
         COUNT(s.id)                                                                          AS total_ventas,
         COALESCE(SUM(s.total), 0)                                                            AS total_monto,
         COALESCE(AVG(s.total), 0)                                                            AS promedio_venta,
         COALESCE(SUM(CASE WHEN s.payment_method='efectivo'      THEN s.total ELSE 0 END),0) AS total_efectivo,
         COALESCE(SUM(CASE WHEN s.payment_method='tarjeta'       THEN s.total ELSE 0 END),0) AS total_tarjeta,
         COALESCE(SUM(CASE WHEN s.payment_method='transferencia' THEN s.total ELSE 0 END),0) AS total_transferencia,
         COALESCE(SUM(CASE WHEN s.payment_method='fiado'         THEN s.total ELSE 0 END),0) AS total_fiado,
         COALESCE(SUM(agg.qty), 0)                                                            AS total_items
       FROM sales s
       LEFT JOIN (SELECT sale_id, SUM(quantity) AS qty FROM sale_items GROUP BY sale_id) agg ON agg.sale_id = s.id
       WHERE ${where}
       GROUP BY s.seller_id, s.seller_name
       ORDER BY total_monto DESC`,
      params
    );

    // Enrich with commission config
    const [sellers] = await db.execute<UserRow[]>(
      `SELECT id, COALESCE(commission_type,'sin_comision') AS commission_type,
              COALESCE(commission_value,0) AS commission_value,
              COALESCE(salary_base,0) AS salary_base,
              COALESCE(monthly_goal,0) AS monthly_goal,
              COALESCE(goal_bonus,0) AS goal_bonus
       FROM users WHERE tenant_id = ?`,
      [tenantId]
    );
    const sellerMap = new Map(sellers.map(s => [s.id, s]));

    return rows.map((r) => {
      const cfg = sellerMap.get(r.seller_id) || null;
      const totalMonto = Number(r.total_monto);
      const totalVentas = Number(r.total_ventas);
      const totalItems = Number(r.total_items);

      let commissionEarned = 0;
      if (cfg) {
        const ct = cfg.commission_type;
        const cv = Number(cfg.commission_value);
        if (ct === 'porcentaje') commissionEarned = (totalMonto * cv) / 100;
        else if (ct === 'fijo_por_venta') commissionEarned = totalVentas * cv;
        else if (ct === 'fijo_por_item')  commissionEarned = totalItems * cv;
      }

      // Goal bonus
      const monthlyGoal = cfg ? Number(cfg.monthly_goal) : 0;
      const goalBonus   = cfg ? Number(cfg.goal_bonus)   : 0;
      const goalPct     = monthlyGoal > 0 ? Math.min((totalMonto / monthlyGoal) * 100, 100) : 0;
      const goalBonusEarned = (monthlyGoal > 0 && totalMonto >= monthlyGoal) ? goalBonus : 0;

      return {
        seller_id: r.seller_id,
        seller_name: r.seller_name,
        total_ventas: totalVentas,
        total_monto: totalMonto,
        promedio_venta: Number(r.promedio_venta),
        total_efectivo: Number(r.total_efectivo),
        total_tarjeta: Number(r.total_tarjeta),
        total_transferencia: Number(r.total_transferencia),
        total_fiado: Number(r.total_fiado),
        total_items: totalItems,
        // Commission
        commission_type: cfg?.commission_type || 'sin_comision',
        commission_value: cfg ? Number(cfg.commission_value) : 0,
        salary_base: cfg ? Number(cfg.salary_base) : 0,
        commission_earned: commissionEarned,
        monthly_goal: monthlyGoal,
        goal_pct: goalPct,
        goal_bonus: goalBonus,
        goal_bonus_earned: goalBonusEarned,
        estimated_total: (cfg ? Number(cfg.salary_base) : 0) + commissionEarned + goalBonusEarned,
      };
    });
  }

  // ── Adjustments (bonos / descuentos) ──────────────────────────────────────

  async getAdjustments(tenantId: string, from: string, to: string, sellerId?: string): Promise<PayrollAdjustment[]> {
    const conds = ['tenant_id = ?', 'period_from >= ?', 'period_to <= ?'];
    const params: string[] = [tenantId, from, to];
    if (sellerId) { conds.push('seller_id = ?'); params.push(sellerId); }

    const [rows] = await db.execute<AdjRow[]>(
      `SELECT * FROM payroll_adjustments WHERE ${conds.join(' AND ')} ORDER BY created_at DESC`,
      params
    );
    return rows.map(this.mapAdj.bind(this));
  }

  async addAdjustment(tenantId: string, data: {
    sellerId: string;
    sellerName: string;
    periodFrom: string;
    periodTo: string;
    type: 'bono' | 'descuento';
    concept: string;
    amount: number;
    createdBy: string;
  }): Promise<PayrollAdjustment> {
    const id = uuidv4();
    await db.execute(
      `INSERT INTO payroll_adjustments (id, tenant_id, seller_id, seller_name, period_from, period_to, type, concept, amount, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, tenantId, data.sellerId, data.sellerName, data.periodFrom, data.periodTo, data.type, data.concept, data.amount, data.createdBy]
    );
    const [rows] = await db.execute<AdjRow[]>('SELECT * FROM payroll_adjustments WHERE id = ?', [id]);
    return this.mapAdj(rows[0]);
  }

  async deleteAdjustment(tenantId: string, id: string): Promise<void> {
    const [r] = await db.execute<ResultSetHeader>(
      'DELETE FROM payroll_adjustments WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (r.affectedRows === 0) throw new AppError('Ajuste no encontrado', 404);
  }

  // ── Payroll generation ─────────────────────────────────────────────────────

  async generatePayroll(tenantId: string, data: {
    periodFrom: string;
    periodTo: string;
    periodLabel: string;
    generatedBy: string;
  }): Promise<PayrollRecord[]> {
    const performance = await this.getPerformance(tenantId, data.periodFrom, data.periodTo);
    const adjustments = await this.getAdjustments(tenantId, data.periodFrom, data.periodTo);

    const records: PayrollRecord[] = [];

    for (const p of performance) {
      const sellerAdjs = adjustments.filter(a => a.sellerId === p.seller_id);
      const totalBonos      = sellerAdjs.filter(a => a.type === 'bono').reduce((s, a) => s + a.amount, 0);
      const totalDescuentos = sellerAdjs.filter(a => a.type === 'descuento').reduce((s, a) => s + a.amount, 0);
      const totalPagar = p.salary_base + p.commission_earned + p.goal_bonus_earned + totalBonos - totalDescuentos;

      const id = uuidv4();
      await db.execute(
        `INSERT INTO payroll_records (id, tenant_id, period_from, period_to, period_label,
           seller_id, seller_name, total_ventas, total_monto, salary_base, commission_type,
           commission_value, commission_earned, monthly_goal, goal_bonus_earned,
           total_bonos, total_descuentos, total_pagar, status, generated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'borrador', ?)`,
        [
          id, tenantId, data.periodFrom, data.periodTo, data.periodLabel,
          p.seller_id, p.seller_name, p.total_ventas, p.total_monto,
          p.salary_base, p.commission_type, p.commission_value, p.commission_earned,
          p.monthly_goal, p.goal_bonus_earned, totalBonos, totalDescuentos, totalPagar,
          data.generatedBy,
        ]
      );

      const [rows] = await db.execute<PayrollRow[]>('SELECT * FROM payroll_records WHERE id = ?', [id]);
      records.push(this.mapPayroll(rows[0]));
    }

    return records;
  }

  async getPayrollHistory(tenantId: string, page = 1, limit = 20): Promise<{ data: PayrollRecord[]; pagination: any }> {
    const offset = (page - 1) * limit;
    const [countRows] = await db.execute<RowDataPacket[]>(
      'SELECT COUNT(*) AS total FROM payroll_records WHERE tenant_id = ?',
      [tenantId]
    );
    const total = countRows[0].total;

    const [rows] = await db.execute<PayrollRow[]>(
      'SELECT * FROM payroll_records WHERE tenant_id = ? ORDER BY period_from DESC, seller_name ASC LIMIT ? OFFSET ?',
      [tenantId, String(limit), String(offset)]
    );

    return {
      data: rows.map(this.mapPayroll.bind(this)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async markPayrollPaid(tenantId: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    await db.execute(
      `UPDATE payroll_records SET status = 'pagado', paid_at = NOW()
       WHERE id IN (${placeholders}) AND tenant_id = ?`,
      [...ids, tenantId]
    );
  }

  async deletePayrollRecord(tenantId: string, id: string): Promise<void> {
    const [r] = await db.execute<ResultSetHeader>(
      "DELETE FROM payroll_records WHERE id = ? AND tenant_id = ? AND status = 'borrador'",
      [id, tenantId]
    );
    if (r.affectedRows === 0) throw new AppError('Registro no encontrado o ya está pagado', 400);
  }
}

export const vendedoresService = new VendedoresService();
