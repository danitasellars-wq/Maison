// MAISON · events-map.js — plain script, shares globals with the other files in js/ (load order is set in index.html).
// ── weather (events only) ──
// Free forecast from Open-Meteo (no key). Shown for an event from 14 days before its first day until its last day ends, then it switches itself off.
// The "Where" on the event is looked up to a place; the result is cached on this device (not synced) for 3 hours.
const WX_CODES={0:'Clear',1:'Mostly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',56:'Freezing drizzle',57:'Freezing drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',66:'Freezing rain',67:'Freezing rain',71:'Light snow',73:'Snow',75:'Heavy snow',77:'Snow grains',80:'Light showers',81:'Showers',82:'Heavy showers',85:'Snow showers',86:'Heavy snow showers',95:'Thunderstorm',96:'Thunderstorm',99:'Thunderstorm'};
const wxBusy={};
function wxKey(id){return'maison_wx_'+id;}
function evAddDays(k,n){const d=evDateObj(k);d.setDate(d.getDate()+n);return clKey(d);}
// 'early' = not open yet, 'on' = showing, 'over' = event finished (forecast off)
function wxWindow(ev,today){
  const d=evDaysSorted(ev);if(!d.length)return'over';
  today=today||clKey(new Date());
  if(today>d[d.length-1])return'over';
  if(today<evAddDays(d[0],-14))return'early';
  return'on';
}
async function wxEnsure(ev,force){
  if(wxWindow(ev)!=='on'||!ev.location||wxBusy[ev.id])return;
  const c=getStore(wxKey(ev.id),null);
  // Days of the event that have already passed are included too, so each day keeps its weather until the whole event is over.
  const first=evDaysSorted(ev)[0],past=Math.max(0,Math.min(60,Math.round((evDateObj(clKey(new Date()))-evDateObj(first))/864e5)));
  if(!force&&c&&c.loc===ev.location&&!c.fail&&(c.past||0)>=past&&Date.now()-c.at<3*3600*1000)return;
  wxBusy[ev.id]=true;
  try{
    let geo=c&&c.loc===ev.location&&c.lat!=null?{lat:c.lat,lon:c.lon,label:c.label}:null;
    if(!geo){
      const g=await(await fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&name='+encodeURIComponent(ev.location))).json();
      const x=(g.results||[])[0];
      if(!x){setStore(wxKey(ev.id),{at:Date.now(),loc:ev.location,fail:'place'});wxRefresh(ev.id);return;}
      geo={lat:x.latitude,lon:x.longitude,label:[x.name,x.admin1,x.country].filter(Boolean).join(', ')};
    }
    const w=await(await fetch('https://api.open-meteo.com/v1/forecast?latitude='+geo.lat+'&longitude='+geo.lon+'&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&hourly=temperature_2m,precipitation_probability,weather_code&timezone=auto&forecast_days=16&past_days='+past+'&wind_speed_unit=mph')).json();
    if(!w||!w.daily||!w.hourly)throw new Error('no forecast');
    setStore(wxKey(ev.id),{at:Date.now(),loc:ev.location,lat:geo.lat,lon:geo.lon,label:geo.label,past,days:wxParse(w)});
    wxRefresh(ev.id);
  }catch(e){/* offline or the service is down: keep whatever was cached */}
  finally{wxBusy[ev.id]=false;}
}
function wxParse(w){
  const D=w.daily,H=w.hourly,days={};
  D.time.forEach((day,i)=>{days[day]={code:D.weather_code[i],hi:Math.round(D.temperature_2m_max[i]),lo:Math.round(D.temperature_2m_min[i]),rain:D.precipitation_probability_max[i]||0,wind:Math.round(D.wind_speed_10m_max[i])};});
  const acc={};
  H.time.forEach((t,i)=>{
    const day=t.slice(0,10),h=parseInt(t.slice(11,13),10),part=h>=9&&h<=17?'day':h>=18&&h<=23?'eve':null;
    if(!part||!days[day])return;
    const a=acc[day+part]=acc[day+part]||{t:[],r:[],c:[]};
    a.t.push(H.temperature_2m[i]);a.r.push(H.precipitation_probability[i]||0);a.c.push(H.weather_code[i]);
  });
  Object.keys(days).forEach(day=>['day','eve'].forEach(part=>{
    const a=acc[day+part];if(!a||!a.t.length)return;
    days[day][part]={temp:Math.round(a.t.reduce((s,x)=>s+x,0)/a.t.length),rain:Math.max.apply(null,a.r),code:a.c[Math.floor(a.c.length/2)]};
  }));
  return days;
}
function wxRefresh(id){if(currentSection==='event'&&activeEventId===id)evSoftRefresh();}
// ── map, day colours, headings view ──
// Each day gets a colour (used on the map pins, the route lines and the day rows) so the plan reads at a glance. Pins come from activities that have
// a location AND "Show on the map" ticked: the location is looked up once, when the activity is saved (a pasted Google Maps link is read directly).
// The map is Leaflet on free OpenStreetMap-based tiles (no key); a pin shows the first photo of its activity when there is one.
const EV_COLORS=['#e4572e','#2e86de','#e5a100','#2fa66b','#8e5bd8','#17a2b8','#d6457f','#5c6b7a'];
function evDayColor(ev,day){const i=evDaysSorted(ev).indexOf(day);return EV_COLORS[(i<0?0:i)%EV_COLORS.length];}
function evActFirstPhoto(ev,a){return(ev.photos||[]).filter(p=>p.act===a.id).sort((x,y)=>(x.upd||0)-(y.upd||0))[0]||null;}
function evPins(ev,onlyDay){
  const out=[];
  evDaysSorted(ev).forEach(day=>{
    if(onlyDay&&day!==onlyDay)return;
    doSorted(evActsVis(ev).filter(a=>a.day===day&&a.lat!=null&&a.lon!=null)).forEach((a,i)=>out.push({a,n:i+1,day,color:evDayColor(ev,day),photo:evCan(ev,'photos')?evActFirstPhoto(ev,a):null}));
  });
  return out;
}
function evMapsUrl(a){
  if((a.cat==='Journey'||a.cat==='Travel')&&(a.from||a.to)){
    const pt=(t,la,lo)=>t||(la!=null?la+','+lo:'');
    return'https://www.google.com/maps/dir/?api=1&origin='+encodeURIComponent(pt(a.from,a.lat,a.lon))+'&destination='+encodeURIComponent(pt(a.to,a.lat2,a.lon2));
  }
  return a.mapUrl||('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(a.where||(a.lat!=null?a.lat+','+a.lon:a.name)));
}
// What a pasted Google Maps link can tell us without a server. A full link usually carries coordinates (@lat,lon, !3d..!4d.., ?q=lat,lon) and/or a place name
// (/place/Name, /search/Name, ?q=Name). Short links (maps.app.goo.gl, goo.gl/maps) hide everything behind a redirect the browser is not allowed to follow.
function evMapsLink(u){
  // The place's own pin is !3d<lat>!4d<lon> (the last one is the destination on a directions link). The @lat,lon in a link is only where the map was
  // centred when the link was copied, which can be well away from the place, so it is the last resort and never used on directions links.
  const pins=[];u.replace(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/g,(s,a,b)=>{pins.push([a,b]);return s;});
  let m=pins.length?[0].concat(pins[pins.length-1]):null;
  m=m||/[?&](?:q|ll|query|destination|daddr)=(?:loc:)?(-?\d+\.\d+)(?:,|%2C|\+)(-?\d+\.\d+)/i.exec(u)||/\/maps\/(?:place|search)\/(-?\d+\.\d+),\+?(-?\d+\.\d+)/.exec(u);
  if(!m&&!/\/maps\/dir\//.test(u))m=/@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(u);
  const exact=!!pins.length||/[?&](?:q|ll|query)=(?:loc:)?-?\d/.test(u);
  let name='';
  const dec=s=>{try{return decodeURIComponent(s.replace(/\+/g,' ')).trim();}catch(e){return s.replace(/\+/g,' ').trim();}};
  const n=/\/maps\/(?:place|search)\/([^/@?]+)/.exec(u)||/[?&](?:q|query|destination|daddr)=([^&]+)/i.exec(u);
  if(n){name=dec(n[1]);if(/^(-?\d+\.\d+)[, ]+(-?\d+\.\d+)$/.test(name))name='';}
  const short=/(?:maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs|share\.google)/i.test(u);
  return{lat:m?parseFloat(m[1]):null,lon:m?parseFloat(m[2]):null,name,short,exact};
}
function evCoordsFromMapsUrl(u){const r=evMapsLink(u);return r.lat==null?null:{lat:r.lat,lon:r.lon,name:r.name,mapUrl:u,fromUrl:true};}
// OpenStreetMap's free search. `box` ([lon1,lat1,lon2,lat2]) limits the answer to an area, so "Cafe Rosa" means the one near the event.
async function evNominatim(q,box){
  try{
    const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),6000);
    const r=await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q='+encodeURIComponent(q)+(box?'&viewbox='+box.join(',')+'&bounded=1':''),{signal:ctl.signal,headers:{Accept:'application/json'}});
    clearTimeout(t);
    const j=await r.json();if(j&&j[0])return{lat:parseFloat(j[0].lat),lon:parseFloat(j[0].lon)};
  }catch(e){}
  return null;
}
const evCentres={};
// Where the event is (its "Where" text), cached for the session, so place searches can be kept to that area.
async function evCentre(near){
  if(!near)return null;
  if(!(near in evCentres))evCentres[near]=await evNominatim(near);
  return evCentres[near];
}
function evKm(a,b){const R=6371,rad=x=>x*Math.PI/180,dl=rad(b.lat-a.lat),dn=rad(b.lon-a.lon),s=Math.sin(dl/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dn/2)**2;return 2*R*Math.asin(Math.sqrt(s));}
// Best guess at where a piece of text is. Order: inside the event's area (about 60 miles around its Where) with and without the Where added; a UK
// postcode on its own (accurate to the street); then anywhere, but a result more than ~300 km from the event is thrown away rather than pinned wrongly.
async function evFindText(q,near){
  const c=await evCentre(near),box=c?[c.lon-1,c.lat+.7,c.lon+1,c.lat-.7]:null;
  const tries=[];
  if(box){tries.push([q,box]);if(near&&q.toLowerCase().indexOf(near.toLowerCase())<0)tries.push([q+', '+near,box]);}
  const pc=/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i.exec(q);
  if(pc)tries.push([pc[1].toUpperCase(),null]);
  if(!box){if(near&&q.toLowerCase().indexOf(near.toLowerCase())<0)tries.push([q+', '+near,null]);tries.push([q,null]);}
  else tries.push([q,null]);
  for(const [s,b] of tries){
    const g=await evNominatim(s,b);
    if(g&&(!c||evKm(c,g)<300))return g;
  }
  return null;
}
// Looks a place up. Accepts a plain place name, a Google Maps link, or what Google Maps' Share button gives you (the place's name and address followed
// by a link). A link with the place's own coordinates is exact; anything found by name is a best guess (`guess:true`).
async function evGeocode(text,near){
  const raw=(text||'').trim();if(!raw)return null;
  const um=/https?:\/\/\S+/i.exec(raw),url=um?um[0]:'';
  const rest=raw.replace(/https?:\/\/\S+/ig,' ').split(/\r?\n|\s{2,}/).map(s=>s.trim()).filter(Boolean);
  if(url){
    const info=evMapsLink(url),first=rest[0]||'',all=rest.join(', ');
    const name=first||info.name;
    if(info.lat!=null)return{lat:info.lat,lon:info.lon,name,mapUrl:url,fromUrl:true,guess:!info.exact};
    const tries=[];
    if(all)tries.push(all);
    if(info.name&&tries.indexOf(info.name)<0)tries.push(info.name);
    if(first&&tries.indexOf(first)<0)tries.push(first);
    for(const q of tries){const g=await evFindText(q,near);if(g)return{lat:g.lat,lon:g.lon,name,mapUrl:url,fromUrl:true,guess:true};}
    return{lat:null,lon:null,name,mapUrl:url,fromUrl:true,failed:true,short:info.short&&!tries.length};
  }
  const g=await evFindText(raw,near);
  return g?{lat:g.lat,lon:g.lon,guess:true}:null;
}let evLeafletP=null,evMapObj=null;
function loadLeaflet(){
  if(window.L&&L.map)return Promise.resolve();
  if(evLeafletP)return evLeafletP;
  const css=new Promise((res,rej)=>{const l=document.createElement('link');l.rel='stylesheet';l.href='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';l.onload=()=>res();l.onerror=()=>rej(new Error('css'));document.head.appendChild(l);});
  const js=new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';s.onload=()=>res();s.onerror=()=>rej(new Error('js'));document.head.appendChild(s);});
  evLeafletP=Promise.all([css,js]).then(()=>{},e=>{evLeafletP=null;throw e;});
  return evLeafletP;
}
// A day can be shown on real Google Maps (always right, because Google finds each place from its name) or as pins on our own map (shows photos and
// colours, but a pin found by name can be a little off, and is marked "approximate"). The choice is remembered on this device.
function evMapMode(){try{return localStorage.getItem('maison_evmapmode')==='pins'?'pins':'google';}catch(e){return'google';}}
function evSetMapMode(m){try{localStorage.setItem('maison_evmapmode',m);}catch(e){}showSection('event');}
function evStopText(s,near){
  s=(s||'').trim();if(!s||/^https?:\/\//i.test(s))return'';
  return near&&s.length<40&&s.toLowerCase().indexOf(near.toLowerCase())<0?s+', '+near:s;
}
// The day's places in time order, as text Google can find. A journey adds where it starts and where it ends.
function evDayStops(ev,day){
  const out=[],add=s=>{const x=evStopText(s,ev.location);if(x&&out[out.length-1]!==x)out.push(x);};
  doSorted(evActsVis(ev).filter(a=>a.day===day&&a.pin!==false)).forEach(a=>{
    if(a.cat==='Journey'||a.cat==='Travel'){add(a.from);add(a.to);}else add(a.where);
  });
  return out.slice(0,9);
}
function evGoogleDayURL(stops){
  if(stops.length===1)return'https://www.google.com/maps?q='+encodeURIComponent(stops[0])+'&output=embed';
  return'https://www.google.com/maps?output=embed&saddr='+encodeURIComponent(stops[0])+'&daddr='+stops.slice(1).map(encodeURIComponent).join('+to:');
}
function evMapHTML(ev,onlyDay){
  if(!evCan(ev,'schedule'))return'';
  const pins=evPins(ev,onlyDay),stops=onlyDay?evDayStops(ev,onlyDay):[];
  if(!pins.length&&!stops.length)return'';
  const google=stops.length&&(!pins.length||evMapMode()==='google');
  const toggle=stops.length&&pins.length?`<div class="ev-seg-row" style="margin-bottom:8px"><div class="ev-seg" role="group" aria-label="Map type"><button class="${google?'on':''}" onclick="evSetMapMode('google')">Google Maps</button><button class="${google?'':'on'}" onclick="evSetMapMode('pins')">Pins</button></div></div>`:'';
  if(google)return`<div class="ev-map-wrap">${toggle}<div class="ev-map small ev-gmap"><iframe src="${escHtml(evGoogleDayURL(stops))}" title="Google Maps for this day" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></div></div>`;
  const days=Array.from(new Set(pins.map(p=>p.day)));
  const legend=!onlyDay&&days.length>1?`<div class="ev-map-legend">${days.map(d=>`<span><i style="background:${evDayColor(ev,d)}"></i>Day ${evDaysSorted(ev).indexOf(d)+1}</span>`).join('')}</div>`:'';
  const guess=pins.some(p=>p.a.guess)?`<div class="ev-map-note">Pins found by name are approximate. Switch to Google Maps for the exact place.</div>`:'';
  return`<div class="ev-map-wrap">${toggle}<div id="ev-map" class="ev-map${onlyDay?' small':''}" role="img" aria-label="Map of the planned places"></div>${legend}${guess}</div>`;
}function evMapDestroy(){if(evMapObj){try{evMapObj.remove();}catch(e){}evMapObj=null;}}
async function evMapInit(){
  evMapDestroy();
  const el=document.getElementById('ev-map');if(!el)return;
  const ev=evFind(evData(),activeEventId);if(!ev)return;
  const pins=evPins(ev,evDay);if(!pins.length)return;
  try{await loadLeaflet();}catch(e){el.innerHTML='<div class="ev-map-off">The map could not load. Check your connection.</div>';return;}
  if(document.getElementById('ev-map')!==el)return;   // the screen changed while the map library was loading
  const dark=(()=>{const c=hexRgb(schemeVars().cream);return(c[0]*.3+c[1]*.59+c[2]*.11)<110;})();
  const map=L.map(el,{zoomControl:false,scrollWheelZoom:false}).setView([pins[0].a.lat,pins[0].a.lon],13);
  L.control.zoom({position:'bottomright'}).addTo(map);
  // OpenStreetMap's own free tiles (fine for light, personal use; CARTO's now need a key). Dark schemes darken them with a CSS filter.
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,className:dark?'evm-tiles-dark':'evm-tiles',attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'}).addTo(map);
  const byDay={};pins.forEach(p=>{(byDay[p.day]=byDay[p.day]||[]).push(p);});
  Object.keys(byDay).forEach(day=>{const pts=byDay[day].map(p=>[p.a.lat,p.a.lon]);if(pts.length>1)L.polyline(pts,{color:byDay[day][0].color,weight:3,opacity:.75,dashArray:'7 7'}).addTo(map);});
  const all=[];
  pins.forEach(p=>{
    const html=p.photo?`<div class="evm evm-ph" style="--c:${p.color}"><img data-evph="${p.photo.id}" alt=""/><b>${p.n}</b></div>`:`<div class="evm" style="--c:${p.color}"><b>${p.n}</b></div>`;
    const m=L.marker([p.a.lat,p.a.lon],{zIndexOffset:p.photo?500:0,icon:L.divIcon({html,className:'evm-wrap',iconSize:[46,46],iconAnchor:[23,23],popupAnchor:[0,-22]})}).addTo(map);
    // Tap a pin: its photo and title; tap the title to open the real Google Maps there.
    const isJ=p.a.cat==='Journey'||p.a.cat==='Travel';
    m.bindPopup(`<div class="evpop">${p.photo?`<img class="evpop-img" data-evph="${p.photo.id}" alt=""/>`:''}<a class="evpop-title" href="${escHtml(evMapsUrl(p.a))}" target="_blank" rel="noopener">${escHtml(p.a.name)}</a><div class="evpop-sub">${escHtml(evShort(p.day))}${p.a.time?' · '+escHtml(p.a.time):''}${isJ&&p.a.arr?' to '+escHtml(p.a.arr):''}</div><a class="evpop-open" href="${escHtml(evMapsUrl(p.a))}" target="_blank" rel="noopener">${isJ?'Open the route in Google Maps':'Open in Google Maps'}</a></div>`,{minWidth:170});
    all.push([p.a.lat,p.a.lon]);
    if(isJ&&p.a.lat2!=null){   // a journey: a solid line to where it ends, with a small dot there
      L.polyline([[p.a.lat,p.a.lon],[p.a.lat2,p.a.lon2]],{color:p.color,weight:4,opacity:.9}).addTo(map);
      L.circleMarker([p.a.lat2,p.a.lon2],{radius:6,color:'#fff',weight:2,fillColor:p.color,fillOpacity:1}).addTo(map);
      all.push([p.a.lat2,p.a.lon2]);
    }
  });
  map.on('popupopen',e=>evHydratePhotos(e.popup.getElement()));
  if(all.length>1)map.fitBounds(all,{padding:[44,44],maxZoom:15});else map.setView(all[0],14);
  evMapObj=map;evHydratePhotos(el);
  setTimeout(()=>{if(evMapObj===map)map.invalidateSize();},200);
}

// Calendar / Headings switch (remembered on this device). Headings = one row per day, like the day list in a trip planner: coloured day tag,
// the day's title, how many things are planned, the weather symbol and a few photos.
function evViewMode(){try{return localStorage.getItem('maison_evview')==='days'?'days':'cal';}catch(e){return'cal';}}
function evSetView(m){try{localStorage.setItem('maison_evview',m);}catch(e){}showSection('event');}
function evDayThumbIds(ev,day){
  const ids=[];
  doSorted(evActsVis(ev).filter(a=>a.day===day)).forEach(a=>{const p=evActFirstPhoto(ev,a);if(p)ids.push(p.id);});
  (ev.photos||[]).filter(p=>p.day===day&&!p.act&&!p.sug).sort((a,b)=>(a.upd||0)-(b.upd||0)).forEach(p=>ids.push(p.id));
  return ids.slice(0,4);
}
function evDaysViewHTML(ev){
  const days=evDaysSorted(ev),today=clKey(new Date());
  return`<div class="evd-list">${days.map((k,i)=>{
    const info=evDayInfo(ev,k),blank=evDayBlank(ev,k),n=evActsVis(ev).filter(a=>a.day===k).length;
    const ph=evCan(ev,'photos')&&!blank?evDayThumbIds(ev,k):[],wx=evCan(ev,'weather')&&!blank?wxMiniIcon(ev,k):'';
    return`<button class="evd-row${k===today?' today':''}" onclick="evOpenDay('${k}')"><span class="evd-tag">Day ${i+1}</span><span class="evd-main"><span class="evd-title">${escHtml(info.title||evShort(k))}</span><span class="evd-sub">${ev.creator&&info.hideGuests?'Hidden from guests · ':''}${info.title?escHtml(evShort(k))+(evCan(ev,'schedule')?' · ':''):''}${evCan(ev,'schedule')&&!blank?n+(n===1?' thing':' things'):''}</span></span>${wx}${ph.length?`<span class="evd-ph">${ph.map(id=>`<img data-evph="${id}" alt=""/>`).join('')}</span>`:''}</button>`;
  }).join('')}</div>`;
}
// One quiet line instead of a row of stat boxes.
function evSummaryHTML(ev){
  const bits=[],vis=evActsVis(ev),n=vis.length,ppl=(ev.people||[]).length,total=vis.reduce((s,a)=>s+(a.price||0),0);
  if(evCan(ev,'schedule'))bits.push(n+(n===1?' activity':' activities'));
  if(evCan(ev,'people'))bits.push(ppl+(ppl===1?' person':' people'));
  if(evCan(ev,'schedule')&&evCan(ev,'costs')&&total)bits.push(evMoney(total)+(ppl>1?' ('+evMoney(total/Math.max(1,ppl))+' each)':''));
  return bits.length?`<p class="ev-sum">${bits.join(' · ')}</p>`:'';
}
// Overnight host: its own coloured section at the bottom of the day.
// ── overnight: hosts, and which guests stay with which host ──
// Each host for a night is its own record `o_<id>` = {id,day,name,place,guests:[personIds],upd}, so two people editing different hosts never overwrite
// each other. A night-time host typed in before this existed (dinfo.nightHost) still shows, as a host with no guests, and becomes a real record the
// first time you touch it. Hosts you use often can be saved (yours, across events).
function evStaysFor(ev,day){
  const real=(ev.stays||[]).filter(s=>s.day===day),legacy=(evDayInfo(ev,day).nightHost||'').trim(),out=real.slice();
  if(legacy&&!real.some(s=>(s.name||'').toLowerCase()===legacy.toLowerCase()))out.push({id:'legacy',day,name:legacy,place:'',guests:[],legacy:true,upd:0});
  return out.sort((a,b)=>(a.upd||0)-(b.upd||0));
}
// Turns the old single night-time host into a real host record (returns its id).
function evStayRealize(ev,put,sid,day){
  if(sid!=='legacy')return sid;
  const name=(evDayInfo(ev,day).nightHost||'').trim(),id=uid();
  put('o_'+id,{id,day,name,place:'',guests:[],upd:Date.now()});
  const cur=(ev.dinfo||{})[day]||{};put('d_'+day.replace(/-/g,''),Object.assign({},cur,{day,nightHost:'',upd:Date.now()}));
  return id;
}
function evNightHTML(ev){
  if(!evCan(ev,'schedule'))return'';
  const day=evDay,stays=evStaysFor(ev,day),going=evGoing(ev,day),goingIds=new Set(going.map(p=>p.id));
  const assigned=new Set();stays.forEach(s=>(s.guests||[]).forEach(g=>assigned.add(g)));
  const left=going.filter(p=>!assigned.has(p.id)&&!stays.some(s=>(s.name||'').toLowerCase()===(p.name||'').toLowerCase()));
  const nm=id=>{const p=(ev.people||[]).find(x=>x.id===id);return p?p.name:'';};
  const card=s=>`<div class="ev-host"><div class="ev-host-head"><div class="ev-host-name">${escHtml(s.name)}</div><span class="ev-host-tools"><button class="ev-addph" onclick="evStayGuestModal('${s.id}')">+ Guest</button><button class="icon-btn" title="Remove host" aria-label="Remove host ${escHtml(s.name)}" onclick="evStayDelete('${s.id}')">×</button></span></div>${s.place?`<div class="of-meta">${escHtml(s.place)}</div>`:''}
    <div class="ev-people">${(s.guests||[]).filter(g=>goingIds.has(g)).map(g=>`<span class="ev-person"><i>${escHtml(evInitials(nm(g)))}</i>${escHtml(nm(g))}<button class="ev-x" aria-label="Remove ${escHtml(nm(g))}" onclick="evStayGuestRemove('${s.id}','${g}')">×</button></span>`).join('')||'<span class="of-meta">No guests yet</span>'}</div></div>`;
  return`<div class="ev-sec ev-night"><div class="ev-sec-head"><div class="ev-sec-title">Overnight</div><button class="btn-ghost" onclick="evStayModal()">+ Host</button></div>
    ${stays.map(card).join('')}${stays.length&&left.length?`<div class="of-meta ev-unassigned">Not placed yet: ${left.map(p=>escHtml(p.name)).join(', ')}</div>`:''}</div>`;
}
function evStayModal(){
  const ev=evFind(evData(),activeEventId);if(!ev)return;
  const hosts=userData('hosts',[]);
  evForm={picked:{}};
  openModal(`<div class="modal-head"><div class="modal-title">Add a host</div><button class="modal-close" onclick="closeModal()">×</button></div>
    <p class="cl-hint" style="margin-top:0">${escHtml(evLong(evDay))}</p>
    <label class="field-label">Host</label><input id="es-hname" class="field-input" list="es-hnames" placeholder="Who is hosting?" autocomplete="off"/>
    <datalist id="es-hnames">${(ev.people||[]).map(p=>`<option value="${escHtml(p.name)}"></option>`).join('')}</datalist>
    ${hosts.length?`<div class="ev-placerow" style="margin-top:-8px"><select class="ev-placesel" onchange="evHostPick(this.value)"><option value="">Saved hosts…</option>${hosts.map(h=>`<option value="${h.id}">${escHtml(h.name)}${h.place?' · '+escHtml(h.place):''}</option>`).join('')}</select></div>`:''}
    ${evPlaceField('es-hplace','Where they are staying (optional)','', 'e.g. Greg and Glynis House')}
    <label class="ev-switch" style="margin:2px 0 12px"><input type="checkbox" id="es-hsave"/><span>Save this host for next time</span></label>
    <div class="modal-row"><button class="btn-solid sm teal" onclick="evStayAdd()">Add host</button><button class="btn-ghost" onclick="closeModal()">Cancel</button></div>`);
}
function evHostPick(hid){const h=userData('hosts',[]).find(x=>x.id===hid);if(!h)return;document.getElementById('es-hname').value=h.name;document.getElementById('es-hplace').value=h.place||'';}
function evStayAdd(){
  const name=document.getElementById('es-hname').value.trim();if(!name){clToast('Who is hosting?');return;}
  const place=document.getElementById('es-hplace').value.trim(),day=evDay;
  evMutate(activeEventId,(ev,put)=>{const id=uid();put('o_'+id,{id,day,name,place,guests:[],upd:Date.now()});});
  if(document.getElementById('es-hsave').checked){
    const list=userData('hosts',[]).filter(h=>h.name.toLowerCase()!==name.toLowerCase());list.push({id:uid(),name,place});saveData('hosts',list);
  }
  closeModal();showSection('event');
}
function evStayGuestModal(sid){
  const ev=evFind(evData(),activeEventId);if(!ev)return;
  const day=evDay,stays=evStaysFor(ev,day),s=stays.find(x=>x.id===sid);if(!s)return;
  const going=evGoing(ev,day),where=pid=>{const o=stays.find(x=>(x.guests||[]).indexOf(pid)>=0);return o;};
  const rows=going.filter(p=>(s.guests||[]).indexOf(p.id)<0).map(p=>{const o=where(p.id);return`<button class="ev-person add" onclick="evStayAssign('${sid}','${p.id}')"><i>${escHtml(evInitials(p.name))}</i>${escHtml(p.name)}${o?`<em>with ${escHtml(o.name)}</em>`:''}<b>+</b></button>`;}).join('');
  openModal(`<div class="modal-head"><div class="modal-title">Guests staying with ${escHtml(s.name)}</div><button class="modal-close" onclick="closeModal()">×</button></div>
    ${rows?`<p class="cl-hint" style="margin-top:0">Tap to add. Someone already with another host moves across.</p><div class="ev-people" style="margin-bottom:16px">${rows}</div>`:'<p class="cl-hint">Everyone going that day is already here.</p>'}
    <div class="modal-row"><button class="btn-ghost" onclick="closeModal()">Done</button></div>`);
}
function evStayAssign(sid,pid){
  const day=evDay;
  evMutate(activeEventId,(ev,put)=>{
    const target=evStayRealize(ev,put,sid,day);
    (ev.stays||[]).filter(x=>x.day===day&&x.id!==target&&(x.guests||[]).indexOf(pid)>=0).forEach(x=>put('o_'+x.id,Object.assign({},x,{guests:x.guests.filter(g=>g!==pid),upd:Date.now()})));
    const t=(ev.stays||[]).find(x=>x.id===target);if(!t)return;
    if((t.guests||[]).indexOf(pid)<0)put('o_'+target,Object.assign({},t,{guests:(t.guests||[]).concat([pid]),upd:Date.now()}));
  });
  showSection('event');evStayGuestModal(sid==='legacy'?((evStaysFor(evFind(evData(),activeEventId),day).find(x=>x.guests&&x.guests.indexOf(pid)>=0)||{}).id||sid):sid);
}
function evStayGuestRemove(sid,pid){
  const day=evDay;
  evMutate(activeEventId,(ev,put)=>{const s=(ev.stays||[]).find(x=>x.id===sid);if(s)put('o_'+sid,Object.assign({},s,{guests:(s.guests||[]).filter(g=>g!==pid),upd:Date.now()}));});
  showSection('event');
}
function evStayDelete(sid){
  const day=evDay;if(!confirm('Remove this host from the night?'))return;
  evMutate(activeEventId,(ev,put)=>{
    if(sid==='legacy'){const cur=(ev.dinfo||{})[day]||{};put('d_'+day.replace(/-/g,''),Object.assign({},cur,{day,nightHost:'',upd:Date.now()}));}
    else put('o_'+sid,null);
  });
  showSection('event');
}

// ── hosts and guests (set by the organiser) ──
function evRoleSet(pid,role){
  evMutate(activeEventId,(ev,put)=>{
    if(!ev.creator)return;
    const cur=(ev.perms||[]).find(x=>x.id===pid),hide=(cur&&cur.hide)||[];
    if(role==='guest'||hide.length)put('h_'+pid,{id:pid,hide,role:role==='guest'?'guest':'host',upd:Date.now()});else put('h_'+pid,null);
  });
  openEventSettings();
}

// ── suggestion checklists ──
// A suggestion can be an idea or a checklist. A checklist's items are their own records `si_<id>` = {id,sid,text,done,by,upd}, and each item is voted on
// like any suggestion (a vote's target is the item's id).
function evSugItems(ev,sid){return(ev.sitems||[]).filter(i=>i.sid===sid).sort((a,b)=>(a.upd||0)-(b.upd||0));}
function evVoteBtns(ev,id){
  const t=evVoteTally(ev,id),mine=evMyVote(ev,id);
  return`<span class="ev-votes"><button class="ev-vote${mine>0?' on':''}" aria-pressed="${mine>0}" aria-label="Thumbs up" onclick="evVote('${id}',1)">${EV_THUMB_UP}<b>${t.up}</b></button><button class="ev-vote down${mine<0?' on':''}" aria-pressed="${mine<0}" aria-label="Thumbs down" onclick="evVote('${id}',-1)">${EV_THUMB_DOWN}<b>${t.down}</b></button></span>`;
}
function evSugListHTML(ev,s){
  const me=(ev.me||{}).id,items=evSugItems(ev,s.id);
  return`<div class="ev-sugitems">${items.map(it=>{const mineIt=it.by&&it.by.id===me;return`<div class="ev-sugitem${it.done?' done':''}"><label><input type="checkbox" ${it.done?'checked':''} onchange="evSugItemTick('${it.id}')"/><span>${escHtml(it.text)}</span></label>${evVoteBtns(ev,it.id)}${(mineIt||ev.creator)?`<button class="icon-btn" aria-label="Remove ${escHtml(it.text)}" onclick="evSugItemDelete('${it.id}')">×</button>`:''}</div>`;}).join('')}
    <div class="ev-add"><input id="esi-${s.id}" class="field-input" placeholder="Add an item" autocomplete="off" onkeydown="if(event.key==='Enter')evSugItemAdd('${s.id}')"/><button class="btn-ghost" onclick="evSugItemAdd('${s.id}')">Add</button></div></div>`;
}
function evSugItemAdd(sid){
  const inp=document.getElementById('esi-'+sid),text=inp&&inp.value.trim();if(!text)return;
  evMutate(activeEventId,(ev,put)=>{const id=uid(),me=ev.me||{};put('si_'+id,{id,sid,text,done:false,by:{id:me.id,name:me.name},upd:Date.now()});});
  showSection('event');const n=document.getElementById('esi-'+sid);if(n)n.focus();
}
function evSugItemTick(iid){evMutate(activeEventId,(ev,put)=>{const it=(ev.sitems||[]).find(x=>x.id===iid);if(it)put('si_'+iid,Object.assign({},it,{done:!it.done}));});showSection('event');}
function evSugItemDelete(iid){
  evMutate(activeEventId,(ev,put)=>{put('si_'+iid,null);(ev.votes||[]).filter(v=>v.s===iid).forEach(v=>put('v_'+v.id,null));});
  showSection('event');
}


