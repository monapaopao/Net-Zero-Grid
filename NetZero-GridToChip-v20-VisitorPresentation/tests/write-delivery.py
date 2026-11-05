from pathlib import Path
import hashlib, json

root = Path(__file__).resolve().parent.parent
v4 = root.parent / 'NetZero-GridToChip-v4-Scale'
manifest = json.loads((root / 'tests/v4-preservation-manifest.json').read_text(encoding='utf-8'))
preserved = {p: hashlib.sha256((v4 / p).read_bytes()).hexdigest() == h for p, h in manifest.items()}
assert all(preserved.values()), 'v4 preservation check failed'
engine_hash = hashlib.sha256((root / 'src/engine.js').read_bytes()).hexdigest()
assert engine_hash == manifest['src\\engine.js']
audit = json.loads((root / 'tests/infrastructure-audit-v5.json').read_text(encoding='utf-8'))
baseline = json.loads((root / 'tests/infrastructure-audit-v4.json').read_text(encoding='utf-8'))
assert all(audit['checks'].values()) and audit['dataBuilding'] == baseline['dataBuilding']
(root / 'tests/v5-preservation-check.json').write_text(json.dumps({'v4FilesUnchanged':preserved,'engineSHA256':engine_hash,'A1Unchanged':True},ensure_ascii=False,indent=2),encoding='utf-8')

(root / 'README.md').write_text('''# Grid to Chip 园区 v5 · 独立核电与备用供电

本版独立保存在 `NetZero-GridToChip-v5-Infrastructure`，原版与 v2 / v3 / v4 保留。

- [打开交互园区](dist/Net-Zero-grid-premium.html)
- [查看新旧视觉对照与供电拓扑](独立核电与供电关联视觉对照.html)
- [设施与供电关联说明](设施与供电关联说明.md)
- [本版验证](VALIDATION.md)

也可在上一级目录双击“打开园区供电深化v5.cmd”。交互 HTML 内嵌全部脚本与资源，可离线打开。

左侧“独立核电园区”进入数据楼后方的 SMR 独立站区；“数据楼备用电源”进入燃机站区。右侧“供电关联”可跳转母线、降压变、A/B 配电房及工业配电，并查看关联全景。燃机罩壳、配电房均可打开观察内部，切换设施后自动关闭。A1 仍可进入原有数据中心内部场景。

若希望查看备用供电的动态出力：先选择“燃气备用投入”情景，再在“☰ → 运行参数”投入“备用燃气轮机”，并运行仿真。情景选择沿用原逻辑，不会自动投入燃机开关。默认状态仍是冷备用。

构建：`node build.cjs --verify`。内核测试：`node tests/engine.test.cjs`。场景审计页面生成：`node tests/infrastructure-fixture.cjs`；在浏览器中打开 `tests/v5-infrastructure-preview.html`，其隐藏 DOM 输出场景审计数据。

本次修改主要位于 `src/campus-infrastructure.js`，接入 `campus-layout.js`、`grid-to-chip.js` 与配套样式。目录中继承的 v4 说明和历史性能记录仅用于追溯，不属于 v5 验收结果。
''', encoding='utf-8')

