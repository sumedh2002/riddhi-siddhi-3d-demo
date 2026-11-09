/* =========================================================
   INVENTORY — flat availability shared by the 3D website and the sales console.

   Live mode (Supabase): statuses come from the cloud database and every change
   reaches every open website and console within a second (Realtime). Changes
   go through the database's set_units() function, which only staff can call.

   Demo mode (this device only): used by the console's "Continue with the demo
   account". Data lives in this browser; other tabs of the site update instantly.
   ========================================================= */
import { createClient } from '@supabase/supabase-js';
import { PROJECT, allUnits } from './project-data.js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const STATUSES = ['available', 'hold', 'booked', 'sold'];
export const STATUS_LABEL = { available: 'Available', hold: 'On hold', booked: 'Booked', sold: 'Sold' };

const P = PROJECT.id;
const UNITS = allUnits();
const IDS = new Set(UNITS.map(u => u.id));
const subs = new Set();
export const cloudAvailable = !!(SUPABASE_URL && SUPABASE_KEY);
let mode = cloudAvailable ? 'cloud' : 'local';
export const isDemo = () => mode === 'local';

/* starting data, so the building isn't all one colour (matches the database seed) */
function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; }
const FORCE = { 'A-506': 'available', 'A-407': 'available', 'B-506': 'hold' };
function seedStatus(id) {
  if (FORCE[id]) return FORCE[id];
  const v = hash(id + 'rs');
  return v < 0.5 ? 'available' : v < 0.72 ? 'booked' : v < 0.86 ? 'sold' : 'hold';
}
function seed() {
  const units = {};
  for (const u of UNITS) units[u.id] = { status: seedStatus(u.id), remarks: '', updatedAt: null, updatedBy: null };
  return { v: 1, units, log: [], updatedAt: null };
}
function clean(d) {
  if (!d || d.v !== 1 || !d.units) return null;
  for (const u of UNITS) if (!d.units[u.id] || !STATUSES.includes(d.units[u.id].status)) d.units[u.id] = { status: seedStatus(u.id), remarks: '' };
  d.log = Array.isArray(d.log) ? d.log : [];
  return d;
}
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked: keep in memory */ } }
};
const LOCAL_KEY = `arch3:${P}:inventory:v1`;   // demo mode data
const CACHE_KEY = `arch3:${P}:cloud-cache:v1`; // last statuses seen from the cloud, for an instant first paint
function cloudStart() {
  const d = clean(store.get(CACHE_KEY)) || seed();
  for (const id in d.units) { d.units[id].remarks = ''; d.units[id].updatedBy = null; }
  d.log = [];
  return d;
}
let db = mode === 'cloud' ? cloudStart() : (clean(store.get(LOCAL_KEY)) || seed());

/* ---------- read ---------- */
export function getUnit(id) { return db.units[id] || { status: seedStatus(id), remarks: '' }; }
export function statusOf(id) { return getUnit(id).status; }
export function recentLog(n = 10) { return db.log.slice(0, n); }
export function lastUpdated() { return db.updatedAt; }
/** counts({ wing: 'A' }) → { available, hold, booked, sold, total } */
export function counts(filter = {}) {
  const c = { available: 0, hold: 0, booked: 0, sold: 0, total: 0 };
  for (const u of UNITS) {
    if (filter.wing && u.wing !== filter.wing) continue;
    if (filter.floor && u.floor !== filter.floor) continue;
    c[statusOf(u.id)]++; c.total++;
  }
  return c;
}

/* ---------- events ---------- */
export function subscribe(cb) { subs.add(cb); return () => subs.delete(cb); }
function emit(e) { subs.forEach(cb => { try { cb(e); } catch (err) { console.error(err); } }); }

