# analyze.js accuracy test, 2026-08-22

First real measurement of the chord analyzer. Ground truth is Adam's own
LMMS sketches, whose intended key/tempo/chords are written in their song
frontmatter, so there is no guesswork about the right answer and no
copyright question about the audio.

Method: rendered `songs/lmms-projects/no-0XX.mmp` to WAV with the LMMS
CLI, then fed the samples straight into `analyze.js`'s exported pipeline
(`chromagram` -> median smooth -> Viterbi `decodeChords` -> `segment` ->
`detectKey`) via a Node harness, since `decodeToMono` needs Web Audio.

## Results

| File | True key | True chords | Detected key | Detected chords |
|---|---|---|---|---|
| no-066 | G major | `G F C G` | **Em** | `Gm F C Gm` |
| no-062 | Eb major | `Eb Eb/D Cm Eb/Bb` | **Gm** | `D# Gm Cm D#` |
| no-063 | Bb major | `Bbmaj7 Gm7 Cm7 F7` | **Gm** | `Gm Cm F` |

## Scoring

**Roots: 11/12 correct** (~92%), counting D# as Eb, which is the same
pitch. The single real miss is `Eb/D` read as `Gm`, and those two chords
share three of four notes (G, Bb, D), so it is an understandable
confusion rather than a random error.

**Chord quality: weak.** Two clear failure modes:
- Major/minor confusion. `G` came back as `Gm` twice in no-066. The
  third is one pitch class out of twelve and gets buried in the chroma.
- No extensions at all. `Bbmaj7`, `Gm7`, `Cm7`, `F7` all collapsed to
  plain triads. The template set has no seventh chords, so it cannot
  ever return one. That is a missing feature, not a bug.

**Key detection: systematically biased to the relative minor.** Two of
three came back as the relative minor of the true key (Em for G major,
Gm for Bb major). Those share every note with their major, so the
chroma cannot separate them without weighting the tonic. This is a
known, fixable weakness, not noise.

**Enharmonic spelling.** Eb is displayed as D#. Same pitch, wrong name
for the key context, and it makes output harder to read.

**Segmentation.** no-066 returned exactly 4 segments for a 4-chord loop.
no-063 returned 3 for a 4-chord loop, dropping the Bbmaj7.

## Honest caveat on these numbers

These are sparse LMMS piano and synth sketches. Full band recordings
with drums, distorted guitar, and vocals are substantially harder for a
chroma-based method: percussion smears energy across all twelve bins and
vocals add non-chord tones. **Treat ~92% root accuracy as an optimistic
ceiling, not the number to expect on Faith or a Chili Peppers record.**

## What this says to fix first, in order

1. **Key detection tonic weighting.** Biggest win for the smallest
   change. A proper Krumhansl-Schmuckler key profile would separate
   relative major from minor, which the current method cannot do at all.
2. **Add seventh-chord templates.** Purely additive, and it is the
   difference between usable and not on anything jazz-adjacent.
3. **Improve major/minor discrimination.** Hardest of the three.
   Probably the point where a small trained model beats templates.

Nothing here needs a scraper. Every one of these is a change to the
analysis code.

## Second pass, 2026-09-16

Harness rebuilt at `web/test/analyze-harness.mjs` (the old one lived in a
scratchpad and is gone). Test set widened to six sketches, 24 chords, and
scored strictly: a chord must match exactly to count, not just its root.

Changes to `analyze.js`:

- **Seventh templates added** (maj7, m7, 7). Sevenths could never be returned
  before; now `Gm7 Cm7 C7 Am7` in no-063 and no-064 come back correctly.
- **Third weighted up, fifth weighted down** in every template. The third is
  the only note that separates major from minor; the fifth is shared.
- **Key detection uses the decoded chords.** Time spent on the tonic chord,
  and starting or ending on it, now count alongside the pitch profile. That
  is what was missing when G major read as E minor.
- **Seventh evidence check.** A seventh only survives if its pitch class
  carries at least 45% of the triad tones' energy in that segment.

| | Before | After |
|---|---|---|
| Roots correct | 12/24 | **17/24** |
| Exact chord | 6/24 | **8/24** |
| Key | 0/6 | **2/6** |

Remaining failures, honestly:

- **Plain triads on these renders read as maj7** (no-066: `G F C G` returns
  `Gmaj7 Am7 Cmaj7 Gmaj7`). The LMMS synth has a loud seventh partial, so the
  evidence check does not fire. Real guitar has a weaker seventh harmonic;
  this needs a guitar recording in the test set before it can be tuned.
- **Key still misses on the jazz-leaning sketches** (no-063 and no-064 are
  ii-V material with no plain tonic, so the tonic-share bonus has nothing to
  bite on).
- **no-065's frontmatter is wrong**, not the analyzer: its chords are
  `D A Bm G`, which is D major, but the file says C major. Left alone here.

Next lever, in order: a real guitar test recording; then a sus4 template
(ipop-53's `Gsus4` is unreachable today).
