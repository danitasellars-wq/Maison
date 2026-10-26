// MAISON · app.js — plain script, shares globals with the other files in js/ (load order is set in index.html).
// ── NAV ──
// Home screen → three areas → pages. To regroup pages edit AREAS, SECTION_AREA and areaRows().
// Screens: 'dashboard' (home) · 'area_house|closet|other' (page lists) · 'moodboards' · the existing pages
// ('home' = rooms/floor plan, 'wedding', 'honeymoon', 'dayout', 'recipes', 'music', 'closet').
const AREAS={
  house:{name:'House planning',short:'House',sub:'Rooms, budgets & your floor plan.'},
  closet:{name:'Closet',short:'Closet',sub:'Wardrobe, outfits, calendar & packing.'},
  other:{name:'Other',short:'Other',sub:'Wedding, honeymoon, days out, recipes & music.'},
};
const SECTION_AREA={home:'house',closet:'closet',wedding:'other',honeymoon:'other',dayout:'other',event:'other',recipes:'other',music:'other'};
let lastShown=null,mbArea='house';
const ICON_CAM=`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>`;
const ICON_PHOTOS=`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`;
const ICON_MOOD=`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>`;
function areaOf(s){
  if(!s||s==='dashboard')return null;
  if(s.indexOf('area_')===0)return s.slice(5);
  if(s==='moodboards')return mbArea;
  return SECTION_AREA[s]||null;
}
// Background refreshes (a sync finishing, photos arriving, an event updating) must never rebuild the screen while you are typing: that
// removes the box you are typing in and closes the phone keyboard. They wait until you leave the field, then run.
let pendingSectionRefresh=false;
function userIsTyping(){
  const a=document.activeElement;if(!a)return false;
  if(a.tagName==='TEXTAREA'||a.tagName==='SELECT')return true;
  return a.tagName==='INPUT'&&!/^(checkbox|radio|button|submit|range|color|file)$/.test(a.type);
}
function refreshSection(){
  if(userIsTyping()){pendingSectionRefresh=true;return;}
  pendingSectionRefresh=false;showSection(currentSection);
}
document.addEventListener('focusout',()=>{if(!pendingSectionRefresh)return;setTimeout(()=>{if(pendingSectionRefresh&&!userIsTyping())refreshSection();},400);});
function showSection(s){
  const changed=s!==lastShown;lastShown=s;currentSection=s;
  applyAppearance();
  if(s!=='event'){evStopPoll();evMapDestroy();}
  applyWallpaper();
  const main=document.getElementById('main-content');
  if(s==='dashboard')renderDashboard(main);
  else if(s.indexOf('area_')===0)renderArea(main,s.slice(5));
  else if(s==='moodboards')renderMoodBoards(main);
  else if(s==='home')renderHome(main);
  else if(s==='wedding')renderWedding(main);
  else if(s==='honeymoon')renderHoneymoon(main);
  else if(s==='dayout')renderDayOut(main);
  else if(s==='event')renderEvent(main);
  else if(s==='recipes')renderRecipes(main);
  else if(s==='music')renderMusic(main);
  else if(s==='closet')renderCloset(main);
  renderHeaderNav();renderDock();
  if(changed)window.scrollTo(0,0);
}
// Header back button: page → its area → home. Inside Closet it also steps out of the outfit editor / a packing list.
function backLabel(){
  const s=currentSection;
  if(s==='dashboard')return null;
  if(s.indexOf('area_')===0)return'Home';
  if(s==='closet'){if(closetOutfitId&&outfitDraft)return'Outfits';if(closetTab==='packing'&&closetPackId)return'Packing';}
  if(s==='event')return evDay?'Calendar':'Days out';
  const a=areaOf(s);return a?AREAS[a].short:'Home';
}
function renderHeaderNav(){
  const b=document.getElementById('hdr-back');if(!b)return;
  const lab=backLabel();b.classList.toggle('show',!!lab);
  if(lab)document.getElementById('hdr-back-label').textContent=lab;
}
function goBack(){
  const s=currentSection;
  if(s==='dashboard')return;
  if(s.indexOf('area_')===0){showSection('dashboard');return;}
  if(s==='event'){if(evDay){evDay=null;showSection('event');window.scrollTo(0,0);}else{activeEventId=null;showSection('dayout');}return;}
  if(s==='closet'){
    if(closetOutfitId&&outfitDraft){clCloseEditor();return;}
    if(closetTab==='packing'&&closetPackId){clClosePack();return;}
    clFinishEditor();
  }
  showSection('area_'+(areaOf(s)||'house'));
}
// Bottom dock: just the camera on the home screen; All photos · Camera · Mood board inside an area.
function renderDock(){
  const d=document.getElementById('camera-dock');if(!d)return;
  if(currentSection==='closet'&&closetOutfitId&&outfitDraft){d.style.display='none';return;}
  d.style.display='';
  const cam=`<div class="cam-wrap"><button class="cam-btn" onclick="triggerCapture()" aria-label="Capture photo">${ICON_CAM}</button><div class="cam-label">Capture</div></div>`;
  if(currentSection==='dashboard'){d.className='solo';d.innerHTML=cam;return;}
  d.className='';
  d.innerHTML=`<div class="cam-wrap"><button class="cam-btn photos" onclick="openAreaPhotos()" aria-label="All photos">${ICON_PHOTOS}</button><div class="cam-label">Photos</div></div>${cam}<div class="cam-wrap"><button class="cam-btn mood" onclick="openAreaMood()" aria-label="Mood boards">${ICON_MOOD}</button><div class="cam-label">Mood board</div></div>`;
}
function openAreaPhotos(){
  const a=areaOf(currentSection);
  if(a==='closet'){clSetTab('wardrobe');return;}   // the closet's own photo store
  openSidePanel(a||'all');
}
function openAreaMood(){mbArea=areaOf(currentSection)||'house';showSection('moodboards');}
// Area screens: a plain list of the area's pages.
function areaRows(a){
  const R=(title,meta,go)=>({title,meta,go});
  const n=(k,w)=>`${k} ${w}${k!==1?'s':''}`;
  if(a==='house'){
    const home=userData('home',{rooms:[]}),fp=userData('floorplan',{img:null});
    const spent=home.rooms.reduce((s,r)=>s+(r.items||[]).reduce((x,i)=>x+(i.price||0),0)+(r.photos||[]).filter(p=>!p.archived).reduce((x,p)=>x+(p.price||0),0),0);
    return[
      R('Rooms',home.rooms.length?n(home.rooms.length,'room')+(spent?` · ${clMoney(spent)}`:''):'Add your first room',"setHomeView('rooms')"),
      R('Floor plan',fp.img?'Tap the plan to pin rooms':'Upload a floor plan',"setHomeView('floorplan')"),
    ];
  }
  if(a==='closet'){
    const c=closetData(),days=Object.keys(c.calendar).length,total=c.items.reduce((s,i)=>s+(i.price||0),0);
    return[
      R('Wardrobe',c.items.length?n(c.items.length,'piece'):'Add your first piece',"clSetTab('wardrobe')"),
      R('Outfits',c.outfits.length?n(c.outfits.length,'outfit'):'Build flat-lay outfits',"clSetTab('outfits')"),
      R('Calendar',days?n(days,'day')+' planned or logged':'Plan what to wear',"clSetTab('calendar')"),
      R('Shuffle','Mix tops, bottoms & shoes',"clSetTab('shuffle')"),
      R('Stats',c.items.length&&total?`${clMoney(total)} · cost per wear`:'Cost per wear & utilisation',"clSetTab('stats')"),
      R('Packing',c.packing.length?n(c.packing.length,'list'):'Trip & capsule lists',"clSetTab('packing')"),
    ];
  }
  const w=userData('wedding',{inspo:[]}),h=userData('honeymoon',{rooms:[]}),d=userData('dayout',{plans:[]}),rec=userData('recipes',{items:[]}),mu=userData('music',{playlists:[]});
  const wP=(w.inspo||[]).filter(p=>!p.archived).length,songs=mu.playlists.reduce((s,p)=>s+(p.songs||[]).length,0);
  return[
    R('Wedding',w.wdate?new Date(w.wdate+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}):(wP?n(wP,'photo'):'Inspiration & details'),"showSection('wedding')"),
    R('Honeymoon',h.rooms.length?n(h.rooms.length,'destination'):'Plan your trip',"showSection('honeymoon')"),
    R('Days out',d.plans.length?n(d.plans.length,'plan'):'Plan a day out',"showSection('dayout')"),
    R('Recipes',rec.items.length?n(rec.items.length,'recipe'):'Save your first',"showSection('recipes')"),
    R('Music',mu.playlists.length?n(mu.playlists.length,'playlist')+(songs?' · '+n(songs,'song'):''):'Create a playlist',"showSection('music')"),
  ];
}
function renderArea(main,a){
  const info=AREAS[a];if(!info){showSection('dashboard');return;}
  main.innerHTML=`<div class="section-rule"><div><div class="section-title">${info.name}</div><div class="section-sub">${info.sub}</div></div></div>
    <div class="area-list">${areaRows(a).map(r=>`<button class="area-row" onclick="${r.go}"><div><div class="area-row-title">${r.title}</div><div class="area-row-meta">${r.meta}</div></div><span class="area-chev">→</span></button>`).join('')}</div>`;
}

