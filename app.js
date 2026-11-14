// Titan Game and Hobby - everything the site does
// Needs config.js loaded first (for SUPABASE_URL and SUPABASE_ANON_KEY).

(function(){
const CATS = {
  dnd:{label:"D&D & RPGs"}, tcg:{label:"Trading cards"}, models:{label:"Model kits"},
  board:{label:"Board games"}, collectibles:{label:"Funko & collectibles"}, accessories:{label:"Dice, sleeves & supplies"}
};
const state = { inventory:[], events:[], counts:{}, roster:[], news:[], isStaff:false, isOwner:false, user:null, profile:null, mine:[], posts:[], replies:[], bKind:"all", editing:null, request:null, team:[], requests:[], shopCat:"all", editEvent:null, editNews:null, blocked:[], amBlocked:false, recovery:false, store:null, feat:{ holds:true, preorders:true, fb:"" }, reservations:[], reserve:null, resFilter:"active", expandItem:null, photoCands:null, campaigns:[], members:[], editCamp:null, dmOpen:false, pendingRender:false, live:null };
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
// Holiday themes. To add one, add it here AND add its colors in styles.css (search for HOLIDAYS).
// fx = the little things that drift down the screen.
const SEASONS = {
  none:         { label:"None" },
  newyear:      { label:"New Year's",        note:"Happy New Year from Titan!",                fx:{ chars:["■","●","▲"], colors:["#E8C35A","#C9CED6","#9B7BE0","#E8C35A"], count:34, min:6, max:10 } },
  valentines:   { label:"Valentine's Day",   note:"Happy Valentine's Day from Titan!",          fx:{ chars:["♥"], colors:["#E85A8A","#C2185B","#F4A6C0"], count:26, min:12, max:22 } },
  stpatricks:   { label:"St. Patrick's Day", note:"Happy St. Patrick's Day from Titan!",        fx:{ chars:["☘"], colors:["#3FBF6A","#1E8C45","#7FD99A"], count:24, min:14, max:24 } },
  july4:        { label:"Fourth of July",    note:"Happy Fourth of July from Titan!",           fx:{ chars:["★","✦"], colors:["#D23A4A","#FFFFFF","#5A6FD6"], count:28, min:10, max:18 } },
  halloween:    { label:"Halloween",         note:"Happy Halloween from Titan!",                fx:{ chars:["🦇"], count:10, min:16, max:26 } },
  thanksgiving: { label:"Thanksgiving",      note:"Happy Thanksgiving from everyone at Titan!", fx:{ chars:["🍂","🍁"], count:18, min:16, max:26 } },
  christmas:    { label:"Christmas",         note:"Happy holidays from everyone at Titan!", snow:true }
};
// Site looks. Colors live in styles.css (search for LOOKS). The swatches here are just for the picker.
const LOOKS = {
  classic:    { label:"Classic tavern", blurb:"Leather and parchment, the original look.", dark:["#14100D","#D9A845","#C2312F"], light:["#EFE2C6","#7A200D","#865A10"] },
  arcane:     { label:"Arcane",         blurb:"Deep violet with glowing teal.",            dark:["#100E1F","#5FD3C6","#7B4FD6"], light:["#EEEAF7","#5B35B5","#1F7F78"] },
  dragonfire: { label:"Dragonfire",     blurb:"Charcoal and ember orange.",                dark:["#141110","#F2A33A","#E2541C"], light:["#F5ECE3","#C2410C","#A0560E"] },
  grove:      { label:"Elven grove",    blurb:"Forest green and bronze.",                  dark:["#0E1410","#C9A45C","#3E8E5A"], light:["#EDF2E6","#2F7348","#7A5B1E"] },
  frost:      { label:"Frostpeak",      blurb:"Midnight blue and icy silver.",             dark:["#0E131A","#B9D7EA","#3B82C4"], light:["#EAF0F5","#2563A6","#356A8C"] }
};
function applyLook(l){
  if(!LOOKS[l]) l = "classic";
  state.look = l;
  document.documentElement.setAttribute("data-look", l);
  try{ localStorage.setItem("titan-look", l); }catch(e){}
}
function renderLookPicker(){
  const cur = state.lookDraft || state.look || "classic";
  $("#lookPicker").innerHTML = Object.entries(LOOKS).map(([k,v]) => `
    <button type="button" class="look-card" role="radio" aria-checked="${k===cur}" data-look-pick="${k}">
      <span class="look-swatches"><span class="sw-set">${v.dark.map(c => `<i style="background:${c}"></i>`).join("")}</span><span class="sw-set">${v.light.map(c => `<i style="background:${c}"></i>`).join("")}</span></span>
      <strong>${esc(v.label)}</strong><span class="note">${esc(v.blurb)}</span>
    </button>`).join("");
}
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
  const fx = SEASONS[s].fx, pick = arr => arr[Math.floor(Math.random()*arr.length)];
  $("#season-fx").innerHTML = SEASONS[s].snow ? Array.from({length:40}, () => {
    const size = (2 + Math.random()*4).toFixed(1);
    return `<i style="--s:${size};left:${(Math.random()*100).toFixed(1)}%;width:${size}px;height:${size}px;opacity:${(0.4+Math.random()*0.5).toFixed(2)};animation-duration:${(9+Math.random()*10).toFixed(1)}s;animation-delay:-${(Math.random()*19).toFixed(1)}s;--dx:${Math.round(Math.random()*80-40)}px">❄</i>`;
  }).join("") : fx ? Array.from({length:fx.count || 24}, () => {
    const size = Math.round(fx.min + Math.random()*(fx.max - fx.min));
    return `<i class="g" style="left:${(Math.random()*100).toFixed(1)}%;font-size:${size}px;${fx.colors ? `color:${pick(fx.colors)};` : ""}opacity:${(0.5+Math.random()*0.45).toFixed(2)};animation-duration:${(10+Math.random()*10).toFixed(1)}s;animation-delay:-${(Math.random()*20).toFixed(1)}s;--dx:${Math.round(Math.random()*120-60)}px;--rot:${Math.round(Math.random()*720-360)}deg">${pick(fx.chars)}</i>`;
  }).join("") : "";
  $("#seasonNote").textContent = SEASONS[s].note || "";
  $("#seasonSel").value = s;
}
async function loadSettings(){
  const { data, error } = await sb.from("site_settings").select("*").eq("id", 1).maybeSingle();
  if(!error && data){
    applySeason(data.season); state.storeLook = data.look || "classic"; state.alertEmail = data.alert_email || ""; applyPersonal();
    state.feat = { holds: data.holds_enabled !== false, preorders: data.preorders_enabled !== false, fb: data.facebook_url || "" };
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
  const fb = state.feat?.fb || ""; $("#fFb").hidden = !fb; if(fb) $("#fFb").href = fb;
  $("#fHours").innerHTML = [1,2,3,4,5,6,0].map(i => { const [k,name] = DAYS[i];
    return `<tr class="${i===idx?"today":""}"><td>${name}</td><td>${esc(dayHours(st.hours[k]))}</td></tr>`; }).join("");
  $("#fNote").textContent = st.note; $("#fNote").hidden = !st.note;
  const os = openStatus(st.hours);
  $("#openNow").innerHTML = `<span class="dot ${os.open?"on":""}"></span>${esc(os.text)}${st.note ? ` <span class="open-note">${esc(st.note)}</span>` : ""}`;
}
function renderStoreForm(){
  renderGamesTable(); renderLookPicker();
  const st = state.store;
  $("#siAddress").value = st.address; $("#siPhone").value = st.phone; $("#siNote").value = st.note;
  $("#siFb").value = state.feat.fb || ""; $("#siAlert").value = state.alertEmail || ""; $("#featHolds").checked = state.feat.holds; $("#featPre").checked = state.feat.preorders;
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

/* ---------- games: the store-wide list ---------- */
// Starting list, used until the store's own list loads from the database.
state.games = [
  { slug:"magic",   name:"Magic: The Gathering", kind:"tcg", color:"#C26A2E", featured:true, active:true, sort:10 },
  { slug:"pokemon", name:"Pokémon",              kind:"tcg", color:"#E0B21B", featured:true, active:true, sort:20 },
  { slug:"yugioh",  name:"Yu-Gi-Oh!",            kind:"tcg", color:"#7A4FCC", featured:true, active:true, sort:30 },
  { slug:"dnd",     name:"Dungeons & Dragons",   kind:"rpg", color:"#B32630", featured:true, active:true, sort:40 }
];
state.evGame = "all";
const EVENT_TYPES = { casual:"Casual", tournament:"Tournament", league:"League", prerelease:"Prerelease", learn:"Learn to play" };
const BOARD_EXTRA = { tcg_other:"Other card game", other:"Other", models:"Model kits" };
const gameBy = slug => state.games.find(g => g.slug === slug);
const shortName = n => String(n||"").replace(/:.*$/,"").replace("Dungeons & Dragons","D&D").trim();
function inkFor(hex){ const n = parseInt(String(hex).slice(1),16); if(isNaN(n)) return "#FFFFFF"; const r=n>>16&255, g=n>>8&255, b=n&255; return (0.299*r + 0.587*g + 0.114*b) > 150 ? "#1A130D" : "#FFFFFF"; }
const gameColor = (slug, fallback) => gameBy(slug)?.color || (fallback === "dnd" ? "var(--red)" : "var(--blue)");
function gameTag(slug, fallback){
  const g = gameBy(slug);
  if(g) return `<span class="game-tag" style="background:${g.color};color:${inkFor(g.color)}">${esc(shortName(g.name))}</span>`;
  if(fallback) return `<span class="game-tag ${fallback}">${fallback === "dnd" ? "D&D" : "Card game"}</span>`;
  return "";
}
const activeGames = () => state.games.filter(g => g.active).sort((a,b) => (a.sort - b.sort) || a.name.localeCompare(b.name));
const featuredGames = () => activeGames().filter(g => g.featured);
function gameOptions(selected, blank){
  const list = activeGames().slice();
  if(selected && !list.some(g => g.slug === selected) && gameBy(selected)) list.push(gameBy(selected));
  return (blank !== undefined ? `<option value="">${esc(blank)}</option>` : "") + list.map(g => `<option value="${g.slug}" ${g.slug === selected ? "selected" : ""}>${esc(g.name)}</option>`).join("");
}
const boardGameName = slug => gameBy(slug)?.name || BOARD_EXTRA[slug] || "Other";
function boardGameOptions(selected, all){
  return (all ? `<option value="all">All games</option>` : "") + activeGames().map(g => `<option value="${g.slug}" ${g.slug===selected?"selected":""}>${esc(g.name)}</option>`).join("")
    + `<option value="tcg_other" ${selected==="tcg_other"?"selected":""}>Other card game</option><option value="other" ${selected==="other"?"selected":""}>Other</option>`;
}
function fillGameSelects(){
  const set = (sel, html) => { const el = $(sel); if(!el) return; const v = el.value; el.innerHTML = html; if([...el.options].some(o => o.value === v)) el.value = v; };
  set("#neGame", gameOptions(null));
  set("#niGame", gameOptions(null, "None (works for any game)"));
  set("#naGame", gameOptions(null, "Whole store"));
  set("#shopGame", `<option value="">All games</option>` + activeGames().map(g => `<option value="${g.slug}">${esc(g.name)}</option>`).join(""));
  set("#npGame", boardGameOptions(null, false));
  set("#bGame", boardGameOptions(null, true));
  set("#dGame", boardGameOptions(null, true));
  set("#dpGame", boardGameOptions(null, false).replace('<option value="other" >Other</option>','<option value="other">General / not about one game</option>'));
}
async function loadGames(){
  const rows = must(await sb.from("games").select("*").order("sort").order("name"));
  if(rows.length) state.games = rows;
  fillGameSelects();
}
function renderGamesTable(){
  if(!state.isOwner) return;
  const KIND = { tcg:"Card game", rpg:"Roleplaying", board:"Board games", hobby:"Hobby", other:"Other" };
  $("#gamesTable").innerHTML = [...state.games].sort((a,b) => (a.sort - b.sort) || a.name.localeCompare(b.name)).map(g => `<tr>
    <td data-label="Order"><input type="number" class="inline-in qty-in" value="${g.sort}" data-gfield="sort" data-gslug="${esc(g.slug)}" aria-label="Order for ${esc(g.name)}"></td>
    <td data-label="Name"><input type="text" class="inline-in name-in" maxlength="40" value="${esc(g.name)}" data-gfield="name" data-gslug="${esc(g.slug)}" aria-label="Name"></td>
    <td data-label="Type"><select class="inline-in" data-gfield="kind" data-gslug="${esc(g.slug)}" aria-label="Type for ${esc(g.name)}">${Object.entries(KIND).map(([k,v]) => `<option value="${k}" ${g.kind===k?"selected":""}>${v}</option>`).join("")}</select></td>
    <td data-label="Color"><input type="color" value="${esc(g.color)}" data-gfield="color" data-gslug="${esc(g.slug)}" aria-label="Color for ${esc(g.name)}"></td>
    <td data-label="Has a page"><input type="checkbox" ${g.featured?"checked":""} data-gfield="featured" data-gslug="${esc(g.slug)}" aria-label="${esc(g.name)} has a page"></td>
    <td data-label="Shown"><input type="checkbox" ${g.active?"checked":""} data-gfield="active" data-gslug="${esc(g.slug)}" aria-label="Show ${esc(g.name)}"></td>
  </tr>${g.featured ? `<tr class="game-blurb-row"><td colspan="6"><label style="font-size:13px">Intro on the ${esc(shortName(g.name))} page</label><input type="text" class="inline-in" maxlength="300" value="${esc(g.blurb||"")}" data-gfield="blurb" data-gslug="${esc(g.slug)}" placeholder="A sentence or two about this game at the store" style="width:100%"></td></tr>` : ""}`).join("");
}

/* ---------- a game's page ---------- */
function renderGameHub(){
  if(state.view !== "game") return;
  const g = gameBy(state.hubSlug);
  if(!g){ $("#gameHub").innerHTML = `<p><a href="#home">← Home</a></p><div class="empty">${state.loaded ? "That game page doesn't exist." : "Loading..."}</div>`; return; }
  const short = shortName(g.name), ink = inkFor(g.color);
  const evs = state.events.filter(e => e.game_slug === g.slug).slice(0, 6);
  const pre = state.inventory.filter(i => i.game_slug === g.slug && i.preorder);
  const stock = state.inventory.filter(i => i.game_slug === g.slug && !i.preorder && i.qty > 0).sort((a,b) => b.updatedAt - a.updatedAt);
  const news = sortedNews().filter(n => n.game_slug === g.slug).slice(0, 3);
  const posts = state.posts.filter(p => p.game === g.slug && !isDisc(p) && p.status === "open").slice(0, 4);
  const talk = state.posts.filter(p => p.game === g.slug && isDisc(p)).slice(0, 4);
  const camps = g.kind === "rpg" ? state.campaigns.filter(c => c.status === "recruiting" || c.status === "full") : [];
  const items = list => { const img = list.some(i => i.image_url); return `<div class="items">${list.map(i => itemTag(i, img)).join("")}</div>`; };
  const sec = (title, link, body) => `<section class="hub-sec"><div class="hub-sec-head"><h2>${title}</h2>${link || ""}</div>${body}</section>`;
  let html = `<header class="hub-head" style="--gc:${g.color};--gi:${ink}">
      <p class="crumb"><a href="#home">← Home</a></p>
      <h1>${esc(g.name)}</h1>
      ${g.blurb ? `<p class="hub-blurb">${esc(g.blurb)}</p>` : ""}
    </header>`;
  html += sec("Next up", `<a href="#events" data-evgame="${esc(g.slug)}">All ${esc(short)} nights →</a>`,
    evs.length ? `<div class="ev-list">${evs.map(e => eventCard(e, false)).join("")}</div>` : `<div class="empty">No ${esc(short)} nights on the schedule right now. Check back soon!</div>`);
  if(camps.length) html += sec("Ongoing campaigns", `<a href="#events">See all campaigns →</a>`, `<div class="hub-camps">${camps.map(campCard).join("")}</div>`);
  if(pre.length) html += sec("Preorders", "", items(pre));
  html += sec("In stock", stock.length ? `<a href="#shop" data-shopgame="${esc(g.slug)}">See all ${esc(short)} items →</a>` : "",
    stock.length ? items(stock.slice(0, 8)) : `<div class="empty">Nothing listed for ${esc(short)} right now. Ask at the counter!</div>`);
  const wins = state.results.filter(r => r.game_slug === g.slug).slice(0, 3);
  if(wins.length) html += sec("Recent winners", `<a href="#events" data-evgame="${esc(g.slug)}">All ${esc(short)} results →</a>`, `<div class="winners">${wins.map(resultCard).join("")}</div>`);
  if(news.length) html += sec("News", `<a href="#news">All announcements →</a>`, news.map(n => postHtml(n, false)).join(""));
  const mini = (p, href, attr) => `<a class="hub-post" href="${href}" ${attr}="${esc(g.slug)}">${p.images && p.images[0] ? `<img class="hub-thumb" src="${esc(p.images[0])}" alt="" loading="lazy">` : ""}<span class="pill kind">${esc(KINDS[p.kind]||"Post")}</span><strong>${esc(p.title)}</strong><span class="note">${esc(p.author_name)}, ${esc(timeAgo(p.created_at))}${isDisc(p) && likeCount(p.id) ? `, ♥ ${likeCount(p.id)}` : ""}</span></a>`;
  html += sec("From the community", `<a href="#discuss" data-dgame="${esc(g.slug)}">All ${esc(short)} posts →</a>`,
    talk.length ? `<div class="hub-posts">${talk.map(p => mini(p, "#discuss", "data-dgame")).join("")}</div>`
      : `<div class="empty">No ${esc(short)} posts yet. <a href="#discuss" data-dgame="${esc(g.slug)}">Show off a pull or start a conversation.</a></div>`);
  html += sec("Looking for a group", `<a href="#board" data-boardgame="${esc(g.slug)}">Find a group →</a>`,
    posts.length ? `<div class="hub-posts">${posts.map(p => mini(p, "#board", "data-boardgame")).join("")}</div>`
      : `<div class="empty">Nobody's looking right now. <a href="#board" data-boardgame="${esc(g.slug)}">Post that you're looking for players.</a></div>`);
  $("#gameHub").innerHTML = html;
}

/* ---------- routing ---------- */
const VIEWS = ["home","shop","events","event","game","news","discuss","board","contact","account","staff"];
function closeMenu(){ document.querySelector("header.top").classList.remove("open"); $("#menuBtn").setAttribute("aria-expanded","false"); }
function route(){
  closeMenu();
  let v = (location.hash||"").replace("#","") || "home";
  state.detailId = null;
  if(v.startsWith("event-")){ state.detailId = v.slice(6); v = "event"; }
  if(v.startsWith("game-")){ state.hubSlug = v.slice(5); v = "game"; }
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
  if(v==="game") renderGameHub();
  if(v==="board") document.querySelector('nav.tabs a[href="#discuss"]').setAttribute("aria-current","page");
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
async function loadReservations(){
  if(!state.user){ state.reservations = []; return; }
  let q = sb.from("reservations").select("*").order("created_at", { ascending:false }).limit(300);
  if(!state.isStaff) q = q.eq("user_id", state.user.id);
  state.reservations = must(await q);
}
async function loadCampaigns(){
  state.campaigns = must(await sb.from("campaigns").select("*").order("weekday").order("start_time"));
  const ids = state.campaigns.map(c => c.id);
  state.members = ids.length ? must(await sb.from("campaign_members").select("*").in("campaign_id", ids).order("joined_at")) : [];
  await loadPP([...state.members.map(m => m.user_id), ...state.campaigns.map(c => c.dm_user)]);
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
    await Promise.all([loadProducts(), loadEvents(), loadCounts(), loadRoster(), loadNews(), loadTeam(), loadSettings(), loadMine(), loadGames(), loadBoard(), loadBlocked(), loadReservations(), loadCampaigns(), loadNotes(), loadThreads(), loadReports(), loadResults(), loadPastEvents(), loadAllProfiles()]);
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
  const rows = must(await sb.from("signups").select("id, event_id, events(title, date, time, game, game_slug)").eq("user_id", state.user.id));
  state.mine = rows.filter(r => r.events && r.events.date >= today())
    .sort((a,b) => (a.events.date + a.events.time).localeCompare(b.events.date + b.events.time));
}

function renderAccount(){
  if(!state.user) return;
  $("#meEmail").textContent = state.user.email;
  $("#myNights").innerHTML = state.mine.length ? state.mine.map(m => `
    <div class="mine-row">
      <div>${gameTag(m.events.game_slug, m.events.game)}<strong>${esc(m.events.title)}</strong>
        <div class="note">${esc(fmtDate(m.events.date,{weekday:"long",month:"long",day:"numeric"}))} at ${esc(fmtTime((m.events.time||"").slice(0,5)))}</div></div>
      <button class="btn small danger" data-cancel="${esc(m.id)}">Cancel my seat</button>
    </div>`).join("") : `<p class="note">You're not signed up for anything yet. <a href="#events">See game nights</a></p>`;
  const RS = { requested:"Requested", ready:"Ready for pickup", picked_up:"Picked up", cancelled:"Cancelled" };
  const myRes = state.reservations.filter(r => r.user_id === state.user.id && (r.status === "requested" || r.status === "ready"));
  $("#myRes").innerHTML = myRes.length ? myRes.map(r => `
    <div class="mine-row"><div><span class="pill kind">${r.kind === "hold" ? "Hold" : "Preorder"}</span><strong>${esc(r.product_name)}</strong>${r.qty > 1 ? ` × ${r.qty}` : ""}
      <div class="note"><span class="res-status ${r.status}">${RS[r.status]}</span>, requested ${esc(timeAgo(r.created_at))}</div></div>
      <button class="btn small danger" data-res-cancel="${esc(r.id)}">Cancel</button></div>`).join("")
    : `<p class="note">Nothing reserved right now. <a href="#shop">Browse the shop</a></p>`;
  const myC = state.campaigns.filter(c => c.dm_user === state.user.id || state.members.some(m => m.campaign_id === c.id && m.user_id === state.user.id)).filter(c => c.status !== "ended");
  $("#myCamps").innerHTML = myC.length ? myC.map(c => `
    <div class="mine-row"><div><strong>${esc(c.title)}</strong>${c.dm_user === state.user.id ? ' <span class="pill kind">You\'re the DM</span>' : ""}${c.status === "pending" ? ' <span class="pill">Waiting for approval</span>' : ""}
      <div class="note">${WEEKDAYS[c.weekday]}s at ${esc(fmtTime((c.start_time||"").slice(0,5)))}${c.status !== "pending" ? `. Next: ${esc(fmtDate(nextSession(c),{weekday:"short",month:"short",day:"numeric"}))}` : ""}</div></div>
      <a class="btn small" href="#events">View</a></div>`).join("")
    : `<p class="note">You're not in a campaign yet. <a href="#events">See ongoing campaigns</a></p>`;
  $("#staffBox").innerHTML = state.isStaff
    ? `<p>You're on staff as ${state.isOwner ? "an owner" : "an employee"}.</p><a class="btn small" href="#staff">Open the Staff page</a>`
    : state.request
      ? `<p class="note">Your staff request is waiting for the owner to approve it.</p>`
      : `<p class="note">Work at Titan? Ask for staff access and the owner will approve it.</p><button class="btn small" id="requestBtn">Request staff access</button>`;
  renderAccountExtras();
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

function itemTag(it, placeholder){
  const q = Number(it.qty)||0, soon = !!it.preorder, avail = Math.max(0, q - (Number(it.held)||0));
  const stock = soon ? `<span class="stock soon">${it.release_date ? `Coming ${esc(fmtDate(it.release_date,{month:"short",day:"numeric"}))}` : "Coming soon"}</span>`
    : q<=0 ? '<span class="stock out">Sold out</span>' : avail<=0 ? '<span class="stock out">All on hold</span>' : avail<=2 ? `<span class="stock low">Only ${avail} left</span>` : `<span class="stock">${avail} available</span>`;
  let action = "";
  if(!state.amBlocked){
    if(soon && state.feat.preorders) action = `<button class="btn small primary" data-reserve="${esc(it.sku)}" data-kind="preorder">Preorder</button>`;
    else if(!soon && avail > 0 && state.feat.holds) action = `<button class="btn small" data-reserve="${esc(it.sku)}" data-kind="hold">Hold for pickup</button>`;
  }
  let form = "";
  if(state.reserve && state.reserve.sku === it.sku){
    const max = state.reserve.kind === "hold" ? Math.min(avail, 10) : 10;
    form = `<div class="reserve-form">
      <label for="rq-qty">How many?</label>
      <select id="rq-qty">${Array.from({length:Math.max(1,max)},(_,i)=>`<option>${i+1}</option>`).join("")}</select>
      ${state.user ? "" : `<input type="text" id="rq-name" maxlength="60" placeholder="Your name" aria-label="Your name">
      <input type="text" id="rq-contact" maxlength="80" placeholder="Phone or email" aria-label="Phone or email">`}
      <p class="note">${state.reserve.kind === "hold" ? "Pay when you pick it up. The store will set it aside for you." : "Pay when it comes in. The store will let you know when it's ready."}</p>
      <div class="bactions"><button class="btn small primary" data-reserve-go="1">${state.reserve.kind === "hold" ? "Request hold" : "Request preorder"}</button><button class="btn small" data-reserve-cancel="1">Cancel</button></div>
    </div>`;
    action = "";
  }
  return `<div class="tag${it.image_url || placeholder ? " has-img" : ""}">
    ${it.image_url ? `<div class="tag-img"><img src="${esc(it.image_url)}" alt="" loading="lazy" onerror="this.parentNode.classList.add('ph');this.remove()"></div>` : placeholder ? `<div class="tag-img ph"></div>` : ""}
    <div class="cat">${esc(CATS[it.category]?.label||"Other")}${soon ? ' <span class="pill kind">Preorder</span>' : ""}</div><div class="name">${esc(it.name)}</div>
    <div class="bottom"><span class="price">${money(it.price)}</span>${stock}</div>
    ${action ? `<div class="tag-act">${action}</div>` : ""}${form}</div>`;
}

function renderHome(){
  const follows = (state.user && state.profile?.follows) || [];
  $("#homeShelf").innerHTML = featuredGames().sort((a,b) => (follows.includes(b.slug) ? 1 : 0) - (follows.includes(a.slug) ? 1 : 0)).map(g => {
    const next = state.events.find(e => e.game_slug === g.slug);
    return `<a class="game-tile" href="#game-${esc(g.slug)}" style="--gc:${g.color};--gi:${inkFor(g.color)}">
      <span class="gt-name">${esc(shortName(g.name))}</span>
      <span class="gt-sub">${next ? `Next: ${esc(fmtDate(next.date,{weekday:"short",month:"short",day:"numeric"}))}` : "News, events, and products"}</span></a>`;
  }).join("") + `<a class="game-tile shop-all" href="#shop"><span class="gt-name">Shop everything</span><span class="gt-sub">Board games, model kits, Funko, dice, and more</span></a>`;
  const evs = state.events.slice(0,4);
  $("#homeEvents").innerHTML = evs.length ? evs.map(e => {
    const n = taken(e.id), full = n >= e.seats;
    const [y,m,d] = e.date.split("-").map(Number); const dt=new Date(y,m-1,d);
    return `<div class="ev-row"><div class="date-chip"><b>${dt.getDate()}</b><span>${dt.toLocaleDateString(undefined,{month:"short"})}</span></div>
      <div>${gameTag(e.game_slug, e.game)}<strong>${esc(e.title)}</strong><div class="note">${esc(fmtDate(e.date,{weekday:"long"}))} at ${esc(fmtTime(e.time))}</div></div>
      <div class="seats ${full?"full":""}">${full?"Full":`${e.seats-n} seat${e.seats-n===1?"":"s"} left`}</div></div>`;
  }).join("") : `<p class="muted" style="margin:8px 0">No game nights posted yet.</p>`;
  const news = sortedNews().slice(0,2);
  $("#homeNews").innerHTML = news.length ? news.map(p=>postHtml(p,false)).join("") : `<p class="muted">No announcements yet.</p>`;
  const fresh = state.inventory.filter(i=>i.qty>0).sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,4);
  $("#homeNew").innerHTML = fresh.length ? fresh.map(i => itemTag(i, fresh.some(x => x.image_url))).join("") : `<div class="empty">Inventory shows up here once it's uploaded.</div>`;
}

function renderShop(){
  const chips = [["all","Everything"],...Object.entries(CATS).map(([k,c])=>[k,c.label])];
  if(state.inventory.some(i => i.preorder)) chips.push(["soon","Coming soon"]);
  $("#shopChips").innerHTML = chips
    .map(([k,l]) => `<button class="chip" data-cat="${k}" aria-pressed="${state.shopCat===k}">${esc(l)}</button>`).join("");
  const q = $("#shopSearch").value.trim().toLowerCase(), only = $("#inStockOnly").checked;
  const list = state.inventory.filter(i =>
    (state.shopCat==="all" || (state.shopCat==="soon" ? i.preorder : i.category===state.shopCat)) &&
    (!$("#shopGame").value || i.game_slug === $("#shopGame").value) &&
    (!q || i.name.toLowerCase().includes(q)) &&
    (!only || i.qty > 0)
  ).sort((a,b)=>a.name.localeCompare(b.name));
  const anyImg = list.some(i => i.image_url);
  const can = [state.feat.holds && "hold in-stock items for pickup", state.feat.preorders && "preorder new releases"].filter(Boolean);
  $("#shopSub").textContent = "Stock is updated by the store." + (can.length ? ` You can ${can.join(" or ")}, then pay when you pick them up.` : " Call ahead to hold something.");
  $("#shopItems").innerHTML = list.length ? list.map(i => itemTag(i, anyImg)).join("") :
    `<div class="empty" style="grid-column:1/-1">${state.inventory.length ? "Nothing matches that search." : "The store's inventory hasn't been uploaded yet."}</div>`;
}

function eventEditForm(e){
  return `<div class="ev-card editing" style="border-left-color:${gameColor(e.game_slug, e.game)}">
    <h3 style="margin:0 0 12px">Editing game night</h3>
    <div class="grid2">
      <div class="field"><label for="ee-title">Title</label><input type="text" id="ee-title" value="${esc(e.title)}"></div>
      <div class="field"><label for="ee-game">Game</label><select id="ee-game">${gameOptions(e.game_slug || (e.game === "dnd" ? "dnd" : ""), e.game_slug ? undefined : "Pick a game")}</select></div>
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
    <div class="grid2">
      <div class="field"><label for="ee-format">Format</label><input type="text" id="ee-format" maxlength="60" value="${esc(e.format||"")}" placeholder="Commander, Standard, League"></div>
      <div class="field"><label for="ee-type">Kind of event</label><select id="ee-type"><option value="">Not set</option>${Object.entries(EVENT_TYPES).map(([k,v]) => `<option value="${k}" ${e.event_type===k?"selected":""}>${v}</option>`).join("")}</select></div>
    </div>
    <div class="field"><label for="ee-desc">Description</label><textarea id="ee-desc" rows="4" maxlength="2000">${esc(e.description||"")}</textarea></div>
    <div class="bactions"><button class="btn small primary" data-save-event="${esc(e.id)}">Save</button><button class="btn small" data-cancel-event="1">Cancel</button></div>
  </div>`;
}
function eventCard(e, staff){
  if(staff && state.editEvent === e.id) return eventEditForm(e);
  const n = taken(e.id), full = n >= e.seats;
  const pct = Math.min(100, Math.round(n/e.seats*100));
  let html = `<div class="ev-card ${e.game}" style="border-left-color:${gameColor(e.game_slug, e.game)}">
    <div class="ev-tags">${gameTag(e.game_slug, e.game)}${e.format ? `<span class="pill">${esc(e.format)}</span>` : ""}${e.event_type ? `<span class="pill">${EVENT_TYPES[e.event_type]}</span>` : ""}</div>
    <div class="when">${esc(fmtDate(e.date,{weekday:"long",month:"long",day:"numeric"}))} at ${esc(fmtTime(e.time))}</div>
    <h3 style="margin:2px 0 0"><a class="ev-link" href="#event-${esc(e.id)}">${esc(e.title)}</a></h3>
    <div class="meta"><span>${esc(e.fee||"Free")}</span>${e.notes?`<span>${esc(e.notes)}</span>`:""}</div>
    <div class="seats ${full?"full":""}">${n} of ${e.seats} seats taken</div>
    <div class="bar"><i style="width:${pct}%;background:${gameColor(e.game_slug, e.game)}"></i></div>`;
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
  await loadPP((rows || []).map(r => r.user_id));
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
    <div class="ev-card ev-detail ${e.game}" style="border-left-color:${gameColor(e.game_slug, e.game)}">
      <div class="ev-tags">${gameTag(e.game_slug, e.game)}${e.format ? `<span class="pill">${esc(e.format)}</span>` : ""}${e.event_type ? `<span class="pill">${EVENT_TYPES[e.event_type]}</span>` : ""}</div>
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
        ? `<ol class="players">${list.map(p => `<li>${p.user_id ? avatarHtml(p.user_id, 24) : '<span class="av guest" style="--avs:24px" aria-hidden="true"></span>'} ${esc(p.name)}${staffBadge(p.user_id)}${p.is_me ? ' <span class="note">(you)</span>' : ""}</li>`).join("")}</ol>`
        : `<p class="note">Nobody yet. Be the first to sign up!</p>`}
    </div>`;
}
async function refreshDetail(){ if(state.view === "event" && state.detailId){ try{ await loadPlayers(state.detailId); }catch(e){ console.error(e); } } }

function renderEvents(){
  const withNights = activeGames().filter(g => state.events.some(e => e.game_slug === g.slug));
  if(state.evGame !== "all" && !withNights.some(g => g.slug === state.evGame) && gameBy(state.evGame)) withNights.push(gameBy(state.evGame));
  $("#evFilters").innerHTML = `<button class="chip" data-evfilter="all" aria-pressed="${state.evGame==="all"}">All games</button>` +
    withNights.map(g => `<button class="chip game-chip" data-evfilter="${esc(g.slug)}" aria-pressed="${state.evGame===g.slug}" style="--gc:${g.color};--gi:${inkFor(g.color)}">${esc(shortName(g.name))}</button>`).join("");
  const list = state.events.filter(e => state.evGame === "all" || e.game_slug === state.evGame);
  const g = gameBy(state.evGame);
  $("#evList").innerHTML = list.length ? list.map(e => eventCard(e, false)).join("")
    : `<div class="empty">${g ? `No ${esc(shortName(g.name))} nights on the schedule right now.` : "No game nights posted yet."}</div>`;
}

function sortedNews(){ return [...state.news].sort((a,b)=> (b.pinned?1:0)-(a.pinned?1:0) || b.createdAt-a.createdAt); }
function postHtml(p, staff){
  if(staff && state.editNews === p.id) return `<article class="post editing">
    <h3 style="margin:0 0 12px">Editing announcement</h3>
    <div class="field"><label for="en-title">Title</label><input type="text" id="en-title" value="${esc(p.title)}"></div>
    <div class="field"><label for="en-body">Message</label><textarea id="en-body" rows="4">${esc(p.body)}</textarea></div>
    <div class="field"><label for="en-game">For which game?</label><select id="en-game">${gameOptions(p.game_slug || "", "Whole store")}</select></div>
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

function itemMoreRow(i){
  const c = state.photoCands && state.photoCands.sku === i.sku ? state.photoCands : null;
  return `<tr class="item-more"><td colspan="6"><div class="more-grid">
    <div class="more-photo">${i.image_url ? `<img src="${esc(i.image_url)}" alt="Photo of ${esc(i.name)}">` : `<div class="no-photo">No photo</div>`}</div>
    <div>
      <div class="grid3">
        <div class="field"><label>Game</label><select class="inline-in" data-field="game_slug" data-sku="${esc(i.sku)}" aria-label="Game for ${esc(i.name)}">${gameOptions(i.game_slug || "", "None (any game)")}</select></div>
        <div class="field"><label>Barcode</label><div class="scan-row"><input type="text" class="inline-in" inputmode="numeric" maxlength="32" value="${esc(i.barcode||"")}" data-field="barcode" data-sku="${esc(i.sku)}" aria-label="Barcode for ${esc(i.name)}"><button type="button" class="btn small" data-scanfor="${esc(i.sku)}">Scan</button></div></div>
        <div class="field"><label>Release date</label><input type="date" class="inline-in" value="${esc(i.release_date||"")}" data-field="release_date" data-sku="${esc(i.sku)}" aria-label="Release date for ${esc(i.name)}"></div>
        <div class="field" style="display:flex;align-items:flex-end"><label style="display:flex;gap:8px;align-items:center;margin:0 0 10px;color:var(--ink)"><input type="checkbox" data-field="preorder" data-sku="${esc(i.sku)}" ${i.preorder?"checked":""}> Coming soon, preorder</label></div>
      </div>
      <div class="bactions">
        <button class="btn small" data-findphoto="${esc(i.sku)}">Find photo from barcode</button>
        <label class="btn small" style="cursor:pointer">Upload or take photo<input type="file" accept="image/*" data-upload="${esc(i.sku)}" hidden></label>
        ${i.image_url ? `<button class="btn small danger" data-rmphoto="${esc(i.sku)}">Remove photo</button>` : ""}
      </div>
      ${c ? `<div class="cands">${c.loading ? `<p class="note">Looking up barcode...</p>` : c.note ? `<p class="note">${esc(c.note)}</p>` : ""}
        ${c.images && c.images.length ? `<p class="note">Tap the photo you want to use${c.title ? ` for "${esc(c.title)}"` : ""}:</p><div class="cand-row">${c.images.map(u => `<button class="cand" data-pick="${esc(u)}" data-sku="${esc(i.sku)}"><img src="${esc(u)}" alt="" loading="lazy" onerror="this.parentNode.remove()"></button>`).join("")}</div>` : (!c.loading && !c.note ? `<p class="note">No photos found for that barcode. Try uploading one instead.</p>` : "")}
      </div>` : ""}
    </div>
  </div></td></tr>`;
}
async function setPhoto(sku, url){
  must(await sb.from("products").update({ image_url:url, updated_at:nowIso() }).eq("sku", sku));
  state.photoCands = null; await loadProducts(); renderInventoryTable(); renderHome(); renderShop();
}
// Shrinks a phone photo before upload so it loads fast and saves storage.
function shrinkImage(file, maxSide = 1000){
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement("canvas"); c.width = Math.round(img.width*scale); c.height = Math.round(img.height*scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      c.toBlob(b => b ? resolve(b) : reject(new Error("Couldn't read that photo")), "image/jpeg", 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Couldn't read that photo")); };
    img.src = url;
  });
}
function renderStaffEvents(){
  $("#staffEvents").innerHTML = state.events.length ? state.events.map(e=>eventCard(e,true)).join("") : `<p class="muted">Nothing scheduled.</p>`;
}
function renderStaffNews(){ $("#staffNews").innerHTML = sortedNews().map(p=>postHtml(p,true)).join(""); }

/* ---------- holds and preorders (staff) ---------- */
function renderRes(){
  if(!state.isStaff) return;
  const active = state.reservations.filter(r => r.status === "requested" || r.status === "ready");
  const waiting = state.reservations.filter(r => r.status === "requested").length;
  $("#resChip").textContent = waiting ? `Holds & preorders (${waiting})` : "Holds & preorders";
  const off = [!state.feat.holds && "Holds", !state.feat.preorders && "Preorders"].filter(Boolean);
  $("#resOffNote").hidden = !off.length;
  $("#resOffNote").textContent = off.length ? `${off.join(" and ")} ${off.length > 1 ? "are" : "is"} turned off in Site settings, so customers can't make new requests.` : "";
  document.querySelectorAll("[data-resfilter]").forEach(b => b.setAttribute("aria-pressed", b.dataset.resfilter === state.resFilter));
  const list = state.resFilter === "active" ? active : state.reservations.filter(r => r.status === "picked_up" || r.status === "cancelled");
  const RS = { requested:"Requested", ready:"Ready for pickup", picked_up:"Picked up", cancelled:"Cancelled" };
  $("#resList").innerHTML = list.length ? list.map(r => `
    <div class="res-row ${r.status}">
      <div class="res-main">
        <span class="pill kind">${r.kind === "hold" ? "Hold" : "Preorder"}</span><span class="res-status ${r.status}">${RS[r.status]}</span>
        <div class="res-item"><strong>${esc(r.product_name)}</strong>${r.qty > 1 ? ` × ${r.qty}` : ""}</div>
        <div class="note">${esc(r.name)}${r.contact ? `, ${esc(r.contact)}` : ""}. Requested ${esc(timeAgo(r.created_at))}.</div>
      </div>
      <div class="bactions">
        ${r.status === "requested" ? `<button class="btn small primary" data-res-status="${esc(r.id)}" data-to="ready">Mark ready</button>` : ""}
        ${r.status === "ready" ? `<button class="btn small primary" data-res-status="${esc(r.id)}" data-to="picked_up">Picked up</button>` : ""}
        ${r.status === "requested" || r.status === "ready" ? `<button class="btn small danger" data-res-status="${esc(r.id)}" data-to="cancelled">Cancel</button>` : ""}
        ${(r.status === "picked_up" || r.status === "cancelled") && state.isOwner ? `<button class="btn small danger" data-res-del="${esc(r.id)}">Delete</button>` : ""}
      </div>
    </div>`).join("") : `<p class="note">${state.resFilter === "active" ? "No open holds or preorders." : "Nothing finished yet."}</p>`;
}

/* ---------- campaigns and DM sign-ups ---------- */
const WEEKDAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
function nextSession(c){
  const now = new Date(), d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let add = (c.weekday - d.getDay() + 7) % 7;
  if(add === 0){ const [h,m] = (c.start_time||"00:00").split(":").map(Number); if(now.getHours()*60 + now.getMinutes() > h*60 + m) add = 7; }
  d.setDate(d.getDate() + add);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function campForm(c){
  const v = c || { title:"", system:"D&D 5e", weekday:0, start_time:"14:00", seats:5, level:"", description:"", note:"", dm_name:"" };
  const id = c ? c.id : "new";
  return `<div class="camp-form">
    <h3 style="margin:0 0 12px">${c ? "Editing campaign" : "Offer to run a game"}</h3>
    ${c ? "" : `<p class="note">${state.isStaff ? "Staff games go live right away." : "The store looks over new games before they show up. You'll be listed as the DM."}</p>`}
    <div class="grid2">
      <div class="field"><label for="cf-title">Campaign name</label><input type="text" id="cf-title" maxlength="100" value="${esc(v.title)}" placeholder="Curse of Strahd"></div>
      <div class="field"><label for="cf-system">Game system</label><input type="text" id="cf-system" maxlength="60" value="${esc(v.system||"")}" placeholder="D&D 5e, Pathfinder 2e"></div>
    </div>
    <div class="grid3">
      <div class="field"><label for="cf-day">Day</label><select id="cf-day">${WEEKDAYS.map((n,i)=>`<option value="${i}" ${Number(v.weekday)===i?"selected":""}>${n}s</option>`).join("")}</select></div>
      <div class="field"><label for="cf-time">Start time</label><input type="time" id="cf-time" value="${esc((v.start_time||"").slice(0,5))}"></div>
      <div class="field"><label for="cf-seats">Player seats</label><input type="number" id="cf-seats" min="1" max="12" value="${v.seats}"></div>
    </div>
    <div class="grid2">
      <div class="field"><label for="cf-level">Who it's for</label><input type="text" id="cf-level" maxlength="60" value="${esc(v.level||"")}" placeholder="Beginners welcome, level 5 characters"></div>
      ${state.isStaff ? `<div class="field"><label for="cf-dm">DM name</label><input type="text" id="cf-dm" maxlength="60" value="${esc(v.dm_name || myName())}"></div>` : "<div></div>"}
    </div>
    <div class="field"><label for="cf-desc">About the campaign</label><textarea id="cf-desc" rows="4" maxlength="2000" placeholder="The story, the tone, what players should bring">${esc(v.description||"")}</textarea></div>
    ${c ? `<div class="field"><label for="cf-note">Session note</label><input type="text" id="cf-note" maxlength="200" value="${esc(v.note||"")}" placeholder="No session Thanksgiving week"></div>` : ""}
    <div class="bactions"><button class="btn small primary" data-save-camp="${esc(id)}">${c ? "Save" : state.isStaff ? "Add campaign" : "Send to the store"}</button><button class="btn small" data-cancel-camp="1">Cancel</button></div>
  </div>`;
}
function campCard(c){
  const members = state.members.filter(m => m.campaign_id === c.id);
  const isDM = !!state.user && c.dm_user === state.user.id;
  const mine = state.user && members.find(m => m.user_id === state.user.id);
  const canManage = isDM || state.isStaff;
  if(state.editCamp === c.id && canManage) return `<article class="camp editing">${campForm(c)}</article>`;
  const LABEL = { pending:"Waiting for approval", recruiting:"Open to join", full:"Full", ended:"Ended" };
  const pct = Math.min(100, Math.round(members.length / c.seats * 100));
  let join = "";
  if(c.status === "recruiting" || c.status === "full"){
    if(!state.user) join = c.status === "recruiting" ? `<p class="note"><a href="#account">Log in</a> to join this campaign.</p>` : "";
    else if(isDM) join = `<p class="signed">You're the DM</p>`;
    else if(mine) join = `<p class="signed">✓ You're in</p><button class="btn small" data-leave-camp="${esc(c.id)}">Leave campaign</button>`;
    else if(state.amBlocked) join = "";
    else if(c.status === "recruiting") join = `<button class="btn primary" data-join-camp="${esc(c.id)}">Join campaign</button>`;
    else join = `<p class="note">This group is full right now.</p>`;
  }
  const manage = canManage ? `<div class="bactions">
      <button class="btn small" data-edit-camp="${esc(c.id)}">Edit</button>
      ${c.status === "pending" && state.isStaff ? `<button class="btn small primary" data-camp-status="${esc(c.id)}" data-to="recruiting">Approve</button><button class="btn small danger" data-del-camp="${esc(c.id)}">Decline</button>` : ""}
      ${c.status === "pending" && !state.isStaff ? `<button class="btn small danger" data-del-camp="${esc(c.id)}">Withdraw</button>` : ""}
      ${c.status === "recruiting" ? `<button class="btn small" data-camp-status="${esc(c.id)}" data-to="full">Close to new players</button>` : ""}
      ${c.status === "full" && members.length < c.seats ? `<button class="btn small" data-camp-status="${esc(c.id)}" data-to="recruiting">Reopen</button>` : ""}
      ${c.status === "recruiting" || c.status === "full" ? `<button class="btn small danger" data-camp-status="${esc(c.id)}" data-to="ended">End campaign</button>` : ""}
      ${c.status === "ended" && state.isStaff ? `<button class="btn small" data-camp-status="${esc(c.id)}" data-to="recruiting">Restart</button><button class="btn small danger" data-del-camp="${esc(c.id)}">Delete</button>` : ""}
    </div>` : "";
  return `<article class="camp ${c.status}">
    ${c.system ? `<span class="pill kind">${esc(c.system)}</span>` : ""}${c.level ? `<span class="pill">${esc(c.level)}</span>` : ""}<span class="pill camp-st ${c.status}">${LABEL[c.status]}</span>
    <h3>${esc(c.title)}</h3>
    <div class="byline">Run by ${esc(c.dm_name || "the store")}. ${WEEKDAYS[c.weekday]}s at ${esc(fmtTime((c.start_time||"").slice(0,5)))}.</div>
    ${c.status === "recruiting" || c.status === "full" ? `<div class="when">Next session: ${esc(fmtDate(nextSession(c),{weekday:"long",month:"long",day:"numeric"}))}</div>` : ""}
    ${c.note ? `<p class="camp-note">${esc(c.note)}</p>` : ""}
    ${c.description ? `<div class="desc">${esc(c.description)}</div>` : ""}
    <div class="seats ${members.length >= c.seats ? "full" : ""}">${members.length} of ${c.seats} players</div>
    <div class="bar"><i style="width:${pct}%"></i></div>
    ${members.length ? `<p class="camp-players">${members.map(m => `<span class="player">${avatarHtml(m.user_id, 20)}${esc(m.name)}${state.user && m.user_id === state.user.id ? " (you)" : ""}${canManage ? ` <button class="x" data-kick="${esc(c.id)}" data-user="${esc(m.user_id)}" aria-label="Remove ${esc(m.name)}">×</button>` : ""}</span>`).join("")}</p>` : ""}
    ${join}${manage}
  </article>`;
}
function renderCampaigns(){
  const visible = state.campaigns.filter(c => c.status === "recruiting" || c.status === "full" || (c.status === "pending" && state.user && c.dm_user === state.user.id && !state.isStaff));
  $("#campaignList").innerHTML = visible.length ? visible.map(campCard).join("") : `<div class="empty">No ongoing campaigns yet. Want to run one?</div>`;
  $("#dmOffer").hidden = !state.dmOpen;
  if(state.dmOpen){
    const typing = $("#dmOffer").contains(document.activeElement);
    if(!typing) $("#dmOffer").innerHTML = state.user ? (state.amBlocked ? `<p class="note">Your account can't offer games right now. Please talk to the store.</p>` : campForm(null)) : `<p style="margin:0"><a href="#account">Log in or make an account</a> to offer a game.</p>`;
  }
  if(state.isStaff){
    const pend = state.campaigns.filter(c => c.status === "pending");
    $("#campChip").textContent = pend.length ? `Campaigns (${pend.length})` : "Campaigns";
    $("#campPending").innerHTML = pend.length ? pend.map(campCard).join("") : `<p class="note">No one is waiting.</p>`;
    const rest = state.campaigns.filter(c => c.status !== "pending");
    $("#campAll").innerHTML = rest.length ? rest.map(campCard).join("") : `<p class="note">No campaigns yet.</p>`;
  }
}

/* ---------- Facebook feed ---------- */
function renderFb(){
  const url = state.feat.fb;
  if(!url){ $("#fbFeed").innerHTML = ""; $("#fbFeed").dataset.url = ""; return; }
  if($("#fbFeed").dataset.url === url) return;   // don't reload the feed on every refresh
  $("#fbFeed").dataset.url = url;
  const src = "https://www.facebook.com/plugins/page.php?href=" + encodeURIComponent(url) + "&tabs=timeline&width=500&height=700&small_header=true&adapt_container_width=true&hide_cover=false&show_facepile=false";
  $("#fbFeed").innerHTML = `<h2 style="margin-top:28px">From our Facebook</h2>
    <div class="fb-wrap"><iframe src="${esc(src)}" width="500" height="700" style="border:none;overflow:hidden" scrolling="no" frameborder="0" allowfullscreen="true" allow="encrypted-media" loading="lazy" title="Titan Game and Hobby on Facebook"></iframe></div>
    <p class="note">Don't see posts? Some browsers block Facebook. <a href="${esc(url)}" target="_blank" rel="noopener">Open our Facebook page</a></p>`;
}

function renderAll(){
  state.pendingRender = false;
  renderHome(); renderShop(); renderEvents(); renderNews(); renderAccount(); renderBoard(); renderDiscuss(); renderEventDetail(); renderCampaigns(); renderFb(); renderStore(); renderGameHub(); renderBell(); renderContact(); renderWinners();
  if(state.isStaff){ renderInventoryTable(); renderStaffEvents(); renderStaffNews(); renderTeam(); renderBlocked(); renderRes(); renderToday(); renderMsgs(); renderReports(); renderStaffResults(); renderPlayers(); }
}

/* ---------- community board ---------- */
const LFG_KINDS  = { lfp:"Looking for players", lfg:"Looking for a group" };
const DISC_KINDS = { pull:"Pulls & collection", talk:"Discussion", deck:"Deck help", question:"Question" };
const KINDS = { ...LFG_KINDS, ...DISC_KINDS };
const isDisc = p => !!DISC_KINDS[p.kind];
state.dKind = "all"; state.dpFiles = []; state.likes = [];

$("#npKind").innerHTML = Object.entries(LFG_KINDS).map(([k,v]) => `<option value="${k}">${esc(v)}</option>`).join("");
$("#dpKind").innerHTML = Object.entries(DISC_KINDS).map(([k,v]) => `<option value="${k}">${esc(v)}</option>`).join("");
fillGameSelects();

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
  state.likes = ids.length ? must(await sb.from("post_likes").select("post_id,user_id").in("post_id", ids)) : [];
  await loadPP([...state.posts.map(p => p.user_id), ...state.replies.map(r => r.user_id)]);
}
function renderBoard(){
  $("#boardLogin").hidden = !!state.user;
  $("#boardNew").hidden = !state.user || state.amBlocked;
  $("#boardLogin").innerHTML = state.amBlocked ? `<p style="margin:0">Your account can't post on the community board right now. Please talk to the store.</p>` : `<p style="margin:0"><a href="#account">Log in or make an account</a> to post or reply.</p>`;
  $("#boardLogin").hidden = !!state.user && !state.amBlocked;
  $("#boardKinds").innerHTML = [["all","All posts"], ...Object.entries(LFG_KINDS)]
    .map(([k,l]) => `<button class="chip" data-bkind="${k}" aria-pressed="${state.bKind===k}">${esc(l)}</button>`).join("");
  const game = $("#bGame").value || "all", showClosed = $("#bClosed").checked;
  const list = state.posts.filter(p => !isDisc(p) &&
    (state.bKind==="all" || p.kind===state.bKind) && (game==="all" || p.game===game) && (showClosed || p.status==="open"));
  $("#boardList").innerHTML = list.length ? list.map(postCard).join("") :
    `<div class="empty">${state.posts.some(p => !isDisc(p)) ? "No posts match those filters." : "No posts yet. Be the first to find your party!"}</div>`;
}

/* ---------- discussion page ---------- */
function renderDiscuss(){
  $("#discLogin").innerHTML = state.amBlocked ? `<p style="margin:0">Your account can't post right now. Please talk to the store.</p>` : `<p style="margin:0"><a href="#account">Log in or make an account</a> to post, like, or reply.</p>`;
  $("#discLogin").hidden = !!state.user && !state.amBlocked;
  $("#discNew").hidden = !state.user || state.amBlocked;
  $("#discKinds").innerHTML = [["all","Everything"], ...Object.entries(DISC_KINDS)]
    .map(([k,l]) => `<button class="chip" data-dkind="${k}" aria-pressed="${state.dKind===k}">${esc(l)}</button>`).join("");
  const game = $("#dGame").value || "all";
  const list = state.posts.filter(p => isDisc(p) && (state.dKind==="all" || p.kind===state.dKind) && (game==="all" || p.game===game));
  $("#discList").innerHTML = list.length ? list.map(postCard).join("") :
    `<div class="empty">${state.posts.some(isDisc) ? "No posts match those filters." : "Nothing here yet. Show off your best pull!"}</div>`;
  renderPhotoPreview();
}
function renderPhotoPreview(){
  $("#dpPreview").innerHTML = state.dpFiles.map((f,i) => `<span class="pp"><img src="${f.url}" alt=""><button type="button" class="x" data-rmpp="${i}" aria-label="Remove photo">×</button></span>`).join("");
}
$("#dGame").addEventListener("change", renderDiscuss);
$("#dpPhotos").addEventListener("change", ev => {
  const files = [...ev.target.files].filter(f => f.type.startsWith("image/"));
  for(const f of files){ if(state.dpFiles.length >= 4){ toast("Up to 4 photos per post"); break; } state.dpFiles.push({ file:f, url:URL.createObjectURL(f) }); }
  ev.target.value = ""; renderPhotoPreview();
});
const likeCount = id => state.likes.filter(l => l.post_id === id).length;
const iLiked = id => !!state.user && state.likes.some(l => l.post_id === id && l.user_id === state.user.id);
// Turns a stored photo link back into its storage path so it can be deleted with the post.
const photoPath = url => { const m = String(url).split("/storage/v1/object/public/post-photos/")[1]; return m ? decodeURIComponent(m.split("?")[0]) : null; };
function postCard(p){
  const mine = state.user && p.user_id === state.user.id;
  const canRemove = mine || state.isStaff;
  const reps = state.replies.filter(r => r.post_id === p.id);
  if(state.editing === p.id){
    return `<article class="bpost ${p.kind}">
      <div class="grid2">
        <div class="field"><label>Type</label><select id="ed-kind">${Object.entries(isDisc(p) ? DISC_KINDS : LFG_KINDS).map(([k,v])=>`<option value="${k}" ${p.kind===k?"selected":""}>${esc(v)}</option>`).join("")}</select></div>
        <div class="field"><label>Game</label><select id="ed-game">${boardGameOptions(p.game, false)}</select></div>
      </div>
      <div class="field"><label>Title</label><input type="text" id="ed-title" maxlength="100" value="${esc(p.title)}"></div>
      <div class="field"><label>Details</label><textarea id="ed-body" rows="4" maxlength="2000">${esc(p.body)}</textarea></div>
      <div class="bactions"><button class="btn small primary" data-edit-save="${esc(p.id)}">Save</button><button class="btn small" data-edit-cancel="1">Cancel</button></div>
    </article>`;
  }
  return `<article class="bpost ${p.kind} ${p.status==="closed"?"closed":""}">
    <span class="pill kind">${esc(KINDS[p.kind]||"Post")}</span>${gameBy(p.game) ? gameTag(p.game) : `<span class="pill">${esc(boardGameName(p.game))}</span>`}${p.status==="closed"?'<span class="pill closed">Closed</span>':""}
    <h3>${esc(p.title)}</h3>
    <div class="byline with-av">${avatarHtml(p.user_id, 28)}<span>${esc(p.author_name)}${staffBadge(p.user_id)}, ${esc(timeAgo(p.created_at))}${p.updated_at && p.updated_at !== p.created_at ? " (edited)" : ""}</span></div>
    <div class="body">${esc(p.body)}</div>
    ${p.images && p.images.length ? `<div class="post-photos n${Math.min(p.images.length,4)}">${p.images.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="Photo posted by ${esc(p.author_name)}" loading="lazy"></a>`).join("")}</div>` : ""}
    ${isDisc(p) || reportBtn("post", p.id, p.user_id) ? `<div class="bactions">${isDisc(p) ? `<button class="btn small like-btn ${iLiked(p.id)?"liked":""}" data-like="${esc(p.id)}" aria-pressed="${iLiked(p.id)}" aria-label="Like">♥ ${likeCount(p.id)}</button>` : ""}${reportBtn("post", p.id, p.user_id)}</div>` : ""}
    ${canRemove ? `<div class="bactions">
      ${mine ? `<button class="btn small" data-edit="${esc(p.id)}">Edit</button>
      <button class="btn small" data-status="${esc(p.id)}" data-to="${p.status==="open"?"closed":"open"}">${p.status==="open" ? (isDisc(p) ? "Close replies" : "Found them, close post") : "Reopen"}</button>` : ""}
      <button class="btn small danger" data-del-post="${esc(p.id)}">${mine ? "Delete" : "Remove (staff)"}</button>${mine ? "" : blockBtn(p.user_id, p.author_name)}</div>` : ""}
    <details class="replies" ${reps.length && reps.length <= 3 ? "open" : ""}>
      <summary>${reps.length ? `${reps.length} repl${reps.length===1?"y":"ies"}` : "Reply"}</summary>
      ${reps.map(r => `<div class="reply"><div class="byline with-av">${avatarHtml(r.user_id, 24)}<span>${esc(r.author_name)}${staffBadge(r.user_id)}, ${esc(timeAgo(r.created_at))}</span></div><div class="body">${esc(r.body)}</div>${reportBtn("reply", r.id, r.user_id)}
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
  if(t.dataset.dkind){ state.dKind = t.dataset.dkind; renderDiscuss(); return; }
  if(t.dataset.dgame){ $("#dGame").value = t.dataset.dgame; state.dKind = "all"; renderDiscuss(); }
  if(t.dataset.rmpp !== undefined){ const f = state.dpFiles.splice(Number(t.dataset.rmpp), 1)[0]; if(f) URL.revokeObjectURL(f.url); renderPhotoPreview(); return; }
  if(t.dataset.edit){ state.editing = t.dataset.edit; renderBoard(); return; }
  if(t.dataset.editCancel){ state.editing = null; renderBoard(); return; }
  if(t.dataset.staff === "look") renderStoreForm();
  if(t.dataset.lookPick){ state.lookDraft = t.dataset.lookPick; applyLook(t.dataset.lookPick); renderLookPicker(); toast("Previewing. Click Save to keep it for everyone."); return; }
  if(t.dataset.evfilter){ state.evGame = t.dataset.evfilter; renderEvents(); renderWinners(); return; }
  if(t.dataset.evgame){ state.evGame = t.dataset.evgame; renderEvents(); renderWinners(); }
  if(t.dataset.shopgame){ $("#shopGame").value = t.dataset.shopgame; state.shopCat = "all"; renderShop(); }
  if(t.dataset.boardgame){ $("#bGame").value = t.dataset.boardgame; renderBoard(); }
  if(t.id === "ngAdd"){ addGame(); return; }
  if(t.id === "niScan"){
    const code = await scanBarcode("Scan the new item"); if(!code) return;
    const existing = state.inventory.find(i => i.barcode === code);
    if(existing && confirm(`"${existing.name}" already has this barcode. Go to it instead?`)){ showItem(existing); return; }
    prepareNewItem(code); return;
  }
  if(t.id === "invScan"){
    const code = await scanBarcode("Scan to find an item"); if(!code) return;
    const it = state.inventory.find(i => i.barcode === code);
    if(it){ showItem(it); toast(`Found ${it.name}`); return; }
    if(confirm(`Barcode ${code} isn't in your inventory yet. Add it as a new item?`)) prepareNewItem(code);
    return;
  }
  if(t.dataset.scanfor){
    const code = await scanBarcode("Scan this item's barcode"); if(!code) return;
    const box = document.querySelector(`[data-field="barcode"][data-sku="${CSS.escape(t.dataset.scanfor)}"]`);
    if(box){ box.value = code; box.dispatchEvent(new Event("change", { bubbles:true })); }
    return;
  }
  if(t.dataset.resfilter){ state.resFilter = t.dataset.resfilter; renderRes(); return; }
  if(t.dataset.reserve){ state.reserve = { sku:t.dataset.reserve, kind:t.dataset.kind }; renderHome(); renderShop(); return; }
  if(t.dataset.reserveCancel){ state.reserve = null; renderHome(); renderShop(); return; }
  if(t.dataset.more){ state.expandItem = state.expandItem === t.dataset.more ? null : t.dataset.more; state.photoCands = null; renderInventoryTable(); return; }
  if(t.id === "dmOfferBtn"){ state.dmOpen = !state.dmOpen; state.editCamp = null; renderCampaigns(); if(state.dmOpen) document.getElementById("cf-title")?.focus(); return; }
  if(t.dataset.editCamp){ state.editCamp = t.dataset.editCamp; renderCampaigns(); return; }
  if(t.dataset.cancelCamp){ state.editCamp = null; state.dmOpen = false; renderCampaigns(); return; }
  if(t.dataset.staff){
    document.querySelectorAll(".staff-nav [data-staff]").forEach(b=>b.setAttribute("aria-pressed", b===t));
    document.querySelectorAll("[data-pane]").forEach(p=>p.hidden = p.dataset.pane!==t.dataset.staff);
    return;
  }
  if(t.id==="modeBtn"){
    const m = document.documentElement.getAttribute("data-mode")==="dark" ? "light" : "dark"; applyMode(m);
    if(sb && state.user && state.profile){ state.profile.mode = m; state.acctFilled = null; sb.from("profiles").update({ mode:m }).eq("user_id", state.user.id).then(()=>{}); renderAccountExtras(); }
    return;
  }
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
    else if(t.id==="dpPost"){
      const title = $("#dpTitle").value.trim(), body = $("#dpBody").value.trim();
      if(!title || !body){ toast("Add a title and some details"); return; }
      t.disabled = true; const uploaded = [];
      try{
        for(const [i, f] of state.dpFiles.entries()){
          toast(`Uploading photo ${i+1} of ${state.dpFiles.length}...`);
          const blob = await shrinkImage(f.file, 1400);
          const path = `${state.user.id}/${Date.now()}-${i}.jpg`;
          const up = await sb.storage.from("post-photos").upload(path, blob, { contentType:"image/jpeg" });
          if(up.error) throw up.error;
          uploaded.push(sb.storage.from("post-photos").getPublicUrl(path).data.publicUrl);
        }
        must(await sb.from("posts").insert({ kind:$("#dpKind").value, game:$("#dpGame").value, title, body, images:uploaded }));
        state.dpFiles.forEach(f => URL.revokeObjectURL(f.url)); state.dpFiles = [];
        $("#dpTitle").value = ""; $("#dpBody").value = "";
        await loadBoard(); renderAll(); toast("Posted!");
      }catch(e){
        if(uploaded.length) sb.storage.from("post-photos").remove(uploaded.map(photoPath).filter(Boolean));
        handleError(e);
      }finally{ t.disabled = false; }
    }
    else if(t.dataset.like){
      if(!state.user){ toast("Log in to like posts"); return; }
      const id = t.dataset.like;
      if(iLiked(id)) must(await sb.from("post_likes").delete().eq("post_id", id).eq("user_id", state.user.id));
      else must(await sb.from("post_likes").insert({ post_id:id }));
      state.likes = must(await sb.from("post_likes").select("post_id,user_id").in("post_id", state.posts.map(p => p.id)));
      renderDiscuss(); renderGameHub();
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
      if(confirm("Delete this post and its replies?")){
        const post = state.posts.find(x => x.id === t.dataset.delPost);
        must(await sb.from("posts").delete().eq("id", t.dataset.delPost));
        const paths = (post?.images || []).map(photoPath).filter(Boolean);
        if(paths.length) sb.storage.from("post-photos").remove(paths);
        await loadBoard(); renderAll(); toast("Post deleted"); }
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
      let fbUrl = $("#siFb").value.trim();
      if(fbUrl && !/^https:\/\/(www\.|m\.)?(facebook|fb)\.com\//i.test(fbUrl)){ toast("The Facebook link should start with https://www.facebook.com/"); return; }
      const row = { address:$("#siAddress").value.trim(), phone:$("#siPhone").value.trim(), hours, hours_note:$("#siNote").value.trim() || null, facebook_url:fbUrl || null, alert_email:$("#siAlert").value.trim() || null, updated_at:nowIso() };
      must(await sb.from("site_settings").update(row).eq("id", 1));
      state.store = { address:row.address, phone:row.phone, hours, note:row.hours_note || "" };
      state.feat.fb = fbUrl; state.alertEmail = row.alert_email || ""; renderStore(); renderFb(); toast("Store info saved");
    }
    else if(t.dataset.reserveGo){
      const it = state.inventory.find(x => x.sku === state.reserve.sku); if(!it) return;
      const box = t.closest(".reserve-form"), get = id => box.querySelector("#" + id);
      const qty = parseInt(get("rq-qty").value, 10) || 1;
      const row = { kind:state.reserve.kind, sku:it.sku, qty };
      if(state.user){ row.user_id = state.user.id; row.name = myName(); row.contact = state.user.email; }
      else {
        row.name = get("rq-name").value.trim(); row.contact = get("rq-contact").value.trim();
        if(!row.name || !row.contact){ toast("Add your name and a phone or email so the store can reach you"); return; }
      }
      t.disabled = true;
      try{ must(await sb.from("reservations").insert(row)); }
      catch(e){ t.disabled = false; toast(String(e.message||"").replace(/^.*?:\s*/,"") || "That didn't go through. Try again."); return; }
      state.reserve = null; await Promise.all([loadReservations(), loadProducts()]); renderAll();
      toast(row.kind === "hold" ? "Hold requested! The store will set it aside." : "Preorder requested! The store will let you know when it's in.");
    }
    else if(t.dataset.resCancel){
      if(confirm("Cancel this request?")){ must(await sb.rpc("cancel_my_reservation", { rid:t.dataset.resCancel })); await Promise.all([loadReservations(), loadProducts()]); renderAll(); toast("Request cancelled"); }
    }
    else if(t.dataset.resStatus){
      if(t.dataset.to === "cancelled" && !confirm("Cancel this request?")) return;
      must(await sb.from("reservations").update({ status:t.dataset.to }).eq("id", t.dataset.resStatus));
      await Promise.all([loadReservations(), loadProducts()]); renderAll(); toast(t.dataset.to === "ready" ? "Marked ready" : t.dataset.to === "picked_up" ? "Picked up. Taken out of stock." : "Request cancelled");
    }
    else if(t.dataset.resDel){
      if(confirm("Delete this request for good?")){ must(await sb.from("reservations").delete().eq("id", t.dataset.resDel)); await loadReservations(); renderRes(); }
    }
    else if(t.id==="featSave"){
      must(await sb.from("site_settings").update({ holds_enabled:$("#featHolds").checked, preorders_enabled:$("#featPre").checked, updated_at:nowIso() }).eq("id", 1));
      state.feat.holds = $("#featHolds").checked; state.feat.preorders = $("#featPre").checked; renderAll(); toast("Shop features saved");
    }
    else if(t.dataset.findphoto){
      const it = state.inventory.find(x => x.sku === t.dataset.findphoto); if(!it) return;
      if(!it.barcode){ toast("Add the barcode first, then try again"); return; }
      state.photoCands = { sku:it.sku, loading:true }; renderInventoryTable();
      const { data, error } = await sb.functions.invoke("photo-lookup", { body:{ action:"lookup", barcode:it.barcode } });
      state.photoCands = error ? { sku:it.sku, note:"The photo finder isn't set up yet, or it had a problem. You can still upload a photo." } : { sku:it.sku, ...(data||{}) };
      renderInventoryTable();
    }
    else if(t.dataset.pick){
      t.disabled = true; toast("Saving photo...");
      const { data, error } = await sb.functions.invoke("photo-lookup", { body:{ action:"save", sku:t.dataset.sku, imageUrl:t.dataset.pick } });
      if(error || !data?.url){ t.disabled = false; toast(data?.error || "Couldn't save that photo. Try another one."); return; }
      await setPhoto(t.dataset.sku, data.url); toast("Photo saved");
    }
    else if(t.dataset.rmphoto){
      if(confirm("Remove this photo?")){ await setPhoto(t.dataset.rmphoto, null); toast("Photo removed"); }
    }
    else if(t.dataset.saveCamp){
      const id = t.dataset.saveCamp, form = t.closest(".camp-form"), f = k => form.querySelector("#cf-" + k);
      const row = { title:f("title").value.trim(), system:f("system").value.trim() || null, weekday:parseInt(f("day").value,10),
        start_time:f("time").value, seats:Math.min(12, Math.max(1, parseInt(f("seats").value,10)||5)), level:f("level").value.trim() || null,
        description:f("desc").value.trim() || null };
      if(!row.title || !row.start_time){ toast("Add a campaign name and start time"); return; }
      if(f("note")) row.note = f("note").value.trim() || null;
      if(state.isStaff && f("dm")){ const dm = f("dm").value.trim(); row.dm_name = dm || myName(); if(id === "new") row.dm_user = (!dm || dm === myName()) ? state.user.id : null; }
      if(id === "new"){
        if(state.isStaff) row.status = "recruiting";
        must(await sb.from("campaigns").insert(row));
        state.dmOpen = false; await loadCampaigns(); renderAll();
        toast(state.isStaff ? "Campaign added" : "Sent! The store will look it over.");
      } else {
        must(await sb.from("campaigns").update(row).eq("id", id));
        state.editCamp = null; await loadCampaigns(); renderAll(); toast("Campaign updated");
      }
    }
    else if(t.dataset.joinCamp){
      t.disabled = true;
      try{ must(await sb.from("campaign_members").insert({ campaign_id:t.dataset.joinCamp })); toast("You're in! See you at the table."); }
      catch(e){ toast(String(e.message||"").includes("full") ? "That campaign just filled up" : "Couldn't join. Try again."); }
      await loadCampaigns(); renderAll();
    }
    else if(t.dataset.leaveCamp){
      if(confirm("Leave this campaign?")){ must(await sb.from("campaign_members").delete().eq("campaign_id", t.dataset.leaveCamp).eq("user_id", state.user.id)); await loadCampaigns(); renderAll(); toast("You left the campaign"); }
    }
    else if(t.dataset.kick){
      if(confirm("Remove this player from the campaign?")){ must(await sb.from("campaign_members").delete().eq("campaign_id", t.dataset.kick).eq("user_id", t.dataset.user)); await loadCampaigns(); renderAll(); toast("Player removed"); }
    }
    else if(t.dataset.campStatus){
      if(t.dataset.to === "ended" && !confirm("End this campaign? It'll be hidden from the Game nights page.")) return;
      must(await sb.from("campaigns").update({ status:t.dataset.to }).eq("id", t.dataset.campStatus));
      await loadCampaigns(); renderAll();
      toast({ recruiting:"Campaign is open to players", full:"Closed to new players", ended:"Campaign ended" }[t.dataset.to] || "Saved");
    }
    else if(t.dataset.delCamp){
      if(confirm("Remove this campaign for good?")){ must(await sb.from("campaigns").delete().eq("id", t.dataset.delCamp)); await loadCampaigns(); renderAll(); toast("Campaign removed"); }
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
      const rows = [["sku","name","category","price","qty","barcode","preorder","release_date","game"], ...[...state.inventory].sort((a,b)=>a.name.localeCompare(b.name)).map(i => [i.sku, i.name, i.category, Number(i.price).toFixed(2), i.qty, i.barcode||"", i.preorder?"yes":"", i.release_date||"", i.game_slug||""])];
      const blob = new Blob(["\uFEFF" + rows.map(r => r.map(q).join(",")).join("\r\n")], { type:"text/csv" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `titan-inventory-${today()}.csv`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
    else if(t.dataset.print){ printRoster(t.dataset.print); }
    else if(t.dataset.editEvent){ state.editEvent = t.dataset.editEvent; renderStaffEvents(); document.getElementById("ee-title")?.focus(); }
    else if(t.dataset.cancelEvent){ state.editEvent = null; renderStaffEvents(); }
    else if(t.dataset.saveEvent){
      const id = t.dataset.saveEvent;
      const slug = $("#ee-game").value || null;
      const row = { title:$("#ee-title").value.trim(), game_slug:slug, game:gameBy(slug)?.kind === "rpg" ? "dnd" : "tcg", date:$("#ee-date").value, time:$("#ee-time").value,
        seats:Math.max(1, parseInt($("#ee-seats").value,10)||8), fee:$("#ee-fee").value.trim()||"Free", notes:$("#ee-notes").value.trim(), description:$("#ee-desc").value.trim() || null,
        format:$("#ee-format").value.trim() || null, event_type:$("#ee-type").value || null };
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
      must(await sb.from("announcements").update({ title, body, pinned:$("#en-pin").checked, game_slug:$("#en-game").value || null }).eq("id", t.dataset.saveNews));
      state.editNews = null; await loadNews(); renderAll(); toast("Announcement updated");
    }
    else if(t.id==="seasonSave"){
      const v = $("#seasonSel").value, l = state.lookDraft || state.look || "classic";
      must(await sb.from("site_settings").update({ season:v, look:l, updated_at:nowIso() }).eq("id", 1));
      state.lookDraft = null; state.storeLook = l; applySeason(v); applyLook(l); renderLookPicker();
      toast(`Saved: ${LOOKS[l].label}${v !== "none" ? ` with ${SEASONS[v].label}` : ""}`);
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
$("#shopGame").addEventListener("change", renderShop);
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
  const gf = ev.target.closest("[data-gfield]");
  if(gf && sb){
    const field = gf.dataset.gfield; let value = gf.type === "checkbox" ? gf.checked : gf.value;
    if(field === "sort") value = parseInt(value, 10) || 0;
    if(field === "name"){ value = value.trim(); if(!value){ toast("Name can't be empty"); renderGamesTable(); return; } }
    if(field === "blurb") value = value.trim() || null;
    try{ must(await sb.from("games").update({ [field]:value }).eq("slug", gf.dataset.gslug)); toast("Saved"); }
    catch(e){ handleError(e); }
    await loadGames(); renderAll(); if(field === "featured" || field === "sort") renderGamesTable(); return;
  }
  if(ev.target.id === "neRepeat"){ $("#neWeeksWrap").hidden = !ev.target.checked; return; }
  const att = ev.target.closest("[data-attend]");
  if(att && sb){
    try{ must(await sb.from("signups").update({ attended:att.checked }).eq("id", att.dataset.attend)); }
    catch(e){ handleError(e); att.checked = !att.checked; }
    await loadRoster(); renderStaffEvents(); return;
  }
  const upl = ev.target.closest("[data-upload]");
  if(upl && sb && upl.files && upl.files[0]){
    const sku = upl.dataset.upload; toast("Uploading photo...");
    try{
      const blob = await shrinkImage(upl.files[0]);
      const path = `${sku.replace(/[^A-Za-z0-9_.-]/g,"-")}-${Date.now()}.jpg`;
      const up = await sb.storage.from("product-photos").upload(path, blob, { contentType:"image/jpeg" });
      if(up.error) throw up.error;
      const { data } = sb.storage.from("product-photos").getPublicUrl(path);
      await setPhoto(sku, data.publicUrl); toast("Photo saved");
    }catch(e){ handleError(e); }
    return;
  }
  const fld = ev.target.closest("[data-field]");
  if(fld && sb){
    const field = fld.dataset.field; let value = fld.type === "checkbox" ? fld.checked : fld.value;
    if(field === "barcode"){ value = value.replace(/[^0-9Xx]/g,"") || null; fld.value = value || ""; }
    if(field === "release_date" || field === "game_slug"){ value = value || null; }
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
  must(await sb.from("products").upsert({ sku, name, category:$("#niCat").value, price:parseFloat($("#niPrice").value)||0, qty:Math.max(0, parseInt($("#niQty").value,10)||0),
    game_slug:$("#niGame").value || null, barcode:$("#niBarcode").value.replace(/[^0-9Xx]/g,"") || null, preorder:$("#niPreorder").checked, release_date:$("#niRelease").value || null, updated_at:nowIso() }));
  const cands = state.addCands && state.addCands.barcode === $("#niBarcode").value.replace(/[^0-9Xx]/g,"") ? state.addCands : null;
  ["#niSku","#niName","#niPrice","#niQty","#niBarcode","#niRelease"].forEach(s=>$(s).value=""); $("#niPreorder").checked = false;
  state.addCands = null;
  await loadProducts();
  if(cands){ state.expandItem = sku; state.photoCands = { sku, images:cands.images, title:cands.title }; }
  renderAll(); toast(cands ? "Item added. Pick a photo below." : "Item added");
  if(cands) setTimeout(() => document.querySelector("tr.item-more")?.scrollIntoView({ behavior:"smooth", block:"center" }), 50);
}
async function addEvent(){
  const title=$("#neTitle").value.trim(), date=$("#neDate").value, time=$("#neTime").value;
  if(!title || !date || !time){ toast("Add a title, date and time"); return; }
  const slug = $("#neGame").value || null;
  const row = { title, game_slug:slug, game:gameBy(slug)?.kind === "rpg" ? "dnd" : "tcg", format:$("#neFormat").value.trim() || null, event_type:$("#neType").value || null, date, time, seats:Math.max(1, parseInt($("#neSeats").value,10)||8), fee:$("#neFee").value.trim()||"Free", notes:$("#neNotes").value.trim(), description:$("#neDesc").value.trim() || null };
  const weeks = $("#neRepeat").checked ? Math.min(12, Math.max(2, parseInt($("#neWeeks").value,10)||4)) : 1;
  const rows = Array.from({ length:weeks }, (_, w) => {
    const [y,m,d] = date.split("-").map(Number), dt = new Date(y, m-1, d + 7*w);
    return { ...row, date:`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}` };
  });
  must(await sb.from("events").insert(rows));
  ["#neTitle","#neDate","#neTime","#neFee","#neNotes","#neDesc","#neFormat","#neType"].forEach(s=>$(s).value=""); $("#neSeats").value = 8;
  $("#neRepeat").checked = false; $("#neWeeksWrap").hidden = true;
  await loadEvents(); renderAll();
  toast(weeks > 1 ? `Added ${weeks} weekly game nights. They're in the list below.` : "Game night added");
}
async function addNews(){
  const title=$("#naTitle").value.trim(), body=$("#naBody").value.trim();
  if(!title || !body){ toast("Add a title and a message"); return; }
  must(await sb.from("announcements").insert({ title, body, pinned:$("#naPin").checked, game_slug:$("#naGame").value || null }));
  $("#naTitle").value=""; $("#naBody").value=""; $("#naPin").checked=false; $("#naGame").value="";
  await loadNews(); renderAll(); toast("Announcement posted");
}

async function addGame(){
  const name = $("#ngName").value.trim(); if(!name){ toast("Add a name for the game"); return; }
  let base = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,26) || "game";
  if(base.length < 2) base = base + "-game";
  let slug = base, n = 2; while(gameBy(slug)) slug = `${base}-${n++}`;
  const sort = Math.max(0, ...state.games.map(g => g.sort || 0)) + 10;
  try{ must(await sb.from("games").insert({ slug, name, kind:$("#ngKind").value, color:$("#ngColor").value, sort })); }
  catch(e){ handleError(e); return; }
  $("#ngName").value = ""; await loadGames(); renderGamesTable(); renderAll(); toast(`${name} added`);
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
    // Optional columns: blank cells keep whatever the item already has
    const old = state.inventory.find(x => x.sku === row.sku) || {};
    if(ix("barcode") >= 0){ const b = String(r[ix("barcode")]||"").replace(/[^0-9Xx]/g,""); row.barcode = b || old.barcode || null; }
    if(ix("preorder") >= 0){ const v = String(r[ix("preorder")]||"").trim().toLowerCase(); row.preorder = v ? ["yes","y","true","1","x"].includes(v) : !!old.preorder; }
    if(ix("game") >= 0){
      const v = String(r[ix("game")]||"").trim().toLowerCase();
      const match = v && state.games.find(g => g.slug === v || g.name.toLowerCase() === v || shortName(g.name).toLowerCase() === v);
      row.game_slug = match ? match.slug : (old.game_slug || null);
    }
    if(ix("release_date") >= 0){ const v = String(r[ix("release_date")]||"").trim(); row.release_date = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : (old.release_date || null); }
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

/* ---------- barcode scanning with the phone camera ---------- */
// The scanner library only loads the first time someone taps Scan.
function loadScanLib(){
  if(window.Html5Qrcode) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const sc = document.createElement("script");
    sc.src = "https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js";
    sc.onload = resolve; sc.onerror = () => reject(new Error("Couldn't load the scanner. Check your internet connection."));
    document.head.appendChild(sc);
  });
}
async function scanBarcode(title){
  if(!window.isSecureContext){ toast("Camera scanning needs the live site (https). Type the barcode for now."); return null; }
  try{ await loadScanLib(); }catch(e){ toast(e.message); return null; }
  $("#scanTitle").textContent = title || "Scan a barcode";
  $("#scanModal").hidden = false;
  const F = window.Html5QrcodeSupportedFormats;
  const scanner = new Html5Qrcode("scanReader", { verbose:false,
    formatsToSupport:[F.EAN_13, F.UPC_A, F.UPC_E, F.EAN_8, F.CODE_128, F.CODE_39],
    experimentalFeatures:{ useBarCodeDetectorIfSupported:true } });
  return new Promise(resolve => {
    let finished = false;
    const done = async code => {
      if(finished) return; finished = true;
      try{ await scanner.stop(); }catch(e){} try{ scanner.clear(); }catch(e){}
      $("#scanModal").hidden = true; resolve(code);
    };
    $("#scanCancel").onclick = () => done(null);
    scanner.start({ facingMode:"environment" },
      { fps:12, qrbox:(w, h) => ({ width:Math.round(Math.min(w*0.9, 380)), height:Math.round(Math.min(h*0.45, 170)) }) },
      text => { const code = String(text).replace(/[^0-9Xx]/g,""); if(code.length >= 6){ if(navigator.vibrate) navigator.vibrate(60); done(code); } },
      () => {}
    ).catch(() => { toast("Couldn't open the camera. Allow camera access for this site and try again."); done(null); });
  });
}
function openFold(key){
  const panel = document.querySelector(`.panel[data-fold="${key}"]`);
  if(panel && !panel.classList.contains("open")) panel.querySelector(".fold-btn")?.click();
  return panel;
}
function showItem(it){
  state.expandItem = it.sku; state.photoCands = null;
  $("#invSearch").value = it.barcode || it.sku; renderInventoryTable();
  setTimeout(() => document.querySelector("tr.item-more")?.scrollIntoView({ behavior:"smooth", block:"center" }), 50);
}
// Fill the Add one item form from a scanned barcode and look up the product.
async function prepareNewItem(code){
  const panel = openFold("additem");
  $("#niBarcode").value = code;
  if(!$("#niSku").value.trim()) $("#niSku").value = code;
  panel?.scrollIntoView({ behavior:"smooth", block:"start" });
  state.addCands = null;
  try{
    const { data, error } = await sb.functions.invoke("photo-lookup", { body:{ action:"lookup", barcode:code } });
    if(!error && data){
      if(data.title && !$("#niName").value.trim()) $("#niName").value = data.title;
      if(data.images && data.images.length) state.addCands = { barcode:code, images:data.images, title:data.title || "" };
      toast(data.title ? `Found: ${data.title}. Add the price and quantity.` : "Scanned. Fill in the name, price, and quantity.");
      return;
    }
  }catch(e){}
  toast("Scanned. Fill in the name, price, and quantity.");
}

/* ---------- fold-up staff forms ---------- */
// Big forms start closed. Click the title to open. Each one remembers how you left it.
document.querySelectorAll(".panel[data-fold]").forEach(panel => {
  const h = panel.querySelector("h3"); if(!h) return;
  const key = "titan-fold-" + panel.dataset.fold;
  const btn = document.createElement("button");
  btn.type = "button"; btn.className = "fold-btn";
  btn.innerHTML = `<span>${h.innerHTML}</span><span class="fold-arrow" aria-hidden="true"></span>`;
  h.innerHTML = ""; h.appendChild(btn); h.classList.add("fold-head");
  const set = open => {
    panel.classList.toggle("open", open); btn.setAttribute("aria-expanded", String(open));
    try{ localStorage.setItem(key, open ? "1" : "0"); }catch(e){}
  };
  let open = false; try{ open = localStorage.getItem(key) === "1"; }catch(e){}
  set(open);
  btn.addEventListener("click", () => set(!panel.classList.contains("open")));
});

/* =====================================================================
   PLAYERS AND STAFF UPDATE: icons, appearance, notifications, messages,
   reports, results, Today page, players list, grouped inventory
   ===================================================================== */

/* ---------- profile icons ---------- */
// Original icons drawn for the site (24x24, white lines on a colored circle).
const ICONS = {
  d20:      { label:"d20",        path:'<path d="M12 2.5 20.5 7.3v9.4L12 21.5 3.5 16.7V7.3z"/><path d="M12 7.5 16.5 15h-9z"/><path d="M12 2.5v5M20.5 7.3 16.5 15M3.5 7.3 7.5 15M12 21.5 7.5 15M12 21.5l4.5-6.5"/>' },
  sword:    { label:"Sword",      path:'<path d="M14.5 3.5H20.5V9.5L10 20"/><path d="M14 10 4 20"/><path d="M6.5 14.5l3 3"/><path d="M3.5 17.5l3 3"/>' },
  shield:   { label:"Shield",     path:'<path d="M12 3l7.5 2.8v5.7c0 4.6-3.2 7.9-7.5 9.5-4.3-1.6-7.5-4.9-7.5-9.5V5.8z"/><path d="M12 7v10M8 11h8"/>' },
  crown:    { label:"Crown",      path:'<path d="M4 18h16l1.2-9.5-5.2 3.8L12 5l-4 7.3-5.2-3.8z"/><path d="M5 21h14"/>' },
  potion:   { label:"Potion",     path:'<path d="M9.5 3h5M10.5 3v5.2L6 15.6A3.3 3.3 0 0 0 8.9 21h6.2a3.3 3.3 0 0 0 2.9-5.4L13.5 8.2V3"/><path d="M7.4 14h9.2"/>' },
  wizard:   { label:"Wizard hat", path:'<path d="M3 20.5h18"/><path d="M5.5 20.5 12 3l3 6.5-1.5 1 4.5 10"/><path d="M8 15.5h8.5"/>' },
  skull:    { label:"Skull",      path:'<path d="M12 3a7.5 7.5 0 0 0-7.5 7.5c0 2.8 1.6 4.6 3.5 5.4V20h8v-4.1c1.9-.8 3.5-2.6 3.5-5.4A7.5 7.5 0 0 0 12 3z"/><circle cx="9" cy="11" r="1.6"/><circle cx="15" cy="11" r="1.6"/><path d="M10.5 20v-2M13.5 20v-2"/>' },
  mushroom: { label:"Mushroom",   path:'<path d="M3.5 12.5a8.5 7.5 0 0 1 17 0z"/><path d="M9 12.5V18a3 3 0 0 0 6 0v-5.5"/><circle cx="9" cy="8.5" r="1"/><circle cx="14.5" cy="7.5" r="1"/>' },
  card:     { label:"Card",       path:'<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M12 8.5l1.2 2.4 2.6.4-1.9 1.8.5 2.6L12 14.5l-2.4 1.2.5-2.6-1.9-1.8 2.6-.4z"/>' },
  meeple:   { label:"Meeple",     path:'<path d="M12 3a2.8 2.8 0 0 1 2.8 2.8c0 .9-.4 1.6-.4 2.1 2.4.2 6.1 1.2 6.1 3 0 1-1.9 1.4-3 1.4l2 7.2h-5l-2.5-4-2.5 4h-5l2-7.2c-1.1 0-3-.4-3-1.4 0-1.8 3.7-2.8 6.1-3 0-.5-.4-1.2-.4-2.1A2.8 2.8 0 0 1 12 3z"/>' },
  mech:     { label:"Mech",       path:'<rect x="5" y="7" width="14" height="11" rx="2"/><path d="M12 7V3.5M9.5 3.5h5"/><circle cx="9.3" cy="12" r="1.4"/><circle cx="14.7" cy="12" r="1.4"/><path d="M9 15.5h6M3 11v3M21 11v3"/>' },
  flame:    { label:"Dragonfire", path:'<path d="M12 2.5c.8 3.6 6 5.6 6 11a6 6 0 0 1-12 0c0-2.7 1.5-4 1.9-6.5 1.8 1 3 2.9 3.1 4.8 1-1.8 1.4-5.1 1-9.3z"/>' },
  moon:     { label:"Moon",       path:'<path d="M19 15.5A8 8 0 0 1 8.5 5a8 8 0 1 0 10.5 10.5z"/><path d="M17 3.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z"/>' },
  bolt:     { label:"Lightning",  path:'<path d="M13.5 2.5 5 13.5h6l-1 8 8.5-11h-6z"/>' },
  axe:      { label:"Axe",        path:'<path d="M6 21 17 6"/><path d="M14.5 3.5c3 0 6 3 6 6l-3.5.5-3-3z"/>' },
  gem:      { label:"Gem",        path:'<path d="M6.5 3.5h11l3.5 5.5L12 20.5 3 9z"/><path d="M3 9h18M9.5 3.5 8 9l4 11.5L16 9l-1.5-5.5"/>' }
};
const ICON_COLORS = ["#B32630","#C26A2E","#C9A13A","#3E8E5A","#2E8C7E","#3D7EC9","#5B4FC9","#8E3FB5","#B5487E","#5A6476"];
function hashStr(s){ let h = 0; for(const c of String(s||"")) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }
state.pp = {};   // public profiles: user id -> { display_name, avatar, avatar_color, staff }
function profileFor(uid){
  if(uid && state.user && uid === state.user.id && state.profile) return { ...state.profile, staff:state.isStaff };
  return uid ? state.pp[uid] : null;
}
function avatarHtml(uid, size){
  const p = profileFor(uid) || {};
  const key = ICONS[p.avatar] ? p.avatar : Object.keys(ICONS)[hashStr(uid || "guest") % Object.keys(ICONS).length];
  const color = p.avatar_color || ICON_COLORS[hashStr((uid || "guest") + "c") % ICON_COLORS.length];
  return `<span class="av" style="--av:${color};--avs:${size || 30}px" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[key].path}</svg></span>`;
}
const staffBadge = uid => profileFor(uid)?.staff ? `<span class="staff-badge">Staff</span>` : "";
async function loadPP(uids){
  if(!sb) return false;
  const missing = [...new Set(uids.filter(Boolean))].filter(u => !state.pp[u]);
  if(!missing.length) return false;
  const { data, error } = await sb.rpc("public_profiles", { uids:missing });
  if(error){ console.error(error); return false; }
  (data || []).forEach(r => { state.pp[r.user_id] = r; });
  missing.forEach(u => { if(!state.pp[u]) state.pp[u] = { display_name:null, staff:false }; });
  return true;
}

/* ---------- account: icon, appearance, games, notifications ---------- */
async function saveProfile(fields, msg){
  state.profile = must(await sb.from("profiles").update(fields).eq("user_id", state.user.id).select().single());
  state.acctFilled = null; applyPersonal(); renderAll(); if(msg) toast(msg);
}
function renderAccountExtras(){
  if(!state.user || !state.profile) return;
  const p = state.profile;
  $("#meAvatar").innerHTML = avatarHtml(state.user.id, 56);
  $("#meNameShow").innerHTML = esc(myName()) + staffBadge(state.user.id);
  const curIcon = ICONS[p.avatar] ? p.avatar : null, curColor = p.avatar_color;
  $("#iconPicker").innerHTML = Object.entries(ICONS).map(([k,v]) => `<button type="button" class="icon-opt" role="radio" aria-checked="${k===curIcon}" aria-label="${esc(v.label)}" title="${esc(v.label)}" data-icon="${k}"><span class="av" style="--av:${curColor || "#5A6476"};--avs:40px"><svg viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${v.path}</svg></span></button>`).join("");
  $("#colorPicker").innerHTML = ICON_COLORS.map(c => `<button type="button" class="color-opt" role="radio" aria-checked="${c===curColor}" aria-label="Color ${c}" data-avcolor="${c}" style="background:${c}"></button>`).join("");
  // Only refill the form fields when the profile itself changes, so typing isn't wiped by live updates.
  if(state.acctFilled !== p){
    state.acctFilled = p;
    $("#apLook").innerHTML = `<option value="">Use the store's look</option>` + Object.entries(LOOKS).map(([k,v]) => `<option value="${k}">${esc(v.label)}</option>`).join("");
    $("#apLook").value = p.look || ""; $("#apMode").value = p.mode || ""; $("#apFx").checked = p.fx !== false;
    state.followDraft = new Set(p.follows || []);
    $("#nfReplies").checked = p.notify_replies !== false; $("#nfEvents").checked = p.notify_events !== false;
    $("#nfHolds").checked = p.notify_holds !== false; $("#nfMessages").checked = p.notify_messages !== false;
  }
  $("#followPicker").innerHTML = activeGames().map(g => `<button type="button" class="chip game-chip" data-follow="${esc(g.slug)}" aria-pressed="${state.followDraft.has(g.slug)}" style="--gc:${g.color};--gi:${inkFor(g.color)}">${esc(shortName(g.name))}</button>`).join("");
  renderMyThreads();
}
// Applies a logged-in player's own look, light/dark, and holiday effects. Logged out = the store's settings.
function applyPersonal(){
  const p = state.user ? state.profile : null;
  applyLook((p && p.look) || state.storeLook || "classic");
  if(p && p.mode) applyMode(p.mode);
  document.documentElement.setAttribute("data-fx", p && p.fx === false ? "off" : "on");
}

/* ---------- notifications ---------- */
state.notes = [];
async function loadNotes(){
  if(!state.user){ state.notes = []; return; }
  state.notes = must(await sb.from("notifications").select("*").eq("user_id", state.user.id).order("created_at", { ascending:false }).limit(40));
}
function renderBell(){
  $("#bellWrap").hidden = !state.user;
  if(!state.user) return;
  const unread = state.notes.filter(n => !n.read).length;
  $("#bellCount").hidden = !unread; $("#bellCount").textContent = unread > 9 ? "9+" : unread;
  $("#bellBtn").setAttribute("aria-label", unread ? `Notifications, ${unread} new` : "Notifications");
  $("#bellList").innerHTML = state.notes.length ? state.notes.map(n => `
    <button type="button" class="note-item ${n.read ? "" : "unread"}" data-note="${esc(n.id)}">
      <strong>${esc(n.title)}</strong>${n.body ? `<span>${esc(n.body)}</span>` : ""}<span class="note-time">${esc(timeAgo(n.created_at))}</span>
    </button>`).join("") : `<p class="note" style="padding:12px 14px;margin:0">Nothing yet. Replies, ready holds, and new nights for your games show up here.</p>`;
}
function closeBell(){ $("#bellPanel").hidden = true; $("#bellBtn").setAttribute("aria-expanded","false"); }
document.addEventListener("click", ev => { if(!ev.target.closest("#bellWrap")) closeBell(); });

/* ---------- contact us and messages ---------- */
state.threads = []; state.threadMsgs = {}; state.openThread = null; state.msgFilter = "open";
async function loadThreads(){
  if(!state.user){ state.threads = []; return; }
  let q = sb.from("threads").select("*").order("updated_at", { ascending:false }).limit(200);
  if(!state.isStaff) q = q.eq("user_id", state.user.id);
  state.threads = must(await q);
}
async function loadThreadMsgs(id){
  state.threadMsgs[id] = must(await sb.from("thread_messages").select("*").eq("thread_id", id).order("created_at"));
}
function threadBody(t, asStaff){
  const msgs = state.threadMsgs[t.id];
  if(!msgs) return `<p class="note">Loading...</p>`;
  return `<div class="msgs">${msgs.map(m => `<div class="msg ${m.from_staff ? "from-staff" : "from-customer"}">
      <div class="byline">${esc(m.author_name || (m.from_staff ? "Staff" : t.name))}${m.from_staff ? '<span class="staff-badge">Staff</span>' : ""}, ${esc(timeAgo(m.created_at))}</div>
      <div class="body">${esc(m.body)}</div></div>`).join("")}</div>
    <div class="reply-form"><textarea id="tr-${esc(t.id)}" rows="2" maxlength="3000" placeholder="${asStaff ? "Write a reply" : "Add to this conversation"}" aria-label="Write a reply"></textarea>
      <button class="btn small primary" data-treply="${esc(t.id)}">Send</button></div>
    ${asStaff ? `<div class="bactions">
      ${t.contact && !t.user_id ? `<p class="note" style="margin:0;flex-basis:100%">This person doesn't have an account, so they won't see replies here. Reach them at ${esc(t.contact)}.</p>` : ""}
      <button class="btn small" data-tstatus="${esc(t.id)}" data-to="${t.status === "open" ? "closed" : "open"}">${t.status === "open" ? "Mark as done" : "Reopen"}</button>
      ${state.isOwner ? `<button class="btn small danger" data-tdel="${esc(t.id)}">Delete</button>` : ""}</div>` : ""}`;
}
function renderMsgs(){
  if(!state.isStaff) return;
  const unread = state.threads.filter(t => t.staff_unread && t.status === "open").length;
  $("#msgChip").textContent = unread ? `Messages (${unread})` : "Messages";
  document.querySelectorAll("[data-msgfilter]").forEach(b => b.setAttribute("aria-pressed", b.dataset.msgfilter === state.msgFilter));
  $("#alertNote").textContent = state.alertEmail ? `Email alerts will go to ${state.alertEmail} once the email service is set up.` : "Tip: add an email for message alerts in Site settings.";
  const list = state.threads.filter(t => t.status === state.msgFilter);
  $("#threadList").innerHTML = list.length ? list.map(t => `
    <div class="thread ${t.staff_unread ? "unread" : ""} ${state.openThread === t.id ? "open" : ""}">
      <button type="button" class="thread-head" data-topen="${esc(t.id)}" aria-expanded="${state.openThread === t.id}">
        ${t.staff_unread ? '<span class="dot-new" aria-label="New"></span>' : ""}
        <span class="thread-main"><strong>${esc(t.subject)}</strong><span class="note">${esc(t.name)}${t.contact ? `, ${esc(t.contact)}` : ""}${t.user_id ? "" : " (guest)"}</span></span>
        <span class="note thread-meta">${esc(timeAgo(t.updated_at))}${t.handled_by_name ? `<br>Handled by ${esc(t.handled_by_name)}` : ""}</span>
      </button>
      ${state.openThread === t.id ? `<div class="thread-body">${threadBody(t, true)}</div>` : ""}
    </div>`).join("") : `<p class="note">${state.msgFilter === "open" ? "No open messages." : "No finished conversations yet."}</p>`;
}
function renderMyThreads(){
  if(!state.user) return;
  const mine = state.threads.filter(t => t.user_id === state.user.id);
  $("#myThreads").innerHTML = (mine.length ? mine.map(t => `
    <div class="thread ${t.customer_unread ? "unread" : ""} ${state.openThread === t.id ? "open" : ""}">
      <button type="button" class="thread-head" data-topen="${esc(t.id)}" aria-expanded="${state.openThread === t.id}">
        ${t.customer_unread ? '<span class="dot-new" aria-label="New reply"></span>' : ""}
        <span class="thread-main"><strong>${esc(t.subject)}</strong><span class="note">${t.customer_unread ? "New reply from the store" : t.status === "closed" ? "Done" : "Waiting on the store"}</span></span>
        <span class="note thread-meta">${esc(timeAgo(t.updated_at))}</span>
      </button>
      ${state.openThread === t.id ? `<div class="thread-body">${threadBody(t, false)}</div>` : ""}
    </div>`).join("") : `<p class="note">No messages yet.</p>`) + `<p style="margin:10px 0 0"><a class="btn small" href="#contact">Message the store</a></p>`;
}
function renderContact(){
  $("#ctGuest").hidden = !!state.user;
  $("#ctMember").hidden = !state.user;
  if(state.user) $("#ctMember").innerHTML = `Sending as <strong>${esc(myName())}</strong>. Replies show up in <a href="#account">My account</a>.`;
  const st = state.store;
  $("#ctStore").innerHTML = `${esc(st.address)}<br>${st.phone ? `<a href="tel:${esc(st.phone.replace(/[^0-9+]/g,""))}">${esc(st.phone)}</a>` : ""}`;
}

/* ---------- reports ---------- */
state.reports = [];
async function loadReports(){
  if(!state.isStaff){ state.reports = []; return; }
  state.reports = must(await sb.from("reports").select("*").eq("status","open").order("created_at", { ascending:false }));
}
const reportBtn = (kind, id, authorId) => (state.user && !state.isStaff && authorId !== state.user.id && !state.amBlocked)
  ? `<button class="btn small report-btn" data-report-${kind}="${esc(id)}">Report</button>` : "";
function renderReports(){
  if(!state.isStaff) return;
  $("#repChip").textContent = state.reports.length ? `Reports (${state.reports.length})` : "Reports";
  $("#reportList").innerHTML = state.reports.length ? state.reports.map(r => {
    const reply = r.reply_id ? state.replies.find(x => x.id === r.reply_id) : null;
    const post = r.post_id ? state.posts.find(x => x.id === r.post_id) : reply ? state.posts.find(x => x.id === reply.post_id) : null;
    const target = reply || post;
    const page = post && isDisc(post) ? "#discuss" : "#board";
    return `<div class="res-row">
      <div class="res-main">
        <span class="pill kind">${reply ? "Reply" : "Post"}</span>
        <div class="res-item">${target ? `<strong>${esc(reply ? reply.body.slice(0,120) : post.title)}</strong>` : "<em>Already removed</em>"}</div>
        <div class="note">${target ? `By ${esc(target.author_name)}. ` : ""}Reported by ${esc(r.reporter_name || "a player")} ${esc(timeAgo(r.created_at))}${r.reason ? `: "${esc(r.reason)}"` : ""}</div>
      </div>
      <div class="bactions">
        ${target ? `<a class="btn small" href="${page}">View</a><button class="btn small danger" data-rep-remove="${esc(r.id)}">Remove it</button>${blockBtn(target.user_id, target.author_name)}` : ""}
        <button class="btn small" data-rep-dismiss="${esc(r.id)}">${target ? "It's fine" : "Clear"}</button>
      </div></div>`;
  }).join("") : `<p class="note">No reports right now.</p>`;
}

/* ---------- results and winners ---------- */
state.results = []; state.pastEvents = [];
async function loadResults(){
  state.results = must(await sb.from("results").select("*").order("event_date", { ascending:false }).order("created_at", { ascending:false }).limit(60));
}
async function loadPastEvents(){
  if(!state.isStaff){ state.pastEvents = []; return; }
  const from = new Date(); from.setDate(from.getDate() - 45);
  const iso = `${from.getFullYear()}-${String(from.getMonth()+1).padStart(2,"0")}-${String(from.getDate()).padStart(2,"0")}`;
  state.pastEvents = must(await sb.from("events").select("id,title,date,game_slug").gte("date", iso).lte("date", today()).order("date", { ascending:false }));
}
function resultCard(r){
  const places = String(r.placings || "").split("\n").map(x => x.trim()).filter(Boolean);
  return `<article class="result" style="--gc:${gameBy(r.game_slug)?.color || "var(--gold)"}">
    ${r.photo_url ? `<a class="result-photo" href="${esc(r.photo_url)}" target="_blank" rel="noopener"><img src="${esc(r.photo_url)}" alt="Winners of ${esc(r.title)}" loading="lazy"></a>` : ""}
    <div class="result-body">
      <div class="ev-tags">${gameTag(r.game_slug)}<span class="note">${esc(fmtDate(r.event_date,{weekday:"short",month:"short",day:"numeric"}))}</span></div>
      <h3>${esc(r.title)}</h3>
      ${r.winner ? `<p class="winner"><span aria-hidden="true">🏆</span> <strong>${esc(r.winner)}</strong>${r.winner_deck ? ` <span class="note">with ${esc(r.winner_deck)}</span>` : ""}</p>` : ""}
      ${places.length ? `<ul class="placings">${places.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      ${r.notes ? `<p class="note" style="margin:6px 0 0">${esc(r.notes)}</p>` : ""}
    </div></article>`;
}
function renderWinners(){
  const list = state.results.filter(r => state.evGame === "all" || r.game_slug === state.evGame).slice(0, 6);
  $("#winnersSec").hidden = !list.length;
  $("#winnersList").innerHTML = list.map(resultCard).join("");
}
function renderStaffResults(){
  if(!state.isStaff) return;
  const sel = $("#rsEvent"), cur = sel.value;
  sel.innerHTML = `<option value="">Not linked to a game night</option>` + state.pastEvents.map(e => `<option value="${esc(e.id)}">${esc(fmtDate(e.date,{month:"short",day:"numeric"}))}: ${esc(e.title)}</option>`).join("");
  if([...sel.options].some(o => o.value === cur)) sel.value = cur;
  const gs = $("#rsGame"), gcur = gs.value; gs.innerHTML = gameOptions(gcur || null, "Pick a game"); if(gcur) gs.value = gcur;
  if(!$("#rsDate").value) $("#rsDate").value = today();
  $("#staffResults").innerHTML = state.results.length ? state.results.map(r => `<div class="staff-result">${resultCard(r)}<div class="bactions"><button class="btn small danger" data-res-delete="${esc(r.id)}">Delete</button></div></div>`).join("") : `<p class="note">No results posted yet.</p>`;
}

/* ---------- staff: players list ---------- */
state.allProfiles = [];
async function loadAllProfiles(){
  if(!state.isStaff){ state.allProfiles = []; return; }
  state.allProfiles = must(await sb.from("profiles").select("user_id,display_name,avatar,avatar_color,created_at").order("display_name").limit(1000));
  state.allProfiles.forEach(p => { state.pp[p.user_id] = { ...(state.pp[p.user_id] || {}), ...p }; });
}
function renderPlayers(){
  if(!state.isStaff) return;
  if(document.activeElement && document.activeElement.matches("[data-pname]")) return;
  const q = $("#plSearch").value.trim().toLowerCase();
  const list = state.allProfiles.filter(p => !q || (p.display_name || "").toLowerCase().includes(q)).slice(0, 100);
  $("#playerList").innerHTML = list.length ? list.map(p => `<div class="player-row">${avatarHtml(p.user_id, 32)}
      <input type="text" class="inline-in" maxlength="60" value="${esc(p.display_name || "")}" data-pname="${esc(p.user_id)}" data-orig="${esc(p.display_name || "")}" aria-label="Display name">
      <button class="btn small primary" data-psave="${esc(p.user_id)}" disabled>Save</button>
      ${p.created_at ? `<span class="note">joined ${esc(timeAgo(p.created_at))}</span>` : ""}</div>`).join("")
    + (state.allProfiles.length > 100 && !q ? `<p class="note">Showing 100 of ${state.allProfiles.length}. Search to find someone.</p>` : "")
    : `<p class="note">${state.allProfiles.length ? "No players match that search." : "No player accounts yet."}</p>`;
}

/* ---------- staff Today page ---------- */
function renderToday(){
  if(!state.isStaff) return;
  const t = today();
  const nights = state.events.filter(e => e.date === t);
  const waiting = state.reservations.filter(r => r.status === "requested");
  const unread = state.threads.filter(x => x.staff_unread && x.status === "open");
  const low = state.inventory.filter(i => !i.preorder && (i.qty - (i.held || 0)) <= 2).sort((a,b) => (a.qty - (a.held||0)) - (b.qty - (b.held||0)));
  const pendCamps = state.campaigns.filter(c => c.status === "pending");
  const pendStaff = state.isOwner ? state.requests.length : 0;
  const go = (pane, label) => `<button class="btn small" data-goto="${pane}">${label}</button>`;
  const card = (title, count, body, btn) => `<section class="today-card"><div class="today-head"><h3>${title}</h3>${count !== null ? `<span class="today-count ${count ? "" : "zero"}">${count}</span>` : ""}</div>${body}${btn ? `<div class="bactions">${btn}</div>` : ""}</section>`;
  $("#todayBoard").innerHTML = `<p class="today-date">${esc(new Date().toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"}))}. ${esc(openStatus(state.store.hours).text)}.</p>` +
    card("Tonight's game nights", nights.length, nights.length ? `<ul class="today-list">${nights.map(e => `<li>${gameTag(e.game_slug, e.game)}<strong>${esc(e.title)}</strong> <span class="note">${esc(fmtTime(e.time))}, ${taken(e.id)} of ${e.seats} seats</span></li>`).join("")}</ul>` : `<p class="note">No game nights today.</p>`, go("events", "Rosters and sign-in sheets")) +
    card("Holds to set aside", waiting.length, waiting.length ? `<ul class="today-list">${waiting.slice(0,5).map(r => `<li><strong>${esc(r.product_name)}</strong>${r.qty > 1 ? ` × ${r.qty}` : ""} <span class="note">for ${esc(r.name)}</span> <button class="btn small primary" data-res-status="${esc(r.id)}" data-to="ready">Ready</button></li>`).join("")}</ul>${waiting.length > 5 ? `<p class="note">And ${waiting.length - 5} more.</p>` : ""}` : `<p class="note">Nothing waiting.</p>`, go("res", "All holds and preorders")) +
    card("New messages", unread.length, unread.length ? `<ul class="today-list">${unread.slice(0,4).map(x => `<li><strong>${esc(x.subject)}</strong> <span class="note">from ${esc(x.name)}, ${esc(timeAgo(x.updated_at))}</span></li>`).join("")}</ul>` : `<p class="note">All caught up.</p>`, go("msgs", "Open messages")) +
    card("Low stock", low.length, low.length ? `<ul class="today-list">${low.slice(0,8).map(i => `<li><strong>${esc(i.name)}</strong> <span class="note">${Math.max(0, i.qty - (i.held||0))} available${i.held ? `, ${i.held} on hold` : ""}</span></li>`).join("")}</ul>${low.length > 8 ? `<p class="note">And ${low.length - 8} more.</p>` : ""}` : `<p class="note">Everything's stocked.</p>`, go("inventory", "Inventory")) +
    card("Needs a look", state.reports.length + pendCamps.length + pendStaff, `<ul class="today-list">
      <li><strong>${state.reports.length}</strong> reported post${state.reports.length === 1 ? "" : "s"}</li>
      <li><strong>${pendCamps.length}</strong> campaign${pendCamps.length === 1 ? "" : "s"} waiting for approval</li>
      ${state.isOwner ? `<li><strong>${pendStaff}</strong> staff request${pendStaff === 1 ? "" : "s"}</li>` : ""}</ul>`,
      [state.reports.length && go("reports","Reports"), pendCamps.length && go("camps","Campaigns"), pendStaff && go("team","Team")].filter(Boolean).join(""));
}
function gotoPane(pane){
  document.querySelectorAll(".staff-nav [data-staff]").forEach(b => b.setAttribute("aria-pressed", b.dataset.staff === pane));
  document.querySelectorAll("[data-pane]").forEach(p => p.hidden = p.dataset.pane !== pane);
  if(pane === "look") renderStoreForm();
  document.querySelector(".staff-nav")?.scrollIntoView({ behavior:"smooth", block:"start" });
}

/* ---------- grouped inventory ---------- */
state.invOpen = new Set(); state.invLowOnly = false;
const availOf = i => Math.max(0, (Number(i.qty) || 0) - (Number(i.held) || 0));
const isLowItem = i => !i.preorder && availOf(i) <= 2;
function invRow(i){
  return `<tr><td data-label="SKU">${esc(i.sku)}</td>
    <td data-label="Name"><input type="text" class="inline-in name-in" maxlength="120" value="${esc(i.name)}" data-field="name" data-sku="${esc(i.sku)}" aria-label="Name for ${esc(i.sku)}"></td>
    <td data-label="Category"><select class="inline-in" data-field="category" data-sku="${esc(i.sku)}" aria-label="Category for ${esc(i.name)}">${Object.entries(CATS).map(([k,c]) => `<option value="${k}" ${i.category===k?"selected":""}>${esc(c.label)}</option>`).join("")}</select></td>
    <td class="num" data-label="Price"><input type="number" class="inline-in price-in" min="0" step="0.01" value="${Number(i.price).toFixed(2)}" data-field="price" data-sku="${esc(i.sku)}" aria-label="Price for ${esc(i.name)}"></td>
    <td class="num" data-label="Qty"><input type="number" class="inline-in qty-in" min="0" value="${i.qty}" data-qty="${esc(i.sku)}" aria-label="Quantity for ${esc(i.name)}">${i.held ? `<span class="held-note">${i.held} on hold</span>` : ""}</td>
    <td class="act"><button class="btn small" data-more="${esc(i.sku)}" aria-expanded="${state.expandItem===i.sku}">${state.expandItem===i.sku ? "Less" : "More"}</button> ${state.isOwner?`<button class="btn small danger" data-del-item="${esc(i.sku)}">Delete</button>`:""}</td></tr>
    ${state.expandItem===i.sku ? itemMoreRow(i) : ""}`;
}
function renderInventoryTable(){
  const q = $("#invSearch").value.trim().toLowerCase();
  const filtering = !!q || state.invLowOnly;
  const list = state.inventory.filter(i => (!q || i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q) || (i.barcode||"").includes(q)) && (!state.invLowOnly || isLowItem(i)))
    .sort((a,b) => a.name.localeCompare(b.name));
  const lowAll = state.inventory.filter(isLowItem).length;
  $("#invSummary").textContent = `${state.inventory.length} item${state.inventory.length === 1 ? "" : "s"} in ${new Set(state.inventory.map(i => i.category)).size} categories. ${lowAll} low on stock.` + (filtering ? ` Showing ${list.length}.` : "");
  $("#invLow").setAttribute("aria-pressed", String(state.invLowOnly));
  const cats = [...Object.keys(CATS), ...new Set(state.inventory.map(i => i.category).filter(c => !CATS[c]))];
  const groups = cats.map(k => ({ k, label:CATS[k]?.label || k, items:list.filter(i => i.category === k) })).filter(g => g.items.length);
  const expandCat = state.expandItem ? state.inventory.find(i => i.sku === state.expandItem)?.category : null;
  const allOpen = groups.length && groups.every(g => state.invOpen.has(g.k));
  $("#invToggleAll").textContent = allOpen ? "Close all" : "Open all";
  $("#invGroups").innerHTML = groups.length ? groups.map(g => {
    const open = filtering || state.invOpen.has(g.k) || g.k === expandCat;
    const lowN = g.items.filter(isLowItem).length;
    return `<section class="inv-group ${open ? "open" : ""}">
      <button type="button" class="inv-head" data-invgroup="${esc(g.k)}" aria-expanded="${open}">
        <span class="inv-title">${esc(g.label)}</span><span class="note">${g.items.length} item${g.items.length === 1 ? "" : "s"}</span>
        ${lowN ? `<span class="pill low-pill">${lowN} low</span>` : ""}<span class="fold-arrow" aria-hidden="true"></span>
      </button>
      ${open ? `<div class="table-wrap"><table class="stack"><thead><tr><th>SKU</th><th>Name</th><th>Category</th><th class="num">Price</th><th class="num">Qty</th><th></th></tr></thead><tbody>${g.items.map(invRow).join("")}</tbody></table></div>` : ""}
    </section>`;
  }).join("") : `<p class="muted">${state.inventory.length ? "Nothing matches that." : "No items yet. Upload a CSV or add one above."}</p>`;
}

/* ---------- back to top + sticky header height ---------- */
function setHeaderH(){ document.documentElement.style.setProperty("--header-h", (document.querySelector("header.top")?.offsetHeight || 64) + "px"); }
window.addEventListener("resize", setHeaderH); setHeaderH();
window.addEventListener("scroll", () => { $("#toTop").hidden = window.scrollY < 900; }, { passive:true });
$("#toTop").addEventListener("click", () => window.scrollTo({ top:0, behavior:"smooth" }));
$("#plSearch").addEventListener("input", renderPlayers);
document.addEventListener("input", ev => {
  const pn = ev.target.closest("[data-pname]"); if(!pn) return;
  const btn = document.querySelector(`[data-psave="${CSS.escape(pn.dataset.pname)}"]`);
  if(btn) btn.disabled = pn.value.trim() === pn.dataset.orig || !pn.value.trim();
});

/* ---------- clicks for this update ---------- */
document.addEventListener("click", async ev => {
  const t = ev.target.closest("button, a"); if(!t) return;
  if(t.dataset.goto){ gotoPane(t.dataset.goto); return; }
  if(t.dataset.invgroup){ const k = t.dataset.invgroup; state.invOpen.has(k) ? state.invOpen.delete(k) : state.invOpen.add(k); renderInventoryTable(); return; }
  if(t.id === "invToggleAll"){
    const ks = [...new Set(state.inventory.map(i => i.category))];
    const allOpen = ks.every(k => state.invOpen.has(k));
    state.invOpen = allOpen ? new Set() : new Set(ks); renderInventoryTable(); return;
  }
  if(t.id === "invLow"){ state.invLowOnly = !state.invLowOnly; renderInventoryTable(); return; }
  if(t.id === "bellBtn"){ const open = $("#bellPanel").hidden; $("#bellPanel").hidden = !open; t.setAttribute("aria-expanded", String(open)); return; }
  if(t.dataset.msgfilter){ state.msgFilter = t.dataset.msgfilter; state.openThread = null; renderMsgs(); return; }
  if(t.dataset.follow){ const g = t.dataset.follow; state.followDraft.has(g) ? state.followDraft.delete(g) : state.followDraft.add(g); renderAccountExtras(); return; }
  if(!sb) return;
  try{
    if(t.dataset.note){
      const n = state.notes.find(x => x.id === t.dataset.note); closeBell();
      if(n && !n.read){ n.read = true; renderBell(); sb.from("notifications").update({ read:true }).eq("id", n.id).then(()=>{}); }
      if(n && n.link) location.hash = n.link;
    }
    else if(t.id === "bellReadAll"){
      state.notes.forEach(n => n.read = true); renderBell();
      must(await sb.from("notifications").update({ read:true }).eq("user_id", state.user.id).eq("read", false));
    }
    else if(t.dataset.icon){ await saveProfile({ avatar:t.dataset.icon, avatar_color:state.profile.avatar_color || ICON_COLORS[hashStr(state.user.id + "c") % ICON_COLORS.length] }, "Icon saved"); }
    else if(t.dataset.avcolor){ await saveProfile({ avatar_color:t.dataset.avcolor, avatar:state.profile.avatar || Object.keys(ICONS)[hashStr(state.user.id) % Object.keys(ICONS).length] }, "Color saved"); }
    else if(t.id === "apSave"){ await saveProfile({ look:$("#apLook").value || null, mode:$("#apMode").value || null, fx:$("#apFx").checked }, "Appearance saved"); }
    else if(t.id === "nfSave"){
      await saveProfile({ follows:[...state.followDraft], notify_replies:$("#nfReplies").checked, notify_events:$("#nfEvents").checked, notify_holds:$("#nfHolds").checked, notify_messages:$("#nfMessages").checked }, "Saved");
    }
    else if(t.id === "ctSend"){
      const subject = $("#ctSubject").value.trim(), body = $("#ctBody").value.trim();
      if(!subject || !body){ toast("Add a subject and a message"); return; }
      if(!state.user && (!$("#ctName").value.trim() || !$("#ctContact").value.trim())){ toast("Add your name and an email or phone so the store can reply"); return; }
      t.disabled = true;
      try{ must(await sb.rpc("start_contact", { p_subject:subject, p_body:body, p_name:$("#ctName").value, p_contact:$("#ctContact").value })); }
      finally{ t.disabled = false; }
      $("#ctSubject").value = ""; $("#ctBody").value = "";
      toast("Message sent! The store will get back to you.");
      if(state.user){ await loadThreads(); renderAll(); location.hash = "#account"; }
    }
    else if(t.dataset.topen){
      const id = t.dataset.topen;
      if(state.openThread === id){ state.openThread = null; renderMsgs(); renderMyThreads(); return; }
      state.openThread = id; renderMsgs(); renderMyThreads();
      await loadThreadMsgs(id);
      const th = state.threads.find(x => x.id === id);
      if(th && state.isStaff && th.staff_unread && th.user_id !== state.user.id){ th.staff_unread = false; sb.from("threads").update({ staff_unread:false }).eq("id", id).then(()=>{}); }
      if(th && th.user_id === state.user.id && th.customer_unread){ th.customer_unread = false; sb.rpc("mark_thread_read", { tid:id }).then(()=>{}); }
      renderMsgs(); renderMyThreads(); renderToday();
    }
    else if(t.dataset.treply){
      const id = t.dataset.treply, box = document.getElementById("tr-" + id), body = box.value.trim();
      if(!body) return;
      t.disabled = true;
      try{ must(await sb.from("thread_messages").insert({ thread_id:id, body })); } finally{ t.disabled = false; }
      await Promise.all([loadThreadMsgs(id), loadThreads()]); renderAll(); toast("Sent");
    }
    else if(t.dataset.tstatus){
      must(await sb.from("threads").update({ status:t.dataset.to, staff_unread:false }).eq("id", t.dataset.tstatus));
      state.openThread = null; await loadThreads(); renderAll(); toast(t.dataset.to === "closed" ? "Marked as done" : "Reopened");
    }
    else if(t.dataset.tdel){
      if(confirm("Delete this conversation for good?")){ must(await sb.from("threads").delete().eq("id", t.dataset.tdel)); state.openThread = null; await loadThreads(); renderAll(); }
    }
    else if(t.dataset.reportPost || t.dataset.reportReply){
      const reason = prompt("What's wrong with it? (optional)\nStaff will take a look. The person won't see who reported it.");
      if(reason === null) return;
      must(await sb.from("reports").insert(t.dataset.reportPost ? { post_id:t.dataset.reportPost, reason:reason.trim() || null } : { reply_id:t.dataset.reportReply, reason:reason.trim() || null }));
      toast("Thanks. Staff will take a look.");
    }
    else if(t.dataset.repRemove){
      const r = state.reports.find(x => x.id === t.dataset.repRemove); if(!r) return;
      if(!confirm("Remove this from the community?")) return;
      if(r.reply_id) must(await sb.from("replies").delete().eq("id", r.reply_id));
      else if(r.post_id){
        const post = state.posts.find(x => x.id === r.post_id);
        must(await sb.from("posts").delete().eq("id", r.post_id));
        const paths = (post?.images || []).map(photoPath).filter(Boolean);
        if(paths.length) sb.storage.from("post-photos").remove(paths);
      }
      await Promise.all([loadBoard(), loadReports()]); renderAll(); toast("Removed");
    }
    else if(t.dataset.repDismiss){
      must(await sb.from("reports").update({ status:"resolved" }).eq("id", t.dataset.repDismiss));
      await loadReports(); renderAll();
    }
    else if(t.id === "rsAdd"){
      const row = { title:$("#rsTitle").value.trim(), game_slug:$("#rsGame").value || null, event_date:$("#rsDate").value, event_id:$("#rsEvent").value || null,
        winner:$("#rsWinner").value.trim() || null, winner_deck:$("#rsDeck").value.trim() || null, placings:$("#rsPlacings").value.trim() || null, notes:$("#rsNotes").value.trim() || null };
      if(!row.title || !row.event_date){ toast("Add a title and a date"); return; }
      if(!row.winner && !row.placings && !state.rsFile){ toast("Add a winner, placings, or a photo"); return; }
      t.disabled = true;
      try{
        if(state.rsFile){
          toast("Uploading photo...");
          const blob = await shrinkImage(state.rsFile, 1400);
          const path = `results/${Date.now()}.jpg`;
          const up = await sb.storage.from("product-photos").upload(path, blob, { contentType:"image/jpeg" });
          if(up.error) throw up.error;
          row.photo_url = sb.storage.from("product-photos").getPublicUrl(path).data.publicUrl;
        }
        must(await sb.from("results").insert(row));
      } finally{ t.disabled = false; }
      ["#rsTitle","#rsWinner","#rsDeck","#rsPlacings","#rsNotes"].forEach(s => $(s).value = ""); $("#rsEvent").value = ""; state.rsFile = null; $("#rsPhotoName").textContent = "";
      await loadResults(); renderAll(); toast("Results posted");
    }
    else if(t.dataset.psave){
      const uid = t.dataset.psave, box = document.querySelector(`[data-pname="${CSS.escape(uid)}"]`), name = box.value.trim().slice(0,60);
      if(!name || name === box.dataset.orig) return;
      if(!confirm(`Change "${box.dataset.orig}" to "${name}"?\n\nOld posts keep the name they were made with.`)){ box.value = box.dataset.orig; t.disabled = true; return; }
      must(await sb.from("profiles").update({ display_name:name }).eq("user_id", uid));
      delete state.pp[uid]; await loadAllProfiles(); renderPlayers(); toast("Name changed");
    }
    else if(t.dataset.resDelete){
      if(confirm("Delete these results?")){ must(await sb.from("results").delete().eq("id", t.dataset.resDelete)); await loadResults(); renderAll(); }
    }
  }catch(e){ handleError(e); }
});
document.addEventListener("change", async ev => {
  if(ev.target.id === "rsPhoto"){ state.rsFile = ev.target.files[0] || null; $("#rsPhotoName").textContent = state.rsFile ? state.rsFile.name : ""; return; }
  if(ev.target.id === "rsEvent"){
    const e = state.pastEvents.find(x => x.id === ev.target.value);
    if(e){ $("#rsTitle").value = e.title; $("#rsDate").value = e.date; if(e.game_slug) $("#rsGame").value = e.game_slug; }
    return;
  }
});


/* ---------- live updates ---------- */
// Don't redraw the page while someone is typing or editing. Catch up when they're done.
function busy(){
  const a = document.activeElement;
  return (a && a !== document.body && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) || !!(state.editEvent || state.editNews || state.reserve || state.editCamp || state.editing || state.dmOpen);
}
function softRender(){ if(busy()){ state.pendingRender = true; return; } renderAll(); }
document.addEventListener("focusout", () => setTimeout(() => { if(state.pendingRender && !busy()) renderAll(); }, 400));
function startLive(){
  if(!sb || state.live) return;
  const timers = {};
  const later = (key, fn) => { clearTimeout(timers[key]); timers[key] = setTimeout(async () => { try{ await fn(); softRender(); }catch(e){ console.error(e); } }, 600); };
  const on = (table, key, fn) => ch.on("postgres_changes", { event:"*", schema:"public", table }, () => later(key, fn));
  const ch = sb.channel("titan-live");
  on("products", "products", loadProducts);
  on("events", "events", () => Promise.all([loadEvents(), loadCounts(), refreshDetail()]));
  on("signups", "signups", () => Promise.all([loadCounts(), loadRoster(), loadMine(), refreshDetail()]));
  on("announcements", "news", loadNews);
  on("posts", "board", loadBoard);
  on("replies", "board", loadBoard);
  on("post_likes", "board", loadBoard);
  on("site_settings", "settings", loadSettings);
  on("games", "games", loadGames);
  on("reservations", "res", loadReservations);
  on("campaigns", "camps", loadCampaigns);
  on("campaign_members", "camps", loadCampaigns);
  on("notifications", "notes", loadNotes);
  on("threads", "threads", async () => { await loadThreads(); if(state.openThread) await loadThreadMsgs(state.openThread); });
  on("thread_messages", "threads", async () => { await loadThreads(); if(state.openThread) await loadThreadMsgs(state.openThread); });
  on("reports", "reports", loadReports);
  on("results", "results", loadResults);
  on("profiles", "profiles", async () => { state.pp = {}; await Promise.all([loadBoard(), loadCampaigns(), loadAllProfiles()]); });
  state.live = ch.subscribe();
}

/* ---------- start up ---------- */
route(); renderAll();
if(sb){
  // Runs on page load and whenever someone logs in or out.
  sb.auth.onAuthStateChange((event) => {
    if(event === "PASSWORD_RECOVERY"){ state.recovery = true; location.hash = "#account"; }
    setTimeout(async () => { await refreshStaff(); await loadAll(); route(); startLive(); }, 0);
  });
  // Refresh when someone comes back to the tab.
  document.addEventListener("visibilitychange", () => { if(!document.hidden) loadAll(); });
} else {
  loadAll();
}
})();
