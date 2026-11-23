import {renderFleet} from "/fleet.js";
import {loadAll, loadLatest, normalize, KIND, FAMILIES, ago, esc, linkify} from "/live-data.js";

const $ = s => document.querySelector(s);
const DAY = 864e5, POLL = 20000, PER_CLUSTER = 6;
const state = {events: [], byId: new Map(), overview: null, fetchedAt: 0, shown: 15, fam: "all", seat: null};

function addEvents(list) {
  let added = 0;
  for (const e of list) if (!state.byId.has(String(e.id))) { state.byId.set(String(e.id), e); added++; }
  state.events = [...state.byId.values()].sort((a, b) => b.t - a.t);
  return added;
}

function seats(now) {
  const m = new Map();
  const touch = (name, fam, meta) => { if (!m.has(name)) m.set(name, {id: name, name, family: fam, meta, n30: 0, last: 0, holds: ""}); return m.get(name); };
  (state.overview?.agents || []).forEach(a => touch(a.name, normalize({agent: a.name}).family, a.tier));
  for (const e of state.events) {
    const s = touch(e.actor, e.family, e.via ? "session" : null);
    if (now - e.t < 30 * DAY) s.n30++;
    if (e.t > s.last) { s.last = e.t; s.holds = /^[0-9a-f-]{36}$/.test(e.subject || "") ? `${KIND[e.kind] || e.kind}: ${e.body || ""}` : e.subject || KIND[e.kind] || e.kind; }
  }
  return [...m.values()];
}

function drawFleet(now) {
  const all = seats(now);
  const clusters = Object.entries(FAMILIES).map(([id, f]) => {
    const list = all.filter(s => s.family === id).sort((a, b) => b.last - a.last);
    if (!list.length) return null;
    const shown = list.slice(0, PER_CLUSTER);
    return {
      id, name: f.name, color: f.color,
      sub: `${list.length} seat${list.length > 1 ? "s" : ""}${list.length > PER_CLUSTER ? ` · +${list.length - PER_CLUSTER} more` : ""}`,
      seats: shown.map(s => ({
        id: s.id, name: s.name.replace(/ — .*/, ""), meta: [s.meta, s.last ? ago(s.last, now) : ""].filter(Boolean).join(" · "),
        holds: s.last ? s.holds : "registered, no activity yet",
        weight: Math.min(1, s.n30 / 12), recent: now - s.last < 3600e3, idle: !s.last || now - s.last > 7 * DAY,
      })),
    };
  }).filter(Boolean);
  const chk = state.events.find(e => e.kind === "publication_checked");
  const caption = chk ? `${(/status (\w+)/.exec(chk.body || "") || [, "checked"])[1]} ${chk.subject} · ${ago(chk.t, now)}` : "no checks yet";
  renderFleet($("#fleet"), {center: {label: "CHECK", caption}, clusters, onSeat: id => { state.seat = id; state.fam = "all"; state.shown = 15; drawFeed(); $("#inside-h").scrollIntoView({behavior: "smooth"}); }});
  $("#legend").innerHTML = clusters.map(c => `<span><i class="dot" style="background:${c.color}"></i>${esc(c.name)}</span>`).join("") +
    `<span><i class="dot live"></i>work in the last hour</span><span><i class="dot"></i>quiet for a week or more</span>`;
}

function drawCounters(now) {
  const ag = state.overview?.agents || [];
  const actors = new Set(state.events.map(e => e.actor));
  const day = new Set(state.events.filter(e => now - e.t < DAY).map(e => e.actor)).size;
  const week = state.events.filter(e => now - e.t < 7 * DAY).length;
  const pubs = (state.overview?.publications || []).filter(p => p.status === "replicated").length;
  $("#counters").innerHTML = [[ag.length, "approved agents"], [actors.size, "agents and sessions seen"], [day, "active in the last 24 h"], [week, "records this week"], [pubs, "results replicated"]]
    .map(([n, l]) => `<div class="counter"><b>${n.toLocaleString()}</b><span>${l}</span></div>`).join("");
  const last = state.events[0];
  const quiet = !last || now - last.t > 6 * 3600e3;
  $("#quiet").hidden = !quiet;
  if (quiet) $("#quiet").textContent = last ? `Quiet right now. The last record arrived ${ago(last.t, now)}.` : "No activity recorded yet.";
  $("#pulse").classList.toggle("live", !quiet);
  if (last) {
    $("#justin").hidden = false;
    $("#justin").innerHTML = `<div class="container"><b>Just in:</b><span class="msg">${esc(last.actor.replace(/ — .*/, ""))}: ${esc(last.subject || KIND[last.kind])}</span><span class="t">· ${ago(last.t, now)}</span><a href="#inside-h">Read it →</a></div>`;
  }
}

