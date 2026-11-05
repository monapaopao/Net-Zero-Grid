/* =====================================================================
 * 戈壁之光 · 零碳能量中枢 —— 单文件构建
 * GobiLight-NetZero  v1.3.5
 *
 *   node build.cjs              构建 dist/Net-Zero-grid-premium.html
 *   node build.cjs --verify     构建后做一次离线自包含体检
 *
 * 设计原则
 *   · 原始文件 original/Net-Zero-grid-simulation-20260722.html 只读，
 *     永不改写；每次构建都从它重新提取，保证可复现。
 *   · three.js / OrbitControls / 场景建模三段体量最大的代码直接取自原文件，
 *     只做「用介质色画管线」「把主渲染循环交还给 premium 层」两类最小改动；
 *     每处改动都断言"恰好命中 1 次"，不做静默替换。
 *   · 产物不引用任何外部资源（无 CDN、无字体文件、无贴图文件），
 *     双击即可离线打开。
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const ORIGINAL = path.join(ROOT, 'original', 'Net-Zero-grid-simulation-20260722.html');
const SRC = path.join(ROOT, 'src');
const tourContent=JSON.parse(fs.readFileSync(path.join(ROOT,'导览文案.json'),'utf8'));
fs.writeFileSync(path.join(SRC,'vendor','dcdt-v11','tour-content.js'),'window.NZ_TOUR_SCRIPT='+JSON.stringify(tourContent)+';\n','utf8');
if(tourContent.campus.length!==8||tourContent.building.length!==22||!tourContent.campus.every(c=>typeof c.id==='string'&&typeof c.group==='string'&&typeof c.title==='string'&&typeof c.text==='string')||!tourContent.building.every(c=>typeof c.title==='string')||!['enterDc','returnDc'].every(k=>typeof tourContent.messages[k]==='string'))throw Error('导览文案结构不完整');
require('./scripts/export-tour-text.cjs')(ROOT,tourContent);
const receptionContent=JSON.parse(fs.readFileSync(path.join(ROOT,'三分钟接待文案.json'),'utf8'));
require('./scripts/export-reception-text.cjs')(ROOT,receptionContent);
require('./scripts/export-cloud-text.cjs')(ROOT);
const logoURI='data:image/svg+xml;base64,'+fs.readFileSync(path.join(ROOT,'assets/XIBILI_Logo_Primary_DeepTeal_V1.2.svg')).toString('base64');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(DIST, 'Net-Zero-grid-premium.html');

const log = (...a) => console.log(...a);

/* ------------------------------------------------------------------ */
/* 1. 从原始单文件中切出 6 段内联脚本                                   */
/* ------------------------------------------------------------------ */
function extractScripts(html) {
  const out = [];
  const re = /<script\b[^>]*>/g;
  let m;
  while ((m = re.exec(html))) {
    const start = m.index + m[0].length;
    const end = html.indexOf('</script>', start);
    if (end < 0) throw new Error('内联脚本未闭合');
    out.push({ start, end, code: html.slice(start, end) });
    re.lastIndex = end;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 2. 定点补丁：断言每条恰好命中 1 次                                   */
/* ------------------------------------------------------------------ */
function patch(name, src, pairs) {
  let out = src;
  pairs.forEach(([from, to], i) => {
    const n = out.split(from).length - 1;
    if (n !== 1) {
      throw new Error(`[${name}] 补丁 #${i + 1} 命中 ${n} 次（应为 1）\n---\n${from.slice(0, 260)}`);
    }
    out = out.replace(from, to);
  });
  return out;
}

/* --- 2a. pres.js：粒子池容量按边线可配（数据流用更少的粒子） --------- */
const PRES_PATCHES = [
  ['LAMPS2D.push([87.5, 131.5], [102.5, 131.5]);', 'LAMPS2D.push([87.5, 151.5], [102.5, 151.5]);'],
  /* v1.3.1：默认总览机位按甲方给的参考截图重新标定（俯角 37°、园区约占画面 64%×66%）。
   * 反推办法：量参考图里"园区地面"的外接框占画面比例，再在"俯角 / 距离"两个维度上试拍对齐。
   * 想恢复原始机位：pos 改回 [202, 132, 218]。 */
  [
    `const CAM_DEF = { pos: [202, 132, 218], tgt: [42, 0, 46] };`,
    `const CAM_DEF = { pos: [163, 134, 172], tgt: [42, 0, 46] };`
  ],
  [
    `    const target = Math.min(PART_CAP, Math.round(ap * 0.55));`,
    `    /* 数据流等细语义边线可用 e.partCap 单独限流（见 bridge.js） */
    const target = Math.min(e.partCap || PART_CAP, Math.round(ap * 0.55));`
  ],
  [
    `    const vel = (0.10 + 0.30 * Math.min(1, ap / 30)) * dtR;`,
    `    const vel = (0.10 + 0.30 * Math.min(1, ap / 30)) * dtR * (e.dataFlow ? 0.55 : 1);`
  ]
];

/* --- 2b. scene3d.js：管线按介质上色 + 交出主渲染循环 ------------------ */
const SCENE_PATCHES = [
  ["const F = { x0: -10, x1: 200, z0: -40, z1: 130 };", "const F = { x0: -10, x1: 214, z0: -40, z1: 150 };"],
  ["rail(210, 95, y, F.z0);", "rail(224, 102, y, F.z0);"],
  ["rail(98, 151, y, F.z1);", "rail(112, 158, y, F.z1);"],
  ["railZ(170, F.x0, y, 45); railZ(170, F.x1, y, 45);", "railZ(190, F.x0, y, 55); railZ(190, F.x1, y, 55);"],
  ["meshP(210, 95, F.z0, 0);", "meshP(224, 102, F.z0, 0);"],
  ["meshP(98, 151, F.z1, 0);", "meshP(112, 158, F.z1, 0);"],
  ["meshP(170, F.x0, 45, Math.PI / 2); meshP(170, F.x1, 45, Math.PI / 2);", "meshP(190, F.x0, 55, Math.PI / 2); meshP(190, F.x1, 55, Math.PI / 2);"],
  ["addLabel('gate', [95, 5.8, 130]", "addLabel('gate', [95, 5.8, 150]"],
  ["bush(196.5, z +", "bush(210.5, z +"],
  ["127.2, 0.8 + rndT()", "147.2, 0.8 + rndT()"],
  ["/* ---------------- 园区植被（白杨/圆冠树/灌木绿篱/荒漠梭梭） ---------------- */", "/* Keep the guardhouse, sign and flag together with the expanded south gate. */\nfor (const o of scene.children) {\n  if (o.position.x >= 75 && o.position.x <= 110 && o.position.z >= 126 && o.position.z < 130) o.position.z += 20;\n}\n/* ---------------- 园区植被（白杨/圆冠树/灌木绿篱/荒漠梭梭） ---------------- */"],
  [
    `for (const e of EDGES) {
  if (e.pipe) tubeAlong(e.pts, 0.16, 0x3a4650);
  else tubeAlong(e.pts, 0.07, 0x46525e, 0.9);`,
    `for (const e of EDGES) {
  /* 管线与粒子共用同一介质色（桥接层按 电/氢/氨/数据/外购/核电 写入
   * tubeColor）：避免出现"管是灰的、粒子是彩的"的语义断裂。
   * 数据流用更细的线径与更低的透明度，与电力流在视觉上区分开。 */
  if (e.dataFlow) tubeAlong(e.pts, 0.045, e.tubeColor || 0x9BCEF5, 0.55);
  else if (e.pipe) tubeAlong(e.pts, 0.16, e.tubeColor || 0x3a4650);
  else tubeAlong(e.pts, 0.07, e.tubeColor || 0x46525e, 0.9);`
  ],
  [
    `  const pm = new THREE.PointsMaterial({ color: e.color || 0xdfa45c, size: 0.55,`,
    `  const pm = new THREE.PointsMaterial({ color: e.color || 0xdfa45c, size: e.dataFlow ? 0.34 : 0.55,`
  ],
  /* --- 2b-2. 门牌与园区标牌去专名 -----------------------------------
   * 原文件在门牌、园区立牌与集装箱标牌上写了具体园区名。本版统一改成
   * xibili 品牌口径 —— 这三处是画进画布贴图的文字，改了会改画面，
   * 所以截图与互差都在新产物上重跑过。
   * 原文件本身仍然一个字节都不动。 */
  [
    `'甘泉堡零碳园区 · 访客/物流通道'`,
    `'多园区共享综合能源系统 · 数据中心入口'`
  ],
  [
    `'xibili 科技 · 甘泉堡示范园'`,
    `'西比里 能源 xibili energy'`
  ],
  [
    `'甘泉堡零碳园区 · 源网荷储氢一体化'`,
    `'多园区共享综合能源系统'`
  ],
  /* --- 2b-3. 去掉左上角那块会闪的「地区 · 昼夜」文字与日月弧 -----------
   * 那块文字是运行期动态注入到 #canvasWrap 的，位置 left:12px / top:10px，
   * 正好压在顶栏渐变层下面；又被 updateLabels3D() 每 0.25 秒重写一次
   * textContent，观感是持续闪烁。旁边的 132×84 弧线 canvas 由 premium 层
   * 每帧调用 drawArcInd() 重绘，同样压在那条渐变下面一起闪。
   * 同样的信息已改由屏幕最下方的信息流滚动播报（overlay.html 的 #ticker），
   * 因此把注入、每帧重绘与更新调用一并删除。 */
  [
    `/* 左上角地区/昼夜标记 + 日月弧指示（动态创建，沿用 v9 直观示意） */
const regionMark = document.createElement('div');
regionMark.style.cssText = 'position:absolute;left:12px;top:10px;z-index:5;font-size:12px;color:rgba(217,210,197,.85);pointer-events:none;text-shadow:0 1px 3px rgba(0,0,0,.6);';
cv.parentElement.appendChild(regionMark);
const arcCv = document.createElement('canvas');
arcCv.width = 132; arcCv.height = 84;
arcCv.style.cssText = 'position:absolute;left:12px;top:28px;z-index:5;pointer-events:none;opacity:.9;';
cv.parentElement.appendChild(arcCv);`,
    `/* v1.0.2：原本在这里动态注入左上角的「地区 · 昼夜」文字与日月弧 canvas。
 * 前者压在顶栏渐变层下方、又被每 0.25 秒重写一次；后者被 premium 层每帧
 * 重绘 —— 两者合起来就是"顶部一直在闪"。已整体移除，同样的信息改由底部
 * 信息流 #ticker 滚动播报（见 overlay.html / premium.js 的 updateTicker）。 */`
  ],
  [
    `function drawArcInd(light) {
  const g = arcCv.getContext('2d');
  g.clearRect(0, 0, 132, 84);
  const cx = 66, cy = 74, R = 52;
  g.strokeStyle = 'rgba(217,210,197,.35)'; g.lineWidth = 1;
  g.beginPath(); g.arc(cx, cy, R, Math.PI, 2 * Math.PI); g.stroke();
  g.beginPath(); g.moveTo(cx - R - 8, cy); g.lineTo(cx + R + 8, cy); g.stroke();
  const gs = sunGeometry(S.simTime, REGIONS[S.region]);
  const sf = S.dayNight ? gs.frac : 0.5;
  if (!S.dayNight || gs.elev > -0.04) {
    const sx = cx - Math.cos(Math.PI * sf) * R, sy = cy - Math.sin(Math.PI * sf) * R;
    g.globalAlpha = clamp(light.wS, 0.1, 1);
    g.fillStyle = '#e8b873';
    g.beginPath(); g.arc(sx, sy, 8, 0, 7); g.globalAlpha *= 0.3; g.fill();
    g.globalAlpha = clamp(light.wS, 0.1, 1);
    g.beginPath(); g.arc(sx, sy, 4.5, 0, 7); g.fill();
    g.globalAlpha = 1;
  }
  const m = light.moon;
  if (S.dayNight && m.elev > 0.01) {
    const mx = cx - Math.cos(Math.PI * m.frac) * R, my = cy - Math.sin(Math.PI * m.frac) * R;
    g.globalAlpha = clamp(light.wM, 0.1, 1) * 0.9;
    g.fillStyle = '#cfd4dc';
    g.beginPath(); g.arc(mx, my, 6, 0, 7); g.fill();
    g.globalAlpha = 1;
  }
}

/* ---------------- 动画钩子 ---------------- */`,
    `/* ---------------- 动画钩子 ---------------- */`
  ],
  /* --- 2b-4. 电源名称：巴拿马 → 高压直流 ------------------------------ */
  [
    `/* 巴拿马电源厢（2N）+ 240V DC 母排 */`,
    `/* 高压直流电源厢（2N）+ 240V DC 母排 */`
  ],
  [
    `'◆ 巴拿马电源 2N'`,
    `'◆ 高压直流电源 2N'`
  ],
  [
    `addLabel('panamaDc', [115.5, 4.4, -8], '巴拿马电源',`,
    `addLabel('panamaDc', [115.5, 4.4, -8], '高压直流电源',`
  ],
  [
    `/* 巴拿马电源厢 ×2 */`,
    `/* 高压直流电源厢 ×2 */`
  ],
  [
    `addLabel(key, [x, 4.4, z], '◆ 巴拿马电源', out, '');`,
    `addLabel(key, [x, 4.4, z], '◆ 高压直流电源', out, '');`
  ],
  /* --- 2b-5. 那块文字在 updateLabels3D() 里的写入也一并去掉 ------------
   * 这两行（取光态 + 写 textContent）随上面那块一起移除；函数到这里就结束了。 */
  [
    `  const light = lightState();
  regionMark.textContent = \`\${REGIONS[S.region].name} · \${light.night ? '☾ 夜间' : '☀ 白天'}\`;
}`,
    `}`
  ]
];

/* 主渲染段起点：从这里到文件末尾整体交给 premium.js 接管
 * （原 render()、skyNight/fogNight 常量、两个 DOM 绑定都在其中） */
const RENDER_SECTION_MARK = `/* ---------------- 主渲染 ---------------- */`;

function retireLegacyVehicles(code) {
  code=code.replace("const g = new THREE.Group(); g.position.set(126.5, 0, 95);", "const g = new THREE.Group();g.name='Retired logistics truck';g.position.set(126.5, 0, 95);");
  const fire=code.indexOf('  /* 红色消防车（警灯闪烁） */'),sign=code.indexOf('  /* 警示牌',fire);
  if(fire<0||sign<0)throw Error('Missing legacy fire vehicle block');
  code=code.slice(0,fire)+'  // Anatomy supplies the standby fire appliance.\n'+code.slice(sign);
  const start=code.indexOf('  const guns = Math.round(S.sc / K.SC_GUN'),end=code.indexOf('  const spd = S.factory',start);
  if(start<0||end<0)throw Error('Missing legacy vehicle-colour ticker');
  code=code.slice(0,start)+'  // Retired occupancy blocks never encode charging.\n  for(const t of truckPool)t.visible=false;\n'+code.slice(end);
  return code.replace('车 ${S.trucks}/${K.SC_BAYS}', '等效负荷 ${S.trucks}/${K.SC_BAYS}');
}

function buildLegacyScene(sceneCode) {
  const cut = sceneCode.indexOf(RENDER_SECTION_MARK);
  if (cut < 0) throw new Error('[scene3d] 找不到主渲染段标记');
  const head = sceneCode.slice(0, cut);
  const dropped = sceneCode.slice(cut);
  /* 交出的内容必须确实是"主渲染 + 两个按钮绑定"，否则拒绝构建 */
  for (const must of ['function render(tNow, dtR)', "$('btnCamReset').addEventListener", "$('btnAutoRot').addEventListener"]) {
    if (dropped.indexOf(must) < 0) throw new Error('[scene3d] 待接管段落里缺少 ' + must);
  }
  if (head.indexOf('function render') >= 0) throw new Error('[scene3d] 保留段里仍有 render 定义');
  if (head.indexOf('function updateLabels3D') < 0) throw new Error('[scene3d] 保留段里丢了 updateLabels3D');
  return {
    code: patch('scene3d', head, SCENE_PATCHES)
      .replaceAll('电动重卡超充站','新能源超充站')
      .replace('/* ---------------- 园区围栏 + 入口大门 ---------------- */', 'const v9FenceBefore = new Set(scene.children);\n/* ---------------- 园区围栏 + 入口大门 ---------------- */')
      .replace('/* 入口大门（南侧 x 90–100）：门柱 + 横梁 + 发光标牌 + 门卫亭 */', 'for (const o of scene.children) if (!v9FenceBefore.has(o)) o.userData.retiredCampusFence = true;\n/* 入口大门（南侧 x 90–100）：门柱 + 横梁 + 发光标牌 + 门卫亭 */')
      .replace(/data:image\/png;base64,[A-Za-z0-9+/=]+/g, logoURI)
      .replace("g.fillText('零碳园区', 856, 152);","g.fillText('多园区共享综合能源系统', 856, 152, 700);")
      .replace("g.font = 'bold 118px","g.font = 'bold 64px"),
    droppedBytes: Buffer.byteLength(dropped, 'utf8')
  };
}

/* ------------------------------------------------------------------ */
/* 3. 组装                                                             */
/* ------------------------------------------------------------------ */
function read(p) { return fs.readFileSync(p, 'utf8'); }

function main() {
  fs.mkdirSync(path.join(ROOT,'evidence'),{recursive:true});
  require('./scripts/export-cloud-text.cjs')(ROOT,require('./src/cloud-visit-content.js'));
  if (!fs.existsSync(ORIGINAL)) throw new Error('缺少原始文件：' + ORIGINAL);
  const original = read(ORIGINAL);

  const segs = extractScripts(original);
  if (segs.length !== 6) throw new Error(`原始文件应有 6 段内联脚本，实际 ${segs.length} 段`);
  const [THREE_SRC, ORBIT_SRC, KERNEL_SRC, PRES_SRC, SCENE_SRC, DASH_SRC] = segs.map(s => s.code);
  log('提取内联脚本 6 段：' + segs.map(s => Buffer.byteLength(s.code, 'utf8')).join(' / ') + ' 字节');

  /* 3a. 原样搬运（字节级一致，不做任何改写） */
  fs.writeFileSync(path.join(SRC, 'three.js'), THREE_SRC, 'utf8');
  fs.writeFileSync(path.join(SRC, 'orbit.js'), ORBIT_SRC, 'utf8');

  /* 3b. 表现层底座：pres.js 只补 partCap / dataFlow 两点 */
  const pres = patch('pres', PRES_SRC, PRES_PATCHES);
  fs.writeFileSync(path.join(SRC, 'legacy-pres.js'), pres, 'utf8');

  /* 3c. 场景建模：交出主渲染循环 */
  const scene = buildLegacyScene(SCENE_SRC);
  scene.code=retireLegacyVehicles(scene.code);
  scene.code=scene.code.replace('缺口：让路','柔性负荷压减').replace('欠账池 <b>${fmt(debt, 2)} MWh</b>','待完成：锌 ${fmt(S.debtZinc,1)} / 制造 ${fmt(S.debtFac,1)} MWh').replace('S.dCur / S.dGen * 100','S.dCur / (S.dGen + S.dCur) * 100');
  fs.writeFileSync(path.join(SRC, 'legacy-scene.js'), scene.code, 'utf8');
  log(`场景层：保留 ${Buffer.byteLength(scene.code, 'utf8')} 字节，交出主渲染段 ${scene.droppedBytes} 字节由 premium.js 接管`);

  /* 3d. 记下未使用的原内核（只在 evidence 里留证，不进产物） */
  fs.writeFileSync(path.join(ROOT, 'evidence', 'original-kernel.replaced.js'), KERNEL_SRC, 'utf8');
  fs.writeFileSync(path.join(ROOT, 'evidence', 'original-dashboard.replaced.js'), DASH_SRC, 'utf8');

  /* 3e. 载入顺序（premium 末尾会同步启动，因此 post 必须先行载入） */
  const ORDER = [
    ['three.js', THREE_SRC],
    ['color-management.js', 'THREE.ColorManagement.legacyMode = false;'],
    ['orbit.js', ORBIT_SRC],
    ['config.js', read(path.join(SRC, 'config.js'))],
    ['dispatch-tasks.js', read(path.join(SRC, 'dispatch-tasks.js'))],
    ['engine.js', read(path.join(SRC, 'engine.js'))],
    ['compat.js', read(path.join(SRC, 'compat.js'))],
    ['labels.js', read(path.join(SRC, 'labels.js'))],
    ['legacy-pres.js', pres],
    ['brand-logo.js', read(path.join(SRC, 'brand-logo.js'))],
    ['bridge.js', read(path.join(SRC, 'bridge.js'))],
    ['legacy-scene.js', scene.code],
    ['post.js', read(path.join(SRC, 'post.js'))],
    ['dcdt-app.js', (function () {
      /* 内置数据中心数字孪生应用（Hu 提供的 DataCenterDigitalTwin.zip）：三件套内联成
       * 一份完整 HTML，交给小窗里的 iframe 以 srcdoc 承载 —— 它自带 UI、五级下钻、
       * 六系统图层、175 秒导览与设备拆解，离线可跑（three.js r180 已内置）。 */
      /* v19: current authored building is vendor/dcdt-v11; older vendor versions remain archived. */
      const dir = path.join(SRC, 'vendor', 'dcdt-v11');
      let html;
      try {
        /* ⚠️ 替换值必须用**函数**：String.replace 的字符串替换值里 `$$` 表示一个字面 `$`，
         * 会把应用源码里的 `$$`（querySelectorAll 助手）削成 `$`，进而覆盖 `$` 导致
         * `$('#canvas-wrap')` 返回数组、`.appendChild is not a function`（踩过一次）。 */
        const cssSrc = read(path.join(dir, 'style.css'));
        const jsSrc = read(path.join(SRC,'sst-model.js'))+';\n'+read(path.join(SRC,'sst-three.js'))+';\n'+'window.NZ_TOUR_SCRIPT='+JSON.stringify(tourContent).replace(/</g,'\\u003c')+';\n'+read(path.join(dir, 'app.js'));
        /* The iframe and standalone preview share the complete authored interface:
         * header, both sidebars, viewport, typography and playback controls. */
        html = read(path.join(dir, 'index.html'))
          .replace('<link rel="stylesheet" href="style.css">', () => '<style>\n' + cssSrc + '\n</style>')
          .replace(/<script src="(?:tour-content.js|\.\.\/\.\.\/sst-model.js|\.\.\/\.\.\/sst-three.js)"[^>]*><\/script>/g, '')
          .replace('<script src="app.js" defer></script>', () => '<script>\n' + jsSrc + '\n</script>')
          ;
        fs.mkdirSync(DIST,{recursive:true});fs.writeFileSync(path.join(DIST,'数据中心独立预览.html'),html,'utf8');
      } catch (e) {
        log('✗ 内置数字孪生应用资源缺失：' + e.message);
        return 'window.NZ_DCDT_APP = "";';
      }
      log('内置数字孪生应用：内联 %d 字节（index.html + style.css + app.js）',
        Buffer.byteLength(html, 'utf8'));
      return 'window.NZ_DCDT_APP = ' + JSON.stringify(html).replace(/<\/script/g, '<\\/script') + ';';
    })()],
    ['tour-content.js', 'window.NZ_TOUR_SCRIPT='+JSON.stringify(tourContent).replace(/</g,'\\u003c')+';'],
    ['tour-narrative.js', read(path.join(SRC, 'tour-narrative.js'))],
    ['dcdt.js', read(path.join(SRC, 'dcdt.js'))],
    ['solar-site-plan.js', read(path.join(SRC, 'solar-site-plan.js'))],
    ['multi-campus-plan.js', read(path.join(SRC, 'multi-campus-plan.js'))],
    ['chemical-campus-plan.js', read(path.join(SRC, 'chemical-campus-plan.js'))],
    ['campus-layout.js', read(path.join(SRC, 'campus-layout.js'))],
    ['campus-infrastructure.js', read(path.join(SRC, 'campus-infrastructure.js'))],
    ['tower-model.js', read(path.join(SRC, 'tower-model.js'))],
    ['transmission-towers.js', read(path.join(SRC, 'transmission-towers.js'))],
    ['storage-model.js', read(path.join(SRC, 'storage-model.js'))],
    ['storage-anatomy.js', read(path.join(SRC, 'storage-anatomy.js'))],
    ['campus-detail.js', read(path.join(SRC, 'campus-detail.js'))],
    ['campus-environment-plan.js', read(path.join(SRC, 'campus-environment-plan.js'))],
    ['renewable-landscape-plan.js', read(path.join(SRC, 'renewable-landscape-plan.js'))],
    ['chemical-campus.js', read(path.join(SRC, 'chemical-campus.js'))],
    ['multi-campus.js', read(path.join(SRC, 'multi-campus.js'))],
    ['grid-to-chip.js', read(path.join(SRC, 'grid-to-chip.js'))],
    ['campus-environment.js', read(path.join(SRC, 'campus-environment.js'))],
    ['renewable-landscape.js', read(path.join(SRC, 'renewable-landscape.js'))],
    ['solar-site.js', read(path.join(SRC, 'solar-site.js'))],
    ['ecological-park.js', read(path.join(SRC, 'ecological-park.js'))],
    ['wind-anatomy.js', read(path.join(SRC, 'wind-anatomy.js'))],
    ['wind-product.js', read(path.join(SRC, 'wind-product.js'))],
    ['flow-renderer.js', read(path.join(SRC, 'flow-renderer.js'))],
    ['campus-flows.js', read(path.join(SRC, 'campus-flows.js'))],
    ['chemical-process-labels.js', read(path.join(SRC, 'chemical-process-labels.js'))],
    ['token-meter.js', read(path.join(SRC, 'token-meter.js'))],
    ['dispatch-ui.js', read(path.join(SRC, 'dispatch-ui.js'))],
    ['cloud-visit-content.js', read(path.join(SRC, 'cloud-visit-content.js'))],
    ['cloud-simulation.js', read(path.join(SRC, 'cloud-simulation.js'))],
    ['sst-model.js', read(path.join(SRC, 'sst-model.js'))],
    ['sst-three.js', read(path.join(SRC, 'sst-three.js'))],
    ['sst-simulation.js', read(path.join(SRC, 'sst-simulation.js'))],
    ['visitor-results.js', read(path.join(SRC, 'visitor-results.js'))],
    ['visitor-view.js', read(path.join(SRC, 'visitor-view.js'))],
    ['scenario-dashboard.js', read(path.join(SRC, 'scenario-dashboard.js'))],
    ['sst-visit.js', read(path.join(SRC, 'sst-visit.js'))],
    ['green-compute-view.js', read(path.join(SRC, 'green-compute-view.js'))],
    ['strategy-story.js', read(path.join(SRC, 'strategy-story.js'))],
    ['cloud-visit.js', read(path.join(SRC, 'cloud-visit.js'))],
    ['reception-content.js', 'window.NZ_RECEPTION_SCRIPT='+JSON.stringify(receptionContent)+';'],
    ['reception-model.js', read(path.join(SRC, 'reception-model.js'))],
    ['factory-line-model.js', read(path.join(SRC, 'factory-line-model.js'))],
    ['factory-anatomy.js', read(path.join(SRC, 'factory-anatomy.js'))],
    ['reception.js', read(path.join(SRC, 'reception.js'))],
    ['vehicle-model.js', read(path.join(SRC, 'vehicle-model.js'))],
    ['vehicles-anatomy.js', read(path.join(SRC, 'vehicles-anatomy.js'))],
    ['premium.js', read(path.join(SRC, 'premium.js'))]
  ];

  const css = ['premium.css','grid-to-chip.css','token-meter.css','cloud-visit.css','sst-visit.css','visitor-view.css'].map(file=>read(path.join(SRC,file))).join(String.fromCharCode(10));
  const overlay = read(path.join(SRC, 'overlay.html'));

  const body = ORDER.map(([name, code]) =>
    `<script>/* ===== ${name} ===== */\n${code}\n</script>`).join('\n');

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="generator" content="MultiCampus VisitorPresentation build v20.0.0">
<title>多园区共享综合能源系统 | 西比里能源 xibili energy · v20</title>
<!--
  单文件离线交付：模型、脚本、样式、字形全部内嵌，无任何外部请求。
  原始版本（未被本文件改写）：original/Net-Zero-grid-simulation-20260722.html
  参数边界与已知限制见同目录 README.md / VALIDATION.md。
-->
<style>
${css}
</style>
</head>
<body class="mode-exhibit">
${overlay}
${body}
</body>
</html>
`;

  fs.mkdirSync(DIST, { recursive: true });
  fs.writeFileSync(OUT, html, 'utf8');

  const bytes = fs.statSync(OUT).size;
  log('');
  log('产物：' + path.relative(ROOT, OUT));
  log('大小：' + bytes + ' 字节（' + (bytes / 1024 / 1024).toFixed(2) + ' MB）');
  log('脚本段：' + ORDER.map(o => o[0]).join(' → '));

  if (process.argv.includes('--verify')) verify(html);
}

/* ------------------------------------------------------------------ */
/* 4. 离线自包含体检（静态，不启动浏览器）                              */
/* ------------------------------------------------------------------ */
function verify(html) {
  const problems = [];
  const must = [
    ['无外部 script 引用', !/<script[^>]+src=/i.test(html)],
    ['无外部样式表引用', !/<link[^>]+stylesheet/i.test(html)],
    ['无 @import', !/@import/i.test(html)],
    ['无 http(s) 资源引用', !/(src|href)\s*=\s*["']https?:/i.test(html)],
    ['无 fetch/XHR 外部数据', !/fetch\s*\(\s*["']https?:/i.test(html)],
    ['含 canvas 挂载点', /id="gridCanvas"/.test(html)],
    ['含标签层', /id="labels3d"/.test(html)],
    ['含 Three.js', /THREE\.WebGLRenderer/.test(html)],
    ['含新内核', /NZEngine/.test(html)],
    ['含展厅交互层', /__NZ_TEST/.test(html)],
    ['含后期层', /NZPost/.test(html)],
    ['声明了文档编码', /charset="UTF-8"/.test(html)],
    ['显式标注未引用原始文件', /原始版本（未被本文件改写）/.test(html)]
  ];
  for (const [name, ok] of must) if (!ok) problems.push(name);

  /* 检查是否残留被替换掉的旧界面 id（这些元素已不存在于新 overlay） */
  const stale = ['id="side"', 'id="sparkCanvas"', 'id="mWind"', 'id="statusChip"'];
  for (const s of stale) if (html.indexOf(s) >= 0) problems.push('残留旧界面元素 ' + s);

  /* 标签 id 与高级层引用的一致性 */
  const ids = new Set();
  const re = /id="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) ids.add(m[1]);
  const needed = ['gridCanvas', 'labels3d', 'toast', 'drawer', 'devTree', 'tbFlow', 'tbCons', 'tbStock',
    'tbEmis', 'tbPlan', 'tbDays', 'evList', 'policyBox', 'srcList', 'boundList', 'infoCard', 'infoLive',
    'tourBar', 'tourProg', 'timeline', 'trendCanvas', 'lgItems', 'flexHud', 'fhChain', 'fhDebt', 'fhCur'];
  for (const n of needed) if (!ids.has(n)) problems.push('缺少界面节点 #' + n);

  log('');
  if (problems.length) {
    log('自包含体检：发现问题 ' + problems.length + ' 项');
    for (const p of problems) log('  ✗ ' + p);
    process.exitCode = 1;
  } else {
    log('自包含体检：' + must.length + ' 项断言全部通过（' +
      ids.size + ' 个 id，无外部依赖）');
  }
}

main();
