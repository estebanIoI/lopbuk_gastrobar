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

/**
 * Construye el StartSessionInput de hoy: template + peso sugerido por el motor.
 * El peso preferido es el `nextWeight` del último snapshot (continuidad real).
 */
export async function buildTodayPlan(
  userId: string,
  sessionTitle: string,
  routineId?: string
): Promise<StartSessionInput> {
  const template = pickTemplate(sessionTitle);

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
