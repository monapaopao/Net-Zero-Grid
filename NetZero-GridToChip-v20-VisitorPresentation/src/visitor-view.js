/* Temporary visitor composition. Free exploration preferences are restored on exit. */
'use strict';
window.NZ_VISITOR_VIEW=(function(){
  let api,saved=null,current={},panel,ending,dock,captionCell,lastLabels='';
  const $=id=>document.getElementById(id),clone=x=>JSON.parse(JSON.stringify(x)),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function ready(a){api=a;dock=document.createElement('section');dock.id='visitorDock';dock.hidden=true;dock.setAttribute('aria-label','参观讲解与当前章节重点');captionCell=document.createElement('div');captionCell.className='visitor-dock-caption';dock.append(captionCell);document.body.append(dock);panel=document.createElement('aside');panel.id='visitorMetrics';panel.hidden=true;panel.setAttribute('aria-label','当前章节重点');dock.append(panel);
    ending=document.createElement('section');ending.id='visitorEnding';ending.hidden=true;ending.setAttribute('role','dialog');ending.setAttribute('aria-modal','true');ending.setAttribute('aria-labelledby','visitorEndingTitle');document.body.append(ending);
    ending.addEventListener('click',event=>{const b=event.target.closest('[data-visitor-action]');if(!b)return;hideEnd();const action=b.dataset.visitorAction;if(action==='equipment')api.focus('windNacelle');if(action==='scenarios')window.NZ_CLOUD_VISIT.open('scenarios');if(action==='sst')window.NZ_CLOUD_VISIT.start('sst');if(action==='replay')window.NZ_RECEPTION.start();});
    ending.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();hideEnd();}if(event.key==='Tab'){const items=[...ending.querySelectorAll('button')],first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
  }
  function mountDock(owner){
    const node=$(owner==='cloud'?'cloudVisit':owner==='reception'?'receptionBar':'tourBar');
    const guide=owner==='tour'||owner==='reception';dock.classList.toggle('visitor-guide',guide);
    if(node){const marker=document.createComment('visitor-caption-home');node.before(marker);saved.caption={node,marker};captionCell.append(node);}
    if(guide&&node){const buttons=node.querySelector('.tbtns');if(buttons)buttons.before(panel);else node.append(panel);}
    dock.hidden=false;
  }
  function restoreDock(was){
    dock.append(panel);dock.classList.remove('visitor-guide');
    if(was.caption){const {node,marker}=was.caption;node.classList.remove('visitor-no-look');if(marker.parentNode)marker.replaceWith(node);}
    dock.hidden=true;
  }
  function enter(options={}){
    if(!api)return;if(saved?.owner===options.owner)return;if(saved)exit(saved.owner);hideEnd();
    saved={owner:options.owner,freeze:!!options.freeze,state:options.freeze?clone(api.S):null,camera:api.camera.position.toArray(),target:api.controls.target.toArray(),view:api.camera.view?clone(api.camera.view):null,controls:{enabled:api.controls.enabled,autoRotate:api.controls.autoRotate,enableDamping:api.controls.enableDamping},visual:window.NZ_VISUAL.state(),flows:window.NZ_FLOWS.audit(),factory:window.NZ_FACTORY?.snapshot?.(),focus:document.activeElement};
    if(saved.freeze)api.S.running=false;api.controls.enableDamping=false;window.NZ_VISUAL.restore({...saved.visual,labels:true,flows:true,details:false});document.body.classList.add('visitor-playing');document.body.dataset.visitorOwner=options.owner;mountDock(options.owner);panel.hidden=false;current={owner:options.owner,labels:[],flows:[],metrics:[]};lastLabels='';api.resize();
  }
  const chapterHighlights={
    overview:['风光储与多类负荷联动','能量与信息流','关键装备透视'],welcome:['风光储与多类负荷联动','能量与信息流','关键装备透视'],
    wind:['机舱内部供电链路','汇集线路与升压接入'],solar:['组件阵列与汇集路径','光伏与园区负荷的连接'],generation:['机舱内部供电链路','架空线路与光伏汇集'],
    energy:['汇集、升压与分配路径','园区之间的能源连接'],power:['汇集、升压与分配路径','园区之间的能源连接'],storage:['储能充放电方向','功率转换与站内配套'],
    compute:['供电链路逐级展开','机架、芯片与冷却供回'],chemical:['合成回路与连续管廊','储运配套与生产边界'],hydrogen:['合成回路与连续管廊','储运配套与生产边界'],
    factory:['水平走线与收放线联动','处理、清洗及废液配套','屋顶开合与智能监测'],loads:['连续生产与智能监测','光储充的功率分配'],public:['站内直流母线','固定储能与电网双向调节'],charging:['站内直流母线','固定储能与电网双向调节'],
    nuclear:['独立园区的供能关系','小型模块化反应堆配套'],backup:['燃气轮机的备用角色','供能保障与接入路径'],
    coordination:['供电与任务交付的平衡','储能末态与调节代价'],sst:['原位替代与保留边界','装备变化与协同结果'],closing:['关键产品的应用位置','协同方案与下一代演进']
  };
  function update(options={}){
    if(!saved||options.owner&&saved.owner!==options.owner)return;current={...current,...options};
    if(current.context)window.NZ_FLOWS.context(current.context);
    if(current.flows){const enabled=new Set(current.flows);Object.keys(saved.flows.enabled).forEach(k=>window.NZ_FLOWS.setEnabled(k,enabled.has(k)));window.NZ_FLOWS.setGlobal(enabled.size>0);}
    const guide=saved.owner==='tour'||saved.owner==='reception',rows=(current.metrics||[]).slice(0,3);
    const heading=guide?'':`<div class="visitor-metric-heading"><div class="visitor-metric-title">${esc(current.title||'本章重点')}</div><div class="visitor-scope">${esc(current.scope||'')}</div></div>`;
    let html;
    if(guide){
      const key=current.lookKey||current.context,items=(current.highlights||chapterHighlights[key]||[]).filter(x=>x&&x!==current.title).slice(0,3);
      const facts=['compute','coordination','sst'].includes(key)?rows.filter(m=>m.label!=='本章重点'&&m.value!==current.title):[];
      const note=key==='sst'?'下一代装备方案／前瞻研究演示':key==='coordination'?'多园区协同方案推演':key==='hydrogen'||key==='chemical'?'调节须遵守生产边界':'';
      html='<div class="visitor-look-title">本章看点</div><div class="visitor-look-items">'+items.map(x=>'<span>'+esc(x)+'</span>').join('')+'</div>'+(note?'<small class="visitor-look-note">'+esc(note)+'</small>':'')+'<div class="visitor-look-facts">'+facts.map(m=>'<span>'+esc(m.label)+'：<b>'+esc(m.value)+' '+esc(m.unit||'')+'</b>'+(m.note?'<small>'+esc(m.note)+'</small>':'')+'</span>').join('')+'</div>';
      panel.hidden=!items.length&&!facts.length;panel.parentNode?.classList.toggle('visitor-no-look',panel.hidden);
    }else{html=heading+'<div class="visitor-metric-grid">'+rows.map(m=>`<div class="visitor-metric"><span>${esc(m.label)}${guide?'：':''}</span><strong>${esc(m.value)} <small>${esc(m.unit||'')}</small></strong>${m.note?'<small class="visitor-metric-note">'+(guide?'（':'')+esc(m.note)+(guide?'）':'')+'</small>':''}</div>`).join('')+`</div><div class="visitor-flow-legend">${(current.flows||[]).map(k=>'<span data-kind="'+k+'">'+({power:'电力',data:'数据',control:'调度控制',cooling:'冷却供回',process:'工艺介质',heat:'余热'}[k]||k)+'</span>').join('')}</div>`;panel.hidden=false;}
    panel.classList.toggle('gc-reviewing',!guide&&!!current.greenDashboard?.review);
    if(!guide&&current.greenDashboard)html=current.greenDashboard.html;
    if(panel.innerHTML!==html)panel.innerHTML=html;beforeRender();
  }
  function beforeRender(){if(!saved)return;document.body.classList.toggle('visitor-building',!!window.GOBI_DCDT?.isOpen?.());if(saved.owner==='cloud'&&api.camera.view?.enabled){api.camera.clearViewOffset();api.camera.updateProjectionMatrix();}const allowed=new Set(current.labels||[]),signature=[...allowed].join('|');
    if(typeof LABELS3D!=='undefined')for(const [key,l]of Object.entries(LABELS3D)){l.el.classList.toggle('visitor-muted',!allowed.has(key));const sstOwned=['dc','panamaSc','panamaSc2'].includes(key)&&(document.body.classList.contains('sst-running')||String(current.scope||'').startsWith('SST'));if(allowed.has(key)&&!sstOwned)l.el.classList.remove('layer-hidden');}
    lastLabels=signature;
  }
  function exit(owner){
    if(!saved||owner&&saved.owner!==owner)return;const was=saved;saved=null;panel.hidden=true;restoreDock(was);document.body.classList.remove('visitor-playing','visitor-building');delete document.body.dataset.visitorOwner;
    if(typeof LABELS3D!=='undefined')Object.values(LABELS3D).forEach(l=>l.el.classList.remove('visitor-muted'));
    if(was.freeze){for(const k of Object.keys(api.S))if(!(k in was.state))delete api.S[k];Object.assign(api.S,clone(was.state));}
    window.NZ_VISUAL.restore(was.visual);Object.keys(was.flows.enabled).forEach(k=>window.NZ_FLOWS.setEnabled(k,was.flows.enabled[k]));window.NZ_FLOWS.setGlobal(was.flows.global);window.NZ_FLOWS.context(was.flows.focus);
    if(was.flows.narrative.active)window.NZ_FLOWS.setNarrativeSignals(was.flows.narrative);else window.NZ_FLOWS.clearNarrativeSignals();
    Object.assign(api.controls,was.controls);api.camera.position.fromArray(was.camera);api.controls.target.fromArray(was.target);
    if(was.view?.enabled)api.camera.setViewOffset(was.view.fullWidth,was.view.fullHeight,was.view.offsetX,was.view.offsetY,was.view.width,was.view.height);else api.camera.clearViewOffset();
    if(was.factory)window.NZ_FACTORY?.restore?.(was.factory);
    api.resize();api.refreshPresentation();current={};lastLabels='';
  }
  function endPage(options={}){
    if(!ending)return;ending.innerHTML=`<article class="visitor-end-card"><div class="visitor-scope">${options.kind==='full'?'完整园区导览':'三分钟快速认识'} · 参观完成</div><h2 id="visitorEndingTitle">从关键产品，走向多园区能源协同</h2><p>按您的项目需求，继续了解装备结构、供电关系或协同方案。</p><div class="visitor-end-columns"><div><b>关键产品</b><p>陶瓷基耐电晕干式变压器<br>架空线<br>高效直流供电装备</p></div><div><b>系统方案能力</b><p>能源共享与柔性调度<br>算电协同<br>用量计量与交付核验框架</p></div><div><b>下一代演进</b><p>SST 能源路由<br>原位替代与保留边界<br>方案／前瞻研究演示</p></div></div><p class="visitor-end-note">场景参数与推演结果为模型示意；项目性能与交付范围需结合具体条件确认。</p><div class="visitor-end-actions"><button data-visitor-action="equipment">查看关键装备</button><button data-visitor-action="scenarios">观看协同情境</button><button data-visitor-action="sst">了解 SST 方案</button><button data-visitor-action="replay">三分钟再看一次</button><button data-visitor-action="free">返回自由探索</button></div></article>`;ending.hidden=false;ending.querySelector('button').focus();
  }
  function hideEnd(){if(ending){const visible=!ending.hidden;ending.hidden=true;if(visible)$('btnTour')?.focus();}}
  return {ready,enter,update,exit,beforeRender,endPage,hideEnd,state:()=>({active:!!saved,owner:saved?.owner||null,current:clone(current),ending:!!ending&&!ending.hidden})};
})();
