/* =====================================================================
 * 戈壁之光 · 零碳能量中枢 —— 浏览器实测脚本（由 tests/browser-soak.cjs 注入）
 *
 * 这个脚本不是产物的组成部分，只在验收时追加到单文件末尾运行。
 * 它做的事情：把界面上"能点的都点一遍"、把七个情景各推 24 小时、
 * 切换三档画质与四种展示光照、跑一遍导览，并实测帧率；
 * 全程捕获 window.onerror / console.error，最后把结果回传。
 * ===================================================================== */
(function () {
  const R = {
    t0: Date.now(), checks: [], errors: [], consoleErrors: [], warnings: [],
    env: {}, perf: {}, scenarios: [], ui: {}
  };
  const send = txt => { try { document.getElementById('soakResult').textContent = txt; } catch (e) { } };

  window.addEventListener('error', e => R.errors.push('window.error: ' + (e.message || '') + ' @' + (e.filename || '') + ':' + (e.lineno || 0)));
  window.addEventListener('unhandledrejection', e => R.errors.push('unhandledrejection: ' + (e.reason && e.reason.message || e.reason)));
  const oErr = console.error, oWarn = console.warn;
  console.error = function () { R.consoleErrors.push([].slice.call(arguments).join(' ')); oErr.apply(console, arguments); };
  console.warn = function () { R.warnings.push([].slice.call(arguments).join(' ')); oWarn.apply(console, arguments); };

  const ck = (name, cond, info) => R.checks.push({ name: name, ok: !!cond, info: info == null ? null : String(info) });
  const raf = () => new Promise(r => requestAnimationFrame(r));
  async function frames(n) { for (let i = 0; i < n; i++) await raf(); }
  /* 按真实时间等待。UI 过渡是按毫秒写死的（抽屉/信息卡 0.28 s），
   * 用固定帧数等会在高帧率下不够 —— 本机 rAF 跑到 143 fps 时
   * 20 帧只有 0.14 s，抽屉还没滑到位就被量了尺寸，误报「越出视口」。 */
  async function ms(t) {
    const t0 = performance.now();
    while (performance.now() - t0 < t) await raf();
  }
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const okNum = v => typeof v === 'number' && Number.isFinite(v);

  /* ---------------- 1. 启动状态 ---------------- */
  async function phaseBoot() {
    await frames(3);
    if (!window.__NZ_TEST) { ck('展厅接口可用', false, 'window.__NZ_TEST 缺失'); return false; }
    const T = window.__NZ_TEST;
    const st = T.state();
    R.env.three = (window.THREE && THREE.REVISION) ? THREE.REVISION : '?';
    R.env.ua = navigator.userAgent;
    R.env.hw = (navigator.hardwareConcurrency || 0) + ' 线程';
    try {
      const gl = T.renderer.getContext();
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      R.env.gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      R.env.webgl2 = !!T.renderer.capabilities.isWebGL2;
      R.env.halfFloatRT = !!(gl.getExtension('EXT_color_buffer_half_float') || gl.getExtension('EXT_color_buffer_float'));
    } catch (e) { R.env.gpu = 'unknown'; }
    const post = T.post();
    R.env.bloomAvailable = !!(post && post.float);
    R.env.bloomReason = post ? post.reason : 'no-post-layer';
    R.env.modelVersion = T.cfg.version;
    R.env.defaultLightPreset = T.S.lightPreset;   /* 开机默认值：后面的用例会切换光照 */
    R.env.viewport = window.innerWidth + '×' + window.innerHeight + ' @dpr' + (window.devicePixelRatio || 1);

    ck('模型版本已声明', /^\d+\.\d+\.\d+$/.test(T.cfg.version), T.cfg.version);
    ck('标签节点数 = 场景标签数', document.querySelectorAll('.dev3d').length === st.labels,
      document.querySelectorAll('.dev3d').length + ' vs ' + st.labels);
    ck('设备拾取点已注册', st.devices >= 25, st.devices);
    ck('能源边线条数 ≥ 23（两条悬空的数据流示意线已按反馈删除）', st.edges >= 23, st.edges);
    /* v1.0.3：那两条数据流示意线的首尾都悬在半空、不接设备，已删除。
     * 这条断言防止它们（或任何新的"悬空装饰线"）被无意间加回来。 */
    ck('没有悬空的装饰性边线（dataFlow 边线为 0）',
      Array.isArray(EDGES) && EDGES.every(e => !e.dataFlow),
      '边线 ' + (Array.isArray(EDGES) ? EDGES.length : '?') + ' 条，其中 dataFlow ' +
      (Array.isArray(EDGES) ? EDGES.filter(e => e.dataFlow).length : '?') + ' 条');
    ck('物理已开始推进', st.steps > 0, st.steps + ' 步');
    /* 单独直出一次，拿到场景本身的绘制调用数（后期合成 pass 会覆盖 info） */
    try {
      T.renderer.render(T.scene, T.camera);
      R.env.sceneDrawCalls = T.renderer.info.render.calls;
      R.env.sceneTriangles = T.renderer.info.render.triangles;
      R.env.scenePrograms = T.renderer.info.programs ? T.renderer.info.programs.length : null;
    } catch (e) { R.errors.push('sceneRender: ' + e.message); }
    ck('政策状态为待核算', st.policy === 'pending', st.policy);
    ck('器件参数页已填充', document.getElementById('selRegion').options.length === 7,
      document.getElementById('selRegion').options.length + ' 个地区');
    return true;
  }

  /* ---------------- 2. 界面：能点的都点一遍 ---------------- */
  async function phaseUI() {
    const T = window.__NZ_TEST, S = T.S;
    const press = (id, note) => {
      try { const el = document.getElementById(id); if (!el) { ck('按钮存在 #' + id, false); return false; } el.click(); return true; }
      catch (e) { R.errors.push('click #' + id + ': ' + e.message); return false; }
    };
    await frames(2);

    /* 运行 / 暂停 */
    const run0 = S.running; press('btnRun'); await frames(2);
    ck('暂停按钮切换运行态', S.running !== run0, run0 + '→' + S.running);
    press('btnRun'); await frames(2);
    ck('再次点击恢复运行', S.running === run0);

    /* 倍速 */
    const sp = document.getElementById('selSpeed');
    for (const v of ['60', '1200', '3600', '240']) {
      sp.value = v; sp.dispatchEvent(new Event('change', { bubbles: true }));
      await frames(1);
      ck('倍速切换到 ' + v + '×', S.timeScale === +v, S.timeScale);
    }

    /* 相机 */
    press('btnCamReset'); await frames(2);
    press('btnAutoRot'); await frames(2);
    const rotOn = T.controls.autoRotate;
    press('btnAutoRot'); await frames(2);
    ck('自动环绕可开可关', rotOn === true && T.controls.autoRotate === false, rotOn + '→' + T.controls.autoRotate);

    /* 抽屉五个页签 */
    press('btnDrawer'); await frames(2);
    R.ui.drawerOpen = document.getElementById('drawer').classList.contains('open');
    ck('抽屉可打开', R.ui.drawerOpen);
    for (const tab of ['params', 'devices', 'ledger', 'events', 'policy']) {
      const b = document.querySelector('#drTabs button[data-tab="' + tab + '"]');
      b.click(); await frames(2);
      const shown = document.querySelector('.dr-page.on');
      ck('抽屉页签 ' + tab, shown && shown.dataset.page === tab, shown && shown.dataset.page);
    }
    /* 账本页必须有内容且不出现 NaN */
    document.querySelector('#drTabs button[data-tab="ledger"]').click(); await frames(2);
    const ledgerTxt = document.getElementById('drawer').textContent;
    ck('账本页无 NaN/undefined', !/NaN|undefined/.test(ledgerTxt), ledgerTxt.length + ' 字符');
    ck('账本页含守恒残差行', /残差/.test(ledgerTxt));
    R.ui.ledgerHasNaN = /NaN|undefined/.test(ledgerTxt);
    /* 事件页 */
    document.querySelector('#drTabs button[data-tab="events"]').click(); await frames(2);
    R.ui.eventRows = document.querySelectorAll('#evList .ev').length;
    ck('事件页有记录', R.ui.eventRows > 0, R.ui.eventRows + ' 条');
    /* 边界页 */
    document.querySelector('#drTabs button[data-tab="policy"]').click(); await frames(2);
    const pol = document.getElementById('policyBox').textContent;
    ck('边界页显式声明待核算', /待核算/.test(pol));
    ck('边界页列出 11 条已知边界', document.querySelectorAll('#boundList li').length === 11,
      document.querySelectorAll('#boundList li').length);
    ck('来源清单含官方 URL', /ndrc\.gov\.cn|mee\.gov\.cn/.test(document.getElementById('srcList').textContent));

    /* 趋势面板 */
    press('btnTrend'); await frames(3);
    ck('趋势面板可打开', document.getElementById('trendPanel').classList.contains('open'));
    press('trendClose'); await frames(2);
    ck('趋势面板可关闭', !document.getElementById('trendPanel').classList.contains('open'));

    /* 减少动态 */
    press('btnReduce'); await frames(2);
    ck('减少动态模式生效', document.body.classList.contains('reduce-motion'));
    press('btnReduce'); await frames(2);
    ck('减少动态可恢复', !document.body.classList.contains('reduce-motion'));

    /* 模式 */
    const modeRun = document.querySelector('#segMode button[data-mode="run"]');
    modeRun.click(); await frames(2);
    ck('运行模式 class 生效', document.body.classList.contains('mode-run'));
    document.querySelector('#segMode button[data-mode="exhibit"]').click(); await frames(2);
    ck('演示模式 class 生效', document.body.classList.contains('mode-exhibit'));

    /* 参数页开关 */
    for (const id of ['swSvg', 'swApf', 'swGenset', 'swFc']) {
      const before = document.getElementById(id).classList.contains('on');
      press(id); await frames(2);
      const after = document.getElementById(id).classList.contains('on');
      ck('开关 ' + id + ' 可切换', before !== after, before + '→' + after);
      press(id); await frames(2);   /* 还原 */
    }

    /* 四种展示光照 + 四种画质，切换后必须能连续出帧 */
    for (const lp of ['blue-hour', 'day-lab', 'night', 'follow']) {
      document.querySelector('#segLight button[data-light="' + lp + '"]').click();
      await frames(6);
      ck('展示光照 ' + lp + ' 可渲染', S.lightPreset === lp, S.lightPreset);
    }
    document.querySelector('#segLight button[data-light="blue-hour"]').click(); await frames(4);

    for (const q of ['compat', 'high', 'standard']) {
      document.querySelector('#segQuality button[data-q="' + q + '"]').click();
      await frames(6);
      ck('画质档 ' + q + ' 可渲染', S.quality === q, S.quality);
      /* 泛光只在「精致」档启用；必须在当次档位下读取，不能事后再看 */
      const bloomNow = !!(T.post() && T.post().enabled);
      if (q === 'high') {
        R.ui.bloomOnHigh = bloomNow;
        ck('精致档泛光与硬件能力一致',
          bloomNow === !!(T.post() && T.post().float),
          'float=' + T.post().float + ' enabled=' + bloomNow);
      } else {
        ck(q + ' 档不启用泛光', bloomNow === false, String(bloomNow));
      }
    }
    await frames(4);

    /* 七个地区 */
    const regs = Object.keys(T.REGIONS);
    for (const r of regs) {
      const sel = document.getElementById('selRegion');
      sel.value = r; sel.dispatchEvent(new Event('change', { bubbles: true }));
      await frames(4);
      ck('地区 ' + r + ' 可切换', S.region === r, S.region);
    }
    /* 回到新疆 */
    const sel = document.getElementById('selRegion');
    sel.value = 'xinjiang'; sel.dispatchEvent(new Event('change', { bubbles: true }));
    await frames(3);

    /* 风速 / 日照 / IT / 储能指令 */
    const rg = document.getElementById('rgWind');
    rg.value = '12'; rg.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('chkWind').checked = true;
    document.getElementById('chkWind').dispatchEvent(new Event('change', { bubbles: true }));
    await frames(6);
    ck('手动锁定风速生效', S.windManual === true && Math.abs(S.windSpeed - 12) < 1.5, S.windSpeed);
    document.getElementById('chkWind').checked = false;
    document.getElementById('chkWind').dispatchEvent(new Event('change', { bubbles: true }));
    const rgIt = document.getElementById('rgIt');
    rgIt.value = '300'; rgIt.dispatchEvent(new Event('input', { bubbles: true }));
    await frames(4);
    ck('IT 负载可调', Math.abs(S.itSlider - 300) < 1e-6, S.itSlider);
    rgIt.value = '150'; rgIt.dispatchEvent(new Event('input', { bubbles: true }));
    const st = document.getElementById('selSt');
    for (const m of ['charge', 'discharge', 'auto']) {
      st.value = m; st.dispatchEvent(new Event('change', { bubbles: true }));
      await frames(3);
      ck('储能指令 ' + m, S.stMode === m, S.stMode);
    }
    document.getElementById('chkDay').checked = false;
    document.getElementById('chkDay').dispatchEvent(new Event('change', { bubbles: true }));
    await frames(4);
    ck('固定正午模式可切换', S.dayNight === false);
    document.getElementById('chkDay').checked = true;
    document.getElementById('chkDay').dispatchEvent(new Event('change', { bubbles: true }));
    await frames(3);

    /* SMR 三档 */
    for (const g of ['2', '1', '0']) {
      document.querySelector('#segSmr button[data-gear="' + g + '"]').click();
      await frames(3);
      ck('SMR 档位 ' + g, S.smrGear === +g, S.smrGear);
    }

    /* 设备树：逐个聚焦并打开信息卡 */
    const devBtns = document.querySelectorAll('#devTree button[data-dev]');
    R.ui.devButtons = devBtns.length;
    ck('设备树条目数 ≥ 25', devBtns.length >= 25, devBtns.length);
    let opened = 0, withInfo = 0;
    for (const b of devBtns) {
      b.click(); await frames(2);
      if (document.getElementById('infoCard').classList.contains('open')) opened++;
      if (document.getElementById('infoTitle').textContent.trim().length > 0) withInfo++;
    }
    ck('每个设备都能打开信息卡', opened === devBtns.length, opened + '/' + devBtns.length);
    ck('信息卡都有标题', withInfo === devBtns.length);
    const infoTxt = document.getElementById('infoCard').textContent;
    ck('信息卡不含未替换的占位符', !/undefined|\[object/.test(infoTxt));
    press('infoClose'); await frames(2);
    ck('信息卡可关闭', !document.getElementById('infoCard').classList.contains('open'));

    /* 画布点选（中心点射线拾取）：不应抛错 */
    try {
      const cv = document.getElementById('gridCanvas');
      const r = cv.getBoundingClientRect();
      const ev = new PointerEvent('pointerdown', { clientX: r.width / 2, clientY: r.height / 2, bubbles: true });
      cv.dispatchEvent(ev);
      cv.dispatchEvent(new MouseEvent('click', { clientX: r.width / 2, clientY: r.height / 2, bubbles: true }));
      await frames(3);
      ck('画布点选不抛错', true);
    } catch (e) { ck('画布点选不抛错', false, e.message); }

    /* 快捷键（不发 Escape，避免影响后续） */
    try {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', bubbles: true }));
      await frames(2);
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
      await frames(6);
      ck('快捷键 T 可发起导览', document.getElementById('tourBar').classList.contains('on'));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await frames(3);
      ck('Escape 可退出导览', !document.getElementById('tourBar').classList.contains('on'));
    } catch (e) { ck('快捷键可用', false, e.message); }

    /* 导览：逐章跳转 + 暂停 */
    press('btnTour'); await frames(4);
    ck('导览条出现', document.getElementById('tourBar').classList.contains('on'));
    /* 章节总数从界面读（"01 / 07"），不再写死 6 —— 章节数会随版本变 */
    const tourTotal = parseInt((document.getElementById('tourChap').textContent.split('/')[1] || '').trim(), 10) || 6;
    for (let c = 0; c < tourTotal; c++) {
      T.tourJump(c); await frames(8);
      ck('导览第 ' + (c + 1) + ' 章可跳转', document.getElementById('tourChap').textContent.indexOf(String(c + 1).padStart(2, '0')) === 0,
        document.getElementById('tourChap').textContent);
    }
    /* v1.0.5：运镜是"一条连续路径"——章节之间不停顿、注视点不跳变。
     * 在中间三章各采一次样：0.5 s 内机位与注视点都必须在推进，且位移量合理
     * （既不是静止、也不是瞬移）。 */
    {
      const samples = [];
      /* 抽样只取**会移动**的章节：第 4 章（算力与超充）现在会进楼并按设计挂起，
       * 单独由下一条断言验（相机静止 + 窗口打开）。 */
      for (const c of [1, 2, 4]) {
        T.tourJump(c); await frames(6);
        const a = { p: T.camera.position.toArray(), t: T.controls.target.toArray(),
          chap: document.getElementById('tourChap').textContent, tt: document.getElementById('tourTime').textContent };
        await wait(500);
        const b = { p: T.camera.position.toArray(), t: T.controls.target.toArray(),
          chap: document.getElementById('tourChap').textContent, tt: document.getElementById('tourTime').textContent };
        samples.push({
          chap: c + 1, aChap: a.chap, bChap: b.chap, aT: a.tt, bT: b.tt,
          a: a.p.map(function (v) { return +v.toFixed(0); }),
          b: b.p.map(function (v) { return +v.toFixed(0); }),
          at: a.t.map(function (v) { return +v.toFixed(0); }),
          bt: b.t.map(function (v) { return +v.toFixed(0); }),
          dp: +Math.hypot(b.p[0] - a.p[0], b.p[1] - a.p[1], b.p[2] - a.p[2]).toFixed(1),
          dt: +Math.hypot(b.t[0] - a.t[0], b.t[1] - a.t[1], b.t[2] - a.t[2]).toFixed(1)
        });
      }
      ck('运镜连续：每 0.5 s 机位与注视点都在推进、无跳变',
        samples.every(s => s.dp > 1 && s.dp < 60 && s.dt > 0.2),
        JSON.stringify(samples));
    }
    /* v1.3.5：第 4 章会进楼 —— 园区导览在这一刻**有意挂起**（相机静止、时钟停住），
     * 由楼内应用自己的时间轴接管；跑完自动收窗并进入第 5 章。 */
    {
      T.tourJump(3); await frames(6);
      await wait(700);
      const a = { p: T.camera.position.toArray(), dc: !!T.dcWaiting() };
      await wait(700);
      const b = { p: T.camera.position.toArray(), dc: !!T.dcWaiting() };
      const moved = Math.hypot(b.p[0] - a.p[0], b.p[1] - a.p[1], b.p[2] - a.p[2]);
      ck('进楼时园区导览按设计挂起（窗口打开、相机静止、时钟停住）',
        a.dc && b.dc && moved < 0.5,
        JSON.stringify({ dcA: a.dc, dcB: b.dc, moved: +moved.toFixed(2) }));
      T.exitTour(); await wait(400);
      press('btnTour'); await frames(4);
    }
    T.toggleTourPause(); await frames(3);
    const paused = document.getElementById('tourPause').textContent === '继续';
    T.toggleTourPause(); await frames(3);
    ck('导览可暂停/继续', paused);
    T.exitTour(); await frames(3);
    ck('导览可退出', !document.getElementById('tourBar').classList.contains('on'));
    ck('导览进度条归零', document.getElementById('tourProg').style.width === '0%',
      document.getElementById('tourProg').style.width);
    ck('退出导览后相机受控', T.controls.enabled === true);

    /* v1.0.6：跑仿真时日夜必须真的更替 —— 场景光照与两处提示都要跟着仿真时钟走。
     * 把仿真时钟拨到正午与午夜各取一次，比较光照状态、光伏辐照与信息流文案。 */
    {
      const followBtn = document.querySelector('#segLight button[data-light="follow"]');
      if (followBtn) followBtn.click();
      await frames(4);
      const toHour = h => {
        const d = ((h * 3600 - T.S.simTime) % 86400 + 86400) % 86400;
        T.stepSeconds(d); return d;
      };
      const readState = async () => {
        await wait(420);                       /* 等 0.25 s 节拍刷新信息流 */
        const ls = T.lightState();
        return {
          preset: T.S.lightPreset, night: ls.night, dl: +ls.dl.toFixed(3),
          irradi: +T.S.irradi.toFixed(3),
          phase: document.getElementById('clockPhase').textContent,
          site: (document.querySelector('[data-tk="site"]') || {}).textContent || ''
        };
      };
      toHour(12); const noon = await readState();
      toHour(0); const mid = await readState();
      ck('默认展示光照是「跟随仿真」（开机值）', R.env.defaultLightPreset === 'follow',
        R.env.defaultLightPreset);
      ck('场景光照随仿真昼夜变化',
        noon.night === 0 && mid.night === 1 && noon.dl > mid.dl && noon.irradi > mid.irradi,
        '正午 night=' + noon.night + ' dl=' + noon.dl + ' 光照=' + noon.irradi +
        ' ｜ 午夜 night=' + mid.night + ' dl=' + mid.dl + ' 光照=' + mid.irradi);
      ck('时钟相位跟着仿真显示昼夜',
        noon.phase.indexOf('白天') >= 0 && mid.phase.indexOf('夜间') >= 0,
        '正午「' + noon.phase + '」 午夜「' + mid.phase + '」');
      ck('信息流的「地区」项跟着仿真显示昼夜',
        noon.site.indexOf('白天') >= 0 && mid.site.indexOf('夜间') >= 0,
        '正午「' + noon.site + '」 午夜「' + mid.site + '」');
      /* 恢复：拨回正午 + 切回展厅档，后续截图与步骤与之前一致 */
      const bh = document.querySelector('#segLight button[data-light="blue-hour"]');
      if (bh) bh.click();
      /* ---- v1.0.7：① 情景原生下拉 ② 顶栏日月弧随仿真 ③ 白天地面冷色 ---- */
      const sel = document.getElementById('selScenario');
      ck('情景是原生下拉且列出全部情景',
        !!sel && sel.tagName === 'SELECT' &&
        sel.options.length === Object.keys(T.cfg.SCENARIOS).length,
        sel ? sel.tagName + ' / ' + sel.options.length + ' 项' : '找不到 #selScenario');
      if (sel) {
        sel.value = 'night';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        await wait(300);
        const sw = T.S.scenario === 'night';
        sel.value = 'park';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        await wait(300);
        ck('下拉切换情景立刻生效', sw && T.S.scenario === 'park',
          '切到 night → ' + (sw ? '生效' : '未生效') + '；切回 park → ' + T.S.scenario);
      }
      const arcAt = async h => {
        const d = ((h * 3600 - T.S.simTime) % 86400 + 86400) % 86400;
        T.stepSeconds(d); await wait(430);
        const cv = document.getElementById('sunArc');
        return cv ? cv.toDataURL() : '';
      };
      const arcNoon = await arcAt(12), arcMid = await arcAt(0);
      ck('顶栏日月弧随仿真变化（与光照预设无关）',
        arcNoon.length > 100 && arcMid.length > 100 && arcNoon !== arcMid,
        '正午/午夜画布内容' + (arcNoon !== arcMid ? '不同' : '相同'));
      await arcAt(12);
      ck('白天地面改为冷色（蓝通道 > 红通道）',
        groundMat.color.b > groundMat.color.r,
        'r=' + groundMat.color.r.toFixed(3) + ' g=' + groundMat.color.g.toFixed(3) +
        ' b=' + groundMat.color.b.toFixed(3));

      /* ---- v1.3.5：导览中的"进楼"环节 ---- */
      {
        const dc = T.dcdt;
        if (dc && T.DC_SEG) {
          const saved = { from: T.DC_SEG.from, to: T.DC_SEG.to, delay: T.DC_SEG.startDelay };
          T.startTour(); await wait(300);
          /* 用 3 秒的短段跑**同一条代码路径**（真段是 0→87 s，等不起） */
          T.DC_SEG.from = 0; T.DC_SEG.to = 3; T.DC_SEG.startDelay = 500;
          T.tourJump(3);                       /* 第 4 章 = 算力与超充 */
          await wait(3600);
          const a = dc.state();
          const posA = a.trim && a.trim.anim ? a.trim.anim.pos : null;
          ck('M1.6：导览走到「算力与超充」会自动进楼（窗口打开、楼内时间轴在走）',
            a.open && a.mounted && a.appReady && a.trim.anim && posA != null,
            '开窗=' + a.open + ' 载入=' + a.mounted + ' 就绪=' + a.appReady +
            ' 楼内时间轴 ' + posA + ' s');
          await wait(6200);
          const b = dc.state();
          const chapTxt = (document.getElementById('tourChap') || {}).textContent || '';
          ck('M1.6：楼内段跑完自动收窗，园区导览接着走（04 → 05）',
            b.open === false && b.mounted === false && /05/.test(chapTxt),
            '窗口 open=' + b.open + ' 载入=' + b.mounted + '；园区章节 ' + chapTxt);
          T.DC_SEG.from = saved.from; T.DC_SEG.to = saved.to; T.DC_SEG.startDelay = saved.delay;
          T.exitTour(); await wait(400);
        }
      }

      /* ---- v1.3.2：品牌 logo 已换成新版 ---- */
      {
        const B = window.NZ_BRAND;
        ck('品牌 logo 已换新版（按原布局重绘了品牌贴图）',
          !!B && B.applied >= 2 && B.mint > 0 && !B.err,
          B ? ('重绘贴图 ' + B.applied + ' 张，薄荷色像素 ' + B.mint + '，重试 ' + B.tries + ' 次' + (B.err ? '，错误 ' + B.err : '')) : '没有 NZ_BRAND');
      }

      /* ---- v1.3.0（M1.2）：小窗里嵌的是《Grid-to-Chip》应用本体 ---- */
      {
        const dc = T.dcdt;
        ck('M1.2：数字孪生宿主接口可用', !!dc && typeof dc.open === 'function',
          dc ? 'ok' : '没有 __NZ_TEST.dcdt');
        if (dc) {
          dc.open();
          /* 它要构建整套程序化几何，给足时间 */
          await wait(3200);
          const s1 = dc.state();
          ck('M1.2：内置应用在窗口内就绪（五级 / 六系统 / 时间轴 / 画布）',
            s1.open && s1.mounted && s1.appReady && s1.levels === 5 && s1.systems === 6 &&
            s1.timeline && s1.flowToggles >= 5 && !!s1.canvas && s1.canvas[0] > 100 &&
            s1.frame[0] > 300,
            '载入=' + s1.mounted + ' 就绪=' + s1.appReady + ' 窗口=' + JSON.stringify(s1.frame) +
            ' 画布=' + JSON.stringify(s1.canvas) + ' 层级=' + s1.levels + ' 系统=' + s1.systems +
            ' 图层开关=' + s1.flowToggles + ' 标题=' + s1.title.slice(0, 18));
          const t0 = T.S.simTime;
          await wait(700);
          ck('M1.2：园区在背景继续跑（嵌入视图不打断主场景）', T.S.simTime > t0,
            'simTime ' + t0.toFixed(0) + '→' + T.S.simTime.toFixed(0));
          ck('M1.2：可在窗口内切换层级', dc.clickIn('#levels button[data-level="1"]'),
            '点击「楼层爆炸」');
          await wait(1100);
          const s2 = dc.state();
          ck('M1.2：层级切换生效（场景标题跟着变）',
            /楼层|EXPLOD/i.test((s2.kicker || '') + (s2.activeLevel || '')) ||
            /LEVEL 02/i.test(s2.kicker || ''),
            'kicker=' + s2.kicker + ' 选中=' + s2.activeLevel);
          dc.clickIn('#systems button[data-system="power"]'); await wait(500);
          const s3 = dc.state();
          ck('M1.2：系统图层可切换', /Power|HVDC/i.test(s3.activeSystem || ''), '选中系统=' + s3.activeSystem);
          const pw0 = s3.power;
          dc.setLoadIn(95); await wait(600);
          ck('M1.2：负载滑块能驱动它的演示数据（功率读数变化）',
            dc.state().power !== pw0 && !!dc.state().power,
            pw0 + ' → ' + dc.state().power);
          dc.clickIn('#play'); await wait(1500);
          const s4 = dc.state();
          ck('M1.2：175 秒导览可播放（章节/时间在推进）',
            !!s4.chapter && !!s4.time && s4.time !== s3.time,
            '章节=' + s4.chapter + ' 时间=' + s3.time + ' → ' + s4.time);
          const st = dc.state();
          ck('M1.4：保留侧边栏 + 中间场景 + 底部动画控制（仅隐藏顶栏与右侧 INSPECTOR）',
            !!st.trim && st.trim.header === 'none' && st.trim.right === 'none' &&
            st.trim.footer !== 'none' && st.trim.left !== 'none' && st.trim.viewport &&
            st.trim.anim && st.trim.anim.play && st.trim.anim.timeline && st.trim.anim.jumpPoints >= 4,
            '顶栏=' + st.trim.header + ' 右侧=' + st.trim.right + ' 底部=' + st.trim.footer +
            ' 左栏=' + st.trim.left + '；底部控制：' + JSON.stringify(st.trim.anim));
          ck('M1.3：窗口是液态玻璃（毛玻璃 + 大圆角 + 渐入渐出过渡）',
            !!st.glass && /blur/.test(st.glass.blur) && parseFloat(st.glass.radius) >= 18 &&
            /opacity/.test(st.glass.transition),
            JSON.stringify(st.glass));
          /* v1.5：园区账本读数条 + 楼内负载单向同步 */
          {
            const led = document.getElementById('dcdtLedger');
            const txt = led ? led.textContent.replace(/\s+/g, ' ') : '';
            const it = T.S.itMW, Pl = window.NZ_CONFIG.PLANT;
            const wantPct = Math.max(20, Math.min(100, Math.round(it / Pl.itMaxMW * 100)));
            const inFrame = (function () {
              const f = document.getElementById('dcdtFrame');
              const el = f && f.contentDocument && f.contentDocument.getElementById('load');
              return el ? Number(el.value) : null;
            })();
            /* itMW 本身带 ±0.5 MW 的仿真抖动，所以这里按幅度做容差，不做精确比对 */
            const shown = (txt.match(/IT 负载 ([0-9.]+) MW/) || [])[1];
            ck('M1.5：窗口里有「园区账本」读数条，数值与内核一致（容差 ±1 MW）',
              !!led && /园区账本/.test(txt) && shown != null && Math.abs(Number(shown) - it) <= 1 &&
              txt.indexOf('PUE') >= 0 && txt.indexOf('进线') >= 0 && txt.indexOf('链路变换损耗') >= 0,
              'IT 内核 ' + it.toFixed(2) + ' MW / 条上 ' + shown + ' MW；条：' + txt.slice(0, 150));
            /* 前面那条断言把滑块手动设成了 95%，这里先强制重同步 —— 这正是 A 的行为：
             * 账本值不变时我们不去抢用户的手动值，但随时可以重新对齐。 */
            dc.resyncLoad(); await wait(400);
            const inFrame2 = (function () {
              const f = document.getElementById('dcdtFrame');
              const el = f && f.contentDocument && f.contentDocument.getElementById('load');
              return el ? Number(el.value) : null;
            })();
            const txt2 = (document.getElementById('dcdtLedger') || {}).textContent.replace(/\s+/g, ' ') || '';
            ck('M1.5：楼内「运行负载」由园区账本单向同步（负载/额定 同口径）',
              inFrame2 === wantPct && new RegExp('楼内负载同步 ' + wantPct + ' %').test(txt2),
              '内核 IT ' + it.toFixed(1) + ' / 上限 ' + Pl.itMaxMW + ' → ' + wantPct + ' %；' +
              '手动 95% 后重同步实测 ' + inFrame2 + ' %；条：' + txt2.slice(0, 120));
          }

          /* v1.4：底部播放按钮与时间轴要真的可用 —— 按钮是开关，所以两侧都验：
           * 点一次应冻结（上面那条断言刚点过播放，此刻在播），再点一次应继续前进。 */
          dc.clickIn('#play'); await wait(600);
          const t1 = dc.state().trim.anim.time;
          await wait(700);
          const t2 = dc.state().trim.anim.time;
          dc.clickIn('#play'); await wait(1600);
          const s4b = dc.state();
          ck('M1.4：底部播放按钮可用（点一次冻结、再点一次继续），时间轴 0–98 s',
            !!s4b.trim.anim && t1 === t2 && s4b.trim.anim.time !== t2 && s4b.trim.anim.max >= 60 &&
            s4b.trim.anim.jumpPoints >= 4,
            '暂停时 ' + t1 + '→' + t2 + '（冻结），再播放 ' + t2 + '→' + s4b.trim.anim.time +
            '；时间轴 0–' + s4b.trim.anim.max + 's，跳转点 ' + s4b.trim.anim.jumpPoints +
            ' 个，开关：' + s4b.trim.anim.togglesText);
          dc.close(); await wait(700);
          const s5 = dc.state();
          ck('M1.3：渐出结束后才卸载（iframe 收掉、不留渲染循环）',
            s5.open === false && s5.mounted === false && s5.canvas === null,
            'open=' + s5.open + ' 载入=' + s5.mounted + ' 画布=' + JSON.stringify(s5.canvas));
        }
      }
      toHour(12); await frames(4);            /* 拨回正午，不影响后续步骤 */
    }

    /* v1.0.4：末章是「回顾」——导览自然走完时，相机应当已经回到总览机位。
     * 这里不手动退出，而是跳到最后两章、等末章（6 s）自己走完再验。 */
    press('btnTour'); await frames(4);
    T.tourJump(tourTotal - 2); await frames(6);
    T.tourJump(tourTotal - 1); await frames(6);
    /* 末章 10 秒：等它自然走完。轮询而不是固定等待 —— 章节时长改了不用改测试 */
    for (let i = 0; i < 60 && document.getElementById('tourBar').classList.contains('on'); i++) await wait(500);
    {
      const p = T.camera.position;
      const near = (a, b) => Math.abs(a - b) < 2;
      const endOk = !document.getElementById('tourBar').classList.contains('on') &&
        near(p.x, T.TOUR_HOME.pos[0]) && near(p.y, T.TOUR_HOME.pos[1]) && near(p.z, T.TOUR_HOME.pos[2]) &&
        T.controls.enabled === true;
      ck('导览走完后回到总览机位（末章回顾）', endOk,
        '相机 [' + p.x.toFixed(1) + ', ' + p.y.toFixed(1) + ', ' + p.z.toFixed(1) +
        ']（导览开场/结束机位 ' + T.TOUR_HOME.pos.join(', ') + '，取自产物），导览条 ' +
        (document.getElementById('tourBar').classList.contains('on') ? '仍开' : '已关'));
      ck('末章是「回顾」而不是普通章节', tourTotal >= 7, '共 ' + tourTotal + ' 章');
    }
  }

  /* ---------------- 2b. 布局：面板不越界、不重叠、文字不截断 ---------------- */
  async function phaseLayout() {
    const T = window.__NZ_TEST;
    const W = window.innerWidth, H = window.innerHeight;
    const r = id => {
      const el = document.getElementById(id);
      if (!el || getComputedStyle(el).display === 'none') return null;
      const b = el.getBoundingClientRect();
      return { id, x: +b.left.toFixed(1), y: +b.top.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1),
        r: +b.right.toFixed(1), b: +b.bottom.toFixed(1) };
    };
    const rects = {};
    for (const id of ['topbar', 'summary', 'legend', 'flexHud', 'bottomBar', 'camHint', 'vignette']) {
      const x = r(id); if (x) rects[id] = x;
    }
    R.ui.layout = { viewport: W + '×' + H, rects: rects };
    R.ui.css = {
      /* v1.0.4 起 .brand-text 元素本身已移除（顶部不再显示园区名）—— 元素不存在也算隐藏 */
      brandTextHidden: (function () {
        const bt = document.querySelector('.brand-text');
        return !bt || getComputedStyle(bt).display === 'none';
      })(),
      summaryVisible: getComputedStyle(document.getElementById('summary')).display !== 'none',
      legendVisible: getComputedStyle(document.getElementById('legend')).display !== 'none',
      qualitySegVisible: true
    };

    ck('无横向页面滚动', document.documentElement.scrollWidth <= W + 2,
      document.documentElement.scrollWidth + ' vs ' + W);
    for (const id in rects) {
      const b = rects[id];
      ck('面板 #' + id + ' 在视口内',
        b.x >= -1 && b.y >= -1 && b.r <= W + 1 && b.b <= H + 1,
        '[' + b.x + ',' + b.y + ' → ' + b.r + ',' + b.b + ']');
    }
    const overlap = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.x, b.x)) *
      Math.max(0, Math.min(a.b, b.b) - Math.max(a.y, b.y));
    const pairs = [['summary', 'bottomBar'], ['legend', 'bottomBar'], ['flexHud', 'legend'],
      ['flexHud', 'bottomBar'], ['summary', 'legend']];
    for (const [a, b] of pairs) {
      if (!rects[a] || !rects[b]) continue;
      const ov = overlap(rects[a], rects[b]);
      ck('面板 #' + a + ' 与 #' + b + ' 不重叠', ov < 4, '重叠 ' + ov.toFixed(1) + ' px²');
    }

    /* 抽屉打开：不得越出视口。等足 0.28 s 的滑入过渡再量。 */
    window.__NZ_TEST.drawer('ledger');
    await frames(4);
    await ms(380);
    const dr = document.querySelector('#drawer');
    const bd = dr.getBoundingClientRect();
    ck('抽屉打开后仍在视口内', bd.left >= -1 && bd.right <= W + 1 && bd.bottom <= H + 1,
      '[' + bd.left.toFixed(0) + ',' + bd.top.toFixed(0) + ' → ' + bd.right.toFixed(0) + ',' + bd.bottom.toFixed(0) + ']');
    /* 文字不截断：抽查几个容器 */
    for (const sel of ['#summary .sum-foot', '#bottomBar .bb-ctl', '#drawer .dr-body', '#evList']) {
      const el = document.querySelector(sel);
      if (!el) continue;
      ck('容器 ' + sel + ' 无横向溢出', el.scrollWidth <= el.clientWidth + 2,
        el.scrollWidth + ' vs ' + el.clientWidth);
    }
    /* 3D 悬浮标签：显式可见的标签两两不得重叠（分区水印除外） */
    {
      const vis = [];
      for (const el of document.querySelectorAll('.dev3d')) {
        if (el.classList.contains('zone') || el.classList.contains('hidden')) continue;
        if (getComputedStyle(el).visibility === 'hidden' || getComputedStyle(el).display === 'none') continue;
        const b = el.getBoundingClientRect();
        if (b.width < 2) continue;
        vis.push({ id: el.querySelector('.nm') ? el.querySelector('.nm').textContent : '?',
          x: b.left, y: b.top, r: b.right, b: b.bottom });
      }
      const bad = [];
      for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
        const a = vis[i], c = vis[j];
        const ox = Math.min(a.r, c.r) - Math.max(a.x, c.x);
        const oy = Math.min(a.b, c.b) - Math.max(a.y, c.y);
        if (ox > 2 && oy > 2) bad.push(a.id + ' ∩ ' + c.id + '（' + (ox * oy).toFixed(0) + ' px²）');
      }
      R.ui.visibleLabels = vis.length;
      R.ui.labelOverlaps = bad.slice(0, 6);
      ck('显式可见的 3D 标签互不重叠', bad.length === 0,
        vis.length + ' 个可见标签，重叠 ' + bad.length + ' 对' + (bad.length ? '：' + bad.slice(0, 3).join('；') : ''));
    }

    /* 账本表右列必须有值，且不出抽屉 */
    {
      document.querySelector('#drTabs button[data-tab="ledger"]').click();
      await frames(8);
      const tbl = document.getElementById('tbFlow');
      const cells = tbl.querySelectorAll('tr td:last-child');
      let empty = 0;
      cells.forEach(td => { if (!td.textContent.trim()) empty++; });
      ck('账本表每行右列都有值', cells.length > 0 && empty === 0, cells.length + ' 行，空值 ' + empty);
      const drBox = document.querySelector('#drawer .dr-body').getBoundingClientRect();
      if (cells.length) {
        const cb = cells[cells.length - 1].getBoundingClientRect();
        ck('账本表数值列完整落在抽屉内', cb.right <= drBox.right + 1 && cb.left >= drBox.left - 1,
          '值列右缘 ' + cb.right.toFixed(0) + ' vs 抽屉正文右缘 ' + drBox.right.toFixed(0));
      }
      ck('账本表含氢质量平衡行', /氢质量平衡/.test(tbl.parentElement.textContent));
      window.__NZ_TEST.closeDrawer();
      await frames(6);
    }

    /* 抽屉 + 信息卡同时打开：信息卡不得被抽屉盖住
     * （抽屉宽 460px、z-index 20；信息卡 360px、z-index 15，不动就会被整块吃掉） */
    {
      window.__NZ_TEST.drawer('params');
      await frames(4);
      await ms(380);
      window.__NZ_TEST.focus('dc');
      await ms(400);
      const card = document.getElementById('infoCard');
      const open = card.classList.contains('open');
      ck('设备聚焦后信息卡弹出', open);
      if (open) {
        const cb = card.getBoundingClientRect();
        const db = document.querySelector('#drawer').getBoundingClientRect();
        const ov = Math.max(0, Math.min(cb.right, db.right) - Math.max(cb.left, db.left)) *
          Math.max(0, Math.min(cb.bottom, db.bottom) - Math.max(cb.top, db.top));
        R.ui.infoCard = { x: +cb.left.toFixed(1), y: +cb.top.toFixed(1),
          w: +cb.width.toFixed(1), h: +cb.height.toFixed(1), overlapWithDrawer: +ov.toFixed(1) };
        ck('信息卡不被运行面板遮挡', ov < 4, '重叠 ' + ov.toFixed(1) + ' px²');
        ck('信息卡在视口内', cb.left >= -1 && cb.right <= W + 1 && cb.bottom <= H + 1,
          '[' + cb.left.toFixed(0) + ',' + cb.top.toFixed(0) + ' → ' + cb.right.toFixed(0) + ',' + cb.bottom.toFixed(0) + ']');
      }
      window.__NZ_TEST.closeDrawer();
      await frames(6);
    }

    /* 提示语在 1100px 以下应被隐藏（避免压住底部栏） */
    if (W <= 1100) ck('窄视口隐藏摘要/图例',
      !R.ui.css.summaryVisible && !R.ui.css.legendVisible);
    window.__NZ_TEST.closeDrawer();
    await frames(10);
  }

  /* ---------------- 3. 七个情景各推 24 小时 ---------------- */
  async function phaseScenarios() {
    const T = window.__NZ_TEST, S = T.S;
    /* 暂停主循环：否则 rAF 里的 tick 会在取样点之间继续推进物理，
     * 使「瞬时快照」与「累计账本」不在同一时刻，两者不可比。 */
    S.running = false;
    for (const key of Object.keys(T.cfg.SCENARIOS)) {
      T.applyScenario(key);
      await frames(3);
      const t0 = performance.now();
      const n = T.stepSeconds(86400);
      const ms = performance.now() - t0;
      const snap = T.snapshot();
      const led = T.ledger();                 /* 与 snapshot 同一时刻 */
      const f = led.flows;
      await frames(4);
      const closure = (f.generationMWh + f.gridBuyMWh + f.dischargeMWh)
        - (f.loadMWh + f.chargeMWh + f.exportMWh);
      const consTot = Object.keys(led.consumptionBySourceMWh)
        .reduce((a, k) => a + led.consumptionBySourceMWh[k], 0);
      const row = {
        key: key, label: T.cfg.SCENARIOS[key].label, steps: n, ms: +ms.toFixed(0),
        /* 24 小时累计账本（与 reset 后同步，等于该情景一天的完整口径） */
        acc: {
          genMWh: +f.generationMWh.toFixed(2), loadMWh: +f.loadMWh.toFixed(2),
          buyMWh: +f.gridBuyMWh.toFixed(2), curtailMWh: +f.curtailMWh.toFixed(2),
          unservedMWh: +f.unservedMWh.toFixed(3), exportMWh: +f.exportMWh.toFixed(3),
          chargeMWh: +f.chargeMWh.toFixed(2), dischargeMWh: +f.dischargeMWh.toFixed(2),
          recircMWh: +led.recirculatedMWh.toFixed(3),
          nh3T: +led.hydrogen.ammoniaTonnes.toFixed(2),
          h2StartKg: +led.hydrogen.startKg.toFixed(1),
          h2BalanceKg: +led.hydrogen.balanceKg.toFixed(6),
          h2ProducedKg: +led.hydrogen.producedKg.toFixed(1),
          h2ToAmmoniaKg: +led.hydrogen.toAmmoniaKg.toFixed(1),
          h2ToFuelCellKg: +led.hydrogen.toFuelCellKg.toFixed(2),
          gridCO2T: +led.emissionsT.grid.toFixed(2),
          closureMWh: closure,
          consumptionTotalMWh: +consTot.toFixed(2),
          consumptionRenewMWh: +(led.consumptionBySourceMWh.renew || 0).toFixed(2)
        },
        soc: +snap.soc.toFixed(2), h2Kg: +snap.h2Kg.toFixed(1),
        genMW: +snap.genMW.toFixed(2), gridBuyMW: +snap.gridBuyMW.toFixed(2),
        curtailMW: +snap.curtailMW.toFixed(2), unservedMW: +snap.unservedMW.toFixed(3),
        nh3TDay: +snap.nh3TDay.toFixed(3),
        residualMW: snap.residuals.powerMW, h2ResidualKg: snap.residuals.h2Kg,
        renewShare: +(snap.renewableShare || 0).toFixed(4), cleanShare: +(snap.cleanShare || 0).toFixed(4),
        solverIters: snap.solver.iterations, converged: snap.solver.converged,
        badEvents: 0, nan: false
      };
      row.nan = !(okNum(row.soc) && okNum(row.h2Kg) && okNum(row.genMW) && okNum(row.renewShare));
      row.badEvents = T.engine.L.events.filter(e => e.level === 'bad').length;
      R.scenarios.push(row);

      ck('情景「' + row.label + '」24h 无 NaN', !row.nan);
      ck('情景「' + row.label + '」母线残差在机器精度内',
        Math.abs(row.residualMW) < 1e-6, row.residualMW);
      ck('情景「' + row.label + '」氢质量残差在机器精度内',
        Math.abs(row.h2ResidualKg) < 1e-6, row.h2ResidualKg);
      ck('情景「' + row.label + '」求解收敛', row.converged === true, '迭代 ' + row.solverIters + ' 轮');
      ck('情景「' + row.label + '」库存不越界',
        row.soc >= 9.9 && row.soc <= 95.1 && row.h2Kg >= -1e-6 && row.h2Kg <= 10000 + 1e-6,
        'SOC ' + row.soc + '%, 氢 ' + row.h2Kg + ' kg');
      ck('情景「' + row.label + '」可再生占比在 0..1',
        row.renewShare >= 0 && row.renewShare <= 1, row.renewShare);
      /* 电量闭合：发电＋购电＋放电 = 已供需求＋充电＋外送
       * （弃电已从实际发电中扣除，未供电不计入已供需求，两者都不在等式两侧） */
      ck('情景「' + row.label + '」24h 电量账本闭合（残差 < 0.01 MWh）',
        Math.abs(row.acc.closureMWh) < 0.01, row.acc.closureMWh.toFixed(6) + ' MWh');
      ck('情景「' + row.label + '」端用电来源成分与用电量一致（<0.01 MWh）',
        Math.abs(row.acc.consumptionTotalMWh - row.acc.loadMWh) < 0.01,
        row.acc.consumptionTotalMWh + ' vs ' + row.acc.loadMWh);
      ck('情景「' + row.label + '」氢质量账本闭合（初 + 产 − 氨用 − 池用 = 末）',
        Math.abs(row.acc.h2BalanceKg) < 1e-6,
        '初 ' + row.acc.h2StartKg + ' + 产 ' + row.acc.h2ProducedKg +
        ' − 氨用 ' + row.acc.h2ToAmmoniaKg + ' − 池用 ' + row.acc.h2ToFuelCellKg +
        ' = 末 ' + row.h2Kg + '（余差 ' + row.acc.h2BalanceKg + ' kg）');
    }
    /* 回到默认情景并恢复运行 */
    T.applyScenario('park');
    S.running = true;
    await frames(4);
  }

  /* ---------------- 4. 帧率实测 ---------------- */
  async function measureFps(seconds) {
    /* 用真实时间窗口统计 rAF 帧数 */
    let n = 0, t0 = 0, tLast = 0;
    return await new Promise(resolve => {
      function step(t) {
        if (!t0) { t0 = t; tLast = t; }
        n++;
        const el = (t - t0) / 1000;
        if (el >= seconds) { resolve({ fps: +(n / el).toFixed(1), frames: n, seconds: +el.toFixed(2) }); return; }
        requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  async function phasePerf() {
    const T = window.__NZ_TEST;
    /* 保证以默认情景、运行中、展厅光照下测 */
    T.applyScenario('park');
    document.querySelector('#segLight button[data-light="blue-hour"]').click();
    document.querySelector('#segMode button[data-mode="exhibit"]').click();
    /* 固定测点：默认总览视角。否则上一阶段（导览/设备聚焦）留下的相机会
     * 改变可见物体数量，绘制调用与帧率就不可比。 */
    document.getElementById('btnCamReset').click();
    T.controls.autoRotate = false;
    await frames(30);
    R.env.viewport = window.innerWidth + '×' + window.innerHeight + ' @dpr' + (window.devicePixelRatio || 1);
    R.env.cameraAtMeasure = {
      pos: T.camera.position.toArray().map(v => +v.toFixed(1)),
      target: T.controls.target.toArray().map(v => +v.toFixed(1)),
      autoRotate: T.controls.autoRotate
    };

    for (const q of ['standard', 'high', 'compat']) {
      document.querySelector('#segQuality button[data-q="' + q + '"]').click();
      await frames(20);                       /* 预热：编译器链接、阴影图重建 */
      const m = await measureFps(5);
      const p = T.perf();
      R.perf[q] = {
        fps: m.fps, frames: m.frames, seconds: m.seconds,
        renderMs: +p.renderMs.toFixed(2), draws: p.draws, triangles: p.triangles,
        /* 泛光最后一个 pass 是合成全屏四边形，info 只剩 1 次调用；
         * 记录场景本身的调用数以便比较（phaseBoot 里直出测得）。 */
        sceneDrawCalls: R.env.sceneDrawCalls, sceneTriangles: R.env.sceneTriangles,
        pixelRatio: p.pixelRatio, canvas: p.vw + '×' + p.vh, bloom: p.bloom,
        shadowMap: T.renderer.shadowMap.enabled
      };
      ck('画质档 ' + q + ' 帧率可测（>0）', m.fps > 0, m.fps + ' fps');
    }
    /* 提示：自动降级会改变档位，测完显式固定回标准档 */
    document.querySelector('#segQuality button[data-q="standard"]').click();
    await frames(5);
    R.perf.finalQuality = T.S.quality;
  }

  /* ---------------- 5. 收尾 ---------------- */
  async function finish() {
    const T = window.__NZ_TEST;
    R.env.bloomReason = T.post() ? T.post().reason : 'no-post-layer';
    R.perf.autoDegraded = R.checks.filter(c => /降级/.test(c.name)).length > 0;
    R.elapsedMs = Date.now() - R.t0;
    R.summary = {
      total: R.checks.length,
      pass: R.checks.filter(c => c.ok).length,
      fail: R.checks.filter(c => !c.ok).length,
      errors: R.errors.length,
      consoleErrors: R.consoleErrors.length
    };
    const json = JSON.stringify(R, null, 1);
    send(json);
    const url = window.__SOAK_REPORT_URL || (/(?:^|[?&])report=([^&]+)/.exec(location.search) || [])[1];
    if (url) {
      const u = decodeURIComponent(url);
      let done = false;
      try { done = navigator.sendBeacon(u, json); } catch (e) { done = false; }
      if (!done) { try { await fetch(u, { method: 'POST', mode: 'no-cors', body: json }); } catch (e) { } }
    }
  }

  (async function () {
    try {
      const booted = await phaseBoot();
      if (booted) { await phaseUI(); await phaseLayout(); await phaseScenarios(); await phasePerf(); }
    } catch (e) {
      R.errors.push('SOAK-ABORT: ' + (e && e.stack || e));
    }
    await finish();
    document.title = 'SOAK-DONE ' + R.summary.pass + '/' + R.summary.total + ' err=' + R.summary.errors;
  })();
})();
