// MAISON · wedding-recipes.js — plain script, shares globals with the other files in js/ (load order is set in index.html).
// ── WEDDING ──
// One page, no tabs. The top shows the wedding summary (countdown, date, venue, theme); below it sit FOLDERS, each its own mood board of
// photos plus notes and links. "Inspiration" is the built-in folder (it is the original wedding photo list, `w.inspo`, so nothing had to be
// migrated); every other folder lives in `w.folders` as {id,name,notes,links:[{id,title,url}],view,photos:[]}.
// weddingFolder: null = the folder list, 'inspo' or a folder id = that folder is open.
let weddingTab='inspo',weddingFolder=null;
function weddingData(){const w=userData('wedding',{inspo:[]});w.inspo=w.inspo||[];w.folders=w.folders||[];return w;}
// {name, photos (the live array), meta (the object holding notes/links/view), type/ctx for the photo helpers}
function wfRef(w,fid){
  if(fid==='inspo'){w.inspoMeta=w.inspoMeta||{notes:'',links:[],view:'grid'};return{id:'inspo',name:'Inspiration',photos:w.inspo,meta:w.inspoMeta,type:'wedding',ctx:'wedding',dest:'wedding'};}
  const f=w.folders.find(x=>x.id===fid);if(!f)return null;
  f.photos=f.photos||[];return{id:f.id,name:f.name,photos:f.photos,meta:f,type:'wedding_folder',ctx:f.id,dest:'wedding_'+f.id};
}
function wfVisible(photos){return(photos||[]).filter(p=>!p.archived);}
function renderWedding(main){
  const w=weddingData();
  if(weddingFolder&&!wfRef(w,weddingFolder))weddingFolder=null;
  main.innerHTML=weddingFolder?renderWeddingFolder(w):renderWeddingHome(w);
}
function weddingCountdown(w){
  if(!w.wdate)return null;
  const t=new Date(w.wdate+'T12:00:00'),now=new Date();now.setHours(12,0,0,0);
  const d=Math.round((t-now)/864e5);
  const dateStr=t.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  if(d>0)return{big:String(d),small:d===1?'day to go':'days to go',dateStr};
  if(d===0)return{big:'Today',small:'is the big day',dateStr};
  return{big:String(-d),small:-d===1?'day since the wedding':'days since the wedding',dateStr};
}
function renderWeddingHome(w){
  const cd=weddingCountdown(w),bits=[w.venue,w.theme].filter(Boolean).map(escHtml);
  const summary=(cd||bits.length||w.notes)
    ?`<div class="wd-summary"><div class="wd-sum-main">${cd?`<div class="wd-count">${cd.big}</div><div class="wd-count-sub">${cd.small}</div><div class="wd-date">${escHtml(cd.dateStr)}</div>`:''}${bits.length?`<div class="wd-bits">${bits.join(' · ')}</div>`:''}${w.notes?`<div class="wd-sum-notes">${escHtml(w.notes)}</div>`:''}</div><button class="btn-ghost" onclick="openWeddingDetails()">Edit</button></div>`
    :`<button class="wd-summary wd-summary-empty" onclick="openWeddingDetails()"><div><div class="wd-sum-title">Set your wedding details</div><div class="wd-sum-hint">Date, venue and theme, with a countdown</div></div><span class="area-chev">→</span></button>`;
  const cards=[{id:'inspo',name:'Inspiration',photos:w.inspo,meta:w.inspoMeta||{}}].concat(w.folders.map(f=>({id:f.id,name:f.name,photos:f.photos||[],meta:f}))).map(f=>{
    const vis=wfVisible(f.photos).slice().sort((a,b)=>(b.liked?1:0)-(a.liked?1:0)),n=vis.length,imgs=vis.slice(0,4);
    const cover=n?`<div class="wd-cover c${Math.min(imgs.length,4)}">${imgs.map(p=>`<img src="${p.img}" alt="" loading="lazy"/>`).join('')}</div>`:`<div class="wd-cover empty"><span>${escHtml((f.name||'?').charAt(0).toUpperCase())}</span></div>`;
    const extra=[(f.meta.links||[]).length?`${f.meta.links.length} link${f.meta.links.length!==1?'s':''}`:'',f.meta.notes?'notes':''].filter(Boolean).join(' · ');
    return`<button class="wd-folder" onclick="openWeddingFolder('${f.id}')">${cover}<div class="wd-folder-name">${escHtml(f.name)}</div><div class="wd-folder-meta">${n?n+' photo'+(n!==1?'s':''):'Empty'}${extra?' · '+extra:''}</div></button>`;
  }).join('');
  const oldBoards=userData('moodboards_wedding',[]);
  const oldRow=oldBoards.length?`<button class="area-row wd-old" onclick="mbArea='other';showSection('moodboards')"><div><div class="area-row-title" style="font-size:22px">Earlier mood boards</div><div class="area-row-meta">${oldBoards.length} board${oldBoards.length!==1?'s':''} you made before folders</div></div><span class="area-chev">→</span></button>`:'';
  return`<div class="section-rule"><div><div class="section-title">Wedding</div></div>${quickNotesBtn('wedding')}</div>
    ${summary}
    <div class="st-h"><span>Folders</span><button class="btn-ghost" onclick="openNewWeddingFolder()">+ New folder</button></div>
    <div class="wd-folders">${cards}<button class="wd-folder wd-new" onclick="openNewWeddingFolder()"><div class="wd-cover empty"><span>+</span></div><div class="wd-folder-name">New folder</div><div class="wd-folder-meta">Venue, flowers, dress…</div></button></div>
    ${oldRow}`;
}
function renderWeddingFolder(w){
  const f=wfRef(w,weddingFolder),m=f.meta,vis=wfVisible(f.photos),n=vis.length,links=m.links||[],view=m.view==='board'?'board':'grid';
  const isInspo=f.id==='inspo';
  let photosHtml;
  if(!n)photosHtml=`<div class="wd-empty"><div>No photos in this folder yet.</div><button class="btn-solid sm" onclick="triggerCapture()">+ Add photos</button></div>`;
  else if(view==='board'){
    const tiles=vis.slice().sort((a,b)=>(b.liked?1:0)-(a.liked?1:0)).map(p=>`<div class="mood-tile mb-t" onclick="viewPhoto('${p.id}','${f.type}','${f.ctx}')"><img src="${p.img}" alt=""/>${p.kind?`<span class="kind-badge">${p.kind==='video'?'▶ Video':'File'}</span>`:''}</div>`).join('');
    photosHtml=`<div class="mood-board mb-auto wd-board">${tiles}</div>`;
  }else photosHtml=renderPhotoGrid(f.photos,f.type,f.ctx);
  const linkRows=links.map(l=>`<div class="wd-link"><a href="${escHtml(l.url)}" target="_blank" rel="noopener"><span class="wd-link-title">${escHtml(l.title||l.url)}</span><span class="wd-link-url">${escHtml(l.url.replace(/^https?:\/\//i,''))}</span></a><button class="wd-link-x" aria-label="Remove link" onclick="wfRemoveLink('${l.id}')">×</button></div>`).join('');
  return`<div class="section-rule"><div><div class="section-title">${escHtml(f.name)}</div><div class="section-sub">${n} photo${n!==1?'s':''}</div></div><div class="flex-center">${isInspo?'':`<button class="btn-ghost" onclick="openEditWeddingFolder('${f.id}')">Edit</button>`}<button class="btn-solid sm" onclick="triggerCapture()">+ Add photos</button></div></div>
    <div class="st-h"><span>Photos</span>${n?`<span class="wd-seg"><button class="${view==='grid'?'active':''}" onclick="wfSetView('grid')">Grid</button><button class="${view==='board'?'active':''}" onclick="wfSetView('board')">Board</button></span>`:''}</div>
    ${photosHtml}
    ${n&&view==='grid'?`<div class="cl-hint">Press and hold a photo to move it to another folder.</div>`:''}
    <div class="st-h"><span>Notes</span></div>
    <textarea id="wf-notes" class="field-input" rows="4" placeholder="Ideas, supplier details, prices, things to ask…" onchange="wfSaveNotes()">${escHtml(m.notes||'')}</textarea>
    <div class="st-h"><span>Links</span><button class="btn-ghost" onclick="openAddWeddingLink()">+ Add link</button></div>
    ${linkRows}`;
}
function openWeddingFolder(id){weddingFolder=id;showSection('wedding');}
function wfSetView(v){const w=weddingData(),f=wfRef(w,weddingFolder);if(!f)return;f.meta.view=v;saveData('wedding',w);showSection('wedding');}
function wfSaveNotes(){const w=weddingData(),f=wfRef(w,weddingFolder),el=document.getElementById('wf-notes');if(!f||!el)return;f.meta.notes=el.value.trim();saveData('wedding',w);}
function openAddWeddingLink(){
  openModal(`<div class="modal-head"><div class="modal-title">Add link</div><button class="modal-close" onclick="closeModal()">×</button></div><label class="field-label">Title</label><input id="wl-title" class="field-input" placeholder="e.g. Florist quote…"/><label class="field-label">Web address</label><input id="wl-url" class="field-input" type="url" placeholder="https://…"/><div class="modal-row"><button class="btn-solid sm" onclick="wfSaveLink()">Add</button><button class="btn-ghost" onclick="closeModal()">Cancel</button></div>`);
}
function wfSaveLink(){
  let url=document.getElementById('wl-url').value.trim();if(!url)return;
  if(!/^https?:\/\//i.test(url))url='https://'+url;
  const title=document.getElementById('wl-title').value.trim();
  const w=weddingData(),f=wfRef(w,weddingFolder);if(!f)return;
  f.meta.links=f.meta.links||[];f.meta.links.push({id:uid(),title,url});saveData('wedding',w);closeModal();showSection('wedding');
}
function wfRemoveLink(id){const w=weddingData(),f=wfRef(w,weddingFolder);if(!f)return;f.meta.links=(f.meta.links||[]).filter(l=>l.id!==id);saveData('wedding',w);showSection('wedding');}
function openNewWeddingFolder(){
  openModal(`<div class="modal-head"><div class="modal-title">New folder</div><button class="modal-close" onclick="closeModal()">×</button></div><label class="field-label">Folder name</label><input id="wf-name" class="field-input" placeholder="e.g. Flowers, Venue, Dress, Cake…" autocomplete="off"/><div class="modal-row"><button class="btn-solid sm" onclick="saveNewWeddingFolder()">Create</button><button class="btn-ghost" onclick="closeModal()">Cancel</button></div>`);
  setTimeout(()=>{const el=document.getElementById('wf-name');if(el)el.focus();},50);
}
function saveNewWeddingFolder(){
  const name=document.getElementById('wf-name').value.trim();if(!name)return;
  const w=weddingData(),id=uid();w.folders.push({id,name,notes:'',links:[],view:'grid',photos:[]});
  if(!saveData('wedding',w))return;
  weddingFolder=id;closeModal();showSection('wedding');
}
function openEditWeddingFolder(id){
  const w=weddingData(),f=w.folders.find(x=>x.id===id);if(!f)return;
  openModal(`<div class="modal-head"><div class="modal-title">Edit folder</div><button class="modal-close" onclick="closeModal()">×</button></div><label class="field-label">Folder name</label><input id="wf-name" class="field-input" value="${escHtml(f.name)}" autocomplete="off"/><div class="modal-row"><button class="btn-solid sm" onclick="saveWeddingFolderName('${id}')">Save</button><button class="btn-ghost danger" onclick="deleteWeddingFolder('${id}')">Delete folder</button></div>`);
}
function saveWeddingFolderName(id){
  const name=document.getElementById('wf-name').value.trim();if(!name)return;
  const w=weddingData(),f=w.folders.find(x=>x.id===id);if(f){f.name=name;saveData('wedding',w);}
  closeModal();showSection('wedding');
}
function deleteWeddingFolder(id){
  const w=weddingData(),f=w.folders.find(x=>x.id===id);if(!f)return;
  const n=(f.photos||[]).length;
  if(!confirm(`Delete "${f.name}"${n?` and its ${n} photo${n!==1?'s':''}`:''}? This can't be undone.`))return;
  (f.photos||[]).forEach(p=>{idbDeletePhoto(p.id).catch(()=>{});deleteRemotePhoto(p.id).catch(()=>{});});
  w.folders=w.folders.filter(x=>x.id!==id);saveData('wedding',w);
  weddingFolder=null;closeModal();showSection('wedding');
}
function openWeddingDetails(){
  const w=weddingData();
  openModal(`<div class="modal-head"><div class="modal-title">Wedding details</div><button class="modal-close" onclick="closeModal()">×</button></div><label class="field-label">Wedding date</label><input id="w-date" class="field-input" type="date" value="${escHtml(w.wdate||'')}"/><label class="field-label">Venue</label><input id="w-venue" class="field-input" placeholder="The Grand Hotel…" value="${escHtml(w.venue||'')}"/><label class="field-label">Theme / aesthetic</label><input id="w-theme" class="field-input" placeholder="Garden romance…" value="${escHtml(w.theme||'')}"/><label class="field-label">Notes</label><textarea id="w-notes" class="field-input" rows="3">${escHtml(w.notes||'')}</textarea><div class="modal-row"><button class="btn-solid sm" onclick="saveWeddingDetails()">Save</button><button class="btn-ghost" onclick="closeModal()">Cancel</button></div>`);
}
function setWeddingTab(t){weddingFolder=null;showSection('wedding');}
function saveWeddingDetails(){const w=weddingData();w.wdate=document.getElementById('w-date').value;w.venue=document.getElementById('w-venue').value.trim();w.theme=document.getElementById('w-theme').value.trim();w.notes=document.getElementById('w-notes').value.trim();saveData('wedding',w);closeModal();showSection('wedding');}

// ── HONEYMOON ──
let activeHoneymoonRoomId=null,honeymoonTab='inspo';
function renderHoneymoon(main){
  const h=userData('honeymoon',{rooms:[],inspo:[],budget:0});
  const inspo=h.inspo||[],budget=h.budget||0;
  const spent=h.rooms.flatMap(r=>r.items||[]).reduce((s,i)=>s+(i.price||0),0)+inspo.reduce((s,p)=>s+(p.price||0),0);
  const pct=budget>0?Math.min(spent/budget*100,100):0,over=budget>0&&spent>budget;
  const tabs=['inspo','rooms','budget'].map(t=>`<button class="room-tab${honeymoonTab===t?' active':''}" onclick="setHoneymoonTab('${t}')">${t==='inspo'?'Inspiration':t==='rooms'?'Destinations':'Budget'}</button>`).join('');
  let content='';
  if(honeymoonTab==='inspo')content=renderPhotoGrid(inspo,'honeymoon_inspo','honeymoon');
  else if(honeymoonTab==='rooms'){
    let inner='';
    if(!h.rooms.length)inner=`<div class="empty"><div class="empty-icon">✈️</div>Add your first destination.</div>`;
    else{
      if(!activeHoneymoonRoomId||!h.rooms.find(r=>r.id===activeHoneymoonRoomId))activeHoneymoonRoomId=h.rooms[0].id;
      const room=h.rooms.find(r=>r.id===activeHoneymoonRoomId);
      const rSpent=(room.items||[]).reduce((s,i)=>s+(i.price||0),0)+(room.photos||[]).reduce((s,p)=>s+(p.price||0),0);
      const rPct=room.budget>0?Math.min(rSpent/room.budget*100,100):0,rOver=room.budget>0&&rSpent>room.budget;
      inner=`<div class="room-tabs-row">${h.rooms.map(r=>`<button class="room-tab${r.id===activeHoneymoonRoomId?' active':''}" onclick="setActiveHoneymoonRoom('${r.id}')">${r.name}</button>`).join('')}</div>
        <div class="budget-block"><div class="budget-row"><div><div class="budget-label">${room.name}</div><div class="budget-amount${rOver?' over':''}">£${rSpent.toLocaleString(undefined,{minimumFractionDigits:2})} / £${(room.budget||0).toLocaleString()}</div></div><button class="btn-ghost" onclick="editHoneymoonRoomBudget('${room.id}')">Edit</button></div><div class="bar-track"><div class="bar-fill${rOver?' over':''}" style="width:${rPct}%"></div></div><div class="bar-note${rOver?' over':''}">${rOver?'Over budget':'Remaining: £'+(room.budget-rSpent).toLocaleString(undefined,{minimumFractionDigits:2})}</div></div>
        <div class="flex-between mb14"><div style="font-family:var(--sans);font-size:15px;color:var(--muted)">Bookings</div><button class="btn-ghost" onclick="openAddHoneymoonItem('${room.id}')">+ Add</button></div>
        ${renderItemList(room.items||[],room.id)}<div style="margin-top:18px">${renderPhotoGrid(room.photos||[],'honeymoon_room',room.id)}</div>`;
    }
    content=`<div class="flex-between mb14"><div></div><div class="flex-center"><button class="btn-solid sm" onclick="openAddHoneymoonRoom()">+ Destination</button>${h.rooms.length?`<button class="btn-ghost danger" onclick="deleteHoneymoonRoom('${activeHoneymoonRoomId}')">Delete</button>`:''}</div></div>`+inner;
  } else {
    content=`<div class="budget-block"><div class="budget-row"><div><div class="budget-label">Total budget</div><div class="budget-amount${over?' over':''}">£${spent.toLocaleString(undefined,{minimumFractionDigits:2})} / £${budget.toLocaleString()}</div></div><button class="btn-ghost" onclick="editOverallHoneymoonBudget()">Edit</button></div><div class="bar-track"><div class="bar-fill${over?' over':''}" style="width:${pct}%"></div></div><div class="bar-note${over?' over':''}">${over?'Over budget':'Remaining: £'+(budget-spent).toLocaleString(undefined,{minimumFractionDigits:2})}</div></div><div style="margin-top:18px">${h.rooms.map(r=>{const rs=(r.items||[]).reduce((s,i)=>s+(i.price||0),0);return`<div class="item-row"><div class="item-body"><div class="item-name">${r.name}</div><div class="item-store">Budget: £${(r.budget||0).toLocaleString()}</div></div><div class="item-price">£${rs.toLocaleString(undefined,{minimumFractionDigits:2})}</div></div>`;}).join('')}</div>`;
  }
  main.innerHTML=`<div class="section-rule"><div><div class="section-title">Honeymoon</div></div>${quickNotesBtn('honeymoon')}</div><div class="room-tabs-row">${tabs}</div>${content}`;
}
function setHoneymoonTab(t){honeymoonTab=t;showSection('honeymoon');}
function setActiveHoneymoonRoom(id){activeHoneymoonRoomId=id;showSection('honeymoon');}
function openAddHoneymoonRoom(){openModal(`<div class="modal-head"><div class="modal-title">Add destination</div><button class="modal-close" onclick="closeModal()">×</button></div><label class="field-label">Destination</label><input id="new-hroom-name" class="field-input" placeholder="e.g. Santorini…"/><label class="field-label">Budget</label><input id="new-hroom-budget" class="field-input" type="number" placeholder="0.00" min="0" step="0.01"/><div class="modal-row"><button class="btn-solid sm" onclick="saveHoneymoonRoom()">Add</button><button class="btn-ghost" onclick="closeModal()">Cancel</button></div>`);}
function saveHoneymoonRoom(){const name=document.getElementById('new-hroom-name').value.trim();if(!name)return;const budget=parseFloat(document.getElementById('new-hroom-budget').value)||0;const h=userData('honeymoon',{rooms:[],inspo:[],budget:0});const id=uid();h.rooms.push({id,name,budget,photos:[],items:[]});saveData('honeymoon',h);activeHoneymoonRoomId=id;closeModal();showSection('honeymoon');}
function editHoneymoonRoomBudget(roomId){const h=userData('honeymoon',{rooms:[]});const room=h.rooms.find(r=>r.id===roomId);openModal(`<div class="modal-head"><div class="modal-title">Edit budget</div><button class="modal-close" onclick="closeModal()">×</button></div><label class="field-label">${room.name}</label><input id="edit-budget" class="field-input" type="number" value="${room.budget||0}" min="0" step="0.01"/><div class="modal-row"><button class="btn-solid sm" onclick="saveHoneymoonRoomBudget('${roomId}')">Save</button><button class="btn-ghost" onclick="closeModal()">Cancel</button></div>`);}
function saveHoneymoonRoomBudget(roomId){const h=userData('honeymoon',{rooms:[]});const room=h.rooms.find(r=>r.id===roomId);if(room){room.budget=parseFloat(document.getElementById('edit-budget').value)||0;saveData('honeymoon',h);}closeModal();showSection('honeymoon');}
function editOverallHoneymoonBudget(){const h=userData('honeymoon',{budget:0});openModal(`<div class="modal-head"><div class="modal-title">Overall budget</div><button class="modal-close" onclick="closeModal()">×</button></div><label class="field-label">Total budget</label><input id="edit-budget" class="field-input" type="number" value="${h.budget||0}" min="0" step="0.01"/><div class="modal-row"><button class="btn-solid sm" onclick="saveOverallHoneymoonBudget()">Save</button><button class="btn-ghost" onclick="closeModal()">Cancel</button></div>`);}
function saveOverallHoneymoonBudget(){const h=userData('honeymoon',{rooms:[],inspo:[],budget:0});h.budget=parseFloat(document.getElementById('edit-budget').value)||0;saveData('honeymoon',h);closeModal();showSection('honeymoon');}
function deleteHoneymoonRoom(roomId){if(!confirm('Delete this destination?'))return;const h=userData('honeymoon',{rooms:[]});h.rooms=h.rooms.filter(r=>r.id!==roomId);activeHoneymoonRoomId=h.rooms.length?h.rooms[0].id:null;saveData('honeymoon',h);showSection('honeymoon');}
function openAddHoneymoonItem(roomId){openModal(`<div class="modal-head"><div class="modal-title">Add booking</div><button class="modal-close" onclick="closeModal()">×</button></div><label class="field-label">Name</label><input id="hitem-name" class="field-input" placeholder="e.g. Hotel Caldera…"/><label class="field-label">Platform</label><input id="hitem-store" class="field-input" placeholder="e.g. Booking.com…"/><label class="field-label">Link</label><input id="hitem-link" class="field-input" type="url" placeholder="https://…"/><label class="field-label">Price</label><input id="hitem-price" class="field-input" type="number" placeholder="0.00" min="0" step="0.01"/><div class="modal-row"><button class="btn-solid sm" onclick="saveHoneymoonItem('${roomId}')">Add</button><button class="btn-ghost" onclick="closeModal()">Cancel</button></div>`);}
function saveHoneymoonItem(roomId){const name=document.getElementById('hitem-name').value.trim();if(!name)return;const h=userData('honeymoon',{rooms:[]});const room=h.rooms.find(r=>r.id===roomId);if(!room)return;room.items=room.items||[];room.items.push({id:uid(),name,store:document.getElementById('hitem-store').value.trim(),link:document.getElementById('hitem-link').value.trim(),price:parseFloat(document.getElementById('hitem-price').value)||0});saveData('honeymoon',h);closeModal();showSection('honeymoon');}

// ── RECIPES ──
let recipeFilter='All';
function renderRecipes(main){
  const r=userData('recipes',{items:[]});const allTags=['All',...new Set(r.items.flatMap(i=>i.tags||[]))];const filtered=recipeFilter==='All'?r.items:r.items.filter(i=>(i.tags||[]).includes(recipeFilter));
  main.innerHTML=`<div class="section-rule"><div><div class="section-title">Recipes</div></div><div class="flex-center">${quickNotesBtn('recipes')}<button class="btn-solid sm" onclick="openAddRecipe()">+ Add recipe</button></div></div><div class="tag-row">${allTags.map(t=>`<button class="tag-pill${recipeFilter===t?' active':''}" onclick="setRecipeFilter('${t}')">${t}</button>`).join('')}</div>${filtered.length?`<div class="recipe-grid">${filtered.map(item=>{
    const summary=item.text?`<div class="recipe-text">${escHtml(item.text.slice(0,180))}${item.text.length>180?'…':''}</div>`
      :((item.ingredients&&item.ingredients.length)?`<div class="recipe-text">${item.ingredients.length} ingredient${item.ingredients.length!==1?'s':''}${item.method&&item.method.length?` · ${item.method.length} step${item.method.length!==1?'s':''}`:''}</div>`:'');
    return`<div class="recipe-card">${item.img?`<img class="recipe-img" src="${item.img}" loading="lazy" onclick="viewRecipe('${item.id}')"/>`:''}<div class="recipe-body">${(item.tags||[]).map(t=>`<span class="recipe-tag">${escHtml(t)}</span>`).join('')}<div class="recipe-title">${escHtml(item.title)}</div>${summary}<div class="flex-center" style="margin-top:10px"><button class="btn-ghost" style="font-size:12px;padding:4px 12px" onclick="viewRecipe('${item.id}')">View</button><button class="btn-ghost danger" style="font-size:12px;padding:4px 12px" onclick="deleteRecipe('${item.id}')">Delete</button></div></div></div>`;
  }).join('')}</div>`:`<div class="empty"><div class="empty-icon">🍽</div>No recipes yet.</div>`}`;
}
function setRecipeFilter(f){recipeFilter=f;showSection('recipes');}
function parseIngredientLines(text){return text.split('\n').map(l=>l.replace(/^\s*[-•*]\s*/,'').trim()).filter(Boolean);}
function parseMethodLines(text){
  let lines=text.split('\n').map(l=>l.trim()).filter(Boolean);
  if(lines.length<=1){
    const chunks=text.split(/(?=\d+[\.\)]\s)/).map(l=>l.trim()).filter(Boolean);
    if(chunks.length>1)lines=chunks;
  }
  return lines.map(l=>l.replace(/^\s*(\d+[\.\)]|step\s*\d+[:\.]?)\s*/i,'').trim()).filter(Boolean);
}
function parseIngredientLine(line){
  const m=line.match(/^\s*(\d+\s+\d+\/\d+|\d+\/\d+|\d+\.\d+|\d+)\s*(.*)$/);
  if(!m)return{qty:null,rest:line.trim()};
  const qtyStr=m[1];let qty;
  if(qtyStr.includes(' ')){const[whole,frac]=qtyStr.split(' ');const[n,d]=frac.split('/').map(Number);qty=Number(whole)+n/d;}
  else if(qtyStr.includes('/')){const[n,d]=qtyStr.split('/').map(Number);qty=n/d;}
  else qty=parseFloat(qtyStr);
  return{qty,rest:m[2].trim()};
}
function formatQty(n){
  if(n==null)return'';
  const whole=Math.floor(n),frac=n-whole;
  const fracMap=[[0.125,'⅛'],[0.166,'⅙'],[0.2,'⅕'],[0.25,'¼'],[0.333,'⅓'],[0.375,'⅜'],[0.4,'⅖'],[0.5,'½'],[0.6,'⅗'],[0.625,'⅝'],[0.666,'⅔'],[0.75,'¾'],[0.8,'⅘'],[0.833,'⅚'],[0.875,'⅞']];
  let closest=null,closestDiff=0.02;
  for(const[val,sym]of fracMap){const diff=Math.abs(frac-val);if(diff<closestDiff){closest=sym;closestDiff=diff;}}
  if(closest)return whole>0?`${whole}${closest}`:closest;
  return String(Math.round(n*100)/100);
}
function openAddRecipe(editId){
  const r=userData('recipes',{items:[]});
  const item=editId?r.items.find(i=>i.id===editId):null;
  recipeImgData=item?(item.img||null):null;
  openModal(`<div class="modal-head"><div class="modal-title">${item?'Edit Recipe':'Add Recipe'}</div><button class="modal-close" onclick="closeModal()">×</button></div>
    <label class="field-label">Recipe name</label><input id="rec-title" class="field-input" placeholder="e.g. Roast Chicken…" value="${item?escHtml(item.title):''}"/>
    <label class="field-label">Tags (comma separated)</label><input id="rec-tags" class="field-input" placeholder="Dinner, Italian…" value="${item?escHtml((item.tags||[]).join(', ')):''}"/>
    <label class="field-label">Servings</label><input id="rec-servings" type="number" min="1" class="field-input" style="max-width:100px" value="${item&&item.servings?item.servings:4}"/>
    <label class="field-label">Ingredients <span style="text-transform:none;letter-spacing:0;color:var(--muted)">— one per line, e.g. "200g flour"</span></label>
    <textarea id="rec-ingredients" class="field-input" rows="6" placeholder="200g plain flour&#10;2 eggs&#10;1 tsp vanilla extract">${item?escHtml((item.ingredients||[]).join('\n')):''}</textarea>
    <label class="field-label">Method <span style="text-transform:none;letter-spacing:0;color:var(--muted)">— paste instructions, each line becomes a numbered step</span></label>
    <textarea id="rec-method" class="field-input" rows="8" placeholder="Preheat the oven to 180°C.&#10;Mix the flour and sugar together.">${item?escHtml((item.method||[]).join('\n')):''}</textarea>
    <label class="field-label">Tips <span style="text-transform:none;letter-spacing:0;color:var(--muted)">— optional</span></label>
    <textarea id="rec-tips" class="field-input" rows="3" placeholder="Any variations, storage notes…">${item?escHtml(item.tips||''):''}</textarea>
    <label class="field-label">Photo (optional)</label><button class="btn-ghost" onclick="pickRecipePhoto()">Choose photo</button>
    <img id="rec-img-preview" style="display:${recipeImgData?'block':'none'};max-height:140px;margin-top:8px" ${recipeImgData?`src="${recipeImgData}"`:''}/>
    <input type="file" id="rec-file" accept="image/*" style="display:none"/>
    <div class="modal-row" style="margin-top:14px"><button class="btn-solid sm" onclick="saveRecipe(${item?`'${item.id}'`:'null'})">Save recipe</button><button class="btn-ghost" onclick="closeModal()">Cancel</button></div>`);
}
let recipeImgData=null,recipeFullBlobPending=null;
function pickRecipePhoto(){const fi=document.getElementById('rec-file');fi.onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=async ev=>{
  try{const{thumb,blob}=await processPhotoDataURL(ev.target.result);recipeImgData=thumb;recipeFullBlobPending=blob;}
  catch(err){recipeImgData=ev.target.result;recipeFullBlobPending=null;}
  const p=document.getElementById('rec-img-preview');if(p){p.src=recipeImgData;p.style.display='block';}
};r.readAsDataURL(f);};fi.click();}
async function saveRecipe(editId){
  const title=document.getElementById('rec-title').value.trim();if(!title)return;
  const tags=document.getElementById('rec-tags').value.split(',').map(t=>t.trim()).filter(Boolean);
  const servings=parseInt(document.getElementById('rec-servings').value,10)||4;
  const ingredients=parseIngredientLines(document.getElementById('rec-ingredients').value);
  const method=parseMethodLines(document.getElementById('rec-method').value);
  const tips=document.getElementById('rec-tips').value.trim();
  const r=userData('recipes',{items:[]});
  let finalId=editId;
  if(editId){
    const item=r.items.find(i=>i.id===editId);
    if(item)Object.assign(item,{title,tags,servings,ingredients,method,tips,img:recipeImgData||null});
  }else{
    finalId=uid();
    r.items.push({id:finalId,title,tags,servings,ingredients,method,tips,img:recipeImgData||null,date:Date.now(),photos:[]});
  }
  saveData('recipes',r);
  if(recipeFullBlobPending&&finalId)await idbPutPhoto(finalId,recipeFullBlobPending);
  recipeImgData=null;recipeFullBlobPending=null;
  closeModal();showSection('recipes');
  syncPhotosSoon();
}
function viewRecipe(id,overrideServings){
  const item=userData('recipes',{items:[]}).items.find(i=>i.id===id);if(!item)return;
  const baseServings=item.servings||4;
  const curServings=overrideServings||baseServings;
  const multiplier=curServings/baseServings;
  const ingredients=item.ingredients||[];
  const method=item.method||[];
  const hasStructured=ingredients.length||method.length;
  const ingredientsHtml=ingredients.length?`<div style="margin-top:18px">
    <div class="recipe-section-label">Ingredients</div>
    <div class="serving-adjust">
      <button class="serving-btn" onclick="viewRecipe('${id}',${Math.max(1,curServings-1)})">−</button>
      <span class="serving-count">${curServings} serving${curServings!==1?'s':''}</span>
      <button class="serving-btn" onclick="viewRecipe('${id}',${curServings+1})">+</button>
    </div>
    <ul class="ingredient-list">${ingredients.map(line=>{const{qty,rest}=parseIngredientLine(line);const display=qty!=null?`${formatQty(qty*multiplier)} ${rest}`:rest;return`<li>${escHtml(display)}</li>`;}).join('')}</ul>
  </div>`:'';
  const methodHtml=method.length?`<div style="margin-top:18px"><div class="recipe-section-label">Method</div><ol class="method-list">${method.map(step=>`<li>${escHtml(step)}</li>`).join('')}</ol></div>`:'';
  const tipsHtml=item.tips?`<div style="margin-top:18px"><div class="recipe-section-label">Tips</div><p style="font-size:14px;line-height:1.7;color:var(--muted);white-space:pre-wrap">${escHtml(item.tips)}</p></div>`:'';
  const legacyHtml=(!hasStructured&&item.text)?`<div style="margin-top:12px;font-size:15px;line-height:1.75;white-space:pre-wrap">${escHtml(item.text)}</div>`:'';
  const extraPhotos=item.photos||[];
  const photosHtml=extraPhotos.length?`<div style="margin-top:16px"><div class="recipe-section-label">Extra photos</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:6px">${extraPhotos.map((p,i)=>`<div style="position:relative;aspect-ratio:1;overflow:hidden;background:var(--bone);border:1px solid var(--bone)"><img src="${p.img}" style="width:100%;height:100%;object-fit:cover;display:block"/><button onclick="deleteRecipePhoto('${id}',${i})" style="position:absolute;top:3px;right:3px;background:rgba(168,32,32,.85);border:none;color:#fff;width:18px;height:18px;font-size:12px;cursor:pointer;line-height:1">×</button></div>`).join('')}</div></div>`:'';
  const cookToggleHtml=`<button class="cook-toggle${cookModeOn?' on':''}" onclick="toggleCookMode('${id}',${curServings})"><span class="cook-toggle-dot"></span>Cook Mode${cookModeOn?' — Screen Staying On':''}</button>`;
  openModal(`<div class="modal-head"><div class="modal-title">${escHtml(item.title)}</div><button class="modal-close" onclick="closeModal()">×</button></div>${cookToggleHtml}${item.img?`<img src="${item.img}" class="modal-preview" style="margin-top:12px"/>`:''}${legacyHtml}${ingredientsHtml}${methodHtml}${tipsHtml}<input type="file" id="rec-extra-photo" accept="image/*" style="display:none"/>${photosHtml}<div class="modal-row" style="margin-top:16px"><button class="btn-ghost" onclick="closeModal();openAddRecipe('${id}')">Edit</button><button class="btn-ghost" onclick="addPhotoToRecipe('${id}')">Add photo</button><button class="btn-ghost danger" onclick="deleteRecipe('${id}');closeModal()">Delete</button></div>`);
}
function addPhotoToRecipe(recipeId){
  const fi=document.getElementById('rec-extra-photo');if(!fi)return;
  fi.onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=async ev=>{
    const id=uid();
    let thumb=ev.target.result,blob=null;
    try{const p=await processPhotoDataURL(ev.target.result);thumb=p.thumb;blob=p.blob;}catch(err){}
    const rec=userData('recipes',{items:[]});const item=rec.items.find(i=>i.id===recipeId);if(!item)return;
    item.photos=item.photos||[];item.photos.push({id,img:thumb,date:Date.now(),liked:false,archived:false});saveData('recipes',rec);
    if(blob)await idbPutPhoto(id,blob);
    syncPhotosSoon();viewRecipe(recipeId);
  };r.readAsDataURL(f);fi.value='';};fi.click();
}
function deleteRecipePhoto(recipeId,idx){
  const rec=userData('recipes',{items:[]});const item=rec.items.find(i=>i.id===recipeId);
  if(item&&item.photos){const removed=item.photos[idx];item.photos.splice(idx,1);saveData('recipes',rec);if(removed){idbDeletePhoto(removed.id).catch(()=>{});deleteRemotePhoto(removed.id).catch(()=>{});}}
  viewRecipe(recipeId);
}
function deleteRecipe(id){
  if(!confirm('Delete this recipe?'))return;
  const r=userData('recipes',{items:[]});
  const item=r.items.find(i=>i.id===id);
  if(item){
    if(item.img){idbDeletePhoto(item.id).catch(()=>{});deleteRemotePhoto(item.id).catch(()=>{});}
    (item.photos||[]).forEach(p=>{idbDeletePhoto(p.id).catch(()=>{});deleteRemotePhoto(p.id).catch(()=>{});});
  }
  r.items=r.items.filter(i=>i.id!==id);saveData('recipes',r);showSection('recipes');
}

