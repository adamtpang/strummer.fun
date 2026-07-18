import { neon } from '@neondatabase/serverless';
import { getBearerToken, resolveSpotifyUserId, requireOwnership } from '../_lib/spotify-auth.js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { spotifyId } = req.query;
  if (!spotifyId) {
    return res.status(400).json({ error: 'spotifyId required' });
  }

  const sql = neon(process.env.DATABASE_URL);

  if (req.method === 'GET') {
    try {
      const rows = await sql`SELECT * FROM users WHERE spotify_id = ${spotifyId}`;
      if (rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      const row = rows[0];

      // Privacy gate: a private row's full data (top tracks/artists, features,
      // genres, playlist) is only served to the owner. Everyone else gets the
      // minimum needed to render a "this vibe is private" screen. is_public is
      // NOT NULL going forward, but treat legacy NULL as public.
      const isPrivate = row.is_public === false;
      if (isPrivate) {
        const callerId = await resolveSpotifyUserId(getBearerToken(req));
        const isOwner = callerId && callerId === spotifyId;
        if (!isOwner) {
          // No edge caching for private responses — a privacy flip must take
          // effect immediately, not linger in a CDN.
          res.setHeader('Cache-Control', 'private, no-store');
          return res.json({
            spotify_id: row.spotify_id,
            display_name: row.display_name,
            avatar_url: row.avatar_url,
            is_public: false,
          });
        }
        res.setHeader('Cache-Control', 'private, no-store');
        return res.json(row);
      }

      // Public: cache at the Vercel edge for 10s — most repeat requests come
      // from the same person hitting refresh, OG render, etc.
      res.setHeader(
        'Cache-Control',
        'public, max-age=5, s-maxage=10, stale-while-revalidate=60'
      );
      return res.json(row);
    } catch (err) {
      console.error('Error fetching vibe:', err);
      return res.status(500).json({ error: 'Failed to fetch vibe' });
    }
  }

  if (req.method === 'PATCH') {
    // Privacy toggle only. Owner-gated; touches nothing but is_public so a
    // toggle can never clobber the user's vibe data (the old round-trip POST
    // could). Body: { is_public: boolean }.
    if (typeof req.body?.is_public !== 'boolean') {
      return res.status(400).json({ error: 'is_public (boolean) required' });
    }
    const denied = await requireOwnership(req, spotifyId);
    if (denied) return res.status(denied.status).json({ error: denied.error });
    try {
      const rows = await sql`UPDATE users SET is_public = ${req.body.is_public}, updated_at = NOW()
        WHERE spotify_id = ${spotifyId} RETURNING spotify_id`;
      if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
      return res.json({ success: true, is_public: req.body.is_public });
    } catch (err) {
      console.error('Error updating privacy:', err);
      return res.status(500).json({ error: 'Failed to update privacy' });
    }
  }

  if (req.method === 'DELETE') {
    // Proof-of-ownership: a valid Spotify token whose user.id matches the path.
    const denied = await requireOwnership(req, spotifyId);
    if (denied) return res.status(denied.status).json({ error: denied.error });
    try {
      await sql`DELETE FROM users WHERE spotify_id = ${spotifyId}`;
      return res.json({ success: true });
    } catch (err) {
      console.error('Error deleting vibe:', err);
      return res.status(500).json({ error: 'Failed to delete vibe' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
