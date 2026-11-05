/* Scene-independent Three.js adapter; callable with the outer or iframe Three namespace. */
(function(root,factory){'use strict';const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.NZ_SST_THREE=api;})(typeof globalThis!=='undefined'?globalThis:this,function(global){
 'use strict';
 function build(T,options){
  options=options||{};const M=options.modelAPI||global.NZ_SST_MODEL;if(!M)throw Error('NZ_SST_MODEL must load before NZ_SST_THREE');
  const data=options.data||M.create(options),validation=M.audit(data);if(!validation.passed)throw Error('Invalid SST geometry: '+validation.errors.join('; '));
  const root=new T.Group();root.name='SST concept assembly';root.userData.sst=true;root.userData.concept=true;
  if(options.scale!==undefined){if(typeof options.scale==='number')root.scale.setScalar(options.scale);else root.scale.fromArray(options.scale);}
  const groups={},mats={},geos={},buckets=new Map(),meshes=[],scratch=new T.Matrix4(),position=new T.Vector3(),scale=new T.Vector3(),rotation=new T.Quaternion(),up=new T.Vector3(0,1,0),normal=new T.Vector3(0,0,1),axis=new T.Vector3();
  for(const name of ['fixed','shell','doors']){groups[name]=new T.Group();groups[name].name='SST '+name;root.add(groups[name]);}
  for(const [name,color]of Object.entries(data.colors)){
   const green=name.indexOf('green')===0;
   mats[name]=new T.MeshStandardMaterial({color,roughness:name==='copper'?.34:.62,metalness:['steel','alloy','copper','core'].includes(name)?.5:.08,emissive:green?color:0x000000,emissiveIntensity:green?.035:0});
   mats[name].userData=mats[name].userData||{};mats[name].userData.sstGreen=green;
  }
  geos.box=new T.BoxGeometry(1,1,1);geos.cylinder=new T.CylinderGeometry(1,1,1,options.detail==='simple'?12:20,1,false);
  function shapeKey(p){if(p.type==='ring')return 'ring-'+(p.t/p.r).toFixed(5);return p.type==='box'?'box':'cylinder';}
  for(const p of data.parts){
   const geo=shapeKey(p),key=p.assembly+'|'+p.mat+'|'+geo;
   if(!geos[geo])geos[geo]=new T.TorusGeometry(1,p.t/p.r,6,options.detail==='simple'?18:32);
   if(!buckets.has(key))buckets.set(key,{assembly:p.assembly,mat:p.mat,geo,parts:[]});buckets.get(key).parts.push(p);
  }
  function matrix(p){
   rotation.set(0,0,0,1);
   if(p.type==='box'){position.fromArray(p.p);scale.fromArray(p.size);}
   else if(p.type==='rod'){
    position.set((p.a[0]+p.b[0])/2,(p.a[1]+p.b[1])/2,(p.a[2]+p.b[2])/2);axis.set(p.b[0]-p.a[0],p.b[1]-p.a[1],p.b[2]-p.a[2]);const len=axis.length();axis.multiplyScalar(1/len);rotation.setFromUnitVectors(up,axis);scale.set(p.r,len,p.r);
   }else{position.fromArray(p.p);axis.fromArray(p.axis);rotation.setFromUnitVectors(p.type==='ring'?normal:up,axis);scale.set(p.r,p.type==='ring'?p.r:p.h,p.r);}
   return scratch.compose(position,rotation,scale);
  }
  for(const bucket of buckets.values()){
   if(T.InstancedMesh){
    const mesh=new T.InstancedMesh(geos[bucket.geo],mats[bucket.mat],bucket.parts.length);mesh.name='SST '+bucket.assembly+' '+bucket.mat+' '+bucket.geo;mesh.userData.sstPartIds=bucket.parts.map(p=>p.id);
    bucket.parts.forEach((p,i)=>mesh.setMatrixAt(i,matrix(p)));mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=true;mesh.receiveShadow=true;
    // Older bundled Three releases do not bound transformed instances correctly.
    mesh.frustumCulled=false;groups[bucket.assembly].add(mesh);meshes.push(mesh);
   }else for(const p of bucket.parts){const mesh=new T.Mesh(geos[bucket.geo],mats[bucket.mat]);mesh.name=p.name;mesh.matrixAutoUpdate=false;mesh.matrix.copy(matrix(p));mesh.castShadow=true;mesh.receiveShadow=true;groups[bucket.assembly].add(mesh);meshes.push(mesh);}
  }
  let exploded=0,highlight=0,opacity=1;
  const clamp=v=>Math.max(0,Math.min(1,Number(v)||0)),smooth=v=>v*v*(3-2*v);
  function setExplode(value){
   exploded=clamp(value);const doors=smooth(Math.min(1,exploded/.4)),shell=smooth(Math.max(0,(exploded-.15)/.85));
   groups.doors.position.fromArray(data.assemblies.doors.move).multiplyScalar(doors);groups.shell.position.fromArray(data.assemblies.shell.move).multiplyScalar(shell);return api;
  }
  function setHighlight(value){highlight=clamp(value===true?1:value);for(const m of Object.values(mats))if(m.userData.sstGreen)m.emissiveIntensity=.035+.3*highlight;root.userData.highlight=highlight;return api;}
  function setOpacity(value){opacity=clamp(value);for(const m of Object.values(mats)){const trans=opacity<.999;if(m.transparent!==trans){m.transparent=trans;m.needsUpdate=true;}m.opacity=opacity;m.depthWrite=!trans;}return api;}
  let disposed=false;
  function dispose(){if(disposed)return;disposed=true;for(const mesh of meshes)if(typeof mesh.dispose==='function')mesh.dispose();for(const g of new Set(Object.values(geos)))g.dispose();for(const m of Object.values(mats))m.dispose();root.removeFromParent?root.removeFromParent():root.parent&&root.parent.remove(root);}
  const api={root,groups,data,parts:data.parts,ports:data.ports,dimensions:data.dimensions,materials:mats,setExplode,setHighlight,setOpacity,dispose,audit:()=>({...validation,batchCount:meshes.length,exploded,highlight,opacity})};
  setExplode(options.explode||0);setHighlight(options.highlight||0);return api;
 }
 return {build};
});
