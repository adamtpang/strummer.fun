import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="vibe-footer">
      <span>Music brings us closer.</span>
      <nav aria-label="Legal and project links">
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms</Link>
        <a href="https://github.com/adamtpang/strummer.fun" target="_blank" rel="noopener noreferrer">GitHub</a>
      </nav>
    </footer>
  );
}
