/* =====================================================================
 * 原版内核反例复现 —— 把"原版错在哪"从断言变成可重跑的观察
 *
 *   node tests/original-counterexamples.cjs
 *
 * 为什么需要它：DATA-CHANGES.md 里列了原版的若干处口径/守恒问题。
 * 只写结论是不可核查的；本脚本把原文件里的内核段抽出来、单独在 Node 里
 * 驱动（每个探针用全新上下文，互不污染），对每个问题构造最小场景，
 * 记录**实际观察到的数字**，落盘 tests/original-counterexamples.json。
 *
 * 判定纪律：
 *   observed        —— 构造出的数字确实支持该描述
 *   not-reproduced  —— 本次构造未出现该现象（不据此断言"无此问题"）
 *   unverified      —— 抽不出、驱动不了、或字段对不上
 * 原文件只读，不做任何改写。
 * ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const ORIGINAL = path.join(ROOT, 'original', 'Net-Zero-grid-simulation-20260722.html');
const OUT = path.join(ROOT, 'tests', 'original-counterexamples.json');

/* 与 build.cjs 相同的抽取口径 */
function extractScripts(html) {
  const out = [];
  const re = /<script\b[^>]*>/g;
  let m;
  while ((m = re.exec(html))) {
    const start = m.index + m[0].length;
    const end = html.indexOf('</script>', start);
    if (end < 0) throw new Error('内联脚本未闭合');
    out.push(html.slice(start, end));
    re.lastIndex = end;
  }
  return out;
}

