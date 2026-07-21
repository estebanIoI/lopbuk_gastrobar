/**
 * payments/service.ts
 * Lógica de pagos y deudas del módulo Gimnasio.
 *
 *  - registerPayment  → crea un pago y actualiza lastPaymentAt/nextPaymentAt de la membresía
 *  - voidPayment      → anula un pago (no lo borra), libera la cobertura
 *  - refundPayment    → marca un pago como reembolsado (parcial o total)
 *  - listPayments     → historial por membresía o por tenant (con filtros)
 *  - getBillingSummary → ingresos del mes, por método, miembros al día vs morosos
 *  - getRevenueByPeriod → ingresos día a día en un rango (para gráficas)
 *  - listOverdue      → membresías con pago vencido (nextPaymentAt < hoy)
 *  - generateOverdueDebts → job que crea/actualiza debts a partir de membresías vencidas
 *  - listDebts        → lista de deudas pendientes/pagadas
 *  - payDebt          → aplica un pago a una deuda (parcial o total)
 *  - waiveDebt        → condona una deuda (perdón, solo staff con permisos)
 *
 * Reglas:
 *  - Tenant siempre del JWT (req.user.tenantId) — nunca del body.
 *  - Los pagos anulados/reembolsados NO suman al ingreso del billing summary.
 *  - Si un pago cubre un período, al registrarlo se actualiza el next_payment_at
 *    de la membresía según el payment_cycle.
 */
import { db } from '../../../config';
import { AppError } from '../../../common/middleware';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';

interface Row extends RowDataPacket {}

const VALID_METHODS = [
  'efectivo', 'nequi', 'daviplata', 'bancolombia', 'transferencia',
  'tarjeta', 'sistecredito', 'addi', 'cheque', 'otro',
] as const;

const VALID_STATUSES = ['aplicado', 'anulado', 'reembolsado', 'pendiente'] as const;

type PaymentMethod = typeof VALID_METHODS[number];
type PaymentStatus = typeof VALID_STATUSES[number];

/**
 * Crea las tablas gym_payments y gym_debts si no existen.
 * Esto es un fallback para entornos donde no se ha corrido la migración
 * (el dev usa esto, en prod las crea el script de migración).
 * Idempotente: CREATE TABLE IF NOT EXISTS.
 */
