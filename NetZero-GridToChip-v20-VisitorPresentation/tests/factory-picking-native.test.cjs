/* Exercise the real premium picking loop with bundled Three.js ray intersections.
 * No browser, renderer or copied picker implementation is used. */
'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm'),THREE=require('../src/three.js'),{fixture}=require('./factory-line.test.cjs');
const source=fs.readFileSync(path.join(__dirname,'../src/premium.js'),'utf8');
const start=source.indexOf('      let hitPt = null, taggedDevice = null;');
assert(start>=0,'Real premium picking loop must exist');
const end=source.indexOf('      if (!hitPt)',start);
assert(end>start,'Real premium picking loop must have its no-hit boundary');
const pick=vm.runInNewContext('(hits,INFO,window)=>{'+source.slice(start,end)+';return {hitPt,taggedDevice};}',{}, {filename:'premium-native-picker.js'});
const info={factory:{},factoryraw:{},factoryproduct:{},active:{},retired:{}};
const checks={};
function check(name,fn){fn();checks[name]=true;console.log('PASS '+name);}
function shoot(scene,origin,target){scene.updateMatrixWorld(true);const from=new THREE.Vector3(...origin),to=new THREE.Vector3(...target),ray=new THREE.Raycaster(from,to.clone().sub(from).normalize(),0,from.distanceTo(to)+.2),hits=ray.intersectObjects(scene.children,true);return {hits,result:pick(hits,info,{})};}
function tagged(mesh,key){mesh.userData.deviceKey=key;return mesh;}
function simpleScene(){const scene=new THREE.Scene(),back=tagged(new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial()),'active');scene.add(back);return {scene,back};}
function frontMesh(material=new THREE.MeshBasicMaterial()){const mesh=tagged(new THREE.Mesh(new THREE.BoxGeometry(1,1,1),material),'retired');mesh.position.z=2;return mesh;}
const f=fixture();f.factory.setOpen(true,{immediate:true});
const targets=[
 {key:'factoryraw',pattern:/^Raw coil rack .* wire pack$/,origin:[312,38,-14]},
 {key:'factoryproduct',pattern:/^Finished reel pallet .* wire pack$/,origin:[312,38,140]}
].map(row=>{const range=f.ranges(row.pattern)[0];assert(range,'Warehouse physical content must exist: '+row.key);return {...row,target:range.box.getCenter(new THREE.Vector3()).toArray()};});
check('openSharedRoofDoesNotInterceptRawWarehousePicking',()=>{const row=targets[0],{hits,result}=shoot(f.scene,row.origin,row.target);assert(hits.some(h=>/^Shared factory roof /.test(h.object.name)),'Regression must include real hidden roof intersections');assert.equal(result.taggedDevice,row.key);});
check('openSharedRoofDoesNotInterceptPackingWarehousePicking',()=>{const row=targets[1],{result}=shoot(f.scene,row.origin,row.target);assert.equal(result.taggedDevice,row.key);});
check('closedRoofStillSelectsWholeFactory',()=>{f.factory.setOpen(false,{immediate:true});for(const row of targets){const {result}=shoot(f.scene,row.origin,row.target);assert.equal(result.taggedDevice,'factory');}});
check('hiddenRetiredModelAncestorDoesNotPick',()=>{const {scene}=simpleScene(),retired=new THREE.Group();retired.name='Scaled legacy factory';retired.visible=false;retired.add(frontMesh());scene.add(retired);const {hits,result}=shoot(scene,[0,0,5],[0,0,0]);assert.equal(hits[0].object.parent,retired,'Raycaster includes a child of an invisible group');assert.equal(result.taggedDevice,'active');});
check('individuallyHiddenOldMeshDoesNotPick',()=>{const {scene}=simpleScene(),retired=frontMesh();retired.visible=false;scene.add(retired);assert.equal(shoot(scene,[0,0,5],[0,0,0]).result.taggedDevice,'active');});
check('fullyTransparentMeshDoesNotBlockVisibleContent',()=>{const {scene}=simpleScene(),retired=frontMesh(new THREE.MeshBasicMaterial({transparent:true,opacity:0}));scene.add(retired);const {hits,result}=shoot(scene,[0,0,5],[0,0,0]);assert.equal(hits[0].object,retired);assert.equal(result.taggedDevice,'active');});
check('materialVisibilityIsRespected',()=>{const {scene}=simpleScene(),mat=new THREE.MeshBasicMaterial();mat.visible=false;scene.add(frontMesh(mat));assert.equal(shoot(scene,[0,0,5],[0,0,0]).result.taggedDevice,'active');});
check('materialArraysUseTheIntersectedFace',()=>{const {scene}=simpleScene(),materials=Array.from({length:6},()=>new THREE.MeshBasicMaterial()),retired=frontMesh(materials);scene.add(retired);let shot=shoot(scene,[0,0,5],[0,0,0]);const face=shot.hits[0].face.materialIndex;assert.equal(shot.hits[0].object,retired);assert.equal(shot.result.taggedDevice,'retired');materials[face].visible=false;assert.equal(shoot(scene,[0,0,5],[0,0,0]).result.taggedDevice,'active');});
check('translucentVisibleSurfaceStillPicks',()=>{const {scene}=simpleScene();scene.add(frontMesh(new THREE.MeshBasicMaterial({transparent:true,opacity:.22})));assert.equal(shoot(scene,[0,0,5],[0,0,0]).result.taggedDevice,'retired');});
const result={passed:true,checks,note:'Actual premium.js hit-selection loop and bundled Three.js scene/raycast geometry in Node; no pixels, browser or live playback validation.'};
fs.writeFileSync(path.join(__dirname,'../evidence/v20-factory-picking-native.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({passed:true,checks:Object.keys(checks).length}));
