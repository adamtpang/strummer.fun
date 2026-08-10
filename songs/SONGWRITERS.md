# Reverse engineer, then forward engineer

The study curriculum. Take the people who demonstrably did it best, pull their
songs apart down to the parts, log the parts as data, then recombine the parts
into work that is yours.

This is the same loop as `ESSAYS-1000.md`, applied to music: read the source,
commit the spec, fork it, ship it.

## Two rankings, because "best" has two meanings

### By numbers · Billboard Hot 100 number-one singles as a writer

The hardest available measure of songwriting output that connected.

| # | Songwriter | No. 1s | Wrote for |
|---|---|---|---|
| 1 | **Paul McCartney** | 32 | The Beatles |
| 2 | **Max Martin** | 30 | Britney, Katy Perry, Taylor Swift, The Weeknd, Ariana Grande |
| 3 | **John Lennon** | 26 | The Beatles |
| 4 | Mariah Carey | 18 | herself |
| 4 | Dr. Luke | 18 | Katy Perry, Kesha |
| 6 | Barry Gibb | 16 | Bee Gees, Andy Gibb |

Source: Wikipedia, *List of Billboard Hot 100 chart achievements and
milestones*.

### By critics · Rolling Stone's 100 Greatest Songwriters (2015, staff vote)

| # | Songwriter |
|---|---|
| 1 | Bob Dylan |
| 2 | Paul McCartney |
| 3 | John Lennon |
| 4 | Chuck Berry |
| 5 | Smokey Robinson |
| 6 | Mick Jagger / Keith Richards |
| 7 | Carole King / Gerry Goffin |
| 8 | Paul Simon |
| 9 | Joni Mitchell |
| 10 | Stevie Wonder |

## The overlap is the whole point

**McCartney and Lennon are top 3 on BOTH lists.** Nobody else is. Critics and
the charts agree on exactly two people, and **The Beatles are already your #2
artist.**

So the curriculum is not a guess. Start where the evidence and your own taste
already point.

The second name to sit with is **Max Martin**, 30 number ones and almost no
public profile. He is the counter-argument to genius: a craftsman who reverse
engineered pop into rules he could run at volume, which is precisely the
programmer's approach you asked for. He is also, indirectly, in your top 18
(the machinery behind that whole modern-pop lane).

## The protocol

Per study, about 40 minutes. It produces one song entry, so **studies count
toward the 1,000.**

1. **Separate.** `tools\stems.ps1 "song.mp3"` splits it into drums, bass,
   vocals, other. Now you can hear one part at a time.
2. **Transcribe the bass first.** Bass tells you the harmony faster than the
   chords do. Write it out.
3. **Log the spec.** Create the song entry with `key`, `tempo`, `chords`,
   `instruments` filled in, and `tags: [study]`. This is the commit.
4. **Name the move.** One sentence: what does this song do that you want to
   steal? Not "it is good." Something like "the chorus lands on the minor iv
   and that is the whole ache."
5. **Fork it.** Same tempo, same changes, your melody. Ship it as a sketch.

Rule: never study without forking in the same session. A study you did not
fork is consumption wearing a lab coat.

## The queue

Ordered so that the earliest studies feed the templates you already have.

### Run 1 · Lennon and McCartney (feeds Template C)
1. **Something** (Harrison) · the chromatic descending bass line
2. **In My Life** · how a simple melody carries a modal turn
3. **Hey Jude** · the McCartney No. 1, and how long you can hold a coda
4. **Blackbird** · one guitar, one voice, complete arrangement
5. **Here, There and Everywhere** · key changes that nobody notices

### Run 2 · The minor iv and the sad-major move (feeds Template C)
6. **The Lemon Twigs, My Golden Years** · your own top 10, 70s power pop
7. **Tennis, anything from Yours Conditionally** · jazzy retro chords
8. **Billie Eilish, BIRDS OF A FEATHER** · Finneas voicings under a plain top line

### Run 3 · Groove traditions (feeds Template D)
9. **Bob Marley, any** · one drop, and how much space a groove can hold
10. **Gipsy Kings, Ciento** · rumba, palmas, no drum kit
11. **Laufey, From The Start** · bossa comping, ii-V motion
12. **Vampire Weekend, any** · interlocking guitar lines

### Run 4 · Texture and loop (feeds Template B)
13. **Aphex Twin, Xtal** · your #1. What is actually in it? Separate it and see
14. **Aphex Twin, Avril 14th** · already Template A. Transcribe it properly
15. **NewJeans, any** · what 250 leaves OUT of a mix

### Run 5 · The craftsman
16. **Max Martin, three songs across three decades** · find the shared skeleton

## Why this is not stealing

You are learning grammar, not copying sentences. Chord progressions and tempos
are not copyrightable; specific melodies and recordings are. Study the
structure, write your own melody over it, and you are doing what every
songwriter in both tables above did. McCartney learned by playing other
people's records until he could hear how they worked.

Log studies as `tags: [study]` and keep them `draft: true` until they are your
own work.
