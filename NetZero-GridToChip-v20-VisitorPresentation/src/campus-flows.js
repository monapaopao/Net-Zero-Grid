/* v12 typed visual flows: bounded buffers, explicit interfaces, no writes to the energy engine. */
'use strict';
window.NZ_FLOWS=(function(){
  const root=new THREE.Group();root.name='Typed campus energy and communication flows';scene.add(root);
  const kinds={power:{name:'电力',color:0xb87012},data:{name:'数据',color:0x087f9d},control:{name:'调度控制',color:0xa53f82},coolSupply:{name:'冷却供流',color:0x288e77},coolReturn:{name:'回流换热',color:0xd36b52},heatSupply:{name:'余热供流（概念）',color:0xd36b52},heatReturn:{name:'余热回流（概念）',color:0x288e77}};
  const enabled={power:true,data:true,control:true,cooling:true,process:true,heat:false},routes=[],nodes={},MAX_PARTICLES=32;
  const contextAliases={generation:'wind',power:'energy',hydrogen:'chemical',loads:'factory',backup:'compute',storage:'energy'};
  let quality='standard',focus='overview',all=true,clock=0,api,panel,updated=0;
  let narrative={active:false,eventId:null,routeIds:[],paused:false},narrativeRoutes=new Set();
  const P=window.NZ_RENEWABLE_PLAN,mix=window.NZ_MULTI_PLAN;
  const factoryPorts=mix.factoryHall.ports;
  const node=(id,p,role,zone)=>nodes[id]={id,p,role,zone};
  node('energy.ems',[20,1.8,13],'共享能源协调平台 / 二次控制接口','energy');
  node('compute.noc',[172,2.2,103],'网络运维与通信骨干接口','compute');
  node('compute.dc',[149,2,0],'A1 楼内交换与 CDU 供回接口','compute');
  node('compute.cooling',[145,2,70],'集中冷站供回接口','compute');
  node('factory.control',factoryPorts.control,'制造区受电与本地控制接口','factory');
  node('factory.utility',factoryPorts.utility,'制造公用工程接口','factory');
  node('factory.process',factoryPorts.process,'长厂房供电与公用工程入口','factory');
  node('chemical.control',[294,1.8,-252],'化工控制与通信接口','chemical');
  node('chemical.zinc',[166,1.4,-225],'锌车间接口','chemical');
  node('chemical.pem',[181,1.4,-174],'制氢控制接口','chemical');
  node('chemical.nh3',[215,1.4,-174],'合成氨接口','chemical');
  node('chemical.cooling',[246,1.4,-186],'氨产品冷却接口','chemical');
  const chemical=window.NZ_CHEMICAL_PLAN;
  node('chemical.coolantOut',chemical.ports.coolantOut,'氢氨冷却供流接口','chemical');
  node('chemical.coolantReturn',chemical.ports.coolantReturn,'氢氨冷却回流接口','chemical');
  node('chemical.hxCoolIn',chemical.ports.hxCoolIn,'合成工段换热供流接口','chemical');
  node('chemical.hxCoolOut',chemical.ports.hxCoolOut,'合成工段换热回流接口','chemical');
  node('chemical.water',[264,1.4,-226],'化工公用工程供回接口','chemical');
  node('chemical.filter',[174,1.4,-246],'电解液循环接口','chemical');
  node('solar.gateway',[-82,2.1,108],'光伏计量继保通信','solar');
  node('storage.control',[52.8,2.4,52.15],'储能 PCS 控制接口','energy');
  node('charge.control',[37,1.4,85],'充电站北排直流电源控制接口','public');
  node('charge.second',[37,1.4,109],'充电站南排直流电源控制接口','public');
  node('nuclear.meter',[307,7,-343],'SMR 外部出线计量接口','nuclear');
  node('wind.collector',[-203,8,-24],'风场集电出线与通信接口','wind');
  P.sites.forEach(s=>{node('wind.'+s.index+'.generator',window.NZ_WIND_PRODUCT.endpoint(s.index,'generator'),'代表机组发电接口','wind');node('wind.'+s.index+'.converter',window.NZ_WIND_PRODUCT.endpoint(s.index,'converter'),'代表机组变流接口','wind');node('wind.'+s.index+'.transformer',window.NZ_WIND_PRODUCT.endpoint(s.index),'机舱升压接口','wind');node('wind.'+s.index+'.converterOut',window.NZ_WIND_PRODUCT.endpoint(s.index,'converterOut'),'网侧变流输出接口','wind');node('wind.'+s.index+'.transformerHV',window.NZ_WIND_PRODUCT.endpoint(s.index,'transformerHV'),'机舱升压高压出线接口','wind');node('wind.'+s.index+'.ground',[s.x+8,s.y+1.5,s.z-4],'地面集电保护通信接口','wind');});
  const sceneHeight=(x,z)=>x<-18?P.height(x,z):0;
  // Ground utility overlays follow the terrain. Lifted marks represent buried paths, not overhead conductors.
  function drape(pts){const out=[];for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[2]-a[2])/2));if(i===1)out.push(a.slice());for(let j=1;j<=n;j++){const t=j/n,p=a.map((v,k)=>v+(b[k]-v)*t);if(!(i===pts.length-1&&j===n))p[1]=Math.max(p[1],sceneHeight(p[0],p[2])+.9);out.push(p);}}return out;}
  // Procedural symbols keep the offline asset self-contained and readable beyond color alone.
  const particleMaps={};
  for(const shape of ['circle','square','diamond','bar']){const canvas=document.createElement('canvas');canvas.width=canvas.height=32;const c=canvas.getContext('2d');c.fillStyle='rgba(255,255,255,.24)';c.beginPath();c.arc(16,16,15,0,Math.PI*2);c.fill();c.fillStyle='#fff';c.beginPath();if(shape==='circle')c.arc(16,16,10,0,Math.PI*2);else if(shape==='diamond'){c.moveTo(16,3);c.lineTo(29,16);c.lineTo(16,29);c.lineTo(3,16);c.closePath();}else if(shape==='square')c.rect(7,7,18,18);else c.rect(3,10,26,12);c.fill();particleMaps[shape]=new THREE.CanvasTexture(canvas);}
  const directionCanvas=document.createElement('canvas');directionCanvas.width=directionCanvas.height=32;
  const directionContext=directionCanvas.getContext('2d');directionContext.fillStyle='#fff';directionContext.beginPath();directionContext.moveTo(3,11);directionContext.lineTo(18,11);directionContext.lineTo(18,4);directionContext.lineTo(30,16);directionContext.lineTo(18,28);directionContext.lineTo(18,21);directionContext.lineTo(3,21);directionContext.closePath();directionContext.fill();
  const directionMap=new THREE.CanvasTexture(directionCanvas);
  function route(id,type,from,to,via,active,zone='regional',options={}){
    const points=[nodes[from].p,...via,nodes[to].p].map(p=>p.slice()),pts=options.drape===false?points:drape(points),lengths=[];let length=0;
    for(let i=1;i<pts.length;i++){const n=new THREE.Vector3(...pts[i]).distanceTo(new THREE.Vector3(...pts[i-1]));lengths.push(n);length+=n;}
    const g=new THREE.Group();g.name=id;root.add(g);
    const material=type==='control'||type==='data'?new THREE.LineDashedMaterial({color:kinds[type].color,transparent:true,opacity:.35,dashSize:type==='control'?.8:1.6,gapSize:type==='control'?.7:.8,depthWrite:false,toneMapped:false,fog:false}):new THREE.LineBasicMaterial({color:kinds[type].color,transparent:true,opacity:.36,depthWrite:false,toneMapped:false,fog:false});
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(p=>new THREE.Vector3(...p))),material);line.computeLineDistances();g.add(line);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES*3),3));geometry.setDrawRange(0,0);
    const particle=new THREE.Points(geometry,new THREE.PointsMaterial({color:kinds[type].color,map:particleMaps[type==='control'?'diamond':type==='data'?'square':type.startsWith('cool')||type.startsWith('heat')?'bar':'circle'],size:type==='control'?6.6:6,sizeAttenuation:false,transparent:true,alphaTest:.05,opacity:1,depthWrite:false,toneMapped:false,fog:false}));particle.frustumCulled=false;particle.renderOrder=20;g.add(particle);
    const markers=[];
    if(type==='control'||type==='data')for(let i=0;i<2;i++){const marker=new THREE.Sprite(new THREE.SpriteMaterial({map:directionMap,color:kinds[type].color,transparent:true,opacity:.9,depthWrite:false,toneMapped:false,fog:false}));marker.visible=false;marker.renderOrder=20;g.add(marker);markers.push(marker);}
    const r={id,type,from,to,zone,pts,lengths,length,g,line,particle,markers,active,concept:!!options.concept,pulse:!!options.pulse,visible:false,count:0,phase:0,rate:0,screenLength:0,speed:0,metricsAt:-Infinity,narrativeSelected:false,staticDirections:false};routes.push(r);return r;
  }
  const ems='energy.ems',noc='compute.noc';
  const energySpine=[[20,.42,54],[100,.42,54],[100,.42,95],[171,.42,95],[171,.42,103]];
  route('communications-energy-noc','data',ems,noc,energySpine,()=>S.dcLoadMW>0);
  route('compute-status-upload','data',noc,ems,energySpine.slice().reverse().map(p=>[p[0]-.3,p[1]+.2,p[2]-.3]),()=>S.dcLoadMW>0);
  route('energy-command-compute','control',ems,noc,energySpine.map(p=>[p[0]+.35,p[1]+.25,p[2]+.35]),()=>S.dcLoadMW>0,'regional',{pulse:true});
  route('noc-building-network','data',noc,'compute.dc',[[171,.44,103],[171,.44,95],[100,.44,95],[100,.44,0]],()=>S.dcLoadMW>0,'compute');
  const windSpine=[[-203,.5,-24],[-23,.5,-24],[-23,.5,54],[20,.5,54]];
  route('wind-monitor-upload','data','wind.collector',ems,windSpine,()=>true);
  route('energy-command-wind','control',ems,'wind.collector',windSpine.slice().reverse().map(p=>[p[0],p[1]+.25,p[2]+.4]),()=>S.windMW>0,'regional',{pulse:true});
  route('solar-monitor-upload','data','solar.gateway',ems,[[-65,.5,108],[-65,.5,78],[-23,.5,78],[-23,.5,54],[20,.5,54]],()=>true);
  const chemicalSpine=[[20,.55,54],[74,.55,54],[74,.55,-112],[296,.55,-112],[296,.55,-138],[297,.55,-138],[297,.55,-252]];
  const factorySpine=[[20,.5,54],[83,.5,54],[83,.5,156],[249,.5,156],[249,.5,134],[260,.5,134]];
  route('chemical-status-upload','data','chemical.control',ems,chemicalSpine.slice().reverse(),()=>true);
  route('factory-status-upload','data','factory.control',ems,factorySpine.slice().reverse(),()=>S.factory>0);
  route('manufacturing-business-data','data',noc,'factory.control',[[171,.6,103],[171,.6,140],[249,.6,140],[249,.6,134],[260,.6,134]],()=>S.dcLoadMW>0&&S.factory>0);
  route('energy-command-chemical','control',ems,'chemical.control',chemicalSpine,()=>S.metal+S.h2P+S.nh3KgH>0,'regional',{pulse:true});
  route('energy-command-factory','control',ems,'factory.control',factorySpine,()=>S.factory>0,'regional',{pulse:true});
  route('energy-command-storage','control',ems,'storage.control',[[20,.55,20],[59,.55,20],[59,.55,52.15]],()=>true,'energy',{pulse:true});
  route('energy-command-charging','control',ems,'charge.control',[[20,.6,54],[30,.6,54],[30,.6,85]],()=>true,'regional',{pulse:true});
  route('charging-local-control','control','charge.control','charge.second',[[30,.7,85],[30,.7,109]],()=>true,'public',{pulse:true});
  route('chemical-local-zinc','control','chemical.control','chemical.zinc',[[297,.5,-252],[297,.5,-197],[170,.5,-197],[170,.5,-225]],()=>S.metal>0,'chemical',{pulse:true});
  route('chemical-local-pem','control','chemical.control','chemical.pem',[[297,.6,-252],[297,.6,-197],[181,.6,-197]],()=>S.h2P>0,'chemical',{pulse:true});
  route('chemical-local-nh3','control','chemical.control','chemical.nh3',[[297,.7,-252],[297,.7,-197],[215,.7,-197]],()=>S.nh3KgH>0,'chemical',{pulse:true});
  route('factory-local-control','control','factory.control','factory.process',[[260,.6,134],[319.5,.6,134],[319.5,.6,114],[factoryPorts.process[0],.6,114]],()=>S.factory>0,'factory',{pulse:true});
  route('smr-boundary-status-only','data','nuclear.meter',ems,[[346,.6,-343],[346,.6,-290],[74,.6,-290],[74,.6,54],[20,.6,54]],()=>S.smrEnabled);
  // Shortest routes on the existing service-road graph; no diagonal shortcuts across hills.
  const roadGraph=new Map(),pointKey=p=>p.join(',');
  for(const road of P.roads.filter(r=>r.zone!=='solar'&&!r.name.startsWith('机组 ')))for(let j=1;j<road.pts.length;j++){
    const a=road.pts[j-1],b=road.pts[j],ka=pointKey(a),kb=pointKey(b),d=Math.hypot(a[0]-b[0],a[1]-b[1]);
    if(!roadGraph.has(ka))roadGraph.set(ka,[]);if(!roadGraph.has(kb))roadGraph.set(kb,[]);roadGraph.get(ka).push([kb,d]);roadGraph.get(kb).push([ka,d]);
  }
  function collectorPath(site){const start=pointKey([site.x,site.z+14]),end='-203,-24',distance=new Map([[start,0]]),previous=new Map(),pending=new Set(roadGraph.keys());
    while(pending.size){let at=null,min=Infinity;for(const key of pending)if((distance.get(key)??Infinity)<min){at=key;min=distance.get(key);}if(at===null)break;pending.delete(at);if(at===end)break;for(const [next,d]of roadGraph.get(at)||[]){if(min+d<(distance.get(next)??Infinity)){distance.set(next,min+d);previous.set(next,at);}}}
    if(!distance.has(end))throw Error('风场集电道路不连通：'+site.index);const path=[end];while(path[0]!==start)path.unshift(previous.get(path[0]));
    return [[site.x+8,site.y+.5,site.z-4],[site.x+9,site.y+.5,site.z+14],...path.map(key=>{const [x,z]=key.split(',').map(Number);return [x,P.height(x,z)+.5,z];})];
  }
  // The wind samples retain their own power values. They do not each carry the whole 600 MW field.
  P.sites.forEach(s=>{const p=()=>S.turbP[s.index]||0,i=s.index,g='wind.'+i+'.';
    const product=window.NZ_WIND_PRODUCT,machine=product.routePath(i,'generator'),lv=product.routePath(i,'converter'),hv=product.routePath(i,'tower');
    route('wind-generator-converter-'+i,'power',g+'generator',g+'converter',machine?machine.slice(1,-1):[],p,'wind',{drape:false});
    route('wind-converter-transformer-'+i,'power',g+'converterOut',g+'transformer',lv?lv.slice(1,-1):[],p,'wind',{drape:false});
    const cable=window.NZ_WIND_PRODUCT.endpoint(i,'cable');route('wind-tower-collector-'+i,'power',g+'transformerHV',g+'ground',[...(hv?hv.slice(1,-1):[]),cable,[s.x,i===0?Math.min(cable[1]-.35,s.y+P.turbine.towerHeight):s.y+P.turbine.towerHeight,s.z],[s.x,s.y+.4,s.z],[s.x+8,s.y+.4,s.z],[s.x+8,s.y+.4,s.z-4]],p,'wind',{drape:false});
    const branch=collectorPath(s);route('wind-collection-branch-'+i,'power',g+'ground','wind.collector',branch,p,'wind');
  });
  route('dc-cooling-supply','coolSupply','compute.cooling','compute.dc',[[151,2,70],[151,2,10]],()=>S.dcLoadMW>0,'compute',{drape:false});
  route('dc-cooling-return','coolReturn','compute.dc','compute.cooling',[[153,2.4,10],[153,2.4,70]],()=>S.dcLoadMW>0,'compute',{drape:false});
  route('factory-cooling-supply','coolSupply','factory.utility','factory.process',[[factoryPorts.utility[0],factoryPorts.utility[1],factoryPorts.process[2]]],()=>S.factory>0,'factory',{drape:false});
  route('factory-cooling-return','coolReturn','factory.process','factory.utility',[[factoryPorts.process[0]+.3,1.7,factoryPorts.process[2]],[factoryPorts.utility[0]+.3,1.7,factoryPorts.process[2]],[factoryPorts.utility[0]+.3,1.7,factoryPorts.utility[2]]],()=>S.factory>0,'factory',{drape:false});
  route('chemical-water-zinc-supply','coolSupply','chemical.water','chemical.filter',[[264,.42,-238],[174,.42,-238]],()=>S.metal>0,'chemical');
  route('chemical-water-zinc-return','coolReturn','chemical.filter','chemical.water',[[174,.48,-239],[264,.48,-239]],()=>S.metal>0,'chemical');
  route('ammonia-cooling-supply','coolSupply','chemical.coolantOut','chemical.hxCoolIn',chemical.paths.coolSupply.pts.slice(1,-1),()=>S.nh3KgH>0,'chemical',{drape:false});
  route('ammonia-cooling-return','coolReturn','chemical.hxCoolOut','chemical.coolantReturn',chemical.paths.coolReturn.pts.slice(1,-1),()=>S.nh3KgH>0,'chemical',{drape:false});
  const heat=new THREE.Group();heat.name='Optional inter-campus heat recovery interfaces';scene.add(heat);heat.visible=false;
  const heatMaterial=new THREE.MeshStandardMaterial({color:0x829b97,roughness:.6}),heatAccent=new THREE.MeshStandardMaterial({color:0x238e83,roughness:.65}),boxG=new THREE.BoxGeometry(1,1,1);
  function heatBox(w,h,d,x,y,z,mat){const mesh=new THREE.Mesh(boxG,mat);mesh.scale.set(w,h,d);mesh.position.set(x,y,z);heat.add(mesh);}
  for(const [x,y,z]of [[130,6.1,75],factoryPorts.heat]){heatBox(2.8,1.2,1.8,x,y,z,heatMaterial);for(let i=0;i<8;i++)heatBox(.06,1,1.6,x-1+i*.28,y,z,heatAccent);for(const dx of [-2,2])heatBox(.9,.8,1.1,x+dx,y-.15,z,heatAccent);}
  node('heat.source',[130,6.1,75],'冷站余热换热与泵组接口（概念）','compute');node('heat.sink',factoryPorts.heat,'制造公用工程待配置用热接口（概念）','factory');
  const heatPath=[[145,6.1,75],[148,6.1,75],[148,.42,75],[148,.42,59],[95,.42,59],[83,.42,59],[83,.42,156],[249,.42,156],[249,.42,134],[319.5,.42,134],[319.5,.42,factoryPorts.heat[2]],[319.5,factoryPorts.heat[1],factoryPorts.heat[2]]];
  route('inter-campus-heat-supply','heatSupply','heat.source','heat.sink',heatPath,()=>S.dcLoadMW>0&&S.factory>0,'regional',{concept:true,drape:false});
  route('inter-campus-heat-return','heatReturn','heat.sink','heat.source',heatPath.slice().reverse().map(p=>[p[0]+.3,p[1]+.16,p[2]+.3]),()=>S.dcLoadMW>0&&S.factory>0,'regional',{concept:true,drape:false});
  function groupFor(type){return type.startsWith('heat')?'heat':type.startsWith('cool')?'cooling':type;}
  function pointAt(r,u,out){let distance=u*r.length;for(let i=0;i<r.lengths.length;i++){if(distance<=r.lengths[i]||i===r.lengths.length-1){const t=r.lengths[i]?distance/r.lengths[i]:0,a=r.pts[i],b=r.pts[i+1];out.set(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t);return;}distance-=r.lengths[i];}}
  const temp=new THREE.Vector3(),projected=new THREE.Vector3();
  const bound=(v,a,b)=>Math.max(a,Math.min(b,v));
  function visibleIn(r){
    const internal=r.id.startsWith('wind-generator-')||r.id.startsWith('wind-converter-');
    if(internal){const p=nodes[r.from].p;if(focus!=='wind'||camera.position.distanceTo(new THREE.Vector3(...p))>170)return false;}
    if(focus==='overview')return !internal;
    return r.zone===focus||nodes[r.from].zone===focus||nodes[r.to].zone===focus;
  }
  // Pixel-based spacing keeps long collectors legible without turning short local links into a dense stream.
  function metrics(r,t){
    if(t-r.metricsAt<.3)return;r.metricsAt=t;
    const width=renderer.domElement.clientWidth||window.innerWidth,height=renderer.domElement.clientHeight||window.innerHeight;
    let previous=null,pixels=0;const samples=Math.min(48,Math.max(8,Math.ceil(r.length/12)));
    for(let i=0;i<=samples;i++){pointAt(r,i/samples,temp);projected.copy(temp).project(camera);const valid=Number.isFinite(projected.x)&&Number.isFinite(projected.y)&&projected.z>=-1&&projected.z<=1;
      const current=valid?[projected.x*width*.5,projected.y*height*.5]:null;
      if(previous&&current)pixels+=Math.hypot(current[0]-previous[0],current[1]-previous[1]);previous=current;
    }
    r.screenLength=bound(pixels,0,5000);
    const pixelsPerSecond=r.type==='control'?46:r.type==='data'?40:36;
    r.speed=Math.min(bound(pixelsPerSecond/Math.max(24,r.screenLength),.012,.25),45/Math.max(1,r.length));
  }
  const markerAhead=new THREE.Vector3(),markerBehind=new THREE.Vector3(),markerProjection=new THREE.Vector3(),markerOrigin=new THREE.Vector3();
  function directionMarkers(r,shown){
    const height=renderer.domElement.clientHeight||window.innerHeight,width=renderer.domElement.clientWidth||window.innerWidth;
    r.markers.forEach((marker,i)=>{marker.visible=shown;if(!shown)return;const u=(i+1)/3,du=Math.min(.025,2/Math.max(1,r.length)),direction=r.rate<0?-1:1;
      pointAt(r,u,marker.position);pointAt(r,bound(u+direction*du,0,1),markerAhead);pointAt(r,bound(u-direction*du,0,1),markerBehind);
      markerProjection.copy(markerAhead).project(camera);markerOrigin.copy(markerBehind).project(camera);
      marker.material.rotation=Math.atan2((markerProjection.y-markerOrigin.y)*height,(markerProjection.x-markerOrigin.x)*width);
      const scale=bound(camera.position.distanceTo(marker.position)*2*Math.tan((camera.fov||45)*Math.PI/360)*12/Math.max(1,height),.3,15);marker.scale.set(scale,scale,1);
    });
  }
  function update(t,dt){
    const replay=window.NZ_CLOUD_VISIT?.visualReplay?.();if(replay?.active&&replay.paused)dt=0;
    clock=t;root.visible=all;heat.visible=all&&enabled.heat&&(focus==='overview'||focus==='compute'||focus==='factory');
    for(const r of routes){const live=r.active(),physicalRate=typeof live==='number'&&Number.isFinite(live)?live:live===true?1:0;
      const communication=r.type==='data'||r.type==='control',selected=narrative.active&&communication&&narrativeRoutes.has(r.id);
      const rate=narrative.active&&communication?(selected?1:0):physicalRate;r.rate=rate;r.narrativeSelected=selected;r.staticDirections=false;
      r.visible=all&&enabled[groupFor(r.type)]&&visibleIn(r);r.g.visible=r.visible;
      if(!r.visible){r.count=0;r.particle.geometry.setDrawRange(0,0);directionMarkers(r,false);continue;}
      metrics(r,t);
      const active=Math.abs(rate)>1e-6,paused=communication&&narrative.active&&narrative.paused,moving=active&&!S.reduceMotion&&!paused;
      r.staticDirections=communication&&active&&(S.reduceMotion||paused);directionMarkers(r,r.staticDirections);
      r.line.material.opacity=narrative.active&&communication?(selected?.72:.1):r.concept?.28:active?(r.type==='power'?.62:.42):.12;
      const budget=Math.min(MAX_PARTICLES,Math.max(2,(window.NZ_CONFIG.QUALITY[quality]||window.NZ_CONFIG.QUALITY.standard).particles));
      const spacing=quality==='compat'?72:quality==='high'?40:52;
      let density=bound(Math.ceil(r.screenLength/spacing),2,budget);
      if(r.type==='power')density=bound(Math.round(density*(.85+.15*Math.min(1,Math.abs(rate)/20))),2,budget);
      const packets=r.pulse?Math.max(1,Math.floor(density/2)):0;
      const count=moving?(r.pulse?packets*2:density):0;
      r.count=Math.min(count,r.particle.geometry.attributes.position.count);r.particle.geometry.setDrawRange(0,r.count);
      if(moving)r.phase=(r.phase+Math.max(0,dt||0)*r.speed)%1;
      const a=r.particle.geometry.attributes.position;
      for(let i=0;i<r.count;i++){
        // Paired diamonds form short command packets. There is always a packet in transit while the route is active.
        const u=r.pulse?((Math.floor(i/2)/packets+r.phase-(i%2)*Math.min(.07,10/Math.max(40,r.screenLength))+1)%1):((i/r.count+r.phase)%1);
        pointAt(r,rate<0?1-u:u,temp);a.setXYZ(i,temp.x,temp.y,temp.z);
      }
      if(r.count)a.needsUpdate=true;
    }
    if(panel&&performance.now()-updated>500){updated=performance.now();const labels={power:'电力',data:'数据',control:'调度',cooling:'冷却',process:'工艺介质',heat:'余热'};
      panel.querySelector('.flow-status').textContent=Object.keys(enabled).map(kind=>{
        if(!all||!enabled[kind])return labels[kind]+'：关';
        const candidates=routes.filter(r=>groupFor(r.type)===kind),old=EDGES.filter(e=>legacyKind(e)===kind);
        const displayed=candidates.filter(r=>r.visible),legacyDisplayed=old.filter(e=>(e.points&&e.points.visible)||(e.visualTube&&e.visualTube.visible));
        const active=displayed.some(r=>Math.abs(r.rate)>1e-6)||legacyDisplayed.some(e=>Math.abs(e.pw())>.05);
        return labels[kind]+'：'+(!displayed.length&&!legacyDisplayed.length?'当前范围无线路':active?(S.reduceMotion||(narrative.active&&narrative.paused&&(kind==='data'||kind==='control'))?'静态':'流动'):narrative.active&&(kind==='data'||kind==='control')?'等待事件':'未运行');
      }).join(' · ')+'。数据 / 控制为示意，冷热功率待配置。';
    }
  }
  function legacyKind(e){return ['hydrogen','ammonia'].includes(e.media)?'process':e.dataFlow?'data':['data','control','cooling','heat'].includes(e.media)?e.media:'power';}
  function isEnabled(kind){return all&&!!enabled[kind];}
  function afterEdges(){for(const e of EDGES){const kind=legacyKind(e),visible=isEnabled(kind),narrativeCommunication=narrative.active&&(kind==='data'||kind==='control');if(e.points)e.points.visible=e.points.visible&&visible&&!narrativeCommunication;if(e.visualTube){e.visualTube.visible=e.visualTube.visible&&visible;if(narrativeCommunication)e.visualTube.material.opacity=.1;}}}
  function setEnabled(kind,value){if(!Object.prototype.hasOwnProperty.call(enabled,kind))return false;enabled[kind]=!!value;if(panel){const input=panel.querySelector('[data-flow="'+kind+'"]');if(input)input.checked=!!value;}return enabled[kind];}
  function setNarrativeSignals(value={}){
    const allowed=new Set(routes.filter(r=>r.type==='data'||r.type==='control').map(r=>r.id));
    const routeIds=[...new Set(Array.isArray(value.routeIds)?value.routeIds.filter(id=>allowed.has(id)):[])];
    narrative={active:true,eventId:value.eventId==null?null:String(value.eventId),routeIds,paused:!!value.paused};narrativeRoutes=new Set(routeIds);
    return {...narrative,routeIds:routeIds.slice()};
  }
  function clearNarrativeSignals(){narrative={active:false,eventId:null,routeIds:[],paused:false};narrativeRoutes.clear();}
  function context(value){focus=contextAliases[value]||value||'overview';for(const r of routes)r.metricsAt=-Infinity;}
  function selection(key){const zone=mix.zoneFor[key]||mix.facilities.find(f=>f.key===key)?.zone;context(key==='windNacelle'?'wind':zone||({wind:'wind',solar:'solar',substation:'energy'}[key])||'overview');}
  function ready(a){api=a;panel=document.createElement('details');panel.id='flowLayers';panel.innerHTML='<summary>流动图层 <span>电 · 数据 · 调度 · 冷热</span></summary><div class="flow-options">'+[['power','电力','#b87012'],['data','数据','#087f9d'],['control','调度控制','#a53f82'],['cooling','冷却供回','#288e77'],['process','氢氨工艺介质','#398ad1'],['heat','跨园区余热（概念）','#d36b52']].map(([id,label,color])=>'<label><input type="checkbox" data-flow="'+id+'" '+(enabled[id]?'checked':'')+'><i style="background:'+color+'"></i>'+label+'</label>').join('')+'<div><button data-flow-action="default">默认图层</button><button data-flow-action="off">全部关闭</button></div><p class="flow-status"></p></div>';
    document.getElementById('sceneFrame').append(panel);
    panel.querySelectorAll('input').forEach(input=>input.addEventListener('change',()=>{setEnabled(input.dataset.flow,input.checked);if(input.checked&&!all){const global=document.getElementById('showCampusFlows');global.checked=true;global.dispatchEvent(new Event('change'));}}));
    panel.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{const defaults=button.dataset.flowAction==='default';Object.keys(enabled).forEach(k=>setEnabled(k,defaults&&k!=='heat'));const global=document.getElementById('showCampusFlows');global.checked=defaults;global.dispatchEvent(new Event('change'));}));
    TICKERS.push(update);
  }
  function audit(){return {quality,focus,global:all,enabled:{...enabled},maxParticlesPerRoute:MAX_PARTICLES,totalAllocated:routes.length*MAX_PARTICLES,heatVisible:heat.visible,measuredCommunication:false,thermalPowerConfigured:false,narrative:{...narrative,routeIds:narrative.routeIds.slice()},nodes:Object.values(nodes),routes:routes.map(({id,type,from,to,zone,pts,concept,visible,count,rate,phase,screenLength,speed,narrativeSelected,staticDirections})=>({id,type,from,to,zone,pts,concept,visible,count,rate,phase,screenLength,speed,narrativeSelected,staticDirections}))};}
  return {ready,selection,context,contextAliases,setNarrativeSignals,clearNarrativeSignals,setEnabled,update,afterEdges,legacyKind,isEnabled,getFocus:()=>focus,audit,setGlobal:v=>all=!!v,setQuality:q=>{quality=q;for(const r of routes)r.metricsAt=-Infinity;}};
})();
