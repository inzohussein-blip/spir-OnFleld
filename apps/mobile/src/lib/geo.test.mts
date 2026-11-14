/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { directionsUrl, distanceKm, formatDistance, hasCoords } from './geo.ts';
import { buildMapHtml, parseMapMessage } from './mapHtml.ts';

test('distanceKm: Baghdad → Basra is about 450 km', () => {
  const d = distanceKm({ lat: 33.3152, lng: 44.3661 }, { lat: 30.5258, lng: 47.8257 });
  assert.ok(d > 430 && d < 470, String(d));
  assert.equal(distanceKm({ lat: 33, lng: 44 }, { lat: 33, lng: 44 }), 0);
});

test('formatDistance uses Western digits and short units', () => {
  assert.equal(formatDistance(0.01), 'يبعد 50 م');
  assert.equal(formatDistance(0.83), 'يبعد 850 م');
  assert.equal(formatDistance(3.44), 'يبعد 3.4 كم');
  assert.equal(formatDistance(5), 'يبعد 5 كم');
  assert.equal(formatDistance(1234.4), 'يبعد 1,234 كم');
});

test('directionsUrl per app', () => {
  assert.equal(directionsUrl('google', { lat: 33.1, lng: 44.2 }), 'https://www.google.com/maps/dir/?api=1&destination=33.1,44.2');
  assert.match(directionsUrl('apple', { lat: 33.1, lng: 44.2 }, 'ملعب'), /^https:\/\/maps\.apple\.com\/\?daddr=33\.1,44\.2&q=%D9/);
});

test('hasCoords', () => {
  assert.equal(hasCoords({ lat: 1, lng: 2 }), true);
  assert.equal(hasCoords({ lat: null, lng: 2 }), false);
  assert.equal(hasCoords({}), false);
});

test('map html escapes venue names so they cannot break the script', () => {
  const html = buildMapHtml({ points: [{ id: 'x', name: '</script><b>"ملعب"', lat: 1, lng: 2 }], dark: false, primary: '#1E4FD8', center: { lat: 1, lng: 2 } });
  assert.equal(html.split('</script>').length, 2, 'only the real closing tag');
  assert.ok(html.includes('\\u003c/script>'));
  assert.ok(html.includes('styles/positron'));
  assert.ok(buildMapHtml({ points: [], dark: true, primary: '#fff', center: { lat: 0, lng: 0 } }).includes('styles/dark'));
});

test('parseMapMessage accepts only our messages', () => {
  assert.deepEqual(parseMapMessage('{"__balmalaab":1,"type":"select","id":"v1"}'), { __balmalaab: 1, type: 'select', id: 'v1' });
  assert.equal(parseMapMessage({ type: 'select', id: 'v1' }), null);
  assert.equal(parseMapMessage({ __balmalaab: 1, type: 'hack' }), null);
  assert.equal(parseMapMessage('not json'), null);
});

test('mainCluster picks the city with most venues', async () => {
  const { mainCluster } = await import('./geo.ts');
  const pts = [
    { id: 'a', lat: 33.31, lng: 44.33 },
    { id: 'b', lat: 33.30, lng: 44.42 },
    { id: 'c', lat: 33.33, lng: 44.45 },
    { id: 'basra', lat: 30.52, lng: 47.82 },
  ];
  assert.deepEqual(mainCluster(pts).map((p) => p.id), ['a', 'b', 'c']);
  assert.deepEqual(mainCluster([]), []);
});
