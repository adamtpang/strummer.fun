import { KEYS, GREATEST, generate, describe, validSaved, beatsFor, encodeWav, greatestById, pickGreatest, rootOf, spell } from './engine.mjs';
import { findCapo } from './guitar.mjs';
const find = id => document.getElementById(id);
const storageKey = 'strummer.chords.v1';
const SVG = 'http://www.w3.org/2000/svg';
let progression = GREATEST[0];
let chords = progression.chords.map(chord => [...chord]);
let locks = chords.map(() => false);
let saved = [];
let context, output, timer, playing = false, position = 0;
const voices = new Set();
const status = message => { find('status').textContent = message; };
const isGreatest = () => find('style').value === 'greatest';
const beats = index => beatsFor(find('style').value, index, Number(find('bars').value), isGreatest() ? progression : null);
KEYS.forEach(key => find('key').add(new Option(key, key)));
GREATEST.forEach(item => find('progression').add(new Option(`${item.name} (${item.formula})`, item.id)));
find('key').value = progression.key;
try { const data = JSON.parse(localStorage.getItem(storageKey) || '[]'); if (validSaved(data)) saved = data; } catch { status('Local storage unavailable. You can still play and copy chords.'); }
function loadGreatest(next, keepKey = false) {
  progression = next;
  chords = next.chords.map(chord => [...chord]);
  locks = chords.map(() => false);
  find('progression').value = next.id;
  if (!keepKey) find('key').value = next.key;
}
function stop() {
  playing = false; clearTimeout(timer);
  voices.forEach(voice => { try { voice.stop(); } catch {} }); voices.clear();
  find('play').textContent = 'Play loop'; find('play').setAttribute('aria-pressed', 'false');
  document.querySelectorAll('.chord').forEach(card => card.classList.remove('active'));
}
async function audio() {
  if (!context) { context = new AudioContext(); output = context.createGain(); output.connect(context.destination); }
  await context.resume(); output.gain.value = Number(find('volume').value) / 100 * 0.3;
}
function sound(index, duration, target = context, destination = output, when = target.currentTime) {
  const notes = describe(chords[index], find('key').value).notes;
  [...notes, notes[0] - 12].forEach((note, noteIndex) => {
    const oscillator = target.createOscillator(), envelope = target.createGain();
    const now = when + noteIndex * 0.025;
    oscillator.type = 'triangle'; oscillator.frequency.value = 440 * 2 ** ((note - 69) / 12);
    envelope.gain.setValueAtTime(0, now); envelope.gain.linearRampToValueAtTime(0.2, now + 0.02); envelope.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(envelope); envelope.connect(destination); if (target === context) voices.add(oscillator);
    oscillator.onended = () => { voices.delete(oscillator); oscillator.disconnect(); envelope.disconnect(); };
    oscillator.start(now); oscillator.stop(now + duration + 0.05);
  });
}
function tick() {
  if (!playing) return;
  const duration = 60 / Number(find('tempo').value) * beats(position);
  document.querySelectorAll('.chord').forEach((card, index) => card.classList.toggle('active', index === position));
  sound(position, duration * 0.9); position = (position + 1) % chords.length; timer = setTimeout(tick, duration * 1000);
}
function node(name, attributes, text) {
  const element = document.createElementNS(SVG, name);
  Object.entries(attributes).forEach(([attribute, value]) => element.setAttribute(attribute, value));
  if (text !== undefined) element.textContent = text;
  return element;
}
function guitarDiagram(shape, soundingName) {
  const left = 24, gap = 16, top = 26, fretGap = 22, fretsShown = 4;
  const fretted = shape.frets.filter(fret => fret > 0);
  const highest = fretted.length ? Math.max(...fretted) : 0;
  const base = highest <= fretsShown ? 1 : Math.min(...fretted);
  const svg = node('svg', { viewBox: '0 0 114 132', class: 'guitar', role: 'img',
    'aria-label': `${soundingName} guitar shape, low E to high E: ${shape.frets.map(fret => fret < 0 ? 'muted' : fret).join(', ')}` });
  for (let string = 0; string < 6; string++) svg.append(node('line', { class: 'string', x1: left + string * gap, x2: left + string * gap, y1: top, y2: top + fretsShown * fretGap }));
  for (let fret = 0; fret <= fretsShown; fret++) svg.append(node('line', { class: fret === 0 && base === 1 ? 'nut' : 'fret', x1: left, x2: left + 5 * gap, y1: top + fret * fretGap, y2: top + fret * fretGap }));
  if (base > 1) svg.append(node('text', { x: left - 9, y: top + fretGap * 0.65, 'text-anchor': 'end' }, `${base}fr`));
  shape.frets.forEach((fret, string) => {
    const x = left + string * gap;
    if (fret < 0) svg.append(node('text', { x, y: top - 8, 'text-anchor': 'middle' }, '×'));
    else if (fret === 0) svg.append(node('circle', { class: 'open', cx: x, cy: top - 11, r: 3.5 }));
    else svg.append(node('circle', { class: 'dot', cx: x, cy: top + (fret - base + 0.5) * fretGap, r: 6 }));
  });
  return svg;
}
function renderGreatest() {
  find('greatest').hidden = !isGreatest();
  if (!isGreatest()) return;
  find('greatest-formula').textContent = progression.formula;
  find('greatest-name').textContent = progression.feel;
  find('greatest-songs').replaceChildren(...progression.songs.map(song => { const item = document.createElement('li'); item.textContent = song; return item; }));
}
function renderCapo(fit, key) {
  const line = find('capo');
  if (!fit) { line.textContent = `No open or common barre shapes cover every chord in ${key}. Try another tonic.`; return; }
  const strong = document.createElement('strong');
  strong.textContent = fit.capo === 0 ? 'No capo.' : `Capo ${fit.capo}.`;
  const rest = fit.capo === 0 ? ' Play the shapes as shown.' : ` Play the shapes shown; they sound in ${key}.`;
  const barres = fit.barres ? ` ${fit.barres} barre chord${fit.barres === 1 ? '' : 's'}.` : ' All open chords.';
  line.replaceChildren(strong, rest + barres);
}
function render() {
  const key = find('key').value;
  find('bars').disabled = find('style').value === 'personal';
  renderGreatest();
  const fit = findCapo(chords.map(chord => ({ root: rootOf(chord, key), quality: chord[1] })));
  renderCapo(fit, key);
  find('chords').replaceChildren();
  chords.forEach((chord, index) => {
    const info = describe(chord, key), card = document.createElement('article'); card.className = 'chord';
    const degree = document.createElement('span'); degree.className = 'degree'; degree.textContent = `${index + 1} / ${info.degree} / ${beats(index)} beats`;
    const button = document.createElement('button'); button.className = 'name'; button.textContent = info.name; button.title = `Play ${info.name}`; button.setAttribute('aria-label', `Play ${info.name}`);
    button.onclick = async () => { stop(); try { await audio(); sound(index, 1.8); } catch { status('Audio could not start. Try again.'); } };
    card.append(degree, button);
    if (fit) {
      const shape = fit.shapes[index];
      card.append(guitarDiagram(shape, info.name));
      if (fit.capo > 0) { const label = document.createElement('span'); label.className = 'shape-label'; label.textContent = `${shape.name} shape`; card.append(label); }
    }
    const keys = document.createElement('div'); keys.className = 'keyboard'; keys.hidden = isGreatest(); keys.setAttribute('role', 'img'); keys.setAttribute('aria-label', `Notes: ${info.notes.map(note => spell(note, key)).join(', ')}`);
    for (let note = 0; note < 12; note++) { const pianoKey = document.createElement('i'); pianoKey.className = `${[1,3,6,8,10].includes(note) ? 'black' : ''} ${info.notes.some(pitch => pitch % 12 === note) ? 'on' : ''}`; keys.append(pianoKey); }
    const label = document.createElement('label'); label.className = 'lock'; label.hidden = isGreatest(); const lock = document.createElement('input'); lock.type = 'checkbox'; lock.checked = locks[index]; lock.onchange = () => { locks[index] = lock.checked; }; label.append(lock, `Keep chord ${index + 1}`);
    card.append(keys, label); find('chords').append(card);
  });
}
function persist() { try { localStorage.setItem(storageKey, JSON.stringify(saved)); return true; } catch { status('Could not save on this browser. Copy the chords instead.'); return false; } }
function renderSaved() {
  find('saved').replaceChildren(); find('empty').hidden = saved.length > 0;
  saved.forEach((item, index) => {
    const row = document.createElement('li'), load = document.createElement('button'), remove = document.createElement('button');
    const prefix = item.style === 'greatest' ? `${greatestById(item.progression).name}: ` : '';
    load.textContent = `${prefix}${item.chords.map(chord => describe(chord, item.key).name).join(' - ')} / ${item.tempo} BPM`;
    load.onclick = () => {
      stop(); find('style').value = item.style;
      if (item.style === 'greatest') loadGreatest(greatestById(item.progression), true);
      chords = item.chords.map(chord => [...chord]); locks = chords.map(() => false);
      find('key').value = item.key; find('tempo').value = item.tempo; render(); status('Progression loaded.');
    };
    remove.textContent = 'Remove'; remove.setAttribute('aria-label', `Remove saved progression ${index + 1}`); remove.onclick = () => { saved.splice(index, 1); persist(); renderSaved(); };
    row.append(load, remove); find('saved').append(row);
  });
}
find('generate').onclick = () => {
  stop();
  if (isGreatest()) { loadGreatest(pickGreatest(progression.id)); render(); status(`${progression.name}.`); return; }
  chords = generate(find('style').value, chords, locks); render();
  status(locks.every(Boolean) ? 'All four chords are kept. Uncheck one to vary it.' : 'New progression.');
};
find('style').onchange = () => {
  stop();
  if (isGreatest()) loadGreatest(progression);
  else { chords = generate(find('style').value); locks = chords.map(() => false); }
  render();
};
find('progression').onchange = () => { stop(); loadGreatest(greatestById(find('progression').value)); render(); };
find('key').onchange = () => { stop(); render(); };
find('tempo').onchange = () => { stop(); const value = Number(find('tempo').value); find('tempo').value = String(Math.max(40, Math.min(200, Math.round(value || 90)))); };
find('bars').onchange = () => { stop(); render(); };
find('volume').oninput = () => { if (output) output.gain.value = Number(find('volume').value) / 100 * 0.3; };
find('play').onclick = async () => { if (playing) return stop(); try { await audio(); playing = true; position = 0; find('play').textContent = 'Stop loop'; find('play').setAttribute('aria-pressed', 'true'); tick(); } catch { status('Audio could not start. Try again.'); } };
find('copy').onclick = async () => {
  const label = isGreatest() ? progression.name : find('style').value;
  const text = `${find('key').value} ${label} | ${find('tempo').value} BPM | ${chords.map(chord => describe(chord, find('key').value).name).join(' - ')}`;
  try { await navigator.clipboard.writeText(text); status('Chords copied.'); } catch { status(text); }
};
find('save').onclick = () => {
  if (saved.length >= 50) return status('50 saved progressions. Remove one before saving another.');
  const item = { key: find('key').value, style: find('style').value, tempo: Number(find('tempo').value), chords: chords.map(chord => [...chord]) };
  if (isGreatest()) item.progression = progression.id;
  saved.push(item); const success = persist(); renderSaved(); if (success) status('Saved on this browser.');
};
document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
window.addEventListener('pagehide', stop);
find('export').onclick = async () => {
  stop(); const button = find('export'); button.disabled = true;
  try {
    const tempo = Math.max(40, Math.min(200, Number(find('tempo').value) || 90));
    const durations = chords.map((_, index) => beats(index) * 60 / tempo);
    const seconds = durations.reduce((total, duration) => total + duration, 0);
    const offline = new OfflineAudioContext(1, Math.ceil(seconds * 44100), 44100);
    const gain = offline.createGain(); gain.gain.value = 0.3; gain.connect(offline.destination);
    let when = 0; durations.forEach((duration, index) => { sound(index, duration * 0.9, offline, gain, when); when += duration; });
    const rendered = await offline.startRendering();
    const url = URL.createObjectURL(new Blob([encodeWav(rendered.getChannelData(0), 44100)], { type: 'audio/wav' }));
    const name = isGreatest() ? progression.id : find('style').value;
    const link = document.createElement('a'); link.href = url; link.download = `strummer-${find('key').value}-${name}-${tempo}bpm.wav`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
    status(`WAV exported: ${seconds.toFixed(1)} seconds, one cycle.`);
  } catch { status('WAV export failed. Please try again.'); } finally { button.disabled = false; }
};
const params = new URLSearchParams(location.search);
if (params.get('preset') === 'personal') { find('style').value = 'personal'; chords = generate('personal'); locks = chords.map(() => false); }
else if (greatestById(params.get('progression'))) loadGreatest(greatestById(params.get('progression')));
render(); renderSaved();
