export const TUNING = [4, 9, 2, 7, 11, 4];

const ROOTS = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };

const SHAPE_TABLE = {
  C: [-1, 3, 2, 0, 1, 0],
  D: [-1, -1, 0, 2, 3, 2],
  E: [0, 2, 2, 1, 0, 0],
  F: [1, 3, 3, 2, 1, 1],
  G: [3, 2, 0, 0, 0, 3],
  A: [-1, 0, 2, 2, 2, 0],
  B: [-1, 2, 4, 4, 4, 2],
  Am: [-1, 0, 2, 2, 1, 0],
  Bm: [-1, 2, 4, 4, 3, 2],
  Cm: [-1, 3, 5, 5, 4, 3],
  'C#m': [-1, 4, 6, 6, 5, 4],
  Dm: [-1, -1, 0, 2, 3, 1],
  Em: [0, 2, 2, 0, 0, 0],
  Fm: [1, 3, 3, 1, 1, 1],
  'F#m': [2, 4, 4, 2, 2, 2],
  Gm: [3, 5, 5, 3, 3, 3],
  A7: [-1, 0, 2, 0, 2, 0],
  B7: [-1, 2, 1, 2, 0, 2],
  C7: [-1, 3, 2, 3, 1, 0],
  D7: [-1, -1, 0, 2, 1, 2],
  E7: [0, 2, 0, 1, 0, 0],
  G7: [3, 2, 0, 0, 0, 1],
  Cmaj7: [-1, 3, 2, 0, 0, 0],
  Dmaj7: [-1, -1, 0, 2, 2, 2],
  Emaj7: [0, 2, 1, 1, 0, 0],
  Fmaj7: [-1, -1, 3, 2, 1, 0],
  Gmaj7: [3, 2, 0, 0, 0, 2],
  Amaj7: [-1, 0, 2, 1, 2, 0],
  Am7: [-1, 0, 2, 0, 1, 0],
  Bm7: [-1, 2, 0, 2, 0, 2],
  Dm7: [-1, -1, 0, 2, 1, 1],
  Em7: [0, 2, 0, 0, 0, 0],
};

const BARRE = new Set(['F', 'B', 'Bm', 'Cm', 'C#m', 'Fm', 'F#m', 'Gm']);

function parseName(name) {
  const match = /^([A-G]#?)(.*)$/.exec(name);
  return { root: ROOTS[match[1]], quality: match[2] };
}

const BY_PITCH = new Map(
  Object.entries(SHAPE_TABLE).map(([name, frets]) => {
    const { root, quality } = parseName(name);
    return [`${root}:${quality}`, { name, frets, barre: BARRE.has(name) }];
  }),
);

export const SHAPES = SHAPE_TABLE;

export function shapeFor(root, quality) {
  return BY_PITCH.get(`${((root % 12) + 12) % 12}:${quality}`) ?? null;
}

export function soundedPitchClasses(frets) {
  return [
    ...new Set(
      frets.flatMap((fret, string) => (fret < 0 ? [] : [(TUNING[string] + fret) % 12])),
    ),
  ];
}

export const MAX_CAPO = 7;

export function findCapo(chords) {
  let best = null;
  for (let capo = 0; capo <= MAX_CAPO; capo++) {
    const shapes = chords.map(({ root, quality }) => shapeFor(root - capo, quality));
    if (shapes.some((shape) => !shape)) continue;
    const barres = shapes.filter((shape) => shape.barre).length;
    if (!best || barres < best.barres) best = { capo, shapes, barres };
    if (barres === 0) break;
  }
  return best;
}
