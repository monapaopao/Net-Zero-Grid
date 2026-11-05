'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),{spawn}=require('child_process');
const ROOT=path.join(__dirname,'..'),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
class CDP{
  constructor(ws){this.ws=ws;this.id=0;this.pending=new Map();this.errors=[];this.requests=[];ws.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id&&this.pending.has(message.id)){const job=this.pending.get(message.id);this.pending.delete(message.id);message.error?job.reject(message.error):job.resolve(message.result);}if(message.method==='Runtime.exceptionThrown')this.errors.push(message.params.exceptionDetails);if(message.method==='Log.entryAdded'&&message.params.entry.level==='error')this.errors.push(message.params.entry);if(message.method==='Network.requestWillBeSent')this.requests.push(message.params.request.url);});}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}));});}
  async eval(expression){const result=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;}
}
async function main(){
 const browser=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync),profile=fs.mkdtempSync(path.join(os.tmpdir(),'nz-v17-tour-'));
 const child=spawn(browser,['--headless=new','--remote-debugging-port=0','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-background-timer-throttling','--disable-renderer-backgrounding','--window-size=1920,1080','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
 let cdp;const report={checks:{},samples:[]},check=(n,v)=>{report.checks[n]=!!v;console.log((v?'PASS ':'FAIL ')+n);};
 try{
  const active=path.join(profile,'DevToolsActivePort');for(let i=0;i<150&&!fs.existsSync(active);i++)await sleep(200);const port=fs.readFileSync(active,'utf8').split('\n')[0],tabs=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json(),ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));cdp=new CDP(ws);for(const d of ['Runtime','Log','Network','Page'])await cdp.send(d+'.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});await cdp.send('Page.navigate',{url:'file:///'+path.join(ROOT,'dist/Net-Zero-grid-premium.html').replace(/\\/g,'/')});let ready=false;for(let i=0;i<200;i++){if(await cdp.eval('!!window.__NZ_TEST')){ready=true;break;}await sleep(150);}if(!ready)throw Error('Scene not ready '+JSON.stringify(cdp.errors));
  const shot=async(name,clip)=>{const s=await cdp.send('Page.captureScreenshot',{format:'png',...(clip?{clip}: {})});fs.writeFileSync(path.join(ROOT,'screenshots/tower-'+name+'.png'),Buffer.from(s.data,'base64'));};
  await cdp.eval(`(()=>{const a=window.__NZ_TEST;a.S.running=false;a.S.lightPreset='day-lab';a.cancelCamera();a.controls.enableDamping=false;a.camera.position.set(105,34,8);a.controls.target.set(67,9,-35);a.controls.update();return true;})()`);await sleep(300);
  report.tower=await cdp.eval('window.NZ_TOWERS.audit()');
  check('fiveNativeSupports',report.tower.supports.length===5&&report.tower.parts.length>1000);
  check('instancedGeometry',report.tower.meshStats.draws<30&&report.tower.wireStats.draws===2);
  check('worldAnchorUnchanged',await cdp.eval("JSON.stringify(window.NZ_DETAIL.models.line.root.position.toArray())===JSON.stringify([67,0,-40.5])"));
  check('allNativeMatricesFinite',await cdp.eval(`(()=>{let ok=true;window.__NZ_TEST.scene.traverse(o=>{if(o.isInstancedMesh&&o.name.startsWith('Tower '))ok=ok&&Array.from(o.instanceMatrix.array).every(Number.isFinite);});return ok;})()`));
  check('powerRouteMatchesPhysicalConductor',await cdp.eval("JSON.stringify(window.NZ_INFRA.audit().routes.trans.slice(2))===JSON.stringify(window.NZ_TOWERS.data.path)"));
  check('noOldFourCircuitLabel',await cdp.eval("!document.getElementById('labels3d').textContent.includes('四回出线')"));
  await shot('standard-whole');
  for(const q of ['compat','standard','high']){
   await cdp.eval(`document.querySelector('#segQuality [data-q="${q}"]').click()`);await sleep(180);
   const a=await cdp.eval('window.NZ_TOWERS.audit().tiers');check('quality-'+q,a.compat&&a.standard===(q!=='compat')&&a.high===(q==='high'));
  }
  await cdp.eval("window.__NZ_TEST.camera.position.set(91,20,-19);window.__NZ_TEST.controls.target.set(78,12.7,-40.5);window.__NZ_TEST.controls.update()");await sleep(250);await shot('head-high');
  // 4x camera close-up and pixel capture of insulator ends, crossarm and line clamps.
  await cdp.eval("window.__NZ_TEST.camera.position.set(83.5,16,-30);window.__NZ_TEST.controls.target.set(78,13.6,-40.5);window.__NZ_TEST.controls.update()");await sleep(250);await shot('junction-4x',{x:650,y:300,width:550,height:300,scale:4});
  await cdp.eval("window.__NZ_TEST.camera.position.set(84,5,-31);window.__NZ_TEST.controls.target.set(78,2.6,-40.5);window.__NZ_TEST.controls.update()");await sleep(200);await shot('footing-ladder');
  await cdp.eval("window.__NZ_TEST.camera.position.set(68,20,-55);window.__NZ_TEST.controls.target.set(67,12.7,-40.5);window.__NZ_TEST.controls.update()");await sleep(200);await shot('rear-connections');
  await cdp.eval("window.__NZ_TEST.S.lightPreset='night'");await sleep(300);await shot('night-connections');
  // Turning visualization off must leave the actual structures and conductors intact.
  await cdp.eval("(()=>{const e=document.getElementById('showCampusFlows');e.checked=false;e.dispatchEvent(new Event('change'));return true;})()");await sleep(150);
  check('physicalWireSurvivesFlowToggle',await cdp.eval("window.__NZ_TEST.scene.getObjectByName('Physical connection trans').visible&&window.NZ_DETAIL.models.line.root.visible"));
  await cdp.eval("window.__NZ_TEST.S.reduceMotion=true;window.__NZ_TEST.S.lightPreset='day-lab';window.__NZ_TEST.camera.position.set(105,34,8);window.__NZ_TEST.controls.target.set(67,9,-35);window.__NZ_TEST.controls.update()");await sleep(150);check('reducedMotionKeepsStructure',await cdp.eval('window.NZ_TOWERS.audit().tiers.compat'));
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await sleep(300);await shot('phone');
  check('phoneHasUsableCanvas',await cdp.eval("document.getElementById('gridCanvas').clientHeight>300&&document.documentElement.scrollWidth<=innerWidth"));
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
  await cdp.eval("(()=>{const a=window.__NZ_TEST;a.S.reduceMotion=false;a.startTour();a.toggleTourPause();a.tourJump(2);a.tourSeek(a.TOUR[2].segments.find(s=>s.id==='line-weather').start+1);return true;})()");await sleep(200);
  check('tourActuallyFramesUpgradedTowers',await cdp.eval("JSON.stringify(window.__NZ_TEST.controls.target.toArray())===JSON.stringify([67,9,-35])&&document.getElementById('tourBar').dataset.cue==='line-weather'"));await shot('tour-line');
  check('existingTourLengthPreserved',await cdp.eval('window.__NZ_TEST.NARRATION.totalSeconds===390'));
  await cdp.eval('window.__NZ_TEST.exitTour()');await sleep(200);report.perf=await cdp.eval('window.__NZ_TEST.perf()');
  check('noRuntimeErrors',cdp.errors.length===0);check('noExternalRequests',!cdp.requests.some(u=>/^https?:/i.test(u)));report.errors=cdp.errors;
  fs.writeFileSync(path.join(ROOT,'evidence/v17-tower-browser.json'),JSON.stringify(report,null,2));if(Object.values(report.checks).some(v=>!v))process.exitCode=1;
 }finally{if(cdp)cdp.ws.close();child.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
