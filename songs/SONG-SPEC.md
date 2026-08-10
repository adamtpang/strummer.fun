# The lego pieces

Before spinning up any automation on this (agent swarm, fleet runs, Suno or
its peers), name what a song actually needs versus what it can wait on.
Otherwise "generate a song" means nothing testable.

## Required. Without these four it isn't a sketch yet

| # | Piece | Why it's non-negotiable |
|---|---|---|
| 1 | **Title** | Working title is fine, never blocks anything. But nothing else attaches without a name to attach it to. |
| 2 | **Key + tempo** | The two numbers that make every other piece mean something. A chord is meaningless without a key; a rhythm is meaningless without a tempo. |
| 3 | **Chords** | The harmonic chassis. One line, any shorthand (`\| Fmaj7 \| Am7 \| Dm7 \| Gsus4 \|`). |
| 4 | **One hook** | A single repeatable identity element: a melodic hook, a rhythmic stab, a vocal ad-lib, a chord you let sit. Templates F, G, and H all converged on this independently this week: Kokomo's lingering minor chord, the four-chord loop played twice as fast, the stab that repeats across three genre-hopping sections. Without a hook a sketch is generic, technically complete and forgettable. |

These four map directly to `key`, `tempo`, `chords` in the content schema,
plus a new optional `hook` field (added alongside this doc). They are
also exactly what already earns the first XP in `MUSIC-GAME.md`: "sketch
exists" is 1 point precisely because it's the whole required set.

## Optional. Add later, in roughly this order

- Melody (the full one, not just the hook)
- Lyrics
- Instruments / arrangement
- A recorded take (`stage: demo`)
- Production (`stage: produced`)
- Release (`stage: released`)

Nothing here is skippable forever, songs still need to ship. It's skippable
*today*, which is the actual point: a sketch with all four required pieces
and none of the optional ones is a complete, real, countable unit of
practice. Don't wait on melody or lyrics to start.

## The acceptance test for automation

Before wiring this project into an agent swarm, fleet runs, or Suno (or any
peer), the bar is simple: whatever's doing the generating has to fill all
four required fields, or its output isn't a real sketch by this project's
definition. Optional fields can stay blank, same as a human's first pass.

This is deliberately a gate, not a wishlist. `hook` is the field most
likely to get skipped by anything generating at scale, because it's the one
piece that isn't a fact (a key, a tempo) but a *choice*. That choice is the
whole reason Template F through H exist. An automated pipeline that can't
make that choice is producing filler, not songs, no matter how correct the
chords and tempo are.
