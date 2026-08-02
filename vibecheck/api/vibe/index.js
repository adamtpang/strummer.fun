import { neon } from '@neondatabase/serverless';
import { sanitizeVibePayload } from '../_lib/sanitize.js';
import { requireOwnership } from '../_lib/spotify-auth.js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    spotify_id, display_name, avatar_url, playlist_id,
    vibe_label, vibe_gradient, average_features, top_tracks, top_genres,
    top_artists, is_public,
  } = sanitizeVibePayload(req.body);

  if (!spotify_id || !display_name) {
    return res.status(400).json({ error: 'spotify_id and display_name required' });
  }

  // Only the owner may write their row. Without this, an anonymous caller could
  // overwrite anyone's vibe or flip their privacy flag (POST is CORS *).
  const denied = await requireOwnership(req, spotify_id);
  if (denied) return res.status(denied.status).json({ error: denied.error });

  // is_public is optional on insert (column default applies). On update we
  // only overwrite when the client explicitly sends a boolean — that way a
  // generation-flow save doesn't silently flip a user's privacy choice.
  const explicitPublic = typeof is_public === 'boolean';
  const topArtistsJson = JSON.stringify(Array.isArray(top_artists) ? top_artists : []);

  try {
    const sql = neon(process.env.DATABASE_URL);
    if (explicitPublic) {
      await sql`INSERT INTO users (spotify_id, display_name, avatar_url, playlist_id, vibe_label, vibe_gradient, average_features, top_tracks, top_genres, top_artists, is_public, updated_at)
         VALUES (${spotify_id}, ${display_name}, ${avatar_url}, ${playlist_id}, ${vibe_label}, ${vibe_gradient}, ${JSON.stringify(average_features)}, ${JSON.stringify(top_tracks)}, ${JSON.stringify(top_genres)}, ${topArtistsJson}, ${is_public}, NOW())
         ON CONFLICT (spotify_id) DO UPDATE SET
           display_name = ${display_name},
           avatar_url = ${avatar_url},
           playlist_id = ${playlist_id},
           vibe_label = ${vibe_label},
           vibe_gradient = ${vibe_gradient},
           average_features = ${JSON.stringify(average_features)},
           top_tracks = ${JSON.stringify(top_tracks)},
           top_genres = ${JSON.stringify(top_genres)},
           top_artists = ${topArtistsJson},
           is_public = ${is_public},
           updated_at = NOW()`;
    } else {
      await sql`INSERT INTO users (spotify_id, display_name, avatar_url, playlist_id, vibe_label, vibe_gradient, average_features, top_tracks, top_genres, top_artists, updated_at)
         VALUES (${spotify_id}, ${display_name}, ${avatar_url}, ${playlist_id}, ${vibe_label}, ${vibe_gradient}, ${JSON.stringify(average_features)}, ${JSON.stringify(top_tracks)}, ${JSON.stringify(top_genres)}, ${topArtistsJson}, NOW())
         ON CONFLICT (spotify_id) DO UPDATE SET
           display_name = ${display_name},
           avatar_url = ${avatar_url},
           playlist_id = ${playlist_id},
           vibe_label = ${vibe_label},
           vibe_gradient = ${vibe_gradient},
           average_features = ${JSON.stringify(average_features)},
           top_tracks = ${JSON.stringify(top_tracks)},
           top_genres = ${JSON.stringify(top_genres)},
           top_artists = ${topArtistsJson},
           updated_at = NOW()`;
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error saving vibe:', err);
    res.status(500).json({ error: 'Failed to save vibe' });
  }
}
