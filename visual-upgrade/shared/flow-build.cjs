'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function replaceOnce(source, before, after) {
  if (source.split(before).length !== 2) throw new Error('Expected one flow anchor: ' + before);
  return source.replace(before, () => after);
}

function replaceSection(source, first, next, replacement) {
  const start = source.indexOf(first);
  const end = source.indexOf(next, start + first.length);
  if (start < 0 || end < 0) throw new Error('Missing flow section: ' + first);
  return replaceOnce(source, source.slice(start, end), replacement);
}

function legacy(source) {
  source = replaceOnce(source, '  const CAPACITY=64,EPS=1e-6,projected=new THREE.Vector3();', '  const projected = new THREE.Vector3();');
  source = replaceOnce(source, 'let initialized=false,elapsed=0;', 'let initialized=false,elapsed=0,frameDt=0;');
  return replaceSection(source, '  function sprite(){', '\n})();', `  function init() {
    if (initialized) return;
    initialized = true;
    for (const edge of EDGES) {
      edge.points.geometry.setDrawRange(0, 0);
      edge.flowMetricAt = -1;
      if (edge.visualTube) {
        edge.visualTube.material.transparent = true;
        edge.visualTube.material.depthWrite = false;
        edge.visualTube.renderOrder = 3;
      }
      // These two routes also represent permanent overhead conductors.
      if (['wind', 'solar'].includes(edge.key)) {
        const curve = new THREE.Curve();
        curve.getPoint = t => new THREE.Vector3(...edgePoint(edge, t));
        const conductor = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(24, Math.ceil(edge.len / 4)), .038, 5, false),
          new THREE.MeshStandardMaterial({ color: 0x78908d, roughness: .8 }));
        conductor.name = 'Permanent conductor ' + edge.key;
        scene.add(conductor);
      }
    }
    updateParticles = dt => { frameDt = dt; elapsed += dt; };
  }

  function afterVisibility() {
    const focus = window.NZ_FLOWS.getFocus();
    for (const edge of EDGES) {
      if (edge.points.geometry.drawRange.count !== 0) edge.points.geometry.setDrawRange(0, 0);
      const rate = Number(edge.pw()) || 0;
      edge.flowRate = rate;
      const shown = edge.points.visible;
      if (!shown) {
        if (edge.flowHalo) edge.flowHalo.visible = false;
        continue;
      }
      if (edge.haloPath !== edge.pts) {
        if (edge.flowHalo) {
          edge.flowHalo.removeFromParent();
          edge.flowHalo.geometry.dispose();
          edge.flowHalo.material.dispose();
        }
        const color = kind(edge) === 'process' ? (edge.media === 'hydrogen' ? 0x287fab : 0x8057a0) :
          edge.dataFlow ? (edge.color || 0x087f9d) : 0xb87012;
        edge.flowHalo = window.NZ_FLOW_HALO.create(edge.pts.map(([x, y, z]) => [x, y + .14, z]), color, edge.key);
        tailRoot.add(edge.flowHalo);
        edge.haloPath = edge.pts;
        edge.flowMetricAt = -1;
      }
      if (edge.flowMetricAt < 0 || elapsed - edge.flowMetricAt > .25) {
        const result = metrics(edge.pts);
        edge.flowPixels = result.pixels;
        edge.flowSpeed = Math.min(.30, 48 / Math.max(20, result.pixels), 46 / Math.max(1, edge.len));
        edge.flowMetricAt = elapsed;
      }
      const emphasis = focus === 'energy' ? ['stg', 'bus2dist', 'bus2tr'].includes(edge.key) : focus !== 'overview';
      window.NZ_FLOW_HALO.step(edge.flowHalo, { rate, dt: frameDt, speed: edge.flowSpeed,
        shown, pixels: edge.flowPixels, emphasis });
    }
    frameDt = 0;
  }

  function audit() {
    return { maxHighlightsPerRoute: 2, edges: EDGES.map(edge => ({ key: edge.key,
      allocated: 0, count: window.NZ_FLOW_HALO.count(edge.flowHalo), pixels: edge.flowPixels, speed: edge.flowSpeed,
      phase: edge.flowHalo?.material.uniforms.uPhase.value, rate: edge.flowRate,
      visible: !!edge.flowHalo?.visible })) };
  }

  return { init, metrics, contextVisible, afterVisibility, audit };`);
}

function typed(source) {
  source = replaceOnce(source, 'routes=[],nodes={},MAX_PARTICLES=32', 'routes=[],nodes={}');
  source = replaceSection(source, '  // Procedural symbols', '  const directionCanvas=', '');
  source = replaceSection(source, "    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position'", '    const markers=[];',
    '    const halo = window.NZ_FLOW_HALO.create(pts, kinds[type].color, id);\n    g.add(halo);\n');
  source = replaceOnce(source, 'g,line,particle,markers', 'g,line,halo,markers');
  source = replaceOnce(source, 'r.particle.geometry.setDrawRange(0,0);', 'r.halo.visible=false;');
  source = replaceOnce(source, '(selected?.72:.1):r.concept?.28:active?(r.type===\'power\'?.62:.42):.12',
    '(selected?.46:.09):r.concept?.19:active?(r.type===\'power\'?.28:.23):.12');
  source = replaceSection(source, '      const budget=Math.min(MAX_PARTICLES', '\n    }\n    if(panel', `      window.NZ_FLOW_HALO.step(r.halo, { rate, dt: Math.max(0, dt || 0), speed: r.speed,
        shown: moving, pixels: r.screenLength, emphasis: selected || focus !== 'overview' });
      r.count = window.NZ_FLOW_HALO.count(r.halo);
      r.phase = r.halo.material.uniforms.uPhase.value;`);
  return replaceOnce(source, 'maxParticlesPerRoute:MAX_PARTICLES,totalAllocated:routes.length*MAX_PARTICLES',
    'maxHighlightsPerRoute:2,totalAllocated:0');
}

