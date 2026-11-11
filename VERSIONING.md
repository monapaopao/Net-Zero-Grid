# 项目版本规则

项目采用 MAJOR.MINOR.PATCH。大版本用于重大架构、核心模型口径或不兼容改动；功能版本用于保持兼容的新增功能与明显交互升级；修复版本用于缺陷、兼容性、性能修正和小幅界面调整。

`project-version.json` 是发布信息来源，`package.json` 镜像项目版本。使用 `node scripts/project-version.cjs set 21.1.0 "参观与仿真双模式版" 2026-11-11` 更新，日期按发布者的 Asia/Shanghai 客户时间填写。随后更新 CHANGELOG、构建并执行 `node scripts/project-version.cjs check`。页面标题、版本信息与导出文件的 `projectVersion` 从同一来源生成；`modelVersion` 继续描述原算法配置，不替换为项目版本。

v21.0.0 固化原生 WebGPU 基准；v21.1.0 引入参观/仿真双模式。每次正式发布需更新 CHANGELOG，完成验证后提交并建立同名 Git 标签。用标签定位回退，不按版本复制项目目录，不改历史 v20 路径和历史文档。

Three.js r187、楼内 Three.js r180 和模型算法版本各自独立。当前版本见 [CURRENT-VERSION.md](CURRENT-VERSION.md)。Git 标签仅是本地发布记录，未推送时不代表 GitHub 已更新。
