import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  formatDuration, rankAlbums, buildReceipt, receiptRow, pairRow, centered, barcode, receiptLines, searchUrl, lookupUrl, CTA,
  artistNamedIn, artistSearchUrl, discographyUrl, normalize, labelFrom,
} from '../receipt/receipt.mjs';

const blonde = JSON.parse(readFileSync(new URL('./fixtures/itunes-lookup-blonde.json', import.meta.url), 'utf8')).results;
const fixedDate = new Date('2026-09-17T12:00:00Z');

test('durations format as m:ss, and h:mm:ss past an hour', () => {
  assert.equal(formatDuration(314075), '5:14');
  assert.equal(formatDuration(59500), '1:00');
  assert.equal(formatDuration(3617340), '1:00:17');
  assert.equal(formatDuration(undefined), '0:00');
});

test('real Apple lookup for Blonde becomes a 17-item receipt with the right total', () => {
  const receipt = buildReceipt(blonde, fixedDate);
  assert.equal(receipt.album, 'Blonde');
  assert.equal(receipt.artist, 'Frank Ocean');
  assert.equal(receipt.year, '2016');
  assert.equal(receipt.count, 17);
  assert.equal(receipt.total, '1:00:17');
  assert.deepEqual(receipt.items[0], { number: '01', title: 'Nikes', time: '5:14' });
  assert.equal(receipt.label, "Boys Don't Cry");
  assert.match(receipt.artwork, /600x600bb\.jpg$/);
  assert.equal(receipt.date, '2026-09-17');
  assert.equal(receipt.card, '**** **** **** 2016');
});

test('tracks sort by disc, then track, and number straight through', () => {
  const rows = [
    { wrapperType: 'collection', collectionId: 9, collectionName: 'Two Disc', artistName: 'Band' },
    { wrapperType: 'track', kind: 'song', trackName: 'B1', discNumber: 2, trackNumber: 1, trackTimeMillis: 1000 },
    { wrapperType: 'track', kind: 'music-video', trackName: 'Video', discNumber: 1, trackNumber: 1, trackTimeMillis: 1000 },
    { wrapperType: 'track', kind: 'song', trackName: 'A2', discNumber: 1, trackNumber: 2, trackTimeMillis: 1000 },
    { wrapperType: 'track', kind: 'song', trackName: 'A1', discNumber: 1, trackNumber: 1, trackTimeMillis: 1000 },
  ];
  const receipt = buildReceipt(rows, fixedDate);
  assert.deepEqual(receipt.items.map((item) => `${item.number} ${item.title}`), ['01 A1', '02 A2', '03 B1']);
});

test('missing album or tracklist fails with a readable message', () => {
  assert.throws(() => buildReceipt([]), /could not be found/);
  assert.throws(() => buildReceipt([{ wrapperType: 'collection', collectionId: 1, collectionName: 'X', artistName: 'Y' }]), /no tracklist/);
});

test('ranking puts full albums before singles and drops cleaned duplicates', () => {
  const ranked = rankAlbums([
    { wrapperType: 'collection', collectionId: 1, collectionName: 'Moon River - Single', artistName: 'Frank Ocean', trackCount: 1 },
    { wrapperType: 'collection', collectionId: 2, collectionName: 'Blonde', artistName: 'Frank Ocean', trackCount: 17, collectionExplicitness: 'cleaned' },
    { wrapperType: 'collection', collectionId: 3, collectionName: 'Blonde', artistName: 'Frank Ocean', trackCount: 17, collectionExplicitness: 'explicit' },
    { wrapperType: 'collection', collectionId: 3, collectionName: 'Blonde', artistName: 'Frank Ocean', trackCount: 17 },
    { wrapperType: 'artist', artistId: 4 },
  ]);
  assert.deepEqual(ranked.map((item) => item.collectionId), [3, 1]);
});

test('a cleaned album stays when it is the only version', () => {
  const ranked = rankAlbums([{ wrapperType: 'collection', collectionId: 5, collectionName: 'Only', artistName: 'A', trackCount: 9, collectionExplicitness: 'cleaned' }]);
  assert.equal(ranked.length, 1);
});

test('every receipt line is exactly the column width, so the time column lines up', () => {
  const cols = 44;
  const lines = receiptLines(buildReceipt(blonde, fixedDate), cols);
  for (const line of lines) assert.ok([...line].length <= cols, `too long: ${line}`);
  const rows = lines.filter((line) => /^\d\d  /.test(line));
  assert.equal(rows.length, 17);
  for (const row of rows) assert.equal([...row].length, cols, `ragged: ${row}`);
});

