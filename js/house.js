// MAISON · house.js — plain script, shares globals with the other files in js/ (load order is set in index.html).
// ── QUICK NOTES ──
function quickNotesBtn(section){
  const hasNotes=!!(userData(`notes_${section}`,''));
  return`<button class="notes-btn${hasNotes?' has-notes':''}" onclick="openQuickNotes('${section}')">Notes</button>`;
}
function openQuickNotes(section){
  const notes=userData(`notes_${section}`,'');
  const label={home:'Home notes',wedding:'Wedding notes',honeymoon:'Honeymoon notes',recipes:'Recipe notes',music:'Music notes',closet:'Closet notes'}[section]||'Notes';
  openModal(`<div class="modal-head"><div class="modal-title">${label}</div><button class="modal-close" onclick="closeModal()">×</button></div><textarea id="qnotes-text" class="field-input" rows="10" placeholder="Jot anything down…" style="min-height:200px">${notes}</textarea><div class="modal-row" style="margin-top:8px"><button class="btn-solid sm" onclick="saveQuickNotes('${section}')">Save notes</button><button class="btn-ghost" onclick="closeModal()">Cancel</button></div>`);
  setTimeout(()=>{const el=document.getElementById('qnotes-text');if(el){el.selectionStart=el.selectionEnd=el.value.length;el.focus();}},50);
}
function saveQuickNotes(section){saveData(`notes_${section}`,document.getElementById('qnotes-text').value);closeModal();showSection(currentSection);}

// ── DRAG ROOMS ──
function dragRoomStart(e,idx){dragRoomIdx=idx;e.dataTransfer.effectAllowed='move';setTimeout(()=>e.target.style.opacity='.45',0);}
function dragRoomOver(e,idx){e.preventDefault();document.querySelectorAll('.room-tab[draggable]').forEach(t=>t.classList.remove('drag-over'));if(idx!==dragRoomIdx)e.currentTarget.classList.add('drag-over');}
function dragRoomLeave(e){e.currentTarget.classList.remove('drag-over');}
function dropRoom(e,idx,section='home'){
  e.preventDefault();if(dragRoomIdx===null||dragRoomIdx===idx)return;
  if(section==='home'){const home=userData('home',{rooms:[]});const[m]=home.rooms.splice(dragRoomIdx,1);home.rooms.splice(idx,0,m);saveData('home',home);}
  else if(section==='dayout'){const d=userData('dayout',{plans:[]});const[m]=d.plans.splice(dragRoomIdx,1);d.plans.splice(idx,0,m);saveData('dayout',d);}
  dragRoomIdx=null;document.querySelectorAll('.room-tab[draggable]').forEach(t=>{t.classList.remove('drag-over');t.style.opacity='1';});showSection(section);
}
function dragRoomEnd(e){e.target.style.opacity='1';document.querySelectorAll('.room-tab[draggable]').forEach(t=>t.classList.remove('drag-over'));dragRoomIdx=null;}

// ── HOME ──
let activeRoomId=null;
function setHomeView(v){homeView=v;showSection('home');}
function setRoomTab(t){activeRoomTab=t;showSection('home');}
function setActiveRoom(id){if(id!==activeRoomId)activeRoomTab='overview';activeRoomId=id;showSection('home');}

