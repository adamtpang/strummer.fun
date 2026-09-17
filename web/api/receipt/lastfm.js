import { lastfmUrl, parseTopAlbums, validPeriod, validUsername } from '../_lib/shelves.js';

// GET /api/receipt/lastfm?user=<name>&period=<7day|1month|12month|overall>
// -> { albums: [{ name, artist, plays }] }
// The Last.fm key lives only in the LASTFM_API_KEY environment variable. With
// no key set this answers 503, and the page hides the section. Only the
// username the visitor typed is sent to Last.fm; nothing is stored.
export const config = { runtime: 'edge' };

const json = (body, status, cache = 'no-store') =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache } });

export async function topAlbums(req, apiKey, fetchImpl) {
  if (!apiKey) return json({ error: 'not configured' }, 503);
  const url = new URL(req.url);
  if (url.searchParams.has('probe')) return json({ ready: true }, 200);
  const user = url.searchParams.get('user') || '';
  const period = url.searchParams.get('period') || '1month';
  if (!validUsername(user)) return json({ error: 'That is not a Last.fm username.' }, 400);
  if (!validPeriod(period)) return json({ error: 'Unknown period.' }, 400);
  try {
    const response = await fetchImpl(lastfmUrl(user, period, apiKey));
    const albums = parseTopAlbums(await response.json());
    if (!albums) return json({ error: 'No Last.fm listener with that name.' }, 404);
    return json({ albums }, 200, 'public, s-maxage=900');
  } catch {
    return json({ error: 'Last.fm did not answer. Try again.' }, 502);
  }
}

export default function handler(req) {
  return topAlbums(req, globalThis.process?.env?.LASTFM_API_KEY, globalThis.fetch);
}
