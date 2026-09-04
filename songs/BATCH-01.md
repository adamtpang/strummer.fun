# Batch 01: month one of the Pacifica release run

Written 2026-09-04. The first 60-song month toward 1,000 Pacifica songs on
Spotify. Suno makes the bed, Adam makes the part that keeps it up.

Companion docs: `SONG-SPEC.md` (what a song needs), `PACIFICA.md` (the persona),
`SUNO-API-APPLICATION.md` (why generation is manual for now), `STRUMMER-DJ.md`.

## The cap sets the pace, not motivation

Suno changed its terms on 2026-09-03. Commercial rights attach to a **permitted
download**, and downloads are capped per month:

| Plan | Downloads/month | Songs/year | Time to 1,000 |
| --- | --- | --- | --- |
| Pro (~$10/mo) | 20 | 240 | ~4.2 years |
| **Premier (~$27/mo)** | **60** | **720** | **~17 months** |

Credits do not matter. Downloads do. 60/month is the ceiling no amount of effort
moves, so the plan is built at exactly 60: **15 per week, four weeks.**

Requires Premier. Pro caps this plan at 20 and the whole thing takes four years.

## What is actually on the shelf

84 song files. 12 released. 72 unreleased, sorted by how much of a Suno prompt
they can already fill:

| Tier | What it has | Count | Prompt-ready? |
| --- | --- | --- | --- |
| **A** | key + tempo + chords + hook | 9 | Yes, today |
| **B** | key + tempo + chords, no hook | 25 | One decision each |
| **D** | title only | 30 | Needs real work |
| Quarantine | studies of other people's songs | 8 | **Never release** |

Usable pool is 64. Month one needs 60. It fits, but there is no slack, and Tier D
is not shovel-ready.

29 of the 30 Tier D entries have an Ableton project on disk. Open those before
inventing anything: the idea may already be recorded.

## Quarantine, do not release

**The 8 studies.** These reproduce other writers' harmony as a learning exercise.
They are legitimate practice and illegitimate releases.

Something (Harrison) · In My Life · Hey Jude · Blackbird · Here, There and
Everywhere (all Lennon/McCartney) · My Golden Years (The Lemon Twigs) · Fields of
Blue (Tennis) · BIRDS OF A FEATHER (Eilish/FINNEAS)

**9 Tier D titles that name a real artist.** These are style-study working
titles. Releasing them under these names, or pasting them into a Suno prompt, is
the exact impersonation pattern Spotify's 2026 policy enforces against. Rename
before they enter any batch, and never put the artist's name in the prompt:

`aphex` · `aphex-twin` · `aphex-jungle` · `avicii-the-nights` · `mgmt` ·
`newjeans-lab` · `new-new-order` · `purdie-girl` · `hard-days-knight`

Describe the technique instead of naming the artist. "Aphex Twin" becomes
"detuned prepared-piano melody over a broken breakbeat, heavy tape wobble." The
description is what Suno needs anyway. The name only adds legal risk.

**One content flag:** `stolen-cock` will be rejected or age-gated on title
alone. Rename it.

## The four batches

15 songs per week, strongest material first, so the earliest releases are the
best ones rather than the ones that happened to be ready.

### Week 1, all Tier A plus 6 Tier B

The 9 complete sketches: iPop 53 · no. 068 · 070 · 072 · 074 · 076 · 078 · 080 ·
082, plus Avril Sketch · no. 041 · 042 · 043 · 044 · 045.

These need no prep. Prompt, download, record, ship.

### Week 2, Tier B

no. 046 · 047 · 048 · 049 · 051 · 054 · 055 · 056 · 057 · 058 · 059 · 060 · 061 ·
062 · 063.

**Prep, roughly 2 minutes each:** decide the hook. `SONG-SPEC.md` treats it as
the fourth required lego. One repeatable identity element: a stab, a held chord,
a phrase that returns. Write it into the `hook:` field before prompting.

### Week 3, last of Tier B plus first Tier D

no. 064 · 065 · 066 · "study in a minor" (rename it, it reads like the
quarantine list), plus 11 Tier D entries.

**Prep for each Tier D:** open its Ableton project, write down what is actually
there, fill in key, tempo, and chords. This is the expensive week. Front-load it
into week 2 if there is time.

### Week 4, Tier D

15 more Tier D entries, same prep.

Leaves 4 Tier D spare. Do not start new sketches to fill a gap. If a week comes
up short, ship short.

## Turning a song file into a Suno prompt

The point of the whole exercise: Suno scores an idea that already exists rather
than generating from nothing. Read straight off the frontmatter.

```
[genre and instrumentation, 5-10 words]
Key: {key}. Tempo: {tempo} bpm.
Progression: {chords}
Motif: {hook}
Mood: {two or three words}
No vocals.
```

Worked example, no. 082:

