import { createHmac, randomBytes } from 'crypto'
import pool from '../../config/database'

const HMAC_SECRET = process.env.JWT_SECRET || 'daimuz_hidden_layer_secret'

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateNonce(): string {
  return randomBytes(12).toString('base64url')
}

function generateCode(): string {
  const words = ['ONYX', 'NOVA', 'APEX', 'VOLT', 'FLUX', 'ECHO', 'CIPHER', 'VOID']
  const word = words[Math.floor(Math.random() * words.length)]
  const num = String(Math.floor(Math.random() * 900) + 100)
  const prefix = randomBytes(3).toString('hex').toUpperCase().slice(0, 4)
  return `${prefix}-${word}-${num}`
}

function signToken(tenantId: string, nonce: string): string {
  const payload = `${tenantId}.${nonce}`
  const sig = createHmac('sha256', HMAC_SECRET).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

function verifyToken(token: string): { tenantId: string; nonce: string } | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [tenantId, nonce, sig] = parts
  const expected = createHmac('sha256', HMAC_SECRET).update(`${tenantId}.${nonce}`).digest('base64url')
  return sig === expected ? { tenantId, nonce } : null
}

// ── Service ───────────────────────────────────────────────────────────────────

export async function generateHiddenAccess(tenantId: string, expiresInDays?: number) {
  const nonce = generateNonce()
  const token = signToken(tenantId, nonce)
  const code = generateCode()
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 86_400_000).toISOString().slice(0, 19).replace('T', ' ')
    : null

  await pool.query(
    `UPDATE tenants
     SET is_hidden = 1, hidden_access_token = ?, hidden_access_code = ?,
         hidden_token_expires_at = ?, vip_intro_enabled = 1
     WHERE id = ?`,
    [token, code, expiresAt, tenantId]
  )

  return { token, code, expiresAt }
}

export async function regenerateHiddenAccess(tenantId: string, expiresInDays?: number) {
  // Verifica que el tenant tiene allow_regeneration = 1
  const [rows] = await pool.query(
    'SELECT allow_regeneration FROM tenants WHERE id = ? LIMIT 1',
    [tenantId]
  ) as any
  if (!rows?.[0]) throw new Error('Tenant not found')
  if (!rows[0].allow_regeneration) throw new Error('Regeneration not allowed for this store')

  return generateHiddenAccess(tenantId, expiresInDays)
}

export async function disableHiddenAccess(tenantId: string) {
  await pool.query(
    `UPDATE tenants
     SET is_hidden = 0, hidden_access_token = NULL, hidden_access_code = NULL,
         hidden_token_expires_at = NULL
     WHERE id = ?`,
    [tenantId]
  )
}

export async function validateHiddenToken(rawToken: string) {
  const parsed = verifyToken(rawToken)
  if (!parsed) return null

  const [rows] = await pool.query(
    `SELECT t.id, t.name, t.slug, t.hidden_token_expires_at as expiresAt,
            t.hidden_theme as hiddenTheme, t.vip_intro_enabled as vipIntroEnabled,
            si.logo_url as logoUrl, si.card_description as cardDescription,
            si.card_cover_url as coverUrl, si.municipality as city
     FROM tenants t
     LEFT JOIN store_info si ON si.tenant_id = t.id
     WHERE t.id = ? AND t.is_hidden = 1 AND t.hidden_access_token = ? AND t.status = 'activo'
     LIMIT 1`,
    [parsed.tenantId, rawToken]
  ) as any

  const store = rows?.[0]
  if (!store) return null

  if (store.expiresAt && new Date(store.expiresAt) < new Date()) {
    return { expired: true }
  }

  return {
    expired: false,
    store: {
      id: store.id,
      name: store.name,
      slug: store.slug,
      logoUrl: store.logoUrl,
      coverUrl: store.coverUrl,
      cardDescription: store.cardDescription,
      city: store.city,
      hiddenTheme: store.hiddenTheme || 'default',
      vipIntroEnabled: Boolean(store.vipIntroEnabled),
    },
  }
}

export async function validateHiddenCode(code: string) {
  const [rows] = await pool.query(
    `SELECT t.id, t.name, t.slug, t.hidden_token_expires_at as expiresAt,
            t.hidden_theme as hiddenTheme, t.vip_intro_enabled as vipIntroEnabled,
            si.logo_url as logoUrl, si.card_description as cardDescription,
            si.card_cover_url as coverUrl
     FROM tenants t
     LEFT JOIN store_info si ON si.tenant_id = t.id
     WHERE UPPER(t.hidden_access_code) = UPPER(?) AND t.is_hidden = 1 AND t.status = 'activo'
     LIMIT 1`,
    [code]
  ) as any

  const store = rows?.[0]
  if (!store) return null
  if (store.expiresAt && new Date(store.expiresAt) < new Date()) return { expired: true }

  return {
    expired: false,
    store: {
      id: store.id, name: store.name, slug: store.slug,
      logoUrl: store.logoUrl, coverUrl: store.coverUrl,
      cardDescription: store.cardDescription,
      hiddenTheme: store.hiddenTheme || 'default',
      vipIntroEnabled: Boolean(store.vipIntroEnabled),
    },
  }
}

export async function getHiddenAccessInfo(tenantId: string) {
  const [rows] = await pool.query(
    `SELECT is_hidden, hidden_access_token, hidden_access_code,
            hidden_token_expires_at, allow_regeneration, hidden_theme, vip_intro_enabled
     FROM tenants WHERE id = ? LIMIT 1`,
    [tenantId]
  ) as any
  return rows?.[0] ?? null
}
