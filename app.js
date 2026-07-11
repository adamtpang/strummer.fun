/* ============================================================
   Strummer web player — vanilla JS, Web Audio engine
   Aggregates real music from Audius (keyless, legal, decentralized).
   Playback decodes to an AudioBuffer and plays via Web Audio —
   reliable where a raw <audio> element stalls on the stream.
   Own your music. The future is unwritten.
   ============================================================ */

const AUDIUS = 'https://api.audius.co';
const APP = 'strummer';
const streamUrl = (id) => `${AUDIUS}/v1/tracks/${id}/stream?app_name=${APP}`;

/* ---------- gradient palettes (cover-art fallback) ---------- */
const PALETTES = [
  ['#dc2626', '#7f1d1d', 135], ['#f97316', '#7c2d12', 120], ['#0ea5e9', '#0c4a6e', 140],
  ['#8b5cf6', '#4c1d95', 130], ['#10b981', '#064e3b', 125], ['#eab308', '#713f12', 145],
  ['#ec4899', '#831843', 135], ['#64748b', '#1e293b', 120], ['#ef4444', '#581c87', 150],
  ['#14b8a6', '#134e4a', 128],
];
const grad = (i) => { const [a, b, ang] = PALETTES[i % PALETTES.length]; return `linear-gradient(${ang}deg, ${a}, ${b})`; };
const hashSeed = (s) => { let h = 0; for (let i = 0; i < String(s).length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- persistence (localStorage — your library survives reloads) ---------- */
const store = {
  load(key, fallback) { try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; } },
  save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} },
};
const LIKED_KEY = 'strummer.liked.v1', COLLECTED_KEY = 'strummer.collected.v1', VOL_KEY = 'strummer.volume.v1';

