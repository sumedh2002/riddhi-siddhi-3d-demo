/* =========================================================
   INVENTORY — flat availability shared by the 3D viewer and the sales console.

   Demo mode: data lives in this browser (localStorage) and changes are pushed
   to every other open tab of the site instantly (BroadcastChannel + storage
   events). To make it work across devices, replace load/persist/notify below
   with calls to a real backend (e.g. Supabase); nothing else needs to change.
   ========================================================= */
import { PROJECT, allUnits } from './project-data.js';

export const STATUSES = ['available', 'hold', 'booked', 'sold'];
export const STATUS_LABEL = { available: 'Available', hold: 'On hold', booked: 'Booked', sold: 'Sold' };

const KEY = `arch3:${PROJECT.id}:inventory:v1`;
const UNITS = allUnits();
const subs = new Set();
let chan = null;
try { chan = new BroadcastChannel(`arch3:${PROJECT.id}`); } catch (e) { /* older browsers: storage events still work */ }

/* starting data for the demo, so the building isn't all one colour */
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

/* ---------- storage ---------- */
function read() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && d.v === 1 && d.units) {
      for (const u of UNITS) if (!d.units[u.id] || !STATUSES.includes(d.units[u.id].status)) d.units[u.id] = { status: seedStatus(u.id), remarks: '' };
      d.log = Array.isArray(d.log) ? d.log : [];
      return d;
    }
  } catch (e) { /* private mode or bad data: fall through to seed */ }
  return null;
}
function persist(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* storage unavailable: keep in memory */ } }
let db = read();
if (!db) { db = seed(); persist(db); }

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

/* ---------- write ---------- */
export function updateUnit(id, { status, remarks = '' }, by = 'Sales manager') {
  if (!STATUSES.includes(status)) throw new Error('Unknown status ' + status);
  const prev = getUnit(id), at = Date.now();
  db.units[id] = { status, remarks: String(remarks).slice(0, 300), updatedAt: at, updatedBy: by };
  if (prev.status !== status || (prev.remarks || '') !== remarks) {
    db.log.unshift({ id, from: prev.status, to: status, remarks: db.units[id].remarks, at, by });
    db.log = db.log.slice(0, 60);
  }
  db.updatedAt = at;
  persist(db);
  notify({ type: 'unit', id });
  emit({ type: 'unit', id, remote: false });
}
/** Set the same status on several flats at once (remarks are kept). Returns how many changed. */
export function updateUnits(ids, status, by = 'Sales manager') {
  if (!STATUSES.includes(status)) throw new Error('Unknown status ' + status);
  const at = Date.now(); let n = 0;
  for (const id of ids) {
    const prev = getUnit(id);
    if (prev.status === status) continue;
    db.units[id] = { status, remarks: prev.remarks || '', updatedAt: at, updatedBy: by };
    db.log.unshift({ id, from: prev.status, to: status, remarks: '', at, by }); n++;
  }
  if (!n) return 0;
  db.log = db.log.slice(0, 60); db.updatedAt = at;
  persist(db);
  notify({ type: 'bulk' });
  emit({ type: 'bulk', ids, remote: false });
  return n;
}
export function resetDemo() {
  db = seed(); persist(db);
  notify({ type: 'reset' });
  emit({ type: 'reset', remote: false });
}

/* ---------- live updates ---------- */
export function subscribe(cb) { subs.add(cb); return () => subs.delete(cb); }
function emit(e) { subs.forEach(cb => { try { cb(e); } catch (err) { console.error(err); } }); }
function notify(msg) { if (chan) try { chan.postMessage(msg); } catch (e) { /* ignore */ } }
// Another tab changed something: reload and report exactly which flats changed.
function sync() {
  const next = read(); if (!next) return;
  if (next.updatedAt === db.updatedAt && next.log.length === db.log.length) return;
  const old = db; db = next;
  if (!next.updatedAt) { emit({ type: 'reset', remote: true }); return; } // demo data was reset elsewhere
  const changed = UNITS.map(u => u.id).filter(id => old.units[id].status !== next.units[id].status);
  changed.forEach(id => emit({ type: 'unit', id, remote: true }));
  if (!changed.length) emit({ type: 'sync', remote: true });
}
if (chan) chan.onmessage = sync;
window.addEventListener('storage', e => { if (e.key === KEY) sync(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); }); // phones pause background tabs
window.addEventListener('pageshow', sync);
