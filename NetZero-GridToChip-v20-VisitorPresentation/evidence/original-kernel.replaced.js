
"use strict";
/* =====================================================================
 * 甘泉堡零碳园区运行模拟 —— 1GW 算电直连零碳园区（2D 平面拓扑）
 * 仿真内核：dispatchFlex / 欠账池 payback / 氢氨 / 电能质量 / SMR / 地区模型
 * v13：发电侧（风/光/SMR）与零碳园区图示隔离；设备参数直显卡片（取消点击弹卡）；
 * 西比里核心装备角标（耐电晕绕组/机舱干变/耐腐蚀光伏支架/弹性容量变压器/
 * 陶瓷钢芯铝绞线/有载调压器/巴拿马电源）；氢氨能耗对标米东 1.5GW 制氢氨肥项目；
 * 侧栏新增零碳园区指标（清洁能源占比 / 碳排放强度，对标 910 号文）。
 * v14：布局重构为 leftCol（顶栏+控制带+画布+告警条）+ 右侧栏通顶（消除顶部空白）；
 * 产品角标加粗提亮；装备客户价值移至侧栏底部独立区块（原画布中廊注移除）。
 * ===================================================================== */

/* ---------------- 地区资源模型 ---------------- */
const REGIONS = {
  neimenggu: { name: '内蒙古（风光大基地）', windMean: 8.8, windVol: 1.0, sunPeak: 0.85, dayLen: 10.0, co2: 0.70,
    desc: '内蒙古：年均风速约 7.5m/s，风能利用小时 3000+h，光照资源好；电网排放因子偏高（煤电占比高），绿电替代减排效益显著。' },
  gansu:     { name: '甘肃 · 河西走廊', windMean: 7.6, windVol: 0.9, sunPeak: 0.88, dayLen: 10.0, co2: 0.60,
    desc: '甘肃河西走廊：风廊道效应明显，风光互补性好，新能源装机占比高，外送通道受限于走廊容量。' },
  qinghai:   { name: '青海（光伏极佳）', windMean: 6.0, windVol: 0.7, sunPeak: 1.0, dayLen: 10.5, co2: 0.35,
    desc: '青海：年日照 3000+h，光伏利用小时全国领先，水光互补；电网排放因子低。' },
  jiangsu:   { name: '江苏沿海（海上风电）', windMean: 8.0, windVol: 0.55, sunPeak: 0.70, dayLen: 9.5, co2: 0.55,
    desc: '江苏沿海：海上风速高且波动小（出力平滑），光照一般；负荷密集，就地消纳条件好。' },
  sichuan:   { name: '四川（水电丰沛）', windMean: 4.5, windVol: 0.5, sunPeak: 0.55, dayLen: 9.0, co2: 0.25,
    desc: '四川：水电丰沛但风资源一般、多云寡照；电网排放因子低，丰水期富余电力多。' },
  guangdong: { name: '广东（负荷中心）', windMean: 6.0, windVol: 0.7, sunPeak: 0.72, dayLen: 9.5, co2: 0.50,
    desc: '广东：全国最大负荷中心，资源一般但消纳能力极强，海上风电与分布式光伏快速发展。' },
  xinjiang:  { name: '新疆（甘泉堡经开区）', windMean: 7.8, windVol: 0.85, sunPeak: 0.90, dayLen: 10.5, co2: 0.65,
    desc: '新疆甘泉堡：毗邻达坂城风区，风能利用小时 2800+h、太阳能利用小时 1600+h（年日照 2800–3200h，辐射 B 类极丰富），大型风光基地与算电直连零碳园区承载地。' },
};

