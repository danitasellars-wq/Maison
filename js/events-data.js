// MAISON · events-data.js — plain script, shares globals with the other files in js/ (load order is set in index.html).
// ── EVENTS (shared days out) ──
// An event is a set of chosen days, each with a schedule like a day out. It is private to this device until you turn on sharing.
// Shared events live in one Firestore document per event, reached by the event's long random id in the link (guests don't need to sign in).
// The document is stored as many small fields — `meta`, `a_<id>` activities, `k_<id>` checklist items, `p_<id>` people — so two people
// editing different things at once never overwrite each other. Every member's app also keeps a full local copy, which MAISON's normal
// Google Drive sync backs up. Sharing switches on once EV_CLOUD is filled in (see CLAUDE.md, "Shared events setup").
const EV_CLOUD={projectId:'maison-events-e64b0',apiKey:'AIzaSyDvK1T9wyjajKd84iVGVzQRBT3CdH1zlwY'};
function evCloudOn(){return!!(EV_CLOUD.projectId&&EV_CLOUD.apiKey);}
function evDocURL(id){return`https://firestore.googleapis.com/v1/projects/${EV_CLOUD.projectId}/databases/(default)/documents/events/${id}`;}
let activeEventId=null,evDay=null,evCalMonth=null,evPoll=null,evPick=null,evStatus='',evDirty=false,evLastPull={};
function evNewId(){const a=new Uint8Array(16);crypto.getRandomValues(a);return Array.from(a,b=>b.toString(16).padStart(2,'0')).join('');}
function evLink(id){return location.origin+location.pathname+'#event='+id;}

