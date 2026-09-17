import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHAPES, TUNING, shapeFor, soundedPitchClasses, findCapo } from '../chords/guitar.mjs';
import { GREATEST, INTERVALS, KEYS, describe, beatsFor, validSaved, pickGreatest, rootOf, greatestById } from '../chords/engine.mjs';

const ROOTS = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };

test('standard tuning is E A D G B E', () => {
  assert.deepEqual(TUNING, [4, 9, 2, 7, 11, 4]);
});

test('every fingering sounds only notes of its chord, and always its root and third', () => {
  for (const [name, frets] of Object.entries(SHAPES)) {
    const [, rootName, quality] = /^([A-G]#?)(.*)$/.exec(name);
    const root = ROOTS[rootName];
    const chordTones = INTERVALS[quality].map(interval => (root + interval) % 12);
    const sounded = soundedPitchClasses(frets);
    assert.equal(frets.length, 6, `${name} has six strings`);
    for (const pitch of sounded) assert.ok(chordTones.includes(pitch), `${name} sounds a wrong note (pitch class ${pitch})`);
    assert.ok(sounded.includes(root), `${name} is missing its root`);
    assert.ok(sounded.includes(chordTones[1]), `${name} is missing its third`);
  }
});

test('the lowest sounded string of every open major and minor shape is its root', () => {
  for (const [name, frets] of Object.entries(SHAPES)) {
    const [, rootName, quality] = /^([A-G]#?)(.*)$/.exec(name);
    if (quality !== '' && quality !== 'm') continue;
    const lowest = frets.findIndex(fret => fret >= 0);
    assert.equal((TUNING[lowest] + frets[lowest]) % 12, ROOTS[rootName], `${name} bass note is not the root`);
  }
});

test('shapeFor wraps pitch classes and returns null for chords with no shape', () => {
  assert.equal(shapeFor(7, '').name, 'G');
  assert.equal(shapeFor(-5, '').name, 'G');
  assert.equal(shapeFor(1, 'maj7'), null);
});

test('every greatest progression plays with open shapes in its home key', () => {
  for (const progression of GREATEST) {
    const chords = progression.chords.map(chord => ({ root: rootOf(chord, progression.key), quality: chord[1] }));
    const fit = findCapo(chords);
    assert.ok(fit, `${progression.id} has no playable shapes in ${progression.key}`);
    assert.equal(fit.capo, 0, `${progression.id} needs a capo in its own home key`);
  }
});

test('the greatest progressions are named correctly in their home keys', () => {
  const names = id => { const progression = greatestById(id); return progression.chords.map(chord => describe(chord, progression.key).name); };
  assert.deepEqual(names('axis'), ['G', 'D', 'Em', 'C']);
  assert.deepEqual(names('fifties'), ['G', 'Em', 'C', 'D']);
  assert.deepEqual(names('minor-axis'), ['Em', 'C', 'G', 'D']);
  assert.deepEqual(names('andalusian'), ['Am', 'G', 'F', 'E']);
  assert.deepEqual(names('canon'), ['G', 'D', 'Em', 'Bm', 'C', 'G', 'C', 'D']);
  assert.deepEqual(names('three-chord'), ['G', 'C', 'D', 'C']);
  assert.deepEqual(names('mixolydian'), ['D', 'C', 'G']);
  assert.deepEqual(names('creep'), ['G', 'B', 'C', 'Cm']);
  assert.deepEqual(names('two-five-one'), ['Dm7', 'G7', 'Cmaj7', 'Cmaj7']);
  assert.deepEqual(names('heavens-door'), ['G', 'D', 'Am', 'Am', 'G', 'D', 'C', 'C']);
  assert.deepEqual(names('rhythm'), ['C', 'Am', 'Dm', 'G']);
  assert.deepEqual(names('blues').slice(0, 5), ['A7', 'A7', 'A7', 'A7', 'D7']);
  assert.equal(names('blues').length, 12);
});

test('capo moves a progression into a key that has no open shapes', () => {
  const axis = greatestById('axis');
  const chords = axis.chords.map(chord => ({ root: rootOf(chord, 'Bb'), quality: chord[1] }));
  const fit = findCapo(chords);
  assert.equal(fit.capo, 3);
  assert.deepEqual(fit.shapes.map(shape => shape.name), ['G', 'D', 'Em', 'C']);
  assert.equal(fit.barres, 0);
});

test('capo prefers fewer barre chords over a lower fret', () => {
  const fifties = greatestById('fifties');
  const chords = fifties.chords.map(chord => ({ root: rootOf(chord, 'A'), quality: chord[1] }));
  const fit = findCapo(chords);
  assert.equal(fit.barres, 0);
  assert.ok(fit.capo > 0);
});

test('the mixolydian swagger keeps its uneven bar, and bars scale it', () => {
  const progression = greatestById('mixolydian');
  assert.deepEqual([0, 1, 2].map(index => beatsFor('greatest', index, 1, progression)), [2, 2, 4]);
  assert.deepEqual([0, 1, 2].map(index => beatsFor('greatest', index, 2, progression)), [4, 4, 8]);
  assert.equal(beatsFor('greatest', 0, 1, greatestById('axis')), 4);
});

test('pickGreatest never returns the progression already showing', () => {
  for (const progression of GREATEST) for (const draw of [0, 0.5, 0.999]) {
    assert.notEqual(pickGreatest(progression.id, () => draw).id, progression.id);
  }
});

test('saved greatest progressions validate against their own length', () => {
  const blues = greatestById('blues');
  const item = { key: 'A', style: 'greatest', progression: 'blues', tempo: 110, chords: blues.chords };
  assert.equal(validSaved([item]), true);
  assert.equal(validSaved([{ ...item, chords: blues.chords.slice(0, 4) }]), false);
  assert.equal(validSaved([{ ...item, progression: 'not-real' }]), false);
});

test('every greatest progression has songs, a formula, and a key the picker knows', () => {
  const ids = new Set();
  for (const progression of GREATEST) {
    assert.ok(!ids.has(progression.id)); ids.add(progression.id);
    assert.ok(KEYS.includes(progression.key));
    assert.ok(progression.songs.length >= 1 && progression.formula && progression.feel);
    if (progression.beats) assert.equal(progression.beats.length, progression.chords.length);
  }
});

test('chord names use sharps in sharp keys and flats in flat keys', () => {
  assert.equal(describe([2, 'm7', 'ii7'], 'E').name, 'F#m7');
  assert.equal(describe([4, '', 'III'], 'A').name, 'C#');
  assert.equal(describe([7, '7', 'V7'], 'E').name, 'B7');
  assert.equal(describe([9, 'm', 'vi'], 'Bb').name, 'Gm');
  assert.equal(describe([10, '', 'bVII'], 'F').name, 'Eb');
  assert.equal(describe([4, 'm', 'iii'], 'Ab').name, 'Cm');
  assert.equal(describe([1, '', 'bII'], 'C').name, 'Db');
});
