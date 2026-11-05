/* =====================================================================
 * 戈壁之光 · 零碳能量中枢 —— 展厅交互层 premium.js
 * GobiLight-NetZero  v1.0.0
 *
 * 载入顺序：config → engine → compat → labels → legacy-pres → bridge
 *           → legacy-scene → 【premium】→ post → 启动
 *
 * 本层职责（不含任何物理核算，所有数值都来自 engine.js 的同一步状态）：
 *   1. 接管主渲染循环与 render()：展厅光照预设 / 跟随仿真 两条路径；
 *   2. 展厅界面：摘要、图例、底部时轴与平衡趋势、抽屉五页、设备树与信息卡；
 *   3. v14 八章导览（1 秒开场、固定方向机舱透视、9 秒枢纽缓移、连续进楼和返回）、画质档位、减少动态、截图、数据导出、快捷键；
 *   4. 帧率实测与显式降级（降级必须提示，不静默）。
 * ===================================================================== */
'use strict';
(function () {
  const CFG = window.NZ_CONFIG;
  const PAL = CFG.PALETTE;
  const QS = CFG.QUALITY;
  const E = window.NZ_ENGINE;
  const S = E.S, L = E.L, K = E.K, MK = E.MK;
  const $ = window.$;

  /* 原始 lightState 返回值没有展厅字段，此处统一补齐默认值 */
  function lightDefaults() {
    return {
      exhibitLighting: false, keyColor: null, fillColor: null, rimColor: null,
      keyInt: 1, fillInt: 0, rimInt: 0, ambient: 0.2, hemiInt: 0.3, exposure: 1
    };
  }

  /* ------------------------------------------------------------------ */
  /* 0. 小工具                                                          */
  /* ------------------------------------------------------------------ */
  const f1 = v => (Math.abs(v) < 0.05 ? '0.0' : v.toFixed(1));
  const f0 = v => Math.round(v).toString();
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hhmmss = t => {
    const x = ((t % 86400) + 86400) % 86400;
    return [Math.floor(x / 3600), Math.floor(x / 60) % 60, Math.floor(x) % 60]
      .map(v => String(v).padStart(2, '0')).join(':');
  };

  function toast(msg, level) {
    const box = $('toast'); if (!box) return;
    /* 同一条消息还在屏幕上就不再排一条：内核告警可能连续几步都发同一句，
     * 早先会在顶部堆成一摞（实测未收敛诊断一次弹三条）。 */
    const last = box.lastElementChild;
    if (last && last.textContent === msg) return;
    const el = document.createElement('div');
    el.className = 'tmsg' + (level ? ' ' + level : '');
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; }, 4200);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 5000);
    while (box.children.length > 3) box.removeChild(box.firstChild);
  }

  function download(name, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }

  /* ------------------------------------------------------------------ */
  /* 1. 事件（内核 → 界面）                                             */
  /* ------------------------------------------------------------------ */
  const events = [];
  function pushEvent(ev) {
    events.push(ev);
    if (events.length > 400) events.shift();
    if (ev.level === 'warn' || ev.level === 'bad') {
      /* 求解器诊断（「本步耦合求解未在 N 轮内收敛…已记录诊断」）是每步都可能
       * 重发的内部诊断，不像其它告警有 30 分钟仿真时间的节流，弹出来只会刷屏。
       * 它仍然进事件页与导出账本，只是不弹顶部提示。 */
      if (ev.msg.indexOf('已记录诊断') < 0) toast(ev.msg, ev.level);
    }
    eventsDirty = true;
  }
  let eventsDirty = false;
  /* 内核在 createEngine 时已经 push 过初始事件，这里补收 */
  for (const ev of L.events.slice(-60)) events.push(ev);
  E.onEvent(pushEvent);

  /* ------------------------------------------------------------------ */
  /* 2. 帧率计量与画质                                                   */
  /* ------------------------------------------------------------------ */
  const perf = {
    frames: 0, fps: 0, windowStart: 0, winFrames: 0,
    worstFps: Infinity, samples: [], renderMs: 0, stalled: false
  };
  let autoQuality = true;

  const rimL = new THREE.DirectionalLight(0x7FDCFF, 0);
  rimL.castShadow = false;
  scene.add(rimL, rimL.target);

  function applyAnisotropy(n) {
    const seen = new Set();
    scene.traverse(o => {
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of mats) {
        for (const k of ['map', 'normalMap', 'emissiveMap', 'roughnessMap', 'alphaMap']) {
          const t = m && m[k];
          if (t && t.isTexture && !seen.has(t)) { seen.add(t); t.anisotropy = n; t.needsUpdate = true; }
        }
      }
    });
  }

  function applyQuality(reason) {
    const q = QS[S.quality] || QS.standard;
    renderer.shadowMap.enabled = !!q.shadows;
    if (q.shadows) {
      const size = q.shadowMapSize;
      if (sunL.shadow.mapSize.x !== size) {
        sunL.shadow.mapSize.set(size, size);
        if (sunL.shadow.map) { sunL.shadow.map.dispose(); sunL.shadow.map = null; }
      }
    }
    starGeo.setDrawRange(0, Math.max(1, Math.min(starGeo.attributes.position.count, q.stars)));
    applyAnisotropy(q.anisotropy);
    resizeAll();
    if (window.NZ_ENVIRONMENT) window.NZ_ENVIRONMENT.setQuality(S.quality);
    if (window.NZ_RENEWABLES) window.NZ_RENEWABLES.setQuality(S.quality);
    if (window.NZ_PARK) window.NZ_PARK.setQuality(S.quality);
    if (window.NZ_SOLAR) window.NZ_SOLAR.setQuality(S.quality);
    if (window.NZ_MULTI) window.NZ_MULTI.setQuality(S.quality);
    if(window.NZ_WIND_PRODUCT)window.NZ_WIND_PRODUCT.setQuality(S.quality);
    if(window.NZ_FLOWS)window.NZ_FLOWS.setQuality(S.quality);
    if(window.NZ_TOWERS)window.NZ_TOWERS.setQuality(S.quality);
    if (postObj) {
      postObj.setEnabled(S.quality === 'high' && (q.bloom || q.ao));
      postObj.setParams({ ao: !!q.ao });
    }
    if (reason) pushEvent({ level: 'info', t: 'D' + S.day + ' ' + hhmmss(S.simTime).slice(0, 5), simTime: S.simTime, msg: reason });
  }

  /* ------------------------------------------------------------------ */
  /* 3. 渲染：展厅光照 / 跟随仿真                                        */
  /* ------------------------------------------------------------------ */
  const skyNight = [220,229,231], fogNight = [220,229,231];

  function fogOf(light) {
    const P = CFG.LIGHT_PRESETS[light.preset] || CFG.LIGHT_PRESETS['blue-hour'];
    return P;
  }

  /* 展厅预设：三点布光 + 预设雾色，与仿真时钟解耦 */
  function renderExhibit(light, tNow, dtR) {
    const P = fogOf(light);
    const expo = P.exposure || 1;
    const ctr = { x: 50, y: 0, z: 50 };

    sunL.position.set(ctr.x + light.v[0] * 260, Math.max(16, light.v[1] * 260), ctr.z + light.v[2] * 260);
    sunL.target.position.set(ctr.x, 0, ctr.z);
    sunL.intensity = (P.keyInt || 1) * expo;
    sunL.color.set(light.keyColor || '#FFD9A8');

    /* 侧后补光：用预设的方向取反一半，制造轮廓 */
    const fv = light.mv || [0.6, 0.5, -0.5];
    rimL.position.set(ctr.x + fv[0] * 240, Math.max(10, fv[1] * 200), ctr.z + fv[2] * 240);
    rimL.target.position.set(ctr.x, 0, ctr.z);
    rimL.intensity = (P.rimInt || 0) * expo;
    rimL.color.set(light.rimColor || '#7FDCFF');

    ambL.intensity = (P.ambient != null ? P.ambient : 0.16) * expo;
    ambL.color.set(light.fillColor || '#4E7FB8');
    hemiL.intensity = (P.hemiInt != null ? P.hemiInt : 0.4) * expo;
    hemiL.color.set(P.hemiSky || '#2C4C74');
    hemiL.groundColor.set(P.hemiGround || '#4A3A28');

    /* 天空 / 雾 / 地面：地面保留地区色相，向展厅底色靠拢 */
    const [bgR, bgG, bgB] = hexRGB(P.fog || '#0B1B2B');
    const sky = lerpC(hexRGB(light.preset === 'day-lab' ? '#7FA6C8' : '#0A1626'), [bgR, bgG, bgB], 0.35);
    scene.background.setRGB(sky[0] / 255, sky[1] / 255, sky[2] / 255);
    scene.fog.color.setRGB(bgR / 255, bgG / 255, bgB / 255);
    scene.fog.near = P.fogNear || 240;
    scene.fog.far = P.fogFar || 900;
    const skin = skinOf();
    const g = lerpC(skin.ground, light.preset === 'day-lab' ? [128, 122, 104] : [52, 60, 70],
      light.preset === 'day-lab' ? 0.25 : 0.45);
    groundMat.color.setRGB(g[0] / 255, g[1] / 255, g[2] / 255);

    /* 日月 sprite：沿预设方向摆位，夜档只留月 */
    sunSp.position.set(ctr.x + light.sv[0] * 380, light.sv[1] * 300 + 6, ctr.z + light.sv[2] * 380);
    sunSp.material.opacity = light.preset === 'night' ? 0 : clamp(light.wS == null ? 1 : light.wS, 0, 1);
    moonSp.position.set(ctr.x + light.mv[0] * 380, light.mv[1] * 290 + 6, ctr.z + light.mv[2] * 380);
    moonSp.material.opacity = light.preset === 'night' ? 0.85 : 0;

    const lamps = P.lamps == null ? 0 : P.lamps;
    starMat.opacity = (P.stars == null ? 0 : P.stars) * 0.85;
    lampHeadMat.emissiveIntensity = lamps * 1.7;
    lampPoolMat.opacity = lamps * 0.30;
    for (const m of WINMATS) m.emissiveIntensity = (light.preset === 'night' ? 0.85 : lamps * 0.5);

    finishFrame(light, tNow, dtR);
  }

  /* 跟随仿真：与原表现层同一套日月几何，仅把曝光接到预设值 */
  function renderFollow(light, tNow, dtR) {
    const P = CFG.LIGHT_PRESETS.follow || {};
    const expo = P.exposure || 1;
    const skin = skinOf();
    const dl = light.dl, dusk = light.dusk, night = light.night;
    const ctr = { x: 50, y: 0, z: 50 };

    sunL.position.set(ctr.x + light.v[0] * 260, Math.max(16, light.v[1] * 260), ctr.z + light.v[2] * 260);
    sunL.target.position.set(ctr.x, 0, ctr.z);
    if (night) { sunL.intensity = 0.28 * clamp(light.wM, 0, 1) * expo; sunL.color.setHex(0xb9c6dd); }
    /* v1.0.7：日间光色由暖白 0xfff2dd 改为冷白 0xf2f7ff（原色把冷灰地面又染黄了）；黄昏仍走暖色 */
    else { sunL.intensity = (0.25 + dl * 1.05) * expo; sunL.color.setHex(dusk > 0.3 ? 0xffd9ae : 0xf2f7ff); }
    rimL.intensity = 0;
    ambL.intensity = 0.14 + dl * 0.16 + (night ? 0.05 : 0);
    hemiL.intensity = 0.16 + dl * 0.28;

    const top = lerpC(skyNight, skin.skyTop, dl), bot = lerpC(fogNight, skin.skyBot, dl);
    const duskF = dusk * 0.4;
    scene.background.setRGB(...lerpC(top, [196, 132, 84], duskF).map(v => v / 255));
    scene.fog.color.setRGB(...lerpC(bot, [120, 84, 70], dusk * 0.2).map(v => v / 255));
    scene.fog.near = 260; scene.fog.far = 900;
    /* 夜间目标由 [30,34,40] 提到 [34,40,48]：v1.0.7 换了更深的冷底色，
     * 不稍微提一点夜里会糊成一片黑。黄昏仍叠暖色。 */
    groundMat.color.setRGB(...lerpC(lerpC(skin.ground, [34, 40, 48], night ? 0.72 : 0), [150, 110, 70], dusk * 0.25).map(v => v / 255));

    sunSp.position.set(ctr.x + light.sv[0] * 380, light.sv[1] * 300 + 6, ctr.z + light.sv[2] * 380);
    sunSp.material.opacity = S.dayNight ? clamp(light.wS, 0, 1) : 1;
    moonSp.position.set(ctr.x + light.mv[0] * 380, light.mv[1] * 290 + 6, ctr.z + light.mv[2] * 380);
    moonSp.material.opacity = S.dayNight ? clamp(light.wM, 0, 1) : 0;
    starMat.opacity = (night ? 0.85 : clamp((0.12 - dl) / 0.12, 0, 1) * 0.85) * (S.dayNight ? 1 : 0);
    lampHeadMat.emissiveIntensity = lampLevel() * 1.7;
    lampPoolMat.opacity = lampLevel() * 0.30;
    for (const m of WINMATS) m.emissiveIntensity = night ? 0.85 : lampLevel() * 0.5;

    finishFrame(light, tNow, dtR);
  }

  /* 每帧公共收尾：动画钩子 → 粒子 → 相机 → 出图 → 标签 → 日月弧 */
  const qForParticles = () => (QS[S.quality] || QS.standard).particles;
  let visualClock = 0;

  function finishFrame(light, tNow, dtR) {
    const sceneDt = S.reduceMotion || window.NZ_CLOUD_VISIT.isPaused() ? 0 : dtR;
    visualClock += sceneDt;
    for (const fn of TICKERS) fn(visualClock, sceneDt);
    if(window.NZ_FACTORY)window.NZ_FACTORY.tick(S.reduceMotion||window.NZ_CLOUD_VISIT.isPaused()||window.NZ_RECEPTION?.isPaused()||tour.active&&tour.paused?0:dtR);

    window.NZ_VEHICLES?.tick(sceneDt);
    const cap = qForParticles();
    for (const e of EDGES) {
      const capacity=e.points.geometry.attributes.position.count;
      if (e.parts.length > Math.min(cap,capacity)) e.parts.length = Math.min(cap,capacity);
    }
    drawParticles();
    window.NZ_VISUAL.beforeRender(light, rimL);
    if(window.NZ_SST_VISIT)window.NZ_SST_VISIT.beforeRender();
    if(window.NZ_VISITOR_VIEW)window.NZ_VISITOR_VIEW.beforeRender();
    const night = light.preset === 'night' || (light.preset === 'follow' && light.night);
    if (window.NZ_ENVIRONMENT) window.NZ_ENVIRONMENT.update(night);
    if (window.NZ_PARK) window.NZ_PARK.update(night);
    if (window.NZ_RENEWABLES) window.NZ_RENEWABLES.update(night);
    if (postObj && postObj.enabled) postObj.setParams({ strength: night ? .16 : 0, threshold: 1.1, knee: .4, vignette: .025 });

    if (camTween) applyCamTween(dtR);
    controls.update();

    if (window.NZ_SOLAR) window.NZ_SOLAR.update();

    const t0 = (window.performance && performance.now) ? performance.now() : 0;
    /* 泛光启用时渲染由后处理层接管；上下文丢失时改回直出 ——
     * three.js 的 render() 自己会在 _isContextLost 时短路返回（r147 源码可见），
     * 所以这里每帧仍然调用它是安全的，而且必须继续调用：早先的写法是在丢帧时
     * 整段跳过渲染，实测会让 WEBGL_lose_context.restoreContext() 迟迟不触发
     * webglcontextrestored —— 画布不再被绘制，恢复流程没有推进的机会。
     * 反过来说，post.js 那条自建通道用的是自己的 RenderTarget，必须跳过。 */
    // The GL loss flag can precede the DOM event by a frame. Keep RAF running,
    // but avoid compiling shaders against a context that is already unavailable.
    if (!renderer.getContext().isContextLost()) {
      if (postObj && postObj.enabled && !contextLost) postObj.renderWithBloom(); else renderer.render(scene, camera);
    }
    if (t0) perf.renderMs = perf.renderMs * 0.9 + (performance.now() - t0) * 0.1;

    updateLabelPositions();
    /* v1.0.2：原先这里每帧 drawArcInd(light) 重绘左上角的日月弧；
     * 那块已随"会闪的顶部信息条"一起移除，信息改由底部信息流播报。 */
    maybeCaptureShot();
  }

  function render(tNow, dtR) {
    const light = Object.assign(lightDefaults(), lightState());
    if (light.exhibitLighting && light.keyColor) renderExhibit(light, tNow, dtR);
    else renderFollow(light, tNow, dtR);
  }

  /* ------------------------------------------------------------------ */
  /* 4. 相机补间（导览 / 设备聚焦共用）                                  */
  /* ------------------------------------------------------------------ */
  let camTween = null;
  const smooth = t => t * t * (3 - 2 * t);

  function tweenCamera(pos, tgt, dur, onDone) {
    camTween = {
      t: 0, dur: S.reduceMotion ? 0.001 : Math.max(0.001, dur || 1.0),
      p0: camera.position.clone(), p1: new THREE.Vector3(...pos),
      t0: controls.target.clone(), t1: new THREE.Vector3(...tgt),
      onDone: onDone || null
    };
    controls.enabled = false;
  }
  function applyCamTween(dtR) {
    const tw = camTween;
    tw.t += dtR;
    const k = smooth(clamp(tw.t / tw.dur, 0, 1));
    camera.position.lerpVectors(tw.p0, tw.p1, k);
    controls.target.lerpVectors(tw.t0, tw.t1, k);
    if (tw.t >= tw.dur) {
      camTween = null;
      if (!tour.active) controls.enabled = true;
      if (tw.onDone) tw.onDone();
    }
  }
  function cancelTween() { camTween = null; controls.enabled = !tour.active; }

  /* ------------------------------------------------------------------ */
  /* 5. 主循环                                                          */
  /* ------------------------------------------------------------------ */
  let lastT = 0, uiAcc = 0;
  /* WebGL 上下文是否处于丢失状态。驱动重置、显存不足、系统回收后台标签页
   * 的 GPU 资源时都会触发；不处理的话表现是"画面突然全黑且毫无提示"。 */
  let contextLost = false;

  function loop(t) {
    requestAnimationFrame(loop);
    if (!lastT) lastT = t;
    let dtR = (t - lastT) / 1000;
    lastT = t;
    if (!(dtR > 0)) dtR = 1 / 60;
    dtR = Math.min(0.25, dtR);

    /* 物理：倍速只改变仿真秒数，物理步长恒为 TIME.stepSeconds */
    if (!window.NZ_CLOUD_VISIT.isActive()) E.tick(dtR);
    window.NZ_CLOUD_VISIT.tick(dtR);
    if(window.NZ_RECEPTION)window.NZ_RECEPTION.tick(dtR);

    if (!S.reduceMotion && !window.NZ_CLOUD_VISIT.isPaused()) updateParticles(dtR);

    if (tour.active) tourTick(dtR);

    scrollTicker(dtR);            /* 信息流是"播报"，不随物理暂停停下 */

    render(t / 1000, dtR);

    /* 帧率计量（2 秒窗口） */
    perf.winFrames++; perf.frames++;
    if (!perf.windowStart) perf.windowStart = t;
    if (t - perf.windowStart >= 2000) {
      const fps = perf.winFrames * 1000 / (t - perf.windowStart);
      perf.fps = fps; perf.samples.push(Math.round(fps));
      if (perf.samples.length > 30) perf.samples.shift();
      if (perf.winFrames > 4) perf.worstFps = Math.min(perf.worstFps, fps);
      perf.winFrames = 0; perf.windowStart = t;
      guardQuality(fps);
    }

    /* 界面节拍：0.25 s 一次；标签节拍更慢，减少重排 */
    uiAcc += dtR;
    if (uiAcc >= 0.25) {
      uiAcc = 0;
      if (!window.NZ_CLOUD_VISIT.isActive()) sampleTrend();
      updateDash();
      if (typeof updateLabels3D === 'function') updateLabels3D();
    }
  }

  /* 显式降级：只在用户未手动指定画质时生效，且必须提示 */
  function guardQuality(fps) {
    if (!autoQuality || S.quality === 'compat') return;
    if (fps >= 30) return;
    if (S.quality === 'high') {
      S.quality = 'standard';
      applyQuality(null);
      toast('画质已自动降级为「标准」：近 2 秒实测 ' + fps.toFixed(0) + ' fps 低于 30（可在右上角改回）', 'warn');
      pushEvent({ level: 'warn', t: 'D' + S.day + ' ' + hhmmss(S.simTime).slice(0, 5), simTime: S.simTime, msg: '画质自动降级 精致→标准（实测 ' + fps.toFixed(1) + ' fps）' });
      refreshQualitySeg();
    } else if (fps < 30 && perf.samples.length >= 6 &&
      perf.samples.slice(-6).every(v => v < 30)) {
      S.quality = 'compat';
      applyQuality(null);
      toast('画质已自动降级为「兼容」：持续低于 30 fps，已关闭阴影（可在右上角改回）', 'warn');
      pushEvent({ level: 'warn', t: 'D' + S.day + ' ' + hhmmss(S.simTime).slice(0, 5), simTime: S.simTime, msg: '画质自动降级 标准→兼容（持续低于 30 fps）' });
      refreshQualitySeg();
    }
  }

  /* ------------------------------------------------------------------ */
  /* 6. 尺寸                                                            */
  /* ------------------------------------------------------------------ */
  function resizeAll() {
    const r = cv.parentElement.getBoundingClientRect();
    const q = QS[S.quality] || QS.standard;
    VW = Math.max(2, Math.round(r.width));
    VH = Math.max(2, Math.round(r.height));
    DPR = Math.min(window.devicePixelRatio || 1, q.pixelRatioMax);
    renderer.setPixelRatio(DPR);
    renderer.setSize(VW, VH, false);
    camera.aspect = VW / Math.max(1, VH);
    camera.updateProjectionMatrix();
    if (postObj) postObj.size(Math.round(VW * DPR), Math.round(VH * DPR));
    sizeCanvas($('timeline'), 56);
    sizeCanvas($('trendCanvas'), 150);
  }

  function sizeCanvas(c, cssH) {
    if (!c) return;
    const w = Math.max(60, Math.round(c.clientWidth || c.parentElement.clientWidth || 300));
    const h = Math.max(30, Math.round(c.clientHeight || cssH * (window.devicePixelRatio > 1 ? window.devicePixelRatio : 1)));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  }
  window.addEventListener('resize', () => { resizeAll(); drawTimeline(); drawTrend(); });

  /* ------------------------------------------------------------------ */
  /* 7. 摘要 / 图例 / 时钟                                              */
  /* ------------------------------------------------------------------ */
  const SCEN_LABEL = {};
  for (const k in CFG.SCENARIOS) SCEN_LABEL[k] = CFG.SCENARIOS[k].label;

  function updateSummary() {
    /* KPI 1：园区实际总负荷（已供需求） */
    $('mServed').textContent = f1(S.demandServedMW);
    $('mServedSub').textContent =
      '数据中心 ' + f1(S.dcLoadMW) + ' · 化工/共享辅助 ' + f1(S.airLoadMW) +
      ' · 柔性 ' + f1(S.sc + S.metal + S.factory + S.h2P) + ' MW（未供 ' + f1(S.unservedMW) + '）';

    /* KPI 2：可再生电力消费占比（端用电成分口径） */
    const consTot = sumMix(L.consumption);
    const renewShare = consTot > 1e-9 ? L.consumption.renew / consTot : 0;
    const cleanShare = consTot > 1e-9 ? (L.consumption.renew + L.consumption.nuclear) / consTot : 0;
    $('mRenew').textContent = (renewShare * 100).toFixed(1);
    $('barRenew').style.width = clamp(renewShare * 100, 0, 100) + '%';
    $('mRenewSub').textContent =
      '累计口径 · 清洁（含核）' + (cleanShare * 100).toFixed(1) + '% · 样本 ' + L.genMWh.toFixed(0) + ' MWh';
    $('kpiRenew').className = 'kpi' + (renewShare < 0.6 ? ' warn' : '');

    /* KPI 3：储能 SOC */
    $('mSoc').textContent = f1(S.soc);
    $('barSoc').style.width = clamp(S.soc, 0, 100) + '%';
    const usable = Math.max(0, L.battMWh.total - K.ST_CAP * K.SOC_LO / 100);
    $('mSocSub').textContent = '可用电量 ' + usable.toFixed(0) + ' MWh · ' +
      (S.stP > 0.05 ? '放电 ' + f1(S.stP) : (S.stP < -0.05 ? '充电 ' + f1(-S.stP) : '待机')) + ' MW';
    $('kpiSoc').className = 'kpi' + (S.soc <= 12 ? ' bad' : (S.soc >= 95 ? ' warn' : ''));

    /* KPI 4：当日氨产量 */
    $('mNh3').textContent = S.dNh3t.toFixed(2);
    $('mNh3Sub').textContent = '速率 ' + f0(S.nh3KgH) + ' kg/h · 储氢 ' + f0(S.h2Kg) + ' kg';
    $('kpiNh3').className = 'kpi' + (S.h2Kg <= 50 ? ' warn' : '');

    /* 摘要脚注 */
    let state = '源网荷储自平衡';
    if (S.unservedMW > 0.5) state = '未供电 ' + f1(S.unservedMW) + ' MW（事故口径）';
    else if (S.gridBuy > 5) state = '购电补缺 ' + f1(S.gridBuy) + ' MW';
    else if (S.curtail > 5) state = '弃电 ' + f1(S.curtail) + ' MW（消纳已满）';
    else if (S.soc <= 12) state = '储能偏低';
    $('mState').textContent = state;
    $('mGridCur').textContent = f1(S.gridBuy) + ' / ' + f1(S.curtail) + ' MW';
    $('mUnserved').textContent = f1(S.unservedMW) + ' MW';

    const pol = CFG.POLICY;
    $('mPolicy').textContent = pol.status === 'pending' ? '待核算' : pol.status;
    $('mPolicy').className = pol.status === 'pending' ? 'pending' : '';

    $('sumScenario').textContent = SCEN_LABEL[S.scenario] || S.scenario;
  }

  function updateClock() {
    $('clockDay').textContent = '第 ' + S.day + ' 天';
    $('clockTime').textContent = hhmmss(S.simTime);
    const g = sunGeometry(S.simTime, REGIONS[S.region]);
    /* 昼夜一律按**仿真时钟**判定：这是仿真时钟旁边的相位。展示光照只是"怎么打光"，
     * 由右上角的「展示光照」按钮单独说明 —— 早先这里按光照预设显示「展厅亮档」，
     * 预设与仿真解耦时就永远看不到昼夜更替了。 */
    const phase = $('clockPhase');
    phase.textContent = (S.dayNight ? (g.elev > 0 ? '☀ 白天' : '☾ 夜间') : '☀ 固定正午');
    phase.className = 'phase';
    $('chipLight').textContent = '展示光照 · ' +
      ((CFG.LIGHT_PRESETS[S.lightPreset] || {}).label || S.lightPreset) +
      (S.lightPreset === 'follow' ? '' : '（与仿真解耦）');
    drawSunArc();
  }

  /* 顶栏时钟旁的日月弧（v1.0.7 补回）。
   * 与 v1.0.2 删掉的那版不同：那时它是绝对定位在画面左上、又每帧重绘，会闪；
   * 这一版挂在顶栏里、跟 0.25 s 的界面节拍走，而且**只按仿真时钟**取日月位置
   * （与展示光照预设无关）—— 白天画太阳、落到地平线以下就淡出，夜里画月亮。 */
  function drawSunArc() {
    const cv = $('sunArc'); if (!cv) return;
    const g = cv.getContext('2d'); if (!g) return;
    const W = cv.width, H = cv.height;
    const cx = W * 0.5, cy = H - 5, R = Math.min(cx - 7, cy - 5);
    g.clearRect(0, 0, W, H);
    g.lineWidth = 1;
    g.strokeStyle = 'rgba(156,179,197,.32)';
    g.beginPath(); g.moveTo(cx - R - 7, cy); g.lineTo(cx + R + 7, cy); g.stroke();
    g.strokeStyle = 'rgba(156,179,197,.26)';
    g.beginPath(); g.arc(cx, cy, R, Math.PI, 2 * Math.PI); g.stroke();
    if (!S.dayNight) {
      g.fillStyle = 'rgba(232,184,115,.95)';
      g.beginPath(); g.arc(cx, cy - R, 3.2, 0, 7); g.fill();
      return;
    }
    const gs = sunGeometry(S.simTime, REGIONS[S.region]);
    const m = moonGeometry(S.simTime, REGIONS[S.region]);
    if (gs.elev > -0.04) {
      const a = clamp((gs.elev + 0.04) / 0.22, 0.15, 1);
      const sx = cx - Math.cos(Math.PI * gs.frac) * R;
      const sy = cy - Math.sin(Math.PI * gs.frac) * R;
      g.globalAlpha = a * 0.26; g.fillStyle = '#e8b873';
      g.beginPath(); g.arc(sx, sy, 6.5, 0, 7); g.fill();
      g.globalAlpha = a;
      g.beginPath(); g.arc(sx, sy, 3.2, 0, 7); g.fill();
      g.globalAlpha = 1;
    }
    if (m.elev > 0.01) {
      const a = clamp(m.elev / 0.2, 0.15, 1) * 0.9;
      const mx = cx - Math.cos(Math.PI * m.frac) * R;
      const my = cy - Math.sin(Math.PI * m.frac) * R;
      g.globalAlpha = a; g.fillStyle = '#cfd4dc';
      g.beginPath(); g.arc(mx, my, 2.7, 0, 7); g.fill();
      g.globalAlpha = 1;
    }
  }

  /* ---------------- 底部信息流（滚动播报） ----------------
   * 原本"地区 · 昼夜"写在左上角、每 0.25 秒被重写一次，看起来一直在闪；
   * 这里把它连同运行摘要一起搬到屏幕最下方，做成横向滚动播报。
   * 同一个 .tk-set 复制一份接在后面 → 位移到一个"组宽"时归零即无缝循环。 */
  function buildTicker() {
    const track = $('tkTrack'), set = $('tkSet');
    if (!track || !set) return;
    const echo = set.cloneNode(true);
    echo.removeAttribute('id');
    echo.setAttribute('aria-hidden', 'true');
    track.appendChild(echo);
  }

  let tkSetW = 0, tkOffset = 0;
  const TK_SPEED = 46;                    /* px/s 的横向播报速度 */

  function updateTicker() {
    const set = $('tkSet'); if (!set) return;
    const put = (k, v) => {
      /* 两份副本都要写同样的文案；内容没变就不动 DOM，避免无谓的重排 */
      const nodes = set.parentElement.querySelectorAll('[data-tk="' + k + '"]');
      for (const n of nodes) if (n.textContent !== v) n.textContent = v;
    };
    /* 昼夜按仿真时钟判定（太阳高度角），不按展示光照预设 ——
     * 信息流播的是"园区此刻是什么状态"，必须跟着仿真走。 */
    const g = sunGeometry(S.simTime, REGIONS[S.region]);
    const simPhase = S.dayNight ? (g.elev > 0 ? '☀ 白天' : '☾ 夜间') : '☀ 固定正午';
    const consTot = sumMix(L.consumption);
    const renewShare = consTot > 1e-9 ? L.consumption.renew / consTot : 0;
    put('site', REGIONS[S.region].name + ' · ' + simPhase);
    put('clock', '第 ' + S.day + ' 天 ' + hhmmss(S.simTime));
    put('scenario', SCEN_LABEL[S.scenario] || S.scenario);
    put('load', f1(S.demandServedMW) + ' MW');
    put('renew', (renewShare * 100).toFixed(1) + ' %');
    put('soc', f1(S.soc) + ' %');
    put('nh3', S.dNh3t.toFixed(2) + ' t');
    put('grid', f1(S.gridBuy) + ' / ' + f1(S.curtail) + ' MW');
    put('unserved', f1(S.unservedMW) + ' MW');
    put('light', (CFG.LIGHT_PRESETS[S.lightPreset] || {}).label || S.lightPreset);
    const ev = events[events.length - 1];
    put('event', ev ? (ev.t + ' ' + ev.msg) : '暂无告警');
    tkSetW = set.offsetWidth;             /* 文案变了宽度也会变，逐拍重测 */
  }

  function scrollTicker(dtR) {
    const track = $('tkTrack');
    if (!track || !(tkSetW > 0)) return;
    if (document.body.classList.contains('reduce-motion')) {
      if (tkOffset) { tkOffset = 0; track.style.transform = ''; }
      return;
    }
    tkOffset += dtR * TK_SPEED;
    if (tkOffset >= tkSetW) tkOffset -= tkSetW;
    track.style.transform = 'translateX(' + (-tkOffset).toFixed(1) + 'px)';
  }

  /* 图例：介质 → 当前功率；无流路径用暗色提示 */
  const LEGEND = [
    { m: 'power', name: '电力流', v: () => S.genActualMW, unit: 'MW' },
    { m: 'power', name: '柔性馈电', v: () => S.sc + S.metal + S.factory + S.h2P, unit: 'MW' },
    { m: 'hydrogen', name: '氢', v: () => S.h2P, unit: 'MW' },
    { m: 'ammonia', name: '氨', v: () => S.nh3Load * 100, unit: '%', p: 1 },
    { m: 'grid', name: '外购电', v: () => S.gridBuy, unit: 'MW' },
    { m: 'nuclear', name: '核电（研究）', v: () => S.smr, unit: 'MW' }
  ];
  const MEDIA_CSS = { power: PAL.power, hydrogen: PAL.hydrogen, ammonia: PAL.ammonia, data: PAL.data, grid: PAL.grid, nuclear: '#B9C9E8' };

  function buildLegend() {
    const box = $('lgItems'); if (!box) return;
    box.innerHTML = LEGEND.map((it, i) =>
      '<div class="it"><i class="' + (it.dash ? 'dash' : '') + '" style="background:' + MEDIA_CSS[it.m] +
      ';color:' + MEDIA_CSS[it.m] + '"></i><span class="lg-n">' + esc(it.name) +
      '</span><b id="lgv' + i + '">–</b></div>').join('');
  }
  function updateLegend() {
    for (let i = 0; i < LEGEND.length; i++) {
      const el = $('lgv' + i); if (!el) continue;
      const it = LEGEND[i];
      const v = it.v();
      el.textContent = (it.p ? v.toFixed(0) : f1(v)) + ' ' + it.unit;
      el.style.color = v > 0.05 ? '' : '#5C7080';
    }
  }

  /* ------------------------------------------------------------------ */
  /* 8. 底部：24 小时时轴 + 平衡趋势                                    */
  /* ------------------------------------------------------------------ */
  const trend = { buf: [], lastSim: -1, INTERVAL: 60, N: 24 };
  function sampleTrend() {
    if (trend.lastSim < 0) trend.lastSim = Math.floor(S.simTime / trend.INTERVAL) * trend.INTERVAL;
    let guard = 0;
    while (S.simTime - trend.lastSim >= trend.INTERVAL && guard++ < 256) {
      trend.lastSim += trend.INTERVAL;
      trend.buf.push({ gen: S.genActualMW, served: S.demandServedMW, buy: S.gridBuy, cur: S.curtail, st: S.stP });
      if (trend.buf.length > trend.N) trend.buf.shift();
    }
    if (S.simTime - trend.lastSim >= trend.INTERVAL * 256) trend.lastSim = S.simTime;
  }

  function drawTrend() {
    const c = $('trendCanvas'); if (!c) return;
    sizeCanvas(c, 150);
    const g = c.getContext('2d'); const W = c.width, H = c.height;
    g.clearRect(0, 0, W, H);
    const d = trend.buf;
    if (d.length < 2) {
      g.fillStyle = '#74898e'; g.font = '12px "Microsoft YaHei",sans-serif';
      g.textAlign = 'center'; g.fillText('采集中…（每点 1 分钟仿真时间）', W / 2, H / 2);
      return;
    }
    let mx = 10;
    for (const p of d) mx = Math.max(mx, p.gen, p.served, p.buy, p.cur, Math.abs(p.st));
    mx *= 1.15;
    g.strokeStyle = 'rgba(110,150,185,.18)'; g.lineWidth = 1;
    for (const fr of [0.25, 0.5, 0.75]) { g.beginPath(); g.moveTo(0, H * fr); g.lineTo(W, H * fr); g.stroke(); }
    g.fillStyle = 'rgba(156,179,197,.75)'; g.font = '10px "Microsoft YaHei",sans-serif';
    g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText(mx.toFixed(0) + ' MW', 4, 3);

    const X = i => 4 + i / (trend.N - 1) * (W - 8);
    const Y = v => H - 6 - (v / mx) * (H - 18);
    const line = (key, color, width, abs) => {
      g.beginPath(); let started = false;
      for (let i = 0; i < d.length; i++) {
        const v = abs ? Math.abs(d[i][key]) : d[i][key];
        const x = X(i), y = Y(v);
        if (!started) { g.moveTo(x, y); started = true; } else g.lineTo(x, y);
      }
      g.strokeStyle = color; g.lineWidth = width; g.stroke();
    };
    /* 零线（储能充放基线） */
    g.strokeStyle = 'rgba(110,150,185,.3)'; g.beginPath(); g.moveTo(0, Y(0)); g.lineTo(W, Y(0)); g.stroke();
    line('gen', PAL.power, 1.6);
    line('served', PAL.gold, 1.6);
    line('buy', PAL.warn, 1.4);
    line('cur', '#7F93A6', 1.4);
    line('st', PAL.hydrogen, 1.4, true);
  }

  function drawTimeline() {
    const c = $('timeline'); if (!c) return;
    sizeCanvas(c, 56);
    const g = c.getContext('2d'); const W = c.width, H = c.height;
    g.clearRect(0, 0, W, H);
    const R = REGIONS[S.region];
    const rise = 12 - R.dayLen / 2, set = 12 + R.dayLen / 2;
    const X = h => 6 + (h / 24) * (W - 12);

    /* 昼夜带 */
    g.fillStyle = '#e3eaea';
    g.fillRect(X(0), 8, X(rise) - X(0), H - 22);
    g.fillRect(X(set), 8, X(24) - X(set), H - 22);
    g.fillStyle = '#eef5f1';
    g.fillRect(X(rise), 8, X(set) - X(rise), H - 22);

    /* 时段刻度 */
    g.strokeStyle = 'rgba(110,150,185,.22)'; g.lineWidth = 1;
    for (let h = 0; h <= 24; h += 3) {
      g.beginPath(); g.moveTo(X(h), 8); g.lineTo(X(h), H - 14); g.stroke();
    }
    g.fillStyle = '#74898e'; g.font = '10px "Microsoft YaHei",sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'top';
    for (let h = 0; h <= 24; h += 6) g.fillText(String(h).padStart(2, '0') + ':00', X(h), H - 12);

    /* 事件竖线（本日） */
    for (const ev of events) {
      if (ev.day !== S.day) continue;
      const h = (ev.simTime % 86400) / 3600;
      g.strokeStyle = ev.level === 'bad' ? 'rgba(255,107,114,.85)'
        : ev.level === 'warn' ? 'rgba(255,180,84,.8)' : 'rgba(66,232,208,.45)';
      g.lineWidth = ev.level === 'info' ? 1 : 2;
      g.beginPath(); g.moveTo(X(h), 8); g.lineTo(X(h), H - 14); g.stroke();
    }

    /* 日界与当前时刻 */
    const nowH = (S.simTime % 86400) / 3600;
    g.strokeStyle = PAL.power; g.lineWidth = 2;
    g.beginPath(); g.moveTo(X(nowH), 4); g.lineTo(X(nowH), H - 10); g.stroke();
    g.fillStyle = PAL.power;
    g.beginPath(); g.arc(X(nowH), 6, 3.4, 0, 7); g.fill();
    g.textAlign = 'right'; g.fillStyle = '#647b80';
    g.fillText('第 ' + S.day + ' 天 · ' + hhmmss(S.simTime).slice(0, 5), W - 6, 2);
  }

  /* ------------------------------------------------------------------ */
  /* 9. 抽屉                                                            */
  /* ------------------------------------------------------------------ */
  const DEV_GROUPS = [
    { g: '电源侧', keys: ['wind','windNacelle', 'solar', 'carport', 'smr', 'genset'] },
    { g: '输电与母线', keys: ['substation', 'line', 'bus', 'stepdown', 'disttr', 'flexbus'] },
    { g: '储能与电能质量', keys: ['storage', 'svgapf'] },
    { g: '数据中心配套', keys: ['dc','dcfeed','token','cooling','ups','noc','firewater','maintenance','logistics','phase2','phase3'] },
    { g: '公共充电', keys: ['supercharge','panamaSc','panamaSc2','parking'] },
    { g: '化工与电冶金', keys: ['metal','panamaZn','pem','h2tank','nh3','fc','nitrogen','chemwater','zincstock','ammoniastock','chemicalfeed','chempower','chemcontrol','zincair','zincfilter','zincfinish','zincstaging','h2purify','nh3cycle','nh3cool','ammoniaload','chemspares','chemfire'] },
    { g: '智能制造', keys: ['factory','factoryfeed','factoryraw','factoryproduct','factoryutility','factorydispatch','factorystaging'] },
    { g: '并网与政策边界', keys: ['grid', 'policy'] },
    { g: '园区公用', keys: ['gate', 'logistics', 'fire'] }
  ];
  const DEV_NAME = {};
  for (const k in LABELS3D) {
    const el = LABELS3D[k].el.querySelector('.nm');
    DEV_NAME[k] = el ? el.textContent : k;
  }

  function devLive(key) {
    if (key === 'dc') return 'IT ' + f1(S.itMW) + ' MW · 进线 ' + f1(S.dcLoadMW) + ' MW · PUE ' + S.pue.toFixed(2);
    const Lb = LABELS3D[key];
    return Lb && Lb.lv ? (Lb._t || Lb.lv.textContent) : '—';
  }

  function buildDevTree() {
    const box = $('devTree'); if (!box) return;
    let html = '';
    for (const grp of DEV_GROUPS) {
      const items = grp.keys.filter(k => DEV_NAME[k]);
      if (!items.length) continue;
      html += '<div class="grp">' + esc(grp.g) + '</div>';
      for (const k of items) {
        html += '<button data-dev="' + k + '">' + esc(DEV_NAME[k]) + '<span id="dv_' + k + '">–</span></button>';
      }
    }
    box.innerHTML = html;
    box.addEventListener('click', e => {
      const b = e.target.closest('button[data-dev]');
      if (b) focusDevice(b.dataset.dev);
    });
  }

  function updateDevTree() {
    for (const grp of DEV_GROUPS) for (const k of grp.keys) {
      const el = $('dv_' + k); if (el) el.textContent = devLive(k);
    }
  }

  const FX = {
    wind: { pos: [-60, 46, 96], tgt: [-70, 12, -6] },
    solar: { pos: [-20, 55, 126], tgt: [-77, 3, 40] },
    carport: { pos: [114, 30, 130], tgt: [82, 4, 89] },
    smr: { pos: [-40, 40, 170], tgt: [-62, 8, 90] },
    genset: { pos: [176, 34, 96], tgt: [124, 6, 34] },
    substation: { pos: [10, 46, 86], tgt: [6, 8, -8] },
    line: { pos: [30, 52, 90], tgt: [48, 12, -10] },
    bus: { pos: [58, 40, 82], tgt: [79, 6, -10] },
    stepdown: { pos: [70, 38, 76], tgt: [88, 6, -12] },
    disttr: { pos: [62, 42, 96], tgt: [78, 6, 33] },
    flexbus: { pos: [70, 46, 116], tgt: [78, 6, 52] },
    storage: { pos: [10, 34, 92], tgt: [28, 4, 42] },
    svgapf: { pos: [56, 30, 86], tgt: [76, 6, 26] },
    dc: { pos: [174, 49, 62], tgt: [134, 7, -10] },
    token: { pos: [148, 44, 60], tgt: [124, 10, -8] },
    supercharge: { pos: [110, 40, 116], tgt: [84, 6, 80] },
    panamaZn: { pos: [176, 40, 108], tgt: [143, 6, 66] },
    panamaSc: { pos: [116, 38, 122], tgt: [84, 6, 80] },
    pem: { pos: [16, 32, 108], tgt: [20, 5, 58] },
    h2tank: { pos: [40, 28, 104], tgt: [36, 5, 66] },
    nh3: { pos: [60, 34, 108], tgt: [52, 6, 66] },
    fc: { pos: [48, 32, 100], tgt: [60, 4, 58] },
    metal: { pos: [140, 40, 112], tgt: [129, 5, 60] },
    factory: { pos: [188, 44, 112], tgt: [170, 6, 60] },
    grid: { pos: [150, 60, 120], tgt: [120, 4, 40] },
    policy: { pos: [120, 90, 190], tgt: [40, 0, 40] },
    gate: { pos: [115, 25, 182], tgt: [95, 4, 130] },
    logistics: { pos: [178, 44, 132], tgt: [160, 4, 40] },
    fire: { pos: [342, 48, 12], tgt: [278, 3, -57] }
  };

  let selectedDev = null;
  function focusDevice(key) {
    window.NZ_VEHICLES?.hide();
    if (window.NZ_CLOUD_VISIT && window.NZ_CLOUD_VISIT.isOpen()) window.NZ_CLOUD_VISIT.close();
    selectedDev = key;
    window.NZ_VISUAL.selected(key);
    for (const k in LABELS3D) LABELS3D[k].el.classList.toggle('sel', k === key);
    showInfo(key);
    const fx = window.NZ_LAYOUT.focus(key) || FX[key];
    if (fx) tweenCamera(fx.pos, fx.tgt, 1.0);
    /* 不再顺手把运行面板也拉开：抽屉宽 460px 且层级更高，会把刚弹出的
     * 设备信息卡整块盖住——点了设备却什么档案也看不见。抽屉本来就开着时
     * 保持原状，由 body.dr-open 让信息卡左移避让。 */
  }

  function showInfo(key) {
    const card = $('infoCard');
    const I = INFO[key];
    $('infoTitle').textContent = (I && I.t) ? I.t : (DEV_NAME[key] || key);
    const media = I && I.media ? I.media : 'power';
    const mediaName = { power: '电力', hydrogen: '氢', ammonia: '氨', data: '数据', grid: '外购电/边界', nuclear: '核电' }[media] || media;
    $('infoMedia').textContent = mediaName;
    $('infoMedia').style.color = MEDIA_CSS[media] || PAL.power;
    $('infoMedia').style.borderColor = (MEDIA_CSS[media] || PAL.power) + '77';

    if (!I) {
      $('infoDesc').textContent = '本设备在本版档案中没有独立条目（属分区标注或场景示意物），不对应核算边界。';
      $('infoParams').innerHTML = '';
      $('infoFrom').innerHTML = '<b>来源</b> —';
      $('infoTo').innerHTML = '<b>去向</b> —';
      $('infoNote').textContent = '';
    } else {
      $('infoDesc').textContent = I.d || '';
      $('infoParams').innerHTML = (I.p || []).map(r =>
        '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>').join('') +
        (I.k ? Object.keys(I.k).map(k => '<tr><td>' + esc(k) + '</td><td>' + esc(I.k[k]) + '</td></tr>').join('') : '');
      $('infoFrom').innerHTML = '<b>来源</b> ' + esc(I.from || '—');
      $('infoTo').innerHTML = '<b>去向</b> ' + esc(I.to || '—');
      $('infoNote').textContent = I.note || '';
    }
    $('infoLive').textContent = '实时：' + devLive(key);
    card.classList.add('open');
    window.NZ_TOKEN_METER.show(key);
  }
  function closeInfo() {
    window.NZ_VEHICLES?.hide();
    $('infoCard').classList.remove('open');
    window.NZ_TOKEN_METER.hide();
    selectedDev = null;
    window.NZ_VISUAL.clear();
    for (const k in LABELS3D) LABELS3D[k].el.classList.remove('sel');
  }

  /* 台账页 */
  function kvTable(rows) {
    return rows.map(r => '<tr' + (r.tot ? ' class="tot"' : '') + '><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>').join('');
  }
  function mixRows(mix, total) {
    return MK.map(k => [CFG.MIX_LABEL[k] || k,
      total > 1e-9 ? (mix[k] / total * 100).toFixed(1) + '%　（' + mix[k].toFixed(2) + '）' : '—']);
  }
  function sumMix(o) { let s = 0; for (const k of MK) s += (o[k] || 0); return s; }

  function updateLedger() {
    const F = L;
    $('tbFlow').innerHTML = kvTable([
      ['一次发电量（不含放电与氢回发）', F.genMWh.toFixed(1) + ' MWh'],
      ['端用电量（已供需求）', F.loadMWh.toFixed(1) + ' MWh'],
      ['电网购入', F.buyMWh.toFixed(1) + ' MWh'],
      ['弃电', F.curtailMWh.toFixed(1) + ' MWh'],
      ['外送（本演示配置为 0）', F.exportMWh.toFixed(1) + ' MWh'],
      ['储能充电 / 放电', F.chargeMWh.toFixed(1) + ' / ' + F.dischargeMWh.toFixed(1) + ' MWh'],
      ['氢回发（电→氢→电，不重复计入一次能源）', F.recircMWh.toFixed(2) + ' MWh'],
      ['氢质量平衡：初 ' + (F.h2StartKg || 0).toFixed(0) + ' + 产 ' + F.h2ProducedKg.toFixed(0) +
        ' − 氨用 ' + F.h2ToAmmoniaKg.toFixed(0) + ' − 池用 ' + F.h2ToFuelCellKg.toFixed(1) +
        ' → 末 ' + S.h2Kg.toFixed(0) + ' kg',
        ((F.h2StartKg || 0) + F.h2ProducedKg - F.h2ToAmmoniaKg - F.h2ToFuelCellKg - S.h2Kg)
          .toFixed(6) + ' kg 余差'],
      ['未供电（未计入已供需求）', F.unservedMWh.toFixed(2) + ' MWh'],
      { 0: '电量守恒残差（末步）', 1: fp(S.lastResidualMW) + ' MW', tot: true }
    ]);
    const consTot = sumMix(F.consumption);
    $('tbCons').innerHTML = kvTable(mixRows(F.consumption, consTot).concat([
      ['合计', consTot.toFixed(1) + ' MWh']
    ]));
    $('tbStock').innerHTML = kvTable(
      [['电池库存合计', F.battMWh.total.toFixed(1) + ' MWh']]
        .concat(mixRows(F.battMWh.mix, F.battMWh.total))
        .concat([['储氢库存合计', S.h2Kg.toFixed(0) + ' kg']])
        .concat(mixRows(F.h2MixKg, S.h2Kg)));
    $('tbEmis').innerHTML = kvTable([
      ['外购电间接排放（' + CFG.FACTOR_SOURCE.year + ' 年省级因子）', F.gridCO2T.toFixed(2) + ' tCO₂'],
      ['燃气直接排放', F.gasCO2T.toFixed(2) + ' tCO₂'],
      ['燃气电量（因子待配置，未计入排放）', F.gasUnaccountedMWh.toFixed(2) + ' MWh'],
      ['减排量结论', '不输出（缺基准情景）']
    ]);
    const taskView=S.taskLedger;
    $('tbPlan').innerHTML = kvTable(taskView ? taskView.production.map(t=>[(t.key==='zinc'?'电解锌':'智能制造')+'：计划 / 完成 / 待完成 / 逾期', [t.target,t.done,t.remaining,t.overdue].map(n=>n.toFixed(1)).join(' / ')+' MWh']).concat([['制氢：目标库存 / 当前库存',taskView.hydrogen.target.toFixed(0)+' / '+S.h2Kg.toFixed(0)+' kg'],['计量口径','工业为等效生产用电任务；制氢按下游需求补库；任务不互抵']]) : []);
    if (F.days && F.days.length) {
      $('tbDays').innerHTML = kvTable(
        F.days.slice(-6).map(d => ['第 ' + d.day + ' 天（' + d.hours + ' h）',
          '发电 ' + (d.genMWh || 0).toFixed(0) + ' / 购电 ' + (d.buyMWh || 0).toFixed(0) +
          ' / 弃电 ' + (d.curtailMWh || 0).toFixed(0) + ' MWh　可再生占比 ' + ((d.renewableShare || 0) * 100).toFixed(0) + '%'])
      );
    } else {
      $('tbDays').innerHTML = kvTable([['—', '第 1 天尚未结束（' + S.dGen.toFixed(0) + ' MWh 发电）']]);
    }
  }
  function fp(v) { return Math.abs(v) < 1e-6 ? '0（机器精度）' : v.toExponential(2); }

  function updateEvents() {
    if (!eventsDirty) return;
    eventsDirty = false;
    const box = $('evList'); if (!box) return;
    box.innerHTML = events.slice(-120).reverse().map(ev =>
      '<div class="ev ' + esc(ev.level) + '"><b>' + esc(ev.t) + '</b><span>' + esc(ev.msg) + '</span></div>').join('');
  }

  function buildPolicy() {
    const P = CFG.POLICY, F = CFG.FACTOR_SOURCE, PQ = CFG.POWER_QUALITY;
    $('policyBox').innerHTML =
      '<div>当前状态：<b>' + (P.status === 'pending' ? '待核算' : esc(P.status)) + '</b></div>' +
      '<div>缺少参数：' + esc(P.reason) + '</div>' +
      '<div>口径依据：' + esc(P.note) + '</div>' +
      '<div>电能质量：' + esc(PQ.modelType) + '，测点 ' + esc(PQ.measurementPoint) + '，THDu 参考限值 ' +
      PQ.thdLimitPercent + '%（实施时按电压等级与有效版本核验）。</div>' +
      '<div>电网因子：' + esc(F.label) + '（' + esc(F.publisher) + '，' + esc(F.bulletin) + '，单位 ' + esc(F.unit) + '）。</div>';

    const srcs = [
      { label: '电力二氧化碳排放因子（省级平均）', url: F.url, by: F.publisher + ' · ' + F.bulletin },
      ...P.sources.map(s => ({ label: s.label, url: s.url, by: '' }))
    ];
    $('srcList').innerHTML = srcs.map(s =>
      '<div class="src"><b>' + esc(s.label) + '</b>' + (s.by ? esc(s.by) + '<br>' : '') +
      '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.url) + '</a></div>').join('');

    const B = [
      '政策对标：年度等价值综合能耗与非电能源边界未配置，本版一律显示「待核算」，不据瞬时功率输出达标结论。',
      '燃气机组直接排放因子未配置，燃气电量单列为「待配置」，不进入排放合计。',
      '电能质量（功率因数、THDu、电压偏差）为示意估算，未建立潮流与谐波阻抗模型。',
      '电解槽综合电耗是否含压缩/纯化、储氢最大出罐流量为待厂家确认项。',
      '工业任务以锌 100 / 工厂 50 MW × 24 h 的等效用电量配置；制氢根据下游与目标库存补充，均为演示假设。',
      '电池与储氢的初始库存来源记为「未知」，不计入认证绿电或绿氢。',
      '氢回发（电→氢→电）单独记为「再循环电量」，不重复计入一次清洁能源与减排量。',
      '仿真时间不用于真实时间计量：休眠唤醒后的单帧补算被截断。',
      '八个情景为可复现演示情景（固定随机种子），不是历史实测序列。',
      '场景几何、设备外观与规模为示意，不是工程图或施工依据。',
      '统计口径以园区母线为边界：发电＋购电＋放电 = 已供需求＋充电＋外送；弃电不冲抵发电量，未供电不计入已供需求。'
    ];
    $('boundList').innerHTML = B.map(t => '<li>' + esc(t) + '</li>').join('');
  }

  /* 抽屉开关 */
  let drawerOpen = false;
  function openDrawer(tab) {
    $('drawer').classList.add('open');
    /* body 类名供样式层避让：抽屉宽 460px，若信息卡仍停在 right:16px，
     * 会被整块盖住 —— 点设备只看得到运行面板，看不到刚打开的设备档案。 */
    document.body.classList.add('dr-open');
    drawerOpen = true;
    if (tab) switchTab(tab);
    refreshDrawer(true);
  }
  function closeDrawer() {
    $('drawer').classList.remove('open');
    document.body.classList.remove('dr-open');
    drawerOpen = false;
  }
  function toggleDrawer() { drawerOpen ? closeDrawer() : openDrawer('params'); }
  function switchTab(tab) {
    for (const b of $('drTabs').children) b.classList.toggle('on', b.dataset.tab === tab);
    for (const p of document.querySelectorAll('.dr-page')) p.classList.toggle('on', p.dataset.page === tab);
    activeTab = tab;
    refreshDrawer(true);
  }
  let activeTab = 'params';

  function refreshDrawer(force) {
    if (!drawerOpen && !force) return;
    if (activeTab === 'params') refreshParams();
    else if (activeTab === 'devices') updateDevTree();
    else if (activeTab === 'ledger') updateLedger();
    else if (activeTab === 'events') updateEvents();
    else if (activeTab === 'policy') { /* 静态，只建一次 */ }
  }

  /* 参数页控件回显 */
  function refreshParams() {
    const R = REGIONS[S.region];
    $('selRegion').value = S.region;
    $('regionDesc').textContent = R.desc;
    $('rgWind').value = S.windSlider;
    $('vWind').textContent = f1(S.windSpeed) + ' m/s';
    $('chkWind').checked = !!S.windManual;
    $('chkDay').checked = !!S.dayNight;
    const g = sunGeometry(S.simTime, REGIONS[S.region]);
    $('vSun').textContent = S.dayNight ? (g.elev > 0 ? '昼 · 光照 ' + (S.irradi * 100).toFixed(0) + '%' : '夜间') : '固定正午';
    $('vSmr').textContent = ['停堆', '50%', '100%'][S.smrGear];
    for (const b of $('segSmr').children) b.classList.toggle('on', +b.dataset.gear === S.smrGear);
    $('rgIt').value = S.itSlider;
    $('vIt').textContent = f1(S.itSlider) + ' MW';
    $('selSt').value = S.stMode;
    $('swSvg').classList.toggle('on', !!S.svgOn);
    $('swApf').classList.toggle('on', !!S.apfOn);
    $('swGenset').classList.toggle('on', !!S.gensetOn);
    $('swFc').classList.toggle('on', !!S.fcOn);
    for (const b of $('segLight').children) b.classList.toggle('on', b.dataset.light === S.lightPreset);
  }

  /* ------------------------------------------------------------------ */
  /* 10. 界面节拍                                                       */
  /* ------------------------------------------------------------------ */
  let uiSlow = 0;
  function updateDash() {
    updateClock();
    updateSummary();
    updateLegend();
    updateTicker();
    drawTimeline();
    if (selectedDev) $('infoLive').textContent = '实时：' + devLive(selectedDev);
    uiSlow++;
    if (uiSlow >= 4) {                      /* 约 1 s */
      uiSlow = 0;
      refreshDrawer(false);
      updateEvents();
      if ($('trendPanel').classList.contains('open')) drawTrend();
      updateLabelVisibility();
    }
  }

  /* 标签重要度：数值越大的越先占位。风电/光伏/母线/数据中心属于叙事主线。 */
  const LABEL_PRIORITY = {
    zonePark: 100, zoneGen: 100,
    wind: 20, solar: 20, substation: 19, bus: 19, dc: 19,
    storage: 16, pem: 15, nh3: 15, h2tank: 14, metal: 13, factory: 13,
    supercharge: 12, svgapf: 11, stepdown: 11, disttr: 10, flexbus: 10,
    line: 10, token: 9, fc: 9, genset: 8, smr: 8, grid: 8,
    carport: 5, panamaDc: 4, panamaZn: 4, panamaSc: 4, gate: 3, logistics: 3, fire: 3
  };

  /* 面板遮挡区：落在这些矩形里的 3D 标签会被面板压住，直接让位 */
  const OCCLUDERS = ['topbar', 'summary', 'legend', 'flexHud', 'bottomBar', 'tourBar', 'infoCard', 'drawer', 'sceneHeading', 'flowLayers', 'campusCompass', 'chemicalReviewFlow', 'cvPanel', 'cvHud'];

  /* 标签整理：按"实测尺寸 + 重要度 + 面板遮挡"三者共同决定谁显示。
   * 先集中读取几何、再集中写 class，避免读写交错引发的反复重排。 */
  function updateLabelVisibility() {
    const viewW = VW, viewH = VH;
    window.NZ_VISUAL.filterLabels();
    const frameRect = cv.getBoundingClientRect();

    const blocked = [];
    for (const id of OCCLUDERS) {
      const el = document.getElementById(id);
      if (!el) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      if ((id === 'drawer' || id === 'infoCard') && !el.classList.contains('open')) continue;
      if (id === 'tourBar' && !el.classList.contains('on')) continue;
      const b = el.getBoundingClientRect();
      if (b.width > 2 && b.height > 2) blocked.push({left:b.left-frameRect.left,right:b.right-frameRect.left,top:b.top-frameRect.top,bottom:b.bottom-frameRect.top});
    }

    const items = [];
    for (const k in LABELS3D) {
      const el = LABELS3D[k].el;
      const lv = LABELS3D[k].lv;
      if (el.classList.contains('zone')) { el.classList.remove('hidden'); continue; }
      if (el.style.display === 'none' || el.classList.contains('layer-hidden')) continue;             /* 相机背后 */
      const w = el.offsetWidth || 96, h = el.offsetHeight || 30;
      if ((!lv.textContent || lv.textContent === '–') && !el.classList.contains('wind-unit-label')) continue; /* Name-only turbine labels do not require a live-value row. */
      const cx = parseFloat(el.style.left || '0') || 0;
      const cy = parseFloat(el.style.top || '0') || 0;
      items.push({
        el, sel: el.classList.contains('sel'), pri: LABEL_PRIORITY[k] || 6,
        x: cx - w / 2, y: cy - h, w, h, r: cx + w / 2, b: cy
      });
    }
    /* 选中设备永远第一，其次按重要度；同优先级按横向位置稳定排序，避免抖动 */
    items.sort((a, b) => (b.sel - a.sel) || (b.pri - a.pri) || (a.x - b.x));

    const placed = [];
    for (const it of items) {
      let hide = false;
      if (it.x < 4 || it.r > viewW - 4 || it.b < 4 || it.b > viewH - 4) hide = true;
      if (!hide) for (const p of blocked) {
        if (Math.min(it.r, p.right) - Math.max(it.x, p.left) > 2 &&
          Math.min(it.b, p.bottom) - Math.max(it.y, p.top) > 2) { hide = true; break; }
      }
      if (!hide) for (const p of placed) {
        if (Math.min(it.r, p.r) - Math.max(it.x, p.x) > 2 &&
          Math.min(it.b, p.b) - Math.max(it.y, p.y) > 2) { hide = true; break; }
      }
      it.el.classList.toggle('hidden', hide);
      if (!hide) placed.push(it);
    }
    R_LAST_LABELS.visible = placed.length;
    R_LAST_LABELS.total = items.length;
  }
  const R_LAST_LABELS = { visible: 0, total: 0 };

  /* ------------------------------------------------------------------ */
  /* 11. 情景与控件绑定                                                 */
  /* ------------------------------------------------------------------ */
  function applyScenario(key) {
    const sc = CFG.SCENARIOS[key];
    E.reset({ scenario: key });
    trend.buf.length = 0; trend.lastSim = -1;
    events.length = 0;
    for (const ev of L.events.slice(-30)) events.push(ev);
    eventsDirty = true;
    syncScenarioSelect();
    refreshParams(); updateSummary(); updateLegend(); updateDevTree(); updateLedger();
    toast('已载入情景：' + sc.label + '（' + sc.hint + '）');
  }

  /* 情景下拉：选项由配置生成，切完把选中项同步回当前情景 */
  function buildScenarioSelect() {
    const sel = $('selScenario'); if (!sel) return;
    sel.innerHTML = Object.keys(CFG.SCENARIOS).map(k => {
      const sc = CFG.SCENARIOS[k];
      return '<option value="' + esc(k) + '" title="' + esc(sc.hint || '') + '">' +
        esc(sc.label) + '</option>';
    }).join('');
    syncScenarioSelect();
  }
  function syncScenarioSelect() {
    const sel = $('selScenario');
    if (sel && sel.value !== S.scenario) sel.value = S.scenario;
  }

  function bindControls() {
    /* 情景切换：原生下拉（v1.0.7） */
    $('selScenario').addEventListener('change', e => applyScenario(e.target.value));

    /* 模式：演示 / 运行 */
    $('segMode').addEventListener('click', e => {
      const b = e.target.closest('button[data-mode]'); if (!b) return;
      setMode(b.dataset.mode);
    });

    /* 画质 */
    $('segQuality').addEventListener('click', e => {
      const b = e.target.closest('button[data-q]'); if (!b) return;
      S.quality = b.dataset.q;
      autoQuality = false;
      applyQuality('画质切换为「' + QS[S.quality].label + '」（手动指定，不再自动降级）');
      refreshQualitySeg();
    });

    /* 运行 / 暂停、倍速 */
    $('btnRun').addEventListener('click', () => {
      S.running = !S.running;
      $('btnRun').textContent = S.running ? '⏸ 暂停' : '▶ 运行';
      $('btnRun').classList.toggle('primary', S.running);
    });
    $('selSpeed').addEventListener('change', e => {
      S.timeScale = +e.target.value;
      toast('仿真倍速 ' + S.timeScale + '×（物理步长恒为 ' + CFG.TIME.stepSeconds + ' 秒）');
    });

    $('btnCamReset').addEventListener('click', () => { cancelTween(); fitView(); });
    $('btnAutoRot').addEventListener('click', () => {
      controls.autoRotate = !controls.autoRotate;
      $('btnAutoRot').textContent = controls.autoRotate ? '环绕：开' : '环绕：关';
      $('btnAutoRot').classList.toggle('primary', controls.autoRotate);
    });

    /* 摘要折叠 */
    $('sumToggle').addEventListener('click', () => {
      const s = $('summary');
      s.classList.toggle('folded');
      $('sumToggle').querySelector('span').textContent = s.classList.contains('folded') ? '◂' : '▸';
    });

    /* 抽屉 */
    $('btnDrawer').addEventListener('click', () => toggleDrawer());
    $('drClose').addEventListener('click', closeDrawer);
    $('drTabs').addEventListener('click', e => {
      const b = e.target.closest('button[data-tab]'); if (b) switchTab(b.dataset.tab);
    });
    $('summary').addEventListener('click', e => {
      const b = e.target.closest('button[data-drawer]');
      if (b) openDrawer(b.dataset.drawer);
    });
    $('infoClose').addEventListener('click', closeInfo);

    /* 趋势面板 */
    $('btnTrend').addEventListener('click', () => {
      const p = $('trendPanel');
      p.classList.toggle('open');
      $('btnTrend').textContent = p.classList.contains('open') ? '平衡趋势 ▾' : '平衡趋势 ▴';
      if (p.classList.contains('open')) { sizeCanvas($('trendCanvas'), 150); drawTrend(); }
    });
    $('trendClose').addEventListener('click', () => {
      $('trendPanel').classList.remove('open');
      $('btnTrend').textContent = '平衡趋势 ▴';
    });

    /* 减少动态 */
    $('btnReduce').addEventListener('click', () => {
      S.reduceMotion = !S.reduceMotion;
      document.body.classList.toggle('reduce-motion', !!S.reduceMotion);
      $('btnReduce').textContent = S.reduceMotion ? '减少动态：开' : '减少动态：关';
      $('btnReduce').classList.toggle('primary', !!S.reduceMotion);
      controls.autoRotate = false;
      $('btnAutoRot').textContent = '环绕：关';
      $('btnAutoRot').classList.remove('primary');
    });

    /* 全屏 */
    $('btnFull').addEventListener('click', () => {
      const el = document.documentElement;
      if (!document.fullscreenElement) { if (el.requestFullscreen) el.requestFullscreen(); }
      else if (document.exitFullscreen) document.exitFullscreen();
    });

    /* 截图 / 导出 */
    $('btnShot').addEventListener('click', () => { pendingShot = true; });
    $('btnExport').addEventListener('click', exportData);

    /* 导览 */
    $('btnTour').addEventListener('click', () => window.NZ_CLOUD_VISIT.toggle());
    $('tourPause').addEventListener('click', toggleTourPause);
    $('tourPrev').addEventListener('click', () => tourJump(tour.chap - 1));
    $('tourNext').addEventListener('click', () => tourJump(tour.chap + 1));
    $('tourExit').addEventListener('click', exitTour);

    /* 参数页 */
    const selRegion = $('selRegion');
    for (const [k, r] of Object.entries(REGIONS)) {
      const op = document.createElement('option'); op.value = k; op.textContent = r.name;
      selRegion.appendChild(op);
    }
    selRegion.addEventListener('change', e => {
      const r = REGIONS[e.target.value];
      E.reset({ scenario: S.scenario, region: e.target.value, seed: S.seed });
      refreshParams(); updateSummary();
      toast('地区切换：' + r.name + '（电网因子 ' + r.co2 + ' tCO₂/MWh，' + CFG.FACTOR_SOURCE.year + ' 年省级平均）');
    });
    $('rgWind').addEventListener('input', e => {
      S.windSlider = +e.target.value;
      $('vWind').textContent = f1(S.windSlider) + ' m/s';
    });
    $('chkWind').addEventListener('change', e => {
      S.windManual = e.target.checked;
      if (S.windManual) S.windSpeed = S.windSlider;
      toast(S.windManual ? '风速已手动锁定 ' + f1(S.windSlider) + ' m/s（资源波动退出）' : '风速交还资源模型');
    });
    $('chkDay').addEventListener('change', e => { S.dayNight = e.target.checked; refreshParams(); });
    $('segSmr').addEventListener('click', e => {
      const b = e.target.closest('button[data-gear]'); if (!b) return;
      const gear = +b.dataset.gear;
      S.smrEnabled = gear > 0; S.smrGear = gear;
      S.smr = gear > 0 ? K.SMR_CAP * gear / 2 : 0;
      refreshParams();
      if (gear > 0) toast('SMR 研究情景已启用：' + ['', '50%', '100%'][gear] + ' 档位（前瞻研究情景，不代表本园区已建成该设施）', 'warn');
    });
    $('rgIt').addEventListener('input', e => {
      S.itSlider = +e.target.value; $('vIt').textContent = f1(S.itSlider) + ' MW';
    });
    $('selSt').addEventListener('change', e => { S.stMode = e.target.value; });
    $('swSvg').addEventListener('click', () => {
      S.svgOn = !S.svgOn; refreshParams();
      toast(S.svgOn ? 'SVG 投入（±' + CFG.POWER_QUALITY.svgMvar + ' Mvar 容量，饱和时目标可能达不到）' : 'SVG 退出，功率因数将由负荷自然决定');
    });
    $('swApf').addEventListener('click', () => {
      S.apfOn = !S.apfOn; refreshParams();
      toast(S.apfOn ? 'APF 投入（本版谐波为示意估算，不承诺投入后必然合规）' : 'APF 退出，谐波示意值升高');
    });
    $('swGenset').addEventListener('click', () => {
      S.gensetOn = !S.gensetOn; refreshParams();
      toast(S.gensetOn ? '燃气轮机启动（应急备用，直接排放因子待配置，不计绿电）' : '燃气轮机停机，转入冷备用');
    });
    $('swFc').addEventListener('click', () => {
      if (!S.fcOn && S.h2Kg <= CFG.PLANT.fuelCellMinTankKg) { toast('储氢不足（≤' + CFG.PLANT.fuelCellMinTankKg + ' kg），氢燃料电池无法启动', 'warn'); return; }
      S.fcOn = !S.fcOn; refreshParams();
      toast(S.fcOn ? '氢燃料电池启动（耗氢 ≈' + CFG.PLANT.fuelCellKgPerMWh + ' kg/MWh）' : '氢燃料电池停机');
    });
    $('segLight').addEventListener('click', e => {
      const b = e.target.closest('button[data-light]'); if (!b) return;
      S.lightPreset = b.dataset.light;
      refreshParams();
      toast('展示光照：' + CFG.LIGHT_PRESETS[S.lightPreset].label +
        (S.lightPreset === 'follow' ? '（太阳、路灯与仿真时钟绑定）' : '（与仿真时钟解耦）'));
    });

    /* 点选设备：先点标签，再射线拾取 */
    labelLayer.addEventListener('click', e => {
      const el = e.target.closest('.dev3d'); if (!el) return;
      for (const k in LABELS3D) if (LABELS3D[k].el === el) {
        /* v1.1.0：点数据中心标签也进内部视图 */
        if (k === 'dc' && window.GOBI_DCDT) { try { window.GOBI_DCDT.open(); } catch (e) { } }
        focusDevice(k); return;
      }
    });
    let downX = 0, downY = 0, downT = 0;
    cv.addEventListener('pointerdown', e => { downX = e.clientX; downY = e.clientY; downT = Date.now(); });
    cv.addEventListener('click', e => {
      if (e.target.closest('.dev3d')) return;
      /* 拖动超过 5px 或按住超过 400ms 视为旋转/平移，不做点选 */
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5 || (Date.now() - downT) > 400) return;
      const r = cv.getBoundingClientRect();
      const ndc = new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObjects(scene.children, true);
      let hitPt = null, taggedDevice = null;
      for (const h of hits) {
        if (h.object.isPoints) continue;
        // Three.js raycasts hidden meshes too; an opened roof must not mask
        // the equipment that is now visible beneath it.
        let visible = true;
        for (let node = h.object; node; node = node.parent) {
          if (!node.visible) { visible = false; break; }
        }
        const material = Array.isArray(h.object.material)
          ? h.object.material[h.face?.materialIndex ?? 0] : h.object.material;
        if (!visible || material?.visible === false ||
            (material?.transparent && material.opacity <= 0.001)) continue;
        if(window.NZ_VEHICLES?.inspectHit(h))return;
        hitPt = h.point;
        for(let node=h.object;node;node=node.parent){if(node.userData.deviceKey&&INFO[node.userData.deviceKey]){if(node.userData.windIndex!=null&&window.NZ_WIND_PRODUCT)window.NZ_WIND_PRODUCT.selectIndex(node.userData.windIndex);taggedDevice=node.userData.deviceKey;break;}}
        break;
      }
      if (!hitPt) { closeInfo(); return; }
      let best = null, bd = Infinity;
      for (const d of DEVICES) {
        const dx = d.p[0] - hitPt.x, dy = d.p[1] - hitPt.y, dz = d.p[2] - hitPt.z;
        const dist = Math.hypot(dx, dy, dz);
        if (dist < d.r * 3.2 && dist < bd) { bd = dist; best = d.key; }
      }
      if(taggedDevice)best=taggedDevice;
      /* v1.1.0：点到数据中心那栋楼 → 开内部视图（同时照常弹档案卡，两者不冲突） */
      if (best && best === 'dc' && window.GOBI_DCDT) {
        try { window.GOBI_DCDT.open(); } catch (e) { }
      }
      if (best) focusDevice(best); else closeInfo();
    });

    /* 快捷键 */
    window.addEventListener('keydown', e => {
      if (e.target && /INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName)) return;
      if (window.NZ_CLOUD_VISIT.isActive()) return;
      const k = e.key.toLowerCase();
      if (k === 'd') toggleDrawer();
      else if (k === 'm') { if (window.GOBI_DCDT) window.GOBI_DCDT.toggle(); }
      else if (k === 'f') $('btnFull').click();
      else if (k === 't') { window.NZ_CLOUD_VISIT.toggle(); }
      else if (k === 'escape') { if (tour.active) exitTour(); else if (drawerOpen) closeDrawer(); else closeInfo(); }
      else if (k === ' ') { e.preventDefault(); $('btnRun').click(); }
      else if (k === 'r') $('btnCamReset').click();
    });
  }

  function refreshQualitySeg() {
    for (const b of $('segQuality').children) b.classList.toggle('on', b.dataset.q === S.quality);
  }
  function setMode(mode) {
    /* 单一真源：模式状态在这里落定。曾经的写法是调用方各自先写 S.mode 再调
     * setMode，于是直接调 setMode('run') 时 body 类名换了、S.mode 却仍是旧值 ——
     * 界面看着像运行模式，导出与状态汇报仍报演示模式。 */
    S.mode = mode;
    document.body.classList.toggle('mode-exhibit', mode === 'exhibit');
    document.body.classList.toggle('mode-run', mode === 'run');
    for (const b of $('segMode').children) b.classList.toggle('on', b.dataset.mode === mode);
    if (mode === 'exhibit') { closeDrawer(); closeInfo(); }
    toast(mode === 'exhibit' ? '演示模式：只留画面与摘要，参数在「运行」模式调整' : '运行模式：显示柔性调度 HUD 与全部面板');
  }

  /* ------------------------------------------------------------------ */
  /* 12. 导出与截图                                                     */
  /* ------------------------------------------------------------------ */
  let pendingShot = false;
  function maybeCaptureShot() {
    if (!pendingShot) return;
    pendingShot = false;
    try {
      const url = renderer.domElement.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url; a.download = 'Net-Zero-grid-' + S.region + '-' + hhmmss(S.simTime).replace(/:/g, '') + '.png';
      document.body.appendChild(a); a.click(); a.remove();
      toast('已导出画面 PNG（' + VW + '×' + VH + ' 逻辑分辨率，像素比 ' + DPR + '）');
    } catch (e) { toast('画面导出失败：' + (e && e.message), 'warn'); }
  }

  function exportData() {
    const q = QS[S.quality] || QS.standard;
    const payload = {
      brand: CFG.BRAND,
      modelVersion: CFG.version,
      exportedAtSimTime: S.simTime,
      demoNote: '本导出为演示模型的运行状态与核算账本，不是实测数据，也不构成达标或投资结论。',
      scene: {
        region: S.region, scenario: S.scenario, seed: S.seed,
        windManual: S.windManual, windSlider: S.windSlider, dayNight: S.dayNight,
        smrEnabled: S.smrEnabled, smrGear: S.smrGear, itSlider: S.itSlider,
        stMode: S.stMode, svgOn: S.svgOn, apfOn: S.apfOn, fcOn: S.fcOn, gensetOn: S.gensetOn,
        lightPreset: S.lightPreset, quality: S.quality, timeScale: S.timeScale,
        stepSeconds: CFG.TIME.stepSeconds
      },
      campus: { sites: window.NZ_MULTI_PLAN.sites, instantaneousLoadMW: window.NZ_MULTI.audit().totals, facilities: window.NZ_MULTI_PLAN.facilities, chemicalTopology:window.NZ_CHEMICAL.audit(), windProducts:window.NZ_WIND_PRODUCT.audit(), typedFlows:window.NZ_FLOWS.audit(), systemBoundaries: window.NZ_MULTI.audit().systems, charging: window.NZ_MULTI.audit().charging, note: '瞬时分区负荷；未核算分园区电源来源或绿电比例' },
      snapshot: E.snapshot(),
      ledger: E.exportLedger(),
      events: events.slice(-200),
      policy: { status: CFG.POLICY.status, reason: CFG.POLICY.reason, factorSource: CFG.FACTOR_SOURCE },
      performance: { fpsLast: Math.round(perf.fps), worstFps: perf.worstFps === Infinity ? null : Math.round(perf.worstFps), samples: perf.samples.slice(-20), qualityApplied: q.label, pixelRatio: DPR }
    };
    download('Net-Zero-grid-state-' + S.region + '.json',
      new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    toast('已导出运行状态与账本 JSON');
  }

  /* 导览的开场/结束机位（v1.3.2）：按甲方参考截图量化标定 ——
   * 量出参考图里园区地面外接框占画面 64%×62%、顶边在 24% 处，据此反推定出
   * 俯角约 32°、距离约 210。改这里就是改"导览从哪开始、回到哪"。 */
  const TOUR_HOME = { pos: [480,385,515], tgt: [10,0,-45] };

  /* ------------------------------------------------------------------ */
  /* 13. v17 八章叙事；文案配置镜头与字幕，楼内时间计入全程。 */
  /* ------------------------------------------------------------------ */
  /* v17 narrated tour: paragraph timing and shots are compiled from the editable script. */
  const N=window.NZ_TOUR_NARRATIVE,NARRATION=N.compile(window.NZ_TOUR_SCRIPT);
  const windPose=window.NZ_WIND_PRODUCT.pose(0);
  function resolveTourPose(key){if(key==='home')return TOUR_HOME;if(key==='windClose')return windPose;if(key==='windWide'){const d=new THREE.Vector3(...windPose.pos).sub(new THREE.Vector3(...windPose.tgt)).normalize().multiplyScalar(80);return {pos:new THREE.Vector3(...windPose.tgt).add(d).toArray(),tgt:windPose.tgt.slice()};}return window.NZ_TOUR_SCRIPT.shots[key];}
  const TOUR=NARRATION.chapters.map(c=>({...c,to:resolveTourPose(c.segments.at(-1).shot).pos.slice(),tgt:resolveTourPose(c.segments.at(-1).shot).tgt.slice()}));
  const TOUR_TOTAL=NARRATION.totalSeconds;
  const TOUR_PACING={openingSeconds:TOUR[0].dur,windApproachSeconds:5,windExplanationSeconds:9,energyTransitSeconds:9,energySettleSeconds:2,energyRampFraction:.18,estimated:true};
  const smoothTour=v=>{v=clamp(v,0,1);return v*v*(3-2*v);};
  function narratedPoseAt(index,t){const c=TOUR[index],cue=N.at(c,t),j=c.segments.indexOf(cue),previous=j?resolveTourPose(c.segments[j-1].shot):index?{pos:TOUR[index-1].to,tgt:TOUR[index-1].tgt}:TOUR_HOME,to=resolveTourPose(cue.shot),k=cue.move?smoothTour((t-cue.start)/cue.move):1;return {pos:previous.pos.map((v,i)=>v+(to.pos[i]-v)*k),tgt:previous.tgt.map((v,i)=>v+(to.tgt[i]-v)*k),cue:cue.id};}
  function windPoseAt(t){return narratedPoseAt(1,t);}
  function energyPoseAt(t){return narratedPoseAt(2,t);}
  function energyTravelProgress(t){return smoothTour(t/TOUR_PACING.energyTransitSeconds);}
  const DC_SEG={chap:NARRATION.insert.chapter,at:NARRATION.insert.at,from:NARRATION.insert.from,to:NARRATION.insert.to,startDelay:700,maxWait:200,openingHold:0};
  const tour={active:false,chap:0,t:0,paused:false,dcWait:false,dcDone:false,insideTime:0,closing:false,cue:null};
  let dcTimer=0,dcWatch=0,dcGeneration=0,highlightMaterials=[],highlightKey=null,windNarration=false,zincNarration=false;
  function setTourHighlight(key){if(key===highlightKey)return;for(const [o,m]of highlightMaterials){o.material.dispose();o.material=m;}highlightMaterials=[];highlightKey=key;if(key!=='line')return;
    const line=scene.getObjectByName('Physical connection trans');if(line)line.traverse(o=>{if(o.isMesh&&o.material&&!Array.isArray(o.material)){const old=o.material;o.material=old.clone();if(o.material.emissive){o.material.emissive.setHex(0x936019);o.material.emissiveIntensity=.35;}highlightMaterials.push([o,old]);}});
  }
  function equipmentHint(key){
  const product=window.NZ_TOUR_SCRIPT.products[key];
  return product ? product.hint || ('关键装备：'+product.title) : '';
}
function paintNarration(){if(!tour.active)return;const c=TOUR[tour.chap],inside=tour.dcWait&&!tour.closing?tour.insideTime:null,total=N.globalTime(NARRATION,tour.chap,tour.t,inside,tour.dcDone),row=NARRATION.timeline.find(r=>total>=r.globalStart&&total<r.globalEnd)||NARRATION.timeline.at(-1),key=row.equipment||null,caption=N.captionAt?N.captionAt(NARRATION,total):row;
    $('tourChap').textContent=String(tour.chap+1).padStart(2,'0')+' / 08';$('tourTitle').textContent=c.title;$('tourText').textContent=(caption||row).text;$('tourBar').dataset.caption=(caption||row).id;
    $('tourTime').textContent=N.clock(total)+' / '+N.clock(TOUR_TOTAL);$('tourProg').style.width=(Math.min(1,total/TOUR_TOTAL)*100).toFixed(2)+'%';
    $('tourCueType').textContent=row.kind==='transition'?'章节衔接':row.scope==='building'?'楼内探索 · '+row.title:row.kind==='equipment'?'关键节点装备':'园区讲解';
    const signature=(key||'')+'|'+(row.mode||'');if($('tourEquipment').dataset.signature!==signature){$('tourEquipment').dataset.signature=signature;$('tourEquipment').textContent=equipmentHint(key);$('tourEquipment').hidden=!key;}
    $('tourBar').dataset.cue=row.id;$('tourBar').classList.toggle('tour-paused',tour.paused);tour.cue=row.id;
    setTourHighlight(row.focus||null);
    const group=c.group,context=row.shot==='solar'?'solar':row.focus==='charge'?'public':({generation:'wind',power:'energy',hydrogen:'chemical',loads:'factory'})[group]||group;
    const labels=({overview:['wind','solar','substation','dc','nh3','factory','smr'],generation:row.shot==='solar'?['solar']:['windNacelle'],power:['substation','line','storage'],storage:['storage'],compute:['dc','token','cooling'],hydrogen:['metal','nh3','pem'],loads:['factory','supercharge','panamaSc'],nuclear:['smr'],backup:['genset']})[group]||['dc'];
    const metrics=group==='compute'?[{label:'IT 负载',value:f1(S.itMW),unit:'MW',note:'本次参观前的模型快照'},{label:'供电入口',value:f1(S.dcLoadMW),unit:'MW'},{label:'业务计量',value:'等效推理产出估算',note:'非实测吞吐或实际交易收入'}]:group==='generation'?[{label:row.shot==='solar'?'光伏出力':'风电出力',value:f1(row.shot==='solar'?S.solarMW:S.windMW),unit:'MW',note:'本次参观前的模型快照'},{label:'本章重点',value:row.shot==='solar'?'光伏汇集与配套供电':'机舱干式变压器',note:'关键产品与供电关系'}]:group==='hydrogen'?[{label:'园区功能',value:'化工与电冶金',note:'生产、供电与储运配套'},{label:'调节范围',value:'遵守生产边界',note:'协同方案能力；不表示任意启停'}]:[{label:'本章重点',value:c.title,note:'设备结构与能源关系示意'}];
    window.NZ_VISITOR_VIEW.update({owner:'tour',title:c.title,lookKey:row.shot==='solar'?'solar':group,context,labels,flows:group==='overview'?[]:group==='compute'?['power','data','cooling']:group==='hydrogen'?['power','process','control']:['power','control'],metrics,scope:group==='overview'?'关键产品与系统方案能力':key?'西比里关键产品展示':'园区设施与系统方案'});
  }
  function applyTourFrame(){const c=TOUR[tour.chap],cue=N.at(c,tour.t),isWind=cue.shot==='windClose'||cue.shot==='windWide';
    if(window.NZ_FACTORY)window.NZ_FACTORY.tour(cue.factoryRoof?{mode:cue.factoryMode||'process',open:cue.factoryRoof==='open',paused:tour.paused}:null);
    if(isWind!==windNarration){windNarration=isWind;window.NZ_WIND_PRODUCT.tour(isWind?'windProduct':null);}if(isWind)window.NZ_WIND_PRODUCT.tourTime(tour.t);
    const isZinc=cue.focus==='zinc';if(isZinc!==zincNarration){zincNarration=isZinc;window.NZ_LAYOUT.selection(isZinc?'panamaZn':null);}
    window.NZ_FLOWS.context(cue.shot==='solar'?'solar':cue.focus==='charge'?'public':({generation:'wind',power:'energy',hydrogen:'chemical',loads:'factory'})[c.group]||c.group);
    const p=narratedPoseAt(tour.chap,tour.t);camera.position.fromArray(p.pos);controls.target.fromArray(p.tgt);tour.lastTo=new THREE.Vector3(...p.pos);paintNarration();
  }
  function startDcSegment(from,to){const D=window.GOBI_DCDT;if(!D||tour.dcWait)return false;clearTimeout(dcTimer);clearInterval(dcWatch);const generation=++dcGeneration;tour.dcWait=true;tour.insideTime=from;tour.closing=false;paintNarration();let activeSeconds=0,lastWatch=Date.now();
    D.reveal(from).then(ok=>{if(!ok||generation!==dcGeneration||!tour.active){if(generation===dcGeneration&&tour.active)endDcSegment(true);return;}D.playSegment(from,to);D.setPlaying(!tour.paused);dcWatch=setInterval(()=>{if(generation!==dcGeneration)return;const now=Date.now();if(!tour.paused)activeSeconds+=(now-lastWatch)/1000;lastWatch=now;if(D.segmentProgress()>=.999||!D.isOpen()||activeSeconds>(to-from)*1.5+DC_SEG.maxWait)endDcSegment(true);},100);});return true;
  }
  function endDcSegment(advance){clearTimeout(dcTimer);clearInterval(dcWatch);dcTimer=dcWatch=0;const generation=++dcGeneration,D=window.GOBI_DCDT,wasWaiting=tour.dcWait;
    if(advance&&wasWaiting&&tour.active){tour.insideTime=DC_SEG.to;tour.closing=true;const closed=D?D.close():Promise.resolve();closed.then(()=>{if(generation!==dcGeneration||!tour.active)return;tour.dcWait=false;tour.dcDone=true;tour.closing=false;tour.t=DC_SEG.at;paintNarration();});}
    else{tour.dcWait=false;tour.closing=false;if(D)D.close();}
  }
  function startTour(){if(window.NZ_RECEPTION.isActive()){window.NZ_RECEPTION.stop().then(startTour);return;}if(window.NZ_CLOUD_VISIT.isOpen())window.NZ_CLOUD_VISIT.close();window.NZ_VISITOR_VIEW.enter({owner:'tour',freeze:true});closeInfo();endDcSegment(false);cancelTween();Object.assign(tour,{active:true,chap:0,t:0,paused:false,dcDone:false,insideTime:0});controls.enabled=false;controls.autoRotate=false;$('btnAutoRot').textContent='环绕：关';$('btnAutoRot').classList.remove('primary');$('tourBar').classList.add('on');$('btnTour').textContent='云参观 ▾';enterChapter(0);}
  function enterChapter(i){if(tour.active)cancelTween();if(tour.dcWait||dcTimer||dcWatch)endDcSegment(false);tour.chap=clamp(i,0,TOUR.length-1);tour.t=0;tour.dcDone=false;tour.insideTime=0;tour.closing=false;window.NZ_VISUAL.tourChapter(tour.chap);windNarration=TOUR[tour.chap].id==='windProduct';$('tourPause').textContent=tour.paused?'继续':'暂停';applyTourFrame();if(TOUR[tour.chap].id==='energy'||tour.chap===DC_SEG.chap)window.GOBI_DCDT.prepare();}
  function tourTick(dtR){if(!tour.active)return;if(tour.dcWait){if(!tour.closing){try{const child=$('dcdtFrame').contentWindow.NZ_BUILDING_TOUR;if(child)tour.insideTime=clamp(child.state().time,DC_SEG.from,DC_SEG.to);}catch(e){}paintNarration();}return;}if(tour.paused)return;const c=TOUR[tour.chap],next=Math.min(c.dur,tour.t+dtR);
    if(tour.chap===DC_SEG.chap&&!tour.dcDone&&next>=DC_SEG.at){tour.t=DC_SEG.at;applyTourFrame();startDcSegment(DC_SEG.from,DC_SEG.to);return;}
    tour.t=next;applyTourFrame();if(tour.t>=c.dur){if(tour.chap===TOUR.length-1){exitTour();window.NZ_VISITOR_VIEW.endPage({kind:'full'});return;}enterChapter(tour.chap+1);}
  }
  function tourJump(i){if(!tour.active)return;if(i<0){enterChapter(0);return;}if(i>=TOUR.length){exitTour();return;}enterChapter(i);}
  function tourSeek(t){if(!tour.active||tour.dcWait)return false;const c=TOUR[tour.chap];tour.t=clamp(t,0,c.dur);if(tour.chap===DC_SEG.chap)tour.dcDone=tour.t>=DC_SEG.at;applyTourFrame();return true;}
  function toggleTourPause(){tour.paused=!tour.paused;if(window.NZ_FACTORY&&tour.active){const cue=N.at(TOUR[tour.chap],tour.t);window.NZ_FACTORY.tour(cue.factoryRoof?{mode:cue.factoryMode||'process',open:cue.factoryRoof==='open',paused:tour.paused}:null);}$('tourPause').textContent=tour.paused?'继续':'暂停';$('tourBar').classList.toggle('tour-paused',tour.paused);if(tour.dcWait&&window.GOBI_DCDT)window.GOBI_DCDT.setPlaying(!tour.paused);}
  function exitTour(){if(!tour.active)return;tour.active=false;if(window.NZ_FACTORY)window.NZ_FACTORY.tour(null);window.NZ_WIND_PRODUCT.tour(null);windNarration=false;zincNarration=false;window.NZ_LAYOUT.selection(null);setTourHighlight(null);endDcSegment(false);$('tourBar').classList.remove('on');$('btnTour').textContent='云参观 ▾';$('tourProg').style.width='0%';controls.enabled=true;window.NZ_VISITOR_VIEW.exit('tour');}

  /* ------------------------------------------------------------------ */
  /* 14. 启动                                                           */
  /* ------------------------------------------------------------------ */
  let postObj = null;

  /* ---------------- 图形上下文：丢失 / 恢复 ----------------
   * 只在最外层画布上监听。丢失时：暂停物理、挂常驻提示、停止提交渲染；
   * 恢复时：撤掉提示、解除暂停并提示已恢复。不做资源重建（Three.js 自己会重建
   * 纹理/缓冲，本版没有需要手工重放的自定义 RenderTarget —— 泛光那套在
   * 恢复后由 post.resize() 重新分配）。 */
  function watchGLContext() {
    const cv = renderer && renderer.domElement;
    if (!cv || !cv.addEventListener) return;
    cv.addEventListener('webglcontextlost', ev => {
      ev.preventDefault();
      contextLost = true;
      wasRunningBeforeContextLoss = S.running;
      S.running = false;
      document.body.classList.add('ctx-lost');
      if (window.console) console.warn('[GobiLight-NetZero] webglcontextlost：渲染已暂停');
    }, false);
    cv.addEventListener('webglcontextrestored', () => {
      contextLost = false;
      document.body.classList.remove('ctx-lost');
      if (postObj) postObj.contextRestored();
      sunL.shadow.map = null;
      /* resizeAll() 内部会把泛光的渲染目标按当前像素比重建（postObj.size）。 */
      resizeAll();
      S.running = wasRunningBeforeContextLoss;
      toast('图形上下文已恢复，渲染继续。', 'warn');
      if (window.console) console.log('[GobiLight-NetZero] webglcontextrestored：渲染继续');
    }, false);
  }
  let wasRunningBeforeContextLoss = true;

  function boot() {
    /* 后期：先建对象，能否启用由画质档决定 */
    try {
      postObj = window.NZPost.create(renderer, scene, camera);
      postObj.setParams({ threshold: 1.1, knee: .4, strength: .16, radius: 1.0, vignette: .025, ao: true });
    } catch (e) {
      postObj = null;
      if (window.console) console.warn('[premium] 后期层不可用，已直出渲染：', e && e.message);
    }

    buildLegend();
    buildScenarioSelect();
    buildTicker();
    buildDevTree();
    buildPolicy();
    bindControls();
    watchGLContext();
    window.NZ_VISUAL.ready(window.__NZ_TEST);
    window.NZ_FACTORY.ready(window.__NZ_TEST);
    window.NZ_VEHICLES.ready(window.__NZ_TEST);

    /* 启动参数 */
    E.reset({ scenario: S.scenario, region: S.region, seed: S.seed });
    events.length = 0;
    for (const ev of L.events.slice(-30)) events.push(ev);
    eventsDirty = true;
    syncScenarioSelect();

    applyQuality(null);
    setMode(S.mode || 'exhibit');
    refreshQualitySeg();
    $('selSpeed').value = String(S.timeScale);
    $('btnRun').textContent = S.running ? '⏸ 暂停' : '▶ 运行';
    $('btnRun').classList.toggle('primary', !!S.running);

    /* 首屏 */
    resizeAll();
    refreshParams();
    updateSummary(); updateLegend(); updateDash(); updateDevTree(); updateLedger(); updateEvents();

    window.NZ_VISITOR_VIEW.ready(window.__NZ_TEST);
    window.NZ_CLOUD_VISIT.ready(window.__NZ_TEST);
    window.NZ_RECEPTION.ready(window.__NZ_TEST);

    /* 交互提示自动淡出（减少动态模式下立即隐藏） */
    const hint = $('camHint');
    if (S.reduceMotion) hint.style.display = 'none';
    else setTimeout(() => { hint.style.opacity = '0'; }, 7000);

    requestAnimationFrame(loop);

    if (window.console) {
      console.log('[GobiLight-NetZero] v' + CFG.version + ' 启动完成｜步长 ' + CFG.TIME.stepSeconds +
        ' s｜画质 ' + S.quality + '｜泛光 ' + (postObj && postObj.enabled ? '开' : '关'));
    }
  }

  /* 浏览器冒烟/性能测试接口（不参与业务逻辑） */
  window.__NZ_TEST = {
    cfg: CFG, engine: E, S, K, L, REGIONS, THREE,
    scene, camera, renderer, controls,
    render, updateLabels3D, lightState, lampLevel,
    press(id) { const el = $(id); if (!el) return false; el.click(); return true; },
    drawer(tab) { openDrawer(tab || 'params'); },
    closeDrawer, closeInfo, resize: resizeAll,
    refreshPresentation() {
      $('btnRun').textContent = S.running ? '⏸ 暂停' : '▶ 运行';
      $('btnRun').classList.toggle('primary', !!S.running);
      $('selSpeed').value = String(S.timeScale);
      $('btnAutoRot').textContent = controls.autoRotate ? '环绕：开' : '环绕：关';
      $('btnAutoRot').classList.toggle('primary', !!controls.autoRotate);
      updateDash(); if (typeof updateLabels3D === 'function') updateLabels3D();
    },
    setMode, applyScenario, startTour, exitTour, tourJump, toggleTourPause,
    focus: focusDevice, exportData, cancelCamera: cancelTween,
    dcdt: window.GOBI_DCDT,
    TOUR_HOME, TOUR, TOUR_PACING, NARRATION, narratedPoseAt, windPoseAt, energyPoseAt, energyTravelProgress, tourSeek, paintNarration, tourTick, tourState:()=>({...tour,lastTo:tour.lastTo?tour.lastTo.toArray():null}),
    DC_SEG, startDcSegment, endDcSegment, dcWaiting: () => tour.dcWait,
    post: () => postObj,
    contextLost: () => contextLost,
    perf: () => ({
      fps: perf.fps, worstFps: perf.worstFps === Infinity ? null : perf.worstFps,
      samples: perf.samples.slice(-10), renderMs: perf.renderMs,
      /* 泛光开启时 renderer.info 读到的只是最后一遍合成（draws=1），
       * 场景通道的绘制量由 post 在渲染场景后单独记录。 */
      draws: (postObj && postObj.enabled && postObj.sceneDraws) ? postObj.sceneDraws : renderer.info.render.calls,
      triangles: (postObj && postObj.enabled && postObj.sceneTriangles) ? postObj.sceneTriangles : renderer.info.render.triangles,
      lastPassDraws: renderer.info.render.calls,
      quality: S.quality, pixelRatio: DPR, vw: VW, vh: VH,
      ao: !!(postObj && postObj.enabled && postObj.ao),
      environment: window.NZ_ENVIRONMENT && window.NZ_ENVIRONMENT.audit(),
      bloom: !!(postObj && postObj.enabled && postObj.bloom)
    }),
    state: () => ({
      simTime: S.simTime, day: S.day, soc: S.soc, h2Kg: S.h2Kg, region: S.region,
      scenario: S.scenario, running: S.running, timeScale: S.timeScale,
      residualMW: S.lastResidualMW, h2ResidualKg: S.lastH2ResidualKg,
      converged: S.solverConverged, steps: S.steps, events: events.length,
      policy: CFG.POLICY.status, mode: S.mode, lightPreset: S.lightPreset,
      labels: Object.keys(LABELS3D).length, devices: DEVICES.length, edges: EDGES.length
    }),
    stepSeconds(n) { return E.advance(n); },
    snapshot: () => E.snapshot(),
    ledger: () => E.exportLedger()
  };

  boot();
})();
