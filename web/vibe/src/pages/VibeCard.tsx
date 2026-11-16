import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Instagram, Link2, LockKeyhole, Play } from 'lucide-react';
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
import { getVibeGradient, getContrastTextColor } from '../utils/vibe-colors';
import { saveVibe, getVibe, getUsers, updatePrivacy, deleteVibe } from '../utils/api';
import type { VibeData, VibeSummary } from '../utils/api';
import StoryGenerator from '../components/StoryGenerator';
import FriendActions from '../components/FriendActions';
import { spotifyTrackUrl } from '../utils/invitation';
import { fadeUp, heroIn, staggerContainer } from '../utils/motion';
import { generatePlaylistCover } from '../utils/playlist-cover';
import { clearSpotifySession } from '../utils/session';

interface VibeCardProps {
  currentUser: User | null;
  setUser: (user: User | null) => void;
}

/** Playlist we create on the user's account. First entry is the current name;
 *  the rest are legacy names we still match so we update instead of duplicate. */
const PLAYLIST_NAME = 'my ult · strummer vibe';
const PLAYLIST_NAMES = [PLAYLIST_NAME, 'vibecheck wrapped', 'vibecheck.style'];

/** Weights for merging Spotify's three top-track windows into one ranking.
 *  Recent listening counts most, but year-long favourites still make the cut. */
const RANGE_WEIGHTS: Record<string, number> = { short_term: 100, medium_term: 50, long_term: 25 };

/**
 * The on-demand Wrapped: fetch all three Spotify time ranges and merge them
 * into a single ranked track list (a song high in several windows outranks one
 * that only spiked recently). Returns up to 100 URIs, Spotify's PUT limit.
 */
async function fetchWrappedUris(): Promise<string[]> {
  const ranges = Object.keys(RANGE_WEIGHTS);
  const results = await Promise.all(
    ranges.map(range =>
      spotifyApiGet(`https://api.spotify.com/v1/me/top/tracks?time_range=${range}&limit=50`)
        .catch(() => ({ items: [] }))
    )
  );

  const scores = new Map<string, number>();
  results.forEach((res, i) => {
    const items = res.items || [];
    items.forEach((track: any, index: number) => {
      if (!track?.uri) return;
      const score = (items.length - index) * RANGE_WEIGHTS[ranges[i]];
      scores.set(track.uri, (scores.get(track.uri) || 0) + score);
    });
  });

  return Array.from(scores.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 100)
    .map(([uri]) => uri);
}

