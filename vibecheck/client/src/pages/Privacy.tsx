import { Link } from 'react-router-dom';

const LAST_UPDATED = 'April 30, 2026';
const CONTACT_EMAIL = 'adamtpang@gmail.com';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-black text-white/80">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Link
          to="/"
          className="text-white/40 hover:text-white text-sm font-medium transition-colors inline-block mb-12"
        >
          ← vibecheck.style
        </Link>

        <h1 className="text-4xl font-bold text-white mb-3">Privacy Policy</h1>
        <p className="text-white/40 text-sm mb-12">Last updated: {LAST_UPDATED}</p>

        <Section title="The short version">
          <p>
            vibecheck.style is a tool that turns your Spotify listening history
            into a sharable "vibe card." We need a small amount of data from
            Spotify to do that. We don't sell it, we don't show ads, and you can
            delete everything we've stored about you at any time from your own
            profile page.
          </p>
        </Section>

        <Section title="What we collect">
          <p>When you log in with Spotify, we receive and store:</p>
          <ul className="list-disc pl-6 mt-3 space-y-1.5">
            <li>Your Spotify display name, user ID, and profile picture URL</li>
            <li>Your top tracks (across short, medium, and long time ranges)</li>
            <li>The audio features (energy, valence, danceability, etc.) for those tracks</li>
            <li>Your top genres, derived from those tracks</li>
            <li>The Spotify playlist ID that vibecheck creates on your behalf, if you opt in</li>
            <li>An access + refresh token from Spotify (held in your browser's localStorage, not on our servers)</li>
          </ul>
          <p className="mt-4">
            We do <strong>not</strong> collect your email, real name, location,
            payment details, listening history beyond top tracks, or anything
            else outside what's listed above.
          </p>
        </Section>

        <Section title="Where it lives">
          <p>
            Your vibe data is stored in a Neon Postgres database hosted in the
            United States (us-east-1). The site itself is served from Vercel's
            edge network. Spotify access tokens never leave your browser; they
            sit in localStorage and are sent directly to the Spotify API from
            your device.
          </p>
        </Section>

        <Section title="How it's used">
          <p>We use your data only to:</p>
          <ul className="list-disc pl-6 mt-3 space-y-1.5">
            <li>Generate and display your vibe card</li>
            <li>Show your card to people who visit your profile URL (unless you flip privacy off)</li>
            <li>List you in the public /explore directory (unless you flip privacy off)</li>
            <li>Compute compatibility scores between you and other users</li>
            <li>Render the per-user OG image when someone shares your link</li>
          </ul>
          <p className="mt-4">
            That's the entire list. We don't run analytics on your taste, train
            models on it, or share it with third parties.
          </p>
        </Section>

        <Section title="Privacy controls">
          <p>You can flip a 🌍 Public / 🔒 Private toggle on your own card at any time:</p>
          <ul className="list-disc pl-6 mt-3 space-y-1.5">
            <li><strong>Public</strong> (default): your card appears on /explore and renders rich previews when shared</li>
            <li><strong>Private</strong>: hidden from /explore, share previews fall back to a generic vibecheck image, and visitors to your URL see a "private vibe" page instead of your card</li>
          </ul>
        </Section>

        <Section title="Deleting your data">
          <p>
            On your own vibe card you'll find a "Delete my vibe" button. Clicking
            it removes your row from our database immediately. Since your Spotify
            tokens only live in your browser, logging out clears those locally
            too. Nothing about you stays on our servers after deletion.
          </p>
          <p className="mt-4">
            You can also revoke vibecheck.style's access to your Spotify account
            at any time at{' '}
            <a
              href="https://www.spotify.com/account/apps/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#1DB954] hover:underline"
            >
              spotify.com/account/apps
            </a>
            .
          </p>
          <p className="mt-4">
            If for any reason the in-app delete doesn't work, email{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#1DB954] hover:underline">
              {CONTACT_EMAIL}
            </a>{' '}
            and we'll remove your record manually within 7 days.
          </p>
        </Section>

        <Section title="Third-party services">
          <p>vibecheck.style relies on three external providers:</p>
          <ul className="list-disc pl-6 mt-3 space-y-1.5">
            <li>
              <strong>Spotify Web API</strong> — for OAuth login, your top tracks,
              audio features, and to create the optional playlist on your behalf.
              Spotify's privacy policy applies to that data flow:{' '}
              <a
                href="https://www.spotify.com/legal/privacy-policy/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1DB954] hover:underline"
              >
                spotify.com/legal/privacy-policy
              </a>
            </li>
            <li><strong>Vercel</strong> — hosting, edge functions, OG image rendering</li>
            <li><strong>Neon</strong> — Postgres database for vibe storage</li>
          </ul>
        </Section>

        <Section title="Cookies and tracking">
          <p>
            We don't set tracking cookies. We don't run Google Analytics, Meta
            Pixel, or any third-party tag. The only client-side storage we use
            is localStorage, and it only holds your Spotify access/refresh
            tokens and your cached user profile so you stay logged in between
            visits.
          </p>
        </Section>

        <Section title="Children">
          <p>
            vibecheck.style is not directed at children under 13, and we don't
            knowingly collect data from them. Spotify's terms already require
            users to be old enough — we inherit that gate.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            If we change anything material, we'll update the "last updated" date
            above and, if your data handling is affected, surface a notice on
            the site before the change takes effect.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions, concerns, or deletion requests:{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#1DB954] hover:underline">
              {CONTACT_EMAIL}
            </a>
          </p>
        </Section>

        <p className="text-white/30 text-xs mt-16">
          vibecheck.style is an independent project and is not affiliated with,
          endorsed by, or sponsored by Spotify AB. "Spotify" is a trademark of
          Spotify AB.
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold text-white mb-3">{title}</h2>
      <div className="text-white/70 leading-relaxed text-[15px]">{children}</div>
    </section>
  );
}
