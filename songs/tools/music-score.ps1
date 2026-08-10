# The scoreboard. Reads src/content/songs/, prints XP, level, and streak.
#
#   tools\music-score.ps1
#
# XP table lives in MUSIC-GAME.md; the actual computation lives in
# MusicScore.psm1, which this script and music-session.ps1 both import — one
# source of truth, so the number never drifts between the CLI and the site
# (the /songs player card computes independently in TypeScript, since that's
# a different language; PowerShell-to-PowerShell has no excuse to duplicate).

$ErrorActionPreference = 'Stop'
$here = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$repo = Resolve-Path (Join-Path $here '..')
Import-Module (Join-Path $here 'MusicScore.psm1') -Force

$score = Get-MusicScore $repo
$streak = Get-MusicStreak $repo

# --- Print -------------------------------------------------------------------
Write-Host ""
Write-Host "  THE MUSIC GAME" -ForegroundColor Yellow
Write-Host "  --------------" -ForegroundColor DarkGray
Write-Host ("  {0} XP   x   {1}" -f $score.Xp, $score.Level) -ForegroundColor Cyan
if ($score.Next) {
  $need = $score.NextAt - $score.Xp
  Write-Host ("  {0} XP to {1}" -f $need, $score.Next) -ForegroundColor DarkGray
} else {
  Write-Host "  Top level. Catalog Artist. Keep going anyway." -ForegroundColor DarkGray
}
Write-Host ""
Write-Host ("  streak: {0} days ({1})" -f $streak.Streak, $streak.StreakNote)
Write-Host ("  this week: {0} rep days   x   best week: {1}" -f $streak.ThisWeek, $streak.BestWeek)
Write-Host ""
Write-Host "  the stack" -ForegroundColor DarkGray
Write-Host ("    sketches   {0,3}   melody {1,3}   lyrics {2,3}" -f $score.Counts.sketch, $score.Counts.melody, $score.Counts.lyrics)
Write-Host ("    demo       {0,3}   produced {1,3}   released {2,3}" -f $score.Counts.demo, $score.Counts.produced, $score.Counts.released)
if ($score.Counts.study -gt 0) { Write-Host ("    studies    {0,3}" -f $score.Counts.study) }
if ($score.Counts.speedRound -gt 0) { Write-Host ("    speed rounds {0,3}" -f $score.Counts.speedRound) }
Write-Host ""