/* ---------------- 全局仿真状态 ---------------- */
const S = {
  running: true,
  timeScale: 240, simTime: 8 * 3600, day: 1,
  region: 'xinjiang',

  windManual: false, windSlider: 7.8, windSpeed: 7.8,
  dayNight: true, irradi: 0,
  smrGear: 2, smr: 30,
  itSlider: 150,
  stMode: 'auto', svgOn: true, apfOn: true,

  turbP: new Array(12).fill(0), windMW: 0, solarMW: 0, carportMW: 0,
  itMW: 0, loadMW: 0, genMW: 0,
  gensetOn: false, gensetMW: 0, fcOn: false, fcMW: 0,
  stP: 0, soc: 55,
  gridBuy: 0, curtail: 0,

  h2P: 0, h2Kg: 400, h2ProdKgH: 0,
  nh3H2kgH: 0, nh3KgH: 0, nh3Load: 0,
  nh3Aux: 0,
  lampMW: 0,

  trucks: 3, sc: 0, metal: 0, factory: 0,
  releaseMW: 0,
  debtZinc: 0, debtFac: 0, debtPem: 0,
  zincStops: 0, zincStopUntil: 0,

  pfRaw: 0.9, pf: 0.99, thdRaw: 6, thd: 2, vdRaw: 0, vd: 0,
  pue: 1.2, greenRatio: 0, curRate: 0, selfUse: 1, exportRate: 0,
  cleanShare: 1, carbInt: 0,

  dGen: 0, dLoad: 0, dBuy: 0, dCur: 0, dGreen: 0, dCo2: 0,
  dSc: 0, dMt: 0, dFa: 0, dH2Mwh: 0, dH2kg: 0, dNh3t: 0, dTokB: 0,
};

/* 设备工程常量 */
const K = {
  TURB_RATED: 6, SOLAR_CAP: 400, SMR_CAP: 30,
  SMR_RAMP: 1 / 60,
  ST_CAP: 300, ST_MAXP: 150, SOC_LO: 10, SOC_HI: 95,
  TR_CAP: 50, PANAMA_ETA: 0.975,
  H2_CAP: 200, H2_KWH_PER_KG: 48, H2_TANK: 10000,   // v13：电耗 55→48（ALK+PEM 混合，对标米东项目 4.189 kWh/Nm³ ≈ 46.9 kWh/kg 国家一级能效）
  NH3_H2_MAX: 2200, NH3_RATIO: 17 / 3,
  NH3_AUX_MW_PER_KGH: 0.0008,                        // v13：0.5→0.8 MWh/t NH₃（空分制氮+合成气压缩，对标米东项目公辅 805 kWh/t）
  SC_GUN: 1.2, SC_BAYS: 24, CARPORT_CAP: 0.5,
  SC_ARR_DAY: 6.0, SC_ARR_NIGHT: 0.5, SC_DEP_CHG: 0.4, SC_DEP_IDLE: 0.9,
  GENSET_CAP: 50, GENSET_RAMP: 50 / 60, FC_CAP: 2, FC_KG_PER_MWH: 60,
  METAL_CAP: 200, METAL_MIN: 40,
  ZINC_RAMP: 200 / 60,
  ZINC_MAX_STOPS: 2, ZINC_STOP_MAX_S: 7200,
  FACTORY_CAP: 100, FACTORY_MIN: 20,
  PEM_MIN: 20,
  THD_LIMIT: 4,
};

/* ---------------- 工具 ---------------- */
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const rnd = () => Math.random() * 2 - 1;
const $ = id => document.getElementById(id);
const fmt = (v, d = 1) => v.toFixed(d);

/* ---------------- 太阳几何（3D 光照 / 冒烟测试共用；与 simStep 光照曲线同源） ---------------- */
function sunGeometry(simTime, R) {
  const hour = (simTime % 86400) / 3600;
  const rise = 12 - R.dayLen / 2;
  const frac = (hour - rise) / R.dayLen;      // 白昼区间 0..1
  const elev = Math.sin(Math.PI * frac);      // 白天 >0，夜间 ≤0
  return { hour, frac, elev };
}

/* =====================================================================
 * 调度核心 dispatchFlex（与 v3 完全一致）
 * ===================================================================== */
