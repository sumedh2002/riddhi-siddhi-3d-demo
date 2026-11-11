const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
  p.on('pageerror', e => console.log('pageerror', e.message));
  await p.goto('file://' + __dirname + '/export.html', { waitUntil: 'load' }); await p.waitForTimeout(3500);
  const out = await p.evaluate(async () => {
    const v = window.__viewer, T = window.THREE; v.setAutoRotate(false);
    const info = { trees: [], palms: [], context: [], mats: {} };
    const greens = v.scene.children.find(c => c.isGroup && c.children.some(g => g.isGroup && g.children.some(m => m.geometry && m.geometry.type === 'IcosahedronGeometry')));
    for (const g of greens.children) {
      const P = g.position, cyl = g.children.find(m => m.geometry && m.geometry.type === 'CylinderGeometry');
      if (g.children.some(m => m.geometry && m.geometry.type === 'IcosahedronGeometry')) info.trees.push([P.x, -P.z, P.y, cyl.geometry.parameters.height / 2.4]);
      else if (g.children.some(m => m.geometry && m.geometry.type === 'PlaneGeometry')) info.palms.push([P.x, -P.z, P.y]);
    }
    greens.visible = false;
    v.scene.traverse(o => {
      if (!o.isMesh) return;
      if (o.userData.context) { const q = o.geometry.parameters; info.context.push([o.position.x, -o.position.z, q.width, q.depth, q.height]); o.visible = false; return; }
      const m = o.material; if (Array.isArray(m) || !m.color) return;
      m.name = 'm_' + m.color.getHexString() + (m.transparent ? '_t' : '') + (m.map ? '_map' : '');
      info.mats[m.name] = (info.mats[m.name] || 0) + 1;
    });
    const buf = await new Promise((res, rej) => new window.GLTFExporter().parse(v.scene, res, rej, { binary: true, onlyVisible: true }));
    let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768));
    return { glb: btoa(s), info };
  });
  fs.writeFileSync(__dirname + '/building.glb', Buffer.from(out.glb, 'base64')); fs.writeFileSync(__dirname + '/scene.json', JSON.stringify(out.info));
  console.log('glb', (fs.statSync(__dirname + '/building.glb').size / 1e6).toFixed(1) + 'MB', 'trees', out.info.trees.length, 'palms', out.info.palms.length, 'context', out.info.context.length);
  console.log(Object.entries(out.info.mats).map(([k, n]) => k + ':' + n).join(' '));
  await b.close();
})();
