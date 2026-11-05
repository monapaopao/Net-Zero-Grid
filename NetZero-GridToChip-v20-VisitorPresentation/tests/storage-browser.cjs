'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),{spawn}=require('child_process');
const ROOT=path.join(__dirname,'..'),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
class CDP{
  constructor(ws){this.ws=ws;this.id=0;this.pending=new Map();this.errors=[];this.requests=[];ws.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id&&this.pending.has(message.id)){const job=this.pending.get(message.id);this.pending.delete(message.id);message.error?job.reject(message.error):job.resolve(message.result);}if(message.method==='Runtime.exceptionThrown')this.errors.push(message.params.exceptionDetails);if(message.method==='Log.entryAdded'&&message.params.entry.level==='error')this.errors.push(message.params.entry);if(message.method==='Network.requestWillBeSent')this.requests.push(message.params.request.url);});}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}));});}
  async eval(expression){const result=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;}
}
async function main(){
 const browser=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync),profile=fs.mkdtempSync(path.join(os.tmpdir(),'nz-v18-storage-'));
 const child=spawn(browser,['--headless=new','--remote-debugging-port=0','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-background-timer-throttling','--disable-renderer-backgrounding','--window-size=1920,1080','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
 let cdp;const report={checks:{},samples:[]},check=(n,v)=>{report.checks[n]=!!v;console.log((v?'PASS ':'FAIL ')+n);};
 try{
  const active=path.join(profile,'DevToolsActivePort');for(let i=0;i<150&&!fs.existsSync(active);i++)await sleep(200);const port=fs.readFileSync(active,'utf8').split('\n')[0],tabs=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json(),ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));cdp=new CDP(ws);for(const d of ['Runtime','Log','Network','Page'])await cdp.send(d+'.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});await cdp.send('Page.navigate',{url:'file:///'+path.join(ROOT,'dist/Net-Zero-grid-premium.html').replace(/\\/g,'/')});let ready=false;for(let i=0;i<200;i++){if(await cdp.eval('!!window.__NZ_TEST')){ready=true;break;}await sleep(150);}if(!ready)throw Error('Scene not ready '+JSON.stringify(cdp.errors));
  const shot=async n=>{const s=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(ROOT,'screenshots/v18-'+n+'.png'),Buffer.from(s.data,'base64'));};


  await cdp.eval('window.__NZ_TEST.S.running=false');await sleep(300);
  report.geometry=await cdp.eval('NZ_STORAGE.audit()');check('geometryAudit',report.geometry.passed&&report.geometry.batteries===12&&report.geometry.pcs===6&&report.geometry.stepup===3);
  check('capacityUnchanged',await cdp.eval('NZ_CONFIG.PLANT.storageMWh===300&&NZ_CONFIG.PLANT.storageMW===150'));
  await cdp.eval("(()=>{const a=window.__NZ_TEST;a.S.lightPreset='day-lab';a.focus('storage');a.cancelCamera();a.controls.enableDamping=false;a.camera.position.set(77,43,97);a.controls.target.set(35.5,1.8,39);a.controls.update();return true;})()");await sleep(900);
  await shot('storage-standard');
  check('visibleExpandedBounds',await cdp.eval("(()=>{const root=NZ_DETAIL.models.storage.root;root.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(root),s=b.getSize(new THREE.Vector3());return s.x>44&&s.z>26&&b.min.z>=25&&b.max.z<54;})()"));
  for(const q of ['compat','high']){await cdp.eval(`document.querySelector('[data-q=${q}]').click()`);await sleep(300);await shot('storage-'+q);}
  report.stats=await cdp.eval('window.__NZ_TEST.renderer.info.render');
  await cdp.eval("document.getElementById('detailExplode').click();window.__NZ_TEST.cancelCamera();window.__NZ_TEST.camera.position.set(56,17,72);window.__NZ_TEST.controls.target.set(35.5,2.8,46.5);window.__NZ_TEST.controls.update()");await sleep(900);await shot('storage-exploded');
  check('explodedRepresentativeOnly',await cdp.eval("NZ_DETAIL.models.storage.root.getObjectByName('Representative battery enclosure').position.y>4.9"));
  // Inspect the same subject at four times the normal overview scale.
  await cdp.eval("window.__NZ_TEST.camera.position.set(44.8,10.5,60.3);window.__NZ_TEST.controls.target.set(35.5,2.6,46.5);window.__NZ_TEST.controls.update()");await sleep(300);await shot('storage-4x');
  await cdp.eval("document.getElementById('detailExplode').click();window.__NZ_TEST.cancelCamera();window.__NZ_TEST.camera.position.set(77,43,97);window.__NZ_TEST.controls.target.set(35.5,1.8,39);window.__NZ_TEST.controls.update();window.__NZ_TEST.S.reduceMotion=true");await sleep(500);
  check('assembledRestored',await cdp.eval("NZ_DETAIL.models.storage.root.getObjectByName('Representative service doors').position.length()<.001"));
  await cdp.eval("window.__NZ_TEST.S.lightPreset='night'");await sleep(500);await shot('storage-night');
  await cdp.eval("window.__NZ_TEST.S.lightPreset='day-lab'");
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await cdp.eval('window.__NZ_TEST.closeInfo()');await sleep(400);await shot('storage-phone');
  check('phoneNoOverflow',await cdp.eval('document.documentElement.scrollWidth<=innerWidth'));
  check('existingDetailsRemain',await cdp.eval('!!NZ_DETAIL.models.ais&&!!NZ_DETAIL.models.dc&&!!NZ_DETAIL.models.wind'));
  check('noRuntimeErrors',cdp.errors.length===0);check('offline',!cdp.requests.some(u=>/^https?:/i.test(u)));report.errors=cdp.errors;
  fs.writeFileSync(path.join(ROOT,'evidence/v18-storage-browser.json'),JSON.stringify(report,null,2));if(Object.values(report.checks).some(v=>!v))process.exitCode=1;
 }finally{if(cdp)cdp.ws.close();child.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});

