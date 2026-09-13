export const SUNO_DJ_STATE_VERSION = 1;

export type CandidateStatus =
  | 'queued'
  | 'kept'
  | 'skipped'
  | 'iterated'
  | 'certified';

export type DecisionAction = 'keep' | 'skip' | 'iterate' | 'certify';

export type SunoCandidate = {
  id: string;
  songId: string;
  source?: CandidateSource;
  title: string;
  url: string;
  embedUrl: string;
  prompt: string;
  createdAt: string;
  replays: number;
  status: CandidateStatus;
};

export type TasteDecision = {
  action: DecisionAction;
  candidateId: string;
  liked: string[];
  disliked: string[];
  direction: string;
  decidedAt: string;
};

export type SunoDJState = {
  version: typeof SUNO_DJ_STATE_VERSION;
  candidates: SunoCandidate[];
  currentId: string | null;
  decisions: TasteDecision[];
};

export type TasteTrait = {
  label: string;
  positive: number;
  negative: number;
  score: number;
};

export type ParsedSunoSongUrl = {
  canonicalUrl: string;
  embedUrl: string;
  songId: string;
};

// Where a candidate came from. 'suno' is a generated candidate the listener
// pasted in. 'catalog' is one of Adam's own released songs, played from its
// public SoundCloud page. The station scores both the same way.
export type CandidateSource = 'suno' | 'catalog';

export type ParsedCandidateUrl = ParsedSunoSongUrl & {
  source: CandidateSource;
};

// One released song out of src/content/songs, as the DJ page hands it over.
export type CatalogSongInput = {
  title?: unknown;
  stage?: unknown;
  suno?: unknown;
  soundcloud?: unknown;
  key?: unknown;
  tempo?: unknown;
  hook?: unknown;
  date?: unknown;
};

export type SunoCreativeBrief = {
  version: 1;
  kind: 'user-authored-musical-observations';
  createdAt: string;
  evidenceCount: number;
  positiveTraits: Array<{ label: string; count: number }>;
  notes: string[];
};

export type GeneratedCandidateInput = {
  title?: unknown;
  url?: unknown;
  prompt?: unknown;
  createdAt?: unknown;
};

type TasteMarkdownInput = {
  state: SunoDJState;
  creativeBrief?: SunoCreativeBrief | null;
  generatedAt?: string;
  profileName?: string;
};

const SUNO_HOSTS = new Set(['suno.com', 'www.suno.com']);
const SOUNDCLOUD_HOSTS = new Set([
  'soundcloud.com',
  'www.soundcloud.com',
  'm.soundcloud.com',
]);
// A SoundCloud track is exactly /<user>/<slug>. Two segments, nothing deeper:
// /<user>/sets/<slug> is a playlist and /<user> alone is a profile.
const SOUNDCLOUD_TRACK_PATH =
  /^\/([a-z0-9][a-z0-9_-]{2,})\/([a-z0-9][a-z0-9_-]*)$/i;
const SOUNDCLOUD_RESERVED = new Set(['sets', 'tracks', 'albums', 'reposts']);
const SONG_PATH =
  /^\/(?:song|embed)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/|$)/i;
const MAX_CREATIVE_BRIEF_LENGTH = 24_000;

const POSITIVE_WEIGHTS: Record<DecisionAction, number> = {
  keep: 2,
  skip: 1,
  iterate: 1,
  certify: 3,
};

const NEGATIVE_WEIGHTS: Record<DecisionAction, number> = {
  keep: 1,
  skip: 2,
  iterate: 1,
  certify: 0,
};

const STATUS_BY_ACTION: Record<DecisionAction, CandidateStatus> = {
  keep: 'kept',
  skip: 'skipped',
  iterate: 'iterated',
  certify: 'certified',
};

const normalizeTrait = (value: string) =>
  value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');

const uniqueTraits = (values: string[]) => [
  ...new Set(values.map(normalizeTrait).filter(Boolean)),
];