// ── MODAL ──
function openModal(html){document.getElementById('modal-box').innerHTML=html;document.getElementById('modal').style.display='flex';}
function closeModal(){document.getElementById('modal').style.display='none';document.getElementById('modal-box').innerHTML='';if(wakeLock){wakeLock.release().catch(()=>{});wakeLock=null;}cookModeOn=false;}

// ── COOK MODE (keeps screen awake) ──
let wakeLock=null,cookModeOn=false;
async function toggleCookMode(id,servings){
  const turningOn=!cookModeOn;
  if(turningOn){
    try{
      if(!('wakeLock' in navigator))throw new Error("This browser doesn't support keeping the screen awake.");
      wakeLock=await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release',()=>{wakeLock=null;});
      cookModeOn=true;
    }catch(e){
      cookModeOn=false;
      alert('Could not keep the screen awake: '+(e&&e.message?e.message:e));
    }
  }else{
    cookModeOn=false;
    if(wakeLock){wakeLock.release().catch(()=>{});wakeLock=null;}
  }
  viewRecipe(id,servings);
}
document.addEventListener('visibilitychange',async()=>{
  if(cookModeOn&&document.visibilityState==='visible'&&!wakeLock&&'wakeLock' in navigator){
    try{wakeLock=await navigator.wakeLock.request('screen');}catch(e){}
  }
});

