// Pure helpers for finding an album's most popular track on Deezer. Deezer's
// public API ranks every track but sends no CORS allow-origin header, so the
// browser cannot call it; api/receipt/best-track.js does, using these.

export const DEEZER = 'https://api.deezer.com';

export function normalize(text) {
  return String(text || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s*[([].*?(deluxe|edition|remaster|version|expanded|bonus).*?[)\]]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function albumSearchUrl(artist, album) {
  const q = `artist:"${String(artist).replace(/"/g, '')}" album:"${String(album).replace(/"/g, '')}"`;
  return `${DEEZER}/search/album?${new URLSearchParams({ q, limit: '10' })}`;
}

export function albumTracksUrl(id) {
  return `${DEEZER}/album/${encodeURIComponent(id)}/tracks?limit=100`;
}

// Same artist is required. An exact title wins; otherwise a title that starts
// with the wanted one ("Blonde" vs "Blonde (Deluxe)"); otherwise nothing, since
// a wrong album's hit would put a star on the wrong song.
export function pickAlbum(results, artist, album) {
  const wantArtist = normalize(artist);
  const wantAlbum = normalize(album);
  const sameArtist = (results || []).filter(
    (item) => item && item.id && normalize(item.artist && item.artist.name) === wantArtist,
  );
  const rawAlbum = String(album).trim().toLowerCase();
  return (
    sameArtist.find((item) => String(item.title).trim().toLowerCase() === rawAlbum) ||
    sameArtist.find((item) => normalize(item.title) === wantAlbum) ||
    sameArtist.find((item) => normalize(item.title).startsWith(wantAlbum) || wantAlbum.startsWith(normalize(item.title))) ||
    null
  );
}

export function topTrack(tracks) {
  const ranked = (tracks || []).filter((track) => track && track.title && Number.isFinite(track.rank));
  if (!ranked.length) return null;
  const best = ranked.reduce((top, track) => (track.rank > top.rank ? track : top));
  return { title: best.title, rank: best.rank };
}