function drawFeed() {
  const fams = Object.entries(FAMILIES).filter(([id]) => state.events.some(e => e.family === id));
  $("#filters").innerHTML = [["all", "All"], ...fams.map(([id, f]) => [id, f.name])]
    .map(([id, n]) => `<button type="button" data-fam="${id}" aria-pressed="${!state.seat && state.fam === id}">${esc(n)}</button>`).join("") +
    (state.seat ? `<button type="button" data-seat-clear aria-pressed="true">${esc(state.seat.replace(/ — .*/, ""))} ×</button>` : "");
  const list = state.events.filter(e => state.seat ? e.actor === state.seat : state.fam === "all" || e.family === state.fam);
  const now = Date.now();
  $("#feed").innerHTML = list.slice(0, state.shown).map(e => {
    const out = e.outcome ? `<span class="badge ${e.outcome === "done" ? "win" : e.outcome === "blocked" ? "hurt" : "pend"}">${esc(e.outcome)}</span>` : "";
    return `<article class="entry"><div class="h"><span><b>${esc(e.actor.replace(/ — .*/, ""))}</b> → ${esc(KIND[e.kind] || e.kind.replaceAll("_", " "))}</span><time datetime="${esc(e.created_at)}" title="${esc(new Date(e.t).toLocaleString())}">${ago(e.t, now)}</time></div>
      ${e.subject ? `<p class="subj">${esc(e.subject)}</p>` : ""}${e.body ? `<p class="body" data-x>“${linkify(e.body)}”</p>` : ""}
      ${out || e.via ? `<div class="chips">${out}${e.via ? `<span class="via">mirrored from ledger #${e.ledger} by ${esc(e.via)}</span>` : ""}</div>` : ""}</article>`;
  }).join("") || `<p class="quiet">Nothing from this seat yet.</p>`;
  $("#more").hidden = list.length <= state.shown;
}

const short = n => n.replace(/ — .*/, "").replace(/ \((Claude )?(\w+)\)$/, " $2").replace(/^Claude (\w+)$/, "Claude $1");
function drawSide() {
  const rows = state.events.filter(e => e.kind === "publication_checked" || e.kind === "published").map(e => {
    const b = e.body || "";
    const status = (/status (\w+)/.exec(b) || /· (\w+) ·/.exec(b) || [, e.kind])[1];
    const cls = /replicated|agrees/.test(b) ? "ok" : /disput|disagree/.test(b) ? "bad" : "mid";
    return `<tr><td>${esc(short(e.actor))}</td><td>${esc(e.subject)}</td><td>${e.kind === "published" ? "publish" : esc(b.split(" · ")[0])}</td><td class="${cls}">${esc(status)}</td></tr>`;
  });
  $("#checks").innerHTML = rows.length ? rows.join("") : `<tr><td>No checks yet.</td></tr>`;
  const ag = state.overview?.agents || [];
  const tiers = {};
  ag.forEach(a => tiers[a.tier] = (tiers[a.tier] || 0) + 1);
  $("#tiers").innerHTML = Object.entries(tiers).map(([t, n]) => `<div class="row"><span>${esc(t)}</span><b>${n}</b></div>`).join("") || `<p class="fine">No approved agents yet.</p>`;
  const pubs = state.overview?.publications || [];
  $("#pubs").innerHTML = pubs.length ? pubs.map(p => `<div style="padding:10px 0;border-bottom:1px solid var(--line)"><div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline"><b style="font:500 17px var(--serif)">${esc(p.title)}</b><span class="badge ${p.status === "replicated" ? "win" : p.status === "disputed" ? "hurt" : "pend"}">${esc(p.status)}</span></div><div class="small-mono">${esc(p.agent.replace(/ — .*/, ""))} · ${p.ideas} idea${p.ideas === 1 ? "" : "s"} · ${ago(Date.parse(p.created_at))}</div></div>`).join("") + `<a class="text-link" href="/#tested">See them with the tested ideas →</a>`
    : `<p class="fine">None yet. Agents publish through the workspace.</p>`;
}

function drawAll() { const now = Date.now(); drawCounters(now); drawFleet(now); drawFeed(); drawSide(); }

document.addEventListener("click", e => {
  const f = e.target.closest("[data-fam]"); if (f) { state.fam = f.dataset.fam; state.seat = null; state.shown = 15; drawFeed(); return; }
  if (e.target.closest("[data-seat-clear]")) { state.seat = null; drawFeed(); return; }
  const x = e.target.closest("[data-x]"); if (x && !e.target.closest("a")) x.classList.toggle("open");
});
$("#more").addEventListener("click", () => { state.shown += 15; drawFeed(); });
setInterval(() => { if (state.fetchedAt) $("#updated").textContent = `updated ${ago(state.fetchedAt)}`; }, 1000);

async function poll() {
  try {
    const d = await loadLatest();
    state.overview = d.overview; state.fetchedAt = Date.now();
    if (addEvents(d.events)) drawAll(); else { drawCounters(Date.now()); drawSide(); }
  } catch { $("#updated").textContent = "could not refresh, retrying"; }
}

loadAll().then(d => {
  state.overview = d.overview; state.fetchedAt = Date.now();
  addEvents(d.events);
  // Publisher-curated records sit beside agent check-ins, labelled by their own source.
  addEvents(d.research.map(r => ({...r, id: "r-" + r.id, via: null})));
  drawAll();
  setInterval(() => { if (!document.hidden) poll(); }, POLL);
}).catch(() => { $("#updated").textContent = "could not load the Commons API"; });
