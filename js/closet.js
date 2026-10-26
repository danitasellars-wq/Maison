// MAISON · closet.js — plain script, shares globals with the other files in js/ (load order is set in index.html).
// ── CLOSET ──
// Own data key (`closet`) and own photo store — deliberately separate from the Maison photo gallery.
// Item records keep only a tiny thumbnail inline; the full image lives in IndexedDB (+ Drive mirror) under the item id.
const CLOSET_CATS=['Tops','Bottoms','Skirts','Dresses','Outerwear','Shoes','Headscarves','Pyjamas','Bags','Accessories'];
// Two separate tag groups on every piece (and outfit): occasion and season. "Tween" = in-between weather.
const CL_OCC=[['meeting','Meeting'],['casual','Casual']];
const CL_SEASONS=[['summer','Summer'],['winter','Winter'],['tween','Tween']];
function clTagLabel(list,k){const f=list.find(x=>x[0]===k);return f?f[1]:k;}
function clChipsHTML(id,list,sel,onchange){return`<div class="cl-chips" id="${id}">${list.map(([k,l])=>`<label class="cl-chip"><input type="checkbox" value="${k}"${(sel||[]).indexOf(k)>=0?' checked':''}${onchange?` onchange="${onchange}"`:''}/><span>${l}</span></label>`).join('')}</div>`;}
function clReadChips(id){return Array.from(document.querySelectorAll('#'+id+' input:checked')).map(i=>i.value);}
function clTagsText(occ,seasons){return[].concat((occ||[]).map(k=>clTagLabel(CL_OCC,k)),(seasons||[]).map(k=>clTagLabel(CL_SEASONS,k))).join(' · ');}
// An outfit's tags: the ones you set by hand, otherwise what every tagged piece in it has in common.
function clOutfitTags(c,o){
  if(o.tagsManual)return{occ:o.occ||[],seasons:o.seasons||[]};
  const its=clOutfitItemIds(c,o).map(id=>clItem(c,id));
  const common=key=>{const sets=its.map(i=>i[key]||[]).filter(a=>a.length);return sets.length?sets.reduce((a,b)=>a.filter(x=>b.indexOf(x)>=0)):[];};
  return{occ:common('occ'),seasons:common('seasons')};
}
const CLOSET_TABS=[['wardrobe','Wardrobe'],['outfits','Outfits'],['calendar','Calendar'],['shuffle','Shuffle'],['stats','Stats'],['packing','Packing']];
// Flat-lay slots per category: x/y/w are % of the board, h is the max height (% of board) the piece may take.
const CL_DEFAULT_POS={Tops:{x:29,y:4,w:42,h:34},Bottoms:{x:31,y:38,w:38,h:36},Skirts:{x:30,y:38,w:40,h:32},Headscarves:{x:62,y:2,w:26,h:18},Pyjamas:{x:28,y:8,w:44,h:56},Dresses:{x:28,y:6,w:44,h:62},Outerwear:{x:3,y:6,w:46,h:42},Shoes:{x:30,y:77,w:26,h:18},Bags:{x:68,y:40,w:26,h:26},Accessories:{x:70,y:8,w:20,h:18}};
function clDefaultPlace(it,same){
  const d=CL_DEFAULT_POS[it.cat]||{x:35,y:35,w:30,h:30},ar=it.ar||1;
  const w=Math.min(d.w,d.h*(4/3)*ar);
  return{x:+clClamp(d.x+(d.w-w)/2+same*6,0,100-w).toFixed(1),y:+clClamp(d.y+same*5,0,88).toFixed(1),w:+w.toFixed(1)};
}
let ofFilter={occ:'all',season:'all'};
let closetTab='wardrobe',closetFilter='all',closetOutfitId=null,closetPackId=null,closetCalMonth=null,closetStatsSort='best';
let closetQueue=[],closetDraft=null,closetSensTimer=null,outfitDraft=null,obSel=null,obDrag=null,obCat='all',obNameTimer=null;
let shuffleState={idx:{},lock:{},favOnly:false,busy:false};
const closetURLs=new Map(),closetMissing=new Map();
function closetData(){
  const c=userData('closet',null)||{};
  const d={items:c.items||[],outfits:c.outfits||[],calendar:c.calendar||{},packing:c.packing||[]};
  // "Pyjamas" was briefly an occasion tag; it is a category. Convert any piece tagged that way (saved on the next change).
  d.items.forEach(i=>{if((i.occ||[]).indexOf('pyjamas')>=0){i.occ=i.occ.filter(k=>k!=='pyjamas');i.cat='Pyjamas';}});
  d.outfits.forEach(o=>{if((o.occ||[]).indexOf('pyjamas')>=0)o.occ=o.occ.filter(k=>k!=='pyjamas');});
  return d;
}
function saveCloset(c){saveData('closet',c);}
function clItem(c,id){return c.items.find(i=>i.id===id);}
function clMoney(n){return'£'+(Number(n)||0).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2});}
function clClamp(v,a,b){return Math.max(a,Math.min(b,v));}
function clKey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function clToast(msg){let t=document.getElementById('cl-toast');if(!t){t=document.createElement('div');t.id='cl-toast';document.body.appendChild(t);}t.textContent=msg;t.classList.add('show');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('show'),2200);}
function clOutfitItemIds(c,o){return Array.from(new Set((o.items||[]).map(x=>x.itemId))).filter(id=>clItem(c,id));}
function clWearStats(c){
  const wears={},last={};let total=0;
  Object.keys(c.calendar).forEach(date=>(c.calendar[date]||[]).forEach(e=>{
    if(!e.worn)return;total++;
    new Set(e.items||[]).forEach(id=>{wears[id]=(wears[id]||0)+1;if(!last[id]||date>last[id])last[id]=date;});
  }));
  return{wears,last,total};
}
// Full-size image for an item (from IndexedDB, or pulled from Drive on demand); thumbnails are shown until it arrives.
async function closetImgURL(id){
  if(closetURLs.has(id))return closetURLs.get(id);
  if(Date.now()-(closetMissing.get(id)||0)<30000)return null;
  let blob=await idbGetPhoto(id).catch(()=>null);
  if(!blob)blob=await ensurePhotoLocal(id);
  if(!blob){closetMissing.set(id,Date.now());return null;}
  const url=URL.createObjectURL(blob);closetURLs.set(id,url);return url;
}
function closetDropURL(id){const u=closetURLs.get(id);if(u){URL.revokeObjectURL(u);closetURLs.delete(id);}}
function hydrateClosetImgs(root){
  if(!root)return;
  root.querySelectorAll('img[data-cimg]').forEach(async img=>{
    const id=img.dataset.cimg;const url=await closetImgURL(id);
    if(url&&img.isConnected&&img.dataset.cimg===id)img.src=url;
  });
}

