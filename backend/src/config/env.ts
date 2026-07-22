import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const IS_PROD = (process.env.NODE_ENV || 'development') === 'production';

/**
 * Secreto obligatorio en producción (fail-closed).
 * - En producción: si falta o es demasiado corto, ABORTA el arranque (throw) en vez de
 *   correr con un valor conocido/inseguro. Esto evita que un despliegue sin la env quede
 *   firmando/descifrando con un secreto adivinable.
 * - En desarrollo: usa devFallback para no frenar el trabajo local.
 */
function requireSecret(
  name: string,
  value: string | undefined,
  opts: { minLength?: number; devFallback?: string } = {}
): string {
  const v = (value ?? '').trim();
  if (IS_PROD) {
    if (!v) {
      throw new Error(`[config] ${name} es obligatorio en producción (fail-closed). Configúralo en el entorno antes de desplegar.`);
    }
    if (opts.minLength && v.length < opts.minLength) {
      throw new Error(`[config] ${name} es demasiado corto (mínimo ${opts.minLength} caracteres). Usa un valor aleatorio y largo.`);
    }
    return v;
  }
  return v || (opts.devFallback ?? '');
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'stockpro_db',
  },

  jwt: {
    // Fail-closed: en producción JWT_SECRET es obligatorio (≥32 chars). En dev usa un
    // fallback claramente inseguro para no bloquear el trabajo local.
    secret: requireSecret('JWT_SECRET', process.env.JWT_SECRET, {
      minLength: 32,
      devFallback: 'dev-only-insecure-jwt-secret-change-me',
    }),
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
  },

  cors: {
    // In production, CORS_ORIGIN must be set to your real domains only.
    // Localhost origins are only allowed in development.
    origin: (() => {
      const isProd = (process.env.NODE_ENV || 'development') === 'production';
      if (process.env.CORS_ORIGIN) {
        const origins = process.env.CORS_ORIGIN.split(',').map(o => o.trim());
        if (isProd) {
          // Strip localhost entries in production to prevent accidental exposure
          return origins.filter(o => !o.includes('localhost') && !o.includes('127.0.0.1'));
        }
        return origins;
      }
      // Default: only allow localhost in development
      if (isProd) return [] as string[];
      return ['http://localhost:3000', 'http://localhost:3003'];
    })(),
  },

  mp: {
    accessToken: process.env.MP_ACCESS_TOKEN || '',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  },

  // AES-256 key for encrypting sensitive user data (phone, cedula, address)
  // Must be a 64-char hex string (32 bytes). Set via ENCRYPTION_KEY env var.
  // Fail-closed en producción: sin esta clave la PII no se puede cifrar de forma segura.
  encryptionKey: requireSecret('ENCRYPTION_KEY', process.env.ENCRYPTION_KEY, {
    minLength: 64,
    devFallback: '',
  }),

  // Offline-first sync config
  // IS_LOCAL_INSTANCE=true  → este backend corre en el PC del cliente y debe sincronizar con la nube
  // CLOUD_API_URL            → URL del backend en la nube (ej: https://api.miapp.com)
  // SYNC_SECRET              → clave compartida entre local y nube para autenticar el sync
  // SYNC_TENANT_ID           → UUID del tenant al que pertenece esta instalación local
  sync: {
    isLocalInstance: process.env.IS_LOCAL_INSTANCE === 'true',
    cloudApiUrl: process.env.CLOUD_API_URL || '',
    secret: process.env.SYNC_SECRET || '',
    intervalMs: parseInt(process.env.SYNC_INTERVAL_MS || '30000', 10),
    tenantId: process.env.SYNC_TENANT_ID || '',
  },
};
