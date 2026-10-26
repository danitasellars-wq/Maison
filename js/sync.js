// MAISON · sync.js — plain script, shares globals with the other files in js/ (load order is set in index.html).
// ── DRIVE SYNC (redirect flow — no popups) ──
const DRIVE_CLIENT_ID='643043876163-9evtski9p2oqs4s1pg0nn4g1tnqdeiv8.apps.googleusercontent.com';
const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.appdata';
let lastSyncAt=null,lastSyncError=null;

// On page load: pick up the access token Google sent back in the URL hash
function checkDriveRedirect(){
  if(!location.hash)return;
  const h=new URLSearchParams(location.hash.slice(1));
  if(h.get('state')!=='maison_drive')return;
  const err=h.get('error');
  if(err){
    sessionStorage.setItem('maison_drive_err',err);
  }else if(h.get('access_token')){
    const exp=Date.now()+(parseInt(h.get('expires_in')||'3600',10)-60)*1000;
    localStorage.setItem('maison_drive_tok',JSON.stringify({tok:h.get('access_token'),exp}));
    sessionStorage.removeItem('maison_drive_err');
    sessionStorage.removeItem('maison_drive_tried');
  }
  history.replaceState(null,'',location.pathname+location.search);
}
function getDriveToken(){try{const t=JSON.parse(localStorage.getItem('maison_drive_tok')||'null');if(t&&t.exp>Date.now())return t.tok;}catch(e){}return null;}
function driveAuthRedirect(interactive){
  const p=new URLSearchParams({client_id:DRIVE_CLIENT_ID,redirect_uri:location.origin+location.pathname,response_type:'token',scope:DRIVE_SCOPE,state:'maison_drive',include_granted_scopes:'true'});
  if(currentUserEmail)p.set('login_hint',currentUserEmail);
  if(!interactive)p.set('prompt','none');
  location.href='https://accounts.google.com/o/oauth2/v2/auth?'+p.toString();
}
// Returns true if it navigated away to silently reconnect (so callers must not
// start another redirect this tick — a second location.href would clobber this one).
function driveBoot(){
  driveAccessToken=getDriveToken();
  if(driveAccessToken){
    localStorage.setItem(`maison_drive_on_${currentUser}`,'1');
    driveSyncNow(false);
    return false;
  }
  // Sync was on before but token expired — reconnect silently, once per session
  if(localStorage.getItem(`maison_drive_on_${currentUser}`)&&!sessionStorage.getItem('maison_drive_tried')){
    sessionStorage.setItem('maison_drive_tried','1');
    driveAuthRedirect(false);
    return true;
  }
  return false;
}
function driveTokenInvalid(){localStorage.removeItem('maison_drive_tok');driveAccessToken=null;}
function enableDriveSync(){sessionStorage.removeItem('maison_drive_err');lastSyncError=null;driveAuthRedirect(true);}
function disableDriveSync(){driveTokenInvalid();localStorage.removeItem(`maison_drive_on_${currentUser}`);if(driveSyncTimer){clearTimeout(driveSyncTimer);driveSyncTimer=null;}closeModal();openSettings();}
async function driveFetch(url,opts){
  const res=await fetch(url,opts);
  if(res.status===401){driveTokenInvalid();throw new Error('Google sign-in expired — tap Reconnect Sync in Settings');}
  if(res.status===403){let msg='';try{const j=await res.json();msg=(j.error&&j.error.message)||'';}catch(e){}throw new Error(msg||'Google Drive refused the request (403). Check the Drive API is enabled in Google Cloud Console.');}
  if(!res.ok)throw new Error('Drive error '+res.status);
  return res;
}
async function driveSyncNow(manual){
  if(!driveAccessToken||!currentUser)return;
  try{
    driveBlocked=false;
    const verdict=await loadFromDrive();
    if(verdict!=='applied'&&verdict!=='insync')await syncToDrive();
    const failedPhotos=await syncPhotoFiles();
    lastSyncAt=Date.now();
    lastSyncError=failedPhotos?`${failedPhotos} photo${failedPhotos!==1?'s':''} couldn't be copied to Drive yet — they'll be retried on the next sync.`:null;
    if(manual){closeModal();alert('Synced successfully ✓');openSettings();}
  }catch(e){
    lastSyncError=(e&&e.message)?e.message:String(e);
    if(manual)alert('Sync failed: '+lastSyncError);
  }
}
async function loadFromDrive(){
  if(!driveAccessToken)return 'noauth';
  const auth={headers:{Authorization:'Bearer '+driveAccessToken}};
  const res=await driveFetch('https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name%3D%27maison_data.json%27&fields=files(id)',auth);
  const list=await res.json();
  const file=(list.files||[])[0];
  if(!file){driveFileId=null;return 'nofile';}
  driveFileId=file.id;
  const dr=await driveFetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,auth);
  const payload=await dr.json();
  if(!payload||!payload.keys)return 'nofile';
  const lwKey=`maison_${currentUser}_lastwrite`;
  const localAt=parseInt(localStorage.getItem(lwKey)||'0',10);
  const driveAt=payload.at||0;
  if(driveAt>localAt){
    // Drive copy is newer — replace local data with it. If it doesn't fit on this device the old local data is put
    // back and pushing to Drive is blocked, so a partial restore can never overwrite the complete copy in Drive.
    const prefix=`maison_${currentUser}_`;
    const oldEntries=Object.keys(localStorage).filter(k=>k.startsWith(prefix)).map(k=>[k,localStorage.getItem(k)]);
    oldEntries.forEach(([k])=>localStorage.removeItem(k));
    const written=[];let failed=false;
    for(const [k,v] of Object.entries(payload.keys)){
      try{localStorage.setItem(k,JSON.stringify(v));written.push(k);}catch(e){failed=true;break;}
    }
    if(failed){
      written.forEach(k=>localStorage.removeItem(k));
      oldEntries.forEach(([k,v])=>{try{localStorage.setItem(k,v);}catch(e){}});
      driveBlocked=true;
      storageFull("Your latest data in Google Drive is too big to load on this device, so syncing is paused to keep it safe.");
      throw new Error('Not enough storage on this device to load your Drive data — free up space, then tap Sync Now.');
    }
    try{localStorage.setItem(lwKey,String(driveAt));}catch(e){}
    refreshSection();updatePanelBadge();
    migrateInlinePhotos().then(ch=>{if(ch)refreshSection();}).catch(()=>{});   // shrink any big photos that arrived from an older device
    return 'applied';
  }
  return driveAt===localAt?'insync':'localnewer';
}
function scheduleDriveSync(){
  if(!driveAccessToken)return;
  if(driveSyncTimer)clearTimeout(driveSyncTimer);
  driveSyncTimer=setTimeout(()=>{syncToDrive().then(()=>{lastSyncAt=Date.now();lastSyncError=null;}).catch(e=>{lastSyncError=(e&&e.message)||String(e);});},2500);
}
let driveBlocked=false;   // set when a Drive restore didn't fit on this device: never push local data over Drive
async function syncToDrive(){
  if(!driveAccessToken||!currentUser)return;
  if(driveBlocked)throw new Error('Sync is paused because your Drive data did not fit on this device — free up space, then tap Sync Now.');
  const keys={};
  const lwKey=`maison_${currentUser}_lastwrite`;
  Object.keys(localStorage).filter(k=>k.startsWith(`maison_${currentUser}_`)&&k!==lwKey).forEach(k=>{try{keys[k]=JSON.parse(localStorage.getItem(k));}catch(e){}});
  const at=Date.now();
  const body=JSON.stringify({keys,at});
  if(driveFileId){
    await driveFetch(`https://www.googleapis.com/upload/drive/v3/files/${driveFileId}?uploadType=media`,{method:'PATCH',headers:{Authorization:'Bearer '+driveAccessToken,'Content-Type':'application/json'},body});
  }else{
    const form=new FormData();
    form.append('metadata',new Blob([JSON.stringify({name:'maison_data.json',parents:['appDataFolder']})],{type:'application/json'}));
    form.append('file',new Blob([body],{type:'application/json'}));
    const cr=await driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',{method:'POST',headers:{Authorization:'Bearer '+driveAccessToken},body:form});
    const created=await cr.json();
    if(created.id)driveFileId=created.id;
  }
  try{localStorage.setItem(lwKey,String(at));}catch(e){}
}

