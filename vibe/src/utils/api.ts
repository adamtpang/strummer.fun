const API_BASE = import.meta.env.VITE_API_URL || '';

export interface TopArtist {
  id: string;
  name: string;
  image: string | null;
  genres: string[];
  popularity: number;
  url: string;
}

export interface VibeData {
  spotify_id: string;
  display_name: string;
  avatar_url: string | null;
  playlist_id: string | null;
  vibe_label: string | null;
  vibe_gradient: string | null;
  average_features: Record<string, number> | null;
  top_tracks: any[] | null;
  top_genres: string[] | null;
  top_artists?: TopArtist[] | null;
  is_public?: boolean;
}

/**
 * Lean shape returned by GET /api/users for the explore directory.
 * Excludes top_tracks (heavier) and playlist_id (not needed for grid).
 */
export interface VibeSummary {
  spotify_id: string;
  display_name: string;
  avatar_url: string | null;
  vibe_label: string | null;
  vibe_gradient: string | null;
  average_features: Record<string, number> | null;
  top_genres: string[] | null;
  updated_at: string;
}

export async function saveVibe(data: VibeData): Promise<void> {
  // POST is owner-gated server-side — hand over the Spotify token so the
  // server can confirm this row is ours before writing it.
  const token = localStorage.getItem('access_token');
  if (!token) throw new Error('Not signed in');
  const res = await fetch(`${API_BASE}/api/vibe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to save vibe');
}

/**
 * Flips the is_public flag via the dedicated owner-gated PATCH endpoint.
 * Touches only privacy — no full-row round-trip that could clobber vibe data.
 */
export async function updatePrivacy(
  spotifyId: string,
  _displayName: string,
  isPublic: boolean
): Promise<void> {
  const token = localStorage.getItem('access_token');
  if (!token) throw new Error('Not signed in');
  const res = await fetch(`${API_BASE}/api/vibe/${encodeURIComponent(spotifyId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ is_public: isPublic }),
  });
  if (!res.ok) throw new Error('Failed to update privacy');
}

export async function getVibe(spotifyId: string): Promise<VibeData | null> {
  const res = await fetch(`${API_BASE}/api/vibe/${encodeURIComponent(spotifyId)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to fetch vibe');
  return res.json();
}

/**
 * Permanently deletes the caller's vibe data. Authenticates ownership by
 * handing the current Spotify access token to the server, which validates
 * it against /v1/me and confirms id parity before issuing the DELETE.
 */
export async function deleteVibe(spotifyId: string): Promise<void> {
  const token = localStorage.getItem('access_token');
  if (!token) throw new Error('Not signed in');
  const res = await fetch(`${API_BASE}/api/vibe/${encodeURIComponent(spotifyId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to delete vibe');
  }
}

export interface VibeLabelCount {
  label: string;
  count: number;
}

export interface UsersResponse {
  users: VibeSummary[];
  total: number;
  topLabels: VibeLabelCount[];
}

export async function getUsers(opts: { limit?: number; offset?: number } = {}): Promise<UsersResponse> {
  const params = new URLSearchParams();
  if (opts.limit != null) params.set('limit', String(opts.limit));
  if (opts.offset != null) params.set('offset', String(opts.offset));
  const url = `${API_BASE}/api/users${params.toString() ? `?${params}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch users');
  const data = await res.json();
  return {
    users: data.users || [],
    total: data.total ?? (data.users?.length ?? 0),
    topLabels: data.topLabels || [],
  };
}
