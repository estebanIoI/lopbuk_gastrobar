/**
 * training/service.ts
 * Lógica de negocio del dominio Training.
 * Biblioteca de ejercicios, plantillas, asignaciones, sesiones y PRs.
 * Cada sesión de entrenamiento se persiste completa con series.
 * Los Personal Records se detectan automáticamente al finalizar sesión.
 */
import { db } from '../../../config';
import { AppError } from '../../../common/middleware';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import { addTimelineEvent } from '../members/service';
import type {
  ExerciseCategory, ExerciseLibraryItem, ExerciseMedia, ExerciseFavorite,
  WorkoutTemplate, WorkoutTemplateExercise, WorkoutTemplateExerciseGrouped,
  WorkoutAssignment, WorkoutSession, WorkoutSessionExercise, WorkoutSet,
  PersonalRecord, CreateExerciseInput, CreateTemplateInput, AssignTemplateInput,
  StartSessionInput, LogSetInput, TrainingFilters,
} from './types';

interface Row extends RowDataPacket {}

function parseJson(field: unknown): unknown {
  if (typeof field === 'string') { try { return JSON.parse(field) } catch { return null } }
  return field ?? null;
}

// ════════════════════════════════════════════════════════════════════
// CATEGORÍAS
// ════════════════════════════════════════════════════════════════════

export async function listCategories(): Promise<ExerciseCategory[]> {
  const [rows] = await db.execute<Row[]>(
    'SELECT id, name, icon, sort_order AS sortOrder FROM gym_exercise_categories ORDER BY sort_order ASC',
  );
  return rows as ExerciseCategory[];
}

// ════════════════════════════════════════════════════════════════════
// BIBLIOTECA DE EJERCICIOS
// ════════════════════════════════════════════════════════════════════

export async function listExercises(
  tenantId: string,
  staffUserId: string | null,
  filters: TrainingFilters = {},
): Promise<{ rows: ExerciseLibraryItem[]; total: number }> {
  const conditions: string[] = ['e.is_active = 1', '(e.tenant_id = ? OR e.tenant_id IS NULL OR e.tenant_id = \'\')'];
  const params: unknown[] = [tenantId];

  if (filters.muscleGroup) { conditions.push('e.muscle_group = ?'); params.push(filters.muscleGroup); }
  if (filters.equipment) { conditions.push('e.equipment = ?'); params.push(filters.equipment); }
  if (filters.difficulty) { conditions.push('e.difficulty = ?'); params.push(filters.difficulty); }
  if (filters.categoryId) { conditions.push('e.category_id = ?'); params.push(filters.categoryId); }
  if (filters.search) {
    conditions.push('(e.name LIKE ? OR e.muscle_group LIKE ?)');
    const s = `%${filters.search}%`;
    params.push(s, s);
  }

  const where = conditions.join(' AND ');
  const [[{ n }]] = await db.execute<Row[]>(
    `SELECT COUNT(*) AS n FROM gym_exercise_library e WHERE ${where}`, params,
  ) as unknown as [{ n: number }[]];

  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  const favJoin = staffUserId
    ? 'LEFT JOIN gym_exercise_favorites fav ON fav.exercise_id = e.id AND fav.tenant_id = ? AND fav.staff_user_id = ?'
    : '';
  const favParams = staffUserId ? [tenantId, staffUserId] : [];

  const [rows] = await db.execute<Row[]>(
    `SELECT e.id, e.tenant_id AS tenantId, e.category_id AS categoryId, e.name, e.slug,
            e.description, e.muscle_group AS muscleGroup, e.secondary_muscles AS secondaryMuscles,
            e.equipment, e.difficulty, e.movement_pattern AS movementPattern,
            e.tips, e.common_errors AS commonErrors, e.alternatives,
            e.rpe_recommendation AS rpeRecommendation, e.tempo, e.rest_seconds AS restSeconds,
            e.estimated_kcal AS estimatedKcal, e.estimated_seconds AS estimatedSeconds,
            e.is_active AS isActive, e.popularity, e.created_by AS createdBy,
            e.created_at AS createdAt, e.updated_at AS updatedAt,
            c.name AS categoryName,
            ${staffUserId ? 'CASE WHEN fav.id IS NOT NULL THEN 1 ELSE 0 END AS isFavorite' : '0 AS isFavorite'}
     FROM gym_exercise_library e
     LEFT JOIN gym_exercise_categories c ON c.id = e.category_id
     ${favJoin}
     WHERE ${where}
     ORDER BY e.popularity DESC, e.name ASC
     LIMIT ? OFFSET ?`,
    [...favParams, ...params, limit, offset],
  );

  const mapped = (rows as any[]).map(r => ({
    ...r,
    secondaryMuscles: parseJson(r.secondaryMuscles),
    alternatives: parseJson(r.alternatives),
    isActive: Boolean(r.isActive),
    isFavorite: Boolean(r.isFavorite),
  }));

  return { rows: mapped, total: n };
}

