/**
 * members/service.ts
 * Lógica de negocio del dominio Personas.
 * Cada miembro se crea referenciando un user existente (por email).
 * Se genera gym_members + gym_member_profiles en transacción.
 * Los timeline events se insertan desde aquí y desde otros dominios.
 */
import { db } from '../../../config';
import { AppError } from '../../../common/middleware';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import type {
  GymMember, GymMemberProfile, GymObjective, TimelineEvent,
  MemberFullProfile, CreateMemberInput, UpdateMemberInput,
  UpdateMemberProfileInput, MemberListFilters, MemberStatus,
} from './types';

interface Row extends RowDataPacket {}

// ─── Objetivos (catálogo) ───────────────────────────────────────────

export async function listObjectives(): Promise<GymObjective[]> {
  const [rows] = await db.execute<Row[]>(
    `SELECT id, \`key\`, name, icon, is_active AS isActive, sort_order AS sortOrder
     FROM gym_objectives WHERE is_active = 1 ORDER BY sort_order ASC`,
  );
  return rows as GymObjective[];
}

// ─── Constantes ────────────────────────────────────────────────────

const MEMBER_SELECT = `m.id, m.tenant_id AS tenantId, m.user_id AS userId,
  m.member_number AS memberNumber, m.photo_url AS photoUrl,
  m.cover_photo_url AS coverPhotoUrl, m.avatar_color AS avatarColor,
  m.status, m.join_date AS joinDate, m.trainer_id AS trainerId,
  m.created_at AS createdAt, m.updated_at AS updatedAt`;

const PROFILE_SELECT = `p.id, p.member_id AS memberId, p.birth_date AS birthDate,
  p.sex, p.height_cm AS heightCm, p.initial_weight_kg AS initialWeightKg,
  p.blood_type AS bloodType, p.objective_id AS objectiveId, p.level,
  p.occupation, p.emergency_contact AS emergencyContact,
  p.emergency_phone AS emergencyPhone, p.medical_notes AS medicalNotes,
  p.allergies, p.conditions, p.medications,
  p.social_instagram AS socialInstagram, p.social_facebook AS socialFacebook,
  p.social_tiktok AS socialTiktok, p.observations,
  p.created_at AS createdAt, p.updated_at AS updatedAt`;

function parseJson(field: unknown): unknown {
  if (typeof field === 'string') {
    try { return JSON.parse(field); } catch { return null; }
  }
  return field ?? null;
}

// ─── Listar miembros ─────────────────────────────────────────────────

