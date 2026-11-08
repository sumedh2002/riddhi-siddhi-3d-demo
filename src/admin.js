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
const ICON = {
  building: '<svg class="i" viewBox="0 0 24 24"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 10h.01M15 10h.01M9 14h.01M15 14h.01M10 21v-3h4v3"/></svg>',
  out: '<svg class="i" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>',
  ext: '<svg class="i" viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  x: '<svg class="i" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  arrow: '<svg class="i" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  search: '<svg class="i" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  check: '<svg class="i" viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>',
  grid: '<svg class="i" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>'
};

const S = { user: loadSession(), view: 'login', wing: 'A', filter: null, sel: null, draft: null, confirmReset: false };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mobile = () => matchMedia('(max-width: 959px)').matches;
const parseId = id => { const m = /^([AB])-([1-7])(0[1-8])$/.exec(id || ''); return m ? { wing: m[1], floor: +m[2], n: m[3], key: m[1] + m[3] } : null; };
const st = s => `<span class="st"><i class="dot d-${s}"></i>${STATUS_LABEL[s]}</span>`;
function rel(t) {
  if (!t) return '';
  const s = (Date.now() - t) / 1000;
  if (s < 45) return 'just now';
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  if (s < 86400) return Math.round(s / 3600) + ' h ago';
  return new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short' });
}

/* ---------- session (demo: any email works; Supabase login replaces this) ---------- */
function loadSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { return null; } }
function saveSession(u) { try { if (u) localStorage.setItem(SESSION_KEY, JSON.stringify(u)); else localStorage.removeItem(SESSION_KEY); } catch (e) { /* storage blocked: session lasts for this page only */ } S.user = u; }
function nameFrom(email) {
  const local = String(email).split('@')[0].replace(/[._-]+/g, ' ').replace(/\d+/g, '').trim();
  return local ? local.replace(/\b\w/g, c => c.toUpperCase()) : 'Sales Manager';
}
const initials = n => n.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

