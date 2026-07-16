import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config';
import { eventBus } from './events.bus';

interface EventMetric {
  eventId: string;
  tenantId: string;
  totalSales: number;
  totalRevenue: number;
  totalCheckins: number;
  totalCancelled: number;
  totalTransfers: number;
  conversionRate: number;
  noShowRate: number;
  lastSaleAt: string | null;
  lastCheckinAt: string | null;
}

export class AnalyticsEngine {
  private cache = new Map<string, EventMetric>();

  init(): void {
    eventBus.on('BookingConfirmed', (p: any) => this.onBookingConfirmed(p));
    eventBus.on('BookingCancelled', (p: any) => this.onBookingCancelled(p));
    eventBus.on('PaymentDeclined', (p: any) => this.onPaymentDeclined(p));
    eventBus.on('CheckinCompleted', (p: any) => this.onCheckinCompleted(p));
    eventBus.on('TicketTransferred', (p: any) => this.onTransfer(p));
    eventBus.on('CapacityChanged', (p: any) => this.onCapacityChange(p));
  }

  private async onBookingConfirmed(p: any): Promise<void> {
    const key = p.eventId;
    const m = this.cache.get(key) || this.empty(p.eventId, p.tenantId);
    m.totalSales++;
    m.totalRevenue += p.totalAmount || 0;
    m.lastSaleAt = new Date().toISOString();
    this.cache.set(key, m);
    await this.persist(key);

    // Disparar CapacityChanged para que otros subscribers reaccionen
    eventBus.emit('CapacityChanged', { eventId: p.eventId, tenantId: p.tenantId, sold: m.totalSales }).catch(() => {});
  }

  private async onBookingCancelled(p: any): Promise<void> {
    const key = p.eventId;
    const m = this.cache.get(key) || this.empty(p.eventId, p.tenantId);
    m.totalCancelled++;
    this.cache.set(key, m);
    await this.persist(key);
  }

  private async onPaymentDeclined(p: any): Promise<void> {
    const [rows] = await db.query<any>(
      `SELECT COUNT(*) AS declines FROM event_logs
       WHERE event_id = ? AND action = 'PAYMENT_DECLINED' AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
      [p.eventId]
    );
    const declines = rows?.[0]?.declines || 0;
    if (declines === 5 || declines === 10 || declines === 20) {
      eventBus.emit('CapacityAlert', {
        eventId: p.eventId, tenantId: p.tenantId,
        type: 'payment_failures', count: declines,
      }).catch(() => {});
    }
  }

  private async onCheckinCompleted(p: any): Promise<void> {
    const key = p.eventId;
    const m = this.cache.get(key) || this.empty(p.eventId, p.tenantId);
    m.totalCheckins++;
    m.lastCheckinAt = new Date().toISOString();
    this.cache.set(key, m);
    await this.persist(key);
  }

  private onTransfer(p: any): void {
    const key = p.eventId;
    const m = this.cache.get(key) || this.empty(p.eventId, p.tenantId);
    m.totalTransfers++;
    this.cache.set(key, m);
  }

  private async onCapacityChange(p: any): Promise<void> {
    // Verificar umbrales de capacidad para CapacityAlert
    const [tt] = await db.query<any>(
      `SELECT capacity, tickets_sold FROM event_ticket_types WHERE event_id = ? AND capacity > 0`,
      [p.eventId]
    );
    for (const t of tt || []) {
      const pct = t.capacity > 0 ? Math.round((t.tickets_sold / t.capacity) * 100) : 0;
      if ([80, 90, 95, 100].includes(pct)) {
        eventBus.emit('CapacityAlert', {
          eventId: p.eventId, tenantId: p.tenantId,
          type: 'threshold', threshold: pct, ticketTypeId: t.id, ticketTypeName: t.name,
        }).catch(() => {});
      }
    }
  }

  private empty(eventId: string, tenantId: string): EventMetric {
    return { eventId, tenantId, totalSales: 0, totalRevenue: 0, totalCheckins: 0,
      totalCancelled: 0, totalTransfers: 0, conversionRate: 0, noShowRate: 0,
      lastSaleAt: null, lastCheckinAt: null };
  }

  async getMetrics(eventId: string): Promise<EventMetric> {
    const cached = this.cache.get(eventId);
    if (cached) return cached;
    return this.load(eventId);
  }

  private async load(eventId: string): Promise<EventMetric> {
    const [r] = await db.query<any>(
      `SELECT e.tenant_id, COUNT(CASE WHEN eb.status='confirmed' THEN 1 END) AS sales,
         COALESCE(SUM(CASE WHEN eb.status='confirmed' THEN eb.total_amount END), 0) AS revenue,
         COUNT(CASE WHEN ebi.status='used' THEN 1 END) AS checkins,
         COUNT(CASE WHEN eb.status='cancelled' THEN 1 END) AS cancelled
       FROM merchant_events e
       LEFT JOIN event_bookings eb ON eb.event_id = e.id
       LEFT JOIN event_booking_items ebi ON ebi.booking_id = eb.id
       WHERE e.id = ? GROUP BY e.id`, [eventId]
    );
    const d = r?.[0] || {};
    const m: EventMetric = {
      eventId, tenantId: d.tenant_id || '',
      totalSales: Number(d.sales) || 0, totalRevenue: Number(d.revenue) || 0,
      totalCheckins: Number(d.checkins) || 0, totalCancelled: Number(d.cancelled) || 0,
      totalTransfers: 0, conversionRate: 0, noShowRate: 0,
      lastSaleAt: null, lastCheckinAt: null,
    };
    this.cache.set(eventId, m);
    return m;
  }

  private async persist(eventId: string): Promise<void> {
    // En producción usaría una tabla event_metrics; por ahora solo cache
    this.cache.set(eventId, this.cache.get(eventId)!);
  }
}

export const analyticsEngine = new AnalyticsEngine();
