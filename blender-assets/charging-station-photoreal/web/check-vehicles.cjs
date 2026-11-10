'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(process.env.USERPROFILE,
  '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true, args: ['--enable-gpu', '--use-angle=d3d11'] });
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(path.join(__dirname, 'dist/多园区-v20-r187-充电站写实.html')).href);
    await page.waitForFunction(() => window.NZ_PHOTO_ASSETS?.audit().vehicles.length === 19);
    const result = await page.evaluate(() => {
      const fleet = __NZ_TEST.scene.getObjectByName('Photoreal charging and parking fleet');
      const source = NZ_VEHICLES.audit().vehicles;
      __NZ_TEST.scene.updateMatrixWorld(true);
      const vehicles = NZ_PHOTO_ASSETS.audit().vehicles.map(vehicle => {
        const expected = source.find(item => item.id === vehicle.id);
        const ray = new THREE.Raycaster(new THREE.Vector3(vehicle.p[0], vehicle.p[1] + 8, vehicle.p[2]), new THREE.Vector3(0, -1, 0));
        const hit = ray.intersectObject(fleet, true).find(item => item.object.userData.vehicleIds?.[item.instanceId] === vehicle.id);
        const handled = hit && NZ_VEHICLES.inspectHit(hit);
        const card = document.querySelector('#vehicleContent').textContent;
        return { id: expected.id, handled, correctPlate: card.includes(expected.plate),
          positionError: new THREE.Vector3(...vehicle.p).distanceTo(new THREE.Vector3(...expected.p)), hit: !!hit };
      });
      NZ_VEHICLES.hide();
      NZ_STATION_ASSET.setModel('original');
      const original = !fleet.visible && !NZ_PHOTO_ASSETS.audit().active;
      NZ_STATION_ASSET.setModel('blender');
      const restored = fleet.visible && NZ_PHOTO_ASSETS.audit().active;
      return { vehicles, original, restored };
    });
    assert.equal(result.vehicles.length, 19);
    assert(result.vehicles.every(vehicle => vehicle.handled && vehicle.correctPlate && vehicle.positionError < 1e-8));
    assert(result.original && result.restored);
    fs.writeFileSync(path.join(__dirname, 'evidence/vehicle-checks.json'), JSON.stringify(result, null, 2) + '\n');
    console.log('PASS 19 vehicle mesh selections, identities, positions and reversible model switch');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