```
Warm bossa-leaning acoustic guitar, upright bass, brushed kit.
Key: A major. Tempo: 102 bpm.
Progression: | Amaj7 | F#m7 | Bm7 | Esus4 |
Motif: every chord extended (7ths, sus4) under a plain melody.
Mood: unhurried, slightly wistful.
No vocals.
```

**"No vocals" is deliberate.** The vocal is the part that has to be Adam's. It is
what makes the track a Pacifica release instead of a Suno export, and it is the
single clearest signal to both filters that a human made this.

Never put a living artist's name in a prompt. Describe the technique.

## Per-song release checklist

Every one of the 60. If a song cannot clear all six, it does not ship.

- [ ] Prompt built from the song file, no artist names
- [ ] Downloaded through Suno (the download is what grants commercial rights)
- [ ] **Adam's vocal or guitar recorded over it.** Not optional. This is the line
      between a release and spam.
- [ ] Title is real, not a working title, not another artist's name
- [ ] AI involvement disclosed in DistroKid's field
- [ ] Song file updated: `stage: released`, `spotify:` link added

## Staying on the right side of both filters

Spotify deleted 75 million tracks in the 12 months to September 2026 and shipped
a spam filter targeting mass uploads, duplicate metadata, SEO manipulation, and
tracks padded just past 30 seconds. DistroKid separately prohibits mass-uploading
low-effort AI tracks. Neither bans AI music. Both ban the shape of this plan
executed lazily.

What keeps it legitimate:

- A human vocal on every track
- Distinct titles and real metadata, no numbered variants of one bed
- Full-length songs, never 31-second royalty bait
- Disclosure on every upload
- No artist imitation anywhere, in title, prompt, or style tag
- Never buy streams, one flagged account takes down the 12 real songs too

The risk is not moving slowly. It is losing the catalogue.

## Costs

| Item | Cost |
| Line | Rate | 17 months |
| --- | --- | --- |
| Suno Premier | $288/yr annual, then $30/mo | $438 |
| DistroKid Musician | $24.99/yr | $50 |
| **Required total** | | **$488** ($0.49/song) |

Not paid up front. **Month one is $55**: DistroKid's $25 for the year plus one
month of Suno at $30. Taking Suno's annual discount instead is $313 up front and
saves $72 over the run. Given the cash position, monthly until week 1 proves the
recording chain works is the safer order.

### The add-on trap, priced per release

DistroKid's base plan is genuinely unlimited. Its add-ons are per release, and
the upload flow shows them as checkboxes on every single upload. At 1,000
releases:

| Add-on | Per release | At 1,000 |
| --- | --- | --- |
| Store Maximizer | $7.95/yr | **$7,950/yr** |
| YouTube Content ID | $4.95/yr | **$4,950/yr**, plus DistroKid keeps 20% of Content ID revenue |
| Leave a Legacy | $29 once | **$29,000** |
| Cover Song Licensing | $12/yr | only if a release is a cover |

Ticking one box out of habit on every upload costs 16x the entire plan. **Base
plan only, every upload, no exceptions.** Revisit per song only if one gets real
traction.

### Cut Splice

Suno generates the full bed. Paying Splice ~$221 over the run to build beds while
paying Suno to build beds is two tools doing one job. Add it back only against a
specific gap Suno cannot fill.

### Already owned, $0

Ableton Live 11 Intro, the mic, the interface, Claude and Codex.

### Not money, but real

1,000 releases need 1,000 distinct cover images at 1400x1400 minimum. Free to
generate, but they have to exist. Batch them, do not do one at a time.

Against an income deadline around Thanksgiving 2026, three months at this cap is
180 songs, not 1,000. 1,000 lands early 2028. That is the honest schedule at the
maximum rate the vendor permits.

## Month one scoreboard

Fill this in. Honest zero beats a rounded-up number.

| Week | Target | Prompted | Downloaded | Vocal recorded | Uploaded |
| --- | --- | --- | --- | --- | --- |
| 1 | 15 | 0 | 0 | 0 | 0 |
| 2 | 15 | 0 | 0 | 0 | 0 |
| 3 | 15 | 0 | 0 | 0 | 0 |
| 4 | 15 | 0 | 0 | 0 | 0 |

The number that has never moved is **demos: 0 of 84 in five years.** Week 1's
real test is not 15. It is 1.

## Founder-only, before week 1

1. Subscribe to Suno **Premier**, not Pro. Pro makes this a four-year plan.
2. Subscribe to DistroKid Musician, ~$23/year, unlimited uploads.
3. Decide whether Pacifica releases under its own DistroKid artist name. Note
   this reverses the 2026-08-21 "Pacifica is TikTok-only" decision in
   `COVERS.md`, which is Adam's call to make but should be made explicitly.
4. Confirm the mic and interface chain records cleanly. The Ableton vocal chain
   from 2026-09-03 was never verified past the arm button.
