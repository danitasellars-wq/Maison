// MAISON · events-more.js — plain script, shares globals with the other files in js/ (load order is set in index.html).
// ── weather symbols ──
const WX_SVG={
  sun:'<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
  suncloud:'<circle cx="8.5" cy="8.5" r="3"/><path d="M8.5 2.6v1.3M2.6 8.5h1.3M4.3 4.3l.9.9M12.7 4.3l-.9.9"/><path d="M8 20h9a3.5 3.5 0 0 0 .4-7A5 5 0 0 0 8 14a3 3 0 0 0 0 6z"/>',
  cloud:'<path d="M7 19h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 12.5 3.3 3.3 0 0 0 7 19z"/>',
  rain:'<path d="M7 15h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 8.5 3.3 3.3 0 0 0 7 15z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
  snow:'<path d="M7 15h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 8.5 3.3 3.3 0 0 0 7 15z"/><path d="M8 18.5h.01M12 19.5h.01M16 18.5h.01M10 21.5h.01M14 21.5h.01" stroke-width="2.4"/>',
  storm:'<path d="M7 14h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 7.5 3.3 3.3 0 0 0 7 14z"/><path d="M12.5 14l-2.5 4h3.5l-2 4"/>',
  fog:'<path d="M5 10h14M3 14h18M6 18h12"/>',
  wind:'<path d="M3 8h10a2.5 2.5 0 1 0-2.5-2.5M3 12h15a3 3 0 1 1-3 3M3 16h7a2 2 0 1 1-2 2"/>'
};
const WX_LABEL={sun:'Sunny',suncloud:'Sunny spells',cloud:'Cloudy',rain:'Rain',snow:'Snow',storm:'Thunderstorm',fog:'Fog',wind:'Windy'};
function wxIcon(kind,size){return`<svg class="wxi" width="${size||28}" height="${size||28}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${WX_SVG[kind]||WX_SVG.cloud}</svg>`;}
function wxKind(code,wind){
  const c=+code;
  let k=c<=1?'sun':c===2?'suncloud':c===3?'cloud':(c===45||c===48)?'fog':((c>=51&&c<=67)||(c>=80&&c<=82))?'rain':((c>=71&&c<=77)||c===85||c===86)?'snow':c>=95?'storm':'cloud';
  if((wind||0)>=25&&(k==='sun'||k==='suncloud'||k==='cloud'))k='wind';
  return k;
}
function wxMiniIcon(ev,day){
  if(wxWindow(ev)!=='on')return'';
  const c=getStore(wxKey(ev.id),null),d=c&&c.loc===ev.location&&c.days&&c.days[day];if(!d)return'';
  const k=wxKind(d.code,d.wind);return`<span class="evd-wx" title="${WX_LABEL[k]}" aria-label="${WX_LABEL[k]}">${wxIcon(k,24)}</span>`;
}
// The weather inside a day: just symbols (day out, evening), no numbers. Appears 14 days before the event and stays through to its last day.
function wxDayHTML(ev,day){
  const st=wxWindow(ev);
  if(st==='over')return'';
  const note=t=>`<p class="cl-hint wx-note">${t}</p>`;
  if(st==='early')return note('Weather appears 2 weeks before the event, from '+escHtml(evShort(evAddDays(evDaysSorted(ev)[0],-14)))+'.');
  if(!ev.location)return note('Add a place in Settings to see the weather.');
  const c=getStore(wxKey(ev.id),null);
  if(!c||c.loc!==ev.location)return note('Loading the weather…');
  if(c.fail==='place')return note('Could not find "'+escHtml(ev.location)+'". Try a town or city name in Settings.');
  const d=(c.days||{})[day],today=clKey(new Date());
  if(!d)return note(day>today?'Weather for this day appears on '+escHtml(evShort(evAddDays(day,-15)))+'.':'No weather record for this day.');
  const part=(label,o,wind)=>{const k=wxKind(o?o.code:d.code,wind);return`<span class="wx2-i" title="${label}: ${WX_LABEL[k]}" aria-label="${label}: ${WX_LABEL[k]}">${wxIcon(k,30)}<em>${label}</em></span>`;};
  return`<div class="wx2">${part('Day out',d.day,d.wind)}${part('Evening',d.eve,0)}<span class="wx-credit">Weather by Open-Meteo</span></div>`;
}

