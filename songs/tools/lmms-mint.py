#!/usr/bin/env python3
"""
Headless song-scaffold generator for LMMS.

Reads SONGS-QUEUE.md rows, and for the next N un-minted numbers, writes a
real, renderable LMMS project (.mmp) straight from the queue's own
key/tempo/chords, no GUI required to create it or hear it.

    python tools/lmms-mint.py            # mint 1
    python tools/lmms-mint.py --count 5  # mint 5
    python tools/lmms-mint.py --render   # also render each to a wav via the LMMS CLI

This is the batchable half only (facts: key, tempo, chords, structure).
It does not and should not try to write a "hook" - see SONG-SPEC.md.
Every generated project is a chassis, not a finished idea.
"""
import argparse
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
QUEUE = REPO / "SONGS-QUEUE.md"
SONGS_DIR = REPO / "src" / "content" / "songs"
LMMS_DIR = REPO / "lmms-projects"
LMMS_EXE = r"C:\Program Files\LMMS\lmms.exe"

NOTE_BASE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}

CHORD_QUALITIES = {
    "maj7": [0, 4, 7, 11],
    "m7": [0, 3, 7, 10],
    "7": [0, 4, 7, 10],
    "sus4": [0, 5, 7],
    "sus2": [0, 2, 7],
    "dim": [0, 3, 6],
    "m": [0, 3, 7],
    "": [0, 4, 7],
}


def parse_root(token):
    m = re.match(r"^([A-G])(#|b)?", token)
    if not m:
        raise ValueError(f"Bad root in chord token: {token}")
    semitone = NOTE_BASE[m.group(1)]
    if m.group(2) == "#":
        semitone += 1
    elif m.group(2) == "b":
        semitone -= 1
    return semitone % 12, m.end()


def parse_chord(token):
    """'Abmaj7' -> (root_pc, [intervals]); 'Db/C' -> uses Db chord, bass forced to C."""
    token = token.strip()
    bass_pc = None
    if "/" in token:
        token, bass = token.split("/", 1)
        bass_pc, _ = parse_root(bass)
    root_pc, end = parse_root(token)
    quality = token[end:]
    intervals = CHORD_QUALITIES.get(quality, CHORD_QUALITIES[""])
    return root_pc, intervals, bass_pc


def chord_to_midi(token, octave=4):
    root_pc, intervals, bass_pc = parse_chord(token)
    base = 12 * (octave + 1) + root_pc  # MIDI: C4 = 60
    notes = [base + i for i in intervals]
    if bass_pc is not None:
        bass_note = 12 * octave + bass_pc
        notes = [bass_note] + notes
    return notes


def read_queue():
    rows = []
    pattern = re.compile(
        r"^\|\s*(\d+)\s*\|\s*([ABCD])\s*\|\s*([^|]+?)\s*\|\s*(\d+)\s*\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|"
    )
    for line in QUEUE.read_text(encoding="utf-8-sig").splitlines():
        m = pattern.match(line)
        if m:
            rows.append(
                {
                    "num": int(m.group(1)),
                    "template": m.group(2),
                    "key": m.group(3).strip(),
                    "tempo": int(m.group(4)),
                    "chords": m.group(5).strip(),
                    "move": m.group(6).strip(),
                }
            )
    return rows


def taken_numbers():
    taken = set()
    if SONGS_DIR.exists():
        for f in SONGS_DIR.glob("*.md"):
            m = re.search(r"^number:\s*(\d+)", f.read_text(encoding="utf-8"), re.M)
            if m:
                taken.add(int(m.group(1)))
    if LMMS_DIR.exists():
        for f in LMMS_DIR.glob("no-*.mmp"):
            m = re.match(r"no-(\d+)\.mmp", f.name)
            if m:
                taken.add(int(m.group(1)))
    return taken


NOTE_ELEM = '<note len="192" key="{key}" vol="80" pos="{pos}" pan="0"/>'

