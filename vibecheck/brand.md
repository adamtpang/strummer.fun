# Brand — vibecheck.style

_Status: active — defined 2026-07-11 during the new-user/redesign/privacy pass_

**One line:** a portrait of your taste, in one card. Dark editorial chrome; the
user's own listening data provides the color.

## Palette

The chrome is deliberately near-monochrome so each user's dynamic vibe gradient
(computed in `client/src/utils/vibe-colors.ts`) is the only saturated thing on
screen.

| Token | Value | Use |
| --- | --- | --- |
| `--vc-bg` | `#0a0908` | Page background (warm near-black, shared with strummer.fun) |
| `--vc-fg` | `#f5f5f4` | Primary text |
| `--vc-accent` | `#dc2626` | The wordmark period, active states, rare emphasis. Never large fills. |
| `--vc-spotify` | `#1DB954` | ONLY the "Connect Spotify" action and Spotify-specific affordances (brand recognition). Not a general accent. |
| `--vc-fallback-gradient` | `linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)` | Cards with no vibe data |
| Text alpha tiers | `white/90`, `/70`, `/45`, `/25` | Hierarchy on black — never gray-on-gray below AA |

## Typography

- **Inter** — UI, body, buttons. `font-feature-settings: 'cv11','ss01','ss03'`.
- **Instrument Serif italic** (`.font-serif-accent`) — display moments only:
  the "check" in the wordmark, tagline clauses, the vibe label, the compare
  verdict. Never body text.
- **JetBrains Mono** — stats, percentages, counts, meta labels
  (`.font-mono-stat`, tabular-nums). Numbers always align.

## Wordmark

`vibecheck.` — "vibe" Inter tight-tracked, "check" Instrument Serif italic,
trailing period in `--vc-accent` red. Kinship with the strummer.fun wordmark
(`strummer.` with the red period); vibecheck is part of the same music suite.

## Surfaces & motion

- Glass utilities (`.glass`, `.glass-strong`, `.glass-dark`) from
  `client/src/index.css` — frosted material, not smoke.
- One ambient background drift max per page (`.ambient-bg`), violet/teal,
  40s, killed by `prefers-reduced-motion`.
- Motion vocabulary in `client/src/utils/motion.ts` (easeOutQuart, fadeUp,
  heroIn, cardSpring). Micro-interactions 150–250ms; entrances ≤ 700ms.

## Voice

Lowercase, confident, a little playful — "a portrait of your taste", "you'd
share aux without fighting." Privacy copy is plain and honest: your data is
yours; publishing is a choice, never a default.
