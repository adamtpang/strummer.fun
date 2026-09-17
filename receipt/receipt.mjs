// Pure logic for album receipts. No DOM, no network, so every rule here is
// covered by web/test/receipt.test.mjs. Data comes from Apple's public iTunes
// Search API: no key, no login, and no per-app user cap, which is the point.
// Spotify development-mode apps are capped at five users as of February 2026.

export const SEARCH_URL = 'https://itunes.apple.com/search';
export const LOOKUP_URL = 'https://itunes.apple.com/lookup';
export const CTA = 'MAKE YOURS FREE AT STRUMMER.FUN/RECEIPT';
export const LINK = 'strummer.fun/receipt';
export const STAR = '★';

// Apple Music's 100 Best Albums, top 10, as announced 2024-05-22
// (apple.com/newsroom). IDs resolved against Apple's catalogue 2026-09-17 so
// the shelf never depends on search luck.
export const ALL_TIME = [
  { id: '1276760743', name: 'The Miseducation of Lauryn Hill', artist: 'Lauryn Hill' },
  { id: '269572838', name: 'Thriller', artist: 'Michael Jackson' },
  { id: '1474815798', name: 'Abbey Road', artist: 'The Beatles' },
  { id: '1746833068', name: 'Purple Rain', artist: 'Prince & The Revolution' },
  { id: '1146195596', name: 'Blonde', artist: 'Frank Ocean' },
  { id: '1440788438', name: 'Songs in the Key of Life', artist: 'Stevie Wonder' },
  { id: '1471263898', name: 'good kid, m.A.A.d city', artist: 'Kendrick Lamar' },
  { id: '1422677780', name: 'Back to Black', artist: 'Amy Winehouse' },
  { id: '1440783617', name: 'Nevermind', artist: 'Nirvana' },
  { id: '1460430561', name: 'Lemonade', artist: 'Beyonc\u00e9' },
];

export const PERIOD_LABELS = { '7day': 'LAST 7 DAYS', '1month': 'LAST MONTH', '12month': 'LAST YEAR', overall: 'ALL TIME' };

// A Receiptify-style receipt of one listener's top albums. It reuses the
// album receipt's shape, so drawing, the story export, and sharing all work
// unchanged; the right-hand column holds plays instead of run time.
export function topAlbumsReceipt(user, period, albums, now = new Date()) {
  const list = (albums || []).filter((album) => album && album.name && album.artist).slice(0, 10);
  if (!list.length) throw new Error('No albums to print yet. Scrobble a few and try again.');
  const plays = list.reduce((sum, album) => sum + (Number(album.plays) || 0), 0);
  const hash = hashOf(`${user}|${period}`);
  return {
    id: hash,
    album: 'TOP ALBUMS',
    artist: `@${user}`,
    year: PERIOD_LABELS[period] || '',
    genre: 'LAST.FM',
    label: '',
    artwork: '',
    link: `https://www.last.fm/user/${encodeURIComponent(user)}`,
    order: String(hash % 10000).padStart(4, '0'),
    date: now.toISOString().slice(0, 10),
    column: 'PLAYS',
    items: list.map((album, index) => ({
      number: String(index + 1).padStart(2, '0'),
      title: `${album.name} - ${album.artist}`,
      time: String(Number(album.plays) || 0),
    })),
    count: list.length,
    total: String(plays),
    card: `**** **** **** ${now.getUTCFullYear()}`,
    auth: String(hash % 1000000).padStart(6, '0'),
    best: -1,
    listens: true,
    user,
    period,
  };
}
const MIN_ALBUM_TRACKS = 5;

export function searchUrl(term) {
  const url = new URL(SEARCH_URL);
  url.search = new URLSearchParams({ term, media: 'music', entity: 'album', limit: '25' }).toString();
  return url.toString();
}

export function artistSearchUrl(term) {
  const url = new URL(SEARCH_URL);
  url.search = new URLSearchParams({ term, media: 'music', entity: 'musicArtist', limit: '5' }).toString();
  return url.toString();
}

export function discographyUrl(artistId) {
  const url = new URL(LOOKUP_URL);
  url.search = new URLSearchParams({ id: String(artistId), entity: 'album', limit: '200' }).toString();
  return url.toString();
}

