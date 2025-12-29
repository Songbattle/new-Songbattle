const api = (p)=>fetch(p,{credentials:'include'}).then(async r=>{try{return await r.json()}catch(e){return {}}}).catch(e=>({error:e.message}));

document.getElementById('loginBtn').addEventListener('click',()=>{
  window.location.href = '/api/login';
});
document.getElementById('whoBtn').addEventListener('click', async ()=>{ loadMe() });

document.getElementById('logoutBtn').addEventListener('click', ()=>{
  // clear cookie set by server and localStorage, then reload
  document.cookie = 'access_token=; Path=/; Max-Age=0';
  localStorage.removeItem('pairs');
  localStorage.removeItem('scores');
  localStorage.removeItem('pairsIndex');
  loadMe();
  window.location.href = '/';
});

async function loadMe(){
  const me = await api('/api/me');
  const meEl = document.getElementById('me');
  const avatar = document.getElementById('meAvatar');
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  if(me && me.display_name){
    // remove textual name; show avatar with tooltip
    meEl.innerText = '';
    if(me.images && me.images[0] && me.images[0].url){
      avatar.src = me.images[0].url;
      avatar.title = me.display_name || '';
      avatar.style.display = 'inline-block';
    } else {
      avatar.style.display = 'none';
    }
    // hide login, show logout
    if(loginBtn) loginBtn.style.display = 'none';
    if(logoutBtn) logoutBtn.style.display = 'inline-block';
  } else {
    meEl.innerText = 'Nicht angemeldet';
    if(avatar) avatar.style.display = 'none';
    if(loginBtn) loginBtn.style.display = 'inline-block';
    if(logoutBtn) logoutBtn.style.display = 'none';
  }
  return me;
}

const PAGE_LIMIT = 10;
let lastQuery = '';
let lastPage = 0;
let lastOffset = 0;
let lastTotal = 0;
let removedSearchHTML = null;

document.getElementById('searchBtn').addEventListener('click', async ()=>{
  const q = document.getElementById('searchInput').value.trim();
  if(!q) return alert('Bitte Suchbegriff eingeben');
  // clear suggestions preview when user starts an explicit search
  suggestionsEl.innerHTML = '';
  suggestionsEl.setAttribute('aria-hidden','true');
  lastQuery = q; lastPage = 0; lastOffset = 0;
  await fetchSearch(q, lastPage);
});

// --- Autocomplete / Vorschläge während der Eingabe ---
const searchInputEl = document.getElementById('searchInput');
const suggestionsEl = document.getElementById('suggestions');
function debounce(fn, wait){ let t; return (...args)=>{ clearTimeout(t); t = setTimeout(()=>fn(...args), wait); }; }

async function renderSuggestions(q){
  if(!q){ suggestionsEl.innerHTML = ''; suggestionsEl.setAttribute('aria-hidden','true'); return }
  const res = await api(`/api/search?album=${encodeURIComponent(q)}&offset=0&limit=5`);
  const items = (res.albums?.items || []).filter(it => !(it && (it.total_tracks === 1 || it.total_tracks == '1')));
  if(!items || items.length === 0){ suggestionsEl.innerHTML = '<div class="empty">Keine Vorschläge</div>'; suggestionsEl.setAttribute('aria-hidden','false'); return }
  suggestionsEl.innerHTML = items.map(a=>{
    const img = a.images?.[0]?.url || `https://picsum.photos/seed/${a.id}/48`;
    const artists = a.artists?.map(x=>x.name).join(', ');
    // include data attrs for id and name; Open button will trigger direct album open
    return `<div class="suggestion" data-id="${a.id}" data-name="${escapeHtml(a.name)}"><img src="${img}" alt="cover"><div class="meta"><strong>${escapeHtml(a.name)}</strong><div class="muted">${escapeHtml(artists||'')}</div></div><div><button class="openBtn ghost">Öffnen</button></div></div>`;
  }).join('');
  suggestionsEl.setAttribute('aria-hidden','false');
  // attach handlers: click on suggestion fills input (no auto-search), open button opens album
  suggestionsEl.querySelectorAll('.suggestion').forEach(el=>{
    const openBtn = el.querySelector('.openBtn');
    el.addEventListener('click', (ev)=>{
      // ignore clicks on the open button itself
      if(ev.target.closest('.openBtn')) return;
      const name = el.getAttribute('data-name') || '';
      searchInputEl.value = name;
      lastQuery = name;
      suggestionsEl.innerHTML = '';
      suggestionsEl.setAttribute('aria-hidden','true');
      // do not auto-run search to avoid confusion — user can press Enter or click Search
    });
    openBtn?.addEventListener('click', (ev)=>{
      ev.stopPropagation();
      const id = el.getAttribute('data-id');
      const name = el.getAttribute('data-name') || '';
      const img = el.querySelector('img')?.src;
      // call selectAlbum with minimal album object
      selectAlbum({id, name, images: [{url: img}]});
      suggestionsEl.innerHTML = '';
      suggestionsEl.setAttribute('aria-hidden','true');
    });
  });
}