/* ---------- write (applied locally first, so the screen updates instantly) ---------- */
function applyLocal(id, status, remarks, by, at) {
  const prev = { ...getUnit(id) };
  const next = { status, remarks: remarks === null ? (prev.remarks || '') : String(remarks).slice(0, 300), updatedAt: at, updatedBy: by };
  if (prev.status === next.status && (prev.remarks || '') === next.remarks) return null;
  db.units[id] = next;
  db.log.unshift({ id, from: prev.status, to: status, remarks: remarks === null ? '' : next.remarks, at, by });
  db.log = db.log.slice(0, 60);
  return prev;
}
export function updateUnit(id, { status, remarks = '' }, by = 'Sales manager') {
  if (!STATUSES.includes(status)) throw new Error('Unknown status ' + status);
  const at = Date.now(), prev = applyLocal(id, status, remarks, by, at);
  if (!prev) return;
  db.updatedAt = at;
  if (mode === 'local') { persistLocal(); notifyTabs({ type: 'unit', id }); }
  else { saveCache(); sendToCloud([id], status, remarks, { [id]: prev }); }
  emit({ type: 'unit', id, remote: false });
}
/** Set the same status on several flats at once (remarks are kept). Returns how many changed. */
export function updateUnits(ids, status, by = 'Sales manager') {
  if (!STATUSES.includes(status)) throw new Error('Unknown status ' + status);
  const at = Date.now(), prevs = {};
  for (const id of ids) { if (getUnit(id).status === status) continue; const p = applyLocal(id, status, null, by, at); if (p) prevs[id] = p; }
  const changed = Object.keys(prevs);
  if (!changed.length) return 0;
  db.updatedAt = at;
  if (mode === 'local') { persistLocal(); notifyTabs({ type: 'bulk' }); }
  else { saveCache(); sendToCloud(changed, status, null, prevs); }
  emit({ type: 'bulk', ids: changed, remote: false });
  return changed.length;
}
export function resetDemo() {
  if (mode === 'local') { db = seed(); persistLocal(); notifyTabs({ type: 'reset' }); emit({ type: 'reset', remote: false }); return; }
  const before = db;
  db = seed(); db.updatedAt = Date.now(); saveCache();
  emit({ type: 'reset', remote: false });
  sb.rpc('reset_demo', { p_project: P }).then(({ error }) => {
    if (error) { db = before; saveCache(); emit({ type: 'error', message: friendly(error) }); emit({ type: 'reset', remote: true }); }
    else refreshAll();
  });
}

/* =========================================================
   DEMO MODE (this device): localStorage + BroadcastChannel
   ========================================================= */
let chan = null;
try { chan = new BroadcastChannel(`arch3:${P}`); } catch (e) { /* older browsers: storage events still work */ }
function persistLocal() { store.set(LOCAL_KEY, db); }
function notifyTabs(msg) { if (chan) try { chan.postMessage(msg); } catch (e) { /* ignore */ } }
function syncLocal() {
  if (mode !== 'local') return;
  const next = clean(store.get(LOCAL_KEY)); if (!next) return;
  if (next.updatedAt === db.updatedAt && next.log.length === db.log.length) return;
  const old = db; db = next;
  if (!next.updatedAt) { emit({ type: 'reset', remote: true }); return; }
  const changed = UNITS.map(u => u.id).filter(id => old.units[id].status !== next.units[id].status);
  changed.forEach(id => emit({ type: 'unit', id, remote: true }));
  if (!changed.length) emit({ type: 'sync', remote: true });
}
if (chan) chan.onmessage = syncLocal;
window.addEventListener('storage', e => { if (e.key === LOCAL_KEY) syncLocal(); });
/** Console only: switch to demo mode (changes stay on this device). */
export function useDemoMode() {
  if (mode === 'local') return;
  mode = 'local'; db = clean(store.get(LOCAL_KEY)) || seed(); persistLocal();
  emit({ type: 'reset', remote: true });
}
/** Console only: back to the live database. */
export function useLiveMode() {
  if (!cloudAvailable || mode === 'cloud') return;
  mode = 'cloud'; db = cloudStart();
  emit({ type: 'reset', remote: true });
  refreshAll();
}

/* =========================================================
   LIVE MODE: Supabase
   ========================================================= */
const sb = cloudAvailable ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'arch3-auth' } }) : null;
let staff = null;              // { email, name, role } while a staff member is signed in
const pending = new Map();     // id -> status we just sent, so our own echo isn't announced as someone else's change

