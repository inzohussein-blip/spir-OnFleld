/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayCounts, firstDayWithMatches, joinAlertPlan, reminderAt, spotsInfo } from './schedule.ts';

test('باقي الأماكن ولونها', () => {
  assert.deepEqual(spotsInfo({ joined_count: 2, max_players: 10 }), { left: 8, label: 'باقي 8', tone: 'ok' });
  assert.deepEqual(spotsInfo({ joined_count: 8, max_players: 10 }), { left: 2, label: 'باقي مكانين', tone: 'few' });
  assert.deepEqual(spotsInfo({ joined_count: 9, max_players: 10 }), { left: 1, label: 'باقي مكان واحد', tone: 'few' });
  assert.deepEqual(spotsInfo({ joined_count: 10, max_players: 10 }), { left: 0, label: 'مكتملة', tone: 'full' });
  // 22 لاعب: 20% = 4 أماكن تعتبر قليلة
  assert.equal(spotsInfo({ joined_count: 18, max_players: 22 }).tone, 'few');
  assert.equal(spotsInfo({ joined_count: 17, max_players: 22 }).tone, 'ok');
});

test('عدد المباريات بكل يوم وأول يوم مفيد', () => {
  const days = [0, 1, 2].map((i) => new Date(2026, 10, 14 + i));
  const at = (d: number, h: number) => ({ starts_at: new Date(2026, 10, d, h).toISOString() });
  const counts = dayCounts([at(15, 18), at(15, 20), at(16, 19)], days);
  assert.deepEqual(counts, [0, 2, 1]);
  assert.equal(firstDayWithMatches(counts), 1);
  assert.equal(firstDayWithMatches([0, 0, 0]), 0);
});

test('التذكير قبل المباراة بساعتين، ولا تذكير إذا فات الموعد', () => {
  const now = new Date(2026, 10, 14, 12).getTime();
  const r = reminderAt({ starts_at: new Date(2026, 10, 14, 20).toISOString() }, now);
  assert.equal(r?.getHours(), 18);
  assert.equal(reminderAt({ starts_at: new Date(2026, 10, 14, 13).toISOString() }, now), null);
});

test('إشعارات الحجز: تأكيد بعد نص ساعة وتذكير قبل ساعة', () => {
  const now = Date.UTC(2026, 10, 20, 12, 0);
  const at = (min: number) => new Date(now + min * 60_000).toISOString();
  // المباراة بعد 4 ساعات: تأكيد بعد 30 دقيقة، وتذكير قبلها بساعة
  assert.deepEqual(joinAlertPlan(at(240), now), { confirmAt: now + 30 * 60_000, reminderAt: now + 180 * 60_000, soon: false });
  // بعد 20 دقيقة: التأكيد فوراً وبدون تذكير
  assert.deepEqual(joinAlertPlan(at(20), now), { confirmAt: now, reminderAt: null, soon: true });
  // بعد 80 دقيقة: التذكير (بعد 20 دقيقة) قبل التأكيد — نكتفي بالتأكيد
  assert.deepEqual(joinAlertPlan(at(80), now), { confirmAt: now + 30 * 60_000, reminderAt: null, soon: false });
  // بدت: ولا شي
  assert.equal(joinAlertPlan(at(-5), now), null);
});
