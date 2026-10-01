// The card maker. A card is only a URL, so making one is: read the playlist id
// from a pasted link, ask Spotify's public oEmbed for the title, build the URL.
import { playlistId, cleanName, cardPath, embedCode, oembedUrl } from './lib.mjs';

const find = (id) => document.getElementById(id);
const status = (text) => { find('status').textContent = text; };
let id = null;

function links() {
  const name = cleanName(find('name').value) || 'playlist';
  find('share').value = location.origin + cardPath(id, name);
  find('embed').value = embedCode(id, name, location.origin);
  return name;
}

function preview() {
  find('preview').src = cardPath(id, links(), { embed: true });
}

// Spotify answers a missing or private playlist with an error that carries no
// CORS header, so the lookup throws. Either way there is no card to make.
async function title(playlist) {
  try {
    const response = await fetch(oembedUrl(playlist));
    return response.ok ? cleanName((await response.json()).title) : null;
  } catch {
    return null;
  }
}

find('form').addEventListener('submit', async (event) => {
  event.preventDefault();
  find('out').hidden = true;
  id = playlistId(find('link').value);
  if (!id) return status('that does not look like a spotify playlist link.');
  status('finding your playlist...');
  const name = await title(id);
  if (!name) return status('spotify could not find that playlist. check the link, and that the playlist is public.');
  status('');
  find('name').value = name;
  find('out').hidden = false;
  preview();
});

find('name').addEventListener('input', links);
find('name').addEventListener('change', preview);

for (const button of document.querySelectorAll('[data-copy]')) {
  button.addEventListener('click', async () => {
    const field = find(button.dataset.copy);
    try {
      await navigator.clipboard.writeText(field.value);
      button.textContent = 'copied';
    } catch {
      field.select();
      button.textContent = 'select and copy';
    }
    setTimeout(() => { button.textContent = 'copy'; }, 1500);
  });
}
