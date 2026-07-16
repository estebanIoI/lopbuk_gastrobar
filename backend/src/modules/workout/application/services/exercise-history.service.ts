/**
 * Workout Runtime · application/services/exercise-history
 * -----------------------------------------------------------------------------
 * Historial y récords por ejercicio (P5). Se calcula desde los sets ya
 * registrados (workout_sets + workout_exercises) — no duplica estado ni toca
 * el camino de escritura, así nunca se desincroniza.
 *
 * Expone lo que motiva al usuario al iniciar rutina:
 *   "Última vez 80 kg × 8"   ·   "PR 95 kg"   ·   "Mejor volumen"
 */
import pool from '../../../../config/database';
import type { RowDataPacket } from 'mysql2';

export interface ExerciseHistory {
  exerciseId: string;
  lastWeight: number | null;
  lastReps: number | null;
  lastAt: string | null;
  prWeight: number | null;
  prReps: number | null;
  prAt: string | null;
  /** Mejor volumen (peso × reps) logrado en una sola sesión. */
  bestVolume: number | null;
  /** 1RM estimado con Epley sobre el PR. */
  estimated1rm: number | null;
  sessions: number;
}

const num = (v: any): number | null => (v === null || v === undefined ? null : Number(v));

export async function getExerciseHistory(
  userId: string,
  exerciseIds: string[],
): Promise<Record<string, ExerciseHistory>> {
  const ids = [...new Set(exerciseIds.filter(Boolean))];
  if (!ids.length) return {};

  const [agg] = await pool.query<RowDataPacket[]>(
    `SELECT we.exercise_id AS id,
            COUNT(DISTINCT we.session_id) AS sessions
     FROM workout_sets ws
     JOIN workout_exercises we ON we.id = ws.exercise_session_id
     WHERE ws.user_id = ? AND ws.completed = 1 AND we.exercise_id IN (?)
     GROUP BY we.exercise_id`,
    [userId, ids],
  );

  // Último set completado por ejercicio
  const [last] = await pool.query<RowDataPacket[]>(
    `SELECT t.exercise_id AS id, t.used_weight, t.completed_reps, t.completed_at
     FROM (
       SELECT we.exercise_id, ws.used_weight, ws.completed_reps, ws.completed_at,
              ROW_NUMBER() OVER (PARTITION BY we.exercise_id ORDER BY ws.completed_at DESC) rn
       FROM workout_sets ws
       JOIN workout_exercises we ON we.id = ws.exercise_session_id
       WHERE ws.user_id = ? AND ws.completed = 1 AND we.exercise_id IN (?)
     ) t WHERE t.rn = 1`,
    [userId, ids],
  );

  // PR: set con mayor peso (desempata por más reps)
  const [pr] = await pool.query<RowDataPacket[]>(
    `SELECT t.exercise_id AS id, t.used_weight, t.completed_reps, t.completed_at
     FROM (
       SELECT we.exercise_id, ws.used_weight, ws.completed_reps, ws.completed_at,
              ROW_NUMBER() OVER (PARTITION BY we.exercise_id ORDER BY ws.used_weight DESC, ws.completed_reps DESC) rn
       FROM workout_sets ws
       JOIN workout_exercises we ON we.id = ws.exercise_session_id
       WHERE ws.user_id = ? AND ws.completed = 1 AND ws.used_weight IS NOT NULL AND we.exercise_id IN (?)
     ) t WHERE t.rn = 1`,
    [userId, ids],
  );

  // Mejor volumen en una sola sesión
  const [vol] = await pool.query<RowDataPacket[]>(
    `SELECT s.exercise_id AS id, MAX(s.v) AS best_volume FROM (
       SELECT we.exercise_id, we.session_id, SUM(ws.used_weight * ws.completed_reps) AS v
       FROM workout_sets ws
       JOIN workout_exercises we ON we.id = ws.exercise_session_id
       WHERE ws.user_id = ? AND ws.completed = 1 AND we.exercise_id IN (?)
       GROUP BY we.exercise_id, we.session_id
     ) s GROUP BY s.exercise_id`,
    [userId, ids],
  );

  const byId = <T extends RowDataPacket>(rows: T[]) =>
    Object.fromEntries(rows.map(r => [String(r.id), r]));
  const aggM = byId(agg), lastM = byId(last), prM = byId(pr), volM = byId(vol);

  const out: Record<string, ExerciseHistory> = {};
  for (const id of ids) {
    const p = prM[id];
    const prWeight = num(p?.used_weight);
    const prReps = num(p?.completed_reps);
    out[id] = {
      exerciseId: id,
      lastWeight: num(lastM[id]?.used_weight),
      lastReps: num(lastM[id]?.completed_reps),
      lastAt: lastM[id]?.completed_at ?? null,
      prWeight,
      prReps,
      prAt: p?.completed_at ?? null,
      bestVolume: num(volM[id]?.best_volume),
      // Epley: 1RM ≈ peso × (1 + reps/30)
      estimated1rm: prWeight && prReps ? Math.round(prWeight * (1 + prReps / 30) * 10) / 10 : null,
      sessions: Number(aggM[id]?.sessions ?? 0),
    };
  }
  return out;
}
