# Strummer Studio

Strummer's songwriting tools are instruments, not marketing pages. This is the web product's own system, distinct from the historical Nuclear component bundle and Pacifica's artist identity.

## Loud - November 15, 2026 (current, local only, awaiting Adam's review)

Adam chose the "Loud" language over Studio for the whole site. It is applied through `web/chords/tokens.css`, so every route that reads the tokens changed together. Where this section and "Visual language" below disagree, this section wins.

- Near-black surfaces, white text. Lime (`--studio-accent`) is the one action color and always carries dark text (`--studio-on-accent`), never white. Pink (`--studio-playing`) marks active, playing and readings. Violet (`--studio-pop`) is the block behind a listener's headline label.
- Display type is self-hosted Archivo Black (`web/fonts`, OFL), registered as `Strummer Display` for every weight and for italic, so older `italic ... var(--studio-display)` rules render it upright. Inter for controls, JetBrains Mono for numbers and metadata. Instrument Serif is no longer loaded by Vibe; the static pages still request it and no longer use it.
- Pills (`--studio-radius-pill`) for Vibe's primary and secondary buttons. Controls elsewhere use `--studio-radius` (10px).
- Paper (receipts, the sample card) stays the one light surface.
- Checked by screenshot on sample data: Vibe home and profile, site home, chords, receipts, tuner. Not checked: Vibe compare, explore, invite and story export, the learn page, phone widths other than the profile, and contrast measurements.

## Visual language

- Neutral charcoal surfaces, off-white text, red primary actions, mint active notes. Avoid brown/espresso drift, gradients and decorative color bands.
- Instrument Serif for the italic strummer. wordmark, page titles and chord names. Inter for controls. JetBrains Mono for scale degrees, tempo and saved progressions. System fallbacks remain usable without external fonts.
- Shared tokens: web/chords/tokens.css. Chords, Learn, Receipts, Vibe, and the main player stylesheet now consume these tokens. The player stylesheet also supplies Tune and the main information pages. Tool-specific layouts remain distinct.
- Flat page sections with rules, 6px corners only for controls and repeated chord modules. No nested cards or oversized hero.
- Four chord modules on desktop, two columns on phones. Actual piano key geometry; mint highlights represent chord pitches. Do not imply guitar fingerings or AI-generated performances.
- 44px minimum primary targets, explicit labels, persistent visible keyboard focus, accessible status messages. No negative tracking or viewport-scaled type.
- Color never carries state alone: playback button text and pressed state, checkboxes for kept chords, accessible names for note diagrams.
- 120ms interaction changes, no ornamental animation. Respect reduced motion.

## Tokens - November 15, 2026

`web/chords/tokens.css` is the single source. Use a token before writing a raw value; add a token there if one is missing.

| Group | Tokens | Use |
| --- | --- | --- |
| Surfaces | `--studio-bg`, `-surface`, `-raised`, `-elevated` | Page, section, control, popover, darkest to lightest |
| Text | `--studio-text`, `-text-soft`, `-muted` | Body, longer secondary copy, labels and metadata |
| Rules | `--studio-border`, `-border-strong` | Dividers and control outlines |
| Action | `--studio-accent`, `-accent-hover`, `-accent-dim`, `-on-accent` | Lime is the only action color, with dark text on it |
| State | `--studio-playing`, `-focus`, `-danger-text`, `-pop`, `-on-pop` | Pink for active, playing and readings; violet for headline label blocks |
| Spotify | `--studio-spotify`, `-spotify-hover`, `-on-spotify` | Only on controls that go to Spotify |
| Paper | `--studio-paper`, `-paper-text`, `-paper-muted`, `-paper-rule`, `-paper-accent` | The one light surface: receipts and sample cards |
| Type | `--studio-display`, `-ui`, `-mono`; sizes `-text-xs` 11, `-text-sm` 13, `-text-md` 14, `-text-lg` 16; titles `-title-sm` 28, `-title-md` 36, `-title-lg` 48 | Serif names and titles, sans controls, mono numbers |
| Space | `--studio-space-1` to `-8`: 4, 8, 12, 16, 24, 32, 48, 64 | 4px grid |
| Shape and motion | `--studio-radius` 10, `-radius-sm` 6, `-radius-pill`, `-target` 44, `-measure` 736, `-page` 1060, `-quick` 120ms | Controls, reading width, page width, interaction timing |

