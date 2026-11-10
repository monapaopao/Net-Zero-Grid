'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(process.env.USERPROFILE,
  '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const source = path.resolve(__dirname, '../../charging-station-realistic/web/dist/多园区-v20-r187-充电站写实.html');
const result = path.join(__dirname, 'dist/多园区-v20-r187-充电站写实.html');
const evidence = path.join(__dirname, 'evidence');
const poses = {
  station: { pos: [110, 28, 145], tgt: [55, 2, 99] },
  entrance: { pos: [91, 6.1, 114], tgt: [64, 2, 101] },
  terminal: { pos: [69, 3.5, 94], tgt: [65.5, 1.2, 84.7] }
};

async function run() {
  fs.mkdirSync(evidence, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true, args: ['--enable-gpu', '--use-angle=d3d11'] });
  const records = [];
  try {
    for (const [version, file] of [['before', source], ['after', result]]) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 810 }, offline: true });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      const started = Date.now();
      await page.goto(pathToFileURL(file).href);
      await page.waitForSelector('#flowLayers', { state: 'attached' });
      if (version === 'after') await page.waitForFunction(() => NZ_RENDER_POLISH.status().mapsReady);
      const readyMs = Date.now() - started;
      await page.evaluate(() => {
        __NZ_TEST.S.running = false;
        __NZ_TEST.controls.autoRotate = false;
        __NZ_TEST.controls.enableDamping = false;
        document.querySelector('#segQuality [data-q="high"]').click();
      });
      await page.addStyleTag({ content: 'body *{visibility:hidden!important} #gridCanvas{visibility:visible!important} #canvasWrap,#sceneFrame{position:fixed!important;inset:0!important;border:0!important} #labels3d,#vignette{display:none!important}' });
      await page.evaluate(() => __NZ_TEST.resize());
      const shots = [];
      for (const [view, pose] of Object.entries(poses)) {
        for (const night of [false, true]) {
          const measurement = await page.evaluate(async ({ pose, night }) => {
            const api = __NZ_TEST;
            api.S.lightPreset = night ? 'night' : 'day-lab';
            api.cancelCamera();
            api.camera.position.fromArray(pose.pos);
            api.controls.target.fromArray(pose.tgt);
            api.controls.update();
            for (let i = 0; i < 35; i++) await new Promise(requestAnimationFrame);
            const times = [];
            for (let i = 0; i <= 90; i++) times.push(await new Promise(requestAnimationFrame));
            const intervals = times.slice(1).map((value, index) => value - times[index]).sort((a, b) => a - b);
            const { draws, triangles } = api.perf();
            return { medianMs: +intervals[45].toFixed(1), p95Ms: +intervals[85].toFixed(1), draws, triangles,
              lighting: NZ_RENDER_POLISH.status() };
          }, { pose, night });
          shots.push({ view, night, ...measurement });
          await page.screenshot({ path: path.join(evidence, version + '-' + view + (night ? '-night.jpg' : '-day.jpg')), type: 'jpeg', quality: 92 });
        }
      }
      const assets = version === 'after' ? await page.evaluate(() => {
        const audit = NZ_PHOTO_ASSETS.audit();
        const floors = [...NZ_PHOTO_ASSETS.floorMaterials];
        return { ...audit, bakedMaps: floors.every(material => material.aoMap && material.lightMap && material.aoMap.channel === 1 && material.lightMap.channel === 1),
          nightIndirectOff: floors.every(material => material.lightMapIntensity === 0) };
      }) : null;
      if (assets) {
        assert.equal(assets.vehicles.length, 19);
        assert.equal(assets.prototypes.length, 5);
        assert(assets.bakedMaps && assets.nightIndirectOff);
        assert(shots.every(shot => shot.lighting.outdoorHDR && shot.lighting.mapsReady && !shot.lighting.reflectionError));
      }
      assert.deepEqual(errors, []);
      records.push({ version, readyMs, htmlBytes: fs.statSync(file).size, shots, assets, errors });
      console.log(version, readyMs, 'ms', shots.map(shot => shot.view + (shot.night ? '-night' : '-day') + '=' + shot.p95Ms).join(', '));
      await context.close();
    }
    fs.writeFileSync(path.join(evidence, 'photo-checks.json'), JSON.stringify(records, null, 2) + '\n');
  } finally {
    await browser.close();
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
