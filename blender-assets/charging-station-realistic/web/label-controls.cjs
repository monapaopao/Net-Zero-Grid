'use strict';

const vm = require('node:vm');

function replaceOnce(source, before, after) {
  if (source.split(before).length !== 2) throw new Error('Missing label control anchor: ' + before);
  return source.replace(before, () => after);
}

module.exports = function labelControls(page) {
  page = replaceOnce(page, '<button class="iconbtn" id="btnLabelDetail"',
    '<button class="iconbtn" id="btnToggleLabels" type="button" aria-pressed="true" aria-controls="labels3d" title="隐藏全部场景标签">开关标签</button><button class="iconbtn" id="btnLabelDetail"');
  let found = false;
  page = page.replace(/<script>\/\* ===== grid-to-chip.js ===== \*\/\r?\n([\s\S]*?)\r?\n<\/script>/, (block, source) => {
    found = true;
    source = source.replace(/\r\n/g, '\n');
    source = replaceOnce(source, '  function filterLabels(){', `  function filterLabels(){
    document.body.classList.toggle('scene-labels-hidden', !V.labels);
    document.body.classList.toggle('labels-detail', V.labels && V.details);
    $id('showCampusLabels').checked = V.labels;
    const toggle = $id('btnToggleLabels');
    toggle.classList.toggle('on', V.labels);
    toggle.setAttribute('aria-pressed', String(V.labels));
    toggle.title = V.labels ? '隐藏全部场景标签' : '显示简易标签';
    $id('btnLabelDetail').classList.toggle('on', V.labels && V.details);
    $id('btnLabelDetail').setAttribute('aria-pressed', String(V.labels && V.details));`);
    source = replaceOnce(source, "$id('showCampusLabels').addEventListener('change',e=>{V.labels=e.target.checked;filterLabels();});",
      `$id('showCampusLabels').addEventListener('change', e => {
      V.labels = e.target.checked;
      V.details = false;
      filterLabels();
    });
    $id('btnToggleLabels').addEventListener('click', () => {
      V.labels = !V.labels;
      V.details = false;
      filterLabels();
    });`);
    source = replaceOnce(source, "$id('btnLabelDetail').addEventListener('click',()=>{V.details=!V.details;document.body.classList.toggle('labels-detail',V.details);$id('btnLabelDetail').classList.toggle('on',V.details);$id('btnLabelDetail').setAttribute('aria-pressed',String(V.details));});",
      `$id('btnLabelDetail').addEventListener('click', () => {
      V.details = !V.labels || !V.details;
      V.labels = true;
      filterLabels();
    });`);
    new vm.Script(source, { filename: 'grid-to-chip.js' });
    return '<script>/* ===== grid-to-chip.js ===== */\n' + source + '\n</script>';
  });
  if (!found) throw new Error('Missing label control script');
  const css = `
    .scene-tools{top:14px;right:18px;width:min(354px,calc(100% - 36px));display:grid;grid-template-columns:repeat(3,minmax(0,1fr)) 36px;gap:6px;align-items:stretch}
    .scene-tools .iconbtn{height:36px;margin:0;min-width:0;padding:0 10px;display:inline-flex;align-items:center;justify-content:center;white-space:nowrap;box-sizing:border-box}
    .scene-tools #btnViewHome{width:36px;padding:0}
    .scene-tools [hidden]{display:none!important}
    .scene-tools #btnNorthTop{order:0}.scene-tools #btnToggleLabels{order:1}.scene-tools #btnLabelDetail{order:2;display:inline-flex}.scene-tools #btnChemicalLabels{order:3}.scene-tools #btnViewHome{order:4}
    .scene-tools:has(#btnChemicalLabels:not([hidden])){grid-template-columns:repeat(4,minmax(0,1fr)) 36px}
    #flowLayers{top:58px;right:18px;width:min(354px,calc(100% - 36px));box-sizing:border-box}
    body.scene-labels-hidden :is(#labels3d,#labels3d *,#chemicalReviewLabels,#chemicalReviewLabels *,#chemicalReviewFlow,.sst-scene-label){visibility:hidden!important;pointer-events:none!important}
    body:not(.labels-detail) .dev3d .lv{display:none!important}
    @media(max-width:1100px){.scene-tools{top:115px;right:16px}#flowLayers{top:159px;right:16px}}
    @media(max-width:780px){.scene-tools{top:76px;right:12px;width:calc(100% - 24px)}#flowLayers{top:120px;right:12px;width:calc(100% - 24px)}}
  `;
  const headEnd = page.indexOf('</head>');
  if (headEnd < 0) throw new Error('Missing document head');
  return page.slice(0, headEnd) + '<style>/* Label controls */\n' + css + '\n</style>\n' + page.slice(headEnd);
};
