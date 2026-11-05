'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),fixture=require('./visitor-fixture.cjs'),T=require('../src/three.js');
const checks=[],check=(n,f)=>{f();checks.push(n);console.log('PASS '+n);};
async function main(){
 const f=fixture(),w=f.sandbox;w.THREE=T;w.NZ_CLOUD_CONTENT=require('../src/cloud-visit-content.js');w.NZ_SST_MODEL=require('../src/sst-model.js');w.NZ_SST_THREE=require('../src/sst-three.js');
 const adapter=w.NZ_SST_THREE;w.NZ_SST_THREE={build:(t,o)=>adapter.build(t,{...o,modelAPI:w.NZ_SST_MODEL})};w.NZ_SST_SIMULATION=require('../src/sst-simulation.js');w.NZ_VISITOR_RESULTS=require('../src/visitor-results.js');
 w.EDGES=[];w.requestAnimationFrame=fn=>fn();w.NZ_FLOWS.isEnabled=kind=>f.flows().enabled[kind];const scene=new T.Scene(),models={};
 for(const [key,z]of [['panamaSc',85],['panamaSc2',109]]){const root=new T.Group(),conversion=new T.Group(),outputProtection=new T.Group();root.position.set(37,0,z);conversion.add(new T.Mesh(new T.BoxGeometry(2,2,1),new T.MeshStandardMaterial({color:0xeeeede})));root.add(conversion,outputProtection);scene.add(root);models[key]={root,conversion,outputProtection};}
 w.NZ_DETAIL={models};f.api.scene=scene;f.api.renderer={domElement:f.nodes.get('sceneFrame')};
 const camera=new T.PerspectiveCamera(34,2,.1,2600);camera.position.set(480,385,515);f.api.camera=camera;f.api.controls.target=new T.Vector3(10,0,-45);camera.lookAt(f.api.controls.target);camera.updateMatrixWorld();
 const Element=f.document.createElement;const shell=Element('section'),body=Element('div'),controlsBox=Element('div'),hud=Element('div');shell.append(body,controlsBox,hud);f.document.body.append(shell);
 const dashboardUpdates=[];w.NZ_VISITOR_VIEW={update:v=>dashboardUpdates.push(v)};f.load('scenario-dashboard.js');f.load('sst-visit.js');const S=w.NZ_SST_VISIT;S.ready(f.api,{shell,body,controlsBox,hud,back(){},layoutCamera(){}});
 check('NativeNodesAndPortGraph',()=>{const a=S.audit();assert.equal(a.nodes.length,2);assert.ok(a.nodes.every(n=>n.model.passed));assert.ok(a.connectivity.passed,a.connectivity.errors.join('; '));});
 S.previewScheme('sst',{explode:.5});S.tick(4);S.beforeRender();
 check('PreviewReplacesOnlyConversion',()=>{const a=S.audit();assert.ok(a.nodes.every(n=>n.sst&&!n.existing&&n.outputProtection));assert.ok(a.nodes[0].model.exploded>.4);assert.equal(scene.getObjectByName('SST selected-branch demonstration routes').visible,false);});
 S.clearPreview();check('PreviewReturnsAllExistingEquipment',()=>{const a=S.audit();assert.ok(a.nodes.every(n=>!n.sst&&n.existing&&n.outputProtection));assert.ok(a.nodes.every(n=>n.model.exploded===0));});
 await S.start();S.seek(47);await new Promise(r=>setTimeout(r,0));check('MissingBuildingHasAutomaticFallback',()=>{const a=S.audit();assert.equal(a.loading,false);assert.equal(a.inside,false);assert.equal(a.paused,false);});
 check('EquipmentDiagramMatchesSchemeAndScope',()=>{const d=dashboardUpdates.at(-1).greenDashboard;assert.ok(d.html.includes('sv-equipment-grid'));assert.ok(d.html.includes('电解锌均保留'));assert.ok(f.document.body.classList.contains('scenario-dashboard-playing'));});
 S.seek(80);check('OperationalChartsUseSynchronizedActualFrame',()=>{const a=S.audit(),d=dashboardUpdates.at(-1).greenDashboard;assert.equal(d.values.loss,a.frame.state.conversionLossMW);assert.equal(d.values.grid,a.frame.state.gridImportMW);assert.ok(d.html.includes('按 B 的相同输出功率归一比较'));});
 S.seek(94);check('SummaryUsesThreeRecordedResultCards',()=>{assert.equal(S.audit().stage,5);assert.equal(f.nodes.get('sstConclusion').hidden,false);assert.equal(f.nodes.get('sstCompare').open,false);assert.equal((f.nodes.get('sstConclusion').innerHTML.match(/sst-result-card/g)||[]).length,3);});
 S.stop();check('StoryStopsAndRestoresNodes',()=>{assert.ok(S.audit().nodes.every(n=>n.existing&&!n.sst&&n.outputProtection));assert.ok(!f.document.body.classList.contains('scenario-dashboard-playing'));});
 fs.writeFileSync(path.join(__dirname,'../evidence/v20-sst-preview.json'),JSON.stringify({checks,passed:checks.length,liveBrowserVerified:false,nativeThreeGeometry:true},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
