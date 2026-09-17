import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pickAlbum, topTrack, normalize, albumSearchUrl, albumTracksUrl } from '../api/_lib/deezer.js';
import { lookup } from '../api/receipt/best-track.js';
import { matchTrack, buildReceipt, receiptLines, bestTrackUrl, STAR } from '../receipt/receipt.mjs';

const blonde = JSON.parse(readFileSync(new URL('./fixtures/itunes-lookup-blonde.json', import.meta.url), 'utf8')).results;

const albums = [
  { id: 1, title: 'Blonde', artist: { name: 'Tigirlily Gold' } },
  { id: 2, title: 'Blonde (Deluxe Edition)', artist: { name: 'Frank Ocean' } },
  { id: 3, title: 'Blonde', artist: { name: 'Frank Ocean' } },
];

test('album matching needs the same artist and prefers an exact title', () => {
  assert.equal(pickAlbum(albums, 'Frank Ocean', 'Blonde').id, 3);
  assert.equal(pickAlbum(albums.slice(0, 2), 'Frank Ocean', 'Blonde').id, 2);
  assert.equal(pickAlbum(albums, 'Olivia Dean', 'Blonde'), null);
  assert.equal(pickAlbum([], 'x', 'y'), null);
  assert.equal(normalize('Beyoncé — LEMONADE (Deluxe)'), 'beyonce lemonade');
});

test('the top track is the highest Deezer rank', () => {
  assert.deepEqual(topTrack([{ title: 'A', rank: 5 }, { title: 'B', rank: 9 }, { title: 'C' }]), { title: 'B', rank: 9 });
  assert.equal(topTrack([]), null);
});

test('Deezer URLs use an exact artist and album query', () => {
  const url = new URL(albumSearchUrl('Frank "Ocean"', 'Blonde'));
  assert.equal(url.searchParams.get('q'), 'artist:"Frank Ocean" album:"Blonde"');
  assert.equal(albumTracksUrl(302127), 'https://api.deezer.com/album/302127/tracks?limit=100');
});

function fakeDeezer(routes) {
  const calls = [];
  const impl = async (url) => {
    calls.push(url);
    const hit = routes.find(([pattern]) => url.includes(pattern));
    if (!hit) return new Response('{}', { status: 404 });
    return new Response(JSON.stringify(hit[1]), { status: 200 });
  };
  return { impl, calls };
}

test('the endpoint returns the best track and caches for a day', async () => {
  const { impl } = fakeDeezer([
    ['/search/album', { data: albums }],
    ['/album/3/tracks', { data: [{ title: 'Nikes', rank: 700 }, { title: 'Nights', rank: 899 }] }],
  ]);
  const response = await lookup(new Request('https://x/api/receipt/best-track?artist=Frank%20Ocean&album=Blonde'), impl);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { title: 'Nights', rank: 899 });
  assert.match(response.headers.get('cache-control'), /s-maxage=86400/);
});

test('an unmatched album is a clean null, not an error', async () => {
  const { impl, calls } = fakeDeezer([['/search/album', { data: [albums[0]] }]]);
  const response = await lookup(new Request('https://x/api/receipt/best-track?artist=Frank%20Ocean&album=Blonde'), impl);
  assert.deepEqual(await response.json(), { title: null });
  assert.equal(calls.length, 1);
});

test('missing or oversized input is rejected, and upstream failure is a 502', async () => {
  const { impl } = fakeDeezer([]);
  assert.equal((await lookup(new Request('https://x/api/receipt/best-track?artist=A'), impl)).status, 400);
  assert.equal((await lookup(new Request(`https://x/api/receipt/best-track?artist=A&album=${'b'.repeat(201)}`), impl)).status, 400);
  const failed = await lookup(new Request('https://x/api/receipt/best-track?artist=A&album=B'), impl);
  assert.equal(failed.status, 502);
  assert.equal(failed.headers.get('cache-control'), 'no-store');
});

test('the best track is matched onto the receipt and starred without breaking width', () => {
  const receipt = buildReceipt(blonde);
  assert.equal(receipt.best, -1);
  receipt.best = matchTrack(receipt.items, 'Nights');
  assert.equal(receipt.items[receipt.best].title, 'Nights');
  const cols = 44;
  const lines = receiptLines(receipt, cols);
  const starred = lines.filter((line) => line.includes(STAR));
  assert.equal(starred.length, 2);
  assert.match(starred[0], /^09  ★ NIGHTS +5:07$/);
  assert.match(starred[1], /BEST TRACK: +NIGHTS$/);
  for (const line of lines) assert.ok([...line].length <= cols);
});

test('track matching ignores featured artists and misses cleanly', () => {
  const items = [{ title: 'Nights' }, { title: 'Pink Matter (feat. André 3000)' }];
  assert.equal(matchTrack(items, 'Pink Matter'), 1);
  assert.equal(matchTrack(items, 'Nope'), -1);
  assert.equal(matchTrack(items, ''), -1);
  assert.equal(bestTrackUrl('Frank Ocean', 'Blonde'), '/api/receipt/best-track?artist=Frank+Ocean&album=Blonde');
});
