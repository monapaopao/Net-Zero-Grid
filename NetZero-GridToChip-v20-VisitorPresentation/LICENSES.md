# LICENSES —— 依赖与素材来源

本版交付物是**单个自包含 HTML**，运行时不加载任何外部资源。下面列出文件里实际包含的第三方代码与素材，以及数据来源。

---

## 一、第三方代码

| 组件 | 版本 | 许可 | 在本版中的位置 |
|---|---|---|---|
| Three.js | r147 | MIT | `src/three.js`（607,786 字节），构建时**字节级原样搬运**，不做改写 |
| OrbitControls | 随 r147 分发 | MIT | `src/orbit.js`（26,662 字节），字节级原样搬运 |

MIT 许可要求保留版权声明与许可文本。两者在原文件的内联脚本里已带有各自的头部注释，本版沿用原样，未删除、未改写：

- Three.js：`https://github.com/mrdoob/three.js`（MIT，© 2010-2023 three.js authors）
- OrbitControls：`https://github.com/mrdoob/three.js/blob/dev/examples/jsm/controls/OrbitControls.js`（MIT，© three.js authors）

**本版没有引入任何新的第三方库**。泛光后处理（`src/post.js`，8.7 KB）是本项目自写的最小实现（亮部提取 + 可分离高斯 + 加性合成 + 轻暗角），没有取用 three.js 的 `EffectComposer` 或任何外部 shader 包。

---

## 二、原作品部分

| 内容 | 说明 |
|---|---|
| `original/Net-Zero-grid-simulation-20260722.html` | 原文件，905,446 字节，**未被本版修改任何字节**（sha256 前缀 `8c2a89c33d872ec3…`） |
| `src/legacy-pres.js`（18,488 字节）、`src/legacy-scene.js`（185,724 字节） | 由 `build.cjs` 每次从原文件内联脚本段重新生成，只做最小改写：两处行为改动（粒子池按边线可配、数据流速度 ×0.55）、一处段落切分（交出主渲染段由 `premium.js` 接管）、标牌文字与电源名称改为本版口径、移除左上角会闪的「地区 · 昼夜」文字与日月弧、移除两条悬空的装饰性数据流示意线（见 `DATA-CHANGES.md` 第十、十一节）。版权随原作品 |
| 内嵌品牌标牌图像 | 原文件内 1 处 `data:image/png`，即品牌标识，未改动 |
| 场景几何、设备外观、标牌文字、产品角标文案 | 沿用原方案，未重做 |

---

## 三、本项目自研部分

`src/config.js`、`src/engine.js`、`src/compat.js`、`src/labels.js`、`src/bridge.js`、`src/post.js`、`src/overlay.html`、`src/premium.css`、`src/premium.js`、`build.cjs`、`tests/*`、三份说明文档。

这部分按项目方的意愿支配，可自由修改、再分发、再构建。

---

## 四、字体

**没有内嵌任何字体文件，也没有引用任何网络字体。** 只用系统字体栈：

```
"Microsoft YaHei", "PingFang SC", "Segoe UI", sans-serif
```

因此不涉及字体授权条款，也不产生字体下载请求（离线核验里「运行期未发出任何出网请求」为 0 条，见 `tests/offline-check.json`）。

---

## 五、贴图与材质

**没有外部贴图文件。** 全部纹理在运行时由 Canvas 2D 程序化生成（`src/legacy-scene.js` 内 6 处、`src/legacy-pres.js` 内 1 处 `createElement('canvas')` 绘制），包括地面网格、金属板、混凝土、草地噪声等。星点、粒子流、光晕均由几何与着色器实时生成。

---

## 六、数据来源

界面「边界与来源」页给出的可点击来源：

| 用途 | 来源 |
|---|---|
| 省级电网平均排放因子（2023 年） | 生态环境部、国家统计局，**2025 年第 47 号公告**<br>`https://www.mee.gov.cn/xxgk2018/xxgk/xxgk01/202512/t20251231_1139517.html` |
| 国家级零碳园区建设指标体系（试行） | 发改环资〔2025〕910 号附件 3<br>`https://www.ndrc.gov.cn/xwdt/tzgg/202507/P020250708510068921321.pdf` |
| 绿电直连 | 关于有序推动绿电直连发展有关事项的通知 · 发改能源〔2025〕650 号<br>`https://www.ndrc.gov.cn/xxgk/zcfb/tz/202505/t20250530_1398138.html` |
| 电解水制氢电耗、合成氨公辅电耗的对标锚点 | 米东 1.5 GW 制氢氨肥项目公开参数（4.189 kWh/Nm³ ≈ 46.9 kWh/kg；公辅 805 kWh/t NH₃） |

**引用纪律**：上述因子只用于本演示的核算示意；实施或对外申报时必须按适用年度、适用口径重新核验。政策对标状态在界面上固定显示「待核算」，本版不据此输出任何达标结论。

---

## 七、内置的数据中心数字孪生应用（v1.3.0 起）

「数据中心 · 数字孪生」小窗里嵌的不是本工程自建的白模场景，而是**甲方提供的独立应用**
《Grid-to-Chip · AI Data Center Digital Twin》（`DataCenterDigitalTwin.zip`）。
构建时把它的 `index.html` / `style.css` / `app.js` 三件套**内联成一份完整 HTML**
（`window.NZ_DCDT_APP`），运行时用 `<iframe srcdoc>` 承载 —— 它自带 DOM、样式与 WebGL 上下文，
与本工程彻底隔离。

| 项 | 说明 |
|---|---|
| 应用本体 | 甲方提供的 **`DataCenterDigitalTwin_V5.zip`**（v1.3.3 起；v1.3.0–v1.3.2 用的是 V4 / `DataCenterDigitalTwin.zip`，两份源文件都随包保留在 `src/vendor/dcdt-v5/`（V5）与 `src/vendor/dcdt/`（V4））。原样内联，未做功能改写；仅由其自带源码去掉了对 `style.css` / `app.js` 的外部引用，改为内联 |
| 应用自带的外链 | V5 的「模型说明」弹窗里有两条**引用锚点**（Caterpillar / Cummins 中压柴发规格页）。它们是 `<a href>` 文本引用，不加载任何外部资源，离线运行不受影响 |
| 随附字体/图标 | 无（图标为内联 SVG，字形走系统字体） |
| 该应用内部的运行数据 | 全部是它自己的**教学演示值**：24 台机柜 × 60 kW、HVDC 效率示意 97.5%、PUE 估计值、负载滑块驱动。**不与本工程的核算内核联动**，界面自带「演示模拟 · DC-01」标识；温度与气流不是 CFD |

### 该应用内嵌的第三方：three.js r180 + OrbitControls

```
MIT License

Copyright © 2010-2025 three.js authors
https://github.com/mrdoob/three.js
```

MIT 许可全文随包提供：`src/vendor/dcdt/THREE-LICENSE.txt`（与该应用自带的
`THREE-LICENSE.txt`、`source/dist/vendor/LICENSE` 一致）。

---

## 八、没有使用的东西

- 没有使用任何 AI 生成的图片、模型或音视频素材（内置应用的几何与图标均为其作者程序化生成/内联 SVG）。
- 没有引入任何 CDN、埋点、统计脚本或远程接口。
- 没有使用任何需要在运行时联网的库。
