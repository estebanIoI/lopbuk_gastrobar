import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  sessionVolume,
  workingWeight,
  completedRepsOf,
  setVolume,
} from '../domain/calculators/session-metrics';
import { WorkoutExercise, WorkoutSet } from '../domain/entities/types';

function set(p: Partial<WorkoutSet>): WorkoutSet {
  return {
    id: 'x', setNumber: 1, targetReps: 12, completedReps: null,
    targetWeight: 20, usedWeight: null, completed: false, completedAt: null, ...p,
  };
}
function exercise(sets: WorkoutSet[]): WorkoutExercise {
  return {
    id: 'e', exerciseId: 'press_banca', name: 'Press banca', order: 0,
    targetSets: sets.length, targetReps: 12, suggestedWeight: 20,
    movementPattern: 'upper', completed: false, sets,
  };
}

test('setVolume: solo cuenta sets completados con datos', () => {
  assert.equal(setVolume(set({ completed: true, completedReps: 10, usedWeight: 20 })), 200);
  assert.equal(setVolume(set({ completed: false, completedReps: 10, usedWeight: 20 })), 0);
  assert.equal(setVolume(set({ completed: true, completedReps: null, usedWeight: 20 })), 0);
});

test('sessionVolume: suma sobre ejercicios y sets', () => {
  const ex = exercise([
    set({ completed: true, completedReps: 12, usedWeight: 20 }),
    set({ completed: true, completedReps: 12, usedWeight: 20 }),
    set({ completed: false }),
  ]);
  assert.equal(sessionVolume([ex]), 480); // 12*20 + 12*20
});

test('workingWeight: moda; empate → mayor; sin completados → null', () => {
  assert.equal(
    workingWeight([
      set({ completed: true, usedWeight: 20 }),
      set({ completed: true, usedWeight: 22.5 }),
      set({ completed: true, usedWeight: 22.5 }),
    ]),
    22.5
  );
  // empate 20 vs 25 (1 y 1) → mayor
  assert.equal(
    workingWeight([
      set({ completed: true, usedWeight: 20 }),
      set({ completed: true, usedWeight: 25 }),
    ]),
    25
  );
  assert.equal(workingWeight([set({ completed: false, usedWeight: 20 })]), null);
});

test('completedRepsOf: reps en orden de sets completados', () => {
  assert.deepEqual(
    completedRepsOf([
      set({ completed: true, completedReps: 12 }),
      set({ completed: false, completedReps: 9 }),
      set({ completed: true, completedReps: 10 }),
    ]),
    [12, 10]
  );
});
