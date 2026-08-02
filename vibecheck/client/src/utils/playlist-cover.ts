// Client-side generator for Spotify playlist cover art.
//
// Spotify requires:
//   - PUT /v1/playlists/{id}/images
//   - Content-Type: image/jpeg
//   - Body: base64-encoded JPEG, **no** "data:image/jpeg;base64," prefix
//   - Max 256 KB
//
// We render a 640x640 canvas with the user's vibe gradient + their
// vibe label + a small "vibecheck.style" wordmark, then export as JPEG
// at 0.85 quality. That comfortably stays under 256 KB.

const SIZE = 640;

interface CoverInput {
  /** CSS gradient string from getVibeGradient — we re-parse stops out of it */
  gradient: string;
  /** Plain vibe label e.g. "🎯 Top 40 Disciple" */
  vibeLabel: string;
  /** White or black depending on the gradient lightness */
  textColor: '#ffffff' | '#000000';
}

/**
 * Returns the cover as a raw base64 JPEG string (no data: prefix), ready
 * to PUT to /v1/playlists/{id}/images.
 */
export async function generatePlaylistCover(input: CoverInput): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;

  // 1. Background gradient — extract HSL stops from the input string and
  //    paint them ourselves (canvas can't consume a CSS gradient directly).
  const stops = parseLinearGradient(input.gradient);
  const grad = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  if (stops.length > 0) {
    stops.forEach((color, i) => {
      grad.addColorStop(i / Math.max(stops.length - 1, 1), color);
    });
  } else {
    grad.addColorStop(0, '#1a1a2e');
    grad.addColorStop(1, '#0f3460');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // 2. Soft radial glow in the upper-left for visual depth
  const glow = ctx.createRadialGradient(SIZE * 0.3, SIZE * 0.25, 0, SIZE * 0.3, SIZE * 0.25, SIZE * 0.7);
  glow.addColorStop(0, 'rgba(255,255,255,0.25)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // 3. Drop shadow under text for contrast (works on any gradient)
  ctx.shadowColor = input.textColor === '#ffffff' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.45)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 2;

  // 4. Vibe label — centered, large, bold
  ctx.fillStyle = input.textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const labelText = input.vibeLabel || 'vibecheck';
  // Wrap if too long
  const maxLineWidth = SIZE * 0.85;
  ctx.font = 'bold 76px Inter, system-ui, sans-serif';
  const lines = wrapText(ctx, labelText, maxLineWidth);
  const lineHeight = 84;
  const totalHeight = lines.length * lineHeight;
  const startY = SIZE / 2 - totalHeight / 2 + lineHeight / 2;
  lines.forEach((line, i) => {
    ctx.fillText(line, SIZE / 2, startY + i * lineHeight);
  });

  // Reset shadow for the wordmark (cleaner small text)
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // 5. Wordmark at the bottom — small, uppercase, tracked
  ctx.fillStyle = input.textColor === '#ffffff' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)';
  ctx.font = '500 18px Inter, system-ui, sans-serif';
  ctx.fillText('VIBECHECK.STYLE', SIZE / 2, SIZE - 38);

  // 6. Export — JPEG at 0.85 strikes the balance under 256 KB
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  // Strip the prefix so it's a raw base64 string
  return dataUrl.replace(/^data:image\/jpeg;base64,/, '');
}

// --- Helpers ----------------------------------------------------------------

/**
 * Pulls the color stops out of strings like
 *   "linear-gradient(135deg, hsl(...), hsl(...), hsl(...))"
 * Returns ["hsl(...)", "hsl(...)", ...]. Robust enough for the vibe-colors
 * generator — not a general CSS parser.
 */
function parseLinearGradient(s: string): string[] {
  const m = s.match(/linear-gradient\(([^)]+(?:\([^)]+\)[^)]*)*)\)/);
  if (!m) return [];
  const inside = m[1];
  // Drop the leading "<angle> ," if present
  const afterAngle = inside.replace(/^[^,]+,/, '');
  // Split on commas that are NOT inside parens (hsl(120, 50%, 50%) trap)
  const stops: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < afterAngle.length; i++) {
    const c = afterAngle[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) {
      stops.push(afterAngle.slice(start, i).trim());
      start = i + 1;
    }
  }
  stops.push(afterAngle.slice(start).trim());
  return stops.filter(Boolean);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  // Cap at 3 lines so the cover never overflows
  return lines.slice(0, 3);
}