export async function getExercise(tenantId: string, exerciseId: string): Promise<ExerciseLibraryItem> {
  const [rows] = await db.execute<Row[]>(
    `SELECT e.id, e.tenant_id AS tenantId, e.category_id AS categoryId, e.name, e.slug,
            e.description, e.muscle_group AS muscleGroup, e.secondary_muscles AS secondaryMuscles,
            e.equipment, e.difficulty, e.movement_pattern AS movementPattern,
            e.tips, e.common_errors AS commonErrors, e.alternatives,
            e.rpe_recommendation AS rpeRecommendation, e.tempo, e.rest_seconds AS restSeconds,
            e.estimated_kcal AS estimatedKcal, e.estimated_seconds AS estimatedSeconds,
            e.is_active AS isActive, e.popularity, e.created_by AS createdBy,
            e.created_at AS createdAt, e.updated_at AS updatedAt,
            c.name AS categoryName
     FROM gym_exercise_library e
     LEFT JOIN gym_exercise_categories c ON c.id = e.category_id
     WHERE e.id = ? AND (e.tenant_id = ? OR e.tenant_id IS NULL OR e.tenant_id = '')`,
    [exerciseId, tenantId],
  );
  if (!rows.length) throw new AppError('Ejercicio no encontrado', 404);

  const r: any = rows[0];

  const [media] = await db.execute<Row[]>(
    `SELECT id, exercise_id AS exerciseId, kind, url, thumbnail_url AS thumbnailUrl,
            width, height, attribution, sort_order AS sortOrder
     FROM gym_exercise_media WHERE exercise_id = ? ORDER BY sort_order ASC`,
    [exerciseId],
  );

  return {
    ...r,
    secondaryMuscles: parseJson(r.secondaryMuscles),
    alternatives: parseJson(r.alternatives),
    isActive: Boolean(r.isActive),
    media: media as ExerciseMedia[],
  };
}

export async function createExercise(tenantId: string, createdBy: string, input: CreateExerciseInput): Promise<ExerciseLibraryItem> {
  if (!input.name?.trim()) throw new AppError('El nombre del ejercicio es requerido', 400);
  if (!input.muscleGroup) throw new AppError('El grupo muscular es requerido', 400);

  const id = uuidv4();
  const slug = input.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    await conn.execute(
      `INSERT INTO gym_exercise_library
        (id, tenant_id, category_id, name, slug, description, muscle_group,
         secondary_muscles, equipment, difficulty, movement_pattern, tips,
         common_errors, alternatives, rpe_recommendation, tempo, rest_seconds,
         estimated_kcal, estimated_seconds, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, tenantId, input.categoryId || null, input.name.trim(), slug,
       input.description || null, input.muscleGroup,
       input.secondaryMuscles ? JSON.stringify(input.secondaryMuscles) : null,
       input.equipment || null, input.difficulty || 'intermedio',
       input.movementPattern || null, input.tips || null,
       input.commonErrors || null,
       input.alternatives ? JSON.stringify(input.alternatives) : null,
       input.rpeRecommendation ?? null, input.tempo || null,
       input.restSeconds ?? null, input.estimatedKcal ?? null,
       input.estimatedSeconds ?? null, createdBy],
    );

    if (input.media?.length) {
      for (const m of input.media) {
        await conn.execute(
          `INSERT INTO gym_exercise_media (id, exercise_id, kind, url, thumbnail_url, width, height, attribution, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [uuidv4(), id, m.kind, m.url, m.thumbnailUrl || null, m.width ?? null, m.height ?? null,
           m.attribution || null, m.sortOrder ?? 0],
        );
      }
    }

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  return getExercise(tenantId, id);
}