const cleanBriefText = (value: unknown, limit: number) =>
  typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ').slice(0, limit)
    : '';

const decodeBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(normalized + padding);
  return new TextDecoder().decode(
    Uint8Array.from(binary, (character) => character.charCodeAt(0)),
  );
};

export const parseCreativeBriefPayload = (
  payload: string,
): SunoCreativeBrief | null => {
  if (!payload || payload.length > MAX_CREATIVE_BRIEF_LENGTH) {
    return null;
  }

  try {
    const value: unknown = JSON.parse(decodeBase64Url(payload));
    if (!value || typeof value !== 'object') {
      return null;
    }
    const candidate = value as Partial<SunoCreativeBrief>;
    if (
      candidate.version !== 1 ||
      candidate.kind !== 'user-authored-musical-observations' ||
      !Array.isArray(candidate.positiveTraits) ||
      !Array.isArray(candidate.notes)
    ) {
      return null;
    }

    const positiveTraits = candidate.positiveTraits
      .map((trait) => ({
        label: cleanBriefText(trait?.label, 80),
        count: Number.isFinite(trait?.count)
          ? Math.max(1, Math.min(999, Math.round(trait.count)))
          : 1,
      }))
      .filter((trait) => trait.label)
      .slice(0, 12);
    const notes = candidate.notes
      .map((note) => cleanBriefText(note, 240))
      .filter(Boolean)
      .slice(0, 12);

    return {
      version: 1,
      kind: 'user-authored-musical-observations',
      createdAt:
        cleanBriefText(candidate.createdAt, 40) || new Date(0).toISOString(),
      evidenceCount: Number.isFinite(candidate.evidenceCount)
        ? Math.max(0, Math.min(9999, Math.round(candidate.evidenceCount)))
        : 0,
      positiveTraits,
      notes,
    };
  } catch {
    return null;
  }
};

const markdownValue = (value: string, limit = 240) =>
  cleanBriefText(value, limit).replace(/([\\`*_{}[\]<>#+.!|()-])/g, '\\$1');

const markdownList = (values: string[], emptyCopy: string) =>
  values.length ? values.map((value) => `- ${value}`) : [`- ${emptyCopy}`];

export const buildTasteMarkdown = ({
  state,
  creativeBrief,
  generatedAt = new Date().toISOString(),
  profileName = 'Local listener',
}: TasteMarkdownInput) => {
  const taste = summarizeTaste(state.decisions);
  const positive = taste
    .filter((trait) => trait.score > 0)
    .slice(0, 20)
    .map((trait) => `${markdownValue(trait.label, 80)}: +${trait.score}`);
  const negative = taste
    .filter((trait) => trait.score < 0)
    .slice(0, 20)
    .map((trait) => `${markdownValue(trait.label, 80)}: ${trait.score}`);
  const compass =
    creativeBrief?.positiveTraits
      .slice(0, 20)
      .map(
        (trait) =>
          `${markdownValue(trait.label, 80)}: ${trait.count} signal${trait.count === 1 ? '' : 's'}`,
      ) ?? [];
  const notes =
    creativeBrief?.notes.slice(0, 20).map((note) => markdownValue(note)) ?? [];
  const directions = state.decisions
    .map((decision) => markdownValue(decision.direction))
    .filter(Boolean)
    .slice(-20);
  const bangers = state.candidates
    .filter((candidate) => candidate.status === 'certified')
    .map((candidate) => markdownValue(candidate.title, 120));
  const decisions = state.decisions.filter(
    (decision) => decision.action !== 'certify',
  );

  return [
    '# Strummer taste profile',
    '',
    `- Profile: ${markdownValue(profileName, 80)}`,
    `- Generated: ${markdownValue(generatedAt, 40)}`,
    `- Feedback decisions: ${decisions.length}`,
    `- Listener-tagged references: ${creativeBrief?.evidenceCount ?? 0}`,
    '- Source: explicit listener feedback only',
    '',
    '## Pull closer',
    '',
    ...markdownList(positive, 'No positive signal yet.'),
    '',
    '## Push away',
    '',
    ...markdownList(negative, 'No negative signal yet.'),
    '',
    '## Creative compass',
    '',
    ...markdownList(compass, 'No listener-authored reference traits yet.'),
    '',
    '## Listener notes',
    '',
    ...markdownList(notes, 'No reference notes yet.'),
    '',
    '## Iteration directions',
    '',
    ...markdownList(directions, 'No iteration directions yet.'),
    '',
    '## Certified bangers',
    '',
    ...markdownList(bangers, 'No certified bangers yet.'),
    '',
  ].join('\n');
};

export const parseSunoSongUrl = (input: string): ParsedSunoSongUrl | null => {
  try {
    const url = new URL(input.trim());
    if (
      url.protocol !== 'https:' ||
      !SUNO_HOSTS.has(url.hostname.toLocaleLowerCase())
    ) {
      return null;
    }

    const match = url.pathname.match(SONG_PATH);
    if (!match) {
      return null;
    }

    const songId = match[1].toLocaleLowerCase();
    return {
      canonicalUrl: `https://suno.com/song/${songId}`,
      embedUrl: `https://suno.com/embed/${songId}`,
      songId,
    };
  } catch {
    return null;
  }
};

