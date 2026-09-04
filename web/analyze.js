/* ============================================================
   strummer — bring-your-own-audio chord analysis
   Decode a file you own → chroma over time → Viterbi-smoothed
   chord timeline + key + capo suggestion. 100% in your browser:
   the audio never leaves this machine.

   Approach follows the classic MIR pipeline (chroma + templates +
   HMM smoothing) rather than a trained net, so it needs no model
   download and no server. Chordify — which does use neural nets —
   reports 75-90% accuracy; treat output as a strong first draft
   and expect to fix a chord or two. That's why chords are editable.
   ============================================================ */

const PC_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/* ---------- FFT: iterative radix-2 Cooley-Tukey ---------- */
function fftRadix2(re, im) {
  const n = re.length;
  // bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang), wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1, curIm = 0;
      for (let k = 0; k < len / 2; k++) {
        const aRe = re[i + k], aIm = im[i + k];
        const bRe = re[i + k + len / 2] * curRe - im[i + k + len / 2] * curIm;
        const bIm = re[i + k + len / 2] * curIm + im[i + k + len / 2] * curRe;
        re[i + k] = aRe + bRe; im[i + k] = aIm + bIm;
        re[i + k + len / 2] = aRe - bRe; im[i + k + len / 2] = aIm - bIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
}

/* ---------- chord vocabulary ---------- */
// Major and minor over all 12 roots. Deliberately NOT including every
// extension: on guitar, extra 7ths/9ths mostly confuse a beginner and
// hurt accuracy more than they help.
function buildChordTemplates() {
  const shapes = [
    { suffix: '', intervals: [0, 4, 7] },
    { suffix: 'm', intervals: [0, 3, 7] },
  ];
  const templates = [];
  for (const shape of shapes) {
    for (let root = 0; root < 12; root++) {
      const vec = new Array(12).fill(0);
      // Weight the root a little heavier — it anchors the chord's identity.
      shape.intervals.forEach((iv, idx) => {
        vec[(root + iv) % 12] = idx === 0 ? 1.15 : 1.0;
      });
      const norm = Math.hypot(...vec);
      templates.push({
        name: PC_NAMES[root] + shape.suffix,
        root,
        isMinor: shape.suffix === 'm',
        vec: vec.map((v) => v / norm),
        pcs: shape.intervals.map((iv) => (root + iv) % 12),
      });
    }
  }
  return templates;
}
const TEMPLATES = buildChordTemplates();

/* ---------- decode + resample ---------- */
/**
 * Decode any browser-supported audio file to mono at a low sample rate.
 * 11025 Hz keeps everything up to ~5.5kHz — far more than chord partials
 * need — and makes the FFT pass roughly 4x faster than at 44.1k.
 */
export async function decodeToMono(arrayBuffer, targetRate = 11025, onProgress) {
  onProgress?.('decoding audio…', 0.05);
  const tmpCtx = new (window.AudioContext || window.webkitAudioContext)();
  let decoded;
  try {
    decoded = await tmpCtx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    tmpCtx.close();
  }

  onProgress?.('resampling…', 0.15);
  const frames = Math.ceil(decoded.duration * targetRate);
  const off = new OfflineAudioContext(1, frames, targetRate);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const rendered = await off.startRendering();
  return { samples: rendered.getChannelData(0), rate: targetRate, duration: decoded.duration };
}

/* ---------- chroma ---------- */
/**
 * Per-frame 12-bin pitch-class energy.
 * Log-compresses magnitudes (tames drums/vocals dominating the mix) and
 * only counts bins in the range where chord tones actually live.
 */
function chromagram(samples, rate, frameSize = 8192, hop = 2048, onProgress) {
  const nFrames = Math.max(1, Math.floor((samples.length - frameSize) / hop));
  const chroma = [];
  const times = [];

  // Precompute the pitch class for every usable FFT bin.
  const binPc = new Int8Array(frameSize / 2);
  const binWeight = new Float32Array(frameSize / 2);
  for (let i = 1; i < frameSize / 2; i++) {
    const freq = (i * rate) / frameSize;
    if (freq < 65 || freq > 2100) { binPc[i] = -1; continue; }
    const midi = 69 + 12 * Math.log2(freq / 440);
    binPc[i] = ((Math.round(midi) % 12) + 12) % 12;
    // Gentle tilt: the low-mid register carries chord identity best.
    binWeight[i] = freq < 500 ? 1.0 : 0.6;
  }

  // Hann window
  const win = new Float32Array(frameSize);
  for (let i = 0; i < frameSize; i++) {
    win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (frameSize - 1)));
  }

  const re = new Float64Array(frameSize);
  const im = new Float64Array(frameSize);

  for (let f = 0; f < nFrames; f++) {
    const start = f * hop;
    for (let i = 0; i < frameSize; i++) {
      re[i] = samples[start + i] * win[i];
      im[i] = 0;
    }
    fftRadix2(re, im);

    const vec = new Array(12).fill(0);
    for (let i = 1; i < frameSize / 2; i++) {
      const pc = binPc[i];
      if (pc < 0) continue;
      const mag = Math.hypot(re[i], im[i]);
      // log compression — a loud snare shouldn't outvote the guitar
      vec[pc] += Math.log1p(mag * 40) * binWeight[i];
    }
    const total = vec.reduce((a, b) => a + b, 0);
    chroma.push(total > 0 ? vec.map((v) => v / total) : vec);
    times.push(start / rate);

    if (onProgress && f % 40 === 0) {
      onProgress('listening for chords…', 0.2 + 0.55 * (f / nFrames));
    }
  }
  return { chroma, times, hopTime: hop / rate };
}

