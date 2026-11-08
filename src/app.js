import { createViewer, DATA, statusOf, unitId } from './viewer.js';
import { subscribe, lastUpdated, STATUS_LABEL } from './inventory.js';

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
let v = null;

function availCount(w, f) { return flatsOfWing(w).filter(k => statusOf(unitId(w, f, FLATS[k].n)) === 'available').length; }
function wingAvail(w) { let s = 0; for (let f = 1; f <= NF; f++) s += availCount(w, f); return s; }
const chip = st => `<span class="chip chip-${st}">${ST[st]}</span>`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function keyPlan(w, f) {
  const xs = w === 'A' ? [0.6, 22.2] : [20.9, 42.6], sc = 9.2, H = 25.6 * sc, Wd = (xs[1] - xs[0]) * sc;
  let s = `<svg viewBox="0 0 ${Wd.toFixed(0)} ${H.toFixed(0)}" class="kp" role="img" aria-label="Key plan of ${w} wing, floor ${f}">`;
  s += `<rect x="0" y="0" width="${Wd}" height="${H}" fill="none"/>`;
  for (const k of flatsOfWing(w)) {
    const F = FLATS[k], st = statusOf(unitId(w, f, F.n)), sel = v && v.state.flat === k;
    s += `<g class="kp-flat ${sel ? 'sel' : ''} kp-${st}" data-flat="${k}">`;
    for (const r of F.rooms) s += `<rect x="${((r[2] - xs[0]) * sc).toFixed(1)}" y="${(r[3] * sc).toFixed(1)}" width="${((r[4] - r[2]) * sc).toFixed(1)}" height="${((r[5] - r[3]) * sc).toFixed(1)}"/>`;
    const cx = F.rooms.reduce((a, r) => a + (r[2] + r[4]) / 2, 0) / F.rooms.length, cy = F.rooms.reduce((a, r) => a + (r[3] + r[5]) / 2, 0) / F.rooms.length;
    s += `<text x="${((cx - xs[0]) * sc).toFixed(0)}" y="${(cy * sc + 4).toFixed(0)}">${f}${F.n}</text></g>`;
  }
  s += `<text class="kp-road" x="${Wd / 2}" y="${H - 2}">11 m road ↓</text></svg>`;
  return s;
}

