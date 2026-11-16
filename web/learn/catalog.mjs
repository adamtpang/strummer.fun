export const CATALOG = [
  { id:'everything-stays', title:'Everything Stays', artist:'Rebecca Sugar', collection:'Adventure Time', chords:['G','Cmaj7','B7','Em','D','Am7','G7','Cm'], sources:[{name:'Cifra Club arrangement',url:'https://www.cifraclub.com/adventure-time/everything-stays/'},{name:'Ukulele Tabs arrangement',url:'https://www.ukulele-tabs.com/uke-songs/rebecca-sugar/everything-stays-uke-tab-47277.html'}] },
  ...[
    ['remember-you','Remember You','Rebecca Sugar','Adventure Time'],
    ['time-adventure','Time Adventure','Rebecca Sugar','Adventure Time'],
    ['slow-dance','Slow Dance with You','Adventure Time','Adventure Time'],
    ['love-like-you','Love Like You','Rebecca Sugar','Steven Universe'],
    ['escapism','Escapism','Steven Universe','Steven Universe'],
    ['drift-away','Drift Away','Steven Universe','Steven Universe'],
    ['something','Something','The Beatles','The Beatles'],
    ['in-my-life','In My Life','The Beatles','The Beatles'],
    ['blackbird','Blackbird','The Beatles','The Beatles'],
    ['here-there','Here, There and Everywhere','The Beatles','The Beatles'],
    ['coffee','Coffee','beabadoobee','Indie'],
    ['misterio','Misterio do Planeta','Novos Baianos','Brazilian'],
    ['cry-cry-cry','Cry Cry Cry','King Princess','Indie'],
    ['hardest-part','The Hardest Part','Olivia Dean','Soul'],
    ['dream-a-little','Dream a Little Dream of Me','The Mamas & the Papas','Standards'],
  ].map(([id,title,artist,collection])=>({id,title,artist,collection,sources:[],chords:[]})),
];
export function searchSongs(query) {
  const words = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').split(/\s+/).filter(Boolean);
  return CATALOG.filter(song => words.every(word => `${song.title} ${song.artist} ${song.collection}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(word)));
}
export function sourceSearch(query, source) {
  const domains = { guitar:'tabs.ultimate-guitar.com', ukulele:'ukutabs.com', video:'youtube.com' };
  if (!domains[source]) throw new Error('Unknown source');
  return `https://www.google.com/search?q=${encodeURIComponent(`site:${domains[source]} ${query} ${source === 'video' ? 'guitar lesson' : 'chords'}`)}`;
}
