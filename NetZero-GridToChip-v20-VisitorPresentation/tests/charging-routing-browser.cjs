'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),{spawn}=require('child_process'),crypto=require('crypto');
const ROOT=path.join(__dirname,'..'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
class CDP{
  constructor(ws){this.ws=ws;this.id=0;this.pending=new Map();this.errors=[];ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&this.pending.has(m.id)){const p=this.pending.get(m.id);this.pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')this.errors.push(m.params.exceptionDetails);if(m.method==='Log.entryAdded'&&m.params.entry.level==='error')this.errors.push(m.params.entry);});}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}));});}
  async eval(expression){const r=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
}
async function main(){
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'nz-v15-parking-')),browser=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
  const child=spawn(browser,['--headless=new','--remote-debugging-port=0','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-background-timer-throttling','--disable-renderer-backgrounding','--window-size=1920,1080','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
  let cdp;const report={checks:{},modes:{}};
  try{
    const active=path.join(profile,'DevToolsActivePort');for(let i=0;i<150&&!fs.existsSync(active);i++)await sleep(200);
    const port=fs.readFileSync(active,'utf8').split('\n')[0],targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json(),ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
    await new Promise(r=>ws.addEventListener('open',r,{once:true}));cdp=new CDP(ws);await cdp.send('Runtime.enable');await cdp.send('Log.enable');await cdp.send('Page.enable');await cdp.send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
    const load=async folder=>{await cdp.send('Page.navigate',{url:'file:///'+path.join(folder,'dist/Net-Zero-grid-premium.html').replace(/\\/g,'/')});let ready=false;for(let i=0;i<160;i++){if(await cdp.eval('!!window.__NZ_TEST')){ready=true;break;}await sleep(200);}if(!ready)throw Error('Application not ready');await cdp.eval("(()=>{const a=window.__NZ_TEST;a.S.running=false;a.S.lightPreset='day-lab';a.exitTour();a.cancelCamera();a.controls.enableDamping=false;document.querySelector('[data-q=high]').click();document.getElementById('toast').replaceChildren();return true})()");await sleep(600);};
    const shot=async(name,pos,tgt)=>{await cdp.eval('(()=>{const a=window.__NZ_TEST;a.cancelCamera();a.camera.position.set('+pos+');a.controls.target.set('+tgt+');a.controls.update();document.getElementById("toast").replaceChildren();return true})()');await sleep(650);const s=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(ROOT,'screenshots/v15-'+name+'.png'),Buffer.from(s.data,'base64'));};
    await load(ROOT);
    report.geometry=await cdp.eval("(()=>{const a=window.__NZ_TEST;const m=window.NZ_DETAIL.models;const count=name=>{let n=0;a.scene.traverse(o=>{if(o.name===name)n++});return n};a.scene.updateMatrixWorld(true);return {version:window.NZ_CONFIG.version,charging:window.NZ_MULTI.audit().charging,infra:window.NZ_INFRA.audit(),flows:window.NZ_FLOWS.audit(),env:window.NZ_ENVIRONMENT.audit(true),canopies:count('Unified photovoltaic charging canopy'),daylight:count('Central daylight strip'),legacyLineHidden:a.scene.getObjectByName('Scaled legacy line').visible===false,linePosition:m.line.root.position.toArray(),powerPositions:['panamaSc','panamaSc2'].map(k=>m[k].root.position.toArray()),vehicles:truckPool.map(t=>({p:t.position.toArray(),heading:t.rotation.y})),routes:EDGES.filter(e=>['trans','panScAc','panScDc','scSecondAc','scSecondDc'].includes(e.key)).map(e=>({key:e.key,pts:e.pts})),titles:{charging:INFO.supercharge.t,parking:INFO.parking.t},picks:DEVICES.map(d=>({key:d.key,p:d.p}))};})()");
    const g=report.geometry,p=g.charging.layout,orthogonal=pts=>pts.slice(1).every((b,i)=>b.filter((v,k)=>Math.abs(v-pts[i][k])>1e-7).length===1);
    report.checks.versionUnchanged=g.version==='15.0.0';
    report.checks.oneConnectedChargingStation=g.canopies===1&&g.daylight===1&&g.charging.unifiedCanopy;
    report.checks.originalChargingCapacity=g.charging.rows===2&&g.charging.terminals===24&&g.charging.capacityMW===28.8&&g.charging.dcSupplies===2;
    report.checks.oppositeFacingBanks=g.vehicles.length===24&&g.vehicles.every((v,i)=>v.p[2]===p.rows[i>=12?1:0].vehicleZ&&v.heading===p.rows[i>=12?1:0].heading);
    report.checks.aisleClear=p.columns.every(c=>c.z+.25<=p.aisle.z0||c.z-.25>=p.aisle.z1)&&p.rows.every(r=>r.z+6<=p.aisle.z0||r.z-6>=p.aisle.z1);
    report.checks.separateConventionalParking=p.canopy.z+p.canopy.d/2<p.parking.z0&&g.charging.parkingSpaces===24&&g.titles.parking.includes('燃油车');
    report.checks.noChargingFeedInConventionalParking=g.routes.filter(r=>r.key!=='trans').every(r=>r.pts.every(p=>p[2]<124));
    report.checks.powerCabinetsAndControlAligned=g.powerPositions[0][2]===85&&g.powerPositions[1][2]===109&&g.flows.nodes.find(n=>n.id==='charge.control').p[2]===85&&g.flows.nodes.find(n=>n.id==='charge.second').p[2]===109;
    report.checks.exportFlowOrthogonal=orthogonal(g.routes.find(r=>r.key==='trans').pts);
    const physical=g.infra.physical.find(r=>r.key==='trans');report.checks.physicalPhasesOrthogonal=physical.phaseCount===3&&physical.phasePaths.every(orthogonal);
    report.checks.distinctPhases=physical.phasePaths.every((a,i,all)=>all.every((b,j)=>i===j||Math.abs(a[2][0]-b[2][0])>.6&&Math.abs(a[2][2]-b[2][2])>.6));
    report.checks.towersMovedWithoutDuplicates=g.legacyLineHidden&&JSON.stringify(g.linePosition)==='[67,0,-40.5]';
    const roads=g.env.streets;report.columnConflicts=[];
    for(const t of require('../src/multi-campus-plan.js').renewableExport.towers)for(const r of roads)if(t.x+1.7>r.x0&&t.x-1.7<r.x1&&t.z+1.7>r.z0&&t.z-1.7<r.z1)report.columnConflicts.push(r.name);
    report.checks.towerBasesClearOfRoads=report.columnConflicts.length===0;
    report.checks.chargingLandscapeClear=!g.env.planted.some(t=>t.x>44&&t.x<84&&t.z>82&&t.z<114);
    for(const q of ['compat','standard','high']){await cdp.eval('document.querySelector(\'[data-q='+q+']\').click()');await shot('charging-unified-'+q,[117,65,179],[58,1,110]);report.modes[q]=await cdp.eval('({q:window.__NZ_TEST.S.quality,failed:window.__NZ_TEST.post().failed})');}report.checks.allModes=Object.values(report.modes).every(m=>!m.failed);
    await shot('charging-unified-top',[60,175,108.01],[60,0,108]);await shot('hub-orthogonal',[136,70,77],[53,4,-15]);await shot('hub-orthogonal-top',[51,190,-14.99],[51,0,-15]);
    await cdp.eval("window.__NZ_TEST.S.lightPreset='night'");await shot('charging-unified-night',[117,65,179],[58,1,110]);await cdp.eval("window.__NZ_TEST.S.lightPreset='day-lab';window.__NZ_TEST.focus('supercharge')");await sleep(1200);
    report.checks.chargingCard=await cdp.eval("document.getElementById('infoTitle').textContent==='新能源充电站'&&document.getElementById('infoDesc').textContent.includes('燃油车')");
    const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,f))).digest('hex'),before='backups/v15-before-charging-and-orthogonal-lines/';
    const tourCode=f=>{const s=fs.readFileSync(path.join(ROOT,f),'utf8');return s.slice(s.indexOf('  const TOUR_HOME ='),s.indexOf('  /* 14. 启动'));};
    report.checks.engineAndConfigUnchanged=['src/engine.js','src/config.js','src/chemical-campus.js','src/chemical-process-labels.js'].every(f=>hash(f)===hash(before+f))&&tourCode('src/premium.js')===tourCode(before+'src/premium.js');
    await load(path.join(ROOT,before));await shot('charging-before-consolidation',[117,65,179],[58,1,110]);await shot('hub-before-orthogonal',[136,70,77],[53,4,-15]);
    report.errors=cdp.errors;report.checks.noRuntimeErrors=report.errors.length===0;
    fs.writeFileSync(path.join(ROOT,'evidence/v15-charging-routing.json'),JSON.stringify(report,null,2));for(const [k,v]of Object.entries(report.checks))console.log((v?'PASS ':'FAIL ')+k);console.log('tower conflicts:',JSON.stringify(report.columnConflicts));if(Object.values(report.checks).some(v=>!v))process.exitCode=1;
  }finally{if(cdp)cdp.ws.close();child.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
