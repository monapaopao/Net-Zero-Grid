
"use strict";
/* =====================================================================
 * v18 表现层：Three.js 3D 零碳园区场景（r147 UMD，内嵌单文件）
 * v18 调整：左键=平移拖动 / 右键=旋转（贴合地图操作习惯）；
 * 发电侧三回馈线改为架空线（杆塔 + 线高 8m + 弧垂），粒子流与实物线
 * 路完全重合；主干输电杆塔跨度加大（3 基）。
 * 世界坐标：米；X东/Z南/Y上；太阳光/月光方向光 + 阴影 + 星空 +
 * 路灯光晕 + HTML 悬浮设备标签。
 * ===================================================================== */
const MOBILE = (window.matchMedia && matchMedia('(max-width:1023px)').matches) || window.innerWidth < 700;
const PART_CAP = MOBILE ? 8 : 16;
const D2W = v => v / 10;                          // 兼容旧调用（新布局直接用世界米）

/* ---------------- 光照几何（与块1同源：sunGeometry 在块1） ---------------- */
function moonGeometry(simTime, R) {
  const nightLen = 24 - R.dayLen;
  const set = 12 + R.dayLen / 2;
  let h = (simTime % 86400) / 3600 - set;
  if (h < 0) h += 24;
  const frac = h / nightLen;
  return { frac, elev: Math.sin(Math.PI * frac) };
}
function lightState() {
  const R = REGIONS[S.region];
  const g = sunGeometry(S.simTime, R);
  const m = moonGeometry(S.simTime, R);
  if (!S.dayNight) {
    const v0 = norm3([0.15, 1.1, 0.5]);
    return { v: v0, sv: v0, mv: [0, 1, 0], dl: 0.85, dusk: 0, night: 0, elev: 0.8, moon: m, wS: 1, wM: 0 };
  }
  const sv = [-Math.cos(Math.PI * g.frac) * 0.8, g.elev * 1.25, 0.5];
  const mv = [Math.cos(Math.PI * m.frac) * 0.8, m.elev * 1.05, -0.5];
  const wS = clamp(g.elev / 0.10, 0, 1);
  const wM = clamp(m.elev / 0.10, 0, 1);
  const wT = clamp(1 - (wS + wM) * 2.5, 0, 1);
  const tv = [0.8, 0.06, 0];
  const v = norm3([sv[0] * wS + mv[0] * wM + tv[0] * wT,
    sv[1] * wS + mv[1] * wM + tv[1] * wT, sv[2] * wS + mv[2] * wM + tv[2] * wT]);
  if (g.elev > 0.01) {
    return { v, sv, mv, dl: clamp(g.elev * 2.0, 0.06, 1), dusk: g.elev < 0.35 ? (0.35 - g.elev) / 0.35 : 0, night: 0, elev: g.elev, moon: m, wS, wM };
  }
  return { v, sv, mv, dl: 0, dusk: 0, night: 1, elev: g.elev, moon: m, wS, wM };
}
function lampLevel() {
  if (!S.dayNight) return 0;
  const g = sunGeometry(S.simTime, REGIONS[S.region]);
  return clamp((0.06 - g.elev) / 0.06, 0, 1);
}
function norm3(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
function hexRGB(h) { const c = parseInt(h.slice(1), 16); return [(c >> 16) & 255, (c >> 8) & 255, c & 255]; }
function lerpC(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function seedRnd(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- 调色与地区风貌 ---------------- */
const C9 = { line: '#46525e', struct: '#9aa3ad', box: '#222a32', border: '#3a4650',
  accent: '#dfa45c', green: '#84b07c', bad: '#cc6f5f', warn: '#d99a5b', copper: '#c98d4e',
  dim: '#8d95a0', text: '#d9d2c5', cyan: '#7ba8a0', h2: '#86d1c3', nh3: '#d97a4e' };
const REGION_SKIN = {
  neimenggu: { skyTop: [78, 108, 138], skyBot: [170, 164, 144], ground: [64, 76, 52] },
  gansu:     { skyTop: [86, 108, 130], skyBot: [178, 166, 140], ground: [96, 86, 64] },
  qinghai:   { skyTop: [70, 104, 140], skyBot: [174, 172, 152], ground: [88, 90, 70] },
  jiangsu:   { skyTop: [96, 112, 126], skyBot: [164, 166, 154], ground: [70, 78, 66] },
  sichuan:   { skyTop: [98, 110, 118], skyBot: [160, 162, 150], ground: [62, 72, 54] },
  guangdong: { skyTop: [88, 110, 130], skyBot: [168, 166, 148], ground: [72, 78, 66] },
  xinjiang:  { skyTop: [72, 102, 136], skyBot: [172, 162, 140], ground: [94, 84, 62] },
};

/* ---------------- Three.js 启动 ---------------- */
const cv = $('gridCanvas');
let VW = 800, VH = 600, DPR = 1;
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0e16);
scene.fog = new THREE.Fog(0x0a0e16, 260, 680);
const camera = new THREE.PerspectiveCamera(46, 1.6, 0.5, 1200);
const CAM_DEF = { pos: [163, 134, 172], tgt: [42, 0, 46] };
const controls = new THREE.OrbitControls(camera, cv);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 18; controls.maxDistance = 700;
controls.maxPolarAngle = 1.52; controls.minPolarAngle = 0.06;
/* v19：左键=旋转，滚轮按下拖动=平移，滚轮拨动=缩放（右键同平移，兼容旧习惯） */
controls.enablePan = true;
controls.screenSpacePanning = true;
controls.panSpeed = 1.15;
controls.rotateSpeed = 0.9;
controls.autoRotateSpeed = 1.0;                        // 自动环绕（控制带按钮开关）
controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN };
controls.target.set(...CAM_DEF.tgt);
camera.position.set(...CAM_DEF.pos);
function fitView() {                                  // 复位视角（控制带按钮）
  camera.position.set(...CAM_DEF.pos);
  controls.target.set(...CAM_DEF.tgt);
  controls.update();
}
function resizeCanvas() {
  const r = cv.parentElement.getBoundingClientRect();
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  VW = r.width; VH = r.height;
  renderer.setPixelRatio(DPR);
  renderer.setSize(VW, VH, false);
  camera.aspect = VW / Math.max(1, VH);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resizeCanvas);

/* 灯光：环境 + 半球 + 主方向光（日/月共轨，含阴影） */
const ambL = new THREE.AmbientLight(0xbfc8d4, 0.25);
const hemiL = new THREE.HemisphereLight(0xbcd0e0, 0x5a5040, 0.35);
const sunL = new THREE.DirectionalLight(0xfff2dd, 1.0);
sunL.castShadow = true;
sunL.shadow.mapSize.set(2048, 2048);
sunL.shadow.camera.left = -210; sunL.shadow.camera.right = 210;
sunL.shadow.camera.top = 210; sunL.shadow.camera.bottom = -210;
sunL.shadow.camera.near = 20; sunL.shadow.camera.far = 760;
sunL.shadow.bias = -0.0006;
scene.add(ambL, hemiL, sunL, sunL.target);

/* 地面 + 网格 + 分区底色（360×240 全场景） */
const skinOf = () => REGION_SKIN[S.region] || REGION_SKIN.xinjiang;
const groundMat = new THREE.MeshStandardMaterial({ color: 0x5e5440, roughness: 1, metalness: 0 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(360, 240), groundMat);
ground.rotation.x = -Math.PI / 2; ground.position.set(50, -0.02, 50);
ground.receiveShadow = true;
scene.add(ground);
const gridH = new THREE.GridHelper(340, 85, 0x2e3843, 0x232c35);
gridH.position.set(50, 0.0, 50); gridH.material.transparent = true; gridH.material.opacity = 0.30;
scene.add(gridH);
/* 分区色板（发电侧绿调在围栏外 / 园区暖调在围栏内 / 南绿化带） */
function zonePlate(x0, z0, w, h, color, op) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(x0 + w / 2, 0.02, z0 + h / 2);
  scene.add(m); return m;
}
zonePlate(-115, -40, 95, 152, 0x84b07c, 0.06);        // 发电侧（园区外）
zonePlate(-8, -38, 206, 166, 0xdfa45c, 0.045);        // 园区围栏内
zonePlate(2, 100, 84, 26, 0x84b07c, 0.10);            // 南绿化带·西
zonePlate(106, 100, 88, 26, 0x84b07c, 0.10);          // 南绿化带·东
/* 道路网（入口大道 + 环园路 + 发电侧服务路） */
function road(x0, z0, w, h) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ color: 0x1b2129, roughness: 0.95 }));
  m.rotation.x = -Math.PI / 2; m.position.set(x0 + w / 2, 0.03, z0 + h / 2);
  m.receiveShadow = true; scene.add(m); return m;
}
road(-104, 10, 78, 6);                                // 风场横向服务路（风机行间）
road(-32, -40, 6, 152);                               // 发电侧纵向服务路
road(-64, 54, 32, 6);                                 // 光伏支路（阵列南侧）
road(-72, 78, 40, 6);                                 // SMR 支路（站区北侧）
road(-26, -13, 32, 6);                                // 发电侧→升压站联络路
road(-5, -26, 200, 6);                                // 园区北走廊路
road(44, -20, 6, 74);                                 // 园区西连路
road(150, -20, 6, 74);                                // 园区东连路
road(-5, 54, 200, 6);                                 // 园区东西主干路（35kV 母线南）
road(90, 60, 10, 100);                                // 入口大道（穿大门至南界）

