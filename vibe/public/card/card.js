// Nothing is requested from Spotify until the visitor presses play. The press
// swaps the button for Spotify's own embed, which handles playback and rights.
// Spotify's script API could start playback in the same press, but it needs
// 'unsafe-eval' and runs third-party code on this origin, so it is not used.
const root = document.documentElement;
if (new URLSearchParams(location.search).has('embed')) root.classList.add('embed');

const stage = document.getElementById('stage');

document.getElementById('play').addEventListener('click', () => {
  const frame = document.createElement('iframe');
  frame.src = `https://open.spotify.com/embed/playlist/${root.dataset.playlist}?theme=0`;
  frame.title = 'spotify player';
  frame.allow = 'autoplay; encrypted-media; clipboard-write; fullscreen; picture-in-picture';
  stage.classList.add('open');
  stage.replaceChildren(frame);
}, { once: true });