/* ---------- emergency fallback (only if Audius is unreachable) ---------- */
const FALLBACK = [
  { id: 'fb1', title: 'Static Bloom', artist: 'Vela', album: 'Demo', dur: 372, src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', art: null, g: 0 },
  { id: 'fb2', title: 'Paper Cathedral', artist: 'The Hollowmen', album: 'Demo', dur: 350, src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', art: null, g: 3 },
  { id: 'fb3', title: 'Midnight Latitude', artist: 'Atlas Youth', album: 'Demo', dur: 295, src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', art: null, g: 2 },
];

/* ---------- Audius API ---------- */
function mapTrack(t) {
  return {
    id: t.id,
    title: t.title || 'Untitled',
    artist: (t.user && t.user.name) || 'Unknown artist',
    album: t.genre || 'Single',
    dur: t.duration || 0,
    src: streamUrl(t.id),
    art: (t.artwork && (t.artwork['480x480'] || t.artwork['150x150'])) || null,
    g: hashSeed(t.id) % PALETTES.length,
  };
}
async function audiusTrending(limit = 30) {
  const r = await fetch(`${AUDIUS}/v1/tracks/trending?app_name=${APP}`);
  if (!r.ok) throw new Error('trending ' + r.status);
  return ((await r.json()).data || []).slice(0, limit).map(mapTrack).filter((t) => t.dur > 0);
}
async function audiusSearch(q) {
  const r = await fetch(`${AUDIUS}/v1/tracks/search?query=${encodeURIComponent(q)}&app_name=${APP}`);
  if (!r.ok) throw new Error('search ' + r.status);
  return ((await r.json()).data || []).map(mapTrack).filter((t) => t.dur > 0);
}

/* ---------- catalog state ---------- */
let TRACKS = [];
let VIEW = [];
const PLAYLISTS = [
  { name: 'Trending', sub: 'Live on Audius', glyph: '✦', g: 0, action: 'trending' },
  { name: 'Your Collection', sub: 'owned · on-chain', glyph: '◆', g: 8, action: 'collection' },
  { name: 'Liked Songs', sub: 'auto playlist', glyph: '♥', g: 6, action: 'liked' },
  { name: 'Electronic', sub: 'genre', glyph: '◇', g: 2, action: 'q:electronic' },
  { name: 'Hip-Hop', sub: 'genre', glyph: '◈', g: 5, action: 'q:hip-hop' },
];

/* ---------- icons ---------- */
const I = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
  prev: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zM20 6l-9 6 9 6z"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 6h2v12h-2zM4 6l9 6-9 6z"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5M21 3l-7 7M4 20l16-16M16 21h5v-5M21 21l-6-6M4 4l5 5"/></svg>',
  repeat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>',
  heartFill: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.18L12 21z"/></svg>',
  diamond: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M9 3l-3 6 6 12M15 3l3 6-6 12"/></svg>',
  diamondFill: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 2h12l4 6-10 13L2 8z"/></svg>',
  wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="16.5" cy="12" r="1.4" fill="currentColor"/></svg>',
  queue: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h13M3 12h13M3 18h9M19 9v9M19 18a2 2 0 1 0 0 .01"/></svg>',
  vol: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4zM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
  spotify: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.6 14.4a.6.6 0 0 1-.86.2c-2.35-1.44-5.3-1.76-8.8-.96a.62.62 0 1 1-.28-1.2c3.8-.88 7.08-.5 9.72 1.1.3.18.4.56.22.86zm1.23-2.74a.78.78 0 0 1-1.08.26c-2.7-1.66-6.8-2.14-9.98-1.18a.78.78 0 1 1-.46-1.5c3.64-1.1 8.16-.56 11.26 1.34.36.22.48.7.26 1.08zm.1-2.85C14.8 8.96 9.5 8.78 6.46 9.7a.94.94 0 1 1-.54-1.8c3.5-1.06 9.34-.85 12.98 1.3a.94.94 0 0 1-.96 1.62z"/></svg>',
};

/* ============================================================
   Web Audio engine
   ============================================================ */
let ac = null, gainNode = null;
let curBuffer = null, srcNode = null;
let startedAt = 0, pausedOffset = 0, trackDur = 0;
let rafId = null, endedGuard = false;
let volume = Math.min(1, Math.max(0, Number(store.load(VOL_KEY, 0.8)) || 0.8));

let queue = [], curIndex = -1, loadedIndex = -1, loadSeq = 0, failStreak = 0;
let isPlaying = false, shuffle = false, repeat = 0;

// Library: full track objects persisted so Liked Songs / Collection render after reload
const likedMap = new Map(Object.entries(store.load(LIKED_KEY, {})));
const collectedMap = new Map(Object.entries(store.load(COLLECTED_KEY, {})));
const liked = new Set(likedMap.keys()), collected = new Set(collectedMap.keys());

function ensureCtx() {
  if (!ac) {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    gainNode = ac.createGain();
    gainNode.gain.value = volume;
    gainNode.connect(ac.destination);
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
// The https autoplay fix: resume() must be AWAITED before srcNode.start(),
// or the context can stay suspended (state "playing", clock frozen at 0:00).
async function ensureCtxResumed() {
  ensureCtx();
  if (ac.state === 'suspended') { try { await ac.resume(); } catch (e) {} }
  return ac;
}
const position = () => isPlaying ? Math.min(trackDur, pausedOffset + (ac.currentTime - startedAt)) : pausedOffset;

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const fmt = (s) => { if (!s || isNaN(s)) return '0:00'; const m = Math.floor(s / 60), sec = Math.floor(s % 60); return `${m}:${sec.toString().padStart(2, '0')}`; };
const trackById = (id) => VIEW.find((t) => t.id === id) || queue.find((t) => t.id === id) || TRACKS.find((t) => t.id === id);
const coverStyle = (t) => `background:${grad(t.g)}`;
const coverInner = (t) => t.art
  ? `<img class="cover-img" src="${esc(t.art)}" loading="lazy" alt="" onerror="this.remove()">`
  : `<span class="glyph">${esc((t.title || '♪').trim()[0] || '♪')}</span>`;

/* ---------- transport ---------- */
async function loadTrack(i, autoplay = true) {
  if (i < 0 || i >= queue.length) return;
  curIndex = i;
  const t = queue[i];
  renderNowPlaying(t);
  refreshRows();
  stopSource();
  isPlaying = false; pausedOffset = 0; trackDur = t.dur || 0; curBuffer = null;
  $('#cur-time').textContent = '0:00';
  $('#dur-time').textContent = fmt(t.dur);
  $('#seek-fill').style.width = '0%'; $('#seek-knob').style.left = '0%';
  const seq = ++loadSeq;
  $('#play-btn').innerHTML = '<span class="spinner"></span>';
  try {
    ensureCtx();
    const resp = await fetch(t.src);
    if (seq !== loadSeq) return;
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const arr = await resp.arrayBuffer();
    if (seq !== loadSeq) return;
    const buffer = await ac.decodeAudioData(arr.slice(0));
    if (seq !== loadSeq) return;
    curBuffer = buffer; trackDur = buffer.duration; loadedIndex = i;
    $('#dur-time').textContent = fmt(trackDur);
    if (autoplay) startPlayback(0); else updatePlayBtn();
  } catch (e) {
    if (seq !== loadSeq) return;
    updatePlayBtn();
    if (++failStreak > 5) { toast('Too many unavailable tracks — paused'); return; }
    toast('Track unavailable — skipping'); next(true);
  }
}

let playSeq = 0;
async function startPlayback(offset) {
  if (!curBuffer) return;
  const seq = ++playSeq;
  const buffer = curBuffer;
  await ensureCtxResumed();
  if (seq !== playSeq || buffer !== curBuffer) return; // superseded while resuming
  stopSource();
  srcNode = ac.createBufferSource();
  srcNode.buffer = buffer;
  srcNode.connect(gainNode);
  srcNode.onended = onSrcEnded;
  endedGuard = false;
  startedAt = ac.currentTime;
  pausedOffset = Math.max(0, Math.min(offset, Math.max(0, trackDur - 0.05)));
  srcNode.start(0, pausedOffset);
  isPlaying = true; failStreak = 0;
  updatePlayBtn(); refreshRows(); startProgress();
  anchorPlay(); mediaSessionState();
}
function stopSource() {
  if (srcNode) {
    endedGuard = true;
    try { srcNode.onended = null; srcNode.stop(); } catch (e) {}
    try { srcNode.disconnect(); } catch (e) {}
    srcNode = null;
  }
  stopProgress();
}
function onSrcEnded() { if (endedGuard) { endedGuard = false; return; } isPlaying = false; next(true); }

function play() {
  if (curIndex === -1) { if (queue.length) loadTrack(0, true); return; }
  if (loadedIndex !== curIndex || !curBuffer) { loadTrack(curIndex, true); return; }
  startPlayback(pausedOffset >= trackDur ? 0 : pausedOffset);
}
function pause() {
  if (!isPlaying) return;
  pausedOffset = position();
  isPlaying = false;
  stopSource();
  updatePlayBtn(); refreshRows();
  anchorPause(); mediaSessionState();
}
function togglePlay() {
  if (curIndex === -1) { if (queue.length) loadTrack(0, true); return; }
  if (loadedIndex !== curIndex || !curBuffer) { loadTrack(curIndex, true); return; }
  isPlaying ? pause() : play();
}
function next(auto = false) {
  if (repeat === 2 && auto && curBuffer) { startPlayback(0); return; }
  let i = curIndex + 1;
  if (shuffle) i = Math.floor(Math.random() * queue.length);
  if (i >= queue.length) {
    if (repeat === 1 || !auto) i = 0;
    else { stopSource(); isPlaying = false; pausedOffset = 0; updatePlayBtn(); refreshRows(); anchorPause(); mediaSessionState(); return; }
  }
  loadTrack(i, true);
}
function prev() {
  if (position() > 3 && curBuffer) { startPlayback(0); return; }
  loadTrack(curIndex <= 0 ? queue.length - 1 : curIndex - 1, true);
}
function playFromList(id, list) {
  if (loadedIndex !== -1 && queue[curIndex] && queue[curIndex].id === id) { togglePlay(); return; }
  queue = list.slice();
  const idx = queue.findIndex((t) => t.id === id);
  loadTrack(idx === -1 ? 0 : idx, true);
}

/* ---------- progress loop ---------- */
function startProgress() { stopProgress(); const tick = () => { updateProgress(); rafId = requestAnimationFrame(tick); }; rafId = requestAnimationFrame(tick); }
function stopProgress() { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }
function updateProgress() {
  const pos = position();
  const pct = trackDur ? (pos / trackDur) * 100 : 0;
  $('#seek-fill').style.width = pct + '%';
  $('#seek-knob').style.left = pct + '%';
  $('#cur-time').textContent = fmt(pos);
}
function updatePlayBtn() { $('#play-btn').innerHTML = isPlaying ? I.pause : I.play; }

/* ============================================================
   Render
   ============================================================ */
function renderSidebarPlaylists() {
  $('#playlists').innerHTML = PLAYLISTS.map((p) => `
    <div class="pl-item" data-action="${esc(p.action || '')}">
      <div class="pl-cover" style="background:${grad(p.g)}">${p.glyph}</div>
      <div class="pl-meta"><div class="pl-name">${esc(p.name)}</div><div class="pl-sub">${esc(p.sub)}</div></div>
    </div>`).join('');
  $('#playlists').addEventListener('click', (e) => {
    const item = e.target.closest('[data-action]'); if (!item) return;
    const a = item.dataset.action;
    if (a === 'trending') { $('#search-input').value = ''; renderHome(); }
    else if (a === 'liked') renderLibrary('Liked Songs', 'liked · yours', likedMap, 'Nothing liked yet — tap the ♥ on any track and it lives here, across reloads.');
    else if (a === 'collection') renderLibrary('Your Collection', 'owned · on-chain', collectedMap, 'Collect a track to start your on-chain collection ◆ — collecting ships in v1.');
    else if (a.startsWith('q:')) { $('#search-input').value = a.slice(2); doSearch(a.slice(2)); }
    else toast('Coming soon');
  });
}

function trackRow(t, i) {
  const playing = queue[curIndex] && queue[curIndex].id === t.id;
  return `
    <div class="track ${playing && isPlaying ? 'playing' : ''}" data-id="${esc(t.id)}">
      <div class="t-idx">
        ${playing && isPlaying ? '<span class="eq"><span></span><span></span><span></span></span>'
          : `<span class="num">${i + 1}</span><span class="play-ic">${I.play}</span>`}
      </div>
      <div class="t-main">
        <div class="t-art" style="${coverStyle(t)}">${coverInner(t)}</div>
        <div class="t-text">
          <div class="t-title">${esc(t.title)}</div>
          <div class="t-artist" data-artist="${esc(t.artist)}">${esc(t.artist)}</div>
        </div>
      </div>
      <div class="t-album">${esc(t.album)}</div>
      <div class="t-dur">${fmt(t.dur)}</div>
      <div class="t-actions">
        <button class="collect-btn" data-collect="${esc(t.id)}">
          ${collected.has(t.id) ? I.diamondFill : I.diamond}${collected.has(t.id) ? 'Owned' : 'Collect'}
        </button>
      </div>
    </div>`;
}
function listSection(title, sub, tracks, id = 'track-rows') {
  return `
    <section class="section">
      <div class="section-head"><h2 class="section-title">${esc(title)}</h2><a class="section-link">${esc(sub)}</a></div>
      <div class="tracklist">
        <div class="tl-head"><div>#</div><div>Title</div><div class="h-album">Genre</div><div class="h-dur" style="text-align:right">Time</div><div></div></div>
        <div id="${id}">${tracks.map((t, i) => trackRow(t, i)).join('')}</div>
      </div>
    </section>`;
}

function renderHome() {
  VIEW = TRACKS;
  const featured = TRACKS.slice(0, 6);
  $('#content').innerHTML = `
    <section class="hero">
      <div class="hero-eyebrow">◆ own your music · not your platform's</div>
      <h1>The streaming player where artists keep what they earn.</h1>
      <p>Real music, aggregated from open networks — every play pays the artist directly. Your library, your taste, your identity: portable across any client, owned by you. No 30% tax. No lock-in. The future is unwritten.</p>
      <div class="hero-cta">
        <button class="btn-primary" id="hero-play">${I.play} Play trending</button>
        <button class="btn-ghost" id="hero-import">${I.spotify} Import from Spotify</button>
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h2 class="section-title">Featured</h2><a class="section-link">live on audius</a></div>
      <div class="cards">
        ${featured.map((t) => `
          <div class="card" data-card="${esc(t.id)}">
            <div class="card-art" style="${coverStyle(t)}">
              ${coverInner(t)}
              <button class="card-play" data-card-play="${esc(t.id)}">${I.play}</button>
            </div>
            <div class="card-title">${esc(t.title)}</div>
            <div class="card-sub">${esc(t.artist)}</div>
          </div>`).join('')}
      </div>
    </section>

    ${listSection('Trending on Audius', `${TRACKS.length} tracks · decentralized`, TRACKS)}

    <section class="own-strip">
      <div class="os-text">
        <h3>Read. Write. Own.</h3>
        <p>Web1 let you read. Web2 let you write — but the platform kept the network, the data, and the money. Strummer is the third era for music: aggregate from open networks, artists own their masters, and your collection belongs to you.</p>
      </div>
      <div class="os-badges">
        <div class="os-badge"><span class="dot"></span> Direct artist payments</div>
        <div class="os-badge"><span class="dot"></span> Portable identity</div>
        <div class="os-badge"><span class="dot"></span> Open protocol</div>
      </div>
    </section>`;
  wireHome();
}

/* ---------- now-playing ---------- */
function renderNowPlaying(t) {
  $('#np').innerHTML = `
    <div class="np-art" style="${coverStyle(t)}">${coverInner(t)}</div>
    <div class="np-text">
      <div class="np-title">${esc(t.title)}</div>
      <div class="np-artist">
        <span data-artist="${esc(t.artist)}">${esc(t.artist)}</span>
        · <a class="np-supports" data-collect="${esc(t.id)}">supports ${esc(t.artist)}</a>
        <span class="src-tag">Audius</span>
      </div>
    </div>
    <button class="np-like ${liked.has(t.id) ? 'liked' : ''}" id="np-like" title="Like">${liked.has(t.id) ? I.heartFill : I.heart}</button>`;
  mediaSessionMeta(t);
  $('#np-like').onclick = () => toggleLike(t.id);
  const sup = $('.np-supports', $('#np')); if (sup) sup.onclick = () => collect(t.id);
  const art = $('[data-artist]', $('#np')); if (art) art.onclick = () => toast(`${t.artist} · artist page coming soon`);
}
function refreshRows() {
  $$('.track').forEach((row) => {
    const id = row.dataset.id;
    const isCur = queue[curIndex] && queue[curIndex].id === id;
    row.classList.toggle('playing', isCur && isPlaying);
    const idx = VIEW.findIndex((x) => x.id === id);
    $('.t-idx', row).innerHTML = (isCur && isPlaying)
      ? '<span class="eq"><span></span><span></span><span></span></span>'
      : `<span class="num">${idx + 1}</span><span class="play-ic">${I.play}</span>`;
  });
}

/* ---------- like / collect ---------- */
function toggleLike(id) {
  if (liked.has(id)) {
    liked.delete(id); likedMap.delete(id);
  } else {
    const t = trackById(id);
    if (!t) return;
    liked.add(id); likedMap.set(id, t);
  }
  store.save(LIKED_KEY, Object.fromEntries(likedMap));
  const cur = queue[curIndex]; if (cur && cur.id === id) renderNowPlaying(cur);
  toast(liked.has(id) ? 'Added to Liked Songs' : 'Removed from Liked Songs');
}
function collect(id) {
  if (collected.has(id)) { toast('You already own this track ◆'); return; }
  openCollect(trackById(id));
}

/* ============================================================
   Modals + toast
   ============================================================ */
function openWallet() {
  $('#modal-body').innerHTML = `
    <button class="modal-close" id="modal-x">${I.close}</button>
    <div class="m-glyph">◆</div>
    <h2>Own your music identity</h2>
    <p>Connect a wallet to make your library, playlists, and taste graph <b>yours</b> — portable across any Strummer client, owned by you, not rented from a platform.</p>
    <ul>
      <li><span class="ic">${I.check}</span><span><b>Collect songs</b> on-chain — directly funding the artists you love.</span></li>
      <li><span class="ic">${I.check}</span><span><b>Carry your identity</b> between apps. Your graph isn't trapped in one company.</span></li>
      <li><span class="ic">${I.check}</span><span><b>Artists keep the upside</b> — no 30% tax, no fractional-cent streams.</span></li>
    </ul>
    <div class="modal-cta"><button class="btn-primary" id="wallet-soon">${I.wallet} Connect wallet</button></div>
    <div class="modal-note">Wallet support ships in v1 · this is the vision</div>`;
  openModal(); $('#modal-x').onclick = closeModal;
  $('#wallet-soon').onclick = () => { closeModal(); toast('Wallet connect ships in v1 — stay tuned'); };
}
function openCollect(t) {
  if (!t) return;
  $('#modal-body').innerHTML = `
    <button class="modal-close" id="modal-x">${I.close}</button>
    <div class="m-glyph">◆</div>
    <h2>Collect "${esc(t.title)}"</h2>
    <p>Own a piece of this track by <b>${esc(t.artist)}</b>. Collecting pays the artist directly and adds it to your portable, on-chain collection.</p>
    <ul>
      <li><span class="ic">${I.diamondFill}</span><span><b>${esc(t.artist)}</b> receives the proceeds — directly, no middleman.</span></li>
      <li><span class="ic">${I.check}</span><span>Lives in <b>Your Collection</b>, portable across any client.</span></li>
    </ul>
    <div class="modal-cta"><button class="btn-primary" id="collect-go">${I.diamond} Collect — connect wallet</button></div>
    <div class="modal-note">Collecting ships in v1 · this is the vision</div>`;
  openModal(); $('#modal-x').onclick = closeModal;
  $('#collect-go').onclick = () => { closeModal(); openWallet(); };
}
function openImport() {
  $('#modal-body').innerHTML = `
    <button class="modal-close" id="modal-x">${I.close}</button>
    <div class="m-glyph" style="color:#1DB954">${I.spotify}</div>
    <h2>Import from Spotify</h2>
    <p>Bring your library, playlists, and listening history into Strummer in one click — then own it for good. Same idea as Helium importing your Chrome profile: lower the switching cost to zero.</p>
    <ul>
      <li><span class="ic">${I.check}</span><span>Playlists, liked songs, and top artists.</span></li>
      <li><span class="ic">${I.check}</span><span>Your taste graph becomes <b>yours</b> — not Spotify's.</span></li>
    </ul>
    <div class="modal-cta"><button class="btn-primary" id="import-go">${I.spotify} Connect Spotify</button></div>
    <div class="modal-note">Spotify import ships in v2 · this is the wedge</div>`;
  openModal(); $('#modal-x').onclick = closeModal;
  $('#import-go').onclick = () => { closeModal(); toast('Spotify import is the v2 wedge — coming soon'); };
}
function openModal() { $('#modal-scrim').classList.add('open'); }
function closeModal() { $('#modal-scrim').classList.remove('open'); }

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.innerHTML = `<span class="t-ic">${I.diamond}</span> ${esc(msg)}`;
  el.classList.add('show'); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

/* ---------- library views (liked / collection, persisted) ---------- */
function renderLibrary(title, sub, map, emptyMsg) {
  VIEW = [...map.values()];
  $('#search-input').value = '';
  $('#content').innerHTML = VIEW.length
    ? listSection(title, `${VIEW.length} ${sub}`, VIEW)
    : `<section class="section" style="margin-top:18px">
        <div class="section-head"><h2 class="section-title">${esc(title)}</h2></div>
        <div class="loading-row">${esc(emptyMsg)}</div>
      </section>`;
  if (VIEW.length) wireHome();
}

/* ============================================================
   OS media keys / lock screen (Media Session API)
   Chromium only activates a media session for a real <audio>
   element — a bare AudioContext is invisible to media keys/SMTC.
   A silent looping anchor element mirrors the engine's state.
   ============================================================ */
let msAnchor = null;
function silentWavUrl(seconds = 10) {
  const rate = 8000, n = rate * seconds;
  const buf = new ArrayBuffer(44 + n); // 8-bit PCM mono, all-silence
  const v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVEfmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate, true);
  v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  w(36, 'data'); v.setUint32(40, n, true);
  new Uint8Array(buf, 44).fill(128); // 8-bit PCM silence midpoint
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}
function anchorPlay() {
  if (!('mediaSession' in navigator)) return;
  if (!msAnchor) { msAnchor = new Audio(silentWavUrl()); msAnchor.loop = true; }
  msAnchor.play().catch(() => {});
}
function anchorPause() { if (msAnchor) msAnchor.pause(); }

function mediaSessionMeta(t) {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: t.title,
      artist: t.artist,
      album: t.album,
      artwork: t.art ? [{ src: t.art, sizes: '480x480', type: 'image/jpeg' }] : [],
    });
  } catch (e) {}
}
function mediaSessionState() {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    if (trackDur > 0 && isFinite(trackDur)) {
      navigator.mediaSession.setPositionState({
        duration: trackDur,
        playbackRate: 1,
        position: Math.min(trackDur, position()),
      });
    }
  } catch (e) {}
}
function wireMediaSession() {
  if (!('mediaSession' in navigator)) return;
  const on = (action, fn) => { try { navigator.mediaSession.setActionHandler(action, fn); } catch (e) {} };
  on('play', play);
  on('pause', pause);
  on('previoustrack', prev);
  on('nexttrack', () => next(false));
  on('seekto', (d) => {
    if (!trackDur || d.seekTime == null) return;
    if (isPlaying) startPlayback(d.seekTime);
    else { pausedOffset = Math.min(d.seekTime, trackDur); updateProgress(); mediaSessionState(); }
  });
}

