'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm'),fixture=require('./visitor-fixture.cjs');
const root=path.join(__dirname,'..'),checks=[],check=(name,fn)=>{fn();checks.push(name);console.log('PASS '+name);};
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const css=read('src/visitor-view.css'),build=read('build.cjs'),dcdt=read('src/dcdt.js'),reception=read('src/reception.js'),sst=read('src/sst-visit.js');

function caption(f,owner){
  const make=(tag,kind,text='')=>{const e=f.document.createElement(tag);if(kind)e.classList.add(kind);e.textContent=text;return e;};
  const bar=make('aside'),step=make('div','tstep','参观路线 · 03 / 08 · 00:46 / 03:00'),title=make('div','ttitle','数据中心'),paragraph=make('div','ttext','这里从园区进线，经过变压、整流与稳压，走向机架和芯片；电力、数据与冷却供回共同构成完整供能链路。'),buttons=make('div','tbtns'),progress=make(owner==='tour'?'div':'input',owner==='tour'?'tprog':'');
  bar.id=owner==='tour'?'tourBar':'receptionBar';
  for(const label of ['暂停','上一章','下一章','退出'])buttons.append(make('button','iconbtn',label));
  if(owner==='reception'){progress.id='receptionSeek';progress.setAttribute('type','range');progress.setAttribute('aria-label','三分钟路线进度');}
  bar.append(step,title,paragraph,buttons,progress);f.nodes.get('sceneFrame').append(bar);
  return {bar,step,title,paragraph,buttons,progress,origin:bar.parentNode,originalChildren:[...bar.children]};
}
const metrics=[{label:'IT',value:'150',unit:'MW',note:'代表负载'},{label:'PUE',value:'1.18',unit:'',note:'教学口径'},{label:'冷却',value:'24.5',unit:'MW',note:'供回水 & 辅助'}];

for(const owner of ['tour','reception']){
  const f=fixture(),c=caption(f,owner);let inside=false,factory={open:true,mode:'takeup',distance:11};
  f.sandbox.GOBI_DCDT.isOpen=()=>inside;f.sandbox.NZ_FACTORY={snapshot:()=>f.copy(factory),restore:s=>factory=f.copy(s)};
  f.load('visitor-view.js');const V=f.sandbox.NZ_VISITOR_VIEW;V.ready(f.api);V.enter({owner,freeze:true});V.update({owner,title:'数据中心',scope:'园区当前章',flows:['power','data','cooling'],metrics});
  const dock=f.nodes.get('visitorDock'),panel=f.nodes.get('visitorMetrics');
  check(owner+'UsesOneSharedGuidePanel',()=>{
    assert.equal(dock.hidden,false);assert.equal(dock.classList.contains('visitor-guide'),true);assert.equal(c.bar.parentNode.parentNode,dock);
    assert.equal(panel.parentNode,c.bar);assert.equal(c.bar.children.indexOf(panel)+1,c.bar.children.indexOf(c.buttons));
    assert.equal(dock.querySelectorAll('*').filter(e=>e===panel).length,1);assert.equal(dock.children.length,1);
  });
  check(owner+'PreservesWholeParagraphMetadataAndControls',()=>{
    assert.equal(c.paragraph.textContent,'这里从园区进线，经过变压、整流与稳压，走向机架和芯片；电力、数据与冷却供回共同构成完整供能链路。');
    assert.equal(c.title.textContent,'数据中心');assert.equal(c.step.textContent,'参观路线 · 03 / 08 · 00:46 / 03:00');
    assert.deepEqual(c.buttons.children.map(b=>b.textContent),['暂停','上一章','下一章','退出']);assert.equal(c.progress.parentNode,c.bar);
    assert.ok(!panel.innerHTML.includes('数据中心'));assert.ok(!panel.innerHTML.includes('visitor-metric-title'));
  });
  check(owner+'RetainsAllMetricsNotesUnitsScopeAndLegend',()=>{
    assert.equal((panel.innerHTML.match(/class="visitor-metric"/g)||[]).length,3);assert.ok(panel.innerHTML.includes('园区当前章'));
    for(const m of metrics){assert.ok(panel.innerHTML.includes(m.label+'：'));assert.ok(panel.innerHTML.includes(m.value));if(m.unit)assert.ok(panel.innerHTML.includes(m.unit));}
    for(const note of ['（代表负载）','（教学口径）','（供回水 &amp; 辅助）'])assert.ok(panel.innerHTML.includes(note));
    for(const flow of ['power','data','cooling'])assert.ok(panel.innerHTML.includes('data-kind="'+flow+'"'));
  });
  inside=true;V.beforeRender();inside=false;V.beforeRender();
  check(owner+'KeepsMergedGuideAfterBuildingExit',()=>{assert.equal(f.document.body.classList.contains('visitor-building'),false);assert.equal(panel.hidden,false);assert.equal(panel.parentNode,c.bar);});
  factory.open=false;factory.distance=21;V.exit(owner);
  check(owner+'RestoresCaptionAndFreeExplorationPreferences',()=>{
    assert.equal(c.bar.parentNode,c.origin);assert.deepEqual(c.bar.children,c.originalChildren);assert.equal(panel.parentNode,dock);assert.equal(dock.hidden,true);
    assert.equal(dock.classList.contains('visitor-guide'),false);assert.deepEqual(factory,{open:true,mode:'takeup',distance:11});assert.ok(!c.origin.children.some(e=>e.tagName==='#COMMENT'));
  });
  const cloud=f.document.createElement('section');cloud.id='cloudVisit';f.document.body.append(cloud);
  V.enter({owner:'cloud'});V.update({owner:'cloud',title:'协同情境',scope:'模型示意',flows:['control'],metrics});
  check(owner+'ToCloudKeepsOriginalTwoCardComposition',()=>{
    assert.equal(dock.classList.contains('visitor-guide'),false);assert.equal(panel.parentNode,dock);assert.equal(cloud.parentNode.parentNode,dock);assert.equal(dock.children.length,2);
    assert.ok(panel.innerHTML.includes('visitor-metric-heading'));assert.ok(panel.innerHTML.includes('visitor-metric-title'));assert.ok(panel.innerHTML.includes('协同情境'));
    assert.ok(!panel.innerHTML.includes('（代表负载）'));assert.equal(c.bar.parentNode,c.origin);
  });V.exit('cloud');
}