/* 固定随机数流：原内核用 Math.random 造风机扰动与车流，
 * 不固定就无法逐位复现两次相同的观察值。 */
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function newKernel(code) {
  const el = () => ({
    style: {}, classList: { add() { }, remove() { }, toggle() { }, contains() { return false; } },
    addEventListener() { }, appendChild() { }, getContext: () => null,
    textContent: '', innerHTML: '', value: '', checked: false,
    querySelector: () => null, querySelectorAll: () => []
  });
  const doc = {
    body: el(), documentElement: el(),
    getElementById: () => el(), querySelector: () => el(), querySelectorAll: () => [],
    createElement: () => el(), addEventListener() { }
  };
  const M = Object.create(Math);
  M.random = mulberry32(20260917);
  const sandbox = {
    console: { log() { }, warn() { } }, Math: M, Date, JSON,
    parseFloat, parseInt, isFinite, isNaN, String, Number, Array, Object,
    document: doc, performance: { now: () => Date.now() },
    requestAnimationFrame: () => 0, setTimeout, clearTimeout
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  /* 内核只依赖两个本段之外的符号，这里按同一语义补上，不搬表现层代码：
   *   TURB_POS      —— 场景段建的 3×4 机位；simStep 读它的 length 做 12→100 台外推
   *   lampLevel()   —— 表现层的路灯强度；内核只用来算 0.05 MW 象征性路灯负荷
   *   rebuildTicker —— 往页面告警条写 DOM，与物理无关，置空
   *   auxOf()       —— 复刻 simStep 里氨公辅负荷与产氢量的换算，用于检验"晚一拍" */
  vm.runInContext(
    'const TURB_POS=(function(){const a=[];' +
    'for(let r=0;r<3;r++)for(let c=0;c<4;c++)a.push([-100+c*20+(r%2)*4,-26+r*26]);return a;})();\n' +
    'function lampLevel(){ if(!S.dayNight) return 0; return 1; }\n' +
    'function rebuildTicker(){}\n' +
    'function auxOf(p){ return Math.min(K.NH3_H2_MAX, p*1000/K.H2_KWH_PER_KG + (S.h2Kg>1?60:0))' +
    ' * K.NH3_RATIO * K.NH3_AUX_MW_PER_KGH; }\n',
    ctx, { filename: 'sandbox-compat.js' });
  vm.runInContext(code, ctx, { filename: 'original-kernel.js' });
  const run = expr => vm.runInContext(expr, ctx);
  const js = expr => JSON.parse(run('JSON.stringify(' + expr + ')'));
  return { run, js, ctx };
}

const rows = [];
function record(id, title, claim, fn) {
  let status = 'unverified', observed = null, note = '';
  try {
    const r = fn();
    status = (r && r.status) || 'observed';
    observed = r && r.observed !== undefined ? r.observed : (r || null);
    note = (r && r.note) || '';
  } catch (e) {
    status = 'unverified';
    note = String((e && e.message) || e);
  }
  rows.push({ id, title, claim, status, observed, note });
  const tag = { observed: '已复现', 'not-reproduced': '未复现', unverified: '未能验证' }[status];
  console.log('  ' + (status === 'observed' ? '✓' : status === 'not-reproduced' ? '×' : '?') +
    ' ' + id.padEnd(4) + ' ' + tag + '  ' + title);
  if (observed !== null && observed !== undefined) {
    const s = JSON.stringify(observed);
    console.log('        ' + (s.length > 300 ? s.slice(0, 300) + '…' : s));
  }
  if (note) console.log('        说明：' + note);
}

function main() {
  const html = fs.readFileSync(ORIGINAL, 'utf8');
  const segs = extractScripts(html);
  console.log('原文件内联脚本 ' + segs.length + ' 段：' +
    segs.map(s => Buffer.byteLength(s, 'utf8')).join(' / ') + ' 字节');
  const idx = segs.findIndex(s => /function simStep\b/.test(s) && /const REGIONS\b/.test(s));
  if (idx < 0) throw new Error('未能定位内核段');
  const kernel = segs[idx];
  console.log('内核段：第 ' + (idx + 1) + ' 段，' + Buffer.byteLength(kernel, 'utf8') + ' 字节');

  const k0 = newKernel(kernel);
  const fields = k0.js('Object.keys(S)');
  console.log('原版状态字段 ' + fields.length + ' 个：' + fields.join(', '));
  console.log('');
  console.log('--- 原版反例复现 ---');

  /* O1 母线闭合：缺电分支下"发电 + 购电 + 放电"是否等于"已供负荷 + 充电 + 弃电"。
   * 已供负荷 = loadMW + sc + metal + factory + h2P（后四项是柔性负荷，不在 loadMW 里）。*/
  record('O1', '缺电时园区母线不闭合',
    '缺电分支只把柔性负荷让路到最低运行值，剩下的柔性负荷既没有电源也没有购电覆盖，母线两侧对不上',
    () => {
      const k = newKernel(kernel);
      /* 两段构造：先用大风把 sc/metal/factory/h2P 这些柔性负荷建起来
       *（它们初值都是 0，缺电分支没有东西可让，也就记不到账），
       * 再切到无风无光制造缺口。 */
      k.run('S.running=false; S.windManual=true; S.windSlider=15; S.itSlider=100;');
      for (let i = 0; i < 240; i++) k.run('simStep(1)');
      const built = k.js('({sc:+S.sc.toFixed(2),mt:+S.metal.toFixed(2),fa:+S.factory.toFixed(2),h2:+S.h2P.toFixed(2)})');
      k.run('S.windSlider=0; S.windSpeed=0; S.smrGear=0; S.smr=0; S.gensetOn=false; S.fcOn=false; S.itSlider=300;');
      let worst = 0, worstAt = null, closed = 0;
      for (let i = 0; i < 120; i++) {
        k.run('simStep(1)');
        const o = k.js('({gen:S.genMW,buy:S.gridBuy,stP:S.stP,cur:S.curtail,load:S.loadMW,sc:S.sc,mt:S.metal,fa:S.factory,h2:S.h2P})');
        const sources = o.gen + o.buy + Math.max(0, o.stP);
        const sinks = o.load + o.sc + o.mt + o.fa + o.h2 + Math.max(0, -o.stP) + o.cur;
        const res = sources - sinks;
        if (Math.abs(res) < 1e-9) closed++;
        if (Math.abs(res) > Math.abs(worst)) {
          worst = res;
          worstAt = { 步: i, 发电MW: +o.gen.toFixed(3), 购电MW: +o.buy.toFixed(3), 放电MW: +Math.max(0, o.stP).toFixed(3),
            已供负荷MW: +(o.load + o.sc + o.mt + o.fa + o.h2).toFixed(3),
            柔性负荷MW: { 超充: +o.sc.toFixed(3), 电解锌: +o.mt.toFixed(3), 智能工厂: +o.fa.toFixed(3), 制氢: +o.h2.toFixed(3) } };
        }
      }
      return { status: Math.abs(worst) > 1e-6 ? 'observed' : 'not-reproduced',
        observed: { 切缺口前已建起的柔性负荷MW: built, 最大母线残差MW: +worst.toFixed(6), 残差为0的步数: closed + '/120', 最大残差所在步: worstAt },
        note: '残差为负表示"电源侧少于负荷侧"：让路只让到最低运行值，其余柔性负荷没有任何来源。新内核同条件下残差为 0（engine.test.cjs P01/P05）' };
    });

  /* O2 富余时仍强制放电：既放电又弃电 */
  record('O2', '富余时强制放电，制造出无去向的放电量',
    '储能指令设为「放电」时，即使发电已大于负荷，仍按容量上限放电，多出来的电只能进弃电',
    () => {
      const k = newKernel(kernel);
      k.run('S.running=false; S.windManual=true; S.windSlider=16; S.stMode="discharge"; S.soc=80; S.itSlider=100;');
      let both = 0, sumCur = 0, sumDis = 0;
      for (let i = 0; i < 200; i++) {
        k.run('simStep(1)');
        const o = k.js('({cur:S.curtail,stP:S.stP,gen:S.genMW,load:S.loadMW})');
        const dis = Math.max(0, o.stP);
        if (dis > 0.01 && o.cur > 0.01) both++;
        sumCur += o.cur; sumDis += dis;
      }
      return { status: both > 0 ? 'observed' : 'not-reproduced',
        observed: { 同时放电且弃电的步数: both + '/200', 平均弃电MW: +(sumCur / 200).toFixed(2), 平均放电MW: +(sumDis / 200).toFixed(2) },
        note: '物理上应优先充电或减少放电；新内核把富余分配固定为「强制充电 → 柔性负荷扩容 → 自动充电 → 外送 → 弃电」，不允许放电与弃电并存' };
    });

  /* O3 氢罐 clamp 掩盖质量差额 */
  record('O3', '储氢满罐时 clamp 直接截断，氢质量账不闭合',
    '储氢库存更新用 clamp(…, 0, 罐容) 收尾，越界部分一旦出现就被静默丢弃，没有溢流帐',
    () => {
      const k = newKernel(kernel);
      const kgPerMWh = k.js('K.FC_KG_PER_MWH');
      /* 两个构造：A 满罐附近强产氢；B 空罐附近燃料电池抽氢。
       * 「被截断」= 本步的（产 − 用）与库存净增对不上。 */
      const runCase = (init, prep, steps) => {
        const kk = newKernel(kernel);
        kk.run('S.running=false; S.windManual=true; S.itSlider=100; ' + init);
        kk.run(prep);
        let clampSteps = 0, maxD = 0, prod = 0, use = 0, dKg = 0, firstAt = null;
        for (let i = 0; i < steps; i++) {
          const b = kk.js('({kg:S.h2Kg})');
          kk.run('simStep(1)');
          const a = kk.js('({kg:S.h2Kg,prod:S.h2ProdKgH,nh3:S.nh3H2kgH,fc:S.fcMW})');
          const dtH = 1 / 3600;
          const want = b.kg + (a.prod - a.nh3 - a.fc * kgPerMWh) * dtH;
          const d = want - a.kg;
          prod += a.prod * dtH; use += (a.nh3 + a.fc * kgPerMWh) * dtH; dKg += a.kg - b.kg;
          if (Math.abs(d) > 1e-6) { clampSteps++; if (!firstAt) firstAt = i; if (Math.abs(d) > maxD) maxD = Math.abs(d); }
        }
        return { 被截断的步数: clampSteps + '/' + steps, 单步最大被截断量kg: +maxD.toFixed(6),
          首次出现步: firstAt, 期内产氢kg: +prod.toFixed(2), 期内用氢kg: +use.toFixed(2),
          库存净增kg: +dKg.toFixed(2), 期末库存kg: +kk.js('+S.h2Kg.toFixed(2)') };
      };
      const A = runCase('S.windSlider=16;', 'S.h2Kg=9930; S.h2P=200;', 400);
      const B = runCase('S.windSlider=0;', 'S.h2Kg=220; S.fcOn=true; S.fcMW=2;', 6000);
      const any = (A.被截断的步数[0] !== '0') || (B.被截断的步数[0] !== '0');
      return { status: any ? 'observed' : 'not-reproduced',
        observed: { 满罐附近强产氢: A, 空罐附近燃料电池抽氢: B },
        note: any
          ? '出现了「产 − 用」与库存净增对不上的步，差额被 clamp 吃掉'
          : '两个构造里都没出现越界，说明原版靠「接近满罐时按上一步产氢量压低制氢」这个滞后守卫，恰好把库存稳在界内；' +
            'clamp 是残留的静默截断路径，只在参数被改动或守卫算错时才真正吞掉质量，本次未触发' };
    });

  /* O4 氢氨公辅负荷晚一拍 */
  record('O4', '合成氨公辅负荷晚一拍',
    '本步的氨公辅用电用的是上一步的产氢量，制氢功率突变时公辅负荷不跟着变',
    () => {
      const k = newKernel(kernel);
      /* 关键点：nh3Aux 在每步末尾会被重算，所以直接读它永远"跟得上"。
       * 滞后体现在**本步 loadMW 内部**用的是上一步的 nh3Aux。
       * 因此从本步 loadMW 反推它实际用掉的公辅项，再与两个候选值比对。 */
      const impliedExpr = '(S.loadMW - (S.itMW/K.PANAMA_ETA + 10 + 0.08*S.itMW) - S.lampMW)';
      k.run('S.running=false; S.windManual=true; S.windSlider=15; S.itSlider=100;');
      for (let i = 0; i < 240; i++) k.run('simStep(1)');
      const before = k.js('({h2:+S.h2P.toFixed(4),aux:+S.nh3Aux.toFixed(4),prod:+S.h2ProdKgH.toFixed(2)})');
      k.run('S.windSlider=0; S.windSpeed=0; S.smrGear=0; S.smr=0; S.gensetOn=false; S.fcOn=false; S.itSlider=300;');
      k.run('simStep(1)');
      const a = k.js('({h2:+S.h2P.toFixed(4),auxRebuilt:+S.nh3Aux.toFixed(4),' +
        'implied:' + impliedExpr + '.toFixed(4),' +
        'byNow:+auxOf(S.h2P).toFixed(4),byPrev:+auxOf(' + before.h2 + ').toFixed(4)})');
      const lagged = Math.abs(a.implied - a.byPrev) < 1e-3 && Math.abs(a.implied - a.byNow) > 1e-2;
      return { status: lagged ? 'observed' : 'not-reproduced',
        observed: { 突变前: before, 突变后本步: a,
          本步实际用掉的公辅MW: a.implied, 按本步产氢量应为MW: a.byNow, 按上一步产氢量应为MW: a.byPrev,
          差额MW: +(a.implied - a.byNow).toFixed(4) },
        note: '制氢功率已从 ' + before.h2 + ' MW 降到 ' + a.h2 + ' MW，但本步实际计入的公辅用电仍是按上一步产氢量算的值' +
          '（步末的 ' + a.auxRebuilt + ' MW 只影响下一步）。新内核在每一步内先把公辅与产量算到自洽再结算' };
    });

  /* O5 排放口径 */
  record('O5', '排放换算基准与直接排放缺项',
    '当日排放按「风光核发电量 × 电网因子」累加，燃气发电没有排放项；碳排放强度分母用 0.1229 tce/MWh 折标',
    () => {
      const k = newKernel(kernel);
      k.run('S.running=false; S.windManual=true; S.windSlider=8; S.itSlider=150; S.gensetOn=true;');
      k.run('S.gridBuy=0; S.dCo2=0;');
      for (let i = 0; i < 60; i++) k.run('simStep(1)');
      const o = k.js('({gridBuy:S.gridBuy,genset:S.gensetMW,wind:S.windMW,solar:S.solarMW,smr:S.smr,dCo2:S.dCo2,carbInt:S.carbInt,cleanShare:S.cleanShare})');
      const src = kernel;
      const carbLine = (src.split('\n').find(l => /S\.carbInt\s*=/.test(l)) || '').trim();
      const co2Line = (src.split('\n').find(l => /S\.dCo2\s*\+=/.test(l)) || '').trim();
      const gasRefs = (src.match(/genset/g) || []).length;
      const co2GasRefs = (src.match(/co2Gas|gasCO2|gensetCO2/g) || []).length;
      return { status: (o.gridBuy === 0 && o.dCo2 > 0) ? 'observed' : 'not-reproduced',
        observed: {
          期内购电MW: +o.gridBuy.toFixed(4), 期内燃气发电MW: +o.genset.toFixed(2),
          期内当日排放t: +o.dCo2.toFixed(4), 碳强度: +o.carbInt.toFixed(5),
          排放累加行: co2Line, 碳强度行: carbLine, 燃气相关出现次数: gasRefs, 燃气排放项出现次数: co2GasRefs
        },
        note: '购电为 0 而当期排放不为 0，说明排放量并不来自购电；燃气发电参与功率平衡却不参与排放核算' };
    });

  /* O6 跨日欠账清零 */
  record('O6', '午夜切换时把欠账池清零',
    '跨日把柔性生产欠账直接置 0，等于把未履行的计划注销掉，且没有结转字段',
    () => {
      const k = newKernel(kernel);
      /* 先建起柔性负荷，再制造缺口让这些负荷让路 → 产生欠账，最后跨过午夜 */
      k.run('S.running=false; S.windManual=true; S.windSlider=15; S.itSlider=100;');
      for (let i = 0; i < 240; i++) k.run('simStep(1)');
      k.run('S.simTime=86400-240; S.windSlider=0; S.windSpeed=0; S.smrGear=0; S.smr=0; S.itSlider=400;');
      for (let i = 0; i < 200; i++) k.run('simStep(1)');
      const before = k.js('({day:S.day,z:+S.debtZinc.toFixed(4),f:+S.debtFac.toFixed(4),p:+S.debtPem.toFixed(4)})');
      for (let i = 0; i < 120; i++) k.run('simStep(1)');
      const after = k.js('({day:S.day,z:+S.debtZinc.toFixed(4),f:+S.debtFac.toFixed(4),p:+S.debtPem.toFixed(4),carryKeys:Object.keys(S).filter(k=>/Carry/.test(k))})');
      return { status: (before.z + before.f + before.p) > 1e-6 && (after.z + after.f + after.p) < 1e-9
          ? 'observed' : 'not-reproduced',
        observed: { 跨日前: before, 跨日后: after,
          跨日前欠账合计MWh: +(before.z + before.f + before.p).toFixed(4),
          跨日后欠账合计MWh: +(after.z + after.f + after.p).toFixed(4),
          是否存在结转字段: after.carryKeys },
        note: '跨日前有欠账、跨日后归零，即为清零；新内核欠账跨日结转（S.debtZincCarry 等），见 engine.test.cjs F03' };
    });

  /* O7 政策对标口径 */
  record('O7', '政策对标的折标口径',
    '把 0.1229 kgce/kWh（电力当量值）直接当综合能耗换算系数用，且未标注口径与年份',
    () => {
      const hits = (kernel.match(/0\.1229/g) || []).length;
      const lines = kernel.split('\n').filter(l => /0\.1229/.test(l)).map(l => l.trim()).slice(0, 4);
      const declared = /口径|当量值|等价值|GB\/T 2589|statistical/.test(kernel);
      return { status: hits > 0 && !declared ? 'observed' : 'unverified',
        observed: { 出现次数: hits, 相关行: lines, 是否标注口径: declared },
        note: '0.1229 kgce/kWh 是电力「当量值」折标系数；与「等价值」口径混用会得出不同的综合能耗。新内核把政策对标置为「待核算」并列出缺少的参数' };
    });

  fs.writeFileSync(OUT, JSON.stringify({
    generatedAt: new Date().toISOString(),
    original: path.relative(ROOT, ORIGINAL),
    originalBytes: Buffer.byteLength(html, 'utf8'),
    kernelSegment: idx + 1,
    kernelBytes: Buffer.byteLength(kernel, 'utf8'),
    seeding: 'Math.random 替换为 mulberry32(20260917)，使观察可复现',
    rows
  }, null, 2), 'utf8');

  const ok = rows.filter(r => r.status === 'observed').length;
  const nr = rows.filter(r => r.status === 'not-reproduced').length;
  const uv = rows.filter(r => r.status === 'unverified').length;
  console.log('');
  console.log('复现 ' + ok + ' 项，未复现 ' + nr + ' 项，未能验证 ' + uv + ' 项（合计 ' + rows.length + '）');
  console.log('未复现与未能验证的项不作为"原版无此问题"的结论。');
  console.log('结果文件：' + path.relative(ROOT, OUT));
}

main();
