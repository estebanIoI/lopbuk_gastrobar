import { db } from '../../config';
import { RowDataPacket } from 'mysql2';

export interface CapacityResult {
  ticketTypeId: string;
  ticketTypeName: string;
  capacity: number;
  sold: number;
  activeHolds: number;
  available: number;
  waitlistCount: number;
  isSoldOut: boolean;
}

export class CapacityEngine {
  async getEventCapacity(eventId: string): Promise<CapacityResult[]> {
    const [ticketTypes] = await db.query<RowDataPacket[]>(
      `SELECT * FROM event_ticket_types WHERE event_id = ? AND is_active = 1 ORDER BY sort_order`,
      [eventId]
    );

    const results: CapacityResult[] = [];
    for (const tt of ticketTypes as any[]) {
      const [holds] = await db.query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(quantity), 0) AS held
         FROM event_seat_holds WHERE ticket_type_id = ? AND expires_at > NOW()`,
        [tt.id]
      );
      const [waitlist] = await db.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS cnt FROM event_waitlists WHERE event_id = ? AND notified_at IS NULL`,
        [eventId]
      );

      const sold = tt.tickets_sold || 0;
      const activeHolds = Number(holds[0]?.held || 0);
      const cap = tt.capacity || 0;
      const available = cap === 0 ? 9999 : cap - sold - activeHolds;

      results.push({
        ticketTypeId: tt.id,
        ticketTypeName: tt.name,
        capacity: cap,
        sold,
        activeHolds,
        available: Math.max(0, available),
        waitlistCount: Number((waitlist[0] as any)?.cnt || 0),
        isSoldOut: cap > 0 && sold >= cap,
      });
    }
    return results;
  }

  async checkAvailability(ticketTypeId: string, quantity: number): Promise<{ available: number; ok: boolean }> {
    const [tt] = await db.query<RowDataPacket[]>(
      'SELECT capacity, tickets_sold FROM event_ticket_types WHERE id = ?', [ticketTypeId]
    );
    if (!tt.length) return { available: 0, ok: false };

    const [holds] = await db.query<RowDataPacket[]>(
      'SELECT COALESCE(SUM(quantity), 0) AS held FROM event_seat_holds WHERE ticket_type_id = ? AND expires_at > NOW()',
      [ticketTypeId]
    );

    const cap = (tt[0] as any).capacity || 0;
    if (cap === 0) return { available: 9999, ok: true };

    const sold = (tt[0] as any).tickets_sold || 0;
    const held = Number(holds[0]?.held || 0);
    const available = cap - sold - held;
    return { available: Math.max(0, available), ok: available >= quantity };
  }
}

export const capacityEngine = new CapacityEngine();
