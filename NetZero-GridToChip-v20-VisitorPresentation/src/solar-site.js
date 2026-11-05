/* v8 PV service belt, civil-time solar check and camera compass. No power changes. */
'use strict';
window.NZ_SOLAR=(function(){
  const P=window.NZ_SOLAR_PLAN,T=window.NZ_RENEWABLE_PLAN;
  const coarse=new THREE.Group(),fine=new THREE.Group(),routes=new THREE.Group();
  coarse.name='PV electrical service belt';fine.name='PV electrical details';routes.name='PV collection ducts';
  scene.add(coarse,fine,routes);
  const C={white:0xe3eae7,edge:0xc9d4cf,steel:0x829b97,dark:0x355958,teal:0x238e83,copper:0xba8847};
  const boxG=new THREE.BoxGeometry(1,1,1),rodG=new THREE.CylinderGeometry(1,1,1,10),materials=new Map(),buckets=new Map(),deviceRoots=[];
  function mat(color){if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.76,metalness:.12}));return materials.get(color);}
  function put(g,type,size,color,pos,quaternion){
    let map=buckets.get(g);if(!map)buckets.set(g,map=new Map());const key=type+':'+color;
    if(!map.has(key))map.set(key,{geometry:type==='box'?boxG:rodG,material:mat(color),matrices:[]});
    const o=new THREE.Object3D();o.position.set(...pos);o.scale.set(...size);if(quaternion)o.quaternion.copy(quaternion);o.updateMatrix();map.get(key).matrices.push(o.matrix.clone());
  }
  const box=(g,w,h,d,c,x,y,z)=>put(g,'box',[w,h,d],c,[x,y,z]);
  function rod(g,a,b,r,c){const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),delta=q.clone().sub(p);put(g,'rod',[r,delta.length(),r],c,p.add(q).multiplyScalar(.5).toArray(),new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));}
  function plaque(g,text,x,y,z,w=2){
    const cv=document.createElement('canvas');cv.width=384;cv.height=80;const ctx=cv.getContext('2d');ctx.fillStyle='#edf3ef';ctx.fillRect(0,0,384,80);ctx.fillStyle='#355958';ctx.font='bold 28px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,192,40,366);
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w,w*80/384),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(cv),side:THREE.DoubleSide}));m.position.set(x,y,z);g.add(m);
  }
  P.equipment.forEach((e,i)=>{
    const g=new THREE.Group(),f=new THREE.Group();g.position.set(e.x,0,e.z);f.position.copy(g.position);g.name=e.name;f.name=e.name+' details';coarse.add(g);fine.add(f);deviceRoots.push({id:e.id,g,f});
    box(g,e.w,.22,e.d,C.edge,0,.16,0);
    if(e.kind==='inverter'){
      box(g,3.8,1.9,1.4,C.white,0,1.22,0);box(g,4,.12,1.6,C.steel,0,2.23,0);
      for(const x of [-1.25,0,1.25]){
        box(g,1.18,1.65,.07,C.edge,x,1.25,.74);box(f,.26,.16,.035,C.teal,x,1.85,.80);box(f,.045,.35,.04,C.dark,x+.4,1.25,.81);
        for(let n=0;n<6;n++)box(f,.9,.045,.05,C.dark,x,.53+n*.09,.80);
      }
      plaque(f,'INV '+(Math.floor(i/2)+1)+' · 组串逆变',0,2.03,.82,2.8);
    }else if(e.kind==='transformer'){
      box(g,5.1,2.7,3.8,C.white,0,1.64,0);box(g,5.4,.16,4.1,C.steel,0,3.09,0);
      for(const x of [-1.6,0,1.6]){
        box(g,1.5,2.45,.06,C.edge,x,1.65,1.94);box(f,.06,.42,.07,C.dark,x+.5,1.65,2.01);
        for(let n=0;n<9;n++)box(f,1.12,.05,.06,C.dark,x,.65+n*.1,2.01);
      }
      plaque(f,'BOX TR · 升压至 35 kV',0,2.68,2.03,3.3);
      rod(f,[-3,.3,-2.4],[3,.3,-2.4],.045,C.copper);
      for(const x of [-3,3])rod(f,[x,.3,-2.4],[x,.1,-2.4],.075,C.copper);
    }else if(e.kind==='secondary'){
      box(g,6.6,2.6,1.9,C.white,0,1.58,0);box(g,6.9,.15,2.2,C.steel,0,2.95,0);
      for(let n=0;n<4;n++){const x=-2.5+n*1.65;box(g,1.5,2.1,.08,C.edge,x,1.51,1);box(f,.38,.21,.04,C.teal,x,2.1,1.06);}
      plaque(f,'计量 / 继保 / SCADA',0,2.67,1.08,4.5);
    }else{
      for(let n=0;n<5;n++){const x=-4+n*2;box(g,1.75,2.5,1.8,C.white,x,1.57,0);box(g,1.65,2.22,.08,C.edge,x,1.6,.94);box(f,.36,.2,.03,C.teal,x,2.31,1.01);box(f,.05,.35,.04,C.dark,x+.53,1.55,1.01);}
      box(g,10.5,.12,2.2,C.steel,0,2.88,0);plaque(f,'35 kV · 集电 / 母线 / 出线',0,2.66,1.04,7.5);
    }
  });
  function duct(name,pts,width=.34,color=C.steel){
    for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.atan2(b[0]-a[0],b[1]-a[1]));put(routes,'box',[width,.055,len],color,[(a[0]+b[0])/2,.105,(a[1]+b[1])/2],q);}
  }
  const connections=[];
  const connect=(id,from,to,pts)=>{connections.push({id,from,to,pts});duct(id,pts);};
  const inverters=P.equipment.filter(e=>e.kind==='inverter');
  inverters.forEach((e,i)=>{
    const tr=P.equipment.filter(t=>t.kind==='transformer'&&t.x===e.x).sort((a,b)=>Math.abs(a.z-e.z)-Math.abs(b.z-e.z))[0];
    const ext=e.id.startsWith('extension'),busZ=ext?168:123.8;
    connect('dc-'+i,'PV blocks '+i,e.id,[[e.x,ext?153.5:101.3],[e.x,e.z-e.d/2]]);
    connect('ac-'+i,e.id,tr.id,[[e.x,e.z+e.d/2],[e.x,tr.z-tr.d/2]]);
    connect('mv-'+i,tr.id,'collector',[[tr.x,tr.z+tr.d/2],[tr.x,busZ],[-65,busZ],[-65,120],[-75,120]]);
  });
  connect('secondary','collector','secondary',[[-82,118],[-88,118],[-88,108],[-86,108]]);
  connect('outgoing','collector','substation',[[-75,120],[-65,120],[-65,78]]);
  // A continuous service walkway, in the clear band between inverter and transformer pads.
  duct('maintenance walk',[[-175,110.5],[-72,110.5]],1.7,0xc4c7b6);
  duct('exit walk',[[-174,125],[-73,125]],1.4,0xc4c7b6);
  for(const [x,z] of [[-174,123],[-75,124]]){
    box(fine,.65,.15,.65,C.edge,x,.13,z);rod(fine,[x,.2,z],[x,7,z],.055,C.steel);rod(fine,[x,7,z],[x,8,z],.025,C.steel);
    rod(fine,[x,.16,z],[x,0,z],.08,C.copper);
  }
  for(const [g,map] of buckets)for(const b of map.values()){
    const mesh=new THREE.InstancedMesh(b.geometry,b.material,b.matrices.length);b.matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=g!==routes;mesh.receiveShadow=true;g.add(mesh);
  }
  buckets.clear();

  const compass=document.createElement('div');compass.id='campusCompass';compass.setAttribute('role','img');compass.setAttribute('aria-label','园区指南针，随视角旋转');
  compass.innerHTML='<svg viewBox="0 0 88 88" aria-hidden="true"><circle cx="44" cy="44" r="31" fill="none" stroke="#c9d7d3"/><path id="compassNeedle" fill="#087d73"/><circle cx="44" cy="44" r="3" fill="#829b97"/>'+['北','东','南','西'].map((s,i)=>'<text data-cardinal="'+i+'" text-anchor="middle" dominant-baseline="central" fill="'+(i===0?'#087d73':'#5d7879')+'">'+s+'</text>').join('')+'</svg><span>园区方向</span>';
  document.getElementById('sceneFrame').append(compass);
  let compassPoints=[],lastRight=[1,0];
  function updateCompass(){
    camera.updateMatrixWorld(true);const v=camera.matrixWorld.elements;let x=v[0],z=v[2],len=Math.hypot(x,z);
    if(len<1e-5)[x,z]=lastRight;else{x/=len;z/=len;lastRight=[x,z];}
    const vectors=[[-z,-x],[x,-z],[z,x],[-x,z]];
    compassPoints=vectors.map(([dx,dy],i)=>({direction:['N','E','S','W'][i],x:44+dx*33,y:44+dy*33}));
    compass.querySelectorAll('text').forEach((el,i)=>{el.setAttribute('x',compassPoints[i].x.toFixed(2));el.setAttribute('y',compassPoints[i].y.toFixed(2));});
    const [nx,ny]=vectors[0],px=-ny,py=nx;
    document.getElementById('compassNeedle').setAttribute('d','M '+(44+nx*25)+' '+(44+ny*25)+' L '+(44+px*4)+' '+(44+py*4)+' L '+(44-nx*10)+' '+(44-ny*10)+' L '+(44-px*4)+' '+(44-py*4)+' Z');
    const mobile=innerWidth<=780,card=document.getElementById('infoCard');
    const raised=mobile&&!!card&&card.classList.contains('open');
    if(raised){
      const frame=document.getElementById('sceneFrame').getBoundingClientRect(),top=card.getBoundingClientRect().top;
      compass.style.bottom=Math.max(15,frame.bottom-top+12)+'px';compass.style.visibility=top-frame.top<108?'hidden':'';
    }else{compass.style.bottom='';compass.style.visibility='';}
  }
  const checkGroup=new THREE.Group();checkGroup.name='Solar position verification';checkGroup.position.set(-128,.95,73);checkGroup.visible=false;scene.add(checkGroup);
  const marker=new THREE.Mesh(new THREE.SphereGeometry(.9,12,8),new THREE.MeshBasicMaterial({color:0xd89737}));checkGroup.add(marker);
  const arc=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0xd89737,transparent:true,opacity:.7}));checkGroup.add(arc);
  const shadows=new THREE.InstancedMesh(new THREE.BoxGeometry(1.82,.012,1.22),new THREE.MeshBasicMaterial({color:0xbc5d55,transparent:true,opacity:.55,depthWrite:false}),P.panels.length);shadows.count=0;shadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(shadows);shadows.visible=false;
  let panel,enabled=false,quality='standard',diagnostic=null,pending=0;
  function rayBox(origin,dir,b){
    let near=0,far=Infinity;
    for(let k=0;k<3;k++){const low=b.min[k]-origin[k],high=b.max[k]-origin[k];if(Math.abs(dir[k])<1e-8){if(low>0||high<0)return false;continue;}let a=low/dir[k],c=high/dir[k];if(a>c)[a,c]=[c,a];near=Math.max(near,a);far=Math.min(far,c);if(near>far)return false;}
    return far>.05;
  }
  function check(settings=P.cfg){
    const sun=P.sun(settings),dir=sun.direction,n=P.normal(settings),incidence=Math.max(0,n.reduce((s,v,i)=>s+v*dir[i],0));
    const yaw=(180-settings.azimuthDeg)*P.rad,tilt=settings.tiltDeg*P.rad;
    const axisX=[Math.cos(yaw),0,-Math.sin(yaw)],axisZ=[Math.sin(yaw)*Math.cos(tilt),-Math.sin(tilt),Math.cos(yaw)*Math.cos(tilt)];
    const obstructions=P.equipment.map(e=>({kind:'设备',min:[e.x-e.w/2,0,e.z-e.d/2],max:[e.x+e.w/2,e.h+.25,e.z+e.d/2]}));
    const trees=window.NZ_RENEWABLES.audit(true).planted.filter(p=>p.kind==='tree').map(p=>({kind:'绿植',min:[p.x-p.r,p.y+p.r,p.z-p.r],max:[p.x+p.r,p.y+p.r*2.7,p.z+p.r]}));
    obstructions.push(...trees,...window.NZ_MULTI.obstructions());
    for(const p of window.NZ_ENVIRONMENT.audit(true).planted.filter(p=>p.kind==='tree'))obstructions.push({kind:'绿植',min:[p.x-p.r,1,p.z-p.r],max:[p.x+p.r,6,p.z+p.r]});
    const counts={组件:0,设备:0,绿植:0,地形:0},blocked=[];
    const reach=sun.direction[1]>0?Math.min(800,4/Math.max(.005,sun.direction[1])):0;
    if(sun.elevation>0&&incidence>1e-6)P.panels.forEach((p,index)=>{
      const o=[p.x,p.y+.045,p.z];let kind=null;
      for(const b of obstructions)if(rayBox(o,dir,b)){kind=b.kind;break;}
      if(!kind)for(const q of P.panels){
        if(q===p||Math.abs(q.x-p.x)>reach||Math.abs(q.z-p.z)>reach)continue;const time=n.reduce((v,a,k)=>v+a*([q.x,q.y,q.z][k]-o[k]),0)/incidence;if(time<.06)continue;
        const relative=o.map((v,k)=>v+time*dir[k]-[q.x,q.y,q.z][k]);
        if(Math.abs(relative.reduce((v,a,k)=>v+a*axisX[k],0))<P.width/2&&Math.abs(relative.reduce((v,a,k)=>v+a*axisZ[k],0))<P.depth/2){kind='组件';break;}
      }
      if(!kind)for(let distance=3;distance<700;distance+=3){
        const x=o[0]+dir[0]*distance,z=o[2]+dir[2]*distance;
        if(x<T.bounds.x0||x>T.bounds.x1||z<T.bounds.z0||z>T.bounds.z1)break;
        if(T.height(x,z)>o[1]+dir[1]*distance+.04){kind='地形';break;}
      }
      if(kind){counts[kind]++;blocked.push(index);}
    });
    return {sun,incidence,counts,blocked,method:'代表组件中心采样；设备与树冠包围盒保守估算，地形步进约 3 个展示单位',winter:P.audit(settings).winter};
  }
  function refresh(){
    diagnostic=check();const points=[];
    for(let hour=0;hour<=24;hour+=.25){const s=P.sun({...P.cfg,hour});if(s.elevation>=0)points.push(new THREE.Vector3(...s.direction).multiplyScalar(35));}
    arc.geometry.dispose();arc.geometry=new THREE.BufferGeometry().setFromPoints(points);
    const o=new THREE.Object3D();diagnostic.blocked.forEach((index,i)=>{const p=P.panels[index];o.position.set(p.x,p.y+.07,p.z);o.rotation.set(P.cfg.tiltDeg*P.rad,(180-P.cfg.azimuthDeg)*P.rad,0,'YXZ');o.updateMatrix();shadows.setMatrixAt(i,o.matrix);});shadows.count=diagnostic.blocked.length;shadows.instanceMatrix.needsUpdate=true;
    if(panel){
      const s=diagnostic.sun,night=s.elevation<=0;
      document.getElementById('solarHourValue').textContent=String(Math.floor(P.cfg.hour)).padStart(2,'0')+':'+String(Math.round(P.cfg.hour%1*60)).padStart(2,'0');
      document.getElementById('solarCheckResult').textContent=night?'太阳在地平线以下，无直射光':('太阳高度 '+s.elevation.toFixed(1)+'° · 方位 '+s.azimuth.toFixed(1)+'° · 中心采样遮挡 '+diagnostic.blocked.length+'/'+P.panels.length);
      document.getElementById('solarCheckBreakdown').textContent='组件 '+diagnostic.counts.组件+' · 设备 '+diagnostic.counts.设备+' · 绿植 '+diagnostic.counts.绿植+' · 地形 '+diagnostic.counts.地形+'；冬至对照 '+diagnostic.winter.map(v=>v.hour+'时'+(v.elevation<=0?'无直射':v.rowShadowRisk?'排间风险':'排间通过')).join(' / ');
    }
  }
  function ready(api){
    panel=document.createElement('div');panel.id='solarControls';panel.hidden=true;
    panel.innerHTML='<div class="detail-kicker">光伏朝向与日照校核</div><p>正南 · 固定倾角 24°（演示）。下方采用自定义场址和当地钟表时间，独立于运行时钟。</p><div class="solar-fields"><label>纬度 °N<input id="solarLatitude" type="number" min="-89" max="89" step=".1" value="44"></label><label>经度 °E<input id="solarLongitude" type="number" min="-180" max="180" step=".1" value="87.6"></label><label>UTC 时区<input id="solarTimezone" type="number" min="-12" max="14" step=".5" value="8"></label><label>校核日期<input id="solarDate" type="date" value="2026-12-21"></label></div><label class="solar-time">当地时间 <output id="solarHourValue">14:00</output><input id="solarHour" type="range" min="0" max="23.75" step=".25" value="14"></label><button id="solarCheckToggle" aria-pressed="false">显示太阳轨迹与遮挡</button><p id="solarCheckResult"></p><p id="solarCheckBreakdown"></p><p class="solar-note">默认经纬度为演示场址。红色覆盖表示中心采样遮挡；该校核为压缩场景的几何示意，发电量沿用原日照模型。</p><div class="solar-chain">组串 → 逆变 → 箱变 → 35 kV 集电 → 既有 35/220 kV 升压站 → 高压母线 / 外部电网</div>';
    document.getElementById('detailControls').before(panel);
    const fields={solarLatitude:'latitude',solarLongitude:'longitude',solarTimezone:'timezone',solarDate:'date',solarHour:'hour'};
    for(const [id,key] of Object.entries(fields))document.getElementById(id).addEventListener('input',event=>{
      const input=event.target;if(!input.checkValidity()||!input.value)return;P.cfg[key]=key==='date'?input.value:Number(input.value);clearTimeout(pending);pending=setTimeout(refresh,120);
    });
    document.getElementById('solarCheckToggle').addEventListener('click',()=>{enabled=!enabled;document.getElementById('solarCheckToggle').setAttribute('aria-pressed',String(enabled));document.getElementById('solarCheckToggle').textContent=enabled?'关闭太阳轨迹与遮挡':'显示太阳轨迹与遮挡';refresh();});
    refresh();updateCompass();
  }
  function selection(key){if(panel)panel.hidden=key!=='solar';if(key!=='solar'){enabled=false;const b=document.getElementById('solarCheckToggle');if(b){b.textContent='显示太阳轨迹与遮挡';b.setAttribute('aria-pressed','false');}}}
  function setQuality(q){quality=q;fine.visible=q==='high';routes.visible=q!=='compat';}
  function update(){
    updateCompass();checkGroup.visible=shadows.visible=enabled;
    if(!enabled||!diagnostic)return;
    const s=diagnostic.sun;marker.visible=s.elevation>0;marker.position.set(...s.direction).multiplyScalar(35);
    sunL.position.copy(controls.target).addScaledVector(new THREE.Vector3(...s.direction),600);sunL.target.position.copy(controls.target);sunL.intensity=s.elevation>0?.85:0;
    if(s.elevation<=0){ambL.intensity=.18;hemiL.intensity=.30;}
  }
  function audit(){
    scene.updateMatrixWorld(true);
    const physical=deviceRoots.map(({id,g,f})=>{const a=new THREE.Box3().setFromObject(g).union(new THREE.Box3().setFromObject(f));return {id,min:a.min.toArray(),max:a.max.toArray()};});
    const physicalConflicts=physical.flatMap(e=>P.panels.filter(p=>P.overlaps({x0:e.min[0],x1:e.max[0],z0:e.min[2],z1:e.max[2]},P.bounds(p,2))).map(p=>({id:e.id,panel:[p.x,p.z]})));
    return {quality,enabled,compass:compassPoints,plan:P.audit(),physical,physicalConflicts,connections,diagnostic,oldInverters:scene.children.filter(o=>o.name.startsWith('Detailed inverter')).length};
  }
  setQuality(window.NZ_ENGINE.S.quality);
  return {ready,selection,setQuality,update,audit,check};
})();
