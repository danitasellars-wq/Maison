// MAISON · core.js — plain script, shares globals with the other files in js/ (load order is set in index.html).
// ── RAL COLOURS ──
const RAL={
  '1000':'#CCC58F','1001':'#D0A86B','1002':'#D9A521','1003':'#F9A800','1004':'#E49E00','1005':'#CB8C00',
  '2000':'#E75B12','2001':'#BE4E20','2002':'#C53D16','2003':'#F47023',
  '3000':'#AB2524','3001':'#A52019','3002':'#A52019','3003':'#8E1B1C','3005':'#5B1A20','3007':'#3A1C22',
  '3009':'#744231','3011':'#7B2B2B','3013':'#963434','3015':'#E8AFAB','3016':'#B54B3A','3018':'#C6304A',
  '3020':'#BB1F25','3022':'#D2614A','3027':'#B52444',
  '4001':'#8A4F7D','4002':'#8E2C48','4003':'#D15B8F','4005':'#7A5AA0','4007':'#4A1348','4009':'#A68BA0',
  '5000':'#264E6E','5001':'#1A4E6A','5002':'#2B3480','5003':'#224568','5005':'#1A4B80','5007':'#3B6186',
  '5010':'#0E4C8C','5011':'#1F3148','5012':'#3882C4','5015':'#1876B4','5017':'#064A8C','5018':'#3B9DB3',
  '5021':'#007B8C','5024':'#7093AC',
  '6000':'#3B6E52','6001':'#2E6444','6002':'#3C6944','6005':'#1F4D34','6010':'#3B6B3B','6011':'#587B4A',
  '6016':'#1B6E3F','6017':'#4E813B','6018':'#5C9140','6019':'#C5DBB8','6024':'#3B8547','6027':'#82C8B8',
  '6029':'#228B45','6032':'#237A4B','6037':'#2A8240',
  '7000':'#7E8B93','7001':'#8A9598','7002':'#888070','7003':'#817B6E','7004':'#9B9C9B','7005':'#6A6E6A',
  '7015':'#535B63','7016':'#3D4549','7021':'#252B2F','7030':'#939185','7031':'#5B6A75','7032':'#B5B0A0',
  '7035':'#C5CBCF','7037':'#7D8589','7038':'#B0B4B5','7039':'#6F7172','7040':'#9EA4AA','7042':'#8F9695',
  '7043':'#4B5457','7044':'#B9B7A8','7045':'#919599','7047':'#D0D0CF',
  '8000':'#89693E','8001':'#9E6025','8002':'#7B4429','8003':'#7A4728','8004':'#874B35','8007':'#6F4925',
  '8008':'#6D4D2A','8011':'#542F1E','8012':'#6D3026','8014':'#4B3421','8015':'#5D2A1F','8016':'#4C2820',
  '8017':'#442320','8019':'#362B27','8022':'#1A1213','8023':'#9E5E25','8024':'#79471D','8025':'#6E4D2C',
  '8028':'#4E3A27',
  '9001':'#F4EBD4','9002':'#E5E0D4','9003':'#ECECE8','9004':'#2B2B2C','9005':'#0A0A0A','9006':'#A9ABAC',
  '9007':'#898A8D','9010':'#F7F6EF','9011':'#1C1C1E','9016':'#F7F7F4','9017':'#282826','9018':'#D4D7D4'
};
const RAL_NAMES={
  '1000':'Beige Green','1001':'Beige','1002':'Sand Yellow','1003':'Signal Yellow','1004':'Golden Yellow','1005':'Honey Yellow',
  '2000':'Yellow Orange','2001':'Red Orange','2002':'Vermilion','2003':'Pastel Orange',
  '3000':'Flame Red','3001':'Signal Red','3002':'Carmine Red','3003':'Ruby Red','3005':'Wine Red','3007':'Black Red',
  '3009':'Oxide Red','3011':'Brown Red','3013':'Tomato Red','3015':'Light Pink','3016':'Coral Red','3018':'Strawberry Red',
  '3020':'Traffic Red','3022':'Salmon Pink','3027':'Raspberry Red',
  '4001':'Red Lilac','4002':'Red Violet','4003':'Heather Violet','4005':'Blue Lilac','4007':'Purple Violet','4009':'Pastel Violet',
  '5000':'Violet Blue','5001':'Green Blue','5002':'Ultramarine Blue','5003':'Sapphire Blue','5005':'Signal Blue',
  '5007':'Brilliant Blue','5010':'Gentian Blue','5011':'Steel Blue','5012':'Light Blue','5015':'Sky Blue',
  '5017':'Traffic Blue','5018':'Turquoise Blue','5021':'Water Blue','5024':'Pastel Blue',
  '6000':'Patina Green','6001':'Emerald Green','6002':'Leaf Green','6005':'Moss Green','6010':'Grass Green',
  '6011':'Reseda Green','6016':'Turquoise Green','6017':'Yellow Olive','6018':'Yellow Green','6019':'White Green',
  '6024':'Traffic Green','6027':'Light Green','6029':'Mint Green','6032':'Signal Green','6037':'Pure Green',
  '7000':'Squirrel Grey','7001':'Silver Grey','7002':'Olive Grey','7003':'Moss Grey','7004':'Signal Grey',
  '7005':'Mouse Grey','7015':'Slate Grey','7016':'Anthracite Grey','7021':'Black Grey','7030':'Stone Grey',
  '7031':'Blue Grey','7032':'Pebble Grey','7035':'Light Grey','7037':'Dusty Grey','7038':'Agate Grey',
  '7039':'Quartz Grey','7040':'Window Grey','7042':'Traffic Grey A','7043':'Traffic Grey B',
  '7044':'Silk Grey','7045':'Telegrey 1','7047':'Telegrey 4',
  '8000':'Green Brown','8001':'Ochre Brown','8002':'Signal Brown','8003':'Clay Brown','8004':'Copper Brown',
  '8007':'Fawn Brown','8008':'Olive Brown','8011':'Nut Brown','8012':'Red Brown','8014':'Sepia Brown',
  '8015':'Chestnut Brown','8016':'Mahogany Brown','8017':'Chocolate Brown','8019':'Grey Brown','8022':'Black Brown',
  '8023':'Orange Brown','8024':'Beige Brown','8025':'Pale Brown','8028':'Terra Brown',
  '9001':'Cream','9002':'Grey White','9003':'Signal White','9004':'Signal Black','9005':'Jet Black',
  '9006':'White Aluminium','9007':'Grey Aluminium','9010':'Pure White','9011':'Graphite Black',
  '9016':'Traffic White','9017':'Traffic Black','9018':'Papyrus White'
};

