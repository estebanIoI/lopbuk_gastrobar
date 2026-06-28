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

// ── Catch-up idempotente ──────────────────────────────────────────────────────
// Rellena gaps de esquema en BD existentes que fueron auto-marcadas con el baseline
// (que NO se re-ejecuta) y por eso no tienen tablas/columnas que viven dentro del
// baseline — caso típico: la feature `hormas`. Es idempotente (IF NOT EXISTS +
// chequeo de information_schema), así que es un no-op en BD ya completas o frescas.
// Sin DELIMITER/stored-proc para que mysql2 lo ejecute statement por statement.
async function addColumnIfMissing(table: string, col: string, definition: string): Promise<void> {
  const [t]: any = await pool.query(
    'SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?',
    [table]
  )
  if (Number(t[0].n) === 0) return // la tabla no existe → no aplica
  const [c]: any = await pool.query(
    'SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?',
    [table, col]
  )
  if (Number(c[0].n) > 0) return // ya existe
  await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${col}\` ${definition}`)
  console.log(`Catch-up: ${table}.${col} agregada.`)
}

async function runCatchup(): Promise<void> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS hormas (
      id VARCHAR(36) NOT NULL PRIMARY KEY, tenant_id VARCHAR(36) NOT NULL,
      name VARCHAR(150) NOT NULL, slug VARCHAR(150) NOT NULL,
      base_cost DECIMAL(12,2) NOT NULL DEFAULT 0, base_price DECIMAL(12,2) NOT NULL DEFAULT 0,
      size_chart JSON, has_sleeves TINYINT(1) NOT NULL DEFAULT 1,
      sexo ENUM('unisex','hombre','mujer') NOT NULL DEFAULT 'unisex',
      composition VARCHAR(150) NULL, weight_grams INT NULL, shelf JSON NULL,
      sort_order INT NOT NULL DEFAULT 0, is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_horma_slug_tenant (tenant_id, slug),
      INDEX idx_hormas_tenant (tenant_id, is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  )
  await pool.query(
    `CREATE TABLE IF NOT EXISTS horma_colors (
      id VARCHAR(36) NOT NULL PRIMARY KEY, tenant_id VARCHAR(36) NOT NULL,
      horma_id VARCHAR(36) NOT NULL, color VARCHAR(100) NOT NULL, hex VARCHAR(9),
      shelf JSON NULL, sort_order INT NOT NULL DEFAULT 0, is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_horma_color (horma_id, color),
      INDEX idx_hc_tenant (tenant_id), INDEX idx_hc_horma (horma_id, tenant_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  )
  await addColumnIfMissing('products', 'horma_id', 'VARCHAR(36) NULL')
  await addColumnIfMissing('product_variants', 'horma_id', 'VARCHAR(36) NULL')
  await addColumnIfMissing('products', 'base_price', 'DECIMAL(12,2) NULL')
  await addColumnIfMissing('sales', 'dispatch_notes', 'TEXT NULL')
  await addColumnIfMissing('sales', 'dispatched_at', 'TIMESTAMP NULL')
  await addColumnIfMissing('storefront_orders', 'assigned_to', 'VARCHAR(36) NULL')
}

// Aplica las migraciones pendientes (registradas en __drizzle_migrations).
export async function runMigrations(): Promise<void> {
  await ensureBaselineForExistingDb()
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR })
  await runCatchup()
}

// Ejecutable directo: `node dist/db/migrate.js` (prod/CI) o vía ts en dev.
if (require.main === module) {
  runMigrations()
    .then(() => { console.log('Drizzle: migraciones aplicadas.') })
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((e) => { console.error('Drizzle migrate error:', e); process.exit(1) })
}