export async function listMembers(
  tenantId: string,
  filters: MemberListFilters = {},
): Promise<{ rows: GymMember[]; total: number }> {
  const conditions: string[] = ['m.tenant_id = ?'];
  const params: unknown[] = [tenantId];

  if (filters.status) {
    conditions.push('m.status = ?');
    params.push(filters.status);
  }
  if (filters.trainerId) {
    conditions.push('m.trainer_id = ?');
    params.push(filters.trainerId);
  }
  if (filters.objectiveId) {
    conditions.push('p.objective_id = ?');
    params.push(filters.objectiveId);
  }
  if (filters.search) {
    conditions.push('(u.name LIKE ? OR u.email LIKE ? OR m.member_number LIKE ?)');
    const s = `%${filters.search}%`;
    params.push(s, s, s);
  }

  const where = conditions.join(' AND ');
  const joins = 'LEFT JOIN gym_member_profiles p ON p.member_id = m.id JOIN users u ON u.id = m.user_id';

  const [[{ n }]] = await db.execute<Row[]>(
    `SELECT COUNT(*) AS n FROM gym_members m ${filters.objectiveId ? 'LEFT JOIN gym_member_profiles p ON p.member_id = m.id' : ''} WHERE ${where}`,
    params,
  ) as unknown as [{ n: number }[]];

  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  const [rows] = await db.execute<Row[]>(
    `SELECT ${MEMBER_SELECT},
            u.name AS userName, u.email AS userEmail, u.phone AS userPhone,
            u.avatar AS userAvatar, p.level AS profileLevel,
            obj.name AS objectiveName
     FROM gym_members m
     ${joins}
     LEFT JOIN gym_objectives obj ON obj.id = p.objective_id
     WHERE ${where}
     ORDER BY FIELD(m.status,'activo','congelado','lesionado','inactivo','dado_de_baja'), u.name ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  return { rows: rows as GymMember[], total: n };
}

// ─── Crear miembro ───────────────────────────────────────────────────

export async function createMember(tenantId: string, input: CreateMemberInput): Promise<GymMember> {
  const email = String(input.email || '').trim().toLowerCase();
  if (!email) throw new AppError('El email del cliente es requerido', 400);

  const [users] = await db.execute<Row[]>(
    "SELECT id, role FROM users WHERE email = ? AND is_active = 1 LIMIT 1", [email],
  );
  if (!users.length) {
    throw new AppError('No existe un usuario con ese email. Pídele que cree su cuenta primero.', 404);
  }
  const userId = users[0].id;

  const [existing] = await db.execute<Row[]>(
    'SELECT id FROM gym_members WHERE tenant_id = ? AND user_id = ?', [tenantId, userId],
  );
  if (existing.length) throw new AppError('Este usuario ya es miembro del gimnasio', 400);

  const memberId = uuidv4();
  const profileId = uuidv4();
  const memberNumber = input.memberNumber || await generateMemberNumber(tenantId);

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    await conn.execute(
      `INSERT INTO gym_members (id, tenant_id, user_id, member_number, photo_url, avatar_color,
        status, join_date, trainer_id)
       VALUES (?, ?, ?, ?, ?, ?, 'activo', ?, ?)`,
      [memberId, tenantId, userId, memberNumber,
       input.photoUrl || null, randomColor(),
       input.joinDate || new Date().toISOString().slice(0, 10),
       input.trainerId || null],
    );

    await conn.execute(
      `INSERT INTO gym_member_profiles (id, member_id, level)
       VALUES (?, ?, 'principiante')`,
      [profileId, memberId],
    );

    await conn.execute(
      `INSERT INTO gym_member_timeline (id, tenant_id, member_id, event_type, event_label, entity_type, entity_id)
       VALUES (?, ?, ?, 'member.created', 'Ingresó al gimnasio', 'member', ?)`,
      [uuidv4(), tenantId, memberId, memberId],
    );

    // Crear membresía inicial si se especificó plan
    if (input.planName) {
      const membershipId = uuidv4();
      await conn.execute(
        `INSERT INTO gym_membresias (id, tenant_id, user_id, plan_name, status, price, payment_cycle)
         VALUES (?, ?, ?, ?, 'activa', ?, ?)`,
        [membershipId, tenantId, userId, input.planName, input.price ?? 0, input.paymentCycle || 'mensual'],
      );
    }

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  const [rows] = await db.execute<Row[]>(
    `SELECT ${MEMBER_SELECT} FROM gym_members m WHERE m.id = ?`, [memberId],
  );
  return rows[0] as GymMember;
}

async function generateMemberNumber(tenantId: string): Promise<string> {
  const [[{ n }]] = await db.execute<Row[]>(
    'SELECT COUNT(*) + 1 AS n FROM gym_members WHERE tenant_id = ?', [tenantId],
  ) as unknown as [{ n: number }[]];
  return `GYM-${String(n).padStart(4, '0')}`;
}

function randomColor(): string {
  const colors = ['#8b5cf6', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'];
  return colors[Math.floor(Math.random() * colors.length)];
}

// ─── Obtener miembro ─────────────────────────────────────────────────

export async function getMember(tenantId: string, memberId: string): Promise<MemberFullProfile> {
  const [members] = await db.execute<Row[]>(
    `SELECT ${MEMBER_SELECT} FROM gym_members m WHERE m.id = ? AND m.tenant_id = ?`,
    [memberId, tenantId],
  );
  if (!members.length) throw new AppError('Miembro no encontrado', 404);

  const member = members[0] as GymMember;

  const [[user]] = await db.execute<Row[]>(
    'SELECT name, email, phone, avatar FROM users WHERE id = ?', [member.userId],
  ) as unknown as [{ name: string; email: string; phone: string | null; avatar: string | null }[]];

  const [profileRows] = await db.execute<Row[]>(
    `SELECT ${PROFILE_SELECT} FROM gym_member_profiles p WHERE p.member_id = ?`, [memberId],
  );
  const profile: GymMemberProfile | null = (profileRows[0] as GymMemberProfile) || null;

  let objective: GymObjective | null = null;
  if (profile?.objectiveId) {
    const [objRows] = await db.execute<Row[]>(
      'SELECT id, `key`, name, icon FROM gym_objectives WHERE id = ?', [profile.objectiveId],
    );
    objective = (objRows[0] as GymObjective) || null;
  }

  let trainer: { id: string; name: string } | null = null;
  if (member.trainerId) {
    const [trainerRows] = await db.execute<Row[]>(
      'SELECT id, name FROM users WHERE id = ?', [member.trainerId],
    );
    trainer = (trainerRows[0] as { id: string; name: string }) || null;
  }

  const [timeline] = await db.execute<Row[]>(
    `SELECT id, tenant_id AS tenantId, member_id AS memberId,
            event_type AS eventType, event_label AS eventLabel,
            entity_type AS entityType, entity_id AS entityId,
            metadata, created_at AS createdAt
     FROM gym_member_timeline WHERE member_id = ? ORDER BY created_at DESC LIMIT 50`,
    [memberId],
  );

  const stats = await getMemberStats(tenantId, memberId);

  return {
    member,
    user: user || { name: '', email: '', phone: null, avatar: null },
    profile: profile ? { ...profile, allergies: parseJson(profile.allergies) as string[] | null, conditions: parseJson(profile.conditions) as string[] | null, medications: parseJson(profile.medications) as { name: string; dose: string }[] | null } : null,
    objective,
    trainer,
    stats,
    timeline: timeline as TimelineEvent[],
  };
}

// ─── Actualizar miembro ──────────────────────────────────────────────

export async function updateMember(tenantId: string, memberId: string, input: UpdateMemberInput): Promise<GymMember> {
  const [rows] = await db.execute<Row[]>(
    'SELECT * FROM gym_members WHERE id = ? AND tenant_id = ?', [memberId, tenantId],
  );
  if (!rows.length) throw new AppError('Miembro no encontrado', 404);

  const current = rows[0];

  await db.execute<ResultSetHeader>(
    `UPDATE gym_members SET
       photo_url = ?, cover_photo_url = ?, status = ?, trainer_id = ?
     WHERE id = ? AND tenant_id = ?`,
    [
      input.photoUrl !== undefined ? input.photoUrl : current.photo_url,
      input.coverPhotoUrl !== undefined ? input.coverPhotoUrl : current.cover_photo_url,
      input.status ?? current.status,
      input.trainerId !== undefined ? input.trainerId : current.trainer_id,
      memberId, tenantId,
    ],
  );

  // Timeline: cambio de estado
  if (input.status && input.status !== current.status) {
    await addTimelineEvent(tenantId, memberId, 'member.status_changed',
      `Estado: ${current.status} → ${input.status}`, 'member', memberId);
  }
  // Timeline: cambio de entrenador
  if (input.trainerId !== undefined && input.trainerId !== current.trainer_id) {
    await addTimelineEvent(tenantId, memberId, 'member.trainer_changed',
      'Entrenador reasignado', 'member', memberId);
  }

  const [updated] = await db.execute<Row[]>(
    `SELECT ${MEMBER_SELECT} FROM gym_members m WHERE m.id = ?`, [memberId],
  );
  return updated[0] as GymMember;
}

// ─── Perfil extendido ────────────────────────────────────────────────

export async function getMemberProfile(memberId: string): Promise<GymMemberProfile> {
  const [profileRows] = await db.execute<Row[]>(
    `SELECT ${PROFILE_SELECT} FROM gym_member_profiles p WHERE p.member_id = ?`, [memberId],
  );
  const profile = profileRows[0] as GymMemberProfile | undefined;
  if (!profile) throw new AppError('Perfil no encontrado', 404);
  return {
    ...profile,
    allergies: parseJson(profile.allergies) as string[] | null,
    conditions: parseJson(profile.conditions) as string[] | null,
    medications: parseJson(profile.medications) as { name: string; dose: string }[] | null,
  };
}

export async function updateMemberProfile(memberId: string, input: UpdateMemberProfileInput): Promise<GymMemberProfile> {
  const [rows] = await db.execute<Row[]>(
    'SELECT * FROM gym_member_profiles WHERE member_id = ?', [memberId],
  );
  if (!rows.length) throw new AppError('Perfil no encontrado', 404);

  const c = rows[0];
  await db.execute<ResultSetHeader>(
    `UPDATE gym_member_profiles SET
       birth_date = ?, sex = ?, height_cm = ?, initial_weight_kg = ?,
       blood_type = ?, objective_id = ?, level = ?,
       occupation = ?, emergency_contact = ?, emergency_phone = ?,
       medical_notes = ?, allergies = ?, conditions = ?, medications = ?,
       social_instagram = ?, social_facebook = ?, social_tiktok = ?,
       observations = ?
     WHERE member_id = ?`,
    [
      input.birthDate !== undefined ? input.birthDate : c.birth_date,
      input.sex !== undefined ? input.sex : c.sex,
      input.heightCm !== undefined ? input.heightCm : c.height_cm,
      input.initialWeightKg !== undefined ? input.initialWeightKg : c.initial_weight_kg,
      input.bloodType !== undefined ? input.bloodType : c.blood_type,
      input.objectiveId !== undefined ? input.objectiveId : c.objective_id,
      input.level ?? c.level,
      input.occupation !== undefined ? input.occupation : c.occupation,
      input.emergencyContact !== undefined ? input.emergencyContact : c.emergency_contact,
      input.emergencyPhone !== undefined ? input.emergencyPhone : c.emergency_phone,
      input.medicalNotes !== undefined ? input.medicalNotes : c.medical_notes,
      input.allergies !== undefined ? JSON.stringify(input.allergies) : c.allergies,
      input.conditions !== undefined ? JSON.stringify(input.conditions) : c.conditions,
      input.medications !== undefined ? JSON.stringify(input.medications) : c.medications,
      input.socialInstagram !== undefined ? input.socialInstagram : c.social_instagram,
      input.socialFacebook !== undefined ? input.socialFacebook : c.social_facebook,
      input.socialTiktok !== undefined ? input.socialTiktok : c.social_tiktok,
      input.observations !== undefined ? input.observations : c.observations,
      memberId,
    ],
  );

  return getMemberProfile(memberId);
}

// ─── Timeline ────────────────────────────────────────────────────────

export async function addTimelineEvent(
  tenantId: string,
  memberId: string,
  eventType: string,
  eventLabel: string,
  entityType?: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await db.execute<ResultSetHeader>(
    `INSERT INTO gym_member_timeline (id, tenant_id, member_id, event_type, event_label, entity_type, entity_id, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuidv4(), tenantId, memberId, eventType, eventLabel, entityType || null, entityId || null,
     metadata ? JSON.stringify(metadata) : null],
  );
}