// ── STATE ──
let currentUser=null,currentSection='home',capturedDataURL=null;
let panelFilter='all',panelMode='photos',homeView='rooms',activeRoomTab='overview';
let activeDayOutId=null,dragRoomIdx=null,activeMusicPlaylistId=null;
let currentUserEmail=null,currentUserName='User';
let _lpTimer=null,_lpFired=false;
let driveAccessToken=null,driveFileId=null,driveSyncTimer=null;
let _wpTemp=null;
let bkPickStack=null,bkBackupTimer=null,lastBkBackupAt=null,lastBkBackupError=null;

function getStore(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}}
// Browsers cap localStorage (~5MB). A failed write used to vanish silently, so the user thought data was saved when it wasn't.
let _storageWarnAt=0;
function storageFull(what){
  if(Date.now()-_storageWarnAt<20000)return;_storageWarnAt=Date.now();
  alert((what||"MAISON couldn't save that — this device's storage for the app is full.")+"\n\nFree up space by deleting photos you no longer need (Settings shows how much is used). Your data already in Google Drive is not affected.");
}
function setStore(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(e){storageFull();return false;}}
function userData(k,d){return getStore(`maison_${currentUser}_${k}`,d);}
function saveData(k,v){
  const ok=setStore(`maison_${currentUser}_${k}`,v);
  if(!ok)return false;   // nothing was stored, so don't mark a newer write or push stale data to Drive
  try{localStorage.setItem(`maison_${currentUser}_lastwrite`,String(Date.now()));}catch(e){}
  scheduleDriveSync();scheduleBkBackup();return true;
}
function escHtml(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6);}

// ── PHOTO PROCESSING & LOCAL MEDIA STORE ──
// Root cause of the old "out of storage" errors: full-res camera photos (often
// several MB each) were stored as base64 directly in localStorage, which browsers
// cap at ~5MB regardless of device/Drive space. Now: a small thumbnail (the only
// thing that still lives in localStorage/JSON as `img`) is generated for display,
// and the full-res version is stored as a blob in IndexedDB, mirrored to the Drive
// appDataFolder as an individual file so it still syncs across devices.
function loadImageFromDataURL(dataURL){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=dataURL;});}
function scaleDims(w,h,max){if(w>max||h>max){const s=max/Math.max(w,h);return{w:Math.round(w*s),h:Math.round(h*s)};}return{w,h};}
function drawToCanvas(im,w,h){const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(im,0,0,w,h);return c;}
function canvasDataURL(canvas,q){return canvas.toDataURL('image/jpeg',q);}
function canvasBlob(canvas,q){return new Promise(res=>canvas.toBlob(b=>res(b),'image/jpeg',q));}
function dataURLtoBlob(dataURL){
  const[header,data]=dataURL.split(',');const mime=(header.match(/:(.*?);/)||[])[1]||'image/jpeg';
  const bin=atob(data);const arr=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);
  return new Blob([arr],{type:mime});
}
async function processPhotoDataURL(dataURL){
  const im=await loadImageFromDataURL(dataURL);
  const full=scaleDims(im.naturalWidth,im.naturalHeight,1600);
  const blob=await canvasBlob(drawToCanvas(im,full.w,full.h),.85)||dataURLtoBlob(dataURL);
  const thumb=makeThumb(im);
  return{thumb,blob};
}
// Inline thumbnail (what lives in localStorage and the synced JSON). ~30KB instead of ~70KB at 900px, so a
// 5MB browser limit holds ~170 photos rather than ~65. The full-size copy is in IndexedDB + Drive.
const THUMB_MAX=560,THUMB_Q=.62;
function makeThumb(im){const th=scaleDims(im.naturalWidth,im.naturalHeight,THUMB_MAX);return canvasDataURL(drawToCanvas(im,th.w,th.h),THUMB_Q);}
async function compressSingleImage(dataURL,maxDim,quality){
  try{const im=await loadImageFromDataURL(dataURL);const d=scaleDims(im.naturalWidth,im.naturalHeight,maxDim||1600);return canvasDataURL(drawToCanvas(im,d.w,d.h),quality||.8);}catch(e){return dataURL;}
}
const MEDIA_DB_NAME='maison_media',PHOTO_STORE='photos';
function mediaDB(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(MEDIA_DB_NAME,1);
    req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(PHOTO_STORE))req.result.createObjectStore(PHOTO_STORE);};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
