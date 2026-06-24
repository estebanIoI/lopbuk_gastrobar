/**
 * achievements.service — Logros de cliente (V3).
 * Badges que retienen e identifican (Fundador, Drop Hunter, Discípulo…).
 * `award` es idempotente (INSERT IGNORE por UNIQUE user+code). Se otorgan
 * desde los flujos (vault, drops, coach, legend) con import dinámico defensivo.
 */
import { v4 as uuidv4 } from 'uuid';
import { RowDataPacket } from 'mysql2';
import { db } from '../../config';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface AchievementDef { code: string; label: string; emoji: string; desc: string; rarity: Rarity }

/** Catálogo estático de logros. */
export const ACHIEVEMENTS: AchievementDef[] = [
  { code: 'founder', label: 'Fundador', emoji: '🏛️', desc: 'De los primeros en creer en DAIMUZ.', rarity: 'legendary' },
  { code: 'legend_member', label: 'LEGEND', emoji: '👑', desc: 'Activaste tu membresía LEGEND.', rarity: 'epic' },
  { code: 'vault_initiate', label: 'Iniciado del Vault', emoji: '🗝️', desc: 'Canjeaste tu primera Vault Key.', rarity: 'rare' },
  { code: 'drop_hunter', label: 'Drop Hunter', emoji: '🎯', desc: 'Reclamaste tu primer cupo en un drop.', rarity: 'rare' },
  { code: 'drop_legend', label: 'Drop Legend', emoji: '🔥', desc: 'Reclamaste 5 drops. Imparable.', rarity: 'epic' },
  { code: 'coach_disciple', label: 'Discípulo', emoji: '🥋', desc: 'Empezaste una transformación con un coach.', rarity: 'rare' },
  { code: 'streak_warrior', label: 'Guerrero de Racha', emoji: '⚡', desc: '7 días seguidos. Disciplina pura.', rarity: 'rare' },
  { code: 'challenge_champion', label: 'Campeón', emoji: '🏆', desc: 'Completaste un reto de temporada.', rarity: 'epic' },
];

const BY_CODE = new Map(ACHIEVEMENTS.map(a => [a.code, a]));

class AchievementsService {
  getCatalog(): AchievementDef[] { return ACHIEVEMENTS; }

  /** Otorga un logro (idempotente). Devuelve true si era nuevo. */
  async award(userId: string, code: string, source?: string): Promise<boolean> {
    if (!userId || !BY_CODE.has(code)) return false;
    const [r] = await db.execute(
      'INSERT IGNORE INTO consumer_achievements (id, user_id, achievement_code, source) VALUES (?, ?, ?, ?)',
      [uuidv4(), userId, code, source || null]
    );
    const isNew = (r as any).affectedRows > 0;
    // Auto-post al feed social (F5.3) + XP (P2) cuando es un logro nuevo. Defensivo.
    if (isNew) {
      const def = BY_CODE.get(code)!;
      try { const { arenaService } = await import('../arena/arena.service'); await arenaService.autoFeed(userId, 'achievement', `${def.emoji} desbloqueó "${def.label}"`, { code }); } catch { /* no bloquear */ }
      try { const { gamificationService } = await import('../gamification/gamification.service'); await gamificationService.awardXp(userId, 'achievement'); } catch { /* no bloquear */ }
    }
    return isNew;
  }

  async getMine(userId: string) {
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT achievement_code, source, unlocked_at FROM consumer_achievements WHERE user_id = ?', [userId]
    );
    const owned = new Map(rows.map((r: any) => [r.achievement_code, r]));
    // Devuelve TODO el catálogo con estado owned (para mostrar bloqueados también).
    return ACHIEVEMENTS.map(a => ({
      ...a,
      owned: owned.has(a.code),
      unlockedAt: owned.get(a.code)?.unlocked_at ?? null,
    }));
  }

  async countDropClaims(userId: string): Promise<number> {
    const [rows] = await db.execute<RowDataPacket[]>('SELECT COUNT(*) AS c FROM drop_claims WHERE user_id = ?', [userId]);
    return Number((rows[0] as any)?.c) || 0;
  }
}

export const achievementsService = new AchievementsService();
