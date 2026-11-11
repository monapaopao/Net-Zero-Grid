'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const vm = require('node:vm');
const patchFlows = require('../shared/flow-build.cjs');
const patchLabels = require('../shared/label-controls.cjs');
const projectVersion = require('../../scripts/project-version.cjs');
const root = path.resolve(__dirname, '../..');
const pkg = path.join(root, 'tmp/three-r187-tools/r187/package');
const vendor = path.join(__dirname, 'vendor');
fs.mkdirSync(vendor, { recursive: true });
const bundle = path.join(vendor, 'three-webgpu-r187.js');
if (process.argv.includes('--rebuild-engine') || !fs.existsSync(bundle)) {
const manifest = JSON.parse(fs.readFileSync(path.join(pkg, 'package.json'), 'utf8'));
if(manifest.version !== '0.187.0') throw new Error('Expected three@0.187.0');
const result = spawnSync(process.env.ESBUILD || path.join(root, 'tmp/three-r187-tools/esbuild/package/esbuild.exe'), [
  path.join(__dirname, 'engine.mjs'), '--bundle', '--format=iife', '--minify',
  '--alias:three=' + path.join(pkg, 'build/three.webgpu.js'),
  '--alias:three/webgpu=' + path.join(pkg, 'build/three.webgpu.js'),
  '--alias:three/tsl=' + path.join(pkg, 'build/three.tsl.js'),
  '--alias:three/addons=' + path.join(pkg, 'examples/jsm'), '--outfile=' + bundle
], { stdio: 'inherit', windowsHide: true });
if (result.status !== 0) throw new Error('WebGPU bundle failed');
}
function once(s, a, b) {
  if (s.split(a).length !== 2) throw new Error('Missing or ambiguous anchor: ' + a);
  return s.replace(a, () => b);
}
let html = patchLabels(patchFlows(fs.readFileSync(path.join(__dirname, '../dist/多园区-v20-r187-视觉升级.html'), 'utf8')));
html = html.replace(/<script>\/\* ===== ([\w.-]+) ===== \*\/\r?\n([\s\S]*?)\r?\n<\/script>/g, (block, name, code) => {
  if (name === 'three.js') code = fs.readFileSync(bundle, 'utf8');
  if (name === 'post.js') code = '// TSL post-processing is bundled with the WebGPU engine.';
  if (name === 'legacy-pres.js') {
    code = once(code, 'new THREE.WebGLRenderer({ canvas: cv, antialias: true })',
      "new THREE.WebGPURenderer({ canvas: cv, antialias: true, forceWebGL: new URLSearchParams(location.search).has('forceWebGL') })");
  }
  if (name === 'factory-anatomy.js') {
    code = code.replace(/function configurePV\(m\)\{[\s\S]*?\n \}/, 'function configurePV(m){ window.NZ_GPU.configurePV(m); }');
  }
  if (name === 'color-management.js') {
    code = code.replaceAll('new T.MeshStandardMaterial(', 'new T.MeshStandardNodeMaterial(')
      .replaceAll('new T.MeshPhysicalMaterial(', 'new T.MeshPhysicalNodeMaterial(');
  }
  if (name === 'premium.js') {
    code = once(code, 'function boot() {', 'async function boot() {\n    await window.NZ_GPU.init(renderer);');
    code = once(code, 'if (!renderer.getContext().isContextLost()) {',
      'if (!window.NZ_GPU.lost) {\n      window.NZ_GPU.updateParticles();\n      renderer.info.reset();');
    code = code.replaceAll('renderer.info.render.calls', 'renderer.info.render.drawCalls');
    code = once(code, '  boot();', `  boot().then(() => {
    window.NZ_GPU.ready = true;
    document.title = '[' + NZ_GPU.backend + ' · ' + NZ_GPU.effect + '] ' + document.title;
  }).catch(error => {
    window.NZ_GPU.error = error.message;
    console.error(error);
    const notice = document.createElement('p');
    notice.id = 'webgpu-startup-error';
    notice.setAttribute('role', 'alert');
    notice.textContent = 'WebGPU 启动失败：' + error.message;
    document.title = '[WebGPU 不可用] ' + document.title;
    Object.assign(notice.style, {position:'fixed',top:'0',left:'0',zIndex:99999,background:'white',padding:'16px'});
    document.body.appendChild(notice);
  });`);
  }
  new vm.Script(code, { filename: name });
  return '<script>/* ===== ' + name + ' ===== */\n' + code + '\n</script>';
});
html = html.replace('视觉升级</title>', '原生模型 · WebGPU</title>');
html = projectVersion.patch(html);
html = require('./modes-build.cjs')(html);
projectVersion.docs();
const out = path.join(__dirname, 'dist');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, '多园区-v20-r187-WebGPU.html'), html);
console.log('Built native Three.js / WebGPU presentation with retained halos and label controls');
