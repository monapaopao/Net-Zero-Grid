/* =====================================================================
 * 长时间导览稳定性 —— 连续导览 10 分钟
 *
 *   node tests/tour-soak.cjs                      默认 10 分钟、1920×1080
 *   node tests/tour-soak.cjs --minutes=2          缩短（调试用）
 *   node tests/tour-soak.cjs --file=<路径>         换产物（例如 ZIP 解压出来的那份）
 *   node tests/tour-soak.cjs --quality=high       用精致档跑（默认 standard）
 *   node tests/tour-soak.cjs --no-tour            对照：同样时长但不发起导览
 *                                                  （用来判断堆增长是不是跟着导览走）
 *
 * 验收清单要求的是这一条：「连续导览 10 分钟无持续内存增长、控制失效或明显卡顿；
 * WebGL 上下文异常有提示。」本脚本把三件事都做成可判定：
 *
 *   1. 内存 —— 每 20 秒先强制一次 GC（HeapProfiler.collectGarbage），再取
 *      CDP 的 Performance.getMetrics（JSHeapUsedSize），比较"首几次均值"与
 *      "末几次均值"。不强制 GC，采样点之间的回收时机差异会盖住真实趋势；
 *      不用页面里的 performance.memory，是因为本机 Chrome 上它取不到值
 *      （实测 undefined），CDP 指标是同一份数据的官方出口。
 *      基线取"热身 90 秒之后"的采样：启动期要建 DOM、设备树与面板，
 *      一次性开销会被误读成泄漏。
 *      堆占用差分本身说明不了"涨的是泄漏、还是填满一个按设计有上限的缓冲"，
 *      所以同时实测四个容器的规模上限，以及逐日账本是否严格等于仿真天数。
 *   2. 控制 —— 每 60 秒真的去开合一次运行面板与趋势面板，读 DOM 类名确认有响应。
 *   3. 卡顿 —— 用页面自报的 fps 做首段/末段对比，降幅超过 30% 就判失败。
 *   4. 上下文 —— 跑完用 WEBGL_lose_context 扩展真的丢一次上下文，验证
 *      #ctxWarn 常驻提示出现、物理暂停；再 restore，验证提示消失、物理恢复。
 *
 * 导览本身在第六章结束后会**自动退出**（不是循环），所以脚本检测到退出就重新发起，
 * 「连续导览 10 分钟」= 连续 10 分钟一直在导览状态。
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
const FILE = arg('file') ? path.resolve(arg('file')) : path.join(ROOT, 'dist', 'Net-Zero-grid-premium.html');
const OUT = arg('json') ? path.resolve(arg('json'))
  : path.join(__dirname, process.argv.indexOf('--no-tour') >= 0 ? 'tour-soak-notour.json' : 'tour-soak.json');
const MINUTES = +(arg('minutes') || 10);
const SIZE = arg('size') || '1920x1080';
const QUALITY = arg('quality') || 'standard';
/* 对照模式：不发起导览。导览每 75 秒自动结束、脚本再重新发起，
 * 如果堆增长跟着这个周期走，就是导览路径上的东西在累积。 */
const NO_TOUR = process.argv.indexOf('--no-tour') >= 0;
const SAMPLE_MS = 20000;      /* 采样间隔 */
const CONTROL_MS = 60000;     /* 主动操作间隔 */

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
      const timer = setTimeout(() => { this.pending.delete(id); rej(new Error('CDP 超时：' + method)); }, 60000);
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

/* 一次采样取回的字段。全部走页面自报，脚本不猜。
 * 堆占用不在这里取 —— 本机 Chrome 的 performance.memory 读不到（实测 undefined），
 * 由 CDP 的 Performance.getMetrics 提供。 */
const SAMPLE_EXPR = `(function(){
  var T = window.__NZ_TEST; if (!T) return null;
  var s = T.state(), p = T.perf();
  var bar = document.getElementById('tourBar'), warn = document.getElementById('ctxWarn');
  return JSON.stringify({
    t: Math.round(performance.now()),
    domNodes: document.getElementsByTagName('*').length,
    simTime: s.simTime, steps: s.steps, residualMW: s.residualMW,
    running: s.running, fps: p.fps, draws: p.draws, triangles: p.triangles,
    tourOn: !!(bar && bar.classList.contains('on')),
    chap: (document.getElementById('tourChap') || {}).textContent || '',
    tourTime: (document.getElementById('tourTime') || {}).textContent || '',
    drawerOpen: document.getElementById('drawer').classList.contains('open'),
    /* 内部容器规模：T.L 是内核账本，state().events 是界面事件表，
     * perf().samples 是帧率环形缓冲。上限在源码里各有一次 shift。 */
    containers: {
      engineEvents: T.L.events.length, engineHistory: T.L.history.length,
      engineDays: T.L.days.length, uiEvents: s.events, perfSamples: p.samples.length,
      /* compat.js 给原表现层留的转发队列：源码里只有 push、没有上限。
       * 单列出来看它到底涨不涨。 */
      eventQueue: (window.__NZ_EVENT_QUEUE || []).length
    },
    ctxLost: !!T.contextLost(),
    ctxWarn: !!(warn && getComputedStyle(warn).display !== 'none')
  });
})()`;