// ── Background removal (no AI/model download — works best on a plain background) ──
// Samples the photo's border for the background colour(s), flood-fills inwards from the edges while pixels stay
// within the sensitivity threshold, drops stray specks, softens the edge and trims the result.
function clCutBackground(src,sens){
  const w=src.width,h=src.height,n=w*h;
  const d=src.getContext('2d').getImageData(0,0,w,h).data;
  const t=Math.max(2,Math.round(Math.min(w,h)*.012));
  const bins=new Map();let ring=0;
  const add=(x,y)=>{const i=(y*w+x)*4;const k=((d[i]>>4)<<8)|((d[i+1]>>4)<<4)|(d[i+2]>>4);let b=bins.get(k);if(!b){b={n:0,r:0,g:0,b:0};bins.set(k,b);}b.n++;b.r+=d[i];b.g+=d[i+1];b.b+=d[i+2];ring++;};
  for(let y=0;y<h;y++){if(y<t||y>=h-t){for(let x=0;x<w;x++)add(x,y);}else{for(let x=0;x<t;x++)add(x,y);for(let x=w-t;x<w;x++)add(x,y);}}
  const all=Array.from(bins.values()).sort((a,b)=>b.n-a.n);
  let refs=all.filter(b=>b.n>=ring*.1).slice(0,3);if(!refs.length)refs=[all[0]];
  refs=refs.map(b=>[b.r/b.n,b.g/b.n,b.b/b.n]);
  // A pixel is background if it is close to a border colour, or if it is only a small step from the background
  // pixel it is spreading from (so soft gradients/shadows are followed) while staying within a looser limit.
  const thr2=Math.pow(sens*2.2,2),loc2=Math.pow(Math.max(6,sens*.5),2),max2=Math.pow(sens*3.2,2);
  const near2=(r,g,b)=>{let m=1e9;for(let k=0;k<refs.length;k++){const q=refs[k],dr=r-q[0],dg=g-q[1],db=b-q[2],v=dr*dr+dg*dg+db*db;if(v<m)m=v;}return m;};
  const bg=new Uint8Array(n),stack=new Int32Array(n);let sp=0;
  const push=(i,from)=>{
    if(bg[i])return;
    const p=i*4,r=d[p],g=d[p+1],b=d[p+2],nd=near2(r,g,b);
    let ok=nd<=thr2;
    if(!ok&&from>=0&&nd<=max2){const f=from*4,dr=r-d[f],dg=g-d[f+1],db=b-d[f+2];ok=dr*dr+dg*dg+db*db<=loc2;}
    if(ok){bg[i]=1;stack[sp++]=i;}
  };
  for(let x=0;x<w;x++){push(x,-1);push((h-1)*w+x,-1);}
  for(let y=0;y<h;y++){push(y*w,-1);push(y*w+w-1,-1);}
  while(sp){const i=stack[--sp],x=i%w;if(x>0)push(i-1,i);if(x<w-1)push(i+1,i);if(i>=w)push(i-w,i);if(i<n-w)push(i+w,i);}
  // keep only the main pieces: drop foreground specks far smaller than the biggest blob
  const lab=new Int32Array(n),sizes=[0];let nl=0;
  for(let s=0;s<n;s++){
    if(bg[s]||lab[s])continue;
    nl++;let cnt=0;sp=0;stack[sp++]=s;lab[s]=nl;
    while(sp){const i=stack[--sp],x=i%w;cnt++;
      if(x>0&&!bg[i-1]&&!lab[i-1]){lab[i-1]=nl;stack[sp++]=i-1;}
      if(x<w-1&&!bg[i+1]&&!lab[i+1]){lab[i+1]=nl;stack[sp++]=i+1;}
      if(i>=w&&!bg[i-w]&&!lab[i-w]){lab[i-w]=nl;stack[sp++]=i-w;}
      if(i<n-w&&!bg[i+w]&&!lab[i+w]){lab[i+w]=nl;stack[sp++]=i+w;}
    }
    sizes.push(cnt);
  }
  let maxS=0;for(let k=1;k<sizes.length;k++)if(sizes[k]>maxS)maxS=sizes[k];
  if(maxS<n*.01)return null;
  const minKeep=maxS*.05;
  for(let i=0;i<n;i++)if(!bg[i]&&sizes[lab[i]]<minKeep)bg[i]=1;
  // erode 1px (removes the background-coloured fringe), soften the next ring
  const er=new Uint8Array(n);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(bg[i])continue;if((x>0&&bg[i-1])||(x<w-1&&bg[i+1])||(y>0&&bg[i-w])||(y<h-1&&bg[i+w]))er[i]=1;}
  const out=new ImageData(w,h),o=out.data;let x0=w,y0=h,x1=-1,y1=-1,kept=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=y*w+x;if(bg[i]||er[i])continue;
    const soft=(x>0&&er[i-1])||(x<w-1&&er[i+1])||(y>0&&er[i-w])||(y<h-1&&er[i+w]);
    const p=i*4;o[p]=d[p];o[p+1]=d[p+1];o[p+2]=d[p+2];o[p+3]=soft?190:255;kept++;
    if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
  }
  if(x1<0)return null;
  // Returned at the photo's full size (not trimmed) so the touch-up brushes line up with the original; clTrim() crops at save.
  const full=document.createElement('canvas');full.width=w;full.height=h;full.getContext('2d').putImageData(out,0,0);
  full._frac=kept/n;
  return full;
}
function clCopyCanvas(src){const c=document.createElement('canvas');c.width=src.width;c.height=src.height;c.getContext('2d').drawImage(src,0,0);return c;}
// Crops transparent margins (with a little breathing room). Returns null if nothing visible is left.
function clTrim(cv){
  const w=cv.width,h=cv.height,d=cv.getContext('2d').getImageData(0,0,w,h).data;
  let x0=w,y0=h,x1=-1,y1=-1;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){if(d[(y*w+x)*4+3]>12){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}}
  if(x1<0)return null;
  const pad=Math.round(Math.max(w,h)*.015);
  x0=Math.max(0,x0-pad);y0=Math.max(0,y0-pad);x1=Math.min(w-1,x1+pad);y1=Math.min(h-1,y1+pad);
  const c=document.createElement('canvas');c.width=x1-x0+1;c.height=y1-y0+1;
  c.getContext('2d').drawImage(cv,x0,y0,c.width,c.height,0,0,c.width,c.height);
  return c;
}
// Start at a normal sensitivity; if that eats most of the piece (item close in colour to the background), back off.
function clAutoCut(orig){
  for(const s of [38,26,16,10]){const c=clCutBackground(orig,s);if(c&&c._frac>=.06)return{cut:c,sens:s};}
  return{cut:null,sens:38};
}
function clBlob(cv,type,q){return new Promise(res=>cv.toBlob(b=>res(b),type,q));}
function clMakeThumb(cv,alpha){
  const s=scaleDims(cv.width,cv.height,240),c=drawToCanvas(cv,s.w,s.h);
  if(alpha){let u=c.toDataURL('image/webp',.7);if(u.indexOf('data:image/webp')!==0)u=c.toDataURL('image/png');return u;}
  return c.toDataURL('image/jpeg',.62);
}

// ── Adding photos (camera / upload) ──
// One sheet for both ways of adding: take a photo, or pick one or several from the library.
function clAddSheet(){
  openModal(`<div class="modal-head"><div class="modal-title">Add to closet</div><button class="modal-close" onclick="closeModal()">×</button></div>
    <p class="cl-hint" style="margin-top:0">The background is removed for you. You can pick several photos at once.</p>
    ${capPickHTML('closetFilesPicked',true)}<div id="cap-status"></div>`);
}
function closetCamera(){clAddSheet();}
function closetLibrary(){clAddSheet();}
function closetFilesPicked(input){
  const files=Array.from(input.files||[]);input.value='';
  if(!files.length)return;
  // The add dialog can be dismissed by tapping outside it, so check the DOM rather than trusting leftover state.
  if(document.getElementById('cl-prev')){closetQueue=closetQueue.concat(files);clToast(files.length+(files.length===1?' photo':' photos')+' waiting');}
  else{closetDraft=null;closetQueue=files;closetLoading();clNext();}
}
// Shown straight away after picking, so it never looks like nothing happened while the background is being removed.
function closetLoading(){openModal(`<div class="modal-head"><div class="modal-title">Add to closet</div><button class="modal-close" onclick="clCancelAdd()">×</button></div><div class="cap-working" style="padding:28px 0"><span class="cap-spin"></span>Getting your photo ready…</div>`);}
async function clNext(){
  const f=closetQueue.shift();
  if(!f){closetDraft=null;closeModal();return;}
  if(!document.getElementById('cl-prev'))closetLoading();
  try{
    const dataURL=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f);});
    const im=await loadImageFromDataURL(dataURL);
    const s=scaleDims(im.naturalWidth,im.naturalHeight,900);
    const orig=drawToCanvas(im,s.w,s.h),auto=clAutoCut(orig);
    // work = the editable transparent version (starts as the automatic result); orig stays untouched for "Paint back"
    closetDraft={orig,cut:auto.cut,work:auto.cut?clCopyCanvas(auto.cut):null,useCut:!!auto.cut,sens:auto.sens,mode:'erase',brush:56,tol:40,undo:[],autoFailed:false,stroke:null};
    clOpenAddModal();
  }catch(e){closetDraft=null;alert('Could not read that photo.');if(closetQueue.length)clNext();}
}
function clRunCut(){const d=closetDraft;if(!d)return;try{d.cut=clCutBackground(d.orig,d.sens);}catch(e){d.cut=null;}}
function clFieldsHTML(p,v){
  return`<label class="field-label">Name</label><input id="${p}-name" class="field-input" placeholder="e.g. Navy linen shirt" value="${escHtml(v.name||'')}"/>
    <label class="field-label">Category</label><select id="${p}-cat" class="field-input">${CLOSET_CATS.map(x=>`<option${v.cat===x?' selected':''}>${x}</option>`).join('')}</select>
    <label class="field-label">Occasion</label>${clChipsHTML(p+'-occ',CL_OCC,v.occ)}
    <label class="field-label">Season <span style="font-weight:400">(tween = in-between weather)</span></label>${clChipsHTML(p+'-seasons',CL_SEASONS,v.seasons)}
    <label class="field-label">Price paid (£)</label><input id="${p}-price" class="field-input" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00" value="${v.price>0?v.price:''}"/>
    <label class="field-label">Notes (optional)</label><input id="${p}-notes" class="field-input" placeholder="Brand, size, where it's from…" value="${escHtml(v.notes||'')}"/>`;
}
function clOpenAddModal(){
  const d=closetDraft,more=closetQueue.length;
  openModal(`<div class="modal-head"><div class="modal-title">Add to Closet${more?` <span style="font-size:13px;color:var(--muted);text-transform:none">(${more} more waiting)</span>`:''}</div><button class="modal-close" onclick="clCancelAdd()">×</button></div>
    <div class="cl-checker"><canvas id="cl-prev" onpointerdown="clPointerDown(event)" onpointermove="clPointerMove(event)" onpointerup="clPointerUp()" onpointercancel="clPointerUp()"></canvas></div>
    <label class="cl-check"><input type="checkbox" id="cl-usecut" ${d.useCut?'checked':''} onchange="clToggleCut(this.checked)"/> Remove background</label>
    <p id="cl-msg" class="cl-hint" style="margin-top:0"></p>
    <details id="cl-fine" class="cap-more" style="${d.useCut?'':'display:none'}"><summary>Fine-tune the cut-out</summary>
    <div id="cl-tools">
      <label class="field-label">Automatic — sensitivity <span id="cl-sens-val">${d.sens}</span></label><input type="range" id="cl-sens" min="8" max="100" value="${d.sens}" style="width:100%" oninput="clSens(this.value)"/>
      <p class="cl-hint">Raise it if background is left behind; lower it if the piece is being eaten away. Moving it redoes the automatic step (and your touch-ups).</p>
      <label class="field-label" style="margin-top:6px">Touch up yourself</label>
      <div class="tag-row" style="margin-bottom:10px">
        <button type="button" class="tag-pill cl-mode active" data-m="erase" onclick="clSetMode('erase')">Erase</button>
        <button type="button" class="tag-pill cl-mode" data-m="restore" onclick="clSetMode('restore')">Paint back</button>
        <button type="button" class="tag-pill cl-mode" data-m="wand" onclick="clSetMode('wand')">Tap to remove</button>
        <button type="button" class="tag-pill" id="cl-undo" onclick="clUndo()" disabled>Undo</button>
        <button type="button" class="tag-pill" onclick="clResetEdits()">Reset</button>
      </div>
      <div id="cl-brush-wrap"><label class="field-label">Brush size</label><div class="cl-brushrow"><input type="range" id="cl-brush" min="10" max="220" value="${d.brush}" oninput="clBrush(this.value)"/><span class="cl-dotbox"><span id="cl-dot" class="cl-dot"></span></span></div></div>
      <div id="cl-tol-wrap" style="display:none"><label class="field-label">Colour tolerance <span id="cl-tol-val">${d.tol}</span></label><input type="range" id="cl-tol" min="8" max="100" value="${d.tol}" style="width:100%" oninput="clTol(this.value)"/></div>
      <p class="cl-hint">Rub over the picture with your finger to rub background away, or switch to Paint back to restore a bit you went over. <b>Tap to remove</b> clears the whole patch of similar colour you tap — good for leftover floor or shadow.</p>
    </div></details>
    ${clFieldsHTML('ca',{cat:'Tops'})}
    <div class="modal-row"><button class="btn-solid sm" onclick="clSaveItem()">Save to closet</button><button class="btn-ghost" onclick="clSkipAdd()">${more?'Skip':'Cancel'}</button></div>`);
  clDrawPreview();
}
function clDrawPreview(){
  const d=closetDraft,cv=document.getElementById('cl-prev');if(!d||!cv)return;
  const editing=d.useCut&&!!d.work,src=editing?d.work:d.orig;
  if(cv.width!==src.width||cv.height!==src.height){cv.width=src.width;cv.height=src.height;}
  const ctx=cv.getContext('2d');ctx.clearRect(0,0,cv.width,cv.height);ctx.drawImage(src,0,0);
  cv.classList.toggle('editing',editing);
  const m=document.getElementById('cl-msg');if(m)m.textContent=(d.useCut&&d.autoFailed)?"The automatic step couldn't find the background — rub it out yourself with the tools below.":'';
  clUpdateDot();
}
function clToggleCut(on){
  const d=closetDraft;if(!d)return;d.useCut=on;
  if(on&&!d.work){if(!d.cut)clRunCut();d.autoFailed=!d.cut;d.work=clCopyCanvas(d.cut||d.orig);d.undo=[];}   // no auto result: start from the plain photo
  document.getElementById('cl-fine').style.display=on?'':'none';
  clUpdateUndoBtn();clDrawPreview();
}
function clSens(v){
  const d=closetDraft;if(!d)return;d.sens=+v;document.getElementById('cl-sens-val').textContent=v;
  clearTimeout(closetSensTimer);closetSensTimer=setTimeout(()=>{clRunCut();d.autoFailed=!d.cut;d.work=clCopyCanvas(d.cut||d.orig);d.undo=[];clUpdateUndoBtn();clDrawPreview();},50);
}

