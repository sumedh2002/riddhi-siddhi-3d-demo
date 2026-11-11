const SRC = '/home/user/riddhi-siddhi-3d-demo/src';
const esbuild = require(SRC + '/node_modules/esbuild'), fs = require('fs'), path = require('path');
(async () => {
  const r = await esbuild.build({ stdin: { contents: "import * as THREE from 'three'; import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'; window.THREE = THREE; window.GLTFExporter = GLTFExporter; import './app.js';", resolveDir: SRC, loader: 'js' }, bundle: true, format: 'iife', write: false, target: ['es2020'], define: { __BUILD__: '"export"' } });
  let html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
  html = html.replace(/\{\{img:([a-z0-9_]+)\}\}/g, (m, n) => 'data:image/jpeg;base64,' + fs.readFileSync(path.join(SRC, 'img', n + '.jpg')).toString('base64'));
  html = html.replace('{{script}}', () => r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script'));
  fs.writeFileSync(__dirname + '/export.html', html); console.log('ok');
})();
