/* =====================================================================
 * 戈壁之光 · 零碳能量中枢 —— 仿真核算内核
 * GobiLight-NetZero  v1.0.0   engine.js
 *
 * 设计要点
 *  1. 固定物理步长（默认 1 秒），物理时间与渲染帧率、播放倍速解耦；
 *     随机过程使用独立种子流，同种子同模拟时长的结果可逐位重放。
 *  2. 每步先构造完整需求，再按阶梯分配电源/储能/购电；
 *     园区母线功率守恒可在每步核对，不用钳制掩盖残差。
 *  3. 氢按质量守恒闭合：末库存 = 初库存 + 产氢 − 合成用氢 − 燃料电池用氢；
 *     储罐约束在事前限产，不用末端 clamp 制造或消灭质量。
 *  4. 柔性负荷有显式生产计划、实际完成量、可转移欠账；跨日结转，不清零注销。
 *  5. 电源与氢携带来源属性（可再生/核电/外购/燃气/未知），
 *     电→氢→电与充放电不重复计入一次清洁能源与减排量。
 *  6. 政策对标口径按等价值与年度规模分档核验；参数不全时显示「待核算」。
 *
 * 本文件不依赖 DOM，可在 Node 中直接测试。
 * ===================================================================== */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.NZEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* 工具                                                               */
  /* ------------------------------------------------------------------ */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const EPS = 1e-9;

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function zeroMix(keys) { const o = {}; for (const k of keys) o[k] = 0; return o; }
  function mixNorm(o, keys, total) {
    const out = zeroMix(keys);
    if (!(total > EPS)) return out;
    for (const k of keys) out[k] = o[k] / total;
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* 工厂                                                               */
  /* ------------------------------------------------------------------ */
  function createEngine(cfg) {
    const P = cfg.PLANT, T = cfg.TIME, REGIONS = cfg.REGIONS;
    const MK = cfg.MIX_KEYS;
    const Q = cfg.POWER_QUALITY;
    const TaskAPI = typeof module !== 'undefined' && module.exports ? require('./dispatch-tasks.js') : globalThis.NZ_TASKS;
    let tasks, tickRemainder=0;

    /* ---------------- 状态（单一快照，驱动设备标签/指标/曲线/能流） --- */
    const S = {
      /* 运行控制 */
      running: true, timeScale: 240, simTime: T.startHour * 3600, day: 1,
      region: 'xinjiang', scenario: 'park',
      windManual: false, windSlider: 7.8, windSpeed: 7.8,
      dayNight: true, irradi: 0,
      smrEnabled: false, smrGear: 0, smr: 0,
      itSlider: 150, itMW: 0,
      stMode: 'auto', svgOn: true, apfOn: true,
      fcOn: false, gensetOn: false,
      /* 表现层光源预设（不参与物理） */
      /* v1.0.6：默认「跟随仿真」—— 跑仿真时场景要真的昼夜交替；
       * 蓝调展厅 / 日间科研 / 夜间展厅 三个展厅档仍在「展示光照」里一键可切。 */
      lightPreset: 'follow', quality: 'standard', mode: 'exhibit', reduceMotion: false,

      /* 实时功率 */
      turbP: new Array(P.turbineSampleCount).fill(0),
      windMW: 0, solarMW: 0, carportMW: 0,
      gensetMW: 0, fcMW: 0, smrAvailMW: 0,
      dcLoadMW: 0, airLoadMW: 0, loadMW: 0, genMW: 0, genAvailMW: 0, genActualMW: 0,
      stP: 0, soc: 55, gridBuy: 0, curtail: 0, exportMW: 0, unservedMW: 0,
      releaseMW: 0, shedDeferredMW: 0,
      demandDesiredMW: 0, demandServedMW: 0,

      /* 氢氨 */
      h2P: 0, h2Kg: 400, h2ProdKgH: 0, h2TankDrawKgH: 0,
      nh3H2kgH: 0, nh3KgH: 0, nh3Load: 0, nh3AuxMW: 0, nh3Running: false,
      h2BlowdownKgH: 0, h2LossKgH: 0,

      /* 柔性负荷 */
      trucks: 3, sc: 0, metal: 0, factory: 0,
      zincPlanMW: P.zincPlanMW, factoryPlanMW: P.factoryPlanMW, pemPlanMW: P.pemPlanMW,
      debtZinc: 0, debtFac: 0, debtPem: 0,
      debtZincCarry: 0, debtFacCarry: 0, debtPemCarry: 0,
      zincStops: 0, zincStopUntil: 0,
      zincState: 'running', factoryState: 'running', pemState: 'idle',

      /* 电能质量 */
      pfRaw: 0.9, pf: 0.9, thdRaw: 6, thd: 6, vdRaw: 0, vd: 0, qSvgMvar: 0, qRawMvar: 0, qResidualMvar: 0,

      /* 指标 */
      pue: 1.2, gridEmissionTPerMWh: 0,
      renewableShareOfConsumption: 0, cleanShareOfConsumption: 0,
      primaryRenewableMW: 0, curRate: 0, selfUse: -1, exportRate: 0,
      unaccountedGasMWh: 0, policyStatus: cfg.POLICY.status,

      /* 当日累计 */
      dGen: 0, dLoad: 0, dBuy: 0, dCur: 0, dUnserved: 0,
      dGreenConsumed: 0, dGridCO2: 0, dGasCO2: 0,
      dSc: 0, dMt: 0, dFa: 0, dH2Mwh: 0, dH2kg: 0, dNh3t: 0, dTokB: 0, dGasMWh: 0,
      dSrcGen: zeroMix(MK), dSinkLoad: { dc: 0, flex: 0, aux: 0 },
      dChg: 0, dDis: 0, dH2UseKg: 0, socClampEvents: 0, day1StartSimTime: 0,

      /* 诊断 */
      solverIterations: 0, solverConverged: true, lastResidualMW: 0, lastH2ResidualKg: 0,
      steps: 0, h2ClampEvents: 0
    };

    /* 派生：日/小时辅助 */
    const K = {
      TURB_RATED: P.turbineRatedMW, SOLAR_CAP: P.solarMWp, SMR_CAP: P.smrMWe,
      ST_CAP: P.storageMWh, ST_MAXP: P.storageMW, SOC_LO: P.socLow, SOC_HI: P.socHigh,
      TR_CAP: P.gasMW, PANAMA_ETA: P.panamaEta,
      H2_CAP: P.electrolyserMW, H2_KWH_PER_KG: P.kWhPerKgH2, H2_TANK: P.tankKg,
      NH3_H2_MAX: P.ammoniaH2KgPerH, NH3_RATIO: P.ammoniaRatio,
      NH3_AUX_MW_PER_KGH: P.ammoniaMWhPerT / 1000,
      SC_GUN: P.scGunMW, SC_BAYS: P.scGuns, CARPORT_CAP: P.carportMWp,
      SC_ARR_DAY: P.scArrivePerHDay, SC_ARR_NIGHT: P.scArrivePerHNight,
      SC_DEP_CHG: P.scLeavePerHCharging, SC_DEP_IDLE: P.scLeavePerHIdle,
      GENSET_CAP: P.gasMW, GENSET_RAMP: P.gasRampMWPerMin / 60, FC_CAP: P.fuelCellMW,
      FC_KG_PER_MWH: P.fuelCellKgPerMWh, METAL_CAP: P.zincMW, METAL_MIN: P.zincMinMW,
      ZINC_RAMP: P.zincRampMWPerMin / 60,
      ZINC_MAX_STOPS: P.zincMaxStopsPerDay, ZINC_STOP_MAX_S: P.zincStopMaxSeconds,
      FACTORY_CAP: P.factoryMW, FACTORY_MIN: P.factoryMinMW,
      PEM_MIN: P.electrolyserMinMW, THD_LIMIT: Q.thdLimitPercent,
      /* 兼容旧表现层命名 */
      SMR_RAMP: P.smrRampMWPerMin / 60
    };

    /* ---------------- 账本：来源属性与累计 ---------------- */
    const L = {
      /* 储能：按 MWh 追踪各来源占比（完全混合） */
      battMWh: { total: 0, mix: zeroMix(MK) },
      /* 储氢：按 kg 追踪各来源占比（完全混合） */
      h2MixKg: zeroMix(MK),
      /* 端用电消费的来源成分（MWh） */
      consumption: zeroMix(MK),
      /* 一次能源发电量（不含电池放电与氢回发） */
      primaryGenMWh: zeroMix(MK),
      /* 氢回发（电→氢→电）单独标记，不重复计入一次清洁能源 */
      recircMWh: 0,
      /* 排放（t） */
      gridCO2T: 0, gasCO2T: 0,
      gasUnaccountedMWh: 0,
      /* 累计电量（MWh） */
      genMWh: 0, loadMWh: 0, buyMWh: 0, curtailMWh: 0, unservedMWh: 0,
      chargeMWh: 0, dischargeMWh: 0, exportMWh: 0,
      h2ProducedKg: 0, h2ToAmmoniaKg: 0, h2ToFuelCellKg: 0, h2LossKg: 0, nh3Tonnes: 0,
      /* 生产计划 */
      planZincMWh: 0, planFactoryMWh: 0, planPemMWh: 0,
      actualZincMWh: 0, actualFactoryMWh: 0, actualPemMWh: 0,
      /* 日记录 */
      days: [], history: [], events: []
    };

    let rngPhys, rngVis, rngDemand;
    let alertCd = {};
    const listeners = { event: [] };

    /* ------------------------------------------------------------------ */
    /* 基础几何与工具                                                     */
    /* ------------------------------------------------------------------ */
    function sunGeometry(t, R) {
      const hour = (t % 86400) / 3600;
      const rise = 12 - R.dayLen / 2;
      const frac = (hour - rise) / R.dayLen;
      const elev = Math.sin(Math.PI * frac);
      return { hour, frac, elev };
    }
    /* 照明负荷等级：与表现层同源公式，但属于内核（照明计入辅助用电） */
    function lampLevelAt(t, R) {
      if (!S.dayNight) return 0;
      const g = sunGeometry(t, R);
      return clamp((0.06 - g.elev) / 0.06, 0, 1);
    }

    function pushEvent(level, msg) {
      const t = S.simTime % 86400;
      const hh = String(Math.floor(t / 3600)).padStart(2, '0');
      const mm = String(Math.floor((t % 3600) / 60)).padStart(2, '0');
      const ev = { day: S.day, simTime: S.simTime, t: `D${S.day} ${hh}:${mm}`, level, msg };
      L.events.push(ev);
      if (L.events.length > 400) L.events.shift();
      for (const f of listeners.event) { try { f(ev); } catch (e) { /* 表现层异常不影响核算 */ } }
    }
    function throttled(key, level, msg, cdSec) {
      cdSec = cdSec || 1800;
      if ((alertCd[key] || 0) > S.simTime) return;
      alertCd[key] = S.simTime + cdSec;
      pushEvent(level, msg);
    }

    /* ------------------------------------------------------------------ */
    /* 状态复位与情景                                                     */
    /* ------------------------------------------------------------------ */
    function reset(opts) {
      opts = opts || {};
      tickRemainder=0;
      S.scenario = opts.scenario || S.scenario;
      const sc = cfg.SCENARIOS[S.scenario] || cfg.SCENARIOS.park;
      const region = opts.region || sc.region || S.region;
      S.region = region;
      const R = REGIONS[region];

      S.simTime = (opts.hour != null ? opts.hour : sc.hour) * 3600;
      S.day = 1;
      S.seed = opts.seed != null ? opts.seed : sc.seed;
      rngPhys = mulberry32(S.seed); rngDemand=mulberry32(S.seed ^ 0x43F1A29);
      rngVis = mulberry32(S.seed ^ 0x9E3779B9);

      S.windManual = opts.windManual != null ? opts.windManual : !!sc.windManual;
      S.windSlider = opts.wind != null ? opts.wind : (sc.wind != null ? sc.wind : R.windMean);
      S.windSpeed = S.windSlider;
      S.dayNight = opts.dayNight != null ? opts.dayNight : true;
      S.smrEnabled = opts.smrEnabled != null ? opts.smrEnabled : !!sc.smrEnabled;
      S.smrGear = S.smrEnabled ? 2 : 0;
      S.smr = S.smrEnabled ? P.smrMWe : 0;
      S.itSlider = opts.itMW != null ? opts.itMW : (sc.itMW != null ? sc.itMW : 150);
      S.stMode = opts.stMode || sc.stMode || 'auto';
      S.mode = opts.mode || S.mode;
      S.quality = opts.quality || S.quality;
      S.lightPreset = opts.lightPreset || S.lightPreset;
      S.svgOn = opts.svgOn != null ? opts.svgOn : true;
      S.apfOn = opts.apfOn != null ? opts.apfOn : true;
      S.fcOn = false; S.gensetOn = S.scenario === 'gasbackup';
      S.dispatchStrategy = opts.dispatchStrategy || 'delivery';

      S.soc = opts.soc != null ? opts.soc : (sc.soc != null ? sc.soc : 55);
      S.h2Kg = opts.h2Kg != null ? opts.h2Kg : (sc.h2Kg != null ? sc.h2Kg : 400);

      S.turbP = new Array(P.turbineSampleCount).fill(0);
      S.windMW = S.solarMW = S.carportMW = 0;
      S.gensetMW = 0; S.fcMW = 0;
      S.dcLoadMW = S.airLoadMW = S.loadMW = S.genMW = S.genAvailMW = S.genActualMW = 0;
      S.stP = 0; S.gridBuy = 0; S.curtail = 0; S.exportMW = 0; S.unservedMW = 0;
      S.releaseMW = 0; S.shedDeferredMW = 0;
      S.demandDesiredMW = 0; S.demandServedMW = 0;
      S.h2P = 0; S.h2ProdKgH = 0; S.h2TankDrawKgH = 0;
      S.nh3H2kgH = 0; S.nh3KgH = 0; S.nh3Load = 0; S.nh3AuxMW = 0; S.nh3Running = false;
      S.h2BlowdownKgH = 0; S.h2LossKgH = 0;
      S.trucks = opts.trucks != null ? opts.trucks : 3;
      S.sc = 0; S.metal = 0; S.factory = 0;
      S.debtZinc = S.debtFac = S.debtPem = 0;
      S.debtZincCarry = S.debtFacCarry = S.debtPemCarry = 0;
      S.zincStops = 0; S.zincStopUntil = 0;
      S.zincState = 'running'; S.factoryState = 'running'; S.pemState = 'idle';
      S.pfRaw = 0.9; S.pf = 0.9; S.thdRaw = 6; S.thd = 6; S.vdRaw = 0; S.vd = 0;
      S.qSvgMvar = 0; S.qRawMvar = 0; S.qResidualMvar = 0;
      S.pue = 1.2; S.gridEmissionTPerMWh = 0;
      S.renewableShareOfConsumption = 0; S.cleanShareOfConsumption = 0;
      S.primaryRenewableMW = 0; S.curRate = 0; S.selfUse = -1; S.exportRate = 0;
      S.unaccountedGasMWh = 0;
      S.dGen = S.dLoad = S.dBuy = S.dCur = S.dUnserved = 0;
      S.dGreenConsumed = S.dGridCO2 = S.dGasCO2 = 0;
      S.dSc = S.dMt = S.dFa = S.dH2Mwh = S.dH2kg = S.dNh3t = S.dTokB = S.dGasMWh = 0;
      S.dSrcGen = zeroMix(MK); S.dSinkLoad = { dc: 0, flex: 0, aux: 0 };
      S.dChg = 0; S.dDis = 0; S.dH2UseKg = 0;
      S.solverIterations = 0; S.solverConverged = true;
      S.lastResidualMW = 0; S.lastH2ResidualKg = 0; S.steps = 0; S.h2ClampEvents = 0;

      L.battMWh.total = P.storageMWh * S.soc / 100;
      L.battMWh.mix = zeroMix(MK);
      L.battMWh.mix.unknown = L.battMWh.total;
      L.h2MixKg = zeroMix(MK);
      L.h2MixKg.unknown = S.h2Kg;
      /* 记录起始库存：使氢质量平衡「初库存 + 产氢 − 合成氨用氢 − 燃料电池用氢 = 末库存」
       * 可以只凭导出的账本核对，不必回看初始情景参数。 */
      L.h2StartKg = S.h2Kg;
      L.consumption = zeroMix(MK); L.primaryGenMWh = zeroMix(MK);
      L.recircMWh = 0; L.gridCO2T = 0; L.gasCO2T = 0; L.gasUnaccountedMWh = 0;
      L.genMWh = L.loadMWh = L.buyMWh = L.curtailMWh = L.unservedMWh = 0;
      L.chargeMWh = L.dischargeMWh = L.exportMWh = 0;
      L.h2ProducedKg = L.h2ToAmmoniaKg = L.h2ToFuelCellKg = L.h2LossKg = L.nh3Tonnes = 0;
      L.planZincMWh = L.planFactoryMWh = L.planPemMWh = 0;
      L.actualZincMWh = L.actualFactoryMWh = L.actualPemMWh = 0;
      L.days = []; L.history = [];
      /* closeDay 的日累计基线必须同步清零：否则切换情景后首个日记录
       * 会以「新累计 − 旧基线」计算，出现负的发电量/购电量。 */
      L._accGen = 0; L._accLoad = 0; L._accBuy = 0; L._accCur = 0; L._accUn = 0;
      L._accGridCO2 = 0; L._accGasCO2 = 0; L._accH2 = 0; L._accNh3 = 0;
      L._accCons = zeroMix(MK);
      alertCd = {}; L.events.length=0;
      tasks = TaskAPI.create(cfg,S); S.runId=tasks.b.runId; S.dispatchReason='等待首步调度'; S.storageReason='等待首步调度'; S.taskLedger=tasks.snapshot();
      S.day1StartSimTime = S.simTime;   // 首个不完整日的起点
      pushEvent('info', `情景载入：${sc.label}（种子 ${S.seed}，${REGIONS[region].short}，${String(Math.floor(S.simTime / 3600)).padStart(2, '0')}:00 起步）`);
      if (sc.note) pushEvent('info', sc.note);
      return S;
    }

    /* ------------------------------------------------------------------ */
    /* 资源与固定电源                                                     */
    /* ------------------------------------------------------------------ */
    function updateResources(dt) {
      const dtH = dt / 3600;
      const R = REGIONS[S.region];

      if (S.windManual) {
        S.windSpeed += (S.windSlider - S.windSpeed) * Math.min(1, dt * 0.5);
      } else {
        S.windSpeed += (R.windMean - S.windSpeed) * 0.002 * dt
          + (rngPhys() * 2 - 1) * 0.10 * R.windVol * Math.sqrt(dt);
        S.windSpeed = clamp(S.windSpeed, 0, 24);
      }

      /* 全场 100 × 6 MW；用 12 个空间样本做平滑，再按 100/12 外推 */
      let sum = 0;
      for (let i = 0; i < P.turbineSampleCount; i++) {
        const v = S.windSpeed * (1 + 0.06 * Math.sin(S.simTime * 0.02 + i * 2.1));
        let p = 0;
        if (v >= P.windCutIn && v < P.windRated) p = P.turbineRatedMW * Math.pow((v - P.windCutIn) / (P.windRated - P.windCutIn), 2);
        else if (v >= P.windRated && v <= P.windCutOut) p = P.turbineRatedMW;
        S.turbP[i] = p; sum += p;
      }
      /* 单机空间均值 × 全场台数（图面只示意 12 台样本机，功率按 100/12 外推） */
      S.windMW = (sum / P.turbineSampleCount) * P.turbineCount;

      /* 日照（典型日模型：12 时为正午、固定日长；非当地全年太阳轨迹） */
      if (S.dayNight) {
        const hour = (S.simTime % 86400) / 3600;
        const rise = 12 - R.dayLen / 2, set = 12 + R.dayLen / 2;
        S.irradi = (hour > rise && hour < set)
          ? R.sunPeak * Math.pow(Math.sin(Math.PI * (hour - rise) / R.dayLen), 1.15) : 0;
      } else S.irradi = 0.85 * R.sunPeak;
      const cloud = 0.94 + 0.06 * Math.sin(S.simTime * 0.013) * Math.sin(S.simTime * 0.0047 + 3);
      S.solarMW = P.solarMWp * S.irradi * cloud;
      S.carportMW = P.carportMWp * S.irradi * cloud;

      /* SMR 研究情景：默认关闭 */
      const smrTarget = S.smrEnabled ? S.smrGear * P.smrMWe / 2 : 0;
      const smrRamp = P.smrRampMWPerMin / 60 * dt;
      S.smr += clamp(smrTarget - S.smr, -smrRamp, smrRamp);
      if (Math.abs(S.smr) < 1e-12) S.smr = 0;

      /* 燃气备用 */
      const gasTarget = S.gensetOn ? P.gasMW : 0;
      S.gensetMW += clamp(gasTarget - S.gensetMW, -K.GENSET_RAMP * dt, K.GENSET_RAMP * dt);
      if (Math.abs(S.gensetMW) < 1e-12) S.gensetMW = 0;

      /* 超充站车流（使用物理随机流，确定性可重放） */
      const hourNow = (S.simTime % 86400) / 3600;
      const arrRate = (hourNow > 7 && hourNow < 22) ? P.scArrivePerHDay : P.scArrivePerHNight;
      const arrivalDraw=rngDemand(),departureDraw=rngDemand();
      if (S.trucks < P.scGuns && arrivalDraw < arrRate * dtH) S.trucks++;
      if (S.trucks > 0) {
        const depRate = S.sc > 0.05 ? P.scLeavePerHCharging : P.scLeavePerHIdle;
        if (departureDraw < depRate * dtH * S.trucks) S.trucks--;
      }

      /* 算力负载（确定性纹波） */
      S.itMW = S.itSlider + 0.5 * Math.sin(S.simTime * 0.05);
    }

    /* ------------------------------------------------------------------ */
    /* 柔性负荷状态机（在求解前推进"机器状态"，功率由求解结果决定）        */
    /* ------------------------------------------------------------------ */
    function advanceMachines(dt) {
      const dtH = dt / 3600;
      /* 电解锌：全停次数与时长约束 */
      if (S.zincState === 'stopped') {
        if (S.simTime >= S.zincStopUntil) {
          S.zincState = 'starting';
          pushEvent('info', '电解锌车间停机时限到，按爬坡恢复（时限到只表示允许恢复，不保证立即恢复额定）');
        }
      } else if (S.zincState === 'stopping') {
        if (S.metal <= EPS) { S.zincState = 'stopped'; S.zincStopUntil = S.simTime + P.zincStopMaxSeconds; }
      } else if (S.zincState === 'starting') {
        if (S.metal >= P.zincMinMW - EPS) S.zincState = 'running';
      }
      /* 计划电量累计（用于欠账） */
      L.planZincMWh += S.zincState === 'running' ? P.zincPlanMW * dtH : 0;
      L.planFactoryMWh += P.factoryPlanMW * dtH;
      L.planPemMWh += P.pemPlanMW * dtH;
    }

    function zincCanFullStop() {
      return S.zincState === 'running' && S.zincStops < P.zincMaxStopsPerDay && S.metal > EPS;
    }

    /* ------------------------------------------------------------------ */
    /* 单步求解（纯函数：不修改 S/L，只返回结果）                          */
    /* ------------------------------------------------------------------ */
    function solveStep(dtH, g) {
      /* g = 上一轮迭代/上一步的估计：{auxMW, nh3H2kgH, pemMW, pemCapMW, prevNh3} */
      const R = REGIONS[S.region];
      const dt = dtH * 3600;

      /* ---- (1) 燃料电池：只吃罐存，且优先级低于合成氨 ---- */
      const tankDrawCapKgH = Math.min(P.tankDrawKgPerH, S.h2Kg / Math.max(dtH, EPS));
      const fcAvailKgH = Math.max(0, tankDrawCapKgH - g.nh3H2kgH);
      const fcTarget = (S.fcOn && S.h2Kg > P.fuelCellMinTankKg) ? P.fuelCellMW : 0;
      let fcMW = Math.min(fcTarget, fcAvailKgH / P.fuelCellKgPerMWh);
      const fcRamp = P.fuelCellMW * dt;
      fcMW = clamp(fcMW, S.fcMW - fcRamp, S.fcMW + fcRamp);
      fcMW = Math.max(0, fcMW);

      /* ---- (2) 电解槽功率上限：事前受罐容与当步消耗约束 ---- */
      const h2DrawEstKgH = g.nh3H2kgH + fcMW * P.fuelCellKgPerMWh;
      const tankHeadroomKg = P.tankKg - S.h2Kg;
      const pemHeadroomMW = Math.max(0, (tankHeadroomKg / Math.max(dtH, EPS) + h2DrawEstKgH) * P.kWhPerKgH2 / 1000);
      let pemCapMW = Math.min(P.electrolyserMW, pemHeadroomMW);
      if (g.pemCapCeil != null) pemCapMW = Math.min(pemCapMW, g.pemCapCeil);
      if (pemCapMW < P.electrolyserMinMW - EPS) pemCapMW = 0;

      const modern = cfg.DISPATCH.enabled && S.dispatchStrategy !== 'baseline';
      const zincTask=tasks.command('zinc',S.simTime,dtH),factoryTask=tasks.command('factory',S.simTime,dtH);
      /* ---- (3) 需求清单 ---- */
      const dcLoad = S.itMW / P.panamaEta + P.dcFixedMW + P.dcAuxRatio * S.itMW;
      const auxLoad = g.auxMW;
      const scDemand = clamp(S.trucks * P.scGunMW, 0, P.scGuns * P.scGunMW);

      /* 锌：状态机给定的可行区间与爬坡 */
      const znRamp = P.zincRampMWPerMin / 60 * dt;
      let zincWant, zincMin;
      if (S.zincState === 'stopped') { zincWant = 0; zincMin = 0; }
      else if (S.zincState === 'stopping') { zincWant = 0; zincMin = 0; }
      else if (S.zincState === 'starting') { zincWant = P.zincMinMW; zincMin = 0; }
      else { zincWant = modern ? zincTask.want : P.zincPlanMW; zincMin = P.zincMinMW; }
      zincWant = clamp(zincWant, S.metal - znRamp, Math.min(P.zincMW, S.metal + znRamp));
      zincWant = Math.max(0, zincWant);
      zincMin = Math.min(zincMin, zincWant);

      /* 工厂：保安负荷 20% 恒在预算内 */
      const facRamp = P.factoryRampMWPerMin / 60 * dt;
      let factoryWant = modern ? factoryTask.want : ((S.factoryState === 'stopped') ? 0 : P.factoryPlanMW);
      factoryWant = Math.max(0, clamp(factoryWant, S.factory - facRamp, Math.min(P.factoryMW, S.factory + facRamp)));
      const factoryMin = (S.factoryState === 'stopped') ? 0 : P.factoryMinMW;

      /* 电解槽 */
      const inventoryNeedMW=Math.max(0,(cfg.DISPATCH.targetH2Kg-S.h2Kg)/2+h2DrawEstKgH)*P.kWhPerKgH2/1000;
      let pemWant = Math.min(modern?inventoryNeedMW:P.pemPlanMW, pemCapMW);
      if(pemWant>0&&pemWant<P.electrolyserMinMW)pemWant=pemCapMW>=P.electrolyserMinMW?P.electrolyserMinMW:0;
      pemWant = Math.max(0, clamp(pemWant, S.h2P - P.electrolyserMW * dt, S.h2P + P.electrolyserMW * dt));
      const pemMin = pemCapMW >= P.electrolyserMinMW ? Math.min(P.electrolyserMinMW, pemWant) : 0;

      /* ---- (4) 供应与分配 ---- */
      const genAvail = S.windMW + S.solarMW + S.carportMW + S.smr + S.gensetMW + fcMW;
      const d = { dc: dcLoad, aux: auxLoad, sc: scDemand, zinc: zincWant, factory: factoryWant, pem: pemWant };
      const wantTotal = d.dc + d.aux + d.sc + d.zinc + d.factory + d.pem;

      const maxDis = Math.min(P.storageMW, (S.soc - (modern&&S.stMode!=='discharge'?Math.max(P.socLow,cfg.DISPATCH.reserveSoc):P.socLow)) / 100 * P.storageMWh * P.dischargeEta / Math.max(dtH, EPS));
      const maxChg = Math.min(P.storageMW, (P.socHigh - S.soc) / 100 * P.storageMWh / P.chargeEta / Math.max(dtH, EPS));

      let discharge = 0, charge = 0, gridBuy = 0, curtail = 0, exportMW = 0, unserved = 0;
      let chargeSurplus = 0, chargeGrid = 0;
      let shedSc = 0, shedPem = 0, shedFac = 0, shedZinc = 0, zincFullStop = false;

      let deficit = wantTotal - genAvail;
      const importLimit=cfg.GRID.importLimitMW;
      if(modern&&deficit>EPS){
        const protectedMW=d.dc+d.aux+Math.min(d.pem,pemMin)+Math.min(d.zinc,Math.max(zincMin,zincTask.protect))+Math.min(d.factory,Math.max(factoryMin,factoryTask.protect));
        discharge=S.stMode==='charge'?0:Math.max(0,Math.min(maxDis,protectedMW-genAvail,deficit));deficit-=discharge;
        gridBuy=Math.min(importLimit,deficit,Math.max(0,protectedMW-genAvail-discharge));
        deficit-=gridBuy;
      }

      /* 强制放电：优先覆盖真实缺口，绝不制造无去向的放电 */
      if (deficit > EPS && S.stMode === 'discharge') {
        const forcedDis=Math.max(0,Math.min(maxDis-discharge,deficit));discharge+=forcedDis;
        deficit-=forcedDis;
      }

      if (deficit > EPS) {
        /* 阶梯让路：超充（易逝、无欠账）→ 电解槽 → 工厂 → 电解锌 → 锌全停 */
        let a = Math.min(d.sc, deficit); d.sc -= a; deficit -= a; shedSc += a;
        let b = Math.max(0, d.pem - pemMin); b = Math.min(b, deficit);
        d.pem -= b; deficit -= b; shedPem += b;
        let c = Math.max(0, d.factory - factoryMin); c = Math.min(c, deficit);
        d.factory -= c; deficit -= c; shedFac += c;
        let e = Math.max(0, d.zinc - zincMin); e = Math.min(e, deficit);
        d.zinc -= e; deficit -= e; shedZinc += e;
        /* 全停的触发条件：该车间当前全部出力都已计入后仍有缺口才停。
         * 否则只削减到保安负荷，剩余小缺口交给储能/购电，避免"多削减"的
         * 功率凭空蒸发（旧版正是把多削减量当成节省，造成不守恒）。 */
        if (deficit > EPS && d.zinc > EPS && zincCanFullStop() && deficit >= d.zinc - EPS) {
          shedZinc += d.zinc; deficit -= d.zinc; d.zinc = 0; zincFullStop = true;
        }
      }

      /* 自动模式：让路后再用储能补缺口 */
      if (deficit > EPS && S.stMode !== 'charge') {
        const dis2 = Math.max(0, Math.min(maxDis - discharge, deficit));
        discharge += dis2; deficit -= dis2;
      }

      /* 购电（用于负荷） */
      if (deficit > EPS && cfg.GRID.importLimitMW > 0) {
        const extraBuy = Math.min(deficit, Math.max(0,importLimit-gridBuy));
        gridBuy += extraBuy; deficit -= extraBuy;
      }
      const gridBuyLoad = gridBuy;
      if (deficit > EPS) unserved = deficit;

      /* 未供电不可能凭空消失：必须把无法交付的刚性负荷（数据中心 / 公辅）
       * 从"已供需求"里扣除，按比例分摊，并显式记录，否则母线守恒式不成立。 */
      let unservedDc = 0, unservedAux = 0;
      if (unserved > EPS) {
        const mustSum = d.dc + d.aux;
        if (mustSum > EPS) {
          const k = Math.max(0, (mustSum - unserved) / mustSum);
          unservedDc = d.dc * (1 - k); unservedAux = d.aux * (1 - k);
          d.dc *= k; d.aux *= k;
        }
        // If even protected loads have no supply, remaining industrial demand is
        // an outage, not free delivered power or ordinary flexible shedding.
        let remaining = Math.max(0, unserved - unservedDc - unservedAux);
        for (const key of ['pem', 'factory', 'zinc', 'sc']) {
          const lost = Math.min(d[key], remaining);
          d[key] -= lost; remaining -= lost;
        }
      }

      /* ---- 富余分配顺序（一条统一规则）：
       *      强制充电 → 柔性负荷扩容（计划以上） → 自动充电 → 外送 → 弃电
       *  强制充电是操作员显式指令，优先于把柔性负荷推过计划值；
       *  自动充电排在扩容之后，避免储能抢走本可减少欠账的电量。
       *  购买电量为储能充电时，必须显式增加购电（不得隐含）。 */
      /* 富余必须按"让路与全停之后实际留下的需求"计算，
       * 不能用让路前的 wantTotal，否则全停/让路产生的富余无处可去。 */
      const servedAfterLadder = d.dc + d.aux + d.sc + d.zinc + d.factory + d.pem;
      let surplus = (genAvail - curtail) + gridBuy + discharge - servedAfterLadder - charge - exportMW;
      const forcedCharge = S.stMode === 'charge';
      if (forcedCharge && maxChg > EPS) {
        const req = Math.min(P.storageMW, maxChg);
        const fromSurplus = Math.min(req, Math.max(0, surplus));
        charge = fromSurplus; chargeSurplus += fromSurplus; surplus -= fromSurplus;
        const rest = req - fromSurplus;
        if (rest > EPS && cfg.GRID.allowGridCharge && unserved <= EPS) {
          const extra = Math.min(rest, Math.max(0, cfg.GRID.importLimitMW - gridBuy));
          charge += extra; chargeGrid += extra; gridBuy += extra;
        }
      }
      /* Reserve recovery first; then EDF production headroom, never unlimited overproduction. */
      if(modern&&!forcedCharge&&surplus>EPS&&S.soc<cfg.DISPATCH.reserveSoc){const a=Math.min(surplus,Math.max(0,maxChg-charge),(cfg.DISPATCH.reserveSoc-S.soc)/100*P.storageMWh/P.chargeEta/dtH);charge+=a;chargeSurplus+=a;surplus-=a;}
      const priority=[{key:'zinc',task:zincTask,ramp:S.metal+znRamp,cap:P.zincMW},{key:'factory',task:factoryTask,ramp:S.factory+facRamp,cap:P.factoryMW}];
      if(modern)priority.sort((a,b)=>(a.task.nextDeadline??Infinity)-(b.task.nextDeadline??Infinity));
      for(const x of priority){if(x.key==='zinc'&&S.zincState==='stopped')continue;const add=Math.max(0,Math.min(surplus,(modern?x.task.cap:x.cap)-d[x.key],x.ramp-d[x.key]));d[x.key]+=add;surplus-=add;}
      if(surplus>EPS){const cap=modern?Math.min(pemCapMW,pemWant):pemCapMW;const add=Math.max(0,Math.min(surplus,cap-d.pem));d.pem+=add;surplus-=add;}
      if (surplus > EPS && !forcedCharge) {
        const chg2 = Math.max(0, Math.min(surplus, maxChg - charge));
        charge += chg2; chargeSurplus += chg2; surplus -= chg2;
      }
      if (surplus > EPS && cfg.GRID.exportLimitMW > 0) {
        exportMW = Math.min(surplus, cfg.GRID.exportLimitMW);
        surplus -= exportMW;
      }
      if (surplus > EPS) curtail = surplus;
      else curtail = 0;

      /* ---- (5) 氢物料平衡 ---- */
      const prodKgH = d.pem * 1000 / P.kWhPerKgH2;
      const fcH2KgH = fcMW * P.fuelCellKgPerMWh;
      const tankRateCapKgH = Math.min(P.tankDrawKgPerH, S.h2Kg / Math.max(dtH, EPS));
      const h2RateAvailKgH = Math.max(0, prodKgH + tankRateCapKgH - fcH2KgH);

      /* 合成氨：上行受爬坡限制、下行立即跟随（装置可快速减负荷）；
       * 最低稳定负荷：运行时不得低于 NH3_MIN，氢不足则停机而非无限下调。 */
      const rampMax = P.ammoniaRampKgPerHPerMin / 60 * dt;      // kg/h
      const prevRate = clamp(S.nh3H2kgH, 0, P.ammoniaH2KgPerH); // physical ramp once per timestep, never per solver iteration
      let target = Math.min(P.ammoniaH2KgPerH, prevRate + rampMax);
      if (S.nh3Running) target = Math.max(target, P.ammoniaH2MinKgPerH);
      let nh3H2kgH = Math.min(target, h2RateAvailKgH);
      let nh3Running = S.nh3Running;
      if (nh3Running && nh3H2kgH < P.ammoniaH2MinKgPerH - EPS) {
        if (h2RateAvailKgH >= P.ammoniaH2MinKgPerH - EPS) nh3H2kgH = P.ammoniaH2MinKgPerH;
        else { nh3H2kgH = 0; nh3Running = false; }
      } else if (!nh3Running && nh3H2kgH >= P.ammoniaH2MinKgPerH - EPS) {
        nh3Running = true;
      }
      const lampMW = P.lampBaseMW * lampLevelAt(S.simTime, R);
      if (unserved > EPS) {
        const poweredRate = Math.max(0, d.aux - lampMW) / (P.ammoniaRatio * P.ammoniaMWhPerT / 1000);
        nh3H2kgH = Math.min(nh3H2kgH, poweredRate);
        if (nh3H2kgH < P.ammoniaH2MinKgPerH - EPS) { nh3H2kgH = 0; nh3Running = false; }
      }
      if (nh3H2kgH < EPS) nh3H2kgH = 0;

      const nh3KgH = nh3H2kgH * P.ammoniaRatio;
      const nh3Load = nh3KgH / (P.ammoniaH2KgPerH * P.ammoniaRatio);
      const nh3AuxMW = nh3KgH * P.ammoniaMWhPerT / 1000;
      const auxNext = nh3AuxMW + lampMW;

      /* 罐存闭合：末 = 初 + 产 − 合成 − 燃料电池 */
      const h2NetKgH = prodKgH - nh3H2kgH - fcH2KgH;
      const h2EndKg = S.h2Kg + h2NetKgH * dtH;

      return {
        fcMW, pemCapMW, d, prodKgH, nh3H2kgH, nh3Running, nh3KgH, nh3Load, nh3AuxMW, lampMW,
        auxNext, h2NetKgH, h2EndKg, fcH2KgH, h2RateAvailKgH,
        genAvail, discharge, charge, gridBuy, gridBuyLoad, chargeSurplus, chargeGrid,
        curtail, exportMW, unserved, unservedDc, unservedAux, servedAfterLadder,
        servedTotal: d.dc + d.aux + d.sc + d.zinc + d.factory + d.pem,
        shedSc, shedPem, shedFac, shedZinc, zincFullStop,
        maxDis, maxChg, wantTotal, dcLoad, scDemand, zincWant, factoryWant, pemWant,
        sink: { dc: d.dc, aux: d.aux, sc: d.sc, zinc: d.zinc, factory: d.factory, pem: d.pem },
        /* 母线残差（构造上为 0，用于验证） */
        residual: (genAvail - curtail + gridBuy + discharge)
          - (d.dc + d.aux + d.sc + d.zinc + d.factory + d.pem + charge + exportMW)
      };
    }

    /* ------------------------------------------------------------------ */
    /* 单步提交                                                           */
    /* ------------------------------------------------------------------ */
    function validateStepInputs(inputs) {
      if (inputs == null) return null;
      if (typeof inputs !== 'object' || Array.isArray(inputs)) throw new TypeError('情境输入必须为对象');
      const limits = { itMW: P.itMaxMW, windMW: P.turbineRatedMW * P.turbineCount,
        solarMW: P.solarMWp, carportMW: P.carportMWp, trucks: P.scGuns };
      const out = {};
      for (const key of Object.keys(inputs)) {
        const value = inputs[key];
        if (!(key in limits) || typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > limits[key] || (key === 'trucks' && !Number.isInteger(value))) {
          throw new RangeError('无效情境输入：' + key);
        }
        out[key] = value;
      }
      return out;
    }
    function step(inputs) {
      // Validate before advancing; step() without inputs retains its existing behavior.
      const imposed = validateStepInputs(inputs);
      const dt = T.stepSeconds, dtH = dt / 3600;

      /* ① 跨日边界：先结算本日，再进入新日（欠账与库存结转，不清零） */
      if (Math.floor((S.simTime + dt) / 86400) !== Math.floor(S.simTime / 86400) && S.steps > 0) {
        closeDay();
      }

      S.simTime += dt;
      S.steps++;
      S.day = Math.floor(S.simTime / 86400) + 1;

      updateResources(dt);
      if (imposed) {
        Object.assign(S, imposed);
        if (Object.prototype.hasOwnProperty.call(imposed, 'windMW')) {
          for (let i = 0; i < P.turbineSampleCount; i++) S.turbP[i] = S.windMW / P.turbineCount;
        }
      }
      const scenarioConfig=cfg.SCENARIOS[S.scenario]||{};
      if((!imposed||imposed.solarMW==null)&&scenarioConfig.solarFactor!=null){S.solarMW*=scenarioConfig.solarFactor;S.carportMW*=scenarioConfig.solarFactor;}
      tasks.begin(S.simTime);
      advanceMachines(dt);

      /* ② 迭代求解：辅助用电、氢产量、燃料电池与电解槽互相耦合 */
      let g = { auxMW: S.airLoadMW || 0, nh3H2kgH: S.nh3H2kgH, pemMW: S.h2P, pemCapCeil: null };
      let R = null, converged = false, iters = 0;
      const MAXIT = 14;
      for (let i = 0; i < MAXIT; i++) {
        iters = i + 1;
        R = solveStep(dtH, g);
        /* 罐容越界时收紧电解槽上限，下一轮重算（事前限产，不用 clamp 删质量） */
        if (R.h2EndKg > P.tankKg + 1e-7) {
          const overKg = R.h2EndKg - P.tankKg;
          const reduceMW = overKg * 1000 / P.kWhPerKgH2 / dtH;
          g.pemCapCeil = Math.max(0, R.pemCapMW - reduceMW);
          g.auxMW = R.auxNext; g.nh3H2kgH = R.nh3H2kgH;
          if (g.pemCapCeil < P.electrolyserMinMW) g.pemCapCeil = 0;
          continue;
        }
        const dA = Math.abs(R.auxNext - g.auxMW);
        const dH = Math.abs(R.nh3H2kgH - g.nh3H2kgH);
        const dP = Math.abs(R.d.pem - (g.pemMW || 0));
        if (dA < 1e-9 && dH < 1e-9 && dP < 1e-9) { converged = true; break; }
        g = { auxMW: R.auxNext, nh3H2kgH: R.nh3H2kgH, pemMW: R.d.pem, pemCapCeil: R.pemCapMW };
      }
      S.solverIterations = iters;
      S.solverConverged = converged;
      if (!converged) pushEvent('warn', `第 ${S.day} 天本步耦合求解未在 ${MAXIT} 轮内收敛（辅助用电/氢产量/电解功率），已记录诊断`);

      applyStep(R, dtH, dt);
      tasks.finish(R,dtH,dt);
      if(S.steps%30===0||S.steps===1)S.taskLedger=tasks.snapshot();
      checkAlerts();
      if (S.steps % 60 === 0) {
        L.history.push({
          t: S.simTime, gen: S.genActualMW, load: S.demandServedMW,
          curtail: S.curtail, buy: S.gridBuy, soc: S.soc, h2: S.h2Kg, nh3: S.nh3KgH,
          renewShare: S.stepRenewShare || 0
        });
        if (L.history.length > 1440) L.history.shift();
      }
      return R;
    }

    function applyStep(R, dtH, dt) {
      const R2 = REGIONS[S.region];
      const prevSoc = S.soc;

      /* ---- 功率 ---- */
      S.fcMW = R.fcMW;
      S.h2P = R.d.pem;
      S.sc = R.d.sc; S.metal = R.d.zinc; S.factory = R.d.factory;
      S.stP = R.discharge - R.charge;
      S.gridBuy = R.gridBuy; S.curtail = R.curtail; S.exportMW = R.exportMW;
      S.unservedMW = R.unserved;
      S.releaseMW = R.shedSc + R.shedPem + R.shedFac + R.shedZinc;
      S.shedDeferredMW = R.shedPem + R.shedFac + R.shedZinc;
      S.genAvailMW = R.genAvail;
      S.genActualMW = R.genAvail - R.curtail;
      S.genMW = S.genActualMW;
      S.dcLoadMW = R.sink.dc;
      S.airLoadMW = R.auxNext;
      S.nh3AuxMW = R.nh3AuxMW;
      S.demandServedMW = R.sink.dc + R.sink.aux + R.sink.sc + R.sink.zinc + R.sink.factory + R.sink.pem;
      S.loadMW = R.sink.dc + R.sink.aux;                 // 园区基荷+公辅（不含柔性支线）
      S.demandDesiredMW = R.wantTotal;

      /* ---- 储能 SOC（效率只算一次） ---- */
      if (R.charge > EPS) S.soc += R.charge * dtH * P.chargeEta / P.storageMWh * 100;
      if (R.discharge > EPS) S.soc -= R.discharge * dtH / P.dischargeEta / P.storageMWh * 100;
      /* 边界保护只处理浮点误差；实质越界必须报错而不是静默裁剪 */
      if (S.soc > P.socHigh + 1e-6 || S.soc < P.socLow - 1e-6) {
        pushEvent('bad', `储能 SOC 越界（${S.soc.toFixed(6)}%），已记录为核算异常；请检查容量/效率约束`);
        S.socClampEvents = (S.socClampEvents || 0) + 1;
      }
      S.soc = clamp(S.soc, P.socLow, P.socHigh);

      /* ---- 氢：不做末端裁剪，只核对质量残差 ---- */
      S.h2ProdKgH = R.prodKgH;
      S.h2TankDrawKgH = Math.min(P.tankDrawKgPerH, S.h2Kg / Math.max(dtH, EPS));
      S.nh3H2kgH = R.nh3H2kgH; S.nh3KgH = R.nh3KgH; S.nh3Load = R.nh3Load;
      S.nh3Running = R.nh3Running;
      S.pemState = S.h2P > 0.5 ? 'running' : 'idle';
      const h2Start = S.h2Kg;
      S.h2Kg = h2Start + R.h2NetKgH * dtH;
      S.lastH2ResidualKg = S.h2Kg - (h2Start + (R.prodKgH - R.nh3H2kgH - R.fcH2KgH) * dtH);
      if (S.h2Kg > P.tankKg + 1e-6 || S.h2Kg < -1e-6) {
        pushEvent('bad', `储氢越界（${S.h2Kg.toFixed(6)} kg），已记录为核算异常；请检查罐容与限产约束`);
      }
      S.h2Kg = clamp(S.h2Kg, 0, P.tankKg);

      /* ---- 状态机迁移（由求解结果触发） ---- */
      if (R.zincFullStop) {
        S.zincStops++; S.zincState = 'stopping';
        pushEvent('warn', `电解锌车间全停（当日第 ${S.zincStops}/${P.zincMaxStopsPerDay} 次，最长 ${(P.zincStopMaxSeconds / 3600).toFixed(1)} h），未完成任务保留原截止时间`);
      }
      if (S.zincState === 'stopping' && S.metal <= EPS) { S.zincState = 'stopped'; S.zincStopUntil = S.simTime + P.zincStopMaxSeconds; }
      if (S.factoryState === 'running' && S.factory < EPS) S.factoryState = 'stopped';
      if (S.factoryState === 'stopped' && S.factory > EPS) S.factoryState = 'running';

      /* Legacy instantaneous plan deltas retained internally; public tasks committed after this step. */
      const dz = 0;
      const df = 0;
      const dp = 0;
      S.debtZinc += dz; S.debtFac += df; S.debtPem += dp;
      S.debtZincCarry += dz; S.debtFacCarry += df; S.debtPemCarry += dp;
      L.actualZincMWh += S.metal * dtH;
      L.actualFactoryMWh += S.factory * dtH;
      L.actualPemMWh += S.h2P * dtH;

      /* ---- 电能质量（示意估算） ---- */
      const totalLoad = S.demandServedMW;
      S.pfRaw = clamp(Q.basePf + Q.pfGainPer700MW * (totalLoad / 700) + 0.012 * Math.sin(S.simTime * 0.03), Q.pfLimitLow, Q.pfLimitHigh);
      const pMW = Math.max(0.001, totalLoad);
      S.qRawMvar = pMW * Math.tan(Math.acos(S.pfRaw));
      S.qSvgMvar = S.svgOn ? Math.min(Q.svgMvar, S.qRawMvar) : 0;
      S.qResidualMvar = Math.max(0, S.qRawMvar - S.qSvgMvar);
      S.pf = pMW / Math.hypot(pMW, S.qResidualMvar);
      S.thdRaw = Q.thdBase + Q.thdGainPer700MW * (totalLoad / 700) + 0.4 * Math.sin(S.simTime * 0.021 + 1);
      S.thd = S.apfOn ? S.thdRaw * Q.apfResidualRatio + Q.apfFloor : S.thdRaw;
      S.vdRaw = (totalLoad / 1500 - 0.45) * 7 + (0.92 - S.pfRaw) * Q.vdPfWeight;
      S.vd = S.svgOn ? S.vdRaw * 0.3 : S.vdRaw;

      /* ---- 来源账本 ----
       * 端用电成分 = 本步上母线的各来源按比例混合；
       * 储能充电单独归属（来自富余发电的部分按发电成分，来自购电的部分记为外购），
       * 避免"用外购电充电却把电池标成绿电"这类错误。 */
      const renewMW = S.windMW + S.solarMW + S.carportMW;
      /* 弃电（发电前削减）按各电源可用出力比例分摊，避免把弃电全部记在可再生头上 */
      const genSum = renewMW + S.smr + S.gensetMW;
      const shareOf = v => (genSum > EPS ? v / genSum : 0);
      const used = v => v - S.curtail * shareOf(v);
      const usedRenew = used(renewMW), usedNuclear = used(S.smr), usedGas = used(S.gensetMW);

      const battPre = L.battMWh.total > EPS ? L.battMWh.total : 0;
      const h2PreTot = sumMix(L.h2MixKg, MK);
      const fcOrigin = zeroMix(MK), disOrigin = zeroMix(MK);
      if (R.fcMW > EPS) {
        if (h2PreTot > EPS) for (const k of MK) fcOrigin[k] = R.fcMW * (L.h2MixKg[k] / h2PreTot);
        else fcOrigin.unknown = R.fcMW;
      }
      if (R.discharge > EPS) {
        if (battPre > EPS) for (const k of MK) disOrigin[k] = R.discharge * (L.battMWh.mix[k] / battPre);
        else disOrigin.unknown = R.discharge;
      }

      const contrib = zeroMix(MK);
      contrib.renew = usedRenew + fcOrigin.renew + disOrigin.renew;
      contrib.nuclear = usedNuclear + fcOrigin.nuclear + disOrigin.nuclear;
      contrib.gas = usedGas + fcOrigin.gas + disOrigin.gas;
      contrib.grid = R.gridBuyLoad + fcOrigin.grid + disOrigin.grid;
      contrib.unknown = fcOrigin.unknown + disOrigin.unknown;
      /* 被储能吸收的富余发电改变了送端用电，按比例从一次能源部分扣除 */
      const genPart = contrib.renew + contrib.nuclear + contrib.gas;
      if (genPart > EPS && R.chargeSurplus > EPS) {
        const keep = Math.max(0, (genPart - R.chargeSurplus) / genPart);
        contrib.renew *= keep; contrib.nuclear *= keep; contrib.gas *= keep;
      }
      const contribTotal = sumMix(contrib, MK);
      const frac = mixNorm(contrib, MK, contribTotal);

      /* 消费侧成分 */
      const consumeMWh = S.demandServedMW * dtH;
      for (const k of MK) L.consumption[k] += consumeMWh * frac[k];

      /* 一次能源发电量：只记风光车棚/SMR/燃气，不含电池放电与氢回发 */
      L.primaryGenMWh.renew += usedRenew * dtH;
      L.primaryGenMWh.nuclear += usedNuclear * dtH;
      L.primaryGenMWh.gas += usedGas * dtH;
      L.primaryGenMWh.grid += S.gridBuy * dtH;
      L.recircMWh += (R.discharge + R.fcMW) * dtH;

      /* 电池库存成分：充电按"富余发电成分 / 外购电"分别归属 */
      if (R.charge > EPS) {
        const chgMix = zeroMix(MK);
        if (R.chargeSurplus > EPS) {
          const gp = usedRenew + usedNuclear + usedGas;
          if (gp > EPS) {
            chgMix.renew = R.chargeSurplus * usedRenew / gp;
            chgMix.nuclear = R.chargeSurplus * usedNuclear / gp;
            chgMix.gas = R.chargeSurplus * usedGas / gp;
          } else chgMix.unknown = R.chargeSurplus;
        }
        if (R.chargeGrid > EPS) chgMix.grid += R.chargeGrid;
        L.battMWh.total += R.charge * dtH * P.chargeEta;
        for (const k of MK) L.battMWh.mix[k] += chgMix[k] * dtH * P.chargeEta;
      }
      if (R.discharge > EPS && battPre > EPS) {
        L.battMWh.total = Math.max(0, L.battMWh.total - R.discharge * dtH / P.dischargeEta);
        for (const k of MK) L.battMWh.mix[k] = Math.max(0, L.battMWh.mix[k] - R.discharge * dtH / P.dischargeEta * (L.battMWh.mix[k] / battPre));
      }
      renormalize(L.battMWh.mix, L.battMWh.total, MK);

      /* 氢库存成分（完全混合）：制氢电量按送端成分归属 */
      const prodKg = R.prodKgH * dtH;
      if (prodKg > EPS) for (const k of MK) L.h2MixKg[k] += prodKg * frac[k];
      const usedKg = (R.nh3H2kgH + R.fcH2KgH) * dtH;
      if (usedKg > EPS && h2PreTot > EPS) {
        for (const k of MK) L.h2MixKg[k] = Math.max(0, L.h2MixKg[k] - usedKg * (L.h2MixKg[k] / h2PreTot));
      }
      /* 数值漂移归零：以总质量为准重新归一（仅浮点级） */
      renormalize(L.h2MixKg, S.h2Kg, MK);
      S.h2LossKgH = 0;

      /* 排放在此按来源分别累计 */
      const gridCO2 = S.gridBuy * dtH * R2.co2;
      L.gridCO2T += gridCO2; S.dGridCO2 += gridCO2;
      const gasMWh = S.gensetMW * dtH;
      S.dGasMWh += gasMWh;
      if (P.gasFactorTPerMWh == null) {
        L.gasUnaccountedMWh += gasMWh; S.unaccountedGasMWh += gasMWh;
      } else {
        const g2 = gasMWh * P.gasFactorTPerMWh;
        L.gasCO2T += g2; S.dGasCO2 += g2;
      }

      /* ---- 累计电量 ---- */
      L.genMWh += S.genActualMW * dtH; L.loadMWh += S.demandServedMW * dtH;
      L.buyMWh += S.gridBuy * dtH; L.curtailMWh += S.curtail * dtH;
      L.unservedMWh += S.unservedMW * dtH; L.exportMWh += S.exportMW * dtH;
      L.chargeMWh += R.charge * dtH; L.dischargeMWh += R.discharge * dtH;
      L.h2ProducedKg += R.prodKgH * dtH;
      L.h2ToAmmoniaKg += R.nh3H2kgH * dtH;
      L.h2ToFuelCellKg += R.fcH2KgH * dtH;
      L.nh3Tonnes += R.nh3KgH * dtH / 1000;

      S.dGen += S.genActualMW * dtH; S.dLoad += S.loadMW * dtH;
      S.dBuy += S.gridBuy * dtH; S.dCur += S.curtail * dtH; S.dUnserved += S.unservedMW * dtH;
      S.dSc += S.sc * dtH; S.dMt += S.metal * dtH; S.dFa += S.factory * dtH;
      S.dH2Mwh += S.h2P * dtH; S.dH2kg += R.prodKgH * dtH;
      S.dNh3t += R.nh3KgH * dtH / 1000;
      const deliveredITMW = S.itMW * clamp(R.sink.dc / Math.max(EPS, R.dcLoad), 0, 1);
      S.dTokB += deliveredITMW * cfg.DISPATCH.tokenPerMWh / 1e9 * dtH;
      S.dChg += R.charge * dtH; S.dDis += R.discharge * dtH;
      S.dH2UseKg += (R.nh3H2kgH + R.fcH2KgH) * dtH;
      S.dGen = S.dGen;
      S.dSrcGen.renew += used(renewMW) * dtH;
      S.dSrcGen.nuclear += used(S.smr) * dtH;
      S.dSrcGen.gas += used(S.gensetMW) * dtH;
      S.dSrcGen.grid += S.gridBuy * dtH;
      S.dSinkLoad.dc = (S.dSinkLoad.dc || 0) + R.sink.dc * dtH;
      S.dSinkLoad.flex = (S.dSinkLoad.flex || 0) + (R.sink.sc + R.sink.zinc + R.sink.factory + R.sink.pem) * dtH;
      S.dSinkLoad.aux = (S.dSinkLoad.aux || 0) + R.sink.aux * dtH;
      S.dGreenConsumed += consumeMWh * frac.renew;

      /* ---- 指标 ---- */
      S.pue = R.sink.dc / Math.max(0.001, S.itMW);
      S.primaryRenewableMW = usedRenew;
      S.gridEmissionTPerMWh = R2.co2;
      const consTot = sumMix(L.consumption, MK);
      S.renewableShareOfConsumption = consTot > EPS ? L.consumption.renew / consTot : 0;
      S.cleanShareOfConsumption = consTot > EPS ? (L.consumption.renew + L.consumption.nuclear) / consTot : 0;
      S.stepFrac = frac;
      S.stepRenewShare = frac.renew;
      S.stepCleanShare = frac.renew + frac.nuclear;
      S.curRate = S.genAvailMW > 0.5 ? S.curtail / S.genAvailMW * 100 : 0;
      const renewAvail = renewMW;
      S.selfUse = renewAvail > 0.5 ? clamp((renewAvail - Math.min(S.curtail, renewAvail)) / renewAvail, 0, 1) : -1;
      S.exportRate = S.genAvailMW > 0.5 ? S.exportMW / S.genAvailMW * 100 : 0;
      S.lastResidualMW = R.residual;
      /* 兼容旧字段名 */
      S.greenRatio = S.renewableShareOfConsumption;
      S.cleanShare = S.cleanShareOfConsumption;
      S.carbInt = null;
      S.dGreen = S.dGreenConsumed;
      S.dCo2 = S.dGridCO2 + S.dGasCO2;
      S.dLoad = S.dSinkLoad.dc + (S.dSinkLoad.aux || 0);
    }

    function closeDay() {
      const rec = {
        day: S.day, date: `D${S.day}`, hours: S.steps ? 24 : (24 - T.startHour),
        genMWh: L.genMWh - (L._accGen || 0), loadMWh: L.loadMWh - (L._accLoad || 0),
        buyMWh: L.buyMWh - (L._accBuy || 0), curtailMWh: L.curtailMWh - (L._accCur || 0),
        unservedMWh: L.unservedMWh - (L._accUn || 0),
        gridCO2T: L.gridCO2T - (L._accGridCO2 || 0), gasCO2T: L.gasCO2T - (L._accGasCO2 || 0),
        h2ProdKg: L.h2ProducedKg - (L._accH2 || 0), nh3T: L.nh3Tonnes - (L._accNh3 || 0),
        socEnd: S.soc, h2EndKg: S.h2Kg,
        debtZincEndMWh: S.debtZinc, debtFactoryEndMWh: S.debtFac, debtPemEndMWh: S.debtPem,
        zincStops: S.zincStops, unservedCarry: S.dUnserved,
        consumption: zeroMix(MK)
      };
      const dayCons = zeroMix(MK);
      for (const k of MK) dayCons[k] = L.consumption[k] - (L._accCons ? L._accCons[k] : 0);
      rec.consumption = dayCons;
      const dayTot = sumMix(dayCons, MK);
      rec.renewableShare = dayTot > EPS ? dayCons.renew / dayTot : 0;
      rec.cleanShare = dayTot > EPS ? (dayCons.renew + dayCons.nuclear) / dayTot : 0;
      rec.policyStatus = cfg.POLICY.status === 'pending' ? '待核算' : '已配置';
      L.days.push(rec);
      L._accGen = L.genMWh; L._accLoad = L.loadMWh; L._accBuy = L.buyMWh;
      L._accCur = L.curtailMWh; L._accUn = L.unservedMWh;
      L._accGridCO2 = L.gridCO2T; L._accGasCO2 = L.gasCO2T;
      L._accH2 = L.h2ProducedKg; L._accNh3 = L.nh3Tonnes;
      L._accCons = Object.assign({}, L.consumption);

      /* 跨日：日累计清零，欠账与库存结转 */
      S.dGen = S.dLoad = S.dBuy = S.dCur = S.dUnserved = 0;
      S.dSc = S.dMt = S.dFa = S.dH2Mwh = S.dH2kg = S.dNh3t = S.dTokB = 0;
      S.dGridCO2 = S.dGasCO2 = 0; S.dGasMWh = 0;
      S.dGreenConsumed = 0; S.dChg = 0; S.dDis = 0; S.dH2UseKg = 0;
      S.dSrcGen = zeroMix(MK);
      S.dSinkLoad = { dc: 0, flex: 0, aux: 0 };
      S.zincStops = 0; S.zincStopUntil = 0;
      pushEvent('info', `第 ${rec.day + 1} 天开始：当日累计清零；任务按原期限结转、不互相抵消（锌 ${S.debtZinc.toFixed(1)} / 工厂 ${S.debtFac.toFixed(1)} / 制氢 ${S.debtPem.toFixed(1)} MWh）`);
    }

    /* ------------------------------------------------------------------ */
    /* 告警                                                               */
    /* ------------------------------------------------------------------ */
    function checkAlerts() {
      if (S.unservedMW > 0.5) throttled('unserved', 'bad', `未供电 ${S.unservedMW.toFixed(1)} MW：购电通道已用尽且负荷已到下限，属供电事故而非正常调节能力`, 600);
      if (S.gridBuy > 5) throttled('buy', 'warn', `功率缺口：柔性负荷压减 ${S.releaseMW.toFixed(1)} MW 后仍购电 ${S.gridBuy.toFixed(1)} MW`, 1800);
      if (S.curtail > 5) throttled('cur', 'warn', `弃电 ${S.curtail.toFixed(1)} MW：柔性消纳与储能容量已打满`, 1800);
      if (S.soc <= 12) throttled('socLo', 'warn', `储能 SOC 偏低（${S.soc.toFixed(1)}%），放电能力受限`, 3600);
      if (S.h2Kg >= P.tankKg * 0.995) throttled('h2full', 'info', `储氢罐接近满（${S.h2Kg.toFixed(0)} kg），电解槽已事前限产`, 3600);
      if (S.h2Kg <= 1 && S.nh3Running) throttled('h2empty', 'warn', '储氢不足，合成氨降负荷或停机', 1800);
      if (!S.svgOn && S.pfRaw < 0.9) throttled('pf', 'warn', `功率因数 ${S.pfRaw.toFixed(2)} 越限，建议投入 SVG`, 1800);
      if (S.thd > Q.thdLimitPercent) throttled('thd', 'warn', `THDu ${S.thd.toFixed(1)}% 超 ${Q.thdLimitPercent}% 参考限值（示意估算，未做谐波阻抗计算）`, 1800);
      if (S.unaccountedGasMWh > 1) throttled('gasfac', 'info', `燃气直接排放因子未配置：累计 ${S.unaccountedGasMWh.toFixed(1)} MWh 未计排放，界面按「待配置」显示`, 3600);
    }

    /* ------------------------------------------------------------------ */
    /* 推进与查询                                                         */
    /* ------------------------------------------------------------------ */
    function advance(simSeconds) {
      let left = Math.max(0, simSeconds);
      const dt = T.stepSeconds;
      let n = 0;
      while (left >= dt - 1e-9 && n < 500000) { step(); left -= dt; n++; }
      return n;
    }
    /* 按真实帧推进：倍速只改变仿真秒数，物理步长恒定。
     * 浏览器休眠唤醒后的单帧真实间隔被截断，避免长时间阻塞；
     * 因此本模型不用于真实时间的计量。 */
    function tick(realDtSec) {
      if (!S.running) return 0;
      const dt = Math.min(realDtSec, T.maxFrameCatchUpSeconds);
      tickRemainder+=dt*S.timeScale;
      const count=advance(tickRemainder);tickRemainder-=count*T.stepSeconds;return count;
    }

    function sumMix(o, keys) { let s = 0; for (const k of keys) s += (o[k] || 0); return s; }

    /* 按目标总量归一化来源成分。仅处理浮点漂移（相对误差 ~1e-15）；
     * 总量接近 0 时把剩余质量归入「未知来源」，不做任何物理裁剪。 */
    function renormalize(mix, target, keys) {
      const sum = sumMix(mix, keys);
      if (sum > 1e-12) {
        const f = target / sum;
        for (const k of keys) mix[k] *= f;
      } else {
        for (const k of keys) mix[k] = 0;
        mix.unknown = Math.max(0, target);
      }
    }

    function snapshot() {
      const consTot = sumMix(L.consumption, MK);
      return {
        simTime: S.simTime, day: S.day, soc: S.soc, h2Kg: S.h2Kg,
        genMW: S.genActualMW, genAvailMW: S.genAvailMW, curtailMW: S.curtail,
        dcLoadMW: S.dcLoadMW, demandServedMW: S.demandServedMW,
        gridBuyMW: S.gridBuy, dischargeMW: Math.max(0, S.stP), chargeMW: Math.max(0, -S.stP),
        unservedMW: S.unservedMW, pue: S.pue,
        nh3KgH: S.nh3KgH, nh3TDay: S.dNh3t,
        renewableShare: consTot > EPS ? L.consumption.renew / consTot : 0,
        cleanShare: consTot > EPS ? (L.consumption.renew + L.consumption.nuclear) / consTot : 0,
        gridEmissionTPerMWh: REGIONS[S.region].co2,
        gridCO2T: L.gridCO2T, gasCO2T: L.gasCO2T, gasUnaccountedMWh: L.gasUnaccountedMWh,
        policyStatus: cfg.POLICY.status,
        debt: { zinc: S.debtZinc, factory: S.debtFac, pem: S.debtPem },
        residuals: { powerMW: S.lastResidualMW, h2Kg: S.lastH2ResidualKg },
        solver: { iterations: S.solverIterations, converged: S.solverConverged }
      };
    }

    function exportLedger() {
      return {
        version: cfg.version, generatedAtSimTime: S.simTime,
        fulfillment: tasks.snapshot(),
        region: S.region, scenario: S.scenario, seed: S.seed,
        flows: {
          generationMWh: L.genMWh, loadMWh: L.loadMWh, gridBuyMWh: L.buyMWh,
          curtailMWh: L.curtailMWh, unservedMWh: L.unservedMWh, exportMWh: L.exportMWh,
          chargeMWh: L.chargeMWh, dischargeMWh: L.dischargeMWh
        },
        primaryGenerationMWh: L.primaryGenMWh,
        recirculatedMWh: L.recircMWh,
        consumptionBySourceMWh: L.consumption,
        storageInventory: { totalMWh: L.battMWh.total, bySource: L.battMWh.mix },
        hydrogenInventory: { totalKg: S.h2Kg, bySource: L.h2MixKg },
        hydrogen: {
          startKg: L.h2StartKg || 0,
          producedKg: L.h2ProducedKg, toAmmoniaKg: L.h2ToAmmoniaKg,
          toFuelCellKg: L.h2ToFuelCellKg, ammoniaTonnes: L.nh3Tonnes,
          /* 余额应为 0（机器精度）；非 0 即为质量不闭合，需查因 */
          balanceKg: (L.h2StartKg || 0) + L.h2ProducedKg - L.h2ToAmmoniaKg - L.h2ToFuelCellKg - S.h2Kg
        },
        emissionsT: { grid: L.gridCO2T, gas: L.gasCO2T, gasUnaccountedMWh: L.gasUnaccountedMWh },
        plan: Object.fromEntries(tasks.snapshot().production.map(t=>[t.key,{unit:t.unit,planMWh:t.target,completedMWh:t.done,pendingMWh:t.remaining,overdueMWh:t.overdue,extraMWh:t.extra}])),
        days: L.days,
        events: L.events.slice(-80)
      };
    }

    /* ---------------- 初始化 ---------------- */
    reset({});

    return {
      cfg, S, K, L, REGIONS, MK,
      reset, step, advance, tick, snapshot, exportLedger,
      taskSnapshot:()=>tasks.snapshot(), createServiceOrder:()=>tasks.order(), confirmServiceOrder:(id,price)=>tasks.settle(id,price),
      sunGeometry, lampLevelAt,
      onEvent(fn) { listeners.event.push(fn); },
      /* 供表现层/测试使用 */
      _internal: { solveStep, applyStep, closeDay, sumMix, zeroMix, mixNorm, mulberry32 }
    };
  }

  return { createEngine, mulberry32, clamp };
});
