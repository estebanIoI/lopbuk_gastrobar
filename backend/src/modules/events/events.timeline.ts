import { RowDataPacket } from 'mysql2';
import { db } from '../../config';

export interface TimelineEntry {
  id: string;
  timestamp: string;
  action: string;
  description: string;
  actor?: string;
  icon?: string;
  detail?: Record<string, any>;
}

export class EventTimeline {
  async getTimeline(eventId: string, tenantId: string, limit = 100): Promise<TimelineEntry[]> {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT el.action, el.actor, el.metadata, el.created_at AS timestamp, el.id
       FROM event_logs el
       WHERE el.event_id = ? AND el.tenant_id = ?
       ORDER BY el.created_at DESC LIMIT ?`,
      [eventId, tenantId, limit]
    );

    return (rows as any[]).map(r => {
      const meta = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : (r.metadata || {});
      return {
        id: r.id,
        timestamp: r.timestamp,
        action: r.action,
        description: this.describe(r.action, meta),
        actor: r.actor,
        icon: this.iconFor(r.action),
        detail: meta,
      };
    });
  }

  private describe(action: string, meta: any): string {
    switch (action) {
      case 'HOLD_CREATED': return `Reserva temporal de ${meta.quantity || 1} entrada(s) - ${meta.ticketTypeId ? 'Ticket #' + meta.ticketTypeId?.slice(0, 8) : ''}`;
      case 'CHECKOUT_STARTED': return `Checkout iniciado - Total: $${Number(meta.amount || 0).toLocaleString('es-CO')}`;
      case 'PAYMENT_APPROVED': return `Pago aprobado - Ref: ${meta.reference || ''}`;
      case 'PAYMENT_DUP_WEBHOOK': return 'Webhook duplicado - Ignorado';
      case 'BOOKING_CONFIRMED': return `${meta.quantity || 0} entrada(s) confirmada(s)`;
      case 'QR_GENERATED': return `${meta.quantity || 0} código(s) QR generado(s)`;
      case 'BOOKING_CANCELLED': return 'Reserva cancelada';
      case 'CHECKIN_SUCCESS': return `Check-in exitoso - ${meta.ticket_code || ''}`;
      case 'CHECKIN_REJECTED': return 'Check-in rechazado';
      case 'CHECKIN_DUP': return 'Entrada ya utilizada';
      case 'TICKET_TRANSFERRED': return `Entrada transferida a ${meta.to || meta.actor || 'otra persona'}`;
      case 'COUPON_APPLIED': return 'Cupón aplicado';
      case 'COUPON_REJECTED': return 'Cupón rechazado';
      case 'WHATSAPP_SENT': return 'WhatsApp enviado al comprador';
      case 'EMAIL_SENT': return 'Correo enviado al comprador';
      case 'EVENT_PUBLISHED': return 'Evento publicado';
      case 'EVENT_CANCELLED': return 'Evento cancelado';
      case 'HOLD_RELEASED': return 'Reserva temporal liberada';
      case 'HOLD_EXPIRED': return 'Reserva temporal expirada';
      case 'PAYMENT_DECLINED': return 'Pago rechazado';
      case 'BOOKING_REFUNDED': return 'Reembolso procesado';
      case 'CHECKIN_OFFLINE_SYNC': return `${meta.syncCount || 0} check-ins offline sincronizados`;
      case 'CAPACITY_EXCEEDED': return 'Capacidad excedida - Venta bloqueada';
      default: return action.replace(/_/g, ' ').toLowerCase();
    }
  }

  private iconFor(action: string): string {
    const icons: Record<string, string> = {
      HOLD_CREATED: '⏳', CHECKOUT_STARTED: '🛒', PAYMENT_APPROVED: '✅',
      PAYMENT_DUP_WEBHOOK: '🔄', BOOKING_CONFIRMED: '🎫', QR_GENERATED: '📱',
      BOOKING_CANCELLED: '❌', CHECKIN_SUCCESS: '✅', CHECKIN_REJECTED: '🚫',
      CHECKIN_DUP: '⚠️', TICKET_TRANSFERRED: '🔀', COUPON_APPLIED: '🏷️',
      WHATSAPP_SENT: '💬', WHITE_EMAIL_SENT: '📧', EVENT_PUBLISHED: '🚀',
      EVENT_CANCELLED: '⛔', HOLD_EXPIRED: '⏰', PAYMENT_DECLINED: '💳',
      BOOKING_REFUNDED: '💰', CAPACITY_EXCEEDED: '📊',
    };
    return icons[action] || '📌';
  }
}

export const eventTimeline = new EventTimeline();
