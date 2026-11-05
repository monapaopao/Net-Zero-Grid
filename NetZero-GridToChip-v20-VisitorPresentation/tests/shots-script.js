/* =====================================================================
 * 戈壁之光 · 零碳能量中枢 —— 截图脚本（单张模式，由 tests/shots.cjs 注入）
 *
 * 为什么不用 canvas.toDataURL：它只能取到 WebGL 画布，取不到抽屉、摘要、
 * 信息卡这些 DOM 覆盖层 —— 于是"账本页截图"会拍成一张没有账本的空场景。
 * 改为整页截图（CDP Page.captureScreenshot）。
 *
 * 为什么每张都要自报状态：曾经用 Chrome --screenshot + --virtual-time-budget，
 * 抓帧时机与页面的异步准备赛跑，输了也看不出来 —— 12 张里 9 张其实拍的是
 * 同一个默认状态（像素差分 meanDiff ≈ 0.01）。现在每个 SPEC 声明 expect，
 * 运行器把 __SHOT_META 与 expect 逐项比对，不一致即判失败并删除该图。
 *
 * 同一份脚本要能驱动两个版本：
 *   · 原版：window.__test（fitView / render / S / controls / camera）
 *   · 升级版：window.__NZ_TEST（情景、光照、画质、导览、设备聚焦）
 * ===================================================================== */