export async function toggleFavorite(
  tenantId: string,
  staffUserId: string,
  exerciseId: string,
): Promise<{ favorited: boolean }> {
  const [existing] = await db.execute<Row[]>(
    'SELECT id FROM gym_exercise_favorites WHERE tenant_id = ? AND exercise_id = ? AND staff_user_id = ?',
    [tenantId, exerciseId, staffUserId],
  );

  if (existing.length) {
    await db.execute<ResultSetHeader>(
      'DELETE FROM gym_exercise_favorites WHERE id = ?', [existing[0].id],
    );
    return { favorited: false };
  }

  await db.execute<ResultSetHeader>(
    'INSERT INTO gym_exercise_favorites (id, tenant_id, exercise_id, staff_user_id) VALUES (?, ?, ?, ?)',
    [uuidv4(), tenantId, exerciseId, staffUserId],
  );
  return { favorited: true };
}

// ════════════════════════════════════════════════════════════════════
// PLANTILLAS (TEMPLATES)
// ════════════════════════════════════════════════════════════════════

export async function listTemplates(tenantId: string, filters?: { category?: string }): Promise<WorkoutTemplate[]> {
  const conditions: string[] = ['t.tenant_id = ?', 't.is_active = 1'];
  const params: unknown[] = [tenantId];
  if (filters?.category) { conditions.push('t.category = ?'); params.push(filters.category); }

  const [rows] = await db.execute<Row[]>(
    `SELECT t.id, t.tenant_id AS tenantId, t.name, t.description, t.category,
            t.weeks, t.days_per_week AS daysPerWeek, t.is_active AS isActive,
            t.created_by AS createdBy, t.created_at AS createdAt, t.updated_at AS updatedAt
     FROM gym_workout_templates t WHERE ${conditions.join(' AND ')} ORDER BY t.name ASC`,
    params,
  );
  return rows.map(r => ({ ...r, isActive: Boolean(r.isActive) })) as WorkoutTemplate[];
}

export async function getTemplate(tenantId: string, templateId: string): Promise<WorkoutTemplate> {
  const [rows] = await db.execute<Row[]>(
    `SELECT t.id, t.tenant_id AS tenantId, t.name, t.description, t.category,
            t.weeks, t.days_per_week AS daysPerWeek, t.is_active AS isActive,
            t.created_by AS createdBy, t.created_at AS createdAt, t.updated_at AS updatedAt
     FROM gym_workout_templates t WHERE t.id = ? AND t.tenant_id = ?`,
    [templateId, tenantId],
  );
  if (!rows.length) throw new AppError('Plantilla no encontrada', 404);

  const template = { ...rows[0], isActive: Boolean(rows[0].isActive) } as WorkoutTemplate;

  const [exRows] = await db.execute<Row[]>(
    `SELECT e.id, e.template_id AS templateId, e.exercise_id AS exerciseId,
            e.week_number AS weekNumber, e.day_number AS dayNumber, e.day_label AS dayLabel,
            e.target_sets AS targetSets, e.target_reps AS targetReps,
            e.start_weight AS startWeight, e.rpe_target AS rpeTarget,
            e.tempo, e.rest_seconds AS restSeconds,
            e.progression_type AS progressionType, e.progression_config AS progressionConfig,
            e.notes, e.sort_order AS sortOrder,
            l.name AS exerciseName, l.muscle_group AS exerciseMuscleGroup, l.equipment AS exerciseEquipment
     FROM gym_workout_template_exercises e
     JOIN gym_exercise_library l ON l.id = e.exercise_id
     WHERE e.template_id = ? ORDER BY e.week_number ASC, e.day_number ASC, e.sort_order ASC`,
    [templateId],
  );

  template.exercises = groupTemplateExercises(exRows as any[]);
  return template;
}

function groupTemplateExercises(rows: any[]): WorkoutTemplateExerciseGrouped[] {
  const weeks = new Map<number, Map<number, { dayLabel: string | null; exercises: WorkoutTemplateExercise[] }>>();

  for (const r of rows) {
    if (!weeks.has(r.weekNumber)) weeks.set(r.weekNumber, new Map());
    const daysMap = weeks.get(r.weekNumber)!;
    if (!daysMap.has(r.dayNumber)) {
      daysMap.set(r.dayNumber, { dayLabel: r.dayLabel, exercises: [] });
    }
    daysMap.get(r.dayNumber)!.exercises.push({
      ...r,
      progressionConfig: parseJson(r.progressionConfig) as Record<string, unknown> | null,
      exercise: {
        id: r.exerciseId, name: r.exerciseName,
        muscleGroup: r.exerciseMuscleGroup, equipment: r.exerciseEquipment,
      } as any,
    });
  }

  return Array.from(weeks.entries()).map(([weekNumber, daysMap]) => ({
    weekNumber,
    days: Array.from(daysMap.entries()).map(([dayNumber, day]) => ({
      dayNumber,
      dayLabel: day.dayLabel,
      exercises: day.exercises,
    })),
  }));
}

