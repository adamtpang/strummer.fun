import type { VibeMetrics } from './vibe-analysis';

interface VibeGradient {
  from: string;
  via: string;
  to: string;
  css: string;
  name: string;
}

/**
 * Generates a 3-stop linear gradient from VibeMetrics.
 *
 * Modernity drives the primary hue:
 *   0.0 → deep amber/sepia (retro)
 *   0.5 → teal/blue (timeless mid)
 *   1.0 → magenta/electric (very current)
 *
 * Mainstream drives saturation + lightness — top-of-charts feels brighter
 * and more vivid; underground feels deeper and moodier.
 *
 * Diversity nudges the secondary hue away from the primary so polymath
 * vibes get more rainbow movement; monogenre vibes feel monochromatic.
 *
 * Recency-shift adds a third "spark" hue at the gradient's tail.
 */
export function getVibeGradient(m: VibeMetrics): VibeGradient {
  const { mainstream, modernity, diversity, recencyShift } = m;

  const primaryHue =
    modernity > 0.5
      ? lerp(195, 305, (modernity - 0.5) * 2) // refined teal → violet
      : lerp(20, 195, modernity * 2);          // amber → teal

  // v2.19: dial saturation back so colors read sophisticated rather than
  // neon. Cap at 72% (was 90%). Keep the spread for differentiation.
  const saturation = lerp(28, 72, mainstream);
  const lightness = lerp(20, 42, mainstream * 0.65 + modernity * 0.35);

  // Tighter secondary spread → more cohesive gradient (less rainbow chaos)
  const secondaryHue = (primaryHue + lerp(15, 75, diversity)) % 360;
  const tertiaryHue = (primaryHue + lerp(150, 200, recencyShift)) % 360;

  const from = `hsl(${Math.round(primaryHue)}, ${Math.round(saturation)}%, ${Math.round(lightness)}%)`;
  const via = `hsl(${Math.round(secondaryHue)}, ${Math.round(saturation * 0.82)}%, ${Math.round(lightness * 1.12)}%)`;
  const to = `hsl(${Math.round(tertiaryHue)}, ${Math.round(saturation * 0.65)}%, ${Math.round(lightness * 0.82)}%)`;

  return {
    from,
    via,
    to,
    css: `linear-gradient(135deg, ${from}, ${via}, ${to})`,
    name: getGradientName(m),
  };
}

/**
 * Returns a text color (white or black) that contrasts well with the gradient.
 * Bright/saturated gradients want black text; deep/muted ones want white.
 */
export function getContrastTextColor(m: VibeMetrics): string {
  const lightness = lerp(22, 48, m.mainstream * 0.7 + m.modernity * 0.3);
  return lightness < 38 ? '#ffffff' : '#000000';
}

export function getSubtleTextColor(m: VibeMetrics): string {
  const lightness = lerp(22, 48, m.mainstream * 0.7 + m.modernity * 0.3);
  return lightness < 38 ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)';
}

/**
 * Adapts either the new VibeMetrics shape or a legacy AudioFeatures-shaped
 * object into something the contrast helpers can read. Maps valence→mainstream
 * and energy→modernity as a rough approximation so old saved cards don't
 * render with broken contrast.
 */
export function asColorRef(features: any): VibeMetrics {
  if (!features || typeof features !== 'object') {
    return { mainstream: 0.5, modernity: 0.5 } as VibeMetrics;
  }
  if (typeof features.mainstream === 'number') {
    return features as VibeMetrics;
  }
  return {
    mainstream: features.valence ?? 0.5,
    modernity: features.energy ?? 0.5,
    diversity: 0.5,
    recencyShift: 0,
    artistConcentration: 0,
    eraSpread: 0,
    avgYear: new Date().getFullYear(),
    uniqueGenres: 0,
    avgPopularity: 50,
    topGenreShare: 0,
  };
}

function getGradientName(m: VibeMetrics): string {
  const { mainstream, modernity, diversity, recencyShift } = m;
  if (recencyShift > 0.6) return 'Hot Take';
  if (diversity > 0.8) return 'Spectrum';
  if (mainstream > 0.7 && modernity > 0.7) return 'Neon Pop';
  if (mainstream > 0.7 && modernity < 0.4) return 'Golden Hour';
  if (mainstream < 0.4 && modernity > 0.7) return 'Underground Glow';
  if (mainstream < 0.4 && modernity < 0.4) return 'Sepia Soul';
  if (modernity > 0.6) return 'Modern';
  if (modernity < 0.4) return 'Vintage';
  return 'Nebula';
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}
