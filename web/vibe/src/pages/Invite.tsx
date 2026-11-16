import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Disc3 } from 'lucide-react';
import { getVibe, type VibeData } from '../utils/api';
import { spotifyTrackUrl, validProfileId } from '../utils/invitation';

export default function Invite() {
  const { inviterId } = useParams();
  const [vibe, setVibe] = useState<VibeData | null>(null);
  const [status, setStatus] = useState('Loading invitation...');
  useEffect(() => {
    let cancelled = false;
    setVibe(null);
    setStatus('Loading invitation...');
    if (!validProfileId(inviterId)) { setStatus('This invitation is invalid.'); return; }
    getVibe(inviterId).then(profile => {
      if (cancelled) return;
      if (!profile || profile.is_public === false) { setStatus('This invitation is unavailable. The profile may be private.'); return; }
      setVibe(profile);
      setStatus('');
    }).catch(() => { if (!cancelled) setStatus('Could not load this invitation. Please refresh to try again.'); });
    return () => { cancelled = true; };
  }, [inviterId]);
  return <section className="vibe-page friend-invite">
    <p className="eyebrow">A music invitation</p>
    <h1>{vibe ? `${vibe.display_name} wants to hear your world.` : 'Check our vibes.'}</h1>
    {status && <p role="status" className="friend-note">{status}</p>}
    {vibe && <>
      <Link to={`/${encodeURIComponent(vibe.spotify_id)}`} className="friend-identity">
        {vibe.avatar_url ? <img src={vibe.avatar_url} alt="" width="48" height="48" /> : <Disc3 size={32} aria-hidden="true" />}
        <span><strong>{vibe.display_name}</strong><span>{vibe.vibe_label || 'Listen to my vibe'}</span></span><ArrowRight size={18} aria-hidden="true" />
      </Link>
      <ol className="invite-tracks">{(vibe.top_tracks || []).slice(0, 3).map((track, index) => {
        const url = spotifyTrackUrl(track);
        return <li key={index}><span className="sample-rank">0{index + 1}</span>
          {track.albumArt && <img src={track.albumArt} alt="" width="48" height="48" />}
          <div><strong>{track.name}</strong><span>{track.artist}</span></div>
          {url && <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Listen to ${track.name} on Spotify`}><ArrowRight size={18} aria-hidden="true" /></a>}
        </li>;
      })}</ol>
      <Link className="profile-share-button" to={`/?from=${encodeURIComponent(vibe.spotify_id)}`}>Check our vibes <ArrowRight size={18} aria-hidden="true" /></Link>
      <p className="friend-note">Private until you publish. Nothing is sent automatically.</p>
      <p className="friend-note">Spotify sign-in currently requires separate approval from the app owner. This link does not grant Spotify access.</p>
    </>}
    {!vibe && <Link className="friend-secondary" to="/">Go to Vibe</Link>}
  </section>;
}
