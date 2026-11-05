/* Native Anatomy exterior fleet, shared instances and explicit charge connections. */
'use strict';
window.NZ_VEHICLES=(function(){
 let api,T,root,base,fine,plateMesh,card,selected=null,atlas,phase=0,board,boardContext,boardTexture,boardKey='',boardAt=-1;
 const vehicles=[],bays=[],routes=[],prototypes={},materials={},buckets=new Map(),retired=[];
 const paint={white:0xf1f2ed,silver:0xb7c2c6,grey:0x586d73,blue:0x446b85,green:0x537f71,cream:0xd9d5c9,red:0xb9463e};
 const tones={chassis:0x263b3c,rubber:0x20292c,alloy:0xabb7b9,trim:0x6c8586,glass:0x2c464e,roof:0x30474e,lamp:0xe4f2ed,redlamp:0xa73f3d,white:0xe8ede8,teal:0x207e72,tank:0xb5c3be,cargo:0x77978f};
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function mat(key,color){const k=key+':'+color;return materials[k]||(materials[k]=new T.MeshStandardMaterial({color:color??tones[key]??0x718684,roughness:key==='paint'?.32:key==='glass'?.19:.64,metalness:['paint','alloy','trim'].includes(key)?.3:.04}));}
 function matrix(p){const o=new T.Object3D();o.position.fromArray(p.p);if(p.axis)o.quaternion.setFromUnitVectors(new T.Vector3(0,p.type==='ring'?0:1,p.type==='ring'?1:0),new T.Vector3(...p.axis));if(p.type==='oval')o.scale.fromArray(p.size);o.updateMatrix();return o.matrix;}
 function geom(p){if(p.type==='box')return new T.BoxGeometry(...p.size);if(p.type==='cyl')return new T.CylinderGeometry(p.size[0],p.size[0],p.size[1],20);if(p.type==='ring')return new T.TorusGeometry(p.size[0],p.size[1],6,24);if(p.type==='oval')return new T.SphereGeometry(1,16,10);if(p.type==='rod'){const a=new T.Vector3(...p.p),b=new T.Vector3(...p.b),g=new T.CylinderGeometry(p.size[0],p.size[0],a.distanceTo(b),8),o=new T.Object3D();o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.sub(a).normalize());o.updateMatrix();g.applyMatrix4(o.matrix);return g;}
  const positions=[],uv=[],indices=[],sections=[];
  const knots=p.sections,cat=(a,b,c,d,t)=>.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
  for(let i=0;i<knots.length-1;i++)for(let j=0;j<6;j++){const u=j/6,previous=knots[Math.max(0,i-1)],A=knots[i],B=knots[i+1],next=knots[Math.min(knots.length-1,i+2)];sections.push(A.map((v,k)=>k===0?v+(B[k]-v)*u:Math.max(Math.min(A[k],B[k]),Math.min(Math.max(A[k],B[k]),cat(previous[k],v,B[k],next[k],u)))));}
  sections.push(knots.at(-1));
  function ring(s){const [z,w,lo,hi]=s,r=Math.min((hi-lo)*.22,w*.14),result=[];
   for(const [cx,cy,start]of [[-w+r,lo+r,Math.PI*1.5],[-w+r,hi-r,Math.PI],[w-r,hi-r,Math.PI/2],[w-r,lo+r,0]])for(let j=0;j<4;j++){const theta=start-j*Math.PI/6;result.push([cx+Math.cos(theta)*r,cy+Math.sin(theta)*r,z]);}
   return result;
  }
  const rings=sections.map(ring),N=16;
  rings.forEach((r,i)=>r.forEach((v,k)=>{positions.push(...v);uv.push(k/N,i/(rings.length-1));}));
  for(let j=0;j<rings.length-1;j++)for(let k=0;k<N;k++){const n=(k+1)%N,a=j*N+k,b=(j+1)*N+k,c=(j+1)*N+n,d=j*N+n;indices.push(a,b,c,a,c,d);}
  for(const [row,rear]of [[0,true],[rings.length-1,false]]){const s=sections[row],r=rings[row],center=positions.length/3;positions.push(0,(s[2]+s[3])/2,s[0]);uv.push(.5,.5);const base=positions.length/3;r.forEach(v=>{positions.push(...v);uv.push(.5,.5);});for(let k=0;k<N;k++){const next=(k+1)%N;rear?indices.push(center,base+k,base+next):indices.push(center,base+next,base+k);}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
 }
 function merge(gs){const g=new T.BufferGeometry();for(const key of ['position','normal','uv']){const attrs=gs.map(g=>g.attributes[key]),a=new Float32Array(attrs.reduce((n,v)=>n+v.array.length,0));let i=0;for(const v of attrs){a.set(v.array,i);i+=v.array.length;}g.setAttribute(key,new T.BufferAttribute(a,attrs[0].itemSize));}g.computeBoundingBox();g.computeBoundingSphere();return g;}
 function prototype(kind){if(prototypes[kind])return prototypes[kind];const data=window.NZ_VEHICLE_MODEL.create(kind),groups=new Map();for(const p of data.parts){if(p.type==='plate')continue;const key=p.mat+':'+p.tier;const g0=geom(p),g=g0.index?g0.toNonIndexed():g0.clone();g0.dispose();if(p.type!=='loft'&&p.type!=='rod')g.applyMatrix4(matrix(p));if(!groups.has(key))groups.set(key,[]);groups.get(key).push(g);}const chunks=[...groups].map(([key,gs])=>{const geometry=merge(gs);gs.forEach(g=>g.dispose());const [mat,tier]=key.split(':');return {geometry,mat,tier};});return prototypes[kind]={data,chunks};}
 function surfaceHeight(x,z,fallback){
  const ray=new T.Raycaster(new T.Vector3(x,.80,z),new T.Vector3(0,-1,0),0,3),surfaces=[];
  api.scene.updateMatrixWorld(true);
  // Ground probes test solid geometry only. Light sprites need a viewing camera
  // for picking and must never participate in this downward terrain query.
  api.scene.traverseVisible(o=>{if(!o.isMesh)return;for(let p=o;p;p=p.parent)if(p===root)return;surfaces.push(o);});
  for(const h of ray.intersectObjects(surfaces,false)){
   if(h.point.y>.60||!h.face)continue;
   const normal=h.face.normal.clone().applyMatrix3(new T.Matrix3().getNormalMatrix(h.object.matrixWorld)).normalize();
   if(normal.y>.95)return h.point.y+.004;
  }
  return fallback;
 }
 function addVehicle(id,kind,color,p,heading=0,zone='parking',connectedBay=null){p=p.slice();p[1]=surfaceHeight(p[0],p[2],p[1]);const proto=prototype(kind),o=new T.Object3D();o.position.fromArray(p);o.rotation.y=heading;o.updateMatrix();const v={id,kind,title:proto.data.spec.title,p:p.slice(),heading,zone,connectedBay,plate:(proto.data.spec.green?'沪AD':'沪A')+String(10000+vehicles.length),matrix:o.matrix.clone(),port:proto.data.port?new T.Vector3(...proto.data.port).applyMatrix4(o.matrix).toArray():null};vehicles.push(v);
  for(const ch of proto.chunks){const material=mat(ch.mat,ch.mat==='paint'?paint[color]:undefined),key=ch.geometry.uuid+material.uuid;if(!buckets.has(key))buckets.set(key,{geometry:ch.geometry,material,tier:ch.tier,matrices:[],ids:[]});const b=buckets.get(key);b.matrices.push(v.matrix);b.ids.push(id);}return v;
 }
 function buildPlates(){const canvas=typeof document!=='undefined'?document.createElement('canvas'):null,ctx=canvas?.getContext?.('2d');if(ctx){canvas.width=1024;canvas.height=512;for(let i=0;i<vehicles.length;i++){const v=vehicles[i],x=i%8*128,y=Math.floor(i/8)*64;ctx.fillStyle=window.NZ_VEHICLE_MODEL.specs[v.kind].green?'#8cd79b':v.kind==='fire'?'#f5f1e7':v.kind==='ice'?'#365c9a':'#d9b34b';ctx.fillRect(x,y,128,64);ctx.strokeStyle='#284b3d';ctx.strokeRect(x+3,y+8,122,48);ctx.fillStyle=v.kind==='ice'?'#fff':'#18382b';ctx.font='bold 21px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(v.plate,x+64,y+32,118);}atlas=new T.CanvasTexture(canvas);atlas.encoding=T.sRGBEncoding;atlas.minFilter=T.LinearMipmapLinearFilter;}
  const gs=[],ranges=[];let offset=0;for(let i=0;i<vehicles.length;i++){const v=vehicles[i];for(const p of prototype(v.kind).data.parts.filter(p=>p.type==='plate')){const g=new T.PlaneGeometry(...p.size).toNonIndexed(),o=new T.Object3D();o.position.fromArray(p.p);o.rotation.y=p.front?0:Math.PI;o.updateMatrix();g.applyMatrix4(o.matrix).applyMatrix4(v.matrix);const u=g.attributes.uv;for(let j=0;j<u.count;j++)u.setXY(j,(i%8+u.getX(j))/8,1-(Math.floor(i/8)+1-u.getY(j))/8);ranges.push({id:v.id,start:offset,count:2});offset+=2;gs.push(g);}}
  plateMesh=new T.Mesh(merge(gs),new T.MeshStandardMaterial({color:0xffffff,map:atlas||null,roughness:.75,side:T.FrontSide}));plateMesh.name='Vehicle registration plates';plateMesh.userData.vehicleRanges=ranges;base.add(plateMesh);gs.forEach(g=>g.dispose());
 }
 function cable(id,points){const path=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)),false,'centripetal'),geometry=new T.TubeGeometry(path,28,.032,7,false),mesh=new T.Mesh(geometry,mat('rubber'));mesh.name='Connected charging cable '+id;mesh.userData.vehicleId=id;root.add(mesh);const v=vehicles.find(v=>v.id===id),tip=points.at(-1);const gun=new T.Mesh(new T.BoxGeometry(.15,.12,.20),mat('chassis'));gun.position.fromArray(tip);gun.rotation.y=v.heading+Math.PI/2;gun.userData.vehicleId=id;root.add(gun);routes.push({id,points,path,mesh,gun,endpoint:v.port});}
 function placeCharging(){const P=window.NZ_MULTI_PLAN.charging;for(let row=0;row<2;row++)for(let i=0;i<12;i++){const x=47.5+i*3,z=P.rows[row].terminalZ,id=(row?'S':'N')+String(i+1).padStart(2,'0'),p=[x-.29,1.42,z+(row?-.3:.3)];bays.push({id,row,index:i,x,z,port:p,vehicle:null,sharedBus:row===P.busBay.row&&P.busBay.mergedSlots.includes(i)&&i!==P.busBay.mergedSlots[0]});}
  const kinds=['model3','yu7','li'],colors=['white','silver','blue','grey','green'];
  for(const [row,indices]of [[0,[0,2,4,7,10]],[1,[5,7,9]]])for(let j=0;j<indices.length;j++){const i=indices[j],bay=bays[row*12+i],v=addVehicle('charge-'+bay.id,kinds[(i+row)%3],colors[(i+row)%5],[bay.x,.22,P.rows[row].vehicleZ],P.rows[row].heading,'charging',bay.id);bay.vehicle=v.id;}
  const busBay=bays[12],bus=addVehicle('charge-bus','bus','cream',[P.busBay.center[0],.22,P.busBay.center[1]],P.busBay.heading,'charging',busBay.id);busBay.vehicle=bus.id;
  for(const bay of bays){const led=new T.Mesh(new T.BoxGeometry(.16,.10,.05),mat(bay.vehicle?'teal':'trim'));led.position.set(bay.x,1.82,bay.z+(bay.row?-.34:.34));led.userData.bayId=bay.id;led.name='Terminal connection indicator '+bay.id;root.add(led);
   if(!bay.vehicle){const a=bay.port,p=[a,[a[0]-.36,1.0,a[2]],[a[0]-.39,.64,a[2]],[a[0]-.15,.65,a[2]],[a[0]-.08,1.3,a[2]]],curve=new T.CatmullRomCurve3(p.map(v=>new T.Vector3(...v)));const lead=new T.Mesh(new T.TubeGeometry(curve,18,.028,6,false),mat('rubber'));lead.userData.bayId=bay.id;lead.name='Docked lead '+bay.id;root.add(lead);const gun=new T.Mesh(new T.BoxGeometry(.12,.23,.12),mat('chassis'));gun.position.set(a[0]-.08,1.34,a[2]);gun.userData.bayId=bay.id;root.add(gun);}
   if(bay.vehicle){const v=vehicles.find(v=>v.id===bay.vehicle),a=bay.port,b=v.port;const out=bay.row?-.65:.65,approach=[b[0]+(v.kind==='bus'?0:bay.row ? .23 : -.23),b[1],b[2]+(v.kind==='bus'?.23:0)];cable(v.id,[a,[a[0]-.45,a[1]-.25,a[2]+out],[approach[0],.55,(a[2]+approach[2])/2],approach,b]);}
  }
 }
 function retire(){if(typeof truckPool!=='undefined')for(const t of truckPool){t.visible=false;retired.push(t);}const legacy=api.scene.getObjectByName('Retired logistics truck');if(legacy){legacy.visible=false;retired.push(legacy);}const oldTanker=api.scene.getObjectByName('Stationary ammonia loading vehicle');if(oldTanker){oldTanker.visible=false;retired.push(oldTanker);oldTanker.updateWorldMatrix(true,false);const p=oldTanker.getWorldPosition(new T.Vector3());p.y+=.22;addVehicle('chemical-tanker','tanker','white',p.toArray(),0,'chemical');}}
 function placeOthers(){const P=window.NZ_MULTI_PLAN.charging.parking,cx=(P.x0+P.x1)/2,cz=(P.z0+P.z1)/2;for(const [row,indices]of [[0,[2,4,6,8,10]],[1,[1,3,5,7,9]]])for(let j=0;j<indices.length;j++){const i=indices[j],kind=j===4?'ice':['model3','yu7','li'][(i+row)%3];addVehicle('park-'+row+'-'+i,kind,['white','silver','grey','green','blue'][j],[cx-22+i*4,.24,cz+(row?4.2:-4.2)],row?Math.PI:0,'parking');}
  addVehicle('fire-response','fire','red',[144,.44,-60],Math.PI/2,'fire');
  // Park parallel to the loading facade, outside the scaled projecting awnings.
  addVehicle('compute-logistics','truck','cream',[145,.20,128],Math.PI/2,'logistics');
  addVehicle('factory-logistics','truck','white',[314,.20,93],0,'factory');
 }
 function buildBoard(){
  const frame=new T.Mesh(new T.BoxGeometry(2.8,1.6,.14),mat('chassis'));frame.name='Station-level charging status board';frame.position.set(82,1.85,116);frame.userData.vehicleId='station';root.add(frame);
  for(const x of [80.9,83.1]){const post=new T.Mesh(new T.BoxGeometry(.10,1.2,.10),mat('trim'));post.position.set(x,.60,116);root.add(post);}
  const canvas=typeof document!=='undefined'?document.createElement('canvas'):null;boardContext=canvas?.getContext?.('2d');if(boardContext){canvas.width=640;canvas.height=340;boardTexture=new T.CanvasTexture(canvas);boardTexture.encoding=T.sRGBEncoding;}
  board=new T.Mesh(new T.PlaneGeometry(2.62,1.42),new T.MeshStandardMaterial({color:0xffffff,map:boardTexture||null,roughness:.8}));board.position.set(82,1.85,116.075);board.userData.vehicleId='station';root.add(board);
 }
 function updateBoard(force=false){if(!boardContext)return;const mw=Number(api.S.sc||0),independent=typeof document!=='undefined'&&document.body.classList.contains('sst-running'),key=independent?'sst-branch':mw.toFixed(2);if(key===boardKey||!force&&phase-boardAt<.25&&boardKey!=='')return;boardKey=key;boardAt=phase;const c=boardContext;c.fillStyle='#eff7f1';c.fillRect(0,0,640,340);c.textAlign='left';c.textBaseline='middle';c.fillStyle=mw>.01?'#197b59':'#627b72';if(independent){c.font='bold 39px sans-serif';c.fillText('SST 代表支路演示',30,56,580);c.font='bold 50px sans-serif';c.fillText('查看情景面板',30,144,580);c.font='27px sans-serif';c.fillText('全站运行台账已冻结',30,231,580);c.font='25px sans-serif';c.fillText('代表支路与全站功率分别计量',30,292,580);boardTexture.needsUpdate=true;return;}c.font='bold 39px sans-serif';c.fillText(mw>.01?'站端充电运行':'站端待机',30,56,580);c.font='bold 66px sans-serif';c.fillText(mw.toFixed(2)+' MW',30,144,580);c.fillStyle='#517168';c.font='27px sans-serif';c.fillText('示意连接 9 辆 · 单车功率未细分',30,231,580);c.font='25px sans-serif';c.fillText('24 终端 · 大巴专用长车位',30,292,580);boardTexture.needsUpdate=true;}
 function ready(a){api=a;T=a.THREE||THREE;root=new T.Group();root.name='Anatomy detailed campus vehicles';base=new T.Group();fine=new T.Group();root.add(base,fine);api.scene.add(root);retire();placeCharging();placeOthers();buildBoard();
  for(const b of buckets.values()){const m=new T.InstancedMesh(b.geometry,b.material,b.matrices.length);m.name='Shared vehicle '+b.tier;m.userData.vehicleIds=b.ids;m.castShadow=true;m.receiveShadow=true;b.matrices.forEach((mx,i)=>m.setMatrixAt(i,mx));m.instanceMatrix.needsUpdate=true;m.frustumCulled=false;(b.tier==='fine'?fine:base).add(m);}buildPlates();
  if(typeof document!=='undefined'){card=document.createElement('aside');card.id='vehicleCard';card.hidden=true;card.setAttribute('aria-label','车辆与充电连接');card.innerHTML='<button id="vehicleClose" aria-label="关闭车辆信息">×</button><div id="vehicleContent"></div>';document.body.append(card);document.getElementById('vehicleClose').addEventListener('click',hide);}
  if(typeof INFO!=='undefined'){INFO.supercharge.note='24个终端、21个停车位置（含1个大巴长车位）。容量沿用原模型；可见车辆只示意连接，单车功率与SOC未细分。';INFO.parking.t='普通停车区（混合停放）';}
  tick(0);
 }
 function select(id){api.closeInfo?.();selected=id;paintCard();return true;}
 function hide(){selected=null;if(card)card.hidden=true;}
 function paintCard(){if(!card||!selected)return;const bay=bays.find(v=>v.id===selected),v=bay?vehicles.find(v=>v.id===bay.vehicle):vehicles.find(v=>v.id===selected);const station=selected==='station',connected=!!(v?.connectedBay||bay?.vehicle),title=station?'新能源充电站运行状态':v?.title||('充电终端 '+bay?.id);const s=api.S,ev=v&&window.NZ_VEHICLE_MODEL.specs[v.kind].green;
  const html='<small>园区车辆 · '+(station?'站端总量':bay?'终端 '+bay.id:v?.zone==='charging'?'车位 '+v.connectedBay:'停放展示')+'</small><h3>'+esc(title)+'</h3><p>'+(station?'运行状态':'连接状态')+'：<b>'+(station?(s.sc>.01?'站端充电运行':'站端待机'):connected?(s.sc>.01?'已连接（场景示意，功率未细分）':'已连接／等待站端供电'):bay?(bay.sharedBus?'大巴长车位配套终端 · 枪头归位':'空闲 · 枪头归位'):'未连接充电设备')+'</b></p>'+(v?'<p>牌照：'+esc(v.plate)+(ev?' · 新能源绿色牌照':'')+'</p>':'')+(station||connected||bay?'<p>站端充电总功率：<b>'+Number(s.sc||0).toFixed(2)+' MW</b></p><p>单车功率 / SOC：未细分</p><small>终端蓝绿灯表示示意连接；站端功率来自园区模型，不代表该车实时遥测。普通乘用车不直接套用原重型车等效功率。</small>':'<small>车辆外观与停放示意，不新增产能、运输订单或能耗核算。</small>');const content=document.getElementById('vehicleContent');if(content.innerHTML!==html)content.innerHTML=html;card.hidden=false;
 }
 function inspectHit(h){let id=h.object.userData.vehicleIds?.[h.instanceId]||h.object.userData.vehicleRanges?.find(r=>h.faceIndex>=r.start&&h.faceIndex<r.start+r.count)?.id;for(let o=h.object;o&&!id;o=o.parent)id=o.userData.vehicleId||o.userData.bayId;if(id)return select(id);if(h.point?.y>.3&&h.point.y<2.5){const b=bays.find(b=>Math.hypot(h.point.x-b.x,h.point.z-b.z)<.60);if(b)return select(b.id);}return false;}
 function tick(dt){if(!api)return;retired.forEach(t=>t.visible=false);phase+=Math.max(0,dt||0);updateBoard(dt===0);const close=api.camera.position.distanceTo(new T.Vector3(64,1,98))<150||api.camera.position.distanceTo(new T.Vector3(55,1,131))<120||api.camera.position.distanceTo(new T.Vector3(144,1,-60))<100;fine.visible=api.S.quality==='high'||api.S.quality!=='compat'&&close;
  if(typeof document!=='undefined'&&document.body.classList.contains('visitor-playing'))hide();else if(selected)paintCard();
 }
 function audit(){return {vehicles:vehicles.map(v=>({id:v.id,kind:v.kind,p:v.p,heading:v.heading,plate:v.plate,zone:v.zone,connectedBay:v.connectedBay,port:v.port})),bays:bays.map(b=>({id:b.id,vehicle:b.vehicle,port:b.port})),routes:routes.map(r=>({id:r.id,points:r.points,endpoint:r.endpoint})),retired:retired.length,drawBatches:base.children.length+fine.children.length,detailVisible:fine.visible,parkingPositions:window.NZ_MULTI_PLAN.charging.parkingPositions,terminals:24,capacityMW:28.8,singleVehicleTelemetry:false,stationBoard:true,partCounts:Object.fromEntries(Object.entries(prototypes).map(([k,v])=>[k,v.data.parts.length]))};}
 return {ready,tick,inspectHit,select,hide,audit};
})();
