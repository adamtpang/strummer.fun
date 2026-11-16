export const SESSION_KEYS = [
  'access_token', 'refresh_token', 'token_expires_at', 'user_data',
  'code_verifier', 'oauth_state', 'oauth_started_at',
] as const;

type SessionStorage = Pick<Storage, 'getItem' | 'removeItem'>;

export function clearSpotifySession(storage: SessionStorage) {
  for (const key of SESSION_KEYS) {
    try { storage.removeItem(key); } catch { /* Storage can be disabled. */ }
  }
}

export function readStoredUser(storage: SessionStorage) {
  try {
    const raw = storage.getItem('user_data');
    if (!raw || !storage.getItem('access_token')) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid session');
    const user = value as Record<string, unknown>;
    if (typeof user.id !== 'string' || !user.id.trim() || typeof user.display_name !== 'string') {
      throw new Error('Invalid session');
    }
    return {
      id: user.id,
      display_name: user.display_name,
      avatar_url: typeof user.avatar_url === 'string' ? user.avatar_url : undefined,
      playlistId: typeof user.playlistId === 'string' ? user.playlistId : undefined,
    };
  } catch {
    clearSpotifySession(storage);
    return null;
  }
}

export function validateOAuthCallback(storage: SessionStorage, state: string | null, now = Date.now()) {
  const expected = storage.getItem('oauth_state');
  const started = Number(storage.getItem('oauth_started_at'));
  const verifier = storage.getItem('code_verifier');
  if (!state || !expected || state !== expected || !verifier || !started ||
      !Number.isFinite(started) || now < started || now - started > 10 * 60 * 1000) {
    throw new Error('Your sign-in link expired or belongs to another browser. Tap Connect to start over.');
  }
  return verifier;
}
