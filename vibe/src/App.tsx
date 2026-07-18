import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect, useState, lazy, Suspense } from 'react';
import Home from './pages/Home';
import { CLIENT_ID } from './utils/spotify-api';
import './index.css';

// Code-split routes (v2.18) — Home is eager because it's the landing page;
// everything else lazy-loads on first navigation. Cuts initial bundle from
// ~350 kB → ~200 kB and defers framer-motion/StoryGenerator/canvas code
// until the user actually needs them.
const VibeCard = lazy(() => import('./pages/VibeCard'));
const Explore = lazy(() => import('./pages/Explore'));
const Compare = lazy(() => import('./pages/Compare'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));

function RouteFallback() {
  return (
    <div className="min-h-screen bg-[#0a0908] flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent" />
    </div>
  );
}

export interface User {
  id: string;
  display_name: string;
  avatar_url?: string;
  playlistId?: string;
}

// vibecheck is mounted under strummer.fun/vibe. Router basename + OAuth
// redirect + raw history writes all need this prefix.
const BASE = '/vibe';
const REDIRECT_URI = window.location.origin + BASE;

// Spotify is invite-only until the app is granted extended quota; a
// non-allowlisted user gets a token but 403s on /v1/me. This message explains
// that instead of silently bouncing them to the landing page.
const DEV_MODE_MESSAGE =
  "vibecheck is invite-only right now — Spotify hasn't approved general access yet. " +
  'Ask Adam to add your Spotify email to the allowlist, then try again.';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    // Check for existing user data
    const userData = localStorage.getItem('user_data');
    const token = localStorage.getItem('access_token');

    if (userData && token) {
      setUser(JSON.parse(userData));
    }

    // Check for OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');

    if (error) {
      // User declined consent, or Spotify rejected the request.
      setAuthError(
        error === 'access_denied'
          ? 'You cancelled the Spotify connection. Tap Connect to try again.'
          : `Spotify sign-in failed (${error}). Please try again.`
      );
      // Strip the ?error= so a refresh doesn't re-show it.
      window.history.replaceState({}, document.title, BASE);
      setLoading(false);
      return;
    }

    if (code) {
      handleOAuthCallback(code);
    } else {
      setLoading(false);
    }
  }, []);

  const handleOAuthCallback = async (code: string) => {
    try {
      const codeVerifier = localStorage.getItem('code_verifier');
      if (!codeVerifier)
        throw new Error(
          'Your sign-in link expired or was opened in a different browser. Tap Connect to start over.'
        );

      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: REDIRECT_URI,
          client_id: CLIENT_ID,
          code_verifier: codeVerifier,
        }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error_description || data.error);
      if (!data.access_token) throw new Error('Spotify did not return an access token. Please try again.');

      localStorage.setItem('access_token', data.access_token);
      if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token);
      if (data.expires_in) {
        const expiresAt = Date.now() + (data.expires_in - 300) * 1000;
        localStorage.setItem('token_expires_at', expiresAt.toString());
      }

      localStorage.removeItem('code_verifier');

      // Get user profile
      const userRes = await fetch('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      // 403 here = the account isn't on the app's Spotify allowlist (dev mode).
      if (userRes.status === 403) {
        const devErr = new Error(DEV_MODE_MESSAGE);
        (devErr as any).devMode = true;
        throw devErr;
      }
      const profile = await userRes.json();
      if (profile.error) throw new Error(profile.error.message || 'Could not read your Spotify profile.');

      const user: User = {
        id: profile.id,
        display_name: profile.display_name,
        avatar_url: profile.images?.[0]?.url || null,
      };

      localStorage.setItem('user_data', JSON.stringify(user));
      setUser(user);

      // Redirect to their vibe card
      window.history.replaceState({}, document.title, `${BASE}/${user.id}`);
    } catch (err) {
      console.error('OAuth error:', err);
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('token_expires_at');
      localStorage.removeItem('user_data');
      localStorage.removeItem('code_verifier');
      setAuthError(err instanceof Error ? err.message : 'Something went wrong signing in. Please try again.');
      window.history.replaceState({}, document.title, BASE);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0908] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent" />
      </div>
    );
  }

  return (
    <Router basename={BASE}>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Home user={user} authError={authError} />} />
          <Route path="/explore" element={<Explore currentUser={user} />} />
          <Route path="/compare/:idA/:idB" element={<Compare currentUser={user} />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/:userId" element={<VibeCard currentUser={user} setUser={setUser} />} />
        </Routes>
      </Suspense>
    </Router>
  );
}
