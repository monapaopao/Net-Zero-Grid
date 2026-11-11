# Three.js r187 / WebGPU · 原生模型版

<!-- project-release:start -->
当前项目版本：**v21.1.0 · 参观与仿真双模式版**。版本规则见 [VERSIONING.md](../../VERSIONING.md)。
<!-- project-release:end -->

基准回退标签为 `v21.0.0`。参观扩大画面并显示三项摘要；仿真展开参数、趋势及结果分析。模式切换保持业务状态与相机连续。布局说明见 [UI-MODES.md](../../docs/UI-MODES.md)。

当前展示入口以 `d04ac10` 的原生 Three.js 视觉为基线，恢复接入 Blender 之前的园区、充电站、车辆、树木、材质与光照，保留最新方向光带和标签控制区。数据楼内部仍为独立的 r180 WebGL 应用。分支与恢复范围见 [RESTORE.md](RESTORE.md)。

## 打开

使用支持 WebGPU 的 Chrome 或 Edge 打开 [原生模型页面](dist/多园区-v20-r187-WebGPU.html)，或使用仓库根入口及 Windows 启动器。浏览器标题显示实际渲染后端。

- 默认使用实际 WebGPU，保持基线的 GTAO 与 TSL 泛光。
- WebGPU 无法启用时明确提示，不静默启动 WebGL 展示。
- 数据楼内部保留原有独立 WebGL 应用，本版本不宣称全站 WebGPU。
- 页面资源全部内嵌，无 CDN 或 Blender 资产依赖。本机已验证直接打开文件；部署时需 HTTPS 或 localhost，浏览器应开启硬件加速。
- `?ssgi` 是原基线保留的显式 SSGI 试验项，不默认开启。
- `?forceWebGL` 仅供显式后端对照诊断，标题会标明 WebGL 2；正常入口不使用它。

## 保留内容

- 光流使用 `halo.mjs` 中的 TSL 节点材质，保留亮芯、柔边、暗轮廓、方向头部、正反方向、零流停止、每路最多两段高亮，以及图层/范围筛选和减少动态。旧流动点绘制范围归零；星空等其他点图元仍使用实例精灵。
- 右上角依次为“北向俯视、开关标签、详细标签、主页”，下方是流动图层窗口。标签隐藏/简易/详细模式与侧栏复选框联动。
- v20 能源仿真、车辆查询与充电连接、SST、工厂、园区导览和三分钟接待路线保持原有功能。
- 光流及界面共用代码已提取至 `visual-upgrade/shared`，当前构建不导入 `blender-assets`。

## 构建与验证

从仓库根目录执行，常规构建只需要 Node.js 和仓库中已提交的引擎包：

```powershell
node visual-upgrade/build.cjs
node visual-upgrade/webgpu/build.cjs
node visual-upgrade/webgpu/check.cjs
node visual-upgrade/shared/check-labels.cjs
node visual-upgrade/webgpu/check-unavailable.cjs
node visual-upgrade/webgpu/check-tour.cjs
node visual-upgrade/webgpu/check-modes.cjs
node scripts/project-version.cjs check
```

根目录也提供 `npm run build:webgpu`、`npm run check:webgpu`。最后一项完整接待检查约需三分钟，单独运行。

修改 `engine.mjs` 或 `halo.mjs` 后，需要重新打包引擎：将官方 `three@0.187.0` 放到 `tmp/three-r187-tools/r187/package`，准备 esbuild（可通过 `ESBUILD` 指定），然后执行：

```powershell
node visual-upgrade/webgpu/build.cjs --rebuild-engine
```

浏览器测试需要 Playwright 和 Chrome，可设置 `PLAYWRIGHT_MODULE` 与 `CHROME_PATH`。默认检查当前 WebGPU 页面；`check.cjs --compare` 才运行原 WebGL、WebGPU、显式回退、SSGI 四种对照。

## 当前验证记录

- `evidence/checks.json`：实际后端为 WebGPU、NVIDIA Blackwell GPU；原生站体和车辆、130 个 TSL 光流材质、车辆查询与 9 条连接、SST、工厂屋顶、接待启动/退出、数据楼进入/退出、夜景泛光和光流行为。无页面错误或外部请求。
- `evidence/label-controls-checks.json`：标签联动与 1440、1024、390 三种宽度下的按钮顺序、尺寸和对齐。
- `evidence/unavailable-check.json`：禁用 WebGPU 后明确报错，未启动回退展示。
- `evidence/tour-check.json`：精致档、实际 WebGPU、完整 180 秒接待路线，包含数据楼进入/退出和园区恢复。1440×810 / DPR 1 本机记录的整体 P95 为约 33.3 ms。
- `evidence/rollback-before-charge.jpg`、`rollback-after-charge.jpg`：相同入口机位、1440×810 分辨率的恢复前后截图。
- `evidence/retained-controls.png`：保留的控制区截图。
- `evidence/modes-check.json`：双模式业务状态/相机一致性、真实参数输入、导览恢复、导出项目/模型版本以及 1024、390 宽度布局。
- `evidence/v21-visit-desktop.jpg` / `v21-simulation-desktop.jpg`：同机位、同窗口尺寸的两种模式；另有窄屏截图。

帧时间包括 CPU、GPU 和浏览器调度，并受垂直同步影响；该记录不是不同 API 的等算法基准，也不能证明所有设备或高 DPI 下均有 60 FPS。当前阶段以恢复确认的视觉基线和保留指定交互为目标。

引擎采用 Three.js r187，许可见 [Three.js MIT 许可](../vendor/THREE-LICENSE.txt)。
