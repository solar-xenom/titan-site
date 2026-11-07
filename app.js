// Titan Game and Hobby - everything the site does
// Needs config.js loaded first (for SUPABASE_URL and SUPABASE_ANON_KEY).

(function(){
const CATS = {
  dnd:{label:"D&D & RPGs"}, tcg:{label:"Trading cards"}, models:{label:"Model kits"},
  board:{label:"Board games"}, collectibles:{label:"Funko & collectibles"}, accessories:{label:"Dice, sleeves & supplies"}
};
const state = { inventory:[], events:[], counts:{}, roster:[], news:[], isStaff:false, isOwner:false, user:null, profile:null, mine:[], posts:[], replies:[], bKind:"all", editing:null, request:null, team:[], requests:[], shopCat:"all" };
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
    return `<i style="left:${(Math.random()*100).toFixed(1)}%;width:${size}px;height:${size}px;opacity:${(0.4+Math.random()*0.5).toFixed(2)};animation-duration:${(9+Math.random()*10).toFixed(1)}s;animation-delay:-${(Math.random()*19).toFixed(1)}s;--dx:${Math.round(Math.random()*80-40)}px"></i>`;
  }).join("") : "";
  $("#seasonNote").textContent = SEASONS[s].note || "";
  $("#seasonSel").value = s;
}
async function loadSettings(){
  const { data, error } = await sb.from("site_settings").select("season").eq("id", 1).maybeSingle();
  if(!error && data) applySeason(data.season);
}
$("#seasonSel").innerHTML = Object.entries(SEASONS).map(([k,v]) => `<option value="${k}">${esc(v.label)}</option>`).join("");
applyMode(document.documentElement.getAttribute("data-mode") === "light" ? "light" : "dark");
applySeason(document.documentElement.getAttribute("data-season") || "none");

/* ---------- routing ---------- */
const VIEWS = ["home","shop","events","news","board","account","staff"];
function closeMenu(){ document.querySelector("header.top").classList.remove("open"); $("#menuBtn").setAttribute("aria-expanded","false"); }
function route(){
  closeMenu();
  let v = (location.hash||"").replace("#","") || "home";
  if(!VIEWS.includes(v)) v = "home";
  if(v==="staff" && !state.isStaff) v = "account";
  VIEWS.forEach(n => { $("#view-"+n).hidden = n!==v; });
  document.querySelectorAll("nav.tabs a").forEach(a => {
    if(a.getAttribute("href")==="#"+v) a.setAttribute("aria-current","page"); else a.removeAttribute("aria-current");
  });
  $("#staffArea").hidden = !state.isStaff;
  $("#authArea").hidden = !!state.user;
  $("#meArea").hidden = !state.user;
  $("#accountLink").textContent = state.user ? "My account" : "Log in";
  if(v==="account") document.querySelector('nav.tabs a[href="#account"]').setAttribute("aria-current","page");
  $("#teamChip").hidden = !state.isOwner;
  $("#lookChip").hidden = !state.isOwner;
  $("#csvPanel").hidden = !state.isOwner;
  window.scrollTo(0,0);
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
    await Promise.all([loadProducts(), loadEvents(), loadCounts(), loadRoster(), loadNews(), loadTeam(), loadSettings(), loadMine(), loadBoard()]);
    setStatus("");
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
      <div class="seats ${full?"full":""}">${full?"Full":`${e.seats-n} seats left`}</div></div>`;
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

function eventCard(e, staff){
  const n = taken(e.id), full = n >= e.seats;
  const pct = Math.min(100, Math.round(n/e.seats*100));
  let html = `<div class="ev-card ${e.game}">
    <div class="when">${esc(fmtDate(e.date,{weekday:"long",month:"long",day:"numeric"}))} at ${esc(fmtTime(e.time))}</div>
    <h3 style="margin:2px 0 0">${esc(e.title)}</h3>
    <div class="meta"><span>${esc(e.fee||"Free")}</span>${e.notes?`<span>${esc(e.notes)}</span>`:""}</div>
    <div class="seats ${full?"full":""}">${n} of ${e.seats} seats taken</div>
    <div class="bar"><i style="width:${pct}%"></i></div>`;
  if(staff){
    const r = rosterFor(e.id);
    html += r.length ? `<ol class="roster">${r.map(x=>`<li>${esc(x.name)}${x.contact?` <span class="muted">(${esc(x.contact)})</span>`:""} <button class="btn small danger" data-del-signup="${esc(x.id)}">Remove</button></li>`).join("")}</ol>` : `<p class="note" style="margin-top:8px">No sign-ups yet.</p>`;
    if(state.isOwner) html += `<button class="btn small danger" data-del-event="${esc(e.id)}" style="margin-top:8px">Delete game night</button>`;
  } else if(state.mine.find(m => m.event_id === e.id)){
    const m = state.mine.find(x => x.event_id === e.id);
    html += `<p class="signed">✓ You're signed up</p><button class="btn small" data-cancel="${esc(m.id)}">Cancel my seat</button>`;
  } else if(!full && state.user){
    html += `<p style="margin:10px 0 0"><button class="btn primary" data-join="${esc(e.id)}">Save my seat as ${esc(myName())}</button></p>`;
  } else if(!full){
    html += `<form class="signup-form" data-signup="${esc(e.id)}">
      <input type="text" name="name" placeholder="Your name" required maxlength="60" aria-label="Your name">
      <input type="text" name="contact" placeholder="Phone or email (optional)" maxlength="80" aria-label="Phone or email">
      <button class="btn primary" type="submit">Save my seat</button></form>
      <p class="note" style="margin:6px 0 0"><a href="#account">Log in</a> for one-click sign-ups.</p>`;
  } else {
    html += `<p class="note" style="margin-top:8px">This night is full. Ask at the counter about the waitlist.</p>`;
  }
  return html + `</div>`;
}