// A public SoundCloud track, played through SoundCloud's own widget player.
// No API key and no scraping: the widget takes the track URL as a query param
// and is the embed path SoundCloud publishes for exactly this.
export const parseCatalogSongUrl = (
  input: string,
): ParsedSunoSongUrl | null => {
  try {
    const url = new URL(input.trim());
    if (
      url.protocol !== 'https:' ||
      !SOUNDCLOUD_HOSTS.has(url.hostname.toLocaleLowerCase())
    ) {
      return null;
    }

    const match = url.pathname.match(SOUNDCLOUD_TRACK_PATH);
    if (!match || SOUNDCLOUD_RESERVED.has(match[2].toLocaleLowerCase())) {
      return null;
    }

    const user = match[1].toLocaleLowerCase();
    const slug = match[2].toLocaleLowerCase();
    const canonicalUrl = `https://soundcloud.com/${user}/${slug}`;
    const widget = new URL('https://w.soundcloud.com/player/');
    widget.searchParams.set('url', canonicalUrl);
    widget.searchParams.set('auto_play', 'false');
    widget.searchParams.set('hide_related', 'true');
    widget.searchParams.set('show_comments', 'false');
    widget.searchParams.set('visual', 'false');

    return {
      canonicalUrl,
      embedUrl: widget.toString(),
      songId: `soundcloud:${user}/${slug}`,
    };
  } catch {
    return null;
  }
};

// Accept either source from one entry point, so the add-candidate field and
// the refill path do not each need to know the host list.
export const parseCandidateUrl = (input: string): ParsedCandidateUrl | null => {
  const suno = parseSunoSongUrl(input);
  if (suno) {
    return { ...suno, source: 'suno' };
  }
  const catalog = parseCatalogSongUrl(input);
  if (catalog) {
    return { ...catalog, source: 'catalog' };
  }
  return null;
};