export default function VibeCard({ currentUser, setUser }: VibeCardProps) {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [vibeData, setVibeData] = useState<VibeData | null>(null);
  const [viewerVibe, setViewerVibe] = useState<VibeData | null>(null);
  const [showStory, setShowStory] = useState(
    () => import.meta.env.DEV && new URLSearchParams(window.location.search).has('story-preview')
  );
  const [copied, setCopied] = useState(false);
  const [tracksExpanded, setTracksExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playlistError, setPlaylistError] = useState(false);
  const [playlistCreating, setPlaylistCreating] = useState(false);
  const [playlistSynced, setPlaylistSynced] = useState(false);
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
  const viewerId = currentUser?.id;
  const loadVibeRef = useRef(loadVibe);
  loadVibeRef.current = loadVibe;

  useEffect(() => {
    void loadVibeRef.current();
    setTracksExpanded(false);
  }, [userId, isOwner]);

  // When viewing someone else's profile while logged in, fetch our own
  // saved vibe so we can compute a compatibility score on the client.
  useEffect(() => {
    if (isOwner || !viewerId) {
      setViewerVibe(null);
      return;
    }
    let cancelled = false;
    getVibe(viewerId)
      .then(v => {
        if (!cancelled) setViewerVibe(v);
      })
      .catch(err => console.error('Viewer vibe fetch failed:', err));
    return () => {
      cancelled = true;
    };
  }, [isOwner, viewerId]);

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
          generateVibe(true, saved.is_public !== false, saved.playlist_id);
        }
        return;
      }

      // No saved data — if owner, generate it
      if (isOwner && localStorage.getItem('access_token')) {
        await generateVibe(false, false);
      } else {
        setError('This person hasn\'t created their vibe yet.');
        setLoading(false);
      }
    } catch {
      setError('Failed to load vibe. Try again.');
      setLoading(false);
    }
  }

  async function generateVibe(
    background: boolean,
    privacyOverride?: boolean,
    playlistIdOverride?: string | null
  ) {
    if (!currentUser || !userId) return;
    if (!background) setGenerating(true);

    try {
      // Fetch top tracks AND top artists from all three time windows in parallel.
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
      const playlistId = playlistIdOverride || currentUser.playlistId || vibeData?.playlist_id || null;
      const nextPlaylistSource = {
        uris: sortedTracks.slice(0, 100).map((t: any) => t.uri).filter(Boolean),
        gradient: gradient.css,
        label: `${vibeLabel.emoji} ${vibeLabel.label}`,
        textColor: (getContrastTextColor(profile.metrics) === '#000000'
          ? '#000000'
          : '#ffffff') as '#000000' | '#ffffff',
      };
      setPlaylistSource(nextPlaylistSource);

      const savedTracks = sortedTracks.slice(0, 20).map((t: any) => ({
        name: t.name,
        artist: t.artists.map((a: any) => a.name).join(', '),
        albumArt: t.album?.images?.[1]?.url || t.album?.images?.[0]?.url || '',
        uri: t.uri,
        url: t.external_urls?.spotify || `https://open.spotify.com/track/${t.id}`,
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
        top_tracks: savedTracks,
        top_genres: profile.topGenres,
        top_artists: topArtists,
        is_public: privacyOverride ?? vibeData?.is_public ?? false,
      };

      setVibeData(data);

      // Update user
      const updatedUser = { ...currentUser, playlistId: playlistId || undefined };
      setUser(updatedUser);
      localStorage.setItem('user_data', JSON.stringify(updatedUser));

      // Save to DB
      await saveVibe(data);

      // First creation remains explicit. After opt-in, the playlist becomes a
      // living portrait and refreshes whenever its owner returns.
      if (playlistId) {
        try {
          await replacePlaylistItems(playlistId, nextPlaylistSource.uris);
          setPlaylistSynced(true);
        } catch (syncErr) {
          console.warn('Background playlist sync failed (non-fatal):', syncErr);
          setPlaylistError(true);
        }
      }
    } catch (err) {
      console.error('Generate vibe error:', err);
      if (!background) {
        // If token is invalid, clear session and redirect to login
        if (String(err).includes('Authentication failed') || String(err).includes('No valid access token')) {
          clearSpotifySession(localStorage);
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

  // Opt-in: build (or refresh) the Strummer Vibe playlist on the user's
  // own Spotify account. Only runs when they click the button — generating a
  // vibe no longer writes to their account automatically.
  async function createSpotifyPlaylist() {
    if (!currentUser || !vibeData || playlistCreating) return;
    setPlaylistCreating(true);
    setPlaylistError(false);
    try {
      // Prefer URIs from the latest generation; otherwise rebuild the merge now
      // so a page loaded straight from a saved vibe still produces a real
      // Wrapped (all three time ranges), not just the medium-term list.
      let source = playlistSource;
      if (!source || source.uris.length === 0) {
        source = {
          uris: await fetchWrappedUris(),
          gradient: vibeData.vibe_gradient || '',
          label: vibeData.vibe_label || 'vibecheck',
          textColor: '#ffffff' as const,
        };
      }
      if (source.uris.length === 0) {
        setPlaylistError(true);
        return;
      }

      const playlistDescription =
        `${currentUser.display_name}'s living ult · 4 weeks + 6 months + 1 year, ` +
        `merged and ranked. ${source.label} · strummer.fun/vibe`;
      let playlistId = currentUser.playlistId || vibeData.playlist_id || null;

      // Validate a cached playlist still exists (users delete them manually).
      if (playlistId) {
        try {
          await spotifyApiGet(`https://api.spotify.com/v1/playlists/${playlistId}?fields=id`);
        } catch {
          playlistId = null;
        }
      }
      // Reuse one we previously made before creating a duplicate. Includes the
      // legacy name so pre-rename playlists get updated instead of orphaned.
      if (!playlistId) {
        const list = await spotifyApiGet('https://api.spotify.com/v1/me/playlists?limit=50');
        const existing = (list.items || []).find(
          (p: any) => PLAYLIST_NAMES.includes(p.name) && p.owner?.id === currentUser.id
        );
        if (existing) playlistId = existing.id;
      }
      if (!playlistId) {
        const playlist = await spotifyApiPost(
          'https://api.spotify.com/v1/me/playlists',
          { name: PLAYLIST_NAME, description: playlistDescription, public: false }
        );
        playlistId = playlist.id;
      }
      if (!playlistId) throw new Error('Spotify did not return a playlist id.');

      // Spotify renamed playlist /tracks to /items in 2026.
      await replacePlaylistItems(playlistId, source.uris);
      try {
        await spotifyApiPut(
          `https://api.spotify.com/v1/playlists/${playlistId}`,
          { name: PLAYLIST_NAME, description: playlistDescription }
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
      setPlaylistSynced(true);
    } catch (err) {
      console.error('Playlist creation failed:', err);
      setPlaylistError(true);
    } finally {
      setPlaylistCreating(false);
    }
  }

  async function replacePlaylistItems(playlistId: string, uris: string[]) {
    await spotifyApiPut(
      `https://api.spotify.com/v1/playlists/${playlistId}/items`,
      { uris: uris.slice(0, 100) }
    );
  }

  async function handleShare() {
    if (isPrivate) return;
    // Copy the /share/:id URL so social platforms (Twitter/Discord/iMessage)
    // hit the OG-tagged HTML and render a per-user preview. Humans get
    // redirected to /:id transparently.
    const url = `${window.location.origin}/vibe/share/${userId}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${vibeData?.display_name || 'My'} music vibe`,
          text: 'You get to know someone through their music taste.',
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        console.warn('Profile share failed:', err);
      }
    }
  }

  async function handlePublishFromStory() {
    if (!vibeData || !currentUser) throw new Error('Not signed in');
    await updatePrivacy(currentUser.id, currentUser.display_name, true);
    setVibeData({ ...vibeData, is_public: true });
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
    clearSpotifySession(localStorage);
    setUser(null);
    navigate('/');
  }

  // Same flow as logout — clears the token so the next sign-in produces one
  // with the v2.14 scopes. We redirect home where the standard OAuth flow
  // takes over.
  function handleReconnect() {
    clearSpotifySession(localStorage);
    setUser(null);
    navigate('/');
  }

  async function handleDelete() {
    if (!currentUser || deleting) return;
    setDeleting(true);
    try {
      await deleteVibe(currentUser.id);
      // Wipe local session too — there's no profile left to come back to.
      clearSpotifySession(localStorage);
      setUser(null);
      navigate('/');
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Failed to delete your vibe. Please try again, or write to us from strummer.fun/contact.');
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  // --- Loading State ---
  if (loading && !vibeData) {
    return (
      <div className="profile-state" role="status">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-[var(--vc-fg)] border-t-transparent" aria-hidden="true" />
        <p>{generating ? 'Analyzing your music...' : 'Loading vibe...'}</p>
      </div>
    );
  }

  // --- Error State ---
  if (error && !vibeData) {
    return (
      <div className="profile-state">
        <h1>Vibe unavailable</h1>
        <p role="alert">{error}</p>
        <div className="profile-notice-actions">
          {isOwner && (
            <button type="button" onClick={() => loadVibe()} disabled={loading || generating} className="friend-secondary">
              {loading || generating ? 'Trying...' : 'Try again'}
            </button>
          )}
          <a href="/vibe" className="profile-cta">{isOwner ? 'Back home' : 'Make your vibe'}</a>
        </div>
      </div>
    );
  }

  if (!vibeData) return null;

  // --- Private profile gate (visitor view only) ---
  if (!isOwner && isPrivate) {
    return (
      <div className="profile-state">
        <LockKeyhole size={32} aria-hidden="true" />
        <h1>Private vibe</h1>
        <p>This person hasn't made their vibe public.</p>
        <Link to={currentUser ? `/${currentUser.id}` : '/'} className="profile-cta">
          {currentUser ? 'Back to my vibe' : 'Make your vibe'}
        </Link>
      </div>
    );
  }

  // --- Parse data ---
  const features = (vibeData.average_features || {}) as any;
  const gradient = vibeData.vibe_gradient || 'linear-gradient(135deg, #1a1816, #211e1b, #121110)';
  // Detect new metric shape vs legacy audio-features shape
  const isNewMetrics = features.mainstream != null;
  // When a time-range tab is active (owner only), swap in that range's
  // freshly-fetched data; otherwise show the aggregated saved data.
  const activeRange = isOwner && timeRange ? rangeData[timeRange] : null;
  const topTracks = activeRange?.tracks ?? vibeData.top_tracks ?? [];
  const topArtists = activeRange?.artists ?? vibeData.top_artists ?? [];

  // Genre breakdown, statsforspotify-style: ranked by how many of the
  // window's top artists carry each tag. Recomputed per time-range tab from
  // the artists we already fetched — no extra API call — so switching
  // between 4 Weeks / 6 Months / 1 Year shows genres for THAT window,
  // not just the one aggregate saved at generation time.
  const rangeGenres = (() => {
    if (!topArtists.length) return [];
    const counts = new Map<string, number>();
    for (const artist of topArtists as any[]) {
      for (const g of artist.genres || []) counts.set(g, (counts.get(g) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([g]) => g);
  })();
  const topGenres = rangeGenres.length ? rangeGenres : vibeData.top_genres || [];

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

  return (
    <div className="bg-[var(--vc-bg)]">
      <motion.div
        className="vibe-profile"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >

        {/* Now playing, owner only */}
        {isOwner && nowPlaying && nowPlaying.isPlaying && (
          <motion.a variants={fadeUp} href={nowPlaying.url} target="_blank" rel="noopener noreferrer" className="profile-now">
            {nowPlaying.albumArt && <img src={nowPlaying.albumArt} alt="" />}
            <span className="profile-row-text">
              <span className="profile-now-tag"><span className="profile-now-dot" aria-hidden="true" />Now playing</span>
              <strong>{nowPlaying.name}</strong>
              <span>{nowPlaying.artist}</span>
            </span>
          </motion.a>
        )}

        <motion.div variants={fadeUp} className="profile-identity">
          {vibeData.avatar_url && <img src={vibeData.avatar_url} alt="" />}
          <div><h1>{vibeData.display_name}</h1><p>{isOwner ? 'Your listening portrait' : 'A listening portrait'}</p></div>
        </motion.div>
        <motion.div variants={heroIn} className="profile-vibe-label">
          <h2>{vibeData.vibe_label}</h2>
          <div className="profile-genres">{topGenres.slice(0, 4).map(genre => <span key={genre}>{genre}</span>)}</div>
        </motion.div>
        {isOwner && <FriendActions key={vibeData.spotify_id} vibe={vibeData} onPublish={handlePublishFromStory} />}
        {!isOwner && <Link className="profile-share-button mb-4" to={`/?from=${encodeURIComponent(vibeData.spotify_id)}`}>Compare our music</Link>}
        <button type="button" onClick={() => setShowStory(true)} className="friend-secondary mb-8">
          <Instagram size={18} aria-hidden="true" /> Make an Instagram Story
        </button>

        {/* Match (only when a signed-in viewer is looking at someone else) */}
        {!isOwner && currentUser && compatibilityScore != null && (
          <motion.div variants={fadeUp}>
            <Link to={`/compare/${currentUser.id}/${userId}`} className="profile-match">
              <span className="profile-match-value">{compatibilityScore}%</span>
              <span className="profile-match-text">
                <strong>Your music match</strong>
                <span>
                  {compatibilityScore >= 85
                    ? 'You two are basically the same listener.'
                    : compatibilityScore >= 70
                    ? 'Serious overlap. Make a joint playlist.'
                    : compatibilityScore >= 50
                    ? 'Some shared territory.'
                    : 'Different favorites. Plenty to discover.'}
                </span>
              </span>
              <span className="profile-match-more">See the breakdown</span>
            </Link>
          </motion.div>
        )}

        {/* Mood Meters — bars animate to height on first reveal */}
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="vibe-meters"
        >
          {meters.map(({ label, value }) => (
            <motion.div key={label} variants={fadeUp} className="vibe-meter">
              <span className="vibe-meter-value">{Math.round(value * 100)}</span>
              <span className="vibe-meter-label">{label}</span>
              <span className="vibe-meter-track" aria-hidden="true">
                <motion.span
                  className="vibe-meter-level"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.round(value * 100)}%` }}
                  transition={{ duration: 0.9, ease: [0.165, 0.84, 0.44, 1], delay: 0.15 }}
                />
              </span>
            </motion.div>
          ))}
        </motion.div>

        {/* Library stats, owner only */}
        {isOwner && libraryStats && (libraryStats.tracks > 0 || libraryStats.albums > 0) && (
          <motion.div variants={fadeUp} className="profile-stats">
            {[
              { label: 'Saved songs', value: libraryStats.tracks },
              { label: 'Saved albums', value: libraryStats.albums },
            ].map(stat => (
              <div key={stat.label} className="vibe-meter">
                <span className="vibe-meter-value">{stat.value.toLocaleString()}</span>
                <span className="vibe-meter-label">{stat.label}</span>
              </div>
            ))}
          </motion.div>
        )}

        {/* Time-range tabs (owner only): which window the lists below show.
            Defaults to the saved, combined vibe. */}
        {isOwner && (
          <motion.div variants={fadeUp} className="profile-tabs" role="group" aria-label="Time range">
            {(
              [
                { key: null, label: 'My vibe' },
                { key: 'short_term' as TimeRange, label: '4 weeks' },
                { key: 'medium_term' as TimeRange, label: '6 months' },
                { key: 'long_term' as TimeRange, label: '1 year' },
              ]
            ).map(opt => (
              <button
                key={opt.label}
                type="button"
                aria-pressed={timeRange === opt.key}
                onClick={() => (opt.key ? handleTimeRange(opt.key) : setTimeRange(null))}
                disabled={rangeLoading}
                className="explore-sort-pill"
              >
                {opt.label}
              </button>
            ))}
          </motion.div>
        )}

        {/* Top tracks */}
        {topTracks.length > 0 && (
          <motion.section variants={fadeUp} className="profile-section">
            <h2>The songs in this vibe</h2>
            <ol className="profile-rows">
              {topTracks.slice(0, tracksExpanded ? topTracks.length : 5).map((track: any, i: number) => (
                <li key={i} className="profile-row">
                  <span className="profile-row-rank">{i + 1}</span>
                  {track.albumArt && <img src={track.albumArt} alt="" />}
                  <span className="profile-row-text">
                    <strong>{track.name}</strong>
                    <span>{track.artist}</span>
                  </span>
                  {spotifyTrackUrl(track) && <a className="friend-listen" href={spotifyTrackUrl(track)!} target="_blank" rel="noopener noreferrer" aria-label={`Listen to ${track.name} on Spotify`} title={`Listen to ${track.name} on Spotify`}><Play size={18} aria-hidden="true" /></a>}
                  {/* Handoff to /tune. Passes song + artist only: chords and key
                      are NOT sent, because Spotify does not expose them (the
                      audio-features endpoint was revoked for new apps in Nov
                      2024). /tune either analyses audio you own, or shows the
                      chords already saved for that song. */}
                  <a
                    href={`/tune?song=${encodeURIComponent(track.name)}&artist=${encodeURIComponent(track.artist)}`}
                    className="profile-chip"
                    title={`Learn ${track.name} on guitar`}
                  >
                    Chords
                  </a>
                </li>
              ))}
            </ol>
            {topTracks.length > 5 && <button type="button" className="friend-secondary mt-4" aria-expanded={tracksExpanded} onClick={() => setTracksExpanded(!tracksExpanded)}>{tracksExpanded ? 'Show fewer songs' : `Show all ${topTracks.length} songs`}</button>}
          </motion.section>
        )}

        {/* Top artists */}
        {topArtists.length > 0 && (
          <motion.section variants={fadeUp} className="profile-section">
            <h2>Top artists</h2>
            <div className="profile-artists">
              {topArtists.slice(0, 10).map((artist, i) => (
                <a
                  key={artist.id}
                  href={artist.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="profile-artist"
                  title={artist.genres?.slice(0, 3).join(', ') || ''}
                >
                  {artist.image ? (
                    <img src={artist.image} alt="" />
                  ) : (
                    <span className="profile-artist-initial" aria-hidden="true">{artist.name?.[0] ?? '?'}</span>
                  )}
                  <span className="profile-artist-rank">{i + 1}</span>
                  <span className="profile-artist-name">{artist.name}</span>
                </a>
              ))}
            </div>
          </motion.section>
        )}

        {/* Top genres: ranked by artist frequency in the active window
            (distinct from the tags under the vibe label, which show four). */}
        {rangeGenres.length > 0 && (
          <motion.section variants={fadeUp} className="profile-section">
            <h2>Top genres</h2>
            <ol className="profile-rows">
              {rangeGenres.map((genre, i) => (
                <li key={genre} className="profile-row">
                  <span className="profile-row-rank">{i + 1}</span>
                  <span className="capitalize">{genre}</span>
                </li>
              ))}
            </ol>
          </motion.section>
        )}

        {/* Recently played, owner only */}
        {isOwner && recentlyPlayed.length > 0 && (
          <motion.section variants={fadeUp} className="profile-section">
            <h2>Recently played</h2>
            <div className="profile-rows">
              {recentlyPlayed.slice(0, 6).map((track, i) => (
                <a key={`${track.url}-${i}`} href={track.url} target="_blank" rel="noopener noreferrer" className="profile-row profile-row-link">
                  {track.albumArt && <img src={track.albumArt} alt="" />}
                  <span className="profile-row-text">
                    <strong>{track.name}</strong>
                    <span>{track.artist}</span>
                  </span>
                  <span className="profile-row-time">{formatTimeAgo(track.playedAt)}</span>
                </a>
              ))}
            </div>
          </motion.section>
        )}

        {/* Reconnect Spotify: shown when an existing token lacks the scopes
            for now-playing and recently-played. */}
        {isOwner && needsReconnect && (
          <div className="profile-notice">
            <p>Reconnect Spotify to unlock now playing and recently played.</p>
            <button type="button" onClick={handleReconnect} className="profile-cta">Reconnect</button>
          </div>
        )}

        {/* Spotify playlist embed */}
        {isOwner && vibeData.playlist_id && (
          <div className="mb-10 rounded-lg overflow-hidden">
            <iframe
              src={`https://open.spotify.com/embed/playlist/${vibeData.playlist_id}?utm_source=generator&theme=0`}
              title="Your playlist on Spotify"
              width="100%"
              height="352"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              className="rounded-lg"
            />
          </div>
        )}

        {/* Spotify playlist, opt-in (owner only). We don't touch the user's
            account until they ask; this makes it their explicit choice. */}
        {isOwner && (
          <div className="profile-notice">
            <div>
              <p><strong>{vibeData.playlist_id ? 'Your living ult is on Spotify' : 'Build your living ult'}</strong></p>
              <p className="profile-notice-sub">
                {vibeData.playlist_id
                  ? playlistSynced
                    ? 'Synced with your newest taste across 4 weeks, 6 months, and 1 year.'
                    : 'Refresh anytime to merge your newest listening.'
                  : 'Ranks your last 4 weeks, 6 months, and 1 year into one private playlist.'}
              </p>
            </div>
            <div className="profile-notice-actions">
              {vibeData.playlist_id && (
                <a href={`https://open.spotify.com/playlist/${vibeData.playlist_id}`} target="_blank" rel="noopener noreferrer" className="friend-secondary">
                  Open
                </a>
              )}
              <button type="button" onClick={createSpotifyPlaylist} disabled={playlistCreating} className="profile-cta">
                {playlistCreating ? 'Merging...' : vibeData.playlist_id ? 'Sync now' : 'Create my ult'}
              </button>
            </div>
          </div>
        )}
        {isOwner && playlistError && (
          <p role="alert" className="vibe-alert mb-8">
            Couldn't save the playlist this time. Your vibe itself is safe. Try again in a moment.
          </p>
        )}

        {/* Vibe twins (owner only): your closest public listeners */}
        {isOwner && twins.length > 0 && (
          <section className="profile-section">
            <div className="profile-section-head">
              <h2>Your vibe twins</h2>
              <Link to="/explore">See all</Link>
            </div>
            <div className="explore-grid profile-twins">
              {twins.map(({ user, score }) => (
                <Link key={user.spotify_id} to={`/${encodeURIComponent(user.spotify_id)}`} className="explore-tile">
                  <span className="explore-tile-band" style={{ background: user.vibe_gradient || gradient }} aria-hidden="true" />
                  <span className="explore-tile-who">
                    <strong>{user.display_name}</strong>
                    <span className="explore-tile-match">{score}%</span>
                  </span>
                  <span className="explore-tile-label">{user.vibe_label}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Actions */}
        <div className="profile-section profile-footer">
          <button type="button" onClick={handleShare} disabled={isPrivate} className="friend-secondary">
            <Link2 className="h-4 w-4" aria-hidden="true" />
            {isPrivate ? 'Profile is private' : copied ? 'Copied' : 'Share profile'}
          </button>

          {isOwner && (
            <div className="profile-actions">
              <button type="button" onClick={() => generateVibe(false)} disabled={generating} className="friend-secondary">
                {generating ? 'Refreshing...' : 'Refresh vibe'}
              </button>
              <button
                type="button"
                onClick={handleTogglePrivacy}
                disabled={savingPrivacy}
                className="friend-secondary"
                title={isPrivate ? 'Currently hidden from Explore' : 'Currently visible in Explore'}
              >
                {savingPrivacy ? 'Saving...' : isPrivate ? 'Make public' : 'Make private'}
              </button>
              <button type="button" onClick={handleLogout} className="friend-secondary">Log out</button>
            </div>
          )}

          {!isOwner && !currentUser && <Link to="/" className="friend-secondary">Make your own vibe</Link>}

          {/* Danger zone, owner only, intentionally low-emphasis */}
          {isOwner && (
            !confirmDelete ? (
              <button type="button" onClick={() => setConfirmDelete(true)} className="profile-danger">
                Delete my vibe
              </button>
            ) : (
              <div className="profile-notice" role="alertdialog" aria-label="Delete my vibe">
                <div>
                  <p><strong>This permanently removes your vibe from our database.</strong></p>
                  <p className="profile-notice-sub">Your Spotify account isn't affected. You can always come back and make a new one.</p>
                </div>
                <div className="profile-notice-actions">
                  <button type="button" onClick={handleDelete} disabled={deleting} className="profile-cta profile-delete">
                    {deleting ? 'Deleting...' : 'Yes, delete it'}
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(false)} disabled={deleting} className="friend-secondary">
                    Cancel
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      </motion.div>

      {/* Story Generator */}
      {showStory && (
        <StoryGenerator
          user={{ display_name: vibeData.display_name, id: vibeData.spotify_id }}
          topTracks={(vibeData.top_tracks || topTracks).map((t: any) => ({
            name: t.name,
            artist: t.artist || t.artists?.map((artist: any) => artist.name).join(', ') || '',
            albumArt: t.albumArt || t.album?.images?.[0]?.url || null,
            url: t.url || t.external_urls?.spotify,
          }))}
          vibeLabel={vibeData.vibe_label || ''}
          gradient={gradient}
          profileUrl={`https://strummer.fun/vibe/${encodeURIComponent(vibeData.spotify_id)}`}
          isPublic={!isPrivate}
          onPublish={isOwner ? handlePublishFromStory : undefined}
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
