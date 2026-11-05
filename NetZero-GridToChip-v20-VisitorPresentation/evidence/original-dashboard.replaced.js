
"use strict";
/* ---------------- 仪表盘与曲线 ---------------- */
const hist = { gen: [], load: [], flex: [], st: [] };
function pushHist() {
  hist.gen.push(S.genMW); hist.load.push(S.loadMW);
  hist.flex.push(S.sc + S.metal + S.factory + S.h2P); hist.st.push(S.stP);
  if (hist.gen.length > 220) { hist.gen.shift(); hist.load.shift(); hist.flex.shift(); hist.st.shift(); }
}
function drawSpark() {
  const c = $('sparkCanvas'), g = c.getContext('2d');
  const cw = Math.max(60, Math.round(c.clientWidth || 372)), ch = Math.max(40, Math.round(c.clientHeight || 80));
  if (c.width !== cw) c.width = cw;               // v12：画布分辨率随 CSS 尺寸自适应
  if (c.height !== ch) c.height = ch;
  const W = c.width, H = c.height;
  g.clearRect(0, 0, W, H);
  const maxV = Math.max(50, ...hist.gen, ...hist.load, ...hist.flex, ...hist.st.map(Math.abs)) * 1.1;
  // v12：量程网格线 + 峰值刻度
  g.strokeStyle = 'rgba(141,149,160,.16)'; g.lineWidth = 1;
  for (const f of [0.25, 0.5, 0.75]) { g.beginPath(); g.moveTo(0, H * f); g.lineTo(W, H * f); g.stroke(); }
  g.fillStyle = 'rgba(141,149,160,.8)'; g.font = '9px "Microsoft YaHei",sans-serif';
  g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText(`${fmt(maxV)} MW`, 4, 3);
  const plot = (arr, color, center0 = false) => {
    if (arr.length < 2) return;
    g.beginPath();
    arr.forEach((v, i) => {
      const x = i / 219 * (W - 6) + 3;
      const y = center0 ? H * 0.78 - (v / maxV) * H * 0.5 : H - 5 - (v / maxV) * (H - 14);
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    });
    g.strokeStyle = color; g.lineWidth = 1.6; g.stroke();
  };
  g.strokeStyle = 'rgba(141,149,160,.3)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(0, H * 0.78); g.lineTo(W, H * 0.78); g.stroke();
  plot(hist.gen, '#84b07c'); plot(hist.load, '#dfa45c');
  plot(hist.flex, '#b8b36a'); plot(hist.st, '#7ba8a0', true);
}

