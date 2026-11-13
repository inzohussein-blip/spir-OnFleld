/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attributesFromRating, computeStandings, monthRange, overallOf, pickTeamOfWeek, pointsOf, tierOf } from './stats.ts';
import type { Fixture, PlayerCard, Position, TournamentTeam } from './types.ts';

const team = (id: string, g = 'أ'): TournamentTeam => ({ id, name: id, group_name: g, captain_id: null });
const fx = (h: string, a: string, hs: number | null, as: number | null): Fixture => ({
  id: `${h}-${a}`, stage: 'group', group_name: 'أ', home_id: h, away_id: a, home_score: hs, away_score: as, starts_at: null,
});

test('الترتيب: النقاط ثم فارق الأهداف', () => {
  const g = computeStandings(
    [team('A'), team('B'), team('C')],
    [fx('A', 'B', 2, 0), fx('B', 'C', 1, 1), fx('C', 'A', 3, 1), fx('A', 'C', null, null)],
  )['أ'];
  // A: فوز وخسارة = 3 نقاط، فارق 0 | C: تعادل وفوز = 4 | B: تعادل وخسارة = 1
  assert.deepEqual(g.map((r) => r.team.id), ['C', 'A', 'B']);
  assert.equal(g[0].points, 4);
  assert.equal(g[1].played, 2);
  assert.equal(g[2].gd, -2);
});

test('المباريات غير الملعوبة لا تُحتسب', () => {
  const g = computeStandings([team('A'), team('B')], [fx('A', 'B', null, null)])['أ'];
  assert.ok(g.every((r) => r.played === 0 && r.points === 0));
});

test('التقييم العام بين 1 و 99 ويزيد مع المستوى', () => {
  const lo = overallOf(attributesFromRating(1, 'forward'), 'forward');
  const hi = overallOf(attributesFromRating(5, 'forward'), 'forward');
  assert.ok(lo >= 1 && hi <= 99 && hi > lo);
  assert.equal(tierOf(90), 'elite');
  assert.equal(tierOf(60), 'bronze');
});

test('تشكيلة الأسبوع: حارس واحد و11 لاعباً بدون تكرار', () => {
  const positions: Position[] = ['goalkeeper', 'goalkeeper', 'defender', 'defender', 'defender', 'midfielder', 'midfielder', 'forward', 'forward', 'forward', 'any', 'any', 'defender'];
  const cards: PlayerCard[] = positions.map((p, i) => ({
    profile: { id: `p${i}`, full_name: `p${i}`, city: null, preferred_position: p, skill_rating: 3, reliability_score: 100, matches_played: 0 },
    overall: 60 + i,
    attributes: attributesFromRating(3, p),
    stats: { matches: 0, wins: 0, draws: 0, losses: 0, goals: 0, assists: 0, mvps: 0 },
  }));
  const all = pickTeamOfWeek(cards);
  const xi = all.filter((x) => !x.slot.startsWith('SUB'));
  assert.equal(xi.length, 11);
  assert.equal(all.length, 13); // + احتياطيان
  assert.equal(new Set(all.map((x) => x.card.profile.id)).size, 13);
  assert.equal(xi.find((x) => x.slot === 'GK')?.card.profile.preferred_position, 'goalkeeper');
});

test('نقاط التصنيف', () => {
  assert.equal(pointsOf({ matches: 4, wins: 2, draws: 1, losses: 1, goals: 3, assists: 2, mvps: 1 }), 2 * 3 + 1 + 3 * 2 + 2 + 3);
  assert.equal(pointsOf({ matches: 0, wins: 0, draws: 0, losses: 0, goals: 0, assists: 0, mvps: 0 }), 0);
});

test('حدود الشهر: الحالي والماضي وعبور السنة', () => {
  const { from, to } = monthRange(0, new Date(2026, 10, 13));
  assert.equal(from.getMonth(), 10);
  assert.equal(to.getMonth(), 11);
  const prev = monthRange(1, new Date(2026, 0, 5));
  assert.equal(prev.from.getFullYear(), 2025);
  assert.equal(prev.from.getMonth(), 11);
  assert.equal(prev.to.getMonth(), 0);
});
