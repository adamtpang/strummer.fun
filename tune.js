/* ============================================================
   strummer — tuner + chord ear
   Mic in → pitch (autocorrelation) → note/cents, and
   chroma → chord match. No catalog, no network: your guitar
   and the browser. The future is unwritten.
   ============================================================ */

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Standard tuning, low → high. Frequencies at A4=440.
const STRINGS = [
  { label: 'E', octave: 2, freq: 82.41, name: 'E2' },
  { label: 'A', octave: 2, freq: 110.0, name: 'A2' },
  { label: 'D', octave: 3, freq: 146.83, name: 'D3' },
  { label: 'G', octave: 3, freq: 196.0, name: 'G3' },
  { label: 'B', octave: 3, freq: 246.94, name: 'B3' },
  { label: 'e', octave: 4, freq: 329.63, name: 'E4' },
];

/* ---------- chord templates (pitch-class sets) ---------- */
// Interval sets relative to the root, as semitone offsets.
const CHORD_SHAPES = [
  { suffix: '', intervals: [0, 4, 7] },        // major
  { suffix: 'm', intervals: [0, 3, 7] },       // minor
  { suffix: '7', intervals: [0, 4, 7, 10] },   // dominant 7
  { suffix: 'maj7', intervals: [0, 4, 7, 11] },
  { suffix: 'm7', intervals: [0, 3, 7, 10] },
  { suffix: 'sus4', intervals: [0, 5, 7] },
  { suffix: 'sus2', intervals: [0, 2, 7] },
  { suffix: '5', intervals: [0, 7] },          // power chord
];

// Open-position fingerings for the chords a beginner actually needs.
// Array is low-E → high-e; -1 = muted, 0 = open.
const SHAPES = {
  G:  [3, 2, 0, 0, 0, 3],
  D:  [-1, -1, 0, 2, 3, 2],
  Em: [0, 2, 2, 0, 0, 0],
  C:  [-1, 3, 2, 0, 1, 0],
  A:  [-1, 0, 2, 2, 2, 0],
  Am: [-1, 0, 2, 2, 1, 0],
  E:  [0, 2, 2, 1, 0, 0],
  F:  [1, 3, 3, 2, 1, 1],
  Dm: [-1, -1, 0, 2, 3, 1],
};

/* ---------- song library (chords are facts, not recordings) ----------
   Progressions only — no audio, no lyrics, no tab. Enough to play along. */
const SONGS = [
  {
    id: 'closing-time',
    title: 'Closing Time',
    artist: 'Semisonic',
    key: 'G',
    capo: 0,
    bpm: 92,
    // The whole song is one four-chord loop — famously beginner-friendly.
    loop: ['G', 'D', 'Em', 'C'],
    beatsPerChord: 4,
    note: 'One loop, the entire song. Verse, chorus, outro — all G–D–Em–C.',
  },
  {
    id: 'mr-jones',
    title: 'Mr. Jones',
    artist: 'Counting Crows',
    key: 'Am',
    capo: 0,
    bpm: 140,
    loop: ['Am', 'F', 'Dm', 'G'],
    beatsPerChord: 4,
    note: 'Am–F–Dm–G on repeat. F is the only tricky one — try the small 4-string F.',
  },
  {
    id: 'four-chords',
    title: 'The Four Chords',
    artist: 'every pop song ever',
    key: 'G',
    capo: 0,
    bpm: 96,
    loop: ['G', 'D', 'Em', 'C'],
    beatsPerChord: 4,
    note: 'I–V–vi–IV. Learn this and you can fake hundreds of songs.',
  },
  {
    id: 'wonderwall',
    title: 'Wonderwall-style',
    artist: 'capo 2 practice',
    key: 'Em',
    capo: 2,
    bpm: 87,
    loop: ['Em', 'G', 'D', 'A'],
    beatsPerChord: 4,
    note: 'Capo 2. Shapes stay easy; the capo does the transposing.',
  },
];

/* ============================================================
   Audio engine
   ============================================================ */
let ac = null, analyser = null, micStream = null, rafId = null;
let buf = null, freqData = null;
let running = false;

