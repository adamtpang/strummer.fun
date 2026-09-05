#!/usr/bin/env python3
"""
One-shot Lyria probe: turn one song file into a generated track via the Gemini
API, no SDK, no form, no monthly cap.

    set GEMINI_API_KEY=...            (PowerShell: $env:GEMINI_API_KEY = "...")
    python songs/tools/lyria-probe.py ipop-53            # bed only, no vocals
    python songs/tools/lyria-probe.py ipop-53 --sung     # Lyria sings the lyrics
    python songs/tools/lyria-probe.py ipop-53 --clip     # 30s clip, half price

Reads key, tempo, chords, hook, and any approved lyrics straight from the song
file, so the prompt describes a song that already exists rather than inventing
one. Output lands beside the LMMS renders in lmms-projects/<id>.lyria.<ext>.

Pricing at time of writing (ai.google.dev/gemini-api/docs/pricing): $0.08 per
full song, $0.04 per 30s clip. No free tier. Every output carries an inaudible
SynthID watermark. The key never leaves this machine and is never printed.

Default is --bed because the release rule is Adam's voice on every track. --sung
exists to hear Lyria's read of the melody as a reference, not to ship.
"""
import argparse
import base64
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SONGS_DIR = REPO / "src" / "content" / "songs"
OUT_DIR = REPO / "lmms-projects"

ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions"
API_REVISION = "2026-05-20"
MODEL_FULL = "lyria-3.5"
MODEL_CLIP = "lyria-3-clip-preview"


def field(text, name):
    m = re.search(rf"^{name}:\s*(.+)$", text, re.M)
    return m.group(1).strip().strip("'\"") if m else ""


def lyrics_from_body(text):
    sections = re.findall(
        r"^### (Section [A-Z])\s*\n(?:.*\n)*?((?:^> .*\n)+)", text, re.M
    )
    if not sections:
        return ""
    tag = {"Section A": "[Verse]", "Section B": "[Verse]", "Section C": "[Chorus]"}
    out = []
    for name, block in sections:
        lines = [ln[2:].rstrip() for ln in block.splitlines() if ln.startswith("> ")]
        out.append(tag.get(name, "[Verse]") + "\n" + "\n".join(lines))
    return "\n\n".join(out)


def build_prompt(song, sung):
    key, tempo, chords, hook = (
        song["key"],
        song["tempo"],
        song["chords"],
        song["hook"],
    )
    parts = [
        f"Key: {key}. Tempo: {tempo} bpm." if key and tempo else "",
        f"Chord progression: {chords}" if chords else "",
        f"Signature motif: {hook}" if hook else "",
    ]
    if sung and song["lyrics"]:
        parts.append("Sing these lyrics exactly, one dry close conversational lead vocal:")
        parts.append(song["lyrics"])
    else:
        parts.append("Instrumental only, no vocals.")
    return "\n".join(p for p in parts if p)


def read_song(song_id):
    path = SONGS_DIR / f"{song_id}.md"
    if not path.exists():
        sys.exit(f"no song file at {path}")
    text = path.read_text(encoding="utf-8-sig")
    return {
        "title": field(text, "title"),
        "key": field(text, "key"),
        "tempo": field(text, "tempo"),
        "chords": field(text, "chords"),
        "hook": field(text, "hook"),
        "lyrics": lyrics_from_body(text),
    }


def extract_audio(payload):
    for step in payload.get("steps", []):
        if step.get("type") != "model_output":
            continue
        for block in step.get("content", []):
            if block.get("type") == "audio" and block.get("data"):
                return base64.b64decode(block["data"]), block.get("mime_type", "")
    return None, ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("song_id")
    ap.add_argument("--sung", action="store_true", help="Lyria sings the approved lyrics")
    ap.add_argument("--clip", action="store_true", help="30s clip model, half price")
    ap.add_argument("--dry-run", action="store_true", help="print the prompt, send nothing")
    args = ap.parse_args()

    key = os.environ.get("GEMINI_API_KEY")
    if not key and not args.dry_run:
        sys.exit("GEMINI_API_KEY is not set. Create one in AI Studio and export it first.")

    song = read_song(args.song_id)
    prompt = build_prompt(song, args.sung)
    model = MODEL_CLIP if args.clip else MODEL_FULL

    print(f"song   : {song['title']}")
    print(f"model  : {model}")
    print(f"mode   : {'sung' if args.sung else 'instrumental bed'}")
    print("prompt :")
    print("  " + prompt.replace("\n", "\n  "))
    if args.dry_run:
        return

    body = {"model": model, "input": prompt}
    if not args.clip:
        body["response_format"] = {"type": "audio"}

    req = urllib.request.Request(
        ENDPOINT,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Api-Revision": API_REVISION,
            "x-goog-api-key": key,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            payload = json.load(resp)
    except urllib.error.HTTPError as err:
        detail = err.read().decode("utf-8", "replace")[:800]
        sys.exit(f"HTTP {err.code} from Lyria:\n{detail}")

    audio, mime = extract_audio(payload)
    if not audio:
        debug = OUT_DIR / f"{args.song_id}.lyria.response.json"
        debug.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        sys.exit(f"no audio block in response; raw response saved to {debug}")

    ext = "wav" if "wav" in mime else "mp3"
    suffix = ".sung" if args.sung else ".bed"
    out = OUT_DIR / f"{args.song_id}.lyria{suffix}.{ext}"
    OUT_DIR.mkdir(exist_ok=True)
    out.write_bytes(audio)
    print(f"\nwrote {out} ({len(audio):,} bytes, {mime or 'mime unknown'})")


if __name__ == "__main__":
    main()
