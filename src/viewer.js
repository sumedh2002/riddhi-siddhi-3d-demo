import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { FH, NF, CX, CY, BLOCKS, FLATS, COMMON, CORE_A, mx, unitId, flatOn } from './project-data.js';
import { flatLayout } from './layout.js';
import { createInteriorKit } from './interiors.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { statusOf } from './inventory.js';
import { createMapGround } from './mapground.js';
export { unitId, statusOf };
export const DATA = { FLATS, NF };
function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; }

/* =========================================================
   VIEWER
   ========================================================= */
const W = (x, y, z = 0) => new THREE.Vector3(x - CX, z, y - CY); // plan → world

export function createViewer(root, hooks = {}) {
  const canvasWrap = root.querySelector('.v-canvas');
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
  let dirty = true; const invalidate = () => { dirty = true; };
  canvasWrap.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  scene.background = skyTexture();
  scene.fog = new THREE.Fog(0xdfe7ef, 170, 420);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 900);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.47; controls.minDistance = 6; controls.maxDistance = 200;
  controls.screenSpacePanning = true;
  controls.addEventListener('change', invalidate);

  // Lights
  const hemi = new THREE.HemisphereLight(0xcfe0ff, 0xb3a68a, 1.15); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe6c4, 2.9);
  sun.position.set(-48, 70, 52); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 10, far: 220 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(sun); scene.add(sun.target);

  /* ---------- Materials ---------- */
  const M = {
    wallA: new THREE.MeshStandardMaterial({ color: 0xefe3c9, roughness: 0.9 }),
    wallB: new THREE.MeshStandardMaterial({ color: 0xefe3c9, roughness: 0.9 }),
    bglass: new THREE.MeshStandardMaterial({ color: 0xcfe2ee, metalness: 0.25, roughness: 0.05, transparent: true, opacity: 0.36, depthWrite: false }),
    leaf3: new THREE.MeshStandardMaterial({ color: 0x3d6a36, roughness: 0.95 }),
    trim: new THREE.MeshStandardMaterial({ color: 0xfbf8f1, roughness: 0.6 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x4f7697, metalness: 0.8, roughness: 0.06, envMapIntensity: 1.5 }),
    frame: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 }),
    rail: new THREE.MeshStandardMaterial({ color: 0x3b3f45, metalness: 0.6, roughness: 0.35 }),
    roof: new THREE.MeshStandardMaterial({ color: 0xa8472c, roughness: 0.62 }),
    roofTop: new THREE.MeshStandardMaterial({ color: 0xdedbd5, roughness: 0.95 }),
    stilt: new THREE.MeshStandardMaterial({ color: 0x8d877d, roughness: 0.95 }),
    stiltCeil: new THREE.MeshStandardMaterial({ color: 0x6f6a62, roughness: 1 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xd6b25e, metalness: 0.7, roughness: 0.3 }),
    grass: new THREE.MeshStandardMaterial({ color: 0x7fa866, roughness: 1 }),
    grass2: new THREE.MeshStandardMaterial({ color: 0x6f9a57, roughness: 1 }),
    paver: new THREE.MeshStandardMaterial({ color: 0xb9b2a6, roughness: 0.95, map: tileTex('#d6d0c5', '#c4bdb0', 8, false, 14, 10) }),
    asphalt: new THREE.MeshStandardMaterial({ color: 0x55595f, roughness: 0.92 }),
    curb: new THREE.MeshStandardMaterial({ color: 0xe9e6df, roughness: 0.9 }),
    ground: new THREE.MeshStandardMaterial({ color: 0xc3cab9, roughness: 1 }),
    context: new THREE.MeshStandardMaterial({ color: 0xe8eaec, roughness: 0.95 }),
    trunk: new THREE.MeshStandardMaterial({ color: 0x7a634c, roughness: 1 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x4f7f3f, roughness: 0.95 }),
    leaf2: new THREE.MeshStandardMaterial({ color: 0x6b9a4f, roughness: 0.95 }),
    palm: new THREE.MeshStandardMaterial({ color: 0x4f8a3f, roughness: 0.85, side: THREE.DoubleSide, flatShading: true }),
    ghost: new THREE.MeshStandardMaterial({ color: 0xc9d8f0, roughness: 0.4, transparent: true, opacity: 0.11, depthWrite: false }),
    iWall: new THREE.MeshStandardMaterial({ color: 0xfdfdfb, roughness: 0.7 }),
    iWallSel: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, emissive: 0x1d4ed8, emissiveIntensity: 0.06 }),
    iGlass: new THREE.MeshStandardMaterial({ color: 0x9cc3ea, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.55 }),
    common: new THREE.MeshStandardMaterial({ color: 0xe3e5e8, roughness: 0.9, map: tileTex('#e5e7ea', '#d5d8dc', 4) }),
    slab: new THREE.MeshStandardMaterial({ color: 0xd9dee6, roughness: 0.9 }),
    line: new THREE.LineBasicMaterial({ color: 0x3b6fd8, transparent: true, opacity: 0.4 }),
    dash: new THREE.LineDashedMaterial({ color: 0x334155, transparent: true, opacity: 0.45, dashSize: 0.8, gapSize: 0.6 })
  };
  M.glass.envMap = envTex; M.bglass.envMap = envTex;
  const floorTex = { stone: tileTex('#e6d6bb', '#cdb894', 6, true), wet: tileTex('#d3dce6', '#b7c3d0', 10) };
  const STATUS_TINT = { available: 0xa9e2b8, booked: 0xf2b1b1, hold: 0xf5d48f, sold: 0xc5ccd6 };

  /* ---------- geometry helpers ---------- */
  function boxG(x0, y0, x1, y1, z0, z1) {
    const g = new THREE.BoxGeometry(Math.max(0.001, x1 - x0), Math.max(0.001, z1 - z0), Math.max(0.001, y1 - y0));
    g.translate((x0 + x1) / 2 - CX, (z0 + z1) / 2, (y0 + y1) / 2 - CY);
    return g;
  }
  function meshOf(geos, mat, opts = {}) {
    if (!geos.length) return null;
    const m = new THREE.Mesh(mergeGeometries(geos, false), mat);
    m.castShadow = opts.cast !== false; m.receiveShadow = true;
    geos.forEach(g => g.dispose());
    return m;
  }

  /* ---------- exposed facade intervals ---------- */
  const faces = []; // {b, side:'N'|'S'|'E'|'W', a, c (interval along), pos}
  function subtract(iv, cuts) {
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
  BLOCKS.forEach((B, i) => {
    const [x0, y0, x1, y1] = B.r, e = 0.02;
    const others = BLOCKS.filter((_, j) => j !== i).map(o => o.r);
    const side = (s, pos, a, b, test) => {
      const cuts = others.filter(test).map(o => (s === 'N' || s === 'S') ? [o[0], o[2]] : [o[1], o[3]]);
      for (const [p, q] of subtract([a, b], cuts)) faces.push({ i, w: B.w, s, pos, a: p, b: q });
    };
    side('S', y1, x0, x1, o => Math.abs(o[1] - y1) < e);
    side('N', y0, x0, x1, o => Math.abs(o[3] - y0) < e);
    side('E', x1, y0, y1, o => Math.abs(o[0] - x1) < e);
    side('W', x0, y0, y1, o => Math.abs(o[2] - x0) < e);
  });
  // returns box extents for a thing placed on a face, offset outward d0..d1, along u0..u1, z0..z1
  function onFace(f, u0, u1, d0, d1, z0, z1) {
    if (f.s === 'S') return boxG(u0, f.pos + d0, u1, f.pos + d1, z0, z1);
    if (f.s === 'N') return boxG(u0, f.pos - d1, u1, f.pos - d0, z0, z1);
    if (f.s === 'E') return boxG(f.pos + d0, u0, f.pos + d1, u1, z0, z1);
    return boxG(f.pos - d1, u0, f.pos - d0, u1, z0, z1);
  }

  /* ---------- BUILDING ---------- */
  const building = new THREE.Group(); scene.add(building);
  const floorGroups = []; // index 0 = stilt, 1..7 floors, 8 = roof
  const wingMeshes = [];
  for (let lv = 0; lv <= NF + 1; lv++) { const g = new THREE.Group(); g.userData.level = lv; floorGroups.push(g); building.add(g); }

  // Stilt / parking level
  {
    const g = floorGroups[0], col = [], ceil = [], core = [];
    for (const B of BLOCKS) {
      const [x0, y0, x1, y1] = B.r;
      ceil.push(boxG(x0, y0, x1, y1, FH - 0.35, FH));
      const nx = Math.max(1, Math.round((x1 - x0) / 4.6)), ny = Math.max(1, Math.round((y1 - y0) / 4.6));
      for (let a = 0; a <= nx; a++) for (let b = 0; b <= ny; b++) {
        const x = x0 + 0.3 + a * (x1 - x0 - 0.6) / nx, y = y0 + 0.3 + b * (y1 - y0 - 0.6) / ny;
        col.push(boxG(x - 0.28, y - 0.28, x + 0.28, y + 0.28, 0, FH - 0.35));
      }
    }
    for (const c of CORE_A.concat(CORE_A.map(c => [mx(c[2]), c[1], mx(c[0]), c[3]]))) core.push(boxG(c[0], c[1], c[2], c[3], 0, FH - 0.35));
    core.push(boxG(18.6, 19.4, 24.52, 24.2, 0, FH - 0.35)); // entrance lobby
    const cm = meshOf(col, M.trim); const ce = meshOf(ceil, M.stiltCeil); const co = meshOf(core, M.wallA);
    [cm, ce, co].forEach(m => m && g.add(m));
    // lobby glazing + canopy
    const lobbyGlass = meshOf([boxG(19.0, 24.2, 24.1, 24.28, 0.1, 2.5)], M.glass); g.add(lobbyGlass);
    const canopy = meshOf([boxG(18.2, 24.2, 24.9, 26.2, 2.55, 2.75)], M.trim); g.add(canopy);
    const gold = meshOf([boxG(19.6, 26.2, 23.5, 26.26, 2.58, 2.72)], M.gold); g.add(gold);
  }

  // Residential floors
  for (let lv = 1; lv <= NF; lv++) {
    const z = lv * FH, g = floorGroups[lv];
    const per = { A: { wall: [], trim: [], glass: [], frame: [], rail: [], bglass: [] }, B: { wall: [], trim: [], glass: [], frame: [], rail: [], bglass: [] } };
    for (const f of faces) {
      const P = per[f.w];
      P.wall.push(onFace(f, f.a, f.b, -0.23, 0, z, z + FH));
      P.trim.push(onFace(f, f.a - 0.08, f.b + 0.08, 0, 0.14, z, z + 0.3)); // floor band
      P.trim.push(onFace(f, f.a, f.a + 0.45, 0, 0.1, z, z + FH)); // quoins
      P.trim.push(onFace(f, f.b - 0.45, f.b, 0, 0.1, z, z + FH));
      const L = f.b - f.a, n = Math.floor((L - 0.9) / 2.7);
      for (let k = 1; k < n; k++) { const x = f.a + (L / n) * k; P.trim.push(onFace(f, x - 0.11, x + 0.11, 0, 0.07, z + 0.3, z + FH)); } // pilasters between bays
      for (let k = 0; k < n; k++) {
        const c = f.a + (L / n) * (k + 0.5), big = (f.s === 'S' || f.s === 'N') && (k % 3 === 1);
        const hw = big ? 0.95 : 0.7, s0 = z + (big ? 0.45 : 0.9), s1 = z + 2.35;
        P.frame.push(onFace(f, c - hw - 0.1, c + hw + 0.1, 0, 0.07, s0 - 0.1, s1 + 0.1));
        P.glass.push(onFace(f, c - hw, c + hw, 0, 0.1, s0, s1));
        P.frame.push(onFace(f, c - 0.04, c + 0.04, 0, 0.13, s0, s1)); // mullion
        P.trim.push(onFace(f, c - hw - 0.3, c + hw + 0.3, 0, 0.55, s1 + 0.22, s1 + 0.32)); // chajja
        P.trim.push(onFace(f, c - hw - 0.18, c + hw + 0.18, 0, 0.16, s0 - 0.16, s0 - 0.08)); // sill
        if (big) { // balcony: projecting slab, glass railing, slim handrail
          P.trim.push(onFace(f, c - hw - 0.32, c + hw + 0.32, 0, 0.72, z + 0.28, z + 0.4));
          P.bglass.push(onFace(f, c - hw - 0.27, c + hw + 0.27, 0.65, 0.68, z + 0.4, z + 1.38));
          P.bglass.push(onFace(f, c - hw - 0.27, c - hw - 0.24, 0, 0.66, z + 0.4, z + 1.38));
          P.bglass.push(onFace(f, c + hw + 0.24, c + hw + 0.27, 0, 0.66, z + 0.4, z + 1.38));
          P.rail.push(onFace(f, c - hw - 0.29, c + hw + 0.29, 0.63, 0.7, z + 1.38, z + 1.43));
        }
      }
    }
    for (const w of ['A', 'B']) {
      const P = per[w];
      const wm = meshOf(P.wall, w === 'A' ? M.wallA : M.wallB); wm.userData.wing = w; wingMeshes.push(wm);
      [wm, meshOf(P.trim, M.trim), meshOf(P.glass, M.glass, { cast: false }), meshOf(P.frame, M.frame, { cast: false }), meshOf(P.rail, M.rail, { cast: false }), meshOf(P.bglass, M.bglass, { cast: false })].forEach(m => m && g.add(m));
    }
    // slab (floor plate) for the level
    const sl = BLOCKS.map(B => boxG(B.r[0] + 0.05, B.r[1] + 0.05, B.r[2] - 0.05, B.r[3] - 0.05, z, z + 0.05));
    const sm = meshOf(sl, M.slab, { cast: false }); g.add(sm);
  }

  // Roof
  {
    const z = (NF + 1) * FH, g = floorGroups[NF + 1], top = [], par = [], cop = [];
    for (const B of BLOCKS) top.push(boxG(B.r[0], B.r[1], B.r[2], B.r[3], z, z + 0.25));
    for (const f of faces) {
      par.push(onFace(f, f.a, f.b, -0.2, 0, z, z + 1.0));
      cop.push(onFace(f, f.a - 0.06, f.b + 0.06, -0.26, 0.08, z + 1.0, z + 1.12));
    }
    g.add(meshOf(top, M.roofTop)); g.add(meshOf(par, M.wallA)); g.add(meshOf(cop, M.trim));
    // decorative pediments on the front
    for (const cx of [5.0, 16.2, 26.92, 38.12]) {
      const sh = new THREE.Shape(); sh.moveTo(-2.6, 0); sh.lineTo(2.6, 0); sh.lineTo(0, 2.3); sh.lineTo(-2.6, 0);
      const eg = new THREE.ExtrudeGeometry(sh, { depth: 0.35, bevelEnabled: false });
      eg.translate(cx - CX, z + 1.0, 25.0 - CY - 0.3);
      const pm = new THREE.Mesh(eg, M.trim); pm.castShadow = true; g.add(pm);
      const sh2 = new THREE.Shape(); sh2.moveTo(-2.1, 0.25); sh2.lineTo(2.1, 0.25); sh2.lineTo(0, 2.0); sh2.lineTo(-2.1, 0.25);
      const eg2 = new THREE.ExtrudeGeometry(sh2, { depth: 0.05, bevelEnabled: false }); eg2.translate(cx - CX, z + 1.0, 25.0 - CY + 0.06);
      g.add(new THREE.Mesh(eg2, M.wallA));
    }
    // crown towers with pyramid roofs (as in the brochure render)
    for (const t of [[10.9, 14.6, 15.7, 18.6], [mx(15.7), 14.6, mx(10.9), 18.6]]) {
      const [x0, y0, x1, y1] = t, h = 4.0;
      g.add(meshOf([boxG(x0, y0, x1, y1, z, z + h)], M.wallA));
      const tr = [boxG(x0 - 0.1, y0 - 0.1, x1 + 0.1, y1 + 0.1, z + h - 0.35, z + h)];
      for (const [px, py] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) tr.push(boxG(px - 0.25, py - 0.25, px + 0.25, py + 0.25, z, z + h));
      g.add(meshOf(tr, M.trim));
      g.add(meshOf([boxG((x0 + x1) / 2 - 0.6, y1, (x0 + x1) / 2 + 0.6, y1 + 0.06, z + 1.2, z + 3.2), boxG(x1, (y0 + y1) / 2 - 0.6, x1 + 0.06, (y0 + y1) / 2 + 0.6, z + 1.2, z + 3.2)], M.glass));
      const w = (x1 - x0) + 0.9, d = (y1 - y0) + 0.9, ph = 4.6;
      const pg = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1); pg.rotateY(Math.PI / 4); pg.scale(w, ph, d);
      pg.translate((x0 + x1) / 2 - CX, z + h + ph / 2, (y0 + y1) / 2 - CY);
      const pm = new THREE.Mesh(pg, M.roof); pm.castShadow = true; g.add(pm);
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.14, 1.6, 8), M.gold); fin.position.set((x0 + x1) / 2 - CX, z + h + ph + 0.7, (y0 + y1) / 2 - CY); g.add(fin);
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), M.gold); orb.position.set((x0 + x1) / 2 - CX, z + h + ph + 0.05, (y0 + y1) / 2 - CY); g.add(orb);
    }
    // overhead tanks
    g.add(meshOf([boxG(3.0, 3.0, 7.0, 6.0, z, z + 1.8), boxG(mx(7.0), 3.0, mx(3.0), 6.0, z, z + 1.8)], M.wallA));
  }

  // Podium garden on the 1st floor between the wings
  const site = new THREE.Group(); scene.add(site);
  const greens = new THREE.Group(); scene.add(greens);
  {
    const z = FH;
    site.add(meshOf([boxG(16.3, 0.7, 26.82, 16.5, z, z + 0.2)], M.grass));
    site.add(meshOf([boxG(20.1, 1.2, 23.0, 16.2, z + 0.2, z + 0.23), boxG(16.6, 8.0, 26.5, 9.6, z + 0.2, z + 0.23)], M.paver, { cast: false }));
    site.add(meshOf([boxG(17.2, 11.5, 18.4, 14.5, z + 0.2, z + 1.4), boxG(24.6, 2.6, 25.8, 3.8, z + 0.2, z + 2.0)], new THREE.MeshStandardMaterial({ color: 0xd9433a, roughness: 0.6 })));
    site.add(meshOf([boxG(24.0, 11.4, 26.2, 14.2, z + 0.2, z + 0.5)], new THREE.MeshStandardMaterial({ color: 0xf0b429, roughness: 0.6 })));
    for (const p of [[17.4, 2.2], [17.4, 5.6], [25.7, 6.4], [17.6, 16.0], [25.6, 16.0]]) greens.add(tree(p[0], p[1], 1.0, z + 0.2));
  }

  // Site, road, context
  // "plain" is the stand-in for the surroundings (flat ground, the road, neighbouring blocks, street trees and cars).
  // It is what you see until the real map is on (see setMap); the plot itself always stays.
  const plain = new THREE.Group(), plainBits = []; site.add(plain); // plainBits: the street trees and passing cars (kept as direct children of greens)
  const street = o => { plainBits.push(o); greens.add(o); };
  {
    plain.add(meshOf([boxG(-120, -110, 160, 140, -0.3, -0.02)], M.ground, { cast: false }));
    site.add(meshOf([boxG(-2.5, -3.5, 45.6, 27.8, -0.02, 0.02)], M.paver, { cast: false }));
    site.add(meshOf([boxG(-2.5, -3.5, 45.6, -1.0, 0.02, 0.06), boxG(-2.5, -1.0, -0.4, 27.8, 0.02, 0.06), boxG(43.6, -1.0, 45.6, 27.8, 0.02, 0.06)], M.grass2, { cast: false }));
    const cw = [boxG(-2.7, -3.7, 45.8, -3.5, 0, 1.5), boxG(-2.7, -3.5, -2.5, 28.0, 0, 1.5), boxG(45.6, -3.5, 45.8, 28.0, 0, 1.5), boxG(-2.7, 27.8, 17.0, 28.0, 0, 1.5), boxG(26.1, 27.8, 45.8, 28.0, 0, 1.5)];
    site.add(meshOf(cw, M.trim));
    site.add(meshOf([boxG(16.6, 27.6, 17.6, 28.4, 0, 2.6), boxG(25.6, 27.6, 26.6, 28.4, 0, 2.6)], M.wallA));
    site.add(meshOf([boxG(16.5, 27.5, 17.7, 28.5, 2.6, 2.8), boxG(25.5, 27.5, 26.7, 28.5, 2.6, 2.8)], M.trim));
    plain.add(meshOf([boxG(-120, 28.0, 160, 30.0, 0, 0.15), boxG(-120, 41.0, 160, 43.0, 0, 0.15)], M.curb, { cast: false }));
    plain.add(meshOf([boxG(-120, 30.0, 160, 41.0, -0.02, 0.03)], M.asphalt, { cast: false }));
    const dashes = []; for (let x = -118; x < 158; x += 6) dashes.push(boxG(x, 35.4, x + 3, 35.6, 0.03, 0.04));
    plain.add(meshOf(dashes, M.trim, { cast: false }));
    // context buildings
    const ctx = [[-34, -8, -10, 16, 18], [-32, -40, -8, -14, 14], [54, -6, 76, 20, 21], [52, -40, 78, -14, 16], [-4, -44, 20, -18, 11], [24, -46, 48, -20, 24]];
    const ctxImg = ctxFacade(), ctxTop = new THREE.MeshStandardMaterial({ color: 0xd9d6cf, roughness: 0.95 }), tints = [0xf1ece2, 0xe6e9ec, 0xefe6d8];
    ctx.forEach((c, i) => {
      const w = c[2] - c[0], d = c[3] - c[1], h = c[4];
      const side = len => { const t = ctxImg.clone(); t.needsUpdate = true; t.repeat.set(Math.max(1, Math.round(len / 8)), Math.max(1, Math.round(h / 12))); return new THREE.MeshStandardMaterial({ map: t, color: tints[i % 3], roughness: 0.92 }); };
      const sx = side(d), sz = side(w), m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [sx, sx, ctxTop, ctxTop, sz, sz]);
      m.position.set((c[0] + c[2]) / 2 - CX, h / 2, (c[1] + c[3]) / 2 - CY); m.castShadow = true; m.receiveShadow = true; m.userData.context = true; plain.add(m);
    });
    // trees
    for (const p of [[-1.0, 26.5], [4.5, 26.6], [10.0, 26.6], [33.0, 26.6], [38.5, 26.6], [44.2, 26.6], [44.4, 20], [44.4, 13], [44.4, 6], [44.4, -1.5], [-1.4, 19], [-1.4, 12], [-1.4, 5], [-1.4, -2], [8, -2.3], [16, -2.3], [27, -2.3], [35, -2.3]]) greens.add(tree(p[0], p[1], 1.5));
    for (const p of [[14.6, 26.8], [28.5, 26.8], [-1.2, 26.0]]) greens.add(palm(p[0], p[1]));
    for (const x of [-60, -40, -20, 0, 20, 40, 60, 80, 100]) street(tree(x + 7, 42.1, 1.6));
    // cars
    const carCols = [0xf4f4f2, 0xb91c1c, 0x1e3a8a, 0x9ca3af, 0x111827, 0xf4f4f2];
    [[4, 32.0, 0], [28, 37.5, 1], [-14, 37.6, 2], [52, 32.1, 3]].forEach(([x, y, c]) => street(car(x, y, carCols[c], false)));
    [[3.0, 18.2, 4], [6.0, 18.2, 5], [36.0, 18.2, 1], [39.0, 18.2, 3]].forEach(([x, y, c]) => greens.add(car(x, y, carCols[c], true)));
  }

  function ctxFacade() { // a tileable strip of a plain neighbouring building: 4 windows across, 4 floors up
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const c = cv.getContext('2d');
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, 256, 256);
    for (let r = 0; r < 4; r++) { c.fillStyle = 'rgba(0,0,0,.07)'; c.fillRect(0, r * 64 + 60, 256, 4); for (let k = 0; k < 4; k++) { c.fillStyle = (r + k) % 3 ? '#8fa3b5' : '#a9b9c7'; c.fillRect(k * 64 + 16, r * 64 + 16, 32, 30); c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(k * 64 + 31, r * 64 + 16, 2, 30); } }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  function tree(x, y, s = 1.4, z0 = 0) {
    const g = new THREE.Group();
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.18 * s, 2.4 * s, 6), M.trunk); t.position.y = 1.2 * s; t.castShadow = true; g.add(t);
    const seed = hash(x + ':' + y) * 40;
    for (const [r, px, py, pz, m] of [[1.4, 0, 3.0, 0, M.leaf3], [1.15, 0.8, 3.4, 0.4, M.leaf], [1.05, -0.7, 3.5, -0.3, M.leaf], [1.0, 0.1, 4.1, -0.5, M.leaf2], [0.85, -0.2, 4.0, 0.7, M.leaf2]]) {
      const cg = new THREE.IcosahedronGeometry(r * s, 2), cp = cg.attributes.position;
      for (let i = 0; i < cp.count; i++) { // gentle bumps so the canopy isn't a ball (same push for vertices that share a spot)
        const X = cp.getX(i), Y = cp.getY(i), Z = cp.getZ(i), k = 1 + 0.13 * Math.sin(X * 2.7 + seed) * Math.cos(Z * 3.1 - seed) + 0.09 * Math.sin(Y * 3.7 + seed * 2);
        cp.setXYZ(i, X * k, Y * k * 0.86, Z * k);
      }
      const c = new THREE.Mesh(cg, m); c.position.set(px * s, py * s, pz * s); c.castShadow = true; g.add(c);
    }
    g.position.copy(W(x, y, z0)); g.rotation.y = hash(x + ',' + y) * 6; return g;
  }
  function palm(x, y) {
    const g = new THREE.Group(), h = 7.5;
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, h, 7), M.trunk); t.position.y = h / 2; t.castShadow = true; g.add(t);
    for (let i = 0; i < 8; i++) {
      const lg = new THREE.PlaneGeometry(0.7, 3.4, 1, 3); lg.translate(0, 1.7, 0);
      const p = lg.attributes.position; for (let k = 0; k < p.count; k++) { const yy = p.getY(k); p.setZ(k, -0.12 * yy * yy); }
      lg.computeVertexNormals();
      const l = new THREE.Mesh(lg, M.palm); l.position.y = h; l.rotation.set(-1.0, i * Math.PI / 4, 0, 'YXZ'); l.castShadow = true; g.add(l);
    }
    g.position.copy(W(x, y)); return g;
  }
  function car(x, y, col, rot) {
    const g = new THREE.Group(), body = new THREE.MeshStandardMaterial({ color: col, metalness: 0.5, roughness: 0.35, envMap: envTex });
    const b = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.7, 1.75), body); b.position.y = 0.6; b.castShadow = true; g.add(b);
    const c = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.55, 1.55), M.glass); c.position.set(-0.2, 1.2, 0); g.add(c);
    const cr = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 1.5), body); cr.position.set(-0.2, 1.5, 0); g.add(cr);
    for (const [wx, wz] of [[1.3, 0.85], [-1.3, 0.85], [1.3, -0.85], [-1.3, -0.85]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 12), M.rail); w.rotation.x = Math.PI / 2; w.position.set(wx, 0.32, wz); g.add(w); }
    g.position.copy(W(x, y)); if (rot) g.rotation.y = Math.PI / 2; return g;
  }

  /* ---------- X-ray outlines ---------- */
  const outlines = [];
  for (let lv = 0; lv <= NF + 1; lv++) {
    const pts = [];
    for (const f of faces) {
      const z = lv * FH + 0.02;
      if (f.s === 'S' || f.s === 'N') pts.push(W(f.a, f.pos, z), W(f.b, f.pos, z)); else pts.push(W(f.pos, f.a, z), W(f.pos, f.b, z));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const solid = new THREE.LineSegments(geo, M.line); solid.visible = false; scene.add(solid);
    const dashed = new THREE.LineSegments(geo, M.dash); dashed.computeLineDistances(); dashed.visible = false; scene.add(dashed);
    outlines.push({ solid, dashed });
  }
  const verticals = (() => {
    const pts = []; const corners = [[1.0, 25.0], [42.12, 25.0], [42.12, 0.3], [1.0, 0.3], [21.56, 25.0]];
    for (const [x, y] of corners) pts.push(W(x, y, 0), W(x, y, (NF + 1) * FH + 1));
    const l = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), M.dash); l.computeLineDistances(); l.visible = false; scene.add(l); return l;
  })();

  /* ---------- FLOOR PLAN MODEL (generated from room rectangles) ---------- */
  const plan = new THREE.Group(); plan.visible = false; scene.add(plan);
  const flatParts = {}; // key -> {floors:[], walls:mesh, mat, center, rooms:[{name,mesh,center}]}
  const WALL_H = 1.25;

  function buildFlat(key) {
    const F = FLATS[key], rooms = F.rooms, L = flatLayout(key);
    const wallG = [], glassG = [];
    for (const s of L.segs) {
      if (s.b - s.a < 0.05) continue;
      const h = s.t / 2;
      const bx = (z0, z1, a = s.a, b = s.b) => s.o === 'h' ? boxG(a, s.c - h, b, s.c + h, z0, z1) : boxG(s.c - h, a, s.c + h, b, z0, z1);
      if (s.win) {
        const [w0, w1] = s.win;
        wallG.push(bx(0, WALL_H, s.a, w0), bx(0, WALL_H, w1, s.b), bx(0, 0.55, w0, w1));
        glassG.push(bx(0.55, WALL_H, w0, w1));
      } else wallG.push(bx(0, WALL_H));
    }
    const part = { key, rooms: [] };
    const mat = M.iWall.clone();
    part.walls = meshOf(wallG, mat); part.walls.userData.flat = key; part.wallMat = mat;
    part.glass = meshOf(glassG, M.iGlass, { cast: false });
    part.group = new THREE.Group(); part.group.add(part.walls); if (part.glass) part.group.add(part.glass);
    const fmS = new THREE.MeshStandardMaterial({ map: floorTex.stone, roughness: 0.55, color: 0xffffff });
    const fmW = new THREE.MeshStandardMaterial({ map: floorTex.wet, roughness: 0.6, color: 0xffffff });
    part.floorMats = [fmS, fmW];
    let cx = 0, cy = 0, area = 0;
    for (const r of rooms) {
      const [nm, kd, x0, y0, x1, y1, dim] = r;
      const g = boxG(x0, y0, x1, y1, 0, 0.04);
      const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * (x1 - x0) / 1.2, uv.getY(k) * (y1 - y0) / 1.2);
      const m = new THREE.Mesh(g, (kd === 'T' || kd === 'W') ? fmW : fmS); m.receiveShadow = true; m.userData.flat = key;
      part.group.add(m);
      const a = (x1 - x0) * (y1 - y0); cx += (x0 + x1) / 2 * a; cy += (y0 + y1) / 2 * a; area += a;
      part.rooms.push({ name: nm, kind: kd, dim, mesh: m, c: W((x0 + x1) / 2, (y0 + y1) / 2, 0.1) });
    }
    part.center = W(cx / area, cy / area, 0);
    let bb = new THREE.Box3(); for (const r of rooms) { bb.expandByPoint(W(r[2], r[3])); bb.expandByPoint(W(r[4], r[5])); }
    part.box = bb;
    plan.add(part.group);
    flatParts[key] = part;
  }
  for (const k in FLATS) buildFlat(k);
  {
    const cg = COMMON.map(r => { const g = boxG(r[0], r[1], r[2], r[3], 0, 0.03); const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * (r[2] - r[0]), uv.getY(k) * (r[3] - r[1])); return g; });
    plan.add(meshOf(cg, M.common, { cast: false }));
    const core = CORE_A.concat(CORE_A.map(c => [mx(c[2]), c[1], mx(c[0]), c[3]])).map(c => boxG(c[0], c[1], c[2], c[3], 0, WALL_H + 0.3));
    plan.add(meshOf(core, new THREE.MeshStandardMaterial({ color: 0xcfd5dd, roughness: 0.8 })));
    const slab = meshOf(BLOCKS.map(B => boxG(B.r[0], B.r[1], B.r[2], B.r[3], -0.3, -0.005)), M.slab); slab.castShadow = false; plan.add(slab);
  }

  /* ---------- FURNISHED INTERIORS (Pro) ---------- */
  let kit = null; const interiors = {};
  const ceilBg = new THREE.Color(0xd9cbb4); // ≈ the lit floor tone, so only furniture and walls show up as reflections
  function interiorFor(key) {
    if (interiors[key]) return interiors[key];
    if (!kit) kit = createInteriorKit({ envMap: envTex, anisotropy: Math.min(8, renderer.capabilities.getMaxAnisotropy()) });
    const res = kit.build(flatLayout(key), { CX, CY });
    addFloorReflection(res);
    res.group.visible = false; plan.add(res.group);
    return (interiors[key] = res);
  }
  // Real-time reflections in the glossy floor tiles: a mirror pass (Reflector) whose
  // image is blended into the tile material, softened and stronger at grazing angles.
  function addFloorReflection(res) {
    if (!res.floor) return;
    const b = res.bounds, size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const tw = Math.max(256, Math.min(1024, Math.round(size.x * 0.6))), th = Math.max(256, Math.min(1024, Math.round(size.y * 0.6)));
    const refl = new Reflector(new THREE.PlaneGeometry(b.w + 0.4, b.h + 0.4), { textureWidth: tw, textureHeight: th, clipBias: 0.002, multisample: 4 });
    refl.rotation.x = -Math.PI / 2; refl.position.set(b.cx - CX, res.FL, b.cy - CY);
    refl.material.colorWrite = false; refl.material.depthWrite = false; refl.renderOrder = -10;
    const hide = []; res.group.traverse(o => { if (o.isMesh && o.userData.noReflect) hide.push(o); });
    const orig = refl.onBeforeRender;
    refl.onBeforeRender = function (r, s, c, ...rest) {
      const bg = s.background; s.background = ceilBg; hide.forEach(o => { o.visible = false; });
      orig.call(this, r, s, c, ...rest);
      hide.forEach(o => { o.visible = true; }); s.background = bg;
    };
    res.group.add(refl);
    const uni = { tReflect: { value: refl.getRenderTarget().texture }, reflMat: { value: new THREE.Matrix4() }, reflAmt: { value: 0.6 }, reflTexel: { value: new THREE.Vector2(1 / tw, 1 / th) } };
    res.floorMat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, uni);
      sh.vertexShader = 'uniform mat4 reflMat;\nvarying vec4 vReflUv;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n\tvReflUv = reflMat * modelMatrix * vec4( transformed, 1.0 );');
      sh.fragmentShader = 'uniform sampler2D tReflect;\nuniform float reflAmt;\nuniform vec2 reflTexel;\nvarying vec4 vReflUv;\n' + sh.fragmentShader.replace('#include <tonemapping_fragment>', `{
        vec2 ruv = vReflUv.xy / vReflUv.w;
        vec3 rc = texture2D( tReflect, ruv ).rgb * 0.4;
        rc += texture2D( tReflect, ruv + vec2( reflTexel.x * 1.3, 0.0 ) ).rgb * 0.15;
        rc += texture2D( tReflect, ruv - vec2( reflTexel.x * 1.3, 0.0 ) ).rgb * 0.15;
        rc += texture2D( tReflect, ruv + vec2( 0.0, reflTexel.y * 1.3 ) ).rgb * 0.15;
        rc += texture2D( tReflect, ruv - vec2( 0.0, reflTexel.y * 1.3 ) ).rgb * 0.15;
        float fres = pow( 1.0 - saturate( dot( normalize( normal ), normalize( vViewPosition ) ) ), 3.0 );
        gl_FragColor.rgb = mix( gl_FragColor.rgb, rc, reflAmt * ( 0.55 + 0.45 * fres ) );
      }
      #include <tonemapping_fragment>`);
    };
    res.floorMat.customProgramCacheKey = () => 'floor-reflect';
    const inv = new THREE.Matrix4();
    res.floor.onBeforeRender = () => { inv.copy(refl.matrixWorld).invert(); uni.reflMat.value.copy(refl.material.uniforms.textureMatrix.value).multiply(inv); };
    res.reflector = refl;
  }
  // build + compile a flat's interior in the background, before the visitor opens it
  function prewarm(key) {
    if (state.flat !== key || interiors[key]) return;
    const it = interiorFor(key);
    if (renderer.compileAsync) { it.group.visible = true; renderer.compileAsync(scene, camera).catch(() => {}); it.group.visible = false; }
  }
  function aimSun(c) {
    if (c) { sun.target.position.copy(c); sun.position.copy(c).add(new THREE.Vector3(-7, 30, 10)); Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 4, far: 70 }); sun.shadow.bias = -0.00025; sun.shadow.normalBias = 0.015; }
    else { sun.target.position.set(0, 0, 0); sun.position.set(-48, 70, 52); Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 10, far: 220 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; }
    sun.shadow.camera.updateProjectionMatrix(); sun.target.updateMatrixWorld();
  }

  /* ---------- state & modes ---------- */
  const state = { mode: 'site', wing: null, floor: null, flat: null, hoverWing: null, hoverFlat: null, furnished: true, statusOf: id => statusOf(id) };
  function setGhost(lv, on) {
    floorGroups[lv].traverse(o => {
      if (!o.isMesh) return;
      if (on) { if (!o.userData.orig) o.userData.orig = o.material; o.material = M.ghost; o.castShadow = false; }
      else if (o.userData.orig) { o.material = o.userData.orig; o.castShadow = true; }
    });
  }
  function applyMode() {
    const m = state.mode, f = state.floor;
    const xr = (m === 'floor' || m === 'flat' || m === 'apt');
    for (let lv = 0; lv <= NF + 1; lv++) {
      const g = floorGroups[lv];
      if (!xr) { g.visible = true; setGhost(lv, false); }
      else { g.visible = lv < f && m !== 'apt'; setGhost(lv, lv < f); }
      outlines[lv].solid.visible = xr && lv <= f && m !== 'apt';
      outlines[lv].dashed.visible = xr && lv === NF + 1 && m !== 'apt';
    }
    verticals.visible = xr && m !== 'apt';
    site.visible = true; greens.visible = !xr;
    plan.visible = xr;
    if (ground) ground.rings.visible = m === 'site';
    if (xr) plan.position.y = f * FH + 0.06;
    const inside = m === 'apt' && state.furnished && state.flat;
    aimSun(inside ? flatParts[state.flat].center.clone().setY(f * FH) : null);
    hemi.intensity = inside ? 1.3 : 1.15; sun.intensity = inside ? 2.3 : 2.9;
    hemi.color.setHex(inside ? 0xfff1e0 : 0xcfe0ff); hemi.groundColor.setHex(inside ? 0xc9b48f : 0xb3a68a);
    renderer.toneMappingExposure = inside ? 0.97 : 0.92;
    refreshFlatLook();
    renderer.shadowMap.needsUpdate = true; invalidate();
    hooks.onMode && hooks.onMode(state);
  }
  function refreshFlatLook() {
    for (const k in flatParts) {
      const p = flatParts[k], F = FLATS[k];
      const inWing = !state.wing || F.wing === state.wing;
      const id = unitId(F.wing, state.floor || 1, F.n), st = state.statusOf(id);
      const sel = state.flat === k, hov = state.hoverFlat === k;
      const dim = (state.mode === 'apt' && !sel);
      const apt = state.mode === 'apt';
      const on = flatOn(k, state.floor || 2);
      const tint = !on ? 0xdfe2e6 : (sel && apt) ? 0xffffff : sel ? 0x9ec0ff : hov ? 0xc9d9ff : (inWing ? STATUS_TINT[st] : 0xe9ebee);
      for (const fm of p.floorMats) { fm.color.setHex(tint); fm.transparent = dim; fm.opacity = dim ? 0.35 : 1; fm.emissive.setHex(sel && !apt ? 0x1d4ed8 : 0x000000); fm.emissiveIntensity = sel && !apt ? 0.1 : 0; }
      p.wallMat.color.setHex(0xfdfdfb); p.wallMat.emissive.setHex(sel && !apt ? 0x2563eb : 0x000000); p.wallMat.emissiveIntensity = sel && !apt ? 0.35 : 0;
      const showInt = apt && sel && state.furnished;
      if (showInt) interiorFor(k).group.visible = true; else if (interiors[k]) interiors[k].group.visible = false;
      p.walls.visible = !dim && !showInt;
      if (p.glass) p.glass.visible = !dim && !showInt;
      for (const r of p.rooms) r.mesh.visible = !showInt;
    }
    invalidate();
  }

  /* ---------- the real map under the building, and distance rings around it (mapground.js) ---------- */
  const CLASSIC = 200, FAR = 36000; // how far out the camera may go: everywhere (as before), and in the project view once a map is set
  let ground = null, lastD = -1;
  const camDist = () => camera.position.distanceTo(controls.target);
  function setMap({ site: at, radii, source }) {
    if (ground) return;
    ground = createMapGround({ site: at, radii, renderer, onChange: invalidate, onLive: on => {
      plain.visible = !on; for (const o of plainBits) o.visible = !on; // the stand-in surroundings step aside for the real ones
      renderer.shadowMap.needsUpdate = true; lastD = -1; invalidate(); hooks.onMap && hooks.onMap(on, ground.credit);
    } });
    scene.add(ground.base); scene.add(ground.group); scene.add(ground.rings);
    ground.rings.visible = state.mode === 'site'; lastD = -1; resize();
    Promise.resolve(source).then(s => { ground.setSource(s); lastD = -1; invalidate(); }, () => {});
  }
  function farView(D) { // everything that depends on how far out the camera is. Up to 200 m nothing differs from before.
    const fogF = Math.max(420, 4.5 * D - 480);
    scene.fog.near = Math.max(170, 1.6 * D - 150); scene.fog.far = fogF;
    camera.near = D > 260 ? D * 0.012 : 0.5; camera.far = Math.max(900, fogF * 1.15); camera.updateProjectionMatrix();
    controls.zoomSpeed = D > 210 ? 2.6 : 1; controls.screenSpacePanning = D <= 260;
    if (ground) { ground.base.visible = ground.live || D > 230; ground.update(D, fogF); }
  }

  /* Zooming out of the building tips the view up, the way a map does, so the ground and the rings open out instead of
     being seen edge-on; zooming back in brings the camera down to where it was. Turning the view by hand out there
     leaves it in the visitor's hands until they are back at the building. Inside the first 200 m nothing is touched. */
  const LOW = controls.maxPolarAngle, HIGH = 40 * Math.PI / 180, sph = new THREE.Spherical(), offv = new THREE.Vector3(), downs = new Set();
  let rest = null, byHand = false, turning = false, lastPhi = null;
  renderer.domElement.addEventListener('pointerdown', ev => { downs.add(ev.pointerId); turning = downs.size === 1 && (ev.pointerType !== 'mouse' || ev.button === 0); });
  ['pointerup', 'pointercancel'].forEach(n => renderer.domElement.addEventListener(n, ev => { downs.delete(ev.pointerId); turning = false; }));
  function tilt() {
    offv.copy(camera.position).sub(controls.target); sph.setFromVector3(offv);
    const D = sph.radius;
    if (turning && lastPhi !== null && D > CLASSIC && Math.abs(sph.phi - lastPhi) > 1e-4) byHand = true;
    if (D <= CLASSIC) { byHand = false; rest = sph.phi; }
    else if (!byHand && !turning) {
      const want = Math.min(rest === null ? LOW : rest, LOW + (HIGH - LOW) * Math.min(1, Math.log(D / CLASSIC) / Math.log(6)));
      if (Math.abs(sph.phi - want) > 1e-4) { sph.phi = want; camera.position.copy(controls.target).add(offv.setFromSpherical(sph)); camera.lookAt(controls.target); dirty = true; }
    }
    lastPhi = sph.phi;
  }

  /* ---------- camera flights ---------- */
  let flight = null;
  function flyTo(pos, target, dur = 1400) {
    byHand = false;
    const o0 = camera.position.clone().sub(controls.target), o1 = pos.clone().sub(target), far = Math.max(o0.length(), o1.length()) > 260;
    flight = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos.clone(), t1: target.clone(), s: performance.now(), d: dur,
      zoom: far ? { u0: o0.clone().normalize(), u1: o1.clone().normalize(), l0: Math.log(o0.length()), l1: Math.log(o1.length()) } : null }; // a long zoom changes scale evenly
  }
  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const fit = o => o.multiplyScalar(camera.aspect < 1 ? 1.4 : 1);
  const VIEW = {
    site: () => [fit(new THREE.Vector3(0, 3, 140)).add(new THREE.Vector3(0, 11, 2)), new THREE.Vector3(0, 11, 2)], // opens straight on, from across the road
    wing: w => { const c = W(w === 'A' ? 11 : 32.1, 12.6, 11); return [c.clone().add(fit(new THREE.Vector3(w === 'A' ? -44 : 40, 28, 54))), c]; },
    floor: (w, f) => { const c = W(w === 'A' ? 11.5 : 31.6, 13, f * FH); return [c.clone().add(fit(new THREE.Vector3(w === 'A' ? -22 : 22, 44, 40))), c]; },
    flat: k => { const p = flatParts[k], c = p.center.clone(); c.y = state.floor * FH + 0.5; const s = p.box.getSize(new THREE.Vector3()).length(); return [c.clone().add(fit(new THREE.Vector3(-0.6 * s - 8, 1.5 * s + 14, 1.0 * s + 14))), c]; },
    apt: k => { const p = flatParts[k], c = p.center.clone(); c.y = state.floor * FH + 0.4; const s = p.box.getSize(new THREE.Vector3()).length(); const o = state.furnished ? new THREE.Vector3(-0.42 * s, 1.38 * s + 3.6, 0.8 * s + 1.4) : new THREE.Vector3(-0.55 * s, 1.15 * s + 3, 0.9 * s + 1); return [c.clone().add(fit(o)), c]; }
  };

  // A whole distance ring (radius m, centred on the building) in view: from the side the camera is on now, tilted like a model on a table.
  function ringView(m) {
    const w = canvasWrap.clientWidth, h = canvasWrap.clientHeight, free = w > 820 && !root.classList.contains('v-collapsed') ? w - 372 : w;
    const el = 50 * Math.PI / 180, t = Math.tan(el + 12.4 * Math.PI / 180), az = controls.getAzimuthalAngle();
    const D = Math.max(m * t / (t * Math.cos(el) - Math.sin(el)), m / (0.86 * Math.tan(15 * Math.PI / 180) * free / h)); // fits top to bottom, and side to side
    return [new THREE.Vector3(Math.sin(az) * Math.cos(el) * D, Math.sin(el) * D, Math.cos(az) * Math.cos(el) * D), new THREE.Vector3(0, 0, 0)];
  }

  /* ---------- public API ---------- */
  const api = {
    state, FLATS, flatParts,
    home() { Object.assign(state, { mode: 'site', wing: null, floor: null, flat: null }); controls.minDistance = 6; applyMode(); flyTo(...VIEW.site()); },
    selectWing(w) { Object.assign(state, { mode: 'wing', wing: w, floor: null, flat: null }); applyMode(); flyTo(...VIEW.wing(w)); },
    selectFloor(f) { if (!state.wing) state.wing = 'A'; Object.assign(state, { mode: 'floor', floor: f, flat: null }); applyMode(); flyTo(...VIEW.floor(state.wing, f)); },
    selectFlat(key) { const F = FLATS[key]; state.wing = F.wing; if (!state.floor) state.floor = 5; Object.assign(state, { mode: 'flat', flat: key }); applyMode(); flyTo(...VIEW.flat(key)); setTimeout(() => prewarm(key), 1500); },
    interiorDebug(key) { return interiorFor(key).debug; },
    setFurnished(on) { state.furnished = !!on; applyMode(); if (state.mode === 'apt') flyTo(...VIEW.apt(state.flat), 900); },
    explore() { if (!state.flat) return; state.mode = 'apt'; applyMode(); controls.minDistance = 4; flyTo(...VIEW.apt(state.flat), 1600); },
    topView() { if (!state.flat) return; const p = flatParts[state.flat], c = p.center.clone(); c.y = state.floor * FH; const s = p.box.getSize(new THREE.Vector3()).length(); flyTo(c.clone().add(new THREE.Vector3(0.001, 1.9 * s + 4, 0.35)), c, 1000); },
    view3d() { if (state.flat) flyTo(...VIEW.apt(state.flat), 1000); },
    zoom(f) { const d = camera.position.clone().sub(controls.target).multiplyScalar(f); flyTo(controls.target.clone().add(d), controls.target.clone(), 450); },
    reset() { const m = state.mode; if (m === 'site') flyTo(...VIEW.site()); else if (m === 'wing') flyTo(...VIEW.wing(state.wing)); else if (m === 'floor') flyTo(...VIEW.floor(state.wing, state.floor)); else if (m === 'flat') flyTo(...VIEW.flat(state.flat)); else flyTo(...VIEW.apt(state.flat)); },
    highlightRoom(i) { const p = flatParts[state.flat]; if (!p) return; p.rooms.forEach((r, k) => { r.mesh.scale.y = 1; r.mesh.material = r.mesh.material; }); api._hlRoom = i; },
    setHoverFlat(k) { state.hoverFlat = k; refreshFlatLook(); },
    refresh() { refreshFlatLook(); },
    project(v) { const p = v.clone().project(camera); const r = renderer.domElement.getBoundingClientRect(); return { x: (p.x + 1) / 2 * r.width, y: (1 - p.y) / 2 * r.height, z: p.z }; },
    azimuth() { return controls.getAzimuthalAngle(); },
    setAutoRotate(v) { controls.autoRotate = v; invalidate(); },
    layout() { resize(); }, // call after the side panel is hidden or shown
    /* the map under the building (optional): setMap({ site: { lat, lng, heading }, radii: [km…], source: a tile source from mapground.js }) */
    setMap,
    get mapOn() { return !!ground; }, // a map was set, so the project view can zoom out past the building
    get mapLive() { return !!ground && ground.live; }, // its tiles have arrived
    geo(lat, lng, y = 0) { const q = ground ? ground.frame.toScene(lat, lng) : [0, 0]; return new THREE.Vector3(q[0], y, q[1]); }, // a place on the map → a point in the scene
    vec: (x, y, z) => new THREE.Vector3(x, y, z),
    north() { return ground ? ground.frame.theta : 0; },
    dist: camDist, // camera to what it looks at, in metres
    flying: () => !!flight,
    ringDist: m => ringView(m)[0].length(),
    frameRing(m, dur = 1500) { controls.autoRotate = false; flyTo(...ringView(m), dur); },
    setRing(km) { if (ground) ground.setRadius(km); }, // highlight one distance ring (null: none)
    seen: p => camera.position.distanceTo(p) < scene.fog.far * 0.9, // not lost in the haze
    renderer, scene, camera
  };

  /* ---------- picking ---------- */
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  let downAt = null;
  function pick(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    if (state.mode === 'site' || state.mode === 'wing') {
      const hit = ray.intersectObjects(wingMeshes, false)[0];
      return hit ? { wing: hit.object.userData.wing } : null;
    }
    if (state.mode === 'floor' || state.mode === 'flat') {
      const objs = []; for (const k in flatParts) { const p = flatParts[k]; if (!state.wing || FLATS[k].wing === state.wing) p.group.children.forEach(c => objs.push(c)); }
      const hit = ray.intersectObjects(objs, false)[0];
      return hit && flatOn(hit.object.userData.flat, state.floor) ? { flat: hit.object.userData.flat } : null;
    }
    return null;
  }
  renderer.domElement.addEventListener('pointermove', ev => {
    if (ev.buttons) return;
    const h = pick(ev);
    const w = h && h.wing || null, f = h && h.flat || null;
    if (w !== state.hoverWing) { state.hoverWing = w; invalidate(); for (const k of ['A', 'B']) { const mt = k === 'A' ? M.wallA : M.wallB; mt.emissive.setHex(w === k ? 0x2a4fae : 0); mt.emissiveIntensity = w === k ? 0.18 : 0; } }
    if (f !== state.hoverFlat) { state.hoverFlat = f; refreshFlatLook(); }
    renderer.domElement.style.cursor = (w || f) ? 'pointer' : 'grab';
    hooks.onHover && hooks.onHover({ wing: w, flat: f, x: ev.clientX, y: ev.clientY });
  });
  renderer.domElement.addEventListener('pointerleave', () => { hooks.onHover && hooks.onHover({}); });
  renderer.domElement.addEventListener('pointerdown', ev => { downAt = [ev.clientX, ev.clientY]; controls.autoRotate = false; hooks.onInteract && hooks.onInteract(); });
  renderer.domElement.addEventListener('pointerup', ev => {
    if (!downAt || Math.hypot(ev.clientX - downAt[0], ev.clientY - downAt[1]) > 5) return;
    const h = pick(ev); if (!h) return;
    if (h.wing) { api.selectWing(h.wing); hooks.onSelect && hooks.onSelect(state); }
    if (h.flat) { api.selectFlat(h.flat); hooks.onSelect && hooks.onSelect(state); }
  });

  /* ---------- loop ---------- */
  function resize() {
    const w = canvasWrap.clientWidth, h = canvasWrap.clientHeight;
    renderer.setSize(w, h, false);
    const side = w > 820 && !root.classList.contains('v-collapsed') ? 186 : 0; // half the side panel (360 px + 12 px inset), so the model centres in the free area
    camera.aspect = (w + 2 * side) / h;
    if (side) camera.setViewOffset(w + 2 * side, h, 2 * side, 0, w, h); else camera.clearViewOffset();
    camera.updateProjectionMatrix(); invalidate();
    if (ground) ground.resize(w, h);
  }
  new ResizeObserver(resize).observe(canvasWrap); resize();
  [camera.position, controls.target] = [VIEW.site()[0], VIEW.site()[1]];
  camera.position.copy(VIEW.site()[0]); controls.target.copy(VIEW.site()[1]);
  controls.autoRotate = true; controls.autoRotateSpeed = 0.35;
  applyMode();
  let visible = true;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(root);
  function loop(t) {
    requestAnimationFrame(loop);
    if (!visible) return;
    controls.maxDistance = ground && (flight || state.mode === 'site') ? FAR : CLASSIC;
    if (flight) {
      const k = Math.min(1, Math.max(0, (t - flight.s) / flight.d)), e = ease(k), z = flight.zoom; // a frame can be stamped earlier than the moment the flight was asked for
      controls.target.lerpVectors(flight.t0, flight.t1, e);
      if (z) camera.position.lerpVectors(z.u0, z.u1, e).normalize().multiplyScalar(Math.exp(z.l0 + (z.l1 - z.l0) * e)).add(controls.target);
      else camera.position.lerpVectors(flight.p0, flight.p1, e);
      if (k >= 1) flight = null;
      dirty = true;
    }
    if (controls.update() || controls.autoRotate) dirty = true;
    if (ground && !flight && state.mode === 'site') tilt();
    if (!dirty) return;
    dirty = false;
    const D = camDist(); if (Math.abs(D - lastD) > 0.005) { lastD = D; farView(D); }
    renderer.render(scene, camera);
    hooks.onFrame && hooks.onFrame();
  }
  requestAnimationFrame(loop);
  return api;

  /* ---------- textures ---------- */
  function skyTexture() {
    const c = document.createElement('canvas'); c.width = 4; c.height = 256; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#8fb3df'); g.addColorStop(0.55, '#cfdeef'); g.addColorStop(1, '#eef2f5');
    x.fillStyle = g; x.fillRect(0, 0, 4, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function tileTex(base, line, n, veins, rx = 1, ry = 1) {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    x.fillStyle = base; x.fillRect(0, 0, 256, 256);
    if (veins) { x.strokeStyle = 'rgba(160,140,110,.18)'; x.lineWidth = 1.2; for (let i = 0; i < 14; i++) { x.beginPath(); let px = Math.random() * 256, py = Math.random() * 256; x.moveTo(px, py); for (let k = 0; k < 5; k++) { px += (Math.random() - 0.3) * 60; py += (Math.random() - 0.5) * 40; x.lineTo(px, py); } x.stroke(); } }
    x.strokeStyle = line; x.lineWidth = 2; const s = 256 / (n / 2 || 1);
    for (let i = 0; i <= 256; i += s) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 256); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(256, i); x.stroke(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
}
