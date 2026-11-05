'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),{spawn}=require('child_process');
const ROOT=path.join(__dirname,'..'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
class CDP{
 constructor(ws){this.ws=ws;this.id=0;this.pending=new Map();this.errors=[];ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&this.pending.has(m.id)){const p=this.pending.get(m.id);this.pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')this.errors.push(m.params.exceptionDetails);if(m.method==='Log.entryAdded'&&m.params.entry.level==='error')this.errors.push(m.params.entry);});}
 send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}));});}
 async eval(expression){const r=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
}
async function main(){
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'nz-anatomy-')),browser=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
 const child=spawn(browser,['--headless=new','--remote-debugging-port=0','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-background-timer-throttling','--disable-renderer-backgrounding','--window-size=2048,1200','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
 let cdp;const report={checks:{}};
 try{
  const active=path.join(profile,'DevToolsActivePort');for(let i=0;i<150&&!fs.existsSync(active);i++)await sleep(200);
  const port=fs.readFileSync(active,'utf8').split('\n')[0],targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json(),ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));cdp=new CDP(ws);await cdp.send('Runtime.enable');await cdp.send('Log.enable');await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:2048,height:1200,deviceScaleFactor:1,mobile:false});
  await cdp.send('Page.navigate',{url:'file:///'+path.join(ROOT,'dist/Net-Zero-grid-premium.html').replace(/\\/g,'/')});
  let ready=false;for(let i=0;i<160;i++){if(await cdp.eval('!!window.__NZ_TEST')){ready=true;break;}await sleep(250);}if(!ready)throw Error('Scene not ready: '+JSON.stringify(cdp.errors));
  await cdp.eval(`(()=>{const a=window.__NZ_TEST;a.S.running=false;a.S.lightPreset='day-lab';a.cancelCamera();a.controls.enableDamping=false;document.querySelector('[data-q=standard]').click();a.focus('windNacelle');window.NZ_WIND_PRODUCT.setOpen(true);document.getElementById('toast').replaceChildren();return true;})()`);
  await sleep(1800);
  const shot=async name=>{const s=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(ROOT,'screenshots/v17-anatomy-'+name+'.png'),Buffer.from(s.data,'base64'));};
  await shot('whole');
  report.model=await cdp.eval('window.NZ_WIND_PRODUCT.audit()');
  report.checks.planValidation=report.model.anatomyValidation.passed;
  report.checks.singleDetailedWind=await cdp.eval(`(()=>{let n=0;window.__NZ_TEST.scene.traverse(o=>{if(o.name==='Anatomy representative nacelle')n++;});return n===1;})()`);
  report.checks.visibleCutaway=report.model.anatomy.lod&&report.model.anatomy.cutaway>.99&&report.model.anatomy.opaqueInternals;
  report.checks.enoughMeaningfulParts=report.model.anatomy.parts>=150&&report.model.anatomy.batches<60;
  report.checks.narratedWindTiming=await cdp.eval(`window.__NZ_TEST.TOUR.find(c=>c.id==='windProduct').segments.find(s=>s.id==='wind-product-material').duration===9&&window.__NZ_TEST.TOUR_PACING.windApproachSeconds===5`);
  report.checks.noMaterialZoom=!report.model.materialsExpanded;
  report.checks.overviewLabel=await cdp.eval(`document.querySelector('.wind-unit-label').textContent.trim()==='风力发电机组'`);
  report.checks.physicalFlowPorts=await cdp.eval(`(()=>{const f=window.NZ_FLOWS.audit(),p=window.NZ_WIND_PRODUCT,near=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]))<1e-8;return [['wind-generator-converter-0','generator','converter'],['wind-converter-transformer-0','converterOut','transformer'],['wind-tower-collector-0','transformerHV',null]].every(([id,from,to])=>{const r=f.routes.find(r=>r.id===id);return near(r.pts[0],p.endpoint(0,from))&&(!to||near(r.pts.at(-1),p.endpoint(0,to)));});})()`);
  report.checks.monotoneTowerDescent=await cdp.eval(`(()=>{const r=window.NZ_FLOWS.audit().routes.find(r=>r.id==='wind-tower-collector-0');return r.pts.slice(0,-1).every((p,i)=>!i||p[1]<=r.pts[i-1][1]+1e-8);})()`);
  report.checks.perUnitPower=await cdp.eval(`window.NZ_FLOWS.audit().routes.filter(r=>/wind-(generator-converter|converter-transformer|tower-collector)-0$/.test(r.id)).every(r=>Math.abs(r.rate-window.__NZ_TEST.S.turbP[0])<1e-6)`);
  // Use real DOM-targeted pointer input to exercise component selection.
  const click=async selector=>{const r=await cdp.eval(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height};})()`);if(!r.w||!r.h)throw Error('Hidden control '+selector);await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x:r.x,y:r.y,button:'left',clickCount:1});await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:r.x,y:r.y,button:'left',clickCount:1});};
  for(const part of ['transformer','generator','converter']){await click('[data-wind-part='+part+']');await sleep(1300);await shot(part);report.checks['select-'+part]=await cdp.eval(`document.querySelector('[data-wind-part=${part}]').getAttribute('aria-pressed')==='true'&&window.NZ_WIND_PRODUCT.audit().anatomy.part==='${part}'`);}
  await click('[data-wind-part=transformer]');await sleep(1200);
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:2048,height:1200,deviceScaleFactor:4,mobile:false});await sleep(400);await shot('transformer-4x');
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:2048,height:1200,deviceScaleFactor:1,mobile:false});
  await cdp.eval(`(()=>{const a=window.__NZ_TEST,p=window.NZ_WIND_PRODUCT.pose();a.cancelCamera();const t=new a.THREE.Vector3(...p.tgt);const d=a.camera.position.clone().sub(t);d.applyAxisAngle(new a.THREE.Vector3(0,1,0),-.6);a.camera.position.copy(t).add(d);a.controls.target.copy(t);a.camera.lookAt(t);return true;})()`);await sleep(500);await shot('alternate');
  await click('[data-wind-action=transparent]');await sleep(1500);await shot('closed');report.checks.shellRestores=await cdp.eval('window.NZ_WIND_PRODUCT.audit().amount<.01');
  await cdp.eval(`(()=>{const a=window.__NZ_TEST;a.S.reduceMotion=true;window.NZ_WIND_PRODUCT.setOpen(true);window.NZ_WIND_PRODUCT.update(0);return true;})()`);report.checks.reducedMotion=await cdp.eval('window.NZ_WIND_PRODUCT.audit().amount===1');
  report.keyboardBefore=await cdp.eval("(()=>{const b=document.querySelector('[data-wind-part=generator]');b.focus();return {active:document.activeElement.outerHTML,disabled:b.disabled,part:window.NZ_WIND_PRODUCT.audit().anatomy.part};})()");await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',unmodifiedText:'\r',windowsVirtualKeyCode:13});await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await sleep(1100);report.keyboardAfter=await cdp.eval('({active:document.activeElement.outerHTML,model:window.NZ_WIND_PRODUCT.audit()})');report.checks.keyboardPartSelection=await cdp.eval("window.NZ_WIND_PRODUCT.audit().anatomy.part==='generator'");
  report.qualityModes=[];
  const modes=await cdp.eval("Array.from(document.querySelectorAll('[data-q]')).map(b=>b.dataset.q)");for(const q of modes){await cdp.eval(`document.querySelector('[data-q=${q}]').click()`);await sleep(300);report.qualityModes.push(await cdp.eval('({quality:window.NZ_WIND_PRODUCT.audit().quality,visible:window.NZ_WIND_PRODUCT.audit().anatomy.lod})'));}report.checks.allQualityModes=report.qualityModes.length===3&&report.qualityModes.every(r=>r.visible);
  await cdp.eval(`(()=>{const a=window.__NZ_TEST;window.NZ_WIND_PRODUCT.selectIndex(1);a.focus('windNacelle');return true;})()`);await sleep(1400);report.checks.otherWindCoarse=await cdp.eval('!window.NZ_WIND_PRODUCT.audit().anatomy.lod');
  await cdp.eval(`(()=>{const a=window.__NZ_TEST;window.NZ_WIND_PRODUCT.selectIndex(0);a.focus('overview');a.camera.position.set(163,134,172);a.controls.target.set(42,0,46);return true;})()`);await sleep(1400);report.checks.farLod=await cdp.eval('!window.NZ_WIND_PRODUCT.audit().anatomy.lod');
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await sleep(350);await shot('mobile');report.checks.mobileNoHorizontalOverflow=await cdp.eval('document.documentElement.scrollWidth<=innerWidth');
  report.checks.noRuntimeErrors=cdp.errors.length===0;report.errors=cdp.errors;
  fs.writeFileSync(path.join(ROOT,'evidence/v17-wind-anatomy-browser.json'),JSON.stringify(report,null,2));for(const[k,v]of Object.entries(report.checks))console.log((v?'PASS ':'FAIL ')+k);console.log('Parts / batches:',report.model.anatomy.parts,report.model.anatomy.batches);if(Object.values(report.checks).some(v=>!v))process.exitCode=1;
 }finally{if(cdp)cdp.ws.close();child.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
