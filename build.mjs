// Assemble the Vercel output: strummer's static player at /, vibecheck at /vibe.
// Serverless functions come from /api (Vercel convention) and are untouched here.
import { cpSync, mkdirSync, existsSync, rmSync } from 'node:fs';

const OUT = 'dist';
const STRUMMER_STATIC = ['index.html', 'app.js', 'styles.css'];

if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

for (const file of STRUMMER_STATIC) {
  cpSync(file, `${OUT}/${file}`);
}

// Vite built vibe/ with base '/vibe/' into vibe/dist — mount it at /vibe.
cpSync('vibe/dist', `${OUT}/vibe`, { recursive: true });

console.log(`Assembled ${OUT}/: strummer at /, vibecheck at /vibe`);
