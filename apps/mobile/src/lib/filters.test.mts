/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeFilterCount, applyFilters, areaOf, EMPTY_FILTERS, filterOptions, timeOfDay } from './filters.ts';

const at = (h: number) => new Date(2026, 10, 16, h, 0).toISOString();
const m = (o: Record<string, unknown>) => ({ id: 'x', players_per_side: 5, starts_at: at(18), cost_per_player: 5000, discount_pct: 0, venue_address: 'المنصور، قرب ساحة الرواد', venue_city: 'بغداد', venue_id: 'v1', ...o }) as any;

test('time of day', () => {
  assert.equal(timeOfDay(at(9)), 'morning');
  assert.equal(timeOfDay(at(15)), 'afternoon');
  assert.equal(timeOfDay(at(17)), 'night');
});

test('area from address', () => {
  assert.equal(areaOf(m({})), 'المنصور');
  assert.equal(areaOf(m({ venue_address: null })), 'بغداد');
  assert.equal(areaOf(m({ venue_address: 'زيونة' })), 'زيونة');
});

test('apply filters', () => {
  const list = [
    m({ id: 'a' }),
    m({ id: 'b', players_per_side: 11, starts_at: at(10), venue_id: 'v4', venue_address: 'زيونة' }),
    m({ id: 'c', cost_per_player: 8000, discount_pct: 50, venue_id: 'v2' }),
    m({ id: 'd', cost_per_player: 8000, venue_id: 'v2' }),
  ];
  const ids = (f: Partial<typeof EMPTY_FILTERS>, fav = new Set<string>()) => applyFilters(list, { ...EMPTY_FILTERS, ...f }, fav).map((x: any) => x.id);
  assert.deepEqual(ids({}), ['a', 'b', 'c', 'd']);
  assert.deepEqual(ids({ formats: [11] }), ['b']);
  assert.deepEqual(ids({ time: 'morning' }), ['b']);
  assert.deepEqual(ids({ maxPrice: 5000 }), ['a', 'b', 'c']); // c بعد الخصم 4000
  assert.deepEqual(ids({ area: 'زيونة' }), ['b']);
  assert.deepEqual(ids({ favOnly: true }, new Set(['v2'])), ['c', 'd']);
  assert.equal(activeFilterCount({ ...EMPTY_FILTERS, formats: [5, 6], favOnly: true }), 2);
  assert.deepEqual(filterOptions(list), { formats: [5, 11], areas: ['المنصور', 'زيونة'] });
});