function dispatchFlex(surplus, dtH) {
  const dt = dtH * 3600;
  const headroomP = (K.SOC_HI - S.soc) / 100 * K.ST_CAP / Math.max(dtH, 1e-6) / 0.95;
  const availP = (S.soc - K.SOC_LO) / 100 * K.ST_CAP * 0.95 / Math.max(dtH, 1e-6);
  let stP = 0, rest = surplus;
  S.releaseMW = 0;

  if (surplus >= 0) {
    if (S.stMode === 'discharge') {
      // discharge 分支顺序不变：储能先放电，再超充
      stP = Math.min(K.ST_MAXP, availP); rest = surplus + stP;
      S.sc = clamp(Math.min(rest, S.trucks * K.SC_GUN), 0, K.SC_BAYS * K.SC_GUN);
      rest -= S.sc;
    } else {
      // v8 超充易逝需求优先：车到才有需求、错过即流失，先于储能充电被满足
      S.sc = clamp(Math.min(surplus, S.trucks * K.SC_GUN), 0, K.SC_BAYS * K.SC_GUN);
      rest = surplus - S.sc;
      const want = S.stMode === 'charge' ? K.ST_MAXP : rest;
      stP = -Math.min(want, K.ST_MAXP, headroomP); rest = rest + stP;
    }
    const zincCap = S.debtZinc > 1e-6 ? K.METAL_CAP * 1.2 : K.METAL_CAP;
    let zincT = S.simTime < S.zincStopUntil ? 0 : clamp(rest, 0, zincCap);
    if (zincT > 0 && zincT < K.METAL_MIN) zincT = 0;
    if (zincT > S.metal) zincT = Math.min(zincT, S.metal + K.ZINC_RAMP * dt);
    S.metal = zincT; rest -= zincT;
    const facCap = S.debtFac > 1e-6 ? K.FACTORY_CAP * 1.2 : K.FACTORY_CAP;
    let facT = clamp(rest, 0, facCap);
    if (facT > 0 && facT < K.FACTORY_MIN) facT = 0;
    S.factory = facT; rest -= facT;
    let pemCap = S.debtPem > 1e-6 ? K.H2_CAP * 1.2 : K.H2_CAP;
    if (S.h2Kg >= K.H2_TANK * 0.995) pemCap = Math.min(pemCap, S.nh3H2kgH * K.H2_KWH_PER_KG / 1000);
    let pemT = clamp(rest, 0, pemCap);
    if (pemT > 0 && pemT < K.PEM_MIN) pemT = 0;
    S.h2P = pemT; rest -= pemT;
    S.debtZinc = Math.max(0, S.debtZinc - Math.max(0, S.metal - K.METAL_CAP) * dtH);
    S.debtFac = Math.max(0, S.debtFac - Math.max(0, S.factory - K.FACTORY_CAP) * dtH);
    S.debtPem = Math.max(0, S.debtPem - Math.max(0, S.h2P - K.H2_CAP) * dtH);
    return { curtail: Math.max(0, rest), gridBuy: 0, stP };
  }

  let need = -surplus, d;
  d = Math.min(S.sc, need); S.sc -= d; need -= d; S.releaseMW += d;
  d = Math.min(Math.max(0, S.h2P - K.PEM_MIN), need);
  S.h2P -= d; need -= d; S.releaseMW += d; S.debtPem += d * dtH;
  d = Math.min(Math.max(0, S.factory - K.FACTORY_MIN), need);
  S.factory -= d; need -= d; S.releaseMW += d; S.debtFac += d * dtH;
  d = Math.min(Math.max(0, S.metal - K.METAL_MIN), need);
  S.metal -= d; need -= d; S.releaseMW += d; S.debtZinc += d * dtH;
  if (need > 0 && S.metal > 0 && S.zincStops < K.ZINC_MAX_STOPS) {
    S.debtZinc += S.metal * dtH; need -= S.metal; S.releaseMW += S.metal;
    S.metal = 0;
    S.zincStops++; S.zincStopUntil = S.simTime + K.ZINC_STOP_MAX_S;
    pushAlert('warn', `电解锌车间全停（今日第 ${S.zincStops}/2 次，2h 内恢复），让路电量记入欠账池`);
  }
  if (S.stMode === 'charge') {
    stP = -Math.min(K.ST_MAXP, headroomP);
    return { curtail: 0, gridBuy: need - stP, stP };
  }
  const want = S.stMode === 'discharge' ? K.ST_MAXP : need;
  stP = Math.min(want, K.ST_MAXP, availP);
  return { curtail: 0, gridBuy: Math.max(0, need - stP), stP };
}

