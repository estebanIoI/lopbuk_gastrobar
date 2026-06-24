/**
 * vault.service — Vault / Access Ecosystem (V1).
 *
 * "Vault Keys" (Access Pass) que desbloquean INTERFACES OCULTAS del OS, no solo
 * productos: tema secreto, catálogo oculto, sala de coach privada, drops, leaderboard.
 * El token NO lleva precio ni lógica de negocio — solo abre vistas. El precio lo
 * sigue calculando el backend. `tenant_id` viene del token/JWT, nunca del body.
 */
import { v4 as uuidv4 } from 'uuid';
import { RowDataPacket } from 'mysql2';
import { db } from '../../config';
import { AppError } from '../../common/middleware';

/** Interfaces ocultas conocidas (para validación + UI). Se pueden ampliar. */
export const KNOWN_UNLOCKS = [
  'secret_theme', 'hidden_catalog', 'coach_room', 'drops', 'leaderboard', 'inner_circle',
] as const;

const safeJson = (s: any) => { if (s == null) return null; if (typeof s !== 'string') return s; try { return JSON.parse(s); } catch { return null; } };
const slug = (s: string) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');

function genCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin O/0/I/1
  let s = '';
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `VAULT-${s}`;
}

type Unlocks = { keys: string[]; message?: string | null; productIds?: string[] | null };

function normalizeUnlocks(input: any): Unlocks {
  const raw = Array.isArray(input?.keys) ? input.keys : Array.isArray(input) ? input : [];
  const keys: string[] = Array.from(new Set(raw.map((k: any) => slug(String(k))).filter(Boolean))) as string[];
  if (keys.length === 0) throw new AppError('La llave debe desbloquear al menos una interfaz', 400);
  return { keys, message: input?.message ? String(input.message).slice(0, 280) : null, productIds: Array.isArray(input?.productIds) ? input.productIds : null };
}

