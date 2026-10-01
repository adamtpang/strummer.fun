// Local-only preview of the playlist card, never deployed. It applies the
// card's real response headers from vercel.json so the CSP is tested as shipped.
// / is a stand-in for a host page (near-black, white text) that frames the card.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (path) => fileURLToPath(new URL(path, import.meta.url));
const rule = JSON.parse(readFileSync(here('../vercel.json'), 'utf8')).headers.find((entry) => entry.source === '/vibe/card/(.*)');
const FILES = {
  '/vibe/card/adam': ['public/card/adam.html', 'text/html'],
  '/vibe/card/card.css': ['public/card/card.css', 'text/css'],
  '/vibe/card/p': ['public/card/p.html', 'text/html'],
  '/vibe/card/make': ['public/card/make.html', 'text/html'],
  '/vibe/card/card.js': ['public/card/card.js', 'text/javascript'],
  '/vibe/card/make.js': ['public/card/make.js', 'text/javascript'],
  '/vibe/card/lib.mjs': ['public/card/lib.mjs', 'text/javascript'],
};
const HOST = `<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><title>host page</title>
<body style="margin:0;padding:24px;background:#0a0a0a;color:#fff;font:16px system-ui"><p>what i listen to, <a href="#" style="color:#60a5fa">all of it</a></p>
<iframe src="/vibe/card/adam?embed=1" title="ult, a playlist" width="100%" height="200" style="border:0;max-width:420px" loading="lazy" allow="autoplay; encrypted-media"></iframe></body>`;

createServer((req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  if (path === '/') return res.writeHead(200, { 'content-type': 'text/html' }).end(HOST);
  const file = FILES[path];
  if (!file) return res.writeHead(404).end('not found');
  const headers = { 'content-type': `${file[1]}; charset=utf-8`, 'cache-control': 'no-store' };
  for (const { key, value } of rule.headers) {
    if (key !== 'Strict-Transport-Security') headers[key] = value.replace('; upgrade-insecure-requests', '');
  }
  res.writeHead(200, headers).end(readFileSync(here(file[0])));
}).listen(4391, '127.0.0.1', () => console.log('card preview on http://127.0.0.1:4391'));
