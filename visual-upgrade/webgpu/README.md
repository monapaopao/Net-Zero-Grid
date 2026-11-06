# Three.js r187 WebGPU 对照试验

独立迁移 v20 园区外景的渲染管线，保留园区模型、能源仿真与接待交互。数据楼内部沿用独立的 r180 WebGL 应用。

## 打开

用 Chrome 或 Edge 打开 [WebGPU 试验页](dist/多园区-v20-r187-WebGPU.html)，选择界面中的高画质。浏览器标签标题显示实际后端与效果名称。

- 默认：优先 WebGPU，使用 GTAO 接触遮蔽和 TSL 泛光。
- 地址末尾加 `?ssgi`：启用 SSGI 间接光照与空间降噪。
- 地址末尾加 `?forceWebGL`：强制使用新渲染器的 WebGL 2 回退。
- [原 WebGL 对照页](../dist/多园区-v20-r187-视觉升级.html)。

页面内嵌资源，无需 CDN。本机 Chrome 已验证直接打开文件；其他部署环境需 HTTPS 或 localhost，并允许浏览器使用硬件加速。若 WebGPU 不可用，新渲染器自动选择 WebGL 2；初始化错误会显示在页面上。

## 迁移内容

- 异步初始化 `WebGPURenderer`，初始化结束后启动原业务循环。
- 将 GLSL 后处理迁移到 `RenderPipeline`、TSL GTAO 与 Bloom。
- 光伏面板远距离纹理淡出迁移到节点材质，保留工厂屋顶独立材质。
- 保留车漆清漆层、玻璃、粗糙漫反射地面和程序生成的环境反射。
- 能源流动粒子改用实例化精灵。WebGPU 原生点图元只有 1 像素，精灵保留原有尺寸、纹理、位置更新和粒子数量控制。
- 可选 SSGI 使用全分辨率、3 个方向切片、8 步采样及空间降噪，没有时域历史累积。
- GPU 设备丢失时停止提交绘制并显示现有异常提示；本试验需重新加载恢复，尚未做设备丢失后的完整资源重建。

## 复现

从仓库根目录执行：

```powershell
node visual-upgrade/build.cjs
node visual-upgrade/webgpu/build.cjs
node visual-upgrade/webgpu/check.cjs
```

默认构建使用已提交的引擎包。修改 `engine.mjs` 后，需将官方 `three@0.187.0` 解包到 `tmp/three-r187-tools/r187/package`，并设置 `ESBUILD` 为 esbuild 可执行文件路径，然后执行：

```powershell
node visual-upgrade/webgpu/build.cjs --rebuild-engine
```

测试依赖 Playwright 和 Chrome，可设置 `PLAYWRIGHT_MODULE` 与 `CHROME_PATH`。检查记录在 `evidence/checks.json`；截图文件名以 `webgl`、`webgpu`、`fallback`、`ssgi` 区分。

## 如何理解结果

本机 Chrome 无头模式、NVIDIA Blackwell GPU 的短样本结果（毫秒）：

| 方案 | 三个机位帧间隔中位数 | 全景 P95 | 充电站 / 工厂 P95 |
| --- | --- | --- | --- |
| 原 WebGLRenderer | 16.7 | 16.8 | 16.8 / 16.8 |
| WebGPU + GTAO | 16.7 | 33.3 | 16.8 / 16.8 |
| 新渲染器 WebGL 2 回退 | 16.7 | 33.4 | 16.8 / 16.8 |
| WebGPU + SSGI | 16.7 | 33.3 | 16.8 / 16.8 |

当前没有证据表明迁移后更快。P95 表示 95% 的采样帧间隔不超过该数值，单次短样本不能代表其他设备或长时间运行。

四种模式使用相同的 1440 × 810 视口、像素比 1、高画质与三个固定机位。每个机位预热 60 帧，再采样 120 个帧间隔。场景中的风机和流动粒子仍会动画，截图不是逐像素同步回放。

帧间隔包含浏览器调度、CPU 和 GPU 工作，并受屏幕刷新节奏限制，不等于纯 GPU 耗时。WebGL 与 TSL 使用不同 AO 实现；这次比较衡量实际交付方案，不能作为图形 API 的等算法基准。绘制次数也因阴影和后处理统计口径不同而不可直接比较。

兼容性检查覆盖车辆信息与 9 条连接、工厂屋顶、SST 预览、三分钟接待的计算/启动/退出、数据楼进入/退出、夜景泛光及粒子位置更新。未覆盖完整三分钟播放、全部情景和不同硬件的长期稳定性。

目前建议保留 WebGL 作为稳定展示入口，WebGPU 作为独立候选方案。单换后端的画面改善有限；SSGI 在这套明亮、开放的场景中增益也较轻微。进一步采用它应以特定镜头的视觉收益和目标设备实测为依据。

引擎来自 Three.js r187，许可见 [Three.js MIT 许可](../vendor/THREE-LICENSE.txt)。技术依据见 [官方 WebGPU 迁移说明](https://threejs.org/manual/pages/webgpurenderer.html)。
