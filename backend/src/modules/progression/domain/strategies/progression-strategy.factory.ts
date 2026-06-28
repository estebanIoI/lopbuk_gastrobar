/**
 * Progression Engine · domain/strategies/factory
 * -----------------------------------------------------------------------------
 * Resuelve la estrategia por tipo. V1 solo conoce 'double_progression'.
 * Pedir una estrategia no registrada lanza (no se inventa comportamiento).
 */

import { ProgressionStrategy } from './progression.strategy';
import { DoubleProgressionStrategy } from './double-progression.strategy';
import { ProgressionType } from '../../shared/enums';

export class UnknownStrategyError extends Error {
  constructor(type: string) {
    super(`UnknownStrategyError: estrategia de progresión '${type}' no registrada`);
    this.name = 'UnknownStrategyError';
  }
}

export class ProgressionStrategyFactory {
  /** Singletons: las estrategias son sin estado, se reutilizan. */
  private static readonly registry: Partial<Record<ProgressionType, ProgressionStrategy>> = {
    double_progression: new DoubleProgressionStrategy(),
    // linear / rir_based → V2+.
  };

  static resolve(type: ProgressionType): ProgressionStrategy {
    const strategy = ProgressionStrategyFactory.registry[type];
    if (!strategy) throw new UnknownStrategyError(type);
    return strategy;
  }

  static isSupported(type: ProgressionType): boolean {
    return !!ProgressionStrategyFactory.registry[type];
  }
}