/** Moving-median smoothing: kills single-frame flickers before decoding. */
function smoothChroma(chroma, radius = 3) {
  if (chroma.length < 2 * radius + 1) return chroma;
  const out = [];
  for (let i = 0; i < chroma.length; i++) {
    const lo = Math.max(0, i - radius), hi = Math.min(chroma.length - 1, i + radius);
    const vec = new Array(12);
    for (let pc = 0; pc < 12; pc++) {
      const window = [];
      for (let j = lo; j <= hi; j++) window.push(chroma[j][pc]);
      window.sort((a, b) => a - b);
      vec[pc] = window[Math.floor(window.length / 2)];
    }
    out.push(vec);
  }
  return out;
}

/* ---------- Viterbi chord decoding ---------- */
/**
 * Emission = cosine similarity to each template; transitions strongly favour
 * staying put. This is what stops the output oscillating C/Am/C/Am every
 * 200ms — real songs hold a chord for a bar or more.
 */
function decodeChords(chroma, selfBias = 4.0) {
  const N = TEMPLATES.length;
  const T = chroma.length;
  if (T === 0) return [];

  const emission = [];
  for (let t = 0; t < T; t++) {
    const norm = Math.hypot(...chroma[t]) || 1;
    const row = new Float64Array(N);
    for (let s = 0; s < N; s++) {
      let dot = 0;
      for (let pc = 0; pc < 12; pc++) dot += chroma[t][pc] * TEMPLATES[s].vec[pc];
      // scale similarity into a log-prob-ish range
      row[s] = (dot / norm) * 12;
    }
    emission.push(row);
  }

  const delta = new Float64Array(N).fill(0);
  const psi = [];
  for (let s = 0; s < N; s++) delta[s] = emission[0][s];

  for (let t = 1; t < T; t++) {
    const prev = Float64Array.from(delta);
    const back = new Int16Array(N);
    for (let s = 0; s < N; s++) {
      let bestVal = -Infinity, bestIdx = 0;
      for (let p = 0; p < N; p++) {
        const val = prev[p] + (p === s ? selfBias : 0);
        if (val > bestVal) { bestVal = val; bestIdx = p; }
      }
      delta[s] = bestVal + emission[t][s];
      back[s] = bestIdx;
    }
    psi.push(back);
  }

  // backtrack
  let bestIdx = 0;
  for (let s = 1; s < N; s++) if (delta[s] > delta[bestIdx]) bestIdx = s;
  const path = new Array(T);
  path[T - 1] = bestIdx;
  for (let t = T - 2; t >= 0; t--) path[t] = psi[t][path[t + 1]];
  return path;
}

