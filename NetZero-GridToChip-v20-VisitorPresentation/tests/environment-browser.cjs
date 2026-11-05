/* Real browser acceptance: geometry, quality switching, post shaders and screenshots. */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http'), crypto = require('crypto');
const { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.errors = [];
    ws.addEventListener('message', e => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)) { const p = this.pending.get(m.id); this.pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result); }
      if (m.method === 'Runtime.exceptionThrown') this.errors.push(m.params.exceptionDetails);
      if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') this.errors.push(m.params.entry);
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') this.errors.push(m.params.args.map(a => a.value || a.description).join(' '));
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); });
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value;
  }
}
async function main() {
  const html = fs.readFileSync(path.join(ROOT, 'dist/Net-Zero-grid-premium.html'));
  const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'nz-env-'));
  const browser = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
  const child = spawn(browser, ['--headless=new', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--window-size=1600,1000', '--user-data-dir=' + ud, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let cdp;
  const report = { viewport: [1600, 1000], modes: {}, checks: {} };
  try {
    const active = path.join(ud, 'DevToolsActivePort');
    for (let i = 0; i < 150 && !fs.existsSync(active); i++) await sleep(200);
    const debugPort = fs.readFileSync(active, 'utf8').split('\n')[0];
    const targets = await (await fetch('http://127.0.0.1:' + debugPort + '/json/list')).json();
    const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise(r => ws.addEventListener('open', r, { once: true })); cdp = new CDP(ws);
    await cdp.send('Runtime.enable'); await cdp.send('Log.enable'); await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + port });
    for (let i = 0; i < 120; i++) { if (await cdp.eval('!!window.__NZ_TEST')) break; await sleep(250); }
    await cdp.eval(`(()=>{const a=window.__NZ_TEST;a.S.running=false;a.S.simTime=43200;a.exitTour();a.cancelCamera();a.S.lightPreset='day-lab';window.__frames=[];let previous=performance.now();function sample(t){window.__frames.push(t-previous);previous=t;if(window.__frames.length>300)window.__frames.shift();requestAnimationFrame(sample);}requestAnimationFrame(sample);return true;})()`);
    const shot = async name => {
      const r = await cdp.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(ROOT, 'screenshots/environment-' + name + '.png'), Buffer.from(r.data, 'base64'));
    };
    const camera = async kind => {
      const views={overview:[[570,520,620],[-155,8,-104]],wind:[[245,380,330],[-285,20,-145]],flatwind:[[-70,120,210],[-370,9,12]],ridge:[[-35,165,45],[-325,29,-164]],distant:[[-33,180,-72],[-294,48,-332]],solar:[[-30,75,178],[-125,2,78]],landscape:[[142,35,188],[112,2,138]],logistics:[[183,36,168],[136,3,119]],central:[[238,163,242],[101,1,48]],north:[[184,76,94],[110,2,-3]],west:[[111,84,152],[32,2,56]],smr:[[242,85,-8],[160,2,-101]]};
      const [pos,tgt]=views[kind];
      await cdp.eval(`(()=>{const a=window.__NZ_TEST;a.cancelCamera();a.controls.enableDamping=false;a.camera.position.set(${pos});a.controls.target.set(${tgt});a.controls.update();window.__frames=[];return true;})()`);
      await sleep(process.env.NZ_FAST?300:1200);
    };
    if(process.env.NZ_SMOKE){
      await cdp.eval(`document.querySelector('[data-q="high"]').click()`);await camera('solar');await shot('smoke-solar');
      console.log('SOLAR',JSON.stringify(await cdp.eval(`(()=>{scene.updateMatrixWorld(true);const root=scene.children.find(o=>o.name==='Detailed solar'&&o.visible),rc=new THREE.Raycaster(new THREE.Vector3(-171.7,10,55.15),new THREE.Vector3(0,-1,0)),hits=rc.intersectObject(root,true);let panel;root.traverse(o=>{if(o.material&&o.material.color.getHex()===0x496979)panel=o;});const mat=new THREE.Matrix4();panel.getMatrixAt(0,mat);return {hits:hits.slice(0,6).map(v=>({color:v.object.material.color.getHexString(),point:v.point.toArray(),instance:v.instanceId})),matrix:mat.elements,world:panel.matrixWorld.elements,audit:window.NZ_RENEWABLES.audit()};})()`)));
      await camera('ridge');await shot('smoke-ridge');
      await cdp.eval('window.__NZ_TEST.focus("wind")');
      const smoke=await cdp.eval(`(()=>{const r=scene.children.find(o=>o.isMesh&&o.geometry.type==='RingGeometry'&&o.geometry.parameters.innerRadius===4.5);return {windSelectionOnTerrain:r.visible&&Math.abs(r.position.y-window.NZ_RENEWABLE_PLAN.height(r.position.x,r.position.z)-.13)<.001,roadSurfaceAboveTerrain:window.NZ_RENEWABLES.audit().minimumRoadSurfaceGap>0,postHealthy:!window.__NZ_TEST.post().failed,glError:renderer.getContext().getError()};})()`);
      fs.writeFileSync(path.join(ROOT,'tests/landscape-smoke.json'),JSON.stringify(smoke,null,2));console.log('SMOKE',JSON.stringify(smoke));if(!smoke.windSelectionOnTerrain||!smoke.roadSurfaceAboveTerrain||!smoke.postHealthy||smoke.glError)process.exitCode=1;return;
    }
    for (const q of ['compat', 'standard', 'high']) {
      await cdp.eval(`document.querySelector('[data-q="${q}"]').click()`); await camera('overview');
      await sleep(process.env.NZ_FAST?600:3500);
      report.modes[q] = await cdp.eval(`(()=>{const a=window.__NZ_TEST, times=window.__frames.slice(-120).filter(t=>t>0);return {perf:a.perf(),frameFps:1000/(times.reduce((a,b)=>a+b,0)/times.length),post:{enabled:a.post().enabled,ao:a.post().ao,failed:a.post().failed,reason:a.post().reason},renewables:window.NZ_RENEWABLES.audit(),programErrors:a.renderer.info.programs.filter(p=>p.diagnostics&&!p.diagnostics.runnable).length};})()`);
      await shot(q + '-overview'); await camera('logistics'); await shot(q + '-logistics'); await camera('landscape'); await shot(q + '-landscape');
      for(const view of ['central','north','west','smr','wind','flatwind','ridge','distant','solar']){await camera(view);await shot(q+'-'+view);}
      console.log(q, JSON.stringify({fps:report.modes[q].frameFps,post:report.modes[q].post,renewables:report.modes[q].renewables}));
    }
    report.geometry = await cdp.eval(`(()=>{const a=window.__NZ_TEST;const group=a.scene.getObjectByName('Scaled legacy logistics');const truck=group.children.find(o=>o.isGroup&&o.name==='');a.scene.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(truck);return {truck:{min:b.min.toArray(),max:b.max.toArray()},southFenceGap:150-b.max.z,eastFenceGap:214-b.max.x,gate:LABELS3D.gate.anc.toArray(),warehouse:new THREE.Box3().setFromObject(a.scene.getObjectByName('Detailed logistics')).getSize(new THREE.Vector3()).toArray(),environment:window.NZ_ENVIRONMENT.audit(true),renewables:window.NZ_RENEWABLES.audit(true)};})()`);
    const renew=report.geometry.renewables;
    const pairs=renew.sites.flatMap((a,i)=>renew.sites.slice(i+1).map(b=>Math.hypot(a.x-b.x,a.z-b.z)));
    report.minimumWindSpacing=Math.min(...pairs);
    report.checks.windSpacing=report.minimumWindSpacing>=renew.rotorDiameter*5;
    report.checks.windZones=['west','ridge','distant'].every(zone=>renew.sites.filter(s=>s.zone===zone).length===4);
    report.checks.hillTowerFoundations=renew.sites.every(s=>Math.abs(s.hubY-s.y-27.6)<.001)&&renew.sites.filter(s=>s.zone!=='west').every(s=>s.y>10);
    report.checks.solarAndCampusFlat=renew.solarFlat&&await cdp.eval('[[30,50],[134,-10],[136,111],[160,-110]].every(([x,z])=>Math.abs(window.NZ_RENEWABLE_PLAN.height(x,z))<.001)');
    report.checks.exteriorQuality=!report.modes.compat.renewables.basicVisible&&report.modes.standard.renewables.basicVisible&&!report.modes.standard.renewables.refinedVisible&&report.modes.high.renewables.refinedVisible;
    report.checks.exteriorCoverage=['west','ridge','distant','solar'].every(zone=>renew.coverage[zone].roads>0&&renew.coverage[zone].shrubs>0&&renew.coverage[zone].lamps>0);
    report.checks.roadSurfaceAboveTerrain=renew.minimumRoadSurfaceGap>0;
    report.solarMeshes=await cdp.eval("(()=>{const root=scene.children.find(o=>o.name==='Detailed solar'&&o.visible),out=[];root.traverse(o=>{if(o.isMesh)out.push({color:o.material.color.getHexString(),count:o.count||1,type:o.geometry.type,size:o.geometry.parameters});});return out;})()");
    report.checks.terrainAttached=await cdp.eval('(()=>{const a=window.NZ_RENEWABLES.audit(true),h=window.NZ_RENEWABLE_PLAN.height;return a.planted.every(p=>Math.abs(p.y-h(p.x,p.z))<.001)&&a.roadSamples.every(p=>Math.abs(p.y-h(p.x,p.z)-.34)<.001)&&a.collectorSegments.every(s=>s.pts.every(p=>p[1]>=h(p[0],p[2])));})()');
    report.checks.exteriorPlantClearance=await cdp.eval('(()=>{const a=window.NZ_RENEWABLES.audit(true),p=window.NZ_RENEWABLE_PLAN;return a.planted.every(v=>p.sites.every(s=>Math.hypot(v.x-s.x,v.z-s.z)>v.r+9)&&!(v.x+v.r>p.solarBounds.x0&&v.x-v.r<p.solarBounds.x1&&v.z+v.r>p.solarBounds.z0&&v.z-v.r<p.solarBounds.z1));})()');
    const env=report.geometry.environment, overlaps=(a,b,m=0)=>a.x0<b.x1+m&&a.x1>b.x0-m&&a.z0<b.z1+m&&a.z1>b.z0-m;
    const required=['north','west','central','storage','power','compute','hydrogen','charging','industrial','east','smr'];
    report.checks.wholeCampusCoverage=required.every(k=>env.coverage[k]&&env.coverage[k].roads>0&&(env.coverage[k].trees+env.coverage[k].shrubs)>0);
    report.plantConflicts=env.planted.filter(p=>{const b={x0:p.x-p.r,x1:p.x+p.r,z0:p.z-p.r,z1:p.z+p.r};return env.protectedAreas.some(o=>overlaps(b,o,.24))||env.streets.some(o=>overlaps(b,o,.24));});
    report.checks.plantingClearance=report.plantConflicts.length===0;
    report.fixtureConflicts=env.fixtures.filter(p=>{const r=p.r||.28,b={x0:p.x-r,x1:p.x+r,z0:p.z-r,z1:p.z+r};return env.protectedAreas.some(o=>overlaps(b,o))||env.streets.some(o=>overlaps(b,o));});
    report.checks.fixtureClearance=report.fixtureConflicts.length===0;
    report.roadConflicts=env.streets.flatMap(s=>env.protectedAreas.filter(p=>overlaps(s,p)).map(p=>({street:s.name,obstacle:p.key})));
    report.checks.roadClearance=report.roadConflicts.length===0;
    const connected=(roads)=>{const reached=new Set([0]);let changed=true;while(changed){changed=false;roads.forEach((s,i)=>{if(!reached.has(i)&&[...reached].some(j=>overlaps(s,roads[j],.01))){reached.add(i);changed=true;}});}return reached.size===roads.length;};
    report.checks.connectedMainRoads=connected(env.streets.filter(s=>s.zone!=='smr'));
    report.checks.connectedSmrRoads=connected(env.streets.filter(s=>s.zone==='smr'));
    report.checks.truckInsideFence = report.geometry.southFenceGap > 5 && report.geometry.eastFenceGap > 5;
    report.checks.gateMoved = report.geometry.gate[2] === 150;
    report.checks.truckClearOfSouthRoad = report.geometry.truck.max[2] < report.geometry.environment.southRoad.z0 - 3;
    report.checks.qualityLayers = !report.modes.compat.perf.environment.basicVisible && report.modes.standard.perf.environment.basicVisible && !report.modes.standard.perf.environment.refinedVisible && report.modes.high.perf.environment.refinedVisible;
    report.checks.aoActive = report.modes.high.post.ao === true && !report.modes.standard.post.enabled;
    report.checks.noShaderErrors = Object.values(report.modes).every(m => !m.post.failed && m.programErrors === 0);
    // Same camera AO-off image gives an isolated post comparison.
    await camera('logistics');
    await cdp.eval('window.__NZ_TEST.post().setParams({ao:false})'); await sleep(300); await shot('high-ao-off');
    await cdp.eval('window.__NZ_TEST.post().setParams({ao:true})'); await sleep(300); await shot('high-ao-on');
    await cdp.eval("window.__NZ_TEST.S.lightPreset='night'"); await sleep(1500); await shot('high-night-logistics');
    report.night = await cdp.eval('window.__NZ_TEST.perf()');
    report.checks.nightLights = report.night.environment.localLights === 4 && report.night.bloom;
    await camera('overview'); await shot('high-night-overview');
    for(const view of ['central','north','west','smr','wind','flatwind','ridge','distant','solar']){await camera(view);await shot('high-night-'+view);}
    for (const q of ['compat', 'high', 'standard', 'high']) await cdp.eval(`document.querySelector('[data-q="${q}"]').click()`);
    await sleep(500);
    await camera('ridge');report.exteriorNight=await cdp.eval('window.NZ_ENVIRONMENT.audit()');report.checks.exteriorNightLights=report.exteriorNight.activeLightZones.some(z=>z.startsWith('outside-'));
    await cdp.eval('window.__NZ_TEST.focus("wind")');await sleep(700);await cdp.eval(`document.querySelector('[data-landscape="solar"]').click()`);await sleep(300);report.checks.exteriorNavigation=await cdp.eval('Math.abs(window.__NZ_TEST.controls.target.x-window.NZ_RENEWABLES.focus("solar").tgt[0])<.1&&!document.getElementById("renewableControls").hidden');
    report.checks.repeatSwitch = await cdp.eval("window.NZ_ENVIRONMENT.audit().refinedVisible && window.__NZ_TEST.post().enabled && !window.__NZ_TEST.post().failed");
    report.preLossGlError = await cdp.eval('window.__NZ_TEST.renderer.getContext().getError()');
    const lossSupported = await cdp.eval("(()=>{window.__loss=window.__NZ_TEST.renderer.getContext().getExtension('WEBGL_lose_context');if(window.__loss)window.__loss.loseContext();return !!window.__loss;})()");
    if (lossSupported) {
      await sleep(700);
      // Intentional context loss reports CONTEXT_LOST_WEBGL once; consume it while lost.
      report.lossGlError = await cdp.eval('window.__NZ_TEST.renderer.getContext().getError()');
      await cdp.eval('window.__loss.restoreContext()'); await sleep(2500);
      report.checks.contextRestored = await cdp.eval("!window.__NZ_TEST.contextLost() && window.__NZ_TEST.post().enabled && !window.__NZ_TEST.post().failed");
    }
    report.afterRestoreGlError = await cdp.eval('window.__NZ_TEST.renderer.getContext().getError()');
    report.checks.noGlError = report.preLossGlError === 0 && report.afterRestoreGlError === 0;
    const hash = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
    report.checks.enginePreserved = hash(path.join(ROOT,'src/engine.js')) === hash(path.join(ROOT,'../NetZero-GridToChip-v5-Infrastructure/src/engine.js'));
    report.errors = cdp.errors; report.checks.noBrowserErrors = report.errors.length === 0;
    fs.writeFileSync(path.join(ROOT, 'tests/environment-browser.json'), JSON.stringify(report, null, 2));
    console.log('CHECKS', JSON.stringify(report.checks));
    if (Object.values(report.checks).some(v => !v)) process.exitCode = 1;
  } finally { if (cdp) cdp.ws.close(); child.kill(); server.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
