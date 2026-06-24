/**
 * vault.drops.service — Drops como EVENTOS (V2).
 * Ventana de tiempo + escasez de cupos (transaccional, el contador no miente) +
 * acceso gateado por Vault unlock. El claim reserva un cupo y emite update en vivo.
 */
import { v4 as uuidv4 } from 'uuid';
import { RowDataPacket } from 'mysql2';
import { db } from '../../config';
import { AppError } from '../../common/middleware';
import { emitDropUpdate } from './vault.realtime';

const safeJson = (s: any) => { if (s == null) return null; if (typeof s !== 'string') return s; try { return JSON.parse(s); } catch { return null; } };

export type DropState = 'upcoming' | 'live' | 'sold_out' | 'ended' | 'cancelled';

function computeState(d: any, now = Date.now()): DropState {
  if (d.status === 'cancelled') return 'cancelled';
  const starts = new Date(d.starts_at).getTime();
  const ends = new Date(d.ends_at).getTime();
  if (now < starts) return 'upcoming';
  if (now > ends) return 'ended';
  if (Number(d.slots_taken) >= Number(d.total_slots)) return 'sold_out';
  return 'live';
}

class DropsService {
  private map(d: any, extra: { state?: DropState; hasAccess?: boolean; claimed?: boolean } = {}) {
    return {
      id: d.id, title: d.title, subtitle: d.subtitle ?? null, imageUrl: d.image_url ?? null,
      requiresUnlock: d.requires_unlock ?? null,
      startsAt: d.starts_at, endsAt: d.ends_at,
      totalSlots: Number(d.total_slots) || 0, slotsTaken: Number(d.slots_taken) || 0,
      slotsLeft: Math.max(0, (Number(d.total_slots) || 0) - (Number(d.slots_taken) || 0)),
      productRef: safeJson(d.product_ref), status: d.status,
      state: extra.state ?? computeState(d),
      hasAccess: extra.hasAccess, claimed: extra.claimed,
      createdAt: d.created_at,
    };
  }

  // ── Admin ──────────────────────────────────────────────────────────────────
  async adminCreate(data: any, createdBy?: string | null) {
    const title = String(data?.title || '').trim();
    if (!title) throw new AppError('El título del drop es requerido', 400);
    const startsAt = data?.startsAt ? new Date(data.startsAt) : null;
    const endsAt = data?.endsAt ? new Date(data.endsAt) : null;
    if (!startsAt || isNaN(startsAt.getTime())) throw new AppError('Fecha de inicio inválida', 400);
    if (!endsAt || isNaN(endsAt.getTime())) throw new AppError('Fecha de fin inválida', 400);
    if (endsAt.getTime() <= startsAt.getTime()) throw new AppError('El fin debe ser después del inicio', 400);
    const totalSlots = Math.max(1, Math.floor(Number(data?.totalSlots) || 0));
    if (!totalSlots) throw new AppError('Define los cupos totales', 400);
    const id = uuidv4();
    await db.execute(
      `INSERT INTO drops (id, tenant_id, title, subtitle, image_url, requires_unlock, starts_at, ends_at, total_slots, product_ref, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?)`,
      [id, data?.tenantId || null, title, data?.subtitle?.trim() || null, data?.imageUrl?.trim() || null,
       data?.requiresUnlock?.trim() || null, startsAt, endsAt, totalSlots,
       data?.productRef ? JSON.stringify(data.productRef) : null, createdBy || null]
    );
    return this.adminGet(id);
  }

  async adminGet(id: string) {
    const [rows] = await db.execute<RowDataPacket[]>('SELECT * FROM drops WHERE id = ? LIMIT 1', [id]);
    return rows[0] ? this.map(rows[0]) : null;
  }

  async adminList() {
    const [rows] = await db.execute<RowDataPacket[]>('SELECT * FROM drops ORDER BY starts_at DESC LIMIT 200');
    return rows.map((d: any) => this.map(d));
  }

