import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const types = { '.html': 'text/html', '.css': 'text/css', '.mjs': 'text/javascript' };
const allowed = new Map([
  ['/receipt/', 'receipt/index.html'], ['/receipt/style.css', 'receipt/style.css'],
  ['/receipt/app.mjs', 'receipt/app.mjs'], ['/receipt/receipt.mjs', 'receipt/receipt.mjs'],
  ['/chords/tokens.css', 'chords/tokens.css'],
]);
createServer(async (request, response) => {
  const file = allowed.get(new URL(request.url, 'http://127.0.0.1').pathname);
  if (!file) { response.writeHead(404); response.end(); return; }
  try {
    const body = await readFile(new URL(`../${file}`, import.meta.url));
    response.writeHead(200, { 'Content-Type': types[file.slice(file.lastIndexOf('.'))], 'Cache-Control': 'no-store' }); response.end(body);
  } catch { response.writeHead(500); response.end(); }
}).listen(Number(process.env.PORT || 4390), '127.0.0.1', () => console.log('Receipt preview ready'));
