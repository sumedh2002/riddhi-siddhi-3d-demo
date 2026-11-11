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
const SITE = typeof __SITE_LINK__ === 'string' ? __SITE_LINK__ : 'index.html'; // where the 3D explorer lives, relative to this page
const UNITS = allUnits();
const FLAT_NOS = Object.keys(FLATS).filter(k => k[0] === 'A').map(k => k.slice(1)).sort(); // '01'…'08'
const SESSION_KEY = 'arch3:console:session', MODE_KEY = 'arch3:console:view';
const THEME_KEY = 'arch3:console:theme';
// light / dark: the person's choice is remembered on this device; until they choose, the device setting decides
try { const t = localStorage.getItem(THEME_KEY); if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; } catch (e) { /* storage blocked */ }
const isDark = () => (document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
const V = typeof __BUILD__ !== 'undefined' ? __BUILD__ : 'dev'; // build stamp, keeps website links fresh after an update
const svg = (d, extra = '') => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true" ${extra}>${d}</svg>`;
const MARK = '<svg class="mark" viewBox="0 0 28 24" aria-hidden="true"><rect x="0" y="17" width="22" height="5"/><rect x="0" y="10" width="22" height="5"/><rect x="6" y="0" width="22" height="5"/></svg>';
const LOGO = `<span class="logo">${MARK}Arch3</span>`;
const I = {
  building: svg('<path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16"/><path d="M15 9h4a1 1 0 0 1 1 1v11"/><path d="M8 8h3M8 12h3M8 16h3M2.5 21h19"/>'),
  pulse: svg('<path d="M3 12h4l3-8 4 16 3-8h4"/>'),
  ext: svg('<path d="M7 17L17 7M9 7h8v8"/>'),
  out: svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
  x: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  check: svg('<path d="M5 12l5 5 9-10"/>'),
  down: svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>')
};
const dot = s => `<i class="dot ${s}"></i>`;

let saved = null; try { saved = localStorage.getItem(MODE_KEY); } catch (e) { /* ignore */ }
const demoSaved = loadSession();
if (demoSaved && demoSaved.demo) useDemoMode();
const S = { user: demoSaved && demoSaved.demo ? demoSaved : null, booting: auth.enabled && !(demoSaved && demoSaved.demo), loginErr: '', signingIn: false, view: 'login', wing: 'A', status: null, type: null, q: '', mode: saved === 'list' ? 'list' : 'chart', sel: null, draft: null, checked: new Set(), prevChecked: 0, popEnter: false, menu: null, confirmReset: false };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const narrow = () => matchMedia('(max-width: 760px)').matches;  // phone: flat opens as a sheet over a scrim
const docked = () => matchMedia('(min-width: 1181px)').matches; // wide: the flat column is always on screen
const parseId = id => { const m = /^([AB])-([1-7])(0[1-8])$/.exec(id || ''); return m ? { wing: m[1], floor: +m[2], n: m[3], key: m[1] + m[3] } : null; };
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
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
const role = () => isDemo() ? 'Demo account' : 'Sales manager · live';

/* ---------- routing: #inventory/A · #inventory/A/A-506 · #activity (old #overview links land on the flats) ---------- */
function route() {
  const [view, wing, id] = location.hash.replace(/^#\/?/, '').split('/');
  S.confirmReset = false; S.menu = null;
  if (S.booting) { S.view = 'boot'; render(); return; }
  if (!S.user) { S.view = 'login'; render(); return; }
  if (view === 'activity') { S.view = 'activity'; S.sel = null; S.draft = null; }
  else {
    S.view = 'inventory';
    const w = wing === 'B' ? 'B' : 'A';
    if (w !== S.wing) S.checked.clear();
    S.wing = w;
    const sel = parseId(id) && parseId(id).wing === S.wing ? id : null;
    if (sel !== S.sel || !S.draft) { if (sel && sel !== S.sel) S.popEnter = true; S.sel = sel; S.draft = sel ? { status: getUnit(sel).status, remarks: getUnit(sel).remarks || '' } : null; }
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
const floorIds = fl => FLAT_NOS.filter(n => flatOn(S.wing + n, fl)).map(n => `${S.wing}-${fl}${n}`);

/* ---------- shell ---------- */
function themeBtn(cls = 'ib') {
  const label = isDark() ? 'Switch to light theme' : 'Switch to dark theme';
  return `<button class="${cls}" data-act="theme" aria-label="${label}" title="${label}">${isDark() ? I.sun : I.moon}</button>`;
}
const siteLink = (q = '') => `${SITE}?${q}v=${V}#explore`;
function shell(title, content, panel = '') {
  const n = S.user.name, logN = recentLog(60).length;
  const cur = v => S.view === v ? ' aria-current="page"' : '';
  const inv = `#inventory/${S.wing}`;
  return `<div class="app">
    <aside class="side" aria-label="Main navigation">
      ${LOGO}
      <form class="find" data-goto role="search">${I.search}<label class="sr" for="rs">Find a flat</label><input id="rs" name="q" placeholder="Find a flat, e.g. A-506" autocomplete="off"><span class="kbd" aria-hidden="true">/</span></form>
      <nav class="nav" aria-label="Sections">
        <a href="${inv}"${cur('inventory')}>${I.building}Flats<span class="n">${UNITS.length}</span></a>
        <a href="#activity"${cur('activity')}>${I.pulse}Activity${logN ? `<span class="n">${logN}</span>` : ''}</a>
        <a href="${siteLink()}" target="_blank" rel="noopener">${I.ext}Open 3D website</a>
      </nav>
      <h2>Project</h2>
      <div class="proj">${THUMB ? `<img src="${THUMB}" alt="">` : ''}<div><b>${esc(PROJECT.name)}</b><small>Sector 3, Pushpak Nagar</small></div></div>
      <div class="me"><span class="av" aria-hidden="true">${esc(initials(n))}</span><div><b>${esc(n)}</b><small>${role()}</small></div>${themeBtn()}<button class="ib" data-act="logout" aria-label="Sign out" title="Sign out">${I.out}</button></div>
    </aside>
    <div>
      <header class="strip">
        ${LOGO}<span class="t">${title}</span>
        <div class="r">
          <button class="btn wide" data-act="export">${I.down}Export CSV</button>
          <a class="btn wide" href="${siteLink()}" target="_blank" rel="noopener">${I.ext}Open 3D website</a>
          <span class="wide">${themeBtn()}</span>
          <div class="dd acct"><button class="av" data-menu="acct" aria-haspopup="menu" aria-expanded="${S.menu === 'acct'}" aria-label="Account and options">${esc(initials(n))}</button>
            ${S.menu === 'acct' ? `<div class="menu" role="menu">
              <div class="who"><b>${esc(n)}</b><small>${role()}</small></div>
              <button role="menuitem" data-act="export">${I.down}Export CSV</button>
              <a role="menuitem" href="${siteLink()}" target="_blank" rel="noopener">${I.ext}Open 3D website</a>
              <button role="menuitem" data-act="theme">${isDark() ? I.sun : I.moon}${isDark() ? 'Light theme' : 'Dark theme'}</button>
              <button role="menuitem" data-act="logout">${I.out}Sign out</button></div>` : ''}
          </div>
        </div>
      </header>
      <div class="page${panel ? '' : ' solo'}">
        <main class="main" id="main">${isDemo() ? `<div class="demo-bar"><b>Demo mode</b> Changes stay on this device. <button class="lnk" data-act="logout">Sign in</button> to update the live website.</div>` : ''}${content}${footer()}</main>
        ${panel}
      </div>
    </div>
  </div>
  <nav class="tabbar" aria-label="Sections"><a href="${inv}"${cur('inventory')}>${I.building}Flats</a><a href="#activity"${cur('activity')}>${I.pulse}Activity</a></nav>`;
}
function footer() {
  return `<footer class="foot"><p>${isDemo() ? 'Demo mode. Changes are saved on this device only. The live 3D website does not change.' : 'Live. Every change shows on the 3D website for all visitors within seconds.'}</p>
    <div class="reset">${S.confirmReset
      ? `<span>Reset all ${UNITS.length} flats to the starting data${isDemo() ? '' : ' for everyone'}?</span><button class="btn sm danger" data-act="reset-yes">Reset</button><button class="btn sm" data-act="reset-no">Cancel</button>`
      : `<button class="lnk" data-act="reset">Reset demo data</button>`}</div></footer>`;
}

/* ---------- flats page ---------- */
function inventoryPage() {
  const c = counts(), lu = lastUpdated();
  const seg = (attr, cur, opts) => opts.map(([v, t]) => `<button data-${attr}="${v}" aria-pressed="${(cur || '') === v}">${t}</button>`).join('');
  return `<div class="head"><h1>Flats</h1>
      <p class="live${isDemo() ? ' demo' : ''}">${isDemo() ? 'Demo data' : 'Live on the website'} <span>${lu ? `updated ${rel(lu)}` : 'no updates yet'}</span></p></div>
    <div class="tabs" role="tablist" aria-label="Wing">${['A', 'B'].map(w => `<button role="tab" aria-selected="${S.wing === w}" data-wing="${w}">${w} Wing<span class="cnt">${counts({ wing: w }).total}</span></button>`).join('')}</div>
    <div class="tiles" role="group" aria-label="Show only one status">${STATUSES.map((s, i) => `<button class="tile${i ? '' : ' lit'}" data-s="${s}" aria-pressed="${S.status === s}"><span class="l">${dot(s)}${STATUS_LABEL[s]}</span><b>${c[s]}</b><span class="f">of ${c.total} flats<em>${pct(c[s], c.total)}%</em></span></button>`).join('')}</div>
    <div class="tools">
      <div class="seg" role="group" aria-label="Flat type">${seg('t', S.type, [['', 'All<span class="ty">&nbsp;types</span>'], ['1', '1 BHK'], ['2', '2 BHK']])}</div>
      ${S.status || S.type || S.q ? `<button class="clear" data-act="clear">${I.x}Clear</button>` : ''}
      <span class="sp"></span>
      <label class="find${S.mode === 'chart' ? ' chart-only' : ''}" for="fq">${I.search}<span class="sr">Search flats</span><input id="fq" value="${esc(S.q)}" placeholder="Search flat or remark" autocomplete="off"></label>
      <div class="seg" role="group" aria-label="View">${seg('mode', S.mode, [['chart', 'Chart'], ['list', 'List']])}</div>
    </div>
    <div id="view">${S.mode === 'chart' ? chartView() : tableView()}</div>
    <div id="bulk-slot">${bulkBar()}</div>`;
}
function chartView() {
  const show = new Set(wingRows().map(r => r.id));
  let h = `<span></span>${FLAT_NOS.map(n => `<div class="colh"><b>${n}</b><small>${FLATS[S.wing + n].bhk} BHK</small></div>`).join('')}`;
  for (let fl = NF; fl >= 1; fl--) {
    const ids = floorIds(fl), all = ids.every(id => S.checked.has(id));
    h += `<button class="fl" data-floor="${fl}" aria-pressed="${all}" title="${all ? 'Clear' : 'Select'} all of floor ${fl}"><span class="w">Floor&nbsp;</span>${fl}</button>`;
    for (const n of FLAT_NOS) {
      if (!flatOn(S.wing + n, fl)) { const am = (FLOOR_AMENITY[fl] || {})[S.wing + n]; h += `<span class="cell na" title="${am || 'No flat here on this floor'}">${am || 'Not built'}</span>`; continue; }
      const id = `${S.wing}-${fl}${n}`, x = getUnit(id);
      h += `<button class="cell ${x.status}${S.sel === id ? ' on' : ''}${show.has(id) ? '' : ' dim'}${S.checked.has(id) ? ' chk' : ''}" data-open="${id}" aria-label="Flat ${id}, ${STATUS_LABEL[x.status]}${x.remarks ? ', has a remark' : ''}">${fl}${n}${x.remarks ? '<i class="rm"></i>' : ''}</button>`;
    }
  }
  return `<section class="card" aria-label="${S.wing} Wing chart"><div class="chart">${h}</div><p class="hint-line">Floor 7 at the top. Tap a floor number to select the whole floor. A dot means the flat has a remark.</p></section>`;
}
function tableView() {
  const rows = wingRows(), ids = rows.map(r => r.id);
  const nChk = ids.filter(id => S.checked.has(id)).length, all = nChk && nChk === ids.length;
  if (!rows.length) return `<div class="tbl-wrap"><p class="nores">No flats match these filters. <button class="lnk" data-act="clear">Clear filters</button></p></div>`;
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr>
      <th class="c-chk"><button class="cb ${all ? 'on' : nChk ? 'some' : ''}" data-act="check-all" aria-label="${all ? 'Clear selection' : 'Select all shown flats'}">${all ? I.check : ''}</button></th>
      <th>Flat</th><th class="c-wf">Floor</th><th class="c-type">Type</th><th class="c-carpet">Carpet area</th><th>Status</th><th class="c-rmk">Remarks</th><th class="c-upd">Updated</th>
    </tr></thead><tbody>${rows.map(u => {
      const x = getUnit(u.id), F = FLATS[u.key], chk = S.checked.has(u.id);
      return `<tr class="${S.sel === u.id ? 'on' : ''}" data-open="${u.id}">
        <td class="c-chk"><button class="cb ${chk ? 'on' : ''}" data-check="${u.id}" aria-label="Select ${u.id}" aria-pressed="${chk}">${chk ? I.check : ''}</button></td>
        <td><span class="fid">${u.id}</span><span class="sub-row">${F.bhk} BHK · Floor ${u.floor}</span></td>
        <td class="c-wf mute">Floor ${u.floor}</td>
        <td class="c-type mute">${F.bhk} BHK</td>
        <td class="c-carpet mute">≈ ${F.carpet} sq ft</td>
        <td><span class="st">${dot(x.status)}${STATUS_LABEL[x.status]}</span></td>
        <td class="c-rmk"><div class="rmk">${x.remarks ? esc(x.remarks) : '<span class="faint">—</span>'}</div></td>
        <td class="c-upd faint">${x.updatedAt ? rel(x.updatedAt) : '—'}</td>
      </tr>`;
    }).join('')}</tbody></table></div>
    <p class="tbl-foot"><span>${rows.length} of ${counts({ wing: S.wing }).total} flats · ${S.wing} Wing</span><span>Tick flats to update several at once</span></p>`;
}
function bulkBar() {
  const n = S.checked.size;
  if (!n) return '';
  return `<div class="bulk${S.prevChecked ? '' : ' enter'}" role="toolbar" aria-label="Update selected flats"><span class="n">${n} selected</span>
    ${STATUSES.map(s => `<button data-bulk="${s}">${dot(s)}${STATUS_LABEL[s]}</button>`).join('')}<button data-act="uncheck">Cancel</button></div>`;
}
function panel() {
  if (S.view !== 'inventory') return '';
  if (!S.sel) return docked() ? `<aside class="panel" aria-label="Flat details"><div class="p-b p-empty"><div><h2>Pick a flat</h2><p>Tap any flat in the chart to change its status or add a remark.</p></div></div></aside>` : '';
  const id = S.sel, p = parseId(id), F = FLATS[p.key], u = getUnit(id), d = S.draft;
  const dirty = d.status !== u.status || d.remarks !== (u.remarks || ''), hist = recentLog(60).filter(e => e.id === id);
  return `${narrow() ? '<div class="p-scrim" data-act="close"></div>' : ''}
  <aside class="panel${S.popEnter ? ' enter' : ''}" role="${docked() ? 'region' : 'dialog'}" aria-label="Flat ${id}">
    <div class="p-h"><div><h2>${id}</h2><p>${p.wing} Wing · Floor ${p.floor} · ${F.bhk} BHK · ≈ ${F.carpet} sq ft · ${esc(F.view)}</p></div><button class="ib p-close" data-act="close" aria-label="Close">${I.x}</button></div>
    <div class="p-b">
      <fieldset><legend class="lbl">Status</legend><div class="opts" role="radiogroup" aria-label="Status">${STATUSES.map(s => `<button class="opt ${s}" role="radio" aria-checked="${d.status === s}" data-status="${s}">${dot(s)}${STATUS_LABEL[s]}</button>`).join('')}</div>
        <p class="updated" style="margin-top:8px">${u.updatedAt ? `Updated ${rel(u.updatedAt)}${u.updatedBy ? ` by ${esc(u.updatedBy)}` : ''}` : 'Not updated yet'}</p></fieldset>
      <div><label class="lbl" for="rm">Remarks</label><textarea id="rm" maxlength="300" placeholder="e.g. Token received from Mr. Shah. Agreement on 12 Nov.">${esc(d.remarks)}</textarea><p class="hint">Only your team sees remarks. Buyers see the status.</p></div>
      <div class="p-f"><button class="btn pri" data-act="save" ${dirty ? '' : 'disabled'}>Save</button>
        <div><a class="btn" href="${siteLink(`flat=${id}&inside=1&`)}" target="_blank" rel="noopener">${I.ext}See in 3D</a><button class="btn" data-act="copy">Copy link</button></div></div>
    </div>
    <div class="hist"><h3>History</h3>${hist.length ? `<ul>${hist.map(e => `<li><span>${e.from === e.to ? 'Remarks updated' : `${STATUS_LABEL[e.from]} → <b>${STATUS_LABEL[e.to]}</b>`}${e.by ? ` · ${esc(e.by)}` : ''}</span><time>${rel(e.at)}</time>${e.remarks ? `<p>${esc(e.remarks)}</p>` : ''}</li>`).join('')}</ul>` : '<p class="faint" style="font-size:.875rem">No changes to this flat yet.</p>'}</div>
  </aside>`;
}

/* ---------- activity + sign in ---------- */
function activityPage() {
  const items = recentLog(60);
  return `<div class="head"><div><h1>Activity</h1><p class="sub">Every status change and remark, newest first.</p></div></div>
    ${items.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Flat</th><th>Change</th><th class="c-rmk">Remarks</th><th class="c-upd">By</th><th>When</th></tr></thead><tbody>
      ${items.map(e => `<tr data-open="${e.id}"><td><span class="fid">${e.id}</span></td><td><span class="st">${dot(e.to)}${e.from === e.to ? `Remarks · ${STATUS_LABEL[e.to]}` : `<span class="mute">${STATUS_LABEL[e.from]} →</span> ${STATUS_LABEL[e.to]}`}</span></td><td class="c-rmk"><div class="rmk">${e.remarks ? esc(e.remarks) : '<span class="faint">—</span>'}</div></td><td class="c-upd mute">${esc(e.by)}</td><td class="faint">${rel(e.at)}</td></tr>`).join('')}
    </tbody></table></div>` : `<div class="tbl-wrap"><p class="nores">No activity yet. Open a flat and change its status to see it here.</p></div>`}`;
}
function loginPage() {
  return `<div class="login">${themeBtn('ib theme-fab')}<div class="login-card">
      ${LOGO}
      <div><h1>Sign in</h1><p class="sub">Sales console for ${esc(PROJECT.name)}.</p></div>
      <form data-login novalidate>
        <label class="field" for="email">Work email<input id="email" name="email" type="email" autocomplete="username" placeholder="you@yourcompany.com"></label>
        <label class="field" for="password">Password<input id="password" name="password" type="password" autocomplete="current-password"></label>
        ${S.loginErr ? `<p class="login-err" role="alert">${esc(S.loginErr)}</p>` : ''}
        <button class="btn pri tall block" type="submit" ${S.signingIn ? 'disabled' : ''}>${S.signingIn ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p class="or">or</p>
      <button class="btn tall block" data-act="demo-login">Continue with the demo account</button>
      <p class="faint" style="font-size:.8125rem">${auth.enabled ? 'Explore without an account. Demo changes stay on this device.' : 'Demo mode: any email and password will work.'}</p>
    </div></div>`;
}

/* ---------- render ---------- */
function render() {
  const y = window.scrollY, popEl = app.querySelector('.panel'), popY = popEl ? popEl.scrollTop : 0;
  if (!S.user && S.view !== 'boot') S.view = 'login'; // a sync can arrive just after sign-out
  if (S.view === 'boot') app.innerHTML = '<div class="boot" aria-busy="true"><span></span></div>';
  else if (S.view === 'login') app.innerHTML = loginPage();
  else if (S.view === 'activity') app.innerHTML = shell('Activity', activityPage());
  else app.innerHTML = shell('Flats', inventoryPage(), panel());
  document.documentElement.style.overflow = S.sel && narrow() && S.view === 'inventory' ? 'hidden' : '';
  window.scrollTo(0, y);
  const np = app.querySelector('.panel'); if (np && popEl) np.scrollTop = popY;
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
const toggle = id => S.checked.has(id) ? S.checked.delete(id) : S.checked.add(id);
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
  const url = new URL(siteLink(`flat=${id}&inside=1&`), location.href).href;
  const done = () => toast(`${I.check}Link to ${id} in 3D copied`), fail = () => toast(`Copy this link: ${esc(url)}`);
  try { navigator.clipboard.writeText(url).then(done, fail); } catch (e) { fail(); }
}

app.addEventListener('click', e => {
  const t = e.target.closest('[data-act],[data-menu],[data-wing],[data-mode],[data-check],[data-open],[data-floor],[data-status],[data-bulk],[data-s],[data-t]');
  if (S.menu && !e.target.closest('.dd')) { S.menu = null; if (!t) { render(); return; } }
  if (!t) return;
  const d = t.dataset;
  if (d.check) { e.stopPropagation(); toggle(d.check); render(); return; }
  if (d.floor) { const ids = floorIds(+d.floor), all = ids.every(id => S.checked.has(id)); ids.forEach(id => all ? S.checked.delete(id) : S.checked.add(id)); render(); return; }
  if (d.open) {
    // while flats are selected, tapping more cells adds to the selection instead of opening one
    if (S.view === 'inventory' && S.mode === 'chart' && t.classList.contains('cell') && (S.checked.size || e.shiftKey || e.metaKey || e.ctrlKey)) { toggle(d.open); render(); return; }
    openFlat(d.open); return;
  }
  if (d.menu) { S.menu = S.menu === d.menu ? null : d.menu; render(); return; }
  if (d.s) { S.status = S.status === d.s ? null : d.s; render(); return; }
  if (d.t !== undefined) { S.type = d.t || null; render(); return; }
  if (d.wing) { go(`inventory/${d.wing}`); return; }
  if (d.mode) { S.mode = d.mode; try { localStorage.setItem(MODE_KEY, d.mode); } catch (er) { /* ignore */ } render(); return; }
  if (d.status) { S.draft.status = d.status; render(); return; }
  if (d.bulk) {
    const ids = [...S.checked], n = updateUnits(ids, d.bulk, S.user.name);
    S.checked.clear();
    toast(`${I.check}${n ? `${plural(n, 'flat')} marked ${STATUS_LABEL[d.bulk]}. ${isDemo() ? 'Saved on this device (demo).' : 'The website is updated.'}` : `Those flats were already ${STATUS_LABEL[d.bulk]}.`}`);
    if (S.sel) S.draft = { status: getUnit(S.sel).status, remarks: getUnit(S.sel).remarks || '' };
    render(); return;
  }
  switch (d.act) {
    case 'theme': { const th = isDark() ? 'light' : 'dark'; document.documentElement.dataset.theme = th; try { localStorage.setItem(THEME_KEY, th); } catch (er) { /* storage blocked */ } S.menu = null; render(); break; }
    case 'logout':
      S.checked.clear(); S.menu = null;
      if (S.user && S.user.demo) { saveSession(null); useLiveMode(); go('inventory/A'); }
      else auth.signOut().finally(() => { S.user = null; go('inventory/A'); });
      break;
    case 'demo-login': useDemoMode(); saveSession({ email: 'sales.manager@demo', name: 'Rahul Patil', demo: true }); S.loginErr = ''; go('inventory/A'); break;
    case 'export': S.menu = null; exportCsv(); render(); break;
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
    case 'reset-yes': resetDemo(); S.confirmReset = false; S.checked.clear(); toast(`${I.check}Demo data reset`); go('inventory/A'); break;
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
  if (e.key === '/' && !typing && S.user) { const r = document.getElementById(narrow() ? 'fq' : 'rs'); if (r && r.offsetParent) { e.preventDefault(); r.focus(); } }
  if (e.key === 'Escape') {
    if (S.menu) { S.menu = null; render(); }
    else if (S.sel) go(`inventory/${S.wing}`);
    else if (S.checked.size) { S.checked.clear(); render(); }
  }
});
for (const q of ['(max-width: 760px)', '(min-width: 1181px)']) matchMedia(q).addEventListener('change', () => S.user && render());

/* changes made in another tab */
subscribe(e => {
  if (e.type === 'error') { toast(esc(e.message)); if (S.view !== 'login' && S.view !== 'boot') render(); return; }
  if (!e.remote) return;
  if (S.sel && S.draft && (e.type === 'reset' || e.id === S.sel)) { const u = getUnit(S.sel); S.draft = { status: u.status, remarks: u.remarks || '' }; }
  const a = document.activeElement; if (a && (a.id === 'rm' || a.id === 'fq' || a.id === 'rs')) return; // don't interrupt typing
  if (S.view !== 'login') render();
});
setInterval(() => { const a = document.activeElement; if (S.view !== 'login' && !S.menu && !(a && /^(INPUT|TEXTAREA)$/.test(a.tagName))) render(); }, 30000);

let tt = null;
function toast(html) { toastEl.innerHTML = html; toastEl.hidden = false; clearTimeout(tt); tt = setTimeout(() => { toastEl.hidden = true; }, 3400); }

route();
// live accounts: restore the Supabase session (if any) before showing the console
if (S.booting) auth.current().then(u => { S.booting = false; if (u) S.user = u; route(); }, () => { S.booting = false; route(); });
