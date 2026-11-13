'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const out=path.join(__dirname,'evidence');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-gpu','--use-angle=d3d11']});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await page.route(/^https?:/,r=>{external.push(r.request().url());return r.abort();});
 await page.goto(pathToFileURL(path.resolve(__dirname,'../webgpu/dist/多园区-v20-r187-WebGPU.html')).href);await page.waitForFunction(()=>NZ_GPU.ready,null,{timeout:90000});await page.click('#segQuality [data-q="high"]');
 await page.click('#btnTour');await page.getByRole('button',{name:'开始园区导览',exact:true}).click();
 const waitReady=()=>page.waitForFunction(()=>NZ_TOUR_AUDIO.ready()&&NZ_TOUR_AUDIO.state().decoded===28);
 await waitReady();await page.waitForFunction(()=>NZ_TOUR_AUDIO.state().peak>.001);assert(await page.locator('#tourVoice').isVisible());
 const first=await page.evaluate(()=>({audio:NZ_TOUR_AUDIO.state(),tour:__NZ_TEST.tourState()}));
 await page.click('#tourPause');const t=await page.evaluate(()=>__NZ_TEST.tourState().t);await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>__NZ_TEST.tourState().t),t);assert.equal(await page.evaluate(()=>NZ_TOUR_AUDIO.state().playing),false);await page.click('#tourPause');await page.waitForFunction(()=>NZ_TOUR_AUDIO.state().playing);
 await page.click('#tourVoice');assert(await page.evaluate(()=>NZ_TOUR_AUDIO.state().muted));assert(!await page.evaluate(()=>NZ_TOUR_AUDIO.state().playing));const mutedAt=await page.evaluate(()=>__NZ_TEST.tourState().t);await page.waitForTimeout(500);assert(await page.evaluate(t=>__NZ_TEST.tourState().t>t,mutedAt));await page.click('#tourVoice');await page.waitForFunction(()=>NZ_TOUR_AUDIO.state().playing);
 await page.evaluate(()=>{__NZ_TEST.tourJump(6);__NZ_TEST.tourSeek(__NZ_TEST.TOUR[6].segments.at(-1).start+1);});await page.waitForFunction(()=>NZ_TOUR_AUDIO.state().current==='full-refine-6-3');assert(Math.abs(await page.evaluate(()=>NZ_TOUR_AUDIO.state().position)-1)<.5);await page.screenshot({path:path.join(out,'voice-charging.jpg'),type:'jpeg',quality:90});
 // Reveal/close transitions must be silent. The real child timeline then drives room speech.
 await page.evaluate(()=>{const a=__NZ_TEST;a.tourJump(3);a.tourSeek(a.DC_SEG.at-.02);a.tourTick(.04);});await page.waitForFunction(()=>__NZ_TEST.tourState().dcWait);assert(!await page.evaluate(()=>NZ_TOUR_AUDIO.state().playing));await page.waitForFunction(()=>GOBI_DCDT.transitionState().phase==='visible'&&NZ_TOUR_AUDIO.state().current==='full-room-approved-01',null,{timeout:60000});
 await page.evaluate(()=>__NZ_TEST.toggleTourPause());const inside=await page.evaluate(()=>__NZ_TEST.tourState().insideTime);await page.waitForTimeout(500);assert(Math.abs(await page.evaluate(()=>__NZ_TEST.tourState().insideTime)-inside)<.06);assert(!await page.evaluate(()=>NZ_TOUR_AUDIO.state().playing));await page.evaluate(()=>__NZ_TEST.toggleTourPause());await page.waitForFunction(()=>NZ_TOUR_AUDIO.state().playing);await page.screenshot({path:path.join(out,'voice-building.jpg'),type:'jpeg',quality:90});
 await page.evaluate(()=>document.getElementById('dcdtFrame').contentWindow.NZ_BUILDING_TOUR.setPlaying(false));await page.waitForTimeout(250);assert(!await page.evaluate(()=>NZ_TOUR_AUDIO.state().playing));assert(await page.evaluate(()=>__NZ_TEST.tourState().paused));await page.evaluate(()=>document.getElementById('dcdtFrame').contentWindow.NZ_BUILDING_TOUR.setPlaying(true));await page.waitForFunction(()=>NZ_TOUR_AUDIO.state().playing);assert(!await page.evaluate(()=>__NZ_TEST.tourState().paused));
 await page.evaluate(()=>__NZ_TEST.exitTour());assert(!await page.evaluate(()=>NZ_TOUR_AUDIO.state().active||NZ_TOUR_AUDIO.state().playing));await page.evaluate(()=>NZ_RECEPTION.start());await page.waitForTimeout(500);assert(!await page.evaluate(()=>NZ_TOUR_AUDIO.state().active||NZ_TOUR_AUDIO.state().playing));await page.evaluate(()=>NZ_RECEPTION.stop());
 const seen=new Set(),signal=new Set(),samples=[];
 if(process.argv.includes('--full-play')){
  await page.evaluate(()=>__NZ_TEST.startTour());await waitReady();const started=Date.now();
  while(await page.evaluate(()=>__NZ_TEST.tourState().active)){
   assert(Date.now()-started<430000,'Full narration timeout');const s=await page.evaluate(()=>({audio:NZ_TOUR_AUDIO.state(),caption:document.getElementById('tourBar').dataset.caption,inside:__NZ_TEST.tourState().dcWait,transition:GOBI_DCDT.transitionState().phase,time:document.getElementById('tourTime').textContent}));
   if(s.audio.current){seen.add(s.audio.current);assert.equal(s.audio.current,s.caption,'Voice/subtitle mismatch');if(s.audio.peak>.001)signal.add(s.audio.current);}
   if(s.inside&&s.transition!=='visible')assert(!s.audio.playing,'Speech during room loading');
   samples.push({...s,wall:(Date.now()-started)/1000});await page.waitForTimeout(200);
  }
  assert.equal(seen.size,28);assert.equal(signal.size,28);assert(!await page.evaluate(()=>NZ_TOUR_AUDIO.state().active||NZ_TOUR_AUDIO.state().playing));assert(await page.locator('#drawer').isVisible());assert(!await page.locator('#visitorEnding').isVisible());await page.screenshot({path:path.join(out,'voice-finished.jpg'),type:'jpeg',quality:90});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);fs.writeFileSync(path.join(out,process.argv.includes('--full-play')?'audio-playback.json':'audio-check.json'),JSON.stringify({first,fullPlay:process.argv.includes('--full-play'),heardClips:[...signal],seenClips:[...seen],pause:true,mute:true,jump:true,roomLoading:true,roomPause:true,roomNativePause:true,exit:true,quickSilent:true,errors,external,samples},null,2));console.log('PASS full-tour voice playback, pause, mute, seek, room, exit and quick silence'+(seen.size?' · '+seen.size+' clips with output signal':''));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