test('long and non-Latin titles are cut with an ellipsis without breaking width', () => {
  const row = receiptRow('01', 'A VERY LONG TITLE THAT WILL NOT FIT IN THE SLOT AT ALL', '12:34', 30);
  assert.equal([...row].length, 30);
  assert.match(row, /… +12:34$/);
  const emoji = receiptRow('02', '\u{1F30A}\u{1F30A} 夜に駆ける', '3:00', 30);
  assert.equal([...emoji].length, 30);
  assert.equal([...pairRow('LABEL:', 'X'.repeat(80), 30)].length, 30);
  assert.equal(centered('HI', 10), '    HI');
});

test('barcode is stable per album and differs between albums', () => {
  assert.deepEqual(barcode(1146195596), barcode(1146195596));
  assert.notDeepEqual(barcode(1146195596), barcode(1146195597));
  assert.ok(barcode(1).every((width) => width >= 1 && width <= 4));
});

test('request URLs ask Apple for albums and full tracklists only', () => {
  const search = new URL(searchUrl('frank ocean'));
  assert.equal(search.searchParams.get('entity'), 'album');
  assert.equal(search.searchParams.get('term'), 'frank ocean');
  const lookup = new URL(lookupUrl(1146195596));
  assert.equal(lookup.searchParams.get('entity'), 'song');
  assert.equal(lookup.searchParams.get('id'), '1146195596');
  assert.match(CTA, /STRUMMER\.FUN/);
});

test('the artist named in the query is picked over a namesake', () => {
  const artists = [{ artistId: 1, artistName: 'Frank Ocean (IT)' }, { artistId: 442122051, artistName: 'Frank Ocean' }];
  assert.equal(artistNamedIn(artists, 'frank ocean blonde').artistId, 442122051);
  assert.equal(artistNamedIn(artists, 'blonde'), null);
  assert.equal(artistNamedIn([{ artistId: 7, artistName: 'Beyoncé' }], 'beyonce lemonade').artistId, 7);
  assert.equal(normalize('  SZA — SOS!  '), 'sza sos');
});

test('query-aware ranking beats tributes and singles with the real album', () => {
  const ranked = rankAlbums([
    { wrapperType: 'collection', collectionId: 1, collectionName: 'Piano Tribute to Frank Ocean', artistName: 'Piano Tribute Players', trackCount: 12 },
    { wrapperType: 'collection', collectionId: 2, collectionName: 'Moon River - Single', artistName: 'Frank Ocean', trackCount: 1 },
    { wrapperType: 'collection', collectionId: 3, collectionName: 'channel ORANGE', artistName: 'Frank Ocean', trackCount: 17 },
    { wrapperType: 'collection', collectionId: 4, collectionName: 'Blonde', artistName: 'Frank Ocean', trackCount: 17 },
  ], 'frank ocean blonde');
  assert.deepEqual(ranked.map((item) => item.collectionId), [4, 3, 2, 1]);
});

test('discovery URLs ask for artists and full discographies', () => {
  assert.equal(new URL(artistSearchUrl('frank ocean')).searchParams.get('entity'), 'musicArtist');
  const discography = new URL(discographyUrl(442122051));
  assert.equal(discography.searchParams.get('entity'), 'album');
  assert.equal(discography.searchParams.get('limit'), '200');
});

test('an artist can be found from album hits when artist search comes back empty', () => {
  const albumHits = [{ wrapperType: 'collection', collectionId: 2, collectionName: 'Moon River - Single', artistId: 442122051, artistName: 'Frank Ocean' }];
  assert.equal(artistNamedIn([...[], ...albumHits], 'frank ocean blonde').artistId, 442122051);
});

test("label names come out clean from both of Apple's copyright shapes", () => {
  assert.equal(labelFrom("℗ 2016 Boys Don't Cry"), "Boys Don't Cry");
  assert.equal(labelFrom('A Capitol Records UK / Polydor Label Group release; ℗ 2025 Olivia Dean'), 'Capitol Records UK / Polydor Label Group');
  assert.equal(labelFrom('An Interscope Records Release; © 2022 Top Dawg'), 'Interscope Records');
  assert.equal(labelFrom(undefined), '');
});

test('a value that overflows its row still keeps a space after the label', () => {
  const row = pairRow('LABEL:', 'CAPITOL RECORDS UK / POLYDOR LABEL GROUP AND FRIENDS', 30);
  assert.equal([...row].length, 30);
  assert.match(row, /^LABEL: \S/);
});
