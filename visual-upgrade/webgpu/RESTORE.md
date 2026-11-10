# 原生模型视觉恢复记录

- 当前分支：`codex/three-webgpu-restore`。
- 原生 Three.js / WebGPU 视觉基线：`d04ac10`。
- 保留方向光带：`58dcc37`、`84d82d4`。
- 保留标签按钮与布局：`179df88`。
- Blender 性能试验终点：`5d9812c`，仍在 `codex/charging-station-performance` 分支及历史目录中保留。

这次没有重置或改写 Git 历史。恢复后的园区几何、车辆、地面、树木、材质、程序环境反射和灯光使用原生 r187 基线；当前 HTML 不加载 GLB、站区烘焙贴图、HDR 素材或 Blender 资产适配器，也不加载本轮写实样板的性能覆盖模块。

共享光流与界面代码独立放在 `visual-upgrade/shared`，构建不依赖 `blender-assets`。WebGPU 的光流材质位于 `halo.mjs`，保留原先的屏幕空间宽度、头部/尾部、亮芯、暗轮廓和柔边，不恢复密集的点状流动。

当前根入口、Windows 启动器和 `npm run build` 都指向或生成 `webgpu/dist/多园区-v20-r187-WebGPU.html`。园区外景要求实际 WebGPU；数据楼内部保留原有独立 WebGL 应用。正常入口不静默回退到 WebGL；显式 `?forceWebGL` 仅供后端对照诊断，页面标题会显示实际后端。

## 验证与证据

- `evidence/checks.json`：实际后端与 GPU、原生模型检查、130 个 TSL 光流材质、车辆连接、SST、楼内进入/退出、接待启动/退出、夜景及光流行为；无页面错误或外部请求。
- `evidence/label-controls-checks.json`：隐藏/简易/详细标签与侧栏同步，1440、1024、390 三种宽度下的按钮顺序和对齐。
- `evidence/unavailable-check.json`：禁用 WebGPU 后显示明确错误，不启动回退展示。
- `evidence/tour-check.json`：实际 WebGPU、精致档下的完整 180 秒接待路线及按镜头记录的帧时间。
- `evidence/rollback-before-charge.jpg`：从归档样板复制的 Blender 视觉，入口机位。
- `evidence/rollback-after-charge.jpg`：当前原生模型，同机位、同分辨率。
- `evidence/retained-controls.png`：保留的右上角控制区。

物理内核、任务调度、SST 模拟、车辆启动与离线打包检查沿用 v20。浏览器测试不证明所有设备或高 DPI 下都达到 60 FPS；本次目标是恢复确认的视觉基线并保留指定交互。
