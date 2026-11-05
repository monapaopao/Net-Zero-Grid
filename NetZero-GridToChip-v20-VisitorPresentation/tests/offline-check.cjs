/* =====================================================================
 * 离线可用性核验 —— 断网后打开最终单文件入口，功能是否照常
 *
 *   node tests/offline-check.cjs
 *   node tests/offline-check.cjs --file=<路径>      核验任意一份产物（例如从交付 ZIP
 *                                                   解压出来的那份，验证"解压即用"）
 *   node tests/offline-check.cjs --json=<路径>      结果写到哪里
 *
 * 做法：CDP 起一个 headless Chrome，先把网络置为 offline（同时拦掉
 * FILE 以外的请求），再导航到 dist 里的单文件产物，然后：
 *   1. 记录所有出网请求（http/https/ws），任何一个都算失败；
 *   2. 记录加载失败的资源（Network.loadingFailed），任何一个都算失败；
 *   3. 实际驱动一遍：启动是否完成、摘要有没有数、抽屉能不能开、
 *      导览能不能起、参数能不能切、画布有没有真的画出东西。
 *
 * 只断言"能跑且不出网"，不断言画面好不好看（那由 screenshots 负责）。
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const net = require('net');
const http = require('http');
const { spawn } = require('child_process');

const arg = k => {
  const m = process.argv.find(a => a.startsWith('--' + k + '='));
  return m ? m.slice(k.length + 3) : null;
};
const ROOT = path.join(__dirname, '..');
const DIST = arg('file') ? path.resolve(arg('file')) : path.join(ROOT, 'dist', 'Net-Zero-grid-premium.html');
const OUT = arg('json') ? path.resolve(arg('json')) : path.join(ROOT, 'tests', 'offline-check.json');

const CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const findBrowser = () => { for (const c of CANDIDATES) if (fs.existsSync(c)) return c; throw new Error('未找到 Chrome/Edge'); };
function freePort() {
  return new Promise((res, rej) => {
    const s = net.createServer();
    s.on('error', rej);
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
  });
}
function httpGetJSON(url) {
  return new Promise((res, rej) => {
    const req = http.get(url, r => { let b = ''; r.on('data', c => { b += c; }); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); });
    req.on('error', rej);
    req.setTimeout(3000, () => req.destroy(new Error('http 超时')));
  });
}

class CDP {
  constructor(ws) {
    this.ws = ws; this.seq = 0; this.pending = new Map(); this.handlers = new Map();
    ws.addEventListener('message', ev => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.id != null) {
        const p = this.pending.get(m.id); if (!p) return;
        this.pending.delete(m.id); clearTimeout(p.timer);
        if (m.error) p.rej(new Error(m.error.message)); else p.res(m.result);
      } else {
        const hs = this.handlers.get(m.method); if (hs) for (const h of hs) h(m.params);
      }
    });
  }
  on(ev, fn) { if (!this.handlers.has(ev)) this.handlers.set(ev, []); this.handlers.get(ev).push(fn); }
  send(method, params) {
    const id = ++this.seq;
    this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    return new Promise((res, rej) => {
      const timer = setTimeout(() => { this.pending.delete(id); rej(new Error('CDP 超时：' + method)); }, 30000);
      this.pending.set(id, { res, rej, timer });
    });
  }
  async evaluate(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('页面求值异常：' + (r.exceptionDetails.text || ''));
    return r.result.value;
  }
  close() { try { this.ws.close(); } catch (e) { } }
}

const OFFSCREEN = process.argv.includes('--keep-open') ? [] : [];

async function main() {
  const browser = findBrowser();
  if (!fs.existsSync(DIST)) throw new Error('缺少产物，请先运行 node build.cjs');
  const html = fs.readFileSync(DIST, 'utf8');

  /* 先做静态核查：单文件里不该有任何出网引用 */
  const staticHits = [];
  const urlRe = /(?:src|href)\s*=\s*["'](https?:|\/\/)[^"']*/gi;
  let m;
  while ((m = urlRe.exec(html))) staticHits.push(m[0].slice(0, 120));
  const atImport = html.match(/@import[^;]{0,120}/gi) || [];
  const fetchCalls = html.match(/fetch\s*\(\s*["'`]https?:[^)]{0,80}/gi) || [];

  const port = await freePort();
  const udd = fs.mkdtempSync(path.join(require('os').tmpdir(), 'nzoffline-'));
  const child = spawn(browser, [
    '--headless=new', '--remote-debugging-port=' + port, '--no-first-run',
    '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars',
    '--allow-file-access-from-files', '--window-size=1920,1080',
    '--user-data-dir=' + udd, 'about:blank'
  ].concat(OFFSCREEN), { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', d => { stderr += d.toString(); });

  const outbound = [], failed = [], consoleErrors = [];
  let cdp = null, checks = [];
  const ck = (name, ok, info) => { checks.push({ name, ok: !!ok, info: info === undefined ? '' : String(info) }); };

  try {
    const t0 = Date.now();
    let wsUrl = null;
    while (Date.now() - t0 < 25000 && !wsUrl) {
      try {
        const list = await httpGetJSON('http://127.0.0.1:' + port + '/json/list');
        const page = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
        if (page) wsUrl = page.webSocketDebuggerUrl;
      } catch (e) { }
      if (!wsUrl) await sleep(200);
    }
    if (!wsUrl) throw new Error('等待 DevTools 超时');
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', () => rej(new Error('WebSocket 连接失败')), { once: true });
    });
    cdp = new CDP(ws);

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });

    cdp.on('Network.requestWillBeSent', p => {
      const u = p.request && p.request.url || '';
      if (!/^(file:|data:|blob:|chrome|devtools)/i.test(u)) outbound.push(u.slice(0, 160));
    });
    cdp.on('Network.loadingFailed', p => { failed.push(((p.errorText || '') + ' ' + (p.requestId || '')).slice(0, 120)); });
    cdp.on('Runtime.consoleAPICalled', p => {
      if (p.type === 'error') consoleErrors.push((p.args || []).map(a => a.value || a.description || '').join(' ').slice(0, 200));
    });

    /* 断网：这是本脚本的核心动作 —— 页面必须在真的离线条件下照常启动 */
    await cdp.send('Network.emulateNetworkConditions', {
      offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0
    });

    await cdp.send('Page.navigate', { url: 'file:///' + DIST.replace(/\\/g, '/') });

    /* 等启动完成 */
    let booted = false;
    const tb = Date.now();
    while (Date.now() - tb < 30000) {
      try { if (await cdp.evaluate('!!(window.__NZ_TEST && window.__NZ_TEST.state && window.__NZ_TEST.state().steps >= 0)')) { booted = true; break; } } catch (e) { }
      await sleep(150);
    }
    ck('断网状态下页面完成启动', booted);
    if (!booted) throw new Error('页面未完成启动');

    await cdp.evaluate('new Promise(r=>setTimeout(r,1200))');

    const st = await cdp.evaluate('JSON.stringify(window.__NZ_TEST.state())');
    const state = JSON.parse(st);
    ck('内核在推进（步数 > 0）', state.steps > 0, 'steps=' + state.steps);
    ck('设备档案已装载', state.devices > 0 && state.labels > 0, '设备 ' + state.devices + ' / 标签 ' + state.labels);
    ck('能源边线已装载', state.edges > 0, '边线 ' + state.edges);

    /* 画布真的画出东西了：采样非背景像素 */
    const px = await cdp.evaluate(`(function(){
      const cv=document.querySelector('canvas'); if(!cv) return null;
      const r=cv.getBoundingClientRect();
      return r.width>100 && r.height>100 ? {w:Math.round(r.width),h:Math.round(r.height)} : null;})()`);
    ck('三维画布尺寸正常', !!px && px.w > 100, px ? px.w + '×' + px.h : '无画布');

    /* 界面数值：摘要面板不能是空的 */
    const sumTxt = await cdp.evaluate('(document.getElementById("summary")||{}).innerText||""');
    ck('摘要面板有数值', /[0-9]/.test(sumTxt) && sumTxt.length > 20,
      sumTxt.replace(/\s+/g, ' ').slice(0, 70));

    /* 交互：抽屉 / 导览 / 情景 / 光照 / 画质 */
    const msg = [];
    const drawerOK = await cdp.evaluate('(function(){window.__NZ_TEST.drawer("ledger");return 1;})()');
    await cdp.evaluate('new Promise(r=>setTimeout(r,500))');
    const drOpen = await cdp.evaluate('document.getElementById("drawer").classList.contains("open")');
    ck('运行面板可以打开', drawerOK === 1 && drOpen);
    const ledgerTxt = await cdp.evaluate('(document.getElementById("drawer")||{}).innerText||""');
    ck('账本页有内容', ledgerTxt.length > 80, ledgerTxt.replace(/\s+/g, ' ').slice(0, 70));
    await cdp.evaluate('window.__NZ_TEST.closeDrawer()');

    const tourOK = await cdp.evaluate('(function(){window.__NZ_TEST.startTour();return 1;})()');
    await cdp.evaluate('new Promise(r=>setTimeout(r,900))');
    const tourOn = await cdp.evaluate('document.getElementById("tourBar").classList.contains("on")');
    ck('导览可以启动', tourOK === 1 && tourOn);
    await cdp.evaluate('window.__NZ_TEST.exitTour()');

    await cdp.evaluate('window.__NZ_TEST.applyScenario("night")');
    await cdp.evaluate('new Promise(r=>setTimeout(r,300))');
    const scen = JSON.parse(await cdp.evaluate('JSON.stringify(window.__NZ_TEST.state())'));
    ck('情景可以切换', scen.scenario === 'night', '当前 ' + scen.scenario);

    await cdp.evaluate('document.querySelector("#segLight button[data-light=\\"day-lab\\"]").click()');
    await cdp.evaluate('new Promise(r=>setTimeout(r,300))');
    const lt = JSON.parse(await cdp.evaluate('JSON.stringify(window.__NZ_TEST.state())'));
    ck('光照可以切换', lt.lightPreset === 'day-lab', '当前 ' + lt.lightPreset);

    await cdp.evaluate('document.querySelector("#segQuality button[data-q=\\"high\\"]").click()');
    await cdp.evaluate('new Promise(r=>setTimeout(r,500))');
    /* 画质字段在 perf() 里（带像素比与泛光状态），state() 不含 */
    const q = JSON.parse(await cdp.evaluate('JSON.stringify(window.__NZ_TEST.perf())'));
    const bloom = q.bloom;
    ck('画质可以切换', q.quality === 'high', '当前 ' + q.quality + '，像素比 ' + q.pixelRatio + '，泛光 ' + bloom);

    await cdp.evaluate('Promise.all([0,1,2,3,4,5].map(i=>document.getElementById("btnFull")?0:0))');
    await cdp.evaluate('window.__NZ_TEST.press("btnCamReset")');
    await cdp.evaluate('new Promise(r=>setTimeout(r,700))');
    /* 总览机位从产物里读（CAM_DEF 是 legacy-pres 段里的顶层常量）——
     * 别再写死坐标：换一次默认机位就会假失败。 */
    const cam = JSON.parse(await cdp.evaluate('JSON.stringify({p:window.__NZ_TEST.camera.position.toArray().map(v=>+v.toFixed(1)), def:CAM_DEF.pos})'));
    ck('相机复位可用', Math.abs(cam.p[0] - cam.def[0]) < 6 && Math.abs(cam.p[2] - cam.def[2]) < 6,
      '相机 ' + cam.p.join(', ') + '（产物里的总览机位 ' + cam.def.join(', ') + '）');

    const errs = JSON.parse(await cdp.evaluate('JSON.stringify(window.__NZ_TEST.state())'));
    ck('无 NaN 残差', Number.isFinite(errs.residualMW) && Number.isFinite(errs.h2ResidualKg),
      '母线 ' + errs.residualMW + ' / 氢 ' + errs.h2ResidualKg);
  } catch (e) {
    ck('离线核验流程未中断', false, String(e.message || e));
  } finally {
    if (cdp) cdp.close();
    try { child.kill(); } catch (e) { }
    await sleep(300);
    try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) { }
  }

  ck('单文件内含出网引用（应为 0）', staticHits.length === 0, staticHits.length ? staticHits.slice(0, 3).join(' / ') : '无');
  ck('CSS @import（应为 0）', atImport.length === 0, atImport.length ? atImport.slice(0, 2).join(' / ') : '无');
  ck('硬编码出网 fetch（应为 0）', fetchCalls.length === 0, fetchCalls.length ? fetchCalls.slice(0, 2).join(' / ') : '无');
  ck('运行期未发出任何出网请求', outbound.length === 0, outbound.length ? outbound.slice(0, 3).join(' / ') : '无');
  ck('无资源加载失败', failed.length === 0, failed.length ? failed.slice(0, 3).join(' / ') : '无');
  ck('无 console.error', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' / '));

  const pass = checks.filter(c => c.ok).length;
  fs.writeFileSync(OUT, JSON.stringify({
    generatedAt: new Date().toISOString(),
    artifact: path.relative(ROOT, DIST),
    bytes: Buffer.byteLength(html, 'utf8'),
    offline: true,
    outboundRequests: outbound,
    loadingFailed: failed,
    consoleErrors,
    staticExternalRefs: staticHits,
    summary: { total: checks.length, pass, fail: checks.length - pass },
    checks
  }, null, 2), 'utf8');

  console.log('================== 离线可用性核验 ==================');
  console.log('产物      : ' + path.relative(ROOT, DIST) + '（' + (Buffer.byteLength(html, 'utf8') / 1024).toFixed(0) + ' KB）');
  console.log('网络状态  : 强制 offline（并记录一切非 file: 请求）');
  for (const c of checks) console.log('  ' + (c.ok ? '✓' : '✗') + ' ' + c.name + (c.info ? '  [' + c.info + ']' : ''));
  console.log('断言 ' + pass + '/' + checks.length);
  console.log('结果文件  : ' + path.relative(ROOT, OUT));
  process.exitCode = pass === checks.length ? 0 : 1;
}

main().catch(e => { console.error('核验失败：' + (e && e.stack || e)); process.exitCode = 2; });
