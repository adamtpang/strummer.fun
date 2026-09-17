import { albumSearchUrl, albumTracksUrl, pickAlbum, topTrack } from '../_lib/deezer.js';

// GET /api/receipt/best-track?artist=Olivia%20Dean&album=The%20Art%20of%20Loving
// -> { title, rank } for the album's most popular track on Deezer, or
//    { title: null } when the album cannot be matched with confidence.
// Only public catalogue data passes through; nothing about the visitor is sent
// or stored.
export const config = { runtime: 'edge' };

const MAX_FIELD = 200;
const json = (body, status = 200, cache = 'public, s-maxage=86400, stale-while-revalidate=604800') =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache },
  });

export async function lookup(req, fetchImpl) {
  const url = new URL(req.url);
  const artist = (url.searchParams.get('artist') || '').trim();
  const album = (url.searchParams.get('album') || '').trim();
  if (!artist || !album || artist.length > MAX_FIELD || album.length > MAX_FIELD) {
    return json({ error: 'artist and album are required' }, 400, 'no-store');
  }
  try {
    const search = await fetchImpl(albumSearchUrl(artist, album));
    if (!search.ok) throw new Error(`search ${search.status}`);
    const match = pickAlbum((await search.json()).data, artist, album);
    if (!match) return json({ title: null });
    const tracks = await fetchImpl(albumTracksUrl(match.id));
    if (!tracks.ok) throw new Error(`tracks ${tracks.status}`);
    const best = topTrack((await tracks.json()).data);
    return json(best ? { title: best.title, rank: best.rank } : { title: null });
  } catch {
    return json({ error: 'lookup failed' }, 502, 'no-store');
  }
}

// Vercel passes a context object as the second argument, so the fetch used in
// production is bound here rather than taken from the call.
export default function handler(req) {
  return lookup(req, globalThis.fetch);
}