let _tablesEnsured = false
export async function ensurePaymentsTables() {
  if (_tablesEnsured) return
  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS gym_payments (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      membresia_id VARCHAR(36) NOT NULL,
      member_user_id VARCHAR(36) NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      currency VARCHAR(8) DEFAULT 'COP' NOT NULL,
      method ENUM('efectivo','nequi','daviplata','bancolombia','transferencia','tarjeta','sistecredito','addi','cheque','otro') NOT NULL,
      reference VARCHAR(120),
      status ENUM('aplicado','anulado','reembolsado','pendiente') DEFAULT 'aplicado' NOT NULL,
      voided_at DATETIME,
      voided_by VARCHAR(36),
      void_reason TEXT,
      refunded_at DATETIME,
      refunded_amount DECIMAL(12,2),
      period_start DATE,
      period_end DATE,
      concept VARCHAR(160),
      notes TEXT,
      received_by VARCHAR(36),
      payment_date DATETIME NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_gym_pay_tenant (tenant_id, payment_date),
      INDEX idx_gym_pay_member (member_user_id, payment_date),
      INDEX idx_gym_pay_membresia (membresia_id),
      INDEX idx_gym_pay_status (tenant_id, status)
    )`)
    await db.execute(`CREATE TABLE IF NOT EXISTS gym_debts (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      membresia_id VARCHAR(36) NOT NULL,
      member_user_id VARCHAR(36) NOT NULL,
      original_amount DECIMAL(12,2) NOT NULL,
      surcharge_pct DECIMAL(5,2) DEFAULT 0.00 NOT NULL,
      surcharge_amount DECIMAL(12,2) DEFAULT 0.00 NOT NULL,
      total_due DECIMAL(12,2) NOT NULL,
      paid_amount DECIMAL(12,2) DEFAULT 0.00 NOT NULL,
      due_date DATE NOT NULL,
      status ENUM('pendiente','pagado','vencido','condonado') DEFAULT 'pendiente' NOT NULL,
      paid_at DATETIME,
      concept VARCHAR(200),
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_gym_debt_tenant (tenant_id, status),
      INDEX idx_gym_debt_member (member_user_id, status),
      INDEX idx_gym_debt_due (due_date, status)
    )`)
    _tablesEnsured = true
  } catch (e) {
    // Si falla, las queries siguientes también fallarán — el caller verá el error
    console.error('[gym/payments] ensurePaymentsTables:', (e as any)?.message || e)
  }
}

/** Calcula el próximo pago según el ciclo de la membresía. */
function computeNextPaymentAt(cycle: string, fromDate: string): string {
  const d = new Date(fromDate);
  if (cycle === 'mensual') d.setMonth(d.getMonth() + 1);
  else if (cycle === 'trimestral') d.setMonth(d.getMonth() + 3);
  else if (cycle === 'semestral') d.setMonth(d.getMonth() + 6);
  else if (cycle === 'anual') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1); // default mensual
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

// ─────────────────────────────────────────────────────────────
// PAGOS
// ─────────────────────────────────────────────────────────────

/**
 * Registra un pago. Si la membresía no existe, error 404.
 * Actualiza lastPaymentAt y nextPaymentAt de la membresía.
 * Si hay debts pendientes del mismo miembro, las marca como pagadas.
 */
export async function registerPayment(tenantId: string, data: any, receivedBy: string) {
  const membresiaId = String(data.membresiaId || '').trim();
  if (!membresiaId) throw new AppError('Se requiere el ID de la membresía', 400);

  const amount = Number(data.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError('El monto debe ser mayor a 0', 400);
  }
  const method: PaymentMethod = (VALID_METHODS as readonly string[]).includes(data.method)
    ? data.method
    : 'efectivo';
  const status: PaymentStatus = (VALID_STATUSES as readonly string[]).includes(data.status)
    ? data.status
    : 'aplicado';

  // 1. Verificar que la membresía existe y pertenece al tenant
  const [memb] = await db.execute<Row[]>(
    `SELECT id, user_id, plan_name, price, payment_cycle, status
     FROM gym_membresias
     WHERE id = ? AND tenant_id = ? LIMIT 1`,
    [membresiaId, tenantId]
  );
  if (!memb.length) throw new AppError('Membresía no encontrada', 404);
  const membresia = memb[0];

  const id = uuidv4();
  const paymentDate = data.paymentDate || new Date().toISOString().slice(0, 19).replace('T', ' ');
  const periodStart = data.periodStart || null;
  const periodEnd = data.periodEnd || null;
  const reference = data.reference || null;
  const concept = data.concept || (membresia.plan_name ? `Membresía ${membresia.plan_name}` : 'Membresía');
  const notes = data.notes || null;

  // 2. Insertar el pago
  await db.execute<ResultSetHeader>(
    `INSERT INTO gym_payments
     (id, tenant_id, membresia_id, member_user_id, amount, currency, method, reference,
      status, period_start, period_end, concept, notes, received_by, payment_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, tenantId, membresiaId, membresia.user_id, amount, 'COP', method, reference,
     status, periodStart, periodEnd, concept, notes, receivedBy, paymentDate]
  );

  // 3. Si el pago fue aplicado, actualizar la membresía
  if (status === 'aplicado') {
    const nextAt = computeNextPaymentAt(membresia.payment_cycle || 'mensual', paymentDate);
    await db.execute<ResultSetHeader>(
      `UPDATE gym_membresias
       SET last_payment_at = ?, next_payment_at = ?, status = 'activa'
       WHERE id = ? AND tenant_id = ?`,
      [paymentDate, nextAt, membresiaId, tenantId]
    );

    // 4. Si hay debts pendientes del mismo miembro, marcarlas como pagadas
    await db.execute<ResultSetHeader>(
      `UPDATE gym_debts
       SET status = 'pagado', paid_at = NOW(), paid_amount = total_due
       WHERE tenant_id = ? AND member_user_id = ? AND status IN ('pendiente', 'vencido')`,
      [tenantId, membresia.user_id]
    );
  }

  return { id, status, paymentDate, nextPaymentAt: status === 'aplicado' ? computeNextPaymentAt(membresia.payment_cycle, paymentDate) : null };
}

