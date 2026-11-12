import { createViewer, DATA, statusOf, unitId } from './viewer.js';
import { subscribe, lastUpdated, counts, STATUSES, STATUS_LABEL } from './inventory.js';
import { PROJECT, flatOn, FLOOR_AMENITY } from './project-data.js';
import { PREMIUM, PREMIUM_SITE, PREMIUM_FINISHES, FACE_KEYS, premiumSet } from './premium.js';
import { createPano } from './pano.js';
import { SITE, RADII, CATS, PLACES } from './nearby.js';
import { osmTiles, googleTiles, templateTiles, fmtDist, fmtRing } from './mapground.js';
import { GOOGLE_MAPS_KEY, MAP_TILES, MAP } from './config.js';

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
const flatsOn = (w, f) => flatsOfWing(w).filter(k => flatOn(k, f)); // the flats that exist on a floor
const amenityOn = (k, f) => (FLOOR_AMENITY[f] || {})[k];
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
/* Premium 360° walkthrough (only for flats that have panoramas, see premium.js) */
const photoEl = root.querySelector('.v-photo'), roomsBar = photoEl.querySelector('.v-photo-rooms');
const premBtn = planEl.querySelector('[data-act="premium"]');
const prem = { on: false, view: null, tod: 'day', fin: 'tile', nextYaw: undefined };
const premData = () => { const S = v.state; return (S.mode === 'apt' && S.flat && PREMIUM[S.flat]) || null; };
const premView = P => P.views.find(x => x.id === prem.view) || P.views.find(x => x.id === P.start);
const faceUrls = (P, prefix) => Object.fromEntries(FACE_KEYS.map(f => [f, `${P.dir}360/${prefix}-${f}.jpg`]));
const yawTo = (a, b) => Math.atan2(-(b[0] - a[0]), -(b[1] - a[1])); // plan x → east, plan y → south; yaw 0 looks north
let pano = null, panoKey = '';
function showPhoto() {
  const P = premData(); if (!P) return;
  if (!pano) pano = createPano(photoEl, { onSpot: walkTo, onFrame: turnMini, onInteract: () => photoEl.classList.add('used'), onError: () => toast('<b>Could not load the 360° view</b><span>Check the connection and try again</span>') });
  const view = premView(P), set = premiumSet(view, prem.tod, prem.fin);
  prem.view = view.id;
  buildMini(P, v.state.flat, view);
  roomsBar.innerHTML = P.views.map(x => `<button data-view="${x.id}"${x.id === view.id ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"'}>${esc(x.name)}</button>`).join('');
  const key = P.dir + set.prefix;
  if (key === panoKey && prem.nextYaw === undefined) return;
  const first = !panoKey; panoKey = key;
  const spots = view.links.map(l => ({ key: l.to, label: P.views.find(x => x.id === l.to).name, dir: [l.at[0] - view.p[0], -1.45, l.at[1] - view.p[1]] }));
  pano.show(faceUrls(P, set.prefix), spots, { yaw: prem.nextYaw !== undefined ? prem.nextYaw : first ? yawTo(view.p, view.look) : undefined, fade: !first });
  prem.nextYaw = undefined;
  for (const l of view.links) { const t = P.views.find(x => x.id === l.to); pano.preload(faceUrls(P, premiumSet(t, prem.tod, prem.fin).prefix)); }
}
/* mini floor plan on the 360 view: where you stand and which way you face */
const mini = document.createElement('div'); mini.className = 'v-mini'; photoEl.appendChild(mini);
let miniCone = null, miniAt = null;
function buildMini(P, k, view) {
  const R = FLATS[k].rooms, xs = R.flatMap(r => [r[2], r[4]]), ys = R.flatMap(r => [r[3], r[5]]);
  const x0 = Math.min(...xs) - 0.35, y0 = Math.min(...ys) - 0.35, w = Math.max(...xs) + 0.35 - x0, h = Math.max(...ys) + 0.35 - y0, n = x => x.toFixed(2);
  mini.innerHTML = `<svg viewBox="${n(x0)} ${n(y0)} ${n(w)} ${n(h)}" role="img" aria-label="Floor plan: you are in the ${esc(view.name.toLowerCase())}">`
    + R.map((r, i) => `<rect x="${n(r[2])}" y="${n(r[3])}" width="${n(r[4] - r[2])}" height="${n(r[5] - r[3])}"${i === view.room ? ' class="cur"' : ''}/>`).join('')
    + `<g class="cone"><path d="M0 0 L-1.15 -1.65 A2 2 0 0 1 1.15 -1.65 Z"/></g>`
    + P.views.filter(x => x.id !== view.id).map(x => `<circle class="pt" data-view="${x.id}" cx="${n(x.p[0])}" cy="${n(x.p[1])}" r="0.24"><title>${esc(x.name)}</title></circle>`).join('')
    + `<circle class="me" cx="${n(view.p[0])}" cy="${n(view.p[1])}" r="0.28"/></svg><span>AI visualisation · indicative</span>`;
  miniCone = mini.querySelector('.cone'); miniAt = view.p;
  if (pano) turnMini(pano.yaw);
}
function turnMini(yaw) { if (miniCone) miniCone.setAttribute('transform', `translate(${miniAt[0]} ${miniAt[1]}) rotate(${(-yaw * 180 / Math.PI).toFixed(1)})`); }
function walkTo(id, faceLook) {
  const P = premData(); if (!P) return;
  const from = premView(P), to = P.views.find(x => x.id === id); if (!to || to === from) return;
  prem.view = id; prem.nextYaw = faceLook ? yawTo(to.p, to.look) : yawTo(from.p, to.p); // walking keeps you facing the way you moved
  render(true);
}
/* photo-real orbit of the building (Premium, project view) */
const orbEl = root.querySelector('.v-orbit'), orbImgs = [...orbEl.querySelectorAll('img')], ORB_N = PREMIUM_SITE ? PREMIUM_SITE.frames.length : 0;
const orbPrev = orbEl.querySelector('.v-orb-prev'), orbNext = orbEl.querySelector('.v-orb-next');
let orbDir = 1, orbK = PREMIUM_SITE ? PREMIUM_SITE.start : 0, orbShown = -1, orbAll = false, orbTimer = null, orbDrag = null;
const orbUrl = k => `${PREMIUM_SITE.dir}${PREMIUM_SITE.frames[k]}.jpg`;
function showOrb() {
  orbPrev.disabled = !PREMIUM_SITE.loop && orbK <= 0; orbNext.disabled = !PREMIUM_SITE.loop && orbK >= ORB_N - 1;
  if (orbShown === orbK) return;
  const k = orbK, cur = orbImgs.find(i => i.classList.contains('on')) || orbImgs[1], nxt = cur === orbImgs[0] ? orbImgs[1] : orbImgs[0];
  nxt.onload = () => { if (orbK !== k) return; nxt.classList.add('on'); cur.classList.remove('on'); };
  nxt.alt = `${PROJECT.name}, view ${k + 1} of ${ORB_N} (AI visualisation)`; nxt.src = orbUrl(k); orbShown = k;
  if (!orbAll) { orbAll = true; setTimeout(() => { for (let i = 0; i < ORB_N; i++) new Image().src = orbUrl(i); }, 600); }
}
function stepOrb(d) { const n = PREMIUM_SITE.loop ? (orbK + d + ORB_N) % ORB_N : Math.max(0, Math.min(ORB_N - 1, orbK + d)); if (n === orbK) return false; orbK = n; showOrb(); return true; }
function orbUsed() { orbEl.classList.add('used'); clearInterval(orbTimer); orbTimer = null; }
orbEl.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; orbDrag = e.clientX; orbEl.classList.add('drag'); orbUsed(); try { orbEl.setPointerCapture(e.pointerId); } catch (err) { /* ok */ } });
orbEl.addEventListener('pointermove', e => { if (orbDrag === null) return; const dx = e.clientX - orbDrag, step = Math.max(40, orbEl.clientWidth / 14); if (Math.abs(dx) >= step) { stepOrb(dx < 0 ? 1 : -1); orbDrag = e.clientX; } });
['pointerup', 'pointercancel'].forEach(ev => orbEl.addEventListener(ev, () => { orbDrag = null; orbEl.classList.remove('drag'); }));
/* ---------- Nearby: zoom out of the building to see what is around it (project view) ----------
   The 3D building stands on the real map (mapground.js). Past NEAR_IN metres the neighbourhood takes over:
   landmark pins, the distance rings and the list of what lies inside the ring that is in view. */