// Turn released songs into station candidates. The prompt field carries what
// the song is actually made of (key, tempo, hook) so a keep or a skip teaches
// the taste profile something concrete instead of just a title.
export const catalogCandidates = (songs: unknown): SunoCandidate[] => {
  if (!Array.isArray(songs)) {
    return [];
  }

  const seen = new Set<string>();
  return songs.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') {
      return [];
    }
    const song = entry as CatalogSongInput;
    // A Suno page wins over a SoundCloud page when a song has both, because the
    // Suno version is the newer candidate and the point of the rotation is to
    // judge candidates. The old release is still reachable by pasting its URL.
    const parsed =
      parseCandidateUrl(typeof song.suno === 'string' ? song.suno : '') ??
      parseCandidateUrl(
        typeof song.soundcloud === 'string' ? song.soundcloud : '',
      );
    if (!parsed || seen.has(parsed.songId)) {
      return [];
    }
    seen.add(parsed.songId);

    const facts = [
      typeof song.stage === 'string' && song.stage ? song.stage : '',
      typeof song.key === 'string' && song.key ? `key ${song.key}` : '',
      typeof song.tempo === 'number' && Number.isFinite(song.tempo)
        ? `${song.tempo} bpm`
        : '',
      typeof song.hook === 'string' && song.hook ? `hook: ${song.hook}` : '',
    ].filter(Boolean);

    return [
      {
        id: parsed.songId,
        songId: parsed.songId,
        source: parsed.source,
        title:
          typeof song.title === 'string' && song.title.trim()
            ? song.title.trim()
            : parsed.songId,
        url: parsed.canonicalUrl,
        embedUrl: parsed.embedUrl,
        prompt: facts.length ? facts.join(', ') : 'Released Strummer original.',
        createdAt:
          typeof song.date === 'string' && song.date
            ? song.date
            : new Date(0).toISOString(),
        replays: 0,
        status: 'queued' as CandidateStatus,
      },
    ];
  });
};

export const normalizeGeneratedCandidates = (
  value: unknown,
): SunoCandidate[] => {
  const entries = Array.isArray(value)
    ? value
    : value &&
        typeof value === 'object' &&
        Array.isArray((value as { candidates?: unknown }).candidates)
      ? (value as { candidates: unknown[] }).candidates
      : [];

  const seen = new Set<string>();
  return entries.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') {
      return [];
    }
    const candidate = entry as GeneratedCandidateInput;
    const parsed = parseCandidateUrl(
      typeof candidate.url === 'string' ? candidate.url : '',
    );
    if (!parsed || seen.has(parsed.songId)) {
      return [];
    }
    seen.add(parsed.songId);

    return [
      {
        id: parsed.songId,
        songId: parsed.songId,
        title: cleanBriefText(candidate.title, 120) || 'New candidate',
        url: parsed.canonicalUrl,
        embedUrl: parsed.embedUrl,
        prompt: cleanBriefText(candidate.prompt, 2_000),
        createdAt:
          cleanBriefText(candidate.createdAt, 40) || new Date().toISOString(),
        replays: 0,
        status: 'queued' as const,
      },
    ];
  });
};

export const mergeGeneratedCandidates = (
  state: SunoDJState,
  candidates: SunoCandidate[],
): SunoDJState => {
  const existingIds = new Set(
    state.candidates.map((candidate) => candidate.songId),
  );
  const additions = candidates.filter(
    (candidate) => !existingIds.has(candidate.songId),
  );
  if (!additions.length) {
    return state;
  }

  return {
    ...state,
    candidates: [...state.candidates, ...additions],
    currentId: state.currentId ?? additions[0].id,
  };
};

export const shouldRefillQueue = (state: SunoDJState, targetSize = 3) =>
  state.candidates.filter((candidate) => candidate.status === 'queued').length <
  targetSize;

export const createInitialState = (
  candidates: SunoCandidate[] = [],
): SunoDJState => ({
  version: SUNO_DJ_STATE_VERSION,
  candidates,
  currentId:
    candidates.find((candidate) => candidate.status === 'queued')?.id ?? null,
  decisions: [],
});

const findNextQueuedId = (
  candidates: SunoCandidate[],
  currentId: string,
): string | null => {
  const currentIndex = candidates.findIndex(
    (candidate) => candidate.id === currentId,
  );
  const afterCurrent = candidates
    .slice(currentIndex + 1)
    .find((candidate) => candidate.status === 'queued');

  return (
    afterCurrent?.id ??
    candidates.find((candidate) => candidate.status === 'queued')?.id ??
    null
  );
};

