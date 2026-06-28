import { migrate } from 'drizzle-orm/mysql2/migrator'
import { createHash } from 'crypto'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { db } from './index'
import pool from '../config/database'

// Carpeta de migraciones, robusta para dev y prod:
//   dev  → backend/src/db/migrations  (junto a este .ts)
//   prod → dist/db/migrations         (la imagen copia los .sql aquí)
const MIGRATIONS_DIR = resolve(__dirname, 'migrations')

// Si la BD YA tiene el esquema viejo (pre-Drizzle) pero todavía no hay registro
// de migraciones, marca el baseline 0000 como aplicado SIN recrear nada (para que
// `migrate()` no intente correrlo contra tablas que ya existen). En una BD vacía
// no hace nada y `migrate()` aplica el baseline normalmente.
async function ensureBaselineForExistingDb(): Promise<void> {
  const [mt]: any = await pool.query(
    "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = '__drizzle_migrations'"
  )
  if (Number(mt[0].n) > 0) {
    const [c]: any = await pool.query('SELECT COUNT(*) AS n FROM `__drizzle_migrations`')
    if (Number(c[0].n) > 0) return // ya inicializado: nada que hacer
  }

  // ¿Hay esquema existente? Tabla sentinela de negocio.
  const [core]: any = await pool.query(
    "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'users'"
  )
  if (Number(core[0].n) === 0) return // BD vacía → que migrate() corra el baseline

  // BD existente sin registro → registrar el baseline 0000 como aplicado.
  const journal = JSON.parse(readFileSync(resolve(MIGRATIONS_DIR, 'meta', '_journal.json'), 'utf8'))
  const baseline = journal.entries?.[0]
  if (!baseline) return
  const sqlContent = readFileSync(resolve(MIGRATIONS_DIR, `${baseline.tag}.sql`), 'utf8')
  const hash = createHash('sha256').update(sqlContent).digest('hex')
  await pool.query(
    'CREATE TABLE IF NOT EXISTS `__drizzle_migrations` (`id` bigint unsigned NOT NULL AUTO_INCREMENT, `hash` text NOT NULL, `created_at` bigint DEFAULT NULL, PRIMARY KEY (`id`))'
  )
  await pool.query('INSERT INTO `__drizzle_migrations` (`hash`, `created_at`) VALUES (?, ?)', [hash, baseline.when])
  console.log(`Drizzle: BD existente detectada → baseline "${baseline.tag}" marcado como aplicado (no se recreó nada).`)
}

// Aplica las migraciones pendientes (registradas en __drizzle_migrations).
export async function runMigrations(): Promise<void> {
  await ensureBaselineForExistingDb()
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR })
}

// Ejecutable directo: `node dist/db/migrate.js` (prod/CI) o vía ts en dev.
if (require.main === module) {
  runMigrations()
    .then(() => { console.log('Drizzle: migraciones aplicadas.') })
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((e) => { console.error('Drizzle migrate error:', e); process.exit(1) })
}