searchInputEl.addEventListener('input', debounce((e)=>{
  const q = e.target.value.trim();
  if(!q){ suggestionsEl.innerHTML = ''; suggestionsEl.setAttribute('aria-hidden','true'); return }
  renderSuggestions(q);
}, 320));

// bind Enter to trigger search and clear suggestions
searchInputEl.addEventListener('keydown', (e)=>{
  if(e.key === 'Enter'){
    e.preventDefault();
    document.getElementById('searchBtn').click();
  }
});

// hide suggestions on outside click
document.addEventListener('click', (ev)=>{
  const box = document.getElementById('searchBox');
  if(box && !box.contains(ev.target) && !suggestionsEl.contains(ev.target)){
    suggestionsEl.innerHTML = '';
    suggestionsEl.setAttribute('aria-hidden','true');
  }
});

function escapeHtml(s){ return String(s).replace(/[&<>\"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"})[c]||c); }

let lastNext = null;
let lastPrev = null;

async function fetchSearch(q, pageOrUrl){
  let url;
  if(typeof pageOrUrl === 'string' && pageOrUrl){
    // pageOrUrl is a relative or absolute URL returned by API
    if(pageOrUrl.startsWith('http')){
      // proxy absolute Spotify URLs via backend to include server-side auth
      url = `/api/search?next=${encodeURIComponent(pageOrUrl)}`;
    } else {
      url = pageOrUrl;
    }
  } else {
    const page = pageOrUrl || 0;
    const offset = page * PAGE_LIMIT;
    url = `/api/search?album=${encodeURIComponent(q)}&offset=${offset}&limit=${PAGE_LIMIT}`;
  }
  const searchBtn = document.getElementById('searchBtn');
  if(searchBtn) searchBtn.disabled = true;
  let res;
  try {
    res = await api(url);
  } finally {
    if(searchBtn) searchBtn.disabled = false;
  }
  const items = (res.albums?.items || []).filter(it => !(it && (it.total_tracks === 1 || it.total_tracks == '1')));
  lastTotal = res.albums?.total || items.length;
  lastOffset = res.albums?.offset || lastOffset;
  // save next/previous links if provided
  lastNext = res.albums?.next || null;
  lastPrev = res.albums?.previous || null;
  if(typeof pageOrUrl === 'number') lastPage = pageOrUrl;
  const container = document.getElementById('searchResults');
  container.innerHTML = '';
  items.forEach(a=>{
    const div = document.createElement('div');
    div.className='album';
    const img = a.images?.[0]?.url || `https://picsum.photos/seed/${a.id}/80`;
    div.innerHTML = `<div style="display:flex;align-items:center"><img class="cover" src="${img}" alt="cover"><div class="meta"><strong>${a.name}</strong><div class="muted">${a.artists?.map(x=>x.name).join(', ')}</div></div></div><div><button data-id="${a.id}" class="ghost">Auswählen</button></div>`;
    const btn = div.querySelector('button');
    btn.addEventListener('click',()=>selectAlbum(a));
    container.appendChild(div);
  });
  renderPagination();
}

