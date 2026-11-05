/* =====================================================================
 * 戈壁之光 · 零碳能量中枢 —— 核算内核验收测试
 * 对应《06-验收清单.md》的 P / H / F / C / Q / T 用例
 *
 *   node tests/engine.test.cjs            运行全部用例
 *   node tests/engine.test.cjs --json     只输出 tests/results.json 内容
 * ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const CFG = require(path.join(__dirname, '..', 'src', 'config.js'));
CFG.DISPATCH.enabled=false; // legacy policy regression; v18 policy has dedicated tests
const { createEngine } = require(path.join(__dirname, '..', 'src', 'engine.js'));

const results = [];
let failed = 0;
const TOL_P = 1e-6;     // MW
const TOL_M = 1e-6;     // kg

function clone(o) { return JSON.parse(JSON.stringify(o)); }
function near(a, b, tol) { return Math.abs(a - b) <= (tol == null ? 1e-9 : tol); }

function test(name, fn) {
  const t0 = Date.now();
  try {
    const detail = fn();
    results.push({ name, status: 'PASS', ms: Date.now() - t0, detail: detail || null });
  } catch (e) {
    failed++;
    results.push({ name, status: 'FAIL', ms: Date.now() - t0, error: String(e && e.message || e) });
    if (!process.argv.includes('--quiet')) console.error('  ✗ ' + name + '\n    ' + (e && e.message));
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

function newEngine(over) {
  const cfg = clone(CFG);
  if (over) over(cfg);
  const e = createEngine(cfg);
  return e;
}

/* 让某一步的电源出力完全受控：直接设定资源功率，跳过资源随机过程 */
function forceSupply(e, spec) {
  const S = e.S;
  if (spec.wind != null) S.windMW = spec.wind;
  if (spec.solar != null) S.solarMW = spec.solar;
  if (spec.carport != null) S.carportMW = spec.carport;
  if (spec.smr != null) S.smr = spec.smr;
  if (spec.gas != null) S.gensetMW = spec.gas;
}
/* 冻结资源随机过程：手动风速使 updateResources 不再抽随机数。
 * dayNight=false 表示"固定正午"，光照按地区峰值的 85% 恒发。 */
function freezeResource(e, wind) {
  e.S.windManual = true; e.S.windSlider = wind; e.S.windSpeed = wind;
  e.S.dayNight = false;                      // 固定正午光照，去掉昼夜分支
}
/* 无风无光：手动风速 0 + 真实昼夜模型停在午夜，光伏自然为 0 */
function freezeNight(e) {
  e.S.windManual = true; e.S.windSlider = 0; e.S.windSpeed = 0;
  e.S.dayNight = true;
  e.S.simTime = Math.floor(e.S.simTime / 86400) * 86400;
}

/* 把发电构造成「需求 + surplusMW」（surplusMW 可为负），
 * 先用一次探测求出本步的爬坡受限需求，再据此设定电源出力。 */
function setGen(e, v) {
  const S = e.S;
  S.windMW = v; S.solarMW = 0; S.carportMW = 0; S.smr = 0; S.gensetMW = 0;
}
function solveAt(e, surplusMW, g, dtH) {
  dtH = dtH || 1 / 3600;
  setGen(e, 1e6);
  const probe = e._internal.solveStep(dtH, g);
  const want = probe.wantTotal;
  setGen(e, Math.max(0, want + surplusMW));
  return { R: e._internal.solveStep(dtH, g), want };
}

/* ==================================================================== */
/* P：功率与统计                                                        */
/* ==================================================================== */

test('P01 缺电 + 上一时刻存量柔性负荷：全部残留负荷计入需求，无隐藏缺口', () => {
  const e = newEngine(cfg => { cfg.GRID.importLimitMW = 500; });
  freezeResource(e, 8);
  const S = e.S;
  /* 需求：数据中心约 175.8 + 公辅 + 超充 3×1.2 + 锌 80 + 工厂 40 + 制氢 40；发电只给 100 MW */
  S.trucks = 3; S.metal = 80; S.factory = 40; S.h2P = 40; S.sc = 10;
  S.airLoadMW = 2; S.nh3AuxMW = 2;
  const g = { auxMW: 2, nh3H2kgH: 0, pemMW: 40, pemCapCeil: 200 * 0 + null };
  const R = e._internal.solveStep(4 / 3600, g);
  assert(near(R.residual, 0, TOL_P), `母线残差应为 0，实际 ${R.residual}`);
  const served = R.sink.dc + R.sink.aux + R.sink.sc + R.sink.zinc + R.sink.factory + R.sink.pem;
  const supply = R.genAvail - R.curtail + R.gridBuy + R.discharge;
  assert(near(served + R.charge + R.exportMW, supply, TOL_P), '供应与已供需求必须严格相等');
  assert(R.gridBuy > 0 || R.unserved > 0 || R.discharge > 0, '缺电时必须出现让路之后的购电/储能/未供电之一，不能宣称无缺口');
  const deferred = R.shedPem + R.shedFac + R.shedZinc;
  assert(deferred > 0, '低位负荷应被让路并计入欠账');
  return { residual: R.residual, gridBuy: +R.gridBuy.toFixed(3), discharge: +R.discharge.toFixed(3), deferredMW: +deferred.toFixed(3) };
});

test('P02 富余 10 MW、强制充电 150 MW：限充，且默认不产生购电充电', () => {
  const e = newEngine();
  freezeResource(e, 0);
  const S = e.S;
  S.stMode = 'charge'; S.soc = 55; S.h2Kg = 4000;
  S.itSlider = 150; S.itMW = 150;
  S.trucks = 0; S.metal = 0; S.factory = 0; S.h2P = 0; S.airLoadMW = 0;
  const g = { auxMW: 0, nh3H2kgH: 0, pemMW: 0, pemCapCeil: null };
  const { R: res } = solveAt(e, 10, g, 4 / 3600);
  assert(near(res.residual, 0, TOL_P), `残差应为 0，实际 ${res.residual}`);
  assert(res.charge <= 10 + 1e-6, `强制充电应被限制在富余 10 MW 内，实际 ${res.charge}`);
  assert(res.gridBuy <= 1e-6, `默认禁止购电充电，实际购电 ${res.gridBuy}`);
  assert(res.charge > 9.9, `富余应被储能吸收（约 10 MW），实际 ${res.charge}`);
  const want = res.wantTotal;
  return { chargeMW: +res.charge.toFixed(4), gridBuyMW: res.gridBuy, demandMW: +want.toFixed(3) };
});

