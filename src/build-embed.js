// Builds the widget on its own page, for embedding (the Arch3 website's Playground uses it in an iframe).
//   node src/build-embed.js <outDir> [fontsUrl]
// Writes <outDir>/index.html (widget only), <outDir>/embed.js (bundle, external so a strict CSP works)
// and copies the Premium photos to <outDir>/premium/.
// The widget's CSS and markup are taken from index.html, so the embed always matches the live widget.
const esbuild = require('esbuild'), fs = require('fs'), path = require('path');
const SRC = __dirname, OUT = path.resolve(process.argv[2] || ''), FONTS = process.argv[3] || '../assets/fonts/';
if (!process.argv[2]) throw new Error('usage: node src/build-embed.js <outDir> [fontsUrl]');
const BUILD = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);

(async () => {
  const page = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
  const cssStart = page.indexOf('/* ===== 3D VIEWER (embeddable widget) ====='), cssEnd = page.indexOf('/* homes */');
  const mStart = page.indexOf('<div id="viewer"'), mEnd = page.indexOf('\n  </div>\n</section>', mStart);
  if (cssStart < 0 || cssEnd < cssStart || mStart < 0 || mEnd < mStart) throw new Error('widget markers not found in index.html');
  const css = page.slice(cssStart, cssEnd), markup = page.slice(mStart, mEnd).replace(/\n    /g, '\n');
  const r = await esbuild.build({ entryPoints: [path.join(SRC, 'app.js')], bundle: true, format: 'iife', minify: true, write: false, target: ['es2020'], legalComments: 'none', define: { __BUILD__: JSON.stringify(BUILD) } });
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'embed.js'), r.outputFiles[0].text);
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex">
<title>Arch3 3D explorer · Riddhi Siddhi Apartment (demo)</title>
<style>
@font-face{font-family:"Geist";src:url(${FONTS}geist-latin-wght-normal.woff2) format("woff2");font-weight:100 900;font-display:swap}
@font-face{font-family:"Geist Mono";src:url(${FONTS}geist-mono-latin-wght-normal.woff2) format("woff2");font-weight:100 900;font-display:swap}
*,*::before,*::after{box-sizing:border-box}
[hidden]{display:none!important}
html,body{margin:0;height:100%;background:#EDEFF2}
body{-webkit-font-smoothing:antialiased}
${css}
/* embed: the widget fills the frame */
#viewer{--w-h:100vh;--w-h:100dvh;border:0;border-radius:0;box-shadow:none;min-height:100%}
</style>
</head>
<body>
${markup}
<script src="embed.js?v=${BUILD}" defer></script>
</body>
</html>
`;
  fs.writeFileSync(path.join(OUT, 'index.html'), html);
  const pdir = path.join(SRC, 'premium');
  if (fs.existsSync(pdir)) fs.cpSync(pdir, path.join(OUT, 'premium'), { recursive: true });
  console.log('embed ->', OUT, (r.outputFiles[0].text.length / 1024).toFixed(0) + 'KB js', 'build', BUILD);
})().catch(e => { console.error(e); process.exit(1); });
