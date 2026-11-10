# 光流与标签的共用代码

从 `84d82d4` 的方向光带和 `179df88` 的标签控制中提取，供当前原生 Three.js / WebGPU 页面构建使用。此目录不导入 Blender 资产或运行适配器。

- `flow-build.cjs`：把保留的光流逻辑应用到 v20 / r187 脚本，覆盖园区、SST 与工厂流动层。
- `flow-halo.js`：路线带状几何、相位、方向、亮芯、轮廓与柔边。WebGPU 调用 `NZ_GPU.createHaloMaterial`，使用 `webgpu/halo.mjs` 的 TSL 实现；保留 GLSL 材质作为非 WebGPU 使用时的实现。
- `label-controls.cjs`：标签开关、简易/详细标签与侧栏同步，以及截图中的按钮和流动图层窗口布局。
- `check-flow.cjs` / `check-labels.cjs`：行为与布局检查。

原有材质 `uniforms.uPhase.value` 等动画接口继续使用，但在 WebGPU 中对应真正的 TSL uniform 节点。不要把旧 `ShaderMaterial` 直接提交到 WebGPU，也不要重新引入点状流动粒子。
