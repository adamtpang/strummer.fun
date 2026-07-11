# HANDOFF — Strummer web player session (Claude Code)

Exported 2026-07-10 for merging into another Claude Code session. Self-contained:
everything needed to continue without the original chat.

---

## 1. What Strummer is now (final state of this session)

**Strummer = "web3 Spotify": an aggregating web music player, live at https://strummer.fun.**

- Thesis: Chris Dixon's *Read Write Own* — "their take rate is my opportunity."
  Artists keep what they earn; listeners own their library/taste/identity,
  portable across clients. Web2 platforms kept the network, data, and money —
  Strummer is the "Own" era client for music.
- Wedge vs Spotify: (a) catalog gaps — songs Spotify doesn't have (e.g. "Love
  Soon" by John Mayer, which lives on YouTube), (b) artist economics, (c) no
  lock-in. Spotify import planned as the v2 switching-cost killer (Helium
  import-from-Chrome pattern).
- Napster/LimeWire lesson (core legal stance): **aggregate via platforms'
  sanctioned APIs/embeds — never rip audio streams.** Ripping is legally gray
  AND the root cause of Nuclear's unreliable playback (YouTube extraction
  breaking). "Embed, don't rip."

### Pivot history (do not relitigate)
1. Started as a fork of Nuclear (Tauri desktop music aggregator) — parked.
2. Briefly "AI GuitarTuna" (chords/lyrics learning app) — superseded same day.
3. Now: web3 aggregating web player. This matches the original README's v3
   ("Helium of music", Read Write Own) — the endgame pulled forward.
4. Nuclear's *aggregation ideas* are relevant reference again, but its codebase
   is NOT the base. The product is a clean static SPA.

---

## 2. The codebase (canonical locations)

**Product code: `C:\Users\adamp\dev\strummer.fun\`** — clean static SPA, no build step:
- `index.html` — app shell (sidebar / main / player bar / modal / toast)
- `styles.css` — full design system (~600 lines, CSS vars, dark neo-editorial)
- `app.js` — engine + UI (~600 lines vanilla JS)
- `.vercel/project.json` — links to Vercel project `strummer`
  (`projectId prj_Ym97xlAIIQl0q8FobBjWdIZPJncH`, `orgId team_94z2L2r0X8hywHS0hi2ahkW7`)
- `_legacy/` was moved to `C:\Users\adamp\dev\_strummer_legacy_bak\landing-v0.html`
  (the original static landing page, superseded)

**NOT git-initialized yet.** GitHub repo `adamtpang/strummer.fun` exists but
contains the OLD Nuclear fork (Tauri monorepo, "Web3 Spotify." description).
Open decision below (§7).

`C:\Users\adamp\OneDrive\Aether\strummer.fun\` = the old Nuclear monorepo
working copy + project docs (README, CLAUDE.md). The OneDrive `index.html`
there is the old landing page — now out of date vs the dev copy.

### Design language
- Dark editorial: bg `#0a0908`, fg `#f5f5f4`, accent red `#dc2626`
- Fonts: Instrument Serif (italic, display), Inter (UI), JetBrains Mono (meta)
- Wordmark: `strummer.` with pulsing red period; "the future is unwritten"
- Spotify-style 3-pane: sidebar (nav + library) / main (hero, cards, tracklist)
  / bottom player bar. Modals for wallet/collect/import. Toast notifications.
- Mobile breakpoint 640px (was 880 — lowered because Adam's 175% Windows
  scaling gives ~730px CSS viewport; sidebar must show on desktop).

---

## 3. Audius integration (verified working)

Keyless, legal (artist-uploaded, decentralized), CORS `*` so client-side fetch
works with no proxy:

- Base: `https://api.audius.co/v1` — every request needs `&app_name=strummer`
- Trending: `GET /tracks/trending` → 100 tracks
- Search: `GET /tracks/search?query=…`
- Stream: `GET /tracks/{id}/stream` → 302→302→`audio/mpeg` (206 range-capable)
- Track fields used: `id, title, user.name, genre, duration, artwork['480x480'|'150x150'], play_count`
- App maps these via `mapTrack()`; artwork falls back to seeded gradient tiles
  (`hashSeed(id) % PALETTES.length`) with an `onerror` self-removing `<img>`.

