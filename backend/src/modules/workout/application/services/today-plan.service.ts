/**
 * Workout Runtime · application/services/today-plan
 * -----------------------------------------------------------------------------
 * Glue para "Iniciar rutina": ensambla el PLAN DE INICIO de la sesión de hoy.
 *
 * Los templates de ejercicios son CONTENIDO (qué ejercicios, series, reps),
 * no lógica de progresión. El peso sugerido SIEMPRE viene del backend: del
 * snapshot `exercise_progressions` (nextWeight recomendado por el motor) y, si
 * no hay historial, de un peso de arranque del template. El front no calcula.
 */

import * as repo from '../../infrastructure/repositories/workout.repository';
import { StartSessionInput, StartExerciseInput } from '../../shared/schema';
import { MovementPattern } from '../../../progression';
import pool from '../../../../config/database';
import type { RowDataPacket } from 'mysql2';

interface TemplateExercise {
  exerciseId: string;
  name: string;
  movementPattern: MovementPattern;
  targetSets: number;
  targetReps: number;
  startWeight: number; // arranque cuando no hay historial
}

const UPPER: TemplateExercise[] = [
  { exerciseId: 'press_banca', name: 'Press de banca', movementPattern: 'upper', targetSets: 4, targetReps: 12, startWeight: 20 },
  { exerciseId: 'remo_barra', name: 'Remo con barra', movementPattern: 'upper', targetSets: 4, targetReps: 12, startWeight: 25 },
  { exerciseId: 'press_militar', name: 'Press militar', movementPattern: 'upper', targetSets: 3, targetReps: 12, startWeight: 15 },
  { exerciseId: 'jalon_pecho', name: 'Jalón al pecho', movementPattern: 'upper', targetSets: 3, targetReps: 12, startWeight: 30 },
  { exerciseId: 'curl_biceps', name: 'Curl de bíceps', movementPattern: 'upper', targetSets: 3, targetReps: 12, startWeight: 10 },
  { exerciseId: 'extension_triceps', name: 'Extensión de tríceps', movementPattern: 'upper', targetSets: 3, targetReps: 12, startWeight: 12.5 },
];

const LOWER: TemplateExercise[] = [
  { exerciseId: 'sentadilla', name: 'Sentadilla', movementPattern: 'lower', targetSets: 4, targetReps: 12, startWeight: 40 },
  { exerciseId: 'prensa', name: 'Prensa de pierna', movementPattern: 'lower', targetSets: 4, targetReps: 12, startWeight: 80 },
  { exerciseId: 'peso_muerto_rumano', name: 'Peso muerto rumano', movementPattern: 'lower', targetSets: 3, targetReps: 12, startWeight: 40 },
  { exerciseId: 'hip_thrust', name: 'Hip thrust', movementPattern: 'lower', targetSets: 3, targetReps: 12, startWeight: 40 },
  { exerciseId: 'extension_cuadriceps', name: 'Extensión de cuádriceps', movementPattern: 'lower', targetSets: 3, targetReps: 12, startWeight: 30 },
  { exerciseId: 'curl_femoral', name: 'Curl femoral', movementPattern: 'lower', targetSets: 3, targetReps: 12, startWeight: 25 },
];

const FULL_BODY: TemplateExercise[] = [
  { exerciseId: 'sentadilla', name: 'Sentadilla', movementPattern: 'lower', targetSets: 3, targetReps: 12, startWeight: 40 },
  { exerciseId: 'press_banca', name: 'Press de banca', movementPattern: 'upper', targetSets: 3, targetReps: 12, startWeight: 20 },
  { exerciseId: 'remo_barra', name: 'Remo con barra', movementPattern: 'upper', targetSets: 3, targetReps: 12, startWeight: 25 },
  { exerciseId: 'press_militar', name: 'Press militar', movementPattern: 'upper', targetSets: 3, targetReps: 12, startWeight: 15 },
  { exerciseId: 'peso_muerto_rumano', name: 'Peso muerto rumano', movementPattern: 'lower', targetSets: 3, targetReps: 12, startWeight: 40 },
];

/** Elige el template por palabras clave del título de la sesión de hoy. */
function pickTemplate(sessionTitle: string): TemplateExercise[] {
  const t = (sessionTitle || '').toLowerCase();
  if (/(inferior|lower|pierna|legs|leg)/.test(t)) return LOWER;
  if (/(superior|upper|push|pull|pecho|espalda|torso|empuje|jal)/.test(t)) return UPPER;
  return FULL_BODY;
}