function renderHome(main){
  const home=userData('home',{rooms:[]});
  if(homeView==='floorplan'){main.innerHTML=`<div class="section-rule"><div><div class="section-title">Floor plan</div><div class="section-sub">Visualise your space.</div></div>${quickNotesBtn('home')}</div>${renderFloorPlanView()}`;return;}
  if(!home.rooms.length){main.innerHTML=`<div class="section-rule"><div><div class="section-title">Rooms</div><div class="section-sub">Add rooms to start planning.</div></div><div class="flex-center">${quickNotesBtn('home')}<button class="btn-solid sm" onclick="openAddRoom()">+ Room</button></div></div><div class="empty">No rooms yet.</div>`;return;}
  if(!activeRoomId||!home.rooms.find(r=>r.id===activeRoomId))activeRoomId=home.rooms[0].id;
  const room=home.rooms.find(r=>r.id===activeRoomId);
  const tabs=home.rooms.map((r,i)=>`<button class="room-tab${r.id===activeRoomId?' active':''}" draggable="true" ondragstart="dragRoomStart(event,${i})" ondragover="dragRoomOver(event,${i})" ondragleave="dragRoomLeave(event)" ondrop="dropRoom(event,${i},'home')" ondragend="dragRoomEnd(event)" onclick="setActiveRoom('${r.id}')"><span class="drag-handle">⋮⋮</span>${r.name}</button>`).join('');
  const subTabs=['overview','photos','moodboard'].map(t=>`<button class="room-sub-tab${activeRoomTab===t?' active':''}" onclick="setRoomTab('${t}')">${t==='overview'?'Overview':t==='photos'?'Photos':'Mood board'}</button>`).join('');
  let content='';
  if(activeRoomTab==='overview'){
    const photos=room.photos||[],items=room.items||[];
    const budget=room.budget||0,spent=items.reduce((s,it)=>s+(it.price||0),0)+photos.filter(p=>!p.archived).reduce((s,p)=>s+(p.price||0),0);
    const pct=budget>0?Math.min(spent/budget*100,100):0,over=budget>0&&spent>budget;
    content=`<div class="budget-block"><div class="budget-row"><div><div class="budget-label">${room.name} budget</div><div class="budget-amount${over?' over':''}">£${spent.toLocaleString(undefined,{minimumFractionDigits:2})} <span style="font-size:14px;color:var(--muted)">/ £${(budget||0).toLocaleString()}</span></div></div><button class="btn-ghost" onclick="editRoomBudget('${room.id}')">Edit</button></div><div class="bar-track"><div class="bar-fill${over?' over':''}" style="width:${pct}%"></div></div><div class="bar-note${over?' over':''}">${over?'Over budget':'Remaining: £'+(budget-spent).toLocaleString(undefined,{minimumFractionDigits:2})}</div></div>
      <div class="flex-between mb14"><div style="font-family:var(--sans);font-size:16px;color:var(--muted)">Furniture &amp; items</div><div class="flex-center"><button class="btn-ghost" onclick="openAddItem('${room.id}')">+ Add item</button><button class="btn-ghost danger" onclick="deleteRoom('${room.id}')">Delete room</button></div></div>
      ${renderItemList(items,room.id)}`;
  } else if(activeRoomTab==='photos'){
    content=renderPhotoGrid(room.photos||[],'home_room',room.id);
  } else {
    content=renderRoomMoodboard(room);
  }
  main.innerHTML=`<div class="section-rule"><div><div class="section-title">Rooms</div><div class="section-sub">Track every room, budget &amp; piece of furniture.</div></div><div class="flex-center">${quickNotesBtn('home')}<button class="btn-solid sm" onclick="openAddRoom()">+ Room</button></div></div><div class="room-tabs-row">${tabs}</div><div class="room-sub-tabs">${subTabs}</div>${content}`;
}

function renderItemList(items,roomId){
  if(!items.length)return`<div class="empty" style="padding:20px 0;font-size:13px">No items yet.</div>`;
  return items.map(it=>`<div class="item-row">${it.img?`<img class="item-thumb" src="${it.img}"/>`:`<div class="item-thumb-ph">🛋</div>`}<div class="item-body"><div class="item-name">${it.name||'Item'}</div>${it.store?`<div class="item-store">${it.store}</div>`:''}${it.link?`<a class="item-link" href="${it.link}" target="_blank" rel="noopener">${it.link}</a>`:''}</div>${it.price?`<div class="item-price">£${it.price.toLocaleString(undefined,{minimumFractionDigits:2})}</div>`:''}<button class="icon-btn" onclick="deleteItem('${roomId}','${it.id}')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></button></div>`).join('');
}