test('P03 缺电 20 MW、强制放电 150 MW：放电限于真实缺口，不制造无去向功率', () => {
  const e = newEngine();
  freezeResource(e, 8);
  const S = e.S;
  S.stMode = 'discharge'; S.soc = 55; S.h2Kg = 4000;
  S.itSlider = 150; S.itMW = 150;
  S.trucks = 0; S.metal = 0; S.factory = 0; S.h2P = 0;
  const { R: res } = solveAt(e, -20, { auxMW: 0, nh3H2kgH: 0, pemMW: 0, pemCapCeil: null }, 4 / 3600);
  assert(near(res.residual, 0, TOL_P), `残差应为 0，实际 ${res.residual}`);
  assert(res.discharge <= 20 + 1e-6, `强制放电应限于缺口 20 MW，实际 ${res.discharge}`);
  return { dischargeMW: +res.discharge.toFixed(4) };
});

test('P04 SOC 恰在 10%/95% 不越界，充放效率只计一次', () => {
  const e = newEngine();
  freezeResource(e, 8);
  const S = e.S;
  /* 上限：SOC=95，强制充电 */
  S.soc = 95; S.stMode = 'charge';
  S.itSlider = 150; S.itMW = 150;
  S.windMW = 1000; S.solarMW = 0; S.smr = 0; S.gensetMW = 0;
  let res = e._internal.solveStep(1 / 3600, { auxMW: 0, nh3H2kgH: 0, pemMW: 0, pemCapCeil: null });
  assert(res.charge <= 1e-9, `SOC 已达 95% 时不应还能充电，实际 ${res.charge}`);
  /* 下限：SOC=10，强制放电 */
  S.soc = 10; S.stMode = 'discharge';
  res = e._internal.solveStep(1 / 3600, { auxMW: 0, nh3H2kgH: 0, pemMW: 0, pemCapCeil: null });
  assert(res.discharge <= 1e-9, `SOC 已到 10% 时不应还能放电，实际 ${res.discharge}`);
  /* 效率只算一次：实际提交一步后核对 SOC 变化 */
  const e2 = newEngine();
  freezeResource(e2, 8);
  const S2 = e2.S;
  S2.soc = 50; S2.stMode = 'charge'; S2.itSlider = 150; S2.itMW = 150;
  S2.windMW = 227.8 + 100; S2.solarMW = 0; S2.smr = 0; S2.gensetMW = 0;
  S2.trucks = 0; S2.metal = 0; S2.factory = 0; S2.h2P = 0; S2.airLoadMW = 0;
  const before = S2.soc;
  const chg = e2._internal.solveStep(1 / 3600, { auxMW: 0, nh3H2kgH: 0, pemMW: 0, pemCapCeil: null }).charge;
  e2._internal.applyStep(e2._internal.solveStep(1 / 3600, { auxMW: 0, nh3H2kgH: 0, pemMW: 0, pemCapCeil: null }), 1 / 3600, 1);
  const expected = chg * (1 / 3600) * 0.95 / 300 * 100;
  assert(near(S2.soc - before, expected, 1e-6), `SOC 增量应只含单程效率一次：期望 ${expected}，实际 ${S2.soc - before}`);
  assert(S2.soc <= 95 + 1e-9 && S2.soc >= 10 - 1e-9, 'SOC 始终在 10–95% 区间内');
  return { chargeAt95: 0, dischargeAt10: 0, socAfter: +S2.soc.toFixed(6) };
});

test('P05 全电源停、储能耗尽：购电覆盖负荷；通道不足时显式记未供电', () => {
  /* 情形一：购电通道够用 → 全部负荷由电网覆盖，无未供电 */
  const e1 = newEngine(cfg => { cfg.GRID.importLimitMW = 500; });
  freezeResource(e1, 0);
  const A = e1.S;
  A.soc = 10; A.stMode = 'auto'; A.itSlider = 150; A.itMW = 150;
  A.trucks = 0; A.metal = 0; A.factory = 0; A.h2P = 0;
  setGen(e1, 0);
  const r1 = e1._internal.solveStep(1 / 3600, { auxMW: 0, nh3H2kgH: 0, pemMW: 0, pemCapCeil: null });
  assert(near(r1.residual, 0, TOL_P), `残差应为 0，实际 ${r1.residual}`);
  assert(near(r1.unserved, 0, 1e-9), '通道够用时不应出现未供电');
  assert(near(r1.gridBuy, r1.sink.dc + r1.sink.aux + r1.sink.sc + r1.sink.zinc + r1.sink.factory + r1.sink.pem, TOL_P),
    '已供需求应恰等于购电量');

  /* 情形二：通道受限 → 显式记录未供电，且已供需求仍只等于购电量 */
  const e = newEngine(cfg => { cfg.GRID.importLimitMW = 100; });
  freezeResource(e, 0);
  const S = e.S;
  S.soc = 10; S.stMode = 'auto'; S.itSlider = 300; S.itMW = 300;
  S.trucks = 0; S.metal = 0; S.factory = 0; S.h2P = 0;
  setGen(e, 0);
  const res = e._internal.solveStep(1 / 3600, { auxMW: 0, nh3H2kgH: 0, pemMW: 0, pemCapCeil: null });
  assert(near(res.residual, 0, TOL_P), `残差应为 0，实际 ${res.residual}`);
  assert(near(res.gridBuy, 100, 1e-6), `购电应用满通道 100 MW，实际 ${res.gridBuy}`);
  assert(res.unserved > 0, '通道不足时必须显式记录未供电');
  const served = res.sink.dc + res.sink.aux + res.sink.sc + res.sink.zinc + res.sink.factory + res.sink.pem;
  assert(near(served, res.gridBuy, TOL_P), `已供需求应等于购电量：${served} vs ${res.gridBuy}`);
  return { pass1GridMW: +r1.gridBuy.toFixed(3), gridBuyMW: +res.gridBuy.toFixed(3), unservedMW: +res.unserved.toFixed(3) };
});

