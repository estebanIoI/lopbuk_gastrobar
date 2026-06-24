/**
 * trainers.service — Coach Economy (T1: auth + perfil).
 * Auth propia del entrenador (bcrypt + JWT `type:'trainer'`), sin tocar el enum
 * `role` de users. Mismo patrón que el promotor de afiliados.
 */
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { RowDataPacket } from 'mysql2';
import { config, db } from '../../config';
import { AppError } from '../../common/middleware';
import {
  DEFAULT_COMMISSION_PCT, DEFAULT_MIN_COMMISSION_COP, MIN_OFFER_PRICE_COP,
  type Trainer, type TrainerOffer, type OfferKind,
} from './trainers.types';

const OFFER_KINDS: OfferKind[] = ['programa', 'sesion', 'mensual', 'combo'];

function mapOffer(r: any): TrainerOffer {
  return {
    id: r.id, trainerId: r.trainer_id, title: r.title, description: r.description ?? null,
    kind: r.kind, priceCop: Number(r.price_cop) || 0, durationDays: r.duration_days ?? null,
    deliverables: r.deliverables ? (typeof r.deliverables === 'string' ? safeJson(r.deliverables) : r.deliverables) : null,
    media: r.media ? (typeof r.media === 'string' ? safeJson(r.media) : r.media) : null,
    isActive: !!r.is_active, createdAt: r.created_at,
  };
}

function mapTrainer(r: any): Trainer {
  return {
    id: r.id, userId: r.user_id ?? null, name: r.name, email: r.email, handle: r.handle ?? null,
    bio: r.bio ?? null, photoUrl: r.photo_url ?? null,
    specialties: r.specialties ? (typeof r.specialties === 'string' ? safeJson(r.specialties) : r.specialties) : null,
    status: r.status, commissionPct: Number(r.commission_pct) || DEFAULT_COMMISSION_PCT,
    minCommissionCop: Number(r.min_commission_cop) || DEFAULT_MIN_COMMISSION_COP,
    balanceCop: Number(r.balance_cop) || 0, pendingCop: Number(r.pending_cop) || 0,
    ratingAvg: Number(r.rating_avg) || 0, sessionsCount: Number(r.sessions_count) || 0,
    createdAt: r.created_at,
  };
}
const safeJson = (s: string) => { try { return JSON.parse(s); } catch { return null; } };

/**
 * Transformation Score — señal compuesta de reputación del coach.
 * Pondera transformaciones completadas (lo más fuerte), calidad (rating) y volumen de reseñas.
 */
function transformationScore(sessionsCount: number, ratingAvg: number, reviewsCount: number): number {
  return Math.round((Number(sessionsCount) || 0) * 12 + (Number(ratingAvg) || 0) * 16 + (Number(reviewsCount) || 0) * 4);
}

class TrainersService {
  signToken(trainerId: string): string {
    return jwt.sign({ trainerId, type: 'trainer' }, config.jwt.secret, { expiresIn: '30d' } as jwt.SignOptions);
  }

  async getById(id: string): Promise<Trainer | null> {
    const [rows] = await db.execute<RowDataPacket[]>('SELECT * FROM trainers WHERE id = ? LIMIT 1', [id]);
    return rows[0] ? mapTrainer(rows[0]) : null;
  }

