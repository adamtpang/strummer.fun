import { neon } from '@neondatabase/serverless';

/**
 * Crawler-friendly HTML wrapper for /compare/:a/:b URLs. Same pattern as
 * /api/share/[spotifyId]: returns OG-tagged HTML for social platforms,
 * meta-refreshes humans straight into the SPA.
 */
export default async function handler(req, res) {
  const { idA, idB } = req.query;
  if (!idA || !idB) return res.status(400).send('Missing ids');

  let a = null;
  let b = null;
  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`
      SELECT spotify_id, display_name, vibe_label, is_public
      FROM users WHERE spotify_id IN (${idA}, ${idB})
    `;
    a = rows.find(r => r.spotify_id === idA && r.is_public !== false) || null;
    b = rows.find(r => r.spotify_id === idB && r.is_public !== false) || null;
  } catch (err) {
    console.error('Compare share-tag DB fetch failed:', err);
  }

  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const origin = `${proto}://${host}`;

  const safeA = encodeURIComponent(idA);
  const safeB = encodeURIComponent(idB);
  const ogImage = `${origin}/api/og/compare/${safeA}/${safeB}`;
  const compareUrl = `${origin}/compare/${safeA}/${safeB}`;

  const title = a && b
    ? `${a.display_name} vs ${b.display_name} — vibecheck.style`
    : 'vibe match — vibecheck.style';
  const description = a && b
    ? `${stripEmoji(a.vibe_label || '')} meets ${stripEmoji(b.vibe_label || '')}. See your full breakdown.`
    : 'see how two music tastes compare on vibecheck.style';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />

  <meta property="og:type" content="website" />
  <meta property="og:url" content="${compareUrl}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${ogImage}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:site_name" content="vibecheck.style" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${ogImage}" />

  <meta http-equiv="refresh" content="0; url=${compareUrl}" />
  <link rel="canonical" href="${compareUrl}" />
</head>
<body>
  <p>Loading <a href="${compareUrl}">${escapeHtml(title)}</a>...</p>
  <script>window.location.replace(${JSON.stringify(compareUrl)});</script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400');
  res.status(200).send(html);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripEmoji(s) {
  return String(s).replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim();
}