export async function createTemplate(
  tenantId: string,
  createdBy: string,
  input: CreateTemplateInput,
): Promise<WorkoutTemplate> {
  if (!input.name?.trim()) throw new AppError('El nombre de la plantilla es requerido', 400);

  const id = uuidv4();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    await conn.execute(
      `INSERT INTO gym_workout_templates (id, tenant_id, name, description, category, weeks, days_per_week, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, tenantId, input.name.trim(), input.description || null,
       input.category || null, input.weeks ?? 4, input.daysPerWeek ?? null, createdBy],
    );

    if (input.exercises?.length) {
      for (const ex of input.exercises) {
        if (!ex.exerciseId) continue;
        await conn.execute(
          `INSERT INTO gym_workout_template_exercises
            (id, template_id, exercise_id, week_number, day_number, day_label,
             target_sets, target_reps, start_weight, rpe_target, tempo, rest_seconds,
             progression_type, progression_config, notes, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [uuidv4(), id, ex.exerciseId, ex.weekNumber ?? 1, ex.dayNumber ?? 1,
           ex.dayLabel || null, ex.targetSets ?? 3, ex.targetReps || null,
           ex.startWeight ?? null, ex.rpeTarget ?? null, ex.tempo || null,
           ex.restSeconds ?? null, ex.progressionType ?? 'linear',
           ex.progressionConfig ? JSON.stringify(ex.progressionConfig) : null,
           ex.notes || null, ex.sortOrder ?? 0],
        );
      }
    }

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  return getTemplate(tenantId, id);
}

export async function deleteTemplate(tenantId: string, templateId: string): Promise<void> {
  const [r] = await db.execute<ResultSetHeader>(
    'UPDATE gym_workout_templates SET is_active = 0 WHERE id = ? AND tenant_id = ?',
    [templateId, tenantId],
  );
  if (r.affectedRows === 0) throw new AppError('Plantilla no encontrada', 404);
}

// ════════════════════════════════════════════════════════════════════
// ASIGNACIONES
// ════════════════════════════════════════════════════════════════════

