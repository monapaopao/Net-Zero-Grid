# 充电站材质与光照样板 · 第二轮

当前性能优化在 `codex/charging-station-performance` 分支中维护，沿用独立样板目录。初始写实版本见 `codex/charging-station-photoreal`，优化前提交为 `4e6d8af`。

本轮已落实 [1–5 步性能调整](PERFORMANCE-PLAN.md#已实施的性能优化)：精致档控制内部像素量，半尺寸 AO、四分之一尺寸泛光，车辆实例化与三档 LOD，局部阴影缓存，园区细节按距离启用，以及保留手动画质选择的自适应预算。使用新版时请刷新原有页面，再选择“精致”。

## 查看成果

- `web/dist/多园区-v20-r187-充电站写实.html`：完整园区离线页面，Chrome/Edge 直接打开；通过原有园区入口进入充电站。
- `web/evidence/station-preview.mp4`：20 秒实时网页录屏，包含全景、入口、终端、夜景。
- `web/evidence/before-*.jpg` / `after-*.jpg`：同分辨率、同机位的日夜前后对比；画面来自网页。
- `web/evidence/performance-*.jpg`、`performance-checks.json`：1080p 高 DPI 和 4K 窗口下的五组连续运镜检查。
- `web/evidence/tour-performance.json`：完整三分钟接待路线的逐镜头帧时间记录，包含数据中心嵌入视图。
- `renders/`：Blender Cycles 静帧，文件名明确区分日夜；不能用这些离线图代表网页实时效果。
- `charging-station-photoreal.blend`：已打包贴图的可编辑场景。
- `web/charging-station.glb`：带 PBR 材质的分组资产，包含五类车辆原型、站体、植物和可拆解 SST。

## 四步落实内容

1. **光照与机位**：采用 CC0 室外 HDR、PMREM 环境反射、与 HDR 太阳方向一致的平行光；全景、入口、终端三个固定机位。网页保留日夜预设，并增加棚下夜间点光源和屏幕自发光。
2. **建模**：增加设备门缝、密封件、紧急按钮、螺丝、显示屏遮光罩；重建车身曲面、轮拱、轮胎、轮毂、灯组、车门线和玻璃。五类通用原型替换站区及附近停车区 19 辆车；保留车辆身份、位置、牌照、点击查询和充电接口。四株近处树木改为枝干和独立叶片。
3. **PBR 表面**：程序生成 2048 像素站区颜色图，1024 像素地面法线与粗糙度图，以及设备涂层微法线。混凝土拼缝、车道和停车地坪具有不同表面；轮迹沿停车方向排列。车漆、玻璃、橡胶、金属分别处理。
4. **烘焙与接入**：Blender 对静态地坪烘焙间接漫反射和 AO，使用独立 UV 通道；车辆不进入静态烘焙，避免车辆移动后的固定阴影。日间启用归一化后恢复尺度的间接光，夜间关闭日间间接光，保留接触 AO。现有 Three.js r187 / WebGL 页面离线加载全部资源。

glTF 标准没有通用 lightMap 字段，因此 GLB 内携带几何和 PBR 贴图，地坪间接光/AO 由 `textures/` 中的贴图与 `web/photo-render.js` 配套接入；完整离线 HTML 已将这些资源全部内嵌。仅将 GLB 导入第三方查看器时，不会自动得到网页的 HDR、夜间灯光和间接光配置。

## 复现

从仓库根目录执行（Blender 5.2.3、Node.js；路径按本机调整）：

```powershell
& 'D:/Blender/blender.exe' --background --python-exit-code 1 --python blender-assets/charging-station-photoreal/build.py
& 'D:/Blender/blender.exe' --background --python-exit-code 1 --python blender-assets/charging-station-photoreal/export.py
node blender-assets/charging-station-photoreal/web/build.cjs
& 'D:/Blender/blender.exe' --background --python-exit-code 1 --python blender-assets/charging-station-photoreal/render-night.py
```

`source/station-previous.blend` 固定第一轮输入，`source/layout.json` 固定业务场景的坐标和连接布局。`build.py` 生成源场景、材质、烘焙及三张日间图；`render-night.py` 仅读取源场景生成夜图。两个脚本都不会操作前台 Blender 的未保存场景。`export.py` 从近景源模型派生中距离简化网格与远景轮廓，并强制应用修改器后导出。源 `.blend` 保留高精度编辑资产。

常规网页重建使用已提交的加载器，无需安装依赖。重新生成加载器时传入 `--rebuild-loader`，需要 Three.js r187 源码与 esbuild，可通过 `THREE_PACKAGE`、`ESBUILD` 指定位置，默认读取仓库 `tmp/three-r187-tools/`。

## 验证与性能

```powershell
$env:PREVIEW_FILE=(Resolve-Path 'blender-assets/charging-station-photoreal/web/dist/多园区-v20-r187-充电站写实.html').Path
$env:EVIDENCE_DIR=Join-Path (Resolve-Path 'blender-assets/charging-station-photoreal/web').Path 'evidence'
node blender-assets/charging-station-realistic/web/check.cjs
node blender-assets/charging-station-realistic/web/check-labels.cjs
node blender-assets/charging-station-photoreal/web/check-photo.cjs
node blender-assets/charging-station-photoreal/web/check-vehicles.cjs
node blender-assets/charging-station-photoreal/web/check-performance.cjs
node blender-assets/charging-station-photoreal/web/check-tour-performance.cjs
node blender-assets/charging-station-photoreal/web/preview.cjs
```

浏览器验证需要 Playwright，可设置 `PLAYWRIGHT_MODULE` 和 `CHROME_PATH`。录屏转码需要 ffmpeg，可设置 `FFMPEG`。

已通过离线加载与无外部请求检查、SST 拆解/恢复、24 个充电终端/21 个车位/9 条连接路径、能源情境、导览启动/停止、光流图层、模型回退、三个宽度下标签模式与按钮对齐，以及 19 辆替换车辆和独立 UV 贴图检查。

下表是第二轮初始版本、性能优化之前的历史记录（1440×810、DPR 1、静止机位）。它不能证明高 DPI 下动态演示流畅。环境记录在 `web/evidence/environment.json`。

| 指标 | 第一轮样板 | 本轮样板 |
| --- | ---: | ---: |
| 离线 HTML | 7,023,016 字节 | 27,691,250 字节 |
| 首次就绪 | 2,577 ms | 3,207 ms |
| 六个日夜机位 P95 帧间隔 | 约 16.8 ms | 约 16.8 ms |
| 入口日间绘制调用 | 1,621 | 1,869 |
| 入口日间绘制三角形 | 7,264,552 | 8,385,750 |

当前 GLB 为 36,653,280 字节，179 个材质/挂点批次、401,197 个原型三角形，包含可切换的三档车辆网格；运行时只绘制其中适合当前距离的一档。五类车辆原型合计：近景 159,038 三角形、中景 28,609、远景 2,760。网页 gzip 内嵌 GLB 为 13,689,930 字节。

性能优化后，在本机 RTX 5070 Ti 上，1080p / DPR 2 及 4K / DPR 1 的五组精致档连续运镜 P95 帧时间均约 16.8 ms；1080p 充电站全景的中位绘制调用为 713 次、三角形约 304 万（包含实际发生的阴影通道）。完整接待导览和人工主线程压力下的预算收缩/恢复另有独立记录。低分辨率渲染会在大屏上缩放输出，CSS 文字保持原有分辨率。

帧时间受垂直同步影响，绘制统计也随视角和阴影更新改变；本次结果不能证明普通集显或移动设备也能达到 60 FPS。主线程压力测试仅验证自适应机制，不等价于低端 GPU 实机。完整结果和首次进入的长帧见 [性能记录](PERFORMANCE-PLAN.md)。

## 当前效果边界

这是围绕充电站的第二轮可交互样板。车辆是程序生成的通用外形，近处植物也仍为简化叶片；园区远处建筑、地形和树冠沿用既有展示风格。相较第一轮，光照、表面区分和设备细节已经改善，但与参考视频的摄影级资产精度、植物密度及整体环境仍有差距。后续应依据这些固定机位继续改资产轮廓、叶片与环境，而不是仅增加曝光或反光强度。

素材来源与授权见 [ASSET-SOURCES.md](ASSET-SOURCES.md)。
