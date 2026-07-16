import { db } from '../../config';
import { RowDataPacket } from 'mysql2';

interface ScheduledJob {
  name: string;
  intervalMs: number;
  run: () => Promise<void>;
}

const jobs: ScheduledJob[] = [];

let _started = false;

export function addJob(name: string, intervalMs: number, run: () => Promise<void>): void {
  jobs.push({ name, intervalMs, run });
  if (_started) startJob(jobs[jobs.length - 1]);
}

function startJob(job: ScheduledJob): void {
  const loop = () => {
    job.run().catch(e => console.error(`[scheduler] ${job.name} error:`, e));
  };
  loop();
  setInterval(loop, job.intervalMs);
}

export function startScheduler(): void {
  if (_started) return;
  _started = true;

  // ── Hold Cleaner (60s) ──
  addJob('hold-cleaner', 60_000, async () => {
    await db.query('DELETE FROM event_seat_holds WHERE expires_at < NOW()');
  });

  // ── Stale Bookings (5 min): cancela bookings pending >30 min ──
  addJob('stale-bookings', 300_000, async () => {
    await db.query(
      `UPDATE event_bookings SET status = 'cancelled'
       WHERE status = 'pending' AND created_at < DATE_SUB(NOW(), INTERVAL 30 MINUTE)`
    );
  });

  // ── Waitlist Promotion (60s): notifica waitlist cuando hay cupo ──
  addJob('waitlist-promote', 60_000, async () => {
    const [events] = await db.query<RowDataPacket[]>(
      `SELECT e.id, e.title, e.tenant_id FROM merchant_events e
       WHERE e.status = 'published' AND e.is_active = 1
         AND e.event_date > NOW()`
    );
    for (const event of events as any[]) {
      const [tt] = await db.query<RowDataPacket[]>(
        `SELECT ett.*, (ett.capacity - ett.tickets_sold) AS available
         FROM event_ticket_types ett WHERE ett.event_id = ? AND ett.is_active = 1
         HAVING available > 0 LIMIT 1`, [event.id]
      );
      if (!tt.length) continue;

      const [waitlist] = await db.query<RowDataPacket[]>(
        `SELECT * FROM event_waitlists
         WHERE event_id = ? AND notified_at IS NULL ORDER BY created_at ASC LIMIT 1`,
        [event.id]
      );
      if (!waitlist.length) continue;
      const w = waitlist[0] as any;

      const holdToken = await import('crypto').then(c => c.randomBytes(18).toString('base64url'));
      const expiry = new Date(Date.now() + 20 * 60_000).toISOString().slice(0, 19).replace('T', ' ');

      await db.query(
        `INSERT INTO event_seat_holds (id, event_id, ticket_type_id, hold_token, quantity, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [require('uuid').v4(), event.id, (tt[0] as any).id, holdToken, w.quantity, expiry]
      );
      await db.query(
        'UPDATE event_waitlists SET notified_at = NOW(), expires_at = ? WHERE id = ?',
        [expiry, w.id]
      );

      // Emitir evento de notificación (waitlist promoted)
      const { eventBus } = await import('./events.bus');
      await eventBus.emit('WaitlistPromoted', {
        eventId: event.id,
        eventTitle: event.title,
        tenantId: event.tenant_id,
        customerName: w.customer_name,
        customerPhone: w.customer_phone,
        customerEmail: w.customer_email,
        quantity: w.quantity,
      });
    }
  });

  // ── Close Past Events (cada 10 min) ──
  addJob('close-events', 600_000, async () => {
    await db.query(
      `UPDATE merchant_events SET status = 'completed'
       WHERE status = 'published' AND event_date < NOW() - INTERVAL 1 DAY`
    );
  });

  console.log(`[scheduler] events: ${jobs.length} jobs iniciados`);
}
