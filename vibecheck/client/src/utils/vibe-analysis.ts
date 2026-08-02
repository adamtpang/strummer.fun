// Vibe analysis without /v1/audio-features — Spotify revoked that endpoint
// for our app sometime after the v2.4–v2.13 work. Everything here is derived
// from data still available via /v1/me/top/tracks + /v1/me/top/artists:
//   - track.popularity, track.album.release_date, track.artists
//   - artist.genres, artist.popularity, artist.followers
// The new vibe profile captures *listener identity* (mainstream vs underground,
// modern vs retro, focused vs eclectic, stable vs evolving) instead of
// *audio character* (energy/valence/danceability/etc.).

/**
 * @deprecated kept only so older code paths and stored DB rows that still
 * reference audio-feature fields don't crash. New vibe profiles use
 * VibeMetrics. Callers should migrate.
 */
export interface AudioFeatures {
    acousticness: number;
    danceability: number;
    energy: number;
    instrumentalness: number;
    liveness: number;
    loudness: number;
    speechiness: number;
    tempo: number;
    valence: number;
    key: number;
    mode: number;
    time_signature: number;
}

export interface VibeMetrics {
    /** 0 = underground, 1 = top of the charts (avg track popularity / 100) */
    mainstream: number;
    /** 0 = pre-1960, 1 = current year (avg release year, normalized) */
    modernity: number;
    /** 0 = monogenre, 1 = polymath (genre Shannon entropy, normalized) */
    diversity: number;
    /** 0 = stable taste, 1 = actively discovering (short_term vs long_term divergence) */
    recencyShift: number;
    /** 0 = perfectly spread across artists, 1 = full stan culture (Herfindahl index) */
    artistConcentration: number;
    /** 0 = focused on one era, 1 = decade-hopping (std dev of release years) */
    eraSpread: number;

    // Helper info — useful for display, not for compatibility math
    avgYear: number;
    uniqueGenres: number;
    avgPopularity: number;
    topGenreShare: number;
}

export interface TrackSummary {
    id: string;
    name: string;
    artists: Array<{ id?: string; name: string }>;
    uri: string;
}

export interface VibeProfile {
    userId: string;
    displayName: string;
    tracks: TrackSummary[];
    metrics: VibeMetrics;
    topGenres: string[];
    /** Average features kept here as a backward-compat view of metrics for
     *  any old code that still expects this shape. New code reads `metrics`. */
    averageFeatures: VibeMetrics;
    createdAt: Date;
}

interface CreateVibeProfileInput {
    userId: string;
    displayName: string;
    /** Top tracks combined across time ranges (already sorted by weighted score) */
    tracks: any[];
    /** Top artists combined across time ranges (with genres) */
    artists: any[];
    /** Short-term top track IDs — for recency-shift calculation */
    shortTermTrackIds: string[];
    /** Long-term top track IDs — for recency-shift calculation */
    longTermTrackIds: string[];
}

export function createVibeProfile(input: CreateVibeProfileInput): VibeProfile {
    const { userId, displayName, tracks, artists, shortTermTrackIds, longTermTrackIds } = input;
    console.log('🧠 Creating vibe profile for', displayName);

    const metrics = computeMetrics(tracks, artists, shortTermTrackIds, longTermTrackIds);
    const topGenres = extractTopGenres(artists);
    const trackSummaries: TrackSummary[] = tracks.map(t => ({
        id: t.id,
        name: t.name,
        artists: (t.artists || []).map((a: any) => ({ id: a.id, name: a.name })),
        uri: t.uri,
    }));

    console.log('✅ Vibe profile created:', {
        tracks: trackSummaries.length,
        topGenres: topGenres.slice(0, 3),
        mainstream: metrics.mainstream.toFixed(2),
        modernity: metrics.modernity.toFixed(2),
        diversity: metrics.diversity.toFixed(2),
    });

    return {
        userId,
        displayName,
        tracks: trackSummaries,
        metrics,
        averageFeatures: metrics,
        topGenres,
        createdAt: new Date(),
    };
}

// --- Metric computation ------------------------------------------------------

