const esbuild=require('esbuild'),fs=require('fs');
(async()=>{
 const r=await esbuild.build({entryPoints:['app.js'],bundle:true,format:'iife',minify:true,write:false,target:['es2020'],legalComments:'none'});
 let js=r.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
 let html=fs.readFileSync('index.html','utf8');
 html=html.replace(/\{\{img:([a-z0-9_]+)\}\}/g,(m,n)=>'data:image/jpeg;base64,'+fs.readFileSync('img/'+n+'.jpg').toString('base64'));
 html=html.replace('{{script}}',()=>js);
 const out=process.argv[2]||'/home/user/riddhi-siddhi-3d-demo.html';
 fs.writeFileSync(out,html);
 console.log('js',(js.length/1024).toFixed(0)+'KB','html',(html.length/1024).toFixed(0)+'KB ->',out);
})().catch(e=>{console.error(e);process.exit(1);});
