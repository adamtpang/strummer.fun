export const KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SHARP_KEYS = new Set(['G', 'D', 'A', 'E', 'B']);
export const spell = (pitch, key) => (SHARP_KEYS.has(key) ? SHARP_NAMES : KEYS)[((pitch % 12) + 12) % 12];
export const INTERVALS = { '': [0, 4, 7], m: [0, 3, 7], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], '7': [0, 4, 7, 10] };
export const PATTERNS = {
  personal: [ [[0,'maj7','Imaj7'],[4,'m7','iii7'],[5,'maj7','IVmaj7'],[4,'m7','iii7'],[0,'maj7','Imaj7'],[4,'m7','iii7'],[9,'m7','vi7'],[5,'maj7','IVmaj7']] ],
  pop: [ [[0,'','I'],[7,'','V'],[9,'m','vi'],[5,'','IV']], [[0,'','I'],[9,'m','vi'],[5,'','IV'],[7,'','V']], [[5,'','IV'],[7,'','V'],[0,'','I'],[9,'m','vi']] ],
  soul: [ [[2,'m7','ii7'],[7,'7','V7'],[0,'maj7','Imaj7'],[9,'m7','vi7']], [[0,'maj7','Imaj7'],[4,'m7','iii7'],[5,'maj7','IVmaj7'],[5,'m7','iv7']], [[5,'maj7','IVmaj7'],[4,'m7','iii7'],[2,'m7','ii7'],[7,'7','V7']] ],
  bossa: [ [[0,'maj7','Imaj7'],[9,'7','VI7'],[2,'m7','ii7'],[7,'7','V7']], [[2,'m7','ii7'],[7,'7','V7'],[0,'maj7','Imaj7'],[0,'maj7','Imaj7']], [[0,'maj7','Imaj7'],[0,'7','I7'],[5,'maj7','IVmaj7'],[5,'m7','iv7']] ],
  minor: [ [[0,'m','i'],[8,'','bVI'],[3,'','bIII'],[10,'','bVII']], [[0,'m7','i7'],[5,'m7','iv7'],[8,'maj7','bVImaj7'],[7,'7','V7']], [[0,'m','i'],[10,'','bVII'],[8,'','bVI'],[7,'7','V7']] ],
};
export const GREATEST = [
  { id: 'axis', name: 'The pop axis', formula: 'I - V - vi - IV', key: 'G', feel: 'Bright and inevitable. The single most used loop in modern pop.',
    songs: ['Let It Be (The Beatles)', 'No Woman, No Cry (Bob Marley & The Wailers)', "Don't Stop Believin' (Journey)", 'With or Without You (U2)'],
    chords: [[0,'','I'],[7,'','V'],[9,'m','vi'],[5,'','IV']] },
  { id: 'fifties', name: 'The fifties progression', formula: 'I - vi - IV - V', key: 'G', feel: 'Doo-wop warmth. Sweet, nostalgic, made for a slow dance.',
    songs: ['Stand By Me (Ben E. King)', 'Earth Angel (The Penguins)', 'Every Breath You Take (The Police)'],
    chords: [[0,'','I'],[9,'m','vi'],[5,'','IV'],[7,'','V']] },
  { id: 'minor-axis', name: 'The axis from the minor chord', formula: 'vi - IV - I - V', key: 'G', feel: 'The same four chords as the pop axis, started on the sad one.',
    songs: ['Zombie (The Cranberries)', 'Save Tonight (Eagle-Eye Cherry)', 'Numb (Linkin Park)'],
    chords: [[9,'m','vi'],[5,'','IV'],[0,'','I'],[7,'','V']] },
  { id: 'blues', name: 'Twelve-bar blues', formula: 'I7 x4 - IV7 x2 - I7 x2 - V7 - IV7 - I7 - V7', key: 'A', feel: 'The root of rock and roll. Twelve bars, three chords, endless.',
    songs: ['Johnny B. Goode (Chuck Berry)', 'Hound Dog (Big Mama Thornton)', 'Pride and Joy (Stevie Ray Vaughan)', 'Rock and Roll (Led Zeppelin)'],
    chords: [[0,'7','I7'],[0,'7','I7'],[0,'7','I7'],[0,'7','I7'],[5,'7','IV7'],[5,'7','IV7'],[0,'7','I7'],[0,'7','I7'],[7,'7','V7'],[5,'7','IV7'],[0,'7','I7'],[7,'7','V7']] },
  { id: 'andalusian', name: 'The Andalusian cadence', formula: 'i - bVII - bVI - V', key: 'A', feel: 'A stepwise walk down to a major V. Flamenco, surf, and drama.',
    songs: ['Hit the Road Jack (Ray Charles)', 'Runaway (Del Shannon)', "Walk Don't Run (The Ventures)"],
    chords: [[0,'m','i'],[10,'','bVII'],[8,'','bVI'],[7,'','V']] },
  { id: 'canon', name: "Pachelbel's Canon", formula: 'I - V - vi - iii - IV - I - IV - V', key: 'G', feel: 'A descending bass under eight chords. Three centuries old and still at weddings.',
    songs: ['Canon in D (Johann Pachelbel)', 'Go West (Village People)', 'Graduation (Friends Forever) (Vitamin C)'],
    chords: [[0,'','I'],[7,'','V'],[9,'m','vi'],[4,'m','iii'],[5,'','IV'],[0,'','I'],[5,'','IV'],[7,'','V']] },
  { id: 'three-chord', name: 'Three-chord rock and roll', formula: 'I - IV - V - IV', key: 'G', feel: 'Party, garage, and the first song most guitarists ever learn.',
    songs: ['La Bamba (Ritchie Valens)', 'Twist and Shout (The Isley Brothers)', 'Wild Thing (The Troggs)'],
    chords: [[0,'','I'],[5,'','IV'],[7,'','V'],[5,'','IV']] },
  { id: 'mixolydian', name: 'The Mixolydian swagger', formula: 'I - bVII - IV', key: 'D', feel: 'Major, but the flat seven keeps it from ever sounding polite.',
    songs: ['Sweet Home Alabama (Lynyrd Skynyrd)', 'Sympathy for the Devil (The Rolling Stones)', 'Gloria (Them)'],
    chords: [[0,'','I'],[10,'','bVII'],[5,'','IV']], beats: [2, 2, 4] },
  { id: 'creep', name: 'The major III and borrowed iv', formula: 'I - III - IV - iv', key: 'G', feel: 'Two chords that should not be there. The minor iv is the ache.',
    songs: ['Creep (Radiohead)', 'The Air That I Breathe (The Hollies)'],
    chords: [[0,'','I'],[4,'','III'],[5,'','IV'],[5,'m','iv']] },
  { id: 'two-five-one', name: 'The two-five-one', formula: 'ii7 - V7 - Imaj7', key: 'C', feel: 'Tension, release, home. The sentence every jazz tune is built from.',
    songs: ['Autumn Leaves (standard)', 'Fly Me to the Moon (Bart Howard)', 'Satin Doll (Duke Ellington)'],
    chords: [[2,'m7','ii7'],[7,'7','V7'],[0,'maj7','Imaj7'],[0,'maj7','Imaj7']] },
  { id: 'heavens-door', name: "Heaven's Door", formula: 'I - V - ii, I - V - IV', key: 'G', feel: 'Two answers to the same question, one sad and one resolved.',
    songs: ["Knockin' on Heaven's Door (Bob Dylan)"],
    chords: [[0,'','I'],[7,'','V'],[2,'m','ii'],[2,'m','ii'],[0,'','I'],[7,'','V'],[5,'','IV'],[5,'','IV']] },
  { id: 'rhythm', name: 'The turnaround', formula: 'I - vi - ii - V', key: 'C', feel: 'The fifties loop with ii in place of IV. Standards, show tunes, and endings.',
    songs: ['Blue Moon (Rodgers & Hart)', 'I Got Rhythm (George Gershwin)'],
    chords: [[0,'','I'],[9,'m','vi'],[2,'m','ii'],[7,'','V']] },
];
export const greatestById = id => GREATEST.find(progression => progression.id === id) ?? null;
export function pickGreatest(currentId, random = Math.random) {
  const others = GREATEST.filter(progression => progression.id !== currentId);
  return others[Math.floor(random() * others.length)];
}
export function generate(style, previous = [], locks = [], random = Math.random) {
  if (!PATTERNS[style]) throw new Error('Unknown style');
  const choices = PATTERNS[style].filter(pattern => pattern.some((chord, index) => !locks[index] && JSON.stringify(chord) !== JSON.stringify(previous[index])));
  const pattern = choices.length ? choices[Math.floor(random() * choices.length)] : PATTERNS[style][0];
  return pattern.map((chord, index) => [...(locks[index] && previous[index] ? previous[index] : chord)]);
}
export function describe(chord, key) {
  const [offset, quality, degree] = chord;
  const root = (KEYS.indexOf(key) + offset) % 12;
  if (!KEYS.includes(key) || !INTERVALS[quality]) throw new Error('Invalid chord');
  return { name: spell(root, key) + quality, degree, notes: INTERVALS[quality].map(interval => 48 + root + interval) };
}
function expectedLength(item) {
  if (item.style === 'personal') return 8;
  if (item.style === 'greatest') return greatestById(item.progression)?.chords.length ?? -1;
  return 4;
}
export function validSaved(value) {
  return Array.isArray(value) && value.length <= 50 && value.every(item => item && KEYS.includes(item.key) && (PATTERNS[item.style] || item.style === 'greatest') && Number.isInteger(item.tempo) && item.tempo >= 40 && item.tempo <= 200 && Array.isArray(item.chords) && item.chords.length === expectedLength(item) && item.chords.every(chord => Array.isArray(chord) && chord.length === 3 && Number.isInteger(chord[0]) && chord[0] >= 0 && chord[0] < 12 && Object.hasOwn(INTERVALS, chord[1]) && typeof chord[2] === 'string' && chord[2].length < 20));
}
export function beatsFor(style, index, bars = 1, progression = null) {
  if (style === 'personal') return [8,4,2,2,8,4,2,2][index];
  if (style === 'greatest' && progression?.beats) return progression.beats[index] * bars;
  return 4 * bars;
}
export function rootOf(chord, key) { return (KEYS.indexOf(key) + chord[0]) % 12; }
export function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2), view = new DataView(buffer);
  const text = (offset, value) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,1,true); view.setUint32(24,sampleRate,true); view.setUint32(28,sampleRate*2,true); view.setUint16(32,2,true); view.setUint16(34,16,true); text(36,'data'); view.setUint32(40,samples.length*2,true);
  samples.forEach((sample,index) => view.setInt16(44+index*2, Math.round(Math.max(-1,Math.min(1,sample)) * (sample < 0 ? 32768 : 32767)), true));
  return buffer;
}
