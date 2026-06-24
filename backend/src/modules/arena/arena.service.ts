/**
 * arena.service — Community Layer (F5.1).
 * Leaderboard social (Community Score) + retos de temporada (seasonal challenges).
 * El Community Score mezcla actividad (días activos 30d), logros y drops reclamados.
 * Nombres de pila por privacidad.
 */
import { v4 as uuidv4 } from 'uuid';
import { RowDataPacket } from 'mysql2';
import { db } from '../../config';
import { AppError } from '../../common/middleware';

const firstName = (n?: string) => (n || 'Atleta').trim().split(' ')[0];
function communityScore(activeDays: number, achievements: number, drops: number): number {
  return Math.round((Number(activeDays) || 0) * 10 + (Number(achievements) || 0) * 15 + (Number(drops) || 0) * 8);
}

class ArenaService {
  // ── Leaderboard global ─────────────────────────────────────────────────────
  async getLeaderboard(userId: string, limit = 20) {
    const lim = Math.min(100, Math.max(1, Math.floor(limit) || 20));
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT u.id, u.name,
              (SELECT COUNT(*) FROM consumer_streak_days s WHERE s.user_id = u.id AND s.day >= (CURDATE() - INTERVAL 30 DAY)) AS activeDays,
              (SELECT COUNT(*) FROM consumer_achievements a WHERE a.user_id = u.id) AS achievements,
              (SELECT COUNT(*) FROM drop_claims d WHERE d.user_id = u.id) AS drops
         FROM users u
        WHERE (
          EXISTS (SELECT 1 FROM consumer_streak_days s WHERE s.user_id = u.id) OR
          EXISTS (SELECT 1 FROM consumer_achievements a WHERE a.user_id = u.id) OR
          EXISTS (SELECT 1 FROM drop_claims d WHERE d.user_id = u.id)
        )
        LIMIT 1000`
    );
    const ranked = (rows as any[])
      .map(r => ({
        id: r.id, name: firstName(r.name),
        activeDays: Number(r.activeDays) || 0, achievements: Number(r.achievements) || 0, drops: Number(r.drops) || 0,
        score: communityScore(r.activeDays, r.achievements, r.drops),
      }))
      .sort((a, b) => b.score - a.score)
      .map((r, i) => ({ ...r, rank: i + 1 }));

    const meRow = ranked.find(r => r.id === userId) || null;
    const top = ranked.slice(0, lim).map(({ id, ...rest }) => ({ ...rest, isMe: id === userId }));
    const me = meRow ? { rank: meRow.rank, score: meRow.score, name: meRow.name } : null;
    return { top, me, total: ranked.length };
  }

  // ── Retos de temporada ─────────────────────────────────────────────────────
  private async userProgress(userId: string, ch: any): Promise<number> {
    const start = ch.starts_at, end = ch.ends_at;
    if (ch.metric === 'drops') {
      const [r] = await db.execute<RowDataPacket[]>('SELECT COUNT(*) AS c FROM drop_claims WHERE user_id = ? AND created_at BETWEEN ? AND ?', [userId, start, end]);
      return Number((r[0] as any)?.c) || 0;
    }
    if (ch.metric === 'achievements') {
      const [r] = await db.execute<RowDataPacket[]>('SELECT COUNT(*) AS c FROM consumer_achievements WHERE user_id = ? AND unlocked_at BETWEEN ? AND ?', [userId, start, end]);
      return Number((r[0] as any)?.c) || 0;
    }
    // streak: días activos dentro de la ventana
    const [r] = await db.execute<RowDataPacket[]>('SELECT COUNT(*) AS c FROM consumer_streak_days WHERE user_id = ? AND day BETWEEN DATE(?) AND DATE(?)', [userId, start, end]);
    return Number((r[0] as any)?.c) || 0;
  }

  private mapChallenge(c: any) {
    return {
      id: c.id, title: c.title, description: c.description ?? null, metric: c.metric,
      goalValue: Number(c.goal_value) || 0, reward: c.reward ?? null, rewardUnlock: c.reward_unlock ?? null,
      startsAt: c.starts_at, endsAt: c.ends_at, status: c.status, settledAt: c.settled_at ?? null, createdAt: c.created_at,
    };
  }

  async listActive(userId: string) {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT * FROM seasonal_challenges WHERE status = 'active' AND ends_at > NOW() ORDER BY ends_at ASC LIMIT 30`
    );
    const out: any[] = [];
    for (const c of rows as any[]) {
      const [[p]]: any = await db.execute('SELECT id FROM challenge_participants WHERE challenge_id = ? AND user_id = ? LIMIT 1', [c.id, userId]);
      const [[cnt]]: any = await db.execute('SELECT COUNT(*) AS n FROM challenge_participants WHERE challenge_id = ?', [c.id]);
      const joined = !!p;
      const progress = joined ? await this.userProgress(userId, c) : 0;
      out.push({ ...this.mapChallenge(c), joined, progress, participants: Number(cnt?.n) || 0, now: new Date().toISOString() });
    }
    return out;
  }

  async join(userId: string, challengeId: string) {
    const [rows] = await db.execute<RowDataPacket[]>("SELECT * FROM seasonal_challenges WHERE id = ? LIMIT 1", [challengeId]);
    const c = rows[0] as any;
    if (!c) throw new AppError('Reto no encontrado', 404);
    if (c.status !== 'active' || new Date(c.ends_at).getTime() < Date.now()) throw new AppError('Este reto ya cerró', 410);
    const [r] = await db.execute('INSERT IGNORE INTO challenge_participants (id, challenge_id, user_id) VALUES (?, ?, ?)', [uuidv4(), challengeId, userId]);
    if ((r as any).affectedRows > 0) { try { const { gamificationService } = await import('../gamification/gamification.service'); await gamificationService.awardXp(userId, 'challenge_join'); } catch { /* no bloquear */ } }
    return { joined: true };
  }

  async challengeLeaderboard(challengeId: string, limit = 20) {
    const lim = Math.min(100, Math.max(1, Math.floor(limit) || 20));
    const [rows] = await db.execute<RowDataPacket[]>("SELECT * FROM seasonal_challenges WHERE id = ? LIMIT 1", [challengeId]);
    const c = rows[0] as any;
    if (!c) throw new AppError('Reto no encontrado', 404);
    const [parts] = await db.execute<RowDataPacket[]>(
      `SELECT p.user_id, u.name FROM challenge_participants p LEFT JOIN users u ON u.id = p.user_id WHERE p.challenge_id = ? LIMIT 500`, [challengeId]
    );
    const scored: any[] = [];
    for (const p of parts as any[]) {
      const progress = await this.userProgress(p.user_id, c);
      scored.push({ name: firstName(p.name), progress });
    }
    return {
      challenge: this.mapChallenge(c),
      board: scored.sort((a, b) => b.progress - a.progress).slice(0, lim).map((r, i) => ({ ...r, rank: i + 1 })),
    };
  }

  // ── Admin ───────────────────────────────────────────────────────────────────
  async adminCreate(data: any, createdBy?: string | null) {
    const title = String(data?.title || '').trim();
    if (!title) throw new AppError('El título es requerido', 400);
    const metric = ['streak', 'drops', 'achievements'].includes(data?.metric) ? data.metric : 'streak';
    const startsAt = data?.startsAt ? new Date(data.startsAt) : null;
    const endsAt = data?.endsAt ? new Date(data.endsAt) : null;
    if (!startsAt || isNaN(startsAt.getTime()) || !endsAt || isNaN(endsAt.getTime())) throw new AppError('Fechas inválidas', 400);
    if (endsAt.getTime() <= startsAt.getTime()) throw new AppError('El fin debe ser después del inicio', 400);
    const goalValue = Math.max(1, Math.floor(Number(data?.goalValue) || 7));
    const rewardUnlock = data?.rewardUnlock ? String(data.rewardUnlock).trim() : null;
    const id = uuidv4();
    await db.execute(
      `INSERT INTO seasonal_challenges (id, title, description, metric, goal_value, reward, reward_unlock, starts_at, ends_at, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [id, title, data?.description?.trim() || null, metric, goalValue, data?.reward?.trim() || null, rewardUnlock, startsAt, endsAt, createdBy || null]
    );
    const [rows] = await db.execute<RowDataPacket[]>('SELECT * FROM seasonal_challenges WHERE id = ? LIMIT 1', [id]);
    return this.mapChallenge(rows[0]);
  }

  async adminList() {
    const [rows] = await db.execute<RowDataPacket[]>('SELECT * FROM seasonal_challenges ORDER BY starts_at DESC LIMIT 100');
    return rows.map((c: any) => this.mapChallenge(c));
  }

  async adminUpdate(id: string, patch: any) {
    const sets: string[] = []; const args: any[] = [];
    if (patch?.status !== undefined) { sets.push('status = ?'); args.push(patch.status === 'cancelled' ? 'cancelled' : 'active'); }
    if (patch?.title !== undefined) { sets.push('title = ?'); args.push(String(patch.title).trim()); }
    if (patch?.reward !== undefined) { sets.push('reward = ?'); args.push(patch.reward?.trim() || null); }
    if (patch?.rewardUnlock !== undefined) { sets.push('reward_unlock = ?'); args.push(patch.rewardUnlock ? String(patch.rewardUnlock).trim() : null); }
    if (patch?.endsAt !== undefined) { sets.push('ends_at = ?'); args.push(new Date(patch.endsAt)); }
    if (sets.length === 0) { const [r] = await db.execute<RowDataPacket[]>('SELECT * FROM seasonal_challenges WHERE id = ? LIMIT 1', [id]); return r[0] ? this.mapChallenge(r[0]) : null; }
    args.push(id);
    const [res] = await db.execute(`UPDATE seasonal_challenges SET ${sets.join(', ')} WHERE id = ?`, args);
    if ((res as any).affectedRows === 0) throw new AppError('Reto no encontrado', 404);
    const [r] = await db.execute<RowDataPacket[]>('SELECT * FROM seasonal_challenges WHERE id = ? LIMIT 1', [id]);
    return this.mapChallenge(r[0]);
  }

  /** Liquida un reto: premia a quienes alcanzaron la meta (unlock + badge + feed). Idempotente. */
  async settleChallenge(challengeId: string) {
    const [rows] = await db.execute<RowDataPacket[]>('SELECT * FROM seasonal_challenges WHERE id = ? LIMIT 1', [challengeId]);
    const c = rows[0] as any;
    if (!c) throw new AppError('Reto no encontrado', 404);
    if (c.settled_at) return { settled: true, alreadySettled: true, winners: 0 };
    const [parts] = await db.execute<RowDataPacket[]>('SELECT user_id FROM challenge_participants WHERE challenge_id = ?', [challengeId]);
    let winners = 0;
    for (const p of parts as any[]) {
      const progress = await this.userProgress(p.user_id, c);
      if (progress < Number(c.goal_value)) continue;
      winners++;
      if (c.reward_unlock) {
        await db.execute('INSERT IGNORE INTO consumer_vault_unlocks (id, user_id, unlock_key, vault_key_id) VALUES (?, ?, ?, NULL)', [uuidv4(), p.user_id, String(c.reward_unlock)]);
      }
      try {
        const { achievementsService } = await import('../achievements/achievements.service');
        await achievementsService.award(p.user_id, 'challenge_champion', 'challenge');
        const { gamificationService } = await import('../gamification/gamification.service');
        await gamificationService.awardXp(p.user_id, 'challenge_won');
      } catch { /* no bloquear */ }
      await this.autoFeed(p.user_id, 'challenge', `🏆 completó el reto "${c.title}"`, { challengeId });
    }
    await db.execute('UPDATE seasonal_challenges SET settled_at = NOW() WHERE id = ?', [challengeId]);
    return { settled: true, winners };
  }

  // ── Guilds / equipos (F5.2) ─────────────────────────────────────────────────
  private async userScore(userId: string): Promise<number> {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT (SELECT COUNT(*) FROM consumer_streak_days s WHERE s.user_id = ? AND s.day >= (CURDATE() - INTERVAL 30 DAY)) AS activeDays,
              (SELECT COUNT(*) FROM consumer_achievements a WHERE a.user_id = ?) AS achievements,
              (SELECT COUNT(*) FROM drop_claims d WHERE d.user_id = ?) AS drops`, [userId, userId, userId]
    );
    const r: any = rows[0] || {};
    return communityScore(r.activeDays, r.achievements, r.drops);
  }

  async createGuild(userId: string, data: { name?: string; tagline?: string; emoji?: string }) {
    const name = String(data?.name || '').trim();
    if (name.length < 3) throw new AppError('El nombre del guild debe tener al menos 3 caracteres', 400);
    const [dup] = await db.execute<RowDataPacket[]>('SELECT id FROM guilds WHERE name = ? LIMIT 1', [name]);
    if (dup[0]) throw new AppError('Ya existe un guild con ese nombre', 409);
    const id = uuidv4();
    await db.execute('INSERT INTO guilds (id, name, tagline, emoji, owner_user_id, members_count) VALUES (?, ?, ?, ?, ?, 0)',
      [id, name, data?.tagline?.trim() || null, (data?.emoji || '🛡️').slice(0, 8), userId]);
    await this.joinGuild(userId, id);
    return this.getMyGuild(userId);
  }

  async joinGuild(userId: string, guildId: string) {
    const [g] = await db.execute<RowDataPacket[]>('SELECT id FROM guilds WHERE id = ? LIMIT 1', [guildId]);
    if (!g[0]) throw new AppError('Guild no encontrado', 404);
    // un usuario pertenece a un guild a la vez → si cambia, decrementa el anterior
    const [prev] = await db.execute<RowDataPacket[]>('SELECT guild_id FROM guild_members WHERE user_id = ? LIMIT 1', [userId]);
    const prevGuild = (prev[0] as any)?.guild_id;
    if (prevGuild === guildId) return { joined: true };
    if (prevGuild) await db.execute('UPDATE guilds SET members_count = GREATEST(0, members_count - 1) WHERE id = ?', [prevGuild]);
    await db.execute('INSERT INTO guild_members (id, guild_id, user_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE guild_id = VALUES(guild_id), joined_at = NOW()', [uuidv4(), guildId, userId]);
    await db.execute('UPDATE guilds SET members_count = members_count + 1 WHERE id = ?', [guildId]);
    return { joined: true };
  }

  async leaveGuild(userId: string) {
    const [prev] = await db.execute<RowDataPacket[]>('SELECT guild_id FROM guild_members WHERE user_id = ? LIMIT 1', [userId]);
    const prevGuild = (prev[0] as any)?.guild_id;
    if (!prevGuild) return { left: true };
    await db.execute('DELETE FROM guild_members WHERE user_id = ?', [userId]);
    await db.execute('UPDATE guilds SET members_count = GREATEST(0, members_count - 1) WHERE id = ?', [prevGuild]);
    return { left: true };
  }

  async listGuilds(userId: string, limit = 20) {
    const lim = Math.min(50, Math.max(1, Math.floor(limit) || 20));
    const [rows] = await db.execute<RowDataPacket[]>('SELECT * FROM guilds ORDER BY members_count DESC LIMIT 200');
    const [mine] = await db.execute<RowDataPacket[]>('SELECT guild_id FROM guild_members WHERE user_id = ? LIMIT 1', [userId]);
    const myGuildId = (mine[0] as any)?.guild_id || null;
    // score del guild = suma de scores de sus miembros (limitado a guilds con miembros)
    const out: any[] = [];
    for (const g of rows as any[]) {
      const [mem] = await db.execute<RowDataPacket[]>('SELECT user_id FROM guild_members WHERE guild_id = ? LIMIT 100', [g.id]);
      let score = 0;
      for (const m of mem as any[]) score += await this.userScore(m.user_id);
      out.push({ id: g.id, name: g.name, tagline: g.tagline, emoji: g.emoji, members: Number(g.members_count) || 0, score, isMine: g.id === myGuildId });
    }
    out.sort((a, b) => b.score - a.score);
    return { guilds: out.slice(0, lim).map((g, i) => ({ ...g, rank: i + 1 })), myGuildId };
  }

  async getMyGuild(userId: string) {
    const [mine] = await db.execute<RowDataPacket[]>(
      `SELECT g.* FROM guild_members gm JOIN guilds g ON g.id = gm.guild_id WHERE gm.user_id = ? LIMIT 1`, [userId]
    );
    const g = mine[0] as any;
    if (!g) return null;
    const [mem] = await db.execute<RowDataPacket[]>(
      `SELECT m.user_id, u.name FROM guild_members m LEFT JOIN users u ON u.id = m.user_id WHERE m.guild_id = ? LIMIT 100`, [g.id]
    );
    const members: any[] = [];
    let total = 0;
    for (const m of mem as any[]) { const sc = await this.userScore(m.user_id); total += sc; members.push({ name: firstName(m.name), score: sc, isMe: m.user_id === userId }); }
    members.sort((a, b) => b.score - a.score);
    return { id: g.id, name: g.name, tagline: g.tagline, emoji: g.emoji, members: members.map((m, i) => ({ ...m, rank: i + 1 })), totalScore: total };
  }

  // ── Social feed (F5.3) ──────────────────────────────────────────────────────
  /** Post automático del sistema (logros, retos…). Defensivo. */
  async autoFeed(userId: string, kind: 'progress' | 'achievement' | 'challenge' | 'milestone', body: string, metadata?: any) {
    try {
      await db.execute('INSERT INTO arena_feed (id, user_id, kind, body, metadata) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), userId, kind, body.slice(0, 500), metadata ? JSON.stringify(metadata) : null]);
    } catch { /* no bloquear el flujo origen */ }
  }

  async postFeed(userId: string, data: { body?: string; photoUrl?: string }) {
    const body = String(data?.body || '').trim();
    if (!body && !data?.photoUrl) throw new AppError('Escribe algo o agrega una foto', 400);
    const id = uuidv4();
    await db.execute('INSERT INTO arena_feed (id, user_id, kind, body, photo_url) VALUES (?, ?, ?, ?, ?)',
      [id, userId, 'post', body.slice(0, 500) || null, data?.photoUrl?.trim() || null]);
    return { id };
  }

  async listFeed(userId: string, limit = 30) {
    const lim = Math.min(80, Math.max(1, Math.floor(limit) || 30));
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT f.id, f.user_id, f.kind, f.body, f.photo_url, f.likes, f.comments_count, f.created_at, u.name,
              EXISTS(SELECT 1 FROM arena_feed_likes l WHERE l.feed_id = f.id AND l.user_id = ?) AS liked
         FROM arena_feed f LEFT JOIN users u ON u.id = f.user_id
        ORDER BY f.created_at DESC LIMIT ${lim}`, [userId]
    );
    return (rows as any[]).map(r => ({
      id: r.id, kind: r.kind, body: r.body, photoUrl: r.photo_url, likes: Number(r.likes) || 0,
      commentsCount: Number(r.comments_count) || 0,
      liked: !!r.liked, author: firstName(r.name), isMe: r.user_id === userId, createdAt: r.created_at,
    }));
  }

  async addComment(userId: string, feedId: string, body: string) {
    const text = String(body || '').trim();
    if (!text) throw new AppError('Escribe un comentario', 400);
    const [f] = await db.execute<RowDataPacket[]>('SELECT id FROM arena_feed WHERE id = ? LIMIT 1', [feedId]);
    if (!f[0]) throw new AppError('Publicación no encontrada', 404);
    const id = uuidv4();
    await db.execute('INSERT INTO arena_feed_comments (id, feed_id, user_id, body) VALUES (?, ?, ?, ?)', [id, feedId, userId, text.slice(0, 400)]);
    await db.execute('UPDATE arena_feed SET comments_count = comments_count + 1 WHERE id = ?', [feedId]);
    return { id };
  }

  async listComments(feedId: string, userId: string, limit = 50) {
    const lim = Math.min(100, Math.max(1, Math.floor(limit) || 50));
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT c.id, c.user_id, c.body, c.created_at, u.name
         FROM arena_feed_comments c LEFT JOIN users u ON u.id = c.user_id
        WHERE c.feed_id = ? ORDER BY c.created_at ASC LIMIT ${lim}`, [feedId]
    );
    return (rows as any[]).map(r => ({ id: r.id, author: firstName(r.name), isMe: r.user_id === userId, body: r.body, createdAt: r.created_at }));
  }

  async toggleLike(userId: string, feedId: string) {
    const [ex] = await db.execute<RowDataPacket[]>('SELECT id FROM arena_feed_likes WHERE feed_id = ? AND user_id = ? LIMIT 1', [feedId, userId]);
    if (ex[0]) {
      await db.execute('DELETE FROM arena_feed_likes WHERE feed_id = ? AND user_id = ?', [feedId, userId]);
      await db.execute('UPDATE arena_feed SET likes = GREATEST(0, likes - 1) WHERE id = ?', [feedId]);
      return { liked: false };
    }
    try { await db.execute('INSERT INTO arena_feed_likes (id, feed_id, user_id) VALUES (?, ?, ?)', [uuidv4(), feedId, userId]); }
    catch { return { liked: true }; }
    await db.execute('UPDATE arena_feed SET likes = likes + 1 WHERE id = ?', [feedId]);
    return { liked: true };
  }
}

export const arenaService = new ArenaService();
