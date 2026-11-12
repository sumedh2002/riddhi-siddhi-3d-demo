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
const TILES = 4; // each zoom level is a 4 × 4 block of tiles around the building; finer levels sit on top of coarser ones
/**
 * createMapGround({ site, radii, renderer, onChange, onLive })
 * Returns { base, group, rings, frame, setSource(src), update(camDist, seeDist), setRadius(km | null), resize(w, h), live, credit }.
 * base: flat land out to the horizon. group: the tiles (hidden until enough of them have arrived).
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
  let src = null, levels = [], live = false, batch = null, gen = 0;

  function setSource(s) {
    gen++;
    for (const L of levels) for (const t of L.tiles) if (t.mesh) { group.remove(t.mesh); t.mesh.material.map.dispose(); t.mesh.material.dispose(); }
    levels = []; src = s; batch = null;
    if (!s) { setLive(false); return; }
    for (let z = s.maxZoom; z >= s.minZoom; z--) { // finest first
      const n = 2 ** z, size = frame.span / n, cx = Math.round(frame.x0 * n), cy = Math.round(frame.y0 * n), tiles = [];
      for (let ty = cy - TILES / 2; ty < cy + TILES / 2; ty++) for (let tx = cx - TILES / 2; tx < cx + TILES / 2; tx++) if (ty >= 0 && ty < n) tiles.push({ tx, ty, mesh: null });
      levels.push({ z, n, size, reach: (TILES / 2 - 0.5) * size, tiles, asked: false });
    }
  }
  function setLive(v) { if (live === v) return; live = v; group.visible = v; base.material.color.setHex(v && src.land ? src.land : PLAIN); onLive && onLive(v, src); onChange && onChange(); }
  function ask(L, b) {
    L.asked = true; const g = gen;
    for (const t of L.tiles) {
      b.total++;
      const settle = ok => { if (g !== gen) return; b.done++; if (ok) b.ok++; if (b === batch && b.done === b.total && !live) setLive(b.ok >= b.total * 0.6); };
      loader.load(src.url(L.z, ((t.tx % L.n) + L.n) % L.n, t.ty), tex => {
        if (g !== gen) { tex.dispose(); return; }
        tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = aniso;
        const m = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, ...flat }));
        m.scale.set(L.size, 1, L.size); m.position.set(((t.tx + 0.5) / L.n - frame.x0) * frame.span, 0, ((t.ty + 0.5) / L.n - frame.y0) * frame.span);
        m.renderOrder = -70 + (L.z - src.minZoom); t.mesh = m; group.add(m);
        settle(true); onChange && onChange();
      }, undefined, () => settle(false));
    }
  }
  /** Call every frame: camDist = camera to target, seeDist = how far the ground can be seen (the fog). Loads what that view needs. */
  function update(camDist, seeDist) {
    if (!src) return;
    const b = batch || { total: 0, done: 0, ok: 0 }; let finer = null;
    for (const L of levels) {
      const coarsest = L === levels[levels.length - 1];
      if (camDist > 4500 * L.size / 256 && !coarsest) continue; // finer than this view can show
      if (!L.asked && (!finer || seeDist > finer.reach)) ask(L, b);
      finer = L;
    }
    if (!batch && b.total) batch = b; // the first view's tiles decide whether the map goes on
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
    get credit() { return src ? src.credit : ''; }
  };
}
