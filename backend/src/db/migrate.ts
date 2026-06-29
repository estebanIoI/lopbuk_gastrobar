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

// Reconcilia un rename de columna a través de BD en estados distintos:
//   - newCol ya existe          → no-op (dev ya renombrado por el DDL viejo de runtime)
//   - solo existe oldCol        → RENAME oldCol → newCol (prod con el nombre legacy)
//   - no existe ninguna         → ADD newCol con `addDefinition` (BD incompleta)
// Por esta divergencia de estados un .sql de migración estático NO sirve (RENAME
// fallaría donde la columna ya está renombrada); por eso vive en el catch-up
// idempotente, igual que hormas/assigned_to. RENAME COLUMN requiere MySQL 8.0+.
async function renameColumnIfNeeded(table: string, oldCol: string, newCol: string, addDefinition: string): Promise<void> {
  const [t]: any = await pool.query(
    'SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?',
    [table]
  )
  if (Number(t[0].n) === 0) return // la tabla no existe → no aplica
  const colExists = async (col: string): Promise<boolean> => {
    const [c]: any = await pool.query(
      'SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?',
      [table, col]
    )
    return Number(c[0].n) > 0
  }
  if (await colExists(newCol)) return // ya renombrado / ya existe
  if (await colExists(oldCol)) {
    await pool.query(`ALTER TABLE \`${table}\` RENAME COLUMN \`${oldCol}\` TO \`${newCol}\``)
    console.log(`Catch-up: ${table}.${oldCol} → ${newCol} renombrada.`)
    return
  }
  await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${newCol}\` ${addDefinition}`)
  console.log(`Catch-up: ${table}.${newCol} agregada (no existía la legacy).`)
}

// Asegura que `table` use la collation `collation` (CONVERT si difiere). Evita el
// "Illegal mix of collations" cuando hormas se creó con otro charset que el resto.
async function ensureTableCollation(table: string, charset: string, collation: string): Promise<void> {
  const [r]: any = await pool.query(
    'SELECT TABLE_COLLATION AS c FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1',
    [table]
  )
  if (r[0] && r[0].c && r[0].c !== collation) {
    await pool.query(`ALTER TABLE \`${table}\` CONVERT TO CHARACTER SET ${charset} COLLATE ${collation}`)
    console.log(`Catch-up: ${table} convertida a ${collation}.`)
  }
}

async function runCatchup(): Promise<void> {
  // Detectar la collation de una tabla de negocio existente para que hormas haga
  // JOIN sin "Illegal mix of collations". Sirve igual en prod (unicode_ci) y dev (0900).
  const [collRows]: any = await pool.query(
    `SELECT TABLE_COLLATION AS c FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('product_variants','products','users')
     ORDER BY FIELD(TABLE_NAME,'product_variants','products','users') LIMIT 1`
  )
  let collation = collRows[0]?.c || 'utf8mb4_unicode_ci'
  if (!/^utf8mb4_[a-z0-9_]+$/i.test(collation)) collation = 'utf8mb4_unicode_ci' // sanitizar
  const charset = collation.split('_')[0]

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
    ) ENGINE=InnoDB DEFAULT CHARSET=${charset} COLLATE=${collation}`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=${charset} COLLATE=${collation}`
  )
  // Si hormas/horma_colors ya existían con otra collation (deploy previo), corregir.
  await ensureTableCollation('hormas', charset, collation)
  await ensureTableCollation('horma_colors', charset, collation)

  await addColumnIfMissing('products', 'horma_id', 'VARCHAR(36) NULL')
  await addColumnIfMissing('product_variants', 'horma_id', 'VARCHAR(36) NULL')
  await addColumnIfMissing('products', 'base_price', 'DECIMAL(12,2) NULL')
  await addColumnIfMissing('sales', 'dispatch_notes', 'TEXT NULL')
  await addColumnIfMissing('sales', 'dispatched_at', 'TIMESTAMP NULL')
  await addColumnIfMissing('storefront_orders', 'assigned_to', 'VARCHAR(36) NULL')

  // ── Reconciliación preorden → precompra ───────────────────────────────────
  // El baseline 0000 conserva los nombres legacy (is_preorder, preorder_*) porque
  // se introspectó de una BD previa al rename. El rename vivía como DDL de runtime
  // en variants.service.ts (ahora CONGELADO en FASE 2), así que prod nunca lo aplicó
  // y el código (storefront/orders) consulta los nombres nuevos (is_presale, presale_*)
  // → "Unknown column 'p.is_presale'". Aquí lo reconciliamos de forma idempotente.
  // products
  await renameColumnIfNeeded('products', 'is_preorder', 'is_presale', "TINYINT(1) NOT NULL DEFAULT 0")
  await renameColumnIfNeeded('products', 'preorder_window_end', 'presale_window_end', 'DATETIME NULL')
  await renameColumnIfNeeded('products', 'preorder_ship_start', 'presale_ship_start', 'DATE NULL')
  await renameColumnIfNeeded('products', 'preorder_ship_end', 'presale_ship_end', 'DATE NULL')
  await renameColumnIfNeeded('products', 'preorder_badge_text', 'presale_badge_text', "VARCHAR(60) NOT NULL DEFAULT 'Pre-orden'")
  await renameColumnIfNeeded('products', 'preorder_policy_text', 'presale_policy_text', 'TEXT NULL')
  await addColumnIfMissing('products', 'presale_deposit_pct', 'DECIMAL(5,2) NOT NULL DEFAULT 50.00')
  // product_variants
  await renameColumnIfNeeded('product_variants', 'preorder_limit', 'presale_limit', 'INT NULL')
  await renameColumnIfNeeded('product_variants', 'preorder_count', 'presale_sold', 'INT NOT NULL DEFAULT 0')
  await addColumnIfMissing('product_variants', 'presale', 'TINYINT(1) NOT NULL DEFAULT 0')
  await addColumnIfMissing('product_variants', 'presale_date', 'DATE NULL')
  await addColumnIfMissing('product_variants', 'presale_deposit_pct', 'DECIMAL(5,2) NOT NULL DEFAULT 50.00')
  // storefront_order_items
  await renameColumnIfNeeded('storefront_order_items', 'is_preorder', 'is_presale', "TINYINT(1) NOT NULL DEFAULT 0")
  await renameColumnIfNeeded('storefront_order_items', 'preorder_ship_start', 'presale_ship_start', 'DATE NULL')
  await renameColumnIfNeeded('storefront_order_items', 'preorder_ship_end', 'presale_ship_end', 'DATE NULL')
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