// ── SIDE PANEL ──
// The gallery opens scoped to the area you're in (house / other); scope 'all' is every photo in Maison.
let panelScope='all';
const PANEL_SCOPE_SECTIONS={house:['home'],other:['wedding','honeymoon','dayout','recipes']};
const PANEL_CHIPS={
  all:[['all','All'],['liked','♥ Liked'],['home','Home'],['wedding','Wedding'],['honeymoon','Honeymoon'],['recipes','Recipes'],['dayout','Days out'],['closet','Closet'],['archived','Archived']],
  house:[['all','All'],['liked','♥ Liked'],['archived','Archived']],
  other:[['all','All'],['liked','♥ Liked'],['wedding','Wedding'],['honeymoon','Honeymoon'],['recipes','Recipes'],['dayout','Days out'],['archived','Archived']],
};
function openSidePanel(scope){
  panelScope=PANEL_CHIPS[scope]?scope:'all';panelFilter='all';panelMode='photos';
  document.querySelectorAll('.panel-mode-tab').forEach(b=>b.classList.toggle('active',b.id==='pmt-photos'));
  renderPanelHead();renderSidePanel();
  document.getElementById('side-panel').classList.add('open');document.getElementById('panel-overlay').classList.add('open');document.body.style.overflow='hidden';
}
function closeSidePanel(){document.getElementById('side-panel').classList.remove('open');document.getElementById('panel-overlay').classList.remove('open');document.body.style.overflow='';}
function renderPanelHead(){
  const t=document.querySelector('#side-panel .panel-title');
  if(t)t.textContent=panelScope==='all'?'All photos':AREAS[panelScope].name;
  const row=document.getElementById('panel-filter-row');if(!row)return;
  row.style.display=panelMode==='photos'?'flex':'none';
  row.innerHTML=PANEL_CHIPS[panelScope].map(([k,l])=>`<button class="panel-filter${panelFilter===k?' active':''}${k==='archived'?' arch-filter':''}" onclick="setPanelFilter('${k}')">${l}</button>`).join('')
    +(panelScope!=='all'?`<button class="panel-filter" style="margin-left:auto" onclick="setPanelScope('all')">Everything</button>`:'');
}
function setPanelScope(sc){panelScope=sc;panelFilter='all';renderPanelHead();renderSidePanel();}
function setPanelFilter(f){panelFilter=f;renderPanelHead();renderSidePanel();}
function getAllPhotos(archivedOnly=false){
  const all=[];
  const home=userData('home',{rooms:[]});
  home.rooms.forEach(r=>(r.photos||[]).filter(p=>archivedOnly?p.archived===true:!p.archived).forEach(p=>all.push({photo:p,type:'home_room',contextId:r.id,label:r.name,sectionKey:'home'})));
  const w=userData('wedding',{inspo:[]});
  (w.inspo||[]).filter(p=>archivedOnly?p.archived===true:!p.archived).forEach(p=>all.push({photo:p,type:'wedding',contextId:'wedding',label:'Wedding',sectionKey:'wedding'}));
  const h=userData('honeymoon',{rooms:[],inspo:[]});
  (h.inspo||[]).filter(p=>archivedOnly?p.archived===true:!p.archived).forEach(p=>all.push({photo:p,type:'honeymoon_inspo',contextId:'honeymoon',label:'Honeymoon',sectionKey:'honeymoon'}));
  h.rooms.forEach(r=>(r.photos||[]).filter(p=>archivedOnly?p.archived===true:!p.archived).forEach(p=>all.push({photo:p,type:'honeymoon_room',contextId:r.id,label:r.name,sectionKey:'honeymoon'})));
  const d=userData('dayout',{plans:[]});
  d.plans.forEach(pl=>(pl.photos||[]).filter(p=>archivedOnly?p.archived===true:!p.archived).forEach(p=>all.push({photo:p,type:'dayout_plan',contextId:pl.id,label:pl.name,sectionKey:'dayout'})));
  const rec=userData('recipes',{items:[]});
  rec.items.forEach(item=>(item.photos||[]).filter(p=>archivedOnly?p.archived===true:!p.archived).forEach(p=>all.push({photo:p,type:'recipe_photo',contextId:item.id,label:item.title||'Recipe',sectionKey:'recipes'})));
  return all;
}
function renderSidePanel(){
  if(panelMode==='links'){renderSidePanelLinks();return;}
  const isArchived=panelFilter==='archived';
  let all=getAllPhotos(isArchived);
  const scopeSecs=PANEL_SCOPE_SECTIONS[panelScope];if(scopeSecs)all=all.filter(e=>scopeSecs.includes(e.sectionKey));
  if(panelFilter==='closet')all=[];
  else if(panelFilter==='liked')all=all.filter(e=>e.photo.liked);
  else if(panelFilter==='home')all=all.filter(e=>e.sectionKey==='home');
  else if(panelFilter==='wedding')all=all.filter(e=>e.sectionKey==='wedding');
  else if(panelFilter==='honeymoon')all=all.filter(e=>e.sectionKey==='honeymoon');
  else if(panelFilter==='dayout')all=all.filter(e=>e.sectionKey==='dayout');
  else if(panelFilter==='recipes')all=all.filter(e=>e.sectionKey==='recipes');
  const body=document.getElementById('panel-body');
  const closetHtml=(!isArchived&&panelScope==='all'&&(panelFilter==='all'||panelFilter==='closet'))?panelClosetHTML():'';
  if(!all.length&&!closetHtml){body.innerHTML=`<div class="panel-empty">${isArchived?'No archived photos.':'No photos yet.'}</div>`;return;}
  if(isArchived){
    const groups={};all.forEach(e=>{if(!groups[e.label])groups[e.label]=[];groups[e.label].push(e);});
    body.innerHTML=Object.entries(groups).map(([l,items])=>`<div class="panel-section-label">${l}</div><div class="panel-grid">${items.map(e=>panelPhotoCard(e,true)).join('')}</div>`).join('');return;
  }
  const liked=all.filter(e=>e.photo.liked),rest=all.filter(e=>!e.photo.liked);
  let html='';
  if(liked.length&&panelFilter!=='liked')html+=`<div class="panel-pinned-label"><span>♥</span> Favourites</div><div class="panel-grid">${liked.map(e=>panelPhotoCard(e)).join('')}</div>`;
  if(rest.length){
    if(liked.length&&panelFilter!=='liked')html+=`<div class="panel-section-label" style="margin-top:18px">All photos</div>`;
    const groups={};rest.forEach(e=>{if(!groups[e.label])groups[e.label]=[];groups[e.label].push(e);});
    Object.entries(groups).forEach(([l,items])=>{
      if(['all','liked'].includes(panelFilter))html+=`<div class="panel-section-label">${l}</div>`;
      html+=`<div class="panel-grid">${items.map(e=>panelPhotoCard(e)).join('')}</div>`;
    });
  }
  if(panelFilter==='liked'&&liked.length){const groups={};liked.forEach(e=>{if(!groups[e.label])groups[e.label]=[];groups[e.label].push(e);});html=Object.entries(groups).map(([l,items])=>`<div class="panel-section-label">${l}</div><div class="panel-grid">${items.map(e=>panelPhotoCard(e)).join('')}</div>`).join('');}
  body.innerHTML=html+closetHtml;
}
// Closet pieces appear in the everything-view too (read-only here; manage them in Closet → Wardrobe).
function panelClosetHTML(){
  const items=closetData().items.slice().sort((a,b)=>(b.date||0)-(a.date||0));
  if(!items.length)return'';
  return`<div class="panel-section-label"${panelFilter==='closet'?'':' style="margin-top:18px"'}>Closet</div><div class="panel-grid">${items.map(i=>`<div class="panel-photo" style="background:var(--bone)"><img src="${i.thumb}" style="object-fit:contain;padding:6px" loading="lazy" onclick="panelOpenClosetItem('${i.id}')"/><div class="panel-photo-dest">${escHtml(i.name)}</div></div>`).join('')}</div>`;
}
function panelOpenClosetItem(id){closeSidePanel();clSetTab('wardrobe');clOpenItem(id);}
function panelPhotoCard(e,isArchived=false){
  const p=e.photo;
  if(isArchived)return`<div class="panel-photo"><img src="${p.img}" loading="lazy"/><div class="panel-photo-dest" style="transform:none">${e.label}</div><div class="panel-photo-arch-actions"><button class="arch-btn" style="background:rgba(42,95,63,.85)" onclick="restorePhoto('${p.id}','${e.type}','${e.contextId}')">Restore</button><button class="arch-btn" style="background:rgba(168,32,32,.85)" onclick="deleteFromPanel('${p.id}','${e.type}','${e.contextId}')">Delete</button></div></div>`;
  return`<div class="panel-photo"><img src="${p.img}" loading="lazy" onclick="navigateToPhoto('${e.type}','${e.contextId}','${e.sectionKey}')"/>${p.liked?'<div class="panel-photo-liked"></div>':''}<button class="panel-photo-like${p.liked?' on':''}" onclick="panelToggleLike('${p.id}','${e.type}','${e.contextId}')">♥</button><button class="panel-photo-move" onclick="openAssignPhoto('${p.id}','${e.type}','${e.contextId}')">↗</button><div class="panel-photo-dest">${e.label}</div></div>`;
}
function panelToggleLike(photoId,type,contextId){const arr=getPhotosArray(type,contextId);const p=arr.find(p=>p.id===photoId);if(p){p.liked=!p.liked;savePhotosArray(type,contextId,arr);}renderSidePanel();updatePanelBadge();showSection(currentSection);}
function restorePhoto(photoId,type,contextId){const arr=getPhotosArray(type,contextId);const p=arr.find(p=>p.id===photoId);if(p){p.archived=false;savePhotosArray(type,contextId,arr);}renderSidePanel();updatePanelBadge();showSection(currentSection);}
function deleteFromPanel(photoId,type,contextId){if(!confirm('Permanently delete?'))return;savePhotosArray(type,contextId,getPhotosArray(type,contextId).filter(p=>p.id!==photoId));idbDeletePhoto(photoId).catch(()=>{});deleteRemotePhoto(photoId).catch(()=>{});renderSidePanel();updatePanelBadge();}
function openAssignPhoto(photoId,fromType,fromContextId){
  const home=userData('home',{rooms:[]});const h=userData('honeymoon',{rooms:[]});const d=userData('dayout',{plans:[]});
  const dests=[
    ...home.rooms.map(r=>({label:`${r.name} (Home)`,type:'home_room',contextId:r.id})),
    {label:'Wedding inspiration',type:'wedding',contextId:'wedding'},
    {label:'Honeymoon inspiration',type:'honeymoon_inspo',contextId:'honeymoon'},
    ...h.rooms.map(r=>({label:`${r.name} (Honeymoon)`,type:'honeymoon_room',contextId:r.id})),
    ...d.plans.map(pl=>({label:`${pl.name} (Day Out)`,type:'dayout_plan',contextId:pl.id}))
  ].filter(dest=>!(dest.type===fromType&&dest.contextId===fromContextId));
  if(!dests.length){alert('No other destinations available.');return;}
  openModal(`<div class="modal-head"><div class="modal-title">Move photo to</div><button class="modal-close" onclick="closeModal()">×</button></div><div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">${dests.map(dest=>`<button class="btn-ghost" style="text-align:left" onclick="doMovePhoto('${photoId}','${fromType}','${fromContextId}','${dest.type}','${dest.contextId}')">${dest.label}</button>`).join('')}</div>`);
}
function doMovePhoto(photoId,fromType,fromContextId,toType,toContextId){
  const fromArr=getPhotosArray(fromType,fromContextId);const photo=fromArr.find(p=>p.id===photoId);if(!photo){closeModal();return;}
  savePhotosArray(fromType,fromContextId,fromArr.filter(p=>p.id!==photoId));
  const toArr=getPhotosArray(toType,toContextId);toArr.push(photo);savePhotosArray(toType,toContextId,toArr);
  closeModal();renderSidePanel();showSection(currentSection);updatePanelBadge();
}
function navigateToPhoto(type,contextId,sectionKey){
  closeSidePanel();
  if(sectionKey==='home'){activeRoomId=contextId;homeView='rooms';activeRoomTab='photos';showSection('home');}
  else if(sectionKey==='wedding'){weddingTab='inspo';showSection('wedding');}
  else if(sectionKey==='honeymoon'){if(type==='honeymoon_room')activeHoneymoonRoomId=contextId;honeymoonTab=type==='honeymoon_room'?'rooms':'inspo';showSection('honeymoon');}
  else if(sectionKey==='dayout'){activeDayOutId=contextId;showSection('dayout');}
  else if(sectionKey==='recipes'){closeSidePanel();showSection('recipes');}
}
function updatePanelBadge(){
  if(!currentUser)return;const liked=getAllPhotos(false).filter(e=>e.photo.liked).length;
  const badge=document.getElementById('panel-badge');if(badge){badge.textContent=liked;badge.classList.toggle('show',liked>0);}
}