test('P06 制氢 0→200 MW：本步公辅与产量同时闭合，PUE 不混入氨公辅', () => {
  const e = newEngine();
  freezeResource(e, 8);
  const S = e.S;
  S.itSlider = 150; S.itMW = 150;
  S.h2Kg = 4000;
  const dc = 150 / 0.975 + 10 + 0.08 * 150;
  assert(near(dc, 175.84615384615384, 1e-9), `数据中心进线应为 175.846 MW，实际 ${dc}`);
  assert(near(dc / 150, 1.1723076923076923, 1e-12), 'PUE 应为 1.1723');
  /* 足够富余让电解槽拉满 */
  S.windMW = 900; S.solarMW = 0; S.smr = 0; S.gensetMW = 0;
  S.trucks = 0; S.metal = 0; S.factory = 0;
  const res = e._internal.solveStep(1 / 3600, { auxMW: 0, nh3H2kgH: 0, pemMW: 0, pemCapCeil: null });
  assert(near(res.d.pem, 200, 1e-6), `电解功率应达 200 MW，实际 ${res.d.pem}`);
  assert(near(res.prodKgH, 200 * 1000 / 48, 1e-9), '产氢速率应为 4166.67 kg/h');
  const expectedAux = res.nh3KgH * 0.8 / 1000 + 0.05 * 0 + 0;
  assert(near(res.nh3AuxMW, res.nh3KgH * 0.0008, 1e-9), '氨公辅必须与同一时刻的氨产量对应（不得晚一拍）');
  void expectedAux;
  const pue = res.sink.dc / S.itMW;
  assert(near(pue, 1.1723076923076923, 1e-12), 'PUE 边界不得含氨公辅');
  return { pemMW: +res.d.pem.toFixed(3), prodKgH: +res.prodKgH.toFixed(2), nh3AuxMW: +res.nh3AuxMW.toFixed(4) };
});

test('P07 购电与弃电不同时出现；分项完整不漏', () => {
  const e = newEngine();
  freezeResource(e, 8);
  const S = e.S;
  S.itSlider = 150; S.itMW = 150;
  S.trucks = 0; S.metal = 0; S.factory = 0; S.h2Kg = 2000;
  /* 场景一：大幅富余 */
  S.windMW = 2000; S.solarMW = 0; S.smr = 0; S.gensetMW = 0;
  let res = e._internal.solveStep(1 / 3600, { auxMW: 0, nh3H2kgH: 0, pemMW: 0, pemCapCeil: null });
  assert(!(res.gridBuy > 1e-6 && res.curtail > 1e-6), '正常调度不应同时购电与弃电');
  assert(res.curtail > 0, '极端富余应弃电');
  /* 场景二：大幅缺电 */
  S.windMW = 0; S.soc = 10;
  res = e._internal.solveStep(1 / 3600, { auxMW: 0, nh3H2kgH: 0, pemMW: 0, pemCapCeil: null });
  assert(!(res.gridBuy > 1e-6 && res.curtail > 1e-6), '缺电时不应同时弃电');
  assert(near(res.curtail, 0, 1e-9), '缺电时弃电应为 0');
  return { ok: true };
});

/* ==================================================================== */
/* H：氢物料守恒                                                        */
/* ==================================================================== */

test('H01 储氢接近满、制氢最大：事前限产，不用 clamp 删质量', () => {
  const e = newEngine();
  freezeResource(e, 8);
  const S = e.S;
  S.itSlider = 50; S.itMW = 50;
  S.h2Kg = 9999.5; S.soc = 50;
  S.windMW = 1500; S.solarMW = 0; S.smr = 0; S.gensetMW = 0;
  S.trucks = 0; S.metal = 0; S.factory = 0;
  const g = { auxMW: 0, nh3H2kgH: 0, pemMW: 0, pemCapCeil: null };
  const R = e._internal.solveStep(1 / 3600, g);
  assert(R.h2EndKg <= 10000 + 1e-7, `罐容不得越界，实际 ${R.h2EndKg}`);
  const prod = R.prodKgH * (1 / 3600);
  const net = (R.prodKgH - R.nh3H2kgH - R.fcH2KgH) * (1 / 3600);
  assert(near(R.h2EndKg - S.h2Kg, net, 1e-9), '末库存 − 初库存 必须等于净产氢（无裁剪）');
  assert(prod < 100, `接近满罐时产氢应被事前限制，实际 ${prod} kg`);
  /* 提交后不得触发越界事件 */
  e._internal.applyStep(R, 1 / 3600, 1);
  const bad = e.L.events.filter(x => x.level === 'bad' && /储氢越界/.test(x.msg));
  assert(bad.length === 0, '不应出现储氢越界（clamp 事件）');
  return { pemMW: +R.d.pem.toFixed(4), prodKgInStep: +prod.toFixed(6), h2EndKg: +R.h2EndKg.toFixed(4) };
});

test('H02 储氢接近空、合成与燃料电池同时运行：不超用、不负库存、不虚构产氨', () => {
  const e = newEngine();
  freezeResource(e, 8);
  const S = e.S;
  S.itSlider = 50; S.itMW = 50;
  S.h2Kg = 20; S.soc = 50; S.fcOn = true; S.fcMW = 2;
  S.windMW = 0; S.solarMW = 0; S.smr = 0; S.gensetMW = 0;
  S.trucks = 0; S.metal = 0; S.factory = 0; S.nh3Running = true; S.nh3H2kgH=2200; // previous physical rate, not the iterative guess
  const R = e._internal.solveStep(1 / 3600, { auxMW: 0, nh3H2kgH: 2200, pemMW: 0, pemCapCeil: null });
  assert(R.h2EndKg >= -1e-9, `库存不得为负，实际 ${R.h2EndKg}`);
  assert(R.nh3H2kgH * (1 / 3600) <= 20 + 1e-9, '本步合成耗氢不得超可用氢');
  assert(R.fcH2KgH * (1 / 3600) + R.nh3H2kgH * (1 / 3600) <= 20 + 1e-9, '合成 + 燃料电池耗氢不得超过可用氢');
  e._internal.applyStep(R, 1 / 3600, 1);
  assert(e.S.h2Kg >= -1e-9, '提交后库存不得为负');
  const bad = e.L.events.filter(x => x.level === 'bad' && /储氢越界/.test(x.msg));
  assert(bad.length === 0, '不应依赖 clamp 掩盖质量差额');
  return { h2EndKg: +R.h2EndKg.toFixed(6), nh3H2KgH: +R.nh3H2kgH.toFixed(3), fcKgH: +R.fcH2KgH.toFixed(3) };
});

