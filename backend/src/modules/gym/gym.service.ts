/**
 * gym.service.ts
 * Módulo GIMNASIO (tenant-scoped). Un comercio con business_type='gimnasio'
 * gestiona miembros, planes de entrenamiento, progreso físico y asistencia.
 *
 * Dos perspectivas:
 *  - STAFF del gym  → funciones que reciben tenantId (del JWT del comerciante).
 *  - MIEMBRO (cliente) → funciones *Mias que reciben userId (del JWT del cliente).
 *
 * Reglas: lógica solo aquí; filtrar SIEMPRE por tenant_id (staff) o user_id
 * (miembro); AppError para errores; soft-flags donde aplique.
 */
import { db } from '../../config';
import { AppError } from '../../common/middleware';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';

interface Row extends RowDataPacket {}

// ─────────────────────────────────────────────────────────────
// MIEMBROS + MEMBRESÍAS (staff)
// ─────────────────────────────────────────────────────────────
export async function listMembers(tenantId: string, status?: string) {
  const params: any[] = [tenantId];
  let where = 'm.tenant_id = ?';
  if (status) { where += ' AND m.status = ?'; params.push(status); }
  const [rows] = await db.execute<Row[]>(
    `SELECT m.user_id AS userId, u.name, u.email, u.phone, u.avatar,
            m.plan_name AS planName, m.status, m.price, m.payment_cycle AS paymentCycle,
            m.auto_renew AS autoRenew, m.start_date AS startDate, m.end_date AS endDate,
            m.last_payment_at AS lastPaymentAt, m.next_payment_at AS nextPaymentAt
     FROM gym_membresias m
     JOIN users u ON u.id = m.user_id
     WHERE ${where}
     ORDER BY FIELD(m.status,'activa','pausada','vencida','cancelada'), u.name ASC`,
    params
  );
  return rows;
}

