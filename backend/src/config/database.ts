import mysql from 'mysql2/promise';
import { config } from './env';

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  // Estandarización de zona horaria (UTC end-to-end). mysql2 interpreta/devuelve
  // los DATETIME/TIMESTAMP como UTC; el frontend los muestra en America/Bogota.
  timezone: 'Z',
});

// Forzar la sesión de MySQL a UTC en cada conexión nueva: así NOW()/CURRENT_TIMESTAMP
// insertan en UTC y las lecturas de TIMESTAMP quedan en UTC consistente, evitando el
// desfase de -5h que se veía cuando la sesión estaba en hora Colombia.
(pool as any).pool?.on?.('connection', (connection: any) => {
  try { connection.query("SET time_zone='+00:00'"); } catch { /* noop */ }
});

export const testConnection = async (): Promise<boolean> => {
  try {
    const connection = await pool.getConnection();
    console.log('Conexion a MySQL establecida correctamente');
    connection.release();
    return true;
  } catch (error) {
    console.error('Error conectando a MySQL:', error);
    return false;
  }
};

export default pool;