// ── photos (days, activities, suggestions) ──
// A photo is a small record in the event (`ph_<id>`: which day / activity / suggestion it belongs to, who added it) plus the picture itself.
// The picture is kept in this device's IndexedDB under the plain id (so your OWN photos also ride your Drive mirror, see referencedPhotoIds) and,
// for shared events, in its own small Firestore document events/{eventId}/photos/{photoId} (a ~1200px JPEG as base64, well under the 1MB limit)
// which other people's apps fetch the first time they look at it. Uploads are queued (`pq` in the device-only event bookkeeping) so they survive
// being offline, and always go up BEFORE the record that points at them.
function evPhotoDocURL(evId,id){return evDocURL(evId)+'/photos/'+id;}
const evPhUrls={};
function evBlobToB64(blob){return new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(String(fr.result).split(',')[1]||'');fr.onerror=rej;fr.readAsDataURL(blob);});}
function evB64ToBlob(b64){const bin=atob(b64),a=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return new Blob([a],{type:'image/jpeg'});}
// Shrinks a picked photo to something that is quick to share: up to ~1200px, JPEG, kept under ~420KB.
async function evPhotoProcess(file){
  const dataURL=await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=rej;fr.readAsDataURL(file);});
  const im=await loadImageFromDataURL(dataURL);
  let max=1200,q=.72,blob=null,s=null;
  for(let i=0;i<4;i++){
    s=scaleDims(im.naturalWidth,im.naturalHeight,max);
    blob=await canvasBlob(drawToCanvas(im,s.w,s.h),q);
    if(blob&&blob.size<=420000)break;
    max=Math.round(max*.8);q=Math.max(.5,q-.07);
  }
  if(!blob)throw new Error('could not read photo');
  return{blob,w:s.w,h:s.h};
}
function evPickPhotos(target){
  const inp=document.createElement('input');inp.type='file';inp.accept='image/*';inp.multiple=true;
  inp.onchange=()=>{const files=Array.from(inp.files||[]);if(files.length)evAddPhotos(files,target||{});};
  inp.click();
}
async function evAddPhotos(files,target){
  const evId=activeEventId,metas=[];
  clToast('Adding '+Math.min(files.length,12)+' photo'+(files.length!==1?'s':'')+'…');
  for(const f of files.slice(0,12)){
    try{
      const pr=await evPhotoProcess(f),id=uid();
      if(!(await idbPutPhoto(id,pr.blob)))continue;
      metas.push({id,day:target.day||'',act:target.act||'',sug:target.sug||'',w:pr.w,h:pr.h});
    }catch(e){}
  }
  if(!metas.length){clToast('Could not add that photo');return;}
  evMutate(evId,(ev,put)=>{const me=ev.me||{};metas.forEach(m=>put('ph_'+m.id,Object.assign({},m,{by:me.name||'',mid:me.id,upd:Date.now()})));});
  const ev2=evFind(evData(),evId);
  if(ev2&&ev2.shared){const b=evBoot();b.pq[evId]=(b.pq[evId]||[]).concat(metas.map(m=>m.id));evBootSave(b);evFlushSoon();}
  if(currentSection==='event')showSection('event');
}
async function evUploadPhotos(evId){
  let b=evBoot();const ids=(b.pq[evId]||[]).slice();if(!ids.length)return true;
  const hd=await evHeaders(true);if(!hd){evStatus=fbNeed?'signin':'offline';evUpdStatus();return false;}
  for(const id of ids){
    const blob=await idbGetPhoto(id).catch(()=>null);
    if(blob){
      try{
        const r=await fetch(evPhotoDocURL(evId,id)+'?key='+encodeURIComponent(EV_CLOUD.apiKey),{method:'PATCH',headers:hd,body:JSON.stringify({fields:{d:{stringValue:await evBlobToB64(blob)}}})});
        if(r.status===401||r.status===403){if(r.status===401)fbExpire();evStatus=r.status===401?'signin':'denied';evUpdStatus();return false;}
        if(!r.ok)throw new Error('HTTP '+r.status);
      }catch(e){evStatus='offline';evUpdStatus();return false;}
    }
    b=evBoot();b.pq[evId]=(b.pq[evId]||[]).filter(x=>x!==id);evBootSave(b);   // uploaded (or the picture is gone), so it is no longer waiting
  }
  return true;
}
// The picture for a photo: this device first, then the shared event, then (for your own photos) your Drive mirror.
async function evPhotoBlob(evId,id){
  let blob=await idbGetPhoto(id).catch(()=>null);if(blob)return blob;
  const ev=evFind(evData(),evId);
  if(ev&&ev.shared&&evCloudOn()){
    const hd=await evHeaders(false);
    if(hd){try{
      const r=await fetch(evPhotoDocURL(evId,id)+'?key='+encodeURIComponent(EV_CLOUD.apiKey),{headers:hd});
      if(r.ok){const j=await r.json(),s=j.fields&&j.fields.d&&j.fields.d.stringValue;if(s){blob=evB64ToBlob(s);await idbPutPhoto(id,blob);return blob;}}
    }catch(e){}}
  }
  const p=ev&&(ev.photos||[]).find(x=>x.id===id);
  if(p&&p.mid===(ev.me||{}).id){blob=await ensurePhotoLocal(id);if(blob)return blob;}
  return null;
}
// Fills in the pictures after a screen is drawn (a few at a time, from cache when possible).
async function evHydratePhotos(root){
  const imgs=Array.from((root||document).querySelectorAll('img[data-evph]'));if(!imgs.length)return;
  const evId=activeEventId;let i=0;
  const worker=async()=>{
    while(i<imgs.length){
      const img=imgs[i++],id=img.dataset.evph;
      try{
        let url=evPhUrls[id];
        if(!url){const blob=await evPhotoBlob(evId,id);if(blob){url=URL.createObjectURL(blob);evPhUrls[id]=url;}}
        if(url&&img.isConnected){img.src=url;img.classList.add('ready');}
      }catch(e){}
    }
  };
  await Promise.all([worker(),worker(),worker()]);
}
function evPhotoThumbs(ev,filter){
  return(ev.photos||[]).filter(filter).sort((a,b)=>(a.upd||0)-(b.upd||0)).map(p=>`<button class="ev-ph" onclick="evPhotoOpen('${p.id}')" aria-label="Open photo"><img data-evph="${p.id}" alt=""/></button>`).join('');
}
function evActPhotosHTML(ev,a){
  const th=evPhotoThumbs(ev,p=>p.act===a.id);
  return`${th?`<div class="ev-ph-strip">${th}</div>`:''}<button class="ev-addph" onclick="evPickPhotos({day:'${a.day}',act:'${a.id}'})">+ Photo</button>`;
}
function evDayPhotosHTML(ev,day){
  const th=evPhotoThumbs(ev,p=>p.day===day&&!p.act&&!p.sug);
  return`<div class="ev-block"><div class="flex-between mb14"><div class="ev-strip-title">Photos</div><button class="btn-ghost" onclick="evPickPhotos({day:'${day}'})">+ Add photos</button></div>
    ${th?`<div class="ev-ph-grid">${th}</div>`:''}</div>`;
}
function evPhotoOpen(id){
  const ev=evFind(evData(),activeEventId),p=ev&&(ev.photos||[]).find(x=>x.id===id);if(!p)return;
  const can=p.mid===(ev.me||{}).id||ev.creator;
  openModal(`<div class="modal-head"><div class="modal-title">Photo</div><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="ev-ph-big"><img data-evph="${id}" alt=""/></div>
    <p class="cl-hint">${p.by?'Added by '+escHtml(p.by):''}</p>
    <div class="modal-row"><button class="btn-ghost" onclick="closeModal()">Close</button>${can?`<button class="btn-ghost danger" onclick="evPhotoDelete('${id}')">Delete photo</button>`:''}</div>`);
  evHydratePhotos(document.getElementById('modal-box'));
}
function evPhotoDelete(id){
  if(!confirm('Delete this photo?'))return;
  evMutate(activeEventId,(ev,put)=>{put('ph_'+id,null);});
  const b=evBoot();b.pq[activeEventId]=(b.pq[activeEventId]||[]).filter(x=>x!==id);evBootSave(b);
  idbDeletePhoto(id).catch(()=>{});delete evPhUrls[id];
  closeModal();showSection('event');
}