/** Lista pagos con filtros. */
export async function listPayments(tenantId: string, filters: any = {}) {
  const params: any[] = [tenantId];
  let where = 'p.tenant_id = ?';
  if (filters.memberUserId) { where += ' AND p.member_user_id = ?'; params.push(filters.memberUserId); }
  if (filters.membresiaId) { where += ' AND p.membresia_id = ?'; params.push(filters.membresiaId); }
  if (filters.status) { where += ' AND p.status = ?'; params.push(filters.status); }
  if (filters.method) { where += ' AND p.method = ?'; params.push(filters.method); }
  if (filters.from) { where += ' AND p.payment_date >= ?'; params.push(filters.from); }
  if (filters.to) { where += ' AND p.payment_date <= ?'; params.push(filters.to); }

  const limit = Math.min(Number(filters.limit) || 200, 1000);
  const offset = Math.max(Number(filters.offset) || 0, 0);

  const [rows] = await db.execute<Row[]>(
    `SELECT p.id, p.tenant_id AS tenantId, p.membresia_id AS membresiaId,
            p.member_user_id AS memberUserId, p.amount, p.currency, p.method, p.reference,
            p.status, p.voided_at AS voidedAt, p.voided_by AS voidedBy, p.void_reason AS voidReason,
            p.refunded_at AS refundedAt, p.refunded_amount AS refundedAmount,
            p.period_start AS periodStart, p.period_end AS periodEnd,
            p.concept, p.notes, p.received_by AS receivedBy,
            p.payment_date AS paymentDate, p.created_at AS createdAt,
            u.name AS memberName, u.email AS memberEmail,
            m.plan_name AS planName, m.payment_cycle AS paymentCycle
     FROM gym_payments p
     LEFT JOIN users u ON u.id = p.member_user_id
     LEFT JOIN gym_membresias m ON m.id = p.membresia_id
     WHERE ${where}
     ORDER BY p.payment_date DESC, p.created_at DESC
     LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  return rows;
}

/** Obtiene un pago por ID. */
export async function getPayment(tenantId: string, paymentId: string) {
  const [rows] = await db.execute<Row[]>(
    `SELECT p.*, u.name AS memberName, u.email AS memberEmail, m.plan_name AS planName
     FROM gym_payments p
     LEFT JOIN users u ON u.id = p.member_user_id
     LEFT JOIN gym_membresias m ON m.id = p.membresia_id
     WHERE p.id = ? AND p.tenant_id = ? LIMIT 1`,
    [paymentId, tenantId]
  );
  if (!rows.length) throw new AppError('Pago no encontrado', 404);
  return rows[0];
}

/** Anula un pago aplicado. Libera nextPaymentAt de la membresía. */
export async function voidPayment(tenantId: string, paymentId: string, data: any, voidedBy: string) {
  const reason = String(data.reason || '').trim();
  if (!reason) throw new AppError('Se requiere un motivo de anulación', 400);

  const [rows] = await db.execute<Row[]>(
    `SELECT id, status, membresia_id, member_user_id, payment_date
     FROM gym_payments WHERE id = ? AND tenant_id = ? LIMIT 1`,
    [paymentId, tenantId]
  );
  if (!rows.length) throw new AppError('Pago no encontrado', 404);
  if (rows[0].status === 'anulado') throw new AppError('El pago ya está anulado', 400);
  if (rows[0].status === 'reembolsado') throw new AppError('El pago ya fue reembolsado', 400);

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  await db.execute<ResultSetHeader>(
    `UPDATE gym_payments
     SET status = 'anulado', voided_at = ?, voided_by = ?, void_reason = ?
     WHERE id = ? AND tenant_id = ?`,
    [now, voidedBy, reason, paymentId, tenantId]
  );

  // Revertir next_payment_at a la fecha del pago (o un día antes para forzar revisión)
  await db.execute<ResultSetHeader>(
    `UPDATE gym_membresias
     SET next_payment_at = DATE_SUB(?, INTERVAL 1 DAY)
     WHERE id = ? AND tenant_id = ?`,
    [rows[0].payment_date, rows[0].membresia_id, tenantId]
  );

  return { id: paymentId, status: 'anulado', voidedAt: now };
}

/** Reembolsa un pago (parcial o total). */
export async function refundPayment(tenantId: string, paymentId: string, data: any, refundedBy: string) {
  const [rows] = await db.execute<Row[]>(
    `SELECT id, status, amount, member_user_id FROM gym_payments WHERE id = ? AND tenant_id = ? LIMIT 1`,
    [paymentId, tenantId]
  );
  if (!rows.length) throw new AppError('Pago no encontrado', 404);
  if (rows[0].status === 'anulado') throw new AppError('No se puede reembolsar un pago anulado', 400);
  if (rows[0].status === 'reembolsado') throw new AppError('El pago ya fue reembolsado', 400);

  const amount = Number(data.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > Number(rows[0].amount)) {
    throw new AppError('Monto de reembolso inválido', 400);
  }
  const isFull = Math.abs(amount - Number(rows[0].amount)) < 0.01;
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  await db.execute<ResultSetHeader>(
    `UPDATE gym_payments
     SET status = ?, refunded_at = ?, refunded_amount = ?
     WHERE id = ? AND tenant_id = ?`,
    [isFull ? 'reembolsado' : 'aplicado', now, amount, paymentId, tenantId]
  );

  return { id: paymentId, refundedAmount: amount, isFull };
}

// ─────────────────────────────────────────────────────────────
// DEUDAS Y MOROSIDAD
// ─────────────────────────────────────────────────────────────

/**
 * Genera/actualiza debts a partir de membresías con next_payment_at vencido.
 * Llamar manualmente desde la UI (botón "Actualizar morosidad") o en cron.
 * Si ya existe una debt pendiente para la misma membresía, no duplica.
 */
export async function generateOverdueDebts(tenantId: string) {
  const today = new Date().toISOString().slice(0, 10);
  // Buscar membresías con pago vencido
  const [overdue] = await db.execute<Row[]>(
    `SELECT m.id AS membresiaId, m.user_id AS memberUserId, m.price, m.plan_name,
            m.next_payment_at AS nextPaymentAt,
            DATEDIFF(?, m.next_payment_at) AS daysOverdue
     FROM gym_membresias m
     WHERE m.tenant_id = ?
       AND m.status = 'activa'
       AND m.next_payment_at IS NOT NULL
       AND m.next_payment_at < ?
       AND NOT EXISTS (
         SELECT 1 FROM gym_debts d
         WHERE d.membresia_id = m.id AND d.status IN ('pendiente','vencido')
       )`,
    [today, tenantId, today]
  );

  let created = 0;
  for (const row of overdue) {
    const id = uuidv4();
    const originalAmount = Number(row.price) || 0;
    // Recargo progresivo: 0% primera semana, 5% segunda, 10% tercera, 15% después
    const days = Number(row.daysOverdue) || 0;
    const surchargePct = days <= 7 ? 0 : days <= 14 ? 5 : days <= 21 ? 10 : 15;
    const surchargeAmount = Math.round(originalAmount * surchargePct) / 100;
    const totalDue = originalAmount + surchargeAmount;
    const dueDate = String(row.nextPaymentAt).slice(0, 10);

    await db.execute<ResultSetHeader>(
      `INSERT INTO gym_debts
       (id, tenant_id, membresia_id, member_user_id, original_amount,
        surcharge_pct, surcharge_amount, total_due, paid_amount,
        due_date, status, concept)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      [id, tenantId, row.membresiaId, row.memberUserId, originalAmount,
       surchargePct, surchargeAmount, totalDue, dueDate,
       days > 0 ? 'vencido' : 'pendiente',
       row.plan_name ? `Membresía ${row.plan_name}` : 'Membresía vencida']
    );
    created++;
  }
  return { created };
}

