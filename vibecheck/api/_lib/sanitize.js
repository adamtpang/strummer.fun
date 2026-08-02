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
    average_features:
      body.average_features && typeof body.average_features === 'object'
        ? body.average_features
        : null,
    top_tracks: clipArray(body.top_tracks, ARRAY_LIMITS.top_tracks),
    top_genres: clipArray(body.top_genres, ARRAY_LIMITS.top_genres).map(g =>
      clipString(g, 50)
    ),
    top_artists: clipArray(body.top_artists, ARRAY_LIMITS.top_artists),
    is_public: typeof body.is_public === 'boolean' ? body.is_public : undefined,
  };
}
