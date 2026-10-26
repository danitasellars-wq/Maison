// MAISON · events-day.js — plain script, shares globals with the other files in js/ (load order is set in index.html).
// ── checklists (inside each day) ──
// A checklist belongs to one day and is either SHARED (a header `l_<id>` plus items `k_<id>` in the shared event, so everyone sees and ticks it)
// or PRIVATE (kept only in this person's own copy, `ev.privLists`, never sent to the shared event; it still rides their own Drive backup).
// Items from before checklists were per-day have no `list`; they show as one shared list called "Checklist" on the first day, so nothing is lost.
function evListsFor(ev,day){
  const todos=ev.todos||[],out=[];
  (ev.lists||[]).filter(l=>l.day===day).forEach(l=>out.push({id:l.id,title:l.title,shared:true,mine:!!(l.owner&&l.owner.id===(ev.me||{}).id),items:todos.filter(t=>t.list===l.id),at:l.upd||0}));
  const legacy=todos.filter(t=>!t.list||t.list==='legacy');
  if(day===evDaysSorted(ev)[0]&&legacy.length)out.push({id:'legacy',title:'Checklist',shared:true,mine:false,legacy:true,items:legacy,at:0});
  (ev.privLists||[]).filter(l=>l.day===day).forEach(l=>out.push({id:l.id,title:l.title,shared:false,mine:true,items:l.items||[],at:l.upd||0}));
  return out.sort((a,b)=>a.at-b.at);
}
function evListCardHTML(l){
  const done=l.items.filter(t=>t.done).length;
  const items=l.items.slice().sort((a,b)=>(a.done?1:0)-(b.done?1:0)||(a.upd||0)-(b.upd||0)).map(t=>`<div class="ev-todo${t.done?' done':''}"><label><input type="checkbox" ${t.done?'checked':''} onchange="evToggleItem('${l.id}','${t.id}')"/><span>${escHtml(t.text)}</span></label><button class="icon-btn" title="Remove" aria-label="Remove ${escHtml(t.text)}" onclick="evDelItem('${l.id}','${t.id}')">×</button></div>`).join('');
  return`<div class="ev-list"><div class="ev-list-head"><div class="ev-list-title">${escHtml(l.title)}${l.items.length?` <span class="of-meta">${done} of ${l.items.length}</span>`:''}</div><span class="ev-vis ${l.shared?'shared':'private'}">${l.shared?'Shared':'Only you'}</span>${l.mine&&!l.legacy?`<button class="btn-ghost" style="padding:3px 10px;font-size:12px" onclick="evListModal('${l.id}')">Edit</button>`:''}</div>
    <div class="ev-add"><input id="evi-${l.id}" class="field-input" placeholder="Add something to bring or do…" autocomplete="off" onkeydown="if(event.key==='Enter')evAddItem('${l.id}')"/><button class="btn-ghost" onclick="evAddItem('${l.id}')">Add</button></div>
    ${items}</div>`;
}
function evListsHTML(ev,day){
  const lists=evListsFor(ev,day);
  return`<div class="ev-block"><div class="flex-between mb14"><div class="ev-strip-title">Checklists</div><button class="btn-ghost" onclick="evListModal(null)">+ New list</button></div>
    ${lists.map(evListCardHTML).join('')}</div>`;
}
function evAddItem(listId){
  const inp=document.getElementById('evi-'+listId),text=inp&&inp.value.trim();if(!text)return;
  evMutate(activeEventId,(ev,put)=>{
    const id=uid(),pl=(ev.privLists||[]).find(l=>l.id===listId);
    if(pl){pl.items=(pl.items||[]).concat([{id,text,done:false,upd:Date.now()}]);return;}
    put('k_'+id,{id,list:listId,text,done:false,by:(ev.me||{}).name||'',upd:Date.now()});
  });
  showSection('event');const n=document.getElementById('evi-'+listId);if(n)n.focus();
}
function evToggleItem(listId,itemId){
  evMutate(activeEventId,(ev,put)=>{
    const pl=(ev.privLists||[]).find(l=>l.id===listId);
    if(pl){const t=(pl.items||[]).find(x=>x.id===itemId);if(t){t.done=!t.done;t.upd=Date.now();}return;}
    const t=(ev.todos||[]).find(x=>x.id===itemId);if(t)put('k_'+itemId,Object.assign({},t,{done:!t.done,upd:Date.now()}));
  });
  showSection('event');
}
function evDelItem(listId,itemId){
  evMutate(activeEventId,(ev,put)=>{
    const pl=(ev.privLists||[]).find(l=>l.id===listId);
    if(pl){pl.items=(pl.items||[]).filter(x=>x.id!==itemId);return;}
    put('k_'+itemId,null);
  });
  showSection('event');
}
function evListModal(listId){
  const ev=evFind(evData(),activeEventId);if(!ev)return;
  const l=listId?evListsFor(ev,evDay).find(x=>x.id===listId):null;if(listId&&!l)return;
  const shared=l?l.shared:true;
  openModal(`<div class="modal-head"><div class="modal-title">${l?'Edit checklist':'New checklist'}</div><button class="modal-close" onclick="closeModal()">×</button></div>
    <label class="field-label">Name</label><input id="el-title" class="field-input" value="${escHtml(l?l.title:'')}" placeholder="e.g. Things to bring" autocomplete="off"/>
    <label class="field-label">Who can see it</label>
    <div class="cl-chips"><label class="cl-chip"><input type="radio" name="el-vis" value="shared"${shared?' checked':''}/><span>Shared with everyone</span></label><label class="cl-chip"><input type="radio" name="el-vis" value="private"${shared?'':' checked'}/><span>Private, just me</span></label></div>
    <p class="cl-hint">A private list stays on your own devices and in your own Google Drive backup. Nobody else on the event can see it.</p>
    <div class="modal-row"><button class="btn-solid sm teal" onclick="evListSave(${l?`'${l.id}'`:'null'})">${l?'Save':'Create'}</button><button class="btn-ghost" onclick="closeModal()">Cancel</button>${l?`<button class="btn-ghost danger" onclick="evListDelete('${l.id}')">Delete list</button>`:''}</div>`);
}
function evListSave(listId){
  const title=document.getElementById('el-title').value.trim()||'Checklist';
  const vis=((document.querySelector('input[name=el-vis]:checked')||{}).value==='private')?'private':'shared',day=evDay;
  if(!listId){
    evMutate(activeEventId,(ev,put)=>{
      const id=uid(),me=ev.me||{};
      if(vis==='private')ev.privLists=(ev.privLists||[]).concat([{id,day,title,items:[],upd:Date.now()}]);
      else put('l_'+id,{id,day,title,owner:{id:me.id,name:me.name},upd:Date.now()});
    });
  }else{
    const ev0=evFind(evData(),activeEventId),cur=ev0&&evListsFor(ev0,day).find(x=>x.id===listId);if(!cur)return;
    if(cur.shared&&vis==='private'&&!confirm('Make this list private? Everyone else on the event will stop seeing it.'))return;
    if(!cur.shared&&vis==='shared'&&!confirm('Share this list with everyone on the event?'))return;
    evMutate(activeEventId,(ev,put)=>{
      const me=ev.me||{};
      if(cur.shared&&vis==='shared'){const l=(ev.lists||[]).find(x=>x.id===listId);if(l)put('l_'+listId,Object.assign({},l,{title}));}
      else if(!cur.shared&&vis==='private'){const pl=(ev.privLists||[]).find(x=>x.id===listId);if(pl)pl.title=title;}
      else if(cur.shared){   // shared -> private: take it (and its items) out of the shared event
        const l=(ev.lists||[]).find(x=>x.id===listId),items=(ev.todos||[]).filter(t=>t.list===listId);
        ev.privLists=(ev.privLists||[]).concat([{id:listId,day,title,items:items.map(t=>({id:t.id,text:t.text,done:!!t.done,upd:t.upd||0})),upd:(l&&l.upd)||Date.now()}]);
        put('l_'+listId,null);items.forEach(t=>put('k_'+t.id,null));
      }else{                 // private -> shared
        const pl=(ev.privLists||[]).find(x=>x.id===listId);if(!pl)return;
        ev.privLists=ev.privLists.filter(x=>x.id!==listId);
        put('l_'+listId,{id:listId,day,title,owner:{id:me.id,name:me.name},upd:pl.upd||Date.now()});
        (pl.items||[]).forEach(t=>put('k_'+t.id,{id:t.id,list:listId,text:t.text,done:!!t.done,by:me.name||'',upd:t.upd||Date.now()}));
      }
    });
  }
  closeModal();showSection('event');
}
function evListDelete(listId){
  const ev0=evFind(evData(),activeEventId),cur=ev0&&evListsFor(ev0,evDay).find(x=>x.id===listId);if(!cur)return;
  if(!confirm('Delete "'+cur.title+'"'+(cur.items.length?' and its '+cur.items.length+' item'+(cur.items.length!==1?'s':''):'')+'?'))return;
  evMutate(activeEventId,(ev,put)=>{
    if((ev.privLists||[]).some(l=>l.id===listId)){ev.privLists=ev.privLists.filter(l=>l.id!==listId);return;}
    (ev.todos||[]).filter(t=>t.list===listId).forEach(t=>put('k_'+t.id,null));put('l_'+listId,null);
  });
  closeModal();showSection('event');
}

