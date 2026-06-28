import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeExerciseProgression } from '../application/services/progression-bridge';
import { WorkoutExercise, WorkoutSet } from '../domain/entities/types';

function set(p: Partial<WorkoutSet>): WorkoutSet {
  return {
    id: 'x', setNumber: 1, targetReps: 12, completedReps: null,
    targetWeight: 20, usedWeight: null, completed: false, completedAt: null, ...p,
  };
}
function exercise(p: Partial<WorkoutExercise>, sets: WorkoutSet[]): WorkoutExercise {
  return {
    id: 'e', exerciseId: 'press_banca', name: 'Press banca', order: 0,
    targetSets: sets.length, targetReps: 12, suggestedWeight: 20,
    movementPattern: 'upper', completed: false, sets, ...p,
  };
}

test('sin sets completados → null (no hay señal)', () => {
  const ex = exercise({}, [set({ completed: false }), set({ completed: false })]);
  assert.equal(computeExerciseProgression(ex, 'hypertrophy'), null);
});

test('todas al tope → increase, nextWeight +2.5 (upper)', () => {
  const ex = exercise({}, [
    set({ completed: true, completedReps: 12, usedWeight: 20 }),
    set({ completed: true, completedReps: 12, usedWeight: 20 }),
    set({ completed: true, completedReps: 12, usedWeight: 20 }),
  ]);
  const r = computeExerciseProgression(ex, 'hypertrophy')!;
  assert.equal(r.decision.action, 'increase');
  assert.equal(r.currentWeight, 20);
  assert.equal(r.snapshot.nextWeight, 22.5);
  assert.equal(r.snapshot.exerciseId, 'press_banca');
});

test('fallo duro → decrease', () => {
  const ex = exercise({}, [
    set({ completed: true, completedReps: 6, usedWeight: 20 }),
    set({ completed: true, completedReps: 5, usedWeight: 20 }),
    set({ completed: true, completedReps: 4, usedWeight: 20 }),
  ]);
  const r = computeExerciseProgression(ex, 'hypertrophy')!;
  assert.equal(r.decision.action, 'decrease');
  assert.equal(r.snapshot.nextWeight, 17.5);
});

test('peso de trabajo = moda de usedWeight de sets completados', () => {
  const ex = exercise({}, [
    set({ completed: true, completedReps: 12, usedWeight: 22.5 }),
    set({ completed: true, completedReps: 12, usedWeight: 22.5 }),
    set({ completed: false, usedWeight: 25 }),
  ]);
  const r = computeExerciseProgression(ex, 'hypertrophy')!;
  assert.equal(r.currentWeight, 22.5);
});