(root / '设施与供电关联说明.md').write_text('''# v5 设施与供电关联说明

以 A1 数据楼作为体量基准：主楼 30 × 20 × 14 场景单位，本次不改变其尺寸、位置或楼内 Grid to Chip 场景。精细模型外包络与 v4 相同，为 31.0725 × 24 × 15.92（宽 × 深 × 高，含附属细节）。

## 独立 SMR 园区

从原风光区域迁至数据楼后方，中心坐标为 `(160, -100)`，站区 106 × 74。核岛主体 24 × 22 × 9.6，连同安全壳外观最高约 20.3；汽轮发电厂房 25 × 18 × 7.2。另设控制楼、水处理辅助楼、电气维护楼、6 组冷却设备、升压变压器、两组三相开关设备及独立围栏、出入口、道路和照明。

建筑补充屋面分缝、墙面柱线、窗带、通风、门、雨棚、爬梯；冷却管路接到汽轮机厂房及辅助建筑。汽轮发电厂房经站内电缆连接升压区，出线沿独立架空走廊接到园区高压母线。旧的小体量 SMR 及旧馈线支撑被移除。

## 设备之间的关系

| 支路 | 图面连接 |
| --- | --- |
| 风光 | 风光汇集 → AIS 主变及开关间隔 → 架空线 → 高压母线 |
| SMR | 汽轮发电厂房 → 站内升压与开关 → 独立出线 → 高压母线 |
| 数据楼常用电源 | 高压母线 → 3 台代表性降压设备 → A/B 中压配电房 → A1 受电入口 |
| 数据楼备用电源 | 燃机发电机 → 配套变压器及开关 → 专用电缆通道 → A/B 配电房 → A1 |
| 工业配电 | 高压母线 → 3 台配电变压器 → 8 面中压柜 → 原 35 kV 柔性消纳母线 |
| 电能质量治理 | 工业中压母线 → 独立并联支路 → SVG/APF；负荷不串联经过补偿设备 |

高压侧导线接到变压器套管，低压侧接到配电柜或房屋入口。固定三相导线保留在近景中，即使当前无功率流，设备关联仍可识别。运行粒子与其对应的展示路线一致。SVG/APF 支路仅表达并联拓扑，没有添加虚构的有功功率粒子。

## 备用燃机

燃机站区位于 A1 东侧，中心 `(184, -8)`，占地 46 × 26；隔声罩体量 22 × 11 × 5.7，最高排气筒约 15。包括进气过滤器、进气风道、燃机机组、发电机、排气风道与消声设施、控制建筑、燃气调压供气、辅助冷却、配套变压器、三相开关和电缆端接。打开罩壳可查看机组和发电机。

专用电缆绕 A1 南侧连接中压配电房；原数据运营附属建筑移至南侧，避免与扩大后的燃机站区重叠。配电房设两组、共 12 面代表性柜体及母排，默认封闭，可打开查看。原楼外直流电源继续移除；楼内直流系统和电解锌室内槽区与整流系统保留。

## 展示与参数边界

尺寸单位用于展台比例，不作为实测米制尺寸；独立围栏与站间距离为视觉布局，不推导核电选址或安全距离。SMR 为通用站区外观，不复刻某一型号，默认关闭；额定 30 MWe 的原研究参数沿用。燃机保留 50 MW 配置，展示其承担部分数据楼负荷的关系。

能量内核和统一能量账本不变。界面供电分流按“备用 = min(燃机出力，数据楼负荷)，常用 = 数据楼负荷 − 备用”显示，A/B 各分半；该分流属于拓扑展示，未新增实际电气潮流、孤岛切换、联锁或保护整定。三台数据楼变压器为 2 用 1 备代表布局，容量仍沿用原模型，而非三台同时累加容量。

通用设施组成参考：[IAEA SMR 技术目录（2024）](https://conferences.iaea.org/event/414/attachments/18654/34778/SMR_catalogue_2024.pdf)、[Siemens Energy SGT-750](https://www.siemens-energy.com/global/en/home/products-services/product/sgt-750.html)。这些资料用于设施组成参考，不用于给本场景指定机型、比例尺或核定容量。
''', encoding='utf-8')

(root / 'VALIDATION.md').write_text(f'''# v5 验证

2026-10-03。以下为本次实际执行的验证。

- 自包含构建检查：13 项全部通过，148 个界面 ID，无外部脚本或资源依赖；交付 HTML 约 2.45 MB。
- 原能量内核：29 项用例通过，0 失败，结果见 `tests/results.json`。
- 场景审计：22 项通过，见 `tests/infrastructure-audit-v5.json`。涵盖 A1 不变、SMR 独立位置与站区容纳、核岛体量、燃机站区不重叠、馈线端点、三相线路、SVG/APF 并联、6 组供电分流、线路与粒子一致、默认关闭的罩壳及配电房，以及电解锌室内设备与风机间距的保留。
- 同机位 v4 / v5 对比：A1 精细模型位置、缩放和外包络一致；核对记录见 `tests/infrastructure-audit-v4.json`。
- v4 文件保护：原先记录的 {len(preserved)} 个源文件和交付文件 SHA256 全部一致，见 `tests/v5-preservation-check.json`。
- v5 的 `src/engine.js` 与 v4 一致，SHA256：`{engine_hash.upper()}`。
- 浏览器检查：总览、SMR 独立站区、燃机闭合及打开、配电房闭合及打开、供电全景、工业配电和 SVG/APF、A1 外观与楼内供电入口。交互记录见 `tests/browser-v5-validation.json`。

本次未以新增设备数量推导工程容量。兼容/标准画质与原自动降级机制保留；增加细节后的画质仍受运行设备性能影响。原求解器诊断保留，不以场景几何检查代替电气设计校核。目录中继承的旧版性能报告不属于本版验收。
''', encoding='utf-8')

