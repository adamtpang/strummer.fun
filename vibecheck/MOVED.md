# vibecheck — moved here 2026-08-01

This is the **vibecheck** codebase (formerly `vibecheck.style`), parked inside strummer.fun
to be incorporated into the music stack later.

## What it is

"What does your music say about you?" — connect Spotify, get your vibe read back.

- `client/` — Vite + React front end
- `api/` — serverless routes: `vibe`, `share`, `og`, `users`
- Database: **Neon Postgres** (the app is stateful; connection string lives in the
  original project's env, not in this repo)

## Status

- **Domain `vibecheck.style` was released** (expired 2026-07-14, deliberately not renewed).
- The app ran at `vibecheck.strummer.fun` until its Vercel project was deleted on 2026-08-01.
- **Nothing was lost:** full history remains at `github.com/adamtpang/vibecheck.style`
  (branches `master` and `feat/onboarding-privacy-redesign`).

## To revive

Deploy this folder as its own project, or port `client/` into strummer.fun as a route and
re-point the API at the existing Neon database.
