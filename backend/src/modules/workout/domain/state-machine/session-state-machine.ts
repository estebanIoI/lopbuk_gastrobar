/**
 * Workout Runtime · domain/state-machine
 * -----------------------------------------------------------------------------
 * Máquina de estados EXPLÍCITA de la sesión. Toda transición pasa por aquí; no
 * se cambia `status` a mano en ningún servicio. Determinística y sin estado.
 *
 *   pending  → active, cancelled
 *   active   → paused, completed, cancelled
 *   paused   → active, cancelled
 *   completed→ (terminal)
 *   cancelled→ (terminal)
 */

import { SessionStatus, TERMINAL_STATUSES } from '../../shared/enums';

const TRANSITIONS: Record<SessionStatus, readonly SessionStatus[]> = {
  pending: ['active', 'cancelled'],
  active: ['paused', 'completed', 'cancelled'],
  paused: ['active', 'cancelled'],
  completed: [],
  cancelled: [],
};

export class InvalidSessionTransitionError extends Error {
  readonly statusCode = 409;
  constructor(from: SessionStatus, to: SessionStatus) {
    super(`Transición de sesión inválida: '${from}' → '${to}'`);
    this.name = 'InvalidSessionTransitionError';
  }
}

export const SessionStateMachine = {
  canTransition(from: SessionStatus, to: SessionStatus): boolean {
    return TRANSITIONS[from]?.includes(to) ?? false;
  },

  /** Lanza si la transición no está permitida. */
  assertTransition(from: SessionStatus, to: SessionStatus): void {
    if (!SessionStateMachine.canTransition(from, to)) {
      throw new InvalidSessionTransitionError(from, to);
    }
  },

  isTerminal(status: SessionStatus): boolean {
    return TERMINAL_STATUSES.includes(status);
  },

  nextStates(from: SessionStatus): readonly SessionStatus[] {
    return TRANSITIONS[from] ?? [];
  },
};
