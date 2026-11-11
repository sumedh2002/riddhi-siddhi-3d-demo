/* =========================================================
   SALES CONSOLE — what a project's sales manager uses to keep
   flat availability up to date. Every save goes through inventory.js,
   so the 3D website shows it straight away.
   ========================================================= */
import { PROJECT, FLATS, NF, allUnits, flatOn, FLOOR_AMENITY } from './project-data.js';
import { STATUSES, STATUS_LABEL, getUnit, counts, updateUnit, updateUnits, recentLog, lastUpdated, subscribe, resetDemo, auth, isDemo, useDemoMode, useLiveMode } from './inventory.js';

const app = document.getElementById('app');
const toastEl = document.getElementById('toast');
const THUMB = (document.getElementById('thumb') || {}).src || '';
const UNITS = allUnits();
const FLAT_NOS = Object.keys(FLATS).filter(k => k[0] === 'A').map(k => k.slice(1)).sort(); // '01'…'08'
const SESSION_KEY = 'arch3:console:session', MODE_KEY = 'arch3:console:view';
const THEME_KEY = 'arch3:console:theme';
// light / dark: the person's choice is remembered on this device; until they choose, the device setting decides
try { const t = localStorage.getItem(THEME_KEY); if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; } catch (e) { /* storage blocked */ }
const isDark = () => (document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
const V = typeof __BUILD__ !== 'undefined' ? __BUILD__ : 'dev'; // build stamp, keeps website links fresh after an update
const svg = (d, extra = '') => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true" ${extra}>${d}</svg>`;
const I = {
  logo: svg('<path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/><path d="M4 20h16"/>'),
  grid: svg('<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>'),
  building: svg('<path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16"/><path d="M15 9h4a1 1 0 0 1 1 1v11"/><path d="M8 8h3M8 12h3M8 16h3M2.5 21h19"/>'),
  pulse: svg('<path d="M3 12h4l3-8 4 16 3-8h4"/>'),
  ext: svg('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
  out: svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
  x: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  chev: svg('<path d="M6 9l6 6 6-6"/>'),
  check: svg('<path d="M5 12l5 5 9-10"/>'),
  dots: svg('<circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/>'),
  down: svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
  list: svg('<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>'),
  chart: svg('<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M3.5 9.5h17M3.5 14.5h17M9.5 3.5v17M14.5 3.5v17"/>'),
  ruler: svg('<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>'),
  compass: svg('<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>'),
  note: svg('<path d="M5 4h14v12l-4 4H5z"/><path d="M15 20v-4h4"/>'),
  copy: svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'),
  grip: svg('<circle cx="9" cy="7" r="1"/><circle cx="15" cy="7" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="17" r="1"/><circle cx="15" cy="17" r="1"/>')
};
const SICON = {
  available: svg('<path d="M5 12l5 5 9-10"/>'),
  hold: svg('<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>'),
  booked: svg('<path d="M7 4h10v16l-5-3.5L7 20z"/>'),
  sold: svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>')
};

let saved = null; try { saved = localStorage.getItem(MODE_KEY); } catch (e) { /* ignore */ }
const demoSaved = loadSession();
if (demoSaved && demoSaved.demo) useDemoMode();
const S = { user: demoSaved && demoSaved.demo ? demoSaved : null, booting: auth.enabled && !(demoSaved && demoSaved.demo), loginErr: '', signingIn: false, view: 'login', wing: 'A', status: null, type: null, q: '', mode: saved === 'chart' ? 'chart' : 'list', sel: null, draft: null, tab: 'update', checked: new Set(), prevChecked: 0, popEnter: false, menu: null, drawer: false, confirmReset: false };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const narrow = () => matchMedia('(max-width: 900px)').matches;
const parseId = id => { const m = /^([AB])-([1-7])(0[1-8])$/.exec(id || ''); return m ? { wing: m[1], floor: +m[2], n: m[3], key: m[1] + m[3] } : null; };
const status = s => `<span class="status s-${s}">${SICON[s]}${STATUS_LABEL[s]}</span>`;
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
function rel(t) {
  if (!t) return '';
  const s = (Date.now() - t) / 1000;
  if (s < 45) return 'just now';
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  if (s < 86400) return Math.round(s / 3600) + ' h ago';
  return new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short' });
}

/* ---------- session: live accounts are Supabase Auth (see inventory.js); the demo account is stored on this device ---------- */
function loadSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { return null; } }
function saveSession(u) { try { if (u) localStorage.setItem(SESSION_KEY, JSON.stringify(u)); else localStorage.removeItem(SESSION_KEY); } catch (e) { /* storage blocked: session lasts for this page only */ } S.user = u; }
function nameFrom(email) {
  const local = String(email).split('@')[0].replace(/[._-]+/g, ' ').replace(/\d+/g, '').trim();
  return local ? local.replace(/\b\w/g, c => c.toUpperCase()) : 'Sales Manager';
}
const initials = n => n.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

/* ---------- routing: #overview · #inventory/A · #inventory/A/A-506 · #activity ---------- */
function route() {
  const [view, wing, id] = location.hash.replace(/^#\/?/, '').split('/');
  S.confirmReset = false; S.menu = null; S.drawer = false;
  if (S.booting) { S.view = 'boot'; render(); return; }
  if (!S.user) { S.view = 'login'; render(); return; }
  if (view === 'overview' || view === 'activity') { S.view = view; S.sel = null; S.draft = null; }
  else {
    S.view = 'inventory';
    const w = wing === 'B' ? 'B' : 'A';
    if (w !== S.wing) S.checked.clear();
    S.wing = w;
    const sel = parseId(id) && parseId(id).wing === S.wing ? id : null;
    if (sel !== S.sel || !S.draft) { if (sel && sel !== S.sel) S.popEnter = true; S.sel = sel; S.tab = 'update'; S.draft = sel ? { status: getUnit(sel).status, remarks: getUnit(sel).remarks || '' } : null; }
  }
  render();
}
const go = h => { if (location.hash === '#' + h) route(); else location.hash = h; };
window.addEventListener('hashchange', route);

/* ---------- data helpers ---------- */
function wingRows() {
  const q = S.q.trim().toUpperCase().replace(/\s+/g, '');
  return UNITS.filter(u => u.wing === S.wing)
    .sort((a, b) => a.floor - b.floor || a.n.localeCompare(b.n))
    .filter(u => {
      const x = getUnit(u.id);
      if (S.status && x.status !== S.status) return false;
      if (S.type && String(FLATS[u.key].bhk) !== S.type) return false;
      if (q && !u.id.replace('-', '').includes(q.replace('-', '')) && !(x.remarks || '').toUpperCase().includes(q)) return false;
      return true;
    });
}
function typeCounts(bhk, status) { return UNITS.filter(u => String(FLATS[u.key].bhk) === bhk && (!status || getUnit(u.id).status === status)).length; }

/* ---------- shell ---------- */
function themeBtn(cls) {
  const d = isDark(), label = d ? 'Switch to light theme' : 'Switch to dark theme';
  return `<button class="${cls}" data-act="theme" aria-label="${label}" title="${label}">${d ? I.sun : I.moon}</button>`;
}
function shell(content, ins = true) {
  const n = S.user.name, logN = recentLog(60).length;
  const on = v => S.view === v ? 'on' : '';
  return `<header class="mtop"><button class="burger" data-act="drawer" aria-label="Open menu">${I.menu}</button><span class="logo">${I.logo}Arch3</span>${themeBtn('burger tbtn')}<span class="av" aria-hidden="true">${esc(initials(n))}</span></header>
  <div class="shell ${ins ? '' : 'no-ins'}">
    <aside class="rail ${S.drawer ? 'open' : ''}" aria-label="Main navigation">
      <div class="rail-top"><span class="logo">${I.logo}Arch3</span><button class="rail-close" data-act="drawer-close" aria-label="Close menu">${I.x}</button></div>
      <form class="rail-search" data-goto role="search">${I.search}<label class="sr" for="rs">Find a flat</label><input id="rs" name="q" placeholder="Find flat, e.g. A-506" autocomplete="off"><span class="kbd" aria-hidden="true">/</span></form>
      <div class="proj-pill"><img src="${THUMB}" alt=""><div><b>${esc(PROJECT.name)}</b><small>Sector 3, Pushpak Nagar</small></div></div>
      <nav class="nav" aria-label="Sections">
        <a href="#overview" class="${on('overview')}">${I.grid}Overview</a>
        <a href="#inventory/${S.wing}" class="${on('inventory')}">${I.building}Inventory<span class="count">${UNITS.length}</span></a>
        <a href="#activity" class="${on('activity')}">${I.pulse}Activity${logN ? `<span class="count">${logN}</span>` : ''}</a>
      </nav>
      <div class="nav-sep"></div>
      <nav class="nav" aria-label="Links"><a href="index.html?v=${V}#explore" target="_blank" rel="noopener">${I.ext}Open 3D website</a></nav>
      <div class="rail-user"><span class="av" aria-hidden="true">${esc(initials(n))}</span><div><b>${esc(n)}</b><small>${isDemo() ? 'Demo account' : 'Sales manager · live'}</small></div>${themeBtn('out')}<button class="out" data-act="logout" aria-label="Sign out" title="Sign out">${I.out}</button></div>
    </aside>
    ${S.drawer ? '<div class="scrim" data-act="drawer-close"></div>' : ''}
    <main class="main" id="main">${isDemo() ? `<div class="demo-bar"><b>Demo mode</b> · changes stay on this device. <button class="lnk" data-act="logout">Sign in</button> to update the live website.</div>` : ''}${content}</main>
    ${ins ? insights() : ''}
  </div>`;
}
function footer() {
  return `<footer class="foot"><p>${isDemo() ? 'Demo mode. Changes are saved on this device and show up on the 3D website open in another tab here.' : 'Live. Every change shows on the 3D website for all visitors within seconds.'}</p>
    <div class="reset">${S.confirmReset
      ? `<span>Reset all ${UNITS.length} flats to the starting data${isDemo() ? '' : ' for everyone'}?</span><button class="btn sm danger" data-act="reset-yes">Reset</button><button class="btn sm" data-act="reset-no">Cancel</button>`
      : `<button class="lnk" data-act="reset">Reset demo data</button>`}</div></footer>`;
}

/* ---------- insights rail ---------- */
function gauge(p) {
  const cx = 100, cy = 100, r = 80, a0 = 200, sweep = 220;
  const pt = a => [cx + r * Math.cos(a * Math.PI / 180), cy - r * Math.sin(a * Math.PI / 180)];
  const arc = (from, to) => { const [x0, y0] = pt(from), [x1, y1] = pt(to); return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 ${from - to > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
  const end = a0 - sweep * Math.max(0.005, p / 100);
  return `<svg viewBox="0 0 200 136" role="img" aria-label="${p}% of flats booked or sold"><path d="${arc(a0, a0 - sweep)}" fill="none" stroke="var(--bg-3)" stroke-width="12" stroke-linecap="round"/><path d="${arc(a0, end)}" fill="none" stroke="var(--accent)" stroke-width="12" stroke-linecap="round"/></svg>`;
}
function sbar(c) { return `<div class="sbar" role="img" aria-label="${STATUSES.map(s => `${c[s]} ${STATUS_LABEL[s]}`).join(', ')}">${STATUSES.map(s => c[s] ? `<i class="q-${s}" style="flex:${c[s]}"></i>` : '').join('')}</div>`; }
function insights() {
  const c = counts(), done = c.booked + c.sold, p = pct(done, c.total);
  const today = new Date().setHours(0, 0, 0, 0), updToday = recentLog(60).filter(e => e.at >= today).length;
  const wa = counts({ wing: 'A' }).available, wb = counts({ wing: 'B' }).available;
  return `<aside class="ins" aria-label="Project insights">
    <section class="ins-sec"><div class="ins-h"><h3>Sales progress</h3><span>${done} of ${c.total} flats</span></div>
      <div class="gauge">${gauge(p)}<div class="gauge-v"><b class="num">${p}%</b><small>booked or sold</small></div></div>
      <div class="pair"><div><b><i class="sq q-booked"></i><span class="num">${c.booked}</span></b><small>Booked</small></div><div><b><i class="sq q-sold"></i><span class="num">${c.sold}</span></b><small>Sold</small></div></div>
    </section>
    <section class="ins-sec"><div class="ins-h"><h3>Flat status</h3><span>${c.total} flats</span></div>
      ${sbar(c)}
      <ul class="srows">${STATUSES.map(s => `<li><i class="sq q-${s}"></i>${STATUS_LABEL[s]}<b>${c[s]}</b><em>${pct(c[s], c.total)}%</em></li>`).join('')}</ul>
    </section>
    <section class="ins-sec"><div class="ins-h"><h3>Overview</h3><span>Today</span></div>
      <div class="kgrid">
        <div><b>${c.available}</b><small>Available now</small></div>
        <div><b>${c.hold}</b><small>On hold</small></div>
        <div><b>${typeCounts('1', 'available')}</b><small>1 BHK available</small></div>
        <div><b>${typeCounts('2', 'available')}</b><small>2 BHK available</small></div>
        <div><b>${wa} / ${wb}</b><small>Available in A / B wing</small></div>
        <div><b>${updToday}</b><small>Updates today</small></div>
      </div>
    </section>
    <section class="ins-sec" style="border-bottom:0"><div class="ins-h"><h3>Recent updates</h3>${recentLog(1).length ? '<a class="lnk" href="#activity" style="font-size:.78rem">View all</a>' : ''}</div>
      ${feed(5)}
    </section>
  </aside>`;
}
function feed(n) {
  const items = recentLog(n);
  if (!items.length) return `<p class="none">No updates yet. Changes you save show up here.</p>`;
  return `<ul class="feed">${items.map(e => `<li><button class="fid mono" data-open="${e.id}">${e.id}</button><span class="what">${e.from === e.to ? 'Remarks updated' : `${STATUS_LABEL[e.from]} → ${STATUS_LABEL[e.to]}`}</span><time>${rel(e.at)}</time></li>`).join('')}</ul>`;
}

/* ---------- inventory page ---------- */
function dd(key, label, opts) {
  const cur = S[key], open = S.menu === key;
  const name = v => key === 'status' ? STATUS_LABEL[v] : `${v} BHK`;
  const cnt = v => key === 'status' ? counts({ wing: S.wing })[v] : UNITS.filter(u => u.wing === S.wing && String(FLATS[u.key].bhk) === v).length;
  return `<div class="dd"><button class="pill ${cur ? 'set' : ''}" data-menu="${key}" aria-haspopup="menu" aria-expanded="${open}">${cur ? name(cur) : label}${I.chev}</button>
    ${open ? `<div class="menu" role="menu">${[''].concat(opts).map(v => `<button role="menuitemradio" aria-checked="${(cur || '') === v}" class="${(cur || '') === v ? 'on' : ''}" data-fk="${key}" data-fv="${v}">${v ? (key === 'status' ? `<span class="s-${v}">${SICON[v]}</span>` : '') + name(v) : 'All'}<span class="n">${v ? cnt(v) : ''}</span><span class="tick">${I.check}</span></button>`).join('')}</div>` : ''}
  </div>`;
}
function inventoryPage() {
  const lu = lastUpdated();
  return `<div class="head"><div class="head-l"><h1>Inventory</h1><p class="sub">${esc(PROJECT.name)} · ${lu ? `Last update ${rel(lu)}` : 'No updates yet'}</p></div>
      <div class="actions"><button class="btn" data-act="export">${I.down}Export</button><a class="btn dark" href="index.html?v=${V}#explore" target="_blank" rel="noopener">${I.ext}View website</a></div></div>
    <div class="fbar">
      <div class="seg" role="tablist" aria-label="Wing">${['A', 'B'].map(w => `<button role="tab" aria-selected="${S.wing === w}" class="${S.wing === w ? 'on' : ''}" data-wing="${w}">${w} Wing</button>`).join('')}</div>
      ${dd('status', 'Status', STATUSES)}
      ${dd('type', 'Type', ['1', '2'])}
      ${S.status || S.type || S.q ? `<button class="pill" data-act="clear">${I.x}Clear</button>` : ''}
      <span class="spacer"></span>
      <label class="fsearch" for="fq">${I.search}<span class="sr">Search flats</span><input id="fq" value="${esc(S.q)}" placeholder="Search flat or remark" autocomplete="off"></label>
      <div class="vt" role="group" aria-label="View">${[['list', I.list, 'List'], ['chart', I.chart, 'Chart']].map(([m, ic, t]) => `<button class="${S.mode === m ? 'on' : ''}" data-mode="${m}" aria-pressed="${S.mode === m}">${ic}${t}</button>`).join('')}</div>
    </div>
    <div id="view">${S.mode === 'chart' ? chartView() : tableView()}</div>
    ${footer()}
    <div id="bulk-slot">${bulkBar()}</div>
    ${S.sel ? pop() : ''}`;
}
function tableView() {
  const rows = wingRows(), ids = rows.map(r => r.id);
  const nChk = ids.filter(id => S.checked.has(id)).length, all = nChk && nChk === ids.length;
  if (!rows.length) return `<div class="tbl-wrap"><p class="nores">No flats match these filters. <button class="lnk" data-act="clear">Clear filters</button></p></div>`;
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr>
      <th class="c-chk"><button class="cb ${all ? 'on' : nChk ? 'some' : ''}" data-act="check-all" aria-label="${all ? 'Clear selection' : 'Select all shown flats'}">${all ? I.check : ''}</button></th>
      <th>Flat</th><th class="c-wf">Floor</th><th class="c-type">Type</th><th class="c-carpet">Carpet area</th><th>Status</th><th class="c-rmk">Remarks</th><th class="c-upd">Updated</th><th><span class="sr">Open</span></th>
    </tr></thead><tbody>${rows.map(u => {
      const x = getUnit(u.id), F = FLATS[u.key], chk = S.checked.has(u.id);
      return `<tr class="${S.sel === u.id ? 'on' : ''} ${chk ? 'chk' : ''}" data-open="${u.id}">
        <td class="c-chk"><button class="cb ${chk ? 'on' : ''}" data-check="${u.id}" aria-label="Select ${u.id}" aria-pressed="${chk}">${chk ? I.check : ''}</button></td>
        <td><span class="fid">${u.id}</span><span class="sub-row">${F.bhk} BHK · Floor ${u.floor}</span></td>
        <td class="c-wf mute">Floor ${u.floor}</td>
        <td class="c-type"><span class="tag">${F.bhk} BHK</span></td>
        <td class="c-carpet mute num">≈ ${F.carpet} sq ft</td>
        <td>${status(x.status)}</td>
        <td class="c-rmk"><div class="rmk">${x.remarks ? I.note + esc(x.remarks) : '<span class="faint">—</span>'}</div></td>
        <td class="c-upd faint">${x.updatedAt ? rel(x.updatedAt) : '—'}</td>
        <td><button class="more" data-open="${u.id}" aria-label="Open ${u.id}">${I.dots}</button></td>
      </tr>`;
    }).join('')}</tbody></table></div>
    <div class="tbl-foot"><span>${rows.length} of 56 flats · ${S.wing} Wing</span><span>Tick flats to update several at once</span></div>`;
}
function chartView() {
  const show = new Set(wingRows().map(r => r.id));
  let h = `<div class="chart-box"><table class="chart"><thead><tr><th><span class="sr">Floor</span></th>${FLAT_NOS.map(n => `<th>${n}<small>${FLATS[S.wing + n].bhk} BHK</small></th>`).join('')}</tr></thead><tbody>`;
  for (let fl = NF; fl >= 1; fl--) {
    h += `<tr><th scope="row" class="faint"><span class="fl-l">Floor ${fl}</span><span class="fl-s">F${fl}</span></th>`;
    for (const n of FLAT_NOS) {
      if (!flatOn(S.wing + n, fl)) { const am = (FLOOR_AMENITY[fl] || {})[S.wing + n]; h += `<td><span class="cell na" title="${am || 'No flat here on this floor'}">${am ? am.split(' ')[0] : '–'}</span></td>`; continue; }
      const id = `${S.wing}-${fl}${n}`, x = getUnit(id);
      h += `<td><button class="cell b-${x.status}${S.sel === id ? ' on' : ''}${show.has(id) ? '' : ' dim'}${S.checked.has(id) ? ' chk' : ''}" data-open="${id}" aria-label="Flat ${id}, ${STATUS_LABEL[x.status]}">${fl}${n}${x.remarks ? '<i class="note"></i>' : ''}</button></td>`;
    }
    h += `</tr>`;
  }
  return h + `</tbody></table><p class="legend">${STATUSES.map(s => `<span><i class="sq q-${s}"></i>${STATUS_LABEL[s]}</span>`).join('')}<span class="faint">Floor 7 at the top · Shift-click to select several</span></p></div>`;
}
function bulkBar() {
  const n = S.checked.size;
  if (!n) return '';
  return `<div class="bulk${S.prevChecked ? '' : ' enter'}" role="toolbar" aria-label="Update selected flats"><button class="x" data-act="uncheck" aria-label="Clear selection">${I.x}</button><span class="n">Selected: <b>${n}</b></span><span class="sep"></span>
    ${STATUSES.map(s => `<button data-bulk="${s}"><span class="s-${s}">${SICON[s]}</span>${STATUS_LABEL[s]}</button>`).join('')}</div>`;
}
function pop() {
  const id = S.sel, p = parseId(id), F = FLATS[p.key], u = getUnit(id), d = S.draft;
  const dirty = d.status !== u.status || d.remarks !== (u.remarks || ''), hist = recentLog(60).filter(e => e.id === id);
  return `${narrow() ? '<div class="pop-scrim" data-act="close"></div>' : ''}
  <section class="pop${S.popEnter ? ' enter' : ''}" role="dialog" aria-label="Flat ${id}">
    <div class="pop-h"><span class="grip">${I.grip}</span><b>Flat <span class="mono">${id}</span></b>
      <span style="margin-left:auto;display:flex"><a class="ib" href="index.html?flat=${id}&inside=1&v=${V}#explore" target="_blank" rel="noopener" title="See in 3D" aria-label="See ${id} in 3D">${I.ext}</a><button class="ib" data-act="close" aria-label="Close">${I.x}</button></span></div>
    <div class="pop-meta">
      <div>${I.building}${p.wing} Wing · Floor ${p.floor}</div>
      <div>${I.ruler}${F.bhk} BHK · ≈ ${F.carpet} sq ft carpet</div>
      <div>${I.compass}${esc(F.view)}</div>
      <div>${status(u.status)}<span class="updated">${u.updatedAt ? `· updated ${rel(u.updatedAt)} by ${esc(u.updatedBy)}` : '· not updated yet'}</span></div>
    </div>
    <div class="tabs" role="tablist"><button role="tab" aria-selected="${S.tab === 'update'}" class="${S.tab === 'update' ? 'on' : ''}" data-tab="update">Update</button><button role="tab" aria-selected="${S.tab === 'history'}" class="${S.tab === 'history' ? 'on' : ''}" data-tab="history">History${hist.length ? ` <span class="faint">${hist.length}</span>` : ''}</button></div>
    ${S.tab === 'update' ? `<div class="pop-b">
        <fieldset><legend class="lbl">Status</legend><div class="opts" role="radiogroup" aria-label="Status">${STATUSES.map(s => `<button class="opt ${d.status === s ? 'on' : ''}" role="radio" aria-checked="${d.status === s}" data-status="${s}"><span class="s-${s}">${SICON[s]}</span>${STATUS_LABEL[s]}</button>`).join('')}</div></fieldset>
        <div><label class="lbl" for="rm">Remarks</label><textarea id="rm" maxlength="300" placeholder="e.g. Token received from Mr. Shah. Agreement on 12 Nov.">${esc(d.remarks)}</textarea><p class="hint">Only your team sees remarks. Buyers see the status.</p></div>
      </div>`
      : `<div class="pop-b">${hist.length ? `<ul class="hist">${hist.map(e => `<li><span>${e.from === e.to ? 'Remarks updated' : `${STATUS_LABEL[e.from]} → <b>${STATUS_LABEL[e.to]}</b>`} <span class="faint">· ${esc(e.by)}</span></span><time>${rel(e.at)}</time>${e.remarks ? `<p>${esc(e.remarks)}</p>` : ''}</li>`).join('')}</ul>` : '<p class="none">No changes to this flat yet.</p>'}</div>`}
    <div class="pop-f"><button class="btn sm" data-act="copy">${I.copy}Copy 3D link</button>${S.tab === 'update' ? `<button class="btn dark sm" data-act="save" ${dirty ? '' : 'disabled'}>Save</button>` : ''}</div>
  </section>`;
}

/* ---------- overview + activity pages ---------- */
function overviewPage() {
  const c = counts(), lu = lastUpdated();
  const wing = w => { const k = counts({ wing: w }); return `<div class="wrow"><span>${w} Wing</span>${sbar(k)}<b>${k.available} available</b></div>`; };
  return `<div class="head"><div class="head-l"><h1>Overview</h1><p class="sub">Hi ${esc(S.user.name.split(' ')[0])}. These are the projects you manage.</p></div></div>
    <div class="cards">
      <a class="pcard" href="#inventory/A"><img src="${THUMB}" alt="">
        <div class="pcard-b">
          <div style="display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;justify-content:space-between"><h2>${esc(PROJECT.name)}</h2><span class="live">Live on website</span></div>
          <p class="sub">${esc(PROJECT.location)} · ${c.total} flats · ${lu ? `updated ${rel(lu)}` : 'no updates yet'}</p>
          ${wing('A')}${wing('B')}
          <span class="lnk" style="margin-top:4px">Open inventory</span>
        </div></a>
    </div>
    ${footer()}`;
}
function activityPage() {
  const items = recentLog(60);
  return `<div class="head"><div class="head-l"><h1>Activity</h1><p class="sub">Every status change and remark, newest first.</p></div></div>
    ${items.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Flat</th><th>Change</th><th class="c-rmk">Remarks</th><th class="c-upd">By</th><th>When</th></tr></thead><tbody>
      ${items.map(e => `<tr data-open="${e.id}"><td><span class="fid">${e.id}</span></td><td>${e.from === e.to ? `Remarks · ${status(e.to)}` : `<span class="mute">${STATUS_LABEL[e.from]} →</span> ${status(e.to)}`}</td><td class="c-rmk"><div class="rmk">${e.remarks ? esc(e.remarks) : '<span class="faint">—</span>'}</div></td><td class="c-upd mute">${esc(e.by)}</td><td class="faint">${rel(e.at)}</td></tr>`).join('')}
    </tbody></table></div>` : `<div class="tbl-wrap"><p class="nores">No activity yet. Open the inventory and update a flat to see it here.</p></div>`}
    ${footer()}`;
}
function loginPage() {
  return `<div class="login">
    <section class="login-side"><span class="logo">${I.logo}Arch3</span>
      <div class="big"><h2>Keep every flat's status in step with your 3D website.</h2><p style="margin-top:12px">Mark a flat booked here and buyers see it on the project's 3D model straight away.</p></div>
      <p class="small" style="font-size:.8rem">Concept demo for ${esc(PROJECT.name)}</p></section>
    <main class="login-main">${themeBtn('theme-fab')}<div class="login-form">
      <div><h1>Sign in</h1><p class="sub" style="margin-top:4px">Sales console for your projects.</p></div>
      <form data-login novalidate>
        <label class="field" for="email">Work email<input id="email" name="email" type="email" autocomplete="username" placeholder="you@yourcompany.com"></label>
        <label class="field" for="password">Password<input id="password" name="password" type="password" autocomplete="current-password"></label>
        ${S.loginErr ? `<p class="login-err" role="alert">${esc(S.loginErr)}</p>` : ''}
        <button class="btn dark tall block" type="submit" ${S.signingIn ? 'disabled' : ''}>${S.signingIn ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p class="or">or</p>
      <button class="btn tall block" data-act="demo-login">Continue with the demo account</button>
      <p class="faint" style="font-size:.8rem">${auth.enabled ? 'Explore without an account. Demo changes stay on this device.' : 'Demo mode: any email and password will work.'}</p>
    </div></main></div>`;
}

/* ---------- render ---------- */
function render() {
  const y = window.scrollY, popEl = app.querySelector('.pop'), popY = popEl ? popEl.scrollTop : 0;
  if (S.view === 'boot') app.innerHTML = '<div class="boot" aria-busy="true"><span></span></div>';
  else if (S.view === 'login') app.innerHTML = loginPage();
  else if (S.view === 'overview') app.innerHTML = shell(overviewPage());
  else if (S.view === 'activity') app.innerHTML = shell(activityPage());
  else app.innerHTML = shell(inventoryPage());
  document.documentElement.style.overflow = (S.drawer || (S.sel && narrow())) ? 'hidden' : '';
  window.scrollTo(0, y);
  const np = app.querySelector('.pop'); if (np && popEl) np.scrollTop = popY;
  S.popEnter = false; S.prevChecked = S.checked.size;
}
function renderView() { // partial update while typing in search, so the input keeps focus
  const v = document.getElementById('view'), b = document.getElementById('bulk-slot');
  if (v) v.innerHTML = S.mode === 'chart' ? chartView() : tableView();
  if (b) b.innerHTML = bulkBar();
  S.prevChecked = S.checked.size;
}

/* ---------- actions ---------- */
function openFlat(id) { const p = parseId(id); if (p) go(`inventory/${p.wing}/${id}`); }
function exportCsv() {
  const rows = [['Flat', 'Wing', 'Floor', 'Type', 'Carpet area (approx. sq ft)', 'Status', 'Remarks', 'Updated', 'Updated by']];
  for (const u of UNITS) { const x = getUnit(u.id), F = FLATS[u.key]; rows.push([u.id, u.wing, u.floor, `${F.bhk} BHK`, F.carpet, STATUS_LABEL[x.status], x.remarks || '', x.updatedAt ? new Date(x.updatedAt).toLocaleString() : '', x.updatedBy || '']); }
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = `${PROJECT.id}-inventory.csv`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast(`${I.check}Exported ${UNITS.length} flats as a CSV file`);
}
function copyLink(id) {
  const url = new URL(`index.html?flat=${id}&inside=1&v=${V}#explore`, location.href).href;
  const done = () => toast(`${I.check}Link to ${id} in 3D copied`), fail = () => toast(`Copy this link: ${esc(url)}`);
  try { navigator.clipboard.writeText(url).then(done, fail); } catch (e) { fail(); }
}

app.addEventListener('click', e => {
  const t = e.target.closest('[data-act],[data-menu],[data-fk],[data-wing],[data-mode],[data-check],[data-open],[data-status],[data-tab],[data-bulk]');
  if (!e.target.closest('.dd') && S.menu) { S.menu = null; if (!t || !t.dataset.menu) render(); }
  if (!t) return;
  const d = t.dataset;
  if (d.check) { e.stopPropagation(); S.checked.has(d.check) ? S.checked.delete(d.check) : S.checked.add(d.check); render(); return; }
  if (d.open) {
    if (S.mode === 'chart' && (e.shiftKey || e.metaKey || e.ctrlKey) && t.classList.contains('cell')) { S.checked.has(d.open) ? S.checked.delete(d.open) : S.checked.add(d.open); render(); return; }
    openFlat(d.open); return;
  }
  if (d.menu) { S.menu = S.menu === d.menu ? null : d.menu; render(); return; }
  if (d.fk) { S[d.fk] = d.fv || null; S.menu = null; render(); return; }
  if (d.wing) { go(`inventory/${d.wing}`); return; }
  if (d.mode) { S.mode = d.mode; try { localStorage.setItem(MODE_KEY, d.mode); } catch (er) { /* ignore */ } render(); return; }
  if (d.status) { S.draft.status = d.status; render(); return; }
  if (d.tab) { S.tab = d.tab; render(); return; }
  if (d.bulk) {
    const ids = [...S.checked], n = updateUnits(ids, d.bulk, S.user.name);
    S.checked.clear();
    toast(`${I.check}${n ? `${n} flat${n > 1 ? 's' : ''} marked ${STATUS_LABEL[d.bulk]}. ${isDemo() ? 'Saved on this device (demo).' : 'The website is updated.'}` : `Those flats were already ${STATUS_LABEL[d.bulk]}.`}`);
    if (S.sel) S.draft = { status: getUnit(S.sel).status, remarks: getUnit(S.sel).remarks || '' };
    render(); return;
  }
  switch (d.act) {
    case 'theme': { const t = isDark() ? 'light' : 'dark'; document.documentElement.dataset.theme = t; try { localStorage.setItem(THEME_KEY, t); } catch (er) { /* storage blocked */ } render(); break; }
    case 'drawer': S.drawer = true; render(); break;
    case 'drawer-close': S.drawer = false; render(); break;
    case 'logout':
      S.checked.clear();
      if (S.user && S.user.demo) { saveSession(null); useLiveMode(); go('overview'); }
      else auth.signOut().finally(() => { S.user = null; go('overview'); });
      break;
    case 'demo-login': useDemoMode(); saveSession({ email: 'sales.manager@demo', name: 'Rahul Patil', demo: true }); S.loginErr = ''; go('inventory/A'); break;
    case 'export': exportCsv(); break;
    case 'clear': S.status = null; S.type = null; S.q = ''; render(); break;
    case 'check-all': { const ids = wingRows().map(r => r.id), all = ids.every(id => S.checked.has(id)); ids.forEach(id => all ? S.checked.delete(id) : S.checked.add(id)); render(); break; }
    case 'uncheck': S.checked.clear(); render(); break;
    case 'close': go(`inventory/${S.wing}`); break;
    case 'copy': copyLink(S.sel); break;
    case 'save': {
      const id = S.sel, remarks = S.draft.remarks.trim();
      updateUnit(id, { status: S.draft.status, remarks }, S.user.name);
      S.draft.remarks = remarks;
      toast(`${I.check}${id} saved as ${STATUS_LABEL[S.draft.status]}. ${isDemo() ? 'Saved on this device (demo).' : 'The website is updated.'}`);
      render(); break;
    }
    case 'reset': S.confirmReset = true; render(); break;
    case 'reset-no': S.confirmReset = false; render(); break;
    case 'reset-yes': resetDemo(); S.confirmReset = false; S.checked.clear(); toast(`${I.check}Demo data reset`); go('overview'); break;
  }
});
app.addEventListener('input', e => {
  if (e.target.id === 'fq') { S.q = e.target.value; renderView(); return; }
  if (e.target.id === 'rm' && S.draft) {
    S.draft.remarks = e.target.value;
    const u = getUnit(S.sel), btn = app.querySelector('[data-act="save"]');
    if (btn) btn.disabled = S.draft.status === u.status && S.draft.remarks === (u.remarks || '');
  }
});
app.addEventListener('submit', e => {
  e.preventDefault();
  if (e.target.matches('[data-login]')) {
    const email = e.target.email.value.trim(), password = e.target.password.value;
    if (!auth.enabled) { saveSession({ email: email || 'sales.manager@demo', name: nameFrom(email || 'sales.manager'), demo: true }); go('inventory/A'); return; }
    if (!email || !password) { S.loginErr = 'Enter your work email and password.'; render(); return; }
    S.signingIn = true; S.loginErr = ''; render();
    auth.signIn(email, password).then(u => { saveSession(null); S.user = u; S.signingIn = false; S.loginErr = ''; go('inventory/A'); },
      err => { S.signingIn = false; S.loginErr = err.message; render(); const pw = document.getElementById('password'); if (pw) pw.focus(); });
    return;
  }
  if (e.target.matches('[data-goto]')) {
    const q = e.target.q.value.trim().toUpperCase().replace(/\s+/g, '').replace(/^([AB])(\d)/, '$1-$2');
    if (parseId(q)) openFlat(q); else toast('Type a flat number like A-506 or B-302.');
  }
});
document.addEventListener('keydown', e => {
  const typing = /^(INPUT|TEXTAREA)$/.test((document.activeElement || {}).tagName || '');
  if (e.key === '/' && !typing && S.user) { const r = document.getElementById('rs'); if (r) { e.preventDefault(); if (narrow()) { S.drawer = true; render(); } (document.getElementById('rs') || r).focus(); } }
  if (e.key === 'Escape') {
    if (S.menu) { S.menu = null; render(); }
    else if (S.drawer) { S.drawer = false; render(); }
    else if (S.sel) go(`inventory/${S.wing}`);
    else if (S.checked.size) { S.checked.clear(); render(); }
  }
});
matchMedia('(max-width: 900px)').addEventListener('change', () => S.user && render());

/* changes made in another tab */
subscribe(e => {
  if (e.type === 'error') { toast(esc(e.message)); if (S.view !== 'login' && S.view !== 'boot') render(); return; }
  if (!e.remote) return;
  if (S.sel && S.draft && (e.type === 'reset' || e.id === S.sel)) { const u = getUnit(S.sel); S.draft = { status: u.status, remarks: u.remarks || '' }; }
  const a = document.activeElement; if (a && (a.id === 'rm' || a.id === 'fq' || a.id === 'rs')) return; // don't interrupt typing
  if (S.view !== 'login') render();
});
setInterval(() => { const a = document.activeElement; if (S.view !== 'login' && !(a && /^(INPUT|TEXTAREA)$/.test(a.tagName))) render(); }, 30000);

let tt = null;
function toast(html) { toastEl.innerHTML = html; toastEl.hidden = false; clearTimeout(tt); tt = setTimeout(() => { toastEl.hidden = true; }, 3400); }

route();
// live accounts: restore the Supabase session (if any) before showing the console
if (S.booting) auth.current().then(u => { S.booting = false; if (u) S.user = u; route(); }, () => { S.booting = false; route(); });
