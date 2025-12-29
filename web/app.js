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
let shareUrl = '';
let lastExportBlob = null;
let lastExportUrl = null;
let lastUploadedUrl = null;

document.getElementById('searchBtn').addEventListener('click', async ()=>{
  const q = document.getElementById('searchInput').value.trim();
  if(!q) return alert('Please enter a search term');
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
  if(!items || items.length === 0){ suggestionsEl.innerHTML = '<div class="empty">No suggestions</div>'; suggestionsEl.setAttribute('aria-hidden','false'); return }
  suggestionsEl.innerHTML = items.map(a=>{
    const img = a.images?.[0]?.url || `https://picsum.photos/seed/${a.id}/48`;
    const artists = a.artists?.map(x=>x.name).join(', ');
    // include data attrs for id and name; Open button will trigger direct album open
    return `<div class="suggestion" data-id="${a.id}" data-name="${escapeHtml(a.name)}"><img src="${img}" alt="cover"><div class="meta"><strong>${escapeHtml(a.name)}</strong><div class="muted">${escapeHtml(artists||'')}</div></div><div><button class="openBtn ghost">Open</button></div></div>`;
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

// Playlist search elements
const playlistInputEl = document.getElementById('playlistSearchInput');
const playlistSuggestionsEl = document.getElementById('playlistSuggestions');
const playlistResultsEl = document.getElementById('playlistResults');
let lastPlaylistQuery = '';
let lastPlaylistPage = 0;
let lastPlaylistOffset = 0;
let lastPlaylistTotal = 0;

playlistInputEl?.addEventListener('input', debounce((e)=>{
  const q = e.target.value.trim();
  if(!q){ playlistSuggestionsEl.innerHTML = ''; playlistSuggestionsEl.setAttribute('aria-hidden','true'); return }
  renderPlaylistSuggestions(q);
}, 320));

document.getElementById('playlistSearchBtn')?.addEventListener('click', async ()=>{
  const q = playlistInputEl.value.trim();
  if(!q) return alert('Please enter a search term');
  playlistSuggestionsEl.innerHTML = '';
  playlistSuggestionsEl.setAttribute('aria-hidden','true');
  lastPlaylistQuery = q; lastPlaylistPage = 0; lastPlaylistOffset = 0;
  await fetchPlaylistSearch(q, lastPlaylistPage);
});

async function renderPlaylistSuggestions(q){
  const res = await api(`/api/search?playlist=${encodeURIComponent(q)}&offset=0&limit=5`);
  const coll = (res.playlists || res.albums || {});
  const items = (coll.items || []).slice(0,5);
  if(!items || items.length === 0){ playlistSuggestionsEl.innerHTML = '<div class="empty">No suggestions</div>'; playlistSuggestionsEl.setAttribute('aria-hidden','false'); return }
  playlistSuggestionsEl.innerHTML = items.map(a=>{
    const img = a.images?.[0]?.url || `https://picsum.photos/seed/${a.id}/48`;
    const owner = (a.owner && a.owner.display_name) || '';
    return `<div class="suggestion" data-id="${a.id}" data-name="${escapeHtml(a.name)}"><img src="${img}" alt="cover"><div class="meta"><strong>${escapeHtml(a.name)}</strong><div class="muted">${escapeHtml(owner||'')}</div></div><div><button class="openBtn ghost">Open</button></div></div>`;
  }).join('');
  playlistSuggestionsEl.setAttribute('aria-hidden','false');
  playlistSuggestionsEl.querySelectorAll('.suggestion').forEach(el=>{
    const openBtn = el.querySelector('.openBtn');
    el.addEventListener('click', (ev)=>{
      if(ev.target.closest('.openBtn')) return;
      const name = el.getAttribute('data-name') || '';
      playlistInputEl.value = name;
      playlistSuggestionsEl.innerHTML = '';
      playlistSuggestionsEl.setAttribute('aria-hidden','true');
    });
    openBtn?.addEventListener('click',(ev)=>{ev.stopPropagation(); const id=el.getAttribute('data-id'); const name=el.getAttribute('data-name')||''; const img=el.querySelector('img')?.src; selectAlbum({id, name, images:[{url:img}], type:'playlist'}); playlistSuggestionsEl.innerHTML=''; playlistSuggestionsEl.setAttribute('aria-hidden','true');});
  });
}

async function fetchPlaylistSearch(q, pageOrUrl){
  let url;
  if(typeof pageOrUrl === 'string' && pageOrUrl){
    if(pageOrUrl.startsWith('http')){ url = `/api/search?next=${encodeURIComponent(pageOrUrl)}`; } else { url = pageOrUrl }
  } else {
    const page = pageOrUrl || 0; const offset = page * PAGE_LIMIT; url = `/api/search?playlist=${encodeURIComponent(q)}&offset=${offset}&limit=${PAGE_LIMIT}`;
  }
  const btn = document.getElementById('playlistSearchBtn'); if(btn) btn.disabled = true;
  let res; try{ res = await api(url); } finally { if(btn) btn.disabled = false }
  const coll = (res.playlists || res.albums || {});
  const items = (coll.items || []);
  lastPlaylistTotal = coll.total || items.length; lastPlaylistOffset = coll.offset || lastPlaylistOffset; const container = playlistResultsEl; container.innerHTML = '';
  items.forEach(a=>{
    const div=document.createElement('div'); div.className='album'; const img=a.images?.[0]?.url||`https://picsum.photos/seed/${a.id}/80`;
    div.innerHTML = `<div style="display:flex;align-items:center"><img class="cover" src="${img}" alt="cover"><div class="meta"><strong>${a.name}</strong><div class="muted">${(a.owner&&a.owner.display_name)||''}</div></div></div><div><button data-id="${a.id}" class="ghost">Select</button></div>`;
    const btn = div.querySelector('button'); btn.addEventListener('click', ()=>selectAlbum({...a, type:'playlist'})); container.appendChild(div);
  });
  // simple playlist pagination
  const pag = document.getElementById('playlistPagination'); pag.innerHTML=''; const prev=document.createElement('button'); prev.className='ghost'; prev.innerText='Previous'; const next=document.createElement('button'); next.className='ghost'; next.innerText='Next'; const info=document.createElement('div'); info.style.color='var(--muted)'; if(lastPlaylistTotal<=0){ info.innerText='0 of 0' } else { const from=Math.min(lastPlaylistOffset+1,lastPlaylistTotal); const to=Math.min(lastPlaylistOffset+PAGE_LIMIT,lastPlaylistTotal); info.innerText=`${from}–${to} of ${lastPlaylistTotal}` }
  prev.disabled = (lastPlaylistOffset<=0); next.disabled = (lastPlaylistOffset+PAGE_LIMIT >= lastPlaylistTotal);
  prev.addEventListener('click', async ()=>{ if(coll.previous){ await fetchPlaylistSearch(q, coll.previous) } else { lastPlaylistPage = Math.max(0, lastPlaylistPage-1); await fetchPlaylistSearch(q,lastPlaylistPage) }});
  next.addEventListener('click', async ()=>{ if(coll.next){ await fetchPlaylistSearch(q, coll.next) } else { lastPlaylistPage = Math.min(Math.max(0, Math.ceil(lastPlaylistTotal/PAGE_LIMIT)-1), lastPlaylistPage+1); await fetchPlaylistSearch(q,lastPlaylistPage) }});
  pag.appendChild(prev); pag.appendChild(info); pag.appendChild(next);
}

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
    div.innerHTML = `<div style="display:flex;align-items:center"><img class="cover" src="${img}" alt="cover"><div class="meta"><strong>${a.name}</strong><div class="muted">${a.artists?.map(x=>x.name).join(', ')}</div></div></div><div><button data-id="${a.id}" class="ghost">Select</button></div>`;
    const btn = div.querySelector('button');
    btn.addEventListener('click',()=>selectAlbum(a));
    container.appendChild(div);
  });
  renderPagination();
}

function renderPagination(){
  const pag = document.getElementById('pagination');
  pag.innerHTML = '';
  const prev = document.createElement('button'); prev.className='ghost'; prev.innerText='Previous'; prev.disabled = (lastPage <= 0 || lastTotal <= 0);
  const next = document.createElement('button'); next.className='ghost'; next.innerText='Next'; next.disabled = (lastTotal <= 0 || (lastPage+1)*PAGE_LIMIT >= lastTotal);
  const info = document.createElement('div'); info.style.color='var(--muted)';
  if(lastTotal <= 0){
    info.innerText = `0 of 0`;
  } else {
    const from = Math.min(lastOffset+1, lastTotal);
    const to = Math.min(lastOffset+PAGE_LIMIT, lastTotal);
    info.innerText = `${from}–${to} of ${lastTotal}`;
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
  // load runtime config (e.g. share url for exported images)
  (async function loadConfig(){
    try{
      const cfg = await api('/api/config');
      if(cfg && cfg.share_url) shareUrl = cfg.share_url;
    }catch(e){/* ignore */}
  })();
});

let currentAlbum = null;
let tracks = [];
let removedAlbums = [];
let _savedSearchDisplays = {};

async function selectAlbum(a){
  currentAlbum = a;
  // remove/hide search UI and keep HTML for restore
  const idsToHide = ['searchBox','suggestions','searchResults','pagination'];
  idsToHide.forEach(id=>{
    const el = document.getElementById(id);
    if(!el) return;
    // save current inline display value to restore later
    _savedSearchDisplays[id] = el.style.display || '';
    el.style.display = 'none';
  });
  const sr = document.getElementById('searchResults');
  if(!removedSearchHTML) removedSearchHTML = sr.innerHTML;
  sr.innerHTML = '';
  // switch to album 'page' mode (hide aside, expand)
  document.body.classList.add('album-mode');
  history.pushState({albumId:a.id}, '', `#album-${a.id}`);
  document.getElementById('albumSection').innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:0">${a.name}</h2><div><button id="backAlbum" class="ghost">Back to Search</button></div></div><div id="tracks"></div>`;
  document.getElementById('backAlbum').addEventListener('click', ()=>{
    restoreFromAlbum(a.id);
  });
  const res = await api(a.type === 'playlist' ? `/api/playlists/${a.id}/tracks` : `/api/albums/${a.id}/tracks`);
  tracks = res.items || [];
  const tdiv = document.getElementById('tracks');
  tdiv.className='card tracks';
  // show only a summary and a button to reveal the full tracklist
  tdiv.innerHTML = `<div>${tracks.length} Tracks</div><div style="margin-top:8px"><button id="showTracks" class="ghost">Show tracks</button></div><div id="fullTracks" style="margin-top:8px;display:none"></div>`;
  document.getElementById('showTracks').addEventListener('click', (ev)=>{
    const full = document.getElementById('fullTracks');
    if(full.style.display === 'none'){
      full.style.display = 'block';
      full.innerHTML = tracks.map(t=>`<div class="track">${t.name}</div>`).join('');
      ev.target.innerText = 'Hide tracks';
    } else {
      full.style.display = 'none';
      ev.target.innerText = 'Show tracks';
    }
  });
  // prepare voting (hidden/available regardless of showing tracklist)
  startVoting();
}

function startVoting(){
  if(tracks.length<2){ document.getElementById('votingSection').innerText='Not enough tracks.'; return }
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
  const bothLabel = `Both`;
  const noneLabel = `No opinion`;
  out.innerHTML = `
    <div class="voting">
      <div class="vote-card"><h3>${a.name}</h3><div style="margin-top:10px"><button id="voteA">Choose left</button></div></div>
      <div class="center-controls"><button id="voteBoth" class="ghost">${bothLabel}</button><button id="voteNone" class="ghost">${noneLabel}</button></div>
      <div class="vote-card"><h3>${b.name}</h3><div style="margin-top:10px"><button id="voteB">Choose right</button></div></div>
    </div>
    <div id="progress" class="progress"></div>`;
  document.getElementById('voteA').addEventListener('click',()=>recordVote(a.id));
  document.getElementById('voteB').addEventListener('click',()=>recordVote(b.id));
  document.getElementById('voteBoth').addEventListener('click',()=>recordVote([a.id,b.id]));
  document.getElementById('voteNone').addEventListener('click',()=>recordVote(null));
  document.getElementById('progress').innerText = `Pair ${idx+1}/${pairs.length}`;
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
  out.innerHTML = '<div class="card results"><h3>Results</h3>' + ranked.map(([id,sc],i)=>{const t=tracks.find(tt=>tt.id===id);return `<div>${i+1}. ${t? t.name : id} — ${sc} points</div>`}).join('') + '</div>';
  // generate image immediately and show share buttons (no separate Export button)
  (async ()=>{
    const title = currentAlbum && currentAlbum.name ? currentAlbum.name : 'Results';
    try{
      const res = await generateResultsImage(tracks, scores, title);
      if(res && res.blob && res.url){
          lastExportBlob = res.blob;
          lastExportUrl = res.url;
          // upload to server so we can share a hosted URL
          try{
            const upl = await uploadImage(lastExportBlob);
            if(upl && upl.url){ lastUploadedUrl = upl.url; renderShareButtons(upl.url); }
            else renderShareButtons(lastExportUrl);
          }catch(e){ renderShareButtons(lastExportUrl); }
        }
    }catch(e){
      console.warn('Could not generate image for sharing', e);
    }
  })();
}

function exportResultsImage(tracksArr, scoresObj, title){
  const ranked = Object.entries(scoresObj).sort((a,b)=>b[1]-a[1]);
  const items = ranked.map(([id,sc],i)=>{const t=tracksArr.find(tt=>tt.id===id);return {rank:i+1, name: t ? t.name : id, score: sc};});
  const padding = 40;
  const width = 1000;
  const lineHeight = 48;
  const headerHeight = 100;
  const height = padding*2 + headerHeight + Math.max(items.length,1)*lineHeight;
  const c = document.createElement('canvas'); c.width = width; c.height = height;
  const ctx = c.getContext('2d');
  // background
  ctx.fillStyle = '#0f1724'; ctx.fillRect(0,0,width,height);
  // title (centered)
  ctx.fillStyle = '#ffffff'; ctx.font = '32px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('Spotify Battle Results', width/2, padding + 34);
  // album/title subtitle (centered)
  if(title){ ctx.fillStyle = '#94a3b8'; ctx.font = '20px sans-serif'; ctx.fillText(title, width/2, padding + 66); }
  // list
  let y = padding + headerHeight - 20;
  ctx.font = '20px sans-serif'; ctx.fillStyle = '#e6eef8';
  // ensure left alignment for list entries (title used centered alignment)
  ctx.textAlign = 'left';
  items.forEach(it=>{
    const text = `${it.rank}. ${it.name}`;
    // truncate if too long
    let drawText = text;
    while(ctx.measureText(drawText).width > width - padding*3 - 100){ drawText = drawText.slice(0, -1); if(drawText.length<4) break }
    if(drawText !== text) drawText = drawText.slice(0, -3) + '...';
    ctx.fillText(drawText, padding, y);
    // score on right
    ctx.textAlign = 'right'; ctx.fillStyle = '#93c5fd'; ctx.fillText(String(it.score), width - padding, y);
    ctx.textAlign = 'left'; ctx.fillStyle = '#e6eef8';
    y += lineHeight;
  });
  // optional share link at bottom (centered)
  if(shareUrl){
    const bottomY = height - padding/2;
    ctx.font = '14px sans-serif'; ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'center';
    ctx.fillText(shareUrl, width/2, bottomY);
  }
  // use generator to create blob+url and then download
  return generateResultsImage(tracksArr, scoresObj, title).then(res=>{
    try{
      const a = document.createElement('a'); a.href = res.url; a.download = 'spotify-battle-results.png'; a.click();
    }catch(e){}
    return res;
  });
}

function generateResultsImage(tracksArr, scoresObj, title){
  const ranked = Object.entries(scoresObj).sort((a,b)=>b[1]-a[1]);
  const items = ranked.map(([id,sc],i)=>{const t=tracksArr.find(tt=>tt.id===id);return {rank:i+1, name: t ? t.name : id, score: sc};});
  const padding = 40;
  const width = 1000;
  const lineHeight = 48;
  const headerHeight = 100;
  const height = padding*2 + headerHeight + Math.max(items.length,1)*lineHeight;
  const c = document.createElement('canvas'); c.width = width; c.height = height;
  const ctx = c.getContext('2d');
  // background
  ctx.fillStyle = '#0f1724'; ctx.fillRect(0,0,width,height);
  // title (centered)
  ctx.fillStyle = '#ffffff'; ctx.font = '32px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('Spotify Battle Results', width/2, padding + 34);
  // album/title subtitle (centered)
  if(title){ ctx.fillStyle = '#94a3b8'; ctx.font = '20px sans-serif'; ctx.fillText(title, width/2, padding + 66); }
  // list
  let y = padding + headerHeight - 20;
  ctx.font = '20px sans-serif'; ctx.fillStyle = '#e6eef8';
  ctx.textAlign = 'left';
  items.forEach(it=>{
    const text = `${it.rank}. ${it.name}`;
    let drawText = text;
    while(ctx.measureText(drawText).width > width - padding*3 - 100){ drawText = drawText.slice(0, -1); if(drawText.length<4) break }
    if(drawText !== text) drawText = drawText.slice(0, -3) + '...';
    ctx.fillText(drawText, padding, y);
    ctx.textAlign = 'right'; ctx.fillStyle = '#93c5fd'; ctx.fillText(String(it.score), width - padding, y);
    ctx.textAlign = 'left'; ctx.fillStyle = '#e6eef8';
    y += lineHeight;
  });
  if(shareUrl){
    const bottomY = height - padding/2;
    ctx.font = '14px sans-serif'; ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'center';
    ctx.fillText(shareUrl, width/2, bottomY);
  }
  return new Promise((resolve)=>{
    if(c.toBlob){
      c.toBlob((blob)=>{
        const url = URL.createObjectURL(blob);
        resolve({blob, url});
      });
    } else {
      const dataUrl = c.toDataURL('image/png');
      fetch(dataUrl).then(r=>r.blob()).then(blob=>{ resolve({blob, url: URL.createObjectURL(blob)}); });
    }
  });
}

async function uploadImage(blob){
  try{
    const fd = new FormData();
    fd.append('file', blob, 'spotify-battle.png');
    const resp = await fetch('/api/upload-image', { method: 'POST', body: fd, credentials: 'include' });
    if(!resp.ok) return null;
    const j = await resp.json();
    return j;
  }catch(e){
    return null;
  }
}

function renderShareButtons(imageUrl){
  const card = document.querySelector('.card.results');
  if(!card) return;
  let area = card.querySelector('.share-area');
  if(area) area.remove();
  area = document.createElement('div'); area.className = 'share-area'; area.style.marginTop = '8px';
  const openBtn = document.createElement('button'); openBtn.className='ghost'; openBtn.innerText='Open image';
  openBtn.addEventListener('click', ()=>{ window.open(imageUrl, '_blank'); });
  const copyBtn = document.createElement('button'); copyBtn.className='ghost'; copyBtn.innerText='Copy image';
  async function ensureImage(){
    if(lastExportBlob) return;
    const scores = JSON.parse(localStorage.getItem('scores')||'{}');
    const res = await generateResultsImage(tracks, scores, currentAlbum && currentAlbum.name ? currentAlbum.name : 'Results');
    lastExportBlob = res.blob; lastExportUrl = res.url;
  }
  copyBtn.addEventListener('click', async ()=>{
    await ensureImage();
    if(!lastExportBlob){ alert('No image available'); return }
    try{
      await navigator.clipboard.write([new ClipboardItem({'image/png': lastExportBlob})]);
      alert('Image copied to clipboard');
    }catch(e){
      try{ await navigator.clipboard.writeText(shareUrl || window.location.href); alert('Copied share link instead'); }catch(_){ alert('Copy failed'); }
    }
  });
  const webShareBtn = document.createElement('button'); webShareBtn.className='ghost'; webShareBtn.innerText='Share...';
  webShareBtn.addEventListener('click', async ()=>{
    if(navigator.share){
      try{
        await ensureImage();
        const files = lastExportBlob ? [new File([lastExportBlob], 'spotify-battle.png', {type:'image/png'})] : [];
        await navigator.share({title: 'Spotify Battle Results', text: currentAlbum && currentAlbum.name ? currentAlbum.name : 'My results', url: shareUrl || undefined, files});
      }catch(e){ alert('Share failed') }
    } else {
      alert('Web Share not supported in this browser');
    }
  });
  const tweetBtn = document.createElement('button'); tweetBtn.className='ghost'; tweetBtn.innerText='Twitter';
  tweetBtn.addEventListener('click', ()=>{
    const text = encodeURIComponent(`My Spotify Battle results: ${currentAlbum && currentAlbum.name ? currentAlbum.name : ''}`);
    const url = encodeURIComponent(lastUploadedUrl || shareUrl || window.location.href);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
  });
  const blueskyBtn = document.createElement('button'); blueskyBtn.className='ghost'; blueskyBtn.innerText='Bluesky';
  blueskyBtn.addEventListener('click', ()=>{
    const text = encodeURIComponent(`My Spotify Battle results: ${currentAlbum && currentAlbum.name ? currentAlbum.name : ''} ${lastUploadedUrl||shareUrl||''}`);
    window.open(`https://bsky.app/compose?text=${text}`, '_blank');
  });
  const mastoBtn = document.createElement('button'); mastoBtn.className='ghost'; mastoBtn.innerText='Mastodon';
  mastoBtn.addEventListener('click', ()=>{
    const text = encodeURIComponent(`My Spotify Battle results: ${currentAlbum && currentAlbum.name ? currentAlbum.name : ''}`);
    const url = encodeURIComponent(lastUploadedUrl || shareUrl || window.location.href);
    window.open(`https://mastodon.social/share?text=${text}%20${url}`, '_blank');
  });
  const instaBtn = document.createElement('button'); instaBtn.className='ghost'; instaBtn.innerText='Instagram';
  instaBtn.addEventListener('click', ()=>{
    (async ()=>{
      try{
        await ensureImage();
        if(navigator.share && lastExportBlob){
          await navigator.share({files: [new File([lastExportBlob],'spotify-battle.png',{type:'image/png'})], title:'Spotify Battle'});
        } else {
          window.open(lastExportUrl || imageUrl, '_blank');
        }
      }catch(e){ window.open(imageUrl,'_blank') }
    })();
  });
  [openBtn, copyBtn, webShareBtn, tweetBtn, blueskyBtn, mastoBtn, instaBtn].forEach(b=>{ b.style.marginRight='8px'; area.appendChild(b) });
  card.appendChild(area);
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
    // restore previously saved display styles for search UI
    ['searchBox','suggestions','searchResults','pagination'].forEach(id=>{
      const el = document.getElementById(id);
      if(!el) return;
      el.style.display = _savedSearchDisplays[id] || '';
      delete _savedSearchDisplays[id];
    });
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
  } else {
    // ensure search UI is visible if nothing to restore
    ['searchBox','suggestions','searchResults','pagination'].forEach(id=>{
      const el = document.getElementById(id);
      if(el) el.style.display = _savedSearchDisplays[id] || '';
      delete _savedSearchDisplays[id];
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