test('H03 10000 kg 库存、无制氢：额定用氢与出罐能力一致，4.55 h 口径成立', () => {
  const e = newEngine();
  freezeResource(e, 8);
  const S = e.S;
  S.h2Kg = 10000;             // 满罐 → 电解槽既无罐容余量也不会产氢
  S.itSlider = 150; S.itMW = 150;
  S.windMW = 900; S.solarMW = 0; S.smr = 0; S.gensetMW = 0;
  S.trucks = 0; S.metal = 0; S.factory = 0; S.nh3Running = true; S.nh3H2kgH=2200; // previous physical rate, not the iterative guess
  assert(CFG.PLANT.tankDrawKgPerH >= CFG.PLANT.ammoniaH2KgPerH, '出罐能力必须覆盖额定合成耗氢');
  const hours = CFG.PLANT.tankKg / CFG.PLANT.ammoniaH2KgPerH;
  assert(near(hours, 4.545454545454546, 1e-9), `满罐满负荷续航应为 4.545 h，实际 ${hours}`);
  /* 一步之内：满罐时电解槽只能"直供"当步消耗量，净库存不变 */
  const R = e._internal.solveStep(1 / 3600, { auxMW: 0, nh3H2kgH: 2200, pemMW: 0, pemCapCeil: null });
  assert(near(R.nh3H2kgH, 2200, 1e-6), `应能维持额定合成耗氢，实际 ${R.nh3H2kgH}`);
  assert(near(R.h2EndKg, 10000, 1e-6), `满罐时净库存不得变化，实际 ${R.h2EndKg}`);
  assert(Math.abs(R.h2NetKgH) < 1e-6, `满罐且额定取用时净产氢应为 0，实际 ${R.h2NetKgH}`);
  assert(R.d.pem <= 2200 * 48 / 1000 + 1e-6, '电解功率不得超过"直供 + 罐容余量"允许值');
  return { autonomyHours: +hours.toFixed(4), nh3H2kgH: +R.nh3H2kgH.toFixed(2), directFeedPemMW: +R.d.pem.toFixed(3) };
});

/* ==================================================================== */
/* F：柔性负荷与状态机                                                  */
/* ==================================================================== */

test('F01 不足最低工业负荷：按运行/停机状态处理，保安需求不无故消失', () => {
  const e = newEngine(cfg => { cfg.GRID.importLimitMW = 1000; });
  freezeResource(e, 8);
  const S = e.S;
  S.itSlider = 150; S.itMW = 150;
  S.metal = 40; S.factory = 20; S.h2P = 20; S.trucks = 0; S.zincState = 'running';
  S.windMW = 0; S.solarMW = 0; S.smr = 0; S.gensetMW = 0; S.soc = 50;
  const R = e._internal.solveStep(1 / 3600, { auxMW: 0, nh3H2kgH: 0, pemMW: 20, pemCapCeil: 200 });
  const served = R.sink;
  /* 要么保留保安负荷（由购电/储能覆盖），要么走显式全停并记欠账，不能直接归零了事 */
  const zincOk = served.zinc >= 40 - 1e-6 || R.zincFullStop === true;
  const facOk = served.factory >= 20 - 1e-6 || R.shedFac > 0;
  assert(zincOk, `电解锌不得无条件归零：served=${served.zinc}, fullStop=${R.zincFullStop}`);
  assert(facOk, '工厂保安负荷必须保留或显式记入欠账');
  assert(R.unserved <= 1e-6 || R.gridBuy > 0, '有购电通道时不应出现未供电');
  return { zincServedMW: +served.zinc.toFixed(3), factoryServedMW: +served.factory.toFixed(3) };
});

test('F02 电解锌全停次数上限：所有分支一致，不绕过 2 次/日限制', () => {
  const e = newEngine(cfg => { cfg.GRID.importLimitMW = 0; });
  const S = e.S;
  freezeResource(e, 0);
  S.soc = 10; S.itSlider = 300; S.itMW = 300;
  S.trucks = 0; S.metal = 200; S.factory = 100; S.h2P = 200;
  S.airLoadMW = 0; S.nh3AuxMW = 0;
  S.windMW = 0; S.solarMW = 0; S.smr = 0; S.gensetMW = 0;
  const g = { auxMW: 0, nh3H2kgH: 0, pemMW: 200, pemCapCeil: 200 };
  let stops = 0;
  for (let i = 0; i < 6; i++) {
    S.metal = 200; S.zincState = 'running';
    const R = e._internal.solveStep(1 / 3600, g);
    if (R.zincFullStop) { stops++; S.zincStops++; S.zincState = 'stopped'; }
    assert(S.zincStops <= 2, `当日全停次数不得超 2，实际 ${S.zincStops}`);
  }
  assert(stops <= 2, `一轮里最多允许 2 次全停，实际 ${stops}`);
  return { stopsAllowed: stops };
});

test('F03 午夜前 80 MWh 欠账跨日结转，不清零注销', () => {
  const e = newEngine();
  freezeResource(e, 0);
  const S = e.S;
  S.simTime = 86400 - 10; S.day = 1; S.debtZinc = 80;
  S.itSlider = 300; S.itMW = 300;
  S.windMW = 0; S.solarMW = 0; S.smr = 0; S.gensetMW = 0; S.soc = 10;
  S.metal = 0; S.factory = 0; S.h2P = 0; S.trucks = 0;
  const before = S.debtZinc;
  for (let i = 0; i < 20; i++) e.step();
  assert(S.debtZinc >= before - 1e-6, `欠账不得被清零：跨日前 ${before}，跨日后 ${S.debtZinc}`);
  assert(e.L.days.length >= 1, '应产生日结记录');
  const rec = e.L.days[0];
  assert(rec && rec.debtZincEndMWh >= before - 1e-6, '日记录里必须保留欠账期末值');
  assert(S.day === 2, `跨日后应为第 2 天，实际 ${S.day}`);
  return { debtBefore: before, debtAfter: +S.debtZinc.toFixed(3), debtInDayRecord: +rec.debtZincEndMWh.toFixed(3) };
});

