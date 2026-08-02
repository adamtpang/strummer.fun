import { ImageResponse } from '@vercel/og';
import { neon } from '@neondatabase/serverless';

export const config = { runtime: 'edge' };

const FALLBACK_GRADIENT = 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)';

export default async function handler(req) {
  try {
    const url = new URL(req.url);
    // Path is /api/og/compare/<idA>/<idB>
    const parts = url.pathname.split('/').filter(Boolean);
    const idA = decodeURIComponent(parts[parts.length - 2] || '');
    const idB = decodeURIComponent(parts[parts.length - 1] || '');

    if (!idA || !idB) {
      return new Response('Missing ids', { status: 400 });
    }

    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`
      SELECT spotify_id, display_name, vibe_label, vibe_gradient,
             average_features, top_genres, is_public
      FROM users
      WHERE spotify_id IN (${idA}, ${idB})
    `;

    const findUser = id => rows.find(r => r.spotify_id === id) || null;
    const a = findUser(idA);
    const b = findUser(idB);

    // If either is missing or private, render generic compare card so the
    // share preview never breaks and we never leak data.
    const hidden = !a || !b || a.is_public === false || b.is_public === false;

    if (hidden) {
      return renderCompare(
        { display_name: 'Anonymous', vibe_gradient: FALLBACK_GRADIENT, vibe_label: 'private vibe', average_features: null },
        { display_name: 'Anonymous', vibe_gradient: FALLBACK_GRADIENT, vibe_label: 'private vibe', average_features: null },
        null,
      );
    }

    // Compute compatibility score (mirrors calculateLightCompatibility)
    const score = computeScore(a.average_features, b.average_features, a.top_genres, b.top_genres);

    return renderCompare(a, b, score);
  } catch (err) {
    console.error('OG compare render failed:', err);
    return new Response('OG compare render failed', { status: 500 });
  }
}

function renderCompare(a, b, score) {
  const gradA = a.vibe_gradient || FALLBACK_GRADIENT;
  const gradB = b.vibe_gradient || FALLBACK_GRADIENT;
  const textA = pickWhiteText(a.average_features) ? '#ffffff' : '#000000';
  const textB = pickWhiteText(b.average_features) ? '#ffffff' : '#000000';

  return new ImageResponse(
    {
      type: 'div',
      props: {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          fontFamily: 'sans-serif',
        },
        children: [
          // LEFT SIDE
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: '50%',
                height: '100%',
                background: gradA,
                color: textA,
                padding: '60px',
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      fontSize: 36,
                      fontWeight: 700,
                      marginBottom: 24,
                      opacity: 0.95,
                      textAlign: 'center',
                    },
                    children: a.display_name || 'A',
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      fontSize: 64,
                      fontWeight: 800,
                      lineHeight: 1.05,
                      textAlign: 'center',
                      letterSpacing: '-0.02em',
                      maxWidth: '90%',
                      justifyContent: 'center',
                    },
                    children: a.vibe_label || '✨',
                  },
                },
              ],
            },
          },
          // RIGHT SIDE
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: '50%',
                height: '100%',
                background: gradB,
                color: textB,
                padding: '60px',
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      fontSize: 36,
                      fontWeight: 700,
                      marginBottom: 24,
                      opacity: 0.95,
                      textAlign: 'center',
                    },
                    children: b.display_name || 'B',
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      fontSize: 64,
                      fontWeight: 800,
                      lineHeight: 1.05,
                      textAlign: 'center',
                      letterSpacing: '-0.02em',
                      maxWidth: '90%',
                      justifyContent: 'center',
                    },
                    children: b.vibe_label || '✨',
                  },
                },
              ],
            },
          },
          // CENTER MEDALLION — the compatibility score
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 280,
                height: 280,
                borderRadius: 200,
                background: 'rgba(0, 0, 0, 0.85)',
                color: '#ffffff',
                border: '4px solid rgba(255, 255, 255, 0.9)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      fontSize: 22,
                      letterSpacing: 6,
                      textTransform: 'uppercase',
                      opacity: 0.7,
                      marginBottom: 8,
                    },
                    children: 'vibe match',
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      fontSize: 110,
                      fontWeight: 900,
                      lineHeight: 1,
                      letterSpacing: '-0.03em',
                    },
                    children: score == null ? '??' : `${score}%`,
                  },
                },
              ],
            },
          },
          // FOOTER WORDMARK
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                position: 'absolute',
                bottom: 30,
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: 18,
                letterSpacing: 6,
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.95)',
                background: 'rgba(0,0,0,0.4)',
                padding: '6px 16px',
                borderRadius: 20,
              },
              children: 'vibecheck.style',
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800',
      },
    },
  );
}

// --- Helpers (mirror the client-side math so OG renders match the UI) ---

function pickWhiteText(f) {
  if (!f || typeof f !== 'object') return true;
  if (typeof f.mainstream === 'number') {
    const lightness = 22 + (48 - 22) * Math.max(0, Math.min(1, f.mainstream * 0.7 + (f.modernity ?? 0.5) * 0.3));
    return lightness < 38;
  }
  if (typeof f.valence === 'number') {
    const lightness = 25 + (55 - 25) * Math.max(0, Math.min(1, f.valence));
    return lightness < 45;
  }
  return true;
}

function computeScore(fa, fb, gA, gB) {
  if (!fa || !fb) return null;
  const audio = cosineSimilarity(featuresToVector(fa), featuresToVector(fb));
  const genre = jaccard(gA || [], gB || []);
  return Math.round((audio * 0.7 + genre * 0.3) * 100);
}

function featuresToVector(f) {
  // Detect new metrics shape vs legacy audio features.
  if (typeof f.mainstream === 'number') {
    return [
      f.mainstream ?? 0.5,
      f.modernity ?? 0.5,
      f.diversity ?? 0.5,
      f.recencyShift ?? 0,
      f.artistConcentration ?? 0,
      f.eraSpread ?? 0,
    ];
  }
  return [
    f.acousticness ?? 0.5,
    f.danceability ?? 0.5,
    f.energy ?? 0.5,
    f.instrumentalness ?? 0.5,
    f.liveness ?? 0.5,
    (f.loudness ?? -10) / 60 + 1,
    f.speechiness ?? 0.5,
    (f.tempo ?? 120) / 200,
    f.valence ?? 0.5,
    (f.key ?? 5) / 11,
    f.mode ?? 1,
    (f.time_signature ?? 4) / 7,
  ];
}

function cosineSimilarity(v1, v2) {
  let dot = 0, m1 = 0, m2 = 0;
  for (let i = 0; i < v1.length; i++) {
    dot += v1[i] * v2[i];
    m1 += v1[i] * v1[i];
    m2 += v2[i] * v2[i];
  }
  if (m1 === 0 || m2 === 0) return 0;
  return dot / (Math.sqrt(m1) * Math.sqrt(m2));
}

function jaccard(a, b) {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a.map(x => x.toLowerCase()));
  const setB = new Set(b.map(x => x.toLowerCase()));
  const inter = [...setA].filter(x => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return inter / union;
}
