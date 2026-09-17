#!/usr/bin/env python3
"""
Batch kit maker for the Suno line. One pass over every song file that has
key, tempo, and chords, one kit per song, all in one markdown file to work
through top to bottom.

    python songs/tools/suno-kits.py                # writes songs/SUNO-KITS.md
    python songs/tools/suno-kits.py --song no-082  # one kit to stdout

A kit is what the hand-run version produced three times in the week of
2026-09-14 (Borrowed Light, girl bossa, 2 afternoons): a Suno style prompt
built from the song's own facts, a structure with section tags, and a lyric
brief. Lyrics themselves are written per song with Claude and approved by
Adam; the kit carries the brief and the hook so that step starts warm.

Rules baked in:
- Never a living artist's name in a prompt. Technique words only.
- "No vocals" on every bed prompt. The voice is Adam's, on the good mic.
- Studies of other people's songs are excluded. They are practice, not
  releases.
"""
import argparse
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SONGS_DIR = REPO / "src" / "content" / "songs"
OUT = REPO / "SUNO-KITS.md"

CHORD_TOKEN = re.compile(r"^[A-G](#|b)?[A-Za-z0-9/]*$")


def field(text, name):
    m = re.search(rf"^{name}:\s*(.+)$", text, re.M)
    return m.group(1).strip().strip("'\"") if m else ""


def chord_tokens(chords):
    if "A:" in chords:
        chords = chords.split("B:")[0].replace("A:", "")
    return [t.strip() for t in chords.split("|") if CHORD_TOKEN.match(t.strip())]


def feel_words(key, tempo, chords):
    words = []
    minor = key.endswith("minor") or key.endswith("m")
    words.append("wistful" if minor else "warm")
    if tempo < 75:
        words.append("slow, lots of air between hits")
    elif tempo < 105:
        words.append("relaxed mid-tempo")
    elif tempo < 135:
        words.append("driving")
    else:
        words.append("fast and bright")
    if any("maj7" in c or "m7" in c or "9" in c for c in chords):
        words.append("extended chords, soft attack, jazz-adjacent voicings")
    if any("sus" in c for c in chords):
        words.append("suspended chords that resolve late")
    if any("/" in c for c in chords):
        words.append("a walking bass under the changes")
    return ", ".join(words)


def instruments(instr):
    if not instr:
        return "acoustic guitar, upright bass, brushed drums"
    names = [i.strip().strip("[]'\"") for i in instr.strip("[]").split(",") if i.strip()]
    return ", ".join(names) if names else "acoustic guitar, upright bass, brushed drums"


def kit(song):
    chords = chord_tokens(song["chords"])
    loop = " | ".join(chords)
    prompt = (
        f"{instruments(song['instruments'])}. {feel_words(song['key'], song['tempo'], chords)}. "
        f"Key {song['key']}, {song['tempo']} bpm. Progression {loop}. "
        + (f"Signature motif: {song['hook']}. " if song["hook"] else "")
        + "Instrumental only, no vocals."
    )
    title = song["title"].replace(" (working title)", "")
    brief = song["hook"] or "no hook written yet; the first thing to decide"
    lines = [
        f"## {title}  `{song['id']}`",
        "",
        f"**Key** {song['key']} · **Tempo** {song['tempo']} · **Chords** `{loop}`",
        "",
        "**Suno style prompt** (paste into the style box):",
        "",
        "```",
        prompt,
        "```",
        "",
        "**Structure** (paste into lyrics box once words exist):",
        "",
        "```",
        "[Intro]",
        "[Verse 1]",
        "[Chorus]",
        "[Verse 2]",
        "[Chorus]",
        "[Bridge]",
        "[Chorus]",
        "[Outro]",
        "```",
        "",
        f"**Lyric brief:** the hook is *{brief}*. Ask Claude for a draft, approve it, save it to the song file.",
        "",
        "**Session:** hum the loop into a voice memo, upload it as the seed, take four variations, keep the one you replay, then sing the keeper on the good mic.",
        "",
        f"- [ ] bed chosen  - [ ] lyrics approved  - [ ] vocal recorded  - [ ] `suno:` link on `{song['id']}.md`",
        "",
    ]
    return "\n".join(lines)


def load():
    songs = []
    for path in sorted(SONGS_DIR.glob("*.md")):
        text = path.read_text(encoding="utf-8-sig")
        title = field(text, "title")
        if title.lower().startswith("study") or field(text, "stage") == "released":
            continue
        key, tempo, chords = field(text, "key"), field(text, "tempo"), field(text, "chords")
        if not (key and tempo and chord_tokens(chords)):
            continue
        songs.append({
            "id": path.stem, "title": title, "key": key, "tempo": int(tempo), "chords": chords,
            "hook": field(text, "hook"), "instruments": field(text, "instruments"),
            "number": int(field(text, "number") or 0),
        })
    return songs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--song")
    args = ap.parse_args()
    songs = load()
    if args.song:
        match = [s for s in songs if s["id"] == args.song]
        if not match:
            sys.exit(f"{args.song} has no key, tempo, and chords, or is a study or release")
        print(kit(match[0]))
        return
    songs.sort(key=lambda s: (not s["hook"], s["number"]))
    head = [
        "# Suno kits",
        "",
        f"Generated by `tools/suno-kits.py` from {len(songs)} sketches that have key, tempo, and chords.",
        "Studies and released songs are left out. Songs with a hook come first: they are the",
        "ones a lyric can start from today. Regenerate any time; edit the song files, not this.",
        "",
        "Work top to bottom. One kit is one session. Tick the boxes on the song file, not here.",
        "",
    ]
    OUT.write_text("\n".join(head) + "\n".join(kit(s) for s in songs), encoding="utf-8")
    print(f"wrote {OUT} with {len(songs)} kits ({sum(1 for s in songs if s['hook'])} with a hook)")


if __name__ == "__main__":
    main()
