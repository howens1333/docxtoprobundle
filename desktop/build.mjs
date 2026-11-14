import {packager} from '@electron/packager';
import {readFile,cp} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
const arch=process.argv[2]||process.arch;
if(!['arm64','x64','universal'].includes(arch))throw new Error('Choose universal, arm64 or x64');
const paths=await packager({dir:path.join(root,'.desktop-app'),out:path.join(root,'dist'),name:'Sermon Converter',platform:'darwin',arch,electronVersion:config.devDependencies.electron,icon:path.join(root,'desktop','icon.icns'),appBundleId:'com.natehowe.sermonconverter',appCategoryType:'public.app-category.productivity',appVersion:config.version,overwrite:true,prune:false,asar:false});
for(const folder of paths){
  const app=path.join(folder,'Sermon Converter.app');
  // Preserve Electron/Chromium attribution files inside the distributed app.
  for(const file of ['LICENSE','LICENSES.chromium.html']){
    await cp(path.join(folder,file),path.join(app,'Contents','Resources',file));
  }
  if(process.platform==='darwin'){
    // Local ad-hoc signature: no Apple developer account or certificate.
    execFileSync('codesign',['--force','--deep','--sign','-',app],{stdio:'inherit'});
    execFileSync('codesign',['--verify','--deep','--strict',app],{stdio:'inherit'});
    if(arch==='universal'){
      const archs=execFileSync('lipo',['-archs',path.join(app,'Contents','MacOS','Sermon Converter')],{encoding:'utf8'});
      if(!archs.includes('x86_64')||!archs.includes('arm64'))throw new Error('Universal app is missing a Mac architecture');
    }
    if(arch==='universal'||arch===process.arch)execFileSync(path.join(app,'Contents','MacOS','Sermon Converter'),['--smoke-test'],{stdio:'inherit',timeout:120000});
    const label=arch==='universal'?'Mac':arch==='arm64'?'Apple-Silicon':'Intel';
    const zip=path.join(root,'dist',`Sermon-Converter-${label}.zip`);
    execFileSync('ditto',['-c','-k','--sequesterRsrc','--keepParent',app,zip],{stdio:'inherit'});
    console.log('DOWNLOAD:',zip);
  }else console.log('Cross-packaged unsigned app (macOS build required for ad-hoc signing):',app);
}