/* ---------------- 仿真物理步进（与 v3 完全一致） ---------------- */
function simStep(dt) {
  S.simTime += dt;
  const dtH = dt / 3600;
  const R = REGIONS[S.region];

  const day = Math.floor(S.simTime / 86400) + 1;
  if (day !== S.day) {
    S.day = day;
    S.dGen = S.dLoad = S.dBuy = S.dCur = S.dGreen = S.dCo2 = 0;
    S.dSc = S.dMt = S.dFa = S.dH2Mwh = S.dH2kg = S.dNh3t = 0;
    S.dTokB = 0;
    S.debtZinc = S.debtFac = S.debtPem = 0;
    S.zincStops = 0; S.zincStopUntil = 0;
    pushAlert('info', `第 ${day} 天开始，当日累计与欠账池已清零`);
  }

  if (S.windManual) S.windSpeed += (S.windSlider - S.windSpeed) * Math.min(1, dt * 0.5);
  else {
    S.windSpeed += (R.windMean - S.windSpeed) * 0.002 * dt + rnd() * 0.10 * R.windVol * Math.sqrt(dt);
    S.windSpeed = clamp(S.windSpeed, 0, 24);
  }

  S.windMW = 0;
  for (let i = 0; i < TURB_POS.length; i++) {
    const v = S.windSpeed * (1 + 0.06 * Math.sin(S.simTime * 0.02 + i * 2.1));
    let p = 0;
    if (v >= 3 && v < 12) p = K.TURB_RATED * Math.pow((v - 3) / 9, 2);
    else if (v >= 12 && v <= 25) p = K.TURB_RATED;
    S.turbP[i] = p; S.windMW += p;
  }
  S.windMW = S.windMW * 100 / TURB_POS.length;   // v10：12 台样本机外推全场 100 台（图面示意 12 台）

  if (S.dayNight) {
    const hour = (S.simTime % 86400) / 3600;
    const rise = 12 - R.dayLen / 2, set = 12 + R.dayLen / 2;
    S.irradi = (hour > rise && hour < set)
      ? R.sunPeak * Math.pow(Math.sin(Math.PI * (hour - rise) / R.dayLen), 1.15) : 0;
  } else S.irradi = 0.85 * R.sunPeak;
  const cloud = 0.94 + 0.06 * Math.sin(S.simTime * 0.013) * Math.sin(S.simTime * 0.0047 + 3);
  S.solarMW = K.SOLAR_CAP * S.irradi * cloud;
  S.carportMW = K.CARPORT_CAP * S.irradi * cloud;   // v8 N1 光伏车棚（常发，同日照模型）

  const smrTarget = S.smrGear * K.SMR_CAP / 2;
  const ramp = K.SMR_RAMP * dt;
  S.smr += clamp(smrTarget - S.smr, -ramp, ramp);

  // v8 N2 备用燃气轮机（默认停机，分钟级爬坡仿 SMR）
  const gensetTarget = S.gensetOn ? K.GENSET_CAP : 0;
  S.gensetMW += clamp(gensetTarget - S.gensetMW, -K.GENSET_RAMP * dt, K.GENSET_RAMP * dt);
  // v8 N3 氢燃料电池（秒级启动，仅储氢>50kg 可运行）
  const fcTarget = (S.fcOn && S.h2Kg > 50) ? K.FC_CAP : 0;
  S.fcMW += clamp(fcTarget - S.fcMW, -K.FC_CAP * dt, K.FC_CAP * dt);

  S.itMW = S.itSlider + 0.5 * Math.sin(S.simTime * 0.05);
  S.loadMW = S.itMW / K.PANAMA_ETA + 10 + 0.08 * S.itMW + S.nh3Aux + S.lampMW;
  S.pue = (S.itMW / K.PANAMA_ETA + 10 + 0.08 * S.itMW) / S.itMW;

  const hourNow = (S.simTime % 86400) / 3600;
  // v8 超充利用率修正：到达率提高（白天 2 辆/h），离场方向修正——充电中的车按 SC_DEP_CHG
  // 满电离场，没充上电的车按 SC_DEP_IDLE 更快流失（原逻辑倍率写反：充电车快走、闲置车赖着）。
  const arrRate = (hourNow > 7 && hourNow < 22) ? K.SC_ARR_DAY : K.SC_ARR_NIGHT;
  if (S.trucks < K.SC_BAYS && Math.random() < arrRate * dtH) S.trucks++;
  if (S.trucks > 0) {
    const depRate = S.sc > 0.05 ? K.SC_DEP_CHG : K.SC_DEP_IDLE;
    if (Math.random() < depRate * dtH * S.trucks) S.trucks--;
  }

  S.genMW = S.windMW + S.solarMW + S.carportMW + S.smr + S.gensetMW + S.fcMW;
  const disp = dispatchFlex(S.genMW - S.loadMW, dtH);
  S.stP = disp.stP; S.curtail = disp.curtail; S.gridBuy = disp.gridBuy;

  if (S.stP < 0) S.soc += (-S.stP) * dtH * 0.95 / K.ST_CAP * 100;
  else S.soc -= S.stP * dtH / 0.95 / K.ST_CAP * 100;
  S.soc = clamp(S.soc, K.SOC_LO, K.SOC_HI);

  S.h2ProdKgH = S.h2P * 1000 / K.H2_KWH_PER_KG;
  const tankDraw = S.h2Kg > 1 ? 60 : 0;
  S.nh3H2kgH = Math.min(K.NH3_H2_MAX, S.h2ProdKgH + tankDraw);
  S.nh3KgH = S.nh3H2kgH * K.NH3_RATIO;
  S.nh3Load = S.nh3H2kgH / K.NH3_H2_MAX;
  S.nh3Aux = S.nh3KgH * K.NH3_AUX_MW_PER_KGH;
  S.lampMW = 0.05 * lampLevel();          // v6 路灯象征性小负荷（计入辅助用电，功率平衡自洽）
  S.h2Kg = clamp(S.h2Kg + (S.h2ProdKgH - S.nh3H2kgH - S.fcMW * K.FC_KG_PER_MWH) * dtH, 0, K.H2_TANK);
  // v8 N3 燃料电池耗尽自动停机 + 告警 + 开关复位
  if (S.fcOn && S.h2Kg <= 50) {
    S.fcOn = false;
    const swFcEl = $('swFc'); if (swFcEl) swFcEl.classList.remove('on');
    pushAlert('warn', '氢燃料电池储氢不足（≤50kg），已自动停机并复位开关');
  }

  const totalLoad = S.loadMW + S.sc + S.metal + S.factory + S.h2P;
  S.pfRaw = clamp(0.79 + 0.13 * (totalLoad / 700) + 0.012 * Math.sin(S.simTime * 0.03), 0.78, 0.96);
  S.pf = S.svgOn ? Math.min(0.999, 1 - (1 - S.pfRaw) * 0.1) : S.pfRaw;
  S.thdRaw = 4.5 + 4.5 * (totalLoad / 700) + 0.4 * Math.sin(S.simTime * 0.021 + 1);
  S.thd = S.apfOn ? S.thdRaw * 0.28 + 0.4 : S.thdRaw;
  S.vdRaw = (totalLoad / 1500 - 0.45) * 7 + (0.92 - S.pfRaw) * 6;
  S.vd = S.svgOn ? S.vdRaw * 0.3 : S.vdRaw;

  const WS = S.windMW + S.solarMW + S.carportMW;
  const curtWS = Math.min(S.curtail, WS);
  S.greenRatio = totalLoad > 0.1 ? clamp((WS - curtWS) / totalLoad, 0, 1) : 1;
  S.selfUse = WS > 0.5 ? clamp((WS - curtWS) / WS, 0, 1) : -1;
  S.exportRate = 0;
  // v13：零碳园区指标——清洁能源消费占比（风光核上网电量/全口径用电）与碳排放强度（购电排放/综合能耗，1MWh≈0.1229tce）
  const zeroC0 = WS + S.smr;
  S.cleanShare = totalLoad > 0.1 ? clamp((zeroC0 - Math.min(S.curtail, zeroC0)) / totalLoad, 0, 1) : 1;
  S.carbInt = totalLoad > 0.1 ? (S.gridBuy * R.co2) / (totalLoad * 0.1229) : 0;
  S.curRate = S.genMW > 0.5 ? S.curtail / S.genMW * 100 : 0;
  S.dGen += S.genMW * dtH; S.dLoad += S.loadMW * dtH;
  S.dBuy += S.gridBuy * dtH; S.dCur += S.curtail * dtH;
  S.dSc += S.sc * dtH; S.dMt += S.metal * dtH; S.dFa += S.factory * dtH;
  S.dH2Mwh += S.h2P * dtH; S.dH2kg += S.h2ProdKgH * dtH; S.dNh3t += S.nh3KgH * dtH / 1000;
  S.dTokB += S.itMW * 1.667 * dtH;               // v12：1 MWh ≈ 16.7 亿 tokens（0.6Wh/千 tokens）
  S.dGreen += Math.max(0, WS - curtWS) * dtH;
  const zeroC = WS + S.smr;
  S.dCo2 += Math.max(0, zeroC - Math.min(S.curtail, zeroC)) * dtH * R.co2;

  checkAlerts();
}

