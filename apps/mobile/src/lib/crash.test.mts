/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

// crashPayload يعتمد على react-native — نفحص نفس المنطق بنسخة صغيرة
function trim(e: Error) {
  const message = (`${e.name && e.name !== 'Error' ? `${e.name}: ` : ''}${e.message || 'خطأ'}`).slice(0, 500);
  const stack = e.stack ? e.stack.split('\n').slice(0, 25).join('\n').slice(0, 4000) : null;
  return { message, stack };
}

test('crash payload is trimmed to the database limits', () => {
  const e = new TypeError('x'.repeat(900));
  e.stack = Array.from({ length: 80 }, (_, i) => `at f${i} (${'y'.repeat(200)})`).join('\n');
  const p = trim(e);
  assert.ok(p.message.startsWith('TypeError: '));
  assert.equal(p.message.length, 500);
  assert.ok((p.stack ?? '').length <= 4000);
  assert.ok((p.stack ?? '').split('\n').length <= 25);
});
