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

// Reconcilia las migraciones de eventos (0044–0047): si sus tablas YA existen pero
// no están registradas en __drizzle_migrations, márcalas como aplicadas (mismo criterio
// que el baseline) para que migrate() no intente recrearlas y aborte. Los gaps reales de
// esas migraciones (trace_id, event_logs, event_waitlists, ticket_version) los rellena
// runCatchup() de forma idempotente. No-op si no hay tablas de eventos (BD fresca → migrate
// las crea normalmente) o si ya están registradas.
async function ensureEventsMigrationsMarked(): Promise<void> {
  const [t]: any = await pool.query(
    "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'event_booking_items'"
  )
  if (Number(t[0].n) === 0) return // sin tablas de eventos → que migrate() las cree

  await pool.query(
    'CREATE TABLE IF NOT EXISTS `__drizzle_migrations` (`id` bigint unsigned NOT NULL AUTO_INCREMENT, `hash` text NOT NULL, `created_at` bigint DEFAULT NULL, PRIMARY KEY (`id`))'
  )
  const journal = JSON.parse(readFileSync(resolve(MIGRATIONS_DIR, 'meta', '_journal.json'), 'utf8'))
  const eventsTags = ['0044_fast_killmonger', '0045_young_wolfsbane', '0046_nosy_paladin', '0047_flowery_shocker']
  for (const tag of eventsTags) {
    const entry = journal.entries?.find((e: any) => e.tag === tag)
    if (!entry) continue
    const [exists]: any = await pool.query(
      'SELECT COUNT(*) AS n FROM `__drizzle_migrations` WHERE `created_at` = ?', [entry.when]
    )
    if (Number(exists[0].n) > 0) continue // ya registrada
    const hash = createHash('sha256')
      .update(readFileSync(resolve(MIGRATIONS_DIR, `${tag}.sql`), 'utf8'))
      .digest('hex')
    await pool.query(
      'INSERT INTO `__drizzle_migrations` (`hash`, `created_at`) VALUES (?, ?)', [hash, entry.when]
    )
    console.log(`Drizzle: migración de eventos "${tag}" marcada como aplicada (tablas ya existen).`)
  }
}

// ── Reconciliador idempotente de migraciones pendientes ──────────────────────
// Problema que resuelve: una migración puede quedar "a medias" — parte de su
// esquema ya existe (creado por catch-up o por otra vía) y parte no. Drizzle es
// todo-o-nada: al re-ejecutarla falla con "Duplicate column/Table already exists"
// y ABORTA, dejando fuera todas las migraciones siguientes. Eso mantuvo 0050–0052
// sin aplicar y al módulo de gimnasio sin sus 20 tablas.
//
// Estrategia: aplicar de cada migración pendiente SOLO lo que falta de verdad
// (tabla por tabla, columna por columna, constraint por constraint) y recién
// entonces marcarla como aplicada. Nunca borra ni modifica nada existente.
//
// Es genérico: sirve para cualquier migración futura que caiga en el mismo caso.

const tableExists = async (t: string): Promise<boolean> => {
  const [r]: any = await pool.query(
    'SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?', [t]
  )
  return Number(r[0].n) > 0
}
const columnExists = async (t: string, c: string): Promise<boolean> => {
  const [r]: any = await pool.query(
    'SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?', [t, c]
  )
  return Number(r[0].n) > 0
}
const constraintExists = async (t: string, c: string): Promise<boolean> => {
  const [r]: any = await pool.query(
    'SELECT COUNT(*) AS n FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = ? AND constraint_name = ?', [t, c]
  )
  return Number(r[0].n) > 0
}