check('GuideOwnerSwitchRestoresEachOriginalCaptionHome',()=>{
  const f=fixture(),tour=caption(f,'tour'),reception=caption(f,'reception');f.load('visitor-view.js');const V=f.sandbox.NZ_VISITOR_VIEW;V.ready(f.api);
  V.enter({owner:'tour'});V.enter({owner:'reception'});assert.equal(tour.bar.parentNode,tour.origin);assert.equal(f.nodes.get('visitorMetrics').parentNode,reception.bar);
  V.exit('reception');assert.equal(reception.bar.parentNode,reception.origin);assert.ok(!tour.origin.children.some(e=>e.tagName==='#COMMENT'));
});

/* These are source contracts, not browser-computed styles or pixel assertions. */
const guideStart=css.indexOf('#visitorDock.visitor-guide{');assert.ok(guideStart>=0);
const guideCSS=css.slice(guideStart),rules=[...css.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m=>({selectors:m[1].trim().split(',').map(s=>s.trim()),declarations:Object.fromEntries(m[2].split(';').filter(Boolean).map(d=>{const at=d.indexOf(':');return [d.slice(0,at).trim(),d.slice(at+1).trim()];}))}));
const declarations=selector=>rules.filter(r=>r.selectors.includes(selector)).map(r=>r.declarations),last=selector=>Object.assign({},...declarations(selector)),guideSelector=tail=>'.visitor-playing #visitorDock.visitor-guide '+tail;
check('CompactRulesApplyOnlyToTwoGuideOwners',()=>{
  for(const m of guideCSS.matchAll(/([^{}]+)\{([^{}]*)\}/g))for(const selector of m[1].trim().split(',')){assert.ok(selector.includes('#visitorDock.visitor-guide'),selector);assert.ok(!/cloud|cv-|sst/.test(selector),selector);}
  const oldDock=declarations('#visitorDock')[0];assert.equal(oldDock['grid-template-columns'],'repeat(2,minmax(0,1fr))');assert.equal(oldDock.height,'clamp(260px,30vh,336px)');
});
check('GuideWidthFollowsContentWithViewportAnd1500PixelLimit',()=>{
  const desktop=declarations('#visitorDock.visitor-guide')[0];assert.equal(desktop.width,'max-content');assert.equal(desktop['max-width'],'min(1500px,calc(100% - 48px))');
  for(const r of declarations('#visitorDock.visitor-guide')){assert.equal(r.height,'auto');assert.equal(r['min-height'],'0');}
  assert.equal(desktop['max-height'],'none');assert.equal(desktop.display,'block');assert.match(desktop.border,/^1px solid /);
});
check('GuideCaptionAndMetricsHaveNoIndependentCardsOrReservedHeight',()=>{
  const cell=last('#visitorDock.visitor-guide .visitor-dock-caption');assert.equal(cell.height,'auto');assert.equal(cell['min-height'],'0');
  for(const tail of ['#tourBar','#receptionBar','#visitorMetrics']){const r=last(guideSelector(tail));assert.equal(r.height,'auto',tail);assert.equal(r['min-height'],'0',tail);assert.equal(r['max-height'],'none',tail);assert.equal(r.overflow,'visible',tail);assert.equal(r.border,'0',tail);assert.equal(r.background,'transparent',tail);assert.equal(r['box-shadow'],'none',tail);}
});
check('GuideFullParagraphCannotFillReservedSpaceOrClip',()=>{
  const r=last(guideSelector('.ttext'));assert.equal(r.flex,'0 0 100%');assert.equal(r.height,'auto');assert.equal(r['min-height'],'0');assert.equal(r['max-height'],'none');assert.equal(r.overflow,'visible');assert.equal(r['white-space'],'normal');assert.equal(r['font-size'],'16px');
  assert.ok(!/line-clamp|text-overflow|ellipsis/.test(guideCSS));
});
check('GuideMetricsNotesAndLegendUseCompactInlineFlow',()=>{
  assert.equal(last(guideSelector('.visitor-metric-grid')).display,'contents');assert.equal(last(guideSelector('.visitor-metric')).display,'inline');
  assert.equal(last(guideSelector('.visitor-metric>span')).display,'inline');assert.equal(last(guideSelector('.visitor-metric>small')).display,'inline');assert.equal(last(guideSelector('.visitor-metric strong')).display,'inline');
  assert.equal(last(guideSelector('#visitorMetrics')).display,'flex');assert.equal(last(guideSelector('#visitorMetrics'))['flex-wrap'],'wrap');assert.equal(last(guideSelector('.visitor-flow-legend')).margin,'0');
  assert.equal(last(guideSelector('#receptionBar .tstep:before')).content,'none');
});
check('GuideControlsAndProgressShareOneCompactWrappingRow',()=>{
  const buttons=last(guideSelector('.tbtns')),progress=last(guideSelector('.tprog')),seek=last(guideSelector('#receptionSeek'));
  assert.equal(buttons['flex-wrap'],'wrap');assert.equal(buttons['max-height'],'none');assert.equal(buttons.overflow,'visible');assert.equal(buttons.order,progress.order);assert.equal(buttons.order,seek.order);
  assert.equal(progress.height,'4px');assert.equal(seek.height,'4px');assert.equal(progress['align-self'],'center');assert.equal(seek['align-self'],'center');
});

