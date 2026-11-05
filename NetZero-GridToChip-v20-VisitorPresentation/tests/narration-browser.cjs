'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),{spawn}=require('child_process');
const ROOT=path.join(__dirname,'..'),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
class CDP{
  constructor(ws){this.ws=ws;this.id=0;this.pending=new Map();this.errors=[];this.requests=[];ws.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id&&this.pending.has(message.id)){const job=this.pending.get(message.id);this.pending.delete(message.id);message.error?job.reject(message.error):job.resolve(message.result);}if(message.method==='Runtime.exceptionThrown')this.errors.push(message.params.exceptionDetails);if(message.method==='Log.entryAdded'&&message.params.entry.level==='error')this.errors.push(message.params.entry);if(message.method==='Network.requestWillBeSent')this.requests.push(message.params.request.url);});}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}));});}
  async eval(expression){const result=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;}
}
async function main(){
 const browser=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync),profile=fs.mkdtempSync(path.join(os.tmpdir(),'nz-v17-tour-'));
 const child=spawn(browser,['--headless=new','--remote-debugging-port=0','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-background-timer-throttling','--disable-renderer-backgrounding','--window-size=1920,1080','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
 let cdp;const report={checks:{},samples:[]},check=(n,v)=>{report.checks[n]=!!v;console.log((v?'PASS ':'FAIL ')+n);};
 try{
  const active=path.join(profile,'DevToolsActivePort');for(let i=0;i<150&&!fs.existsSync(active);i++)await sleep(200);const port=fs.readFileSync(active,'utf8').split('\n')[0],tabs=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json(),ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));cdp=new CDP(ws);for(const d of ['Runtime','Log','Network','Page'])await cdp.send(d+'.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});await cdp.send('Page.navigate',{url:'file:///'+path.join(ROOT,'dist/Net-Zero-grid-premium.html').replace(/\\/g,'/')});let ready=false;for(let i=0;i<200;i++){if(await cdp.eval('!!window.__NZ_TEST')){ready=true;break;}await sleep(150);}if(!ready)throw Error('Scene not ready '+JSON.stringify(cdp.errors));
  const shot=async n=>{if(!['tour-overview','tour-building'].includes(n))return;const s=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(ROOT,'screenshots/v19-pacing-'+n+'.png'),Buffer.from(s.data,'base64'));};
  await cdp.eval(`(()=>{const a=window.__NZ_TEST;a.S.running=false;a.S.lightPreset='day-lab';a.cancelCamera();a.controls.enableDamping=false;a.startTour();return true;})()`);await sleep(1500);
  check('newVersion',await cdp.eval("document.title.includes('v19')"));
  report.opening=await cdp.eval('({position:window.__NZ_TEST.camera.position.toArray(),target:window.__NZ_TEST.controls.target.toArray(),home:window.__NZ_TEST.TOUR_HOME,chapter:window.__NZ_TEST.tourState().chap})');check('panoramaHeldDuringIntro',report.opening.chapter===0&&Math.hypot(...report.opening.position.map((v,i)=>v-report.opening.home.pos[i]))<1e-7&&Math.hypot(...report.opening.target.map((v,i)=>v-report.opening.home.tgt[i]))<1e-7);
  await cdp.eval('window.__NZ_TEST.toggleTourPause()');await shot('tour-overview');const before=await cdp.eval('({time:document.getElementById("tourTime").textContent,text:document.getElementById("tourText").textContent})');await sleep(350);check('pauseFreezesCaptionClock',JSON.stringify(before)===JSON.stringify(await cdp.eval('({time:document.getElementById("tourTime").textContent,text:document.getElementById("tourText").textContent})')));
  // Exercise each authoring cue while the live tour is paused, including both edges of every camera segment.
  report.samples=await cdp.eval(`(()=>{const a=window.__NZ_TEST,out=[];for(let i=0;i<a.TOUR.length;i++){a.tourJump(i);for(const c of a.TOUR[i].segments){a.tourSeek((c.start+c.end)/2);out.push({chapter:i,cue:c.id,shown:document.getElementById('tourBar').dataset.cue,title:document.getElementById('tourTitle').textContent,text:document.getElementById('tourText').textContent,expected:c.text,equipment:document.getElementById('tourEquipment').textContent,camera:a.camera.position.toArray()});}}return out;})()`);
  check('everyExteriorCueReached',report.samples.every(s=>s.cue===s.shown&&s.text.length>0&&s.camera.every(Number.isFinite)));
  check('fullParagraphEveryCue',report.samples.every(s=>s.text===s.expected));
  check('windTitleDecoupled',report.samples.find(s=>s.cue==='wind-product-name').title==='风力发电与光伏电源'&&report.samples.find(s=>s.cue==='wind-product-name').equipment.includes('干式变压器'));
  check('solarHasOwnCamera',JSON.stringify(report.samples.find(s=>s.cue==='solar-connect').camera)!==JSON.stringify(report.samples.find(s=>s.cue==='wind-product-material').camera));
  const selectCue=async(i,id)=>{await cdp.eval(`(()=>{const a=window.__NZ_TEST;a.tourJump(${i});const s=a.TOUR[${i}].segments.find(s=>s.id==='${id}');a.tourSeek((s.start+s.end)/2);return true;})()`);await sleep(160);};
  for(const [i,id]of [[1,'wind-product-material'],[1,'solar-connect'],[2,'line-weather'],[3,'dc-scheme'],[4,'zinc-efficiency'],[4,'chemical-corrosion'],[6,'charge-return']]){await selectCue(i,id);await shot(id);}
  check('zincInteriorShown',await cdp.eval(`(()=>{const a=window.__NZ_TEST;a.tourJump(4);a.tourSeek(a.TOUR[4].segments.find(s=>s.id==='zinc-efficiency').start+1);return window.NZ_LAYOUT.mode()==='power';})()`));await selectCue(6,'charge-return');
  check('compactEquipmentHint',await cdp.eval("document.getElementById('tourEquipment').children.length===0&&!document.querySelector('#tourBar .tour-chain,#tourBar .tour-traits,#tourBar .tour-charge-diagram')"));
  check('storageExportNotVehicle',await cdp.eval("document.getElementById('tourText').textContent.includes('回馈电网')&&document.getElementById('tourText').textContent.includes('车辆在此作为充电负荷')&&document.getElementById('tourEquipment').textContent.includes('固定储能 ↔ 电网')"));
  await selectCue(2,'line-weather');check('conductorHighlightApplied',await cdp.eval(`(()=>{let n=0;window.__NZ_TEST.scene.getObjectByName('Physical connection trans').traverse(o=>{if(o.isMesh&&o.material.emissive&&o.material.emissive.getHex()===0x936019)n++;});return n>0;})()`));
  // Observe actual first-wind motion in real time, rather than only evaluating path formulas.
  await cdp.eval(`(()=>{const a=window.__NZ_TEST;a.tourJump(1);window._wind17=[];window._wind17Sample=true;const sample=()=>{if(!window._wind17Sample)return;window._wind17.push({t:a.tourState().t,pos:a.camera.position.toArray(),tgt:a.controls.target.toArray()});requestAnimationFrame(sample);};sample();a.toggleTourPause();return true;})()`);await sleep(5500);await cdp.eval('window.__NZ_TEST.toggleTourPause();window._wind17Sample=false');report.windFrames=await cdp.eval('window._wind17');
  const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));check('fiveSecondWindMove',report.windFrames.some(f=>f.t>=4.9)&&dist(report.windFrames.find(f=>f.t>2).pos,report.windFrames.at(-1).pos)>5);
  const unit=f=>{const d=f.pos.map((v,i)=>v-f.tgt[i]),n=Math.hypot(...d);return d.map(v=>v/n);},dir=unit(report.windFrames[0]);check('fixedWindHeading',report.windFrames.every(f=>dist(unit(f),dir)<1e-7));
  report.cameraBoundaries=await cdp.eval(`(()=>{const a=window.__NZ_TEST,out=[];for(let i=0;i<a.TOUR.length;i++){const ss=a.TOUR[i].segments;for(let j=1;j<ss.length;j++){const t=ss[j].start,p=a.narratedPoseAt(i,t-1e-6),q=a.narratedPoseAt(i,t);out.push({position:Math.hypot(...p.pos.map((v,k)=>v-q.pos[k])),target:Math.hypot(...p.tgt.map((v,k)=>v-q.tgt[k]))});}}return out;})()`);check('noInternalCameraTeleports',report.cameraBoundaries.every(r=>r.position<.001&&r.target<.001));
  // Building remains in chapter 04; its timeline and the return handoff share the global caption clock.
  await cdp.eval(`(()=>{const a=window.__NZ_TEST;a.tourJump(3);a.tourSeek(a.DC_SEG.at-.05);a.toggleTourPause();return true;})()`);for(let i=0;i<120;i++){if(await cdp.eval("window.GOBI_DCDT.transitionState().phase==='visible'"))break;await sleep(100);}await cdp.eval('window.__NZ_TEST.toggleTourPause()');
  check('buildingPreparedBeforeVisible',await cdp.eval('window.__NZ_TEST.tourState().dcWait&&document.getElementById("dcdtFrame").contentWindow.NZ_BUILDING_TOUR.state().frames>=3'));
  report.building=[];
  const stages=await cdp.eval('window.NZ_TOUR_SCRIPT.building.filter(s=>s.start<window.__NZ_TEST.DC_SEG.to).map(s=>({time:(s.start+s.end)/2,text:s.text,id:s.id}))');
  for(const [width,height,scale]of [[1920,1080,1],[1366,768,1.25],[900,700,1],[390,844,1]]){
    await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});
    await cdp.eval(`document.getElementById('tourText').style.fontSize='${width<500?12*scale:14*scale}px'`);
    const batch=[];
    for(const stage of stages){
      await cdp.eval('window.GOBI_DCDT.setTimelineIn('+stage.time+')');await sleep(130);
      batch.push(await cdp.eval(`(()=>{const d=document.getElementById('dcdt').getBoundingClientRect(),t=document.getElementById('tourBar').getBoundingClientRect(),f=document.getElementById('dcdtFrame').getBoundingClientRect(),a=document.getElementById('tourText');return {cue:document.getElementById('tourBar').dataset.cue,text:a.textContent,chapter:document.getElementById('tourChap').textContent,clock:document.getElementById('tourTime').textContent,gap:t.top-d.bottom,frameGap:t.top-f.bottom,frameHeight:f.height,top:d.top,captionTop:t.top,textClipped:a.scrollHeight>a.clientHeight+1};})()`));
    }
    report.building.push({width,height,scale,stages:batch});
    check('fullBuildingParagraphs'+width,batch.every((s,i)=>s.cue===stages[i].id&&s.text===stages[i].text&&s.chapter==='04 / 08'&&!s.textClipped));
    check('buildingNeverOverlapsCaption'+width,batch.every(s=>s.gap>=12&&s.frameGap>=12&&s.top>=60&&s.frameHeight>100&&s.captionTop>0));
    if(width===1920)await shot('tour-building');
    await shot('building-layout-'+width);
  }
  await cdp.eval("document.getElementById('tourText').style.fontSize=''");
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
  await cdp.eval('window.GOBI_DCDT.setTimelineIn(window.__NZ_TEST.DC_SEG.to)');await sleep(1200);check('returnTransitionBeforeNextChapter',await cdp.eval("window.__NZ_TEST.tourState().chap===3&&window.__NZ_TEST.tourState().dcDone&&!window.__NZ_TEST.tourState().dcWait&&document.getElementById('tourBar').dataset.cue==='dc-next'"));
  check('buildingTimeIncluded',await cdp.eval("document.getElementById('tourTime').textContent.startsWith(window.NZ_TOUR_NARRATIVE.clock(window.__NZ_TEST.NARRATION.insert.globalStart+window.__NZ_TEST.NARRATION.insert.duration))"));
  await cdp.eval(`(()=>{const a=window.__NZ_TEST;a.tourSeek(a.TOUR[3].dur-.02);a.toggleTourPause();return true;})()`);await sleep(200);await cdp.eval('window.__NZ_TEST.toggleTourPause()');check('continuesIntoChemical',await cdp.eval('window.__NZ_TEST.tourState().chap===4'));
  for(const [width,height]of [[1366,768],[900,700],[390,844]]){await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});await selectCue(6,'charge-return');await sleep(250);const r=await cdp.eval("(()=>{const r=document.getElementById('tourBar').getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,overflow:document.documentElement.scrollWidth>innerWidth};})()");check('captionFits'+width,r.x>=0&&r.y>=0&&r.right<=width+1&&r.bottom<=height&&!r.overflow);await shot('tour-layout-'+width);}
  await cdp.eval('window.__NZ_TEST.exitTour()');await sleep(800);check('exitCleansUp',await cdp.eval("!window.__NZ_TEST.tourState().active&&window.GOBI_DCDT.transitionState().phase==='idle'&&!document.getElementById('tourBar').classList.contains('on')&&window.__NZ_TEST.controls.enabled"));
  check('noRuntimeErrors',cdp.errors.length===0);check('offlineResources',!cdp.requests.some(u=>/^https?:/i.test(u)));report.errors=cdp.errors;fs.writeFileSync(path.join(ROOT,'evidence/v19-pacing-narration-browser.json'),JSON.stringify(report,null,2));if(Object.values(report.checks).some(v=>!v))process.exitCode=1;
 }finally{if(cdp)cdp.ws.close();child.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
