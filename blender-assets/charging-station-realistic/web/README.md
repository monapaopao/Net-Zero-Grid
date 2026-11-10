# 充电站写实全站 · Three.js r187

用 Chrome 或 Edge 打开 [多园区离线预览](dist/多园区-v20-r187-充电站写实.html)。页面默认从写实充电站全景开始。

写实资产覆盖光伏雨棚、充电区地坪、21 个泊位、24 台终端、两套直流电源及输出保护柜。园区沿用原有车辆、充电线、连接状态、功率牌及场景灯光。九个挂载组随原有设备结构运动，支持机柜拆解与 SST 替换。写实资产加载失败时，页面自动显示 r187 原外观。

能源、数据、调度及冷热线路沿用原来的路径和介质色相，提高饱和度以便在浅色地面上辨认。光带使用彩色实亮芯、窄幅深色描边和柔边外晕，移动前端呈梭形。亮芯在全景约 2.8 像素、近景约 3.8 像素宽，外晕总宽约 10～12 像素。较长主干及聚焦线路最多显示两段光带。反向流沿原路线逆向运动，零流量和减少动态模式保留静态线路。SST 导览和工厂废水示意也使用同一光带，夜间适当降低光带强度。

当前版本的 [16 秒动态预览](evidence/flow-visibility-preview.mp4) 展示全景、充电站、工厂和夜景预设。可对照上一版的[全景](evidence/soft-campus.jpg)、[充电站](evidence/soft-charge.jpg)、[工厂](evidence/soft-factory.jpg)与当前的[全景](evidence/halo-campus.jpg)、[充电站](evidence/halo-charge.jpg)、[工厂](evidence/halo-factory.jpg)。这些画面采用相同机位和画质，运动相位与风机姿态随录制时间变化。

同机位前后对照可查看[全景原粒子](evidence/particles-campus.jpg)与[全景光带](evidence/halo-campus.jpg)、[充电站原粒子](evidence/particles-charge.jpg)与[充电站光带](evidence/halo-charge.jpg)、[工厂原粒子](evidence/particles-factory.jpg)与[工厂光带](evidence/halo-factory.jpg)。这些截图采自运动中的不同帧，流向应以离线页实际播放为准。改动前的粒子版保存在 Git 提交 `ad0bf70`。

## 资产和运行结果

Blender 导出器保留光伏板原有 UV，把盒式材质映射转成各面的 UV，并将生成的高度图转换成切线法线贴图。GLB 内嵌颜色、粗糙度与法线贴图，由 Three.js WebGL 的灯光实时渲染。全站按挂载组与材质合成 48 个网格批次，共约 7.1 万个三角面。细小构件如光伏框边采用直边，保留设备外壳等近景部位的倒角。导出的 GLB 约 6.8 MB，离线 HTML 约 7.0 MB，含 gzip 压缩的模型与贴图。

Chrome 离线验证覆盖原版和写实切换、9 条车辆连接、公交车落地高度、供电柜拆解、SST 切换与复原、接待导览计算和启动，以及模拟资源解码失败后的回退。四个固定机位的原版与写实截图和采样结果保存在 [evidence](evidence/) 中。帧间隔采自本机 Chrome、高画质、1440 × 810 的短样本，包含浏览器调度开销。

光带检查另外覆盖正反向、零流量、分类开关、聚焦范围、减少动态模式和 SST 导览暂停。设置 `FLOW_BASELINE` 为改动前的离线 HTML 路径，可以重拍同机位截图，`FLOW_BASELINE_PREFIX=soft` 用于保存柔边光带版的对照。

## 重建

从仓库根目录运行：

```powershell
& 'D:/Blender/blender.exe' --background --python-exit-code 1 --python blender-assets/charging-station-realistic/web/export.py
node blender-assets/charging-station-realistic/web/build.cjs
node blender-assets/charging-station-realistic/web/check.cjs
```

动态预览由 `node blender-assets/charging-station-realistic/web/preview-flow.cjs` 录制，使用浏览器画布捕获和 MediaRecorder，再转成 MP4。可设置 `FFMPEG` 指向本机 ffmpeg 可执行文件。

`export.py` 读取父目录的 `.blend`，将材质与几何转换保留在导出过程中。`build.cjs` 使用仓库内的 r187 展示版和同版本 GLTFLoader，生成内嵌模型的单文件页面。重建 loader 时用 `--rebuild-loader`，将 `THREE_PACKAGE` 指向解包的 `three@0.187.0`，将 `ESBUILD` 指向 esbuild 可执行文件。许可见 [Three.js MIT 许可](../../../visual-upgrade/vendor/THREE-LICENSE.txt)。验证脚本支持 `CHROME_PATH` 与 `PLAYWRIGHT_MODULE`。
