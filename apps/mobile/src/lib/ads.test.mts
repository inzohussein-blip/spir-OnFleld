/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AD_TEMPLATE_ORDER, adError, adFromTemplate, adState, countdownParts, formatAdDate, liveAdsFor, parseAdDate } from './ads.ts';

const NOW = new Date(2026, 10, 15, 12, 0).getTime();
const iso = (d: number, h = 12) => new Date(2026, 10, d, h, 0).toISOString();
const ad = (o: Record<string, unknown>) => ({ active: true, starts_at: null, ends_at: null, city: null, sort: 0, created_at: iso(1), ...o }) as any;

test('six templates, each makes a valid ad', () => {
  assert.equal(AD_TEMPLATE_ORDER.length, 6);
  for (const t of AD_TEMPLATE_ORDER) assert.equal(adError(adFromTemplate(t)), null, t);
  assert.ok(adFromTemplate('league').countdown_to);
  assert.equal(adFromTemplate('services').countdown_to, null);
});

test('ad state by dates', () => {
  assert.equal(adState(ad({}), NOW), 'live');
  assert.equal(adState(ad({ active: false }), NOW), 'paused');
  assert.equal(adState(ad({ starts_at: iso(16) }), NOW), 'scheduled');
  assert.equal(adState(ad({ ends_at: iso(14) }), NOW), 'ended');
});

test('live ads: city filter and order', () => {
  const list = [ad({ id: 'b', sort: 2 }), ad({ id: 'a', sort: 1, city: 'بغداد' }), ad({ id: 'x', city: 'البصرة' }), ad({ id: 'off', active: false })];
  assert.deepEqual(liveAdsFor(list, 'بغداد', NOW).map((a: any) => a.id), ['a', 'b']);
  assert.deepEqual(liveAdsFor(list, null, NOW).map((a: any) => a.id), ['x', 'a', 'b']);
});

test('countdown parts', () => {
  assert.deepEqual(countdownParts(new Date(NOW + (2 * 1440 + 3 * 60 + 5) * 60000).toISOString(), NOW), [2, 3, 5]);
  assert.equal(countdownParts(iso(14), NOW), null);
  assert.equal(countdownParts(null, NOW), null);
});

test('admin date input', () => {
  assert.equal(parseAdDate(''), null);
  assert.equal(parseAdDate('2026-13-01'), undefined);
  assert.equal(parseAdDate('غلط'), undefined);
  const s = parseAdDate('2026-11-20 21:30');
  assert.equal(formatAdDate(s ?? null, true), '2026-11-20 21:30');
  assert.equal(formatAdDate(parseAdDate('2026-11-20', true) ?? null, true), '2026-11-20 23:59');
});

test('ad errors', () => {
  const base = adFromTemplate('services');
  assert.match(adError({ ...base, title: 'ا' }) ?? '', /عنوان/);
  assert.match(adError({ ...base, starts_at: iso(20), ends_at: iso(10) }) ?? '', /النهاية/);
  assert.match(adError({ ...base, rating: 7 }) ?? '', /التقييم/);
});