// ── PANEL MODE / LINKS ──
function setPanelMode(m){
  panelMode=m;
  document.querySelectorAll('.panel-mode-tab').forEach(b=>b.classList.toggle('active',b.id===`pmt-${m}`));
  renderPanelHead();
  renderSidePanel();
}
function getAllLinks(){
  const all=[];
  const home=userData('home',{rooms:[]});
  home.rooms.forEach(r=>{
    (r.photos||[]).filter(p=>p.link&&!p.archived).forEach(p=>all.push({title:p.note||p.name||'Photo Link',url:p.link,label:r.name,icon:'🏠'}));
    (r.items||[]).filter(i=>i.link).forEach(i=>all.push({title:i.name||'Item',url:i.link,label:r.name,icon:'🛋️'}));
  });
  const w=userData('wedding',{inspo:[]});
  (w.inspo||[]).filter(p=>p.link&&!p.archived).forEach(p=>all.push({title:p.note||'Wedding Link',url:p.link,label:'Wedding',icon:'💍'}));
  const h=userData('honeymoon',{rooms:[],inspo:[]});
  (h.inspo||[]).filter(p=>p.link&&!p.archived).forEach(p=>all.push({title:p.note||'Honeymoon Link',url:p.link,label:'Honeymoon',icon:'✈️'}));
  h.rooms.forEach(r=>{
    (r.photos||[]).filter(p=>p.link&&!p.archived).forEach(p=>all.push({title:p.note||'Link',url:p.link,label:r.name,icon:'✈️'}));
    (r.items||[]).filter(i=>i.link).forEach(i=>all.push({title:i.name||'Booking',url:i.link,label:r.name,icon:'🏨'}));
  });
  const d=userData('dayout',{plans:[]});
  d.plans.forEach(pl=>{
    (pl.photos||[]).filter(p=>p.link&&!p.archived).forEach(p=>all.push({title:p.note||'Link',url:p.link,label:pl.name,icon:'🗺️'}));
    (pl.items||[]).filter(i=>i.link).forEach(i=>all.push({title:i.name||'Activity',url:i.link,label:pl.name,icon:'🎭'}));
  });
  const music=userData('music',{playlists:[]});
  music.playlists.forEach(pl=>(pl.songs||[]).filter(s=>s.link).forEach(s=>all.push({title:s.title||'Song',url:s.link,label:`${pl.name}${s.artist?' — '+s.artist:''}`,icon:'🎵'})));
  const saved=userData('saved_links',[]);
  saved.forEach(l=>all.push({...l,icon:l.icon||'🔗',_saved:true}));
  return all;
}
function renderSidePanelLinks(){
  const body=document.getElementById('panel-body');
  const links=getAllLinks();
  const addBtn=`<div style="padding:10px 0 6px;text-align:right"><button class="btn-ghost" onclick="openAddSavedLink()" style="font-size:12px;padding:5px 12px">+ Add link</button></div>`;
  if(!links.length){body.innerHTML=`<div class="panel-empty">No saved links yet.<br/><br/><span style="font-size:12.5px;color:var(--warm);">Links from photos, items &amp; songs appear here.</span><br/><br/><button class="btn-ghost" onclick="openAddSavedLink()" style="margin-top:8px">+ Add link</button></div>`;return;}
  body.innerHTML=addBtn+links.map(l=>`<div class="link-item"><div class="link-item-icon">${l.icon}</div><div class="link-item-body"><div class="link-item-title">${l.title}</div><a class="link-item-url" href="${l.url}" target="_blank" rel="noopener">${l.url}</a><div class="link-item-label">${l.label}</div></div></div>`).join('');
}
function openAddSavedLink(){
  openModal(`<div class="modal-head"><div class="modal-title">Add link</div><button class="modal-close" onclick="closeModal()">×</button></div>
    <label class="field-label">Title</label><input id="sl-title" class="field-input" placeholder="e.g. Kitchen Inspo…"/>
    <label class="field-label">URL</label><input id="sl-url" class="field-input" type="url" placeholder="https://…"/>
    <label class="field-label">Label / Source</label><input id="sl-label" class="field-input" placeholder="e.g. Pinterest, Houzz…"/>
    <div class="modal-row"><button class="btn-solid sm" onclick="saveLink()">Save link</button><button class="btn-ghost" onclick="closeModal()">Cancel</button></div>`);
}
function saveLink(){
  const url=(document.getElementById('sl-url').value||'').trim();if(!url)return;
  const saved=userData('saved_links',[]);
  saved.push({id:uid(),title:document.getElementById('sl-title').value.trim()||url,url,label:document.getElementById('sl-label').value.trim(),icon:'🔗',date:Date.now()});
  saveData('saved_links',saved);closeModal();renderSidePanelLinks();
}

