/**
 * Tests · ProgressionService + contratos + factory/rule-engine (integración).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ProgressionService } from '../application/services/progression.service';
import { ProgressionValidationError } from '../shared/schema';
import { UnsupportedGoalError, RuleEngine } from '../domain/rules/goal-rules';
import {
  ProgressionStrategyFactory,
  UnknownStrategyError,
} from '../domain/strategies/progression-strategy.factory';

const service = new ProgressionService();

test('integración: hipertrofia, todas las series al tope → increase', () => {
  const d = service.computeFromRaw({
    goal: 'hypertrophy',
    currentWeight: 22.5,
    targetReps: 12,
    reps: [12, 12, 12, 12],
    movementPattern: 'upper',
  });
  assert.equal(d.action, 'increase');
  assert.equal(d.nextWeight, 25); // +2.5 (upper)
});

test('incremento derivado del patrón: lower → +5kg', () => {
  const d = service.computeFromRaw({
    goal: 'hypertrophy',
    currentWeight: 60,
    targetReps: 12,
    reps: [12, 12, 12],
    movementPattern: 'lower',
  });
  assert.equal(d.action, 'increase');
  assert.equal(d.nextWeight, 65);
});

test('override de incremento tiene prioridad sobre el patrón', () => {
  const d = service.computeFromRaw({
    goal: 'hypertrophy',
    currentWeight: 20,
    targetReps: 12,
    reps: [12, 12, 12, 12],
    movementPattern: 'lower',
    increment: 1,
  });
  assert.equal(d.nextWeight, 21); // usa override 1, no 5
});

test('contrato: entrada inválida lanza ProgressionValidationError', () => {
  assert.throws(
    () => service.computeFromRaw({ goal: 'hypertrophy', currentWeight: -5, targetReps: 12, reps: [12] }),
    ProgressionValidationError
  );
  assert.throws(
    () => service.computeFromRaw({ goal: 'hypertrophy', currentWeight: 20, targetReps: 0, reps: [12] }),
    ProgressionValidationError
  );
  assert.throws(
    () => service.computeFromRaw({ goal: 'hypertrophy', currentWeight: 20, targetReps: 12, reps: [] }),
    ProgressionValidationError
  );
  assert.throws(
    () => service.computeFromRaw({ goal: 'banana', currentWeight: 20, targetReps: 12, reps: [12] }),
    ProgressionValidationError
  );
});

test('anti-alucinación: objetivo no soportado (strength) lanza, no improvisa', () => {
  assert.equal(RuleEngine.isGoalSupported('strength'), false);
  assert.throws(
    () => service.computeFromRaw({ goal: 'strength', currentWeight: 60, targetReps: 5, reps: [5, 5, 5] }),
    UnsupportedGoalError
  );
});

test('factory: solo double_progression está registrada en V1', () => {
  assert.equal(ProgressionStrategyFactory.isSupported('double_progression'), true);
  assert.equal(ProgressionStrategyFactory.isSupported('linear'), false);
  assert.throws(() => ProgressionStrategyFactory.resolve('linear'), UnknownStrategyError);
});

test('safeParse no lanza y reporta issues', () => {
  // importado vía service para no duplicar; usamos el schema directamente
  const { ProgressionInputSchema } = require('../shared/schema');
  const ok = ProgressionInputSchema.safeParse({
    goal: 'hypertrophy',
    currentWeight: 20,
    targetReps: 12,
    reps: [12, 12],
  });
  assert.equal(ok.success, true);
  const bad = ProgressionInputSchema.safeParse({ goal: 'x', currentWeight: -1, targetReps: 0, reps: [] });
  assert.equal(bad.success, false);
  assert.ok(bad.error.issues.length >= 1);
});
