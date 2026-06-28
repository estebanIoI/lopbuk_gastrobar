/**
 * Tests · calculadoras puras (runner nativo node:test, sin deps).
 * Ejecutar:  node --test  (sobre el JS transpilado)  ·  ver scripts del módulo.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { calculateVolume } from '../domain/calculators/volume.calculator';
import {
  calculateCompletionRate,
  calculateAverageReps,
} from '../domain/calculators/completion-rate.calculator';
import { estimate1RM, bestEstimated1RM } from '../domain/calculators/estimated-1rm.calculator';

test('calculateVolume: Σ reps × peso', () => {
  assert.equal(calculateVolume([10, 10, 10, 10], 20), 800);
  assert.equal(calculateVolume([], 20), 0);
  assert.equal(calculateVolume([10], 0), 0);
  assert.equal(calculateVolume([10], -5), 0); // peso negativo → 0
});

test('calculateCompletionRate: acotado a [0,1]', () => {
  // 4 series, objetivo 10, todas 10 → 40/40 = 1
  assert.equal(calculateCompletionRate(10, [10, 10, 10, 10]), 1);
  // por encima del objetivo se acota a 1
  assert.equal(calculateCompletionRate(10, [12, 12, 12, 12]), 1);
  // 10,10,8,7 → 35/40 = 0.875
  assert.equal(calculateCompletionRate(10, [10, 10, 8, 7]), 0.875);
  // entrada vacía / objetivo inválido → 0
  assert.equal(calculateCompletionRate(10, []), 0);
  assert.equal(calculateCompletionRate(0, [10]), 0);
});

test('calculateAverageReps: promedio simple', () => {
  assert.equal(calculateAverageReps([10, 10, 8, 8]), 9);
  assert.equal(calculateAverageReps([]), 0);
});

test('estimate1RM: Epley redondeado a 2 decimales', () => {
  // 100 × (1 + 10/30) = 133.33
  assert.equal(estimate1RM(100, 10), 133.33);
  assert.equal(estimate1RM(0, 10), 0);
  assert.equal(estimate1RM(100, 0), 0);
  // bestEstimated usa la mejor (mayor) cantidad de reps
  assert.equal(bestEstimated1RM([8, 10, 6], 100), estimate1RM(100, 10));
});
