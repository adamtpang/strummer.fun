# Ableton MCP

Lets Claude drive Ableton Live: create tracks, write MIDI clips, load
instruments from the browser, set tempo, fire clips. Used to scaffold the
Template A/B/C/D sessions in `SONGS-1000.md`.

Upstream: [ahujasid/ableton-mcp](https://github.com/ahujasid/ableton-mcp) (MIT).

## Status as of 2026-09-04: the bridge has never actually run

Verified on this machine today. **The Control Surface was never enabled**, so
the Remote Script has never loaded and port 9877 has never listened. Every
earlier attempt to drive Live through this MCP was talking to nothing.

That also explains the failed arm-button clicking in the 2026-09-03 session.
It was blamed on a MiniLab mkII control-surface conflict. There is no conflict:
`Preferences.cfg` contains no control surface at all, in any slot. The bridge
simply did not exist.

What is true right now:

- Remote Script **is** installed, at `Documents\Ableton\User Library\Remote
  Scripts\AbletonMCP\`. Live 11 reads that location, so it is a valid install.
  Every `%APPDATA%\Ableton\Live *\Preferences\User Remote Scripts\` folder is
  empty, which is fine and not the problem.
- Both the installed copy and the vendored copy here have `HOST = "127.0.0.1"`,
  so the loopback fix below is intact in both.
- **The vendored copy in this repo is stale.** Installed is 109,093 bytes
  (2026-08-28); vendored here is 57,883 bytes (2026-08-09). Re-running
  `install-ableton-mcp.ps1` would overwrite the newer script with the older
  one. Refresh the vendored copy from the installed one before running the
  installer again.
- Only Live 11 Intro is actually installed. The `Live 12.4.2` preferences
  folder is a leftover with no matching executable.

**The one remaining step is a GUI action and it is Adam's to do**, once, and it
then persists forever:

1. Live > Options > Preferences > **Link/Tempo/MIDI**
2. **Control Surface** slot 1 (it is empty, nothing to displace) > **AbletonMCP**
3. Leave **Input** and **Output** both **None**
4. The status bar should read "AbletonMCP: Listening for commands on port 9877"

Confirm from a shell with `Get-NetTCPConnection -LocalPort 9877 -State Listen`.
Once that returns a row, every Ableton MCP tool works and no further GUI
clicking is needed.

Claude cannot complete step 2 reliably: Live's window does not stay in the
screen capture (it returns black or drops to the desktop mid-sequence), which
is the same failure the 2026-09-03 session hit. Do not spend another session
trying to automate this one dropdown.

## Two pieces

1. **MCP server** · configured in `.mcp.json`, runs via `uvx`. Claude talks to
   this.
2. **Remote Script** · Python that runs *inside* Live and opens a socket on
   port 9877. Installed by `install-ableton-mcp.ps1`.

## Two deliberate changes from upstream

Both are security fixes. Keep them if you re-install or upgrade.

### 1. The Remote Script binds loopback, not every interface

Upstream ships `HOST = "0.0.0.0"`, which listens on **every network
interface**, with **no authentication** anywhere in the script. On shared wifi
(Network School, coworking, hotels) anyone on that LAN could connect to port
9877 and drive your Live set.

The vendored copy here sets `HOST = "127.0.0.1"`. The MCP server runs on the
same machine, so loopback is all that is ever needed.

### 2. Telemetry is off

The MCP server posts to a third-party Supabase project by default, on startup
and per tool call. It is not a counter: every tool takes a `user_prompt`
argument described as "for telemetry", and `add_notes_to_clip` is decorated
`capture_notes=True`, so **prompts and actual MIDI note data** are in scope.

`.mcp.json` sets `DISABLE_TELEMETRY`, `ABLETON_MCP_DISABLE_TELEMETRY`, and
`MCP_DISABLE_TELEMETRY`. Verified: zero outbound calls with these set.

If you are building an original catalogue, leave this off.

## Version pin

`.mcp.json` runs `uvx --with "mcp<2" ableton-mcp`. Upstream does not pin its
`mcp` dependency, and `mcp` 2.0.0 removed `mcp.server.fastmcp`, so an unpinned
run crashes on import. Last working version is `mcp` 1.9.4.

## Setup

```
powershell -ExecutionPolicy Bypass -File tools\ableton\install-ableton-mcp.ps1
```

Then in Live: **Preferences > Link/Tempo/MIDI > Control Surface > AbletonMCP**,
Input and Output both **None**. Live shows "AbletonMCP: Listening for commands
on port 9877".

Restart Claude Code so it picks up `.mcp.json`, and keep Live open while using
it.

The repository-level configuration lives at `strummer.fun/.mcp.json`, so it
applies whether the session starts at the repository root or inside `songs/`.
Spotify uses the authenticated built-in connector and is deliberately not
duplicated in this local MCP file.

## Live 11 limitation

The installed Live 11 Intro supports the MIDI, browser, transport, and
Arrangement commands used by this workflow. Direct audio-clip creation via
`ClipSlot.create_audio_clip` requires Live 12.0.5 or newer. On Live 11, drag
Splice samples and vocal recordings into the set manually; no upgrade is
required for the rest of the workflow.