// ── mood boards lay themselves out ──
// Pictures sit in tidy rows: every row is stretched to the full width, each picture keeps its own shape. Runs whenever a board appears,
// a picture finishes loading, or the window changes size.
function mbLayout(box){
  const cs=getComputedStyle(box),W=box.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight),gap=4;
  if(W<=40)return;
  const tiles=[].slice.call(box.querySelectorAll('.mb-t')),target=W<500?120:170;
  const ar=tiles.map(t=>{const i=t.querySelector('img');return i&&i.naturalWidth?i.naturalWidth/i.naturalHeight:1.33;});
  let row=[],sum=0;
  const put=(items,h)=>{items.forEach(({t,a})=>{t.style.width=Math.floor(a*h)+'px';t.style.height=Math.round(h)+'px';});};
  const flush=last=>{
    if(!row.length)return;
    const h=(W-gap*(row.length-1))/sum;
    put(row,last&&h>target*1.5?target:h);row=[];sum=0;
  };
  tiles.forEach((t,i)=>{
    row.push({t,a:ar[i]});sum+=ar[i];
    if((sum*target)+gap*(row.length-1)>=W)flush(false);
  });
  flush(true);
}
let mbTimer=0;
function mbLayoutAll(){cancelAnimationFrame(mbTimer);mbTimer=requestAnimationFrame(()=>document.querySelectorAll('.mb-auto').forEach(mbLayout));}
document.addEventListener('load',e=>{if(e.target&&e.target.matches&&e.target.matches('.mb-t img'))mbLayoutAll();},true);
window.addEventListener('resize',mbLayoutAll);
new MutationObserver(m=>{if(m.some(r=>[].some.call(r.addedNodes,n=>n.nodeType===1&&(n.matches('.mb-auto')||n.querySelector('.mb-auto'))))) mbLayoutAll();}).observe(document.documentElement,{childList:true,subtree:true});

// ── ROOM MOOD BOARD ──
function renderRoomMoodboard(room){
  const mb=room.moodboard||{colors:[],tiles:[],notes:''};
  const swatches=mb.colors.length?mb.colors.map((c,i)=>`<div class="mb-swatch-wrap"><div class="mb-swatch" style="background:${c.hex}" title="${c.ral?'RAL '+c.ral:''}"></div><button class="mb-swatch-del" onclick="removeRoomColor('${room.id}',${i})">×</button><div class="mb-swatch-label">${c.ral?'RAL '+c.ral:c.name||''}</div></div>`).join(''):`<p style="font-size:13px;color:var(--muted);">No colours yet.</p>`;
  const tiles=mb.tiles&&mb.tiles.length?mb.tiles.map((tile,ti)=>`<div class="mood-tile mb-t"><img src="${tile.img}" alt=""/><button class="mb-del" aria-label="Remove image" onclick="removeRoomMoodTile('${room.id}',${ti})">×</button></div>`).join(''):`<p style="font-size:13px;color:var(--muted);">No images yet.</p>`;
  const tilesBox=mb.tiles&&mb.tiles.length?`<div class="mb-auto">${tiles}</div>`:tiles;
  return`<div style="margin-bottom:20px">
    <div class="flex-between mb14"><div style="font-family:var(--sans);font-size:16px;color:var(--muted)">Colour palette</div><button class="btn-ghost" onclick="openAddColor('${room.id}')">+ Add colour</button></div>
    <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:20px">${swatches}</div>
    <div class="flex-between mb14"><div style="font-family:var(--sans);font-size:16px;color:var(--muted)">Inspiration images</div><button class="btn-ghost" onclick="openAddRoomMoodTile('${room.id}')">+ Add image</button></div>
    ${tilesBox}
    ${mb.notes?`<div style="margin-top:14px;font-size:13px;color:var(--muted);">${mb.notes}</div>`:''}
  </div>`;
}

