import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Headphones, Sparkles, Share2 } from 'lucide-react';
import type { User } from '../App';
import { CLIENT_ID } from '../utils/spotify-api';
import Footer from '../components/Footer';

interface HomeProps {
  user: User | null;
  authError?: string | null;
}

const REDIRECT_URI = window.location.origin + '/vibe';

function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function generateCodeChallenge(verifier: string) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export default function Home({ user, authError }: HomeProps) {
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const navigate = useNavigate();

  // If logged in, go to their vibe card
  useEffect(() => {
    if (user) {
      navigate(`/${user.id}`, { replace: true });
    }
  }, [user, navigate]);

  if (user) return null;

  const shownError = loginError || authError;

  const handleLogin = async () => {
    setLoading(true);
    setLoginError(null);
    try {
      // crypto.subtle requires a secure context (https or localhost).
      if (!window.crypto?.subtle) {
        throw new Error('Your browser blocked secure sign-in. Open vibecheck over https and try again.');
      }
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      localStorage.setItem('code_verifier', codeVerifier);

      const params = new URLSearchParams({
        client_id: CLIENT_ID,
        response_type: 'code',
        redirect_uri: REDIRECT_URI,
        // Bumped in v2.14 to include playback + library scopes so we can show
        // now-playing, recently-played, and library size on the profile card.
        // Existing users keep their old scopes until they next re-auth — the
        // new sections silently no-op for them until they reconnect.
        // Only scopes the app actually uses — kept lean so Spotify's Extended
        // Quota review is clean and the consent screen is lighter. We create
        // PRIVATE playlists only, so playlist-modify-public is deliberately
        // omitted (it was an over-request that invites review questions).
        scope: [
          'user-read-private',
          'user-top-read',
          'playlist-modify-private',
          'user-read-recently-played',
          'user-read-currently-playing',
          'user-read-playback-state',
          'user-library-read',
          // Custom playlist cover upload (opt-in "Save to Spotify").
          'ugc-image-upload',
        ].join(' '),
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
      });

      window.location.href = `https://accounts.spotify.com/authorize?${params}`;
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Could not start Spotify sign-in. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="ambient-bg min-h-screen bg-[#0a0908] flex items-center justify-center px-6 overflow-hidden">
      <motion.div className="text-center max-w-md w-full">
        {/* Wordmark — "vibecheck." with the red accent period, kin to strummer.
            Each element gets its own initial/animate so they don't depend on
            parent stagger propagation (flaky after the v2.18 code-split). */}
        <motion.h1
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.165, 0.84, 0.44, 1] }}
          className="text-5xl sm:text-6xl font-bold text-white tracking-tighter mb-3"
          style={{ letterSpacing: '-0.04em' }}
        >
          vibe
          <span className="font-serif-accent italic" style={{ letterSpacing: '-0.02em' }}>
            check
          </span>
          <span className="wordmark-dot">.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1, ease: [0.165, 0.84, 0.44, 1] }}
          className="text-white/60 text-base sm:text-lg mb-10 font-light"
        >
          a portrait of your taste,{' '}
          <span className="font-serif-accent italic text-white/80">in one card.</span>
        </motion.p>

        {/* Auth / login error — surfaced instead of a silent bounce. */}
        {shownError && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            role="alert"
            className="mb-6 mx-auto max-w-sm rounded-xl px-4 py-3 text-sm text-left"
            style={{ background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.35)', color: '#fca5a5' }}
          >
            {shownError}
          </motion.div>
        )}

        {/* CTA — smaller pill, less candy, refined glow */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.2, ease: [0.165, 0.84, 0.44, 1] }}
        >
          <motion.button
            onClick={handleLogin}
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
            className="group relative bg-[#1DB954] text-black px-7 py-3 rounded-full text-base font-semibold hover:bg-[#1ed760] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_6px_24px_rgba(29,185,84,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1DB954] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0908]"
          >
            {loading ? (
              <span className="flex items-center gap-2.5">
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent" />
                Connecting…
              </span>
            ) : (
              <span className="flex items-center gap-2.5">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                </svg>
                Connect Spotify
              </span>
            )}
          </motion.button>

          {/* Set the expectation before they leave for Spotify's consent screen. */}
          <p className="mt-3 text-white/35 text-xs">
            we read your top tracks &amp; artists — nothing is posted without you.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.3, ease: [0.165, 0.84, 0.44, 1] }}
          className="mt-5"
        >
          <Link
            to="/explore"
            className="text-white/45 hover:text-white text-sm transition-colors focus-visible:outline-none focus-visible:underline"
          >
            no Spotify? explore other vibes →
          </Link>
        </motion.div>

        {/* How it works — refined icon cards, lucide instead of emoji */}
        <motion.div className="mt-14 grid grid-cols-3 gap-2.5 text-center">
          {[
            { Icon: Headphones, label: 'Connect' },
            { Icon: Sparkles, label: 'Analyze' },
            { Icon: Share2, label: 'Share' },
          ].map(({ Icon, label }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.45 + i * 0.08, ease: [0.165, 0.84, 0.44, 1] }}
              className="glass rounded-xl py-4 px-2 flex flex-col items-center gap-2"
            >
              <Icon className="w-4 h-4 text-white/70" strokeWidth={1.75} />
              <p className="text-white/65 text-[11px] uppercase tracking-wider">{label}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.55, delay: 0.85 }}
          className="text-white/25 text-[10px] uppercase tracking-[0.25em] mt-12"
        >
          vibecheck.style
        </motion.p>

        <Footer />
      </motion.div>
    </div>
  );
}
