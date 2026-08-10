# The music game

You named the actual gap yourself: not vocals, not guitar. Songwriting,
producing, shipping. So the game scores exactly those three, nothing else.

Performance isn't graded here. XP comes from craft moving through the stack
and from work reaching the public. Taste is assumed; the game is about volume
and finishing, the two things Pressfield and the musicians index both point at.

## The XP table

One source of truth. `tools/music-score.ps1` and the player card on `/songs`
both compute from this exact table, so the number never drifts between the
CLI and the site.

| Signal | XP | Where it's read from |
|---|---|---|
| Sketch exists (key + tempo + chords) | **1** | frontmatter |
| Melody written | **2** | `- [x] melody` in the body |
| Lyrics written | **2** | `- [x] lyrics` in the body |
| Demo recorded | **5** | `- [x] recording`, or `stage` is demo/produced/released |
| Produced | **8** | `stage: produced` |
| **Released** | **20** | `draft: false` (actually public) |
| Study logged | **+3** bonus | `tags` includes `study` |
| Speed round logged | **+3** bonus | `tags` includes `speed-round` (see below) |

Released is worth as much as everything else in the stack combined, on
purpose. The musicians index said it plainly: nobody great had a short run,
and a produced track nobody hears is not yet a run. **Shipping is the
expensive item.** Optimizing what already exists, the thing you said you're
good at, is exactly how a 1-XP sketch becomes a 20-XP release: fill in the
frame, write the melody, write the lyrics, record it, ship it. Six small
upgrades on one piece of paper.

## Levels

Borrowed from RIAA certification tiers, since that's the real vocabulary of
the musicians you're closest to and it's the language the indexes research
already surfaced. This is a personal-practice metaphor, not a claim of an
actual certification.

| Level | Cumulative XP |
|---|---|
| Demo Tape | 0 |
| Gold | 50 |
| Platinum | 150 |
| Multi-Platinum | 400 |
| Diamond | 1,000 |
| Catalog Artist | 2,500 |

Catalog Artist is the real target. Nobody in the top tier of the musicians
index had a short run; the game rewards the same shape.

## The streak

Computed from git history on `src/content/songs/`, not a separate save file,
so it can't drift and two sessions editing the repo can't corrupt it. Run
`tools/music-score.ps1` to see it: current streak, whether today is logged
yet, and how many days since the last rep.

Never miss twice, same rule as `RITUAL.md`.

## The quest board

Nothing new to build here, this just names what already exists in game terms:

- **Daily quest** (the 7:30 calendar block, `/rep`): 3 replies + one song rep.
  Small, guaranteed XP.
- **Weekly boss**: take one sketch to `produced` or `released`. This is where
  the real XP is, and it's a boss fight on purpose: it should take real effort.
- **Side quest**: a study from `SONGWRITERS.md`, forked the same session.

## How to check your score

```
tools\music-score.ps1
```

Prints total XP, level, XP to next level, current streak, and this week's
ships against your best week. The same total appears on `/songs` as a player
card, counts only, same privacy rule as everywhere else on the site: what you
have built is public, what it's called is not until you ship it.

## Live session mode (the actual point: make creating more fun than consuming)

`music-score.ps1` is a scoreboard you check afterward. That's fine for a
status check, but it's the wrong shape for the thing that's supposed to
compete with opening Spotify: the reward has to land *while you're playing*,
not after you close Ableton and remember to run a script.

```
tools\music-session.ps1                # start a session, watch and reward
tools\music-session.ps1 -Quest weekly  # frame progress as boss-fight XP
tools\music-session.ps1 -Once          # just print current status, no watch
```

Start it before you sit down (leave it running in a terminal alongside Live).
It polls `src/content/songs/` every couple seconds and the instant a real
step lands — a sketch gets its key/tempo/chords filled in, a melody or
lyrics box gets checked, a stage moves to demo/produced/released — it prints
an immediate `+N XP` banner and plays a system beep. Level-ups get a
four-note ascending chime instead of a single beep. On `-Quest weekly`, a
`produced`/`released` bump also prints "BOSS HIT" — that's the quest that's
actually worth chasing (see the quest board above).

Same scoring engine as `music-score.ps1` — both import `tools/MusicScore.psm1`
so the number can't drift between "what the watcher just rewarded you for"
and "what the scoreboard says your total is."

**When Claude is driving Ableton via the MCP tools directly** (see
`CLAUDE.md`'s Ableton section), it narrates the same reward conversationally
in real time instead of you needing a second terminal running the watcher —
the point either way is the same: don't wait for the recap, land the hit now.
