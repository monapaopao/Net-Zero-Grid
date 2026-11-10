'use strict';
window.NZ_PHOTO_ASSETS = (function () {
  let api,active=true,vehicles,plants,plate,atlasMesh,lastLOD='',lastUpdate=-Infinity;
  const prototypes=new Map(),nativeBuffers=[],hiddenEnvironment=new Map(),floorMaterials=new Set(),rebuilt=[],batches=[];
  const counts={near:0,mid:0,far:0};
  const palette=['#e5e5df','#aab1b7','#303942','#315364','#4d6255'];
  const lengths={model3:4.72,yu7:5,li:5.22,ice:4.7,bus:11.8};
  function begin(context){api=context;plants=new api.THREE.Group();plants.name='Photoreal station planting';plants.position.set(64,0,98);}
  function collect(mesh){
    const type=mesh.name.split('__')[0],match=/^vehicle-(model3|yu7|li|ice|bus)(?:-(mid|far))?$/.exec(type);
    if(type!=='landscape'&&!match)return false;
    mesh.matrixWorld.decompose(mesh.position,mesh.quaternion,mesh.scale);mesh.updateMatrix();mesh.castShadow=true;mesh.receiveShadow=true;
    if(type==='landscape'){plants.add(mesh);return true;}
    if(!prototypes.has(match[1]))prototypes.set(match[1],{near:[],mid:[],far:[]});
    prototypes.get(match[1])[match[2]||'near'].push(mesh);mesh.removeFromParent();return true;
  }
  function setActive(value){
    active=value;if(plants)plants.visible=value;if(vehicles)vehicles.visible=value;
    for(const record of nativeBuffers){
      const indices=value?record.keep:record.all;
      indices.forEach((index,target)=>record.mesh.setMatrixAt(target,record.matrices[index]));
      record.mesh.count=indices.length;record.mesh.userData.vehicleIds=indices.map(index=>record.ids[index]);
      record.mesh.instanceMatrix.needsUpdate=true;record.mesh.computeBoundingSphere();
    }
    if(plate){plate.mesh.geometry.setIndex(value?plate.filtered:plate.index);plate.mesh.userData.vehicleRanges=value?plate.ranges:plate.originalRanges;}
    lastLOD='';window.NZ_PERF?.invalidate();
  }
  function plateAtlas(fleet){
    const T=api.THREE,canvas=document.createElement('canvas');canvas.width=2048;canvas.height=256;const ctx=canvas.getContext('2d');
    fleet.forEach((vehicle,index)=>{
      const x=index%8*256,y=Math.floor(index/8)*64;ctx.fillStyle=vehicle.kind==='ice'?'#204e8b':'#8bc28a';ctx.fillRect(x,y,256,64);
      ctx.fillStyle=vehicle.kind==='ice'?'#fff':'#152f21';ctx.font='bold 38px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillText(vehicle.plate,x+128,y+46,238);
    });
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
    const geometry=new T.PlaneGeometry(.48,.12),rects=new T.InstancedBufferAttribute(new Float32Array(fleet.length*2*4),4);geometry.setAttribute('instancePlateRect',rects);
    const material=new T.MeshStandardMaterial({map:texture,roughness:.7});material.name='Shared vehicle registration atlas';
    material.onBeforeCompile=shader=>{
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec4 instancePlateRect;varying vec4 vPlateRect;').replace('#include <begin_vertex>','#include <begin_vertex>\nvPlateRect=instancePlateRect;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec4 vPlateRect;').replace('#include <map_fragment>','#ifdef USE_MAP\n diffuseColor *= texture2D(map,vMapUv*vPlateRect.zw+vPlateRect.xy);\n#endif');
    };material.customProgramCacheKey=()=> 'nz-registration-atlas-v1';
    const mesh=new T.InstancedMesh(geometry,material,fleet.length*2);mesh.name='Photoreal registration atlas';mesh.userData.vehicleIds=[];
    const local=new T.Object3D(),world=new T.Matrix4();
    fleet.forEach((vehicle,index)=>{
      const transform=new T.Matrix4().makeRotationY(vehicle.heading);transform.setPosition(...vehicle.p);
      [-1,1].forEach((side,sideIndex)=>{
        const i=index*2+sideIndex;local.position.set(0,vehicle.kind==='bus'?.68:.51,side*(lengths[vehicle.kind]/2+.025));local.rotation.set(0,side===1?0:Math.PI,0);local.updateMatrix();
        world.multiplyMatrices(transform,local.matrix);mesh.setMatrixAt(i,world);rects.setXYZW(i,index%8/8,1-(Math.floor(index/8)+1)/4,1/8,1/4);mesh.userData.vehicleIds.push(vehicle.id);
      });
    });rects.needsUpdate=true;mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();return mesh;
  }
  function afterBoot(){
    const T=api.THREE;vehicles=new T.Group();vehicles.name='Photoreal charging and parking fleet';
    const fleet=NZ_VEHICLES.audit().vehicles.filter(vehicle=>['charging','parking'].includes(vehicle.zone)&&prototypes.has(vehicle.kind));
    const ids=new Set(fleet.map(vehicle=>vehicle.id));
    fleet.forEach((vehicle,index)=>{const matrix=new T.Matrix4().makeRotationY(vehicle.heading);matrix.setPosition(...vehicle.p);rebuilt.push({...vehicle,matrix,paint:palette[index%palette.length]});});
    for(const [kind,levels] of prototypes){
      const members=rebuilt.filter(vehicle=>vehicle.kind===kind);
      for(const [level,parts] of Object.entries(levels)){
        if(!parts.length)throw new Error('Missing vehicle LOD: '+kind+' '+level);
        for(const part of parts){
          let material=part.material;const painted=material.name.includes('Vehicle paint');if(painted){material=material.clone();material.color.set('#ffffff');}
          const mesh=new T.InstancedMesh(part.geometry,material,members.length);mesh.name='Photoreal '+kind+' '+level+' · '+material.name;
          mesh.userData.vehicleIds=[];mesh.userData.vehicleLOD=level;mesh.receiveShadow=true;mesh.castShadow=/Vehicle paint|Vehicle rubber/.test(material.name);
          if(painted)mesh.setColorAt(0,new T.Color('#ffffff'));
          mesh.count=0;mesh.visible=false;vehicles.add(mesh);batches.push({mesh,kind,level,members,local:part.matrix.clone(),painted});
        }
      }
    }
    atlasMesh=plateAtlas(fleet);vehicles.add(atlasMesh);
    api.scene.traverse(mesh=>{
      if(!mesh.isInstancedMesh)return;const matrix=new T.Matrix4();
      if(mesh.userData.vehicleIds){
        const original=mesh.userData.vehicleIds;if(!original.some(id=>ids.has(id)))return;
        const matrices=original.map((_,index)=>{mesh.getMatrixAt(index,matrix);return matrix.clone();});
        nativeBuffers.push({mesh,ids:[...original],matrices,all:original.map((_,i)=>i),keep:original.map((_,i)=>i).filter(i=>!ids.has(original[i]))});
      }
      if(!mesh.name.startsWith('Instanced environment '))return;
      if(![0x897f69,0x6e947d,0x88a689,0x5e8674].includes(mesh.material.color?.getHex()))return;
      const point=new T.Vector3(),hidden=new Set();
      for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);if([[81,106],[81,117],[81,129],[41,124]].some(([x,z])=>Math.hypot(point.x-x,point.z-z)<2.3))hidden.add(i);}
      hiddenEnvironment.set(mesh,hidden);
    });
    const originalPlates=api.scene.getObjectByName('Vehicle registration plates');
    if(originalPlates){
      const originalRanges=originalPlates.userData.vehicleRanges,filtered=[],ranges=[];
      for(const range of originalRanges){if(ids.has(range.id))continue;const start=filtered.length/3;for(let i=range.start*3;i<(range.start+range.count)*3;i++)filtered.push(i);ranges.push({id:range.id,start,count:range.count});}
      plate={mesh:originalPlates,index:originalPlates.geometry.index,originalRanges,filtered,ranges};
    }
    api.scene.add(plants,vehicles);
    api.scene.traverse(mesh=>{if(!mesh.isMesh||!mesh.material?.name?.includes('Site apron'))return;if(!mesh.geometry.attributes.uv1)mesh.geometry.setAttribute('uv1',mesh.geometry.attributes.uv.clone());floorMaterials.add(mesh.material);});
    setActive(active);updateLOD(true);window.NZ_PERF?.assetsReady();
  }
  function updateLOD(force=false){
    if(!api||!vehicles)return;const now=performance.now();if(!force&&now-lastUpdate<180)return;lastUpdate=now;
    const camera=api.camera,quality=api.S.quality,thresholds=quality==='compat'?[14,65]:[32,120];
    const selection=new Map();counts.near=counts.mid=counts.far=0;
    for(const vehicle of rebuilt){
      const distance=Math.hypot(camera.position.x-vehicle.p[0],camera.position.y-vehicle.p[1],camera.position.z-vehicle.p[2]);
      const previous=vehicle.level,near=thresholds[0]*(previous==='near'?1.12:.94),middle=thresholds[1]*(previous==='mid'?1.10:.94);
      vehicle.level=distance<near?'near':distance<middle?'mid':'far';counts[vehicle.level]++;
      const key=vehicle.kind+'/'+vehicle.level;if(!selection.has(key))selection.set(key,[]);selection.get(key).push(vehicle);
    }
    const signature=quality+'|'+rebuilt.map(vehicle=>vehicle.level).join(',');if(signature===lastLOD&&!force)return;lastLOD=signature;
    const world=new api.THREE.Matrix4(),color=new api.THREE.Color();
    for(const batch of batches){
      const members=selection.get(batch.kind+'/'+batch.level)||[];batch.mesh.count=members.length;batch.mesh.visible=members.length>0;batch.mesh.userData.vehicleIds=members.map(vehicle=>vehicle.id);
      members.forEach((vehicle,index)=>{world.multiplyMatrices(vehicle.matrix,batch.local);batch.mesh.setMatrixAt(index,world);if(batch.painted)batch.mesh.setColorAt(index,color.set(vehicle.paint));});
      batch.mesh.instanceMatrix.needsUpdate=true;if(batch.mesh.instanceColor)batch.mesh.instanceColor.needsUpdate=true;if(members.length)batch.mesh.computeBoundingSphere();
    }
    atlasMesh.visible=counts.near+counts.mid>0;window.NZ_PERF?.invalidateShadows();
  }
  return {begin,collect,afterBoot,setActive,updateLOD,floorMaterials,hidesEnvironment:(mesh,index)=>active&&!!hiddenEnvironment.get(mesh)?.has(index),
    audit:()=>({vehicles:rebuilt.map(({matrix,paint,level,...vehicle})=>({...vehicle,level})),prototypes:[...prototypes.keys()].map(kind=>'vehicle-'+kind),
      nativeInstances:nativeBuffers.reduce((sum,item)=>sum+item.all.length-item.keep.length,0),floorMaterials:floorMaterials.size,active,lod:{...counts},drawBatches:batches.filter(batch=>batch.mesh.visible).length,atlasBatches:1})};
})();
