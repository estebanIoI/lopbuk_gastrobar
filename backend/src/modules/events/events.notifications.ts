import { db } from '../../config';
import { RowDataPacket } from 'mysql2';
import { eventBus } from './events.bus';
import type { DomainEvent } from './events.bus';

interface BookingConfirmedPayload {
  bookingId: string;
  tenantId: string;
  eventId: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  quantity: number;
  totalAmount: number;
  eventTitle: string;
  eventDate: string;
  venueName?: string;
  traceId?: string;
}

class NotificationOrchestrator {
  // ── Setup: subscribe to domain events ──────────

  init(): void {
    eventBus.on('BookingConfirmed', (p: BookingConfirmedPayload) => {
      this.onBookingConfirmed(p).catch(e =>
        console.error('[notifications] BookingConfirmed error:', e)
      );
    });
    eventBus.on('EventCancelled', (p: any) => {
      this.onEventCancelled(p).catch(e =>
        console.error('[notifications] EventCancelled error:', e)
      );
    });
    eventBus.on('WaitlistPromoted', (p: any) => {
      this.onWaitlistPromoted(p).catch(e =>
        console.error('[notifications] WaitlistPromoted error:', e)
      );
    });
  }

  // ── Booking Confirmed ──────────────────────────

  private async onBookingConfirmed(payload: BookingConfirmedPayload): Promise<void> {
    const channels: string[] = [];

    if (payload.customerPhone) channels.push('whatsapp');
    if (payload.customerEmail) channels.push('email');
    channels.push('in_app');

    const message = this.buildBookingMessage(payload);

    for (const channel of channels) {
      await this.send(channel, {
        tenantId: payload.tenantId,
        recipient: channel === 'whatsapp' ? payload.customerPhone : payload.customerEmail,
        subject: `Confirmación: ${payload.eventTitle}`,
        body: message,
        metadata: { bookingId: payload.bookingId, eventId: payload.eventId, traceId: payload.traceId },
      }).catch(e => console.error(`[notifications] ${channel} error:`, e));
    }
  }

  private async onEventCancelled(payload: any): Promise<void> {
    // Buscar todos los bookings confirmed y notificar
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT * FROM event_bookings WHERE event_id = ? AND status = 'confirmed'`,
      [payload.eventId]
    );
    for (const booking of rows as any[]) {
      const msg = `⚠️ *${payload.eventTitle}*\n\nLamentamos informarte que el evento "${payload.eventTitle}" ha sido cancelado.\n\nTe contactaremos pronto por el reembolso.`;
      if (booking.customer_phone) {
        await this.send('whatsapp', {
          tenantId: booking.tenant_id,
          recipient: booking.customer_phone,
          subject: 'Evento cancelado',
          body: msg,
        }).catch(() => {});
      }
    }
  }

  private async onWaitlistPromoted(payload: any): Promise<void> {
    const msg = `🎉 *${payload.eventTitle}*\n\nBuenas noticias, ${payload.customerName}.\n\nSe liberaron ${payload.quantity} entradas para el evento.\n\n⏱ Tienes 20 minutos para comprar.\n\nEntra al evento y compra ahora.`;
    if (payload.customerPhone) {
      await this.send('whatsapp', {
        tenantId: payload.tenantId,
        recipient: payload.customerPhone,
        subject: 'Entradas disponibles',
        body: msg,
      }).catch(() => {});
    }
  }

  // ── Channel Senders ────────────────────────────

  private async send(channel: string, params: {
    tenantId: string;
    recipient?: string;
    subject?: string;
    body: string;
    metadata?: any;
  }): Promise<void> {
    switch (channel) {
      case 'whatsapp': await this.sendWhatsApp(params); break;
      case 'email': await this.sendEmail(params); break;
      case 'push': await this.sendPush(params); break;
      case 'in_app': await this.sendInApp(params); break;
      default: console.warn(`[notifications] canal desconocido: ${channel}`);
    }
  }

  private async sendWhatsApp(params: { tenantId: string; recipient?: string; body: string }): Promise<void> {
    if (!params.recipient) return;
    try {
      const [cfg] = await db.query<RowDataPacket[]>(
        'SELECT evolution_instance FROM chatbot_config WHERE tenant_id = ? LIMIT 1',
        [params.tenantId]
      );
      const instance = cfg?.[0]?.evolution_instance;
      if (!instance) return;

      const { sendTextMessage } = await import('../whatsapp/whatsapp.service');
      await sendTextMessage(instance, params.recipient, params.body);
    } catch (e) { console.warn('[notifications] WhatsApp fallback error:', e); }
  }

  private async sendEmail(params: { subject?: string; body: string; recipient?: string }): Promise<void> {
    // Placeholder: módulo de email no existe aún
    if (!params.recipient) return;
    console.log(`[notifications] Email → ${params.recipient}: ${params.subject}`);
  }

  private async sendPush(params: { body: string; recipient?: string; tenantId: string }): Promise<void> {
    // Placeholder: push no completamente implementado aún
  }

  private async sendInApp(params: { tenantId: string; body: string; subject?: string; metadata?: any }): Promise<void> {
    try {
      const { v4: uuidv4 } = await import('uuid');
      await db.query(
        `INSERT INTO merchant_notifications (tenant_id, type, title, message, data)
         VALUES (?, 'new_booking', ?, ?, ?)`,
        [params.tenantId, params.subject || 'Confirmación', params.body,
         params.metadata ? JSON.stringify(params.metadata) : null]
      );
    } catch (e) { console.warn('[notifications] inApp error:', e); }
  }

  // ── Helpers ────────────────────────────────────

  private buildBookingMessage(p: BookingConfirmedPayload): string {
    const date = new Date(p.eventDate).toLocaleDateString('es-CO', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    return `🎫 *${p.eventTitle}*\n\n` +
      `Hola ${p.customerName}, tu compra fue confirmada.\n\n` +
      `📦 Entradas: ${p.quantity}\n` +
      `💰 Total: $${Number(p.totalAmount).toLocaleString('es-CO')}\n` +
      `📅 ${date}\n` +
      `📍 ${p.venueName || 'Por confirmar'}\n\n` +
      `Pronto recibirás tus tickets digitales con el código QR.`;
  }
}

export const notificationOrchestrator = new NotificationOrchestrator();
