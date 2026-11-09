import { createViewer, DATA, statusOf, unitId } from './viewer.js';
import { subscribe, lastUpdated, counts, STATUSES, STATUS_LABEL } from './inventory.js';
import { PROJECT } from './project-data.js';

const { FLATS, NF } = DATA;
const root = document.getElementById('viewer');
const panel = root.querySelector('.v-body');
const crumbs = root.querySelector('.v-crumbs');
const labels = root.querySelector('.v-labels');
const tip = root.querySelector('.v-tip');
const hint = root.querySelector('.v-hint');
const needle = root.querySelector('.v-compass i');
const ST = STATUS_LABEL;
const toastEl = root.querySelector('.v-toast');
const flatsOfWing = w => Object.keys(FLATS).filter(k => FLATS[k].wing === w).sort();
const bhk = k => FLATS[k].bhk + ' BHK';
const shortName = PROJECT.short || PROJECT.name.replace(/\s+Apartments?$/i, '');
let v = null;
let topCam = false; // inside a flat: top-down camera on/off
// room labels in the furnished view: on by default on wide widgets, off on narrow ones (the flat stays clear)
const lblBtn = root.querySelector('.v-tools [data-act="labels"]');
const isPhone = () => root.clientWidth <= 820;
let labelsPref = null;
const labelsOn = () => labelsPref === null ? !isPhone() : labelsPref;
const planEl = root.querySelector('.v-plan');
function syncLabelMode() {
  const S = v.state, furn = S.mode === 'apt' && S.furnished;
  planEl.hidden = S.mode !== 'apt';
  planEl.querySelectorAll('button').forEach(b => { const on = (b.dataset.act === 'furn') === S.furnished; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  labels.classList.toggle('furn', furn);
  labels.classList.toggle('off', furn && !labelsOn());
  lblBtn.hidden = !furn;
  lblBtn.classList.toggle('on', furn && labelsOn());
  lblBtn.setAttribute('aria-pressed', String(furn && labelsOn()));
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const svg = d => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const ICON = {
  left: svg('<path d="M15 18l-6-6 6-6"/>'),
  right: svg('<path d="M9 18l6-6-6-6"/>'),
  up: svg('<path d="M18 15l-6-6-6 6"/>'),
  down: svg('<path d="M6 9l6 6 6-6"/>'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>')
};
const st = s => `<span class="w-st st-${s}"><i></i>${ST[s]}</span>`;
const badge = s => `<span class="w-st w-badge st-${s}"><i></i>${ST[s]}</span>`;
const clock = t => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const legend = `<div class="w-legend">${STATUSES.map(s => `<span><i class="w-sq s-${s}"></i>${ST[s]}</span>`).join('')}</div>`;
const brand = `<span class="w-brand">3D explorer by <b>Arch3</b></span>`;
const bar = c => `<span class="w-bar" aria-hidden="true">${STATUSES.map(s => c[s] ? `<i class="s-${s}" style="flex:${c[s]}"></i>` : '').join('')}</span>`;
function head(meta, title, sub, aside = '') {
  const t = lastUpdated();
  return `<div class="w-head"><div class="w-meta"><span>${meta}</span><span class="w-live" title="Availability is updated live by the sales team"><i></i>Live${t ? ' · ' + clock(t) : ''}</span></div>
    <div class="w-title"><h3>${title}</h3>${aside}</div>${sub ? `<p class="w-sub">${sub}</p>` : ''}</div>`;
}
const sec = (label, body, aside = '') => `<div class="w-sec">${label ? `<div class="w-lbl"><span>${label}</span>${aside ? `<span>${aside}</span>` : ''}</div>` : ''}${body}</div>`;

function keyPlan(w, f) {
  const xs = w === 'A' ? [0.6, 22.2] : [20.9, 42.6], sc = 9.2, H = 25.6 * sc, Wd = (xs[1] - xs[0]) * sc;
  let s = `<svg viewBox="0 0 ${Wd.toFixed(0)} ${H.toFixed(0)}" class="kp" style="aspect-ratio:${Wd.toFixed(0)}/${H.toFixed(0)}" role="img" aria-label="Key plan of ${w} wing, floor ${f}">`;
  for (const k of flatsOfWing(w)) {
    const F = FLATS[k], s0 = statusOf(unitId(w, f, F.n)), sel = v && v.state.flat === k;
    s += `<g class="kp-flat ${sel ? 'sel' : ''} kp-${s0}" data-flat="${k}">`;
    for (const r of F.rooms) s += `<rect x="${((r[2] - xs[0]) * sc).toFixed(1)}" y="${(r[3] * sc).toFixed(1)}" width="${((r[4] - r[2]) * sc).toFixed(1)}" height="${((r[5] - r[3]) * sc).toFixed(1)}"/>`;
    const cx = F.rooms.reduce((a, r) => a + (r[2] + r[4]) / 2, 0) / F.rooms.length, cy = F.rooms.reduce((a, r) => a + (r[3] + r[5]) / 2, 0) / F.rooms.length;
    s += `<text x="${((cx - xs[0]) * sc).toFixed(0)}" y="${(cy * sc + 3.5).toFixed(0)}">${f}${F.n}</text></g>`;
  }
  s += `<text class="kp-road" x="${Wd / 2}" y="${H - 2}">11 m road ↓</text></svg>`;
  const key = STATUSES.map(x => `<span><i class="w-sq k-${x}"></i>${ST[x]}</span>`).join('') + (v && v.state.flat && v.state.mode !== 'floor' ? '<span><i class="w-sq k-sel"></i>This flat</span>' : '');
  return `<div class="w-kp">${s}<div class="w-kp-key">${key}</div></div>`;
}

function render(keepScroll) {
  if (!v) return;
  const prevScroll = panel.scrollTop;
  const S = v.state, w = S.wing, f = S.floor, k = S.flat;
  if (S.mode !== 'apt') topCam = false;
  // crumbs
  const cr = [['home', shortName]];
  if (w) cr.push(['wing', `${w} Wing`]);
  if (f) cr.push(['floor', `Floor ${f}`]);
  if (k) cr.push(['flat', unitId(w, f, FLATS[k].n)]);
  crumbs.innerHTML = cr.map(([go, t], i) => `${i ? '<span class="sl" aria-hidden="true">/</span>' : ''}<button data-go="${go}"${i === cr.length - 1 ? ' aria-current="location"' : ''}>${t}</button>`).join('');
  let h = '';
  if (S.mode === 'site') {
    const all = counts();
    h = head(esc(PROJECT.location.split(',').slice(-2).join(',').trim()), esc(PROJECT.name), `${all.total} homes in ${PROJECT.wings.length} wings. Choose a wing to see its floors, or go straight to a flat.`)
      + sec('Go to a flat', `<form class="w-search" data-search role="search"><label class="w-sr" for="vq">Flat number</label><input id="vq" name="q" placeholder="Flat number, e.g. A-506" autocomplete="off" spellcheck="false" enterkeyhint="go"><button type="submit">Go${ICON.arrow}</button></form><p class="v-err" role="alert" hidden></p>`)
      + sec('Wings', `<div class="w-list">${PROJECT.wings.map(x => {
        const c = counts({ wing: x });
        return `<button class="w-wing" data-wing="${x}" aria-label="${x} Wing, ${c.available} of ${c.total} available"><span class="w-wing-id">${x}</span><span class="w-wing-t"><b>${x} Wing</b><small>${NF} floors · ${c.total} homes · 1 &amp; 2 BHK</small></span><span class="w-wing-n"><b>${c.available}</b><small>of ${c.total}</small></span>${ICON.right}${bar(c)}</button>`;
      }).join('')}</div>`, 'Available')
      + sec('All homes', `<div class="w-totals">${STATUSES.map(s => `<div><i class="w-sq s-${s}"></i>${ST[s]}<b>${all[s]}</b></div>`).join('')}</div>`)
      + `<div class="w-foot">${brand}</div>`;
  } else if (S.mode === 'wing') {
    const c = counts({ wing: w }), ks = flatsOfWing(w);
    let rows = '';
    for (let fl = NF; fl >= 1; fl--) {
      const ids = ks.map(x => unitId(w, fl, FLATS[x].n)), a = ids.filter(id => statusOf(id) === 'available').length;
      rows += `<button class="w-mx-r" data-floor="${fl}" aria-label="Floor ${fl}, ${a} available"><span class="fl">${String(fl).padStart(2, '0')}</span><span class="w-mx-c">${ids.map(id => `<i class="s-${statusOf(id)}" title="${id} · ${ST[statusOf(id)]}"></i>`).join('')}</span><span class="av${a ? '' : ' zero'}">${a}</span></button>`;
    }
    h = head(esc(PROJECT.name), `${w} Wing`, `${c.available} of ${c.total} homes available. Each row is a floor and each square a flat. Choose a floor.`)
      + sec('Stacking plan', `<div class="w-mx"><div class="w-mx-h" aria-hidden="true"><span>Floor</span><span class="w-mx-c">${ks.map(x => `<span>${FLATS[x].n}</span>`).join('')}</span><span>Avail.</span></div>${rows}</div>${legend}`)
      + `<div class="w-foot"><button class="w-btn ghost" data-go="home">${ICON.left}All wings</button>${brand}</div>`;
  } else if (S.mode === 'floor' || (S.mode === 'flat' && !k)) {
    const c = counts({ wing: w, floor: f });
    const step = `<div class="w-step" role="group" aria-label="Change floor"><button data-step="-1" aria-label="Floor below" title="Floor below" ${f <= 1 ? 'disabled' : ''}>${ICON.down}</button><button data-step="1" aria-label="Floor above" title="Floor above" ${f >= NF ? 'disabled' : ''}>${ICON.up}</button></div>`;
    h = head(`${w} Wing · X-ray view`, `Floor ${f}`, `${c.available} of ${c.total} available. Floors above are lifted away so you can see every home.`, step)
      + sec('Flats', `<div class="w-units">${flatsOfWing(w).map(x => { const id = unitId(w, f, FLATS[x].n), s0 = statusOf(id); return `<button class="w-unit u-${s0}" data-flat="${x}"><span class="r1"><b>${id}</b>${st(s0)}</span><small>${bhk(x)} · ≈ ${FLATS[x].carpet} sq ft</small></button>`; }).join('')}</div>`)
      + sec('Key plan', keyPlan(w, f))
      + `<div class="w-foot"><button class="w-btn ghost" data-go="wing">${ICON.left}${w} Wing</button>${brand}</div>`;
  } else if (S.mode === 'flat') {
    const F = FLATS[k], id = unitId(w, f, F.n), s0 = statusOf(id);
    h = head(`${w} Wing · Floor ${f}`, `Flat ${id}`, '', badge(s0))
      + sec('', `<dl class="w-dl"><div><dt>Type</dt><dd>${bhk(k)}</dd></div><div><dt>Carpet area*</dt><dd class="mono">≈ ${F.carpet} sq ft</dd></div><div><dt>Floor</dt><dd>${f} of ${NF}</dd></div><div><dt>Outlook</dt><dd>${esc(F.view)}</dd></div></dl>`)
      + sec('Position on the floor', `${keyPlan(w, f)}<p class="w-note">*Indicative, added up from the brochure's room sizes. Final carpet area as per the RERA agreement.</p>`)
      + `<div class="w-foot w-foot-2"><button class="w-btn" data-act="enquire">Enquire</button><button class="w-btn pri" data-act="explore">Explore inside${ICON.arrow}</button></div>`;
  } else if (S.mode === 'apt') {
    const F = FLATS[k], id = unitId(w, f, F.n), s0 = statusOf(id), on = c => c ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"';
    h = head(`Inside · ${bhk(k)} · ${w} Wing, floor ${f}`, `Flat ${id}`, '', badge(s0))
      + sec('Interior', `<div class="w-seg" role="group" aria-label="Interior"><button data-act="furn"${on(S.furnished)}>Pro · Furnished</button><button data-act="empty"${on(!S.furnished)}>Basic · Empty</button></div>
        <p class="w-note">${S.furnished ? 'Furniture is placed automatically from the floor plans. It is indicative, to show scale.' : 'The empty layout, with walls cut at 1.2 m so you can see into every room.'}</p>`)
      + sec('Camera', `<div class="w-seg" role="group" aria-label="Camera"><button data-act="v3d"${on(!topCam)}>3D view</button><button data-act="top"${on(topCam)}>Top down</button></div>`)
      + sec('Rooms', `<ul class="w-rooms">${F.rooms.map((r, i) => r[6] ? `<li data-room="${i}"><span>${esc(r[0])}</span><b>${esc(r[6])}</b></li>` : '').join('')}</ul>`, 'Size as per brochure')
      + `<div class="w-foot w-foot-2"><button class="w-btn" data-go="floor">${ICON.left}Floor ${f}</button><button class="w-btn pri" data-act="enquire">Enquire about ${id}</button></div>`;
  }
  panel.innerHTML = h;
  panel.scrollTop = keepScroll ? prevScroll : 0;
  buildLabels();
}

/* ---------- labels over the 3D ---------- */
let labelItems = [];
function buildLabels() {
  labels.innerHTML = ''; labelItems = [];
  const S = v.state;
  if (S.mode === 'floor') {
    for (const k of flatsOfWing(S.wing)) {
      const p = v.flatParts[k], el = document.createElement('button'), id = unitId(S.wing, S.floor, FLATS[k].n);
      el.className = 'pin pin-' + statusOf(id); el.innerHTML = `<i></i>${id.split('-')[1]}`; el.setAttribute('aria-label', `${id}, ${ST[statusOf(id)]}`); el.dataset.flat = k; labels.appendChild(el);
      labelItems.push({ el, pos: p.center.clone().setY(S.floor * 3 + 1.6) });
    }
  } else if (S.mode === 'flat') {
    const p = v.flatParts[S.flat], el = document.createElement('div');
    el.className = 'pin pin-big'; el.innerHTML = `<b>${unitId(S.wing, S.floor, FLATS[S.flat].n)}</b><span>${bhk(S.flat)}</span>`; labels.appendChild(el);
    labelItems.push({ el, pos: p.center.clone().setY(S.floor * 3 + 2.2) });
  } else if (S.mode === 'apt') {
    const rooms = FLATS[S.flat].rooms;
    v.flatParts[S.flat].rooms.forEach((r, i) => {
      if (!r.dim) return;
      const el = document.createElement('div'); el.className = 'rlabel'; el.dataset.room = i;
      el.innerHTML = `<b>${esc(r.name)}</b><span>${esc(r.dim)}</span>`; labels.appendChild(el);
      const q = rooms[i];
      labelItems.push({ el, pos: r.c.clone().setY(S.floor * 3 + 0.3), area: (q[4] - q[2]) * (q[5] - q[3]) });
    });
  }
  syncLabelMode();
}
function onFrame() {
  const cull = labels.classList.contains('furn'), placed = [];
  for (const it of labelItems) { it.p = v.project(it.pos); it.el.style.transform = `translate(${it.p.x.toFixed(1)}px, ${it.p.y.toFixed(1)}px) translate(-50%,-100%)`; }
  // in the furnished view, hide labels that would overlap a bigger room's label
  const order = cull ? labelItems.slice().sort((a, b) => (b.el.classList.contains('hot') - a.el.classList.contains('hot')) || (b.area - a.area)) : labelItems;
  for (const it of order) {
    let show = it.p.z < 1;
    if (show && cull && it.el.offsetWidth) {
      const w = it.el.offsetWidth + 6, h = it.el.offsetHeight + 4, r = [it.p.x - w / 2, it.p.y - h, it.p.x + w / 2, it.p.y];
      if (placed.some(q => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1])) show = false; else placed.push(r);
    }
    it.el.style.visibility = show ? 'visible' : 'hidden';
  }
  needle.style.transform = `rotate(${(-v.azimuth() * 180 / Math.PI).toFixed(1)}deg)`;
}
function onHover(h) {
  if (!h || (!h.wing && !h.flat)) { tip.hidden = true; return; }
  const r = root.getBoundingClientRect();
  if (h.wing) tip.innerHTML = `<b>${h.wing} Wing</b> · click to explore`;
  else { const S = v.state, id = unitId(FLATS[h.flat].wing, S.floor, FLATS[h.flat].n), st = statusOf(id); tip.innerHTML = `<b>${id}</b> · ${bhk(h.flat)} · ${ST[st]}`; }
  tip.style.left = (h.x - r.left + 14) + 'px'; tip.style.top = (h.y - r.top + 14) + 'px'; tip.hidden = false;
}
function onInteract() { hint.classList.add('gone'); root.classList.add('v-drag'); }
['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => root.querySelector('.v-canvas').addEventListener(ev, () => root.classList.remove('v-drag')));

/* ---------- panel events ---------- */
root.addEventListener('click', e => {
  const t = e.target.closest('button,[data-flat],[data-room]'); if (!t) return;
  const S = v.state, d = t.dataset;
  if (d.go === 'home') v.home();
  else if (d.go === 'wing') v.selectWing(S.wing);
  else if (d.go === 'floor') v.selectFloor(S.floor);
  else if (d.go === 'flat') v.selectFlat(S.flat);
  else if (d.wing) v.selectWing(d.wing);
  else if (d.floor) v.selectFloor(+d.floor);
  else if (d.step) { const nf = Math.min(NF, Math.max(1, S.floor + +d.step)); v.selectFloor(nf); }
  else if (d.flat) v.selectFlat(d.flat);
  else if (d.act === 'explore') { topCam = false; v.explore(); }
  else if (d.act === 'labels') { labelsPref = !labelsOn(); syncLabelMode(); onFrame(); return; }
  else if (d.room !== undefined && t.closest('.w-rooms')) { labels.querySelectorAll('.rlabel').forEach(l => l.classList.toggle('hot', l.dataset.room === d.room)); onFrame(); return; }
  else if (d.act === 'furn' || d.act === 'empty') { topCam = false; v.setFurnished(d.act === 'furn'); render(true); return; }
  else if (d.act === 'top' || d.act === 'v3d') { topCam = d.act === 'top'; topCam ? v.topView() : v.view3d(); t.parentElement.querySelectorAll('button').forEach(b => { b.classList.toggle('on', b === t); b.setAttribute('aria-pressed', String(b === t)); }); return; }
  else if (d.act === 'enquire') { enquire(unitId(S.wing, S.floor, FLATS[S.flat].n), bhk(S.flat)); return; }
  else if (d.act === 'zin') { v.zoom(0.75); return; }
  else if (d.act === 'zout') { v.zoom(1.33); return; }
  else if (d.act === 'reset') { v.reset(); return; }
  else if (d.act === 'full') { toggleFull(); return; }
  else return;
  hint.classList.add('gone');
  render();
});
function goToFlat(q) {
  const m = String(q).trim().toUpperCase().replace(/\s+/g, '').match(/^([AB])-?([1-7])(0[1-8])$/);
  if (!m) return false;
  const key = m[1] + m[3]; v.state.wing = m[1]; v.state.floor = +m[2]; v.selectFlat(key); hint.classList.add('gone'); render();
  return true;
}
root.addEventListener('submit', e => {
  if (!e.target.matches('[data-search]')) return;
  e.preventDefault();
  const err = panel.querySelector('.v-err');
  if (!goToFlat(e.target.q.value)) { err.hidden = false; err.textContent = 'Try a flat number like A-506 or B-302 (floors 1–7, flats 01–08).'; }
});

/* ---------- live availability from the sales console ---------- */
let toastTimer = null;
function toast(html) {
  toastEl.innerHTML = html; toastEl.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastEl.hidden = true; }, 4200);
}
subscribe(e => {
  if (!v) return;
  v.refresh(); render(true);
  if (e.type === 'unit' && e.remote) toast(`<b>Live update</b><span>Flat ${e.id} is now</span>${st(statusOf(e.id))}`);
  if (e.type === 'reset' && e.remote) toast('<b>Live update</b><span>Availability was reset</span>');
});
panel.addEventListener('pointerover', e => {
  const t = e.target.closest('[data-flat]'); if (t && (v.state.mode === 'floor' || v.state.mode === 'flat')) v.setHoverFlat(t.dataset.flat);
  const r = e.target.closest('[data-room]'); labels.querySelectorAll('.rlabel').forEach(l => l.classList.toggle('hot', r && l.dataset.room === r.dataset.room));
});
panel.addEventListener('pointerout', e => { if (e.target.closest('[data-flat]')) v.setHoverFlat(null); });

/* ---------- full screen (native where supported, CSS fallback for iPhone) ---------- */
const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
const fullBtn = root.querySelector('.v-tools [data-act="full"]');
const ICON_EXPAND = '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
const ICON_SHRINK = '<svg viewBox="0 0 24 24"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';
function setFull(on) {
  root.classList.toggle('v-full', on);
  document.documentElement.classList.toggle('v-lock', on);
  fullBtn.innerHTML = on ? ICON_SHRINK : ICON_EXPAND;
  fullBtn.setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen');
}
function toggleFull() {
  if (fsEl()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
  if (root.classList.contains('v-full')) { setFull(false); return; }
  setFull(true);
  const req = root.requestFullscreen || root.webkitRequestFullscreen;
  if (req) { try { const p = req.call(root); if (p && p.catch) p.catch(() => {}); } catch (e) { /* CSS full screen stays on */ } }
}
const onFsChange = () => { if (!fsEl() && root.classList.contains('v-full') && root.dataset.native === '1') setFull(false); root.dataset.native = fsEl() ? '1' : ''; };
document.addEventListener('fullscreenchange', onFsChange);
document.addEventListener('webkitfullscreenchange', onFsChange);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && root.classList.contains('v-full') && !fsEl()) setFull(false); });

