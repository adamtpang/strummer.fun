// Pure helpers shared by the card and the card maker. A card is fully described
// by its URL (playlist id and title), so there is no login and nothing stored.
export const ORIGIN = 'https://strummer.fun';
export const NAME_MAX = 60;
export const EMBED_HEIGHT = 200;

const ID = /^[A-Za-z0-9]{22}$/;

// Accepts a share link, a spotify: URI, or a bare id.
export function playlistId(input) {
  const text = String(input ?? '').trim();
  if (ID.test(text)) return text;
  const match = text.match(/(?:open\.spotify\.com\/(?:intl-[a-z-]+\/)?(?:embed\/)?playlist\/|spotify:playlist:)([A-Za-z0-9]{22})(?![A-Za-z0-9])/);
  return match ? match[1] : null;
}

export function cleanName(name) {
  return String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
}

export function cardPath(id, name, { embed = false } = {}) {
  const params = new URLSearchParams({ id, name: cleanName(name) });
  if (embed) params.set('embed', '1');
  return `/vibe/card/p?${params}`;
}

export function readCard(search) {
  const params = new URLSearchParams(search);
  const id = params.get('id') ?? '';
  const name = cleanName(params.get('name'));
  return ID.test(id) && name ? { id, name } : null;
}

function attribute(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export function embedCode(id, name, origin = ORIGIN) {
  const src = attribute(origin + cardPath(id, name, { embed: true }));
  const title = attribute(`${cleanName(name)}, a playlist`);
  return `<iframe src="${src}" title="${title}" width="100%" height="${EMBED_HEIGHT}" style="border:0;max-width:420px" loading="lazy" allow="autoplay; encrypted-media"></iframe>`;
}

export function oembedUrl(id) {
  return `https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/playlist/${id}`)}`;
}
