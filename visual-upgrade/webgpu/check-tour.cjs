'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-gpu','--use-angle=d3d11']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:810}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());else if(message.text().startsWith('TOUR '))console.log(message.text());});
  await page.goto(pathToFileURL(path.join(__dirname,'dist/多园区-v20-r187-WebGPU.html')).href);
  await page.waitForFunction(()=>window.NZ_GPU?.ready,null,{timeout:90000});await page.click('#segQuality [data-q="high"]');
  const result=await page.evaluate(async()=>{
   await NZ_RECEPTION.start();const start=performance.now(),samples=[],groups={};let previous=await new Promise(requestAnimationFrame),nextLog=30,buildingVisited=false,qualityStayedHigh=true;
   while(NZ_RECEPTION.state().active&&performance.now()-start<(NZ_RECEPTION.model.duration+60)*1000){
    const now=await new Promise(requestAnimationFrame),state=NZ_RECEPTION.state(),key=(state.inside?'building/':'campus/')+state.cue;
    const dt=now-previous;previous=now;samples.push(dt);(groups[key]||=[]).push(dt);buildingVisited||=state.inside;qualityStayedHigh&&=__NZ_TEST.S.quality==='high';
    if((now-start)/1000>=nextLog){console.log('TOUR '+Math.round((now-start)/1000)+'s · '+state.cue+' · '+NZ_GPU.backend);nextLog+=30;}
   }
   const summary=values=>{values.sort((a,b)=>a-b);return {frames:values.length,medianMs:+values[Math.floor(values.length*.5)].toFixed(2),p95Ms:+values[Math.floor(values.length*.95)].toFixed(2),maxMs:+values.at(-1).toFixed(2),over50:values.filter(value=>value>50).length};};
   return {backend:NZ_GPU.backend,lost:NZ_GPU.lost,wallSeconds:(performance.now()-start)/1000,qualityStayedHigh,buildingVisited,final:NZ_RECEPTION.state(),
     overall:summary(samples),chapters:Object.fromEntries(Object.entries(groups).map(([key,values])=>[key,summary(values)]))};
  });
  fs.writeFileSync(path.join(__dirname,'evidence/tour-check.json'),JSON.stringify({viewport:[1440,810],deviceScaleFactor:1,result,errors},null,2)+'\n');
  assert.equal(result.backend,'WebGPU');assert(!result.lost&&!result.final.active&&result.final.time>=result.final.duration-.1&&result.qualityStayedHigh&&result.buildingVisited&&!result.final.buildingFailed);assert.deepEqual(errors,[]);
  console.log('PASS native WebGPU complete reception, building and restored campus; P95',result.overall.p95Ms);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
