'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-gpu','--use-angle=d3d11']});
 try{
  const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:2,offline:true}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());else if(message.text().startsWith('TOUR '))console.log(message.text());});
  await page.goto(pathToFileURL(path.join(__dirname,'dist/多园区-v20-r187-充电站写实.html')).href);
  await page.waitForFunction(()=>window.NZ_PERF?.status().ready&&NZ_RENDER_POLISH.status().mapsReady);
  await page.click('#segQuality [data-q="high"]');
  const result=await page.evaluate(async()=>{
   await NZ_RECEPTION.start();const start=performance.now(),groups={},samples=[];let previous=await new Promise(requestAnimationFrame),nextLog=15,qualityStayedHigh=true,buildingVisited=false,mainWasSuspended=false;
   while(NZ_RECEPTION.state().active&&performance.now()-start<230000){
    const now=await new Promise(requestAnimationFrame),state=NZ_RECEPTION.state(),key=(state.inside?'building/':'campus/')+state.cue;
    qualityStayedHigh&&=__NZ_TEST.S.quality==='high';buildingVisited||=state.inside;mainWasSuspended||=NZ_PERF.status().suspended;
    const dt=now-previous;previous=now;(groups[key]||= []).push(dt);samples.push(dt);
    if((now-start)/1000>=nextLog){console.log('TOUR '+Math.round((now-start)/1000)+'s, chapter '+state.cue+', inside '+state.inside+', budget '+NZ_PERF.status().level);nextLog+=15;}
   }
   const summary=values=>{values.sort((a,b)=>a-b);return {frames:values.length,medianMs:+values[Math.floor(values.length*.5)].toFixed(2),p95Ms:+values[Math.floor(values.length*.95)].toFixed(2),maxMs:+values.at(-1).toFixed(2),over50:values.filter(value=>value>50).length};};
   return {wallSeconds:(performance.now()-start)/1000,final:NZ_RECEPTION.state(),qualityStayedHigh,buildingVisited,mainWasSuspended,
    overall:summary(samples),chapters:Object.fromEntries(Object.entries(groups).map(([key,values])=>[key,summary(values)])),budget:NZ_PERF.status()};
  });
  fs.writeFileSync(path.join(__dirname,'evidence/tour-performance.json'),JSON.stringify({viewport:[1920,1080],deviceScaleFactor:2,result,errors},null,2)+'\n');
  assert(!result.final.active&&result.final.time>=179.9);assert(result.qualityStayedHigh&&result.buildingVisited&&result.mainWasSuspended&&!result.final.buildingFailed);
  assert(result.overall.p95Ms<33.5);assert.deepEqual(errors,[]);
  console.log('PASS complete 180-second reception, building segment, restored campus and high quality; P95',result.overall.p95Ms);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
