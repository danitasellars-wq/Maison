// MAISON · view.js — plain script, shares globals with the other files in js/ (load order is set in index.html).
// ── read-only link (no sign-in) ──
// The organiser can make a link that shows ONLY the day titles, the list of activities and the evening host. Anyone with it can read the plan without
// signing in; they cannot change anything and are not added to the event, so they never show up as a viewer.
// How: the organiser's own app publishes a small, separate copy of just those details to its own database document `views/{viewId}` (a random id that
// is NOT the event's id, so the link can't be used to reach the real event) and keeps it up to date whenever the plan changes. The link opens
// `#view=<viewId>`, which loads a plain page that only ever READS that one document. Activities and days the organiser has hidden from guests are left out.
// Database rule needed (see CLAUDE.md "Shared events setup"): match /views/{viewId} { allow get: if true; allow create, update: if request.resource.data.d.size() < 300000; allow list, delete: if false; }
function evViewURL(vid){return`https://firestore.googleapis.com/v1/projects/${EV_CLOUD.projectId}/databases/(default)/documents/views/${vid}`;}
function evViewLink(vid){return location.origin+location.pathname+'#view='+vid;}
// The copy that gets published: nothing but titles, activity names/times/places and the evening host.
function evViewSnapshot(ev){
  const days=(ev.days||[]).slice().sort();
  return{v:1,n:ev.name,l:ev.location||'',days:days.map(day=>{
    const info=(ev.dinfo||{})[day]||{};
    if(info.hideGuests)return{d:day,h:1};
    const acts=doSorted((ev.acts||[]).filter(a=>a.day===day&&!a.hideGuests)).map(a=>{
      const j=a.cat==='Journey'||a.cat==='Travel';
      const o={p:a.part==='eve'?'e':'d',t:a.time||'',n:a.name||''};
      if(j){o.f=a.from||'';o.o=a.to||'';o.ar=a.arr||'';}else if(a.where)o.w=a.where;
      return o;
    });
    return{d:day,ti:info.title||'',eh:info.mealHost||'',a:acts};
  })};
}
let evViewTimers={};
function evViewSoon(evId){clearTimeout(evViewTimers[evId]);evViewTimers[evId]=setTimeout(()=>evViewPublish(evId),1500);}
async function evViewPublish(evId,off){
  const ev=evFind(evData(),evId);if(!ev||!ev.viewId||!evCloudOn())return false;
  const hd=await evHeaders(true);if(!hd)return false;
  const body=off?{off:1}:evViewSnapshot(ev);
  try{
    const r=await fetch(evViewURL(ev.viewId)+'?updateMask.fieldPaths=d&key='+encodeURIComponent(EV_CLOUD.apiKey),{method:'PATCH',headers:hd,body:JSON.stringify({fields:{d:{stringValue:JSON.stringify(body)}}})});
    return r.ok;
  }catch(e){return false;}
}
function evViewHTML(ev){
  if(!ev.creator)return'';
  if(!evCloudOn())return'';
  const head=`<div class="ev-strip-title">Read-only link</div>`;
  if(!ev.viewId)return`<div class="ev-set-block">${head}<p class="cl-hint">A link anyone can open without signing in. They see the day titles, the list of activities and the evening host, nothing else. They cannot change anything and they do not show up as a viewer.</p><button class="btn-solid sm teal" onclick="evViewCreate()">Create read-only link</button></div>`;
  return`<div class="ev-set-block">${head}<input class="field-input" readonly value="${escHtml(evViewLink(ev.viewId))}" onfocus="this.select()"/>
    <div class="modal-row" style="margin-top:10px"><button class="btn-solid sm teal" onclick="evViewCopy()">Copy link</button><button class="btn-ghost" onclick="evViewSend()">Send link</button><button class="btn-ghost danger" onclick="evViewStop()">Stop sharing</button></div>
    <p class="cl-hint">It updates by itself when you change the plan (open MAISON on this phone to refresh it). Activities and days you have hidden from guests are left out. This only hides things in the app, so only send it to people you are happy to see the plan.</p></div>`;
}
async function evViewCreate(){
  const ev=evFind(evData(),activeEventId);if(!ev||!ev.creator)return;
  const vid=Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b=>b.toString(16).padStart(2,'0')).join('');
  const d=evData(),e=evFind(d,ev.id);e.viewId=vid;if(!evSave(d))return;
  const ok=await evViewPublish(ev.id);
  if(!ok)clToast('Saved, but it could not be published yet. It will be sent when you next change the plan.');
  openEventSettings();
}
function evViewCopy(){
  const ev=evFind(evData(),activeEventId);if(!ev||!ev.viewId)return;
  const l=evViewLink(ev.viewId);
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(l).then(()=>clToast('Link copied'),()=>prompt('Copy this link:',l));
  else prompt('Copy this link:',l);
}
function evViewSend(){
  const ev=evFind(evData(),activeEventId);if(!ev||!ev.viewId)return;
  const l=evViewLink(ev.viewId);
  if(navigator.share)navigator.share({title:ev.name,text:'The plan for "'+ev.name+'"',url:l}).catch(()=>{});else evViewCopy();
}
async function evViewStop(){
  const ev=evFind(evData(),activeEventId);if(!ev||!ev.viewId)return;
  if(!confirm('Stop sharing the read-only link? Anyone who has it will see that it is no longer active.'))return;
  await evViewPublish(ev.id,true);
  const d=evData(),e=evFind(d,ev.id);delete e.viewId;evSave(d);
  openEventSettings();
}

