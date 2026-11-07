// Titan Game and Hobby - everything the site does
// Needs config.js loaded first (for SUPABASE_URL and SUPABASE_ANON_KEY).

(function(){
const CATS = {
  dnd:{label:"D&D & RPGs"}, tcg:{label:"Trading cards"}, models:{label:"Model kits"},
  board:{label:"Board games"}, collectibles:{label:"Funko & collectibles"}, accessories:{label:"Dice, sleeves & supplies"}
};
const state = { inventory:[], events:[], counts:{}, roster:[], news:[], isStaff:false, isOwner:false, user:null, profile:null, mine:[], posts:[], replies:[], bKind:"all", editing:null, request:null, team:[], requests:[], shopCat:"all", editEvent:null, editNews:null, blocked:[], amBlocked:false, recovery:false, store:null };
const configured = !SUPABASE_ANON_KEY.includes("YOUR-ANON-KEY");
const sb = configured ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money = n => "$" + (Number(n)||0).toFixed(2);
const nowIso = () => new Date().toISOString();
const toast = msg => { const t=$("#toast"); t.textContent=msg; t.classList.add("show"); clearTimeout(t._h); t._h=setTimeout(()=>t.classList.remove("show"),2600); };
const today = () => { const d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
function fmtDate(iso, opts){ if(!iso) return ""; const [y,m,d]=iso.split("-").map(Number); return new Date(y,m-1,d).toLocaleDateString(undefined, opts||{weekday:"short",month:"short",day:"numeric"}); }
function fmtTime(t){ if(!t) return ""; const [h,m]=t.split(":").map(Number); const d=new Date(); d.setHours(h,m); return d.toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"}); }
function setStatus(msg, warn){ const s=$("#status"); if(!msg){s.hidden=true;return;} s.hidden=false; s.textContent=msg; s.classList.toggle("warn",!!warn); }
// Supabase returns {data, error}. This throws the error so try/catch can handle it.
const must = ({data, error}) => { if(error) throw error; return data; };

/* ---------- themes ---------- */
// To add a new seasonal theme, add it here AND add its colors in the CSS (search for CHRISTMAS).
const SEASONS = {
  none:      { label:"None (regular look)" },
  christmas: { label:"Christmas", note:"Happy holidays from everyone at Titan!", snow:true },
  halloween: { label:"Halloween", note:"Happy Halloween from Titan!" }
};
function applyMode(m){
  document.documentElement.setAttribute("data-mode", m);
  try{ localStorage.setItem("titan-mode", m); }catch(e){}
  const b = $("#modeBtn");
  b.innerHTML = m === "dark" ? `☀<span class="mode-label"> Light</span>` : `☾<span class="mode-label"> Dark</span>`;
  b.setAttribute("aria-label", m === "dark" ? "Switch to light mode" : "Switch to dark mode");
}
function applySeason(s){
  if(!SEASONS[s]) s = "none";
  state.season = s;
  document.documentElement.setAttribute("data-season", s);
  try{ localStorage.setItem("titan-season", s); }catch(e){}
  $("#season-fx").innerHTML = SEASONS[s].snow ? Array.from({length:40}, () => {
    const size = (2 + Math.random()*4).toFixed(1);
    return `<i style="--s:${size};left:${(Math.random()*100).toFixed(1)}%;width:${size}px;height:${size}px;opacity:${(0.4+Math.random()*0.5).toFixed(2)};animation-duration:${(9+Math.random()*10).toFixed(1)}s;animation-delay:-${(Math.random()*19).toFixed(1)}s;--dx:${Math.round(Math.random()*80-40)}px">❄</i>`;
  }).join("") : "";
  $("#seasonNote").textContent = SEASONS[s].note || "";
  $("#seasonSel").value = s;
}
async function loadSettings(){
  const { data, error } = await sb.from("site_settings").select("*").eq("id", 1).maybeSingle();
  if(!error && data){
    applySeason(data.season);
    if(data.address || data.hours){
      state.store = { address:data.address || DEFAULT_STORE.address, phone:data.phone || "", hours:data.hours || DEFAULT_STORE.hours, note:data.hours_note || "" };
      renderStore();
    }
  }
}

/* ---------- store info: address, phone, hours ---------- */
const DAYS = [["sun","Sunday"],["mon","Monday"],["tue","Tuesday"],["wed","Wednesday"],["thu","Thursday"],["fri","Friday"],["sat","Saturday"]];
const STORE_TZ = "America/Indiana/Indianapolis";   // Bedford, IN is on Eastern time
const DEFAULT_STORE = {
  address:"2821 Washington Ave, Bedford, IN 47421",
  phone:"(812) 329-1112",
  hours:{ sun:{open:"12:00",close:"17:00"}, mon:{open:"12:00",close:"18:00"}, tue:{open:"12:00",close:"18:00"}, wed:{open:"12:00",close:"18:00"},
          thu:{open:"12:00",close:"19:00"}, fri:{open:"12:00",close:"20:00"}, sat:{open:"12:00",close:"19:00"} },
  note:""
};
state.store = DEFAULT_STORE;
const niceTime = t => { if(!t) return ""; const [h,m] = t.split(":").map(Number); if(h===12 && m===0) return "noon"; const d = new Date(); d.setHours(h,m); return d.toLocaleTimeString("en-US",{hour:"numeric",minute: m ? "2-digit" : undefined}); };
const dayHours = h => (!h || h.closed || !h.open || !h.close) ? "Closed" : `${cap(niceTime(h.open))} to ${niceTime(h.close)}`;
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
function storeNow(){
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US",{ timeZone:STORE_TZ, weekday:"short", hour:"2-digit", minute:"2-digit", hourCycle:"h23" }).formatToParts(new Date()).map(p => [p.type, p.value]));
  const idx = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(parts.weekday);
  return { idx, mins: parseInt(parts.hour,10)*60 + parseInt(parts.minute,10) };
}
const toMins = t => { const [h,m] = t.split(":").map(Number); return h*60 + m; };
function openStatus(hours){
  const { idx, mins } = storeNow();
  const today = hours[DAYS[idx][0]];
  if(today && !today.closed && today.open && today.close && mins >= toMins(today.open) && mins < toMins(today.close))
    return { open:true, text:`Open now until ${niceTime(today.close)}` };
  if(today && !today.closed && today.open && mins < toMins(today.open)) return { open:false, text:`Closed now. Opens today at ${niceTime(today.open)}` };
  for(let i = 1; i <= 7; i++){
    const [key, name] = DAYS[(idx + i) % 7], h = hours[key];
    if(h && !h.closed && h.open) return { open:false, text:`Closed now. Opens ${i===1 ? "tomorrow" : name} at ${niceTime(h.open)}` };
  }
  return { open:false, text:"Closed" };
}
function renderStore(){
  const st = state.store, { idx } = storeNow();
  $("#fAddr").textContent = st.address;
  $("#fDir").href = "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(st.address);
  $("#fPhone").textContent = st.phone; $("#fPhone").href = "tel:" + st.phone.replace(/[^0-9+]/g,"");
  $("#fPhone").hidden = !st.phone;
  $("#fHours").innerHTML = [1,2,3,4,5,6,0].map(i => { const [k,name] = DAYS[i];
    return `<tr class="${i===idx?"today":""}"><td>${name}</td><td>${esc(dayHours(st.hours[k]))}</td></tr>`; }).join("");
  $("#fNote").textContent = st.note; $("#fNote").hidden = !st.note;
  const os = openStatus(st.hours);
  $("#openNow").innerHTML = `<span class="dot ${os.open?"on":""}"></span>${esc(os.text)}${st.note ? ` <span class="open-note">${esc(st.note)}</span>` : ""}`;
}
function renderStoreForm(){
  const st = state.store;
  $("#siAddress").value = st.address; $("#siPhone").value = st.phone; $("#siNote").value = st.note;
  $("#siHours").innerHTML = [1,2,3,4,5,6,0].map(i => { const [k,name] = DAYS[i], h = st.hours[k] || {};
    return `<tr><td data-label="Day">${name}</td>
      <td data-label="Opens"><input type="time" data-h-open="${k}" value="${esc(h.open||"")}" aria-label="${name} opens"></td>
      <td data-label="Closes"><input type="time" data-h-close="${k}" value="${esc(h.close||"")}" aria-label="${name} closes"></td>
      <td data-label="Closed"><input type="checkbox" data-h-closed="${k}" ${h.closed?"checked":""} aria-label="${name} closed all day"></td></tr>`; }).join("");
}
renderStore();
setInterval(renderStore, 60000);
$("#seasonSel").innerHTML = Object.entries(SEASONS).map(([k,v]) => `<option value="${k}">${esc(v.label)}</option>`).join("");
applyMode(document.documentElement.getAttribute("data-mode") === "light" ? "light" : "dark");
applySeason(document.documentElement.getAttribute("data-season") || "none");

/* ---------- routing ---------- */
const VIEWS = ["home","shop","events","event","news","board","account","staff"];
function closeMenu(){ document.querySelector("header.top").classList.remove("open"); $("#menuBtn").setAttribute("aria-expanded","false"); }
function route(){
  closeMenu();
  let v = (location.hash||"").replace("#","") || "home";
  state.detailId = null;
  if(v.startsWith("event-")){ state.detailId = v.slice(6); v = "event"; }
  if(!VIEWS.includes(v)) v = "home";
  state.view = v;
  if(v==="staff" && !state.isStaff) v = "account";
  VIEWS.forEach(n => { $("#view-"+n).hidden = n!==v; });
  document.querySelectorAll("nav.tabs a").forEach(a => {
    if(a.getAttribute("href")==="#"+v) a.setAttribute("aria-current","page"); else a.removeAttribute("aria-current");
  });
  $("#staffArea").hidden = !state.isStaff;
  $("#authArea").hidden = !!state.user;
  $("#meArea").hidden = !state.user || state.recovery;
  $("#resetArea").hidden = !state.recovery;
  $("#accountLink").textContent = state.user ? "My account" : "Log in";
  if(v==="account") document.querySelector('nav.tabs a[href="#account"]').setAttribute("aria-current","page");
  if(v==="event"){ document.querySelector('nav.tabs a[href="#events"]').setAttribute("aria-current","page"); showEventDetail(); }
  $("#teamChip").hidden = !state.isOwner;
  $("#lookChip").hidden = !state.isOwner;
  $("#csvPanel").hidden = !state.isOwner;
      // Only jump to the top when the page actually changes, not when data refreshes.
     const here = location.hash || "#home";
     if(state.lastHash !== here){ state.lastHash = here; window.scrollTo(0,0); }
}
window.addEventListener("hashchange", route);

/* ---------- loading data ---------- */
async function loadProducts(){
  const rows = must(await sb.from("products").select("*"));
  state.inventory = rows.map(p => ({...p, price:Number(p.price), updatedAt:Date.parse(p.updated_at)}));
}
async function loadEvents(){
  const rows = must(await sb.from("events").select("*").gte("date", today()).order("date").order("time"));
  state.events = rows.map(e => ({...e, time:(e.time||"").slice(0,5)}));
}
async function loadCounts(){
  const rows = must(await sb.rpc("signup_counts"));
  state.counts = Object.fromEntries((rows||[]).map(r => [r.event_id, Number(r.taken)]));
}
async function loadBlocked(){
  state.amBlocked = false; state.blocked = [];
  if(!state.user) return;
  if(state.isStaff){
    state.blocked = must(await sb.from("blocked_users").select("*").order("created_at", { ascending:false }));
  } else {
    const { data } = await sb.from("blocked_users").select("user_id").eq("user_id", state.user.id).maybeSingle();
    state.amBlocked = !!data;
  }
}
function renderBlocked(){
  if(!state.isStaff) return;
  $("#blockedList").innerHTML = state.blocked.length ? state.blocked.map(b => `
    <div class="mine-row"><div><strong>${esc(b.name || "Player")}</strong>${b.reason ? `<div class="note">${esc(b.reason)}</div>` : ""}
      <div class="note">Blocked ${esc(timeAgo(b.created_at))}</div></div>
      <button class="btn small" data-unblock="${esc(b.user_id)}">Unblock</button></div>`).join("") : `<p class="note">No one is blocked.</p>`;
}
const blockBtn = (uid, name) => (state.isStaff && uid && uid !== state.user?.id)
  ? `<button class="btn small danger" data-block-user="${esc(uid)}" data-block-name="${esc(name)}">Block</button>` : "";
async function loadRoster(){
  if(!state.isStaff){ state.roster = []; return; }
  state.roster = must(await sb.from("signups").select("*").order("created_at"));
}
async function loadNews(){
  const rows = must(await sb.from("announcements").select("*"));
  state.news = rows.map(n => ({...n, createdAt:Date.parse(n.created_at)}));
}
async function loadAll(){
  if(!sb){ setStatus("Add your Supabase key in config.js to load store data.", true); renderAll(); return; }
  try{
    await Promise.all([loadProducts(), loadEvents(), loadCounts(), loadRoster(), loadNews(), loadTeam(), loadSettings(), loadMine(), loadBoard(), loadBlocked()]);
    setStatus("");
    state.loaded = true;
  }catch(e){
    console.error(e);
    setStatus("Couldn't load store data. Check your Supabase keys and that you ran the SQL file.", true);
  }
  renderAll();
}

/* ---------- staff login ---------- */
// Works out who is logged in, their profile, and whether they're staff.
async function refreshStaff(){
  state.isStaff = false; state.isOwner = false; state.request = null; state.profile = null;
  const { data:{ session } } = await sb.auth.getSession();
  state.user = session ? session.user : null;
  if(state.user){
    const { data } = await sb.from("staff").select("role,name").eq("user_id", state.user.id).maybeSingle();
    state.isStaff = !!data;
    state.isOwner = data?.role === "owner";
    if(!data){
      const req = await sb.from("staff_requests").select("*").eq("user_id", state.user.id).maybeSingle();
      state.request = req.data || null;
    }
    // Every account gets a profile. Make one the first time someone logs in.
    let prof = (await sb.from("profiles").select("*").eq("user_id", state.user.id).maybeSingle()).data;
    if(!prof){
      const display_name = (state.user.user_metadata?.name || data?.name || state.user.email.split("@")[0]).slice(0,60);
      const made = await sb.from("profiles").upsert({ user_id:state.user.id, display_name }).select().maybeSingle();
      prof = made.data || { display_name };
    }
    state.profile = prof;
    $("#whoami").textContent = data ? `Logged in as ${data.name || prof.display_name} (${data.role}).` : "";
  }
  $("#staffLink").hidden = !state.isStaff;
  renderAccount();
}
const myName = () => state.profile?.display_name || state.user?.email || "";

async function loadMine(){
  if(!state.user){ state.mine = []; return; }
  const rows = must(await sb.from("signups").select("id, event_id, events(title, date, time, game)").eq("user_id", state.user.id));
  state.mine = rows.filter(r => r.events && r.events.date >= today())
    .sort((a,b) => (a.events.date + a.events.time).localeCompare(b.events.date + b.events.time));
}

function renderAccount(){
  if(!state.user) return;
  $("#meEmail").textContent = `Logged in as ${state.user.email}`;
  if(document.activeElement !== $("#meName")) $("#meName").value = myName();
  $("#myNights").innerHTML = state.mine.length ? state.mine.map(m => `
    <div class="mine-row">
      <div><span class="game-tag ${m.events.game}">${m.events.game==="dnd"?"D&D":"TCG"}</span><strong>${esc(m.events.title)}</strong>
        <div class="note">${esc(fmtDate(m.events.date,{weekday:"long",month:"long",day:"numeric"}))} at ${esc(fmtTime((m.events.time||"").slice(0,5)))}</div></div>
      <button class="btn small danger" data-cancel="${esc(m.id)}">Cancel my seat</button>
    </div>`).join("") : `<p class="note">You're not signed up for anything yet. <a href="#events">See game nights</a></p>`;
  $("#staffBox").innerHTML = state.isStaff
    ? `<p>You're on staff as ${state.isOwner ? "an owner" : "an employee"}.</p><a class="btn small" href="#staff">Open the Staff page</a>`
    : state.request
      ? `<p class="note">Your staff request is waiting for the owner to approve it.</p>`
      : `<p class="note">Work at Titan? Ask for staff access and the owner will approve it.</p><button class="btn small" id="requestBtn">Request staff access</button>`;
}
async function loadTeam(){
  if(!state.isOwner){ state.team = []; state.requests = []; return; }
  state.team = must(await sb.from("staff").select("*"));
  state.requests = must(await sb.from("staff_requests").select("*").order("created_at"));
}
function renderTeam(){
  if(!state.isOwner) return;
  $("#teamPending").innerHTML = state.requests.length ? state.requests.map(r => `
    <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)">
      <div><strong>${esc(r.name)}</strong><br><span class="note">${esc(r.email||"")}</span></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn small primary" data-approve="${esc(r.user_id)}" data-role="employee">Approve as employee</button>
        <button class="btn small" data-approve="${esc(r.user_id)}" data-role="owner">Approve as owner</button>
        <button class="btn small danger" data-decline="${esc(r.user_id)}">Decline</button>
      </div></div>`).join("") : `<p class="note">No one is waiting.</p>`;
  $("#teamTable").innerHTML = state.team.sort((a,b)=>(a.name||a.email||"").localeCompare(b.name||b.email||"")).map(m => {
    const me = m.user_id === state.user?.id;
    return `<tr><td data-label="Name"><input type="text" value="${esc(m.name||"")}" placeholder="Add a name" maxlength="60" data-setname="${esc(m.user_id)}" aria-label="Name" style="max-width:220px">${me?' <span class="note">(you)</span>':""}</td><td data-label="Email">${esc(m.email||"")}</td>
      <td data-label="Role">${me ? esc(m.role) : `<select data-setrole="${esc(m.user_id)}" aria-label="Role for ${esc(m.name||m.email||"staff")}">
        <option value="employee" ${m.role==="employee"?"selected":""}>Employee</option>
        <option value="owner" ${m.role==="owner"?"selected":""}>Owner</option></select>`}</td>
      <td class="act">${me ? "" : `<button class="btn small danger" data-remove-staff="${esc(m.user_id)}">Remove</button>`}</td></tr>`;
  }).join("");
}

/* ---------- rendering ---------- */
const taken = id => state.counts[id] || 0;
const rosterFor = id => state.roster.filter(s => s.event_id === id);

function itemTag(it){
  const q = Number(it.qty)||0;
  const stock = q<=0 ? '<span class="stock out">Sold out</span>' : q<=2 ? `<span class="stock low">Only ${q} left</span>` : `<span class="stock">${q} in stock</span>`;
  return `<div class="tag"><div class="cat">${esc(CATS[it.category]?.label||"Other")}</div><div class="name">${esc(it.name)}</div><div class="bottom"><span class="price">${money(it.price)}</span>${stock}</div></div>`;
}

function renderHome(){
  $("#homeShelf").innerHTML = Object.entries(CATS).map(([k,c]) => `<a href="#shop" data-cat="${k}">${esc(c.label)}</a>`).join("");
  const evs = state.events.slice(0,4);
  $("#homeEvents").innerHTML = evs.length ? evs.map(e => {
    const n = taken(e.id), full = n >= e.seats;
    const [y,m,d] = e.date.split("-").map(Number); const dt=new Date(y,m-1,d);
    return `<div class="ev-row"><div class="date-chip"><b>${dt.getDate()}</b><span>${dt.toLocaleDateString(undefined,{month:"short"})}</span></div>
      <div><span class="game-tag ${e.game}">${e.game==="dnd"?"D&D":"TCG"}</span><strong>${esc(e.title)}</strong><div class="note">${esc(fmtDate(e.date,{weekday:"long"}))} at ${esc(fmtTime(e.time))}</div></div>
      <div class="seats ${full?"full":""}">${full?"Full":`${e.seats-n} seat${e.seats-n===1?"":"s"} left`}</div></div>`;
  }).join("") : `<p class="muted" style="margin:8px 0">No game nights posted yet.</p>`;
  const news = sortedNews().slice(0,2);
  $("#homeNews").innerHTML = news.length ? news.map(p=>postHtml(p,false)).join("") : `<p class="muted">No announcements yet.</p>`;
  const fresh = state.inventory.filter(i=>i.qty>0).sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,4);
  $("#homeNew").innerHTML = fresh.length ? fresh.map(itemTag).join("") : `<div class="empty">Inventory shows up here once it's uploaded.</div>`;
}

function renderShop(){
  $("#shopChips").innerHTML = [["all","Everything"],...Object.entries(CATS).map(([k,c])=>[k,c.label])]
    .map(([k,l]) => `<button class="chip" data-cat="${k}" aria-pressed="${state.shopCat===k}">${esc(l)}</button>`).join("");
  const q = $("#shopSearch").value.trim().toLowerCase(), only = $("#inStockOnly").checked;
  const list = state.inventory.filter(i =>
    (state.shopCat==="all" || i.category===state.shopCat) &&
    (!q || i.name.toLowerCase().includes(q)) &&
    (!only || i.qty > 0)
  ).sort((a,b)=>a.name.localeCompare(b.name));
  $("#shopItems").innerHTML = list.length ? list.map(itemTag).join("") :
    `<div class="empty" style="grid-column:1/-1">${state.inventory.length ? "Nothing matches that search." : "The store's inventory hasn't been uploaded yet."}</div>`;
}

function eventEditForm(e){
  return `<div class="ev-card ${e.game} editing">
    <h3 style="margin:0 0 12px">Editing game night</h3>
    <div class="grid2">
      <div class="field"><label for="ee-title">Title</label><input type="text" id="ee-title" value="${esc(e.title)}"></div>
      <div class="field"><label for="ee-game">Type</label><select id="ee-game"><option value="tcg" ${e.game==="tcg"?"selected":""}>Trading card game</option><option value="dnd" ${e.game==="dnd"?"selected":""}>D&amp;D</option></select></div>
    </div>
    <div class="grid3">
      <div class="field"><label for="ee-date">Date</label><input type="date" id="ee-date" value="${esc(e.date)}"></div>
      <div class="field"><label for="ee-time">Start time</label><input type="time" id="ee-time" value="${esc(e.time)}"></div>
      <div class="field"><label for="ee-seats">Seats</label><input type="number" id="ee-seats" min="1" value="${e.seats}"></div>
    </div>
    <div class="grid2">
      <div class="field"><label for="ee-fee">Entry fee</label><input type="text" id="ee-fee" value="${esc(e.fee||"")}"></div>
      <div class="field"><label for="ee-notes">Short note</label><input type="text" id="ee-notes" value="${esc(e.notes||"")}"></div>
    </div>
    <div class="field"><label for="ee-desc">Description</label><textarea id="ee-desc" rows="4" maxlength="2000">${esc(e.description||"")}</textarea></div>
    <div class="bactions"><button class="btn small primary" data-save-event="${esc(e.id)}">Save</button><button class="btn small" data-cancel-event="1">Cancel</button></div>
  </div>`;
}
function eventCard(e, staff){
  if(staff && state.editEvent === e.id) return eventEditForm(e);
  const n = taken(e.id), full = n >= e.seats;
  const pct = Math.min(100, Math.round(n/e.seats*100));
  let html = `<div class="ev-card ${e.game}">
    <div class="when">${esc(fmtDate(e.date,{weekday:"long",month:"long",day:"numeric"}))} at ${esc(fmtTime(e.time))}</div>
    <h3 style="margin:2px 0 0"><a class="ev-link" href="#event-${esc(e.id)}">${esc(e.title)}</a></h3>
    <div class="meta"><span>${esc(e.fee||"Free")}</span>${e.notes?`<span>${esc(e.notes)}</span>`:""}</div>
    <div class="seats ${full?"full":""}">${n} of ${e.seats} seats taken</div>
    <div class="bar"><i style="width:${pct}%"></i></div>`;
  if(staff){
    const r = rosterFor(e.id), came = r.filter(x => x.attended).length;
    html += r.length ? `<p class="note" style="margin:10px 0 4px">Check off who showed up. ${came} of ${r.length} here.</p>
      <ol class="roster">${r.map(x=>`<li><label class="attend"><input type="checkbox" data-attend="${esc(x.id)}" ${x.attended?"checked":""} aria-label="${esc(x.name)} showed up"> ${esc(x.name)}</label>${x.contact?` <span class="muted">(${esc(x.contact)})</span>`:""}
        <span class="roster-btns"><button class="btn small danger" data-del-signup="${esc(x.id)}">Remove</button>${blockBtn(x.user_id, x.name)}</span></li>`).join("")}</ol>` : `<p class="note" style="margin-top:8px">No sign-ups yet.</p>`;
    html += `<div class="bactions">
      <button class="btn small" data-edit-event="${esc(e.id)}">Edit</button>
      <button class="btn small" data-print="${esc(e.id)}">Print sign-in sheet</button>
      ${state.isOwner ? `<button class="btn small danger" data-del-event="${esc(e.id)}">Delete game night</button>` : ""}</div>`;
    html += `<a class="details-link" href="#event-${esc(e.id)}">Details &amp; players →</a>`;
  } else {
    html += signupControls(e, full) + `<a class="details-link" href="#event-${esc(e.id)}">Details &amp; players →</a>`;
  }
  return html + `</div>`;
}

// The sign-up part of a game night, used on the list and on the details page.
function signupControls(e, full){
  let html = "";
  if(state.mine.find(m => m.event_id === e.id)){
    const m = state.mine.find(x => x.event_id === e.id);
    html += `<p class="signed">✓ You're signed up</p><button class="btn small" data-cancel="${esc(m.id)}">Cancel my seat</button>`;
  } else if(state.user && state.amBlocked){
    html += `<p class="note" style="margin-top:10px">Your account can't sign up online right now. Please talk to the store.</p>`;
  } else if(!full && state.user){
    html += `<p style="margin:10px 0 0"><button class="btn primary" data-join="${esc(e.id)}">Save my seat as ${esc(myName())}</button></p>
      <p class="note" style="margin:6px 0 0">Your name will show on the player list.</p>`;
  } else if(!full){
    html += `<form class="signup-form" data-signup="${esc(e.id)}">
      <input type="text" name="name" placeholder="Your name" required maxlength="60" aria-label="Your name">
      <input type="text" name="contact" placeholder="Phone or email (optional)" maxlength="80" aria-label="Phone or email">
      <button class="btn primary" type="submit">Save my seat</button></form>
      <p class="note" style="margin:6px 0 0">Your name will show on the player list. <a href="#account">Log in</a> for one-click sign-ups.</p>`;
  } else {
    html += `<p class="note" style="margin-top:8px">This night is full. Ask at the counter about the waitlist.</p>`;
  }
  return html;
}

/* ---------- one game night's page ---------- */
async function loadPlayers(id){
  if(!sb || !id){ state.players = { id, list:[] }; return; }
  const rows = must(await sb.rpc("event_players", { eid:id }));
  state.players = { id, list:rows || [] };
}
async function showEventDetail(){
  const id = state.detailId;
  if(!state.players || state.players.id !== id) state.players = { id, list:null };
  renderEventDetail();
  try{ await loadPlayers(id); }catch(e){ console.error(e); state.players = { id, list:[] }; }
  if(state.detailId === id) renderEventDetail();
}
function renderEventDetail(){
  if(state.view !== "event") return;
  const e = state.events.find(x => x.id === state.detailId);
  const back = `<p style="margin:0 0 14px"><a href="#events">← All game nights</a></p>`;
  if(!e){
    $("#eventDetail").innerHTML = back + `<div class="empty">${state.loaded ? "This game night isn't on the schedule anymore." : "Loading..."}</div>`;
    return;
  }
  const n = taken(e.id), full = n >= e.seats, pct = Math.min(100, Math.round(n/e.seats*100));
  const list = state.players && state.players.id === e.id ? state.players.list : null;
  $("#eventDetail").innerHTML = back + `
    <div class="ev-card ev-detail ${e.game}">
      <span class="game-tag ${e.game}">${e.game==="dnd"?"D&D":"TCG"}</span>
      <h1 class="ev-title">${esc(e.title)}</h1>
      <div class="when">${esc(fmtDate(e.date,{weekday:"long",month:"long",day:"numeric"}))} at ${esc(fmtTime(e.time))}</div>
      <div class="meta"><span>${esc(e.fee||"Free")}</span>${e.notes?`<span>${esc(e.notes)}</span>`:""}</div>
      ${e.description ? `<div class="desc">${esc(e.description)}</div>` : ""}
      <div class="seats ${full?"full":""}">${n} of ${e.seats} seats taken</div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      ${signupControls(e, full)}
    </div>
    <div class="panel" style="max-width:820px">
      <h3>Who's playing${list ? ` (${list.length})` : ""}</h3>
      ${list === null ? `<p class="note">Loading...</p>` : list.length
        ? `<ol class="players">${list.map(p => `<li>${esc(p.name)}${p.is_me ? ' <span class="note">(you)</span>' : ""}</li>`).join("")}</ol>`
        : `<p class="note">Nobody yet. Be the first to sign up!</p>`}
    </div>`;
}
async function refreshDetail(){ if(state.view === "event" && state.detailId){ try{ await loadPlayers(state.detailId); }catch(e){ console.error(e); } } }

function renderEvents(){
  const tcg = state.events.filter(e=>e.game==="tcg"), dnd = state.events.filter(e=>e.game==="dnd");
  $("#tcgEvents").innerHTML = tcg.length ? tcg.map(e=>eventCard(e,false)).join("") : `<div class="empty">No card game nights posted yet.</div>`;
  $("#dndEvents").innerHTML = dnd.length ? dnd.map(e=>eventCard(e,false)).join("") : `<div class="empty">No D&amp;D sessions posted yet.</div>`;
}

function sortedNews(){ return [...state.news].sort((a,b)=> (b.pinned?1:0)-(a.pinned?1:0) || b.createdAt-a.createdAt); }
function postHtml(p, staff){
  if(staff && state.editNews === p.id) return `<article class="post editing">
    <h3 style="margin:0 0 12px">Editing announcement</h3>
    <div class="field"><label for="en-title">Title</label><input type="text" id="en-title" value="${esc(p.title)}"></div>
    <div class="field"><label for="en-body">Message</label><textarea id="en-body" rows="4">${esc(p.body)}</textarea></div>
    <label style="display:flex;gap:6px;align-items:center;font-weight:600"><input type="checkbox" id="en-pin" ${p.pinned?"checked":""}> Pin to top</label>
    <div class="bactions"><button class="btn small primary" data-save-news="${esc(p.id)}">Save</button><button class="btn small" data-cancel-news="1">Cancel</button></div>
  </article>`;
  return `<article class="post ${p.pinned?"pinned":""}"><div class="when">${p.pinned?"Pinned. ":""}${new Date(p.createdAt).toLocaleDateString(undefined,{month:"long",day:"numeric",year:"numeric"})}</div>
    <h3>${esc(p.title)}</h3><div class="body">${esc(p.body)}</div>
    ${staff?`<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn small" data-edit-news="${esc(p.id)}">Edit</button><button class="btn small" data-pin="${esc(p.id)}">${p.pinned?"Unpin":"Pin"}</button>${state.isOwner?`<button class="btn small danger" data-del-news="${esc(p.id)}">Delete</button>`:""}</div>`:""}</article>`;
}
function renderNews(){
  const list = sortedNews();
  $("#newsList").innerHTML = list.length ? list.map(p=>postHtml(p,false)).join("") : `<div class="empty">No announcements yet.</div>`;
}

function renderInventoryTable(){
  const q = $("#invSearch").value.trim().toLowerCase();
  const list = state.inventory.filter(i => !q || i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q))
    .sort((a,b)=>a.name.localeCompare(b.name));
  $("#invTable").innerHTML = list.length ? list.map(i => `<tr><td data-label="SKU">${esc(i.sku)}</td>
    <td data-label="Name"><input type="text" class="inline-in name-in" maxlength="120" value="${esc(i.name)}" data-field="name" data-sku="${esc(i.sku)}" aria-label="Name for ${esc(i.sku)}"></td>
    <td data-label="Category"><select class="inline-in" data-field="category" data-sku="${esc(i.sku)}" aria-label="Category for ${esc(i.name)}">${Object.entries(CATS).map(([k,c]) => `<option value="${k}" ${i.category===k?"selected":""}>${esc(c.label)}</option>`).join("")}</select></td>
    <td class="num" data-label="Price"><input type="number" class="inline-in price-in" min="0" step="0.01" value="${Number(i.price).toFixed(2)}" data-field="price" data-sku="${esc(i.sku)}" aria-label="Price for ${esc(i.name)}"></td><td class="num" data-label="Qty"><input type="number" class="inline-in qty-in" min="0" value="${i.qty}" data-qty="${esc(i.sku)}" aria-label="Quantity for ${esc(i.name)}"></td>
    <td class="act">${state.isOwner?`<button class="btn small danger" data-del-item="${esc(i.sku)}">Delete</button>`:""}</td></tr>`).join("") :
    `<tr><td colspan="6" class="muted">No items yet. Upload a CSV or add one above.</td></tr>`;
}
function renderStaffEvents(){
  $("#staffEvents").innerHTML = state.events.length ? state.events.map(e=>eventCard(e,true)).join("") : `<p class="muted">Nothing scheduled.</p>`;
}
function renderStaffNews(){ $("#staffNews").innerHTML = sortedNews().map(p=>postHtml(p,true)).join(""); }

function renderAll(){
  renderHome(); renderShop(); renderEvents(); renderNews(); renderAccount(); renderBoard(); renderEventDetail();
  if(state.isStaff){ renderInventoryTable(); renderStaffEvents(); renderStaffNews(); renderTeam(); renderBlocked(); }
}

/* ---------- community board ---------- */
const KINDS = { lfp:"Looking for players", lfg:"Looking for a group", talk:"Discussion" };
const GAMES = { dnd:"D&D / RPG", pokemon:"Pokémon", magic:"Magic", tcg_other:"Other card game", board:"Board games", models:"Model kits", other:"Other" };
$("#npKind").innerHTML = Object.entries(KINDS).map(([k,v]) => `<option value="${k}">${esc(v)}</option>`).join("");
$("#npGame").innerHTML = Object.entries(GAMES).map(([k,v]) => `<option value="${k}">${esc(v)}</option>`).join("");
$("#bGame").innerHTML = `<option value="all">All games</option>` + Object.entries(GAMES).map(([k,v]) => `<option value="${k}">${esc(v)}</option>`).join("");

function timeAgo(iso){
  const sec = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 1000));
  const steps = [[60,"second"],[60,"minute"],[24,"hour"],[7,"day"],[4.35,"week"],[12,"month"],[Infinity,"year"]];
  let n = sec;
  for(const [size,unit] of steps){ if(n < size){ n = Math.floor(n); return `${n} ${unit}${n===1?"":"s"} ago`; } n /= size; }
}
async function loadBoard(){
  state.posts = must(await sb.from("posts").select("*").order("created_at", { ascending:false }).limit(200));
  const ids = state.posts.map(p => p.id);
  state.replies = ids.length ? must(await sb.from("replies").select("*").in("post_id", ids).order("created_at")) : [];
}
function renderBoard(){
  $("#boardLogin").hidden = !!state.user;
  $("#boardNew").hidden = !state.user || state.amBlocked;
  $("#boardLogin").innerHTML = state.amBlocked ? `<p style="margin:0">Your account can't post on the community board right now. Please talk to the store.</p>` : `<p style="margin:0"><a href="#account">Log in or make an account</a> to post or reply.</p>`;
  $("#boardLogin").hidden = !!state.user && !state.amBlocked;
  $("#boardKinds").innerHTML = [["all","All posts"], ...Object.entries(KINDS)]
    .map(([k,l]) => `<button class="chip" data-bkind="${k}" aria-pressed="${state.bKind===k}">${esc(l)}</button>`).join("");
  const game = $("#bGame").value || "all", showClosed = $("#bClosed").checked;
  const list = state.posts.filter(p =>
    (state.bKind==="all" || p.kind===state.bKind) && (game==="all" || p.game===game) && (showClosed || p.status==="open"));
  $("#boardList").innerHTML = list.length ? list.map(postCard).join("") :
    `<div class="empty">${state.posts.length ? "No posts match those filters." : "No posts yet. Be the first to find your party!"}</div>`;
}
function postCard(p){
  const mine = state.user && p.user_id === state.user.id;
  const canRemove = mine || state.isStaff;
  const reps = state.replies.filter(r => r.post_id === p.id);
  if(state.editing === p.id){
    return `<article class="bpost ${p.kind}">
      <div class="grid2">
        <div class="field"><label>Type</label><select id="ed-kind">${Object.entries(KINDS).map(([k,v])=>`<option value="${k}" ${p.kind===k?"selected":""}>${esc(v)}</option>`).join("")}</select></div>
        <div class="field"><label>Game</label><select id="ed-game">${Object.entries(GAMES).map(([k,v])=>`<option value="${k}" ${p.game===k?"selected":""}>${esc(v)}</option>`).join("")}</select></div>
      </div>
      <div class="field"><label>Title</label><input type="text" id="ed-title" maxlength="100" value="${esc(p.title)}"></div>
      <div class="field"><label>Details</label><textarea id="ed-body" rows="4" maxlength="2000">${esc(p.body)}</textarea></div>
      <div class="bactions"><button class="btn small primary" data-edit-save="${esc(p.id)}">Save</button><button class="btn small" data-edit-cancel="1">Cancel</button></div>
    </article>`;
  }
  return `<article class="bpost ${p.kind} ${p.status==="closed"?"closed":""}">
    <span class="pill kind">${esc(KINDS[p.kind]||"Post")}</span><span class="pill">${esc(GAMES[p.game]||"Other")}</span>${p.status==="closed"?'<span class="pill closed">Closed</span>':""}
    <h3>${esc(p.title)}</h3>
    <div class="byline">${esc(p.author_name)}, ${esc(timeAgo(p.created_at))}${p.updated_at && p.updated_at !== p.created_at ? " (edited)" : ""}</div>
    <div class="body">${esc(p.body)}</div>
    ${canRemove ? `<div class="bactions">
      ${mine ? `<button class="btn small" data-edit="${esc(p.id)}">Edit</button>
      <button class="btn small" data-status="${esc(p.id)}" data-to="${p.status==="open"?"closed":"open"}">${p.status==="open" ? (p.kind==="talk" ? "Close" : "Found them, close post") : "Reopen"}</button>` : ""}
      <button class="btn small danger" data-del-post="${esc(p.id)}">${mine ? "Delete" : "Remove (staff)"}</button>${mine ? "" : blockBtn(p.user_id, p.author_name)}</div>` : ""}
    <details class="replies" ${reps.length && reps.length <= 3 ? "open" : ""}>
      <summary>${reps.length ? `${reps.length} repl${reps.length===1?"y":"ies"}` : "Reply"}</summary>
      ${reps.map(r => `<div class="reply"><div class="byline">${esc(r.author_name)}, ${esc(timeAgo(r.created_at))}</div><div class="body">${esc(r.body)}</div>
        ${(state.user && r.user_id===state.user.id) || state.isStaff ? `<button class="btn small danger" data-del-reply="${esc(r.id)}" style="margin-top:4px">${state.user && r.user_id===state.user.id ? "Delete" : "Remove (staff)"}</button>` : ""}${state.user && r.user_id===state.user.id ? "" : blockBtn(r.user_id, r.author_name)}</div>`).join("")}
      ${state.user && !state.amBlocked ? (p.status==="open" ? `<div class="reply-form"><textarea id="reply-${esc(p.id)}" rows="2" maxlength="1000" placeholder="Write a reply" aria-label="Write a reply"></textarea><button class="btn small primary" data-reply="${esc(p.id)}">Reply</button></div>` : `<p class="note">This post is closed.</p>`)
        : `<p class="note"><a href="#account">Log in</a> to reply.</p>`}
    </details>
  </article>`;
}
$("#bGame").addEventListener("change", renderBoard);
$("#bClosed").addEventListener("change", renderBoard);

