// Builds the two self-contained pages that GitHub Pages serves:
//   index.html  — builder website with the 3D explorer   (entry: app.js)
//   admin.html  — sales console                           (entry: admin.js)
// Each page gets its JS bundled with esbuild and images inlined as base64.
// Usage: node build.js [outputDir]   (default: the repository root, one level up)
const esbuild = require('esbuild'), fs = require('fs'), path = require('path');
const SRC = __dirname;
const OUT = path.resolve(process.argv[2] || path.join(SRC, '..'));
// Build stamp: added to links between the pages so browsers never reuse an out-of-date copy
const BUILD = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
if (OUT === SRC) throw new Error('Output folder must not be the src folder (it would overwrite the templates).');

async function page(entry, template) {
  const r = await esbuild.build({ entryPoints: [path.join(SRC, entry)], bundle: true, format: 'iife', minify: true, write: false, target: ['es2020'], legalComments: 'none', define: { __BUILD__: JSON.stringify(BUILD) } });
  const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  let html = fs.readFileSync(path.join(SRC, template), 'utf8');
  html = html.replace(/\{\{img:([a-z0-9_]+)\}\}/g, (m, n) => 'data:image/jpeg;base64,' + fs.readFileSync(path.join(SRC, 'img', n + '.jpg')).toString('base64'));
  html = html.replace('{{script}}', () => js);
  fs.writeFileSync(path.join(OUT, template), html);
  console.log(template.padEnd(11), 'js', (js.length / 1024).toFixed(0) + 'KB', 'html', (html.length / 1024).toFixed(0) + 'KB');
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await page('app.js', 'index.html');
  await page('admin.js', 'admin.html');
  // Premium photo views: copied as plain files next to the pages (loaded only when a visitor opens them)
  const pdir = path.join(SRC, 'premium');
  if (fs.existsSync(pdir)) { fs.cpSync(pdir, path.join(OUT, 'premium'), { recursive: true }); console.log('premium/   copied'); }
  console.log('->', OUT, 'build', BUILD);
})().catch(e => { console.error(e); process.exit(1); });
