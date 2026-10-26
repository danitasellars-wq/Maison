// MAISON · capture.js — plain script, shares globals with the other files in js/ (load order is set in index.html).
// ── CAPTURE ──
// Camera button. Inside an area it saves straight into that area (destinations limited to it, current page
// pre-selected); on the home screen every destination is offered. Everything lands in the All photos gallery too.
function capturePreselect(opts){
  const s=currentSection,has=v=>opts.some(o=>o.v===v);
  const want=s==='home'&&activeRoomId?'home_'+activeRoomId:s==='wedding'?'wedding':s==='honeymoon'?'honeymoon':s==='dayout'&&activeDayOutId?'dayout_'+activeDayOutId:s==='recipes'?'recipes_new':null;
  if(want&&has(want))return want;
  const last=localStorage.getItem('maison_lastdest');
  return last&&has(last)?last:opts[0].v;
}
// The two big pick buttons are real <label>s around the file inputs, so a tap opens the camera / photo library natively (no script in between,
// which is what phones are most reliable with). Used by both the House capture sheet and the Closet add sheet.
function capPickHTML(onpick,multi,any){
  const cam=`<label class="cap-big primary">${ICON_CAM}<span>Take photo</span><input type="file" accept="image/*" capture="environment" onchange="${onpick}(this)"/></label>`;
  if(any)return`<div class="cap-pick">${cam}<label class="cap-big">${ICON_VIDEO}<span>Record video</span><input type="file" accept="video/*" capture="environment" onchange="${onpick}(this)"/></label><label class="cap-big wide">${ICON_PHOTOS}<span>Choose photos, videos or any file</span><input type="file" multiple onchange="${onpick}(this)"/></label></div>`;
  return`<div class="cap-pick">${cam}<label class="cap-big">${ICON_PHOTOS}<span>${multi?'Choose photos':'Choose photo'}</span><input type="file" accept="image/*" ${multi?'multiple':''} onchange="${onpick}(this)"/></label></div>`;
}
const ICON_VIDEO=`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-3v10l-6-3z"/></svg>`;
// ── videos and other files in photo collections ──
// A video or any other file is stored like a photo: a small picture (a frame from the video, or a card showing the file type) lives in the
// synced record as `img`, so every gallery already shows it, and the file itself sits in IndexedDB under the record's id and is mirrored to Drive.
// Records carry kind:'video'|'file' plus fname/fsize/mime. Unlike photos they are not downloaded to other devices automatically (they can be big);
// they are fetched from Drive the first time someone opens them there (viewMedia).
const CAP_MAX_BYTES=200*1048576;
function capKind(f){
  const t=(f.type||'').toLowerCase(),n=(f.name||'').toLowerCase();
  if(t.indexOf('image/')===0&&t!=='image/heic'&&t!=='image/heif')return'';
  if(t.indexOf('video/')===0||/\.(mp4|mov|m4v|webm|3gp|avi|mkv)$/.test(n))return'video';
  return'file';
}
function capFileThumb(f,kind){
  const cv=document.createElement('canvas');cv.width=420;cv.height=300;const x=cv.getContext('2d');
  x.fillStyle='#e9e2d6';x.fillRect(0,0,420,300);
  const m=/\.([a-z0-9]{1,5})$/i.exec(f.name||''),ext=kind==='video'?'VIDEO':(m?m[1].toUpperCase():'FILE');
  x.fillStyle='#6b5f50';x.textAlign='center';x.font='600 72px sans-serif';x.fillText(ext,210,150);
  x.font='400 22px sans-serif';let n=f.name||'';if(n.length>30)n=n.slice(0,27)+'…';x.fillText(n,210,205);
  return x.canvas.toDataURL('image/jpeg',.7);
}
// A still from the video to use as its picture (null if the phone can't decode it; the caller then uses the file card).
function capVideoPoster(f){
  return new Promise(res=>{
    const url=URL.createObjectURL(f),v=document.createElement('video');let done=false;
    const fin=d=>{if(done)return;done=true;try{URL.revokeObjectURL(url);}catch(e){}res(d);};
    setTimeout(()=>fin(null),6000);
    v.muted=true;v.playsInline=true;v.preload='metadata';
    v.onloadedmetadata=()=>{try{v.currentTime=Math.min(1,(v.duration||2)/2);}catch(e){fin(null);}};
    v.onseeked=()=>{try{const s=scaleDims(v.videoWidth,v.videoHeight,560);fin(canvasDataURL(drawToCanvas(v,s.w,s.h),.62));}catch(e){fin(null);}};
    v.onerror=()=>fin(null);v.src=url;
  });
}
function capSize(n){return n>=1048576?(n/1048576).toFixed(n>=10485760?0:1)+' MB':Math.max(1,Math.round(n/1024))+' KB';}
async function viewMedia(p){
  const title=escHtml(p.note||p.name||p.fname||(p.kind==='video'?'Video':'File'));
  openModal(`<div class="modal-head"><div class="modal-title">${title}</div><button class="modal-close" onclick="closeModal()">×</button></div><div class="cap-working" style="padding:24px 0"><span class="cap-spin"></span>Opening…</div>`);
  let blob=null;try{blob=await idbGetPhoto(p.id);}catch(e){}
  if(!blob)blob=await ensurePhotoLocal(p.id);
  if(!blob){openModal(`<div class="modal-head"><div class="modal-title">${title}</div><button class="modal-close" onclick="closeModal()">×</button></div><p class="cl-hint" style="margin-top:0">This ${p.kind==='video'?'video':'file'} is not on this device yet. It downloads from Google Drive when Cloud Sync is on and the phone that added it has finished uploading.</p><div class="modal-row"><button class="btn-ghost" onclick="closeModal()">Close</button></div>`);return;}
  const url=URL.createObjectURL(blob.type||!p.mime?blob:new Blob([blob],{type:p.mime}));
  const meta=[p.fname,p.fsize?capSize(p.fsize):''].filter(Boolean).map(escHtml).join(' · ');
  openModal(`<div class="modal-head"><div class="modal-title">${title}</div><button class="modal-close" onclick="closeModal()">×</button></div>
    ${p.kind==='video'?`<video class="cap-video" src="${url}" controls playsinline preload="metadata" poster="${escHtml(p.img)}"></video>`:`<img src="${escHtml(p.img)}" class="cap-filecard" alt=""/>`}
    ${meta?`<p class="cl-hint">${meta}</p>`:''}
    ${p.note?`<p style="font-size:15px;line-height:1.6;margin-bottom:10px">${escHtml(p.note)}</p>`:''}
    <div class="modal-row"><a class="btn-solid sm" href="${url}" download="${escHtml(p.fname||(p.kind==='video'?'video':'file'))}" target="_blank" rel="noopener">${p.kind==='video'?'Save video':'Open or save file'}</a><button class="btn-ghost" onclick="closeModal()">Close</button></div>`);
}

