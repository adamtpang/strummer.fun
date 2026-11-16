import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, searchSongs, sourceSearch } from '../learn/catalog.mjs';
test('find songs by title, artist, show and accent-insensitive terms',()=>{assert.equal(searchSongs('everything stays')[0].id,'everything-stays');assert.ok(searchSongs('adventure time').length>=3);assert.ok(searchSongs('mistério').length);assert.equal(searchSongs('nothing-matches').length,0);});
test('IDs unique, direct sources HTTPS, unverified entries have no chords',()=>{assert.equal(new Set(CATALOG.map(song=>song.id)).size,CATALOG.length);for(const song of CATALOG){song.sources.forEach(source=>assert.equal(new URL(source.url).protocol,'https:'));if(!song.sources.length)assert.equal(song.chords.length,0);}});
test('external search encodes user input, rejects unsupported providers',()=>{const url=new URL(sourceSearch('x & y','guitar'));assert.equal(url.hostname,'www.google.com');assert.ok(url.searchParams.get('q').includes('x & y'));assert.throws(()=>sourceSearch('x','bad'));});
