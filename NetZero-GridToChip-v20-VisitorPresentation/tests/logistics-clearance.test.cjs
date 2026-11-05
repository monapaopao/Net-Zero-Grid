'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const THREE=require('../src/three.js'),{make,bounds}=require('./vehicles-native.test.cjs');
const scene=new THREE.Scene(),context={THREE,scene};context.window=context;vm.createContext(context);
// Expose construction helpers in this test only; exercise the actual facade and
// actual layout transform, including their enlarged projecting loading awnings.
vm.runInContext(fs.readFileSync('src/campus-detail.js','utf8').replace('return {init,select,reset,update,ready,models};','return {building,compile};'),context);
vm.runInContext(fs.readFileSync('src/campus-layout.js','utf8').replace('return {setup,zinc,station,apply,focus,selection,ready,filter,mode:()=>mode,toolkit:()=>T};','return {plan};'),context);
const placement=context.NZ_LAYOUT.plan.logistics;
const model=context.NZ_DETAIL.building('logistics',122,86,22,6.5,11);
context.NZ_DETAIL.compile();model.root.position.set(...[placement.at[0],0,placement.at[1]]);model.root.scale.fromArray(placement.scale);scene.updateMatrixWorld(true);
const geometry=[];model.root.traverse(o=>{
 if(!o.isMesh)return;o.geometry.computeBoundingBox();
 for(let i=0;i<(o.isInstancedMesh?o.count:1);i++){
  const local=new THREE.Matrix4();if(o.isInstancedMesh)o.getMatrixAt(i,local);
  geometry.push(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld.clone().multiply(local)));
 }
});
const fleet=make(),truck=bounds(fleet,'compute-logistics');
const old=truck.clone().translate(new THREE.Vector3(0,0,-3));
assert(geometry.some(b=>b.intersectsBox(old)),'Regression must reproduce the original facade collision');
assert(!geometry.some(b=>b.intersectsBox(truck)),'Truck must clear facade and projecting canopies');
const front=Math.max(...geometry.filter(b=>b.max.y>truck.min.y&&b.min.y<truck.max.y).map(b=>b.max.z));
assert(truck.min.z-front>1,'Keep a visible gap from the loading awnings');
assert(truck.max.z<136,'Stay inside the apron before the southern road');
fs.writeFileSync('evidence/v20-logistics-clearance.json',JSON.stringify({passed:true,truck:{min:truck.min.toArray(),max:truck.max.toArray()},canopyFront:front,clearance:truck.min.z-front,originalCollisionReproduced:true,browserVerified:false},null,2));
console.log('PASS original loading-awning intersection reproduced; repositioned truck clears actual facade geometry and southern road');
