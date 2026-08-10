# Shared scoring engine for the music game. One source of truth for XP maths
# in PowerShell — music-score.ps1 (the scoreboard) and music-session.ps1 (the
# live watcher) both import this instead of each computing XP their own way.
# The XP table itself is documented in MUSIC-GAME.md; keep both in sync if you
# change it.

$script:LEVELS = [ordered]@{
  'Demo Tape'      = 0
  'Gold'           = 50
  'Platinum'       = 150
  'Multi-Platinum' = 400
  'Diamond'        = 1000
  'Catalog Artist' = 2500
}

function Test-MusicChecked([string]$body, [string]$item) {
  return [bool]([regex]::Match($body, "(?im)^-\s*\[x\]\s*$([regex]::Escape($item))")).Success
}

<#
.SYNOPSIS
  Reads src/content/songs/ and computes total XP, level, and per-stage counts.
  Returns a hashtable: Xp, Level, Next, NextAt, Counts (ordered hashtable).
#>
function Get-MusicScore([string]$repoRoot) {
  $songDir = Join-Path $repoRoot 'src\content\songs'
  $files = Get-ChildItem $songDir -Filter *.md -File -ErrorAction SilentlyContinue

  $xp = 0
  $counts = [ordered]@{ sketch = 0; melody = 0; lyrics = 0; demo = 0; produced = 0; released = 0; study = 0; speedRound = 0 }

  foreach ($f in $files) {
    $raw = Get-Content $f.FullName -Raw
    $fm = if ($raw -match '(?s)^---\r?\n(.*?)\r?\n---') { $Matches[1] } else { '' }
    $body = $raw.Substring([Math]::Min($raw.Length, ($raw.IndexOf('---', 3) + 3)))

    $hasKey = $fm -match "(?m)^key:\s*\S"
    $hasTempo = $fm -match "(?m)^tempo:\s*\d"
    $hasChords = $fm -match "(?m)^chords:\s*\S"
    $isDraft = -not ($fm -match "(?m)^draft:\s*false")
    $stage = if ($fm -match "(?m)^stage:\s*'?([a-z]+)") { $Matches[1] } else { 'sketch' }
    $isStudy = $fm -match "(?m)^tags:.*\bstudy\b"
    $isSpeedRound = $fm -match "(?m)^tags:.*\bspeed-round\b"

    if ($hasKey -and $hasTempo -and $hasChords) { $xp += 1; $counts.sketch++ }
    if (Test-MusicChecked $body 'melody') { $xp += 2; $counts.melody++ }
    if (Test-MusicChecked $body 'lyrics') { $xp += 2; $counts.lyrics++ }
    if ((Test-MusicChecked $body 'recording') -or ($stage -in 'demo', 'produced', 'released')) { $xp += 5; $counts.demo++ }
    if ($stage -eq 'produced') { $xp += 8; $counts.produced++ }
    if (-not $isDraft) { $xp += 20; $counts.released++ }
    if ($isStudy) { $xp += 3; $counts.study++ }
    # Same bonus as a study, deliberately: a speed round finishing at all is
    # exactly as valuable as logging a study, per the whole point of it
    # existing (reward speed over polish, don't make it the lesser option).
    if ($isSpeedRound) { $xp += 3; $counts.speedRound++ }
  }

  $level = 'Demo Tape'; $next = $null; $nextAt = $null
  $keys = @($script:LEVELS.Keys)
  for ($i = 0; $i -lt $keys.Count; $i++) {
    if ($xp -ge $script:LEVELS[$keys[$i]]) { $level = $keys[$i] }
    if ($xp -lt $script:LEVELS[$keys[$i]] -and -not $next) { $next = $keys[$i]; $nextAt = $script:LEVELS[$keys[$i]] }
  }

  return @{ Xp = $xp; Level = $level; Next = $next; NextAt = $nextAt; Counts = $counts }
}

<#
.SYNOPSIS
  Streak + this-week/best-week, from git history on src/content/songs/.
#>
function Get-MusicStreak([string]$repoRoot) {
  $days = @()
  try {
    $days = git -C "$repoRoot" log --follow --format='%ad' --date=short -- src/content/songs/ 2>$null |
      Sort-Object -Unique -Descending
  } catch { $days = @() }

  $streak = 0; $streakNote = 'no history yet'
  if ($days.Count -gt 0) {
    $today = Get-Date -Format 'yyyy-MM-dd'
    $cursor = [datetime]::Parse($days[0])
    foreach ($d in $days) {
      $dt = [datetime]::Parse($d)
      if ($dt -eq $cursor) { $streak++; $cursor = $cursor.AddDays(-1) }
      elseif ($dt -eq $cursor.AddDays(0)) { continue }
      else { break }
    }
    $gap = ([datetime]::Parse($today) - [datetime]::Parse($days[0])).Days
    $streakNote = if ($gap -eq 0) { 'active today' }
                  elseif ($gap -eq 1) { 'do something today to keep it' }
                  else { "BROKEN. Last rep $gap days ago ($($days[0]))" }
  }

  $weekOf = { param($d) [datetime]::Parse($d).AddDays(-[int][datetime]::Parse($d).DayOfWeek).ToString('yyyy-MM-dd') }
  $byWeek = $days | ForEach-Object { & $weekOf $_ } | Group-Object | Sort-Object Count -Descending
  $thisWeekKey = & $weekOf (Get-Date -Format 'yyyy-MM-dd')
  $thisWeek = ($byWeek | Where-Object { $_.Name -eq $thisWeekKey }).Count
  $bestWeek = if ($byWeek) { $byWeek[0].Count } else { 0 }

  return @{ Streak = $streak; StreakNote = $streakNote; ThisWeek = $thisWeek; BestWeek = $bestWeek }
}

Export-ModuleMember -Function Get-MusicScore, Get-MusicStreak, Test-MusicChecked
