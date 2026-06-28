import { defineConfig } from 'drizzle-kit'
import { config } from './src/config/env'

// Config de Drizzle Kit. Reusa las mismas credenciales que el pool mysql2.
// Comandos: `npm run db:pull` (introspección/baseline), `npm run db:generate`
// (genera migración desde src/db/schema), `npm run migrate` (aplica pendientes).
//
// Se usa `url` (en vez de credenciales sueltas) porque drizzle-kit rechaza un
// password vacío como "faltante"; la URL admite usuario sin contraseña (dev local).
const { host, port, user, password, database } = config.db
const auth = password ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}` : encodeURIComponent(user)
const url = `mysql://${auth}@${host}:${port}/${database}`

export default defineConfig({
  dialect: 'mysql',
  // Archivos explícitos (no la carpeta) para que drizzle-kit no escanee también
  // index.ts —que reexporta schema/relations— y cuente las vistas por duplicado.
  schema: ['./src/db/schema/schema.ts', './src/db/schema/relations.ts'],
  out: './src/db/migrations',
  // Nunca introspectar la tabla de control de migraciones de Drizzle.
  tablesFilter: ['!__drizzle_migrations'],
  dbCredentials: { url },
})
