import pool from '../../config/database';

// Singleton de configuración de la landing /lopbuk.
// La forma del JSON `config` la define el frontend (defaults en
// frontend/app/lopbuk/page.tsx). El backend solo persiste/lee el JSON.

async function ensureTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lopbuk_landing (
      id          INT PRIMARY KEY DEFAULT 1,
      config      JSON,
      updated_by  VARCHAR(120),
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

/** Devuelve la config guardada (objeto) o {} si no existe / tabla no migrada. */
export async function getLandingConfig(): Promise<Record<string, any>> {
  try {
    const [rows] = await pool.query('SELECT config FROM lopbuk_landing WHERE id = 1 LIMIT 1') as any;
    const row = (rows as any[])[0];
    if (!row || !row.config) return {};
    return typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
  } catch {
    // Tabla aún no migrada: la landing usa sus defaults.
    return {};
  }
}

/** Upsert del singleton. Auto-crea la tabla si no existe. */
export async function saveLandingConfig(config: Record<string, any>, updatedBy: string): Promise<void> {
  await ensureTable();
  const json = JSON.stringify(config ?? {});
  await pool.query(
    `INSERT INTO lopbuk_landing (id, config, updated_by)
     VALUES (1, ?, ?)
     ON DUPLICATE KEY UPDATE config = VALUES(config), updated_by = VALUES(updated_by)`,
    [json, updatedBy || '']
  );
}
