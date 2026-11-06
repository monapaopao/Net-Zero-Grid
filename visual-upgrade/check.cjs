'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const tools = path.join(root, 'tmp/three-r187-tools');
const original = path.join(root, 'NetZero-GridToChip-v20-VisitorPresentation/dist/Net-Zero-grid-premium.html');
const final = path.join(__dirname, 'dist/多园区-v20-r187-视觉升级.html');
const bundled = path.join(process.env.USERPROFILE || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || (fs.existsSync(bundled) ? bundled : 'playwright'));
const compare = process.argv.includes('--compare');
const stages = compare ? [['v20', original], ['r187', final]] : [157, 167, 177, 187].map(rev => ['r' + rev, path.join(tools, 'v20-r' + rev + '-compat.html')]);
const evidence = path.join(__dirname, 'evidence');
const measures = [];

async function frame(page, view, settle = 3) {
  return page.evaluate(async ({ view, settle }) => {
    const api = window.__NZ_TEST;
    const poses = {
      campus: api.TOUR_HOME,
      charge: { pos: [91, 6.1, 114], tgt: [64, 2, 101] },
      factory: { pos: [325, 42, 65], tgt: [282, 1.7, 22] }
    };
    window.NZ_FACTORY.setOpen(view === 'factory', { immediate: true });
    api.cancelCamera();
    api.controls.autoRotate = false;
    api.controls.enableDamping = false;
    api.camera.position.fromArray(poses[view].pos);
    api.controls.target.fromArray(poses[view].tgt);
    api.controls.update();
    const times = [];
    for (let i = 0; i <= settle; i++) times.push(await new Promise(requestAnimationFrame));
    const intervals = times.slice(1).map((n, i) => +(n - times[i]).toFixed(1));
    return { view, draws: api.perf().draws, triangles: api.perf().triangles, intervals,
      roof: window.NZ_FACTORY.snapshot().roof, ao: api.perf().ao,
      polish: window.NZ_RENDER_POLISH?.status() || null };
  }, { view, settle });
}

async function run() {
  fs.mkdirSync(evidence, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--enable-gpu', '--use-angle=d3d11']
  });
  try {
    for (const [name, file] of stages) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 810 }, offline: true });
      const page = await context.newPage();
      const errors = [];
      const external = [];
      page.on('pageerror', err => errors.push(err.message));
      page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
      page.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
      try {
        await page.goto(pathToFileURL(file).href);
        await page.waitForFunction('window.__NZ_TEST && window.NZ_VEHICLES?.audit().vehicles.length === 23', { timeout: 15000 });
        const setup = await page.evaluate(() => {
          const api = window.__NZ_TEST;
          api.S.running = false;
          api.S.lightPreset = 'day-lab';
          document.querySelector('#segQuality [data-q="high"]').click();
          const gl = api.renderer.getContext();
          const info = gl.getExtension('WEBGL_debug_renderer_info');
          return { revision: api.THREE.REVISION, webgl2: typeof gl.texImage3D === 'function',
            renderer: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
        });
        assert.equal(setup.revision, name === 'v20' ? '147' : name.slice(1));
        assert(setup.webgl2);
        await page.addStyleTag({ content: 'body *{visibility:hidden!important} #gridCanvas{visibility:visible!important} #canvasWrap,#sceneFrame{position:fixed!important;inset:0!important;border:0!important} #labels3d,#vignette{display:none!important}' });
        await page.evaluate('window.__NZ_TEST.resize()');
        const shots = [];
        for (const view of ['campus', 'charge', 'factory']) {
          const measurement = await frame(page, view, compare ? 20 : 5);
          shots.push(measurement);
          assert(measurement.draws > 10 && measurement.triangles > 100, JSON.stringify(measurement));
          assert.equal(measurement.roof, Number(view === 'factory'));
          assert(measurement.ao, 'AO did not render in High quality');
          if (compare && name === 'r187') {
            assert(measurement.polish.reflection, measurement.polish.reflectionError);
            assert.equal(measurement.polish.region, view);
          }
          if (compare) await page.screenshot({ path: path.join(evidence, name + '-' + view + '.jpg'), type: 'jpeg', quality: 91 });
        }
        const interaction = await page.evaluate(() => {
          const api = window.__NZ_TEST;
          const fleet = window.NZ_VEHICLES.audit();
          window.NZ_VEHICLES.select('charge-N01');
          const card = document.querySelector('#vehicleContent').textContent;
          window.NZ_VEHICLES.hide();
          window.NZ_FACTORY.setOpen(false, { immediate: true });
          const sst = window.NZ_SST_VISIT;
          sst.previewScheme('sst');
          sst.tick(3);
          const sstSwapped = sst.audit().nodes.every(node => node.sst && !node.existing && node.outputProtection);
          sst.clearPreview();
          return { roofClosed: window.NZ_FACTORY.snapshot().roof === 0, connections: fleet.routes.length,
            vehicleCard: card.includes('已连接'), sstSwapped };
        });
        assert.deepEqual(interaction, { roofClosed: true, connections: 9, vehicleCard: true, sstSwapped: true });
        if (setup.revision === '187') {
          interaction.reception = await page.evaluate(async () => {
            const reception = window.NZ_RECEPTION;
            await reception.start();
            const state = reception.state();
            await reception.stop();
            return state.active && state.computed && !reception.state().active;
          });
          assert(interaction.reception, 'Reception failed to start, calculate or restore.');
          interaction.buildingRevision = await page.evaluate(async () => {
            const opened = await window.GOBI_DCDT.reveal(40);
            const building = document.querySelector('#dcdtFrame')?.contentWindow;
            const active = opened && !!building?.NZ_BUILDING_TOUR && building.NZ_BUILDING_TOUR.state().frames > 0;
            await window.GOBI_DCDT.close();
            return active ? 'bundled r180' : null;
          });
          assert.equal(interaction.buildingRevision, 'bundled r180');
        }
        assert.deepEqual(external, []);
        assert.deepEqual(errors, []);
        measures.push({ name, ...setup, shots, interaction, errors, external });
        console.log('PASS', name, setup.renderer, shots.map(s => s.view + '=' + s.draws).join(', '));
      } catch (error) {
        throw new Error(name + ': ' + error.message + '\n' + errors.join('\n'));
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(evidence, compare ? 'visual-checks.json' : 'migration-checks.json'), JSON.stringify(measures, null, 2) + '\n');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