// ── PHOTO HELPERS ──
function getPhotosArray(type,contextId){
  if(type==='home_room'){const home=userData('home',{rooms:[]});const room=home.rooms.find(r=>r.id===contextId);return room?(room.photos=room.photos||[],room.photos):[];}
  if(type==='wedding'){const w=userData('wedding',{inspo:[]});return w.inspo=w.inspo||[];}
  if(type==='honeymoon_room'){const h=userData('honeymoon',{rooms:[]});const room=h.rooms.find(r=>r.id===contextId);return room?(room.photos=room.photos||[],room.photos):[];}
  if(type==='honeymoon_inspo'){const h=userData('honeymoon',{rooms:[],inspo:[]});return h.inspo=h.inspo||[];}
  if(type==='dayout_plan'){const d=userData('dayout',{plans:[]});const pl=d.plans.find(p=>p.id===contextId);return pl?(pl.photos=pl.photos||[],pl.photos):[];}
  if(type==='recipe_photo'){const rec=userData('recipes',{items:[]});const item=rec.items.find(i=>i.id===contextId);return item?(item.photos=item.photos||[],item.photos):[];}
  return[];
}
function savePhotosArray(type,contextId,arr){
  if(type==='home_room'){const home=userData('home',{rooms:[]});const room=home.rooms.find(r=>r.id===contextId);if(room){room.photos=arr;saveData('home',home);}}
  else if(type==='wedding'){const w=userData('wedding',{inspo:[]});w.inspo=arr;saveData('wedding',w);}
  else if(type==='honeymoon_room'){const h=userData('honeymoon',{rooms:[]});const room=h.rooms.find(r=>r.id===contextId);if(room){room.photos=arr;saveData('honeymoon',h);}}
  else if(type==='honeymoon_inspo'){const h=userData('honeymoon',{rooms:[],inspo:[]});h.inspo=arr;saveData('honeymoon',h);}
  else if(type==='dayout_plan'){const d=userData('dayout',{plans:[]});const pl=d.plans.find(p=>p.id===contextId);if(pl){pl.photos=arr;saveData('dayout',d);}}
  else if(type==='recipe_photo'){const rec=userData('recipes',{items:[]});const item=rec.items.find(i=>i.id===contextId);if(item){item.photos=arr;saveData('recipes',rec);}}
}
function startLongPress(event,photoId,type,contextId){
  _lpFired=false;
  _lpTimer=setTimeout(()=>{
    _lpFired=true;
    const card=event.target.closest('.photo-card');
    if(card){card.classList.add('pressing');setTimeout(()=>card.classList.remove('pressing'),400);}
    openAssignPhoto(photoId,type,contextId);
  },600);
}
function cancelLongPress(){if(_lpTimer){clearTimeout(_lpTimer);_lpTimer=null;}}
function toggleLike(photoId,type,contextId){const arr=getPhotosArray(type,contextId);const p=arr.find(p=>p.id===photoId);if(p)p.liked=!p.liked;savePhotosArray(type,contextId,arr);showSection(currentSection);updatePanelBadge();}
function archivePhoto(photoId,type,contextId){const arr=getPhotosArray(type,contextId);const p=arr.find(p=>p.id===photoId);if(p){p.archived=true;savePhotosArray(type,contextId,arr);}showSection(currentSection);updatePanelBadge();}
function deletePhoto(photoId,type,contextId){if(!confirm('Permanently delete this photo?'))return;savePhotosArray(type,contextId,getPhotosArray(type,contextId).filter(p=>p.id!==photoId));idbDeletePhoto(photoId).catch(()=>{});deleteRemotePhoto(photoId).catch(()=>{});showSection(currentSection);updatePanelBadge();}
function viewPhoto(photoId,type,contextId){const p=getPhotosArray(type,contextId).find(p=>p.id===photoId);if(!p)return;if(p.kind){viewMedia(p);return;}openModal(`<div class="modal-head"><div class="modal-title">${p.note||'Photo'}</div><button class="modal-close" onclick="closeModal()">×</button></div><img src="${p.img}" style="width:100%;max-height:360px;object-fit:contain;border:1px solid var(--bone);margin-bottom:12px"/>${p.note?`<p style="font-size:15px;line-height:1.6;margin-bottom:10px">${p.note}</p>`:''}${p.link?`<a href="${p.link}" target="_blank" rel="noopener" style="font-size:13px;color:var(--muted);word-break:break-all">🔗 ${p.link}</a>`:''}${p.price?`<div style="font-family:var(--sans);font-size:20px;color:var(--green);margin-top:8px">£${p.price.toLocaleString(undefined,{minimumFractionDigits:2})}</div>`:''}`); }

