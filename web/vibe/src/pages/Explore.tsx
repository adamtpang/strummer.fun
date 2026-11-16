import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { User } from '../App';
import { getUsers, getVibe } from '../utils/api';
import type { VibeSummary, VibeLabelCount } from '../utils/api';
import { calculateLightCompatibility } from '../utils/vibe-analysis';
import { fadeUp, staggerContainer } from '../utils/motion';

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
  const viewerId = currentUser?.id;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setMe(null);

    Promise.all([
      getUsers({ limit: 60 }),
      viewerId ? getVibe(viewerId) : Promise.resolve(null),
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
  }, [viewerId]);

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
    <div className="bg-[var(--vc-bg)]">
      <motion.div
        className="vibe-page"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        <div className="vibe-page-heading">
          <div>
            <p className="eyebrow mb-3">The listening room</p>
            <h1>Explore vibes</h1>
            <p>{currentUser ? 'Find your people through the songs they love.' : 'A little window into someone else\'s world.'}</p>
          </div>
          {!loading && total > 0 && <span className="eyebrow">{total.toLocaleString()} public {total === 1 ? 'vibe' : 'vibes'}</span>}
        </div>

        {/* What the room is listening to */}
        {!loading && topLabels.length > 0 && (
          <motion.div variants={fadeUp} className="explore-labels">
            <p className="eyebrow mb-3">Most common vibes</p>
            <ul>
              {topLabels.map(({ label, count }) => (
                <li key={label}>{label}<span>{count.toLocaleString()}</span></li>
              ))}
            </ul>
          </motion.div>
        )}

        {/* Sort toggle (only when logged-in) */}
        {currentUser && (
          <motion.div variants={fadeUp} className="explore-sort" role="group" aria-label="Sort vibes">
            <SortPill active={sort === 'match'} onClick={() => setSort('match')} label="Best match" />
            <SortPill active={sort === 'recent'} onClick={() => setSort('recent')} label="Newest" />
          </motion.div>
        )}

        {/* States */}
        {loading && <GridSkeleton />}
        {!loading && error && (
          <div className="explore-empty" role="alert">
            <p>{error}</p>
            <button type="button" className="friend-secondary" onClick={() => window.location.reload()}>Try again</button>
          </div>
        )}
        {!loading && !error && visible.length === 0 && (
          <motion.div variants={fadeUp} className="explore-empty">
            <p>No public vibes yet.</p>
            <Link to="/" className="profile-share-button">{currentUser ? 'Publish yours' : 'Make the first one'}</Link>
          </motion.div>
        )}

        {/* Grid */}
        {!loading && !error && visible.length > 0 && (
          <motion.div
            className="explore-grid"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {visible.map(({ user, score }) => (
              <VibeCardTile key={user.spotify_id} user={user} score={score} />
            ))}
          </motion.div>
        )}
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
    <button type="button" onClick={onClick} aria-pressed={active} className="explore-sort-pill">
      {label}
    </button>
  );
}

function VibeCardTile({ user, score }: { user: VibeSummary; score: number | null }) {
  // The listener's own gradient is their color; it leads the tile.
  const gradient = user.vibe_gradient || 'var(--vc-rule-2)';
  const topGenre = user.top_genres?.[0];

  return (
    <motion.div variants={fadeUp} className="explore-tile-wrap">
      <Link to={`/${encodeURIComponent(user.spotify_id)}`} className="explore-tile">
        <span className="explore-tile-band" style={{ background: gradient }} aria-hidden="true" />
        <span className="explore-tile-who">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt="" />
          ) : (
            <span className="explore-tile-initial" aria-hidden="true">{user.display_name?.[0] ?? '?'}</span>
          )}
          <strong>{user.display_name}</strong>
          {score != null && <span className="explore-tile-match">{score}% match</span>}
        </span>
        <span className="explore-tile-label">{user.vibe_label}</span>
        {topGenre && <span className="explore-tile-genre">{topGenre}</span>}
      </Link>
    </motion.div>
  );
}

function GridSkeleton() {
  return (
    <div className="explore-grid" aria-busy="true" aria-label="Loading vibes">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="explore-tile explore-tile-skeleton" />
      ))}
    </div>
  );
}