// ── Manual touch-up: erase / paint back / tap-to-remove, with undo ──
function clSetMode(m){
  const d=closetDraft;if(!d)return;d.mode=m;
  document.querySelectorAll('.cl-mode').forEach(b=>b.classList.toggle('active',b.dataset.m===m));
  document.getElementById('cl-brush-wrap').style.display=m==='wand'?'none':'';
  document.getElementById('cl-tol-wrap').style.display=m==='wand'?'':'none';
  clUpdateDot();
}
function clBrush(v){if(closetDraft){closetDraft.brush=+v;clUpdateDot();}}
function clTol(v){if(closetDraft){closetDraft.tol=+v;const l=document.getElementById('cl-tol-val');if(l)l.textContent=v;}}
// The little circle beside the slider shows the brush size as it appears on the picture.
function clUpdateDot(){
  const d=closetDraft,cv=document.getElementById('cl-prev'),dot=document.getElementById('cl-dot');if(!d||!cv||!dot)return;
  const k=(cv.getBoundingClientRect().width/cv.width)||1,s=Math.max(4,Math.min(60,d.brush*k));dot.style.width=dot.style.height=s+'px';
}
function clUpdateUndoBtn(){const b=document.getElementById('cl-undo'),d=closetDraft;if(b)b.disabled=!(d&&d.undo&&d.undo.length);}
function clPushUndo(){
  const d=closetDraft;if(!d||!d.work)return;
  d.undo.push(d.work.getContext('2d').getImageData(0,0,d.work.width,d.work.height));
  if(d.undo.length>8)d.undo.shift();clUpdateUndoBtn();
}
function clUndo(){
  const d=closetDraft;if(!d||!d.work||!d.undo.length)return;
  d.work.getContext('2d').putImageData(d.undo.pop(),0,0);clUpdateUndoBtn();clDrawPreview();
}
function clResetEdits(){const d=closetDraft;if(!d)return;d.work=clCopyCanvas(d.cut||d.orig);d.undo=[];clUpdateUndoBtn();clDrawPreview();}
function clPtr(e){const cv=e.currentTarget,r=cv.getBoundingClientRect();return{x:(e.clientX-r.left)*cv.width/r.width,y:(e.clientY-r.top)*cv.height/r.height};}
function clBrushDab(x,y){
  const d=closetDraft,ctx=d.work.getContext('2d');ctx.save();ctx.beginPath();ctx.arc(x,y,d.brush/2,0,Math.PI*2);
  if(d.mode==='erase'){ctx.globalCompositeOperation='destination-out';ctx.fill();}
  else{ctx.clip();ctx.drawImage(d.orig,0,0);}   // paint back = copy the original photo into the circle
  ctx.restore();
}
function clBrushLine(a,b){
  const d=closetDraft,r=d.brush/2,dist=Math.hypot(b.x-a.x,b.y-a.y),step=Math.max(1,r/3);
  for(let t=step;t<dist;t+=step)clBrushDab(a.x+(b.x-a.x)*t/dist,a.y+(b.y-a.y)*t/dist);
  clBrushDab(b.x,b.y);
}
function clPointerDown(e){
  const d=closetDraft;if(!d||!d.useCut||!d.work)return;
  e.preventDefault();const p=clPtr(e);clPushUndo();
  if(d.mode==='wand'){clWand(p.x,p.y);clDrawPreview();return;}
  d.stroke={last:p};clBrushDab(p.x,p.y);clDrawPreview();
  try{e.currentTarget.setPointerCapture(e.pointerId);}catch(err){}
}
function clPointerMove(e){const d=closetDraft;if(!d||!d.stroke)return;const p=clPtr(e);clBrushLine(d.stroke.last,p);d.stroke.last=p;clDrawPreview();}
function clPointerUp(){if(closetDraft)closetDraft.stroke=null;}
// Tap-to-remove: flood-fills outwards from the tapped pixel over similar colours (also following gentle gradients/shadows) and clears them.
function clWand(px,py){
  const d=closetDraft,cv=d.work,w=cv.width,h=cv.height,ctx=cv.getContext('2d');
  const x0=Math.round(px),y0=Math.round(py);if(x0<0||y0<0||x0>=w||y0>=h)return;
  const img=ctx.getImageData(0,0,w,h),a=img.data,s=(y0*w+x0)*4;
  if(a[s+3]<12){d.undo.pop();clUpdateUndoBtn();return;}   // tapped something already removed
  const sr=a[s],sg=a[s+1],sb=a[s+2],thr2=Math.pow(d.tol*2.2,2),loc2=Math.pow(Math.max(6,d.tol*.5),2),max2=Math.pow(d.tol*3.2,2);
  const n=w*h,seen=new Uint8Array(n),st=new Int32Array(n);let sp=0;
  const tryPush=(i,from)=>{
    if(seen[i])return;const p=i*4;if(a[p+3]<12)return;
    const dr=a[p]-sr,dg=a[p+1]-sg,db=a[p+2]-sb,dd=dr*dr+dg*dg+db*db;let ok=dd<=thr2;
    if(!ok&&dd<=max2){const f=from*4,r=a[p]-a[f],g=a[p+1]-a[f+1],b=a[p+2]-a[f+2];ok=r*r+g*g+b*b<=loc2;}
    if(ok){seen[i]=1;st[sp++]=i;}
  };
  seen[y0*w+x0]=1;st[sp++]=y0*w+x0;
  while(sp){const i=st[--sp],x=i%w;if(x>0)tryPush(i-1,i);if(x<w-1)tryPush(i+1,i);if(i>=w)tryPush(i-w,i);if(i<n-w)tryPush(i+w,i);}
  for(let i=0;i<n;i++)if(seen[i])a[i*4+3]=0;
  ctx.putImageData(img,0,0);
}
function clCancelAdd(){closetQueue=[];closetDraft=null;closeModal();}
function clSkipAdd(){if(closetQueue.length)clNext();else clCancelAdd();}
async function clSaveItem(){
  const d=closetDraft;if(!d)return;
  const c=closetData();
  const cat=document.getElementById('ca-cat').value;
  const name=document.getElementById('ca-name').value.trim()||`${cat} ${c.items.filter(i=>i.cat===cat).length+1}`;
  const price=parseFloat(document.getElementById('ca-price').value)||0;
  const notes=document.getElementById('ca-notes').value.trim();
  const useCut=d.useCut&&!!d.work;
  const cv=useCut?clTrim(d.work):d.orig;
  if(!cv){alert('Nothing is left of the piece — tap Undo or Reset, or untick Remove background.');return;}
  const id=uid();
  const blob=await clBlob(cv,useCut?'image/png':'image/jpeg',.88);
  await idbPutPhoto(id,blob);
  c.items.push({id,name,cat,price,notes,occ:clReadChips('ca-occ'),seasons:clReadChips('ca-seasons'),fav:false,date:Date.now(),cut:useCut,ar:+(cv.width/cv.height).toFixed(3),thumb:clMakeThumb(cv,useCut)});
  saveCloset(c);syncPhotosSoon();
  clToast('Added to closet');
  if(closetQueue.length)clNext();
  else{closetDraft=null;closeModal();closetTab='wardrobe';showSection('closet');}
}