function renderPagination(){
  const pag = document.getElementById('pagination');
  pag.innerHTML = '';
  const prev = document.createElement('button'); prev.className='ghost'; prev.innerText='Zurück'; prev.disabled = (lastPage <= 0 || lastTotal <= 0);
  const next = document.createElement('button'); next.className='ghost'; next.innerText='Weiter'; next.disabled = (lastTotal <= 0 || (lastPage+1)*PAGE_LIMIT >= lastTotal);
  const info = document.createElement('div'); info.style.color='var(--muted)';
  if(lastTotal <= 0){
    info.innerText = `0 von 0`;
  } else {
    const from = Math.min(lastOffset+1, lastTotal);
    const to = Math.min(lastOffset+PAGE_LIMIT, lastTotal);
    info.innerText = `${from}–${to} von ${lastTotal}`;
  }
  prev.addEventListener('click', async ()=>{ 
    if(lastPrev) { 
      await fetchSearch(lastQuery, lastPrev);
    } else {
      lastPage = Math.max(0, lastPage-1);
      await fetchSearch(lastQuery, lastPage);
    }
  });
  next.addEventListener('click', async ()=>{ 
    if(lastNext) { 
      await fetchSearch(lastQuery, lastNext);
    } else {
      lastPage = Math.min(Math.max(0, Math.ceil(lastTotal/PAGE_LIMIT)-1), lastPage+1);
      await fetchSearch(lastQuery, lastPage);
    }
  });
  pag.appendChild(prev); pag.appendChild(info); pag.appendChild(next);
}

// load user on startup to reflect login state after redirect
window.addEventListener('load', ()=>{
  loadMe();
});

let currentAlbum = null;
let tracks = [];
let removedAlbums = [];

async function selectAlbum(a){
  currentAlbum = a;
  // remove all albums from search results and keep HTML for restore
  const sr = document.getElementById('searchResults');
  if(!removedSearchHTML) removedSearchHTML = sr.innerHTML;
  sr.innerHTML = '';
  // switch to album 'page' mode (hide aside, expand)
  document.body.classList.add('album-mode');
  history.pushState({albumId:a.id}, '', `#album-${a.id}`);
  document.getElementById('albumSection').innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:0">${a.name}</h2><div><button id="backAlbum" class="ghost">Zurück zur Suche</button></div></div><div id="tracks"></div>`;
  document.getElementById('backAlbum').addEventListener('click', ()=>{
    restoreFromAlbum(a.id);
  });
  const res = await api(`/api/albums/${a.id}/tracks`);
  tracks = res.items || [];
  const tdiv = document.getElementById('tracks');
  tdiv.className='card tracks';
  // show only a summary and a button to reveal the full tracklist
  tdiv.innerHTML = `<div>${tracks.length} Tracks</div><div style="margin-top:8px"><button id="showTracks" class="ghost">Tracks anzeigen</button></div><div id="fullTracks" style="margin-top:8px;display:none"></div>`;
  document.getElementById('showTracks').addEventListener('click', (ev)=>{
    const full = document.getElementById('fullTracks');
    if(full.style.display === 'none'){
      full.style.display = 'block';
      full.innerHTML = tracks.map(t=>`<div class="track">${t.name}</div>`).join('');
      ev.target.innerText = 'Tracks verbergen';
    } else {
      full.style.display = 'none';
      ev.target.innerText = 'Tracks anzeigen';
    }
  });
  // prepare voting (hidden/available regardless of showing tracklist)
  startVoting();
}

function startVoting(){
  if(tracks.length<2){ document.getElementById('votingSection').innerText='Nicht genug Tracks.'; return }
  // generate unique pairs (simple round-robin)
  const pairs = [];
  for(let i=0;i<tracks.length;i++)for(let j=i+1;j<tracks.length;j++)pairs.push([tracks[i],tracks[j]]);
  // shuffle
  for(let i=pairs.length-1;i>0;i--){const k=Math.floor(Math.random()*(i+1));[pairs[i],pairs[k]]=[pairs[k],pairs[i]]}
  localStorage.setItem('pairs', JSON.stringify(pairs.map(p=>[p[0].id,p[1].id])));
  localStorage.setItem('scores', JSON.stringify({}));
  localStorage.setItem('pairsIndex', '0');
  renderNextPair();
}