export const applyDecision = (
  state: SunoDJState,
  decision: TasteDecision,
): SunoDJState => {
  if (
    !state.candidates.some((candidate) => candidate.id === decision.candidateId)
  ) {
    return state;
  }

  const normalizedDecision = {
    ...decision,
    liked: uniqueTraits(decision.liked),
    disliked: uniqueTraits(decision.disliked),
    direction: decision.direction.trim(),
  };

  const candidates = state.candidates.map((candidate) =>
    candidate.id === decision.candidateId
      ? { ...candidate, status: STATUS_BY_ACTION[decision.action] }
      : candidate,
  );

  return {
    ...state,
    candidates,
    currentId:
      decision.action === 'certify'
        ? state.currentId
        : findNextQueuedId(candidates, decision.candidateId),
    decisions: [...state.decisions, normalizedDecision],
  };
};

export const recordReplay = (
  state: SunoDJState,
  candidateId: string,
): SunoDJState => ({
  ...state,
  candidates: state.candidates.map((candidate) =>
    candidate.id === candidateId
      ? { ...candidate, replays: candidate.replays + 1 }
      : candidate,
  ),
});

export const summarizeTaste = (decisions: TasteDecision[]): TasteTrait[] => {
  const traits = new Map<string, Omit<TasteTrait, 'label' | 'score'>>();

  for (const decision of decisions) {
    for (const label of uniqueTraits(decision.liked)) {
      const current = traits.get(label) ?? { positive: 0, negative: 0 };
      current.positive += POSITIVE_WEIGHTS[decision.action];
      traits.set(label, current);
    }

    for (const label of uniqueTraits(decision.disliked)) {
      const current = traits.get(label) ?? { positive: 0, negative: 0 };
      current.negative += NEGATIVE_WEIGHTS[decision.action];
      traits.set(label, current);
    }
  }

  return [...traits.entries()]
    .map(([label, evidence]) => ({
      label,
      positive: evidence.positive,
      negative: evidence.negative,
      score: evidence.positive - evidence.negative,
    }))
    .sort(
      (left, right) =>
        Math.abs(right.score) - Math.abs(left.score) ||
        right.score - left.score ||
        left.label.localeCompare(right.label),
    );
};

type SteeringPromptInput = {
  basePrompt: string;
  liked: string[];
  disliked: string[];
  direction: string;
  creativeBrief?: SunoCreativeBrief | null;
};

export const buildSteeringPrompt = ({
  basePrompt,
  liked,
  disliked,
  direction,
  creativeBrief,
}: SteeringPromptInput) => {
  const briefTraits = creativeBrief?.positiveTraits
    .slice(0, 8)
    .map((trait) => `${trait.label} (${trait.count} signals)`)
    .join('; ');
  const briefNotes = creativeBrief?.notes.slice(0, 6).join(' ');
  const parts = [
    'Create a new original song that develops this production direction.',
    briefTraits ? `Taste compass: ${briefTraits}.` : '',
    briefNotes ? `Listener-authored direction: ${briefNotes}` : '',
    basePrompt.trim() ? `Starting direction: ${basePrompt.trim()}.` : '',
    uniqueTraits(liked).length
      ? `Keep: ${uniqueTraits(liked).join('; ')}.`
      : '',
    uniqueTraits(disliked).length
      ? `Change or avoid: ${uniqueTraits(disliked).join('; ')}.`
      : '',
    direction.trim(),
    'Change one major musical variable while preserving the strongest hook.',
    'Do not imitate any existing artist or recording.',
  ];

  return parts.filter(Boolean).join(' ');
};

export const isSunoDJState = (value: unknown): value is SunoDJState => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<SunoDJState>;

  return (
    candidate.version === SUNO_DJ_STATE_VERSION &&
    Array.isArray(candidate.candidates) &&
    Array.isArray(candidate.decisions) &&
    (typeof candidate.currentId === 'string' || candidate.currentId === null)
  );
};
