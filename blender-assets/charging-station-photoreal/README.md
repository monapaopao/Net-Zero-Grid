# 充电站材质与光照样板 · 第二轮

在 `codex/charging-station-photoreal` 分支中独立维护，目录不覆盖 v20 或第一轮 Blender 样板。

## 查看成果

- `web/dist/多园区-v20-r187-充电站写实.html`：完整园区离线页面，Chrome/Edge 直接打开；通过原有园区入口进入充电站。
- `web/evidence/station-preview.mp4`：20 秒实时网页录屏，包含全景、入口、终端、夜景。
- `web/evidence/before-*.jpg` / `after-*.jpg`：同分辨率、同机位的日夜前后对比；画面来自网页。
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

`source/station-previous.blend` 固定第一轮输入，`source/layout.json` 固定业务场景的坐标和连接布局。`build.py` 生成源场景、材质、烘焙及三张日间图；`render-night.py` 仅读取源场景生成夜图。两个脚本都不会操作前台 Blender 的未保存场景。

常规网页重建使用已提交的加载器，无需安装依赖。重新生成加载器时传入 `--rebuild-loader`，需要 Three.js r187 源码与 esbuild，可通过 `THREE_PACKAGE`、`ESBUILD` 指定位置，默认读取仓库 `tmp/three-r187-tools/`。

## 验证与性能

```powershell
$env:PREVIEW_FILE=(Resolve-Path 'blender-assets/charging-station-photoreal/web/dist/多园区-v20-r187-充电站写实.html').Path
$env:EVIDENCE_DIR=Join-Path (Resolve-Path 'blender-assets/charging-station-photoreal/web').Path 'evidence'
node blender-assets/charging-station-realistic/web/check.cjs
node blender-assets/charging-station-realistic/web/check-labels.cjs
node blender-assets/charging-station-photoreal/web/check-photo.cjs
node blender-assets/charging-station-photoreal/web/check-vehicles.cjs
node blender-assets/charging-station-photoreal/web/preview.cjs
```

浏览器验证需要 Playwright，可设置 `PLAYWRIGHT_MODULE` 和 `CHROME_PATH`。录屏转码需要 ffmpeg，可设置 `FFMPEG`。

已通过离线加载与无外部请求检查、SST 拆解/恢复、24 个充电终端/21 个车位/9 条连接路径、能源情境、导览启动/停止、光流图层、模型回退、三个宽度下标签模式与按钮对齐，以及 19 辆替换车辆和独立 UV 贴图检查。

1440×810、Chrome、高画质、RTX 5070 Ti 本机测试记录如下；环境记录在 `web/evidence/environment.json`。全园区统计包含阴影等绘制通道，并非 GLB 单体面数。

| 指标 | 第一轮样板 | 本轮样板 |
| --- | ---: | ---: |
| 离线 HTML | 7,023,016 字节 | 27,691,250 字节 |
| 首次就绪 | 2,577 ms | 3,207 ms |
| 六个日夜机位 P95 帧间隔 | 约 16.8 ms | 约 16.8 ms |
| 入口日间绘制调用 | 1,621 | 1,869 |
| 入口日间绘制三角形 | 7,264,552 | 8,385,750 |

GLB 为 34,364,044 字节，111 个材质/挂点批次，369,828 个原型三角形。网页 gzip 内嵌 GLB 为 12,957,454 字节。详细数据见 `build-report.json`、`web/export-report.json`、`web/evidence/photo-checks.json`。帧间隔受垂直同步限制，不能据此推断所有设备都有 60 FPS；本次未做移动设备或低端集显基准。

## 当前效果边界

这是围绕充电站的第二轮可交互样板。车辆是程序生成的通用外形，近处植物也仍为简化叶片；园区远处建筑、地形和树冠沿用既有展示风格。相较第一轮，光照、表面区分和设备细节已经改善，但与参考视频的摄影级资产精度、植物密度及整体环境仍有差距。后续应依据这些固定机位继续改资产轮廓、叶片与环境，而不是仅增加曝光或反光强度。

素材来源与授权见 [ASSET-SOURCES.md](ASSET-SOURCES.md)。
