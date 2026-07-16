import { AppError } from '../../common/middleware';

export interface EventPolicyRules {
  // Venta
  saleStartsAt?: string;
  saleEndsAt?: string;
  // Check-in
  checkinOpensBeforeMinutes?: number; // ej: 120 = 2h antes
  // Transferencia
  transferUntilHoursBefore?: number;  // ej: 24 = hasta 24h antes
  // Reembolso
  refundPolicy: 'none' | '24h' | '48h' | 'auto' | 'manual';
  // Restricciones
  minAge?: number;
  maxTicketsPerUser?: number;
  requireRegistration?: boolean;
  // Capacidad por ticket type (dict)
  ticketTypeCapacities?: Record<string, number>;
}

export class EventsPolicyEngine {
  constructor(private rules: EventPolicyRules, private eventStartDate: Date) {}

  // ── Validación de ventana de venta ──
  validateSaleWindow(): void {
    const now = new Date();
    if (this.rules.saleStartsAt && new Date(this.rules.saleStartsAt) > now) {
      throw new AppError('La venta de entradas aún no ha comenzado', 403);
    }
    if (this.rules.saleEndsAt && new Date(this.rules.saleEndsAt) < now) {
      throw new AppError('La venta de entradas ha finalizado', 403);
    }
  }

  // ── Check-in window ──
  validateCheckinWindow(): void {
    if (!this.rules.checkinOpensBeforeMinutes) return;
    const now = new Date();
    const opensAt = new Date(this.eventStartDate.getTime() - this.rules.checkinOpensBeforeMinutes * 60_000);
    if (now < opensAt) {
      throw new AppError(`El check-in estará disponible ${this.rules.checkinOpensBeforeMinutes} minutos antes del evento`, 403);
    }
  }

  // ── Transfer window ──
  validateTransferWindow(): void {
    const now = new Date();
    if (this.eventStartDate <= now) {
      throw new AppError('No se pueden transferir entradas después del inicio del evento', 403);
    }
    if (this.rules.transferUntilHoursBefore) {
      const cutoff = new Date(this.eventStartDate.getTime() - this.rules.transferUntilHoursBefore * 3_600_000);
      if (now > cutoff) {
        throw new AppError(`Las transferencias cierran ${this.rules.transferUntilHoursBefore}h antes del evento`, 403);
      }
    }
  }

  // ── Refund window ──
  validateRefundWindow(): boolean {
    const policy = this.rules.refundPolicy || 'none';
    if (policy === 'none') return false;
    if (policy === 'manual') return true; // requiere aprobación manual
    if (policy === 'auto') return true;
    const hours = policy === '24h' ? 24 : 48;
    const now = new Date();
    const cutoff = new Date(this.eventStartDate.getTime() - hours * 3_600_000);
    return now <= cutoff;
  }

  // ── Age restriction ──
  validateAge(userAge: number): void {
    if (this.rules.minAge && userAge < this.rules.minAge) {
      throw new AppError(`Este evento requiere edad mínima de ${this.rules.minAge} años`, 403);
    }
  }

  // ── Max tickets per user ──
  async validateMaxTickets(tenantId: string, userId: string, eventId: string, requestedQty: number): Promise<void> {
    const max = this.rules.maxTicketsPerUser || 10;
    if (max <= 0) return; // sin límite
    const { db } = await import('../../config');
    const [rows] = await db.query<any>(
      `SELECT COALESCE(SUM(quantity), 0) AS bought
       FROM event_bookings
       WHERE event_id = ? AND tenant_id = ? AND user_id = ? AND status IN ('pending', 'confirmed')`,
      [eventId, tenantId, userId]
    );
    const bought = Number(rows?.[0]?.bought || 0);
    if (bought + requestedQty > max) {
      throw new AppError(`Máximo ${max} entradas por persona. Ya tienes ${bought}.`, 403);
    }
  }

  // ── Require registration ──
  validateRegistration(hasUserId: boolean): void {
    if (this.rules.requireRegistration && !hasUserId) {
      throw new AppError('Este evento requiere registro de usuario para comprar entradas', 403);
    }
  }

  // ── Ticket type capacity ──
  validateTicketTypeCapacity(ticketTypeId: string, requestedQty: number): void {
    if (!this.rules.ticketTypeCapacities) return;
    const cap = this.rules.ticketTypeCapacities[ticketTypeId];
    if (cap !== undefined && requestedQty > cap) {
      throw new AppError(`Máximo ${cap} entradas de este tipo por compra`, 403);
    }
  }

  // ── Evalúa todo de una vez ──
  async enforceSaleRules(params: {
    ticketTypeId: string;
    requestedQty: number;
    tenantId: string;
    userId?: string;
    userAge?: number;
    eventId: string;
  }): Promise<void> {
    this.validateSaleWindow();
    this.validateRegistration(!!params.userId);
    this.validateTicketTypeCapacity(params.ticketTypeId, params.requestedQty);
    if (params.userAge !== undefined) this.validateAge(params.userAge);
    if (params.userId) await this.validateMaxTickets(params.tenantId, params.userId, params.eventId, params.requestedQty);
  }

  static fromEvent(event: any): EventsPolicyEngine {
    return new EventsPolicyEngine(
      {
        refundPolicy: event.refund_policy || 'none',
        minAge: event.min_age || 0,
        maxTicketsPerUser: event.max_tickets_per_user || 10,
      },
      new Date(event.event_date || event.eventDate)
    );
  }
}

export const policy = EventsPolicyEngine;
