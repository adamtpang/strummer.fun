import { describe, expect, it } from 'vitest';

import {
  applyDecision,
  buildSteeringPrompt,
  buildTasteMarkdown,
  createInitialState,
  mergeGeneratedCandidates,
  normalizeGeneratedCandidates,
  parseCreativeBriefPayload,
  parseSunoSongUrl,
  recordReplay,
  shouldRefillQueue,
  summarizeTaste,
  type SunoCandidate,
} from '../src/lib/suno-dj';

const FIRST_ID = '05427893-c663-4a61-9476-cc73a33766ca';
const SECOND_ID = 'b0e0bef4-e8b1-4b52-aee6-db1bd8124c55';

const candidates: SunoCandidate[] = [
  {
    id: FIRST_ID,
    songId: FIRST_ID,
    title: 'First candidate',
    url: `https://suno.com/song/${FIRST_ID}`,
    embedUrl: `https://suno.com/embed/${FIRST_ID}`,
    prompt: 'Warm guitar pop with a direct chorus',
    createdAt: '2026-09-02T00:00:00.000Z',
    replays: 0,
    status: 'queued',
  },
  {
    id: SECOND_ID,
    songId: SECOND_ID,
    title: 'Second candidate',
    url: `https://suno.com/song/${SECOND_ID}`,
    embedUrl: `https://suno.com/embed/${SECOND_ID}`,
    prompt: 'Dry drums and an intimate vocal',
    createdAt: '2026-09-02T00:01:00.000Z',
    replays: 0,
    status: 'queued',
  },
];

describe('parseSunoSongUrl', () => {
  it('turns a Suno song URL into its supported embed URL', () => {
    expect(parseSunoSongUrl(`https://suno.com/song/${FIRST_ID}`)).toEqual({
      canonicalUrl: `https://suno.com/song/${FIRST_ID}`,
      embedUrl: `https://suno.com/embed/${FIRST_ID}`,
      songId: FIRST_ID,
    });
  });

  it('accepts an existing Suno embed URL', () => {
    expect(parseSunoSongUrl(`https://suno.com/embed/${FIRST_ID}`)).toEqual({
      canonicalUrl: `https://suno.com/song/${FIRST_ID}`,
      embedUrl: `https://suno.com/embed/${FIRST_ID}`,
      songId: FIRST_ID,
    });
  });

  it('rejects non-Suno links and short links without a stable song id', () => {
    expect(parseSunoSongUrl('https://example.com/song/test')).toBeNull();
    expect(parseSunoSongUrl('https://suno.com/s/short-code')).toBeNull();
  });
});

describe('Suno DJ decisions', () => {
  it('keeps a candidate, records why, and advances the queue', () => {
    const state = createInitialState(candidates);
    const next = applyDecision(state, {
      action: 'keep',
      candidateId: FIRST_ID,
      liked: ['Guitar hook', 'Warm harmony'],
      disliked: [],
      direction: '',
      decidedAt: '2026-09-02T00:02:00.000Z',
    });

    expect(next.currentId).toBe(SECOND_ID);
    expect(next.candidates[0].status).toBe('kept');
    expect(next.decisions).toHaveLength(1);
    expect(summarizeTaste(next.decisions).slice(0, 2)).toEqual([
      { label: 'guitar hook', positive: 2, negative: 0, score: 2 },
      { label: 'warm harmony', positive: 2, negative: 0, score: 2 },
    ]);
  });

  it('records misses as negative taste evidence', () => {
    const state = createInitialState(candidates);
    const next = applyDecision(state, {
      action: 'skip',
      candidateId: FIRST_ID,
      liked: [],
      disliked: ['Busy drums'],
      direction: '',
      decidedAt: '2026-09-02T00:02:00.000Z',
    });

    expect(next.candidates[0].status).toBe('skipped');
    expect(summarizeTaste(next.decisions)).toEqual([
      { label: 'busy drums', positive: 0, negative: 2, score: -2 },
    ]);
  });

  it('records an intentional replay without advancing the queue', () => {
    const state = createInitialState(candidates);
    const next = recordReplay(state, FIRST_ID);

    expect(next.currentId).toBe(FIRST_ID);
    expect(next.candidates[0].replays).toBe(1);
  });
});

