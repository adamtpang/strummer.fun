# Generates 1,000 song STARTING POSITIONS (not empty slots).
#
#   powershell -ExecutionPolicy Bypass -File tools\gen-song-queue.ps1
#
# Design constraint, in Adam's words: "I'm great at optimizing what already
# exists, but going from 0 to 1 is the hardest part." So nothing here is blank.
# Every row arrives with a key, a tempo, a real transposed chord progression,
# and one concrete move to try. The job is never "write a song", it is always
# "improve this thing that already exists".
#
# Vocabulary is derived from Adam's own top artists, not from generic theory.

$ErrorActionPreference = 'Stop'
$out = Join-Path $PSScriptRoot '..\SONGS-QUEUE.md'

$NOTES = @('C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B')

# Quality strings beginning with "/" are slash chords: the number after the
# slash is the bass note's semitone offset from the chord root, so it can be
# spelled as a real note name (C/B, G/F#) rather than printed literally.
function Chord([int]$tonic, [int]$semis, [string]$q) {
  $root = $NOTES[(($tonic + $semis) % 12)]
  if ($q -match '^/(\d+)$') {
    $bass = $NOTES[(($tonic + $semis + [int]$Matches[1]) % 12)]
    return "$root/$bass"
  }
  return $root + $q
}

# Progressions as (semitone offset from tonic, chord quality), so they transpose
# correctly into any key. Each is lifted from something in Adam's top 18.
$PROGS = @(
  @{ n='Aphex minor';       mode='min'; d=@(@(0,'m'),@(8,'maj7'),@(3,''),@(7,'7')) }
  @{ n='Andalusian';        mode='min'; d=@(@(0,'m'),@(10,''),@(8,''),@(7,'7')) }
  @{ n='Natural minor run'; mode='min'; d=@(@(0,'m'),@(8,''),@(3,''),@(10,'')) }
  @{ n='Chromatic mediant'; mode='maj'; d=@(@(0,''),@(8,''),@(3,''),@(7,'')) }
  @{ n='The minor iv';      mode='maj'; d=@(@(0,''),@(5,''),@(5,'m'),@(0,'')) }
  @{ n='Beatles vi-iv';     mode='maj'; d=@(@(0,''),@(9,'m'),@(5,''),@(5,'m')) }
  @{ n='Secondary dom';     mode='maj'; d=@(@(0,''),@(4,'7'),@(9,'m'),@(5,'')) }
  @{ n='Descending bass';   mode='maj'; d=@(@(0,''),@(0,'/11'),@(9,'m'),@(0,'/7')) }
  @{ n='Laufey ii-V';       mode='maj'; d=@(@(0,'maj7'),@(9,'m7'),@(2,'m7'),@(7,'7')) }
  @{ n='Bossa turnaround';  mode='maj'; d=@(@(5,'maj7'),@(4,'m7'),@(2,'m7'),@(7,'7')) }
  @{ n='Modal bright';      mode='maj'; d=@(@(2,''),@(9,'/4'),@(11,'m'),@(7,'')) }
  @{ n='Mixolydian';        mode='maj'; d=@(@(0,''),@(10,''),@(5,''),@(0,'')) }
  @{ n='One drop two';      mode='min'; d=@(@(0,'m'),@(5,'m')) }
  @{ n='Suspended drone';   mode='min'; d=@(@(0,'m'),@(10,'')) }
)

# Template definitions: budget, tempo range, and what "done" means.
$TEMPLATES = @(
  @{ k='A'; name='Avril 14th';   lo=60;  hi=84;  n=300; inst='piano' }
  @{ k='B'; name='Xtal';         lo=100; hi=130; n=250; inst='simpler, drum rack' }
  @{ k='C'; name='Lemon Twigs';  lo=100; hi=130; n=250; inst='guitar, bass, drums, vocals' }
  @{ k='D'; name='Groove study'; lo=70;  hi=140; n=200; inst='varies' }
)