// ─── Stats ───────────────────────────────────────────────────────────

async function getMemberStats(tenantId: string, memberId: string) {
  const [rows] = await db.execute<Row[]>(
    'SELECT user_id FROM gym_members WHERE id = ? AND tenant_id = ?', [memberId, tenantId],
  );
  if (!rows.length) return emptyStats();
  const userId = rows[0].user_id;

  const [[{ totalVisits }]] = await db.execute<Row[]>(
    'SELECT COUNT(*) AS totalVisits FROM gym_asistencia WHERE tenant_id = ? AND member_user_id = ?',
    [tenantId, userId],
  ) as unknown as [{ totalVisits: number }[]];

  const [[last]] = await db.execute<Row[]>(
    'SELECT checked_in_at AS lastVisit FROM gym_asistencia WHERE tenant_id = ? AND member_user_id = ? ORDER BY checked_in_at DESC LIMIT 1',
    [tenantId, userId],
  ) as unknown as [{ lastVisit: string | null }[]];

  const [[{ latestWeight }]] = await db.execute<Row[]>(
    'SELECT weight_kg AS latestWeight FROM gym_progreso WHERE tenant_id = ? AND member_user_id = ? AND weight_kg IS NOT NULL ORDER BY log_date DESC LIMIT 1',
    [tenantId, userId],
  ) as unknown as [{ latestWeight: number | null }[]];

  const [[{ latestBodyFat }]] = await db.execute<Row[]>(
    'SELECT body_fat_pct AS latestBodyFat FROM gym_progreso WHERE tenant_id = ? AND member_user_id = ? AND body_fat_pct IS NOT NULL ORDER BY log_date DESC LIMIT 1',
    [tenantId, userId],
  ) as unknown as [{ latestBodyFat: number | null }[]];

  const streak = await computeStreak(userId);

  return {
    totalVisits: totalVisits ?? 0,
    currentStreak: streak,
    lastVisit: last?.lastVisit ?? null,
    avgWeight: latestWeight ?? null,
    latestBodyFat: latestBodyFat ?? null,
  };
}

