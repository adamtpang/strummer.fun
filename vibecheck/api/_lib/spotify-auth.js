// Proof-of-ownership via the caller's Spotify access token.
//
// Under PKCE the token lives client-side, so the only identity we can trust
// on a write is "prove you hold a token Spotify will accept, and that its
// user.id matches the row you're touching". Used by POST (save), PATCH
// (privacy), and DELETE so nobody can write to a Spotify ID that isn't theirs.

/** Pulls the bearer token out of an Authorization header. Returns '' if absent. */
export function getBearerToken(req) {
  const auth = req.headers.authorization || req.headers.Authorization || '';
  return auth.replace(/^Bearer\s+/i, '').trim();
}

/**
 * Resolves the Spotify user id for a token, or null if the token is missing
 * or rejected. One network call to /v1/me; callers compare the id themselves.
 */
export async function resolveSpotifyUserId(token) {
  if (!token) return null;
  try {
    const meRes = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!meRes.ok) return null;
    const me = await meRes.json();
    return me.id || null;
  } catch {
    return null;
  }
}

/**
 * Guards a mutation on `spotifyId`. On success returns null; otherwise returns
 * { status, error } ready to send. Verifies the caller holds a valid Spotify
 * token whose id matches the target row.
 */
export async function requireOwnership(req, spotifyId) {
  const token = getBearerToken(req);
  if (!token) return { status: 401, error: 'Missing Spotify access token' };
  const callerId = await resolveSpotifyUserId(token);
  if (!callerId) return { status: 401, error: 'Spotify token rejected' };
  if (callerId !== spotifyId) return { status: 403, error: 'Token does not match target user' };
  return null;
}
