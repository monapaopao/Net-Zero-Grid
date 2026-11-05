'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict'),{spawn}=require('child_process');
const ROOT=path.join(__dirname,'..'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
class CDP{
  constructor(ws){this.ws=ws;this.id=0;this.pending=new Map();this.errors=[];ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&this.pending.has(m.id)){const p=this.pending.get(m.id);this.pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')this.errors.push(m.params.exceptionDetails);if(m.method==='Log.entryAdded'&&m.params.entry.level==='error')this.errors.push(m.params.entry);});}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}));});}
  async eval(expression){const r=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
}
async function main(){
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'nz-v15-labels-')),browser=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
  const child=spawn(browser,['--headless=new','--remote-debugging-port=0','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-background-timer-throttling','--disable-renderer-backgrounding','--window-size=1920,1080','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
  let cdp;const report={checks:{},views:{}};
  try{
    const active=path.join(profile,'DevToolsActivePort');for(let i=0;i<150&&!fs.existsSync(active);i++)await sleep(200);
    const port=fs.readFileSync(active,'utf8').split('\n')[0],targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json(),ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
    await new Promise(r=>ws.addEventListener('open',r,{once:true}));cdp=new CDP(ws);await cdp.send('Runtime.enable');await cdp.send('Log.enable');await cdp.send('Page.enable');
    const size=async(width,height)=>{await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await sleep(400);};await size(1920,1080);
    await cdp.send('Page.navigate',{url:'file:///'+path.join(ROOT,'dist/Net-Zero-grid-premium.html').replace(/\\/g,'/')});
    for(let i=0;i<120;i++){if(await cdp.eval('!!window.__NZ_TEST'))break;await sleep(250);}
    await cdp.eval("(()=>{const a=window.__NZ_TEST;a.S.running=false;a.S.lightPreset='day-lab';a.cancelCamera();a.controls.enableDamping=false;document.querySelector('[data-q=high]').click();document.getElementById('toast').replaceChildren();return true})()");
    report.initial=await cdp.eval('({labels:window.NZ_CHEMICAL_LABELS.audit(),devices:DEVICES.length,edges:EDGES.length})');
    report.checks.overviewUncluttered=!report.initial.labels.active;
    await cdp.eval("document.querySelector('[data-group=hydrogen]').click()");await sleep(1600);
    await cdp.eval("document.querySelector('[data-chemical-view=process]').click()");await sleep(600);
    const get=()=>cdp.eval('window.NZ_CHEMICAL_LABELS.audit()');
    const shot=async name=>{const s=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(ROOT,'screenshots/v15-labels-'+name+'.png'),Buffer.from(s.data,'base64'));report.views[name]=await get();};
    await shot('process-1920');
    const first=report.views['process-1920'];report.checks.allKeyLabels=first.active&&first.labels.length===17&&first.placed.length===17;
    const overlap=(a,b)=>a.x<b.x+b.w-1&&a.x+a.w>b.x+1&&a.y<b.y+b.h-1&&a.y+a.h>b.y+1;
    const clear=a=>a.placed.every((p,i)=>p.x>=0&&p.y>=0&&p.x+p.w<=a.frame.width&&p.y+p.h<=a.frame.height&&!a.placed.some((q,j)=>j!==i&&overlap(p,q))&&!a.frame.blocked.some(q=>overlap(p,q)));
    report.checks.labelsDoNotOverlap=clear(first);
    report.checks.ownersExist=await cdp.eval('window.NZ_CHEMICAL_LABELS.audit().labels.every(t=>INFO[t.owner]&&DEVICES.some(d=>d.key===t.owner))');
    report.checks.legacyDuplicatesHidden=await cdp.eval("window.NZ_CHEMICAL_LABELS.audit().labels.every(t=>LABELS3D[t.owner].el.classList.contains('layer-hidden'))");
    for(const quality of ['compat','standard','high']){await cdp.eval('document.querySelector(\'[data-q='+quality+']\').click()');await sleep(350);report.views[quality]=await get();}report.checks.allQualityModes=Object.values(report.views).every(a=>a.active&&a.placed.length===17&&clear(a));
    await cdp.eval("document.querySelector('[data-process-tag=A06]').click()");await sleep(1300);
    report.checks.clickOpensCorrectCard=await cdp.eval("document.getElementById('infoTitle').textContent.includes('氨产品储运')");await shot('storage-card');
    await cdp.eval("document.querySelector('[data-chemical-view=process]').click();document.getElementById('btnChemicalLabels').click()");await sleep(400);report.checks.toggleOff=!(await get()).active;
    await cdp.eval("document.getElementById('btnChemicalLabels').click();document.getElementById('showCampusLabels').click()");await sleep(400);report.checks.globalSwitchHonored=!(await get()).active;
    await cdp.eval("document.getElementById('showCampusLabels').click()");await sleep(400);report.checks.globalSwitchRestores=(await get()).active;
    await size(1366,900);await shot('process-1366');report.checks.smallerViewport=clear(report.views['process-1366'])&&report.views['process-1366'].placed.length===17;
    await size(1920,1080);await cdp.eval("(()=>{const a=window.__NZ_TEST;a.cancelCamera();a.camera.position.set(200,240,-176.99);a.controls.target.set(210,0,-177);a.controls.update()})()");await sleep(500);await shot('top');report.checks.rotatedView=clear(report.views.top)&&report.views.top.placed.length===17;
    await cdp.eval("document.querySelector('[data-group=compute]').click()");await sleep(1600);report.checks.otherCampusUncluttered=!(await get()).active;
    report.checks.noNewSimulationDevices=await cdp.eval('DEVICES.length==='+report.initial.devices+'&&EDGES.length==='+report.initial.edges);
    report.checks.staticFacilityNamesAvailable=await cdp.eval("window.NZ_MULTI_PLAN.facilities.every(f=>LABELS3D[f.key].lv.textContent&&LABELS3D[f.key].lv.textContent!=='–')");
    report.errors=cdp.errors;report.checks.noRuntimeErrors=report.errors.length===0;
    fs.writeFileSync(path.join(ROOT,'evidence/v15-process-labels.json'),JSON.stringify(report,null,2));for(const [k,v]of Object.entries(report.checks))console.log((v?'PASS ':'FAIL ')+k);console.log('views',Object.fromEntries(Object.entries(report.views).map(([k,v])=>[k,v.placed.length])));if(Object.values(report.checks).some(v=>!v))process.exitCode=1;
  }finally{if(cdp)cdp.ws.close();child.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