/** Lista deudas. */
export async function listDebts(tenantId: string, filters: any = {}) {
  const params: any[] = [tenantId];
  let where = 'd.tenant_id = ?';
  if (filters.memberUserId) { where += ' AND d.member_user_id = ?'; params.push(filters.memberUserId); }
  if (filters.membresiaId) { where += ' AND d.membresia_id = ?'; params.push(filters.membresiaId); }
  if (filters.status) { where += ' AND d.status = ?'; params.push(filters.status); }

  const [rows] = await db.execute<Row[]>(
    `SELECT d.id, d.tenant_id AS tenantId, d.membresia_id AS membresiaId,
            d.member_user_id AS memberUserId,
            d.original_amount AS originalAmount,
            d.surcharge_pct AS surchargePct, d.surcharge_amount AS surchargeAmount,
            d.total_due AS totalDue, d.paid_amount AS paidAmount,
            d.due_date AS dueDate, d.status, d.paid_at AS paidAt,
            d.concept, d.notes, d.created_at AS createdAt,
            u.name AS memberName, u.email AS memberEmail,
            m.plan_name AS planName,
            DATEDIFF(CURDATE(), d.due_date) AS daysOverdue
     FROM gym_debts d
     LEFT JOIN users u ON u.id = d.member_user_id
     LEFT JOIN gym_membresias m ON m.id = d.membresia_id
     WHERE ${where}
     ORDER BY d.due_date ASC`,
    params
  );
  return rows;
}

