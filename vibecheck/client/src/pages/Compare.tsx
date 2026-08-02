import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { User } from '../App';
import { getVibe } from '../utils/api';
import type { VibeData } from '../utils/api';
import { calculateCompatBreakdown } from '../utils/vibe-analysis';
import type { CompatBreakdown } from '../utils/vibe-analysis';
import { getContrastTextColor, asColorRef } from '../utils/vibe-colors';
import { fadeUp, heroIn, staggerContainer, cardSpring, easeOutQuart } from '../utils/motion';
import Footer from '../components/Footer';

interface CompareProps {
  currentUser: User | null;
}

export default function Compare({ currentUser }: CompareProps) {
  const { idA, idB } = useParams<{ idA: string; idB: string }>();
  const [a, setA] = useState<VibeData | null>(null);
  const [b, setB] = useState<VibeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!idA || !idB) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
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
    if (!a?.average_features || !b?.average_features) return null;
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

  function handleShare() {
    // Same /share pattern as profile URLs — recipients get the per-pair OG
    // image preview before being redirected into the SPA.
    const url = `${window.location.origin}/share/compare/${idA}/${idB}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-white border-t-transparent mx-auto mb-4" />
          <p className="text-white/60">comparing vibes...</p>
        </div>
      </div>
    );
  }

  if (error || !a || !b || !breakdown) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <p className="text-white/60 text-lg mb-6">{error || 'no vibes to compare.'}</p>
          <Link to="/explore" className="text-[#1DB954] hover:underline font-medium">
            explore vibes →
          </Link>
        </div>
      </div>
    );
  }

  const verdict = pickVerdict(breakdown);
  const headline = pickHeadlineFeature(breakdown);

  return (
    <div className="ambient-bg min-h-screen bg-black overflow-hidden">
      <motion.div
        className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        {/* Tiny nav */}
        <motion.div variants={fadeUp} className="flex items-center justify-between mb-6">
          <Link
            to="/explore"
            className="text-white/50 hover:text-white text-sm font-medium transition-colors"
          >
            ← explore
          </Link>
          <button
            onClick={handleShare}
            className="text-white/70 hover:text-white text-sm font-medium transition-colors"
          >
            {copied ? 'link copied!' : 'share this comparison'}
          </button>
        </motion.div>

        {/* Headline — score scales in with shimmer, serif accent on % */}
        <motion.div variants={heroIn} className="text-center mb-10 sm:mb-12">
          <p className="text-white/50 text-[10px] uppercase tracking-[0.25em] mb-3">
            vibe match
          </p>
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, ease: easeOutQuart, delay: 0.15 }}
            className="text-7xl sm:text-[8rem] font-bold leading-none mb-3 shimmer-text tabular-nums tracking-tighter"
            style={{ letterSpacing: '-0.05em' }}
          >
            {breakdown.score}
            <span className="font-serif-accent italic text-white/85" style={{ fontWeight: 400 }}>
              %
            </span>
          </motion.div>
          <p className="text-white/75 text-base sm:text-lg max-w-md mx-auto">{verdict}</p>
        </motion.div>

        {/* Side-by-side cards */}
        <motion.div
          variants={fadeUp}
          className="grid grid-cols-2 gap-3 sm:gap-4 mb-8"
        >
          <CompareCard vibe={a} side="left" />
          <CompareCard vibe={b} side="right" />
        </motion.div>

        {/* Breakdown bars — glass container */}
        <motion.div variants={fadeUp} className="glass mb-8 p-5 rounded-2xl space-y-4">
          <BreakdownBar label="Vibe similarity" value={breakdown.audio} />
          <BreakdownBar label="Genre overlap" value={breakdown.genre} />
        </motion.div>

        {/* Headline feature */}
        {headline && (
          <motion.div
            variants={fadeUp}
            className="glass mb-8 px-5 py-4 rounded-2xl text-center"
          >
            <p className="text-white text-base sm:text-lg">{headline}</p>
          </motion.div>
        )}

        {/* Shared genres */}
        {breakdown.sharedGenres.length > 0 && (
          <motion.div variants={fadeUp} className="mb-8">
            <p className="text-white/50 text-xs uppercase tracking-widest mb-3 text-center">
              shared genres ({breakdown.sharedGenres.length})
            </p>
            <motion.div
              className="flex flex-wrap gap-2 justify-center"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              {breakdown.sharedGenres.slice(0, 8).map(g => (
                <motion.span
                  key={g}
                  variants={fadeUp}
                  whileHover={{ scale: 1.05, y: -1 }}
                  transition={cardSpring}
                  className="glass px-3 py-1 rounded-full text-xs font-medium text-white"
                >
                  {g}
                </motion.span>
              ))}
            </motion.div>
          </motion.div>
        )}

        {/* CTAs */}
        <motion.div
          variants={fadeUp}
          className="flex flex-col sm:flex-row gap-3 justify-center mb-12"
        >
          {currentUser && currentUser.id !== idA && currentUser.id !== idB && (
            <Link
              to={`/compare/${currentUser.id}/${idA}`}
              className="glass px-6 py-3 rounded-full font-medium text-center text-white hover:bg-white/10 transition-colors"
            >
              Compare me with {a.display_name}
            </Link>
          )}
          <Link
            to="/"
            className="px-6 py-3 rounded-full font-semibold text-center bg-[#1DB954] text-black hover:bg-[#1ed760] transition-colors shadow-[0_8px_32px_rgba(29,185,84,0.35)]"
          >
            {currentUser ? 'My Vibe' : 'Make Your Vibe'}
          </Link>
        </motion.div>

        <Footer />
      </motion.div>
    </div>
  );
}

// --- Subcomponents ---

function CompareCard({ vibe, side }: { vibe: VibeData; side: 'left' | 'right' }) {
  const gradient = vibe.vibe_gradient || 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)';
  const text = getContrastTextColor(asColorRef(vibe.average_features));
  const halo = text === '#000000' ? 'contrast-halo-dark' : 'contrast-halo-light';

  return (
    <Link
      to={`/${vibe.spotify_id}`}
      className="group relative block rounded-2xl overflow-hidden aspect-[4/5] sm:aspect-[3/4] transition-transform hover:scale-[1.02]"
      style={{ background: gradient }}
    >
      <div className="absolute inset-0 p-3 sm:p-5 flex flex-col">
        {/* Top */}
        <div className="flex items-center gap-2 sm:gap-3">
          {vibe.avatar_url ? (
            <img
              src={vibe.avatar_url}
              alt=""
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 object-cover flex-shrink-0"
              style={{ borderColor: text }}
            />
          ) : (
            <div
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold flex-shrink-0"
              style={{ background: 'rgba(0,0,0,0.25)', color: text }}
            >
              {vibe.display_name?.[0] ?? '?'}
            </div>
          )}
          <p
            className={`text-sm sm:text-base font-semibold truncate ${halo}`}
            style={{ color: text }}
          >
            {vibe.display_name}
          </p>
        </div>

        {/* Middle: vibe label */}
        <div className="flex-1 flex items-center justify-center text-center">
          <p
            className={`text-2xl sm:text-4xl font-bold leading-tight ${halo}`}
            style={{ color: text }}
          >
            {vibe.vibe_label}
          </p>
        </div>

        {/* Bottom: top genre */}
        {vibe.top_genres?.[0] && (
          <p
            className={`text-[10px] sm:text-xs uppercase tracking-widest text-center truncate ${halo}`}
            style={{ color: `${text}90` }}
          >
            {vibe.top_genres[0]}
          </p>
        )}
      </div>

      {/* Side label */}
      <div
        className={`absolute top-2 ${side === 'left' ? 'right-2' : 'left-2'} px-2 py-0.5 rounded-full text-[10px] font-bold backdrop-blur-md`}
        style={{
          background: 'rgba(0,0,0,0.35)',
          color: '#fff',
        }}
      >
        {side === 'left' ? 'A' : 'B'}
      </div>
    </Link>
  );
}

function BreakdownBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-white/60 text-sm">{label}</span>
        <span className="text-white font-semibold text-sm">{value}%</span>
      </div>
      <div className="relative h-2 w-full rounded-full bg-white/10 overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400 transition-all duration-700"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

// --- Verdict generators ---

function pickVerdict(b: CompatBreakdown): string {
  if (b.score >= 90) return 'separated at birth.';
  if (b.score >= 80) return 'serious overlap. make a joint playlist.';
  if (b.score >= 70) return 'a lot in common. you\'d share aux without fighting.';
  if (b.score >= 55) return 'some shared territory, some surprises.';
  if (b.score >= 40) return 'different lanes — but bridges exist.';
  if (b.score >= 25) return 'opposites. could go either way.';
  return 'parallel universes.';
}

function pickHeadlineFeature(b: CompatBreakdown): string | null {
  // Pick the dimension with the smallest delta (most aligned) and surface it
  // as a "you both ___" line. Skips if nothing is meaningfully close.
  const features: Array<[keyof CompatBreakdown['featureDeltas'], string, string]> = [
    ['mainstream', 'mainstream-ness', 'you both pull from the same chart territory'],
    ['modernity', 'era', 'you both live in the same musical decade'],
    ['diversity', 'breadth', 'your genre spreads basically mirror each other'],
    ['recencyShift', 'discovery rate', 'you both update your taste at the same pace'],
    ['eraSpread', 'time-range', 'you both stretch across the same eras'],
  ];

  const sorted = features
    .map(([key, _label, copy]) => ({ key, copy, delta: b.featureDeltas[key] }))
    .sort((a, c) => a.delta - c.delta);

  const top = sorted[0];
  if (!top || top.delta > 0.12) return null;
  return `${top.copy} — within ${(top.delta * 100).toFixed(0)} pts.`;
}
