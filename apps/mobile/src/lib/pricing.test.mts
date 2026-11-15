/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { finalPrice, suggestedDiscount } from './pricing.ts';

test('price after discount', () => {
  assert.equal(finalPrice({ cost_per_player: 5000, discount_pct: 20 }), 4000);
  assert.equal(finalPrice({ cost_per_player: 4500, discount_pct: 0 }), 4500);
  assert.equal(finalPrice({ cost_per_player: 4500 }), 4500);
  assert.equal(finalPrice({ cost_per_player: 3500, discount_pct: 25 }), 2625);
  assert.equal(finalPrice({ cost_per_player: 3000, discount_pct: 150 }), 300);
  assert.equal(finalPrice({ cost_per_player: null, discount_pct: 20 }), null);
});

test('off-peak suggestion', () => {
  assert.equal(suggestedDiscount(10), 25);
  assert.equal(suggestedDiscount(16), 25);
  assert.equal(suggestedDiscount(17), 0);
  assert.equal(suggestedDiscount(21), 0);
});
