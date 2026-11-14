/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canJoinAnotherTeam, MAX_TEAMS, nextCaptain, normalizePublicId, smallestSizeFor, teamJoinError, teamNameError } from './teams.ts';

test('max 5 teams per player', () => {
  assert.equal(MAX_TEAMS, 5);
  assert.equal(canJoinAnotherTeam(4), true);
  assert.equal(canJoinAnotherTeam(5), false);
});

test('team name rules', () => {
  assert.equal(teamNameError(' ا '), 'اسم الفريق قصير');
  assert.equal(teamNameError('شباب المنصور'), null);
  assert.match(teamNameError('x'.repeat(31)) ?? '', /طويل/);
});

test('public id accepts Arabic-Indic digits and strips the rest', () => {
  assert.equal(normalizePublicId('ID: ٧٣١٠ ٥٢٤'), '7310524');
  assert.equal(normalizePublicId('۱۲3'), '123');
});

test('captain leaves → oldest member leads; alone → no one', () => {
  const ms = [
    { player_id: 'cap', joined_at: '2026-01-01' },
    { player_id: 'b', joined_at: '2026-03-01' },
    { player_id: 'a', joined_at: '2026-02-01' },
  ];
  assert.equal(nextCaptain(ms, 'cap'), 'a');
  assert.equal(nextCaptain([ms[0]], 'cap'), null);
});

test('whole team must fit in the match', () => {
  assert.equal(teamJoinError(6, 5), null);
  assert.equal(teamJoinError(3, 5), 'ماكو مكان كافي: باقي 3 والفريق يحتاج 5');
  assert.equal(teamJoinError(0, 2), 'المباراة مكتملة');
  assert.match(teamJoinError(4, 0) ?? '', /منضمين/);
});

test('smallest match size that fits the team', () => {
  assert.equal(smallestSizeFor(4), 5);
  assert.equal(smallestSizeFor(12), 6);
  assert.equal(smallestSizeFor(15), 8);
  assert.equal(smallestSizeFor(30), 11);
});
