/* Keep the chosen presentation quality; adapt pixel cost and spatial detail within it. */
'use strict';
window.NZ_PERF = (function () {
  let api,level=0,ratio=1,ready=false,dirty=true,shadowDirty=true,suspended=false,lastFrame=0,lastRegion=-Infinity,lastShadow=0;
  let windowStart=0,warmUntil=0,slowWindows=0,fastSince=0,quality='',regionKey='',shadowKey='',lastNotice='';
  let frameWindow=[],regional=[],cabinetParts=[],stationLights=[],badge;
  const history=[],warmMaterials=[];
  const stats={sourceInstances:0,visibleInstances:0,shadowUpdates:0,regionUpdates:0,focus:'overview',adaptiveChanges:0};
  function pixelRatio(width,height,maximum,requested){
    const pixels=requested==='high'?1850000:requested==='standard'?1350000:1000000;
    const scale=[1,.85,.7,.55][level];
    ratio=Math.min(window.devicePixelRatio||1,maximum,Math.sqrt(pixels/(width*height)))*scale;return ratio;
  }
  function setup(context){
    api=context;warmUntil=performance.now()+3500;
    const host=document.querySelector('#segQuality')?.parentElement;
    if(host){badge=document.createElement('small');badge.id='renderBudget';badge.style.cssText='font-size:11px;opacity:.7;white-space:nowrap;display:block;margin-top:3px';badge.setAttribute('aria-live','polite');host.append(badge);}
    document.addEventListener('visibilitychange',()=>{lastFrame=0;frameWindow=[];warmUntil=performance.now()+1800;});
    api.renderer.domElement.addEventListener('webglcontextrestored',()=>{resetBudget();invalidate();});
  }
  function assetsReady(){
    if(!api)return;
    const T=api.THREE,matrix=new T.Matrix4(),point=new T.Vector3(),scale=new T.Vector3(),rotation=new T.Quaternion();
    api.scene.updateMatrixWorld(true);
    for(const [name,minimum] of [['Campus environment refined','high'],['Renewable refined environment','high'],['Park refined details','high'],['Park standard furnishings','standard'],['PV electrical details','high']]){
      api.scene.getObjectByName(name)?.traverse(mesh=>{
        if(!mesh.isMesh)return;
        mesh.geometry.computeBoundingSphere();
        const world=new T.Matrix4(),entries=[];
        if(mesh.isInstancedMesh){
          for(let index=0;index<mesh.count;index++){
            mesh.getMatrixAt(index,matrix);world.multiplyMatrices(mesh.matrixWorld,matrix);world.decompose(point,rotation,scale);
            point.copy(mesh.geometry.boundingSphere.center).applyMatrix4(world);
            entries.push({matrix:matrix.clone(),x:point.x,z:point.z,radius:mesh.geometry.boundingSphere.radius*Math.max(scale.x,scale.y,scale.z),index});
          }
        }else{
          mesh.matrixWorld.decompose(point,rotation,scale);point.copy(mesh.geometry.boundingSphere.center).applyMatrix4(mesh.matrixWorld);
          entries.push({x:point.x,z:point.z,radius:mesh.geometry.boundingSphere.radius*Math.max(scale.x,scale.y,scale.z)});
        }
        regional.push({mesh,entries,minimum});stats.sourceInstances+=entries.length;
      });
    }
    api.scene.traverse(mesh=>{
      if(mesh.name.startsWith('Station canopy fixture'))stationLights.push(mesh);
      if(!mesh.isMesh||!mesh.castShadow||mesh.isInstancedMesh)return;
      if(/Photoreal station planting/.test(mesh.parent?.name||'')&&/leaf/i.test(mesh.name)){mesh.castShadow=false;return;}
      mesh.geometry?.computeBoundingSphere();const radius=mesh.geometry?.boundingSphere?.radius;
      if(radius!==undefined&&radius*Math.max(mesh.scale.x,mesh.scale.y,mesh.scale.z)<.20)mesh.castShadow=false;
    });
    for(const key of ['panamaSc','panamaSc2']){
      const model=window.NZ_DETAIL?.models[key];
      if(model?.conversion)cabinetParts.push(...model.conversion.children);
    }
    ready=true;invalidate();
    // Precompile against the same linear render target used by the HDR post pipeline.
    // Ghost cabinet materials are otherwise first encountered halfway through the tour.
    const warmRoot=new T.Group();
    const proxies=[];
    for(const [object,material] of warmMaterials)proxies.push([object,material]);
    for(const name of ['SST 北排 charging branch','SST 南排 charging branch']){
      api.scene.getObjectByName(name)?.traverse(object=>{
        if(!object.isMesh)return;
        for(const material of Array.isArray(object.material)?object.material:[object.material]){
          const transparent=material.clone();transparent.transparent=true;transparent.opacity=.5;transparent.depthWrite=false;proxies.push([object,transparent]);
        }
      });
    }
    for(const [object,material] of proxies){const proxy=object.isInstancedMesh?new T.InstancedMesh(object.geometry,material,1):new T.Mesh(object.geometry,material);warmRoot.add(proxy);}
    const previous=api.renderer.getRenderTarget(),target=new T.WebGLRenderTarget(2,2,{type:T.HalfFloatType});
    api.renderer.setRenderTarget(target);
    const compilation=Promise.all([api.renderer.compileAsync(api.scene,api.camera),api.renderer.compileAsync(warmRoot,api.camera,api.scene)]);
    api.renderer.setRenderTarget(previous);
    compilation.catch(error=>console.warn('[Shader warmup]',error.message)).finally(()=>{target.dispose();for(const object of warmRoot.children){if(object.isInstancedMesh)object.dispose();}for(const [,material] of proxies)if(!warmMaterials.some(pair=>pair[1]===material))material.dispose();});
  }
  function invalidate(){dirty=true;shadowDirty=true;}
  function invalidateShadows(){shadowDirty=true;}
  function resetBudget(){level=0;frameWindow=[];slowWindows=0;fastSince=0;windowStart=0;warmUntil=performance.now()+2200;invalidate();}
  function changeLevel(next,now,reason){
    level=next;stats.adaptiveChanges++;warmUntil=now+1800;fastSince=0;slowWindows=0;shadowDirty=true;
    history.push({time:Math.round(now),level,reason});if(history.length>24)history.shift();
    api.resize();
    const message='已调整渲染分辨率，保留'+(api.S.quality==='high'?'精致':'当前')+'档材质与模型';
    if(lastNotice!==message){lastNotice=message;const box=document.querySelector('#toast');if(box){const item=document.createElement('div');item.className='tmsg';item.textContent=message;box.append(item);setTimeout(()=>item.remove(),4200);}}
  }
  function measure(now){
    if(lastFrame&&now>warmUntil&&!document.hidden){const dt=now-lastFrame;if(dt<1200)frameWindow.push(dt);}
    lastFrame=now;if(!windowStart)windowStart=now;
    if(now-windowStart<1200)return;
    if(frameWindow.length>=12){
      frameWindow.sort((a,b)=>a-b);const p75=frameWindow[Math.floor(frameWindow.length*.75)],p95=frameWindow[Math.floor(frameWindow.length*.95)];
      if(p75>22||p95>45){slowWindows++;fastSince=0;if(slowWindows>=2&&level<3)changeLevel(level+1,now,'sustained-slow');}
      else{slowWindows=0;if(p95<19){if(!fastSince)fastSince=now;if(now-fastSince>12000&&level>0)changeLevel(level-1,now,'sustained-headroom');}else fastSince=0;}
    }frameWindow=[];windowStart=now;
  }
  function regions(now){
    if(!ready||(!dirty&&now-lastRegion<250))return;
    lastRegion=now;const {camera,controls,S}=api,target=controls.target;
    const overview=camera.position.y>150||camera.position.distanceTo(target)>260;
    const key=[S.quality,Math.round(target.x/12),Math.round(target.z/12),overview,window.NZ_PHOTO_ASSETS?.audit().active].join('/');
    if(key===regionKey&&!dirty)return;regionKey=key;dirty=false;stats.regionUpdates++;
    stats.focus=overview?'overview':Math.hypot(target.x-64,target.z-98)<90?'charging':'local';
    const radius=S.quality==='high'?(level>=2?105:155):0;stats.visibleInstances=0;
    for(const {mesh,entries,minimum} of regional){
      let count=0;
      for(const item of entries){
        if(overview||S.quality==='compat'||minimum==='high'&&S.quality!=='high'||window.NZ_PHOTO_ASSETS?.hidesEnvironment(mesh,item.index))continue;
        if(Math.hypot(item.x-target.x,item.z-target.z)>radius+item.radius)continue;
        if(mesh.isInstancedMesh)mesh.setMatrixAt(count,item.matrix);count++;
      }
      if(mesh.isInstancedMesh){mesh.count=count;mesh.instanceMatrix.needsUpdate=true;if(count)mesh.computeBoundingSphere();}
      mesh.visible=count>0;stats.visibleInstances+=count;
    }
    shadowDirty=true;
  }
  function shadows(now,light,sun){
    const T=api.THREE,target=api.controls.target;
    const close=api.camera.position.distanceTo(target)<180;
    const extent=close?65:390;
    const cx=Math.round(target.x/4)*4,cz=Math.round(target.z/4)*4;
    const direction=new T.Vector3().subVectors(sun.position,sun.target.position).normalize();
    sun.target.position.set(cx,0,cz);sun.position.copy(sun.target.position).addScaledVector(direction,450);sun.target.updateMatrixWorld();
    Object.assign(sun.shadow.camera,{left:-extent,right:extent,top:extent,bottom:-extent});sun.shadow.camera.updateProjectionMatrix();
    const size=api.S.quality==='high'&&level<2?2048:1024;
    if(sun.shadow.mapSize.x!==size){sun.shadow.mapSize.set(size,size);sun.shadow.map?.dispose();sun.shadow.map=null;shadowDirty=true;}
    const transforms=cabinetParts.map(part=>[part.position.x,part.position.y,part.position.z,part.rotation.y].map(value=>value.toFixed(3)).join(',')).join(';');
    const key=[cx,cz,extent,light.preset,direction.x.toFixed(4),direction.y.toFixed(4),direction.z.toFixed(4),transforms].join('|');
    const dynamic=stats.focus!=='charging';
    const changed=key!==shadowKey||shadowDirty;
    sun.shadow.autoUpdate=false;
    const update=changed||(dynamic&&now-lastShadow>100);
    sun.shadow.needsUpdate=update;
    if(update){lastShadow=now;shadowKey=key;shadowDirty=false;stats.shadowUpdates++;}
  }
  function beforeRender(light,sun,post){
    if(!api)return;const now=performance.now();
    if(window.GOBI_DCDT?.isOpen()){suspended=true;lastFrame=0;frameWindow=[];return;}
    if(suspended){suspended=false;warmUntil=now+1800;invalidate();}
    if(api.S.quality!==quality){quality=api.S.quality;resetBudget();}
    measure(now);window.NZ_PHOTO_ASSETS?.updateLOD();regions(now);shadows(now,light,sun);
    const night=light.preset==='night'||light.preset==='follow'&&light.night;
    post?.setParams({ao:quality==='high'&&level<2,aoGain:1.15,strength:night&&level<3?.10:0});
    const nearby=Math.hypot(api.controls.target.x-64,api.controls.target.z-98)<120&&api.camera.position.y<160;
    stationLights.forEach((object,index)=>{object.visible=night&&nearby&&quality!=='compat'&&index<(level>1?2:6);});
    if(badge){const w=api.renderer.domElement.width,h=api.renderer.domElement.height;const text=`${quality==='high'?'精致':quality==='standard'?'标准':'兼容'} · ${level?'流畅优先':'自适应'}`;if(badge.textContent!==text)badge.textContent=text;badge.title=`内部渲染 ${w} × ${h}；按设备性能调整分辨率与特效，保留所选画质档位。`;}
  }
  return {setup,assetsReady,beforeRender,pixelRatio,resetBudget,invalidate,invalidateShadows,registerWarmMaterial:(object,material)=>warmMaterials.push([object,material]),shouldRender:()=>!window.GOBI_DCDT?.isOpen(),
    status:()=>({...stats,ready,level,suspended,pixelRatio:ratio,quality,history:[...history],post:api?.post()?.budget?.()})};
})();
