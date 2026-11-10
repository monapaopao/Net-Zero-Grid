'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const file=path.join(__dirname,'dist/多园区-v20-r187-充电站写实.html');
const evidence=path.join(__dirname,'evidence');
const poses=[
  {name:'station-day',pos:[110,28,145],tgt:[55,2,99]},
  {name:'entrance-day',pos:[91,6.1,114],tgt:[64,2,101]},
  {name:'entrance-night',pos:[91,6.1,114],tgt:[64,2,101],night:true},
  {name:'factory-day',pos:[345,51,157],tgt:[281,1.7,108]},
  {name:'overview-day',home:true}
];
async function measure(page,pose){
  return page.evaluate(async pose=>{
    const a=__NZ_TEST;a.S.running=true;a.S.lightPreset=pose.night?'night':'day-lab';a.cancelCamera();a.controls.autoRotate=false;a.controls.enableDamping=false;
    const p=pose.home?a.TOUR_HOME.pos:pose.pos,t=pose.home?a.TOUR_HOME.tgt:pose.tgt;
    a.camera.position.fromArray(p);a.controls.target.fromArray(t);a.controls.update();
    await new Promise(resolve=>setTimeout(resolve,2400));
    const times=[],draws=[],triangles=[];let previous=await new Promise(requestAnimationFrame),start=previous;
    while(previous-start<5500){
      const progress=(previous-start)/5500;a.camera.position.x=p[0]+Math.sin(progress*Math.PI)*4;a.controls.update();
      const now=await new Promise(requestAnimationFrame);times.push(now-previous);previous=now;const perf=a.perf();draws.push(perf.draws);triangles.push(perf.triangles);
    }
    times.sort((a,b)=>a-b);draws.sort((a,b)=>a-b);triangles.sort((a,b)=>a-b);
    const percentile=(values,p)=>+values[Math.floor(values.length*p)].toFixed(2);
    const gl=a.renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
    return {name:pose.name,medianMs:percentile(times,.5),p95Ms:percentile(times,.95),over50:times.filter(time=>time>50).length,frames:times.length,
      draws:percentile(draws,.5),triangles:percentile(triangles,.5),canvas:[a.renderer.domElement.width,a.renderer.domElement.height],quality:a.S.quality,
      budget:window.NZ_PERF?.status(),assets:NZ_PHOTO_ASSETS.audit(),renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):null};
  },pose);
}
(async()=>{
 const container=fs.readFileSync(path.join(__dirname,'charging-station.glb'));
 const graph=JSON.parse(container.subarray(20,20+container.readUInt32LE(12))),lodTriangles={near:0,mid:0,far:0};
 for(const node of graph.nodes){
  if(node.mesh===undefined||!node.name.startsWith('vehicle-'))continue;
  const level=node.name.includes('-mid__')?'mid':node.name.includes('-far__')?'far':'near';
  for(const primitive of graph.meshes[node.mesh].primitives)lodTriangles[level]+=graph.accessors[primitive.indices].count/3;
 }
 assert(lodTriangles.mid<lodTriangles.near*.30&&lodTriangles.far<lodTriangles.near*.04,'GLB must contain reduced LOD geometry, not unapplied modifiers');
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-gpu','--use-angle=d3d11']});
 const records=[];
 try{
  for(const viewport of [{width:1920,height:1080,dpr:2},{width:3840,height:2160,dpr:1}]){
   const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},deviceScaleFactor:viewport.dpr,offline:true}),page=await context.newPage(),errors=[],external=[];
   page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});page.on('request',request=>{if(/^https?:/.test(request.url()))external.push(request.url());});
   const started=Date.now();await page.goto(pathToFileURL(file).href);await page.waitForFunction(()=>window.NZ_PERF?.status().ready&&NZ_RENDER_POLISH.status().mapsReady);
   const readyMs=Date.now()-started;await page.click('#segQuality [data-q="high"]');
   const shots=[];
   for(const pose of poses){
    const shot=await measure(page,pose);shots.push(shot);
    assert.equal(shot.quality,'high');assert(shot.canvas[0]*shot.canvas[1]<=1860000);
    assert(shot.p95Ms<=33.5,`${viewport.width} ${pose.name}: P95 ${shot.p95Ms} ms`);
    if(pose.name==='overview-day')assert.equal(shot.assets.lod.far,19);
    if(pose.name==='entrance-day'){assert(shot.assets.lod.near>0);assert(shot.budget.visibleInstances<shot.budget.sourceInstances);}
    await page.screenshot({path:path.join(evidence,`performance-${viewport.width}-${pose.name}.jpg`),type:'jpeg',quality:90});
    console.log(viewport.width,pose.name,'median',shot.medianMs,'P95',shot.p95Ms,'draws',shot.draws,'triangles',shot.triangles,'LOD',JSON.stringify(shot.assets.lod));
   }
   assert.deepEqual(errors,[]);assert.deepEqual(external,[]);records.push({viewport,readyMs,shots,errors,external});await context.close();
  }
  // A real main-thread scheduling delay exercises the feedback loop, independently of its thresholds.
  const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:2});await page.goto(pathToFileURL(file).href);await page.waitForFunction(()=>window.NZ_PERF?.status().ready);await page.click('#segQuality [data-q="high"]');
  const adaptive=await page.evaluate(async()=>{
   __NZ_TEST.controls.autoRotate=false;await new Promise(resolve=>setTimeout(resolve,3000));
   const initial=NZ_PERF.status();let busy=true;
   const pressure=()=>{if(!busy)return;const until=performance.now()+38;while(performance.now()<until){}requestAnimationFrame(pressure);};requestAnimationFrame(pressure);
   await new Promise(resolve=>setTimeout(resolve,6500));busy=false;const pressured=NZ_PERF.status();
   const deadline=performance.now()+28000;
   while(performance.now()<deadline&&NZ_PERF.status().level>=pressured.level)await new Promise(resolve=>setTimeout(resolve,200));
   const recovered=NZ_PERF.status();
   return {initial,pressured,recovered,quality:__NZ_TEST.S.quality,syntheticPressureMs:38};
  });
  fs.writeFileSync(path.join(evidence,'performance-checks.json'),JSON.stringify({capturedAt:new Date().toISOString(),htmlBytes:fs.statSync(file).size,records,adaptive},null,2)+'\n');
  assert.equal(adaptive.quality,'high');assert(adaptive.pressured.level>adaptive.initial.level);assert(adaptive.recovered.level<adaptive.pressured.level);await page.close();
  fs.writeFileSync(path.join(evidence,'performance-checks.json'),JSON.stringify({capturedAt:new Date().toISOString(),htmlBytes:fs.statSync(file).size,records,adaptive},null,2)+'\n');
  console.log('PASS high quality at high DPI and 4K, regional detail, LOD and adaptive recovery');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
