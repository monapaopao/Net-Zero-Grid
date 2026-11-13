'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const content=require('./content.cjs');
function once(s,a,b){if(s.split(a).length!==2)throw Error('Exhibition tour anchor: '+a);return s.replace(a,()=>b);}
module.exports=html=>{
 html=html.replace(/<script>\/\* ===== ([\w.-]+) ===== \*\/\r?\n([\s\S]*?)\r?\n<\/script>/g,(block,name,source)=>{
  let code=source;
  if(name==='tour-content.js')code='window.NZ_TOUR_SCRIPT='+JSON.stringify(content.full)+';\n'+fs.readFileSync(path.join(__dirname,'captions.js'),'utf8');
  if(name==='reception-content.js')code='window.NZ_RECEPTION_SCRIPT='+JSON.stringify(content.quick)+';';
  if(name==='reception-model.js')code=once(code,"!cue.text.endsWith('。')","!/[。！？]$/.test(cue.text)");
  if(name==='premium.js'){
   code=once(code,"$('tourText').textContent=(caption||row).text;","$('tourText').textContent=NZ_EXHIBITION_CAPTIONS.at(caption.text,total-caption.globalStart,caption.globalEnd-caption.globalStart);");
   // Outer timeline supplies the narration; loading/closing transitions do not advance it.
   code=once(code,'    const signature=(key||\'\')',"    $('tourBar').dataset.route='full';\n    const signature=(key||'')");
   code=code.replace("value:'化工与电冶金'","value:'绿解化工'");
   code=code.replace("lookKey:row.shot==='solar'?'solar':group","lookKey:row.shot==='solar'?'solar':row.focus==='charge'?'charging':group==='loads'?'factory':group");
   // The opening must hide a previous completion card on replay as well.
   code=once(code,'function startTour(){','function startTour(){window.NZ_VISITOR_VIEW.hideEnd();');
  }
  if(name==='reception.js'){
   const start=code.indexOf('    try{comparison=cachedComparison'),end=code.indexOf('\n  function excerptTime()',start);if(start<0||end<0)throw Error('Reception initialization anchor');
   code=code.slice(0,start)+"    comparison=null;notice='';if(!on||job!==token)return;loading=false;frame(true);\n  }\n"+code.slice(end);
   code=code.replace("notice='正在准备两小时协同推演…'","notice='正在准备快速预览…'");
   code=once(code,"$('receptionText').textContent=cue.text;","$('receptionText').textContent=NZ_EXHIBITION_CAPTIONS.at(cue.text,time-cue.start,cue.duration);");
   code=code.replace('原时间轴 33–62 秒；非倍速播放','原时间轴 50–74 秒；非倍速播放');
   const metricsStart=code.indexOf("    if(chapter.id==='factory')"),metricsEnd=code.indexOf("    if(chapter.id==='coordination'",metricsStart);
   code=code.slice(0,metricsStart)+"    if(chapter.id==='factory')return [{label:'柔性消纳',value:'订单与工艺约束下安排可调负荷'}];\n    if(chapter.id==='charging')return [{label:'产品介绍参数',value:'3.2MW · 94–96%',note:'非当前模型实时测量；V2G 为新一代产品接口能力'}];\n"+code.slice(metricsEnd);
   code=code.replace('computed:!!comparison','narrationOnly:true,computed:!!comparison');
   code=once(code,"if(!inside)return;inside=false;loading=true;const token=++job;await window.GOBI_DCDT.close();", "if(!inside)return;inside=false;loading=true;const pose=resolve(M.at(model,model.building.until-.001).cue.shot);api.camera.position.fromArray(pose.pos);api.controls.target.fromArray(pose.tgt);const token=++job;await window.GOBI_DCDT.close();");
  }
  if(name==='visitor-view.js'){
   code=code.replace("if(action==='replay')window.NZ_RECEPTION.start();","if(action==='replay'){if(ending.dataset.kind==='full')api.startTour();else window.NZ_RECEPTION.start();}");
   code=code.replace("if(!ending)return;ending.innerHTML=","if(!ending)return;ending.dataset.kind=options.kind;ending.innerHTML=");
   code=code.replace('三分钟再看一次',"${options.kind==='full'?'五分钟再看一次':'三分钟再看一次'}");
   code=code.replaceAll("factory:['水平走线与收放线联动','处理、清洗及废液配套','屋顶开合与智能监测']","factory:['订单与生产工艺约束','可调负荷与新能源消纳']").replaceAll("loads:['连续生产与智能监测','光储充的功率分配']","loads:['柔性消纳与生产约束','光储充一体化供能']");
   code=code.replace('陶瓷基耐电晕干式变压器<br>架空线','新型复合绝缘干式变压器<br>陶瓷架空线');
   code=code.replace("key==='sst'?'下一代装备方案／前瞻研究演示':","key==='nuclear'?'区外核电基荷 · 研究场景':key==='charging'?'产品介绍参数非实时测量；V2G 为产品接口能力':key==='sst'?'下一代装备方案／前瞻研究演示':");
  }
  if(name==='cloud-visit.js')code=code.replace('关键产品、一次协同事件与 SST 演进摘要。','三分钟沿风光、输配电和各类用能场景，认识多园区协同方案。').replace('开始三分钟接待路线','开始三分钟快速预览');
  if(name==='cloud-visit-content.js'){
   code+="\nObject.assign(window.NZ_CLOUD_CONTENT.tour,{title:'五分钟完整导览',summary:'从虚拟工厂出发，沿源网荷储链路认识多园区融合能源系统。',action:'开始五分钟完整导览',note:'字幕与镜头独立编排，配音尚未生成；产品介绍参数与模型读数分别呈现。'});";
  }
  code=code.replaceAll('三分钟快速认识','三分钟快速预览').replaceAll('完整园区导览','五分钟完整导览');
  code=require('./refinement-build.cjs')(name,code);
  new vm.Script(code,{filename:'exhibition-'+name});return '<script>/* ===== '+name+' ===== */\n'+code+'\n</script>';
 });
 return html.replace('</head>','<style>.visitor-playing #visitorDock.visitor-guide .ttext{white-space:normal;overflow-wrap:anywhere}.visitor-playing.tour-gate-hold #visitorDock{opacity:0;pointer-events:none;transition:opacity .25s}</style></head>');
};