/** ¿Este statement ya está aplicado? (para saltarlo sin ejecutarlo) */
async function alreadyApplied(stmt: string): Promise<boolean> {
  const create = stmt.match(/CREATE TABLE `([a-z_0-9]+)`/i)
  if (create) return tableExists(create[1])

  const addCol = stmt.match(/ALTER TABLE `([a-z_0-9]+)` ADD `([a-z_0-9]+)`/i)
  if (addCol) {
    if (!(await tableExists(addCol[1]))) return true // la tabla no existe → la crea su propio CREATE
    return columnExists(addCol[1], addCol[2])
  }

  const addConstraint = stmt.match(/ALTER TABLE `([a-z_0-9]+)` ADD CONSTRAINT `([a-z_0-9]+)`/i)
  if (addConstraint) {
    if (!(await tableExists(addConstraint[1]))) return true
    return constraintExists(addConstraint[1], addConstraint[2])
  }

  const createIdx = stmt.match(/CREATE (?:UNIQUE )?INDEX `([a-z_0-9]+)` ON `([a-z_0-9]+)`/i)
  if (createIdx) {
    if (!(await tableExists(createIdx[2]))) return true
    const [r]: any = await pool.query(
      'SELECT COUNT(*) AS n FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?',
      [createIdx[2], createIdx[1]]
    )
    return Number(r[0].n) > 0
  }
  return false // desconocido → intentar ejecutarlo
}

/**
 * MySQL limita los identificadores a 64 caracteres, pero drizzle-kit genera
 * nombres de FK concatenando tabla+columna+tabla_destino, que a veces se pasan
 * (p. ej. gym_workout_sets_session_exercise_id_gym_workout_session_exercises_id_fk,
 * 72 chars). Esas migraciones NUNCA pudieron aplicarse. Se acortan de forma
 * determinista (prefijo + hash) para que el nombre sea estable entre entornos.
 */
function shortenLongIdentifiers(stmt: string): string {
  return stmt.replace(/`([a-zA-Z_0-9]{65,})`/g, (_m, id: string) => {
    const short = `${id.slice(0, 50)}_${createHash('sha1').update(id).digest('hex').slice(0, 8)}`
    return `\`${short}\``
  })
}

/** Errores que significan "ya estaba" y por tanto son seguros de ignorar. */
const DUP_CODES = new Set([
  'ER_TABLE_EXISTS_ERROR', 'ER_DUP_FIELDNAME', 'ER_DUP_KEYNAME',
  'ER_DUP_KEY', 'ER_FK_DUP_NAME', 'ER_CANT_CREATE_TABLE',
])

async function reconcilePendingMigrations(): Promise<void> {
  const [mt]: any = await pool.query(
    "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = '__drizzle_migrations'"
  )
  if (Number(mt[0].n) === 0) return // BD fresca → migrate() aplica todo normalmente

  const journal = JSON.parse(readFileSync(resolve(MIGRATIONS_DIR, 'meta', '_journal.json'), 'utf8'))
  for (const entry of journal.entries ?? []) {
    const [done]: any = await pool.query(
      'SELECT COUNT(*) AS n FROM `__drizzle_migrations` WHERE `created_at` = ?', [entry.when]
    )
    if (Number(done[0].n) > 0) continue // ya registrada

    let sql: string
    try { sql = readFileSync(resolve(MIGRATIONS_DIR, `${entry.tag}.sql`), 'utf8') }
    catch { continue } // sin archivo → que lo maneje migrate()

    const statements = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean)
    let applied = 0, skipped = 0
    for (const stmt of statements) {
      const clean = shortenLongIdentifiers(stmt.replace(/;\s*$/, '').trim())
      if (!clean) continue
      if (await alreadyApplied(clean)) { skipped++; continue }
      try { await pool.query(clean); applied++ }
      catch (e: any) {
        if (DUP_CODES.has(e?.code)) { skipped++; continue }  // ya existía por otra vía
        throw new Error(`Reconciliando ${entry.tag}: ${e?.sqlMessage || e?.message}`)
      }
    }

    const hash = createHash('sha256').update(sql).digest('hex')
    await pool.query('INSERT INTO `__drizzle_migrations` (`hash`, `created_at`) VALUES (?, ?)', [hash, entry.when])
    console.log(`Drizzle: "${entry.tag}" reconciliada (${applied} statements aplicados, ${skipped} ya existían).`)
  }
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
  try {
    await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${col}\` ${definition}`)
    console.log(`Catch-up: ${table}.${col} agregada.`)
  } catch (e: any) {
    // El chequeo y el ALTER son sentencias separadas: si dos procesos arrancan a
    // la vez (reinicio en caliente, despliegue rolling) ambos pasan el chequeo y
    // uno recibe ER_DUP_FIELDNAME. Antes ese error abortaba TODO el catch-up y
    // las columnas siguientes no se creaban.
    if (e?.code === 'ER_DUP_FIELDNAME') return
    throw e
  }
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