/** Aplica un pago a una deuda (parcial o total). */
export async function payDebt(tenantId: string, debtId: string, data: any) {
  const [rows] = await db.execute<Row[]>(
    `SELECT id, status, total_due, paid_amount, member_user_id, membresia_id
     FROM gym_debts WHERE id = ? AND tenant_id = ? LIMIT 1`,
    [debtId, tenantId]
  );
  if (!rows.length) throw new AppError('Deuda no encontrada', 404);
  if (rows[0].status === 'pagado') throw new AppError('La deuda ya está pagada', 400);

  const totalDue = Number(rows[0].total_due);
  const paidSoFar = Number(rows[0].paid_amount);
  const remaining = totalDue - paidSoFar;
  const amount = Number(data.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > remaining) {
    throw new AppError(`Monto inválido. Pendiente: $${remaining.toLocaleString('es-CO')}`, 400);
  }
  const newPaid = paidSoFar + amount;
  const isFull = Math.abs(newPaid - totalDue) < 0.01;
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  await db.execute<ResultSetHeader>(
    `UPDATE gym_debts SET paid_amount = ?, status = ?, paid_at = ? WHERE id = ? AND tenant_id = ?`,
    [newPaid, isFull ? 'pagado' : 'pendiente', isFull ? now : null, debtId, tenantId]
  );

  // Si se pagó completa, crear un pago automático en gym_payments
  if (isFull) {
    const paymentId = uuidv4();
    await db.execute<ResultSetHeader>(
      `INSERT INTO gym_payments
       (id, tenant_id, membresia_id, member_user_id, amount, currency, method,
        status, concept, received_by, payment_date, notes)
       VALUES (?, ?, ?, ?, ?, 'COP', ?, 'aplicado', ?, ?, ?, ?)`,
      [paymentId, tenantId, rows[0].membresia_id, rows[0].member_user_id,
       amount, data.method || 'efectivo',
       `Pago de deuda: ${data.concept || 'Regularización'}`,
       data.receivedBy || null, now,
       `Generado automáticamente al pagar deuda ${debtId}`]
    );

    // Actualizar membresía
    const [memb] = await db.execute<Row[]>(
      `SELECT payment_cycle FROM gym_membresias WHERE id = ? LIMIT 1`,
      [rows[0].membresia_id]
    );
    if (memb.length) {
      const nextAt = computeNextPaymentAt(memb[0].payment_cycle || 'mensual', now);
      await db.execute<ResultSetHeader>(
        `UPDATE gym_membresias
         SET last_payment_at = ?, next_payment_at = ?, status = 'activa'
         WHERE id = ? AND tenant_id = ?`,
        [now, nextAt, rows[0].membresia_id, tenantId]
      );
    }
  }

  return { id: debtId, paidAmount: amount, newPaid, isFull };
}

/** Condona una deuda (staff la marca como perdonada, no requiere pago). */
export async function waiveDebt(tenantId: string, debtId: string, data: any) {
  const reason = String(data.reason || '').trim();
  if (!reason) throw new AppError('Se requiere un motivo para condonar', 400);

  const [result] = await db.execute<ResultSetHeader>(
    `UPDATE gym_debts SET status = 'condonado', notes = CONCAT(IFNULL(notes,''), '\n[Condonado] ', ?)
     WHERE id = ? AND tenant_id = ? AND status IN ('pendiente','vencido')`,
    [reason, debtId, tenantId]
  );
  if (result.affectedRows === 0) throw new AppError('Deuda no encontrada o ya no está pendiente', 404);
  return { id: debtId, status: 'condonado' };
}

// ─────────────────────────────────────────────────────────────
// REPORTES / BILLING SUMMARY
// ─────────────────────────────────────────────────────────────

