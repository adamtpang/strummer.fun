import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../vibe/package.json', import.meta.url));
const ts = require('typescript');
async function loadUtility(name) {
  const source = readFileSync(new URL(`../vibe/src/utils/${name}.ts`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
const { clearSpotifySession, readStoredUser, validateOAuthCallback } = await loadUtility('session');
const { fitStoryLines } = await loadUtility('story-text');
function storage(entries = {}) {
  const data = new Map(Object.entries(entries));
  return { getItem: key => data.get(key) ?? null, removeItem: key => data.delete(key) };
}

test('corrupt saved sessions recover without erasing creative work or story preferences', () => {
  const saved = storage({ user_data: '{broken', access_token: 'old', 'strummer-vibe-story-theme': 'paper', 'strummer.songbook.v1': 'keep' });
  assert.equal(readStoredUser(saved), null);
  assert.equal(saved.getItem('access_token'), null);
  assert.equal(saved.getItem('strummer-vibe-story-theme'), 'paper');
  assert.equal(saved.getItem('strummer.songbook.v1'), 'keep');
});

test('only validated user objects restore a session', () => {
  const saved = storage({ user_data: JSON.stringify({ id: 'listener', display_name: 'Listener', avatar_url: null }), access_token: 'token' });
  assert.deepEqual(readStoredUser(saved), { id: 'listener', display_name: 'Listener', avatar_url: undefined, playlistId: undefined });
  for (const user of [null, [], 'listener', { id: 3 }, { id: '', display_name: 'Listener' }]) {
    assert.equal(readStoredUser(storage({ user_data: JSON.stringify(user), access_token: 'token' })), null);
  }
});

test('blocked storage does not crash session cleanup or restoration', () => {
  const blocked = { getItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  assert.equal(readStoredUser(blocked), null);
  assert.doesNotThrow(() => clearSpotifySession(blocked));
});

test('OAuth accepts only a matching, recent state and PKCE verifier', () => {
  const now = 1_000_000;
  const saved = storage({ oauth_state: 'nonce', oauth_started_at: String(now - 1000), code_verifier: 'verifier' });
  assert.equal(validateOAuthCallback(saved, 'nonce', now), 'verifier');
  for (const state of [null, '', 'other']) assert.throws(() => validateOAuthCallback(saved, state, now));
  assert.throws(() => validateOAuthCallback(saved, 'nonce', now + 600_000));
  assert.throws(() => validateOAuthCallback(saved, 'nonce', now - 2000));
  assert.throws(() => validateOAuthCallback(storage({ oauth_state: 'nonce', oauth_started_at: 'bad', code_verifier: 'verifier' }), 'nonce', now));
});

test('story text wraps and truncates within its allocated width and line count', () => {
  const measure = value => Array.from(value).length * 10;
  assert.deepEqual(fitStoryLines('one two three', measure, 70, 3), ['one two', 'three']);
  for (const text of ['supercalifragilisticexpialidocious', 'a very long song title with many words', '🎵'.repeat(50)]) {
    const lines = fitStoryLines(text, measure, 100, 2);
    assert.ok(lines.length <= 2);
    assert.ok(lines.every(line => measure(line) <= 100));
    assert.ok(lines.at(-1).endsWith('...'));
  }
  assert.deepEqual(fitStoryLines('', measure, 100, 2), []);
});
