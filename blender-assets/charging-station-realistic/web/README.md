# 充电站写实全站 · Three.js r187

用 Chrome 或 Edge 打开 [多园区离线预览](dist/多园区-v20-r187-充电站写实.html)。页面默认显示写实全站，右上角可以切换「r187 原版」或「写实全站」，并直达全站、终端、北排电源和南排电源四个机位。

写实资产覆盖光伏雨棚、充电区地坪、21 个泊位、24 台终端、两套直流电源及输出保护柜。园区沿用原有车辆、充电线、连接状态、功率牌及场景灯光。九个挂载组随原有设备结构运动，支持机柜拆解与 SST 替换。写实资产加载失败时，页面自动显示 r187 原外观。

## 资产和运行结果

Blender 导出器保留光伏板原有 UV，把盒式材质映射转成各面的 UV，并将生成的高度图转换成切线法线贴图。GLB 内嵌颜色、粗糙度与法线贴图，由 Three.js WebGL 的灯光实时渲染。全站按挂载组与材质合成 48 个网格批次，共约 7.1 万个三角面。细小构件如光伏框边采用直边，保留设备外壳等近景部位的倒角。导出的 GLB 约 6.8 MB，离线 HTML 约 7.0 MB，含 gzip 压缩的模型与贴图。

Chrome 离线验证覆盖原版和写实切换、9 条车辆连接、公交车落地高度、供电柜拆解、SST 切换与复原、接待导览计算和启动，以及模拟资源解码失败后的回退。四个固定机位的原版与写实截图和采样结果保存在 [evidence](evidence/) 中。帧间隔采自本机 Chrome、高画质、1440 × 810 的短样本，包含浏览器调度开销。

## 重建

从仓库根目录运行：

```powershell
& 'D:/Blender/blender.exe' --background --python-exit-code 1 --python blender-assets/charging-station-realistic/web/export.py
node blender-assets/charging-station-realistic/web/build.cjs
node blender-assets/charging-station-realistic/web/check.cjs
```

`export.py` 读取父目录的 `.blend`，将材质与几何转换保留在导出过程中。`build.cjs` 使用仓库内的 r187 展示版和同版本 GLTFLoader，生成内嵌模型的单文件页面。重建 loader 时用 `--rebuild-loader`，将 `THREE_PACKAGE` 指向解包的 `three@0.187.0`，将 `ESBUILD` 指向 esbuild 可执行文件。许可见 [Three.js MIT 许可](../../../visual-upgrade/vendor/THREE-LICENSE.txt)。验证脚本支持 `CHROME_PATH` 与 `PLAYWRIGHT_MODULE`。
