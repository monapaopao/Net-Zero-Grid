'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),{spawn}=require('child_process');
const ROOT=path.join(__dirname,'..'),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
class CDP{
  constructor(ws){this.ws=ws;this.id=0;this.pending=new Map();this.errors=[];this.requests=[];ws.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id&&this.pending.has(message.id)){const job=this.pending.get(message.id);this.pending.delete(message.id);message.error?job.reject(message.error):job.resolve(message.result);}if(message.method==='Runtime.exceptionThrown')this.errors.push(message.params.exceptionDetails);if(message.method==='Log.entryAdded'&&message.params.entry.level==='error')this.errors.push(message.params.entry);if(message.method==='Network.requestWillBeSent')this.requests.push(message.params.request.url);});}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}));});}
  async eval(expression){const result=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;}
}
async function main(){
 const browser=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync),profile=fs.mkdtempSync(path.join(os.tmpdir(),'nz-v19-building-'));
 const child=spawn(browser,['--headless=new','--remote-debugging-port=0','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-background-timer-throttling','--disable-renderer-backgrounding','--window-size=1440,1000','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
 let cdp;const report={checks:{},poses:[]},check=(n,v)=>{report.checks[n]=!!v;console.log((v?'PASS ':'FAIL ')+n);};
 try{
  const active=path.join(profile,'DevToolsActivePort');for(let i=0;i<150&&!fs.existsSync(active);i++)await sleep(200);const port=fs.readFileSync(active,'utf8').split('\n')[0],tabs=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json(),ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));cdp=new CDP(ws);for(const d of ['Runtime','Log','Network','Page'])await cdp.send(d+'.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await cdp.send('Page.navigate',{url:'file:///'+path.join(ROOT,'src/vendor/dcdt-v11/index.html').replace(/\\/g,'/')});let ready=false;for(let i=0;i<200;i++){if(await cdp.eval('!!window.NZ_BUILDING_SST&&!!window.NZ_BUILDING_TOUR')){ready=true;break;}await sleep(150);}if(!ready)throw Error('Scene not ready '+JSON.stringify(cdp.errors));
  const shot=async n=>{const s=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(ROOT,'screenshots/v19-building-standalone-'+n+'.png'),Buffer.from(s.data,'base64'));};
  await cdp.eval('NZ_BUILDING_TOUR.prepare(0)');
  report.baseline=await cdp.eval('NZ_BUILDING_TOUR.review.baseline()');report.start=await cdp.eval('NZ_BUILDING_TOUR.getPose()');
  check('startPoseRetained',report.start.position.every((x,i)=>Math.abs(x-report.baseline.position[i])<1e-6)&&report.start.target.every((x,i)=>Math.abs(x-report.baseline.target[i])<1e-6));
  report.stages=await cdp.eval('NZ_BUILDING_TOUR.review.stages()');
  const master=JSON.parse(fs.readFileSync(path.join(ROOT,'导览文案.json'),'utf8')).building;
  check('timelineUsesMaster77s',report.stages.every((s,i)=>s.start===master[i].start&&s.end===master[i].end)&&report.stages.at(-1).end===77);
  check('durationAndNavigationLabelsSync',await cdp.eval('document.getElementById("timeline").max==="77"&&document.getElementById("tour-duration").textContent==="77"&&document.getElementById("time").textContent.endsWith("01:17")&&[...document.querySelectorAll(".timeline-labels button")].map(b=>+b.dataset.time).join(",")==="0,4,13,62,66"'));
  report.shortMoves=[];
  for(const i of [0,1,15,16]){await cdp.eval('NZ_BUILDING_TOUR.prepare(0)');report.shortMoves.push(await cdp.eval(`NZ_BUILDING_TOUR.seek(${report.stages[i].start+.01});NZ_BUILDING_TOUR.getPose()`));}
  check('oneSecondMovesFinishWithinChapter',report.shortMoves.every(p=>p.transitionDuration<=.8+1e-6));
  await cdp.eval('NZ_BUILDING_TOUR.seek(2.9)');await sleep(150);report.reveal=await cdp.eval('NZ_BUILDING_TOUR.review.reveal()');
  check('revealAlreadyFadingAt2p9',report.reveal.meshes.every(m=>m.target>=0&&m.target<m.base*.7));
  await cdp.eval('NZ_BUILDING_TOUR.seek(3.95)');await sleep(100);report.revealEnd=await cdp.eval('NZ_BUILDING_TOUR.review.reveal()');
  check('revealCompleteBeforeExplosion',report.revealEnd.meshes.every(m=>m.target===0));
  const first=report.stages.findIndex(s=>s.level===1),last=report.stages.length-1;
  for(let i=first;i<=last;i++){const t=report.stages[i].start+.01;const pose=await cdp.eval(`NZ_BUILDING_TOUR.seek(${t});NZ_BUILDING_TOUR.review.settle()`);report.poses.push(pose);}
  const heading=report.poses[0].yaw;
  check('singleOpeningRotation',report.poses[0].rotationEntries===1);
  check('openingRotationCadencePreserved',Math.abs(report.poses[0].transitionDuration-3.8)<1e-6);
  check('finalReturnCadencePreserved',Math.abs(report.poses.at(-1).transitionDuration-2.8)<1e-6);
  check('laterChaptersFixedHeading',report.poses.slice(1,-1).every(p=>Math.abs(p.yaw-heading)<1e-6));
  const end=report.poses.at(-1);
  check('finalReturnCompletePose',end.position.every((x,i)=>Math.abs(x-report.baseline.position[i])<1e-6)&&end.target.every((x,i)=>Math.abs(x-report.baseline.target[i])<1e-6));
  await cdp.eval('NZ_BUILDING_TOUR.prepare(0);NZ_BUILDING_TOUR.seek(20);NZ_BUILDING_TOUR.review.settle()');
  const locked=await cdp.eval('NZ_BUILDING_TOUR.getPose()');
  await cdp.eval('NZ_BUILDING_TOUR.review.setPose({position:[-22,30,35],target:[0,12,0]});NZ_BUILDING_TOUR.setPlaying(true)');
  check('resumeUsesSmoothTransition',await cdp.eval('NZ_BUILDING_TOUR.getPose().moving'));await cdp.eval('NZ_BUILDING_TOUR.setPlaying(false);NZ_BUILDING_TOUR.review.settle()');
  check('resumeRestoresChapterHeading',Math.abs((await cdp.eval('NZ_BUILDING_TOUR.getPose()')).yaw-locked.yaw)<1e-6);
  if(process.argv.includes('--pacing-only')){
    check('noRuntimeErrors',cdp.errors.length===0);check('offline',!cdp.requests.some(u=>/^https?:/i.test(u)));report.errors=cdp.errors;
    fs.writeFileSync(path.join(ROOT,'evidence/v19-building-pacing-20261022.json'),JSON.stringify(report,null,2));if(Object.values(report.checks).some(v=>!v))process.exitCode=1;return;
  }
  await cdp.eval('NZ_BUILDING_TOUR.prepare(0);NZ_BUILDING_SST.focus({detail:false,duration:.1})');await sleep(300);await shot('existing');
  report.before=await cdp.eval('NZ_BUILDING_SST.state()');
  report.afterRequest=await cdp.eval('NZ_BUILDING_SST.setScheme("sst",{animate:false})');await sleep(400);
  report.after=await cdp.eval('NZ_BUILDING_SST.state()');
  check('sstReadyActualModel',report.after.ready&&report.after.modelAudit.passed);
  check('sstNamesMatchScheme',await cdp.eval('document.querySelector("#device-select option[value=hvdc]").textContent.includes("SST")&&document.querySelector("#power-chain").children[5].textContent.includes("SST")'));
  check('oldConversionHidden',report.after.replaced.length>20&&report.after.replaced.every(m=>m.opacity<.02));
  check('outputProtectionRetained',report.after.retained.some(m=>m.name==='DC protection'&&m.opacity>.3)&&report.after.retained.some(m=>m.name==='DC control panel'&&m.opacity>.3));
  await shot('sst');
  await cdp.eval('NZ_BUILDING_SST.focus({detail:true,duration:.1});NZ_BUILDING_SST.setExplode(1)');await sleep(1300);await shot('sst-exploded');
  check('sstLocalExplode',await cdp.eval('NZ_BUILDING_SST.state().explode>.9'));
  check('detailOutputRetained',await cdp.eval('NZ_BUILDING_SST.state().retainedDetail.some(m=>m.name==="DC breaker"&&m.effectiveVisible&&m.opacity>.5)'));
  await cdp.eval('NZ_BUILDING_TOUR.review.setPose({position:[-7,4.3,7],target:[-1.4,2.2,0]})');await sleep(300);await shot('sst-4x');
  await cdp.eval('NZ_BUILDING_SST.reset();NZ_BUILDING_SST.focus({detail:false,duration:.1})');await sleep(400);
  check('schemeRestores',await cdp.eval('NZ_BUILDING_SST.state().scheme==="existing"&&NZ_BUILDING_SST.state().replaced.some(m=>m.opacity>.8)'));
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await sleep(400);await shot('phone');
  check('phoneNoOverflow',await cdp.eval('document.documentElement.scrollWidth<=innerWidth'));
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:390,height:330,deviceScaleFactor:1,mobile:true});await cdp.eval('document.body.dataset.sstEmbedded="true";NZ_BUILDING_SST.setScheme("sst",{animate:false});NZ_BUILDING_SST.focus({detail:true,duration:.1});NZ_BUILDING_SST.setExplode(1)');await sleep(800);await shot('embedded-phone');
  check('embeddedPhoneViewportVisible',await cdp.eval('document.querySelector("#viewport").getBoundingClientRect().height>=innerHeight-1&&getComputedStyle(document.querySelector("footer")).display==="none"'));
  check('noRuntimeErrors',cdp.errors.length===0);check('offline',!cdp.requests.some(u=>/^https?:/i.test(u)));report.errors=cdp.errors;
  fs.writeFileSync(path.join(ROOT,'evidence/v19-building-browser.json'),JSON.stringify(report,null,2));if(Object.values(report.checks).some(v=>!v))process.exitCode=1;
 }finally{if(cdp)cdp.ws.close();child.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
