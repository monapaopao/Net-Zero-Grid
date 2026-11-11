'use strict';
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const root=path.resolve(__dirname,'../..'),files={before:path.join(root,'tmp/vehicle-baseline/v21.1.1.html'),after:path.join(root,'visual-upgrade/webgpu/dist/多园区-v20-r187-WebGPU.html')};
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-gpu','--use-angle=d3d11']});const runs=[];
 try{for(const label of ['before','after','after','before']){
  const page=await browser.newPage({viewport:{width:1440,height:810},deviceScaleFactor:1});await page.goto(pathToFileURL(files[label]).href);await page.waitForFunction(()=>window.NZ_GPU?.ready,{},{timeout:90000});
  await page.evaluate(()=>{const a=__NZ_TEST;a.S.running=false;a.S.lightPreset='day-lab';document.querySelector('#segQuality [data-q="high"]').click();a.controls.autoRotate=false;a.controls.enableDamping=false;a.cancelCamera();});
  await page.addStyleTag({content:'body *{visibility:hidden!important} #gridCanvas{visibility:visible!important} #canvasWrap,#sceneFrame{position:fixed!important;inset:0!important;border:0!important} #labels3d,#vignette{display:none!important}'});await page.evaluate(()=>__NZ_TEST.resize());
  const samples=[];for(const view of ['campus','charge','parking']){
   const sample=await page.evaluate(async view=>{const a=__NZ_TEST,poses={campus:a.TOUR_HOME,charge:{pos:[91,6.1,114],tgt:[64,2,101]},parking:{pos:[75,7,147],tgt:[55,1,131]}};a.cancelCamera();a.camera.position.fromArray(poses[view].pos);a.controls.target.fromArray(poses[view].tgt);a.controls.update();for(let i=0;i<240;i++)await new Promise(requestAnimationFrame);
    const t=[];for(let i=0;i<301;i++)t.push(await new Promise(requestAnimationFrame));const d=t.slice(1).map((v,i)=>v-t[i]).sort((a,b)=>a-b),perf=a.perf();return {view,medianMs:d[150],p95Ms:d[285],draws:perf.draws,triangles:perf.triangles,renderMs:perf.renderMs,quality:perf.quality,pixelRatio:perf.pixelRatio,backend:NZ_GPU.backend};},view);samples.push(sample);console.log(label,view,JSON.stringify(sample));
  }runs.push({label,samples});await page.close();
 }
 const summary=['campus','charge','parking'].map(view=>{const result={view};for(const label of ['before','after']){const a=runs.filter(r=>r.label===label).map(r=>r.samples.find(s=>s.view===view));result[label]={medianMs:a.reduce((n,s)=>n+s.medianMs,0)/a.length,p95Ms:a.reduce((n,s)=>n+s.p95Ms,0)/a.length,draws:a[0].draws,triangles:a[0].triangles};}result.drawChange=result.after.draws-result.before.draws;result.triangleChange=result.after.triangles-result.before.triangles;return result;});
 fs.writeFileSync(path.join(__dirname,'evidence/performance.json'),JSON.stringify({viewport:[1440,810],dpr:1,quality:'high',order:['before','after','after','before'],warmupFrames:240,sampleFrames:300,runs,summary,note:'RAF intervals include browser scheduling and vsync; local headless Chrome measurements, not an all-device FPS guarantee.'},null,2)+'\n');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