function updateDash() {
  const t = S.simTime % 86400;
  const hh = String(Math.floor(t / 3600)).padStart(2, '0');
  const mm = String(Math.floor(t / 60) % 60).padStart(2, '0');
  const ss = String(Math.floor(t) % 60).padStart(2, '0');
  $('clockDay').textContent = `第 ${S.day} 天`;
  $('clockTime').textContent = `${hh}:${mm}:${ss}`;

  // 功率总览
  $('mWind').textContent = fmt(S.windMW);
  $('mSolar').textContent = fmt(S.solarMW);
  $('mSmr').textContent = fmt(S.smr);
  $('mGen').textContent = fmt(S.genMW);
  $('mLoad').textContent = fmt(S.loadMW);
  const flexAll = S.sc + S.metal + S.factory + S.h2P;
  const bal = S.genMW - S.loadMW - flexAll + S.stP;
  const bBox = $('mBalanceBox');
  bBox.className = 'metric ' + (S.gridBuy > 5 ? 'bad' : (S.curtail > 5 ? 'hot' : 'good'));
  $('mBalanceLb').textContent = S.gridBuy > 5 ? '电网购电' : (S.curtail > 5 ? '弃电' : '平衡差额');
  $('mBalance').textContent = (bal >= 0 ? '+' : '') + fmt(bal);

  // 储能
  $('mSoc').innerHTML = `${fmt(S.soc)}<small>%</small>`;
  $('mStLb').textContent = S.stP > 0.05 ? '放电功率' : (S.stP < -0.05 ? '充电功率' : '储能待机');
  $('mStP').innerHTML = `${fmt(Math.abs(S.stP))}<small>MW</small>`;
  const fill = $('socFill');
  fill.style.width = S.soc + '%';
  fill.className = 'barFill' + (S.soc < 15 ? ' low' : (S.soc > 90 ? ' high' : ''));

  // 氢-氨链
  $('mH2P').innerHTML = `${fmt(S.h2P)}<small>MW</small>`;
  $('mH2Rate').innerHTML = `${fmt(S.h2ProdKgH, 0)}<small>kg/h</small>`;
  $('mH2Day').innerHTML = `${fmt(S.dH2kg, 0)}<small>kg</small>`;
  $('mH2Tank').innerHTML = `${fmt(S.h2Kg, 0)}<small>kg</small>`;
  $('h2Fill').style.width = (S.h2Kg / K.H2_TANK * 100) + '%';
  $('mNh3Rate').innerHTML = `${fmt(S.nh3KgH, 0)}<small>kg/h</small>`;
  $('mNh3Day').innerHTML = `${fmt(S.dNh3t, 2)}<small>t</small>`;
  const temp = Math.round(300 + 110 * S.nh3Load), pres = fmt(8 + 8.5 * S.nh3Load, 1);
  $('mNh3Stat').textContent = S.nh3Load > 0.02
    ? `≈${temp}℃ · ${pres}MPa · 负荷率 ${fmt(S.nh3Load * 100, 0)}% · 厂用电 ${fmt(S.nh3Aux * 1000, 0)}kW`
    : '待机（无氢源）';

  // 电能质量
  $('mPf').innerHTML = `前 ${fmt(S.pfRaw, 2)}<br>后 ${fmt(S.pf, 3)}`;
  $('mThd').innerHTML = `前 ${fmt(S.thdRaw)}%<br>后 ${fmt(S.thd)}%`;
  $('mVd').innerHTML = `前 ${fmt(S.vdRaw)}%<br>后 ${fmt(S.vd)}%`;

  // 算电直连
  $('mGreen').innerHTML = `${fmt(S.greenRatio * 100, 0)}<small>%</small>`;
  $('mPue').textContent = fmt(S.pue, 2);
  $('mSelfUse').innerHTML = S.selfUse < 0 ? '–' : `${fmt(S.selfUse * 100, 0)}<small>%</small>`;
  $('mExport').innerHTML = `${fmt(S.exportRate * 100, 1)}<small>%</small>`;
  $('mIt').innerHTML = `${fmt(S.itMW)}<small>MW</small>`;
  $('mVolt').innerHTML = `${fmt(35 * (1 + S.vd / 100), 2)}<small>kV</small>`;
  $('mClean').innerHTML = `${fmt(S.cleanShare * 100, 0)}<small>%</small>`;
  $('mCarbInt').innerHTML = `${fmt(S.carbInt, 2)}<small>t/tce</small>`;
  $('mNh3Day2').innerHTML = `${fmt(S.dNh3t, 2)}<small>t</small>`;

  // 当日累计
  $('dGen').innerHTML = `${fmt(S.dGen)}<small>MWh</small>`;
  $('dLoad').innerHTML = `${fmt(S.dLoad)}<small>MWh</small>`;
  $('dBuy').innerHTML = `${fmt(S.dBuy)}<small>MWh</small>`;
  $('dCur').innerHTML = `${fmt(S.dCur)}<small>MWh</small>`;
  $('dGreen').innerHTML = `${fmt(S.dGreen)}<small>MWh</small>`;
  $('dCo2').innerHTML = `${fmt(S.dCo2)}<small>t</small>`;

  // 状态芯片
  const chip = $('statusChip');
  if (S.gridBuy > 5) { chip.textContent = `电网购电 ${fmt(S.gridBuy)} MW`; chip.className = 'warn'; }
  else if (S.curtail > 5) { chip.textContent = `弃电 ${fmt(S.curtail)} MW · 消纳已满`; chip.className = 'warn'; }
  else if (S.soc <= 12) { chip.textContent = '储能 SOC 过低'; chip.className = 'bad'; }
  else { chip.textContent = '源网荷储氢 · 自平衡 · 弃电≈0'; chip.className = ''; }

  // 控制区回显
  $('vWind').textContent = `${fmt(S.windSpeed, 1)} m/s`;
  $('vSun').textContent = S.dayNight ? (S.irradi > 0.02 ? `昼 · 光照 ${fmt(S.irradi * 100, 0)}%` : '夜间') : '固定正午';
  $('vSmr').textContent = ['停堆', '50%', '100%'][S.smrGear];
  $('vIt').textContent = `${fmt(S.itSlider, 1)} MW`;

  // v15.1：侧栏紧凑模式已改为 CSS 视口高度媒体查询（见样式表 @media max-height:960px），
  // 不再随数据节拍切换 class，彻底消除侧栏上下抖动。

  // 移动端抽屉摘要条
  $('drawerSummary').textContent =
    `发电 ${fmt(S.genMW)} / 负荷 ${fmt(S.loadMW + S.sc + S.metal + S.factory + S.h2P)} / 弃电 ${fmt(S.curRate)}%`;

  // v15：3D 悬浮标签与 HUD 实时值（同一 UI 节拍）
  if (typeof updateLabels3D === 'function') updateLabels3D();
}

