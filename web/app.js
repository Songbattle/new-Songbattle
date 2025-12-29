const api = (p)=>fetch(p,{credentials:'include'}).then(r=>r.json()).catch(e=>({error:e.message}));

document.getElementById('loginBtn').addEventListener('click',()=>{
  window.location.href = '/api/login';
});
document.getElementById('whoBtn').addEventListener('click', async ()=>{
  const me = await api('/api/me');
  document.getElementById('me').innerText = me.display_name ? `Angemeldet als: ${me.display_name}` : JSON.stringify(me);
});

document.getElementById('searchBtn').addEventListener('click', async ()=>{
  const q = document.getElementById('searchInput').value.trim();
  if(!q) return alert('Bitte Suchbegriff eingeben');
  const res = await api('/api/search?album='+encodeURIComponent(q));
  const items = res.albums?.items || [];
  const container = document.getElementById('searchResults');
  container.innerHTML='';
  items.forEach(a=>{
    const div = document.createElement('div');
    div.className='card';
    div.innerHTML = `<strong>${a.name}</strong> — ${a.artists?.map(x=>x.name).join(', ')} <button data-id="${a.id}">Auswählen</button>`;
    const btn = div.querySelector('button');
    btn.addEventListener('click',()=>selectAlbum(a));
    container.appendChild(div);
  });
});

let currentAlbum = null;
let tracks = [];

async function selectAlbum(a){
  currentAlbum = a;
  document.getElementById('albumSection').innerHTML = `<h2>${a.name}</h2><div id="tracks"></div>`;
  const res = await api(`/api/albums/${a.id}/tracks`);
  tracks = res.items || [];
  const tdiv = document.getElementById('tracks');
  tdiv.innerHTML = tracks.map(t=>`<div>${t.name}</div>`).join('');
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
  out.innerHTML = `<div class="row"><div class="card"><h3>${a.name}</h3><button id="voteA">Wähle links</button></div><div class="card"><h3>${b.name}</h3><button id="voteB">Wähle rechts</button></div></div><div id="progress"></div>`;
  document.getElementById('voteA').addEventListener('click',()=>recordVote(a.id));
  document.getElementById('voteB').addEventListener('click',()=>recordVote(b.id));
  document.getElementById('progress').innerText = `Paar ${idx+1}/${pairs.length}`;
}

function recordVote(winnerId){
  const scores = JSON.parse(localStorage.getItem('scores')||'{}');
  scores[winnerId] = (scores[winnerId]||0) + 1;
  localStorage.setItem('scores', JSON.stringify(scores));
  let idx = parseInt(localStorage.getItem('pairsIndex')||'0',10);
  idx++; localStorage.setItem('pairsIndex', String(idx));
  renderNextPair();
}

function showResults(){
  const scores = JSON.parse(localStorage.getItem('scores')||'{}');
  const ranked = Object.entries(scores).sort((a,b)=>b[1]-a[1]);
  const out = document.getElementById('votingSection');
  out.innerHTML = '<h3>Ergebnisse</h3>' + ranked.map(([id,sc],i)=>{const t=tracks.find(tt=>tt.id===id);return `<div>${i+1}. ${t? t.name : id} — ${sc} Punkte</div>`}).join('') + '<div><button id="export">Export JSON</button></div>';
  document.getElementById('export').addEventListener('click',()=>{
    const blob = new Blob([JSON.stringify({tracks, scores},null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'spotify-battle-results.json'; a.click();
  });
}
