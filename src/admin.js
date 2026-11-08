/* =========================================================
   SALES CONSOLE — what a project's sales manager uses to keep
   flat availability up to date. Every save goes through inventory.js,
   so the 3D website shows it straight away.
   ========================================================= */
import { PROJECT, FLATS, NF } from './project-data.js';
import { STATUSES, STATUS_LABEL, getUnit, counts, updateUnit, recentLog, lastUpdated, subscribe, resetDemo } from './inventory.js';

const app = document.getElementById('app');
const toastEl = document.getElementById('toast');
const THUMB = (document.getElementById('thumb') || {}).src || '';
const FLAT_NOS = Object.keys(FLATS).filter(k => k[0] === 'A').map(k => k.slice(1)).sort(); // '01'…'08'
const SESSION_KEY = 'storey3d:console:session';
const DESC = {
  available: 'Open for sale. Green on the website.',
  hold: 'Reserved, e.g. token pending.',
  booked: 'Booking amount received.',
  sold: 'Agreement done.'
};
const ICON = {
  cube: '<svg class="i" viewBox="0 0 24 24"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 10h.01M15 10h.01M9 14h.01M15 14h.01M10 21v-3h4v3"/></svg>',
  out: '<svg class="i" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>',
  ext: '<svg class="i" viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  x: '<svg class="i" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  tap: '<svg class="i" viewBox="0 0 24 24"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0 0V8.5a1.5 1.5 0 0 1 3 0V11m0 0a1.5 1.5 0 0 1 3 0v3a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L4.4 14a1.5 1.5 0 0 1 2.5-1.7L9 15"/></svg>',
  check: '<svg class="i" viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>'
};

const S = { user: loadSession(), view: 'login', wing: 'A', filter: null, sel: null, draft: null };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mobile = () => matchMedia('(max-width: 959px)').matches;
const parseId = id => { const m = /^([AB])-([1-7])(0[1-8])$/.exec(id || ''); return m ? { wing: m[1], floor: +m[2], n: m[3], key: m[1] + m[3] } : null; };
const pill = st => `<span class="pill s-${st}">${STATUS_LABEL[st]}</span>`;
function rel(t) {
  if (!t) return '';
  const s = (Date.now() - t) / 1000;
  if (s < 45) return 'just now';
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  if (s < 86400) return Math.round(s / 3600) + ' h ago';
  return new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short' });
}

/* ---------- session (demo: any email works; replaced by Supabase auth later) ---------- */
function loadSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { return null; } }
function saveSession(u) { try { if (u) localStorage.setItem(SESSION_KEY, JSON.stringify(u)); else localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ } S.user = u; }
function nameFrom(email) {
  const local = String(email).split('@')[0].replace(/[._-]+/g, ' ').trim();
  return local ? local.replace(/\b\w/g, c => c.toUpperCase()) : 'Sales Manager';
}
const initials = n => n.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

