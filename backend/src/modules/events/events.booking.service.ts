import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { RowDataPacket } from 'mysql2';
import { db } from '../../config';
import { AppError } from '../../common/middleware';
import type { HoldRequest, CheckoutRequest } from './events.types';
import { eventLogger, generateTraceId, extractTraceId } from './events.logger';
import { eventBus } from './events.bus';
import { BookingStateMachine, TicketStateMachine } from './events.state-machine';

const HOLD_TTL_MINUTES = 10;
const EVENTS_QR_SECRET = process.env.EVENTS_QR_SECRET || crypto.createHash('sha256').update('lopbuk-events-default').digest('hex');

let _cleanerRunning = false;

function generateTicketCode(bookingId: string, index: number): string {
  const clean = bookingId.replace(/-/g, '').substring(0, 8);
  const rand = crypto.randomBytes(4).toString('hex');
  return `EVT-${clean}-${rand}${String(index + 1).padStart(2, '0')}`.toUpperCase();
}

function generateQRPayload(ticketCode: string, eventId: string, version: number = 1): string {
  const payload = { tc: ticketCode, e: eventId, v: version, ts: Date.now() };
  const hmac = crypto.createHmac('sha256', EVENTS_QR_SECRET).update(JSON.stringify(payload)).digest('hex').substring(0, 16);
  return JSON.stringify({ ...payload, hmac });
}

function verifyQRPayload(qrData: string): { valid: boolean; ticketCode?: string; eventId?: string; version?: number } {
  try {
    const { tc, e, v, ts, hmac } = JSON.parse(qrData);
    if (!tc || !e || !hmac) return { valid: false };
    const expected = crypto.createHmac('sha256', EVENTS_QR_SECRET)
      .update(JSON.stringify({ tc, e, v, ts })).digest('hex').substring(0, 16);
    return { valid: hmac === expected, ticketCode: tc, eventId: e, version: v || 1 };
  } catch { return { valid: false }; }
}

// ── HOLD CLEANER: limpia holds vencidos cada 60s ───────
export function startHoldCleaner(): void {
  if (_cleanerRunning) return;
  _cleanerRunning = true;
  const clean = () => {
    db.query('DELETE FROM event_seat_holds WHERE expires_at < NOW()')
      .catch(e => console.warn('[events] holdCleaner error:', e));
  };
  setInterval(clean, 60_000);
  clean();
}

