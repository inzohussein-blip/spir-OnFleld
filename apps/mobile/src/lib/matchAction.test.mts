/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchAction } from './matchAction.ts';

const now = new Date(2026, 10, 13, 12, 0).getTime();
const base = { my_status: null, registration_opens_at: null, ends_at: new Date(2026, 10, 13, 22, 0).toISOString(), joined_count: 4, max_players: 10 } as const;

test('مكان متاح → انضم', () => assert.deepEqual(matchAction(base, now), { kind: 'join' }));
test('مكتملة → قائمة انتظار', () => assert.deepEqual(matchAction({ ...base, joined_count: 10 }, now), { kind: 'waitlist' }));
test('منضم مسبقاً', () => assert.deepEqual(matchAction({ ...base, my_status: 'joined' }, now), { kind: 'joined' }));
test('في الانتظار', () => assert.deepEqual(matchAction({ ...base, my_status: 'waitlist' }, now), { kind: 'waiting' }));
test('انتهت', () => assert.deepEqual(matchAction({ ...base, ends_at: new Date(now - 1).toISOString() }, now), { kind: 'finished' }));

test('التسجيل يُفتح لاحقاً → عدّاد بالمللي ثانية', () => {
  const opens = new Date(now + 4 * 3600000).toISOString();
  assert.deepEqual(matchAction({ ...base, registration_opens_at: opens }, now), { kind: 'opens_later', ms: 4 * 3600000 });
});

test('موعد التسجيل مضى → انضم عادي', () => {
  const opened = new Date(now - 60000).toISOString();
  assert.deepEqual(matchAction({ ...base, registration_opens_at: opened }, now), { kind: 'join' });
});
