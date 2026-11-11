'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-gpu','--use-angle=d3d11']});
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const evidence=path.join(__dirname,'evidence');
  await page.goto(pathToFileURL(path.join(__dirname,'dist/多园区-v20-r187-WebGPU.html')).href);await page.waitForFunction(()=>window.NZ_GPU?.ready);
  const historyTarget=await page.evaluate(()=>__NZ_TEST.S.simTime+600);
  await page.waitForFunction(target=>__NZ_TEST.S.simTime>=target,historyTarget,{timeout:20000});
  await page.evaluate(()=>{const a=__NZ_TEST;a.S.running=false;a.controls.autoRotate=false;a.controls.enableDamping=false;a.cancelCamera();a.camera.position.fromArray(a.TOUR_HOME.pos);a.controls.target.fromArray(a.TOUR_HOME.tgt);a.controls.update();a.refreshPresentation();document.querySelectorAll('#toast .tmsg').forEach(el=>el.remove());});
  const settle=()=>page.evaluate(async()=>{for(let i=0;i<8;i++)await new Promise(requestAnimationFrame);});
  const snapshot=()=>page.evaluate(()=>{const state=JSON.parse(JSON.stringify(__NZ_TEST.S));delete state.mode;const vector=v=>v.toArray().map(x=>+x.toFixed(8));return {state,ledger:__NZ_TEST.engine.exportLedger(),camera:vector(__NZ_TEST.camera.position),target:vector(__NZ_TEST.controls.target)};});
  const before=await snapshot();assert.equal(await page.evaluate(()=>__NZ_TEST.S.mode),'exhibit');
  assert(await page.locator('#visitSummary').isVisible());assert(!await page.locator('#summary').isVisible());assert(!await page.locator('#drawer').isVisible());
  await settle();await page.screenshot({path:path.join(evidence,'v21-visit-desktop.jpg'),type:'jpeg',quality:90});
  await page.click('#segMode [data-mode="run"]');await settle();assert.deepEqual(await snapshot(),before);
  assert(await page.locator('#drawer').isVisible());assert(await page.locator('#trendPanel').isVisible());assert(await page.locator('#flexHud').isVisible());assert(!await page.locator('#visitSummary').isVisible());
  await page.screenshot({path:path.join(evidence,'v21-simulation-desktop.jpg'),type:'jpeg',quality:90});
  await page.click('#segMode [data-mode="exhibit"]');await settle();assert.deepEqual(await snapshot(),before);
  await page.evaluate(()=>__NZ_TEST.drawer('ledger'));await settle();assert.equal(await page.evaluate(()=>__NZ_TEST.S.mode),'run');assert(await page.locator('.dr-page[data-page="ledger"]').isVisible());
  await page.click('#segMode [data-mode="exhibit"]');await page.evaluate(()=>__NZ_TEST.focus('dc'));await settle();assert(!await page.locator('#infoParams').isVisible());
  await page.click('#modeDeviceAnalysis');await settle();assert(await page.locator('#infoParams').isVisible());await page.click('#modeDeviceAnalysis');assert(!await page.locator('#infoCard').evaluate(el=>el.classList.contains('open')));
  await page.evaluate(()=>__NZ_TEST.drawer('params'));await page.check('#chkWind');
  await page.evaluate(()=>{const e=document.getElementById('rgWind');e.value='12';e.dispatchEvent(new Event('input',{bubbles:true}));});
  assert(await page.evaluate(()=>__NZ_TEST.S.windManual&&__NZ_TEST.S.windSlider===12));
  assert(await page.evaluate(()=>{const before=__NZ_TEST.S.windMW;__NZ_TEST.engine.step();__NZ_TEST.cancelCamera();__NZ_TEST.refreshPresentation();return Number.isFinite(__NZ_TEST.S.windMW)&&__NZ_TEST.S.windMW!==before;}));
  const modified=await snapshot();await page.click('#segMode [data-mode="exhibit"]');await settle();assert.deepEqual(await snapshot(),modified);
  await page.click('#segMode [data-mode="run"]');await page.click('#drTabs [data-tab="ledger"]');await page.evaluate(async()=>{await NZ_RECEPTION.start();await NZ_RECEPTION.stop();});await settle();assert.equal(await page.evaluate(()=>__NZ_TEST.S.mode),'run');assert(await page.locator('#drawer').isVisible());assert(await page.locator('.dr-page[data-page="ledger"]').isVisible());
  await page.evaluate(()=>__NZ_TEST.closeDrawer());await settle();assert(await page.locator('#drawer').evaluate(el=>el.classList.contains('open')));
  const downloadPromise=page.waitForEvent('download');await page.click('#btnExport');const download=await downloadPromise;const output=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert.equal(output.projectVersion,'21.1.0');assert.notEqual(output.modelVersion,output.projectVersion);
  assert(download.suggestedFilename().startsWith('Net-Zero-grid-v21.1.0-'));
  await page.evaluate(()=>document.querySelectorAll('#toast .tmsg').forEach(el=>el.remove()));
  const responsive=[];
  for(const width of [1024,390]){
   await page.setViewportSize({width,height:900});await settle();
   const record=await page.evaluate(()=>{const r=document.querySelector('#segMode').getBoundingClientRect();return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,mode:{x:r.x,right:r.right,width:r.width},drawer:document.querySelector('#drawer').getBoundingClientRect().toJSON()};});responsive.push(record);
   assert(record.mode.width>0&&record.mode.x>=0&&record.mode.right<=width);assert(record.scrollWidth<=width);
   if(width===390){await page.click('#simSummaryDisclosure>summary');assert(await page.locator('#summary').isVisible());await page.click('#simSummaryDisclosure>summary');}
   await page.screenshot({path:path.join(evidence,`v21-simulation-${width}.jpg`),type:'jpeg',quality:90});
   await page.click('#segMode [data-mode="exhibit"]');await settle();await page.screenshot({path:path.join(evidence,`v21-visit-${width}.jpg`),type:'jpeg',quality:90});await page.click('#segMode [data-mode="run"]');
  }
  await page.setViewportSize({width:1920,height:1080});await page.click('#segMode [data-mode="exhibit"]');await page.selectOption('#selScenario','surplus');await settle();assert.equal(await page.evaluate(()=>__NZ_TEST.S.mode),'run');
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(evidence,'modes-check.json'),JSON.stringify({version:output.projectVersion,unchangedBusinessState:true,unchangedCamera:true,parameterInput:true,scenarioEntrySwitchesMode:true,exportModelVersion:output.modelVersion,responsive,errors},null,2)+'\n');
  console.log('PASS dual modes, continuous state, device cards, parameter input, reception restore, export version and responsive layout');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
