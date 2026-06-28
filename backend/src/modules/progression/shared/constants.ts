/**
 * Progression Engine · shared/constants
 * -----------------------------------------------------------------------------
 * TODOS los números mágicos del dominio viven aquí. Si una regla fitness cambia,
 * se cambia en este archivo — nunca incrustada en componentes ni servicios.
 */

import { MovementPattern } from './enums';

/**
 * Incremento de carga (kg) por patrón de movimiento.
 * Tren superior progresa más fino que tren inferior.
 */
export const WEIGHT_INCREMENT_KG: Record<MovementPattern, number> = {
  upper: 2.5,
  lower: 5,
};

/** Incremento por defecto cuando no se especifica patrón ni override. */
export const DEFAULT_INCREMENT_KG = 2.5;

/**
 * Umbrales de la double progression (sobre completion rate respecto al TOPE del rango).
 *  - >= INCREASE: todas las series llegaron al tope → subir.
 *  - >= MAINTAIN (y < INCREASE): rango cumplido parcialmente → mantener.
 *  - <  MAINTAIN: fallo duro → bajar.
 */
export const COMPLETION_THRESHOLD = {
  INCREASE: 1.0,
  MAINTAIN: 0.8,
} as const;

/** Carga mínima admisible (kg). No se permiten pesos negativos ni absurdos. */
export const MIN_WEIGHT_KG = 0;

/** Carga máxima admisible (kg) — tope de cordura para validación de entrada. */
export const MAX_WEIGHT_KG = 1000;

/** Reps máximas por serie — tope de cordura para validación de entrada. */
export const MAX_REPS = 100;
