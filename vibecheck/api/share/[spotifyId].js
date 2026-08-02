import { neon } from '@neondatabase/serverless';

/**
 * Returns an HTML page with per-user Open Graph + Twitter Card meta tags
 * pointing at /api/og/<spotifyId>. Crawlers (Twitter, Discord, iMessage,
 * Slack, Facebook) read these tags and render the right preview. Humans
 * are immediately redirected to /<spotifyId> via meta refresh + JS so they
 * land on the SPA.
 *
 * Why a separate /share path: the SPA's static index.html can't have
 * per-user meta tags without SSR. This function is a tiny crawler-friendly
 * shim that delegates rendering to the SPA for real users.
 */
export default async function handler(req, res) {
  const { spotifyId } = req.query;

  if (!spotifyId) {
    return res.status(400).send('Missing spotifyId');
  }

  // Fetch minimal data needed for tags. Don't block on DB errors — degrade
  // to a generic preview rather than 500ing the share link.
  // Private profiles also fall back to the generic preview so we don't
  // leak personalized data into share metadata.
  let user = null;
  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`
      SELECT display_name, vibe_label, is_public
      FROM users WHERE spotify_id = ${spotifyId}
    `;
    if (rows.length > 0 && rows[0].is_public !== false) user = rows[0];
  } catch (err) {
    console.error('Share-tag DB fetch failed:', err);
  }

  // Compute origin from the request so the URL works on both prod and previews.
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const origin = `${proto}://${host}`;

  const safeId = encodeURIComponent(spotifyId);
  const ogImage = `${origin}/api/og/${safeId}`;
  const profileUrl = `${origin}/${safeId}`;

  const title = user
    ? `${user.display_name}'s vibe — ${stripEmoji(user.vibe_label || '')}`
    : 'vibecheck.style';
  const description = user
    ? `${user.vibe_label || 'their music vibe'} — see how your taste compares.`
    : 'what does your music say about you?';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${profileUrl}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${ogImage}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:site_name" content="vibecheck.style" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${ogImage}" />

  <!-- Redirect humans to the SPA. Crawlers ignore this. -->
  <meta http-equiv="refresh" content="0; url=${profileUrl}" />
  <link rel="canonical" href="${profileUrl}" />
</head>
<body>
  <p>Loading <a href="${profileUrl}">${escapeHtml(title)}</a>...</p>
  <script>window.location.replace(${JSON.stringify(profileUrl)});</script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Cache for crawlers; allow Vercel's edge to revalidate quickly.
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

// vibe_label looks like "🌊 Chill Wave" — keep emoji in OG image but strip
// for <title>/<description> so they read cleanly in tweets/iMessage previews.
function stripEmoji(s) {
  return String(s).replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim();
}
