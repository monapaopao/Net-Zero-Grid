# Net-Zero Grid · 多园区共享综合能源系统

[![验证](https://github.com/monapaopao/Net-Zero-Grid/actions/workflows/verify.yml/badge.svg)](https://github.com/monapaopao/Net-Zero-Grid/actions/workflows/verify.yml)
![版本](https://img.shields.io/badge/baseline-v20-146b60)
![技术](https://img.shields.io/badge/JavaScript-Three.js-f0db4f)

**把源、网、荷、储、氢与算力放进同一座可观察、可推演的三维园区。**

Net-Zero Grid 是多园区综合能源系统的交互式仿真与展示项目，通过 Three.js 场景、能源运行账本、生产任务履约和协同情境，解释风光波动下各园区如何共享能源，以及不同装备和调度策略带来的收益与代价。

当前维护基线为 **v20 · 客户参观版**，提供离线单文件页面、完整园区导览、三分钟接待路线和四个协同专题。

[在线入口](https://monapaopao.github.io/Net-Zero-Grid/) · [开发指南](CONTRIBUTING.md) · [版本记录](CHANGELOG.md) · [模型边界](docs/MODEL-BOUNDARIES.md)

## 主要功能

| 模块 | 内容 |
| --- | --- |
| 三维园区 | 数据中心、化工与电冶金、智能制造、超充，以及风光、线路、储能和研究型核电设施 |
| 能源运行 | 秒级物理步长下的供需平衡、储能充放电、氢库存、购电、弃电与能源来源账本 |
| 调度与履约 | 工业任务期限、柔性负荷、储能备用、受限提示和服务计量 |
| 云参观 | 391 秒完整导览、180 秒接待路线，以及暂停、跳章和回放 |
| 情境专题 | 风光协同、算随绿电、策略比较和 SST 能源路由 |
| 装备结构 | 数据中心楼内、SST、风机机舱、储能、线塔、连续陶瓷化导线工厂和超充车辆 |
| 结果解释 | 同条件比较购电、装备损耗、库存、弃电与未交付，展示策略取舍 |

## 快速开始

### 直接体验

访问[在线入口](https://monapaopao.github.io/Net-Zero-Grid/)，部署状态可在仓库 Actions 中查看。

也可以点击 **Code → Download ZIP**，解压后打开：

```text
NetZero-GridToChip-v20-VisitorPresentation/dist/Net-Zero-grid-premium.html
```

Windows 用户可双击根目录的 `打开多园区共享综合能源系统v20.cmd`。页面自包含，支持离线运行，浏览器需支持 WebGL。数据中心独立预览为同一 `dist/` 目录中的 `数据中心独立预览.html`。

进入后选择 **云参观 → 园区导览 → 三分钟快速认识**。需要观察运行细节时，可退出导览自由探索，或查看四个情境专题。

### 从源码构建

建议使用 Node.js 22。构建和核心测试只使用 Node 内置模块及仓库内代码，无需安装 npm 依赖。

```sh
git clone https://github.com/monapaopao/Net-Zero-Grid.git
cd Net-Zero-Grid
npm run build
npm test
npm run check:offline
```

构建会生成离线页面并同步导览文本、字幕和时间表。默认测试执行基础物理、调度履约、SST 与车辆启动共 56 项检查；离线检查补充脚本解析和打包验证。

## 项目结构

```text
.
├── .github/workflows/verify.yml       # 构建与核心自动检查
├── docs/MODEL-BOUNDARIES.md           # 模型口径和验证范围
├── NetZero-GridToChip-v20-VisitorPresentation/
│   ├── src/                          # 仿真、模型、场景和界面
│   ├── src/vendor/dcdt-v11/           # 数据中心楼内应用
│   ├── original/                     # 必要构建输入
│   ├── assets/                       # 本地素材
│   ├── scripts/                      # 文案导出及制作工具
│   ├── tests/                        # 逻辑、几何和浏览器检查
│   ├── evidence/                     # 既有验证记录
│   ├── dist/                         # 可直接运行的离线页面
│   ├── 导览文案.json                 # 完整导览文案源
│   ├── 三分钟接待文案.json           # 接待路线文案源
│   └── build.cjs                     # 离线构建器
├── CHANGELOG.md
├── CONTRIBUTING.md
├── index.html                        # 在线展示入口
└── package.json                      # 统一开发命令
```

保留 v20 目录名便于核对制作记录。后续直接在该目录开发，由 Git 管理历史，不必为每轮修改复制完整目录。旧版交付、临时文件与重复备份不纳入当前代码树。

## 设计与模型口径

仿真采用固定一秒物理步长，与渲染帧率解耦；云参观使用隔离计算，退出后恢复主场景。数据中心嵌入页和独立预览由同一源码构建。SST 使用独立代表支路核算，保留主园区账本。

容量、效率、几何和 Token 折算包含演示假设。本项目用于解释系统关系与策略取舍，尚未接入现场控制、真实订单或支付；结果不构成产品实测、工程认证或收入承诺。详见[模型边界](docs/MODEL-BOUNDARIES.md)。

## 验证与当前状态

v20 基线已在独立导出的副本中完成构建，两个离线页面与现有交付逐字节一致，56 项核心测试及 13 项构建检查通过。

核心测试不依赖旧版目录。部分历史对比脚本需要本地旧版或备份，部分浏览器脚本包含本机工具路径，不在默认测试范围。实时 WebGL 画面、帧率及完整连续播放仍需实际浏览器验收。讲解稿和字幕已有，尚未加载配音音频。

## 更多文档

- [v20 功能与接待路线](NetZero-GridToChip-v20-VisitorPresentation/README-v20.md)
- [v20 累计修改说明](NetZero-GridToChip-v20-VisitorPresentation/修改说明-v20.md)
- [调度履约与计量](NetZero-GridToChip-v20-VisitorPresentation/README-v18.md)
- [SST 结构与运行比较](NetZero-GridToChip-v20-VisitorPresentation/README-v19.md)
- [问题反馈](https://github.com/monapaopao/Net-Zero-Grid/issues)

## 许可与素材

第三方依赖和素材来源见 [LICENSES.md](NetZero-GridToChip-v20-VisitorPresentation/LICENSES.md)。本仓库未另行授予项目整体开源许可；品牌标识与产品资料遵循各自权利归属。
