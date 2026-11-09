/* =========================================================
   FLAT LAYOUT — walls, doors, windows and open sides of each flat,
   worked out from the room rectangles in project-data.js.
   Pure data (plan metres); the 3D viewer and the furnishing
   engine both build from it.
   ========================================================= */
import { FLATS, COMMON } from './project-data.js';

export const HUB = { E: 3, D: 2, L: 1 }; // rooms that connect others (entry, dining, living)

export function subtract(iv, cuts) {
  let out = [iv];
  for (const c of cuts) {
    const nx = [];
    for (const [a, b] of out) {
      if (c[1] <= a || c[0] >= b) { nx.push([a, b]); continue; }
      if (c[0] > a) nx.push([a, c[0]]);
      if (c[1] < b) nx.push([c[1], b]);
    }
    out = nx;
  }
  return out.filter(([a, b]) => b - a > 0.3);
}

const allRects = [];
for (const k in FLATS) for (const r of FLATS[k].rooms) allRects.push({ k, r: [r[2], r[3], r[4], r[5]] });
const commonRects = COMMON.map(r => ({ k: 'C', r }));
const inAny = (x, y, skipKey) => allRects.concat(commonRects).some(o => o.k !== skipKey && x > o.r[0] - 0.05 && x < o.r[2] + 0.05 && y > o.r[1] - 0.05 && y < o.r[3] + 0.05);

const cache = {};
/**
 * segs:    wall pieces {o:'h'|'v', c, a, b, t (thickness), ext, room?, i?, j?}
 * doors:   openings {o, c, a, b, room (swings into), other (-1 = outside), entrance}
 * windows: {o, c, a, b, room}
 * open:    wall-less shared edges between hub rooms {o, c, a, b, i, j}
 */
export function flatLayout(key) {
  if (cache[key]) return cache[key];
  const F = FLATS[key], rooms = F.rooms, segs = [], doors = [], open = [], tol = 0.26;
  const edges = rooms.map((r, i) => {
    const [, , x0, y0, x1, y1] = r;
    return [{ i, o: 'h', c: y0, a: x0, b: x1, n: -1 }, { i, o: 'h', c: y1, a: x0, b: x1, n: 1 }, { i, o: 'v', c: x0, a: y0, b: y1, n: -1 }, { i, o: 'v', c: x1, a: y0, b: y1, n: 1 }];
  });
  const shared = [];
  for (let i = 0; i < rooms.length; i++) for (let j = i + 1; j < rooms.length; j++) {
    for (const e of edges[i]) for (const f of edges[j]) {
      if (e.o !== f.o || e.n === f.n || Math.abs(e.c - f.c) > tol) continue;
      const a = Math.max(e.a, f.a), b = Math.min(e.b, f.b);
      if (b - a > 0.15) shared.push({ i, j, o: e.o, c: (e.c + f.c) / 2, a, b, ei: e, ej: f });
    }
  }
  const kind = i => rooms[i][1];
  const doorOf = new Map(); // shared interval -> room index the door belongs to
  rooms.forEach((r, i) => {
    if (HUB[r[1]]) return;
    let best = null, score = -1;
    for (const s of shared) {
      if (s.i !== i && s.j !== i) continue;
      const o = s.i === i ? s.j : s.i, ok = kind(o), len = s.b - s.a;
      let sc = HUB[ok] ? HUB[ok] * 10 : ((r[1] === 'T' || r[1] === 'W') && ok === 'B' ? 5 : (r[1] === 'B' && ok === 'K' ? 1 : -1));
      if (sc < 0) continue; if (len >= 0.9) sc += 20; sc += len * 0.1;
      if (sc > score) { score = sc; best = s; }
    }
    if (best) doorOf.set(best, i);
  });
  for (const s of shared) {
    if (HUB[kind(s.i)] && HUB[kind(s.j)]) { open.push({ o: s.o, c: s.c, a: s.a, b: s.b, i: s.i, j: s.j }); continue; }
    if (doorOf.has(s)) {
      const len = s.b - s.a, dw = Math.min(0.85, len - 0.2);
      let m = (s.a + s.b) / 2;
      if (len >= 1.5) { // on a long wall the door sits near the corner closest to the entrance, as in most real plans
        const [ex, ey] = F.door, pa = s.o === 'h' ? [s.a, s.c] : [s.c, s.a], pb = s.o === 'h' ? [s.b, s.c] : [s.c, s.b];
        m = Math.hypot(pa[0] - ex, pa[1] - ey) <= Math.hypot(pb[0] - ex, pb[1] - ey) ? s.a + 0.12 + dw / 2 : s.b - 0.12 - dw / 2;
      }
      if (dw > 0.3) {
        segs.push({ ...s, a: s.a, b: m - dw / 2, t: 0.11 }); segs.push({ ...s, a: m + dw / 2, b: s.b, t: 0.11 });
        const room = doorOf.get(s);
        doors.push({ o: s.o, c: s.c, a: m - dw / 2, b: m + dw / 2, t: 0.11, room, other: room === s.i ? s.j : s.i, entrance: false });
        continue;
      }
    }
    segs.push({ ...s, t: 0.11 });
  }
  edges.forEach((es, i) => es.forEach(e => {
    const cov = shared.filter(s => (s.ei === e || s.ej === e)).map(s => [s.a, s.b]);
    for (const [a, b] of subtract([e.a, e.b], cov)) {
      const m = (a + b) / 2, off = 0.4 * e.n;
      const px = e.o === 'h' ? m : e.c + off, py = e.o === 'h' ? e.c + off : m;
      segs.push({ o: e.o, c: e.c, a, b, t: 0.2, ext: !inAny(px, py, key), room: rooms[i], ri: i });
    }
  }));
  // entrance door on the outer wall closest to the brochure's door mark
  let bestSeg = null, bd = 1e9;
  for (const s of segs) {
    if (s.t !== 0.2) continue;
    const [dx, dy] = F.door;
    const d = s.o === 'h' ? Math.abs(s.c - dy) + Math.max(0, s.a - dx, dx - s.b) : Math.abs(s.c - dx) + Math.max(0, s.a - dy, dy - s.b);
    if (d < bd) { bd = d; bestSeg = s; }
  }
  if (bestSeg) {
    const p = bestSeg.o === 'h' ? F.door[0] : F.door[1], dw = 0.95;
    const lo = Math.max(bestSeg.a, Math.min(p - dw / 2, bestSeg.b - dw)), hi = lo + dw;
    segs.splice(segs.indexOf(bestSeg), 1, { ...bestSeg, b: lo, door: 1 }, { ...bestSeg, a: hi, door: 1 });
    doors.push({ o: bestSeg.o, c: bestSeg.c, a: lo, b: hi, t: 0.2, room: bestSeg.ri, other: -1, entrance: true });
  }
  // windows: glazing on outside walls of living, bedroom, kitchen and dining
  const windows = [];
  for (const s of segs) {
    const kd = s.room && s.room[1];
    if (s.ext && kd && 'LBKD'.includes(kd) && s.b - s.a > 1.0) {
      const L = s.b - s.a, gw = Math.min(kd === 'L' ? 2.2 : 1.5, L - 0.5), m = (s.a + s.b) / 2;
      windows.push({ o: s.o, c: s.c, a: m - gw / 2, b: m + gw / 2, room: s.ri, seg: s });
      s.win = [m - gw / 2, m + gw / 2];
    }
  }
  return (cache[key] = { key, rooms, segs, doors, windows, open });
}