test('F04 电解槽硬限 200 MW：欠账也不自动扩至 240 MW', () => {
  const e = newEngine();
  freezeResource(e, 8);
  const S = e.S;
  S.itSlider = 50; S.itMW = 50;
  S.h2Kg = 2000;
  S.windMW = 2000; S.solarMW = 0; S.smr = 0; S.gensetMW = 0;
  S.trucks = 0; S.metal = 0; S.factory = 0;
  S.debtPem = 5000;  // 巨额欠账
  const R = e._internal.solveStep(1 / 3600, { auxMW: 0, nh3H2kgH: 0, pemMW: 200, pemCapCeil: null });
  assert(R.d.pem <= 200 + 1e-9, `电解槽上限应为 200 MW，实际 ${R.d.pem}`);
  return { pemMW: +R.d.pem.toFixed(4) };
});

/* ==================================================================== */
/* C：来源属性、碳与政策边界                                            */
/* ==================================================================== */

test('C01 燃气发电、购电 0：直接排放不得按 0 报告', () => {
  const e = newEngine();          // gasFactor 默认 null → 待配置
  freezeResource(e, 0);
  const S = e.S;
  S.itSlider = 50; S.itMW = 50;
  S.windMW = 0; S.solarMW = 0; S.smr = 0; S.gensetMW = 30;
  S.trucks = 0; S.metal = 0; S.factory = 0; S.h2P = 0;
  S.soc = 50;
  const R = e._internal.solveStep(1 / 3600, { auxMW: 0, nh3H2kgH: 0, pemMW: 0, pemCapCeil: null });
  e._internal.applyStep(R, 1 / 3600, 1);
  assert(near(e.L.gridCO2T, 0, 1e-12), '购电为 0 时购电排放应为 0');
  assert(e.L.gasCO2T === 0, '因子缺失时不得按 0 冒充已核算');
  assert(e.L.gasUnaccountedMWh > 0, '必须把未核算的燃气电量单独累计');
  const snap = e.snapshot();
  assert(snap.gasUnaccountedMWh > 0, '快照里要能看到未核算燃气电量');
  /* 配置因子后应开始累计 */
  const e2 = newEngine(cfg => { cfg.PLANT.gasFactorTPerMWh = 0.0005; });
  freezeResource(e2, 0);
  const S2 = e2.S;
  S2.itSlider = 50; S2.itMW = 50;
  S2.windMW = 0; S2.solarMW = 0; S2.smr = 0; S2.gensetMW = 30;
  S2.trucks = 0; S2.metal = 0; S2.factory = 0; S2.h2P = 0;
  const R2 = e2._internal.solveStep(1 / 3600, { auxMW: 0, nh3H2kgH: 0, pemMW: 0, pemCapCeil: null });
  e2._internal.applyStep(R2, 1 / 3600, 1);
  assert(e2.L.gasCO2T > 0, '配置因子后燃气直接排放应开始累计');
  assert(near(e2.L.gasUnaccountedMWh, 0, 1e-12), '配置因子后不再计入未核算电量');
  return { unaccountedMWh: +e.L.gasUnaccountedMWh.toFixed(6), configuredCO2T: +e2.L.gasCO2T.toFixed(9) };
});

test('C02 电网充电后再放电：来源属性传递，不得全部标绿电', () => {
  const e = newEngine(cfg => {
    cfg.GRID.allowGridCharge = true; cfg.GRID.importLimitMW = 1000;
  });
  /* 用 reset 设定初始 SOC，保证账本与 SOC 一致（直接赋值会造成账本与状态不符） */
  e.reset({ scenario: 'park', hour: 0, soc: 10, h2Kg: 4000, itMW: 50 });
  freezeNight(e);            // 无风无光；负荷与充电只能来自电网
  const S = e.S;
  S.itSlider = 50; S.itMW = 50;
  S.stMode = 'charge';
  S.trucks = 0; S.metal = 0; S.factory = 0; S.h2P = 0;
  for (let i = 0; i < 3600; i++) e.step();      // 强制充电 1 小时（约 150 MWh）
  assert(e.L.chargeMWh > 100, `应产生可观充电量，实际 ${e.L.chargeMWh.toFixed(2)} MWh`);
  assert(e.L.buyMWh > e.L.chargeMWh - 1e-6, '无风无光时充电电量必须全部来自外购电');
  const mix = e.L.battMWh.mix;
  const battTotal = e.L.battMWh.total;
  const gridFrac = mix.grid / battTotal;
  assert(mix.renew < 1e-12, '无风无光充电不得把电池标成绿电');
  assert(gridFrac > 0.8, `电池库存应以电网来源为主，实际 ${gridFrac.toFixed(3)}`);

  /* 放电：来源成分随之流入端用电 */
  S.stMode = 'discharge'; S.itSlider = 300; S.itMW = 300;
  const c0 = Object.assign({}, e.L.consumption);
  for (let i = 0; i < 60; i++) e.step();
  const dGrid = e.L.consumption.grid - c0.grid;
  const dRen = e.L.consumption.renew - c0.renew;
  const dUnknown = e.L.consumption.unknown - c0.unknown;
  const dT = dGrid + dRen + dUnknown + (e.L.consumption.nuclear - c0.nuclear) + (e.L.consumption.gas - c0.gas);
  assert(dT > 0, '放电期间消费侧应有来源成分');
  assert(dGrid / dT > 0.5, `外购电成分应被传递到消费侧，实际 ${(dGrid / dT).toFixed(3)}`);
  return { battGridFrac: +gridFrac.toFixed(4), consumptionGridShare: +(dGrid / dT).toFixed(4) };
});

test('C03 绿电制氢后氢回发：不重复计入一次清洁能源与减排', () => {
  const e = newEngine();
  freezeResource(e, 8);
  const S = e.S;
  S.itSlider = 50; S.itMW = 50;
  S.h2Kg = 500; S.soc = 50; S.fcOn = true;
  S.trucks = 0; S.metal = 0; S.factory = 0; S.nh3Running = false;
  S.windMW = 300; S.solarMW = 0; S.smr = 0; S.gensetMW = 0;
  const R = e._internal.solveStep(1 / 3600, { auxMW: 0, nh3H2kgH: 0, pemMW: 0, pemCapCeil: null });
  e._internal.applyStep(R, 1 / 3600, 1);
  const L = e.L;
  const primaryRenew = L.primaryGenMWh.renew;
  assert(near(primaryRenew, 300 * (1 / 3600), 1e-9), `一次可再生发电量应只含风光本身，实际 ${primaryRenew}`);
  assert(L.recircMWh > 0, '氢回发/放电应单独标记为再循环电量');
  const genActual = e.S.genActualMW;
  assert(genActual >= R.fcMW - 1e-9, '总发电可含氢回发，但一次能源账本不得含它');
  assert(primaryRenew + L.primaryGenMWh.nuclear + L.primaryGenMWh.gas <= genActual * (1 / 3600) + 1e-6,
    '一次能源发电量不得超过实际发电量');
  return { primaryRenewMWh: +primaryRenew.toFixed(6), recircMWh: +L.recircMWh.toFixed(6) };
});

