import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
async function verify(){
const web=path.join(root,'.desktop-app','web');
const require=createRequire(import.meta.url);
const {loadPyodide}=require(path.join(web,'runtime','pyodide.js'));
// Any accidental attempt to download a runtime dependency fails this test.
globalThis.fetch=async(url)=>{throw new Error('Unexpected network access: '+url);};
const pyodide=await loadPyodide({indexURL:path.join(web,'runtime')+path.sep});
await pyodide.loadPackage(['lxml']);
const sitePackages=pyodide.runPython("import sysconfig; sysconfig.get_path('purelib')");
for(const name of JSON.parse(await readFile(path.join(web,'wheels.json'),'utf8'))){
  const bytes=await readFile(path.join(web,name));
  pyodide.unpackArchive(new Uint8Array(bytes),'zip',{extractDir:sitePackages});
}
const html=await readFile(path.join(web,'index.html'),'utf8');
const match=html.match(/const PY_SOURCES = (.*);\n/);
if(!match)throw new Error('Embedded converter modules missing');
for(const [name,source] of Object.entries(JSON.parse(match[1])))pyodide.FS.writeFile('/'+name,source);
pyodide.runPython("import sys, importlib; sys.path.insert(0, '/'); importlib.invalidate_caches()");
console.log(await pyodide.runPythonAsync(await readFile(path.join(root,'desktop','smoke.py'),'utf8')));
const output=pyodide.FS.readFile('/smoke-output.probundle');
await writeFile(path.join(root,'.desktop-app','smoke-output.probundle'),output);
console.log('OFFLINE_VERIFICATION_PASSED');

}
verify().catch(error=>{console.error(error.message);process.exitCode=1;});