/* ---------- routing: #projects · #inventory/A · #inventory/A/A-506 ---------- */
function route() {
  const [view, wing, id] = location.hash.replace(/^#\/?/, '').split('/');
  if (!S.user) S.view = 'login';
  else if (view === 'inventory') {
    S.view = 'inventory'; S.wing = wing === 'B' ? 'B' : 'A';
    const sel = parseId(id) && parseId(id).wing === S.wing ? id : null;
    if (sel !== S.sel || !S.draft) { S.sel = sel; S.draft = sel ? { status: getUnit(sel).status, remarks: getUnit(sel).remarks || '' } : null; }
  } else { S.view = 'projects'; S.sel = null; S.draft = null; }
  render();
}
const go = h => { if (location.hash === '#' + h) route(); else location.hash = h; };
window.addEventListener('hashchange', route);

/* ---------- pieces ---------- */
function statbar(c) {
  return `<div class="statbar" role="img" aria-label="${STATUSES.map(s => `${c[s]} ${STATUS_LABEL[s]}`).join(', ')}">${STATUSES.map(s => c[s] ? `<i class="${s}" style="width:${(c[s] / c.total * 100).toFixed(2)}%"></i>` : '').join('')}</div>`;
}
function countsRow(c) { return `<div class="counts">${STATUSES.map(s => `<span><i class="dot d-${s}"></i>${STATUS_LABEL[s]} <b>${c[s]}</b></span>`).join('')}</div>`; }
function topbar() {
  const n = S.user.name;
  return `<header class="top"><div class="top-in">
    <a class="logo" href="#projects"><span class="mark">${ICON.cube}</span><b>Storey3D</b><span class="sep"></span><span class="app">Sales console</span></a>
    <span class="demo">Demo</span>
    <div class="me"><span class="av" aria-hidden="true">${esc(initials(n))}</span><span class="who"><b>${esc(n)}</b><small>Sales manager</small></span>
    <button class="icon-btn" data-act="logout" title="Sign out" aria-label="Sign out">${ICON.out}</button></div>
  </div></header>
  <p class="banner"><b>Demo mode:</b> changes are saved in this browser and show up instantly on the 3D website open in another tab. Sync across phones comes with the cloud backend.</p>`;
}
function activity(n, onlyId) {
  const items = recentLog(60).filter(e => !onlyId || e.id === onlyId).slice(0, n);
  if (!items.length) return `<p class="empty">${onlyId ? 'No changes to this flat yet.' : 'No updates yet. Changes you save appear here.'}</p>`;
  return `<div class="acts">${items.map(e => `<div class="act">
      ${onlyId ? '' : `<button class="u" data-unit="${e.id}">${e.id}</button>`}
      <span class="what" style="${onlyId ? 'grid-column:1/3' : ''}">${e.from === e.to ? `Remarks updated · ${pill(e.to)}` : `${pill(e.from)} → ${pill(e.to)}`} <br><small>by ${esc(e.by)}</small></span>
      <time datetime="${new Date(e.at).toISOString()}">${rel(e.at)}</time>
      ${e.remarks ? `<p class="rm" style="${onlyId ? 'grid-column:1/4' : ''}">“${esc(e.remarks)}”</p>` : ''}
    </div>`).join('')}</div>`;
}

/* ---------- views ---------- */
function loginView() {
  return `<div class="login"><div>
    <div class="login-card">
      <div class="logo"><span class="mark">${ICON.cube}</span><b>Storey3D</b></div>
      <h1>Sales console</h1>
      <p class="sub">Sign in to update flat availability for your projects.</p>
      <form data-login novalidate>
        <label class="field">Work email<input name="email" type="email" required autocomplete="username" placeholder="you@yourcompany.com"></label>
        <label class="field">Password<input name="password" type="password" required autocomplete="current-password" placeholder="••••••••"></label>
        <button class="btn primary block" type="submit">Sign in</button>
      </form>
      <p class="note">Demo: any email and password will work. Real logins come with the cloud backend.</p>
    </div>
    <p class="foot">Concept demo for ${esc(PROJECT.name)}</p>
  </div></div>`;
}
function projectsView() {
  const c = counts(), lu = lastUpdated();
  return `${topbar()}<main class="page">
    <div class="head"><div><p class="eyebrow">Welcome back, ${esc(S.user.name.split(' ')[0])}</p><h1>Your projects</h1><p class="sub">Projects you manage. Every change you save shows up on that project's 3D website.</p></div></div>
    <a class="proj" href="#inventory/A">
      <img src="${THUMB}" alt="">
      <div class="proj-b">
        <div class="proj-t"><h2>${esc(PROJECT.name)}</h2><span class="live">Live on website</span></div>
        <p>${esc(PROJECT.location)} · A &amp; B Wing · ${c.total} flats</p>
        ${statbar(c)}${countsRow(c)}
        <p class="upd">${lu ? `Last update ${rel(lu)}` : 'No updates yet'}</p>
        <span class="go">Update availability →</span>
      </div>
    </a>
    <section class="card mt"><h3>Recent activity</h3>${activity(8)}</section>
    ${footRow()}
  </main>`;
}
function inventoryView() {
  const all = counts(), wc = { A: counts({ wing: 'A' }), B: counts({ wing: 'B' }) };
  const kpi = (key, label, n, extra = '') => `<button class="kpi ${S.filter === key ? 'on' : ''} ${key === 'all' ? 'k-all' : ''}" data-filter="${key}" aria-pressed="${S.filter === key}">
      <span>${key !== 'all' ? `<i class="dot d-${key}"></i>` : ''}${label}</span><b>${n}</b>${extra}</button>`;
  return `${topbar()}<main class="page">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="#projects">Projects</a><span>›</span><span>${esc(PROJECT.name)}</span></nav>
    <div class="head">
      <div><h1>${esc(PROJECT.name)}</h1><p class="sub">Tap a flat to change its status. The website updates as soon as you save.</p></div>
      <div class="head-act">
        <form class="search" data-search><label class="sr" for="q">Go to flat</label><input id="q" name="q" placeholder="Flat no. e.g. A-506" autocomplete="off"><button type="submit">Go</button></form>
        <a class="btn ghost" href="index.html#explore" target="_blank" rel="noopener">${ICON.ext}Open 3D website</a>
      </div>
    </div>
    <div class="kpis">
      ${kpi('all', 'All flats', all.total, `<span style="flex:1"></span>${statbar(all)}`)}
      ${STATUSES.map(s => kpi(s, STATUS_LABEL[s], all[s])).join('')}
    </div>
    <div class="layout">
      <section class="card">
        <div class="inv-head">
          <div class="tabs" role="tablist">${['A', 'B'].map(w => `<button role="tab" aria-selected="${S.wing === w}" class="${S.wing === w ? 'on' : ''}" data-wing="${w}">${w} Wing <small>${wc[w].available}<span class="t"> available</span></small></button>`).join('')}</div>
          <span class="hint">${S.filter && S.filter !== 'all' ? `Showing ${STATUS_LABEL[S.filter].toLowerCase()} flats · <button class="link-btn" data-filter="all">show all</button>` : 'Floor 7 at the top · 8 flats per floor'}</span>
        </div>
        ${grid()}
        <div class="legend">${STATUSES.map(s => `<span><i class="dot d-${s}"></i>${STATUS_LABEL[s]}</span>`).join('')}<span><i class="nt"></i>Has remarks</span></div>
      </section>
      <aside class="side card">${S.sel && !mobile() ? editor() : placeholder()}</aside>
    </div>
    <section class="card mt"><h3>Recent activity</h3>${activity(10)}</section>
    ${footRow()}
  </main>
  ${S.sel && mobile() ? `<div class="sheet-bg" data-act="close"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="Update flat ${S.sel}">${editor()}</div>` : ''}`;
}
function grid() {
  let h = `<div class="gridwrap"><table class="inv"><thead><tr><th scope="col"><span class="sr">Floor</span></th>${FLAT_NOS.map(n => `<th scope="col">${n}<small>${FLATS[S.wing + n].bhk} BHK</small></th>`).join('')}</tr></thead><tbody>`;
  for (let fl = NF; fl >= 1; fl--) {
    h += `<tr><th scope="row"><span class="fl-l">Floor </span><span class="fl-s">F</span>${fl}</th>`;
    for (const n of FLAT_NOS) {
      const id = `${S.wing}-${fl}${n}`, u = getUnit(id);
      const dim = S.filter && S.filter !== 'all' && u.status !== S.filter;
      h += `<td><button class="cell s-${u.status} ${S.sel === id ? 'sel' : ''} ${dim ? 'dim' : ''}" data-unit="${id}" aria-label="Flat ${id}, ${STATUS_LABEL[u.status]}${u.remarks ? ', has remarks' : ''}">${fl}${n}${u.remarks ? '<i class="note"></i>' : ''}</button></td>`;
    }
    h += `</tr>`;
  }
  return h + `</tbody></table></div>`;
}
function placeholder() {
  return `<div class="placeholder"><span class="big">${ICON.tap}</span><h3>Select a flat</h3><p>Tap any flat in the grid to mark it Available, On hold, Booked or Sold, and add a remark for your team.</p></div>`;
}
function editor() {
  const id = S.sel, p = parseId(id), F = FLATS[p.key], u = getUnit(id), d = S.draft;
  const dirty = d.status !== u.status || d.remarks !== (u.remarks || '');
  return `<div class="ed">
    <div class="ed-h"><div><p class="eyebrow">${p.wing} Wing · Floor ${p.floor}</p><h2>Flat ${id}</h2><p class="meta">${F.bhk} BHK · ≈ ${F.carpet} sq ft · ${esc(F.view)}</p></div>
      <button class="x" data-act="close" aria-label="Close">${ICON.x}</button></div>
    <p class="lbl">Status <small>now: ${STATUS_LABEL[u.status]}</small></p>
    <div class="opts" role="radiogroup" aria-label="Status">${STATUSES.map(s => `<button class="opt s-${s} ${d.status === s ? 'on' : ''}" role="radio" aria-checked="${d.status === s}" data-status="${s}"><i></i><span><b>${STATUS_LABEL[s]}</b><small>${DESC[s]}</small></span></button>`).join('')}</div>
    <label class="lbl" for="rm">Remarks <small>Internal only · buyers never see this</small></label>
    <textarea id="rm" maxlength="300" placeholder="e.g. Token received from Mr. Shah, agreement on 12 Nov">${esc(d.remarks)}</textarea>
    <div class="ed-act">
      <button class="btn primary" data-act="save" ${dirty ? '' : 'disabled'}>${ICON.check}Save &amp; update website</button>
      <a class="btn ghost" href="index.html?flat=${id}#explore" target="_blank" rel="noopener">${ICON.ext}See in 3D</a>
    </div>
    <p class="last">${u.updatedAt ? `Last updated ${rel(u.updatedAt)} by ${esc(u.updatedBy)}` : 'Not updated yet in this demo.'}</p>
    <p class="lbl">History</p>${activity(6, id)}
  </div>`;
}
function footRow() {
  return `<div class="foot-row"><span>Storey3D sales console · concept demo</span><button class="link-btn" data-act="reset">Reset demo data</button></div>`;
}

/* ---------- render ---------- */
function render() {
  const keepY = window.scrollY, sheet = app.querySelector('.sheet'), sheetY = sheet ? sheet.scrollTop : 0;
  app.innerHTML = S.view === 'login' ? loginView() : S.view === 'projects' ? projectsView() : inventoryView();
  document.documentElement.classList.toggle('lock', !!app.querySelector('.sheet'));
  window.scrollTo(0, keepY);
  const ns = app.querySelector('.sheet'); if (ns && sheet) ns.scrollTop = sheetY;
}

/* ---------- events ---------- */
app.addEventListener('click', e => {
  const t = e.target.closest('[data-act],[data-unit],[data-status],[data-wing],[data-filter]'); if (!t) return;
  const d = t.dataset;
  if (d.unit) { const p = parseId(d.unit); go(`inventory/${p.wing}/${d.unit}`); return; }
  if (d.wing) { go(`inventory/${d.wing}`); return; }
  if (d.filter) { S.filter = (d.filter === 'all' || S.filter === d.filter) ? null : d.filter; render(); return; }
  if (d.status) { S.draft.status = d.status; render(); return; }
  if (d.act === 'close') { go(`inventory/${S.wing}`); return; }
  if (d.act === 'save') {
    const id = S.sel, before = getUnit(id).status;
    updateUnit(id, { status: S.draft.status, remarks: S.draft.remarks.trim() }, S.user.name);
    S.draft.remarks = S.draft.remarks.trim();
    toast(`${ICON.check}<span>Flat ${id} ${before === S.draft.status ? 'updated' : 'marked'} ${pill(S.draft.status)} · live on the website</span>`);
    render(); return;
  }
  if (d.act === 'logout') { saveSession(null); go('projects'); return; }
  if (d.act === 'reset') { if (confirm('Reset all flats to the starting demo data?')) { resetDemo(); toast('Demo data reset'); go('projects'); } }
});
app.addEventListener('input', e => {
  if (e.target.id !== 'rm' || !S.draft) return;
  S.draft.remarks = e.target.value;
  const u = getUnit(S.sel), btn = app.querySelector('[data-act="save"]');
  if (btn) btn.disabled = S.draft.status === u.status && S.draft.remarks === (u.remarks || '');
});
app.addEventListener('submit', e => {
  e.preventDefault();
  if (e.target.matches('[data-login]')) {
    const email = e.target.email.value.trim() || 'sales.manager@demo';
    saveSession({ email, name: nameFrom(email) });
    go('projects'); return;
  }
  if (e.target.matches('[data-search]')) {
    const q = e.target.q.value.trim().toUpperCase().replace(/\s+/g, '').replace(/^([AB])(\d)/, '$1-$2');
    const p = parseId(q);
    if (p) go(`inventory/${p.wing}/${q}`); else toast('Use a flat number like A-506 or B-302');
  }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && S.sel) go(`inventory/${S.wing}`); });
matchMedia('(max-width: 959px)').addEventListener('change', () => S.view === 'inventory' && render());

/* changes made in another tab (e.g. a colleague, or the website) */
subscribe(e => {
  if (!e.remote) return;
  if (S.sel && S.draft) { const u = getUnit(S.sel); if (e.type === 'reset' || e.id === S.sel) S.draft = { status: u.status, remarks: u.remarks || '' }; }
  if (document.activeElement && document.activeElement.id === 'rm') return; // don't interrupt typing
  render();
});
setInterval(() => { if (!(document.activeElement && document.activeElement.id === 'rm')) render(); }, 30000); // keep "x min ago" fresh

let tt = null;
function toast(html) { toastEl.innerHTML = html; toastEl.hidden = false; clearTimeout(tt); tt = setTimeout(() => { toastEl.hidden = true; }, 3200); }

route();
