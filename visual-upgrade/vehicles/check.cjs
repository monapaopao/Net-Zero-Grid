'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const baseline=process.argv.includes('--baseline'),label=baseline?'before':'after',out=path.join(__dirname,'evidence');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-gpu','--use-angle=d3d11']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:810},deviceScaleFactor:1}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route(/^https?:/,r=>r.abort());
  const input=process.argv.find(x=>x.startsWith('--file='))?.slice(7)||path.resolve(__dirname,'../webgpu/dist/多园区-v20-r187-WebGPU.html');
  await page.goto(pathToFileURL(input).href);await page.waitForFunction(()=>NZ_GPU?.ready,{},{timeout:90000});
  await page.evaluate(()=>{const a=__NZ_TEST;a.S.running=false;a.S.lightPreset='day-lab';document.querySelector('#segQuality [data-q="high"]').click();a.controls.autoRotate=false;a.controls.enableDamping=false;a.cancelCamera();});
  await page.addStyleTag({content:'body *{visibility:hidden!important} #gridCanvas{visibility:visible!important} #canvasWrap,#sceneFrame{position:fixed!important;inset:0!important;border:0!important} #labels3d,#vignette{display:none!important}'});await page.evaluate(()=>__NZ_TEST.resize());
  const audit=await page.evaluate(()=>NZ_VEHICLES.audit());assert.equal(audit.vehicles.length,23);assert.equal(audit.routes.length,9);
  const samples=[];
  for(const view of (process.argv.includes('--closeups-only')?[]:['campus','charge','parking'])){
   const data=await page.evaluate(async view=>{
    const a=__NZ_TEST,poses={campus:a.TOUR_HOME,charge:{pos:[91,6.1,114],tgt:[64,2,101]},parking:{pos:[75,7,147],tgt:[55,1,131]}};a.cancelCamera();a.camera.position.fromArray(poses[view].pos);a.controls.target.fromArray(poses[view].tgt);a.controls.update();
    for(let i=0;i<90;i++)await new Promise(requestAnimationFrame);
    const frames=[];for(let i=0;i<181;i++)frames.push(await new Promise(requestAnimationFrame));const dt=frames.slice(1).map((t,i)=>t-frames[i]).sort((a,b)=>a-b);
    const meshes=[];a.scene.getObjectByName('Anatomy detailed campus vehicles').traverseVisible(o=>{if(o.isMesh)meshes.push(o);});
    return {view,medianMs:dt[90],p95Ms:dt[171],perf:a.perf(),fleetVisibleMeshes:meshes.length,fleetTriangles:meshes.reduce((n,o)=>n+(o.geometry.index?.count||o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1),0),detail:NZ_VEHICLES.audit().detailVisible};
   },view);samples.push(data);await page.screenshot({path:path.join(out,label+'-'+view+'.jpg'),type:'jpeg',quality:94});console.log(label,view,JSON.stringify({medianMs:data.medianMs,p95Ms:data.p95Ms,draws:data.perf.draws,fleetTriangles:data.fleetTriangles}));
  }
  // Same real scene lighting and renderer; isolate the fleet for close-up inspection.
  await page.evaluate(()=>{const a=__NZ_TEST,T=a.THREE;a.controls.minDistance=.1;for(const o of a.scene.children)if(!o.isLight&&o.name!=='Anatomy detailed campus vehicles')o.visible=false;
   a.camera.layers.set(29);a.scene.traverse(o=>{if(o.isLight)o.layers.enable(29);});a.scene.getObjectByName('Anatomy detailed campus vehicles').traverse(o=>o.layers.set(29));
   const floor=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshStandardMaterial({color:0xdfe7e6,roughness:.95}));floor.name='Vehicle inspection ground';floor.layers.set(29);floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;a.scene.add(floor);
   a.scene.getObjectByName('Anatomy detailed campus vehicles').traverse(o=>{if(o.isInstancedMesh)o.userData.savedMatrices=o.instanceMatrix.array.slice();});
  });
  const closeups=[];
  for(const kind of ['model3','yu7','li','ice','bus','truck','fire','tanker']){
   const closeup=await page.evaluate(async kind=>{
    const a=__NZ_TEST,T=a.THREE,v=NZ_VEHICLES.audit().vehicles.find(v=>v.kind===kind),s=NZ_VEHICLE_MODEL.specs[kind];const target=new T.Vector3(...v.p).add(new T.Vector3(0,s.h*.46,0)),offset=new T.Vector3(s.l*.82,s.l*.46,s.l*.96).applyAxisAngle(new T.Vector3(0,1,0),v.heading);
    const floor=a.scene.getObjectByName('Vehicle inspection ground');floor.position.set(v.p[0],v.p[1]-.003,v.p[2]);floor.scale.set(s.l*2,s.l*2,1);
    const fleet=a.scene.getObjectByName('Anatomy detailed campus vehicles');fleet.traverse(o=>{if(o.isInstancedMesh){const saved=o.userData.savedMatrices;for(let i=0;i<o.count;i++){const m=new T.Matrix4().fromArray(saved,i*16);if(o.userData.vehicleIds[i]!==v.id)m.scale(new T.Vector3(0,0,0));o.setMatrixAt(i,m);}o.instanceMatrix.needsUpdate=true;o.computeBoundingSphere();}else if(o.isMesh){const ranges=o.userData.vehicleRanges?.filter(r=>r.id===v.id);o.visible=!!ranges?.length;if(ranges?.length)o.geometry.setDrawRange(ranges[0].start*3,ranges.reduce((n,r)=>n+r.count*3,0));}});
    a.cancelCamera();a.camera.position.copy(target).add(offset);a.controls.target.copy(target);a.controls.update();
    for(let i=0;i<35;i++)await new Promise(requestAnimationFrame);
    const ray=new T.Raycaster(a.camera.position.clone(),target.clone().sub(a.camera.position).normalize());ray.layers.set(29);fleet.updateMatrixWorld(true);const hit=ray.intersectObject(fleet,true).find(h=>h.object.userData.vehicleIds?.[h.instanceId]===v.id);const picked=!!hit&&NZ_VEHICLES.inspectHit(hit)&&document.querySelector('#vehicleContent').textContent.includes(v.plate);NZ_VEHICLES.hide();
    // Closing the existing info card restores the campus orbit limit. Reset it
    // only in this inspection fixture so the screenshot keeps the measured pose.
    a.controls.minDistance=.1;a.camera.position.copy(target).add(offset);a.controls.target.copy(target);a.controls.update();
    return {kind,id:v.id,parts:NZ_VEHICLE_MODEL.create(kind).parts.length,picked,position:a.camera.position.toArray(),target:target.toArray(),...(!picked?{ray:ray.ray.direction.toArray(),batches:fleet.children.flatMap(o=>o.children||[]).filter(o=>o.userData.vehicleIds?.includes(v.id)).map(o=>({name:o.name,layer:o.layers.mask,count:o.count,visible:o.visible,bounds:o.geometry.boundingBox?.toJSON?.()}))}:{})};
   },kind);assert(closeup.picked,JSON.stringify(closeup));closeups.push(closeup);await page.screenshot({path:path.join(out,label+'-'+kind+'.jpg'),type:'jpeg',quality:95});
  }
  const interactions=await page.evaluate(()=>{const a=__NZ_TEST,s=JSON.stringify(a.S),audit=NZ_VEHICLES.audit(),cards=[];for(const v of audit.vehicles){NZ_VEHICLES.select(v.id);cards.push(document.querySelector('#vehicleContent').textContent.includes(v.plate));}NZ_VEHICLES.hide();return {cards:cards.every(Boolean),statePreserved:s===JSON.stringify(a.S),ends:audit.routes.every(r=>JSON.stringify(r.points.at(-1))===JSON.stringify(r.endpoint)),backend:NZ_GPU.backend};});
  assert(interactions.cards&&interactions.ends&&interactions.statePreserved);assert.equal(interactions.backend,'WebGPU');assert.deepEqual(errors,[]);
  if(!baseline){const before=JSON.parse(fs.readFileSync(path.join(out,'before.json'),'utf8'));assert.deepEqual(audit.vehicles,before.audit.vehicles,'positions, connections and plates');assert.deepEqual(audit.bays,before.audit.bays);assert.deepEqual(audit.routes,before.audit.routes);}
  fs.writeFileSync(path.join(out,label+'.json'),JSON.stringify({version:await page.evaluate(()=>NZ_PROJECT_VERSION.version),viewport:[1440,810],dpr:1,quality:'high',audit,samples:samples.length?samples:JSON.parse(fs.readFileSync(path.join(out,label+'.json'),'utf8')).samples,closeups,interactions,errors},null,2)+'\n');
  console.log('PASS fleet inventory, charge endpoints, selection and immutable simulation state');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
