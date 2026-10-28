const {app,BrowserWindow,Menu,protocol,net,session,dialog}=require('electron');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const fs=require('node:fs/promises');
const webRoot=path.join(__dirname,'web');
const home='sermon://app/index.html';
const smoke=process.argv.includes('--smoke-test');
app.setName('Sermon Converter');
protocol.registerSchemesAsPrivileged([{scheme:'sermon',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true}}]);
let mainWindow;
async function createWindow(){
  mainWindow=new BrowserWindow({width:900,height:900,minWidth:430,minHeight:600,title:'Sermon Converter',show:!smoke,backgroundColor:'#f7f8fc',webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,spellcheck:false}});
  mainWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  mainWindow.webContents.on('will-navigate',(event,url)=>{if(url!==home)event.preventDefault();});
  await mainWindow.loadURL(home);
  if(smoke){
    try{
      const source=await fs.readFile(path.join(__dirname,'smoke.py'),'utf8');
      const result=await mainWindow.webContents.executeJavaScript(`(async()=>{const p=await ensurePyodide();return p.runPythonAsync(${JSON.stringify(source)})})()`);
      console.log('OFFLINE_SMOKE_OK',result);
      app.exit(0);
    }catch(error){console.error(error);app.exit(1);}
  }
}
app.whenReady().then(async()=>{
  protocol.handle('sermon',request=>{
    try{
      const url=new URL(request.url);
      if(url.hostname!=='app'||!['GET','HEAD'].includes(request.method))return new Response('Not found',{status:404});
      const target=path.resolve(webRoot,'.'+decodeURIComponent(url.pathname));
      if(!target.startsWith(webRoot+path.sep))return new Response('Not found',{status:404});
      return net.fetch(pathToFileURL(target).href);
    }catch{return new Response('Not found',{status:404});}
  });
  // The packaged app never needs to contact an external server.
  session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(_details,callback)=>callback({cancel:true}));
  session.defaultSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  session.defaultSession.on('will-download',(_event,item)=>{
    item.setSaveDialogOptions({title:'Save ProPresenter Bundle',defaultPath:path.join(app.getPath('downloads'),path.basename(item.getFilename())),filters:[{name:'ProPresenter Bundle',extensions:['probundle']}]});
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {label:app.name,submenu:[{role:'about'},{type:'separator'},{role:'hide'},{role:'hideOthers'},{role:'unhide'},{type:'separator'},{role:'quit'}]},
    {label:'File',submenu:[{role:'close'}]},
    {label:'Edit',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},
    {label:'View',submenu:[{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{role:'togglefullscreen'}]},
    {role:'windowMenu'}
  ]));
  await createWindow();
  app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
}).catch(error=>{if(!smoke)dialog.showErrorBox('Sermon Converter',error.message);console.error(error);app.exit(1);});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
