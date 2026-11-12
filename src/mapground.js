/* =========================================================
   MAP GROUND — the real map as the ground of the 3D scene.

   The building stays where it is (the scene's origin); map tiles are
   laid out around it in metres, so zooming out of the building shows
   its actual surroundings. Distance rings are drawn on the same ground,
   centred on the building.

   Tiles come from a "source": OpenStreetMap needs no key; Google
   (satellite with road names) needs a Maps Platform key with the
   Map Tiles API enabled. If a source cannot be reached nothing is
   shown here and the viewer keeps its plain surroundings.
   ========================================================= */
import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

const RAD = Math.PI / 180, R_EARTH = 6371008.8, R_WGS = 6378137;
/** Straight-line distance in metres between two { lat, lng } points. */
export function distM(a, b) {
  const p1 = a.lat * RAD, p2 = b.lat * RAD, dp = p2 - p1, dl = (b.lng - a.lng) * RAD;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(h));
}
export const fmtDist = m => m < 950 ? Math.round(m / 10) * 10 + ' m' : (m / 1000).toFixed(m < 9950 ? 1 : 0) + ' km';
export const fmtRing = km => km < 1 ? km * 1000 + ' m' : km + ' km';
// Web Mercator with the whole world as a unit square (x → east, y → south)
const mx = lng => (lng + 180) / 360;
const my = lat => { const s = Math.sin(lat * RAD); return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI); };

/**
 * The link between the map and the scene. site = { lat, lng, heading }: the position of the centre of the
 * building, and the compass bearing its front (the road side, +z in the scene) faces.
 */
export function geoFrame(site) {
  const span = 2 * Math.PI * R_WGS * Math.cos(site.lat * RAD); // metres across the Mercator world at this latitude
  const x0 = mx(site.lng), y0 = my(site.lat), theta = ((site.heading === undefined ? 180 : site.heading) - 180) * RAD, c = Math.cos(theta), s = Math.sin(theta);
  return {
    span, x0, y0, theta,
    /** lat/lng → [x, z] on the scene's ground, in metres from the centre of the building */
    toScene(lat, lng) { const e = (mx(lng) - x0) * span, so = (my(lat) - y0) * span; return [e * c + so * s, -e * s + so * c]; }
  };
}

/* ---------- tile sources ---------- */
export const osmTiles = () => Promise.resolve({
  name: 'osm', minZoom: 11, maxZoom: 19, land: 0xf2efe9,
  url: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
  credit: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
});
/** Any other provider: a URL with {z} {x} {y} in it, and the credit line that provider asks for. */
export const templateTiles = (url, credit, maxZoom = 19) => Promise.resolve({
  name: 'custom', minZoom: 11, maxZoom, land: 0xdfe4dd,
  url: (z, x, y) => url.replace('{z}', z).replace('{x}', x).replace('{y}', y), credit: credit || ''
});
/** Esri World Imagery. With an ArcGIS Location Platform key: the basemap tiles endpoint. Without a key the public
    tile URL is used, but only on localhost, for testing; anywhere else this rejects so the street map is used instead. */
