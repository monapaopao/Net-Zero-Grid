/* A separately narrated 180-second route; the full tour remains available. */
'use strict';
window.NZ_RECEPTION=(function(){
  const M=window.NZ_RECEPTION_MODEL,model=M.compile(window.NZ_RECEPTION_SCRIPT),clamp=M.clamp;
  let api,bar,on=false,paused=false,loading=false,time=0,job=0,inside=false,buildingFailed=false,lastCue='',lastPaint=-1,comparison=null,sstComparison=null,sstPreview=false,notice='',cachedComparison=null;
  const $=id=>document.getElementById(id),clone=x=>JSON.parse(JSON.stringify(x)),fmt=(v,d=1)=>Number(v).toLocaleString('zh-CN',{maximumFractionDigits:d,minimumFractionDigits:d});
  function ready(a){api=a;bar=document.createElement('aside');bar.id='receptionBar';bar.className='visitor-caption';bar.hidden=true;bar.setAttribute('aria-label','三分钟接待路线');bar.innerHTML='<div class="tstep"><span>三分钟快速认识</span><b id="receptionChapter"></b><span id="receptionTime"></span></div><div class="ttitle" id="receptionTitle"></div><div class="ttext" id="receptionText"></div><div class="reception-notice" id="receptionNotice" role="status"></div><div class="tbtns"><button class="iconbtn" data-reception="pause" id="receptionPause">暂停</button><button class="iconbtn" data-reception="previous">上一章</button><button class="iconbtn" data-reception="next">下一章</button><button class="iconbtn" data-reception="exit">退出</button></div><input id="receptionSeek" type="range" min="0" max="180" step="0.1" value="0" aria-label="三分钟路线进度">';document.body.append(bar);
    bar.addEventListener('click',event=>{const action=event.target.closest('[data-reception]')?.dataset.reception;if(action==='pause')pause();if(action==='previous')seek(model.chapters[Math.max(0,M.at(model,time).chapter.index-1)].start);if(action==='next'){const next=M.at(model,time).chapter.index+1;next<model.chapters.length?seek(model.chapters[next].start):finish();}if(action==='exit')stop();});
    $('receptionSeek').addEventListener('change',event=>seek(Number(event.target.value)));
    document.addEventListener('keydown',event=>{if(!on||/INPUT|SELECT|TEXTAREA/.test(event.target.tagName))return;if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();stop();}if(event.code==='Space'&&event.target.tagName!=='BUTTON'){event.preventDefault();event.stopImmediatePropagation();pause();}if(['t','m','r','d'].includes(event.key?.toLowerCase())){event.preventDefault();event.stopImmediatePropagation();if(event.key.toLowerCase()==='t')stop().then(()=>window.NZ_CLOUD_VISIT.open());}},true);
  }
  function resolve(shot){
    if(shot==='home')return api.TOUR_HOME;if(shot==='windClose')return window.NZ_WIND_PRODUCT.pose(0);
    if(shot==='collaboration')return {pos:[480,335,410],tgt:[90,0,-40]};
    if(shot==='sstCharge')return {pos:[63,27,119],tgt:[37,2,85]};
    return window.NZ_TOUR_SCRIPT.shots[shot]||api.TOUR_HOME;
  }
  async function start(){
    if(on)await stop();window.NZ_VISITOR_VIEW.hideEnd();if(window.NZ_CLOUD_VISIT.isOpen())window.NZ_CLOUD_VISIT.close();api.exitTour();api.closeInfo();api.closeDrawer();await window.GOBI_DCDT.close();
    on=true;time=0;paused=false;inside=false;loading=true;buildingFailed=false;notice='正在准备两小时协同推演…';lastCue='';lastPaint=-1;const token=++job;
    window.NZ_VISITOR_VIEW.enter({owner:'reception',freeze:true});api.cancelCamera();api.controls.enabled=false;api.controls.autoRotate=false;api.controls.enableDamping=false;bar.hidden=false;frame(true);
    try{comparison=cachedComparison||await window.NZ_CLOUD_SIMULATION.compareAsync(model.collaboration.id,{...model.collaboration,onProgress:p=>{if(on&&job===token){notice='正在准备协同推演 '+Math.round(p*100)+'%';paint(true);}},yield:()=>new Promise(r=>setTimeout(r,0))});if(!on||job!==token)return;cachedComparison=comparison;sstComparison=window.NZ_SST_SIMULATION.compare();notice='';}
    catch(error){if(!on||job!==token)return;comparison=null;notice='协同计算暂不可用：'+error.message+'。继续展示关系与装备，不显示计算收益。';}
    if(!on||job!==token)return;loading=false;frame(true);
  }
  function excerptTime(){return model.building.from+time-model.building.at;}
  async function openBuilding(){
    if(inside||buildingFailed||!on)return;inside=true;loading=true;const token=++job;notice='正在进入数据中心代表片段…';paint(true);
    try{const ok=await window.GOBI_DCDT.reveal(excerptTime());if(!on||job!==token)return;if(!ok)throw Error('楼内视图暂不可用');window.GOBI_DCDT.playSegment(excerptTime(),model.building.to);window.GOBI_DCDT.setPlaying(!paused);notice='';}
    catch(error){if(!on||job!==token)return;inside=false;buildingFailed=true;window.GOBI_DCDT.close();notice=error.message+'，继续外部供电链路示意。';}
    finally{if(on&&job===token){loading=false;paint(true);}}
  }
  async function leaveBuilding(){
    if(!inside)return;inside=false;loading=true;const token=++job;await window.GOBI_DCDT.close();if(!on||job!==token)return;loading=false;time=model.building.until;notice='';frame(true);
  }
  function cameraFrame(cue){if(cue.inside&&inside)return;const index=model.timeline.indexOf(cue),from=resolve(index?model.timeline[index-1].shot:'home'),to=resolve(cue.shot),u=cue.move?clamp((time-cue.start)/cue.move,0,1):1,k=u*u*(3-2*u);api.camera.position.fromArray(from.pos.map((v,i)=>v+(to.pos[i]-v)*k));api.controls.target.fromArray(from.tgt.map((v,i)=>v+(to.tgt[i]-v)*k));}
  function mapSimulation(chapter){
    if(chapter.id!=='coordination'||!comparison)return null;const progress=clamp((time-chapter.start)/(chapter.end-chapter.start),0,1),f=M.frameAt(comparison.candidate,progress*comparison.scenario.durationSeconds);
    for(const [key,value]of Object.entries(f.state))if(!['region','scenario','seed'].includes(key))api.S[key]=value&&typeof value==='object'?clone(value):value;api.S.running=false;
    const passed=comparison.candidate.constraints.every(c=>c.pass);window.NZ_FLOWS.setNarrativeSignals({eventId:'reception:'+Math.floor(progress*24),routeIds:['energy-command-storage','energy-command-compute','energy-command-chemical','energy-command-factory','compute-status-upload'],paused});
    return {f,passed};
  }
  function metrics(chapter){
    const s=api.S,simulation=mapSimulation(chapter);
    if(chapter.id==='welcome')return [{label:'独立功能园区',value:'数据 · 化工 · 制造',note:'共享能源网络，园区功能独立'},{label:'参观路线',value:'03:00',note:'讲解与精选镜头独立编排'}];
    if(chapter.id==='generation')return [{label:'发电接入',value:'风电＋光伏',note:'经汇集、升压与线路接入'},{label:'关键产品',value:'耐电晕干式变压器',note:'铝绕组 · 陶瓷膜包复合绝缘材料'}];
    if(chapter.id==='compute')return [{label:'IT 负载',value:fmt(s.itMW),unit:'MW',note:'进入本次参观前的园区模型快照'},{label:'楼内代表片段',value:'正常速度',note:'原时间轴 33–62 秒；非倍速播放'},{label:'计量口径',value:'等效推理估算',note:'不代表实测吞吐或实际收入'}];
    if(chapter.id==='factory')return [{label:'连续工艺',value:'放线 → 陶瓷化 → 清洗 → 收线',note:'两列十排半尺寸工位，流程与结构示意'},{label:'智能化控制',value:'速度同步 · 张力监测',note:'工艺状态与批次追溯；不展示未经验证的生产参数'},{label:'能源关系',value:'屋顶光伏＋园区供电',note:'图面设备不增加内核装机或产能'}];
    if(chapter.id==='charging')return [{label:'车辆角色',value:'充电负荷',note:'本演示不从车辆反向取电'},{label:'双向调节',value:'固定储能 ↔ 电网',note:'受运行条件与并网权限约束'}];
    if(chapter.id==='coordination'&&simulation){const {f,passed}=simulation;return [{label:passed?'已校核方案 · 推演回放':'受约束方案 · 预测回放',value:Math.round(f.elapsed/60)+' / 120',unit:'分钟',note:'预设 SOC 55%；购电上限 400 MW'},{label:'供电与任务',value:fmt(f.state.gridBuy)+' MW 购电',note:'批任务完成 '+f.queue.completed+' / '+f.queue.total+' 项'},{label:'库存与交付代价',value:fmt(f.state.soc)+'% SOC',note:'全部结果在完整情境中可进一步核对'}];}
    if(chapter.id==='sst'&&sstComparison){const a=sstComparison.variants.existing.summary,b=sstComparison.variants.sst.summary,c=sstComparison.variants.coordinated.summary;return [{label:'装备比较 A → B · 变换损耗',value:fmt(a.conversionLossMWh,3)+' → '+fmt(b.conversionLossMWh,3),unit:'MWh',note:'两小时代表支路；不是全园区节能率'},{label:'协同比较 B → C · 接入点峰值',value:fmt(b.maxGridImportMW,1)+' → '+fmt(c.maxGridImportMW,1),unit:'MW',note:'相同起点、天气与服务需求'},{label:'库存与弃电代价 B → C',value:fmt(c.batteryEndMWh-b.batteryEndMWh,3),unit:'MWh 末态电池差',note:'弃电差 '+fmt(c.curtailMWh-b.curtailMWh,3)+' MWh；不隐去库存消耗'}];}
    if(chapter.id==='closing')return [{label:'关键产品',value:'干变 · 架空线 · 直流供电'},{label:'系统方案能力',value:'能源共享与算电协同'},{label:'前瞻演进',value:'SST 能源路由'}];
    return [{label:'本章重点',value:chapter.title,note:comparison?'按本次推演说明约束与结果':'计算暂不可用，不显示模拟收益'}];
  }
  function frame(force){if(!on)return;const {cue,chapter}=M.at(model,time),changed=lastCue!==cue.id;if(changed){lastCue=cue.id;window.NZ_WIND_PRODUCT.tour(cue.wind?'windProduct':null);if(chapter.id!=='coordination')window.NZ_FLOWS.clearNarrativeSignals();if(cue.scheme&&window.NZ_SST_VISIT.previewScheme){window.NZ_SST_VISIT.previewScheme(cue.scheme,{explode:0});sstPreview=true;}else if(sstPreview){window.NZ_SST_VISIT.clearPreview();sstPreview=false;}if(chapter.id==='compute'&&!inside&&!buildingFailed)window.GOBI_DCDT.prepare();}
    if(window.NZ_FACTORY)window.NZ_FACTORY.tour(cue.factoryRoof?{mode:cue.factoryMode||'process',open:cue.factoryRoof==='open',paused}:null);
    if(cue.wind)window.NZ_WIND_PRODUCT.tourTime(time-model.chapters[1].start);cameraFrame(cue);paint(force||changed);
  }
  function paint(force){if(!on)return;const stamp=Math.floor(time*4);if(!force&&lastPaint===stamp)return;lastPaint=stamp;const {cue,chapter}=M.at(model,time);
    $('receptionChapter').textContent=String(chapter.index+1).padStart(2,'0')+' / '+String(model.chapters.length).padStart(2,'0');$('receptionTitle').textContent=chapter.title;$('receptionText').textContent=cue.text;$('receptionTime').textContent=window.NZ_TOUR_NARRATIVE.clock(time)+' / 03:00';$('receptionPause').textContent=paused?'继续':'暂停';$('receptionNotice').textContent=notice;$('receptionSeek').value=time;
    window.NZ_VISITOR_VIEW.update({owner:'reception',title:chapter.title,lookKey:chapter.id,context:chapter.context,labels:chapter.labels,flows:chapter.flows,scope:chapter.scope,metrics:metrics(chapter)});bar.dataset.cue=cue.id;
  }
  function tick(dt){if(!on||loading||paused)return;
    if(inside){try{if(window.GOBI_DCDT.isOpen&&!window.GOBI_DCDT.isOpen())throw Error('Closed building');const child=$('dcdtFrame').contentWindow.NZ_BUILDING_TOUR;time=model.building.at+clamp(child.state().time-model.building.from,0,model.building.to-model.building.from);if(time>=model.building.until-.015){leaveBuilding();return;}}catch(error){inside=false;buildingFailed=true;notice='楼内视图中断，继续外部供电链路示意。';}}
    else{const next=Math.min(model.duration,time+dt);if(!buildingFailed&&time<model.building.at&&next>=model.building.at){time=model.building.at;frame(true);openBuilding();return;}time=next;}
    frame(false);if(sstPreview)window.NZ_SST_VISIT.tick(dt);if(time>=model.duration)finish();
  }
  async function seek(value){if(!on||loading||!Number.isFinite(value))return false;job++;const target=clamp(value,0,model.duration);if(inside){inside=false;loading=true;await window.GOBI_DCDT.close();if(!on)return false;loading=false;}time=target;lastCue='';frame(true);if(time>=model.duration){finish();return true;}if(time>=model.building.at&&time<model.building.until&&!buildingFailed)openBuilding();return true;}
  function pause(){if(!on)return false;paused=!paused;frame(true);if(inside)window.GOBI_DCDT.setPlaying(!paused);paint(true);return paused;}
  async function stop(){if(!on)return;on=false;++job;loading=false;inside=false;bar.hidden=true;if(window.NZ_FACTORY)window.NZ_FACTORY.tour(null);window.NZ_WIND_PRODUCT.tour(null);if(sstPreview)window.NZ_SST_VISIT.clearPreview();sstPreview=false;window.NZ_FLOWS.clearNarrativeSignals();await window.GOBI_DCDT.close();window.NZ_VISITOR_VIEW.exit('reception');}
  async function finish(){if(!on)return;const token=job+1;await stop();if(job===token)window.NZ_VISITOR_VIEW.endPage({kind:'reception'});}
  return {ready,start,stop,seek,pause,tick,model,isActive:()=>on,isPaused:()=>on&&(paused||loading),state:()=>({active:on,paused,loading,time,duration:model.duration,inside,buildingFailed,cue:lastCue,notice,computed:!!comparison})};
})();
