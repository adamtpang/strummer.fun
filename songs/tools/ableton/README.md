# Ableton MCP

Lets Claude drive Ableton Live: create tracks, write MIDI clips, load
instruments from the browser, set tempo, fire clips. Used to scaffold the
Template A/B/C/D sessions in `SONGS-1000.md`.

Upstream: [ahujasid/ableton-mcp](https://github.com/ahujasid/ableton-mcp) (MIT).

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