/* ---------------- 告警滚动条 ---------------- */
let tickerX = 0;
function rebuildTicker() {
  const items = alertLog.slice(-10).map(a =>
    `<span class="a-${a.lv}">[${a.t}] ${a.msg}</span>`).join('　●　') || '系统就绪，等待运行事件…';
  $('ticker').innerHTML = items + '　●　' + items;
  tickerX = 0;
}
function tickTicker(dtR) {
  const el = $('ticker');
  tickerX -= dtR * 55;
  if (-tickerX >= el.offsetWidth / 2) tickerX = 0;
  el.style.transform = `translateX(${tickerX}px)`;
}

/* ---------------- 移动端抽屉 ---------------- */
$('drawerHandle').addEventListener('click', () => {
  const s = $('side');
  s.classList.toggle('open');
  $('drawerBtn').textContent = s.classList.contains('open') ? '收起 ▼' : '展开 ▲';
});

/* ---------------- 控件绑定 ---------------- */
$('btnRun').addEventListener('click', () => {
  S.running = !S.running;
  $('btnRun').textContent = S.running ? '⏸ 暂停' : '▶ 运行';
  $('btnRun').className = 'btn' + (S.running ? ' active' : '');
});
$('selSpeed').addEventListener('change', e => S.timeScale = +e.target.value);
const selRegion = $('selRegion');
for (const [k, r] of Object.entries(REGIONS)) {
  const op = document.createElement('option'); op.value = k; op.textContent = r.name;
  selRegion.appendChild(op);
}
function applyRegion(k) {
  S.region = k;
  selRegion.value = k;
  const r = REGIONS[k];
  $('regionDesc').textContent = r.desc;
  $('vRegion').textContent = `碳因子 ${r.co2} t/MWh`;
  pushAlert('info', `地区切换：${r.name}，风/光资源模型已更新`);
}
selRegion.addEventListener('change', e => applyRegion(e.target.value));
$('rgWind').addEventListener('input', e => {
  S.windSlider = +e.target.value;
  if (!S.windManual) { S.windManual = true; $('chkWind').classList.add('on'); }
});
$('chkWind').addEventListener('click', () => {
  S.windManual = !S.windManual;
  $('chkWind').classList.toggle('on', S.windManual);
});
$('chkDay').addEventListener('click', () => {
  S.dayNight = !S.dayNight;
  $('chkDay').classList.toggle('on', S.dayNight);
});
document.querySelectorAll('.segBtns .btn').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.segBtns .btn').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  S.smrGear = +b.dataset.gear;
  pushAlert('info', `SMR 档位切换：${['停堆', '50% 功率', '100% 功率'][S.smrGear]}（爬坡速率 1MW/min）`);
}));
$('rgIt').addEventListener('input', e => S.itSlider = +e.target.value);
$('selSt').addEventListener('change', e => {
  S.stMode = e.target.value;
  pushAlert('info', `储能模式切换：${{ auto: '自动', charge: '强制充电', discharge: '强制放电' }[S.stMode]}`);
});
$('swSvg').addEventListener('click', () => {
  S.svgOn = !S.svgOn; $('swSvg').classList.toggle('on', S.svgOn);
  pushAlert('info', S.svgOn ? 'SVG 投入，开始无功补偿' : 'SVG 退出，功率因数将随负载波动');
});
$('swApf').addEventListener('click', () => {
  S.apfOn = !S.apfOn; $('swApf').classList.toggle('on', S.apfOn);
  pushAlert('info', S.apfOn ? 'APF 投入，谐波治理中（目标 THD<4%）' : 'APF 退出，THD 将升高');
});
$('swGenset').addEventListener('click', () => {
  S.gensetOn = !S.gensetOn; $('swGenset').classList.toggle('on', S.gensetOn);
  pushAlert('info', S.gensetOn ? '燃气轮机启动：分钟级爬坡至 50MW（应急备用，不计绿电）' : '燃气轮机停机，转入冷备用');
});
$('swFc').addEventListener('click', () => {
  if (!S.fcOn && S.h2Kg <= 50) { pushAlert('warn', '储氢不足（≤50kg），氢燃料电池无法启动'); return; }
  S.fcOn = !S.fcOn; $('swFc').classList.toggle('on', S.fcOn);
  pushAlert('info', S.fcOn ? '氢燃料电池启动：秒级响应，耗氢≈60kg/MWh' : '氢燃料电池停机');
});

