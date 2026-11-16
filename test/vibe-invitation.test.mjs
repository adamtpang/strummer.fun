import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../vibe/package.json', import.meta.url));
const ts = require('typescript');
async function load(name) {
  const source = readFileSync(new URL(`../vibe/src/utils/${name}.ts`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
const { validProfileId, rememberInvitation, readInvitation, forgetInvitation, comparisonPath, spotifyTrackUrl } = await load('invitation');
const { isVibeMetrics, calculateCompatBreakdown } = await load('vibe-analysis');

test('an invitation persists across sign-in and can be dismissed without changing auth', () => {
  const entries = new Map([['access_token', 'keep']]);
  const storage = { setItem: (key, value) => entries.set(key, value), getItem: key => entries.get(key), removeItem: key => entries.delete(key) };
  rememberInvitation(storage, 'friend-123', 1000);
  assert.equal(readInvitation(storage, 2000), 'friend-123');
  assert.equal(readInvitation(storage, 1000 + 8 * 24 * 60 * 60 * 1000), null);
  assert.equal(readInvitation(storage, 999), null);
  forgetInvitation(storage);
  assert.equal(readInvitation(storage, 2000), null);
  assert.equal(entries.get('access_token'), 'keep');
});

test('invalid invitations and unavailable storage cannot redirect outside the app', () => {
  for (const id of ['', null, '../foo', 'https://evil.example', 'a/b', 'abc?x=1', 'a'.repeat(101)]) assert.equal(validProfileId(id), false);
  assert.equal(validProfileId('a.b_123-xyz'), true);
  assert.equal(readInvitation({ getItem: () => '{' }), null);
  assert.equal(readInvitation({ getItem() { throw new Error('blocked'); } }), null);
  assert.equal(comparisonPath('a/b', 'other?'), '/compare/a%2Fb/other%3F');
});

test('song handoffs accept Spotify track links only', () => {
  const id = '0123456789abcdefghijkl';
  assert.equal(spotifyTrackUrl({ uri: `spotify:track:${id}` }), `https://open.spotify.com/track/${id}`);
  assert.equal(spotifyTrackUrl({ url: `https://open.spotify.com/track/${id}?si=abc` }), `https://open.spotify.com/track/${id}?si=abc`);
  for (const url of ['javascript:alert(1)', 'https://evil.example/track/test', 'https://open.spotify.com/', 'http://open.spotify.com/track/' + id]) assert.equal(spotifyTrackUrl({ url }), null);
});

test('compatibility rejects incomplete and non-finite metrics', () => {
  const metrics = { mainstream: .5, modernity: .6, diversity: .7, recencyShift: .4, artistConcentration: .3, eraSpread: .5 };
  assert.equal(isVibeMetrics(metrics), true);
  const profile = { metrics, topGenres: ['soul'] };
  assert.equal(calculateCompatBreakdown(profile, profile).score, 100);
  for (const value of [undefined, NaN, Infinity, -1, 2]) {
    const broken = { ...metrics, eraSpread: value };
    assert.equal(isVibeMetrics(broken), false);
    assert.ok(Number.isFinite(calculateCompatBreakdown({ metrics: broken, topGenres: [] }, profile).score));
  }
});
