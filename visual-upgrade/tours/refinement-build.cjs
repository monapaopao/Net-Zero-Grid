'use strict';
const vm=require('node:vm'),c=require('./content.cjs');
const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('Tour refinement anchor: '+a);return s.replace(a,()=>b);};
module.exports=(name,s)=>{
 if(name==='dcdt-app.js'){
  const box={window:{}};vm.runInNewContext(s,box);let doc=box.window.NZ_DCDT_APP;
  doc=doc.replace(/window\.NZ_TOUR_SCRIPT=(\{[^\n]+\});/,()=> 'window.NZ_TOUR_SCRIPT='+JSON.stringify(c.full).replaceAll('<','\\u003c')+';');
  return 'window.NZ_DCDT_APP='+JSON.stringify(doc).replace(/<\/script/g,'<\\/script')+';';
 }
 if(name==='tour-content.js')s+='\nwindow.NZ_TOUR_FINISH={pending:false,mark(){this.pending=true;},take(){if(!this.pending)return null;this.pending=false;const a=window.__NZ_TEST;return {camera:a.camera.position.toArray(),target:a.controls.target.toArray()};}};';
 if(name==='reception-model.js')s=s.replace('time!==180||time!==data.duration','time!==data.duration').replace('cue.duration>=4','cue.duration>=1').replace('!/[。！？]$/.test(cue.text)','(cue.text&&!/[。！？]$/.test(cue.text))');
 if(name==='campus-layout.js')s=once(s,'return {setup,zinc,station,apply,focus,selection,ready,filter,mode:','return {setup,zinc,station,apply,focus,selection,ready,filter,setMode,mode:');
 if(name==='premium.js'){
  s=once(s,"exitTour();window.NZ_VISITOR_VIEW.endPage({kind:'full'});","window.NZ_TOUR_FINISH.mark();exitTour();");
  s=once(s,"$('tourBar').dataset.route='full';","$('tourBar').dataset.route='full';document.body.classList.toggle('tour-gate-hold',row.id==='full-gate-hold');");
 }
 if(name==='reception.js'){
  const a=s.indexOf('  async function finish(){'),b=s.indexOf('\n  return {ready,start',a);s=s.slice(0,a)+'  async function finish(){if(!on)return;window.NZ_TOUR_FINISH.mark();await stop();}\n'+s.slice(b);
  s=once(s,"if(changed){lastCue=cue.id;","if(changed){lastCue=cue.id;window.NZ_LAYOUT.selection(cue.zincRoof?'panamaZn':null);");
  s=s.replace("if(chapter.id==='compute'&&!inside&&!buildingFailed)","if((chapter.id==='energy'||chapter.id==='compute')&&!inside&&!buildingFailed)");
  s=s.replace("$('receptionTime').textContent=window.NZ_TOUR_NARRATIVE.clock(time)+' / 03:00'","$('receptionTime').textContent=window.NZ_TOUR_NARRATIVE.clock(time)+' / '+window.NZ_TOUR_NARRATIVE.clock(model.duration)");
  s=s.replace('max="180"','max="'+c.quick.duration+'"');
  s=once(s,"$('receptionChapter').textContent=","document.body.classList.toggle('tour-gate-hold',cue.id==='quick-gate-hold');$('receptionChapter').textContent=");
 }
 if(name==='visitor-view.js'){
  s=once(s,"saved={owner:options.owner,","saved={zincMode:window.NZ_LAYOUT.mode(),owner:options.owner,");
  s=once(s,'const was=saved;saved=null;','const was=saved,finish=window.NZ_TOUR_FINISH.take();if(finish){was.camera=finish.camera;was.target=finish.target;was.controls.autoRotate=false;}saved=null;');
  s=once(s,'if(was.factory)window.NZ_FACTORY?.restore?.(was.factory);','if(was.factory)window.NZ_FACTORY?.restore?.(was.factory);window.NZ_LAYOUT.setMode(was.zincMode);');
  s=s.replace("classList.remove('visitor-playing','visitor-building')","classList.remove('visitor-playing','visitor-building','tour-gate-hold')");
  s=once(s,"api.resize();api.refreshPresentation();current={};lastLabels='';","api.resize();api.refreshPresentation();if(finish)api.setMode('run');current={};lastLabels='';");
 }
 if(name==='cloud-visit.js')s=s.replace('约 03:00','约 '+require('../../NetZero-GridToChip-v20-VisitorPresentation/src/tour-narrative.js').clock(c.quick.duration)).replaceAll('开始三分钟快速预览','开始快速预览');
 if(name==='cloud-visit-content.js')s=s.replace("title:'五分钟完整导览'","title:'完整园区导览｜从能源到算力'").replace("action:'开始五分钟完整导览'","action:'开始园区导览'");
 return s.replaceAll('五分钟完整导览','完整园区导览').replaceAll('三分钟快速预览','快速预览').replaceAll('三分钟接待路线','快速预览路线');
};
