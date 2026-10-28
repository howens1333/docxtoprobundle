// Run: node --test tests/test_template_storage.cjs
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {File} = require('node:buffer');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const code = html.slice(html.indexOf('// Keep large template blobs'), html.indexOf("wireDrop('dropTemplate'"));

// Async IndexedDB harness: writes become visible only when a transaction commits.
function storage(){
  const data = new Map();
  const options = {failWrites: false, readDelay: 0};
  const db = {
    objectStoreNames: {contains: () => true}, close(){},
    transaction(name, mode){
      const tx = {error: null};
      tx.objectStore = () => Object.fromEntries(['get','put','delete'].map(method => [method, (...args) => {
        const request = {};
        const snapshot = data.get('current-series');
        setTimeout(() => {
          if (mode === 'readwrite' && options.failWrites) {
            tx.error = new Error('QuotaExceededError'); tx.onabort?.(); return;
          }
          if (method === 'get') request.result = snapshot;
          if (method === 'put') data.set(args[1], args[0]);
          if (method === 'delete') data.delete(args[0]);
          tx.oncomplete?.();
        }, method === 'get' ? options.readDelay : 0);
        return request;
      }]));
      return tx;
    }
  };
  return {data,options,indexedDB:{open(){const request={result:db};setTimeout(()=>request.onsuccess(),0);return request;}}};
}
function app(store){
  const elements = new Map();
  const document = {getElementById(id){
    if (!elements.has(id)) elements.set(id,{textContent:'',classList:{toggle(){}}});
    return elements.get(id);
  }};
  const context = vm.createContext({Blob,File,Date,indexedDB:store.indexedDB,document});
  vm.runInContext('let templateFile=null; function setTemplateStatus(){} function updateRunButton(){}',context);
  vm.runInContext(code,context);
  return {context,run:s=>vm.runInContext(s,context)};
}

test('template blob and filename survive a new page context',async()=>{
  const db=storage();const first=app(db);
  await first.run("selectSeriesTemplate(new File(['gold artwork'], 'Gold.probundle', {lastModified:123}))");
  assert.match(first.run('templateStorageMessage'),/Saved in this browser/);
  const second=app(db);await second.run('restoreSeriesTemplate()');
  assert.equal(second.run('templateFile.name'),'Gold.probundle');
  assert.equal(await second.run('templateFile.text()'),'gold artwork');
  assert.equal(second.run('templateFile.lastModified'),123);
});
test('rapid replacements and removal persist the final selection',async()=>{
  const db=storage();const page=app(db);
  page.run("selectSeriesTemplate(new File(['old'], 'Old.probundle'))");
  page.run("selectSeriesTemplate(new File(['new'], 'New.probundle'))");
  await page.run('templateWriteQueue');
  assert.equal(db.data.get('current-series').name,'New.probundle');
  await page.run('selectSeriesTemplate(null)');
  const reloaded=app(db);await reloaded.run('restoreSeriesTemplate()');
  assert.equal(reloaded.run('templateFile'),null);
});
test('slow startup restore cannot overwrite a newly selected template',async()=>{
  const db=storage();const page=app(db);
  await page.run("selectSeriesTemplate(new File(['old'], 'Old.probundle'))");
  db.options.readDelay=40;
  const restored=app(db);const reading=restored.run('restoreSeriesTemplate()');
  await new Promise(r=>setTimeout(r,10));
  await restored.run("selectSeriesTemplate(new File(['new'], 'New.probundle'))");
  await reading;
  assert.equal(restored.run('templateFile.name'),'New.probundle');
});
test('failed save keeps current file usable and reports that it was not saved',async()=>{
  const db=storage();db.options.failWrites=true;const page=app(db);
  await page.run("selectSeriesTemplate(new File(['gold'], 'Gold.probundle'))");
  assert.equal(page.run('templateFile.name'),'Gold.probundle');
  assert.match(page.run('templateStorageMessage'),/could not save/i);
  assert.equal(db.data.size,0);
});
test('failed removal warns that saved copy may return',async()=>{
  const db=storage();const page=app(db);
  await page.run("selectSeriesTemplate(new File(['gold'], 'Gold.probundle'))");
  db.options.failWrites=true;await page.run('selectSeriesTemplate(null)');
  assert.equal(page.run('templateFile'),null);
  assert.match(page.run('templateStorageMessage'),/may return/);
});