async function startMic() {
  if (running) return true;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,   // these mangle a guitar signal
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
  } catch (err) {
    showError(
      err && err.name === 'NotAllowedError'
        ? 'Mic access denied. Allow the microphone in your browser to tune.'
        : 'No microphone found. Plug one in and try again.'
    );
    return false;
  }

  ac = new (window.AudioContext || window.webkitAudioContext)();
  if (ac.state === 'suspended') await ac.resume();

  const source = ac.createMediaStreamSource(micStream);
  analyser = ac.createAnalyser();
  analyser.fftSize = 4096;              // ~11.7Hz bins at 48k — enough with interpolation
  analyser.smoothingTimeConstant = 0.75;
  source.connect(analyser);

  buf = new Float32Array(analyser.fftSize);
  freqData = new Float32Array(analyser.frequencyBinCount);

  running = true;
  clearError();
  loop();
  return true;
}

function stopMic() {
  running = false;
  if (rafId) cancelAnimationFrame(rafId), (rafId = null);
  if (micStream) micStream.getTracks().forEach((t) => t.stop()), (micStream = null);
  if (ac) ac.close(), (ac = null);
}

/* ---------- pitch: autocorrelation with parabolic interpolation ---------- */
function detectPitch(buffer, sampleRate) {
  const SIZE = buffer.length;

  // Signal strength gate — ignore room noise.
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.008) return { freq: -1, rms };

  // Trim near-silent edges so the correlation isn't diluted.
  const thres = 0.2;
  let start = 0, end = SIZE - 1;
  for (let i = 0; i < SIZE / 2; i++) if (Math.abs(buffer[i]) > thres) { start = i; break; }
  for (let i = 1; i < SIZE / 2; i++) if (Math.abs(buffer[SIZE - i]) > thres) { end = SIZE - i; break; }
  const b = buffer.slice(start, end);
  const n = b.length;
  if (n < 512) return { freq: -1, rms };

  const c = new Float32Array(n).fill(0);
  for (let lag = 0; lag < n; lag++) {
    for (let i = 0; i < n - lag; i++) c[lag] += b[i] * b[i + lag];
  }

  // Skip the zero-lag peak, then find the highest genuine peak.
  let d = 0;
  while (d < n - 1 && c[d] > c[d + 1]) d++;
  let maxVal = -1, maxPos = -1;
  for (let i = d; i < n; i++) {
    if (c[i] > maxVal) { maxVal = c[i]; maxPos = i; }
  }
  if (maxPos <= 0) return { freq: -1, rms };

  // Parabolic interpolation around the peak for sub-bin accuracy.
  const y1 = c[maxPos - 1] || 0, y2 = c[maxPos], y3 = c[maxPos + 1] || 0;
  const a = (y1 + y3 - 2 * y2) / 2;
  const bb = (y3 - y1) / 2;
  const shift = a ? -bb / (2 * a) : 0;
  const period = maxPos + shift;
  if (period <= 0) return { freq: -1, rms };

  const freq = sampleRate / period;
  if (freq < 60 || freq > 1400) return { freq: -1, rms };  // outside guitar range
  return { freq, rms };
}

function freqToNote(freq) {
  const midi = 69 + 12 * Math.log2(freq / 440);
  const rounded = Math.round(midi);
  const cents = Math.round((midi - rounded) * 100);
  return {
    name: NOTES[((rounded % 12) + 12) % 12],
    octave: Math.floor(rounded / 12) - 1,
    cents,
    midi: rounded,
  };
}

/** Nearest standard-tuning string, so we can say "that's your A string". */
function nearestString(freq) {
  let best = null, bestDist = Infinity;
  for (const s of STRINGS) {
    const dist = Math.abs(12 * Math.log2(freq / s.freq));  // distance in semitones
    if (dist < bestDist) { bestDist = dist; best = s; }
  }
  return bestDist <= 1.5 ? best : null;
}

