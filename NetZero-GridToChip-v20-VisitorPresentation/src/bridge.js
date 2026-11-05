/* =====================================================================
 * 戈壁之光 · 零碳能量中枢 —— 桥接层 bridge.js
 * GobiLight-NetZero  v1.0.0
 *
 * 载入顺序：config → engine → labels → legacy-pres → 【bridge】 → legacy-scene → premium
 * 本层在原场景几何构建之前完成三件事：
 *   1. 把能源边线按介质重新配色（电 / 氢 / 氨 / 数据 / 外购 / 核电），
 *      线路实体与粒子共用同一色值，避免"管是灰的、粒子是彩的"。
 *   2. 按介质配色后的边线补齐初始化字段（展链线、分段长度、粒子池）。
 *      v1.0.3：原先这里追加过两条「数据流示意线」（数据中心 → 园区），
 *      但它们的首尾都悬在半空、不接任何设备，被指出后已删除。
 *   3. 用展示光照预设替换 lightState / lampLevel，使"展厅光照"与仿真日夜解耦。
 * 不改动物理内核，也不改写原文件。
 * ===================================================================== */
'use strict';
(function () {
  const CFG = window.NZ_CONFIG;
  const PAL = CFG.PALETTE;
  const hex = h => parseInt(h.slice(1), 16);

  /* ------------------------------------------------------------------ */
  /* 1. 介质配色                                                        */
  /* ------------------------------------------------------------------ */
  const MEDIA = {
    power: { name: '电', color: hex(PAL.power), css: PAL.power },
    hydrogen: { name: '氢', color: hex(PAL.hydrogen), css: PAL.hydrogen },
    ammonia: { name: '氨', color: hex(PAL.ammonia), css: PAL.ammonia },
    grid: { name: '外购电', color: hex(PAL.grid), css: PAL.grid },
    nuclear: { name: '核电', color: 0xb9c9e8, css: '#B9C9E8' }
  };
  const EDGE_MEDIA = {
    h2gas: 'hydrogen', h2use: 'hydrogen', fc: 'hydrogen',
    nh3: 'ammonia',
    genset: 'grid',
    smr: 'nuclear'
  };

  for (const e of EDGES) {
    const m = MEDIA[EDGE_MEDIA[e.key] || 'power'];
    e.media = EDGE_MEDIA[e.key] || 'power';
    e.color = m.color;
    e.tubeColor = m.color;
    e.cssColor = m.css;
  }

  /* ------------------------------------------------------------------ */
  /* 2. 边线初始化兜底                                                  */
  /*    v1.0.3：原先在这里追加了两条「数据流示意线」（datacore / datapark，
   *    从数据中心往园区方向）。它们的起点与终点都在 y=12.5 的半空中、
   *    不接任何设备，画面上就是两根悬空的细蓝线，已整体删除（含图例里的
   *    「数据（虚线）」项）。原文件本身没有数据流边线，删掉不影响它。
   *    与 pres.js 的 EDGES 初始化保持一致：任何追加的边线都必须自带展链线
   *    展开、分段长度、粒子池与生成累加器，否则 edgePoint / drawParticles
   *    在首帧会因缺字段抛错。已初始化的原有边线跳过。 */
  for (const e of EDGES) {
    if (e.seg && e.parts) continue;
    if (e.sag) e.pts = expandSag(e.pts, e.sag);
    e.seg = []; e.len = 0;
    for (let i = 0; i < e.pts.length - 1; i++) {
      const a = e.pts[i], b = e.pts[i + 1];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      e.seg.push(l); e.len += l;
    }
    e.parts = []; e.spawnAcc = 0;
  }

  /* ------------------------------------------------------------------ */
  /* 3. 展示光照预设：与仿真日夜解耦                                     */
  /* ------------------------------------------------------------------ */
  const ORIGINAL_LIGHT_STATE = lightState;
  const ORIGINAL_LAMP_LEVEL = lampLevel;

  /* 展示光照的三段式方向光：主光(暖) / 侧后光(冷) / 环境 */
  function presetDirections(key) {
    /* 方向用归一化向量表示；y 为高度分量 */
    switch (key) {
      case 'blue-hour': return { sv: [-0.74, 0.20, 0.44], mv: [0.6, 0.5, -0.5] };
      case 'day-lab': return { sv: [-0.34, 0.86, 0.38], mv: [0.6, 0.5, -0.5] };
      case 'night': return { sv: [-0.74, -0.10, 0.44], mv: [0.55, 0.62, -0.45] };
      default: return null;
    }
  }
  function normalize3(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }

  lightState = function () {
    const presetKey = (S && S.lightPreset) || 'blue-hour';
    if (presetKey === 'follow') {
      const st = ORIGINAL_LIGHT_STATE();
      st.preset = 'follow';
      st.exhibitLighting = false;
      return st;
    }
    const P = CFG.LIGHT_PRESETS[presetKey] || CFG.LIGHT_PRESETS['blue-hour'];
    const dirs = presetDirections(presetKey);
    const g = sunGeometry(S.simTime, REGIONS[S.region]);
    const m = moonGeometry(S.simTime, REGIONS[S.region]);
    const night = presetKey === 'night';
    const elev = dirs.sv[1];
    return {
      preset: presetKey,
      exhibitLighting: !!P.exhibit,
      v: normalize3(dirs.sv),
      sv: dirs.sv, mv: dirs.mv,
      dl: night ? 0.0 : (presetKey === 'day-lab' ? 1.0 : 0.42),
      dusk: night ? 0 : (presetKey === 'blue-hour' ? 0.55 : 0),
      night: night ? 1 : 0,
      elev: elev, moon: m,
      wS: night ? 0 : 1, wM: night ? 1 : 0,
      /* 供 premium 层做分级调光使用 */
      keyColor: P.key, fillColor: P.fill, rimColor: P.rim,
      keyInt: P.keyInt, fillInt: P.fillInt, rimInt: P.rimInt,
      ambient: P.ambient, exposure: P.exposure,
      simHour: g.hour
    };
  };

  lampLevel = function () {
    const presetKey = (S && S.lightPreset) || 'blue-hour';
    if (presetKey === 'follow') return ORIGINAL_LAMP_LEVEL();
    const P = CFG.LIGHT_PRESETS[presetKey];
    return P.lamps == null ? 0 : P.lamps;
  };

  /* ------------------------------------------------------------------ */
  /* 3b. 地面与地平雾的配色修订（v1.0.7）                                */
  /*     默认地区（新疆）原先的地面是暖棕 [94,84,62]、日间雾是暖灰         */
  /*     [172,162,140]，叠上暖白阳光后整个白天偏黄。改成冷灰蓝：地面       */
  /*     [56,60,66]、日间雾 [146,156,170]；日间阳光色在 premium 层一起改。  */
  /*     黄昏与夜间仍按光照插值变化（见 premium 的 renderFollow）。       */
  /*     REGION_SKIN 是 legacy-pres.js 里的对象常量，就地改属性即可，      */
  /*     不必动原文件段。其余地区保留各自的原地貌色。                     */
  /* ------------------------------------------------------------------ */
  if (typeof REGION_SKIN === 'object' && REGION_SKIN.xinjiang) {
    REGION_SKIN.xinjiang.ground = [56, 60, 66];
    REGION_SKIN.xinjiang.skyBot = [146, 156, 170];
  }

  /* ------------------------------------------------------------------ */
  /* 3d. 品牌 logo：换成甲方 2026-09-20 给的新版（v1.3.2）                 */
  /*     场景里三处品牌贴图（旗面 / 灯箱牌面 / 立牌 logo）原本由           */
  /*     legacy-scene.js 的 loadLogoCanvas() 用**内嵌旧 base64** 异步绘制。*/
  /*     这里在场景就绪后，用 window.NZ_LOGO_URI（新 logo，见             */
  /*     brand-logo.js）**按原布局重绘**那几张 canvas 贴图 —— 只换 logo    */
  /*     本体，牌面配色与文案不动。旧绘制是异步的，所以分几个时间点重试，  */
  /*     最后一次为准；NZ_BRAND 作为只读状态暴露出去，便于测试与自检。     */
  /* ------------------------------------------------------------------ */
  const NZ_BRAND = { tries: 0, applied: 0, mint: 0, err: '' };
  window.NZ_BRAND = NZ_BRAND;

  function brandTargets() {
    const out = [];
    try {
      if (typeof flagMesh !== 'undefined' && flagMesh && flagMesh.material && flagMesh.material.map) {
        out.push({ t: flagMesh.material.map, kind: 'flag' });
      }
    } catch (e) { }
    try {
      if (typeof logoTex !== 'undefined' && logoTex) out.push({ t: logoTex, kind: 'logo' });
    } catch (e) { }
    try {
      scene.traverse(o => {
        const m = o.material;
        if (!m || !m.map || !m.map.image || !m.map.image.getContext) return;
        if (m.map.image.width === 1600 && m.map.image.height === 360) out.push({ t: m.map, kind: 'sign' });
      });
    } catch (e) { }
    return out;
  }

  function drawBrand(img) {
    let n = 0;
    for (const x of brandTargets()) {
      const c = x.t.image;
      if (!c || !c.getContext) continue;
      const g = c.getContext('2d'), W = c.width, H = c.height;
      if (x.kind === 'flag') {
        g.fillStyle = '#faf8f3'; g.fillRect(0, 0, W, H);
        const lw = Math.min(W - 60, (H - 40) * img.width / img.height), lh = lw * img.height / img.width;
        g.drawImage(img, (W - lw) / 2, (H - lh) / 2, lw, lh);
      } else if (x.kind === 'sign') {
        g.fillStyle = '#c8ced4'; g.fillRect(0, 0, W, H);
        g.strokeStyle = 'rgba(28,35,43,.28)'; g.lineWidth = 6;
        g.strokeRect(8, 8, W - 16, H - 16);
        const bw = 750, bh = 230;
        const sc = Math.min(bw / img.width, bh / img.height);
        const w2 = img.width * sc, h2 = img.height * sc;
        g.drawImage(img, 48 + (bw - w2) / 2, 66 + (bh - h2) / 2, w2, h2);
        g.fillStyle = '#1c232b';
        g.font = 'bold 64px "Microsoft YaHei", "PingFang SC", sans-serif';
        g.textBaseline = 'middle';
        g.fillText('多园区共享综合能源系统', 856, 152);
        g.fillStyle = '#3a4650';
        g.font = '44px "Microsoft YaHei", "PingFang SC", sans-serif';
        g.fillText('西比里 能源 xibili energy', 862, 266);
      } else {
        g.clearRect(0, 0, W, H);
        const sc = Math.min(W / img.width, H / img.height);
        g.drawImage(img, (W - img.width * sc) / 2, (H - img.height * sc) / 2, img.width * sc, img.height * sc);
      }
      x.t.needsUpdate = true;
      n++;
    }
    NZ_BRAND.applied = n;
    try {
      const t0 = brandTargets()[0];
      if (t0 && t0.t.image && t0.t.image.getContext) {
        const g = t0.t.image.getContext('2d');
        /* 扫**整张**画布：logo 在旗面/牌面里是居中偏右的，只取左上角会数不到薄荷色 */
        const d = g.getImageData(0, 0, t0.t.image.width, t0.t.image.height).data;
        let k = 0;
        for (let i = 0; i < d.length; i += 64) {
          if (d[i + 3] > 100 && d[i + 1] > 110 && d[i + 1] < 175 && d[i + 2] > 90 && d[i] < 140) k++;
        }
        NZ_BRAND.mint = k;
      }
    } catch (e) { }
    return n;
  }

  function applyBrandLogo() {
    NZ_BRAND.tries++;
    const uri = window.NZ_LOGO_URI;
    if (!uri) { NZ_BRAND.err = 'no-uri'; return false; }
    const img = new Image();
    img.onload = () => { try { drawBrand(img); } catch (e) { NZ_BRAND.err = String(e && e.message); } };
    img.onerror = () => { NZ_BRAND.err = 'img-error'; };
    img.src = uri;
    return true;
  }
  /* 旧 logo 是异步加载后绘制的，这里错开几个时间点重绘，最后一次为准 */
  [250, 800, 1800, 3200].forEach(ms => setTimeout(applyBrandLogo, ms));

  /* 暴露给 premium 层 */
  window.GOBI_BRIDGE = {
    MEDIA, EDGE_MEDIA,
    originalLightState: ORIGINAL_LIGHT_STATE,
    originalLampLevel: ORIGINAL_LAMP_LEVEL,
    palette: PAL
  };
})();