/** Resumen financiero del tenant. */
export async function getBillingSummary(tenantId: string) {
  const [rows] = await db.execute<Row[]>(
    `SELECT
       COALESCE(SUM(CASE WHEN p.status = 'aplicado' AND YEAR(p.payment_date) = YEAR(CURDATE()) AND MONTH(p.payment_date) = MONTH(CURDATE()) THEN p.amount ELSE 0 END), 0) AS ingresosMes,
       COALESCE(SUM(CASE WHEN p.status = 'aplicado' AND p.payment_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN p.amount ELSE 0 END), 0) AS ingresos30d,
       COALESCE(SUM(CASE WHEN p.status = 'aplicado' AND p.payment_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN p.amount ELSE 0 END), 0) AS ingresos7d,
       COUNT(CASE WHEN p.status = 'aplicado' AND YEAR(p.payment_date) = YEAR(CURDATE()) AND MONTH(p.payment_date) = MONTH(CURDATE()) THEN 1 END) AS pagosMes,
       COALESCE(SUM(CASE WHEN p.status = 'anulado' AND YEAR(p.payment_date) = YEAR(CURDATE()) AND MONTH(p.payment_date) = MONTH(CURDATE()) THEN p.amount ELSE 0 END), 0) AS anuladoMes,
       COALESCE(SUM(CASE WHEN p.status = 'reembolsado' AND YEAR(p.payment_date) = YEAR(CURDATE()) AND MONTH(p.payment_date) = MONTH(CURDATE()) THEN p.refunded_amount ELSE 0 END), 0) AS reembolsadoMes
     FROM gym_payments p
     WHERE p.tenant_id = ?`,
    [tenantId]
  );
  const summary: any = rows[0] || {};

  // Deuda total pendiente
  const [debtRows] = await db.execute<Row[]>(
    `SELECT
       COALESCE(SUM(total_due - paid_amount), 0) AS deudaTotal,
       COUNT(CASE WHEN status IN ('pendiente','vencido') THEN 1 END) AS numDeudas
     FROM gym_debts WHERE tenant_id = ? AND status IN ('pendiente','vencido')`,
    [tenantId]
  );
  const debt: any = debtRows[0] || {};

  // Miembros morosos (nextPaymentAt < hoy y status activa)
  const [overdueRows] = await db.execute<Row[]>(
    `SELECT COUNT(*) AS morosos
     FROM gym_membresias
     WHERE tenant_id = ? AND status = 'activa' AND next_payment_at IS NOT NULL AND next_payment_at < CURDATE()`,
    [tenantId]
  );
  const morosos = Number(overdueRows[0]?.morosos) || 0;

  // Por método de pago (últimos 30 días)
  const [methodRows] = await db.execute<Row[]>(
    `SELECT method, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
     FROM gym_payments
     WHERE tenant_id = ? AND status = 'aplicado' AND payment_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
     GROUP BY method
     ORDER BY total DESC`,
    [tenantId]
  );

  return {
    ingresosMes: Number(summary.ingresosMes) || 0,
    ingresos30d: Number(summary.ingresos30d) || 0,
    ingresos7d: Number(summary.ingresos7d) || 0,
    pagosMes: Number(summary.pagosMes) || 0,
    anuladoMes: Number(summary.anuladoMes) || 0,
    reembolsadoMes: Number(summary.reembolsadoMes) || 0,
    deudaTotal: Number(debt.deudaTotal) || 0,
    numDeudas: Number(debt.numDeudas) || 0,
    morosos,
    porMetodo: methodRows,
  };
}

/** Ingresos por día en un rango (para gráficas). */
export async function getRevenueByPeriod(tenantId: string, from: string, to: string) {
  const [rows] = await db.execute<Row[]>(
    `SELECT DATE(payment_date) AS day,
            COALESCE(SUM(amount), 0) AS total,
            COUNT(*) AS count
     FROM gym_payments
     WHERE tenant_id = ? AND status = 'aplicado' AND DATE(payment_date) BETWEEN ? AND ?
     GROUP BY DATE(payment_date)
     ORDER BY day ASC`,
    [tenantId, from, to]
  );
  return rows;
}

/** Lista de miembros con pago vencido. */
export async function listOverdue(tenantId: string) {
  const [rows] = await db.execute<Row[]>(
    `SELECT m.id AS membresiaId, m.user_id AS memberUserId, u.name, u.email, u.phone,
            m.plan_name AS planName, m.price, m.payment_cycle AS paymentCycle,
            m.next_payment_at AS nextPaymentAt,
            DATEDIFF(CURDATE(), m.next_payment_at) AS daysOverdue
     FROM gym_membresias m
     LEFT JOIN users u ON u.id = m.user_id
     WHERE m.tenant_id = ? AND m.status = 'activa'
       AND m.next_payment_at IS NOT NULL AND m.next_payment_at < CURDATE()
     ORDER BY m.next_payment_at ASC`,
    [tenantId]
  );
  return rows;
}