export async function assignTemplate(
  tenantId: string,
  assignedBy: string,
  input: AssignTemplateInput,
): Promise<WorkoutAssignment[]> {
  const [template] = await db.execute<Row[]>(
    'SELECT id FROM gym_workout_templates WHERE id = ? AND tenant_id = ? AND is_active = 1',
    [input.templateId, tenantId],
  );
  if (!template.length) throw new AppError('Plantilla no encontrada', 404);

  const results: WorkoutAssignment[] = [];
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    for (const memberId of input.memberIds) {
      const [member] = await conn.execute<Row[]>(
        'SELECT id FROM gym_members WHERE id = ? AND tenant_id = ?', [memberId, tenantId],
      );
      if (!member.length) continue;

      const assignmentId = uuidv4();
      await conn.execute(
        `INSERT INTO gym_workout_assignments
          (id, tenant_id, template_id, member_id, start_date, start_week, status, assigned_by)
         VALUES (?, ?, ?, ?, ?, ?, 'activo', ?)`,
        [assignmentId, tenantId, input.templateId, memberId,
         input.startDate || new Date().toISOString().slice(0, 10),
         input.startWeek ?? 1, assignedBy],
      );

      await addTimelineEvent(tenantId, memberId, 'workout.template_assigned',
        'Rutina asignada', 'assignment', assignmentId).catch(() => {});

      results.push({
        id: assignmentId, tenantId, templateId: input.templateId, memberId,
        startDate: input.startDate || new Date().toISOString().slice(0, 10),
        startWeek: input.startWeek ?? 1, status: 'activo', assignedBy,
        completedAt: null, notes: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
    }

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  return results;
}

export async function listAssignments(
  tenantId: string,
  filters?: { memberId?: string; status?: string },
): Promise<WorkoutAssignment[]> {
  const conditions: string[] = ['a.tenant_id = ?'];
  const params: unknown[] = [tenantId];
  if (filters?.memberId) { conditions.push('a.member_id = ?'); params.push(filters.memberId); }
  if (filters?.status) { conditions.push('a.status = ?'); params.push(filters.status); }

  const [rows] = await db.execute<Row[]>(
    `SELECT a.id, a.tenant_id AS tenantId, a.template_id AS templateId, a.member_id AS memberId,
            a.start_date AS startDate, a.start_week AS startWeek, a.status,
            a.assigned_by AS assignedBy, a.completed_at AS completedAt, a.notes,
            a.created_at AS createdAt, a.updated_at AS updatedAt,
            t.name AS templateName, m.member_number AS memberNumber,
            u.name AS memberName
     FROM gym_workout_assignments a
     JOIN gym_workout_templates t ON t.id = a.template_id
     JOIN gym_members m ON m.id = a.member_id
     JOIN users u ON u.id = m.user_id
     WHERE ${conditions.join(' AND ')} ORDER BY a.created_at DESC LIMIT 100`,
    params,
  );
  return rows as WorkoutAssignment[];
}

export async function getActiveAssignment(
  tenantId: string,
  memberId: string,
): Promise<WorkoutAssignment | null> {
  const [rows] = await db.execute<Row[]>(
    `SELECT a.id, a.tenant_id AS tenantId, a.template_id AS templateId, a.member_id AS memberId,
            a.start_date AS startDate, a.start_week AS startWeek, a.status,
            a.assigned_by AS assignedBy, a.completed_at AS completedAt, a.notes,
            a.created_at AS createdAt, a.updated_at AS updatedAt
     FROM gym_workout_assignments a
     WHERE a.tenant_id = ? AND a.member_id = ? AND a.status = 'activo'
     ORDER BY a.created_at DESC LIMIT 1`,
    [tenantId, memberId],
  );
  if (!rows.length) return null;
  return getAssignmentWithTemplate(tenantId, rows[0].id);
}

async function getAssignmentWithTemplate(tenantId: string, assignmentId: string): Promise<WorkoutAssignment> {
  const [rows] = await db.execute<Row[]>(
    `SELECT a.id, a.tenant_id AS tenantId, a.template_id AS templateId, a.member_id AS memberId,
            a.start_date AS startDate, a.start_week AS startWeek, a.status,
            a.assigned_by AS assignedBy, a.completed_at AS completedAt, a.notes,
            a.created_at AS createdAt, a.updated_at AS updatedAt
     FROM gym_workout_assignments a WHERE a.id = ? AND a.tenant_id = ?`,
    [assignmentId, tenantId],
  );
  if (!rows.length) throw new AppError('Asignación no encontrada', 404);

  const assignment = rows[0] as WorkoutAssignment;
  try { assignment.template = await getTemplate(tenantId, assignment.templateId); } catch {}
  return assignment;
}

// ════════════════════════════════════════════════════════════════════
// SESIONES DE ENTRENAMIENTO
// ════════════════════════════════════════════════════════════════════

export async function startSession(
  tenantId: string,
  memberId: string,
  input: StartSessionInput,
): Promise<WorkoutSession> {
  const [member] = await db.execute<Row[]>(
    'SELECT id FROM gym_members WHERE id = ? AND tenant_id = ?', [memberId, tenantId],
  );
  if (!member.length) throw new AppError('Miembro no encontrado', 404);

  const sessionId = uuidv4();
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    await conn.execute(
      `INSERT INTO gym_workout_sessions
        (id, tenant_id, member_id, assignment_id, week_number, day_number, day_label)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [sessionId, tenantId, memberId, input.assignmentId || null,
       input.weekNumber ?? null, input.dayNumber ?? null, input.dayLabel || null],
    );

    for (const ex of input.exercises) {
      await conn.execute(
        `INSERT INTO gym_workout_session_exercises
          (id, session_id, exercise_id, exercise_name, sort_order)
         VALUES (?, ?, ?, ?, ?)`,
        [uuidv4(), sessionId, ex.exerciseId, ex.exerciseName, ex.sortOrder],
      );
    }

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  await addTimelineEvent(tenantId, memberId, 'workout.started',
    'Entrenamiento iniciado', 'session', sessionId).catch(() => {});

  return getSession(tenantId, sessionId);
}

export async function getSession(tenantId: string, sessionId: string): Promise<WorkoutSession> {
  const [rows] = await db.execute<Row[]>(
    `SELECT id, tenant_id AS tenantId, member_id AS memberId, assignment_id AS assignmentId,
            week_number AS weekNumber, day_number AS dayNumber, day_label AS dayLabel,
            started_at AS startedAt, ended_at AS endedAt, duration_min AS durationMin,
            perceived_effort AS perceivedEffort, notes, created_at AS createdAt
     FROM gym_workout_sessions WHERE id = ? AND tenant_id = ?`,
    [sessionId, tenantId],
  );
  if (!rows.length) throw new AppError('Sesión no encontrada', 404);

  const session = rows[0] as WorkoutSession;

  const [exRows] = await db.execute<Row[]>(
    `SELECT e.id, e.session_id AS sessionId, e.exercise_id AS exerciseId,
            e.exercise_name AS exerciseName, e.sort_order AS sortOrder, e.notes,
            l.name AS libName, l.muscle_group AS libMuscle, l.equipment AS libEquipment
     FROM gym_workout_session_exercises e
     LEFT JOIN gym_exercise_library l ON l.id = e.exercise_id
     WHERE e.session_id = ? ORDER BY e.sort_order ASC`,
    [sessionId],
  );

  session.exercises = [];
  for (const ex of exRows as any[]) {
    const [setRows] = await db.execute<Row[]>(
      `SELECT id, session_exercise_id AS sessionExerciseId, set_number AS setNumber,
              weight_kg AS weightKg, reps, rpe, is_warmup AS isWarmup,
              is_failure AS isFailure, is_skipped AS isSkipped, is_extra AS isExtra,
              rest_seconds AS restSeconds, duration_seconds AS durationSeconds,
              notes, created_at AS createdAt
       FROM gym_workout_sets WHERE session_exercise_id = ? ORDER BY set_number ASC`,
      [ex.id],
    );
    session.exercises.push({
      ...ex,
      sets: setRows.map(s => ({
        ...s,
        isWarmup: Boolean(s.isWarmup), isFailure: Boolean(s.isFailure),
        isSkipped: Boolean(s.isSkipped), isExtra: Boolean(s.isExtra),
      })) as WorkoutSet[],
      exercise: ex.libName ? {
        id: ex.exerciseId, name: ex.libName,
        muscleGroup: ex.libMuscle, equipment: ex.libEquipment,
      } as any : undefined,
    });
  }

  return session;
}

export async function logSet(
  tenantId: string,
  sessionId: string,
  input: LogSetInput,
): Promise<WorkoutSet> {
  const [session] = await db.execute<Row[]>(
    'SELECT id FROM gym_workout_sessions WHERE id = ? AND tenant_id = ?',
    [sessionId, tenantId],
  );
  if (!session.length) throw new AppError('Sesión no encontrada', 404);

  const setId = uuidv4();
  await db.execute<ResultSetHeader>(
    `INSERT INTO gym_workout_sets
      (id, session_exercise_id, set_number, weight_kg, reps, rpe,
       is_warmup, is_failure, is_skipped, is_extra, rest_seconds, duration_seconds, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [setId, input.sessionExerciseId, input.setNumber,
     input.weightKg ?? null, input.reps ?? null, input.rpe ?? null,
     input.isWarmup ? 1 : 0, input.isFailure ? 1 : 0,
     input.isSkipped ? 1 : 0, input.isExtra ? 1 : 0,
     input.restSeconds ?? null, input.durationSeconds ?? null, input.notes || null],
  );

  const [rows] = await db.execute<Row[]>(
    `SELECT id, session_exercise_id AS sessionExerciseId, set_number AS setNumber,
            weight_kg AS weightKg, reps, rpe, is_warmup AS isWarmup,
            is_failure AS isFailure, is_skipped AS isSkipped, is_extra AS isExtra,
            rest_seconds AS restSeconds, duration_seconds AS durationSeconds,
            notes, created_at AS createdAt
     FROM gym_workout_sets WHERE id = ?`,
    [setId],
  );
  const set = rows[0] as any;
  return { ...set, isWarmup: Boolean(set.isWarmup), isFailure: Boolean(set.isFailure), isSkipped: Boolean(set.isSkipped), isExtra: Boolean(set.isExtra) };
}

export async function endSession(
  tenantId: string,
  sessionId: string,
  input?: { perceivedEffort?: number; notes?: string },
): Promise<WorkoutSession> {
  const [session] = await db.execute<Row[]>(
    `SELECT id, member_id AS memberId, started_at AS startedAt
     FROM gym_workout_sessions WHERE id = ? AND tenant_id = ? AND ended_at IS NULL`,
    [sessionId, tenantId],
  );
  if (!session.length) throw new AppError('Sesión no encontrada o ya finalizada', 404);

  const s = session[0] as any;
  const startedAt = new Date(s.startedAt);
  const durationMin = Math.round((Date.now() - startedAt.getTime()) / 60000);

  await db.execute<ResultSetHeader>(
    `UPDATE gym_workout_sessions
     SET ended_at = NOW(), duration_min = ?, perceived_effort = ?, notes = ?
     WHERE id = ?`,
    [durationMin, input?.perceivedEffort ?? null, input?.notes || null, sessionId],
  );

  await addTimelineEvent(tenantId, s.memberId, 'workout.completed',
    `Entrenamiento terminado (${durationMin} min)`, 'session', sessionId,
    { durationMin }).catch(() => {});

  await detectPersonalRecords(tenantId, s.memberId, sessionId);

  return getSession(tenantId, sessionId);
}

// ════════════════════════════════════════════════════════════════════
// PERSONAL RECORDS
// ════════════════════════════════════════════════════════════════════

async function detectPersonalRecords(tenantId: string, memberId: string, sessionId: string): Promise<void> {
  const session = await getSession(tenantId, sessionId);
  if (!session.exercises) return;

  for (const ex of session.exercises) {
    if (!ex.sets?.length) continue;
    const workingSets = ex.sets.filter(s => !s.isWarmup && !s.isSkipped);

    // Max weight
    const maxWeightSet = workingSets.reduce((max, s) => (s.weightKg && (!max || (s.weightKg || 0) > (max.weightKg || 0)) ? s : max), workingSets[0]);
    if (maxWeightSet?.weightKg) {
      await checkAndRecordPR(tenantId, memberId, ex.exerciseId, ex.exerciseName, 'max_weight',
        maxWeightSet.weightKg, 'kg', sessionId);
    }

    // Max reps in one set
    const maxRepsSet = workingSets.reduce((max, s) => (s.reps && (!max || (s.reps || 0) > (max.reps || 0)) ? s : max), workingSets[0]);
    if (maxRepsSet?.reps) {
      await checkAndRecordPR(tenantId, memberId, ex.exerciseId, ex.exerciseName, 'max_reps',
        maxRepsSet.reps, 'reps', sessionId);
    }

    // Max volume (weight * reps) for a single set
    const maxVolumeSet = workingSets.reduce((max, s) => {
      const vol = (s.weightKg || 0) * (s.reps || 0);
      const maxVol = (max?.weightKg || 0) * (max?.reps || 0);
      return vol > maxVol ? s : max;
    }, workingSets[0]);
    if (maxVolumeSet?.weightKg && maxVolumeSet?.reps) {
      await checkAndRecordPR(tenantId, memberId, ex.exerciseId, ex.exerciseName, 'max_volume',
        maxVolumeSet.weightKg * maxVolumeSet.reps, 'kg×reps', sessionId);
    }
  }
}

async function checkAndRecordPR(
  tenantId: string,
  memberId: string,
  exerciseId: string | null,
  exerciseName: string,
  recordType: string,
  value: number,
  unit: string,
  sessionId: string,
): Promise<void> {
  const [existing] = await db.execute<Row[]>(
    `SELECT id, value FROM gym_personal_records
     WHERE member_id = ? AND exercise_id = ? AND record_type = ?
     ORDER BY value DESC LIMIT 1`,
    [memberId, exerciseId, recordType],
  );

  const previousValue = existing.length ? Number(existing[0].value) : null;

  if (previousValue === null || value > previousValue) {
    const prId = uuidv4();
    await db.execute<ResultSetHeader>(
      `INSERT INTO gym_personal_records
        (id, tenant_id, member_id, exercise_id, exercise_name, record_type, value, unit, session_id, previous_value)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [prId, tenantId, memberId, exerciseId, exerciseName, recordType, value, unit, sessionId, previousValue],
    );

    const diff = previousValue ? `+${(value - previousValue).toFixed(1)} ${unit}` : `nuevo récord`;
    await addTimelineEvent(tenantId, memberId, 'workout.record',
      `Nuevo récord: ${exerciseName} ${value}${unit} (${diff})`, 'personal_record', prId,
      { recordType, value, unit, previousValue }).catch(() => {});
  }
}

export async function listPersonalRecords(
  tenantId: string,
  memberId: string,
  filters?: { exerciseId?: string; recordType?: string },
): Promise<PersonalRecord[]> {
  const conditions: string[] = ['pr.tenant_id = ?', 'pr.member_id = ?'];
  const params: unknown[] = [tenantId, memberId];
  if (filters?.exerciseId) { conditions.push('pr.exercise_id = ?'); params.push(filters.exerciseId); }
  if (filters?.recordType) { conditions.push('pr.record_type = ?'); params.push(filters.recordType); }

  const [rows] = await db.execute<Row[]>(
    `SELECT pr.id, pr.tenant_id AS tenantId, pr.member_id AS memberId,
            pr.exercise_id AS exerciseId, pr.exercise_name AS exerciseName,
            pr.record_type AS recordType, pr.value, pr.unit,
            pr.session_id AS sessionId, pr.achieved_at AS achievedAt,
            pr.previous_value AS previousValue, pr.created_at AS createdAt
     FROM gym_personal_records pr
     WHERE ${conditions.join(' AND ')}
     ORDER BY pr.achieved_at DESC LIMIT 100`,
    params,
  );
  return rows as PersonalRecord[];
}

// ════════════════════════════════════════════════════════════════════
// HISTORIAL DE SESIONES
// ════════════════════════════════════════════════════════════════════

export async function listSessions(
  tenantId: string,
  memberId: string,
  limit = 30,
): Promise<WorkoutSession[]> {
  const [rows] = await db.execute<Row[]>(
    `SELECT id, tenant_id AS tenantId, member_id AS memberId, assignment_id AS assignmentId,
            week_number AS weekNumber, day_number AS dayNumber, day_label AS dayLabel,
            started_at AS startedAt, ended_at AS endedAt, duration_min AS durationMin,
            perceived_effort AS perceivedEffort, notes, created_at AS createdAt
     FROM gym_workout_sessions
     WHERE tenant_id = ? AND member_id = ?
     ORDER BY started_at DESC LIMIT ?`,
    [tenantId, memberId, limit],
  );
  return rows as WorkoutSession[];
}

export async function getMemberTrainingStats(
  tenantId: string,
  memberId: string,
): Promise<{
  totalSessions: number
  totalDurationMin: number
  totalSets: number
  lastSession: WorkoutSession | null
  sessionsThisWeek: number
  sessionsThisMonth: number
}> {
  const [[{ totalSessions }]] = await db.execute<Row[]>(
    'SELECT COUNT(*) AS totalSessions FROM gym_workout_sessions WHERE tenant_id = ? AND member_id = ?',
    [tenantId, memberId],
  ) as unknown as [{ totalSessions: number }[]];

  const [[{ totalDurationMin = 0 }]] = await db.execute<Row[]>(
    'SELECT COALESCE(SUM(duration_min), 0) AS totalDurationMin FROM gym_workout_sessions WHERE tenant_id = ? AND member_id = ?',
    [tenantId, memberId],
  ) as unknown as [{ totalDurationMin: number }[]];

  const [[{ totalSets = 0 }]] = await db.execute<Row[]>(
    `SELECT COALESCE(SUM(setCount), 0) AS totalSets FROM (
       SELECT COUNT(*) AS setCount FROM gym_workout_sets ws
       JOIN gym_workout_session_exercises wse ON wse.id = ws.session_exercise_id
       JOIN gym_workout_sessions w ON w.id = wse.session_id
       WHERE w.tenant_id = ? AND w.member_id = ? AND ws.is_warmup = 0
     ) t`,
    [tenantId, memberId],
  ) as unknown as [{ totalSets: number }[]];

  const [last] = await db.execute<Row[]>(
    `SELECT id, started_at AS startedAt FROM gym_workout_sessions
     WHERE tenant_id = ? AND member_id = ? ORDER BY started_at DESC LIMIT 1`,
    [tenantId, memberId],
  );

  const [[{ sessionsThisWeek }]] = await db.execute<Row[]>(
    `SELECT COUNT(*) AS sessionsThisWeek FROM gym_workout_sessions
     WHERE tenant_id = ? AND member_id = ? AND started_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
    [tenantId, memberId],
  ) as unknown as [{ sessionsThisWeek: number }[]];

  const [[{ sessionsThisMonth }]] = await db.execute<Row[]>(
    `SELECT COUNT(*) AS sessionsThisMonth FROM gym_workout_sessions
     WHERE tenant_id = ? AND member_id = ? AND MONTH(started_at) = MONTH(NOW()) AND YEAR(started_at) = YEAR(NOW())`,
    [tenantId, memberId],
  ) as unknown as [{ sessionsThisMonth: number }[]];

  let lastSession: WorkoutSession | null = null;
  if (last.length) {
    try { lastSession = await getSession(tenantId, last[0].id); } catch {}
  }

  return { totalSessions: Number(totalSessions), totalDurationMin: Number(totalDurationMin), totalSets: Number(totalSets), lastSession, sessionsThisWeek: Number(sessionsThisWeek), sessionsThisMonth: Number(sessionsThisMonth) };
}
