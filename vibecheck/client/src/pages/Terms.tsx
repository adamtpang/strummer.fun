import { Link } from 'react-router-dom';

const LAST_UPDATED = 'April 30, 2026';
const CONTACT_EMAIL = 'adamtpang@gmail.com';

export default function Terms() {
  return (
    <div className="min-h-screen bg-black text-white/80">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Link
          to="/"
          className="text-white/40 hover:text-white text-sm font-medium transition-colors inline-block mb-12"
        >
          ← vibecheck.style
        </Link>

        <h1 className="text-4xl font-bold text-white mb-3">Terms of Service</h1>
        <p className="text-white/40 text-sm mb-12">Last updated: {LAST_UPDATED}</p>

        <Section title="The short version">
          <p>
            vibecheck.style is a free tool that turns your Spotify history into
            a vibe card. Use it kindly. Don't try to break it. We provide it
            as-is. You own your data and can delete it any time.
          </p>
        </Section>

        <Section title="What vibecheck.style is">
          <p>
            vibecheck.style ("the Service") is a personal indie project that
            lets you connect your Spotify account, generate a "vibe card" from
            your listening data, and optionally display it publicly on
            /explore. The Service is operated by Adam Pang as an individual.
          </p>
        </Section>

        <Section title="Using the Service">
          <p>By using the Service you agree:</p>
          <ul className="list-disc pl-6 mt-3 space-y-1.5">
            <li>You're old enough to have a Spotify account in your jurisdiction</li>
            <li>You won't try to bypass authentication, scrape user data at scale, or attack the infrastructure</li>
            <li>You won't use vibecheck to harass, impersonate, or harm anyone else</li>
            <li>You won't use the Service for any commercial or automated purpose without explicit permission</li>
          </ul>
          <p className="mt-4">
            We may suspend or remove accounts that violate this in obvious ways.
            For an indie tool we lean toward "ask first, suspend last" — if
            something looks off, expect an email before any action.
          </p>
        </Section>

        <Section title="Your content and data">
          <p>
            You own your music taste. The vibe label, gradient, top tracks, and
            audio features we surface are derived from data Spotify provides
            about you, and you retain whatever rights you have in that
            underlying data.
          </p>
          <p className="mt-4">
            By making your card public (the default), you grant the Service a
            non-exclusive license to display it on /explore, in compatibility
            scoring with other users, and in the OG share preview when someone
            shares your URL. Flipping the privacy toggle to 🔒 Private revokes
            this license going forward and removes your card from public
            surfaces.
          </p>
        </Section>

        <Section title="Spotify">
          <p>
            vibecheck.style uses the Spotify Web API under Spotify's developer
            terms. Your continued use of the Service is also subject to
            Spotify's own terms (
            <a
              href="https://www.spotify.com/legal/end-user-agreement/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#1DB954] hover:underline"
            >
              spotify.com/legal/end-user-agreement
            </a>
            ). Spotify is not the developer of this app and isn't responsible
            for it.
          </p>
        </Section>

        <Section title="Service availability">
          <p>
            The Service is provided as-is, with no uptime guarantees. We may
            change, pause, or discontinue features at any time, with reasonable
            notice when feasible. If Spotify deprecates an API we depend on (as
            they did with audio-features for new apps in 2024), the vibe engine
            may degrade or break — that's outside our control.
          </p>
        </Section>

        <Section title="Account termination">
          <p>
            <strong>You can leave at any time</strong> by clicking "Delete my
            vibe" on your own card or by emailing{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#1DB954] hover:underline">
              {CONTACT_EMAIL}
            </a>
            . We'll remove your record from the database immediately
            (in-app) or within 7 days (email).
          </p>
          <p className="mt-4">
            We can also terminate or restrict access if there's clear evidence
            of abuse, fraud, or a violation of these terms.
          </p>
        </Section>

        <Section title="Limitation of liability">
          <p>
            vibecheck.style is offered free of charge and provided "as is."
            Adam Pang is not liable for any indirect, incidental, or
            consequential damages arising from your use of the Service. To the
            maximum extent permitted by law, the operator's total liability is
            limited to the amount you paid to use the Service — which, since
            it's free, is zero.
          </p>
        </Section>

        <Section title="Trademarks">
          <p>
            "Spotify" and the Spotify logo are trademarks of Spotify AB.
            vibecheck.style is an independent project and is not affiliated
            with, endorsed by, or sponsored by Spotify AB.
          </p>
        </Section>

        <Section title="Changes to these terms">
          <p>
            We may update these terms occasionally. The "last updated" date
            above always reflects the current version. If a change is material,
            we'll surface a notice on the site before it takes effect.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions, disputes, or anything else:{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#1DB954] hover:underline">
              {CONTACT_EMAIL}
            </a>
          </p>
        </Section>
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
