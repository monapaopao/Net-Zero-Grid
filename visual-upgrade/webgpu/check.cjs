'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { checkFlows } = require('../shared/check-flow.cjs');
const bundled = path.join(process.env.USERPROFILE || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || (fs.existsSync(bundled) ? bundled : 'playwright'));
const evidence = path.join(__dirname, 'evidence');
fs.mkdirSync(evidence, { recursive: true });
const modes = process.argv.includes('--ssgi') ? ['ssgi'] : process.argv.includes('--compare') ? ['webgl', 'webgpu', 'fallback', 'ssgi'] : ['webgpu'];
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--enable-gpu', '--use-angle=d3d11'] });
  const results = [];
  try {
    for (const mode of modes) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
      const errors = [], warnings = [], external = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); if (m.type() === 'warning' && warnings.length < 30) warnings.push(m.text()); });
      await page.route(/^https?:/, route => { external.push(route.request().url()); return route.abort(); });
      const file = mode === 'webgl' ? '../dist/多园区-v20-r187-视觉升级.html' : 'dist/多园区-v20-r187-WebGPU.html';
      const start = Date.now();
      try {
        await page.goto(pathToFileURL(path.join(__dirname, file)).href + (mode === 'fallback' ? '?forceWebGL' : mode === 'ssgi' ? '?ssgi' : ''));
        await page.waitForFunction(gpu => gpu ? window.NZ_GPU?.ready || window.NZ_GPU?.error : window.__NZ_TEST?.perf().draws > 0, mode !== 'webgl', { timeout: 90000 });
        const init = await page.evaluate(async () => {
          const adapter = navigator.gpu ? await navigator.gpu.requestAdapter() : null;
          return {gpu: window.NZ_GPU ? {ready:NZ_GPU.ready,backend:NZ_GPU.backend,effect:NZ_GPU.effect,error:NZ_GPU.error} : null,
            adapter:adapter?.info?{vendor:adapter.info.vendor,architecture:adapter.info.architecture}:null,
            userAgent:navigator.userAgent,perf:window.__NZ_TEST?.perf()};
        });
        console.log(mode, 'INIT', JSON.stringify(init.gpu), 'errors', errors.slice(0, 5), 'warnings', warnings.slice(0, 5));
        if (init.gpu) assert(init.gpu.ready, init.gpu.error);
        const loadMs = Date.now() - start;
        await page.evaluate(() => {
          const a = window.__NZ_TEST; a.S.running = false; a.S.lightPreset = 'day-lab';
          document.querySelector('#segQuality [data-q="high"]').click();
          a.controls.autoRotate = false; a.controls.enableDamping = false;
        });
        await page.addStyleTag({content:'body *{visibility:hidden!important} #gridCanvas{visibility:visible!important} #canvasWrap,#sceneFrame{position:fixed!important;inset:0!important;border:0!important} #labels3d,#vignette{display:none!important}'});
        await page.evaluate(() => window.__NZ_TEST.resize());
        const shots = [];
        for (const view of ['campus', 'charge', 'factory']) {
          const data = await page.evaluate(async view => {
            const a = window.__NZ_TEST;
            const poses = {campus:a.TOUR_HOME,charge:{pos:[91,6.1,114],tgt:[64,2,101]},factory:{pos:[325,42,65],tgt:[282,1.7,22]}};
            NZ_FACTORY.setOpen(view === 'factory', {immediate:true}); a.cancelCamera();
            a.camera.position.fromArray(poses[view].pos); a.controls.target.fromArray(poses[view].tgt); a.controls.update();
            for(let i=0;i<60;i++) await new Promise(requestAnimationFrame);
            const times=[];
            for(let i=0;i<121;i++) times.push(await new Promise(requestAnimationFrame));
            const intervals=times.slice(1).map((v,i)=>v-times[i]).sort((a,b)=>a-b);
            return {view,medianMs:intervals[60],p95Ms:intervals[114],perf:a.perf(),polish:NZ_RENDER_POLISH.status(),roof:NZ_FACTORY.snapshot().roof};
          }, view);
          shots.push(data);
          await page.screenshot({path:path.join(evidence, mode+'-'+view+'.jpg'),type:'jpeg',quality:90});
          console.log(mode, view, data.medianMs, data.p95Ms);
          assert(data.perf.draws > 10); assert(data.polish.reflection, data.polish.reflectionError);
        }
        const interactions = await page.evaluate(async () => {
          const a = window.__NZ_TEST;
          NZ_VEHICLES.select('charge-N01');
          const vehicleCard = document.querySelector('#vehicleContent').textContent.includes('已连接'); NZ_VEHICLES.hide();
          NZ_FACTORY.setOpen(false,{immediate:true});
          NZ_SST_VISIT.previewScheme('sst'); NZ_SST_VISIT.tick(3);
          const sst=NZ_SST_VISIT.audit().nodes.every(n=>n.sst&&!n.existing&&n.outputProtection); NZ_SST_VISIT.clearPreview();
          await NZ_RECEPTION.start(); const reception=NZ_RECEPTION.state(); await NZ_RECEPTION.stop();
          const opened=await GOBI_DCDT.reveal(40);
          const building=opened&&document.querySelector('#dcdtFrame').contentWindow.NZ_BUILDING_TOUR.state().frames>0;
          await GOBI_DCDT.close();
          a.S.lightPreset='night';
          for(let i=0;i<30;i++) await new Promise(requestAnimationFrame);
          return {vehicleCard,connections:NZ_VEHICLES.audit().routes.length,roofClosed:NZ_FACTORY.snapshot().roof===0,sst,reception:reception.active&&reception.narrationOnly&&!NZ_RECEPTION.state().active,building,nightBloom:a.perf().bloom};
        });
        const particles = mode === 'webgl' ? null : await page.evaluate(async () => {
          const sources=[]; __NZ_TEST.scene.traverse(o=>{if(o.isPoints)sources.push(o);});
          const before=sources.map(o=>o.geometry.attributes.position.version);
          for(let i=0;i<5;i++) await new Promise(requestAnimationFrame);
          return {systems:sources.length,updated:sources.filter((o,i)=>o.geometry.attributes.position.version>before[i]).length,
            quads:sources.every(o=>o.children.some(s=>s.isSprite&&s.material.isPointsNodeMaterial&&s.material.positionNode.value.isInstancedBufferAttribute&&s.material.positionNode.value.array===o.geometry.attributes.position.array)),
            counts:sources.every(o=>o.children[0].count===Math.min(o.geometry.drawRange.count,o.geometry.attributes.position.count)),
            materials:sources.every(o=>['map','size','sizeAttenuation','blending','alphaTest'].every(k=>o.children[0].material[k]===o.material[k]))};
        });
        const restoration = mode === 'webgl' ? null : await page.evaluate(() => {
          const halos=[]; __NZ_TEST.scene.traverse(o=>{if(o.userData.flowHalo)halos.push(o);});
          return { nativeStation:!__NZ_TEST.scene.getObjectByName('Blender station · station'),
            nativeFleet:!__NZ_TEST.scene.getObjectByName('Photoreal charging and parking fleet'),
            noAssetAdapter:!window.NZ_STATION_ASSET&&!window.NZ_PHOTO_ASSETS&&!window.NZ_PERF,
            nodeHalos:halos.length>0&&halos.every(o=>o.material.isNodeMaterial&&!o.material.isShaderMaterial),
            haloCount:halos.length,controls:['btnNorthTop','btnToggleLabels','btnLabelDetail','btnViewHome'].every(id=>!!document.getElementById(id)) };
        });
        const flow = mode === 'webgl' ? null : await checkFlows(page,evidence);
        const record={mode,init,loadMs,shots,interactions,particles,restoration,flow,errors,warnings,external}; results.push(record);
        assert.deepEqual(interactions,{vehicleCard:true,connections:9,roofClosed:true,sst:true,reception:true,building:true,nightBloom:true});
        assert.deepEqual(errors, []); assert.deepEqual(external, []);
        if(particles) assert(particles.systems>0&&particles.quads&&particles.counts&&particles.materials);
        if(restoration) for(const key of ['nativeStation','nativeFleet','noAssetAdapter','nodeHalos','controls'])assert(restoration[key],key);
        assert(!warnings.some(w=>w.startsWith('THREE.')),warnings.join('\n'));
        if(mode==='webgpu') assert.equal(init.gpu.backend,'WebGPU');
        if(mode==='fallback') assert.equal(init.gpu.backend,'WebGL2 fallback');
      } catch(error) {
        console.log('FAIL',mode,error.message,errors.slice(0,10),warnings.slice(0,10));
        results.push({mode,failure:error.message,errors,warnings}); process.exitCode=1;
      } finally { await page.close(); }
    }
  } finally { await browser.close(); fs.writeFileSync(path.join(evidence,process.argv.includes('--ssgi')?'ssgi-checks.json':'checks.json'),JSON.stringify(results,null,2)); }
})();
