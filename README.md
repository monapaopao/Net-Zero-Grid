# 多园区共享综合能源系统

以 **v20 · 客户参观版**作为 Git 初始基线。项目包含多园区能源仿真、任务履约与计量、SST 代表支路对比，以及 Three.js 三维园区与客户导览。

## 运行

Windows 双击根目录的 `打开多园区共享综合能源系统v20.cmd`，或在浏览器中直接打开：

`NetZero-GridToChip-v20-VisitorPresentation/dist/Net-Zero-grid-premium.html`

页面自包含，支持离线运行。数据中心独立预览位于同目录的 `数据中心独立预览.html`。

## 构建

安装 Node.js 后，在终端执行（构建与以下核心测试无需 npm 安装）：

```powershell
cd NetZero-GridToChip-v20-VisitorPresentation
node build.cjs --verify
```

构建会更新离线 HTML、导览文本、字幕和时间表。修改源文件后，应将更新后的产物一并提交。

## 核心检查

在上述 v20 目录运行：

```powershell
node tests/engine.test.cjs
node tests/dispatch-v18.test.cjs
node tests/sst-simulation.test.cjs
node tests/vehicles-startup.test.cjs
```

基础物理测试采用旧调度策略，新调度由专用履约测试覆盖。部分历史保留检查依赖本地旧版目录或备份，不属于独立克隆后的核心检查。浏览器测试脚本还有本机工具依赖，逻辑测试通过不代表 WebGL 画面、帧率和连续导览已验收。

## 目录与文档

- `NetZero-GridToChip-v20-VisitorPresentation/src/`：仿真、调度、三维模型和界面源码。
- `NetZero-GridToChip-v20-VisitorPresentation/original/`：构建所需原始页面。
- `NetZero-GridToChip-v20-VisitorPresentation/dist/`：可直接打开的离线产物。
- `NetZero-GridToChip-v20-VisitorPresentation/tests/`：逻辑、几何和浏览器检查。
- `NetZero-GridToChip-v20-VisitorPresentation/evidence/`：既有验证记录。
- [v20 说明](NetZero-GridToChip-v20-VisitorPresentation/README-v20.md)、[累计修改记录](NetZero-GridToChip-v20-VisitorPresentation/修改说明-v20.md)。内部通用 README 及早期说明保留历史上下文，当前状态以 v20 文档和源码为准。

v2—v19、最初交付、`tmp/`、内部 `backups/` 和本地截图目录保留在原位置，通过 `.gitignore` 排除。仓库包含 v20 源码、必要资源、离线页面及既有测试。为保留哈希验证所需的原始字节，`.gitattributes` 禁止自动换行转换。

## 发布到 GitHub

本地默认分支为 `main`，初始版本标签为 `v20-baseline`。先在 GitHub 创建空仓库，再从本项目根目录执行以下命令（将 URL 替换为实际仓库地址）：

```powershell
git remote add origin https://github.com/monapaopao/YOUR_REPOSITORY.git
git push -u origin main
git push origin v20-baseline
```

## 模型与许可

设备容量、效率、Token 折算和 SST 对比包含演示假设，不能直接视为现场测量、产品性能承诺或真实收入。完整导览约 391 秒，接待路线 180 秒；文案及字幕已有，尚未加载配音音频。

第三方代码与素材来源见 [LICENSES.md](NetZero-GridToChip-v20-VisitorPresentation/LICENSES.md)。本仓库未另行授予项目整体开源许可。
