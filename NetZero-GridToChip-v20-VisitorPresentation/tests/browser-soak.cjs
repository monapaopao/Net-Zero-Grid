/* =====================================================================
 * 戈壁之光 · 零碳能量中枢 —— 浏览器实测运行器
 *
 *   node tests/browser-soak.cjs                 默认 1920×1080，标准刷新率上限
 *   node tests/browser-soak.cjs --no-limit      解除帧率上限（测 GPU 余量）
 *   node tests/browser-soak.cjs --size=1366x768 指定视口（验收清单要求 1366×768 可用）
 *
 * 做法：把 dist 单文件复制一份、在 </body> 前追加测试脚本与结果节点，
 * 用本地回环 HTTP 服务接收页面回传的 JSON（sendBeacon / fetch no-cors），
 * 收到即结束。所有路径都在本机回环，不访问外网。
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist', 'Net-Zero-grid-premium.html');
const SOAK = path.join(__dirname, 'soak-script.js');
const OUTDIR = path.join(ROOT, 'tests');

const CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];

const arg = k => {
  const m = process.argv.find(a => a.startsWith('--' + k + '='));
  return m ? m.split('=')[1] : null;
};
const NO_LIMIT = process.argv.includes('--no-limit');
const SIZE = arg('size') || '1920x1080';
const DPR = arg('dpr') || '1';
const TIMEOUT_MS = +(arg('timeout') || 300000);
const TAG = arg('tag') || (SIZE + '-dpr' + DPR + (NO_LIMIT ? '-nolimit' : ''));

function findBrowser() {
  for (const c of CANDIDATES) if (fs.existsSync(c)) return c;
  throw new Error('未找到 Chrome/Edge，请手工指定');
}

function buildPage(reportUrl) {
  if (!fs.existsSync(DIST)) throw new Error('缺少产物，请先运行 node build.cjs');
  let html = fs.readFileSync(DIST, 'utf8');
  const script = fs.readFileSync(SOAK, 'utf8');
  const inject =
    '<div id="soakResult" style="display:none"></div>\n' +
    '<script>window.__SOAK_REPORT_URL=' + JSON.stringify(reportUrl) + ';<\/script>\n' +
    '<script>' + script + '<\/script>\n';
  const i = html.lastIndexOf('</body>');
  if (i < 0) throw new Error('产物缺少 </body>');
  html = html.slice(0, i) + inject + html.slice(i);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nzsoak-'));
  const p = path.join(dir, 'soak.html');
  fs.writeFileSync(p, html, 'utf8');
  return { file: p, dir };
}

function main() {
  const browser = findBrowser();
  let resolveResult;
  const resultPromise = new Promise(r => { resolveResult = r; });
  let body = '';

  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    if (req.method === 'POST') {
      req.on('data', c => { body += c.toString('utf8'); });
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
        resolveResult(body);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('soak-report-endpoint');
  });

  server.listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    const reportUrl = 'http://127.0.0.1:' + port + '/report';
    const page = buildPage(reportUrl);

    const [w, h] = SIZE.split('x').map(Number);
    const args = [
      '--headless=new',
      '--no-first-run', '--no-default-browser-check', '--disable-extensions',
      '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
      '--disable-background-timer-throttling', '--disable-ipc-flooding-protection',
      '--hide-scrollbars', '--force-device-scale-factor=' + DPR,
      '--allow-file-access-from-files',
      '--window-size=' + w + ',' + h,
      '--user-data-dir=' + path.join(page.dir, 'ud')
    ];
    if (NO_LIMIT) args.push('--disable-frame-rate-limit', '--disable-gpu-vsync');

    const child = spawn(browser, args.concat(['file:///' + page.file.replace(/\\/g, '/')]), {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stderr = '';
    child.stderr.on('data', d => { stderr += d.toString(); });

    /* 兜底：超时未回传则直接落盘 stderr 并退出 */
    const timer = setTimeout(() => {
      console.log('【超时】' + (TIMEOUT_MS / 1000) + ' s 内未收到回传。');
      if (stderr.trim()) console.log('--- 浏览器 stderr（末 2000 字符）---\n' + stderr.slice(-2000));
      try { child.kill(); } catch (e) { }
      server.close();
      process.exitCode = 3;
    }, TIMEOUT_MS);

    resultPromise.then(text => {
      clearTimeout(timer);
      try { child.kill(); } catch (e) { }
      server.close();
      let data;
      try { data = JSON.parse(text); }
      catch (e) {
        console.log('回传内容不是合法 JSON：' + text.slice(0, 400));
        process.exitCode = 4; return;
      }
      data.runner = { browser, size: SIZE, dpr: DPR, noFrameLimit: NO_LIMIT, tag: TAG };
      const out = path.join(OUTDIR, 'browser-soak-' + TAG + '.json');
      fs.writeFileSync(out, JSON.stringify(data, null, 2), 'utf8');
      report(data, out);
      try { fs.rmSync(page.dir, { recursive: true, force: true }); } catch (e) { }
      process.exitCode = data.summary.fail > 0 || data.summary.errors > 0 ? 1 : 0;
    });
  });
}

