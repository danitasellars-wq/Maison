// MAISON · moods-dashboard.js — plain script, shares globals with the other files in js/ (load order is set in index.html).
// ── MOOD BOARD (global) ──
function renderMoodBoardSection(context){
  const boards=userData(`moodboards_${context}`,[]);
  if(!boards.length)return`<div class="empty"><div class="empty-icon">🎨</div>No mood boards yet.</div><div style="text-align:center;margin-top:16px"><button class="btn-solid sm" onclick="createMoodBoard('${context}')">Create mood board</button></div>`;
  return`<div class="flex-between mb14"><div></div><button class="btn-solid sm" onclick="createMoodBoard('${context}')">+ New board</button></div>${boards.map((board,bi)=>`<div style="margin-bottom:32px"><div class="flex-between mb14"><div style="font-family:var(--sans);font-size:20px;font-weight:700">${board.title||'Untitled'}</div><div class="flex-center"><button class="btn-ghost" onclick="openEditBoard('${context}',${bi})">Edit</button><button class="btn-ghost danger" onclick="deleteMoodBoard('${context}',${bi})">Delete</button></div></div>${board.palette&&board.palette.length?`<div class="mood-palette">${board.palette.map(c=>`<div class="palette-swatch" style="background:${c}"></div>`).join('')}</div>`:''}<div class="mood-board${!board.tiles||!board.tiles.length?' empty-board':' mb-auto'}">${!board.tiles||!board.tiles.length?'<span style="color:var(--muted);font-size:14px">Empty. Edit to add images.</span>':board.tiles.map(tile=>`<div class="mood-tile mb-t"><img src="${tile.img}" alt=""/>${tile.note?`<div class="tile-note">${tile.note}</div>`:''}</div>`).join('')}</div>${board.notes?`<div style="font-size:13px;color:var(--muted);margin-top:10px;">${board.notes}</div>`:''}</div>`).join('')}`;
}
// Mood board button: boards for the area you're in — House planning (house boards), Closet (style boards),
// Other (wedding + honeymoon boards). Per-room palettes still live inside each room.
const MB_CONTEXTS={house:[['home','House']],closet:[['closet','Style']],other:[['wedding','Wedding'],['honeymoon','Honeymoon']]};
function renderMoodBoards(main){
  const ctxs=MB_CONTEXTS[mbArea]||MB_CONTEXTS.house;
  main.innerHTML=`<div class="section-rule"><div><div class="section-title">Mood boards</div><div class="section-sub">${AREAS[mbArea].name}</div></div></div>`
    +ctxs.map(([c,l])=>(ctxs.length>1?`<div class="st-h"><span>${l}</span></div>`:'')+renderMoodBoardSection(c)).join('');
}
function createMoodBoard(context){openModal(`<div class="modal-head"><div class="modal-title">New mood board</div><button class="modal-close" onclick="closeModal()">×</button></div><label class="field-label">Board title</label><input id="mb-title" class="field-input" placeholder="e.g. Romantic Garden…"/><label class="field-label">Palette colours (hex, comma separated)</label><input id="mb-palette" class="field-input" placeholder="#f7e9d7, #c9b89a"/><label class="field-label">Notes / Mood</label><textarea id="mb-notes" class="field-input" rows="3" placeholder="Describe the vibe…"></textarea><div class="modal-row"><button class="btn-solid sm" onclick="saveMoodBoard('${context}')">Create</button><button class="btn-ghost" onclick="closeModal()">Cancel</button></div>`);}
function saveMoodBoard(context){const title=document.getElementById('mb-title').value.trim()||'New Board';const palette=document.getElementById('mb-palette').value.split(',').map(s=>s.trim()).filter(s=>s.startsWith('#'));const notes=document.getElementById('mb-notes').value.trim();const boards=userData(`moodboards_${context}`,[]);boards.push({id:uid(),title,palette,notes,tiles:[]});saveData(`moodboards_${context}`,boards);closeModal();showSection(currentSection);}
function openEditBoard(context,boardIndex){const boards=userData(`moodboards_${context}`,[]);const board=boards[boardIndex];openModal(`<div class="modal-head"><div class="modal-title">Edit: ${board.title}</div><button class="modal-close" onclick="closeModal()">×</button></div><input type="file" id="mb-file" accept="image/*" multiple style="display:none"/><button class="btn-ghost mb14" onclick="pickMoodBoardImages(${boardIndex},'${context}')">+ Add images</button><div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">${(board.tiles||[]).map((tile,ti)=>`<div style="position:relative;width:80px;height:80px;overflow:hidden;border:1px solid var(--bone)"><img src="${tile.img}" style="width:100%;height:100%;object-fit:cover"/><button onclick="removeTile(${boardIndex},'${context}',${ti})" style="position:absolute;top:2px;right:2px;background:rgba(168,32,32,.85);border:none;color:#fff;width:18px;height:18px;font-size:12.5px;cursor:pointer">×</button></div>`).join('')}</div><label class="field-label">Title</label><input id="mb-edit-title" class="field-input" value="${board.title||''}"/><label class="field-label">Palette</label><input id="mb-edit-palette" class="field-input" value="${(board.palette||[]).join(', ')}"/><label class="field-label">Notes</label><textarea id="mb-edit-notes" class="field-input" rows="3">${board.notes||''}</textarea><div class="modal-row"><button class="btn-solid sm" onclick="updateMoodBoard('${context}',${boardIndex})">Save</button><button class="btn-ghost" onclick="closeModal()">Cancel</button></div>`);}
function pickMoodBoardImages(boardIndex,context){const fi=document.getElementById('mb-file');fi.onchange=e=>{Array.from(e.target.files).forEach(file=>{const r=new FileReader();r.onload=async ev=>{
  const id=uid();
  let thumb=ev.target.result,blob=null;
  try{const p=await processPhotoDataURL(ev.target.result);thumb=p.thumb;blob=p.blob;}catch(err){}
  const boards=userData(`moodboards_${context}`,[]);boards[boardIndex].tiles=boards[boardIndex].tiles||[];boards[boardIndex].tiles.push({id,img:thumb,note:'',size:'md'});saveData(`moodboards_${context}`,boards);
  if(blob)await idbPutPhoto(id,blob);
  syncPhotosSoon();openEditBoard(context,boardIndex);
};r.readAsDataURL(file);});fi.value='';};fi.click();}
function removeTile(boardIndex,context,tileIndex){
  const boards=userData(`moodboards_${context}`,[]);const removed=boards[boardIndex].tiles[tileIndex];
  boards[boardIndex].tiles.splice(tileIndex,1);saveData(`moodboards_${context}`,boards);
  if(removed){idbDeletePhoto(removed.id).catch(()=>{});deleteRemotePhoto(removed.id).catch(()=>{});}
  openEditBoard(context,boardIndex);
}
function updateMoodBoard(context,boardIndex){const boards=userData(`moodboards_${context}`,[]);const board=boards[boardIndex];board.title=document.getElementById('mb-edit-title').value.trim()||'Board';board.palette=document.getElementById('mb-edit-palette').value.split(',').map(s=>s.trim()).filter(s=>s.startsWith('#'));board.notes=document.getElementById('mb-edit-notes').value.trim();saveData(`moodboards_${context}`,boards);closeModal();showSection(currentSection);}
function deleteMoodBoard(context,boardIndex){
  if(!confirm('Delete this mood board?'))return;
  const boards=userData(`moodboards_${context}`,[]);
  ((boards[boardIndex]&&boards[boardIndex].tiles)||[]).forEach(t=>{idbDeletePhoto(t.id).catch(()=>{});deleteRemotePhoto(t.id).catch(()=>{});});
  boards.splice(boardIndex,1);saveData(`moodboards_${context}`,boards);
  showSection(currentSection);
}