// ── Wardrobe: the closet's own photo store (favourite + delete) ──
function clWardrobeHTML(c){
  if(!c.items.length)return`<div class="empty">Your closet is empty.<br/>Tap Capture below, or Add photos above, to add your first piece.</div>`;
  const chips=[['all','All'],['fav','Favourites']].concat(CLOSET_CATS.map(x=>[x,x]));
  const list=c.items.filter(i=>closetFilter==='all'||(closetFilter==='fav'?i.fav:i.cat===closetFilter)).sort((a,b)=>(b.date||0)-(a.date||0));
  return`<div class="tag-row">${chips.map(([k,l])=>`<button class="tag-pill${closetFilter===k?' active':''}" onclick="clSetFilter('${k}')">${l}</button>`).join('')}</div>
    <div class="of-meta" style="margin-bottom:10px">${list.length} piece${list.length!==1?'s':''}</div>
    ${list.length?`<div class="cl-grid">${list.map(i=>`<div class="cl-card" onclick="clOpenItem('${i.id}')"><img src="${i.thumb}" alt="" loading="lazy"/><button class="cl-del" title="Delete" onclick="event.stopPropagation();clDeleteItem('${i.id}')">×</button><button class="cl-fav${i.fav?' on':''}" title="Favourite" onclick="event.stopPropagation();clToggleFav('${i.id}')">♥</button><div class="cl-cap">${escHtml(i.name)}${clTagsText(i.occ,i.seasons)?`<span class="cl-cap-tags">${clTagsText(i.occ,i.seasons)}</span>`:''}</div></div>`).join('')}</div>`:`<div class="empty" style="padding:32px 0">Nothing here yet.</div>`}`;
}
function clSetFilter(k){closetFilter=k;showSection('closet');}
function clToggleFav(id,reopen){
  const c=closetData();const it=clItem(c,id);if(!it)return;
  it.fav=!it.fav;saveCloset(c);
  showSection('closet');if(reopen)clOpenItem(id);
}
function clOpenItem(id){
  const c=closetData(),it=clItem(c,id);if(!it)return;
  const st=clWearStats(c),w=st.wears[id]||0,cpw=(it.price>0&&w>0)?it.price/w:null;
  const inOut=c.outfits.filter(o=>o.items.some(x=>x.itemId===id)).length;
  const lastTxt=st.last[id]?new Date(st.last[id]+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'—';
  openModal(`<div class="modal-head"><div class="modal-title">${escHtml(it.name)}</div><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="cl-detail-img"><img data-cimg="${id}" src="${it.thumb}" alt=""/></div>
    <div class="cl-facts">
      <div><span>Category</span>${escHtml(it.cat)}</div>
      <div><span>Price</span>${it.price>0?clMoney(it.price):'—'}</div>
      <div><span>Occasion</span>${(it.occ||[]).length?escHtml((it.occ||[]).map(k=>clTagLabel(CL_OCC,k)).join(', ')):'—'}</div>
      <div><span>Season</span>${(it.seasons||[]).length?escHtml((it.seasons||[]).map(k=>clTagLabel(CL_SEASONS,k)).join(', ')):'—'}</div>
      <div><span>Worn</span>${w} time${w!==1?'s':''}</div>
      <div><span>Cost per wear</span>${cpw!=null?clMoney(cpw):(it.price>0?'Not worn yet':'—')}</div>
      <div><span>Last worn</span>${lastTxt}</div>
      <div><span>In outfits</span>${inOut}</div>
    </div>
    ${it.notes?`<p style="font-size:14px;color:var(--muted);margin-bottom:14px">${escHtml(it.notes)}</p>`:''}
    <div class="modal-row"><button class="btn-ghost" onclick="clToggleFav('${id}',true)">${it.fav?'Remove favourite':'Add to favourites'}</button><button class="btn-ghost" onclick="clEditItem('${id}')">Edit</button><button class="btn-ghost danger" onclick="clDeleteItem('${id}')">Delete</button></div>`);
  hydrateClosetImgs(document.getElementById('modal-box'));
}
function clEditItem(id){
  const it=clItem(closetData(),id);if(!it)return;
  openModal(`<div class="modal-head"><div class="modal-title">Edit piece</div><button class="modal-close" onclick="closeModal()">×</button></div>
    ${clFieldsHTML('ce',it)}
    <div class="modal-row"><button class="btn-solid sm" onclick="clSaveEdit('${id}')">Save</button><button class="btn-ghost" onclick="clOpenItem('${id}')">Cancel</button></div>`);
}
function clSaveEdit(id){
  const c=closetData(),it=clItem(c,id);if(!it)return;
  it.cat=document.getElementById('ce-cat').value;
  it.name=document.getElementById('ce-name').value.trim()||it.cat;
  it.price=parseFloat(document.getElementById('ce-price').value)||0;
  it.notes=document.getElementById('ce-notes').value.trim();
  it.occ=clReadChips('ce-occ');it.seasons=clReadChips('ce-seasons');
  saveCloset(c);showSection('closet');clOpenItem(id);
}
function clDeleteItem(id){
  const c=closetData(),it=clItem(c,id);if(!it)return;
  const used=c.outfits.filter(o=>o.items.some(x=>x.itemId===id)).length;
  if(!confirm(used?`Delete "${it.name}"? It will also be removed from ${used} outfit${used!==1?'s':''}.`:`Delete "${it.name}" from your closet?`))return;
  c.items=c.items.filter(i=>i.id!==id);
  c.outfits.forEach(o=>{o.items=o.items.filter(x=>x.itemId!==id);});
  c.packing.forEach(p=>{p.extraItemIds=(p.extraItemIds||[]).filter(x=>x!==id);if(p.checked)delete p.checked[id];});
  if(outfitDraft)outfitDraft.items=outfitDraft.items.filter(x=>x.itemId!==id);
  saveCloset(c);closetDropURL(id);
  idbDeletePhoto(id).catch(()=>{});deleteRemotePhoto(id).catch(()=>{});
  closeModal();showSection('closet');
}

// ── Section shell ──
function clSetTab(t){clFinishEditor();closetPackId=null;closetTab=t;showSection('closet');window.scrollTo(0,0);}
function renderCloset(main){
  const c=closetData();
  const editing=closetTab==='outfits'&&closetOutfitId&&outfitDraft,inPack=closetTab==='packing'&&closetPackId;
  let body;
  if(closetTab==='wardrobe')body=clWardrobeHTML(c);
  else if(closetTab==='outfits')body=closetOutfitId&&outfitDraft?clEditorHTML(c):clOutfitsHTML(c);
  else if(closetTab==='calendar')body=clCalendarHTML(c);
  else if(closetTab==='shuffle')body=clShuffleHTML(c);
  else if(closetTab==='stats')body=clStatsHTML(c);
  else body=closetPackId?clPackDetailHTML(c):clPackingHTML(c);
  const title=(CLOSET_TABS.find(t=>t[0]===closetTab)||[0,'Closet'])[1];
  const actions=closetTab==='wardrobe'?`${quickNotesBtn('closet')}<button class="btn-ghost" onclick="clAddSheet()">Add photos</button>`:'';
  const head=(editing||inPack)?'':`<div class="section-rule"><div class="section-title">${title}</div><div class="flex-center">${actions}</div></div>`;
  main.innerHTML=head+body;
  if(closetTab==='outfits'&&closetOutfitId&&outfitDraft){bindOutfitBoard();hydrateClosetImgs(document.getElementById('ob-board'));}
  if(closetTab==='shuffle')hydrateClosetImgs(document.getElementById('sh-area'));
}

// ── Outfits: drag-and-drop boards ──
function clMiniBoard(c,o){
  return`<div class="mini-board">${(o.items||[]).map((x,i)=>{const it=clItem(c,x.itemId);return it?`<img src="${it.thumb}" alt="" style="left:${x.x}%;top:${x.y}%;width:${x.w}%;z-index:${i+1}"/>`:'';}).join('')}</div>`;
}
function clOutfitsHTML(c){
  const head=`<div class="flex-between mb14"><div class="section-sub" style="margin:0">Build flat-lay outfits from your closet.</div><button class="btn-solid sm" onclick="clNewOutfit()">+ New outfit</button></div>`;
  if(!c.items.length)return head+`<div class="empty">Add some clothes in <b>Wardrobe</b> first, then build outfits here.</div>`;
  if(!c.outfits.length)return head+`<div class="empty">No outfits yet.<br/>Tap <b>+ New outfit</b>, or try the <b>Shuffle</b> tab.</div>`;
  return head+`<div id="of-filters">${clOutfitFiltersHTML()}</div><div id="of-list">${clOutfitGridHTML(c)}</div>`;
}
function clOutfitFiltersHTML(){
  const row=(label,list,kind)=>`<div class="of-filter"><span class="of-filter-label">${label}</span><div class="tag-row">${[['all','All']].concat(list).map(([k,l])=>`<button class="tag-pill${ofFilter[kind]===k?' active':''}" onclick="clOfFilter('${kind}','${k}')">${l}</button>`).join('')}</div></div>`;
  return row('Occasion',CL_OCC,'occ')+row('Season',CL_SEASONS,'season');
}
function clOutfitGridHTML(c){
  const wornBy={};Object.values(c.calendar).forEach(arr=>arr.forEach(e=>{if(e.worn&&e.outfitId)wornBy[e.outfitId]=(wornBy[e.outfitId]||0)+1;}));
  const list=c.outfits.filter(o=>{const t=clOutfitTags(c,o);return(ofFilter.occ==='all'||t.occ.indexOf(ofFilter.occ)>=0)&&(ofFilter.season==='all'||t.seasons.indexOf(ofFilter.season)>=0);});
  if(!list.length)return`<div class="empty">No outfits match${ofFilter.occ!=='all'?' '+clTagLabel(CL_OCC,ofFilter.occ).toLowerCase():''}${ofFilter.season!=='all'?' '+clTagLabel(CL_SEASONS,ofFilter.season).toLowerCase():''} yet.<br/>Tag pieces in your wardrobe, or tag an outfit when you edit it.</div>`;
  const btn='padding:4px 10px;font-size:12px';
  return`<div class="of-grid">${list.map(o=>{const n=clOutfitItemIds(c,o).length,w=wornBy[o.id]||0,t=clOutfitTags(c,o),tg=clTagsText(t.occ,t.seasons);return`<div class="of-card"><div style="cursor:pointer" onclick="clEditOutfit('${o.id}')">${clMiniBoard(c,o)}</div><div class="of-body"><div class="of-name">${escHtml(o.name)}</div><div class="of-meta">${n} piece${n!==1?'s':''} · worn ${w}×</div>${tg?`<div class="of-tags">${tg}</div>`:''}<div class="flex-center" style="margin-top:8px;gap:6px"><button class="btn-ghost" style="${btn}" onclick="clEditOutfit('${o.id}')">Edit</button><button class="btn-ghost" style="${btn}" onclick="clWearToday('${o.id}')">Wear today</button><button class="btn-ghost danger" style="${btn}" onclick="clDeleteOutfit('${o.id}')">×</button></div></div></div>`;}).join('')}</div>`;
}
function clOfFilter(kind,k){
  ofFilter[kind]=k;
  const f=document.getElementById('of-filters'),l=document.getElementById('of-list');
  if(f)f.innerHTML=clOutfitFiltersHTML();if(l)l.innerHTML=clOutfitGridHTML(closetData());
}
// Outfit tag chips in the editor: ticking one switches the outfit from automatic (from its pieces) to manual.
function clOutfitTagsHTML(c){
  const t=clOutfitTags(c,outfitDraft);
  return`<div class="field-label">Occasion</div>${clChipsHTML('ob-occ',CL_OCC,t.occ,'clOutfitTagChange()')}
    <div class="field-label">Season</div>${clChipsHTML('ob-seasons',CL_SEASONS,t.seasons,'clOutfitTagChange()')}
    <p class="cl-hint">${outfitDraft.tagsManual?'Tags set by you. <a href="#" onclick="clOutfitTagAuto();return false">Use the pieces\' tags instead</a>':'Taken from the tags on its pieces. Tick one to set them yourself.'}</p>`;
}
function clOutfitTagChange(){
  if(!outfitDraft)return;
  outfitDraft.tagsManual=true;outfitDraft.occ=clReadChips('ob-occ');outfitDraft.seasons=clReadChips('ob-seasons');
  clSaveDraft();clRefreshOutfitTags();
}
function clOutfitTagAuto(){
  if(!outfitDraft)return;
  outfitDraft.tagsManual=false;delete outfitDraft.occ;delete outfitDraft.seasons;clSaveDraft();clRefreshOutfitTags();
}
function clRefreshOutfitTags(){const e=document.getElementById('ob-tags');if(e&&outfitDraft)e.innerHTML=clOutfitTagsHTML(closetData());}
function clNewOutfit(){
  const c=closetData();if(!c.items.length){clToast('Add some clothes first');return;}
  const o={id:uid(),name:'New outfit',items:[],date:Date.now()};c.outfits.push(o);saveCloset(c);clEditOutfit(o.id);
}
function clEditOutfit(id){
  const o=closetData().outfits.find(x=>x.id===id);if(!o)return;
  outfitDraft=JSON.parse(JSON.stringify(o));obSel=null;obCat='all';closetOutfitId=id;closetTab='outfits';showSection('closet');
}
function clSaveDraft(){
  if(!outfitDraft)return;
  const c=closetData(),i=c.outfits.findIndex(x=>x.id===outfitDraft.id);
  if(i>=0){c.outfits[i]=outfitDraft;saveCloset(c);}
}
function clFinishEditor(){
  clearTimeout(obNameTimer);
  if(outfitDraft){
    if(!outfitDraft.items.length){const c=closetData();c.outfits=c.outfits.filter(o=>o.id!==outfitDraft.id);saveCloset(c);}
    else clSaveDraft();
  }
  closetOutfitId=null;outfitDraft=null;obSel=null;obDrag=null;
}
function clCloseEditor(){clFinishEditor();showSection('closet');}
function clOutfitName(v){if(!outfitDraft)return;outfitDraft.name=v.trim()||'Outfit';clearTimeout(obNameTimer);obNameTimer=setTimeout(clSaveDraft,400);}
function clEditorHTML(c){
  return`<div style="text-align:right" class="mb14"><button class="btn-solid sm" onclick="clCloseEditor()">Done</button></div>
    <input id="ob-name" class="field-input" value="${escHtml(outfitDraft.name)}" placeholder="Outfit name" oninput="clOutfitName(this.value)"/>
    <div id="ob-board" class="ob-board">${clBoardInner(c)}</div>
    <div id="ob-tools">${clToolsHTML()}</div>
    <div id="ob-tags">${clOutfitTagsHTML(c)}</div>
    <div class="field-label">Add pieces</div>
    <div id="ob-add">${clAddStripHTML(c)}</div>`;
}
function clBoardInner(c){
  if(!outfitDraft)return'';
  const parts=outfitDraft.items.map((x,i)=>{const it=clItem(c,x.itemId);return it?`<div class="ob-item${x.iid===obSel?' sel':''}" data-iid="${x.iid}" style="left:${x.x}%;top:${x.y}%;width:${x.w}%;z-index:${i+1}"><img data-cimg="${it.id}" src="${it.thumb}" alt="" draggable="false"/><div class="ob-handle"></div></div>`:'';}).join('');
  return parts||`<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;color:var(--muted);font-size:14px;pointer-events:none">Tap a piece below to add it to the board</div>`;
}
function clToolsHTML(){
  if(!obSel)return`<p class="cl-hint" style="text-align:center">Tap a piece to select it · drag to move · drag the gold dot to resize</p>`;
  return`<div class="ob-tools">${[['smaller','Smaller'],['bigger','Larger'],['back','Send back'],['forward','Bring forward'],['remove','Remove']].map(([k,l])=>`<button class="btn-ghost${k==='remove'?' danger':''}" onclick="clObAction('${k}')">${l}</button>`).join('')}</div>`;
}
function clAddStripHTML(c){
  const chips=[['all','All']].concat(CLOSET_CATS.map(x=>[x,x]));
  const list=c.items.filter(i=>obCat==='all'||i.cat===obCat).sort((a,b)=>(b.date||0)-(a.date||0));
  return`<div class="tag-row">${chips.map(([k,l])=>`<button class="tag-pill${obCat===k?' active':''}" onclick="clObCat('${k}')">${l}</button>`).join('')}</div>
    ${list.length?`<div class="ob-strip">${list.map(i=>`<button title="${escHtml(i.name)}" onclick="clAddToBoard('${i.id}')"><img src="${i.thumb}" alt=""/></button>`).join('')}</div>`:`<div class="cl-hint">No ${obCat==='all'?'pieces':obCat.toLowerCase()} yet.</div>`}`;
}
function clObCat(k){obCat=k;document.getElementById('ob-add').innerHTML=clAddStripHTML(closetData());}
function clRefreshBoard(){
  const b=document.getElementById('ob-board');if(!b)return;
  b.innerHTML=clBoardInner(closetData());hydrateClosetImgs(b);
  const t=document.getElementById('ob-tools');if(t)t.innerHTML=clToolsHTML();
  if(!outfitDraft.tagsManual)clRefreshOutfitTags();
}
function clAddToBoard(itemId){
  const c=closetData(),it=clItem(c,itemId);if(!it||!outfitDraft)return;
  const same=outfitDraft.items.filter(x=>{const i2=clItem(c,x.itemId);return i2&&i2.cat===it.cat;}).length;
  const iid=uid(),p=clDefaultPlace(it,same);
  outfitDraft.items.push({iid,itemId,x:p.x,y:p.y,w:p.w});
  obSel=iid;clSaveDraft();clRefreshBoard();
}
function clObSelect(iid){
  obSel=iid;
  document.querySelectorAll('#ob-board .ob-item').forEach(e=>e.classList.toggle('sel',e.dataset.iid===iid));
  const t=document.getElementById('ob-tools');if(t)t.innerHTML=clToolsHTML();
}
function clObAction(k){
  const o=outfitDraft;if(!o||!obSel)return;
  const i=o.items.findIndex(x=>x.iid===obSel);if(i<0)return;const it=o.items[i];
  if(k==='bigger')it.w=Math.min(100,it.w*1.12);
  else if(k==='smaller')it.w=Math.max(8,it.w/1.12);
  else if(k==='forward'){if(i<o.items.length-1)[o.items[i],o.items[i+1]]=[o.items[i+1],o.items[i]];}
  else if(k==='back'){if(i>0)[o.items[i],o.items[i-1]]=[o.items[i-1],o.items[i]];}
  else if(k==='remove'){o.items.splice(i,1);obSel=null;}
  clSaveDraft();clRefreshBoard();
}
function bindOutfitBoard(){
  const b=document.getElementById('ob-board');if(!b)return;
  b.onpointerdown=obDown;b.onpointermove=obMove;b.onpointerup=obUp;b.onpointercancel=obUp;
}
function obDown(e){
  const b=e.currentTarget,el=e.target.closest('.ob-item');
  if(!el){clObSelect(null);return;}
  const it=outfitDraft&&outfitDraft.items.find(x=>x.iid===el.dataset.iid);if(!it)return;
  clObSelect(it.iid);
  obDrag={mode:e.target.classList.contains('ob-handle')?'resize':'move',it,el,sx:e.clientX,sy:e.clientY,x0:it.x,y0:it.y,w0:it.w,rect:b.getBoundingClientRect(),moved:false};
  try{b.setPointerCapture(e.pointerId);}catch(err){}
  e.preventDefault();
}
function obMove(e){
  const g=obDrag;if(!g)return;
  const dx=e.clientX-g.sx,dy=e.clientY-g.sy;
  if(Math.abs(dx)+Math.abs(dy)>2)g.moved=true;
  if(g.mode==='move'){
    g.it.x=clClamp(g.x0+dx/g.rect.width*100,-g.it.w*.4,100-g.it.w*.6);
    g.it.y=clClamp(g.y0+dy/g.rect.height*100,-8,94);
    g.el.style.left=g.it.x+'%';g.el.style.top=g.it.y+'%';
  }else{
    g.it.w=clClamp(g.w0+(Math.abs(dx)>=Math.abs(dy)?dx:dy)/g.rect.width*100,8,100);
    g.el.style.width=g.it.w+'%';
  }
}
function obUp(){const g=obDrag;obDrag=null;if(g&&g.moved)clSaveDraft();}
function clDeleteOutfit(id){
  const c=closetData(),o=c.outfits.find(x=>x.id===id);if(!o)return;
  const pinned=Object.values(c.calendar).reduce((s,arr)=>s+arr.filter(e=>e.outfitId===id).length,0);
  if(!confirm(`Delete "${o.name}"?${pinned?` It is pinned on ${pinned} calendar day${pinned!==1?'s':''} — those days keep their wear history but lose the picture.`:''}`))return;
  c.outfits=c.outfits.filter(x=>x.id!==id);
  c.packing.forEach(p=>{p.outfitIds=(p.outfitIds||[]).filter(x=>x!==id);});
  saveCloset(c);showSection('closet');
}
function clWearToday(oid){
  const c=closetData(),o=c.outfits.find(x=>x.id===oid);if(!o)return;
  const k=clKey(new Date());(c.calendar[k]=c.calendar[k]||[]).push({id:uid(),outfitId:oid,name:o.name,items:clOutfitItemIds(c,o),worn:true});
  saveCloset(c);clToast('Logged as worn today');
}

// ── Calendar ──
function clCalendarHTML(c){
  if(!closetCalMonth){const n=new Date();closetCalMonth=n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0');}
  const[y,m]=closetCalMonth.split('-').map(Number);
  const days=new Date(y,m,0).getDate(),startDow=(new Date(y,m-1,1).getDay()+6)%7,todayKey=clKey(new Date());
  const label=new Date(y,m-1,1).toLocaleDateString('en-GB',{month:'long',year:'numeric'});
  let cells='',worn=0,planned=0;
  for(let i=0;i<startDow;i++)cells+='<div class="cal-cell blank"></div>';
  for(let d=1;d<=days;d++){
    const key=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const arr=c.calendar[key]||[];arr.forEach(e=>{if(e.worn)worn++;else planned++;});
    const e0=arr[0],o0=e0&&c.outfits.find(o=>o.id===e0.outfitId);
    cells+=`<button class="cal-cell${key===todayKey?' today':''}" onclick="clOpenDay('${key}')"><span class="cal-num">${d}</span>${o0?clMiniBoard(c,o0):(e0?`<span class="cal-txt">${escHtml(e0.name||'')}</span>`:'')}${arr.length>1?`<span class="cal-badge">+${arr.length-1}</span>`:''}${arr.some(e=>e.worn)?'<span class="cal-worn">✓</span>':''}</button>`;
  }
  return`<div class="cal-head"><button class="cal-nav" onclick="clCalNav(-1)">‹</button><div class="cal-title">${label}</div><button class="cal-nav" onclick="clCalNav(1)">›</button></div>
    <div class="cal-grid">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(x=>`<div class="cal-dow">${x}</div>`).join('')}${cells}</div>
    <p class="cl-hint" style="margin-top:14px;text-align:center">${worn} worn · ${planned} planned this month.<br/>Tap a day to pin an outfit. A ✓ means you wore it — that's what drives cost-per-wear.</p>
    <div style="text-align:center"><button class="btn-ghost" onclick="clCalToday()">Today</button></div>`;
}
function clCalNav(delta){const[y,m]=closetCalMonth.split('-').map(Number);const d=new Date(y,m-1+delta,1);closetCalMonth=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');showSection('closet');}
function clCalToday(){closetCalMonth=null;showSection('closet');}
function clOpenDay(key){
  const c=closetData(),arr=c.calendar[key]||[];
  const title=new Date(key+'T12:00:00').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
  const future=key>clKey(new Date());
  const rows=arr.map(e=>{const o=c.outfits.find(x=>x.id===e.outfitId);return`<div class="pk-row" style="cursor:default"><div class="cl-mini56">${o?clMiniBoard(c,o):''}</div><div style="flex:1;min-width:0"><div class="of-name">${escHtml(e.name||'Outfit')}</div><div class="of-meta">${e.worn?'Worn ✓':'Planned'}</div></div><button class="btn-ghost" style="padding:5px 10px" onclick="clToggleWorn('${key}','${e.id}')">${e.worn?'Undo worn':'Mark worn'}</button><button class="btn-ghost danger" style="padding:5px 10px" onclick="clUnpin('${key}','${e.id}')">×</button></div>`;}).join('');
  const picks=c.outfits.length?`<div class="of-grid sm">${c.outfits.map(o=>`<div class="of-pick" onclick="clPin('${key}','${o.id}')">${clMiniBoard(c,o)}<div class="of-name" style="font-size:12px;margin-top:3px">${escHtml(o.name)}</div></div>`).join('')}</div>`:`<p class="cl-hint">Build an outfit first (Outfits tab), then pin it to a day here.</p>`;
  openModal(`<div class="modal-head"><div class="modal-title">${title}</div><button class="modal-close" onclick="closeModal()">×</button></div>
    ${rows||`<p class="cl-hint">Nothing pinned for this day yet.</p>`}
    <div class="field-label" style="margin-top:18px">Pin an outfit</div>
    <p class="cl-hint" style="margin:0">${future?'This is a future day, so it is saved as a plan — tap Mark worn once you have worn it.':'Outfits pinned to today or earlier are logged as worn.'}</p>
    ${picks}`);
}
function clPin(key,oid){
  const c=closetData(),o=c.outfits.find(x=>x.id===oid);if(!o)return;
  (c.calendar[key]=c.calendar[key]||[]).push({id:uid(),outfitId:oid,name:o.name,items:clOutfitItemIds(c,o),worn:key<=clKey(new Date())});
  saveCloset(c);showSection('closet');clOpenDay(key);
}
function clToggleWorn(key,id){
  const c=closetData(),e=(c.calendar[key]||[]).find(x=>x.id===id);if(!e)return;
  e.worn=!e.worn;
  const o=c.outfits.find(x=>x.id===e.outfitId);if(o){e.items=clOutfitItemIds(c,o);e.name=o.name;}
  saveCloset(c);showSection('closet');clOpenDay(key);
}
function clUnpin(key,id){
  const c=closetData();c.calendar[key]=(c.calendar[key]||[]).filter(x=>x.id!==id);
  if(!c.calendar[key].length)delete c.calendar[key];
  saveCloset(c);showSection('closet');clOpenDay(key);
}

// ── Shuffle (Clueless-style) ──
const SHUFFLE_CATS=['Tops','Bottoms','Shoes'];
// Skirts count as bottoms when shuffling.
function clShufflePool(c,cat){const cats=cat==='Bottoms'?['Bottoms','Skirts']:[cat];return c.items.filter(i=>cats.indexOf(i.cat)>=0&&(!shuffleState.favOnly||i.fav));}
function clShuffleCur(c,cat){const pool=clShufflePool(c,cat);if(!pool.length)return null;const n=pool.length,k=(((shuffleState.idx[cat]||0)%n)+n)%n;shuffleState.idx[cat]=k;return{pool,n,k};}
function clShuffleInner(c){
  return SHUFFLE_CATS.map(cat=>{
    const cur=clShuffleCur(c,cat);
    if(!cur)return`<div class="sh-row"><div class="sh-row-head"><span class="field-label" style="margin:0">${cat}</span></div><div class="cl-hint" style="padding:14px 0;margin:0">No ${cat.toLowerCase()}${shuffleState.favOnly?' in your favourites':''} yet — add some in Wardrobe.</div></div>`;
    const{pool,n,k}=cur,it=pool[k],prev=pool[(k-1+n)%n],next=pool[(k+1)%n],locked=!!shuffleState.lock[cat];
    return`<div class="sh-row"><div class="sh-row-head"><span class="field-label" style="margin:0">${cat} <span class="of-meta">${k+1} / ${n}</span></span><button class="tag-pill${locked?' active':''}" onclick="clShuffleLock('${cat}')">${locked?'Locked':'Lock'}</button></div>
      <div class="sh-stage"><button class="sh-arrow" onclick="clShuffleStep('${cat}',-1)">‹</button><div class="sh-slot">${n>1?`<img class="sh-side" src="${prev.thumb}" alt=""/>`:''}<img class="sh-main" data-cimg="${it.id}" src="${it.thumb}" alt=""/>${n>1?`<img class="sh-side" src="${next.thumb}" alt=""/>`:''}</div><button class="sh-arrow" onclick="clShuffleStep('${cat}',1)">›</button></div>
      <div class="sh-name">${escHtml(it.name)}</div></div>`;
  }).join('');
}
function clShuffleHTML(c){
  if(!c.items.length)return`<div class="empty">Add some tops, bottoms and shoes in <b>Wardrobe</b>, then come back to shuffle them together.</div>`;
  return`<div class="flex-between mb14"><div class="section-sub" style="margin:0">Spin tops, bottoms and shoes into a surprise look.</div><button class="tag-pill${shuffleState.favOnly?' active':''}" onclick="clShuffleFav()">Favourites only</button></div>
    <div id="sh-area">${clShuffleInner(c)}</div>
    <div class="modal-row" style="justify-content:center;margin-top:16px"><button class="btn-solid sm" onclick="clShuffleGo()">Shuffle</button><button class="btn-ghost" onclick="clShuffleSave(false)">Save as outfit</button><button class="btn-ghost" onclick="clShuffleSave(true)">Save &amp; wear today</button></div>`;
}
function clShuffleRender(){const a=document.getElementById('sh-area');if(!a)return;a.innerHTML=clShuffleInner(closetData());hydrateClosetImgs(a);}
function clShuffleStep(cat,dir){shuffleState.idx[cat]=(shuffleState.idx[cat]||0)+dir;clShuffleRender();}
function clShuffleLock(cat){shuffleState.lock[cat]=!shuffleState.lock[cat];clShuffleRender();}
function clShuffleFav(){shuffleState.favOnly=!shuffleState.favOnly;showSection('closet');}
function clShuffleGo(){
  if(shuffleState.busy)return;shuffleState.busy=true;let n=0;
  const tick=()=>{
    const c=closetData();
    SHUFFLE_CATS.forEach(cat=>{if(shuffleState.lock[cat])return;const pool=clShufflePool(c,cat);if(pool.length>1)shuffleState.idx[cat]=Math.floor(Math.random()*pool.length);});
    clShuffleRender();
    if(++n<9)setTimeout(tick,60+n*22);else shuffleState.busy=false;
  };
  tick();
}
function clShuffleSave(wear){
  const c=closetData();
  const picks=SHUFFLE_CATS.map(cat=>{const cur=clShuffleCur(c,cat);return cur?cur.pool[cur.k]:null;}).filter(Boolean);
  if(!picks.length){clToast('Nothing to save yet');return;}
  const o={id:uid(),name:'Shuffle look '+new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short'}),date:Date.now(),items:picks.map(it=>{const p=clDefaultPlace(it,0);return{iid:uid(),itemId:it.id,x:p.x,y:p.y,w:p.w};})};
  c.outfits.push(o);
  if(wear){const k=clKey(new Date());(c.calendar[k]=c.calendar[k]||[]).push({id:uid(),outfitId:o.id,name:o.name,items:clOutfitItemIds(c,o),worn:true});}
  saveCloset(c);clToast(wear?'Saved & logged as worn today':'Saved to Outfits');
}

// ── Stats: cost per wear & closet utilisation ──
function clBars(rows,cls){
  const max=Math.max(1,...rows.map(r=>r.val));
  return`<div class="st-bars">${rows.map(r=>`<div class="st-bar-row">${r.thumb?`<img class="st-bar-thumb" src="${r.thumb}" alt=""/>`:''}<div class="st-bar-main"><div class="st-bar-label"><span>${escHtml(r.label)}</span><span class="st-bar-right">${r.right}</span></div><div class="st-bar-track"><div class="st-bar-fill ${cls||''}" style="width:${Math.max(2,r.val/max*100)}%"></div></div></div></div>`).join('')}</div>`;
}
function clSetStatsSort(k){closetStatsSort=k;showSection('closet');}
function clAgo(dateKey){
  const days=Math.floor((Date.now()-new Date(dateKey+'T12:00:00').getTime())/86400000);
  if(days<1)return'today';if(days<60)return days+' day'+(days!==1?'s':'')+' ago';
  const m=Math.floor(days/30);return m+' month'+(m!==1?'s':'')+' ago';
}
function clStatsHTML(c){
  if(!c.items.length)return`<div class="empty">Add clothes and log outfits on the calendar to see your wardrobe analytics.</div>`;
  const st=clWearStats(c),W=i=>st.wears[i.id]||0;
  const total=c.items.reduce((s,i)=>s+(i.price||0),0);
  const worn=c.items.filter(i=>W(i)>0),unworn=c.items.filter(i=>!W(i));
  const wornCost=worn.reduce((s,i)=>s+(i.price||0),0),totalWears=worn.reduce((s,i)=>s+W(i),0);
  const unwornCost=unworn.reduce((s,i)=>s+(i.price||0),0);
  const util=Math.round(worn.length/c.items.length*100);
  const tile=(n,l)=>`<div class="st-tile"><div class="st-num">${n}</div><div class="st-lbl">${l}</div></div>`;
  const cpw=worn.filter(i=>i.price>0).map(i=>({i,v:i.price/W(i)})).sort(closetStatsSort==='best'?(a,b)=>a.v-b.v:(a,b)=>b.v-a.v).slice(0,10);
  const most=worn.slice().sort((a,b)=>W(b)-W(a)).slice(0,8);
  const least=c.items.slice().sort((a,b)=>W(a)-W(b)||(a.date||0)-(b.date||0)).slice(0,8);
  const underused=c.items.filter(i=>st.last[i.id]?(Date.now()-new Date(st.last[i.id]+'T12:00:00').getTime())>90*86400000:(Date.now()-(i.date||0))>14*86400000).sort((a,b)=>(st.last[a.id]||'').localeCompare(st.last[b.id]||'')).slice(0,12);
  const byCat=CLOSET_CATS.map(cat=>{const its=c.items.filter(i=>i.cat===cat);return{cat,n:its.length,sum:its.reduce((s,i)=>s+(i.price||0),0)};}).filter(x=>x.n).sort((a,b)=>b.sum-a.sum);
  const thumbRow=i=>({label:i.name,thumb:i.thumb});
  return`<div class="st-tiles">${tile(clMoney(total),'Total wardrobe cost')}${tile(c.items.length,'Pieces')}${tile(totalWears?clMoney(wornCost/totalWears):'—','Avg cost per wear')}${tile(util+'%','Closet utilisation')}${tile(st.total,'Outfit wears logged')}${tile(clMoney(unwornCost),'Tied up in unworn')}</div>
    <div class="st-h"><span>Cost per wear</span><span class="flex-center" style="gap:6px"><button class="tag-pill${closetStatsSort==='best'?' active':''}" onclick="clSetStatsSort('best')">Best value</button><button class="tag-pill${closetStatsSort==='worst'?' active':''}" onclick="clSetStatsSort('worst')">Most expensive</button></span></div>
    ${cpw.length?clBars(cpw.map(x=>Object.assign(thumbRow(x.i),{val:x.v,right:`${clMoney(x.v)} · ${W(x.i)}×`})),closetStatsSort==='best'?'green':'red'):`<p class="cl-hint">Log outfits as worn on the Calendar (and add prices to your pieces) to see cost per wear.</p>`}
    <div class="st-h"><span>Most worn</span></div>
    ${most.length?clBars(most.map(i=>Object.assign(thumbRow(i),{val:W(i),right:`${W(i)}×`})),'gold'):`<p class="cl-hint">Nothing worn yet.</p>`}
    <div class="st-h"><span>Least worn</span></div>
    ${clBars(least.map(i=>Object.assign(thumbRow(i),{val:W(i),right:W(i)?`${W(i)}×`:'never'})),'plum')}
    <div class="st-h"><span>Underused</span><span class="of-meta" style="text-transform:none;letter-spacing:0">never worn, or not worn in 90+ days</span></div>
    ${underused.length?`<div style="margin-bottom:26px">${underused.map(i=>`<div class="pk-row" style="cursor:pointer" onclick="clOpenItem('${i.id}')"><img class="pk-thumb" src="${i.thumb}" alt=""/><div style="flex:1;min-width:0"><div class="of-name">${escHtml(i.name)}</div><div class="of-meta">${st.last[i.id]?'Last worn '+clAgo(st.last[i.id]):'Never worn'}</div></div><div class="of-meta">${i.price>0?clMoney(i.price):''}</div></div>`).join('')}</div>`:`<p class="cl-hint">Nothing underused — nice.</p>`}
    <div class="st-h"><span>Spend by category</span></div>
    ${clBars(byCat.map(x=>({label:x.cat,val:x.sum,right:`${clMoney(x.sum)} · ${x.n}`})),'plum')}`;
}

// ── Packing lists ──
function clPackItems(c,p){
  const map=new Map();
  (p.outfitIds||[]).forEach(oid=>{const o=c.outfits.find(x=>x.id===oid);if(!o)return;clOutfitItemIds(c,o).forEach(id=>{const e=map.get(id)||{id,n:0};e.n++;map.set(id,e);});});
  (p.extraItemIds||[]).forEach(id=>{const e=map.get(id)||{id,n:0};e.extra=true;map.set(id,e);});
  return Array.from(map.values()).filter(e=>clItem(c,e.id)).map(e=>Object.assign({},e,{item:clItem(c,e.id)}));
}
function clPackProgress(c,p){
  const its=clPackItems(c,p),chk=p.checked||{},cu=p.custom||[];
  return{done:its.filter(e=>chk[e.id]).length+cu.filter(x=>x.done).length,tot:its.length+cu.length,pieces:its.length};
}
function clPackingHTML(c){
  const head=`<div class="flex-between mb14"><div class="section-sub" style="margin:0">Trips &amp; seasonal capsules — add outfits and the suitcase list writes itself.</div><button class="btn-solid sm" onclick="clNewPackModal()">+ New list</button></div>`;
  if(!c.packing.length)return head+`<div class="empty">No packing lists yet.</div>`;
  return head+`<div class="of-grid">${c.packing.map(p=>{const pr=clPackProgress(c,p);return`<div class="of-card" style="cursor:pointer" onclick="clOpenPack('${p.id}')"><div class="of-body"><div class="of-tag">${p.type==='capsule'?'Capsule':'Trip'}</div><div class="of-name">${escHtml(p.name)}</div><div class="of-meta">${(p.outfitIds||[]).length} outfit${(p.outfitIds||[]).length!==1?'s':''} · ${pr.pieces} piece${pr.pieces!==1?'s':''}</div><div class="st-bar-track" style="margin:8px 0 4px"><div class="st-bar-fill green" style="width:${pr.tot?pr.done/pr.tot*100:0}%"></div></div><div class="of-meta">${pr.done} of ${pr.tot} packed</div></div></div>`;}).join('')}</div>`;
}
function clPackDetailHTML(c){
  const p=c.packing.find(x=>x.id===closetPackId);if(!p){closetPackId=null;return clPackingHTML(c);}
  const its=clPackItems(c,p),chk=p.checked||{},cu=p.custom||[],pr=clPackProgress(c,p);
  const outs=(p.outfitIds||[]).map(id=>c.outfits.find(o=>o.id===id)).filter(Boolean);
  const itemRow=e=>`<label class="pk-row"><input type="checkbox" ${chk[e.id]?'checked':''} onchange="clPackCheck('${p.id}','${e.id}',this.checked)"/><img class="pk-thumb" src="${e.item.thumb}" alt=""/><div style="flex:1;min-width:0"><div class="of-name">${escHtml(e.item.name)}</div><div class="of-meta">${e.n?`In ${e.n} outfit${e.n!==1?'s':''}`:'Added on its own'}</div></div>${e.extra?`<button type="button" class="btn-ghost danger" style="padding:3px 9px" onclick="event.preventDefault();clPackRemoveExtra('${p.id}','${e.id}')">×</button>`:''}</label>`;
  const groups=CLOSET_CATS.map(cat=>{const es=its.filter(e=>e.item.cat===cat);return es.length?`<div class="st-h" style="margin-top:14px"><span>${cat}</span><span>${es.length}</span></div>${es.map(itemRow).join('')}`:'';}).join('');
  const customRows=cu.map(x=>`<label class="pk-row"><input type="checkbox" ${x.done?'checked':''} onchange="clPackCustomCheck('${p.id}','${x.id}',this.checked)"/><div style="flex:1;min-width:0;font-size:15px">${escHtml(x.text)}</div><button type="button" class="btn-ghost danger" style="padding:3px 9px" onclick="event.preventDefault();clPackRemoveCustom('${p.id}','${x.id}')">×</button></label>`).join('');
  return`<div style="text-align:right" class="mb14"><button class="btn-ghost danger" onclick="clDeletePack('${p.id}')">Delete list</button></div>
    <div class="of-tag">${p.type==='capsule'?'Capsule':'Trip'}</div>
    <div class="section-title" style="font-size:24px">${escHtml(p.name)}</div>
    <div class="st-bar-track" style="margin:10px 0 4px"><div class="st-bar-fill green" style="width:${pr.tot?pr.done/pr.tot*100:0}%"></div></div>
    <div class="of-meta" style="margin-bottom:18px">${pr.done} of ${pr.tot} packed · ${pr.pieces} piece${pr.pieces!==1?'s':''} from ${outs.length} outfit${outs.length!==1?'s':''}</div>
    <div class="st-h"><span>Outfits</span><button class="btn-ghost" style="padding:4px 10px" onclick="clPackOutfitsModal('${p.id}')">+ Add outfits</button></div>
    ${outs.length?`<div class="of-grid sm" style="margin-bottom:18px">${outs.map(o=>`<div class="of-pick">${clMiniBoard(c,o)}<div class="flex-between" style="flex-wrap:nowrap;gap:4px;margin-top:3px"><div class="of-name" style="font-size:12px">${escHtml(o.name)}</div><button class="btn-ghost danger" style="padding:0 6px;font-size:12px" onclick="clPackRemoveOutfit('${p.id}','${o.id}')">×</button></div></div>`).join('')}</div>`:`<p class="cl-hint">Add your pre-made outfits and every piece you need to pack is listed automatically.</p>`}
    <div class="st-h"><span>Pack these</span><span class="flex-center" style="gap:6px"><button class="btn-ghost" style="padding:4px 10px" onclick="clPackPieceModal('${p.id}')">+ Add a piece</button>${pr.done?`<button class="btn-ghost" style="padding:4px 10px" onclick="clPackUncheck('${p.id}')">Reset ticks</button>`:''}</span></div>
    ${groups||`<p class="cl-hint">No pieces yet.</p>`}
    <div class="st-h" style="margin-top:22px"><span>Everything else</span></div>
    ${customRows}
    <div class="flex-center" style="margin-top:10px;flex-wrap:nowrap"><input id="pk-custom" class="field-input" style="margin:0;flex:1" placeholder="Passport, chargers, swimwear…" onkeydown="if(event.key==='Enter')clPackAddCustom('${p.id}')"/><button class="btn-ghost" onclick="clPackAddCustom('${p.id}')">Add</button></div>`;
}
function clNewPackModal(){
  openModal(`<div class="modal-head"><div class="modal-title">New packing list</div><button class="modal-close" onclick="closeModal()">×</button></div>
    <label class="field-label">Name</label><input id="pk-name" class="field-input" placeholder="e.g. Honeymoon in Santorini"/>
    <label class="field-label">Type</label><select id="pk-type" class="field-input"><option value="trip">Trip</option><option value="capsule">Seasonal capsule</option></select>
    <div class="modal-row"><button class="btn-solid sm" onclick="clSavePack()">Create</button><button class="btn-ghost" onclick="closeModal()">Cancel</button></div>`);
}
function clSavePack(){
  const name=document.getElementById('pk-name').value.trim();if(!name)return;
  const c=closetData(),p={id:uid(),name,type:document.getElementById('pk-type').value,outfitIds:[],extraItemIds:[],custom:[],checked:{},date:Date.now()};
  c.packing.push(p);saveCloset(c);closetPackId=p.id;closeModal();showSection('closet');
}
function clOpenPack(id){closetPackId=id;showSection('closet');}
function clClosePack(){closetPackId=null;showSection('closet');}
function clPackMutate(pid,fn,reopen){const c=closetData(),p=c.packing.find(x=>x.id===pid);if(!p)return;fn(p,c);saveCloset(c);showSection('closet');if(reopen)reopen(pid);}
function clPackCheck(pid,id,on){clPackMutate(pid,p=>{p.checked=p.checked||{};if(on)p.checked[id]=true;else delete p.checked[id];});}
function clPackCustomCheck(pid,cid,on){clPackMutate(pid,p=>{const x=(p.custom||[]).find(y=>y.id===cid);if(x)x.done=on;});}
function clPackAddCustom(pid){const el=document.getElementById('pk-custom'),t=el&&el.value.trim();if(!t)return;clPackMutate(pid,p=>{p.custom=p.custom||[];p.custom.push({id:uid(),text:t,done:false});});}
function clPackRemoveCustom(pid,cid){clPackMutate(pid,p=>{p.custom=(p.custom||[]).filter(x=>x.id!==cid);});}
function clPackRemoveExtra(pid,id){clPackMutate(pid,p=>{p.extraItemIds=(p.extraItemIds||[]).filter(x=>x!==id);});}
function clPackRemoveOutfit(pid,oid){clPackMutate(pid,p=>{p.outfitIds=(p.outfitIds||[]).filter(x=>x!==oid);});}
function clPackUncheck(pid){clPackMutate(pid,p=>{p.checked={};(p.custom||[]).forEach(x=>{x.done=false;});});}
function clDeletePack(pid){
  const c=closetData(),p=c.packing.find(x=>x.id===pid);if(!p||!confirm(`Delete the packing list "${p.name}"?`))return;
  c.packing=c.packing.filter(x=>x.id!==pid);saveCloset(c);closetPackId=null;showSection('closet');
}
function clPackOutfitsModal(pid){
  const c=closetData(),p=c.packing.find(x=>x.id===pid);if(!p)return;
  const sel=new Set(p.outfitIds||[]);
  openModal(`<div class="modal-head"><div class="modal-title">Add outfits</div><button class="modal-close" onclick="closeModal()">×</button></div>
    ${c.outfits.length?`<p class="cl-hint" style="margin-top:0">Tap outfits to add or remove them. Every piece in them is added to the list.</p><div class="of-grid sm">${c.outfits.map(o=>`<div class="of-pick${sel.has(o.id)?' on':''}" onclick="clPackToggleOutfit('${pid}','${o.id}')">${clMiniBoard(c,o)}<div class="of-name" style="font-size:12px;margin-top:3px">${escHtml(o.name)}</div></div>`).join('')}</div>`:`<p class="cl-hint">You have not built any outfits yet — make some in the Outfits tab.</p>`}
    <div class="modal-row" style="margin-top:16px"><button class="btn-solid sm" onclick="closeModal()">Done</button></div>`);
}
function clPackToggleOutfit(pid,oid){clPackMutate(pid,p=>{p.outfitIds=p.outfitIds||[];const i=p.outfitIds.indexOf(oid);if(i>=0)p.outfitIds.splice(i,1);else p.outfitIds.push(oid);},clPackOutfitsModal);}
function clPackPieceModal(pid){
  const c=closetData(),p=c.packing.find(x=>x.id===pid);if(!p)return;
  const have=new Set(clPackItems(c,p).map(e=>e.id)),list=c.items.filter(i=>!have.has(i.id));
  openModal(`<div class="modal-head"><div class="modal-title">Add a piece</div><button class="modal-close" onclick="closeModal()">×</button></div>
    ${list.length?`<div class="of-grid sm">${list.map(i=>`<div class="of-pick" onclick="clPackAddPiece('${pid}','${i.id}')"><div class="mini-board" style="aspect-ratio:1"><img src="${i.thumb}" alt="" style="left:6%;top:6%;width:88%"/></div><div class="of-name" style="font-size:12px;margin-top:3px">${escHtml(i.name)}</div></div>`).join('')}</div>`:`<p class="cl-hint">Every piece in your closet is already on this list.</p>`}
    <div class="modal-row" style="margin-top:16px"><button class="btn-solid sm" onclick="closeModal()">Done</button></div>`);
}
function clPackAddPiece(pid,id){clPackMutate(pid,p=>{p.extraItemIds=p.extraItemIds||[];if(p.extraItemIds.indexOf(id)<0)p.extraItemIds.push(id);},clPackPieceModal);}

