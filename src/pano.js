/* =========================================================
   PANO — a small 360° viewer for the Premium walkthrough.
   Each viewpoint is a cube of 6 square photos (n, e, s, w, up, down),
   each covering exactly 90°. Drag to look around, pinch / scroll to zoom,
   tap a floor marker to walk to the next room (cross-fade).
   ========================================================= */
import * as THREE from 'three';

// face: [forward, up] in world axes (north = -Z, east = +X, up = +Y)
const FACES = { n: [[0, 0, -1], [0, 1, 0]], e: [[1, 0, 0], [0, 1, 0]], s: [[0, 0, 1], [0, 1, 0]], w: [[-1, 0, 0], [0, 1, 0]], u: [[0, 1, 0], [0, 0, 1]], d: [[0, -1, 0], [0, 0, -1]] };
const DEG = Math.PI / 180;

export function createPano(el, hooks = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const cv = renderer.domElement; cv.className = 'pano-cv'; el.prepend(cv);
  const marks = document.createElement('div'); marks.className = 'pano-marks'; el.appendChild(marks);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(65, 1, 0.01, 10);
  camera.rotation.order = 'YXZ';
  const loader = new THREE.TextureLoader(), cache = new Map(), maxAniso = renderer.capabilities.getMaxAnisotropy();
  let yaw = 0, pitch = -4 * DEG, zk = 1, cube = null, fading = null, spots = [], dirty = true, raf = 0, vel = 0, alive = true;

  function tex(url) {
    if (!cache.has(url)) cache.set(url, loader.loadAsync(url).then(t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t; }));
    return cache.get(url);
  }
  function makeCube(maps) {
    const g = new THREE.Group();
    for (const k in FACES) {
      const [F, U] = FACES[k].map(a => new THREE.Vector3(...a)), R = F.clone().cross(U);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.004, 2.004), new THREE.MeshBasicMaterial({ map: maps[k], transparent: true, opacity: 1, depthTest: false, depthWrite: false, toneMapped: false }));
      m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(R, U, F.clone().negate())); m.position.copy(F);
      g.add(m);
    }
    return g;
  }
  const setOpacity = (g, o) => g.children.forEach(m => { m.material.opacity = o; });
  function disposeCube(g) { g.children.forEach(m => { m.geometry.dispose(); m.material.dispose(); }); scene.remove(g); }

  /** show a viewpoint: urls {n,e,s,w,u,d}; spots [{dir:[x,y,z], label, key}]; opts {yaw (rad), fade} */
  async function show(urls, spotList = [], opts = {}) {
    const token = {}; show.token = token;
    el.classList.add('pano-loading');
    let maps;
    try { maps = Object.fromEntries(await Promise.all(Object.keys(FACES).map(async k => [k, await tex(urls[k])]))); }
    catch (e) { el.classList.remove('pano-loading'); hooks.onError && hooks.onError(e); return; }
    if (show.token !== token || !alive) return;
    el.classList.remove('pano-loading');
    const g = makeCube(maps); scene.add(g);
    if (opts.yaw !== undefined) { yaw = opts.yaw; pitch = -4 * DEG; }
    if (cube && opts.fade !== false) {
      if (fading) { disposeCube(fading.from); }
      g.renderOrder = 1; setOpacity(g, 0);
      fading = { from: cube, to: g, t0: performance.now() };
    } else if (cube) disposeCube(cube);
    cube = g;
    setSpots(spotList);
    kick();
  }
  function setSpots(list) {
    marks.innerHTML = '';
    spots = list.map(s => {
      const b = document.createElement('button'); b.className = 'pano-spot'; b.type = 'button';
      b.innerHTML = `<i aria-hidden="true"></i><span>${s.label}</span>`; b.setAttribute('aria-label', `Walk to ${s.label}`);
      b.addEventListener('click', ev => { ev.stopPropagation(); hooks.onSpot && hooks.onSpot(s.key); });
      marks.appendChild(b);
      return { el: b, dir: new THREE.Vector3(...s.dir).normalize(), dist: Math.hypot(s.dir[0], s.dir[2]) };
    });
  }
  /** preload a viewpoint's photos (e.g. the rooms you can walk to) */
  function preload(urls) { Object.values(urls).forEach(u => tex(u).catch(() => {})); }

  /* ---------- look around ---------- */
  const ptrs = new Map(); let last = null, pinch0 = null;
  cv.addEventListener('pointerdown', e => {
    ptrs.set(e.pointerId, [e.clientX, e.clientY]); try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
    if (ptrs.size === 1) { last = [e.clientX, e.clientY, performance.now()]; vel = 0; el.classList.add('drag'); hooks.onInteract && hooks.onInteract(); }
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: zk }; }
  });
  cv.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptrs.size === 2 && pinch0) { const [a, b] = [...ptrs.values()]; zk = clampZ(pinch0.z * pinch0.d / Math.max(20, Math.hypot(a[0] - b[0], a[1] - b[1]))); kick(); return; }
    if (!last) return;
    const k = (curFov() * DEG) / cv.clientHeight, dx = e.clientX - last[0], dy = e.clientY - last[1], now = performance.now();
    yaw += dx * k; pitch = clampPitch(pitch + dy * k);
    vel = dx * k / Math.max(8, now - last[2]) * 16; last = [e.clientX, e.clientY, now]; kick();
  });
  const up = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch0 = null; if (!ptrs.size) { last = null; el.classList.remove('drag'); kick(); } };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { e.preventDefault(); zk = clampZ(zk * Math.exp(e.deltaY * 0.0012)); kick(); }, { passive: false });
  const clampPitch = p => Math.max(-85 * DEG, Math.min(85 * DEG, p));
  const clampZ = z => Math.max(0.5, Math.min(1.12, z));
  // natural, eye-like view: about 72° across (narrower on tall phone screens), never wider than 80° even zoomed out — no fisheye
  const baseFov = () => Math.min(72, Math.max(50, 2 * Math.atan(Math.tan(36 * DEG) / (camera.aspect || 1.5)) / DEG));
  const curFov = () => Math.max(30, Math.min(80, baseFov() * zk));

  /* ---------- loop ---------- */
  const fwd = new THREE.Vector3(), v3 = new THREE.Vector3();
  function frame(t) {
    raf = 0; if (!alive) return;
    let more = false;
    if (!last && Math.abs(vel) > 0.00005) { yaw += vel; vel *= 0.92; more = true; }
    if (fading) {
      const k = Math.min(1, (t - fading.t0) / 650), e = k * k * (3 - 2 * k);
      setOpacity(fading.to, e); camera.fov = curFov() * (1 - 0.06 * Math.sin(e * Math.PI)); // a small step forward as the rooms swap
      if (k >= 1) { disposeCube(fading.from); fading.to.renderOrder = 0; fading = null; } else more = true;
    } else camera.fov = curFov();
    camera.rotation.set(pitch, yaw, 0); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    renderer.render(scene, camera);
    // floor markers
    camera.getWorldDirection(fwd);
    const w = cv.clientWidth, h = cv.clientHeight;
    for (const s of spots) {
      if (s.dir.dot(fwd) <= 0.15) { s.el.style.visibility = 'hidden'; continue; }
      v3.copy(s.dir).project(camera);
      const x = (v3.x + 1) / 2 * w, y = (1 - v3.y) / 2 * h, sc = Math.max(0.55, Math.min(1.25, 2.2 / Math.max(0.8, s.dist)));
      s.el.style.visibility = x < -60 || x > w + 60 || y < -60 || y > h + 60 ? 'hidden' : 'visible';
      s.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%) scale(${sc.toFixed(3)})`;
    }
    hooks.onFrame && hooks.onFrame(yaw);
    if (more) kick();
  }
  function kick() { if (!raf && alive) raf = requestAnimationFrame(frame); }
  function resize() { const w = el.clientWidth, h = el.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; kick(); }
  const ro = new ResizeObserver(resize); ro.observe(el); resize();

  return {
    show, preload, resize,
    get yaw() { return yaw; },
    zoom(f) { zk = clampZ(zk * f); kick(); },
    dispose() { alive = false; ro.disconnect(); if (cube) disposeCube(cube); renderer.dispose(); cv.remove(); marks.remove(); }
  };
}