/* ---------------- 主循环 ---------------- */
let lastT = 0, uiAcc = 0;
function loop(t) {
  requestAnimationFrame(loop);
  if (!lastT) lastT = t;
  const dtR = Math.min(0.1, (t - lastT) / 1000);
  lastT = t;
  if (S.running) {
    let simDt = dtR * S.timeScale;
    while (simDt > 0) { const h = Math.min(4, simDt); simStep(h); simDt -= h; }
  }
  updateParticles(dtR);
  render(t / 1000, dtR);
  tickTicker(dtR);
  uiAcc += dtR;
  if (uiAcc >= 0.25) { uiAcc = 0; updateDash(); pushHist(); drawSpark(); }
}

/* ---------------- 启动 ---------------- */
resizeCanvas();
applyRegion('xinjiang');
pushAlert('info', '甘泉堡零碳园区 3D 仿真启动（1GW 算电直连）：Three.js 全向场景 + 源网荷储氢一体化 + 默认新疆场景');
pushAlert('info', '政策对标：自发自用≥60% · 余电不上网 · 接入≤220kV · 储能 15%·2h ｜ 零碳园区：清洁能源≥90% · 碳强度≤0.2 t/tce');
rebuildTicker(); updateDash();
requestAnimationFrame(loop);

/* ---------------- 冒烟测试接口（v15：3D 场景对象一并导出） ---------------- */
window.__test = { S, K, REGIONS, dispatchFlex, simStep, sunGeometry, moonGeometry, lightState, lampLevel,
  TURB_POS, bladeAng, fitView, resizeCanvas, REGION_SKIN, LAMPS2D, C9, INFO, DEVICES, EDGES, edgePoint,
  updateParticles, render, updateLabels3D, LABELS3D, scene, camera, renderer, controls, THREE };
