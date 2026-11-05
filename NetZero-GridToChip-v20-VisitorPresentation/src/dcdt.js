/* =====================================================================
 * 戈壁之光 · 零碳能量中枢 —— 数据中心数字孪生宿主 dcdt.js
 * GobiLight-NetZero  v1.3.0
 *
 * 载入顺序：… → legacy-scene → post → 【dcdt-app（内置应用源码）→ dcdt】→ premium
 *
 * v1.3.0 起，小窗里的内容**不再是自己搭的白模场景**，而是把 Hu 提供的
 * 《Grid-to-Chip · AI Data Center Digital Twin》整块嵌进来：
 *   · 三件套（index.html / style.css / app.js）已由 build.cjs 内联成 `window.NZ_DCDT_APP`；
 *   · 这里用 `<iframe srcdoc>` 承载它 —— 它有自己的文档、自己的 UI、自己的 WebGL 上下文，
 *     与园区主场景彻底隔离，且仍然是单文件离线；
 *   · 宿主只负责三件事：**开关**、**位置**（水平居中 + 按导览字幕实测避让）、
 *     **生命周期**（关窗时卸载 iframe，连它那份 WebGL 上下文一起放掉）。
 *
 * 内置应用的口径（照它的说明如实转述）：几何、运行参数、电力流、温度场与气流都是
 * 教学演示值，未接 BMS/DCIM，不是 CFD；供电链路 220 kV → 主变 → 10.5 kV → HVDC
 * （含降压隔离与整流稳压）→ 240 V DC → 列头柜 → 机架配电 → PSU/DC-DC → 芯片。
 * 它自带「演示模拟」标识；**不与园区内核账本联动**（园区那套数字仍是本文件其余部分的）。
 * ===================================================================== */
