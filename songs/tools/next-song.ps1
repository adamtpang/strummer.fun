# Mints the next song starting position into a real file, ready to open.
#
#   tools\next-song.ps1              # next unused row
#   tools\next-song.ps1 -Number 137  # a specific one
#   tools\next-song.ps1 -Template A  # next row of a given template
#
# The point: you should never open an empty anything. This hands you a file that
# already has a key, a tempo, a progression, and one move to try, so the session
# starts at "improve this" instead of "create something".

param(
  [int]$Number,
  [ValidateSet('A', 'B', 'C', 'D')][string]$Template
)

$ErrorActionPreference = 'Stop'
$here = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$repo = Resolve-Path (Join-Path $here '..')
$queue = Join-Path $repo 'SONGS-QUEUE.md'
$songDir = Join-Path $repo 'src\content\songs'

if (-not (Test-Path $queue)) { throw "No queue at $queue. Run tools\gen-song-queue.ps1 first." }

# Which numbers already exist as real song files?
$taken = @{}
Get-ChildItem $songDir -Filter *.md -ErrorAction SilentlyContinue | ForEach-Object {
  $c = Get-Content $_.FullName -Raw
  if ($c -match '(?m)^number:\s*(\d+)') { $taken[[int]$Matches[1]] = $true }
}

$TEMPLATE_NAMES = @{ A = 'Avril 14th'; B = 'Xtal'; C = 'Lemon Twigs'; D = 'Groove study' }
$BUDGETS = @{ A = '45 to 60 minutes'; B = '60 to 90 minutes'; C = 'two sessions'; D = 'one session' }
$STAGES = @{ A = 'demo'; B = 'sketch'; C = 'produced'; D = 'sketch' }

$pick = $null
foreach ($line in (Get-Content $queue)) {
  if ($line -notmatch '^\|\s*(\d+)\s*\|\s*([ABCD])\s*\|\s*([^|]+?)\s*\|\s*(\d+)\s*\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|') { continue }
  $row = [pscustomobject]@{
    Num = [int]$Matches[1]; T = $Matches[2]; Key = $Matches[3]
    Tempo = [int]$Matches[4]; Chords = $Matches[5]; Move = $Matches[6]
  }
  if ($Number) { if ($row.Num -eq $Number) { $pick = $row; break } else { continue } }
  if ($Template -and $row.T -ne $Template) { continue }
  if (-not $taken.ContainsKey($row.Num)) { $pick = $row; break }
}

if (-not $pick) { throw "Nothing to mint (already taken, or no match)." }

$slug = "no-$('{0:D3}' -f $pick.Num)"
$path = Join-Path $songDir "$slug.md"
if (Test-Path $path) { throw "$path already exists." }

$date = Get-Date -Format 'yyyy-MM-dd'
$body = @"
---
title: 'no. $('{0:D3}' -f $pick.Num)'
date: $date
number: $($pick.Num)
stage: sketch
key: '$($pick.Key)'
tempo: $($pick.Tempo)
chords: '$($pick.Chords)'
tags: [song, sketch, template-$($pick.T.ToLower())]
draft: true
---

Template $($pick.T), "$($TEMPLATE_NAMES[$pick.T])". Rename this once you hear what it is.

## The move

**$($pick.Move)**

That is the only instruction. Everything else is already decided, so there is
nothing to invent before you start playing.

## The frame

- **Key** $($pick.Key)
- **Tempo** $($pick.Tempo) bpm
- **Chords** ``$($pick.Chords)``
- **Budget** $($BUDGETS[$pick.T])
- **Ship at** ``stage: $($STAGES[$pick.T])``

## The stack

- [x] key + tempo
- [x] chords
- [ ] melody
- [ ] lyrics
- [ ] recording
- [ ] liner notes

Done when it is bounced, not when it is good.
"@

Set-Content -Path $path -Value $body -Encoding utf8

Write-Host ""
Write-Host "No. $($pick.Num)  ·  Template $($pick.T)  ·  $($pick.Key)  ·  $($pick.Tempo) bpm" -ForegroundColor Cyan
Write-Host "  $($pick.Chords)" -ForegroundColor White
Write-Host ""
Write-Host "  $($pick.Move)" -ForegroundColor Green
Write-Host ""
Write-Host "  $path"
Write-Host "  Budget: $($BUDGETS[$pick.T]). Go play it." -ForegroundColor Yellow