async function computeStreak(userId: string): Promise<number> {
  const [rows] = await db.execute<Row[]>(
    `SELECT DISTINCT DATE(checked_in_at) AS d
     FROM gym_asistencia WHERE member_user_id = ?
     ORDER BY d DESC LIMIT 90`,
    [userId],
  );
  const days = (rows as { d: string }[]).map(r => String(r.d).slice(0, 10));
  const set = new Set(days);
  let streak = 0;
  const cur = new Date();
  if (!set.has(cur.toISOString().slice(0, 10))) cur.setDate(cur.getDate() - 1);
  while (set.has(cur.toISOString().slice(0, 10))) {
    streak++;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

function emptyStats() {
  return {
    totalVisits: 0,
    currentStreak: 0,
    lastVisit: null,
    avgWeight: null,
    latestBodyFat: null,
  };
}

// ─── Cambio de status ─────────────────────────────────────────────────

export async function changeMemberStatus(
  tenantId: string,
  memberId: string,
  status: MemberStatus,
): Promise<GymMember> {
  const [rows] = await db.execute<Row[]>(
    'SELECT status FROM gym_members WHERE id = ? AND tenant_id = ?', [memberId, tenantId],
  );
  if (!rows.length) throw new AppError('Miembro no encontrado', 404);

  const oldStatus = rows[0].status;
  await db.execute<ResultSetHeader>(
    'UPDATE gym_members SET status = ? WHERE id = ? AND tenant_id = ?',
    [status, memberId, tenantId],
  );

  await addTimelineEvent(tenantId, memberId, 'member.status_changed',
    `Estado: ${oldStatus} → ${status}`, 'member', memberId);

  const [updated] = await db.execute<Row[]>(
    `SELECT ${MEMBER_SELECT} FROM gym_members m WHERE m.id = ?`, [memberId],
  );
  return updated[0] as GymMember;
}

// ─── Reasignar entrenador ────────────────────────────────────────────

export async function reassignTrainer(
  tenantId: string,
  memberId: string,
  trainerId: string | null,
): Promise<GymMember> {
  const [rows] = await db.execute<Row[]>(
    'SELECT trainer_id FROM gym_members WHERE id = ? AND tenant_id = ?', [memberId, tenantId],
  );
  if (!rows.length) throw new AppError('Miembro no encontrado', 404);

  await db.execute<ResultSetHeader>(
    'UPDATE gym_members SET trainer_id = ? WHERE id = ? AND tenant_id = ?',
    [trainerId, memberId, tenantId],
  );

  await addTimelineEvent(tenantId, memberId, 'member.trainer_changed',
    trainerId ? 'Entrenador asignado' : 'Entrenador removido', 'member', memberId,
    { trainerId });

  const [updated] = await db.execute<Row[]>(
    `SELECT ${MEMBER_SELECT} FROM gym_members m WHERE m.id = ?`, [memberId],
  );
  return updated[0] as GymMember;
}
