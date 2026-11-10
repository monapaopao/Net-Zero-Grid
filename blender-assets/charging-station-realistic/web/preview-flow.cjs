'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');
const bundled = path.join(process.env.USERPROFILE || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || bundled);

async function run() {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true, args: ['--enable-gpu', '--use-angle=d3d11'] });
  const evidence = path.join(__dirname, 'evidence');
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.join(__dirname, 'dist/多园区-v20-r187-充电站写实.html')).href);
    await page.waitForSelector('#flowLayers', { state: 'attached' });
    await page.addStyleTag({ content: 'body *{visibility:hidden!important} #gridCanvas{visibility:visible!important} #canvasWrap,#sceneFrame{position:fixed!important;inset:0!important;border:0!important} #labels3d,#vignette{display:none!important}' });
    await page.evaluate(() => {
      const api = __NZ_TEST;
      api.S.running = false;
      document.querySelector('#segQuality [data-q="high"]').click();
      api.resize();
      api.controls.autoRotate = false;
      api.controls.enableDamping = false;
    });
    const data = await page.evaluate(async () => {
      const api = __NZ_TEST;
      const video = document.createElement('canvas');
      video.width = 1440;
      video.height = 810;
      const context = video.getContext('2d');
      const chunks = [];
      const stream = video.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 8000000 });
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      let label = '';
      let drawing = true;
      function draw() {
        if (!drawing) return;
        context.drawImage(api.renderer.domElement, 0, 0, 1440, 810);
        context.fillStyle = 'rgba(16,35,39,.86)';
        context.fillRect(0, 754, 1440, 56);
        context.fillStyle = '#fff';
        context.font = '22px "Microsoft YaHei",sans-serif';
        context.fillText(label, 28, 790);
        requestAnimationFrame(draw);
      }
      draw();
      recorder.start();
      const poses = [
        { label: '园区全景 · 日间', focus: 'overview', pose: api.TOUR_HOME, night: false },
        { label: '充电站 · 日间', focus: 'public', pose: { pos: [63, 25, 114], tgt: [40, 1.4, 79] }, night: false },
        { label: '工厂 · 日间', focus: 'factory', pose: { pos: [345, 51, 157], tgt: [281, 1.7, 108] }, night: false },
        { label: '充电站 · 夜景预设', focus: 'public', pose: { pos: [63, 25, 114], tgt: [40, 1.4, 79] }, night: true }
      ];
      for (const view of poses) {
        label = view.label;
        NZ_FLOWS.context(view.focus);
        NZ_FACTORY.setOpen(view.focus === 'factory', { immediate: true });
        api.S.lightPreset = view.night ? 'night' : 'day-lab';
        api.cancelCamera();
        api.camera.position.fromArray(view.pose.pos);
        api.controls.target.fromArray(view.pose.tgt);
        api.controls.update();
        const started = performance.now();
        while (performance.now() - started < 4000) await new Promise(requestAnimationFrame);
      }
      const complete = new Promise(resolve => { recorder.onstop = resolve; });
      recorder.stop();
      await complete;
      drawing = false;
      stream.getTracks().forEach(track => track.stop());
      const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
      let binary = '';
      for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
      return btoa(binary);
    });
    if (errors.length) throw new Error(errors.join('\n'));
    const temp = path.resolve(__dirname, '../../../tmp/flow-visibility-preview.webm');
    fs.writeFileSync(temp, Buffer.from(data, 'base64'));
    const ffmpeg = process.env.FFMPEG || path.resolve(__dirname, '../../../tmp/v20-film/tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v9.0.2.exe');
    const result = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', temp,
      '-an', '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      path.join(evidence, 'flow-visibility-preview.mp4')], { stdio: 'inherit', windowsHide: true });
    if (result.status !== 0) throw result.error || new Error('Video conversion failed');
    console.log('Recorded 16-second flow preview');
  } finally {
    await browser.close();
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
