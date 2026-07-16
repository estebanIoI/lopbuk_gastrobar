import { randomUUID } from 'crypto'
import pool from '../../config/database'
import type { RowDataPacket } from 'mysql2'

/**
 * Librería normalizada: núcleo + traducciones + media + tags.
 * El `name` se resuelve por idioma con fallback a 'en' (el dataset solo trae
 * nombre en inglés hasta que se generen las traducciones).
 */

export const DEFAULT_LANG = 'es'

export interface ListParams {
  search?: string
  bodyPart?: string
  equipment?: string
  tag?: string
  lang?: string
  activeOnly?: boolean
  limit?: number
  offset?: number
}

/** SELECT + JOINs comunes: nombre por idioma (fallback en) + media. */
const BASE_SELECT = `
  SELECT e.id, e.dataset_id, e.slug, e.body_part, e.equipment, e.target,
         e.muscle_group, e.movement_pattern, e.difficulty, e.is_active,
         COALESCE(t.name, ten.name) AS name,
         mi.url AS image_url, mg.url AS gif_url
  FROM exercises e
  LEFT JOIN exercise_translations t   ON t.exercise_id = e.id AND t.language = ?
  LEFT JOIN exercise_translations ten ON ten.exercise_id = e.id AND ten.language = 'en'
  LEFT JOIN exercise_media mi ON mi.exercise_id = e.id AND mi.kind = 'image'
  LEFT JOIN exercise_media mg ON mg.exercise_id = e.id AND mg.kind = 'gif'
`

export async function listExercises(params: ListParams) {
  const lang = params.lang || DEFAULT_LANG
  const where: string[] = []
  const vals: any[] = [lang]

  if (params.activeOnly) where.push('e.is_active = 1')
  if (params.search) {
    where.push('(COALESCE(t.name, ten.name) LIKE ? OR e.target LIKE ? OR e.muscle_group LIKE ?)')
    const s = `%${params.search}%`
    vals.push(s, s, s)
  }
  if (params.bodyPart) { where.push('e.body_part = ?'); vals.push(params.bodyPart) }
  if (params.equipment) { where.push('e.equipment = ?'); vals.push(params.equipment) }
  if (params.tag) { where.push('EXISTS (SELECT 1 FROM exercise_tags xt WHERE xt.exercise_id = e.id AND xt.tag = ?)'); vals.push(params.tag) }

  const w = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const limit = Math.min(200, Math.max(1, Number(params.limit) || 60))
  const offset = Math.max(0, Number(params.offset) || 0)

  const [rows] = await pool.query<RowDataPacket[]>(
    `${BASE_SELECT} ${w} ORDER BY name ASC LIMIT ? OFFSET ?`,
    [...vals, limit, offset],
  )
  const [cnt] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM exercises e
     LEFT JOIN exercise_translations t   ON t.exercise_id = e.id AND t.language = ?
     LEFT JOIN exercise_translations ten ON ten.exercise_id = e.id AND ten.language = 'en'
     ${w}`,
    vals,
  )
  return { data: rows, total: Number(cnt[0]?.n || 0), limit, offset }
}

/** Detalle completo: núcleo + TODAS las traducciones + media + tags. */
export async function getExercise(id: string, lang = DEFAULT_LANG) {
  const [rows] = await pool.query<RowDataPacket[]>(`${BASE_SELECT} WHERE e.id = ? LIMIT 1`, [lang, id])
  if (!rows.length) return null
  const [translations] = await pool.query<RowDataPacket[]>(
    'SELECT language, name, instructions, steps, tips, mistakes FROM exercise_translations WHERE exercise_id = ? ORDER BY language',
    [id],
  )
  const [media] = await pool.query<RowDataPacket[]>(
    'SELECT kind, url, width, height, attribution FROM exercise_media WHERE exercise_id = ? ORDER BY sort_order',
    [id],
  )
  const [tags] = await pool.query<RowDataPacket[]>('SELECT tag FROM exercise_tags WHERE exercise_id = ?', [id])
  return { ...rows[0], translations, media, tags: tags.map(t => t.tag) }
}

export async function getFilters() {
  const [bodyParts] = await pool.query<RowDataPacket[]>(
    'SELECT body_part AS value, COUNT(*) AS count FROM exercises WHERE body_part IS NOT NULL GROUP BY body_part ORDER BY body_part',
  )
  const [equipment] = await pool.query<RowDataPacket[]>(
    'SELECT equipment AS value, COUNT(*) AS count FROM exercises WHERE equipment IS NOT NULL GROUP BY equipment ORDER BY equipment',
  )
  const [languages] = await pool.query<RowDataPacket[]>(
    'SELECT language AS value, COUNT(*) AS count FROM exercise_translations GROUP BY language ORDER BY language',
  )
  return { bodyParts, equipment, languages }
}

/**
 * Admin: activa/oculta (núcleo) y edita textos (traducción del idioma dado).
 * El nombre traducido se inserta/actualiza en exercise_translations.
 */
export async function updateExercise(
  id: string,
  patch: { isActive?: boolean; difficulty?: string; name?: string; instructions?: string; tips?: string; mistakes?: string },
  lang = DEFAULT_LANG,
) {
  const core: string[] = []
  const coreVals: any[] = []
  if (patch.isActive !== undefined) { core.push('is_active = ?'); coreVals.push(patch.isActive ? 1 : 0) }
  if (patch.difficulty !== undefined) { core.push('difficulty = ?'); coreVals.push(patch.difficulty) }
  if (core.length) {
    coreVals.push(id)
    await pool.query(`UPDATE exercises SET ${core.join(', ')} WHERE id = ?`, coreVals)
  }

  const hasText = patch.name !== undefined || patch.instructions !== undefined
    || patch.tips !== undefined || patch.mistakes !== undefined
  if (hasText) {
    await pool.query(
      `INSERT INTO exercise_translations (id, exercise_id, language, name, instructions, tips, mistakes)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = COALESCE(VALUES(name), name),
         instructions = COALESCE(VALUES(instructions), instructions),
         tips = COALESCE(VALUES(tips), tips),
         mistakes = COALESCE(VALUES(mistakes), mistakes)`,
      [randomUUID(), id, lang, patch.name ?? null, patch.instructions ?? null, patch.tips ?? null, patch.mistakes ?? null],
    )
  }
  return getExercise(id, lang)
}