class VaultService {
  // ── Admin / Curador: emitir / listar / editar ─────────────────────────────
  async createKey(data: any, opts: { createdBy?: string | null; createdByAffiliateId?: string | null } = {}) {
    const label = String(data?.label || '').trim();
    if (!label) throw new AppError('El nombre interno de la llave es requerido', 400);
    const unlocks = normalizeUnlocks(data?.unlocks);
    const keyType: string = ['one_use', 'window', 'multi'].includes(data?.keyType) ? data.keyType : 'multi';
    let code = String(data?.code || '').trim().toUpperCase();
    if (code) {
      if (!/^[A-Z0-9-]{4,40}$/.test(code)) throw new AppError('Código inválido (4-40, A-Z/0-9/-)', 400);
      const [dup] = await db.execute<RowDataPacket[]>('SELECT id FROM vault_keys WHERE code = ? LIMIT 1', [code]);
      if (dup[0]) throw new AppError('Ese código ya existe', 409);
    } else {
      // genera uno único
      for (let i = 0; i < 6; i++) {
        const c = genCode();
        const [dup] = await db.execute<RowDataPacket[]>('SELECT id FROM vault_keys WHERE code = ? LIMIT 1', [c]);
        if (!dup[0]) { code = c; break; }
      }
      if (!code) throw new AppError('No se pudo generar un código único, reintenta', 500);
    }
    const maxRedemptions = data?.maxRedemptions != null && data.maxRedemptions !== '' ? Math.max(1, Math.floor(Number(data.maxRedemptions))) : (keyType === 'one_use' ? 1 : null);
    const expiresAt = data?.expiresAt ? new Date(data.expiresAt) : null;
    const startsAt = data?.startsAt ? new Date(data.startsAt) : null;
    const id = uuidv4();
    await db.execute(
      `INSERT INTO vault_keys (id, tenant_id, code, label, key_type, unlocks, max_redemptions, starts_at, expires_at, status, created_by, created_by_affiliate_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
      [id, data?.tenantId || null, code, label, keyType, JSON.stringify(unlocks),
       maxRedemptions, startsAt, expiresAt, opts.createdBy || null, opts.createdByAffiliateId || null]
    );
    return this.adminGetKey(id);
  }

  /** Un afiliado-curador emite una Vault Key (atribuida a él). */
  async createKeyAsAffiliate(affiliateId: string, data: any) {
    // Curador: cap defensivo de canjes para evitar abuso (si no especifica).
    const payload = { ...data, maxRedemptions: data?.maxRedemptions != null && data.maxRedemptions !== '' ? data.maxRedemptions : 100 };
    return this.createKey(payload, { createdByAffiliateId: affiliateId });
  }

  async listAffiliateKeys(affiliateId: string) {
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT * FROM vault_keys WHERE created_by_affiliate_id = ? ORDER BY created_at DESC LIMIT 200', [affiliateId]
    );
    return rows.map((r: any) => this.mapKey(r));
  }

  async adminGetKey(id: string) {
    const [rows] = await db.execute<RowDataPacket[]>('SELECT * FROM vault_keys WHERE id = ? LIMIT 1', [id]);
    return rows[0] ? this.mapKey(rows[0]) : null;
  }

  async adminListKeys() {
    const [rows] = await db.execute<RowDataPacket[]>('SELECT * FROM vault_keys ORDER BY created_at DESC LIMIT 200');
    return rows.map((r: any) => this.mapKey(r));
  }

  async adminUpdateKey(id: string, patch: any) {
    const sets: string[] = []; const args: any[] = [];
    if (patch?.status !== undefined) { sets.push('status = ?'); args.push(patch.status === 'disabled' ? 'disabled' : 'active'); }
    if (patch?.label !== undefined) { sets.push('label = ?'); args.push(String(patch.label).trim()); }
    if (patch?.maxRedemptions !== undefined) { sets.push('max_redemptions = ?'); args.push(patch.maxRedemptions == null || patch.maxRedemptions === '' ? null : Math.max(1, Math.floor(Number(patch.maxRedemptions)))); }
    if (patch?.expiresAt !== undefined) { sets.push('expires_at = ?'); args.push(patch.expiresAt ? new Date(patch.expiresAt) : null); }
    if (patch?.unlocks !== undefined) { sets.push('unlocks = ?'); args.push(JSON.stringify(normalizeUnlocks(patch.unlocks))); }
    if (sets.length === 0) return this.adminGetKey(id);
    args.push(id);
    const [r] = await db.execute(`UPDATE vault_keys SET ${sets.join(', ')} WHERE id = ?`, args);
    if ((r as any).affectedRows === 0) throw new AppError('Llave no encontrada', 404);
    return this.adminGetKey(id);
  }

  // ── Consumidor: canjear + consultar desbloqueos ───────────────────────────
  /** Canjea una Vault Key. Transaccional e idempotente por (key,user). */
  async redeem(userId: string, code: string, zeroPartyData?: any) {
    if (!userId) throw new AppError('Usuario no autenticado', 401);
    const clean = String(code || '').trim().toUpperCase();
    if (!clean) throw new AppError('Ingresa tu Access Pass', 400);

    const conn = await (db as any).getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query('SELECT * FROM vault_keys WHERE code = ? LIMIT 1 FOR UPDATE', [clean]);
      const k = (rows as any[])[0];
      if (!k) throw new AppError('Esa llave no existe', 404);
      if (k.status !== 'active') throw new AppError('Esta llave está deshabilitada', 410);
      const now = Date.now();
      if (k.starts_at && new Date(k.starts_at).getTime() > now) throw new AppError('Esta llave aún no está activa', 425);
      if (k.expires_at && new Date(k.expires_at).getTime() < now) throw new AppError('Esta llave ya expiró', 410);

      const unlocks: Unlocks = safeJson(k.unlocks) || { keys: [] };

      // ¿ya la canjeó este usuario? → idempotente, re-asegura unlocks y sale.
      const [prev] = await conn.query('SELECT id FROM vault_key_redemptions WHERE vault_key_id = ? AND user_id = ? LIMIT 1', [k.id, userId]);
      const already = (prev as any[])[0];
      if (!already) {
        if (k.max_redemptions != null && k.redemptions >= k.max_redemptions) throw new AppError('Esta llave ya alcanzó su límite de canjes', 409);
        await conn.query(
          'INSERT INTO vault_key_redemptions (id, vault_key_id, user_id, zero_party_data) VALUES (?, ?, ?, ?)',
          [uuidv4(), k.id, userId, zeroPartyData ? JSON.stringify(zeroPartyData) : null]
        );
        await conn.query('UPDATE vault_keys SET redemptions = redemptions + 1 WHERE id = ?', [k.id]);
      }
      // upsert de cada desbloqueo (idempotente por UNIQUE(user,key))
      for (const uk of unlocks.keys || []) {
        await conn.query(
          'INSERT IGNORE INTO consumer_vault_unlocks (id, user_id, unlock_key, vault_key_id) VALUES (?, ?, ?, ?)',
          [uuidv4(), userId, uk, k.id]
        );
      }
      await conn.commit();
      if (!already) {
        try { const { achievementsService } = await import('../achievements/achievements.service'); await achievementsService.award(userId, 'vault_initiate', 'vault'); } catch { /* no bloquear */ }
        try { const { gamificationService } = await import('../gamification/gamification.service'); await gamificationService.awardXp(userId, 'vault_redeem'); } catch { /* no bloquear */ }
      }
      return { label: k.label, unlocks: unlocks.keys || [], message: unlocks.message || null, alreadyRedeemed: !!already };
    } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  }

  async getMyUnlocks(userId: string): Promise<string[]> {
    if (!userId) return [];
    const [rows] = await db.execute<RowDataPacket[]>('SELECT unlock_key FROM consumer_vault_unlocks WHERE user_id = ?', [userId]);
    return rows.map((r: any) => r.unlock_key);
  }

  private mapKey(r: any) {
    const unlocks: Unlocks = safeJson(r.unlocks) || { keys: [] };
    return {
      id: r.id, code: r.code, label: r.label, keyType: r.key_type,
      unlocks: unlocks.keys || [], message: unlocks.message || null,
      maxRedemptions: r.max_redemptions != null ? Number(r.max_redemptions) : null,
      redemptions: Number(r.redemptions) || 0,
      startsAt: r.starts_at, expiresAt: r.expires_at, status: r.status,
      createdAt: r.created_at,
    };
  }
}

export const vaultService = new VaultService();