overview='''<section id="overview"><h2>01 / 布局与尺寸对照</h2><p>A1 尺寸保持一致。SMR 从风光区域迁至数据楼后方，成为独立的完整站区。</p><div class="pair"><figure><img src="screenshots/v4-overview-matched.jpg" alt="v4 同机位园区总览"><figcaption>v4 · 原来的 SMR 为西侧小体量设备，备用燃机为小型箱体。</figcaption></figure><figure><img src="screenshots/v5-overview-matched.jpg" alt="v5 同机位园区总览"><figcaption>v5 · 后方独立 SMR 园区；A1 东侧为燃机备用电站。</figcaption></figure></div></section>'''
panels=[('独立核电园区','v5-smr-campus.jpg','核岛、汽轮发电厂房、冷却、水处理、控制与升压设施组成独立站区。'),('供电关联全景','v5-power-links.jpg','高压母线分别连接数据楼与工业配电；SMR 独立出线与燃机专用馈线可追踪。'),('燃机站区','v5-gas-closed.jpg','独立站区展示进气、机组罩壳、排气、冷却、配套开关与电缆通道。'),('燃机罩壳打开','v5-gas-open.jpg','机组与发电机位于罩壳内；可打开查看连接和支撑细节。'),('A/B 中压配电房','v5-mv-closed.jpg','常用降压变与备用电源分别接入，再通过 A/B 馈线进入数据楼。'),('配电房打开','v5-mv-open.jpg','两组开关柜与母排在房内；可切换开合观察。'),('工业配电与 SVG/APF','v5-industrial-links.jpg','三台变压器连接中压柜与柔性消纳母线；SVG/APF 通过独立支路并联。')]
cards=''.join(f'<article><h3>{title}</h3><img src="screenshots/{img}" alt="{title}" loading="lazy"><p>{desc}</p></article>' for title,img,desc in panels)
svg='''<svg viewBox="0 0 1100 355" role="img" aria-label="风光与 SMR 接高压母线，常用降压变和燃机备用接 A/B 配电，工业母线并联 SVG/APF"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="#8b9f9b"/></marker></defs><g fill="none" stroke="#8b9f9b" stroke-width="2" marker-end="url(#arrow)"><path d="M200 60 H245 V126 H285"/><path d="M200 170 H245 V126 H285"/><path d="M460 126 H520 V60 H560"/><path d="M460 126 H520 V240 H560"/><path d="M720 60 H765"/><path d="M720 159 H747 V60 H765"/><path d="M945 60 H990"/><path d="M730 240 H765"/><path d="M850 263 V310 H730"/></g><g fill="#f0f7f4" stroke="#bdd5cd" rx="8"><rect x="20" y="32" width="180" height="56" rx="8"/><rect x="20" y="142" width="180" height="56" rx="8"/><rect x="285" y="98" width="175" height="56" rx="8"/><rect x="560" y="32" width="160" height="56" rx="8"/><rect x="560" y="131" width="160" height="56" rx="8"/><rect x="765" y="32" width="180" height="56" rx="8"/><rect x="990" y="32" width="100" height="56" rx="8"/><rect x="560" y="212" width="170" height="56" rx="8"/><rect x="765" y="212" width="180" height="56" rx="8"/><rect x="560" y="284" width="170" height="56" rx="8"/></g><g fill="#28534b" text-anchor="middle" font-size="15" font-family="Microsoft YaHei, sans-serif"><text x="110" y="66">风光 · AIS 汇集</text><text x="110" y="176">独立 SMR 升压出线</text><text x="372" y="132">220 kV 高压母线</text><text x="640" y="66">数据楼降压区</text><text x="640" y="165">备用燃气轮机</text><text x="855" y="66">A/B 中压配电房</text><text x="1040" y="66">A1 数据楼</text><text x="645" y="246">工业配电变压器</text><text x="855" y="246">中压柜 · 柔性母线</text><text x="645" y="318">SVG/APF 并联支路</text></g></svg>'''
html='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>园区 v5 · 独立核电与供电关联视觉对照</title><style>
*{box-sizing:border-box}body{margin:0;background:#f3f7f5;color:#2b4440;font:15px/1.8 "Segoe UI","Microsoft YaHei",sans-serif}header,main{max-width:1360px;margin:auto;padding:32px}header{padding-bottom:20px}.eyebrow{font-size:11px;letter-spacing:2px;color:#087d73}h1{font-size:32px;font-weight:500;line-height:1.5;margin:10px 0}h2{font-size:23px;font-weight:500;margin:0 0 8px}h3{font-size:17px;font-weight:500;margin:0 0 12px}p{color:#637b74;margin:8px 0 20px}a{color:#087d73}.links{display:flex;gap:12px;flex-wrap:wrap}.links a,nav a{padding:8px 16px;border:1px solid #bdd5cd;border-radius:6px;text-decoration:none;background:white}.links a:first-child{background:#087d73;color:white}nav{display:flex;gap:8px;margin:22px 0;flex-wrap:wrap}section{margin-bottom:28px;padding:24px;background:white;border:1px solid #dde7e0;border-radius:12px}.pair,.cards{display:grid;grid-template-columns:1fr 1fr;gap:22px}figure{margin:0}img{display:block;width:100%;border:1px solid #e0e8e3;border-radius:7px}figcaption{font-size:12px;padding:10px 4px;color:#61796f}.cards article{padding:18px;border:1px solid #dee8e2;border-radius:10px}.cards p{font-size:13px;margin:12px 0 0}svg{width:100%;height:auto}.note{font-size:12px;color:#74867e}footer{padding:20px 0;font-size:12px;color:#718a7f}button{font:inherit;border:1px solid #bdd5cd;padding:10px 18px;background:#087d73;color:white;border-radius:6px;cursor:pointer}iframe{width:100%;height:780px;border:1px solid #d9e5df;border-radius:8px;margin-top:16px}iframe[hidden]{display:none}@media(max-width:850px){header,main{padding:18px}.pair,.cards{grid-template-columns:1fr}h1{font-size:24px}section{padding:16px}iframe{height:680px}}
</style><header><div class="eyebrow">NET ZERO / GRID TO CHIP / V5</div><h1>独立核电园区与完整供电关联</h1><p>以数据楼为尺寸基准，重建 SMR 独立站区；把变电、配电与备用燃机连接成可追踪的供电系统。原版及 v2 / v3 / v4 均保留。</p><div class="links"><a href="dist/Net-Zero-grid-premium.html" target="_blank">打开 v5 交互园区 ↗</a><a href="../NetZero-GridToChip-v4-Scale/dist/Net-Zero-grid-premium.html" target="_blank">打开 v4 原版 ↗</a><a href="设施与供电关联说明.md">设施与连接说明</a></div><nav><a href="#overview">新旧布局</a><a href="#topology">供电关系</a><a href="#details">设施近景</a><a href="#interactive">交互观察</a></nav></header><main>'''+overview+'''<section id="topology"><h2>02 / 供电关系</h2><p>常用电源与备用电源各有清楚的接入点；SVG/APF 为并联治理支路。</p>'''+svg+'''<p class="note">图中为场景连接拓扑。各电压与容量沿用原模型；展示分流不代替实际潮流和切换控制。</p></section><section id="details"><h2>03 / 设施与近景</h2><p>在交互园区中可打开罩壳和配电房，也可在不同设施之间跳转观察供电关联。</p><div class="cards">'''+cards+'''</div></section><section id="interactive"><h2>04 / 交互观察</h2><p>点击加载交互园区。左侧可单独进入核电与燃机站区，右侧提供开合和关联跳转。</p><button id="load">加载交互园区</button><iframe id="live" hidden title="v5 交互园区"></iframe></section><footer>场景检查 22 项、内核测试 29 项通过。A1 精细模型尺寸与 v4 相同，v4 的 30 个源文件及交付文件哈希核对一致。SMR 保留默认关闭的研究情景；建筑与设备为通用展示模型。</footer></main><script>document.getElementById('load').onclick=function(){const frame=document.getElementById('live');frame.src='dist/Net-Zero-grid-premium.html';frame.hidden=false;this.hidden=true;};</script></html>'''
(root/'独立核电与供电关联视觉对照.html').write_text(html,encoding='utf-8')
launcher=root.parent/'打开园区供电深化v5.cmd'
assert not launcher.exists(), 'Do not overwrite existing launcher'
launcher.write_text('@echo off\nstart "" "%~dp0NetZero-GridToChip-v5-Infrastructure\\dist\\Net-Zero-grid-premium.html"\n',encoding='utf-8')
print('v5 documentation, comparison page and launcher saved. v4 files unchanged:',len(preserved))
