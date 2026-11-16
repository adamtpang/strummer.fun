import { CATALOG, searchSongs, sourceSearch } from './catalog.mjs';
const get = id => document.getElementById(id);
let selected = CATALOG[0], songbook = {};
try { const value = JSON.parse(localStorage.getItem('strummer.songbook.v1') || '{}'); if (value && typeof value === 'object' && !Array.isArray(value)) for (const song of CATALOG) if (['Want to learn','Learning','Can play'].includes(value[song.id])) songbook[song.id] = value[song.id]; } catch { get('status').textContent = 'Local saves unavailable.'; }
function link(text, url) { const anchor = document.createElement('a'); anchor.textContent = text; anchor.href = url; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; return anchor; }
function render() {
  const songs = searchSongs(get('query').value).filter(song => !get('saved-only').checked || songbook[song.id]);
  get('results').replaceChildren(); get('count').textContent = `${songs.length} catalog songs`; get('empty').hidden = songs.length > 0;
  songs.forEach(song => { const item = document.createElement('li'), button = document.createElement('button'), title = document.createElement('strong'), artist = document.createElement('span'); button.className = 'song'; button.setAttribute('aria-pressed',String(song.id === selected.id)); title.textContent = song.title; artist.textContent = `${song.artist} / ${song.collection}${songbook[song.id] ? ' / '+songbook[song.id] : ''}`; button.append(title,artist); button.onclick = () => { selected = song; render(); renderDetail(); }; item.append(button); get('results').append(item); });
  get('search-links').replaceChildren(); const query = get('query').value.trim() || `${selected.title} ${selected.artist}`;
  for (const [source,label] of [['guitar','Guitar chords'],['ukulele','Ukulele chords'],['video','Video lessons']]) get('search-links').append(link(label, sourceSearch(query,source)));
}
function renderDetail() {
  const root = get('detail'); root.replaceChildren();
  const title = document.createElement('h2'); title.textContent = selected.title;
  const artist = document.createElement('p'); artist.textContent = `${selected.artist} / ${selected.collection}`;
  const label = document.createElement('label'); label.textContent = 'Learning status'; const select = document.createElement('select');
  for (const text of ['Not saved','Want to learn','Learning','Can play']) select.add(new Option(text,text)); select.value = songbook[selected.id] || 'Not saved'; label.append(select);
  select.onchange = () => { if(select.value === 'Not saved') delete songbook[selected.id]; else songbook[selected.id] = select.value; try { localStorage.setItem('strummer.songbook.v1',JSON.stringify(songbook)); get('status').textContent='Songbook updated.'; } catch { get('status').textContent='Could not save on this browser.'; } render(); };
  const sources = document.createElement('div'); sources.className='links'; selected.sources.forEach(source => sources.append(link(source.name,source.url)));
  if(!selected.sources.length) sources.append(link('Find chord arrangements',sourceSearch(`${selected.title} ${selected.artist}`,'guitar')));
  const note = document.createElement('p'); note.textContent = selected.sources.length ? 'Community arrangements; voicings differ between versions. Chords below are a practice vocabulary, not a complete chart or timed transcription.' : 'Discovery entry. No arrangement has been checked or imported into Strummer yet.';
  root.append(title,artist,label,sources,note);
  if(selected.chords.length) {
    const heading = document.createElement('h3'); heading.textContent='Practice the chord vocabulary'; const vocabulary = document.createElement('div'); vocabulary.className='vocabulary';
    selected.chords.forEach(chord => { const params = new URLSearchParams({song:selected.title,artist:selected.artist,chords:chord,key:'G'}); const anchor = link(chord,`/tune?${params}`); anchor.removeAttribute('target'); vocabulary.append(anchor); });
    root.append(heading,vocabulary);
    const musicalNote = document.createElement('p'); musicalNote.textContent='Listen for the contrast between C major and C minor, and the pull from B7 into Em. Start with those changes slowly.'; root.append(musicalNote);
  }
}
get('query').oninput=render; get('saved-only').onchange=render; get('search-form').onsubmit=event=>{event.preventDefault();render();};
render();renderDetail();