  async register(data: { name: string; email: string; password: string; handle?: string; bio?: string; specialties?: string[] }) {
    const email = String(data.email || '').trim().toLowerCase();
    const name = String(data.name || '').trim();
    if (!name) throw new AppError('El nombre es requerido', 400);
    if (!email) throw new AppError('El email es requerido', 400);
    if (!data.password || data.password.length < 6) throw new AppError('La contraseña debe tener al menos 6 caracteres', 400);

    const [dup] = await db.execute<RowDataPacket[]>('SELECT id FROM trainers WHERE email = ? LIMIT 1', [email]);
    if (dup.length > 0) throw new AppError('Ya existe un entrenador con ese email', 409);

    let handle = data.handle ? String(data.handle).trim().toLowerCase().replace(/[^a-z0-9_.]/g, '') : null;
    if (handle) {
      const [h] = await db.execute<RowDataPacket[]>('SELECT id FROM trainers WHERE handle = ? LIMIT 1', [handle]);
      if (h.length > 0) handle = `${handle}${Math.floor(Math.random() * 900 + 100)}`;
    }

    const id = uuidv4();
    const hash = await bcrypt.hash(data.password, 10);
    await db.execute(
      `INSERT INTO trainers (id, name, email, handle, bio, specialties, password_hash, commission_pct, min_commission_cop, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [id, name, email, handle, data.bio || null, data.specialties ? JSON.stringify(data.specialties) : null, hash, DEFAULT_COMMISSION_PCT, DEFAULT_MIN_COMMISSION_COP]
    );
    return { trainer: await this.getById(id), token: this.signToken(id) };
  }

  async login(email: string, password: string) {
    const e = String(email || '').trim().toLowerCase();
    const [rows] = await db.execute<RowDataPacket[]>('SELECT * FROM trainers WHERE email = ? LIMIT 1', [e]);
    const row = rows[0];
    if (!row || !row.password_hash) throw new AppError('Credenciales inválidas', 401);
    if (row.status === 'suspended') throw new AppError('Tu cuenta de entrenador está suspendida', 403);
    const ok = await bcrypt.compare(String(password || ''), row.password_hash);
    if (!ok) throw new AppError('Credenciales inválidas', 401);
    return { trainer: mapTrainer(row), token: this.signToken(row.id) };
  }

  async updateProfile(trainerId: string, data: { name?: string; bio?: string; photoUrl?: string; specialties?: string[] }) {
    const sets: string[] = []; const args: any[] = [];
    if (data.name !== undefined) { sets.push('name = ?'); args.push(String(data.name).trim()); }
    if (data.bio !== undefined) { sets.push('bio = ?'); args.push(data.bio || null); }
    if (data.photoUrl !== undefined) { sets.push('photo_url = ?'); args.push(data.photoUrl || null); }
    if (data.specialties !== undefined) { sets.push('specialties = ?'); args.push(data.specialties ? JSON.stringify(data.specialties) : null); }
    if (!sets.length) return this.getById(trainerId);
    args.push(trainerId);
    await db.execute(`UPDATE trainers SET ${sets.join(', ')} WHERE id = ?`, args);
    return this.getById(trainerId);
  }

  // ── Ofertas / Programas (entrenador) ──────────────────────────────────────
  async createOffer(trainerId: string, data: { title: string; description?: string; kind?: OfferKind; priceCop: number; durationDays?: number; deliverables?: any; media?: any }): Promise<TrainerOffer> {
    const title = String(data.title || '').trim();
    if (!title) throw new AppError('El título del programa es requerido', 400);
    const kind: OfferKind = OFFER_KINDS.includes(data.kind as OfferKind) ? (data.kind as OfferKind) : 'programa';
    const price = Math.round(Number(data.priceCop) || 0);
    if (price < MIN_OFFER_PRICE_COP) throw new AppError(`El precio mínimo es ${MIN_OFFER_PRICE_COP.toLocaleString('es-CO')} COP`, 400);
    const id = uuidv4();
    await db.execute(
      `INSERT INTO trainer_offers (id, trainer_id, title, description, kind, price_cop, duration_days, deliverables, media)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, trainerId, title, data.description || null, kind, price, data.durationDays ?? null,
       data.deliverables ? JSON.stringify(data.deliverables) : null, data.media ? JSON.stringify(data.media) : null]
    );
    const [rows] = await db.execute<RowDataPacket[]>('SELECT * FROM trainer_offers WHERE id = ? LIMIT 1', [id]);
    return mapOffer(rows[0]);
  }

  async listMyOffers(trainerId: string): Promise<TrainerOffer[]> {
    const [rows] = await db.execute<RowDataPacket[]>('SELECT * FROM trainer_offers WHERE trainer_id = ? ORDER BY created_at DESC', [trainerId]);
    return rows.map(mapOffer);
  }

  async updateOffer(trainerId: string, offerId: string, patch: any): Promise<TrainerOffer | null> {
    const sets: string[] = []; const args: any[] = [];
    if (patch.title !== undefined) { sets.push('title = ?'); args.push(String(patch.title).trim()); }
    if (patch.description !== undefined) { sets.push('description = ?'); args.push(patch.description || null); }
    if (patch.kind !== undefined && OFFER_KINDS.includes(patch.kind)) { sets.push('kind = ?'); args.push(patch.kind); }
    if (patch.priceCop !== undefined) {
      const price = Math.round(Number(patch.priceCop) || 0);
      if (price < MIN_OFFER_PRICE_COP) throw new AppError(`El precio mínimo es ${MIN_OFFER_PRICE_COP.toLocaleString('es-CO')} COP`, 400);
      sets.push('price_cop = ?'); args.push(price);
    }
    if (patch.durationDays !== undefined) { sets.push('duration_days = ?'); args.push(patch.durationDays ?? null); }
    if (patch.deliverables !== undefined) { sets.push('deliverables = ?'); args.push(patch.deliverables ? JSON.stringify(patch.deliverables) : null); }
    if (patch.media !== undefined) { sets.push('media = ?'); args.push(patch.media ? JSON.stringify(patch.media) : null); }
    if (patch.isActive !== undefined) { sets.push('is_active = ?'); args.push(patch.isActive ? 1 : 0); }
    if (!sets.length) return null;
    args.push(offerId, trainerId);
    const [r]: any = await db.execute(`UPDATE trainer_offers SET ${sets.join(', ')} WHERE id = ? AND trainer_id = ?`, args);
    if ((r as any).affectedRows === 0) throw new AppError('Oferta no encontrada', 404);
    const [rows] = await db.execute<RowDataPacket[]>('SELECT * FROM trainer_offers WHERE id = ? LIMIT 1', [offerId]);
    return rows[0] ? mapOffer(rows[0]) : null;
  }

  /** Baja lógica (no borra: puede tener bookings con FK RESTRICT). */
  async deactivateOffer(trainerId: string, offerId: string): Promise<void> {
    const [r]: any = await db.execute('UPDATE trainer_offers SET is_active = 0 WHERE id = ? AND trainer_id = ?', [offerId, trainerId]);
    if ((r as any).affectedRows === 0) throw new AppError('Oferta no encontrada', 404);
  }

  // ── Catálogo público (consumidor) ─────────────────────────────────────────
  async listActiveTrainers(): Promise<any[]> {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT t.id, t.name, t.handle, t.bio, t.photo_url, t.specialties, t.rating_avg, t.sessions_count,
              (SELECT COUNT(*) FROM trainer_offers o WHERE o.trainer_id = t.id AND o.is_active = 1) AS offersCount,
              (SELECT MIN(o.price_cop) FROM trainer_offers o WHERE o.trainer_id = t.id AND o.is_active = 1) AS fromPrice,
              (SELECT COUNT(*) FROM trainer_reviews rv WHERE rv.trainer_id = t.id) AS reviewsCount
         FROM trainers t
        WHERE t.status = 'active'
          AND EXISTS (SELECT 1 FROM trainer_offers o WHERE o.trainer_id = t.id AND o.is_active = 1)
        ORDER BY t.rating_avg DESC, t.sessions_count DESC`
    );
    return rows.map((r: any) => ({
      id: r.id, name: r.name, handle: r.handle, bio: r.bio, photoUrl: r.photo_url,
      specialties: r.specialties ? (typeof r.specialties === 'string' ? safeJson(r.specialties) : r.specialties) : null,
      ratingAvg: Number(r.rating_avg) || 0, sessionsCount: Number(r.sessions_count) || 0,
      reviewsCount: Number(r.reviewsCount) || 0,
      transformationScore: transformationScore(r.sessions_count, r.rating_avg, r.reviewsCount),
      offersCount: Number(r.offersCount) || 0, fromPrice: r.fromPrice != null ? Number(r.fromPrice) : null,
    }));
  }

  /** Ranking público de coaches por Transformation Score (leaderboard). */
  async getRanking(limit = 10): Promise<any[]> {
    const lim = Math.min(50, Math.max(1, Math.floor(limit) || 10));
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT t.id, t.name, t.handle, t.photo_url, t.specialties, t.rating_avg, t.sessions_count,
              (SELECT COUNT(*) FROM trainer_reviews rv WHERE rv.trainer_id = t.id) AS reviewsCount
         FROM trainers t
        WHERE t.status = 'active'
          AND EXISTS (SELECT 1 FROM trainer_offers o WHERE o.trainer_id = t.id AND o.is_active = 1)`
    );
    return rows
      .map((r: any) => ({
        id: r.id, name: r.name, handle: r.handle, photoUrl: r.photo_url,
        specialties: r.specialties ? (typeof r.specialties === 'string' ? safeJson(r.specialties) : r.specialties) : null,
        ratingAvg: Number(r.rating_avg) || 0, sessionsCount: Number(r.sessions_count) || 0,
        reviewsCount: Number(r.reviewsCount) || 0,
        transformationScore: transformationScore(r.sessions_count, r.rating_avg, r.reviewsCount),
      }))
      .sort((a, b) => b.transformationScore - a.transformationScore)
      .slice(0, lim)
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }

  async getTrainerPublic(idOrHandle: string): Promise<any | null> {
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM trainers WHERE (id = ? OR handle = ?) AND status = 'active' LIMIT 1",
      [idOrHandle, idOrHandle]
    );
    const t = rows[0];
    if (!t) return null;
    const [offers] = await db.execute<RowDataPacket[]>('SELECT * FROM trainer_offers WHERE trainer_id = ? AND is_active = 1 ORDER BY price_cop ASC', [t.id]);
    const prof = mapTrainer(t);
    const reviews = await this.listTrainerReviews(t.id, 20);
    return {
      ...prof, balanceCop: undefined, pendingCop: undefined,
      offers: offers.map(mapOffer),
      reviewsCount: reviews.length,
      transformationScore: transformationScore(prof.sessionsCount, prof.ratingAvg, reviews.length),
      reviews,
    };
  }

  // ── Reseñas / Transformation Score (T8) ───────────────────────────────────
  /** Recalcula rating_avg del coach desde sus reseñas. */
  private async recomputeTrainerRating(trainerId: string): Promise<{ count: number; avg: number }> {
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT COUNT(*) AS c, COALESCE(AVG(rating), 0) AS avg FROM trainer_reviews WHERE trainer_id = ?', [trainerId]
    );
    const agg: any = rows[0] || {};
    const avg = Math.round((Number(agg.avg) || 0) * 100) / 100;
    await db.execute('UPDATE trainers SET rating_avg = ? WHERE id = ?', [avg, trainerId]);
    return { count: Number(agg.c) || 0, avg };
  }

  /** Reseñas públicas de un coach (nombre de pila por privacidad). */
  async listTrainerReviews(trainerId: string, limit = 20): Promise<any[]> {
    const lim = Math.min(100, Math.max(1, Math.floor(limit) || 20));
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT r.id, r.rating, r.comment, r.created_at, u.name AS userName
         FROM trainer_reviews r LEFT JOIN users u ON u.id = r.user_id
        WHERE r.trainer_id = ? ORDER BY r.created_at DESC LIMIT ${lim}`, [trainerId]
    );
    return rows.map((r: any) => ({
      id: r.id, rating: Number(r.rating) || 0, comment: r.comment,
      userName: (r.userName || 'Cliente').split(' ')[0], createdAt: r.created_at,
    }));
  }

  /** Programas que el usuario ya pagó y aún no ha reseñado. */
  async listReviewableBookings(userId: string): Promise<any[]> {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT b.id, b.trainer_id, b.program_snapshot, t.name AS trainerName
         FROM trainer_bookings b
         JOIN trainers t ON t.id = b.trainer_id
         LEFT JOIN trainer_reviews r ON r.booking_id = b.id
        WHERE b.user_id = ? AND b.status = 'paid' AND r.id IS NULL
        ORDER BY b.started_at DESC`, [userId]
    );
    return rows.map((b: any) => {
      const snap = b.program_snapshot ? (typeof b.program_snapshot === 'string' ? safeJson(b.program_snapshot) : b.program_snapshot) : {};
      return { bookingId: b.id, trainerId: b.trainer_id, trainerName: b.trainerName, program: snap?.title || 'Programa' };
    });
  }

  /** El usuario reseña un programa que pagó (1 por booking). */
  async createReview(userId: string, data: { bookingId?: string; rating?: number; comment?: string }) {
    const rating = Math.round(Number(data.rating) || 0);
    if (rating < 1 || rating > 5) throw new AppError('La calificación debe ser de 1 a 5', 400);
    if (!data.bookingId) throw new AppError('Falta el programa a reseñar', 400);
    const [brows] = await db.execute<RowDataPacket[]>('SELECT * FROM trainer_bookings WHERE id = ? AND user_id = ? LIMIT 1', [data.bookingId, userId]);
    const b = brows[0];
    if (!b) throw new AppError('Programa no encontrado', 404);
    if (b.status !== 'paid') throw new AppError('Solo puedes reseñar un programa que ya pagaste', 400);
    const [dup] = await db.execute<RowDataPacket[]>('SELECT id FROM trainer_reviews WHERE booking_id = ? LIMIT 1', [data.bookingId]);
    if (dup[0]) throw new AppError('Ya reseñaste este programa', 409);
    const id = uuidv4();
    await db.execute(
      'INSERT INTO trainer_reviews (id, booking_id, trainer_id, user_id, rating, comment) VALUES (?, ?, ?, ?, ?, ?)',
      [id, data.bookingId, b.trainer_id, userId, rating, data.comment?.trim() || null]
    );
    const agg = await this.recomputeTrainerRating(b.trainer_id);
    return { id, rating, trainerRating: agg.avg };
  }

  // ── Contratación / Programa (T3) ──────────────────────────────────────────
  /** Crea un booking 'pending' congelando un snapshot de la oferta (program_snapshot). */
  async createBooking(userId: string, offerId: string) {
    if (!userId) throw new AppError('Usuario no autenticado', 401);
    const [orows] = await db.execute<RowDataPacket[]>('SELECT * FROM trainer_offers WHERE id = ? AND is_active = 1 LIMIT 1', [offerId]);
    const o = orows[0];
    if (!o) throw new AppError('Programa no disponible', 404);
    const [trows] = await db.execute<RowDataPacket[]>("SELECT * FROM trainers WHERE id = ? AND status = 'active' LIMIT 1", [o.trainer_id]);
    const tr = trows[0];
    if (!tr) throw new AppError('Entrenador no disponible', 404);

    const amount = Math.round(Number(o.price_cop) || 0);
    const snapshot = {
      offerId: o.id, title: o.title, kind: o.kind, priceCop: amount, durationDays: o.duration_days ?? null,
      deliverables: o.deliverables ? (typeof o.deliverables === 'string' ? safeJson(o.deliverables) : o.deliverables) : null,
      trainerId: tr.id, trainerName: tr.name,
      commissionPct: Number(tr.commission_pct) || DEFAULT_COMMISSION_PCT,
      minCommissionCop: Number(tr.min_commission_cop) || DEFAULT_MIN_COMMISSION_COP,
    };
    const id = uuidv4();
    await db.execute(
      `INSERT INTO trainer_bookings (id, offer_id, trainer_id, user_id, amount_cop, status, activation_status, program_snapshot)
       VALUES (?, ?, ?, ?, ?, 'pending', 'pending', ?)`,
      [id, o.id, tr.id, userId, amount, JSON.stringify(snapshot)]
    );
    return { id, amountCop: amount, snapshot };
  }

  /** Activa el programa tras pago aprobado (idempotente). Calcula comisión y la registra. */
  async activateBookingPaid(bookingId: string, gatewayPaymentId?: string | null): Promise<void> {
    const conn = await (db as any).getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query('SELECT * FROM trainer_bookings WHERE id = ? FOR UPDATE', [bookingId]);
      const b = (rows as any[])[0];
      if (!b) { await conn.rollback(); return; }
      if (b.status !== 'pending') { await conn.commit(); return; } // ya activado

      const snap = b.program_snapshot ? (typeof b.program_snapshot === 'string' ? safeJson(b.program_snapshot) : b.program_snapshot) : {};
      const amount = Number(b.amount_cop) || 0;
      const pct = Number(snap?.commissionPct) || DEFAULT_COMMISSION_PCT;
      const minC = Number(snap?.minCommissionCop) || DEFAULT_MIN_COMMISSION_COP;
      const platform = Math.max(minC, Math.round(amount * pct / 100));        // híbrido 20% mín 100k
      const gatewayFee = Math.round(amount * 0.0265);                          // Wompi ≈ 2,65% (lo absorbe el coach)
      const trainerNet = Math.max(0, amount - platform - gatewayFee);
      const durationDays = Number(snap?.durationDays) || null;
      const expiresExpr = durationDays ? `DATE_ADD(NOW(), INTERVAL ${Math.floor(durationDays)} DAY)` : 'NULL';

      await conn.query(
        `UPDATE trainer_bookings
            SET status = 'paid', activation_status = 'active', started_at = NOW(),
                expires_at = ${expiresExpr}, platform_cop = ?, trainer_cop = ?, gateway_fee_cop = ?,
                gateway_payment_id = COALESCE(gateway_payment_id, ?)
          WHERE id = ?`,
        [platform, trainerNet, gatewayFee, gatewayPaymentId ?? null, bookingId]
      );
      // Comisión disponible para payout tras 7 días (antifraude/disputas).
      await conn.query(
        `INSERT INTO trainer_commissions (id, booking_id, trainer_id, gross_cop, platform_cop, trainer_cop, gateway_fee_cop, status, release_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', DATE_ADD(NOW(), INTERVAL 7 DAY))`,
        [uuidv4(), bookingId, b.trainer_id, amount, platform, trainerNet, gatewayFee]
      );
      // Acredita pendiente + cuenta el programa al coach.
      await conn.query('UPDATE trainers SET pending_cop = pending_cop + ?, sessions_count = sessions_count + 1 WHERE id = ?', [trainerNet, b.trainer_id]);
      await conn.commit();
    } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }

    // Delivery (T4): materializa el programa en el OS del usuario + mensaje de bienvenida.
    // Fuera de la transacción y defensivo: que la entrega no bloquee el pago.
    try { await this.deliverProgram(bookingId); } catch (e) { console.warn('[trainers] delivery error:', (e as any)?.message); }

    // Logro (V3): Discípulo — empezó una transformación con coach.
    try {
      const [br] = await db.execute<RowDataPacket[]>('SELECT user_id FROM trainer_bookings WHERE id = ? LIMIT 1', [bookingId]);
      const uid = (br[0] as any)?.user_id;
      if (uid) {
        const { achievementsService } = await import('../achievements/achievements.service'); await achievementsService.award(uid, 'coach_disciple', 'coach');
        const { gamificationService } = await import('../gamification/gamification.service'); await gamificationService.awardXp(uid, 'coach_program');
      }
    } catch { /* no bloquear */ }
  }

  /** Materializa los deliverables del booking en el OS del usuario (T4). */
  async deliverProgram(bookingId: string): Promise<void> {
    const [rows] = await db.execute<RowDataPacket[]>('SELECT * FROM trainer_bookings WHERE id = ? LIMIT 1', [bookingId]);
    const b = rows[0];
    if (!b) return;
    const snap = b.program_snapshot ? (typeof b.program_snapshot === 'string' ? safeJson(b.program_snapshot) : b.program_snapshot) : {};
    // Crea una rutina propia del programa (visible en la pestaña Rutina del usuario).
    try {
      const { createRutina } = await import('../rutina/rutina.service');
      await createRutina(b.user_id, { name: `${snap?.title || 'Programa'} · ${snap?.trainerName || 'Coach'}`, type: 'coach', color: '#0ea5e9' });
    } catch (e) { console.warn('[trainers] createRutina delivery:', (e as any)?.message); }
    // Mensaje de bienvenida del coach en el feed.
    await db.execute(
      `INSERT INTO coach_feed_entries (id, booking_id, author, kind, body) VALUES (?, ?, 'coach', 'announcement', ?)`,
      [uuidv4(), bookingId, `¡Bienvenido a ${snap?.title || 'tu programa'}! Empecemos tu transformación. 💪`]
    );
  }

  // ── Coach Feed (async coaching, T4) ───────────────────────────────────────
  private async assertBookingOwner(bookingId: string, opts: { trainerId?: string; userId?: string }) {
    const [rows] = await db.execute<RowDataPacket[]>('SELECT id, trainer_id, user_id FROM trainer_bookings WHERE id = ? LIMIT 1', [bookingId]);
    const b = rows[0];
    if (!b) throw new AppError('Contratación no encontrada', 404);
    if (opts.trainerId && b.trainer_id !== opts.trainerId) throw new AppError('No autorizado', 403);
    if (opts.userId && b.user_id !== opts.userId) throw new AppError('No autorizado', 403);
    return b;
  }

  async getBookingFeed(bookingId: string, opts: { trainerId?: string; userId?: string }) {
    await this.assertBookingOwner(bookingId, opts);
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT id, author, kind, body, media_url, created_at FROM coach_feed_entries WHERE booking_id = ? ORDER BY created_at ASC LIMIT 200',
      [bookingId]
    );
    return rows.map((r: any) => ({ id: r.id, author: r.author, kind: r.kind, body: r.body, mediaUrl: r.media_url, createdAt: r.created_at }));
  }

  async coachPostFeed(trainerId: string, bookingId: string, data: { kind?: string; body?: string; mediaUrl?: string }) {
    await this.assertBookingOwner(bookingId, { trainerId });
    const kind = ['feedback', 'checkin', 'adjustment', 'audio', 'photo', 'task', 'announcement'].includes(String(data.kind)) ? data.kind : 'feedback';
    if (!data.body?.trim() && !data.mediaUrl) throw new AppError('Mensaje vacío', 400);
    const id = uuidv4();
    await db.execute(
      `INSERT INTO coach_feed_entries (id, booking_id, author, kind, body, media_url) VALUES (?, ?, 'coach', ?, ?, ?)`,
      [id, bookingId, kind, data.body?.trim() || null, data.mediaUrl || null]
    );
    return { id };
  }

  async userReplyFeed(userId: string, bookingId: string, body: string) {
    await this.assertBookingOwner(bookingId, { userId });
    if (!body?.trim()) throw new AppError('Mensaje vacío', 400);
    const id = uuidv4();
    await db.execute(`INSERT INTO coach_feed_entries (id, booking_id, author, kind, body) VALUES (?, ?, 'user', 'reply', ?)`, [id, bookingId, body.trim()]);
    return { id };
  }

  /** Clientes activos del coach (para el portal / feed). */
  async coachListClients(trainerId: string) {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT b.id AS bookingId, b.user_id, b.status, b.activation_status, b.started_at, b.expires_at, b.program_snapshot,
              u.name AS userName
         FROM trainer_bookings b LEFT JOIN users u ON u.id = b.user_id
        WHERE b.trainer_id = ? AND b.status IN ('paid','delivered','completed')
        ORDER BY b.started_at DESC`,
      [trainerId]
    );
    return rows.map((b: any) => {
      const snap = b.program_snapshot ? (typeof b.program_snapshot === 'string' ? safeJson(b.program_snapshot) : b.program_snapshot) : {};
      return { bookingId: b.bookingId, userName: b.userName || 'Cliente', program: snap?.title || 'Programa', activationStatus: b.activation_status, startedAt: b.started_at, expiresAt: b.expires_at };
    });
  }

  /** Programa activo del usuario (el más reciente, no vencido). Para el Active Program Layer. */
  async getActiveProgram(userId: string): Promise<any | null> {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT b.*, t.name AS trainerName, t.photo_url AS trainerPhoto
         FROM trainer_bookings b JOIN trainers t ON t.id = b.trainer_id
        WHERE b.user_id = ? AND b.activation_status = 'active' AND (b.expires_at IS NULL OR b.expires_at > NOW())
        ORDER BY b.started_at DESC LIMIT 1`,
      [userId]
    );
    const b = rows[0];
    if (!b) return null;
    const snap = b.program_snapshot ? (typeof b.program_snapshot === 'string' ? safeJson(b.program_snapshot) : b.program_snapshot) : {};
    let week = b.current_week || 1;
    if (b.started_at) week = Math.max(1, Math.floor((Date.now() - new Date(b.started_at).getTime()) / (7 * 86400000)) + 1);
    const totalWeeks = snap?.durationDays ? Math.ceil(Number(snap.durationDays) / 7) : null;
    return {
      bookingId: b.id, trainerId: b.trainer_id, trainerName: b.trainerName, trainerPhoto: b.trainerPhoto,
      title: snap?.title || 'Programa', kind: snap?.kind, week, totalWeeks,
      startedAt: b.started_at, expiresAt: b.expires_at, deliverables: snap?.deliverables || null,
    };
  }

  async listMyBookings(userId: string) {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT b.id, b.amount_cop, b.status, b.activation_status, b.started_at, b.expires_at, b.program_snapshot, t.name AS trainerName
         FROM trainer_bookings b JOIN trainers t ON t.id = b.trainer_id
        WHERE b.user_id = ? ORDER BY b.created_at DESC`,
      [userId]
    );
    return rows.map((b: any) => {
      const snap = b.program_snapshot ? (typeof b.program_snapshot === 'string' ? safeJson(b.program_snapshot) : b.program_snapshot) : {};
      return { id: b.id, amountCop: Number(b.amount_cop) || 0, status: b.status, activationStatus: b.activation_status, title: snap?.title || 'Programa', trainerName: b.trainerName, startedAt: b.started_at, expiresAt: b.expires_at };
    });
  }

  // ── Payouts / Wallet del coach (T5) ───────────────────────────────────────
  /**
   * Libera comisiones maduras (release_at <= ahora): pasa `pending` → `available`
   * y mueve el neto del coach de `pending_cop` a `balance_cop` (retirable).
   * Idempotente y transaccional. Se llama de forma perezosa al leer la wallet.
   */
  async releaseMaturedCommissions(trainerId?: string): Promise<number> {
    const conn = await (db as any).getConnection();
    try {
      await conn.beginTransaction();
      const where = trainerId ? 'AND trainer_id = ?' : '';
      const params = trainerId ? [trainerId] : [];
      const [rows] = await conn.query(
        `SELECT id, trainer_id, trainer_cop FROM trainer_commissions
          WHERE status = 'pending' AND release_at IS NOT NULL AND release_at <= NOW() ${where}
          FOR UPDATE`, params
      );
      const list = rows as any[];
      if (list.length === 0) { await conn.commit(); return 0; }
      const byTrainer = new Map<string, number>();
      const ids: string[] = [];
      for (const c of list) {
        byTrainer.set(c.trainer_id, (byTrainer.get(c.trainer_id) || 0) + Number(c.trainer_cop));
        ids.push(c.id);
      }
      for (const [tid, amount] of byTrainer) {
        await conn.query(
          'UPDATE trainers SET pending_cop = GREATEST(0, pending_cop - ?), balance_cop = balance_cop + ? WHERE id = ?',
          [amount, amount, tid]
        );
      }
      await conn.query(`UPDATE trainer_commissions SET status = 'available' WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
      await conn.commit();
      return list.length;
    } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  }

  /** Resumen de la billetera del coach (libera maduras primero). */
  async getWallet(trainerId: string) {
    await this.releaseMaturedCommissions(trainerId).catch(() => {});
    const tr = await this.getById(trainerId);
    if (!tr) throw new AppError('Entrenador no encontrado', 404);
    const [aggRows] = await db.execute<RowDataPacket[]>(
      `SELECT
         COALESCE(SUM(trainer_cop),0) AS lifetimeNet,
         COALESCE(SUM(CASE WHEN status='pending' THEN trainer_cop ELSE 0 END),0) AS pendingNet,
         COALESCE(SUM(CASE WHEN status='available' THEN trainer_cop ELSE 0 END),0) AS availableNet,
         COALESCE(SUM(platform_cop),0) AS platformPaid,
         COUNT(*) AS sales
       FROM trainer_commissions WHERE trainer_id = ?`, [trainerId]
    );
    const agg: any = aggRows[0] || {};
    const [wdRows] = await db.execute<RowDataPacket[]>(
      `SELECT
         COALESCE(SUM(CASE WHEN status IN ('requested','processing') THEN amount_cop ELSE 0 END),0) AS inFlight,
         COALESCE(SUM(CASE WHEN status='paid' THEN amount_cop ELSE 0 END),0) AS paidOut
       FROM trainer_withdrawals WHERE trainer_id = ?`, [trainerId]
    );
    const wd: any = wdRows[0] || {};
    return {
      balanceCop: tr.balanceCop,
      pendingCop: tr.pendingCop,
      lifetimeNetCop: Number(agg.lifetimeNet) || 0,
      availableNetCop: Number(agg.availableNet) || 0,
      pendingNetCop: Number(agg.pendingNet) || 0,
      platformPaidCop: Number(agg.platformPaid) || 0,
      salesCount: Number(agg.sales) || 0,
      withdrawalsInFlightCop: Number(wd.inFlight) || 0,
      paidOutCop: Number(wd.paidOut) || 0,
    };
  }

  async listMyCommissions(trainerId: string) {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT c.id, c.gross_cop, c.platform_cop, c.trainer_cop, c.gateway_fee_cop, c.status, c.release_at, c.created_at,
              b.program_snapshot
         FROM trainer_commissions c LEFT JOIN trainer_bookings b ON b.id = c.booking_id
        WHERE c.trainer_id = ? ORDER BY c.created_at DESC LIMIT 100`, [trainerId]
    );
    return rows.map((r: any) => {
      const snap = r.program_snapshot ? (typeof r.program_snapshot === 'string' ? safeJson(r.program_snapshot) : r.program_snapshot) : {};
      return {
        id: r.id, grossCop: Number(r.gross_cop) || 0, platformCop: Number(r.platform_cop) || 0,
        trainerCop: Number(r.trainer_cop) || 0, gatewayFeeCop: Number(r.gateway_fee_cop) || 0,
        status: r.status, releaseAt: r.release_at, createdAt: r.created_at, program: snap?.title || 'Programa',
      };
    });
  }

  async requestWithdrawal(trainerId: string, data: { amountCop?: number; paymentMethod?: string }) {
    await this.releaseMaturedCommissions(trainerId).catch(() => {});
    const amount = Math.round(Number(data.amountCop) || 0);
    if (amount < 50_000) throw new AppError('El retiro mínimo es 50.000 COP', 400);
    if (!data.paymentMethod?.trim()) throw new AppError('Indica el método de pago (Nequi, cuenta, etc.)', 400);
    const tr = await this.getById(trainerId);
    if (!tr) throw new AppError('Entrenador no encontrado', 404);
    if (amount > tr.balanceCop) throw new AppError('El monto supera tu saldo disponible', 400);
    const id = uuidv4();
    await db.execute(
      'INSERT INTO trainer_withdrawals (id, trainer_id, amount_cop, payment_method) VALUES (?, ?, ?, ?)',
      [id, trainerId, amount, data.paymentMethod.trim()]
    );
    return { id, amountCop: amount, status: 'requested' };
  }

  async listMyWithdrawals(trainerId: string) {
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT * FROM trainer_withdrawals WHERE trainer_id = ? ORDER BY created_at DESC LIMIT 100', [trainerId]
    );
    return rows.map((r: any) => ({
      id: r.id, amountCop: Number(r.amount_cop) || 0, paymentMethod: r.payment_method,
      status: r.status, note: r.note, createdAt: r.created_at,
    }));
  }

  async adminListWithdrawals(status?: string) {
    await this.releaseMaturedCommissions().catch(() => {});
    const where = status ? 'WHERE w.status = ?' : '';
    const params = status ? [status] : [];
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT w.*, t.name AS trainerName, t.email AS trainerEmail, t.balance_cop AS trainerBalance
         FROM trainer_withdrawals w JOIN trainers t ON t.id = w.trainer_id
         ${where} ORDER BY w.created_at DESC LIMIT 200`, params
    );
    return rows.map((r: any) => ({
      id: r.id, trainerId: r.trainer_id, trainerName: r.trainerName, trainerEmail: r.trainerEmail,
      trainerBalanceCop: Number(r.trainerBalance) || 0, amountCop: Number(r.amount_cop) || 0,
      paymentMethod: r.payment_method, status: r.status, note: r.note, createdAt: r.created_at,
    }));
  }

  async adminProcessWithdrawal(id: string, status: 'processing' | 'paid' | 'rejected', processedBy: string, note?: string) {
    const conn = await (db as any).getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query('SELECT * FROM trainer_withdrawals WHERE id = ? FOR UPDATE', [id]);
      const w = (rows as any[])[0];
      if (!w) throw new AppError('Retiro no encontrado', 404);
      if (w.status === 'paid') throw new AppError('El retiro ya fue pagado', 400);
      if (status === 'paid') {
        const [upd] = await conn.query(
          'UPDATE trainers SET balance_cop = balance_cop - ? WHERE id = ? AND balance_cop >= ?',
          [w.amount_cop, w.trainer_id, w.amount_cop]
        );
        if ((upd as any).affectedRows === 0) throw new AppError('Saldo insuficiente del coach para marcar pagado', 400);
      }
      await conn.query('UPDATE trainer_withdrawals SET status = ?, processed_by = ?, note = ? WHERE id = ?', [status, processedBy, note || null, id]);
      await conn.commit();
    } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  }
}

export const trainersService = new TrainersService();
