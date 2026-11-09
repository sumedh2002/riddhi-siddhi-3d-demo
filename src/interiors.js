/* =========================================================
   FURNISHED INTERIORS (Pro)
   Builds a furnished, brochure-style interior for any flat from
   its layout (layout.js): full-height walls with doors and
   windows, tiled floors, feature walls and furniture placed by
   rules for each room type. Everything is made in code — no
   downloaded models — and merged into a few meshes per flat so
   it stays smooth on phones.
   ========================================================= */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const WALL_T = 2.1;      // wall height in the furnished view (m)
const FL = 0.04;                // finished floor level inside the plan group
const DOOR_H = 2.02;
const OPP = { N: 'S', S: 'N', W: 'E', E: 'W' };

/* ---------- small utilities ---------- */
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function union(ivs) {
  const s = ivs.filter(v => v[1] - v[0] > 0.04).sort((p, q) => p[0] - q[0]), out = [];
  for (const v of s) { const l = out[out.length - 1]; if (l && v[0] <= l[1] + 0.02) l[1] = Math.max(l[1], v[1]); else out.push([v[0], v[1]]); }
  return out;
}
function minus(ivs, cuts) {
  let out = ivs.map(v => [v[0], v[1]]);
  for (const c of cuts) { const nx = []; for (const [a, b] of out) { if (c[1] <= a || c[0] >= b) { nx.push([a, b]); continue; } if (c[0] > a) nx.push([a, c[0]]); if (c[1] < b) nx.push([c[1], b]); } out = nx; }
  return out.filter(v => v[1] - v[0] > 0.04);
}
const ov = (a, b) => a[0] < b[2] - 1e-3 && a[2] > b[0] + 1e-3 && a[1] < b[3] - 1e-3 && a[3] > b[1] + 1e-3;
const inside = (a, R) => a[0] >= R[0] - 1e-3 && a[1] >= R[1] - 1e-3 && a[2] <= R[2] + 1e-3 && a[3] <= R[3] + 1e-3;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- textures drawn in code ---------- */
function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
const rgb = (r, g, b, a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;
function jit(c, j, R) { const d = (R() - 0.5) * j; return rgb(c[0] + d, c[1] + d, c[2] + d * 0.9); }
function clouds(x, w, h, R, n, light, dark) {
  for (let k = 0; k < n; k++) {
    const cx = R() * w, cy = R() * h, r = 30 + R() * 140, g = x.createRadialGradient(cx, cy, 0, cx, cy, r), c = R() < 0.5 ? light : dark;
    g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  }
}
function veins(x, x0, y0, s, R, n, col) {
  x.save(); x.beginPath(); x.rect(x0, y0, s, s); x.clip();
  for (let v = 0; v < n; v++) {
    x.strokeStyle = col(0.08 + R() * 0.16); x.lineWidth = 0.7 + R() * 1.8; x.beginPath();
    let px = x0 + R() * s, py = y0 + R() * s; x.moveTo(px, py);
    for (let q = 0; q < 7; q++) { const nx = px + (R() - 0.25) * s * 0.3, ny = py + (R() - 0.5) * s * 0.22; x.quadraticCurveTo((px + nx) / 2 + (R() - 0.5) * 50, (py + ny) / 2 + (R() - 0.5) * 50, nx, ny); px = nx; py = ny; }
    x.stroke();
  }
  x.restore();
}
function grid(x, w, h, nx, ny, col, lw, offsetRows = false) {
  x.fillStyle = col; const sx = w / nx, sy = h / ny;
  for (let j = 0; j <= ny; j++) x.fillRect(0, j * sy - lw / 2, w, lw);
  for (let j = 0; j < ny; j++) for (let i = 0; i <= nx; i++) { const o = offsetRows && j % 2 ? sx / 2 : 0; x.fillRect(i * sx + o - lw / 2, j * sy, lw, sy); }
}
function makeTextures(aniso) {
  const R = rng(7), T = {};
  const tex = (c, { srgb = true, wrap = true } = {}) => { const t = new THREE.CanvasTexture(c); if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t; };
  { // living/bedroom floor: 600 mm glossy beige vitrified tiles (texture = 1.2 m)
    const [c, x] = cnv(1024, 1024), s = 512;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { x.fillStyle = jit([228, 211, 184], 9, R); x.fillRect(i * s, j * s, s, s); }
    clouds(x, 1024, 1024, R, 60, 'rgba(255,249,236,0.10)', 'rgba(186,162,128,0.08)');
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) veins(x, i * s, j * s, s, R, 6, a => rgb(176, 150, 115, a));
    grid(x, 1024, 1024, 2, 2, 'rgb(192,175,148)', 4);
    T.floor = tex(c);
  }
  { // bathroom floor: 300 mm anti-skid tiles
    const [c, x] = cnv(512, 512), s = 128;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = jit([204, 197, 186], 10, R); x.fillRect(i * s, j * s, s, s); }
    for (let k = 0; k < 9000; k++) { x.fillStyle = rgb(120, 110, 98, R() * 0.18); x.fillRect(R() * 512, R() * 512, 1.4, 1.4); }
    grid(x, 512, 512, 4, 4, 'rgb(176,168,156)', 4); T.bathFloor = tex(c);
  }
  { // bathroom walls: 300 x 600 mm glazed tiles
    const [c, x] = cnv(512, 512);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { x.fillStyle = jit([238, 233, 224], 6, R); x.fillRect(i * 128, j * 256, 128, 256); }
    clouds(x, 512, 512, R, 40, 'rgba(255,255,255,0.12)', 'rgba(200,188,170,0.06)');
    grid(x, 512, 512, 4, 2, 'rgb(212,204,190)', 3); T.bathWall = tex(c);
  }
  { // kitchen backsplash: subway tiles (texture = 0.6 m)
    const [c, x] = cnv(512, 512), sx = 128, sy = 64;
    for (let j = 0; j < 8; j++) for (let i = -1; i < 4; i++) {
      const o = j % 2 ? sx / 2 : 0, px = i * sx + o, py = j * sy;
      const g = x.createLinearGradient(px, py, px, py + sy); g.addColorStop(0, '#fbfaf7'); g.addColorStop(1, '#e7e3dc');
      x.fillStyle = g; x.fillRect(px, py, sx, sy);
    }
    grid(x, 512, 512, 4, 8, 'rgb(205,199,190)', 4); T.kitchen = tex(c);
  }
  { // bedroom feature wall: soft damask wallpaper (texture = 0.8 m)
    const [c, x] = cnv(512, 512); x.fillStyle = '#d9c7ab'; x.fillRect(0, 0, 512, 512);
    clouds(x, 512, 512, R, 30, 'rgba(255,245,228,0.10)', 'rgba(150,120,90,0.05)');
    for (let j = 0; j < 4; j++) for (let i = 0; i < 5; i++) {
      const cx = i * 128 + (j % 2 ? 64 : 0), cy = j * 128 + 64; x.save(); x.translate(cx, cy);
      x.strokeStyle = 'rgba(176,148,110,0.55)'; x.lineWidth = 3;
      x.beginPath(); x.ellipse(0, 0, 26, 44, 0, 0, Math.PI * 2); x.stroke();
      for (const s of [-1, 1]) { x.beginPath(); x.moveTo(0, -44); x.bezierCurveTo(s * 50, -30, s * 46, 20, 0, 44); x.stroke(); x.beginPath(); x.moveTo(s * 10, 0); x.quadraticCurveTo(s * 38, -8, s * 54, 10); x.stroke(); }
      x.fillStyle = 'rgba(240,228,206,0.7)'; x.beginPath(); x.moveTo(0, -12); x.lineTo(8, 0); x.lineTo(0, 12); x.lineTo(-8, 0); x.closePath(); x.fill();
      x.restore();
    }
    T.wallBed = tex(c);
  }
  { // living feature wall: travertine-look stone panels (texture = 1.2 m)
    const [c, x] = cnv(512, 512);
    for (let i = 0; i < 2; i++) { x.fillStyle = jit([226, 214, 196], 10, R); x.fillRect(i * 256, 0, 256, 512); }
    for (let k = 0; k < 140; k++) { const y = R() * 512; x.fillStyle = rgb(150, 125, 95, 0.03 + R() * 0.07); x.fillRect(0, y, 512, 1 + R() * 3); }
    clouds(x, 512, 512, R, 30, 'rgba(255,248,236,0.10)', 'rgba(160,135,105,0.06)');
    x.fillStyle = 'rgb(196,182,160)'; x.fillRect(0, 0, 3, 512); x.fillRect(254, 0, 3, 512); x.fillRect(0, 0, 512, 2); x.fillRect(0, 254, 512, 2);
    T.wallLiv = tex(c);
  }
  const wood = (base, line, dark) => {
    const [c, x] = cnv(512, 512); x.fillStyle = rgb(...base); x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 512; i++) { const v = Math.sin(i * 0.08 + Math.sin(i * 0.011) * 5) * 0.5 + 0.5; x.fillStyle = rgb(...line, 0.03 + v * 0.07 + R() * 0.04); x.fillRect(i, 0, 1, 512); }
    for (let k = 0; k < 46; k++) { x.strokeStyle = rgb(...dark, 0.06 + R() * 0.12); x.lineWidth = 0.6 + R() * 1.5; x.beginPath(); const px = R() * 512; x.moveTo(px, 0); for (let y = 0; y <= 512; y += 24) x.lineTo(px + Math.sin(y * 0.018 + k) * 7 + (R() - 0.5) * 2, y); x.stroke(); }
    return tex(c);
  };
  T.woodLight = wood([203, 168, 128], [120, 82, 46], [96, 62, 34]);
  T.woodDark = wood([112, 76, 50], [40, 22, 12], [30, 16, 8]);
  T.woodDoor = wood([170, 124, 84], [90, 56, 28], [70, 42, 20]);
  { // neutral woven fabric (tinted per material)
    const [c, x] = cnv(256, 256); x.fillStyle = '#ececec'; x.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 2) { x.fillStyle = rgb(0, 0, 0, 0.03 + R() * 0.035); x.fillRect(0, y, 256, 1); }
    for (let i = 0; i < 256; i += 2) { x.fillStyle = rgb(255, 255, 255, 0.03 + R() * 0.05); x.fillRect(i, 0, 1, 256); }
    for (let k = 0; k < 1800; k++) { x.fillStyle = rgb(0, 0, 0, R() * 0.05); x.fillRect(R() * 256, R() * 256, 1.5, 1.5); }
    T.fabric = tex(c);
  }
  { // bed runner: zig-zag weave like the brochure
    const [c, x] = cnv(1024, 256); x.fillStyle = '#efe7da'; x.fillRect(0, 0, 1024, 256);
    const cols = ['#2a1d17', '#7d5137', '#2a1d17', '#b98b5e'];
    for (let r = 0; r < 8; r++) { x.strokeStyle = cols[r % 4]; x.lineWidth = 9; x.beginPath(); for (let k = 0; k <= 64; k++) x.lineTo(k * 16, 24 + r * 27 + (k % 2 ? -10 : 10)); x.stroke(); }
    x.fillStyle = '#2a1d17'; x.fillRect(0, 0, 1024, 10); x.fillRect(0, 246, 1024, 10);
    T.runner = tex(c, { wrap: false });
  }
  { // living rug: geometric pattern with border
    const [c, x] = cnv(512, 512); x.fillStyle = '#d6c8b2'; x.fillRect(0, 0, 512, 512);
    x.strokeStyle = '#a28b6e'; x.lineWidth = 4;
    for (let k = -512; k < 1024; k += 48) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k + 512, 512); x.stroke(); x.beginPath(); x.moveTo(k + 512, 0); x.lineTo(k, 512); x.stroke(); }
    for (let i = 24; i < 512; i += 48) for (let j = 0; j < 512; j += 48) { x.fillStyle = '#6e5440'; x.beginPath(); x.arc(i, j, 4, 0, 7); x.fill(); }
    x.strokeStyle = '#5b4434'; x.lineWidth = 26; x.strokeRect(13, 13, 486, 486); x.strokeStyle = '#efe6d6'; x.lineWidth = 4; x.strokeRect(34, 34, 444, 444);
    for (let k = 0; k < 6000; k++) { x.fillStyle = rgb(0, 0, 0, R() * 0.07); x.fillRect(R() * 512, R() * 512, 1.5, 1.5); }
    T.rugLiv = tex(c, { wrap: false });
  }
  { // bedroom rug: dark medallion
    const [c, x] = cnv(512, 512); x.fillStyle = '#5a3f30'; x.fillRect(0, 0, 512, 512);
    for (let r = 220; r > 20; r -= 26) { x.strokeStyle = r % 52 ? 'rgba(201,167,124,0.55)' : 'rgba(240,226,204,0.35)'; x.lineWidth = 6; x.beginPath(); x.ellipse(256, 256, r, r * 0.66, 0, 0, 7); x.stroke(); }
    x.strokeStyle = '#c9a77c'; x.lineWidth = 14; x.strokeRect(18, 18, 476, 476);
    for (let k = 0; k < 7000; k++) { x.fillStyle = rgb(0, 0, 0, R() * 0.1); x.fillRect(R() * 512, R() * 512, 1.5, 1.5); }
    T.rugBed = tex(c, { wrap: false });
  }
  { // paintings
    const [c, x] = cnv(512, 384); let g = x.createLinearGradient(0, 0, 512, 384); g.addColorStop(0, '#3a2215'); g.addColorStop(1, '#9a5424'); x.fillStyle = g; x.fillRect(0, 0, 512, 384);
    const fl = [[150, 170, 70], [300, 120, 52], [380, 250, 60], [230, 280, 44], [90, 300, 36]];
    for (const [fx, fy, s] of fl) {
      x.strokeStyle = 'rgba(70,90,40,0.8)'; x.lineWidth = 4; x.beginPath(); x.moveTo(fx, fy); x.quadraticCurveTo(fx + 20, fy + 80, fx - 10, 384); x.stroke();
      for (let p = 0; p < 9; p++) { x.save(); x.translate(fx, fy); x.rotate(p * 0.7); x.fillStyle = ['#f3b233', '#e8742a', '#f7d46b'][p % 3]; x.beginPath(); x.ellipse(s * 0.5, 0, s * 0.5, s * 0.2, 0, 0, 7); x.fill(); x.restore(); }
      x.fillStyle = '#5b2a12'; x.beginPath(); x.arc(fx, fy, s * 0.18, 0, 7); x.fill();
    }
    T.art1 = tex(c, { wrap: false });
  }
  {
    const [c, x] = cnv(384, 512); x.fillStyle = '#efe6d5'; x.fillRect(0, 0, 384, 512);
    x.fillStyle = '#c9a25a'; x.beginPath(); x.arc(250, 170, 110, 0, 7); x.fill();
    x.fillStyle = 'rgba(47,79,90,0.9)'; x.beginPath(); x.moveTo(0, 512); x.bezierCurveTo(80, 300, 220, 420, 384, 260); x.lineTo(384, 512); x.closePath(); x.fill();
    x.strokeStyle = '#b5653a'; x.lineWidth = 14; x.beginPath(); x.arc(120, 300, 90, 3.6, 5.8); x.stroke();
    x.fillStyle = 'rgba(30,30,30,0.85)'; x.fillRect(60, 80, 6, 200);
    T.art2 = tex(c, { wrap: false });
  }
  {
    const [c, x] = cnv(512, 384); const g = x.createLinearGradient(0, 0, 0, 384); g.addColorStop(0, '#f6d7b8'); g.addColorStop(0.6, '#e9eef0'); g.addColorStop(1, '#cfd9df'); x.fillStyle = g; x.fillRect(0, 0, 512, 384);
    x.fillStyle = '#f2a65a'; x.beginPath(); x.arc(360, 130, 40, 0, 7); x.fill();
    [['#9fb1bd', 230], ['#7891a2', 270], ['#566f82', 310]].forEach(([col, y], k) => { x.fillStyle = col; x.beginPath(); x.moveTo(0, 384); for (let i = 0; i <= 512; i += 32) x.lineTo(i, y - 40 * Math.sin(i * 0.012 + k * 2) - 20 * Math.sin(i * 0.03 + k)); x.lineTo(512, 384); x.closePath(); x.fill(); });
    T.art3 = tex(c, { wrap: false });
  }
  { // TV screen (off, with a soft sheen)
    const [c, x] = cnv(512, 288); const g = x.createLinearGradient(0, 0, 512, 288); g.addColorStop(0, '#1d2a3c'); g.addColorStop(0.5, '#0b1018'); g.addColorStop(1, '#161f2c'); x.fillStyle = g; x.fillRect(0, 0, 512, 288);
    const s = x.createLinearGradient(0, 0, 512, 288); s.addColorStop(0.25, 'rgba(255,255,255,0)'); s.addColorStop(0.35, 'rgba(255,255,255,0.08)'); s.addColorStop(0.45, 'rgba(255,255,255,0)'); x.fillStyle = s; x.fillRect(0, 0, 512, 288);
    T.screen = tex(c, { wrap: false });
  }
  { // mirror glass: cool gradient with soft diagonal highlights
    const [c, x] = cnv(256, 512); const g = x.createLinearGradient(0, 0, 256, 512); g.addColorStop(0, '#eef3f6'); g.addColorStop(0.5, '#c9d3d9'); g.addColorStop(1, '#e3eaee'); x.fillStyle = g; x.fillRect(0, 0, 256, 512);
    x.save(); x.rotate(-0.5); for (const [y, w, a] of [[180, 60, 0.35], [260, 18, 0.25], [420, 40, 0.2]]) { x.fillStyle = `rgba(255,255,255,${a})`; x.fillRect(-200, y, 800, w); } x.restore();
    T.mirror = tex(c, { wrap: false });
  }
  { // black granite
    const [c, x] = cnv(512, 512); x.fillStyle = '#1b1b1e'; x.fillRect(0, 0, 512, 512);
    for (let k = 0; k < 14000; k++) { const v = R(); x.fillStyle = v < 0.6 ? rgb(70, 70, 76, 0.7) : v < 0.9 ? rgb(130, 126, 120, 0.6) : rgb(210, 205, 196, 0.7); x.fillRect(R() * 512, R() * 512, 1 + R() * 2, 1 + R() * 2); }
    T.granite = tex(c);
  }
  { // soft contact shadow
    const [c, x] = cnv(128, 128), im = x.createImageData(128, 128);
    for (let j = 0; j < 128; j++) for (let i = 0; i < 128; i++) {
      const u = (i + 0.5) / 64 - 1, v = (j + 0.5) / 64 - 1, dx = Math.max(Math.abs(u) - 0.5, 0), dy = Math.max(Math.abs(v) - 0.5, 0);
      let a = Math.max(0, 1 - Math.hypot(dx, dy) / 0.5); a = a * a * (3 - 2 * a);
      im.data.set([0, 0, 0, a * 255], (j * 128 + i) * 4);
    }
    x.putImageData(im, 0, 0); T.shadow = tex(c, { wrap: false, srgb: false });
  }
  { // warm wall-washer light
    const [c, x] = cnv(128, 192), im = x.createImageData(128, 192);
    for (let j = 0; j < 192; j++) for (let i = 0; i < 128; i++) {
      const u = (i + 0.5) / 64 - 1, v = (j + 0.5) / 192, w = 0.12 + 0.8 * v;
      const a = Math.exp(-(u * u) / (w * w) * 2.2) * Math.pow(1 - v, 1.3) * Math.min(1, v / 0.06);
      im.data.set([255, 228, 186, a * 255], (j * 128 + i) * 4);
    }
    x.putImageData(im, 0, 0); T.glow = tex(c, { wrap: false });
  }
  return T;
}

