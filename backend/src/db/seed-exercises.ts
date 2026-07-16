/**
 * Seed de la librería de ejercicios NORMALIZADA (P1).
 * Fuente: docs/exercises-dataset-main/data/exercises.json (1324 ejercicios).
 *
 * Puebla 4 tablas:
 *   exercises              → núcleo (sin texto ni urls)
 *   exercise_translations  → 1 fila por idioma (dataset trae 9)
 *   exercise_media         → 1 fila por asset (image/gif, 180×180, con atribución)
 *   exercise_tags          → derivados de body_part / equipment / target
 *
 * Idempotente: ON DUPLICATE KEY UPDATE + limpieza previa de hijos por ejercicio.
 * Uso: `npx ts-node src/db/seed-exercises.ts`
 *
 * Nota honesta: el dataset trae `name` SOLO en inglés. Las traducciones de nombre
 * (es/pt) quedan en NULL y se resuelven con fallback a 'en' hasta generarlas con IA.
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { randomUUID } from 'crypto'
import pool from '../config/database'

interface RawExercise {
  id: string
  name: string
  body_part?: string
  equipment?: string
  target?: string
  muscle_group?: string
  secondary_muscles?: string[]
  instructions?: Record<string, string>
  instruction_steps?: Record<string, string[]>
  attribution?: string
}

const DATA_PATH = resolve(__dirname, '../../../docs/exercises-dataset-main/data/exercises.json')
const LOWER_PARTS = new Set(['upper legs', 'lower legs'])
const ATTRIBUTION = '© Gym visual — https://gymvisual.com/'

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 180)

async function chunked(rows: any[][], sql: string, perRow: number, chunk = 300) {
  for (let i = 0; i < rows.length; i += chunk) {
    const batch = rows.slice(i, i + chunk)
    const ph = batch.map(() => `(${Array(perRow).fill('?').join(',')})`).join(',')
    await pool.query(sql.replace('__VALUES__', ph), batch.flat())
  }
}

async function seed(): Promise<void> {
  const raw = JSON.parse(readFileSync(DATA_PATH, 'utf8')) as RawExercise[]
  console.log(`Leídos ${raw.length} ejercicios`)

  const ids = raw.map(e => e.id)
  // Limpieza de hijos (el núcleo se hace upsert)
  for (let i = 0; i < ids.length; i += 500) {
    const c = ids.slice(i, i + 500)
    await pool.query('DELETE FROM exercise_translations WHERE exercise_id IN (?)', [c])
    await pool.query('DELETE FROM exercise_media WHERE exercise_id IN (?)', [c])
    await pool.query('DELETE FROM exercise_tags WHERE exercise_id IN (?)', [c])
  }

  const core: any[][] = []
  const trans: any[][] = []
  const media: any[][] = []
  const tags: any[][] = []

  for (const e of raw) {
    core.push([
      e.id, e.id, slugify(e.name), 'dataset',
      e.body_part ?? null, e.equipment ?? null, e.target ?? null, e.muscle_group ?? null,
      JSON.stringify(e.secondary_muscles ?? []),
      LOWER_PARTS.has(String(e.body_part).toLowerCase()) ? 'lower' : 'upper',
    ])

    const langs = new Set([...Object.keys(e.instructions ?? {}), ...Object.keys(e.instruction_steps ?? {})])
    for (const lang of langs) {
      trans.push([
        randomUUID(), e.id, lang,
        lang === 'en' ? e.name : null, // el dataset solo trae nombre en inglés
        e.instructions?.[lang] ?? null,
        JSON.stringify(e.instruction_steps?.[lang] ?? []),
      ])
    }

    const attr = e.attribution || ATTRIBUTION
    media.push([randomUUID(), e.id, 'image', `/exercises/${e.id}.jpg`, 180, 180, attr, 0])
    media.push([randomUUID(), e.id, 'gif', `/exercises/${e.id}.gif`, 180, 180, attr, 1])

    for (const t of new Set([e.body_part, e.equipment, e.target].filter(Boolean) as string[])) {
      tags.push([e.id, t])
    }
  }

  await chunked(core,
    `INSERT INTO exercises (id, dataset_id, slug, source, body_part, equipment, target, muscle_group, secondary_muscles, movement_pattern)
     VALUES __VALUES__
     ON DUPLICATE KEY UPDATE slug=VALUES(slug), body_part=VALUES(body_part), equipment=VALUES(equipment),
       target=VALUES(target), muscle_group=VALUES(muscle_group), secondary_muscles=VALUES(secondary_muscles),
       movement_pattern=VALUES(movement_pattern)`, 10)
  console.log(`  exercises: ${core.length}`)

  await chunked(trans,
    `INSERT INTO exercise_translations (id, exercise_id, language, name, instructions, steps) VALUES __VALUES__`, 6)
  console.log(`  exercise_translations: ${trans.length}`)

  await chunked(media,
    `INSERT INTO exercise_media (id, exercise_id, kind, url, width, height, attribution, sort_order) VALUES __VALUES__`, 8)
  console.log(`  exercise_media: ${media.length}`)

  await chunked(tags, `INSERT IGNORE INTO exercise_tags (exercise_id, tag) VALUES __VALUES__`, 2)
  console.log(`  exercise_tags: ${tags.length}`)

  console.log('Seed normalizado listo.')
}

seed()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((e) => { console.error('\nSeed error:', e); process.exit(1) })