INSTRUMENT_TRACK = """      <track muted="0" name="Pacifica chords" solo="0" type="0">
        <instrumenttrack pan="0" fxch="0" pitchrange="1" pitch="0" basenote="57" vol="70">
          <instrument name="tripleoscillator">
            <tripleoscillator phoffset2="0" userwavefile0="samples/waveforms/sine.flac" finer0="0" userwavefile1="samples/waveforms/sine.flac" finer1="0" userwavefile2="samples/waveforms/sine.flac" finer2="0" coarse0="0" coarse1="0" coarse2="0" finel0="0" finel1="0" modalgo1="0" modalgo2="0" finel2="0" pan0="0" modalgo3="0" pan1="0" stphdetun0="0" pan2="0" stphdetun1="0" wavetype0="0" stphdetun2="0" wavetype1="0" wavetype2="0" vol0="45" vol1="45" phoffset0="0" phoffset1="0" vol2="45"/>
          </instrument>
          <eldata fres="0.5" ftype="0" fcut="14000" fwet="0">
            <elvol lspd_denominator="4" sustain="0.6" pdel="0" userwavefile="" dec="0.5" lamt="0" syncmode="0" latt="0" rel="0.3" amt="1" x100="0" att="0.05" lpdel="0" hold="0.5" lshp="0" lspd="0.1" ctlenvamt="0" lspd_numerator="4"/>
            <elcut lspd_denominator="4" sustain="0.5" pdel="0" userwavefile="" dec="0.5" lamt="0" syncmode="0" latt="0" rel="0.1" amt="0" x100="0" att="0" lpdel="0" hold="0.5" lshp="0" lspd="0.1" ctlenvamt="0" lspd_numerator="4"/>
            <elres lspd_denominator="4" sustain="0.5" pdel="0" userwavefile="" dec="0.5" lamt="0" syncmode="0" latt="0" rel="0.1" amt="0" x100="0" att="0" lpdel="0" hold="0.5" lshp="0" lspd="0.1" ctlenvamt="0" lspd_numerator="4"/>
          </eldata>
          <chordcreator chord="0" chordrange="1" chord-enabled="0"/>
          <arpeggiator arptime="100" arprange="1" arptime_denominator="4" syncmode="0" arpmode="0" arp-enabled="0" arp="0" arptime_numerator="4" arpdir="0" arpgate="100"/>
          <midiport inputcontroller="0" fixedoutputvelocity="-1" inputchannel="0" outputcontroller="0" writable="0" outputchannel="1" fixedinputvelocity="-1" fixedoutputnote="-1" outputprogram="1" basevelocity="127" readable="0"/>
          <fxchain numofeffects="0" enabled="0"/>
        </instrumenttrack>
        <pattern len="{patlen}" muted="0" name="chords" steps="16" pos="0" type="0">
{notes}
        </pattern>
      </track>
"""

PROJECT_TEMPLATE = """<?xml version="1.0"?>
<!DOCTYPE lmms-project>
<lmms-project type="song" version="1.0" creator="LMMS" creatorversion="1.2.2">
  <head timesig_denominator="4" bpm="{bpm}" masterpitch="0" mastervol="100" timesig_numerator="4"/>
  <song>
    <trackcontainer visible="1" width="600" height="300" type="song" x="6" y="5" maximized="0" minimized="0">
{track}
    </trackcontainer>
    <fxmixer visible="1" width="561" height="332" x="5" y="310" maximized="0" minimized="0">
      <fxchannel num="0" muted="0" volume="1" name="Master" soloed="0">
        <fxchain numofeffects="0" enabled="0"/>
      </fxchannel>
    </fxmixer>
    <timeline lp0pos="0" lp1pos="192" lpstate="0"/>
    <controllers/>
  </song>
</lmms-project>
"""


def build_project(row):
    chord_tokens = [c.strip() for c in row["chords"].strip("| ").split("|") if c.strip()]
    bar_len = 192  # ticks per bar in 4/4
    notes = []
    for i, token in enumerate(chord_tokens):
        pos = i * bar_len
        for pitch in chord_to_midi(token):
            notes.append(NOTE_ELEM.format(key=pitch, pos=pos))
    track_xml = INSTRUMENT_TRACK.format(
        patlen=bar_len * max(len(chord_tokens), 1), notes="\n".join(notes)
    )
    return PROJECT_TEMPLATE.format(bpm=row["tempo"], track=track_xml)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, default=1)
    ap.add_argument("--render", action="store_true", help="also render each to wav via LMMS CLI")
    args = ap.parse_args()

    LMMS_DIR.mkdir(exist_ok=True)
    rows = read_queue()
    taken = taken_numbers()
    minted = 0

    for row in rows:
        if minted >= args.count:
            break
        if row["num"] in taken:
            continue
        try:
            xml = build_project(row)
        except ValueError as e:
            print(f"skip no.{row['num']}: {e}", file=sys.stderr)
            continue

        path = LMMS_DIR / f"no-{row['num']:03d}.mmp"
        path.write_text(xml, encoding="utf-8")
        print(f"wrote {path}  (key {row['key']}, {row['tempo']}bpm, {row['chords']})")

        if args.render:
            wav_path = LMMS_DIR / f"no-{row['num']:03d}.wav"
            result = subprocess.run(
                [LMMS_EXE, "render", str(path), "-f", "wav", "-o", str(wav_path)],
                capture_output=True,
                text=True,
                timeout=60,
            )
            if result.returncode == 0 and wav_path.exists():
                print(f"  rendered -> {wav_path} ({wav_path.stat().st_size} bytes)")
            else:
                print(f"  RENDER FAILED: {result.stderr[-500:]}", file=sys.stderr)

        minted += 1

    print(f"\nMinted {minted} project(s) in {LMMS_DIR}")


if __name__ == "__main__":
    main()
