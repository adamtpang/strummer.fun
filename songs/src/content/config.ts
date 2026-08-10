import { defineCollection, z } from 'astro:content';

// Songs: ported from pangaea.blog. A song is a stack, not a single artifact.
// See MUSIC-GAME.md and SONGS-1000.md for the model.
const songs = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.coerce.date().default(new Date('1970-01-01')),
    number: z.number().int().nonnegative().optional(),

    key: z.string().optional(), // "A minor", "F# dorian"
    tempo: z.number().int().positive().optional(), // BPM
    chords: z.string().optional(), // "| Am | F | C | G |"
    // The 4th required lego piece, see SONG-SPEC.md: one repeatable identity
    // element (a hook, a stab, a chord you let sit). Optional in the schema
    // so it doesn't break the ~50 sketches written before this field existed,
    // but the spec treats it as required for anything written after.
    hook: z.string().optional(),
    instruments: z.array(z.string()).optional(),
    stage: z.enum(['sketch', 'demo', 'produced', 'released']).default('sketch'),
    ableton: z.string().optional(), // the Ableton project folder name on disk
    lmms: z.string().optional(), // path under lmms-projects/, for headless-generated sketches
    audio: z.string().optional(), // a self-hosted demo

    spotify: z.string().optional(),
    soundcloud: z.string().optional(),
    youtube: z.string().optional(),
    blurb: z.string().optional(),
    cover: z.string().optional(),
    tags: z.array(z.string()).optional(),
    draft: z.boolean().default(true),
  }),
});

export const collections = { songs };
