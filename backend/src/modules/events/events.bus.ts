import type { DomainEventBus } from './events.bus-interface';

type EventHandler = (payload: any) => void | Promise<void>;

export type DomainEvent =
  | 'EventCreated' | 'EventPublished' | 'EventCancelled' | 'EventCompleted' | 'EventUpdated'
  | 'SeatHeld' | 'SeatReleased' | 'HoldExpired'
  | 'PaymentInitiated' | 'PaymentPending' | 'PaymentApproved' | 'PaymentDeclined' | 'PaymentFailed' | 'PaymentDupWebhook'
  | 'BookingConfirmed' | 'BookingCancelled' | 'BookingRefunded' | 'BookingExpired'
  | 'TicketGenerated' | 'TicketTransferred'
  | 'CheckinStarted' | 'CheckinCompleted' | 'CheckinRejected' | 'CheckinOfflineSync'
  | 'CapacityChanged' | 'CapacityAlert'
  | 'WaitlistJoined' | 'WaitlistPromoted'
  | 'NotificationSent' | 'NotificationFailed'
  | 'VenueCreated' | 'VenueUpdated';

class InMemoryEventBus implements DomainEventBus {
  private handlers = new Map<string, EventHandler[]>();

  on(event: string, handler: EventHandler): void {
    if (!this.handlers.has(event)) this.handlers.set(event, []);
    this.handlers.get(event)!.push(handler);
  }

  async emit(event: string, payload: any): Promise<void> {
    const handlers = this.handlers.get(event) || [];
    for (const handler of handlers) {
      try { await handler(payload); }
      catch (e) { console.error(`[event-bus] ${event} handler error:`, e); }
    }
  }

  off(event: string, handler: EventHandler): void {
    const list = this.handlers.get(event);
    if (list) this.handlers.set(event, list.filter(h => h !== handler));
  }

  size(): number {
    let total = 0;
    for (const h of this.handlers.values()) total += h.length;
    return total;
  }
}

export const eventBus: DomainEventBus = new InMemoryEventBus();