export class EventsBookingService {
  // ── HOLD ────────────────────────────────────────
  async createHold(eventId: string, tenantId: string, data: HoldRequest, customerIp?: string) {
    const traceId = extractTraceId(data.traceId);
    const [ttRows] = await db.query<RowDataPacket[]>(
      'SELECT * FROM event_ticket_types WHERE id = ? AND tenant_id = ? AND is_active = 1',
      [data.ticketTypeId, tenantId]
    );
    if (!ttRows.length) throw new AppError('Tipo de entrada no disponible', 404);
    const ticketType = ttRows[0] as any;

    // Disponibilidad = capacity - sold - active_holds
    const [countRows] = await db.query<RowDataPacket[]>(
      `SELECT
        (SELECT COALESCE(SUM(quantity), 0) FROM event_seat_holds WHERE ticket_type_id = ? AND expires_at > NOW()) AS held,
        (SELECT tickets_sold FROM event_ticket_types WHERE id = ?) AS sold`,
      [data.ticketTypeId, data.ticketTypeId]
    );
    const { held, sold } = (countRows[0] as any);
    const available = ticketType.capacity === 0 ? 9999 : ticketType.capacity - sold - held;
    if (available < data.quantity) throw new AppError('No hay suficientes entradas disponibles', 409);

    const holdToken = crypto.randomBytes(18).toString('base64url');
    const holdId = uuidv4();
    await db.query(
      `INSERT INTO event_seat_holds (id, event_id, ticket_type_id, seat_id, hold_token, quantity, customer_ip, customer_session, trace_id, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
      [holdId, eventId, data.ticketTypeId, data.seatIds?.[0] || null, holdToken, data.quantity,
       customerIp || null, data.customerSession || null, traceId, HOLD_TTL_MINUTES]
    );

    const [expRows] = await db.query<RowDataPacket[]>(
      'SELECT expires_at AS expiresAt FROM event_seat_holds WHERE id = ?', [holdId]
    );
    const expiresAt = (expRows[0] as any).expiresAt;
    eventLogger.log({
      tenantId, eventId, traceId, action: 'HOLD_CREATED',
      metadata: { ticketTypeId: data.ticketTypeId, quantity: data.quantity, available: available - data.quantity, expiresAt },
    }).catch(() => {});
    eventBus.emit('SeatHeld', { eventId, tenantId, ticketTypeId: data.ticketTypeId, quantity: data.quantity, traceId, expiresAt }).catch(() => {});
    return { holdToken, expiresAt, available: available - data.quantity, traceId };
  }

  async releaseHold(holdToken: string) {
    await db.query('DELETE FROM event_seat_holds WHERE hold_token = ?', [holdToken]);
    return { released: true };
  }

  // ── CHECKOUT ────────────────────────────────────
  async createCheckout(eventId: string, tenantId: string, data: CheckoutRequest) {
    const [holdRows] = await db.query<RowDataPacket[]>(
      `SELECT esh.*, ett.price, ett.name AS ticket_name
       FROM event_seat_holds esh
       JOIN event_ticket_types ett ON ett.id = esh.ticket_type_id
       WHERE esh.hold_token = ? AND esh.expires_at > NOW()`,
      [data.holdToken]
    );
    if (!holdRows.length) throw new AppError('El tiempo de reserva expiró. Intenta de nuevo.', 410);
    const hold = holdRows[0] as any;
    const traceId = hold.trace_id || generateTraceId();

    // Race-condition final: validar disponibilidad real
    const [availRows] = await db.query<RowDataPacket[]>(
      'SELECT tickets_sold AS sold, capacity AS cap FROM event_ticket_types WHERE id = ?',
      [hold.ticket_type_id]
    );
    const { sold, cap } = (availRows[0] as any);
    if (cap > 0 && sold + hold.quantity > cap) {
      throw new AppError('Las entradas se agotaron mientras reservabas', 409);
    }

    let unitPrice = Number(hold.price);
    let couponId: string | null = null;
    if (data.couponCode) {
      const discount = await this.validateCoupon(data.couponCode, hold.ticket_type_id, hold.quantity, tenantId);
      if (discount) {
        unitPrice = discount.finalPrice;
        couponId = discount.couponId;
      }
    }

    const totalAmount = unitPrice * hold.quantity;
    const bookingId = uuidv4();

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        `INSERT INTO event_bookings (id, event_id, tenant_id, customer_name, customer_email, customer_phone,
         customer_document, total_amount, quantity, hold_token, coupon_id, trace_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [bookingId, eventId, tenantId, data.customerName, data.customerEmail || null,
         data.customerPhone || null, data.customerDocument || null, totalAmount, hold.quantity,
         data.holdToken, couponId, traceId]
      );
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    const { createCheckout } = await import('../payments/payments.service');
    const checkout = await createCheckout({
      context: 'event_booking',
      contextId: bookingId,
      amountInCents: Math.round(totalAmount * 100),
      tenantId,
      currency: 'COP',
      redirectUrl: data.redirectUrl || undefined,
      customerEmail: data.customerEmail,
    });

    eventLogger.log({
      tenantId, eventId, bookingId, traceId, action: 'CHECKOUT_STARTED',
      metadata: { amount: totalAmount, quantity: hold.quantity },
    }).catch(() => {});
    eventBus.emit('PaymentInitiated', { bookingId, eventId, tenantId, traceId, amount: totalAmount }).catch(() => {});

    return { bookingId, checkoutUrl: checkout.checkoutUrl, reference: checkout.reference, totalAmount, traceId };
  }

  // ── CONFIRM BOOKING (webhook) ────────────────────
  async confirmBooking(bookingId: string, reference: string, transactionId: string | null) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // ── IDEMPOTENCIA 1: ¿booking ya procesado? ──
      const [bookings] = await conn.query<RowDataPacket[]>(
        'SELECT * FROM event_bookings WHERE id = ? FOR UPDATE', [bookingId]
      );
      const booking = bookings?.[0] as any;
      if (!booking) {
        await conn.commit();
        console.warn(`[events] confirmBooking: booking ${bookingId} no encontrado`);
        return { alreadyConfirmed: false, reason: 'booking_not_found' };
      }
      if (booking.status !== 'pending') {
        await conn.commit();
        return { alreadyConfirmed: true, status: booking.status };
      }

      // ── State Machine: validar transición pending → confirmed ──
      const transitionCheck = await BookingStateMachine.validate(
        booking.status, 'confirmed',
        { checkinWindowOpen: true }
      );
      if (!transitionCheck.valid) {
        await conn.commit();
        console.warn(`[events] StateMachine bloqueó transición: ${transitionCheck.reason}`);
        return { alreadyConfirmed: false, reason: transitionCheck.reason };
      }

      // ── IDEMPOTENCIA 2: ¿transacción ya registrada? ──
      const [existingTxn] = await conn.query<RowDataPacket[]>(
        'SELECT id FROM event_payment_transactions WHERE external_reference = ? LIMIT 1',
        [reference]
      );
      if (existingTxn.length > 0) {
        await conn.commit();
        console.warn(`[events] confirmBooking: webhook duplicado ref=${reference}, ignorando.`);
        eventLogger.log({
          tenantId: (booking as any).tenant_id, eventId: (booking as any).event_id,
          bookingId, traceId: (booking as any).trace_id,
          action: 'PAYMENT_DUP_WEBHOOK', metadata: { reference },
        }).catch(() => {});
        return { alreadyConfirmed: true, reason: 'dup_webhook' };
      }

      // ── Resolver gateway desde la transacción de Wompi ──
      const [wompiRow] = await conn.query<RowDataPacket[]>(
        'SELECT status FROM wompi_transactions WHERE reference = ? LIMIT 1', [reference]
      );
      const gateway = (wompiRow?.[0] as any)?.status ? 'wompi' : 'wompi';

      // ── Resolver hold ──
      const [holds] = await conn.query<RowDataPacket[]>(
        'SELECT * FROM event_seat_holds WHERE hold_token = ?', [booking.hold_token]
      );
      const hold = holds?.[0] as any;

      // ── ATOMIC ticket_sold: con WHERE capacity check ──
      if (hold?.ticket_type_id) {
        const qty = Number(booking.quantity);
        const [result] = await conn.query<any>(
          `UPDATE event_ticket_types
           SET tickets_sold = tickets_sold + ?
           WHERE id = ? AND is_active = 1
             AND (capacity = 0 OR tickets_sold + ? <= capacity)`,
          [qty, hold.ticket_type_id, qty]
        );
        if (result.affectedRows === 0) {
          // Cupo agotado entre checkout y webhook — reaprovechar
          await conn.rollback();
          // Marcar booking como cancelled para que el hold se libere
          await db.query('UPDATE event_bookings SET status = ? WHERE id = ?', ['cancelled', bookingId]);
          await db.query('DELETE FROM event_seat_holds WHERE hold_token = ?', [booking.hold_token]);
          console.warn(`[events] confirmBooking: cupo agotado para ticket_type=${hold.ticket_type_id} booking=${bookingId}`);
          throw new AppError('Entradas agotadas durante el pago. Se canceló la reserva.', 409);
        }
      }

      // ── Confirmar booking ──
      await conn.query('UPDATE event_bookings SET status = ? WHERE id = ?', ['confirmed', bookingId]);

      const traceId = (booking as any).trace_id || generateTraceId();

      eventLogger.log({
        tenantId: (booking as any).tenant_id, eventId: (booking as any).event_id, bookingId, traceId,
        action: 'PAYMENT_APPROVED',
        metadata: { reference, transactionId, amount: (booking as any).total_amount },
      }).catch(() => {});

      // ── Registrar transacción ──
      await conn.query(
        `INSERT INTO event_payment_transactions (id, booking_id, gateway, status, external_reference, transaction_id, amount, currency)
         VALUES (?, ?, ?, 'approved', ?, ?, ?, 'COP')`,
        [uuidv4(), bookingId, gateway, reference, transactionId, booking.total_amount]
      );

      // ── Generar tickets con QR (v1) ──
      for (let i = 0; i < Number(booking.quantity); i++) {
        const itemId = uuidv4();
        const ticketCode = generateTicketCode(bookingId, i);
        const qrData = generateQRPayload(ticketCode, (booking as any).event_id, 1);
        await conn.query(
          `INSERT INTO event_booking_items (id, booking_id, ticket_type_id, price, ticket_code, qr_data, ticket_version, status)
           VALUES (?, ?, ?, ?, ?, ?, 1, 'active')`,
          [itemId, bookingId, hold?.ticket_type_id || null,
           Number(booking.total_amount) / Number(booking.quantity), ticketCode, qrData]
        );
      }

      eventLogger.log({
        tenantId: (booking as any).tenant_id, eventId: (booking as any).event_id, bookingId, traceId,
        action: 'QR_GENERATED', metadata: { quantity: (booking as any).quantity },
      }).catch(() => {});
      eventBus.emit('TicketGenerated', {
        bookingId, eventId: (booking as any).event_id, tenantId: (booking as any).tenant_id,
        quantity: (booking as any).quantity, traceId,
      }).catch(() => {});

      // ── Liberar hold ──
      await conn.query('DELETE FROM event_seat_holds WHERE hold_token = ?', [booking.hold_token]);

      // ── Cupón counter ──
      if (booking.coupon_id) {
        await conn.query('UPDATE event_coupons SET uses_count = uses_count + 1 WHERE id = ?', [booking.coupon_id]);
      }

      await conn.commit();

      eventLogger.log({
        tenantId: (booking as any).tenant_id, eventId: (booking as any).event_id, bookingId, traceId,
        action: 'BOOKING_CONFIRMED',
        metadata: { quantity: (booking as any).quantity, totalAmount: (booking as any).total_amount },
      }).catch(() => {});

      // ── Dominio: emitir BookingConfirmed → NotificationOrchestrator lo maneja ──
      const [evtData] = await conn.query<RowDataPacket[]>(
        `SELECT e.title, e.event_date, ev.name AS venue_name
         FROM merchant_events e LEFT JOIN event_venues ev ON ev.id = e.venue_id
         WHERE e.id = ?`, [(booking as any).event_id]
      );
      const evInfo = evtData?.[0] as any;

      await conn.commit();

      eventBus.emit('BookingConfirmed', {
        bookingId,
        tenantId: (booking as any).tenant_id,
        eventId: (booking as any).event_id,
        customerName: (booking as any).customer_name,
        customerPhone: (booking as any).customer_phone,
        customerEmail: (booking as any).customer_email,
        quantity: Number((booking as any).quantity),
        totalAmount: Number((booking as any).total_amount),
        eventTitle: evInfo?.title || '',
        eventDate: evInfo?.event_date || '',
        venueName: evInfo?.venue_name || '',
        traceId,
      }).catch(e => console.error('[events] emit BookingConfirmed:', e));

      return { confirmed: true };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  // ── POST-CONFIRM ────────────────────────────────
  private async postConfirm(bookingId: string, booking: any, traceId?: string) {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT eb.*, e.title, e.event_date, ev.name AS venue_name
       FROM event_bookings eb
       JOIN merchant_events e ON e.id = eb.event_id
       LEFT JOIN event_venues ev ON ev.id = e.venue_id
       WHERE eb.id = ?`, [bookingId]
    );
    const data = rows?.[0] as any;
    if (!data) return;

    if (data.customer_phone) {
      try {
        const [cfg] = await db.query<RowDataPacket[]>(
          'SELECT evolution_instance FROM chatbot_config WHERE tenant_id = ? LIMIT 1', [data.tenant_id]
        );
        const instance = cfg?.[0]?.evolution_instance;
        if (instance) {
          const { sendTextMessage } = await import('../whatsapp/whatsapp.service');
          const date = new Date(data.event_date).toLocaleDateString('es-CO', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          });
          const message =
            `🎫 *${data.title}*\n\n` +
            `Hola ${data.customer_name}, tu compra fue confirmada.\n\n` +
            `📦 Entradas: ${data.quantity}\n` +
            `💰 Total: $${Number(data.total_amount).toLocaleString('es-CO')}\n` +
            `📅 ${date}\n` +
            `📍 ${data.venue_name || 'Por confirmar'}\n\n` +
            `Pronto recibirás tus tickets digitales con el código QR de ingreso.`;
          await sendTextMessage(instance, data.customer_phone, message);
          eventLogger.log({
            tenantId: data.tenant_id, eventId: data.event_id, bookingId, traceId,
            action: 'WHATSAPP_SENT', metadata: { phone: data.customer_phone },
          }).catch(() => {});
        }
      } catch (e) { console.warn('[events] WhatsApp postConfirm:', e); }
    }
  }

  // ── COUPON ──────────────────────────────────────
  async validateCoupon(code: string, ticketTypeId: string, quantity: number, tenantId: string) {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT * FROM event_coupons
       WHERE code = ? AND is_active = 1 AND tenant_id = ?
         AND (starts_at IS NULL OR starts_at <= NOW())
         AND (ends_at IS NULL OR ends_at >= NOW())
         AND (max_uses = 0 OR uses_count < max_uses)
         AND (min_tickets <= ?)
         AND (applies_to_ticket_type_id IS NULL OR applies_to_ticket_type_id = ?)
       LIMIT 1`, [code.toUpperCase(), tenantId, quantity, ticketTypeId]
    );
    if (!rows.length) return null;
    const coupon = rows[0] as any;

    const [ttRows] = await db.query<RowDataPacket[]>(
      'SELECT price FROM event_ticket_types WHERE id = ?', [ticketTypeId]
    );
    const basePrice = Number((ttRows[0] as any).price);

    let discountAmount = 0;
    if (coupon.discount_type === 'percentage') {
      discountAmount = Math.round(basePrice * (Number(coupon.discount_value) / 100));
    } else {
      discountAmount = Number(coupon.discount_value);
    }
    return { couponId: coupon.id, discountAmount, finalPrice: Math.max(0, basePrice - discountAmount) };
  }