function computeMetrics(
    tracks: any[],
    artists: any[],
    shortTermIds: string[],
    longTermIds: string[]
): VibeMetrics {
    const safeTracks = tracks.filter(Boolean);
    const safeArtists = artists.filter(Boolean);

    // 1. mainstream — average track popularity (0-100)
    const popularities = safeTracks.map(t => t.popularity ?? 0);
    const avgPopularity = mean(popularities);
    const mainstream = clamp01(avgPopularity / 100);

    // 2. modernity — average release year, normalized 1960..currentYear → 0..1
    const years = safeTracks
        .map(t => extractYear(t.album?.release_date))
        .filter((y): y is number => y != null);
    const avgYear = years.length ? mean(years) : new Date().getFullYear();
    const currentYear = new Date().getFullYear();
    const modernity = clamp01((avgYear - 1960) / Math.max(currentYear - 1960, 1));

    // 3. diversity — Shannon entropy of artist genres, weighted by artist rank
    const genreWeights: Record<string, number> = {};
    safeArtists.forEach((a, idx) => {
        const w = safeArtists.length - idx;
        (a.genres || []).forEach((g: string) => {
            const key = g.toLowerCase().trim();
            if (!key) return;
            genreWeights[key] = (genreWeights[key] || 0) + w;
        });
    });
    const totalWeight = Object.values(genreWeights).reduce((a, b) => a + b, 0);
    let entropy = 0;
    Object.values(genreWeights).forEach(w => {
        const p = w / totalWeight;
        if (p > 0) entropy -= p * Math.log2(p);
    });
    const uniqueGenres = Object.keys(genreWeights).length;
    const maxEntropy = Math.log2(Math.max(uniqueGenres, 2));
    const diversity = clamp01(maxEntropy > 0 ? entropy / maxEntropy : 0);

    // 4. recencyShift — fraction of short-term top tracks absent from long-term
    const longSet = new Set(longTermIds);
    const onlyShort = shortTermIds.filter(id => !longSet.has(id));
    const recencyShift = clamp01(
        shortTermIds.length > 0 ? onlyShort.length / shortTermIds.length : 0
    );

    // 5. artistConcentration — Herfindahl on top tracks' lead artists
    const artistTrackCounts: Record<string, number> = {};
    safeTracks.forEach(t => {
        const aid = t.artists?.[0]?.id || t.artists?.[0]?.name || 'unknown';
        artistTrackCounts[aid] = (artistTrackCounts[aid] || 0) + 1;
    });
    const totalTracks = safeTracks.length || 1;
    const hhi = Object.values(artistTrackCounts).reduce((sum, c) => {
        const share = c / totalTracks;
        return sum + share * share;
    }, 0);
    const uniqueArtists = Math.max(Object.keys(artistTrackCounts).length, 1);
    const minHHI = 1 / uniqueArtists;
    const artistConcentration = clamp01(
        uniqueArtists > 1 ? (hhi - minHHI) / (1 - minHHI) : 0
    );

    // 6. eraSpread — std-dev of years, normalized so 30y std → 1.0
    let eraSpread = 0;
    if (years.length > 1) {
        const variance =
            years.reduce((sum, y) => sum + (y - avgYear) ** 2, 0) / years.length;
        const std = Math.sqrt(variance);
        eraSpread = clamp01(std / 30);
    }

    // Helpers
    const sortedGenres = Object.entries(genreWeights).sort(([, a], [, b]) => b - a);
    const topGenreShare = clamp01(
        totalWeight > 0 && sortedGenres.length > 0
            ? sortedGenres[0][1] / totalWeight
            : 0
    );

    return {
        mainstream,
        modernity,
        diversity,
        recencyShift,
        artistConcentration,
        eraSpread,
        avgYear: Math.round(avgYear),
        uniqueGenres,
        avgPopularity: Math.round(avgPopularity),
        topGenreShare,
    };
}

// --- Compatibility -----------------------------------------------------------

export function calculateLightCompatibility(
    a: { metrics?: VibeMetrics; averageFeatures?: VibeMetrics; topGenres: string[] },
    b: { metrics?: VibeMetrics; averageFeatures?: VibeMetrics; topGenres: string[] }
): number {
    const ma = (a.metrics || a.averageFeatures) as VibeMetrics | undefined;
    const mb = (b.metrics || b.averageFeatures) as VibeMetrics | undefined;
    if (!ma || !mb || !isVibeMetrics(ma) || !isVibeMetrics(mb)) return 0;

    const metricSim = cosineSimilarity(metricsToVector(ma), metricsToVector(mb));
    const genreSim = calculateGenreSimilarity(a.topGenres || [], b.topGenres || []);
    return Math.round((metricSim * 0.7 + genreSim * 0.3) * 100);
}

