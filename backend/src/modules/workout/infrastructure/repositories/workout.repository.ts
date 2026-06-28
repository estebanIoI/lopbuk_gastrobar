/**
 * Workout Runtime · infrastructure/repositories
 * -----------------------------------------------------------------------------
 * ÚNICO lugar con acceso a la base de datos del runtime. Siempre filtra por
 * user_id (dueño de los datos, del JWT). Usa transacciones para operaciones
 * compuestas. Devuelve entidades de dominio ya tipadas.
 */

import db from '../../../../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { v4 as uuid } from 'uuid';
import {
  WorkoutSession,
  WorkoutExercise,
  WorkoutSet,
  ExerciseProgressionSnapshot,
} from '../../domain/entities/types';
import { SessionStatus } from '../../shared/enums';
import { StartSessionInput } from '../../shared/schema';
import { GoalType, MovementPattern } from '../../../progression';

interface Row extends RowDataPacket {}

const num = (v: any): number => (v == null ? 0 : Number(v));
const iso = (v: any): string | null => (v == null ? null : new Date(v).toISOString());

function mapSet(r: any): WorkoutSet {
  return {
    id: r.id,
    setNumber: num(r.set_number),
    targetReps: num(r.target_reps),
    completedReps: r.completed_reps == null ? null : num(r.completed_reps),
    targetWeight: num(r.target_weight),
    usedWeight: r.used_weight == null ? null : num(r.used_weight),
    completed: !!r.completed,
    completedAt: iso(r.completed_at),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────────────────
export async function createSession(userId: string, input: StartSessionInput): Promise<string> {
  const conn = await (db as any).getConnection();
  try {
    await conn.beginTransaction();
    const sessionId = uuid();
    const now = new Date();

    await conn.execute(
      `INSERT INTO workout_sessions
         (id, user_id, routine_id, goal, status, started_at, total_volume, current_exercise_index)
       VALUES (?, ?, ?, ?, 'active', ?, 0, 0)`,
      [sessionId, userId, input.routineId ?? null, input.goal, now]
    );

    for (let i = 0; i < input.exercises.length; i++) {
      const e = input.exercises[i];
      const exId = uuid();
      await conn.execute(
        `INSERT INTO workout_exercises
           (id, session_id, user_id, exercise_id, exercise_name, exercise_order,
            target_sets, target_reps, suggested_weight, movement_pattern)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          exId, sessionId, userId, e.exerciseId, e.name ?? null, e.order ?? i,
          e.targetSets, e.targetReps, e.suggestedWeight, e.movementPattern ?? null,
        ]
      );
      for (let s = 1; s <= e.targetSets; s++) {
        await conn.execute(
          `INSERT INTO workout_sets
             (id, exercise_session_id, user_id, set_number, target_reps, target_weight)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [uuid(), exId, userId, s, e.targetReps, e.suggestedWeight]
        );
      }
    }

    await conn.commit();
    return sessionId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────────────────
export async function getDeepSession(userId: string, sessionId: string): Promise<WorkoutSession | null> {
  const [sRows] = await db.execute<Row[]>(
    `SELECT * FROM workout_sessions WHERE id = ? AND user_id = ? LIMIT 1`,
    [sessionId, userId]
  );
  const s = (sRows as any[])[0];
  if (!s) return null;

  const [exRows] = await db.execute<Row[]>(
    `SELECT * FROM workout_exercises WHERE session_id = ? AND user_id = ? ORDER BY exercise_order ASC`,
    [sessionId, userId]
  );
  const exIds = (exRows as any[]).map((e) => e.id);

  const setsByExercise: Record<string, any[]> = {};
  if (exIds.length > 0) {
    const placeholders = exIds.map(() => '?').join(',');
    const [setRows] = await db.execute<Row[]>(
      `SELECT * FROM workout_sets WHERE exercise_session_id IN (${placeholders}) ORDER BY set_number ASC`,
      exIds
    );
    for (const r of setRows as any[]) (setsByExercise[r.exercise_session_id] ||= []).push(r);
  }

  const exercises: WorkoutExercise[] = (exRows as any[]).map((e) => ({
    id: e.id,
    exerciseId: e.exercise_id,
    name: e.exercise_name ?? null,
    order: num(e.exercise_order),
    targetSets: num(e.target_sets),
    targetReps: num(e.target_reps),
    suggestedWeight: num(e.suggested_weight),
    movementPattern: (e.movement_pattern as MovementPattern | null) ?? null,
    completed: !!e.completed,
    sets: (setsByExercise[e.id] || []).map(mapSet),
  }));

  return {
    id: s.id,
    userId: s.user_id,
    routineId: s.routine_id ?? null,
    goal: s.goal as GoalType,
    status: s.status as SessionStatus,
    startedAt: iso(s.started_at),
    completedAt: iso(s.completed_at),
    durationSeconds: s.duration_seconds == null ? null : num(s.duration_seconds),
    totalVolume: num(s.total_volume),
    currentExerciseIndex: num(s.current_exercise_index),
    exercises,
  };
}

export async function listSessions(userId: string, limit = 30): Promise<Array<Omit<WorkoutSession, 'exercises'>>> {
  const lim = Math.min(100, Math.max(1, limit));
  const [rows] = await db.execute<Row[]>(
    `SELECT * FROM workout_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT ${lim}`,
    [userId]
  );
  return (rows as any[]).map((s) => ({
    id: s.id,
    userId: s.user_id,
    routineId: s.routine_id ?? null,
    goal: s.goal as GoalType,
    status: s.status as SessionStatus,
    startedAt: iso(s.started_at),
    completedAt: iso(s.completed_at),
    durationSeconds: s.duration_seconds == null ? null : num(s.duration_seconds),
    totalVolume: num(s.total_volume),
    currentExerciseIndex: num(s.current_exercise_index),
  }));
}

/** Estado actual de una sesión del usuario (o null). Para la máquina de estados. */
export async function getSessionStatus(
  userId: string,
  sessionId: string
): Promise<{ status: SessionStatus; startedAt: Date | null } | null> {
  const [rows] = await db.execute<Row[]>(
    `SELECT status, started_at FROM workout_sessions WHERE id = ? AND user_id = ? LIMIT 1`,
    [sessionId, userId]
  );
  const r = (rows as any[])[0];
  if (!r) return null;
  return { status: r.status as SessionStatus, startedAt: r.started_at ? new Date(r.started_at) : null };
}

// ─────────────────────────────────────────────────────────────────────────────
// WRITE
// ─────────────────────────────────────────────────────────────────────────────
export async function updateStatus(
  userId: string,
  sessionId: string,
  status: SessionStatus,
  extra: { startedAt?: Date; completedAt?: Date; durationSeconds?: number; totalVolume?: number } = {}
): Promise<void> {
  const sets: string[] = ['status = ?'];
  const args: any[] = [status];
  if (extra.startedAt !== undefined) { sets.push('started_at = ?'); args.push(extra.startedAt); }
  if (extra.completedAt !== undefined) { sets.push('completed_at = ?'); args.push(extra.completedAt); }
  if (extra.durationSeconds !== undefined) { sets.push('duration_seconds = ?'); args.push(extra.durationSeconds); }
  if (extra.totalVolume !== undefined) { sets.push('total_volume = ?'); args.push(extra.totalVolume); }
  args.push(sessionId, userId);
  await db.execute<ResultSetHeader>(
    `UPDATE workout_sessions SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`,
    args
  );
}

/** Marca un set como completado. Devuelve el id del ejercicio dueño, o null si no aplica. */
export async function completeSet(
  userId: string,
  sessionId: string,
  setId: string,
  completedReps: number,
  usedWeight: number
): Promise<string | null> {
  // El set debe pertenecer al usuario y a un ejercicio de esa sesión.
  const [rows] = await db.execute<Row[]>(
    `SELECT s.id, s.exercise_session_id
       FROM workout_sets s
       JOIN workout_exercises e ON e.id = s.exercise_session_id
      WHERE s.id = ? AND s.user_id = ? AND e.session_id = ? LIMIT 1`,
    [setId, userId, sessionId]
  );
  const row = (rows as any[])[0];
  if (!row) return null;

  await db.execute<ResultSetHeader>(
    `UPDATE workout_sets
        SET completed = 1, completed_reps = ?, used_weight = ?, completed_at = NOW()
      WHERE id = ? AND user_id = ?`,
    [completedReps, usedWeight, setId, userId]
  );
  return row.exercise_session_id as string;
}

/** Recalcula si TODOS los sets del ejercicio están completados → marca completed. */
export async function refreshExerciseCompletion(userId: string, exerciseSessionId: string): Promise<boolean> {
  const [rows] = await db.execute<Row[]>(
    `SELECT COUNT(*) AS total, SUM(completed) AS done
       FROM workout_sets WHERE exercise_session_id = ? AND user_id = ?`,
    [exerciseSessionId, userId]
  );
  const r = (rows as any[])[0];
  const allDone = num(r.total) > 0 && num(r.done) === num(r.total);
  await db.execute<ResultSetHeader>(
    `UPDATE workout_exercises SET completed = ? WHERE id = ? AND user_id = ?`,
    [allDone ? 1 : 0, exerciseSessionId, userId]
  );
  return allDone;
}

/** Upsert del snapshot de progresión por (usuario, ejercicio). */
export async function upsertProgression(userId: string, snap: ExerciseProgressionSnapshot): Promise<void> {
  await db.execute<ResultSetHeader>(
    `INSERT INTO exercise_progressions
       (id, user_id, exercise_id, current_weight, next_weight, best_weight,
        last_action, completion_rate, estimated_1rm)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       current_weight = VALUES(current_weight),
       next_weight    = VALUES(next_weight),
       best_weight    = GREATEST(best_weight, VALUES(best_weight)),
       last_action    = VALUES(last_action),
       completion_rate= VALUES(completion_rate),
       estimated_1rm  = GREATEST(estimated_1rm, VALUES(estimated_1rm))`,
    [
      uuid(), userId, snap.exerciseId, snap.currentWeight, snap.nextWeight, snap.currentWeight,
      snap.action, snap.completionRate, snap.estimated1RM,
    ]
  );
}

/** Última progresión sugerida por ejercicio (para precargar el peso al iniciar). */
export async function getProgression(userId: string, exerciseId: string): Promise<ExerciseProgressionSnapshot | null> {
  const [rows] = await db.execute<Row[]>(
    `SELECT * FROM exercise_progressions WHERE user_id = ? AND exercise_id = ? LIMIT 1`,
    [userId, exerciseId]
  );
  const r = (rows as any[])[0];
  if (!r) return null;
  return {
    exerciseId: r.exercise_id,
    currentWeight: num(r.current_weight),
    nextWeight: num(r.next_weight),
    action: (r.last_action as ExerciseProgressionSnapshot['action']) ?? 'maintain',
    completionRate: num(r.completion_rate),
    estimated1RM: num(r.estimated_1rm),
  };
}