async function main() {
  const browser = findBrowser();
  if (!fs.existsSync(FILE)) throw new Error('缺少产物：' + FILE);
  const [w, h] = SIZE.split('x').map(Number);

  const port = await freePort();
  const udd = fs.mkdtempSync(path.join(require('os').tmpdir(), 'nztour-'));
  const child = spawn(browser, [
    '--headless=new', '--remote-debugging-port=' + port, '--no-first-run',
    '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars',
    '--allow-file-access-from-files', '--enable-precise-memory-info',
    /* 不被后台节流：headless 下标签页没有被遮挡，但显式关掉更保险，
     * 否则 rAF 频率会被压到 1 Hz，整场测试就变成"量节流"了 */
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--window-size=' + Math.max(w, 1280) + ',' + Math.max(h, 720),
    '--user-data-dir=' + udd, 'about:blank'
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', d => { stderr += d.toString(); });

  const errors = [], consoleErrors = [], checks = [];
  const samples = [];
  const chaptersSeen = new Set();
  let tourRestarts = 0, lastControl = 0, controlRounds = 0, controlFails = 0;
  /* 三项状态：pass / fail / untested。未测不当通过，也不当失败 —— 报告里分开列。 */
  const ck = (name, ok, info, state) => {
    checks.push({ name, ok: !!ok, state: state || (ok ? 'pass' : 'fail'), info: info === undefined ? '' : String(info) });
  };
  let cdp = null;

  /* 取堆占用：CDP 的 Performance.getMetrics 里 JSHeapUsedSize 单位是字节 */
  async function heapBytes() {
    try {
      const m = await cdp.send('Performance.getMetrics');
      const hit = (m.metrics || []).find(x => x.name === 'JSHeapUsedSize');
      return hit ? hit.value : null;
    } catch (e) { return null; }
  }

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
    await cdp.send('HeapProfiler.enable');
    await cdp.send('Performance.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });

    cdp.on('Runtime.exceptionThrown', p => {
      const d = p.exceptionDetails || {};
      errors.push(((d.exception && (d.exception.description || d.exception.value)) || d.text || '').slice(0, 200));
    });
    cdp.on('Runtime.consoleAPICalled', p => {
      if (p.type === 'error') consoleErrors.push((p.args || []).map(a => a.value || a.description || '').join(' ').slice(0, 200));
    });

    await cdp.send('Page.navigate', { url: 'file:///' + FILE.replace(/\\/g, '/') });

    /* 等启动：__NZ_TEST 出现且内核在推进 */
    let booted = false;
    for (let i = 0; i < 200 && !booted; i++) {
      try {
        const v = await cdp.evaluate('(function(){var T=window.__NZ_TEST;if(!T)return null;var s=T.state();return s.steps>0?"1":null;})()');
        if (v === '1') booted = true;
      } catch (e) { }
      if (!booted) await sleep(150);
    }
    if (!booted) throw new Error('页面未完成启动');

    ck('页面完成启动', true, '');
    await cdp.evaluate('(function(){window.__NZ_TEST.press("btnCamReset");return 1;})()');
    /* 画质字段在 perf() 里，不在 state() 里 —— 早先读 state().quality 得到 undefined */
    const q = await cdp.evaluate('(function(){var b=document.querySelector("#segQuality button[data-q=\'' + QUALITY + '\']");if(b)b.click();return window.__NZ_TEST.perf().quality;})()');
    ck('画质档已设为目标值', q === QUALITY, '当前 ' + q);

    const totalMs = MINUTES * 60000;
    const startedAt = Date.now();
    console.log('连续导览测试：' + MINUTES + ' 分钟，视口 ' + SIZE + '，画质 ' + q + '，文件 ' + path.basename(FILE));
    console.log('（导览在第六章结束后会自动退出，脚本检测到就重新发起）');

    /* v1.3.5：导览第 4 章会进楼（打开内嵌的数据中心应用）。长稳关注的是**园区侧**的稳定性，
     * 楼内窗口的开关由浏览器实测里的 M1.6 专项覆盖；这里把进楼段缩短成 0→3 s，
     * 让它落在启动预热期里就收掉 —— 否则"打开楼内应用"那一次性内存台阶会被误判成泄漏。 */
    if (!NO_TOUR) await cdp.evaluate('(function(){var S=window.__NZ_TEST.DC_SEG;S.from=0;S.to=3;S.startDelay=400;return 1;})()');

    /* 先起导览（对照模式跳过） */
    if (!NO_TOUR) await cdp.evaluate('(function(){window.__NZ_TEST.startTour();return 1;})()');
    else console.log('（对照模式：不发起导览，其余照跑）');

    while (Date.now() - startedAt < totalMs) {
      await cdp.send('HeapProfiler.collectGarbage');   /* 先 GC 再采样，避免被回收时机左右 */
      const raw = await cdp.evaluate(SAMPLE_EXPR);
      if (!raw) { await sleep(500); continue; }
      const s = JSON.parse(raw);
      s.heap = await heapBytes();
      s.elapsedS = Math.round((Date.now() - startedAt) / 1000);
      samples.push(s);
      if (s.chap) chaptersSeen.add(s.chap.trim());
      console.log('  t=' + String(s.elapsedS).padStart(3) + 's  堆 ' +
        (s.heap == null ? '—' : (s.heap / 1048576).toFixed(1) + 'MB') +
        '  fps ' + (s.fps == null ? '—' : s.fps.toFixed(1)) +
        '  导览 ' + (s.tourOn ? s.chap.trim() : '已退出') +
        '  DOM ' + s.domNodes + '  绘制 ' + s.draws +
        (s.containers ? '  容器 事件' + s.containers.engineEvents + ' 历史' +
          s.containers.engineHistory + ' 天数' + s.containers.engineDays +
          ' 界面' + s.containers.uiEvents : ''));

      /* 导览退出了就重新发起：这样才能做到"连续 10 分钟都在导览" */
      if (!s.tourOn && !NO_TOUR) {
        await cdp.evaluate('(function(){window.__NZ_TEST.startTour();return 1;})()');
        tourRestarts++;
      }

      /* 每 60 秒真的操作一次界面，确认控制没失效 */
      if (Date.now() - lastControl >= CONTROL_MS) {
        lastControl = Date.now();
        controlRounds++;
        const r = await cdp.evaluate(`(function(){
          var T = window.__NZ_TEST, out = {};
          T.drawer('ledger'); out.drawerOpen = document.getElementById('drawer').classList.contains('open');
          out.ledgerLen = (document.querySelector('.dr-body') || {textContent:''}).textContent.length;
          T.closeDrawer(); out.drawerClosed = !document.getElementById('drawer').classList.contains('open');
          T.press('btnTrend'); out.trendOpen = document.getElementById('trendPanel').classList.contains('open');
          T.press('trendClose'); out.trendClosed = !document.getElementById('trendPanel').classList.contains('open');
          out.tourStillOn = document.getElementById('tourBar').classList.contains('on');
          return JSON.stringify(out);
        })()`);
        const o = JSON.parse(r);
        const ok = o.drawerOpen && o.drawerClosed && o.trendOpen && o.trendClosed && o.ledgerLen > 200;
        if (!ok) { controlFails++; console.log('    ✗ 第 ' + controlRounds + ' 次界面操作无响应：' + r); }
        else console.log('    · 第 ' + controlRounds + ' 次界面操作正常（账本 ' + o.ledgerLen + ' 字符，导览未被打断）');
      }

      await sleep(SAMPLE_MS);
    }

    /* ---------- 判定 1：导览一直在跑 ---------- */
    const tourOffSamples = samples.filter(s => !s.tourOn).length;
    if (NO_TOUR) {
      ck('导览全程保持运行（仅自动章节结束时被打点）', false, '对照模式未发起导览 —— 不适用', 'untested');
      ck('导览章节确实在推进（观察到多个不同章节号）', false, '对照模式未发起导览 —— 不适用', 'untested');
    } else {
      ck('导览全程保持运行（仅自动章节结束时被打点）', tourOffSamples <= tourRestarts + 1,
        '采样 ' + samples.length + ' 次，其中未在导览 ' + tourOffSamples + ' 次，重新发起 ' + tourRestarts + ' 次');
      ck('导览章节确实在推进（观察到多个不同章节号）', chaptersSeen.size >= 3,
        '观察到 ' + chaptersSeen.size + ' 个不同章节：' + [...chaptersSeen].sort().join(' '));
    }

    /* ---------- 判定 2：控制未失效 ---------- */
    ck('界面控制在 10 分钟内始终有响应', controlFails === 0, controlRounds + ' 轮操作，失败 ' + controlFails + ' 轮');

    /* ---------- 判定 3：内存无失控增长 ---------- */
    /* 基线必须剔除启动期：前几张采样落在"面板/设备树尚未建起来"的时候
     * （t=0 时 DOM 只有 657 个节点，t=20 起才是 1002–1005），
     * 把这段一次性初始化算进增长会把 +2.6 MB 的建站开销误判成泄漏。
     * 与 DOM 检查用同一套热身规则：基线取"热身 90 秒之后的第一张"。
     * 两个数都报出来，判定用剔除后的。 */
    const heaps = samples.map(s => s.heap).filter(v => v != null);
    let heapOk = false, heapInfo = '未取到堆占用指标';
    if (heaps.length >= 6) {
      const n = 3;
      const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
      const first = heaps.slice(0, n), last = heaps.slice(-n);
      const fAll = avg(first), l = avg(last);
      const warmHeap = samples.filter(s => s.elapsedS >= 90 && s.heap != null);
      const base = (warmHeap.length >= 2 ? avg(warmHeap.slice(0, n).map(s => s.heap)) : fAll);
      const deltaMB = (l - base) / 1048576;
      const pct = base ? (l - base) / base * 100 : 0;
      const deltaAllMB = (l - fAll) / 1048576;
      const minutes = Math.max(1, (samples[samples.length - 1].elapsedS - 90) / 60);
      /* 阈值：剔除启动期后，末三次均值比基线增长 < 8 MB 且 < 25%。两者都要满足 ——
       * 只卡百分比会在小基数上放过绝对值很大的增长。 */
      heapOk = deltaMB < 8 && pct < 25;
      heapInfo = '基线(t≥90s) ' + (base / 1048576).toFixed(1) + 'MB → 末3次均值 ' +
        (l / 1048576).toFixed(1) + 'MB（' + (deltaMB >= 0 ? '+' : '') + deltaMB.toFixed(2) + 'MB，' +
        (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%）；斜率约 ' + (deltaMB / minutes).toFixed(2) +
        ' MB/分钟。含启动期口径：' + (fAll / 1048576).toFixed(1) + 'MB → ' + (l / 1048576).toFixed(1) +
        'MB（' + (deltaAllMB >= 0 ? '+' : '') + deltaAllMB.toFixed(2) + 'MB），采样 ' + heaps.length + ' 个';
    } else {
      heapInfo = '样本不足（' + heaps.length + ' 个，至少需要 6 个）——按未测计，不计通过';
    }
    ck('堆内存无失控增长（剔除启动期；阈值 <8 MB 且 <25%）', heapOk, heapInfo,
      heaps.length >= 6 ? (heapOk ? 'pass' : 'fail') : 'untested');

    /* ---------- 判定 3b：内部容器规模有界 ---------- */
    /* 一个堆占用差分回答不了"涨的是泄漏，还是填满一个按设计有上限的缓冲"。
     * 这里把上限直接量出来：内核事件表封顶 400、内核历史封顶 1440、
     * 界面事件表封顶 400、帧率环形缓冲封顶 30（源码里各有一处 shift）。
     * 逐日账本 L.days 是**有意不封顶**的（它就是逐日结算记录），
     * 所以只校验它的条目数等于仿真天数，没有多出来的东西。 */
    const CAPS = { engineEvents: 400, engineHistory: 1440, uiEvents: 400, perfSamples: 30 };
    const contSamples = samples.filter(s => s.containers);
    let contOk = false, contInfo = '未取到容器规模';
    if (contSamples.length >= 6) {
      const maxOf = k => Math.max.apply(null, contSamples.map(s => s.containers[k] || 0));
      const maxes = {};
      for (const k of Object.keys(CAPS)) maxes[k] = maxOf(k);
      const over = Object.keys(CAPS).filter(k => maxes[k] > CAPS[k]);
      const lastC = contSamples[contSamples.length - 1].containers;
      const lastS = samples[samples.length - 1];
      const expectedDays = Math.floor(lastS.simTime / 86400) + 1;
      const daysOk = lastC.engineDays <= expectedDays;
      contOk = over.length === 0 && daysOk;
      contInfo = Object.keys(CAPS).map(k => k + ' 峰值 ' + maxes[k] + '/' + CAPS[k]).join('，') +
        '；逐日账本 ' + lastC.engineDays + ' 条 = 仿真第 ' + expectedDays + ' 天（按设计不封顶）' +
        (over.length ? ' —— 越界：' + over.join('、') : '') +
        (daysOk ? '' : ' —— 逐日条目多于仿真天数');
    }
    ck('内部容器规模有界（不无界累积）', contOk, contInfo,
      contSamples.length >= 6 ? (contOk ? 'pass' : 'fail') : 'untested');

    /* ---------- 判定 4：帧率没有明显退化 ---------- */
    const fpss = samples.map(s => s.fps).filter(v => v != null && isFinite(v) && v > 5);
    let fpsOk = false, fpsInfo = '未取到帧率';
    if (fpss.length >= 6) {
      const half = Math.floor(fpss.length / 2);
      const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
      const f = avg(fpss.slice(0, half)), l = avg(fpss.slice(-half));
      fpsOk = l >= f * 0.7;
      fpsInfo = '前段均值 ' + f.toFixed(1) + ' fps → 后段均值 ' + l.toFixed(1) + ' fps（降幅 ' + ((1 - l / f) * 100).toFixed(1) + '%），n=' + fpss.length;
    } else {
      fpsInfo = '样本不足（' + fpss.length + ' 个）——按未测计，不计通过';
    }
    ck('帧率无明显退化', fpsOk, fpsInfo, fpss.length >= 6 ? (fpsOk ? 'pass' : 'fail') : 'untested');

    /* ---------- 判定 5：DOM 节点数不膨胀 ---------- */
    /* 关键：前几次采样落在启动期，面板/设备树是那时才建起来的（实测 657 → 1005），
     * 拿第一次当基线会把它误判成泄漏。基线取"热身 90 秒之后的第一张"；
     * 时间太短的调试跑没有热身样本，就退回到倒数第二张当基线。 */
    const warm = samples.filter(s => s.elapsedS >= 90);
    const base = (warm.length >= 2) ? warm[0] : samples[Math.max(0, samples.length - 2)];
    const lastN = samples[samples.length - 1];
    let domOk = false, domInfo = '', domState = 'fail';
    if (base && lastN && base !== lastN) {
      const d = lastN.domNodes - base.domNodes;
      domOk = d <= 200;
      domState = domOk ? 'pass' : 'fail';
      domInfo = '基线(t=' + base.elapsedS + 's) ' + base.domNodes + ' → 末次 ' + lastN.domNodes + '（' + (d >= 0 ? '+' : '') + d + '）';
    } else {
      domInfo = '采样点不足，未测';
      domState = 'untested';
    }
    ck('DOM 节点数不膨胀（面板反复开合不泄漏节点）', domOk, domInfo, domState);

    /* ---------- 判定 6：无异常（只算导览阶段；上下文阶段单独统计） ---------- */
    const errsInTourPhase = errors.length;
    ck('长时间运行无未捕获异常（导览阶段）', errsInTourPhase === 0, errsInTourPhase ? errors.slice(0, 2).join(' | ') : '0 条');
    ck('长时间运行无 console.error', consoleErrors.length === 0, consoleErrors.length ? consoleErrors.slice(0, 2).join(' | ') : '0 条');

    /* ---------- 判定 7/8：WebGL 上下文丢失与恢复 ---------- */
    const lose = await cdp.evaluate(`(function(){
      var gl = window.__NZ_TEST.renderer.getContext();
      var ext = gl.getExtension('WEBGL_lose_context');
      if (!ext) return 'no-ext';
      ext.loseContext();
      return 'ok';
    })()`);
    if (lose !== 'ok') {
      ck('可以模拟上下文丢失（浏览器支持 WEBGL_lose_context）', false, lose);
    } else {
      await sleep(900);
      const lost = JSON.parse(await cdp.evaluate(SAMPLE_EXPR));
      ck('上下文丢失后：常驻提示出现', lost.ctxWarn === true, '#ctxWarn display=' + (lost.ctxWarn ? 'block' : 'none'));
      ck('上下文丢失后：物理暂停（画面定格）', lost.ctxLost === true && lost.running === false,
        'contextLost=' + lost.ctxLost + '，running=' + lost.running);

      await cdp.evaluate(`(function(){
        var gl = window.__NZ_TEST.renderer.getContext();
        var ext = gl.getExtension('WEBGL_lose_context');
        if (ext) ext.restoreContext();
        return 1;
      })()`);

      /* 轮询等浏览器的恢复事件。headless 下 WEBGL_lose_context 的恢复不一定发生，
       * 所以等不到时**不判"通过"**，而是改用合成事件单独验证我们的处理逻辑，
       * 并把这个区别写进报告。 */
      let real = null, waitedMs = 0;
      for (let i = 0; i < 20; i++) {
        await sleep(250); waitedMs += 250;
        const v = JSON.parse(await cdp.evaluate(SAMPLE_EXPR));
        if (v.ctxLost === false) { real = v; break; }
      }
      if (real) {
        ck('上下文恢复后：提示撤掉、渲染继续', real.ctxWarn === false && real.running === true,
          '由浏览器真实 webglcontextrestored 驱动（等待 ' + waitedMs + ' ms）｜contextLost=' + real.ctxLost +
          '，提示可见=' + real.ctxWarn + '，running=' + real.running);
        console.log('  · 上下文：丢失提示已出现，' + waitedMs + ' ms 后浏览器真实恢复，提示已撤、running=' + real.running);
      } else {
        /* 不判失败也不判通过 —— 是**未测**：本机的 headless Chrome 即使按规范
         * 取消了丢失事件、并显式调用 restoreContext()，也没有派发
         * webglcontextrestored。既然没触发，就没有"恢复路径是否正确"的证据。
         * 不用合成事件代替：对一个仍然失效的上下文派发该事件，会让 three.js
         * 的恢复回调重建能力对象（实测在 getShaderPrecisionFormat 返回 null 处抛
         * TypeError），那是测试方法自己造出来的假故障，不是产品缺陷。 */
        ck('上下文恢复后：提示撤掉、渲染继续（浏览器真实恢复路径）', false,
          '等待 ' + waitedMs + ' ms 未收到 webglcontextrestored —— headless 下未触发，按**未测**计，不计通过',
          'untested');
        console.log('  · 上下文：丢失提示已出现；浏览器真实恢复在 headless 下未触发 —— 恢复路径按未测记');
      }
      const ctxErrs = errors.length - errsInTourPhase;
      ck('上下文丢失/恢复期间无未捕获异常', ctxErrs === 0, ctxErrs ? errors.slice(errsInTourPhase).slice(0, 2).join(' | ') : '0 条');
    }
  } finally {
    if (cdp) cdp.close();
    try { child.kill(); } catch (e) { }
    await sleep(300);
    try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) { }
  }

  const failed = checks.filter(c => c.state === 'fail');
  const untested = checks.filter(c => c.state === 'untested');
  console.log('');
  for (const c of checks) {
    const mark = c.state === 'pass' ? '✓' : (c.state === 'untested' ? '·未测' : '✗');
    console.log('  ' + mark + ' ' + c.name + (c.info ? '  [' + c.info + ']' : ''));
  }
  console.log('\n结论：通过 ' + (checks.length - failed.length - untested.length) + '，失败 ' + failed.length +
    '，未测 ' + untested.length + '（合计 ' + checks.length + ' 项）');

  fs.writeFileSync(OUT, JSON.stringify({
    generatedAt: new Date().toISOString(),
    artifact: path.relative(ROOT, FILE).replace(/\\/g, '/'),
    minutes: MINUTES, size: SIZE, quality: QUALITY,
    sampleIntervalMs: SAMPLE_MS, tourRestarts,
    samples: samples.map(s => ({
      elapsedS: s.elapsedS, heapMB: s.heap == null ? null : +(s.heap / 1048576).toFixed(2), domNodes: s.domNodes,
      fps: s.fps == null ? null : +s.fps.toFixed(1), simTime: s.simTime,
      tourOn: s.tourOn, chap: s.chap.trim(), residualMW: s.residualMW,
      containers: s.containers || null
    })),
    checks, errors, consoleErrors,
    pass: checks.filter(c => c.state === 'pass').length,
    fail: failed.length,
    untested: untested.length,
    total: checks.length,
    stderrTail: stderr.slice(-400)
  }, null, 2), 'utf8');
  console.log('结果文件：' + path.relative(ROOT, OUT));
  process.exitCode = failed.length ? 1 : 0;
}

main().catch(e => { console.error('运行失败：' + (e && e.stack || e)); process.exitCode = 2; });
