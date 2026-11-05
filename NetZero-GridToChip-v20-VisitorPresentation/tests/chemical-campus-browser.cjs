'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict'),{spawn}=require('child_process');
const ROOT=path.join(__dirname,'..'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
class CDP{
  constructor(ws){this.ws=ws;this.id=0;this.pending=new Map();this.errors=[];ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&this.pending.has(m.id)){const p=this.pending.get(m.id);this.pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')this.errors.push(m.params.exceptionDetails);if(m.method==='Log.entryAdded'&&m.params.entry.level==='error')this.errors.push(m.params.entry);});}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}));});}
  async eval(expression){const r=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
}
async function main(){
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'nz-v15-')),browser=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
  const child=spawn(browser,['--headless=new','--remote-debugging-port=0','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-background-timer-throttling','--disable-renderer-backgrounding','--window-size=1920,1080','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
  let cdp;const report={checks:{},modes:{},views:[]};
  try{
    const active=path.join(profile,'DevToolsActivePort');for(let i=0;i<150&&!fs.existsSync(active);i++)await sleep(200);
    const port=fs.readFileSync(active,'utf8').split('\n')[0],targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json(),ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
    await new Promise(r=>ws.addEventListener('open',r,{once:true}));cdp=new CDP(ws);await cdp.send('Runtime.enable');await cdp.send('Log.enable');await cdp.send('Page.enable');await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
    const load=async version=>{
      await cdp.send('Page.navigate',{url:'file:///'+path.join(version,'dist/Net-Zero-grid-premium.html').replace(/\\/g,'/')});
      let ready=false;for(let i=0;i<140;i++){if(await cdp.eval('!!window.__NZ_TEST')){ready=true;break;}await sleep(200);}assert(ready,'application ready');
      await cdp.eval("(()=>{const a=window.__NZ_TEST;a.engine.reset({scenario:'surplus'});a.engine.advance(60);a.S.running=false;a.exitTour();a.cancelCamera();a.controls.enableDamping=false;a.S.lightPreset='day-lab';document.querySelector('[data-q=high]').click();document.querySelectorAll('#toast .tmsg').forEach(e=>e.remove());return true;})()");await sleep(1000);
    };
    const view=async(name,pos,tgt)=>{await cdp.eval('(()=>{const a=window.__NZ_TEST;a.cancelCamera();a.camera.position.set('+pos+');a.controls.target.set('+tgt+');a.controls.update();document.querySelectorAll("#toast .tmsg").forEach(e=>e.remove());return true;})()');await sleep(650);const s=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(ROOT,'screenshots/'+name+'.png'),Buffer.from(s.data,'base64'));report.views.push(name);};
    await load(ROOT);
    report.identity=await cdp.eval('({version:window.NZ_CONFIG.version,title:document.title})');
    report.geometry=await cdp.eval("(()=>{const a=window.__NZ_TEST;a.scene.updateMatrixWorld(true);return {chemical:window.NZ_CHEMICAL.audit(),flows:window.NZ_FLOWS.audit(),multi:window.NZ_MULTI.audit(),environment:window.NZ_ENVIRONMENT.audit(true),picks:DEVICES.map(d=>({key:d.key,p:d.p})),boxes:Object.fromEntries(['pem','h2tank','nh3','h2purify','nitrogen','nh3cycle','nh3cool','ammoniastock','ammoniaload'].map(key=>{const m=window.NZ_DETAIL.models[key],b=new THREE.Box3().setFromObject(m.root);return [key,{min:b.min.toArray(),max:b.max.toArray(),name:m.root.name}]}))};})()");
    const g=report.geometry,plan=require('../src/chemical-campus-plan.js'),site=g.multi.sites.chemical;
    report.checks.newVersion=report.identity.version==='15.0.0'&&report.identity.title.endsWith('v15');
    report.checks.noDuplicateDevices=g.chemical.deviceKeys.every(key=>g.picks.filter(d=>d.key===key).length===1);
    report.checks.legacyRemoved=g.chemical.legacyHidden;
    report.checks.withinChemicalCampus=Object.values(g.boxes).every(b=>b.min[0]>site.x0&&b.max[0]<site.x1&&b.min[2]>site.z0&&b.max[2]<site.z1);
    const intersects=(a,b)=>a.x0<b.x1-.01&&a.x1>b.x0+.01&&a.z0<b.z1-.01&&a.z1>b.z0+.01;
    const roads=g.environment.streets.filter(r=>r.zone==='chemical');
    report.conflicts=[];
    for(const [key,b]of Object.entries(g.boxes))for(const road of roads)if(intersects({x0:b.min[0],x1:b.max[0],z0:b.min[2],z1:b.max[2]},road))report.conflicts.push([key,road.name]);
    for(const reserve of plan.reserves)for(const road of roads)if(intersects(reserve,road))report.conflicts.push([reserve.key,road.name]);
    const rack={x0:plan.rack.x0-.5,x1:plan.rack.x1+.5,z0:plan.rack.z-2.5,z1:plan.rack.z+2.5};for(const road of roads)if(intersects(rack,road))report.conflicts.push(['rack',road.name]);
    report.checks.roadsClear=report.conflicts.length===0;
    report.checks.pathsMatchPorts=g.chemical.routes.every(r=>JSON.stringify(r.pts[0])===JSON.stringify(plan.ports[r.from])&&JSON.stringify(r.pts.at(-1))===JSON.stringify(plan.ports[r.to])&&r.pts.every(p=>p.length===3&&p.every(Number.isFinite)));
    report.checks.coolingOverlayAligned=['coolSupply','coolReturn'].every((key,i)=>JSON.stringify(g.flows.routes.find(r=>r.id===(i?'ammonia-cooling-return':'ammonia-cooling-supply')).pts)===JSON.stringify(plan.paths[key].pts));
    report.checks.noExtraAccounting=g.multi.facilities.length===require('../../NetZero-GridToChip-v14-TourPacing/src/multi-campus-plan.js').facilities.length&&g.chemical.boundaries.storage.includes('待配置')&&g.chemical.boundaries.auxiliaries.includes('配置');
    report.checks.rackColumnsClear=plan.rack.posts.every(x=>[plan.rack.z-2,plan.rack.z+2].every(z=>plan.rackExclusions.every(b=>!intersects({x0:x-.11,x1:x+.11,z0:z-.11,z1:z+.11},b))));
    await view('v15-chemical-overview',[338,170,-62],[200,2,-200]);
    await view('v15-hydrogen-detail',[270,72,-94],[216,3,-178]);
    await view('v15-process-north',[275,55,-254],[221,3,-180]);
    await view('v15-storage-loading',[321,36,-118],[269,2,-170]);
    await view('v15-chemical-top',[200,270,-199.99],[200,0,-200]);
    for(const quality of ['compat','standard','high']){
      await cdp.eval('document.querySelector(\'[data-q='+quality+']\').click()');await view('v15-chemical-'+quality,[270,72,-94],[216,3,-178]);
      report.modes[quality]=await cdp.eval('({quality:window.NZ_MULTI.audit().quality,chemical:window.NZ_CHEMICAL.audit(),postFailed:window.__NZ_TEST.post().failed,perf:window.__NZ_TEST.perf()})');
    }
    report.checks.allModes=Object.entries(report.modes).every(([q,v])=>v.quality===q&&!v.postFailed&&v.chemical.deviceKeys.length===9);
    await cdp.eval("window.__NZ_TEST.focus('ammoniastock')");await sleep(1200);
    report.checks.storageCard=await cdp.eval("document.getElementById('infoDesc').textContent.includes('压力容器')&&document.getElementById('infoTitle').textContent.includes('氨产品')");
    await cdp.eval("document.getElementById('infoClose').click();window.__NZ_TEST.focus('nh3cycle')");await sleep(1200);
    report.checks.cycleCard=await cdp.eval("document.getElementById('infoDesc').textContent.includes('循环返回')");
    await cdp.eval("document.querySelector('[data-chemical-view=cycle]').click()");await sleep(500);
    report.checks.manualProcessViews=await cdp.eval("!document.getElementById('chemicalProcessControls').hidden&&JSON.stringify(window.__NZ_TEST.controls.target.toArray())==='[222,4,-181]'");
    await cdp.eval("document.getElementById('infoClose').click();document.getElementById('showCampusFlows').click()");await view('v15-chemical-no-flows',[270,72,-94],[216,3,-178]);
    report.checks.physicalPipesIndependent=await cdp.eval("(()=>{const m=window.NZ_DETAIL.models.chemicalPipeRack;return !window.NZ_FLOWS.audit().global&&m.root.visible&&m.root.children.some(o=>o.isMesh)})()");
    await cdp.eval("document.getElementById('showCampusFlows').click();window.__NZ_TEST.S.lightPreset='night'");await view('v15-chemical-night',[270,72,-94],[216,3,-178]);
    await cdp.eval("window.__NZ_TEST.S.lightPreset='day-lab'");await view('v15-campus-overview',[650,600,660],[-90,8,-108]);
    report.scenarios={};for(const scenario of ['park','surplus','night','lowwind','smr'])report.scenarios[scenario]=await cdp.eval("(()=>{const a=window.__NZ_TEST;a.engine.reset({scenario:'"+scenario+"'});a.engine.advance(60);a.S.running=false;window.NZ_MULTI.update();return {ledgerResidual:a.S.lastResidualMW,campusResidual:window.NZ_MULTI.audit().totals.residual}})()");
    report.checks.ledgerBalanced=Object.values(report.scenarios).every(v=>Math.abs(v.ledgerResidual)<1e-6&&Math.abs(v.campusResidual)<1e-8);
    await load(path.join(ROOT,'../NetZero-GridToChip-v14-TourPacing'));await view('v14-before-chemical',[338,170,-62],[200,2,-200]);await view('v14-before-hydrogen',[270,72,-94],[216,3,-178]);
    report.errors=cdp.errors;report.checks.noRuntimeErrors=report.errors.length===0;
    fs.writeFileSync(path.join(ROOT,'evidence/v15-browser.json'),JSON.stringify(report,null,2));for(const [k,v]of Object.entries(report.checks))console.log((v?'PASS ':'FAIL ')+k);console.log('conflicts',JSON.stringify(report.conflicts));if(Object.values(report.checks).some(v=>!v))process.exitCode=1;
  }finally{if(cdp)cdp.ws.close();child.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
