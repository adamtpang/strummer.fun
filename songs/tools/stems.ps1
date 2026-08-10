# Split a song into stems: drums, bass, vocals, other.
#
#   tools\stems.ps1 "C:\path\to\song.mp3"
#   tools\stems.ps1 "song.mp3" -TwoStem vocals     # just vocals vs everything
#   tools\stems.ps1 "song.mp3" -Mp3                # smaller output, faster to audition
#
# Output lands in .\stems\<model>\<song name>\.
#
# Why: the fastest way to learn what a song is doing is to hear one part alone.
# Solo the bass and the harmony gives itself up in about a minute. See
# SONGWRITERS.md for the study protocol this feeds.

param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Path,

  # "vocals", "drums", "bass", or "other". Splits into that stem + everything else.
  [string]$TwoStem,

  # Write mp3 instead of wav. Much smaller, fine for study.
  [switch]$Mp3,

  # Where stems go. Default: .\stems at the repo root.
  [string]$Out
)

$ErrorActionPreference = 'Stop'

# $PSScriptRoot is not populated inside a param default, so resolve it here.
$here = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $Out) { $Out = Join-Path $here '..\stems' }

if (-not (Test-Path $Path)) { throw "No such file: $Path" }

$demucs = Join-Path $env:APPDATA 'uv\tools\demucs\Scripts\demucs.exe'
if (-not (Test-Path $demucs)) {
  throw "demucs not found. Install with: uv tool install demucs --with numpy --with soundfile --torch-backend=auto"
}

# Use the GPU when torch was built with CUDA, otherwise fall back to CPU.
$py = Join-Path $env:APPDATA 'uv\tools\demucs\Scripts\python.exe'
$cuda = & $py -c "import torch; print('yes' if torch.cuda.is_available() else 'no')" 2>$null
$device = if ($cuda -eq 'yes') { 'cuda' } else { 'cpu' }

$args = @('-n', 'htdemucs', '-d', $device, '-o', $Out)
if ($TwoStem) { $args += @('--two-stems', $TwoStem) }
if ($Mp3)     { $args += @('--mp3') }
$args += $Path

Write-Host "Separating on $device : $(Split-Path $Path -Leaf)" -ForegroundColor Cyan
if ($device -eq 'cpu') {
  Write-Host "  (CPU: expect a few minutes per song. GPU is roughly 10x faster.)" -ForegroundColor Yellow
}

& $demucs @args

$name = [IO.Path]::GetFileNameWithoutExtension($Path)
$dest = Join-Path $Out "htdemucs\$name"
if (Test-Path $dest) {
  Write-Host ""
  Write-Host "Stems:" -ForegroundColor Green
  Get-ChildItem $dest | ForEach-Object {
    "  {0,-12} {1,8:N1} MB" -f $_.Name, ($_.Length / 1MB)
  }
  Write-Host ""
  Write-Host "Start with bass. It gives up the harmony faster than the chords do." -ForegroundColor Cyan
}