/* ---------- routing: #projects · #inventory/A · #inventory/A/A-506 ---------- */
function route() {
  const [view, wing, id] = location.hash.replace(/^#\/?/, '').split('/');
  S.confirmReset = false;
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

/* ---------- shared pieces ---------- */
function statbar(c) {
  return `<div class="statbar" role="img" aria-label="${STATUSES.map(s => `${c[s]} ${STATUS_LABEL[s]}`).join(', ')}">${STATUSES.map(s => c[s] ? `<i class="${s}" style="flex:${c[s]}"></i>` : '').join('')}</div>`;
}
function countsRow(c) { return `<p class="counts">${STATUSES.map(s => `<span><i class="dot d-${s}"></i>${STATUS_LABEL[s]} <b class="num">${c[s]}</b></span>`).join('')}</p>`; }
function topbar() {
  const n = S.user.name;
  return `<header class="top"><div class="top-in">
    <a class="brand" href="#projects"><span class="mark">${ICON.building}</span><span class="brand-t"><b>Storey3D</b><small>Sales console</small></span></a>
    <div class="me"><span class="av" aria-hidden="true">${esc(initials(n))}</span><span class="who"><b>${esc(n)}</b><small>Sales manager</small></span>
      <button class="icon-btn" data-act="logout" title="Sign out" aria-label="Sign out">${ICON.out}</button></div>
  </div></header>`;
}
function activity(n, onlyId) {
  const items = recentLog(60).filter(e => !onlyId || e.id === onlyId).slice(0, n);
  if (!items.length) return `<p class="none">${onlyId ? 'No changes yet.' : 'Nothing yet. Updates you save will show here.'}</p>`;
  return `<ul class="acts">${items.map(e => `<li class="act ${onlyId ? 'compact' : ''}">
      ${onlyId ? '' : `<button class="act-id" data-unit="${e.id}">${e.id}</button>`}
      <span class="act-what">${e.from === e.to ? `Remarks updated · ${st(e.to)}` : `${STATUS_LABEL[e.from]} → ${st(e.to)}`}<span>· ${esc(e.by)}</span></span>
      <time datetime="${new Date(e.at).toISOString()}">${rel(e.at)}</time>
      ${e.remarks ? `<p class="act-rm">${esc(e.remarks)}</p>` : ''}
    </li>`).join('')}</ul>`;
}
function footer() {
  const total = counts().total;
  return `<footer class="foot">
    <p>Demo mode. Changes are saved in this browser and appear on the 3D website open in another tab.</p>
    <div class="reset">${S.confirmReset
      ? `<span>Reset all ${total} flats to the starting data?</span><button class="btn small danger" data-act="reset-yes">Reset</button><button class="btn small" data-act="reset-no">Cancel</button>`
      : `<button class="txt-link" data-act="reset">Reset demo data</button>`}</div>
  </footer>`;
}

/* ---------- views ---------- */
function loginView() {
  return `<main class="login"><div class="login-in">
    <div class="brand"><span class="mark">${ICON.building}</span><span class="brand-t"><b>Storey3D</b><small>Sales console</small></span></div>
    <div><h1>Sign in</h1><p class="muted">Update flat availability for the projects you manage.</p></div>
    <form data-login novalidate>
      <label class="field" for="email">Work email<input id="email" name="email" type="email" autocomplete="username" placeholder="you@yourcompany.com"></label>
      <label class="field" for="password">Password<input id="password" name="password" type="password" autocomplete="current-password"></label>
      <button class="btn primary block" type="submit">Sign in</button>
    </form>
    <p class="note">Demo: any email and password will work.</p>
  </div></main>`;
}
function projectsView() {
  const c = counts();
  return `${topbar()}<main class="page">
    <div class="ph"><div><p class="eyebrow">Hi ${esc(S.user.name.split(' ')[0])}</p><h1>Your projects</h1></div></div>
    <a class="proj" href="#inventory/A">
      <img src="${THUMB}" alt="">
      <div class="proj-b">
        <div class="proj-t"><h2>${esc(PROJECT.name)}</h2><span class="live"><i></i>Live on website</span></div>
        <p class="muted small">${esc(PROJECT.location)} · A &amp; B Wing · <span class="num">${c.total}</span> flats</p>
        ${statbar(c)}${countsRow(c)}
      </div>
      <span class="proj-go">Open inventory ${ICON.arrow}</span>
    </a>
    <section class="sec"><h3>Recent updates</h3>${activity(6)}</section>
    ${footer()}
  </main>`;
}
function inventoryView() {
  const c = counts({ wing: S.wing }), lu = lastUpdated();
  const chip = (key, label, n) => `<button class="chip ${S.filter === key || (!S.filter && key === 'all') ? 'on' : ''}" data-filter="${key}" aria-pressed="${S.filter === key || (!S.filter && key === 'all')}">${key !== 'all' ? `<i class="dot d-${key}"></i>` : ''}${label} <b class="num">${n}</b></button>`;
  return `${topbar()}<main class="page">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="#projects">Projects</a><span aria-hidden="true">/</span><span>${esc(PROJECT.name)}</span></nav>
    <div class="ph">
      <div><h1>${esc(PROJECT.name)}</h1><p class="muted small">${esc(PROJECT.location)} · ${lu ? `Last update ${rel(lu)}` : 'No updates yet'}</p></div>
      <a class="btn" href="index.html#explore" target="_blank" rel="noopener">${ICON.ext}View website</a>
    </div>
    <div class="toolbar">
      <div class="seg" role="tablist" aria-label="Wing">${['A', 'B'].map(w => `<button role="tab" aria-selected="${S.wing === w}" class="${S.wing === w ? 'on' : ''}" data-wing="${w}">${w} Wing</button>`).join('')}</div>
      <div class="chips" role="group" aria-label="Filter flats">${chip('all', 'All', c.total)}${STATUSES.map(s => chip(s, STATUS_LABEL[s], c[s])).join('')}</div>
      <form class="search" data-search role="search">${ICON.search}<label class="sr" for="q">Find a flat</label><input id="q" name="q" placeholder="Find flat, e.g. A-506" autocomplete="off"></form>
    </div>
    <div class="layout">
      <section class="board" aria-label="Inventory chart">
        <div class="board-h"><h2>Inventory chart · ${S.wing} Wing</h2><span class="muted small">Tap a flat to update it</span></div>
        ${chart()}
        <p class="legend">${STATUSES.map(s => `<span><i class="dot d-${s}"></i>${STATUS_LABEL[s]}</span>`).join('')}</p>
      </section>
      <aside class="panel">${S.sel && !mobile() ? editor() : emptyPanel()}</aside>
    </div>
    <section class="sec"><h3>Recent updates</h3>${activity(8)}</section>
    ${footer()}
  </main>
  ${S.sel && mobile() ? `<div class="sheet-bg" data-act="close"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="Update flat ${S.sel}">${editor()}</div>` : ''}`;
}
function chart() {
  let h = `<div class="chart-wrap"><table class="chart"><thead><tr><th scope="col"><span class="sr">Floor</span></th>${FLAT_NOS.map(n => `<th scope="col">${n}<small>${FLATS[S.wing + n].bhk} BHK</small></th>`).join('')}</tr></thead><tbody>`;
  for (let fl = NF; fl >= 1; fl--) {
    h += `<tr><th scope="row"><span class="fl-l">Floor </span><span class="fl-s">F</span>${fl}</th>`;
    for (const n of FLAT_NOS) {
      const id = `${S.wing}-${fl}${n}`, u = getUnit(id);
      const dim = S.filter && u.status !== S.filter;
      h += `<td><button class="cell st-${u.status}${S.sel === id ? ' sel' : ''}${dim ? ' dim' : ''}" data-unit="${id}" aria-label="Flat ${id}, ${STATUS_LABEL[u.status]}${u.remarks ? ', has remarks' : ''}">${fl}${n}${u.remarks ? '<i class="note"></i>' : ''}</button></td>`;
    }
    h += `</tr>`;
  }
  return h + `</tbody></table></div>`;
}
function emptyPanel() {
  return `<div class="empty-panel">${ICON.grid}<h2>Select a flat</h2><p class="muted small">Tap any flat in the chart to set its status and add a remark for your team. The website updates when you save.</p></div>`;
}
function editor() {
  const id = S.sel, p = parseId(id), F = FLATS[p.key], u = getUnit(id), d = S.draft;
  const dirty = d.status !== u.status || d.remarks !== (u.remarks || '');
  return `<div class="ed">
    <div class="ed-h"><div><p class="eyebrow">${p.wing} Wing · Floor ${p.floor}</p><h2 class="num">${id}</h2><p class="muted small">${F.bhk} BHK · ≈ ${F.carpet} sq ft · ${esc(F.view)}</p></div>
      <button class="icon-btn" data-act="close" aria-label="Close">${ICON.x}</button></div>
    <fieldset><legend class="lbl">Status</legend>
      <div class="opts" role="radiogroup" aria-label="Status">${STATUSES.map(s => `<button class="opt st-${s}${d.status === s ? ' on' : ''}" role="radio" aria-checked="${d.status === s}" data-status="${s}"><i class="dot d-${s}"></i>${STATUS_LABEL[s]}</button>`).join('')}</div>
    </fieldset>
    <div><label class="lbl" for="rm">Remarks</label>
      <textarea id="rm" maxlength="300" placeholder="e.g. Token received from Mr. Shah. Agreement on 12 Nov.">${esc(d.remarks)}</textarea>
      <p class="hint">Only your team sees remarks. Buyers see the status.</p></div>
    <div class="ed-foot">
      <button class="btn primary block" data-act="save" ${dirty ? '' : 'disabled'}>Save</button>
      <div class="ed-meta"><span>${u.updatedAt ? `Updated ${rel(u.updatedAt)} by ${esc(u.updatedBy)}` : 'No changes yet'}</span><a class="txt-link" href="index.html?flat=${id}#explore" target="_blank" rel="noopener">See in 3D ${ICON.ext}</a></div>
    </div>
    <div><p class="lbl">History</p>${activity(5, id)}</div>
  </div>`;
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
    const id = S.sel, remarks = S.draft.remarks.trim();
    updateUnit(id, { status: S.draft.status, remarks }, S.user.name);
    S.draft.remarks = remarks;
    toast(`${ICON.check}<span>${id} saved as ${STATUS_LABEL[S.draft.status]}. The website is updated.</span>`);
    render(); return;
  }
  if (d.act === 'logout') { saveSession(null); go('projects'); return; }
  if (d.act === 'reset') { S.confirmReset = true; render(); return; }
  if (d.act === 'reset-no') { S.confirmReset = false; render(); return; }
  if (d.act === 'reset-yes') { resetDemo(); S.confirmReset = false; toast(`${ICON.check}<span>Demo data reset.</span>`); go('projects'); }
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
    if (p) go(`inventory/${p.wing}/${q}`); else toast('Type a flat number like A-506 or B-302.');
  }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && S.sel) go(`inventory/${S.wing}`); });
matchMedia('(max-width: 959px)').addEventListener('change', () => S.view === 'inventory' && render());

/* changes made in another tab */
subscribe(e => {
  if (!e.remote) return;
  if (S.sel && S.draft && (e.type === 'reset' || e.id === S.sel)) { const u = getUnit(S.sel); S.draft = { status: u.status, remarks: u.remarks || '' }; }
  if (document.activeElement && document.activeElement.id === 'rm') return; // don't interrupt typing
  render();
});
setInterval(() => { if (!(document.activeElement && document.activeElement.id === 'rm')) render(); }, 30000); // keep "x min ago" fresh

let tt = null;
function toast(html) { toastEl.innerHTML = html; toastEl.hidden = false; clearTimeout(tt); tt = setTimeout(() => { toastEl.hidden = true; }, 3200); }

route();