export function normalize(text) {
  return String(text || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// Apple's album search misses some catalogues entirely (Frank Ocean's Blonde
// is absent from every query shape as of 2026-09-17), but the artist's own
// discography lists them. Pick the artist the query actually names.
export function artistNamedIn(artists, query) {
  const q = ` ${normalize(query)} `;
  return (artists || []).find((artist) => artist && artist.artistId && normalize(artist.artistName) && q.includes(` ${normalize(artist.artistName)} `)) || null;
}

export function bestTrackUrl(artist, album) {
  return `/api/receipt/best-track?${new URLSearchParams({ artist, album })}`;
}

const bareTitle = (title) => normalize(String(title || '').replace(/[([](feat|ft|with)\b.*?[)\]]/gi, ''));

// Index of the receipt item whose title matches the best track Deezer named,
// or -1. Exact match first, then one title starting with the other, so
// "Nights" still finds "Nights" and a remaster suffix does not break it.
export function matchTrack(items, title) {
  const want = bareTitle(title);
  if (!want) return -1;
  const names = (items || []).map((item) => bareTitle(item.title));
  const exact = names.indexOf(want);
  if (exact >= 0) return exact;
  return names.findIndex((name) => name && (name.startsWith(want) || want.startsWith(name)));
}

export function lookupUrl(id) {
  const url = new URL(LOOKUP_URL);
  url.search = new URLSearchParams({ id: String(id), entity: 'song', limit: '200' }).toString();
  return url.toString();
}

export function formatDuration(ms) {
  const total = Math.max(0, Math.round((Number(ms) || 0) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

// Score by how well a result matches what was typed: the artist named in the
// query matters most, then album-title words, then being a full album rather
// than a single or EP. Tributes that only mention the artist in their title
// get no artist credit. Ties keep Apple's own order. Explicit or plain beats a
// cleaned duplicate of the same record.
export function rankAlbums(results, query = '') {
  const albums = (results || []).filter(
    (item) => item && item.wrapperType === 'collection' && item.collectionId && item.collectionName,
  );
  const signature = (item) => `${item.collectionName.toLowerCase()}|${String(item.artistName).toLowerCase()}`;
  const hasUncleaned = new Set(albums.filter((item) => item.collectionExplicitness !== 'cleaned').map(signature));
  const seen = new Set();
  const kept = [];
  albums.forEach((item, index) => {
    if (seen.has(item.collectionId)) return;
    if (item.collectionExplicitness === 'cleaned' && hasUncleaned.has(signature(item))) return;
    seen.add(item.collectionId);
    kept.push({ item, index });
  });
  const isFull = (item) => (item.trackCount || 0) >= MIN_ALBUM_TRACKS && !/ - (single|ep)$/i.test(item.collectionName);
  const q = ` ${normalize(query)} `;
  const queryWords = new Set(normalize(query).split(' ').filter(Boolean));
  const score = (item) => {
    const artist = normalize(item.artistName);
    const artistNamed = artist && q.includes(` ${artist} `);
    const titleWords = normalize(item.collectionName.replace(/ - (single|ep)$/i, '')).split(' ').filter(Boolean);
    const artistWords = new Set(artist.split(' '));
    const leftover = [...queryWords].filter((word) => !(artistNamed && artistWords.has(word)));
    const titleHits = titleWords.filter((word) => leftover.includes(word)).length;
    const titleShare = titleWords.length ? titleHits / titleWords.length : 0;
    return (artistNamed ? 3 : 0) + 2 * titleShare + (titleHits && titleHits === leftover.length ? 1 : 0) + (isFull(item) ? 1 : 0);
  };
  kept.forEach((entry) => { entry.score = score(entry.item); });
  kept.sort((a, b) => b.score - a.score || a.index - b.index);
  return kept.map(({ item }) => item);
}

// Apple's copyright field is either "℗ 2016 Boys Don't Cry" or a sentence
// like "A Capitol Records UK / Polydor Label Group release; ℗ 2025 ...".
// Keep just the label name.
export function labelFrom(copyright) {
  const text = String(copyright || '').split(';')[0].trim();
  const sentence = text.match(/^an?\s+(.+?)\s+(release|recording)\b/i);
  if (sentence) return sentence[1].trim();
  return text.replace(/^[℗©]\s*(\d{4}\s+)?/, '').trim();
}

function hashOf(text) {
  let hash = 2166136261;
  for (const char of String(text)) hash = Math.imul(hash ^ char.codePointAt(0), 16777619) >>> 0;
  return hash;
}

export function buildReceipt(lookupResults, now = new Date()) {
  const results = lookupResults || [];
  const album = results.find((item) => item.wrapperType === 'collection');
  if (!album) throw new Error('That album could not be found.');
  const songs = results
    .filter((item) => item.wrapperType === 'track' && item.kind === 'song')
    .sort((a, b) => (a.discNumber || 1) - (b.discNumber || 1) || (a.trackNumber || 0) - (b.trackNumber || 0));
  if (!songs.length) throw new Error('Apple has no tracklist for that album.');

  const totalMs = songs.reduce((sum, song) => sum + (song.trackTimeMillis || 0), 0);
  const year = album.releaseDate ? String(new Date(album.releaseDate).getUTCFullYear()) : '';
  const hash = hashOf(album.collectionId);
  return {
    id: album.collectionId,
    album: album.collectionName,
    artist: album.artistName,
    year,
    genre: album.primaryGenreName || '',
    label: labelFrom(album.copyright),
    artwork: album.artworkUrl100 ? album.artworkUrl100.replace(/\/\d+x\d+bb\./, '/600x600bb.') : '',
    link: album.collectionViewUrl || '',
    order: String(album.collectionId).slice(-4).padStart(4, '0'),
    date: now.toISOString().slice(0, 10),
    items: songs.map((song, index) => ({
      number: String(index + 1).padStart(2, '0'),
      title: song.trackName,
      time: formatDuration(song.trackTimeMillis),
    })),
    count: songs.length,
    total: formatDuration(totalMs),
    card: `**** **** **** ${year || '0000'}`,
    auth: String(hash % 1000000).padStart(6, '0'),
    best: -1,
  };
}

// One receipt line exactly `cols` characters wide: number, title, time.
// Titles longer than their slot are cut with an ellipsis, never wrapped, so
// the right-hand time column always lines up.
export function receiptRow(number, title, time, cols) {
  const left = `${number}  `;
  const right = ` ${time.padStart(7)}`;
  const room = Math.max(1, cols - [...left].length - [...right].length);
  const chars = [...String(title)];
  const fitted = chars.length > room ? chars.slice(0, room - 1).join('') + '…' : chars.join('');
  return left + fitted.padEnd(room + (fitted.length - [...fitted].length)) + right;
}

export function pairRow(label, value, cols) {
  const room = Math.max(1, cols - label.length - 1);
  const chars = [...String(value)];
  const fitted = chars.length > room ? chars.slice(0, room - 1).join('') + '…' : chars.join('');
  return label + ' ' + fitted.padStart(room + (fitted.length - [...fitted].length));
}

export function centered(text, cols) {
  const chars = [...String(text)];
  const fitted = chars.length > cols ? chars.slice(0, cols - 1).join('') + '…' : chars.join('');
  const pad = Math.max(0, Math.floor((cols - [...fitted].length) / 2));
  return ' '.repeat(pad) + fitted;
}

// Bar widths for a decorative barcode, stable per album.
export function barcode(seed, count = 48) {
  let state = hashOf(seed) || 1;
  return Array.from({ length: count }, () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5; state >>>= 0;
    return 1 + (state % 4);
  });
}

export function receiptLines(receipt, cols) {
  const rule = '-'.repeat(cols);
  return [
    centered('STRUMMER RECORD SHOP', cols),
    centered(receipt.listens ? 'LISTENING RECEIPT' : 'ALBUM RECEIPT', cols),
    '',
    pairRow('ORDER #', receipt.order, cols),
    pairRow('DATE', receipt.date, cols),
    rule,
    centered(receipt.artist.toUpperCase(), cols),
    centered(receipt.album.toUpperCase(), cols),
    centered([receipt.year, receipt.genre].filter(Boolean).join(' · '), cols),
    rule,
    receiptRow('NO', 'ITEM', receipt.column || 'TIME', cols),
    rule,
    ...receipt.items.map((item, index) =>
      receiptRow(item.number, (index === receipt.best ? `${STAR} ` : '') + item.title.toUpperCase(), item.time, cols)),
    rule,
    pairRow('ITEM COUNT:', String(receipt.count), cols),
    pairRow(receipt.listens ? 'TOTAL PLAYS:' : 'TOTAL:', receipt.total, cols),
    ...(receipt.best >= 0 ? [pairRow(`${STAR} BEST TRACK:`, receipt.items[receipt.best].title.toUpperCase(), cols)] : []),
    '',
    pairRow('CARD #:', receipt.card, cols),
    pairRow('AUTH CODE:', receipt.auth, cols),
    ...(receipt.label ? [pairRow('LABEL:', receipt.label.toUpperCase(), cols)] : []),
    '',
    centered('THANK YOU FOR LISTENING!', cols),
  ];
}