/* ---------------- 告警系统 ---------------- */
const alertLog = [];
const alertCd = {};
function pushAlert(lv, msg) {
  const hh = String(Math.floor((S.simTime % 86400) / 3600)).padStart(2, '0');
  const mm = String(Math.floor((S.simTime % 3600) / 60)).padStart(2, '0');
  alertLog.push({ t: `D${S.day} ${hh}:${mm}`, lv, msg });
  if (alertLog.length > 30) alertLog.shift();
  rebuildTicker();
}
function throttledAlert(key, lv, msg, cdSec = 1800) {
  if ((alertCd[key] || 0) > S.simTime) return;
  alertCd[key] = S.simTime + cdSec;
  pushAlert(lv, msg);
}
function checkAlerts() {
  if (S.gridBuy > 5) throttledAlert('buy', 'warn', `功率缺口：可中断让路 ${fmt(S.releaseMW)} MW 后仍购电 ${fmt(S.gridBuy)} MW`);
  if (S.curtail > 5) throttledAlert('cur', 'warn', `弃电 ${fmt(S.curtail)} MW：柔性消纳容量已全部打满`);
  if (S.soc <= 12) throttledAlert('socLo', 'bad', `储能 SOC 过低（${fmt(S.soc)}%），放电能力受限`, 3600);
  if (S.h2Kg >= K.H2_TANK * 0.995) throttledAlert('h2full', 'info', `储氢罐已满（${fmt(S.h2Kg, 0)} kg），电解槽限产`, 3600);
  if (!S.svgOn && S.pfRaw < 0.9) throttledAlert('pf', 'warn', `功率因数 ${fmt(S.pfRaw, 2)} 越限，建议投入 SVG`);
  if (S.thd > K.THD_LIMIT) throttledAlert('thd', 'warn', `总谐波畸变率 THD ${fmt(S.thd)}% 超 4% 限值（GB/T 14549），建议投入 APF`);
}