function renderNextPair(){
  const pJSON = localStorage.getItem('pairs');
  if(!pJSON) return;
  const pairs = JSON.parse(pJSON);
  let idx = parseInt(localStorage.getItem('pairsIndex')||'0',10);
  if(idx>=pairs.length){ showResults(); return }
  const [aId,bId] = pairs[idx];
  const a = tracks.find(t=>t.id===aId)||{id:aId,name:aId};
  const b = tracks.find(t=>t.id===bId)||{id:bId,name:bId};
  const out = document.getElementById('votingSection');
  const bothLabel = `Mag beide`;
  const noneLabel = `Keine Ahnung`;
  out.innerHTML = `
    <div class="voting">
      <div class="vote-card"><h3>${a.name}</h3><div style="margin-top:10px"><button id="voteA">Wähle links</button></div></div>
      <div class="center-controls"><button id="voteBoth" class="ghost">${bothLabel}</button><button id="voteNone" class="ghost">${noneLabel}</button></div>
      <div class="vote-card"><h3>${b.name}</h3><div style="margin-top:10px"><button id="voteB">Wähle rechts</button></div></div>
    </div>
    <div id="progress" class="progress"></div>`;
  document.getElementById('voteA').addEventListener('click',()=>recordVote(a.id));
  document.getElementById('voteB').addEventListener('click',()=>recordVote(b.id));
  document.getElementById('voteBoth').addEventListener('click',()=>recordVote([a.id,b.id]));
  document.getElementById('voteNone').addEventListener('click',()=>recordVote(null));
  document.getElementById('progress').innerText = `Paar ${idx+1}/${pairs.length}`;
}

function recordVote(winnerId){
  const scores = JSON.parse(localStorage.getItem('scores')||'{}');
  if(Array.isArray(winnerId)){
    // both liked: add one point to each
    winnerId.forEach(id=>{ scores[id] = (scores[id]||0) + 1 });
  } else if(typeof winnerId === 'string'){
    scores[winnerId] = (scores[winnerId]||0) + 1;
  } else {
    // null -> no opinion: do not change scores
  }
  localStorage.setItem('scores', JSON.stringify(scores));
  let idx = parseInt(localStorage.getItem('pairsIndex')||'0',10);
  idx++; localStorage.setItem('pairsIndex', String(idx));
  renderNextPair();
}

function showResults(){
  const scores = JSON.parse(localStorage.getItem('scores')||'{}');
  const ranked = Object.entries(scores).sort((a,b)=>b[1]-a[1]);
  const out = document.getElementById('votingSection');
  out.innerHTML = '<div class="card results"><h3>Ergebnisse</h3>' + ranked.map(([id,sc],i)=>{const t=tracks.find(tt=>tt.id===id);return `<div>${i+1}. ${t? t.name : id} — ${sc} Punkte</div>`}).join('') + '</div><div style="margin-top:8px"><button id="export">Export JSON</button></div>';
  document.getElementById('export').addEventListener('click',()=>{
    const blob = new Blob([JSON.stringify({tracks, scores},null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'spotify-battle-results.json'; a.click();
  });
}

// export from tips panel
document.getElementById('exportAll')?.addEventListener('click', ()=>{
  const scores = JSON.parse(localStorage.getItem('scores')||'{}');
  const blob = new Blob([JSON.stringify({tracks, scores},null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'spotify-battle-results.json'; a.click();
});

function restoreFromAlbum(albumId){
  // restore full search results HTML if we removed them
  if(removedSearchHTML){
    const container = document.getElementById('searchResults');
    container.innerHTML = removedSearchHTML;
    removedSearchHTML = null;
    // reattach select handlers
    container.querySelectorAll('button[data-id]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const id = btn.getAttribute('data-id');
        const albumEl = btn.closest('.album');
        // rebuild minimal album object for selectAlbum (name from DOM)
        const name = albumEl.querySelector('strong')?.innerText || id;
        selectAlbum({id, name, images: [{url: albumEl.querySelector('img')?.src}]});
      });
    });
  }
  document.getElementById('albumSection').innerHTML = '';
  document.getElementById('votingSection').innerHTML = '';
  document.body.classList.remove('album-mode');
  // go back in history if needed
  if(location.hash === `#album-${albumId}`) history.replaceState({}, '', '/');
}

window.addEventListener('popstate', (ev)=>{
  // handle browser back/forward
  if(ev.state && ev.state.albumId){
    // if state has album, ensure album view shown (no-op here)
  } else {
    // restore view
    // try to restore last album if any
    const m = location.hash.match(/^#album-(.+)$/);
    if(!m) {
      // clear album view
      document.getElementById('albumSection').innerHTML = '';
      document.getElementById('votingSection').innerHTML = '';
      document.body.classList.remove('album-mode');
    }
  }
});