function renderEvents(){
  const tcg = state.events.filter(e=>e.game==="tcg"), dnd = state.events.filter(e=>e.game==="dnd");
  $("#tcgEvents").innerHTML = tcg.length ? tcg.map(e=>eventCard(e,false)).join("") : `<div class="empty">No card game nights posted yet.</div>`;
  $("#dndEvents").innerHTML = dnd.length ? dnd.map(e=>eventCard(e,false)).join("") : `<div class="empty">No D&amp;D sessions posted yet.</div>`;
}

function sortedNews(){ return [...state.news].sort((a,b)=> (b.pinned?1:0)-(a.pinned?1:0) || b.createdAt-a.createdAt); }
function postHtml(p, staff){
  return `<article class="post ${p.pinned?"pinned":""}"><div class="when">${p.pinned?"Pinned. ":""}${new Date(p.createdAt).toLocaleDateString(undefined,{month:"long",day:"numeric",year:"numeric"})}</div>
    <h3>${esc(p.title)}</h3><div class="body">${esc(p.body)}</div>
    ${staff?`<div style="margin-top:10px;display:flex;gap:8px"><button class="btn small" data-pin="${esc(p.id)}">${p.pinned?"Unpin":"Pin"}</button>${state.isOwner?`<button class="btn small danger" data-del-news="${esc(p.id)}">Delete</button>`:""}</div>`:""}</article>`;
}
function renderNews(){
  const list = sortedNews();
  $("#newsList").innerHTML = list.length ? list.map(p=>postHtml(p,false)).join("") : `<div class="empty">No announcements yet.</div>`;
}

function renderInventoryTable(){
  const q = $("#invSearch").value.trim().toLowerCase();
  const list = state.inventory.filter(i => !q || i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q))
    .sort((a,b)=>a.name.localeCompare(b.name));
  $("#invTable").innerHTML = list.length ? list.map(i => `<tr><td data-label="SKU">${esc(i.sku)}</td><td data-label="Name">${esc(i.name)}</td><td data-label="Category">${esc(CATS[i.category]?.label||i.category)}</td>
    <td class="num" data-label="Price">${money(i.price)}</td><td class="num" data-label="Qty"><input type="number" min="0" value="${i.qty}" data-qty="${esc(i.sku)}" aria-label="Quantity for ${esc(i.name)}"></td>
    <td class="act">${state.isOwner?`<button class="btn small danger" data-del-item="${esc(i.sku)}">Delete</button>`:""}</td></tr>`).join("") :
    `<tr><td colspan="6" class="muted">No items yet. Upload a CSV or add one above.</td></tr>`;
}
function renderStaffEvents(){
  $("#staffEvents").innerHTML = state.events.length ? state.events.map(e=>eventCard(e,true)).join("") : `<p class="muted">Nothing scheduled.</p>`;
}
function renderStaffNews(){ $("#staffNews").innerHTML = sortedNews().map(p=>postHtml(p,true)).join(""); }

