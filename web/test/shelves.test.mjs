import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseChart, parseTopAlbums, validUsername, validPeriod, lastfmUrl, APPLE_CHART } from '../api/_lib/shelves.js';
import { charts } from '../api/receipt/charts.js';
import { topAlbums } from '../api/receipt/lastfm.js';
import { ALL_TIME, topAlbumsReceipt, receiptLines } from '../receipt/receipt.mjs';

const feed = { feed: { results: [
  { id: '6810715695', name: 'Westside Whimsy', artistName: 'Jhené Aiko', artworkUrl100: 'https://is1-ssl.mzstatic.com/a/100x100bb.jpg' },
  { id: 'not-a-number', name: 'Bad', artistName: 'X' },
  { id: '6781873059', name: "Don't Look Down", artistName: 'Rod Wave' },
] } };

const lastfmBody = { topalbums: { album: [
  { name: 'The Art of Loving', playcount: '84', artist: { name: 'Olivia Dean' } },
  { name: 'Selected Ambient Works 85-92', playcount: '51', artist: { name: 'Aphex Twin' } },
  { name: '', playcount: '3', artist: { name: 'Ghost' } },
] } };

const respond = (body, status = 200) => async () => new Response(JSON.stringify(body), { status });

test('the Apple chart parses to clean album rows and drops malformed ids', () => {
  assert.deepEqual(parseChart(feed).map((album) => album.id), ['6810715695', '6781873059']);
  assert.equal(parseChart(feed)[0].artist, 'Jhené Aiko');
  assert.deepEqual(parseChart(null), []);
  assert.match(APPLE_CHART, /most-played\/25\/albums\.json$/);
});

test('the charts endpoint caches for an hour and fails closed', async () => {
  const ok = await charts(respond(feed));
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).albums.length, 2);
  assert.match(ok.headers.get('cache-control'), /s-maxage=3600/);
  const down = await charts(respond({}, 500));
  assert.equal(down.status, 502);
  assert.equal(down.headers.get('cache-control'), 'no-store');
});

test('Last.fm usernames and periods are validated before any request', () => {
  assert.equal(validUsername('adampang'), true);
  assert.equal(validUsername('a'), false);
  assert.equal(validUsername('9lives'), false);
  assert.equal(validUsername('x'.repeat(16)), false);
  assert.equal(validUsername('bad name'), false);
  assert.equal(validPeriod('7day'), true);
  assert.equal(validPeriod('forever'), false);
  const url = new URL(lastfmUrl('adampang', '1month', 'KEY'));
  assert.equal(url.searchParams.get('method'), 'user.gettopalbums');
  assert.equal(url.searchParams.get('api_key'), 'KEY');
});

test('Last.fm top albums parse, and error bodies become null', () => {
  assert.deepEqual(parseTopAlbums(lastfmBody), [
    { name: 'The Art of Loving', artist: 'Olivia Dean', plays: 84 },
    { name: 'Selected Ambient Works 85-92', artist: 'Aphex Twin', plays: 51 },
  ]);
  assert.equal(parseTopAlbums({ error: 6, message: 'User not found' }), null);
});

test('the Last.fm endpoint is dark without a key, and never calls out on bad input', async () => {
  let calls = 0;
  const counting = async () => { calls += 1; return new Response('{}'); };
  const req = (query) => new Request(`https://x/api/receipt/lastfm?${query}`);
  assert.equal((await topAlbums(req('user=adampang'), '', counting)).status, 503);
  assert.equal((await topAlbums(req('user=a b'), 'KEY', counting)).status, 400);
  assert.equal((await topAlbums(req('user=adampang&period=forever'), 'KEY', counting)).status, 400);
  assert.equal(calls, 0);
});

test('the Last.fm endpoint returns albums, 404s an unknown user, and 502s a failure', async () => {
  const req = new Request('https://x/api/receipt/lastfm?user=adampang&period=7day');
  const ok = await topAlbums(req, 'KEY', respond(lastfmBody));
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).albums[0].name, 'The Art of Loving');
  assert.equal((await topAlbums(req, 'KEY', respond({ error: 6 }))).status, 404);
  assert.equal((await topAlbums(req, 'KEY', async () => { throw new Error('down'); })).status, 502);
});

test('the all-time shelf is Apple Music\'s published top 10 in order', () => {
  assert.equal(ALL_TIME.length, 10);
  assert.deepEqual(ALL_TIME.map((album) => album.name).slice(0, 3), ['The Miseducation of Lauryn Hill', 'Thriller', 'Abbey Road']);
  assert.equal(ALL_TIME[9].name, 'Lemonade');
  assert.ok(ALL_TIME.every((album) => /^\d+$/.test(album.id)));
});

test('a listening receipt prints plays, a handle, and the period', () => {
  const receipt = topAlbumsReceipt('adampang', '1month', parseTopAlbums(lastfmBody), new Date('2026-09-17T00:00:00Z'));
  const lines = receiptLines(receipt, 44);
  assert.ok(lines.some((line) => line.includes('LISTENING RECEIPT')));
  assert.ok(lines.some((line) => line.includes('@ADAMPANG')));
  assert.ok(lines.some((line) => line.includes('LAST MONTH')));
  assert.match(lines.find((line) => line.startsWith('NO  ')), /PLAYS$/);
  assert.match(lines.find((line) => line.startsWith('01  ')), /OLIVIA DEAN +84$/);
  assert.match(lines.find((line) => line.startsWith('TOTAL PLAYS:')), /135$/);
  assert.equal(receipt.best, -1);
  assert.equal(receipt.link, 'https://www.last.fm/user/adampang');
  for (const line of lines) assert.ok([...line].length <= 44);
  assert.throws(() => topAlbumsReceipt('adampang', '7day', []), /No albums/);
});

test('the probe reports readiness without a username, and stays dark without a key', async () => {
  const probe = new Request('https://x/api/receipt/lastfm?probe=1');
  const never = async () => { throw new Error('should not call Last.fm'); };
  assert.equal((await topAlbums(probe, 'KEY', never)).status, 200);
  assert.equal((await topAlbums(probe, '', never)).status, 503);
});