function report(d, out) {
  console.log('');
  console.log('================== 浏览器实测结果 ==================');
  console.log('浏览器      : ' + d.runner.browser);
  console.log('视口        : ' + (d.env.viewport || '?') + '   （窗口 ' + d.runner.size +
    '，强制像素比 ' + d.runner.dpr + '）');
  console.log('GPU         : ' + (d.env.gpu || '?'));
  console.log('WebGL2      : ' + d.env.webgl2 + '   半浮点渲染目标: ' + d.env.halfFloatRT);
  console.log('Three.js    : r' + d.env.three + '   模型版本: v' + d.env.modelVersion);
  console.log('泛光可用    : ' + d.env.bloomAvailable + (d.env.bloomReason ? '（' + d.env.bloomReason + '）' : ''));
  console.log('场景绘制    : ' + d.env.sceneDrawCalls + ' 次调用 / ' + d.env.sceneTriangles +
    ' 三角面 / ' + d.env.scenePrograms + ' 个着色器程序');
  if (d.ui && d.ui.visibleLabels != null) {
    console.log('3D 标签     : 显式可见 ' + d.ui.visibleLabels + ' 个，重叠 ' +
      (d.ui.labelOverlaps ? d.ui.labelOverlaps.length : 0) + ' 对' +
      (d.ui.labelOverlaps && d.ui.labelOverlaps.length ? '（' + d.ui.labelOverlaps.join('；') + '）' : ''));
  }
  if (d.ui && d.ui.infoCard) {
    console.log('设备信息卡  : [' + d.ui.infoCard.x + ',' + d.ui.infoCard.y + '] ' +
      d.ui.infoCard.w + '×' + d.ui.infoCard.h + '  与运行面板重叠 ' + d.ui.infoCard.overlapWithDrawer + ' px²');
  }
  if (d.ui && d.ui.layout) {
    console.log('布局        : ' + d.ui.layout.viewport + '  品牌文字隐藏 ' + d.ui.css.brandTextHidden +
      '  摘要可见 ' + d.ui.css.summaryVisible + '  图例可见 ' + d.ui.css.legendVisible);
    for (const k in d.ui.layout.rects) {
      const b = d.ui.layout.rects[k];
      console.log('   #' + k.padEnd(10) + ' [' + b.x + ',' + b.y + '] ' + b.w + '×' + b.h);
    }
  }
  if (d.env.cameraAtMeasure) {
    console.log('测点视角    : 相机 [' + d.env.cameraAtMeasure.pos.join(', ') + ']  目标 [' +
      d.env.cameraAtMeasure.target.join(', ') + ']  自动环绕 ' + d.env.cameraAtMeasure.autoRotate);
  }
  console.log('耗时        : ' + (d.elapsedMs / 1000).toFixed(1) + ' s');
  console.log('');
  console.log('断言 ' + d.summary.pass + '/' + d.summary.total +
    '   运行时异常 ' + d.summary.errors + '   console.error ' + d.summary.consoleErrors);
  const bad = d.checks.filter(c => !c.ok);
  if (bad.length) {
    console.log('--- 未通过 ---');
    for (const c of bad) console.log('  ✗ ' + c.name + (c.info ? '  [' + c.info + ']' : ''));
  }
  if (d.errors.length) {
    console.log('--- 运行时异常 ---');
    for (const e of d.errors.slice(0, 12)) console.log('  ! ' + e);
  }
  if (d.consoleErrors.length) {
    console.log('--- console.error ---');
    for (const e of d.consoleErrors.slice(0, 12)) console.log('  ! ' + String(e).slice(0, 300));
  }
  console.log('');
  console.log('--- 帧率实测（headless 无物理显示器，' +
    (d.runner.noFrameLimit ? '已解除帧率上限' : 'Chrome 默认内部上限') +
    '；此数值反映 GPU 余量，不等同于可见窗口的垂直同步表现）---');
  for (const k of ['compat', 'standard', 'high']) {
    const p = d.perf[k];
    if (!p) continue;
    console.log('  ' + k.padEnd(9) + p.fps.toFixed(1).padStart(6) + ' fps   ' +
      '画面 ' + p.canvas + ' @dpr' + p.pixelRatio +
      '   渲染 ' + p.renderMs + ' ms   绘制 ' + p.draws + ' 次   ' +
      p.triangles + ' 三角面   阴影 ' + p.shadowMap + '   泛光 ' + p.bloom);
  }
  const auto = d.checks.filter(c => /降级/.test(c.name));
  console.log('  自动降级触发: ' + (auto.length ? '是' : '否'));
  console.log('');
  console.log('--- 七情景 24 小时（累计账本口径，单位 MWh / t）---');
  for (const s of d.scenarios) {
    const a = s.acc || {};
    console.log('  ' + s.key.padEnd(10) +
      ' 发 ' + String(a.genMWh).padStart(8) + '  购 ' + String(a.buyMWh).padStart(7) +
      '  弃 ' + String(a.curtailMWh).padStart(7) + '  供 ' + String(a.loadMWh).padStart(8) +
      '  充/放 ' + String(a.chargeMWh).padStart(7) + '/' + String(a.dischargeMWh).padStart(7) +
      '  未供 ' + String(a.unservedMWh).padStart(6) + '  氨 ' + String(a.nh3T).padStart(7));
    console.log('            闭合残差 ' + Number(a.closureMWh).toExponential(2) +
      ' MWh   来源成分合计 ' + a.consumptionTotalMWh + ' MWh（=用电量 ' + a.loadMWh + '）' +
      '   末态 SOC ' + s.soc.toFixed(1) + '% / 氢 ' + s.h2Kg.toFixed(0) + ' kg' +
      '   可再生 ' + (s.renewShare * 100).toFixed(1) + '%   求解 ' + s.solverIters + ' 轮' +
      '   推进 ' + s.ms + ' ms');
  }
  console.log('');
  console.log('结果文件: ' + path.relative(ROOT, out));
  console.log('====================================================');
}

main();
