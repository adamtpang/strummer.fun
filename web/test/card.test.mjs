import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { playlistId, cleanName, cardPath, readCard, embedCode, oembedUrl, NAME_MAX } from '../vibe/public/card/lib.mjs';

const ULT = '35KMxrfO2OqwaJ1PIoYiCa';

test('a playlist id is read from share links, URIs, and bare ids', () => {
  assert.equal(playlistId(`https://open.spotify.com/playlist/${ULT}?si=abc123`), ULT);
  assert.equal(playlistId(`https://open.spotify.com/intl-de/playlist/${ULT}`), ULT);
  assert.equal(playlistId(`https://open.spotify.com/embed/playlist/${ULT}`), ULT);
  assert.equal(playlistId(`spotify:playlist:${ULT}`), ULT);
  assert.equal(playlistId(`  ${ULT}  `), ULT);
});

test('anything that is not a playlist is refused', () => {
  assert.equal(playlistId(`https://open.spotify.com/album/${ULT}`), null);
  assert.equal(playlistId(`https://open.spotify.com/playlist/${ULT}extra`), null);
  assert.equal(playlistId('https://example.com'), null);
  assert.equal(playlistId(''), null);
  assert.equal(playlistId(null), null);
});

test('a card URL round-trips its id and title', () => {
  const path = cardPath(ULT, '  road   trip & more ');
  assert.match(path, /^\/vibe\/card\/p\?/);
  assert.deepEqual(readCard(path.split('?')[1]), { id: ULT, name: 'road trip & more' });
  assert.equal(new URLSearchParams(cardPath(ULT, 'ult', { embed: true }).split('?')[1]).get('embed'), '1');
});

test('a card URL with a bad id or no title is not a card', () => {
  assert.equal(readCard('id=nope&name=ult'), null);
  assert.equal(readCard(`id=${ULT}`), null);
  assert.equal(readCard(`id=${ULT}&name=%20%20`), null);
  assert.equal(readCard(''), null);
});

test('titles are trimmed, single-spaced, and capped', () => {
  assert.equal(cleanName(' a \n b '), 'a b');
  assert.equal(cleanName('x'.repeat(200)).length, NAME_MAX);
});

test('the embed code is one iframe and cannot be broken out of by a title', () => {
  const code = embedCode(ULT, 'my "best" <mix>');
  assert.match(code, /^<iframe src="https:\/\/strummer\.fun\/vibe\/card\/p\?[^"]*embed=1" title="[^"]*" /);
  assert.equal(code.match(/<iframe/g).length, 1);
  assert.ok(!code.includes('<mix>'));
  assert.ok(!code.includes('"best"'));
  assert.equal((code.match(/"/g).length) % 2, 0);
});

test('the title lookup asks Spotify oEmbed about that playlist only', () => {
  const url = new URL(oembedUrl(ULT));
  assert.equal(url.origin + url.pathname, 'https://open.spotify.com/oembed');
  assert.equal(url.searchParams.get('url'), `https://open.spotify.com/playlist/${ULT}`);
});

test('card pages name no Spotify URL in their markup, so nothing loads before a press', () => {
  for (const page of ['adam.html', 'p.html']) {
    const html = readFileSync(new URL(`../vibe/public/card/${page}`, import.meta.url), 'utf8');
    assert.ok(!/spotify\.com|scdn\.co|spotifycdn/.test(html), page);
  }
});

test('only /vibe/card/ may be framed, and it loads no third-party script', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const csp = (source) => config.headers.find((rule) => rule.source === source).headers.find((header) => header.key === 'Content-Security-Policy').value;
  assert.match(csp('/((?!vibe/card/).*)'), /frame-ancestors 'none'/);
  const card = csp('/vibe/card/(.*)');
  assert.match(card, /frame-ancestors \*/);
  assert.match(card, /script-src 'self';/);
  assert.match(card, /connect-src https:\/\/open\.spotify\.com;/);
  const sources = config.rewrites.map((rule) => rule.source);
  for (const route of ['/vibe/card/adam', '/vibe/card/p', '/vibe/card/make']) {
    assert.ok(sources.indexOf(route) > -1 && sources.indexOf(route) < sources.indexOf('/vibe/:path*'), route);
  }
});
