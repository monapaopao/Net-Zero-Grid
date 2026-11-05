# 开发指南

使用 Node.js 22，克隆仓库后创建开发分支，在 `NetZero-GridToChip-v20-VisitorPresentation/src/` 修改源码。构建和核心测试无需安装外部 npm 包。

```sh
npm run build
npm test
npm run check:offline
```

## 修改位置

| 内容 | v20 目录内的位置 |
| --- | --- |
| 容量、效率与约束 | `src/config.js` |
| 能源平衡、库存与账本 | `src/engine.js` |
| 任务履约 | `src/dispatch-tasks.js` |
| 情境计算与参观 | `src/cloud-simulation.js`、`src/cloud-visit.js` |
| SST 模型与核算 | `src/sst-model.js`、`src/sst-simulation.js` |
| 数据中心楼内 | `src/vendor/dcdt-v11/` |
| 完整导览与接待文案 | `导览文案.json`、`三分钟接待文案.json` |

修改源文件后重新构建，将源码与生成产物一起提交。不要仅修改 `dist/`：下次构建会覆盖。`original/` 为必要构建输入，应保留。`.gitattributes` 禁止自动转换换行，保证哈希检查所需的原始字节。

## 检查范围

默认测试共 56 项：基础物理 29 项（旧调度策略）、调度履约 13 项、SST 11 项、车辆启动 3 项。历史保留测试依赖未入库的旧版或备份；部分浏览器脚本需要本机工具路径，不在默认检查范围。

涉及场景和界面的修改，需在实际浏览器检查画面、拾取、暂停恢复、楼内进出与导览连续性。逻辑或几何测试不能代替 WebGL 画面验收。

测试可能更新结果记录。提交前查看 `git diff`，区分功能变化和测试耗时等记录变化。涉及核算时说明参数来源、单位、守恒关系、初末库存、未交付与对比条件。

问题反馈请提供浏览器、复现步骤、运行情境与截图。不要上传凭证。贡献指南不改变现有代码、品牌和素材的权利归属。