function openAddColor(roomId){
  const dropperBtn=typeof EyeDropper!=='undefined'?`<button class="btn-ghost" style="margin-bottom:14px;width:100%" onclick="useDropper('${roomId}')">Pick colour from screen</button>`:`<p style="font-size:12.5px;color:var(--muted);margin-bottom:14px;">Screen colour picker available in Chrome/Edge.</p>`;
  openModal(`<div class="modal-head"><div class="modal-title">Add colour</div><button class="modal-close" onclick="closeModal()">×</button></div>
    <label class="field-label">Colour picker</label>
    <input id="color-picker" type="color" value="#c9b89a" class="color-picker-input"/>
    ${dropperBtn}
    <label class="field-label">Or enter RAL number</label>
    <div class="ral-row mb14">
      <input id="ral-input" class="field-input" placeholder="e.g. 9010" style="margin-bottom:0" oninput="previewRal(this.value)"/>
      <div id="ral-preview" class="ral-preview-box"></div>
    </div>
    <div id="ral-name" style="font-size:12px;color:var(--muted);margin-bottom:14px;margin-top:-12px"></div>
    <label class="field-label">Colour name (optional)</label>
    <input id="color-name" class="field-input" placeholder="e.g. Cornish Cream…"/>
    <div class="modal-row">
      <button class="btn-solid sm" onclick="saveColor('${roomId}')">Add colour</button>
      <button class="btn-ghost" onclick="closeModal()">Cancel</button>
    </div>`);
}

function previewRal(val){
  const clean=val.trim().replace(/^RAL\s*/i,'');
  const hex=RAL[clean],name=RAL_NAMES[clean]||'';
  const preview=document.getElementById('ral-preview'),nameEl=document.getElementById('ral-name');
  if(preview)preview.style.background=hex||'transparent';
  if(nameEl)nameEl.textContent=hex?`RAL ${clean} — ${name}`:clean.length>=4?'RAL number not found':'';
}

function saveColor(roomId){
  const ralRaw=(document.getElementById('ral-input')?.value||'').trim().replace(/^RAL\s*/i,'');
  const pickerVal=document.getElementById('color-picker')?.value||'#808080';
  const nameVal=(document.getElementById('color-name')?.value||'').trim();
  let hex,ral=null,name=nameVal;
  if(ralRaw&&RAL[ralRaw]){hex=RAL[ralRaw];ral=ralRaw;if(!name)name=RAL_NAMES[ralRaw]||'';}
  else hex=pickerVal;
  const home=userData('home',{rooms:[]});const room=home.rooms.find(r=>r.id===roomId);if(!room)return;
  room.moodboard=room.moodboard||{colors:[],tiles:[],notes:''};
  room.moodboard.colors.push({id:uid(),hex,ral,name});
  saveData('home',home);closeModal();showSection('home');
}

function removeRoomColor(roomId,idx){
  const home=userData('home',{rooms:[]});const room=home.rooms.find(r=>r.id===roomId);
  if(room&&room.moodboard){room.moodboard.colors.splice(idx,1);saveData('home',home);}showSection('home');
}

async function useDropper(roomId){
  try{const dropper=new EyeDropper();const result=await dropper.open();const picker=document.getElementById('color-picker');if(picker)picker.value=result.sRGBHex;}catch(e){}
}

function openAddRoomMoodTile(roomId){
  const fi=document.getElementById('rm-tile-input');
  fi.onchange=e=>{
    Array.from(e.target.files).forEach(file=>{const r=new FileReader();r.onload=async ev=>{
      const id=uid();
      let thumb=ev.target.result,blob=null;
      try{const p=await processPhotoDataURL(ev.target.result);thumb=p.thumb;blob=p.blob;}catch(err){}
      const home=userData('home',{rooms:[]});const room=home.rooms.find(r=>r.id===roomId);if(!room)return;room.moodboard=room.moodboard||{colors:[],tiles:[],notes:''};room.moodboard.tiles=room.moodboard.tiles||[];room.moodboard.tiles.push({id,img:thumb,size:'md'});saveData('home',home);
      if(blob)await idbPutPhoto(id,blob);
      syncPhotosSoon();showSection('home');
    };r.readAsDataURL(file);});fi.value='';
  };fi.click();
}