// Never throws: if the full-size copy can't be stored (device storage low) the thumbnail still saves, the user is told,
// and callers can check the boolean. (A throw here used to abort saves half-way and leave dialogs stuck.)
async function idbPutPhoto(id,blob){
  try{
    const db=await mediaDB();
    await new Promise((resolve,reject)=>{const tx=db.transaction(PHOTO_STORE,'readwrite');tx.objectStore(PHOTO_STORE).put(blob,id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
    return true;
  }catch(e){storageFull("The photo was saved, but its full-size copy couldn't be stored — this device is low on space.");return false;}
}
async function idbGetPhoto(id){const db=await mediaDB();return new Promise((resolve,reject)=>{const tx=db.transaction(PHOTO_STORE,'readonly');const rq=tx.objectStore(PHOTO_STORE).get(id);rq.onsuccess=()=>resolve(rq.result||null);rq.onerror=()=>reject(rq.error);});}
async function idbDeletePhoto(id){const db=await mediaDB();return new Promise((resolve,reject)=>{const tx=db.transaction(PHOTO_STORE,'readwrite');tx.objectStore(PHOTO_STORE).delete(id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}

// ── GOOGLE AUTH ──
function initGoogle(){
  google.accounts.id.initialize({client_id:'643043876163-9evtski9p2oqs4s1pg0nn4g1tnqdeiv8.apps.googleusercontent.com',callback:googleCred,auto_select:true});
  google.accounts.id.renderButton(document.getElementById('g_signin_btn'),{theme:'outline',size:'large',text:'sign_in_with',shape:'rectangular',width:260});
}
function parseJwt(t){try{return JSON.parse(atob(t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));}catch(e){return null;}}
function handleGoogleLogin(response){
  const p=parseJwt(response.credential);if(!p)return;
  currentUser=p.sub;currentUserEmail=p.email||null;currentUserName=p.name||p.email||'User';
  localStorage.setItem('maison_sess',JSON.stringify({sub:p.sub,email:p.email||null,name:p.name||p.email||'User',exp:Date.now()+7*24*60*60*1000}));
  document.getElementById('auth-screen').style.display='none';
  document.getElementById('app').classList.add('visible');
  setupFileInputs();showSection('dashboard');updatePanelBadge();
  if(!driveBoot())bkDriveBoot();
  bootStorageAndMigration();
  if(EV_AUTH&&evCloudOn())evAuthFromCredential(response.credential).then(()=>evBootSync());else evBootSync();
}
// After sign-in: send any event changes that were waiting, refresh shared events, and open an invitation link if one was used.
function evBootSync(){
  try{
    if(evCloudOn()){evFlushAll();evData().events.filter(e=>e.shared).forEach(e=>evPull(e.id));setTimeout(evSnapshotAll,10000);}
    evHandleHash();
  }catch(e){}
}
window.addEventListener('load',()=>{
  const vm=/^#view=([0-9a-f]{32})$/.exec(location.hash||'');
  if(vm){viewerBoot(vm[1]);return;}   // a read-only link: no sign-in, nothing else of the app is started
  evStashInvite();
  checkDriveRedirect();
  checkBkDriveRedirect();
  try{
    const sess=JSON.parse(localStorage.getItem('maison_sess')||'null');
    if(sess&&sess.exp>Date.now()&&sess.sub){
      currentUser=sess.sub;currentUserEmail=sess.email||null;currentUserName=sess.name||'User';
      document.getElementById('auth-screen').style.display='none';
      document.getElementById('app').classList.add('visible');
      setupFileInputs();showSection('dashboard');updatePanelBadge();
      if(!driveBoot())bkDriveBoot();
      bootStorageAndMigration();
      evBootSync();
      return;
    }
  }catch(e){}
  if(typeof google!=='undefined'&&google.accounts)initGoogle();
  else{const s=document.querySelector('script[src*="gsi"]');if(s)s.addEventListener('load',initGoogle);}
});

