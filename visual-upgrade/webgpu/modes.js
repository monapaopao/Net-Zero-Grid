'use strict';
window.NZ_MODES=(function(){
 let api,lastTab='params',applying=false,wasPlaying=false,deviceKey=null;
 const trendChoice={wide:true,narrow:false};
 const $=id=>document.getElementById(id),playing=()=>!!window.NZ_VISITOR_VIEW?.state().active;
 function button(text,id,action){const b=document.createElement('button');b.type='button';b.textContent=text;b.id=id;b.className='iconbtn';b.addEventListener('click',action);return b;}
 function ready(context){
  api=context;
  const purpose=document.createElement('span');purpose.id='modePurpose';purpose.setAttribute('role','status');$('segMode').after(purpose);
  const intro=document.createElement('div');intro.id='simIntro';intro.innerHTML='<h2>仿真工作区</h2><p>选择情景、调整条件，再查看供需与调度结果。</p>';
  $('drawer').prepend(intro);
  const report=document.createElement('details');report.id='simSummaryDisclosure';report.innerHTML='<summary>实时指标与运行摘要</summary>';intro.after(report);report.append($('summary'));
  report.after($('trendPanel'));
  const narrow=matchMedia('(max-width:780px)');
  const placeTrend=()=>{report.open=!narrow.matches;renderTrend();};
  narrow.addEventListener('change',placeTrend);placeTrend();
  const metrics=document.createElement('div');metrics.id='visitSummary';metrics.setAttribute('aria-label','园区关键指标');
  metrics.innerHTML='<div><span>园区实时总负荷</span><strong id="visitLoad"></strong></div><div><span>可再生电力消费占比</span><strong id="visitRenew"></strong></div><div><span>储能 SOC</span><strong id="visitSoc"></strong></div>';
  $('sceneFrame').append(metrics);
  const guide=button('三分钟快速认识','visitGuide',()=>NZ_RECEPTION.start());$('sceneHeading').append(guide);
  const analysis=button('查看参数与分析','modeDeviceAnalysis',()=>api.S.mode==='run'?api.closeInfo():api.setMode('run'));$('infoCard').append(analysis);
  const navAnalysis=button('进入仿真分析','visitAnalysis',()=>api.drawer('params'));$('campusNav').append(navAnalysis);
  $('drClose').title='返回参观';$('drClose').setAttribute('aria-label','收起工作区，返回参观');
  $('drClose').addEventListener('click',event=>{event.stopImmediatePropagation();api.setMode('exhibit');},true);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!playing()&&api.S.mode==='run'&&!$('infoCard').classList.contains('open')){event.stopImmediatePropagation();api.setMode('exhibit');}},true);
  const mini=()=>{for(const [source,target,suffix]of [['mServed','visitLoad',' MW'],['mRenew','visitRenew','%'],['mSoc','visitSoc','%']]){const text=$(source).textContent+suffix;if($(target).textContent!==text)$(target).textContent=text;}};
  new MutationObserver(mini).observe($('summary'),{subtree:true,childList:true,characterData:true});mini();
  let resizePending=false;new ResizeObserver(()=>{if(!resizePending){resizePending=true;requestAnimationFrame(()=>{resizePending=false;api.resize();});}}).observe($('sceneFrame'));
  new MutationObserver(()=>{
   const active=playing();if(wasPlaying&&!active)apply(api.S.mode);wasPlaying=active;
   if(!active&&api.S.mode==='run'&&!$('drawer').classList.contains('open'))requestAnimationFrame(()=>{if(!playing()&&api.S.mode==='run'&&!$('drawer').classList.contains('open'))apply('run');});
  }).observe(document.body,{attributes:true,attributeFilter:['class']});
  api.setMode(api.S.mode||'exhibit');
 }
 function apply(mode){
  if(!api||applying||playing())return;applying=true;
  try{
   const run=mode==='run';
   $('modePurpose').textContent=run?'调整条件，观察调度结果':'观看园区与协同关系';
   for(const b of $('segMode').children)b.setAttribute('aria-pressed',String(b.dataset.mode===mode));
   $('btnDrawer').textContent=run?'返回参观':'仿真分析';$('btnDrawer').title=run?'收起工作区，返回参观':'进入仿真模式并调整参数';
   if(run){api.drawer(lastTab);renderTrend();}
   else{api.closeDrawer();$('trendPanel').classList.remove('open');$('btnTrend').textContent='平衡趋势 ▴';}
   if(deviceKey)device(deviceKey);api.resize();
  }finally{applying=false;}
 }
 function device(key){deviceKey=key;if($('modeDeviceAnalysis'))$('modeDeviceAnalysis').textContent=api?.S.mode==='run'?'返回仿真工作区':'查看参数与分析';}
 function renderTrend(){const open=trendChoice[matchMedia('(max-width:780px)').matches?'narrow':'wide'];$('trendPanel').classList.toggle('open',open);$('btnTrend').textContent=open?'平衡趋势 ▾':'平衡趋势 ▴';for(const id of ['btnTrend','trendClose']){$(id).setAttribute('aria-expanded',String(open));$(id).setAttribute('aria-controls','trendCanvas');}$('trendClose').textContent=open?'收起':'展开';$('trendClose').title=open?'收起趋势图':'展开趋势图';if(open&&api?.S.mode==='run')api.redrawTrend?.();}
 function toggleTrend(){const key=matchMedia('(max-width:780px)').matches?'narrow':'wide';if(api.S.mode!=='run'){trendChoice[key]=true;api.setMode('run');}else{trendChoice[key]=!trendChoice[key];renderTrend();api.refreshPresentation();}}
 return {ready,apply,device,toggleTrend,prepareWorkspace:()=>{if(api&&!applying)api.closeInfo();},rememberTab:tab=>{if(tab)lastTab=tab;},state:()=>({mode:api?.S.mode,tab:lastTab,playing:playing(),version:window.NZ_PROJECT_VERSION?.version})};
})();
