import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, LockKeyhole, Disc3 } from 'lucide-react';
import type { User } from '../App';
import { CLIENT_ID } from '../utils/spotify-api';
import { rememberInvitation, validProfileId } from '../utils/invitation';


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
  const [params] = useSearchParams();
  const inviter = params.get('from');

  // If logged in, go to their vibe card
  useEffect(() => {
    if (user) {
      try { if (validProfileId(inviter) && inviter !== user.id) rememberInvitation(sessionStorage, inviter); }
      catch { setLoginError('Allow session storage to keep this invitation.'); return; }
      navigate(`/${user.id}`, { replace: true });
    }
  }, [user, navigate, inviter]);

  if (user && !loginError) return null;

  const shownError = loginError || authError;

  const handleLogin = async () => {
    setLoading(true);
    setLoginError(null);
    try {
      if (validProfileId(inviter)) rememberInvitation(sessionStorage, inviter);
      // crypto.subtle requires a secure context (https or localhost).
      if (!window.crypto?.subtle) {
        throw new Error('Your browser blocked secure sign-in. Open Strummer Vibe over https and try again.');
      }
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      const state = generateCodeVerifier();
      localStorage.setItem('code_verifier', codeVerifier);
      localStorage.setItem('oauth_state', state);
      localStorage.setItem('oauth_started_at', String(Date.now()));

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
          'playlist-read-private',
          'user-read-recently-played',
          'user-read-currently-playing',
          'user-read-playback-state',
          'user-library-read',
          // Custom playlist cover upload (opt-in "Save to Spotify").
          'ugc-image-upload',
        ].join(' '),
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
        state,
      });

      window.location.href = `https://accounts.spotify.com/authorize?${params}`;
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Could not start Spotify sign-in. Please try again.');
      setLoading(false);
    }
  };

  return (
    <section className="vibe-page vibe-welcome">
      <div className="welcome-heading">
        <p className="eyebrow">You, me, and the music</p>
        <h1>vibe<span className="font-serif-accent italic">check</span><span className="wordmark-dot">.</span></h1>
        <p className="welcome-description">Get to know someone through their music.</p>
      </div>

      <div className="welcome-actions">
        {shownError && <p role="alert" className="vibe-alert">{shownError}</p>}
        <button className="vibe-connect" onClick={handleLogin} disabled={loading}>
          <Disc3 size={19} aria-hidden="true" />
          {loading ? 'Connecting...' : inviter ? 'Connect Spotify to compare' : 'Connect Spotify'}
          <ArrowUpRight size={18} aria-hidden="true" />
        </button>
        <p className="welcome-privacy"><LockKeyhole size={13} aria-hidden="true" /> Private until you publish.</p>
        <p className="welcome-access">Spotify connections are currently invite-only.</p>
      </div>

      <div className="welcome-sample">
        <div className="section-heading"><h2>A taste of you</h2><span className="eyebrow">Sample card</span></div>
        <div className="sample-record">
          <div className="sample-record-heading">
            <img src={`${import.meta.env.BASE_URL}icon-192.png`} width="44" height="44" alt="" />
            <div><span className="eyebrow">My music says</span><p>Always coming back to these.</p></div>
          </div>
          <ol>
            {[['Kids', 'MGMT'], ['Everything Stays', 'Rebecca Sugar'], ["Don't Look Back in Anger", 'Oasis']].map(([title, artist], index) => (
              <li key={title}><span className="sample-rank">0{index + 1}</span><div><strong>{title}</strong><span>{artist}</span></div><Disc3 size={18} aria-hidden="true" /></li>
            ))}
          </ol>
          <div className="sample-record-footer"><span>strummer.fun/vibe</span><span>On repeat</span></div>
        </div>
      </div>

      <div className="welcome-links">
        <Link to="/explore">Explore public vibes<ArrowUpRight size={17} aria-hidden="true" /></Link>
        <a href="/vibe/card/make">Make a playlist card <ArrowUpRight size={17} aria-hidden="true" /></a>
      </div>
    </section>
  );
}