// ── suggestions ──
// Anyone can suggest something (words, a link, photos) and everyone can vote it up or down. A suggestion is `s_<id>`; each person's vote is its
// own field `v_<suggestionId>_<personId>` so two people voting at the same moment never overwrite each other.
const EV_THUMB_UP='<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>';
const EV_THUMB_DOWN='<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>';
function evVoteTally(ev,sid){let up=0,down=0;(ev.votes||[]).forEach(v=>{if(v.s===sid){if(v.v>0)up++;else if(v.v<0)down++;}});return{up,down};}
function evMyVote(ev,sid){const me=(ev.me||{}).id,v=(ev.votes||[]).find(x=>x.s===sid&&x.p===me);return v?v.v:0;}
function evVote(sid,val){
  evMutate(activeEventId,(ev,put)=>{
    const me=(ev.me||{}).id;if(!me)return;
    const id=sid+'_'+me,cur=(ev.votes||[]).find(x=>x.id===id);
    if(cur&&cur.v===val)put('v_'+id,null);else put('v_'+id,{id,s:sid,p:me,v:val,upd:Date.now()});
  });
  showSection('event');
}
function evSugCardHTML(ev,s){
  const t=evVoteTally(ev,s.id),mine=evMyVote(ev,s.id),me=(ev.me||{}).id,canEdit=!!(s.by&&s.by.id===me),canDel=canEdit||ev.creator;
  const th=evCan(ev,'photos')?evPhotoThumbs(ev,p=>p.sug===s.id):'',lk=safeLink(s.link);
  let host=lk;try{host=new URL(lk).hostname.replace(/^www\./,'');}catch(e){}
  return`<div class="ev-sug">
    <div class="ev-sug-title">${s.kind==='list'?'<span class="ev-sug-tag">Checklist</span>':''}${escHtml(s.title)}</div>
    ${s.text?`<div class="ev-sug-text">${escHtml(s.text)}</div>`:''}
    ${s.kind==='list'?evSugListHTML(ev,s):''}
    ${lk?`<a class="item-link" href="${escHtml(lk)}" target="_blank" rel="noopener">${escHtml(host)}</a>`:''}
    ${th?`<div class="ev-ph-strip">${th}</div>`:''}
    <div class="ev-sug-meta">Suggested by ${escHtml((s.by&&s.by.name)||'someone')}${s.day&&evDaysSorted(ev).indexOf(s.day)>=0?' · for '+escHtml(evShort(s.day)):''}</div>
    <div class="ev-sug-actions">
      ${s.kind==='list'?'':evVoteBtns(ev,s.id)}
      ${evCan(ev,'photos')?`<button class="btn-ghost sm" onclick="evPickPhotos({sug:'${s.id}'})">Add photo</button>`:''}
      ${evCan(ev,'schedule')&&s.kind!=='list'?`<button class="btn-ghost sm" onclick="evSugToActivity('${s.id}')">Add to schedule</button>`:''}
      ${canEdit?`<button class="btn-ghost sm" onclick="evSugModal('${s.id}')">Edit</button>`:''}${canDel?`<button class="btn-ghost sm danger" onclick="evSugDelete('${s.id}')">Delete</button>`:''}
    </div></div>`;
}
function evSugsHTML(ev){
  const list=(ev.sugs||[]).slice().sort((a,b)=>{const x=evVoteTally(ev,a.id),y=evVoteTally(ev,b.id);return(y.up-y.down)-(x.up-x.down)||(b.upd||0)-(a.upd||0);});
  return`<div class="ev-block"><div class="flex-between mb14"><div class="ev-strip-title">Suggestions</div><span class="ev-sug-btns"><button class="btn-ghost" onclick="evSugModal(null)">+ Idea</button><button class="btn-ghost" onclick="evSugModal(null,'list')">+ Checklist</button></span></div>
    ${list.map(s=>evSugCardHTML(ev,s)).join('')}</div>`;
}
function evSugModal(sid,kind){
  const ev=evFind(evData(),activeEventId);if(!ev)return;
  const s=sid?(ev.sugs||[]).find(x=>x.id===sid):null;if(sid&&!s)return;
  const isL=s?s.kind==='list':kind==='list';evSugKind=isL?'list':'';
  openModal(`<div class="modal-head"><div class="modal-title">${s?(isL?'Edit checklist':'Edit suggestion'):(isL?'New checklist':'New suggestion')}</div><button class="modal-close" onclick="closeModal()">×</button></div>
    <label class="field-label">${isL?'Name your checklist':'What is your idea?'}</label><input id="es-sug-title" class="field-input" value="${escHtml(s?s.title:'')}" placeholder="${isL?'e.g. Things to pack, Restaurants to try':'e.g. Boat trip to the seals'}" autocomplete="off"/>
    <label class="field-label">A few words (optional)</label><textarea id="es-sug-text" class="field-input" rows="3" placeholder="Why it's a good idea, cost, how long…">${escHtml(s?s.text:'')}</textarea>
    <label class="field-label">Link (optional)</label><input id="es-sug-link" class="field-input" type="url" value="${escHtml(s?s.link:'')}" placeholder="https://…" autocomplete="off"/>
    <label class="field-label">For which day (optional)</label><select id="es-sug-day" class="field-input"><option value="">Any day</option>${evDaysSorted(ev).map(k=>`<option value="${k}"${s&&s.day===k?' selected':''}>${escHtml(evLong(k))}</option>`).join('')}</select>
    <p class="cl-hint">${isL?'Add the items once it is saved. Everyone can add items and vote on each one.':'You can add photos from the suggestion once it is saved.'}</p>
    <div class="modal-row"><button class="btn-solid sm teal" onclick="evSugSave(${s?`'${s.id}'`:'null'})">${s?'Save':'Suggest'}</button><button class="btn-ghost" onclick="closeModal()">Cancel</button></div>`);
}
let evSugKind='';
function evSugSave(sid){
  const title=document.getElementById('es-sug-title').value.trim();if(!title){clToast('Give your idea a name');return;}
  const text=document.getElementById('es-sug-text').value.trim(),link=document.getElementById('es-sug-link').value.trim(),day=document.getElementById('es-sug-day').value;
  evMutate(activeEventId,(ev,put)=>{
    const cur=sid?(ev.sugs||[]).find(x=>x.id===sid):null,id=cur?cur.id:uid(),me=ev.me||{};
    put('s_'+id,Object.assign({id,title,text,link,day,by:cur?cur.by:{id:me.id,name:me.name},upd:Date.now()},(cur?cur.kind==='list':evSugKind==='list')?{kind:'list'}:{}));
  });
  closeModal();showSection('event');
}
function evSugDelete(sid){
  const ev=evFind(evData(),activeEventId),s=ev&&(ev.sugs||[]).find(x=>x.id===sid);if(!s)return;
  if(!confirm('Delete "'+s.title+'"?'))return;
  evMutate(activeEventId,(e,put)=>{
    put('s_'+sid,null);
    (e.sitems||[]).filter(i=>i.sid===sid).forEach(i=>{put('si_'+i.id,null);(e.votes||[]).filter(v=>v.s===i.id).forEach(v=>put('v_'+v.id,null));});
    (e.votes||[]).filter(v=>v.s===sid).forEach(v=>put('v_'+v.id,null));
    (e.photos||[]).filter(p=>p.sug===sid).forEach(p=>put('ph_'+p.id,null));
  });
  showSection('event');
}
// Turns a suggestion into a real activity: opens the add-activity form filled in, so you only choose the day and time.
function evSugToActivity(sid){
  const ev=evFind(evData(),activeEventId),s=ev&&(ev.sugs||[]).find(x=>x.id===sid);if(!s)return;
  evActForm(null,'day',{name:s.title,link:s.link||'',notes:(s.text||'').slice(0,200),day:(s.day&&evDaysSorted(ev).indexOf(s.day)>=0)?s.day:evDaysSorted(ev)[0]});
}

