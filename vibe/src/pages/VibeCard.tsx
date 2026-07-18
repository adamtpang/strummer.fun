import { useState, useEffect, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { User } from '../App';
import {
  spotifyApiGet,
  spotifyApiPost,
  spotifyApiPut,
  spotifyApiPutImage,
  SpotifyApiError,
} from '../utils/spotify-api';
import { createVibeProfile, calculateLightCompatibility } from '../utils/vibe-analysis';
import { getVibeLabel } from '../utils/vibe-labels';
import { getVibeGradient, getContrastTextColor, getSubtleTextColor } from '../utils/vibe-colors';
import { saveVibe, getVibe, getUsers, updatePrivacy, deleteVibe } from '../utils/api';
import type { VibeData, VibeSummary } from '../utils/api';
import StoryGenerator from '../components/StoryGenerator';
import Footer from '../components/Footer';
import { fadeUp, heroIn, staggerContainer, cardSpring } from '../utils/motion';
import { generatePlaylistCover } from '../utils/playlist-cover';

interface VibeCardProps {
  currentUser: User | null;
  setUser: (user: User | null) => void;
}

export default function VibeCard({ currentUser, setUser }: VibeCardProps) {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [vibeData, setVibeData] = useState<VibeData | null>(null);
  const [viewerVibe, setViewerVibe] = useState<VibeData | null>(null);
  const [showStory, setShowStory] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playlistError, setPlaylistError] = useState(false);
  const [playlistCreating, setPlaylistCreating] = useState(false);
  // Track URIs + cover params stashed by the latest generateVibe, so the
  // opt-in "Save as Spotify playlist" button can build the playlist without
  // recomputing. Null until a generation runs; the handler re-fetches if so.
  const [playlistSource, setPlaylistSource] = useState<{
    uris: string[];
    gradient: string;
    label: string;
    textColor: '#ffffff' | '#000000';
  } | null>(null);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [twins, setTwins] = useState<Array<{ user: VibeSummary; score: number }>>([]);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [nowPlaying, setNowPlaying] = useState<{
    name: string;
    artist: string;
    albumArt: string | null;
    url: string;
    isPlaying: boolean;
  } | null>(null);
  const [recentlyPlayed, setRecentlyPlayed] = useState<Array<{
    name: string;
    artist: string;
    albumArt: string | null;
    url: string;
    playedAt: string;
  }>>([]);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [libraryStats, setLibraryStats] = useState<{ tracks: number; albums: number } | null>(null);

  // Time-range switcher state — owner-only. The active tab triggers a
  // fresh fetch of top tracks + artists for that range, cached per range.
  type TimeRange = 'short_term' | 'medium_term' | 'long_term';
  const [timeRange, setTimeRange] = useState<TimeRange | null>(null);
  const [rangeData, setRangeData] = useState<Record<TimeRange, { tracks: any[]; artists: any[] } | undefined>>({
    short_term: undefined,
    medium_term: undefined,
    long_term: undefined,
  });
  const [rangeLoading, setRangeLoading] = useState(false);

  const isOwner = currentUser?.id === userId;
  // Treat undefined is_public as public — pre-migration rows lack the field.
  const isPrivate = vibeData?.is_public === false;

  useEffect(() => {
    loadVibe();
  }, [userId]);

  // When viewing someone else's profile while logged in, fetch our own
  // saved vibe so we can compute a compatibility score on the client.
  useEffect(() => {
    if (isOwner || !currentUser) {
      setViewerVibe(null);
      return;
    }
    let cancelled = false;
    getVibe(currentUser.id)
      .then(v => {
        if (!cancelled) setViewerVibe(v);
      })
      .catch(err => console.error('Viewer vibe fetch failed:', err));
    return () => {
      cancelled = true;
    };
  }, [isOwner, currentUser?.id]);

  const compatibilityScore = useMemo(() => {
    if (!vibeData?.average_features || !viewerVibe?.average_features) return null;
    return calculateLightCompatibility(
      {
        metrics: viewerVibe.average_features as any,
        topGenres: viewerVibe.top_genres || [],
      },
      {
        metrics: vibeData.average_features as any,
        topGenres: vibeData.top_genres || [],
      }
    );
  }, [viewerVibe, vibeData]);

  // Owner-only: live "now playing" + "recently played" feeds. Fetched
  // on mount, polled gently for now-playing every 30s. Tokens minted before
  // v2.14 lack these scopes, so 403/401 quietly trips needsReconnect instead
  // of breaking the whole card.
  useEffect(() => {
    if (!isOwner || !localStorage.getItem('access_token')) return;
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    async function fetchNowPlaying() {
      try {
        const res = await spotifyApiGet('https://api.spotify.com/v1/me/player/currently-playing');
        if (cancelled) return;
        // Spotify returns 204/empty when nothing is playing — parseOrThrow
        // gives us {} in that case.
        if (!res || !res.item) {
          setNowPlaying(null);
          return;
        }
        const item = res.item;
        setNowPlaying({
          name: item.name,
          artist: (item.artists || []).map((a: any) => a.name).join(', '),
          albumArt: item.album?.images?.[1]?.url || item.album?.images?.[0]?.url || null,
          url: item.external_urls?.spotify || `https://open.spotify.com/track/${item.id}`,
          isPlaying: !!res.is_playing,
        });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof SpotifyApiError && (err.status === 401 || err.status === 403)) {
          setNeedsReconnect(true);
        }
        setNowPlaying(null);
      }
    }

    async function fetchRecentlyPlayed() {
      try {
        const res = await spotifyApiGet('https://api.spotify.com/v1/me/player/recently-played?limit=10');
        if (cancelled) return;
        const items = res?.items || [];
        setRecentlyPlayed(
          items.map((it: any) => ({
            name: it.track?.name,
            artist: (it.track?.artists || []).map((a: any) => a.name).join(', '),
            albumArt: it.track?.album?.images?.[2]?.url || it.track?.album?.images?.[0]?.url || null,
            url: it.track?.external_urls?.spotify || '#',
            playedAt: it.played_at,
          })).filter((t: any) => t.name)
        );
      } catch (err) {
        if (cancelled) return;
        if (err instanceof SpotifyApiError && (err.status === 401 || err.status === 403)) {
          setNeedsReconnect(true);
        }
        setRecentlyPlayed([]);
      }
    }

    async function fetchLibraryStats() {
      try {
        const [tracks, albums] = await Promise.all([
          spotifyApiGet('https://api.spotify.com/v1/me/tracks?limit=1'),
          spotifyApiGet('https://api.spotify.com/v1/me/albums?limit=1'),
        ]);
        if (cancelled) return;
        setLibraryStats({
          tracks: tracks?.total ?? 0,
          albums: albums?.total ?? 0,
        });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof SpotifyApiError && (err.status === 401 || err.status === 403)) {
          setNeedsReconnect(true);
        }
      }
    }

    fetchNowPlaying();
    fetchRecentlyPlayed();
    fetchLibraryStats();
    // Poll now-playing every 30s; recently-played + library are fetched once.
    interval = setInterval(fetchNowPlaying, 30000);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [isOwner, userId]);

  // Time-range tab handler — fetches the selected range on first activation
  // and caches it. Subsequent toggles between tabs are instant.
  async function handleTimeRange(range: TimeRange) {
    setTimeRange(range);
    if (rangeData[range]) return; // already cached
    setRangeLoading(true);
    try {
      const [tracksRes, artistsRes] = await Promise.all([
        spotifyApiGet(`https://api.spotify.com/v1/me/top/tracks?time_range=${range}&limit=20`),
        spotifyApiGet(`https://api.spotify.com/v1/me/top/artists?time_range=${range}&limit=12`),
      ]);
      const tracks = (tracksRes.items || []).map((t: any) => ({
        name: t.name,
        artist: (t.artists || []).map((a: any) => a.name).join(', '),
        albumArt: t.album?.images?.[1]?.url || t.album?.images?.[0]?.url || '',
        uri: t.uri,
        url: t.external_urls?.spotify,
      }));
      const artists = (artistsRes.items || []).map((a: any) => ({
        id: a.id,
        name: a.name,
        image: a.images?.find((img: any) => img.width <= 320)?.url || a.images?.[0]?.url || null,
        genres: a.genres || [],
        url: a.external_urls?.spotify || `https://open.spotify.com/artist/${a.id}`,
      }));
      setRangeData(prev => ({ ...prev, [range]: { tracks, artists } }));
    } catch (err) {
      console.error('Time-range fetch failed:', err);
    } finally {
      setRangeLoading(false);
    }
  }

  // Vibe twins: top 3 most-compatible public users for the owner's view.
  // Skipped for visitors — the compat panel above already serves that role.
  useEffect(() => {
    if (!isOwner || !vibeData?.average_features) return;
    let cancelled = false;
    getUsers({ limit: 100 })
      .then(({ users }) => {
        if (cancelled) return;
        const ranked = users
          .filter(u => u.spotify_id !== userId && u.average_features)
          .map(u => ({
            user: u,
            score: calculateLightCompatibility(
              {
                metrics: vibeData.average_features as any,
                topGenres: vibeData.top_genres || [],
              },
              {
                metrics: u.average_features as any,
                topGenres: u.top_genres || [],
              }
            ),
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);
        setTwins(ranked);
      })
      .catch(err => console.error('Vibe twins fetch failed:', err));
    return () => {
      cancelled = true;
    };
  }, [isOwner, userId, vibeData?.average_features, vibeData?.top_genres]);

  async function loadVibe() {
    if (!userId) return;
    setLoading(true);
    setError(null);

    try {
      // Try loading from DB first
      const saved = await getVibe(userId);

      if (saved && saved.vibe_label) {
        setVibeData(saved);
        setLoading(false);

        // If owner, also generate fresh in background
        if (isOwner && localStorage.getItem('access_token')) {
          generateVibe(true);
        }
        return;
      }

      // No saved data — if owner, generate it
      if (isOwner && localStorage.getItem('access_token')) {
        await generateVibe(false);
      } else {
        setError('This person hasn\'t created their vibe yet.');
        setLoading(false);
      }
    } catch {
      setError('Failed to load vibe. Try again.');
      setLoading(false);
    }
  }

  async function generateVibe(background: boolean) {
    if (!currentUser || !userId) return;
    if (!background) setGenerating(true);

    try {
      // Fetch top tracks AND top artists from all time periods in parallel.
      // Top artists give us photos + richer genre signal than what we derive
      // from track metadata, and unlock the "Top Artists" section on the card.
      const [shortTerm, mediumTerm, longTerm, artistsShort, artistsMedium, artistsLong] = await Promise.all([
        spotifyApiGet('https://api.spotify.com/v1/me/top/tracks?time_range=short_term&limit=50'),
        spotifyApiGet('https://api.spotify.com/v1/me/top/tracks?time_range=medium_term&limit=50'),
        spotifyApiGet('https://api.spotify.com/v1/me/top/tracks?time_range=long_term&limit=50'),
        spotifyApiGet('https://api.spotify.com/v1/me/top/artists?time_range=short_term&limit=50'),
        spotifyApiGet('https://api.spotify.com/v1/me/top/artists?time_range=medium_term&limit=50'),
        spotifyApiGet('https://api.spotify.com/v1/me/top/artists?time_range=long_term&limit=50'),
      ]);

      // Weighted scoring (same shape for tracks and artists)
      const trackScores = new Map<string, number>();
      const trackDetails = new Map<string, any>();
      const weights: Record<string, number> = { short_term: 100, medium_term: 50, long_term: 25 };

      [
        { tracks: shortTerm.items || [], label: 'short_term' },
        { tracks: mediumTerm.items || [], label: 'medium_term' },
        { tracks: longTerm.items || [], label: 'long_term' },
      ].forEach(({ tracks, label }) => {
        tracks.forEach((track: any, index: number) => {
          const uri = track.uri;
          const score = (tracks.length - index) * weights[label];
          trackScores.set(uri, (trackScores.get(uri) || 0) + score);
          if (!trackDetails.has(uri)) trackDetails.set(uri, track);
        });
      });

      const sortedTracks = Array.from(trackScores.entries())
        .sort(([, a], [, b]) => b - a)
        .map(([uri]) => trackDetails.get(uri));

      // Same weighted-aggregate trick for artists
      const artistScores = new Map<string, number>();
      const artistDetails = new Map<string, any>();
      [
        { artists: artistsShort.items || [], label: 'short_term' },
        { artists: artistsMedium.items || [], label: 'medium_term' },
        { artists: artistsLong.items || [], label: 'long_term' },
      ].forEach(({ artists, label }) => {
        artists.forEach((artist: any, index: number) => {
          const id = artist.id;
          const score = (artists.length - index) * weights[label];
          artistScores.set(id, (artistScores.get(id) || 0) + score);
          if (!artistDetails.has(id)) artistDetails.set(id, artist);
        });
      });
      const topArtistsRaw = Array.from(artistScores.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 12)
        .map(([id]) => artistDetails.get(id));
      const topArtists = topArtistsRaw.map((a: any) => ({
        id: a.id,
        name: a.name,
        // 320x320 if available, else the largest provided (Spotify gives 640/320/160)
        image: a.images?.find((img: any) => img.width <= 320)?.url || a.images?.[0]?.url || null,
        genres: a.genres || [],
        popularity: a.popularity ?? 0,
        url: a.external_urls?.spotify || `https://open.spotify.com/artist/${a.id}`,
      }));

      if (sortedTracks.length === 0) {
        setError('No listening history found. Listen to some music on Spotify first!');
        setGenerating(false);
        setLoading(false);
        return;
      }

      // Build the vibe profile from metadata (no /audio-features — Spotify
      // revoked it for our app). Pass the raw responses we need: combined
      // top tracks, combined top artists (with genres), and the short/long
      // term track ID lists for recency-shift calculation.
      const shortIds = (shortTerm.items || []).map((t: any) => t.id).filter(Boolean);
      const longIds = (longTerm.items || []).map((t: any) => t.id).filter(Boolean);
      const profile = createVibeProfile({
        userId: currentUser.id,
        displayName: currentUser.display_name,
        tracks: sortedTracks,
        artists: topArtistsRaw,
        shortTermTrackIds: shortIds,
        longTermTrackIds: longIds,
      });

      // Generate vibe label and gradient from the new metrics
      const vibeLabel = getVibeLabel(profile.metrics);
      const gradient = getVibeGradient(profile.metrics);

      // Playlist creation is now opt-in (the "Save as Spotify playlist" button)
      // rather than an automatic write to the user's account on every generate.
      // Stash what that action needs; keep any playlist we already made.
      const playlistId = currentUser.playlistId || null;
      setPlaylistSource({
        uris: sortedTracks.slice(0, 100).map((t: any) => t.uri).filter(Boolean),
        gradient: gradient.css,
        label: `${vibeLabel.emoji} ${vibeLabel.label}`,
        textColor: getContrastTextColor(profile.metrics) === '#000000' ? '#000000' : '#ffffff',
      });

      // Top 5 tracks for display (with album art)
      const top5 = sortedTracks.slice(0, 5).map((t: any) => ({
        name: t.name,
        artist: t.artists.map((a: any) => a.name).join(', '),
        albumArt: t.album?.images?.[1]?.url || t.album?.images?.[0]?.url || '',
        uri: t.uri,
      }));

      const data: VibeData = {
        spotify_id: currentUser.id,
        display_name: currentUser.display_name,
        avatar_url: currentUser.avatar_url || null,
        playlist_id: playlistId || null,
        vibe_label: `${vibeLabel.emoji} ${vibeLabel.label}`,
        vibe_gradient: gradient.css,
        // average_features now stores VibeMetrics (mainstream/modernity/...).
        // The DB column is JSONB so the shape change is invisible to Postgres.
        average_features: profile.metrics as any,
        top_tracks: top5,
        top_genres: profile.topGenres,
        top_artists: topArtists,
      };

      setVibeData(data);

      // Update user
      const updatedUser = { ...currentUser, playlistId: playlistId || undefined };
      setUser(updatedUser);
      localStorage.setItem('user_data', JSON.stringify(updatedUser));

      // Save to DB
      await saveVibe(data);
    } catch (err) {
      console.error('Generate vibe error:', err);
      if (!background) {
        // If token is invalid, clear session and redirect to login
        if (String(err).includes('Authentication failed') || String(err).includes('No valid access token')) {
          localStorage.clear();
          setUser(null);
          navigate('/');
          return;
        }
        // Surface specific Spotify error if any — otherwise generic fallback.
        if (err instanceof SpotifyApiError) {
          setError(`Spotify error on ${err.endpoint} (${err.status}): ${err.spotifyMessage}`);
        } else {
          setError('Failed to generate your vibe. Try refreshing.');
        }
      }
    } finally {
      setGenerating(false);
      setLoading(false);
    }
  }

  // Opt-in: build (or refresh) the "vibecheck.style" playlist on the user's
  // own Spotify account. Only runs when they click the button — generating a
  // vibe no longer writes to their account automatically.
  async function createSpotifyPlaylist() {
    if (!currentUser || !vibeData || playlistCreating) return;
    setPlaylistCreating(true);
    setPlaylistError(false);
    try {
      // Prefer URIs from the latest generation; otherwise pull the user's
      // top tracks now so a page loaded straight from a saved vibe still works.
      let source = playlistSource;
      if (!source || source.uris.length === 0) {
        const top = await spotifyApiGet(
          'https://api.spotify.com/v1/me/top/tracks?time_range=medium_term&limit=50'
        );
        source = {
          uris: (top.items || []).map((t: any) => t.uri).filter(Boolean),
          gradient: vibeData.vibe_gradient || '',
          label: vibeData.vibe_label || 'vibecheck.style',
          textColor: '#ffffff' as const,
        };
      }
      if (source.uris.length === 0) {
        setPlaylistError(true);
        return;
      }

      const playlistName = 'vibecheck.style';
      const playlistDescription = `${currentUser.display_name}'s music vibe — ${source.label}`;
      let playlistId = currentUser.playlistId || null;

      // Validate a cached playlist still exists (users delete them manually).
      if (playlistId) {
        try {
          await spotifyApiGet(`https://api.spotify.com/v1/playlists/${playlistId}?fields=id`);
        } catch {
          playlistId = null;
        }
      }
      // Reuse one we previously made before creating a duplicate.
      if (!playlistId) {
        const list = await spotifyApiGet('https://api.spotify.com/v1/me/playlists?limit=50');
        const existing = (list.items || []).find(
          (p: any) => p.name === playlistName && p.owner?.id === currentUser.id
        );
        if (existing) playlistId = existing.id;
      }
      if (!playlistId) {
        const playlist = await spotifyApiPost(
          `https://api.spotify.com/v1/users/${currentUser.id}/playlists`,
          { name: playlistName, description: playlistDescription, public: false }
        );
        playlistId = playlist.id;
      }

      // Replace tracks (PUT replaces; Spotify caps at 100 URIs).
      await spotifyApiPut(
        `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
        { uris: source.uris }
      );
      try {
        await spotifyApiPut(
          `https://api.spotify.com/v1/playlists/${playlistId}`,
          { name: playlistName, description: playlistDescription }
        );
      } catch (descErr) {
        console.warn('Playlist description update failed (non-fatal):', descErr);
      }

      // Custom cover — non-fatal on failure.
      try {
        const cover = await generatePlaylistCover({
          gradient: source.gradient,
          vibeLabel: source.label,
          textColor: source.textColor,
        });
        await spotifyApiPutImage(
          `https://api.spotify.com/v1/playlists/${playlistId}/images`,
          cover
        );
      } catch (coverErr) {
        if (coverErr instanceof SpotifyApiError && coverErr.status === 403) {
          setNeedsReconnect(true);
        } else {
          console.warn('Cover upload failed (non-fatal):', coverErr);
        }
      }

      // Persist the playlist id on the vibe + user session.
      const updated = { ...vibeData, playlist_id: playlistId };
      setVibeData(updated);
      const updatedUser = { ...currentUser, playlistId: playlistId || undefined };
      setUser(updatedUser);
      localStorage.setItem('user_data', JSON.stringify(updatedUser));
      try {
        await saveVibe(updated);
      } catch (saveErr) {
        console.warn('Saving playlist id failed (non-fatal):', saveErr);
      }
    } catch (err) {
      console.error('Playlist creation failed:', err);
      setPlaylistError(true);
    } finally {
      setPlaylistCreating(false);
    }
  }

  function handleShare() {
    // Copy the /share/:id URL so social platforms (Twitter/Discord/iMessage)
    // hit the OG-tagged HTML and render a per-user preview. Humans get
    // redirected to /:id transparently.
    const url = `${window.location.origin}/vibe/share/${userId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleTogglePrivacy() {
    if (!vibeData || !currentUser || savingPrivacy) return;
    const next = isPrivate; // current is private → make public, and vice-versa
    setSavingPrivacy(true);
    // Optimistic update — flip the local state immediately, revert on error.
    setVibeData({ ...vibeData, is_public: next });
    try {
      await updatePrivacy(currentUser.id, currentUser.display_name, next);
    } catch (err) {
      console.error('Privacy update failed:', err);
      setVibeData({ ...vibeData, is_public: !next });
    } finally {
      setSavingPrivacy(false);
    }
  }

  function handleLogout() {
    localStorage.clear();
    setUser(null);
    navigate('/');
  }

  // Same flow as logout — clears the token so the next sign-in produces one
  // with the v2.14 scopes. We redirect home where the standard OAuth flow
  // takes over.
  function handleReconnect() {
    localStorage.clear();
    setUser(null);
    navigate('/');
  }

  async function handleDelete() {
    if (!currentUser || deleting) return;
    setDeleting(true);
    try {
      await deleteVibe(currentUser.id);
      // Wipe local session too — there's no profile left to come back to.
      localStorage.clear();
      setUser(null);
      navigate('/');
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Failed to delete your vibe. Please try again or email adamtpang@gmail.com.');
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  // --- Loading State ---
  if (loading && !vibeData) {
    return (
      <div className="min-h-screen bg-[#0a0908] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-white border-t-transparent mx-auto mb-4" />
          <p className="text-white/60">{generating ? 'Analyzing your music...' : 'Loading vibe...'}</p>
        </div>
      </div>
    );
  }

  // --- Error State ---
  if (error && !vibeData) {
    return (
      <div className="ambient-bg min-h-screen bg-[#0a0908] flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <p className="text-white/70 text-lg mb-6">{error}</p>
          <div className="flex items-center justify-center gap-3">
            {isOwner && (
              <button
                onClick={() => loadVibe()}
                disabled={loading || generating}
                className="rounded-full bg-white/10 hover:bg-white/15 px-5 py-2.5 text-sm font-medium text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-50"
              >
                {loading || generating ? 'Trying…' : 'Try again'}
              </button>
            )}
            <a
              href="/vibe"
              className="rounded-full bg-[#1DB954] hover:bg-[#1ed760] px-5 py-2.5 text-sm font-semibold text-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1DB954] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0908]"
            >
              {isOwner ? 'Back home' : 'Create your vibe'}
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!vibeData) return null;

  // --- Private profile gate (visitor view only) ---
  if (!isOwner && isPrivate) {
    return (
      <div className="min-h-screen bg-[#0a0908] flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-3xl font-bold text-white mb-2">private vibe</h1>
          <p className="text-white/50 text-lg mb-8">
            this person hasn't made their vibe discoverable.
          </p>
          <Link
            to={currentUser ? `/${currentUser.id}` : '/'}
            className="inline-block bg-[#1DB954] text-black px-8 py-3 rounded-full font-semibold hover:bg-[#1ed760] transition-colors"
          >
            {currentUser ? 'Back to My Vibe' : 'Create Your Own'}
          </Link>
        </div>
      </div>
    );
  }

  // --- Parse data ---
  const features = (vibeData.average_features || {}) as any;
  const gradient = vibeData.vibe_gradient || 'linear-gradient(135deg, #1a1816, #211e1b, #121110)';
  // Detect new metric shape vs legacy audio-features shape
  const isNewMetrics = features.mainstream != null;
  const colorRef = isNewMetrics
    ? (features as any)
    : { mainstream: features.valence ?? 0.5, modernity: features.energy ?? 0.5 };
  const textColor = getContrastTextColor(colorRef as any);
  const subtleColor = getSubtleTextColor(colorRef as any);
  // When a time-range tab is active (owner only), swap in that range's
  // freshly-fetched data; otherwise show the aggregated saved data.
  const activeRange = isOwner && timeRange ? rangeData[timeRange] : null;
  const topTracks = activeRange?.tracks ?? vibeData.top_tracks ?? [];
  const topGenres = vibeData.top_genres || [];
  const topArtists = activeRange?.artists ?? vibeData.top_artists ?? [];

  // Meters reflect the v2.16 vibe model (mainstream / modernity / diversity / activity).
  // Legacy rows (pre-v2.16) fall back to whatever audio-feature numbers they have
  // so old saved cards don't render with all-zero bars.
  const meters = isNewMetrics
    ? [
        { label: 'Mainstream', value: features.mainstream ?? 0 },
        { label: 'Modern', value: features.modernity ?? 0 },
        { label: 'Eclectic', value: features.diversity ?? 0 },
        { label: 'Discovery', value: features.recencyShift ?? 0 },
      ]
    : [
        { label: 'Energy', value: features.energy ?? 0 },
        { label: 'Mood', value: features.valence ?? 0 },
        { label: 'Dance', value: features.danceability ?? 0 },
        { label: 'Acoustic', value: features.acousticness ?? 0 },
      ];

  // Halo class for text rendered directly over the vibe gradient — keeps it
  // legible regardless of where the gradient passes through tones close to
  // the chosen text color.
  const haloClass = textColor === '#000000' ? 'contrast-halo-dark' : 'contrast-halo-light';

  return (
    <div className="min-h-screen" style={{ background: gradient }}>
      <motion.div
        className="max-w-lg mx-auto px-6 py-12"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >

        {/* Now Playing — owner only, shows a live pulsing pill at the top */}
        {isOwner && nowPlaying && nowPlaying.isPlaying && (
          <motion.a
            variants={fadeUp}
            href={nowPlaying.url}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.99 }}
            transition={cardSpring}
            className="glass-dark flex items-center gap-3 mb-6 p-3 rounded-2xl"
          >
            {nowPlaying.albumArt && (
              <img
                src={nowPlaying.albumArt}
                alt=""
                className="w-12 h-12 rounded-lg flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#1DB954' }} />
                  <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: '#1DB954' }} />
                </span>
                <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: subtleColor }}>
                  now playing
                </span>
              </div>
              <p className="text-sm font-semibold truncate" style={{ color: textColor }}>
                {nowPlaying.name}
              </p>
              <p className="text-xs truncate" style={{ color: subtleColor }}>
                {nowPlaying.artist}
              </p>
            </div>
          </motion.a>
        )}

        {/* Header */}
        <motion.div variants={fadeUp} className="text-center mb-10">
          {vibeData.avatar_url && (
            <motion.img
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              src={vibeData.avatar_url}
              alt=""
              className="w-20 h-20 rounded-full mx-auto mb-4 border-2 shadow-[0_8px_24px_rgba(0,0,0,0.3)]"
              style={{ borderColor: textColor }}
            />
          )}
          <h1
            className={`text-3xl sm:text-4xl font-bold mb-1.5 tracking-tight ${haloClass}`}
            style={{ color: textColor, letterSpacing: '-0.02em' }}
          >
            {vibeData.display_name}
          </h1>
          <p
            className={`text-[10px] uppercase tracking-[0.25em] ${haloClass}`}
            style={{ color: subtleColor }}
          >
            vibecheck.style
          </p>
        </motion.div>

        {/* Vibe Label — the hero, tighter typography */}
        <motion.div variants={heroIn} className="text-center mb-12">
          <div
            className={`text-4xl sm:text-5xl font-bold leading-[1.05] tracking-tighter ${haloClass}`}
            style={{ color: textColor, letterSpacing: '-0.04em' }}
          >
            {vibeData.vibe_label}
          </div>
          {topGenres.length > 0 && (
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="flex flex-wrap justify-center gap-2 mt-4"
            >
              {topGenres.slice(0, 4).map((genre) => (
                <motion.span
                  key={genre}
                  variants={fadeUp}
                  whileHover={{ scale: 1.05, y: -1 }}
                  transition={cardSpring}
                  className="px-3 py-1 rounded-full text-xs font-medium"
                  style={{
                    background: `${textColor}15`,
                    color: textColor,
                    border: `1px solid ${textColor}30`,
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                  }}
                >
                  {genre}
                </motion.span>
              ))}
            </motion.div>
          )}
        </motion.div>

        {/* Compatibility (only when logged-in viewer is looking at someone else) */}
        {!isOwner && currentUser && compatibilityScore != null && (
          <motion.div variants={fadeUp}>
          <Link
            to={`/compare/${currentUser.id}/${userId}`}
            className="block mb-10 rounded-2xl p-5 text-center transition-transform hover:scale-[1.02]"
            style={{
              background: `${textColor}10`,
              border: `1px solid ${textColor}20`,
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
          >
            <p className="text-xs uppercase tracking-widest mb-2" style={{ color: subtleColor }}>
              your vibe match
            </p>
            <p className="text-5xl font-bold mb-1" style={{ color: textColor }}>
              {compatibilityScore}%
            </p>
            <p className="text-sm mb-2" style={{ color: subtleColor }}>
              {compatibilityScore >= 85
                ? 'you two are basically the same person'
                : compatibilityScore >= 70
                ? 'serious overlap — make a joint playlist'
                : compatibilityScore >= 50
                ? 'some shared territory'
                : 'opposites attract'}
            </p>
            <p className="text-xs font-medium" style={{ color: textColor }}>
              see full breakdown →
            </p>
          </Link>
          </motion.div>
        )}

        {/* Mood Meters — bars animate to height on first reveal */}
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-4 gap-3 mb-10"
        >
          {meters.map(({ label, value }) => (
            <motion.div key={label} variants={fadeUp} className="text-center">
              <div
                className="relative h-24 w-full rounded-xl overflow-hidden mb-2"
                style={{
                  background: `${textColor}10`,
                  border: `1px solid ${textColor}15`,
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                }}
              >
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.round(value * 100)}%` }}
                  transition={{ duration: 0.9, ease: [0.165, 0.84, 0.44, 1], delay: 0.15 }}
                  className="absolute bottom-0 w-full rounded-xl"
                  style={{ background: `${textColor}30` }}
                />
                <span
                  className={`absolute inset-0 flex items-center justify-center text-lg font-semibold tabular-nums ${haloClass}`}
                  style={{ color: textColor, letterSpacing: '-0.02em' }}
                >
                  {Math.round(value * 100)}
                </span>
              </div>
              <span
                className={`text-[10px] uppercase tracking-[0.18em] ${haloClass}`}
                style={{ color: subtleColor }}
              >
                {label}
              </span>
            </motion.div>
          ))}
        </motion.div>

        {/* Library stats — owner only, two compact stat cards */}
        {isOwner && libraryStats && (libraryStats.tracks > 0 || libraryStats.albums > 0) && (
          <motion.div variants={fadeUp} className="grid grid-cols-2 gap-3 mb-10">
            {[
              { label: 'Saved Songs', value: libraryStats.tracks },
              { label: 'Saved Albums', value: libraryStats.albums },
            ].map(stat => (
              <div
                key={stat.label}
                className="rounded-xl p-4 text-center"
                style={{
                  background: `${textColor}08`,
                  border: `1px solid ${textColor}15`,
                  backdropFilter: 'blur(14px)',
                  WebkitBackdropFilter: 'blur(14px)',
                }}
              >
                <div
                  className={`text-3xl font-semibold tabular-nums ${haloClass}`}
                  style={{ color: textColor, letterSpacing: '-0.02em' }}
                >
                  {stat.value.toLocaleString()}
                </div>
                <div
                  className={`text-[10px] uppercase tracking-[0.18em] mt-1 ${haloClass}`}
                  style={{ color: subtleColor }}
                >
                  {stat.label}
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Time-range tabs (owner only) — toggle which range's top tracks
            and artists render below. Defaults off (shows aggregated). */}
        {isOwner && (
          <motion.div
            variants={fadeUp}
            className="flex items-center gap-1.5 mb-6 justify-center flex-wrap"
          >
            <span
              className="text-[10px] uppercase tracking-[0.2em] mr-2"
              style={{ color: subtleColor }}
            >
              View
            </span>
            {(
              [
                { key: null, label: 'My Vibe' },
                { key: 'short_term' as TimeRange, label: '4 Weeks' },
                { key: 'medium_term' as TimeRange, label: '6 Months' },
                { key: 'long_term' as TimeRange, label: 'All Time' },
              ]
            ).map(opt => {
              const active = timeRange === opt.key;
              return (
                <button
                  key={opt.label}
                  onClick={() => (opt.key ? handleTimeRange(opt.key) : setTimeRange(null))}
                  disabled={rangeLoading}
                  className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all disabled:opacity-50 ${haloClass}`}
                  style={{
                    background: active ? textColor : `${textColor}12`,
                    color: active ? (gradient.includes('hsl') ? '#000' : '#fff') : textColor,
                    border: `1px solid ${textColor}25`,
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </motion.div>
        )}

        {/* Top 5 Tracks */}
        {topTracks.length > 0 && (
          <motion.div
            variants={fadeUp}
            className="mb-10 p-5 rounded-2xl"
            style={{
              background: `${textColor}08`,
              border: `1px solid ${textColor}15`,
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            }}
          >
            <h2 className="text-sm uppercase tracking-widest mb-4" style={{ color: subtleColor }}>
              Top Tracks
            </h2>
            <div className="space-y-3">
              {topTracks.map((track: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-lg font-bold w-6" style={{ color: `${textColor}40` }}>
                    {i + 1}
                  </span>
                  {track.albumArt && (
                    <img src={track.albumArt} alt="" className="w-12 h-12 rounded" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate" style={{ color: textColor }}>
                      {track.name}
                    </p>
                    <p className="text-sm truncate" style={{ color: subtleColor }}>
                      {track.artist}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Top Artists */}
        {topArtists.length > 0 && (
          <motion.div
            variants={fadeUp}
            className="mb-10 p-5 rounded-2xl"
            style={{
              background: `${textColor}08`,
              border: `1px solid ${textColor}15`,
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            }}
          >
            <h2 className="text-sm uppercase tracking-widest mb-4" style={{ color: subtleColor }}>
              Top Artists
            </h2>
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
              {topArtists.slice(0, 10).map((artist, i) => (
                <a
                  key={artist.id}
                  href={artist.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block text-center"
                  title={artist.genres?.slice(0, 3).join(', ') || ''}
                >
                  <div className="relative">
                    {artist.image ? (
                      <img
                        src={artist.image}
                        alt={artist.name}
                        className="w-full aspect-square rounded-full object-cover mb-2 transition-transform group-hover:scale-105"
                        style={{ border: `2px solid ${textColor}20` }}
                      />
                    ) : (
                      <div
                        className="w-full aspect-square rounded-full mb-2 flex items-center justify-center text-xl font-bold"
                        style={{ background: `${textColor}15`, color: textColor }}
                      >
                        {artist.name?.[0] ?? '?'}
                      </div>
                    )}
                    <span
                      className="absolute -top-1 -left-1 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{
                        background: `${textColor}`,
                        color: gradient.includes('hsl') ? '#000' : '#fff',
                      }}
                    >
                      {i + 1}
                    </span>
                  </div>
                  <p
                    className="text-xs font-semibold truncate leading-tight"
                    style={{ color: textColor }}
                  >
                    {artist.name}
                  </p>
                </a>
              ))}
            </div>
          </motion.div>
        )}

        {/* Recently Played (owner only) — last 10 tracks scrobbled to Spotify */}
        {isOwner && recentlyPlayed.length > 0 && (
          <motion.div
            variants={fadeUp}
            className="mb-10 p-5 rounded-2xl"
            style={{
              background: `${textColor}08`,
              border: `1px solid ${textColor}15`,
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            }}
          >
            <h2 className="text-sm uppercase tracking-widest mb-4" style={{ color: subtleColor }}>
              Recently Played
            </h2>
            <div className="space-y-2">
              {recentlyPlayed.slice(0, 6).map((track, i) => (
                <a
                  key={`${track.url}-${i}`}
                  href={track.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-2 rounded-lg transition-colors hover:bg-white/5"
                >
                  {track.albumArt && (
                    <img src={track.albumArt} alt="" className="w-10 h-10 rounded flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: textColor }}>
                      {track.name}
                    </p>
                    <p className="text-xs truncate" style={{ color: subtleColor }}>
                      {track.artist}
                    </p>
                  </div>
                  <span className="text-[10px] uppercase tracking-widest flex-shrink-0" style={{ color: subtleColor }}>
                    {formatTimeAgo(track.playedAt)}
                  </span>
                </a>
              ))}
            </div>
          </motion.div>
        )}

        {/* Reconnect Spotify nudge — surfaces when an existing token lacks
            the v2.14 scopes (so now-playing / recently-played 401/403'd) */}
        {isOwner && needsReconnect && (
          <div
            className="mb-10 px-4 py-3 rounded-xl text-sm flex items-center justify-between gap-3"
            style={{
              background: `${textColor}10`,
              border: `1px solid ${textColor}25`,
              color: textColor,
            }}
          >
            <span>
              Reconnect Spotify to unlock now-playing and recently-played.
            </span>
            <button
              onClick={handleReconnect}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#1DB954] text-black hover:bg-[#1ed760] transition-colors"
            >
              Reconnect
            </button>
          </div>
        )}

        {/* Spotify Playlist Embed */}
        {vibeData.playlist_id && (
          <div className="mb-10 rounded-xl overflow-hidden">
            <iframe
              src={`https://open.spotify.com/embed/playlist/${vibeData.playlist_id}?utm_source=generator&theme=0`}
              width="100%"
              height="352"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              className="rounded-xl"
            />
          </div>
        )}

        {/* Spotify playlist — opt-in (owner only). We don't touch the user's
            account until they ask; this makes it their explicit choice. */}
        {isOwner && (
          <div
            className="mb-10 px-4 py-4 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            style={{ background: `${textColor}10`, border: `1px solid ${textColor}22` }}
          >
            <div className="text-sm" style={{ color: textColor }}>
              <p className="font-medium">
                {vibeData.playlist_id ? 'Your vibe playlist is on Spotify' : 'Save this vibe as a Spotify playlist'}
              </p>
              <p className="text-xs mt-0.5" style={{ color: subtleColor }}>
                {vibeData.playlist_id
                  ? 'Refresh it anytime to match your latest vibe.'
                  : 'Optional — creates a private “vibecheck.style” playlist on your account.'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {vibeData.playlist_id && (
                <a
                  href={`https://open.spotify.com/playlist/${vibeData.playlist_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2"
                  style={{ background: `${textColor}14`, color: textColor }}
                >
                  Open
                </a>
              )}
              <button
                onClick={createSpotifyPlaylist}
                disabled={playlistCreating}
                className="rounded-full bg-[#1DB954] hover:bg-[#1ed760] px-4 py-2 text-sm font-semibold text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1DB954] focus-visible:ring-offset-2"
                style={{ ['--tw-ring-offset-color' as any]: '#0a0908' }}
              >
                {playlistCreating
                  ? 'Saving…'
                  : vibeData.playlist_id
                    ? 'Refresh playlist'
                    : 'Save to Spotify'}
              </button>
            </div>
          </div>
        )}
        {isOwner && playlistError && (
          <div
            className="mb-10 px-4 py-3 rounded-xl text-sm"
            style={{ background: '#dc262618', border: '1px solid #dc262640', color: '#fca5a5' }}
          >
            Couldn't save the playlist this time — your vibe itself is safe. Try again in a moment.
          </div>
        )}

        {/* Vibe Twins (owner only) — your most-compatible public users */}
        {isOwner && twins.length > 0 && (
          <div className="mb-10">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-sm uppercase tracking-widest" style={{ color: subtleColor }}>
                Your Vibe Twins
              </h2>
              <Link
                to="/explore"
                className="text-xs font-medium hover:underline"
                style={{ color: subtleColor }}
              >
                see all →
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {twins.map(({ user, score }) => (
                <Link
                  key={user.spotify_id}
                  to={`/${user.spotify_id}`}
                  className="block rounded-xl overflow-hidden aspect-[3/4] relative transition-transform hover:scale-[1.03]"
                  style={{ background: user.vibe_gradient || gradient }}
                >
                  <div
                    className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold backdrop-blur-md"
                    style={{
                      background: 'rgba(0,0,0,0.4)',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.25)',
                    }}
                  >
                    {score}%
                  </div>
                  <div className="absolute inset-0 p-3 flex flex-col justify-end">
                    <p className="text-white text-xs font-semibold truncate drop-shadow">
                      {user.display_name}
                    </p>
                    <p className="text-white/80 text-[11px] truncate drop-shadow">
                      {user.vibe_label}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleShare}
            className="w-full py-3 rounded-full font-semibold text-lg transition-all duration-200"
            style={{
              background: textColor,
              color: gradient.includes('hsl') ? '#000' : '#fff',
            }}
          >
            {copied ? 'Copied!' : 'Share Your Vibe'}
          </button>

          <div className="flex gap-3">
            {vibeData.playlist_id && (
              <a
                href={`https://open.spotify.com/playlist/${vibeData.playlist_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-3 rounded-full font-medium text-center border transition-all duration-200"
                style={{ borderColor: `${textColor}40`, color: textColor }}
              >
                Open in Spotify
              </a>
            )}
            <button
              onClick={() => setShowStory(true)}
              className="flex-1 py-3 rounded-full font-medium border transition-all duration-200"
              style={{ borderColor: `${textColor}40`, color: textColor }}
            >
              Story
            </button>
          </div>

          {isOwner && (
            <>
              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => generateVibe(false)}
                  disabled={generating}
                  className="flex-1 py-2 rounded-full text-sm font-medium border transition-all duration-200 disabled:opacity-50"
                  style={{ borderColor: `${textColor}20`, color: subtleColor }}
                >
                  {generating ? 'Refreshing...' : 'Refresh Vibe'}
                </button>
                <button
                  onClick={handleTogglePrivacy}
                  disabled={savingPrivacy}
                  className="py-2 px-4 rounded-full text-sm font-medium border transition-all duration-200 disabled:opacity-50"
                  style={{ borderColor: `${textColor}20`, color: subtleColor }}
                  title={isPrivate ? 'Currently hidden from /explore' : 'Currently visible in /explore'}
                >
                  {savingPrivacy ? '...' : isPrivate ? '🔒 Private' : '🌍 Public'}
                </button>
                <button
                  onClick={handleLogout}
                  className="py-2 px-4 rounded-full text-sm font-medium transition-all duration-200"
                  style={{ color: subtleColor }}
                >
                  Logout
                </button>
              </div>
            </>
          )}

          {!isOwner && (
            <div className="flex gap-3">
              <Link
                to="/explore"
                className="flex-1 py-3 rounded-full font-medium text-center border transition-all duration-200"
                style={{ borderColor: `${textColor}40`, color: textColor }}
              >
                Explore
              </Link>
              <Link
                to={currentUser ? `/${currentUser.id}` : '/'}
                className="flex-1 py-3 rounded-full font-medium text-center border transition-all duration-200"
                style={{ borderColor: `${textColor}40`, color: textColor }}
              >
                {currentUser ? 'My Vibe' : 'Create Yours'}
              </Link>
            </div>
          )}

          {isOwner && (
            <Link
              to="/explore"
              className="w-full py-3 rounded-full font-medium text-center border transition-all duration-200 block mt-2"
              style={{ borderColor: `${textColor}30`, color: subtleColor }}
            >
              Explore Other Vibes
            </Link>
          )}

          {/* Danger zone — owner-only, intentionally low-emphasis */}
          {isOwner && (
            <div className="mt-6 pt-6 border-t" style={{ borderColor: `${textColor}15` }}>
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="w-full py-2 rounded-full text-xs font-medium transition-colors"
                  style={{ color: `${textColor}40` }}
                >
                  Delete my vibe
                </button>
              ) : (
                <div
                  className="px-4 py-4 rounded-2xl text-center"
                  style={{
                    background: `${textColor}08`,
                    border: `1px solid ${textColor}20`,
                  }}
                >
                  <p className="text-sm mb-3" style={{ color: textColor }}>
                    This permanently removes your vibe from our database.
                  </p>
                  <p className="text-xs mb-4" style={{ color: subtleColor }}>
                    Your Spotify account isn't affected — you can always come
                    back and generate a new one.
                  </p>
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="px-4 py-2 rounded-full text-xs font-semibold bg-red-500/80 text-white hover:bg-red-500 transition-colors disabled:opacity-50"
                    >
                      {deleting ? 'Deleting...' : 'Yes, delete it'}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleting}
                      className="px-4 py-2 rounded-full text-xs font-medium border disabled:opacity-50"
                      style={{ borderColor: `${textColor}30`, color: textColor }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <p className="text-center mt-8 text-xs" style={{ color: `${textColor}30` }}>
          vibecheck.style
        </p>

        <Footer textColor={textColor} />
      </motion.div>

      {/* Story Generator */}
      {showStory && (
        <StoryGenerator
          user={{ display_name: vibeData.display_name, id: vibeData.spotify_id }}
          topTracks={topTracks.map((t: any) => ({
            name: t.name,
            artists: [{ name: t.artist }],
            album: { images: [{ url: t.albumArt }] },
          }))}
          vibeLabel={vibeData.vibe_label || ''}
          gradient={gradient}
          onClose={() => setShowStory(false)}
        />
      )}
    </div>
  );
}

// "5m ago" / "2h ago" / "3d ago" — compact relative time for the
// recently-played feed.
function formatTimeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}
