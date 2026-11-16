import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GREATEST, KEYS, describe, greatestById, beatsFor, validSaved } from '../chords/engine.mjs';

test('ULT starters reproduce the researched reductions in their reference keys', () => {
  for (const [id, expected] of [
    ['ult-home', ['D', 'Bm', 'Em', 'A']],
    ['ult-independent', ['Ebm', 'Bbm', 'Gb', 'Ab']],
    ['ult-ciento', ['B', 'D#m', 'C#m', 'F#7']],
    ['ult-borrowed', ['Cmaj7', 'Fmaj7', 'Fm', 'Cmaj7']],
  ]) {
    const preset = greatestById(id);
    assert.deepEqual(preset.chords.map(chord => describe(chord, preset.key).name), expected);
    assert.equal(new URL(preset.source).protocol, 'https:');
  }
});

test('ULT starters transpose, loop and survive local-save validation', () => {
  for (const preset of GREATEST.filter(item => item.id.startsWith('ult-'))) {
    for (const key of KEYS) {
      assert.ok(validSaved([{ style: 'greatest', progression: preset.id, key, tempo: 90, chords: preset.chords }]));
      assert.ok(preset.chords.every(chord => describe(chord, key).notes.length >= 3));
    }
    assert.equal(preset.chords.reduce((sum, _, index) => sum + beatsFor('greatest', index, 1, preset), 0), 16);
  }
  assert.match(greatestById('ult-borrowed').songs[0], /Original exercise/);
  assert.equal(new Set(GREATEST.map(item => item.id)).size, GREATEST.length);
});