/* 星空（球顶随机点，夜间渐现） */
const starGeo = new THREE.BufferGeometry();
{ const rnd2 = seedRnd(20260901), pos = [];
  for (let i = 0; i < 700; i++) {
    const a = rnd2() * Math.PI * 2, e = Math.asin(rnd2() * 0.95);
    const r = 460;
    pos.push(50 + r * Math.cos(e) * Math.cos(a), r * Math.sin(e) + 4, 50 + r * Math.cos(e) * Math.sin(a));
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); }
const starMat = new THREE.PointsMaterial({ color: 0xdcdde2, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0 });
scene.add(new THREE.Points(starGeo, starMat));

/* 太阳 / 月亮（径向渐变 sprite，沿光照向量运行） */
function glowSprite(inner, outer, size) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 6, 64, 64, 64);
  gr.addColorStop(0, inner); gr.addColorStop(0.35, outer); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  sp.scale.set(size, size, 1); scene.add(sp); return sp;
}
const sunSp = glowSprite('rgba(255,236,190,1)', 'rgba(232,184,115,.55)', 46);
const moonSp = glowSprite('rgba(230,234,240,.95)', 'rgba(160,170,185,.4)', 30);

/* 路灯（杆 + 灯头发光 + 地面光晕，lampLevel 驱动；入口大道两侧对称） */
const LAMPS2D = [];                                   // 世界坐标 [x, z]
for (let x = 5; x <= 185; x += 15) LAMPS2D.push([x, 60.8]);        // 东西主干路南侧
for (let z = 66; z <= 126; z += 15) LAMPS2D.push([101.2, z]);      // 入口大道东侧
for (let z = 66; z <= 126; z += 15) LAMPS2D.push([88.8, z]);       // 入口大道西侧（对称）
for (let x = 0; x <= 190; x += 19) LAMPS2D.push([x, -27.2]);       // 北走廊路
for (let z = -14; z <= 50; z += 16) LAMPS2D.push([42.8, z]);       // 西连路
for (let z = -14; z <= 50; z += 16) LAMPS2D.push([157.2, z]);      // 东连路
for (let z = -35; z <= 105; z += 20) LAMPS2D.push([-33.2, z]);     // 发电侧服务路
LAMPS2D.push([87.5, 151.5], [102.5, 151.5]);                       // 大门两侧
const lampHeadMat = new THREE.MeshStandardMaterial({ color: 0x888074, emissive: 0xe8b873, emissiveIntensity: 0 });
const lampPoolMat = new THREE.MeshBasicMaterial({ color: 0xe8b873, transparent: true, opacity: 0,
  blending: THREE.AdditiveBlending, depthWrite: false });
{
  const poleG = new THREE.CylinderGeometry(0.09, 0.12, 3.4, 6);
  const headG = new THREE.SphereGeometry(0.28, 8, 6);
  const poolG = new THREE.CircleGeometry(2.1, 14);
  const poleM = new THREE.MeshStandardMaterial({ color: 0x4a545e, roughness: 0.8 });
  for (const [lx, lz] of LAMPS2D) {
    const p = new THREE.Mesh(poleG, poleM);
    p.position.set(lx, 1.7, lz); p.castShadow = true;
    const h = new THREE.Mesh(headG, lampHeadMat);
    h.position.set(lx, 3.5, lz);
    const pool = new THREE.Mesh(poolG, lampPoolMat);
    pool.rotation.x = -Math.PI / 2; pool.position.set(lx, 0.05, lz);
    scene.add(p, h, pool);
  }
}