// ── calendar export ──
function evGcalDay(ev,day){
  const n=evDateObj(day);n.setDate(n.getDate()+1);
  const info=evDayInfo(ev,day),lines=p=>doSorted(evActsVis(ev).filter(a=>a.day===day&&(a.part||'day')===p)).map(a=>(a.time?a.time+' ':'')+a.name+(a.where?' at '+a.where:'')+(a.notes?' - '+a.notes:''));
  const blocks=[],d1=lines('day'),d2=lines('eve');
  if(d1.length||info.dressDay)blocks.push(['Day out'+(info.dressDay?' - dress code: '+info.dressDay:'')].concat(d1).join('\n'));
  if(d2.length||info.dressEve||info.mealHost)blocks.push(['Evening'+(info.dressEve?' - dress code: '+info.dressEve:'')].concat(info.mealHost?['Meal host: '+info.mealHost]:[],d2).join('\n'));
  const details=blocks.join('\n\n');
  return'https://calendar.google.com/calendar/render?action=TEMPLATE&text='+encodeURIComponent(ev.name)+'&dates='+day.replace(/-/g,'')+'/'+clKey(n).replace(/-/g,'')+'&details='+encodeURIComponent(details)+(ev.location?'&location='+encodeURIComponent(ev.location):'');
}
function evIcsText(s){return String(s||'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n');}
function evDownloadIcs(){
  const ev=evFind(evData(),activeEventId);if(!ev)return;
  const L=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//MAISON//Events//EN','CALSCALE:GREGORIAN'],stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+/,'');
  const add=(uid2,start,end,title,desc,allDay,loc)=>{loc=loc||ev.location;L.push('BEGIN:VEVENT','UID:'+uid2+'@maison','DTSTAMP:'+stamp,allDay?'DTSTART;VALUE=DATE:'+start:'DTSTART:'+start,allDay?'DTEND;VALUE=DATE:'+end:'DTEND:'+end,'SUMMARY:'+evIcsText(title));if(desc)L.push('DESCRIPTION:'+evIcsText(desc));if(loc)L.push('LOCATION:'+evIcsText(loc));L.push('END:VEVENT');};
  evDaysSorted(ev).forEach(day=>{
    const acts=doSorted(evActsVis(ev).filter(a=>a.day===day)),d0=day.replace(/-/g,''),nx=evDateObj(day);nx.setDate(nx.getDate()+1);
    const timed=acts.filter(a=>doToMin(a.time)!=null);
    const untimed=acts.filter(a=>doToMin(a.time)==null);
    if(!timed.length||untimed.length)add(ev.id+day,d0,clKey(nx).replace(/-/g,''),ev.name,untimed.map(a=>a.name).join(', '),true);   // all-day banner, listing anything without a time
    timed.forEach(a=>{const s=doToMin(a.time),e=s+doMins(a),f=m=>String(Math.floor(m/60)%24).padStart(2,'0')+String(m%60).padStart(2,'0')+'00';add(ev.id+a.id,d0+'T'+f(s),d0+'T'+f(e),a.name+' ('+ev.name+')',a.notes,false,a.where);});
  });
  L.push('END:VCALENDAR');
  const blob=new Blob([L.join('\r\n')],{type:'text/calendar'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=(ev.name.replace(/[^\w]+/g,'-')||'event')+'.ics';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);
}

// ── settings, sharing ──
function openEventSettings(){
  const d=evData(),ev=evFind(d,activeEventId);if(!ev)return;
  const pinned=d.pins.indexOf(ev.id)>=0;
  const share=ev.shared
    ?`<p class="cl-hint">Anyone who opens this link and signs in with Google can see and edit the event, so only send it to people you trust.</p>
      <input class="field-input" readonly value="${escHtml(evLink(ev.id))}" onfocus="this.select()"/>
      <div class="modal-row" style="margin-top:10px"><button class="btn-solid sm teal" onclick="evCopyLink()">Copy link</button><button class="btn-ghost" onclick="evSendLink()">Send link</button></div>`
    :evCloudOn()
      ?`<p class="cl-hint">Only you can see this event. Turn on sharing to get a link. Anyone you send it to signs in with Google, then can open it, see the calendar and edit it, and changes show up live for everyone.</p><button class="btn-solid sm teal" onclick="evShareOn()">Turn on sharing</button>`
      :`<p class="cl-hint">Sharing is not switched on for this copy of MAISON yet. It needs the shared event database to be set up once (a free Firebase project). The steps are in CLAUDE.md under "Shared events setup". Until then events work normally on this device and back up to your Google Drive.</p>`;
  openModal(`<div class="modal-head"><div class="modal-title">Event settings</div><button class="modal-close" onclick="closeModal()">×</button></div>
    <label class="field-label">Name</label><input id="es-name" class="field-input" value="${escHtml(ev.name)}"/>
    <label class="field-label">Where</label><input id="es-loc" class="field-input" value="${escHtml(ev.location||'')}"/>
    ${(()=>{const c=getStore(wxKey(ev.id),null);return c&&c.loc===ev.location&&c.label?`<p class="cl-hint" style="margin-top:-10px">Weather for ${escHtml(c.label)}</p>`:'';})()}
    <label class="field-label">Notes for everyone</label><input id="es-notes" class="field-input" value="${escHtml(ev.notes||'')}" placeholder="Meeting point, dress code…"/>
    <label class="field-label">Your name in this event</label><input id="es-me" class="field-input" value="${escHtml((ev.me||{}).name||'')}"/>
    <div class="modal-row"><button class="btn-solid sm teal" onclick="evSaveDetails()">Save</button><button class="btn-ghost" onclick="evChangeDays()">Change days</button></div>
    <div class="ev-set-block"><div class="ev-strip-title">Share</div>${share}</div>
    ${evViewHTML(ev)}
    ${evPermsHTML(ev)}
    ${evSavedHTML()}
    <div class="ev-set-block"><div class="ev-strip-title">On your home screen</div>
      <label class="ev-switch"><input type="checkbox" ${pinned?'checked':''} onchange="evTogglePin(this.checked)"/><span>Show this event on my MAISON home screen</span></label></div>
    <div class="ev-set-block"><div class="ev-strip-title">Calendar and backup</div>
      <div class="modal-row" style="margin-top:0;flex-wrap:wrap">${evCan(ev,'schedule')?'<button class="btn-ghost" onclick="evDownloadIcs()">Download calendar file</button>':''}${ev.creator?'<button class="btn-ghost" onclick="evDownloadJson()">Download backup file</button>':''}${ev.creator&&ev.shared?'<button class="btn-ghost" onclick="evBackupsModal()">Restore from backup</button>':''}</div>
      <p class="cl-hint">${ev.creator&&ev.shared?(driveAccessToken?'A dated backup of this event is kept in your Google Drive (the last 14 days) and refreshed whenever you open MAISON.':'Cloud Sync is off, so no backup of this event is being kept in your Google Drive. <a href="#" onclick="closeModal();openSettings();return false">Turn it on in Settings</a>.'):'A full copy of this event is kept in your Google Drive with the rest of your MAISON data when Cloud Sync is on.'}</p></div>
    <div class="ev-set-block"><button class="btn-ghost danger" onclick="evDeleteEvent()">${ev.creator||!ev.shared?'Delete event':'Leave event'}</button></div>`);
}
function evSaveDetails(){
  const name=document.getElementById('es-name').value.trim();if(!name){clToast('Give it a name');return;}
  const meName=document.getElementById('es-me').value.trim();
  evMutate(activeEventId,(ev,put,meta)=>{
    meta({name,location:document.getElementById('es-loc').value.trim(),notes:document.getElementById('es-notes').value.trim()});
    if(meName&&ev.me&&meName!==ev.me.name){ev.me.name=meName;const p=(ev.people||[]).find(x=>x.id===ev.me.id);if(p)put('p_'+p.id,Object.assign({},p,{name:meName}));}
  });
  closeModal();showSection('event');
}
function evChangeDays(){
  const ev=evFind(evData(),activeEventId);if(!ev)return;
  evPickStart(ev.days);
  openModal(`<div class="modal-head"><div class="modal-title">Change days</div><button class="modal-close" onclick="closeModal()">×</button></div>
    <div id="ev-picker">${evPickerHTML()}</div>
    <div class="modal-row"><button class="btn-solid sm teal" onclick="evSaveDays()">Save days</button><button class="btn-ghost" onclick="openEventSettings()">Back</button></div>`);
}
function evSaveDays(){
  const ev=evFind(evData(),activeEventId);if(!ev)return;
  if(!evPick.sel.length){clToast('Choose at least one day');return;}
  const keep=evPick.sel.slice().sort(),gone=(ev.days||[]).filter(k=>keep.indexOf(k)<0),lost=(ev.acts||[]).filter(a=>gone.indexOf(a.day)>=0);
  const lostLists=(ev.lists||[]).filter(l=>gone.indexOf(l.day)>=0).length+(ev.privLists||[]).filter(l=>gone.indexOf(l.day)>=0).length;
  if((lost.length||lostLists)&&!confirm('Removing '+gone.length+' day'+(gone.length!==1?'s':'')+' also deletes '+lost.length+' planned activit'+(lost.length!==1?'ies':'y')+(lostLists?' and '+lostLists+' checklist'+(lostLists!==1?'s':''):'')+'. Continue?'))return;
  evMutate(activeEventId,(e,put,meta)=>{
    lost.forEach(a=>put('a_'+a.id,null));
    (e.photos||[]).filter(p=>p.day&&gone.indexOf(p.day)>=0).forEach(p=>put('ph_'+p.id,null));
    (e.lists||[]).filter(l=>gone.indexOf(l.day)>=0).forEach(l=>{(e.todos||[]).filter(t=>t.list===l.id).forEach(t=>put('k_'+t.id,null));put('l_'+l.id,null);});
    e.privLists=(e.privLists||[]).filter(l=>gone.indexOf(l.day)<0);
    meta({days:keep});
  });
  evCalMonth=null;closeModal();showSection('event');
}
async function evShareOn(){
  const d=evData(),ev=evFind(d,activeEventId);if(!ev||!evCloudOn())return;
  if(EV_AUTH&&!(await fbToken())){evReauth(()=>evShareOn());return;}
  if(!driveAccessToken&&!confirm('Cloud Sync is off, so MAISON cannot keep a backup of this event in your Google Drive. Share it anyway?\n\nOK = share anyway, Cancel = go back (turn on Cloud Sync in Settings first).'))return;
  ev.shared=true;ev.creator=true;if(!evSave(d))return;
  const b=evBoot();b.q[ev.id]=Object.entries(evAllKeys(ev)).map(([k,v])=>({k,v:JSON.parse(JSON.stringify(v))}));b.sk[ev.id]=[];b.pq[ev.id]=(ev.photos||[]).map(p=>p.id);evBootSave(b);
  clToast('Turning on sharing…');
  const ok=await evFlush(ev.id);
  if(!ok){
    const d2=evData(),e2=evFind(d2,ev.id);if(e2){e2.shared=false;evSave(d2);}
    const b2=evBoot();delete b2.q[ev.id];delete b2.sk[ev.id];evBootSave(b2);
    clToast('Could not reach the shared database. Check your connection and the setup.');openEventSettings();return;
  }
  evStartPoll();openEventSettings();showSection('event');
  evSnapshot(ev.id,true);
}
function evCopyLink(){
  const l=evLink(activeEventId);
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(l).then(()=>clToast('Link copied'),()=>prompt('Copy this link:',l));
  else prompt('Copy this link:',l);
}
function evSendLink(){
  const ev=evFind(evData(),activeEventId);if(!ev)return;
  const l=evLink(ev.id);
  if(navigator.share)navigator.share({title:ev.name,text:'Join "'+ev.name+'" on MAISON',url:l}).catch(()=>{});else evCopyLink();
}
function evTogglePin(on){
  const d=evData(),id=activeEventId,i=d.pins.indexOf(id);
  if(on&&i<0)d.pins.push(id);if(!on&&i>=0)d.pins.splice(i,1);
  evSave(d);clToast(on?'Added to your home screen':'Removed from your home screen');
}
async function evDeleteEvent(){
  const d=evData(),ev=evFind(d,activeEventId);if(!ev)return;
  const everyone=ev.shared&&ev.creator;
  if(!confirm(everyone?'Delete "'+ev.name+'" for everyone? It will disappear from every person\'s app.':ev.shared?'Leave "'+ev.name+'"? It will be removed from your app, but stays for everyone else.':'Delete "'+ev.name+'"?'))return;
  if(ev.shared&&evCloudOn()){
    if(everyone)evMutate(ev.id,(e,put,meta)=>{meta({deleted:true});});
    else evMutate(ev.id,(e,put)=>{if(ev.me)put('p_'+ev.me.id,null);});
    await evFlush(ev.id);
  }
  evRemoveLocal(ev.id);evStopPoll();activeEventId=null;evDay=null;closeModal();showSection('dayout');
}

// ── backups of events you created ──
// A dated copy of each shared event you own is kept in YOUR Google Drive (app data), separate from the main sync file, so a damaged or
// wrongly deleted event can be restored. One file per day (updated through the day), the last 14 days kept. Needs Cloud Sync switched on.
const EV_SNAP_KEEP=14;
let evSnapAt={},evSnapTimer={},evSnapLast={};
function evSnapPrefix(id){return'mzevent_'+id+'_';}
async function evDriveList(prefix){
  const out=[];let pageToken='';
  do{
    let url=`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${encodeURIComponent("name contains '"+prefix+"'")}&fields=nextPageToken,files(id,name)&pageSize=100`;
    if(pageToken)url+='&pageToken='+encodeURIComponent(pageToken);
    const j=await(await driveFetch(url,{headers:{Authorization:'Bearer '+driveAccessToken}})).json();
    (j.files||[]).forEach(f=>out.push(f));pageToken=j.nextPageToken||'';
  }while(pageToken);
  return out;
}
function evSnapSoon(id){if(!driveAccessToken)return;clearTimeout(evSnapTimer[id]);evSnapTimer[id]=setTimeout(()=>evSnapshot(id),60000);}
async function evSnapshot(evId,force){
  if(!driveAccessToken||!currentUser)return false;
  const ev=evFind(evData(),evId);if(!ev||!ev.creator||!ev.shared)return false;
  if(!force&&Date.now()-(evSnapAt[evId]||0)<300000)return false;
  evSnapAt[evId]=Date.now();
  const name=evSnapPrefix(evId)+clKey(new Date()).replace(/-/g,'')+'.json',auth={Authorization:'Bearer '+driveAccessToken};
  try{
    const files=await evDriveList(evSnapPrefix(evId)),body=JSON.stringify({v:1,saved:Date.now(),event:ev}),today=files.find(f=>f.name===name);
    if(today)await driveFetch(`https://www.googleapis.com/upload/drive/v3/files/${today.id}?uploadType=media`,{method:'PATCH',headers:Object.assign({'Content-Type':'application/json'},auth),body});
    else{
      const form=new FormData();
      form.append('metadata',new Blob([JSON.stringify({name,parents:['appDataFolder']})],{type:'application/json'}));
      form.append('file',new Blob([body],{type:'application/json'}));
      await driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',{method:'POST',headers:auth,body:form});
      files.push({id:'',name});
    }
    files.sort((a,b)=>b.name.localeCompare(a.name));
    for(const f of files.slice(EV_SNAP_KEEP)){if(f.id)await driveFetch('https://www.googleapis.com/drive/v3/files/'+f.id,{method:'DELETE',headers:auth}).catch(()=>{});}
    evSnapLast[evId]=Date.now();return true;
  }catch(e){return false;}
}
function evSnapshotAll(){evData().events.forEach(e=>{if(e.creator&&e.shared)evSnapshot(e.id);});}
async function evBackupsModal(){
  const ev=evFind(evData(),activeEventId);if(!ev)return;
  const head=`<div class="modal-head"><div class="modal-title">Restore from backup</div><button class="modal-close" onclick="closeModal()">×</button></div>`;
  if(!driveAccessToken){openModal(head+`<p class="cl-hint">Cloud Sync is off, so there are no backups to restore from. Turn it on in Settings, and MAISON will start keeping them.</p>`);return;}
  openModal(head+`<p class="cl-hint">Looking for backups…</p>`);
  let files=null;try{files=(await evDriveList(evSnapPrefix(ev.id))).sort((a,b)=>b.name.localeCompare(a.name));}catch(e){}
  const rows=(files||[]).map(f=>{const m=/_(\d{4})(\d\d)(\d\d)\.json$/.exec(f.name);return m?`<div class="ev-bk"><span>${escHtml(evLong(m[1]+'-'+m[2]+'-'+m[3]))}</span><button class="btn-ghost" onclick="evRestore('${f.id}')">Restore</button></div>`:'';}).join('');
  openModal(head+(files===null?`<p class="cl-hint">Could not read your backups. Check your connection and try again.</p>`:rows?`<p class="cl-hint">Pick a day. The event goes back to how it was then, for everyone.</p>${rows}`:`<p class="cl-hint">No backups yet. One is made each day you open MAISON, once the event is shared.</p>`));
}
async function evRestore(fileId){
  if(!confirm('Restore this backup? The event goes back to how it was on that day, for everyone who has it.'))return;
  let snap=null;
  try{snap=await(await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,{headers:{Authorization:'Bearer '+driveAccessToken}})).json();}catch(e){}
  const s=snap&&snap.event;
  if(!s||!s.name||!Array.isArray(s.days)){clToast('That backup could not be read');return;}
  evMutate(activeEventId,(ev,put,meta)=>{
    meta({name:s.name,location:s.location||'',notes:s.notes||'',days:s.days,startTime:s.startTime||'09:00'});
    // Every kind of record (activities, checklists, day details, photos, suggestions, votes…) goes back to the snapshot; anything newer is removed.
    // People are the exception: anyone who joined since stays.
    const target=evAllKeys(s),keep=new Set();
    Object.keys(target).forEach(k=>{
      if(k==='meta')return;
      if(k.indexOf('p_')===0){if(!(ev.people||[]).some(x=>'p_'+x.id===k))put(k,target[k]);return;}
      put(k,target[k]);keep.add(k);
    });
    Object.keys(evAllKeys(ev)).forEach(k=>{if(k==='meta'||k.indexOf('p_')===0||keep.has(k))return;put(k,null);});
  });
  closeModal();evDay=null;evCalMonth=null;showSection('event');clToast('Backup restored');
}
function evDownloadJson(){
  const ev=evFind(evData(),activeEventId);if(!ev)return;
  const blob=new Blob([JSON.stringify({v:1,saved:Date.now(),event:ev},null,1)],{type:'application/json'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=(ev.name.replace(/[^\w]+/g,'-')||'event')+'-backup.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);
}

// ── joining from a link ──
// Remember an invite link (it lives in the URL hash, which sign-in and the Drive reconnect redirects would otherwise lose).
function evStashInvite(){
  const m=/[#&]event=([0-9a-f]{32})/.exec(location.hash||'');
  if(m){try{sessionStorage.setItem('maison_pending_event',m[1]);history.replaceState(null,'',location.pathname+location.search);}catch(e){}}
}
function evHandleHash(){
  evStashInvite();
  let id=null;try{id=sessionStorage.getItem('maison_pending_event');}catch(e){}
  if(!id||!currentUser)return;
  try{sessionStorage.removeItem('maison_pending_event');}catch(e){}
  evOpenInvite(id);
}
function evOpenInvite(id){
  if(evFind(evData(),id)){openEvent(id);return;}
  if(!evCloudOn()){openModal(`<div class="modal-head"><div class="modal-title">Event invitation</div><button class="modal-close" onclick="closeModal()">×</button></div><p class="cl-hint">This link is for a shared event, but sharing is not set up in this copy of MAISON yet.</p>`);return;}
  openModal(`<div class="modal-head"><div class="modal-title">Event invitation</div><button class="modal-close" onclick="closeModal()">×</button></div><p class="cl-hint">Opening the event…</p>`);
  evFetchRemote(id).then(res=>{
    if(!res.ok&&res.code==='auth'){evReauth(()=>evOpenInvite(id));return;}   // needs a database sign-in first, then carries on
    if(!res.ok||!res.remote.meta||res.remote.meta.deleted){
      openModal(`<div class="modal-head"><div class="modal-title">Event invitation</div><button class="modal-close" onclick="closeModal()">×</button></div><p class="cl-hint">${res.code==='net'?'Could not reach the event. Check your connection and open the link again.':res.code===403?'This event could not be opened with your account.':'This event could not be found. It may have been deleted.'}</p>`);return;
    }
    const meta=res.remote.meta;
    window.__evJoin={id,remote:res.remote};
    openModal(`<div class="modal-head"><div class="modal-title">You're invited</div><button class="modal-close" onclick="closeModal()">×</button></div>
      <div class="ev-invite"><div class="ev-card-name">${escHtml(meta.name)}</div><div class="ev-card-sub">${escHtml(evRange({days:meta.days}))}${meta.location?' · '+escHtml(meta.location):''}</div>${meta.owner?`<div class="ev-card-sub">From ${escHtml(meta.owner.name)}</div>`:''}</div>
      <label class="field-label">Your name in this event</label><input id="ej-name" class="field-input" value="${escHtml(currentUserName||'')}"/>
      <div class="modal-row"><button class="btn-solid sm teal" onclick="evJoin()">Join event</button><button class="btn-ghost" onclick="closeModal()">Not now</button></div>`);
  });
}
function evJoin(){
  const j=window.__evJoin;if(!j)return;
  const name=document.getElementById('ej-name').value.trim()||currentUserName||'Guest';
  const ev={id:j.id,shared:true,creator:false,me:{id:uid(),name},acts:[],todos:[],people:[],upd:Date.now(),created:Date.now()};
  Object.keys(j.remote).forEach(k=>evApply(ev,k,j.remote[k]));
  const d=evData();d.events.push(ev);if(!evSave(d))return;
  const b=evBoot();b.sk[j.id]=Object.keys(j.remote);b.q[j.id]=[];evBootSave(b);
  evMutate(j.id,(e,put)=>{put('p_'+ev.me.id,{id:ev.me.id,name,out:[]});put('h_'+ev.me.id,{id:ev.me.id,hide:['costs'],role:'guest',upd:Date.now()});});   // newcomers start as guests with costs hidden; the organiser can change this in Settings
  window.__evJoin=null;closeModal();openEvent(j.id);
}

