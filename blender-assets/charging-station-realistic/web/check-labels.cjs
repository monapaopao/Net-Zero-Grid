'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs');
const bundled = path.join(process.env.USERPROFILE || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || bundled);

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true, args: ['--enable-gpu', '--use-angle=d3d11'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(process.env.PREVIEW_FILE || path.join(__dirname, 'dist/多园区-v20-r187-充电站写实.html')).href);
    await page.waitForSelector('#btnNorthTop');
    await page.evaluate(() => {
      __NZ_TEST.S.running = false;
      __NZ_TEST.controls.autoRotate = false;
      __NZ_TEST.camera.position.fromArray(__NZ_TEST.TOUR_HOME.pos);
      __NZ_TEST.controls.target.fromArray(__NZ_TEST.TOUR_HOME.tgt);
      __NZ_TEST.controls.update();
    });
    const settle = () => page.evaluate(async () => {
      for (let i = 0; i < 3; i++) await new Promise(requestAnimationFrame);
    });
    const state = () => page.evaluate(() => ({
      ...NZ_VISUAL.state(), checked: document.querySelector('#showCampusLabels').checked,
      pressed: document.querySelector('#btnToggleLabels').getAttribute('aria-pressed'),
      detailPressed: document.querySelector('#btnLabelDetail').getAttribute('aria-pressed'),
      hidden: document.body.classList.contains('scene-labels-hidden'),
      visibleLabels: [...document.querySelectorAll('.dev3d,.sst-scene-label,.chemical-review-tag')].filter(el =>
        getComputedStyle(el).visibility !== 'hidden' && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0).length
    }));
    await page.click('#btnToggleLabels');
    await settle();
    let actual = await state();
    assert(!actual.labels && actual.hidden && !actual.checked && actual.pressed === 'false' && actual.visibleLabels === 0);
    await page.click('#btnToggleLabels');
    await settle();
    actual = await state();
    assert(actual.labels && !actual.details && actual.checked && actual.pressed === 'true' && actual.visibleLabels > 0);
    await page.click('#btnLabelDetail');
    actual = await state();
    assert(actual.labels && actual.details && actual.detailPressed === 'true');
    await page.click('#btnToggleLabels');
    await page.click('#btnToggleLabels');
    actual = await state();
    assert(actual.labels && !actual.details && actual.detailPressed === 'false');
    await page.uncheck('#showCampusLabels');
    await settle();
    assert((await state()).visibleLabels === 0);
    await page.click('#btnLabelDetail');
    actual = await state();
    assert(actual.labels && actual.details && actual.checked);
    await page.click('#btnToggleLabels');
    await page.evaluate(() => __NZ_TEST.focus('nh3'));
    await settle();
    assert.equal((await state()).visibleLabels, 0);
    await page.click('#btnToggleLabels');
    await page.click('#btnViewHome');
    await page.evaluate(() => {
      __NZ_TEST.cancelCamera();
      __NZ_TEST.camera.position.fromArray(__NZ_TEST.TOUR_HOME.pos);
      __NZ_TEST.controls.target.fromArray(__NZ_TEST.TOUR_HOME.tgt);
      __NZ_TEST.controls.update();
    });
    await settle();
    for (const width of [1440, 1024, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await settle();
      const layout = await page.evaluate(() => {
        const ids = [...document.querySelector('.scene-tools').children].filter(el => !el.hidden)
          .sort((a, b) => a.getBoundingClientRect().x - b.getBoundingClientRect().x).map(el => el.id);
        const boxes = ids.map(id => {
          const rect = document.getElementById(id).getBoundingClientRect();
          return { id, x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom };
        });
        const panel = document.querySelector('#flowLayers').getBoundingClientRect();
        return { ids, boxes, panel: { x: panel.x, y: panel.y, right: panel.right }, viewport: innerWidth };
      });
      assert.deepEqual(layout.ids, ['btnNorthTop', 'btnToggleLabels', 'btnLabelDetail', 'btnViewHome']);
      assert(layout.boxes.every(box => Math.abs(box.y - layout.boxes[0].y) < 1 && Math.abs(box.height - 36) < 1));
      assert(Math.abs(layout.boxes[0].width - layout.boxes[2].width) < 1);
      assert(Math.abs(layout.boxes[0].x - layout.panel.x) < 1);
      assert(Math.abs(layout.boxes[3].right - layout.panel.right) < 1);
      assert(layout.panel.y > layout.boxes[0].bottom);
      assert(layout.boxes[0].x >= 0 && layout.boxes[3].right <= width);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.click('#btnNorthTop');
    await settle();
    const camera = await page.evaluate(() => __NZ_TEST.camera.position.toArray());
    assert(camera[1] > 1200 && Math.abs(camera[0] + 70) < 15);
    const output = process.env.EVIDENCE_DIR || path.join(__dirname, 'evidence');
    await page.evaluate(() => document.querySelectorAll('#toast .tmsg').forEach(message => message.remove()));
    await page.screenshot({ path: path.join(output, 'label-controls.jpg'), type: 'jpeg', quality: 90 });
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'label-controls-checks.json'), JSON.stringify({ passed: true, widths: [1440, 1024, 390], camera, errors }, null, 2) + '\n');
    console.log('PASS label modes, checkbox sync, regional labels, north view and aligned controls at 3 widths');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