(function () {
  const isNew = !!window.__NZ_TEST;
  const api = window.__NZ_TEST || window.__test;
  const S = api.S;
  const q = new URLSearchParams(location.search);
  const want = q.get('shot');

  const raf = () => new Promise(r => requestAnimationFrame(r));
  async function frames(n) { for (let i = 0; i < n; i++) await raf(); }
  /* 按毫秒等待：补间/过渡都按真实时间推进，按帧数等会在慢机器上不够 */
  async function wait(ms) {
    const t0 = performance.now();
    while (performance.now() - t0 < ms) await raf();
  }

  function freeze() {
    try { S.running = false; } catch (e) { }
    try { if (api.controls) api.controls.autoRotate = false; } catch (e) { }
  }
  function fitCamera() { try { if (isNew) api.press('btnCamReset'); else api.fitView(); } catch (e) { } }
  function hideOverlays(except) {
    if (!isNew) return;
    const keep = except || [];
    try { if (keep.indexOf('drawer') < 0) api.closeDrawer(); } catch (e) { }
    try { if (keep.indexOf('info') < 0) api.press('infoClose'); } catch (e) { }
    try { if (keep.indexOf('tour') < 0) api.exitTour(); } catch (e) { }
    try {
      if (keep.indexOf('trend') < 0 && document.getElementById('trendPanel').classList.contains('open')) api.press('trendClose');
    } catch (e) { }
    try { if (keep.indexOf('toast') < 0) document.getElementById('toast').innerHTML = ''; } catch (e) { }
  }
  const setLight = k => { const b = document.querySelector('#segLight button[data-light="' + k + '"]'); if (b) b.click(); return !!b; };
  const setQuality = k => { const b = document.querySelector('#segQuality button[data-q="' + k + '"]'); if (b) b.click(); return !!b; };
  const setScenario = k => { if (isNew) api.applyScenario(k); };
  function setFixedNoon() {
    const chk = document.getElementById('chkDay');
    if (chk && chk.checked) { chk.checked = false; chk.dispatchEvent(new Event('change', { bubbles: true })); }
  }
  function lookAt(pos, tgt) {
    api.camera.position.set(pos[0], pos[1], pos[2]);
    api.controls.target.set(tgt[0], tgt[1], tgt[2]);
    api.controls.update();
  }
  const DEFAULT_CAM = { pos: [202, 132, 218], tgt: [42, 0, 46] };

  /* 推进仿真：截图前必须先跑一段，否则标签、摘要、账本全是 0.0 MW，
   * 截出来的图看不出任何运行状态。两个版本用不同的推进接口。 */
  function advance(sec) {
    if (isNew) { api.stepSeconds(sec); return; }
    let left = sec;
    while (left > 0) { const h = Math.min(4, left); api.simStep(h); left -= h; }
  }
  /* 原版把仿真时钟拨到旧版本"相当于从 12:00 起步"，再推进 tailSec。
   * 两个版本的起点不同（原版 08:00、升级版 12:00），而且原版页面一加载就按
   * 240× 自行推进，加载耗时会被算进仿真时间。于是"各自推进相同秒数"拍出来的
   * 两张对比图时钟差 4 小时以上（实测原版 09:20 vs 升级版 13:30），
   * 对比图就成了不同时刻的两张画。改为拨钟 + 推进，两版落在同一仿真时刻。
   * hour 是**落点**（推进结束后的时刻），不是起点。 */
  function oldRunTo(hour, tailSec) {
    if (isNew) return;
    S.running = false;
    S.simTime = Math.max(0, hour * 3600 - tailSec);
    S.day = Math.floor(S.simTime / 86400) + 1;
    advance(tailSec);
  }
  async function prime(sec, scenario) {
    S.running = false;
    setScenario(scenario || 'park');
    setFixedNoon();
    if (isNew) advance(sec || 5400);          /* 升级版：12:00 起步 → 13:30 */
    else oldRunTo(13.5, sec || 5400);         /* 原版：也落在 13:30 */
    S.running = false;
    try { api.updateLabels3D(); } catch (e) { }
    await frames(6);
  }

  /* 夜间同工况 prime：与 prime() 的区别是**不关昼夜循环**，两版都落在 22:00。
   * 原版从 08:00 一路推到 22:00 也行，但那样耗时且会带上加载漂移，直接拨钟。 */
  async function primeNight() {
    S.running = false;
    setScenario('park');
    if (isNew) advance(36000);                /* 12:00 → 22:00 */
    else oldRunTo(22, 1800);
    S.running = false;
    try { api.updateLabels3D(); } catch (e) { }
    await frames(6);
  }
  /* 总览基准机位：固定光照 + 固定视角，供多张图互相比较 */
  async function overview() {
    hideOverlays(); await frames(8);
    fitCamera(); await wait(120);
    lookAt(DEFAULT_CAM.pos, DEFAULT_CAM.tgt);
    await frames(8);
  }

  /* 每张图声明它"应该是什么样"。运行器逐项核对，不一致就判失败。
   * 只放机器可判定的量，构图本身仍靠目视。 */
  const SPECS = {
    default: {
      both: true,
      note: '默认情景 · 新疆 · 固定正午 · 蓝调展厅 · 标准画质 · 默认总览镜头（改造前后对比基准）',
      expect: { light: 'blue-hour', mode: 'exhibit' },
      setup: async () => {
        await prime(5400);
        if (isNew) { setLight('blue-hour'); setQuality('standard'); api.setMode('exhibit'); }
        await overview();
      }
    },
    'day-lab': {
      note: '展示光照：日间科研（与仿真时钟解耦，用于看清设备形制与阴影）',
      expect: { light: 'day-lab', mode: 'exhibit' },
      setup: async () => {
        await prime(5400);
        setLight('day-lab'); setQuality('standard'); api.setMode('exhibit');
        await overview();
      }
    },
    night: {
      note: '展示光照：夜间展厅（主光转月、路灯点亮、夜窗发光）',
      expect: { light: 'night', mode: 'exhibit' },
      setup: async () => {
        await prime(5400);
        setLight('night'); setQuality('standard'); api.setMode('exhibit');
        await overview();
      }
    },
    'sim-night': {
      both: true,
      note: '跟随仿真 · 夜间 22:00（两版同工况，用于改造前后对比夜间的空间层次与灯光）',
      expect: { light: 'follow', mode: 'exhibit' },
      setup: async () => {
        await primeNight();
        if (isNew) { setLight('follow'); setQuality('standard'); api.setMode('exhibit'); }
        await overview();
      }
    },
    'hydrogen-closeup': {
      note: '氢氨链特写：电解槽 → 储氢 → 合成氨 → 燃料电池；氢流为蓝色、氨流为紫色',
      expect: { light: 'blue-hour' },
      setup: async () => {
        await prime(5400, 'surplus');
        setLight('blue-hour'); setQuality('standard'); api.setMode('exhibit');
        hideOverlays(); await frames(8);
        lookAt([40, 34, 104], [36, 5, 66]);
        await frames(10);
      }
    },
    'focus-datacenter': {
      note: '设备聚焦：数据中心与巴拿马直流链路，右侧为设备信息卡（来源/去向/核算边界）',
      expect: { light: 'blue-hour', mode: 'run', info: true },
      setup: async () => {
        await prime(5400);
        setLight('blue-hour'); setQuality('standard'); api.setMode('run');
        hideOverlays(['info']); await frames(6);
        api.focus('dc');
        await wait(1600);           /* 聚焦补间 1.0 s，留足余量再抓帧 */
      }
    },
    'focus-with-drawer': {
      note: '运行面板与设备信息卡同时打开：信息卡左移让位，两者不互相遮挡',
      expect: { light: 'blue-hour', mode: 'run', info: true, drawer: true },
      setup: async () => {
        await prime(5400);
        setLight('blue-hour'); setQuality('standard'); api.setMode('run');
        hideOverlays(['drawer', 'info']);
        api.drawer('params'); await frames(8);
        api.focus('dc');
        await wait(1600);
      }
    },
    'drawer-ledger': {
      note: '运行面板 · 账本页：电量分项、来源账本、氢质量平衡、排放边界、日记录',
      expect: { light: 'blue-hour', mode: 'run', drawer: true },
      setup: async () => {
        await prime(21600);
        setLight('blue-hour'); setQuality('standard'); api.setMode('run');
        hideOverlays(['drawer']); api.drawer('ledger'); await frames(24);
      }
    },
    'drawer-devices': {
      note: '运行面板 · 设备页：按分区归类的设备树与各自的实时值',
      expect: { light: 'blue-hour', mode: 'run', drawer: true },
      setup: async () => {
        await prime(5400);
        setLight('blue-hour'); setQuality('standard'); api.setMode('run');
        hideOverlays(['drawer']); api.drawer('devices'); await frames(24);
      }
    },
    'drawer-policy': {
      note: '运行面板 · 边界与来源页：政策对标状态「待核算」、官方来源链接、已知边界清单',
      expect: { light: 'blue-hour', mode: 'run', drawer: true },
      setup: async () => {
        await prime(5400);
        setLight('blue-hour'); setQuality('standard'); api.setMode('run');
        hideOverlays(['drawer']); api.drawer('policy'); await frames(24);
      }
    },
    'tour-chapter3': {
      note: '60 秒导览：第 3 章「220 kV 母线与储能」字幕、章节号（03 / 07）与进度条',
      expect: { light: 'blue-hour', mode: 'exhibit', tour: true },
      setup: async () => {
        await prime(5400);
        setLight('blue-hour'); setQuality('standard'); api.setMode('exhibit');
        hideOverlays(['tour']); api.startTour(); await frames(6);
        api.tourJump(2); await wait(700);
      }
    },
    'quality-standard': {
      note: '画质档：兼容（阴影关闭、最低像素比）—— 与「精致」同机位同光照，便于对比',
      expect: { light: 'night', mode: 'exhibit', quality: 'compat' },
      setup: async () => {
        await prime(5400);
        setLight('night'); setQuality('compat'); api.setMode('exhibit');
        await overview();
      }
    },
    'quality-high-bloom': {
      note: '画质档：精致（阴影 2048 + 泛光后处理 + 更高像素比）—— 夜间泛光最能看出差别',
      expect: { light: 'night', mode: 'exhibit', quality: 'high', bloom: true },
      setup: async () => {
        await prime(5400);
        setLight('night'); setQuality('high'); api.setMode('exhibit');
        await overview();
        await wait(260);            /* 等自适应像素比与后处理尺寸稳定 */
      }
    },
    'trend-panel': {
      note: '平衡趋势面板：近 24 分钟仿真时间的发电/负荷/购电/弃电/储能充放曲线',
      expect: { light: 'blue-hour', mode: 'run' },
      setup: async () => {
        await prime(9000);
        setLight('blue-hour'); setQuality('standard'); api.setMode('run');
        hideOverlays(['trend']);
        api.press('btnTrend');
        await frames(24);
      }
    },
    'reduce-motion': {
      note: '减少动态效果：关闭过渡与自动环绕，镜头与面板不再动画（无障碍偏好）',
      expect: { light: 'blue-hour', mode: 'exhibit', reduceMotion: true },
      setup: async () => {
        await prime(5400);
        setLight('blue-hour'); setQuality('standard'); api.setMode('exhibit');
        api.press('btnReduce');
        await overview();
      }
    }
  };

  (async function () {
    const name = want && SPECS[want] ? want : 'default';
    const spec = SPECS[name];
    const ok = !!(spec.both || isNew);
    let err = null;
    if (ok) {
      try { await spec.setup(); }
      catch (e) { err = String(e && e.stack || e); }
    }
    /* 再多给两帧，确保布局与文字完成一次重排后再被截屏 */
    await frames(4);
    window.__SHOT_META = {
      name, note: spec.note, expect: spec.expect || null, skipped: !ok, error: err,
      version: isNew ? 'premium' : 'original',
      viewport: window.innerWidth + '×' + window.innerHeight,
      dpr: window.devicePixelRatio,
      quality: S.quality, light: S.lightPreset, scenario: S.scenario,
      mode: S.mode, reduceMotion: !!S.reduceMotion,
      bloom: (isNew && api.post) ? !!(api.post() && api.post().enabled) : null,
      bloomReason: (isNew && api.post) ? ((api.post() || {}).reason || null) : null,
      drawer: isNew ? document.getElementById('drawer').classList.contains('open') : null,
      info: isNew ? document.getElementById('infoCard').classList.contains('open') : null,
      tour: isNew ? document.getElementById('tourBar').classList.contains('on') : null,
      errors: (window.__SHOT_ERRORS || []).slice(0, 20),
      readyAt: Math.round(performance.now())
    };
    document.title = 'SHOT-OK ' + name + (err ? ' ERROR' : '') + (ok ? '' : ' SKIPPED');
  })();
})();