function renderAll(){
  renderHome(); renderShop(); renderEvents(); renderNews(); renderAccount(); renderBoard();
  if(state.isStaff){ renderInventoryTable(); renderStaffEvents(); renderStaffNews(); renderTeam(); }
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
  $("#boardNew").hidden = !state.user;
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
      <button class="btn small danger" data-del-post="${esc(p.id)}">${mine ? "Delete" : "Remove (staff)"}</button></div>` : ""}
    <details class="replies" ${reps.length && reps.length <= 3 ? "open" : ""}>
      <summary>${reps.length ? `${reps.length} repl${reps.length===1?"y":"ies"}` : "Reply"}</summary>
      ${reps.map(r => `<div class="reply"><div class="byline">${esc(r.author_name)}, ${esc(timeAgo(r.created_at))}</div><div class="body">${esc(r.body)}</div>
        ${(state.user && r.user_id===state.user.id) || state.isStaff ? `<button class="btn small danger" data-del-reply="${esc(r.id)}" style="margin-top:4px">${state.user && r.user_id===state.user.id ? "Delete" : "Remove (staff)"}</button>` : ""}</div>`).join("")}
      ${state.user ? (p.status==="open" ? `<div class="reply-form"><textarea id="reply-${esc(p.id)}" rows="2" maxlength="1000" placeholder="Write a reply" aria-label="Write a reply"></textarea><button class="btn small primary" data-reply="${esc(p.id)}">Reply</button></div>` : `<p class="note">This post is closed.</p>`)
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
      await Promise.all([loadMine(), loadCounts()]); renderAll();
    }
    else if(t.dataset.cancel){
      if(confirm("Cancel your seat for this game night?")){
        must(await sb.from("signups").delete().eq("id", t.dataset.cancel));
        await Promise.all([loadMine(), loadCounts(), loadRoster()]); renderAll(); toast("Your seat is cancelled");
      }
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
    btn.disabled=false; await loadCounts(); renderAll();
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
  must(await sb.from("products").upsert({ sku, name, category:$("#niCat").value, price:parseFloat($("#niPrice").value)||0, qty:parseInt($("#niQty").value,10)||0, updated_at:nowIso() }));
  ["#niSku","#niName","#niPrice","#niQty"].forEach(s=>$(s).value="");
  await loadProducts(); renderAll(); toast("Item added");
}
async function addEvent(){
  const title=$("#neTitle").value.trim(), date=$("#neDate").value, time=$("#neTime").value;
  if(!title || !date || !time){ toast("Add a title, date and time"); return; }
  must(await sb.from("events").insert({ title, game:$("#neGame").value, date, time, seats:parseInt($("#neSeats").value,10)||8, fee:$("#neFee").value.trim()||"Free", notes:$("#neNotes").value.trim() }));
  ["#neTitle","#neDate","#neTime","#neFee","#neNotes"].forEach(s=>$(s).value="");
  await loadEvents(); renderAll(); toast("Game night added");
}
async function addNews(){
  const title=$("#naTitle").value.trim(), body=$("#naBody").value.trim();
  if(!title || !body){ toast("Add a title and a message"); return; }
  must(await sb.from("announcements").insert({ title, body, pinned:$("#naPin").checked }));
  $("#naTitle").value=""; $("#naBody").value=""; $("#naPin").checked=false;
  await loadNews(); renderAll(); toast("Announcement posted");
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
  sb.auth.onAuthStateChange(() => {
    setTimeout(async () => { await refreshStaff(); await loadAll(); route(); }, 0);
  });
  // Refresh when someone comes back to the tab.
  document.addEventListener("visibilitychange", () => { if(!document.hidden) loadAll(); });
} else {
  loadAll();
}
})();