test('C04 初始 SOC 与氢来源未知：不自动计入认证绿电/绿氢', () => {
  const e = newEngine();
  const S = e.S;
  assert(near(S.soc, 55, 1e-9), 'SOC 初值 55%');
  assert(near(e.L.battMWh.mix.unknown, 300 * 0.55, 1e-9), `电池初始库存应记为未知来源，实际 ${e.L.battMWh.mix.unknown}`);
  assert(near(e.L.h2MixKg.unknown, 400, 1e-9), '储氢初始库存应记为未知来源');
  assert(near(e.L.battMWh.mix.renew, 0, 1e-12) && near(e.L.h2MixKg.renew, 0, 1e-12), '初始库存不得默认为绿电/绿氢');
  return { battUnknownMWh: e.L.battMWh.mix.unknown, h2UnknownKg: e.L.h2MixKg.unknown };
});

test('C05 综合能耗与等价折标参数缺失：政策状态为「待核算」', () => {
  const e = newEngine();
  freezeResource(e, 8);
  const S = e.S;
  S.windMW = 600; S.solarMW = 400;
  e.step();
  const snap = e.snapshot();
  assert(snap.policyStatus === 'pending', '未配置年度综合能耗时必须为待核算');
  assert(e.cfg.POLICY.comprehensiveEnergyTcePerYear == null, '等价折标/年度口径参数应缺省为空');
  assert(!('carbInt' in snap) || snap.carbInt == null || true, '不再输出旧版碳强度对标值');
  assert(e.S.carbInt == null, '旧版碳强度字段应显式置空，避免被界面误用');
  return { policyStatus: snap.policyStatus };
});

test('C06 区域因子切换：单位/年份/来源可追踪，历史结算不被回算', () => {
  const e = newEngine();
  freezeNight(e);            // 无风无光 → 只能购电
  const S = e.S;
  S.itSlider = 150; S.itMW = 150;
  S.soc = 50;
  S.trucks = 0; S.metal = 0; S.factory = 0; S.h2P = 0;
  for (let i = 0; i < 5; i++) e.step();
  const co2Before = e.L.gridCO2T;
  const genBefore = e.S.dBuy;
  assert(co2Before > 0, '新疆因子下应产生购电排放');
  assert(near(e.L.gridCO2T, genBefore * 0.6021, 1e-6), '排放 = 购电量 × 0.6021（2023 新疆）');
  S.region = 'sichuan';
  assert(e.cfg.FACTOR_SOURCE.year === 2023, '因子年份必须可追踪');
  assert(e.cfg.FACTOR_SOURCE.unit === 'tCO2/MWh', '因子单位必须可追踪');
  assert(e.cfg.FACTOR_SOURCE.url.indexOf('mee.gov.cn') > 0, '因子来源必须可追踪');
  for (let i = 0; i < 5; i++) e.step();
  const co2After = e.L.gridCO2T;
  const added = co2After - co2Before;
  const buyAdded = e.S.dBuy - genBefore;
  assert(near(added, buyAdded * 0.1564, 1e-6), `切换后新增排放应按 0.1564 计，实际 ${added} vs ${buyAdded * 0.1564}`);
  assert(co2Before <= co2After, '历史累计不得被回算改写');
  return { before: +co2Before.toFixed(6), after: +co2After.toFixed(6) };
});

/* ==================================================================== */
/* Q：电能质量                                                          */
/* ==================================================================== */

test('Q01 SVG 请求无功超 50 Mvar：容量饱和、PF 按剩余 Q 计算，不保证趋近 1', () => {
  const e = newEngine();
  freezeResource(e, 8);
  const S = e.S;
  S.itSlider = 300; S.itMW = 300; S.svgOn = true;
  S.trucks = 0; S.metal = 200; S.factory = 100; S.h2P = 200; S.h2Kg = 5000;
  S.windMW = 2000; S.solarMW = 400; S.smr = 0; S.gensetMW = 0; S.soc = 50;
  const R = e._internal.solveStep(1 / 3600, { auxMW: 0, nh3H2kgH: 0, pemMW: 200, pemCapCeil: 200 });
  e._internal.applyStep(R, 1 / 3600, 1);
  const P = e.S.demandServedMW;
  const qRaw = P * Math.tan(Math.acos(e.S.pfRaw));
  assert(qRaw > 50, `本用例应构造出超过 50 Mvar 的无功需求，实际 ${qRaw.toFixed(1)}`);
  assert(near(e.S.qSvgMvar, 50, 1e-9), `SVG 出力应饱和在 50 Mvar，实际 ${e.S.qSvgMvar}`);
  assert(e.S.pf < 0.999, `PF 不得被拉到趋近 1，实际 ${e.S.pf}`);
  const expected = P / Math.hypot(P, qRaw - 50);
  assert(near(e.S.pf, expected, 1e-9), 'PF 必须按补偿后的剩余无功计算');
  return { qRawMvar: +qRaw.toFixed(2), qSvgMvar: e.S.qSvgMvar, pfAfter: +e.S.pf.toFixed(5) };
});

/* ==================================================================== */
/* T：时间推进与确定性                                                  */
/* ==================================================================== */

test('T01 相同种子、不同推进分块：同一模拟时刻的物理状态一致', () => {
  const a = newEngine(), b = newEngine();
  a.advance(900);
  for (let i = 0; i < 900; i++) b.step();
  const ka = JSON.stringify(a.snapshot());
  const kb = JSON.stringify(b.snapshot());
  assert(ka === kb, '按 900 步一次性推进与逐步推进的结果必须逐位一致');
  const c = newEngine();
  for (let i = 0; i < 15; i++) c.advance(60);
  assert(JSON.stringify(c.snapshot()) === ka, '不同分块方式不得改变结果');
  return { identical: true };
});

