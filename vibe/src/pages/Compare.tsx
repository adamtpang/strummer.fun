import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { User } from '../App';
import { getVibe } from '../utils/api';
import type { VibeData } from '../utils/api';
import { calculateCompatBreakdown, isVibeMetrics } from '../utils/vibe-analysis';
import CopyLink from '../components/CopyLink';
import { comparisonPath } from '../utils/invitation';
import type { CompatBreakdown } from '../utils/vibe-analysis';
import { fadeUp, heroIn, staggerContainer, easeOutQuart } from '../utils/motion';

interface CompareProps {
  currentUser: User | null;
}

export default function Compare({ currentUser }: CompareProps) {
  const { idA, idB } = useParams<{ idA: string; idB: string }>();
  const [a, setA] = useState<VibeData | null>(null);
  const [b, setB] = useState<VibeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!idA || !idB) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setA(null);
    setB(null);
    Promise.all([getVibe(idA), getVibe(idB)])
      .then(([vibeA, vibeB]) => {
        if (cancelled) return;
        if (!vibeA || !vibeB) {
          setError('one of these people hasn\'t made their vibe yet.');
          return;
        }
        // Honor privacy: comparing-against a private profile is allowed only
        // by the owner themselves.
        if (vibeA.is_public === false && currentUser?.id !== idA) {
          setError('this comparison includes a private profile.');
          return;
        }
        if (vibeB.is_public === false && currentUser?.id !== idB) {
          setError('this comparison includes a private profile.');
          return;
        }
        setA(vibeA);
        setB(vibeB);
      })
      .catch(err => {
        console.error('Compare load error:', err);
        if (!cancelled) setError('failed to load comparison.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [idA, idB, currentUser?.id]);

  const breakdown: CompatBreakdown | null = useMemo(() => {
    if (!isVibeMetrics(a?.average_features) || !isVibeMetrics(b?.average_features) || !a?.top_genres?.length || !b?.top_genres?.length) return null;
    return calculateCompatBreakdown(
      {
        metrics: a.average_features as any,
        topGenres: a.top_genres || [],
      },
      {
        metrics: b.average_features as any,
        topGenres: b.top_genres || [],
      }
    );
  }, [a, b]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--vc-bg)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-md h-10 w-10 border-2 border-white border-t-transparent mx-auto mb-4" />
          <p className="text-white/60">comparing vibes...</p>
        </div>
      </div>
    );
  }

  if (error || !a || !b) {
    return (
      <div className="min-h-screen bg-[var(--vc-bg)] flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <h1 className="font-serif-accent text-3xl mb-4">Comparison unavailable</h1>
          <p className="text-white/60 text-lg mb-6">{error || 'no vibes to compare.'}</p>
          <Link to="/explore" className="text-[#1DB954] hover:underline font-medium">
            explore vibes →
          </Link>
        </div>
      </div>
    );
  }

  const verdict = breakdown ? pickVerdict(breakdown) : null;
  const headline = breakdown ? pickHeadlineFeature(breakdown) : null;
  const bothPublic = a.is_public !== false && b.is_public !== false;

  return (
    <div className="bg-[var(--vc-bg)]">
      <motion.div
        className="vibe-page max-w-3xl"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        <div className="vibe-page-heading">
          <div><p className="eyebrow mb-3">Common ground</p><h1>Compare vibes</h1></div>
          {bothPublic && <CopyLink url={`${window.location.origin}/vibe${comparisonPath(a.spotify_id, b.spotify_id)}`} label="Copy comparison link" />}
        </div>
        {!bothPublic && <p className="friend-note mb-6">This comparison is private. Both profiles must be published before a friend can open it. <Link className="underline" to={`/${currentUser?.id}`}>Review your profile</Link></p>}

        {/* The score, as the page's one loud block */}
        {breakdown ? <motion.div variants={heroIn} className="compare-score">
          <p className="compare-score-label">Music taste match</p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.18, ease: easeOutQuart }}
            className="compare-score-value"
          >
            {breakdown.score}%
          </motion.p>
          <p className="compare-score-verdict">{verdict}</p>
        </motion.div> : <p className="friend-note mb-8">Not enough listening data for a score yet. You can still explore each other's songs.</p>}
        {breakdown && <p className="friend-note compare-caveat">A playful similarity estimate, not a measure of personal compatibility.</p>}

        {/* The two listeners */}
        <motion.div variants={fadeUp} className="compare-people">
          <CompareCard vibe={a} />
          <CompareCard vibe={b} />
        </motion.div>

        {/* Breakdown bars — glass container */}
        {breakdown && <motion.div variants={fadeUp} className="compare-section space-y-4">
          <BreakdownBar label="Listening-pattern similarity" value={breakdown.audio} />
          <BreakdownBar label="Genre overlap" value={breakdown.genre} />
          <details className="friend-method"><summary>What goes into this score?</summary><p>70% compares six listening patterns: popularity, release era, genre diversity, changes in recent listening, artist concentration, and era spread. 30% is overlap between saved top genres. It uses saved profiles, not audio analysis or a count of identical songs.</p></details>
        </motion.div>}

        {/* What they share */}
        {(headline || (breakdown && breakdown.sharedGenres.length > 0)) && (
          <motion.div variants={fadeUp} className="compare-section">
            {headline && <p className="compare-headline">{headline}</p>}
            {breakdown && breakdown.sharedGenres.length > 0 && (
              <>
                <p className="eyebrow mb-3">Shared genres ({breakdown.sharedGenres.length})</p>
                <ul className="compare-genres">
                  {breakdown.sharedGenres.slice(0, 8).map(g => <li key={g}>{g}</li>)}
                </ul>
              </>
            )}
          </motion.div>
        )}

        {/* Next steps */}
        <motion.div variants={fadeUp} className="compare-actions">
          <Link to="/" className="profile-share-button">
            {currentUser ? 'My Vibe' : 'Make Your Vibe'}
          </Link>
          {currentUser && currentUser.id !== idA && currentUser.id !== idB && (
            <Link to={`/compare/${currentUser.id}/${idA}`} className="friend-secondary">
              Compare me with {a.display_name}
            </Link>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}

// --- Subcomponents ---

function CompareCard({ vibe }: { vibe: VibeData }) {
  // The listener's own gradient is their color; it marks the card's edge.
  const gradient = vibe.vibe_gradient || 'var(--vc-rule-2)';

  return (
    <Link to={`/${encodeURIComponent(vibe.spotify_id)}`} className="compare-person">
      <span className="compare-person-edge" style={{ background: gradient }} aria-hidden="true" />
      <span className="compare-person-who">
        {vibe.avatar_url ? (
          <img src={vibe.avatar_url} alt="" />
        ) : (
          <span className="compare-person-initial" aria-hidden="true">{vibe.display_name?.[0] ?? '?'}</span>
        )}
        <strong>{vibe.display_name}</strong>
      </span>
      <span className="compare-person-label">{vibe.vibe_label}</span>
      {vibe.top_genres?.[0] && <span className="compare-person-genre">{vibe.top_genres[0]}</span>}
      <span className="compare-person-link">Hear {vibe.display_name}'s songs</span>
    </Link>
  );
}

function BreakdownBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[var(--vc-muted)] text-sm">{label}</span>
        <span className="font-mono-stat text-sm">{value}%</span>
      </div>
      <div className="relative h-2 w-full rounded-md bg-[var(--vc-rule)] overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full rounded-md bg-[var(--studio-playing)] transition-all duration-700"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

// --- Verdict generators ---

function pickVerdict(b: CompatBreakdown): string {
  if (b.score >= 90) return 'A lot of familiar ground in your listening.';
  if (b.score >= 80) return 'Serious overlap. Make a joint playlist.';
  if (b.score >= 70) return 'A lot in common. You\'d share the aux without fighting.';
  if (b.score >= 55) return 'Some shared territory, some surprises.';
  if (b.score >= 40) return 'Different favorites. Plenty to discover.';
  if (b.score >= 25) return 'Opposites. Could go either way.';
  return 'Parallel universes.';
}

function pickHeadlineFeature(b: CompatBreakdown): string | null {
  // Pick the dimension with the smallest delta (most aligned) and surface it
  // as a "you both ___" line. Skips if nothing is meaningfully close.
  const features: Array<[keyof CompatBreakdown['featureDeltas'], string, string]> = [
    ['mainstream', 'mainstream-ness', 'You both pull from the same chart territory'],
    ['modernity', 'era', 'You both live in the same musical decade'],
    ['diversity', 'breadth', 'Your genre spreads basically mirror each other'],
    ['recencyShift', 'discovery rate', 'You both update your taste at the same pace'],
    ['eraSpread', 'time-range', 'You both stretch across the same eras'],
  ];

  const sorted = features
    .map(([key, _label, copy]) => ({ key, copy, delta: b.featureDeltas[key] }))
    .sort((a, c) => a.delta - c.delta);

  const top = sorted[0];
  if (!top || top.delta > 0.12) return null;
  return `${top.copy}, within ${(top.delta * 100).toFixed(0)} points.`;
}
