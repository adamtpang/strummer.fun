import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const root = new URL('./', import.meta.url);
const allowed = new Map();
for (const file of ['index.html', 'app.js', 'styles.css', 'tune.html', 'tune.js', 'tune.css', 'analyze.js', 'analyze-ui.js', 'about.html', 'contact.html', 'privacy.html']) {
  allowed.set(`/${file}`, file);
  if (file.endsWith('.html')) allowed.set(`/${file.slice(0, -5)}`, file);
}
allowed.set('/', 'index.html');
for (const [folder, files] of Object.entries({
  chords: ['index.html', 'tokens.css', 'style.css', 'studio.css', 'app.mjs', 'engine.mjs', 'guitar.mjs'],
  learn: ['index.html', 'style.css', 'app.mjs', 'catalog.mjs'],
  receipt: ['index.html', 'style.css', 'app.mjs', 'receipt.mjs', 'qrcode.mjs'],
})) {
  for (const file of files) allowed.set(`/${folder}/${file}`, `${folder}/${file}`);
  allowed.set(`/${folder}/`, `${folder}/index.html`);
}
const types = { html: 'text/html', css: 'text/css', js: 'text/javascript', mjs: 'text/javascript' };
createServer(async (request, response) => {
  const path = new URL(request.url, 'http://127.0.0.1').pathname;
  if (path === '/vibe' || path.startsWith('/vibe/')) {
    response.writeHead(302, { Location: `http://127.0.0.1:4392${request.url}` }).end();
    return;
  }
  const file = allowed.get(path);
  if (!file) { response.writeHead(404).end(); return; }
  try {
    const body = await readFile(new URL(file, root));
    response.writeHead(200, { 'Content-Type': types[file.split('.').pop()], 'Cache-Control': 'no-store' }).end(body);
  } catch { response.writeHead(500).end(); }
}).listen(4394, '127.0.0.1', () => console.log('Studio preview at http://127.0.0.1:4394'));
