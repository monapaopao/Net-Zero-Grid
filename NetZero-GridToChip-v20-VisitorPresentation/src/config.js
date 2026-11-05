/* =====================================================================
 * 戈壁之光 · 零碳能量中枢 —— 统一参数配置
 * GobiLight-NetZero  v1.0.0
 *
 * 本文件是可编辑的工程假设与演示配置。凡标注「演示假设」的数值，
 * 都不是项目实测值、厂家性能或政策认证值；替换为真实资料前，
 * 界面按「示意/待配置」显示，不参与达标结论。
 * ===================================================================== */
(function (root, factory) {
  const cfg = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = cfg;
  root.NZ_CONFIG = cfg;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ---------------- 时间与物理步长 ---------------- */
  const TIME = {
    stepSeconds: 1,          // 固定物理步长；物理时间与渲染帧率解耦
    startHour: 12,           // 演示起点（典型日正午，光照接近峰值）
    maxFrameCatchUpSeconds: 2, // 浏览器休眠唤醒后单帧最多补算的仿真秒数
    speedPresets: [1, 60, 240, 1200, 3600]
  };

  /* ---------------- 地区资源与电网因子 ----------------
   * co2：tCO2/MWh（数值与官方 kgCO2/kWh 相同），来源＝生态环境部、国家统计局
   * 《关于发布 2023 年电力二氧化碳排放因子的公告》（2025 年第 47 号）省级平均值。
   * 不称为「2026 年实时因子」；用于电网购入电量的间接排放，不用于燃气机组直接燃烧排放。 */
  const FACTOR_SOURCE = {
    label: '2023 年省级电网平均排放因子',
    publisher: '生态环境部、国家统计局',
    bulletin: '2025 年第 47 号公告',
    year: 2023,
    url: 'https://www.mee.gov.cn/xxgk2018/xxgk/xxgk01/202512/t20251231_1139517.html',
    unit: 'tCO2/MWh'
  };

  const REGIONS = {
    xinjiang: {
      name: '新疆 · 多园区共享综合能源系统', short: '多园区共享综合能源系统',
      windMean: 7.8, windVol: 0.85, sunPeak: 0.90, dayLen: 10.5, co2: 0.6021,
      desc: '新疆多园区共享综合能源系统：毗邻达坂城风区，风能利用小时约 2800 h、太阳能利用小时约 1600 h（年日照 2800–3200 h），大型风光基地与算电直连园区承载地。风速均值按 7.8 m/s 取值，与地区描述一致。'
    },
    neimenggu: {
      name: '内蒙古 · 风光大基地', short: '内蒙古',
      windMean: 7.5, windVol: 1.00, sunPeak: 0.85, dayLen: 10.0, co2: 0.6479,
      desc: '内蒙古：年均风速约 7.5 m/s（本版已与配置值统一，原演示文案 8.8 与描述 7.5 不一致），风能利用小时 3000 h 以上；电网排放因子偏高，绿电替代减排空间大。'
    },
    gansu: {
      name: '甘肃 · 河西走廊', short: '甘肃',
      windMean: 7.6, windVol: 0.90, sunPeak: 0.88, dayLen: 10.0, co2: 0.4471,
      desc: '甘肃河西走廊：风廊道效应明显，风光互补性好；新能源装机占比高，外送通道受走廊容量限制。'
    },
    qinghai: {
      name: '青海 · 光伏极佳', short: '青海',
      windMean: 6.0, windVol: 0.70, sunPeak: 1.00, dayLen: 10.5, co2: 0.1796,
      desc: '青海：年日照 3000 h 以上，光伏利用小时全国领先，水光互补；电网排放因子低。'
    },
    jiangsu: {
      name: '江苏沿海 · 海上风电', short: '江苏',
      windMean: 8.0, windVol: 0.55, sunPeak: 0.70, dayLen: 9.5, co2: 0.5827,
      desc: '江苏沿海：海上风速高且出力波动小，光照一般；负荷密集，就地消纳条件好。'
    },
    sichuan: {
      name: '四川 · 水电丰沛', short: '四川',
      windMean: 4.5, windVol: 0.50, sunPeak: 0.55, dayLen: 9.0, co2: 0.1564,
      desc: '四川：水电丰沛，风资源一般、多云寡照；电网排放因子低，丰水期富余电力多。'
    },
    guangdong: {
      name: '广东 · 负荷中心', short: '广东',
      windMean: 6.0, windVol: 0.70, sunPeak: 0.72, dayLen: 9.5, co2: 0.4419,
      desc: '广东：全国最大负荷中心，资源一般但消纳能力极强，海上风电与分布式光伏发展快。'
    }
  };

  /* ---------------- 设备容量与物理约束（演示假设） ---------------- */
  const PLANT = {
    /* 风电：100 × 6 MW = 600 MW。图面示意 12 台样本机，功率按 100/12 外推。 */
    turbineRatedMW: 6, turbineCount: 100, turbineSampleCount: 12,
    windCutIn: 3, windRated: 12, windCutOut: 25,
    /* 光伏与车棚 */
    solarMWp: 400, carportMWp: 0.5,
    /* 小型模块化反应堆：默认关闭，只在「前瞻研究情景」启用 */
    smrMWe: 30, smrRampMWPerMin: 1, smrDefaultEnabled: false,
    /* 备用燃气轮机：默认冷备用；直接排放因子缺省为空（待配置） */
    gasMW: 50, gasRampMWPerMin: 50, gasFactorTPerMWh: null,
    /* 氢燃料电池：2 MW，耗氢 60 kg/MWh（按氢低位热值约 33.3 kWh/kg 推得效率约 50%） */
    fuelCellMW: 2, fuelCellKgPerMWh: 60, fuelCellMinTankKg: 50,
    /* 储能：300 MWh / 150 MW（名义 2 h）。单程效率 95%，往返 90.25% */
    storageMWh: 300, storageMW: 150, socLow: 10, socHigh: 95,
    chargeEta: 0.95, dischargeEta: 0.95,
    /* 电解水制氢：200 MW 硬上限，最小技术出力 20 MW，综合电耗 48 kWh/kg（含压缩/纯化与否待厂家确认） */
    electrolyserMW: 200, electrolyserMinMW: 20, kWhPerKgH2: 48,
    /* 储氢：10000 kg 高压气态；最大出罐流量为演示配置，需厂家资料替换 */
    tankKg: 10000, tankDrawKgPerH: 2320,
    /* 合成氨：最大耗氢 2200 kg/h，氢氨质量比 17/3，厂用电 0.8 MWh/t NH3 */
    ammoniaH2KgPerH: 2200, ammoniaH2MinKgPerH: 220,
    ammoniaRampKgPerHPerMin: 2200 / 30,      // 30 min 达到额定（演示假设）
    ammoniaMWhPerT: 0.8, ammoniaRatio: 17 / 3,
    /* 数据中心：高压直流链路效率 97.5%，机房固定 10 MW，随 IT 线性 8% 辅助 */
    panamaEta: 0.975, dcFixedMW: 10, dcAuxRatio: 0.08, itMinMW: 50, itMaxMW: 300,
    /* 超充站：24 车位 × 1.2 MW = 28.8 MW，100% 秒级可中断 */
    scGuns: 24, scGunMW: 1.2,
    scArrivePerHDay: 6.0, scArrivePerHNight: 0.5,
    scLeavePerHCharging: 0.4, scLeavePerHIdle: 0.9,
    /* 电解锌：40–200 MW，双向爬坡 200 MW/min，每日全停 ≤2 次、单次 ≤2 h */
    zincMW: 200, zincMinMW: 40, zincRampMWPerMin: 200,
    zincMaxStopsPerDay: 2, zincStopMaxSeconds: 7200,
    /* 智能工厂：20–100 MW，保安负荷 20%；爬坡 50 MW/min（演示假设） */
    factoryMW: 100, factoryMinMW: 20, factoryRampMWPerMin: 50,
    /* 生产计划（用于欠账核算，演示假设） */
    zincPlanMW: 100, factoryPlanMW: 50, pemPlanMW: 80,
    /* 园区辅助：路灯等象征性小负荷 */
    lampBaseMW: 0.05
  };

  /* ---------------- 电源属性账本 ----------------
   * 一次能源类别：可再生 / 核电 / 外购电 / 燃气 / 未知。
   * 初始库存来源未知，不自动计入认证绿电或绿氢。 */
  const MIX_KEYS = ['renew', 'nuclear', 'grid', 'gas', 'unknown'];
  const MIX_LABEL = {
    renew: '可再生（风/光/车棚）',
    nuclear: '核电（SMR 研究情景）',
    grid: '电网购入',
    gas: '燃气机组',
    unknown: '未知来源（初始库存）'
  };

  /* ---------------- 电网交互（本演示的配置，不是全国统一政策） -------- */
  const GRID = {
    importLimitMW: 400,          // 演示假设：购电通道上限
    allowGridCharge: false,      // 默认禁止用购电给储能充电
    exportLimitMW: 0,            // 本演示按「余电不上网」配置
    curtailAllowed: true
  };

  /* ---------------- 政策对标边界 ----------------
   * 综合能耗的等价值折标系数、非电能源边界、年度口径未配置时，
   * 政策状态显示「待核算」，不据瞬时功率出达标结论。 */
  const POLICY = {
    status: 'pending',
    reason: '缺少年度综合能耗（等价值口径）、非电能源边界与非电燃料因子',
    comprehensiveEnergyTcePerYear: null,   // 年度综合能耗，吨标准煤（等价值）
    unitCarbonThreshold: null,             // 由年度能耗规模决定的阈值（发改环资〔2025〕910 号附件）
    note: '发改环资〔2025〕910 号附件 3：电力消费能耗按当量值还是等价值、阈值按年综合能耗规模分档，均需按适用年度核验；本演示不据此出结论。',
    sources: [
      { label: '国家级零碳园区建设指标体系（试行）·发改环资〔2025〕910 号附件 3', url: 'https://www.ndrc.gov.cn/xwdt/tzgg/202507/P020250708510068921321.pdf' },
      { label: '关于有序推动绿电直连发展有关事项的通知 · 发改能源〔2025〕650 号', url: 'https://www.ndrc.gov.cn/xxgk/zcfb/tz/202505/t20250530_1398138.html' }
    ]
  };

  /* ---------------- 电能质量（示意估算，非潮流/谐波计算） ---------------- */
  const POWER_QUALITY = {
    svgMvar: 50,                 // ±50 Mvar，容量饱和时允许目标达不到
    basePf: 0.79, pfGainPer700MW: 0.13, pfLimitLow: 0.78, pfLimitHigh: 0.96,
    thdBase: 4.5, thdGainPer700MW: 4.5,
    apfResidualRatio: 0.28, apfFloor: 0.4,
    thdLimitPercent: 4.0,        // GB/T 14549 35 kV 母线 THDu 限值；实施时按电压等级与有效版本核验
    vdSlopePerMW: 7 / 1500, vdPfWeight: 6,
    measurementPoint: '35 kV 柔性消纳母线（示意测点）',
    modelType: '示意估算（未建立潮流与谐波阻抗模型）'
  };

  /* ---------------- 视觉方向：戈壁之光 · 零碳能量中枢 ---------------- */
  const PALETTE = {
    bgDeep: '#F7F9F9', panel: '#FFFFFF', panelSolid: '#FFFFFF',
    text: '#26383C', dim: '#647B80', faint: '#74898E',
    power: '#D89737',      // 主要电力流
    gold: '#087D73',       // 暖金品牌与高光
    hydrogen: '#398AD1',   // 氢流
    ammonia: '#8C78B5',    // 氨流
    data: '#519662',       // 数据流（细虚线）
    warn: '#AD7424', fault: '#BA4C4C', ok: '#278E76',
    grid: '#809298'        // 外购电：运行状态，不用故障红
  };

  /* ---------------- 光照预设 ---------------- */
  const LIGHT_PRESETS = {
    'blue-hour': { label: '柔光展厅', key: '#FFD9A8', keyInt: 1.05, fill: '#4E7FB8', fillInt: 0.42, rim: '#7FDCFF', rimInt: 0.55, hemiSky: '#2C4C74', hemiGround: '#4A3A28', hemiInt: 0.55, ambient: 0.16, fog: '#0B1B2B', fogNear: 240, fogFar: 900, exposure: 1.05, sunElev: 0.16, sunAzim: -0.9, stars: 0.35, lamps: 1.0, exhibit: true },
    'day-lab': { label: '工程白模', key: '#FFF9F0', keyInt: 1.42, fill: '#B9D6F0', fillInt: 0.46, rim: '#FFFFFF', rimInt: 0.18, hemiSky: '#A9C6E2', hemiGround: '#BCCFCA', hemiInt: 0.52, ambient: 0.17, fog: '#B4C9D8', fogNear: 340, fogFar: 1350, exposure: 1.03, sunElev: 0.62, sunAzim: -0.45, stars: 0, lamps: 0, exhibit: false },
    'night': { label: '夜间展厅', key: '#AFC4E4', keyInt: 0.30, fill: '#2E4C6E', fillInt: 0.38, rim: '#5FA8D8', rimInt: 0.34, hemiSky: '#1B3048', hemiGround: '#2A2018', hemiInt: 0.34, ambient: 0.15, fog: '#060E18', fogNear: 200, fogFar: 780, exposure: 1.12, sunElev: -0.30, sunAzim: -0.9, stars: 1.0, lamps: 1.0, exhibit: true },
    follow: { label: '跟随仿真', key: null, keyInt: null, fill: null, fillInt: null, rim: null, rimInt: null, hemiSky: null, hemiGround: null, hemiInt: null, ambient: null, fog: null, fogNear: 240, fogFar: 900, exposure: 1.02, sunElev: null, sunAzim: null, stars: null, lamps: null, exhibit: false }
  };

  /* ---------------- 画质档位 ---------------- */
  const QUALITY = {
    /* 精致档增加环境模型、深度环境光遮蔽和受控泛光；不影响仿真。 */
    high: { label: '精致', pixelRatioMax: 1.75, shadows: true, shadowMapSize: 2048, ao: true, bloom: true, stars: 900, particles: 22, anisotropy: 4 },
    standard: { label: '标准', pixelRatioMax: 1.25, shadows: true, shadowMapSize: 1024, ao: false, bloom: false, stars: 600, particles: 14, anisotropy: 2 },
    compat: { label: '兼容', pixelRatioMax: 1.0, shadows: false, shadowMapSize: 512, ao: false, bloom: false, stars: 320, particles: 8, anisotropy: 1 }
  };

  /* ---------------- 可复现情景 ---------------- */
  const SCENARIOS = {
    'park': {
      label: '多园区协同（默认）', hint: 'SMR 关闭；正午起步，工业优先',
      region: 'xinjiang', hour: 12, windManual: false, smrEnabled: false,
      soc: 55, h2Kg: 400, itMW: 150, stMode: 'auto',
      seed: 20260722, note: '与旧版默认值的差别：SMR 由「100% 运行」改为默认关闭，另设「含 SMR 前瞻研究」情景。'
    },
    'surplus': {
      label: '风光富余', hint: '12 m/s 手动风、SOC 90%，看储能与柔性负荷消纳',
      region: 'xinjiang', hour: 12, windManual: true, wind: 12, smrEnabled: false,
      soc: 90, h2Kg: 3000, itMW: 150, stMode: 'auto', seed: 20260801, note: ''
    },
    'night': {
      label: '夜间保供', hint: '22:00、6 m/s，光伏自然为 0',
      region: 'xinjiang', hour: 22, windManual: true, wind: 6, smrEnabled: false,
      soc: 60, h2Kg: 2000, itMW: 150, stMode: 'auto', seed: 20260802, note: ''
    },
    'lowwind': {
      label: '低风低光', hint: '轻风、SOC 15%，观察购电与未供电记录',
      region: 'xinjiang', hour: 23, windManual: true, wind: 3, smrEnabled: false,
      soc: 15, h2Kg: 600, itMW: 150, stMode: 'auto', seed: 20260803, note: ''
    },
    'tankfull': {
      label: '制氢受储罐约束', hint: '强风、SOC 95%、储氢 9900 kg，看事前限产',
      region: 'xinjiang', hour: 12, windManual: true, wind: 14, smrEnabled: false,
      soc: 95, h2Kg: 9900, itMW: 150, stMode: 'auto', seed: 20260804, note: ''
    },
    'gasbackup': {
      label: '燃气备用投入', hint: '夜间低风、SOC 10%，燃气按爬坡启动',
      region: 'xinjiang', hour: 23, windManual: true, wind: 2.5, smrEnabled: false,
      soc: 10, h2Kg: 300, itMW: 150, stMode: 'auto', seed: 20260805, note: ''
    },
    'smr': {
      label: '含 SMR 前瞻研究', hint: '30 MWe 研究电源并入，不代表园区已建成该机组',
      region: 'xinjiang', hour: 12, windManual: false, smrEnabled: true,
      soc: 55, h2Kg: 400, itMW: 150, stMode: 'auto', seed: 20260806, note: ''
    }
  };

  /* ---------------- 品牌与文案 ----------------
   * 产品侧只保留可追溯口径的说法；未经验证的百分比收益不进入本版界面。 */
  const DISPATCH = {enabled:true, cycleHours:24, urgentHours:4, deadlineBufferHours:1, reserveSoc:25, targetH2Kg:3000, tokenPerMWh:1667000000};
  SCENARIOS.park.hint='24 h 生产任务与算力计量；按期限协调供电';
  SCENARIOS.park.note='生产任务、备用目标和算力折算均为演示假设';
  SCENARIOS.surplus.label='风光富余与补产';
  SCENARIOS.surplus.initialTasks=[{key:'zinc',mwh:200,ageHours:4,dueHours:4},{key:'factory',mwh:100,ageHours:4,dueHours:4}];
  SCENARIOS.lowwind.label='连续低风低光';SCENARIOS.lowwind.solarFactor=0.08;
  SCENARIOS.lowwind.hint='连续低风与低光轨迹，观察任务履约及购电压力';
  SCENARIOS.tankfull.label='储氢约束与氢氨协同';
  SCENARIOS.gasbackup.label='燃气备用支撑';
  SCENARIOS.deadline={...SCENARIOS.night,label:'生产任务临期',hint:'2 h 临期任务；检查购电保障和能力预警',soc:25,initialTasks:[{key:'zinc',mwh:300,ageHours:6,dueHours:2},{key:'factory',mwh:180,ageHours:6,dueHours:2}],seed:20261020};
  for(const sc of Object.values(SCENARIOS)){sc.durationHours=24;sc.importLimitMW=GRID.importLimitMW;sc.assumption='演示假设；工业任务以等效用电量计量';}
  const BRAND = {
    site: '多园区共享综合能源系统',
    subtitle: '源网荷储氢协同运行示意',
    org: '西比里 能源 xibili energy',
    productNodes: '耐电晕绕组 · 机舱干变（风电）｜耐腐蚀光伏支架（光伏）｜陶瓷钢芯铝绞线（架空线）｜弹性容量变压器（配电变）｜有载调压器（电能治理）｜高压直流电源（DC·超充·电解锌）'
  };

  return {
    version: '18.0.0',
    TIME, REGIONS, FACTOR_SOURCE, PLANT, MIX_KEYS, MIX_LABEL,
    GRID, POLICY, POWER_QUALITY, PALETTE, LIGHT_PRESETS, QUALITY, SCENARIOS, DISPATCH, BRAND
  };
});