describe('buildSteeringPrompt', () => {
  it('preserves wins, changes misses, and requests an original result', () => {
    const prompt = buildSteeringPrompt({
      basePrompt: 'Warm guitar pop with a direct chorus',
      liked: ['short guitar hook', 'chorus-first structure'],
      disliked: ['busy drums'],
      direction:
        'Make the verse more intimate and leave more air around the vocal.',
    });

    expect(prompt).toContain(
      'Keep: short guitar hook; chorus-first structure.',
    );
    expect(prompt).toContain('Change or avoid: busy drums.');
    expect(prompt).toContain(
      'Make the verse more intimate and leave more air around the vocal.',
    );
    expect(prompt).toContain('Create a new original song');
    expect(prompt).toContain(
      'Do not imitate any existing artist or recording.',
    );
  });

  it('imports only the allowed user-authored creative brief fields', () => {
    const source = {
      version: 1,
      kind: 'user-authored-musical-observations',
      createdAt: '2026-09-02T00:00:00.000Z',
      evidenceCount: 3,
      positiveTraits: [{ label: 'immediate hook', count: 3 }],
      notes: ['Let the guitar answer the vocal.'],
      trackName: 'This field must be discarded',
    };
    const payload = Buffer.from(JSON.stringify(source), 'utf8').toString(
      'base64url',
    );
    const brief = parseCreativeBriefPayload(payload);

    expect(brief).toEqual({
      version: 1,
      kind: 'user-authored-musical-observations',
      createdAt: '2026-09-02T00:00:00.000Z',
      evidenceCount: 3,
      positiveTraits: [{ label: 'immediate hook', count: 3 }],
      notes: ['Let the guitar answer the vocal.'],
    });
    expect(
      buildSteeringPrompt({
        basePrompt: 'Warm guitar pop',
        liked: [],
        disliked: [],
        direction: '',
        creativeBrief: brief,
      }),
    ).toContain('Taste compass: immediate hook (3 signals).');
  });
});

describe('buildTasteMarkdown', () => {
  it('creates a portable profile from explicit feedback and omits Spotify metadata', () => {
    const state = applyDecision(createInitialState(candidates), {
      action: 'keep',
      candidateId: FIRST_ID,
      liked: ['guitar answer'],
      disliked: ['crowded mix'],
      direction: 'Leave more air around the vocal.',
      decidedAt: '2026-09-02T00:02:00.000Z',
    });
    const markdown = buildTasteMarkdown({
      state,
      generatedAt: '2026-09-03T00:00:00.000Z',
      creativeBrief: {
        version: 1,
        kind: 'user-authored-musical-observations',
        createdAt: '2026-09-02T00:00:00.000Z',
        evidenceCount: 2,
        positiveTraits: [{ label: 'immediate hook', count: 2 }],
        notes: ['Let the guitar answer the vocal.'],
      },
    });

    expect(markdown).toContain('# Strummer taste profile');
    expect(markdown).toContain('guitar answer: +2');
    expect(markdown).toContain('crowded mix: -1');
    expect(markdown).toContain('immediate hook: 2 signals');
    expect(markdown).toContain('Leave more air around the vocal');
    expect(markdown).not.toContain('Spotify');
    expect(markdown).not.toContain('First candidate');
  });

  it('rejects oversized creative-brief payloads', () => {
    expect(parseCreativeBriefPayload('a'.repeat(24_001))).toBeNull();
  });
});

describe('generation provider boundary', () => {
  it('normalizes only playable Suno candidates and deduplicates provider output', () => {
    const normalized = normalizeGeneratedCandidates({
      candidates: [
        {
          title: 'Generated A',
          url: `https://suno.com/song/${FIRST_ID}`,
          prompt: 'Original warm guitar pop',
        },
        { title: 'Duplicate', url: `https://suno.com/embed/${FIRST_ID}` },
        { title: 'Wrong host', url: `https://example.com/song/${SECOND_ID}` },
      ],
    });

    expect(normalized).toHaveLength(1);
    expect(normalized[0]).toMatchObject({
      title: 'Generated A',
      songId: FIRST_ID,
      status: 'queued',
      replays: 0,
    });
  });

  it('refills below the target and merges only new songs', () => {
    const state = createInitialState([candidates[0]]);
    expect(shouldRefillQueue(state)).toBe(true);

    const merged = mergeGeneratedCandidates(state, [
      candidates[0],
      candidates[1],
    ]);
    expect(merged.candidates).toHaveLength(2);
    expect(merged.currentId).toBe(FIRST_ID);
    expect(shouldRefillQueue(merged, 2)).toBe(false);
  });
});