# The MOVE is the point. It converts "make a song" into "try this one thing".
$MOVES = @{
  A = @(
    'Hold the top voice across all four chords. Only the bass moves.',
    'Play it once with the left hand alone before the melody enters.',
    'Put the melody a sixth above the root, not a third.',
    'Drop the second chord an octave. Leave a hole where it was.',
    'Use the sustain pedal through a chord change on purpose.',
    'Play the whole thing an octave higher the second time. Change nothing else.',
    'End on the wrong chord and let it ring.',
    'Take the left hand away for the last four bars.',
    'Play it slower than feels comfortable. Then slower again.',
    'Repeat one bar three extra times before resolving.'
  )
  B = @(
    'Sample your own voice humming one note. That is the pad.',
    'Put the breakbeat slightly behind the grid. Do not fix it.',
    'Automate the filter over 32 bars so it opens once, slowly.',
    'Build the cycle, then delete the element you like most.',
    'Let the bass play once per bar and nothing else.',
    'Run the whole cycle through Erosion until it hisses.',
    'Reverse the pad and use the tail as the intro.',
    'Bit-crush only the drums, keep the pad clean.',
    'Two chords for four minutes. No third chord.',
    'Record a room noise loop under everything at low volume.'
  )
  C = @(
    'Write the chorus first, then work backwards to a verse.',
    'Double the lead vocal by singing it twice, never by copying.',
    'Put the minor iv in the last line of the chorus only.',
    'Track real drums before anything else.',
    'Leave the first chorus without drums.',
    'Write the bridge in the relative minor.',
    'Give the bass a countermelody, not root notes.',
    'Keep it under two and a half minutes.',
    'Sing the whole thing an octave down first to find the melody.',
    'Add one instrument you cannot play well.'
  )
  D = @(
    'One drop: kick and snare together on beat three.',
    'Rumba: handclaps carry the groove, no kit at all.',
    'Bossa: thumb on bass, fingers comping offbeat, brushes only.',
    'UK garage: swing the sixteenths hard, chop a vocal for percussion.',
    'Afropop: two clean guitar lines interlocking, neither is rhythm.',
    'Play the groove for two minutes with no melody. Ship that.',
    'Program the drums, then replay them by hand and keep the human take.',
    'Put the snare where the kick usually is.',
    'Use only percussion you recorded in your room.',
    'Halve the tempo but keep the same subdivision.'
  )
}

$rows = New-Object System.Collections.Generic.List[string]
$rows.Add('# The 1,000 song queue')
$rows.Add('')
$rows.Add('Generated starting positions, not empty slots. Every row already has a')
$rows.Add('key, a tempo, a transposed progression, and one move to try, because the')
$rows.Add('hard part is 0 to 1 and this file does the 0 to 1 for you. Your job is')
$rows.Add('the part you are good at: take something that exists and make it better.')
$rows.Add('')
$rows.Add('Pick any row that calls to you. Ignore the order. Mint it with')
$rows.Add('`tools\next-song.ps1` or just open Ableton and play it.')
$rows.Add('')
$rows.Add('Templates and budgets live in `SONGS-1000.md`. Study queue in `SONGWRITERS.md`.')
$rows.Add('')
$rows.Add('| No. | T | Key | BPM | Progression | The move |')
$rows.Add('|---|---|---|---|---|---|')

$n = 41   # 0-40 already exist as real entries
$i = 0
foreach ($t in $TEMPLATES) {
  $valid = $PROGS | Where-Object { $t.k -ne 'A' -or $true }
  for ($c = 0; $c -lt $t.n; $c++) {
    if ($n -gt 999) { break }
    $tonic = ($i * 7) % 12                      # cycle by fifths, feels less random
    $p = $valid[$i % $valid.Count]
    # Move advances every row, progression every row, but on different periods
    # (10 vs 14), so pairings only repeat after 70. Advancing the move only once
    # per progression cycle made the first 14 rows instructionally identical.
    $moveSet = $MOVES[$t.k]
    $move = $moveSet[$i % $moveSet.Count]
    $span = $t.hi - $t.lo
    $tempo = $t.lo + (($i * 6) % ($span + 1))
    $keyName = $NOTES[$tonic] + $(if ($p.mode -eq 'min') { ' minor' } else { ' major' })
    $chords = '| ' + (($p.d | ForEach-Object { Chord $tonic $_[0] $_[1] }) -join ' | ') + ' |'
    $rows.Add("| $n | $($t.k) | $keyName | $tempo | ``$chords`` | $move |")
    $n++; $i++
  }
}

Set-Content -Path $out -Value ($rows -join "`n") -Encoding utf8
"wrote $out"
"rows: $($n - 41)  (No. 41 to No. $($n - 1))"