/* Exercise only the host geometry and observation functions in a VM, without a renderer. */
const geometry={dockTop:800,dockHeight:262,tourTop:900,receptionTop:875,headerBottom:76},nodes=new Map(),queue=new Map(),listeners=new Map(),observers=[];let serial=0,cancelled=0;
const geomNode=(id,rect={})=>({id,hidden:false,style:{},classes:new Set(),classList:{contains(name){return nodes.get(id).classes.has(name);}},getBoundingClientRect:()=>typeof rect==='function'?rect():rect});
nodes.set('dcdt',geomNode('dcdt'));nodes.set('visitorDock',geomNode('visitorDock',()=>({top:geometry.dockTop,height:geometry.dockHeight})));nodes.get('visitorDock').classes.add('visitor-guide');
nodes.set('tourBar',geomNode('tourBar',()=>({top:geometry.tourTop,height:100})));nodes.get('tourBar').classes.add('on');nodes.set('receptionBar',geomNode('receptionBar',()=>({top:geometry.receptionTop,height:100})));nodes.get('receptionBar').hidden=true;
nodes.set('topbar',geomNode('topbar',()=>({bottom:geometry.headerBottom})));
class Observer{constructor(callback){this.callback=callback;this.observed=[];this.disconnected=false;observers.push(this);}observe(node){this.observed.push(node);}disconnect(){this.disconnected=true;}}
const host={document:{getElementById:id=>nodes.get(id)||null},window:{innerHeight:1080,ResizeObserver:Observer,addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:(type,fn)=>{if(listeners.get(type)===fn)listeners.delete(type);}},ResizeObserver:Observer,requestAnimationFrame:fn=>{const id=++serial;queue.set(id,fn);return id;},cancelAnimationFrame:id=>{cancelled++;queue.delete(id);}};
vm.createContext(host);const start=dcdt.indexOf('  const D ='),end=dcdt.indexOf('  /* ================= 园区账本');assert.ok(start>=0&&end>start);
vm.runInContext(dcdt.slice(start,end)+'\nglobalThis.layout={place,requestPlace,watchLayout,stopLayoutWatch};',host,{filename:'dcdt-layout-functions.js'});
const flush=()=>{const callbacks=[...queue.values()];queue.clear();callbacks.forEach(fn=>fn());};
host.layout.place();
check('BuildingUsesMeasuredGuideDockAndHeaderClearance',()=>{assert.equal(nodes.get('dcdt').style.bottom,'290px');assert.equal(nodes.get('dcdt').style.top,'88px');assert.equal(nodes.get('dcdt').style.height,undefined);});
host.layout.watchLayout();
check('BuildingObservesCaptionAndDockChanges',()=>{assert.deepEqual(observers.at(-1).observed.map(n=>n.id),['tourBar','receptionBar','visitorDock']);assert.ok(listeners.has('resize'));assert.equal(queue.size,1);});
flush();geometry.dockTop=740;geometry.dockHeight=322;observers.at(-1).callback();observers.at(-1).callback();
check('ParagraphHeightChangesCoalesceAndRepositionBuilding',()=>{assert.equal(queue.size,1);flush();assert.equal(nodes.get('dcdt').style.bottom,'350px');});
nodes.get('visitorDock').classes.delete('visitor-guide');host.layout.place();
check('CloudKeepsExistingMeasuredDockGap',()=>assert.equal(nodes.get('dcdt').style.bottom,'354px'));
nodes.get('visitorDock').hidden=true;host.layout.place();
check('BuildingRetainsCaptionFallbackOutsideSharedDock',()=>{assert.equal(nodes.get('dcdt').style.bottom,'194px');nodes.get('receptionBar').hidden=false;host.layout.place();assert.equal(nodes.get('dcdt').style.bottom,'219px');});
host.layout.requestPlace();host.layout.stopLayoutWatch();
check('BuildingLayoutWatchCleansUpOnClose',()=>{assert.equal(queue.size,0);assert.ok(cancelled>0);assert.equal(observers.at(-1).disconnected,true);assert.equal(listeners.has('resize'),false);assert.match(dcdt,/function close\(\)[\s\S]*?stopLayoutWatch\(\)/);assert.match(dcdt,/function unmount\(\)[\s\S]*?stopLayoutWatch\(\)/);});

check('HostPreservesAuthoredInnerSidebars',()=>{assert.ok(!build.includes('header, aside.right {display:none'));assert.ok(!dcdt.includes('nz-visitor-embed'));assert.ok(!reception.includes("dataset.visitorEmbedded='true'"));assert.ok(!sst.includes("dataset.sstEmbedded='true'"));assert.match(dcdt,/f\.setAttribute\('srcdoc', src\)/);});

fs.writeFileSync(path.join(root,'evidence/v20-visitor-layout.json'),JSON.stringify({checks,passed:checks.length,owners:['tour','reception'],liveBrowserVerified:false,scope:'DOM lifecycle, content preservation, source layout contracts and measured host geometry; no pixel verification'},null,2));
