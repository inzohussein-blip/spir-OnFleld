/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchRevenue, paidPlayers, summarize } from './revenue.ts';

const NOW = new Date(2026, 10, 20, 12).getTime();
const m = (o: Record<string, unknown>) => ({
  id: 'x', status: 'finished', venue_name: 'النخيل', max_players: 10, joined_count: 10, cost_per_player: 5000, discount_pct: 0,
  starts_at: new Date(2026, 10, 16, 18).toISOString(), ends_at: new Date(2026, 10, 16, 19).toISOString(), closed_at: null, attended_count: 0, no_show_count: 0, ...o,
}) as any;

test('paid players and revenue', () => {
  assert.equal(paidPlayers(m({ joined_count: 8 })), 8);
  assert.equal(paidPlayers(m({ closed_at: 'x', attended_count: 7, no_show_count: 2 })), 9);
  assert.equal(matchRevenue(m({ joined_count: 10, discount_pct: 20 })), 40000);
});

test('summary skips upcoming, groups by venue/day, heat by weekday-hour', () => {
  const list = [
    m({}),
    m({ venue_name: 'الذهبية', joined_count: 5, closed_at: 'x', attended_count: 4, no_show_count: 1 }),
    m({ starts_at: new Date(2026, 10, 25, 18).toISOString(), ends_at: new Date(2026, 10, 25, 19).toISOString() }),
  ];
  const s = summarize(list, NOW);
  assert.equal(s.matches, 2);
  assert.equal(s.revenue, 50000 + 25000);
  assert.equal(s.players, 15);
  assert.equal(s.noShows, 1);
  assert.equal(s.noShowFines, 5000);
  assert.equal(s.fill, (1 + 0.5) / 2);
  assert.deepEqual(s.byVenue.map((v) => v.name), ['النخيل', 'الذهبية']);
  assert.equal(s.byDay.length, 1);
  const dow = new Date(2026, 10, 16).getDay();
  assert.equal(s.heat[dow][18], 0.75);
  assert.equal(s.heat[dow][10], null);
});

test('discount given', () => {
  assert.equal(summarize([m({ discount_pct: 25, joined_count: 4 })], NOW).discountGiven, 4 * 1250);
});
