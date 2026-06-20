"use strict";

/* ================= App version & update check =================
 * APP_VERSION is the version baked into THIS built file. The app compares it
 * against the latest GitHub Release tag (e.g. "v1.2.0"). When a newer release
 * exists and the machine is online, a banner offers a direct download of the
 * new .html asset — no GitHub page, the file lands in the user's Downloads.
 * Offline use is unaffected: the check fails silently with no network.
 *
 * To publish a new version:
 *   1) bump APP_VERSION below, 2) `node build.js`, commit,
 *   3) tag it `vX.Y.Z` and push — the GitHub Action builds & attaches the file.
 */
const APP_VERSION = "1.31.0";
const UPDATE_REPO = "dbulldesign/bom.ship";          // owner/repo on GitHub
const UPDATE_API  = "https://api.github.com/repos/" + UPDATE_REPO + "/releases/latest";

function parseVer(s){ return String(s||"").replace(/^v/i,"").trim().split(".").map(n=>parseInt(n,10)||0); }
function verCmp(a,b){
  const pa=parseVer(a), pb=parseVer(b), len=Math.max(pa.length,pb.length);
  for(let i=0;i<len;i++){ const d=(pa[i]||0)-(pb[i]||0); if(d) return d>0?1:-1; }
  return 0;
}
async function checkForUpdates(manual){
  const badge=document.getElementById('verBadge');
  /* The hosted (PWA) build updates itself via its service worker, so the
     GitHub download banner only applies to the offline file:// build. */
  if(location.protocol!=='file:'){
    if(badge) badge.textContent="v"+APP_VERSION;
    if(manual) toast("This installed app updates itself automatically.");
    return;
  }
  if(manual && badge) badge.textContent="Checking…";
  try{
    const res=await fetch(UPDATE_API,{headers:{Accept:"application/vnd.github+json"},cache:"no-store"});
    if(!res.ok) throw new Error("HTTP "+res.status);
    const data=await res.json();
    const latest=data.tag_name||"";
    if(latest && verCmp(latest,APP_VERSION)>0){
      // Prefer the .html release asset so "Download" pulls the actual file directly.
      const assets=Array.isArray(data.assets)?data.assets:[];
      const htmlAsset=assets.find(a=>/\.html?$/i.test(a.name||"")) || assets[0];
      const dlUrl=(htmlAsset&&htmlAsset.browser_download_url) || data.html_url;
      const dlName=(htmlAsset&&htmlAsset.name) || "lighting-bom-estimator.html";
      showUpdateBanner(latest,dlUrl,dlName);
      if(badge){ badge.textContent="v"+APP_VERSION+" · update"; badge.classList.add('has-update'); }
    }else{
      if(manual) toast("You're on the latest version (v"+APP_VERSION+").");
      if(badge){ badge.textContent="v"+APP_VERSION; badge.classList.remove('has-update'); }
    }
  }catch(e){
    if(manual) toast("Couldn't check for updates — are you online?");
    if(badge) badge.textContent="v"+APP_VERSION;
  }
}
let _offlineUpdate = null;   // {ver, dlUrl, dlName} for the file:// build's update
function showUpdateBanner(ver,dlUrl,dlName){
  _offlineUpdate = {ver, dlUrl, dlName};
  document.body.classList.add('has-update-banner');
  let b=document.getElementById('updateBanner');
  if(!b){
    b=document.createElement('div');
    b.id='updateBanner'; b.className='update-banner no-print';
    document.body.insertBefore(b,document.body.firstChild);
  }
  b.innerHTML =
    '<span class="ub-msg">⬆ A newer version <b>'+esc(ver.replace(/^v/i,''))+'</b> is available (you have v'+APP_VERSION+').</span>'+
    '<span class="ub-actions">'+
      '<button class="ub-update" onclick="startGuidedUpdate()">Download &amp; replace…</button>'+
      '<button class="ub-later" title="Dismiss" onclick="dismissUpdateBanner()">Later</button>'+
    '</span>';
}
/* Best-guess OS for tailoring the replace instructions. */
function osGuess(){
  const p=(navigator.platform||'')+' '+(navigator.userAgent||'');
  if(/Mac|iP(hone|od|ad)/i.test(p)) return 'mac';
  if(/Win/i.test(p)) return 'win';
  return 'other';
}
/* One-click: start the download, then walk the user through replacing the file. */
function startGuidedUpdate(){
  const u = _offlineUpdate; if(!u) return;
  try{
    const a=document.createElement('a'); a.href=u.dlUrl; a.download=u.dlName||'lighting-bom-estimator.html';
    a.rel='noopener'; document.body.appendChild(a); a.click(); a.remove();
  }catch(e){ try{ window.open(u.dlUrl,'_blank'); }catch(_){ } }

  let here=''; try{ here=decodeURIComponent((location.pathname||'').split('/').pop()||''); }catch(e){}
  const os=osGuess();
  const reveal = os==='mac' ? 'Finder → Downloads' : os==='win' ? 'File Explorer → Downloads' : 'your Downloads folder';
  const replaceWord = os==='mac' ? '“Replace”' : os==='win' ? '“Replace the file in the destination”' : 'Replace';
  const body =
    '<p class="paste-help">Your new version <b>v'+esc(u.ver.replace(/^v/i,''))+'</b> is downloading'+
    ( u.dlName?(' as <b>'+esc(u.dlName)+'</b>'):'' )+'. Then:</p>'+
    '<ol class="upd-steps">'+
      '<li>Open <b>'+reveal+'</b> and find the downloaded file.</li>'+
      '<li>Move it into the folder where your current app file lives'+(here?(' (the one open now is <b>'+esc(here)+'</b>)'):'')+'.</li>'+
      '<li>When asked, choose '+replaceWord+' to overwrite the old version. '+
        '<span class="upd-note">If your browser renamed it (e.g. “…(1).html”), delete the old file and rename the new one to match — or just open the newest file.</span></li>'+
      '<li><b>Open the new file</b> (double-click). Your saved <b>.json</b> projects and browser backups are untouched.</li>'+
    '</ol>'+
    '<p class="upd-note">Using a launcher (<b>.command</b> / <b>.cmd</b>)? It opens whatever HTML is in its folder, so replacing the <b>.html</b> is all you need.</p>'+
    '<p class="upd-note">Didn’t download? <a href="'+esc(u.dlUrl)+'" download="'+esc(u.dlName||'lighting-bom-estimator.html')+'">Click here to download v'+esc(u.ver.replace(/^v/i,''))+'</a>.</p>';
  openModal({ title:'Update — download & replace', bodyHTML:body, wide:true, cancelLabel:'Got it' });
}
(function initVersionBadge(){
  const badge=document.getElementById('verBadge');
  if(badge) badge.textContent="v"+APP_VERSION;
  // Quiet auto-check on launch for the offline file build only (the hosted PWA
  // self-updates). Never blocks offline use.
  if(navigator.onLine && location.protocol==='file:') setTimeout(()=>checkForUpdates(false),1500);
})();

/* ================= Theme ================= */
function applyTheme(dark){
  document.body.classList.toggle('dark', dark);
  const t = document.getElementById('themeToggle');
  if(t) t.checked = dark;
}
function toggleTheme(){
  /* Called from the switch's onchange: the checkbox already holds the desired
     state. Fall back to inverting the current theme if invoked programmatically. */
  const t = document.getElementById('themeToggle');
  const dark = t ? t.checked : !document.body.classList.contains('dark');
  applyTheme(dark);
  try{ localStorage.setItem('lbom_theme', dark ? 'dark' : 'light'); }catch(e){}
}
(function initTheme(){
  try{
    const saved = localStorage.getItem('lbom_theme');
    if(saved) applyTheme(saved === 'dark');
    else applyTheme(window.matchMedia('(prefers-color-scheme: dark)').matches);
  }catch(e){}
})();

/* ================= US states datalist ================= */
const US_STATES = ["Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut",
"Delaware","District of Columbia","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa",
"Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota","Mississippi",
"Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey","New Mexico","New York",
"North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina",
"South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia","Wisconsin",
"Wyoming","Puerto Rico","Guam","U.S. Virgin Islands","American Samoa","Northern Mariana Islands"];
(function populateStates(){
  const dl = document.getElementById('usStatesList');
  if(dl) dl.innerHTML = US_STATES.map(s=>`<option value="${s}"></option>`).join('');
})();

/* ================= Custom confirm modal ================= */
let _modalResolve = null;
function showConfirm(title, msg, btnLabel='Confirm', btnClass='danger'){
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalMsg').textContent = msg;
  const btn = document.getElementById('modalConfirmBtn');
  btn.textContent = btnLabel;
  btn.className = btnClass;
  document.getElementById('modalBackdrop').style.display = 'flex';
  btn.focus();
  return new Promise(res => { _modalResolve = res; });
}
function modalConfirm(){
  document.getElementById('modalBackdrop').style.display = 'none';
  if(_modalResolve){ _modalResolve(true); _modalResolve = null; }
}
function modalCancel(){
  document.getElementById('modalBackdrop').style.display = 'none';
  if(_modalResolve){ _modalResolve(false); _modalResolve = null; }
}
document.addEventListener('keydown', e => {
  if(e.key === 'Escape'){ if(_modalEl) closeModal(); else modalCancel(); }
});
/* ================= Data model ================= */
/* unique id generator (defined before first use in blankRow) */
let _idSeed = Date.now();
function uid(){ return 'id' + (_idSeed++).toString(36); }

function blankRow(){ return {id:uid(), qty:0, type:"", mfr:"", desc:"", part:"", unitCost:0, mfrMult:1, markup:null, note:"", source:"", tag:"", accessories:[], pieces:[]}; }
const FIXTURE_TAGS = ["", "Downlight", "LED Linear", "Track Lighting", "Driver", "Power Supply", "Transformer"];
function blankAccessory(preset){
  preset = preset || {};
  return {id:uid(), desc:preset.desc||"", part:preset.part||"", mfr:preset.mfr||"MISC.",
          qty:null /* null = inherit parent qty */, unitCost:(preset.unitCost!=null?preset.unitCost:0),
          mfrMult:1, markup:null, note:"", source:(preset.source!=null?preset.source:"")};
}
/* accessory presets pulled from the shipping template, with default prices and KLS est source */
const ACCESSORY_PRESETS = [
  {label:"Louver",        desc:"Hexcell Louver",        part:"LOUVER",  mfr:"MISC.", unitCost:2, source:"KLS est"},
  {label:"Spread Lens",   desc:"Spread Lens",           part:"SPREAD",  mfr:"MISC.", unitCost:3, source:"KLS est"},
  {label:"Color Filter",  desc:"Dichroic Color Filter", part:"DICHRO",  mfr:"MISC.", unitCost:5, source:"KLS est"},
  {label:"FNP up to 2\"", desc:"FNP up to 2\"",         part:"FNP-2",   mfr:"MISC.", unitCost:5, source:"KLS est"},
  {label:"FNP up to 3\"", desc:"FNP up to 3\"",         part:"FNP-3",   mfr:"MISC.", unitCost:8, source:"KLS est"},
  {label:"BV up to 2\"",  desc:"BV up to 2\"",          part:"BV-2",    mfr:"MISC.", unitCost:2, source:"KLS est"},
  {label:"BV up to 3\"",  desc:"BV up to 3\"",          part:"BV-3",    mfr:"MISC.", unitCost:3, source:"KLS est"},
  {label:"Gel up to 2\"", desc:"Gel up to 2\"",         part:"GEL-2",   mfr:"MISC.", unitCost:5, source:"KLS est"},
  {label:"Snoot",         desc:"Snoot",                 part:"SNOOT",   mfr:"MISC.", unitCost:0, source:"KLS est"},
  {label:"Blank accessory", desc:"",                    part:"",        mfr:"MISC.", unitCost:0, source:""},
];
function sectionRow(name){ return {id:uid(), isSection:true, name:name||"Section"}; }

/* Services line (sell-only): qty + unit + location + description + SELL RATE.
   No cost / no markup. Days & Trips lines carry accessory-style add-ons. */
function blankService(opt){
  opt = opt||{};
  return {id:uid(), qty:0, unit:opt.unit||"Days", location:(opt.location!==undefined?opt.location:"In Office"),
          desc:opt.desc||"", sellRate:(opt.sellRate!=null?opt.sellRate:0), note:"", addons:[]};
}
const SERVICE_UNITS_BASE  = ["Trips","Days","Lump Sum"];          // Supplier & Controls (no Hours)
const SERVICE_UNITS_NINJA = ["Trips","Days","Hours","Lump Sum"];  // Ninja / Design keeps Hours
const SERVICE_LOCATIONS = ["In Office","On Site","—"];
function serviceUnits(type){ return type==='ninja' ? SERVICE_UNITS_NINJA : SERVICE_UNITS_BASE; }

/* Common architectural lighting-control manufacturers — used to power the
   type-ahead list on Controls rows. Free typing still works (it's a datalist),
   and any manufacturer the user types is remembered per-project too. */
const CONTROL_MFRS = [
  "ETC","Lutron","Pharos","Nicolaudi","Philips Dynalite","Color Kinetics","Crestron",
  "Wattstopper","Acuity Controls","nLight","Sensor Switch","Leviton","Cooper Controls",
  "Greengate","iLight","Douglas Lighting Controls","Vantage","Helvar","eldoLED","Casambi",
  "Pathway Connectivity","ENTTEC","Mode Lighting","Encelium","Zumtobel","Bublinet","Echoflex"
];

/* Accessory-style add-on presets, by the unit they attach to (all priced as DK est). */
const TRIP_ADDONS = [
  {label:"Round Trip Flight",        desc:"Round Trip Flight",         sellRate:500, source:"DK EST"},
  {label:"RT Travel – NYC Airport",  desc:"RT Travel – NYC Airport",   sellRate:75,  source:"DK EST"},
  {label:"RT Travel – Site Airport", desc:"RT Travel – Site Airport",  sellRate:75,  source:"DK EST"},
];
const DAY_ADDONS = [
  {label:"Hotel",                         desc:"Hotel",                          sellRate:250, source:"DK est"},
  {label:"Car Rental / RT Travel – Site", desc:"Car Rental / RT Travel – Site",  sellRate:75,  source:"DK est"},
  {label:"Breakfast",                     desc:"Breakfast",                      sellRate:10,  source:"DK est"},
  {label:"Lunch",                         desc:"Lunch",                          sellRate:20,  source:"DK est"},
  {label:"Dinner",                        desc:"Dinner",                         sellRate:50,  source:"DK est"},
];
function addonsForUnit(unit){ return unit==='Trips' ? TRIP_ADDONS : (unit==='Days' ? DAY_ADDONS : null); }
function blankServiceAddon(preset){
  preset = preset||{};
  return {id:uid(), desc:preset.desc||"", sellRate:(preset.sellRate!=null?preset.sellRate:0),
          qty:null /* null = inherit the parent line's qty */, source:(preset.source!=null?preset.source:""), note:""};
}

/* Default rows per group type. Trips sits above Days; Hours only for Ninja. */
function defaultServiceRows(type){
  const rows = [
    blankService({unit:"Trips", location:"—",        desc:"Travel",    sellRate:0}),
    blankService({unit:"Days",  location:"In Office", desc:"In office", sellRate:1500}),
    blankService({unit:"Days",  location:"On Site",   desc:"On site",   sellRate:2500}),
  ];
  if(type==='ninja'){
    rows.push(blankService({unit:"Hours", location:"In Office", desc:"In office", sellRate:150}));
    rows.push(blankService({unit:"Hours", location:"On Site",   desc:"On site",   sellRate:250}));
  }
  return rows;
}
function blankServiceGroup(name, type){
  type = type||"supplier";
  return {id:uid(), name:name||"Services", type:type, rows: defaultServiceRows(type)};
}
function blankOption(name){
  return { name:name, fixtureMarkup:50, controlMarkup:50, serviceMarkup:50,
           allowancePct:1, freightPct:5, controlAllowancePct:1,
           approved:false, changeOrders:[],
           fixtures:[sectionRow("Section 1"), blankRow(), blankRow(), blankRow()],
           controls:[blankRow(), blankRow()],
           services:[ blankServiceGroup("Supplier Services","supplier"),
                      blankServiceGroup("Controls Services","controls"),
                      blankServiceGroup("Ninja / Design Services","ninja") ] };
}
/* A change order is a mini-BOM scoped to an approved option. It inherits the
   parent option's markups but carries its own fixtures/controls/services. */
function blankChangeOrder(num, parent){
  return { id:uid(), number:num, name:"Change Order "+num, date:new Date().toLocaleDateString(),
           status:"Pending",
           fixtureMarkup:parent.fixtureMarkup, controlMarkup:parent.controlMarkup,
           serviceMarkup:parent.serviceMarkup!=null?parent.serviceMarkup:parent.fixtureMarkup,
           allowancePct:0, freightPct:0, controlAllowancePct:0,
           fixtures:[blankRow()], controls:[], services:[] };
}
/* Per-project defaults — drive new options and can be exported/imported to share
   the same setup across projects. */
const DEFAULT_DEFAULTS = { company:"Focus Lighting", taxRate:8.875, taxLocation:"New York",
  fixtureMarkup:50, controlMarkup:50, serviceMarkup:50, allowancePct:1, freightPct:5, controlAllowancePct:1 };
function blankProject(){
  const d = {...DEFAULT_DEFAULTS};
  return { name:"", jobCode:"", client:"", preparedBy:"", company:d.company, date:new Date().toLocaleDateString(),
           taxRate:d.taxRate, taxLocation:d.taxLocation, taxCheckedDate:"", options:[blankOption("Option 1")], current:0,
           shipMeta:{}, invoices:[], shipAdvices:[], savedAddresses:[],
           memory:{mfr:[],desc:[],type:[]}, customTags:[], defaults:d };
}
/* Apply default markups / allowance / freight onto an option object. */
function applyDefaultsToOption(o, d){
  o.fixtureMarkup = numOr(d.fixtureMarkup,50); o.controlMarkup = numOr(d.controlMarkup,50);
  o.serviceMarkup = numOr(d.serviceMarkup,50);
  o.allowancePct = numOr(d.allowancePct,1); o.freightPct = numOr(d.freightPct,5);
  o.controlAllowancePct = numOr(d.controlAllowancePct,1);
}
function ensureDefaults(){ if(!state.defaults || typeof state.defaults!=='object') state.defaults={...DEFAULT_DEFAULTS}; return state.defaults; }
let state = blankProject();
let dirty = false;
let lastSavedAt = null;     // timestamp of last successful file save
let lastChangeAt = null;    // timestamp of last edit
function markDirty(){ dirty = true; lastChangeAt = Date.now(); invalidateTotals(); scheduleAutosave(); scheduleHistory(); updateSaveStamp(); }

/* ================= Undo / Redo =================
 * Snapshot-based history. Every committed change funnels through markDirty(), so
 * we coalesce rapid edits (e.g. typing) with a short debounce and store full
 * serialized snapshots. _historyBase always holds the last committed snapshot;
 * undoStack holds the snapshots *before* each change, redoStack the ones undone. */
const HISTORY_MAX = 60;
let undoStack = [];
let redoStack = [];
let _historyBase = null;
let _historyTimer = null;
function snapshot(){ return JSON.stringify(state); }
function resetHistory(){ _historyBase = snapshot(); undoStack = []; redoStack = []; if(_historyTimer){ clearTimeout(_historyTimer); _historyTimer=null; } updateUndoButtons(); }
function scheduleHistory(){ if(_historyTimer) clearTimeout(_historyTimer); _historyTimer = setTimeout(commitHistory, 450); }
function commitHistory(){
  if(_historyTimer){ clearTimeout(_historyTimer); _historyTimer = null; }
  const snap = snapshot();
  if(snap === _historyBase) return;
  if(_historyBase !== null){
    undoStack.push(_historyBase);
    if(undoStack.length > HISTORY_MAX) undoStack.shift();
  }
  _historyBase = snap;
  redoStack = [];
  updateUndoButtons();
}
function applySnapshot(json){
  try{ state = JSON.parse(json); }catch(e){ return; }
  dirty = true;
  closeAccMenus();
  if(view !== 'estimate') setView('estimate');
  else render();
  updateSaveStamp();
}
function undo(){
  commitHistory();                 // flush any pending edit first
  if(!undoStack.length){ toast("Nothing to undo"); return; }
  redoStack.push(_historyBase);
  const prev = undoStack.pop();
  _historyBase = prev;
  applySnapshot(prev);
  updateUndoButtons();
  toast("Undo");
}
function redo(){
  if(!redoStack.length){ toast("Nothing to redo"); return; }
  undoStack.push(_historyBase);
  const next = redoStack.pop();
  _historyBase = next;
  applySnapshot(next);
  updateUndoButtons();
  toast("Redo");
}
function updateUndoButtons(){
  const u = document.getElementById('undoBtn'), r = document.getElementById('redoBtn');
  if(u) u.disabled = undoStack.length === 0;
  if(r) r.disabled = redoStack.length === 0;
}

/* ---- Autosave / local backup ----
   Keeps the most recent snapshots in localStorage so a crash or misclick can't
   lose work. These are browser-local backups, separate from your saved .json file. */
const AUTOSAVE_KEY = "lbom_autosave_v1";
const AUTOSAVE_MAX = 5;
let _autosaveTimer = null;
function scheduleAutosave(){
  if(_autosaveTimer) clearTimeout(_autosaveTimer);
  _autosaveTimer = setTimeout(doAutosave, 3000);   // 3s after the last edit
}
function doAutosave(){
  try{
    const snap = { ts:Date.now(), name:state.name||"(untitled)", json:projectJSON() };
    let arr = [];
    try{ arr = JSON.parse(localStorage.getItem(AUTOSAVE_KEY)) || []; }catch(e){}
    if(!Array.isArray(arr)) arr = [];
    /* de-dupe: if the most recent snapshot is identical, skip */
    if(arr.length && arr[0].json === snap.json) return;
    arr.unshift(snap);
    arr = arr.slice(0, AUTOSAVE_MAX);
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(arr));
    updateSaveStamp();
  }catch(e){ /* localStorage full or unavailable — fail silently */ }
}
function getAutosaves(){
  try{ const a = JSON.parse(localStorage.getItem(AUTOSAVE_KEY)); return Array.isArray(a)? a : []; }
  catch(e){ return []; }
}
function restoreAutosave(idx){
  const arr = getAutosaves();
  const snap = arr[idx];
  if(!snap) return;
  hideBackups();
  showConfirm("Restore backup", `Restore the backup of "${esc(snap.name)}" from ${fmtWhen(snap.ts)}? Your current unsaved work will be replaced.`, 'Restore', 'primary').then(ok=>{
    if(!ok) return;
    try{ applyProject(JSON.parse(snap.json)); dirty = true; render(); toast("Backup restored"); }
    catch(e){ toast("Could not restore that backup"); }
  });
}
function clearAutosaves(){
  showConfirm("Clear backups", "Delete all local autosave backups? This won't affect your saved .json files.", 'Clear', 'danger').then(ok=>{
    if(ok){ try{ localStorage.removeItem(AUTOSAVE_KEY); }catch(e){} updateSaveStamp(); toast("Backups cleared"); }
  });
}
function markSaved(){ dirty = false; lastSavedAt = Date.now(); updateSaveStamp(); }
function showBackups(){
  const arr = getAutosaves();
  const list = document.getElementById('backupsList');
  if(arr.length===0){
    list.innerHTML = `<div class="backups-empty">No backups yet. They're created automatically a few seconds after you make changes.</div>`;
  } else {
    list.innerHTML = arr.map((s,i)=>`
      <div class="backup-item">
        <div class="bi-info"><b>${esc(s.name)}</b><span class="bi-when">${fmtWhen(s.ts)}</span></div>
        <button class="ghost" onclick="restoreAutosave(${i})">Restore</button>
      </div>`).join('');
  }
  document.getElementById('backupsBackdrop').style.display = 'flex';
}
function hideBackups(){ document.getElementById('backupsBackdrop').style.display = 'none'; }
/* Coalesce the save-stamp refresh: markDirty() fires on every keystroke, and the
   refresh reads + parses localStorage (getAutosaves). Batching to one update per
   animation frame keeps fast typing cheap. */
let _saveStampRAF = null;
function updateSaveStamp(){
  if(typeof requestAnimationFrame !== 'function'){ _updateSaveStampNow(); return; }
  if(_saveStampRAF) return;
  _saveStampRAF = requestAnimationFrame(()=>{ _saveStampRAF = null; _updateSaveStampNow(); });
}
function _updateSaveStampNow(){
  const el = document.getElementById('saveStamp');
  if(!el) return;
  let txt = "", cls = "save-stamp";
  if(dirty){ txt = "Unsaved changes"; cls += " dirty"; }
  else if(lastSavedAt){ txt = "Saved " + fmtWhen(lastSavedAt); }
  else { txt = ""; }
  const auto = getAutosaves();
  if(auto.length && dirty){ txt += " · backup " + fmtWhen(auto[0].ts); }
  el.textContent = txt;
  el.className = cls;
}

/* current top-level view: 'estimate' | 'shipping' | 'advice' */
let view = 'estimate';
function setView(v){
  view = v;
  document.getElementById('estimateView').style.display = v==='estimate' ? '' : 'none';
  document.getElementById('shippingView').style.display = v==='shipping' ? '' : 'none';
  document.getElementById('adviceView').style.display = v==='advice' ? '' : 'none';
  document.getElementById('vsEstimate').classList.toggle('active', v==='estimate');
  document.getElementById('vsShipping').classList.toggle('active', v==='shipping');
  document.getElementById('vsAdvice').classList.toggle('active', v==='advice');
  render();
}

/* ================= Helpers ================= */
function numOr(v,d){ const n=parseFloat(String(v).replace(/[$,%\s]/g,"")); return isNaN(n)?d:n; }
function money(n){ return "$"+ n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}); }
/* format a cost value with 2 decimals for display in editable inputs (e.g. 39 -> "39.00"), no thousands comma */
function cost2(n){ return numOr(n,0).toFixed(2); }
/* For user-fillable number cells: render an EMPTY field (with a faded "0"/"0.00"
   placeholder) when the value is zero, so you can click and type a number without
   first deleting a "0" — the same feel as the text fields. */
function costVal(v){ return numOr(v,0)===0 ? "" : cost2(v); }
function qtyVal(v){ return numOr(v,0)===0 ? "" : v; }
function esc(s){ return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function toast(msg){ const t=document.getElementById("toast"); t.textContent=msg; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),2200); }

/* Focus Lighting logo for printed/exported documents. build.js replaces the token
   below with a base64 data URI of src/assets/focus-logo.png. Until built (or if the
   asset is missing) the token remains, so logoImg() renders nothing. */
const LOGO_DATA_URI = "__LOGO_DATA_URI__";
function logoImg(){
  return (LOGO_DATA_URI && !LOGO_DATA_URI.startsWith("__"))
    ? `<img class="doclogo" src="${LOGO_DATA_URI}" alt="Focus Lighting">` : "";
}

/* Manufacturer multiplier: scales the entered unit cost (defaults to 1). The
   effective unit cost flows into both your cost and the sell price. */
function mfrMultOf(o){ return (o.mfrMult==null||o.mfrMult==="")? 1 : numOr(o.mfrMult,1); }
function rowCalc(row, defMarkup){
  const mk = (row.markup===null||row.markup==="")? defMarkup : numOr(row.markup,0);
  const eUnit = numOr(row.unitCost,0) * mfrMultOf(row);
  const unitSell = Math.ceil(eUnit*(1+mk/100));   // =ROUNDUP(UNIT*MULT*MARKUP,0)
  return { mk, unitSell, extCost:row.qty*eUnit, extSell:row.qty*unitSell };
}
/* accessory qty inherits the parent's qty when its own qty is null/blank */
function accQty(acc, parent){ return (acc.qty===null||acc.qty==="")? numOr(parent.qty,0) : numOr(acc.qty,0); }
function accCalc(acc, parent, defMarkup){
  const mk = (acc.markup===null||acc.markup==="")? defMarkup : numOr(acc.markup,0);
  const eUnit = numOr(acc.unitCost,0) * mfrMultOf(acc);
  const unitSell = Math.ceil(eUnit*(1+mk/100));   // =ROUNDUP(UNIT*MULT*MARKUP,0)
  const q = accQty(acc, parent);
  return { mk, qty:q, unitSell, extCost:q*eUnit, extSell:q*unitSell };
}
/* ================= Per-project memory & custom tags =================
   Remembered values for Manufacturer / Description / TYPE (and typed tags) are
   stored on the project so they persist and power the type-ahead datalists. */
function ensureMemory(){
  if(!state.memory || typeof state.memory!=='object') state.memory={};
  ['mfr','desc','type'].forEach(k=>{ if(!Array.isArray(state.memory[k])) state.memory[k]=[]; });
  return state.memory;
}
function rememberValue(kind, val){
  val = String(val||'').trim(); if(!val) return;
  const arr = ensureMemory()[kind]; if(!arr) return;
  if(!arr.some(x=>x.toLowerCase()===val.toLowerCase())){ arr.push(val); if(arr.length>2000) arr.shift(); }
}
function ensureTags(){ if(!Array.isArray(state.customTags)) state.customTags=[]; return state.customTags; }
function rememberTag(val){
  val = String(val||'').trim(); if(!val) return;
  if(FIXTURE_TAGS.some(t=>t.toLowerCase()===val.toLowerCase())) return;
  const arr = ensureTags();
  if(!arr.some(x=>x.toLowerCase()===val.toLowerCase())) arr.push(val);
}
function tagOptions(){
  const out=[], seen=new Set();
  FIXTURE_TAGS.filter(Boolean).concat(ensureTags()).forEach(t=>{
    const k=String(t).toLowerCase(); if(!seen.has(k)){ seen.add(k); out.push(t); }
  });
  return out;
}
function memoryDatalists(){
  const opts = arr => (arr||[]).map(v=>`<option value="${esc(v)}"></option>`).join('');
  const m = ensureMemory();
  /* Controls manufacturers = curated control brands + any remembered ones (de-duped). */
  const ctrlSeen = new Set(); const ctrlList = [];
  CONTROL_MFRS.concat(m.mfr||[]).forEach(v=>{ const k=String(v).toLowerCase(); if(v && !ctrlSeen.has(k)){ ctrlSeen.add(k); ctrlList.push(v); } });
  return `<datalist id="memMfr">${opts(m.mfr)}</datalist>`+
         `<datalist id="ctrlMfr">${opts(ctrlList)}</datalist>`+
         `<datalist id="memDesc">${opts(m.desc)}</datalist>`+
         `<datalist id="memType">${opts(m.type)}</datalist>`+
         `<datalist id="memTag">${opts(tagOptions())}</datalist>`;
}

function sectionTotals(rows, defMarkup){
  let cost=0, sell=0, qty=0;
  rows.forEach(r=>{
    if(r.isSection) return;
    const c=rowCalc(r,defMarkup); cost+=c.extCost; sell+=c.extSell; qty+=numOr(r.qty,0);
    (r.accessories||[]).forEach(a=>{ const ac=accCalc(a,r,defMarkup); cost+=ac.extCost; sell+=ac.extSell; qty+=ac.qty; });
  });
  return {cost, sell, qty};
}
/* Services are sell-only (no cost, no Ext. cost). Ext. sell = qty × sell rate,
   plus any accessory-style add-ons (which inherit the line's qty by default). */
function svcAddonQty(a, parent){ return (a.qty===null||a.qty==="")? numOr(parent.qty,0) : numOr(a.qty,0); }
function svcAddonSell(a, parent){ return svcAddonQty(a,parent) * numOr(a.sellRate,0); }
function serviceCalc(svc){
  const base = numOr(svc.qty,0) * numOr(svc.sellRate,0);
  const add = (svc.addons||[]).reduce((t,a)=> t + svcAddonSell(a,svc), 0);
  return { lineSell:base, addSell:add, extSell:base+add };
}
function servicesTotals(groups){
  let sell=0;
  (groups||[]).forEach(g=> (g.rows||[]).forEach(s=>{ sell += serviceCalc(s).extSell; }));
  return {cost:0, sell};
}
/* Allowance & Freight: a % of subtotal COST (per BOM template), sell = cost * markup rounded up.
   Fixtures allowance/freight use fixtures cost & markup; controls allowance uses controls cost & markup. */
/* null-or-number helper for optional override fields */
function numOrNull(x){ return (x===null||x===undefined||x==='') ? null : numOr(x,0); }
function ovr(val, computed){ return (val===null||val===undefined||val==='') ? computed : numOr(val,0); }
function allowanceFreight(opt){
  const f = sectionTotals(opt.fixtures, opt.fixtureMarkup);
  const c = sectionTotals(opt.controls, opt.controlMarkup);
  const fMk = opt.fixtureMarkup/100 + 1;
  const cMk = opt.controlMarkup/100 + 1;
  const aCost = f.cost * (numOr(opt.allowancePct,0)/100);
  const frCost = f.cost * (numOr(opt.freightPct,0)/100);
  const caCost = c.cost * (numOr(opt.controlAllowancePct,0)/100);
  /* Manual overrides: a typed cost/sell wins over the %-of-section formula.
     If only the cost is overridden, the sell follows from the overridden cost. */
  const allowCost = ovr(opt.allowCostOv, aCost);
  const freightCost = ovr(opt.freightCostOv, frCost);
  const ctrlAllowCost = ovr(opt.ctrlAllowCostOv, caCost);
  return {
    allowCost, allowSell: ovr(opt.allowSellOv, Math.ceil(allowCost*fMk)),
    freightCost, freightSell: ovr(opt.freightSellOv, Math.ceil(freightCost*fMk)),
    ctrlAllowCost, ctrlAllowSell: ovr(opt.ctrlAllowSellOv, Math.ceil(ctrlAllowCost*cMk))
  };
}
/* ---- Totals memoization ----
   optionTotals() is called many times per render (once per tab, again in the
   pane, again in the compare panel). The numbers only change when the project
   is edited, so we cache results and invalidate on every committed change via
   _totalsEpoch (bumped in markDirty and at the start of each render). Caches are
   keyed by object identity, so undo/redo/open — which build fresh objects — get
   fresh results automatically. */
let _totalsEpoch = 0;
function invalidateTotals(){ _totalsEpoch++; }
const _bomTotalsCache = new WeakMap();
const _optTotalsCache = new WeakMap();

