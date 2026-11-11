/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { balanceTeams, type BalancePlayer } from './teamBalance.ts';

const mk = (id: string, rating: number, position: BalancePlayer['position'] = 'any'): BalancePlayer => ({ id, rating, position });

test('يوزّع 10 لاعبين على فريقين متساويين بالعدد', () => {
  const players = [5, 4.8, 4.5, 4, 3.8, 3.5, 3.2, 3, 2.5, 2].map((r, i) => mk(`p${i}`, r));
  const r = balanceTeams(players);
  const a = Object.values(r.assignments).filter((t) => t === 'A').length;
  assert.equal(a, 5);
  assert.equal(Object.keys(r.assignments).length, 10);
  assert.ok(r.diff <= 0.5, `الفرق كبير: ${r.diff}`);
});

test('يضع حارساً في كل فريق', () => {
  const players = [mk('g1', 3, 'goalkeeper'), mk('g2', 4, 'goalkeeper'), mk('a', 5), mk('b', 2), mk('c', 3), mk('d', 4)];
  const r = balanceTeams(players);
  assert.notEqual(r.assignments.g1, r.assignments.g2);
});

test('عدد فردي: الفرق في العدد لاعب واحد فقط', () => {
  const r = balanceTeams([mk('a', 5), mk('b', 4), mk('c', 3)]);
  const a = Object.values(r.assignments).filter((t) => t === 'A').length;
  assert.ok(Math.abs(a - (3 - a)) === 1);
});

test('قائمة فارغة', () => {
  assert.deepEqual(balanceTeams([]).assignments, {});
});
