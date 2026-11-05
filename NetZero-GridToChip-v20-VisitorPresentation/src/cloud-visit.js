/* v16 cloud visits: isolated scenario replay, shared tour entrance and explicit execution gates. */
'use strict';
window.NZ_CLOUD_VISIT=(function(){
  const content=window.NZ_CLOUD_CONTENT,sim=window.NZ_CLOUD_SIMULATION;
  const TIMES=[0,10,22,32,42,76],TOTAL=90;
  const STRATEGY_NAMES={baseline:'原固定顺序调度',renewable:'履约优先调度',delivery:'优先交付'};
  const SIGNALS=[['solar-monitor-upload','wind-monitor-upload'],['chemical-status-upload','factory-status-upload','compute-status-upload'],['communications-energy-noc'],['chemical-status-upload','factory-status-upload'],['energy-command-storage','energy-command-compute','energy-command-chemical','energy-command-factory','chemical-local-pem','factory-local-control'],['chemical-status-upload','factory-status-upload','compute-status-upload']];
  const clone=x=>JSON.parse(JSON.stringify(x)),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=(v,d=1)=>Number.isFinite(v)?v.toLocaleString('zh-CN',{maximumFractionDigits:d,minimumFractionDigits:d}):'—';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),el=id=>document.getElementById(id);
  let api,shell,body,controlsBox,hud,opened=false,tab='tour',mode='catalog',selected=null,strategy='renewable',comparison=null,time=0,paused=false,confirmed=false,waiting=false,loading=0,error='',saved=null,generation=0,poseMove=null,lastPose='',frameNow=null,options={},appliedOptions={},lastPaint=-1,restoreFocus=null,decision='pending',readingStage=-1;
  let strategyPair=null,activeStrategyCase='';
  const storyState=()=>selected==='strategy'&&strategyPair?window.NZ_STRATEGY_STORY.at(time):null;
  const stageIndex=()=>storyState()?.index??Math.min(5,TIMES.reduce((i,t,j)=>time>=t?j:i,0));
  const active=()=>opened&&mode!=='catalog';
  function initDom(){
    shell=document.createElement('section');shell.id='cloudVisit';shell.className='cv-shell';shell.hidden=true;shell.setAttribute('aria-label','云参观');
    shell.innerHTML=`<aside class="cv-panel" id="cvPanel" aria-label="云参观面板"><header class="cv-head"><div><div class="cv-eyebrow">${esc(content.eyebrow)}</div><h2 class="cv-title">云参观</h2></div><button class="cv-close" id="cvClose" aria-label="关闭云参观">×</button></header><div class="cv-tabs" role="tablist" aria-label="参观方式"><button id="cvTourTab" role="tab" data-cv-tab="tour" aria-controls="cvBody">园区导览</button><button id="cvScenariosTab" role="tab" data-cv-tab="scenarios" aria-controls="cvBody">情境演示</button></div><div class="cv-body" id="cvBody" role="tabpanel" tabindex="-1"></div><div class="cv-controls" id="cvControls" hidden></div></aside><aside id="cvHud" class="cv-hud" hidden aria-label="当前参观步骤"></aside>`;
    el('sceneFrame').append(shell);body=el('cvBody');controlsBox=el('cvControls');hud=el('cvHud');
    el('cvClose').addEventListener('click',close);
    shell.addEventListener('click',event=>{
      const button=event.target.closest('button');if(!button)return;
      if(button.dataset.cvTab){if(active())back();tab=button.dataset.cvTab;catalog();return;}
      if(button.dataset.cvStart){start(button.dataset.cvStart);return;}
      if(button.dataset.cvAction){const actions={quick:()=>{close();window.NZ_RECEPTION.start();},tour:tourStart,pause,primary:primaryAction,previous,next,replay,back,preview,execute,repair:repairConditions,details:showDetails};const fn=actions[button.dataset.cvAction];if(fn)fn();}
    });
    shell.addEventListener('change',event=>{
      const input=event.target;
      if(input.id==='cvStrategy')selectStrategy(input.value);
      else if(input.id==='cvSeek')seek(Number(input.value));
      else if(input.dataset.cvParam){options[input.dataset.cvParam]=input.value;markDirty();}
    });
    shell.addEventListener('input',event=>{if(event.target.dataset.cvParam){options[event.target.dataset.cvParam]=event.target.value;markDirty();}});
    shell.querySelector('.cv-tabs').addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();if(active())back();tab=event.key==='Home'?'tour':event.key==='End'?'scenarios':tab==='tour'?'scenarios':'tour';catalog();el(tab==='tour'?'cvTourTab':'cvScenariosTab').focus();});
    // Other park actions first end the isolated replay, then retain their normal action.
    document.addEventListener('click',event=>{
      if(!opened||shell.contains(event.target)||event.target.closest('#btnTour'))return;
      if(event.target.closest('#showCampusFlows,#showCampusLabels,#flowLayers,.layer-label'))return;
      if(event.target.closest('#campusNav,#topbar,#bottomBar,.scene-tools,#labels3d'))close();
    },true);
    const externalInput=event=>{
      if(!opened||shell.contains(event.target)||event.target.closest('#flowLayers,.layer-label'))return;
      if(event.target.closest('#topbar,#bottomBar,#drawer'))close();
    };
    document.addEventListener('change',externalInput,true);
    document.addEventListener('input',externalInput,true);
    document.addEventListener('keydown',event=>{
      if(!opened)return;
      if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();return;}
      if(/INPUT|SELECT|TEXTAREA|BUTTON/.test(event.target.tagName))return;
      if(event.key===' '&&active()){event.preventDefault();event.stopImmediatePropagation();pause();}
      else if(['t','m','r','d'].includes(event.key.toLowerCase())){event.preventDefault();event.stopImmediatePropagation();if(event.key.toLowerCase()==='t')close();}
    },true);
    window.addEventListener('resize',()=>{if(opened)layoutCamera();});
  }
  function ready(a){api=a;initDom();window.NZ_SST_VISIT.ready(a,{back,body,controlsBox,hud,shell,layoutCamera});el('btnTour').textContent='云参观 ▾';el('btnTour').title='园区导览与情境演示';el('btnTour').setAttribute('aria-controls','cloudVisit');el('btnTour').setAttribute('aria-expanded','false');}
  function setOpen(value){opened=value;shell.hidden=!value;document.body.classList.toggle('cv-active',value);el('btnTour').setAttribute('aria-expanded',String(value));api.resize();if(value)layoutCamera();}
  function layoutCamera(){
    if(!opened)return;
    const r=el('sceneFrame').getBoundingClientRect(),panel=el('cvPanel').getBoundingClientRect();
    if(active()&&r.width>700)api.camera.setViewOffset(r.width,r.height,panel.width/2,0,r.width,r.height);
    else if(mode==='sst'&&r.width<=700)api.camera.setViewOffset(r.width,r.height,0,panel.height/2,r.width,r.height);
    else api.camera.clearViewOffset();
    api.camera.updateProjectionMatrix();
  }
  async function open(value='tour'){
    if(window.NZ_RECEPTION?.isActive())await window.NZ_RECEPTION.stop();if(!api)return;restoreFocus=document.activeElement;stopReplay();api.exitTour();api.closeDrawer();api.closeInfo();if(window.GOBI_DCDT)window.GOBI_DCDT.close();tab=value==='scenarios'?'scenarios':'tour';mode='catalog';setOpen(true);catalog();el(tab==='tour'?'cvTourTab':'cvScenariosTab').focus();
  }
  function toggle(){if(opened)close();else open();}
  function setTabs(){for(const name of ['tour','scenarios']){const b=el(name==='tour'?'cvTourTab':'cvScenariosTab');b.setAttribute('aria-selected',String(tab===name));b.tabIndex=tab===name?0:-1;}body.setAttribute('aria-labelledby',tab==='tour'?'cvTourTab':'cvScenariosTab');}
  function catalog(){
    setTabs();controlsBox.hidden=true;hud.hidden=true;body.scrollTop=0;
    if(tab==='tour'){
      body.innerHTML=`<p class="cv-intro">${esc(content.intro)}</p><article class="cv-card cv-quick-card"><div class="cv-card-top"><span class="cv-tag">推荐首次观看</span><small>约 03:00</small></div><h3>三分钟快速认识</h3><p>关键产品、一次协同事件与 SST 演进摘要。</p><button class="cv-btn cv-btn-primary cv-btn-block" data-cv-action="quick">开始三分钟接待路线</button></article><article class="cv-card"><div class="cv-card-top"><span class="cv-tag">完整导览</span><small>约 ${window.NZ_TOUR_NARRATIVE.clock(api.NARRATION.totalSeconds)}</small></div><h3>${esc(content.tour.title)}</h3><p>${esc(content.tour.summary)}</p><p class="cv-intro" style="margin-top:12px">包含数据中心楼内设备参观。</p><button class="cv-btn cv-btn-primary cv-btn-block" data-cv-action="tour">${esc(content.tour.action)}</button></article><p class="cv-intro">${esc(content.tour.note)}</p><div class="cv-goal"><strong>也可以跟随一个事件参观</strong>切换“情境演示”，看风光变化后，各园区怎样协调能源与任务。</div>`;
    }else{
      body.innerHTML=`<p class="cv-intro">三个协同主题与一个装备主题。从一个变化出发，理解园区如何回应。</p>`+content.scenarios.map(c=>`<button class="cv-card" data-cv-start="${c.id}"><span class="cv-card-top"><span class="cv-card-number">${c.number}</span><span class="cv-tag">${esc(c.tag)}</span></span><span class="cv-card-title">${esc(c.title)}</span><span class="cv-card-summary">${esc(c.summary)}</span><span class="cv-card-action">约 ${c.durationSeconds||90} 秒 · 自动播放，可暂停</span></button>`).join('')+`<p class="cv-boundary">${esc(content.commonBoundary)}</p>`;
    }
  }
  function capture(){
    if(saved)return;saved={state:clone(api.S),camera:api.camera.position.toArray(),target:api.controls.target.toArray(),view:api.camera.view?clone(api.camera.view):null,autoRotate:api.controls.autoRotate,enabled:api.controls.enabled,damping:api.controls.enableDamping,visual:window.NZ_VISUAL.state()};
    api.S.running=false;api.cancelCamera();api.controls.autoRotate=false;api.controls.enableDamping=false;api.controls.enabled=false;el('btnRun').textContent='情境参观中';document.body.classList.add('cv-running');window.NZ_VISITOR_VIEW?.enter({owner:'cloud',freeze:false});api.resize();
  }
  function stopReplay(){
    shell.classList.remove('cv-playing');document.body.classList.remove('green-compute-playing','scenario-dashboard-playing','strategy-pair-playing');if(typeof LABELS3D!=='undefined')Object.values(LABELS3D).forEach(l=>l.el.classList.remove('gc-response'));
    if(mode==='sst')window.NZ_SST_VISIT.stop();window.NZ_VISITOR_VIEW?.exit('cloud');decision='pending';
    generation++;poseMove=null;lastPose='';comparison=null;strategyPair=null;activeStrategyCase='';frameNow=null;waiting=false;confirmed=false;error='';
    if(window.NZ_FLOWS)window.NZ_FLOWS.clearNarrativeSignals();
    if(saved){
      for(const key of Object.keys(api.S))if(!(key in saved.state))delete api.S[key];Object.assign(api.S,clone(saved.state));
      api.controls.autoRotate=saved.autoRotate;api.controls.enableDamping=saved.damping;api.controls.enabled=saved.enabled;
      api.camera.position.fromArray(saved.camera);api.controls.target.fromArray(saved.target);
      if(saved.view&&saved.view.enabled)api.camera.setViewOffset(saved.view.fullWidth,saved.view.fullHeight,saved.view.offsetX,saved.view.offsetY,saved.view.width,saved.view.height);else api.camera.clearViewOffset();
      window.NZ_VISUAL.restore(saved.visual);
      saved=null;api.refreshPresentation();
    }
    document.body.classList.remove('cv-running');mode='catalog';paused=false;time=0;api.resize();
  }
  function close(){if(!api||!opened)return;stopReplay();setOpen(false);api.resize();el('btnTour').textContent='云参观 ▾';(restoreFocus&&restoreFocus.isConnected?restoreFocus:el('btnTour')).focus();}
  function back(){stopReplay();tab='scenarios';catalog();layoutCamera();el('cvScenariosTab').focus();}
  function tourStart(){close();api.startTour();}
  async function start(id){
    if(window.NZ_RECEPTION?.isActive())await window.NZ_RECEPTION.stop();const c=content.scenarios.find(s=>s.id===id);if(!c)throw Error('未知参观情境');
    if(!opened)setOpen(true);if(saved)stopReplay();api.exitTour();api.closeDrawer();api.closeInfo();capture();
    selected=id;tab='scenarios';strategy='renewable';if(id==='sst'){mode='sst';setTabs();layoutCamera();await window.NZ_SST_VISIT.start();layoutCamera();return;}
    const meta=sim.listScenarios().find(s=>s.id===id);options={initialSoc:id==='strategy'?35:meta.initial.soc,gridLimitMW:id==='strategy'?250:meta.initial.importLimitMW,pricePerKWh:''};time=0;confirmed=false;waiting=false;paused=false;
    window.NZ_VISUAL.clear();await calculate(true);
  }
  function readOptions(){
    const initialSoc=Number(options.initialSoc),gridLimitMW=Number(options.gridLimitMW),priceText=String(options.pricePerKWh??'').trim(),pricePerKWh=priceText===''?null:Number(priceText);
    if(String(options.initialSoc).trim()===''||!Number.isFinite(initialSoc)||initialSoc<10||initialSoc>95)throw Error('初始 SOC 请输入 10–95%。');
    if(String(options.gridLimitMW).trim()===''||!Number.isFinite(gridLimitMW)||gridLimitMW<0||gridLimitMW>api.cfg.GRID.importLimitMW)throw Error('购电通道上限应在 0–'+api.cfg.GRID.importLimitMW+' MW 之间。');
    if(pricePerKWh!==null&&(!Number.isFinite(pricePerKWh)||pricePerKWh<0||pricePerKWh>1000000))throw Error('请输入有效的演示电价，或留空。');
    return {initialSoc,gridLimitMW,pricePerKWh,strategy};
  }
  async function calculate(begin){
    let requested;try{requested=readOptions();}catch(e){error=e.message;renderError();return false;}
    const job=++generation;mode='loading';loading=0;paused=true;error='';renderLoading();
    try{
      if(window.GOBI_DCDT)await window.GOBI_DCDT.close();if(job!==generation)return false;
      let result;
      if(selected==='strategy'){
        const pair={};for(const [k,preset]of Object.entries(window.NZ_STRATEGY_STORY.cases)){
          pair[k]=await sim.compareAsync(selected,{...requested,...preset,onProgress:p=>{if(job===generation){loading=(k==='success'?0:.5)+p*.5;const x=el('cvLoad');if(x)x.textContent=n(loading*100,0)+'%';}},yield:()=>new Promise(r=>setTimeout(r,0))});
          if(job!==generation)return false;
        }
        strategyPair=pair;activeStrategyCase='success';result=pair.success;requested={...requested,...window.NZ_STRATEGY_STORY.cases.success};options={...requested};
      }else result=await sim.compareAsync(selected,{...requested,onProgress:p=>{if(job===generation){loading=p;const x=el('cvLoad');if(x)x.textContent=n(p*100,0)+'%';}},yield:()=>new Promise(r=>setTimeout(r,0))});
      if(job!==generation)return false;
      comparison=result;appliedOptions=requested;time=selected==='strategy'?0:begin?0:22;confirmed=false;waiting=false;paused=false;decision='pending';mode='playing';lastPose='';frameNow=result.candidate.frames[0];mapFrame(frameNow);renderRun();layoutCamera();setCamera(false);signal();paint(true);body.focus({preventScroll:true});return true;
    }catch(e){if(job!==generation)return false;error=e.message;mode='error';paused=true;renderError();return false;}
  }
  function renderLoading(){
    setTabs();controlsBox.hidden=true;hud.hidden=true;
    body.innerHTML=`<div class="cv-toolbar"><span class="cv-badge">仿真情境</span><button class="cv-btn" data-cv-action="back">返回选择</button></div><h3 class="cv-section-title">正在推演候选方案 <span id="cvLoad">0%</span></h3><p class="cv-intro">使用相同的初始库存、任务需求与风光轨迹，计算供电、任务交付和生产代价。</p><p class="cv-boundary">退出参观后，将回到原来的园区进度。</p>`;body.focus({preventScroll:true});
  }
  function renderError(){
    if(mode!=='playing'){mode='error';controlsBox.hidden=true;body.innerHTML=`<div role="alert" class="cv-boundary">${esc(error)}</div><button class="cv-btn" data-cv-action="back">返回选择</button>`;}
    else{const e=el('cvNotice');if(e)e.textContent=error;}
  }
  function scenario(){const c=content.scenarios.find(c=>c.id===selected);return selected==='strategy'?{...c,steps:window.NZ_STRATEGY_STORY.steps}:c;}
  function renderRun(){
    shell.classList.add('cv-playing');document.body.classList.toggle('green-compute-playing',selected==='green-compute');document.body.classList.add('scenario-dashboard-playing');document.body.classList.toggle('strategy-pair-playing',selected==='strategy');readingStage=-1;
    const c=scenario();setTabs();body.scrollTop=0;controlsBox.hidden=false;hud.hidden=false;
    body.innerHTML=`<div class="cv-toolbar"><span class="cv-badge">仿真情境 · 独立参观</span><button class="cv-btn" data-cv-action="back">返回选择</button></div><h3 class="cv-card-title">${esc(c.title)}</h3><p class="cv-intro">${esc(c.goal)}</p><div class="cv-task"><div class="cv-task-top"><span id="cvStageNumber"></span><span id="cvStatus" role="status"></span></div><h3 id="cvStageTitle"></h3><p id="cvStageText"></p></div><div id="cvWeather" class="cv-weather"></div><div class="cv-metric-grid" id="cvLive"></div><div id="cvGate" class="cv-goal" hidden></div><button id="cvExecute" class="cv-btn cv-btn-primary cv-btn-block" data-cv-action="execute">执行此方案</button><div id="cvNotice" class="cv-notice" role="status"></div><div id="cvOutcome" class="cv-outcome" hidden></div><details class="cv-details" id="cvDecisions"><summary>各园区反馈与判断依据</summary><div class="cv-agent-grid" id="cvAgents"></div><div class="cv-trace" id="cvReason"></div></details><details class="cv-details" id="cvTaskDetails"><summary>算力任务排班与交付</summary><p class="cv-intro">关键在线服务优先；批任务以等效 IT 工作量表示，保留延期、缺供和截止期限记录。</p><div id="cvWorkloadChart" class="cv-weather"></div><div id="cvTasks"></div><div class="cv-trace" id="cvCritical"></div></details><details class="cv-details" id="cvCompareDetails"><summary>策略推演与结果对比</summary><p class="cv-intro">${esc(content.strategyNote)}</p><label class="cv-field">候选策略<select id="cvStrategy">${sim.strategies().map(s=>`<option value="${s.id}"${s.id===strategy?' selected':''}>${esc(s.name)}</option>`).join('')}</select></label><div class="cv-parameters"><label class="cv-field">初始储能 SOC · %<input data-cv-param="initialSoc" type="number" min="10" max="95" step="1" value="${esc(options.initialSoc)}"></label><label class="cv-field">购电通道上限 · MW<input data-cv-param="gridLimitMW" type="number" min="0" max="${api.cfg.GRID.importLimitMW}" step="10" value="${esc(options.gridLimitMW)}"></label><label class="cv-field">演示电价 · 元/kWh<input data-cv-param="pricePerKWh" type="number" min="0" step="0.01" placeholder="可留空" value="${esc(options.pricePerKWh)}"></label></div><button class="cv-btn cv-btn-block" id="cvPreview" data-cv-action="preview">按当前条件重新推演</button><div id="cvResults"></div><div id="cvChecks" class="cv-trace"></div><div id="cvSolver" class="cv-boundary"></div></details><details class="cv-details"><summary>参观步骤</summary><ol class="cv-timeline">${c.steps.map((s,i)=>`<li class="cv-step" id="cvStep${i}"><span class="cv-step-title">${esc(s.title)}<small>${content.stages[i].title}</small></span><p>${esc(s.text)}</p></li>`).join('')}</ol></details><details class="cv-details"><summary>本次过程记录</summary><div class="cv-trace" id="cvEvents"></div></details><p class="cv-boundary">${esc(c.boundary)}<br>${esc(content.commonBoundary)}<br>此处采用预设风光情境；计算不包含电磁暂态、潮流或 N−1 验证。</p>`;
    controlsBox.innerHTML=`<div class="cv-progress-label"><span id="cvProgressText"></span><span>约 90 秒 · 可暂停</span></div><input id="cvSeek" type="range" min="0" max="${TOTAL}" step="0.1" value="0" aria-label="情境演示进度"><div class="cv-control-row"><button class="cv-btn" data-cv-action="previous" id="cvPrev">上一步</button><button class="cv-btn cv-btn-primary" data-cv-action="primary" id="cvPause">暂停</button><button class="cv-btn" data-cv-action="next" id="cvNext">下一步</button><button class="cv-btn" data-cv-action="replay" id="cvReplay">重播</button></div>`;
    hud.innerHTML=`<div class="cv-hud-top"><span id="cvHudStage"></span><button class="cv-btn" data-cv-action="details">查看判断依据</button></div><h3 class="cv-hud-title" id="cvHudTitle"></h3><p id="cvHudText"></p><div class="cv-progress"><span id="cvHudProgress"></span></div>`;
    el('cvCompareDetails').open=false;el('cvTaskDetails').open=false;
    if(selected==='strategy'){el('cvStrategy').disabled=true;for(const x of body.querySelectorAll('[data-cv-param]'))x.disabled=true;el('cvPreview').hidden=true;}
    renderResults();lastPaint=-1;
  }
  function syncStrategyCase(){
    const story=storyState();if(!story||story.caseId===activeStrategyCase)return;
    activeStrategyCase=story.caseId;comparison=strategyPair[activeStrategyCase];options={...options,...window.NZ_STRATEGY_STORY.cases[activeStrategyCase]};appliedOptions={...options,strategy};decision='pending';confirmed=false;lastPose='';readingStage=-1;
    if(el('cvResults'))renderResults();
  }
  function selectedFrame(){
    syncStrategyCase();
    if(!comparison)return null;const frames=comparison.candidate.frames,duration=comparison.scenario.durationSeconds;
    const story=storyState(),t=story?story.fraction*duration:time<42?0:time>=76?duration:(time-42)/34*duration;
    let low=0,high=frames.length-1;while(low<high){const mid=Math.ceil((low+high)/2);if(frames[mid].elapsed<=t)low=mid;else high=mid-1;}return frames[low];
  }
  function mapFrame(frame){
    if(!frame||!saved)return;const protectedKeys=new Set(['region','scenario','seed']);
    for(const [key,value]of Object.entries(frame.state))if(!protectedKeys.has(key))api.S[key]=typeof value==='object'?clone(value):value;
    api.S.running=false;
  }
  function conditionsCurrent(){try{return JSON.stringify(readOptions())===JSON.stringify(appliedOptions);}catch(e){return false;}}
  function executable(){return comparison&&conditionsCurrent()&&comparison.candidate.constraints.every(c=>c.pass)&&comparison.basis.sameInitial&&comparison.basis.sameTasks&&comparison.basis.sameWeather;}
  function markDirty(){confirmed=false;paused=true;waiting=true;if(mode==='playing'){const note=el('cvNotice');if(note)note.textContent='条件已修改，请重新推演后再执行。';el('cvExecute').disabled=true;signal();}}
  async function selectStrategy(value){if(selected==='strategy'||!['baseline','renewable','delivery'].includes(value))return false;strategy=value;markDirty();return true;}
  async function preview(){if(!selected)return false;return calculate(false);}
  function execute(){
    if(mode!=='playing'||!comparison)return false;
    if(!conditionsCurrent()){try{readOptions();el('cvNotice').textContent='请先按当前条件重新推演。';}catch(e){el('cvNotice').textContent=e.message;}return false;}
    if(!executable()){el('cvNotice').textContent='候选方案未满足保供或交付边界，请调整条件后重新推演。';el('cvCompareDetails').open=true;return false;}
    confirmed=true;waiting=false;paused=false;if(time<42)time=42;lastPose='';paint(true);return true;
  }
  async function repairConditions(){options.gridLimitMW=Math.min(400,api.cfg.GRID.importLimitMW);options.initialSoc=55;return calculate(false);}
  function autoDecision(){
    syncStrategyCase();const story=storyState();if(story){if(story.index===0||story.index===3){decision='pending';confirmed=false;return;}confirmed=!!executable();decision=confirmed?'executed':'constrained';waiting=false;return;}
    if(time<42){decision='pending';confirmed=false;return;}if(decision!=='pending')return;
    confirmed=!!executable();decision=confirmed?'executed':'constrained';waiting=false;
  }
  function primaryAction(){if(waiting&&!conditionsCurrent())return preview();return pause();}
  function pause(){if(mode==='sst')return window.NZ_SST_VISIT.pause();if(mode!=='playing')return false;if(time>=TOTAL)return replay();paused=!paused;signal();paint(true);return paused;}
  function seek(value){if(mode!=='playing'||!Number.isFinite(value))return false;time=clamp(value,0,TOTAL);decision='pending';autoDecision();if(time>=TOTAL)paused=true;lastPose='';frameNow=selectedFrame();mapFrame(frameNow);setCamera(true);paint(true);signal();return true;}
  function next(){const i=stageIndex();return seek(i<5?(selected==='strategy'?window.NZ_STRATEGY_STORY.starts:TIMES)[i+1]+.01:TOTAL);}
  function previous(){const i=stageIndex();return seek((selected==='strategy'?window.NZ_STRATEGY_STORY.starts:TIMES)[Math.max(0,i-1)]);}
  function replay(){if(!comparison)return false;decision='pending';confirmed=false;waiting=false;paused=false;time=0;poseMove=null;lastPose='';frameNow=selectedFrame();mapFrame(frameNow);setCamera(false);paint(true);signal();return true;}
  function showDetails(){el('cvDecisions').open=true;el('cvDecisions').scrollIntoView({block:'nearest'});}
  function signal(){if(!active()||!comparison)return;const i=stageIndex(),exec=storyState()?.execution??(i===4),index=Math.floor((frameNow?.elapsed||0)/300);let routes=SIGNALS[i];if(exec&&(!confirmed||Math.floor(time)%8>=5))routes=['chemical-status-upload','factory-status-upload','compute-status-upload'];if(exec&&confirmed){const frames=comparison.candidate.frames,j=frames.findIndex(f=>f.elapsed===frameNow?.elapsed),before=frames[Math.max(0,j-1)],now=frameNow;routes=['compute-status-upload'];if(now&&before&&Math.abs((now.command?.batchMW||0)-(before.command?.batchMW||0))>.5)routes.push('energy-command-compute');if(now&&before&&Math.abs(now.state.stP-before.state.stP)>.5)routes.push('energy-command-storage');if(now&&before&&Math.abs(now.state.factory-before.state.factory)>.5)routes.push('energy-command-factory');if(now&&before&&(Math.abs(now.state.h2P-before.state.h2P)>.5||Math.abs(now.state.metal-before.state.metal)>.5))routes.push('energy-command-chemical');}
    window.NZ_FLOWS.setNarrativeSignals({eventId:selected+':'+(storyState()?.caseId||'')+':'+content.stages[i].id+':'+index,routeIds:routes,paused:paused||mode!=='playing'});}
  function setCamera(instant){
    if(!active()||!comparison)return;const i=stageIndex(),part=i===4?Math.floor((time-42)/12):0,key=i+':'+part;if(key===lastPose)return;lastPose=key;
    const home=api.TOUR_HOME,dx=home.pos.map((v,j)=>v-home.tgt[j]),len=Math.hypot(...dx),unit=dx.map(v=>v/len);let target,dist;
    if(selected==='strategy'&&storyState()?.execution){target=[150,6,15];dist=220;}else if(i===0){target=[-90,3,65];dist=320;}else if(i===1||i===5){target=[55,1,-65];dist=660;}else if(i===2||i===3){target=[28,2,25];dist=190;}else if(selected==='green-compute'||part===0){target=[150,6,15];dist=175;}else if(part===1){target=[222,2,-195];dist=225;}else{target=[43,2,29];dist=170;}
    const pos=target.map((v,j)=>v+unit[j]*dist);
    if(instant||api.S.reduceMotion){api.camera.position.fromArray(pos);api.controls.target.fromArray(target);poseMove=null;return;}
    poseMove={t:0,dur:i===1||i===5?5.5:4.5,from:api.camera.position.toArray(),look:api.controls.target.toArray(),pos,target};
  }
  function cameraTick(dt){if(!poseMove)return;const p=poseMove;p.t=Math.min(p.dur,p.t+dt);const a=p.t/p.dur,k=a*a*(3-2*a);api.camera.position.fromArray(p.from.map((v,j)=>v+(p.pos[j]-v)*k));api.controls.target.fromArray(p.look.map((v,j)=>v+(p.target[j]-v)*k));if(p.t>=p.dur)poseMove=null;}
  function tick(dt){
    if(mode==='sst'){window.NZ_SST_VISIT.tick(dt);return;}
    if(!active()||mode!=='playing'||paused)return;
    time=Math.min(TOTAL,time+dt);autoDecision();
    if(time>=TOTAL)paused=true;frameNow=selectedFrame();mapFrame(frameNow);setCamera(false);if(!paused)cameraTick(dt);signal();paint(false);
  }
  function put(id,text){const x=el(id);if(x&&x.textContent!==text)x.textContent=text;}
  function paint(force){
    if(mode!=='playing'||!comparison)return;const i=stageIndex(),c=scenario(),s=c.steps[i],f=frameNow||selectedFrame();if(!f)return;if(readingStage!==i){readingStage=i;body.scrollTop=0;}
    const stamp=Math.floor(time*4);if(!force&&lastPaint===stamp)return;lastPaint=stamp;
    put('cvStageNumber',String(i+1).padStart(2,'0')+' / 06 · '+content.stages[i].title);put('cvStatus',time>=TOTAL?(confirmed?'执行与复盘完成':'约束复盘完成'):paused?'已暂停':decision==='constrained'?'受约束 · 预测回放':'自动演示中');put('cvStageTitle',i===4&&!confirmed?'方案受限：查看预测后果':s.title);put('cvStageText',i===5?('候选方案：批任务完成 '+comparison.candidate.summary.completed+' 项，关键服务未交付 '+n(comparison.candidate.summary.criticalMissedMWh,2)+' MWh；购电 '+n(comparison.candidate.summary.gridBuyMWh,2)+' MWh，末态储能 SOC '+n(comparison.candidate.summary.socEnd)+'%。详细对比同时保留库存与交付代价。'):i===4&&!confirmed?'本次候选方案未满足模型边界，未发送执行指令。当前回放展示预测后果，随后自动复盘缺供、任务与库存代价。':s.text);put('cvHudStage','情境参观 · '+content.stages[i].title);put('cvHudTitle',s.title);put('cvHudText',s.text);el('cvHudProgress').style.width=n(time/TOTAL*100,1).replace(/,/g,'')+'%';put('cvProgressText',n(time,1)+' / '+TOTAL+' 秒');el('cvSeek').value=time;put('cvPause',time>=TOTAL?'重播':waiting&&!confirmed?(!conditionsCurrent()?'重新推演':executable()?'执行方案':'查看约束'):paused?'继续':'暂停');
    for(let j=0;j<6;j++)el('cvStep'+j).dataset.state=j===i?'active':j<i?'done':'pending';
    drawWeather(f);drawWorkload(f);
    const q=f.queue,summary=f.summary;
    const story=storyState(),displayStage=story?(story.execution?4:story.review?5:0):i;
    let greenDashboard=selected==='green-compute'?window.NZ_GREEN_VIEW.present(comparison,f,i):window.NZ_SCENARIO_VIEW.cloud(selected,comparison,f,displayStage,confirmed);
    if(story){greenDashboard=window.NZ_STRATEGY_STORY.decorate(greenDashboard,strategyPair,time);put('cvStageNumber',String(i+1).padStart(2,'0')+' / 06 · '+(['条件','成功回放','成功复盘','切换条件','受限回放','综合复盘'][i]));put('cvStageTitle',s.title);put('cvStageText',s.text);put('cvStatus',paused?'已暂停':time>=90?'演示完成':story.execution?(confirmed?'已校核执行':'受约束预测回放'):'自动演示中');}
    if(greenDashboard){if(selected==='green-compute'&&i===4&&confirmed)put('cvStageText',greenDashboard.action);if(typeof LABELS3D!=='undefined')for(const [key,l]of Object.entries(LABELS3D))l.el.classList.toggle('gc-response',(story?.execution??(i===4))&&confirmed&&(['wind','solar','dc'].includes(key)||key==='storage'&&Math.abs(f.state.stP)>.1||key==='substation'&&f.state.gridBuy>.1));}
    el('cvLive').innerHTML=[['当前储能 SOC',n(f.state.soc),'%'],['当前购电',n(f.state.gridBuy),'MW'],['已交付批任务',q.completed+' / '+q.total,'项']].map(([a,b,c])=>'<div class="cv-metric"><span class="cv-metric-label">'+a+'</span><span class="cv-metric-value">'+b+'<small>'+c+'</small></span></div>').join('');
    el('cvAgents').innerHTML=f.agents.map(a=>`<div class="cv-agent" data-state="${i===1||s.agent===a.id||i===4?'active':'done'}"><div class="cv-agent-head"><span class="cv-agent-name">${esc(a.name)}</span><span class="cv-agent-state">${i<4?'反馈':'回执'}</span></div><p>${esc(a.value)}</p></div>`).join('');
    el('cvReason').innerHTML=`<div><b>风光情境：</b>风电 ${n(f.state.windMW)} MW，光伏 ${n(f.state.solarMW)} MW</div><div><b>任务安排：</b>${esc(f.command?.reason||'读取初始队列与设备状态')}</div><div><b>请求 / 实际交付：</b>批任务 ${n(f.command?.batchMW||0)} / ${n(f.command?.batchDeliveredMW||0)} MW</div><div><b>约束：</b>关键在线服务优先；制造保安负荷、储氢及合成氨运行边界持续核算。</div>`;
    const tasks=(f.tasks||comparison.candidate.tasks).filter(t=>t.type==='batch');
    el('cvTasks').innerHTML=tasks.map(t=>{const pct=clamp(t.processedMWh/t.workMWh*100,0,100),status=t.completedAt!==null?(t.lateCompleted?'逾期完成':'已完成'):f.elapsed<t.releaseSeconds?'尚未到达':t.deadlineMissed?'超过期限':t.processedMWh>0?'处理中':'等待安排';return `<article class="cv-task"><div class="cv-task-top"><span>${esc(t.name)}</span><span>${status}</span></div><div>${n(t.processedMWh,2)} / ${n(t.workMWh,2)} MWh 等效 IT 工作量</div><div class="cv-task-track"><span class="cv-task-fill" style="width:${pct.toFixed(2)}%"></span></div><small>到达 ${n(t.releaseSeconds/60,0)} 分钟 · 截止 ${n(t.deadlineSeconds/60,0)} 分钟 · 并行上限 ${n(t.capacityMW,0)} MW</small></article>`;}).join('');
    put('cvCritical','关键在线服务：'+n(q.criticalMW,0)+' MW；实际处理 '+n(q.criticalProcessedMWh,2)+' MWh；未交付 '+n(q.criticalMissedMWh,2)+' MWh。任务工作量用于情境排班，不能直接换算成实测 Token 吞吐。');
    const gate=el('cvGate'),button=el('cvExecute');button.hidden=true;gate.hidden=selected==='strategy'||i<3;
    if(!gate.hidden){const failed=comparison.candidate.constraints.filter(c=>!c.pass).map(c=>c.label);gate.innerHTML=executable()?'<strong>已通过本模型边界检查</strong>到执行阶段自动回放已校核方案，随后说明结果与代价。':'<strong>候选方案受约束</strong>'+esc(failed.join('、'))+'未满足。未发送执行指令，将自动完成预测复盘；初始条件保持不变。';}
    const outcome=el('cvOutcome');outcome.hidden=i!==5;
    if(i===5&&!greenDashboard&&!outcome.dataset.scrolled){outcome.dataset.scrolled='true';outcome.scrollIntoView({block:'start',behavior:api.S.reduceMotion?'auto':'smooth'});}
    window.NZ_VISITOR_VIEW?.update({owner:'cloud',title:i===4&&!confirmed?'受约束方案 · 预测回放':s.title,context:['green-compute','strategy'].includes(selected)?'overview':i===0?'wind':'overview',labels:selected==='green-compute'?['wind','solar','storage','dc','substation']:i===0?['wind','solar']:['storage','dc','factory','nh3'],flows:i===0?['power']:['power','data','control'],scope:'协同方案能力 · '+n(comparison.scenario.durationSeconds/3600,0)+' 小时预设推演',greenDashboard,metrics:[{label:'候选方案状态',value:time<42?'自动校核中':confirmed?'已校核执行':'受约束推演',note:'SOC '+options.initialSoc+'%；购电上限 '+options.gridLimitMW+' MW'},{label:'供电与交付',value:n(f.state.gridBuy)+' MW 购电',note:'批任务 '+q.completed+' / '+q.total+' 项'},{label:'当前储能 SOC',value:n(f.state.soc),unit:'%',note:'库存与交付代价同时保留'}]});
    const records=comparison.candidate.events.filter(e=>e.elapsed<=f.elapsed).slice(-6);el('cvEvents').innerHTML=records.map(e=>`<div><b>+${n(e.elapsed/60,1)} 分钟</b> ${esc(e.text)}</div>`).join('')||'等待本次情境开始。';

  }
  function drawWeather(f){
    const leg=comparison.candidate,weather=leg.basis.weather,duration=comparison.scenario.durationSeconds,W=320,H=96,x=t=>26+t/duration*280,y=v=>76-v/600*60;
    const path=key=>weather.map((w,i)=>(i?'L':'M')+x(w.at).toFixed(1)+','+y(w[key]).toFixed(1)).join(' '),cursor=x(f.elapsed);
    el('cvWeather').innerHTML=`<div class="cv-chart-title">预设风光轨迹 <span>— 风电　<span style="color:#b3832c">— 光伏</span> · MW</span></div><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="相同风光轨迹及当前回放位置"><path d="M26 16V76H306" fill="none" stroke="#d6e4df"/><text x="2" y="20">600</text><text x="10" y="80">0</text><path d="${path('windMW')}" fill="none" stroke="#228d82" stroke-width="2"/><path d="${path('solarMW')}" fill="none" stroke="#b3832c" stroke-width="2"/><path d="M${cursor} 15V78" stroke="#68827a" stroke-dasharray="3 3"/><text x="26" y="93">起点</text><text x="272" y="93">+${n(duration/3600,0)} 小时</text></svg>`;
  }
  function drawWorkload(f){
    const leg=comparison.candidate,duration=comparison.scenario.durationSeconds,tasks=(f.tasks||leg.tasks).filter(t=>t.type==='batch'),x=t=>68+t/duration*232;
    const lanes=tasks.map((task,i)=>{const yy=24+i*28,windows=leg.frames.filter(k=>k.elapsed<=f.elapsed&&k.command?.allocations.some(a=>a.id===task.id&&a.actualMW>1e-6)).map(k=>`<rect x="${x(Math.max(0,k.elapsed-60))}" y="${yy}" width="${Math.max(.7,232*60/duration)}" height="8" fill="#258e78"/>`).join('');return `<text x="2" y="${yy+7}">${esc(task.name)}</text><path d="M${x(task.releaseSeconds)} ${yy+4}H${x(task.deadlineSeconds)}" stroke="#d8e6df" stroke-width="8"/>${windows}<path d="M${x(task.deadlineSeconds)} ${yy-3}v15" stroke="#b9863b"/>`;}).join('');
    el('cvWorkloadChart').innerHTML=`<div class="cv-chart-title">任务执行时段 <span>绿：实际处理 · 灰：可执行窗口</span></div><svg viewBox="0 0 320 116" role="img" aria-label="任务执行时段与截止期限">${lanes}<path d="M${x(f.elapsed)} 14v84" stroke="#68827a" stroke-dasharray="3 3"/><text x="68" y="113">起点</text><text x="260" y="113">+${n(duration/3600,0)} 小时</text></svg><small>执行时段按每分钟状态采样；橙色标线表示截止时间。</small>`;
  }
  function renderResults(){
    const a=comparison.baseline.summary,b=comparison.candidate.summary;
    const rows=[...['zinc','factory'].map(k=>[(k==='zinc'?'电解锌':'制造')+'待完成 · MWh',a.fulfillment.production.find(t=>t.key===k).remaining,b.fulfillment.production.find(t=>t.key===k).remaining]),...['zinc','factory'].map(k=>[(k==='zinc'?'电解锌':'制造')+'逾期 · MWh',a.fulfillment.production.find(t=>t.key===k).overdue,b.fulfillment.production.find(t=>t.key===k).overdue]),['购电量 · MWh',a.gridBuyMWh,b.gridBuyMWh],['弃电量 · MWh',a.curtailMWh,b.curtailMWh],['未供电 · MWh',a.unservedMWh,b.unservedMWh],['消费中可再生占比 · %',a.renewableSharePct,b.renewableSharePct],['末态储能 SOC · %',a.socEnd,b.socEnd],['末态储氢 · kg',a.h2EndKg,b.h2EndKg],['批任务完成 · 项',a.completed,b.completed,0],['批任务剩余 · MWh',a.remainingMWh,b.remainingMWh],['批任务期限违约 · 项',a.deadlineMissed,b.deadlineMissed,0],['关键服务未交付 · MWh',a.criticalMissedMWh,b.criticalMissedMWh],['合成氨产量 · t',a.nh3Tonnes,b.nh3Tonnes]];
    if(a.gridCostYuan!==null)rows.push(['购电费用 · 演示元',a.gridCostYuan,b.gridCostYuan]);
    el('cvResults').innerHTML=`<div class="cv-results-wrap"><table class="cv-results"><caption>本次完整情境推演 · ${n(comparison.scenario.durationSeconds/3600,0)} 小时</caption><thead><tr><th>指标</th><th>固定节奏</th><th>${esc(STRATEGY_NAMES[strategy])}</th><th>差值</th></tr></thead><tbody>${rows.map(([label,x,y,d=2])=>`<tr><td>${label}</td><td>${n(x,d)}</td><td>${n(y,d)}</td><td>${y-x>1e-7?'+':''}${n(y-x,d)}</td></tr>`).join('')}</tbody></table></div><p class="cv-results-note">差值＝候选减基准。此表是完整情境的预演结果；执行阶段的即时数值显示在上方。${a.gridCostYuan===null?'电价未设置，不计算费用。':'费用仅采用设定的演示电价，不含完整运营成本。'}</p>`;
    const outcome=[['发生了什么',comparison.scenario.subtitle||comparison.scenario.title],['系统如何响应','在相同天气、任务与起始库存下，按'+STRATEGY_NAMES[strategy]+'安排储能与负荷；'+(comparison.candidate.constraints.every(c=>c.pass)?'方案通过本模型检查。':'方案受约束，结果为预测后果，未执行。')],['结果与代价','购电 '+n(a.gridBuyMWh,2)+' → '+n(b.gridBuyMWh,2)+' MWh；批任务 '+a.completed+' → '+b.completed+' 项；末态 SOC '+n(a.socEnd)+' → '+n(b.socEnd)+'%；弃电 '+n(b.curtailMWh,2)+' MWh，关键服务未交付 '+n(b.criticalMissedMWh,2)+' MWh。']];el('cvOutcome').innerHTML=outcome.map(([title,text])=>'<article class="cv-result-summary"><b>'+esc(title)+'</b><p>'+esc(text)+'</p></article>').join('')+'<p class="cv-boundary">'+esc(comparison.scenario.durationSeconds/3600+' 小时情境计算；少购电不直接等于节能，库存与交付须同时比较。')+'</p>';
    el('cvChecks').innerHTML='<b>候选方案检查</b>'+comparison.candidate.constraints.map(c=>`<div>${c.pass?'✓':'!'} ${esc(c.label)}${c.value===undefined?'':'：'+n(c.value,Math.abs(c.value)<1e-6?6:2)+' '+esc(c.unit||'')}</div>`).join('')+`<div>${comparison.basis.sameInitial&&comparison.basis.sameWeather&&comparison.basis.sameTasks?'✓':'!'} 相同起点、任务和风光轨迹</div>`;
    const count=b.unconvergedSteps;el('cvSolver').textContent=count?'求解提示：'+count+' 个物理步未达到内核迭代收敛条件；最大功率收支残差 '+n(b.maxPowerResidualMW,6)+' MW。结果作为情境参考，不代表工程验证通过。':'模型收支与业务边界已按上方项目逐项检查；不包含潮流、频率或电磁暂态验证。';
  }
  function audit(){if(mode==='sst')return {open:opened,active:active(),tab,mode,scenario:selected,...window.NZ_SST_VISIT.audit()};return {open:opened,active:active(),tab,mode,scenario:selected,strategy,time,duration:TOTAL,decision,strategyCase:activeStrategyCase||null,strategyPhase:storyState()?.index??null,stage:mode==='playing'?(storyState()?.stage||content.stages[stageIndex()].id):null,paused,waiting,confirmed,loading,error,executable:!!executable(),options:clone(options),appliedOptions:clone(appliedOptions),frame:frameNow?clone(frameNow):null,comparison:comparison?{basis:clone(comparison.basis),baseline:clone(comparison.baseline.summary),candidate:clone(comparison.candidate.summary),delta:clone(comparison.delta)}:null};}
  return {ready,open,close,toggle,start,pause,seek,next,previous,replay,selectStrategy,preview,execute,back,tick,audit,visualReplay:()=>({active:active()&&mode==='playing'&&['green-compute','coordination','strategy'].includes(selected),paused:paused||mode!=='playing'}),isOpen:()=>opened,isActive:active,isPaused:()=>mode==='sst'?window.NZ_SST_VISIT.isPaused():active()&&(paused||mode!=='playing')};
})();
