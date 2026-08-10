# Installs the AbletonMCP Remote Script into Ableton Live.
#
# Run this AFTER the Ableton installer has finished. It is safe to re-run.
#
#   powershell -ExecutionPolicy Bypass -File scripts\install-ableton-mcp.ps1
#
# What it does:
#   1. Finds the Live install and its MIDI Remote Scripts folder
#   2. Copies in AbletonMCP (hardened to bind 127.0.0.1 instead of 0.0.0.0)
#   3. Verifies the copy
#
# Then, in Live: Preferences > Link/Tempo/MIDI > Control Surface > AbletonMCP.

$ErrorActionPreference = 'Stop'

$src = Join-Path $PSScriptRoot 'AbletonMCP_Remote_Script\__init__.py'
if (-not (Test-Path $src)) {
  throw "Remote script not found at $src"
}

# --- 1. Find Live -----------------------------------------------------------
$roots = Get-ChildItem 'C:\ProgramData\Ableton' -Directory -Force -ErrorAction SilentlyContinue
if (-not $roots) { throw "No Ableton install found under C:\ProgramData\Ableton" }

$installed = @()
foreach ($r in $roots) {
  $exe = Get-ChildItem (Join-Path $r.FullName 'Program') -Filter 'Ableton Live*.exe' -File -ErrorAction SilentlyContinue |
         Select-Object -First 1
  $rs = Join-Path $r.FullName 'Resources\MIDI Remote Scripts'
  if ($exe -and (Test-Path $rs)) {
    $installed += [pscustomobject]@{ Name = $r.Name; Exe = $exe.FullName; Scripts = $rs }
  }
}

if (-not $installed) {
  Write-Host "Ableton is present but not finished installing (no Live executable yet)." -ForegroundColor Yellow
  Write-Host "Let the installer finish, then run this script again."
  exit 1
}

# --- 2. Install -------------------------------------------------------------
foreach ($i in $installed) {
  $dest = Join-Path $i.Scripts 'AbletonMCP'
  Write-Host "Installing into $($i.Name)" -ForegroundColor Cyan
  New-Item -ItemType Directory -Path $dest -Force | Out-Null
  Copy-Item $src (Join-Path $dest '__init__.py') -Force

  # --- 3. Verify ------------------------------------------------------------
  $out = Join-Path $dest '__init__.py'
  $bound = (Select-String -Path $out -Pattern '^HOST = ' | Select-Object -First 1).Line
  if (Test-Path $out) {
    Write-Host "  ok: $out" -ForegroundColor Green
    Write-Host "  $bound (loopback only)" -ForegroundColor Green
  } else {
    Write-Host "  FAILED to write $out" -ForegroundColor Red
  }
}

Write-Host ""
Write-Host "Next, in Ableton Live:" -ForegroundColor Cyan
Write-Host "  Preferences > Link/Tempo/MIDI > Control Surface > choose 'AbletonMCP'"
Write-Host "  Leave Input and Output set to None."
Write-Host "  Live should show: 'AbletonMCP: Listening for commands on port 9877'"
