import {mkdir, readFile, writeFile, cp, rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app=path.join(root,'.desktop-app');
const web=path.join(app,'web');
const runtime=path.join(web,'runtime');
const cdn='https://cdn.jsdelivr.net/pyodide/v0.26.1/full/';
async function download(url,dest,sha){
  const response=await fetch(url,{signal:AbortSignal.timeout(120000)});
  if(!response.ok)throw new Error(`Download failed: ${response.status} ${url}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(sha&&createHash('sha256').update(bytes).digest('hex')!==sha)throw new Error(`Checksum failed: ${url}`);
  await writeFile(dest,bytes);
}
await rm(app,{recursive:true,force:true});
await mkdir(runtime,{recursive:true});
for(const name of ['pyodide.js','pyodide.asm.js','pyodide.asm.wasm','python_stdlib.zip','pyodide-lock.json']){
  await cp(path.join(root,'node_modules','pyodide',name),path.join(runtime,name));
}
const lock=JSON.parse(await readFile(path.join(runtime,'pyodide-lock.json'),'utf8'));
const downloaded=new Set();
async function vendorPackage(name){
  if(downloaded.has(name))return;
  const pkg=lock.packages[name];
  if(!pkg)throw new Error(`Unknown Pyodide package ${name}`);
  downloaded.add(name);
  await Promise.all(pkg.depends.map(vendorPackage));
  await download(cdn+pkg.file_name,path.join(runtime,pkg.file_name),pkg.sha256);
}
await vendorPackage('lxml');
await mkdir(path.join(web,'wheels'),{recursive:true});
const wheels=[];
for(const [name,version] of [['python-docx','1.1.2'],['typing_extensions','4.12.2']]){
  const response=await fetch(`https://pypi.org/pypi/${name}/${version}/json`);
  if(!response.ok)throw new Error(`Could not locate ${name}`);
  const metadata=await response.json();
  const wheel=metadata.urls.find(x=>x.filename.endsWith('-py3-none-any.whl'));
  if(!wheel)throw new Error(`No pure Python wheel for ${name}`);
  await download(wheel.url,path.join(web,'wheels',wheel.filename),wheel.digests.sha256);
  wheels.push('wheels/'+wheel.filename);
}
let html=await readFile(path.join(root,'index.html'),'utf8');
const remoteScript='https://cdn.jsdelivr.net/pyodide/v0.26.1/full/pyodide.js';
if(!html.includes(remoteScript))throw new Error('Web runtime changed; update desktop preparation');
html=html.replace(remoteScript,'runtime/pyodide.js');
const original=`    const pyodide = await loadPyodide();\n\n    setProgress(1);\n    await pyodide.loadPackage(['micropip']);\n    const micropip = pyodide.pyimport('micropip');\n    await micropip.install('python-docx');`;
if(!html.includes(original))throw new Error('Web initialization changed; update desktop preparation');
html=html.replace(original,`    const pyodide = await loadPyodide({indexURL:new URL('runtime/',location.href).href});
    setProgress(1);
    await pyodide.loadPackage(['lxml']);
    const sitePackages = pyodide.runPython("import sysconfig; sysconfig.get_path('purelib')");
    for (const wheelPath of ${JSON.stringify(wheels)}) {
      const response = await fetch(new URL(wheelPath, location.href));
      if (!response.ok) throw new Error('Bundled conversion tools could not be loaded.');
      pyodide.unpackArchive(await response.arrayBuffer(), 'zip', {extractDir:sitePackages});
    }
    pyodide.runPython('import importlib; importlib.invalidate_caches()');`);
html=html.replace('<head>',`<head>\n<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'none'">`);
await writeFile(path.join(web,'index.html'),html);
await writeFile(path.join(web,'wheels.json'),JSON.stringify(wheels));
await cp(path.join(root,'desktop','main.cjs'),path.join(app,'main.cjs'));
await cp(path.join(root,'desktop','smoke.py'),path.join(app,'smoke.py'));
const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
await writeFile(path.join(app,'package.json'),JSON.stringify({name:'sermon-converter',productName:'Sermon Converter',version:pkg.version,main:'main.cjs',description:'Offline ProPresenter sermon converter',author:'Nate Howe'},null,2));
await download('https://raw.githubusercontent.com/pyodide/pyodide/0.26.1/LICENSE',path.join(app,'PYODIDE-LICENSE'));
await download(`https://raw.githubusercontent.com/python/cpython/v${lock.info.python}/LICENSE`,path.join(app,'PYTHON-LICENSE'));
console.log('Offline app assets prepared.');