/* ---------------- 设备信息卡数据（v10：1GW 容量口径） ---------------- */
const INFO = {
  wind: { t: '风力发电场', d: '100 台 6MW 机组大型风场（图面示意 12 台样本机，功率按 ×100/12 外推），出力按功率曲线随风速变化，35kV 集电线路汇入升压变电站。核心装备：西比里耐电晕风力发电机绕组（绝缘寿命 2–3 倍）与机舱干式变压器（重量轻、免维护）。',
    p: [['单机容量', '6 MW'], ['机组数量', '100 台（示意 12 台）'], ['切入风速', '3 m/s'], ['额定风速', '12 m/s'], ['切出风速', '25 m/s'], ['场站容量', '600 MW'], ['核心装备', '耐电晕绕组 · 机舱干变']] },
  solar: { t: '光伏发电场', d: '400MWp 光伏阵列（图面 4×15 组串方阵示意），出力随地区日照模型（日照时长/正午峰值）与云层扰动变化。核心装备：西比里耐腐蚀光伏支架，适应戈壁风沙盐碱环境。',
    p: [['装机容量', '400 MWp'], ['方阵', '4 行 × 15 列（示意）'], ['组件规格', '550 Wp 单晶双面'], ['逆变器', '组串式 1500V'], ['核心装备', '耐腐蚀光伏支架'], ['地区日照', '见地区选择']] },
  smr: { t: '小型模块化反应堆（SMR）', d: '电功率 30MWe / 热功率 100MWt，按 IAEA 分级属于 SMR（微型堆 microreactor 指 ≤20MWe 机组）。堆芯置于安全壳穹顶内，右侧为汽轮机厂房；基荷运行，具备有限调峰能力。',
    p: [['额定电功率', '30 MWe'], ['热功率', '≈100 MWt'], ['堆型', '小型模块化反应堆'], ['功率爬坡速率', '1 MW/min'], ['换料周期', '≈24 个月']] },
  substation: { t: '升压变电站', d: '各电源 35kV 汇集后升压至 220kV，经新型架空线外送。',
    p: [['主变容量', '3×360 MVA'], ['电压变换', '35 kV → 220 kV'], ['接线方式', '单母分段']] },
  line: { t: '新型架空输电线', d: '四回出线，采用西比里新型陶瓷钢芯铝绞线（陶瓷纤维增强钢芯：低弧垂、耐高温、大输送容量），连接升压变电站与园区 220kV 母线。粒子示意功率方向与大小。',
    p: [['导线型号', '新型陶瓷钢芯铝绞线'], ['出线规模', '四回出线'], ['导线特性', '低弧垂 · 耐高温'], ['功能', '绿电直连通道']] },
  bus: { t: '220kV 高压母线', d: '电网枢纽：汇集升压变电站来电，向数据中心降压变压器与配电变压器（柔性消纳支线）供电。',
    p: [['电压等级', '220 kV'], ['接线', '双母线'], ['功能', '源网荷储汇流']] },
  disttr: { t: '配电变压器', d: '220kV 母线经本变降压至 35kV，向柔性消纳 35kV 母线（超充/电解锌/智能工厂/制氢/储能）供电。核心装备：西比里弹性容量变压器，负载能力弹性提升约 40%，适应柔性负荷大幅波动。',
    p: [['电压变换', '220 / 37 kV'], ['容量', '3×240 MVA'], ['核心装备', '弹性容量变压器（+40%）'], ['功能', '柔性负荷馈电']] },
  stepdown: { t: '降压变压器（数据中心）', d: '2×360MVA 分列运行、互为备用（N-1 冗余），单台可带全园基荷；220kV 降至 10.5kV 向数据中心园区中压母线供电。',
    p: [['配置', '2×360 MVA 分列运行'], ['冗余', 'N-1，单台带全荷'], ['电压变换', '220 / 10.5 kV'], ['冷却方式', 'ONAN']] },
  storage: { t: '储能电站', d: '磷酸铁锂电池，按新能源装机 15%·2h 配比（300MWh/150MW），经 PCS 及升压变接入 35kV 母线；削峰填谷（消纳优先级次于超充易逝需求），SOC 限幅 10%–95%。',
    p: [['额定容量', '300 MWh'], ['最大充放功率', '150 MW'], ['配比口径', '装机 15% · 2h'], ['接入方式', 'PCS + 升压变 → 35kV'], ['充放效率', '95%'], ['SOC 运行区间', '10% – 95%']] },
  svgapf: { t: '电能质量治理装置（SVG + APF）', d: 'SVG 动态补偿无功使功率因数趋近 1；APF 抑制谐波，THD 治理目标 <4%（GB/T 14549 35kV 母线 THDu 限值）。核心装备：西比里有载调压器，带载自动调压，平抑新能源波动引起的母线电压偏差。',
    p: [['SVG 容量', '±50 Mvar'], ['APF 补偿电流', '1500 A'], ['治理目标', 'PF≈1 · THD<4%'], ['核心装备', '有载调压器'], ['响应时间', '<10 ms']] },
  dc: { t: '数据中心园区', d: '算力基荷中心，IT 负载可模拟任务波动；10kV 进线由 2×360MVA 降压变压器分列供电；楼内巴拿马电源（2N 配置）240V 直流供电架构，链路效率≈97.5%。',
    p: [['IT 负载范围', '50 – 300 MW'], ['供电制式', '10kV 中压进线'], ['母排电压', '240 V DC（巴拿马 2N）'], ['绿电直供', '算电直连']] },
  panamaZn: { t: '巴拿马直流电源（电解锌）', d: '移相变压器+整流一体化设备：输入 35kV AC 柔性母线，直接整流输出 240V DC 供电解锌电解槽，链路效率≈97.5%。',
    p: [['拓扑', '移相变压器 + 整流'], ['输入', '35 kV AC 柔性母线'], ['输出', '240 V DC'], ['链路效率', '≈97.5%'], ['供电对象', '电解锌电解槽']] },
  panamaSc: { t: '巴拿马直流电源（超充）', d: '移相变压器+整流一体化设备：输入 35kV AC 柔性母线，直接整流输出 1000V DC 充电堆母线供超充充电堆，链路效率≈97.5%。',
    p: [['拓扑', '移相变压器 + 整流'], ['输入', '35 kV AC 柔性母线'], ['输出', '1000V DC（充电堆母线）'], ['链路效率', '≈97.5%'], ['供电对象', '超充充电堆']] },
  pem: { t: '电解水制氢站（ALK+PEM）', d: '碱性（ALK）电解槽承担基础负载、PEM 快速响应调峰（高低搭配机制，同米东项目 64 台 ALK + 16 台 PEM），消纳富余绿电制氢；秒级响应，最小技术出力 10%。综合电耗 48 kWh/kg，对标米东项目 4.189 kWh/Nm³（≈46.9 kWh/kg）国家一级能效。',
    p: [['最大电功率', '200 MW'], ['最小技术出力', '10%（20 MW）'], ['综合电耗', '≈48 kWh/kg H₂'], ['对标', '米东项目国家一级能效'], ['响应', '秒级']] },
  h2tank: { t: '储氢罐', d: '高压气态储氢，缓冲电解与合成之间的产耗波动；罐满时电解槽限产，仅补充合成塔消耗。10t 储量 ≈ 米东项目 20×2000m³ 球罐（40t）按 400MWp/1.5GW 等比缩放。',
    p: [['储氢容量', '10000 kg'], ['形式', '高压气态储氢'], ['对标', '米东 40t 球罐等比'], ['最大外供', '60 kg/h']] },
  nh3: { t: '绿氨合成塔', d: '小型化柔性 Haber-Bosch 装置（径向催化床，同南京国昌专利塔型）：电解氢 + 空分氮合成绿氨；氢不足时自动降负荷。深冷空分制氮与合成气压缩电耗约 0.8MWh/t NH₃（对标米东项目公辅 805 kWh/t），已计入厂用电（功率平衡）。',
    p: [['反应', 'N₂ + 3H₂ → 2NH₃'], ['最大耗氢', '2200 kg/h'], ['厂用电', '≈0.8 MWh/t NH₃'], ['工况', '300–410℃ · ≤16.5MPa'], ['氢氨比', '1kg H₂ → 5.67kg NH₃']] },
  supercharge: { t: '电动重卡超充站', d: '24 车位液冷超充，单枪 1.2MW（兆瓦级充电）；0–100% 秒级可中断，是唯一可瞬时全停的柔性负荷；重卡白天约每小时到 6 辆。',
    p: [['单枪功率', '1.2 MW'], ['车位/枪数', '24'], ['站最大功率', '28.8 MW'], ['可中断容量', '100%（秒级）']] },
  metal: { t: '电解锌（电积）车间', d: '大功率柔性工业负荷，调节范围 20%–100%，分钟级爬坡；每日可全停 ≤2 次、单次 ≤2h；压减电量记入欠账池，富余时可超至 120% 补偿释放。（注：电解铝仅 ±20% 有限可调，不在本方案。）',
    p: [['调节范围', '40 – 200 MW（20–100%）'], ['爬坡', '分钟级'], ['全停约束', '≤2 次/日 · ≤2h/次'], ['补偿上限', '120%（240 MW）']] },
  factory: { t: '智能工厂（可转移负荷）', d: '可编程生产负荷，排程跟随富余电力信号转移；最低保安负荷 20%；压减电量记入欠账池，日内能量守恒。',
    p: [['调节范围', '20 – 100 MW（保 20%）'], ['负荷类型', '可转移负荷'], ['补偿上限', '120%（120 MW）'], ['约束', '日能量守恒（欠账池）']] },
  flexbus: { t: '柔性消纳 35kV 母线', d: '220kV 母线经配电变压器（220/37kV，3×240MVA）降压后的消纳干线；储能亦经 PCS 升压变接入本母线。',
    p: [['电压等级', '35 kV'], ['上级电源', '配电变压器 3×240MVA'], ['目标', '弃电≈0']] },
  carport: { t: '光伏车棚（BIPV）', d: '超充站顶棚光伏一体化（BIPV）组件，自发自用，就地供给超充负荷，余电并入园区绿电。',
    p: [['装机容量', '0.5 MWp'], ['类型', 'BIPV 光伏车棚'], ['消纳方式', '自发自用']] },
  genset: { t: '备用燃气轮机', d: '50MW 应急备用电源，分钟级启动爬坡；默认冷备用停机，计入发电但不计入绿电与碳减排口径。',
    p: [['额定功率', '50 MW'], ['启动', '分钟级'], ['默认状态', '冷备用（停机）'], ['口径', '不计绿电/碳减排']] },
  fc: { t: '氢燃料电池备用', d: '2MW 质子交换膜燃料电池应急电源，秒级启动；耗氢≈60kg/MWh，仅储氢>50kg 时可运行，耗尽自动停机并复位开关。',
    p: [['额定功率', '2 MW'], ['启动', '秒级'], ['耗氢', '≈60 kg/MWh'], ['运行条件', '储氢 > 50 kg']] },
  token: { t: 'Token 产量（估算）', d: '按大模型推理能耗约 0.6 Wh/千 tokens（1 MWh ≈ 16.7 亿 tokens）由 IT 负载实时推导的算力产出示意，随 IT 负载滑杆联动；非实测数据，仅供演示。',
    p: [['估算口径', '0.6 Wh / 千 tokens'], ['换算关系', '1 MW ≈ 0.46 M tokens/s'], ['数据性质', '推导估算 · 仅供示意']] },
};