Vibe's `--vc-*` names are aliases of these tokens. Its stylesheet holds no raw colors except the legacy `#0a0908` selector it rewrites. Listener gradients on profile tiles and stories are data, not tokens. Profile meters are a mono number, a label and a thin mint level (`.vibe-meter`).

Not yet migrated to the new tokens: raw Spotify greens and reds inside `VibeCard.tsx`, `Compare.tsx` and `Explore.tsx` class names, and the type and space scales outside Vibe's meters.

## Claude and Codex implementation contract

Read this file before adding web music tools. Reuse the token names and existing typography. Do not introduce a page-specific brand palette or import Nuclear's design-sync package as Strummer's brand. Preserve behavior when restyling. Verify desktop/mobile screenshots, keyboard focus, overflow and playback/save regression tests. Claim visual approval only after Adam reviews it. Scores do not establish artistic perfection.

## Vibe interface - October 18, 2026

- `web/vibe/src/components/VibeShell.tsx` owns the shared navigation, main landmark, route focus, and footer for all React Vibe routes. Pages own only their content.
- Serif page headings, Inter controls, mono metadata; neutral surfaces, red creation actions, mint active navigation. Spotify green is reserved for Spotify actions. Personal gradients belong to profile tiles and exported stories.
- The homepage sample is explicitly labeled. It is illustrative, not the viewer's Spotify data.
- Immediate pressed feedback, short opacity entrances, critically damped hover springs, user-controlled reduced motion, solid materials when reduced transparency is enabled.
- Story close restores focus to its initiating control. Theme and time-range controls expose pressed state. Shared buttons have 44px minimum targets.
- The standalone playlist maker uses matching colors and dimensions, with system font fallbacks to preserve its restrictive, self-hosted-only style policy. Embedded playlist cards retain their independent light/dark preference.
- Preview: `web/vibe` runs Vite on port 4392. `node web/preview-studio.mjs` serves an allowlisted static suite on port 4394. Neither preview publishes content. API-backed design checks use local fixtures, not a signed-in Spotify account.
- Browser checks: `web/test/vibe-design-check.py` covers Vibe routes at 1440, 390, and 320px. `web/test/vibe-browser-check.py` covers story rendering, file sharing, and keyboard behavior. Run with the isolated Helium agent.
- These changes require review and a separate authorized deployment before they appear on the live site.

## Friend-first Vibe - October 19, 2026

- The primary owner action is publishing a private draft, then copying a friend invitation. Instagram Stories is secondary.
- `/vibe/invite/:inviterId` previews a public profile and its first three songs. The recipient explicitly continues to Spotify connection. The inviter survives the OAuth redirect in tab-scoped session storage, expires after seven days, and can be dismissed.
- The recipient can compare privately, then choose to publish. A comparison link is copyable only when both loaded profiles are public. There is no automatic message, friend inbox, or recipient notification; the recipient copies the comparison link back manually.
- Profiles save up to 20 tracks on regeneration, with five initially visible and direct Spotify track links. Previously saved profiles retain their existing track count until refreshed. The optional Spotify playlist remains private and separate from the public song list.
- Scores are explicitly listening-pattern/genre similarity, not personality compatibility or audio analysis. Incomplete metrics suppress the comparison score. No changes to OAuth scopes, server authorization, database schema, or Spotify playlist privacy.
- `web/test/vibe-friends-check.py` tests invitation, a mocked OAuth callback, publishing success/failure, comparison copying, private-profile gates, clipboard fallback, song expansion, phone layouts, and keyboard focus using synthetic local data only.
- Still requires an authorized deployment and Spotify access approval for each friend while the app remains in development mode. The Vite-only local preview cannot serve live profiles without its API backend.
