import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { RowDataPacket } from 'mysql2';
import { db } from '../../config';

export type EventAction =
  | 'HOLD_CREATED'
  | 'HOLD_RELEASED'
  | 'HOLD_EXPIRED'
  | 'CHECKOUT_STARTED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_APPROVED'
  | 'PAYMENT_DECLINED'
  | 'PAYMENT_DUP_WEBHOOK'
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_CANCELLED'
  | 'BOOKING_REFUNDED'
  | 'QR_GENERATED'
  | 'WHATSAPP_SENT'
  | 'EMAIL_SENT'
  | 'CHECKIN_SUCCESS'
  | 'CHECKIN_REJECTED'
  | 'CHECKIN_DUP'
  | 'CHECKIN_OFFLINE_SYNC'
  | 'TICKET_TRANSFERRED'
  | 'COUPON_APPLIED'
  | 'COUPON_REJECTED'
  | 'CAPACITY_EXCEEDED'
  | 'WEBHOOK_RECEIVED'
  | 'ERROR';

export function generateTraceId(): string {
  return crypto.randomBytes(12).toString('hex');
}

export function extractTraceId(existing?: string): string {
  return existing || generateTraceId();
}

class EventLogger {
  async log(params: {
    tenantId: string;
    eventId?: string;
    bookingId?: string;
    traceId?: string;
    action: EventAction;
    actor?: string;
    metadata?: Record<string, any>;
  }) {
    const id = uuidv4();
    try {
      await db.query(
        `INSERT INTO event_logs (id, tenant_id, event_id, booking_id, trace_id, action, actor, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, params.tenantId, params.eventId || null, params.bookingId || null,
         params.traceId || null, params.action, params.actor || null,
         params.metadata ? JSON.stringify(params.metadata) : null]
      );
    } catch (e) {
      console.warn('[event-logger] write error:', e);
    }
  }

  async findByTraceId(traceId: string) {
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT * FROM event_logs WHERE trace_id = ? ORDER BY created_at ASC',
      [traceId]
    );
    return rows;
  }

  async findByBookingId(bookingId: string) {
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT * FROM event_logs WHERE booking_id = ? ORDER BY created_at ASC',
      [bookingId]
    );
    return rows;
  }

  async findByEventId(eventId: string, limit = 100, offset = 0) {
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT * FROM event_logs WHERE event_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [eventId, limit, offset]
    );
    return rows;
  }
}

export const eventLogger = new EventLogger();