// Who is going on a day = people whose `out` list does not include that day. Removing someone adds the day to their `out`; adding takes it off.
// A guest (someone without MAISON) who is removed from their last day is deleted.
function evDayRemove(pid){
  const day=evDay;
  evMutate(activeEventId,(ev,put)=>{
    const p=(ev.people||[]).find(x=>x.id===pid);if(!p)return;
    const out=(p.out||[]).slice();if(out.indexOf(day)<0)out.push(day);
    if(p.guest&&(ev.days||[]).every(d=>out.indexOf(d)>=0)){put('p_'+pid,null);return;}
    put('p_'+pid,Object.assign({},p,{out}));
  });
  showSection('event');
}
function evDayAdd(pid){
  const day=evDay;
  evMutate(activeEventId,(ev,put)=>{
    const p=(ev.people||[]).find(x=>x.id===pid);if(!p)return;
    put('p_'+pid,Object.assign({},p,{out:(p.out||[]).filter(d=>d!==day)}));
  });
  showSection('event');evPeopleModal();
}
function evDayAddGuest(){
  const inp=document.getElementById('ev-guest'),name=inp&&inp.value.trim();if(!name){clToast('Type a name first');return;}
  const day=evDay;
  evMutate(activeEventId,(ev,put)=>{
    const id=uid();
    put('p_'+id,{id,name,guest:true,out:(ev.days||[]).filter(d=>d!==day),by:(ev.me||{}).name||''});
  });
  showSection('event');evPeopleModal();
}
function evPeopleModal(){
  const ev=evFind(evData(),activeEventId);if(!ev)return;
  const away=(ev.people||[]).filter(p=>(p.out||[]).indexOf(evDay)>=0);
  openModal(`<div class="modal-head"><div class="modal-title">Who is going</div><button class="modal-close" onclick="closeModal()">×</button></div>
    <p class="cl-hint" style="margin-top:0">${escHtml(evLong(evDay))}</p>
    ${away.length?`<label class="field-label">Not on this day. Tap to add</label><div class="ev-people" style="margin-bottom:18px">${away.map(p=>`<button class="ev-person add" onclick="evDayAdd('${p.id}')"><i>${escHtml(evInitials(p.name))}</i>${escHtml(p.name)}${p.guest?'<em>guest</em>':''}<b>+</b></button>`).join('')}</div>`:''}
    <label class="field-label">Add someone new (they don't need MAISON)</label>
    <div class="ev-add"><input id="ev-guest" class="field-input" placeholder="Name" autocomplete="off" onkeydown="if(event.key==='Enter')evDayAddGuest()"/><button class="btn-solid sm teal" onclick="evDayAddGuest()">Add</button></div>
    <div class="modal-row"><button class="btn-ghost" onclick="closeModal()">Done</button></div>`);
}
// Title and overview are saved a moment after you stop typing (and straight away when you leave the box), without redrawing the page.
let evTextTimers={};
function evDayTextSoon(field,el){
  const day=evDay;clearTimeout(evTextTimers[field]);
  evTextTimers[field]=setTimeout(()=>evDayField(field,el.value.trim(),day),800);
}