/* Core BOM totals for any option-shaped object (option OR change order). */
function bomTotals(obj){
  const hit = _bomTotalsCache.get(obj);
  if(hit && hit.epoch===_totalsEpoch) return hit.val;
  const val = computeBomTotals(obj);
  _bomTotalsCache.set(obj, {epoch:_totalsEpoch, val});
  return val;
}
function computeBomTotals(obj){
  const f=sectionTotals(obj.fixtures||[],obj.fixtureMarkup), c=sectionTotals(obj.controls||[],obj.controlMarkup);
  const s=servicesTotals(obj.services||[], obj.serviceMarkup!=null?obj.serviceMarkup:obj.fixtureMarkup);
  const af=allowanceFreight(obj);
  const extraSell = af.allowSell + af.freightSell + af.ctrlAllowSell;
  const extraCost = af.allowCost + af.freightCost + af.ctrlAllowCost;
  const sub=f.sell+c.sell+s.sell+extraSell;
  return {f,c,s, af, cost:f.cost+c.cost+s.cost+extraCost, sub};
}
/* Which change orders count toward the option's revised total */
let coTotalsFilter = 'all';   // 'all' | 'approved' | 'approved_pending'
function coCountsInTotals(co){
  if(coTotalsFilter==='approved') return co.status==='Approved';
  if(coTotalsFilter==='approved_pending') return co.status==='Approved' || co.status==='Pending';
  return true;
}
function optionTotals(opt){
  const hit = _optTotalsCache.get(opt);
  if(hit && hit.epoch===_totalsEpoch && hit.cf===coTotalsFilter && hit.tax===state.taxRate) return hit.val;
  const val = computeOptionTotals(opt);
  _optTotalsCache.set(opt, {epoch:_totalsEpoch, cf:coTotalsFilter, tax:state.taxRate, val});
  return val;
}
function computeOptionTotals(opt){
  const base = bomTotals(opt);
  /* change-order rollups — every CO shown, but only filtered ones add to the total */
  const cos = (opt.changeOrders||[]).map(co=>({ co, t:bomTotals(co), counts:coCountsInTotals(co) }));
  const coSellTotal = cos.reduce((a,x)=>a+(x.counts?x.t.sub:0),0);
  const coCostTotal = cos.reduce((a,x)=>a+(x.counts?x.t.cost:0),0);
  const sub = base.sub + coSellTotal;
  const tax = sub*state.taxRate/100;
  return { f:base.f, c:base.c, s:base.s, af:base.af,
           baseSub:base.sub, baseCost:base.cost,
           cos, coSellTotal, coCostTotal,
           cost:base.cost+coCostTotal, sub, tax, grand:sub+tax };
}

/* ================= Sort state ================= */
/* key: `${optionIdx}_${kind}` → { col: fieldName|null, dir: 1|-1 } */
const sortCols = {};
function getSortKey(kind){ return `${state.current}_${kind}`; }
function sortCol(kind, col){
  const key = getSortKey(kind);
  const cur = sortCols[key] || {col:null, dir:1};
  if(cur.col === col) sortCols[key] = {col, dir: cur.dir * -1};
  else sortCols[key] = {col, dir:1};
  renderPane(); renderCompare();
}
function sortedRows(rows, kind){
  const sc = sortCols[getSortKey(kind)];
  if(!sc || !sc.col) return rows.map((r,i)=>({r,i}));
  const NUM = new Set(['qty','unitCost','markup','unitSell','extCost','extSell']);
  return rows.map((r,i)=>{
    const calc = rowCalc(r, state.options[state.current][kind==='fixtures'?'fixtureMarkup':'controlMarkup']);
    const augmented = {...r, unitSell:calc.unitSell, extCost:calc.extCost, extSell:calc.extSell};
    return {r, i, val: augmented[sc.col]};
  }).sort((a,b)=>{
    const av = a.val ?? (NUM.has(sc.col)?0:"");
    const bv = b.val ?? (NUM.has(sc.col)?0:"");
    if(NUM.has(sc.col)) return (av - bv) * sc.dir;
    return String(av).localeCompare(String(bv)) * sc.dir;
  });
}

/* ================= Rendering ================= */
/* All tabbable form controls in the option pane, in document (visual) order. */
function paneTabbables(){
  const pane = document.getElementById('pane');
  if(!pane) return [];
  return Array.from(pane.querySelectorAll('input, select, textarea, button'))
    .filter(el => !el.disabled && el.offsetParent !== null && el.tabIndex !== -1);
}
let _pendingTabIndex = null;   // set on Tab keydown; consumed after re-render
let bomFilter = '';            // find/filter text for the BOM tables
/* Optional BOM columns the user can hide; persisted locally. */
const COLVIS_KEY = 'lbom_colvis_v1';
let colVis = loadColVis();
function loadColVis(){
  try{ const v=JSON.parse(localStorage.getItem(COLVIS_KEY)); return Object.assign({tag:true,markup:true,notes:true,source:true}, v||{}); }
  catch(e){ return {tag:true,markup:true,notes:true,source:true}; }
}
function saveColVis(){ try{ localStorage.setItem(COLVIS_KEY, JSON.stringify(colVis)); }catch(e){} }
function toggleCol(key){ colVis[key]=!colVis[key]; saveColVis(); applyColVis(); }
function applyColVis(){
  const body=document.body;
  body.classList.toggle('hide-col-tag', !colVis.tag);
  body.classList.toggle('hide-col-markup', !colVis.markup);
  body.classList.toggle('hide-col-notes', !colVis.notes);
  body.classList.toggle('hide-col-source', !colVis.source);
}
function toggleColMenu(){
  const m=document.getElementById('colMenu');
  if(m) m.style.display = m.style.display==='block'?'none':'block';
}

/* ================= Column widths (drag-to-resize, persisted) ================= */
const COLW_KEY = 'lbom_colw_v1';
let colWidths = loadColWidths();
function loadColWidths(){ try{ const v=JSON.parse(localStorage.getItem(COLW_KEY)); return (v&&typeof v==='object')?v:{}; }catch(e){ return {}; } }
function saveColWidths(){ try{ localStorage.setItem(COLW_KEY, JSON.stringify(colWidths)); }catch(e){} }
const COL_DEFAULTS = {qty:54,type:78,tag:118,mfr:120,part:130,desc:200,unitCost:88,mfrMult:62,markup:78,unitSell:88,extCost:96,extSell:104,source:130,notes:150,actions:110};
const TEXT_COLS = new Set(['part','desc','source','notes']);
function colKeyForField(field){
  if(field==='part'||field==='accpart') return 'part';
  if(field==='desc'||field==='accdesc') return 'desc';
  if(field==='source'||field==='accsource') return 'source';
  if(field==='note'||field==='accnote') return 'notes';
  return null;
}

/* ================= UI state: collapse + settings ================= */
const accExpanded = new Set();    // fixture row ids whose accessories are shown (default: hidden)
const secCollapsed = new Set();   // section divider ids that are collapsed
const bomSel = new Set();         // selected fixture/control row ids (bulk edit)
function toggleBomSel(id, on){ if(on) bomSel.add(id); else bomSel.delete(id); render(); }
let _lastBomClickId = null;   // anchor for Shift-click range selection
/* Checkbox click with modifier support: Shift-click selects the range from the
   last clicked checkbox (in visual order) to this one; plain/Ctrl-click toggles. */
function bomCheckClick(ev, kind, id){
  const box = ev.target;
  const want = box.checked;     // browser already toggled the box on click
  if(ev.shiftKey && _lastBomClickId){
    /* gather row ids in DOM (visual) order within this same table */
    const table = box.closest && box.closest('table');
    const ids = table ? Array.prototype.map.call(table.querySelectorAll('.bom-check[data-id]'), b=>b.dataset.id) : [id];
    const a = ids.indexOf(_lastBomClickId), b = ids.indexOf(id);
    if(a!==-1 && b!==-1){
      const [lo,hi] = a<b ? [a,b] : [b,a];
      for(let k=lo;k<=hi;k++){ if(want) bomSel.add(ids[k]); else bomSel.delete(ids[k]); }
    } else { want ? bomSel.add(id) : bomSel.delete(id); }
  } else {
    want ? bomSel.add(id) : bomSel.delete(id);
  }
  _lastBomClickId = id;
  render();
}
/* Header checkbox: select or clear every row in this table (fixtures or controls). */
function toggleSelectAll(kind, on){
  const o = state.options[state.current];
  (o[kind]||[]).forEach(r=>{ if(!r.isSection){ on ? bomSel.add(r.id) : bomSel.delete(r.id); } });
  render();
}
function selectedRows(){
  const o = state.options[state.current]; const out = [];
  ['fixtures','controls'].forEach(k=> (o[k]||[]).forEach(r=>{ if(!r.isSection && bomSel.has(r.id)) out.push(r); }));
  return out;
}
function bulkSet(field){
  if(!guardBaseEdit()) return;
  const el = document.getElementById(field==='markup'?'bulkMk':field==='mfrMult'?'bulkMx':'bulkTag');
  const raw = el? el.value : '';
  const rows = selectedRows(); if(!rows.length) return;
  rows.forEach(r=>{
    if(field==='markup') r.markup = parseMarkup(raw);
    else if(field==='mfrMult') r.mfrMult = numOr(raw,1);
    else if(field==='tag'){ r.tag = raw; rememberTag(raw); }
    if(r.linkId && r.linkMaster && field==='unitCost') linkMembers(r.linkId).forEach(x=>x.r.unitCost=r.unitCost);
  });
  markDirty(); render(); toast('Updated '+rows.length+' row'+(rows.length>1?'s':''));
}
function bulkDelete(){
  /* deletion is allowed even on an approved (locked) option */
  const o = state.options[state.current];
  ['fixtures','controls'].forEach(k=>{ o[k] = (o[k]||[]).filter(r=> r.isSection || !bomSel.has(r.id)); });
  sanitizeLinks(o); bomSel.clear(); markDirty(); render(); toast('Deleted selected');
}
function bulkClear(){ bomSel.clear(); render(); }
function bulkBar(){
  const n = bomSel.size;
  return `<div class="bulk-bar no-print">
    <b>${n} selected</b>
    <span class="bulk-grp">Markup <input id="bulkMk" class="num" inputmode="decimal" placeholder="1.5"><button class="ghost" onclick="bulkSet('markup')">Set</button></span>
    <span class="bulk-grp">Mfr× <input id="bulkMx" class="num" inputmode="decimal" placeholder="1"><button class="ghost" onclick="bulkSet('mfrMult')">Set</button></span>
    <span class="bulk-grp">Tag <input id="bulkTag" list="memTag" placeholder="Tag"><button class="ghost" onclick="bulkSet('tag')">Set</button></span>
    <button class="danger" onclick="bulkDelete()">Delete</button>
    <button class="ghost" onclick="bulkClear()">Clear</button>
  </div>`;
}
function toggleAcc(rowId){ if(accExpanded.has(rowId)) accExpanded.delete(rowId); else accExpanded.add(rowId); render(); }
function toggleSection(id){ if(secCollapsed.has(id)) secCollapsed.delete(id); else secCollapsed.add(id); render(); }

/* Global display settings (local to this browser). */
const SETTINGS_KEY = 'lbom_settings_v1';
const SETTINGS_DEFAULTS = { colText:'fit', showSelect:true, density:'comfortable', textScale:1, stickyHead:true, freezeCols:false };
let uiSettings = loadSettings();
function loadSettings(){ try{ return Object.assign({}, SETTINGS_DEFAULTS, JSON.parse(localStorage.getItem(SETTINGS_KEY))||{}); }catch(e){ return {...SETTINGS_DEFAULTS}; } }
function saveSettings(){ try{ localStorage.setItem(SETTINGS_KEY, JSON.stringify(uiSettings)); }catch(e){} }
/* These are app/browser-local display preferences — never stored in the job .json. */
function applySettings(){
  const b = document.body;
  b.classList.toggle('coltext-wrap', uiSettings.colText==='wrap');
  b.classList.toggle('coltext-fit', uiSettings.colText!=='wrap');
  b.classList.toggle('density-compact', uiSettings.density==='compact');
  b.classList.toggle('sticky-head', uiSettings.stickyHead!==false);
  b.classList.toggle('freeze-cols', !!uiSettings.freezeCols);
  const scale = Math.min(1.4, Math.max(0.8, numOr(uiSettings.textScale,1)));
  b.style.setProperty('--ui-scale', String(scale));
}
function setColText(mode){ uiSettings.colText = (mode==='wrap'?'wrap':'fit'); saveSettings(); applySettings(); render(); }
function setShowSelect(on){ uiSettings.showSelect = !!on; saveSettings(); render(); }
function setDensity(mode){ uiSettings.density = (mode==='compact'?'compact':'comfortable'); saveSettings(); applySettings(); }
function setTextScale(v){ uiSettings.textScale = Math.min(1.4, Math.max(0.8, numOr(v,1))); saveSettings(); applySettings(); }
function setStickyHead(on){ uiSettings.stickyHead = !!on; saveSettings(); applySettings(); }
function setFreezeCols(on){ uiSettings.freezeCols = !!on; saveSettings(); applySettings(); render(); }

/* Freeze the left identifier columns (through Description) of the fixtures &
   controls tables so they stay visible when scrolling wide tables horizontally.
   Measures the live header widths and pins those cells with position:sticky. */
function applyFreeze(){
  if(!uiSettings.freezeCols) return;
  const pane = document.getElementById('pane'); if(!pane) return;
  pane.querySelectorAll('.section table').forEach(table=>{
    const cols = table.querySelectorAll('colgroup col');
    if(!cols.length) return;
    let descIdx = -1;
    cols.forEach((c,idx)=>{ if(c.getAttribute('data-col')==='desc') descIdx = idx; });
    if(descIdx < 0) return;                         // services table etc. — no desc column, skip
    const K = descIdx + 1;
    const thead = table.tHead; if(!thead || !thead.rows.length) return;
    const ths = thead.rows[0].cells; if(ths.length < K) return;
    const lefts = []; let acc = 0;
    for(let i=0;i<K;i++){ lefts[i] = acc; acc += ths[i].getBoundingClientRect().width; }
    const pin = (cell,i,head)=>{
      cell.classList.add('frz'); if(i===K-1) cell.classList.add('frz-edge');
      cell.style.position = 'sticky'; cell.style.left = lefts[i]+'px';
      cell.style.zIndex = head ? 6 : 2;
    };
    for(let i=0;i<K;i++) pin(ths[i], i, true);
    const tb = table.tBodies[0]; if(!tb) return;
    Array.prototype.forEach.call(tb.rows, tr=>{
      if(tr.cells.length < K) return;               // colspan rows (section / add / acc-toggle) — skip
      for(let i=0;i<K;i++) pin(tr.cells[i], i, false);
    });
  });
}
function openSettings(){
  const original = uiSettings.colText;                 // remembered so Cancel can revert
  const checked = m => uiSettings.colText===m ? 'checked' : '';
  const body = `
    <p class="paste-help">How should long text in the <b>Part No.</b>, <b>Description</b>, <b>Price source</b> and <b>Notes</b> columns be shown?</p>
    <label class="set-opt"><input type="radio" name="colText" value="fit" ${checked('fit')}>
      <span><b>Auto-fit to text</b><br><span class="set-sub">Fields grow to fit their content; empty cells stay compact.</span></span></label>
    <label class="set-opt"><input type="radio" name="colText" value="wrap" ${checked('wrap')}>
      <span><b>Wrap text</b><br><span class="set-sub">Long text wraps onto multiple lines within the column.</span></span></label>
    <hr class="set-div">
    <label class="set-opt"><input type="checkbox" id="setShowSelect" ${uiSettings.showSelect?'checked':''}>
      <span><b>Show selection checkboxes</b><br><span class="set-sub">A checkbox column on the left of each table for selecting rows to bulk-edit. Tip: <b>Shift-click</b> a checkbox to select a range.</span></span></label>
    <hr class="set-div">
    <div class="set-opt"><div style="width:100%">
      <b>Row density</b>
      <div class="seg" role="radiogroup" aria-label="Row density">
        <button type="button" class="seg-btn ${uiSettings.density!=='compact'?'on':''}" data-density="comfortable">Comfortable</button>
        <button type="button" class="seg-btn ${uiSettings.density==='compact'?'on':''}" data-density="compact">Compact</button>
      </div></div></div>
    <div class="set-opt"><div style="width:100%">
      <b>Text size</b> <span class="set-sub" id="tsLabel">${Math.round(numOr(uiSettings.textScale,1)*100)}%</span>
      <input type="range" id="setTextScale" min="0.8" max="1.4" step="0.05" value="${numOr(uiSettings.textScale,1)}" style="width:100%" aria-label="Text size">
    </div></div>
    <label class="set-opt"><input type="checkbox" id="setStickyHead" ${uiSettings.stickyHead!==false?'checked':''}>
      <span><b>Sticky headers &amp; totals</b><br><span class="set-sub">Keep table headers and the grand-total row visible while scrolling.</span></span></label>
    <label class="set-opt"><input type="checkbox" id="setFreezeCols" ${uiSettings.freezeCols?'checked':''}>
      <span><b>Freeze identifier columns</b><br><span class="set-sub">Pin the left columns (through <b>Description</b>) on the fixtures &amp; controls tables so they stay visible when scrolling right.</span></span></label>`;
  openModal({
    title:'Settings', bodyHTML:body, wide:false,
    cancelLabel:'Close', confirmLabel:'Accept',
    onConfirm(){ closeModal(); },                       // keep current selection
    onCancel(){ if(uiSettings.colText!==original){ setColText(original); } },   // revert
    onOpen(back){
      const ok = back.querySelector('[data-mok]');
      const cancel = back.querySelector('[data-mclose]');
      if(ok) ok.style.display = 'none';                 // nothing to accept until a change
      const dirtyUI = ()=>{ if(ok) ok.style.display=''; if(cancel) cancel.textContent='Cancel'; };
      back.querySelectorAll('input[name="colText"]').forEach(radio=>{
        radio.addEventListener('change', ()=>{ setColText(radio.value); dirtyUI(); });
      });
      const sel = back.querySelector('#setShowSelect');
      if(sel) sel.addEventListener('change', ()=>{ setShowSelect(sel.checked); dirtyUI(); });
      back.querySelectorAll('.seg-btn[data-density]').forEach(btn=>{
        btn.addEventListener('click', ()=>{
          setDensity(btn.dataset.density);
          back.querySelectorAll('.seg-btn[data-density]').forEach(b=>b.classList.toggle('on', b===btn));
          dirtyUI();
        });
      });
      const ts = back.querySelector('#setTextScale'), tsl = back.querySelector('#tsLabel');
      if(ts) ts.addEventListener('input', ()=>{ setTextScale(ts.value); if(tsl) tsl.textContent = Math.round(numOr(ts.value,1)*100)+'%'; dirtyUI(); });
      const sh = back.querySelector('#setStickyHead');
      if(sh) sh.addEventListener('change', ()=>{ setStickyHead(sh.checked); dirtyUI(); });
      const fz = back.querySelector('#setFreezeCols');
      if(fz) fz.addEventListener('change', ()=>{ setFreezeCols(fz.checked); dirtyUI(); });
    }
  });
}

/* ================= Per-project defaults ================= */
function normDefaults(d){
  const o = {...DEFAULT_DEFAULTS};
  if(d && typeof d==='object'){
    if(typeof d.company==='string') o.company = d.company;
    if(typeof d.taxLocation==='string') o.taxLocation = d.taxLocation;
    ['taxRate','fixtureMarkup','controlMarkup','serviceMarkup','allowancePct','freightPct','controlAllowancePct'].forEach(k=>{
      if(d[k]!==undefined && d[k]!==null && d[k]!=='') o[k] = numOr(d[k], o[k]);
    });
  }
  return o;
}
function applyDefaultsNow(){
  const d = ensureDefaults();
  state.company = d.company; state.taxRate = numOr(d.taxRate,8.875); state.taxLocation = d.taxLocation;
  state.options.forEach(o=> applyDefaultsToOption(o, d));
  markDirty(); render(); toast('Defaults applied to this project');
}
function exportDefaults(){ downloadJSON('lighting-bom-defaults.json', {app:'lbom-defaults', defaults:ensureDefaults()}); toast('Defaults exported'); }
function importDefaults(text){
  try{
    const j = JSON.parse(text);
    state.defaults = normDefaults(j.defaults || j);
    applyDefaultsNow();
    toast('Defaults imported & applied');
  }catch(e){ toast('Could not read that defaults file'); }
}
function openProjectDefaults(){
  const d = ensureDefaults();
  const mkx = v => pct2x(numOr(v,0));
  const body = `
    <p class="paste-help">Defaults for <b>new options</b> in this project. Save them to a file and import into other projects to reuse the same setup. Markups accept a multiplier (1.5) or percent (50%).</p>
    <div class="def-grid">
      <label>Company<input data-def="company" value="${esc(d.company||'')}"></label>
      <label>Tax rate %<input data-def="taxRate" class="num" inputmode="decimal" value="${numOr(d.taxRate,0)}"></label>
      <label>Tax location<input data-def="taxLocation" list="usStatesList" value="${esc(d.taxLocation||'')}"></label>
      <label>Fixtures markup<input data-def="fixtureMarkup" class="num" inputmode="decimal" value="${mkx(d.fixtureMarkup)}"></label>
      <label>Controls markup<input data-def="controlMarkup" class="num" inputmode="decimal" value="${mkx(d.controlMarkup)}"></label>
      <label>Services markup<input data-def="serviceMarkup" class="num" inputmode="decimal" value="${mkx(d.serviceMarkup)}"></label>
      <label>Allowance % (fixtures)<input data-def="allowancePct" class="num" inputmode="decimal" value="${numOr(d.allowancePct,0)}"></label>
      <label>Freight % (fixtures)<input data-def="freightPct" class="num" inputmode="decimal" value="${numOr(d.freightPct,0)}"></label>
      <label>Allowance % (controls)<input data-def="controlAllowancePct" class="num" inputmode="decimal" value="${numOr(d.controlAllowancePct,0)}"></label>
    </div>
    <div class="lib-io">
      <button class="ghost" id="defApply">Apply to all options now</button>
      <button class="ghost" id="defExport">⬇ Export</button>
      <button class="ghost" id="defImport">⬆ Import…</button>
      <input type="file" id="defImportFile" accept=".json" style="display:none">
    </div>`;
  openModal({
    title:'Project defaults', bodyHTML:body, wide:true, cancelLabel:'Close',
    onOpen(back){
      back.querySelectorAll('[data-def]').forEach(inp=>{
        inp.addEventListener('change', ()=>{
          const k = inp.dataset.def, v = inp.value;
          const dd = ensureDefaults();
          if(k==='company'||k==='taxLocation') dd[k] = v;
          else if(k==='fixtureMarkup'||k==='controlMarkup'||k==='serviceMarkup'){ const p=parseMarkup(v); if(p!==null) dd[k]=p; }
          else dd[k] = numOr(v,0);
          markDirty();
        });
      });
      back.querySelector('#defApply').addEventListener('click', applyDefaultsNow);
      back.querySelector('#defExport').addEventListener('click', exportDefaults);
      const imp = back.querySelector('#defImportFile');
      back.querySelector('#defImport').addEventListener('click', ()=> imp.click());
      imp.addEventListener('change', e=>{ const f=e.target.files[0]; if(!f) return; const rd=new FileReader(); rd.onload=()=>{ importDefaults(rd.result); closeModal(); }; rd.readAsText(f); e.target.value=''; });
    }
  });
}

/* ================= Search across all options ================= */
function searchAllOptions(q){
  q = String(q||'').trim().toLowerCase();
  if(!q) return [];
  const out = [];
  state.options.forEach((o,oi)=>{
    ['fixtures','controls'].forEach(kind=>{
      (o[kind]||[]).forEach((r,ri)=>{
        if(r.isSection) return;
        const hay = [r.type,r.mfr,r.desc,r.part,r.tag,r.note].join(' ').toLowerCase();
        if(hay.includes(q)) out.push({oi, optName:o.name, kind, r});
      });
    });
  });
  return out;
}
function openGlobalSearch(){
  const results = (q)=>{
    const hits = searchAllOptions(q);
    if(!q.trim()) return `<div class="lib-empty">Type to search every option's fixtures &amp; controls.</div>`;
    if(!hits.length) return `<div class="lib-empty">No matches for "${esc(q)}".</div>`;
    return `<div class="lib-list">${hits.slice(0,300).map(h=>`<button class="gs-item" data-oi="${h.oi}" data-q="${esc(q)}">
        <span class="gs-opt">${esc(h.optName)}</span>
        <span class="lib-type">${esc(h.r.type||'—')}</span>
        <span class="lib-desc">${esc(h.r.desc||'')}${h.r.part?' · '+esc(h.r.part):''}</span>
        <span class="gs-kind">${h.kind==='controls'?'Control':'Fixture'}</span>
      </button>`).join('')}</div>`;
  };
  const body = `<input class="lib-search" id="gsSearch" placeholder="Search all options — type, part, description, mfr, tag, note…" autocomplete="off">
    <div id="gsWrap">${results('')}</div>`;
  openModal({
    title:'Search all options', bodyHTML:body, wide:true, cancelLabel:'Close',
    onOpen(back){
      const wrap = back.querySelector('#gsWrap'); const search = back.querySelector('#gsSearch');
      const bind = ()=> wrap.querySelectorAll('.gs-item').forEach(b=> b.addEventListener('click', ()=>{
        const oi = +b.dataset.oi; closeModal(); selectOption(oi); bomFilter = b.dataset.q; render();
      }));
      search.addEventListener('input', ()=>{ wrap.innerHTML = results(search.value); bind(); });
      bind(); search.focus();
    }
  });
}

/* Renders a text cell as an <input> (auto-fit) or auto-growing <textarea> (wrap),
   depending on the current setting. Used for the long free-text columns. */
function txtField(value, da, field, ph, opt){
  opt = opt || {};
  /* A manually-resized text column gets a fixed width (no auto-fit growth). */
  const ck = colKeyForField(field);
  const fixed = ck && colWidths[ck]!=null;
  const cls = ('txt ' + (opt.cls||'') + (fixed?' fixedw':'')).trim();
  const list  = opt.list  ? ` list="${opt.list}"`   : '';
  const style = opt.style ? ` style="${opt.style}"` : '';
  const title = opt.title ? ` title="${esc(opt.title)}"` : '';
  if(uiSettings.colText==='wrap'){
    return `<textarea class="${cls}" rows="1" placeholder="${ph}"${style}${title} ${da} data-f="${field}">${esc(value)}</textarea>`;
  }
  return `<input class="${cls}" value="${esc(value)}" placeholder="${ph}"${list}${style}${title} ${da} data-f="${field}">`;
}

/* Sort a list of {r,i} entries by the active sort column (keeps original indices). */
function sortEntries(entries, sc, defMarkup){
  if(!sc || !sc.col) return entries;
  const NUM = new Set(['qty','unitCost','mfrMult','markup','unitSell','extCost','extSell']);
  return entries.map(e=>{
    const calc = rowCalc(e.r, defMarkup);
    const aug = {...e.r, unitSell:calc.unitSell, extCost:calc.extCost, extSell:calc.extSell};
    return {r:e.r, i:e.i, val:aug[sc.col]};
  }).sort((a,b)=>{
    const av = a.val ?? (NUM.has(sc.col)?0:""), bv = b.val ?? (NUM.has(sc.col)?0:"");
    if(NUM.has(sc.col)) return (av-bv)*sc.dir;
    return String(av).localeCompare(String(bv))*sc.dir;
  });
}

/* Dim rows that don't match the find box; highlight those that do. Works on the
   live DOM so it doesn't disturb editing or re-render. */
function applyBomFilter(){
  const q = bomFilter.trim().toLowerCase();
  const pane = document.getElementById('pane');
  if(!pane) return;
  const rows = pane.querySelectorAll('.section tbody tr');
  rows.forEach(tr=>{
    if(!q){ tr.classList.remove('bom-dim','bom-hit'); return; }
    /* gather text from this row's inputs + cells */
    let txt = '';
    tr.querySelectorAll('input').forEach(i=> txt += ' '+i.value);
    txt += ' '+tr.textContent;
    const hit = txt.toLowerCase().includes(q);
    tr.classList.toggle('bom-dim', !hit);
    tr.classList.toggle('bom-hit', hit);
  });
}

function captureFocus(){
  const el = document.activeElement;
  if(!el || !(el.matches && el.matches('#pane input, #pane select, #pane textarea'))) return null;
  const ds = el.dataset || {};
  const sig = {
    k:ds.k, i:ds.i, f:ds.f, ai:ds.ai, svcG:ds.svcG, svcR:ds.svcR,
    fapct:ds.fapct, secmk:ds.secmk, svcmk:el.hasAttribute('data-svcmk')?'1':undefined,
    svcGname:ds.svcGname, optname:el.hasAttribute('data-optname')?'1':undefined,
    tag:el.tagName, selStart:el.selectionStart, selEnd:el.selectionEnd
  };
  return sig;
}
function restoreFocus(sig){
  if(!sig) return;
  let sel = '#pane ';
  if(sig.optname) sel += 'input[data-optname]';
  else if(sig.svcmk) sel += 'input[data-svcmk]';
  else if(sig.svcGname!==undefined) sel += `input[data-svc-gname="${sig.svcGname}"]`;
  else if(sig.secmk!==undefined) sel += `input[data-secmk="${sig.secmk}"]`;
  else if(sig.fapct!==undefined) sel += `input[data-fapct="${sig.fapct}"]`;
  else if(sig.svcG!==undefined) sel += `[data-svc-g="${sig.svcG}"][data-svc-r="${sig.svcR}"][data-f="${sig.f}"]`;
  else if(sig.k!==undefined && sig.ai!==undefined) sel += `[data-k="${sig.k}"][data-i="${sig.i}"][data-ai="${sig.ai}"][data-f="${sig.f}"]`;
  else if(sig.k!==undefined) sel += `[data-k="${sig.k}"][data-i="${sig.i}"][data-f="${sig.f}"]`;
  else return;
  const el = document.querySelector(sel);
  if(el){
    el.focus();
    try{ if(sig.tag==='INPUT' && el.type!=='date' && sig.selStart!=null) el.setSelectionRange(sig.selStart, sig.selEnd); }catch(e){}
  }
}

/* Lightweight refresh of just the tax/total numbers in the stamp while the user
   types in the tax field — avoids a full pane re-render on every keystroke (which
   was making the tax box feel unresponsive). */
function updateTaxDisplays(){
  const opt = state.options[state.current];
  if(!opt) return;
  const t = optionTotals(opt);
  const pane = document.getElementById('pane');
  if(!pane) return;
  const taxRow = pane.querySelector('.stamp-row.tax .val');
  if(taxRow) taxRow.textContent = money(t.tax);
  const grandRow = pane.querySelector('.stamp-row.grand .val');
  if(grandRow) grandRow.textContent = money(t.grand);
}

function render(){
  /* Fresh epoch each render: totals computed once per option this pass and reused
     across the tabs, pane, and compare panel — but never stale, since any edit
     that changed them also triggered this render. */
  invalidateTotals();
  const _focus = captureFocus();
  /* title block — shared across views.
     Don't overwrite an input the user is actively typing in (would strip a trailing "."). */
  const af = document.activeElement;
  const setIf = (id,val)=>{ const el=document.getElementById(id); if(el && el!==af) el.value=val; };
  setIf("projCompany", state.company || "");
  setIf("projName", state.name);
  setIf("projJobCode", state.jobCode || "");
  setIf("projClient", state.client);
  setIf("projBy", state.preparedBy);
  setIf("projDate", state.date);
  setIf("projTax", state.taxRate);
  setIf("projTaxLoc", state.taxLocation || "");
  setIf("projTaxDate", state.taxCheckedDate || "");
  document.title = (state.name? state.name+" — ":"") + "Lighting BOM Estimator";
  renderRecents();

  if(view === 'shipping'){ renderShipping(); return; }
  if(view === 'advice'){ renderAdvice(); return; }

  /* tabs */
  const tabs = document.getElementById("tabs");
  tabs.innerHTML = state.options.map((o,i)=>{
    const t = optionTotals(o);
    return `<button class="tab ${i===state.current?'active':''}" onclick="selectOption(${i})">
      ${esc(o.name)} <span class="tot">${money(t.grand)}</span></button>`;
  }).join("") + `<button class="tab tab-add" onclick="addOption()">+ Add option</button>`;

  renderPane();
  renderCompare();
  if(bomFilter) applyBomFilter();
  if(_pendingTabIndex !== null){
    const fields = paneTabbables();
    const target = fields[_pendingTabIndex];
    _pendingTabIndex = null;
    if(target){ target.focus(); if(target.select) try{ target.select(); }catch(e){} }
    else restoreFocus(_focus);
  } else {
    restoreFocus(_focus);
  }
}

function pct2x(pct){ return (1 + pct/100).toFixed(3).replace(/\.?0+$/,'').padEnd(1,''); }
function x2pct(x){ return Math.round((x-1)*100000)/1000; }   // 1.25 → 25, 1.333 → 33.3

/* Parse a single markup field that accepts either a percent ("50%", "50")
   or a multiplier/decimal ("1.5", ".5"). Returns the stored percent value.
   Rule: a trailing % => percent; value <= 3 (and no %) => treated as a
   multiplier (1.5 -> 50%); value > 3 => treated as a percent (50 -> 50%). */
function parseMarkup(raw){
  if(raw===null || raw===undefined) return null;
  const s = String(raw).trim();
  if(s==="") return null;
  const hasPct = s.includes('%');
  const n = parseFloat(s.replace(/[%$,\s]/g,''));
  if(isNaN(n)) return null;
  if(hasPct) return Math.round(n*1000)/1000;          // explicit percent
  if(n<=3)  return Math.round(x2pct(n)*1000)/1000;     // multiplier like 1.5 or 0.5
  return Math.round(n*1000)/1000;                      // bare percent like 50
}
/* Display a stored percent as a multiplier string (the primary display), e.g. 50 -> "1.5" */
function markupDisplay(pct){ return pct2x(pct); }

