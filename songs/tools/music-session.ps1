# Live session mode. Run this WHILE you're making music (Ableton open, Claude
# driving it via ableton-mcp, or just you editing song files by hand). It
# watches src/content/songs/ and fires an immediate reward - a banner plus a
# beep - the instant a real step lands, instead of making you wait until
# `music-score.ps1` after the fact. That immediacy is the whole point: the
# dopamine hit has to land while you're still in the DAW, or scrolling
# Spotify stays the easier reward.
#
#   tools\music-session.ps1                  # start a session, watch and reward
#   tools\music-session.ps1 -Quest weekly     # frame progress as boss-fight XP
#   tools\music-session.ps1 -Once             # just print current status, no watch
#
# Reuses Get-MusicScore / Get-MusicStreak from MusicScore.psm1 - same source
# of truth as music-score.ps1, so this can never show a different number than
# the scoreboard for the same repo state.

param(
  [ValidateSet('daily', 'weekly', 'side', 'free')]
  [string]$Quest = 'free',
  [switch]$Once,
  [int]$PollSeconds = 2,
  [switch]$__NoRun   # test hook: load functions without starting a session
)

$ErrorActionPreference = 'Stop'
$here = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$repo = Resolve-Path (Join-Path $here '..')
Import-Module (Join-Path $here 'MusicScore.psm1') -Force

$QUEST_LABELS = @{
  daily  = 'DAILY QUEST - 3 replies + one song rep'
  weekly = 'WEEKLY BOSS - take one sketch to produced or released'
  side   = 'SIDE QUEST - a study from SONGWRITERS.md'
  free   = 'FREE PLAY - no quest pinned, XP still counts'
}

function Show-StartBanner([hashtable]$score, [hashtable]$streak, [string]$quest) {
  Write-Host ""
  Write-Host "  ================================" -ForegroundColor DarkGray
  Write-Host "   SESSION START -- $($QUEST_LABELS[$quest])" -ForegroundColor Yellow
  Write-Host "  ================================" -ForegroundColor DarkGray
  Write-Host ("  {0} XP   x   {1}" -f $score.Xp, $score.Level) -ForegroundColor Cyan
  if ($streak.Streak -gt 0 -and $streak.StreakNote -notlike 'BROKEN*') {
    Write-Host ("  streak {0} days - keep it alive today" -f $streak.Streak) -ForegroundColor Green
  } elseif ($streak.StreakNote -like 'BROKEN*') {
    Write-Host "  streak is broken - one rep today restarts it" -ForegroundColor DarkYellow
  } else {
    Write-Host "  no streak yet - today can be day one" -ForegroundColor DarkGray
  }
  Write-Host ""
  Write-Host "  watching src/content/songs/ ... make something. Ctrl+C to end." -ForegroundColor DarkGray
  Write-Host ""
}

# Renders the reward for one polling tick's XP delta and plays a matching
# chime. Pure enough to unit-test: pass synthetic before/after score hashtables.
function Show-XpGain([hashtable]$before, [hashtable]$after, [string]$quest) {
  $delta = $after.Xp - $before.Xp
  if ($delta -le 0) { return }

  $leveledUp = $after.Level -ne $before.Level
  $changedCounts = @()
  foreach ($key in $after.Counts.Keys) {
    $diff = $after.Counts[$key] - $before.Counts[$key]
    if ($diff -gt 0) { $changedCounts += "$key +$diff" }
  }

  Write-Host ""
  if ($leveledUp) {
    Write-Host "  ***  LEVEL UP: $($after.Level)  ***" -ForegroundColor Magenta
    try { 700, 900, 1100, 1400 | ForEach-Object { [console]::beep($_, 110) } } catch {}
  } else {
    Write-Host ("  +{0} XP" -f $delta) -ForegroundColor Green
    try { [console]::beep((600 + ([Math]::Min($delta, 20) * 15)), 140) } catch {}
  }
  if ($changedCounts.Count -gt 0) {
    Write-Host ("  {0}" -f ($changedCounts -join '   ')) -ForegroundColor DarkGray
  }
  # Boss-fight framing: a weekly quest cares about produced/released, not sketches.
  if ($quest -eq 'weekly' -and ($after.Counts.produced -gt $before.Counts.produced -or $after.Counts.released -gt $before.Counts.released)) {
    Write-Host "  BOSS HIT -- that's the weekly quest landing" -ForegroundColor Yellow
  }
  Write-Host ("  running total: {0} XP   x   {1}" -f $after.Xp, $after.Level) -ForegroundColor Cyan
  Write-Host ""
}

function Show-SessionSummary([hashtable]$start, [hashtable]$end) {
  $delta = $end.Xp - $start.Xp
  Write-Host ""
  Write-Host "  ================================" -ForegroundColor DarkGray
  Write-Host "   SESSION END" -ForegroundColor Yellow
  Write-Host "  ================================" -ForegroundColor DarkGray
  if ($delta -gt 0) {
    Write-Host ("  +{0} XP this session   ({1} -> {2})" -f $delta, $start.Xp, $end.Xp) -ForegroundColor Green
  } else {
    Write-Host "  0 XP this session -- still counts as time in the DAW, not on Spotify" -ForegroundColor DarkGray
  }
  Write-Host ("  now: {0} XP   x   {1}" -f $end.Xp, $end.Level) -ForegroundColor Cyan
  Write-Host ""
}

function Start-MusicSession([string]$repoRoot, [string]$quest, [bool]$once, [int]$pollSeconds) {
  $baseline = Get-MusicScore $repoRoot
  $streak = Get-MusicStreak $repoRoot
  Show-StartBanner $baseline $streak $quest

  if ($once) {
    Write-Host "  (-Once given: status only, not watching)" -ForegroundColor DarkGray
    return
  }

  $last = $baseline
  try {
    while ($true) {
      Start-Sleep -Seconds $pollSeconds
      $current = Get-MusicScore $repoRoot
      Show-XpGain $last $current $quest
      $last = $current
    }
  } finally {
    Show-SessionSummary $baseline $last
  }
}

if (-not $__NoRun) {
  Start-MusicSession $repo $Quest $Once.IsPresent $PollSeconds
}