// ── the page people see (no sign-in, read only) ──
function viewerBoot(vid){
  document.getElementById('auth-screen').style.display='none';
  document.getElementById('app').classList.remove('visible');
  document.title='MAISON';
  let v=document.getElementById('viewer');if(!v){v=document.createElement('div');v.id='viewer';document.body.appendChild(v);}
  v.innerHTML='<div class="vw-wrap"><div class="vw-brand">MAISON</div><p class="vw-msg">Opening…</p></div>';
  const load=async()=>{
    if(!evCloudOn()){v.innerHTML='<div class="vw-wrap"><div class="vw-brand">MAISON</div><p class="vw-msg">This link cannot be opened right now.</p></div>';return;}
    try{
      const r=await fetch(evViewURL(vid)+'?key='+encodeURIComponent(EV_CLOUD.apiKey));
      if(r.status===404||r.status===403){v.innerHTML='<div class="vw-wrap"><div class="vw-brand">MAISON</div><p class="vw-msg">This link is not active.</p></div>';return;}
      if(!r.ok)throw new Error('HTTP '+r.status);
      const j=await r.json(),s=JSON.parse(((j.fields||{}).d||{}).stringValue||'null');
      if(!s||s.off){v.innerHTML='<div class="vw-wrap"><div class="vw-brand">MAISON</div><p class="vw-msg">This link is no longer active.</p></div>';return;}
      v.innerHTML=viewerHTML(s);
    }catch(e){if(!v.querySelector('.vw-days'))v.innerHTML='<div class="vw-wrap"><div class="vw-brand">MAISON</div><p class="vw-msg">Could not load the plan. Check your connection and refresh.</p></div>';}
  };
  load();
  setInterval(()=>{if(!document.hidden)load();},60000);
}
function viewerHTML(s){
  const days=s.days||[],rng=evRange({days:days.map(d=>d.d)});
  const row=a=>{
    const sub=a.f||a.o?`<div class="vw-sub">${escHtml(a.f||'…')} to ${escHtml(a.o||'…')}${a.ar?' · arrives '+escHtml(a.ar):''}</div>`:(a.w?`<div class="vw-sub">${escHtml(a.w)}</div>`:'');
    return`<div class="vw-act"><div class="vw-time">${escHtml(a.t||'')}</div><div><div class="vw-name">${escHtml(a.n)}</div>${sub}</div></div>`;
  };
  const sect=(label,list,host)=>list.length||host?`<div class="vw-part"><div class="vw-label">${label}</div>${host?`<div class="vw-host">Host: ${escHtml(host)}</div>`:''}${list.map(row).join('')}</div>`:'';
  return`<div class="vw-wrap"><div class="vw-brand">MAISON</div>
    <h1 class="vw-title">${escHtml(s.n||'Plan')}</h1><div class="vw-range">${escHtml(rng)}${s.l?' · '+escHtml(s.l):''}</div>
    <div class="vw-days">${days.map(d=>{
      const heading=d.ti?`<div class="vw-daytitle">${escHtml(d.ti)}</div><div class="vw-date">${escHtml(evLong(d.d))}</div>`:`<div class="vw-daytitle">${escHtml(evLong(d.d))}</div>`;
      if(d.h)return`<section class="vw-day">${heading}</section>`;
      const day=(d.a||[]).filter(a=>a.p!=='e'),eve=(d.a||[]).filter(a=>a.p==='e');
      return`<section class="vw-day">${heading}${sect('Day',day,'')}${sect('Evening',eve,d.eh)}${!day.length&&!eve.length&&!d.eh?'<div class="vw-sub">Nothing planned yet</div>':''}</section>`;
    }).join('')}</div>
    <p class="vw-foot">You are viewing a read-only copy of the plan.</p></div>`;
}