function sectionTable(kind, rows, defMarkup, label, tickClass){
  const tot = sectionTotals(rows, defMarkup);
  const hasSections = rows.some(r=>r.isSection);
  /* Sorting now works in both modes — when sectioned, rows are sorted within
     each section (dividers stay put). */
  const sc = sortCols[getSortKey(kind)] || {col:null, dir:1};
  const allowAccessories = (kind==='fixtures');   // accessories only on fixtures

  function th(col, lbl, extraClass=''){
    const active = sc.col === col;
    const icon = active ? (sc.dir===1 ? '▲' : '▼') : '⇅';
    const cls = `sortable${active ? (sc.dir===1?' sort-asc':' sort-desc') : ''}${extraClass?' '+extraClass:''}`;
    return `<th class="${cls}" onclick="sortCol('${kind}','${col}')">${lbl}<span class="sort-icon">${icon}</span></th>`;
  }
  const defX = pct2x(defMarkup);
  const selCol = uiSettings.showSelect;        // leftmost selection-checkbox column
  const NCOLS = (allowAccessories ? 15 : 14) + (selCol?1:0);   // fixtures add a Tag column; +1 for Mfr ×; +1 for select

  /* Link groups (fixtures only): give each shared-cost group a stable colour,
     a short label (the master's TYPE) and a member count so every linked row —
     not just the master — clearly shows it's linked and to which group. */
  const LINK_COLORS = ['#C77B1F','#2E6B4F','#3A5FA0','#7B3F9E','#A3372E','#4A7A6B','#B5852A','#356D8C'];
  const linkInfo = {};
  if(allowAccessories){
    let gi = 0;
    rows.forEach(r=>{
      if(!r || r.isSection || !r.linkId) return;
      if(!linkInfo[r.linkId]){
        linkInfo[r.linkId] = {color:LINK_COLORS[gi%LINK_COLORS.length], letter:String.fromCharCode(65+(gi%26)), count:0, masterType:'', masterLabel:''};
        gi++;
      }
    });
    rows.forEach(r=>{
      if(!r || r.isSection || !r.linkId || !linkInfo[r.linkId]) return;
      const g = linkInfo[r.linkId];
      g.count++;
      if(r.linkMaster){ const t=(r.type||'').trim(); g.masterType = t; g.masterLabel = t || (r.part||'').trim() || 'master'; }
    });
  }
  function selCell(r){ return selCol ? `<td class="col-sel no-print"><input type="checkbox" class="bom-check" data-id="${r.id}" tabindex="-1" title="Select (Shift-click for a range)" ${bomSel.has(r.id)?'checked':''} onclick="bomCheckClick(event,'${kind}','${r.id}')"></td>` : ''; }

  /* single markup field (accepts percent or decimal). Primary display = multiplier. */
  function mkCell(markupVal, dataAttrs, colCls){
    const isInherit = markupVal===null || markupVal==="";
    const val  = isInherit ? "" : pct2x(markupVal);
    const iCls = isInherit ? " mk-inherit" : "";
    const ph   = pct2x(defMarkup);
    return `<td class="${colCls||''}" style="width:78px"><input class="num${iCls}" inputmode="decimal" value="${val}" placeholder="${ph}" title="Enter a multiplier (1.5) or percent (50%)" ${dataAttrs} data-f="markup"></td>`;
  }

  function fixtureRowHTML(r, i){
    const c = rowCalc(r, defMarkup);
    const da = `data-k="${kind}" data-i="${i}"`;
    const tagCell = allowAccessories
      ? `<td class="col-tag" style="width:118px"><input class="tag-input" list="memTag" value="${esc(r.tag||'')}" placeholder="Tag" ${da} data-f="tag"></td>`
      : '';
    const grp = r.linkId ? linkInfo[r.linkId] : null;
    const linkCls = r.linkId ? (r.linkMaster ? ' link-master' : ' link-linked') : '';
    const picking = (_linkPick && allowAccessories && r.linkId!==_linkPick) ? ' link-pickable' : '';
    const isLinkedFollower = r.linkId && !r.linkMaster;
    const costCell = isLinkedFollower
      ? `<td style="width:88px"><input class="num linked-cost" inputmode="decimal" value="${costVal(r.unitCost)}" placeholder="0.00" ${da} data-f="unitCost" readonly title="Shared cost — edit it on the master (★)"></td>`
      : `<td style="width:88px"><input class="num" inputmode="decimal" value="${costVal(r.unitCost)}" placeholder="0.00" ${da} data-f="unitCost"></td>`;
    /* Link control: the master shows a "★ Master A" chip; each follower shows a
       "🔗 A → F1" chip naming the master it's linked to. The group letter + colour
       (and the matching left stripe) tie members together; hovering any member
       lights up the whole group. */
    let linkBtn = '';
    if(allowAccessories){
      const lbl = grp ? (r.linkMaster ? `★<span class="link-rel">Master ${esc(grp.letter)}</span>`
                                      : `🔗<span class="link-rel">${esc(grp.letter)} → ${esc(grp.masterLabel||'master')}</span>`)
                      : '🔗';
      const ttl = _linkPick
        ? (r.linkId===_linkPick ? (r.linkMaster?'Master of this new link group — click to finish linking' : 'Unlink this fixture') : 'Link this fixture to the master (shares the master’s unit cost)')
        : (grp ? (r.linkMaster ? `Master of link group ${grp.letter} — ${grp.count-1} other ${grp.count-1===1?'fixture shares':'fixtures share'} its unit cost. Click to unlink.` : `Linked to master “${grp.masterLabel||'master'}” (group ${grp.letter}) — shares its unit cost. Click to unlink.`) : 'Link this fixture’s unit cost with others (this becomes the master)');
      const chipStyle = grp ? ` style="--lg:${grp.color}"` : '';
      linkBtn = `<button class="rowact linkbtn${r.linkId?(r.linkMaster?' is-master':' is-linked'):''}"${chipStyle} tabindex="-1" title="${ttl}" onclick="linkAction('${kind}',${i})">${lbl}</button>`;
    }
    const stripeStyle = grp ? ` style="--lg:${grp.color}"` : '';
    const linkAttr = grp ? ` data-link="${r.linkId}"` : '';
    return `<tr data-rk="${kind}" data-ri="${i}"${linkAttr} class="${linkCls}${picking}"${stripeStyle}>
      ${selCell(r)}
      <td style="width:54px"><input class="num" inputmode="numeric" value="${qtyVal(r.qty)}" placeholder="0" ${da} data-f="qty"></td>
      <td style="width:78px"><input class="up" list="memType" value="${esc(r.type)}" placeholder="F1" ${da} data-f="type"></td>
      ${tagCell}
      <td style="width:120px"><input list="${allowAccessories?'memMfr':'ctrlMfr'}" value="${esc(r.mfr??'')}" placeholder="Manufacturer" ${da} data-f="mfr"></td>
      <td style="width:130px" class="col-part">${txtField(r.part, da, 'part', 'Part number', {cls:'partno', style:'font-family:var(--mono)', title:r.part})}</td>
      <td style="min-width:170px" class="col-desc">${txtField(r.desc, da, 'desc', 'Part description', {list:'memDesc'})}</td>
      ${costCell}
      <td style="width:62px"><input class="num" inputmode="decimal" value="${mfrMultOf(r)}" placeholder="1" title="Manufacturer multiplier (scales unit cost)" ${da} data-f="mfrMult"></td>
      ${mkCell(r.markup, da, 'col-markup')}
      <td class="calc" style="width:88px">${money(c.unitSell)}</td>
      <td class="calc" style="width:96px">${money(c.extCost)}</td>
      <td class="calc sell" style="width:104px">${money(c.extSell)}</td>
      <td class="col-source" style="width:130px">${txtField(r.source||'', da, 'source', 'Price source / date', {})}</td>
      <td class="col-notes" style="width:150px">${txtField(r.note||'', da, 'note', 'Notes', {})}</td>
      <td style="width:110px" class="no-print row-actions">
        ${selCol?'':`<input type="checkbox" class="bom-check" data-id="${r.id}" tabindex="-1" title="Select for bulk edit (Shift-click for a range)" ${bomSel.has(r.id)?'checked':''} onclick="bomCheckClick(event,'${kind}','${r.id}')">`}
        <span class="drag-grip" draggable="true" title="Drag to move row">⠿</span>
        ${linkBtn}
        <button class="rowact star" tabindex="-1" title="Save this part to your library" onclick="savePartFromRow('${kind}',${i})">★</button>
        <button class="rowact" tabindex="-1" title="Duplicate this row" onclick="dupRow('${kind}',${i})">⎘</button>
        <button class="rowdel" tabindex="-1" title="Delete ${allowAccessories?'fixture':'control'}" onclick="delRow('${kind}',${i})">✕</button>
      </td>
    </tr>`;
  }
  function accessoryRowsHTML(r, i){
    if(!allowAccessories) return "";
    const accs = r.accessories||[];
    const open = accExpanded.has(r.id);
    /* Collapsed by default to keep the BOM clean: show a single compact toggle. */
    const toggleRow = `<tr class="acc-toggle-row no-print"><td colspan="${NCOLS}">
      <button class="acc-collapse-btn" onclick="toggleAcc('${r.id}')">${open?'▾':'▸'} ${accs.length? accs.length+' accessor'+(accs.length===1?'y':'ies') : 'Add accessory'}</button>
    </td></tr>`;
    if(!open) return toggleRow;
    const accHTML = accs.map((a,ai)=>{
      const ac = accCalc(a, r, defMarkup);
      const da = `data-k="${kind}" data-i="${i}" data-ai="${ai}"`;
      const qInherit = (a.qty===null||a.qty==="");
      const mInherit = (a.markup===null||a.markup==="");
      return `<tr class="acc-row">
        ${selCol?'<td class="col-sel no-print"></td>':''}
        <td style="width:54px"><input class="num accqty-inherit" inputmode="numeric" value="${qInherit?'':qtyVal(a.qty)}" placeholder="${numOr(r.qty,0)}" ${da} data-f="accqty"></td>
        <td style="width:78px"><span class="acc-pill">Acc</span></td>
        <td class="col-tag" style="width:118px"></td>
        <td style="width:120px"><input list="memMfr" value="${esc(a.mfr??'')}" placeholder="MISC." ${da} data-f="accmfr"></td>
        <td style="width:130px" class="col-part">${txtField(a.part, da, 'accpart', 'Part number', {cls:'partno', style:'font-family:var(--mono)', title:a.part})}</td>
        <td style="min-width:170px" class="col-desc"><span class="acc-tag">${txtField(a.desc, da, 'accdesc', 'Accessory (louver, lens, filter…)', {list:'memDesc'})}</span></td>
        <td style="width:88px"><input class="num" inputmode="decimal" value="${costVal(a.unitCost)}" placeholder="0.00" ${da} data-f="accunitCost"></td>
        <td style="width:62px"><input class="num" inputmode="decimal" value="${mfrMultOf(a)}" placeholder="1" title="Manufacturer multiplier" ${da} data-f="accmfrMult"></td>
        <td class="col-markup" style="width:78px"><input class="num${mInherit?' mk-inherit':''}" inputmode="decimal" value="${mInherit?'':pct2x(a.markup)}" placeholder="${pct2x(defMarkup)}" ${da} data-f="accmarkup"></td>
        <td class="calc" style="width:88px">${money(ac.unitSell)}</td>
        <td class="calc" style="width:96px">${money(ac.extCost)}</td>
        <td class="calc sell" style="width:104px">${money(ac.extSell)}</td>
        <td class="col-source" style="width:130px">${txtField(a.source||'', da, 'accsource', 'Price source', {})}</td>
        <td class="col-notes" style="width:150px">${txtField(a.note||'', da, 'accnote', 'Notes', {})}</td>
        <td style="width:30px" class="no-print"><button class="rowdel" title="Delete accessory" onclick="delAccessory('${kind}',${i},${ai})">✕</button></td>
      </tr>`;
    }).join("");
    const addRowHTML = `<tr class="acc-row no-print"><td class="acc-add-cell" colspan="${NCOLS}">
      <span class="acc-menu" data-accmenu="${kind}_${i}">
        <button class="acc-add-btn" onclick="toggleAccMenu('${kind}_${i}')">+ Add accessory ▾</button>
        <span class="acc-menu-list" id="accmenu_${kind}_${i}" style="display:none">
          ${ACCESSORY_PRESETS.map((p,pi)=>`<button onclick="addAccessory('${kind}',${i},${pi})">${esc(p.label)}</button>`).join('')}
        </span>
      </span></td></tr>`;
    return toggleRow + accHTML + addRowHTML;
  }
  function sectionRowHTML(r, i, secTot){
    const collapsed = secCollapsed.has(r.id);
    return `<tr class="section-row" data-rk="${kind}" data-sec="${i}"><td colspan="${NCOLS}"><div class="section-cell">
      <button class="sec-toggle no-print" title="${collapsed?'Expand':'Collapse'} section" onclick="toggleSection('${r.id}')">${collapsed?'▸':'▾'}</button>
      <span class="sx">SECTION</span>
      <input value="${esc(r.name)}" placeholder="Section name" data-k="${kind}" data-i="${i}" data-f="sectionname">
      <span class="section-sub">Cost ${money(secTot.cost)} · Sell <b>${money(secTot.sell)}</b></span>
      <button class="rowdel no-print" title="Delete section divider" onclick="delRow('${kind}',${i})">✕</button>
    </div></td></tr>`;
  }

  function sectionSubtotalAt(startIdx){
    let cost=0, sell=0;
    for(let j=startIdx+1;j<rows.length;j++){
      if(rows[j].isSection) break;
      const c=rowCalc(rows[j],defMarkup); cost+=c.extCost; sell+=c.extSell;
      (rows[j].accessories||[]).forEach(a=>{ const ac=accCalc(a,rows[j],defMarkup); cost+=ac.extCost; sell+=ac.extSell; });
    }
    return {cost, sell};
  }

  const addBtnRow = (secIdx)=>`<tr class="sec-add-row no-print"><td colspan="${NCOLS}">
      <button class="acc-add-btn" onclick="addRowToSection('${kind}',${secIdx})">+ Add ${allowAccessories?'fixture':'control'} to this section</button>
    </td></tr>`;
  let body;
  if(hasSections){
    const parts = [];
    let secIdx = null, secId = null, secCol = false, buf = [];
    const flush = ()=>{
      if(secIdx === null){                 // rows before the first section
        sortEntries(buf, sc, defMarkup).forEach(({r,i})=> parts.push(fixtureRowHTML(r,i)+accessoryRowsHTML(r,i)));
      } else if(!secCol){
        sortEntries(buf, sc, defMarkup).forEach(({r,i})=> parts.push(fixtureRowHTML(r,i)+accessoryRowsHTML(r,i)));
        parts.push(addBtnRow(secIdx));
      }
      buf = [];
    };
    rows.forEach((r,i)=>{
      if(r.isSection){
        flush();
        secIdx = i; secId = r.id; secCol = secCollapsed.has(r.id);
        parts.push(sectionRowHTML(r, i, sectionSubtotalAt(i)));
      } else {
        buf.push({r,i});
      }
    });
    flush();
    body = parts.join("");
  } else {
    const sorted = sortedRows(rows, kind);
    body = sorted.map(({r,i})=> fixtureRowHTML(r,i) + accessoryRowsHTML(r,i)).join("");
    /* a quick add line at the bottom of the table (like the fixtures section) */
    body += `<tr class="sec-add-row no-print"><td colspan="${NCOLS}">
      <button class="acc-add-btn" onclick="addRow('${kind}')">+ Add ${allowAccessories?'fixture':'control'}</button></td></tr>`;
  }

  const dupBtn = allowAccessories
    ? `<button class="ghost" onclick="dupFixturesToNewOption()" title="Copy these fixtures into a new option so you can pair them with different controls">⎘ Duplicate fixtures →</button>`
    : `<button class="ghost" onclick="dupControlsToNewOption()" title="Copy these controls into a new option so you can pair them with different fixtures">⎘ Duplicate controls →</button>`;
  const addBtns = `<button class="ghost" onclick="addRow('${kind}')">+ Add ${allowAccessories?'fixture':'control'}</button>
      <button class="ghost" onclick="addSection('${kind}')">+ Add section</button>
      <button class="ghost" onclick="openPasteModal('${kind}')" title="Paste rows from Excel or a spreadsheet">⊞ Paste rows</button>
      <button class="ghost" onclick="openLibrary('${kind}')" title="Insert a saved part from your library">★ Library</button>
      ${dupBtn}`;

  return `<div class="section">
    <div class="sec-head">
      <span class="tick ${tickClass}"></span><h2>${label}</h2>
      <span class="sec-markup no-print">Default markup
        <span class="sec-mk-pair"><input inputmode="decimal" value="${defX}" placeholder="1.5" title="Multiplier (1.5) or percent (50%)" data-secmk="${kind}"></span>
        <span class="mk-hint">× or %</span>
      </span>
    </div>
    <div class="sec-add-bar no-print">${addBtns}</div>
    <div class="table-scroll">
    <table>
      <colgroup>${(selCol?'<col class="col-sel no-print" style="width:30px">':'')}${(allowAccessories
        ? ['qty','type','tag','mfr','part','desc','unitCost','mfrMult','markup','unitSell','extCost','extSell','source','notes','actions']
        : ['qty','type','mfr','part','desc','unitCost','mfrMult','markup','unitSell','extCost','extSell','source','notes','actions']
      ).map(key=>{
        const manual = colWidths[key];
        const w = manual!=null ? manual : (TEXT_COLS.has(key) ? null : COL_DEFAULTS[key]);
        return `<col data-col="${key}"${w!=null?` style="width:${w}px"`:''}>`;
      }).join('')}</colgroup>
      <thead><tr>
        ${selCol?'<th class="col-sel no-print"><input type="checkbox" tabindex="-1" title="Select / clear all in this table" onclick="toggleSelectAll(\''+kind+'\', this.checked)"></th>':''}
        ${th('qty','Qty','r')}
        ${th('type','Type')}
        ${allowAccessories ? th('tag','Tag','col-tag') : ''}
        ${th('mfr','Manufacturer')}
        ${th('part','Part No.')}
        ${th('desc','Description')}
        ${th('unitCost','Unit cost','r')}
        <th class="r" title="Manufacturer multiplier">Mfr ×</th>
        <th class="r col-markup">Markup</th>
        ${th('unitSell','Unit sell','r')}
        ${th('extCost','Ext. cost','r')}
        ${th('extSell','Ext. sell','r')}
        <th class="col-source">Price source</th>
        <th class="col-notes">Notes</th>
        <th class="no-print"></th>
      </tr></thead>
      <tbody>${body || ""}</tbody>
    </table>
    </div>
    ${allowanceFreightRows(kind)}
    <div class="sec-foot">
      <span class="sf-item">Units<b>${tot.qty.toLocaleString()}</b></span>
      <span class="sf-item">Cost<b>${money(tot.cost)}</b></span>
      <span class="sf-item">Sell<b class="sell">${money(tot.sell)}</b></span>
    </div>
  </div>`;
}

/* Allowance/Freight lines shown in the section footer (editable here only).
   Fixtures: Allowance + Freight. Controls: Allowance. */
function allowanceFreightRows(kind){
  const opt = state.options[state.current];
  const af = allowanceFreight(opt);
  /* cost/sell are editable: typing sets an override; clearing reverts to the % formula. */
  function line(label, pctField, pctVal, cost, sell, costOvField, sellOvField){
    const costOv = opt[costOvField], sellOv = opt[sellOvField];
    return `<div class="af-line">
      <span class="af-label">${label}</span>
      <span class="af-pctwrap no-print"><input class="af-pct num" inputmode="decimal" value="${numOr(pctVal,0)}" data-fapct="${pctField}" title="% of section cost"> %</span>
      <span class="af-cost">Cost <input class="af-num num${numOrNull(costOv)!=null?' af-ov':''}" inputmode="decimal" value="${costVal(cost)}" placeholder="0.00" data-afov="${costOvField}" title="Type to override; clear to use the %"></span>
      <span class="af-sell">Sell <input class="af-num num sell${numOrNull(sellOv)!=null?' af-ov':''}" inputmode="decimal" value="${costVal(sell)}" placeholder="0.00" data-afov="${sellOvField}" title="Type to override; clear to use the %"></span>
    </div>`;
  }
  if(kind==='fixtures'){
    return `<div class="af-block">
      ${line('Allowance (Fixtures)','allowancePct',opt.allowancePct,af.allowCost,af.allowSell,'allowCostOv','allowSellOv')}
      ${line('Freight (Fixtures)','freightPct',opt.freightPct,af.freightCost,af.freightSell,'freightCostOv','freightSellOv')}
    </div>`;
  }
  if(kind==='controls'){
    return `<div class="af-block">
      ${line('Allowance (Controls)','controlAllowancePct',opt.controlAllowancePct,af.ctrlAllowCost,af.ctrlAllowSell,'ctrlAllowCostOv','ctrlAllowSellOv')}
    </div>`;
  }
  return '';
}

/* ================= Services section ================= */
function servicesTable(opt){
  const groups = opt.services || [];
  const tot = servicesTotals(groups);
  const NC = 9;

  const groupHTML = groups.map((g,gi)=>{
    const units = serviceUnits(g.type);
    const rowsHTML = (g.rows||[]).map((s,si)=>{
      const c = serviceCalc(s);
      const da = `data-svc-g="${gi}" data-svc-r="${si}"`;
      const unitOpts = units.map(u=>`<option ${s.unit===u?'selected':''}>${u}</option>`).join('');
      const locOpts = SERVICE_LOCATIONS.map(l=>`<option ${s.location===l?'selected':''}>${l}</option>`).join('');
      const lineRow = `<tr>
        <td style="width:60px"><input class="num" inputmode="decimal" value="${qtyVal(s.qty)}" placeholder="0" ${da} data-f="qty"></td>
        <td style="width:90px"><select ${da} data-f="unit">${unitOpts}</select></td>
        <td style="width:104px"><select ${da} data-f="location">${locOpts}</select></td>
        <td style="min-width:190px"><input value="${esc(s.desc)}" placeholder="Service description" ${da} data-f="desc"></td>
        <td style="width:104px"><input class="num" inputmode="decimal" value="${costVal(s.sellRate)}" placeholder="0.00" ${da} data-f="sellRate"></td>
        <td class="calc sell" style="width:110px">${money(c.extSell)}</td>
        <td style="width:120px"><input value="${esc(s.source||'')}" placeholder="" ${da} data-f="source"></td>
        <td style="min-width:140px"><input value="${esc(s.note||'')}" placeholder="Notes" ${da} data-f="note"></td>
        <td style="width:52px" class="no-print row-actions">
          <button class="rowact" tabindex="-1" title="Duplicate this service line" onclick="dupService(${gi},${si})">⎘</button>
          <button class="rowdel" tabindex="-1" title="Delete service line" onclick="delService(${gi},${si})">✕</button>
        </td>
      </tr>`;
      /* Days & Trips lines carry accessory-style add-ons (travel, hotel, meals…). */
      const presets = addonsForUnit(s.unit);
      let addonsHTML = '';
      if(presets){
        const arows = (s.addons||[]).map((a,ai)=>{
          const ada = `data-svc-g="${gi}" data-svc-r="${si}" data-svc-a="${ai}"`;
          const qInherit = (a.qty===null||a.qty==='');
          return `<tr class="acc-row">
            <td><input class="num accqty-inherit" inputmode="decimal" value="${qInherit?'':qtyVal(a.qty)}" placeholder="${numOr(s.qty,0)}" ${ada} data-f="addonqty"></td>
            <td><span class="acc-pill">Add</span></td>
            <td></td>
            <td><span class="acc-tag"><input value="${esc(a.desc)}" placeholder="Add-on" ${ada} data-f="addondesc"></span></td>
            <td><input class="num" inputmode="decimal" value="${costVal(a.sellRate)}" placeholder="0.00" ${ada} data-f="addonsellRate"></td>
            <td class="calc sell">${money(svcAddonSell(a,s))}</td>
            <td><input value="${esc(a.source||'')}" placeholder="" ${ada} data-f="addonsource"></td>
            <td><input value="${esc(a.note||'')}" placeholder="Notes" ${ada} data-f="addonnote"></td>
            <td class="no-print"><button class="rowdel" title="Delete add-on" onclick="delServiceAddon(${gi},${si},${ai})">✕</button></td>
          </tr>`;
        }).join('');
        const key = `svc_${gi}_${si}`;
        const menu = `<tr class="acc-row no-print"><td class="acc-add-cell" colspan="${NC}">
          <span class="acc-menu" data-accmenu="${key}">
            <button class="acc-add-btn" onclick="toggleAccMenu('${key}')">+ Add ${s.unit==='Trips'?'travel':'day'} item ▾</button>
            <span class="acc-menu-list" id="accmenu_${key}" style="display:none">
              ${presets.map((p,pi)=>`<button onclick="addServiceAddon(${gi},${si},${pi})">${esc(p.label)} ($${p.sellRate})</button>`).join('')}
            </span>
          </span></td></tr>`;
        addonsHTML = arows + menu;
      }
      return lineRow + addonsHTML;
    }).join('');
    const gTot = servicesTotals([g]);
    return `<tr class="section-row"><td colspan="${NC}"><div class="section-cell">
        <span class="sx">▸ SERVICES</span>
        <input value="${esc(g.name)}" placeholder="Services group" data-svc-gname="${gi}">
        <span class="section-sub">Sell <b>${money(gTot.sell)}</b></span>
        <button class="rowdel no-print" title="Delete services group" onclick="delServiceGroup(${gi})">✕</button>
      </div></td></tr>
      ${rowsHTML}
      <tr class="acc-row no-print"><td class="acc-add-cell" colspan="${NC}">
        <button class="acc-add-btn" onclick="addService(${gi})">+ Add service line</button>
      </td></tr>`;
  }).join('');

  return `<div class="section">
    <div class="sec-head">
      <span class="tick svc"></span><h2>Services</h2>
      <span class="sec-markup no-print" style="font-size:.7rem;color:var(--ink-soft)">Sell-only · no cost</span>
    </div>
    <div class="sec-add-bar no-print">
      <button class="ghost" onclick="addServiceGroup()">+ Add services group</button>
    </div>
    <div class="table-scroll">
    <table>
      <thead><tr>
        <th class="r">Qty</th><th>Unit</th><th>Location</th><th>Description</th>
        <th class="r">Sell rate</th><th class="r">Ext. sell</th>
        <th>Price source</th><th>Notes</th><th class="no-print"></th>
      </tr></thead>
      <tbody>${groupHTML}</tbody>
    </table>
    </div>
    <div class="sec-foot">
      <span class="sf-item">Services sell<b class="sell">${money(tot.sell)}</b></span>
    </div>
  </div>`;
}

function renderPane(){
  const opt = state.options[state.current];
  const t = optionTotals(opt);
  const margin = t.sub>0 ? ((t.sub-t.cost)/t.sub*100) : 0;
  const approveBtn = opt.approved
    ? `<span class="approved-badge" title="This option is approved and locked. You can still delete entries; use a Change Order to add scope.">🔒 Approved (locked)</span>
       <button class="ghost" onclick="unapproveOption()">Unapprove to edit</button>`
    : `<button class="ghost approve-btn" onclick="approveOption()">Approve option</button>`;
  document.getElementById("pane").innerHTML = `
    ${memoryDatalists()}
    <div class="opt-head ${opt.approved?'is-approved':''}">
      <input value="${esc(opt.name)}" data-optname aria-label="Option name">
      <div class="opt-tools no-print">
        <div class="bom-find">
          <input id="bomFind" placeholder="Find in this option…" value="${esc(bomFilter)}"
            oninput="bomFilter=this.value;applyBomFilter()" aria-label="Find in BOM">
          ${bomFilter?`<button class="bom-find-clear" onclick="bomFilter='';render()" title="Clear">✕</button>`:''}
        </div>
        <button class="ghost" onclick="openGlobalSearch()" title="Search fixtures &amp; controls across every option in this project">🔎 Search</button>
        <div class="col-menu-wrap">
          <button class="ghost" onclick="event.stopPropagation();toggleColMenu()" title="Show / hide columns">Columns ▾</button>
          <div class="col-menu" id="colMenu" onclick="event.stopPropagation()">
            <label><input type="checkbox" ${colVis.tag?'checked':''} onchange="toggleCol('tag')"> Tag</label>
            <label><input type="checkbox" ${colVis.markup?'checked':''} onchange="toggleCol('markup')"> Markup</label>
            <label><input type="checkbox" ${colVis.notes?'checked':''} onchange="toggleCol('notes')"> Notes</label>
            <label><input type="checkbox" ${colVis.source?'checked':''} onchange="toggleCol('source')"> Price source</label>
          </div>
        </div>
        ${approveBtn}
        <button class="ghost" onclick="dupOption()">Duplicate</button>
        <button class="danger" onclick="delOption()">Delete option</button>
      </div>
    </div>
    ${bomSel.size ? bulkBar() : ''}
    ${sectionTable("fixtures", opt.fixtures, opt.fixtureMarkup, "Light fixtures", "")}
    ${sectionTable("controls", opt.controls, opt.controlMarkup, "Lighting controls", "ctl")}
    ${servicesTable(opt)}
    ${forAccessTable(opt, t)}
    <div class="stamp">
      <div class="stamp-row muted"><span class="lbl">Total cost (your cost)</span><span class="val">${money(t.baseCost)}</span></div>
      <div class="stamp-row muted"><span class="lbl">Margin</span><span class="val">${margin.toFixed(1)}%</span></div>
      <div class="stamp-row"><span class="lbl">Fixtures sell</span><span class="val">${money(t.f.sell)}</span></div>
      <div class="stamp-row"><span class="lbl">Controls sell</span><span class="val">${money(t.c.sell)}</span></div>
      ${t.s.sell>0?`<div class="stamp-row"><span class="lbl">Services sell</span><span class="val">${money(t.s.sell)}</span></div>`:''}
      ${t.af.allowSell>0?`<div class="stamp-row"><span class="lbl">Allowance (Fix) sell</span><span class="val">${money(t.af.allowSell)}</span></div>`:''}
      ${t.af.ctrlAllowSell>0?`<div class="stamp-row"><span class="lbl">Allowance (Ctrl) sell</span><span class="val">${money(t.af.ctrlAllowSell)}</span></div>`:''}
      ${t.af.freightSell>0?`<div class="stamp-row"><span class="lbl">Freight sell</span><span class="val">${money(t.af.freightSell)}</span></div>`:''}
      <div class="stamp-row ${t.cos.length?'':'grand'}"><span class="lbl">${t.cos.length?'Approved base subtotal':'Subtotal'}</span><span class="val">${money(t.baseSub)}</span></div>
      ${t.cos.map((x,ci)=>`<div class="stamp-row co-row ${x.counts?'':'co-excluded'}"><span class="lbl">${esc(x.co.name)} (${esc(x.co.status)})${x.counts?'':' — excluded'}</span><span class="val">${money(x.t.sub)}</span></div>`).join('')}
      ${t.cos.length?`<div class="stamp-row"><span class="lbl">Revised subtotal</span><span class="val">${money(t.sub)}</span></div>`:''}
      <div class="stamp-row tax"><span class="lbl">Tax <input inputmode="decimal" value="${state.taxRate}" data-stamptax oninput="this.value=this.value.replace(/[^0-9.]/g,'')"> %</span><span class="val">${money(t.tax)}</span></div>
      ${(state.taxLocation||state.taxCheckedDate)?`<div class="stamp-row muted"><span class="lbl" style="font-size:.62rem">${esc(state.taxLocation||'')}${state.taxLocation&&state.taxCheckedDate?' · ':''}${state.taxCheckedDate?'verified '+esc(state.taxCheckedDate):''}</span><span class="val"></span></div>`:''}
      <div class="stamp-row grand"><span class="lbl">Total with tax</span><span class="val">${money(t.grand)}</span></div>
    </div>
    ${opt.approved ? changeOrdersSection(opt) : ''}`;
  bindPane();
  lockBomInputs();
  applyFreeze();
}

/* When an option is approved its base BOM is locked: every data field in the
   fixtures / controls / services / allowance sections is disabled, and the
   add / link / duplicate / drag affordances are hidden via the .bom-locked
   class (CSS). Deleting entries and editing Change Orders stay available. */
function lockBomInputs(){
  const pane = document.getElementById('pane'); if(!pane) return;
  const locked = !!(state.options[state.current]||{}).approved;
  pane.classList.toggle('bom-locked', locked);
  if(!locked) return;
  /* disable data entry in the base sections — but keep selection checkboxes
     (so rows can still be selected for deletion) usable */
  pane.querySelectorAll('.section input:not(.bom-check), .section select, .section textarea').forEach(el=>{ el.disabled = true; });
  const nm = pane.querySelector('input[data-optname]'); if(nm) nm.disabled = true;
}

