import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Globe } from 'lucide-react';
import type { VibeData } from '../utils/api';
import { readInvitation, forgetInvitation, comparisonPath } from '../utils/invitation';
import CopyLink from './CopyLink';

type FriendActionsProps = { vibe: VibeData; onPublish: () => Promise<void> };

export default function FriendActions({ vibe, onPublish }: FriendActionsProps) {
  const [inviter, setInviter] = useState(() => {
    try { return readInvitation(sessionStorage); } catch { return null; }
  });
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const friend = inviter && inviter !== vibe.spotify_id ? inviter : null;
  const isPrivate = vibe.is_public === false;
  async function publish() {
    setPublishing(true);
    setError('');
    try { await onPublish(); }
    catch { setError('Your profile was not published. Please try again.'); }
    finally { setPublishing(false); }
  }
  return <section className="friend-actions" aria-labelledby="friend-heading">
    <div className="section-heading"><h2 id="friend-heading">{friend ? 'Your invitation' : 'Music is better shared'}</h2><Users size={20} aria-hidden="true" /></div>
    {friend && <Link className="friend-secondary" to={comparisonPath(friend, vibe.spotify_id)}>Compare with your friend</Link>}
    {isPrivate ? <>
      <p className="friend-note">Your vibe is private. Publishing makes your songs and profile visible to everyone, including Explore. Your Spotify playlist stays private.</p>
      <button type="button" className="profile-share-button" onClick={publish} disabled={publishing}>
        <Globe size={18} aria-hidden="true" />{publishing ? 'Publishing...' : 'Publish my vibe'}
      </button>
    </> : <>
      <CopyLink primary url={`${window.location.origin}/vibe/invite/${encodeURIComponent(vibe.spotify_id)}`} label="Copy friend invitation" />
      {friend && <Link className="friend-secondary" to={comparisonPath(friend, vibe.spotify_id)}>Open comparison to share back</Link>}
    </>}
    {error && <p role="alert" className="vibe-alert">{error}</p>}
    {friend && <button className="friend-dismiss" onClick={() => { forgetInvitation(sessionStorage); setInviter(null); }}>Dismiss invitation</button>}
  </section>;
}