// ── database sign-in ──
// The database only answers signed-in Google users (rules: request.auth != null). MAISON's own Google sign-in gives an ID token; that is
// swapped once for a Firebase token pair (Identity Toolkit), and the long-lived refresh token is kept on this device (NOT Drive-synced)
// so later sessions renew silently. If there is none (first run after this update) the user is asked to sign in with Google again.
// Switched OFF for now: the database rules are open (anyone with an event's long link can reach it, and the app itself needs a Google sign-in
// to use the link). To enforce database sign-in set EV_AUTH=true AND change the Firestore rules to "request.auth != null" (see CLAUDE.md).
const EV_AUTH=false;
let fbMem=null,fbNeed=false,evReauthPending=false,evAfterReauth=null;
function fbKey(){return'maison_fbauth_'+currentUser;}
function fbSave(idToken,refreshToken,expiresIn){const rec={idToken,refreshToken,exp:Date.now()+Math.max(60,(expiresIn||3600)-120)*1000};fbMem=rec;fbNeed=false;setStore(fbKey(),rec);}
function fbExpire(){const r=fbMem||getStore(fbKey(),null);if(r){r.exp=0;fbMem=r;setStore(fbKey(),r);}}
async function evAuthFromCredential(cred){
  const p=parseJwt(cred);if(!p||p.sub!==currentUser||!evCloudOn())return false;
  try{
    const r=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key='+encodeURIComponent(EV_CLOUD.apiKey),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({postBody:'id_token='+encodeURIComponent(cred)+'&providerId=google.com',requestUri:location.origin||'http://localhost',returnIdpCredential:true,returnSecureToken:true})});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const j=await r.json();if(!j.idToken||!j.refreshToken)throw new Error('no token');
    fbSave(j.idToken,j.refreshToken,parseInt(j.expiresIn,10));return true;
  }catch(e){return false;}
}
// Returns a valid Firebase ID token, or null (fbNeed=true means the user must sign in again; false means we are just offline).
async function fbToken(){
  if(!EV_AUTH||!evCloudOn()||!currentUser)return null;
  const rec=fbMem||getStore(fbKey(),null);
  if(!rec||!rec.refreshToken){fbNeed=true;return null;}
  if(rec.idToken&&rec.exp>Date.now()){fbMem=rec;fbNeed=false;return rec.idToken;}
  try{
    const r=await fetch('https://securetoken.googleapis.com/v1/token?key='+encodeURIComponent(EV_CLOUD.apiKey),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=refresh_token&refresh_token='+encodeURIComponent(rec.refreshToken)});
    if(r.status===400||r.status===401){fbMem=null;try{localStorage.removeItem(fbKey());}catch(e){}fbNeed=true;return null;}   // refresh token no longer accepted
    if(!r.ok)throw new Error('HTTP '+r.status);
    const j=await r.json();fbSave(j.id_token,j.refresh_token||rec.refreshToken,parseInt(j.expires_in,10));return j.id_token;
  }catch(e){fbNeed=false;return null;}
}
async function evHeaders(json){
  if(!EV_AUTH)return json?{'Content-Type':'application/json'}:{};
  const t=await fbToken();if(!t)return null;const h={Authorization:'Bearer '+t};if(json)h['Content-Type']='application/json';return h;}
// Asks for a Google sign-in (same account as MAISON) to get a database token, then carries on with `after`.
function evReauth(after){
  evAfterReauth=after||null;
  openModal(`<div class="modal-head"><div class="modal-title">Sign in with Google</div><button class="modal-close" onclick="closeModal()">×</button></div>
    <p class="cl-hint">Shared events need a quick Google sign-in. Use the same Google account you use for MAISON.</p><div id="ev-gbtn" style="min-height:44px"></div>`);
  if(window.google&&google.accounts&&google.accounts.id){
    evReauthPending=true;
    google.accounts.id.initialize({client_id:DRIVE_CLIENT_ID,callback:googleCred});
    google.accounts.id.renderButton(document.getElementById('ev-gbtn'),{theme:'outline',size:'large',text:'continue_with',shape:'rectangular',width:260});
  }else document.getElementById('ev-gbtn').innerHTML='<p class="cl-hint">Google sign-in could not load. Check your connection and try again.</p>';
}
// All Google sign-in results come here: either the normal app sign-in, or the sign-in asked for by evReauth.
async function googleCred(resp){
  if(evReauthPending&&currentUser){
    const p=parseJwt(resp.credential);
    if(!p||p.sub!==currentUser){clToast('That is a different Google account to the one signed in to MAISON');return;}
    evReauthPending=false;
    const ok=await evAuthFromCredential(resp.credential);
    closeModal();
    if(ok){clToast('Signed in');const f=evAfterReauth;evAfterReauth=null;evStatus='';if(f)f();else evBootSync();if(currentSection==='event')showSection('event');}
    else clToast('Sign-in did not work. Please try again.');
    return;
  }
  handleGoogleLogin(resp);
}

// ── data ──
function evData(){const d=userData('events',null)||{};return{events:d.events||[],pins:d.pins||[]};}
function evSave(d){return saveData('events',d);}
function evFind(d,id){return d.events.find(e=>e.id===id);}
// Device-only bookkeeping (not Drive-synced): queued writes not yet sent, and which keys we last saw in the cloud copy.
function evBoot(){const b=getStore('maison_evq_'+currentUser,null)||{};return{q:b.q||{},sk:b.sk||{},pq:b.pq||{}};}
function evBootSave(b){setStore('maison_evq_'+currentUser,b);}
function evMeta(ev){return{name:ev.name,location:ev.location||'',notes:ev.notes||'',days:ev.days||[],startTime:ev.startTime||'09:00',owner:ev.owner||null,deleted:!!ev.deleted,upd:ev.upd||0};}
function evAllKeys(ev){const m={meta:evMeta(ev)};(ev.acts||[]).forEach(a=>{m['a_'+a.id]=a;});(ev.todos||[]).forEach(t=>{m['k_'+t.id]=t;});(ev.lists||[]).forEach(l=>{m['l_'+l.id]=l;});(ev.sugs||[]).forEach(s=>{m['s_'+s.id]=s;});(ev.votes||[]).forEach(v=>{m['v_'+v.id]=v;});(ev.photos||[]).forEach(p=>{m['ph_'+p.id]=p;});(ev.perms||[]).forEach(x=>{m['h_'+x.id]=x;});(ev.stays||[]).forEach(s=>{m['o_'+s.id]=s;});(ev.sitems||[]).forEach(i=>{m['si_'+i.id]=i;});(ev.people||[]).forEach(p=>{m['p_'+p.id]=p;});Object.keys(ev.dinfo||{}).forEach(day=>{m['d_'+day.replace(/-/g,'')]=ev.dinfo[day];});return m;}
function evApply(ev,key,val){
  if(key==='meta'){if(val){ev.name=val.name;ev.location=val.location||'';ev.notes=val.notes||'';ev.days=val.days||[];ev.startTime=val.startTime||'09:00';ev.owner=val.owner||ev.owner||null;ev.deleted=!!val.deleted;ev.upd=val.upd||ev.upd||0;}return;}
  const us=key.indexOf('_'),pre=key.slice(0,us),id=key.slice(us+1);
  if(pre==='d'){const day=id.slice(0,4)+'-'+id.slice(4,6)+'-'+id.slice(6,8);ev.dinfo=ev.dinfo||{};if(val==null)delete ev.dinfo[day];else ev.dinfo[day]=val;return;}
  const list={a:'acts',k:'todos',p:'people',l:'lists',s:'sugs',v:'votes',ph:'photos',h:'perms',o:'stays',si:'sitems'}[pre];if(!list)return;
  const arr=ev[list]=ev[list]||[],i=arr.findIndex(x=>x.id===id);
  if(val==null){if(i>=0)arr.splice(i,1);}else if(i>=0)arr[i]=val;else arr.push(val);
}
// The one way to change an event: fn(ev, put, meta). put(key,value|null) edits one field; meta(patch) edits the event's details.
function evMutate(evId,fn){
  const d=evData(),ev=evFind(d,evId);if(!ev)return null;
  const puts=[];
  const put=(key,val)=>{evApply(ev,key,val);puts.push({k:key,v:val==null?null:JSON.parse(JSON.stringify(val))});};
  const meta=patch=>{Object.assign(ev,patch);puts.push({k:'meta',v:evMeta(ev)});};
  fn(ev,put,meta);ev.upd=Date.now();
  if(!evSave(d))return null;
  if(ev.shared&&puts.length){
    const last={};puts.forEach(p=>{last[p.k]=p;});
    const b=evBoot();b.q[evId]=(b.q[evId]||[]).filter(x=>!last[x.k]).concat(Object.values(last));evBootSave(b);
    evFlushSoon();if(ev.creator)evSnapSoon(evId);
  }
  return ev;
}

// ── cloud sync (shared events only) ──
let evFlushTimer=null,evFlushing=false;
function evFlushSoon(){clearTimeout(evFlushTimer);evFlushTimer=setTimeout(evFlushAll,400);}
async function evFlushAll(){
  if(!evCloudOn()||evFlushing||!currentUser)return;evFlushing=true;
  try{const b=evBoot();for(const id of Object.keys(b.q)){if((b.q[id]||[]).length)await evFlush(id);}}
  finally{evFlushing=false;}
}
async function evFlush(evId){
  if(!(await evUploadPhotos(evId)))return false;   // pictures always go up before the records that point at them
  const batch=(evBoot().q[evId]||[]).slice();if(!batch.length)return true;
  const fields={},mask=[];
  batch.forEach(x=>{mask.push('updateMask.fieldPaths='+encodeURIComponent(x.k));if(x.v!=null)fields[x.k]={stringValue:JSON.stringify(x.v)};});
  const hd=await evHeaders(true);
  if(!hd){evStatus=fbNeed?'signin':'offline';evUpdStatus();return false;}
  try{
    const r=await fetch(evDocURL(evId)+'?'+mask.join('&')+'&key='+encodeURIComponent(EV_CLOUD.apiKey),{method:'PATCH',headers:hd,body:JSON.stringify({fields})});
    if(r.status===401||r.status===403){if(r.status===401)fbExpire();evStatus=r.status===401?'signin':'denied';evUpdStatus();return false;}
    if(!r.ok)throw new Error('HTTP '+r.status);
  }catch(e){evStatus='offline';evUpdStatus();return false;}
  const b=evBoot();   // drop what was sent, unless it was changed again while sending
  b.q[evId]=(b.q[evId]||[]).filter(x=>!batch.some(s=>s.k===x.k&&JSON.stringify(s.v)===JSON.stringify(x.v)));
  const sk=b.sk[evId]=b.sk[evId]||[];
  batch.forEach(x=>{const i=sk.indexOf(x.k);if(x.v==null){if(i>=0)sk.splice(i,1);}else if(i<0)sk.push(x.k);});
  evBootSave(b);evStatus='';evUpdStatus();return true;
}
async function evFetchRemote(id){
  const hd=await evHeaders(false);
  if(!hd)return{ok:false,code:fbNeed?'auth':'net'};
  try{
    const r=await fetch(evDocURL(id)+'?key='+encodeURIComponent(EV_CLOUD.apiKey),{headers:hd});
    if(r.status===404)return{ok:false,code:404};
    if(r.status===401){fbExpire();return{ok:false,code:'auth'};}
    if(!r.ok)return{ok:false,code:r.status};
    const j=await r.json(),remote={};
    Object.entries(j.fields||{}).forEach(([k,v])=>{try{remote[k]=JSON.parse(v.stringValue);}catch(e){}});
    return{ok:true,remote};
  }catch(e){return{ok:false,code:'net'};}
}
function evMetaNorm(v){return JSON.stringify({name:v.name,location:v.location||'',notes:v.notes||'',days:v.days||[],startTime:v.startTime||'09:00',owner:v.owner||null,deleted:!!v.deleted,upd:v.upd||0});}
async function evPull(evId){
  if(!evCloudOn())return false;
  const ev0=evFind(evData(),evId);if(!ev0||!ev0.shared)return false;
  const res=await evFetchRemote(evId);
  if(!res.ok){evStatus=res.code===404?'missing':res.code==='auth'?'signin':res.code===403?'denied':'offline';evUpdStatus();return false;}
  const remote=res.remote,d=evData(),ev=evFind(d,evId);if(!ev)return false;
  const b=evBoot(),pending=new Set((b.q[evId]||[]).map(x=>x.k));
  const have=evAllKeys(ev);let changed=false;
  Object.keys(remote).forEach(k=>{
    if(pending.has(k))return;
    const same=k==='meta'?(have.meta&&evMetaNorm(have.meta)===evMetaNorm(remote.meta)):JSON.stringify(have[k])===JSON.stringify(remote[k]);
    if(!same){evApply(ev,k,remote[k]);changed=true;}
  });
  const known=new Set(b.sk[evId]||Object.keys(have));   // first pull on this device: trust what we have
  Object.keys(have).forEach(k=>{if(k!=='meta'&&!pending.has(k)&&!(k in remote)&&known.has(k)){evApply(ev,k,null);changed=true;}});
  b.sk[evId]=Object.keys(remote);evBootSave(b);
  evLastPull[evId]=Date.now();evStatus='';
  if(ev.deleted&&!ev.creator){
    evRemoveLocal(evId);clToast('"'+ev.name+'" was deleted by its owner');
    if(currentSection==='event'&&activeEventId===evId){activeEventId=null;showSection('dayout');}return true;
  }
  if(!ev.creator&&ev.me&&known.has('p_'+ev.me.id)&&!(('p_'+ev.me.id) in remote)&&!pending.has('p_'+ev.me.id)){   // the organiser removed this person
    evRemoveLocal(evId);clToast('You were removed from "'+ev.name+'"');
    if(currentSection==='event'&&activeEventId===evId){activeEventId=null;showSection('dayout');}return true;
  }
  if(changed){evSave(d);if(ev.creator)evSnapSoon(evId);if(currentSection==='event'&&activeEventId===evId)evSoftRefresh();else if(currentSection==='dayout'||currentSection==='dashboard')showSection(currentSection);}
  evUpdStatus();return true;
}
// The organiser can take anyone out of the whole event (not just one day): their person record, what they could see, their votes, and any bed they were assigned.
function evRemovePerson(pid){
  const ev=evFind(evData(),activeEventId),p=ev&&(ev.people||[]).find(x=>x.id===pid);
  if(!ev||!ev.creator||!p||pid===(ev.me||{}).id)return;
  if(!confirm('Remove '+p.name+' from this event? They will no longer see it.'))return;
  evMutate(activeEventId,(e,put)=>{
    put('p_'+pid,null);put('h_'+pid,null);
    (e.votes||[]).filter(v=>v.p===pid).forEach(v=>put('v_'+v.id,null));
    (e.stays||[]).filter(s=>(s.guests||[]).indexOf(pid)>=0).forEach(s=>put('o_'+s.id,Object.assign({},s,{guests:s.guests.filter(g=>g!==pid),upd:Date.now()})));
  });
  showSection('event');clToast(p.name+' removed');
}
function evSoftRefresh(){
  const m=document.getElementById('modal'),a=document.activeElement;
  if((m&&m.style.display==='flex')||(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))){evDirty=true;return;}
  evDirty=false;showSection('event');
}
function evStartPoll(){
  evStopPoll();
  evPoll=setInterval(()=>{
    if(document.hidden||currentSection!=='event'||!activeEventId)return;
    if(evDirty)evSoftRefresh();
    evPull(activeEventId).then(()=>evFlushAll());
  },6000);
}
function evStopPoll(){if(evPoll){clearInterval(evPoll);evPoll=null;}}
function evUpdStatus(){
  const el=document.getElementById('ev-status');if(!el)return;
  const ev=evFind(evData(),activeEventId);if(!ev){el.textContent='';return;}
  if(!ev.shared){el.textContent='Private to you';return;}
  const pend=(evBoot().q[ev.id]||[]).length;
  if(evStatus==='offline')el.textContent='Offline. Changes are saved and will send when you are back online';
  else if(evStatus==='signin'){el.innerHTML='Sign in with Google to sync this event. <a href="#" onclick="evReauth();return false">Sign in</a>';}
  else if(evStatus==='denied')el.textContent='The shared database refused this request. Your changes are saved on this device';
  else if(evStatus==='missing')el.textContent='This shared event could not be found online';
  else if(pend)el.textContent='Sending changes…';
  else{const t=evLastPull[ev.id];el.textContent='Shared and live'+(t?' · checked '+new Date(t).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}):'');}
}
function evRemoveLocal(id){
  const d=evData();d.events=d.events.filter(e=>e.id!==id);d.pins=d.pins.filter(x=>x!==id);evSave(d);
  const b=evBoot();delete b.q[id];delete b.sk[id];evBootSave(b);
}

