'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { gzipSync } = require('node:zlib');

const root = path.resolve(__dirname, '../../..');
const tools = path.join(root, 'tmp/three-r187-tools');
const bundle = path.join(__dirname, 'vendor/GLTFLoader-r187.js');
const preview = '多园区-v20-r187-充电站写实.html';

async function buildLoader() {
  const pkg = path.resolve(process.env.THREE_PACKAGE || path.join(tools, 'r187/package'));
  const modulePath = path.join(pkg, 'build/three.module.js');
  const three = await import(pathToFileURL(modulePath));
  if (three.REVISION !== '187') throw new Error('Expected Three.js r187');
  const temp = path.join(tools, 'station-loader');
  fs.mkdirSync(temp, { recursive: true });
  fs.mkdirSync(path.dirname(bundle), { recursive: true });
  const shim = path.join(temp, 'shim.mjs');
  const entry = path.join(temp, 'entry.mjs');
  fs.writeFileSync(shim, 'export const { ' + Object.keys(three).join(', ') + ' } = globalThis.THREE;\n');
  const loader = path.join(pkg, 'examples/jsm/loaders/GLTFLoader.js').replaceAll('\\', '/');
  fs.writeFileSync(entry, `import { GLTFLoader } from ${JSON.stringify(loader)};\nglobalThis.THREE.GLTFLoader = GLTFLoader;\n`);
  const result = spawnSync(process.env.ESBUILD || path.join(tools, 'esbuild/package/esbuild.exe'), [
    entry, '--bundle', '--format=iife', '--minify', '--legal-comments=inline', '--alias:three=' + shim, '--outfile=' + bundle
  ], { stdio: 'inherit', windowsHide: true });
  if (result.status !== 0) throw result.error || new Error('GLTFLoader bundling failed');
}

async function build() {
  if (process.argv.includes('--rebuild-loader') || !fs.existsSync(bundle)) await buildLoader();
  const baseline = path.join(root, 'visual-upgrade/dist/多园区-v20-r187-视觉升级.html');
  const page = fs.readFileSync(baseline, 'utf8');
  const loader = fs.readFileSync(bundle, 'utf8');
  const adapter = fs.readFileSync(path.join(__dirname, 'station-adapter.js'), 'utf8');
  const plan = JSON.parse(fs.readFileSync(path.join(__dirname, 'station-plan.json'), 'utf8'));
  const glb = gzipSync(fs.readFileSync(path.join(__dirname, 'charging-station.glb')), { level: 9 });
  const payload = JSON.stringify({ plan, glb: glb.toString('base64') });
  const startup = page.indexOf('<script>/* ===== premium.js ===== */');
  const hook = '\n  boot();\n})();';
  const normalized = page.slice(startup).replace(/\r\n/g, '\n');
  if (startup < 0 || normalized.split(hook).length !== 2) throw new Error('Missing r187 startup hook');
  const scripts = [loader, 'window.STATION_PACK = ' + payload + ';', adapter].map(script => `<script>\n${script}\n</script>`).join('\n');
  const app = normalized.replace(hook, '\n  window.NZ_STATION_ASSET.prepare(window.__NZ_TEST).then(() => {\n    boot();\n    window.NZ_STATION_ASSET.showControls();\n  });\n})();');
  const out = path.join(__dirname, 'dist');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, preview), (page.slice(0, startup) + scripts + '\n' + app)
    .replace('</title>', ' · 充电站写实</title>'));
  console.log(preview, 'embedded compressed GLB:', glb.length, 'bytes');
}

build().catch(error => { console.error(error); process.exitCode = 1; });