// ── activities ──
// ── activity types: icons, journeys, saved places, moving, guest visibility ──
const EV_CATS=['Activity','Food & Drink','Drinks','Shopping','Journey','Other'];   // offered when adding; older 'Travel' activities still work
const EV_CAT_MINS=Object.assign({},DO_CAT_MINS,{'Drinks':60,'Journey':90});
const EV_ICON={
  'Activity':'<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2M13 11v2M13 17v2"/>',
  'Food & Drink':'<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  'Drinks':'<path d="M8 22h8M12 15v7M7 10h10"/><path d="M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z"/>',
  'Shopping':'<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  'Journey':'<circle cx="6" cy="19" r="2.6"/><circle cx="18" cy="5" r="2.6"/><path d="M8.6 19h7.9a3.5 3.5 0 0 0 0-7h-9a3.5 3.5 0 0 1 0-7h8"/>',
  'Other':'<path d="M12 21s-6-5.2-6-10a6 6 0 0 1 12 0c0 4.8-6 10-6 10z"/><circle cx="12" cy="11" r="2.2"/>'
};
EV_ICON['Travel']=EV_ICON['Journey'];
const EV_MODES=[['car','Car'],['train','Train'],['plane','Flight'],['bus','Bus'],['boat','Boat'],['walk','Walk']];
const EV_MODE_ICON={
  car:'<path d="M4 15l1.6-4.8A2 2 0 0 1 7.5 9h9a2 2 0 0 1 1.9 1.2L20 15"/><rect x="3" y="15" width="18" height="4.5" rx="1.6"/><path d="M7 19.5V21M17 19.5V21"/>',
  train:'<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M9 21l2-4M15 21l-2-4"/><path d="M9 14h.01M15 14h.01"/>',
  plane:'<path d="M3 12l18-8-5 16-4.5-5.5L7 17v-5z"/><path d="M11.5 14.5L21 4"/>',
  bus:'<rect x="4" y="3" width="16" height="15" rx="3"/><path d="M4 11h16M7 21v-3M17 21v-3"/><path d="M8 14.5h.01M16 14.5h.01"/>',
  boat:'<path d="M3 17l2 3h14l2-3z"/><path d="M12 3v11M12 4l6 8h-6M11 7l-5 5h5"/>',
  walk:'<circle cx="13" cy="4.5" r="1.6"/><path d="M9.5 21l2.2-6-2.2-2.3 1.8-4.7 3 1.2 2 3.3M11.7 15l3.1 2 .9 4"/>'
};
function evCatIcon(cat,mode,size){
  const body=((cat==='Journey'||cat==='Travel')&&mode&&EV_MODE_ICON[mode])||EV_ICON[cat]||EV_ICON['Other'];
  return`<svg class="evi" width="${size||19}" height="${size||19}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
// Guests: the creator marks people as hosts or guests in Settings; an activity can be hidden from guests.
function evGuest(ev){if(ev.creator)return false;const x=(ev.perms||[]).find(p=>p.id===(ev.me||{}).id);return!!(x&&x.role==='guest');}
function evVisAct(ev,a){return!(evGuest(ev)&&(a.hideGuests||evDayHidden(ev,a.day)));}
function evActsVis(ev){return(ev.acts||[]).filter(a=>evVisAct(ev,a));}

// ── saved places (yours, kept across all your events) ──
let evForm={picked:{}};
function evPlaces(){return userData('places',[]);}
function evPlaceOpts(){return'<option value="">Saved places…</option>'+evPlaces().map(p=>`<option value="${p.id}">${escHtml(p.name)}</option>`).join('');}
function evPlacePick(inputId,pid){
  if(!pid)return;const p=evPlaces().find(x=>x.id===pid);if(!p)return;
  const inp=document.getElementById(inputId);if(inp)inp.value=p.name;
  evForm.picked[inputId]={name:p.name,lat:p.lat,lon:p.lon,mapUrl:p.mapUrl||''};
  const sel=document.getElementById(inputId+'-sel');if(sel)sel.value='';
}
function evFormEdited(inputId){const inp=document.getElementById(inputId),pk=evForm.picked[inputId];if(pk&&inp&&inp.value.trim()!==pk.name)delete evForm.picked[inputId];}
async function evPlaceSave(inputId){
  const inp=document.getElementById(inputId),text=inp&&inp.value.trim();if(!text){clToast('Type the place first');return;}
  const name=(prompt('Name this place so you can pick it again (e.g. Greg and Glynis House):',text)||'').trim();if(!name)return;
  const ev=evFind(evData(),activeEventId);
  let co=evForm.picked[inputId];
  if(!co){clToast('Finding the place…');const g=await evGeocode(text,ev&&ev.location);co=g?{lat:g.lat,lon:g.lon,mapUrl:g.mapUrl||''}:{lat:null,lon:null,mapUrl:''};}
  const list=evPlaces().filter(p=>p.name.toLowerCase()!==name.toLowerCase());
  list.push({id:uid(),name,where:text,lat:co.lat,lon:co.lon,mapUrl:co.mapUrl||''});
  saveData('places',list);
  inp.value=name;evForm.picked[inputId]={name,lat:co.lat,lon:co.lon,mapUrl:co.mapUrl||''};
  document.querySelectorAll('.ev-placesel').forEach(s=>{s.innerHTML=evPlaceOpts();});
  clToast(co.lat!=null?'Place saved':'Saved (no map pin found for it)');
}
function evSavedHTML(){
  const pl=evPlaces(),hs=userData('hosts',[]);if(!pl.length&&!hs.length)return'';
  const row=(n,sub,fn,id)=>`<div class="ev-saved"><span><b>${escHtml(n)}</b>${sub?`<i>${escHtml(sub)}</i>`:''}</span><button class="icon-btn" aria-label="Forget ${escHtml(n)}" onclick="${fn}('${id}')">×</button></div>`;
  return`<div class="ev-set-block"><div class="ev-strip-title">Your saved places and hosts</div><p class="cl-hint">Only on your account. Saved when you add an activity or a host; forget any here.</p>${pl.map(p=>row(p.name,p.where,'evPlaceDelete',p.id)).join('')}${hs.map(h=>row(h.name,h.place||'Host','evHostDelete',h.id)).join('')}</div>`;
}
function evPlaceDelete(pid){saveData('places',evPlaces().filter(p=>p.id!==pid));openEventSettings();}
function evHostDelete(hid){saveData('hosts',(userData('hosts',[])).filter(h=>h.id!==hid));openEventSettings();}

// ── the add / edit activity form ──
function evCatChips(sel){
  const list=EV_CATS.concat(sel&&EV_CATS.indexOf(sel)<0&&sel!=='Travel'?[sel]:[]);
  return list.map(c=>`<button type="button" class="ev-catchip${(c===sel||(sel==='Travel'&&c==='Journey'))?' on':''}" data-cat="${escHtml(c)}" onclick="evFormCat(this.dataset.cat)">${evCatIcon(c,null,21)}<span>${escHtml(c==='Food & Drink'?'Food':c)}</span></button>`).join('');
}
function evFormCat(cat){
  document.getElementById('ea-cat').value=cat;
  document.querySelectorAll('.ev-catchip').forEach(b=>b.classList.toggle('on',b.dataset.cat===cat));
  const j=cat==='Journey';
  document.getElementById('ea-jny').style.display=j?'':'none';
  document.getElementById('ea-std').style.display=j?'none':'';
}
function evFormMode(mode){
  document.getElementById('ea-mode').value=mode;
  document.querySelectorAll('.ev-modechip').forEach(b=>b.classList.toggle('on',b.dataset.mode===mode));
}
function evPlaceField(id,label,val,ph){
  return`<label class="field-label">${label}</label><input id="${id}" class="field-input" value="${escHtml(val||'')}" placeholder="${escHtml(ph)}" autocomplete="off" oninput="evFormEdited('${id}')"/>
    <div class="ev-placerow"><select id="${id}-sel" class="ev-placesel" onchange="evPlacePick('${id}',this.value)">${evPlaceOpts()}</select><button type="button" class="ev-addph" onclick="evPlaceSave('${id}')">Save this place</button></div>`;
}
function evActForm(actId,part,pre){
  const ev=evFind(evData(),activeEventId);if(!ev)return;
  const a=actId?(ev.acts||[]).find(x=>x.id===actId):null;if(actId&&!a)return;
  const v=a||Object.assign({cat:'Activity',day:evDay||evDaysSorted(ev)[0],part:part==='eve'?'eve':'day'},pre||{}),pt=(v.part||'day');
  const cat=(v.cat==='Travel')?'Journey':v.cat,j=cat==='Journey';
  evForm={picked:{}};
  openModal(`<div class="modal-head"><div class="modal-title">${a?'Edit activity':'Add activity'}</div><button class="modal-close" onclick="closeModal()">×</button></div>
    ${a&&a.by?`<p class="cl-hint" style="margin:-6px 0 14px">Added by ${escHtml(a.by)}</p>`:''}
    <label class="field-label">What kind of thing is it?</label>
    <div class="ev-catrow">${evCatChips(cat)}</div><input type="hidden" id="ea-cat" value="${escHtml(cat)}"/>
    <label class="field-label">Name</label><input id="ea-name" class="field-input" value="${escHtml(v.name||'')}" placeholder="${j?'Optional, e.g. Train to St Ives':'e.g. Lunch at The Seafood Bar'}" autocomplete="off"/>
    <div id="ea-jny" style="display:${j?'':'none'}">
      <label class="field-label">How</label>
      <div class="ev-catrow">${EV_MODES.map(([k,l])=>`<button type="button" class="ev-catchip ev-modechip${(v.mode||'car')===k?' on':''}" data-mode="${k}" onclick="evFormMode('${k}')">${evCatIcon('Journey',k,21)}<span>${l}</span></button>`).join('')}</div><input type="hidden" id="ea-mode" value="${escHtml(v.mode||'car')}"/>
      ${evPlaceField('ea-from','From',v.from,'Where does it start?')}
      ${evPlaceField('ea-to','To',v.to,'Where does it end?')}
      <div class="ev-two"><div><label class="field-label">Departs</label><input id="ea-dep" class="field-input" type="time" value="${escHtml(v.dep||v.time||'')}"/></div><div><label class="field-label">Arrives</label><input id="ea-arr" class="field-input" type="time" value="${escHtml(v.arr||'')}"/></div></div>
    </div>
    <div id="ea-std" style="display:${j?'none':''}">
      ${evPlaceField('ea-where','Location',v.where,'A place name, or paste a Google Maps link')}
      <label class="ev-switch" style="margin:-6px 0 6px"><input type="checkbox" id="ea-pin"${v.pin===false?'':' checked'}/><span>Show on the map</span></label>
      ${v.where&&v.pin!==false&&!j?`<p class="cl-hint" style="margin-top:0">${v.lat!=null?'Pinned on the map.':'No pin yet: that place was not found. Add the town, or paste a Google Maps link.'}</p>`:''}
      <div class="ev-two"><div><label class="field-label">Starts</label><input id="ea-time" class="field-input" type="time" value="${escHtml(j?'':(v.time||''))}"/></div><div><label class="field-label">Minutes</label><input id="ea-mins" class="field-input" type="number" min="5" step="5" value="${j?'':(v.mins||'')}" placeholder="Usual length"/></div></div>
    </div>
    <label class="field-label">Which part of the day</label><select id="ea-part" class="field-input"><option value="day"${pt==='day'?' selected':''}>Day out</option><option value="eve"${pt==='eve'?' selected':''}>Evening</option></select>
    <label class="field-label">Day</label><select id="ea-day" class="field-input">${evDaysSorted(ev).filter(k=>!evDayBlank(ev,k)).map(k=>`<option value="${k}"${v.day===k?' selected':''}>${escHtml(evLong(k))}</option>`).join('')}</select>
    <label class="field-label">Link</label><input id="ea-link" class="field-input" type="url" value="${escHtml(v.link||'')}" placeholder="https://…"/>
    ${evCan(ev,'costs')?`<label class="field-label">Price (for the whole group)</label><input id="ea-price" class="field-input" type="number" value="${v.price||''}" placeholder="0.00" min="0" step="0.01"/>`:''}
    <label class="field-label">Notes</label><input id="ea-notes" class="field-input" value="${escHtml(v.notes||'')}" placeholder="Booking reference, what to bring…" autocomplete="off"/>
    ${ev.creator?`<label class="ev-switch" style="margin:2px 0 12px"><input type="checkbox" id="ea-hideg"${v.hideGuests?' checked':''}/><span>Hide from guests</span></label>`:''}
    <div class="modal-row"><button class="btn-solid sm teal" onclick="evSaveAct(${actId?`'${actId}'`:'null'})">${a?'Save':'Add'}</button><button class="btn-ghost" onclick="closeModal()">Cancel</button></div>`);
}
// Looks a place up only when it has changed (or has no pin yet). A saved place brings its own coordinates; a pasted Google Maps link is read directly.
async function evResolve(inputId,text,prev,near){
  if(!text)return{lat:null,lon:null,mapUrl:''};
  const pk=evForm.picked[inputId];if(pk&&pk.name===text)return{lat:pk.lat,lon:pk.lon,mapUrl:pk.mapUrl||'',guess:false};
  if(prev&&prev.text===text&&prev.lat!=null)return{lat:prev.lat,lon:prev.lon,mapUrl:prev.mapUrl||'',guess:!!prev.guess};
  const g=await evGeocode(text,near);
  if(g&&g.failed)return{lat:null,lon:null,mapUrl:g.mapUrl||'',name:g.name||'',missed:true,short:!!g.short};
  return g?{lat:g.lat,lon:g.lon,mapUrl:g.mapUrl||'',name:(g.fromUrl&&g.name)?g.name:'',guess:!!g.guess}:{lat:null,lon:null,mapUrl:'',missed:true};
}
async function evSaveAct(actId){
  const cat=document.getElementById('ea-cat').value,isJ=cat==='Journey',val=id=>{const e=document.getElementById(id);return e?e.value.trim():'';};
  const from=isJ?val('ea-from'):'',to=isJ?val('ea-to'):'';
  let name=val('ea-name');if(!name&&isJ&&(from||to))name=(from||'Start')+' to '+(to||'end');
  if(!name){clToast('Give it a name');return;}
  const rec={name,cat,part:document.getElementById('ea-part').value==='eve'?'eve':'day',day:document.getElementById('ea-day').value,link:val('ea-link'),notes:val('ea-notes')};
  const pe=document.getElementById('ea-price');if(pe)rec.price=parseFloat(pe.value)||0;   // hidden for people who can't see costs: keep the existing price
  const he=document.getElementById('ea-hideg');if(he)rec.hideGuests=he.checked;
  const moved=rec.day!==evDay;
  const evNow=evFind(evData(),activeEventId),cur=actId&&evNow?(evNow.acts||[]).find(x=>x.id===actId):null,near=evNow&&evNow.location;
  let missed=false,short=false;
  const btn=document.querySelector('#modal-box .btn-solid');
  const busy=()=>{if(btn){btn.disabled=true;btn.textContent='Finding the places…';}};
  if(isJ){
    rec.mode=val('ea-mode')||'car';rec.from=from;rec.to=to;rec.dep=val('ea-dep');rec.arr=val('ea-arr');rec.pin=true;
    rec.time=rec.dep;rec.where='';
    const d0=doToMin(rec.dep),d1=doToMin(rec.arr);rec.mins=(d0!=null&&d1!=null)?((d1-d0+1440)%1440):0;
    busy();
    const s=await evResolve('ea-from',from,cur&&{text:cur.from,lat:cur.lat,lon:cur.lon,mapUrl:cur.mapUrl,guess:cur.guess},near);
    const e=await evResolve('ea-to',to,cur&&{text:cur.to,lat:cur.lat2,lon:cur.lon2,mapUrl:''},near);
    rec.lat=s.lat;rec.lon=s.lon;rec.mapUrl=s.mapUrl||'';rec.lat2=e.lat;rec.lon2=e.lon;rec.guess=!!(s.guess||e.guess);
    if((from&&s.lat==null)||(to&&e.lat==null))missed=true;
  }else{
    rec.where=val('ea-where');rec.time=val('ea-time');rec.mins=parseInt(val('ea-mins'),10)||0;
    const wantPin=(document.getElementById('ea-pin')||{checked:true}).checked;rec.pin=wantPin;
    rec.mode='';rec.from='';rec.to='';rec.dep='';rec.arr='';rec.lat2=null;rec.lon2=null;
    if(!rec.where||!wantPin){rec.lat=null;rec.lon=null;rec.mapUrl='';rec.guess=false;}
    else{
      if(!(cur&&cur.where===rec.where&&cur.lat!=null))busy();
      const g=await evResolve('ea-where',rec.where,cur&&{text:cur.where,lat:cur.lat,lon:cur.lon,mapUrl:cur.mapUrl,guess:cur.guess},near);
      rec.lat=g.lat;rec.lon=g.lon;rec.mapUrl=g.mapUrl||'';rec.guess=!!g.guess;if(g.name)rec.where=g.name;if(g.missed)missed=true;if(g.short)short=true;
    }
  }
  evMutate(activeEventId,(ev,put)=>{
    const c2=actId?(ev.acts||[]).find(x=>x.id===actId):null,id=c2?c2.id:uid();
    put('a_'+id,Object.assign({},c2||{by:(ev.me||{}).name||''},rec,{id,upd:Date.now()}));
  });
  closeModal();showSection('event');if(short)clToast('Saved, but that short Google link cannot be read. Type the place name, or paste the long link from a computer.');else if(missed)clToast('Saved, but a place could not be found for the map');else if(moved)clToast('Saved on '+evShort(rec.day));
}
// Move an activity to another day (and/or between Day out and Evening) in one tap.
function evMoveModal(actId){
  const ev=evFind(evData(),activeEventId),a=ev&&(ev.acts||[]).find(x=>x.id===actId);if(!a)return;
  const days=evDaysSorted(ev);
  openModal(`<div class="modal-head"><div class="modal-title">Move to another day</div><button class="modal-close" onclick="closeModal()">×</button></div>
    <p class="cl-hint" style="margin-top:0">${escHtml(a.name)}</p>
    <div class="ev-movelist">${days.map((k,i)=>{const t=(evDayInfo(ev,k).title)||evShort(k);return`<button class="ev-movebtn${k===a.day?' on':''}" ${k===a.day?'disabled':''} onclick="evMoveTo('${a.id}','${k}')"><span>Day ${i+1}</span><b>${escHtml(t)}</b><em>${escHtml(evShort(k))}</em></button>`;}).join('')}</div>
    <div class="ev-seg-row" style="justify-content:flex-start;margin-top:14px"><div class="ev-seg"><button class="${(a.part||'day')==='day'?'on':''}" onclick="evMoveTo('${a.id}',null,'day')">Day out</button><button class="${a.part==='eve'?'on':''}" onclick="evMoveTo('${a.id}',null,'eve')">Evening</button></div></div>
    <div class="modal-row"><button class="btn-ghost" onclick="closeModal()">Close</button></div>`);
}
function evMoveTo(actId,day,part){
  evMutate(activeEventId,(ev,put)=>{
    const a=(ev.acts||[]).find(x=>x.id===actId);if(!a)return;
    put('a_'+actId,Object.assign({},a,{day:day||a.day,part:part||a.part||'day',upd:Date.now()}));
  });
  closeModal();showSection('event');clToast(day?'Moved to '+evShort(day):'Moved to '+(part==='eve'?'the evening':'the day'));
}
// Real Google Maps, inline: a place (with Google's own card: name, photo, link) or a journey's route.
function evEmbedURL(a){
  if((a.cat==='Journey'||a.cat==='Travel')&&(a.from||a.to)){
    const pt=(t,la,lo)=>t||(la!=null?la+','+lo:'');
    return'https://www.google.com/maps?saddr='+encodeURIComponent(pt(a.from,a.lat,a.lon))+'&daddr='+encodeURIComponent(pt(a.to,a.lat2,a.lon2))+'&output=embed';
  }
  if(a.lat!=null)return'https://www.google.com/maps?q='+encodeURIComponent(a.where||a.name)+'&ll='+a.lat+','+a.lon+'&z=15&output=embed';
  return a.where?'https://www.google.com/maps?q='+encodeURIComponent(a.where)+'&z=14&output=embed':'';
}
function evToggleEmbed(actId){
  const row=document.getElementById('ra-'+actId);if(!row)return;
  const nxt=row.nextElementSibling;
  if(nxt&&nxt.classList.contains('ev-embed')){nxt.remove();return;}
  const ev=evFind(evData(),activeEventId),a=ev&&(ev.acts||[]).find(x=>x.id===actId),u=a&&evEmbedURL(a);if(!u)return;
  const box=document.createElement('div');box.className='ev-embed';
  box.innerHTML=`<iframe src="${escHtml(u)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen title="Google Maps"></iframe>`;
  row.after(box);
}

