const INVITATION_KEY = 'strummer-vibe-invitation';
const INVITATION_TTL = 7 * 24 * 60 * 60 * 1000;

export function validProfileId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9._-]{1,100}$/.test(value);
}

export function rememberInvitation(storage: Storage, id: string, now = Date.now()) {
  if (!validProfileId(id)) return;
  storage.setItem(INVITATION_KEY, JSON.stringify({ id, createdAt: now }));
}

export function readInvitation(storage: Storage, now = Date.now()): string | null {
  try {
    const entry = JSON.parse(storage.getItem(INVITATION_KEY) || 'null');
    if (!entry || !validProfileId(entry.id) || !Number.isFinite(entry.createdAt) ||
      entry.createdAt > now || now - entry.createdAt > INVITATION_TTL) return null;
    return entry.id;
  } catch { return null; }
}

export function forgetInvitation(storage: Storage) {
  try { storage.removeItem(INVITATION_KEY); } catch { /* Storage may be disabled. */ }
}

export function comparisonPath(first: string, second: string) {
  return `/compare/${encodeURIComponent(first)}/${encodeURIComponent(second)}`;
}

export function spotifyTrackUrl(track: { uri?: string; url?: string; external_urls?: { spotify?: string } }): string | null {
  const id = track.uri?.match(/^spotify:track:([a-zA-Z0-9]{22})$/)?.[1];
  if (id) return `https://open.spotify.com/track/${id}`;
  try {
    const url = new URL(track.url || track.external_urls?.spotify || '');
    return url.origin === 'https://open.spotify.com' && /^\/track\/[a-zA-Z0-9]{22}$/.test(url.pathname) ? url.href : null;
  } catch { return null; }
}
