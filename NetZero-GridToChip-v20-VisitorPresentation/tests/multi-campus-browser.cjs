'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),{spawn}=require('child_process');
const ROOT=path.join(__dirname,'..'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
class CDP{
 constructor(ws){this.ws=ws;this.id=0;this.pending=new Map();this.errors=[];ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&this.pending.has(m.id)){const p=this.pending.get(m.id);this.pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')this.errors.push(m.params.exceptionDetails);if(m.method==='Log.entryAdded'&&m.params.entry.level==='error')this.errors.push(m.params.entry);});}
 send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}));});}
 async eval(expression){const r=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
}
async function main(){
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'nz-v10-')),browser=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
 const child=spawn(browser,['--headless=new','--remote-debugging-port=0','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-background-timer-throttling','--disable-renderer-backgrounding','--window-size=1600,1000','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
 let cdp;const report={checks:{},views:{},modes:{}};
 try{
  const active=path.join(profile,'DevToolsActivePort');for(let i=0;i<150&&!fs.existsSync(active);i++)await sleep(200);
  const port=fs.readFileSync(active,'utf8').split('\n')[0],targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json(),ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise(r=>ws.addEventListener('open',r,{once:true}));cdp=new CDP(ws);await cdp.send('Runtime.enable');await cdp.send('Log.enable');await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});
  const url='file:///'+path.join(ROOT,'dist/Net-Zero-grid-premium.html').replace(/\\/g,'/');
  await cdp.send('Page.navigate',{url});for(let i=0;i<120;i++){if(await cdp.eval('!!window.__NZ_TEST'))break;await sleep(250);}
  await cdp.eval("(()=>{const a=window.__NZ_TEST;a.S.running=false;a.exitTour();a.cancelCamera();a.controls.enableDamping=false;a.S.lightPreset='day-lab';return true;})()");await sleep(3500);
  const view=async(pos,tgt)=>{await cdp.eval('(()=>{const a=window.__NZ_TEST;a.cancelCamera();a.camera.position.set('+pos+');a.controls.target.set('+tgt+');a.controls.update();return true;})()');await sleep(450);};
  const shot=async name=>{await cdp.eval("document.getElementById('toast').replaceChildren()");const s=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(ROOT,'screenshots/v10-'+name+'.png'),Buffer.from(s.data,'base64'));};
  report.identity=await cdp.eval("({title:document.title,heading:document.querySelector('#campusNav h1').textContent,org:document.querySelector('.brand').innerText,logo:document.getElementById('brandLogo').src.startsWith('data:image/svg+xml;base64,'),loaded:document.getElementById('brandLogo').naturalWidth,brand:window.NZ_BRAND})");
  report.checks.identityUpdated=report.identity.title.includes('多园区共享综合能源系统')&&report.identity.org.includes('西比里 能源')&&report.identity.org.includes('xibili energy')&&report.identity.logo&&report.identity.loaded>0&&report.identity.brand.applied>=2;
  report.geometry=await cdp.eval("(()=>{const a=window.__NZ_TEST;a.scene.updateMatrixWorld(true);const models=window.NZ_DETAIL.models;return {positions:Object.fromEntries(Object.entries(models).map(([k,m])=>[k,m.root.position.toArray()])),multi:window.NZ_MULTI.audit(),env:window.NZ_ENVIRONMENT.audit(true),landscape:window.NZ_RENEWABLES.audit(),solar:window.NZ_SOLAR.audit(),retiredFence:a.scene.children.filter(o=>o.userData.retiredCampusFence).length,picks:DEVICES.map(d=>({key:d.key,p:d.p,r:d.r})),bounds:Object.fromEntries(['Continuous western hills','Continuous terrain plinth'].map(n=>{const b=new THREE.Box3().setFromObject(a.scene.getObjectByName(n));return [n,{min:b.min.toArray(),max:b.max.toArray()}];}))};})()");
  const g=report.geometry,p=g.positions;
  report.checks.migrationComplete=p.smr[0]===280&&p.smr[2]===-355&&p.metal[0]===145&&p.metal[2]===-225&&p.pem[0]===181&&p.pem[2]===-174&&p.factory[0]===280&&p.factory[2]===87&&g.retiredFence===0;
  report.checks.allModeGeometry=g.multi.facilities.length===31&&g.landscape.pvPanels>1800;
  const overlap=(a,b)=>a.x0<b.x1-.02&&a.x1>b.x0+.02&&a.z0<b.z1-.02&&a.z1>b.z0+.02;
  report.conflicts=[];for(const f of g.multi.facilities){for(const b of g.env.protectedAreas){if(b.key===f.key||b.key.startsWith('v9 utility ')||(f.key==='parking'&&b.key==='visitorParking'))continue;if(overlap(f,b))report.conflicts.push([f.key,b.key]);}for(const r of g.env.streets)if(overlap(f,r))report.conflicts.push([f.key,r.name]);}
  report.checks.newFacilitiesClear=report.conflicts.length===0;
  report.checks.separateCampuses=g.multi.sites.nuclear.z1<g.multi.sites.chemical.z0-40&&g.multi.sites.factory.x0>g.multi.sites.compute.x1+20;
  const b=g.bounds;report.checks.continuousBoundary=[0,2].every(k=>Math.abs(b['Continuous western hills'].min[k]-b['Continuous terrain plinth'].min[k])<.001&&Math.abs(b['Continuous western hills'].max[k]-b['Continuous terrain plinth'].max[k])<.001);
  report.checks.solarPreserved=g.solar.physicalConflicts.length===0&&g.solar.plan.conflicts.length===0&&g.solar.plan.equipmentConflicts.length===0;
  for(const scenario of ['park','surplus','night','lowwind','smr']){
    report.views[scenario]=await cdp.eval("(()=>{const a=window.__NZ_TEST;a.engine.reset({scenario:'"+scenario+"'});a.engine.advance(60);a.S.running=false;window.NZ_MULTI.update();return {totals:window.NZ_MULTI.audit().totals,residual:a.S.lastResidualMW,unserved:a.S.unservedMW,pue:a.S.pue};})()");
  }
  report.checks.uniqueNewPicks=g.multi.facilities.every(f=>g.picks.filter(d=>d.key===f.key).length===1);
  report.checks.perCampusTotals=Object.values(report.views).every(v=>Math.abs(v.totals.residual)<1e-8&&Math.abs(v.residual)<1e-6);
  await cdp.eval("window.__NZ_TEST.engine.reset({scenario:'park'});window.__NZ_TEST.engine.advance(60);window.__NZ_TEST.S.running=false;window.NZ_MULTI.update();document.querySelectorAll('#toast .tmsg').forEach(e=>e.remove());");
  for(const q of ['compat','standard','high']){
   await cdp.eval('document.querySelector(\'[data-q="'+q+'"]\').click()');await view([300,245,365],[165,0,20]);await shot(q+'-campuses');
   report.modes[q]=await cdp.eval('({quality:window.NZ_MULTI.audit().quality,postFailed:window.__NZ_TEST.post().failed,env:window.NZ_ENVIRONMENT.audit(),perf:window.__NZ_TEST.perf()})');
  }
  report.checks.qualityModes=Object.entries(report.modes).every(([q,m])=>m.quality===q&&!m.postFailed);
  for(const [name,pos,tgt]of [['overview',[650,600,660],[-90,8,-108]],['top',[-70,1300,-107.99],[-70,0,-108]],['chemical',[338,170,-62],[200,2,-200]],['nuclear',[383,120,-221],[280,5,-355]],['compute',[270,155,230],[150,2,55]],['factory',[380,110,195],[280,3,87]],['energy',[142,120,139],[35,2,8]],['charging',[113,76,179],[55,1,113]],['solar',[-38,280,420],[-305,1,99]]]){await view(pos,tgt);await shot(name);}
  report.focus={};for(const key of ['metal','panamaZn','pem','h2tank','nh3','fc','factory','smr','cooling','ups','noc','phase2']){
   await cdp.eval('window.__NZ_TEST.focus("'+key+'")');await sleep(1100);report.focus[key]=await cdp.eval('({target:window.__NZ_TEST.controls.target.toArray(),title:document.getElementById("infoTitle").textContent})');
  }
  report.checks.focusMigrated=report.focus.metal.target[2]<-200&&report.focus.nh3.target[2]<-150&&report.focus.smr.target[2]<-300&&report.focus.factory.target[0]>250&&report.focus.cooling.title==='闭式冷站与液冷换热';
  await cdp.eval('window.__NZ_TEST.focus("metal");document.querySelector(\'[data-zinc-view="cells"]\').click()');await sleep(500);
  report.checks.zincCutaway=await cdp.eval("window.__NZ_TEST.controls.target.z===-225&&window.NZ_LAYOUT.mode()==='cells'");await shot('zinc-cutaway');
  await cdp.eval('window.__NZ_TEST.focus("smr");document.getElementById("infraWide").click()');await sleep(500);
  report.checks.nuclearWide=await cdp.eval('window.__NZ_TEST.controls.target.z===-220');
  await cdp.eval('window.__NZ_TEST.startTour();window.__NZ_TEST.tourJump(5);window.__NZ_TEST.toggleTourPause()');await sleep(500);
  report.checks.tourMigrated=await cdp.eval("document.getElementById('tourTitle').textContent.includes('SMR')");await cdp.eval('window.__NZ_TEST.exitTour();document.getElementById("infoClose").click();window.NZ_LAYOUT.selection(null)');
  await cdp.eval("document.querySelectorAll('#toast .tmsg').forEach(e=>e.remove())");await view([300,245,365],[165,0,20]);await cdp.eval("window.__NZ_TEST.S.lightPreset='night'");await sleep(700);await shot('night');await view([113,76,179],[55,1,113]);await shot('charging-night');
  report.checks.nightCoverage=await cdp.eval("(()=>{const a=window.NZ_ENVIRONMENT.audit();return ['chemical','nuclear','factory','compute','public'].every(k=>a.coverage[k]&&a.coverage[k].lamps>0)})()");
  await cdp.eval("window.__NZ_TEST.S.lightPreset='day-lab';window.__NZ_TEST.focus('solar');document.getElementById('solarCheckToggle').click()");await sleep(1300);
  report.checks.solarCheck=await cdp.eval('window.NZ_SOLAR.audit().enabled&&window.NZ_SOLAR.audit().diagnostic.blocked.every(Number.isFinite)');await cdp.eval('document.getElementById("solarCheckToggle").click();document.getElementById("infoClose").click()');
  report.checks.chargingCapacity=await cdp.eval("(()=>{const a=window.NZ_MULTI.audit().charging,P=window.NZ_CONFIG.PLANT;return a.rows===2&&a.terminals===P.scGuns&&Math.abs(a.capacityMW-P.scGuns*P.scGunMW)<1e-8&&DEVICES.filter(d=>d.key==='panamaSc2').length===1&&INFO.supercharge.t==='新能源超充站'})()");
  await cdp.eval("window.__NZ_TEST.focus('panamaSc2')");await sleep(1100);await cdp.eval("document.getElementById('detailExplode').click()");await sleep(700);await shot('charging-dc-cutaway');
  report.checks.secondDcCutaway=await cdp.eval("document.getElementById('detailExplode').textContent==='装配复位'");
  await cdp.eval("document.getElementById('infoClose').click();window.GOBI_DCDT.open()");await sleep(3200);
  for(let i=0;i<40;i++){if(await cdp.eval("!!document.getElementById('dcdtFrame').contentWindow.NZ_BUILDING_REVIEW"))break;await sleep(250);}
  report.building=await cdp.eval("(()=>{const a=window.__NZ_TEST;const w=document.getElementById('dcdtFrame').contentWindow;return {...w.NZ_BUILDING_REVIEW.audit(),ledger:window.GOBI_DCDT.ledger?window.GOBI_DCDT.ledger():null,sliderMin:w.document.getElementById('load').min,sliderDisabled:w.document.getElementById('load').disabled,innerText:w.document.getElementById('notes').textContent}})()");
  report.checks.buildingSystems=report.building.devices.filter(d=>d.type==='cdu').length===3&&!report.building.devices.some(d=>d.id.startsWith('Diesel')||d.id.startsWith('Chiller'))&&report.building.devices.some(d=>d.id==='BatteryInterface');
  report.checks.buildingSample=report.building.sliderDisabled&&Math.abs(report.building.sampleKW-1440*report.building.load/100)<1e-8&&report.building.innerText.includes('代表性机房');
  await cdp.eval("document.getElementById('dcdtFrame').contentWindow.NZ_BUILDING_REVIEW.system('cooling')");await sleep(600);await shot('building-cooling');
  await cdp.eval("window.__NZ_TEST.S.itMW=50;window.GOBI_DCDT.resyncLoad()");await sleep(400);
  report.checks.buildingLowLoad=await cdp.eval("Math.abs(document.getElementById('dcdtFrame').contentWindow.NZ_BUILDING_REVIEW.audit().load-16.7)<.01");
  await cdp.eval("window.GOBI_DCDT.close();window.__NZ_TEST.engine.reset({scenario:'park'});window.__NZ_TEST.S.running=false");await sleep(700);
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await sleep(700);await shot('mobile');
  report.checks.mobileIdentity=await cdp.eval("(()=>{const b=document.querySelector('.brand').getBoundingClientRect();return b.width>0&&b.right<390&&getComputedStyle(document.getElementById('multiCampusControls')).display==='none';})()");
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});
  await cdp.send('Page.navigate',{url:'file:///'+path.join(ROOT,'../NetZero-GridToChip-v9-MultiCampus/dist/Net-Zero-grid-premium.html').replace(/\\/g,'/')});
  for(let i=0;i<120;i++){if(await cdp.eval('!!window.__NZ_TEST'))break;await sleep(250);}await cdp.eval("(()=>{const a=window.__NZ_TEST;a.S.running=false;a.exitTour();a.cancelCamera();a.controls.enableDamping=false;a.S.lightPreset='day-lab';document.querySelector('[data-q=high]').click();})()");await sleep(800);
  await view([-70,1300,-107.99],[-70,0,-108]);await shot('before-top');await view([270,155,230],[150,2,55]);await shot('before-compute');
  report.checks.noRuntimeErrors=cdp.errors.length===0;report.errors=cdp.errors;
  fs.writeFileSync(path.join(ROOT,'evidence/v10-browser.json'),JSON.stringify(report,null,2));for(const [k,v]of Object.entries(report.checks))console.log((v?'PASS ':'FAIL ')+k);console.log('Conflicts:',JSON.stringify(report.conflicts));if(Object.values(report.checks).some(v=>!v))process.exitCode=1;
 }finally{if(cdp)cdp.ws.close();child.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