/* ---------- chord: chroma vector → template match ---------- */
function computeChroma() {
  analyser.getFloatFrequencyData(freqData);
  const sr = ac.sampleRate;
  const chroma = new Array(12).fill(0);
  let total = 0;

  for (let i = 1; i < freqData.length; i++) {
    const freq = (i * sr) / analyser.fftSize;
    if (freq < 70 || freq > 2000) continue;
    // dB → linear magnitude
    const mag = Math.pow(10, freqData[i] / 20);
    if (mag < 1e-5) continue;
    const midi = 69 + 12 * Math.log2(freq / 440);
    const pc = ((Math.round(midi) % 12) + 12) % 12;
    chroma[pc] += mag;
    total += mag;
  }
  if (total <= 0) return null;
  return chroma.map((v) => v / total);
}

function matchChord(chroma) {
  if (!chroma) return null;
  let best = null, bestScore = -Infinity;

  for (let root = 0; root < 12; root++) {
    for (const shape of CHORD_SHAPES) {
      // Score = energy inside the chord minus energy outside it.
      const inSet = new Set(shape.intervals.map((iv) => (root + iv) % 12));
      let inside = 0, outside = 0;
      for (let pc = 0; pc < 12; pc++) {
        if (inSet.has(pc)) inside += chroma[pc];
        else outside += chroma[pc];
      }
      // Normalize so 3-note and 4-note shapes compete fairly.
      const score = inside / inSet.size - outside / (12 - inSet.size);
      if (score > bestScore) {
        bestScore = score;
        best = { name: NOTES[root] + shape.suffix, score, root };
      }
    }
  }
  return bestScore > 0.02 ? best : null;
}

/* ============================================================
   Render loop
   ============================================================ */
let lastChord = null, chordHold = 0;

function loop() {
  if (!running) return;
  analyser.getFloatTimeDomainData(buf);
  const { freq, rms } = detectPitch(buf, ac.sampleRate);

  if (freq > 0) {
    const note = freqToNote(freq);
    const str = nearestString(freq);
    renderTuner(freq, note, str, rms);
  } else {
    renderIdle(rms);
  }

  // Chords change slower than pitch — hold a match briefly so it doesn't flicker.
  const chord = matchChord(computeChroma());
  if (chord && rms > 0.012) {
    if (!lastChord || chord.name !== lastChord.name) chordHold = 0;
    lastChord = chord;
    chordHold = Math.min(chordHold + 1, 30);
  } else if (chordHold > 0) {
    chordHold -= 2;
  }
  renderChord(chordHold > 6 ? lastChord : null);
  checkPractice(chordHold > 6 ? lastChord : null);

  rafId = requestAnimationFrame(loop);
}

/* ============================================================
   UI
   ============================================================ */
const $ = (s) => document.querySelector(s);

function renderTuner(freq, note, str, rms) {
  $('#note').textContent = note.name;
  $('#octave').textContent = note.octave;
  $('#freq').textContent = freq.toFixed(1) + ' Hz';
  $('#string-hint').textContent = str ? `${str.name} string` : 'not a standard string';

  const cents = note.cents;
  $('#cents').textContent = (cents > 0 ? '+' : '') + cents + '¢';

  // Needle: ±50 cents maps to ±50% of the dial.
  const pct = Math.max(-50, Math.min(50, cents));
  $('#needle').style.transform = `translateX(${pct * 2}%)`;

  const inTune = Math.abs(cents) <= 5;
  $('#dial').classList.toggle('in-tune', inTune);
  $('#verdict').textContent = inTune ? 'in tune' : cents < 0 ? 'too flat — tighten' : 'too sharp — loosen';
  $('#verdict').className = 'verdict ' + (inTune ? 'good' : 'off');

  $('#level').style.width = Math.min(100, rms * 900) + '%';
}

function renderIdle(rms) {
  $('#verdict').textContent = 'play a string…';
  $('#verdict').className = 'verdict';
  $('#dial').classList.remove('in-tune');
  $('#level').style.width = Math.min(100, rms * 900) + '%';
}

function renderChord(chord) {
  $('#chord-name').textContent = chord ? chord.name : '—';
  $('#chord-name').classList.toggle('active', !!chord);
}

function showError(msg) {
  const el = $('#error');
  el.textContent = msg;
  el.hidden = false;
}
function clearError() {
  $('#error').hidden = true;
}

