/**
 * Progression Engine · domain/entities
 * -----------------------------------------------------------------------------
 * Entidades PURAS del dominio. Sin prisma, sin mysql, sin react, sin express.
 * Solo tipos y formas. Estas son las piezas con las que razona el motor.
 */

import {
  GoalType,
  ProgressionAction,
  ProgressionType,
  MovementPattern,
} from '../../shared/enums';

/**
 * Rendimiento de UN ejercicio en UNA sesión — lo que el usuario realmente hizo.
 * Es el insumo principal del motor de progresión.
 */
export interface ExercisePerformance {
  goal: GoalType;
  /** Estrategia explícita; si falta, se deriva de las reglas del objetivo. */
  progressionType?: ProgressionType;
  /** Patrón del movimiento → determina el incremento de carga. */
  movementPattern?: MovementPattern;
  /** Carga usada en la sesión (kg). */
  currentWeight: number;
  /** Override del incremento (kg). Si falta, se deriva del patrón. */
  increment?: number;
  /** Reps objetivo por serie (tope del rango para hipertrofia). */
  targetReps: number;
  /** Reps realizadas en cada serie, en orden. */
  reps: number[];
}

/** Rangos y parámetros de un objetivo de entrenamiento. */
export interface GoalRules {
  goal: GoalType;
  repRange: { min: number; max: number };
  progression: {
    type: ProgressionType;
    /** completion rate ≥ → subir. */
    increaseThreshold: number;
    /** completion rate ≥ → mantener (por debajo: bajar). */
    maintainThreshold: number;
  };
  restSeconds: { min: number; max: number };
}

/**
 * Decisión estructurada del motor. SALIDA canónica.
 * Determinística: la misma entrada produce siempre la misma decisión.
 */
export interface ProgressionDecision {
  action: ProgressionAction;
  /** Carga sugerida para la próxima sesión (kg), redondeada al incremento. */
  nextWeight: number;
  /** Confianza 0..1 de la decisión (qué tan limpia fue la señal). */
  confidence: number;
  /** Razones legibles y deterministas (códigos + texto) para auditar la decisión. */
  reasons: string[];
  /** Métricas derivadas, útiles para analytics y para que la IA EXPLIQUE (no decida). */
  metrics: {
    completionRate: number;
    totalVolume: number;
    avgReps: number;
    estimated1RM: number;
  };
}
