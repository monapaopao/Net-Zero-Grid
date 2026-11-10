'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
module.exports = function patch(page) {
  const once = (code, from, to) => {
    if (code.split(from).length !== 2) throw new Error('Missing performance anchor: ' + from);
    return code.replace(from, () => to);
  };
  return page.replace(/<script>\/\* ===== ([\w.-]+) ===== \*\/\r?\n([\s\S]*?)\r?\n<\/script>/g, (script, name, source) => {
    let code = source.replace(/\r\n/g, '\n');
    if (name === 'post.js') code = fs.readFileSync(path.join(__dirname, 'post-budget.js'), 'utf8');
    if (name === 'config.js') {
      code = once(code, "high: { label: '精致', pixelRatioMax: 1.75", "high: { label: '精致', pixelRatioMax: 1.25");
      code = once(code, "standard: { label: '标准', pixelRatioMax: 1.25", "standard: { label: '标准', pixelRatioMax: 1.0");
    }
    if (name === 'sst-visit.js') code = once(code, 'n.depthWrite=false;return n;', 'n.depthWrite=false;window.NZ_PERF?.registerWarmMaterial(o,n);return n;');
    if (name === 'premium.js') {
      code = once(code, 'DPR = Math.min(window.devicePixelRatio || 1, q.pixelRatioMax);',
        'DPR = window.NZ_PERF.pixelRatio(VW, VH, q.pixelRatioMax, S.quality);');
      code = once(code, '  function guardQuality(fps) {', '  function guardQuality(fps) {\n    if (window.NZ_PERF) return;');
      code = once(code, 'if (!renderer.getContext().isContextLost()) {', 'if (!renderer.getContext().isContextLost() && window.NZ_PERF.shouldRender()) {');
      code = once(code, '      autoQuality = false;', '      autoQuality = false; window.NZ_PERF.resetBudget();');
      code = once(code, '（手动指定，不再自动降级）', '（保留所选档位，渲染分辨率自适应）');
      code = once(code, '    const t0 = (window.performance && performance.now) ? performance.now() : 0;',
        '    window.NZ_PERF.beforeRender(light, sunL, postObj, dtR);\n    const t0 = (window.performance && performance.now) ? performance.now() : 0;');
    }
    new vm.Script(code, { filename: name });
    return '<script>/* ===== ' + name + ' ===== */\n' + code + '\n</script>';
  });
};
