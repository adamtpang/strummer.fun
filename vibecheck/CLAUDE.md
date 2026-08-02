# CLAUDE.md — vibecheck.style

Handoff for Claude Code, Codex, and humans. Source of truth for current state.

## What this is

A Spotify "what does your music say about you" web app: connect Spotify → get a
**vibe card** (label, dynamic gradient, top tracks/artists/genres, taste
metrics) at `/{spotify_id}`. Social layer: `/explore` directory, `/compare`,
OG share images, story-image generator. Part of Adam's music suite alongside
strummer.fun.

## Stack (verify before trusting older docs)

- **Client:** Vite 4 + React 18 + TypeScript, Tailwind 3, framer-motion,
  react-router 6. Lives in `client/`. Build: `cd client && npm run build`
  (note: build does NOT run tsc — run `npx tsc --noEmit` to type-check).
- **API:** Vercel serverless functions in `api/` (NOT the Express `server.js`,
  which is legacy/local-only). Neon Postgres (project `bold-meadow-73618620`),
  single `users` table.
- **Auth:** Spotify PKCE, 100% client-side; tokens in localStorage. No server
  session (README/AGENTS claims of express-session are STALE).
- **Deploy:** Vercel project `vibecheck.style` (team adamtpangs-projects).
  Domain not yet pointed at the app (still the parked 🎵 page as of 2026-07-11).

## 2026-07-11 — onboarding + privacy + redesign pass (branch `feat/onboarding-privacy-redesign`)

Three goals: new people can use it, aesthetic redesign, optional data sharing.

**Privacy / security (server + client):**
- `GET /api/vibe/:id` now has a real privacy gate — a private row only returns
  full data to the authenticated owner; everyone else gets `{spotify_id,
  display_name, avatar_url, is_public:false}`. Fixes the leak where private
  users' tracks/artists were served to anyone. Private responses are `no-store`.
- `POST /api/vibe` is now owner-gated (Spotify Bearer token validated against
  `/v1/me`, id must match) via new `api/_lib/spotify-auth.js`. Kills the
  unauthenticated overwrite / de-privatize hole.
- Privacy toggle now uses a dedicated `PATCH /api/vibe/:id {is_public}` (owner-
  gated) instead of a full-row POST round-trip that could clobber vibe data.
- Sharing default stays **public with a one-tap hide** (product decision), but
  private now genuinely means private.

**Spotify playlist is opt-in:** generating a vibe no longer auto-writes a
playlist to the user's account. New "Save to Spotify" button
(`createSpotifyPlaylist` in `VibeCard.tsx`) does it on demand.

**Onboarding / error visibility:** OAuth failures were silent (localStorage
wiped, bounced to `/`). Now App.tsx surfaces them, including the **dev-mode 403**
(`/v1/me` 403 = account not on Spotify allowlist) with an explicit invite-only
message. `?error=access_denied` shows a message and cleans the URL. Home shows
login errors, a consent expectation line, and a clearer no-Spotify explore path.
Error state on the card has a retry button.

**Redesign (aligned to strummer.fun):** warm near-black `#0a0908` + bone-white
`#f5f5f4` (was pure black/white), `vibecheck.` wordmark with a **red accent
period** (`.wordmark-dot`, kin to `strummer.`). Tokens in `client/src/index.css`
`:root`; direction documented in `brand.md`. Note: `client/DESIGN_SYSTEM.md` is
STALE (documents a burgundy palette + files that don't exist) — ignore it.

Verified: `tsc --noEmit` clean, `vite build` clean, landing renders correct
(warm bg, red period, error banner, URL cleanup) via local dev.

## Founder-only follow-ups (Adam)

1. **Spotify allowlist / extended quota** — the #1 "new people can't use it"
   blocker. Non-allowlisted users hit Spotify's 403 wall. Add testers'
   emails in the Spotify dashboard, or request extended quota. I can't do this.
2. **Rotate committed secrets** — the tracked root `.env` (with
   `SPOTIFY_CLIENT_SECRET`) is in the public GitHub repo history. Rotate the
   Spotify client secret + `SESSION_SECRET`, and `git rm --cached .env`.
3. **Deploy + point the domain** — merge the branch, deploy the Vercel project,
   and attach vibecheck.style (currently parked).

## How to keep this useful

Update this file after meaningful progress; keep `AGENTS.md` in sync for Codex.
Prefer concrete project facts over generic instructions.
