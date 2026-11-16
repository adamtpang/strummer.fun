import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

type CopyLinkProps = { url: string; label: string; primary?: boolean };

export default function CopyLink({ url, label, primary = false }: CopyLinkProps) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  async function copy() {
    setCopied(false);
    setFailed(false);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch { setFailed(true); }
  }
  return <div className="friend-copy">
    <button type="button" className={primary ? 'profile-share-button' : 'friend-secondary'} onClick={copy}>
      {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
      {label}
    </button>
    <span role="status" className="friend-status">{copied ? 'Link copied' : ''}</span>
    {failed && <label className="friend-copy-fallback">Copy this link
      <input readOnly value={url} onFocus={event => event.target.select()} />
    </label>}
  </div>;
}
