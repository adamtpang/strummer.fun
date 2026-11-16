import { useEffect, useRef, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ArrowUpRight, Disc3, Users } from 'lucide-react';
import type { User } from '../App';
import Footer from './Footer';

export default function VibeShell({ user, children }: { user: User | null; children: ReactNode }) {
  const { pathname } = useLocation();
  const main = useRef<HTMLElement>(null);
  const previousPath = useRef(pathname);

  useEffect(() => {
    if (previousPath.current !== pathname) {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      main.current?.focus({ preventScroll: true });
      previousPath.current = pathname;
    }
  }, [pathname]);

  return (
    <div className="vibe-app">
      <a className="skip-link" href="#vibe-content">Skip to content</a>
      <header className="vibe-header">
        <div className="vibe-header-inner">
          <Link to="/" className="vibe-brand" aria-label="Vibe by Strummer">
            <span className="vibe-brand-parent">strummer<span className="wordmark-dot">.</span></span>
            <span className="vibe-brand-divider" aria-hidden="true" />
            <span>vibe</span>
          </Link>
          <nav aria-label="Vibe" className="vibe-nav">
            <NavLink to={user ? `/${user.id}` : '/'} end>
              <Disc3 size={17} aria-hidden="true" /><span>{user ? 'My vibe' : 'Your vibe'}</span>
            </NavLink>
            <NavLink to="/explore"><Users size={17} aria-hidden="true" /><span>Explore</span></NavLink>
          </nav>
          <a className="studio-link" href="/">Studio <ArrowUpRight size={16} aria-hidden="true" /></a>
        </div>
      </header>
      <main ref={main} id="vibe-content" tabIndex={-1}>{children}</main>
      <Footer />
    </div>
  );
}