// ── dates ──
function evDateObj(k){return new Date(k+'T12:00:00');}
function evShort(k){return evDateObj(k).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});}
function evLong(k){return evDateObj(k).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});}
// A day the organiser has hidden from guests still shows on their calendar, but nothing on it is filled in: no title, plans, weather or map.
function evDayHidden(ev,day){return!!(((ev.dinfo||{})[day])||{}).hideGuests;}
function evDayBlank(ev,day){return evGuest(ev)&&evDayHidden(ev,day);}
function evDaysSorted(ev){return(ev.days||[]).slice().sort();}
function evRange(ev){
  const d=evDaysSorted(ev);if(!d.length)return'No days chosen';
  const f=evDateObj(d[0]).toLocaleDateString('en-GB',{day:'numeric',month:'short'}),l=evDateObj(d[d.length-1]).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
  return d.length===1?evDateObj(d[0]).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'}):f+' to '+l+' · '+d.length+' days';
}
function evCountdown(ev){
  const d=evDaysSorted(ev);if(!d.length)return'';
  const t=clKey(new Date()),diff=k=>Math.round((evDateObj(k)-evDateObj(t))/864e5);
  if(t<d[0]){const n=diff(d[0]);return n===1?'Tomorrow':'In '+n+' days';}
  if(d.indexOf(t)>=0)return d.length>1?'Today · day '+(d.indexOf(t)+1)+' of '+d.length:'Today';
  const next=d.find(k=>k>t);
  return next?'Next day: '+evShort(next):'Finished';
}
function evInitials(n){return(n||'?').split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join('')||'?';}

