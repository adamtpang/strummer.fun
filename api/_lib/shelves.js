// Pure parsers for the two album shelves that need a server hop: Apple's daily
// Top Albums chart (no CORS header) and a Last.fm listener's top albums (needs
// an API key that must never reach the browser).

export const APPLE_CHART = 'https://rss.marketingtools.apple.com/api/v2/us/music/most-played/25/albums.json';
export const LASTFM = 'https://ws.audioscrobbler.com/2.0/';
export const PERIODS = { '7day': 'Last 7 days', '1month': 'Last month', '12month': 'Last year', overall: 'All time' };
const USERNAME = /^[A-Za-z][A-Za-z0-9_-]{1,14}$/;

export function parseChart(feed) {
  const results = (feed && feed.feed && feed.feed.results) || [];
  return results
    .filter((item) => item && /^\d+$/.test(String(item.id)) && item.name && item.artistName)
    .map((item) => ({ id: String(item.id), name: item.name, artist: item.artistName, artwork: item.artworkUrl100 || '' }));
}

export const validUsername = (name) => USERNAME.test(String(name || ''));
export const validPeriod = (period) => Object.hasOwn(PERIODS, String(period || ''));

export function lastfmUrl(user, period, apiKey, limit = 10) {
  return `${LASTFM}?${new URLSearchParams({ method: 'user.gettopalbums', user, period, limit: String(limit), api_key: apiKey, format: 'json' })}`;
}

// Last.fm returns error objects with a 200 status for unknown users, so the
// body decides, not the status.
export function parseTopAlbums(body) {
  if (!body || body.error) return null;
  const albums = (body.topalbums && body.topalbums.album) || [];
  return albums
    .filter((album) => album && album.name && album.artist && album.artist.name)
    .map((album) => ({ name: album.name, artist: album.artist.name, plays: Number(album.playcount) || 0 }));
}