/* ---------------- 设备锚点与 HTML 悬浮标签 ---------------- */
const DEVICES = [];
function dev(key, x, y, z, r) { DEVICES.push({ key, p: [x, y, z], r }); }
const labelLayer = $('labels3d');
const LABELS3D = {};                                   // key → { el, lv, anc: Vector3 }
function addLabel(key, anc, nm, pr, bd, cls = '') {
  const el = document.createElement('div');
  el.className = 'dev3d' + (cls ? ' ' + cls : '');
  el.innerHTML = `<div class="nm">${nm}</div>` +
    (pr ? `<div class="pr">${pr}</div>` : '') +
    `<div class="lv" id="lb3_${key}">–</div>` +
    (bd ? `<div class="bd">${bd}</div>` : '');
  labelLayer.appendChild(el);
  LABELS3D[key] = { el, lv: el.querySelector('.lv'), anc: new THREE.Vector3(...anc) };
  dev(key, anc[0], anc[1], anc[2], 5);
  return LABELS3D[key];
}
const _pv = new THREE.Vector3();
function updateLabelPositions() {
  for (const k in LABELS3D) {
    const L = LABELS3D[k];
    _pv.copy(L.anc).project(camera);
    const behind = _pv.z > 1 || _pv.z < -1;
    const x = (_pv.x * 0.5 + 0.5) * VW, y = (-_pv.y * 0.5 + 0.5) * VH;
    L.el.style.display = behind || (MOBILE && L.el.dataset.min === '1') ? 'none' : '';
    L.el.style.left = x + 'px'; L.el.style.top = (y - 6) + 'px';
  }
}
function setLv(key, txt, color) {
  const L = LABELS3D[key];
  if (!L || L._t === txt) return;
  L._t = txt; L.lv.textContent = txt;
  if (color) L.lv.style.color = color;
}