export function esriTiles(key, credit) {
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  if (!key && !local) return Promise.reject(new Error('Satellite imagery needs an Esri key (ESRI_KEY in config.js).'));
  const base = key ? 'https://ibasemaps-api.arcgis.com' : 'https://server.arcgisonline.com', t = key ? '?token=' + encodeURIComponent(key) : '';
  return Promise.resolve({ name: 'esri', minZoom: 11, maxZoom: 19, land: 0x5d6552, credit,
    url: (z, x, y) => `${base}/arcgis/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}${t}` });
}
/** Google satellite imagery with road names (Map Tiles API). Rejects if the key cannot open a session. */
export async function googleTiles(key, site) {
  const k = encodeURIComponent(key), api = 'https://tile.googleapis.com/';
  const r = await fetch(`${api}v1/createSession?key=${k}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mapType: 'satellite', language: 'en-US', region: 'IN', layerTypes: ['layerRoadmap'], overlay: false }) });
  if (!r.ok) throw new Error(`Google Maps did not accept the key (${r.status}). Check that the Map Tiles API is enabled for it and that this website is allowed.`);
  const { session } = await r.json();
  if (!session) throw new Error('Google Maps did not return a map session.');
  let credit = 'Map data © Google';
  try { // Google's terms: show the copyright line for the area on screen
    const d = 0.06, v = await fetch(`${api}tile/v1/viewport?session=${session}&key=${k}&zoom=14&north=${site.lat + d}&south=${site.lat - d}&east=${site.lng + d}&west=${site.lng - d}`);
    if (v.ok) { const j = await v.json(); if (j.copyright) credit = String(j.copyright).replace(/[<>&]/g, ''); }
  } catch (e) { /* keep the default line */ }
  return { name: 'google', minZoom: 11, maxZoom: 20, land: 0x5d6552, url: (z, x, y) => `${api}v1/2dtiles/${z}/${x}/${y}?session=${session}&key=${k}`, credit: '<b>Google</b> · ' + credit };
}

/* ---------- the ground ---------- */
// Tiles are picked from the camera, like a map app: a tile is split into its four children while the camera is closer
// to it than SPLIT × its size, so the ground nearest the camera is the sharpest. ROOT × ROOT tiles at minZoom around the
// building (±37 km at zoom 11) carry the imagery out to the horizon; only tiles in view and nearer than the haze are fetched.
const ROOT = 4, SPLIT = 2, BUDGET = 72, PARALLEL = 6, KEEP = 240;
/**
 * createMapGround({ site, radii, renderer, onChange, onLive })
 * Returns { base, group, rings, frame, setSource(src), update(camera, seeDist), setRadius(km | null), resize(w, h), live, credit, stats }.
 * base: flat land out to the horizon. group: the tiles (hidden until enough of the first ones have arrived).
 * rings: the distance rings and the shade outside the chosen one.
 */
export function createMapGround({ site, radii, renderer, onChange, onLive }) {
  const frame = geoFrame(site);
  const group = new THREE.Group(); group.rotation.y = frame.theta; group.visible = false;
  const flat = { depthTest: false, depthWrite: false }; // the ground is drawn first and never hides anything
  // the land beyond the tiles (and all of it while there are none): one flat colour that fades into the haze
  const PLAIN = 0xc9c7b4, base = new THREE.Mesh(new THREE.CircleGeometry(160000, 48), new THREE.MeshBasicMaterial({ color: PLAIN, toneMapped: false, ...flat }));
  base.rotation.x = -Math.PI / 2; base.renderOrder = -80; base.visible = false;
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(190, 190), new THREE.ShadowMaterial({ opacity: 0.26, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.012; shadow.receiveShadow = true; shadow.renderOrder = -14; group.add(shadow);
  const quad = new THREE.PlaneGeometry(1, 1); quad.rotateX(-Math.PI / 2); // image top → north
  const loader = new THREE.TextureLoader(), aniso = renderer.capabilities.getMaxAnisotropy();
  const box = new THREE.Box3(), frustum = new THREE.Frustum(), pm = new THREE.Matrix4(), cam = new THREE.Vector3();
  const cache = new Map(); // 'z/x/y' → { z, x, y, mesh, state: 1 loading | 2 shown-able | 3 failed, used }
  const stats = { requested: 0, loaded: 0, failed: 0 };
  let src = null, live = false, gen = 0, roots = [], want = [], loading = 0, tick = 0, first = null;

  function drop(t) { if (t.mesh) { group.remove(t.mesh); t.mesh.material.map.dispose(); t.mesh.material.dispose(); t.mesh = null; } }
  function setSource(s) {
    gen++; for (const t of cache.values()) drop(t); cache.clear(); src = s; want = []; loading = 0; first = null;
    if (!s) { setLive(false); return; }
    const n = 2 ** s.minZoom, cx = Math.round(frame.x0 * n), cy = Math.round(frame.y0 * n);
    roots = []; for (let y = cy - ROOT / 2; y < cy + ROOT / 2; y++) for (let x = cx - ROOT / 2; x < cx + ROOT / 2; x++) roots.push([s.minZoom, x, y]);
  }
  function setLive(v) { if (live === v) return; live = v; group.visible = v; base.material.color.setHex(v && src.land ? src.land : PLAIN); onLive && onLive(v, src); onChange && onChange(); }
  const rect = (z, x, y) => { const n = 2 ** z, s = frame.span / n; return [(x / n - frame.x0) * frame.span, (y / n - frame.y0) * frame.span, s, n]; };
  function pick(k, see) { // the tiles this view needs, finest nearest the camera
    const out = [], stack = roots.slice();
    while (stack.length) {
      const [z, x, y] = stack.pop(), [x0, z0, s, n] = rect(z, x, y);
      if (y < 0 || y >= n) continue;
      box.min.set(x0, 0, z0); box.max.set(x0 + s, 0.1, z0 + s); box.applyMatrix4(group.matrixWorld);
      if (!frustum.intersectsBox(box)) continue;
      const d = Math.hypot(Math.max(x0 - cam.x, 0, cam.x - x0 - s), cam.y, Math.max(z0 - cam.z, 0, cam.z - z0 - s));
      if (d > see) continue;
      if (z < src.maxZoom && d < s * k) stack.push([z + 1, 2 * x, 2 * y], [z + 1, 2 * x + 1, 2 * y], [z + 1, 2 * x, 2 * y + 1], [z + 1, 2 * x + 1, 2 * y + 1]);
      else out.push([z, x, y]);
    }
    return out;
  }
  function load(z, x, y) {
    const n = 2 ** z, t = { z, x, y, mesh: null, state: 1, used: tick }, g = gen; cache.set(z + '/' + x + '/' + y, t); loading++; stats.requested++;
    const settle = ok => {
      if (g !== gen) return; loading--; t.state = ok ? 2 : 3; ok ? stats.loaded++ : stats.failed++;
      if (first && !live && first.left > 0) { if (ok) first.ok++; if (--first.left === 0) setLive(first.ok >= first.n * 0.6); }
      onChange && onChange();
    };
    loader.load(src.url(z, ((x % n) + n) % n, y), tex => {
      if (g !== gen) { tex.dispose(); return; }
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = aniso;
      const [x0, z0, s] = rect(z, x, y), m = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, ...flat }));
      m.scale.set(s, 1, s); m.position.set(x0 + s / 2, 0, z0 + s / 2); m.renderOrder = -70 + (z - src.minZoom); m.visible = false;
      t.mesh = m; group.add(m); settle(true);
    }, undefined, () => settle(false));
  }
  /** Call on every frame drawn: seeDist = how far the ground can be seen (the fog). Shows and fetches what this view needs. */
  function update(camera, seeDist) {
    if (!src) return;
    tick++; group.updateMatrixWorld(); camera.updateMatrixWorld();
    frustum.setFromProjectionMatrix(pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    group.worldToLocal(cam.copy(camera.position));
    let k = SPLIT, need = pick(k, seeDist);
    while (need.length > BUDGET && k > 0.5) need = pick(k *= 0.75, seeDist); // over budget: a little softer, never more tiles
    for (const t of cache.values()) if (t.mesh) t.mesh.visible = false;
    want = [];
    for (const [z, x, y] of need) {
      const t = cache.get(z + '/' + x + '/' + y);
      if (!t) want.push([z, x, y]);
      if (t && t.mesh) { t.mesh.visible = true; t.used = tick; continue; }
      for (let pz = z - 1, px = x >> 1, py = y >> 1; pz >= src.minZoom; pz--, px >>= 1, py >>= 1) { // until it arrives, its nearest loaded parent stands in
        const p = cache.get(pz + '/' + px + '/' + py); if (p && p.mesh) { p.mesh.visible = true; p.used = tick; break; }
      }
    }
    want.sort((a, b) => a[0] - b[0]); // coarse first, so the whole view fills in quickly and then sharpens
    if (!first && want.length) first = { n: Math.min(12, want.length), left: Math.min(12, want.length), ok: 0 }; // the first tiles decide whether the map goes on
    while (loading < PARALLEL && want.length) load(...want.shift());
    if (cache.size > KEEP) for (const [id, t] of [...cache].filter(([, t]) => t.state !== 1 && t.used < tick).sort((a, b) => a[1].used - b[1].used).slice(0, cache.size - KEEP)) { drop(t); cache.delete(id); }
  }

  /* distance rings, centred on the building */
  const rings = new THREE.Group(), mats = [];
  const circle = (R, mat, order) => {
    const pts = []; for (let i = 0; i <= 256; i++) { const a = i / 256 * 2 * Math.PI; pts.push(Math.sin(a) * R, 0.06, Math.cos(a) * R); }
    const g = new LineGeometry(); g.setPositions(pts);
    const l = new Line2(g, mat); l.renderOrder = order; l.frustumCulled = false; rings.add(l); return l;
  };
  const lineMat = (color, width, opacity) => { const m = new LineMaterial({ color, linewidth: width, transparent: true, opacity, depthWrite: false }); m.fog = true; mats.push(m); return m; };
  const ringSet = radii.map(km => ({ km, under: lineMat(0x0d1117, 4, 0.3), over: lineMat(0xffffff, 1.6, 0.95) }));
  for (const r of ringSet) { circle(r.km * 1000, r.under, -11); circle(r.km * 1000, r.over, -10); }
  const shade = new THREE.Mesh(new THREE.RingGeometry(1, 240, 128, 1), new THREE.MeshBasicMaterial({ color: 0x0d1117, transparent: true, opacity: 0.2, depthWrite: false }));
  shade.rotation.x = -Math.PI / 2; shade.position.y = 0.03; shade.renderOrder = -12; shade.visible = false; rings.add(shade);
  function setRadius(km) { // the chosen ring is drawn stronger and everything outside it is dimmed; null = no choice
    shade.visible = !!km; if (km) shade.scale.setScalar(km * 1000);
    for (const r of ringSet) { const on = r.km === km; r.under.linewidth = on ? 6 : 4; r.over.linewidth = on ? 3 : 1.6; r.over.opacity = on || !km ? 0.95 : 0.7; }
    onChange && onChange();
  }

  return {
    base, group, rings, frame, setSource, update, setRadius,
    resize(w, h) { for (const m of mats) m.resolution.set(w, h); },
    get live() { return live; },
    get credit() { return src ? src.credit : ''; },
    stats
  };
}