  async adminUpdate(id: string, patch: any) {
    const sets: string[] = []; const args: any[] = [];
    if (patch?.status !== undefined) { sets.push('status = ?'); args.push(patch.status === 'cancelled' ? 'cancelled' : 'scheduled'); }
    if (patch?.title !== undefined) { sets.push('title = ?'); args.push(String(patch.title).trim()); }
    if (patch?.subtitle !== undefined) { sets.push('subtitle = ?'); args.push(patch.subtitle?.trim() || null); }
    if (patch?.imageUrl !== undefined) { sets.push('image_url = ?'); args.push(patch.imageUrl?.trim() || null); }
    if (patch?.requiresUnlock !== undefined) { sets.push('requires_unlock = ?'); args.push(patch.requiresUnlock?.trim() || null); }
    if (patch?.startsAt !== undefined) { sets.push('starts_at = ?'); args.push(new Date(patch.startsAt)); }
    if (patch?.endsAt !== undefined) { sets.push('ends_at = ?'); args.push(new Date(patch.endsAt)); }
    if (patch?.totalSlots !== undefined) { sets.push('total_slots = ?'); args.push(Math.max(1, Math.floor(Number(patch.totalSlots) || 1))); }
    if (sets.length === 0) return this.adminGet(id);
    args.push(id);
    const [r] = await db.execute(`UPDATE drops SET ${sets.join(', ')} WHERE id = ?`, args);
    if ((r as any).affectedRows === 0) throw new AppError('Drop no encontrado', 404);
    return this.adminGet(id);
  }

  // ── Consumidor ───────────────────────────────────────────────────────────
  private async userUnlocks(userId: string): Promise<Set<string>> {
    const [rows] = await db.execute<RowDataPacket[]>('SELECT unlock_key FROM consumer_vault_unlocks WHERE user_id = ?', [userId]);
    return new Set(rows.map((r: any) => r.unlock_key));
  }
  private async userClaims(userId: string): Promise<Set<string>> {
    const [rows] = await db.execute<RowDataPacket[]>('SELECT drop_id FROM drop_claims WHERE user_id = ?', [userId]);
    return new Set(rows.map((r: any) => r.drop_id));
  }

