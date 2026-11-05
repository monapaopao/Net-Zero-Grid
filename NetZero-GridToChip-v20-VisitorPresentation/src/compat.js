/* =====================================================================
 * 戈壁之光 · 零碳能量中枢 —— 内核与表现层的兼容层 compat.js
 * v1.0.0
 *
 * 载入顺序：config → engine → 【compat】 → labels → legacy-pres → bridge → legacy-scene → premium
 *
 * 本层只做一件事：把新内核的状态暴露成原表现层使用的全局名（S / K / REGIONS /
 * clamp / fmt / $ / sunGeometry），使原场景代码（设备建模、灯光、标签）
 * 不用改写即可复用。物理核算完全在新内核 engine.js 内，兼容层不含任何计算。
 * ===================================================================== */
'use strict';
(function () {
  const CFG = window.NZ_CONFIG;
  const engine = window.NZEngine.createEngine(CFG);

  /* 原表现层引用的全局名（值来自新内核，不重复定义物理量） */
  window.NZ_ENGINE = engine;
  window.S = engine.S;                 // 单一状态快照
  window.K = engine.K;                 // 设备常量（沿用原名，供原场景读取）
  window.REGIONS = CFG.REGIONS;
  window.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  window.fmt = function (v, d) { return Number(v).toFixed(d == null ? 1 : d); };
  window.$ = function (id) { return document.getElementById(id); };

  /* 光照几何：原表现层（pres.js 的 lightState / lampLevel、scene3d 的地区标记）
   * 需要这个函数；与内核的日照模型同源，避免两套几何。 */
  window.sunGeometry = function (simTime, R) {
    const hour = (simTime % 86400) / 3600;
    const rise = 12 - R.dayLen / 2;
    const frac = (hour - rise) / R.dayLen;
    const elev = Math.sin(Math.PI * frac);
    return { hour, frac, elev };
  };

  /* 告警接口：原表现层未使用，但事件驱动界面需要（转发内核事件）。
   *
   * ⚠️ 这里**必须有上限**。这个队列只写给外部调试看（仓库里没有任何读取方），
   * 而内核告警在 240× 倍速下每秒会推十几条：早先只有 push、没有上限，
   * 长稳测试实测 5 分钟攒到 8751 条，10 分钟堆占用上涨约 2.5 MB 且不回落，
   * 那条缓慢上升就是它。只保留最近 200 条。
   * 真正驱动界面的订阅在 premium.js（E.onEvent(pushEvent)），它自带 400 条上限。 */
  window.__NZ_EVENT_QUEUE = [];
  engine.onEvent(function (ev) {
    const q = window.__NZ_EVENT_QUEUE;
    q.push(ev);
    if (q.length > 200) q.splice(0, q.length - 200);
  });
})();