function capBusy(msg){
  const w=document.getElementById('cap-status');if(w)w.innerHTML=`<div class="cap-working"><span class="cap-spin"></span>${escHtml(msg)}</div>`;
  document.querySelectorAll('.cap-big').forEach(l=>l.classList.add('off'));
}
function triggerCapture(){
  const area=areaOf(currentSection);
  if(area==='closet'){clAddSheet();return;}
  const home=userData('home',{rooms:[]}),d=userData('dayout',{plans:[]}),rec=userData('recipes',{items:[]});
  const opts=[];
  if(!area||area==='house')home.rooms.forEach(r=>opts.push({v:'home_'+r.id,label:r.name+' (Room)'}));
  if(!area||area==='other'){
    opts.push({v:'wedding',label:'Wedding inspiration'},{v:'honeymoon',label:'Honeymoon inspiration'});
    d.plans.forEach(pl=>opts.push({v:'dayout_'+pl.id,label:pl.name+' (Day Out)'}));
    opts.push({v:'recipes_new',label:'New Recipe'});
    rec.items.forEach(ri=>opts.push({v:'recipe_'+ri.id,label:'Add to recipe: '+(ri.title||'Recipe')}));
  }
  if(!area)opts.push({v:'closet',label:'Closet (new piece)'});
  if(!opts.length){
    openModal(`<div class="modal-head"><div class="modal-title">Add a room first</div><button class="modal-close" onclick="closeModal()">×</button></div><p class="cl-hint" style="margin-top:0">Photos in House planning are saved into a room. Create one, then use the camera.</p><div class="modal-row"><button class="btn-solid sm" onclick="closeModal();setHomeView('rooms');openAddRoom()">Add a room</button><button class="btn-ghost" onclick="closeModal()">Cancel</button></div>`);
    return;
  }
  capOpts=opts;
  const pre=capturePreselect(opts);
  openModal(`<div class="modal-head"><div class="modal-title">Add photos and files</div><button class="modal-close" onclick="closeModal()">×</button></div>
    ${opts.length>1?`<label class="field-label" style="margin-top:0">Save to</label>`:`<p class="cl-hint" style="margin-top:0">Saving to <b>${escHtml(opts[0].label)}</b></p>`}
    <select id="cap-dest" class="field-input"${opts.length>1?'':' style="display:none"'}>${opts.map(o=>`<option value="${o.v}"${o.v===pre?' selected':''}>${escHtml(o.label)}</option>`).join('')}</select>
    ${capPickHTML('capFilesPicked',true,true)}
    <div id="cap-status"></div>`);
}
let capOpts=[],capLast=null;
// Photos are saved the moment they are picked (several at once is fine); a note, price or name can be added afterwards if wanted.
async function capFilesPicked(input){
  const files=Array.from(input.files||[]);input.value='';if(!files.length)return;
  const destEl=document.getElementById('cap-dest'),dest=destEl?destEl.value:'';
  if(dest==='closet'){closetFilesPicked({files,value:''});return;}   // home-screen camera → new closet piece
  capBusy(files.length>1?'Adding '+files.length+' photos…':'Adding your photo…');
  const items=[],tooBig=[];
  for(const f of files){
    if(f.size>CAP_MAX_BYTES){tooBig.push(f.name);continue;}
    const kind=capKind(f);
    if(kind){
      let thumb=kind==='video'?await capVideoPoster(f):null;if(!thumb)thumb=capFileThumb(f,kind);
      items.push({thumb,blob:f,kind,fname:f.name||'',fsize:f.size,mime:f.type||''});continue;
    }
    try{
      const raw=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error);r.readAsDataURL(f);});
      try{const{thumb,blob}=await processPhotoDataURL(raw);items.push({thumb,blob});}
      catch(err){items.push({thumb:raw,blob:null});}
    }catch(err){}
  }
  if(!items.length){const w=document.getElementById('cap-status');if(w)w.innerHTML=tooBig.length?'<p class="cl-hint">That file is over 200 MB, which is too big to keep in MAISON.</p>':'<p class="cl-hint">Could not read that. Try again.</p>';document.querySelectorAll('.cap-big').forEach(l=>l.classList.remove('off'));return;}
  const res=capStore(dest,items);
  if(!res){const w=document.getElementById('cap-status');if(w)w.innerHTML='<p class="cl-hint">Could not save that. Is the room still there?</p>';document.querySelectorAll('.cap-big').forEach(l=>l.classList.remove('off'));return;}
  let lost=0;
  for(const x of res.blobs){if(x.blob&&!(await idbPutPhoto(x.id,x.blob))&&x.kind)lost++;}
  if(lost)clToast('Could not keep the full '+(lost>1?'files':'file')+' on this device (storage is low)');
  else if(tooBig.length)clToast(tooBig.length+(tooBig.length>1?' files were':' file was')+' over 200 MB and skipped');
  try{localStorage.setItem('maison_lastdest',dest);}catch(e){}
  capLast={dest,ids:res.ids,n:items.length,noun:items.every(i=>!i.kind)?'photo':'file'};
  showSection(currentSection);updatePanelBadge();syncPhotosSoon();
  capDoneHTML();
}
// Finds the stored list a destination keeps its photos in (rooms, wedding, honeymoon, a day out, a recipe) and how to save it again.
function capTarget(dest){
  if(dest.indexOf('home_')===0){const d=userData('home',{rooms:[]}),room=d.rooms.find(r=>r.id===dest.slice(5));return room?{photos:room.photos=room.photos||[],save:()=>saveData('home',d)}:null;}
  if(dest==='wedding'){const d=userData('wedding',{inspo:[]});return{photos:d.inspo=d.inspo||[],save:()=>saveData('wedding',d)};}
  if(dest==='honeymoon'){const d=userData('honeymoon',{rooms:[],inspo:[],budget:0});return{photos:d.inspo=d.inspo||[],save:()=>saveData('honeymoon',d)};}
  if(dest.indexOf('dayout_')===0){const d=userData('dayout',{plans:[]}),pl=d.plans.find(p=>p.id===dest.slice(7));return pl?{photos:pl.photos=pl.photos||[],save:()=>saveData('dayout',d)}:null;}
  if(dest.indexOf('recipe_')===0){const d=userData('recipes',{items:[]}),ri=d.items.find(i=>i.id===dest.slice(7));return ri?{photos:ri.photos=ri.photos||[],save:()=>saveData('recipes',d)}:null;}
  if(dest==='recipes_new'||dest==='recipes'){const d=userData('recipes',{items:[]});return{recipes:d,save:()=>saveData('recipes',d)};}
  return null;
}
function capStore(dest,items){
  const t=capTarget(dest);if(!t)return null;
  const mk=it=>({p:Object.assign({id:uid(),img:it.thumb,note:'',link:'',price:0,name:'',date:Date.now(),liked:false,archived:false},it.kind?{kind:it.kind,fname:it.fname,fsize:it.fsize,mime:it.mime}:{}),blob:it.blob,kind:it.kind});
  const list=items.map(mk);
  if(t.recipes){
    const first=list[0],plain=!first.kind,rest=plain?list.slice(1):list;   // a recipe's own picture must be a photo; a video/file goes in its photos
    const rec={id:uid(),img:first.p.img,title:'New Recipe',tags:[],text:'',date:Date.now(),photos:rest.map(x=>Object.assign({id:x.p.id,img:x.p.img,note:'',date:x.p.date,liked:false,archived:false},x.kind?{kind:x.kind,fname:x.p.fname,fsize:x.p.fsize,mime:x.p.mime}:{}))};
    t.recipes.items.push(rec);
    if(!t.save())return null;
    return{ids:[plain?rec.id:rest[0].p.id].concat(rest.slice(plain?0:1).map(x=>x.p.id)),blobs:(plain?[{id:rec.id,blob:first.blob}]:[]).concat(rest.map(x=>({id:x.p.id,blob:x.blob,kind:x.kind})))};
  }
  list.forEach(x=>t.photos.push(x.p));
  if(!t.save())return null;
  return{ids:list.map(x=>x.p.id),blobs:list.map(x=>({id:x.p.id,blob:x.blob,kind:x.kind}))};
}
function capDoneHTML(){
  const c=capLast,o=capOpts.find(x=>x.v===c.dest),where=o?o.label:'';
  openModal(`<div class="modal-head"><div class="modal-title">${c.n>1?c.n+' '+c.noun+'s':(c.noun==='file'?'File':'Photo')} saved</div><button class="modal-close" onclick="closeModal()">×</button></div>
    ${where?`<p class="cl-hint" style="margin-top:0">Saved to <b>${escHtml(where)}</b></p>`:''}
    ${c.n===1?`<details class="cap-more"><summary>Add a note, price or name</summary>
      <label class="field-label">Name</label><input id="cap-name" class="field-input" placeholder="e.g. IKEA Kallax" autocomplete="off"/>
      <label class="field-label">Note</label><textarea id="cap-note" class="field-input" rows="2" placeholder="Add a note…"></textarea>
      <label class="field-label">Link</label><input id="cap-link" class="field-input" placeholder="https://…" type="url"/>
      <label class="field-label">Price (£)</label><input id="cap-price" class="field-input" placeholder="0.00" type="number" min="0" step="0.01" inputmode="decimal"/>
      <div class="modal-row"><button class="btn-solid sm" onclick="capSaveDetails()">Save details</button></div></details>`:''}
    <div class="modal-row"><button class="btn-solid sm green" onclick="triggerCapture()">Add another</button><button class="btn-ghost" onclick="closeModal()">Done</button></div>`);
}
function capSaveDetails(){
  const c=capLast;if(!c)return;
  const v=id=>(document.getElementById(id)||{value:''}).value.trim();
  const name=v('cap-name'),note=v('cap-note'),link=v('cap-link'),price=parseFloat(v('cap-price'))||0;
  const t=capTarget(c.dest);if(!t)return;
  const rr=t.recipes&&t.recipes.items.find(i=>i.id===c.ids[0]);
  if(rr){if(name)rr.title=name;rr.text=note;}
  else if(t.recipes){const ri=t.recipes.items.find(i=>(i.photos||[]).some(x=>x.id===c.ids[0])),p=ri&&ri.photos.find(x=>x.id===c.ids[0]);if(p){p.note=note;p.link=link;p.price=price;p.name=name;}}
  else{const p=t.photos.find(x=>x.id===c.ids[0]);if(p){p.note=note;p.link=link;p.price=price;p.name=name;}}
  t.save();closeModal();showSection(currentSection);updatePanelBadge();clToast('Details saved');
}

