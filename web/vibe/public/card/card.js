// Nothing is requested from Spotify until the visitor presses play. The press
// swaps the button for Spotify's own embed, which handles playback and rights.
// Spotify's script API could start playback in the same press, but it needs
// 'unsafe-eval' and runs third-party code on this origin, so it is not used.
import { readCard } from './lib.mjs';

const root = document.documentElement;
if (new URLSearchParams(location.search).has('embed')) root.classList.add('embed');

const stage = document.getElementById('stage');
const button = document.getElementById('play');

// adam.html carries its playlist in the markup. p.html reads it from the URL.
let playlist = root.dataset.playlist;
if (!playlist) {
  const card = readCard(location.search);
  if (card) {
    playlist = card.id;
    document.getElementById('title').textContent = card.name;
    document.title = `${card.name}, a playlist`;
    button.setAttribute('aria-label', `play ${card.name}`);
  } else {
    const note = document.createElement('p');
    note.className = 'broken';
    note.textContent = 'this card link is not valid.';
    stage.replaceChildren(note);
  }
}

if (playlist) {
  button.addEventListener('click', () => {
    const frame = document.createElement('iframe');
    frame.src = `https://open.spotify.com/embed/playlist/${playlist}?theme=0`;
    frame.title = 'spotify player';
    frame.allow = 'autoplay; encrypted-media; clipboard-write; fullscreen; picture-in-picture';
    stage.classList.add('open');
    stage.replaceChildren(frame);
  }, { once: true });
}
