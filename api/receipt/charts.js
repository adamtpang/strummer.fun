import { APPLE_CHART, parseChart } from '../_lib/shelves.js';

// GET /api/receipt/charts -> { albums: [{ id, name, artist, artwork }] }
// Apple's US Top Albums chart, refreshed by the CDN at most hourly.
export const config = { runtime: 'edge' };

const json = (body, status, cache) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache } });

export async function charts(fetchImpl) {
  try {
    const response = await fetchImpl(APPLE_CHART);
    if (!response.ok) throw new Error(`chart ${response.status}`);
    return json({ albums: parseChart(await response.json()).slice(0, 12) }, 200, 'public, s-maxage=3600, stale-while-revalidate=86400');
  } catch {
    return json({ error: 'chart unavailable' }, 502, 'no-store');
  }
}

export default function handler() {
  return charts(globalThis.fetch);
}