/* Change Orders area — shown once an option is approved. Each CO is its own mini-BOM. */
function changeOrdersSection(opt){
  const cos = opt.changeOrders||[];
  const coBlocks = cos.map(co=>{
    const ct = bomTotals(co);
    const da = `data-co="${co.id}"`;
    const coIdx = cos.indexOf(co);
    return `<div class="co-card">
      <div class="co-card-head">
        <span class="co-num">CO #${esc(String(co.number))}</span>
        <input class="co-name" value="${esc(co.name)}" ${da} data-cofield="name">
        <input class="co-date" value="${esc(co.date)}" placeholder="mm/dd/yyyy" ${da} data-cofield="date">
        <select class="co-status" ${da} data-cofield="status">
          ${['Pending','Approved','Rejected'].map(s=>`<option ${co.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
        <span class="co-total">Sell <b>${money(ct.sub)}</b></span>
        <span class="co-actions no-print">
          <button class="co-mini" title="Move up" ${coIdx===0?'disabled':''} onclick="moveCO('${co.id}',-1)">▲</button>
          <button class="co-mini" title="Move down" ${coIdx===cos.length-1?'disabled':''} onclick="moveCO('${co.id}',1)">▼</button>
          <button class="co-mini" title="Duplicate change order" onclick="dupChangeOrder('${co.id}')">⎘</button>
          <button class="rowdel" title="Delete change order" onclick="delChangeOrder('${co.id}')">✕</button>
        </span>
      </div>
      ${coSectionTable(co, 'fixtures', 'Fixtures')}
      ${coSectionTable(co, 'controls', 'Controls')}
      ${coServicesTable(co)}
      <div class="co-foot">
        <span class="sf-item">CO cost<b>${money(ct.cost)}</b></span>
        <span class="sf-item">CO sell<b class="sell">${money(ct.sub)}</b></span>
      </div>
    </div>`;
  }).join('');
  return `<div class="co-section">
    <div class="sec-head">
      <span class="tick" style="background:var(--danger)"></span><h2>Change Orders</h2>
      <span class="co-filter no-print">Include in totals:
        <select onchange="coTotalsFilter=this.value; render()">
          ${[['all','All change orders'],['approved','Approved only'],['approved_pending','Approved + Pending']]
            .map(([v,l])=>`<option value="${v}" ${coTotalsFilter===v?'selected':''}>${l}</option>`).join('')}
        </select>
      </span>
      <button class="ghost no-print" style="margin-left:10px" onclick="addChangeOrder()">+ Add change order</button>
    </div>
    ${cos.length? coBlocks : `<div class="co-empty">No change orders yet. Click <b>Add change order</b> to add scope to this approved option.</div>`}
  </div>`;
}

/* Simplified BOM table for a change order (fixtures or controls). Binds via data-co. */
function coSectionTable(co, kind, label){
  const dm = kind==='fixtures'?co.fixtureMarkup:co.controlMarkup;
  const rows = co[kind]||[];
  const allowAcc = (kind==='fixtures');
  const body = rows.map((r,i)=>{
    const c = rowCalc(r, dm);
    const da = `data-co="${co.id}" data-cok="${kind}" data-coi="${i}"`;
    return `<tr>
      <td style="width:54px"><input class="num" inputmode="numeric" value="${qtyVal(r.qty)}" placeholder="0" ${da} data-cof="qty"></td>
      <td style="width:78px"><input class="up" value="${esc(r.type)}" placeholder="F1" ${da} data-cof="type"></td>
      <td style="width:120px"><input value="${esc(r.mfr??'')}" placeholder="Manufacturer" ${da} data-cof="mfr"></td>
      <td style="min-width:160px"><input value="${esc(r.desc)}" placeholder="Description" ${da} data-cof="desc"></td>
      <td style="width:120px"><input class="partno" value="${esc(r.part)}" placeholder="Part #" title="${esc(r.part)}" style="font-family:var(--mono)" ${da} data-cof="part"></td>
      <td style="width:84px"><input class="num" inputmode="decimal" value="${costVal(r.unitCost)}" placeholder="0.00" ${da} data-cof="unitCost"></td>
      <td style="width:70px"><input class="num${(r.markup===null||r.markup==='')?' mk-inherit':''}" inputmode="decimal" value="${(r.markup===null||r.markup==='')?'':pct2x(r.markup)}" placeholder="${pct2x(dm)}" ${da} data-cof="markup"></td>
      <td class="calc" style="width:88px">${money(c.unitSell)}</td>
      <td class="calc sell" style="width:96px">${money(c.extSell)}</td>
      <td style="width:30px" class="no-print"><button class="rowdel" onclick="delCORow('${co.id}','${kind}',${i})">✕</button></td>
    </tr>`;
  }).join('');
  return `<div class="co-sub">
    <div class="co-sub-head"><span>${label}</span>
      <button class="acc-add-btn no-print" onclick="addCORow('${co.id}','${kind}')">+ Add ${allowAcc?'fixture':'control'}</button></div>
    <div class="table-scroll"><table>
      <thead><tr><th class="r">Qty</th><th>Type</th><th>Manuf.</th><th>Description</th><th>Part #</th>
        <th class="r">Unit cost</th><th class="r">Markup</th><th class="r">Unit sell</th><th class="r">Ext. sell</th><th class="no-print"></th></tr></thead>
      <tbody>${body||`<tr><td colspan="10" class="co-norow">No ${allowAcc?'fixtures':'controls'} in this change order</td></tr>`}</tbody>
    </table></div>
  </div>`;
}
function coServicesTable(co){
  const dm = co.serviceMarkup!=null?co.serviceMarkup:co.fixtureMarkup;
  const groups = co.services||[];
  if(groups.length===0){
    return `<div class="co-sub"><div class="co-sub-head"><span>Services</span>
      <button class="acc-add-btn no-print" onclick="addCOServiceGroup('${co.id}')">+ Add services group</button></div></div>`;
  }
  const body = groups.map((g,gi)=>{
    const units = serviceUnits(g.type||'ninja');
    const rowsHTML=(g.rows||[]).map((s,si)=>{
      const c=serviceCalc(s);
      const da=`data-co="${co.id}" data-cosvcg="${gi}" data-cosvcr="${si}"`;
      return `<tr>
        <td style="width:60px"><input class="num" value="${qtyVal(s.qty)}" placeholder="0" ${da} data-cosf="qty"></td>
        <td style="width:90px"><select ${da} data-cosf="unit">${units.map(u=>`<option ${s.unit===u?'selected':''}>${u}</option>`).join('')}</select></td>
        <td style="min-width:180px"><input value="${esc(s.desc)}" placeholder="Service" ${da} data-cosf="desc"></td>
        <td style="width:90px"><input class="num" value="${costVal(s.sellRate)}" placeholder="0.00" ${da} data-cosf="sellRate"></td>
        <td class="calc sell" style="width:96px">${money(c.extSell)}</td>
        <td style="width:30px" class="no-print"><button class="rowdel" onclick="delCOService('${co.id}',${gi},${si})">✕</button></td>
      </tr>`;
    }).join('');
    return `<tr class="co-svcgrp"><td colspan="6"><input value="${esc(g.name)}" data-co="${co.id}" data-cosvcgname="${gi}" class="co-svcname"> <button class="rowdel no-print" onclick="delCOServiceGroup('${co.id}',${gi})">✕</button></td></tr>
      ${rowsHTML}
      <tr class="no-print"><td colspan="6"><button class="acc-add-btn" onclick="addCOService('${co.id}',${gi})">+ Add service line</button></td></tr>`;
  }).join('');
  return `<div class="co-sub"><div class="co-sub-head"><span>Services</span>
      <button class="acc-add-btn no-print" onclick="addCOServiceGroup('${co.id}')">+ Add services group</button></div>
    <div class="table-scroll"><table>
      <thead><tr><th class="r">Qty</th><th>Unit</th><th>Description</th><th class="r">Sell rate</th><th class="r">Ext. sell</th><th class="no-print"></th></tr></thead>
      <tbody>${body}</tbody></table></div></div>`;
}

/* ---- Change order actions ---- */
function findCO(coId){
  for(const o of state.options){ const co=(o.changeOrders||[]).find(c=>c.id===coId); if(co) return {opt:o, co}; }
  return null;
}
function approveOption(){ const o=state.options[state.current]; o.approved = true; markDirty(); render(); toast('Option approved & locked — delete still works; add scope via a Change Order'); }
function unapproveOption(){ state.options[state.current].approved = false; markDirty(); render(); toast('Option unapproved — editing re-enabled'); }
/* Guard: when an approved option's base is locked, confirm before allowing a base edit.
   Returns true if the edit may proceed. */
/* Approved options are fully locked for editing (the only changes allowed are
   deletions, and Change Orders). */
function baseEditAllowed(){
  const o = state.options[state.current];
  return !(o && o.approved);
}
function addChangeOrder(){
  const opt = state.options[state.current];
  if(!opt.changeOrders) opt.changeOrders=[];
  const num = opt.changeOrders.length+1;
  opt.changeOrders.push(blankChangeOrder(num, opt));
  markDirty(); render();
}
function delChangeOrder(coId){
  const f=findCO(coId); if(!f) return;
  f.opt.changeOrders = f.opt.changeOrders.filter(c=>c.id!==coId);
  renumberCOs(f.opt);
  markDirty(); render();
}
function dupChangeOrder(coId){
  const f=findCO(coId); if(!f) return;
  const copy = JSON.parse(JSON.stringify(f.co));
  copy.id = uid();
  ['fixtures','controls'].forEach(k=>(copy[k]||[]).forEach(r=>{ r.id=uid(); if(r.accessories)r.accessories.forEach(a=>a.id=uid()); if(r.pieces)r.pieces.forEach(pc=>pc.id=uid()); }));
  (copy.services||[]).forEach(g=>{ g.id=uid(); (g.rows||[]).forEach(s=>s.id=uid()); });
  copy.name = f.co.name + " (copy)";
  const idx = f.opt.changeOrders.indexOf(f.co);
  f.opt.changeOrders.splice(idx+1, 0, copy);
  renumberCOs(f.opt);
  markDirty(); render(); toast('Change order duplicated');
}
function moveCO(coId, dir){
  const f=findCO(coId); if(!f) return;
  const arr = f.opt.changeOrders;
  const i = arr.indexOf(f.co);
  const j = i+dir;
  if(j<0 || j>=arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  renumberCOs(f.opt);
  markDirty(); render();
}
/* keep CO numbers sequential after add/delete/reorder */
function renumberCOs(opt){ (opt.changeOrders||[]).forEach((co,i)=>{ co.number = i+1; }); }
function setCOField(coId,k,v){ const f=findCO(coId); if(f){ f.co[k]=v; markDirty(); render(); } }
function addCORow(coId,kind){ const f=findCO(coId); if(f){ f.co[kind].push(blankRow()); markDirty(); render(); } }
function delCORow(coId,kind,i){ const f=findCO(coId); if(f){ f.co[kind].splice(i,1); markDirty(); render(); } }
function addCOServiceGroup(coId){ const f=findCO(coId); if(f){ if(!f.co.services)f.co.services=[]; f.co.services.push({id:uid(),name:'Services',rows:[blankService()]}); markDirty(); render(); } }
function delCOServiceGroup(coId,gi){ const f=findCO(coId); if(f){ f.co.services.splice(gi,1); markDirty(); render(); } }
function addCOService(coId,gi){ const f=findCO(coId); if(f){ f.co.services[gi].rows.push(blankService()); markDirty(); render(); } }
function delCOService(coId,gi,si){ const f=findCO(coId); if(f){ f.co.services[gi].rows.splice(si,1); markDirty(); render(); } }

/* "FOR ACCESS:" recap table (QUOTED / COST), modeled on BOM template F106:H111.
   Read-only recap — allowance & freight are edited in their section footers. */
function forAccessTable(opt, t){
  const fixturesDimQuoted = t.f.sell + t.c.sell + t.af.allowSell + t.af.freightSell + t.af.ctrlAllowSell;
  const fixturesDimCost   = t.f.cost + t.c.cost + t.af.allowCost + t.af.freightCost + t.af.ctrlAllowCost;
  /* Note: template groups allowance & freight as their own recap lines, equipment stays separate */
  const rows = [
    {label:"Fixtures &amp; Dimming", quoted:t.f.sell + t.c.sell, cost:t.f.cost + t.c.cost},
    {label:"Allowance", quoted:t.af.allowSell + t.af.ctrlAllowSell, cost:t.af.allowCost + t.af.ctrlAllowCost},
    {label:"Freight", quoted:t.af.freightSell, cost:t.af.freightCost},
    {label:"Services", quoted:t.s.sell, cost:t.s.cost},
  ];
  const totQuoted = rows.reduce((a,r)=>a+r.quoted,0);
  const totCost   = rows.reduce((a,r)=>a+r.cost,0);
  const body = rows.map(r=>`
    <tr>
      <td class="fa-lbl">${r.label}</td>
      <td class="fa-num quoted">${money(r.quoted)}</td>
      <td class="fa-num cost">${money(r.cost)}</td>
    </tr>`).join("");
  return `<div class="section foraccess">
    <div class="sec-head">
      <span class="tick fa"></span><h2>For Access:</h2>
      <span class="fa-note no-print">Edit allowance &amp; freight in the section footers above</span>
    </div>
    <table class="fa-table">
      <thead><tr><th></th><th class="r">Quoted</th><th class="r">Cost</th></tr></thead>
      <tbody>${body}
        <tr class="fa-total"><td>TOTAL</td><td class="fa-num quoted">${money(totQuoted)}</td><td class="fa-num cost">${money(totCost)}</td></tr>
      </tbody>
    </table>
  </div>`;
}

let cmpOpen = true;
function toggleCmp(){ cmpOpen=!cmpOpen; renderCompare(); }

function renderCompare(){
  const el = document.getElementById("compare");
  if(state.options.length < 2){ el.innerHTML=""; return; }

  const tots = state.options.map(o=>optionTotals(o));
  const grands = tots.map(t=>t.grand);
  const maxGrand = Math.max(...grands);
  const minGrand = Math.min(...grands);
  const minIdx = grands.indexOf(minGrand);
  const maxIdx = grands.indexOf(maxGrand);

  /* ---- option accent colours (cycle through a palette) ---- */
  const PALETTES = [
    {bar:"#C77B1F",light:"#FBF3E4"},
    {bar:"#2E6B4F",light:"#EDF5F0"},
    {bar:"#3A5FA0",light:"#EDF2FB"},
    {bar:"#7B3F9E",light:"#F5EEF9"},
    {bar:"#A3372E",light:"#FBF0EF"},
    {bar:"#4A7A6B",light:"#EEF5F3"},
  ];

  /* ---- cards ---- */
  const cards = state.options.map((o,i)=>{
    const t = tots[i];
    const pal = PALETTES[i % PALETTES.length];
    const isActive = i === state.current;
    const isCheapest = i === minIdx && maxGrand !== minGrand;
    const isPriciest = i === maxIdx && maxGrand !== minGrand;
    const savings = maxGrand - t.grand;
    const premium = t.grand - minGrand;

    /* bar widths: proportion of total sell */
    const barTotal = t.f.sell + t.c.sell || 1;
    const fxPct = (t.f.sell / barTotal * 100).toFixed(1);
    const ctlPct = (t.c.sell / barTotal * 100).toFixed(1);

    /* badges */
    let badge = "";
    if(isActive) badge += `<span class="cmp-card-badge badge-active">Viewing</span>`;
    else if(isCheapest) badge += `<span class="cmp-card-badge badge-cheapest">Lowest</span>`;
    else if(isPriciest) badge += `<span class="cmp-card-badge badge-priciest">Highest</span>`;

    const savingsTag = isCheapest ? "" :
      `<div class="${isPriciest?'cmp-premium':'cmp-savings'}">${isPriciest?'▲':'▼'} ${money(Math.abs(isPriciest?premium:savings))} vs ${isPriciest?'cheapest':'highest'}</div>`;

    const margin = t.sub>0 ? ((t.sub-t.cost)/t.sub*100).toFixed(1) : "0.0";

    return `<div class="cmp-card${isActive?' active':''}${isCheapest&&!isActive?' cheapest':''}" onclick="selectOption(${i})">
      ${badge}
      <div class="cmp-card-name">${esc(o.name)}</div>
      <div class="cmp-bar-wrap">
        <div class="cmp-bar-track">
          <div class="cmp-bar-fx" style="width:${fxPct}%;background:${pal.bar}"></div>
          <div class="cmp-bar-ctl" style="width:${ctlPct}%"></div>
        </div>
        <div class="cmp-bar-legend">
          <span class="leg-fx" style="--c:${pal.bar}">
            <span style="display:inline-block;width:8px;height:8px;border-radius:1px;background:${pal.bar};margin-right:3px"></span>Fixtures
          </span>
          <span class="leg-ctl">
            <span style="display:inline-block;width:8px;height:8px;border-radius:1px;background:var(--ink);margin-right:3px"></span>Controls
          </span>
        </div>
      </div>
      <div class="cmp-row"><span class="rl">Fixtures sell</span><span class="rv">${money(t.f.sell)}</span></div>
      <div class="cmp-row"><span class="rl">Controls sell</span><span class="rv">${money(t.c.sell)}</span></div>
      <div class="cmp-row"><span class="rl">Subtotal</span><span class="rv">${money(t.sub)}</span></div>
      <div class="cmp-row"><span class="rl">Tax (${state.taxRate}%)</span><span class="rv">${money(t.tax)}</span></div>
      <div class="cmp-row"><span class="rl">Your cost</span><span class="rv" style="color:var(--ink-soft)">${money(t.cost)}</span></div>
      <div class="cmp-row"><span class="rl">Margin</span><span class="rv" style="color:var(--ink-soft)">${margin}%</span></div>
      <div class="cmp-row grand-row${isCheapest?' cheapest-row':''}">
        <span class="rl">Total with tax</span><span class="rv">${money(t.grand)}</span>
      </div>
      ${savingsTag}
      <button class="cmp-card-goto no-print" onclick="event.stopPropagation();selectOption(${i})">View option →</button>
    </div>`;
  }).join("");

  /* ---- detail table ---- */
  const anyCO = state.options.some(o=>(o.changeOrders||[]).length);
  function detailRow(label, fn, opts){
    opts = opts || {};
    const vals = tots.map(fn);
    const minV = Math.min(...vals);
    const curV = vals[state.current];
    const cells = vals.map((v,i)=>{
      const low = v===minV && Math.max(...vals)!==minV && opts.highlightLow;
      const delta = v - curV;
      const deltaTxt = (opts.showDelta && i!==state.current && delta!==0)
        ? `<span class="cmp-delta ${delta>0?'up':'down'}">${delta>0?'+':'−'}${money(Math.abs(delta))}</span>` : '';
      return `<td style="text-align:right" class="${low?'low':''}">${money(v)}${deltaTxt}</td>`;
    }).join("");
    if(opts.sect) return `<tr class="sect-head"><td colspan="${1+tots.length}">${label}</td></tr>`;
    if(opts.grand) return `<tr class="grand-tr"><td>${label}</td>${cells}</tr>`;
    return `<tr class="${opts.muted?'cmp-muted-row':''}"><td>${label}</td>${cells}</tr>`;
  }

  const thCols = state.options.map((o,i)=>`<th style="text-align:right">${esc(o.name)}${i===state.current?`<span class="cmp-cur-marker">●</span>`:''}</th>`).join("");

  const detailRows = [
    detailRow("Fixtures", t=>t.f.sell, {}),
    detailRow("Controls", t=>t.c.sell, {}),
    anyCO ? detailRow("Approved base subtotal", t=>t.baseSub, {muted:true}) : '',
    anyCO ? detailRow("Change orders", t=>t.coSellTotal, {muted:true, showDelta:true}) : '',
    detailRow("Subtotal", t=>t.sub, {}),
    detailRow(`Tax (${state.taxRate}%)`, t=>t.tax, {}),
    detailRow("Your cost", t=>t.cost, {muted:true}),
    detailRow("Total with tax", t=>t.grand, {grand:true, highlightLow:true, showDelta:true}),
  ].join("");

  const openClass = cmpOpen ? "open" : "";

  el.innerHTML = `
    <button class="cmp-toggle ${openClass} no-print" onclick="toggleCmp()">
      <span class="cmp-toggle-bar"></span>
      <span class="cmp-toggle-label">
        Option comparison (${state.options.length})
        <span class="caret">▼</span>
      </span>
      <span class="cmp-toggle-bar"></span>
    </button>
    <div class="cmp-body" style="display:${cmpOpen?'block':'none'}">
      <div class="cmp-cards">${cards}</div>
      <div class="cmp-detail">
        <table>
          <thead><tr><th></th>${thCols}</tr></thead>
          <tbody>${detailRows}</tbody>
        </table>
      </div>
      <div class="cmp-detail-head no-print">
        <button class="ghost" onclick="openCompareDiff()" title="Pick options and see which line items differ between them">⇄ Compare line-item differences…</button>
      </div>
    </div>`;
}

/* ================= Compare options: line-item differences ================= */
let _cmpSel = null;                 // Set of option indices chosen for the diff
let _cmpDiffOnly = true;            // show only rows that differ
function diffKey(r){
  const t=(r.type||'').toUpperCase().trim(), p=(r.part||'').toUpperCase().trim(), d=(r.desc||'').toUpperCase().trim();
  return (t||p) ? (t+'∥'+p) : ('DESC∥'+d);
}
function buildDiffModel(selIdx){
  /* map key -> { label, kind, per:{optIdx:{qty,extSell}} } */
  const map = new Map();
  selIdx.forEach(oi=>{
    const o = state.options[oi];
    [['fixtures',o.fixtureMarkup],['controls',o.controlMarkup]].forEach(([kind,dm])=>{
      (o[kind]||[]).forEach(r=>{
        if(r.isSection) return;
        const key = kind+'::'+diffKey(r);
        let e = map.get(key);
        if(!e){ e = {label:{type:r.type||'',mfr:r.mfr||'',part:r.part||'',desc:r.desc||''}, kind, per:{}}; map.set(key,e); }
        const c = rowCalc(r, dm);
        const cur = e.per[oi] || {qty:0, extSell:0};
        cur.qty += numOr(r.qty,0); cur.extSell += c.extSell;
        e.per[oi] = cur;
      });
    });
  });
  return map;
}
function openCompareDiff(){
  if(state.options.length<2){ toast('Add a second option to compare'); return; }
  if(!_cmpSel || ![..._cmpSel].some(i=>i<state.options.length)) _cmpSel = new Set(state.options.map((_,i)=>i));

  const optPicker = state.options.map((o,i)=>
    `<label class="cmp-pick"><input type="checkbox" class="cmpopt" value="${i}" ${_cmpSel.has(i)?'checked':''}> ${esc(o.name)}</label>`).join('');

  const body = `
    <p class="paste-help">Choose the options to compare. The table lists every fixture &amp; control, matched across options by <b>Type</b> + <b>Part #</b>, and highlights where quantity or extended sell differs.</p>
    <div class="cmp-pick-row">${optPicker}</div>
    <label class="cmp-diffonly"><input type="checkbox" id="cmpDiffOnly" ${_cmpDiffOnly?'checked':''}> Show only differences</label>
    <div id="cmpDiffWrap" class="cmp-diff-wrap"></div>`;

  openModal({
    title:'Compare options', bodyHTML:body, wide:true, xwide:true, cancelLabel:'Close',
    onOpen(back){
      const wrap = back.querySelector('#cmpDiffWrap');
      const draw = ()=>{
        _cmpSel = new Set(Array.prototype.filter.call(back.querySelectorAll('.cmpopt'), c=>c.checked).map(c=>+c.value));
        _cmpDiffOnly = back.querySelector('#cmpDiffOnly').checked;
        wrap.innerHTML = renderDiffTable([..._cmpSel].sort((a,b)=>a-b));
      };
      back.querySelectorAll('.cmpopt').forEach(c=>c.addEventListener('change', draw));
      back.querySelector('#cmpDiffOnly').addEventListener('change', draw);
      draw();
    }
  });
}
function renderDiffTable(selIdx){
  if(selIdx.length<2) return `<div class="lib-empty">Select at least two options to compare.</div>`;
  const map = buildDiffModel(selIdx);
  const names = selIdx.map(i=>state.options[i].name);
  const rows = [];
  let diffCount = 0;
  for(const [,e] of map){
    const vals = selIdx.map(oi=> e.per[oi] || null);
    const sells = vals.map(v=> v? v.extSell : null);
    const present = vals.map(v=> !!v);
    const sellSet = new Set(sells.map(s=> s===null?'∅':Math.round(s)));
    const qtySet = new Set(vals.map(v=> v? v.qty : '∅'));
    const differs = sellSet.size>1 || qtySet.size>1 || present.some(p=>!p);
    if(differs) diffCount++;
    if(_cmpDiffOnly && !differs) continue;
    const lbl = e.label;
    const cells = vals.map(v=>{
      if(!v) return `<td class="diff-missing">—</td>`;
      return `<td class="${differs?'diff-cell':''}"><span class="diff-qty">${v.qty}×</span> ${money(v.extSell)}</td>`;
    }).join('');
    rows.push(`<tr class="${differs?'is-diff':''}">
      <td class="diff-item"><span class="diff-cat">${e.kind==='controls'?'Ctrl':'Fix'}</span>
        <b>${esc(lbl.type||'—')}</b> ${esc(lbl.mfr||'')} ${lbl.part?`<span class="mono">${esc(lbl.part)}</span>`:''}
        <span class="diff-desc">${esc(lbl.desc||'')}</span></td>
      ${cells}</tr>`);
  }
  /* totals row */
  const totals = selIdx.map(oi=>{ let s=0; for(const [,e] of map){ if(e.per[oi]) s+=e.per[oi].extSell; } return s; });
  const maxT = Math.max(...totals), minT = Math.min(...totals);
  const totRow = `<tr class="diff-total"><td>Total (fixtures + controls sell)</td>${
    totals.map(s=>`<td class="${s===minT&&maxT!==minT?'low':''}${s===maxT&&maxT!==minT?' high':''}">${money(s)}</td>`).join('')}</tr>`;

  const head = `<tr><th>Line item</th>${names.map(n=>`<th>${esc(n)}</th>`).join('')}</tr>`;
  const note = _cmpDiffOnly
    ? `<div class="diff-note">${diffCount} line${diffCount===1?'':'s'} differ between the selected options${rows.length?'':' — none to show'}.</div>`
    : `<div class="diff-note">${diffCount} of ${map.size} line${map.size===1?'':'s'} differ.</div>`;
  if(!rows.length && _cmpDiffOnly) return note + `<div class="lib-empty">These options have identical fixtures &amp; controls.</div>`;
  return note + `<table class="diff-table"><thead>${head}</thead><tbody>${rows.join('')}${totRow}</tbody></table>`;
}

/* ================= Event binding (delegated per render) ================= */
/* Pane editing uses event delegation: instead of attaching listeners to every
   input on each render (O(rows) work + memory that churned on every keystroke
   commit), we attach three listeners ONCE to the stable #pane element. The pane's
   innerHTML is replaced each render, but #pane itself persists, so these delegated
   handlers keep working without re-binding. */
let _paneDelegated = false;
function bindPane(){
  const pane = document.getElementById("pane");
  if(!_paneDelegated){
    pane.addEventListener("change", onPaneChange);
    pane.addEventListener("focusin", e=>{ const t=e.target; if(t && 'value' in t) t._focusVal = t.value; });
    pane.addEventListener("keydown", onPaneKeydown);
    pane.addEventListener("mouseover", onPaneLinkHover);
    pane.addEventListener("mouseleave", ()=>onPaneLinkHover({target:pane}));
    _paneDelegated = true;
  }
  bindTableInteractions(pane);
}

/* Hovering any fixture in a link group lights up every member of that group, so
   it's immediately clear which lines are linked together (and to which master). */
let _hlLink = null;
function onPaneLinkHover(e){
  const t = e.target;
  const tr = (t && t.closest) ? t.closest('tr[data-link]') : null;
  const id = tr ? tr.getAttribute('data-link') : null;
  if(id === _hlLink) return;
  const pane = document.getElementById('pane'); if(!pane) return;
  pane.querySelectorAll('tr.link-hl').forEach(x=>x.classList.remove('link-hl'));
  _hlLink = id;
  if(id) pane.querySelectorAll('tr[data-link="'+id+'"]').forEach(x=>x.classList.add('link-hl'));
}

/* Delegated change dispatcher — routes to the right state mutation by the data-*
   attribute on the edited control. Mirrors the per-field handlers exactly. */
function onPaneChange(e){
  const el = e.target; if(!el || !el.dataset) return;
  const d = el.dataset;

  /* fixture / control rows + their accessories (and section name) */
  if(d.k!==undefined){
    const {k,i,f,ai} = d;
    if(!baseEditAllowed()){               // approved & locked — inputs are disabled, but guard anyway
      el.value = el._focusVal!==undefined ? el._focusVal : '';
      toast('This option is approved & locked — Unapprove it to edit');
      return;
    }
    const arr = state.options[state.current][k];
    const row = arr[i];
    const val = el.value;
    if(f==="sectionname"){ row.name = val || "Section"; markDirty(); render(); return; }
    if(ai!==undefined){
      const a = row.accessories[ai];
      if(f==="accqty")        a.qty = val.trim()===""? null : Math.max(0,numOr(val,0));
      else if(f==="accunitCost") a.unitCost = numOr(val,0);
      else if(f==="accmfrMult") a.mfrMult = numOr(val,1);
      else if(f==="accdesc"){ a.desc = val; rememberValue('desc', val); }
      else if(f==="accpart")  a.part = val;
      else if(f==="accmfr"){  a.mfr = val; rememberValue('mfr', val); }
      else if(f==="accnote")  a.note = val;
      else if(f==="accsource") a.source = val;
      else if(f==="accmarkup") a.markup = parseMarkup(val);
      markDirty(); render(); return;
    }
    if(f==="qty")     row.qty = Math.max(0, numOr(val,0));
    else if(f==="unitCost"){ row.unitCost = numOr(val,0);
      if(row.linkId && row.linkMaster) linkMembers(row.linkId).forEach(x=>{ x.r.unitCost = row.unitCost; }); }
    else if(f==="mfrMult")  row.mfrMult = numOr(val,1);
    else if(f==="markup")   row.markup = parseMarkup(val);
    else if(f==="note")     row.note = val;
    else if(f==="source")   row.source = val;
    else if(f==="type"){    row.type = val.toUpperCase(); rememberValue('type', row.type); }
    else if(f==="mfr"){     row.mfr = val; rememberValue('mfr', val); }
    else if(f==="desc"){    row.desc = val; rememberValue('desc', val); }
    else if(f==="tag"){     row.tag = val; rememberTag(val); }
    else row[f] = val;
    markDirty(); render();
    return;
  }

  /* section default markup */
  if(d.secmk!==undefined){
    const v = parseMarkup(el.value); if(v===null) return;
    state.options[state.current][d.secmk==="fixtures"?"fixtureMarkup":"controlMarkup"] = v;
    markDirty(); render(); return;
  }

  /* services (rows, units, and add-ons) */
  if(d.svcG!==undefined){
    const gi=+d.svcG, si=+d.svcR, f=d.f, ai=d.svcA;
    const s = state.options[state.current].services[gi].rows[si];
    const val = el.value;
    if(ai!==undefined){
      const a = s.addons[+ai];
      if(f==="addonqty") a.qty = val.trim()===""? null : Math.max(0,numOr(val,0));
      else if(f==="addonsellRate") a.sellRate = numOr(val,0);
      else if(f==="addondesc") a.desc = val;
      else if(f==="addonsource") a.source = val;
      else if(f==="addonnote") a.note = val;
      markDirty(); render(); return;
    }
    if(f==="qty") s.qty = Math.max(0,numOr(val,0));
    else if(f==="sellRate") s.sellRate = numOr(val,0);
    else if(f==="unit"){ s.unit = val; }
    else s[f] = val;
    markDirty(); render(); return;
  }
  if(d.svcGname!==undefined){
    state.options[state.current].services[+d.svcGname].name = el.value||"Services"; markDirty(); render(); return;
  }

  /* For Access allowance / freight percentages and manual overrides */
  if(d.fapct!==undefined){
    state.options[state.current][d.fapct] = Math.max(0, numOr(el.value,0)); markDirty(); render(); return;
  }
  if(d.afov!==undefined){
    const v = el.value.trim();
    state.options[state.current][d.afov] = (v===''? null : Math.max(0, numOr(v,0))); markDirty(); render(); return;
  }

  if(d.optname!==undefined){ state.options[state.current].name = el.value || "Option"; markDirty(); render(); return; }
  if(d.stamptax!==undefined){ state.taxRate = numOr(el.value,0); markDirty(); render(); return; }

  /* change orders */
  if(d.cofield!==undefined){ setCOField(d.co, d.cofield, el.value); return; }
  if(d.cof!==undefined){
    const f=findCO(d.co); if(!f) return;
    const row=f.co[d.cok][+d.coi];
    const field=d.cof, val=el.value;
    if(field==='qty') row.qty=Math.max(0,numOr(val,0));
    else if(field==='unitCost') row.unitCost=numOr(val,0);
    else if(field==='markup') row.markup=parseMarkup(val);
    else if(field==='type') row.type=val.toUpperCase();
    else row[field]=val;
    markDirty(); render(); return;
  }
  if(d.cosf!==undefined){
    const f=findCO(d.co); if(!f) return;
    const s=f.co.services[+d.cosvcg].rows[+d.cosvcr];
    const field=d.cosf, val=el.value;
    if(field==='qty') s.qty=Math.max(0,numOr(val,0));
    else if(field==='sellRate') s.sellRate=numOr(val,0);
    else s[field]=val;
    markDirty(); render(); return;
  }
  if(d.cosvcgname!==undefined){
    const f=findCO(d.co); if(f){ f.co.services[+d.cosvcgname].name=el.value||'Services'; markDirty(); render(); }
    return;
  }
}

/* Delegated keydown — Enter adds a row at the end of a section; Tab moves focus
   across the re-render. Only applies to the fixture/control row inputs (data-k). */
function onPaneKeydown(e){
  const el = e.target; if(!el || el.dataset.k===undefined) return;
  if(e.key==="Enter"){
    if(el.tagName==="TEXTAREA"){ if(e.shiftKey) return; e.preventDefault(); }   // keep wrap fields single-logical-line
    const {k,i,ai} = el.dataset;
    const arr = state.options[state.current][k];
    if(ai===undefined && parseInt(i)===arr.length-1 && !arr[i].isSection){ el.blur(); addRow(k); }
    else el.blur();
  } else if(e.key==="Tab"){
    /* If the value is unchanged, no re-render will fire — let the browser handle
       Tab natively. Only manage focus across the re-render when an edit occurred. */
    if(el.value === el._focusVal) return;
    const fields = paneTabbables();
    const idx = fields.indexOf(el);
    if(idx!==-1){
      const nextIdx = e.shiftKey ? idx-1 : idx+1;
      if(nextIdx>=0 && nextIdx<fields.length){
        e.preventDefault();
        _pendingTabIndex = nextIdx;
        el.blur();   // fires change -> render -> restores focus to _pendingTabIndex
      }
    }
  }
}

/* ===== Drag-to-resize columns + drag rows between/within sections ===== */
let _dragSrc = null;   // {kind, i} of the row being dragged
function bindTableInteractions(pane){
  /* Column resize: a thin handle on each header cell's right edge. */
  pane.querySelectorAll('.section thead th').forEach(th=>{
    const grip = document.createElement('span');
    grip.className = 'col-resizer no-print';
    th.appendChild(grip);
    grip.addEventListener('mousedown', e=>{
      e.preventDefault(); e.stopPropagation();
      const table = th.closest('table');
      const cg = table.querySelector('colgroup');
      const idx = Array.prototype.indexOf.call(th.parentNode.children, th);
      const colEl = cg && cg.children[idx];
      if(!colEl) return;
      const startX = e.clientX, startW = colEl.getBoundingClientRect().width;
      const move = ev=>{ const w = Math.max(36, Math.round(startW + (ev.clientX - startX))); colEl.style.width = w+'px'; };
      const up = ()=>{
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        const key = colEl.getAttribute('data-col');
        if(key){ colWidths[key] = Math.round(colEl.getBoundingClientRect().width); saveColWidths(); }
        render();   // re-render so a resized text column switches to its fixed width
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });
  });

  /* Row drag-and-drop (grip = drag source; rows & section dividers = drop targets). */
  pane.querySelectorAll('.drag-grip').forEach(grip=>{
    grip.addEventListener('dragstart', e=>{
      const tr = grip.closest('tr');
      _dragSrc = { kind: tr.dataset.rk, i: +tr.dataset.ri };
      try{ e.dataTransfer.setData('text/plain', String(_dragSrc.i)); e.dataTransfer.effectAllowed='move'; }catch(_){}
      tr.classList.add('dragging');
    });
    grip.addEventListener('dragend', ()=>{ const tr=grip.closest('tr'); if(tr) tr.classList.remove('dragging'); _dragSrc=null; });
  });
  pane.querySelectorAll('tr[data-ri], tr[data-sec]').forEach(tr=>{
    tr.addEventListener('dragover', e=>{
      if(!_dragSrc || tr.dataset.rk!==_dragSrc.kind) return;
      e.preventDefault(); tr.classList.add('drag-over');
    });
    tr.addEventListener('dragleave', ()=> tr.classList.remove('drag-over'));
    tr.addEventListener('drop', e=>{
      tr.classList.remove('drag-over');
      if(!_dragSrc || tr.dataset.rk!==_dragSrc.kind) return;
      e.preventDefault();
      const from = _dragSrc.i;
      const to = (tr.dataset.sec!==undefined) ? (+tr.dataset.sec + 1) : (+tr.dataset.ri);
      _dragSrc = null;
      moveRow(tr.dataset.rk, from, to);
    });
  });
}

/* ================= Row / option actions ================= */
function addRow(kind){ state.options[state.current][kind].push(blankRow()); markDirty(); render();
  /* focus first cell of new row */
  const rows = document.querySelectorAll(`#pane input[data-k="${kind}"][data-f="qty"]`);
  if(rows.length) rows[rows.length-1].focus();
}
function delRow(kind,i){ state.options[state.current][kind].splice(i,1); markDirty(); render(); }
/* Move a row from index `from` to index `to` within a kind's array (drag-and-drop). */
function moveRow(kind, from, to){
  const arr = state.options[state.current][kind];
  if(from<0 || from>=arr.length || arr[from].isSection) return;
  const [item] = arr.splice(from,1);
  if(to>from) to--;                       // account for the removed element
  to = Math.max(0, Math.min(arr.length, to));
  arr.splice(to, 0, item);
  markDirty(); render();
}
function addSection(kind){
  const arr = state.options[state.current][kind];
  const n = arr.filter(r=>r.isSection).length + 1;
  arr.push(sectionRow("Section "+n));
  arr.push(blankRow());           // new section starts with one empty fixture line
  markDirty(); render();
}
/* Insert a new fixture as the LAST row of the section whose divider is at secIdx. */
function addRowToSection(kind, secIdx){
  const arr = state.options[state.current][kind];
  let end = arr.length;
  for(let j=secIdx+1; j<arr.length; j++){ if(arr[j].isSection){ end = j; break; } }
  arr.splice(end, 0, blankRow());
  markDirty(); render();
  const el = document.querySelector(`#pane input[data-k="${kind}"][data-i="${end}"][data-f="qty"]`);
  if(el) el.focus();
}
function addAccessory(kind, i, presetIdx){
  const row = state.options[state.current][kind][i];
  if(!row.accessories) row.accessories = [];
  row.accessories.push(blankAccessory(ACCESSORY_PRESETS[presetIdx]));
  accExpanded.add(row.id);   // keep the accessory group open after adding
  closeAccMenus(); markDirty(); render();
}
function delAccessory(kind, i, ai){
  state.options[state.current][kind][i].accessories.splice(ai,1);
  markDirty(); render();
}
function toggleAccMenu(key){
  const el = document.getElementById('accmenu_'+key);
  const open = el && el.style.display!=='none';
  closeAccMenus();
  if(el && !open) el.style.display='block';
}
function closeAccMenus(){ document.querySelectorAll('.acc-menu-list').forEach(m=>m.style.display='none'); }
document.addEventListener('click', e=>{ if(!e.target.closest('.acc-menu')) closeAccMenus(); });

/* ---- Services actions ---- */
function ensureServices(){ const o=state.options[state.current]; if(!o.services) o.services=[]; return o.services; }
function addServiceGroup(){ ensureServices().push({id:uid(), name:"Services", type:"ninja", rows:[blankService()]}); markDirty(); render(); }
function delServiceGroup(gi){ ensureServices().splice(gi,1); markDirty(); render(); }
function addService(gi){ ensureServices()[gi].rows.push(blankService()); markDirty(); render(); }
function delService(gi,si){ ensureServices()[gi].rows.splice(si,1); markDirty(); render(); }
function dupService(gi,si){
  const rows = ensureServices()[gi].rows;
  if(!rows[si]) return;
  const copy = JSON.parse(JSON.stringify(rows[si])); copy.id = uid();
  (copy.addons||[]).forEach(a=>a.id=uid());
  rows.splice(si+1, 0, copy); markDirty(); render();
}
/* Service line add-ons (accessory-style, on Days/Trips lines) */
function addServiceAddon(gi, si, presetIdx){
  const s = ensureServices()[gi].rows[si]; if(!s) return;
  if(!s.addons) s.addons = [];
  const presets = addonsForUnit(s.unit) || [];
  s.addons.push(blankServiceAddon(presets[presetIdx]));
  closeAccMenus(); markDirty(); render();
}
function delServiceAddon(gi, si, ai){ const s=ensureServices()[gi].rows[si]; if(s&&s.addons){ s.addons.splice(ai,1); markDirty(); render(); } }

/* ---- Duplicate a single fixture/control row (with fresh ids) ---- */
function dupRow(kind, i){
  if(!guardBaseEdit()) return;
  const arr = state.options[state.current][kind];
  const src = arr[i];
  if(!src || src.isSection) return;
  const copy = JSON.parse(JSON.stringify(src));
  copy.id = uid();
  delete copy.linkId; delete copy.linkMaster;   // a duplicate isn't auto-linked
  if(copy.accessories) copy.accessories.forEach(a=>a.id=uid());
  if(copy.pieces) copy.pieces.forEach(pc=>pc.id=uid());
  arr.splice(i+1, 0, copy);
  markDirty(); render();
}

/* ================= Linked fixtures (shared unit cost) =================
   A link group shares one unit cost. The "master" owns the editable cost;
   linked rows mirror it (their cost field is read-only). Linking is manual. */
let _linkPick = null;             // linkId currently being assembled, or null
function fixturesArr(){ return state.options[state.current].fixtures; }
function linkMembers(linkId){ return fixturesArr().map((r,idx)=>({r,idx})).filter(x=>!x.r.isSection && x.r.linkId===linkId); }
function masterOf(linkId){ const m=linkMembers(linkId).find(x=>x.r.linkMaster); return m?m.r:null; }
function linkAction(kind, i){
  if(kind!=='fixtures'){ toast('Linking is available for fixtures'); return; }
  const arr = fixturesArr(); const row = arr[i];
  if(!row || row.isSection) return;
  if(_linkPick){
    const master = masterOf(_linkPick);
    if(!master){ _linkPick=null; render(); return; }
    if(row.linkId===_linkPick){
      if(row.linkMaster){ finishLink(); return; }   // clicking the master finishes
      unlinkRow(i); return;                          // clicking a member unlinks it
    }
    row.linkId = _linkPick; row.linkMaster = false; row.unitCost = master.unitCost;
    markDirty(); render(); toast('🔗 '+(row.type||'fixture')+' linked → shares master '+(master.type||'')+' unit cost');
    return;
  }
  if(row.linkId){ unlinkRow(i); return; }
  row.linkId = 'lnk'+(_idSeed++).toString(36); row.linkMaster = true; _linkPick = row.linkId;
  markDirty(); render();
  toast('★ '+(row.type||'This fixture')+' is now the MASTER. Click the link icon on other fixtures to link them as shared-cost copies; click the master again to finish.');
}
function finishLink(){
  const id = _linkPick; _linkPick = null;
  if(id){ const mem = linkMembers(id); if(mem.length<2) mem.forEach(x=>{ delete x.r.linkId; delete x.r.linkMaster; }); }
  markDirty(); render(); toast('Done linking');
}
function unlinkRow(i){
  const arr = fixturesArr(); const row = arr[i]; const id = row.linkId; const wasMaster = !!row.linkMaster;
  delete row.linkId; delete row.linkMaster;
  const mem = linkMembers(id);
  if(wasMaster && mem.length) mem[0].r.linkMaster = true;            // promote a remaining member
  if(mem.length<2) mem.forEach(x=>{ delete x.r.linkId; delete x.r.linkMaster; });  // dissolve singletons
  if(_linkPick===id && (!mem.length)) _linkPick=null;
  markDirty(); render(); toast('Unlinked');
}
/* Fix up link groups after load: ensure each group has exactly one master and ≥2 members. */
function sanitizeLinks(opt){
  const groups = {};
  (opt.fixtures||[]).forEach(r=>{ if(r && !r.isSection && r.linkId){ (groups[r.linkId]=groups[r.linkId]||[]).push(r); } });
  Object.keys(groups).forEach(id=>{
    const mem = groups[id];
    if(mem.length<2){ mem.forEach(r=>{ delete r.linkId; delete r.linkMaster; }); return; }
    const masters = mem.filter(r=>r.linkMaster);
    if(masters.length===0) mem[0].linkMaster = true;
    else if(masters.length>1){ masters.forEach((r,k)=>{ if(k>0) r.linkMaster=false; }); }
    const master = mem.find(r=>r.linkMaster);
    mem.forEach(r=>{ if(!r.linkMaster) r.unitCost = master.unitCost; });   // resync shared cost
  });
}

/* Guard inserts/edits into an approved (locked) option. Deletions bypass this. */
function guardBaseEdit(){
  if(baseEditAllowed()) return true;
  toast('This option is approved & locked — Unapprove it, or add a Change Order, to make changes');
  return false;
}

/* ================= Generic modal (paste / library) ================= */
let _modalEl = null;
function openModal(opts){
  closeModal();
  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  back.style.display = 'flex';
  back.innerHTML = `<div class="modal ${opts.wide?'modal-xwide':'modal-wide'}">
    <h4>${esc(opts.title)}</h4>
    <div class="modal-body">${opts.bodyHTML}</div>
    <div class="modal-btns">
      <button class="ghost" data-mclose>${esc(opts.cancelLabel||'Cancel')}</button>
      ${opts.confirmLabel?`<button class="${opts.confirmClass||'primary'}" data-mok>${esc(opts.confirmLabel)}</button>`:''}
    </div>
  </div>`;
  const doCancel = ()=>{ if(opts.onCancel) opts.onCancel(back); closeModal(); };
  back.addEventListener('click', e=>{ if(e.target===back) doCancel(); });
  back.querySelector('[data-mclose]').addEventListener('click', doCancel);
  const ok = back.querySelector('[data-mok]');
  if(ok && opts.onConfirm) ok.addEventListener('click', ()=>opts.onConfirm(back));
  document.body.appendChild(back);
  _modalEl = back;
  if(opts.onOpen) opts.onOpen(back);
  return back;
}
function closeModal(){ if(_modalEl){ _modalEl.remove(); _modalEl = null; } }

/* ================= Paste rows from a spreadsheet ================= */
const PASTE_FIELDS = ['qty','type','mfr','desc','part','unitCost','markup'];
const HEADER_SYNONYMS = {
  qty:['qty','quantity','count','qnty','ea'],
  type:['type','mark','fixturetype','symbol'],
  mfr:['mfr','manufacturer','make','vendor','brand','mfg'],
  desc:['desc','description','item','product','name','fixture'],
  part:['part','partno','partnumber','part#','catalog','catalognumber','model','sku','cat#','cat'],
  unitCost:['unitcost','cost','price','unitprice','net','buy','each','listprice','list'],
  markup:['markup','margin','markup%']
};
function _normHead(s){ return String(s).toLowerCase().replace(/[^a-z0-9#]/g,''); }
function detectHeaderMap(cells){
  const map = {}; let hits = 0;
  cells.forEach((c,idx)=>{
    const n = _normHead(c);
    for(const field in HEADER_SYNONYMS){
      if(HEADER_SYNONYMS[field].some(syn=>_normHead(syn)===n)){ map[idx]=field; hits++; break; }
    }
  });
  return hits>=2 ? map : null;   // need ≥2 recognizable headers to treat row 1 as headers
}
function splitCells(line){
  if(line.includes('\t')) return line.split('\t');
  if(line.includes(',')) return line.split(',');
  return line.split(/\s{2,}/);
}
function parsePasteText(text){
  const lines = String(text||'').replace(/\r/g,'').split('\n').filter(l=>l.trim()!=='');
  if(!lines.length) return [];
  const headerMap = detectHeaderMap(splitCells(lines[0]).map(c=>c.trim()));
  const dataLines = headerMap ? lines.slice(1) : lines;
  const out = [];
  dataLines.forEach(line=>{
    const cells = splitCells(line).map(c=>c.trim());
    if(cells.every(c=>c==='')) return;
    const row = blankRow();
    const assign = (field, raw)=>{
      if(raw===undefined || raw==='') return;
      if(field==='qty') row.qty = Math.max(0, numOr(raw,1));
      else if(field==='unitCost') row.unitCost = numOr(raw,0);
      else if(field==='markup') row.markup = parseMarkup(raw);
      else row[field] = raw;
    };
    cells.forEach((c,idx)=>{
      const field = headerMap ? headerMap[idx] : PASTE_FIELDS[idx];
      if(field) assign(field, c);
    });
    out.push(row);
  });
  return out;
}
function openPasteModal(kind){
  const kindLabel = kind==='fixtures' ? 'fixtures' : 'controls';
  const body = `
    <div class="paste-help">Copy a block of cells from Excel or Google Sheets and paste below. Expected column order:
      <br><code>Qty</code> <code>Type</code> <code>Manufacturer</code> <code>Description</code> <code>Part&nbsp;#</code> <code>Unit&nbsp;cost</code> <code>Markup</code> <span style="opacity:.7">(only Qty + Description needed; trailing columns optional)</span>
      <br>A header row is detected and skipped automatically.</div>
    <textarea class="paste-area" id="pasteArea" placeholder="10&#9;F1&#9;Focus&#9;6&quot; LED downlight&#9;DL-6-30K&#9;82.50&#10;4&#9;F2&#9;Focus&#9;Wall wash&#9;WW-2&#9;120"></textarea>
    <div class="paste-opts">
      <label><input type="checkbox" id="pasteReplace"> Replace existing ${kindLabel} first</label>
      <span id="pastePreview"></span>
    </div>`;
  openModal({
    title:`Paste ${kindLabel} from a spreadsheet`, bodyHTML:body, confirmLabel:'Import rows', wide:true,
    onOpen(back){
      const ta = back.querySelector('#pasteArea');
      const prev = back.querySelector('#pastePreview');
      const upd = ()=>{ const n = parsePasteText(ta.value).length; prev.textContent = ta.value.trim() ? `${n} row${n===1?'':'s'} detected` : ''; };
      ta.addEventListener('input', upd); ta.focus();
    },
    onConfirm(back){
      const rows = parsePasteText(back.querySelector('#pasteArea').value);
      if(!rows.length){ toast('Nothing to import — paste some rows first'); return; }
      if(!guardBaseEdit()){ closeModal(); return; }
      const arr = state.options[state.current][kind];
      if(back.querySelector('#pasteReplace').checked) arr.length = 0;
      rows.forEach(r=>arr.push(r));
      markDirty(); closeModal(); render();
      toast(`Imported ${rows.length} ${kind==='fixtures'?'fixture':'control'}${rows.length===1?'':'s'}`);
    }
  });
}

/* ================= Parts library (local, offline) ================= */
/* Separate saved libraries for fixtures and controls. */
function partsKey(kind){ return kind==='controls' ? 'lbom_parts_controls_v1' : 'lbom_parts_fixtures_v1'; }
function loadParts(kind){ try{ const a=JSON.parse(localStorage.getItem(partsKey(kind))); return Array.isArray(a)?a:[]; }catch(e){ return []; } }
function savePartsArr(kind, a){ try{ localStorage.setItem(partsKey(kind), JSON.stringify(a)); }catch(e){} }
function savePartFromRow(kind, i){
  const r = state.options[state.current][kind][i];
  if(!r || r.isSection) return;
  if(!r.type && !r.desc && !r.part){ toast('Add a type, description, or part # first'); return; }
  const p = { id:uid(), type:r.type||'', mfr:r.mfr||'', desc:r.desc||'', part:r.part||'', unitCost:numOr(r.unitCost,0), markup:r.markup, tag:r.tag||'' };
  const arr = loadParts(kind);
  const dupe = arr.find(x=>x.part===p.part && x.desc===p.desc && x.type===p.type);
  if(dupe){ Object.assign(dupe, {mfr:p.mfr, unitCost:p.unitCost, markup:p.markup, tag:p.tag}); savePartsArr(kind, arr); toast('Updated in '+kind+' library'); }
  else { arr.unshift(p); savePartsArr(kind, arr); toast('Saved to '+kind+' library ★'); }
}
function deletePart(kind, id){ savePartsArr(kind, loadParts(kind).filter(p=>p.id!==id)); }
function insertPartFromLib(id, kind){
  const p = loadParts(kind).find(x=>x.id===id);
  if(!p) return;
  if(!guardBaseEdit()){ closeModal(); return; }
  const r = blankRow();
  r.type=p.type||''; r.mfr=p.mfr||''; r.desc=p.desc||''; r.part=p.part||'';
  r.unitCost=numOr(p.unitCost,0); r.markup=p.markup; r.tag=p.tag||'';
  state.options[state.current][kind].push(r);
  markDirty(); closeModal(); render();
  toast('Inserted "'+(p.type||p.desc||p.part||'part')+'"');
}
function openLibrary(kind){
  const label = kind==='controls' ? 'controls' : 'fixtures';
  const listHTML = (filter='')=>{
    const arr = loadParts(kind);
    if(!arr.length) return `<div class="lib-empty">Your ${label} library is empty.<br>Click the ★ on any ${label==='controls'?'control':'fixture'} row to save it here, then insert it into future estimates.</div>`;
    const q = filter.trim().toLowerCase();
    const shown = q ? arr.filter(p=>[p.type,p.mfr,p.desc,p.part].join(' ').toLowerCase().includes(q)) : arr;
    if(!shown.length) return `<div class="lib-empty">No saved ${label} match "${esc(filter)}".</div>`;
    return `<div class="lib-list">${shown.map(p=>`<div class="lib-item">
        <div class="lib-main"><span class="lib-type">${esc(p.type||'—')}</span><span class="lib-desc">${esc(p.desc||'')}${p.part?' · '+esc(p.part):''}</span></div>
        <span class="lib-meta">${money(numOr(p.unitCost,0))}</span>
        <button class="primary" data-ins="${p.id}">Insert</button>
        <button class="rowdel" data-del="${p.id}" title="Remove from library">✕</button>
      </div>`).join('')}</div>`;
  };
  const body = `<input class="lib-search" id="libSearch" placeholder="Search saved ${label}…" autocomplete="off">
    <div id="libListWrap">${listHTML()}</div>
    <div class="lib-io no-print">
      <button class="ghost" id="libExport">⬇ Export library</button>
      <button class="ghost" id="libImport">⬆ Import…</button>
      <input type="file" id="libImportFile" accept=".json" style="display:none">
    </div>`;
  openModal({
    title:label.charAt(0).toUpperCase()+label.slice(1)+' library', bodyHTML:body, wide:true,
    onOpen(back){
      const wrap = back.querySelector('#libListWrap');
      const search = back.querySelector('#libSearch');
      const bind = ()=>{
        wrap.querySelectorAll('[data-ins]').forEach(b=> b.addEventListener('click', ()=>insertPartFromLib(b.dataset.ins, kind)));
        wrap.querySelectorAll('[data-del]').forEach(b=> b.addEventListener('click', ()=>{ deletePart(kind, b.dataset.del); wrap.innerHTML = listHTML(search.value); bind(); }));
      };
      search.addEventListener('input', ()=>{ wrap.innerHTML = listHTML(search.value); bind(); });
      back.querySelector('#libExport').addEventListener('click', ()=> exportLibrary(kind));
      const imp = back.querySelector('#libImportFile');
      back.querySelector('#libImport').addEventListener('click', ()=> imp.click());
      imp.addEventListener('change', e=>{
        const f=e.target.files[0]; if(!f) return;
        const rd=new FileReader(); rd.onload=()=>{ importLibrary(kind, rd.result); wrap.innerHTML=listHTML(search.value); bind(); };
        rd.readAsText(f); e.target.value='';
      });
      bind(); search.focus();
    }
  });
}
function downloadJSON(name, obj){
  const blob = new Blob([JSON.stringify(obj,null,2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  URL.revokeObjectURL(a.href);
}
function exportLibrary(kind){
  const parts = loadParts(kind);
  if(!parts.length){ toast('That library is empty'); return; }
  downloadJSON('lighting-'+kind+'-library.json', {app:'lbom-library', kind, parts});
  toast('Exported '+parts.length+' '+kind);
}
function importLibrary(kind, text){
  try{
    const d = JSON.parse(text);
    const incoming = Array.isArray(d) ? d : (Array.isArray(d.parts) ? d.parts : []);
    if(!incoming.length){ toast('No parts found in that file'); return; }
    const arr = loadParts(kind); let added=0;
    incoming.forEach(p=>{
      if(!p || typeof p!=='object') return;
      const np = { id:uid(), type:String(p.type||''), mfr:String(p.mfr||''), desc:String(p.desc||''), part:String(p.part||''),
        unitCost:numOr(p.unitCost,0), markup:(p.markup==null?null:numOr(p.markup,0)), tag:String(p.tag||'') };
      if(!(np.type||np.desc||np.part)) return;
      if(!arr.some(x=>x.part===np.part && x.desc===np.desc && x.type===np.type)){ arr.unshift(np); added++; }
    });
    savePartsArr(kind, arr); toast('Imported '+added+' part'+(added===1?'':'s'));
  }catch(e){ toast('Could not read that library file'); }
}

function addOption(){ const o=blankOption("Option "+(state.options.length+1)); applyDefaultsToOption(o, ensureDefaults()); state.options.push(o); state.current=state.options.length-1; markDirty(); render(); }
/* Switching the active option is not itself an undoable edit. Flush any pending
   edit into history, switch, then re-sync the history base so undo doesn't jump tabs. */
function selectOption(i){ commitHistory(); state.current=i; render(); _historyBase = snapshot(); updateUndoButtons(); }
function freshIds(copy){
  ['fixtures','controls'].forEach(k=>{
    (copy[k]||[]).forEach(r=>{
      r.id = uid();
      if(r.accessories) r.accessories.forEach(a=>a.id=uid());
      if(r.pieces) r.pieces.forEach(pc=>pc.id=uid());
    });
  });
  (copy.services||[]).forEach(g=>{ g.id=uid(); (g.rows||[]).forEach(s=>s.id=uid()); });
  (copy.changeOrders||[]).forEach(co=>{
    co.id=uid();
    ['fixtures','controls'].forEach(k=>(co[k]||[]).forEach(r=>{ r.id=uid(); if(r.accessories)r.accessories.forEach(a=>a.id=uid()); if(r.pieces)r.pieces.forEach(pc=>pc.id=uid()); }));
    (co.services||[]).forEach(g=>{ g.id=uid(); (g.rows||[]).forEach(s=>s.id=uid()); });
  });
  return copy;
}
function dupOption(){
  const copy = freshIds(JSON.parse(JSON.stringify(state.options[state.current])));
  copy.name += " (copy)";
  state.options.splice(state.current+1,0,copy); state.current++; markDirty(); render();
  toast("Option duplicated");
}
/* Duplicate ONLY the fixtures of the current option into a new option (controls/services blank).
   Lets you mix-and-match fixture sets and control sets across options independently. */
function dupFixturesToNewOption(){
  const src = state.options[state.current];
  const copy = freshIds(JSON.parse(JSON.stringify(src)));
  copy.name = src.name + " — fixtures";
  copy.controls = [blankRow()];
  copy.services = [];
  state.options.splice(state.current+1,0,copy); state.current++; markDirty(); render();
  toast("Fixtures duplicated to a new option");
}
function dupControlsToNewOption(){
  const src = state.options[state.current];
  const copy = freshIds(JSON.parse(JSON.stringify(src)));
  copy.name = src.name + " — controls";
  copy.fixtures = [sectionRow("Section 1"), blankRow()];
  copy.services = [];
  state.options.splice(state.current+1,0,copy); state.current++; markDirty(); render();
  toast("Controls duplicated to a new option");
}
async function delOption(){
  const opt = state.options[state.current];
  const ok = await showConfirm(
    'Delete option?',
    `"${opt.name}" will be permanently removed. This cannot be undone.`,
    'Delete', 'danger'
  );
  if(!ok) return;
  state.options.splice(state.current,1);
  if(state.options.length===0) state.options.push(blankOption("Option 1"));
  state.current = Math.max(0, state.current-1); markDirty(); render();
}

/* ================= Shipping & Invoicing module ================= */
/* The ship schedule is DERIVED LIVE from the BOM. Each fixture/control row has a
   stable id; logistics data (PO, dates, tracking, invoice) lives in state.shipMeta
   keyed by that row id. Editing the BOM (qty, part, price, markup) flows straight
   through to the schedule. */
/* Tracking links — turn a typed carrier (Shipper/Via box) + tracking # into a
   clickable URL. Big-4 carriers get direct deep-links; an unrecognized typed
   carrier (or an undetectable number) falls back to a web search so it's still
   clickable. When the carrier box is blank we sniff it from the number format. */
function carrierKey(carrier){
  const c = String(carrier||'').toLowerCase().replace(/[^a-z]/g,'');
  if(!c) return '';
  if(c.includes('ups')) return 'ups';
  if(c.includes('fedex')) return 'fedex';
  if(c.includes('usps')||c.includes('postal')||c.includes('mail')) return 'usps';
  if(c.includes('dhl')) return 'dhl';
  return '';
}
function detectCarrier(tracking){
  const t = String(tracking||'').toUpperCase().replace(/\s+/g,'');
  if(!t) return '';
  if(/^1Z[0-9A-Z]{16}$/.test(t)) return 'ups';
  if(/^(94|93|92|95|420)\d{18,}$/.test(t)) return 'usps';   // USPS Intelligent Mail
  if(/^[A-Z]{2}\d{9}US$/.test(t)) return 'usps';            // USPS international
  if(/^(\d{12}|\d{15}|\d{20}|\d{22})$/.test(t)) return 'fedex';
  if(/^\d{10,11}$/.test(t)) return 'dhl';
  return '';
}
function trackingUrl(carrier, tracking){
  const t = String(tracking||'').trim();
  if(!t) return '';
  const enc = encodeURIComponent(t);
  const typed = String(carrier||'').trim();
  let key = carrierKey(typed);
  if(!key && !typed) key = detectCarrier(t);   // only sniff the number when nothing was typed
  switch(key){
    case 'ups':   return `https://www.ups.com/track?loc=en_US&tracknum=${enc}`;
    case 'fedex': return `https://www.fedex.com/fedextrack/?trknbr=${enc}`;
    case 'usps':  return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${enc}`;
    case 'dhl':   return `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${enc}&submit=1`;
  }
  const q = typed ? `${typed} tracking ${t}` : `track package ${t}`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

const SHIP_FIELDS = [
  {k:'po',        label:'PO #',           type:'text', w:110},
  {k:'orderDate', label:'Order date',     type:'date', w:130},
  {k:'recvDate',  label:'Received date',  type:'date', w:130},
  {k:'estShip',   label:'Est. ship',      type:'date', w:130},
  {k:'shipDate',  label:'Shipped date',   type:'date', w:130},
  {k:'shipper',   label:'Shipper',        type:'text', w:120},
  {k:'tracking',  label:'Tracking #',     type:'text', w:150},
  {k:'delivery',  label:'Delivery date',  type:'date', w:130},
  {k:'comments',  label:'Comments',       type:'text', w:200},
];
let shipSort = {col:null, dir:1};
let shipStatusFilter = 'all';   // 'all' | 'outstanding' | 'ordered' | 'shipped' | 'delivered' | 'backordered'
let shipFilter = 'all';            // 'all' | option index
const shipSel = new Set();          // selected row ids (transient)

function blankMeta(){
  return { po:'', orderDate:'', recvDate:'', estShip:'', shipDate:'', shipper:'',
           tracking:'', delivery:'', comments:'', invoiceId:null };
}
function getMeta(rowId){
  if(!state.shipMeta[rowId]) state.shipMeta[rowId] = blankMeta();
  return state.shipMeta[rowId];
}

/* Build the live schedule from the BOM. Returns array of derived line objects.
   Line kinds: 'group' (section header), 'Fixture'/'Control' (parent), 'Accessory' (child). */
function buildSchedule(){
  const lines = [];
  const opts = shipFilter==='all' ? state.options.map((o,i)=>({o,i}))
             : [{o:state.options[shipFilter], i:+shipFilter}].filter(x=>x.o);
  opts.forEach(({o})=>{
    [['fixtures','Fixture',o.fixtureMarkup],['controls','Control',o.controlMarkup]].forEach(([kind,catLabel,dm])=>{
      const catHasContent = (o[kind]||[]).some(r=> r.isSection || r.desc || r.part || r.type || (r.qty>0) || (r.accessories&&r.accessories.length));
      if(catHasContent) lines.push({ isCategory:true, optName:o.name, catLabel:(catLabel==='Fixture'?'Light Fixtures':'Lighting Controls') });
      o[kind].forEach(r=>{
        if(r.isSection){
          lines.push({ isGroup:true, optName:o.name, groupName:r.name||'Section', kind:catLabel });
          return;
        }
        if(!r.desc && !r.part && !r.type && !(r.qty>0) && !(r.accessories&&r.accessories.length)) return;
        const c = rowCalc(r, dm);
        lines.push({
          id:r.id, optName:o.name, kind:catLabel,
          type:r.type, mfr:r.mfr, desc:r.desc, part:r.part, qty:r.qty, sold:c.extSell,
          meta:getMeta(r.id), isAccessory:false, isLinear:(r.tag==='LED Linear'||r.tag==='Track Lighting'), tag:r.tag,
          accIds:(r.accessories||[]).map(a=>a.id)
        });
        /* Linear/Track piece sub-lines (length + qty; pricing stays on parent LOT line) */
        if(r.tag==='LED Linear' || r.tag==='Track Lighting'){
          (r.pieces||[]).forEach(pc=>{
            lines.push({
              id:pc.id, optName:o.name, kind:'Piece', parentId:r.id,
              type:r.type, mfr:r.mfr, desc:`${esc(r.desc)} @ ${esc(pc.length||'—')}`, part:r.part,
              qty:numOr(pc.qty,0), sold:0, length:pc.length,
              meta:getMeta(pc.id), isPiece:true
            });
          });
        }
        /* Accessory LOT line + accessories */
        if((r.accessories||[]).length){
          lines.push({
            id:'lot_'+r.id, optName:o.name, kind:'LOT', parentId:r.id,
            type:r.type, mfr:'MISC.', desc:'LOT: Accessory Package', part:'',
            qty:(r.accessories||[]).length, sold:(r.accessories||[]).reduce((a,acc)=>a+accCalc(acc,r,dm).extSell,0),
            meta:getMeta('lot_'+r.id), isLot:true, lotAccIds:(r.accessories||[]).map(a=>a.id)
          });
          (r.accessories||[]).forEach(a=>{
            const ac = accCalc(a, r, dm);
            lines.push({
              id:a.id, optName:o.name, kind:'Accessory', parentType:r.type, parentId:r.id,
              type:r.type, mfr:a.mfr, desc:a.desc, part:a.part, qty:ac.qty, sold:ac.extSell,
              meta:getMeta(a.id), isAccessory:true
            });
          });
        }
      });
    });
    /* Services for this option — only lines with a quantity > 0 */
    const svcGroups = o.services||[];
    const svcDefMk = o.serviceMarkup!=null?o.serviceMarkup:o.fixtureMarkup;
    const svcHasContent = svcGroups.some(g=>(g.rows||[]).some(s=> numOr(s.qty,0)>0));
    if(svcHasContent){
      lines.push({ isCategory:true, optName:o.name, catLabel:'Services' });
      svcGroups.forEach(g=>{
        const gHas = (g.rows||[]).some(s=> numOr(s.qty,0)>0);
        if(!gHas) return;
        lines.push({ isGroup:true, optName:o.name, groupName:g.name||'Services', kind:'Service' });
        (g.rows||[]).forEach(s=>{
          if(!(numOr(s.qty,0)>0)) return;
          const sc = serviceCalc(s, svcDefMk);
          lines.push({
            id:s.id, optName:o.name, kind:'Service',
            type:s.unit||'', mfr:s.location||'', desc:s.desc, part:'',
            qty:s.qty, sold:sc.extSell, meta:getMeta(s.id), isService:true
          });
        });
      });
    }
    /* Change orders (approved options only) — tagged as CO items */
    if(o.approved && (o.changeOrders||[]).length){
      o.changeOrders.forEach(co=>{
        const hasItems = (co.fixtures||[]).some(r=>r.desc||r.part||r.type) || (co.controls||[]).some(r=>r.desc||r.part||r.type);
        if(!hasItems) return;
        lines.push({ isCategory:true, optName:o.name, catLabel:`CO #${co.number}: ${co.name}`, isCO:true });
        [['fixtures','Fixture',co.fixtureMarkup],['controls','Control',co.controlMarkup]].forEach(([kind,catLabel,dm])=>{
          (co[kind]||[]).forEach(r=>{
            if(r.isSection) return;
            if(!r.desc && !r.part && !r.type && !(r.qty>0)) return;
            const c = rowCalc(r, dm);
            lines.push({
              id:r.id, optName:o.name, kind:catLabel, isCO:true, coName:co.name,
              type:r.type, mfr:r.mfr, desc:r.desc, part:r.part, qty:r.qty, sold:c.extSell,
              meta:getMeta(r.id), isAccessory:false
            });
          });
        });
      });
    }
  });
  return lines;
}

function shipStatus(m){
  if(m.delivery) return ['Delivered','pill-delivered'];
  if(m.shipDate) return ['Shipped','pill-shipped'];
  if(m.backordered) return ['Back-ordered','pill-backordered'];
  if(m.recvDate) return ['Received','pill-received'];
  if(m.orderDate||m.po) return ['Ordered','pill-ordered'];
  return ['—','pill-none'];
}
/* "outstanding" = not yet delivered (still needs action) */
function isOutstanding(m){ return !m.delivery; }
function toggleBackorder(rowId){
  const m = getMeta(rowId);
  m.backordered = !m.backordered;
  markDirty(); renderShipping();
}
function setMetaField(rowId, k, v){
  const m = getMeta(rowId);
  m[k] = v;
  markDirty();
  if(k==='invoiceId'||k==='tracking'||k==='shipper') renderShipping();
}
/* select/deselect all accessory ids belonging to a LOT */
function toggleLot(accIds, on){
  accIds.forEach(id=>{ if(on) shipSel.add(id); else shipSel.delete(id); });
  renderShipping();
}
/* find a BOM fixture row by id across all options */
function findFixtureRow(rowId){
  for(const o of state.options){
    const r = (o.fixtures||[]).find(x=>x.id===rowId);
    if(r) return r;
  }
  return null;
}
function addPiece(rowId){
  const r = findFixtureRow(rowId); if(!r) return;
  if(!r.pieces) r.pieces=[];
  r.pieces.push({id:uid(), length:"", qty:0});
  markDirty(); renderShipping();
}
function delPiece(rowId, pieceId){
  const r = findFixtureRow(rowId); if(!r||!r.pieces) return;
  r.pieces = r.pieces.filter(p=>p.id!==pieceId);
  markDirty(); renderShipping();
}
function setPieceField(rowId, pieceId, k, v){
  const r = findFixtureRow(rowId); if(!r||!r.pieces) return;
  const pc = r.pieces.find(p=>p.id===pieceId); if(!pc) return;
  pc[k] = (k==='qty') ? Math.max(0,numOr(v,0)) : v;
  markDirty();
}
function shipSortBy(col){
  if(shipSort.col===col) shipSort.dir*=-1; else { shipSort.col=col; shipSort.dir=1; }
  renderShipping();
}
function toggleShipSel(id,on){ if(on) shipSel.add(id); else shipSel.delete(id); renderShipping(); }
function toggleAllSel(on, ids){ if(on) ids.forEach(i=>shipSel.add(i)); else shipSel.clear(); renderShipping(); }

/* ---- Invoices ---- */
function addInvoice(){
  const n = state.invoices.length+1;
  state.invoices.push({id:uid(), name:'Invoice '+n, number:'', date:'', status:'Open'});
  markDirty(); renderShipping();
}
function delInvoice(id){
  Object.values(state.shipMeta).forEach(m=>{ if(m.invoiceId===id) m.invoiceId=null; });
  state.invoices = state.invoices.filter(v=>v.id!==id);
  markDirty(); renderShipping();
}
function setInvField(id,k,v){ const inv=state.invoices.find(x=>x.id===id); if(inv){ inv[k]=v; markDirty(); if(k==='status'||k==='name') renderShipping(); } }

/* invoice total = sum of live sold$ for rows whose meta.invoiceId === id */
function invoiceTotal(id){
  return buildScheduleAll().filter(l=>l.meta && !l.isLot && !l.isPiece && l.meta.invoiceId===id).reduce((a,l)=>a+numOr(l.sold,0),0);
}
/* like buildSchedule but always all options (for invoice math regardless of filter) */
function buildScheduleAll(){
  const saved = shipFilter; shipFilter='all';
  const r = buildSchedule(); shipFilter=saved; return r;
}
function invoiceItems(id){ return buildScheduleAll().filter(l=>l.meta && !l.isLot && !l.isPiece && l.meta.invoiceId===id); }

function assignSelectedTo(invId){
  if(shipSel.size===0){ toast('Select items first (checkboxes)'); return; }
  if(!invId){ toast('Pick an invoice'); return; }
  shipSel.forEach(rowId=>{ getMeta(rowId).invoiceId=invId; });
  const n = shipSel.size; shipSel.clear();
  markDirty(); renderShipping();
  const inv = state.invoices.find(v=>v.id===invId);
  toast(n+' item'+(n===1?'':'s')+' → '+(inv?inv.name:'invoice'));
}
function unassign(rowId){ const m=state.shipMeta[rowId]; if(m){ m.invoiceId=null; markDirty(); renderShipping(); } }

function renderShipping(){
  const el = document.getElementById('shippingView');

  /* dashboard metrics computed across all item lines (respecting the option filter) */
  const allItems = buildSchedule().filter(l=>!l.isGroup && !l.isCategory && !l.isLot && !l.isPiece);
  const total = allItems.length;
  const ordered = allItems.filter(l=>l.meta.orderDate||l.meta.po).length;
  const shipped = allItems.filter(l=>l.meta.shipDate||l.meta.delivery).length;
  const delivered = allItems.filter(l=>l.meta.delivery).length;
  const backord = allItems.filter(l=>l.meta.backordered && !l.meta.delivery).length;
  const outstandingVal = allItems.filter(l=>isOutstanding(l.meta)).reduce((a,l)=>a+numOr(l.sold,0),0);
  const pct = n => total? Math.round(n/total*100) : 0;
  /* next ETA = earliest est. ship / delivery among outstanding items */
  const etas = allItems.filter(l=>isOutstanding(l.meta)).map(l=>l.meta.estShip||l.meta.delivery).filter(Boolean)
    .map(d=>({raw:d, t:Date.parse(d)})).filter(x=>!isNaN(x.t)).sort((a,b)=>a.t-b.t);
  const nextEta = etas.length? etas[0].raw : '—';

  const dashboard = total>0 ? `
    <div class="ship-dash">
      <div class="sd-card"><span class="sd-label">Ordered</span><span class="sd-val">${pct(ordered)}%</span><span class="sd-sub">${ordered}/${total}</span></div>
      <div class="sd-card"><span class="sd-label">Shipped</span><span class="sd-val">${pct(shipped)}%</span><span class="sd-sub">${shipped}/${total}</span></div>
      <div class="sd-card"><span class="sd-label">Delivered</span><span class="sd-val">${pct(delivered)}%</span><span class="sd-sub">${delivered}/${total}</span></div>
      <div class="sd-card ${backord?'sd-warn':''}"><span class="sd-label">Back-ordered</span><span class="sd-val">${backord}</span><span class="sd-sub">items</span></div>
      <div class="sd-card"><span class="sd-label">$ Outstanding</span><span class="sd-val sd-money">${money(outstandingVal)}</span><span class="sd-sub">not delivered</span></div>
      <div class="sd-card"><span class="sd-label">Next ETA</span><span class="sd-val sd-eta">${esc(nextEta)}</span><span class="sd-sub">est. ship</span></div>
    </div>` : '';

  /* filter bar */
  const optOpts = `<option value="all" ${shipFilter==='all'?'selected':''}>All options</option>`
    + state.options.map((o,i)=>`<option value="${i}" ${String(i)===String(shipFilter)?'selected':''}>${esc(o.name)}</option>`).join('');
  const statusOpts = [['all','All statuses'],['outstanding','Outstanding (not delivered)'],['ordered','Ordered, not shipped'],['shipped','Shipped, not delivered'],['delivered','Delivered'],['backordered','Back-ordered']]
    .map(([v,l])=>`<option value="${v}" ${shipStatusFilter===v?'selected':''}>${l}</option>`).join('');
  const filterBar = `
    <div class="ship-toolbar">
      <div class="ship-import">
        <label>Show</label>
        <select onchange="shipFilter = this.value==='all' ? 'all' : +this.value; shipSel.clear(); renderShipping()">${optOpts}</select>
        <select class="ship-status-filter" onchange="shipStatusFilter=this.value; renderShipping()">${statusOpts}</select>
        <span class="ship-live-note">Live from the bill of materials.</span>
      </div>
      <div class="grow"></div>
      <div class="ship-export-group">
        <span class="seg-label">Export schedule:</span>
        <button class="ghost" onclick="exportShipCSV()">CSV</button>
        <button class="ghost" onclick="exportShipXLSX()">Excel</button>
        <button class="ghost" onclick="openShipPrint()">PDF / Print</button>
      </div>
    </div>`;

  let lines = buildSchedule();

  if(lines.length===0){
    el.innerHTML = dashboard + filterBar + `<div class="ship-empty">
      Nothing to ship yet. Add fixtures or controls to an option in the <b>Estimate</b> tab and they'll appear here automatically with their live quantities, part numbers and sold prices.
    </div>` + invoicesPanel() + shipSummary();
    return;
  }

  /* status filter — drop item lines that don't match (keep category/group bands only if they still have children) */
  if(shipStatusFilter!=='all'){
    const match = m => {
      const st = shipStatus(m)[0];
      switch(shipStatusFilter){
        case 'outstanding': return isOutstanding(m);
        case 'ordered': return (m.orderDate||m.po) && !m.shipDate && !m.delivery;
        case 'shipped': return m.shipDate && !m.delivery;
        case 'delivered': return !!m.delivery;
        case 'backordered': return !!m.backordered && !m.delivery;
        default: return true;
      }
    };
    lines = lines.filter(l=>{
      if(l.isCategory||l.isGroup||l.isLot||l.isPiece) return true;   // structural rows pruned below
      return match(l.meta);
    });
    /* prune now-empty category/group bands */
    lines = lines.filter((l,i)=>{
      if(!(l.isCategory||l.isGroup)) return true;
      /* keep only if a following non-structural line exists before the next band */
      for(let j=i+1;j<lines.length;j++){
        if(lines[j].isCategory||lines[j].isGroup) break;
        if(!lines[j].isLot && !lines[j].isPiece) return true;
      }
      return false;
    });
  }

  /* sort (display only) — disabled while section groups or category bands are present */
  const hasGroups = lines.some(l=>l.isGroup || l.isCategory || l.isLot || l.isPiece);
  if(shipSort.col && !hasGroups){
    const NUM = new Set(['qty','sold']);
    lines = lines.slice().sort((a,b)=>{
      let av, bv;
      if(shipSort.col==='status'){ av=shipStatus(a.meta)[0]; bv=shipStatus(b.meta)[0]; }
      else if(SHIP_FIELDS.some(f=>f.k===shipSort.col)){ av=a.meta[shipSort.col]; bv=b.meta[shipSort.col]; }
      else { av=a[shipSort.col]; bv=b[shipSort.col]; }
      if(NUM.has(shipSort.col)) return ((av||0)-(bv||0))*shipSort.dir;
      return String(av||'').localeCompare(String(bv||''))*shipSort.dir;
    });
  }

  const itemLines = lines.filter(l=>!l.isGroup && !l.isCategory && !l.isLot && !l.isPiece);
  const ids = itemLines.map(l=>l.id);
  const selCount = ids.filter(i=>shipSel.has(i)).length;
  const allSel = selCount===ids.length && ids.length>0;
  const selSold = itemLines.filter(l=>shipSel.has(l.id)).reduce((a,l)=>a+numOr(l.sold,0),0);

  function sth(col,label,cls=''){
    const active = shipSort.col===col;
    const icon = active ? (shipSort.dir===1?'▲':'▼') : '⇅';
    const c = `sortable${active?(shipSort.dir===1?' sort-asc':' sort-desc'):''}${cls?' '+cls:''}`;
    return `<th class="${c}" onclick="shipSortBy('${col}')">${label} <span class="sort-icon">${icon}</span></th>`;
  }
  const invOptions = id => `<option value="">—</option>` + state.invoices.map(v=>
    `<option value="${v.id}" ${id===v.id?'selected':''}>${esc(v.name)}</option>`).join('');

  const COLSPAN = 11 + SHIP_FIELDS.length + 1;
  const body = lines.map(l=>{
    if(l.isCategory){
      return `<tr class="ship-cat-row ${l.isCO?'ship-co-row':''}"><td colspan="${COLSPAN}">
        <span class="scr-label">${esc(l.catLabel)}</span>
        <span class="scr-opt">${esc(l.optName)}${l.isCO?' · CHANGE ORDER':''}</span>
      </td></tr>`;
    }
    if(l.isGroup){
      return `<tr class="ship-group-row"><td colspan="${COLSPAN}">
        <span class="sgr-label">▸ ${esc(l.groupName)}</span>
        <span class="sgr-opt">${esc(l.optName)} · ${esc(l.kind)}s</span>
      </td></tr>`;
    }
    const m = l.meta;
    const [stLabel,stCls] = shipStatus(m);
    const isAcc = l.isAccessory;
    const fixedCells = SHIP_FIELDS.map(f=>{
      const cls = f.type==='date' ? 'date' : '';
      const ph = f.type==='date' ? 'mm/dd/yyyy' : '';
      if(f.k==='tracking'){
        const url = trackingUrl(m.shipper, m.tracking);
        const link = url ? `<a class="trk-link no-print" href="${esc(url)}" target="_blank" rel="noopener" title="Track shipment">↗</a>` : '';
        return `<td class="trk-cell" style="min-width:${f.w}px"><input value="${esc(m[f.k]||'')}" placeholder="${ph}"
          onchange="setMetaField('${l.id}','${f.k}',this.value)">${link}</td>`;
      }
      return `<td style="min-width:${f.w}px"><input class="${cls}" value="${esc(m[f.k]||'')}" placeholder="${ph}"
        onchange="setMetaField('${l.id}','${f.k}',this.value)"></td>`;
    }).join('');

    /* LOT: Accessory Package line — a checkbox that selects all the fixture's accessories */
    if(l.isLot){
      const lotSel = l.lotAccIds.length>0 && l.lotAccIds.every(id=>shipSel.has(id));
      return `<tr class="lot-ship-row ${lotSel?'sel':''}">
        <td class="chk"><input type="checkbox" ${lotSel?'checked':''} title="Select all accessories in this LOT" onchange="toggleLot(${JSON.stringify(l.lotAccIds).replace(/"/g,'&quot;')}, this.checked)"></td>
        <td style="min-width:96px"></td>
        <td style="min-width:70px"><span class="lot-pill">LOT</span></td>
        <td style="min-width:56px" class="mirror">${esc(l.type)}</td>
        <td style="min-width:120px" class="mirror">MISC.</td>
        <td style="min-width:180px" class="mirror"><b>LOT: Accessory Package</b></td>
        <td style="min-width:120px" class="mirror"></td>
        <td style="min-width:50px" class="mirror r">${l.qty}</td>
        <td class="calc" style="min-width:96px">${money(numOr(l.sold,0))}</td>
        <td style="min-width:88px"></td>
        ${fixedCells}
        <td></td>
      </tr>`;
    }
    /* Linear/Track piece line — editable length & qty, no separate price */
    if(l.isPiece){
      return `<tr class="piece-ship-row">
        <td class="chk"></td>
        <td style="min-width:96px"></td>
        <td style="min-width:70px"><span class="piece-pill">Pc</span></td>
        <td style="min-width:56px" class="mirror">${esc(l.type)}</td>
        <td style="min-width:120px" class="mirror">${esc(l.mfr)}</td>
        <td style="min-width:180px" class="mirror"><span class="acc-tag-ship">${esc(l.desc)}</span></td>
        <td style="min-width:120px" class="mirror mono">${esc(l.part)}</td>
        <td style="min-width:50px"><input class="num" value="${l.qty}" onchange="setPieceField('${l.parentId}','${l.id}','qty',this.value)" title="Quantity of pieces"></td>
        <td class="calc" style="min-width:96px"><span class="dim">incl. in LOT</span></td>
        <td style="min-width:88px"></td>
        ${fixedCells}
        <td class="no-print"><button class="ship-rowdel" title="Delete piece" onclick="delPiece('${l.parentId}','${l.id}')">✕</button></td>
      </tr>`;
    }
    /* Service line */
    if(l.isService){
      return `<tr class="svc-ship-row ${shipSel.has(l.id)?'sel':''}">
        <td class="chk"><input type="checkbox" ${shipSel.has(l.id)?'checked':''} onchange="toggleShipSel('${l.id}',this.checked)"></td>
        <td style="min-width:96px">${esc(l.optName)}</td>
        <td style="min-width:70px"><span class="svc-pill">Svc</span></td>
        <td style="min-width:56px" class="mirror">${esc(l.type)}</td>
        <td style="min-width:120px" class="mirror">${esc(l.mfr)}</td>
        <td style="min-width:180px" class="mirror">${esc(l.desc)||'<span class="dim">—</span>'}</td>
        <td style="min-width:120px" class="mirror"></td>
        <td style="min-width:50px" class="mirror r">${l.qty}</td>
        <td class="calc" style="min-width:96px">${money(numOr(l.sold,0))}</td>
        <td style="min-width:88px"><span class="status-pill ${stCls}">${stLabel}</span></td>
        ${fixedCells}
        <td style="min-width:130px"><select onchange="setMetaField('${l.id}','invoiceId',this.value||null)">${invOptions(m.invoiceId)}</select></td>
      </tr>`;
    }

    const descCell = isAcc
      ? `<td style="min-width:180px" class="mirror"><span class="acc-tag-ship">${esc(l.desc)||'<span class="dim">accessory</span>'}</span></td>`
      : `<td style="min-width:180px" class="mirror">${esc(l.desc)||'<span class="dim">—</span>'}</td>`;
    const catCell = isAcc
      ? `<td style="min-width:70px"><span class="acc-pill">Acc</span></td>`
      : `<td style="min-width:70px">${esc(l.kind)}${l.isLinear?` <span class="lin-pill">${l.tag==='Track Lighting'?'Trk':'Lin'}</span>`:''}${l.isCO?` <span class="co-pill">CO</span>`:''}</td>`;
    const addPiece = l.isLinear
      ? `<button class="add-piece-btn no-print" title="Add a length/piece line" onclick="addPiece('${l.id}')">+ pc</button>` : '';
    return `<tr class="${shipSel.has(l.id)?'sel':''}${isAcc?' acc-ship-row':''}${l.isCO?' co-ship-row':''}">
      <td class="chk"><input type="checkbox" ${shipSel.has(l.id)?'checked':''} onchange="toggleShipSel('${l.id}',this.checked)"></td>
      <td style="min-width:96px">${isAcc?'':esc(l.optName)}</td>
      ${catCell}
      <td style="min-width:56px" class="mirror">${esc(l.type)||'<span class="dim">—</span>'} ${addPiece}</td>
      <td style="min-width:120px" class="mirror">${esc(l.mfr)||'<span class="dim">—</span>'}</td>
      ${descCell}
      <td style="min-width:120px" class="mirror mono">${esc(l.part)||'<span class="dim">—</span>'}</td>
      <td style="min-width:50px" class="mirror r">${l.qty}</td>
      <td class="calc" style="min-width:96px">${money(numOr(l.sold,0))}</td>
      <td style="min-width:88px" class="status-cell"><span class="status-pill ${stCls}">${stLabel}</span><button class="bo-toggle no-print ${l.meta.backordered?'on':''}" title="Toggle back-ordered" onclick="toggleBackorder('${l.id}')">B/O</button></td>
      ${fixedCells}
      <td style="min-width:130px"><select onchange="setMetaField('${l.id}','invoiceId',this.value||null)">${invOptions(m.invoiceId)}</select></td>
    </tr>`;
  }).join('');

  const filterLabel = shipFilter==='all' ? 'all options' : esc(state.options[shipFilter]?.name||'');
  const table = `
    <div class="ship-section">
      <div class="ship-sec-head">
        <span class="tick"></span><h2>Shipping &amp; Procurement Tracking</h2>
        <span class="count">${itemLines.length} item${itemLines.length===1?'':'s'} · ${filterLabel}</span>
      </div>
      <div class="ship-scroll">
        <table class="ship-table">
          <thead><tr>
            <th class="chk"><input type="checkbox" ${allSel?'checked':''} onchange="toggleAllSel(this.checked, ${JSON.stringify(ids).replace(/"/g,'&quot;')})"></th>
            ${sth('optName','Option')}
            ${sth('kind','Cat.')}
            ${sth('type','Type')}
            ${sth('mfr','Mfr')}
            ${sth('desc','Description')}
            ${sth('part','Part #')}
            ${sth('qty','Qty','r')}
            ${sth('sold','Sold $','r')}
            ${sth('status','Status')}
            ${SHIP_FIELDS.map(f=>sth(f.k,f.label)).join('')}
            <th>Invoice</th>
          </tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </div>`;

  const assignBar = `
    <div class="invbar no-print">
      <span class="ib-count"><b>${selCount}</b> selected · ${money(selSold)}</span>
      <select id="assignSelect">${state.invoices.length?state.invoices.map(v=>`<option value="${v.id}">${esc(v.name)}</option>`).join(''):'<option value="">No invoices yet</option>'}</select>
      <button class="primary" onclick="assignSelectedTo(document.getElementById('assignSelect').value)">Assign to invoice</button>
      <button onclick="addInvoice()">+ New invoice</button>
      <span class="ib-divider"></span>
      <button class="primary" onclick="openShipBulkEdit()" title="Set several fields at once on the selected rows">✎ Bulk edit fields…</button>
      <button onclick="bulkBackorderSelected()">Toggle back-ordered</button>
      ${selCount?`<button onclick="toggleAllSel(false,[])">Clear selection</button>`:''}
    </div>`;

  el.innerHTML = dashboard + filterBar + table + assignBar + invoicesPanel() + shipSummary();
}

/* Bulk edit: set several procurement/shipping fields at once on every selected
   item line. Only the fields whose "set" box is checked are written. */
function openShipBulkEdit(){
  if(shipSel.size===0){ toast('Select some rows first (checkboxes)'); return; }
  const n = shipSel.size;
  const fieldRows = SHIP_FIELDS.map(f=>`
    <label class="sbe-row">
      <input type="checkbox" class="sbe-on" data-f="${f.k}">
      <span class="sbe-label">${esc(f.label)}</span>
      <input class="sbe-val" data-f="${f.k}" placeholder="${f.type==='date'?'mm/dd/yyyy':'value…'}">
    </label>`).join('');
  const body = `<p class="paste-help">Set one or more fields on the <b>${n}</b> selected item${n===1?'':'s'}. Only the fields you check are changed. Leave a value blank (with its box checked) to clear that field.</p>
    <div class="sbe-grid">${fieldRows}
      <label class="sbe-row">
        <input type="checkbox" class="sbe-on" data-f="backordered">
        <span class="sbe-label">Back-ordered</span>
        <select class="sbe-val" data-f="backordered"><option value="1">Mark back-ordered</option><option value="0">Clear back-ordered</option></select>
      </label>
    </div>`;
  openModal({
    title:'Bulk edit selected items', bodyHTML:body, wide:true,
    confirmLabel:'Apply', cancelLabel:'Cancel',
    onOpen(back){
      /* checking the value field auto-ticks its "set" box for convenience */
      back.querySelectorAll('.sbe-val').forEach(v=>{
        const on = back.querySelector('.sbe-on[data-f="'+v.dataset.f+'"]');
        v.addEventListener('input', ()=>{ if(on) on.checked = true; });
        v.addEventListener('change', ()=>{ if(on) on.checked = true; });
      });
    },
    onConfirm(back){
      const sets = [];
      back.querySelectorAll('.sbe-on').forEach(cb=>{
        if(!cb.checked) return;
        const f = cb.dataset.f;
        const valEl = back.querySelector('.sbe-val[data-f="'+f+'"]');
        sets.push([f, valEl ? valEl.value : '']);
      });
      if(!sets.length){ toast('Check at least one field to set'); return; }
      shipSel.forEach(id=>{
        const m = getMeta(id);
        sets.forEach(([f,v])=>{ if(f==='backordered') m.backordered = (v==='1'); else m[f] = v; });
      });
      markDirty(); closeModal(); renderShipping();
      toast(`Updated ${sets.length} field${sets.length===1?'':'s'} on ${n} item${n===1?'':'s'}`);
    }
  });
}
function bulkBackorderSelected(){
  if(shipSel.size===0){ toast('Select some rows first'); return; }
  /* if all selected are already back-ordered, toggle off; else turn on */
  const allBack = [...shipSel].every(id=>getMeta(id).backordered);
  shipSel.forEach(id=>{ getMeta(id).backordered = !allBack; });
  markDirty(); renderShipping();
}

/* ---- Clipboard helper (works in the offline file:// app too) ---- */
function fallbackCopy(text){
  try{
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position='fixed'; ta.style.top='-1000px'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  }catch(e){ return false; }
}
function copyToClipboard(text){
  if(navigator.clipboard && navigator.clipboard.writeText){
    return navigator.clipboard.writeText(text).then(()=>true).catch(()=>fallbackCopy(text));
  }
  return Promise.resolve(fallbackCopy(text));
}

/* ============================================================================
 * Invoice email text.
 *
 * buildInvoiceEmail() assembles the text that gets copied to the clipboard for
 * pasting into an email. The WORDING lives in the clearly-marked template block
 * below — when you provide the final copy, only that block needs to change.
 * Available data: project (state.name/jobCode/client/company/preparedBy), the
 * invoice (inv.name/number/date/status), the assigned line items, and the total.
 * ==========================================================================*/
function buildInvoiceEmail(inv){
  const items = invoiceItems(inv.id);
  const total = invoiceTotal(inv.id);
  const projName = (state.name||'').trim();
  const proj = [projName, state.jobCode?('('+state.jobCode+')'):''].filter(Boolean).join(' ');
  const company = (state.company||'Focus Lighting').trim();
  const itemLines = items.map(l=>{
    const qty = numOr(l.qty,0);
    const label = [l.type, l.mfr, (l.desc||l.part||'Item')].filter(Boolean).join(' · ');
    return `  • ${qty? qty+'× ':''}${label} — ${money(numOr(l.sold,0))}`;
  });

  /* ===== EMAIL TEMPLATE — replace this wording with the final copy ===== */
  const L = [];
  L.push(`Subject: ${company} — Invoice ${inv.number||inv.name}${proj?(' — '+proj):''}`);
  L.push('');
  L.push(`Hi${state.client?(' '+state.client):''},`);
  L.push('');
  L.push(`Please find ${company}'s invoice ${inv.number||inv.name}${inv.date?(', dated '+inv.date):''}${proj?(', for '+proj):''} below.`);
  L.push('');
  if(itemLines.length){
    L.push('Items:');
    L.push(...itemLines);
    L.push('');
  }
  L.push(`Invoice total: ${money(total)}`);
  L.push('');
  L.push('Please let us know if you have any questions.');
  L.push('');
  L.push('Thank you,');
  if(state.preparedBy) L.push(state.preparedBy);
  L.push(company);
  /* ===== END TEMPLATE ===== */

  /* collapse any accidental double blank lines */
  return L.filter((l,i,a)=> !(l==='' && a[i-1]==='')).join('\n');
}
function openInvoiceEmail(invId){
  const inv = state.invoices.find(v=>v.id===invId); if(!inv) return;
  const text = buildInvoiceEmail(inv);
  openModal({
    title:'Invoice email text', wide:true, cancelLabel:'Close',
    bodyHTML:`<p class="paste-help">Auto-generated from this invoice. Edit here if you like, then copy and paste it into your email.</p>
      <textarea id="invEmailTxt" class="inv-email-txt" spellcheck="false">${esc(text)}</textarea>
      <div class="lib-io"><button class="primary" id="invEmailCopy">📋 Copy to clipboard</button></div>`,
    onOpen(back){
      const ta = back.querySelector('#invEmailTxt');
      const btn = back.querySelector('#invEmailCopy');
      btn.addEventListener('click', ()=>{
        copyToClipboard(ta.value).then(ok=> toast(ok?'Email text copied to clipboard':'Select the text and press Ctrl/Cmd+C'));
        ta.focus(); try{ ta.select(); }catch(e){}
      });
      ta.focus(); try{ ta.select(); }catch(e){}
    }
  });
}

function invoicesPanel(){
  const cards = state.invoices.map(v=>{
    const items = invoiceItems(v.id);
    const total = invoiceTotal(v.id);
    const itemRows = items.length ? items.map(l=>`
      <div class="inv-item">
        <span class="ii-desc" title="${esc(l.desc)}">${esc(l.type?l.type+' · ':'')}${esc(l.desc||l.part||'Item')}</span>
        <span class="ii-amt">${money(numOr(l.sold,0))}</span>
        <button class="ii-unassign no-print" title="Remove from invoice" onclick="unassign('${l.id}')">✕</button>
      </div>`).join('') : `<div class="inv-empty-items">No items assigned yet</div>`;
    const statusSel = ['Open','Sent','Paid'].map(o=>`<option ${v.status===o?'selected':''}>${o}</option>`).join('');
    return `<div class="inv-card ${v.status==='Paid'?'paid':''}">
      <div class="inv-card-head">
        <input class="inv-name" value="${esc(v.name)}" onchange="setInvField('${v.id}','name',this.value)">
        <button class="inv-del no-print" title="Delete invoice" onclick="delInvoice('${v.id}')">✕</button>
      </div>
      <div class="inv-meta">
        <div class="im-cell"><span class="im-label">Invoice #</span>
          <input value="${esc(v.number||'')}" placeholder="—" onchange="setInvField('${v.id}','number',this.value)"></div>
        <div class="im-cell"><span class="im-label">Date</span>
          <input value="${esc(v.date||'')}" placeholder="mm/dd/yyyy" onchange="setInvField('${v.id}','date',this.value)"></div>
        <div class="im-cell"><span class="im-label">Status</span>
          <select onchange="setInvField('${v.id}','status',this.value)">${statusSel}</select></div>
      </div>
      <div class="inv-items">${itemRows}</div>
      <div class="inv-total"><span class="it-label">Invoice total</span><span class="it-amt">${money(total)}</span></div>
      <div class="inv-actions no-print"><button class="ghost" onclick="openInvoiceEmail('${v.id}')" title="Generate email text you can copy & paste">✉ Copy email text</button></div>
    </div>`;
  }).join('');

  return `<div class="inv-panel">
    <div class="ship-sec-head" style="border-color:var(--ink)">
      <span class="tick" style="background:var(--amber)"></span><h2>Invoices</h2>
      <span class="count no-print"><button class="ghost" onclick="addInvoice()">+ New invoice</button></span>
    </div>
    ${state.invoices.length? `<div class="inv-grid">${cards}</div>`
      : `<div class="ship-empty">No invoices yet. Create one, then select tracked items and assign them.</div>`}
  </div>`;
}

function shipSummary(){
  const all = buildScheduleAll().filter(l=>!l.isGroup && !l.isCategory && !l.isLot && !l.isPiece);
  const totalSold = all.reduce((a,l)=>a+numOr(l.sold,0),0);
  const invoiced = all.filter(l=>l.meta && l.meta.invoiceId).reduce((a,l)=>a+numOr(l.sold,0),0);
  const uninvoiced = totalSold - invoiced;
  const paid = state.invoices.filter(v=>v.status==='Paid').reduce((a,v)=>a+invoiceTotal(v.id),0);
  return `<div class="ship-summary">
    <div class="ship-sum-cell"><span class="ssl">Tracked items</span><span class="ssv">${all.length}</span></div>
    <div class="ship-sum-cell"><span class="ssl">Total sold $</span><span class="ssv sell">${money(totalSold)}</span></div>
    <div class="ship-sum-cell"><span class="ssl">Invoiced</span><span class="ssv">${money(invoiced)}</span></div>
    <div class="ship-sum-cell"><span class="ssl">Not yet invoiced</span><span class="ssv warn">${money(uninvoiced)}</span></div>
    <div class="ship-sum-cell"><span class="ssl">Paid</span><span class="ssv sell">${money(paid)}</span></div>
  </div>`;
}

/* schedule rows honoring the current Show filter (All options or one option) */
function scheduleForExport(){ return buildSchedule(); }
function exportSuffix(){
  if(shipFilter==='all') return 'all_options';
  const nm = state.options[shipFilter]?.name || 'option';
  return nm.replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'_');
}
const SHIP_EXPORT_COLS = ['Option','Category','Type','Manufacturer','Description','Part Number','Qty','Sold $','Status',
  'PO','Order Date','Received Date','Est. Ship','Shipped Date','Shipper','Tracking','Delivery Date','Comments','Invoice'];
/* Printable ship-schedule columns (key + label), with show/hide presets. */
const SHIP_PRINT_COLS = [
  {key:'optName',label:'Option'},{key:'cat',label:'Category'},{key:'type',label:'Type'},
  {key:'mfr',label:'Manufacturer'},{key:'desc',label:'Description'},{key:'part',label:'Part Number'},
  {key:'qty',label:'Qty'},{key:'sold',label:'Sold $'},{key:'status',label:'Status'},
  {key:'po',label:'PO'},{key:'orderDate',label:'Order Date'},{key:'recvDate',label:'Received Date'},
  {key:'estShip',label:'Est. Ship'},{key:'shipDate',label:'Shipped Date'},{key:'shipper',label:'Shipper'},
  {key:'tracking',label:'Tracking'},{key:'delivery',label:'Delivery Date'},{key:'comments',label:'Comments'},
  {key:'invoice',label:'Invoice'}
];
const SHIP_CLIENT_HIDDEN = ['optName','cat','sold','po','orderDate','recvDate','invoice'];   // the "Client" preset
let shipPrintHidden = (()=>{ try{ const a=JSON.parse(localStorage.getItem('lbom_shipcols_v1')); return new Set(Array.isArray(a)?a:[]); }catch(e){ return new Set(); } })();
function saveShipCols(){ try{ localStorage.setItem('lbom_shipcols_v1', JSON.stringify([...shipPrintHidden])); }catch(e){} }
function shipPrintColsVisible(){ return SHIP_PRINT_COLS.filter(c=>!shipPrintHidden.has(c.key)); }
function openShipPrint(){
  const cols = SHIP_PRINT_COLS.map(c=>`<label class="set-opt" style="padding:6px 10px;margin-bottom:4px"><input type="checkbox" data-shipcol="${c.key}" ${shipPrintHidden.has(c.key)?'':'checked'}> ${c.label}</label>`).join('');
  const body = `<p class="paste-help">Choose which columns to print. <b>All</b> shows everything; <b>Client</b> hides Sold $, PO #, Order date, Received date and Invoice; <b>Custom</b> is your own pick.</p>
    <div style="display:flex;gap:8px;margin-bottom:12px">
      <button class="ghost" data-preset="all">All</button>
      <button class="ghost" data-preset="client">Client</button>
      <button class="ghost" data-preset="custom" title="Pick columns below">Custom</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 14px">${cols}</div>`;
  openModal({
    title:'Print ship schedule', bodyHTML:body, wide:true, confirmLabel:'Print', cancelLabel:'Cancel',
    onConfirm(){ saveShipCols(); closeModal(); printShipSchedule(); },
    onOpen(back){
      const boxes = back.querySelectorAll('[data-shipcol]');
      const reflect = ()=> boxes.forEach(cb=>{ cb.checked = !shipPrintHidden.has(cb.dataset.shipcol); });
      back.querySelectorAll('[data-preset]').forEach(b=> b.addEventListener('click', ()=>{
        const p=b.dataset.preset;
        if(p==='all') shipPrintHidden = new Set();
        else if(p==='client') shipPrintHidden = new Set(SHIP_CLIENT_HIDDEN);
        if(p!=='custom') reflect();
      }));
      boxes.forEach(cb=> cb.addEventListener('change', ()=>{ if(cb.checked) shipPrintHidden.delete(cb.dataset.shipcol); else shipPrintHidden.add(cb.dataset.shipcol); }));
    }
  });
}
function shipRowValues(l){
  const m=l.meta||{}; const st=shipStatus(m)[0];
  const invName = id => { const v=state.invoices.find(x=>x.id===id); return v?v.name:''; };
  const desc = l.isAccessory ? '    ↳ '+l.desc : l.desc;       // indent accessories
  const cat = l.isAccessory ? 'Accessory' : l.kind;
  return [l.optName,cat,l.type,l.mfr,desc,l.part,numOr(l.qty,0),numOr(l.sold,0),st,
    m.po,m.orderDate,m.recvDate,m.estShip,m.shipDate,m.shipper,m.tracking,m.delivery,m.comments,invName(m.invoiceId)];
}

function exportShipCSV(){
  const q = s=>`"${String(s??"").replace(/"/g,'""')}"`;
  const lines = [SHIP_EXPORT_COLS.map(q).join(',')];
  scheduleForExport().forEach(l=>{
    if(l.isCategory){ lines.push(q('=== '+l.catLabel+' — '+l.optName+' ===')); return; }
    if(l.isLot){ lines.push(q('   LOT: Accessory Package — '+l.type)); return; }
    if(l.isPiece){ const v=shipRowValues(l); v[7]='0.00'; lines.push(v.map(q).join(',')); return; }
    if(l.isGroup){ lines.push(q('▸ '+l.groupName+' ('+l.optName+' '+l.kind+'s)')); return; }
    const v = shipRowValues(l);
    v[7] = numOr(v[7],0).toFixed(2);            // Sold $ 2dp
    lines.push(v.map(q).join(','));
  });
  lines.push('');
  lines.push(['INVOICE','Number','Date','Status','Total'].map(q).join(','));
  state.invoices.forEach(v=>{
    lines.push([q(v.name),q(v.number),q(v.date),q(v.status),invoiceTotal(v.id).toFixed(2)].join(','));
  });
  const blob = new Blob([lines.join('\r\n')], {type:'text/csv'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download=(state.name||'lighting')+'_shipping_'+exportSuffix()+'.csv'; a.click(); URL.revokeObjectURL(a.href);
  toast('Shipping CSV exported');
}

/* Lazy-load the Excel engine. The SheetJS library is embedded as non-executed
   text (see build.js) so it costs nothing at startup; we compile it the first
   time the user actually exports to Excel. Returns true once XLSX is available. */
let _sheetjsReady = false;
function ensureSheetJS(){
  if(_sheetjsReady || typeof XLSX!=='undefined'){ _sheetjsReady = true; return true; }
  const src = document.getElementById('sheetjs-src');
  if(src && src.textContent){
    try{
      (0,eval)(src.textContent);      // indirect eval → runs in global scope, defines window.XLSX
      _sheetjsReady = (typeof XLSX!=='undefined');
      return _sheetjsReady;
    }catch(e){ /* fall through */ }
  }
  return (typeof XLSX!=='undefined');
}

function exportShipXLSX(){
  if(!ensureSheetJS()){ toast('Excel engine could not load'); return; }
  const rows = scheduleForExport();
  /* --- Schedule sheet --- */
  const aoa = [SHIP_EXPORT_COLS];
  const groupRowIdx = [];
  rows.forEach(l=>{
    if(l.isCategory){ groupRowIdx.push(aoa.length); aoa.push(['=== '+l.catLabel+' — '+l.optName+' ===']); return; }
    if(l.isLot){ groupRowIdx.push(aoa.length); aoa.push(['   LOT: Accessory Package — '+l.type]); return; }
    if(l.isGroup){ groupRowIdx.push(aoa.length); aoa.push(['▸ '+l.groupName+' ('+l.optName+' '+l.kind+'s)']); }
    else aoa.push(shipRowValues(l));
  });
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [16,9,8,16,30,16,6,12,11,12,12,12,12,12,12,16,12,26,16].map(w=>({wch:w}));
  const nRows = aoa.length-1;
  for(let r=1;r<=nRows;r++){
    if(groupRowIdx.includes(r)) continue;
    const cell = ws[XLSX.utils.encode_cell({r, c:7})];
    if(cell){ cell.t='n'; cell.z='$#,##0.00'; }
    const qcell = ws[XLSX.utils.encode_cell({r, c:6})];
    if(qcell) qcell.t='n';
  }
  ws['!autofilter'] = {ref:`A1:${XLSX.utils.encode_col(SHIP_EXPORT_COLS.length-1)}${nRows+1}`};

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Ship Schedule');

  /* --- Invoices sheet --- */
  if(state.invoices.length){
    const iaoa = [['Invoice','Number','Date','Status','Total ($)']];
    state.invoices.forEach(v=> iaoa.push([v.name, v.number, v.date, v.status, invoiceTotal(v.id)]));
    const iws = XLSX.utils.aoa_to_sheet(iaoa);
    iws['!cols']=[22,14,14,10,14].map(w=>({wch:w}));
    for(let r=1;r<=state.invoices.length;r++){
      const c = iws[XLSX.utils.encode_cell({r,c:4})];
      if(c){ c.t='n'; c.z='$#,##0.00'; }
    }
    XLSX.utils.book_append_sheet(wb, iws, 'Invoices');
  }
  XLSX.writeFile(wb, (state.name||'lighting')+'_shipping_'+exportSuffix()+'.xlsx');
  toast('Excel schedule exported');
}

/* Full estimate export — one sheet per option with fixtures, controls, services,
   allowance/freight, change orders, and totals. Mirrors the BOM template layout. */
function exportEstimateXLSX(){
  if(!ensureSheetJS()){ toast('Excel engine could not load'); return; }
  const wb = XLSX.utils.book_new();
  const HDR = ['Qty','Type','Tag','Manufacturer','Description','Part #','Unit cost','Markup %','Unit sell','Ext. cost','Ext. sell','Notes','Price source'];
  const moneyCols = [6,8,9,10];   // zero-based col indices to format as currency

  state.options.forEach((opt,oi)=>{
    const t = optionTotals(opt);
    const aoa = [];
    aoa.push([ (state.company? state.company+' — ':'') + (state.name||'Lighting BOM') ]);
    aoa.push([ 'Option: '+opt.name + (opt.approved?'  (APPROVED)':'') ]);
    if(state.jobCode) aoa.push(['Job code: '+state.jobCode]);
    if(state.client) aoa.push(['Client: '+state.client]);
    aoa.push([]);

    const moneyRows = [];
    function sectionToRows(title, rows, dm, isFix){
      aoa.push([title]);
      aoa.push(HDR);
      rows.forEach(r=>{
        if(r.isSection){ aoa.push(['  '+(r.name||'Section')]); return; }
        if(!r.desc && !r.part && !r.type && !(r.qty>0) && !(r.accessories&&r.accessories.length)) return;
        const c = rowCalc(r, dm);
        moneyRows.push(aoa.length);
        aoa.push([numOr(r.qty,0), r.type||'', isFix?(r.tag||''):'', r.mfr||'', r.desc||'', r.part||'',
                  numOr(r.unitCost,0), pct2x(r.markup===null?dm:r.markup), c.unitSell, c.extCost, c.extSell, r.note||'', r.source||'']);
        (r.accessories||[]).forEach(a=>{
          const ac = accCalc(a, r, dm);
          moneyRows.push(aoa.length);
          aoa.push([ac.qty, r.type||'', '', a.mfr||'MISC.', '  ↳ '+(a.desc||''), a.part||'',
                    numOr(a.unitCost,0), pct2x(a.markup===null?dm:a.markup), ac.unitSell, ac.extCost, ac.extSell, a.note||'', a.source||'']);
        });
      });
      aoa.push([]);
    }
    sectionToRows('LIGHT FIXTURES', opt.fixtures, opt.fixtureMarkup, true);
    sectionToRows('LIGHTING CONTROLS', opt.controls, opt.controlMarkup, false);

    /* services (sell-only) */
    const anySvc = (opt.services||[]).some(g=>(g.rows||[]).some(s=>s.qty>0||s.desc||(s.addons||[]).length));
    if(anySvc){
      aoa.push(['SERVICES']);
      aoa.push(['Qty','Unit','Location','Description','Sell rate','Ext. sell','Price source','Notes']);
      (opt.services||[]).forEach(g=>{
        if(!(g.rows||[]).some(s=>s.qty>0||s.desc||(s.addons||[]).length)) return;
        aoa.push(['  '+(g.name||'Services')]);
        (g.rows||[]).forEach(s=>{
          if(!s.desc && !(s.qty>0) && !(s.addons||[]).length) return;
          const c = serviceCalc(s);
          moneyRows.push(aoa.length);
          aoa.push([numOr(s.qty,0), s.unit||'', s.location||'', s.desc||'', numOr(s.sellRate,0), c.lineSell, s.source||'', s.note||'']);
          (s.addons||[]).forEach(a=>{
            moneyRows.push(aoa.length);
            aoa.push(['  '+svcAddonQty(a,s), '', '', '   + '+(a.desc||''), numOr(a.sellRate,0), svcAddonSell(a,s), a.source||'', a.note||'']);
          });
        });
      });
      aoa.push([]);
    }

    /* allowance / freight recap */
    aoa.push(['ALLOWANCE & FREIGHT']);
    aoa.push(['Item','','','','','','','','','Cost','Sell']);
    const af = t.af;
    [['Allowance (Fixtures)',af.allowCost,af.allowSell],['Freight (Fixtures)',af.freightCost,af.freightSell],['Allowance (Controls)',af.ctrlAllowCost,af.ctrlAllowSell]].forEach(([lbl,co,se])=>{
      moneyRows.push(aoa.length);
      aoa.push([lbl,'','','','','','','','',co,se]);
    });
    aoa.push([]);

    /* change orders */
    if((opt.changeOrders||[]).length){
      aoa.push(['CHANGE ORDERS']);
      opt.changeOrders.forEach(co=>{
        const ct = bomTotals(co);
        aoa.push(['CO #'+co.number+': '+co.name+'  ('+co.status+')']);
        aoa.push(HDR);
        [['fixtures',co.fixtureMarkup,true],['controls',co.controlMarkup,false]].forEach(([k,dm,isFix])=>{
          (co[k]||[]).forEach(r=>{
            if(r.isSection || (!r.desc && !r.part && !r.type && !(r.qty>0))) return;
            const c=rowCalc(r,dm);
            moneyRows.push(aoa.length);
            aoa.push([numOr(r.qty,0), r.type||'', isFix?(r.tag||''):'', r.mfr||'', r.desc||'', r.part||'', numOr(r.unitCost,0), pct2x(r.markup===null?dm:r.markup), c.unitSell, c.extCost, c.extSell, r.note||'', r.source||'']);
          });
        });
        moneyRows.push(aoa.length);
        aoa.push(['','','','','CO subtotal','','','','','',ct.sub]);
        aoa.push([]);
      });
    }

    /* totals */
    const totRows = [];
    function totLine(lbl,val){ totRows.push(aoa.length); moneyRows.push(aoa.length); aoa.push([lbl,'','','','','','','','','',val]); }
    aoa.push(['TOTALS']);
    if((opt.changeOrders||[]).length){
      totLine('Approved base subtotal', t.baseSub);
      totLine('Change orders', t.coSellTotal);
    }
    totLine('Subtotal', t.sub);
    totLine('Tax ('+state.taxRate+'%)', t.tax);
    totLine('Total with tax', t.grand);
    totLine('Your cost', t.cost);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [7,9,12,18,32,16,11,9,11,12,12,18,16].map(w=>({wch:w}));
    /* currency format on the sell/cost columns */
    moneyRows.forEach(r=>{
      moneyCols.forEach(c=>{
        const cell = ws[XLSX.utils.encode_cell({r,c})];
        if(cell && typeof cell.v==='number'){ cell.t='n'; cell.z='$#,##0.00'; }
      });
      /* total lines put value in col 10 */
      const tc = ws[XLSX.utils.encode_cell({r,c:10})];
      if(tc && typeof tc.v==='number'){ tc.t='n'; tc.z='$#,##0.00'; }
    });
    const safe = (opt.name||('Option'+(oi+1))).replace(/[\\/?*\[\]:]/g,'').slice(0,28) || ('Option'+(oi+1));
    XLSX.utils.book_append_sheet(wb, ws, safe);
  });

  XLSX.writeFile(wb, (state.name||'lighting')+'_estimate_'+exportSuffix()+'.xlsx');
  toast('Estimate exported to Excel');
}

function printShipSchedule(){
  const rows = scheduleForExport();
  const filterLabel = shipFilter==='all' ? 'All options' : (state.options[shipFilter]?.name||'');
  const esc2 = s => esc(s??'');
  const cols = shipPrintColsVisible();
  const ncol = cols.length;
  const bodyRows = rows.map(l=>{
    if(l.isCategory){
      return `<tr class="catband"><td colspan="${ncol}">${esc2(l.catLabel)} — ${esc2(l.optName)}</td></tr>`;
    }
    if(l.isGroup){
      return `<tr class="grp"><td colspan="${ncol}">▸ ${esc2(l.groupName)} <span style="font-weight:normal;color:#777">(${esc2(l.optName)} · ${esc2(l.kind)}s)</span></td></tr>`;
    }
    const m=l.meta||{}; const st=shipStatus(m)[0];
    const cat = l.isAccessory ? 'Accessory' : l.kind;
    const tUrl = trackingUrl(m.shipper, m.tracking);
    const trkCell = m.tracking ? (tUrl?`<a href="${esc(tUrl)}">${esc2(m.tracking)}</a>`:esc2(m.tracking)) : '';
    const invName = (state.invoices.find(v=>v.id===m.invoiceId)||{}).name||'';
    const cell = {
      optName:{h:esc2(l.optName)}, cat:{h:esc2(cat)}, type:{h:esc2(l.type)}, mfr:{h:esc2(l.mfr)},
      desc:{h:(l.isAccessory?'↳ ':'')+esc2(l.desc), cls:l.isAccessory?'acc':''},
      part:{h:esc2(l.part),cls:'mono'}, qty:{h:l.qty,cls:'r'}, sold:{h:money(numOr(l.sold,0)),cls:'r'},
      status:{h:st}, po:{h:esc2(m.po)}, orderDate:{h:esc2(m.orderDate)}, recvDate:{h:esc2(m.recvDate)},
      estShip:{h:esc2(m.estShip)}, shipDate:{h:esc2(m.shipDate)}, shipper:{h:esc2(m.shipper)},
      tracking:{h:trkCell,cls:'mono'}, delivery:{h:esc2(m.delivery)}, comments:{h:esc2(m.comments)}, invoice:{h:esc2(invName)}
    };
    const tds = cols.map(c=>{ const x=cell[c.key]||{h:''}; return `<td class="${x.cls||''}">${x.h}</td>`; }).join('');
    return `<tr${l.isAccessory?' class="accrow"':''}>${tds}</tr>`;
  }).join('');
  const totalSold = rows.filter(l=>!l.isGroup && !l.isCategory).reduce((a,l)=>a+numOr(l.sold,0),0);
  const invRows = state.invoices.map(v=>`<tr><td>${esc2(v.name)}</td><td>${esc2(v.number)}</td>
    <td>${esc2(v.date)}</td><td>${esc2(v.status)}</td><td class="r">${money(invoiceTotal(v.id))}</td></tr>`).join('');
  const headCells = cols.map(c=>`<th>${c.label}</th>`).join('');
  const w = window.open('', '_blank');
  if(!w){ toast('Pop-up blocked — allow pop-ups to print'); return; }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>${esc2(state.name||'Lighting')} — Ship Schedule</title>
    <style>
      *{box-sizing:border-box}
      body{font-family:Arial,Helvetica,sans-serif;color:#20242C;margin:24px;font-size:10px}
      h1{font-size:16px;margin:0 0 2px}
      .meta{font-size:11px;color:#555;margin-bottom:14px}
      .meta b{color:#20242C}
      table{width:100%;border-collapse:collapse;margin-bottom:18px}
      th{background:#20242C;color:#fff;font-size:8px;letter-spacing:.04em;text-transform:uppercase;
        padding:5px 4px;text-align:left;white-space:nowrap}
      td{border-bottom:1px solid #ddd;padding:4px;vertical-align:top}
      td.r,th.r{text-align:right}
      .mono{font-family:"Courier New",monospace}
      tbody tr:nth-child(even){background:#f6f5f1}
      tr.grp td{background:#20242C;color:#fff;font-weight:bold;font-size:10px;padding:5px 6px}
      tr.catband td{background:#000;color:#E9B45C;font-weight:bold;font-size:11px;padding:6px;letter-spacing:.06em;text-transform:uppercase}
      tr.accrow td{color:#555}
      td.acc{padding-left:14px;color:#555}
      .sum{font-size:12px;font-weight:bold;text-align:right;margin:6px 0 18px}
      h2{font-size:12px;border-bottom:2px solid #20242C;padding-bottom:3px;margin:18px 0 6px}
      a{color:#1558b0;text-decoration:underline}
      .dochead{display:flex;align-items:center;gap:14px;margin:0 0 6px}
      .doclogo{height:46px;width:auto;display:block}
      @media print{body{margin:8mm}@page{size:landscape}}
    </style></head><body>
    <div class="dochead">${logoImg()}<h1>${esc2(state.name||'Lighting Project')} — Shipping &amp; Procurement Schedule</h1></div>
    <div class="meta">
      ${state.client?`<b>Client:</b> ${esc2(state.client)} &nbsp;·&nbsp; `:''}
      <b>Scope:</b> ${esc2(filterLabel)} &nbsp;·&nbsp;
      <b>Items:</b> ${rows.length} &nbsp;·&nbsp;
      <b>Printed:</b> ${new Date().toLocaleDateString()}
    </div>
    <table><thead><tr>${headCells}</tr></thead><tbody>${bodyRows||'<tr><td colspan="19">No items</td></tr>'}</tbody></table>
    ${state.invoices.length?`<h2>Invoices</h2>
      <table><thead><tr><th>Invoice</th><th>Number</th><th>Date</th><th>Status</th><th class="r">Total</th></tr></thead>
      <tbody>${invRows}</tbody></table>`:''}
    </body></html>`);
  w.document.close();
  setTimeout(()=>{ w.focus(); w.print(); }, 350);
  toast('Opening printable schedule…');
}

/* ================= Ship Advice module ================= */
/* Ship advices model the template's Ship Log: each advice has delivery address +
   contact, an auto-incrementing Shipment Name (Job Code - 001), tracking #, and
   line items pulled from the ship schedule (only not-yet-shipped fixtures/controls). */
function jobCode(){
  /* use the explicit Job Code field if set, else derive from the project name */
  const explicit = (state.jobCode||'').trim();
  if(explicit) return explicit;
  const n = (state.name||'').trim();
  if(!n) return 'JOB';
  const caps = n.replace(/[^A-Za-z0-9 ]/g,'').split(/\s+/).map(w=>w[0]).join('').toUpperCase();
  return (caps.length>=2 ? caps : n.slice(0,4).toUpperCase());
}
function nextShipmentName(){
  const code = jobCode();
  const n = (state.shipAdvices||[]).length + 1;
  return `${code} - ${String(n).padStart(3,'0')}`;
}
function blankAdvice(){
  return { id:uid(), shipmentName:nextShipmentName(), shipmentDate:"", estDelivery:"",
           via:"", tracking:"", addressId:null,
           attn:"", business:"", address:"", cityStateZip:"",
           itemIds:[], itemMeta:{} };
}
/* Per-item shipping detail on an advice: pallet #, box #, and optional per-item
   shipper / tracking / est. ship / est. delivery (for tagging items to different
   shipments). Stored as advice.itemMeta[rowId] = {pallet,box,via,tracking,estShip,estDelivery}. */
function adviceItemMeta(a, rowId){
  if(!a.itemMeta) a.itemMeta = {};
  if(!a.itemMeta[rowId]) a.itemMeta[rowId] = {};
  return a.itemMeta[rowId];
}
function setAdviceItemField(adviceId, rowId, k, v){
  const a = (state.shipAdvices||[]).find(x=>x.id===adviceId); if(!a) return;
  adviceItemMeta(a, rowId)[k] = v; markDirty();
}
function addAdvice(){
  if(!state.shipAdvices) state.shipAdvices=[];
  state.shipAdvices.push(blankAdvice());
  markDirty(); renderAdvice();
}
function delAdvice(id){
  state.shipAdvices = (state.shipAdvices||[]).filter(a=>a.id!==id);
  markDirty(); renderAdvice();
}
function setAdviceField(id,k,v){
  const a = state.shipAdvices.find(x=>x.id===id); if(!a) return;
  a[k]=v; markDirty();
  if(k==='addressId'||k==='via'||k==='tracking') renderAdvice();
}
/* Save the current advice's address block as a reusable saved address */
function saveAdviceAddress(id){
  const a = state.shipAdvices.find(x=>x.id===id); if(!a) return;
  if(!a.business && !a.address){ toast('Enter an address first'); return; }
  if(!state.savedAddresses) state.savedAddresses=[];
  const entry = { id:uid(), label:(a.business||a.address||'Address').slice(0,40),
                  attn:a.attn, business:a.business, address:a.address, cityStateZip:a.cityStateZip };
  state.savedAddresses.push(entry);
  a.addressId = entry.id;
  markDirty(); renderAdvice();
  toast('Address saved for reuse');
}
function applyAddress(id, addrId){
  const a = state.shipAdvices.find(x=>x.id===id); if(!a) return;
  a.addressId = addrId || null;
  if(addrId){
    const ad = (state.savedAddresses||[]).find(x=>x.id===addrId);
    if(ad){ a.attn=ad.attn; a.business=ad.business; a.address=ad.address; a.cityStateZip=ad.cityStateZip; }
  }
  markDirty(); renderAdvice();
}
function delSavedAddress(addrId){
  state.savedAddresses = (state.savedAddresses||[]).filter(a=>a.id!==addrId);
  (state.shipAdvices||[]).forEach(a=>{ if(a.addressId===addrId) a.addressId=null; });
  markDirty(); renderAdvice();
}

/* An item is "shipped" if its ship-schedule meta has a Shipped date or Delivery date. */
function itemIsShipped(rowId){
  const m = state.shipMeta[rowId];
  return !!(m && (m.shipDate || m.delivery));
}
/* Which advice (if any) already contains this item */
function adviceForItem(rowId){
  return (state.shipAdvices||[]).find(a=>(a.itemIds||[]).includes(rowId));
}
/* Schedule items eligible to add: fixtures & controls (not accessories/lot/piece/service),
   not yet shipped, and not already on another advice. */
function eligibleAdviceItems(){
  const saved = shipFilter; shipFilter='all';
  const all = buildSchedule(); shipFilter=saved;
  return all.filter(l=>!l.isGroup && !l.isCategory && !l.isLot && !l.isPiece && !l.isAccessory && !l.isService
    && (l.kind==='Fixture'||l.kind==='Control'));
}
function addItemToAdvice(adviceId, rowId){
  const a = state.shipAdvices.find(x=>x.id===adviceId); if(!a) return;
  if(!a.itemIds) a.itemIds=[];
  if(!a.itemIds.includes(rowId)) a.itemIds.push(rowId);
  markDirty(); renderAdvice();
}
function removeItemFromAdvice(adviceId, rowId){
  const a = state.shipAdvices.find(x=>x.id===adviceId); if(!a) return;
  a.itemIds = (a.itemIds||[]).filter(id=>id!==rowId);
  markDirty(); renderAdvice();
}
/* resolve a stored item id to its live schedule line */
function adviceLineData(rowId){
  const all = eligibleAdviceItemsAll();
  return all.find(l=>l.id===rowId);
}
function eligibleAdviceItemsAll(){
  const saved = shipFilter; shipFilter='all';
  const all = buildSchedule(); shipFilter=saved;
  return all.filter(l=>!l.isGroup && !l.isCategory && !l.isLot && !l.isPiece && !l.isAccessory && !l.isService);
}

let adviceAddPicker = null;   // adviceId currently showing the add-item picker

function renderAdvice(){
  const el = document.getElementById('adviceView');
  const advices = state.shipAdvices||[];

  const head = `
    <div class="ship-toolbar">
      <div class="ship-import">
        <label>Ship advices</label>
        <span class="ship-live-note">Create delivery advices and pull in fixtures &amp; controls that haven't shipped yet.</span>
      </div>
      <div class="grow"></div>
      <button class="primary" onclick="addAdvice()">+ New ship advice</button>
    </div>`;

  if(advices.length===0){
    el.innerHTML = head + `<div class="ship-empty">
      No ship advices yet. Click <b>New ship advice</b> to create one — you can add a delivery address (saved for reuse), a shipment name that auto-numbers, a tracking number, and line items from the schedule that haven't shipped.
    </div>`;
    return;
  }

  const savedAddrs = state.savedAddresses||[];
  el.innerHTML = head + advices.map(a=>{
    const addrOpts = `<option value="">— New / manual address —</option>` +
      savedAddrs.map(ad=>`<option value="${ad.id}" ${a.addressId===ad.id?'selected':''}>${esc(ad.label)}</option>`).join('');

    /* line items table — Qty/Cat/Type/Manuf/Part/Desc plus editable per-item
       Pallet #, Box #, Shipper, Tracking #, Est. ship and Est. delivery. */
    const COLSPAN = 13;
    const itemRows = (a.itemIds||[]).map(rowId=>{
      const l = adviceLineData(rowId);
      if(!l) return `<tr><td colspan="${COLSPAN-1}" class="dim">(item no longer in schedule)</td><td class="no-print"><button class="ship-rowdel" onclick="removeItemFromAdvice('${a.id}','${rowId}')">✕</button></td></tr>`;
      const shipped = itemIsShipped(rowId);
      const m = (a.itemMeta&&a.itemMeta[rowId])||{};
      const fld = (k,ph,extra='') => `<input class="adv-item-in" value="${esc(m[k]||'')}" placeholder="${ph}" ${extra} onchange="setAdviceItemField('${a.id}','${rowId}','${k}',this.value)">`;
      return `<tr>
        <td class="r mono">${l.qty}</td>
        <td>${esc(l.kind)}</td>
        <td>${esc(l.type)}</td>
        <td>${esc(l.mfr)}</td>
        <td class="mono">${esc(l.part)}</td>
        <td>${esc(l.desc)}${shipped?' <span class="adv-shipped">shipped</span>':''}</td>
        <td>${fld('pallet','Pallet #')}</td>
        <td>${fld('box','Box #')}</td>
        <td>${fld('via','Shipper')}</td>
        <td>${fld('tracking','Tracking #')}</td>
        <td>${fld('estShip','mm/dd/yyyy')}</td>
        <td>${fld('estDelivery','mm/dd/yyyy')}</td>
        <td class="no-print"><button class="ship-rowdel" title="Remove" onclick="removeItemFromAdvice('${a.id}','${rowId}')">✕</button></td>
      </tr>`;
    }).join('');

    /* add-item picker */
    let picker = '';
    if(adviceAddPicker===a.id){
      const elig = eligibleAdviceItems().filter(l=>!itemIsShipped(l.id) && !adviceForItem(l.id));
      picker = `<div class="adv-picker">
        <div class="adv-picker-head">Add items that haven't shipped <button class="ghost" onclick="adviceAddPicker=null;renderAdvice()">Done</button></div>
        ${elig.length? `<div class="adv-picker-list">${elig.map(l=>`
          <button class="adv-pick-item" onclick="addItemToAdvice('${a.id}','${l.id}')">
            <span class="api-qty">${l.qty}×</span>
            <span class="api-type">${esc(l.type||'—')}</span>
            <span class="api-cat">${esc(l.kind)}</span>
            <span class="api-desc">${esc(l.desc||l.part||'')}</span>
          </button>`).join('')}</div>`
          : `<div class="adv-picker-empty">No unshipped items available to add. (Items already shipped or on another advice are excluded.)</div>`}
      </div>`;
    }

    return `<div class="adv-card">
      <div class="adv-card-head">
        <div class="adv-shipname">
          <label>Shipment Name / #</label>
          <input value="${esc(a.shipmentName)}" onchange="setAdviceField('${a.id}','shipmentName',this.value)">
        </div>
        <button class="adv-del no-print" title="Delete advice" onclick="delAdvice('${a.id}')">✕</button>
      </div>

      <div class="adv-grid">
        <div class="adv-field"><label>Saved address</label>
          <select onchange="applyAddress('${a.id}', this.value)">${addrOpts}</select></div>
        <div class="adv-field"><label>Attn line</label>
          <input value="${esc(a.attn)}" onchange="setAdviceField('${a.id}','attn',this.value)"></div>
        <div class="adv-field"><label>Business name / firm</label>
          <input value="${esc(a.business)}" onchange="setAdviceField('${a.id}','business',this.value)"></div>
        <div class="adv-field"><label>Delivery address</label>
          <input value="${esc(a.address)}" onchange="setAdviceField('${a.id}','address',this.value)"></div>
        <div class="adv-field"><label>City, State Zip</label>
          <input value="${esc(a.cityStateZip)}" onchange="setAdviceField('${a.id}','cityStateZip',this.value)"></div>
        <div class="adv-field adv-saveaddr no-print">
          <button class="ghost" onclick="saveAdviceAddress('${a.id}')">Save address for reuse</button></div>
      </div>

      <div class="adv-grid adv-grid2">
        <div class="adv-field"><label>Shipment date</label>
          <input value="${esc(a.shipmentDate)}" placeholder="mm/dd/yyyy" onchange="setAdviceField('${a.id}','shipmentDate',this.value)"></div>
        <div class="adv-field"><label>Est. delivery date</label>
          <input value="${esc(a.estDelivery)}" placeholder="mm/dd/yyyy" onchange="setAdviceField('${a.id}','estDelivery',this.value)"></div>
        <div class="adv-field"><label>Via</label>
          <input value="${esc(a.via)}" placeholder="Carrier" onchange="setAdviceField('${a.id}','via',this.value)"></div>
        <div class="adv-field"><label>Tracking #</label>
          <div class="adv-trk">
            <input value="${esc(a.tracking)}" onchange="setAdviceField('${a.id}','tracking',this.value)">
            ${trackingUrl(a.via,a.tracking)?`<a class="trk-link no-print" href="${esc(trackingUrl(a.via,a.tracking))}" target="_blank" rel="noopener" title="Track shipment">Track ↗</a>`:''}
          </div></div>
      </div>

      <div class="adv-items">
        <div class="adv-items-head">
          <h3>Line items (${(a.itemIds||[]).length})</h3>
          <span class="adv-items-note no-print">Fill in Pallet #/Box #, or tag items to different shippers, tracking #s &amp; dates. Blank columns are hidden on the printout.</span>
          <button class="ghost no-print" onclick="adviceAddPicker='${a.id}';renderAdvice()">+ Add from schedule</button>
        </div>
        ${(a.itemIds||[]).length? `<div class="adv-items-scroll"><table class="adv-items-table">
          <thead><tr><th class="r">Qty</th><th>Cat.</th><th>Type</th><th>Manuf.</th><th>Part #</th><th>Description</th>
            <th>Pallet #</th><th>Box #</th><th>Shipper</th><th>Tracking #</th><th>Est. ship</th><th>Est. delivery</th><th class="no-print"></th></tr></thead>
          <tbody>${itemRows}</tbody></table></div>` : `<div class="adv-noitems">No items yet — add fixtures or controls that haven't shipped.</div>`}
        ${picker}
      </div>
    </div>`;
  }).join('') + savedAddressManager();
}

function savedAddressManager(){
  const addrs = state.savedAddresses||[];
  if(addrs.length===0) return '';
  return `<div class="adv-saved-mgr">
    <div class="ship-sec-head"><span class="tick" style="background:var(--sell)"></span><h2>Saved Addresses</h2></div>
    <div class="adv-saved-list">${addrs.map(ad=>`
      <div class="adv-saved-item">
        <span class="asi-label">${esc(ad.label)}</span>
        <span class="asi-detail">${esc(ad.business||'')}${ad.cityStateZip?' · '+esc(ad.cityStateZip):''}</span>
        <button class="ship-rowdel no-print" title="Delete saved address" onclick="delSavedAddress('${ad.id}')">✕</button>
      </div>`).join('')}</div>
  </div>`;
}

/* ================= File: save / open / export ================= */
let fileHandle = null;
const FILE_TYPES = [{description:"Lighting BOM project", accept:{"application/json":[".json"]}}];

/* Save-file schema version. Bump when the shape changes. Loaders are defensive
   (normalize + default) so a NEW build opens any OLDER file and upgrades it. */
const SAVE_VERSION = 4;
/* Add legacy-friendly mirror fields so an OLDER build degrades gracefully rather
   than breaking. Today: services are sell-only (sellRate); older builds expect
   unitCost+markup, so mirror sellRate as unitCost with 0% markup — old builds then
   show the correct sell (add-ons are dropped there, but sells stay right). */
function compatForSave(s){
  const c = JSON.parse(JSON.stringify(s));
  const mirrorSvc = g => (g.rows||[]).forEach(row=>{ if(row.sellRate!==undefined){ row.unitCost = numOr(row.sellRate,0); row.markup = 0; } });
  (c.options||[]).forEach(o=>{
    (o.services||[]).forEach(mirrorSvc);
    (o.changeOrders||[]).forEach(co=> (co.services||[]).forEach(mirrorSvc));
  });
  return c;
}
function projectJSON(){
  /* prune shipMeta entries that no longer match any BOM row (deleted parts) */
  const liveIds = new Set();
  state.options.forEach(o=>{
    ['fixtures','controls'].forEach(k=> o[k].forEach(r=>{
      liveIds.add(r.id);
      (r.accessories||[]).forEach(a=>liveIds.add(a.id));
    }));
  });
  const meta = {};
  Object.keys(state.shipMeta||{}).forEach(id=>{ if(liveIds.has(id)) meta[id]=state.shipMeta[id]; });
  const clean = compatForSave({...state, shipMeta:meta});
  return JSON.stringify({app:"lighting-bom", version:SAVE_VERSION, saved:new Date().toISOString(), ...clean}, null, 2);
}
function suggestedName(){
  return (state.name? state.name.replace(/[^\w\- ]+/g,"").trim().replace(/\s+/g,"_") : "lighting_bom") + ".json";
}
async function saveProject(saveAs){
  const data = projectJSON();
  if(window.showSaveFilePicker){
    try{
      if(saveAs || !fileHandle){
        fileHandle = await window.showSaveFilePicker({suggestedName:suggestedName(), types:FILE_TYPES});
      } else if(fileHandle.queryPermission){
        /* A handle re-bound after a PWA update reload may need write permission
           re-granted — request it within this Save click (a user gesture). */
        let p = await fileHandle.queryPermission({mode:'readwrite'});
        if(p!=='granted' && fileHandle.requestPermission) p = await fileHandle.requestPermission({mode:'readwrite'});
        if(p!=='granted'){ fileHandle = await window.showSaveFilePicker({suggestedName:suggestedName(), types:FILE_TYPES}); }
      }
      const w = await fileHandle.createWritable();
      await w.write(data); await w.close();
      markSaved(); pushRecent(); render();
      toast("Saved: "+fileHandle.name);
      return;
    }catch(err){
      if(err && err.name==="AbortError") return;     // user cancelled the picker
      /* fall through to download fallback */
    }
  }
  const blob = new Blob([data], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = suggestedName();
  a.click(); URL.revokeObjectURL(a.href);
  markSaved(); pushRecent(); render();
  toast("Project file saved to your Downloads");
}
async function openClick(){
  if(dirty){
    const ok = await showConfirm('Unsaved changes', 'Opening a project will discard unsaved changes. Continue?', 'Open anyway', 'primary');
    if(!ok) return;
  }
  if(window.showOpenFilePicker){
    try{
      const [h] = await window.showOpenFilePicker({types:FILE_TYPES});
      fileHandle = h;
      const f = await h.getFile();
      loadFromText(await f.text(), f.name);
      return;
    }catch(err){
      if(err && err.name==="AbortError") return;
      /* fall through to input fallback */
    }
  }
  document.getElementById("fileOpen").click();
}
function openProject(input){
  const file = input.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{ fileHandle=null; loadFromText(reader.result, file.name); };
  reader.readAsText(file); input.value="";
}
function loadFromText(text, label){
  try{
    const d = JSON.parse(text);
    applyProject(d);
    dirty=false; lastSavedAt=Date.now(); pushRecent(); render(); updateSaveStamp();
    /* Forward-compat notice: opening a file written by a newer app version. */
    if(typeof d.version==='number' && d.version > SAVE_VERSION){
      toast("Opened a file from a newer version — some newer details may be simplified.");
    } else {
      toast("Project opened: "+(state.name||label));
    }
  }catch(err){ alert("Could not open this file — it doesn't look like a Lighting BOM project file."); }
}
function applyProject(d){
  if(!d.options || !Array.isArray(d.options)) throw new Error("not a BOM file");
  state = {
    name:d.name||"", jobCode:String(d.jobCode||""), client:d.client||"", preparedBy:d.preparedBy||"", company:String(d.company||""),
    date:d.date||new Date().toLocaleDateString(),
    taxRate: typeof d.taxRate==="number"? d.taxRate : 0,
    taxLocation: String(d.taxLocation||""),
    taxCheckedDate: String(d.taxCheckedDate||""),
    options: d.options.map(o=>({
      name:o.name||"Option",
      fixtureMarkup: typeof o.fixtureMarkup==="number"? o.fixtureMarkup:0,
      controlMarkup: typeof o.controlMarkup==="number"? o.controlMarkup:0,
      serviceMarkup: typeof o.serviceMarkup==="number"? o.serviceMarkup:(typeof o.fixtureMarkup==="number"?o.fixtureMarkup:50),
      allowancePct: typeof o.allowancePct==="number"? o.allowancePct:1,
      freightPct: typeof o.freightPct==="number"? o.freightPct:5,
      controlAllowancePct: typeof o.controlAllowancePct==="number"? o.controlAllowancePct:1,
      allowCostOv:numOrNull(o.allowCostOv), allowSellOv:numOrNull(o.allowSellOv),
      freightCostOv:numOrNull(o.freightCostOv), freightSellOv:numOrNull(o.freightSellOv),
      ctrlAllowCostOv:numOrNull(o.ctrlAllowCostOv), ctrlAllowSellOv:numOrNull(o.ctrlAllowSellOv),
      approved: !!o.approved,
      baseLocked: o.baseLocked!==false,
      changeOrders: Array.isArray(o.changeOrders)? o.changeOrders.map(normChangeOrder) : [],
      fixtures:(o.fixtures||[]).map(normRow),
      controls:(o.controls||[]).map(r=>{ const nr=normRow(r); if(!nr.isSection) nr.accessories=[]; return nr; }),
      services: Array.isArray(o.services)? o.services.map(normServiceGroup) : []
    })),
    current:0,
    shipMeta:{},
    invoices: Array.isArray(d.invoices)? d.invoices.map(normInvoice) : [],
    shipAdvices: Array.isArray(d.shipAdvices)? d.shipAdvices.map(normAdvice) : [],
    savedAddresses: Array.isArray(d.savedAddresses)? d.savedAddresses.map(normAddress) : [],
    memory: normMemory(d.memory),
    customTags: Array.isArray(d.customTags)? d.customTags.map(v=>String(v)).filter(Boolean) : [],
    defaults: normDefaults(d.defaults)
  };
  if(state.options.length===0) state.options.push(blankOption("Option 1"));
  state.options.forEach(sanitizeLinks);   // repair link groups (single master, ≥2 members)

  /* Load shipMeta (v3+). Keyed by BOM row id. */
  if(d.shipMeta && typeof d.shipMeta==='object'){
    Object.keys(d.shipMeta).forEach(id=>{ state.shipMeta[id] = normMeta(d.shipMeta[id]); });
  }
  /* Legacy migration (v2 snapshot array): match by signature to a live BOM row. */
  if(Array.isArray(d.shipments) && d.shipments.length){
    const bySig = {};
    state.options.forEach(o=>{
      [['fixtures','Fixture',o.fixtureMarkup],['controls','Control',o.controlMarkup]].forEach(([kind,cat])=>{
        o[kind].forEach(r=>{ bySig[[o.name,cat,r.type,r.part,r.desc].join('|')] = r.id; });
      });
    });
    d.shipments.forEach(s=>{
      const sig = [s.optName,s.kind,s.type,s.part,s.desc].join('|');
      const rowId = bySig[sig];
      if(!rowId) return;                       // source part no longer exists; skip
      const m = normMeta(s);
      m.invoiceId = s.invoiceId || null;
      state.shipMeta[rowId] = m;
    });
  }
  resetHistory();
}
function normMeta(s){
  const m = blankMeta();
  ['po','orderDate','recvDate','estShip','shipDate','shipper','tracking','delivery','comments'].forEach(k=>{
    m[k] = String(s[k]??'');
  });
  m.invoiceId = s.invoiceId || null;
  return m;
}
function normInvoice(v){
  return { id:v.id||uid(), name:String(v.name||'Invoice'), number:String(v.number||''),
           date:String(v.date||''), status:['Open','Sent','Paid'].includes(v.status)?v.status:'Open' };
}
function normAdvice(a){
  return { id:a.id||uid(), shipmentName:String(a.shipmentName||''), shipmentDate:String(a.shipmentDate||''),
    estDelivery:String(a.estDelivery||''), via:String(a.via||''), tracking:String(a.tracking||''),
    addressId:a.addressId||null, attn:String(a.attn||''), business:String(a.business||''),
    address:String(a.address||''), cityStateZip:String(a.cityStateZip||''),
    itemIds: Array.isArray(a.itemIds)? a.itemIds.map(String) : [] };
}
function normAddress(a){
  return { id:a.id||uid(), label:String(a.label||'Address'), attn:String(a.attn||''),
    business:String(a.business||''), address:String(a.address||''), cityStateZip:String(a.cityStateZip||'') };
}
function normRow(r){
  if(r && r.isSection) return { id:r.id||uid(), isSection:true, name:String(r.name||'Section') };
  return { id:r.id||uid(), qty:numOr(r.qty,0), type:String(r.type??"").toUpperCase(), mfr:String(r.mfr??""),
    desc:String(r.desc??""), part:String(r.part??""), unitCost:numOr(r.unitCost,0),
    mfrMult:(r.mfrMult==null||r.mfrMult==="")?1:numOr(r.mfrMult,1),
    markup:(r.markup===null||r.markup===undefined||r.markup==="")? null : numOr(r.markup,0),
    note:String(r.note??""), source:String(r.source??""),
    tag:String(r.tag??""),
    ...(r.linkId? {linkId:String(r.linkId), linkMaster:!!r.linkMaster} : {}),
    accessories: Array.isArray(r.accessories)? r.accessories.map(normAccessory) : [],
    pieces: Array.isArray(r.pieces)? r.pieces.map(normPiece) : [] };
}
function normMemory(m){
  const o = {mfr:[], desc:[], type:[]};
  if(m && typeof m==='object'){
    ['mfr','desc','type'].forEach(k=>{ if(Array.isArray(m[k])) o[k] = m[k].map(v=>String(v)).filter(Boolean); });
  }
  return o;
}
function normPiece(pc){ return { id:pc.id||uid(), length:String(pc.length??""), qty:numOr(pc.qty,0) }; }
function normAccessory(a){ return { id:a.id||uid(), desc:String(a.desc??""), part:String(a.part??""),
  mfr:String(a.mfr??"Misc."), qty:(a.qty===null||a.qty===undefined||a.qty==="")? null : numOr(a.qty,0),
  unitCost:numOr(a.unitCost,0), mfrMult:(a.mfrMult==null||a.mfrMult==="")?1:numOr(a.mfrMult,1),
  markup:(a.markup===null||a.markup===undefined||a.markup==="")? null : numOr(a.markup,0),
  note:String(a.note??""), source:String(a.source??"") }; }
function normServiceGroup(g){
  const type = ['supplier','controls','ninja'].includes(g.type) ? g.type
             : (/ninja|design/i.test(g.name||'') ? 'ninja' : 'supplier');
  return { id:g.id||uid(), name:String(g.name||'Services'), type,
    rows: Array.isArray(g.rows)? g.rows.map(normService) : [] };
}
function normServiceAddon(a){
  return { id:a.id||uid(), desc:String(a.desc??""), sellRate:numOr(a.sellRate,0),
    qty:(a.qty===null||a.qty===undefined||a.qty==="")? null : numOr(a.qty,0),
    source:String(a.source??""), note:String(a.note??"") };
}
function normService(s){
  /* Migrate legacy cost+markup rows to a sell rate so prior sell amounts are preserved. */
  let sellRate;
  if(s.sellRate!==undefined && s.sellRate!==null && s.sellRate!=="") sellRate = numOr(s.sellRate,0);
  else if(s.unitCost!==undefined){ const mk = (s.markup===null||s.markup===undefined||s.markup==="")?50:numOr(s.markup,0); sellRate = Math.ceil(numOr(s.unitCost,0)*(1+mk/100)); }
  else sellRate = 0;
  const allUnits = ['Trips','Days','Hours','Lump Sum'];
  return { id:s.id||uid(), qty:numOr(s.qty,0),
    unit: allUnits.includes(s.unit)? s.unit : 'Days',
    location: SERVICE_LOCATIONS.includes(s.location)? s.location : 'In Office',
    desc:String(s.desc??""), sellRate,
    source:String(s.source??""), note:String(s.note??""),
    addons: Array.isArray(s.addons)? s.addons.map(normServiceAddon) : [] };
}
function normChangeOrder(co){
  return { id:co.id||uid(), number:co.number||1, name:String(co.name||'Change Order'),
    date:String(co.date||''), status:['Pending','Approved','Rejected'].includes(co.status)?co.status:'Pending',
    fixtureMarkup: typeof co.fixtureMarkup==='number'?co.fixtureMarkup:50,
    controlMarkup: typeof co.controlMarkup==='number'?co.controlMarkup:50,
    serviceMarkup: typeof co.serviceMarkup==='number'?co.serviceMarkup:50,
    allowancePct:numOr(co.allowancePct,0), freightPct:numOr(co.freightPct,0), controlAllowancePct:numOr(co.controlAllowancePct,0),
    fixtures: Array.isArray(co.fixtures)? co.fixtures.map(normRow) : [],
    controls: Array.isArray(co.controls)? co.controls.map(r=>{ const nr=normRow(r); if(!nr.isSection) nr.accessories=[]; return nr; }) : [],
    services: Array.isArray(co.services)? co.services.map(normServiceGroup) : [] };
}

/* ================= Recent projects (stored in this browser) ================= */
const RECENTS_KEY = "lbom_recents_v1";
function storageOK(){
  try{ localStorage.setItem("__lbom_t","1"); localStorage.removeItem("__lbom_t"); return true; }
  catch(e){ return false; }
}
function loadRecents(){
  if(!storageOK()) return [];
  try{ const r = JSON.parse(localStorage.getItem(RECENTS_KEY)); return Array.isArray(r)? r : []; }
  catch(e){ return []; }
}
function pushRecent(){
  if(!storageOK()) return;
  try{
    const key = (state.name||"Untitled project");
    let r = loadRecents().filter(x=>x.key!==key);
    r.unshift({key, saved:new Date().toISOString(),
      data: JSON.parse(JSON.stringify({...state, current:0}))});
    localStorage.setItem(RECENTS_KEY, JSON.stringify(r.slice(0,8)));
  }catch(e){ /* storage full or blocked — recents simply won't update */ }
}
function removeRecent(i){
  const r = loadRecents(); r.splice(i,1);
  try{ localStorage.setItem(RECENTS_KEY, JSON.stringify(r)); }catch(e){}
  renderRecents();
}
async function openRecent(i){
  const r = loadRecents()[i]; if(!r) return;
  if(dirty){
    const ok = await showConfirm('Unsaved changes', `Opening "${r.key}" will discard unsaved changes. Continue?`, 'Open anyway', 'primary');
    if(!ok) return;
  }
  fileHandle = null;
  try{ applyProject(r.data); dirty=false; render(); toast("Opened recent: "+r.key); }
  catch(e){ alert("This recent entry could not be loaded."); }
}
function fmtWhen(iso){
  const d = new Date(iso); if(isNaN(d)) return "";
  return d.toLocaleDateString(undefined,{month:"short",day:"numeric"})+" "+
         d.toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"});
}
function renderRecents(){
  const el = document.getElementById("recents");
  const r = loadRecents();
  if(!storageOK() || r.length===0){ el.innerHTML=""; return; }
  el.innerHTML = `<span class="rc-label">Recent projects</span>` + r.map((x,i)=>
    `<span class="chip" onclick="openRecent(${i})" title="Last saved ${esc(fmtWhen(x.saved))}">
       ${esc(x.key)} <span class="when">${esc(fmtWhen(x.saved))}</span>
       <button class="rc-x" title="Remove from recents" onclick="event.stopPropagation();removeRecent(${i})">✕</button>
     </span>`).join("");
}

/* Print / PDF — routes to the right output for the current view */
function printEstimate(){
  if(view === 'shipping'){ openShipPrint(); return; }
  if(view === 'advice'){ printAdvices(); return; }
  /* Build a branded banner (company + project header) shown only on the printout. */
  const opt = state.options[state.current];
  const banner = document.getElementById('printBanner');
  if(banner){
    const meta = [];
    if(state.jobCode) meta.push('Job code: '+esc(state.jobCode));
    if(state.client) meta.push('Client: '+esc(state.client));
    if(state.preparedBy) meta.push('Prepared by: '+esc(state.preparedBy));
    if(state.date) meta.push(esc(state.date));
    if(opt) meta.push('Option: '+esc(opt.name)+(opt.approved?' (Approved)':''));
    banner.innerHTML = `<div class="print-banner">
      <div class="pb-head">
        ${logoImg()}
        <div class="pb-titles">
          ${state.company?`<div class="pb-co">${esc(state.company)}</div>`:''}
          <div class="pb-proj">${esc(state.name||'Lighting Bill of Materials')}</div>
        </div>
      </div>
      <div class="pb-meta">${meta.join(' &nbsp;·&nbsp; ')}</div>
    </div>`;
  }
  setTimeout(()=>{ try{ window.print(); }catch(e){ toast('Use your browser menu → Print'); } }, 60);
}

/* Printable Ship Advices — laid out to match the Shipping Schedule template's
   "Ship Log" page-1 Ship Advice print view (one advice per page). */
function printAdvices(){
  const advices = state.shipAdvices||[];
  if(advices.length===0){ toast('No ship advices to print'); return; }
  const esc2 = s=>esc(s??'');
  const last = advices.length-1;
  const blocks = advices.map((a,ai)=>{
    const meta = id => (a.itemMeta && a.itemMeta[id]) || {};
    /* only items that still resolve to a schedule line are printed (no blank padding) */
    const ids = (a.itemIds||[]).filter(id=>adviceLineData(id));

    /* Optional columns appear only when there's something to show. */
    const showPallet = ids.some(id=> String(meta(id).pallet||'').trim());
    const showBox    = ids.some(id=> String(meta(id).box||'').trim());
    const perItemShip = ids.some(id=>{ const m=meta(id); return String(m.via||m.tracking||m.estShip||m.estDelivery||'').trim(); });

    /* Header Via / Tracking / Est delivery: "See Below" when items differ. */
    const setOf = (k)=>{ const s=new Set(); ids.forEach(id=>{ const v=String(meta(id)[k]||a[k]||'').trim(); if(v) s.add(v); }); return s; };
    const vias = setOf('via'), tracks = setOf('tracking'), dels = setOf('estDelivery');
    const headVia = vias.size>1 ? 'See Below' : (a.via || [...vias][0] || '-');
    const headTrk = (vias.size>1 || tracks.size>1) ? 'See Below' : (a.tracking || [...tracks][0] || '-');
    const headDel = dels.size>1 ? 'See Below' : (a.estDelivery || [...dels][0] || '-');

    /* Build the column set dynamically. */
    const cols = [
      {h:'QTY', c:true, v:l=>l.qty},
      {h:'TYPE', v:l=>esc2(l.type)},
      {h:'MANUF.', v:l=>esc2(l.mfr)},
      {h:'PART NUMBER', cls:'mono', v:l=>esc2(l.part)},
      {h:'DESCRIPTION', v:l=>esc2(l.desc)},
    ];
    if(showPallet) cols.push({h:'PALLET #', c:true, v:(l,m)=>esc2(m.pallet)});
    if(showBox)    cols.push({h:'BOX #', c:true, v:(l,m)=>esc2(m.box)});
    if(perItemShip){
      cols.push({h:'SHIPPER', v:(l,m)=>esc2(m.via||a.via)});
      cols.push({h:'TRACKING #', cls:'mono', v:(l,m)=>esc2(m.tracking||a.tracking)});
      cols.push({h:'EST DELIVERY', c:true, v:(l,m)=>esc2(m.estDelivery||a.estDelivery)});
    }
    cols.push({h:'SHIPPING NOTES', v:()=>''});   // blank, fillable by hand

    const headCells = cols.map(c=>`<th${c.c?' class="c"':''}>${c.h}</th>`).join('');
    const bodyRows = ids.length ? ids.map(id=>{
      const l = adviceLineData(id), m = meta(id);
      return `<tr>${cols.map(c=>`<td class="${c.cls||''}${c.c?' c':''}">${c.v(l,m)??''}</td>`).join('')}</tr>`;
    }).join('') : `<tr><td colspan="${cols.length}" class="dim">No items on this advice</td></tr>`;

    return `<section class="adv-page${ai===last?'':' brk'}">
      <header class="adv-top">
        <div class="adv-logo">${logoImg()}</div>
        <div class="adv-title">
          <div class="adv-proj">${esc2(state.name||'Project Name Here')}</div>
          <div class="adv-sub">Ship Advice</div>
        </div>
        <div class="adv-job">${esc2(state.jobCode||'')}</div>
      </header>

      <div class="adv-info">
        <div class="adv-shipto">
          <div class="ai-attn">${esc2(a.attn)||'<span class="ph">Attn Line</span>'}</div>
          <div class="ai-biz">${esc2(a.business)||'<span class="ph">Business Name / Firm</span>'}</div>
          <div>${esc2(a.address)||'<span class="ph">Delivery Address</span>'}</div>
          <div>${esc2(a.cityStateZip)||'<span class="ph">City, State Zip</span>'}</div>
        </div>
        <table class="adv-meta">
          <tr><th>SHIPMENT NAME / #</th><td>${esc2(a.shipmentName)||'-'}</td><th>VIA</th><td>${esc2(headVia)}</td></tr>
          <tr><th>SHIPMENT DATE</th><td>${esc2(a.shipmentDate)||'-'}</td><th>TRACKING #</th><td>${esc2(headTrk)}</td></tr>
          <tr><th>EST DELIVERY DATE</th><td>${esc2(headDel)}</td><th></th><td></td></tr>
        </table>
      </div>

      <table class="adv-tbl">
        <thead><tr>${headCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>

      <div class="adv-notes">
        <div class="an-head">SHIPMENT NOTES</div>
        <div class="an-body">Discrepancies, and any externally visible damage or defects to the pallets and/or cartons must be reported within (3) business days.</div>
      </div>

      <div class="adv-sign">Received By <span class="sl"></span> &nbsp;&nbsp; Date <span class="sl short"></span></div>
    </section>`;
  }).join('');
  const w = window.open('', '_blank');
  if(!w){ toast('Pop-up blocked — allow pop-ups to print'); return; }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc2(state.name||'Project')} — Ship Advice</title>
    <style>
      *{box-sizing:border-box}
      body{font-family:Arial,Helvetica,sans-serif;color:#20242C;margin:0;font-size:10px}
      .adv-page{padding:14mm 12mm}
      .adv-page.brk{page-break-after:always}
      .adv-top{display:flex;align-items:center;gap:16px;border-bottom:2px solid #20242C;padding-bottom:8px}
      .adv-logo{flex:0 0 auto}
      .adv-logo img{height:42px;width:auto;display:block}
      .adv-title{flex:1 1 auto;text-align:center}
      .adv-proj{font-size:15px;font-weight:bold}
      .adv-sub{font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#444;margin-top:2px}
      .adv-job{flex:0 0 auto;font-size:13px;font-weight:bold;font-family:'Courier New',monospace}
      .adv-info{display:flex;gap:18px;margin:12px 0 10px;align-items:flex-start}
      .adv-shipto{flex:1 1 40%;line-height:1.55;padding:8px 10px;border:1px solid #bbb;min-height:78px}
      .adv-shipto .ai-attn{font-weight:bold}
      .adv-shipto .ai-biz{font-weight:bold}
      .adv-shipto .ph{color:#aaa;font-weight:normal;font-style:italic}
      .adv-meta{flex:1 1 60%;border-collapse:collapse}
      .adv-meta th{background:#20242C;color:#fff;font-size:8px;letter-spacing:.04em;text-align:left;
        padding:4px 6px;white-space:nowrap;font-weight:bold;border:1px solid #20242C}
      .adv-meta td{border:1px solid #bbb;padding:4px 8px;font-size:10px}
      .adv-tbl{width:100%;border-collapse:collapse;margin-top:4px}
      .adv-tbl th{background:#20242C;color:#fff;font-size:8px;letter-spacing:.03em;text-transform:uppercase;
        text-align:left;padding:5px 6px;border:1px solid #20242C}
      .adv-tbl td{border:1px solid #ccc;padding:4px 6px;font-size:10px;vertical-align:top;height:20px}
      .adv-tbl .c,.adv-tbl th.c{text-align:center}
      .adv-tbl tr.blank td{color:#bbb}
      .mono{font-family:'Courier New',monospace}
      .dim{color:#999;font-style:italic}
      .adv-notes{margin-top:12px;border:1px solid #bbb}
      .an-head{background:#20242C;color:#fff;font-weight:bold;font-size:9px;letter-spacing:.06em;padding:4px 8px}
      .an-body{padding:8px 10px;line-height:1.45;font-size:9.5px}
      .adv-sign{margin-top:22px;font-size:11px}
      .adv-sign .sl{display:inline-block;border-bottom:1px solid #20242C;width:230px;height:1px;vertical-align:bottom}
      .adv-sign .sl.short{width:150px}
      a{color:#1558b0;text-decoration:underline}
      @media print{.adv-page{padding:0}@page{margin:12mm}}
    </style></head><body>${blocks}</body></html>`);
  w.document.close();
  setTimeout(()=>{ w.focus(); w.print(); }, 350);
  toast('Opening printable ship advice…');
}

function exportCSV(){
  const lines = [["Option","Section","Qty","Type","Manufacturer","Description","Part Number","Unit Cost","Markup %","Unit Sell","Ext Cost","Ext Sell"].join(",")];
  const q = s=>`"${String(s??"").replace(/"/g,'""')}"`;
  state.options.forEach(o=>{
    [["Fixtures",o.fixtures,o.fixtureMarkup],["Controls",o.controls,o.controlMarkup]].forEach(([sec,rows,dm])=>{
      rows.forEach(r=>{ const c=rowCalc(r,dm);
        lines.push([q(o.name),sec,r.qty,q(r.type),q(r.mfr??''),q(r.desc),q(r.part),
          r.unitCost.toFixed(2),c.mk,c.unitSell.toFixed(2),c.extCost.toFixed(2),c.extSell.toFixed(2)].join(","));
      });
    });
    const t=optionTotals(o);
    lines.push([q(o.name),"TOTALS","","","","","","","","",t.cost.toFixed(2),t.sub.toFixed(2)].join(","));
    lines.push([q(o.name),`Tax ${state.taxRate}%`,"","","","","","","","","",t.tax.toFixed(2)].join(","));
    lines.push([q(o.name),"TOTAL WITH TAX","","","","","","","","","",t.grand.toFixed(2)].join(","));
  });
  const blob = new Blob([lines.join("\r\n")], {type:"text/csv"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
  a.download=(state.name||"lighting_bom")+".csv"; a.click(); URL.revokeObjectURL(a.href);
  toast("CSV exported");
}
async function newProject(){
  if(dirty){
    const ok = await showConfirm('Unsaved changes', 'Starting a new project will discard unsaved changes. Continue?', 'Discard & start new', 'danger');
    if(!ok) return;
  }
  fileHandle = null;
  state = blankProject(); dirty=false; resetHistory(); render();
}
window.addEventListener("beforeunload", e=>{ if(dirty){ e.preventDefault(); e.returnValue=""; } });
/* Keyboard shortcuts (kept in sync with the help popup, openShortcuts). */
const SHORTCUTS = [
  ['Ctrl/⌘ + S', 'Save project'],
  ['Ctrl/⌘ + O', 'Open project'],
  ['Ctrl/⌘ + Z', 'Undo'],
  ['Ctrl/⌘ + Y  ·  Ctrl/⌘ + Shift + Z', 'Redo'],
  ['Ctrl/⌘ + F', 'Find in this option'],
  ['Ctrl/⌘ + K', 'Search all options'],
  ['Ctrl/⌘ + Enter', 'Add a fixture row'],
  ['Enter', 'In the last row, add a new row'],
  ['Alt + N', 'New option'],
  ['Alt + 1 / 2 / 3', 'Estimate / Procurement / Ship advice'],
  ['?', 'Show this shortcuts list'],
  ['Esc', 'Close a popup'],
];
function openShortcuts(){
  const rows = SHORTCUTS.map(([k,d])=>`<tr><td class="sc-key">${esc(k)}</td><td>${esc(d)}</td></tr>`).join('');
  openModal({ title:'Keyboard shortcuts', wide:false, cancelLabel:'Close',
    bodyHTML:`<table class="sc-table">${rows}</table>` });
}
window.addEventListener("keydown", e=>{
  const mod = e.ctrlKey||e.metaKey;
  const t = e.target;
  const editable = t && (t.tagName==='INPUT' || t.tagName==='TEXTAREA' || t.tagName==='SELECT' || t.isContentEditable);
  /* "?" opens the shortcuts help (only when not typing in a field) */
  if(!mod && !e.altKey && e.key==='?' && !editable){ e.preventDefault(); openShortcuts(); return; }
  /* Undo / Redo. Ctrl+Z undo, Ctrl+Y or Ctrl+Shift+Z redo. */
  if(mod && e.key.toLowerCase()==="z" && !e.shiftKey){ e.preventDefault(); undo(); return; }
  if(mod && (e.key.toLowerCase()==="y" || (e.key.toLowerCase()==="z" && e.shiftKey))){ e.preventDefault(); redo(); return; }
  if(mod && e.key.toLowerCase()==="s"){ e.preventDefault(); saveProject(); return; }
  if(mod && e.key.toLowerCase()==="o"){ e.preventDefault(); openClick(); return; }
  /* Ctrl/Cmd+K → search across all options */
  if(mod && e.key.toLowerCase()==="k"){ e.preventDefault(); openGlobalSearch(); return; }
  /* Ctrl/Cmd+F → focus the BOM find box (estimate view) */
  if(mod && e.key.toLowerCase()==="f" && view==='estimate'){
    const f=document.getElementById('bomFind'); if(f){ e.preventDefault(); f.focus(); f.select(); } return;
  }
  /* Ctrl/Cmd+Enter → add a fixture row to the current option (estimate view) */
  if(mod && e.key==="Enter" && view==='estimate'){ e.preventDefault(); addRow('fixtures'); return; }
  /* Alt+N → new option; Alt+1/2/3 → switch top-level views */
  if(e.altKey && e.key.toLowerCase()==="n"){ e.preventDefault(); addOption(); return; }
  if(e.altKey && e.key==="1"){ e.preventDefault(); setView('estimate'); return; }
  if(e.altKey && e.key==="2"){ e.preventDefault(); setView('shipping'); return; }
  if(e.altKey && e.key==="3"){ e.preventDefault(); setView('advice'); return; }
});

/* Printing: always print on white. If the app is in dark mode, drop the dark
   theme for the duration of the print so the output is dark-ink-on-white paper,
   then restore it afterward. Covers the in-document estimate print (ship advice
   and ship schedule open their own already-light print windows). */
let _printWasDark = false;
function _beforePrintLight(){ _printWasDark = document.body.classList.contains('dark'); if(_printWasDark) document.body.classList.remove('dark'); }
function _afterPrintRestore(){ if(_printWasDark){ document.body.classList.add('dark'); _printWasDark = false; } }
window.addEventListener('beforeprint', _beforePrintLight);
window.addEventListener('afterprint', _afterPrintRestore);

/* ================= Hosted-PWA update flow =================
 * When a new version is downloaded (hosted GitHub Pages app), the service-worker
 * bootstrap calls window.onUpdateReady(worker). Rather than reloading out from
 * under the user, we show a banner asking them to save; applying the update
 * stashes the in-progress project and reloads, then restores it. (Harmless in
 * the offline file — onUpdateReady is simply never called there.) */
const UPDATE_RESTORE_KEY = 'lbom_update_restore_v1';
let _pendingUpdateWorker = null;

/* File System Access handles can't go in localStorage (not JSON), but they ARE
   structured-cloneable, so we stash the current file handle in IndexedDB across
   an update reload and re-bind it — so Save keeps writing to the same file. */
function idbOpenHandles(){
  return new Promise((res,rej)=>{
    if(!window.indexedDB){ rej(); return; }
    const req = indexedDB.open('lbom-handles', 1);
    req.onupgradeneeded = ()=>{ try{ req.result.createObjectStore('h'); }catch(e){} };
    req.onsuccess = ()=>res(req.result);
    req.onerror = ()=>rej(req.error);
  });
}
function idbPutHandle(key, val){
  return idbOpenHandles().then(db=>new Promise((res,rej)=>{
    const tx = db.transaction('h','readwrite'), st = tx.objectStore('h');
    if(val==null) st.delete(key); else st.put(val, key);
    tx.oncomplete = ()=>res(); tx.onerror = ()=>rej(tx.error);
  })).catch(()=>{});
}
function idbGetHandle(key){
  return idbOpenHandles().then(db=>new Promise(res=>{
    const rq = db.transaction('h','readonly').objectStore('h').get(key);
    rq.onsuccess = ()=>res(rq.result||null); rq.onerror = ()=>res(null);
  })).catch(()=>null);
}

function onUpdateReady(worker){ _pendingUpdateWorker = worker || null; showPwaUpdateBanner(); }
function showPwaUpdateBanner(){
  if(document.getElementById('updateBanner')) return;
  const bar = document.createElement('div');
  bar.id = 'updateBanner'; bar.className = 'update-banner no-print';
  bar.innerHTML =
    `<span class="ub-msg">⬆ A new version is available. <b>Save your work</b>, then update — your current project will be carried over.</span>
     <span class="ub-actions">
       <button class="ub-save" onclick="saveProject()">Save</button>
       <button class="ub-update" onclick="applyUpdateNow()">Update &amp; reload</button>
       <button class="ub-later" onclick="dismissUpdateBanner()" title="Dismiss for now">Later</button>
     </span>`;
  document.body.appendChild(bar);
  document.body.classList.add('has-update-banner');
}
function dismissUpdateBanner(){
  const b = document.getElementById('updateBanner'); if(b) b.remove();
  document.body.classList.remove('has-update-banner');
}
function saveUpdateRestore(){
  try{ localStorage.setItem(UPDATE_RESTORE_KEY, JSON.stringify({ ts:Date.now(), name:state.name||'', json:projectJSON() })); }catch(e){}
}
async function applyUpdateNow(){
  saveUpdateRestore();
  try{ await idbPutHandle('lastFile', fileHandle || null); }catch(e){}   // persist the bound file handle
  const go = ()=>{ try{ location.reload(); }catch(e){} };
  if(_pendingUpdateWorker){
    try{ _pendingUpdateWorker.postMessage('skipWaiting'); }catch(e){}
    setTimeout(go, 1500);   // controllerchange handler usually reloads first; fallback otherwise
  } else { go(); }
}
function maybeRestoreAfterUpdate(){
  let slot = null;
  try{ slot = JSON.parse(localStorage.getItem(UPDATE_RESTORE_KEY) || 'null'); }catch(e){}
  try{ localStorage.removeItem(UPDATE_RESTORE_KEY); }catch(e){}
  if(!slot || !slot.json){ idbPutHandle('lastFile', null); return false; }   // clear any stale handle
  try{
    applyProject(JSON.parse(slot.json));
    dirty = true; lastSavedAt = null;
    render(); resetHistory(); updateSaveStamp();
    /* Re-bind the file handle that was saved before the reload (async). */
    idbGetHandle('lastFile').then(h=>{
      idbPutHandle('lastFile', null);                 // one-shot
      if(h){ fileHandle = h; updateSaveStamp(); toast('Re-linked to your file — Save (Ctrl+S) writes back to it'); }
      else { toast('Restored your in-progress work after the update — review and Save'); }
    }).catch(()=>{});
    return true;
  }catch(e){ return false; }
}

render();
updateSaveStamp();
applyColVis();
applySettings();
resetHistory();
maybeRestoreAfterUpdate();   // carry work across a hosted-PWA version update
document.addEventListener('click', ()=>{ const m=document.getElementById('colMenu'); if(m) m.style.display='none'; });

/* PWA file handler: when the installed app is launched by double-clicking a
   project file, load it — and keep the handle so Save writes back to that file.
   (Only fires in the hosted/installed app; harmless in the offline file.) */
if(typeof window!=='undefined' && 'launchQueue' in window && window.launchQueue && window.launchQueue.setConsumer){
  window.launchQueue.setConsumer(async (launchParams)=>{
    if(!launchParams || !launchParams.files || !launchParams.files.length) return;
    try{
      const handle = launchParams.files[0];
      const file = await handle.getFile();
      const text = await file.text();
      fileHandle = handle;                 // enables Save -> write back to this same file
      loadFromText(text, file.name);
    }catch(e){ /* ignore — user can still Open… manually */ }
  });
}
