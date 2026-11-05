/* Native Node geometry and geographic-registry checks; no browser or renderer. */
'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.join(__dirname,'..'),P=require('../src/multi-campus-plan.js'),THREE=require('../src/three.js');
const checks={},test=(name,fn)=>{fn();checks[name]=true;console.log('PASS '+name);};
const overlaps=(a,b)=>a.x0<b.x1-1e-8&&a.x1>b.x0+1e-8&&a.z0<b.z1-1e-8&&a.z1>b.z0+1e-8;
const rect=f=>({x0:f.x-f.w/2,x1:f.x+f.w/2,z0:f.z-f.d/2,z1:f.z+f.d/2});
const H=P.factoryHall,fire=P.sites.emergency;
test('one 56 by 192 hall fits the extended factory site',()=>{
  assert.deepEqual(H.center,[280,18]);assert.deepEqual([H.w,H.d,H.h],[56,192,9]);
  assert.deepEqual(H.bounds,{x0:252,x1:308,z0:-78,z1:114});
  for(const [x,z]of [[252,-78],[308,-78],[252,114],[308,114]])assert(P.contains(P.sites.factory,x,z));
  assert.deepEqual(P.movePoint('factory',[181,0,78]),[280,0,18]);
});
test('maximum five nominal cells fit production with three unit row gaps',()=>{
  assert.deepEqual(H.workcell,{w:36,d:19.8,gap:3});
  assert.deepEqual(H.rows.map(r=>r.center),[[280,-25.6],[280,-2.8],[280,20],[280,42.8],[280,65.6]]);
  const available=H.production.z1-H.production.z0,{d,gap}=H.workcell;
  assert.equal(H.rows.length,Math.floor((available+gap)/(d+gap)));
  assert(H.rows.every(r=>r.rotationY===0&&r.center[1]-d/2>=H.production.z0-1e-8&&r.center[1]+d/2<=H.production.z1+1e-8));
  for(let i=1;i<H.rows.length;i++)assert(Math.abs(H.rows[i].center[1]-H.rows[i-1].center[1]-d-gap)<1e-8);
  assert.equal(H.rows[0].center[0]-H.workcell.w/2,H.sideAisles[0].x1);
  assert.equal(H.rows[0].center[0]+H.workcell.w/2,H.sideAisles[1].x0);
  assert((H.rows.length+1)*d+H.rows.length*gap>available);
});
test('raw and finished goods are integrated internal subzones',()=>{
  const raw=P.facilities.find(f=>f.key==='factoryraw'),pack=P.facilities.find(f=>f.key==='factoryproduct');
  assert.deepEqual([raw.x,raw.z,raw.w,raw.d],[280,-58,44,32]);
  assert.deepEqual([pack.x,pack.z,pack.w,pack.d],[280,96,44,28]);
  for(const f of [raw,pack]){assert.equal(f.integrated,true);const b=rect(f);assert(b.x0>H.bounds.x0&&b.x1<H.bounds.x1&&b.z0>H.bounds.z0&&b.z1<H.bounds.z1);}
  assert.equal(rect(raw).z1,H.rawZone.z1);assert.equal(rect(pack).z0,H.packZone.z0);
});
test('all factory and regional roads clear hall, facilities and relocated fire yard',()=>{
  const buildings=[{key:'factory',...H.bounds},{key:'fireYard',...fire},...P.facilities.filter(f=>!f.integrated).map(f=>({key:f.key,...rect(f)}))];
  for(const [zone,name,x,z,w,d]of P.roads.filter(r=>['factory','regional'].includes(r[0])))for(const b of buildings){
    assert(!overlaps({x0:x,x1:x+w,z0:z,z1:z+d},b),`${zone}/${name} crosses ${b.key}`);
  }
  assert(!overlaps(H.bounds,fire));
  assert(!P.roads.some(r=>r[0]==='factory'&&[48,71.7,106].includes(r[3])));
  const emergency=P.roads.find(r=>r[1]==='三园区应急联络道路');assert.equal(emergency[2]+emergency[4],246);
  assert(P.roads.some(r=>r[1]==='制造区西侧应急入口'&&r[2]===238&&r[3]===20));
});
test('fire service gates meet chemical and compute perimeter routes',()=>{
  assert.deepEqual([fire.x0,fire.x1,fire.z0,fire.z1],[118,182,-99,-47]);
  assert.deepEqual(fire.gate,[150,-47]);assert.deepEqual(fire.serviceGate,[174,-99]);
  const north=P.roads.find(r=>r[1]==='消防站北侧接驳'),south=P.roads.find(r=>r[1]==='消防站南侧出警通道');
  assert.equal(north[2]+north[4]/2,fire.serviceGate[0]);assert.equal(north[3]+north[5],fire.serviceGate[1]);
  assert.equal(north[3],-106);assert.equal(south[2]+south[4]/2,fire.gate[0]);assert.equal(south[3],fire.gate[1]);assert.equal(south[3]+south[5],-29);
});
test('landscape protection uses the whole new hall and moved fire yard',()=>{
  const c={window:{NZ_MULTI_PLAN:P,NZ_CHEMICAL_PLAN:require('../src/chemical-campus-plan.js')}};vm.createContext(c);
  vm.runInContext(fs.readFileSync(path.join(ROOT,'src/campus-environment-plan.js'),'utf8'),c);
  const protectedAreas=c.window.NZ_ENVIRONMENT_PLAN.protectedAreas;
  assert.deepEqual(JSON.parse(JSON.stringify(protectedAreas.find(x=>x.key==='factory'))),{key:'factory',...H.bounds});
  assert.deepEqual(JSON.parse(JSON.stringify(protectedAreas.find(x=>x.key==='fire'))),{key:'fire',x0:118,x1:182,z0:-99,z1:-47});
  assert.equal(c.window.NZ_ENVIRONMENT_PLAN.roads,P.roads);
});