function removeRoomMoodTile(roomId,idx){
  const home=userData('home',{rooms:[]});const room=home.rooms.find(r=>r.id===roomId);
  if(room&&room.moodboard){
    const removed=room.moodboard.tiles[idx];
    room.moodboard.tiles.splice(idx,1);saveData('home',home);
    if(removed){idbDeletePhoto(removed.id).catch(()=>{});deleteRemotePhoto(removed.id).catch(()=>{});}
  }
  showSection('home');
}

// ── FLOOR PLAN ──
function renderFloorPlanView(){
  const fp=userData('floorplan',{img:null,markers:[]});
  if(!fp.img)return`<div style="text-align:center;padding:48px 20px"><div style="font-size:48px;opacity:.3;margin-bottom:16px">🏠</div><p style="font-size:15px;color:var(--muted);margin-bottom:20px">Upload a floor plan image to get started</p><button class="btn-solid sm" onclick="document.getElementById('fp-file-input').click()">Upload floor plan</button><p style="font-size:12.5px;color:var(--muted);margin-top:12px;">Supports JPG and PNG</p></div>`;
  return`<div class="flex-between mb14"><p style="font-size:12px;color:var(--muted);">Tap an empty area to pin a room</p><div class="flex-center"><button class="btn-ghost" onclick="document.getElementById('fp-file-input').click()">Replace</button><button class="btn-ghost danger" onclick="clearFloorPlan()">Remove</button></div></div>
  <div class="fp-container" onclick="floorPlanClick(event)"><img src="${fp.img}" class="fp-img"/>${fp.markers.map(m=>`<div class="fp-marker" style="left:${m.x}%;top:${m.y}%" onclick="event.stopPropagation();navigateFromMarker('${m.roomId}')">${m.label.charAt(0).toUpperCase()}<div class="fp-label">${m.label}</div><button class="fp-del" onclick="event.stopPropagation();deleteMarker('${m.id}')">×</button></div>`).join('')}</div>`;
}
function floorPlanClick(e){if(e.target.closest('.fp-marker'))return;const rect=e.currentTarget.getBoundingClientRect();const x=((e.clientX-rect.left)/rect.width*100).toFixed(1);const y=((e.clientY-rect.top)/rect.height*100).toFixed(1);openAddMarkerModal(parseFloat(x),parseFloat(y));}
function openAddMarkerModal(x,y){const home=userData('home',{rooms:[]});if(!home.rooms.length){alert('Add some rooms first.');return;}openModal(`<div class="modal-head"><div class="modal-title">Pin a room</div><button class="modal-close" onclick="closeModal()">×</button></div><label class="field-label">Select room</label><select id="marker-room" class="field-input">${home.rooms.map(r=>`<option value="${r.id}">${r.name}</option>`).join('')}</select><div class="modal-row"><button class="btn-solid sm" onclick="saveMarker(${x},${y})">Add pin</button><button class="btn-ghost" onclick="closeModal()">Cancel</button></div>`);}
function saveMarker(x,y){const roomId=document.getElementById('marker-room').value;const home=userData('home',{rooms:[]});const room=home.rooms.find(r=>r.id===roomId);if(!room)return;const fp=userData('floorplan',{img:null,markers:[]});fp.markers.push({id:uid(),x,y,roomId,label:room.name});saveData('floorplan',fp);closeModal();showSection('home');}
function deleteMarker(markerId){const fp=userData('floorplan',{img:null,markers:[]});fp.markers=fp.markers.filter(m=>m.id!==markerId);saveData('floorplan',fp);showSection('home');}
function navigateFromMarker(roomId){activeRoomId=roomId;homeView='rooms';activeRoomTab='overview';showSection('home');}
function clearFloorPlan(){if(!confirm('Remove the floor plan?'))return;saveData('floorplan',{img:null,markers:[]});showSection('home');}

