from pathlib import Path
import hashlib, json, html

root = Path(__file__).resolve().parents[1]
old = root.parent / 'NetZero-GridToChip-v5-Infrastructure'
manifest = json.loads((root / 'tests/v5-preservation-manifest.json').read_text(encoding='utf-8'))
changed = [name for name, digest in manifest.items() if hashlib.sha256((old/name).read_bytes()).hexdigest() != digest]
assert not changed, changed
before = json.loads((root/'tests/cable-audit-v5.json').read_text(encoding='utf-8'))
after = json.loads((root/'tests/cable-audit-v6.json').read_text(encoding='utf-8'))
assert all(after['checks'].values())
assert before['dataBuilding'] == after['dataBuilding']
assert before['smrBounds'] == after['smrBounds']
assert (root/'src/engine.js').read_bytes() == (old/'src/engine.js').read_bytes()
report = {'originalFilesChecked':len(manifest),'changedOriginalFiles':changed,
          'dataBuildingPreserved':True,'smrBoundsPreserved':True,'enginePreserved':True,
          'sceneChecks':len(after['checks']),'allSceneChecksPassed':True,
          'gasGeometry':{'v5':before['gasMetrics'],'v6':after['gasMetrics']}}
(root/'tests/preservation-v6.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')

(root/'README.md').write_text('''# Grid to Chip 园区 v6 · 线路整理与燃机精细化

本版独立保存在 `NetZero-GridToChip-v6-CableRefinement`，原版及 v2 / v3 / v4 / v5 保留。

- [打开交互园区](dist/Net-Zero-grid-premium.html)
- [同角度视觉对照](线路整理与燃机精细化视觉对照.html)
- [修改说明](线路整理与燃机精细化说明.md)
- [验证记录](VALIDATION.md)

可在上一级目录双击“打开园区线路与燃机深化v6.cmd”。主场景 HTML 内嵌全部脚本和资源，可离线打开。

进入“02 供配电”，点击“工业配电”观察新的主通道与支路。进入“08 数据楼备用电源”，点击“打开燃机罩壳”观察完整机组及辅助设施，点击“燃机与发电机近景”直接查看内部机组。右侧“供电关联”提供数据楼降压区、A/B 配电、母线与燃机的跳转；“查看供电关联全景”可以查看整段供电路径。

若需观察备用电源出力，选择“燃气备用投入”情景，再在“☰ → 运行参数”投入“备用燃气轮机”，运行仿真。额定容量沿用原模型 50 MW；默认仍为冷备用。

构建：`node build.cjs --verify`。内核验证：`node tests/engine.test.cjs`。场景审计与同角度页面生成：`node tests/cable-fixture.cjs`，打开 `tests/v6-cable-preview.html?view=cables`，隐藏 DOM `#layoutAudit` 包含审计记录。

主要修改位于 `src/campus-infrastructure.js`、`src/grid-to-chip.js` 与配套样式。目录内保留的 v4 / v5 对照、说明、测试与截图属于历史资料；本版验收以本 README、VALIDATION 和文件名含“线路整理与燃机精细化”的交付文件为准。
''',encoding='utf-8')

(root/'线路整理与燃机精细化说明.md').write_text('''# v6 修改说明

## 供配电区域

原来的工业与数据楼变压器进线从同一母线位置放射状斜拉，叠加三相导线后出现明显交叉。新版将它们组织为两条独立、带盖的直角电缆通道：一条沿工业变压器一侧布置，另一条进入数据楼降压区。六台变压器分别通过短支路、终端箱及三相引线接入套管。

变压器的中压出线布置在设备另一侧，接入开关柜或 A/B 配电房；SVG/APF 通过独立并联支路接入工业母线。橙色与青色单线用于显示路径和能流，通道内保留三相线路，设备端保留可见的短引线。数据楼常用进线与燃机备用进线在界面中分别显示，新增的 A/B 高压支路接入原有能流动画。

燃机发电机到配套变压器、开关设备，再到数据楼中压配电房的馈线采用沿站区边缘的折线路径。供电路径及可点击设备关系保留。

## 燃气轮机站

机组细化了压气机、燃烧与透平壳体、法兰与螺栓、支座、联轴器护罩、发电机壳体及接线端。新增润滑油箱、过滤器、泵组和相连管路，燃气调压设备、阀门及仪表，检修走道、平台、栏杆与梯子。

进气侧增加过滤器分格、支撑结构、百叶和风道法兰；排气侧增加转向风道、消声段、烟囱连接段、检修平台和梯子。罩壳增加接缝、门窗、通风口与机组标牌。开罩后保留框架，便于理解设备在建筑内部的位置；新增“燃机与发电机近景”按钮，自动开罩并定位到内部机组。

v5 / v6 的同角度图分别展示了罩壳打开后的全站与内部机组。燃机站模型三角面计数由 31,700 增加至 78,452（含隐藏罩壳及实例；用于记录几何细化，不代表性能提升）。仍使用原来的 46 × 26 展示占地。

设备组成参考了西门子能源官方产品介绍中的机组、进排气及辅助系统分类：[SGT-750](https://www.siemensenergy.com/global/en/home/products-services/product/sgt-750.html)、[SGT5-2000E](https://www.siemens-energy.com/global/en/home/products-services/product/sgt5-2000e.html)。本版是通用结构展示，容量和参数沿用园区原模型，不绑定具体厂家型号。

## 保留内容

独立 SMR 园区位置、尺度及建筑范围与 v5 相同；A1 数据楼的几何位置、尺度、范围及仿真内核保持原样。早前修正的室内电解锌设备、室内直流电源以及风光间距继续保留。线路与设备几何用于可视化展示，不用于电气施工设计。
''',encoding='utf-8')