// Exercise the actual scene-building functions with native Three.js objects.
// Only Canvas text is stubbed; these checks require no WebGL/DOM implementation.
const scene=new THREE.Scene(),models={},labels={},devices=[],info={},pads=[],parts=[];
const textElement=()=>({textContent:'',append(){},querySelector(){return textElement();}});
const canvas={width:0,height:0,getContext(){return {fillRect(){},fillText(){}};}};
const group=(parent,name)=>{const g=new THREE.Group();g.name=name;parent.add(g);return g;};
const T={models,C:{steel:0x829b97,white:0xf1f4ef,shell:0xe3eae7,teal:0x238e83,red:0xad6458,dark:0x334c4d,glass:0x749e9b},group,
  model(key,x,z){const root=group(scene,'Detailed '+key),fine=group(root,'Close-range components');root.position.set(x,0,z);return models[key]={root,fine,x,z};},
  box(w,h,d,c,x,y,z,g){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshBasicMaterial({color:c}));m.position.set(x,y,z);g.add(m);parts.push({kind:'box',w,h,d,x,y,z,parent:g});return m;},
  cylinder(r,h,c,x,y,z,g){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,8),new THREE.MeshBasicMaterial({color:c}));m.position.set(x,y,z);g.add(m);return m;},
  rod(a,b,r,c,g){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,av.distanceTo(bv),8),new THREE.MeshBasicMaterial({color:c}));m.position.copy(av).add(bv).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),bv.sub(av).normalize());g.add(m);return m;},
  door(){},vent(){},fan(){},pad(x,z,w,d,g){pads.push({x,z,w,d,parent:g});this.box(w,.24,d,0x829b97,x,.12,z,g);}
};
// pad is destructured by the production functions, so bind its toolkit receiver.
T.pad=T.pad.bind(T);
const addLabel=(key,p)=>{labels[key]={anc:new THREE.Vector3(...p),el:textElement(),lv:textElement()};devices.push({key,p:p.slice(),r:1});};
const context={window:{NZ_MULTI_PLAN:P,NZ_DETAIL:{models},NZ_CHEMICAL:{focus(){return null;}}},THREE,scene,LABELS3D:labels,DEVICES:devices,INFO:info,addLabel,document:{createElement(type){return type==='canvas'?canvas:textElement();}}};
vm.createContext(context);
const source=fs.readFileSync(path.join(ROOT,'src/multi-campus.js'),'utf8').replace('return {apply,ready,update,setQuality,focus,audit,obstructions,connections:()=>connections};','return {apply,ready,update,setQuality,focus,audit,obstructions,connections:()=>connections,_spatial:{shell,fireStation,fence,electrical,completeConnections,setToolkit(t){T=t;}}};');
vm.runInContext(source,context);const multi=context.window.NZ_MULTI;multi._spatial.setToolkit(T);
const legacy=group(scene,'Scaled legacy fire');legacy.position.set(150,0,-78);
test('integrated subzone registration creates labels and picks without old boxes or pads',()=>{
  for(const key of ['factoryraw','factoryproduct']){
    const f=P.facilities.find(x=>x.key===key),before=pads.length,m=multi._spatial.shell(f);
    assert.equal(pads.length,before);assert.equal(m.root.children.filter(x=>x.isMesh).length,0);
    assert.equal(m.root.userData.integrated,true);assert.equal(m.root.userData.parentFacility,'factory');
    assert.deepEqual(labels[key].anc.toArray(),[f.x,f.h+3,f.z]);assert.deepEqual(Array.from(devices.find(x=>x.key===key).p),[f.x,2.5,f.z]);
  }
});
test('fire pad, complete local station geometry, label and selection relocate together',()=>{
  multi._spatial.fireStation();scene.updateMatrixWorld(true);
  assert.deepEqual(models.fireYard.root.position.toArray(),[150,0,-73]);
  assert.deepEqual(legacy.position.toArray(),[150,.35,-78]);
  const pad=pads.find(p=>p.parent===models.fireYard.root);assert.deepEqual([pad.w,pad.d],[64,52]);
  const padBox=new THREE.Box3().setFromObject(models.fireYard.root.children.find(o=>o.isMesh&&o.geometry.type==='BoxGeometry'));
  assert.deepEqual([padBox.min.x,padBox.max.x,padBox.min.z,padBox.max.z],[118,182,-99,-47]);
  assert.deepEqual(labels.fire.anc.toArray(),[150,10.5,-76]);assert.deepEqual(Array.from(devices.find(d=>d.key==='fire').p),[150,4,-78]);
  const bounds=new THREE.Box3().setFromObject(models.fireYard.root);assert(bounds.max.x<183&&bounds.min.x>117&&bounds.min.z>-100&&bounds.max.z<-46);
});
test('factory west and compute north fences leave usable emergency openings',()=>{
  const factoryFence=group(scene,'factory fence'),computeFence=group(scene,'compute fence');
  multi._spatial.fence(P.sites.factory,factoryFence);multi._spatial.fence(P.sites.compute,computeFence);
  assert(!parts.some(p=>p.parent===factoryFence&&p.x===238&&p.z>14&&p.z<30));
  assert(!parts.some(p=>p.parent===computeFence&&p.z===-36&&p.x>143&&p.x<157));
});
test('selection cameras cover new hall and internal warehouse coordinates',()=>{
  for(const [key,pos,tgt]of [['factory',[365,120,200],[280,3,18]],['factoryraw',[312,38,-14],[280,2,-58]],['factoryproduct',[312,38,140],[280,2,96]],['fire',[214,48,-4],[150,3,-73]]]){
    const camera=multi.focus(key);assert.deepEqual(Array.from(camera.pos),pos);assert.deepEqual(Array.from(camera.tgt),tgt);
  }
});
test('all designated utility ports remain on the southern apron or hall south face',()=>{
  assert.deepEqual(H.ports,{control:[260,2,127.5],utility:[308,1.4,117],process:[304,1.4,114],heat:[308,5.3,122]});
  assert.equal(H.ports.process[2],H.bounds.z1);assert.equal(H.ports.utility[2],rect(P.facilities.find(f=>f.key==='factoryutility')).z0);
});
// Build the production electrical paths. The minimal interpolation below is the
// same polyline contract consumed by route(); it does not emulate a renderer.
context.EDGES=['h2gas','h2use'].map(key=>({key,pw:()=>1,points:new THREE.Points(new THREE.BufferGeometry(),new THREE.PointsMaterial({color:0x398ad1})),visualTube:new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial({color:0x398ad1}))}));context.PART_CAP=64;
context.S={factory:50,demandServedMW:230,dcLoadMW:150,sc:10,metal:15,h2P:5,nh3KgH:100,fcMW:0,stP:0};
context.window.NZ_CONFIG={PLANT:{ammoniaMWhPerT:.2,fuelCellKgPerMWh:40}};
context.window.NZ_CHEMICAL_PLAN=require('../src/chemical-campus-plan.js');
context.edgePoint=(edge,d)=>{
  let remaining=d*edge.len;
  for(let i=1;i<edge.pts.length;i++){
    const a=new THREE.Vector3(...edge.pts[i-1]),b=new THREE.Vector3(...edge.pts[i]),len=a.distanceTo(b);
    if(remaining<=len||i===edge.pts.length-1)return a.lerp(b,len?Math.min(1,remaining/len):0).toArray();
    remaining-=len;
  }
  return edge.pts[edge.pts.length-1];
};
const registerFixture=key=>{if(!models[key])T.model(key,0,0);if(!labels[key])addLabel(key,[0,0,0]);if(!info[key])info[key]={t:key,p:[],note:''};};
for(const key of ['panamaSc','chemicalfeed','factoryfeed','supercharge','carport','cooling','ups','noc','dc'])registerFixture(key);
test('actual electric feed follows exterior corridors and reaches the new control and hall ports',()=>{
  multi._spatial.electrical();
  const feed=context.EDGES.find(e=>e.key==='feedOut'),factory=context.EDGES.find(e=>e.key==='facE');
  assert.deepEqual(Array.from(feed.pts[feed.pts.length-1]),H.ports.control);
  assert.deepEqual(Array.from(factory.pts[0]),H.ports.control);
  assert.deepEqual(Array.from(factory.pts[factory.pts.length-1]),H.ports.process);
  for(const e of [feed,factory])for(let i=1;i<e.pts.length;i++){
    const a=e.pts[i-1],b=e.pts[i];
    // The final termination touches the south face; no feeder crosses a line,
    // raw-material bay or warehouse while getting there.
    for(let j=0;j<=20;j++){
      const t=j/20,x=a[0]+(b[0]-a[0])*t,z=a[2]+(b[2]-a[2])*t;
      assert(!(x>H.bounds.x0&&x<H.bounds.x1&&z>H.bounds.z0&&z<H.bounds.z1),e.key+' crosses hall');
    }
  }
});
test('physical utility pipe joins the equipment side to the hall face with a real right-angle elbow',()=>{
  const before=parts.length;
  multi._spatial.completeConnections();
  const physical=context.EDGES.find(e=>e.key==='facE');
  assert(physical.visualTube.geometry.attributes.position.count>0);
  scene.updateMatrixWorld(true);
  const utilityPipe=models['v10 process and support interfaces'].root;
  const centerOf=o=>o.getWorldPosition(new THREE.Vector3()).toArray();
  const at=(a,b)=>a.every((v,i)=>Math.abs(v-b[i])<1e-5);
  const pipeCenters=utilityPipe.children.filter(o=>o.isMesh&&o.geometry.type==='CylinderGeometry').map(centerOf);
  assert(pipeCenters.some(p=>at(p,[308,1.4,115.5])),'missing vertical-in-plan utility stub');
  assert(pipeCenters.some(p=>at(p,[306,1.4,114])),'missing horizontal hall connector');
  // No building geometry is introduced by the connecting-line construction.
  assert(!parts.slice(before).some(p=>p.w===56&&p.d===192));
});
console.log(JSON.stringify({passed:true,checks:Object.keys(checks).length,rows:H.rows.length,hall:H.bounds,fire:{x0:fire.x0,x1:fire.x1,z0:fire.z0,z1:fire.z1}},null,2));