/** Patrón del ejercicio derivado del grupo muscular de la librería. */
const LOWER_PARTS = new Set(['upper legs', 'lower legs']);
function patternFor(bodyPart?: string | null): MovementPattern {
  return bodyPart && LOWER_PARTS.has(String(bodyPart).toLowerCase()) ? 'lower' : 'upper';
}

/** Detecta el patrón buscado por el título (mismo criterio que pickTemplate). */
function wantedPattern(sessionTitle: string): MovementPattern | null {
  const t = (sessionTitle || '').toLowerCase();
  if (/(inferior|lower|pierna|legs|leg)/.test(t)) return 'lower';
  if (/(superior|upper|push|pull|pecho|espalda|torso|empuje|jal)/.test(t)) return 'upper';
  return null;
}

/**
 * Carga la rutina configurada desde el admin (arma sobre la librería de ejercicios).
 * Devuelve null si todavía no hay rutinas/tabla → el caller cae al template hardcodeado.
 * El `exerciseId` guardado es el id del dataset, así el front resuelve su imagen sola.
 */
async function loadRoutineTemplate(sessionTitle: string, routineId?: string): Promise<TemplateExercise[] | null> {
  try {
    // Solo versiones PUBLICADAS: un borrador en edición nunca afecta a quien entrena.
    let versionId: string | undefined;
    if (routineId) {
      const [v] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM routine_versions WHERE routine_id = ? AND status = 'published' ORDER BY version DESC LIMIT 1",
        [routineId],
      );
      if (v.length) versionId = String(v[0].id);
    }
    if (!versionId) {
      const wanted = wantedPattern(sessionTitle);
      const [rows] = wanted
        ? await pool.query<RowDataPacket[]>(
            `SELECT v.id FROM routine_versions v JOIN routines r ON r.id = v.routine_id
             WHERE v.status = 'published' AND r.is_active = 1 AND v.movement_pattern = ?
             ORDER BY r.sort_order ASC LIMIT 1`, [wanted])
        : await pool.query<RowDataPacket[]>(
            `SELECT v.id FROM routine_versions v JOIN routines r ON r.id = v.routine_id
             WHERE v.status = 'published' AND r.is_active = 1
             ORDER BY r.sort_order ASC LIMIT 1`);
      if (!rows.length) return null;
      versionId = String(rows[0].id);
    }

    const [exs] = await pool.query<RowDataPacket[]>(
      `SELECT rex.exercise_id, rex.target_sets, rex.target_reps, rex.start_weight,
              COALESCE(rex.display_name, t.name, ten.name) AS name,
              e.body_part, e.movement_pattern
       FROM routine_exercises rex
       LEFT JOIN exercises e ON e.id = rex.exercise_id
       LEFT JOIN exercise_translations t   ON t.exercise_id = e.id AND t.language = 'es'
       LEFT JOIN exercise_translations ten ON ten.exercise_id = e.id AND ten.language = 'en'
       WHERE rex.routine_version_id = ? ORDER BY rex.exercise_order ASC`,
      [versionId],
    );
    if (!exs.length) return null;

    return exs.map(r => {
      const stored = r.movement_pattern as string | null;
      return {
        exerciseId: String(r.exercise_id),
        name: String(r.name || r.exercise_id),
        movementPattern: (stored === 'lower' || stored === 'upper') ? stored : patternFor(r.body_part as string | null),
        targetSets: Number(r.target_sets) || 3,
        targetReps: Number(r.target_reps) || 12,
        startWeight: Number(r.start_weight) || 0,
      };
    });
  } catch {
    return null; // tablas aún no creadas o sin rutinas publicadas → fallback al template
  }
}

/**
 * Construye el StartSessionInput de hoy: template + peso sugerido por el motor.
 * El peso preferido es el `nextWeight` del último snapshot (continuidad real).
 */
export async function buildTodayPlan(
  userId: string,
  sessionTitle: string,
  routineId?: string
): Promise<StartSessionInput> {
  // Prioridad: rutina configurada desde el admin (librería). Si no hay, template base.
  const template = (await loadRoutineTemplate(sessionTitle, routineId)) ?? pickTemplate(sessionTitle);

  const exercises: StartExerciseInput[] = [];
  for (let i = 0; i < template.length; i++) {
    const t = template[i];
    const snap = await repo.getProgression(userId, t.exerciseId);
    // nextWeight es la recomendación del motor para la próxima sesión.
    const suggestedWeight = snap && snap.nextWeight > 0 ? snap.nextWeight : t.startWeight;
    exercises.push({
      exerciseId: t.exerciseId,
      name: t.name,
      order: i,
      targetSets: t.targetSets,
      targetReps: t.targetReps,
      suggestedWeight,
      movementPattern: t.movementPattern,
    });
  }

  return { routineId, goal: 'hypertrophy', exercises };
}
