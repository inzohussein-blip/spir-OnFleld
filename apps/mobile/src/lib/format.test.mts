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

test('عدّاد فتح التسجيل بصيغة عربية صحيحة', async () => {
  const { formatCountdown } = await import('./format.ts');
  const min = 60000, hour = 60 * min, day = 24 * hour;
  assert.equal(formatCountdown(4 * hour + 7 * min), '4 ساعات و7 دقائق');
  assert.equal(formatCountdown(1 * hour + 1 * min), 'ساعة ودقيقة');
  assert.equal(formatCountdown(2 * hour), 'ساعتان');
  assert.equal(formatCountdown(30 * 1000), 'دقيقة');
  assert.equal(formatCountdown(2 * day + 3 * hour + 5 * min), 'يومان و3 ساعات');
  assert.equal(formatCountdown(15 * min), '15 دقيقة');
});

test('الوقت والتاريخ بأرقام 1,2,3', async () => {
  const { formatClock, formatFullDate } = await import('./format.ts');
  assert.equal(formatClock(new Date(2026, 10, 13, 21, 15).toISOString()), '9:15 م');
  assert.equal(formatClock(new Date(2026, 10, 13, 0, 5).toISOString()), '12:05 ص');
  assert.equal(formatFullDate(new Date(2026, 10, 13)), 'الجمعة 2026/11/13');
});