function sst(source) {
  source = replaceOnce(source, ',lastPaint=0,clock=0,loadNotice=', ',lastPaint=0,loadNotice=');
  source = replaceOnce(source, 'opacity=goal=0;clock=0;loadNotice=', 'opacity=goal=0;loadNotice=');
  source = replaceOnce(source, ",curve=new THREE.CurvePath();for(let i=1;i<points.length;i++)curve.add(new THREE.LineCurve3(new THREE.Vector3(...points[i-1]),new THREE.Vector3(...points[i])));", ';');
  source = replaceSection(source, '    const geom=new THREE.BufferGeometry();geom.setAttribute', '\n  }\n  function buildFlows',
    `    const halo = window.NZ_FLOW_HALO.create(points, color, 'SST ' + id);
    flowRoot.add(halo);
    path.material.opacity = .32;
    lines.push({ id, kind, points, from, to, path, halo, rate: 0 });`);
  source = replaceOnce(source, 'if(!paused&&!api.S.reduceMotion)clock+=dt;updateFlows();', 'updateFlows(paused || loading ? 0 : dt);');
  source = replaceOnce(source, 'function updateFlows(){', 'function updateFlows(dt){');
  source = replaceSection(source, '      const enabled=window.NZ_FLOWS.isEnabled(r.kind)', '\n  function paint(force)', `      const shown = index >= 4 && window.NZ_FLOWS.isEnabled(r.kind) && !inside;
      r.path.visible = shown;
      window.NZ_FLOW_HALO.step(r.halo, { rate: r.rate, dt, speed: r.kind === 'control' ? .16 : .13,
        shown: shown && !api.S.reduceMotion, emphasis: true });
    }
  }`);
  return replaceOnce(source, '!r.dots.material.depthTest', '!r.halo.material.depthTest');
}

function factory(source) {
  source = replaceOnce(source, 'const points=route.points.map(p=>new THREE.Vector3(...p)),curve=new THREE.CurvePath();for(let i=1;i<points.length;i++)curve.add(new THREE.LineCurve3(points[i-1],points[i]));',
    'const points=route.points.map(p=>new THREE.Vector3(...p));');
  source = replaceSection(source, '   const geo=new THREE.BufferGeometry();geo.setAttribute(\'position\',new THREE.BufferAttribute(new Float32Array(36)', '\n  }\n  const staticMeshes=',
    `   const halo = window.NZ_FLOW_HALO.create(route.points, data.colors[route.mat], route.id);
   halo.userData.phaseOffset = halo.material.uniforms.uPhase.value;
   wasteFlows.add(halo);`);
  return replaceSection(source, '  wasteFlows.visible=state.mode===\'waste\'||!!saved;if(wasteFlows.visible)for', '\n\n }',
    `  wasteFlows.visible = state.mode === 'waste' || !!saved;
  if (wasteFlows.visible) for (const halo of wasteFlows.children) {
   if (!halo.userData.flowHalo) continue;
   window.NZ_FLOW_HALO.step(halo, { rate: api.S.factory, dt: 0, speed: 0,
     shown: !api.S.reduceMotion && window.NZ_FLOWS.isEnabled('process'), emphasis: true });
   halo.material.uniforms.uPhase.value = (halo.userData.phaseOffset + state.distance * .025) % 1;
  }`);
}

module.exports = function patchFlowScripts(page) {
  const patches = {
    'campus-flows.js': source => fs.readFileSync(path.join(__dirname, 'flow-halo.js'), 'utf8') + '\n' + typed(source),
    'flow-renderer.js': legacy,
    'sst-visit.js': sst,
    'factory-anatomy.js': factory,
    'grid-to-chip.js': source => replaceOnce(replaceOnce(source, '    window.NZ_FLOW_RENDERER.afterVisibility();\n', ''),
      '(highlight?.62:.20):(active?.32:.12)', '(highlight?.46:.14):(active?.24:.12)'),
    'premium.js': source => replaceOnce(replaceSection(source, '    const cap = qForParticles();', '    window.NZ_VISUAL.beforeRender', ''),
      '    if (window.NZ_SOLAR) window.NZ_SOLAR.update();', `    window.NZ_FLOW_HALO.frame(renderer, night);
    window.NZ_FLOW_RENDERER.afterVisibility();
    if (window.NZ_SOLAR) window.NZ_SOLAR.update();`).replace('  const qForParticles = () => (QS[S.quality] || QS.standard).particles;\n', '')
  };
  const seen = new Set();
  const result = page.replace(/<script>\/\* ===== ([\w.-]+) ===== \*\/\r?\n([\s\S]*?)\r?\n<\/script>/g, (block, name, source) => {
    if (!Object.hasOwn(patches, name)) return block;
    if (seen.has(name)) throw new Error('Duplicate flow script: ' + name);
    seen.add(name);
    const code = patches[name](source.replace(/\r\n/g, '\n'));
    new vm.Script(code, { filename: name });
    return `<script>/* ===== ${name} ===== */\n${code}\n</script>`;
  });
  for (const name of Object.keys(patches)) if (!seen.has(name)) throw new Error('Missing flow script: ' + name);
  return result;
};