/** Collapse the frame-by-frame path into timed chord segments. */
function segment(path, times, hopTime, minDuration = 0.45) {
  const raw = [];
  let curr = path[0], start = times[0];
  for (let t = 1; t < path.length; t++) {
    if (path[t] !== curr) {
      raw.push({ chord: TEMPLATES[curr].name, start, end: times[t] });
      curr = path[t];
      start = times[t];
    }
  }
  raw.push({ chord: TEMPLATES[curr].name, start, end: times[times.length - 1] + hopTime });

  // Absorb blips shorter than a typical strum into the neighbour.
  const out = [];
  for (const seg of raw) {
    const dur = seg.end - seg.start;
    if (dur < minDuration && out.length) {
      out[out.length - 1].end = seg.end;
    } else if (dur >= minDuration || !out.length) {
      if (out.length && out[out.length - 1].chord === seg.chord) out[out.length - 1].end = seg.end;
      else out.push({ ...seg });
    }
  }
  return out.filter((s) => s.end - s.start >= 0.2);
}

/* ---------- key detection (Krumhansl-Schmuckler) ---------- */
const KS_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KS_MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function detectKey(chroma) {
  const avg = new Array(12).fill(0);
  for (const frame of chroma) for (let pc = 0; pc < 12; pc++) avg[pc] += frame[pc];
  const total = avg.reduce((a, b) => a + b, 0) || 1;
  const norm = avg.map((v) => v / total);

  let best = null, bestScore = -Infinity;
  for (let root = 0; root < 12; root++) {
    for (const [profile, isMinor] of [[KS_MAJOR, false], [KS_MINOR, true]]) {
      let score = 0;
      for (let pc = 0; pc < 12; pc++) score += norm[(root + pc) % 12] * profile[pc];
      if (score > bestScore) {
        bestScore = score;
        best = { root, isMinor, name: PC_NAMES[root] + (isMinor ? 'm' : '') };
      }
    }
  }
  return best;
}

/* ---------- capo suggestion (the guitar-specific bit) ---------- */
// Chords a beginner can play open. Anything else needs a barre.
const OPEN_CHORDS = new Set(['C', 'A', 'G', 'E', 'D', 'Am', 'Em', 'Dm']);
const EASY_ISH = new Set(['F', 'Bm', 'A7', 'E7', 'D7', 'G7', 'C7', 'B7']);

function transposeChord(name, semitones) {
  const match = name.match(/^([A-G]#?)(m?)$/);
  if (!match) return name;
  const pc = PC_NAMES.indexOf(match[1]);
  if (pc < 0) return name;
  return PC_NAMES[(((pc - semitones) % 12) + 12) % 12] + match[2];
}

/**
 * Try every capo position and score how playable the progression becomes.
 * A capo at fret N means you finger shapes N semitones LOWER than sounding pitch.
 */
export function suggestCapo(chordNames) {
  const unique = [...new Set(chordNames)];
  let best = { capo: 0, score: -Infinity, shapes: [] };

  for (let capo = 0; capo <= 7; capo++) {
    const shapes = unique.map((c) => transposeChord(c, capo));
    let score = 0;
    for (const s of shapes) {
      if (OPEN_CHORDS.has(s)) score += 2;
      else if (EASY_ISH.has(s)) score += 0.5;
      else score -= 1.5;              // barre chord
    }
    score -= capo * 0.12;             // all else equal, prefer a lower capo
    if (score > best.score) best = { capo, score, shapes };
  }
  return best;
}

/* ---------- main entry ---------- */
export async function analyzeAudio(arrayBuffer, onProgress) {
  const { samples, rate, duration } = await decodeToMono(arrayBuffer, 11025, onProgress);

  const { chroma, times, hopTime } = chromagram(samples, rate, 8192, 2048, onProgress);
  if (!chroma.length) throw new Error('That file was too short to analyze.');

  onProgress?.('smoothing…', 0.8);
  const smoothed = smoothChroma(chroma, 3);

  onProgress?.('working out the progression…', 0.88);
  const path = decodeChords(smoothed);
  const segments = segment(path, times, hopTime);

  const key = detectKey(smoothed);
  const chordNames = segments.map((s) => s.chord);
  const capo = suggestCapo(chordNames);

  // The most-used chords, in order of total time — that's what to practise.
  const timeByChord = new Map();
  for (const s of segments) {
    timeByChord.set(s.chord, (timeByChord.get(s.chord) || 0) + (s.end - s.start));
  }
  const topChords = [...timeByChord.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([chord, secs]) => ({ chord, secs: +secs.toFixed(1) }));

  onProgress?.('done', 1);
  return { duration, key, capo, segments, topChords };
}

export const __testing = {
  buildChordTemplates, chromagram, decodeChords, segment, detectKey, transposeChord, fftRadix2, TEMPLATES,
};