function renderPhotoGrid(photos,type,contextId){
  const visible=(photos||[]).filter(p=>!p.archived);
  if(!visible.length)return`<div class="empty" style="padding:20px 0;font-size:13px">No photos yet.</div>`;
  const sorted=[...visible].sort((a,b)=>(b.liked?1:0)-(a.liked?1:0));
  return`<div class="photo-grid">${sorted.map(p=>`<div class="photo-card">${p.liked?'<div class="liked-dot"></div>':''}<img src="${p.img}" loading="lazy" onclick="if(!_lpFired)viewPhoto('${p.id}','${type}','${contextId}')" onmousedown="startLongPress(event,'${p.id}','${type}','${contextId}')" onmouseup="cancelLongPress()" onmouseleave="cancelLongPress()" ontouchstart="startLongPress(event,'${p.id}','${type}','${contextId}')" ontouchend="cancelLongPress()" ontouchmove="cancelLongPress()"/>${p.kind?`<span class="kind-badge">${p.kind==='video'?'▶ Video':'File'}</span>`:''}<div class="photo-card-actions"><button class="img-btn${p.liked?' liked':' default'}" onclick="toggleLike('${p.id}','${type}','${contextId}')">♥</button><button class="img-btn arch" onclick="archivePhoto('${p.id}','${type}','${contextId}')" title="Archive"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 8v13H3V8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg></button><button class="img-btn del" onclick="deletePhoto('${p.id}','${type}','${contextId}')">✕</button></div>${p.note?`<div class="photo-note">${p.note}</div>`:''}${p.link?`<a class="photo-link" href="${p.link}" target="_blank" rel="noopener">🔗 ${p.link}</a>`:''}${p.price?`<div class="photo-price">£${p.price.toLocaleString(undefined,{minimumFractionDigits:2})}</div>`:''}</div>`).join('')}</div>`;
}