export interface CompatBreakdown {
    score: number;
    audio: number; // kept name "audio" so existing UI labels still work
    genre: number;
    sharedGenres: string[];
    /** Per-metric absolute deltas in 0..1 space */
    featureDeltas: {
        mainstream: number;
        modernity: number;
        diversity: number;
        recencyShift: number;
        eraSpread: number;
    };
}

export function calculateCompatBreakdown(
    a: { metrics?: VibeMetrics; averageFeatures?: VibeMetrics; topGenres: string[] },
    b: { metrics?: VibeMetrics; averageFeatures?: VibeMetrics; topGenres: string[] }
): CompatBreakdown {
    const ma = (a.metrics || a.averageFeatures) as VibeMetrics;
    const mb = (b.metrics || b.averageFeatures) as VibeMetrics;
    const safe = isVibeMetrics(ma) && isVibeMetrics(mb);
    const metricSim = safe ? cosineSimilarity(metricsToVector(ma), metricsToVector(mb)) : 0;
    const genreSim = calculateGenreSimilarity(a.topGenres || [], b.topGenres || []);
    const score = Math.round((metricSim * 0.7 + genreSim * 0.3) * 100);

    const setA = new Set((a.topGenres || []).map(g => g.toLowerCase()));
    const setB = new Set((b.topGenres || []).map(g => g.toLowerCase()));
    const sharedGenres = [...setA].filter(g => setB.has(g));

    return {
        score,
        audio: Math.round(metricSim * 100),
        genre: Math.round(genreSim * 100),
        sharedGenres,
        featureDeltas: safe
            ? {
                  mainstream: Math.abs(ma.mainstream - mb.mainstream),
                  modernity: Math.abs(ma.modernity - mb.modernity),
                  diversity: Math.abs(ma.diversity - mb.diversity),
                  recencyShift: Math.abs(ma.recencyShift - mb.recencyShift),
                  eraSpread: Math.abs(ma.eraSpread - mb.eraSpread),
              }
            : { mainstream: 1, modernity: 1, diversity: 1, recencyShift: 1, eraSpread: 1 },
    };
}

// --- Helpers ----------------------------------------------------------------

function metricsToVector(m: VibeMetrics): number[] {
    return [
        m.mainstream,
        m.modernity,
        m.diversity,
        m.recencyShift,
        m.artistConcentration,
        m.eraSpread,
    ];
}

function isVibeMetrics(x: any): x is VibeMetrics {
    return (
        x &&
        typeof x === 'object' &&
        typeof x.mainstream === 'number' &&
        typeof x.modernity === 'number'
    );
}

function cosineSimilarity(v1: number[], v2: number[]): number {
    let dot = 0,
        m1 = 0,
        m2 = 0;
    for (let i = 0; i < v1.length; i++) {
        dot += v1[i] * v2[i];
        m1 += v1[i] * v1[i];
        m2 += v2[i] * v2[i];
    }
    if (m1 === 0 || m2 === 0) return 0;
    return dot / (Math.sqrt(m1) * Math.sqrt(m2));
}

function calculateGenreSimilarity(g1: string[], g2: string[]): number {
    if (g1.length === 0 && g2.length === 0) return 1;
    if (g1.length === 0 || g2.length === 0) return 0;
    const s1 = new Set(g1.map(g => g.toLowerCase()));
    const s2 = new Set(g2.map(g => g.toLowerCase()));
    const inter = new Set([...s1].filter(x => s2.has(x)));
    const union = new Set([...s1, ...s2]);
    return inter.size / union.size;
}

function extractTopGenres(artists: any[]): string[] {
    const weights: Record<string, number> = {};
    artists.forEach((a, idx) => {
        const w = artists.length - idx;
        (a.genres || []).forEach((g: string) => {
            const key = g.toLowerCase().trim();
            if (!key) return;
            weights[key] = (weights[key] || 0) + w;
        });
    });
    return Object.entries(weights)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([g]) => g);
}

function extractYear(s: string | undefined): number | null {
    if (!s) return null;
    const y = parseInt(s.slice(0, 4), 10);
    return Number.isFinite(y) && y > 1900 && y <= 2100 ? y : null;
}

function mean(xs: number[]): number {
    if (xs.length === 0) return 0;
    return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function clamp01(x: number): number {
    return Math.max(0, Math.min(1, x));
}

// --- Default empty profile (for type-only fallbacks) -----------------------

export function getEmptyVibeMetrics(): VibeMetrics {
    return {
        mainstream: 0.5,
        modernity: 0.5,
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
