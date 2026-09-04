import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const vercelConfig = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));

function stripMarkup(value) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[^;]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function readAttribute(attributes, name) {
  return attributes.match(new RegExp(`\\b${name}=["']([^"']+)["']`, 'i'))?.[1] || '';
}

test('root metadata and structured identity are complete', () => {
  const title = indexHtml.match(/<title>([^<]+)<\/title>/i)?.[1] || '';
  const description = indexHtml.match(/<meta\s+name="description"\s+content="([^"]+)"/i)?.[1] || '';
  const canonical = indexHtml.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i)?.[1] || '';
  const jsonLdText = indexHtml.match(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/i)?.[1] || '';
  const jsonLd = JSON.parse(jsonLdText);
  const types = jsonLd['@graph'].map((node) => node['@type']);

  assert.ok(title.length >= 20 && title.length <= 65);
  assert.ok(description.length >= 70 && description.length <= 170);
  assert.equal(canonical, 'https://strummer.fun/');
  assert.ok(types.includes('WebSite'));
  assert.ok(types.includes('Organization'));
});

test('root initial HTML is substantive and has a valid heading outline', () => {
  const body = indexHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || '';
  const text = stripMarkup(body);
  const words = text.split(/\s+/).filter(Boolean);
  const headings = [...body.matchAll(/<h([1-6])\b[^>]*>/gi)].map((match) => Number(match[1]));

  assert.equal((body.match(/<h1\b/gi) || []).length, 1);
  assert.ok(text.length >= 700, `expected at least 700 text characters, found ${text.length}`);
  assert.ok(words.length >= 250, `expected at least 250 words, found ${words.length}`);
  for (let index = 1; index < headings.length; index += 1) {
    assert.ok(headings[index] - headings[index - 1] <= 1, `heading level jumps from h${headings[index - 1]} to h${headings[index]}`);
  }
});

test('root paragraphs are self-contained and include measurable facts', () => {
  const paragraphs = [...indexHtml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((match) => stripMarkup(match[1]));
  const chunkable = paragraphs.filter((paragraph) => {
    const wordCount = paragraph.split(/\s+/).filter(Boolean).length;
    return wordCount >= 25 && wordCount <= 120 && !/^(it|this|that|these|they|he|she|we|you)\b/i.test(paragraph);
  });
  const sentences = stripMarkup(indexHtml).split(/(?<=[.!?])\s+/).filter((sentence) => sentence.length > 20);
  const citable = sentences.filter((sentence) => /\d|[$%]/.test(sentence));

  assert.ok(chunkable.length / paragraphs.length >= 0.35);
  assert.ok(citable.length / sentences.length >= 0.1);
});

test('every initial control and link has a programmatic name', () => {
  for (const match of indexHtml.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
    const name = readAttribute(match[1], 'aria-label') || readAttribute(match[1], 'title') || stripMarkup(match[2]);
    assert.ok(name, `unnamed button: ${match[0].slice(0, 100)}`);
  }
  for (const match of indexHtml.matchAll(/<input\b([^>]*)>/gi)) {
    const id = readAttribute(match[1], 'id');
    const hasLabel = id && new RegExp(`<label\\b[^>]*for=["']${id}["']`, 'i').test(indexHtml);
    assert.ok(readAttribute(match[1], 'aria-label') || readAttribute(match[1], 'title') || hasLabel, `unnamed input: ${match[0]}`);
  }
  for (const match of indexHtml.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const name = readAttribute(match[1], 'aria-label') || readAttribute(match[1], 'title') || stripMarkup(match[2]);
    assert.ok(name, `unnamed link: ${match[0].slice(0, 100)}`);
  }
});

test('discovery and trust files publish the canonical public paths', async () => {
  const [robots, llms, sitemap, about, contact, privacy] = await Promise.all([
    readFile(new URL('../robots.txt', import.meta.url), 'utf8'),
    readFile(new URL('../llms.txt', import.meta.url), 'utf8'),
    readFile(new URL('../sitemap.xml', import.meta.url), 'utf8'),
    readFile(new URL('../about.html', import.meta.url), 'utf8'),
    readFile(new URL('../contact.html', import.meta.url), 'utf8'),
    readFile(new URL('../privacy.html', import.meta.url), 'utf8')
  ]);

  assert.match(robots, /User-agent: GPTBot[\s\S]*Allow: \//);
  assert.match(robots, /Sitemap: https:\/\/strummer\.fun\/sitemap\.xml/);
  assert.ok(llms.trim().length > 20);
  for (const path of ['/', '/about', '/contact', '/privacy', '/vibe', '/tune']) {
    assert.match(sitemap, new RegExp(`<loc>https://strummer\\.fun${path === '/' ? '/' : path}<\\/loc>`));
  }
  assert.match(about, /Adam Pang/);
  assert.match(contact, /Strummer is operated by Adam Pang/);
  assert.match(privacy, /Audius/);
});

test('production headers enforce the required browser protections', () => {
  const headers = Object.fromEntries(vercelConfig.headers[0].headers.map((header) => [header.key.toLowerCase(), header.value]));
  const csp = headers['content-security-policy'];

  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.ok(!csp.split(/\s+/).includes('*'), 'CSP must not contain a bare wildcard source');
  assert.equal(headers['x-content-type-options'], 'nosniff');
  assert.match(headers['strict-transport-security'], /max-age=/);
});