const nearBtn = root.querySelector('.v-nearbtn'), radiiEl = root.querySelector('.v-radii'), attrEl = root.querySelector('.v-attr'), compass = root.querySelector('.v-compass');
radiiEl.innerHTML = RADII.map(km => `<button data-near-r="${km}" aria-pressed="false">${fmtRing(km)}</button>`).join('');
const near = { on: false, r: RADII[0], off: new Set(), sel: null };
const NEAR_IN = 300, NEAR_OUT = 235; // camera distance at which the neighbourhood takes over from the building, and hands back
const ringFor = D => RADII.filter(km => v.ringDist(km * 1000) <= D * 1.12).pop() || RADII[0]; // the largest ring that is fully in view
function openNear(km) { // km given: fly out to that ring. Not given: the visitor zoomed out by hand, so follow the camera.
  if (!v.mapOn) return;
  near.on = true; near.sel = null; near.r = km || ringFor(v.dist());
  hint.classList.add('gone'); v.setAutoRotate(false); v.setRing(near.r);
  if (km) v.frameRing(km * 1000);
  render();
}
function closeNear(fly) { if (!near.on) return; near.on = false; near.sel = null; v.setRing(null); if (fly) v.reset(); render(); }
function showRing(km) { if (!near.on) { openNear(km); return; } near.r = km; v.setRing(km); v.frameRing(km * 1000, 1100); render(true); }
function nearTick() { // every frame in the project view: the camera's distance decides what is on screen
  const D = v.dist(), fly = v.flying();
  if (!near.on) { if (!fly && D > NEAR_IN) openNear(); return; }
  if (fly) return;
  if (D < NEAR_OUT) { closeNear(false); return; }
  const r = ringFor(D); if (r !== near.r) { near.r = r; v.setRing(r); render(true); }
}
function pickPlace(id) {
  const p = PLACES.find(x => x.id === id); if (!p) return;
  near.sel = near.sel === id ? null : id;
  const need = RADII.find(km => p.d <= km * 1000);
  if (near.sel && need && need > near.r) { near.r = need; v.setRing(need); v.frameRing(need * 1000, 1100); } // bring it into view
  render(true);
}
function nearPanel() {
  const on = c => c ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"', inR = p => p.d <= near.r * 1000;
  const vis = PLACES.filter(p => !near.off.has(p.c)), ins = vis.filter(inR), out = vis.filter(p => !inR(p));
  const row = p => `<li><button data-place="${p.id}"${on(near.sel === p.id)} style="--c:${CATS[p.c].color}"><i><svg viewBox="0 0 24 24">${CATS[p.c].icon}</svg></i><span><b>${esc(p.n)}</b><small>${esc(p.note)}</small></span><em>${fmtDist(p.d)}</em></button></li>`;
  const list = a => a.length ? `<ul class="w-places">${a.map(row).join('')}</ul>` : '<p class="w-note" style="margin:0">Nothing from the chosen categories here. Try a wider radius.</p>';
  const chips = Object.keys(CATS).filter(c => PLACES.some(p => p.c === c)).map(c => `<button data-near-cat="${c}"${on(!near.off.has(c))} style="--c:${CATS[c].color}"><i></i>${CATS[c].label}<b>${PLACES.filter(p => p.c === c && inR(p)).length}</b></button>`).join('');
  return head(esc(SITE.area), 'What’s nearby', `${ins.length} place${ins.length === 1 ? '' : 's'} within ${fmtRing(near.r)} of ${esc(shortName)}. Zoom in and out, or pick a distance.`)
    + sec('Distance from the building', `<div class="w-seg" role="group" aria-label="Distance from the building">${RADII.map(km => `<button data-near-r="${km}"${on(near.r === km)}>${fmtRing(km)}</button>`).join('')}</div>`)
    + sec('Show', `<div class="w-chips" role="group" aria-label="Show on the map">${chips}</div>`, `within ${fmtRing(near.r)}`)
    + sec(`Within ${fmtRing(near.r)}`, list(ins), 'Straight-line distance')
    + (out.length ? sec('Further out', list(out)) : '')
    + `<div class="w-foot"><button class="w-btn ghost" data-act="near">${ICON.left}3D building</button>${brand}</div>`;
}
function syncLabelMode() {
  const S = v.state, P = premData(), pv = prem.on && !!P, nr = near.on && S.mode === 'site', orb = prem.on && S.mode === 'site' && !!PREMIUM_SITE && !nr;
  const furn = S.mode === 'apt' && S.furnished && !pv, tier = pv || orb ? 'premium' : S.furnished ? 'furn' : 'empty';
  planEl.hidden = nr || !(S.mode === 'apt' || (S.mode === 'site' && PREMIUM_SITE));
  root.classList.toggle('v-nr', nr); radiiEl.hidden = !nr; nearBtn.hidden = S.mode !== 'site' || !v.mapOn;
  nearBtn.classList.toggle('on', nr); nearBtn.setAttribute('aria-pressed', String(nr)); nearBtn.lastElementChild.textContent = nr ? '3D building' : 'Nearby';
  radiiEl.querySelectorAll('button').forEach(b => { const on = +b.dataset.nearR === near.r; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  compass.title = nr ? 'North' : 'Direction of the 11 m road';
  premBtn.hidden = !(P || (S.mode === 'site' && PREMIUM_SITE));
  root.classList.toggle('v-orb', orb); orbEl.hidden = !orb;
  if (orb) { showOrb(); v.setAutoRotate(false); if (!orbTimer && !orbEl.classList.contains('used')) orbTimer = setInterval(() => { if (!stepOrb(orbDir)) { orbDir = -orbDir; stepOrb(orbDir); } }, 2600); }
  else if (orbTimer) { clearInterval(orbTimer); orbTimer = null; }
  planEl.querySelectorAll('button').forEach(b => { const on = b.dataset.act === tier; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  root.classList.toggle('v-prem', pv);
  photoEl.hidden = !pv;
  if (pv) showPhoto();
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
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  pin: svg('<path d="M12 21s-6.5-5.6-6.5-10.5a6.5 6.5 0 0 1 13 0C18.500 15.400 12 21 12 21z"/><circle cx="12" cy="10.500" r="2.300"/>')
};
const st = s => `<span class="w-st st-${s}"><i></i>${ST[s]}</span>`;
const badge = s => `<span class="w-st w-badge st-${s}"><i></i>${ST[s]}</span>`;
// The time of the last availability change, not the current time: today shows the time, older shows the date.
const clock = t => { const d = new Date(t), today = d.toDateString() === new Date().toDateString();
  return 'updated ' + (today ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString([], { day: 'numeric', month: 'short' })); };
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
    const F = FLATS[k], s0 = statusOf(unitId(w, f, F.n)), sel = v && v.state.flat === k, on = flatOn(k, f), am = amenityOn(k, f);
    if (!on && !am) continue; // not built on this floor
    s += on ? `<g class="kp-flat ${sel ? 'sel' : ''} kp-${s0}" data-flat="${k}">` : `<g class="kp-am">`;
    for (const r of F.rooms) s += `<rect x="${((r[2] - xs[0]) * sc).toFixed(1)}" y="${(r[3] * sc).toFixed(1)}" width="${((r[4] - r[2]) * sc).toFixed(1)}" height="${((r[5] - r[3]) * sc).toFixed(1)}"/>`;
    const cx = F.rooms.reduce((a, r) => a + (r[2] + r[4]) / 2, 0) / F.rooms.length, cy = F.rooms.reduce((a, r) => a + (r[3] + r[5]) / 2, 0) / F.rooms.length;
    s += `<text x="${((cx - xs[0]) * sc).toFixed(0)}" y="${(cy * sc + 3.5).toFixed(0)}">${on ? f + F.n : esc(am.split(' ')[0])}</text></g>`;
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
  if (S.mode !== 'site' && near.on) { near.on = false; near.sel = null; v.setRing(null); }
  // crumbs
  const cr = [['home', shortName]];
  if (w) cr.push(['wing', `${w} Wing`]);
  if (f) cr.push(['floor', `Floor ${f}`]);
  if (k) cr.push(['flat', unitId(w, f, FLATS[k].n)]);
  if (near.on) cr.push(['near', 'Nearby']);
  crumbs.innerHTML = cr.map(([go, t], i) => `${i ? '<span class="sl" aria-hidden="true">/</span>' : ''}<button data-go="${go}"${i === cr.length - 1 ? ' aria-current="location"' : ''}>${t}</button>`).join('');
  let h = '';
  if (S.mode === 'site' && near.on) h = nearPanel();
  else if (S.mode === 'site') {
    const all = counts();
    h = head(esc(PROJECT.location.split(',').slice(-2).join(',').trim()), esc(PROJECT.name), prem.on && PREMIUM_SITE ? `Photo-real views made with AI from the building's 3D model. Pick a wing to explore its floors and flats in live 3D.` : `${all.total} homes in ${PROJECT.wings.length} wings. Choose a wing to see its floors, or go straight to a flat.`)
      + sec('Go to a flat', `<form class="w-search" data-search role="search"><label class="w-sr" for="vq">Flat number</label><input id="vq" name="q" placeholder="Flat number, e.g. A-506" autocomplete="off" spellcheck="false" enterkeyhint="go"><button type="submit">Go${ICON.arrow}</button></form><p class="v-err" role="alert" hidden></p>`)
      + sec('Wings', `<div class="w-list">${PROJECT.wings.map(x => {
        const c = counts({ wing: x });
        return `<button class="w-wing" data-wing="${x}" aria-label="${x} Wing, ${c.available} of ${c.total} available"><span class="w-wing-id">${x}</span><span class="w-wing-t"><b>${x} Wing</b><small>${NF} floors · ${c.total} homes · 1 &amp; 2 BHK</small></span><span class="w-wing-n"><b>${c.available}</b><small>of ${c.total}</small></span>${ICON.right}${bar(c)}</button>`;
      }).join('')}</div>`, 'Available')
      + (!v.mapOn ? '' : sec('Location', `<button class="w-wing" data-act="near" aria-label="See what is nearby on the map"><span class="w-wing-id">${ICON.pin}</span><span class="w-wing-t"><b>What’s nearby</b><small>Schools, clinics, stations, airport</small></span><span class="w-wing-n"><b>${PLACES.length}</b><small>places</small></span>${ICON.right}</button>`))
      + sec('All homes', `<div class="w-totals">${STATUSES.map(s => `<div><i class="w-sq s-${s}"></i>${ST[s]}<b>${all[s]}</b></div>`).join('')}</div>`)
      + `<div class="w-foot">${brand}</div>`;
  } else if (S.mode === 'wing') {
    const c = counts({ wing: w }), ks = flatsOfWing(w);
    let rows = '';
    for (let fl = NF; fl >= 1; fl--) {
      const ids = ks.filter(x => flatOn(x, fl)).map(x => unitId(w, fl, FLATS[x].n)), a = ids.filter(id => statusOf(id) === 'available').length; // floor 1 has 6 flats, not 8
      rows += `<button class="w-flr" data-floor="${fl}"><b>Floor ${fl}</b><span class="av${a ? '' : ' zero'}">${a} of ${ids.length} available</span>${ICON.right || '›'}</button>`;
    }
    h = head(esc(PROJECT.name), `${w} Wing`, `${c.available} of ${c.total} homes available. Choose a floor.`)
      + sec('Floors', `<div class="w-flrs">${rows}</div>`)
      + `<div class="w-foot"><button class="w-btn ghost" data-go="home">${ICON.left}All wings</button>${brand}</div>`;
  } else if (S.mode === 'floor' || (S.mode === 'flat' && !k)) {
    const c = counts({ wing: w, floor: f });
    const step = `<div class="w-step" role="group" aria-label="Change floor"><button data-step="-1" aria-label="Floor below" title="Floor below" ${f <= 1 ? 'disabled' : ''}>${ICON.down}</button><button data-step="1" aria-label="Floor above" title="Floor above" ${f >= NF ? 'disabled' : ''}>${ICON.up}</button></div>`;
    h = head(`${w} Wing · X-ray view`, `Floor ${f}`, `${c.available} of ${c.total} available. Floors above are lifted away so you can see every home.`, step)
      + sec('Flats', `<div class="w-units">${flatsOn(w, f).map(x => { const id = unitId(w, f, FLATS[x].n), s0 = statusOf(id); return `<button class="w-unit u-${s0}" data-flat="${x}"><span class="r1"><b>${id}</b>${st(s0)}</span><small>${bhk(x)} · ≈ ${FLATS[x].carpet} sq ft</small></button>`; }).join('')}${flatsOfWing(w).filter(x => amenityOn(x, f)).map(x => `<div class="w-unit w-am"><span class="r1"><b>${esc(amenityOn(x, f))}</b></span><small>For residents, on this floor</small></div>`).join('')}</div>`)
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
    const P = PREMIUM[k], tier = P && prem.on ? 'premium' : S.furnished ? 'furn' : 'empty';
    const tiers = `<div class="w-seg tiers" role="group" aria-label="Plan">${[['empty', 'Basic', 'Empty'], ['furn', 'Pro', 'Furnished'], ...(P ? [['premium', 'Premium', 'Photo']] : [])].map(([a, t, d]) => `<button data-act="${a}"${on(tier === a)}><b>${t}</b><span>${d}</span></button>`).join('')}</div>`;
    const foot = `<div class="w-foot w-foot-2"><button class="w-btn" data-go="floor">${ICON.left}Floor ${f}</button><button class="w-btn pri" data-act="enquire">Enquire about ${id}</button></div>`;
    if (tier === 'premium') {
      const view = premView(P), sh = premiumSet(view, prem.tod, prem.fin), keys = Object.keys(view.sets);
      const fins = [...new Set(keys.map(x => x.split('-')[1]))], tods = [...new Set(keys.map(x => x.split('-')[0]))];
      h = head(`Inside · ${bhk(k)} · ${w} Wing, floor ${f}`, `Flat ${id}`, '', badge(s0))
        + sec('Interior', `${tiers}<p class="w-note">A 360° walkthrough made with AI from this flat's own 3D model, so walls, windows and doors match the plan. Indicative; final finishes as per the agreement.</p>`)
        + sec('Rooms', `<ul class="w-views">${P.views.map(x => `<li><button data-view="${x.id}"${on(x.id === view.id)}><img src="${P.dir}360/t-${x.id}.jpg" alt="" loading="lazy"><span><b>${esc(x.name)}</b><small>${esc(F.rooms[x.room][6] || '')}</small></span></button></li>`).join('')}</ul>`, 'Drag to look around')
        + (fins.length > 1 ? sec('Floor finish', `<div class="w-seg" role="group" aria-label="Floor finish">${fins.map(x => `<button data-fin="${x}"${on(sh.fin === x)}>${PREMIUM_FINISHES[x]}</button>`).join('')}</div><p class="w-note">Vitrified tile is the standard specification. The others show upgrade options.</p>`) : '')
        + (tods.length > 1 ? sec('Light', `<div class="w-seg" role="group" aria-label="Time of day">${tods.map(x => `<button data-tod="${x}"${on(sh.tod === x)}>${x === 'day' ? 'Day' : 'Evening'}</button>`).join('')}</div>`) : '')
        + foot;
    } else
    h = head(`Inside · ${bhk(k)} · ${w} Wing, floor ${f}`, `Flat ${id}`, '', badge(s0))
      + sec('Interior', `${tiers}
        <p class="w-note">${S.furnished ? 'Furniture is placed automatically from the floor plans. It is indicative, to show scale.' : 'The empty layout, with walls cut at 1.2 m so you can see into every room.'}</p>`)
      + sec('Camera', `<div class="w-seg" role="group" aria-label="Camera"><button data-act="v3d"${on(!topCam)}>3D view</button><button data-act="top"${on(topCam)}>Top down</button></div>`)
      + sec('Rooms', `<ul class="w-rooms">${F.rooms.map((r, i) => r[6] ? `<li data-room="${i}"><span>${esc(r[0])}</span><b>${esc(r[6])}</b></li>` : '').join('')}</ul>`, 'Size as per brochure')
      + foot;
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
      if (!flatOn(k, S.floor)) { // an amenity takes this flat's place on this floor
        const am = amenityOn(k, S.floor); if (!am) continue;
        const a = document.createElement('div'); a.className = 'pin pin-am'; a.textContent = am; labels.appendChild(a);
        labelItems.push({ el: a, pos: v.flatParts[k].center.clone().setY(S.floor * 3 + 1.6) }); continue;
      }
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
  } else if (S.mode === 'site' && near.on) {
    for (const p of PLACES) { // landmark pins, standing on the map
      if (near.off.has(p.c)) continue;
      const el = document.createElement('button'); el.type = 'button'; el.dataset.place = p.id; el.style.setProperty('--c', CATS[p.c].color);
      el.className = 'npin' + (p.d > near.r * 1000 ? ' out' : '') + (near.sel === p.id ? ' sel' : '');
      el.setAttribute('aria-label', `${p.n}, ${p.note}, ${fmtDist(p.d)} away`);
      el.innerHTML = `<i><svg viewBox="0 0 24 24">${CATS[p.c].icon}</svg></i><span class="ntag"><b>${esc(p.n)}</b><small>${esc(p.note)} · ${fmtDist(p.d)}</small></span>`;
      labels.appendChild(el); labelItems.push({ el, pos: v.geo(p.lat, p.lng), far: true });
    }
    for (const km of RADII) { // each ring's name rides on the side of the ring nearest the camera
      const el = document.createElement('span'); el.className = 'nring' + (km === near.r ? ' on' : ''); el.textContent = fmtRing(km); labels.appendChild(el);
      labelItems.push({ el, pos: v.vec(0, 0, 0), ring: km * 1000, far: true });
    }
    const el = document.createElement('div'); el.className = 'pin pin-big nsite'; el.innerHTML = `<b>${esc(shortName)}</b>`; labels.appendChild(el);
    labelItems.push({ el, pos: v.vec(0, 30, 0) });
  }
  syncLabelMode();
  placeLabels();
}
function onFrame() { placeLabels(); if (v.state.mode === 'site') nearTick(); }
function placeLabels() {
  const cull = labels.classList.contains('furn'), placed = [], az = v.azimuth();
  for (const it of labelItems) { if (it.ring) it.pos.set(Math.sin(az) * it.ring, 0, Math.cos(az) * it.ring); it.p = v.project(it.pos); it.el.style.transform = `translate(${it.p.x.toFixed(1)}px, ${it.p.y.toFixed(1)}px) translate(-50%,-100%)`; }
  // in the furnished view, hide labels that would overlap a bigger room's label
  const order = cull ? labelItems.slice().sort((a, b) => (b.el.classList.contains('hot') - a.el.classList.contains('hot')) || (b.area - a.area)) : labelItems;
  for (const it of order) {
    let show = it.p.z < 1 && (!it.far || v.seen(it.pos));
    if (show && cull && it.el.offsetWidth) {
      const w = it.el.offsetWidth + 6, h = it.el.offsetHeight + 4, r = [it.p.x - w / 2, it.p.y - h, it.p.x + w / 2, it.p.y];
      if (placed.some(q => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1])) show = false; else placed.push(r);
    }
    it.el.style.visibility = show ? 'visible' : 'hidden';
  }
  needle.style.transform = `rotate(${((near.on ? az - v.north() : -az) * 180 / Math.PI).toFixed(1)}deg)`; // the road side, or north while the map is in view
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
  const t = e.target.closest('button,[data-flat],[data-room],[data-view]'); if (!t) return;
  const S = v.state, d = t.dataset;
  if (d.go === 'home') { closeNear(false); v.home(); }
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
  else if (d.act === 'furn' || d.act === 'empty') { const was = prem.on; prem.on = false; topCam = false; if (was && (d.act === 'furn') === S.furnished) render(true); else { v.setFurnished(d.act === 'furn'); render(true); } return; }
  else if (d.act === 'premium') { prem.on = true; hint.classList.add('gone'); render(true); return; }
  else if (d.view) { walkTo(d.view, true); return; }
  else if (d.fin) { prem.fin = d.fin; render(true); return; }
  else if (d.tod) { prem.tod = d.tod; render(true); return; }
  else if (d.act === 'top' || d.act === 'v3d') { topCam = d.act === 'top'; topCam ? v.topView() : v.view3d(); t.parentElement.querySelectorAll('button').forEach(b => { b.classList.toggle('on', b === t); b.setAttribute('aria-pressed', String(b === t)); }); return; }
  else if (d.act === 'enquire') { enquire(unitId(S.wing, S.floor, FLATS[S.flat].n), bhk(S.flat)); return; }
  else if (d.act === 'orb-prev' || d.act === 'orb-next') { orbUsed(); stepOrb(d.act === 'orb-next' ? 1 : -1); return; }
  else if (d.act === 'zin') { if (prem.on && premData() && pano) pano.zoom(0.85); else if (near.on) { const D = v.dist(), s = RADII.filter(km => v.ringDist(km * 1000) < D * 0.9).pop(); s ? showRing(s) : closeNear(true); } else v.zoom(0.75); return; }
  else if (d.act === 'zout') { if (prem.on && premData() && pano) pano.zoom(1.18); else if (S.mode === 'site' && v.mapOn && v.dist() * 1.33 > 215) { const D = v.dist(), n = RADII.find(km => v.ringDist(km * 1000) > D * 1.1); if (n) showRing(n); } else v.zoom(1.33); return; } // past the building, each step is the next ring
  else if (d.act === 'reset') { if (near.on) v.frameRing(near.r * 1000, 1100); else v.reset(); return; }
  else if (d.act === 'near') { near.on ? closeNear(true) : openNear(1); return; }
  else if (d.nearR) { showRing(+d.nearR); return; }
  else if (d.nearCat) { near.off.has(d.nearCat) ? near.off.delete(d.nearCat) : near.off.add(d.nearCat); render(true); return; }
  else if (d.place) { pickPlace(d.place); return; }
  else if (d.act === 'full') { toggleFull(); return; }
  else if (d.act === 'side') { const c = root.classList.toggle('v-collapsed'); t.setAttribute('aria-expanded', String(!c)); t.setAttribute('aria-label', c ? 'Show details' : 'Hide details'); t.title = t.getAttribute('aria-label'); v.layout(); onFrame(); return; }
  else return;
  hint.classList.add('gone');
  render();
});
let searchWhy = '';
function goToFlat(q) {
  const m = String(q).trim().toUpperCase().replace(/\s+/g, '').match(/^([AB])-?([1-7])(0[1-8])$/);
  searchWhy = '';
  if (!m) return false;
  if (!flatOn(m[1] + m[3], +m[2])) { searchWhy = `There is no flat ${m[1]}-${m[2]}${m[3]}. Floor 1 has flats 03 to 08; ${m[3] === '02' ? 'the ' + (amenityOn(m[1] + '02', 1) || 'amenity').toLowerCase() + ' is here instead.' : 'try a higher floor.'}`; return false; }
  const key = m[1] + m[3]; v.state.wing = m[1]; v.state.floor = +m[2]; v.selectFlat(key); hint.classList.add('gone'); render();
  return true;
}
root.addEventListener('submit', e => {
  if (!e.target.matches('[data-search]')) return;
  e.preventDefault();
  const err = panel.querySelector('.v-err');
  if (!goToFlat(e.target.q.value)) { err.hidden = false; err.textContent = searchWhy || 'Try a flat number like A-506 or B-302 (floors 1–7, flats 01–08).'; }
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
  const pl = e.target.closest('[data-place]'); labels.querySelectorAll('.npin').forEach(b => b.classList.toggle('hot', !!pl && b.dataset.place === pl.dataset.place));
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
  if (!f) { // embedded on its own (e.g. the Arch3 playground): no host form, so show what the builder would receive
    toast(`<b>Enquiry for ${esc(id)}</b><span>${esc(type)} · on a builder's site this goes to their CRM</span>`); return;
  }
  f.unit.value = id; f.type.value = type;
  document.getElementById('enquire').scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => f.name.focus({ preventScroll: true }), 700);
}
document.querySelectorAll('[data-demo]').forEach(b => b.addEventListener('click', () => {
  const [key, fl] = b.dataset.demo.split('@');
  document.getElementById('explore')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => { v.state.wing = FLATS[key].wing; v.state.floor = +fl; v.selectFlat(key); render(); setTimeout(() => { v.explore(); render(); }, 1500); }, 600);
}));
const form = document.getElementById('enquiry');
if (form) form.addEventListener('submit', e => {
  e.preventDefault();
  const d = Object.fromEntries(new FormData(form));
  const out = document.getElementById('lead');
  out.hidden = false;
  out.innerHTML = `<p class="lead-h">Demo: lead captured</p><dl><div><dt>Name</dt><dd>${esc(d.name || '—')}</dd></div><div><dt>Phone</dt><dd>${esc(d.phone || '—')}</dd></div><div><dt>Interested in</dt><dd>${esc(d.unit || d.type || '—')}</dd></div><div><dt>Source</dt><dd>${d.unit ? '3D explorer' : 'Website form'}</dd></div></dl><p class="lead-f">On a live site this goes straight to the builder's CRM with the flat number attached. Nothing was sent from this demo.</p>`;
  out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

/* ---------- header menu ---------- */
const mb = document.getElementById('menu-btn'), nav = document.getElementById('site-nav');
if (mb && nav) mb.addEventListener('click', () => { const o = nav.classList.toggle('open'); mb.setAttribute('aria-expanded', o); });
if (mb && nav) nav.addEventListener('click', e => { if (e.target.closest('a')) { nav.classList.remove('open'); mb.setAttribute('aria-expanded', 'false'); } });

/* ---------- boot ---------- */
const theme = new URLSearchParams(location.search).get('theme'); // ?theme=dark for embeds on dark pages
if (theme === 'dark' || theme === 'light') root.dataset.theme = theme;
if (window.matchMedia && matchMedia('(pointer: coarse)').matches) hint.textContent = 'Drag to rotate · Pinch to zoom · Tap a wing';
try {
  v = createViewer(root, { onMode: () => {}, onSelect: render, onHover, onFrame: () => v && onFrame(), onInteract, onMap: (on, credit) => { attrEl.hidden = !on; attrEl.innerHTML = on ? credit : ''; } });
  const qs = new URLSearchParams(location.search), deep = qs.get('flat');
  // The real map under the building. Without it (MAP = false in config.js, ?map=0, or the 3D export tool) the viewer is exactly the plain one.
  if (MAP !== false && qs.get('map') !== '0' && !(typeof __BUILD__ !== 'undefined' && __BUILD__ === 'export')) {
    const key = qs.get('gmaps_key') || root.dataset.mapsKey || GOOGLE_MAPS_KEY; // a key in the address bar or on the widget's tag wins, handy for trying one out
    const fallback = MAP_TILES && MAP_TILES.url ? () => templateTiles(MAP_TILES.url, MAP_TILES.credit, MAP_TILES.maxZoom) : osmTiles;
    v.setMap({ site: SITE, radii: RADII, source: key ? googleTiles(key, SITE).catch(err => { console.warn('[Arch3] ' + err.message); toast('<b>Google Maps is not on</b><span>Showing the standard map instead</span>'); return fallback(); }) : fallback() });
  }
  render();
  window.__viewer = v;
  if (!deep && v.mapOn && qs.get('view') === 'nearby') { document.getElementById('explore')?.scrollIntoView(); openNear(RADII.includes(+qs.get('r')) ? +qs.get('r') : 1); } // e.g. ?view=nearby&r=2
  if (!deep && qs.get('plan') === 'premium' && PREMIUM_SITE) { prem.on = true; render(); } // e.g. ?flat=A-506&inside=1 (links from the sales console)
  if (deep) {
    document.getElementById('explore')?.scrollIntoView();
    setTimeout(() => { if (goToFlat(deep) && qs.get('inside')) setTimeout(() => { // &plan=basic | premium picks the plan to open with
      const pl = qs.get('plan'); if (pl === 'basic') v.state.furnished = false; v.explore(); if (pl === 'premium') prem.on = true; render(); }, 1500); }, 300);
  }
} catch (err) {
  root.classList.add('v-failed');
  root.querySelector('.v-fallback').hidden = false;
  console.error(err);
}