/* ============================================================
   Search (Audius)
   ============================================================ */
let searchSeq = 0, searchTimer;
async function doSearch(q) {
  const seq = ++searchSeq;
  $('#content').innerHTML = `
    <section class="section" style="margin-top:18px">
      <div class="section-head"><h2 class="section-title">Searching “${esc(q)}”…</h2></div>
      <div class="tracklist"><div class="loading-row"><span class="spinner"></span> querying audius…</div></div>
    </section>`;
  try {
    const results = await audiusSearch(q);
    if (seq !== searchSeq) return;
    VIEW = results;
    $('#content').innerHTML = results.length
      ? listSection(`Results for “${q}”`, `${results.length} on audius`, results)
      : `<section class="section" style="margin-top:18px"><div class="section-head"><h2 class="section-title">No results for “${esc(q)}”</h2></div><div class="loading-row">Try an artist on Audius — “ODESZA”, “RAC”, “deadmau5”, or a genre like “lofi”.</div></section>`;
    if (results.length) wireHome();
  } catch (e) {
    if (seq !== searchSeq) return;
    $('#content').innerHTML = `<section class="section" style="margin-top:18px"><div class="loading-row">Search failed — ${esc(e.message)}. Try again.</div></section>`;
  }
}

/* ============================================================
   Event wiring
   ============================================================ */
