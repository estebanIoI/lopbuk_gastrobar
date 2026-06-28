/**
 * Workout Runtime · application/events/publisher
 * -----------------------------------------------------------------------------
 * Punto único de publicación de eventos del runtime. Hoy es un no-op con log
 * defensivo: el contrato y el punto de integración existen, pero NO acoplamos
 * todavía analytics/gamificación/IA (Fase posterior). Suscriptores se añaden
 * aquí sin tocar los servicios.
 */

import { WorkoutEvent } from './workout-events';
import { ProgressionComputedEvent } from '../../../progression';

type AnyDomainEvent = WorkoutEvent | ProgressionComputedEvent;
type Subscriber = (event: AnyDomainEvent) => void;

const subscribers: Subscriber[] = [];

/** Registrar un suscriptor (p. ej. analytics) sin tocar los servicios. */
export function onWorkoutEvent(fn: Subscriber): void {
  subscribers.push(fn);
}

/** Publica un evento. Nunca lanza: un suscriptor roto no rompe el entrenamiento. */
export function publishWorkoutEvent(event: AnyDomainEvent): void {
  for (const fn of subscribers) {
    try {
      fn(event);
    } catch (e: any) {
      console.warn('[workout-event] suscriptor falló:', e?.message);
    }
  }
}