// ── DASHBOARD ──
function timeAgo(ts){
  if(!ts)return'';
  const diff=Date.now()-ts,mins=Math.floor(diff/60000);
  if(mins<2)return'Just now';
  if(mins<60)return`${mins}m ago`;
  const hrs=Math.floor(mins/60);
  if(hrs<24)return`${hrs}h ago`;
  const days=Math.floor(hrs/24);
  if(days<7)return`${days} day${days!==1?'s':''} ago`;
  return new Date(ts).toLocaleDateString('en-GB',{day:'numeric',month:'short'});
}
// ── backup reminder ──
// Anyone with neither Cloud Sync nor the Google Drive backup switched on gets a gentle, dismissible card on the home screen. "Not now" hides it
// for a week, "Don't ask again" for good (stored on this device only). It only appears once there is something worth saving.
function syncNudgeKey(){return'maison_syncnudge_'+currentUser;}
function hasBackupOn(){return!!(driveAccessToken||localStorage.getItem('maison_drive_on_'+currentUser)||localStorage.getItem('maison_bkdrive_on_'+currentUser));}
function hasSomethingToSave(){
  const pre='maison_'+currentUser+'_',skip=['lastwrite','appearance','gdrive_backup','wallpaper'];let n=0;
  try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.indexOf(pre)!==0||skip.indexOf(k.slice(pre.length))>=0)continue;n+=(localStorage.getItem(k)||'').length;}}catch(e){}
  return n>300;
}
function syncNudgeHTML(){
  if(!currentUser||hasBackupOn()||!hasSomethingToSave())return'';
  const s=getStore(syncNudgeKey(),{});if(s.never||(s.until&&s.until>Date.now()))return'';
  return`<div class="sync-nudge"><div class="sync-nudge-title">Keep your things safe</div><p>Right now MAISON only saves to this device. Turn on Cloud Sync and your closet, recipes, events and photos are backed up to your Google Drive, and appear on your other devices too.</p><div class="sync-nudge-actions"><button class="btn-solid sm" onclick="enableDriveSync()">Turn on Cloud Sync</button><button class="btn-ghost" onclick="syncNudgeLater()">Not now</button></div><button class="sync-nudge-never" onclick="syncNudgeNever()">Don't ask again</button></div>`;
}
function syncNudgeLater(){setStore(syncNudgeKey(),Object.assign(getStore(syncNudgeKey(),{}),{until:Date.now()+7*864e5}));showSection('dashboard');}
function syncNudgeNever(){setStore(syncNudgeKey(),Object.assign(getStore(syncNudgeKey(),{}),{never:true}));showSection('dashboard');}
// Home screen: three big tiles. Everything else is one tap deeper (see AREAS / areaRows).
function renderDashboard(main){
  const home=userData('home',{rooms:[]});
  const c=closetData();
  const spent=home.rooms.reduce((s,r)=>s+(r.items||[]).reduce((a,i)=>a+(i.price||0),0)+(r.photos||[]).filter(p=>!p.archived).reduce((a,p)=>a+(p.price||0),0),0);
  const n=(k,w)=>`${k} ${w}${k!==1?'s':''}`;
  const tiles=[
    {a:'house',color:'var(--ink)',sub:home.rooms.length?n(home.rooms.length,'room')+(spent?` · ${clMoney(spent)}`:''):'Rooms, budgets & floor plan'},
    {a:'closet',color:'var(--plum)',sub:c.items.length?n(c.items.length,'piece')+(c.outfits.length?` · ${n(c.outfits.length,'outfit')}`:''):'Wardrobe, outfits & packing'},
    {a:'other',color:'var(--gold)',sub:'Wedding · Honeymoon · Days out · Recipes · Music'},
  ];
  const firstName=currentUserName?currentUserName.split(' ')[0]:'';
  main.innerHTML=`<div class="home-greet">Welcome back${firstName?', '+escHtml(firstName):''}</div>
    ${syncNudgeHTML()}
    <div class="home-tiles">${tiles.map((t,i)=>`<button class="home-tile" style="border-top-color:${t.color}" onclick="showSection('area_${t.a}')"><div><div class="home-tile-num" style="color:${t.color}">${String(i+1).padStart(2,'0')}</div><div class="home-tile-name">${AREAS[t.a].name}</div><div class="home-tile-sub">${t.sub}</div></div><span class="area-chev">→</span></button>`).join('')}</div>${evPinnedHTML()}`;
}

