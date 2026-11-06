# 充电站写实材质样板

独立实验目录，基于已经生成的充电站结构制作。没有修改 v20、Three.js r187 展示页或此前 Blender 试验。文件夹隔离不等于新增 Git 分支。

## 交付

- `charging-station-realistic.blend`：可编辑结构、材质节点、相机和灯光，图片已打包。
- `renders/01-station-daylight.png`：全站日光预览。
- `renders/02-charger-detail.png`：充电桩近景。
- `textures/`：脚本生成的混凝土颜色、高度、粗糙度、涂装微颗粒 PNG。
- `source/station-structure.blend`：原结构的独立副本。
- `build.py`：可复现模型细节、贴图与渲染；随机种子固定为 20。
- `build-report.json`：对象、材质、图片和渲染设备记录。

## 本轮内容

保留原来的光伏雨棚、充电桩、车位和直流供电设备，增加外壳倒角、线缆、接头、紧固件、伸缩缝、排水沟和路缘。使用混凝土纹理、涂装微表面、金属反射与光伏表面清漆；天空为 Blender 程序天空，无需外部 HDRI 或下载材质图片。

Blender 5.2.3，Cycles / OptiX，AgX 色彩管理，48 采样加降噪，1440 × 960。场景主要用于材质与光照方向验证，未添加车辆、人物和周边园区景观。

## 重建

从仓库根目录运行：

```powershell
& 'D:/Blender/blender.exe' --background --python blender-assets/charging-station-realistic/build.py
```

这会覆盖本目录的生成文件；手工编辑前请另存 `.blend`。

当前采用物体坐标盒式贴图，细节保留非破坏性修改器。该 `.blend` 用于 Blender 渲染，尚未输出可直接替换网页的 GLB。后续接入 Three.js 需要 UV 展开、烘焙程序节点/凹凸为 glTF 支持的 PBR 贴图、合批和浏览器视觉检查；Cycles 的光照结果不会自动随 GLB 导出。
