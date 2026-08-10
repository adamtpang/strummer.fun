---
title: 'Avril Sketch (working title)'
date: 2026-08-06
number: 50
key: 'C major'
tempo: 68
chords: '| Cmaj7 | Am9 | Fmaj7 | G6 |'
instruments: [piano]
stage: sketch
ableton: 'Avril Sketch Project'
tags: [song, sketch, template-a]
draft: true
---

## The stack

- [x] key + tempo
- [x] chords
- [x] melody
- [ ] lyrics
- [ ] demo recording (a phone voice memo counts)
- [ ] produced

Liner notes: Template A ("Avril 14th") from `SONGS-1000.md` — the two-minute
piano piece, zero setup, one sitting. Aphex Twin is a real top-3 artist
(pulled live from strummer.fun/vibe, not assumed), so this is the
highest-leverage template on the list for you specifically.

Built live via Claude driving Ableton directly over the AbletonMCP remote
script's socket (127.0.0.1:9877) — same protocol the MCP tools use, sent by
hand since this session's `.mcp.json` wasn't loaded. Chords: `Cmaj7 | Am9 |
Fmaj7 | G6`, root-position voicings, one idea across 8 bars played twice
(16 bars total, 64 beats @ 68 bpm) with a melodic variation on the repeat —
57 MIDI notes total, verified note-for-note via `get_track_info` after
writing and visible in the piano roll.

**Not yet true to the template, on purpose — flagging honestly:**
- ~~Track had Serum loaded instead of piano~~ — fixed via socket
  (`load_browser_item` onto the same track slot swaps the instrument in
  place, no manual delete needed): now loaded with Live's stock
  `Grand Piano.adg`, matching the template exactly.
- "Rubato welcome, do not quantize" — this pass is programmed on a plain
  grid, not humanized. A live take (or manual nudging) would help a lot.
- Project file: `Avril Sketch Project/Avril Sketch.als` in
  `~/Music/Ableton Projects/`. It was first auto-saved by Ctrl+S to
  `Desktop/Untitled Project/` before being relocated on disk — Live's own
  "last saved to" pointer may still say Desktop until you do one manual
  Save As to the new location and it stops offering to save there.

Rename the title once you've actually sat with it — "Avril Sketch" was mine,
not yours.