/* ---------- enquiry integration ---------- */
function enquire(id, type) {
  if (fsEl()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  if (root.classList.contains('v-full')) setFull(false);
  const f = document.getElementById('enquiry');
  f.unit.value = id; f.type.value = type;
  document.getElementById('enquire').scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => f.name.focus({ preventScroll: true }), 700);
}
document.querySelectorAll('[data-demo]').forEach(b => b.addEventListener('click', () => {
  const [key, fl] = b.dataset.demo.split('@');
  document.getElementById('explore').scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => { v.state.wing = FLATS[key].wing; v.state.floor = +fl; v.selectFlat(key); render(); setTimeout(() => { v.explore(); render(); }, 1500); }, 600);
}));
const form = document.getElementById('enquiry');
form.addEventListener('submit', e => {
  e.preventDefault();
  const d = Object.fromEntries(new FormData(form));
  const out = document.getElementById('lead');
  out.hidden = false;
  out.innerHTML = `<p class="lead-h">Demo: lead captured</p><dl><div><dt>Name</dt><dd>${esc(d.name || '—')}</dd></div><div><dt>Phone</dt><dd>${esc(d.phone || '—')}</dd></div><div><dt>Interested in</dt><dd>${esc(d.unit || d.type || '—')}</dd></div><div><dt>Source</dt><dd>${d.unit ? '3D explorer' : 'Website form'}</dd></div></dl><p class="lead-f">On a live site this goes straight to the builder's CRM with the flat number attached. Nothing was sent from this demo.</p>`;
  out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

/* ---------- header menu ---------- */
const mb = document.getElementById('menu-btn'), nav = document.getElementById('site-nav');
mb.addEventListener('click', () => { const o = nav.classList.toggle('open'); mb.setAttribute('aria-expanded', o); });
nav.addEventListener('click', e => { if (e.target.closest('a')) { nav.classList.remove('open'); mb.setAttribute('aria-expanded', 'false'); } });

/* ---------- boot ---------- */
const theme = new URLSearchParams(location.search).get('theme'); // ?theme=dark for embeds on dark pages
if (theme === 'dark' || theme === 'light') root.dataset.theme = theme;
if (window.matchMedia && matchMedia('(pointer: coarse)').matches) hint.textContent = 'Drag to rotate · Pinch to zoom · Tap a wing';
try {
  v = createViewer(root, { onMode: () => {}, onSelect: render, onHover, onFrame: () => v && onFrame(), onInteract });
  render();
  window.__viewer = v;
  const qs = new URLSearchParams(location.search), deep = qs.get('flat'); // e.g. ?flat=A-506&inside=1 (links from the sales console)
  if (deep) {
    document.getElementById('explore').scrollIntoView();
    setTimeout(() => { if (goToFlat(deep) && qs.get('inside')) setTimeout(() => { v.explore(); render(); }, 1500); }, 300);
  }
} catch (err) {
  root.classList.add('v-failed');
  root.querySelector('.v-fallback').hidden = false;
  console.error(err);
}
