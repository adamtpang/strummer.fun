// Headless accuracy harness for analyze.js. Ground truth is Adam's own LMMS
// sketches: their intended key and chords live in the song frontmatter, and
// the WAV is a deterministic render, so there is no guesswork and no
// copyright question.
//
//   node web/test/analyze-harness.mjs            # score every known sketch
//   node web/test/analyze-harness.mjs no-063     # one sketch, with the timeline
//
// Renders come from: python songs/tools/lmms-mint.py --song <id> --render
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { __testing } from '../analyze.js';

const here = dirname(fileURLToPath(import.meta.url));
const songsDir = join(here, '..', '..', 'songs');
const { chromagram, decodeChords, segment, detectKey, refineSevenths, mergeRepeats } = __testing;

const CASES = ['no-062', 'no-063', 'no-064', 'no-065', 'no-066', 'ipop-53'];
const FLAT_TO_SHARP = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' };

function readWav(path) {
  const buf = readFileSync(path);
  const channels = buf.readUInt16LE(22), rate = buf.readUInt32LE(24), bits = buf.readUInt16LE(34);
  let offset = 12;
  while (buf.toString('ascii', offset, offset + 4) !== 'data') offset += 8 + buf.readUInt32LE(offset + 4);
  const dataLen = buf.readUInt32LE(offset + 4), start = offset + 8;
  const bytes = bits / 8, frames = Math.floor(dataLen / bytes / channels);
  const mono = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) {
      const at = start + (i * channels + c) * bytes;
      sum += bits === 16 ? buf.readInt16LE(at) / 32768 : bits === 32 ? buf.readInt32LE(at) / 2147483648 : buf.readFloatLE(at);
    }
    mono[i] = sum / channels;
  }
  return { samples: mono, rate };
}

function resample(samples, from, to) {
  const ratio = from / to, out = new Float32Array(Math.floor(samples.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const pos = i * ratio, lo = Math.floor(pos), frac = pos - lo;
    out[i] = samples[lo] * (1 - frac) + (samples[Math.min(lo + 1, samples.length - 1)] || 0) * frac;
  }
  return out;
}

function smoothChroma(chroma, radius = 3) {
  if (chroma.length < 2 * radius + 1) return chroma;
  return chroma.map((_, i) => {
    const lo = Math.max(0, i - radius), hi = Math.min(chroma.length - 1, i + radius);
    return Array.from({ length: 12 }, (_, pc) => {
      const w = []; for (let j = lo; j <= hi; j++) w.push(chroma[j][pc]);
      w.sort((a, b) => a - b); return w[Math.floor(w.length / 2)];
    });
  });
}

function truthFor(id) {
  const text = readFileSync(join(songsDir, 'src', 'content', 'songs', `${id}.md`), 'utf8');
  const field = (name) => (text.match(new RegExp(`^${name}:\\s*'?([^'\\n]+)'?`, 'm')) || [])[1]?.trim() || '';
  const key = field('key').replace(/ major$/, '').replace(/ minor$/, 'm');
  let chords = field('chords');
  if (chords.includes('A:')) chords = chords.split('B:')[0].replace('A:', '');
  const list = chords.split('|').map((c) => c.trim()).filter((c) => /^[A-G]/.test(c));
  return { key: normalize(key), chords: list.map(normalize) };
}

function normalize(name) {
  const m = name.match(/^([A-G][b#]?)(.*)$/);
  if (!m) return name;
  const root = FLAT_TO_SHARP[m[1]] || m[1];
  const suffix = m[2].replace(/\/.*$/, '');
  return root + suffix;
}
const root = (name) => name.match(/^[A-G]#?/)[0];
const quality = (name) => name.replace(/^[A-G]#?/, '');

function analyze(id) {
  const { samples, rate } = readWav(join(songsDir, 'lmms-projects', `${id}.wav`));
  const mono = resample(samples, rate, 11025);
  const { chroma, times, hopTime } = chromagram(mono, 11025, 8192, 2048);
  const smoothed = smoothChroma(chroma);
  const path = decodeChords(smoothed);
  const segments = mergeRepeats(refineSevenths(segment(path, times, hopTime), smoothed, times));
  return { segments, key: detectKey(smoothed, segments) };
}

const only = process.argv[2];
let rootHits = 0, rootTotal = 0, qualHits = 0, keyHits = 0, keyTotal = 0;
for (const id of only ? [only] : CASES) {
  const wav = join(songsDir, 'lmms-projects', `${id}.wav`);
  if (!existsSync(wav)) { console.log(`${id}: no render`); continue; }
  const truth = truthFor(id);
  const { segments, key } = analyze(id);
  const cycle = [];
  for (const s of segments) if (!cycle.length || cycle[cycle.length - 1] !== s.chord) cycle.push(s.chord);
  const detected = cycle.slice(0, truth.chords.length);
  const rootsOk = truth.chords.map((c, i) => detected[i] && root(detected[i]) === root(c));
  const qualOk = truth.chords.map((c, i) => detected[i] === c);
  rootTotal += truth.chords.length; rootHits += rootsOk.filter(Boolean).length; qualHits += qualOk.filter(Boolean).length;
  keyTotal++; if (key.name === truth.key) keyHits++;
  console.log(`${id.padEnd(8)} key ${truth.key.padEnd(3)} -> ${key.name.padEnd(3)} ${key.name === truth.key ? 'ok ' : 'MISS'} | ${truth.chords.join(' ')}  ->  ${detected.join(' ')}`);
  if (only) for (const s of segments) console.log(`   ${s.start.toFixed(1).padStart(5)}s ${s.chord}`);
}
console.log(`\nroots ${rootHits}/${rootTotal}  exact ${qualHits}/${rootTotal}  keys ${keyHits}/${keyTotal}`);
