import { randomUUID } from 'crypto'
import pool from '../../config/database'
import type { RowDataPacket } from 'mysql2'

/**
 * Rutinas versionadas (P2).
 *   routines          → identidad estable
 *   routine_versions  → contenido por versión. draft = editable · published = INMUTABLE
 *   routine_exercises → ejercicios de esa versión (soporta superseries vía group_id)
 *
 * Regla: solo se editan versiones en `draft`. Publicar congela y archiva la anterior.
 * Así cambiar una rutina no rompe a quien ya está entrenando con la versión previa.
 */

const DEFAULT_LANG = 'es'
export const EXECUTION_TYPES = ['NORMAL', 'SUPERSET', 'CIRCUIT', 'DROPSET', 'EMOM', 'AMRAP'] as const

export interface RoutineExerciseInput {
  exerciseId: string
  displayName?: string | null
  groupId?: string | null
  executionType?: string
  targetSets?: number
  targetReps?: number
  startWeight?: number
  rpe?: number | null
  rir?: number | null
  tempo?: string | null
  restSeconds?: number | null
}

/** Ejercicios de una o varias versiones, resueltos contra la librería. */
async function exercisesOfVersions(versionIds: string[], lang = DEFAULT_LANG) {
  if (!versionIds.length) return [] as RowDataPacket[]
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT rex.id, rex.routine_version_id, rex.exercise_id, rex.exercise_order,
            rex.group_id, rex.execution_type, rex.target_sets, rex.target_reps,
            rex.start_weight, rex.rpe, rex.rir, rex.tempo, rex.rest_seconds,
            COALESCE(rex.display_name, t.name, ten.name) AS name,
            e.body_part, e.equipment, e.movement_pattern,
            mi.url AS image_url, mg.url AS gif_url
     FROM routine_exercises rex
     LEFT JOIN exercises e ON e.id = rex.exercise_id
     LEFT JOIN exercise_translations t   ON t.exercise_id = e.id AND t.language = ?
     LEFT JOIN exercise_translations ten ON ten.exercise_id = e.id AND ten.language = 'en'
     LEFT JOIN exercise_media mi ON mi.exercise_id = e.id AND mi.kind = 'image'
     LEFT JOIN exercise_media mg ON mg.exercise_id = e.id AND mg.kind = 'gif'
     WHERE rex.routine_version_id IN (?)
     ORDER BY rex.exercise_order ASC`,
    [lang, versionIds],
  )
  return rows
}

async function versionsOf(routineIds: string[]) {
  if (!routineIds.length) return [] as RowDataPacket[]
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT v.id, v.routine_id, v.version, v.status, v.movement_pattern, v.published_at,
            (SELECT COUNT(*) FROM routine_exercises x WHERE x.routine_version_id = v.id) AS exercise_count
     FROM routine_versions v WHERE v.routine_id IN (?) ORDER BY v.version DESC`,
    [routineIds],
  )
  return rows
}

export async function listRoutines() {
  const [routines] = await pool.query<RowDataPacket[]>(
    'SELECT id, name, description, goal, is_active, sort_order FROM routines ORDER BY sort_order ASC, name ASC',
  )
  if (!routines.length) return []
  const versions = await versionsOf(routines.map(r => String(r.id)))
  return routines.map(r => ({ ...r, versions: versions.filter(v => v.routine_id === r.id) }))
}

export async function getRoutine(id: string, lang = DEFAULT_LANG) {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, name, description, goal, is_active, sort_order FROM routines WHERE id = ? LIMIT 1', [id],
  )
  if (!rows.length) return null
  const versions = await versionsOf([id])
  const exs = await exercisesOfVersions(versions.map(v => String(v.id)), lang)
  return {
    ...rows[0],
    versions: versions.map(v => ({ ...v, exercises: exs.filter(x => x.routine_version_id === v.id) })),
  }
}

/** Crea la rutina + su versión 1 en draft. */
export async function createRoutine(data: { name: string; description?: string; goal?: string; movementPattern?: string | null }) {
  const id = randomUUID()
  await pool.query(
    'INSERT INTO routines (id, name, description, goal) VALUES (?, ?, ?, ?)',
    [id, data.name, data.description ?? null, data.goal || 'hypertrophy'],
  )
  await pool.query(
    'INSERT INTO routine_versions (id, routine_id, version, status, movement_pattern) VALUES (?, ?, 1, ?, ?)',
    [randomUUID(), id, 'draft', data.movementPattern ?? null],
  )
  return getRoutine(id)
}

export async function updateRoutine(id: string, patch: { name?: string; description?: string; goal?: string; isActive?: boolean; sortOrder?: number }) {
  const f: string[] = []; const v: any[] = []
  if (patch.name !== undefined) { f.push('name = ?'); v.push(patch.name) }
  if (patch.description !== undefined) { f.push('description = ?'); v.push(patch.description) }
  if (patch.goal !== undefined) { f.push('goal = ?'); v.push(patch.goal) }
  if (patch.isActive !== undefined) { f.push('is_active = ?'); v.push(patch.isActive ? 1 : 0) }
  if (patch.sortOrder !== undefined) { f.push('sort_order = ?'); v.push(patch.sortOrder) }
  if (f.length) { v.push(id); await pool.query(`UPDATE routines SET ${f.join(', ')} WHERE id = ?`, v) }
  return getRoutine(id)
}

