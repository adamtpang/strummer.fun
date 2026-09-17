import { searchUrl, artistSearchUrl, discographyUrl, artistNamedIn, lookupUrl, rankAlbums, buildReceipt, receiptLines, barcode, CTA } from './receipt.mjs';

const find = (id) => document.getElementById(id);
const WIDTH = 1080;
const PAD = 84;
const FONT_SIZE = 30;
const LINE = 44;
const ART = 260;
const PAPER = '#f6f3ea';
const INK = '#1b1b1b';
let current = null;
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

async function open(id) {
  status('Printing your receipt…');
  try {
    current = buildReceipt((await getJson(lookupUrl(id))).results);
    await draw(current);
    find('output').hidden = false;
    find('listen').href = current.link || 'https://music.apple.com';
    find('listen').hidden = !current.link;
    const url = new URL(location.href);
    url.searchParams.set('id', current.id);
    url.searchParams.delete('q');
    history.replaceState(null, '', url);
    status(`${current.album} by ${current.artist}. ${current.count} items, ${current.total}.`);
    find('output').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    status(error.message);
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
  lines.forEach((line, index) => {
    const bold = index < 2 || line.startsWith('TOTAL');
    context.font = `${bold ? 700 : 400} ${FONT_SIZE}px "JetBrains Mono", ui-monospace, monospace`;
    context.fillText(line, PAD, top + index * LINE);
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

const canShareFiles = () => {
  try { return !!navigator.canShare?.({ files: [new File([''], 'x.png', { type: 'image/png' })] }); } catch { return false; }
};
if (canShareFiles()) find('share').hidden = false;
find('share').onclick = async () => {
  if (!current) return;
  const file = new File([await blob()], fileName(), { type: 'image/png' });
  try {
    await navigator.share({ files: [file], title: `${current.album} receipt`, text: 'Make yours free at strummer.fun/receipt' });
  } catch (error) {
    if (error.name !== 'AbortError') status('Sharing did not work here. Download the image instead.');
  }
};

find('copy').onclick = async () => {
  try { await navigator.clipboard.writeText(location.href); status('Link copied.'); } catch { status(location.href); }
};

const params = new URLSearchParams(location.search);
if (/^\d+$/.test(params.get('id') || '')) open(params.get('id'));
else if (params.get('q')) { find('term').value = params.get('q'); search(params.get('q')); }