function makeMaterials(T, env) {
  const S = o => new THREE.MeshStandardMaterial(o), E = (i) => ({ envMap: env, envMapIntensity: i });
  const M = {
    paint: S({ color: 0xf4efe7, roughness: 0.92 }),
    wallBed: S({ map: T.wallBed, roughness: 0.85 }),
    wallLiv: S({ map: T.wallLiv, roughness: 0.55, ...E(0.35) }),
    bathWall: S({ map: T.bathWall, roughness: 0.18, ...E(0.7) }),
    kitTile: S({ map: T.kitchen, roughness: 0.15, ...E(0.7) }),
    floor: S({ map: T.floor, roughness: 0.2, ...E(0.5) }),
    bathFloor: S({ map: T.bathFloor, roughness: 0.65 }),
    skirting: S({ color: 0xd9cab2, roughness: 0.35, ...E(0.4) }),
    woodL: S({ map: T.woodLight, roughness: 0.5, ...E(0.3) }),
    woodD: S({ map: T.woodDark, roughness: 0.45, ...E(0.35) }),
    woodDoor: S({ map: T.woodDoor, roughness: 0.45, ...E(0.3) }),
    cabinet: S({ color: 0xeee8de, roughness: 0.28, ...E(0.5) }),
    sofa: S({ map: T.fabric, color: 0xd5c6ae, roughness: 0.97 }),
    sofaCush: S({ map: T.fabric, color: 0xe4d9c6, roughness: 0.97 }),
    ochre: S({ map: T.fabric, color: 0xb87a3a, roughness: 0.95 }),
    teal: S({ map: T.fabric, color: 0x4f6f74, roughness: 0.95 }),
    rust: S({ map: T.fabric, color: 0x8a4f37, roughness: 0.95 }),
    linen: S({ map: T.fabric, color: 0xf7f4ef, roughness: 0.95 }),
    duvet: S({ map: T.fabric, color: 0xf0eae0, roughness: 0.95 }),
    headboard: S({ map: T.fabric, color: 0xb9a68e, roughness: 0.96 }),
    chairFab: S({ map: T.fabric, color: 0xe2d6c3, roughness: 0.95 }),
    towel: S({ map: T.fabric, color: 0xcfdde2, roughness: 0.98 }),
    doormat: S({ map: T.fabric, color: 0x8d6c4b, roughness: 1 }),
    curtain: S({ map: T.fabric, color: 0xebe1d1, roughness: 0.96, side: THREE.DoubleSide }),
    runner: S({ map: T.runner, roughness: 0.9 }),
    rugLiv: S({ map: T.rugLiv, roughness: 1 }),
    rugBed: S({ map: T.rugBed, roughness: 1 }),
    glass: S({ color: 0xe4f1f2, roughness: 0.03, transparent: true, opacity: 0.3, depthWrite: false, ...E(1.6) }),
    winGlass: S({ color: 0xc4d9e8, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.32, depthWrite: false, ...E(1.4) }),
    frosted: S({ color: 0xe9eef1, roughness: 0.4, transparent: true, opacity: 0.75, ...E(0.6) }),
    screen: S({ map: T.screen, roughness: 0.1, metalness: 0.2, ...E(1.2) }),
    blackGloss: S({ color: 0x141518, roughness: 0.18, metalness: 0.3, ...E(1.0) }),
    mirror: S({ map: T.mirror, roughness: 0.04, metalness: 0.8, ...E(0.9) }),
    chrome: S({ color: 0xeceff2, roughness: 0.1, metalness: 1, ...E(1.1) }),
    steel: S({ color: 0xcdd1d5, roughness: 0.3, metalness: 0.9, ...E(0.9) }),
    steelDark: S({ color: 0x8e9398, roughness: 0.35, metalness: 0.9, ...E(0.8) }),
    ceramic: S({ color: 0xfcfcfa, roughness: 0.1, ...E(0.85) }),
    granite: S({ map: T.granite, roughness: 0.16, ...E(0.9) }),
    marble: S({ color: 0xf3efe8, roughness: 0.14, ...E(0.6) }),
    threshold: S({ color: 0x6f5848, roughness: 0.2, ...E(0.5) }),
    fridge: S({ color: 0xdadde0, roughness: 0.22, metalness: 0.6, ...E(0.9) }),
    charcoal: S({ color: 0x35312d, roughness: 0.8 }),
    frameW: S({ color: 0xf8f8f6, roughness: 0.3, ...E(0.4) }),
    leaf: S({ color: 0x4a7a37, roughness: 0.65 }),
    leaf2: S({ color: 0x6c9b47, roughness: 0.65 }),
    pot: S({ color: 0xf1ede6, roughness: 0.3, ...E(0.5) }),
    potT: S({ color: 0xb4633f, roughness: 0.8 }),
    soil: S({ color: 0x3a2a1f, roughness: 1 }),
    shade: S({ color: 0xfff2da, emissive: 0xffd9a0, emissiveIntensity: 0.6, roughness: 0.9 }),
    gold: S({ color: 0xc9a25a, roughness: 0.28, metalness: 0.85, ...E(0.9) }),
    art1: S({ map: T.art1, roughness: 0.7 }), art2: S({ map: T.art2, roughness: 0.7 }), art3: S({ map: T.art3, roughness: 0.7 }),
    fruit: S({ color: 0xdc8a2e, roughness: 0.45 }), fruit2: S({ color: 0xa3c044, roughness: 0.45 }),
    shadow: new THREE.MeshBasicMaterial({ map: T.shadow, color: 0x1c140c, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    glow: new THREE.MeshBasicMaterial({ map: T.glow, color: 0xffe6c0, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
  };
  return M;
}

/* ---------- geometry ---------- */
const RB = (w, h, d, r = 0.02, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, Math.max(0.001, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)));
const BX = (w, h, d) => new THREE.BoxGeometry(Math.max(w, 1e-3), Math.max(h, 1e-3), Math.max(d, 1e-3));
const CYL = (rt, rb, h, s = 20) => new THREE.CylinderGeometry(rt, rb, h, s);
const SP = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
const PL = (w, h, sx = 1, sy = 1) => new THREE.PlaneGeometry(w, h, sx, sy);

function triUV(g, s) {
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    if (ay >= ax && ay >= az) uv.setXY(i, p.getX(i) / s, p.getZ(i) / s);
    else if (ax >= az) uv.setXY(i, p.getZ(i) / s, p.getY(i) / s);
    else uv.setXY(i, p.getX(i) / s, p.getY(i) / s);
  }
  uv.needsUpdate = true;
}

class Collector {
  constructor() { this.b = new Map(); }
  add(mat, geo, m, uv) {
    let g = geo.index ? geo.toNonIndexed() : geo; if (g !== geo) geo.dispose();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    if (uv && uv[0] === 'L') triUV(g, uv[1]);
    if (m) g.applyMatrix4(m);
    if (uv && uv[0] === 'W') triUV(g, uv[1]);
    if (!this.b.has(mat)) this.b.set(mat, []);
    this.b.get(mat).push(g);
  }
  build(group, opts) {
    const meshes = new Map();
    for (const [mat, list] of this.b) {
      const g = mergeGeometries(list, false); list.forEach(x => x.dispose());
      const mesh = new THREE.Mesh(g, mat);
      mesh.castShadow = !opts.noCast.has(mat); mesh.receiveShadow = !opts.noReceive.has(mat);
      if (opts.noReflect.has(mat)) mesh.userData.noReflect = true;
      if (mat.transparent) mesh.renderOrder = mat === opts.decal ? 1 : 2;
      group.add(mesh); meshes.set(mat, mesh);
    }
    return meshes;
  }
}

/* =========================================================
   KIT
   ========================================================= */
export function createInteriorKit({ envMap = null, anisotropy = 4 } = {}) {
  const T = makeTextures(anisotropy), M = makeMaterials(T, envMap);
  const noCast = new Set([M.glass, M.winGlass, M.shadow, M.glow, M.floor, M.bathFloor, M.rugLiv, M.rugBed, M.doormat, M.screen, M.paint, M.wallBed, M.wallLiv, M.bathWall, M.kitTile, M.skirting, M.threshold]);
  return { M, T, build: (L, o) => build(L, o, M, noCast) };
}

function build(L, { CX, CY }, M, noCastBase) {
  const C = new Collector(), R = rng(hashStr(L.key)), I = null;
  const floorMat = M.floor.clone();
  const noCast = new Set([...noCastBase, floorMat]);
  const V = new THREE.Vector3(), Q = new THREE.Quaternion(), Eu = new THREE.Euler(), S1 = new THREE.Vector3(1, 1, 1);

  /* ---- coordinate helpers (plan metres -> world) ---- */
  const BOXW = (x0, y0, x1, y1, z0, z1) => { const g = BX(x1 - x0, z1 - z0, y1 - y0); g.translate((x0 + x1) / 2 - CX, (z0 + z1) / 2, (y0 + y1) / 2 - CY); return g; };
  const lineBox = (o, c, a, b, h0, h1, z0, z1) => o === 'h' ? BOXW(a, c + h0, b, c + h1, z0, z1) : BOXW(c + h0, a, c + h1, b, z0, z1);
  const mat4 = (px, py, th, y = FL) => new THREE.Matrix4().makeRotationY(th).setPosition(px - CX, y, py - CY);
  function P(frame) {
    return (mat, geo, x, y, z, o = {}) => {
      Eu.set(o.rx || 0, o.ry || 0, o.rz || 0); Q.setFromEuler(Eu);
      const s = o.s === undefined ? S1 : (typeof o.s === 'number' ? new THREE.Vector3(o.s, o.s, o.s) : new THREE.Vector3(...o.s));
      const m = new THREE.Matrix4().compose(V.set(x, y, z), Q, s);
      C.add(mat, geo, frame.clone().multiply(m), o.uv);
    };
  }
  const UL = s => ['L', s], UW = s => ['W', s];
  const shadowRect = (r, pad = 0.1) => { const w = r[2] - r[0] + 2 * pad, d = r[3] - r[1] + 2 * pad; const g = PL(w, d); g.rotateX(-Math.PI / 2); g.translate((r[0] + r[2]) / 2 - CX, FL + 0.004, (r[1] + r[3]) / 2 - CY); C.add(M.shadow, g, I); };

  /* ---- rooms & their walls ---- */
  const ventOf = new Map(); // small high ventilators on outside walls of toilets
  for (const s of L.segs) if (s.ext && s.room && 'TW'.includes(s.room[1]) && !s.win && s.b - s.a >= 0.8) { const m = (s.a + s.b) / 2; ventOf.set(s, [m - 0.3, m + 0.3]); }
  const rooms = L.rooms.map((r, i) => {
    const [name, kind, x0, y0, x1, y1] = r;
    const mk = (s, o, c, a, b) => ({ s, o, c, a, b });
    const sides = { N: mk('N', 'h', y0, x0, x1), S: mk('S', 'h', y1, x0, x1), W: mk('W', 'v', x0, y0, y1), E: mk('E', 'v', x1, y0, y1) };
    for (const k in sides) {
      const sd = sides[k];
      const on = L.segs.filter(g => g.o === sd.o && Math.abs(g.c - sd.c) < 0.3 && g.b > sd.a + 0.02 && g.a < sd.b - 0.02);
      sd.solid = union(on.map(g => [Math.max(g.a, sd.a), Math.min(g.b, sd.b)]));
      sd.inset = on.length ? Math.max(...on.map(g => g.t)) / 2 : 0;
      sd.ext = union(on.filter(g => g.ext).map(g => [Math.max(g.a, sd.a), Math.min(g.b, sd.b)]));
      sd.windows = L.windows.filter(w => w.room === i && w.o === sd.o && Math.abs(w.c - sd.c) < 0.3).map(w => [w.a, w.b]);
      sd.vents = on.filter(g => ventOf.has(g) && g.ri === i).map(g => ventOf.get(g));
      sd.doors = L.doors.filter(d => (d.room === i || d.other === i) && d.o === sd.o && Math.abs(d.c - sd.c) < 0.3 && d.b > sd.a && d.a < sd.b);
      sd.open = L.open.filter(op => (op.i === i || op.j === i) && op.o === sd.o && Math.abs(op.c - sd.c) < 0.3);
    }
    const rect = [x0 + sides.W.inset, y0 + sides.N.inset, x1 - sides.E.inset, y1 - sides.S.inset];
    sides.N.face = rect[1]; sides.S.face = rect[3]; sides.W.face = rect[0]; sides.E.face = rect[2];
    sides.N.range = [rect[0], rect[2]]; sides.S.range = [rect[0], rect[2]]; sides.W.range = [rect[1], rect[3]]; sides.E.range = [rect[1], rect[3]];
    const Rm = { i, name, kind, x0, y0, x1, y1, rect, sides, list: [sides.N, sides.S, sides.W, sides.E], keep: [], cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, area: (x1 - x0) * (y1 - y0), feature: null, wallItems: [] };
    for (const sd of Rm.list) {
      for (const d of sd.doors) Rm.keep.push({ r: sideRect(sd, d.a - 0.04, d.b + 0.04, d.room === i ? 0.88 : 0.6), kind: 'door' });
      for (const op of sd.open) { const a = Math.max(op.a, sd.range[0]), b = Math.min(op.b, sd.range[1]); if (b - a > 0.1) Rm.keep.push({ r: sideRect(sd, a, b, 0.35), kind: 'open' }); }
    }
    return Rm;
  });
  function footprint(sd, u, w, d, off = 0) {
    const f = sd.face, h = w / 2;
    if (sd.s === 'N') return [u - h, f + off, u + h, f + off + d];
    if (sd.s === 'S') return [u - h, f - off - d, u + h, f - off];
    if (sd.s === 'W') return [f + off, u - h, f + off + d, u + h];
    return [f - off - d, u - h, f - off, u + h];
  }
  function sideRect(sd, a, b, d, off = 0) { return footprint(sd, (a + b) / 2, b - a, d, off); }
  function frame(sd, u, off = 0) {
    if (sd.s === 'N') return mat4(u, sd.face + off, 0);
    if (sd.s === 'S') return mat4(u, sd.face - off, Math.PI);
    if (sd.s === 'W') return mat4(sd.face + off, u, Math.PI / 2);
    return mat4(sd.face - off, u, -Math.PI / 2);
  }
  // local +X of a wall frame runs along the plan axis in this direction:
  const alongSign = sd => (sd.s === 'N' || sd.s === 'E') ? 1 : -1;
  const mid = sd => (sd.range[0] + sd.range[1]) / 2;
  const depthOf = (Rm, sd) => sd.o === 'h' ? Rm.rect[3] - Rm.rect[1] : Rm.rect[2] - Rm.rect[0];
  const solidCovers = (sd, a, b) => sd.solid.some(([s0, s1]) => s0 <= a + 0.01 && s1 >= b - 0.01);
  const winHit = (sd, a, b) => sd.windows.concat(sd.vents).some(([w0, w1]) => w0 < b - 0.01 && w1 > a + 0.01);
  // keep-out kinds: 'door' (swing area), 'item' (furniture), 'walk' (clearance in front of furniture), 'open' (wall-less edge)
  const hardHit = (Rm, r) => Rm.keep.some(k => (k.kind === 'door' || k.kind === 'item') && ov(r, k.r));        // small furniture
  const anyHit = (Rm, r) => Rm.keep.some(k => k.kind !== 'open' && ov(r, k.r));                                  // big furniture
  const freeRect = (Rm, r) => inside(r, Rm.rect) && !Rm.keep.some(k => k.kind === 'item' && ov(r, k.r));          // walking clearance
  const placeOK = (Rm, r) => inside(r, Rm.rect) && !hardHit(Rm, r);
  const cornerBonus = (sd, u, w) => (Math.abs(u - w / 2 - sd.range[0]) < 0.07 || Math.abs(sd.range[1] - u - w / 2) < 0.07) ? 1 : 0;
  const solidLen = sd => sd.solid.reduce((a, [p, q]) => a + Math.max(0, Math.min(q, sd.range[1]) - Math.max(p, sd.range[0])), 0);

  function findWall(Rm, sp) {
    let best = null;
    for (const w of sp.ws) for (const sd of (sp.sides || Rm.list)) {
      if (!sd || !sd.solid.length) continue;
      const [lo, hi] = sd.range;
      for (const [s0, s1] of sd.solid) {
        const a0 = Math.max(s0, lo), a1 = Math.min(s1, hi);
        if (a1 - a0 < w - 1e-3) continue;
        const cands = new Set([a0 + w / 2, a1 - w / 2, (a0 + a1) / 2, mid(sd)]);
        for (let u = a0 + w / 2; u <= a1 - w / 2 + 1e-6; u += 0.05) cands.add(+u.toFixed(3));
        for (const u of cands) {
          if (u - w / 2 < a0 - 1e-3 || u + w / 2 > a1 + 1e-3) continue;
          const fp = footprint(sd, u, w, sp.d);
          if (!inside(fp, Rm.rect)) continue;
          const wh = winHit(sd, u - w / 2, u + w / 2);
          if (sp.tall && wh) continue;
          if (Rm.keep.some(k => ov(fp, k.r) && (k.kind === 'door' || k.kind === 'item' || (k.kind === 'walk' && !sp.soft)))) continue;
          if (sp.extra && !sp.extra(sd, u, w, fp)) continue;
          const sc = (sp.score ? sp.score(sd, u, w, fp) : 0) + w * (sp.wWeight ?? 2) - (wh ? (sp.winPenalty ?? 1.5) : 0);
          if (!best || sc > best.sc + 1e-6) best = { sd, u, w, fp, sc };
        }
      }
    }
    return best;
  }
  const occupy = (Rm, r, soft = false) => Rm.keep.push({ r, kind: soft ? 'walk' : 'item' });

  /* ---- decor pieces ---- */
  function painting(sd, u, y, w, h, art, off = 0) {
    const p = P(frame(sd, u, off));
    p(M.gold, RB(w, h, 0.03, 0.006, 2), 0, y, 0.015);
    p(art, PL(w - 0.07, h - 0.07), 0, y, 0.0315);
  }
  function glow(sd, u, off = 0) { P(frame(sd, u, off + 0.004))(M.glow, PL(0.75, 1.15), 0, WALL_T - 0.58, 0); }
  function plant(px, py, s = 1, potMat = M.pot) {
    const p = P(mat4(px, py, R() * 6));
    p(potMat, CYL(0.16 * s, 0.12 * s, 0.34 * s, 24), 0, 0.17 * s, 0);
    p(potMat, new THREE.TorusGeometry(0.155 * s, 0.012 * s, 8, 28), 0, 0.34 * s, 0, { rx: Math.PI / 2 });
    p(M.soil, CYL(0.148 * s, 0.148 * s, 0.02, 20), 0, 0.33 * s, 0);
    for (let k = 0; k < 3; k++) p(M.woodD, CYL(0.007, 0.01, 0.5 * s, 6), (R() - 0.5) * 0.06, 0.58 * s, (R() - 0.5) * 0.06, { rz: (R() - 0.5) * 0.3, rx: (R() - 0.5) * 0.3 });
    for (let k = 0; k < 22; k++) {
      const a = k * 2.399, hgt = (0.5 + R() * 0.55) * s, rr = (0.05 + R() * 0.17) * s;
      p(k % 3 ? M.leaf : M.leaf2, SP(1, 10, 6), Math.cos(a) * rr, hgt, Math.sin(a) * rr, { ry: -a, rz: 0.5 + R() * 0.5, s: [0.16 * s, 0.018 * s, 0.075 * s] });
    }
  }
  function curtains(sd, a, b, Rm) {
    let n = 0;
    for (const [c0, sgn] of [[a, -1], [b, 1]]) {
      const u = clamp(c0 + sgn * 0.08, sd.range[0] + 0.24, sd.range[1] - 0.24), fp = sideRect(sd, u - 0.22, u + 0.22, 0.16);
      if (hardHit(Rm, fp)) continue;
      const g = PL(0.44, WALL_T - 0.14, 28, 1), pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) { const x = pos.getX(i); pos.setZ(i, Math.sin((x + 0.22) / 0.44 * Math.PI * 7) * 0.035); }
      g.computeVertexNormals();
      P(frame(sd, u))(M.curtain, g, 0, (WALL_T - 0.14) / 2 + 0.03, 0.1, { uv: UL(0.3) }); n++;
    }
    if (!n) return;
    const r0 = Math.max(a - 0.35, sd.range[0] + 0.03), r1 = Math.min(b + 0.35, sd.range[1] - 0.03);
    P(frame(sd, (r0 + r1) / 2))(M.chrome, CYL(0.011, 0.011, r1 - r0, 10), 0, WALL_T - 0.08, 0.1, { rz: Math.PI / 2 });
  }

  /* ---- furniture ---- */
  function bed(sd, u, w) {
    const p = P(frame(sd, u)), Lb = 2.05, mw = w - 0.08;
    p(M.woodD, RB(w + 0.04, 1.08, 0.07, 0.02), 0, 0.54, 0.035, { uv: UL(0.9) });
    p(M.headboard, RB(w - 0.12, 0.6, 0.06, 0.03, 4), 0, 0.74, 0.09, { uv: UL(0.25) });
    p(M.woodD, RB(w, 0.28, Lb - 0.07, 0.02), 0, 0.16, 0.07 + (Lb - 0.07) / 2, { uv: UL(0.9) });
    p(M.linen, RB(mw, 0.2, Lb - 0.17, 0.06, 4), 0, 0.4, 0.1 + (Lb - 0.17) / 2, { uv: UL(0.25) });
    const d0 = 0.74, d1 = Lb - 0.03;
    p(M.duvet, RB(w + 0.02, 0.06, d1 - d0, 0.03, 3), 0, 0.525, (d0 + d1) / 2, { uv: UL(0.25) });
    p(M.duvet, RB(w + 0.02, 0.09, 0.15, 0.04, 3), 0, 0.535, d0 + 0.06, { uv: UL(0.25) });
    for (const s of [-1, 1]) p(M.duvet, RB(0.03, 0.27, d1 - d0, 0.014), s * (w / 2 + 0.005), 0.42, (d0 + d1) / 2, { uv: UL(0.25) });
    p(M.duvet, RB(w + 0.02, 0.27, 0.03, 0.014), 0, 0.42, d1, { uv: UL(0.25) });
    p(M.runner, RB(w + 0.07, 0.07, 0.5, 0.03), 0, 0.54, Lb - 0.44);
    const np = w > 1.2 ? 2 : 1;
    for (let k = 0; k < np; k++) p(M.linen, RB(0.62, 0.44, 0.15, 0.07, 4), np === 1 ? 0 : (k ? 1 : -1) * w / 4.1, 0.76, 0.2, { rx: -0.42, uv: UL(0.25) });
    p(R() < 0.5 ? M.ochre : M.teal, RB(0.42, 0.34, 0.12, 0.06, 4), 0, 0.72, 0.36, { rx: -0.32, uv: UL(0.25) });
  }
  function sideTable(sd, u) {
    const p = P(frame(sd, u));
    p(M.woodD, RB(0.45, 0.48, 0.4, 0.015), 0, 0.24, 0.2, { uv: UL(0.8) });
    p(M.charcoal, BX(0.4, 0.008, 0.004), 0, 0.33, 0.401);
    p(M.gold, RB(0.11, 0.014, 0.016, 0.006), 0, 0.4, 0.408);
    p(M.ceramic, CYL(0.055, 0.075, 0.22, 20), 0.04, 0.59, 0.19);
    p(M.shade, CYL(0.11, 0.15, 0.21, 28), 0.04, 0.8, 0.19);
  }
  function wardrobe(sd, u, w) {
    const p = P(frame(sd, u)), h = 2.05, d = 0.6, n = Math.max(2, Math.round(w / 0.45)), dw = w / n;
    p(M.woodL, BX(w, h - 0.08, d), 0, 0.08 + (h - 0.08) / 2, d / 2, { uv: UL(0.9) });
    p(M.charcoal, BX(w - 0.04, 0.08, d - 0.05), 0, 0.04, d / 2 - 0.02);
    for (let k = 1; k < n; k++) p(M.charcoal, BX(0.006, h - 0.1, 0.004), -w / 2 + k * dw, 0.08 + (h - 0.08) / 2, d + 0.002);
    p(M.charcoal, BX(w - 0.01, 0.006, 0.004), 0, 1.72, d + 0.002);
    p(M.mirror, BX(dw - 0.09, 1.38, 0.006), -w / 2 + dw / 2, 0.98, d + 0.004);
    for (let k = 0; k < n; k++) { const hx = -w / 2 + (k + 0.5) * dw + (k % 2 === 0 ? dw / 2 - 0.05 : -dw / 2 + 0.05); p(M.chrome, RB(0.016, 0.34, 0.022, 0.007), hx, 1.0, d + 0.014); }
  }
  function dresser(sd, u, w) {
    const p = P(frame(sd, u));
    p(M.woodD, RB(w, 0.74, 0.42, 0.012), 0, 0.37, 0.21, { uv: UL(0.8) });
    p(M.charcoal, BX(w - 0.04, 0.006, 0.004), 0, 0.5, 0.421);
    p(M.gold, RB(0.14, 0.014, 0.016, 0.006), 0, 0.62, 0.43);
    p(M.woodD, RB(0.62, 0.86, 0.025, 0.01), 0, 1.38, 0.0125, { uv: UL(0.8) });
    p(M.mirror, BX(0.56, 0.8, 0.006), 0, 1.38, 0.027);
    p(M.ceramic, CYL(0.035, 0.04, 0.12, 16), w / 2 - 0.12, 0.8, 0.2);
    p(M.gold, CYL(0.03, 0.03, 0.08, 16), w / 2 - 0.22, 0.78, 0.22);
  }
  function sofa(sd, u, w) { sofaAt(frame(sd, u), w); }
  function sofaAt(fr, w) {
    const p = P(fr), d = 0.88, arm = w < 1.4 ? 0.15 : 0.18, n = w >= 1.8 ? 3 : 2, cw = (w - 2 * arm) / n - 0.012, F = UL(0.25);
    p(M.sofa, RB(w, 0.28, d, 0.04), 0, 0.22, d / 2, { uv: F });
    p(M.sofa, RB(w, 0.52, 0.2, 0.06, 4), 0, 0.56, 0.1, { uv: F });
    for (const s of [-1, 1]) p(M.sofa, RB(arm, 0.56, d, 0.07, 4), s * (w / 2 - arm / 2), 0.36, d / 2, { uv: F });
    for (let k = 0; k < n; k++) {
      const x = -w / 2 + arm + (k + 0.5) * (cw + 0.012);
      p(M.sofaCush, RB(cw, 0.15, d - 0.23, 0.06, 4), x, 0.43, 0.2 + (d - 0.22) / 2, { uv: F });
      p(M.sofaCush, RB(cw, 0.42, 0.16, 0.07, 4), x, 0.72, 0.29, { rx: -0.13, uv: F });
    }
    p(M.ochre, RB(0.42, 0.42, 0.12, 0.06, 4), -(w / 2 - arm - 0.26), 0.7, 0.42, { rx: -0.3, ry: 0.18, uv: F });
    p(M.teal, RB(0.42, 0.42, 0.12, 0.06, 4), (w / 2 - arm - 0.26), 0.7, 0.42, { rx: -0.3, ry: -0.18, uv: F });
    for (const [x, z] of [[-1, 0], [1, 0], [-1, 1], [1, 1]]) p(M.woodD, CYL(0.018, 0.014, 0.08, 10), x * (w / 2 - 0.06), 0.04, z ? d - 0.06 : 0.06);
  }
  function tvUnit(sd, u, w, Rm) {
    const p = P(frame(sd, u)), tw = Math.min(1.25, w - 0.2), th = tw * 0.5625;
    p(M.woodD, BX(w + 0.12, WALL_T - 0.14, 0.025), 0, 0.06 + (WALL_T - 0.14) / 2, 0.0125, { uv: UL(0.9) });
    p(M.woodD, RB(w, 0.38, 0.4, 0.015), 0, 0.31, 0.2 + 0.025, { uv: UL(0.8) });
    p(M.charcoal, BX(w - 0.1, 0.12, 0.3), 0, 0.06, 0.2);
    for (let k = 1; k < 3; k++) p(M.charcoal, BX(0.005, 0.3, 0.004), -w / 2 + k * w / 3, 0.31, 0.427);
    p(M.blackGloss, RB(tw, th, 0.045, 0.01), 0, 1.24, 0.025 + 0.06);
    p(M.screen, PL(tw - 0.03, th - 0.03), 0, 1.24, 0.025 + 0.06 + 0.0235);
    p(M.blackGloss, RB(0.72, 0.07, 0.09, 0.02), 0, 0.535, 0.24);
    p(M.ceramic, CYL(0.05, 0.07, 0.24, 18), w / 2 - 0.2, 0.62, 0.22);
    for (let k = 0; k < 7; k++) p(M.leaf, SP(1, 8, 6), w / 2 - 0.2 + (R() - 0.5) * 0.12, 0.8 + R() * 0.16, 0.22 + (R() - 0.5) * 0.1, { ry: k, rz: 0.9, s: [0.11, 0.012, 0.04] });
    p(M.woodL, RB(0.24, 0.035, 0.17, 0.006), -w / 2 + 0.25, 0.517, 0.22, { uv: UL(0.5) });
    p(M.rust, RB(0.21, 0.03, 0.15, 0.006), -w / 2 + 0.25, 0.55, 0.22);
    Rm.feature = sd;
  }
  function coffeeTable(px, py, th, w, d) {
    const p = P(mat4(px, py, th));
    p(M.glass, RB(w, 0.02, d, 0.008), 0, 0.42, 0);
    p(M.woodD, RB(w - 0.05, 0.03, d - 0.05, 0.01), 0, 0.395, 0, { uv: UL(0.8) });
    p(M.woodD, RB(w - 0.12, 0.025, d - 0.12, 0.008), 0, 0.12, 0, { uv: UL(0.8) });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) p(M.woodD, BX(0.045, 0.38, 0.045), sx * (w / 2 - 0.05), 0.19, sz * (d / 2 - 0.05));
    p(M.teal, RB(0.25, 0.03, 0.18, 0.006), -w / 4, 0.447, 0.02, { ry: 0.15 });
    p(M.ochre, RB(0.21, 0.026, 0.15, 0.006), -w / 4, 0.475, 0.02, { ry: -0.1 });
    p(M.ceramic, CYL(0.1, 0.055, 0.07, 24), w / 4, 0.467, 0);
    for (let k = 0; k < 3; k++) p(k ? M.fruit : M.fruit2, SP(0.034), w / 4 + Math.cos(k * 2.1) * 0.035, 0.5, Math.sin(k * 2.1) * 0.035);
  }
  function rug(px, py, th, w, d, mat) { P(mat4(px, py, th))(mat, BX(w, 0.012, d), 0, 0.007, 0); }
  function chair(px, py, th) {
    const p = P(mat4(px, py, th));
    p(M.chairFab, RB(0.44, 0.07, 0.44, 0.025, 3), 0, 0.47, 0, { uv: UL(0.25) });
    p(M.chairFab, RB(0.44, 0.44, 0.06, 0.025, 3), 0, 0.73, -0.2, { rx: -0.1, uv: UL(0.25) });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) p(M.woodD, BX(0.035, 0.44, 0.035), sx * 0.18, 0.22, sz * 0.18);
  }
  function diningTable(px, py, th, w, d) {
    const p = P(mat4(px, py, th));
    p(M.marble, RB(w, 0.035, d, 0.012), 0, 0.755, 0);
    p(M.woodD, BX(w - 0.12, 0.06, d - 0.12), 0, 0.71, 0, { uv: UL(0.8) });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) p(M.woodD, BX(0.05, 0.72, 0.05), sx * (w / 2 - 0.07), 0.36, sz * (d / 2 - 0.07));
    p(M.ceramic, CYL(0.13, 0.07, 0.08, 28), 0, 0.81, 0);
    for (let k = 0; k < 4; k++) p(k % 2 ? M.fruit : M.fruit2, SP(0.038), Math.cos(k * 1.6) * 0.05, 0.85, Math.sin(k * 1.6) * 0.05);
  }
  function counter(sd, u, w, opts) {
    const p = P(frame(sd, u)), s = alongSign(sd), lx = a => (a - u) * s; // plan coordinate -> local x
    p(M.cabinet, BX(w, 0.74, 0.56), 0, 0.1 + 0.37, 0.28);
    p(M.charcoal, BX(w, 0.1, 0.5), 0, 0.05, 0.25);
    p(M.granite, BX(w + 0.02, 0.04, 0.62), 0, 0.86, 0.31, { uv: UW(0.6) });
    const n = Math.max(1, Math.round(w / 0.5)), sw = w / n;
    for (let k = 0; k < n; k++) {
      const x = -w / 2 + (k + 0.5) * sw;
      if (k) p(M.charcoal, BX(0.005, 0.66, 0.004), -w / 2 + k * sw, 0.47, 0.562);
      p(M.steel, RB(Math.min(0.2, sw - 0.12), 0.014, 0.02, 0.006), x, 0.77, 0.572);
    }
    if (opts.hob !== undefined) {
      const x = lx(opts.hob);
      p(M.blackGloss, RB(0.62, 0.012, 0.42, 0.004), x, 0.886, 0.3);
      for (const dx of [-0.16, 0.16]) { p(M.steel, CYL(0.075, 0.075, 0.012, 28), x + dx, 0.894, 0.3); p(M.charcoal, CYL(0.045, 0.045, 0.016, 20), x + dx, 0.9, 0.3); }
      if (opts.hood) { p(M.steel, RB(0.7, 0.1, 0.48, 0.012), x, 1.62, 0.24); p(M.steel, BX(0.26, 0.42, 0.24), x, 1.88, 0.12); }
    }
    if (opts.sink !== undefined) {
      const x = lx(opts.sink);
      p(M.steel, BX(0.6, 0.006, 0.45), x, 0.883, 0.3);
      p(M.steelDark, BX(0.48, 0.004, 0.35), x, 0.8865, 0.31);
      p(M.chrome, CYL(0.016, 0.02, 0.26, 14), x, 1.01, 0.08);
      p(M.chrome, CYL(0.012, 0.012, 0.18, 14), x, 1.13, 0.17, { rx: Math.PI / 2 });
    }
    if (opts.jars !== undefined) { const x = lx(opts.jars); for (let k = 0; k < 3; k++) p(k === 1 ? M.woodL : M.ceramic, CYL(0.045, 0.045, 0.12 + k * 0.03, 18), x + (k - 1) * 0.11, 0.94 + k * 0.015, 0.12); }
  }
  function fridge(sd, u) {
    const p = P(frame(sd, u));
    p(M.fridge, RB(0.66, 1.72, 0.66, 0.025), 0, 0.86, 0.34);
    p(M.charcoal, BX(0.62, 0.006, 0.004), 0, 1.2, 0.672);
    p(M.steel, RB(0.022, 0.32, 0.025, 0.008), 0.27, 1.45, 0.685);
    p(M.steel, RB(0.022, 0.42, 0.025, 0.008), 0.27, 0.82, 0.685);
  }
  function wc(sd, u) {
    const p = P(frame(sd, u));
    p(M.ceramic, RB(0.3, 0.3, 0.36, 0.08, 4), 0, 0.15, 0.32);
    p(M.ceramic, RB(0.38, 0.13, 0.56, 0.06, 4), 0, 0.36, 0.33);
    p(M.ceramic, RB(0.38, 0.03, 0.48, 0.05, 4), 0, 0.44, 0.36);
    p(M.ceramic, RB(0.4, 0.38, 0.17, 0.03, 3), 0, 0.64, 0.09);
    p(M.chrome, CYL(0.022, 0.022, 0.012, 16), 0, 0.836, 0.09);
    p(M.chrome, RB(0.04, 0.12, 0.03, 0.01), 0.36, 0.55, 0.02);
  }
  function basin(sd, u) {
    const p = P(frame(sd, u));
    p(M.ceramic, RB(0.52, 0.14, 0.42, 0.05, 4), 0, 0.8, 0.21);
    p(M.steelDark, CYL(0.16, 0.16, 0.004, 28), 0, 0.872, 0.23, { s: [1, 1, 0.75] });
    p(M.chrome, CYL(0.016, 0.02, 0.2, 14), 0, 0.97, 0.06);
    p(M.chrome, CYL(0.011, 0.011, 0.1, 12), 0, 1.06, 0.1, { rx: Math.PI / 2 });
    p(M.chrome, RB(0.58, 0.76, 0.02, 0.01), 0, 1.5, 0.01);
    p(M.mirror, BX(0.54, 0.72, 0.006), 0, 1.5, 0.022);
  }
  function shower(sd, u) {
    const p = P(frame(sd, u));
    p(M.chrome, CYL(0.012, 0.012, 0.32, 12), 0, 1.98, 0.16, { rx: Math.PI / 2 });
    p(M.chrome, CYL(0.11, 0.11, 0.025, 30), 0, 1.965, 0.3);
    p(M.chrome, CYL(0.07, 0.07, 0.015, 24), 0, 1.1, 0.008, { rx: Math.PI / 2 });
    p(M.chrome, RB(0.02, 0.09, 0.03, 0.008), 0, 1.1, 0.03);
    p(M.chrome, BX(0.12, 0.004, 0.12), 0, 0.003, 0.4);
  }
  function towelRail(sd, u) {
    const p = P(frame(sd, u));
    p(M.chrome, CYL(0.01, 0.01, 0.55, 10), 0, 1.25, 0.08, { rz: Math.PI / 2 });
    p(M.towel, RB(0.42, 0.55, 0.035, 0.014), 0, 1.0, 0.085, { uv: UL(0.2) });
  }
  function shoeRack(sd, u, w) {
    const p = P(frame(sd, u));
    p(M.woodD, RB(w, 0.9, 0.35, 0.012), 0, 0.45, 0.175, { uv: UL(0.8) });
    for (let y = 0.12; y < 0.86; y += 0.06) p(M.charcoal, BX(w - 0.06, 0.006, 0.004), 0, y, 0.351);
    p(M.charcoal, BX(0.006, 0.86, 0.004), 0, 0.45, 0.352);
    p(M.ceramic, CYL(0.08, 0.05, 0.05, 20), w / 4, 0.925, 0.17);
  }

  /* ---- furnish each room ---- */
  const hasWC = L.rooms.some(r => r[1] === 'W');
  for (const Rm of rooms) {
    const k = Rm.kind;
    if (k === 'B') furnishBedroom(Rm);
    else if (k === 'L') furnishLiving(Rm);
    else if (k === 'K') furnishKitchen(Rm);
    else if (k === 'D') furnishDining(Rm);
    else if (k === 'T') furnishBath(Rm, !hasWC);
    else if (k === 'W') furnishWC(Rm);
  }
  entrance();

  function furnishBedroom(Rm) {
    const bd = findWall(Rm, {
      ws: [1.62, 1.42, 1.0], d: 2.05, winPenalty: 3, wWeight: 3,
      extra: (sd, u, w) => {
        const foot = footprint(sd, u, w, 0.5, 2.05); if (!freeRect(Rm, foot)) return false;
        const l = sideRect(sd, u - w / 2 - 0.5, u - w / 2, 2.05), r = sideRect(sd, u + w / 2, u + w / 2 + 0.5, 2.05);
        return freeRect(Rm, l) || freeRect(Rm, r);
      },
      score: (sd, u) => (sd.doors.length ? -2 : 0) - Math.abs(u - mid(sd)) * 1.2 + solidLen(sd) * 0.3
    });
    if (bd) {
      const { sd, u, w, fp } = bd; bed(sd, u, w); occupy(Rm, fp); shadowRect(fp, 0.08);
      occupy(Rm, footprint(sd, u, w, 0.5, 2.05), true);
      for (const s of [-1, 1]) {
        const r = sideRect(sd, s < 0 ? u - w / 2 - 0.5 : u + w / 2, s < 0 ? u - w / 2 : u + w / 2 + 0.5, 2.05);
        if (freeRect(Rm, r)) occupy(Rm, r, true);
        const tu = u + s * (w / 2 + 0.25), tf = footprint(sd, tu, 0.45, 0.4);
        if (inside(tf, Rm.rect) && !hardHit(Rm, tf) && solidCovers(sd, tu - 0.225, tu + 0.225)) { sideTable(sd, tu); occupy(Rm, tf); shadowRect(tf, 0.05); }
      }
      Rm.feature = sd;
      if (!winHit(sd, u - w / 2, u + w / 2)) { painting(sd, u, 1.62, Math.min(1.0, w * 0.62), 0.5, R() < 0.5 ? M.art3 : M.art2, 0.012); glow(sd, u - w * 0.32, 0.012); glow(sd, u + w * 0.32, 0.012); }
      // rug under the foot of the bed
      const c = [(fp[0] + fp[2]) / 2, (fp[1] + fp[3]) / 2], dir = { N: [0, 1], S: [0, -1], W: [1, 0], E: [-1, 0] }[sd.s];
      const rc = [c[0] + dir[0] * 0.55, c[1] + dir[1] * 0.55], along = sd.o === 'h';
      let rw = w + 0.7, rd = 1.5; const rr = [rc[0] - (along ? rw : rd) / 2, rc[1] - (along ? rd : rw) / 2, rc[0] + (along ? rw : rd) / 2, rc[1] + (along ? rd : rw) / 2];
      const cl = [Math.max(rr[0], Rm.rect[0] + 0.05), Math.max(rr[1], Rm.rect[1] + 0.05), Math.min(rr[2], Rm.rect[2] - 0.05), Math.min(rr[3], Rm.rect[3] - 0.05)];
      rug((cl[0] + cl[2]) / 2, (cl[1] + cl[3]) / 2, 0, cl[2] - cl[0], cl[3] - cl[1], M.rugBed);
    }
    const wd = findWall(Rm, {
      ws: [1.8, 1.5, 1.2, 0.9], d: 0.6, tall: true, wWeight: 2.5,
      extra: (sd, u, w) => freeRect(Rm, footprint(sd, u, w, 0.55, 0.6)),
      score: (sd, u, w) => cornerBonus(sd, u, w) * 1.5 + (bd && sd === bd.sd ? -3 : 0)
    });
    if (wd) { wardrobe(wd.sd, wd.u, wd.w); occupy(Rm, wd.fp); occupy(Rm, footprint(wd.sd, wd.u, wd.w, 0.55, 0.6), true); shadowRect(wd.fp, 0.06); }
    if (Rm.area > 9.3) {
      const dr = findWall(Rm, { ws: [0.9], d: 0.42, tall: true, extra: (sd, u, w) => freeRect(Rm, footprint(sd, u, w, 0.5, 0.42)), score: (sd, u, w) => cornerBonus(sd, u, w) });
      if (dr) { dresser(dr.sd, dr.u, dr.w); occupy(Rm, dr.fp); shadowRect(dr.fp, 0.05); }
    }
    for (const sd of Rm.list) for (const [a, b] of sd.windows) curtains(sd, a, b, Rm);
  }

  // plan point at `o` metres in from a wall face, at along-position u
  function offPt(sd, u, o) { return sd.s === 'N' ? [u, sd.face + o] : sd.s === 'S' ? [u, sd.face - o] : sd.s === 'W' ? [sd.face + o, u] : [sd.face - o, u]; }
  function offRect(sd, u, w, o0, o1) { return footprint(sd, u, w, o1 - o0, o0); }
  function loungeBetween(Rm, sd, u, w, near, far) { // coffee table + rug between sofa front and TV unit, measured from wall `sd`
    const gap = far - near; if (gap < 0.6) return;
    const td = Math.min(0.55, gap - 0.8), tw = Math.min(1.1, w - 0.45), c = offPt(sd, u, near + gap / 2), along = sd.o === 'h';
    const tr = offRect(sd, u, tw, near + gap / 2 - td / 2, near + gap / 2 + td / 2);
    if (gap >= 1.15 && !hardHit(Rm, tr)) { coffeeTable(c[0], c[1], along ? 0 : Math.PI / 2, tw, td); occupy(Rm, tr); shadowRect(tr, 0.06); }
    const r0 = near - 0.28, r1 = far - 0.16, span = (along ? Rm.rect[2] - Rm.rect[0] : Rm.rect[3] - Rm.rect[1]) - 0.2, rw = Math.min(w + 0.3, span);
    const ru = clamp(u, sd.range[0] + rw / 2 + 0.1, sd.range[1] - rw / 2 - 0.1), rc = offPt(sd, ru, (r0 + r1) / 2);
    rug(rc[0], rc[1], along ? 0 : Math.PI / 2, rw, r1 - r0, M.rugLiv);
  }
  function sofaPlant(Rm, sd, u, w, off) {
    for (const s of [1, -1]) {
      const pu = u + s * (w / 2 + 0.26), pf = footprint(sd, pu, 0.44, 0.44, off + 0.04);
      if (placeOK(Rm, pf) && pu > sd.range[0] && pu < sd.range[1]) { const c = [(pf[0] + pf[2]) / 2, (pf[1] + pf[3]) / 2]; plant(c[0], c[1], 1.05); occupy(Rm, pf); shadowRect(pf, 0.02); return true; }
    }
    return false;
  }
  function furnishLiving(Rm) {
    // Layout A: sofa against a wall, TV on the wall opposite
    let sf = findWall(Rm, {
      ws: [2.1, 1.9, 1.7, 1.5, 1.3], d: 0.88, winPenalty: 1.2, wWeight: 1.5,
      extra: (sd, u, w) => freeRect(Rm, footprint(sd, u, w, 0.45, 0.88)),
      score: (sd, u) => {
        const opp = Rm.sides[OPP[sd.s]]; let sc = -Math.abs(u - mid(sd)) * 0.8 + (sd.doors.length ? -1.5 : 0) + (sd.open.length ? -2 : 0);
        if (opp && opp.solid.some(([a, b]) => Math.min(b, u + 0.8) - Math.max(a, u - 0.8) > 1.25) && !winHit(opp, u - 0.7, u + 0.7)) sc += 4;
        const dep = depthOf(Rm, sd); if (dep >= 2.35) sc += 1.5; if (dep < 2.0) sc -= 4;
        return sc;
      }
    });
    let tv = null;
    if (sf) {
      const opp = Rm.sides[OPP[sf.sd.s]];
      occupy(Rm, sf.fp);
      tv = findWall(Rm, { ws: [1.8, 1.6, 1.4, 1.2], d: 0.43, tall: true, sides: [opp], score: (s2, u2) => -Math.abs(u2 - sf.u) * 3 });
      Rm.keep.pop();
      if (!tv) sf = null;
    }
    if (sf && tv) {
      const { sd, u, w, fp } = sf; sofa(sd, u, w); occupy(Rm, fp); shadowRect(fp, 0.07);
      tvUnit(tv.sd, tv.u, tv.w, Rm); occupy(Rm, tv.fp); shadowRect(tv.fp, 0.05);
      loungeBetween(Rm, sd, u, w, 0.88, depthOf(Rm, sd) - 0.43);
      if (!winHit(sd, u - w / 2, u + w / 2)) { painting(sd, u, 1.5, Math.min(1.2, w * 0.55), 0.62, M.art1); glow(sd, u - w * 0.3); glow(sd, u + w * 0.3); }
      else artOnSideWall(Rm, [sd, tv.sd]);
      sofaPlant(Rm, sd, u, w, 0);
    } else {
      // Layout B: TV on the best wall, sofa free-standing facing it (its back to the dining area)
      tv = findWall(Rm, {
        ws: [1.8, 1.6, 1.4, 1.2], d: 0.43, tall: true, wWeight: 1,
        score: (sd, u) => (depthOf(Rm, sd) >= 2.4 ? 3 : -3) + (sd.doors.length ? -1 : 0) - Math.abs(u - mid(sd)) * 0.8 + (Rm.sides[OPP[sd.s]].solid.length ? 0 : 1)
      });
      if (tv) {
        tvUnit(tv.sd, tv.u, tv.w, Rm); occupy(Rm, tv.fp); shadowRect(tv.fp, 0.05);
        const sd = tv.sd, dep = depthOf(Rm, sd), maxBack = Math.min(dep - 0.02, 3.3);
        let placed = null;
        // score every width / distance / sideways shift: wide, centred on the TV, comfortable distance
        for (const w of [2.1, 1.9, 1.7, 1.5, 1.3]) for (let back = maxBack; back >= 0.43 + 0.75 + 0.88 - 1e-6; back -= 0.05)
          for (let t = 0; t <= sd.range[1] - sd.range[0]; t += 0.05) for (const sg of [1, -1]) {
            const u = tv.u + sg * t, fp = offRect(sd, u, w, back - 0.88, back);
            if (u - w / 2 < sd.range[0] - 0.01 || u + w / 2 > sd.range[1] + 0.01 || !inside(fp, Rm.rect) || hardHit(Rm, fp)) continue;
            const sc = w * 2 - t * 3 - Math.max(0, 2.6 - back) * 1.5;
            if (!placed || sc > placed.sc) placed = { u, w, fp, back, sc };
          }
        if (placed) {
          const { u, w, fp, back } = placed, front = back - 0.88, f = frame(sd, u, back).multiply(new THREE.Matrix4().makeRotationY(Math.PI));
          sofaAt(f, w); occupy(Rm, fp); shadowRect(fp, 0.07);
          loungeBetween(Rm, sd, u, w, 0.43, front);
        }
        artOnSideWall(Rm, [sd]);
      }
    }
    if (tv) for (const k of [-1, 1]) glow(tv.sd, tv.u + k * tv.w * 0.36, 0.025);
    for (const sd of Rm.list) for (const [a, b] of sd.windows) curtains(sd, a, b, Rm);
  }
  function artOnSideWall(Rm, avoid) {
    let best = null;
    for (const sd of Rm.list) {
      if (avoid.includes(sd)) continue;
      for (const [a0, b0] of sd.solid) {
        for (const [a, b] of minus([[Math.max(a0, sd.range[0]), Math.min(b0, sd.range[1])]], sd.windows.concat(sd.doors.map(d => [d.a - 0.1, d.b + 0.1])))) {
          if (b - a > 1.0 && (!best || b - a > best.b - best.a)) best = { sd, a, b };
        }
      }
    }
    if (!best) return;
    const u = (best.a + best.b) / 2, w = Math.min(1.1, best.b - best.a - 0.3);
    painting(best.sd, u, 1.5, w, w * 0.56, M.art1); glow(best.sd, u);
  }

  function furnishDining(Rm) {
    const [x0, y0, x1, y1] = Rm.rect, longX = (x1 - x0) >= (y1 - y0), Lr = Math.max(x1 - x0, y1 - y0), Sr = Math.min(x1 - x0, y1 - y0);
    const longSides = longX ? [Rm.sides.N, Rm.sides.S] : [Rm.sides.W, Rm.sides.E];
    const openish = sd => solidLen(sd) < 0.5 * (sd.range[1] - sd.range[0]);
    // chairs may spill over open edges into the next room, never through walls
    const ex = [Rm.sides.W, Rm.sides.N, Rm.sides.E, Rm.sides.S].map(sd => openish(sd) ? 0.45 : 0);
    const spill = [x0 - ex[0], y0 - ex[1], x1 + ex[2], y1 + ex[3]];
    const m0 = longX ? (x0 + x1) / 2 : (y0 + y1) / 2, aLo = longX ? x0 : y0, aHi = longX ? x1 : y1;
    let best = null;
    for (const tl of [1.25, 1.1, 0.9]) for (const td of [0.85, 0.75, 0.65]) {
      if (tl > Lr - 0.1 || td > Sr - 0.1) continue;
      const acrossList = longSides.map(sd => sd.face + ((sd.s === 'N' || sd.s === 'W') ? 1 : -1) * (td / 2 + 0.06)).concat([longX ? (y0 + y1) / 2 : (x0 + x1) / 2]);
      for (const across of acrossList) for (let t = 0; t <= (aHi - aLo) / 2; t += 0.05) for (const sg of [1, -1]) {
        const along = m0 + sg * t; if (along - tl / 2 < aLo + 0.03 || along + tl / 2 > aHi - 0.03) continue;
        const cx = longX ? along : across, cy = longX ? across : along;
        const tr = longX ? [cx - tl / 2, cy - td / 2, cx + tl / 2, cy + td / 2] : [cx - td / 2, cy - tl / 2, cx + td / 2, cy + tl / 2];
        if (!inside(tr, Rm.rect) || hardHit(Rm, tr)) continue;
        const spots = tl >= 1.1 ? [-tl / 4, tl / 4] : [0], seats = [];
        for (const s of [-1, 1]) for (const a of spots) seats.push([a, s * (td / 2 + 0.12)]);
        for (const s of [-1, 1]) seats.push([s * (tl / 2 + 0.12), 0]);
        const ok = seats.map(([a, c]) => { const px = longX ? cx + a : cx + c, py = longX ? cy + c : cy + a; return [px, py, [px - 0.23, py - 0.23, px + 0.23, py + 0.23]]; })
          .filter(([, , r]) => inside(r, spill) && !hardHit(Rm, r));
        if (ok.length < 2) continue;
        const sc = ok.length * 1.2 + tl * 1.5 + td - t * 0.4;
        if (!best || sc > best.sc) best = { sc, cx, cy, tr, tl, td, ok };
        break;
      }
    }
    if (!best) return;
    const { cx, cy, tr, tl, td, ok } = best;
    diningTable(cx, cy, longX ? 0 : Math.PI / 2, tl, td); occupy(Rm, tr); shadowRect(tr, 0.12);
    for (const [px, py, r] of ok) { chair(px, py, Math.atan2(cx - px, cy - py)); shadowRect(r, 0.03); }
  }

  function furnishKitchen(Rm) {
    const run = findWall(Rm, {
      ws: [3.0, 2.7, 2.4, 2.1, 1.8, 1.5, 1.2], d: 0.6, winPenalty: 0, wWeight: 3,
      extra: (sd, u, w) => freeRect(Rm, footprint(sd, u, w, 0.8, 0.6)),
      score: (sd, u, w) => cornerBonus(sd, u, w) * 2 + (sd.doors.length ? -1 : 0)
    });
    if (!run) return;
    const { sd, u, w, fp } = run; occupy(Rm, fp);
    const runs = [{ sd, u, w, fp }];
    // L-shaped extension along the wall at a corner
    const atLo = Math.abs(u - w / 2 - sd.range[0]) < 0.07, atHi = Math.abs(sd.range[1] - u - w / 2) < 0.07;
    const perp = sd.o === 'h' ? [Rm.sides.W, Rm.sides.E] : [Rm.sides.N, Rm.sides.S];
    const tryExt = (ps) => {
      if (!ps || !ps.solid.length) return null;
      const lowSide = sd.s === 'N' || sd.s === 'W', start = lowSide ? ps.range[0] + 0.6 : ps.range[1] - 0.6, dirn = lowSide ? 1 : -1;
      for (const ew of [1.5, 1.2, 0.9]) {
        const eu = start + dirn * ew / 2, efp = footprint(ps, eu, ew, 0.6);
        if (inside(efp, Rm.rect) && !hardHit(Rm, efp) && solidCovers(ps, eu - ew / 2, eu + ew / 2) && freeRect(Rm, footprint(ps, eu, ew, 0.8, 0.6))) return { sd: ps, u: eu, w: ew, fp: efp };
      }
      return null;
    };
    const ext = (atLo ? tryExt(perp[0]) : null) || (atHi ? tryExt(perp[1]) : null);
    if (ext) { occupy(Rm, ext.fp); runs.push(ext); }
    const fr = findWall(Rm, { ws: [0.7], d: 0.68, tall: true, extra: (s2, u2, w2) => freeRect(Rm, footprint(s2, u2, w2, 0.7, 0.68)), score: (s2, u2) => (s2 === sd ? 2 : 0) + cornerBonus(s2, u2, 0.7) - Math.min(Math.abs(u2 - (u - w / 2)), Math.abs(u2 - (u + w / 2))) });
    if (fr) { fridge(fr.sd, fr.u); occupy(Rm, fr.fp); shadowRect(fr.fp, 0.05); }
    // appliances: sink under the window if there is one, hob apart from it (on the L if there is one)
    const lo = u - w / 2 + 0.35, hi = u + w / 2 - 0.35, wins = sd.windows.filter(([a, b]) => b > u - w / 2 && a < u + w / 2);
    const sink = wins.length ? clamp((wins[0][0] + wins[0][1]) / 2, lo, hi) : (atLo ? hi : lo);
    let hob = ext ? ext.u : (Math.abs(sink - lo) > Math.abs(sink - hi) ? lo + 0.1 : hi - 0.1);
    if (!ext && Math.abs(hob - sink) < 0.75) hob = sink > (lo + hi) / 2 ? Math.max(lo, sink - 0.8) : Math.min(hi, sink + 0.8);
    const hood = s2 => !winHit(s2, hob - 0.35, hob + 0.35);
    counter(sd, u, w, { sink, ...(ext ? {} : { hob, hood: hood(sd) }), jars: w > 2.0 && !ext ? (sink > (lo + hi) / 2 ? lo : hi) : undefined });
    if (ext) counter(ext.sd, ext.u, ext.w, { hob, hood: hood(ext.sd) });
    for (const r of runs) { shadowRect(r.fp, 0.04); Rm.wallItems.push({ sd: r.sd, a: r.u - r.w / 2, b: r.u + r.w / 2, kind: 'splash' }); }
  }

  function furnishBath(Rm, withWC) {
    Rm.wet = true;
    const doorDist = (sd, u) => { let m = 9; for (const s2 of Rm.list) for (const d of s2.doors) { const dc = s2.o === 'h' ? [(d.a + d.b) / 2, s2.c] : [s2.c, (d.a + d.b) / 2]; const p = sd.o === 'h' ? [u, sd.face] : [sd.face, u]; m = Math.min(m, Math.hypot(p[0] - dc[0], p[1] - dc[1])); } return m; };
    if (withWC) { const w = findWall(Rm, { ws: [0.42], d: 0.66, score: (sd, u) => (sd.doors.length ? -3 : 0) + doorDist(sd, u) }); if (w) { wc(w.sd, w.u); occupy(Rm, w.fp); shadowRect(w.fp, 0.04); } }
    const b = findWall(Rm, { ws: [0.52], d: 0.42, tall: true, score: (sd, u) => (sd.doors.length ? 1 : 0) - doorDist(sd, u) * 0.3 });
    if (b) { basin(b.sd, b.u); occupy(Rm, b.fp); }
    const sh = findWall(Rm, { ws: [0.5], d: 0.06, soft: true, score: (sd, u) => doorDist(sd, u) * 2 + (sd.doors.length ? -2 : 0) });
    if (sh) { shower(sh.sd, sh.u); occupy(Rm, footprint(sh.sd, sh.u, 0.7, 0.7), true); }
    const tr = findWall(Rm, { ws: [0.55], d: 0.1, soft: true, score: (sd, u) => (sh && sd === sh.sd ? -5 : 0) + (b && sd === b.sd ? -2 : 0) });
    if (tr) towelRail(tr.sd, tr.u);
  }
  function furnishWC(Rm) {
    Rm.wet = true;
    const w = findWall(Rm, { ws: [0.42], d: 0.66, score: (sd, u) => (sd.doors.length ? -4 : 0) - Math.abs(u - mid(sd)) });
    if (w) { wc(w.sd, w.u); occupy(Rm, w.fp); shadowRect(w.fp, 0.04); }
  }
  function entrance() {
    const d = L.doors.find(x => x.entrance); if (!d) return;
    const Rm = rooms[d.room], sd = Rm.list.find(s => s.doors.includes(d)); if (!sd) return;
    const dc = (d.a + d.b) / 2;
    // door mat just inside
    const mf = sideRect(sd, dc - 0.42, dc + 0.42, 0.5, 0.12), c = [(mf[0] + mf[2]) / 2, (mf[1] + mf[3]) / 2];
    rug(c[0], c[1], sd.o === 'h' ? 0 : Math.PI / 2, 0.84, 0.5, M.doormat);
    const sr = findWall(Rm, {
      ws: [0.9, 0.75, 0.6], d: 0.35, tall: true, wWeight: 0.5,
      extra: (s2, u2, w2) => freeRect(Rm, footprint(s2, u2, w2, 0.5, 0.35)),
      score: (s2, u2, w2, fp) => { const p = [(fp[0] + fp[2]) / 2, (fp[1] + fp[3]) / 2], q = sd.o === 'h' ? [dc, sd.face] : [sd.face, dc]; return -Math.hypot(p[0] - q[0], p[1] - q[1]) * 2; }
    });
    if (sr) { shoeRack(sr.sd, sr.u, sr.w); occupy(Rm, sr.fp); shadowRect(sr.fp, 0.04); }
  }

  /* ---- walls, finishes, doors, windows ---- */
  const winRoomSide = (s, ri) => { const Rm = rooms[ri]; return ((s.o === 'h' ? Rm.cy : Rm.cx) - s.c) > 0 ? 1 : -1; };
  function windowAt(o, c, t, w0, w1, sill, head, sg, vent) {
    const h = t / 2, m = (w0 + w1) / 2;
    C.add(vent ? M.frosted : M.winGlass, lineBox(o, c, w0, w1, -0.006, 0.006, sill, head), I);
    const fr = (a, b, z0, z1) => C.add(M.frameW, lineBox(o, c, a, b, -0.035, 0.035, z0, z1), I);
    fr(w0, w0 + 0.05, sill, head); fr(w1 - 0.05, w1, sill, head); fr(w0, w1, sill, sill + 0.05); fr(w0, w1, head - 0.05, head);
    if (vent) for (let z = sill + 0.12; z < head - 0.05; z += 0.1) C.add(M.frameW, lineBox(o, c, w0, w1, -0.03, 0.03, z, z + 0.012), I);
    else fr(m - 0.025, m + 0.025, sill, head);
    const p0 = sg > 0 ? 0 : -(h + 0.05), p1 = sg > 0 ? h + 0.05 : 0;
    C.add(M.marble, lineBox(o, c, w0 - 0.04, w1 + 0.04, p0, p1, sill - 0.025, sill), I);
  }
  for (const s of L.segs) {
    if (s.b - s.a < 0.03) continue;
    const h = s.t / 2, wall = (a, b, z0, z1) => { if (b - a > 0.005 && z1 - z0 > 0.005) C.add(M.paint, lineBox(s.o, s.c, a, b, -h, h, z0, z1), I); };
    const vent = ventOf.get(s) || null, op = s.win || vent;
    if (op) {
      const [w0, w1] = op, sill = vent ? 1.55 : (s.room[1] === 'K' ? 1.05 : 0.75), head = 2.0;
      wall(s.a, w0, 0, WALL_T); wall(w1, s.b, 0, WALL_T); wall(w0, w1, 0, sill); wall(w0, w1, head, WALL_T);
      windowAt(s.o, s.c, s.t, w0, w1, sill, head, winRoomSide(s, s.ri), !!vent);
    } else wall(s.a, s.b, 0, WALL_T);
  }
  for (const d of L.doors) {
    const t = d.t, h = t / 2, wood = d.entrance ? M.woodD : M.woodDoor;
    C.add(M.paint, lineBox(d.o, d.c, d.a, d.b, -h, h, DOOR_H, WALL_T), I);
    C.add(wood, lineBox(d.o, d.c, d.a, d.a + 0.05, -h - 0.015, h + 0.015, 0, DOOR_H), I, UW(0.9));
    C.add(wood, lineBox(d.o, d.c, d.b - 0.05, d.b, -h - 0.015, h + 0.015, 0, DOOR_H), I, UW(0.9));
    C.add(wood, lineBox(d.o, d.c, d.a, d.b, -h - 0.015, h + 0.015, DOOR_H - 0.05, DOOR_H), I, UW(0.9));
    C.add(M.threshold, lineBox(d.o, d.c, d.a + 0.05, d.b - 0.05, -h, h, FL - 0.005, FL + 0.008), I);
    const Rm = rooms[d.room], n = ((d.o === 'h' ? Rm.cy : Rm.cx) - d.c) > 0 ? 1 : -1;
    const [ra, rb] = d.o === 'h' ? [Rm.x0, Rm.x1] : [Rm.y0, Rm.y1], atA = (d.a - ra) <= (rb - d.b);
    const lw = d.b - d.a - 0.1, lh = DOOR_H - 0.06, phi = d.entrance ? 1.45 : 1.62, A = atA ? 1 : -1;
    const ha = atA ? d.a + 0.05 : d.b - 0.05, hp = d.c + n * (h + 0.02);
    const da = A * Math.cos(phi), dp = n * Math.sin(phi);
    const [dx, dy] = d.o === 'h' ? [da, dp] : [dp, da], [hx, hy] = d.o === 'h' ? [ha, hp] : [hp, ha];
    const cx = hx + dx * lw / 2, cy = hy + dy * lw / 2, th = Math.atan2(-dy, dx);
    const p = P(mat4(cx, cy, th, FL + lh / 2 + 0.005));
    p(wood, BX(lw, lh, 0.036), 0, 0, 0, { uv: UL(0.9) });
    if (d.entrance) for (const y of [-0.55, 0, 0.55]) for (const z of [-1, 1]) p(M.charcoal, BX(lw - 0.2, 0.008, 0.002), 0, y, z * 0.019);
    const hy0 = 0.98 - FL - lh / 2 - 0.005, hm = d.entrance ? M.gold : M.chrome;
    for (const z of [-1, 1]) { p(hm, CYL(0.026, 0.026, 0.012, 16), lw / 2 - 0.07, hy0, z * 0.024, { rx: Math.PI / 2 }); p(hm, RB(0.13, 0.018, 0.02, 0.008), lw / 2 - 0.12, hy0, z * 0.04); }
  }
  // finishes on room-side faces of the walls: wallpaper, tiles, skirting
  for (const Rm of rooms) {
    const wet = Rm.wet || Rm.kind === 'T' || Rm.kind === 'W';
    for (const sd of Rm.list) {
      if (!sd.solid.length || sd.inset === 0) continue;
      const segs = sd.solid.map(([a, b]) => [Math.max(a, sd.range[0]), Math.min(b, sd.range[1])]).filter(v => v[1] - v[0] > 0.05);
      const into = (sd.s === 'N' || sd.s === 'W') ? 1 : -1, f = sd.face;
      const panel = (mat, a, b, z0, z1, th = 0.012, uv = UW(1.2)) => { if (b - a > 0.03 && z1 - z0 > 0.02) C.add(mat, lineBox(sd.o, f, a, b, into > 0 ? 0 : -th, into > 0 ? th : 0, z0, z1), I, uv); };
      const openings = sd.windows.concat(sd.vents);
      if (wet) {
        for (const [a, b] of segs) {
          for (const [p0, p1] of minus([[a, b]], openings)) panel(M.bathWall, p0, p1, 0, WALL_T - 0.002);
          for (const [w0, w1] of openings) { const a0 = Math.max(a, w0), b0 = Math.min(b, w1); if (b0 > a0) panel(M.bathWall, a0, b0, 0, 1.55); }
        }
        continue;
      }
      const feat = Rm.feature === sd;
      for (const [a, b] of segs) {
        if (feat) {
          const mat = Rm.kind === 'B' ? M.wallBed : M.wallLiv, uv = UW(Rm.kind === 'B' ? 0.8 : 1.2);
          for (const [p0, p1] of minus([[a, b]], openings)) panel(mat, p0, p1, 0, WALL_T - 0.002, 0.012, uv);
        }
        for (const [p0, p1] of minus([[a, b]], openings)) panel(M.skirting, p0, p1, 0, 0.09, feat ? 0.02 : 0.012, null);
      }
      for (const it of Rm.wallItems.filter(x => x.sd === sd && x.kind === 'splash')) {
        for (const [p0, p1] of minus([[it.a, it.b]], openings)) panel(M.kitTile, p0, p1, 0.88, 1.5, 0.01, UW(0.6));
        for (const [w0, w1] of openings) { const a0 = Math.max(it.a, w0), b0 = Math.min(it.b, w1); if (b0 > a0) panel(M.kitTile, a0, b0, 0.88, 1.03, 0.01, UW(0.6)); }
      }
    }
  }
  // floors
  for (const Rm of rooms) {
    const wet = Rm.kind === 'T' || Rm.kind === 'W';
    C.add(wet ? M.bathFloor : floorMat, BOXW(Rm.x0, Rm.y0, Rm.x1, Rm.y1, 0, FL), I, UW(1.2));
  }

  const group = new THREE.Group(); group.name = 'interior-' + L.key;
  const meshes = C.build(group, { noCast, noReceive: new Set([M.glow, M.shadow]), noReflect: new Set([floorMat, M.shadow, M.rugLiv, M.rugBed, M.doormat, M.glow]), decal: M.shadow });
  let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
  for (const Rm of rooms) { bx0 = Math.min(bx0, Rm.x0); by0 = Math.min(by0, Rm.y0); bx1 = Math.max(bx1, Rm.x1); by1 = Math.max(by1, Rm.y1); }
  const debug = rooms.map(Rm => ({ name: Rm.name, kind: Rm.kind, rect: Rm.rect.map(v => +v.toFixed(2)), keep: Rm.keep.map(k => [k.kind, ...k.r.map(v => +v.toFixed(2))]), sides: Rm.list.map(sd => ({ s: sd.s, solid: sd.solid, doors: sd.doors.map(d => [d.a, d.b]), open: sd.open.map(o => [o.a, o.b]), win: sd.windows })) }));
  return { debug, group, floor: meshes.get(floorMat), floorMat, bounds: { x0: bx0, y0: by0, x1: bx1, y1: by1, cx: (bx0 + bx1) / 2, cy: (by0 + by1) / 2, w: bx1 - bx0, h: by1 - by0 }, FL };
}