// ── list strips (Days out page, home screen) ──
function evCardHTML(ev){
  const n=(ev.acts||[]).length;
  return`<button class="ev-card" onclick="openEvent('${ev.id}')"><div class="ev-card-main"><div class="ev-card-name">${escHtml(ev.name)}</div><div class="ev-card-sub">${escHtml(evRange(ev))}</div><div class="ev-card-sub">${escHtml(evCountdown(ev))}${n?' · '+n+' activit'+(n!==1?'ies':'y'):''}</div></div>${ev.shared?'<span class="ev-live">Shared</span>':''}<span class="area-chev">→</span></button>`;
}
function evStripHTML(){
  const list=evData().events.slice().sort((a,b)=>(evDaysSorted(a)[0]||'9').localeCompare(evDaysSorted(b)[0]||'9'));
  return`<div class="ev-strip"><div class="section-rule sub"><div><div class="section-title">Events</div><div class="section-sub">Trips and plans shared with other people.</div></div><button class="btn-solid sm teal" onclick="openAddEvent()">+ Add event</button></div>
    ${list.length?`<div class="ev-cards">${list.map(evCardHTML).join('')}</div>`:`<p class="cl-hint">Plan a trip or a party with other people. Choose the days, send a link, and everyone sees the same calendar.</p>`}</div>`;
}
function evPinnedHTML(){
  const d=evData(),list=d.pins.map(id=>evFind(d,id)).filter(Boolean);
  return list.length?`<div class="ev-strip home-pins"><div class="ev-strip-title">Events</div><div class="ev-cards">${list.map(evCardHTML).join('')}</div></div>`:'';
}
function openEvent(id){
  activeEventId=id;evDay=null;evCalMonth=null;evStatus='';showSection('event');
  const ev=evFind(evData(),id);if(ev&&ev.shared)evPull(id).then(()=>evFlushAll());
}

