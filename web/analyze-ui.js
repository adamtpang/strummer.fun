/* ============================================================
   strummer — analyzer UI
   Wires the drop zone to analyze.js and renders the result:
   key, capo, shapes you'll need, and a scrubable chord timeline
   that follows playback.
   ============================================================ */

import { analyzeAudio, suggestCapo } from './analyze.js';

const $ = (s) => document.querySelector(s);

let result = null;      // last analysis
let objectUrl = null;   // blob URL for the <audio> element

/* ---------- helpers ---------- */
const fmtTime = (s) => {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
};

function setProgress(label, pct) {
  $('#progress-wrap').hidden = false;
  $('#progress').style.width = Math.round(pct * 100) + '%';
  $('#progress-label').textContent = label;
}

function showError(msg) {
  const el = $('#error');
  el.textContent = msg;
  el.hidden = false;
}

/* ---------- run ---------- */
async function handleFile(file) {
  if (!file) return;
  $('#analysis').hidden = true;
  $('#error').hidden = true;
  setProgress('reading file…', 0.02);

  try {
    const buf = await file.arrayBuffer();
    result = await analyzeAudio(buf, setProgress);

    // Play the user's own file back alongside the timeline.
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);
    $('#player').src = objectUrl;

    renderAnalysis(result, file.name);
    $('#progress-wrap').hidden = true;
  } catch (err) {
    console.error(err);
    $('#progress-wrap').hidden = true;
    showError(
      /decode/i.test(String(err))
        ? "Couldn't decode that file — try an mp3, m4a, wav or flac."
        : `Analysis failed: ${err.message || err}`
    );
  }
}

/* ---------- render ---------- */
function renderAnalysis(res, filename) {
  $('#analysis').hidden = false;
  $('#a-key').textContent = res.key.name;
  $('#a-capo').textContent = res.capo.capo === 0 ? 'none' : `fret ${res.capo.capo}`;
  $('#a-count').textContent = res.topChords.length;

  // Shapes you actually finger (after the capo transposition).
  $('#a-shapes').innerHTML = res.capo.shapes
    .map((s) => `<span class="shape-chip">${s}</span>`)
    .join('');

  renderTimeline(res);
}

function renderTimeline(res) {
  const total = res.duration || 1;
  $('#timeline').innerHTML = res.segments
    .map((seg, i) => {
      const width = ((seg.end - seg.start) / total) * 100;
      return `<button class="seg" data-i="${i}" style="width:${width}%"
        title="${seg.chord} · ${fmtTime(seg.start)}">${seg.chord}</button>`;
    })
    .join('');
}

/** Highlight whichever chord is sounding as the file plays. */
function followPlayback() {
  const player = $('#player');
  if (!result || player.paused) return;
  const t = player.currentTime;
  const idx = result.segments.findIndex((s) => t >= s.start && t < s.end);
  const current = idx >= 0 ? result.segments[idx] : null;
  $('#a-current').textContent = current ? current.chord : '—';

  document.querySelectorAll('.seg').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });
}

/* ---------- chord correction (Chordify's real lesson: let people fix it) ---------- */
function editSegment(i) {
  const seg = result?.segments[i];
  if (!seg) return;
  const next = prompt(`Chord at ${fmtTime(seg.start)} — correct it:`, seg.chord);
  if (!next) return;
  seg.chord = next.trim();
  // Recompute capo from the corrected progression.
  result.capo = suggestCapo(result.segments.map((s) => s.chord));
  renderAnalysis(result);
}

/* ---------- wire up ---------- */
function boot() {
  const drop = $('#drop');
  const input = $('#file');
  if (!drop) return;

  drop.addEventListener('click', () => input.click());
  drop.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
  });
  input.addEventListener('change', () => handleFile(input.files[0]));

  ['dragenter', 'dragover'].forEach((ev) =>
    drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); })
  );
  ['dragleave', 'drop'].forEach((ev) =>
    drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); })
  );
  drop.addEventListener('drop', (e) => handleFile(e.dataTransfer?.files?.[0]));

  // Seek by clicking the timeline; shift-click to correct a chord.
  $('#timeline').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-i]');
    if (!btn) return;
    const i = +btn.dataset.i;
    if (e.shiftKey) { editSegment(i); return; }
    const seg = result?.segments[i];
    if (seg) $('#player').currentTime = seg.start;
  });

  $('#player').addEventListener('timeupdate', followPlayback);
}

// Modules are deferred, so DOMContentLoaded may already have fired.
let booted = false;
function bootOnce() {
  if (booted) return;
  booted = true;
  boot();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootOnce);
else bootOnce();

window.__analyze = { analyzeAudio, suggestCapo, get result() { return result; } };
