import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Parse query params with sane bounds
  const limit = Math.min(Math.max(parseInt(req.query.limit ?? '50', 10) || 50, 1), 100);
  const offset = Math.max(parseInt(req.query.offset ?? '0', 10) || 0, 0);

  try {
    const sql = neon(process.env.DATABASE_URL);
    // Only return fields needed for the explore grid + compatibility math.
    // Skip top_tracks (heavier, lazy-load on profile page).
    // Filter out private profiles (is_public = false).
    const rows = await sql`
      SELECT spotify_id, display_name, avatar_url,
             vibe_label, vibe_gradient,
             average_features, top_genres,
             updated_at
      FROM users
      WHERE vibe_label IS NOT NULL
        AND is_public = true
      ORDER BY updated_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Cheap stats query for the explore banner. Kept in this endpoint to
    // avoid an extra round-trip from the client.
    const [stats] = await sql`
      SELECT COUNT(*)::int AS total
      FROM users
      WHERE vibe_label IS NOT NULL AND is_public = true
    `;

    // Top vibe labels — drives the "X people are on this vibe" chip row.
    const topLabels = await sql`
      SELECT vibe_label AS label, COUNT(*)::int AS count
      FROM users
      WHERE vibe_label IS NOT NULL AND is_public = true
      GROUP BY vibe_label
      ORDER BY count DESC, vibe_label ASC
      LIMIT 5
    `;

    // Cache at the Vercel edge for 30s — keeps the explore page snappy and
    // soaks up bursts of traffic without hitting Neon every time.
    res.setHeader(
      'Cache-Control',
      'public, max-age=10, s-maxage=30, stale-while-revalidate=120'
    );
    res.json({
      users: rows,
      limit,
      offset,
      total: stats?.total ?? rows.length,
      topLabels,
    });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
}
