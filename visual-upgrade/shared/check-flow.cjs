'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

async function checkFlows(page, evidence) {
  const behavior = await page.evaluate(async () => {
    const frames = async () => {
      for (let i = 0; i < 5; i++) await new Promise(requestAnimationFrame);
    };
    const edge = EDGES.find(edge => edge.key === 'scE');
    const original = edge.pw;
    const delta = (a, b) => ((b - a + 1.5) % 1) - .5;
    const phase = () => edge.flowHalo.material.uniforms.uPhase.value;
    const api = __NZ_TEST;
    NZ_VISUAL.clear();
    NZ_FLOWS.context('overview');
    try {
      edge.pw = () => 24;
      await frames();
      const forward = phase();
      await frames();
      const advancing = delta(forward, phase()) > 0 && edge.flowHalo.visible;

      edge.pw = () => -24;
      await frames();
      const backward = phase();
      await frames();
      const reversing = delta(backward, phase()) < 0 && edge.flowHalo.material.uniforms.uDirection.value === -1;

      edge.pw = () => 0;
      await frames();
      const stopped = !edge.flowHalo.visible && edge.visualTube.visible;

      edge.pw = () => 24;
      NZ_FLOWS.setEnabled('power', false);
      await frames();
      const switchWorks = !edge.flowHalo.visible && !edge.visualTube.visible;
      NZ_FLOWS.setEnabled('power', true);
      NZ_FLOWS.context('factory');
      await frames();
      const scopeWorks = !edge.flowHalo.visible;
      NZ_FLOWS.context('public');
      await frames();
      const focused = edge.flowHalo.visible;
      const focusedLimit = NZ_FLOWS.audit().routes.every(route => route.count <= 2) &&
        NZ_FLOW_RENDERER.audit().edges.every(route => route.count <= 2);

      api.S.reduceMotion = true;
      await frames();
      const reduced = !edge.flowHalo.visible && NZ_FLOWS.audit().routes.every(route => route.count === 0);
      api.S.reduceMotion = false;
      NZ_FLOWS.context('overview');
      await frames();
      const flows = NZ_FLOWS.audit();
      const typedHalos = flows.routes.filter(route => route.count === 1).length;
      const overviewLimit = flows.routes.every(route => route.count <= 2) &&
        NZ_FLOW_RENDERER.audit().edges.every(route => route.count <= 2);
      const retiredPoints = EDGES.every(edge => edge.points.geometry.drawRange.count === 0);
      return { advancing, reversing, stopped, switchWorks, scopeWorks, focused, focusedLimit, reduced, typedHalos, overviewLimit, retiredPoints };
    } finally {
      edge.pw = original;
      api.S.reduceMotion = false;
      NZ_FLOWS.setEnabled('power', true);
      NZ_FLOWS.context('overview');
    }
  });
  for (const [key, value] of Object.entries(behavior)) assert(value, 'Flow check failed: ' + key);

  const sst = await page.evaluate(async () => {
    await NZ_CLOUD_VISIT.open('scenarios');
    await NZ_CLOUD_VISIT.start('sst');
    try {
      NZ_SST_VISIT.seek(80);
      for (let i = 0; i < 8; i++) await new Promise(requestAnimationFrame);
      const { scene } = __NZ_TEST;
      const visible = [];
      scene.traverseVisible(object => {
        if (object.userData.flowHalo) visible.push(object);
      });
      const halo = visible.find(object => object.name.startsWith('Flow halo · SST '));
      const audit = NZ_SST_VISIT.audit();
      const onlyStoryHalos = visible.length > 0 && visible.every(object => object.name.startsWith('Flow halo · SST '));
      NZ_SST_VISIT.pause();
      const phase = halo?.material.uniforms.uPhase.value;
      for (let i = 0; i < 5; i++) await new Promise(requestAnimationFrame);
      return { running: !!halo, onlyStoryHalos, pause: !!halo && halo.material.uniforms.uPhase.value === phase,
        connected: audit.connectivity.passed };
    } finally {
      NZ_CLOUD_VISIT.close();
    }
  });
  assert.deepEqual(sst, { running: true, onlyStoryHalos: true, pause: true, connected: true });

  await captureFlowShots(page, evidence, 'halo');
  return { behavior, sst };
}

async function captureFlowShots(page, evidence, prefix) {
  for (const view of ['campus', 'charge', 'factory']) {
    await page.evaluate(async view => {
      const api = __NZ_TEST;
      NZ_FLOWS.context({ campus: 'overview', charge: 'public', factory: 'factory' }[view]);
      NZ_FACTORY.setOpen(view === 'factory', { immediate: true });
      api.S.lightPreset = 'day-lab';
      api.S.running = false;
      api.cancelCamera();
      api.controls.autoRotate = false;
      api.controls.enableDamping = false;
      const pose = view === 'campus' ? api.TOUR_HOME : view === 'charge' ?
        { pos: [63, 25, 114], tgt: [40, 1.4, 79] } : { pos: [345, 51, 157], tgt: [281, 1.7, 108] };
      api.camera.position.fromArray(pose.pos);
      api.controls.target.fromArray(pose.tgt);
      api.controls.update();
      for (let i = 0; i < 35; i++) await new Promise(requestAnimationFrame);
    }, view);
    await page.screenshot({ path: path.join(evidence, prefix + '-' + view + '.jpg'), type: 'jpeg', quality: 92 });
  }
}

module.exports = { checkFlows, captureFlowShots };
