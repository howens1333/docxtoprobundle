import packager from '@electron/packager';
import {readFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
const arch=process.argv[2]||process.arch;
if(!['arm64','x64'].includes(arch))throw new Error('Choose arm64 or x64');
const paths=await packager({dir:path.join(root,'.desktop-app'),out:path.join(root,'dist'),name:'Sermon Converter',platform:'darwin',arch,electronVersion:config.devDependencies.electron,icon:path.join(root,'desktop','icon.icns'),appBundleId:'com.natehowe.sermonconverter',appCategoryType:'public.app-category.productivity',appVersion:config.version,overwrite:true,prune:false,asar:false});
for(const folder of paths){
  const app=path.join(folder,'Sermon Converter.app');
  if(process.platform==='darwin'){
    // Local ad-hoc signature: no Apple developer account or certificate.
    execFileSync('codesign',['--force','--deep','--sign','-',app],{stdio:'inherit'});
    execFileSync('codesign',['--verify','--deep','--strict',app],{stdio:'inherit'});
    if(arch===process.arch)execFileSync(path.join(app,'Contents','MacOS','Sermon Converter'),['--smoke-test'],{stdio:'inherit',timeout:120000});
    const label=arch==='arm64'?'Apple-Silicon':'Intel';
    const zip=path.join(root,'dist',`Sermon-Converter-${label}.zip`);
    execFileSync('ditto',['-c','-k','--sequesterRsrc','--keepParent',app,zip],{stdio:'inherit'});
    console.log('DOWNLOAD:',zip);
  }else console.log('Cross-packaged unsigned app (macOS build required for ad-hoc signing):',app);
}
