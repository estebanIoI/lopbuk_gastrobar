/**
 * gamification.service — XP, niveles y ligas (P2).
 * Cada acción suma XP (consumer_xp_log). El nivel sale del XP acumulado (curva
 * triangular) y la LIGA del XP de los últimos 7 días (competencia semanal).
 * `awardXp` se llama de forma defensiva desde los flujos (check, logro, drop…).
 */
import { v4 as uuidv4 } from 'uuid';
import { RowDataPacket } from 'mysql2';
import { db } from '../../config';

export const XP_REWARDS: Record<string, number> = {
  daily_check: 10, workout: 25, streak_day: 5, achievement: 50,
  drop_claim: 30, vault_redeem: 40, coach_program: 100, review: 20,
  challenge_join: 15, challenge_won: 120, onboarding: 40,
};

export const LEAGUES = [
  { key: 'bronce', label: 'Bronce', emoji: '🥉', min: 0 },
  { key: 'plata', label: 'Plata', emoji: '🥈', min: 150 },
  { key: 'oro', label: 'Oro', emoji: '🥇', min: 400 },
  { key: 'platino', label: 'Platino', emoji: '💎', min: 900 },
  { key: 'diamante', label: 'Diamante', emoji: '👑', min: 2000 },
];

/** Nivel desde XP total (cada nivel L cuesta 100·L; curva triangular). */
function levelFromXp(xp: number) {
  let level = 1, need = 100, acc = 0;
  while (acc + need <= xp) { acc += need; level++; need = 100 * level; }
  return { level, intoLevel: xp - acc, levelSpan: need, nextLevelXp: acc + need };
}
function leagueFromWeekly(weeklyXp: number) {
  let l = LEAGUES[0];
  for (const x of LEAGUES) if (weeklyXp >= x.min) l = x;
  const idx = LEAGUES.findIndex(x => x.key === l.key);
  const next = LEAGUES[idx + 1] || null;
  return { ...l, next: next ? { label: next.label, emoji: next.emoji, toGo: next.min - weeklyXp } : null };
}

class GamificationService {
  /** Suma XP por una acción. Defensivo: nunca lanza al flujo origen. */
  async awardXp(userId: string, reason: string, amountOverride?: number): Promise<void> {
    const amount = amountOverride ?? XP_REWARDS[reason];
    if (!userId || !amount || amount <= 0) return;
    try {
      await db.execute('INSERT INTO consumer_xp_log (id, user_id, amount, reason) VALUES (?, ?, ?, ?)', [uuidv4(), userId, amount, reason]);
    } catch { /* tabla aún no migrada: ignorar */ }
  }

  async getXpProfile(userId: string) {
    const [tot] = await db.execute<RowDataPacket[]>('SELECT COALESCE(SUM(amount),0) AS xp FROM consumer_xp_log WHERE user_id = ?', [userId]);
    const [wk] = await db.execute<RowDataPacket[]>("SELECT COALESCE(SUM(amount),0) AS xp FROM consumer_xp_log WHERE user_id = ? AND created_at >= (NOW() - INTERVAL 7 DAY)", [userId]);
    const totalXp = Number((tot[0] as any)?.xp) || 0;
    const weeklyXp = Number((wk[0] as any)?.xp) || 0;
    const lv = levelFromXp(totalXp);
    return {
      totalXp, weeklyXp,
      level: lv.level, intoLevel: lv.intoLevel, levelSpan: lv.levelSpan,
      levelProgress: Math.round((lv.intoLevel / lv.levelSpan) * 100),
      league: leagueFromWeekly(weeklyXp),
    };
  }

  /** Liga semanal: top usuarios por XP de los últimos 7 días + mi posición. */
  async getLeagueBoard(userId: string, limit = 20) {
    const lim = Math.min(100, Math.max(1, Math.floor(limit) || 20));
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT x.user_id, u.name, SUM(x.amount) AS xp
         FROM consumer_xp_log x LEFT JOIN users u ON u.id = x.user_id
        WHERE x.created_at >= (NOW() - INTERVAL 7 DAY)
        GROUP BY x.user_id, u.name
        ORDER BY xp DESC LIMIT 200`
    );
    const ranked = (rows as any[]).map((r, i) => ({
      rank: i + 1, id: r.user_id, name: (r.name || 'Atleta').split(' ')[0],
      xp: Number(r.xp) || 0, league: leagueFromWeekly(Number(r.xp) || 0).label, isMe: r.user_id === userId,
    }));
    const me = ranked.find(r => r.isMe) || null;
    return { top: ranked.slice(0, lim), me: me ? { rank: me.rank, xp: me.xp, league: me.league } : null, total: ranked.length };
  }
}

export const gamificationService = new GamificationService();
