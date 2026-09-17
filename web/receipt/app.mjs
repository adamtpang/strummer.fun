import { searchUrl, artistSearchUrl, discographyUrl, artistNamedIn, lookupUrl, rankAlbums, buildReceipt, receiptLines, barcode, bestTrackUrl, matchTrack, CTA, LINK, STAR, ALL_TIME, topAlbumsReceipt } from './receipt.mjs';

const find = (id) => document.getElementById(id);
const WIDTH = 1080;
const PAD = 84;
const FONT_SIZE = 30;
const LINE = 44;
const ART = 260;
const PAPER = '#f6f3ea';
const INK = '#1b1b1b';
const STORY_W = 1080;
const STORY_H = 1920;
const STORY_BG = '#111213';
const STORY_ACCENT = '#c8323e';
let current = null;
let openToken = 0;
let searchToken = 0;

const status = (message) => { find('status').textContent = message; };

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Apple Music returned ${response.status}.`);
  return response.json();
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

async function search(term) {
  const token = ++searchToken;
  status('Searching…');
  find('results').replaceChildren();
  try {
    const [albumHits, artistHits] = await Promise.all([
      getJson(searchUrl(term)).then((data) => data.results).catch(() => []),
      getJson(artistSearchUrl(term)).then((data) => data.results).catch(() => []),
    ]);
    // Artist search misses when the query also names an album, but the album
    // hits still carry the artist's id, so look in both.
    const artist = artistNamedIn([...artistHits, ...albumHits], term);
    const discography = artist ? await getJson(discographyUrl(artist.artistId)).then((data) => data.results).catch(() => []) : [];
    const albums = rankAlbums([...albumHits, ...discography], term);
    if (token !== searchToken) return;
    if (!albums.length) { status(`No albums found for "${term}".`); return; }
    status(`${albums.length} album${albums.length === 1 ? '' : 's'}. Pick one.`);
    find('results').replaceChildren(...albums.slice(0, 12).map((album) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      const art = document.createElement('img');
      art.src = album.artworkUrl100 || ''; art.alt = ''; art.width = 56; art.height = 56; art.loading = 'lazy';
      const text = document.createElement('span');
      const name = document.createElement('strong'); name.textContent = album.collectionName;
      const meta = document.createElement('small');
      meta.textContent = [album.artistName, album.releaseDate?.slice(0, 4), album.trackCount && `${album.trackCount} tracks`].filter(Boolean).join(' · ');
      text.append(name, meta);
      button.append(art, text);
      button.onclick = () => open(album.collectionId);
      item.append(button);
      return item;
    }));
  } catch (error) {
    if (token === searchToken) status(`Search failed. ${error.message}`);
  }
}

async function present(receipt, token) {
  current = receipt;
  await draw(current);
  find('output').hidden = false;
  find('listen').href = current.link || 'https://music.apple.com';
  find('listen').textContent = current.listens ? 'Open on Last.fm' : 'Listen on Apple Music';
  find('listen').hidden = !current.link;
  if (!current.listens) findBestTrack(current, token);
  find('output').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function tile(item, onPick, index) {
  const li = document.createElement('li');
  const button = document.createElement('button');
  button.type = 'button';
  let art;
  if (item.artwork) {
    art = document.createElement('img');
    art.src = item.artwork.replace(/\/\d+x\d+bb\./, '/300x300bb.');
    art.alt = ''; art.loading = 'lazy'; art.width = 150; art.height = 150;
  } else {
    art = document.createElement('span');
    art.className = 'rank';
    art.textContent = String(index + 1);
  }
  const name = document.createElement('strong'); name.textContent = item.name;
  const artist = document.createElement('small'); artist.textContent = item.plays ? `${item.artist} \u00b7 ${item.plays} plays` : item.artist;
  button.append(art, name, artist);
  button.setAttribute('aria-label', `${item.name} by ${item.artist}`);
  button.onclick = () => onPick(item);
  li.append(button);
  return li;
}

// Albums from Last.fm carry names, not Apple ids, so find the Apple release
// the same way a typed search would.
async function openByName(name, artist) {
  status(`Finding ${name}…`);
  const term = `${artist} ${name}`;
  try {
    const [hits, artists] = await Promise.all([
      getJson(searchUrl(term)).then((data) => data.results).catch(() => []),
      getJson(artistSearchUrl(artist)).then((data) => data.results).catch(() => []),
    ]);
    const named = artistNamedIn([...artists, ...hits], term);
    const disc = named ? await getJson(discographyUrl(named.artistId)).then((data) => data.results).catch(() => []) : [];
    const best = rankAlbums([...hits, ...disc], term)[0];
    if (!best) { status(`Apple Music has no match for ${name}.`); return; }
    open(best.collectionId);
  } catch (error) {
    status(error.message);
  }
}

async function loadShelves() {
  const pickApple = (item) => open(item.id);
  find('alltime').replaceChildren(...ALL_TIME.map((album, index) => tile(album, pickApple, index)));
  const allTime = getJson(lookupUrl(ALL_TIME.map((album) => album.id).join(',')).split('&')[0])
    .then((data) => {
      const art = new Map(data.results.map((item) => [String(item.collectionId), item.artworkUrl100]));
      find('alltime').replaceChildren(...ALL_TIME.map((album, index) => tile({ ...album, artwork: art.get(album.id) || '' }, pickApple, index)));
    })
    .catch(() => { /* numbered tiles are a fine fallback */ });
  const trending = getJson('/api/receipt/charts')
    .then(({ albums }) => find('trending').replaceChildren(...albums.map((album, index) => tile(album, pickApple, index))))
    .catch(() => { find('trending').closest('.shelf').hidden = true; });
  const pairing = fetch('/api/receipt/lastfm?probe=1')
    .then((response) => { find('mine').hidden = !response.ok; })
    .catch(() => { find('mine').hidden = true; });
  await Promise.all([allTime, trending, pairing]);
}

async function pairLastfm(user, period) {
  const token = ++openToken;
  status('Reading your Last.fm…');
  find('mine-list').replaceChildren();
  const response = await fetch(`/api/receipt/lastfm?${new URLSearchParams({ user, period })}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) { status(body.error || 'Last.fm did not answer. Try again.'); return; }
  if (token !== openToken) return;
  try {
    await present(topAlbumsReceipt(user, period, body.albums), token);
    status(`Your top ${Math.min(10, body.albums.length)} albums, ${find('lfm-period').selectedOptions[0].textContent.toLowerCase()}. Tap one below for its own receipt.`);
    find('mine-list').replaceChildren(...body.albums.map((album, index) => tile(album, (item) => openByName(item.name, item.artist), index)));
    try { localStorage.setItem('strummer.lastfm.user', user); } catch { /* optional */ }
  } catch (error) {
    status(error.message);
  }
}

