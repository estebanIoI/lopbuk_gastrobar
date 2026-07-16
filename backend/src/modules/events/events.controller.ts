import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../common/middleware';
import { RowDataPacket } from 'mysql2';
import { db } from '../../config';
import { eventsService } from './events.service';
import { eventsBookingService } from './events.booking.service';
import { eventLogger } from './events.logger';
import { eventTimeline } from './events.timeline';
import { analyticsEngine } from './events.analytics-engine';

export class EventsController {
  // ── Events ──────────────────────────────────────
  async findAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { status, from, to, limit, offset } = req.query as any;
      const result = await eventsService.findAll(req.user!.tenantId!, {
        status, from, to,
        limit: Number(limit), offset: Number(offset),
      });
      res.json({ success: true, data: result.data, pagination: result.pagination });
    } catch (e) { next(e); }
  }

  async findById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const event = await eventsService.findById(req.params.id, req.user!.tenantId!);
      res.json({ success: true, data: event });
    } catch (e) { next(e); }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const event = await eventsService.create(req.user!.tenantId!, req.body);
      res.status(201).json({ success: true, data: event });
    } catch (e) { next(e); }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const event = await eventsService.update(req.params.id, req.user!.tenantId!, req.body);
      res.json({ success: true, data: event });
    } catch (e) { next(e); }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await eventsService.delete(req.params.id, req.user!.tenantId!);
      res.json({ success: true, data: result });
    } catch (e) { next(e); }
  }

  async publish(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const event = await eventsService.publish(req.params.id, req.user!.tenantId!);
      res.json({ success: true, data: event });
    } catch (e) { next(e); }
  }

  async unpublish(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await eventsService.unpublish(req.params.id, req.user!.tenantId!);
      res.json({ success: true, data: result });
    } catch (e) { next(e); }
  }

  // ── Venues ──────────────────────────────────────
  async findVenues(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await eventsService.findVenues(req.user!.tenantId!);
      res.json({ success: true, data });
    } catch (e) { next(e); }
  }

  async createVenue(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const venue = await eventsService.createVenue(req.user!.tenantId!, req.body);
      res.status(201).json({ success: true, data: venue });
    } catch (e) { next(e); }
  }

  async updateVenue(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const venue = await eventsService.updateVenue(req.params.vid, req.user!.tenantId!, req.body);
      res.json({ success: true, data: venue });
    } catch (e) { next(e); }
  }

  async deleteVenue(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await eventsService.deleteVenue(req.params.vid, req.user!.tenantId!);
      res.json({ success: true, data: result });
    } catch (e) { next(e); }
  }

  // ── Seat Maps ───────────────────────────────────
  async findSeatMaps(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await eventsService.findSeatMaps(req.user!.tenantId!);
      res.json({ success: true, data });
    } catch (e) { next(e); }
  }

  async createSeatMap(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const sm = await eventsService.createSeatMap(req.user!.tenantId!, req.body);
      res.status(201).json({ success: true, data: sm });
    } catch (e) { next(e); }
  }

  async updateSeatMap(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const sm = await eventsService.updateSeatMap(req.params.sid, req.user!.tenantId!, req.body);
      res.json({ success: true, data: sm });
    } catch (e) { next(e); }
  }

  async deleteSeatMap(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await eventsService.deleteSeatMap(req.params.sid, req.user!.tenantId!);
      res.json({ success: true, data: result });
    } catch (e) { next(e); }
  }

  // ── Ticket Types ────────────────────────────────
  async findTicketTypes(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await eventsService.findTicketTypes(req.params.id, req.user!.tenantId!);
      res.json({ success: true, data });
    } catch (e) { next(e); }
  }

  async createTicketType(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tt = await eventsService.createTicketType(req.params.id, req.user!.tenantId!, req.body);
      res.status(201).json({ success: true, data: tt });
    } catch (e) { next(e); }
  }

  async updateTicketType(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tt = await eventsService.updateTicketType(req.params.ttid, req.user!.tenantId!, req.body);
      res.json({ success: true, data: tt });
    } catch (e) { next(e); }
  }

  async deleteTicketType(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await eventsService.deleteTicketType(req.params.ttid, req.user!.tenantId!);
      res.json({ success: true, data: result });
    } catch (e) { next(e); }
  }

  // ── Public ──────────────────────────────────────
  async findPublic(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { slug, limit, offset } = _req.query as any;
      const result = await eventsService.findPublic({ slug, limit: Number(limit), offset: Number(offset) });
      res.json({ success: true, ...result });
    } catch (e) { next(e); }
  }

  // Resuelve el evento público: por `eventId` si viene (cartelera con varios eventos),
  // si no, el próximo evento publicado del comercio (compat. tiendas de 1 evento).
  private resolvePublicEvent(req: AuthRequest) {
    const eventId = (req.body?.eventId ?? req.query?.eventId) as string | undefined;
    return eventId
      ? eventsService.findPublicEventById(req.params.slug, eventId)
      : eventsService.findPublicBySlug(req.params.slug);
  }

  async findPublicBySlug(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const event = await this.resolvePublicEvent(req);
      if (!event) { res.status(404).json({ success: false, error: 'Evento no encontrado' }); return; }
      res.json({ success: true, data: event });
    } catch (e) { next(e); }
  }

  async getAvailability(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const event = await this.resolvePublicEvent(req);
      if (!event) { res.status(404).json({ success: false, error: 'Evento no encontrado' }); return; }
      const data = await eventsService.getAvailability((event as any).id, (event as any).tenant_id);
      res.json({ success: true, data });
    } catch (e) { next(e); }
  }

  // ── Holds ───────────────────────────────────────
  async createHold(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const event = await this.resolvePublicEvent(req);
      if (!event) { res.status(404).json({ success: false, error: 'Evento no encontrado' }); return; }
      const hold = await eventsBookingService.createHold(
        (event as any).id, (event as any).tenant_id, req.body,
        req.ip || req.socket.remoteAddress || undefined,
      );
      res.json({ success: true, data: hold });
    } catch (e) { next(e); }
  }

  async releaseHold(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await eventsBookingService.releaseHold(req.body.holdToken);
      res.json({ success: true, data: result });
    } catch (e) { next(e); }
  }

  // ── Checkout ────────────────────────────────────
  async createCheckout(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const event = await this.resolvePublicEvent(req);
      if (!event) { res.status(404).json({ success: false, error: 'Evento no encontrado' }); return; }
      const result = await eventsBookingService.createCheckout(
        (event as any).id, (event as any).tenant_id, req.body,
      );
      res.json({ success: true, data: result });
    } catch (e) { next(e); }
  }

  async getBookingStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const [rows] = await db.query<RowDataPacket[]>(
        `SELECT eb.id, eb.status, eb.total_amount, eb.quantity, e.title, e.event_date
         FROM event_bookings eb
         JOIN merchant_events e ON e.id = eb.event_id
         WHERE eb.id = ? LIMIT 1`, [req.params.reference]
      );
      if (!rows.length) { res.status(404).json({ success: false, error: 'Booking no encontrado' }); return; }
      res.json({ success: true, data: rows[0] });
    } catch (e) { next(e); }
  }

  // ── Check-in ────────────────────────────────────
  async validateTicket(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await eventsBookingService.validateTicket(req.params.code);
      res.json({ success: true, data: result });
    } catch (e) { next(e); }
  }

  async checkin(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await eventsBookingService.checkin(req.params.code, req.user!.id);
      res.json({ success: true, data: result });
    } catch (e) { next(e); }
  }

  async batchSyncCheckin(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await eventsBookingService.batchSyncCheckin(req.body.checkins || []);
      res.json({ success: true, data: result });
    } catch (e) { next(e); }
  }

  async checkinStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await eventsBookingService.checkinStats(req.params.id, req.user!.tenantId!);
      res.json({ success: true, data: result });
    } catch (e) { next(e); }
  }

  // ── Bookings ────────────────────────────────────
  async findBookings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await eventsService.findBookings(
        req.params.id, req.user!.tenantId!,
        { limit: Number(req.query.limit), offset: Number(req.query.offset) },
      );
      res.json({ success: true, data: result.data });
    } catch (e) { next(e); }
  }

  // ── Analytics ───────────────────────────────────
  async getAnalytics(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await eventsService.getAnalytics(req.params.id, req.user!.tenantId!);
      res.json({ success: true, data });
    } catch (e) { next(e); }
  }

  // ── Transfer ────────────────────────────────────
  async transferTicket(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { itemId, toName, toEmail } = req.body;
      const result = await eventsBookingService.transferTicket(itemId, toName, toEmail);
      res.json({ success: true, data: result });
    } catch (e) { next(e); }
  }

  // ── Coupon ──────────────────────────────────────
  async validateCouponPublic(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const event = await this.resolvePublicEvent(req);
      if (!event) { res.status(404).json({ success: false, error: 'Evento no encontrado' }); return; }
      const { code, ticketTypeId, quantity } = req.body;
      const result = await eventsBookingService.validateCoupon(
        code, ticketTypeId, quantity, (event as any).tenant_id,
      );
      if (!result) { res.json({ success: true, data: { valid: false } }); return; }
      res.json({ success: true, data: { valid: true, ...result } });
    } catch (e) { next(e); }
  }

  // ── Health Check ────────────────────────────────
  async health(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const checks: Record<string, boolean | string> = {};

      // BD
      try {
        await db.query('SELECT 1 FROM merchant_events LIMIT 1');
        checks.db = true;
      } catch { checks.db = 'error_conexion'; }

      // QR Secret
      checks.qr_secret = !!process.env.EVENTS_QR_SECRET || 'usando_default';

      // Hold Cleaner
      try {
        const [rows] = await db.query<any>('SELECT COUNT(*) AS cnt FROM event_seat_holds');
        checks.hold_cleaner = 'activo';
      } catch { checks.hold_cleaner = 'error'; }

      // Payments
      try {
        const { getPublicAvailability } = await import('../payments/payments.service');
        const avail = await getPublicAvailability();
        checks.payments = avail.wompi ? 'wompi_activo' : 'wompi_inactivo';
      } catch { checks.payments = 'error'; }

      // WhatsApp
      try {
        const [cfg] = await db.query<any>('SELECT COUNT(*) AS cnt FROM chatbot_config WHERE evolution_instance IS NOT NULL');
        checks.whatsapp = (cfg?.[0]?.cnt > 0) ? 'configurado' : 'sin_instancia';
      } catch { checks.whatsapp = 'error'; }

      res.json({ success: true, data: { status: 'ok', checks, timestamp: new Date().toISOString() } });
    } catch (e) { next(e); }
  }

  // ── Superadmin Dashboard ────────────────────────
  async superadminStats(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const [stats] = await db.query<any>(`
        SELECT
          (SELECT COUNT(*) FROM merchant_events WHERE status = 'published' AND is_active = 1) AS active_events,
          (SELECT COUNT(*) FROM event_seat_holds WHERE expires_at > NOW()) AS active_holds,
          (SELECT COUNT(*) FROM event_bookings WHERE status = 'pending') AS pending_bookings,
          (SELECT COUNT(*) FROM event_bookings WHERE status = 'confirmed') AS confirmed_bookings,
          (SELECT COUNT(*) FROM event_payment_transactions WHERE status = 'approved' AND created_at >= CURDATE()) AS payments_today,
          (SELECT COUNT(*) FROM event_booking_items WHERE status = 'used' AND checked_in_at >= CURDATE()) AS checkins_today,
          (SELECT COALESCE(SUM(quantity), 0) FROM event_bookings WHERE status = 'confirmed') AS total_tickets_sold,
          (SELECT COALESCE(SUM(total_amount), 0) FROM event_bookings WHERE status = 'confirmed') AS total_revenue,
          (SELECT COUNT(*) FROM event_logs WHERE created_at >= CURDATE()) AS logs_today,
          (SELECT COUNT(*) FROM event_bookings WHERE status = 'pending' AND created_at < DATE_SUB(NOW(), INTERVAL 30 MINUTE)) AS stale_bookings
      `);

      // ── Product Funnel Metrics (beta) ──
      const [funnel] = await db.query<any>(`
        SELECT
          (SELECT COUNT(DISTINCT el.booking_id) FROM event_logs el
           WHERE el.action = 'CHECKOUT_STARTED' AND el.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS checkouts_30d,
          (SELECT COUNT(DISTINCT el.booking_id) FROM event_logs el
           WHERE el.action = 'BOOKING_CONFIRMED' AND el.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS confirmed_30d,
          (SELECT COUNT(DISTINCT el.booking_id) FROM event_logs el
           WHERE el.action = 'CHECKIN_SUCCESS' AND el.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS checkins_30d,
          (SELECT COUNT(DISTINCT el.booking_id) FROM event_logs el
           WHERE el.action IN ('PAYMENT_DECLINED', 'CAPACITY_EXCEEDED') AND el.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS failed_30d
      `);

      // Tiempo promedio de creación → publicación
      const [creationTime] = await db.query<any>(
        `SELECT AVG(TIMESTAMPDIFF(MINUTE, me.created_at, me.updated_at)) AS avg_min,
                COUNT(*) AS count
         FROM merchant_events me WHERE me.status IN ('published', 'completed')
           AND me.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
      );

      // No-show rate: confirmed but not checked in (eventos pasados)
      const [noShow] = await db.query<any>(
        `SELECT
          COALESCE(SUM(CASE WHEN ebi.status != 'used' THEN 1 ELSE 0 END), 0) AS no_shows,
          COUNT(*) AS total_confirmed
         FROM event_booking_items ebi
         JOIN event_bookings eb ON eb.id = ebi.booking_id
         JOIN merchant_events e ON e.id = eb.event_id
         WHERE eb.status = 'confirmed' AND e.event_date < NOW() - INTERVAL 1 DAY`
      );

      // Tiempo promedio de check-in por evento (hoy)
      const [checkinSpeed] = await db.query<any>(
        `SELECT AVG(sec) AS avg_seconds, COUNT(*) AS count FROM (
           SELECT TIMESTAMPDIFF(SECOND, MIN(created_at), MAX(created_at)) AS sec
           FROM event_booking_items WHERE checked_in_at >= CURDATE() AND status = 'used'
           GROUP BY booking_id HAVING COUNT(*) > 1
         ) t`
      );

      const metric = (v: any) => Number(v) || 0;
      const funnelData = funnel?.[0] || {};
      const checkouts = metric(funnelData.checkouts_30d);
      const confirmed = metric(funnelData.confirmed_30d);
      const checkins = metric(funnelData.checkins_30d);

      const recentLogs = [] as any[];

      res.json({
        success: true,
        data: {
          ...(stats[0] || {}),
          product_funnel: {
            conversion: { checkouts, confirmed, checkins,
              checkout_to_payment_pct: checkouts > 0 ? Math.round((confirmed / checkouts) * 100) : 0,
              payment_to_checkin_pct: confirmed > 0 ? Math.round((checkins / confirmed) * 100) : 0,
            },
            creation_time_avg_min: Math.round(metric(creationTime?.[0]?.avg_min)),
            events_measured_30d: metric(creationTime?.[0]?.count),
            no_show: {
              count: metric(noShow?.[0]?.no_shows),
              total: metric(noShow?.[0]?.total_confirmed),
              rate_pct: metric(noShow?.[0]?.total_confirmed) > 0
                ? Math.round((metric(noShow?.[0]?.no_shows) / metric(noShow?.[0]?.total_confirmed)) * 100)
                : 0,
            },
            checkin_speed: {
              avg_seconds: Math.round(metric(checkinSpeed?.[0]?.avg_seconds)),
              groups_measured: metric(checkinSpeed?.[0]?.count),
            },
          },
          recent_logs: recentLogs,
        },
      });
    } catch (e) { next(e); }
  }

  // ── Trace Log ───────────────────────────────────
  async getTraceLogs(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { traceId, bookingId, eventId } = req.query as any;
      let logs: any[] = [];
      if (traceId) {
        logs = await eventLogger.findByTraceId(traceId);
      } else if (bookingId) {
        logs = await eventLogger.findByBookingId(bookingId);
      } else if (eventId) {
        logs = await eventLogger.findByEventId(eventId, Number(req.query.limit) || 100);
      }
      res.json({ success: true, data: logs });
    } catch (e) { next(e); }
  }

  // ── Timeline ────────────────────────────────────
  async getTimeline(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const entries = await eventTimeline.getTimeline(
        req.params.id, req.user!.tenantId!,
        Number(req.query.limit) || 50
      );
      const metrics = await analyticsEngine.getMetrics(req.params.id);
      res.json({ success: true, data: { entries, metrics } });
    } catch (e) { next(e); }
  }
}

export const eventsController = new EventsController();