function saveCache() { store.set(CACHE_KEY, { v: 1, updatedAt: db.updatedAt, log: [], units: Object.fromEntries(UNITS.map(u => [u.id, { status: db.units[u.id].status, updatedAt: db.units[u.id].updatedAt || null }])) }); }
function friendly(err) {
  const m = (err && (err.message || err.error_description)) || String(err);
  if (/not staff/i.test(m)) return 'Your account is not allowed to change this project.';
  if (/Invalid login credentials/i.test(m)) return 'That email and password don\'t match an account.';
  if (/Email not confirmed/i.test(m)) return 'This account isn\'t confirmed yet. Ask your admin to confirm it.';
  if (/Failed to fetch|NetworkError|network/i.test(m)) return 'No connection. Check the internet and try again.';
  return m;
}
function sendToCloud(ids, status, remarks, prevs) {
  for (const id of ids) pending.set(id, status);
  sb.rpc('set_units', { p_project: P, p_units: ids, p_status: status, p_remarks: remarks }).then(({ error }) => {
    if (!error) { scheduleStaffRefresh(); return; }
    for (const id of ids) { pending.delete(id); if (prevs[id]) db.units[id] = prevs[id]; }
    db.log = db.log.filter(e => e.cloud || !(ids.includes(e.id) && e.to === status));
    saveCache();
    emit({ type: 'error', message: friendly(error) });
    emit({ type: 'sync', remote: true });
  }, err => { emit({ type: 'error', message: friendly(err) }); });
}
async function refreshUnits() {
  const { data, error } = await sb.from('units').select('unit_id,status,updated_at').eq('project_id', P);
  if (error || !data) return false;
  let latest = null; const changed = [];
  for (const r of data) {
    if (!IDS.has(r.unit_id) || !STATUSES.includes(r.status)) continue;
    const t = r.updated_at ? Date.parse(r.updated_at) : null, u = db.units[r.unit_id];
    if (pending.has(r.unit_id) && pending.get(r.unit_id) !== r.status) continue; // our change is still on its way
    if (u.status !== r.status) changed.push(r.unit_id);
    db.units[r.unit_id] = { ...u, status: r.status, updatedAt: t || null };
    if (t && (!latest || t > latest)) latest = t;
  }
  db.updatedAt = latest;
  saveCache();
  return changed;
}
async function refreshStaff() {
  if (!staff) return;
  const [notes, acts] = await Promise.all([
    sb.from('unit_notes').select('unit_id,remarks').eq('project_id', P),
    sb.from('activity').select('unit_id,from_status,to_status,remarks,by_name,at').eq('project_id', P).order('at', { ascending: false }).limit(60)
  ]);
  if (!notes.error && notes.data) { for (const id of IDS) db.units[id].remarks = ''; for (const r of notes.data) if (db.units[r.unit_id]) db.units[r.unit_id].remarks = r.remarks; }
  if (!acts.error && acts.data) {
    db.log = acts.data.filter(r => IDS.has(r.unit_id)).map(r => ({ id: r.unit_id, from: r.from_status, to: r.to_status, remarks: r.remarks, at: Date.parse(r.at), by: r.by_name || '', cloud: true }));
    const seen = new Set();
    for (const e of db.log) if (!seen.has(e.id)) { seen.add(e.id); db.units[e.id].updatedBy = e.by; db.units[e.id].updatedAt = e.at; }
  }
}
let refreshing = null;
function refreshAll() {
  if (mode !== 'cloud' || !sb) return Promise.resolve();
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const changed = await refreshUnits();
    await refreshStaff();
    if (changed !== false) emit({ type: 'sync', remote: true });
  })().finally(() => { refreshing = null; });
  return refreshing;
}
let staffTimer = null;
function scheduleStaffRefresh() { if (!staff) return; clearTimeout(staffTimer); staffTimer = setTimeout(async () => { await refreshStaff(); emit({ type: 'sync', remote: true }); }, 400); }

if (sb) {
  // live changes to flat statuses (everyone, including buyers on the website)
  sb.channel(`units:${P}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'units', filter: `project_id=eq.${P}` }, ({ new: r }) => {
      if (mode !== 'cloud' || !r || !IDS.has(r.unit_id) || !STATUSES.includes(r.status)) return;
      const t = r.updated_at ? Date.parse(r.updated_at) : Date.now(), u = db.units[r.unit_id];
      const mine = pending.get(r.unit_id) === r.status; if (mine) pending.delete(r.unit_id);
      const was = u.status;
      db.units[r.unit_id] = { ...u, status: r.status, updatedAt: t };
      db.updatedAt = Math.max(db.updatedAt || 0, t);
      saveCache();
      if (was !== r.status) emit({ type: 'unit', id: r.unit_id, remote: !mine });
      scheduleStaffRefresh();
    })
    .subscribe(status => { if (status === 'SUBSCRIBED') refreshAll(); });
  // phones pause background pages: catch up when the page is visible again
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { refreshAll(); syncLocal(); } });
  window.addEventListener('pageshow', () => { refreshAll(); syncLocal(); });
  window.addEventListener('online', () => refreshAll());
  refreshAll();
} else {
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncLocal(); });
  window.addEventListener('pageshow', syncLocal);
}

/* ---------- sign-in for the sales console ---------- */
async function staffFor(user) {
  const { data, error } = await sb.from('staff').select('name,role').eq('project_id', P).eq('user_id', user.id).maybeSingle();
  if (error || !data) return null;
  return { email: user.email, name: data.name || user.email.split('@')[0], role: data.role, live: true };
}
export const auth = {
  enabled: cloudAvailable,
  /** The signed-in staff member, or null. */
  async current() {
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    if (!data.session) return null;
    staff = await staffFor(data.session.user);
    if (staff) { await refreshStaff(); emit({ type: 'sync', remote: true }); }
    return staff;
  },
  async signIn(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(friendly(error));
    const s = await staffFor(data.user);
    if (!s) { await sb.auth.signOut(); throw new Error('This account is not set up for this project. Ask your admin to add you as staff.'); }
    staff = s; useLiveMode(); await refreshAll();
    return s;
  },
  async signOut() {
    staff = null;
    if (sb) await sb.auth.signOut();
    for (const id of IDS) { db.units[id].remarks = ''; db.units[id].updatedBy = null; }
    db.log = [];
    emit({ type: 'sync', remote: true });
  }
};
