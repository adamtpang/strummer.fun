import type { VibeMetrics } from './vibe-analysis';

export interface VibeLabel {
  label: string;
  emoji: string;
  description: string;
  /** 0-100 confidence in this label vs alternates */
  confidence: number;
}

interface Archetype {
  emoji: string;
  label: string;
  description: string;
  /** Returns 0..1 fit score for given metrics */
  score: (m: VibeMetrics) => number;
}

// Helper for the score functions: penalty for being far from a target value.
// 1.0 = bullseye, 0.0 = at the opposite end of 0..1 space.
const near = (v: number, target: number) => 1 - Math.abs(v - target);
const high = (v: number) => Math.max(0, (v - 0.5) * 2);
const low = (v: number) => Math.max(0, (0.5 - v) * 2);

const archetypes: Archetype[] = [
  // --- Trumps that override the quadrants when extreme ---
  {
    emoji: '🔥',
    label: 'Hot Take Era',
    description: 'Your taste is actively rewriting itself — what you love today is not what you loved last year.',
    score: m => Math.max(0, m.recencyShift - 0.6) * 2.5,
  },
  {
    emoji: '📚',
    label: 'Genre Polymath',
    description: 'You speak every musical language. Algorithms hate you.',
    score: m => Math.max(0, m.diversity - 0.75) * 2.5,
  },
  {
    emoji: '🎭',
    label: 'Stan Era',
    description: 'One artist is most of your replays right now.',
    score: m => Math.max(0, m.artistConcentration - 0.45) * 2.5,
  },
  {
    emoji: '🍷',
    label: 'Decade Hopper',
    description: 'You travel through musical history every playlist.',
    score: m => Math.max(0, m.eraSpread - 0.65) * 2.2,
  },

  // --- Quadrants of mainstream × modernity × diversity ---
  {
    emoji: '🎯',
    label: 'Top 40 Disciple',
    description: 'You speak the lingua franca of pop — what\'s on the radio is what\'s on you.',
    score: m => high(m.mainstream) * high(m.modernity) * low(m.diversity),
  },
  {
    emoji: '✨',
    label: 'Pop Polyglot',
    description: 'Mainstream-friendly without being monogenre. You meet people where they are.',
    score: m => high(m.mainstream) * high(m.modernity) * near(m.diversity, 0.6),
  },
  {
    emoji: '📻',
    label: 'Classic Hits Soul',
    description: 'The radio raised you and you never left.',
    score: m => high(m.mainstream) * low(m.modernity) * low(m.diversity),
  },
  {
    emoji: '🎬',
    label: 'Soundtrack Soul',
    description: 'Eclectic but timeless — your playlist could score a film.',
    score: m => high(m.mainstream) * low(m.modernity) * high(m.diversity),
  },
  {
    emoji: '🌑',
    label: 'Underground Devotee',
    description: 'You found them before they were cool, and you\'re fine if they never get there.',
    score: m => low(m.mainstream) * high(m.modernity) * low(m.diversity),
  },
  {
    emoji: '🌐',
    label: 'Crate Digger',
    description: 'Niche meets curious. The algorithm cannot pin you.',
    score: m => low(m.mainstream) * high(m.modernity) * high(m.diversity),
  },
  {
    emoji: '📼',
    label: 'Cassette Curator',
    description: 'Old soul, narrow obsessions — and proud.',
    score: m => low(m.mainstream) * low(m.modernity) * low(m.diversity),
  },
  {
    emoji: '🕰️',
    label: 'Time Traveler',
    description: 'Pre-streaming wisdom across genres no one teaches anymore.',
    score: m => low(m.mainstream) * low(m.modernity) * high(m.diversity),
  },

  // --- Catch-all when nothing dominates ---
  {
    emoji: '🎶',
    label: 'Eclectic Soul',
    description: 'Doesn\'t fit a box — and that\'s the point.',
    score: m => 0.4 + 0.2 * (1 - Math.abs(m.diversity - 0.5)),
  },
];

export function getVibeLabel(metrics: VibeMetrics): VibeLabel {
  const scored = archetypes
    .map(a => ({ a, score: a.score(metrics) }))
    .sort((x, y) => y.score - x.score);
  const best = scored[0];
  // Confidence: how far ahead the winner is over the runner-up
  const margin = best.score - (scored[1]?.score ?? 0);
  const confidence = Math.round(Math.min(1, best.score) * 100 - margin * 10);
  return {
    label: best.a.label,
    emoji: best.a.emoji,
    description: best.a.description,
    confidence: Math.max(0, Math.min(99, confidence)),
  };
}

export function getTopVibeLabels(metrics: VibeMetrics, count = 3): VibeLabel[] {
  return archetypes
    .map(a => ({
      label: a.label,
      emoji: a.emoji,
      description: a.description,
      confidence: Math.round(Math.min(1, a.score(metrics)) * 100),
    }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, count);
}
