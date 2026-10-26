// MAISON · dayout.js — plain script, shares globals with the other files in js/ (load order is set in index.html).
// ── DAYS OUT ──
function dayOutPlansHead(){return`<div class="section-rule sub"><div><div class="section-title">Plans</div><div class="section-sub">Your own days out, with a budget and photos.</div></div><button class="btn-solid sm teal" onclick="openAddDayOutPlan()">+ Add plan</button></div>`;}
function renderDayOut(main){
  const d=userData('dayout',{plans:[]});
  if(!d.plans.length){main.innerHTML=`<div class="section-rule"><div><div class="section-title">Days out</div><div class="section-sub">Plan trips, days out &amp; adventures.</div></div></div>${evStripHTML()}${dayOutPlansHead()}<div class="empty"><div class="empty-icon">🗺️</div>No plans yet. Add your first day out!</div>`;return;}
  if(!activeDayOutId||!d.plans.find(p=>p.id===activeDayOutId))activeDayOutId=d.plans[0].id;
  const plan=d.plans.find(p=>p.id===activeDayOutId);
  const photos=plan.photos||[],items=plan.items||[];
  const budget=plan.budget||0,spent=items.reduce((s,it)=>s+(it.price||0),0)+photos.filter(p=>!p.archived).reduce((s,p)=>s+(p.price||0),0);
  const pct=budget>0?Math.min(spent/budget*100,100):0,over=budget>0&&spent>budget;
  const tabs=d.plans.map((p,i)=>`<button class="room-tab${p.id===activeDayOutId?' active':''}" draggable="true" ondragstart="dragRoomStart(event,${i})" ondragover="dragRoomOver(event,${i})" ondragleave="dragRoomLeave(event)" ondrop="dropRoom(event,${i},'dayout')" ondragend="dragRoomEnd(event)" onclick="setActiveDayOut('${p.id}')"><span class="drag-handle">⋮⋮</span>${escHtml(p.name)}</button>`).join('');
  const sorted=doSorted(items);let prevEnd=-1;
  const itemsHtml=sorted.length?sorted.map(it=>{const s=doToMin(it.time),e=s==null?null:s+doMins(it),clash=s!=null&&prevEnd>s;if(e!=null)prevEnd=Math.max(prevEnd,e);const lk=safeLink(it.link);return`<div class="item-row do-row${clash?' clash':''}"><div class="do-time">${s==null?'<span class="do-notime">No time</span>':doFmt(s)+'<span>'+doFmt(e)+'</span>'}</div><div class="item-body"><span class="cat-badge">${escHtml(it.cat||'Other')}</span><div class="item-name">${escHtml(it.name)}</div>${it.notes?`<div class="of-meta">${escHtml(it.notes)}</div>`:''}${clash?'<div class="do-clash">Overlaps the activity before it</div>':''}${lk?`<a class="item-link" href="${escHtml(lk)}" target="_blank" rel="noopener">${escHtml(it.link)}</a>`:''}</div>${it.price?`<div class="item-price">£${it.price.toLocaleString(undefined,{minimumFractionDigits:2})}</div>`:''}<button class="btn-ghost" style="padding:4px 10px;font-size:12px" onclick="openDayOutItem('${plan.id}','${it.id}')">Edit</button><button class="icon-btn" title="Delete" onclick="deleteDayOutItem('${plan.id}','${it.id}')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></button></div>`;}).join(''):`<div class="empty" style="padding:20px 0;font-size:13px">No activities yet. Add one, give it a time, and your day lays itself out here.</div>`;
  main.innerHTML=`<div class="section-rule"><div><div class="section-title">Days out</div><div class="section-sub">Plan trips, days out &amp; adventures.</div></div></div>
    ${evStripHTML()}
    ${dayOutPlansHead()}
    <div class="room-tabs-row">${tabs}</div>
    ${plan.date||plan.location?`<div style="font-size:13px;color:var(--muted);margin-bottom:16px;">${plan.date?`📅 ${new Date(plan.date+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}`:''} ${plan.location?`📍 ${escHtml(plan.location)}`:''}</div>`:''}
    <div class="budget-block"><div class="budget-row"><div><div class="budget-label">${escHtml(plan.name)} budget</div><div class="budget-amount${over?' over':''}">£${spent.toLocaleString(undefined,{minimumFractionDigits:2})} <span style="font-size:14px;color:var(--muted)">/ £${budget.toLocaleString()}</span></div></div><div class="flex-center"><button class="btn-ghost" onclick="editDayOutPlan('${plan.id}')">Edit details</button><button class="btn-ghost danger" onclick="deleteDayOutPlan('${plan.id}')">Delete</button></div></div><div class="bar-track"><div class="bar-fill${over?' over':''}" style="width:${pct}%"></div></div><div class="bar-note${over?' over':''}">${over?'Over budget':'Remaining: £'+(budget-spent).toLocaleString(undefined,{minimumFractionDigits:2})}</div></div>
    <div class="flex-between mb14"><div style="font-family:var(--sans);font-size:16px;color:var(--muted)">Schedule</div><div class="flex-center"><button class="btn-ghost" onclick="arrangeDayOut('${plan.id}')">Arrange my day</button><button class="btn-ghost" onclick="openDayOutItem('${plan.id}',null)">+ Add</button></div></div>
    <p class="cl-hint" style="margin-top:-6px">Day starts at ${doFmt(doToMin(plan.startTime)==null?540:doToMin(plan.startTime))}. Give activities a time, or tap Arrange my day to fill in the rest in order.</p>
    ${itemsHtml}
    <div class="flex-between mb14" style="margin-top:22px"><div style="font-family:var(--sans);font-size:16px;color:var(--muted)">Photos</div></div>
    ${renderPhotoGrid(photos,'dayout_plan',plan.id)}`;
}
function setActiveDayOut(id){activeDayOutId=id;showSection('dayout');}
function openAddDayOutPlan(){openModal(`<div class="modal-head"><div class="modal-title">New day out</div><button class="modal-close" onclick="closeModal()">×</button></div><label class="field-label">Name</label><input id="do-name" class="field-input" placeholder="e.g. Cornwall Weekend, Tate Modern…"/><label class="field-label">Date (optional)</label><input id="do-date" class="field-input" type="date"/><label class="field-label">Location (optional)</label><input id="do-location" class="field-input" placeholder="e.g. London, Cornwall…"/><label class="field-label">Day starts at</label><input id="do-start" class="field-input" type="time" value="09:00"/><label class="field-label">Budget (optional)</label><input id="do-budget" class="field-input" type="number" placeholder="0.00" min="0" step="0.01"/><div class="modal-row"><button class="btn-solid sm teal" onclick="saveDayOutPlan()">Create plan</button><button class="btn-ghost" onclick="closeModal()">Cancel</button></div>`);}
function saveDayOutPlan(){const name=document.getElementById('do-name').value.trim();if(!name)return;const d=userData('dayout',{plans:[]});const id=uid();d.plans.push({id,name,date:document.getElementById('do-date').value,location:document.getElementById('do-location').value.trim(),startTime:document.getElementById('do-start').value||'09:00',budget:parseFloat(document.getElementById('do-budget').value)||0,photos:[],items:[]});saveData('dayout',d);activeDayOutId=id;closeModal();showSection('dayout');}
function deleteDayOutPlan(planId){if(!confirm('Delete this day out plan?'))return;const d=userData('dayout',{plans:[]});d.plans=d.plans.filter(p=>p.id!==planId);activeDayOutId=d.plans.length?d.plans[0].id:null;saveData('dayout',d);showSection('dayout');}
// Day schedule: each activity has an optional start time (HH:MM) and length in minutes; the list is shown in time order.
const DO_CAT_MINS={'Travel':45,'Food & Drink':60,'Activity':90,'Shopping':60,'Other':30};
function doToMin(t){const m=/^(\d{1,2}):(\d{2})$/.exec(t||'');return m?(+m[1])*60+(+m[2]):null;}
function doFmt(min){min=((min%1440)+1440)%1440;return String(Math.floor(min/60)).padStart(2,'0')+':'+String(min%60).padStart(2,'0');}
function doMins(it){return it.mins>0?it.mins:(DO_CAT_MINS[it.cat]||60);}
function doSorted(items){return items.map((it,i)=>({it,i})).sort((a,b)=>{const x=doToMin(a.it.time),y=doToMin(b.it.time);if(x==null&&y==null)return a.i-b.i;if(x==null)return 1;if(y==null)return-1;return x-y||a.i-b.i;}).map(o=>o.it);}
// Gives every activity without a time one, in list order starting at the plan's start time, skipping past anything that already has a fixed time.
function arrangeDayOut(planId){
  const d=userData('dayout',{plans:[]}),pl=d.plans.find(p=>p.id===planId);if(!pl)return;
  const items=pl.items||[],flex=items.filter(i=>doToMin(i.time)==null);
  if(!items.length){clToast('Add some activities first');return;}
  if(!flex.length){clToast('Every activity already has a time');return;}
  const fixed=items.filter(i=>doToMin(i.time)!=null).map(i=>[doToMin(i.time),doToMin(i.time)+doMins(i)]);
  let cur=doToMin(pl.startTime);if(cur==null)cur=540;
  flex.forEach(it=>{
    const len=doMins(it);let moved=true;
    while(moved){moved=false;fixed.forEach(f=>{if(cur<f[1]&&cur+len>f[0]){cur=f[1];moved=true;}});}
    it.time=doFmt(cur);cur+=len;
  });
  pl.items=doSorted(items);saveData('dayout',d);showSection('dayout');
  clToast(cur>1440?'Day arranged, but it runs past midnight':'Day arranged');
}
function editDayOutPlan(planId){
  const d=userData('dayout',{plans:[]});const pl=d.plans.find(p=>p.id===planId);if(!pl)return;
  openModal(`<div class="modal-head"><div class="modal-title">Edit day out</div><button class="modal-close" onclick="closeModal()">×</button></div>
    <label class="field-label">Name</label><input id="do-name" class="field-input" value="${escHtml(pl.name)}"/>
    <label class="field-label">Date (optional)</label><input id="do-date" class="field-input" type="date" value="${escHtml(pl.date||'')}"/>
    <label class="field-label">Location (optional)</label><input id="do-location" class="field-input" value="${escHtml(pl.location||'')}"/>
    <label class="field-label">Day starts at</label><input id="do-start" class="field-input" type="time" value="${escHtml(pl.startTime||'09:00')}"/>
    <label class="field-label">Budget</label><input id="do-budget" class="field-input" type="number" value="${pl.budget||0}" min="0" step="0.01"/>
    <div class="modal-row"><button class="btn-solid sm teal" onclick="saveDayOutPlanEdit('${planId}')">Save</button><button class="btn-ghost" onclick="closeModal()">Cancel</button></div>`);
}
function saveDayOutPlanEdit(planId){
  const name=document.getElementById('do-name').value.trim();if(!name){clToast('Give it a name');return;}
  const d=userData('dayout',{plans:[]});const pl=d.plans.find(p=>p.id===planId);if(!pl)return;
  pl.name=name;pl.date=document.getElementById('do-date').value;pl.location=document.getElementById('do-location').value.trim();
  pl.startTime=document.getElementById('do-start').value||'09:00';pl.budget=parseFloat(document.getElementById('do-budget').value)||0;
  saveData('dayout',d);closeModal();showSection('dayout');
}
// One dialog for adding (itemId null) and editing an activity.
function openDayOutItem(planId,itemId){
  const d=userData('dayout',{plans:[]});const pl=d.plans.find(p=>p.id===planId);if(!pl)return;
  const it=itemId?(pl.items||[]).find(i=>i.id===itemId):null;if(itemId&&!it)return;
  const v=it||{cat:'Activity'};
  openModal(`<div class="modal-head"><div class="modal-title">${it?'Edit activity':'Add activity / booking'}</div><button class="modal-close" onclick="closeModal()">×</button></div>
    <label class="field-label">Name</label><input id="doi-name" class="field-input" value="${escHtml(v.name||'')}" placeholder="e.g. Lunch at The Seafood Bar…"/>
    <label class="field-label">Category</label><select id="doi-cat" class="field-input">${Object.keys(DO_CAT_MINS).concat(v.cat&&!DO_CAT_MINS[v.cat]?[v.cat]:[]).map(c=>`<option${v.cat===c?' selected':''}>${escHtml(c)}</option>`).join('')}</select>
    <label class="field-label">Start time (leave empty to let Arrange my day choose)</label><input id="doi-time" class="field-input" type="time" value="${escHtml(v.time||'')}"/>
    <label class="field-label">How long (minutes)</label><input id="doi-mins" class="field-input" type="number" min="5" step="5" value="${v.mins||''}" placeholder="Usual length for this kind of activity"/>
    <label class="field-label">Link</label><input id="doi-link" class="field-input" type="url" value="${escHtml(v.link||'')}" placeholder="https://…"/>
    <label class="field-label">Price</label><input id="doi-price" class="field-input" type="number" value="${v.price||''}" placeholder="0.00" min="0" step="0.01"/>
    <label class="field-label">Notes (optional)</label><input id="doi-notes" class="field-input" value="${escHtml(v.notes||'')}" placeholder="Booking reference, what to bring…"/>
    <div class="modal-row"><button class="btn-solid sm teal" onclick="saveDayOutItem('${planId}',${itemId?`'${itemId}'`:'null'})">${it?'Save':'Add'}</button><button class="btn-ghost" onclick="closeModal()">Cancel</button></div>`);
}
function saveDayOutItem(planId,itemId){
  const name=document.getElementById('doi-name').value.trim();if(!name){clToast('Give it a name');return;}
  const d=userData('dayout',{plans:[]});const pl=d.plans.find(p=>p.id===planId);if(!pl)return;
  pl.items=pl.items||[];
  const rec={name,cat:document.getElementById('doi-cat').value,time:document.getElementById('doi-time').value||'',mins:parseInt(document.getElementById('doi-mins').value,10)||0,link:document.getElementById('doi-link').value.trim(),price:parseFloat(document.getElementById('doi-price').value)||0,notes:document.getElementById('doi-notes').value.trim()};
  const cur=itemId?pl.items.find(i=>i.id===itemId):null;
  if(cur)Object.assign(cur,rec);else pl.items.push(Object.assign({id:uid()},rec));
  pl.items=doSorted(pl.items);saveData('dayout',d);closeModal();showSection('dayout');
}
function deleteDayOutItem(planId,itemId){const d=userData('dayout',{plans:[]});const pl=d.plans.find(p=>p.id===planId);if(pl){pl.items=(pl.items||[]).filter(i=>i.id!==itemId);saveData('dayout',d);}showSection('dayout');}