function render(keepScroll) {
  if (!v) return;
  const prevScroll = panel.scrollTop;
  const S = v.state, w = S.wing, f = S.floor, k = S.flat;
  // crumbs
  let c = `<button data-go="home">Project</button>`;
  if (w) c += `<span>›</span><button data-go="wing">${w} Wing</button>`;
  if (f) c += `<span>›</span><button data-go="floor">Floor ${f}</button>`;
  if (k) c += `<span>›</span><button data-go="flat">${unitId(w, f, FLATS[k].n)}</button>`;
  crumbs.innerHTML = c;
  let h = '';
  if (S.mode === 'site') {
    h = `<p class="v-eyebrow">3D explorer</p><h3>Find your home</h3><p class="v-sub">Pick a wing, then your floor and flat. Or type your flat number.</p>
    <form class="v-search" data-search><label class="sr" for="vq">Flat number</label><input id="vq" name="q" placeholder="e.g. A-506" autocomplete="off"><button type="submit">Go</button></form><p class="v-err" hidden></p>
    <div class="v-wings">${['A', 'B'].map(x => `<button class="v-wing" data-wing="${x}"><span class="v-wing-n">${x}</span><span><strong>${x} Wing</strong><small>7 floors · 8 homes per floor · 1 &amp; 2 BHK</small></span><em>${wingAvail(x)} available</em></button>`).join('')}</div>
    <div class="v-legend"><span><i class="d-available"></i>Available</span><span><i class="d-hold"></i>On hold</span><span><i class="d-booked"></i>Booked</span><span><i class="d-sold"></i>Sold</span></div>
    <p class="v-live"><i></i>Availability is updated live by the sales team${lastUpdated() ? ` · last change ${new Date(lastUpdated()).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}</p>`;
  } else if (S.mode === 'wing') {
    h = `<p class="v-eyebrow">${w} Wing</p><h3>Select your floor</h3><p class="v-sub">Each floor has 8 homes. Dots show what's available.</p><div class="v-floors">`;
    for (let fl = NF; fl >= 1; fl--) {
      h += `<button class="v-floor" data-floor="${fl}"><strong>Floor ${fl}</strong><span class="dots">${flatsOfWing(w).map(x => `<i class="d-${statusOf(unitId(w, fl, FLATS[x].n))}"></i>`).join('')}</span><em>${availCount(w, fl)} available</em></button>`;
    }
    h += `</div>`;
  } else if (S.mode === 'floor' || (S.mode === 'flat' && !k)) {
    h = `<div class="v-row"><div><p class="v-eyebrow">${w} Wing · X-ray view</p><h3>Floor ${f}</h3></div><div class="v-step"><button data-step="-1" aria-label="Floor below" ${f <= 1 ? 'disabled' : ''}>−</button><button data-step="1" aria-label="Floor above" ${f >= NF ? 'disabled' : ''}>+</button></div></div>
    <p class="v-sub">Floors above are lifted away so you can see every home on this floor. Tap a flat.</p>
    <div class="v-grid">${flatsOfWing(w).map(x => { const id = unitId(w, f, FLATS[x].n), st = statusOf(id); return `<button class="v-unit u-${st}" data-flat="${x}"><strong>${id}</strong><small>${bhk(x)} · ≈${FLATS[x].carpet} sq ft</small>${chip(st)}</button>`; }).join('')}</div>
    <p class="v-label">Key plan</p>${keyPlan(w, f)}`;
  } else if (S.mode === 'flat') {
    const F = FLATS[k], id = unitId(w, f, F.n), st = statusOf(id);
    h = `<div class="v-row"><div><p class="v-eyebrow">${w} Wing · Floor ${f}</p><h3>Flat ${id}</h3></div>${chip(st)}</div>
    <dl class="v-facts"><div><dt>Home</dt><dd>${bhk(k)}</dd></div><div><dt>Carpet*</dt><dd>≈ ${F.carpet} sq ft</dd></div><div><dt>Floor</dt><dd>${f} of ${NF}</dd></div><div><dt>Outlook</dt><dd>${F.view}</dd></div></dl>
    <button class="v-btn v-btn-primary" data-act="explore">Explore inside in 3D <span aria-hidden="true">→</span></button>
    <button class="v-btn" data-act="enquire">Enquire about ${id}</button>
    <p class="v-label">Where it sits on the floor</p>${keyPlan(w, f)}
    <p class="v-note">*Indicative, added up from the brochure's room sizes. Final carpet area as per the RERA agreement.</p>`;
  } else if (S.mode === 'apt') {
    const F = FLATS[k], id = unitId(w, f, F.n), st = statusOf(id);
    h = `<div class="v-row"><div><p class="v-eyebrow">Inside · ${bhk(k)}</p><h3>Flat ${id}</h3></div>${chip(st)}</div>
    <div class="v-seg" role="group" aria-label="Camera"><button data-act="v3d" class="on">3D view</button><button data-act="top">Top view</button></div>
    <ul class="v-rooms">${F.rooms.map((r, i) => r[6] ? `<li data-room="${i}"><span>${esc(r[0])}</span><b>${esc(r[6])}</b></li>` : '').join('')}</ul>
    <p class="v-note">Walls are cut at 1.2 m so you can see the full layout. Room sizes as printed in the brochure. Shown unfurnished.</p>
    <button class="v-btn v-btn-primary" data-act="enquire">Enquire about ${id}</button>
    <button class="v-btn" data-go="floor">← Back to floor ${f}</button>`;
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
      el.className = 'pin pin-' + statusOf(id); el.textContent = id.split('-')[1]; el.dataset.flat = k; labels.appendChild(el);
      labelItems.push({ el, pos: p.center.clone().setY(S.floor * 3 + 1.6) });
    }
  } else if (S.mode === 'flat') {
    const p = v.flatParts[S.flat], el = document.createElement('div');
    el.className = 'pin pin-big'; el.innerHTML = `<b>${unitId(S.wing, S.floor, FLATS[S.flat].n)}</b> ${bhk(S.flat)}`; labels.appendChild(el);
    labelItems.push({ el, pos: p.center.clone().setY(S.floor * 3 + 2.2) });
  } else if (S.mode === 'apt') {
    v.flatParts[S.flat].rooms.forEach((r, i) => {
      if (!r.dim) return;
      const el = document.createElement('div'); el.className = 'rlabel'; el.dataset.room = i;
      el.innerHTML = `<b>${esc(r.name)}</b><span>${esc(r.dim)}</span>`; labels.appendChild(el);
      labelItems.push({ el, pos: r.c.clone().setY(S.floor * 3 + 0.3) });
    });
  }
}
function onFrame() {
  for (const it of labelItems) {
    const p = v.project(it.pos);
    it.el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%,-100%)`;
    it.el.style.visibility = p.z < 1 ? 'visible' : 'hidden';
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
function onInteract() { hint.classList.add('gone'); }

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
  else if (d.act === 'explore') v.explore();
  else if (d.act === 'top') { v.topView(); t.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === t)); return; }
  else if (d.act === 'v3d') { v.view3d(); t.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === t)); return; }
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
  if (e.type === 'unit' && e.remote) toast(`<b>Live update</b> · Flat ${e.id} is now <span class="chip chip-${statusOf(e.id)}">${ST[statusOf(e.id)]}</span>`);
  if (e.type === 'reset' && e.remote) toast('<b>Live update</b> · Availability was reset');
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
if (window.matchMedia && matchMedia('(pointer: coarse)').matches) hint.textContent = 'Drag to rotate · Pinch to zoom · Tap a wing';
try {
  v = createViewer(root, { onMode: () => {}, onSelect: render, onHover, onFrame: () => v && onFrame(), onInteract });
  render();
  window.__viewer = v;
  const deep = new URLSearchParams(location.search).get('flat'); // e.g. ?flat=A-506 (links from the sales console)
  if (deep) { document.getElementById('explore').scrollIntoView(); setTimeout(() => goToFlat(deep), 300); }
} catch (err) {
  root.classList.add('v-failed');
  root.querySelector('.v-fallback').hidden = false;
  console.error(err);
}
