'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const legacy=path.resolve(__dirname,'../../NetZero-GridToChip-v20-VisitorPresentation');
const T=require(path.join(legacy,'src/three.js')),model=require('./model.js'),oldModel=require(path.join(legacy,'src/vehicle-model.js'));
const geom=vm.runInNewContext('('+fs.readFileSync(path.join(__dirname,'geometry.js'),'utf8').trim()+')',{T});
const geometries={};
for(const kind of Object.keys(model.specs)){
 const data=model.create(kind);assert.deepEqual(data.spec,oldModel.specs[kind]);assert.deepEqual(data.port,oldModel.create(kind).port);assert(data.parts.length>=150);
 geometries[kind]=data.parts.filter(p=>p.type!=='plate').map(p=>{
  const g=geom(p);assert(g.attributes.position.array.every(Number.isFinite),kind+' '+p.name);assert(g.attributes.normal.array.every(Number.isFinite),kind+' normal');
  const o=new T.Object3D();o.position.fromArray(p.p);if(p.axis)o.quaternion.setFromUnitVectors(new T.Vector3(0,p.type==='ring'?0:1,p.type==='ring'?1:0),new T.Vector3(...p.axis));o.updateMatrix();
  if(!['hull','panel','rod'].includes(p.type))g.applyMatrix4(o.matrix);g.computeBoundingBox();return {p,g};
 });
 const whole=new T.Box3();for(const {g}of geometries[kind])whole.union(g.boundingBox);
 assert(whole.min.y>=-1e-6,kind+' wheel/ground contact');assert(whole.max.y<data.spec.h+.15,kind+' height');
 // A ray through the upper tyre must see empty wheel opening, not a painted body.
 const body=geometries[kind].find(({p})=>p.name==='wheel-cut sculpted body');
 if(body)for(const z of [-data.spec.wb/2,data.spec.wb/2]){
  const mesh=new T.Mesh(body.g,new T.MeshBasicMaterial({side:T.DoubleSide}));mesh.updateMatrixWorld();
  const ray=new T.Raycaster(new T.Vector3(data.spec.w/2+.5,data.spec.r+.16,z),new T.Vector3(-1,0,0));assert.equal(ray.intersectObject(mesh).length,0,kind+' actual arch cut');
 }
}
const fixture=require(path.join(legacy,'tests/visitor-fixture.cjs')),f=fixture(),P=require(path.join(legacy,'src/multi-campus-plan.js'));
const scene=new T.Scene(),old=new T.Group();old.name='Retired logistics truck';scene.add(old);
const tank=new T.Group();tank.name='Stationary ammonia loading vehicle';const facility=P.facilities.find(v=>v.key==='ammoniaload');tank.position.set(facility.x-5,0,facility.z-.2);scene.add(tank);
for(const [w,h,d,x,y,z]of [[48,.05,14,55,.13,131],[38,.02,7,64,.175,89],[11.8,.025,3.5,52,.19,107]]){const m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshBasicMaterial());m.position.set(x,y,z);scene.add(m);}
const sprite=new T.Sprite(new T.SpriteMaterial());sprite.raycast=()=>{throw Error('terrain query entered sprite');};scene.add(sprite);
const camera=new T.PerspectiveCamera(45,1,.1,3000);camera.position.set(91,6.1,114);
const S={sc:7.2,trucks:6,quality:'high',running:false},state=JSON.stringify(S);
Object.assign(f.sandbox,{THREE:T,NZ_MULTI_PLAN:P,NZ_VEHICLE_MODEL:model,truckPool:[],INFO:{supercharge:{},parking:{}}});Object.assign(f.api,{THREE:T,scene,S,camera});
vm.runInContext(require('./build.cjs')('vehicles-anatomy.js',fs.readFileSync(path.join(legacy,'src/vehicles-anatomy.js'),'utf8')),f.sandbox);
const V=f.sandbox.NZ_VEHICLES;V.ready(f.api);const audit=V.audit();assert.equal(audit.vehicles.length,23);assert.equal(audit.routes.length,9);assert.equal(audit.bays.length,24);
const bounds=[];scene.updateMatrixWorld(true);
for(const v of audit.vehicles){
 const b=new T.Box3();scene.traverse(o=>{if(o.isInstancedMesh){const ids=o.userData.vehicleIds;for(let i=0;i<ids.length;i++)if(ids[i]===v.id){const m=new T.Matrix4();o.getMatrixAt(i,m);o.geometry.computeBoundingBox();b.union(o.geometry.boundingBox.clone().applyMatrix4(m));}}});
 assert(b.min.y>=v.p[1]-.001,v.id+' ground');if(v.zone==='charging'){assert(b.max.y<P.charging.canopy.h-.5);assert(b.max.z<P.charging.aisle.z0||b.min.z>P.charging.aisle.z1,v.id+' aisle');assert(b.min.x>44&&b.max.x<84);}bounds.push({id:v.id,b});
}
for(let i=0;i<bounds.length;i++)for(let j=i+1;j<bounds.length;j++)assert(!bounds[i].b.intersectsBox(bounds[j].b),bounds[i].id+' overlaps '+bounds[j].id);
for(const v of audit.vehicles){V.select(v.id);assert(f.nodes.get('vehicleContent').innerHTML.includes(v.plate));}V.hide();
const countFine=()=>{let n=0;scene.getObjectByName('Anatomy detailed campus vehicles').traverseVisible(o=>{if(o.userData.vehicleTier==='fine')n++;});return n;};
V.tick(.1);const near=countFine();camera.position.set(600,600,600);V.tick(.1);assert.equal(countFine(),0,'high quality must cull distant small parts');assert(near>0);camera.position.set(91,6.1,114);V.tick(.1);assert.equal(countFine(),near,'detail restores on approach');
assert.equal(JSON.stringify(S),state);assert(!old.visible&&!tank.visible);assert(audit.drawBatches<150);
fs.writeFileSync(path.join(__dirname,'evidence/geometry.json'),JSON.stringify({passed:true,kinds:Object.keys(model.specs),parts:Object.fromEntries(Object.keys(model.specs).map(k=>[k,model.create(k).parts.length])),vehicleCount:audit.vehicles.length,connections:audit.routes.length,drawBatches:audit.drawBatches,finiteGeometry:true,realWheelOpenings:true,groundAndCanopyClear:true,noVehicleOverlap:true,distanceDetails:{near,far:0},immutableEnergyState:true},null,2)+'\n');
console.log('PASS all 8 geometries, wheel openings, ground/canopy/aisle clearance, 23 vehicles, picking contract, distance details and energy state');