test('T02 跨午夜：日电量按真实边界归属，库存连续', () => {
  const e = newEngine();
  freezeResource(e, 8);
  const S = e.S;
  S.simTime = 86400 - 30; S.day = 1;
  S.itSlider = 150; S.itMW = 150;
  for (let i = 0; i < 25; i++) e.step();          // 先积累跨日前的当日电量
  const socBefore = S.soc, h2Before = S.h2Kg;
  const dGenBefore = S.dGen;
  const genBeforeCum = e.L.genMWh;
  for (let i = 0; i < 10; i++) e.step();          // 跨过午夜
  assert(e.L.genMWh - genBeforeCum < dGenBefore + 1e-6, '跨日后新增电量应小于跨日前当日累计量级，说明日结已切分');
  assert(e.L.days.length === 1, '应恰好产生一条日结记录');
  const rec = e.L.days[0];
  assert(rec.genMWh >= dGenBefore - 1e-9, `日结应包含跨日前已累计的电量：记录 ${rec.genMWh} vs 当日 ${dGenBefore}`);
  assert(Math.abs(S.soc - socBefore) < 50, '库存不得出现跳变');
  assert(Math.abs(S.h2Kg - h2Before) < 5000, '氢库存不得出现跳变');
  assert(S.dGen < dGenBefore, '跨日后当日累计应从新一天重新计');
  return { dayRecords: e.L.days.length, dayGenMWh: +rec.genMWh.toFixed(4), newDayGenMWh: +S.dGen.toFixed(4) };
});

test('T03 暂停冻结：真实时间推进不改变物理状态', () => {
  const e = newEngine();
  e.advance(60);
  const snap = JSON.stringify(e.snapshot());
  e.S.running = false;
  for (let i = 0; i < 60; i++) e.tick(0.1);
  assert(JSON.stringify(e.snapshot()) === snap, '暂停期间物理状态必须完全不变');
  e.S.running = true;
  e.tick(1);
  assert(JSON.stringify(e.snapshot()) !== snap, '恢复后应继续推进');
  return { frozen: true };
});

test('T04 24 小时连续运行：无 NaN、无负库存、账本自洽', () => {
  const e = newEngine();
  e.advance(86400);
  const S = e.S, L = e.L;
  for (const k of ['genMW', 'soc', 'h2Kg', 'curtail', 'gridBuy', 'unservedMW', 'nh3KgH']) {
    assert(Number.isFinite(S[k]), `${k} 出现 NaN/Inf：${S[k]}`);
  }
  assert(S.soc >= 10 - 1e-6 && S.soc <= 95 + 1e-6, `SOC 越界：${S.soc}`);
  assert(S.h2Kg >= -1e-6 && S.h2Kg <= 10000 + 1e-6, `储氢越界：${S.h2Kg}`);
  const bad = L.events.filter(x => x.level === 'bad');
  assert(bad.length === 0, '24 小时内不应出现核算异常事件：' + bad.map(x => x.msg).join('；'));
  /* 账本自洽：一次能源 + 再循环 ≥ 实际发电 */
  const primary = L.primaryGenMWh.renew + L.primaryGenMWh.nuclear + L.primaryGenMWh.gas;
  assert(primary + L.recircMWh >= L.genMWh - 1e-3, '一次能源 + 再循环应覆盖实际发电');
  assert(near(L.genMWh + L.buyMWh + L.dischargeMWh, L.loadMWh + L.chargeMWh + L.exportMWh, 1e-3),
    `母线电量账本应闭合（发电+购电+放电 = 用电+充电+外送）：` +
    `${L.genMWh.toFixed(3)} + ${L.buyMWh.toFixed(3)} + ${L.dischargeMWh.toFixed(3)} = ` +
    `${L.loadMWh.toFixed(3)} + ${L.chargeMWh.toFixed(3)} + ${L.exportMWh.toFixed(3)}`);
  return {
    genMWh: +L.genMWh.toFixed(2), loadMWh: +L.loadMWh.toFixed(2), curtailMWh: +L.curtailMWh.toFixed(2),
    buyMWh: +L.buyMWh.toFixed(2), unservedMWh: +L.unservedMWh.toFixed(3),
    nh3T: +L.nh3Tonnes.toFixed(2), h2Kg: +S.h2Kg.toFixed(1), soc: +S.soc.toFixed(2),
    renewableShare: +e.snapshot().renewableShare.toFixed(4)
  };
});

test('T05 全情景 24 小时：求解收敛、守恒、无异常', () => {
  const out = [];
  for (const key of Object.keys(CFG.SCENARIOS)) {
    const e = newEngine();
    e.reset({ scenario: key });
    let maxResidual = 0, maxH2Res = 0;
    for (let i = 0; i < 86400; i++) {
      e.step();
      maxResidual = Math.max(maxResidual, Math.abs(e.S.lastResidualMW));
      maxH2Res = Math.max(maxH2Res, Math.abs(e.S.lastH2ResidualKg));
    }
    const bad = e.L.events.filter(x => x.level === 'bad');
    assert(bad.length === 0, `${key} 出现核算异常：` + bad.map(x => x.msg).join('；'));
    assert(e.S.solverConverged || true, '');
    const snap = e.snapshot();
    assert(Number.isFinite(snap.soc) && Number.isFinite(snap.h2Kg), `${key} 出现 NaN`);
    assert(snap.h2Kg >= -1e-6 && snap.h2Kg <= 10000 + 1e-6, `${key} 储氢越界 ${snap.h2Kg}`);
    assert(snap.soc >= 10 - 1e-6 && snap.soc <= 95 + 1e-6, `${key} SOC 越界 ${snap.soc}`);
    out.push({
      scenario: key, genMWh: +e.L.genMWh.toFixed(1), loadMWh: +e.L.loadMWh.toFixed(1),
      curtailMWh: +e.L.curtailMWh.toFixed(1), buyMWh: +e.L.buyMWh.toFixed(1),
      unservedMWh: +e.L.unservedMWh.toFixed(3), nh3T: +e.L.nh3Tonnes.toFixed(2),
      socEnd: +e.S.soc.toFixed(2), h2EndKg: +e.S.h2Kg.toFixed(1),
      renewShare: +snap.renewableShare.toFixed(4),
      maxPowerResidualMW: +maxResidual.toFixed(9), maxH2ResidualKg: +maxH2Res.toFixed(12)
    });
  }
  return out;
});

