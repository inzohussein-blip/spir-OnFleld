/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatIQD, formatNumber, toWesternDigits } from './format.ts';

test('الأرقام العربية-الهندية والفارسية تتحول إلى 0-9', () => {
  assert.equal(toWesternDigits('٠٧٧٠١٢٣٤٥٦٧'), '07701234567');
  assert.equal(toWesternDigits('۱۲۳۴'), '1234');
  assert.equal(toWesternDigits('باقي ٣ لاعبين'), 'باقي 3 لاعبين');
  assert.equal(toWesternDigits('بدون أرقام'), 'بدون أرقام');
});

test('فاصل الآلاف ثابت بأرقام 1,2,3 بغض النظر عن لغة الجهاز', () => {
  assert.equal(formatNumber(0), '0');
  assert.equal(formatNumber(999), '999');
  assert.equal(formatNumber(25000), '25,000');
  assert.equal(formatNumber(1234567), '1,234,567');
  assert.equal(formatNumber(-7500), '-7,500');
  assert.equal(formatIQD(2500), '2,500 د.ع');
});
