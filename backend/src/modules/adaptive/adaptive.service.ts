/**
 * adaptive.service — Adaptive OS (Fase 4.1).
 * El OS reacciona a las señales del usuario (racha, programa activo, feed del
 * coach, membresía, drops en vivo, cercanía a un logro) y devuelve "nudges"
 * priorizados que el Today muestra. Solo lee datos existentes; import dinámico
 * para evitar ciclos. Nunca lanza: si una señal falla, se omite.
 */
import { db } from '../../config';
import { RowDataPacket } from 'mysql2';

export interface Nudge {
  id: string;
  kind: 'coach' | 'streak' | 'drop' | 'membership' | 'achievement' | 'program' | 'predictive' | 'motivation';
  priority: number; // mayor = más arriba
  emoji: string;
  title: string;
  body: string;
  action?: { type: 'tab' | 'none'; target?: string; label?: string };
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

/**
 * Predictive commerce: estima la próxima recompra de un consumible por la
 * CADENCIA real del usuario (intervalo medio entre compras del mismo producto).
 * Historial vía customer_phone ↔ users.phone (mismo enlace que Explore).
 */
async function predictiveNudge(userId: string): Promise<Nudge | null> {
  const [u] = await db.execute<RowDataPacket[]>('SELECT phone FROM users WHERE id = ? LIMIT 1', [userId]);
  const phone = (u[0] as any)?.phone ? String((u[0] as any).phone).replace(/\D/g, '') : '';
  if (phone.length < 7) return null;
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT p.name AS name, COUNT(*) AS buys,
            DATEDIFF(NOW(), MAX(o.created_at)) AS daysSinceLast,
            DATEDIFF(MAX(o.created_at), MIN(o.created_at)) AS spanDays
       FROM storefront_order_items oi
       JOIN storefront_orders o ON o.id = oi.order_id
       LEFT JOIN products p ON p.id = oi.product_id
      WHERE REPLACE(REPLACE(o.customer_phone,' ',''),'+','') LIKE ?
      GROUP BY oi.product_id, p.name
     HAVING buys >= 2 AND spanDays > 0
      LIMIT 50`, [`%${phone}`]
  );
  let best: { name: string; daysLeft: number; ratio: number } | null = null;
  for (const r of rows as any[]) {
    if (!r.name) continue;
    const buys = Number(r.buys), span = Number(r.spanDays), since = Number(r.daysSinceLast);
    const avgInterval = span / (buys - 1);
    if (!(avgInterval > 0)) continue;
    const ratio = since / avgInterval;            // ≥1 = ya debería haber recomprado
    if (ratio < 0.7) continue;                     // aún tiene producto
    const daysLeft = Math.max(0, Math.round(avgInterval - since));
    if (!best || ratio > best.ratio) best = { name: r.name, daysLeft, ratio };
  }
  if (!best) return null;
  const body = best.daysLeft <= 0
    ? `Según tu ritmo, ya se te debió acabar. ¿Reabastecer?`
    : `Probablemente te quede${best.daysLeft === 1 ? '' : 'n'} ~${best.daysLeft} día${best.daysLeft === 1 ? '' : 's'}. Ve sobre seguro.`;
  return {
    id: 'predictive-reorder', kind: 'predictive', priority: 50, emoji: '🛒',
    title: `Reabastece tu ${best.name}`, body,
    action: { type: 'tab', target: 'explore', label: 'Comprar' },
  };
}

class AdaptiveService {
  async getNudges(userId: string): Promise<Nudge[]> {
    if (!userId) return [];
    const nudges: Nudge[] = [];

    // Señales en paralelo (cada una defensiva).
    const [streak, program, tier, liveDrops, dropClaims] = await Promise.all([
      safe(async () => (await import('../consumer-plans/consumer-plans.service')).getStreak(userId), 0),
      safe(async () => (await import('../trainers/trainers.service')).trainersService.getActiveProgram(userId), null as any),
      safe(async () => (await import('../consumer-plans/consumer-plans.service')).getUserTier(userId), null as any),
      safe(async () => (await import('../vault/vault.drops.service')).dropsService.listForUser(userId), [] as any[]),
      safe(async () => {
        const [r] = await db.execute<RowDataPacket[]>('SELECT COUNT(*) AS c FROM drop_claims WHERE user_id = ?', [userId]);
        return Number((r[0] as any)?.c) || 0;
      }, 0),
    ]);

    // 1) Coach: ¿mensajes sin leer en el programa activo?
    if (program?.bookingId) {
      const unread = await safe(async () => {
        const [r] = await db.execute<RowDataPacket[]>(
          "SELECT COUNT(*) AS c FROM coach_feed_entries WHERE booking_id = ? AND author = 'coach' AND is_read = 0", [program.bookingId]
        );
        return Number((r[0] as any)?.c) || 0;
      }, 0);
      if (unread > 0) {
        nudges.push({ id: 'coach-unread', kind: 'coach', priority: 100, emoji: '🥋',
          title: `Tu coach ${program.trainerName} te escribió`, body: `${unread} mensaje${unread === 1 ? '' : 's'} nuevo${unread === 1 ? '' : 's'} en tu programa.`,
          action: { type: 'tab', target: 'coach', label: 'Ver' } });
      } else {
        nudges.push({ id: 'program-week', kind: 'program', priority: 60, emoji: '🔥',
          title: `Programa activo · Semana ${program.week}${program.totalWeeks ? `/${program.totalWeeks}` : ''}`, body: `Sigue tu transformación con ${program.trainerName}.`,
          action: { type: 'tab', target: 'coach', label: 'Abrir' } });
      }
    }

    // 2) Drops en vivo con acceso → urgencia.
    const live = (liveDrops || []).find((d: any) => d.state === 'live' && d.hasAccess && !d.claimed);
    if (live) {
      nudges.push({ id: `drop-${live.id}`, kind: 'drop', priority: 95, emoji: '⚡',
        title: `Drop en vivo: ${live.title}`, body: live.slotsLeft <= 10 ? `¡Solo quedan ${live.slotsLeft} cupos!` : 'Reclama tu cupo antes de que cierre.',
        action: { type: 'tab', target: 'vault', label: 'Ir al drop' } });
    }

    // 3) Racha.
    if (streak === 0) {
      nudges.push({ id: 'streak-zero', kind: 'streak', priority: 70, emoji: '⚡',
        title: 'Retoma tu racha', body: 'Registra algo hoy y vuelve a encender el fuego.', action: { type: 'tab', target: 'hoy' } });
    } else if (streak >= 3) {
      nudges.push({ id: 'streak-on', kind: 'streak', priority: 40, emoji: '🔥',
        title: `Racha de ${streak} días`, body: streak >= 7 ? '¡Eres imparable! No la rompas.' : 'Vas muy bien, sigue así.', action: { type: 'none' } });
    }

    // 4) Cercanía a un logro (Drop Legend a los 5).
    if (dropClaims > 0 && dropClaims < 5) {
      nudges.push({ id: 'ach-drop-legend', kind: 'achievement', priority: 35, emoji: '🎯',
        title: 'Cerca de "Drop Legend"', body: `Te falta${5 - dropClaims === 1 ? '' : 'n'} ${5 - dropClaims} drop${5 - dropClaims === 1 ? '' : 's'} para el badge épico.`,
        action: { type: 'tab', target: 'vault' } });
    }

    // 5) Predictive commerce (recompra de consumible).
    const predictive = await safe(() => predictiveNudge(userId), null as Nudge | null);
    if (predictive) nudges.push(predictive);

    // 5b) Motivación: cerca de subir de liga (gamificación P2).
    const xp = await safe(async () => (await import('../gamification/gamification.service')).gamificationService.getXpProfile(userId), null as any);
    if (xp?.league?.next && xp.league.next.toGo > 0 && xp.league.next.toGo <= 60) {
      nudges.push({ id: 'league-push', kind: 'motivation', priority: 55, emoji: '⚡',
        title: `Cerca de ${xp.league.next.label}`, body: `Te faltan ${xp.league.next.toGo} XP esta semana para subir de liga.`,
        action: { type: 'tab', target: 'comunidad', label: 'Ver liga' } });
    }

    // 6) Membresía.
    const isLegend = tier && !tier.isExpired && tier.tier === 'legend';
    if (!isLegend) {
      nudges.push({ id: 'membership', kind: 'membership', priority: 30, emoji: '👑',
        title: 'Desbloquea LEGEND', body: 'AI Coach avanzada, descuentos y combos inteligentes.', action: { type: 'tab', target: 'planes', label: 'Ver planes' } });
    } else if (tier?.remainingSeconds != null && tier.remainingSeconds > 0 && tier.remainingSeconds < 3 * 86400) {
      nudges.push({ id: 'membership-renew', kind: 'membership', priority: 80, emoji: '⏳',
        title: 'Tu LEGEND vence pronto', body: 'Renueva para no perder tus beneficios.', action: { type: 'tab', target: 'planes', label: 'Renovar' } });
    }

    return nudges.sort((a, b) => b.priority - a.priority).slice(0, 5);
  }
}

export const adaptiveService = new AdaptiveService();