  // ── CHECK-IN ────────────────────────────────────
  async validateTicket(code: string) {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT ebi.*, eb.event_id, eb.tenant_id, eb.status AS booking_status,
              u.name AS checked_in_by_name
       FROM event_booking_items ebi
       JOIN event_bookings eb ON eb.id = ebi.booking_id
       LEFT JOIN users u ON u.id = ebi.checked_in_by
       WHERE ebi.ticket_code = ? LIMIT 1`, [code]
    );
    if (!rows.length) return { valid: false, reason: 'ticket_no_encontrado' as const };
    const item = rows[0] as any;

    // ── Guard: booking cancelado/refunded ──
    if (item.booking_status === 'cancelled') {
      return { valid: false, reason: 'evento_cancelado' as const };
    }
    if (item.booking_status === 'refunded') {
      return { valid: false, reason: 'ticket_reembolsado' as const };
    }

    // ── Guard: ticket ya usado → info del operador anterior ──
    if (item.status === 'used') {
      return {
        valid: false,
        reason: 'ticket_ya_usado' as const,
        detail: {
          checked_in_at: item.checked_in_at,
          checked_in_by: item.checked_in_by_name || item.checked_in_by || 'Desconocido',
          ticket_code: item.ticket_code,
        },
      };
    }

    // ── Guard: ticket cancelado o transferido ──
    if (item.status === 'cancelled') {
      return { valid: false, reason: 'ticket_cancelado' as const };
    }
    if (item.status === 'transferred') {
      return { valid: false, reason: 'ticket_transferido' as const };
    }

    // ── Verificar HMAC del QR ──
    const signed = verifyQRPayload(item.qr_data || '{}');
    if (!signed.valid) {
      return { valid: false, reason: 'qr_invalido' as const };
    }

    // ── Verificar que la versión del QR coincida con la BD ──
    if (signed.version !== (item.ticket_version || 1)) {
      return { valid: false, reason: 'qr_desactualizado' as const };
    }

    return {
      valid: true as const,
      item: {
        id: item.id,
        ticket_code: item.ticket_code,
        seat_label: item.seat_label,
        row_label: item.row_label,
        guest_name: item.guest_name,
        status: item.status,
        event_id: item.event_id,
        ticket_version: item.ticket_version || 1,
      },
    };
  }

  async checkin(code: string, staffUserId: string) {
    const validation = await this.validateTicket(code);
    if (!validation.valid) throw new AppError(validation.reason!, 400);

    // ── State Machine: validar transición active → used ──
    const smCheck = await TicketStateMachine.validate('active', 'used', {
      checkinWindowOpen: true,
    });
    if (!smCheck.valid) throw new AppError(smCheck.reason!, 403);

    // Re-validar estado real bajo lock para evitar race entre validate y checkin
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT * FROM event_booking_items WHERE ticket_code = ? AND status = ? FOR UPDATE', [code, 'active']
    );
    if (!rows.length) throw new AppError('El ticket ya no está activo (usado/cancelado mientras validabas)', 409);

    await db.query(
      'UPDATE event_booking_items SET status = ?, checked_in_at = NOW(), checked_in_by = ? WHERE ticket_code = ?',
      ['used', staffUserId, code]
    );

    const [userRows] = await db.query<RowDataPacket[]>(
      'SELECT name FROM users WHERE id = ?', [staffUserId]
    );
    const operatorName = (userRows[0] as any)?.name || staffUserId;

    // Log
    const [infoRows] = await db.query<RowDataPacket[]>(
      `SELECT eb.tenant_id, eb.event_id, eb.trace_id
       FROM event_booking_items ebi JOIN event_bookings eb ON eb.id = ebi.booking_id
       WHERE ebi.ticket_code = ? LIMIT 1`, [code]
    );
    const evtInfo = infoRows?.[0] as any;
    eventLogger.log({
      tenantId: evtInfo?.tenant_id, eventId: evtInfo?.event_id,
      traceId: evtInfo?.trace_id, action: 'CHECKIN_SUCCESS',
      actor: operatorName, metadata: { ticket_code: code },
    }).catch(() => {});
    eventBus.emit('CheckinCompleted', {
      eventId: evtInfo?.event_id, tenantId: evtInfo?.tenant_id, ticketCode: code,
      checkedInBy: operatorName, checkedInAt: new Date().toISOString(), traceId: evtInfo?.trace_id,
    }).catch(() => {});

    return {
      success: true,
      checked_in_at: new Date().toISOString(),
      checked_in_by: operatorName,
      ticket_code: code,
      ...validation.item,
    };
  }

  async batchSyncCheckin(checkins: { ticket_code: string; checked_in_at: string }[]) {
    const results: any[] = [];
    for (const c of checkins) {
      try {
        const [rows] = await db.query<RowDataPacket[]>(
          'SELECT * FROM event_booking_items WHERE ticket_code = ? AND status = ?', [c.ticket_code, 'active']
        );
        if (rows.length) {
          await db.query(
            'UPDATE event_booking_items SET status = ?, checked_in_at = ? WHERE ticket_code = ?',
            ['used', c.checked_in_at, c.ticket_code]
          );
          results.push({ ticket_code: c.ticket_code, synced: true });
        } else {
          results.push({ ticket_code: c.ticket_code, synced: false, reason: 'no_activo' });
        }
      } catch { results.push({ ticket_code: c.ticket_code, synced: false }); }
    }
    return { synced: results.filter(r => r.synced).length, results };
  }

  async checkinStats(eventId: string, tenantId: string) {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT
        (SELECT COUNT(*) FROM event_booking_items ebi
         JOIN event_bookings eb ON eb.id = ebi.booking_id
         WHERE eb.event_id = ? AND eb.status = 'confirmed') AS total_sold,
        (SELECT COUNT(*) FROM event_booking_items ebi
         JOIN event_bookings eb ON eb.id = ebi.booking_id
         WHERE eb.event_id = ? AND eb.status = 'confirmed' AND ebi.status = 'used') AS total_checkins`,
      [eventId, eventId]
    );
    const r = rows[0] as any;
    return {
      total_sold: Number(r.total_sold) || 0,
      total_checkins: Number(r.total_checkins) || 0,
      no_show: Math.max(0, (Number(r.total_sold) || 0) - (Number(r.total_checkins) || 0)),
    };
  }

  // ── TRANSFER (versiona QR, invalida anterior) ────
  async transferTicket(itemId: string, toName: string, toEmail?: string) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // ── State Machine: validar active → transferred ──
      const smCheck = await TicketStateMachine.validate('active', 'transferred');
      if (!smCheck.valid) throw new AppError(smCheck.reason!, 403);

      const [items] = await conn.query<RowDataPacket[]>(
        'SELECT * FROM event_booking_items WHERE id = ? AND status = ? FOR UPDATE', [itemId, 'active']
      );
      if (!items.length) throw new AppError('Ticket no encontrado o no transferible (ya usado/transferido)', 404);
      const item = items[0] as any;

      const oldCode = item.ticket_code;
      const oldQR = item.qr_data || '{}';
      let eventId = '';
      try { eventId = JSON.parse(oldQR).e || ''; } catch {}

      // ── Incrementar versión: QR viejo → inválido ──
      const newVersion = (item.ticket_version || 1) + 1;
      const newCode = generateTicketCode(item.booking_id, newVersion);
      const newQR = generateQRPayload(newCode, eventId, newVersion);

      await conn.query(
        `UPDATE event_booking_items
         SET ticket_code = ?, qr_data = ?, guest_name = ?, ticket_version = ? WHERE id = ?`,
        [newCode, newQR, toName, newVersion, itemId]
      );

      await conn.query(
        `INSERT INTO event_transfers (id, booking_item_id, to_name, to_email, old_ticket_code, new_ticket_code, status)
         VALUES (?, ?, ?, ?, ?, ?, 'completed')`,
        [uuidv4(), itemId, toName, toEmail || null, oldCode, newCode]
      );

      await conn.commit();
      eventLogger.log({
        tenantId: '', eventId: eventId, bookingId: item.booking_id,
        traceId: generateTraceId(), action: 'TICKET_TRANSFERRED',
        actor: toName, metadata: { oldCode, newCode, newVersion },
      }).catch(() => {});
      return { new_ticket_code: newCode, new_qr_data: newQR, ticket_version: newVersion };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }
}

export const eventsBookingService = new EventsBookingService();
