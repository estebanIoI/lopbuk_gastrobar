import { drizzle } from 'drizzle-orm/mysql2'
import pool from '../config/database'

// Cliente Drizzle montado sobre el pool mysql2 existente. Convive con el SQL raw
// (`pool.query(...)`); se puede usar `db.execute(sql\`...\`)` o el query builder.
export const db = drizzle(pool)
