// MAISON · settings.js — plain script, shares globals with the other files in js/ (load order is set in index.html).
// ── WALLPAPER ──
// Wallpaper pages: the home screen + area lists count as 'dashboard'; mood boards count as their area's main page.
function wpKey(s){
  if(s==='dashboard'||s.indexOf('area_')===0)return'dashboard';
  if(s==='moodboards')return mbArea==='house'?'home':mbArea==='closet'?'closet':'wedding';
  if(s==='event')return'dayout';
  return s;
}
function applyWallpaper(){
  const wp=userData('wallpaper',null);
  const pages=wp&&wp.pages||{};
  const active=wp&&wp.img&&(pages.all||pages[wpKey(currentSection)]);
  if(active){
    document.body.style.backgroundImage=`url(${wp.img})`;
    document.body.style.backgroundSize='cover';
    document.body.style.backgroundPosition='center';
    document.body.style.backgroundAttachment='fixed';
    document.getElementById('app').classList.add('has-wallpaper');
  }else{
    document.body.style.backgroundImage='';
    document.getElementById('app').classList.remove('has-wallpaper');
  }
}
function openWallpaperSettings(){
  const wp=userData('wallpaper',null);
  const pages=wp&&wp.pages||{};
  const sects=[['dashboard','Home screen'],['home','House planning'],['wedding','Wedding'],['honeymoon','Honeymoon'],['dayout','Days out'],['recipes','Recipes'],['music','Music'],['closet','Closet']];
  openModal(`<div class="modal-head"><div class="modal-title">Wallpaper</div><button class="modal-close" onclick="closeModal()">×</button></div>
    <div id="wp-preview-wrap" style="margin-bottom:14px">${wp&&wp.img?`<img id="wp-preview" src="${wp.img}" style="width:100%;height:130px;object-fit:cover;display:block;border:1px solid var(--bone)"/>`:`<div style="height:80px;border:1px dashed var(--warm);display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:13px">No wallpaper set</div>`}</div>
    <input type="file" id="wp-file" accept="image/*" style="display:none" onchange="previewWallpaper(this)"/>
    <div class="modal-row" style="margin-bottom:18px">
      <button id="wp-upload-btn" class="btn-ghost" onclick="document.getElementById('wp-file').click()">Upload photo</button>
      ${wp&&wp.img?`<button class="btn-ghost danger" onclick="removeWallpaper()">Remove</button>`:''}
    </div>
    <hr class="divider"/>
    <div class="field-label" style="margin-bottom:10px">Apply to</div>
    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:22px">
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-family:var(--sans);font-size:15px">
        <input type="checkbox" id="wp-all" ${pages.all?'checked':''} onchange="document.querySelectorAll('.wp-sect').forEach(c=>c.checked=this.checked)"/>
        All pages
      </label>
      <div style="width:1px;height:1px;border-top:1px solid var(--bone);margin:2px 0 2px 24px"></div>
      ${sects.map(([s,label])=>`<label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-family:var(--sans);font-size:14px;padding-left:20px;color:var(--muted)"><input type="checkbox" class="wp-sect" id="wp-${s}" ${pages.all||pages[s]?'checked':''}/>${label}</label>`).join('')}
    </div>
    <button class="btn-solid" onclick="saveWallpaper()">Save</button>`);
}
function previewWallpaper(input){
  const f=input.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=async ev=>{
    _wpTemp=await compressSingleImage(ev.target.result,1200,.7);   // it sits behind a cream wash, so it can be small
    const wrap=document.getElementById('wp-preview-wrap');
    if(wrap)wrap.innerHTML=`<img id="wp-preview" src="${_wpTemp}" style="width:100%;height:130px;object-fit:cover;display:block;border:1px solid var(--bone)"/>`;
    const btn=document.getElementById('wp-upload-btn');if(btn)btn.textContent='Change Photo';
  };
  r.readAsDataURL(f);
}
function saveWallpaper(){
  const existing=userData('wallpaper',null)||{};
  if(_wpTemp){existing.img=_wpTemp;_wpTemp=null;}
  const sects=['dashboard','home','wedding','honeymoon','dayout','recipes','music','closet'];
  const allChk=document.getElementById('wp-all');
  const pages={all:allChk?allChk.checked:false};
  sects.forEach(s=>{const el=document.getElementById('wp-'+s);pages[s]=el?el.checked:false;});
  existing.pages=pages;
  saveData('wallpaper',existing);
  closeModal();
  applyWallpaper();
}
function removeWallpaper(){
  _wpTemp=null;
  saveData('wallpaper',null);
  document.body.style.backgroundImage='';
  document.getElementById('app').classList.remove('has-wallpaper');
  closeModal();
  openSettings();
}

// ── FEEDBACK ──
function openFeedback(){
  openModal(`<div class="modal-head"><div class="modal-title">Send feedback</div><button class="modal-close" onclick="closeModal()">×</button></div>
    <label class="field-label">Your feedback</label>
    <textarea id="feedback-text" class="field-input" rows="5" placeholder="Suggestions, bugs, ideas…"></textarea>
    <div class="modal-row" style="margin-top:8px">
      ${currentUserEmail?`<button class="btn-solid sm" onclick="emailFeedback()">Email to myself</button>`:''}
      <button class="btn-ghost" onclick="copyFeedback()">Copy to clipboard</button>
    </div>
    <p style="font-size:12.5px;color:var(--muted);margin-top:12px;">${currentUserEmail?`Will open your email app addressed to ${currentUserEmail}.`:'Copies your feedback to the clipboard.'}</p>`);
}
function emailFeedback(){
  const text=document.getElementById('feedback-text').value.trim();if(!text)return;
  const subject=encodeURIComponent('MAISON App Feedback');
  const body=encodeURIComponent(`MAISON Feedback\n${'─'.repeat(30)}\n\n${text}\n\nSent from MAISON — ${new Date().toLocaleDateString('en-GB')}`);
  window.open(`mailto:${currentUserEmail}?subject=${subject}&body=${body}`);closeModal();
}
function copyFeedback(){
  const text=document.getElementById('feedback-text').value.trim();if(!text)return;
  const full=`MAISON Feedback\n${'─'.repeat(30)}\n\n${text}\n\nSent from MAISON — ${new Date().toLocaleDateString('en-GB')}`;
  navigator.clipboard.writeText(full).then(()=>{alert('Copied to clipboard!');closeModal();}).catch(()=>{const el=document.createElement('textarea');el.value=full;document.body.appendChild(el);el.select();document.execCommand('copy');document.body.removeChild(el);alert('Copied!');closeModal();});
}

// ── SETTINGS ──
// ── COLOUR SCHEME (same idea as Daybook: six ready-made schemes plus your own three colours) ──
// Every colour in the app comes from CSS variables, so a scheme just sets them (applyAppearance, run on every screen change). The ink/cream/bone
// "-rgb" variables feed the translucent tints. Non-default schemes use one accent colour everywhere; Maison keeps its gold / teal / plum mix.
const SCHEMES=[
  {id:'paper',name:'Paper',v:{cream:'#f7f3ee',bone:'#efe7da',ink:'#201810',muted:'#8b7d6b',warm:'#cdbfa8',line:'#e6dccb',gold:'#a85c32',teal:'#a85c32',plum:'#a85c32',red:'#a82020',green:'#2a5f3f'}},
  {id:'maison',name:'Maison',v:{cream:'#f7f3ed',bone:'#ede4d5',ink:'#1c140a',muted:'#8a7a68',warm:'#c9b89a',line:'#dccfba',gold:'#b8962e',teal:'#2a7070',plum:'#6b4a5e',red:'#a82020',green:'#2a5f3f'}},
  {id:'cream',name:'Cream',v:{cream:'#fbf5e6',bone:'#f1e8d0',ink:'#2b2417',muted:'#8c7f62',warm:'#d8c9a3',line:'#e8dcbd',gold:'#b08a2a',teal:'#b08a2a',plum:'#b08a2a',red:'#a82020',green:'#2a5f3f'}},
  {id:'grey',name:'Grey',v:{cream:'#e9e9e9',bone:'#dcdcdc',ink:'#1f1f1f',muted:'#707070',warm:'#bdbdbd',line:'#d2d2d2',gold:'#4a4a4a',teal:'#4a4a4a',plum:'#4a4a4a',red:'#a82020',green:'#2a5f3f'}},
  {id:'black',name:'Black',v:{cream:'#0a0a0a',bone:'#1a1a1a',ink:'#f2f2f2',muted:'#8f8f8f',warm:'#444444',line:'#2a2a2a',gold:'#e5e5e5',teal:'#e5e5e5',plum:'#e5e5e5',red:'#e0675f',green:'#6fbf8f'}},
  {id:'midnight',name:'Midnight',v:{cream:'#12141c',bone:'#1d2130',ink:'#e8e6df',muted:'#8a8fa3',warm:'#4a5066',line:'#2a2e3d',gold:'#d4a95a',teal:'#d4a95a',plum:'#d4a95a',red:'#e0675f',green:'#6fbf8f'}},
  {id:'sage',name:'Sage',v:{cream:'#eef1ea',bone:'#e0e7d8',ink:'#22301f',muted:'#74846c',warm:'#b4c2a8',line:'#d8e0d0',gold:'#4f7350',teal:'#4f7350',plum:'#4f7350',red:'#a82020',green:'#2a5f3f'}},
  {id:'blush',name:'Blush',v:{cream:'#f9f0ef',bone:'#f1e1df',ink:'#33201f',muted:'#a07f7c',warm:'#dfc3c0',line:'#eddcda',gold:'#b95d68',teal:'#b95d68',plum:'#b95d68',red:'#a82020',green:'#2a5f3f'}},
  {id:'ocean',name:'Ocean',v:{cream:'#edf2f4',bone:'#dde7ec',ink:'#16262e',muted:'#6c8593',warm:'#b3c8d2',line:'#d8e3e8',gold:'#2a6f8a',teal:'#2a6f8a',plum:'#2a6f8a',red:'#a82020',green:'#2a5f3f'}},
  {id:'plum',name:'Plum',v:{cream:'#f3eef5',bone:'#e8dfec',ink:'#291b2e',muted:'#8a7492',warm:'#c9b8d2',line:'#e3d7e8',gold:'#7c4a8d',teal:'#7c4a8d',plum:'#7c4a8d',red:'#a82020',green:'#2a5f3f'}}
];
function hexRgb(h){h=String(h||'').replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');const n=parseInt(h,16);return isNaN(n)?[0,0,0]:[(n>>16)&255,(n>>8)&255,n&255];}
function rgbHex(a){return'#'+a.map(x=>Math.round(Math.max(0,Math.min(255,x))).toString(16).padStart(2,'0')).join('');}
function mixHex(a,b,t){const x=hexRgb(a),y=hexRgb(b);return rgbHex(x.map((v,i)=>v*(1-t)+y[i]*t));}
// Paper is the default for anyone who has not chosen a scheme (people who picked Maison or anything else keep it).
function appearanceData(){return Object.assign({theme:'paper',custom:{bg:'#f7f3ed',ink:'#1c140a',accent:'#b8962e'}},userData('appearance',{}));}
function schemeVars(a){
  a=a||appearanceData();
  if(a.theme==='custom'){
    const c=a.custom||{},bg=c.bg||'#f7f3ed',ink=c.ink||'#1c140a',acc=c.accent||'#b8962e';
    return{cream:bg,bone:mixHex(bg,ink,.07),ink,muted:mixHex(bg,ink,.55),warm:mixHex(bg,ink,.28),line:mixHex(bg,ink,.14),gold:acc,teal:acc,plum:acc,red:'#a82020',green:'#2a5f3f'};
  }
  return(SCHEMES.find(s=>s.id===a.theme)||SCHEMES.find(s=>s.id==='paper')).v;
}
function applyAppearance(a){
  const v=schemeVars(a),r=document.documentElement.style;
  ['cream','bone','ink','muted','warm','line','gold','teal','plum','red','green'].forEach(k=>r.setProperty('--'+k,v[k]));
  {const c=hexRgb(v.cream);r.setProperty('--night',(c[0]*.3+c[1]*.59+c[2]*.11)<110?'#a9b6ff':'#3f4c84');}
  r.setProperty('--ink-rgb',hexRgb(v.ink).join(','));r.setProperty('--cream-rgb',hexRgb(v.cream).join(','));r.setProperty('--bone-rgb',hexRgb(v.bone).join(','));
  const m=document.querySelector('meta[name=theme-color]');if(m)m.content=v.cream;
}
function schemeBlockHTML(){
  const a=appearanceData(),c=a.custom||{},sv=schemeVars(a);
  // The pickers are always shown. They start from whatever scheme is on now, so tweaking a colour never jumps to something unrelated.
  const pv=a.theme==='custom'?{bg:c.bg,ink:c.ink,accent:c.accent}:{bg:sv.cream,ink:sv.ink,accent:sv.gold};
  return`<div class="theme-grid">${SCHEMES.map(t=>`<button class="theme-swatch${a.theme===t.id?' on':''}" onclick="setScheme('${t.id}')"><span class="ts-dots"><span style="background:${t.v.cream}"></span><span style="background:${t.v.ink}"></span><span style="background:${t.v.gold}"></span></span><span class="ts-name">${t.name}</span></button>`).join('')}
    <button class="theme-swatch${a.theme==='custom'?' on':''}" onclick="setScheme('custom')"><span class="ts-dots"><span style="background:${escHtml(c.bg)}"></span><span style="background:${escHtml(c.ink)}"></span><span style="background:${escHtml(c.accent)}"></span></span><span class="ts-name">Custom</span></button></div>
    <div class="field-label" style="margin:6px 0 8px">Or pick your own colours</div>
    <div class="custom-colors"><label class="cc-item"><input type="color" value="${escHtml(pv.bg)}" oninput="previewCustomScheme('bg',this.value)" onchange="setCustomScheme('bg',this.value)"/>Page</label><label class="cc-item"><input type="color" value="${escHtml(pv.ink)}" oninput="previewCustomScheme('ink',this.value)" onchange="setCustomScheme('ink',this.value)"/>Text</label><label class="cc-item"><input type="color" value="${escHtml(pv.accent)}" oninput="previewCustomScheme('accent',this.value)" onchange="setCustomScheme('accent',this.value)"/>Accent</label></div>`;
}
// Editing a colour switches to Custom, starting from the colours of the scheme that was on.
function customFromCurrent(a){
  if(a.theme!=='custom'){const v=schemeVars(a);a.custom={bg:v.cream,ink:v.ink,accent:v.gold};}
  a.theme='custom';a.custom=Object.assign({},a.custom);return a;
}
function refreshSchemeBlock(){const b=document.getElementById('scheme-block');if(b)b.innerHTML=schemeBlockHTML();}
function setScheme(id){const a=appearanceData();a.theme=id;saveData('appearance',a);applyAppearance();refreshSchemeBlock();}
function previewCustomScheme(k,val){const a=customFromCurrent(appearanceData());a.custom[k]=val;applyAppearance(a);}   // live, not saved until the colour is chosen
function setCustomScheme(k,val){const a=customFromCurrent(appearanceData());a.custom[k]=val;saveData('appearance',a);applyAppearance();refreshSchemeBlock();}

function openSettings(){
  openModal(`<div class="modal-head"><div class="modal-title">Settings</div><button class="modal-close" onclick="closeModal()">×</button></div>
    <div style="margin-bottom:20px">
      <div class="field-label" style="margin-bottom:8px">Account</div>
      <div style="font-size:15px;margin-bottom:4px">${currentUserName}</div>
      ${currentUserEmail?`<div style="font-size:12px;color:var(--muted);margin-bottom:16px;">${currentUserEmail}</div>`:''}
      <button class="btn-ghost" onclick="signOut()">Sign out</button>
    </div>
    <hr class="divider"/>
    <div style="margin-bottom:20px">
      <div class="field-label" style="margin-bottom:10px">Colour scheme</div>
      <div id="scheme-block">${schemeBlockHTML()}</div>
    </div>
    <hr class="divider"/>
    <div style="margin-bottom:20px">
      <div class="field-label" style="margin-bottom:8px">Wallpaper</div>
      <p style="font-size:13px;color:var(--muted);margin-bottom:12px">${(()=>{const wp=userData('wallpaper',null);return wp&&wp.img?'Custom wallpaper set.':'Upload a photo as your background.';})()}</p>
      <button class="btn-ghost" onclick="closeModal();openWallpaperSettings()">Customise wallpaper</button>
    </div>
    <hr class="divider"/>
    <div style="margin-bottom:20px">
      <div class="field-label" style="margin-bottom:8px">Feedback</div>
      <p style="font-size:13px;color:var(--muted);margin-bottom:12px">Share ideas, report bugs, or suggest features.</p>
      <button class="btn-ghost" onclick="closeModal();openFeedback()">Send feedback</button>
    </div>
    <hr class="divider"/>
    <div style="margin-bottom:20px">
      <div class="field-label" style="margin-bottom:8px">Cloud sync</div>
      ${(()=>{
        const err=lastSyncError||sessionStorage.getItem('maison_drive_err');
        const errHtml=err?`<p style="font-size:12px;color:var(--red);margin-top:10px">${err==='access_denied'?'Google blocked access — in Google Cloud Console open OAuth consent screen, then either add your email as a Test User or publish the app.':err}</p>`:'';
        if(driveAccessToken)return`<p style="font-size:13px;color:var(--green);margin-bottom:12px">✓ Sync is on${lastSyncAt?` — last synced ${timeAgo(lastSyncAt)}`:''}</p><div class="modal-row"><button class="btn-ghost" onclick="driveSyncNow(true)">Sync now</button><button class="btn-ghost danger" onclick="disableDriveSync()">Turn off</button></div>${errHtml}`;
        if(localStorage.getItem(`maison_drive_on_${currentUser}`))return`<p style="font-size:13px;color:var(--muted);margin-bottom:12px">Sync needs to reconnect to Google.</p><button class="btn-ghost" onclick="enableDriveSync()">Reconnect sync</button>${errHtml}`;
        return`<p style="font-size:13px;color:var(--muted);margin-bottom:12px">Back up and sync your data across devices via Google Drive.</p><button class="btn-ghost" onclick="enableDriveSync()">Enable cross-device sync</button>${errHtml}`;
      })()}
    </div>
    <hr class="divider"/>
    <div style="margin-bottom:20px">
      <div class="field-label" style="margin-bottom:8px">Google Drive backup</div>
      ${(()=>{
        const gd=userData('gdrive_backup',{});
        const bkConnected=hasBkToken();
        const bkErr=sessionStorage.getItem('maison_bkdrive_err')||lastBkBackupError;
        if(!bkConnected)return`<p style="font-size:13px;color:var(--muted);margin-bottom:12px">Keep a visible backup file in a Google Drive folder you choose — separate from the automatic sync above. Connecting asks for a broader Google Drive permission, so you may see an "unverified app" notice; that's expected for this project and safe to continue through.${gd.folderId?`<br/>Was backing up to <b>${escHtml(gd.folderName||'Google Drive')}</b> — reconnect to resume.`:''}${bkErr?`<br/><span style="color:var(--red)">${escHtml(bkErr)}</span>`:''}</p><div class="modal-row"><button class="btn-ghost" onclick="bkDriveAuthRedirect(true)">${gd.folderId?'Reconnect':'Connect'} Google Drive Backup</button>${gd.folderId?`<button class="btn-ghost danger" onclick="bkDisconnect()">Disconnect</button>`:''}</div>`;
        if(!gd.folderId)return`<p style="font-size:13px;color:var(--muted);margin-bottom:12px">Connected. Choose a folder in your Google Drive to back up into.</p><div class="modal-row"><button class="btn-ghost" onclick="openBkFolderPicker()">Choose folder</button><button class="btn-ghost danger" onclick="bkDisconnect()">Disconnect</button></div>`;
        return`<p style="font-size:13px;color:${gd.enabled?'var(--green)':'var(--muted)'};margin-bottom:12px">Backing up to <b>${escHtml(gd.folderName||'Google Drive')}</b> ${gd.enabled?'— on ✓':'— paused'}${lastBkBackupAt?`<br/>Last backed up ${timeAgo(lastBkBackupAt)}`:''}${lastBkBackupError?`<br/><span style="color:var(--red)">${escHtml(lastBkBackupError)}</span>`:''}</p>
          <div class="modal-row">
            <button class="btn-ghost" onclick="bkBackupNow(true)">Back up now</button>
            <button class="btn-ghost" onclick="toggleBkBackup()">${gd.enabled?'Pause':'Resume'}</button>
            <button class="btn-ghost" onclick="openBkFolderPicker()">Change folder</button>
            <button class="btn-ghost danger" onclick="bkDisconnect()">Disconnect</button>
          </div>`;
      })()}
    </div>
    <hr class="divider"/>
    <div>
      <div class="field-label" style="margin-bottom:8px">Storage</div>
      <div id="storage-info" class="cl-hint" style="margin-top:0">Checking…</div>
      <button class="btn-ghost danger" onclick="clearData()">Clear all my data</button>
    </div>`);
  updateStorageInfo();
}
// How full is the browser's ~5MB app-data limit? (Photos' full-size copies live elsewhere and are far roomier.)
const LS_BUDGET=5000000;
function localDataChars(){let n=0;for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.indexOf('maison_')===0)n+=k.length+(localStorage.getItem(k)||'').length;}return n;}
async function updateStorageInfo(){
  const el=document.getElementById('storage-info');if(!el)return;
  const used=localDataChars(),pct=Math.min(100,Math.round(used/LS_BUDGET*100));
  const mb=n=>(n/1048576).toFixed(n<10485760?1:0)+' MB';
  let full='';
  try{if(navigator.storage&&navigator.storage.estimate){const e=await navigator.storage.estimate();if(e&&e.usage)full=`<div class="of-meta" style="margin-top:4px">Total on this device incl. full-size photos: ${mb(e.usage)}</div>`;}}catch(e){}
  if(!document.getElementById('storage-info'))return;
  el.innerHTML=`<div class="st-bar-track" style="margin:2px 0 6px"><div class="st-bar-fill ${pct>85?'red':pct>65?'gold':'green'}" style="width:${Math.max(2,pct)}%"></div></div>
    <div class="of-meta">${mb(used)} of about ${mb(LS_BUDGET)} used (${pct}%)</div>
    ${pct>85?`<div style="color:var(--red);font-size:12px;margin-top:4px">Nearly full — delete photos you no longer need so new ones keep saving.</div>`:''}${full}`;
}
function signOut(){mpStop();evStopPoll();activeEventId=null;evDay=null;fbMem=null;localStorage.removeItem('maison_sess');localStorage.removeItem('maison_drive_tok');localStorage.removeItem('maison_bkdrive_tok');currentUser=null;capturedDataURL=null;activeRoomId=null;driveAccessToken=null;driveFileId=null;if(driveSyncTimer){clearTimeout(driveSyncTimer);driveSyncTimer=null;}if(bkBackupTimer){clearTimeout(bkBackupTimer);bkBackupTimer=null;}document.getElementById('app').classList.remove('visible');document.getElementById('auth-screen').style.display='flex';google.accounts.id.disableAutoSelect();closeModal();}
function clearData(){
  if(!confirm('Permanently delete all your data?'))return;
  mpStop();
  const photoIds=referencedPhotoIds();
  photoIds.forEach(id=>{idbDeletePhoto(id).catch(()=>{});deleteRemotePhoto(id).catch(()=>{});});
  Object.keys(localStorage).filter(k=>k.startsWith(`maison_${currentUser}_`)).forEach(k=>localStorage.removeItem(k));
  localStorage.removeItem('maison_evq_'+currentUser);
  if(driveAccessToken&&driveFileId){fetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}`,{method:'DELETE',headers:{Authorization:'Bearer '+driveAccessToken}});driveFileId=null;}
  closeModal();alert('Data cleared.');showSection('dashboard');
}