**Verified with real data:** RAC, ODESZA search results; trending top track
"Van Snyder & Terry Golden - Sandstorm (Radio Edit)"; stream returns valid
ID3v2.4 mp3 (6.3MB, decodes to 159s 48kHz stereo).

---

## 4. THE critical engineering fact — Web Audio engine

**A raw `<audio>` element CANNOT play these streams.** `audio.src = streamUrl`
(or even a fully-downloaded `blob:` URL) leaves `readyState` stuck at 0,
`duration` null, and `audio.play()` never resolves (it hard-froze the renderer
twice during debugging). The bytes are fine — `decodeAudioData` decodes them
perfectly. It's the media-element pipeline that stalls.

**Shipped engine (in `app.js`):**
```
fetch(streamUrl) → arrayBuffer → ac.decodeAudioData → AudioBufferSourceNode
  → GainNode (volume) → destination
```
- Position tracking: `pausedOffset + (ac.currentTime - startedAt)`
- Pause = capture position, stop source. Seek = stop + restart at offset.
  (Buffer sources are one-shot; `endedGuard` flag distinguishes natural end
  from manual stop so `onended` doesn't double-fire `next()`.)
- Progress UI via `requestAnimationFrame`.
- `loadSeq` guards stale async loads on rapid skips; `failStreak > 5` stops
  infinite skip loops; decode-on-demand only (decoded PCM ~60MB/track — never
  pre-decode the whole list).
- AudioContext created lazily in `ensureCtx()` + capture-phase
  `pointerdown`/`keydown` document listeners to unlock on first real gesture
  (https autoplay policy: context starts `suspended` until user activation).

### Verification status (be precise about this)
- **localhost (http): fully verified end-to-end** — real OS click → clock
  advanced 0:00→0:27, `acState running`, `pos 13.7`, audible.
- **Search verified**: "ODESZA" → 10 real results rendered.
- **Live https site: code loads with zero console errors; isolated Web Audio
  context on the live page plays fine (elapsed 2.51s); but the final
  click→sound step could NOT be auto-verified** because CDP/extension-
  synthesized clicks do not carry the user-activation Chrome's https autoplay
  policy requires — the app goes to "playing" state but its AudioContext stays
  suspended (clock 0:00). This is an automation artifact, not a code bug. A
  real human click is expected to work; **Adam had not yet confirmed by ear at
  session end.** If he reports silence, first suspect: the app's context was
  created suspended and `resume()` inside the click handler needs to be awaited
  before `srcNode.start()` — try making `ensureCtx()` async-await the resume.

---

## 5. Deploy workflow (Vercel)

- **Always deploy from `C:\Users\adamp\dev\strummer.fun\`** — NEVER from
  OneDrive paths: Vercel CLI fails from OneDrive dirs with phantom multi-GB
  "File size greater than 2 GiB" errors (OneDrive placeholder metadata).
- Command: `vercel deploy --prod --yes --scope adamtpangs-projects`
- Domain `strummer.fun`: registered THROUGH Vercel (registrar=Vercel,
  ns1/ns2.vercel-dns.com auto-wired), attached to project `strummer`, renewal
  $27/yr, expires 2027-05-09. Prod alias updates on every deploy.
- Vercel team: `adamtpangs-projects` (`team_94z2L2r0X8hywHS0hi2ahkW7`).
- Latest prod deploy at export time: `dpl_…` from the Web Audio engine build
  (aliased to strummer.fun, all assets 200, zero console errors).

---

## 6. What's live on strummer.fun right now

- Hero: "The streaming player where artists keep what they earn." + eyebrow
  "own your music · not your platform's" + CTAs **Play trending** / **Import
  from Spotify** (import = vision modal, not functional).
- Featured cards (top 6 trending, real artwork) + "Trending on Audius"
  tracklist (30 tracks) + "Read. Write. Own." explainer strip.
- Sidebar library: Trending (live) / Your Collection (stub) / Liked Songs
  (session-only Set) / Electronic + Hip-Hop (canned genre searches).
- Full transport: play/pause/seek/next/prev/shuffle/repeat/volume, keyboard
  (Space/←/→), animated EQ bars on the playing row, buffering spinner.
- "Own" affordances: per-track **Collect** buttons + "supports {artist}"
  link → Collect/Connect-wallet modals (explicitly labeled "ships in v1 ·
  this is the vision" — honest stubs, not fake functionality).
- Search: debounced 320ms, live Audius results, empty/error states.
- All user-generated strings HTML-escaped (`esc()`); track IDs from Audius.

---

## 7. Open decisions (Adam's calls, pending at export)

1. **GitHub repo strategy** — `adamtpang/strummer.fun` currently = old Nuclear
   fork (public, described "Web3 Spotify."). Options: overwrite it with the new
   SPA (keeps name/URL, loses fork history) vs fresh repo vs rename old. Was
   asked, not yet answered. Then: git init the dev dir, push, optionally wire
   Vercel git integration (kills manual-deploy step).
2. **YouTube for the long tail** ("Love Soon" use case) — plan: YouTube
   **IFrame embed API** (sanctioned; rightsholders paid via YouTube's licenses;
   NOT youtube-dl ripping). Needs a YouTube Data API key from Adam for search.
   Design note: IFrame audio can't route through Web Audio — it plays in the
   embed; treat YouTube tracks as a second source type with its own player path
   and a visible `YouTube` source tag (there's already a `src-tag` UI element).
3. **Wallet/collect (v1)** — real wallet connect + on-chain collect. Audius has
   $AUDIO tipping; Sound.xyz-style collects are the reference pattern.
4. **Spotify import (v2)** — OAuth + playlist/liked-songs import, matched
   against Audius (and later YouTube) catalog.
5. **OneDrive copy of index.html** is stale (old landing page) — decide whether
   to sync dev→OneDrive or let the git repo become the single source of truth.

---

## 8. Adjacent work (other sessions — merge context)

- **Toastify port**: GPLv2 .NET 8 rebuild of the 2011 Spotify hotkey/toast
  app, vendored at `toastify/` inside the strummer.fun OneDrive repo. SMTC
  control, JSON settings. (Separate memory: `toastify_port.md`.)
- **Tauri desktop app** (old Nuclear-fork direction): still blocked on Windows
  SDK not installed (VS Installer → Windows 11 SDK 10.0.22621). Helper batch
  at `C:\Users\adamp\dev\strummer\run-tauri-dev.bat`. Considered PARKED unless
  Adam revives desktop.
- Persistent memories already saved under
  `C:\Users\adamp\.claude\projects\C--Users-adamp-OneDrive-Aether-strummer-fun\memory\`:
  `deploy_outside_onedrive.md`, `domains_registered_via_vercel.md`,
  `strummer_setup.md`, `strummer_web3_spotify.md`, `strummer_audio_engine.md`,
  `toastify_port.md` — a session in this project dir auto-loads the index.

---

## 9. Suggested immediate next steps (in priority order)

1. Adam clicks Play on https://strummer.fun with a real mouse → confirm sound.
   (If silent: await `ac.resume()` before `srcNode.start()` — see §4.)
2. Repo decision (§7.1) → git init `C:\Users\adamp\dev\strummer.fun`, push,
   wire Vercel git integration, add README/LICENSE/issue templates (the "open
   development" brand promise).
3. YouTube embed source for catalog gaps (§7.2) — the "play anything" promise.
4. localStorage persistence for likes/collection (currently session-only Sets).
5. Artist pages + queue view (toasts say "coming soon").
6. Media Session API (OS media keys / lock-screen metadata) — cheap win.