export async function deleteRoutine(id: string) {
  const [vs] = await pool.query<RowDataPacket[]>('SELECT id FROM routine_versions WHERE routine_id = ?', [id])
  if (vs.length) {
    await pool.query('DELETE FROM routine_exercises WHERE routine_version_id IN (?)', [vs.map(v => v.id)])
  }
  await pool.query('DELETE FROM routine_versions WHERE routine_id = ?', [id])
  await pool.query('DELETE FROM routines WHERE id = ?', [id])
  return { deleted: true }
}

async function versionRow(versionId: string) {
  const [r] = await pool.query<RowDataPacket[]>('SELECT * FROM routine_versions WHERE id = ? LIMIT 1', [versionId])
  return r[0] || null
}

/** Reemplaza los ejercicios de una versión. Solo permitido en draft. */
export async function setVersionExercises(versionId: string, list: RoutineExerciseInput[]) {
  const v = await versionRow(versionId)
  if (!v) return { error: 'Versión no encontrada' as const }
  if (v.status !== 'draft') return { error: 'Solo se edita un borrador. Crea una versión nueva.' as const }

  await pool.query('DELETE FROM routine_exercises WHERE routine_version_id = ?', [versionId])
  if (list.length) {
    const vals: any[] = []
    const ph = list.map((x, i) => {
      const type = EXECUTION_TYPES.includes(String(x.executionType) as any) ? x.executionType : 'NORMAL'
      vals.push(
        randomUUID(), versionId, x.exerciseId, x.displayName ?? null, i,
        x.groupId ?? null, type,
        Number(x.targetSets) || 3, Number(x.targetReps) || 12, Number(x.startWeight) || 0,
        x.rpe ?? null, x.rir ?? null, x.tempo ?? null, x.restSeconds ?? null,
      )
      return '(?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
    }).join(',')
    await pool.query(
      `INSERT INTO routine_exercises
         (id, routine_version_id, exercise_id, display_name, exercise_order, group_id, execution_type,
          target_sets, target_reps, start_weight, rpe, rir, tempo, rest_seconds)
       VALUES ${ph}`,
      vals,
    )
  }
  return getRoutine(String(v.routine_id))
}

/** Publica el draft: lo congela y archiva la versión publicada anterior. */
export async function publishVersion(versionId: string) {
  const v = await versionRow(versionId)
  if (!v) return { error: 'Versión no encontrada' as const }
  if (v.status !== 'draft') return { error: 'Esa versión ya no es un borrador' as const }
  await pool.query(
    "UPDATE routine_versions SET status = 'archived' WHERE routine_id = ? AND status = 'published'",
    [v.routine_id],
  )
  await pool.query(
    "UPDATE routine_versions SET status = 'published', published_at = NOW() WHERE id = ?",
    [versionId],
  )
  return getRoutine(String(v.routine_id))
}

/** Crea un draft nuevo clonando la última versión (para editar sin tocar la publicada). */
export async function newDraft(routineId: string) {
  const [ex] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM routine_versions WHERE routine_id = ? AND status = 'draft' LIMIT 1", [routineId],
  )
  if (ex.length) return getRoutine(routineId) // ya hay un borrador abierto

  const [last] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM routine_versions WHERE routine_id = ? ORDER BY version DESC LIMIT 1', [routineId],
  )
  const nextVersion = last.length ? Number(last[0].version) + 1 : 1
  const id = randomUUID()
  await pool.query(
    'INSERT INTO routine_versions (id, routine_id, version, status, movement_pattern) VALUES (?, ?, ?, ?, ?)',
    [id, routineId, nextVersion, 'draft', last[0]?.movement_pattern ?? null],
  )
  if (last.length) {
    const [prev] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM routine_exercises WHERE routine_version_id = ? ORDER BY exercise_order', [last[0].id],
    )
    if (prev.length) {
      const vals: any[] = []
      const ph = prev.map((p: any) => {
        vals.push(randomUUID(), id, p.exercise_id, p.display_name, p.exercise_order, p.group_id,
          p.execution_type, p.target_sets, p.target_reps, p.start_weight, p.rpe, p.rir, p.tempo, p.rest_seconds)
        return '(?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
      }).join(',')
      await pool.query(
        `INSERT INTO routine_exercises
           (id, routine_version_id, exercise_id, display_name, exercise_order, group_id, execution_type,
            target_sets, target_reps, start_weight, rpe, rir, tempo, rest_seconds)
         VALUES ${ph}`, vals,
      )
    }
  }
  return getRoutine(routineId)
}
