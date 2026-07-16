import { v4 as uuidv4 } from 'uuid';
import pool from '../../config/database';

type EventHandler = (event: EngEvent) => Promise<void>;

interface EngEvent {
  tenantId: string;
  accountId: string | null;
  eventType: string;
  eventData: Record<string, any>;
}

const handlers = new Map<string, EventHandler[]>();

export function onEngagementEvent(eventType: string, handler: EventHandler): void {
  const list = handlers.get(eventType) || [];
  list.push(handler);
  handlers.set(eventType, list);
}

export async function emitEngagementEvent(
  tenantId: string,
  accountId: string | null,
  eventType: string,
  eventData: Record<string, any> = {},
): Promise<void> {
  const id = uuidv4();
  // Persist event (fire-and-forget on error)
  pool.query(
    `INSERT INTO engagement_events (id, tenant_id, account_id, event_type, event_data)
     VALUES (?, ?, ?, ?, ?)`,
    [id, tenantId, accountId, eventType, JSON.stringify(eventData)],
  ).catch(() => {});

  const evt: EngEvent = { tenantId, accountId, eventType, eventData };

  // 1. Check automations for this event type
  try {
    const { processAutomationsForEvent } = await import('./customer-engagement.service');
    await processAutomationsForEvent(evt);
  } catch { /* defensive */ }

  // 2. Run registered handlers
  const list = handlers.get(eventType) || [];
  for (const handler of list) {
    handler(evt).catch(() => {});
  }
}

export function initEngagementEventHandlers(): void {
  onEngagementEvent('sale_completed', async (evt) => {
    if (!evt.accountId) return;
    try {
      const { recalculateLevel } = await import('./customer-engagement.service');
      await recalculateLevel(evt.tenantId, evt.accountId);
    } catch { /* defensive */ }
  });

  onEngagementEvent('points_earned', async (evt) => {
    if (!evt.accountId) return;
    try {
      const { recalculateLevel } = await import('./customer-engagement.service');
      await recalculateLevel(evt.tenantId, evt.accountId);
    } catch { /* defensive */ }
  });
}

