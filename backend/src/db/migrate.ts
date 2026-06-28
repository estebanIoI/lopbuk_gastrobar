import { migrate } from 'drizzle-orm/mysql2/migrator'
import { db } from './index'
import pool from '../config/database'

// Aplica las migraciones pendientes (registradas en __drizzle_migrations).
// Con la carpeta de migraciones vacía es un no-op seguro.
export async function runMigrations(): Promise<void> {
  await migrate(db, { migrationsFolder: './src/db/migrations' })
}

// Ejecutable directo: `node dist/db/migrate.js` (prod/CI) o vía ts en dev.
if (require.main === module) {
  runMigrations()
    .then(() => { console.log('Drizzle: migraciones aplicadas.') })
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((e) => { console.error('Drizzle migrate error:', e); process.exit(1) })
}