function evDelAct(id){
  const ev=evFind(evData(),activeEventId),a=ev&&(ev.acts||[]).find(x=>x.id===id);if(!a)return;
  if(!confirm('Delete "'+a.name+'"?'))return;
  evMutate(activeEventId,(e,put)=>{put('a_'+id,null);(e.photos||[]).filter(p=>p.act===id).forEach(p=>put('ph_'+p.id,null));});showSection('event');
}
// Fills in a time for each activity without one, in list order from that part's start time, skipping past anything with a fixed time.
function evArrange(part){
  const ev=evFind(evData(),activeEventId);if(!ev)return;
  part=part==='eve'?'eve':'day';
  const acts=(ev.acts||[]).filter(a=>a.day===evDay&&(a.part||'day')===part),flex=acts.filter(a=>doToMin(a.time)==null);
  if(!acts.length){clToast('Add some activities first');return;}
  if(!flex.length){clToast('Every activity already has a time');return;}
  const info=evDayInfo(ev,evDay),fixed=acts.filter(a=>doToMin(a.time)!=null).map(a=>[doToMin(a.time),doToMin(a.time)+doMins(a)]);
  let cur=doToMin(part==='eve'?info.eveStart:info.start);if(cur==null)cur=part==='eve'?1080:540;
  const out=[];
  flex.forEach(a=>{const len=doMins(a);let moved=true;while(moved){moved=false;fixed.forEach(f=>{if(cur<f[1]&&cur+len>f[0]){cur=f[1];moved=true;}});}out.push([a,doFmt(cur)]);cur+=len;});
  evMutate(activeEventId,(e,put)=>{out.forEach(([a,t])=>put('a_'+a.id,Object.assign({},a,{time:t,upd:Date.now()})));});
  showSection('event');clToast(cur>1440?'Arranged, but it runs past midnight':'Times arranged');
}

