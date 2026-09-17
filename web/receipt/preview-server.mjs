import bestTrack from '../api/receipt/best-track.js';
import charts from '../api/receipt/charts.js';
import { topAlbums } from '../api/receipt/lastfm.js';

// Local preview only, never deployed: Last.fm is answered with sample albums so
// the pairing flow can be exercised without a real API key.
const SAMPLE_TOP = { topalbums: { album: [
  { name: 'The Art of Loving', playcount: '84', artist: { name: 'Olivia Dean' } },
  { name: 'Selected Ambient Works 85-92', playcount: '51', artist: { name: 'Aphex Twin' } },
  { name: 'Blonde', playcount: '37', artist: { name: 'Frank Ocean' } },
  { name: 'Kokomo, TX', playcount: '22', artist: { name: 'Hotel Fiction' } },
] } };
const sampleLastfm = async () => new Response(JSON.stringify(SAMPLE_TOP));
const apis = {
  '/api/receipt/best-track': (req) => bestTrack(req),
  '/api/receipt/charts': (req) => charts(req),
  '/api/receipt/lastfm': (req) => topAlbums(req, 'preview-sample', sampleLastfm),
};
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const types = { '.html': 'text/html', '.css': 'text/css', '.mjs': 'text/javascript' };
const allowed = new Map([
  ['/receipt/', 'receipt/index.html'], ['/receipt/style.css', 'receipt/style.css'],
  ['/receipt/app.mjs', 'receipt/app.mjs'], ['/receipt/receipt.mjs', 'receipt/receipt.mjs'], ['/receipt/qrcode.mjs', 'receipt/qrcode.mjs'],
  ['/chords/tokens.css', 'chords/tokens.css'],
]);
createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  if (apis[url.pathname]) {
    const result = await apis[url.pathname](new Request(url));
    response.writeHead(result.status, { 'Content-Type': 'application/json' });
    response.end(await result.text());
    return;
  }
  const file = allowed.get(url.pathname);
  if (!file) { response.writeHead(404); response.end(); return; }
  try {
    const body = await readFile(new URL(`../${file}`, import.meta.url));
    response.writeHead(200, { 'Content-Type': types[file.slice(file.lastIndexOf('.'))], 'Cache-Control': 'no-store' }); response.end(body);
  } catch { response.writeHead(500); response.end(); }
}).listen(Number(process.env.PORT || 4390), '127.0.0.1', () => console.log('Receipt preview ready'));
