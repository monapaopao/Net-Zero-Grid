/* =====================================================================
 * 底部信息流的专项校验
 *
 *   node tests/ticker-check.cjs
 *
 * 三视口实测覆盖的是"布局不重叠、无 console.error"；这一份补上**行为**：
 *   1. 条目文案确实被填充（不是一排「—」）；
 *   2. 两份副本文案一致（无缝循环的前提）；
 *   3. 位移随时间推进，且是"推进到一组宽就归零"的循环；
 *   4. 暂停物理后仍在播报（信息流是播报，不随暂停停）；
 *   5. 打开「减少动态」后停住，且复位到起点；
 *   6. 顶部原本那块会闪的「地区 · 昼夜」文字与日月弧 canvas 确实不在了。
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const net = require('net');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'dist', 'Net-Zero-grid-premium.html');
const OUT = path.join(__dirname, 'ticker-check.json');

const sleep = ms => new Promise(r => setTimeout(r, ms));

function httpGetJSON(url) {
  return new Promise((res, rej) => {
    http.get(url, r => { let s = ''; r.on('data', d => s += d); r.on('end', () => { try { res(JSON.parse(s)); } catch (e) { rej(e); } }); })
      .on('error', rej);
  });
}
function freePort() {
  return new Promise(res => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
}
function findBrowser() {
  for (const p of ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe']) if (fs.existsSync(p)) return p;
  throw new Error('找不到 Chrome');
}

class CDP {
  constructor(ws) { this.ws = ws; this.seq = 0; this.pending = new Map(); this.handlers = new Map();
    ws.addEventListener('message', ev => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) { const p = this.pending.get(m.id); this.pending.delete(m.id);
        clearTimeout(p.timer); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
      else if (m.method && this.handlers.has(m.method)) this.handlers.get(m.method)(m.params);
    });
  }
  on(ev, fn) { this.handlers.set(ev, fn); }
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
}

const READ = `(function(){
  var T = window.__NZ_TEST;
  var track = document.getElementById('tkTrack');
  var sets = track ? track.querySelectorAll('.tk-set') : [];
  var items = sets[0] ? Array.prototype.map.call(sets[0].querySelectorAll('[data-tk]'), function(n){ return n.textContent; }) : [];
  var echo = sets[1] ? Array.prototype.map.call(sets[1].querySelectorAll('[data-tk]'), function(n){ return n.textContent; }) : [];
  var m = track ? (track.style.transform || '').match(/-?[\\d.]+/) : null;
  return JSON.stringify({
    sets: sets.length,
    items: items, echo: echo,
    x: m ? parseFloat(m[0]) : 0,
    setW: sets[0] ? sets[0].getBoundingClientRect().width : 0,
    reduce: document.body.classList.contains('reduce-motion'),
    /* 顶部那两块：regionMark 是动态注入的 div，日月弧是 canvas —— 都不该再存在 */
    topStray: document.querySelectorAll('#canvasWrap > div[style*="top:10px"], #canvasWrap > canvas[width="132"]').length,
    running: T.state().running
  });
})()`;

async function main() {
  const browser = findBrowser();
  const port = await freePort();
  const udd = fs.mkdtempSync(path.join(require('os').tmpdir(), 'nztk-'));
  const child = spawn(browser, [
    '--headless=new', '--remote-debugging-port=' + port, '--no-first-run',
    '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars',
    '--allow-file-access-from-files', '--window-size=1600,900',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows', '--user-data-dir=' + udd, 'about:blank'
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  const errors = [], consoleErrors = [], checks = [];
  /* 三项状态：pass / fail / untested —— 未测不当通过，也不当失败 */
  const ck = (name, ok, info, state) => checks.push({
    name, ok: !!ok, state: state || (ok ? 'pass' : 'fail'),
    info: info === undefined ? '' : String(info)
  });
  let cdp = null;

  try {
    let wsUrl = null;
    const t0 = Date.now();
    while (Date.now() - t0 < 25000 && !wsUrl) {
      try {
        const list = await httpGetJSON('http://127.0.0.1:' + port + '/json/list');
        const page = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
        if (page) wsUrl = page.webSocketDebuggerUrl;
      } catch (e) { }
      if (!wsUrl) await sleep(200);
    }
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', () => rej(new Error('WS 失败')), { once: true }); });
    cdp = new CDP(ws);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
    cdp.on('Runtime.exceptionThrown', p => errors.push(((p.exceptionDetails || {}).text || '').slice(0, 160)));
    cdp.on('Runtime.consoleAPICalled', p => { if (p.type === 'error') consoleErrors.push((p.args || []).map(a => a.value || '').join(' ').slice(0, 160)); });

    await cdp.send('Page.navigate', { url: 'file:///' + FILE.replace(/\\/g, '/') });
    let booted = false;
    for (let i = 0; i < 200 && !booted; i++) {
      try { if (await cdp.evaluate('(function(){var T=window.__NZ_TEST;return T&&T.state().steps>0?"1":null;})()') === '1') booted = true; } catch (e) { }
      if (!booted) await sleep(150);
    }
    if (!booted) throw new Error('页面未完成启动');

    const a = JSON.parse(await cdp.evaluate(READ));
    ck('信息流只有两份副本（无缝循环的前提）', a.sets === 2, a.sets + ' 份');
    ck('条目文案已填充（不是一排占位符）',
      a.items.length >= 11 && a.items.every(v => v && v !== '—'), a.items.length + ' 条：' + a.items.slice(0, 4).join(' / '));
    ck('两份副本文案一致', JSON.stringify(a.items) === JSON.stringify(a.echo), '');
    ck('顶部那块会闪的「地区 · 昼夜」文字与日月弧已不在', a.topStray === 0, a.topStray + ' 处残留');

    /* 位移：等 1.2 s 再看，应该推进了（约 TK_SPEED × 1.2 px）。
     * 注意方向是负的（translateX 取负值向左移），所以比的是绝对位移。 */
    await sleep(1200);
    const b = JSON.parse(await cdp.evaluate(READ));
    const moved = Math.abs(b.x - a.x);
    ck('位移随时间推进（信息流在滚）', moved > 20,
      '1.2 s 内位移 ' + moved.toFixed(1) + ' px ≈ ' + (moved / 1.2).toFixed(0) + ' px/s（组宽 ' + b.setW.toFixed(0) + ' px）');
    ck('位移不超过一个组宽（到点归零，不会滑空）', b.x <= 0 && b.x >= -b.setW - 1,
      'x=' + b.x.toFixed(1) + '，组宽 ' + b.setW.toFixed(0));

    /* 暂停物理后仍在播报 */
    await cdp.evaluate('(function(){window.__NZ_TEST.press("btnRun");return 1;})()');
    await sleep(700);
    const c = JSON.parse(await cdp.evaluate(READ));
    const moved2 = Math.abs(c.x - b.x);
    ck('暂停物理后信息流仍在播报', c.running === false && moved2 > 5,
      'running=' + c.running + '，位移继续 ' + moved2.toFixed(1) + ' px');
    await cdp.evaluate('(function(){window.__NZ_TEST.press("btnRun");return 1;})()');

    /* 减少动态：停住并复位 */
    await cdp.evaluate('(function(){window.__NZ_TEST.press("btnReduce");return 1;})()');
    await sleep(500);
    const d1 = JSON.parse(await cdp.evaluate(READ));
    await sleep(900);
    const d2 = JSON.parse(await cdp.evaluate(READ));
    ck('「减少动态」下信息流停住且复位到起点', d1.reduce && d2.reduce && d2.x === 0 && d1.x === 0,
      'reduce=' + d2.reduce + '，x=' + d2.x);
    await cdp.evaluate('(function(){window.__NZ_TEST.press("btnReduce");return 1;})()');
    await sleep(500);
    const e = JSON.parse(await cdp.evaluate(READ));
    ck('「减少动态」可恢复（重新开始滚动）', e.reduce === false && e.setW > 0, '');

    /* ---------- 顶部提示：去重 + 求解器诊断不刷屏 ----------
     * v1.0.3 起因：用户截图显示顶部叠了三条同样的求解器未收敛诊断。
     * 去重是可以稳定验的；"诊断不弹 toast" 需要真的跑到一次未收敛步，
     * 这里先扫一遍账本看有没有这类事件，有就顺带验，没有就如实记未测。 */
    const tkToast0 = await cdp.evaluate(`(function(){ return document.getElementById('toast').children.length; })()`);
    await cdp.evaluate(`(function(){ window.__NZ_TEST.applyScenario('night'); return 1; })()`);
    await cdp.evaluate(`(function(){ window.__NZ_TEST.applyScenario('night'); return 1; })()`);
    await sleep(300);
    const t1 = await cdp.evaluate(`(function(){
      var box = document.getElementById('toast');
      var msgs = Array.prototype.map.call(box.children, function(n){ return n.textContent; });
      return JSON.stringify({ n: box.children.length, msgs: msgs });
    })()`);
    const T1 = JSON.parse(t1);
    const dup = T1.msgs.filter((m, i) => T1.msgs.indexOf(m) !== i).length;
    ck('同一条提示不会重复堆叠（同文案去重生效）', dup === 0 && T1.n <= 3,
      '连点两次同一情景后 toast 里 ' + T1.n + ' 条（上限 3），其中重复 ' + dup + ' 条：' + JSON.stringify(T1.msgs.slice(0, 3)));

    /* 账本里若有求解器诊断，检查它没被弹成 toast */
    const diag = await cdp.evaluate(`(function(){
      var T = window.__NZ_TEST;
      var hits = (T.L.events || []).filter(function(e){ return e.msg && e.msg.indexOf('已记录诊断') >= 0; });
      return JSON.stringify({ n: hits.length, sample: hits.length ? hits[hits.length-1].msg : '' });
    })()`);
    const D = JSON.parse(diag);
    const toasts = await cdp.evaluate(`(function(){
      var box = document.getElementById('toast');
      return JSON.stringify(Array.prototype.map.call(box.children, function(n){ return n.textContent; }));
    })()`);
    const toastMsgs = JSON.parse(toasts);
    if (D.n > 0) {
      ck('求解器诊断只进事件页、不弹顶部提示',
        !toastMsgs.some(m => m.indexOf('已记录诊断') >= 0),
        '账本里 ' + D.n + ' 条诊断，toast 里 0 条');
    } else {
      ck('求解器诊断只进事件页、不弹顶部提示', false,
        '本次运行没有出现未收敛步（账本 0 条诊断）—— 触发条件未复现，按**未测**计', 'untested');
    }

    ck('全程无未捕获异常', errors.length === 0, errors.slice(0, 2).join(' | ') || '0 条');
    ck('全程无 console.error', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | ') || '0 条');
  } finally {
    if (cdp) { try { cdp.ws.close(); } catch (e) { } }
    try { child.kill(); } catch (e) { }
    await sleep(300);
    try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) { }
  }

  const fail = checks.filter(c => c.state === 'fail');
  const untested = checks.filter(c => c.state === 'untested');
  const pass = checks.filter(c => c.state === 'pass');
  console.log('');
  for (const c of checks) {
    const mark = c.state === 'pass' ? '✓' : (c.state === 'untested' ? '·未测' : '✗');
    console.log('  ' + mark + ' ' + c.name + (c.info ? '  [' + c.info + ']' : ''));
  }
  console.log('\n结论：通过 ' + pass.length + '，失败 ' + fail.length + '，未测 ' + untested.length +
    '（合计 ' + checks.length + ' 项）');
  fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(),
    artifact: path.relative(ROOT, FILE).replace(/\\/g, '/'), checks,
    pass: pass.length, fail: fail.length, untested: untested.length, total: checks.length,
    errors, consoleErrors }, null, 2), 'utf8');
  console.log('结果文件：' + path.relative(ROOT, OUT));
  process.exitCode = fail.length ? 1 : 0;
}

main().catch(e => { console.error('✗ ' + e.message); process.exitCode = 1; });