function wireHome() {
  const rows = $('#track-rows');
  if (rows) rows.addEventListener('click', (e) => {
    const cb = e.target.closest('[data-collect]'); if (cb) { e.stopPropagation(); collect(cb.dataset.collect); return; }
    const ar = e.target.closest('[data-artist]'); if (ar) { e.stopPropagation(); toast(`${ar.dataset.artist} · artist page coming soon`); return; }
    const row = e.target.closest('.track'); if (row) playFromList(row.dataset.id, VIEW);
  });
  $$('[data-card-play]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); playFromList(b.dataset.cardPlay, VIEW); }));
  $$('.card').forEach((c) => c.addEventListener('click', () => playFromList(c.dataset.card, VIEW)));
  const hp = $('#hero-play'); if (hp) hp.onclick = () => { if (TRACKS.length) playFromList(TRACKS[0].id, TRACKS); };
  const hi = $('#hero-import'); if (hi) hi.onclick = openImport;
}

function wireChrome() {
  $('#play-btn').onclick = togglePlay;
  $('#next-btn').onclick = () => next(false);
  $('#prev-btn').onclick = prev;
  $('#shuffle-btn').onclick = () => { shuffle = !shuffle; $('#shuffle-btn').classList.toggle('active', shuffle); toast(shuffle ? 'Shuffle on' : 'Shuffle off'); };
  $('#repeat-btn').onclick = () => { repeat = (repeat + 1) % 3; $('#repeat-btn').classList.toggle('active', repeat > 0); toast(['Repeat off', 'Repeat all', 'Repeat one'][repeat]); };
  $('#connect-btn').onclick = openWallet;
  $('#queue-btn').onclick = () => toast('Queue view coming soon');
  $('#modal-scrim').onclick = (e) => { if (e.target.id === 'modal-scrim') closeModal(); };

  $$('.nav-item').forEach((n) => n.onclick = () => {
    $$('.nav-item').forEach((x) => x.classList.remove('active'));
    n.classList.add('active');
    if (n.dataset.nav === 'home') { $('#search-input').value = ''; renderHome(); }
    else if (n.dataset.nav === 'Search') $('#search-input').focus();
    else toast(`${n.dataset.nav} · coming soon`);
  });
  $('.brand').onclick = () => $('#main').scrollTo({ top: 0, behavior: 'smooth' });

  $('#search-input').addEventListener('input', (e) => {
    const q = e.target.value.trim();
    clearTimeout(searchTimer);
    if (!q) { searchSeq++; renderHome(); return; }
    searchTimer = setTimeout(() => doSearch(q), 320);
  });

  // scrubber (seek)
  const bar = $('#seek');
  const seek = (e) => {
    if (!trackDur) return;
    const r = bar.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const to = pct * trackDur;
    if (isPlaying) startPlayback(to);
    else { pausedOffset = to; updateProgress(); }
  };
  let seeking = false;
  bar.addEventListener('mousedown', (e) => { seeking = true; seek(e); });
  window.addEventListener('mousemove', (e) => seeking && seek(e));
  window.addEventListener('mouseup', () => seeking = false);

  // volume
  const vb = $('#vol');
  const setVol = (e) => {
    const r = vb.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    volume = pct; if (gainNode) gainNode.gain.value = pct;
    $('#vol-fill').style.width = `${pct * 100}%`;
    store.save(VOL_KEY, volume);
  };
  let volDrag = false;
  vb.addEventListener('mousedown', (e) => { volDrag = true; setVol(e); });
  window.addEventListener('mousemove', (e) => volDrag && setVol(e));
  window.addEventListener('mouseup', () => volDrag = false);

  $('#main').addEventListener('scroll', (e) => { $('#topbar').classList.toggle('scrolled', e.target.scrollTop > 8); });

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    if (e.code === 'ArrowRight') next(false);
    if (e.code === 'ArrowLeft') prev();
  });
}

