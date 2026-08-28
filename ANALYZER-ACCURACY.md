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