export async function runCatchup(): Promise<void> {
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
  await addColumnIfMissing('cash_sessions', 'shift_type', "ENUM('mañana','tarde','unico') NOT NULL DEFAULT 'unico'")
  await addColumnIfMissing('cash_sessions', 'shift_label', 'VARCHAR(50)')
  // Fase 1 GastroBar: libro de ventas del turno (snapshot por producto al cerrar).
  await addColumnIfMissing('cash_sessions', 'sales_book', 'JSON NULL')
  // Fase 5 GastroBar · Smart Checkout: ítem asignado a tiquetera + producto que
  // vale 1 cupo. Ambas nullable/default 0 → sin tiquetera el cobro no cambia.
  await addColumnIfMissing('rb_order_items', 'meal_pass_id', 'VARCHAR(36) NULL')
  await addColumnIfMissing('products', 'is_meal', 'TINYINT NOT NULL DEFAULT 0')
  // Fase 6 GastroBar · Mesa General: origen del ítem al unir mesas y comanda
  // absorbida. Ambas nullable → sin unir mesas, nada cambia.
  await addColumnIfMissing('rb_order_items', 'origin_table_id', 'VARCHAR(36) NULL')
  await addColumnIfMissing('rb_orders', 'merged_into_order_id', 'VARCHAR(36) NULL')
  // Domicilios F1: modo de entrega del comercio. Default 'ninguno' → las tiendas
  // existentes siguen comportándose exactamente igual que hoy.
  await addColumnIfMissing('store_info', 'delivery_mode', "ENUM('ninguno','propio','plataforma') NOT NULL DEFAULT 'ninguno'")
  await addColumnIfMissing('store_info', 'platform_delivery_fee', 'INT NOT NULL DEFAULT 0')
  await addColumnIfMissing('store_info', 'delivery_auto_broadcast', 'TINYINT NOT NULL DEFAULT 1')
  // Domicilios F3: marca de "el cliente pidió repartidor de plataforma".
  // NULL (default) = tienda fuera del modo plataforma → el pedido se difunde
  // como siempre. 0 = pidió recoger/domicilio propio → NO se difunde.
  // Segunda imagen de categoría (hover en el tema 1). Opcional: sin valor, la
  // tarjeta se comporta exactamente como hoy.
  await addColumnIfMissing('categories', 'image_url_hover', 'VARCHAR(500) NULL')
  // Portada de categoría (imagen o GIF): transición al abrirla + cabecera del catálogo.
  await addColumnIfMissing('categories', 'cover_url', 'VARCHAR(500) NULL')
  // Animación de entrada a categoría (tema 1), a nivel de tienda.
  await addColumnIfMissing('store_info', 'category_transition', "VARCHAR(20) NOT NULL DEFAULT 'peine'")
  await addColumnIfMissing('storefront_orders', 'courier_requested', 'TINYINT NULL')
  await addColumnIfMissing('storefront_orders', 'courier_requested_at', 'TIMESTAMP NULL')
  // Domicilios F5: calificación y reporte del repartidor. UNIQUE(order_id) es lo
  // que impide inflar un promedio: una calificación por pedido.
  await pool.query(
    `CREATE TABLE IF NOT EXISTS courier_ratings (
       id VARCHAR(36) NOT NULL,
       order_id VARCHAR(36) NOT NULL,
       courier_user_id VARCHAR(36) NOT NULL,
       tenant_id VARCHAR(36) NOT NULL,
       stars TINYINT NULL,
       comment VARCHAR(400) NULL,
       reported TINYINT NOT NULL DEFAULT 0,
       report_reason VARCHAR(60) NULL,
       reviewed_at TIMESTAMP NULL,
       reviewed_by VARCHAR(36) NULL,
       created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (id),
       UNIQUE KEY uk_courier_rating_order (order_id),
       KEY idx_courier_rating_courier (courier_user_id),
       KEY idx_courier_rating_tenant (tenant_id),
       KEY idx_courier_rating_reported (reported)
     )`
  )
  // RestBar POS táctil: el service inserta original_price/course_number en rb_order_items,
  // pero el baseline creó la tabla sin ellas → "Unknown column" (500) al agregar ítems.
  await addColumnIfMissing('rb_order_items', 'original_price', 'DECIMAL(12,2) NULL')
  await addColumnIfMissing('rb_order_items', 'course_number', 'TINYINT NULL')

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

  // ── Caja por turnos ────────────────────────────────────────────────────────
  // shift_type/shift_label viven en el baseline (marcado-no-ejecutado en prod vieja),
  // así que una prod anterior a la feature de turnos no las tiene y el openSession
  // (que inserta shift_type) daría 500. La migración 0043 crea shift_employees/bonuses.
  await addColumnIfMissing('cash_sessions', 'shift_type', "ENUM('mañana','tarde','unico') NOT NULL DEFAULT 'unico'")
  await addColumnIfMissing('cash_sessions', 'shift_label', 'VARCHAR(50) NULL')

  // ── Eventos: gaps de las migraciones 0045–0047 ─────────────────────────────
  // Estado parcial típico: las tablas base de eventos (0044) existen pero migrate()
  // abortó antes de aplicar los ALTER/CREATE de 0045–0047 (trace_id, event_logs,
  // ticket_version, event_waitlists). Idempotente: solo agrega lo que falte.
  await addColumnIfMissing('event_seat_holds', 'trace_id', 'VARCHAR(64) NULL')
  await addColumnIfMissing('event_bookings', 'trace_id', 'VARCHAR(64) NULL')
  await addColumnIfMissing('event_booking_items', 'ticket_version', 'INT NOT NULL DEFAULT 1')
  await pool.query(
    `CREATE TABLE IF NOT EXISTS event_logs (
      id VARCHAR(36) NOT NULL PRIMARY KEY, tenant_id VARCHAR(36) NOT NULL,
      event_id VARCHAR(36) NULL, booking_id VARCHAR(36) NULL, trace_id VARCHAR(64) NULL,
      action VARCHAR(50) NOT NULL, actor VARCHAR(100) NULL, metadata JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_elog_trace (trace_id), INDEX idx_elog_booking (booking_id),
      INDEX idx_elog_event (event_id, action)
    ) ENGINE=InnoDB DEFAULT CHARSET=${charset} COLLATE=${collation}`
  )
  await pool.query(
    `CREATE TABLE IF NOT EXISTS event_waitlists (
      id VARCHAR(36) NOT NULL PRIMARY KEY, event_id VARCHAR(36) NOT NULL, tenant_id VARCHAR(36) NOT NULL,
      customer_name VARCHAR(255) NOT NULL, customer_phone VARCHAR(20) NULL, customer_email VARCHAR(255) NULL,
      quantity INT DEFAULT 1, notified_at DATETIME NULL, expires_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ewl_event (event_id, notified_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=${charset} COLLATE=${collation}`
  )

  // ── Gym · P1: librería normalizada (núcleo + traducciones + media + tags) ──
  // El núcleo no guarda texto ni urls: eso vive en sus tablas hijas, así se agregan
  // idiomas y formatos de media sin tocar la tabla principal.
  await pool.query(
    `CREATE TABLE IF NOT EXISTS exercises (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      dataset_id VARCHAR(10) NULL,
      slug VARCHAR(180) NULL,
      source VARCHAR(20) NOT NULL DEFAULT 'dataset',
      body_part VARCHAR(40) NULL,
      equipment VARCHAR(60) NULL,
      target VARCHAR(60) NULL,
      muscle_group VARCHAR(60) NULL,
      secondary_muscles JSON NULL,
      movement_pattern VARCHAR(10) NULL,
      difficulty VARCHAR(20) NULL,
      experience_level VARCHAR(20) NULL,
      is_active TINYINT NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_ex_dataset (dataset_id),
      INDEX idx_ex_body (body_part, is_active),
      INDEX idx_ex_equipment (equipment),
      INDEX idx_ex_pattern (movement_pattern)
    ) ENGINE=InnoDB DEFAULT CHARSET=${charset} COLLATE=${collation}`
  )
  await pool.query(
    `CREATE TABLE IF NOT EXISTS exercise_translations (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      exercise_id VARCHAR(36) NOT NULL,
      language VARCHAR(5) NOT NULL,
      name VARCHAR(200) NULL,
      instructions TEXT NULL,
      steps JSON NULL,
      tips TEXT NULL,
      mistakes TEXT NULL,
      UNIQUE KEY uk_extr (exercise_id, language),
      INDEX idx_extr_lang (language)
    ) ENGINE=InnoDB DEFAULT CHARSET=${charset} COLLATE=${collation}`
  )
  await pool.query(
    `CREATE TABLE IF NOT EXISTS exercise_media (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      exercise_id VARCHAR(36) NOT NULL,
      kind VARCHAR(20) NOT NULL,
      url VARCHAR(220) NOT NULL,
      width INT NULL,
      height INT NULL,
      attribution VARCHAR(220) NULL,
      sort_order INT NOT NULL DEFAULT 0,
      INDEX idx_exmed_ex (exercise_id, kind)
    ) ENGINE=InnoDB DEFAULT CHARSET=${charset} COLLATE=${collation}`
  )
  await pool.query(
    `CREATE TABLE IF NOT EXISTS exercise_tags (
      exercise_id VARCHAR(36) NOT NULL,
      tag VARCHAR(60) NOT NULL,
      PRIMARY KEY (exercise_id, tag),
      INDEX idx_extag_tag (tag)
    ) ENGINE=InnoDB DEFAULT CHARSET=${charset} COLLATE=${collation}`
  )

  // ── Gym · P2: rutinas versionadas (identidad → versión inmutable → ejercicios) ──
  await pool.query(
    `CREATE TABLE IF NOT EXISTS routines (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      name VARCHAR(160) NOT NULL,
      description TEXT NULL,
      goal VARCHAR(24) NOT NULL DEFAULT 'hypertrophy',
      is_active TINYINT NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_rt_active (is_active, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=${charset} COLLATE=${collation}`
  )
  await pool.query(
    `CREATE TABLE IF NOT EXISTS routine_versions (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      routine_id VARCHAR(36) NOT NULL,
      version INT NOT NULL DEFAULT 1,
      status VARCHAR(12) NOT NULL DEFAULT 'draft',
      movement_pattern VARCHAR(10) NULL,
      notes TEXT NULL,
      published_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_rv (routine_id, version),
      INDEX idx_rv_status (routine_id, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=${charset} COLLATE=${collation}`
  )
  await pool.query(
    `CREATE TABLE IF NOT EXISTS routine_exercises (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      routine_version_id VARCHAR(36) NOT NULL,
      exercise_id VARCHAR(36) NOT NULL,
      display_name VARCHAR(160) NULL,
      exercise_order INT NOT NULL DEFAULT 0,
      group_id VARCHAR(10) NULL,
      execution_type VARCHAR(12) NOT NULL DEFAULT 'NORMAL',
      target_sets INT NOT NULL DEFAULT 3,
      target_reps INT NOT NULL DEFAULT 12,
      start_weight DECIMAL(8,2) NOT NULL DEFAULT 0.00,
      rpe DECIMAL(3,1) NULL,
      rir INT NULL,
      tempo VARCHAR(16) NULL,
      rest_seconds INT NULL,
      INDEX idx_rex_version (routine_version_id, exercise_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=${charset} COLLATE=${collation}`
  )

  // ── Fase 1.5 · versionado de plantillas de producto ──────────────────────────
  // Mismo patrón que routine_versions. NO destructivo: product_templates.sections
  // se conserva como espejo de la versión publicada, así el endpoint público
  // /storefront/product-page/:id sigue leyéndolo sin cambios y revertir el deploy
  // no pierde datos.
  await pool.query(
    `CREATE TABLE IF NOT EXISTS product_template_versions (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      template_id VARCHAR(36) NOT NULL,
      version INT NOT NULL DEFAULT 1,
      sections JSON NOT NULL,
      status VARCHAR(12) NOT NULL DEFAULT 'draft',
      published_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_ptv (template_id, version),
      INDEX idx_ptv_status (template_id, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=${charset} COLLATE=${collation}`
  )

  // Backfill v1 de las plantillas que aún no tienen versiones. Idempotente por el
  // NOT EXISTS + uk_ptv; el servicio además hace backfill perezoso por si acaso.
  const [ptplExists]: any = await pool.query(
    "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'product_templates'"
  )
  if (Number(ptplExists[0].n) > 0) {
    await pool.query(
      `INSERT INTO product_template_versions (id, template_id, version, sections, status, published_at)
       SELECT UUID(), t.id, 1, t.sections, t.status,
              CASE WHEN t.status = 'published' THEN NOW() ELSE NULL END
         FROM product_templates t
        WHERE NOT EXISTS (
          SELECT 1 FROM product_template_versions v WHERE v.template_id = t.id
        )`
    )
  }

  // ── Fase 3 · Product Bundle Builder ──────────────────────────────────────────
  await pool.query(
    `CREATE TABLE IF NOT EXISTS product_bundles (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      name VARCHAR(160) NOT NULL,
      description VARCHAR(400) NULL,
      image_url VARCHAR(500) NULL,
      label VARCHAR(60) NULL,
      discount_type ENUM('fixed_total','percent','amount_off') NOT NULL DEFAULT 'percent',
      discount_value DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      anchor_product_id VARCHAR(36) NULL,
      status ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
      is_active TINYINT NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_pb_tenant_status (tenant_id, status),
      INDEX idx_pb_anchor (anchor_product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=${charset} COLLATE=${collation}`
  )
  await pool.query(
    `CREATE TABLE IF NOT EXISTS product_bundle_items (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      bundle_id VARCHAR(36) NOT NULL,
      product_id VARCHAR(36) NOT NULL,
      variant_id VARCHAR(36) NULL,
      quantity INT NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 0,
      INDEX idx_pbi_bundle (bundle_id, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=${charset} COLLATE=${collation}`
  )

  // ── Fase 4 · Checkout Experience (config de personalización por tenant) ───────
  await pool.query(
    `CREATE TABLE IF NOT EXISTS checkout_experiences (
      tenant_id VARCHAR(36) NOT NULL PRIMARY KEY,
      config JSON NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=${charset} COLLATE=${collation}`
  )

  // ── Gimnasio: membresías, planes, progreso y asistencia ─────────────────────
  // `gym.service.ts` las consultaba pero no estaban definidas en ninguna parte del
  // repo → sus endpoints fallaban con "table doesn't exist". Esquema derivado de
  // las consultas reales del servicio.
  await pool.query(
    `CREATE TABLE IF NOT EXISTS gym_membresias (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      user_id VARCHAR(36) NOT NULL,
      plan_name VARCHAR(160) NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'activa',
      price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      payment_cycle VARCHAR(20) NOT NULL DEFAULT 'mensual',
      auto_renew TINYINT NOT NULL DEFAULT 0,
      start_date DATE NULL,
      end_date DATE NULL,
      last_payment_at DATETIME NULL,
      next_payment_at DATETIME NULL,
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_gym_membresia (tenant_id, user_id),
      INDEX idx_gym_memb_status (tenant_id, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=${charset} COLLATE=${collation}`
  )
  await pool.query(
    `CREATE TABLE IF NOT EXISTS gym_planes_entrenamiento (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      member_user_id VARCHAR(36) NOT NULL,
      name VARCHAR(200) NOT NULL,
      description TEXT NULL,
      days_per_week INT NULL,
      is_active TINYINT NOT NULL DEFAULT 1,
      created_by VARCHAR(36) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_gym_plan_member (tenant_id, member_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=${charset} COLLATE=${collation}`
  )
  await pool.query(
    `CREATE TABLE IF NOT EXISTS gym_ejercicios (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      plan_id VARCHAR(36) NOT NULL,
      tenant_id VARCHAR(36) NOT NULL,
      day_label VARCHAR(60) NULL,
      name VARCHAR(200) NOT NULL,
      sets INT NULL,
      reps VARCHAR(40) NULL,
      weight_kg DECIMAL(8,2) NULL,
      rest_seconds INT NULL,
      notes TEXT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      INDEX idx_gym_ej_plan (plan_id, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=${charset} COLLATE=${collation}`
  )
  await pool.query(
    `CREATE TABLE IF NOT EXISTS gym_progreso (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      member_user_id VARCHAR(36) NOT NULL,
      log_date DATE NOT NULL,
      weight_kg DECIMAL(6,2) NULL,
      body_fat_pct DECIMAL(5,2) NULL,
      muscle_mass_kg DECIMAL(6,2) NULL,
      measurements JSON NULL,
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_gym_prog_member (tenant_id, member_user_id, log_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=${charset} COLLATE=${collation}`
  )
  await pool.query(
    `CREATE TABLE IF NOT EXISTS gym_asistencia (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      member_user_id VARCHAR(36) NOT NULL,
      checked_in_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      checked_out_at TIMESTAMP NULL,
      notes TEXT NULL,
      INDEX idx_gym_asis_tenant_day (tenant_id, checked_in_at),
      INDEX idx_gym_asis_member (member_user_id, checked_out_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=${charset} COLLATE=${collation}`
  )

  // Por si la tabla ya se creó antes sin esta columna (listMemberAttendance la lee)
  await addColumnIfMissing('gym_asistencia', 'notes', 'TEXT NULL')

  // ── Fase 4 GastroBar · Tiqueteras / Meal Pass ────────────────────────────────
  await pool.query(
    `CREATE TABLE IF NOT EXISTS meal_passes (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      customer_name VARCHAR(255) NOT NULL,
      document VARCHAR(50) NULL,
      phone VARCHAR(50) NULL,
      convenio VARCHAR(160) NULL,
      empresa VARCHAR(160) NULL,
      total_meals INT NOT NULL DEFAULT 0,
      remaining INT NOT NULL DEFAULT 0,
      purchased_at DATE NULL,
      expires_at DATE NULL,
      status ENUM('activa','agotada','vencida','anulada') NOT NULL DEFAULT 'activa',
      is_active TINYINT NOT NULL DEFAULT 1,
      notes VARCHAR(400) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_mp_tenant_status (tenant_id, status),
      INDEX idx_mp_doc (tenant_id, document),
      INDEX idx_mp_phone (tenant_id, phone)
    ) ENGINE=InnoDB DEFAULT CHARSET=${charset} COLLATE=${collation}`
  )
  await pool.query(
    `CREATE TABLE IF NOT EXISTS meal_pass_movements (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      meal_pass_id VARCHAR(36) NOT NULL,
      type ENUM('recarga','consumo','ajuste','anulacion') NOT NULL,
      meals INT NOT NULL,
      balance_after INT NOT NULL,
      order_id VARCHAR(36) NULL,
      order_item_id VARCHAR(36) NULL,
      table_number VARCHAR(20) NULL,
      employee_id VARCHAR(36) NULL,
      employee_name VARCHAR(255) NULL,
      note VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_mpm_pass (meal_pass_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=${charset} COLLATE=${collation}`
  )
}

// Aplica las migraciones pendientes (registradas en __drizzle_migrations).
export async function runMigrations(): Promise<void> {
  await ensureBaselineForExistingDb()
  await ensureEventsMigrationsMarked()
  // Aplica lo que falte de las migraciones pendientes que quedaron a medias y las
  // marca. Sin esto, migrate() aborta con "Duplicate column/Table already exists"
  // y bloquea todas las siguientes (era el caso de 0050–0052 y el gimnasio).
  await reconcilePendingMigrations()
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
