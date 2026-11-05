/* =====================================================================
 * 戈壁之光 · 零碳能量中枢 —— 整页截图运行器（CDP 版）
 *
 *   node tests/shots.cjs --only=new --prefix=after        --size=1920x1080
 *   node tests/shots.cjs --only=new --prefix=after1366     --size=1366x768
 *   node tests/shots.cjs --only=new --prefix=after4k       --size=3840x2160
 *   node tests/shots.cjs --only=old --prefix=before        --size=1920x1080
 *   node tests/shots.cjs --only=new --shots=night,day-lab  （只重拍指定几张）
 *
 * 为什么不用 `chrome --screenshot`：那条路径下抓帧与页面的异步准备赛跑，
 * 且运行器读不到页面对自己状态的汇报 —— 实测 12 张里 9 张拍成了同一个
 * 默认状态（像素差分 meanDiff ≈ 0.01），而运行器一无所知。
 *
 * 现在走 CDP：
 *   1. Page.navigate 到本张图的 URL；
 *   2. 轮询 window.__SHOT_META —— 页面把"我准备好了"和"我现在的状态"一起报上来；
 *   3. 与 SPEC 里声明的 expect 逐项比对，不一致即判 mismatch 并删掉该图；
 *   4. 比对通过才 Page.captureScreenshot 落盘。
 * 于是"没拍对"会变成一条失败记录，而不是一张看起来没问题的图。
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const net = require('net');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SHOTS_DIR = path.join(ROOT, 'screenshots');
const SCRIPT = path.join(__dirname, 'shots-script.js');
const NEW_FILE = path.join(ROOT, 'dist', 'Net-Zero-grid-premium.html');
const OLD_FILE = path.join(ROOT, 'original', 'Net-Zero-grid-simulation-20260722.html');

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
const ONLY = arg('only') || 'new';
const PREFIX = arg('prefix') || (ONLY === 'old' ? 'before' : 'after');
const SIZE = arg('size') || '1920x1080';
const DPR = +(arg('dpr') || 1);
const SHOT_LIST = (arg('shots') || '').split(',').filter(Boolean);
const PER_SHOT_TIMEOUT = +(arg('timeout') || 60000);

/* 与 tests/shots-script.js 的 SPECS 键保持一致；both=原版也拍 */
const SHOTS = [
  { name: 'default', both: true },
  { name: 'day-lab' },
  { name: 'night' },
  { name: 'sim-night', both: true },
  { name: 'hydrogen-closeup' },
  { name: 'focus-datacenter' },
  { name: 'focus-with-drawer' },
  { name: 'drawer-ledger' },
  { name: 'drawer-devices' },
  { name: 'drawer-policy' },
  { name: 'tour-chapter3' },
  { name: 'quality-standard' },
  { name: 'quality-high-bloom' },
  { name: 'trend-panel' },
  { name: 'reduce-motion' }
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

function findBrowser() {
  for (const c of CANDIDATES) if (fs.existsSync(c)) return c;
  throw new Error('未找到 Chrome/Edge');
}
function freePort() {
  return new Promise((res, rej) => {
    const s = net.createServer();
    s.on('error', rej);
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
  });
}
function httpGetJSON(url) {
  return new Promise((res, rej) => {
    const req = http.get(url, r => {
      let b = '';
      r.on('data', c => { b += c; });
      r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } });
    });
    req.on('error', rej);
    req.setTimeout(3000, () => req.destroy(new Error('http 超时')));
  });
}

/* ---------------- 极简 CDP 客户端（Node 内置 WebSocket） ---------------- */
class CDP {
  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
    ws.addEventListener('message', ev => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.id != null) {
        const p = this.pending.get(m.id);
        if (!p) return;
        this.pending.delete(m.id);
        clearTimeout(p.timer);
        if (m.error) p.rej(new Error(m.error.message)); else p.res(m.result);
      }
    });
  }
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
    if (r.exceptionDetails) throw new Error('页面求值异常：' + (r.exceptionDetails.text || '') +
      ' ' + JSON.stringify(r.exceptionDetails.exception && r.exceptionDetails.exception.description || ''));
    return r.result.value;
  }
  close() { try { this.ws.close(); } catch (e) { } }
}

async function connectPage(port, deadlineMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < deadlineMs) {
    try {
      const list = await httpGetJSON('http://127.0.0.1:' + port + '/json/list');
      const page = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch (e) { }
    await sleep(200);
  }
  throw new Error('等待 DevTools 页面目标超时');
}

