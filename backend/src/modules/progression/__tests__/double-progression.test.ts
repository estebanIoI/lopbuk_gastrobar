/**
 * Tests · DoubleProgressionStrategy (hipertrofia 8-12). El corazón del motor.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DoubleProgressionStrategy } from '../domain/strategies/double-progression.strategy';
import { RuleEngine } from '../domain/rules/goal-rules';
import { StrategyInput } from '../domain/strategies/progression.strategy';

const rules = RuleEngine.getGoalRules('hypertrophy');
const strategy = new DoubleProgressionStrategy();

function run(partial: Partial<StrategyInput>): ReturnType<DoubleProgressionStrategy['execute']> {
  const input: StrategyInput = {
    currentWeight: 20,
    targetReps: 12,
    reps: [12, 12, 12, 12],
    increment: 2.5,
    rules,
    ...partial,
  };
  return strategy.execute(input);
}

test('SUBIR: 12 reps en todas las series → increase +2.5kg, confianza 1', () => {
  const d = run({ reps: [12, 12, 12, 12] });
  assert.equal(d.action, 'increase');
  assert.equal(d.nextWeight, 22.5);
  assert.equal(d.confidence, 1);
  assert.ok(d.reasons.includes('completed_all_sets'));
});

test('MANTENER: dentro del rango pero sin llegar al tope → maintain, mismo peso', () => {
  // objetivo 12; reps 10,10,10,10 → rate 40/48 ≈ 0.833 (≥0.8, <1) y avg 10 ≥ min 8
  const d = run({ reps: [10, 10, 10, 10] });
  assert.equal(d.action, 'maintain');
  assert.equal(d.nextWeight, 20);
  assert.ok(d.confidence >= 0.7 && d.confidence < 1);
  assert.ok(d.reasons.includes('in_range_not_max'));
});

test('BAJAR: fallo duro bajo el mínimo del rango → decrease -2.5kg', () => {
  // objetivo 12; reps 10,6,5,4 → avg 6.25 < min 8 → decrease
  const d = run({ reps: [10, 6, 5, 4] });
  assert.equal(d.action, 'decrease');
  assert.equal(d.nextWeight, 17.5);
  assert.ok(d.confidence >= 0.6 && d.confidence <= 1);
  assert.ok(d.reasons.includes('failed_hard'));
});

test('BAJAR: rate < 0.8 aunque avg roce el mínimo → decrease', () => {
  // objetivo 12; reps 9,9,7,7 → avg 8 (= min) pero rate 32/48 ≈ 0.667 < 0.8 → decrease
  const d = run({ reps: [9, 9, 7, 7] });
  assert.equal(d.action, 'decrease');
});

test('límite inferior: no produce peso negativo', () => {
  const d = run({ currentWeight: 2, increment: 2.5, reps: [3, 3, 2, 2] });
  assert.equal(d.action, 'decrease');
  assert.ok(d.nextWeight >= 0);
});

test('redondeo a la rejilla del incremento (sin ruido de coma flotante)', () => {
  const d = run({ currentWeight: 20, increment: 2.5, reps: [12, 12, 12, 12] });
  assert.equal(d.nextWeight, 22.5);
  // incremento de tren inferior (5kg)
  const d2 = run({ currentWeight: 60, increment: 5, reps: [12, 12, 12, 12] });
  assert.equal(d2.nextWeight, 65);
});

test('métricas derivadas presentes y coherentes', () => {
  const d = run({ currentWeight: 20, reps: [12, 12, 12, 12] });
  assert.equal(d.metrics.totalVolume, 12 * 4 * 20); // 960
  assert.equal(d.metrics.completionRate, 1);
  assert.equal(d.metrics.avgReps, 12);
  assert.ok(d.metrics.estimated1RM > 0);
});

test('determinismo: misma entrada → misma salida', () => {
  const a = run({ reps: [11, 10, 10, 9] });
  const b = run({ reps: [11, 10, 10, 9] });
  assert.deepEqual(a, b);
});
