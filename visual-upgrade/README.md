# v20 园区外景 · Three.js r187 视觉升级

第 4 步的独立 WebGPU 对照入口、TSL 迁移说明与验证结果见 [WebGPU 试验](webgpu/README.md)。

双击 `dist/多园区-v20-r187-视觉升级.html`。页面内嵌 Three.js r187 与匹配的 OrbitControls，使用 WebGL 2。数据中心楼内仍使用 v20 内嵌的 r180 应用。

升级位于 Git 分支 `visual/three-r187`，以 v20 的离线交付为输入。开发和发布都可以继续使用原版离线页面作为基线。

## 三个视觉场景

| 场景 | 改动 |
| --- | --- |
| 园区全景 | 日光与天空冷暖分离，按深度弱化远山和远处设施 |
| 超充近景 | 车漆清漆层、玻璃反射、共用环境贴图、近景阴影收紧 |
| 工厂开顶 | r187 粗糙漫反射地面、通道明暗分区、金属材质与局部环境遮蔽 |

高画质可看到完整后期。环境反射来自本地程序生成的光照环境，三处切换由相机位置和注视点平滑驱动。材质和灯光参数在 `render-polish.js`。

## 重新构建

从仓库根目录执行：

```powershell
node visual-upgrade/build.cjs
node visual-upgrade/check.cjs --compare
```

构建脚本读取现有 v20 离线页面，再生成独立升级页。它对色彩空间、光强、着色器输出、深度纹理及阴影类型做版本适配。页面运行时无需外部资源。浏览器检查使用本地 Chrome 和 Playwright，可通过 `CHROME_PATH`、`PLAYWRIGHT_MODULE` 指定。

为复现中间阶段，将 npm 的 `three@0.157.0`、`three@0.167.0`、`three@0.177.0` 分别解包到 `tmp/three-r187-tools/r157/package` 等目录，将 `ESBUILD` 指向 esbuild 可执行文件。

```powershell
foreach ($revision in @(157, 167, 177, 187)) {
  if ($revision -ne 187) { node visual-upgrade/prepare-engine.cjs $revision }
  node visual-upgrade/build.cjs --revision=$revision --compat
}
node visual-upgrade/check.cjs
```

最终引擎包来自 `three@0.187.0`，许可在 `vendor/THREE-LICENSE.txt`。三个同机位截图及对比图位于 `evidence/`。阶段记录检查了 WebGL 渲染、工厂屋顶、车辆连接与 SST 预览，r187 额外检查了接待路线和楼内应用。帧间隔采自本机 Chrome 短样本，仅供复验。

[Three.js 官方迁移指南](https://github.com/mrdoob/three.js/wiki/Migration-Guide) · [r187 发布说明](https://github.com/mrdoob/three.js/releases/tag/r187)