/* 在 <body 之前注入错误采集器：应用脚本在 body 尾部，先装钩子才抓得到启动期异常 */
const ERROR_PREAMBLE =
  '<script>window.__SHOT_ERRORS=[];' +
  'window.addEventListener("error",function(e){window.__SHOT_ERRORS.push("error: "+(e.message||"")+" @"+((e.filename||"")+":"+(e.lineno||0)));});' +
  'window.addEventListener("unhandledrejection",function(e){var r=e.reason;window.__SHOT_ERRORS.push("rejection: "+String((r&&r.stack)||r));});' +
  '</script>\n';

function buildPage(src) {
  const html = fs.readFileSync(src, 'utf8');
  const inject = '<script>' + fs.readFileSync(SCRIPT, 'utf8') + '<\/script>\n';
  const i = html.lastIndexOf('</body>');
  if (i < 0) throw new Error('源文件缺少 </body>');
  const b = html.indexOf('<body');
  const withErr = b < 0 ? ERROR_PREAMBLE + html : html.slice(0, b) + ERROR_PREAMBLE + html.slice(b);
  const j = withErr.lastIndexOf('</body>');
  const page = withErr.slice(0, j) + inject + withErr.slice(j);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nzshot-'));
  const f = path.join(dir, 'shots.html');
  fs.writeFileSync(f, page, 'utf8');
  return { file: f, dir };
}

/* 逐项比对 SPEC 声明的 expect */
function verdict(meta) {
  const bad = [];
  if (meta.skipped) return { ok: false, level: 'skipped', bad: ['本张不适用于该版本'] };
  if (meta.error) bad.push('页面 setup 抛错：' + String(meta.error).split('\n')[0]);
  /* 原版没有展示光照 / 画质档 / 抽屉，expect 只对升级版生效 */
  const e = meta.version === 'original' ? { } : (meta.expect || {});
  for (const k of Object.keys(e)) {
    const want = e[k], got = meta[k];
    if (k === 'bloom' && want === true && got === false) {
      /* 泛光在无浮点渲染目标的环境下不可用，属如实降级，不算拍错 */
      continue;
    }
    if (got !== want) bad.push(k + ' 期望 ' + JSON.stringify(want) + '，实际 ' + JSON.stringify(got));
  }
  if (meta.version !== 'original' && meta.errors && meta.errors.length) {
    bad.push('页面运行期异常 ' + meta.errors.length + ' 条：' + meta.errors[0]);
  }
  if (bad.length) return { ok: false, level: 'mismatch', bad };
  const warn = [];
  if (meta.version === 'original' && meta.errors && meta.errors.length) {
    warn.push('原版页面自身有 ' + meta.errors.length + ' 条运行期异常（作为对照记录，不影响本图）');
  }
  if (e.bloom === true && meta.bloom === false) warn.push('泛光未启用（' + (meta.bloomReason || '未知原因') + '），已如实记录');
  return { ok: true, level: 'ok', bad: [], warn };
}

