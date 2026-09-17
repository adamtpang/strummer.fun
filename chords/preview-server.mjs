import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const allowed = new Set(['index.html', 'style.css', 'studio.css', 'tokens.css', 'app.mjs', 'engine.mjs', 'guitar.mjs']);
createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  const name = pathname === '/chords/' ? 'index.html' : pathname.replace('/chords/', '');
  if (!pathname.startsWith('/chords/') || !allowed.has(name)) { response.writeHead(404); response.end(); return; }
  try {
    const body = await readFile(new URL(name, import.meta.url));
    response.writeHead(200, { 'Content-Type': name.endsWith('.mjs') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html' }); response.end(body);
  } catch { response.writeHead(500); response.end(); }
}).listen(Number(process.env.PORT || 4387), '127.0.0.1', () => console.log('Chord preview ready'));
