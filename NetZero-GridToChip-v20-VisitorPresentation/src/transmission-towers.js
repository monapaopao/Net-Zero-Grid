/* Native scene adapter; no per-frame geometry rebuild and no extra render loop. */
'use strict';
window.NZ_TOWERS=(function(){
 const data=window.NZ_TOWER_MODEL.create(window.NZ_MULTI_PLAN.renewableExport),P=window.NZ_MULTI_PLAN.renewableExport;
 P.path=data.path;P.phasePaths=data.phasePaths;
 const color={steel:0x647e7d,alloy:0x9aaaa8,dark:0x385151,concrete:0xccd1c8,ceramic:0xc3d4ca,insulator:0x4f7774,label:0x237d72,conductor:0x8b9a9f};
 const materials={},unit={box:new THREE.BoxGeometry(1,1,1),rod:new THREE.CylinderGeometry(1,1,1,10),bolt:new THREE.CylinderGeometry(1,1,1,6)},groups={},buckets=new Map();let built=false,wireGroup;
 function material(key){return materials[key]||(materials[key]=new THREE.MeshStandardMaterial({color:color[key],roughness:key==='ceramic'?.29:key==='concrete'?.94:.53,metalness:['alloy','steel','conductor'].includes(key)?.48:.04}));}
 const local=p=>p.map((v,i)=>v-data.origin[i]);
 function push(parent,type,mat,p,size,q){const key=type+'|'+mat;let map=buckets.get(parent);if(!map)buckets.set(parent,map=new Map());if(!map.has(key))map.set(key,[]);const o=new THREE.Object3D();o.position.set(...p);o.scale.set(...size);if(q)o.quaternion.copy(q);o.updateMatrix();map.get(key).push(o.matrix.clone());}
 function along(parent,a,b,r,mat,type='rod'){const delta=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize());push(parent,type,mat,a.map((v,i)=>(v+b[i])/2),[r,delta.length(),r],q);}
 function compile(){let draws=0,instances=0;for(const [parent,map]of buckets)for(const [key,matrices]of map){const [type,mat]=key.split('|');const mesh=new THREE.InstancedMesh(unit[type],material(mat),matrices.length);mesh.name='Tower '+parent.name+' '+key;matrices.forEach((v,i)=>mesh.setMatrixAt(i,v));mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);draws++;instances+=matrices.length;}buckets.clear();return {draws,instances};}
 function build(model){if(built)return;built=true;
  for(const tier of ['compat','standard','high']){const g=new THREE.Group();g.name='Transmission '+tier+' components';(tier==='high'?model.fine:model.root).add(g);groups[tier]=g;}
  // Closed, tapered skirts have real thickness and smoothly shaded revolved faces.
  const profile=[[0,-.5],[.42,-.5],[1,-.2],[1,0],[.48,.24],[.42,.5],[0,.5]].map(([r,y])=>new THREE.Vector2(r,y));unit.shed=new THREE.LatheGeometry(profile,20);unit.ring=new THREE.TorusGeometry(1,.096,8,24);unit.angle=unit.box;
  for(const part of data.parts){const g=groups[part.tier],p=part.p&&local(part.p);
   if(part.type==='box'){push(g,'box',part.material,p,part.size);continue;}
   if(part.type==='rod'){along(g,local(part.a),local(part.b),part.r,part.material);continue;}
   if(part.type==='angle'){
    const a=local(part.a),b=local(part.b),d=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize()),c=new THREE.Vector3(...a).add(new THREE.Vector3(...b)).multiplyScalar(.5),w=part.r*1.8,t=w*.24;
    for(const off of [[(w-t)/2,0,0],[0,0,(w-t)/2]]){const center=new THREE.Vector3(...off).applyQuaternion(q).add(c);push(g,'box',part.material,center.toArray(),off[0]?[t,d.length(),w]:[w,d.length(),t],q);}continue;
   }
   const axis=new THREE.Vector3(...(part.axis||[0,1,0])),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),axis);
   if(part.type==='shed')push(g,'shed',part.material,p,[part.r,part.length,part.r],q);
   if(part.type==='bolt')push(g,'bolt',part.material,p,[part.r,part.length,part.r],q);
   if(part.type==='ring'){q.setFromUnitVectors(new THREE.Vector3(0,0,1),axis);push(g,'ring',part.material,p,[part.r,part.r,part.r],q);}
  }
  data.meshStats=compile();
  const cv=document.createElement('canvas');cv.width=512;cv.height=256;const ctx=cv.getContext('2d');ctx.fillStyle='#237d72';ctx.fillRect(0,0,512,256);ctx.fillStyle='#edf4ef';ctx.font='bold 76px Segoe UI';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('XBL · HV',256,128);const tex=new THREE.CanvasTexture(cv);tex.encoding=THREE.sRGBEncoding;
  const labelMaterial=new THREE.MeshStandardMaterial({map:tex,roughness:.8});const labelGeo=new THREE.PlaneGeometry(.54,.27);
  for(const s of data.supports.filter(s=>s.id.startsWith('main'))){const mesh=new THREE.Mesh(labelGeo,labelMaterial);mesh.position.fromArray(local([s.x,2.5,s.z+1.945]));mesh.name=s.id+' identification';groups.high.add(mesh);}

  const lab=LABELS3D.line;if(lab){lab.anc.set(67,19,-40.5);lab.el.querySelector('.nm').textContent='高压架空输电通道';const pr=lab.el.querySelector('.pr');if(pr)pr.textContent='格构塔 / 绝缘悬挂 / 三相导线';}
  INFO.line.t='高压架空输电通道';INFO.line.d='三基格构塔与两端终端构架支撑一组三相展示导线。绝缘子串隔开导线与接地钢结构，塔顶地线连续连接各支撑。西比里架空线作为这一环节的关键装备。';INFO.line.p=INFO.line.p.filter(p=>p[0]!=='出线规模');INFO.line.p.push(['图示结构','2 基转角 V 串塔 / 1 基直线悬垂塔 / 2 座终端架'],['展示导线','一组三相；不以图形数量推导规划回路数']);
  INFO.line.note+=' 塔型、绝缘子数量、尺寸与弧垂为压缩展示，不对应已校验的工程塔型。';
  setQuality(window.NZ_ENGINE.S.quality);
 }
 function wires(){
  wireGroup=new THREE.Group();wireGroup.name='Physical connection trans';wireGroup.userData.deviceKey='line';scene.add(wireGroup);
  for(const path of data.phasePaths)for(let i=1;i<path.length;i++)along(wireGroup,path[i-1],path[i],.055,'conductor');
  const earth=new THREE.Group();earth.name='Transmission continuous earthwire';scene.add(earth);for(let i=1;i<data.earthPath.length;i++)along(earth,data.earthPath[i-1],data.earthPath[i],.032,'alloy');
  const stats=compile();data.wireStats=stats;return wireGroup;
 }
 function setQuality(q){if(!built)return;groups.compat.visible=true;groups.standard.visible=q!=='compat';groups.high.visible=q==='high';}
 function audit(){return {...data,quality:window.NZ_ENGINE.S.quality,tiers:Object.fromEntries(Object.entries(groups).map(([k,g])=>[k,g.visible])),wireVisible:wireGroup?wireGroup.visible:null};}
 return {build,wires,setQuality,audit,data,focus:()=>({pos:[104,32,7],tgt:[67,9,-35]})};
})();