async function open(id) {
  const token = ++openToken;
  status('Printing your receipt…');
  find('hints').hidden = true;
  try {
    await present(buildReceipt((await getJson(lookupUrl(id))).results), token);
    const url = new URL(location.href);
    url.searchParams.set('id', current.id);
    url.searchParams.delete('q');
    history.replaceState(null, '', url);
    status(`${current.album} by ${current.artist}. ${current.count} items, ${current.total}.`);
  } catch (error) {
    status(error.message);
  }
}

// Most-played track, from Deezer's public ranks via our own endpoint. The
// receipt is already on screen; this only adds a star when it resolves, and
// silently leaves the receipt alone if the lookup fails.
async function findBestTrack(receipt, token) {
  try {
    const { title } = await getJson(bestTrackUrl(receipt.artist, receipt.album));
    if (token !== openToken || !title) return;
    const index = matchTrack(receipt.items, title);
    if (index < 0) return;
    receipt.best = index;
    await draw(receipt);
    status(`${receipt.album} by ${receipt.artist}. ${receipt.count} items, ${receipt.total}. ${STAR} ${receipt.items[index].title}`);
  } catch {
    /* no star is a fine outcome */
  }
}

async function draw(receipt) {
  await document.fonts.load(`${FONT_SIZE}px "JetBrains Mono"`);
  await document.fonts.load(`700 ${FONT_SIZE}px "JetBrains Mono"`);
  const canvas = find('receipt');
  const context = canvas.getContext('2d');
  context.font = `${FONT_SIZE}px "JetBrains Mono", ui-monospace, monospace`;
  const cols = Math.floor((WIDTH - PAD * 2) / context.measureText('M').width);
  const lines = receiptLines(receipt, cols);
  const art = await loadImage(receipt.artwork);
  const top = PAD + (art ? ART + 48 : 0);
  const bars = 120;
  const height = top + lines.length * LINE + 40 + bars + 36 + LINE * 2 + PAD;

  canvas.width = WIDTH;
  canvas.height = height;
  canvas.setAttribute('aria-label', `Receipt for ${receipt.album} by ${receipt.artist}: ${receipt.count} tracks, total ${receipt.total}.`);

  context.fillStyle = PAPER;
  context.fillRect(0, 0, WIDTH, height);
  context.fillStyle = 'rgba(0,0,0,0.035)';
  for (let x = 0; x < WIDTH; x += 36) context.fillRect(x, 0, 1, height);

  if (art) {
    const x = (WIDTH - ART) / 2;
    context.save();
    context.filter = 'grayscale(1) contrast(1.15)';
    context.drawImage(art, x, PAD, ART, ART);
    context.restore();
  }

  context.fillStyle = INK;
  context.textBaseline = 'top';
  // The mono font has no star glyph, and a fallback font draws it wider than
  // one cell, which would push the time column out of line. Draw the row with
  // a space in the star's cell, then paint the star centred in that cell.
  context.font = `400 ${FONT_SIZE}px "JetBrains Mono", ui-monospace, monospace`;
  const cell = context.measureText('M').width;
  lines.forEach((line, index) => {
    const bold = index < 2 || line.startsWith('TOTAL');
    context.font = `${bold ? 700 : 400} ${FONT_SIZE}px "JetBrains Mono", ui-monospace, monospace`;
    const chars = [...line];
    const y = top + index * LINE;
    context.fillText(chars.map((char) => (char === STAR ? ' ' : char)).join(''), PAD, y);
    chars.forEach((char, column) => {
      if (char !== STAR) return;
      context.save();
      context.textAlign = 'center';
      context.fillText(STAR, PAD + column * cell + cell / 2, y);
      context.restore();
    });
  });

  let y = top + lines.length * LINE + 40;
  const widths = barcode(receipt.id);
  const unit = (WIDTH - PAD * 2) / widths.reduce((sum, width) => sum + width + 1.5, 0);
  let x = PAD;
  widths.forEach((width, index) => {
    if (index % 2 === 0) context.fillRect(x, y, width * unit, bars);
    x += (width + 1.5) * unit;
  });
  y += bars + 36;
  context.font = `400 ${FONT_SIZE - 6}px "JetBrains Mono", ui-monospace, monospace`;
  context.textAlign = 'center';
  context.fillText(String(receipt.id), WIDTH / 2, y);
  context.font = `700 ${FONT_SIZE - 4}px "JetBrains Mono", ui-monospace, monospace`;
  context.fillText(CTA, WIDTH / 2, y + LINE);
  context.textAlign = 'left';

  const edge = 14;
  context.save();
  context.globalCompositeOperation = 'destination-out';
  for (const baseline of [0, height]) {
    const tip = baseline === 0 ? edge : height - edge;
    for (let px = 0; px < WIDTH; px += edge * 2) {
      context.beginPath(); context.moveTo(px, baseline); context.lineTo(px + edge, tip); context.lineTo(px + edge * 2, baseline); context.fill();
    }
  }
  context.restore();
}