// ── PHOTO FILE SYNC (full-res photos live as individual files in appDataFolder) ──
let bigPhotoIds=new Set();   // videos and other files: synced up to Drive like photos, but only fetched when opened
function referencedPhotoIds(){
  const ids=[];bigPhotoIds=new Set();
  const push=p=>{if(p&&p.id){ids.push(p.id);if(p.kind)bigPhotoIds.add(p.id);}};
  const home=userData('home',{rooms:[]});
  (home.rooms||[]).forEach(r=>{(r.photos||[]).forEach(push);((r.moodboard&&r.moodboard.tiles)||[]).forEach(push);});
  const w=userData('wedding',{inspo:[]});(w.inspo||[]).forEach(push);
  const h=userData('honeymoon',{rooms:[],inspo:[]});(h.inspo||[]).forEach(push);(h.rooms||[]).forEach(r=>(r.photos||[]).forEach(push));
  const d=userData('dayout',{plans:[]});(d.plans||[]).forEach(pl=>(pl.photos||[]).forEach(push));
  const rec=userData('recipes',{items:[]});rec.items.forEach(it=>{if(it.img&&it.id)ids.push(it.id);(it.photos||[]).forEach(push);});
  ['wedding','home','honeymoon','closet'].forEach(ctx=>{userData(`moodboards_${ctx}`,[]).forEach(b=>(b.tiles||[]).forEach(push));});
  ((userData('closet',null)||{}).items||[]).forEach(push);
  const evd=userData('events',null)||{};(evd.events||[]).forEach(e=>(e.photos||[]).forEach(p=>{if(p&&p.id&&p.mid===(e.me||{}).id)ids.push(p.id);}));
  return ids.concat(referencedAudioIds());
}
// Uploaded songs ride the same IndexedDB + Drive file mirror as photos, keyed by song id. Unlike photos they are
// only downloaded to a new device when played (see syncPhotoFiles / playSong), since they can be large.
function referencedAudioIds(){
  const ids=[];
  (userData('music',{playlists:[]}).playlists||[]).forEach(p=>(p.songs||[]).forEach(s=>{if(s&&s.id&&s.audio)ids.push(s.id);}));
  return ids;
}
function photoFileName(id){return 'mzphoto_'+id+'.jpg';}
async function listRemotePhotos(){
  const auth={headers:{Authorization:'Bearer '+driveAccessToken}};
  const map={};let pageToken='';
  do{
    let url=`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${encodeURIComponent("name contains 'mzphoto_'")}&fields=nextPageToken,files(id,name)&pageSize=1000`;
    if(pageToken)url+='&pageToken='+encodeURIComponent(pageToken);
    const j=await(await driveFetch(url,auth)).json();
    (j.files||[]).forEach(f=>{map[f.name]=f.id;});
    pageToken=j.nextPageToken||'';
  }while(pageToken);
  return map;
}
async function uploadAppDataPhoto(id,blob){
  // Songs are big: above ~4MB use Drive's resumable upload (single PUT), falling back to multipart if the browser can't read the session URL.
  if(blob.size>4*1048576){
    const type=blob.type||'application/octet-stream';
    const init=await driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',{method:'POST',headers:{Authorization:'Bearer '+driveAccessToken,'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Type':type,'X-Upload-Content-Length':String(blob.size)},body:JSON.stringify({name:photoFileName(id),parents:['appDataFolder']})});
    const loc=init.headers&&init.headers.get('Location');
    if(loc){await driveFetch(loc,{method:'PUT',headers:{'Content-Type':type},body:blob});return;}
  }
  const form=new FormData();
  form.append('metadata',new Blob([JSON.stringify({name:photoFileName(id),parents:['appDataFolder']})],{type:'application/json'}));
  form.append('file',blob,photoFileName(id));
  await driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',{method:'POST',headers:{Authorization:'Bearer '+driveAccessToken},body:form});
}
let photoSyncRunning=false,photoSyncAgain=false;
// Copies full-size photos between this device (IndexedDB) and Drive. Returns how many couldn't be transferred so
// the caller can tell the user (failures used to be swallowed). A photo added while a sync is running triggers a re-run.
async function syncPhotoFiles(){
  if(!driveAccessToken||!currentUser)return 0;
  if(photoSyncRunning){photoSyncAgain=true;return 0;}
  const ids=Array.from(new Set(referencedPhotoIds()));
  if(!ids.length)return 0;
  photoSyncRunning=true;let failed=0;
  try{
    const remote=await listRemotePhotos();
    const auth={headers:{Authorization:'Bearer '+driveAccessToken}};
    const audioIds=new Set(referencedAudioIds());
    for(const id of ids){
      const fn=photoFileName(id);
      if(audioIds.has(id)||bigPhotoIds.has(id))continue;   // songs, videos and files are fetched on demand
      if(remote[fn]&&!(await idbGetPhoto(id))){
        try{const blob=await(await driveFetch(`https://www.googleapis.com/drive/v3/files/${remote[fn]}?alt=media`,auth)).blob();if(!(await idbPutPhoto(id,blob)))failed++;}catch(e){failed++;if(!driveAccessToken)break;}
      }
    }
    for(const id of ids){
      if(!driveAccessToken)break;
      if(!remote[photoFileName(id)]){
        const blob=await idbGetPhoto(id);
        if(blob){try{await uploadAppDataPhoto(id,blob);}catch(e){failed++;}}
      }
    }
  }finally{
    photoSyncRunning=false;
    if(photoSyncAgain){photoSyncAgain=false;syncPhotoFiles().catch(()=>{});}
  }
  return failed;
}
async function ensurePhotoLocal(id){
  if(!driveAccessToken)return null;
  try{
    const auth={headers:{Authorization:'Bearer '+driveAccessToken}};
    const url=`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${encodeURIComponent("name='"+photoFileName(id)+"'")}&fields=files(id)`;
    const f=((await(await driveFetch(url,auth)).json()).files||[])[0];
    if(!f)return null;
    const blob=await(await driveFetch(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`,auth)).blob();
    await idbPutPhoto(id,blob);return blob;
  }catch(e){return null;}
}
async function deleteRemotePhoto(id){
  if(!driveAccessToken)return;
  try{
    const auth={headers:{Authorization:'Bearer '+driveAccessToken}};
    const url=`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${encodeURIComponent("name='"+photoFileName(id)+"'")}&fields=files(id)`;
    const f=((await(await driveFetch(url,auth)).json()).files||[])[0];
    if(f)await driveFetch(`https://www.googleapis.com/drive/v3/files/${f.id}`,{method:'DELETE',headers:{Authorization:'Bearer '+driveAccessToken}});
  }catch(e){}
}
function syncPhotosSoon(){if(driveAccessToken)syncPhotoFiles().catch(()=>{});}

// ── PHOTO MIGRATION (converts old inline base64 photos to thumb + IndexedDB) ──
// Shrinks an oversized inline photo (`owner.img`) down to the standard thumbnail. Two cases:
//  • legacy inline original (>180k chars, from before the IndexedDB fix): the original is stored in IndexedDB FIRST;
//    if that fails the photo is left untouched so nothing is ever lost.
//  • older 900px thumbnail: the full-size copy already lives in IndexedDB/Drive, so only the thumbnail is shrunk
//    (it must NOT be stored as the "full-size" copy, or a second device would never pull the real one).
async function shrinkInlinePhoto(owner,id){
  const s=owner&&owner.img;
  if(!s||s.length<=45000||s.indexOf('data:')!==0)return false;
  try{
    const im=await loadImageFromDataURL(s);
    if(Math.max(im.naturalWidth,im.naturalHeight)<=THUMB_MAX+20&&s.length<=90000)return false;   // already a standard thumbnail
    if(s.length>180000&&!(await idbGetPhoto(id))){
      if(!(await idbPutPhoto(id,dataURLtoBlob(s))))return false;
    }
    owner.img=makeThumb(im);return true;
  }catch(e){return false;}
}
async function migratePhotoArray(arr){
  let changed=false;
  for(const p of arr)if(await shrinkInlinePhoto(p,p&&p.id))changed=true;
  return changed;
}
async function migrateInlinePhotos(){
  let changed=false;
  const home=userData('home',{rooms:[]});
  for(const r of(home.rooms||[])){
    if(await migratePhotoArray(r.photos||[]))changed=true;
    if(r.moodboard&&await migratePhotoArray(r.moodboard.tiles||[]))changed=true;
  }
  if(changed)saveData('home',home);
  const w=userData('wedding',{inspo:[]});
  if(await migratePhotoArray(w.inspo||[])){saveData('wedding',w);changed=true;}
  const h=userData('honeymoon',{rooms:[],inspo:[]});
  let hChanged=await migratePhotoArray(h.inspo||[]);
  for(const r of(h.rooms||[]))if(await migratePhotoArray(r.photos||[]))hChanged=true;
  if(hChanged){saveData('honeymoon',h);changed=true;}
  const d=userData('dayout',{plans:[]});
  let dChanged=false;
  for(const pl of(d.plans||[]))if(await migratePhotoArray(pl.photos||[]))dChanged=true;
  if(dChanged){saveData('dayout',d);changed=true;}
  const rec=userData('recipes',{items:[]});
  let recChanged=false;
  for(const it of rec.items){
    if(await shrinkInlinePhoto(it,it.id))recChanged=true;
    if(await migratePhotoArray(it.photos||[]))recChanged=true;
  }
  if(recChanged){saveData('recipes',rec);changed=true;}
  for(const ctx of['wedding','home','honeymoon','closet']){
    const boards=userData(`moodboards_${ctx}`,[]);
    let bChanged=false;
    for(const b of boards)if(await migratePhotoArray(b.tiles||[]))bChanged=true;
    if(bChanged){saveData(`moodboards_${ctx}`,boards);changed=true;}
  }
  if(changed)syncPhotosSoon();
  return changed;
}
function bootStorageAndMigration(){
  if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{});
  migrateInlinePhotos().then(changed=>{if(changed)refreshSection();}).catch(()=>{});
}

// ── GOOGLE DRIVE BACKUP (visible folder, separate from the invisible sync above) ──
const BACKUP_DRIVE_SCOPE='https://www.googleapis.com/auth/drive';
const BACKUP_FILENAME='maison-backup.json';
function getBkToken(){try{const t=JSON.parse(localStorage.getItem('maison_bkdrive_tok')||'null');if(t&&t.exp>Date.now())return t.tok;}catch(e){}return null;}
function hasBkToken(){return !!getBkToken();}
function bkTokenInvalid(){localStorage.removeItem('maison_bkdrive_tok');}
function bkDriveAuthRedirect(interactive){
  const p=new URLSearchParams({client_id:DRIVE_CLIENT_ID,redirect_uri:location.origin+location.pathname,response_type:'token',scope:BACKUP_DRIVE_SCOPE,state:'maison_bkdrive',include_granted_scopes:'true'});
  if(currentUserEmail)p.set('login_hint',currentUserEmail);
  p.set('prompt',interactive?'consent':'none');
  location.href='https://accounts.google.com/o/oauth2/v2/auth?'+p.toString();
}
function checkBkDriveRedirect(){
  if(!location.hash)return;
  const h=new URLSearchParams(location.hash.slice(1));
  if(h.get('state')!=='maison_bkdrive')return;
  const err=h.get('error');
  if(err){sessionStorage.setItem('maison_bkdrive_err',err);}
  else if(h.get('access_token')){
    const exp=Date.now()+(parseInt(h.get('expires_in')||'3600',10)-60)*1000;
    localStorage.setItem('maison_bkdrive_tok',JSON.stringify({tok:h.get('access_token'),exp}));
    sessionStorage.removeItem('maison_bkdrive_err');sessionStorage.removeItem('maison_bkdrive_tried');
  }
  history.replaceState(null,'',location.pathname+location.search);
}
function bkDriveBoot(){
  if(getBkToken()){
    localStorage.setItem(`maison_bkdrive_on_${currentUser}`,'1');
    return;
  }
  if(localStorage.getItem(`maison_bkdrive_on_${currentUser}`)&&!sessionStorage.getItem('maison_bkdrive_tried')){
    sessionStorage.setItem('maison_bkdrive_tried','1');
    bkDriveAuthRedirect(false);
  }
}
function bkDisconnect(){
  if(!confirm('Disconnect Google Drive backup? The folder you already backed up to keeps its file, but it will stop updating.'))return;
  bkTokenInvalid();
  localStorage.removeItem(`maison_bkdrive_on_${currentUser}`);
  const gd=userData('gdrive_backup',{});
  saveData('gdrive_backup',Object.assign({},gd,{enabled:false,folderId:null,folderName:null}));
  closeModal();openSettings();
}
async function bkFetch(url,opts){
  const res=await fetch(url,opts);
  if(res.status===401){bkTokenInvalid();throw new Error('Google sign-in expired — reconnect in Settings.');}
  if(res.status===403){let msg='';try{const j=await res.json();msg=(j.error&&j.error.message)||'';}catch(e){}throw new Error(msg||'Google Drive refused the request (403).');}
  if(!res.ok)throw new Error('Drive error '+res.status);
  return res;
}
async function openBkFolderPicker(){
  const token=getBkToken();
  if(!token){alert('Connect Google Drive first.');return;}
  bkPickStack=[{id:'root',name:'My Drive'}];
  await renderBkPicker();
}
async function renderBkPicker(){
  const token=getBkToken();
  if(!token){closeModal();alert('Your Google Drive connection expired — reconnect in Settings.');return;}
  const cur=bkPickStack[bkPickStack.length-1];
  const q=encodeURIComponent(`'${cur.id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  let items=[];
  try{
    const r=await bkFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=200&orderBy=name`,{headers:{Authorization:'Bearer '+token}});
    const j=await r.json();
    items=j.files||[];
  }catch(e){
    openModal(`<div class="modal-head"><div class="modal-title">Google Drive</div><button class="modal-close" onclick="closeModal()">×</button></div><p style="color:var(--red);font-size:13px">Could not list your Drive folders: ${escHtml(e.message)}</p>`);
    return;
  }
  const crumb=bkPickStack.map((s,i)=>`<button class="btn-ghost" style="padding:2px 8px;font-size:12.5px" onclick="bkPickStack=bkPickStack.slice(0,${i+1});renderBkPicker()">${escHtml(s.name)}</button>`).join(' / ');
  const rows=items.map(it=>`<div class="link-item" style="cursor:pointer" onclick='bkPickStack=bkPickStack.concat([{id:"${it.id}",name:${JSON.stringify(it.name)}}]);renderBkPicker()'><div class="link-item-title">${escHtml(it.name)}</div></div>`).join('')||`<div class="empty" style="padding:16px 0;font-size:13px">No folders here.</div>`;
  openModal(`<div class="modal-head"><div class="modal-title">Choose a Google Drive folder</div><button class="modal-close" onclick="closeModal()">×</button></div>
    <div style="margin-bottom:10px;font-size:12px">${crumb}</div>
    <div style="max-height:320px;overflow-y:auto;border-top:1px solid var(--bone)">${rows}</div>
    <div class="modal-row" style="margin-top:14px">
      <button class="btn-solid sm" onclick='chooseBkFolder("${cur.id}",${JSON.stringify(cur.name)})'>Save backups here</button>
      <button class="btn-ghost" onclick="closeModal()">Cancel</button>
    </div>`);
}
function chooseBkFolder(id,name){
  const gd=userData('gdrive_backup',{});
  saveData('gdrive_backup',Object.assign({},gd,{enabled:true,folderId:id,folderName:name}));
  closeModal();openSettings();
  bkBackupNow(false);
}
function toggleBkBackup(){
  const gd=Object.assign({},userData('gdrive_backup',{}));gd.enabled=!gd.enabled;
  saveData('gdrive_backup',gd);openSettings();
  if(gd.enabled)bkBackupNow(false);
}
async function bkBackupNow(manual){
  const gd=userData('gdrive_backup',{});
  if(!gd.enabled||!gd.folderId)return;
  if(driveBlocked){lastBkBackupError='Backup paused: your Drive data did not fit on this device. Free up space and sync first.';if(manual)alert(lastBkBackupError);return;}   // never overwrite the backup with a partial copy
  const token=getBkToken();
  if(!token){if(manual)alert('Reconnect Google Drive backup in Settings.');return;}
  const keys={};
  Object.keys(localStorage).filter(k=>k.startsWith(`maison_${currentUser}_`)).forEach(k=>{try{keys[k]=JSON.parse(localStorage.getItem(k));}catch(e){}});
  const body=JSON.stringify({v:1,keys,exported:Date.now()});
  try{
    const auth={headers:{Authorization:'Bearer '+token}};
    const q=encodeURIComponent(`'${gd.folderId}' in parents and name='${BACKUP_FILENAME}' and trashed=false`);
    const lr=await bkFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`,auth);
    const lj=await lr.json();
    const existing=(lj.files||[])[0];
    if(existing){
      await bkFetch(`https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media`,{method:'PATCH',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body});
    }else{
      const form=new FormData();
      form.append('metadata',new Blob([JSON.stringify({name:BACKUP_FILENAME,parents:[gd.folderId]})],{type:'application/json'}));
      form.append('file',new Blob([body],{type:'application/json'}));
      await bkFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',{method:'POST',headers:{Authorization:'Bearer '+token},body:form});
    }
    lastBkBackupAt=Date.now();lastBkBackupError=null;
    if(manual){alert('Backed up to Google Drive ✓');openSettings();}
  }catch(e){
    lastBkBackupError=e.message;
    if(manual)alert('Backup failed: '+e.message);
  }
}
function scheduleBkBackup(){
  const gd=userData('gdrive_backup',{});if(!gd.enabled)return;
  if(bkBackupTimer)clearTimeout(bkBackupTimer);
  bkBackupTimer=setTimeout(()=>bkBackupNow(false),4000);
}

function setupFileInputs(){
  document.getElementById('fp-file-input').onchange=function(e){
    const f=e.target.files[0];if(!f)return;
    const r=new FileReader();r.onload=async ev=>{const fp=userData('floorplan',{img:null,markers:[]});fp.img=await compressSingleImage(ev.target.result,1600,.82);saveData('floorplan',fp);showSection('home');};r.readAsDataURL(f);this.value='';
  };
}