/* ---------------- 3D 能量/物料边线与粒子 ---------------- */
/* pts 为世界坐标 [x,y,z]；pw 取功率（正=沿点序方向流动）；
 * v18：风/光/SMR 三回馈线改为架空线（线高 8m + 杆塔 poles + 弧垂 sag），
 * 粒子流与实物线路完全重合。 */
const EDGES = [
  { key: 'wind',   pts: [[-36, 8, 0], [-22, 8, 0], [-22, 8, -8], [-8, 8, -8], [6.2, 8, -8]], pw: () => S.windMW, sag: 1.3,
    poles: [[-36, 0], [-22, 0], [-22, -8], [-8, -8], [6.2, -8]] },
  { key: 'solar',  pts: [[-47, 8, 40], [-32, 8, 40], [-18, 8, 40], [-18, 8, 22], [-18, 8, 4], [-18, 8, -11], [-4, 8, -11], [6.2, 8, -11]], pw: () => S.solarMW, sag: 1.3,
    poles: [[-47, 40], [-32, 40], [-18, 40], [-18, 22], [-18, 4], [-18, -11], [-4, -11], [6.2, -11]] },
  { key: 'smr',    pts: [[-63, 8, 90], [-48, 8, 90], [-30, 8, 90], [-14, 8, 90], [-14, 8, 72], [-14, 8, 54], [-14, 8, 36], [-14, 8, 18], [-14, 8, 0], [-14, 8, -14], [-4, 8, -14], [6.2, 8, -14]], pw: () => S.smr, sag: 1.3,
    poles: [[-63, 90], [-48, 90], [-30, 90], [-14, 90], [-14, 72], [-14, 54], [-14, 36], [-14, 18], [-14, 0], [-14, -14], [-4, -14], [6.2, -14]] },
  { key: 'trans',  pts: [[14, 8, -10], [28, 13.2, -10], [48, 13.2, -10], [68, 13.2, -10], [76, 8, -10]], pw: () => S.genMW, sag: 2.6 },
  { key: 'bus2tr', pts: [[79.5, 4, -10], [88, 4, -10], [88, 4, -12], [90.7, 4, -12]], pw: () => S.loadMW },
  { key: 'tr2dc',  pts: [[93.3, 4, -12], [100, 4, -12], [100, 4, -10], [117.5, 4, -10]], pw: () => S.loadMW },
  { key: 'stg',    pts: [[28, 1.4, 32.5], [28, 1.4, 52]], pw: () => S.stP },
  { key: 'feedIn', pts: [[78, 1.4, 25], [78, 1.4, 52]], pw: () => S.sc + S.metal + S.factory + S.h2P - S.stP },
  { key: 'feedOut',pts: [[78.2, 1.4, 52], [185, 1.4, 52]], pw: () => S.sc + S.metal + S.factory + S.h2P - S.stP },
  { key: 'feedOutW', pts: [[77.8, 1.4, 52], [5, 1.4, 52]], pw: () => S.sc + S.metal + S.factory + S.h2P - S.stP },
  { key: 'pem',    pts: [[16, 1.4, 52], [16, 1.4, 63.8]], pw: () => S.h2P },
  { key: 'scE',    pts: [[64, 1.4, 52], [64, 1.4, 82.8]], pw: () => S.sc },
  { key: 'metalE', pts: [[129, 1.4, 52], [129, 1.4, 68]], pw: () => S.metal },
  { key: 'facE',   pts: [[170, 1.4, 52], [170, 1.4, 67]], pw: () => S.factory },
  { key: 'panZnAc', pts: [[144, 1.4, 52], [144, 1.4, 63.8]], pw: () => S.metal },
  { key: 'panZnDc', pts: [[143, 1.4, 68.4], [138.5, 1.4, 71]], pw: () => S.metal, color: 0x7ba8a0 },
  { key: 'panScAc', pts: [[84, 1.4, 52], [84, 1.4, 78.6]], pw: () => S.sc },
  { key: 'panScDc', pts: [[83, 1.4, 83.4], [79.5, 1.4, 86.5]], pw: () => S.sc, color: 0x7ba8a0 },
  { key: 'h2gas',  pts: [[21.4, 1.3, 66], [28.2, 1.3, 66]], pw: () => S.h2ProdKgH / 20, color: 0x86d1c3, pipe: 1 },
  { key: 'h2use',  pts: [[39.8, 1.3, 66], [48, 1.3, 66]], pw: () => S.nh3H2kgH / 20, color: 0x86d1c3, pipe: 1 },
  { key: 'nh3',    pts: [[53.2, 1.3, 67], [58.5, 1.3, 67]], pw: () => S.nh3KgH / 40, color: 0xd97a4e, pipe: 1 },
  { key: 'genset', pts: [[124, 1.4, 34], [124, 1.4, 52]], pw: () => S.gensetMW },
  { key: 'fc',     pts: [[60, 1.4, 63.8], [60, 1.4, 52]], pw: () => S.fcMW, color: 0x86d1c3 },
];
/* 悬链线展开（带 sag 的架空线：杆塔间弧垂） */
function expandSag(pts, sag) {
  const out = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    for (let t = 0.25; t < 1; t += 0.25) {
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(Math.PI * t) * sag, a[2] + (b[2] - a[2]) * t]);
    }
    out.push(b);
  }
  return out;
}
for (const e of EDGES) {
  if (e.sag) e.pts = expandSag(e.pts, e.sag);
  e.seg = []; e.len = 0;
  for (let i = 0; i < e.pts.length - 1; i++) {
    const [x1, y1, z1] = e.pts[i], [x2, y2, z2] = e.pts[i + 1];
    const l = Math.hypot(x2 - x1, y2 - y1, z2 - z1);
    e.seg.push(l); e.len += l;
  }
  e.parts = []; e.spawnAcc = 0;
}
function edgePoint(e, d) {
  let dist = d * e.len;
  for (let i = 0; i < e.seg.length; i++) {
    if (dist <= e.seg[i] || i === e.seg.length - 1) {
      const [x1, y1, z1] = e.pts[i], [x2, y2, z2] = e.pts[i + 1];
      const t = e.seg[i] ? clamp(dist / e.seg[i], 0, 1) : 0;
      return [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, z1 + (z2 - z1) * t];
    }
    dist -= e.seg[i];
  }
  return e.pts[e.pts.length - 1];
}
function updateParticles(dtR) {                       // 与 2D 版同一调度逻辑
  for (const e of EDGES) {
    const p = e.pw();
    const ap = Math.abs(p);
    const dir = p >= 0 ? 1 : -1;
    /* 数据流等细语义边线可用 e.partCap 单独限流（见 bridge.js） */
    const target = Math.min(e.partCap || PART_CAP, Math.round(ap * 0.55));
    e.spawnAcc += ap * dtR * 0.9;
    while (e.parts.length < target && e.spawnAcc >= 1) {
      e.parts.push({ d: dir > 0 ? 0 : 1 }); e.spawnAcc -= 1;
    }
    if (e.spawnAcc > 4) e.spawnAcc = 4;
    const vel = (0.10 + 0.30 * Math.min(1, ap / 30)) * dtR * (e.dataFlow ? 0.55 : 1);
    for (let i = e.parts.length - 1; i >= 0; i--) {
      e.parts[i].d += vel * dir;
      const d = e.parts[i].d;
      if (d > 1 || d < 0 || (e.parts.length > target && Math.random() < 0.1)) e.parts.splice(i, 1);
    }
  }
}

