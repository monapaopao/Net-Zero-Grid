'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-gpu','--use-angle=d3d11']});
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[],evidence=path.join(__dirname,'evidence');page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.join(__dirname,'dist/多园区-v20-r187-WebGPU.html')).href);await page.waitForFunction(()=>window.NZ_GPU?.ready);
  const target=await page.evaluate(()=>__NZ_TEST.S.simTime+600);await page.waitForFunction(t=>__NZ_TEST.S.simTime>=t,target);
  await page.evaluate(()=>{const a=__NZ_TEST;a.S.running=false;a.controls.autoRotate=false;a.controls.enableDamping=false;a.cancelCamera();a.setMode('run');a.refreshPresentation();});
  const settle=()=>page.evaluate(async()=>{for(let i=0;i<10;i++)await new Promise(requestAnimationFrame);});await settle();
  const snapshot=()=>page.evaluate(()=>({history:__NZ_TEST.trendSnapshot(),time:__NZ_TEST.S.simTime,camera:__NZ_TEST.camera.position.toArray().map(x=>+x.toFixed(8)),target:__NZ_TEST.controls.target.toArray().map(x=>+x.toFixed(8))}));
  const before=await snapshot();assert(before.history.buf.length>=2);
  const layout=await page.evaluate(()=>{const rect=id=>document.getElementById(id).getBoundingClientRect().toJSON();return {summary:rect('simSummaryDisclosure'),trend:rect('trendPanel'),tabs:document.querySelector('#drawer .dr-head').getBoundingClientRect().toJSON(),scene:rect('sceneFrame'),body:document.querySelector('#drawer .dr-body').getBoundingClientRect().toJSON()};});
  assert(layout.trend.y>=layout.summary.bottom&&layout.trend.bottom<=layout.tabs.y);assert(layout.trend.x>=layout.scene.right);assert(layout.trend.height>=180&&layout.trend.height<=215);assert(layout.body.height>=175);
  const strokes=await page.evaluate(async()=>{const ctx=document.getElementById('trendCanvas').getContext('2d'),original=ctx.stroke,records=[];ctx.stroke=function(){records.push({color:this.strokeStyle,dash:this.getLineDash()});return original.apply(this,arguments);};__NZ_TEST.redrawTrend();for(let i=0;i<30;i++)await new Promise(requestAnimationFrame);ctx.stroke=original;return records;});
  for(const color of ['#d97706','#087d73','#7c3aed','#64748b','#2563eb'])assert(strokes.some(s=>s.color===color),color);assert(strokes.some(s=>s.color==='#7c3aed'&&s.dash.join(',')==='6,4'));
  await page.screenshot({path:path.join(evidence,'v21-1-1-trend-desktop.jpg'),type:'jpeg',quality:90});
  await page.click('#trendClose');assert(!await page.locator('#trendCanvas').isVisible());await page.click('#btnTrend');assert(await page.locator('#trendCanvas').isVisible());
  await page.click('#trendClose');await page.click('#segMode [data-mode="exhibit"]');assert(!await page.locator('#trendPanel').isVisible());await page.click('#segMode [data-mode="run"]');assert(!await page.locator('#trendCanvas').isVisible());
  await page.click('#btnTrend');await page.evaluate(async()=>{await NZ_RECEPTION.start();await NZ_RECEPTION.stop();});await settle();assert(await page.locator('#trendCanvas').isVisible());assert.deepEqual(await snapshot(),before);
  await page.setViewportSize({width:390,height:900});await settle();assert(!await page.locator('#trendCanvas').isVisible());await page.click('#trendClose');assert(await page.locator('#trendCanvas').isVisible());assert.deepEqual(await snapshot(),before);
  await page.screenshot({path:path.join(evidence,'v21-1-1-trend-mobile.jpg'),type:'jpeg',quality:90});assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(evidence,'trend-check.json'),JSON.stringify({version:require('../../project-version.json').version,layout,strokes,historyPreserved:true,modeFoldPreserved:true,visitorRestore:true,mobileDefaultCollapsed:true,errors},null,2)+'\n');console.log('PASS docked trend layout, canvas colors/dashes, fold and history continuity, tour restoration and mobile');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
