// Shared input validation for /api/vibe POST.
//
// Strategy: clip rather than reject. Legitimate data flows through; abusive
// payloads get clamped to sane sizes. Keeps the DB compact and prevents a
// malicious or buggy client from filling rows with multi-MB JSON blobs.

const STRING_LIMITS = {
  display_name: 200,
  vibe_label: 100,
  vibe_gradient: 500,
  avatar_url: 1000,
  playlist_id: 100,
  spotify_id: 100,
};

const ARRAY_LIMITS = {
  top_tracks: 20,
  top_artists: 20,
  top_genres: 20,
};

function clipString(v, max) {
  if (v == null) return null;
  if (typeof v !== 'string') v = String(v);
  return v.slice(0, max);
}

function clipArray(v, max) {
  if (!Array.isArray(v)) return [];
  return v.slice(0, max);
}

function safeHttpUrl(value, max = 1000) {
  const clipped = clipString(value, max);
  if (!clipped) return null;
  try {
    const url = new URL(clipped);
    return url.protocol === 'https:' || url.protocol === 'http:' ? clipped : null;
  } catch {
    return null;
  }
}

function sanitizeTrack(track) {
  if (!track || typeof track !== 'object') return null;
  return {
    name: clipString(track.name, 300),
    artist: clipString(track.artist, 500),
    albumArt: safeHttpUrl(track.albumArt),
    uri: clipString(track.uri, 200),
    url: safeHttpUrl(track.url),
  };
}
function sanitizeArtist(artist) {
  if (!artist || typeof artist !== 'object') return null;
  return {
    id: clipString(artist.id, 200),
    name: clipString(artist.name, 300),
    image: safeHttpUrl(artist.image),
    genres: clipArray(artist.genres, 10).map(genre => clipString(genre, 50)),
    popularity: Number.isFinite(artist.popularity) ? artist.popularity : null,
    url: safeHttpUrl(artist.url),
  };
}
function sanitizeMetrics(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 30)
      .filter(([, metric]) => Number.isFinite(metric))
      .map(([key, metric]) => [clipString(key, 50), metric])
  );
}

/**
 * Returns a sanitized copy of a vibe-save payload. Unknown fields are
 * dropped silently. Throws nothing — always produces something safe to
 * upsert.
 */
export function sanitizeVibePayload(body = {}) {
  return {
    spotify_id: clipString(body.spotify_id, STRING_LIMITS.spotify_id),
    display_name: clipString(body.display_name, STRING_LIMITS.display_name),
    avatar_url: clipString(body.avatar_url, STRING_LIMITS.avatar_url),
    playlist_id: clipString(body.playlist_id, STRING_LIMITS.playlist_id),
    vibe_label: clipString(body.vibe_label, STRING_LIMITS.vibe_label),
    vibe_gradient: clipString(body.vibe_gradient, STRING_LIMITS.vibe_gradient),
    average_features: sanitizeMetrics(body.average_features),
    top_tracks: clipArray(body.top_tracks, ARRAY_LIMITS.top_tracks)
      .map(sanitizeTrack)
      .filter(Boolean),
    top_genres: clipArray(body.top_genres, ARRAY_LIMITS.top_genres).map(g =>
      clipString(g, 50)
    ),
    top_artists: clipArray(body.top_artists, ARRAY_LIMITS.top_artists)
      .map(sanitizeArtist)
      .filter(Boolean),
    is_public: typeof body.is_public === 'boolean' ? body.is_public : undefined,
  };
}
