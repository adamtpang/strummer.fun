import qrcode from './qrcode.mjs';
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
const POST_W = 1080;
const POST_H = 1350;
const TITLE_FONT = '"Instrument Serif", Georgia, serif';
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

function wrapTitle(context, text, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && context.measureText(next).width > maxWidth) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

// Draw a receipt onto any canvas. On screen the top block is the greyscale
// artwork. For the feed post the artwork is already the background, so the
// top block becomes the album title set large, the way printed receipt posts
// put a wordmark there.
async function renderReceipt(receipt, canvas, { title = false } = {}) {
  await document.fonts.load(`${FONT_SIZE}px "JetBrains Mono"`);
  await document.fonts.load(`700 ${FONT_SIZE}px "JetBrains Mono"`);
  if (title) await document.fonts.load(`italic 96px ${TITLE_FONT}`);
  const context = canvas.getContext('2d');
  context.font = `${FONT_SIZE}px "JetBrains Mono", ui-monospace, monospace`;
  const cols = Math.floor((WIDTH - PAD * 2) / context.measureText('M').width);
  const lines = receiptLines(receipt, cols);
  const art = title ? null : await loadImage(receipt.artwork);
  const heading = title && receipt.album && !receipt.listens;
  const top = PAD + (art || heading ? ART + 48 : 0);
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
  if (heading) {
    context.save();
    context.fillStyle = INK;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    let size = 132;
    let lines;
    do {
      context.font = `italic ${size}px ${TITLE_FONT}`;
      lines = wrapTitle(context, receipt.album, WIDTH - PAD * 2);
      size -= 8;
    } while ((lines.length * size * 1.05 > ART || lines.length > 3) && size > 48);
    const lineHeight = (size + 8) * 1.02;
    const startY = PAD + ART / 2 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, index) => context.fillText(line, WIDTH / 2, startY + index * lineHeight));
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

function draw(receipt) {
  return renderReceipt(receipt, find('receipt'));
}

// A 4:5 feed post: the album artwork full-bleed, the receipt in front of it
// running off the bottom edge, and a small handle in the corner.
async function postCanvas() {
  const post = document.createElement('canvas');
  post.width = POST_W;
  post.height = POST_H;
  const context = post.getContext('2d');
  const background = await loadImage(current.artwork ? current.artwork.replace('/600x600bb.', '/1200x1200bb.') : '');
  if (background) {
    const scale = Math.max(POST_W / background.width, POST_H / background.height);
    const w = background.width * scale;
    const h = background.height * scale;
    context.drawImage(background, (POST_W - w) / 2, (POST_H - h) / 2, w, h);
    context.fillStyle = 'rgba(0,0,0,0.12)';
    context.fillRect(0, 0, POST_W, POST_H);
  } else {
    context.fillStyle = STORY_BG;
    context.fillRect(0, 0, POST_W, POST_H);
  }
  const paper = document.createElement('canvas');
  await renderReceipt(current, paper, { title: true });
  const width = 820;
  const height = paper.height * (width / paper.width);
  context.save();
  context.shadowColor = 'rgba(0,0,0,0.45)';
  context.shadowBlur = 36;
  context.shadowOffsetY = 14;
  context.drawImage(paper, (POST_W - width) / 2, 118, width, height);
  context.restore();
  context.font = '700 26px "JetBrains Mono", ui-monospace, monospace';
  context.textAlign = 'right';
  context.textBaseline = 'top';
  context.fillStyle = 'rgba(0,0,0,0.45)';
  context.fillText(LINK.toUpperCase(), POST_W - 38, 42);
  context.fillStyle = '#ffffff';
  context.fillText(LINK.toUpperCase(), POST_W - 40, 40);
  return post;
}

function toPng(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

function saveFile(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// The link a phone should open to reach this exact receipt.
function shareableUrl() {
  const url = new URL('/receipt/', location.origin);
  if (current.listens) {
    url.searchParams.set('lastfm', current.user);
    url.searchParams.set('period', current.period);
  } else {
    url.searchParams.set('id', current.id);
  }
  return url.toString();
}

function drawQr(text) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const canvas = find('qr');
  const context = canvas.getContext('2d');
  const count = qr.getModuleCount();
  const quiet = 2;
  const cellSize = Math.floor(canvas.width / (count + quiet * 2));
  const offset = Math.floor((canvas.width - cellSize * count) / 2);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#000000';
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) context.fillRect(offset + col * cellSize, offset + row * cellSize, cellSize, cellSize);
    }
  }
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
  const png = await toPng(storyCanvas());
  const name = fileName().replace(/\.png$/, '-story.png');
  showHints();
  find('handoff').hidden = true;
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
  saveFile(png, name);
  drawQr(shareableUrl());
  find('handoff').hidden = false;
  status('Story image downloaded. Scan the code to finish on your phone.');
};

// Feed posts can be made on instagram.com, so on a laptop the tab opens first
// (inside the click, so it is not blocked as a popup) and the image downloads
// for the Create dialog. On a phone the share sheet goes straight to the app.
find('post').onclick = async () => {
  if (!current) return;
  const phone = canShareFiles();
  const tab = phone ? null : window.open('about:blank', '_blank');
  if (tab) { tab.opener = null; tab.location.href = 'https://www.instagram.com/'; }
  find('handoff').hidden = true;
  find('hints').hidden = true;
  status('Making your post…');
  const png = await toPng(await postCanvas());
  const name = fileName().replace(/\.png$/, '-post.png');
  const caption = current.listens
    ? `my top albums, ${current.year.toLowerCase()}. make yours free at strummer.fun/receipt`
    : `"${current.album}" by ${current.artist}. make yours free at strummer.fun/receipt`;
  navigator.clipboard?.writeText(caption).catch(() => {});
  if (phone) {
    try {
      await navigator.share({ files: [new File([png], name, { type: 'image/png' })] });
      status('Pick Instagram, then Post. The caption is copied.');
    } catch (error) {
      if (error.name !== 'AbortError') status('Sharing did not work here. The image will download instead.');
      if (error.name !== 'AbortError') saveFile(png, name);
    }
    return;
  }
  saveFile(png, name);
  status(tab
    ? 'Instagram opened in a new tab. Click Create, then choose the image that just downloaded. The caption is copied.'
    : 'Post image downloaded. Open instagram.com, click Create, and choose it. The caption is copied.');
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
if (params.get('lastfm')) {
  find('lfm-user').value = params.get('lastfm');
  if (params.get('period')) find('lfm-period').value = params.get('period');
  pairLastfm(params.get('lastfm'), find('lfm-period').value);
}
if (!params.get('lastfm') && /^\d+$/.test(params.get('id') || '')) open(params.get('id'));
else if (params.get('q')) { find('term').value = params.get('q'); search(params.get('q')); }