/* ---------- clicks ---------- */
document.addEventListener("click", async ev => {
  const t = ev.target.closest("button, a");
  if(!t) return;
  if(t.id==="menuBtn"){ const h=document.querySelector("header.top"); const open=!h.classList.contains("open"); h.classList.toggle("open", open); t.setAttribute("aria-expanded", String(open)); return; }
  if(t.closest("nav.tabs")) closeMenu();
  if(t.dataset.cat !== undefined){ state.shopCat = t.dataset.cat; renderShop(); return; }
  if(t.dataset.bkind){ state.bKind = t.dataset.bkind; renderBoard(); return; }
  if(t.dataset.edit){ state.editing = t.dataset.edit; renderBoard(); return; }
  if(t.dataset.editCancel){ state.editing = null; renderBoard(); return; }
  if(t.dataset.staff === "look") renderStoreForm();
  if(t.dataset.staff){
    document.querySelectorAll("[data-staff]").forEach(b=>b.setAttribute("aria-pressed", b===t));
    document.querySelectorAll("[data-pane]").forEach(p=>p.hidden = p.dataset.pane!==t.dataset.staff);
    return;
  }
  if(t.id==="modeBtn"){ applyMode(document.documentElement.getAttribute("data-mode")==="dark" ? "light" : "dark"); return; }
  if(!sb) return;
  try{
    if(t.id==="loginBtn"){
      const { error } = await sb.auth.signInWithPassword({ email:$("#loginEmail").value.trim(), password:$("#loginPass").value });
      $("#loginMsg").textContent = error ? error.message : "";
    }
    else if(t.id==="signupBtn"){
      const nf = $("#nameField");
      if(nf.hidden){ nf.hidden = false; $("#ageField").hidden = false; $("#loginName").focus(); $("#loginMsg").textContent = "Enter your name, email, and a password, then click Create account again."; return; }
      const name = $("#loginName").value.trim(), email = $("#loginEmail").value.trim(), password = $("#loginPass").value;
      if(!name || !email || password.length < 6){ $("#loginMsg").textContent = "Fill in your name, email, and a password of at least 6 characters."; return; }
      if(!$("#ageOk").checked){ $("#loginMsg").textContent = "Please confirm you're 13 or older. Younger players can have a parent sign them up."; return; }
      const { data, error } = await sb.auth.signUp({ email, password, options:{ data:{ name, age_ok:true } } });
      if(error){ $("#loginMsg").textContent = error.message; return; }
      if(!data.session){ $("#loginMsg").textContent = "Check your email to confirm your account, then come back and log in."; return; }
      $("#loginMsg").textContent = ""; toast(`Welcome, ${name}!`);
    }
    else if(t.id==="postBtn"){
      const title = $("#npTitle").value.trim(), body = $("#npBody").value.trim();
      if(!title || !body){ toast("Add a title and some details"); return; }
      t.disabled = true;
      try{
        must(await sb.from("posts").insert({ kind:$("#npKind").value, game:$("#npGame").value, title, body }));
        $("#npTitle").value = ""; $("#npBody").value = "";
        await loadBoard(); renderBoard(); toast("Posted!");
      } finally { t.disabled = false; }
    }
    else if(t.dataset.editSave){
      const title = $("#ed-title").value.trim(), body = $("#ed-body").value.trim();
      if(!title || !body){ toast("Add a title and some details"); return; }
      must(await sb.from("posts").update({ kind:$("#ed-kind").value, game:$("#ed-game").value, title, body }).eq("id", t.dataset.editSave));
      state.editing = null; await loadBoard(); renderBoard(); toast("Post updated");
    }
    else if(t.dataset.status){
      must(await sb.from("posts").update({ status:t.dataset.to }).eq("id", t.dataset.status));
      await loadBoard(); renderBoard(); toast(t.dataset.to==="closed" ? "Post closed" : "Post reopened");
    }
    else if(t.dataset.delPost){
      if(confirm("Delete this post and its replies?")){ must(await sb.from("posts").delete().eq("id", t.dataset.delPost)); await loadBoard(); renderBoard(); toast("Post deleted"); }
    }
    else if(t.dataset.reply){
      const box = document.getElementById("reply-" + t.dataset.reply), body = box.value.trim();
      if(!body) return;
      t.disabled = true;
      try{
        must(await sb.from("replies").insert({ post_id:t.dataset.reply, body }));
        await loadBoard(); renderBoard(); toast("Reply posted");
      } finally { t.disabled = false; }
    }
    else if(t.dataset.delReply){
      if(confirm("Delete this reply?")){ must(await sb.from("replies").delete().eq("id", t.dataset.delReply)); await loadBoard(); renderBoard(); toast("Reply deleted"); }
    }
    else if(t.id==="meSave"){
      const name = $("#meName").value.trim(); if(!name){ toast("Add a name"); return; }
      state.profile = must(await sb.from("profiles").update({ display_name:name.slice(0,60) }).eq("user_id", state.user.id).select().single());
      renderAll(); toast("Name saved");
    }
    else if(t.dataset.join){
      t.disabled = true;
      try{
        must(await sb.from("signups").insert({ event_id:t.dataset.join, name:myName(), contact:state.user.email, user_id:state.user.id }));
        toast("You're signed up. See you there!");
      }catch(e){
        const msg = String(e.message||"");
        toast(msg.includes("full") ? "That night just filled up" : msg.includes("duplicate") ? "You're already signed up" : "Sign-up didn't go through. Try again.");
      }
      await Promise.all([loadMine(), loadCounts(), refreshDetail()]); renderAll();
    }
    else if(t.dataset.cancel){
      if(confirm("Cancel your seat for this game night?")){
        must(await sb.from("signups").delete().eq("id", t.dataset.cancel));
        await Promise.all([loadMine(), loadCounts(), loadRoster(), refreshDetail()]); renderAll(); toast("Your seat is cancelled");
      }
    }
    else if(t.id==="siSave"){
      const hours = {};
      DAYS.forEach(([k]) => { hours[k] = { open:document.querySelector(`[data-h-open="${k}"]`).value, close:document.querySelector(`[data-h-close="${k}"]`).value, closed:document.querySelector(`[data-h-closed="${k}"]`).checked }; });
      const row = { address:$("#siAddress").value.trim(), phone:$("#siPhone").value.trim(), hours, hours_note:$("#siNote").value.trim() || null, updated_at:nowIso() };
      must(await sb.from("site_settings").update(row).eq("id", 1));
      state.store = { address:row.address, phone:row.phone, hours, note:row.hours_note || "" };
      renderStore(); toast("Store info saved");
    }
    else if(t.id==="forgotBtn"){
      const email = $("#loginEmail").value.trim();
      if(!email){ $("#loginMsg").textContent = "Type your email above first, then click Forgot your password."; return; }
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      $("#loginMsg").textContent = error ? error.message : "If that email has an account, a reset link is on its way. Check your spam folder too.";
    }
    else if(t.id==="resetSave"){
      const pw = $("#newPass").value;
      if(pw.length < 6){ $("#resetMsg").textContent = "Use at least 6 characters."; return; }
      const { error } = await sb.auth.updateUser({ password:pw });
      if(error){ $("#resetMsg").textContent = error.message; return; }
      state.recovery = false; $("#newPass").value = ""; route(); toast("Password updated");
    }
    else if(t.dataset.blockUser){
      const reason = prompt(`Block ${t.dataset.blockName}? They won't be able to post, reply, or sign up with their account.\n\nReason (optional, only staff see this):`);
      if(reason === null) return;
      must(await sb.from("blocked_users").insert({ user_id:t.dataset.blockUser, name:t.dataset.blockName, reason:reason.trim() || null }));
      await loadBlocked(); renderAll(); toast(`${t.dataset.blockName} is blocked`);
    }
    else if(t.dataset.unblock){
      if(confirm("Unblock this player?")){ must(await sb.from("blocked_users").delete().eq("user_id", t.dataset.unblock)); await loadBlocked(); renderAll(); toast("Player unblocked"); }
    }
    else if(t.id==="csvDownload"){
      const q = v => { const x = String(v ?? ""); return /[",\n]/.test(x) ? `"${x.replace(/"/g,'""')}"` : x; };
      const rows = [["sku","name","category","price","qty"], ...[...state.inventory].sort((a,b)=>a.name.localeCompare(b.name)).map(i => [i.sku, i.name, i.category, Number(i.price).toFixed(2), i.qty])];
      const blob = new Blob(["\uFEFF" + rows.map(r => r.map(q).join(",")).join("\r\n")], { type:"text/csv" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `titan-inventory-${today()}.csv`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
    else if(t.dataset.print){ printRoster(t.dataset.print); }
    else if(t.dataset.editEvent){ state.editEvent = t.dataset.editEvent; renderStaffEvents(); document.getElementById("ee-title")?.focus(); }
    else if(t.dataset.cancelEvent){ state.editEvent = null; renderStaffEvents(); }
    else if(t.dataset.saveEvent){
      const id = t.dataset.saveEvent;
      const row = { title:$("#ee-title").value.trim(), game:$("#ee-game").value, date:$("#ee-date").value, time:$("#ee-time").value,
        seats:Math.max(1, parseInt($("#ee-seats").value,10)||8), fee:$("#ee-fee").value.trim()||"Free", notes:$("#ee-notes").value.trim(), description:$("#ee-desc").value.trim() || null };
      if(!row.title || !row.date || !row.time){ toast("Add a title, date and time"); return; }
      const signed = taken(id);
      if(row.seats < signed && !confirm(`${signed} people are already signed up, which is more than ${row.seats} seats. Save anyway? Nobody gets removed.`)) return;
      must(await sb.from("events").update(row).eq("id", id));
      state.editEvent = null; await Promise.all([loadEvents(), loadCounts()]); renderAll(); toast("Game night updated");
    }
    else if(t.dataset.editNews){ state.editNews = t.dataset.editNews; renderStaffNews(); document.getElementById("en-title")?.focus(); }
    else if(t.dataset.cancelNews){ state.editNews = null; renderStaffNews(); }
    else if(t.dataset.saveNews){
      const title = $("#en-title").value.trim(), body = $("#en-body").value.trim();
      if(!title || !body){ toast("Add a title and a message"); return; }
      must(await sb.from("announcements").update({ title, body, pinned:$("#en-pin").checked }).eq("id", t.dataset.saveNews));
      state.editNews = null; await loadNews(); renderAll(); toast("Announcement updated");
    }
    else if(t.id==="seasonSave"){
      const v = $("#seasonSel").value;
      must(await sb.from("site_settings").update({ season:v, updated_at:nowIso() }).eq("id", 1));
      applySeason(v); toast(`Theme set to ${SEASONS[v].label}`);
    }
    else if(t.id==="requestBtn"){
      must(await sb.from("staff_requests").insert({ user_id:state.user.id, name:myName(), email:state.user.email }));
      await refreshStaff(); route(); toast("Request sent to the owner");
    }
    else if(t.dataset.approve){
      const r = state.requests.find(x => x.user_id === t.dataset.approve);
      must(await sb.from("staff").insert({ user_id:r.user_id, role:t.dataset.role, name:r.name, email:r.email }));
      must(await sb.from("staff_requests").delete().eq("user_id", r.user_id));
      await loadTeam(); renderTeam(); toast(`${r.name} approved as ${t.dataset.role}`);
    }
    else if(t.dataset.decline){
      if(confirm("Decline this request?")){ must(await sb.from("staff_requests").delete().eq("user_id", t.dataset.decline)); await loadTeam(); renderTeam(); toast("Request declined"); }
    }
    else if(t.dataset.removeStaff){
      if(confirm("Remove this person from staff? They'll lose access right away.")){ must(await sb.from("staff").delete().eq("user_id", t.dataset.removeStaff)); await loadTeam(); renderTeam(); toast("Removed from staff"); }
    }
    else if(t.id==="logoutBtn"){ await sb.auth.signOut(); location.hash = "#home"; toast("Logged out"); }
    else if(t.dataset.delItem){ if(confirm("Delete this item from inventory?")){ must(await sb.from("products").delete().eq("sku", t.dataset.delItem)); await loadProducts(); renderAll(); toast("Item deleted"); } }
    else if(t.dataset.delEvent){ if(confirm("Delete this game night and its sign-ups?")){ must(await sb.from("events").delete().eq("id", t.dataset.delEvent)); await Promise.all([loadEvents(), loadRoster(), loadCounts()]); renderAll(); toast("Game night deleted"); } }
    else if(t.dataset.delSignup){ must(await sb.from("signups").delete().eq("id", t.dataset.delSignup)); await Promise.all([loadRoster(), loadCounts()]); renderAll(); toast("Sign-up removed"); }
    else if(t.dataset.delNews){ if(confirm("Delete this announcement?")){ must(await sb.from("announcements").delete().eq("id", t.dataset.delNews)); await loadNews(); renderAll(); toast("Announcement deleted"); } }
    else if(t.dataset.pin){ const p=state.news.find(n=>n.id===t.dataset.pin); must(await sb.from("announcements").update({pinned:!p.pinned}).eq("id", p.id)); await loadNews(); renderAll(); }
    else if(t.id==="niAdd"){ await addItem(); }
    else if(t.id==="neAdd"){ await addEvent(); }
    else if(t.id==="naAdd"){ await addNews(); }
    else if(t.id==="csvUpload"){ await uploadCsv(t); }
  }catch(e){ handleError(e); }
});

/* ---------- player sign-up ---------- */
document.addEventListener("submit", async ev => {
  const f = ev.target.closest("[data-signup]"); if(!f) return;
  ev.preventDefault();
  if(!sb){ toast("Sign-ups aren't set up yet"); return; }
  const name=f.name.value.trim(), contact=f.contact.value.trim();
  if(!name) return;
  const btn=f.querySelector("button"); btn.disabled=true;
  try{
    must(await sb.from("signups").insert({ event_id:f.dataset.signup, name, contact }));
    toast("You're signed up. See you there!"); f.reset();
  }catch(e){
    toast(String(e.message||"").includes("full") ? "That night just filled up" : "Sign-up didn't go through. Try again.");
  }finally{
    btn.disabled=false; await Promise.all([loadCounts(), refreshDetail()]); renderAll();
  }
});

$("#shopSearch").addEventListener("input", renderShop);
$("#inStockOnly").addEventListener("change", renderShop);
$("#invSearch").addEventListener("input", renderInventoryTable);
$("#niCat").innerHTML = Object.entries(CATS).map(([k,c])=>`<option value="${k}">${esc(c.label)}</option>`).join("");

/* ---------- staff edits ---------- */
document.addEventListener("change", async ev => {
  const nm = ev.target.closest("[data-setname]");
  if(nm && sb){
    try{ must(await sb.from("staff").update({ name:nm.value.trim() || null }).eq("user_id", nm.dataset.setname)); toast("Name saved"); }
    catch(e){ handleError(e); }
    await loadTeam(); renderTeam(); await refreshStaff(); return;
  }
  const sel = ev.target.closest("[data-setrole]");
  if(sel && sb){
    try{ must(await sb.from("staff").update({ role:sel.value }).eq("user_id", sel.dataset.setrole)); toast("Role updated"); }
    catch(e){ handleError(e); }
    await loadTeam(); renderTeam(); return;
  }
  if(ev.target.id === "neRepeat"){ $("#neWeeksWrap").hidden = !ev.target.checked; return; }
  const att = ev.target.closest("[data-attend]");
  if(att && sb){
    try{ must(await sb.from("signups").update({ attended:att.checked }).eq("id", att.dataset.attend)); }
    catch(e){ handleError(e); att.checked = !att.checked; }
    await loadRoster(); renderStaffEvents(); return;
  }
  const fld = ev.target.closest("[data-field]");
  if(fld && sb){
    const field = fld.dataset.field; let value = fld.value;
    if(field === "name"){ value = value.trim(); if(!value){ toast("Name can't be empty"); renderInventoryTable(); return; } }
    if(field === "price"){ value = Math.max(0, parseFloat(value) || 0); fld.value = value.toFixed(2); }
    try{ must(await sb.from("products").update({ [field]:value, updated_at:nowIso() }).eq("sku", fld.dataset.sku)); toast("Saved"); }
    catch(e){ handleError(e); }
    await loadProducts(); renderHome(); renderShop(); return;
  }
  const inp = ev.target.closest("[data-qty]"); if(!inp || !sb) return;
  const v = Math.max(0, parseInt(inp.value,10)||0);
  try{ must(await sb.from("products").update({qty:v, updated_at:nowIso()}).eq("sku", inp.dataset.qty)); await loadProducts(); renderHome(); renderShop(); toast("Stock updated"); }
  catch(e){ handleError(e); }
});

function handleError(e){ console.error(e); toast(e?.message || "Something went wrong. Try again."); }
const skuSafe = s => String(s||"").trim().replace(/[^A-Za-z0-9_\-.]/g,"-").slice(0,80);

async function addItem(){
  const sku = skuSafe($("#niSku").value), name=$("#niName").value.trim();
  if(!sku || !name){ toast("Add a SKU and a name"); return; }
  if(state.inventory.some(i => i.sku === sku) && !confirm(`An item with SKU ${sku} already exists. Replace it?`)) return;
  must(await sb.from("products").upsert({ sku, name, category:$("#niCat").value, price:parseFloat($("#niPrice").value)||0, qty:Math.max(0, parseInt($("#niQty").value,10)||0), updated_at:nowIso() }));
  ["#niSku","#niName","#niPrice","#niQty"].forEach(s=>$(s).value="");
  await loadProducts(); renderAll(); toast("Item added");
}
async function addEvent(){
  const title=$("#neTitle").value.trim(), date=$("#neDate").value, time=$("#neTime").value;
  if(!title || !date || !time){ toast("Add a title, date and time"); return; }
  const row = { title, game:$("#neGame").value, date, time, seats:Math.max(1, parseInt($("#neSeats").value,10)||8), fee:$("#neFee").value.trim()||"Free", notes:$("#neNotes").value.trim(), description:$("#neDesc").value.trim() || null };
  const weeks = $("#neRepeat").checked ? Math.min(12, Math.max(2, parseInt($("#neWeeks").value,10)||4)) : 1;
  const rows = Array.from({ length:weeks }, (_, w) => {
    const [y,m,d] = date.split("-").map(Number), dt = new Date(y, m-1, d + 7*w);
    return { ...row, date:`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}` };
  });
  must(await sb.from("events").insert(rows));
  ["#neTitle","#neDate","#neTime","#neFee","#neNotes","#neDesc"].forEach(s=>$(s).value=""); $("#neSeats").value = 8;
  $("#neRepeat").checked = false; $("#neWeeksWrap").hidden = true;
  await loadEvents(); renderAll();
  toast(weeks > 1 ? `Added ${weeks} weekly game nights. They're in the list below.` : "Game night added");
}
async function addNews(){
  const title=$("#naTitle").value.trim(), body=$("#naBody").value.trim();
  if(!title || !body){ toast("Add a title and a message"); return; }
  must(await sb.from("announcements").insert({ title, body, pinned:$("#naPin").checked }));
  $("#naTitle").value=""; $("#naBody").value=""; $("#naPin").checked=false;
  await loadNews(); renderAll(); toast("Announcement posted");
}

// Opens a printable sign-in sheet for one game night.
function printRoster(id){
  const e = state.events.find(x => x.id === id); if(!e) return;
  const r = rosterFor(id), blanks = Math.max(0, e.seats - r.length);
  const w = window.open("", "_blank"); if(!w){ toast("Allow pop-ups to print the sheet"); return; }
  const rows = r.map((x,i) => `<tr><td>${i+1}</td><td>${esc(x.name)}</td><td>${esc(x.contact||"")}</td><td class="box"></td></tr>`).join("")
    + Array.from({ length:blanks }, (_,i) => `<tr><td>${r.length+i+1}</td><td></td><td></td><td class="box"></td></tr>`).join("");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(e.title)} sign-in</title>
    <style>body{font-family:Georgia,serif;margin:32px;color:#111}h1{margin:0 0 4px;font-size:26px}p{margin:0 0 18px}
    table{width:100%;border-collapse:collapse}th,td{border:1px solid #444;padding:10px 8px;text-align:left;font-size:15px}
    th{background:#eee}td:first-child{width:36px;text-align:center}.box{width:90px}</style></head><body>
    <h1>${esc(e.title)}</h1><p>${esc(fmtDate(e.date,{weekday:"long",month:"long",day:"numeric",year:"numeric"}))} at ${esc(fmtTime(e.time))}. ${e.seats} seats. ${esc(e.fee||"Free")}.</p>
    <table><thead><tr><th>#</th><th>Name</th><th>Contact</th><th>Here</th></tr></thead><tbody>${rows}</tbody></table>
    <script>window.onload=function(){window.print()}<\/script></body></html>`);
  w.document.close();
}

/* ---------- CSV upload ---------- */
function parseCsv(text){
  const rows=[]; let row=[], cell="", q=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(q){ if(ch==='"'){ if(text[i+1]==='"'){cell+='"';i++;} else q=false; } else cell+=ch; }
    else if(ch==='"') q=true;
    else if(ch===','){ row.push(cell); cell=""; }
    else if(ch==='\n'||ch==='\r'){ if(ch==='\r'&&text[i+1]==='\n') i++; row.push(cell); rows.push(row); row=[]; cell=""; }
    else cell+=ch;
  }
  if(cell!==""||row.length){ row.push(cell); rows.push(row); }
  return rows.filter(r=>r.some(c=>c.trim()!==""));
}
let pendingRows = [];
$("#csvFile").addEventListener("change", async ev => {
  const f = ev.target.files[0]; pendingRows=[]; $("#csvUpload").disabled=true;
  if(!f){ $("#csvPreview").textContent=""; return; }
  const rows = parseCsv(await f.text());
  const head = (rows.shift()||[]).map(h=>h.trim().toLowerCase());
  const ix = k => head.indexOf(k);
  if(["sku","name","category","price","qty"].some(k=>ix(k)<0)){ $("#csvPreview").textContent="The first row needs the columns sku, name, category, price, qty."; return; }
  let bad=0;
  const bySku = new Map();
  rows.forEach(r=>{
    let cat=(r[ix("category")]||"").trim().toLowerCase(); if(!CATS[cat]){ bad++; cat="accessories"; }
    const row = { sku:skuSafe(r[ix("sku")]), name:(r[ix("name")]||"").trim(), category:cat,
      price:parseFloat(String(r[ix("price")]).replace(/[$,]/g,""))||0, qty:Math.max(0, parseInt(r[ix("qty")],10)||0) };
    if(row.sku && row.name) bySku.set(row.sku, row);
  });
  pendingRows = [...bySku.values()];
  $("#csvPreview").textContent = `${pendingRows.length} items ready to upload.` + (bad?` ${bad} had an unknown category and will go under Dice, sleeves & supplies.`:"");
  $("#csvUpload").disabled = !pendingRows.length;
});
async function uploadCsv(btn){
  btn.disabled=true;
  const stamp = nowIso();
  must(await sb.from("products").upsert(pendingRows.map(r=>({...r, updated_at:stamp}))));
  $("#csvPreview").textContent=`Uploaded ${pendingRows.length} items.`; pendingRows=[]; $("#csvFile").value="";
  await loadProducts(); renderAll(); toast("Inventory uploaded");
}

/* ---------- start up ---------- */
route(); renderAll();
if(sb){
  // Runs on page load and whenever someone logs in or out.
  sb.auth.onAuthStateChange((event) => {
    if(event === "PASSWORD_RECOVERY"){ state.recovery = true; location.hash = "#account"; }
    setTimeout(async () => { await refreshStaff(); await loadAll(); route(); }, 0);
  });
  // Refresh when someone comes back to the tab.
  document.addEventListener("visibilitychange", () => { if(!document.hidden) loadAll(); });
} else {
  loadAll();
}
})();