// ── day picker (multi-select calendar) ──
function evPickerHTML(){
  const p=evPick,first=new Date(p.y,p.m,1),lead=(first.getDay()+6)%7,dim=new Date(p.y,p.m+1,0).getDate(),today=clKey(new Date());
  const showT=evShowTitles();let cells='';for(let i=0;i<lead;i++)cells+='<span></span>';
  for(let d=1;d<=dim;d++){const k=p.y+'-'+String(p.m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');cells+=`<button type="button" class="evp-day${(lead+d-1)%7>=5?' wknd':''}${p.sel.indexOf(k)>=0?' on':''}${k===today?' today':''}" onclick="evPickToggle('${k}')">${d}</button>`;}
  const sel=p.sel.slice().sort(),txt=sel.length?sel.length+' day'+(sel.length!==1?'s':'')+' chosen: '+sel.slice(0,4).map(k=>evDateObj(k).toLocaleDateString('en-GB',{day:'numeric',month:'short'})).join(', ')+(sel.length>4?' …':''):'Tap one or more days';
  return`<div class="evp-head"><button type="button" class="icon-btn" onclick="evPickNav(-1)" aria-label="Previous month">‹</button><div class="evp-title">${first.toLocaleDateString('en-GB',{month:'long',year:'numeric'})}</div><button type="button" class="icon-btn" onclick="evPickNav(1)" aria-label="Next month">›</button></div>
    <div class="evp-dow"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div><div class="evp-grid">${cells}</div><div class="cl-hint" style="margin:8px 0 0">${txt}</div>`;
}
function evPickRefresh(){const e=document.getElementById('ev-picker');if(e)e.innerHTML=evPickerHTML();}
function evPickToggle(k){const i=evPick.sel.indexOf(k);if(i>=0)evPick.sel.splice(i,1);else evPick.sel.push(k);evPickRefresh();}
function evPickNav(n){const d=new Date(evPick.y,evPick.m+n,1);evPick.y=d.getFullYear();evPick.m=d.getMonth();evPickRefresh();}
function evPickStart(sel){
  const first=sel.length?evDateObj(sel.slice().sort()[0]):new Date();
  evPick={y:first.getFullYear(),m:first.getMonth(),sel:sel.slice()};
}

// ── add event ──
function openAddEvent(){
  evPickStart([]);
  openModal(`<div class="modal-head"><div class="modal-title">New event</div><button class="modal-close" onclick="closeModal()">×</button></div>
    <label class="field-label">Name</label><input id="ev-name" class="field-input" placeholder="e.g. Cornwall weekend, Hen do, Birthday…"/>
    <label class="field-label">Where (optional)</label><input id="ev-loc" class="field-input" placeholder="e.g. St Ives"/>
    <label class="field-label">Which days?</label><div id="ev-picker">${evPickerHTML()}</div>
    <div class="modal-row"><button class="btn-solid sm teal" onclick="saveNewEvent()">Create event</button><button class="btn-ghost" onclick="closeModal()">Cancel</button></div>`);
}
function saveNewEvent(){
  const name=document.getElementById('ev-name').value.trim();
  if(!name){clToast('Give the event a name');return;}
  if(!evPick.sel.length){clToast('Choose at least one day');return;}
  const me={id:uid(),name:currentUserName||'Me'};
  const ev={id:evNewId(),name,location:document.getElementById('ev-loc').value.trim(),notes:'',days:evPick.sel.slice().sort(),startTime:'09:00',owner:{name:me.name},creator:true,shared:false,me,acts:[],todos:[],people:[{id:me.id,name:me.name,out:[]}],upd:Date.now(),created:Date.now()};
  const d=evData();d.events.push(ev);if(!evSave(d))return;
  closeModal();openEvent(ev.id);
}

// ── event page ──
function renderEvent(main){
  const d=evData(),ev=evFind(d,activeEventId);
  if(!ev){main.innerHTML=`<div class="empty">That event is not here any more.<br/><button class="btn-ghost" style="margin-top:12px" onclick="showSection('dayout')">Back to days out</button></div>`;return;}
  if(evDay&&evDaysSorted(ev).indexOf(evDay)<0)evDay=null;
  main.innerHTML=evDay?evDayHTML(ev):evHomeHTML(ev);
  wxEnsure(ev);evHydratePhotos(main);evMapInit();
  if(ev.shared&&evCloudOn()&&!evPoll)evStartPoll();
  evUpdStatus();
}
function evCalHTML(ev){
  const m=evCalMonth,first=new Date(m.y,m.m,1),lead=(first.getDay()+6)%7,dim=new Date(m.y,m.m+1,0).getDate(),today=clKey(new Date());
  const showT=evShowTitles();let cells='';for(let i=0;i<lead;i++)cells+='<span></span>';
  for(let d=1;d<=dim;d++){
    const k=m.y+'-'+String(m.m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0'),has=evDaysSorted(ev).indexOf(k)>=0,wk=(lead+d-1)%7>=5?' wknd':'';
    const ttl=has&&showT?(evDayInfo(ev,k).title||''):'';
    cells+=has?`<button class="evc-day has${wk}${k===today?' today':''}${ttl?' titled':''}" onclick="evOpenDay('${k}')" aria-label="${escHtml(evLong(k)+(ttl?', '+ttl:''))}"><b>${d}</b>${ttl?`<em>${escHtml(ttl)}</em>`:''}</button>`:`<span class="evc-day off${wk}${k===today?' today':''}"><b>${d}</b></span>`;
  }
  return`<div class="evp-head"><button class="icon-btn" onclick="evCalNav(-1)" aria-label="Previous month">‹</button><div class="evp-title">${first.toLocaleDateString('en-GB',{month:'long',year:'numeric'})}</div><button class="icon-btn" onclick="evCalNav(1)" aria-label="Next month">›</button></div>
    <div class="evp-dow"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div><div class="evc-grid">${cells}</div>`;
}
function evShowTitles(){try{return localStorage.getItem('maison_evtitles')==='1';}catch(e){return false;}}
function evSetTitles(on){try{localStorage.setItem('maison_evtitles',on?'1':'0');}catch(e){}showSection('event');}
function evCalNav(n){const d=new Date(evCalMonth.y,evCalMonth.m+n,1);evCalMonth={y:d.getFullYear(),m:d.getMonth()};showSection('event');}
function evOpenDay(k){evDay=k;showSection('event');window.scrollTo(0,0);}
function evGoing(ev,day){return(ev.people||[]).filter(p=>(p.out||[]).indexOf(day)<0);}
function evMoney(n){return'£'+(Number(n)||0).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2});}
function evHomeHTML(ev){
  const days=evDaysSorted(ev);
  if(!evCalMonth){const t=clKey(new Date()),f=days.find(k=>k>=t)||days[0],dt=evDateObj(f);evCalMonth={y:dt.getFullYear(),m:dt.getMonth()};}
  const total=(ev.acts||[]).reduce((s,a)=>s+(a.price||0),0),ppl=Math.max(1,(ev.people||[]).length);
  return`<div class="section-rule"><div><div class="section-title">${escHtml(ev.name)}</div><div class="section-sub">${escHtml(evRange(ev))}${ev.location?' · '+escHtml(ev.location):''}</div></div><button class="btn-ghost" onclick="openEventSettings()">Settings</button></div>
    <div class="ev-meta"><span class="ev-count">${escHtml(evCountdown(ev))}</span><span id="ev-status" class="of-meta"></span></div>
    ${ev.notes?`<p class="ev-notes">${escHtml(ev.notes)}</p>`:''}
    ${evMapHTML(ev,null)}
    <div class="ev-seg-row">${evViewMode()==='cal'?`<label class="ev-switch ev-titles"><input type="checkbox" ${evShowTitles()?'checked':''} onchange="evSetTitles(this.checked)"/><span>Day titles</span></label>`:''}<div class="ev-seg" role="group" aria-label="How to show the days"><button class="${evViewMode()==='cal'?'on':''}" onclick="evSetView('cal')">Calendar</button><button class="${evViewMode()==='days'?'on':''}" onclick="evSetView('days')">Headings</button></div></div>
    ${evViewMode()==='days'?evDaysViewHTML(ev):`<div class="evc">${evCalHTML(ev)}</div>`}
    ${evSummaryHTML(ev)}
    ${evHiddenNote(ev)}
    ${evCan(ev,'suggestions')?evSugsHTML(ev):''}
    ${evCan(ev,'people')?`<div class="ev-block"><div class="flex-between mb14"><div class="ev-strip-title">People</div>${ev.creator?`<button class="btn-ghost" onclick="openEventSettings()">${ev.shared?'Invite':'Share'}</button>`:''}</div>
      <div class="ev-people">${(ev.people||[]).map(p=>`<span class="ev-person"><i>${escHtml(evInitials(p.name))}</i>${escHtml(p.name)}${p.guest?'<em>guest</em>':''}${ev.creator&&p.id!==(ev.me||{}).id?`<button class="ev-x" aria-label="Remove ${escHtml(p.name)} from the event" onclick="evRemovePerson('${p.id}')">×</button>`:''}</span>`).join('')||'<span class="of-meta">Just you so far</span>'}</div></div>`:''}`;
}
// ── who can see what (organiser only) ──
// The event's creator chooses, for each person who has joined, which parts of the event they can see. It is stored as one small record per
// person, `h_<personId>` = {id,hide:[part,…]}, that only the creator writes (so it never races with someone's own changes). It HIDES parts in
// that person's MAISON app — it is not a security lock, because the whole event still sits in one shared record that anyone holding the link
// could read with the right tools. The creator always sees everything.
const EV_PARTS=[['schedule','Schedule'],['costs','Costs'],['weather','Weather'],['photos','Photos'],['checklists','Checklists'],['suggestions','Suggestions'],['people','Who is going']];
function evCan(ev,part){
  if(ev.creator)return true;
  const x=(ev.perms||[]).find(p=>p.id===(ev.me||{}).id);
  return!(x&&(x.hide||[]).indexOf(part)>=0);
}
function evHiddenNote(ev){
  if(ev.creator)return'';
  const x=(ev.perms||[]).find(p=>p.id===(ev.me||{}).id);
  return x&&(x.hide||[]).length?`<p class="cl-hint">The organiser has hidden some parts of this event for you.</p>`:'';
}
function evPermsHTML(ev){
  if(!ev.creator)return'';
  const head=`<div class="ev-strip-title">Who can see what</div>`;
  if(!ev.shared)return`<div class="ev-set-block">${head}<p class="cl-hint">Once you share the event and people join, you can choose here which parts each person can see.</p></div>`;
  const others=(ev.people||[]).filter(p=>!p.guest&&p.id!==(ev.me||{}).id);
  if(!others.length)return`<div class="ev-set-block">${head}<p class="cl-hint">Nobody else has joined yet. When they do, you can choose which parts each person can see.</p></div>`;
  return`<div class="ev-set-block">${head}<p class="cl-hint">Mark people as hosts or guests. Activities you tick "Hide from guests" on are hidden from anyone marked Guest. Tick the parts each person can see. Unticked parts are hidden in their MAISON app. This is not a security lock: someone with the link who knows how could still read the event.</p>
    ${others.map(p=>{const px=(ev.perms||[]).find(x=>x.id===p.id)||{},hide=px.hide||[],isG=px.role==='guest';return`<div class="ev-perm"><div class="ev-perm-name"><i>${escHtml(evInitials(p.name))}</i>${escHtml(p.name)}<span class="ev-role"><button class="${isG?'':'on'}" aria-pressed="${!isG}" onclick="evRoleSet('${p.id}','host')">Host</button><button class="${isG?'on':''}" aria-pressed="${isG}" onclick="evRoleSet('${p.id}','guest')">Guest</button></span></div><div class="cl-chips">${EV_PARTS.map(([k,l])=>`<label class="cl-chip"><input type="checkbox"${hide.indexOf(k)<0?' checked':''} onchange="evPermSet('${p.id}','${k}',this.checked)"/><span>${l}</span></label>`).join('')}</div></div>`;}).join('')}</div>`;
}
function evPermSet(pid,part,on){
  evMutate(activeEventId,(ev,put)=>{
    if(!ev.creator)return;
    const cur=(ev.perms||[]).find(x=>x.id===pid),hide=((cur&&cur.hide)||[]).filter(x=>x!==part);
    if(!on)hide.push(part);
    const role=cur&&cur.role==='guest'?'guest':undefined;
    if(hide.length||role)put('h_'+pid,role?{id:pid,hide,role,upd:Date.now()}:{id:pid,hide,upd:Date.now()});else put('h_'+pid,null);
  });
}
function evDayNav(dir){
  const ev=evFind(evData(),activeEventId);if(!ev)return;
  const d=evDaysSorted(ev),i=d.indexOf(evDay),n=d[i+dir];if(n){evDay=n;showSection('event');window.scrollTo(0,0);}
}
// Each day has two parts: the day out and the evening. Per-day details (start times, dress codes, hosts) live in one small field per day, `d_YYYYMMDD`.
function evDayInfo(ev,day){
  const i=evDayBlank(ev,day)?{hideGuests:true}:((ev.dinfo||{})[day]||{});
  return{start:i.start||ev.startTime||'09:00',eveStart:i.eveStart||'18:00',dressDay:i.dressDay||'',dressEve:i.dressEve||'',mealHost:i.mealHost||'',nightHost:i.nightHost||'',title:i.title||'',overview:i.overview||'',hideGuests:!!i.hideGuests};
}
function evDayField(field,val,forDay){
  const day=forDay||evDay;if(!day)return;
  evMutate(activeEventId,(ev,put)=>{
    const cur=(ev.dinfo||{})[day]||{};
    put('d_'+day.replace(/-/g,''),Object.assign({},cur,{day,upd:Date.now()},{[field]:val}));
  });
}
const EV_DRESS=['Casual','Smart casual','Smart','Cocktail','Black tie','Fancy dress','Beach','Walking gear','Wear white','Wear black'];
function evRowsHTML(ev,acts){
  let prevEnd=-1;
  const ico=(d,t,fn,a)=>`<button class="icon-btn" title="${t}" aria-label="${t} ${escHtml(a.name)}" onclick="${fn}('${a.id}')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg></button>`;
  return acts.map(a=>{
    const isJ=a.cat==='Journey'||a.cat==='Travel';
    const s=doToMin(a.time),e=s==null?null:s+doMins(a),clash=s!=null&&prevEnd>s;if(e!=null)prevEnd=Math.max(prevEnd,e);
    const lk=safeLink(a.link),embed=evEmbedURL(a);
    const sub=isJ&&(a.from||a.to)?`<div class="ev-route">${escHtml(a.from||'…')}<i>to</i>${escHtml(a.to||'…')}</div>`:(a.where?`<a class="item-link" href="${escHtml(evMapsUrl(a))}" target="_blank" rel="noopener">${escHtml(a.where)}</a>`:'');
    return`<div class="item-row do-row${clash?' clash':''}" id="ra-${a.id}"><div class="do-time">${s==null?'<span class="do-notime">No time</span>':doFmt(s)+'<span>'+doFmt(e)+'</span>'}</div><div class="item-body"><div class="item-name"><span class="ev-cat" title="${escHtml(a.cat||'Other')}">${evCatIcon(a.cat,a.mode,19)}</span>${escHtml(a.name)}</div>${sub}${a.notes?`<div class="of-meta">${escHtml(a.notes)}</div>`:''}${clash?'<div class="do-clash">Overlaps the activity before it</div>':''}${lk?`<a class="item-link" href="${escHtml(lk)}" target="_blank" rel="noopener">${escHtml(a.link)}</a>`:''}${a.hideGuests&&ev.creator?'<span class="ev-lock">Hidden from guests</span>':''}${embed?`<button class="ev-addph" onclick="evToggleEmbed('${a.id}')">${isJ?'Route':'Map'}</button>`:''}${evCan(ev,'photos')?evActPhotosHTML(ev,a):''}</div>${a.price&&evCan(ev,'costs')?`<div class="item-price">${evMoney(a.price)}</div>`:''}${ico('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>','Edit','evActForm',a)}${ico('<path d="M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4"/>','Move','evMoveModal',a)}${ico('<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>','Delete','evDelAct',a)}</div>`;
  }).join('');
}
function evSectionHTML(ev,part){
  const eve=part==='eve',info=evDayInfo(ev,evDay);
  // only this day's activities for this part of the day
  const acts=doSorted(evActsVis(ev).filter(a=>a.day===evDay&&(a.part||'day')===part));
  const rows=acts.length?evRowsHTML(ev,acts):`<div class="empty" style="padding:16px 0;font-size:13px">${eve?'Nothing planned for the evening yet.':'Nothing planned for the day yet.'}</div>`;
  const inp=(label,field,val,opts)=>`<label class="ev-field${opts&&opts.grow?' grow':''}${opts&&opts.half?' half':''}"><span>${label}</span><input ${opts&&opts.type?`type="${opts.type}"`:'type="text"'}${opts&&opts.list?` list="${opts.list}"`:''} value="${escHtml(val)}"${opts&&opts.ph?` placeholder="${escHtml(opts.ph)}"`:''} autocomplete="off" onchange="evDayField('${field}',this.value${opts&&opts.type==='time'?'':'.trim()'})"/></label>`;
  return`<div class="ev-sec">
    <div class="ev-sec-head"><div class="ev-sec-title">${eve?'Evening':'Day out'}</div><div class="flex-center"><button class="btn-ghost" onclick="evArrange('${part}')">Arrange times</button><button class="btn-ghost" onclick="evActForm(null,'${part}')">+ Add</button></div></div>
    <div class="ev-fields">
      ${inp(eve?'Evening starts':'Day starts',eve?'eveStart':'start',eve?info.eveStart:info.start,{type:'time'})}
      ${inp('Dress code',eve?'dressEve':'dressDay',eve?info.dressEve:info.dressDay,{list:'ev-dress',ph:'e.g. Smart casual',grow:true})}
      ${eve?inp('Meal host','mealHost',info.mealHost,{list:'ev-ppl',ph:'Who is hosting dinner?',grow:true}):''}
    </div>
    ${rows}
  </div>`;
}
// Who is going on this particular day. Anyone can add or remove anyone (including people who don't use MAISON, added as guests).
function evPeopleHTML(ev,day){
  const going=evGoing(ev,day);
  return`<div class="ev-block" style="margin-top:0"><div class="flex-between mb14"><div class="ev-strip-title">Who is going <span class="of-meta">${going.length}</span></div><button class="btn-ghost" onclick="evPeopleModal()">+ Add</button></div>
    <div class="ev-people">${going.map(p=>`<span class="ev-person"><i>${escHtml(evInitials(p.name))}</i>${escHtml(p.name)}${p.guest?'<em>guest</em>':''}<button class="ev-x" aria-label="Remove ${escHtml(p.name)} from this day" onclick="evDayRemove('${p.id}')">×</button></span>`).join('')||'<span class="of-meta">Nobody yet. Tap Add.</span>'}</div></div>`;
}
function evDayHTML(ev){
  if(evDayBlank(ev,evDay)){
    const days=evDaysSorted(ev),i=days.indexOf(evDay),arrow=(dir,off,label,d)=>`<button class="ev-arrow" ${off?'disabled':''} onclick="evDayNav(${dir})" aria-label="${label}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg></button>`;
    return`<div class="ev-dayhead"><div class="ev-day-title">${escHtml(evLong(evDay))}</div><div class="ev-day-sub"><span>${escHtml(ev.name)} · day ${i+1} of ${days.length}</span><span class="ev-arrows">${arrow(-1,i<=0,'Previous day','M15 18l-6-6 6-6')}${arrow(1,i>=days.length-1,'Next day','M9 18l6-6-6-6')}</span></div></div><p class="cl-hint">Nothing here yet.</p>`;
  }
  const days=evDaysSorted(ev),i=days.indexOf(evDay),all=evActsVis(ev).filter(a=>a.day===evDay);
  const going=evGoing(ev,evDay),info=evDayInfo(ev,evDay);
  const total=all.reduce((s,a)=>s+(a.price||0),0),each=total/Math.max(1,going.length);
  const arrow=(dir,off,label,d)=>`<button class="ev-arrow" ${off?'disabled':''} onclick="evDayNav(${dir})" aria-label="${label}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg></button>`;
  return`<div class="ev-dayhead">
      <input id="ev-day-title" class="ev-day-title" type="text" value="${escHtml(info.title)}" placeholder="${escHtml(evLong(evDay))}" maxlength="80" autocomplete="off" aria-label="Title for this day" oninput="evDayTextSoon('title',this)" onchange="evDayField('title',this.value.trim())"/>
      <div class="ev-day-sub"><span>${info.title?escHtml(evLong(evDay))+' · ':''}${escHtml(ev.name)} · day ${i+1} of ${days.length}</span><span class="ev-arrows">${arrow(-1,i<=0,'Previous day','M15 18l-6-6 6-6')}${arrow(1,i>=days.length-1,'Next day','M9 18l6-6-6-6')}</span></div>
    </div>
    ${ev.creator?`<label class="ev-switch ev-hideday"><input type="checkbox" ${info.hideGuests?'checked':''} onchange="evDayField('hideGuests',this.checked)"/><span>Hide this whole day from guests</span></label>`:''}
    <div class="ev-overview"><label for="ev-day-overview">Overview</label><textarea id="ev-day-overview" rows="3" placeholder="What is the plan for the day?" oninput="evDayTextSoon('overview',this)" onchange="evDayField('overview',this.value.trim())">${escHtml(info.overview)}</textarea></div>
    ${evCan(ev,'weather')?wxDayHTML(ev,evDay):''}
    ${evMapHTML(ev,evDay)}
    ${evCan(ev,'people')?evPeopleHTML(ev,evDay):''}
    ${evCan(ev,'checklists')?evListsHTML(ev,evDay):''}
    <datalist id="ev-dress">${EV_DRESS.map(x=>`<option value="${escHtml(x)}"></option>`).join('')}</datalist>
    <datalist id="ev-ppl">${(ev.people||[]).map(p=>`<option value="${escHtml(p.name)}"></option>`).join('')}</datalist>
    ${evCan(ev,'schedule')?evSectionHTML(ev,'day')+evSectionHTML(ev,'eve'):''}
    ${evCan(ev,'photos')?evDayPhotosHTML(ev,evDay):''}
    ${total&&evCan(ev,'schedule')&&evCan(ev,'costs')?`<div class="ev-daytotal"><span>Day total</span><b>${evMoney(total)}</b>${going.length>1?`<span>${evMoney(each)} each for ${going.length}</span>`:''}</div>`:''}
    ${evNightHTML(ev)}
    ${evCan(ev,'schedule')?`<div class="ev-block"><a class="btn-ghost ev-link" href="${escHtml(evGcalDay(ev,evDay))}" target="_blank" rel="noopener">Add this day to Google Calendar</a></div>`:''}
    <span id="ev-status" class="of-meta" style="display:block;margin-top:10px"></span>`;
}

