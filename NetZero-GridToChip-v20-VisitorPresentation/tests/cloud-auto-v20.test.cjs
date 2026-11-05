'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),fixture=require('./visitor-fixture.cjs');
const sim=require('../src/cloud-simulation.js'),checks=[];
const check=(name,fn)=>{fn();checks.push(name);console.log('PASS '+name);};
async function main(){
 const f=fixture();f.sandbox.NZ_CLOUD_CONTENT=require('../src/cloud-visit-content.js');f.sandbox.NZ_CLOUD_SIMULATION={...sim,compareAsync:async(id,options)=>sim.compare(id,options)};
 f.sandbox.NZ_SST_VISIT={ready(){},stop(){},isPaused:()=>false};
 f.sandbox.NZ_RECEPTION={isActive:()=>false};f.load('visitor-view.js');f.sandbox.NZ_VISITOR_VIEW.ready(f.api);f.load('green-compute-view.js');f.load('scenario-dashboard.js');f.load('strategy-story.js');f.load('cloud-visit.js');const C=f.sandbox.NZ_CLOUD_VISIT;C.ready(f.api);
 const initial=f.copy(f.api.S),visual=f.visual(),flows=f.flows(),position=f.api.camera.position.toArray();
 for(const id of ['coordination','green-compute','strategy']){
  await C.start(id);check(id+'StartsAutomatically',()=>{const a=C.audit();assert.equal(a.mode,'playing');assert.equal(a.paused,false);assert.equal(a.waiting,false);assert.equal(a.time,0);});
  C.tick(41);check(id+'NoManualGateBeforeExecution',()=>{assert.equal(C.audit().time,41);assert.equal(C.audit().paused,false);});
  C.tick(1);const a=C.audit(),pass=a.comparison.candidate.criticalMissedMWh<1e-6&&a.executable;
  check(id+'AutomaticDecision',()=>{assert.equal(a.waiting,false);assert.equal(a.paused,false);assert.equal(a.decision,pass?'executed':'constrained');assert.equal(a.confirmed,pass);assert.equal(f.nodes.get('cvExecute').hidden,true);});
  if(!pass)check(id+'NeverCommandsUnapprovedPrediction',()=>{assert.ok(f.flows().narrative.routeIds.every(x=>!x.includes('command')&&!x.includes('local')));assert.match(f.nodes.get('cvStageTitle').textContent,/受限/);});
  C.tick(id==='strategy'?35:34);check(id+'ShowsOutcomeWithoutOpeningDetails',()=>{assert.equal(f.nodes.get('cvOutcome').hidden,false);assert.equal(f.nodes.get('cvCompareDetails').open,false);assert.match(f.nodes.get('cvOutcome').innerHTML,/发生了什么/);});
  C.tick(id==='strategy'?13:14);check(id+'FinishesAt90Seconds',()=>{assert.equal(C.audit().time,90);assert.equal(C.audit().stage,'review');assert.equal(C.audit().paused,true);assert.equal(C.audit().waiting,false);});
  C.replay();C.tick(12);C.pause();C.tick(20);check(id+'PauseAndReplay',()=>{assert.equal(C.audit().time,12);assert.equal(C.audit().decision,id==='strategy'?'executed':'pending');});
  C.close();check(id+'RestoresMainModelAndView',()=>{assert.deepEqual(f.api.S,initial);assert.deepEqual(f.visual(),visual);assert.deepEqual(f.flows(),flows);assert.deepEqual(f.api.camera.position.toArray(),position);});
 }
 fs.writeFileSync(path.join(__dirname,'../evidence/v20-cloud-auto.json'),JSON.stringify({checks,passed:checks.length,liveBrowserVerified:false},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
