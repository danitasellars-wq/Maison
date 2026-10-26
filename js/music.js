// MAISON · music.js — plain script, shares globals with the other files in js/ (load order is set in index.html).
// ── MUSIC ──
function renderMusic(main){
  const m=userData('music',{playlists:[]});
  if(!m.playlists.length){
    main.innerHTML=`<div class="section-rule"><div><div class="section-title">Music</div><div class="section-sub">Your favourite songs &amp; playlists.</div></div><div class="flex-center">${quickNotesBtn('music')}<button class="btn-solid sm" onclick="openAddPlaylist()">+ Playlist</button></div></div><div class="empty"><div class="empty-icon">🎵</div>No playlists yet. Create your first one!</div>`;
    return;
  }
  if(!activeMusicPlaylistId||!m.playlists.find(p=>p.id===activeMusicPlaylistId))activeMusicPlaylistId=m.playlists[0].id;
  const pl=m.playlists.find(p=>p.id===activeMusicPlaylistId);
  const tabs=m.playlists.map(p=>`<button class="room-tab${p.id===activeMusicPlaylistId?' active':''}" onclick="setActiveMusicPlaylist('${p.id}')">${escHtml(p.name)}</button>`).join('');
  const songs=pl.songs||[];
  const songsHtml=songs.length?songs.map((s,i)=>{const link=safeLink(s.link);return`<div class="song-row" data-sid="${s.id}">
    <div class="song-num">${i+1}</div>
    <div class="song-body">
      <div class="song-title">${escHtml(s.title)}${s.audio?'<span class="song-tag">Uploaded</span>':''}</div>
      ${s.artist?`<div class="song-artist">${escHtml(s.artist)}</div>`:''}
      ${s.note?`<div class="song-note">${escHtml(s.note)}</div>`:''}
    </div>
    <div class="song-actions">
      ${s.audio?`<button class="song-play" data-play="${s.id}" aria-label="Play ${escHtml(s.title)}" onclick="playSong('${pl.id}','${s.id}')">${MP_ICON_PLAY}</button>`:''}
      ${link?`<a href="${escHtml(link)}" target="_blank" rel="noopener" class="song-link-btn">${s.audio?'Link':'Play'}</a>`:''}
      <button class="icon-btn" title="Delete" onclick="deleteSong('${pl.id}','${s.id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
    </div>
  </div>`;}).join(''):`<div class="empty" style="padding:20px 0;font-size:13px">No songs yet — add your first!</div>`;
  main.innerHTML=`<div class="section-rule"><div><div class="section-title">Music</div><div class="section-sub">Your favourite songs &amp; playlists.</div></div><div class="flex-center">${quickNotesBtn('music')}<button class="btn-solid sm" onclick="openAddPlaylist()">+ Playlist</button></div></div>
    <div class="room-tabs-row">${tabs}</div>
    <div class="flex-between mb14" style="padding-top:16px">
      <div style="font-family:var(--sans);font-size:16px;color:var(--muted)">${escHtml(pl.name)} <span style="font-size:12px;font-weight:400;">${songs.length} song${songs.length!==1?'s':''}</span></div>
      <div class="flex-center">
        <button class="btn-ghost" onclick="openAddSong('${pl.id}')">+ Add song</button>
        <button class="btn-ghost danger" onclick="deletePlaylist('${pl.id}')">Delete</button>
      </div>
    </div>
    ${pl.description?`<p style="font-size:13px;color:var(--muted);margin-bottom:14px">${escHtml(pl.description)}</p>`:''}
    ${songsHtml}`;
  mpRefresh();
}
function setActiveMusicPlaylist(id){activeMusicPlaylistId=id;showSection('music');}
function openAddPlaylist(){
  openModal(`<div class="modal-head"><div class="modal-title">New playlist</div><button class="modal-close" onclick="closeModal()">×</button></div>
    <label class="field-label">Playlist name</label>
    <input id="pl-name" class="field-input" placeholder="e.g. Favourites, Wedding Morning…"/>
    <label class="field-label">Description (optional)</label>
    <input id="pl-desc" class="field-input" placeholder="A note about this playlist…"/>
    <div class="modal-row"><button class="btn-solid sm" onclick="savePlaylist()">Create</button><button class="btn-ghost" onclick="closeModal()">Cancel</button></div>`);
}
function savePlaylist(){
  const name=(document.getElementById('pl-name').value||'').trim();if(!name)return;
  const m=userData('music',{playlists:[]});const id=uid();
  m.playlists.push({id,name,description:(document.getElementById('pl-desc').value||'').trim(),songs:[]});
  saveData('music',m);activeMusicPlaylistId=id;closeModal();showSection('music');
}
function dropSongAudio(s){
  if(!s||!s.audio)return;
  if(mpNow&&mpNow.songId===s.id)mpStop();
  idbDeletePhoto(s.id).catch(()=>{});deleteRemotePhoto(s.id).catch(()=>{});
}
function deletePlaylist(id){
  if(!confirm('Delete this playlist and all its songs?'))return;
  const m=userData('music',{playlists:[]});
  (m.playlists.find(p=>p.id===id)||{songs:[]}).songs.forEach(dropSongAudio);
  m.playlists=m.playlists.filter(p=>p.id!==id);
  activeMusicPlaylistId=m.playlists.length?m.playlists[0].id:null;
  saveData('music',m);showSection('music');
}
function openAddSong(playlistId){
  openModal(`<div class="modal-head"><div class="modal-title">Add song</div><button class="modal-close" onclick="closeModal()">×</button></div>
    <label class="field-label">Song title</label>
    <input id="song-title" class="field-input" placeholder="e.g. Fly Me to the Moon…"/>
    <label class="field-label">Artist</label>
    <input id="song-artist" class="field-input" placeholder="e.g. Frank Sinatra…"/>
    <label class="field-label">Link (Spotify / YouTube / Apple Music)</label>
    <input id="song-link" class="field-input" type="url" placeholder="https://…"/>
    <label class="field-label">Or upload the song</label>
    <input id="song-file" class="field-input" type="file" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.flac" onchange="songFilePicked(this)"/>
    <p class="cl-hint" id="song-file-hint">Add a link, upload a file, or both. Uploaded songs play inside MAISON and sync through Google Drive.</p>
    <label class="field-label">Note (optional)</label>
    <input id="song-note" class="field-input" placeholder="Why you love it…"/>
    <div class="modal-row"><button class="btn-solid sm" id="song-save" onclick="saveSong('${playlistId}')">Add to playlist</button><button class="btn-ghost" onclick="closeModal()">Cancel</button></div>`);
}
const SONG_MAX_BYTES=80*1048576;
function songFilePicked(inp){
  const f=inp.files&&inp.files[0],hint=document.getElementById('song-file-hint'),t=document.getElementById('song-title');
  if(!f||!hint)return;
  if(f.size>SONG_MAX_BYTES){hint.textContent='That file is '+(f.size/1048576).toFixed(0)+' MB. The limit is 80 MB, so please choose a smaller one.';inp.value='';return;}
  hint.textContent=f.name+' · '+(f.size/1048576).toFixed(1)+' MB';
  if(t&&!t.value.trim())t.value=f.name.replace(/\.[^.]+$/,'').replace(/[_]+/g,' ');
}
// Only web links are kept as links (blocks javascript: and similar), and a bare "spotify.com/…" gets https://
function safeLink(u){u=(u||'').trim();if(!u)return'';if(!/^[a-z][a-z0-9+.-]*:/i.test(u))u='https://'+u;return/^https?:\/\//i.test(u)?u:'';}
async function saveSong(playlistId){
  const title=(document.getElementById('song-title').value||'').trim();if(!title)return;
  const m=userData('music',{playlists:[]});const pl=m.playlists.find(p=>p.id===playlistId);if(!pl)return;
  const fileInp=document.getElementById('song-file'),file=fileInp&&fileInp.files&&fileInp.files[0];
  const id=uid(),song={id,title,artist:(document.getElementById('song-artist').value||'').trim(),link:safeLink(document.getElementById('song-link').value),note:(document.getElementById('song-note').value||'').trim(),date:Date.now()};
  if(file){
    if(file.size>SONG_MAX_BYTES){clToast('That file is over 80 MB');return;}
    const btn=document.getElementById('song-save');if(btn){btn.disabled=true;btn.textContent='Saving…';}
    const ok=await idbPutPhoto(id,file);   // store the song on this device first; if that fails nothing is added
    if(!ok){if(btn){btn.disabled=false;btn.textContent='Add to playlist';}return;}
    song.audio={name:file.name,type:file.type||'audio/mpeg',size:file.size};
  }
  pl.songs=pl.songs||[];pl.songs.push(song);
  if(!saveData('music',m)){if(song.audio)idbDeletePhoto(id).catch(()=>{});const btn=document.getElementById('song-save');if(btn){btn.disabled=false;btn.textContent='Add to playlist';}return;}
  closeModal();showSection('music');
  if(song.audio)syncPhotosSoon();
}
function deleteSong(playlistId,songId){
  const m=userData('music',{playlists:[]});const pl=m.playlists.find(p=>p.id===playlistId);
  if(pl){dropSongAudio((pl.songs||[]).find(s=>s.id===songId));pl.songs=(pl.songs||[]).filter(s=>s.id!==songId);saveData('music',m);}showSection('music');
}

// ── In-app player for uploaded songs ──
// One shared <audio> element, so a song keeps playing while you move around the app. The bar above the dock shows what's playing.
const MP_ICON_PLAY='<svg viewBox="0 0 24 24"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z"/></svg>';
const MP_ICON_PAUSE='<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4.5" height="16" rx="1"/><rect x="13.5" y="4" width="4.5" height="16" rx="1"/></svg>';
const MP_ICON_PREV='<svg viewBox="0 0 24 24"><rect x="5" y="5" width="2.5" height="14" rx="1"/><path d="M19 5.6v12.8a1 1 0 0 1-1.55.83l-9-6.4a1 1 0 0 1 0-1.66l9-6.4A1 1 0 0 1 19 5.6z"/></svg>';
const MP_ICON_NEXT='<svg viewBox="0 0 24 24"><rect x="16.5" y="5" width="2.5" height="14" rx="1"/><path d="M5 5.6v12.8a1 1 0 0 0 1.55.83l9-6.4a1 1 0 0 0 0-1.66l-9-6.4A1 1 0 0 0 5 5.6z"/></svg>';
const MP_ICON_CLOSE='<svg viewBox="0 0 24 24"><path d="M6.4 5l12.6 12.6-1.4 1.4L5 6.4zM19 6.4L6.4 19 5 17.6 17.6 5z"/></svg>';
let mpAudioEl=null,mpURL=null,mpNow=null,mpLoading=0;
function mpEl(){
  if(mpAudioEl)return mpAudioEl;
  const a=new Audio();a.preload='auto';
  a.addEventListener('ended',()=>mpStep(1,true));
  a.addEventListener('play',mpRefresh);a.addEventListener('pause',mpRefresh);
  a.addEventListener('timeupdate',()=>{const i=document.querySelector('#mini-player .mp-bar i');if(i&&a.duration)i.style.width=(a.currentTime/a.duration*100)+'%';});
  a.addEventListener('error',()=>{if(mpNow){clToast("This file couldn't be played");mpRefresh();}});
  mpAudioEl=a;return a;
}
function mpFind(songId){
  const m=userData('music',{playlists:[]});
  for(const p of m.playlists){const s=(p.songs||[]).find(x=>x.id===songId);if(s)return{pl:p,song:s};}
  return null;
}
async function playSong(plId,songId){
  const a=mpEl();
  if(mpNow&&mpNow.songId===songId&&a.src){if(a.paused)a.play().catch(()=>{});else a.pause();return;}
  const f=mpFind(songId);if(!f||!f.song.audio)return;
  const token=++mpLoading;
  let blob=await idbGetPhoto(songId).catch(()=>null);
  if(!blob){
    clToast('Fetching this song from Google Drive…');
    blob=await ensurePhotoLocal(songId);
    if(!blob){if(token===mpLoading)clToast("Couldn't load this song. Check you're connected to Google Drive.");return;}
  }
  if(token!==mpLoading)return;   // a newer tap superseded this one
  if(mpURL)URL.revokeObjectURL(mpURL);
  mpURL=URL.createObjectURL(new Blob([blob],{type:f.song.audio.type||blob.type||'audio/mpeg'}));
  mpNow={plId:f.pl.id,songId};
  a.src=mpURL;
  try{await a.play();}catch(e){clToast("Tap play to start the song");}
  mpMediaSession(f.song);mpRefresh();
}
// Previous / next among the uploaded songs of the current playlist; stops quietly at the ends.
function mpStep(dir,fromEnd){
  if(!mpNow)return;
  const f=mpFind(mpNow.songId);if(!f)return mpStop();
  const list=(f.pl.songs||[]).filter(s=>s.audio),i=list.findIndex(s=>s.id===mpNow.songId),n=list[i+dir];
  if(n)playSong(f.pl.id,n.id);
  else if(fromEnd){const a=mpEl();a.currentTime=0;mpRefresh();}
}
function mpStop(){
  mpLoading++;mpNow=null;
  if(mpAudioEl){mpAudioEl.pause();mpAudioEl.removeAttribute('src');try{mpAudioEl.load();}catch(e){}}
  if(mpURL){URL.revokeObjectURL(mpURL);mpURL=null;}
  mpRefresh();
}
function mpMediaSession(song){
  if(!('mediaSession' in navigator))return;
  try{
    navigator.mediaSession.metadata=new MediaMetadata({title:song.title,artist:song.artist||'MAISON'});
    navigator.mediaSession.setActionHandler('play',()=>mpEl().play());
    navigator.mediaSession.setActionHandler('pause',()=>mpEl().pause());
    navigator.mediaSession.setActionHandler('previoustrack',()=>mpStep(-1));
    navigator.mediaSession.setActionHandler('nexttrack',()=>mpStep(1));
  }catch(e){}
}
// Keeps song rows and the player bar in step with what's playing. Safe to call any time.
function mpRefresh(){
  const a=mpAudioEl,playing=!!(a&&mpNow&&!a.paused);
  document.querySelectorAll('.song-row').forEach(r=>{
    const on=!!mpNow&&r.dataset.sid===mpNow.songId;
    r.classList.toggle('playing',on);
    const b=r.querySelector('.song-play');if(b)b.innerHTML=on&&playing?MP_ICON_PAUSE:MP_ICON_PLAY;
  });
  let bar=document.getElementById('mini-player');
  if(!mpNow){if(bar)bar.classList.remove('on');document.body.classList.remove('has-player');return;}
  const f=mpFind(mpNow.songId);if(!f){mpStop();return;}
  if(!bar){bar=document.createElement('div');bar.id='mini-player';document.body.appendChild(bar);}
  bar.innerHTML=`<div class="mp-bar"><i></i></div>
    <div class="mp-info"><div class="mp-title">${escHtml(f.song.title)}</div><div class="mp-sub">${escHtml(f.song.artist||f.pl.name)}</div></div>
    <button onclick="mpStep(-1)" aria-label="Previous song">${MP_ICON_PREV}</button>
    <button onclick="playSong('${f.pl.id}','${f.song.id}')" aria-label="${playing?'Pause':'Play'}">${playing?MP_ICON_PAUSE:MP_ICON_PLAY}</button>
    <button onclick="mpStep(1)" aria-label="Next song">${MP_ICON_NEXT}</button>
    <button onclick="mpStop()" aria-label="Close player">${MP_ICON_CLOSE}</button>`;
  bar.classList.add('on');document.body.classList.add('has-player');
  const i=bar.querySelector('.mp-bar i');if(i&&a&&a.duration)i.style.width=(a.currentTime/a.duration*100)+'%';
}