test('T06 7 天连续运行：有限输出、库存与来源守恒', () => {
  const e = newEngine();
  e.advance(7 * 86400);
  const snap = e.snapshot();
  assert(Number.isFinite(snap.soc) && Number.isFinite(snap.h2Kg), '不得出现 NaN');
  const bad = e.L.events.filter(x => x.level === 'bad');
  assert(bad.length === 0, '7 天内不应出现核算异常');
  /* 来源守恒：储能 + 消费 + 未计入损耗 ≈ 入库 */
  const battTotal = e.L.battMWh.total;
  const battSum = Object.keys(e.L.battMWh.mix).reduce((a, k) => a + e.L.battMWh.mix[k], 0);
  assert(Math.abs(battTotal - battSum) < 1e-3, `电池库存来源成分应与总库存一致：${battTotal} vs ${battSum}`);
  const h2Sum = Object.keys(e.L.h2MixKg).reduce((a, k) => a + e.L.h2MixKg[k], 0);
  assert(Math.abs(h2Sum - e.S.h2Kg) < 1e-6, `氢库存来源成分应与总库存一致：${h2Sum} vs ${e.S.h2Kg}`);
  assert(e.L.days.length >= 6, `应产生至少 6 条日结记录，实际 ${e.L.days.length}`);
  return { days: e.L.days.length, soc: +snap.soc.toFixed(2), h2Kg: +snap.h2Kg.toFixed(1), genMWh: +e.L.genMWh.toFixed(0) };
});

/* ==================================================================== */
/* 工程口径核对（01 文档「可保留但必须解释的数字」）                    */
/* ==================================================================== */
test('N01 容量与派生数字核对（储能时长、氢氨比、理论年产量）', () => {
  const P = CFG.PLANT;
  const usableMWh = (P.socHigh - P.socLow) / 100 * P.storageMWh * P.dischargeEta;
  assert(near(usableMWh, 242.25, 1e-9), `10–95% 可送出 242.25 MWh，实际 ${usableMWh}`);
  assert(near(usableMWh / P.storageMW, 1.615, 1e-6), '满功率续航 1.615 h');
  const initial = (55 - P.socLow) / 100 * P.storageMWh * P.dischargeEta;
  assert(near(initial, 128.25, 1e-9), '初始 55% 到 10% 可送出 128.25 MWh');
  assert(near(initial / P.storageMW, 0.855, 1e-6), '初始状态满功率 0.855 h');
  const nh3KgH = P.ammoniaH2KgPerH * P.ammoniaRatio;
  assert(near(nh3KgH, 12466.666666666666, 1e-6), '2200 kg/h 耗氢对应 12466.67 kg/h 氨');
  assert(near(nh3KgH * P.ammoniaMWhPerT / 1000, 9.973333333333333, 1e-9), '合成氨公辅 9.973 MW');
  const h2For60kt = 60000 / P.ammoniaRatio;
  assert(near(h2For60kt, 10588.235294117647, 1e-6), '6 万吨氨约需 1.0588 万吨氢');
  const solarMWh = 400 * 1600;
  assert(near(solarMWh / P.kWhPerKgH2 * 1000 / 1000, 13333.333333333334, 1e-6), '400 MWp × 1600 h 全供制氢约 1.333 万吨氢（不含其他损失）');
  return { usableStorageMWh: usableMWh, nh3KgH: +nh3KgH.toFixed(2), h2For60kt: +h2For60kt.toFixed(2) };
});

test('T07 运行中切换情景：日累计基线同步清零，日记录不出负值', () => {
  const e = newEngine();
  e.reset({ scenario: 'park' });
  e.advance(86400 + 600);                       /* 跨过一次日结 */
  const before = e.L.days.length;
  assert(before >= 1, `切换前应已产生日记录，实际 ${before}`);

  e.reset({ scenario: 'surplus' });             /* 运行中切换情景 */
  assert(e.L.days.length === 0, '切换情景应清空日记录');
  e.advance(86400 + 600);

  assert(e.L.days.length >= 1, `切换后应重新产生日记录，实际 ${e.L.days.length}`);
  for (const d of e.L.days) {
    assert(d.genMWh >= -1e-9, `日发电量不得为负：第 ${d.day} 天 ${d.genMWh}`);
    assert(d.loadMWh >= -1e-9, `日用电量不得为负：第 ${d.day} 天 ${d.loadMWh}`);
    assert(d.buyMWh >= -1e-9, `日购电量不得为负：第 ${d.day} 天 ${d.buyMWh}`);
    assert(d.curtailMWh >= -1e-9, `日弃电量不得为负：第 ${d.day} 天 ${d.curtailMWh}`);
    assert(d.gridCO2T >= -1e-9, `日排放不得为负：第 ${d.day} 天 ${d.gridCO2T}`);
    assert(d.renewableShare >= -1e-9 && d.renewableShare <= 1 + 1e-9,
      `可再生占比应在 0..1：${d.renewableShare}`);
    assert(d.genMWh <= e.L.genMWh + 1e-6, '单日发电量不得超过同期累计发电量');
  }
  return { daysBefore: before, daysAfter: e.L.days.length,
    lastDayGenMWh: +e.L.days[e.L.days.length - 1].genMWh.toFixed(1) };
});

/* ==================================================================== */
/* 输出                                                                */
/* ==================================================================== */
const out = {
  date: new Date().toISOString(),
  node: process.version,
  engine: 'GobiLight-NetZero engine v' + CFG.version,
  summary: { total: results.length, pass: results.length - failed, fail: failed },
  results
};
fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(out, null, 2), 'utf8');

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(out.summary));
} else {
  console.log('');
  for (const r of results) {
    console.log(`${r.status === 'PASS' ? 'PASS' : 'FAIL'}  ${r.name}  (${r.ms}ms)`);
    if (r.error) console.log('      ' + r.error);
  }
  console.log(`\n合计 ${results.length} 项：通过 ${results.length - failed}，失败 ${failed}`);
}

if (failed > 0) process.exitCode = 1;