/* ============================================================
   Boot
   ============================================================ */
async function boot() {
  const setIcon = (id, name) => { const el = $('#' + id); if (el) el.innerHTML = I[name]; };
  setIcon('shuffle-btn', 'shuffle'); setIcon('prev-btn', 'prev'); setIcon('play-btn', 'play');
  setIcon('next-btn', 'next'); setIcon('repeat-btn', 'repeat'); setIcon('queue-btn', 'queue'); setIcon('vol-ic', 'vol');

  renderSidebarPlaylists();
  wireChrome();
  wireMediaSession();
  $('#vol-fill').style.width = `${volume * 100}%`;

  // Unlock the AudioContext on the first genuine user gesture (capture phase,
  // before any button handler) so autoplay policy lets playback start.
  const unlock = () => { try { ensureCtx(); } catch (e) {} };
  document.addEventListener('pointerdown', unlock, true);
  document.addEventListener('keydown', unlock, true);

  $('#content').innerHTML = `<div class="loading-row" style="margin-top:40px"><span class="spinner"></span> loading real tracks from audius…</div>`;

  try {
    TRACKS = await audiusTrending(30);
    if (!TRACKS.length) throw new Error('empty');
  } catch (e) {
    TRACKS = FALLBACK.slice();
    toast('Audius unreachable — showing demo tracks');
  }

  renderHome();

  // prime now-playing UI with the top track (nothing decoded until play)
  queue = TRACKS.slice(); curIndex = 0; loadedIndex = -1;
  const t = TRACKS[0];
  if (t) { renderNowPlaying(t); $('#cur-time').textContent = '0:00'; $('#dur-time').textContent = fmt(t.dur); }
}
document.addEventListener('DOMContentLoaded', boot);
