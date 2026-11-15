/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions, parseVersion, pickUpdate, versionCodeOf, type GithubRelease } from './version.ts';

test('parse versions', () => {
  assert.deepEqual(parseVersion('v1.2.3'), [1, 2, 3]);
  assert.deepEqual(parseVersion('0.2'), [0, 2, 0]);
  assert.equal(parseVersion('beta'), null);
  assert.equal(parseVersion(undefined), null);
});

test('compare versions', () => {
  assert.ok(compareVersions('0.10.0', '0.9.9') > 0);
  assert.ok(compareVersions('v1.0.0', '1.0.1') < 0);
  assert.equal(compareVersions('1.0', '1.0.0'), 0);
  assert.equal(compareVersions('x', '1.0.0'), 0);
});

test('android versionCode grows with the version', () => {
  assert.equal(versionCodeOf('0.1.0'), 100);
  assert.equal(versionCodeOf('1.2.3'), 10203);
  assert.ok(versionCodeOf('0.10.0') > versionCodeOf('0.9.9'));
});

const apk = (v: string) => [{ name: `balmalaab-${v}.apk`, browser_download_url: `https://x/${v}.apk` }];

test('picks the newest release that has an apk', () => {
  const releases: GithubRelease[] = [
    { tag_name: 'v0.3.0', assets: [] },
    { tag_name: 'v0.2.1', assets: apk('0.2.1'), body: ' تحسينات ' },
    { tag_name: 'v0.2.0', assets: apk('0.2.0') },
    { tag_name: 'v0.4.0', draft: true, assets: apk('0.4.0') },
    { tag_name: 'nightly', assets: apk('n') },
  ];
  assert.deepEqual(pickUpdate(releases, '0.1.0'), { version: '0.2.1', url: 'https://x/0.2.1.apk', notes: 'تحسينات', publishedAt: null });
  assert.equal(pickUpdate(releases, '0.2.1'), null);
  assert.equal(pickUpdate([], '0.1.0'), null);
  assert.equal(pickUpdate({ message: 'rate limit' } as never, '0.1.0'), null);
});
