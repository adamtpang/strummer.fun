// Assemble the Vercel output: strummer's static player at /, vibecheck at /vibe.
// Serverless functions come from /api (Vercel convention) and are untouched here.
import { cpSync, mkdirSync, existsSync, rmSync } from 'node:fs';

const OUT = 'dist';
const STRUMMER_STATIC = [
  'index.html', 'app.js', 'styles.css',
  'tune.html', 'tune.js', 'tune.css', 'analyze.js', 'analyze-ui.js',
  'about.html', 'contact.html', 'privacy.html',
  'robots.txt', 'llms.txt', 'sitemap.xml',
];

if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
mkdirSync(`${OUT}/chords`, { recursive: true });
for (const file of ['index.html', 'style.css', 'studio.css', 'tokens.css', 'app.mjs', 'engine.mjs', 'guitar.mjs']) {
  cpSync(`chords/${file}`, `${OUT}/chords/${file}`);
}
mkdirSync(`${OUT}/receipt`, { recursive: true });
for (const file of ['index.html', 'style.css', 'app.mjs', 'receipt.mjs', 'qrcode.mjs']) {
  cpSync(`receipt/${file}`, `${OUT}/receipt/${file}`);
}

for (const file of STRUMMER_STATIC) {
  cpSync(file, `${OUT}/${file}`);
}

// Vite built vibe/ with base '/vibe/' into vibe/dist — mount it at /vibe.
cpSync('vibe/dist', `${OUT}/vibe`, { recursive: true });

console.log(`Assembled ${OUT}/: strummer at /, vibecheck at /vibe`);
