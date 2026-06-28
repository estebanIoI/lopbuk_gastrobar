/**
 * Progression Engine · API pública del módulo
 * -----------------------------------------------------------------------------
 * Único punto de entrada permitido para el resto del sistema. Importar desde
 * rutas internas profundas está desaconsejado: consume SIEMPRE este barrel.
 *
 * V1: hipertrofia + double progression. Núcleo puro, determinístico, sin deps.
 */

// ---- Servicio (orquestador) -------------------------------------------------
export {
  ProgressionService,
  progressionService,
} from './application/services/progression.service';

// ---- Contratos --------------------------------------------------------------
export {
  ProgressionInputSchema,
  ProgressionValidationError,
} from './shared/schema';
export type { ProgressionInputRaw } from './shared/schema';

// ---- Entidades / tipos ------------------------------------------------------
export type {
  ExercisePerformance,
  ProgressionDecision,
  GoalRules,
} from './domain/entities/types';

// ---- Enums ------------------------------------------------------------------
export {
  PROGRESSION_ACTIONS,
  GOAL_TYPES,
  PROGRESSION_TYPES,
  MOVEMENT_PATTERNS,
} from './shared/enums';
export type {
  ProgressionAction,
  GoalType,
  ProgressionType,
  MovementPattern,
} from './shared/enums';

// ---- Rule engine ------------------------------------------------------------
export { RuleEngine, GOAL_RULES, UnsupportedGoalError } from './domain/rules/goal-rules';

// ---- Strategies (para extender: registrar nuevas en la factory) -------------
export { ProgressionStrategyFactory, UnknownStrategyError } from './domain/strategies/progression-strategy.factory';
export type { ProgressionStrategy, StrategyInput } from './domain/strategies/progression.strategy';

// ---- Calculadoras puras (reutilizables por analytics) -----------------------
export { calculateVolume } from './domain/calculators/volume.calculator';
export {
  calculateCompletionRate,
  calculateAverageReps,
} from './domain/calculators/completion-rate.calculator';
export { estimate1RM, bestEstimated1RM } from './domain/calculators/estimated-1rm.calculator';

// ---- Evento de dominio ------------------------------------------------------
export {
  PROGRESSION_COMPUTED,
  buildProgressionComputedEvent,
} from './application/events/progression-computed.event';
export type { ProgressionComputedEvent } from './application/events/progression-computed.event';
