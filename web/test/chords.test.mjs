import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generate, describe, KEYS, PATTERNS, validSaved, beatsFor, encodeWav } from '../chords/engine.mjs';
test('every preset produces four playable chords in every key', () => {
  for (const style of Object.keys(PATTERNS)) for (const pattern of PATTERNS[style]) for (const key of KEYS) {
    assert.equal(pattern.length, style === 'personal' ? 8 : 4);
    pattern.forEach(chord => { const result = describe(chord, key); assert.ok(result.name); assert.ok(result.notes.every(note => note >= 48 && note < 72)); });
  }
});
test('personal loop preserves the requested order and 32-beat phrase', () => {
  assert.deepEqual(PATTERNS.personal[0].map(chord => describe(chord, 'C').name), ['Cmaj7','Em7','Fmaj7','Em7','Cmaj7','Em7','Am7','Fmaj7']);
  assert.deepEqual(PATTERNS.personal[0].map((_, index) => beatsFor('personal', index)), [8,4,2,2,8,4,2,2]);
});
test('WAV header and signed samples are valid PCM16', () => {
  const buffer = encodeWav(new Float32Array([-1,0,1]),44100), view = new DataView(buffer);
  assert.equal(buffer.byteLength,50); assert.equal(view.getUint32(24,true),44100); assert.equal(view.getUint32(40,true),6); assert.equal(view.getInt16(44,true),-32768); assert.equal(view.getInt16(48,true),32767);
});
test('transpose C major to D major with correct pitches', () => { assert.deepEqual(describe([0, '', 'I'], 'D').notes, [50,54,57]); });
test('keep locked chords while varying unlocked chords', () => { const prior = PATTERNS.pop[0]; const result = generate('pop', prior, [true,false,false,false], () => 0); assert.deepEqual(result[0], prior[0]); assert.notDeepEqual(result, prior); assert.notEqual(result[0], prior[0]); });
test('all locks preserve progression', () => { const prior = PATTERNS.soul[0]; assert.deepEqual(generate('soul', prior, [true,true,true,true]), prior); });
test('saved state validation rejects malformed chords and tempos', () => {
  const item = { key: 'C', style: 'bossa', tempo: 90, chords: PATTERNS.bossa[0] };
  assert.equal(validSaved([item]), true); assert.equal(validSaved([{...item, tempo: 0}]), false); assert.equal(validSaved([{...item, chords: [null]}]), false); assert.equal(validSaved({}), false);
});
