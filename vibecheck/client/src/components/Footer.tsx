import { Link } from 'react-router-dom';

interface FooterProps {
  /** Optional override colors for placement on a non-black gradient page */
  textColor?: string;
}

export default function Footer({ textColor }: FooterProps = {}) {
  const linkStyle = textColor
    ? { color: `${textColor}60` }
    : undefined;
  const linkClass = textColor
    ? 'text-xs hover:underline transition-colors'
    : 'text-xs text-white/30 hover:text-white/60 transition-colors';

  return (
    <footer className="flex items-center justify-center gap-4 mt-12 pb-8 text-center">
      <Link to="/privacy" className={linkClass} style={linkStyle}>
        privacy
      </Link>
      <span className={linkClass} style={linkStyle}>
        ·
      </span>
      <Link to="/terms" className={linkClass} style={linkStyle}>
        terms
      </Link>
      <span className={linkClass} style={linkStyle}>
        ·
      </span>
      <a
        href="https://github.com/adamtpang/vibecheck.style"
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
        style={linkStyle}
      >
        github
      </a>
    </footer>
  );
}