// ── HOME CRUD ──
function openAddRoom(){openModal(`<div class="modal-head"><div class="modal-title">Add room</div><button class="modal-close" onclick="closeModal()">×</button></div><label class="field-label">Room name</label><input id="new-room-name" class="field-input" placeholder="e.g. Living Room…"/><label class="field-label">Budget (optional)</label><input id="new-room-budget" class="field-input" type="number" placeholder="0.00" min="0" step="0.01"/><div class="modal-row"><button class="btn-solid sm" onclick="saveRoom()">Create room</button><button class="btn-ghost" onclick="closeModal()">Cancel</button></div>`);}
function saveRoom(){const name=document.getElementById('new-room-name').value.trim();if(!name)return;const budget=parseFloat(document.getElementById('new-room-budget').value)||0;const home=userData('home',{rooms:[]});const id=uid();home.rooms.push({id,name,budget,photos:[],items:[],moodboard:{colors:[],tiles:[],notes:''}});saveData('home',home);activeRoomId=id;activeRoomTab='overview';closeModal();showSection('home');}
function editRoomBudget(roomId){const home=userData('home',{rooms:[]});const room=home.rooms.find(r=>r.id===roomId);openModal(`<div class="modal-head"><div class="modal-title">Edit budget</div><button class="modal-close" onclick="closeModal()">×</button></div><label class="field-label">${room.name}</label><input id="edit-budget" class="field-input" type="number" value="${room.budget||0}" min="0" step="0.01"/><div class="modal-row"><button class="btn-solid sm" onclick="saveRoomBudget('${roomId}')">Save</button><button class="btn-ghost" onclick="closeModal()">Cancel</button></div>`);}
function saveRoomBudget(id){const home=userData('home',{rooms:[]});const room=home.rooms.find(r=>r.id===id);if(room){room.budget=parseFloat(document.getElementById('edit-budget').value)||0;saveData('home',home);}closeModal();showSection('home');}
function deleteRoom(roomId){if(!confirm('Delete this room and all its content?'))return;const home=userData('home',{rooms:[]});home.rooms=home.rooms.filter(r=>r.id!==roomId);activeRoomId=home.rooms.length?home.rooms[0].id:null;saveData('home',home);showSection('home');}
function openAddItem(roomId){openModal(`<div class="modal-head"><div class="modal-title">Add item</div><button class="modal-close" onclick="closeModal()">×</button></div><label class="field-label">Item name</label><input id="item-name" class="field-input" placeholder="e.g. IKEA Kallax"/><label class="field-label">Store</label><input id="item-store" class="field-input" placeholder="e.g. IKEA…"/><label class="field-label">Link</label><input id="item-link" class="field-input" type="url" placeholder="https://…"/><label class="field-label">Price</label><input id="item-price" class="field-input" type="number" placeholder="0.00" min="0" step="0.01"/><label class="field-label">Photo (optional)</label><button class="btn-ghost" onclick="pickItemPhoto()">Choose photo</button><img id="item-img-preview" style="display:none;max-height:120px;margin-top:8px"/><input type="file" id="item-file" accept="image/*" style="display:none"/><div class="modal-row" style="margin-top:14px"><button class="btn-solid sm" onclick="saveItem('${roomId}')">Add to room</button><button class="btn-ghost" onclick="closeModal()">Cancel</button></div>`);}
let itemImgData=null;
function pickItemPhoto(){itemImgData=null;const fi=document.getElementById('item-file');fi.onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{itemImgData=ev.target.result;const p=document.getElementById('item-img-preview');p.src=itemImgData;p.style.display='block';};r.readAsDataURL(f);};fi.click();}
function saveItem(roomId){const name=document.getElementById('item-name').value.trim();if(!name)return;const home=userData('home',{rooms:[]});const room=home.rooms.find(r=>r.id===roomId);if(!room)return;room.items=room.items||[];room.items.push({id:uid(),name,store:document.getElementById('item-store').value.trim(),link:document.getElementById('item-link').value.trim(),price:parseFloat(document.getElementById('item-price').value)||0,img:itemImgData||null});itemImgData=null;saveData('home',home);closeModal();showSection('home');}
function deleteItem(roomId,itemId){const home=userData('home',{rooms:[]});const room=home.rooms.find(r=>r.id===roomId);if(room){room.items=(room.items||[]).filter(i=>i.id!==itemId);saveData('home',home);}showSection('home');}

