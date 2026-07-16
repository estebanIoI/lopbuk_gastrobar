import { AppError } from '../../common/middleware';

type State = string;
type Transition = [State, State];

interface TransitionRule {
  from: State;
  to: State;
  guard?: (entity: any) => boolean | Promise<boolean>;
  reason?: string;
}

class StateMachine {
  private transitions = new Map<string, TransitionRule[]>();
  private initialState: State;

  constructor(name: string, states: State[], transitions: TransitionRule[]) {
    this.initialState = states[0];
    for (const t of transitions) {
      const key = t.from;
      if (!this.transitions.has(key)) this.transitions.set(key, []);
      this.transitions.get(key)!.push(t);
    }
  }

  getInitial(): State {
    return this.initialState;
  }

  canTransition(from: State, to: State): boolean {
    const rules = this.transitions.get(from) || [];
    return rules.some(r => r.to === to);
  }

  async validate(from: State, to: State, entity: any = {}): Promise<{ valid: boolean; reason?: string }> {
    const rules = this.transitions.get(from) || [];
    const rule = rules.find(r => r.to === to);
    if (!rule) {
      return { valid: false, reason: `Transición inválida: ${from} → ${to}` };
    }
    if (rule.guard) {
      try {
        const ok = typeof rule.guard === 'function'
          ? await (rule.guard as any)(entity)
          : true;
        if (!ok) return { valid: false, reason: rule.reason || `Guard falló: ${from} → ${to}` };
      } catch {
        return { valid: false, reason: `Error en validación: ${from} → ${to}` };
      }
    }
    return { valid: true };
  }

  transition(from: State, to: State, entity?: any): State {
    if (!this.canTransition(from, to)) {
      throw new AppError(`Transición inválida: ${from} → ${to}`, 400);
    }
    return to;
  }

  async transitionWithGuard(from: State, to: State, entity?: any): Promise<State> {
    const validation = await this.validate(from, to, entity);
    if (!validation.valid) throw new AppError(validation.reason!, 400);
    return to;
  }

  getTransitionsFrom(from: State): State[] {
    return (this.transitions.get(from) || []).map(r => r.to);
  }

  getTransitionsTo(to: State): State[] {
    const result: State[] = [];
    for (const [from, rules] of this.transitions.entries()) {
      if (rules.some(r => r.to === to)) result.push(from);
    }
    return result;
  }
}

// ── Event Lifecycle ─────────────────────────────

export const EventStateMachine = new StateMachine('Event', [
  'draft', 'published', 'sales_open', 'almost_full', 'sold_out',
  'checkin_open', 'live', 'finished', 'cancelled', 'archived',
], [
  { from: 'draft', to: 'published', guard: (e) => !!e?.ticketCount, reason: 'El evento necesita al menos un tipo de entrada activo' },
  { from: 'published', to: 'sales_open', reason: 'Venta abierta' },
  { from: 'published', to: 'cancelled' },
  { from: 'sales_open', to: 'almost_full', reason: 'Capacidad al 80%' },
  { from: 'sales_open', to: 'sold_out', reason: 'Agotado' },
  { from: 'sales_open', to: 'cancelled' },
  { from: 'almost_full', to: 'sold_out', reason: 'Agotado' },
  { from: 'almost_full', to: 'cancelled' },
  { from: 'sold_out', to: 'cancelled' },
  { from: 'published', to: 'checkin_open', reason: 'Check-in habilitado' },
  { from: 'sales_open', to: 'checkin_open', reason: 'Check-in habilitado' },
  { from: 'almost_full', to: 'checkin_open', reason: 'Check-in habilitado' },
  { from: 'sold_out', to: 'checkin_open', reason: 'Check-in habilitado' },
  { from: 'checkin_open', to: 'live', reason: 'Evento iniciado' },
  { from: 'live', to: 'finished', reason: 'Evento terminado' },
  { from: 'finished', to: 'archived', reason: 'Archivado' },
  { from: 'cancelled', to: 'archived' },
]);

// ── Booking Lifecycle ────────────────────────────

export const BookingStateMachine = new StateMachine('Booking', [
  'hold', 'pending', 'confirmed', 'checked_in', 'transferred',
  'refunded', 'cancelled', 'expired',
], [
  // Hold → Checkout
  { from: 'hold', to: 'pending', reason: 'Checkout iniciado' },
  { from: 'hold', to: 'expired', reason: 'Hold expirado' },

  // Pago
  { from: 'pending', to: 'confirmed', reason: 'Pago aprobado' },
  { from: 'pending', to: 'cancelled', reason: 'Pago rechazado / timeout' },
  { from: 'pending', to: 'expired', reason: 'Booking expirado sin pago' },

  // Confirmado
  { from: 'confirmed', to: 'checked_in', guard: (b) => b?.checkinWindowOpen !== false, reason: 'Check-in fuera de ventana' },
  { from: 'confirmed', to: 'transferred', reason: 'Transferido' },
  { from: 'confirmed', to: 'refunded', reason: 'Reembolsado' },
  { from: 'confirmed', to: 'cancelled', reason: 'Cancelado' },

  // Check-in
  { from: 'checked_in', to: 'transferred', reason: 'No transferible después de check-in' },

  // Transferido
  { from: 'transferred', to: 'checked_in', reason: 'Check-in del nuevo dueño' },
  { from: 'transferred', to: 'refunded', reason: 'Reembolsado' },
  { from: 'transferred', to: 'cancelled', reason: 'Cancelado' },

  // Terminales
  { from: 'refunded', to: 'cancelled', reason: 'Cancelación post-reembolso' },
]);

// ── Check-in Item Lifecycle ──────────────────────

export const TicketStateMachine = new StateMachine('Ticket', [
  'active', 'used', 'cancelled', 'transferred',
], [
  { from: 'active', to: 'used', reason: 'Check-in exitoso' },
  { from: 'active', to: 'cancelled', reason: 'Cancelado' },
  { from: 'active', to: 'transferred', reason: 'Transferido' },
  { from: 'transferred', to: 'used', reason: 'Check-in exitoso' },
  { from: 'transferred', to: 'cancelled', reason: 'Cancelado' },
]);

export { StateMachine };