/** Vincula un usuario existente (por email) como miembro del gym. */
export async function addMember(tenantId: string, data: any) {
  const email = String(data.email || '').trim().toLowerCase();
  if (!email) throw new AppError('El email del cliente es requerido', 400);

  const [users] = await db.execute<Row[]>(
    "SELECT id, role FROM users WHERE email = ? LIMIT 1", [email]
  );
  if (!users.length) {
    throw new AppError('No existe un usuario con ese email. Pídele que cree su cuenta primero.', 404);
  }
  const userId = users[0].id;

  const [exists] = await db.execute<Row[]>(
    'SELECT user_id FROM gym_membresias WHERE tenant_id = ? AND user_id = ?', [tenantId, userId]
  );
  if (exists.length) throw new AppError('Este cliente ya es miembro del gimnasio', 400);

  const id = uuidv4();
  await db.execute<ResultSetHeader>(
    `INSERT INTO gym_membresias
       (id, tenant_id, user_id, plan_name, status, price, payment_cycle, auto_renew,
        start_date, end_date, last_payment_at, next_payment_at, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, tenantId, userId, data.planName || null, data.status || 'activa',
     data.price ?? 0, data.paymentCycle || 'mensual', data.autoRenew ? 1 : 0,
     data.startDate || null, data.endDate || null,
     data.lastPaymentAt || null, data.nextPaymentAt || null, data.notes || null]
  );
  return { userId };
}

export async function updateMembership(tenantId: string, userId: string, data: any) {
  const [rows] = await db.execute<Row[]>(
    'SELECT * FROM gym_membresias WHERE tenant_id = ? AND user_id = ?', [tenantId, userId]
  );
  if (!rows.length) throw new AppError('Membresía no encontrada', 404);
  const c = rows[0];
  await db.execute<ResultSetHeader>(
    `UPDATE gym_membresias SET
       plan_name=?, status=?, price=?, payment_cycle=?, auto_renew=?,
       start_date=?, end_date=?, last_payment_at=?, next_payment_at=?, notes=?
     WHERE tenant_id=? AND user_id=?`,
    [
      data.planName ?? c.plan_name,
      data.status ?? c.status,
      data.price ?? c.price,
      data.paymentCycle ?? c.payment_cycle,
      data.autoRenew !== undefined ? (data.autoRenew ? 1 : 0) : c.auto_renew,
      data.startDate !== undefined ? data.startDate : c.start_date,
      data.endDate !== undefined ? data.endDate : c.end_date,
      data.lastPaymentAt !== undefined ? data.lastPaymentAt : c.last_payment_at,
      data.nextPaymentAt !== undefined ? data.nextPaymentAt : c.next_payment_at,
      data.notes !== undefined ? data.notes : c.notes,
      tenantId, userId,
    ]
  );
  return { userId };
}

/** Registra un pago: avanza next_payment_at según el ciclo y reactiva la membresía. */
export async function registrarPago(tenantId: string, userId: string) {
  const [rows] = await db.execute<Row[]>(
    'SELECT payment_cycle FROM gym_membresias WHERE tenant_id = ? AND user_id = ?', [tenantId, userId]
  );
  if (!rows.length) throw new AppError('Membresía no encontrada', 404);
  const cycleMonths: Record<string, number> = { mensual: 1, trimestral: 3, semestral: 6, anual: 12 };
  const months = cycleMonths[rows[0].payment_cycle] || 1;
  await db.execute<ResultSetHeader>(
    `UPDATE gym_membresias
     SET last_payment_at = NOW(),
         next_payment_at = DATE_ADD(NOW(), INTERVAL ? MONTH),
         status = 'activa'
     WHERE tenant_id = ? AND user_id = ?`,
    [months, tenantId, userId]
  );
  return { ok: true };
}

export async function removeMember(tenantId: string, userId: string) {
  const [r] = await db.execute<ResultSetHeader>(
    'DELETE FROM gym_membresias WHERE tenant_id = ? AND user_id = ?', [tenantId, userId]
  );
  if (r.affectedRows === 0) throw new AppError('Membresía no encontrada', 404);
}

// ─────────────────────────────────────────────────────────────
// PLANES + EJERCICIOS (staff)
// ─────────────────────────────────────────────────────────────
async function getPlanWithExercises(tenantId: string, planId: string) {
  const [plans] = await db.execute<Row[]>(
    `SELECT id, member_user_id AS memberUserId, name, description,
            days_per_week AS daysPerWeek, is_active AS isActive
     FROM gym_planes_entrenamiento WHERE id = ? AND tenant_id = ?`,
    [planId, tenantId]
  );
  if (!plans.length) throw new AppError('Plan no encontrado', 404);
  const [ex] = await db.execute<Row[]>(
    `SELECT id, day_label AS dayLabel, name, sets, reps, weight_kg AS weightKg,
            rest_seconds AS restSeconds, notes, sort_order AS sortOrder
     FROM gym_ejercicios WHERE plan_id = ? ORDER BY sort_order ASC, day_label ASC`,
    [planId]
  );
  return { ...plans[0], exercises: ex };
}

export async function getPlan(tenantId: string, planId: string) {
  return getPlanWithExercises(tenantId, planId);
}

export async function listMemberPlans(tenantId: string, userId: string) {
  const [plans] = await db.execute<Row[]>(
    `SELECT id, name, description, days_per_week AS daysPerWeek, is_active AS isActive
     FROM gym_planes_entrenamiento
     WHERE tenant_id = ? AND member_user_id = ? AND is_active = 1
     ORDER BY created_at DESC`,
    [tenantId, userId]
  );
  return plans;
}

export async function createPlan(tenantId: string, createdBy: string, memberUserId: string, data: any) {
  if (!data.name?.trim()) throw new AppError('El nombre del plan es requerido', 400);
  const [member] = await db.execute<Row[]>(
    'SELECT user_id FROM gym_membresias WHERE tenant_id = ? AND user_id = ?', [tenantId, memberUserId]
  );
  if (!member.length) throw new AppError('El cliente no es miembro del gimnasio', 404);

  const id = uuidv4();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `INSERT INTO gym_planes_entrenamiento
         (id, tenant_id, member_user_id, name, description, days_per_week, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, tenantId, memberUserId, data.name.trim(), data.description || null,
       data.daysPerWeek ?? null, createdBy]
    );
    for (const ex of (data.exercises || [])) {
      if (!ex.name?.trim()) continue;
      await conn.execute(
        `INSERT INTO gym_ejercicios
           (id, plan_id, tenant_id, day_label, name, sets, reps, weight_kg, rest_seconds, notes, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), id, tenantId, ex.dayLabel || null, ex.name.trim(), ex.sets ?? null,
         ex.reps || null, ex.weightKg ?? null, ex.restSeconds ?? null, ex.notes || null, ex.sortOrder ?? 0]
      );
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  return getPlanWithExercises(tenantId, id);
}

export async function deletePlan(tenantId: string, planId: string) {
  const [r] = await db.execute<ResultSetHeader>(
    'UPDATE gym_planes_entrenamiento SET is_active = 0 WHERE id = ? AND tenant_id = ?', [planId, tenantId]
  );
  if (r.affectedRows === 0) throw new AppError('Plan no encontrado', 404);
}

// ─────────────────────────────────────────────────────────────
// PROGRESO (staff registra, miembro consulta)
// ─────────────────────────────────────────────────────────────
export async function addProgress(tenantId: string, userId: string, data: any) {
  const [member] = await db.execute<Row[]>(
    'SELECT user_id FROM gym_membresias WHERE tenant_id = ? AND user_id = ?', [tenantId, userId]
  );
  if (!member.length) throw new AppError('El cliente no es miembro del gimnasio', 404);
  const id = uuidv4();
  await db.execute<ResultSetHeader>(
    `INSERT INTO gym_progreso
       (id, tenant_id, member_user_id, log_date, weight_kg, body_fat_pct, muscle_mass_kg, measurements, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, tenantId, userId, data.logDate || new Date().toISOString().slice(0, 10),
     data.weightKg ?? null, data.bodyFatPct ?? null, data.muscleMassKg ?? null,
     data.measurements ? JSON.stringify(data.measurements) : null, data.notes || null]
  );
  return { id };
}

export async function listProgress(tenantId: string, userId: string) {
  const [rows] = await db.execute<Row[]>(
    `SELECT id, log_date AS logDate, weight_kg AS weightKg, body_fat_pct AS bodyFatPct,
            muscle_mass_kg AS muscleMassKg, measurements, notes
     FROM gym_progreso WHERE tenant_id = ? AND member_user_id = ?
     ORDER BY log_date ASC`,
    [tenantId, userId]
  );
  return rows;
}

// ─────────────────────────────────────────────────────────────
// ASISTENCIA (check-in / check-out)
// ─────────────────────────────────────────────────────────────
export async function checkIn(tenantId: string, userId: string) {
  const [member] = await db.execute<Row[]>(
    'SELECT user_id FROM gym_membresias WHERE tenant_id = ? AND user_id = ?', [tenantId, userId]
  );
  if (!member.length) throw new AppError('El cliente no es miembro del gimnasio', 404);

  // Evita doble check-in abierto
  const [open] = await db.execute<Row[]>(
    'SELECT id FROM gym_asistencia WHERE tenant_id = ? AND member_user_id = ? AND checked_out_at IS NULL ORDER BY checked_in_at DESC LIMIT 1',
    [tenantId, userId]
  );
  if (open.length) return { id: open[0].id, alreadyOpen: true };

  const id = uuidv4();
  await db.execute<ResultSetHeader>(
    'INSERT INTO gym_asistencia (id, tenant_id, member_user_id) VALUES (?, ?, ?)',
    [id, tenantId, userId]
  );
  return { id, alreadyOpen: false };
}

export async function checkOut(tenantId: string, asistenciaId: string) {
  const [r] = await db.execute<ResultSetHeader>(
    'UPDATE gym_asistencia SET checked_out_at = NOW() WHERE id = ? AND tenant_id = ? AND checked_out_at IS NULL',
    [asistenciaId, tenantId]
  );
  if (r.affectedRows === 0) throw new AppError('Registro de asistencia no encontrado o ya cerrado', 404);
}

export async function todayAttendance(tenantId: string) {
  const [rows] = await db.execute<Row[]>(
    `SELECT a.id, a.member_user_id AS userId, u.name, a.checked_in_at AS checkedInAt,
            a.checked_out_at AS checkedOutAt
     FROM gym_asistencia a JOIN users u ON u.id = a.member_user_id
     WHERE a.tenant_id = ? AND DATE(a.checked_in_at) = CURDATE()
     ORDER BY a.checked_in_at DESC`,
    [tenantId]
  );
  return rows;
}

// ─────────────────────────────────────────────────────────────
// STATS (dashboard del gym)
// ─────────────────────────────────────────────────────────────
export async function getStats(tenantId: string) {
  const [[activos]] = await db.execute<Row[]>(
    "SELECT COUNT(*) AS n FROM gym_membresias WHERE tenant_id = ? AND status = 'activa'", [tenantId]
  ) as any;
  const [[total]] = await db.execute<Row[]>(
    'SELECT COUNT(*) AS n FROM gym_membresias WHERE tenant_id = ?', [tenantId]
  ) as any;
  const [[hoy]] = await db.execute<Row[]>(
    'SELECT COUNT(DISTINCT member_user_id) AS n FROM gym_asistencia WHERE tenant_id = ? AND DATE(checked_in_at) = CURDATE()', [tenantId]
  ) as any;
  const [[vencen]] = await db.execute<Row[]>(
    "SELECT COUNT(*) AS n FROM gym_membresias WHERE tenant_id = ? AND status = 'activa' AND next_payment_at IS NOT NULL AND next_payment_at <= DATE_ADD(NOW(), INTERVAL 7 DAY)", [tenantId]
  ) as any;
  const [[ingresos]] = await db.execute<Row[]>(
    "SELECT COALESCE(SUM(price),0) AS total FROM gym_membresias WHERE tenant_id = ? AND status = 'activa'", [tenantId]
  ) as any;
  return {
    miembrosActivos: activos?.n ?? 0,
    miembrosTotal: total?.n ?? 0,
    asistenciaHoy: hoy?.n ?? 0,
    pagosPorVencer: vencen?.n ?? 0,
    ingresoRecurrente: Number(ingresos?.total ?? 0),
  };
}

export async function getMemberDetail(tenantId: string, userId: string) {
  const [[membership]] = await db.execute<Row[]>(
    `SELECT m.plan_name AS planName, m.status, m.price, m.payment_cycle AS paymentCycle,
            m.start_date AS startDate, m.end_date AS endDate, m.next_payment_at AS nextPaymentAt,
            u.name, u.email, u.phone
     FROM gym_membresias m JOIN users u ON u.id = m.user_id
     WHERE m.tenant_id = ? AND m.user_id = ?`,
    [tenantId, userId]
  ) as any;
  if (!membership) throw new AppError('Miembro no encontrado', 404);
  const plans = await listMemberPlans(tenantId, userId);
  const progress = await listProgress(tenantId, userId);
  const attendance = await listMemberAttendance(tenantId, userId);
  return { membership, plans, progress, attendance };
}

// ─────────────────────────────────────────────────────────────
// MIEMBRO (cliente) — vistas propias
// ─────────────────────────────────────────────────────────────
export async function misMembresias(userId: string) {
  const [rows] = await db.execute<Row[]>(
    `SELECT m.tenant_id AS tenantId, t.name AS gymName, t.slug AS gymSlug,
            m.plan_name AS planName, m.status, m.start_date AS startDate,
            m.end_date AS endDate, m.next_payment_at AS nextPaymentAt
     FROM gym_membresias m JOIN tenants t ON t.id = m.tenant_id
     WHERE m.user_id = ?
     ORDER BY FIELD(m.status,'activa','pausada','vencida','cancelada')`,
    [userId]
  );
  return rows;
}

export async function miPlan(userId: string) {
  const [plans] = await db.execute<Row[]>(
    `SELECT p.id, p.name, p.description, p.days_per_week AS daysPerWeek,
            t.name AS gymName
     FROM gym_planes_entrenamiento p JOIN tenants t ON t.id = p.tenant_id
     WHERE p.member_user_id = ? AND p.is_active = 1
     ORDER BY p.created_at DESC`,
    [userId]
  );
  for (const p of plans as any[]) {
    const [ex] = await db.execute<Row[]>(
      `SELECT day_label AS dayLabel, name, sets, reps, weight_kg AS weightKg,
              rest_seconds AS restSeconds, notes
       FROM gym_ejercicios WHERE plan_id = ? ORDER BY sort_order ASC, day_label ASC`,
      [p.id]
    );
    p.exercises = ex;
  }
  return plans;
}

export async function miProgreso(userId: string) {
  const [rows] = await db.execute<Row[]>(
    `SELECT log_date AS logDate, weight_kg AS weightKg, body_fat_pct AS bodyFatPct,
            muscle_mass_kg AS muscleMassKg, measurements, notes
     FROM gym_progreso WHERE member_user_id = ?
     ORDER BY log_date ASC`,
    [userId]
  );
  return rows;
}

/** Asistencia del miembro + racha (días consecutivos hasta hoy con check-in). */
export async function miAsistencia(userId: string) {
  const [rows] = await db.execute<Row[]>(
    `SELECT DISTINCT DATE(checked_in_at) AS d
     FROM gym_asistencia WHERE member_user_id = ?
     ORDER BY d DESC LIMIT 90`,
    [userId]
  );
  const days = (rows as any[]).map(r => String(r.d).slice(0, 10));
  const set = new Set(days);

  // Racha: cuenta hacia atrás desde hoy (o ayer) días consecutivos presentes
  let streak = 0;
  const cur = new Date();
  // si no vino hoy, la racha puede empezar ayer
  if (!set.has(cur.toISOString().slice(0, 10))) cur.setDate(cur.getDate() - 1);
  while (set.has(cur.toISOString().slice(0, 10))) {
    streak++;
    cur.setDate(cur.getDate() - 1);
  }

  const last30 = days.filter(d => new Date(d) >= new Date(Date.now() - 30 * 864e5)).length;

  // ¿Hay un check-in abierto ahora mismo? (en cualquiera de sus gimnasios)
  const [[open]] = await db.execute<Row[]>(
    'SELECT id, tenant_id AS tenantId FROM gym_asistencia WHERE member_user_id = ? AND checked_out_at IS NULL ORDER BY checked_in_at DESC LIMIT 1',
    [userId]
  ) as any;

  return { recentDays: days, streak, last30, openCheckIn: open || null };
}

/** Check-in que hace el propio miembro (ej: QR a la entrada). Valida membresía activa. */
export async function memberCheckIn(userId: string, tenantId: string) {
  if (!tenantId) throw new AppError('Gimnasio no especificado', 400);
  const [m] = await db.execute<Row[]>(
    'SELECT status FROM gym_membresias WHERE tenant_id = ? AND user_id = ?', [tenantId, userId]
  );
  if (!m.length) throw new AppError('No eres miembro de este gimnasio', 404);
  if (m[0].status !== 'activa') throw new AppError('Tu membresía no está activa', 400);
  return checkIn(tenantId, userId);
}

/** El miembro cierra su propio check-in abierto. */
export async function memberCheckOut(userId: string) {
  const [r] = await db.execute<ResultSetHeader>(
    'UPDATE gym_asistencia SET checked_out_at = NOW() WHERE member_user_id = ? AND checked_out_at IS NULL',
    [userId]
  );
  if (r.affectedRows === 0) throw new AppError('No tienes una entrada abierta', 404);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// CONTROL DE ACCESO (QR)
// ─────────────────────────────────────────────────────────────
type AccessResult = {
  status: 'permitido' | 'por_vencer' | 'denegado';
  reason: string;
  daysRemaining: number | null;
  name?: string;
  gymName?: string;
  planName?: string | null;
};

/** Calcula el estado de acceso a partir de una fila de membresía + datos del usuario. */
function computeAccess(m: any): AccessResult {
  const expiryRaw = m.end_date || m.next_payment_at || null;
  const expiry = expiryRaw ? new Date(expiryRaw) : null;
  const now = new Date();
  const daysRemaining = expiry
    ? Math.ceil((expiry.getTime() - now.getTime()) / 86400000)
    : null;

  if (m.status === 'cancelada') return { status: 'denegado', reason: 'Membresía cancelada', daysRemaining };
  if (m.status === 'pausada')   return { status: 'denegado', reason: 'Membresía pausada', daysRemaining };
  if (m.status === 'vencida')   return { status: 'denegado', reason: 'Membresía vencida', daysRemaining };
  // activa
  if (expiry && daysRemaining !== null && daysRemaining < 0)
    return { status: 'denegado', reason: 'Membresía vencida', daysRemaining };
  if (daysRemaining !== null && daysRemaining <= 5)
    return { status: 'por_vencer', reason: `Vence en ${daysRemaining} día(s)`, daysRemaining };
  return { status: 'permitido', reason: 'Acceso permitido', daysRemaining };
}

/** Vista del miembro: su código QR + estado de acceso de su membresía principal. */
export async function memberAccess(userId: string) {
  const [rows] = await db.execute<Row[]>(
    `SELECT m.*, t.name AS gymName, u.name AS userName
     FROM gym_membresias m JOIN tenants t ON t.id = m.tenant_id JOIN users u ON u.id = m.user_id
     WHERE m.user_id = ?
     ORDER BY FIELD(m.status,'activa','pausada','vencida','cancelada')`,
    [userId]
  );
  // QR codifica el id del usuario (el gym lo escanea para registrar ingreso)
  const qrCode = `GYM:${userId}`;
  if (!rows.length) return { qrCode, memberships: [] };
  const memberships = (rows as any[]).map(m => {
    const acc = computeAccess(m);
    return {
      tenantId: m.tenant_id, gymName: m.gymName, planName: m.plan_name,
      membershipStatus: m.status, ...acc,
    };
  });
  return { qrCode, memberships };
}

/** El staff escanea el QR de un miembro. Valida membresía, registra ingreso si procede. */
export async function scanAccess(tenantId: string, code: string, _staffUserId: string): Promise<AccessResult & { userId?: string; checkedIn?: boolean }> {
  const userId = String(code || '').replace(/^GYM:/, '').trim();
  if (!userId) throw new AppError('Código inválido', 400);

  const [rows] = await db.execute<Row[]>(
    `SELECT m.*, u.name AS userName
     FROM gym_membresias m JOIN users u ON u.id = m.user_id
     WHERE m.tenant_id = ? AND m.user_id = ?`,
    [tenantId, userId]
  );
  if (!rows.length) {
    return { status: 'denegado', reason: 'No es miembro de este gimnasio', daysRemaining: null };
  }
  const m: any = rows[0];
  const acc = computeAccess(m);
  const result: AccessResult & { userId?: string; checkedIn?: boolean } = {
    ...acc, name: m.userName, gymName: undefined, planName: m.plan_name, userId, checkedIn: false,
  };

  if (acc.status !== 'denegado') {
    // Si la membresía marcaba vencida pero sigue vigente, no tocamos; registramos ingreso.
    await checkIn(tenantId, userId);
    result.checkedIn = true;
  } else if (m.status === 'activa' && acc.reason === 'Membresía vencida') {
    // Auto-marcar vencida para reflejar el estado real
    await db.execute<ResultSetHeader>(
      "UPDATE gym_membresias SET status='vencida' WHERE tenant_id=? AND user_id=?",
      [tenantId, userId]
    );
  }
  return result;
}

/** Historial de asistencia de un miembro (staff). */
export async function listMemberAttendance(tenantId: string, userId: string) {
  const [rows] = await db.execute<Row[]>(
    `SELECT id, checked_in_at AS checkedInAt, checked_out_at AS checkedOutAt, notes
     FROM gym_asistencia WHERE tenant_id = ? AND member_user_id = ?
     ORDER BY checked_in_at DESC LIMIT 60`,
    [tenantId, userId]
  );
  return rows;
}
