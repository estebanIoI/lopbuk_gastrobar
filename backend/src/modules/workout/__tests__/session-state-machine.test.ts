import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SessionStateMachine as SM,
  InvalidSessionTransitionError,
} from '../domain/state-machine/session-state-machine';

test('transiciones válidas', () => {
  assert.equal(SM.canTransition('pending', 'active'), true);
  assert.equal(SM.canTransition('active', 'paused'), true);
  assert.equal(SM.canTransition('paused', 'active'), true);
  assert.equal(SM.canTransition('active', 'completed'), true);
  assert.equal(SM.canTransition('active', 'cancelled'), true);
});

test('transiciones inválidas', () => {
  assert.equal(SM.canTransition('completed', 'active'), false);
  assert.equal(SM.canTransition('cancelled', 'active'), false);
  assert.equal(SM.canTransition('pending', 'completed'), false);
  assert.equal(SM.canTransition('paused', 'completed'), false);
});

test('assertTransition lanza en transición inválida', () => {
  assert.throws(() => SM.assertTransition('completed', 'active'), InvalidSessionTransitionError);
  assert.doesNotThrow(() => SM.assertTransition('active', 'completed'));
});

test('estados terminales', () => {
  assert.equal(SM.isTerminal('completed'), true);
  assert.equal(SM.isTerminal('cancelled'), true);
  assert.equal(SM.isTerminal('active'), false);
  assert.deepEqual(SM.nextStates('completed'), []);
});