'use strict';
(function () {
  const D = { open: false, mounted: false, uiBound: false, lastPlace: 0, beat: 0, lastPct: -1, generation:0, readyPromise:null, ready:false, phase:"idle" };

  function $id(id) { return document.getElementById(id); }

  /* Keep the complete building above the shared caption/metrics dock. */
  function place() {
    const root = $id('dcdt'); if (!root) return;
    const h = window.innerHeight || 900;
    let bottom = 132;
    const dock = $id('visitorDock');
    const reception = $id('receptionBar');
    const tb = reception && !reception.hidden ? reception : $id('tourBar');
    if (dock && !dock.hidden) {
      const r = dock.getBoundingClientRect();
      if (r.height > 0) bottom = Math.round(h - r.top) + (dock.classList.contains('visitor-guide') ? 10 : 14);
    } else if (tb && (tb.classList.contains('on') || tb === reception)) {
      const r = tb.getBoundingClientRect();
      if (r.height > 0) bottom = Math.max(bottom, Math.round(h - r.top) + 14);
    }
    const header = $id('topbar');
    root.style.top = Math.round((header?.getBoundingClientRect().bottom || 64) + 12) + 'px';
    root.style.bottom = bottom + 'px';
  }

  // Caption height changes with every full paragraph; coalesce layout reads per frame.
  let layoutObserver=null,layoutFrame=0;
  function requestPlace(){
    if(layoutFrame)return;
    layoutFrame=requestAnimationFrame(()=>{layoutFrame=0;place();});
  }
  function stopLayoutWatch(){
    if(layoutObserver)layoutObserver.disconnect();layoutObserver=null;
    if(layoutFrame)cancelAnimationFrame(layoutFrame);layoutFrame=0;
    window.removeEventListener('resize',requestPlace);
  }
  function watchLayout(){
    stopLayoutWatch();
    const tb=$id('tourBar'),reception=$id('receptionBar'),dock=$id('visitorDock');
    if(window.ResizeObserver){layoutObserver=new ResizeObserver(requestPlace);if(tb)layoutObserver.observe(tb);if(reception)layoutObserver.observe(reception);if(dock)layoutObserver.observe(dock);}
    window.addEventListener('resize',requestPlace);
    requestPlace();
  }

  /* ================= 园区账本 → 小窗（v1.3.4 · A + C） =================
   * C：窗口里那条「园区账本」细条的数值全部来自本工程内核（`NZ_ENGINE.S` / `NZ_CONFIG.PLANT`），
   *    与楼内应用自带的演示值分开标注 —— 仿真模拟里每个数都要能追到模型。
   * A：楼内应用自己的「运行负载」滑块由园区账本单向驱动。两边口径同为「负载 / 额定」，
   *    所以映射是 楼内% = itMW / itMaxMW，可解释、可复算（默认 150 / 300 = 50%）。
   *    **不改甲方应用内部**：只写它的 #load 值并派发 input 事件。                                  */
  function ledger() {
    const E = window.NZ_ENGINE, C = window.NZ_CONFIG;
    const S = E && E.S, P = C && C.PLANT;
    if (!S || !P || !(S.itMW > 0)) return null;
    const it = S.itMW;
    const hvdcIn = it / P.panamaEta;
    const dc = S.dcLoadMW || (hvdcIn + P.dcFixedMW + P.dcAuxRatio * it);
    const pct = Math.max(0, Math.min(100, Math.round(it / P.itMaxMW * 1000)/10));
    return {
      it: it, dc: dc, pue: S.pue || dc / it, loss: hvdcIn - it,
      cool: P.dcFixedMW + P.dcAuxRatio * it, pct: pct,
      itMax: P.itMaxMW, eta: P.panamaEta
    };
  }
  function paintLedger() {
    const box = $id('dcdtLedger');
    const l = ledger();
    if (!box || !l) return null;
    const r1 = v => (Math.round(v * 10) / 10).toFixed(1);
    const r2 = v => (Math.round(v * 100) / 100).toFixed(2);
    box.innerHTML = '<b>园区账本</b>'
      + '<span>园区 IT 负载 <i>' + r1(l.it) + ' MW</i></span>'
      + '<span>进线 <i>' + r1(l.dc) + ' MW</i></span>'
      + '<span>PUE <i>' + r2(l.pue) + '</i></span>'
      + '<span>链路变换损耗 <i>' + r2(l.loss) + ' MW</i></span>'
      + '<span>制冷与辅助 <i>' + r1(l.cool) + ' MW</i></span>'
      + '<span class="sync">代表机房样本 <i>' + (1440*l.pct/100).toFixed(1) + ' kW / 1.44 MW</i></span>'
      + '<span class="sync">同步比例 <i>' + l.pct + ' %</i></span>'
      + (function () {
        const el = q('#load');
        const cur = el ? Number(el.value) : null;
        return (cur != null && cur !== l.pct) ? '<em>（楼内当前 ' + cur + ' %·手动）</em>' : '';
      })();
    return l;
  }
  /* A：把园区负载占比写进甲方应用的滑块（它自己会重算功率 / 电流 / 气流 / 热区） */
  function syncLoad(force) {
    const l = ledger();
    if (!l) return false;
    if (!force && l.pct === D.lastPct) return false;
    const ok = setLoadValue(l.pct);
    if (ok) D.lastPct = l.pct;
    return ok;
  }
  function beat() {
    if (!D.open) return;
    paintLedger();
    /* iframe 还在初始化时 setLoadIn 会失败，下一拍再试（挂载后 1 秒一拍，直到成功） */
    syncLoad(false);
  }

  /* ---- iframe 生命周期：打开才挂载，关掉即卸载（放掉它那份 WebGL 上下文） ---- */
  function mount() {
    const f = $id('dcdtFrame'); if (!f) return false;
    if (f.dataset.mounted === '1') return true;
    const src = window.NZ_DCDT_APP || '';
    if (!src) {
      const ft = $id('dcdtFoot');
      if (ft) ft.textContent = '内置数字孪生应用资源缺失（园区不受影响）。';
      return false;
    }
    f.setAttribute('srcdoc', src);
    f.dataset.mounted = '1';
    D.mounted = true;
    D.lastPct = -1;                 /* 重新挂载后强制同步一次负载 */
    [600, 1500, 3000].forEach(ms => setTimeout(() => { if (D.open) { paintLedger(); syncLoad(true); } }, ms));
    return true;
  }
  function unmount() {
    stopLayoutWatch();
    const f = $id('dcdtFrame'); if (!f) return;
    if (f.dataset.mounted !== '1') return;
    /* 置成一张空白页：iframe 会重载，原来那份文档、定时器与 WebGL 上下文一起释放 */
    f.removeAttribute('srcdoc');
    try { f.srcdoc = '<!doctype html><meta charset="utf-8"><title>idle</title>'; } catch (e) { }
    f.dataset.mounted = '0';
    D.mounted = false;
  }
  function reload() {
    const f = $id('dcdtFrame'); if (!f) return false;
    unmount();
    const mounted=mount();if(mounted){watchLayout();requestPlace();}return mounted;
  }

  function bindUi() {
    if (D.uiBound) return;
    D.uiBound = true;
    const on = (id, fn) => { const b = $id(id); if (b) b.addEventListener('click', fn); };
    on('dcdtClose', close);
    on('dcdtReload', reload);
  }

  let closeTimer=0,closePromise=null;
  function frameTour(){try{return $id('dcdtFrame').contentWindow.NZ_BUILDING_TOUR||null;}catch(e){return null;}}
  function prepare(){
    if(closePromise)return closePromise.then(()=>prepare());
    if(D.ready)return Promise.resolve(true);
    if(D.readyPromise)return D.readyPromise;
    const root=$id('dcdt');watchLayout();place();clearTimeout(closeTimer);
    root.classList.remove('closing','on','revealing');root.classList.add('preparing');
    D.phase='preparing';const generation=D.generation;
    if(!mount())return Promise.resolve(false);
    D.readyPromise=new Promise(resolve=>{
      const started=performance.now();
      const poll=()=>{
        if(generation!==D.generation){resolve(false);return;}
        const app=frameTour();let frames=0;try{frames=$id('dcdtFrame').contentWindow.NZ_DCDT_RENDER_FRAMES||0;}catch(e){}
        if(app&&frames>=3){D.ready=true;D.phase='prepared';paintLedger();syncLoad(true);resolve(true);return;}
        if(performance.now()-started>15000){D.phase='failed';resolve(false);return;}
        setTimeout(poll,40);
      };poll();
    });return D.readyPromise;
  }
  async function reveal(from){
    if(D.open&&from==null&&D.phase==='visible')return true;
    const generation=D.generation,root=$id('dcdt');
    if(!await prepare()||generation!==D.generation)return false;
    if(from!=null){frameTour().prepare(from);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));}
    if(generation!==D.generation)return false;
    place();bindUi();root.classList.remove('preparing','closing');root.classList.add('revealing');
    root.setAttribute('aria-hidden','false');D.open=true;D.phase='revealing';
    // Establish the opacity-zero frame before switching to the visible class.
    root.getBoundingClientRect();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    if(generation!==D.generation)return false;
    root.classList.add('on');root.classList.remove('revealing');
    clearInterval(D.beat);D.beat=setInterval(beat,1000);paintLedger();syncLoad(true);
    requestPlace();
    await new Promise(r=>setTimeout(r,window.NZ_ENGINE.S.reduceMotion?0:680));
    if(generation!==D.generation)return false;D.phase='visible';return true;
  }
  function open(){if(window.NZ_CLOUD_VISIT&&window.NZ_CLOUD_VISIT.isOpen())window.NZ_CLOUD_VISIT.close();reveal();return true;}
  function close(){
    if(closePromise)return closePromise;
    const root=$id('dcdt');++D.generation;const generation=D.generation;
    const visible=D.open;D.open=false;D.ready=false;D.readyPromise=null;
    clearInterval(D.beat);clearTimeout(closeTimer);stopLayoutWatch();
    const app=frameTour();if(app)app.setPlaying(false);
    if(!root)return Promise.resolve();
    root.classList.remove('preparing','revealing');
    if(!visible){root.classList.remove('on','closing');root.setAttribute('aria-hidden','true');unmount();D.phase='idle';return Promise.resolve();}
    D.phase='closing';root.classList.add('closing');
    closePromise=new Promise(resolve=>{closeTimer=setTimeout(()=>{
      if(generation===D.generation){root.classList.remove('on','closing');root.setAttribute('aria-hidden','true');unmount();D.phase='idle';}
      closePromise=null;resolve();
    },window.NZ_ENGINE.S.reduceMotion?0:680);});
    return closePromise;
  }
  function toggle(){if(D.open){close();return false;}return open();}
  function openViaDevice(key){if(key!=='dc')return false;return open();}

  /* ---- 测试钩子：读内置应用的真实状态（srcdoc 同源，可直接查它的文档） ---- */
  function frameDoc() {
    const f = $id('dcdtFrame');
    try { return (f && f.contentDocument) || null; } catch (e) { return null; }
  }
  function q(sel) {
    const d = frameDoc();
    try { return (d && d.querySelector(sel)) || null; } catch (e) { return null; }
  }

  /* 把园区账本算出的负载占比写进甲方应用的滑块（它自己的换算式会接着算功率/电流/气流） */
  function setLoadValue(v) {
    const el = q('#load'); if (!el) return false;
    try {
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } catch (e) { return false; }
  }

  /* ---- v1.3.5：供园区导览的"进楼"环节驱动楼内应用自带的时间轴 ---- */
  let segFrom = 0, segTo = 0;
  function timelineValue() {
    const el = q('#timeline');
    return el ? Number(el.value) : NaN;
  }
  function setTimelineValue(v) {
    const el = q('#timeline'); if (!el) return false;
    try {
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } catch (e) { return false; }
  }
  function playSegment(from,to){
    segFrom=Number(from)||0;segTo=Number(to)||segFrom;
    const app=frameTour();if(!app||D.phase!=='visible')return false;
    app.play(segFrom,segTo);return true;
  }
  function segmentProgress() {
    const v = timelineValue();
    const span = segTo - segFrom;
    if (!isFinite(v) || !(span > 0)) return 0;
    return Math.max(0, Math.min(1, (v - segFrom) / span));
  }

  window.GOBI_DCDT = {
    open, close, toggle, openViaDevice, reload, prepare, reveal, setPlaying:value=>{const app=frameTour();if(app)app.setPlaying(value);}, transitionState:()=>({phase:D.phase,ready:D.ready,mounted:D.mounted,open:D.open,generation:D.generation}), isOpen: () => D.open,
    /* 在 iframe 里驱动它的界面（测试用；失败不影响园区） */
    clickIn(sel) {
      const el = q(sel); if (!el) return false;
      try { el.click(); return true; } catch (e) { return false; }
    },
    setLoadIn: setLoadValue,
    resyncLoad() { return syncLoad(true); },
    playSegment, segmentProgress, setTimelineIn: setTimelineValue,
    state: () => {
      const d = frameDoc();
      const f = $id('dcdtFrame');
      const cv = q('#canvas-wrap canvas') || q('canvas');
      const act = d ? d.querySelector('#levels button.active') : null;
      const sys = d ? d.querySelector('#systems button.active') : null;
      const kicker = q('#scene-kicker');
      const chap = q('#chapter');
      const time = q('#time');
      const pw = q('#power-value');
      const dev = q('#detail-tools');
      return {
        open: D.open, mounted: D.mounted,
        frame: f ? [f.clientWidth, f.clientHeight] : null,
        appReady: !!(d && d.querySelector('#levels button[data-level="4"]') && cv),
        title: d ? (d.title || '') : '',
        canvas: cv ? [cv.width, cv.height] : null,
        levels: d ? d.querySelectorAll('#levels button').length : 0,
        systems: d ? d.querySelectorAll('#systems button').length : 0,
        activeLevel: act ? act.textContent.trim().slice(0, 12) : null,
        activeSystem: sys ? sys.textContent.trim().slice(0, 14) : null,
        kicker: kicker ? kicker.textContent : null,
        chapter: chap ? chap.textContent : null,
        time: time ? time.textContent : null,
        power: pw ? pw.textContent : null,
        deviceTools: dev ? dev.hidden === false : null,
        timeline: !!q('#timeline'),
        flowToggles: d ? d.querySelectorAll('.flow-toggles input').length : 0,
        /* Read the authored UI visibility, including both inner sidebars. */
        trim: d ? {
          header: (function () { const e = d.querySelector('header'); return e ? getComputedStyle(e).display : 'none'; })(),
          right: (function () { const e = d.querySelector('aside.right'); return e ? getComputedStyle(e).display : 'none'; })(),
          footer: (function () { const e = d.querySelector('footer'); return e ? getComputedStyle(e).display : 'none'; })(),
          left: (function () { const e = d.querySelector('aside.left'); return e ? getComputedStyle(e).display : 'none'; })(),
          viewport: !!(d.querySelector('#viewport') && d.querySelector('#canvas-wrap canvas')),
          /* v1.3.3：底部动画控制（播放按钮 / 时间轴 / 章节与时间）保留情况 */
          anim: (function () {
            const t = d.getElementById('timeline');
            return {
              play: !!d.getElementById('play'),
              timeline: !!t,
              max: t ? +t.max : null,
              chapter: (q('#chapter') || {}).textContent || null,
              time: (q('#time') || {}).textContent || null,
              jumpPoints: d.querySelectorAll('.timeline-labels button').length,
              pos: t ? +t.value : null,       /* 时间轴当前位置（秒），楼内段判定用 */
              toggles: d.querySelectorAll('.flow-toggles input').length,
              togglesText: [].map.call(d.querySelectorAll('.flow-toggles label'), function (l) { return l.textContent.trim(); }).join('/')
            };
          })()
        } : null,
        /* 玻璃读数：我们这层浮层的毛玻璃 / 圆角 / 过渡 */
        glass: (function () {
          const r = $id('dcdt'); if (!r) return null;
          const cs = getComputedStyle(r);
          return {
            blur: (cs.backdropFilter || cs.webkitBackdropFilter || '').slice(0, 40),
            radius: cs.borderTopLeftRadius,
            transition: cs.transitionProperty,
            closing: r.classList.contains('closing')
          };
        })()
      };
    }
  };
})();
