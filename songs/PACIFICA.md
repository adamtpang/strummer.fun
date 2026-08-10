# Pacifica

The pseudonym the 1,000 songs release under. Not a rebrand of the practice,
a real artist identity for it: songs made under `SONGS-1000.md`'s templates
and `SONG-SPEC.md`'s four required pieces, released publicly under one name
instead of scattered as personal-project noise.

## The name, honestly checked before committing

**Spotify already has at least 4 different artists named "Pacifica."** Not
disqualifying, Spotify doesn't require unique names, but search and
discovery will mix you in with them, and DistroKid or Spotify for Artists
may ask for a disambiguating detail.

**`soundcloud.com/pacifica` is taken** by a dormant, unrelated account (3
followers, 0 tracks). The bare handle is gone. A variant handle
(`pacificamusic`, `itspacifica`, `pacifica.fun`) is the real path.

### The chosen variant: pacificapacifica (already your Instagram handle)

Checked 2026-08-10 across every platform reachable without solving a CAPTCHA:

| Platform | Status |
|---|---|
| Instagram | **Already yours** |
| X/Twitter | **Available** (clean 404) |
| YouTube | **Taken** — a real, empty channel ("pacifica us") already sits on this exact handle |
| Spotify | No exact "pacificapacifica" artist exists; not disqualifying either way since Spotify artist names aren't reserved, first release under it is the real claim |
| TikTok | Hit a CAPTCHA, unchecked, check by hand |
| SoundCloud | Inconclusive, the site's routing didn't give a clean signal either way, confirm at signup |

The one real decision this forces: YouTube needs either a variant just for
that platform, or accepting the mismatch (most people will find you via
Instagram/Spotify/SoundCloud first anyway, a slightly different YouTube
handle isn't fatal).

Neither of these blocks starting. They're facts to decide with, not against.

## The ladder: free first, paid once there's a reason to pay

1. **SoundCloud, free tier.** No gatekeeping, no cost, immediate. This is
   where volume happens: every `stage: released` song goes here first.
2. **DistroKid, once there's a real catalog worth distributing wider.**
   ~$20 to $36/year for unlimited uploads to Spotify, Apple Music, and
   everywhere else. One artist name, one account, covers the whole 1,000.
3. **Spotify for Artists**, which DistroKid delivery unlocks: verify the
   profile, claim it as the actual artist, once tracks are live there.

## What is and isn't automatable here

This is the same boundary that showed up with the Spotify MCP setup: some
steps are Adam-only by nature; a Claude Code session cannot create accounts,
enter payment details, or upload audio files on his behalf.

**Adam-only, no way around it:**
- Choosing the final handle/spelling (the naming conflict above)
- Creating the DistroKid account and paying for it
- Uploading the actual audio files, DistroKid and SoundCloud both require a
  human to submit the file
- Claiming/verifying the Spotify for Artists profile once tracks are live

**Already automated, no new work needed:**
- The song pipeline itself: `SONGS-1000.md`'s templates, `SONG-SPEC.md`'s
  required pieces, the XP/streak scoring in `MusicScore.psm1`
- Tracking a release once it exists: the schema already has `soundcloud`,
  `spotify`, and `youtube` fields per song (see `src/content/config.ts`),
  so a song's distribution links slot straight into its existing entry, no
  new fields needed.

## "Climb the ranks through prolific brilliance"

This is not a new philosophy, it's the existing one made public. From
`MUSIC-GAME.md`: "the game is about volume and finishing." Prolific is the
1,000. Brilliance is what `SONG-SPEC.md`'s required hook and the
Templates A through H exist to protect against volume becoming filler.
Pacifica doesn't change the practice, it gives the practice a name people
outside this repo can actually follow.

## First real step

Not a purchase, not an account. Pick a handle variant (see above), and
release the first already-`stage: released` song from the current catalog
to SoundCloud under it. Everything downstream (DistroKid, Spotify) only
matters once there's something worth distributing wider than one platform.
