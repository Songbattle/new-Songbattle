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
  if(me && me.display_name){
    meEl.innerText = `Angemeldet als: ${me.display_name}`;
  } else {
    meEl.innerText = 'Nicht angemeldet';
  }
  return me;
}

document.getElementById('searchBtn').addEventListener('click', async ()=>{
  const q = document.getElementById('searchInput').value.trim();
  if(!q) return alert('Bitte Suchbegriff eingeben');
  const res = await api('/api/search?album='+encodeURIComponent(q));
  const items = res.albums?.items || [];
  const container = document.getElementById('searchResults');
  container.innerHTML='';
  items.forEach(a=>{
    const div = document.createElement('div');
    div.className='album';
    div.innerHTML = `<div><strong>${a.name}</strong><div class="muted">${a.artists?.map(x=>x.name).join(', ')}</div></div><div><button data-id="${a.id}" class="ghost">Auswählen</button></div>`;
    const btn = div.querySelector('button');
    btn.addEventListener('click',()=>selectAlbum(a));
    container.appendChild(div);
  });
});

// load user on startup to reflect login state after redirect
window.addEventListener('load', ()=>{
  loadMe();
});

let currentAlbum = null;
let tracks = [];
let removedAlbums = [];

async function selectAlbum(a){
  currentAlbum = a;
  // remove album from search results and keep for restore
  const btnSel = document.querySelector(`#searchResults button[data-id="${a.id}"]`);
  if(btnSel && btnSel.closest('.album')){
    const el = btnSel.closest('.album');
    removedAlbums.push({album:a, html:el.outerHTML});
    el.remove();
  }
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
  tdiv.innerHTML = tracks.map(t=>`<div class="track">${t.name}</div>`).join('');
  // prepare voting
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
  out.innerHTML = `<div class="voting"><div class="vote-card"><h3>${a.name}</h3><div style="margin-top:10px"><button id="voteA">Wähle links</button></div></div><div class="vote-card"><h3>${b.name}</h3><div style="margin-top:10px"><button id="voteB">Wähle rechts</button></div></div></div><div style="display:flex;gap:8px;margin-top:10px"><button id="voteBoth" class="ghost">Mag beide</button><button id="voteNone" class="ghost">Keine Meinung</button></div><div id="progress" class="progress"></div>`;
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
  // restore album entry in search results (if removed) and clear album/voting view
  for(let i=removedAlbums.length-1;i>=0;i--){
    if(removedAlbums[i].album.id === albumId){
      const container = document.getElementById('searchResults');
      const temp = document.createElement('div'); temp.innerHTML = removedAlbums[i].html; const node = temp.firstChild;
      container.prepend(node);
      removedAlbums.splice(i,1);
      break;
    }
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
