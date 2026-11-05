/* Geometry and motion tests for the original-size horizontal workcell.
 * Uses actual bundled Three.js shapes without a renderer or browser. */
'use strict';
const assert=require('node:assert/strict');
const M=require('../src/factory-line-model.js');
const THREE=require('../src/three.js');
const data=M.create(),report=M.audit(data),checks={},byName=new Map(data.parts.map(p=>[p.name,p]));
const near=(a,b,e=1e-8)=>assert(Math.abs(a-b)<=e,`${a} != ${b}`);
const vectorNear=(a,b,e)=>a.forEach((n,i)=>near(n,b[i],e));
function test(name,fn){fn();checks[name]=true;console.log('PASS '+name);}
test('pure model audit passes',()=>assert(report.passed,JSON.stringify(report)));
test('original footprint, reel spacing and workcell-only payload',()=>{
 assert.deepEqual(M.CONFIG.footprint,[36,19.8]);
 assert.equal(data.kind,'standalone-workcell');
 assert.deepEqual(data.assemblies.payoutRotor,[-13.5,2,0]);
 assert.deepEqual(data.assemblies.takeupRotor,[13.5,2,0]);
 assert(data.parts.every(p=>p.group!=='roof'));
 assert(!data.parts.some(p=>/roof|PV |insulated wall|Workshop floor/i.test(p.name)));
 assert.equal(data.parts.length,new Set(data.parts.map(p=>p.name)).size);
 for(const p of data.parts){assert(p.size.every(v=>v>0),p.name);if(p.axis)near(Math.hypot(...p.axis),1);}
});
test('all wire samples are horizontal and retain 27-unit exposed length',()=>{
 const segments=M.pathAt(data,.59);near(segments.reduce((n,s)=>n+s.length,0),27);
 for(let i=0;i<=270;i++){const p=M.sample(segments,i/10);near(p[0],-13.5+i/10);near(p[1],3.2);near(p[2],0);}
 assert(segments.every(s=>s.kind==='line'));
 for(let i=1;i<segments.length;i++)vectorNear(segments[i-1].b,segments[i].a);
});
test('raised baths genuinely surround immersed horizontal wire with open glands',()=>{
 assert.equal(data.baths.length,2);
 for(const b of data.baths){
  near(b.wallTop,3.96);near(b.liquidY,3.48);assert(b.wallTop>b.liquidY+M.CONFIG.wireRadius);
  const liquid=byName.get(b.name+' liquid volume');
  near(liquid.p[1]+liquid.size[1]/2,b.liquidY);
  assert(liquid.p[1]-liquid.size[1]/2<M.CONFIG.wireY-M.CONFIG.wireRadius);
  for(const port of b.ports){
   vectorNear(port.center,[port.center[0],3.2,0]);assert.equal(port.wallParts.length,4);
   for(const n of port.wallParts){const wall=byName.get(n);assert(wall&&wall.type==='box');
    assert(Math.abs(wall.p[1]-3.2)-wall.size[1]/2>M.CONFIG.wireRadius||Math.abs(wall.p[2])-wall.size[2]/2>M.CONFIG.wireRadius,n);
   }
   for(const suffix of ['gland flange','annular seal','ceramic guide']){
    const gland=byName.get(port.name+' '+suffix);assert.equal(gland.type,'ring');assert.deepEqual(gland.axis,[1,0,0]);
    assert(gland.size[0]-gland.size[1]>M.CONFIG.wireRadius,`${gland.name} bore is blocked`);
    near(gland.p[1],3.2);near(gland.p[2],0);
   }
   const cup=byName.get(port.name+' collection cup bottom');
   near(cup.p[1]-cup.size[1]/2,port.collection[1]);
   const ret=data.connections.find(c=>c.name===port.name+' collection return');
   vectorNear(ret.points[0],port.collection);vectorNear(ret.points.at(-1),port.returnAt);
   assert(ret.points.slice(1).every(p=>p[1]<=port.collection[1]));
   assert(byName.has(port.name+' return collar'));
  }
  assert.equal(b.windows.length,2);for(const w of b.windows){const glass=byName.get(w.part);assert.equal(glass.mat,'glass');assert(w.yMin<3.2&&w.yMax>3.2);}
 }
});
test('one distance drives all rolls while the takeup moves axially around fixed strand',()=>{
 const s=M.state();let min=Infinity,max=-Infinity;const path=M.pathAt(data);
 for(let i=0;i<=96;i++){
  s.distance=i*M.CONFIG.traverseCycleLength/96;const p=M.pose(s,data),z=p.reelTraverse;
  min=Math.min(min,z);max=Math.max(max,z);near(p.traverse,0);assert.deepEqual(p.path,path);
  assert.deepEqual(p.movingTranslations.takeupRotor,[0,0,z]);assert.deepEqual(p.movingTranslations.takeupCarriage,[0,0,z]);
  near(-p.payoutAngle*M.CONFIG.payoutRadius,s.distance);near(-p.takeupAngle*M.CONFIG.takeupRadius,s.distance);
  for(let k=0;k<data.path.rollers.length;k++){const r=data.path.rollers[k],angle=p.rollerAngles[k];assert.equal(angle.group,r.group);near(angle.angle*r.radius,Math.sign(r.turn)*s.distance);}
  // The fixed z=0 contact lies inside the translated winding width for the whole stroke.
  const pack=byName.get('Ceramic wire takeup wound wire pack');
  assert(Math.abs(z)+M.CONFIG.wireRadius<pack.size[1]/2);
  near(pack.p[1]+pack.size[0]+M.CONFIG.wireRadius,M.CONFIG.wireY);
 }
 near(min,-M.CONFIG.traverseHalfSpan);near(max,M.CONFIG.traverseHalfSpan);
});
// Construct the same solid types consumed by the native adapter; each keeps
// its real geometry, including hollow torus glands and translated reels.
function geometry(p){
 if(p.type==='box')return new THREE.BoxGeometry(...p.size);
 if(p.type==='cyl')return new THREE.CylinderGeometry(p.size[0],p.size[0],p.size[1],32,1);
 if(p.type==='ring')return new THREE.TorusGeometry(p.size[0],p.size[1],8,32);
 if(p.type==='rod')return new THREE.CylinderGeometry(p.size[0],p.size[0],new THREE.Vector3(...p.p).distanceTo(new THREE.Vector3(...p.b)),12,1);
 const points=p.points.map(a=>new THREE.Vector3(...a)),lengths=[0];let total=0;
 for(let i=1;i<points.length;i++){total+=points[i].distanceTo(points[i-1]);lengths.push(total);}
 const curve=new THREE.Curve();curve.getPoint=t=>{const d=t*total;let j=1;while(j<lengths.length-1&&lengths[j]<d)j++;return points[j-1].clone().lerp(points[j],(d-lengths[j-1])/(lengths[j]-lengths[j-1]));};
 return new THREE.TubeGeometry(curve,Math.max(2,points.length*3),p.size[0],8,false);
}
const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),meshes=data.parts.filter(p=>!['water','glass'].includes(p.mat)).map(p=>{
 const mesh=new THREE.Mesh(geometry(p),material),o=new THREE.Object3D();mesh.name=p.name;mesh.userData.part=p;
 if(p.type==='rod'){o.position.fromArray(p.p).add(new THREE.Vector3(...p.b)).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(...p.b).sub(new THREE.Vector3(...p.p)).normalize());}
 else if(p.type!=='tube'){o.position.fromArray(p.p);if(p.axis)o.quaternion.setFromUnitVectors(new THREE.Vector3(0,p.type==='ring'?0:1,p.type==='ring'?1:0),new THREE.Vector3(...p.axis));}
 o.updateMatrix();mesh.userData.rest=o.matrix.clone();return mesh;
});
function updateMeshes(pose){for(const mesh of meshes){const part=mesh.userData.part,pivot=data.assemblies[part.group]||[0,0,0],delta=pose.movingTranslations[part.group]||[0,0,0],angle=part.group==='payoutRotor'?pose.payoutAngle:part.group==='takeupRotor'?pose.takeupAngle:pose.rollerAngles.find(a=>a.group===part.group)?.angle||0;
 const moving=new THREE.Matrix4().makeTranslation(...pivot.map((v,i)=>v+delta[i])).multiply(new THREE.Matrix4().makeRotationZ(angle)).multiply(new THREE.Matrix4().makeTranslation(...pivot.map(v=>-v)));
 mesh.matrixAutoUpdate=false;mesh.matrix.copy(moving).multiply(mesh.userData.rest);mesh.updateMatrixWorld(true);
}}
test('actual opaque solids leave the exposed strand clear through a winding cycle',()=>{
 const s=M.state(),hits=[];
 for(let frame=0;frame<=24;frame++){
  s.distance=frame*M.CONFIG.traverseCycleLength/24;updateMeshes(M.pose(s,data));
  // Check centreline and the interior of its circular section, excluding the
  // exact tangent surface of intentional roller and reel contacts.
  for(const [dy,dz]of [[0,0],[.026,0],[-.026,0],[0,.026],[0,-.026]]){
   const ray=new THREE.Raycaster(new THREE.Vector3(-13.5,3.2+dy,dz),new THREE.Vector3(1,0,0),.0001,26.9999);
   for(const h of ray.intersectObjects(meshes,false))hits.push({frame,offset:[dy,dz],part:h.object.name,point:h.point.toArray()});
  }
 }
 assert.equal(hits.length,0,JSON.stringify(hits.slice(0,12),null,2));
});
test('actual moving geometry stays inside original workcell across the full stroke',()=>{
 const s=M.state(),box=new THREE.Box3();
 for(let i=0;i<=24;i++){s.distance=i*M.CONFIG.traverseCycleLength/24;updateMeshes(M.pose(s,data));
  for(const mesh of meshes){mesh.geometry.computeBoundingBox();box.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
   assert(box.min.x>=-18-1e-5&&box.max.x<=18+1e-5,mesh.name+' crosses short-edge footprint');
   assert(box.min.z>=-9.9-1e-5&&box.max.z<=9.9+1e-5,mesh.name+' crosses row pitch');
  }
 }
});
test('pause, reduced motion, running flag, dt cap and reset obey one state',()=>{
 const s=M.state();s.open=true;M.advance(s,.1);assert(s.distance>0&&s.roof>0);
 const frozen=JSON.stringify(s);M.advance(s,4,{paused:true});assert.equal(JSON.stringify(s),frozen);M.advance(s,4,{reducedMotion:true});assert.equal(JSON.stringify(s),frozen);
 const before=s.distance,roof=s.roof;M.advance(s,.1,{running:false});near(s.distance,before);assert(s.roof>roof);
 for(const dt of [0,-1,NaN,Infinity]){const v=JSON.stringify(s);M.advance(s,dt);assert.equal(JSON.stringify(s),v);}
 const capped=M.state();M.advance(capped,10);near(capped.distance,.2*M.CONFIG.displaySpeed);
 M.reset(s);assert.deepEqual(s,M.state());
});
for(const mesh of meshes)mesh.geometry.dispose();material.dispose();
console.log(JSON.stringify({passed:true,checks,parts:report.partCount,wireLength:report.wireLength,guideCount:report.guideCount,note:'Pure Node and bundled Three.js solid tests. No renderer, browser, screenshot or Anatomy SVG collision audit.'},null,2));
