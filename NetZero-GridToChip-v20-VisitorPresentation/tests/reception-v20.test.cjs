'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),fixture=require('./visitor-fixture.cjs');
const root=path.join(__dirname,'..'),data=JSON.parse(fs.readFileSync(path.join(root,'三分钟接待文案.json'),'utf8')),M=require('../src/reception-model.js'),m=M.compile(data),checks=[];
const check=(name,fn)=>{fn();checks.push(name);console.log('PASS '+name);};
async function main(){
 check('independent180secondTimeline',()=>{assert.equal(m.duration,180);assert.equal(m.chapters.length,8);assert.deepEqual(m.chapters.map(c=>c.duration),[15,25,35,26,14,24,24,17]);});
 check('noCaptionGapsAndNoFlashSentences',()=>{let t=0;for(const c of m.timeline){assert.equal(c.start,t);assert.ok(c.end-c.start>=4);assert.ok(c.text.endsWith('。'));t=c.end;}assert.equal(t,180);});
 check('normalSpeedBuildingExcerpt',()=>{assert.deepEqual(m.building,{at:46,until:75,from:33,to:62});for(let t=0;t<=180;t+=.5)assert.ok(M.at(m,t).cue);});
 check('narrationFitsReadingBudget',()=>{for(const c of m.timeline){const count=(c.text.match(/[\p{L}\p{N}]/gu)||[]).length;assert.ok(count/(c.end-c.start)<=5.2,c.id+' '+count/(c.end-c.start));}});
 check('scopeAndSourceUnchanged',()=>{for(const file of ['config.js','engine.js','dispatch-tasks.js','sst-simulation.js'])assert.equal(fs.readFileSync(path.join(root,'src',file),'utf8'),fs.readFileSync(path.join(root,'../NetZero-GridToChip-v19-SSTEnergyRouter/src',file),'utf8'));assert.equal(m.collaboration.initialSoc,55);assert.equal(m.collaboration.gridLimitMW,400);});
 check('newRuntimeSyntax',()=>{for(const file of ['reception-model.js','reception.js','visitor-view.js','premium.js','grid-to-chip.js','dcdt.js'])new vm.Script(fs.readFileSync(path.join(root,'src',file),'utf8'),{filename:file});});
 const f=fixture();f.load('visitor-view.js');f.sandbox.NZ_VISITOR_VIEW.ready(f.api);const baseline={state:f.copy(f.api.S),visual:f.visual(),flows:f.flows(),position:f.api.camera.position.toArray(),controls:{enabled:true,autoRotate:true,enableDamping:true}};
 f.sandbox.NZ_VISITOR_VIEW.enter({owner:'test',freeze:true});f.sandbox.NZ_VISITOR_VIEW.update({owner:'test',title:'测试',context:'energy',labels:['solar'],flows:['power'],metrics:[{label:'功率',value:'1',unit:'MW'}]});f.api.S.simTime=999;f.api.S.unwanted=123;f.api.camera.position.fromArray([1,1,1]);f.api.controls.autoRotate=false;f.sandbox.NZ_VISITOR_VIEW.exit('test');
 check('viewRestoresAllPreferencesAndFrozenState',()=>{assert.deepEqual(f.api.S,baseline.state);assert.deepEqual(f.visual(),baseline.visual);assert.deepEqual(f.flows(),baseline.flows);assert.deepEqual(f.api.camera.position.toArray(),baseline.position);assert.equal(f.document.body.classList.contains('visitor-playing'),false);});
 const pure=require('../src/cloud-simulation.js');const run=pure.compare('coordination',{...m.collaboration});
 check('receptionUsesRealSameConditionCalculation',()=>{assert.ok(run.basis.sameInitial&&run.basis.sameTasks&&run.basis.sameWeather);assert.equal(run.scenario.durationSeconds,7200);assert.equal(run.candidate.basis.initial.soc,55);assert.equal(run.candidate.basis.initial.importLimitMW,400);assert.ok(run.candidate.constraints.every(c=>c.pass),JSON.stringify(run.candidate.constraints.filter(c=>!c.pass)));});
 f.sandbox.NZ_CLOUD_SIMULATION={compareAsync:async()=>run};f.load('reception.js');const R=f.sandbox.NZ_RECEPTION;R.ready(f.api);await R.start();
 check('startsAtFixedPanorama',()=>{assert.equal(R.state().time,0);assert.equal(R.state().loading,false);assert.deepEqual(f.api.camera.position.toArray(),f.api.TOUR_HOME.pos);assert.equal(f.api.S.running,false);});
 R.tick(10);R.pause();R.tick(20);check('pauseStopsReceptionClock',()=>assert.equal(R.state().time,10));R.pause();await R.seek(46);await new Promise(r=>setTimeout(r,0));
 check('opensRepresentativeBuildingRange',()=>{assert.equal(R.state().inside,true);assert.equal(f.building().time,33);assert.equal(f.building().playing,true);});
 f.stepBuilding(4);R.tick(4);R.pause();f.stepBuilding(8);R.tick(8);check('buildingAndCaptionPauseTogether',()=>{assert.equal(R.state().time,50);assert.equal(f.building().time,37);});R.pause();
 f.stepBuilding(25);R.tick(25);await new Promise(r=>setTimeout(r,0));check('buildingHandsBackToFactory',()=>{assert.equal(R.state().time,75);assert.equal(R.state().inside,false);assert.equal(f.building().open,false);});
 await R.seek(139);R.tick(8);check('sameSiteEquipmentChange',()=>assert.deepEqual(f.preview.slice(-2),['existing','sst']));await R.seek(163);check('sstPreviewRestoresOutsideChapter',()=>assert.equal(f.preview.at(-1),'clear'));
 await R.stop();check('routeExitRestoresState',()=>{assert.equal(R.isActive(),false);assert.deepEqual(f.api.S,baseline.state);assert.deepEqual(f.visual(),baseline.visual);assert.deepEqual(f.flows(),baseline.flows);});
 await R.start();await R.seek(179);R.tick(1);await new Promise(r=>setTimeout(r,0));check('automaticEnding',()=>{assert.equal(R.isActive(),false);assert.equal(f.sandbox.NZ_VISITOR_VIEW.state().ending,true);});
 f.sandbox.NZ_VISITOR_VIEW.hideEnd();f.sandbox.GOBI_DCDT.reveal=async()=>false;await R.start();await R.seek(46);await new Promise(r=>setTimeout(r,0));check('buildingFailureContinuesWithoutManualAction',()=>{assert.equal(R.state().buildingFailed,true);assert.equal(R.state().paused,false);assert.equal(R.state().loading,false);});R.tick(10);assert.equal(R.state().time,56);await R.stop();
 fs.writeFileSync(path.join(root,'evidence/v20-reception-unit.json'),JSON.stringify({checks,passed:checks.length,routeSeconds:180,liveBrowserVerified:false},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
