'use strict';
const fs=require('node:fs'),path=require('node:path');
module.exports=function(page){
 const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('Mode anchor: '+a);return s.replace(a,()=>b);};
 page=once(page,'data-mode="exhibit">演示</button>','data-mode="exhibit" aria-pressed="true">参观</button>');
 page=once(page,'data-mode="run">运行</button>','data-mode="run" aria-pressed="false">仿真</button>');
 page=once(page,'window.NZ_GPU.ready = true;','window.NZ_MODES.ready(window.__NZ_TEST);\n    window.NZ_GPU.ready = true;');
 page=page.replace(/<script>\/\* ===== premium.js ===== \*\/\r?\n([\s\S]*?)\r?\n<\/script>/,(_,source)=>{
  let code=source;
  code=once(code,'  function setMode(mode) {',"  function setMode(mode) {\n    if(window.NZ_VISITOR_VIEW?.state().active)return;\n    if(!['exhibit','run'].includes(mode))return;");
  code=once(code,"    toast(mode === 'exhibit' ?", "    if(window.NZ_MODES){window.NZ_MODES.apply(mode);return;}\n    toast(mode === 'exhibit' ?");
  code=once(code,'  function openDrawer(tab) {',"  function openDrawer(tab) {\n    window.NZ_MODES?.prepareWorkspace();\n    if(S.mode!=='run')setMode('run');");
  code=once(code,'  function switchTab(tab) {', '  function switchTab(tab) {\n    window.NZ_MODES?.rememberTab(tab);');
  code=once(code,"$('selScenario').addEventListener('change', e => applyScenario(e.target.value));", "$('selScenario').addEventListener('change', e => { if(S.mode!=='run')setMode('run'); applyScenario(e.target.value); });");
  code=once(code,"  function toggleDrawer() { drawerOpen ? closeDrawer() : openDrawer('params'); }","  function toggleDrawer() { S.mode==='run'?setMode('exhibit'):openDrawer('params'); }");
  code=once(code,"    if (tab) switchTab(tab);","    if (tab) switchTab(tab);\n    window.NZ_MODES?.rememberTab(tab);");
  code=once(code,"    $('infoLive').textContent = '实时：' + devLive(key);","    $('infoLive').textContent = '实时：' + devLive(key);\n    window.NZ_MODES?.device(key);");
  code=once(code,"      const p = $('trendPanel');","      if(S.mode!=='run'){setMode('run');return;}\n      const p = $('trendPanel');");
  code=code.replaceAll("g.fillStyle = 'rgba(156,179,197,.75)'", "g.fillStyle = '#456169'");
  return '<script>/* ===== presentation-modes.js ===== */\n'+fs.readFileSync(path.join(__dirname,'modes.js'),'utf8')+'\n</script>\n<script>/* ===== premium.js ===== */\n'+code+'\n</script>';
 });
 return page.replace('</head>','<style>\n'+fs.readFileSync(path.join(__dirname,'modes.css'),'utf8')+'\n</style>\n</head>');
};