function blob() {
  return new Promise((resolve) => find('receipt').toBlob(resolve, 'image/png'));
}

function fileName() {
  return `receipt-${current.artist}-${current.album}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) + '.png';
}

find('search').onsubmit = (event) => {
  event.preventDefault();
  const term = find('term').value.trim();
  if (term.length >= 2) search(term);
};

find('download').onclick = async () => {
  if (!current) return;
  const url = URL.createObjectURL(await blob());
  const link = document.createElement('a');
  link.href = url; link.download = fileName(); link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  status('Receipt downloaded.');
};

// A 9:16 story: the receipt centred, a short header, and a red CTA band at
// the bottom that leaves clear space for Instagram's link sticker.
function storyCanvas() {
  const receipt = find('receipt');
  const story = document.createElement('canvas');
  story.width = STORY_W;
  story.height = STORY_H;
  const context = story.getContext('2d');
  context.fillStyle = STORY_BG;
  context.fillRect(0, 0, STORY_W, STORY_H);

  context.fillStyle = '#f0f0ea';
  context.textAlign = 'center';
  context.textBaseline = 'top';
  context.font = '700 34px "JetBrains Mono", ui-monospace, monospace';
  context.fillText('MY ALBUM RECEIPT', STORY_W / 2, 96);

  const top = 170;
  const bottomBand = 300;
  const boxW = 860;
  const boxH = STORY_H - top - bottomBand - 40;
  const scale = Math.min(boxW / receipt.width, boxH / receipt.height);
  const w = Math.round(receipt.width * scale);
  const h = Math.round(receipt.height * scale);
  context.save();
  context.shadowColor = 'rgba(0,0,0,0.55)';
  context.shadowBlur = 40;
  context.shadowOffsetY = 18;
  context.drawImage(receipt, (STORY_W - w) / 2, top, w, h);
  context.restore();

  const bandY = STORY_H - bottomBand;
  context.fillStyle = STORY_ACCENT;
  context.fillRect(0, bandY, STORY_W, bottomBand);
  context.fillStyle = '#ffffff';
  context.font = '700 58px "JetBrains Mono", ui-monospace, monospace';
  context.fillText('MAKE YOURS FREE', STORY_W / 2, bandY + 70);
  context.font = '400 44px "JetBrains Mono", ui-monospace, monospace';
  context.fillText(LINK, STORY_W / 2, bandY + 150);
  return story;
}

const canShareFiles = () => {
  try { return !!navigator.canShare?.({ files: [new File([''], 'x.png', { type: 'image/png' })] }); } catch { return false; }
};
if (!canShareFiles()) find('story').textContent = 'Download story';

function showHints() {
  const best = current && current.best >= 0 ? current.items[current.best].title : '';
  find('best-name').textContent = best;
  find('hint-music').hidden = !best;
  find('hints').hidden = false;
}

async function copy(text, done) {
  try { await navigator.clipboard.writeText(text); status(done); } catch { status(text); }
}

find('story').onclick = async () => {
  if (!current) return;
  const best = current.best >= 0 ? current.items[current.best].title : '';
  const png = await new Promise((resolve) => storyCanvas().toBlob(resolve, 'image/png'));
  const name = fileName().replace(/\.png$/, '-story.png');
  showHints();
  if (best) navigator.clipboard?.writeText(best).catch(() => {});
  if (canShareFiles()) {
    try {
      await navigator.share({ files: [new File([png], name, { type: 'image/png' })] });
      status(best ? `Pick Instagram, then Story. "${best}" is copied for the music sticker.` : 'Pick Instagram, then Story.');
      return;
    } catch (error) {
      if (error.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(png);
  const link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  status('Story image downloaded. Post it from your phone and add the two stickers below.');
};

find('copy-song').onclick = () => {
  if (current && current.best >= 0) copy(current.items[current.best].title, 'Song name copied.');
};
find('copy-cta').onclick = () => copy('https://strummer.fun/receipt', 'Link copied.');

find('copy').onclick = async () => {
  try { await navigator.clipboard.writeText(location.href); status('Link copied.'); } catch { status(location.href); }
};

find('lastfm').onsubmit = (event) => {
  event.preventDefault();
  const user = find('lfm-user').value.trim();
  if (user) pairLastfm(user, find('lfm-period').value);
};
try { find('lfm-user').value = localStorage.getItem('strummer.lastfm.user') || ''; } catch { /* optional */ }
loadShelves();

const params = new URLSearchParams(location.search);
if (/^\d+$/.test(params.get('id') || '')) open(params.get('id'));
else if (params.get('q')) { find('term').value = params.get('q'); search(params.get('q')); }