/* ---------- chord diagram ---------- */
function chordDiagram(name) {
  const shape = SHAPES[name];
  if (!shape) return `<div class="no-shape">${name}</div>`;
  const strings = shape
    .map((fret, i) => {
      const label = fret === -1 ? '×' : fret === 0 ? '○' : fret;
      const cls = fret === -1 ? 'muted' : fret === 0 ? 'open' : 'fretted';
      return `<div class="fing ${cls}" title="string ${6 - i}">${label}</div>`;
    })
    .join('');
  return `<div class="diagram"><div class="dg-name">${name}</div><div class="dg-strings">${strings}</div>
    <div class="dg-legend">E A D G B e</div></div>`;
}

/* ============================================================
   Practice mode — the Rock Band bit: we listen, you play
   ============================================================ */
let practice = null;

function startPractice(song) {
  practice = { song, index: 0, hits: 0, total: 0, lastAdvance: 0 };
  renderPractice();
  $('#practice').hidden = false;
}
function stopPractice() {
  practice = null;
  $('#practice').hidden = true;
}

function checkPractice(chord) {
  if (!practice || !chord) return;
  const target = practice.song.loop[practice.index];
  if (chord.name !== target) return;
  // Debounce: one advance per held chord, not per frame.
  const now = performance.now();
  if (now - practice.lastAdvance < 700) return;
  practice.lastAdvance = now;
  practice.hits++;
  practice.total++;
  practice.index = (practice.index + 1) % practice.song.loop.length;
  renderPractice(true);
}

function renderPractice(justHit) {
  if (!practice) return;
  const { song, index, hits } = practice;
  $('#p-title').textContent = `${song.title} — ${song.artist}`;
  $('#p-meta').textContent =
    `key of ${song.key} · ${song.bpm} bpm · ` + (song.capo ? `capo ${song.capo}` : 'no capo');
  $('#p-note').textContent = song.note;
  $('#p-count').textContent = hits;

  $('#p-loop').innerHTML = song.loop
    .map((c, i) => `<span class="chip ${i === index ? 'next' : ''}">${c}</span>`)
    .join('<span class="arrow">→</span>');

  $('#p-diagram').innerHTML = chordDiagram(song.loop[index]);
  if (justHit) {
    const el = $('#p-diagram');
    el.classList.remove('hit');
    void el.offsetWidth;   // restart the animation
    el.classList.add('hit');
  }
}

/* ============================================================
   Boot
   ============================================================ */
function boot() {
  // Song list
  $('#songs').innerHTML = SONGS.map(
    (s) => `<button class="song" data-song="${s.id}">
      <span class="s-title">${s.title}</span>
      <span class="s-artist">${s.artist}</span>
      <span class="s-chords">${s.loop.join(' · ')}${s.capo ? ` · capo ${s.capo}` : ''}</span>
    </button>`
  ).join('');

  $('#songs').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-song]');
    if (!btn) return;
    const song = SONGS.find((s) => s.id === btn.dataset.song);
    if (!song) return;
    if (!running && !(await startMic())) return;
    startPractice(song);
  });

  $('#start').addEventListener('click', async () => {
    if (running) {
      stopMic();
      stopPractice();
      $('#start').textContent = 'Start tuning';
      $('#verdict').textContent = 'mic off';
      return;
    }
    if (await startMic()) $('#start').textContent = 'Stop';
  });

  $('#p-close').addEventListener('click', stopPractice);

  // Reference tones — pluck-free way to check the tuner and train your ear.
  $('#strings').innerHTML = STRINGS.map(
    (s) => `<button class="stringbtn" data-freq="${s.freq}">${s.label}<small>${s.name}</small></button>`
  ).join('');
  $('#strings').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-freq]');
    if (!btn) return;
    playReference(parseFloat(btn.dataset.freq));
  });
}

/** Short sine reference tone. Uses its own context so it can't disturb the analyser. */
function playReference(freq) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = freq;
  osc.type = 'sine';
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.6);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 1.7);
  osc.onended = () => ctx.close();
}

document.addEventListener('DOMContentLoaded', boot);

// Exposed for verification/testing in the console.
window.__tuner = { detectPitch, freqToNote, matchChord, computeChroma, nearestString, SONGS, SHAPES };
