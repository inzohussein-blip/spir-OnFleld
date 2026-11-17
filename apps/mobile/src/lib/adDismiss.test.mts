/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dismissToday, firstVisible, isDismissedToday } from './adDismiss.ts';

test('dismissed ads come back tomorrow', () => {
  const today = new Date(2026, 10, 17, 20);
  const tomorrow = new Date(2026, 10, 18, 9);
  const ads = [{ id: 'a' }, { id: 'b' }];
  let map = dismissToday({}, 'a', today);
  assert.equal(isDismissedToday(map, 'a', today), true);
  assert.equal(firstVisible(ads, map, today)?.id, 'b');
  assert.equal(firstVisible(ads, map, tomorrow)?.id, 'a');
  map = dismissToday(map, 'b', today);
  assert.equal(firstVisible(ads, map, today), null);
  // يوم جديد: القديم ينشال من الذاكرة
  assert.deepEqual(Object.keys(dismissToday(map, 'a', tomorrow)), ['a']);
});
