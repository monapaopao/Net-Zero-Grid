'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { checkFlows, captureFlowShots } = require('./check-flow.cjs');

const bundled = path.join(process.env.USERPROFILE || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || (fs.existsSync(bundled) ? bundled : 'playwright'));

async function run() {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--enable-gpu', '--use-angle=d3d11']
  });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 810 }, offline: true });
    const page = await context.newPage();
    const errors = [];
    const external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
    const file = path.join(__dirname, 'dist/多园区-v20-r187-充电站写实.html');
    const started = Date.now();
    await page.goto(pathToFileURL(file).href);
    await page.waitForSelector('#flowLayers', { state: 'attached' });
    assert.equal(await page.locator('#station-preview').count(), 0);
    const readyMs = Date.now() - started;
    const state = await page.evaluate(() => {
      window.__NZ_TEST.S.running = false;
      window.__NZ_TEST.S.lightPreset = 'day-lab';
      document.querySelector('#segQuality [data-q="high"]').click();
      return window.NZ_STATION_ASSET.state;
    });
    assert.equal(state.error, null);
    assert.equal(state.active, 'blender');
    assert.equal(Object.keys(state.mounts).length, 9);
    const renderAssets = await page.evaluate(() => {
      const { scene, THREE, perf } = __NZ_TEST;
      const meshes = [];
      scene.getObjectByName('Blender station · station').traverse(o => { if (o.isMesh) meshes.push(o); });
      return { revision: THREE.REVISION, maps: meshes.filter(o => o.material.map).length,
        normalMaps: meshes.filter(o => o.material.normalMap).length,
        roughnessMaps: meshes.filter(o => o.material.roughnessMap).length, quality: perf().quality };
    });
    assert.equal(renderAssets.revision, '187');
    assert.equal(renderAssets.quality, 'high');
    assert(renderAssets.maps > 0 && renderAssets.normalMaps > 0 && renderAssets.roughnessMaps > 0);

    await page.evaluate(() => NZ_STATION_ASSET.setModel('original'));
    assert.equal(await page.evaluate('NZ_STATION_ASSET.state.active'), 'original');
    assert.equal(await page.evaluate('__NZ_TEST.scene.getObjectByName("Terminal connection indicator N01").position.y'), 1.82);
    await page.evaluate(() => NZ_STATION_ASSET.setModel('blender'));
    assert.equal(await page.evaluate('__NZ_TEST.scene.getObjectByName("Terminal connection indicator N01").position.y'), 1.61);
    const vehicle = await page.evaluate(() => {
      const audit = window.NZ_VEHICLES.audit();
      window.NZ_VEHICLES.select('charge-N01');
      const connection = document.querySelector('#vehicleContent').textContent;
      window.NZ_VEHICLES.hide();
      return {
        terminals: audit.terminals, positions: audit.parkingPositions, routes: audit.routes.length,
        aligned: audit.routes.every(route => route.points.at(-1).every((n, i) => n === route.endpoint[i])),
        connection, busGround: audit.vehicles.find(item => item.id === 'charge-bus').p[1],
        stationPower: window.__NZ_TEST.S.sc
      };
    });
    assert.equal(vehicle.terminals, 24);
    assert.equal(vehicle.positions, 21);
    assert.equal(vehicle.routes, 9);
    assert(vehicle.aligned && vehicle.connection.includes('已连接'));
    assert(Math.abs(vehicle.busGround - .2065) < .001);

    await page.evaluate(() => {
      const api = window.__NZ_TEST;
      api.focus('panamaSc');
      api.press('detailExplode');
    });
    await page.waitForFunction(() => window.NZ_DETAIL.models.panamaSc.conversion.getObjectByName('Cabinet cover').position.y > 2);
    const coverY = await page.evaluate(() => window.NZ_DETAIL.models.panamaSc.conversion.getObjectByName('Blender station · panamaSc_shell').getWorldPosition(new window.__NZ_TEST.THREE.Vector3()).y);
    assert(coverY > 2);
    await page.evaluate(() => window.NZ_DETAIL.reset());

    const sst = await page.evaluate(() => {
      const visit = window.NZ_SST_VISIT;
      visit.previewScheme('sst', { explode: 0 });
      visit.tick(3);
      const result = visit.audit();
      visit.clearPreview();
      const restored = visit.audit();
      return {
        converted: result.nodes.every(node => node.sst && !node.existing && node.outputProtection),
        restored: restored.nodes.every(node => !node.sst && node.existing && node.outputProtection),
        connectivity: result.connectivity.passed
      };
    });
    assert(sst.converted && sst.restored && sst.connectivity);
    assert.equal(await page.evaluate('window.__NZ_TEST.S.sc'), vehicle.stationPower);

    const reception = await page.evaluate(async () => {
      await NZ_RECEPTION.start();
      const current = NZ_RECEPTION.state();
      await NZ_RECEPTION.stop();
      return current.active && current.computed && !NZ_RECEPTION.state().active;
    });
    assert(reception);

    const screenshotDir = path.join(__dirname, 'evidence');
    fs.mkdirSync(screenshotDir, { recursive: true });
    const canvasOnly = 'body *{visibility:hidden!important} #gridCanvas{visibility:visible!important} #canvasWrap,#sceneFrame{position:fixed!important;inset:0!important;border:0!important} #labels3d,#vignette{display:none!important}';
    await page.addStyleTag({ content: canvasOnly });
    await page.evaluate('window.__NZ_TEST.resize()');
    const comparisons = [];
    for (const view of ['station', 'terminal', 'power', 'south']) {
      for (const model of ['original', 'blender']) {
        await page.evaluate(({ view, model }) => {
          window.NZ_STATION_ASSET.setModel(model);
          window.NZ_STATION_ASSET.focus(view);
        }, { view, model });
        const sample = await page.evaluate(async () => {
          for (let i = 0; i < 40; i++) await new Promise(requestAnimationFrame);
          const times = [];
          for (let i = 0; i <= 90; i++) times.push(await new Promise(requestAnimationFrame));
          const intervals = times.slice(1).map((time, i) => time - times[i]).sort((a, b) => a - b);
          const { draws, triangles } = __NZ_TEST.perf();
          return { medianMs: +intervals[45].toFixed(1), p95Ms: +intervals[85].toFixed(1), draws, triangles };
        });
        comparisons.push({ view, model, ...sample });
        await page.screenshot({ path: path.join(screenshotDir, view + '-' + model + '.jpg'), type: 'jpeg', quality: 92 });
      }
    }
    const flow = await checkFlows(page, screenshotDir);
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    if (process.env.FLOW_BASELINE) {
      const previous = await context.newPage();
      await previous.goto(pathToFileURL(path.resolve(process.env.FLOW_BASELINE)).href);
      await previous.waitForSelector('#flowLayers', { state: 'attached' });
      await previous.evaluate(() => document.querySelector('#segQuality [data-q="high"]').click());
      await previous.addStyleTag({ content: canvasOnly });
      await previous.evaluate(() => __NZ_TEST.resize());
      await captureFlowShots(previous, screenshotDir, process.env.FLOW_BASELINE_PREFIX || 'particles');
      await previous.close();
    }
    const fallbackPage = await context.newPage();
    await fallbackPage.addInitScript(() => {
      window.DecompressionStream = class {
        constructor() { throw new Error('Simulated GLB decoding failure'); }
      };
    });
    await fallbackPage.goto(pathToFileURL(file).href);
    await fallbackPage.waitForSelector('#flowLayers', { state: 'attached' });
    const fallback = await fallbackPage.evaluate(() => ({
      active: NZ_STATION_ASSET.state.active,
      failed: NZ_STATION_ASSET.state.error === 'Simulated GLB decoding failure',
      routes: NZ_VEHICLES.audit().routes.length,
      toolbar: !!document.querySelector('#station-preview')
    }));
    assert.deepEqual(fallback, { active: 'original', failed: true, routes: 9, toolbar: false });
    fs.writeFileSync(path.join(screenshotDir, 'checks.json'), JSON.stringify({ state, renderAssets, vehicle, coverY, sst, reception, readyMs, comparisons, flow, fallback, errors, external }, null, 2) + '\n');
    console.log('PASS offline r187, station, vehicles, reception, flow direction, zero flow, scope and SST pause');
  } finally {
    await browser.close();
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
