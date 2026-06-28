/**
 * Workout Runtime · shared/enums
 * -----------------------------------------------------------------------------
 * Vocabulario cerrado del runtime de entrenamiento. Estados explícitos, nada de
 * "boolean hell". El módulo workout es del CONSUMIDOR (scope = users.id),
 * igual que `rutina` — no lleva tenant_id.
 */

/** Ciclo de vida de una sesión de entrenamiento. */
export const SESSION_STATUSES = [
  'pending',
  'active',
  'paused',
  'completed',
  'cancelled',
] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

/** Estado de un set. V1: pendiente o completado (sin sub-estados de timer). */
export const SET_STATUSES = ['pending', 'completed'] as const;
export type SetStatus = (typeof SET_STATUSES)[number];

export const isSessionStatus = (v: unknown): v is SessionStatus =>
  typeof v === 'string' && (SESSION_STATUSES as readonly string[]).includes(v);

/** Estados terminales: no admiten más transiciones. */
export const TERMINAL_STATUSES: readonly SessionStatus[] = ['completed', 'cancelled'];