(root/'VALIDATION.md').write_text('''# v6 验证记录 · 2026-10-03

- 离线构建：13 项自包含检查通过，149 个界面 id，无外部资源依赖。主 HTML 2,582,596 字节。
- 内核运行：`node tests/engine.test.cjs`，29 项通过，0 失败。
- 浏览器场景审计：30 项通过，包括通道直角布局、高压/中压主通道不交叉、六组共 18 个三相终端、A/B 新增进线路径与粒子一致、功率分配及设备终点相符、备用线接入配电房、A1 进线端点、燃机细节保持在原占地、核电独立分区及室内工艺设备保留。
- 交互验证：罩壳开关、机组近景自动开罩、配电房开关、切换设备自动关闭罩壳，5 项通过。
- 生产页面浏览器 error / warn 日志为空。
- 同角度截图：线路区、燃机开罩全站、内部机组各提供 v5 / v6 一组。生产页另存燃机、线路及全景截图。
- 原版保护：对创建 v6 时记录的 v5 40 个源码、构建产物和文档逐项校验，0 改动。v6 仿真内核与 v5 字节相同；A1 建筑参数及 SMR 外包围范围相同。

本次视觉核对使用 1280 × 720 浏览器画面。实际预览中画质自动降至兼容模式；本记录不作帧率承诺。燃机罩壳默认关闭，近景按钮可直接打开观察内部结构。

记录文件：`tests/cable-audit-v6.json`、`tests/cable-audit-v5.json`、`tests/browser-v6-validation.json`、`tests/preservation-v6.json`、`tests/v5-preservation-manifest.json`。历史 v4 / v5 验证记录不作为本次新增修改的验收证据。
''',encoding='utf-8')

panels=[('线路整理','消除变压器区的放射状交叉进线，改为分开的主通道、短支路和三相终端。','cables'),
        ('燃机与辅助系统','开罩观察完整机组、进排气、润滑、燃气与检修设施。','gas'),
        ('机组近景','同角度比较压气机、燃机、联轴器及发电机。新版增加直达近景按钮。','machine')]
sections=[]
for title,desc,key in panels:
    figures=[]
    for ver in ['v5','v6']:
        filename=f'{ver}-{key}-matched.jpg'
        assert (root/'screenshots'/filename).is_file(), filename
        figures.append(f'<figure><figcaption>{ver} · {"修改前" if ver=="v5" else "修改后"}</figcaption><a href="screenshots/{filename}" target="_blank"><img src="screenshots/{filename}" alt="{html.escape(title)} {ver} 同角度截图" loading="lazy"></a></figure>')
    sections.append(f'<section><h2>{title}</h2><p>{desc}</p><div class="pair">{"".join(figures)}</div></section>')
page='''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>园区 v6 · 线路整理与燃机精细化对照</title><style>
*{box-sizing:border-box}body{margin:0;background:#edf2f0;color:#203b3b;font:16px/1.8 "Microsoft YaHei",sans-serif}main{max-width:1560px;margin:auto;padding:36px 28px}header{padding:30px;background:white;border:1px solid #d6e2df;border-radius:12px}small{color:#688481}h1{font-size:32px;line-height:1.4;margin:12px 0}h2{font-size:24px;margin:0 0 6px}p{margin:8px 0 18px;color:#57736f}nav{display:flex;flex-wrap:wrap;gap:12px}nav a{padding:10px 18px;background:#117b75;color:white;border-radius:7px;text-decoration:none}nav a.secondary{background:#e3efec;color:#28665f}section{margin:32px 0}.pair{display:grid;grid-template-columns:1fr 1fr;gap:20px}figure{margin:0;background:white;border:1px solid #d6e2df;border-radius:9px;overflow:hidden}figcaption{padding:10px 16px;font-weight:bold}img{width:100%;height:auto;display:block}.note{padding:24px;background:white;border:1px solid #d6e2df;border-radius:9px}a{color:#087d73}@media(max-width:850px){main{padding:20px 14px}.pair{grid-template-columns:1fr}h1{font-size:25px}}
</style></head><body><main><header><small>GRID TO CHIP · v6</small><h1>园区线路整理与燃机精细化</h1><p>六台变压器分别通过主通道和短支路接线。燃机增加完整的机组与辅助设施细节，并保留接入数据楼的备用供电关联。v5 原文件保留。</p><nav><a href="dist/Net-Zero-grid-premium.html" target="_blank">打开 v6 交互园区</a><a class="secondary" href="../NetZero-GridToChip-v5-Infrastructure/dist/Net-Zero-grid-premium.html" target="_blank">打开 v5 原版</a></nav></header>'''+''.join(sections)+'''<div class="note"><h2>在交互园区中查看</h2><p>选择“02 供配电” → “工业配电”查看整理后的线路；选择“08 数据楼备用电源” → “打开燃机罩壳”查看站区内部，或点击“燃机与发电机近景”。“供电关联”可跳转 A/B 配电、数据楼降压区及燃机，并查看关联全景。</p><p>验证：30 项场景检查、29 项内核测试及 5 项交互检查通过。A1 建筑、独立 SMR 园区及仿真内核保持原样。通用机组模型沿用 50 MW 展示参数。</p><p><a href="线路整理与燃机精细化说明.md">修改说明</a> · <a href="VALIDATION.md">验证记录</a></p></div></main></body></html>'''
(root/'线路整理与燃机精细化视觉对照.html').write_text(page,encoding='utf-8')
launcher=root.parent/'打开园区线路与燃机深化v6.cmd'
if not launcher.exists():
    launcher.write_bytes(b'@echo off\r\nstart "" "%~dp0NetZero-GridToChip-v6-CableRefinement\\dist\\Net-Zero-grid-premium.html"\r\n')
print(json.dumps(report,ensure_ascii=False))
