import { ImageResponse } from '@vercel/og';
import { neon } from '@neondatabase/serverless';

// Edge runtime: faster cold starts and required by @vercel/og.
// Neon's HTTP client works in edge since it's fetch-based.
export const config = { runtime: 'edge' };

const FALLBACK_GRADIENT = 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)';

export default async function handler(req) {
  try {
    const url = new URL(req.url);
    // Path is /api/og/<spotifyId>
    const spotifyId = decodeURIComponent(url.pathname.split('/').pop() || '');

    if (!spotifyId) {
      return new Response('Missing spotifyId', { status: 400 });
    }

    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`
      SELECT display_name, vibe_label, vibe_gradient, top_genres, average_features, is_public
      FROM users WHERE spotify_id = ${spotifyId}
    `;

    // Render a generic fallback card if not found OR private — share preview
    // never breaks, but we don't leak vibe data for opted-out users.
    if (rows.length === 0 || rows[0].is_public === false) {
      return renderCard({
        display_name: 'vibecheck',
        vibe_label: 'what does your music say about you?',
        vibe_gradient: FALLBACK_GRADIENT,
        top_genres: null,
        average_features: null,
      });
    }

    return renderCard(rows[0]);
  } catch (err) {
    console.error('OG render failed:', err);
    return new Response('OG render failed', { status: 500 });
  }
}

function renderCard(user) {
  const gradient = user.vibe_gradient || FALLBACK_GRADIENT;

  // Mirror getContrastTextColor for both v2.16 metrics shape and legacy
  // audio-features shape so old saved cards still render with correct
  // contrast when shared.
  const f = user.average_features || {};
  const useWhiteText = pickWhiteText(f);
  const text = useWhiteText ? '#ffffff' : '#000000';
  const subtle = useWhiteText ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)';

  const topGenre = Array.isArray(user.top_genres) ? user.top_genres[0] : null;

  return new ImageResponse(
    {
      type: 'div',
      props: {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: gradient,
          color: text,
          fontFamily: 'sans-serif',
          padding: '80px',
          position: 'relative',
        },
        children: [
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                fontSize: 48,
                fontWeight: 600,
                marginBottom: 28,
                opacity: 0.9,
                textAlign: 'center',
              },
              children: user.display_name || 'vibecheck',
            },
          },
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                fontSize: 132,
                fontWeight: 800,
                lineHeight: 1.05,
                textAlign: 'center',
                letterSpacing: '-0.02em',
                maxWidth: '90%',
                justifyContent: 'center',
              },
              children: user.vibe_label || '✨ vibe pending',
            },
          },
          topGenre
            ? {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    fontSize: 28,
                    marginTop: 36,
                    textTransform: 'uppercase',
                    letterSpacing: 6,
                    color: subtle,
                  },
                  children: topGenre,
                },
              }
            : null,
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                position: 'absolute',
                bottom: 40,
                fontSize: 22,
                letterSpacing: 6,
                textTransform: 'uppercase',
                color: subtle,
              },
              children: 'vibecheck.style',
            },
          },
        ].filter(Boolean),
      },
    },
    {
      width: 1200,
      height: 630,
      // Cache aggressively but allow Vercel's edge cache to refresh on rebuild.
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800',
      },
    },
  );
}

function lerp(a, b, t) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function pickWhiteText(f) {
  if (!f || typeof f !== 'object') return true;
  // New shape: VibeMetrics
  if (typeof f.mainstream === 'number') {
    const lightness = lerp(22, 48, f.mainstream * 0.7 + (f.modernity ?? 0.5) * 0.3);
    return lightness < 38;
  }
  // Legacy shape: AudioFeatures
  if (typeof f.valence === 'number') {
    const lightness = lerp(25, 55, f.valence);
    return lightness < 45;
  }
  return true;
}
