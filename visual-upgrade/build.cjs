'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const v20 = path.join(root, 'NetZero-GridToChip-v20-VisitorPresentation/dist/Net-Zero-grid-premium.html');
const tools = path.join(root, 'tmp/three-r187-tools');
const revArg = process.argv.find(arg => arg.startsWith('--revision='));
const rev = Number(revArg?.split('=')[1] || 187);
if (![157, 167, 177, 187].includes(rev)) throw new Error('Unsupported revision: ' + rev);
const polish = rev === 187 && !process.argv.includes('--compat');
const bundleDir = rev === 187 ? path.join(__dirname, 'vendor') : path.join(tools, 'bundle-r' + rev);
const bundle = fs.readFileSync(path.join(bundleDir, 'three-r' + rev + '.js'), 'utf8');
const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');
const original = fs.readFileSync(v20, 'utf8');
const suffix = polish ? '视觉升级' : '兼容验证';
const seen = new Set();

function patchOnce(code, from, to) {
  if (code.split(from).length !== 2) throw new Error('Expected exactly one source anchor: ' + from);
  return code.replace(from, () => to);
}

const html = original.replace(/<script>\/\* ===== ([\w.-]+) ===== \*\/\r?\n([\s\S]*?)\r?\n<\/script>/g, (script, name, source) => {
  seen.add(name);
  let code = source;
  if (name === 'three.js') code = bundle;
  else if (name === 'orbit.js') code = '// OrbitControls is bundled with the matching Three.js revision.';
  else if (name === 'color-management.js') code = 'THREE.ColorManagement.enabled = true;';
  else if (name !== 'dcdt-app.js') {
    code = code.replace(/\.outputEncoding\s*=\s*THREE\.sRGBEncoding/g, '.outputColorSpace = THREE.SRGBColorSpace')
      .replace(/\.encoding\s*=\s*(THREE|T)\.sRGBEncoding/g, '.colorSpace = $1.SRGBColorSpace')
      .replaceAll('<encodings_fragment>', '<colorspace_fragment>');
    if (name === 'legacy-pres.js' && rev >= 182) code = code.replace('THREE.PCFSoftShadowMap', 'THREE.PCFShadowMap');
    if (name === 'post.js') {
      code = code.replaceAll('renderer.capabilities.isWebGL2', "(typeof gl.texImage3D === 'function')");
      if (polish) {
        code = patchOnce(code, 'uniform float uAO;', 'uniform float uAO;\n    uniform float uAOGain;');
        code = patchOnce(code, 'occlusion / 16.0 * 1.8', 'occlusion / 16.0 * uAOGain');
        code = patchOnce(code, 'uAO: { value: 1 }', 'uAO: { value: 1 }, uAOGain: { value: 1.8 }');
        code = patchOnce(code, 'vignette: .025, ao: true };', 'vignette: .025, ao: true, aoGain: 1.8 };');
        code = patchOnce(code, 'matComp.uniforms.uAO.value = params.ao ? 1 : 0;',
          'matComp.uniforms.uAO.value = params.ao ? 1 : 0;\n      matComp.uniforms.uAOGain.value = params.aoGain;');
      }
    }
    if (name === 'vehicles-anatomy.js' && polish) {
      code = patchOnce(code, 'new T.MeshStandardMaterial({color:color??tones[key]??0x718684,roughness:key===\'paint\'?.32:key===\'glass\'?.19:.64,metalness:[\'paint\',\'alloy\',\'trim\'].includes(key)?.3:.04})',
        'window.NZ_RENDER_POLISH.vehicleMaterial(T, key, color ?? tones[key] ?? 0x718684)');
    }
    if (name === 'factory-anatomy.js' && polish) {
      code = patchOnce(code, 'const result=new THREE.MeshStandardMaterial(options);',
        'const result=window.NZ_RENDER_POLISH.factoryMaterial(THREE, name, options);');
    }
    if (name === 'premium.js') {
      code = patchOnce(code, 'window.NZ_VISUAL.beforeRender(light, rimL);',
        'window.NZ_VISUAL.beforeRender(light, rimL);\n' +
        '    for (const light of [sunL, rimL, ambL, hemiL]) light.intensity *= Math.PI;\n' +
        (polish ? '    window.NZ_RENDER_POLISH.frame(light, camera, controls.target, sunL, hemiL, ambL, rimL, S, postObj);' : ''));
      if (polish) {
        code = patchOnce(code, '    window.NZ_VEHICLES.ready(window.__NZ_TEST);',
          '    window.NZ_VEHICLES.ready(window.__NZ_TEST);\n    window.NZ_RENDER_POLISH.setup(window.__NZ_TEST);');
      }
    }
  }
  if (polish && name === 'color-management.js') code += '\n' + read('render-polish.js');
  new vm.Script(code, { filename: name });
  return '<script>/* ===== ' + name + ' ===== */\n' + code + '\n</script>';
}).replace('</title>', ' · Three.js r' + rev + ' ' + suffix + '</title>');
for (const key of ['three.js', 'orbit.js', 'color-management.js', 'legacy-pres.js', 'post.js', 'premium.js', 'dcdt-app.js']) {
  if (!seen.has(key)) throw new Error('Missing v20 script: ' + key);
}
const dir = polish ? path.join(__dirname, 'dist') : tools;
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, polish ? '多园区-v20-r187-视觉升级.html' : 'v20-r' + rev + '-compat.html');
fs.writeFileSync(file, html, 'utf8');
console.log(file, Buffer.byteLength(html), 'bytes');
