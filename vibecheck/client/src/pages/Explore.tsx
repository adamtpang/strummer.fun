import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { User } from '../App';
import { getUsers, getVibe } from '../utils/api';
import type { VibeSummary, VibeLabelCount } from '../utils/api';
import { calculateLightCompatibility } from '../utils/vibe-analysis';
import { getContrastTextColor, getSubtleTextColor, asColorRef } from '../utils/vibe-colors';
import { fadeUp, staggerContainer, cardSpring } from '../utils/motion';
import Footer from '../components/Footer';

interface ExploreProps {
  currentUser: User | null;
}

type SortMode = 'recent' | 'match';

export default function Explore({ currentUser }: ExploreProps) {
  const [users, setUsers] = useState<VibeSummary[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [topLabels, setTopLabels] = useState<VibeLabelCount[]>([]);
  const [me, setMe] = useState<VibeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>(currentUser ? 'match' : 'recent');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      getUsers({ limit: 60 }),
      currentUser ? getVibe(currentUser.id) : Promise.resolve(null),
    ])
      .then(([res, mine]) => {
        if (cancelled) return;
        setUsers(res.users);
        setTotal(res.total);
        setTopLabels(res.topLabels);
        // Adapt VibeData → the subset that matches VibeSummary
        if (mine) {
          setMe({
            spotify_id: mine.spotify_id,
            display_name: mine.display_name,
            avatar_url: mine.avatar_url,
            vibe_label: mine.vibe_label,
            vibe_gradient: mine.vibe_gradient,
            average_features: mine.average_features,
            top_genres: mine.top_genres,
            updated_at: '',
          });
        }
      })
      .catch(err => {
        console.error('Explore load error:', err);
        if (!cancelled) setError('Failed to load explore feed.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  // Compute compatibility once and memoize sorted view
  const visible = useMemo(() => {
    const others = users.filter(u => u.spotify_id !== currentUser?.id);
    if (sort === 'match' && me?.average_features) {
      return others
        .map(u => ({
          user: u,
          score:
            u.average_features
              ? calculateLightCompatibility(
                  { metrics: me.average_features as any, topGenres: me.top_genres || [] },
                  { metrics: u.average_features as any, topGenres: u.top_genres || [] }
                )
              : null,
        }))
        .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    }
    return others.map(u => ({ user: u, score: null as number | null }));
  }, [users, me, sort, currentUser?.id]);

  return (
    <div className="ambient-bg min-h-screen bg-black overflow-hidden">
      <motion.div
        className="max-w-6xl mx-auto px-6 py-12"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight mb-1">
              explore <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400">vibes</span>
            </h1>
            <p className="text-white/40 text-sm">
              {currentUser
                ? sort === 'match'
                  ? 'sorted by how close their vibe is to yours'
                  : 'most recent vibes'
                : 'most recent vibes — log in to see your matches'}
            </p>
          </div>
          <Link
            to={currentUser ? `/${currentUser.id}` : '/'}
            className="text-white/60 hover:text-white text-sm font-medium transition-colors"
          >
            {currentUser ? 'my vibe →' : 'home →'}
          </Link>
        </div>

        {/* Stats badge */}
        {!loading && total > 0 && (
          <motion.div
            variants={fadeUp}
            className="glass inline-flex items-center gap-2 px-3 py-1.5 mb-6 rounded-full"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-white/80 text-xs font-medium">
              {total.toLocaleString()} {total === 1 ? 'vibe' : 'vibes'} generated
            </span>
          </motion.div>
        )}

        {/* Top vibe labels — social proof */}
        {!loading && topLabels.length > 0 && (
          <motion.div variants={fadeUp} className="mb-8">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-3">
              what people are vibing on
            </p>
            <motion.div
              className="flex flex-wrap gap-2"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              {topLabels.map(({ label, count }) => (
                <motion.div
                  key={label}
                  variants={fadeUp}
                  whileHover={{ scale: 1.05, y: -2 }}
                  transition={cardSpring}
                  className="glass inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
                >
                  <span className="text-white text-sm font-medium">{label}</span>
                  <span className="text-white/50 text-xs">{count.toLocaleString()}</span>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}

        {/* Sort toggle (only when logged-in) */}
        {currentUser && (
          <motion.div variants={fadeUp} className="flex gap-2 mb-8">
            <SortPill active={sort === 'match'} onClick={() => setSort('match')} label="matches" />
            <SortPill active={sort === 'recent'} onClick={() => setSort('recent')} label="recent" />
          </motion.div>
        )}

        {/* States */}
        {loading && <GridSkeleton />}
        {!loading && error && (
          <p className="text-white/60 text-center py-20">{error}</p>
        )}
        {!loading && !error && visible.length === 0 && (
          <motion.div variants={fadeUp} className="text-center py-20">
            <p className="text-white/60 mb-4">no vibes here yet.</p>
            <Link to="/" className="text-[#1DB954] hover:underline font-medium">
              be the first →
            </Link>
          </motion.div>
        )}

        {/* Grid */}
        {!loading && !error && visible.length > 0 && (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {visible.map(({ user, score }) => (
              <VibeCardTile key={user.spotify_id} user={user} score={score} />
            ))}
          </motion.div>
        )}

        <Footer />
      </motion.div>
    </div>
  );
}

// --- Subcomponents ---

function SortPill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
        active
          ? 'bg-white text-black'
          : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80'
      }`}
    >
      {label}
    </button>
  );
}

function VibeCardTile({ user, score }: { user: VibeSummary; score: number | null }) {
  const gradient = user.vibe_gradient || 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)';
  const ref = asColorRef(user.average_features);
  const text = getContrastTextColor(ref);
  const subtle = getSubtleTextColor(ref);
  const topGenre = user.top_genres?.[0];
  const halo = text === '#000000' ? 'contrast-halo-dark' : 'contrast-halo-light';

  return (
    <motion.div variants={fadeUp} className="rounded-2xl">
      <Link
        to={`/${user.spotify_id}`}
        className="group relative block rounded-2xl overflow-hidden aspect-[4/5] shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
        style={{ background: gradient }}
      >
        <motion.div
          className="absolute inset-0"
          whileHover={{ scale: 1.04 }}
          transition={cardSpring}
        >
          <div className="absolute inset-0" style={{ background: gradient }} />
          {/* Top-right compatibility badge — glass */}
          {score != null && (
            <div className="glass-dark absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-semibold text-white z-10">
              {score}% match
            </div>
          )}

          <div className="absolute inset-0 p-5 flex flex-col justify-between">
            {/* Top: avatar + name */}
            <div className="flex items-center gap-3">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt=""
                  className="w-10 h-10 rounded-full border-2 object-cover"
                  style={{ borderColor: text }}
                />
              ) : (
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ background: 'rgba(0,0,0,0.25)', color: text }}
                >
                  {user.display_name?.[0] ?? '?'}
                </div>
              )}
              <p
                className={`text-base font-semibold truncate ${halo}`}
                style={{ color: text }}
              >
                {user.display_name}
              </p>
            </div>

            {/* Bottom: vibe label + top genre */}
            <div>
              <p
                className={`text-2xl font-bold leading-tight mb-1 ${halo}`}
                style={{ color: text }}
              >
                {user.vibe_label}
              </p>
              {topGenre && (
                <p
                  className={`text-xs uppercase tracking-wider truncate ${halo}`}
                  style={{ color: subtle }}
                >
                  {topGenre}
                </p>
              )}
            </div>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 9 }).map((_, i) => (
        <div
          key={i}
          className="aspect-[4/5] rounded-2xl bg-white/5 animate-pulse"
        />
      ))}
    </div>
  );
}
