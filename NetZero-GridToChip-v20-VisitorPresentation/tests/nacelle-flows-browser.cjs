'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),{spawn}=require('child_process');
const ROOT=path.join(__dirname,'..'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
class CDP{
 constructor(ws){this.ws=ws;this.id=0;this.pending=new Map();this.errors=[];ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&this.pending.has(m.id)){const p=this.pending.get(m.id);this.pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')this.errors.push(m.params.exceptionDetails);if(m.method==='Log.entryAdded'&&m.params.entry.level==='error')this.errors.push(m.params.entry);});}
 send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}));});}
 async eval(expression){const r=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
}
async function main(){
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'nz-v13-products-')),browser=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
 const child=spawn(browser,['--headless=new','--remote-debugging-port=0','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-background-timer-throttling','--disable-renderer-backgrounding','--window-size=2048,1017','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
 let cdp;const report={checks:{},modes:{}};
 try{
  const active=path.join(profile,'DevToolsActivePort');for(let i=0;i<150&&!fs.existsSync(active);i++)await sleep(200);
  const port=fs.readFileSync(active,'utf8').split('\n')[0],targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json(),ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise(r=>ws.addEventListener('open',r,{once:true}));cdp=new CDP(ws);await cdp.send('Runtime.enable');await cdp.send('Log.enable');await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:2048,height:1017,deviceScaleFactor:1,mobile:false});
  await cdp.send('Page.navigate',{url:'file:///'+path.join(ROOT,'dist/Net-Zero-grid-premium.html').replace(/\\/g,'/')});
  for(let i=0;i<160;i++){if(await cdp.eval('!!window.__NZ_TEST'))break;await sleep(250);}
  await cdp.eval("(()=>{const a=window.__NZ_TEST;a.S.running=false;a.S.lightPreset='day-lab';a.cancelCamera();a.controls.enableDamping=false;document.querySelector('[data-q=standard]').click();document.getElementById('toast').replaceChildren();})()");
  const shot=async name=>{await cdp.eval("document.getElementById('toast').replaceChildren()");const s=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(ROOT,'screenshots/v13-'+name+'.png'),Buffer.from(s.data,'base64'));};
  report.product=await cdp.eval('window.NZ_WIND_PRODUCT.audit()');
  report.checks.version=await cdp.eval("window.NZ_CONFIG.version==='13.0.0'&&document.title.includes('v13')");
  report.checks.twelveNacelleTransformers=report.product.transformers===12&&report.product.rotorIndependent&&report.product.aluminumColor==='c3ccd0'&&!report.product.materialsExpanded;
  report.checks.groundReplacement=await cdp.eval("(()=>{const a=window.NZ_RENEWABLES.audit(true);return a.fixtures.filter(f=>f.kind==='collectorSwitch').length===12&&!a.fixtures.some(f=>f.kind==='transformer')&&window.NZ_DETAIL.models.substation!=null;})()");
  report.checks.transformerFitsTail=await cdp.eval("(()=>{const {scene,THREE}=window.__NZ_TEST;scene.updateMatrixWorld(true);const g=scene.getObjectByName('XIBILI nacelle transformer 0'),inverse=g.matrixWorld.clone().invert();function bounds(o){const b=new THREE.Box3().makeEmpty();o.traverse(m=>{if(!m.isMesh)return;m.geometry.computeBoundingBox();b.union(m.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,m.matrixWorld)));});return b;}const inner=bounds(g.getObjectByName('Transformer internals')),roof=bounds(g.getObjectByName('Rear roof')),left=bounds(g.getObjectByName('Rear left panel')),right=bounds(g.getObjectByName('Rear right panel')),end=bounds(g.getObjectByName('Rear end panel')),deck=bounds(g.getObjectByName('Continuous nacelle support deck'));return inner.max.y<roof.min.y&&inner.min.y>deck.max.y&&inner.min.x>left.max.x&&inner.max.x<right.min.x&&inner.min.z>end.max.z;})()");
  report.checks.stableChapterIds=await cdp.eval("(()=>{const a=window.__NZ_TEST;return new Set(a.TOUR.map(c=>c.id)).size===8&&a.TOUR[a.DC_SEG.chap].id==='compute'&&a.TOUR.find(c=>c.id==='windProduct').text===window.NZ_WIND_PRODUCT.audit().text&&a.TOUR.every((c,i)=>c.id===window.NZ_TOUR_SCRIPT.campus[i].id);})()");
  await cdp.eval("window.__NZ_TEST.startTour();window.__NZ_TEST.tourJump(window.__NZ_TEST.TOUR.findIndex(c=>c.id==='windProduct'));window.__NZ_TEST.tourTick(3);window.__NZ_TEST.toggleTourPause();");await sleep(500);await shot('nacelle-tour');
  report.tourProduct=await cdp.eval('({wind:window.NZ_WIND_PRODUCT.audit(),camera:window.__NZ_TEST.camera.position.toArray(),target:window.__NZ_TEST.controls.target.toArray(),tour:window.__NZ_TEST.tourState(),text:document.getElementById("tourText").textContent})');
  const near=(a,b)=>a.every((v,i)=>Math.abs(v-b[i])<1e-7);
  report.checks.stationaryProductPose=near(report.tourProduct.camera,report.tourProduct.wind.pose.pos)&&near(report.tourProduct.target,report.tourProduct.wind.pose.tgt)&&report.tourProduct.wind.amount>.98;
  report.checks.exactProductNarration=report.tourProduct.text===report.product.text;
  report.checks.compactDisplay=report.product.compact.scale===.58&&report.product.turbine.rotorScale===1.25&&report.product.turbine.towerHeight===31.05;
  report.checks.soleNacelle=await cdp.eval("!window.__NZ_TEST.scene.getObjectByName('Nacelle housing')");
  report.checks.conciseLabel=await cdp.eval("(()=>{const l=LABELS3D.windNacelle;l.el.classList.add('sel');document.body.classList.add('labels-detail');const ok=l.el.querySelector('.nm').textContent==='风力发电机组'&&l.lv.textContent===''&&getComputedStyle(l.lv).display==='none'&&!l.el.querySelector('.pr');document.body.classList.remove('labels-detail');return ok;})()");
  await cdp.eval('window.__NZ_TEST.exitTour()');await sleep(1000);
  report.checks.exitRestoresShell=await cdp.eval('!window.NZ_WIND_PRODUCT.audit().open&&window.NZ_WIND_PRODUCT.audit().amount<.02');
  report.checks.noMaterialExpansionControls=await cdp.eval("!Object.keys(window.NZ_WIND_PRODUCT).some(k=>/material.*expand|film.*zoom/i.test(k))&&document.getElementById('detailExplode').hidden");
  for(const q of ['compat','standard','high']){
   await cdp.eval("document.querySelector('[data-q="+q+"]').click();window.NZ_WIND_PRODUCT.selectIndex(0);window.__NZ_TEST.focus('windNacelle')");await sleep(1400);await shot('nacelle-'+q);
   report.modes[q]=await cdp.eval('({product:window.NZ_WIND_PRODUCT.audit(),flows:window.NZ_FLOWS.audit(),perf:window.__NZ_TEST.perf()})');
  }
  report.checks.qualityBudgets=Object.entries(report.modes).every(([q,m])=>m.product.quality===q&&m.flows.quality===q&&m.flows.routes.every(r=>r.count<=(q==='compat'?3:q==='high'?14:7)));
  await cdp.eval("document.querySelector('[data-q=standard]').click();document.getElementById('windProductControls').querySelector('select').value='6';document.getElementById('windProductControls').querySelector('select').dispatchEvent(new Event('change'))");await sleep(1300);await shot('nacelle-hill');
  report.checks.selectHillTurbine=await cdp.eval('window.NZ_WIND_PRODUCT.audit().index===6&&Math.abs(window.__NZ_TEST.controls.target.x-window.NZ_WIND_PRODUCT.pose(6).tgt[0])<.001');
  report.flows=await cdp.eval('window.NZ_FLOWS.audit()');const nodes=Object.fromEntries(report.flows.nodes.map(n=>[n.id,n]));
  report.checks.registeredClosedRoutes=report.flows.routes.every(r=>nodes[r.from]&&nodes[r.to]&&near(r.pts[0],nodes[r.from].p)&&near(r.pts.at(-1),nodes[r.to].p)&&r.pts.every(p=>p.every(Number.isFinite)));
  report.checks.collectionRoads=report.flows.routes.filter(r=>r.id.startsWith('wind-collection-branch-')).length===12&&report.flows.routes.filter(r=>r.id.startsWith('wind-collection-branch-')).every(r=>r.pts.slice(1,-1).every(p=>p[1]>=-.001));
  report.checks.nuclearReadOnly=report.flows.routes.filter(r=>r.from.startsWith('nuclear')||r.to.startsWith('nuclear')).every(r=>r.type==='data'&&r.from==='nuclear.meter');
  report.checks.heatOffByDefault=!report.flows.enabled.heat&&!report.flows.heatVisible&&!report.flows.thermalPowerConfigured;
  const savedPower=await cdp.eval('window.__NZ_TEST.S.turbP[0]');
  report.checks.perTurbinePower=await cdp.eval("(()=>{const a=window.__NZ_TEST;window.NZ_FLOWS.context('wind');window.NZ_FLOWS.update(5,.1);return window.NZ_FLOWS.audit().routes.filter(r=>r.id.endsWith('-0')&&r.type==='power').every(r=>r.rate===a.S.turbP[0]);})()");
  await cdp.eval('window.__NZ_TEST.S.turbP[0]=0;window.NZ_FLOWS.update(6,.1)');
  report.checks.zeroPowerStops=await cdp.eval("window.NZ_FLOWS.audit().routes.filter(r=>r.id.endsWith('-0')&&r.type==='power').every(r=>r.count===0&&r.rate===0)");await cdp.eval('window.__NZ_TEST.S.turbP[0]='+savedPower);
  await cdp.eval("window.NZ_FLOWS.setEnabled('power',false)");await sleep(200);
  report.checks.powerToggle=await cdp.eval("window.NZ_FLOWS.audit().routes.filter(r=>r.type==='power').every(r=>!r.visible&&r.count===0)&&EDGES.filter(e=>['power','grid','nuclear'].includes(e.media)).every(e=>!e.points.visible&&(!e.visualTube||!e.visualTube.visible))");
  await cdp.eval("document.querySelector('[data-flow-action=off]').click()");await sleep(200);
  report.checks.allOff=await cdp.eval('!window.NZ_FLOWS.audit().global&&window.NZ_FLOWS.audit().routes.every(r=>!r.visible&&r.count===0)');
  await cdp.eval("const box=document.querySelector('[data-flow=data]');box.checked=true;box.dispatchEvent(new Event('change'))");await sleep(200);
  report.checks.singleLayerReactivation=await cdp.eval('window.NZ_FLOWS.audit().global&&window.NZ_FLOWS.audit().enabled.data&&document.getElementById("showCampusFlows").checked');
  await cdp.eval("document.querySelector('[data-flow-action=default]').click();window.__NZ_TEST.S.reduceMotion=true");await sleep(200);
  report.checks.reducedMotion=await cdp.eval('window.NZ_FLOWS.audit().routes.every(r=>r.count===0)');await cdp.eval('window.__NZ_TEST.S.reduceMotion=false');
  report.checks.boundedPool=await cdp.eval("(()=>{const before=window.NZ_FLOWS.audit().totalAllocated;for(let i=0;i<180;i++)window.NZ_FLOWS.update(i*.05,.05);return before===window.NZ_FLOWS.audit().totalAllocated&&window.NZ_FLOWS.audit().routes.every(r=>r.count<=32);})()");
  report.checks.noLedgerMutation=await cdp.eval("(()=>{const a=window.__NZ_TEST,before=JSON.stringify(a.engine.exportLedger()),state=JSON.stringify(a.S);window.NZ_FLOWS.setEnabled('heat',true);window.NZ_FLOWS.context('overview');window.NZ_FLOWS.update(10,.2);const after=JSON.stringify(a.engine.exportLedger());return before===after&&state===JSON.stringify(a.S)&&window.NZ_FLOWS.audit().heatVisible;})()");
  await cdp.eval("(()=>{document.getElementById('infoClose').click();window.NZ_FLOWS.setEnabled('heat',true);window.NZ_FLOWS.context('overview');const a=window.__NZ_TEST;a.cancelCamera();a.camera.position.set(300,245,365);a.controls.target.set(165,0,20);a.controls.update();document.getElementById('flowLayers').open=true;})()");await sleep(400);await shot('flows-heat-concept');
  await cdp.eval("(()=>{window.NZ_FLOWS.setEnabled('heat',false);document.getElementById('flowLayers').open=false;const a=window.__NZ_TEST;a.camera.position.set(...a.TOUR_HOME.pos);a.controls.target.set(...a.TOUR_HOME.tgt);a.controls.update();window.NZ_FLOWS.context('overview');})()");await sleep(400);await shot('overview');
  for(const [zone,pos,tgt]of [['compute',[230,130,200],[150,3,60]],['chemical',[338,170,-62],[200,2,-200]],['factory',[380,110,195],[280,3,87]]]){
   await cdp.eval("(()=>{const a=window.__NZ_TEST;a.cancelCamera();a.camera.position.set("+pos+");a.controls.target.set("+tgt+");a.controls.update();window.NZ_FLOWS.context('"+zone+"');document.getElementById('flowLayers').open=true;})()");await sleep(400);await shot('flows-'+zone);
  }
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await sleep(400);await shot('mobile-flows');
  report.checks.mobileLayerPanel=await cdp.eval("(()=>{const r=document.getElementById('flowLayers').getBoundingClientRect();return r.left>=0&&r.right<=390&&r.top>=0&&r.bottom<844;})()");
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:2048,height:1017,deviceScaleFactor:1,mobile:false});
  const wholeView=async()=>{await cdp.eval("(()=>{const a=window.__NZ_TEST;a.exitTour();document.getElementById('infoClose').click();a.cancelCamera();a.S.running=false;a.S.lightPreset='day-lab';window.NZ_WIND_PRODUCT.selectIndex(0);a.S.reduceMotion=true;bladeAng.forEach((v,i)=>bladeAng[i]=.2);a.controls.enableDamping=false;document.querySelector('[data-q=standard]').click();const target=new THREE.Vector3(-243,22,-19),direction=new THREE.Vector3(470,385,560).normalize();a.controls.target.copy(target);a.camera.position.copy(target).addScaledVector(direction,95);a.controls.update();window.NZ_VISUAL.selected('wind');document.getElementById('flowLayers').open=false;})()");await sleep(1500);};
  await wholeView();await shot('wind-whole-after');report.checks.conciseLabelVisible=await cdp.eval("!LABELS3D.windNacelle.el.classList.contains('hidden')&&!LABELS3D.windNacelle.el.classList.contains('layer-hidden')");
  report.geometry=await cdp.eval("(()=>{const a=window.__NZ_TEST;const sizes={};a.scene.updateMatrixWorld(true);const g=a.scene.getObjectByName('XIBILI nacelle transformer 0');for(const name of ['Transformer internals','Nacelle drivetrain enclosure','Continuous nacelle support deck'])sizes[name]=new THREE.Box3().setFromObject(g.getObjectByName(name)).getSize(new THREE.Vector3()).toArray();return {sizes,rotorDiameter:window.NZ_RENEWABLE_PLAN.rotorDiameter,sites:window.NZ_RENEWABLES.audit().sites};})()");
  await cdp.send('Page.navigate',{url:'file:///'+path.join(ROOT,'../NetZero-GridToChip-v12-NacelleEnergyFlows/dist/Net-Zero-grid-premium.html').replace(/\\/g,'/')});
  for(let i=0;i<160;i++){if(await cdp.eval('!!window.__NZ_TEST'))break;await sleep(250);}await wholeView();await shot('wind-whole-before');
  report.beforeGeometry=await cdp.eval("(()=>{const a=window.__NZ_TEST,g=a.scene.getObjectByName('XIBILI nacelle transformer 0');a.scene.updateMatrixWorld(true);return {transformer:new THREE.Box3().setFromObject(g.getObjectByName('Transformer internals')).getSize(new THREE.Vector3()).toArray(),deck:new THREE.Box3().setFromObject(g.getObjectByName('Continuous nacelle support deck')).getSize(new THREE.Vector3()).toArray(),rotorDiameter:window.NZ_RENEWABLE_PLAN.rotorDiameter};})()");
  report.checks.smallerTransformer=report.geometry.sizes['Transformer internals'].every((v,i)=>Math.abs(v/report.beforeGeometry.transformer[i]-.58)<1e-6);
  report.checks.largerRotor=Math.abs(report.geometry.rotorDiameter/report.beforeGeometry.rotorDiameter-1.25)<1e-6;
  report.checks.smallerDeck=report.geometry.sizes['Continuous nacelle support deck'].every((v,i)=>v<report.beforeGeometry.deck[i]);
  report.checks.clearBladeTips=report.geometry.sites.every(s=>s.hubY-s.y-report.geometry.rotorDiameter/2>10);
  report.checks.noRuntimeErrors=cdp.errors.length===0;report.errors=cdp.errors;
  fs.writeFileSync(path.join(ROOT,'evidence/v13-nacelle-flows.json'),JSON.stringify(report,null,2));for(const [key,value]of Object.entries(report.checks))console.log((value?'PASS ':'FAIL ')+key);console.log('Registered routes:',report.flows.routes.length);if(Object.values(report.checks).some(v=>!v))process.exitCode=1;
 }finally{if(cdp)cdp.ws.close();child.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