async function main() {
  const browser = findBrowser();
  if (!fs.existsSync(SHOTS_DIR)) fs.mkdirSync(SHOTS_DIR, { recursive: true });
  const src = ONLY === 'old' ? OLD_FILE : NEW_FILE;
  if (!fs.existsSync(src)) throw new Error('缺少源文件：' + src);

  const page = buildPage(src);
  const pageUrl = 'file:///' + page.file.replace(/\\/g, '/');
  const [w, h] = SIZE.split('x').map(Number);
  const list = SHOTS.filter(s => (SHOT_LIST.length ? SHOT_LIST.indexOf(s.name) >= 0 : true))
    .filter(s => ONLY === 'new' || s.both);

  const port = await freePort();
  const args = [
    '--headless=new', '--remote-debugging-port=' + port,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling', '--hide-scrollbars',
    '--allow-file-access-from-files',
    '--window-size=' + Math.max(w, 1280) + ',' + Math.max(h, 720),
    '--user-data-dir=' + path.join(page.dir, 'ud'),
    'about:blank'
  ];
  const child = spawn(browser, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', d => { stderr += d.toString(); });

  console.log('整页截图（CDP）：' + (ONLY === 'old' ? '原版' : '升级版') +
    '  视口 ' + SIZE + ' @dpr' + DPR + '  →  screenshots/' + PREFIX + '-*.png   （' + list.length + ' 张）');

  const results = [];
  let cdp = null;
  try {
    const wsUrl = await connectPage(port, 25000);
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', e => rej(new Error('WebSocket 连接失败')), { once: true });
    });
    cdp = new CDP(ws);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: w, height: h, deviceScaleFactor: DPR, mobile: false
    });

    for (const s of list) {
      const out = path.join(SHOTS_DIR, PREFIX + '-' + s.name + '.png');
      const url = pageUrl + '?shot=' + s.name;
      let rec = { prefix: PREFIX, name: s.name, size: SIZE, dpr: DPR, only: ONLY, file: null };
      const t0 = Date.now();
      try {
        await cdp.send('Page.navigate', { url });
        /* 必须确认文档已换成当前这张（location.search 对得上），否则会读到上一张的 meta */
        const probe = '(function(){if(location.search!=="?shot=' + s.name + '")return null;' +
          'var m=window.__SHOT_META;return m?JSON.stringify(m):null;})()';
        let meta = null, lastErr = null;
        while (Date.now() - t0 < PER_SHOT_TIMEOUT) {
          try {
            const v = await cdp.evaluate(probe);
            if (v) { meta = JSON.parse(v); break; }
          } catch (e) { lastErr = e; }
          await sleep(80);
        }
        if (!meta) throw new Error('等待 __SHOT_META 超时' + (lastErr ? '（' + lastErr.message + '）' : ''));
        /* 页面状态就绪后再多走两帧，把最终一版画面渲染出来 */
        await cdp.evaluate('new Promise(function(r){requestAnimationFrame(function(){requestAnimationFrame(function(){r(1);});});})');
        const v = verdict(meta);
        rec.meta = meta;
        rec.verdict = v.level;
        rec.problems = v.bad;
        rec.warnings = v.warn || [];
        rec.screenshotAt = new Date().toISOString();
        if (v.level === 'ok') {
          const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
          const buf = Buffer.from(shot.data, 'base64');
          fs.writeFileSync(out, buf);
          rec.file = path.basename(out);
          rec.bytes = buf.length;
          /* PNG 头里读实际像素尺寸，核对与 SIZE×DPR 一致 */
          rec.px = buf.readUInt32BE(16) + '×' + buf.readUInt32BE(20);
          console.log('  ✓ ' + path.basename(out).padEnd(32) + (buf.length / 1024).toFixed(0).padStart(5) +
            ' KB  ' + rec.px.padStart(9) + '  ' + meta.light + ' / ' + meta.quality +
            '/ 泛光 ' + meta.bloom + (rec.warnings.length ? '  ⚠ ' + rec.warnings[0] : ''));
        } else {
          try { if (fs.existsSync(out)) fs.rmSync(out); } catch (e) { }
          console.log('  ✗ ' + s.name.padEnd(32) + '【' + v.level + '】' + v.bad.join('；'));
        }
      } catch (e) {
        rec.verdict = 'error';
        rec.problems = [String(e.message || e)];
        try { if (fs.existsSync(out)) fs.rmSync(out); } catch (e2) { }
        console.log('  ✗ ' + s.name.padEnd(32) + '【error】' + rec.problems[0]);
      }
      rec.ms = Date.now() - t0;
      results.push(rec);
    }
  } finally {
    if (cdp) cdp.close();
    try { child.kill(); } catch (e) { }
    await sleep(300);
    try { fs.rmSync(page.dir, { recursive: true, force: true }); } catch (e) { }
    if (stderr.trim() && results.some(r => r.verdict !== 'ok')) {
      console.log('--- 浏览器 stderr（末 1200 字符）---\n' + stderr.slice(-1200));
    }
  }

  const jf = path.join(SHOTS_DIR, '_shots.json');
  let all = [];
  try { all = JSON.parse(fs.readFileSync(jf, 'utf8')); } catch (e) { all = []; }
  /* 丢掉旧格式残留记录：它们没有 name 字段，键会算成 undefined，
   * 于是每轮都把自己原样留在索引里，越积越多且指向已经不存在的图。 */
  all = all.filter(x => x && x.name && x.prefix);
  const keys = new Set(results.map(m => m.prefix + '/' + m.name));
  all = all.filter(x => !keys.has(x.prefix + '/' + x.name));
  for (const m of results) all.push(m);
  all.sort((a, b) => (a.prefix + a.name).localeCompare(b.prefix + b.name));
  fs.writeFileSync(jf, JSON.stringify(all, null, 2), 'utf8');

  const ok = results.filter(r => r.verdict === 'ok').length;
  const bad = results.filter(r => r.verdict !== 'ok');
  console.log('');
  console.log('结果：' + ok + '/' + results.length + ' 张通过状态核对' +
    (bad.length ? '，未通过 ' + bad.length + ' 张（对应 png 已删除，避免把没拍对的图当成交付物）' : ''));
  console.log('索引：screenshots/_shots.json');
  process.exitCode = bad.length ? 1 : 0;
}

main().catch(e => { console.error('运行器失败：' + (e && e.stack || e)); process.exitCode = 2; });
