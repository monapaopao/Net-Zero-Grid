/* Browser acceptance for rendered geometry, compass and independent solar check. */
'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),http=require('http'),crypto=require('crypto'),{spawn}=require('child_process');
const ROOT=path.join(__dirname,'..'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
class CDP{
  constructor(ws){this.ws=ws;this.id=0;this.pending=new Map();this.errors=[];ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&this.pending.has(m.id)){const p=this.pending.get(m.id);this.pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')this.errors.push(m.params.exceptionDetails);if(m.method==='Log.entryAdded'&&m.params.entry.level==='error')this.errors.push(m.params.entry);});}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}));});}
  async eval(expression){const r=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
}
async function main(){
  const html=fs.readFileSync(path.join(ROOT,'dist/Net-Zero-grid-premium.html'));
  const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'nz-v8-')),browser=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
  const child=spawn(browser,['--headless=new','--remote-debugging-port=0','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-background-timer-throttling','--disable-renderer-backgrounding','--window-size=1600,1000','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
  let cdp;const report={checks:{},views:{},modes:{}};
  try{
    const active=path.join(profile,'DevToolsActivePort');for(let i=0;i<150&&!fs.existsSync(active);i++)await sleep(200);
    const port=fs.readFileSync(active,'utf8').split('\n')[0],targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json(),ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
    await new Promise(r=>ws.addEventListener('open',r,{once:true}));cdp=new CDP(ws);await cdp.send('Runtime.enable');await cdp.send('Log.enable');await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});await cdp.send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port});
    for(let i=0;i<120;i++){if(await cdp.eval('!!window.__NZ_TEST'))break;await sleep(250);}
    await cdp.eval("(()=>{const a=window.__NZ_TEST;a.S.running=false;a.S.simTime=43200;a.exitTour();a.cancelCamera();a.controls.enableDamping=false;a.S.lightPreset='day-lab';return true;})()");
    const view=async(pos,tgt)=>{await cdp.eval('(()=>{const a=window.__NZ_TEST;a.cancelCamera();a.camera.position.set('+pos+');a.controls.target.set('+tgt+');a.controls.update();return true;})()');await sleep(350);};
    const shot=async name=>{const s=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(ROOT,'screenshots/v8-'+name+'.png'),Buffer.from(s.data,'base64'));};
    for(const q of ['compat','standard','high']){
      await cdp.eval('document.querySelector(\'[data-q="'+q+'"]\').click()');await view([-15,107,230],[-124,1,88]);await shot(q+'-solar');
      report.modes[q]=await cdp.eval('({solar:window.NZ_SOLAR.audit(),landscape:window.NZ_RENEWABLES.audit(),postFailed:window.__NZ_TEST.post().failed})');
    }
    report.geometry=await cdp.eval("(()=>{const a=window.__NZ_TEST,terrain=a.scene.getObjectByName('Continuous western hills'),base=a.scene.getObjectByName('Continuous terrain plinth');a.scene.updateMatrixWorld(true);const p=terrain.geometry.attributes.position,box=o=>{const b=new THREE.Box3().setFromObject(o);return {min:b.min.toArray(),max:b.max.toArray()};};let edgeMax=0;for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);if(Math.abs(x+565)<.001||Math.abs(x-245)<.001||Math.abs(z+425)<.001||Math.abs(z-190)<.001)edgeMax=Math.max(edgeMax,Math.abs(p.getY(i)));}const root=a.scene.children.find(o=>o.name==='Detailed solar'&&o.visible),normals=[];root.traverse(o=>{if(o.isInstancedMesh&&o.count===396&&o.geometry.type==='BoxGeometry'&&o.geometry.parameters.width===1.9){for(let i=0;i<o.count;i++){const m=new THREE.Matrix4();o.getMatrixAt(i,m);normals.push(new THREE.Vector3(0,1,0).transformDirection(o.matrixWorld.clone().multiply(m)).toArray());}}});return {terrain:box(terrain),base:box(base),edgeMax,retiredGroundVisible:a.scene.getObjectByName('Retired flat ground').visible,normals,solarEdge:EDGES.find(e=>e.key==='solar').pts,solar:window.NZ_SOLAR.audit()};})()");
    const g=report.geometry;
    report.checks.oldInvertersRemoved=g.solar.oldInverters===0;
    report.checks.renderedEquipmentClear=g.solar.physicalConflicts.length===0&&g.solar.plan.conflicts.length===0&&g.solar.plan.equipmentConflicts.length===0;
    report.checks.allPanelsSouth=g.normals.length===396&&g.normals.every(n=>Math.abs(n[0])<1e-6&&n[2]>0&&Math.abs(Math.acos(n[1])*180/Math.PI-24)<.001);
    report.checks.sharedTerrainBoundary=[0,2].every(k=>Math.abs(g.terrain.min[k]-g.base.min[k])<.001&&Math.abs(g.terrain.max[k]-g.base.max[k])<.001)&&g.edgeMax<.001&&Math.abs(g.base.max[1])<.001&&!g.retiredGroundVisible;
    report.checks.connectedPVSupply=g.solar.connections.filter(c=>c.id.startsWith('ac-')).length===3&&g.solar.connections.filter(c=>c.id.startsWith('mv-')).length===3&&g.solar.connections.some(c=>c.from==='collector'&&c.to==='substation')&&Math.abs(g.solarEdge[0][0]+81)<.001&&Math.abs(g.solarEdge[0][2]-120)<.001;
    report.checks.incomingTerminalConnected=g.solarEdge.at(-1).every((v,i)=>Math.abs(v-[27,3.2,11][i])<.001)&&await cdp.eval("EDGES.find(e=>e.key==='solar').poles.every(([x])=>x<0)");
    for(const [name,pos] of Object.entries({south:[-128,85,223],east:[22,85,73],north:[-128,85,-77],west:[-278,85,73],top:[-128,240,73.01]})){
      await view(pos,[-128,0,73]);const points=await cdp.eval('window.NZ_SOLAR.audit().compass');report.views[name]=points;
    }
    report.checks.compassDirections=report.views.south[0].y<44&&report.views.north[0].y>44&&report.views.east[0].x>44&&report.views.west[0].x<44&&report.views.top.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
    await cdp.eval('window.__NZ_TEST.focus("solar")');await sleep(1300);await view([-15,107,230],[-124,1,88]);
    const before=await cdp.eval('JSON.stringify(window.__NZ_TEST.snapshot())');
    await cdp.eval('document.getElementById("solarCheckToggle").click()');await sleep(500);await shot('solar-check');
    report.solarCheck=await cdp.eval('window.NZ_SOLAR.audit()');
    report.checks.sunlightAligned=await cdp.eval("(()=>{const a=window.NZ_SOLAR.audit();const light=new THREE.Vector3().subVectors(sunL.position,sunL.target.position).normalize();return light.distanceTo(new THREE.Vector3(...a.diagnostic.sun.direction))<.001&&scene.getObjectByName('Solar position verification').visible;})()");
    await cdp.eval("(()=>{const hour=document.getElementById('solarHour');hour.value='10';hour.dispatchEvent(new Event('input',{bubbles:true}));})()");await sleep(550);await shot('winter-morning');
    report.morning=await cdp.eval('window.NZ_SOLAR.audit().diagnostic');report.checks.winterShadowVisible=report.morning.blocked.length>0;
    await cdp.eval("(()=>{const hour=document.getElementById('solarHour');hour.value='0';hour.dispatchEvent(new Event('input',{bubbles:true}));})()");await sleep(550);
    report.checks.noNightDirectSun=await cdp.eval("window.NZ_SOLAR.audit().diagnostic.sun.elevation<0&&sunL.intensity===0");
    report.checks.powerCalculationUnaffected=before===await cdp.eval('JSON.stringify(window.__NZ_TEST.snapshot())');
    await cdp.eval('document.getElementById("solarCheckToggle").click()');
    for(const [name,pos,tgt] of [
      ['overview',[570,520,620],[-155,8,-104]],['boundary-south',[-385,44,360],[-180,0,176]],
      ['boundary-west',[-760,48,-145],[-552,0,-145]],['boundary-north',[-270,78,-670],[-270,0,-414]],
      ['boundary-east',[470,45,-90],[236,0,-90]]
    ]){await view(pos,tgt);await shot(name);}
    await cdp.eval("window.__NZ_TEST.S.lightPreset='night'");await view([-15,107,230],[-124,1,88]);await shot('solar-night');
    report.checks.noShaderErrors=await cdp.eval('renderer.info.programs.every(p=>!p.diagnostics||p.diagnostics.runnable)&&!window.__NZ_TEST.post().failed');
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:1366,height:768,deviceScaleFactor:1,mobile:false});await sleep(600);await shot('1366-compass');
    report.checks.compassInsideViewport=await cdp.eval("(()=>{const a=document.getElementById('campusCompass').getBoundingClientRect(),b=document.getElementById('sceneFrame').getBoundingClientRect();return a.left>=b.left&&a.right<=b.right&&a.top>=b.top&&a.bottom<=b.bottom;})()");
    report.checks.glHealthy=await cdp.eval('renderer.getContext().getError()===0');
    const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
    report.checks.enginePreserved=hash(path.join(ROOT,'src/engine.js'))===hash(path.join(ROOT,'../NetZero-GridToChip-v7-TerrainRenewables/src/engine.js'));
    report.errors=cdp.errors;report.checks.noBrowserErrors=report.errors.length===0;
    fs.writeFileSync(path.join(ROOT,'tests/solar-browser.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report.checks,null,2));if(Object.values(report.checks).some(v=>!v))process.exitCode=1;
  }finally{if(cdp)cdp.ws.close();child.kill();server.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