  /** Drops vigentes (no terminados, no cancelados) para el usuario, con acceso/estado/claim. */
  async listForUser(userId: string) {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT * FROM drops WHERE status = 'scheduled' AND ends_at > NOW() ORDER BY starts_at ASC LIMIT 50`
    );
    const [unlocks, claims] = await Promise.all([this.userUnlocks(userId), this.userClaims(userId)]);
    return rows.map((d: any) => this.map(d, {
      hasAccess: !d.requires_unlock || unlocks.has(d.requires_unlock),
      claimed: claims.has(d.id),
    }));
  }

  async getForUser(id: string, userId: string) {
    const [rows] = await db.execute<RowDataPacket[]>('SELECT * FROM drops WHERE id = ? LIMIT 1', [id]);
    const d = rows[0];
    if (!d) throw new AppError('Drop no encontrado', 404);
    const [unlocks, claims] = await Promise.all([this.userUnlocks(userId), this.userClaims(userId)]);
    return this.map(d, { hasAccess: !d.requires_unlock || unlocks.has(d.requires_unlock), claimed: claims.has(d.id) });
  }

  /** Reclama un cupo. Transaccional (lock real) + idempotente por (drop,user). */
  async claim(userId: string, dropId: string) {
    if (!userId) throw new AppError('Usuario no autenticado', 401);
    const conn = await (db as any).getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query('SELECT * FROM drops WHERE id = ? LIMIT 1 FOR UPDATE', [dropId]);
      const d = (rows as any[])[0];
      if (!d) throw new AppError('Drop no encontrado', 404);
      if (d.status === 'cancelled') throw new AppError('Este drop fue cancelado', 410);
      const now = Date.now();
      if (now < new Date(d.starts_at).getTime()) throw new AppError('El drop aún no abre', 425);
      if (now > new Date(d.ends_at).getTime()) throw new AppError('El drop ya cerró', 410);

      // Acceso (Vault unlock requerido)
      if (d.requires_unlock) {
        const [u] = await conn.query('SELECT 1 FROM consumer_vault_unlocks WHERE user_id = ? AND unlock_key = ? LIMIT 1', [userId, d.requires_unlock]);
        if (!(u as any[])[0]) throw new AppError('Necesitas el Access Pass de este drop', 403);
      }

      // ¿ya reclamó? → idempotente
      const [prev] = await conn.query('SELECT id FROM drop_claims WHERE drop_id = ? AND user_id = ? LIMIT 1', [dropId, userId]);
      if ((prev as any[])[0]) {
        await conn.commit();
        const soldOut = Number(d.slots_taken) >= Number(d.total_slots);
        return { claimed: true, alreadyClaimed: true, slotsTaken: Number(d.slots_taken), totalSlots: Number(d.total_slots), soldOut };
      }

      if (Number(d.slots_taken) >= Number(d.total_slots)) throw new AppError('¡Se agotaron los cupos!', 409);

      await conn.query('INSERT INTO drop_claims (id, drop_id, user_id) VALUES (?, ?, ?)', [uuidv4(), dropId, userId]);
      await conn.query('UPDATE drops SET slots_taken = slots_taken + 1 WHERE id = ?', [dropId]);
      const slotsTaken = Number(d.slots_taken) + 1;
      const totalSlots = Number(d.total_slots);
      await conn.commit();

      const soldOut = slotsTaken >= totalSlots;
      emitDropUpdate(dropId, { slotsTaken, totalSlots, soldOut });
      // Logros (V3): primer drop → Drop Hunter; 5 drops → Drop Legend.
      try {
        const { achievementsService } = await import('../achievements/achievements.service');
        await achievementsService.award(userId, 'drop_hunter', 'drop');
        if (await achievementsService.countDropClaims(userId) >= 5) await achievementsService.award(userId, 'drop_legend', 'drop');
        const { gamificationService } = await import('../gamification/gamification.service');
        await gamificationService.awardXp(userId, 'drop_claim');
      } catch { /* no bloquear el claim */ }
      return { claimed: true, alreadyClaimed: false, slotsTaken, totalSlots, soldOut, productRef: safeJson(d.product_ref) };
    } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  }

  /** Id del cupo reservado por el usuario en un drop (para el checkout). */
  async getClaimId(userId: string, dropId: string): Promise<string | null> {
    const [rows] = await db.execute<RowDataPacket[]>('SELECT id FROM drop_claims WHERE drop_id = ? AND user_id = ? LIMIT 1', [dropId, userId]);
    return (rows[0] as any)?.id ?? null;
  }

  /** Pago aprobado de un cupo: marca convertido + comisión al curador (F3c). */
  async convertClaim(claimId: string, gatewayPaymentId?: string | null): Promise<void> {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT c.user_id, c.status, d.id AS drop_id, d.requires_unlock, d.product_ref
         FROM drop_claims c JOIN drops d ON d.id = c.drop_id WHERE c.id = ? LIMIT 1`, [claimId]
    );
    const r: any = rows[0];
    if (!r || r.status === 'converted') return;
    await db.execute("UPDATE drop_claims SET status = 'converted' WHERE id = ?", [claimId]);

    // Comisión al curador: si el acceso del usuario vino de una Vault Key de un afiliado.
    try {
      if (!r.requires_unlock) return;
      const [keyRows] = await db.execute<RowDataPacket[]>(
        `SELECT k.created_by_affiliate_id AS affId
           FROM consumer_vault_unlocks u JOIN vault_keys k ON k.id = u.vault_key_id
          WHERE u.user_id = ? AND u.unlock_key = ? AND k.created_by_affiliate_id IS NOT NULL
          ORDER BY u.created_at ASC LIMIT 1`, [r.user_id, r.requires_unlock]
      );
      const affId = (keyRows[0] as any)?.affId;
      if (!affId) return;
      const pr = safeJson(r.product_ref) || {};
      const commission = Math.round((Number(pr?.priceCop) || 0) * 0.10); // 10% al curador
      if (commission > 0) {
        const { affiliatesService } = await import('../affiliates/affiliates.service');
        await affiliatesService.creditVaultKeyConversion(affId, commission, `Conversión drop ${r.drop_id} (pago ${gatewayPaymentId || '—'})`);
      }
    } catch (e) { console.warn('[drops] comisión curador:', (e as any)?.message); }
  }
}

export const dropsService = new DropsService();
