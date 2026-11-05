/* v4 layout, anchored to A1's unchanged 30 x 20 x 14 campus units. */
'use strict';
window.NZ_LAYOUT=(function(){
  const plan={
    line:{old:[48,-10],at:[67,-40.5],scale:[1,1,1],bounds:[45,5],view:62},
    factory:{old:[170,72],at:[181,78],scale:[2,1.5,2.2],bounds:[21,16],view:66},
    logistics:{old:[122,86],at:[136,111],scale:[2,1.1,2],bounds:[24,20],view:72},
    fire:{old:[178,28],at:[150,-78],scale:[1.4,1.25,1.5],bounds:[32,26],view:68},
    storage:{old:[28,30],at:[35.5,39],scale:[1,1,1],bounds:[22,8],view:49},
    substation:{old:[10,-10],at:[18,-10],scale:[1.5,1.4,1.5],bounds:[10,19],view:70},
    stepdown:{old:[92,-10],at:[92,-10],scale:[1.5,1.4,1.5],bounds:[9,20],view:40},
    token:{old:[172,-10],at:[155,31],scale:[1.3,1.15,1.3],bounds:[12,9],view:28},
    panamaZn:{old:[144,66],at:[109,76],scale:[.8,.9,.8],bounds:[3.5,5],view:35}
  };
  let T,workshop,mode='closed',active=null,interiorGroup,roof,walls,cutaway,electricalRoom;
  function remove(key){const l=LABELS3D[key];if(l)l.el.remove();delete LABELS3D[key];for(let i=DEVICES.length-1;i>=0;i--)if(DEVICES[i].key===key)DEVICES.splice(i,1);delete INFO[key];}
  function anchor(key,p){const l=LABELS3D[key];if(l)l.anc.set(...p);const d=DEVICES.find(d=>d.key===key);if(d)d.p=p.slice();}
  function bboxSize(o){if(!o.geometry)return [0,0,0];o.geometry.computeBoundingBox();return o.geometry.boundingBox.getSize(new THREE.Vector3()).toArray();}
  function transform(key,m){const d=plan[key];if(!d)return;m.root.position.set(d.at[0],0,d.at[1]);m.root.scale.set(...d.scale);m.x=d.at[0];m.z=d.at[1];}
  function setup(toolkit){T=toolkit;window.NZ_INFRA.setup(toolkit);}
  function zinc(){const {model,group,box,rod,cylinder,door,vent,fan,pad,C}=T;
    // Original outdoor cells and rectifier stripe are replaced by indoor equipment.
    for(const o of scene.children.slice()){if(!o.isMesh||!o.geometry||!['BoxGeometry','CylinderGeometry'].includes(o.geometry.type))continue;if(o.position.x>120&&o.position.x<139&&o.position.z>68&&o.position.z<76&&o.position.y<3)scene.remove(o);}
    workshop=model('metal',126,76);const g=workshop.root;pad(0,0,42,23,g);
    walls=group(g,'Electrowinning workshop shell');cutaway=group(g,'Cutaway wall panels');roof=group(g,'Workshop roof');interiorGroup=group(g,'Indoor process equipment');electricalRoom=group(g,'Electrical room envelope');
    box(40,7,.2,C.shell,0,3.8,-10,walls);box(.2,7,20,C.shell,-20,3.8,0,cutaway);box(.2,7,20,C.shell,20,3.8,0,cutaway);
    box(40,2,.2,C.shell,0,6.3,10,cutaway);for(const x of [-19,-7,7,19])box(2,5,.2,C.shell,x,2.8,10,cutaway);
    for(const x of [-13,0,13]){door(x,2.25,10.15,5.8,3.8,cutaway);box(6.6,.16,1.4,C.steel,x,4.35,10.65,cutaway);}
    for(let x=-18;x<=18;x+=6){box(.18,7.5,.25,C.white,x,4,9.85,walls);box(.18,7.5,.25,C.white,x,4,-9.85,walls);box(.17,.26,20,C.steel,x,7.5,0,walls);box(4.7,1,.1,C.glass,x,6.3,10.16,cutaway);box(4.7,1,.1,C.glass,x,6.3,-10.16,walls);}
    box(40.8,.28,20.8,C.white,0,7.65,0,roof);for(let x=-16;x<=16;x+=8){box(5,.2,2,C.glass,x,7.86,-2,roof);box(2.2,.8,2,C.shell,x,8.15,5,roof);fan(x,8.6,5,.62,roof);}
    box(.2,5.8,20,C.white,-10,3.3,0,electricalRoom);box(10,5.8,.15,C.shell,-15,3.3,10,electricalRoom);
    // 24 representative cells; the capacity remains the original model's value.
    for(let row=0;row<3;row++)for(let col=0;col<8;col++){const x=-7.8+col*3.25,z=-6+row*5.4;box(2.4,.9,3.7,C.steel,x,.95,z,interiorGroup);box(2.12,.06,3.42,C.blue,x,1.42,z,interiorGroup);for(const dx of [-1.15,1.15])box(.13,.25,3.9,C.white,x+dx,1.5,z,interiorGroup);
      for(let n=0;n<12;n++){box(2,.055,.08,C.copper,x,1.7,z-1.5+n*.27,interiorGroup);box(.04,.6,.055,C.dark,x+.85,1.35,z-1.5+n*.27,workshop.fine);}
    }
    for(const z of [-8.5,-3.4,2,7.4]){rod([-8,.6,z],[18,.6,z],.1,C.blue,interiorGroup);box(27,.02,.045,C.white,5,.36,z+.25,interiorGroup);}
    for(const z of [-8,8]){box(28,.16,.16,C.copper,4,2.2,z,interiorGroup);box(28,.16,.16,C.copper,4,2.2,z+.38,interiorGroup);}
    rod([-17,2.2,0],[-10,2.2,0],.11,C.copper,interiorGroup);rod([-10,2.2,0],[-10,2.2,8],.11,C.copper,interiorGroup);
    // Rectifier transformer and MV/DC control cabinets in the separated indoor zone.
    box(3.5,.45,3.6,C.steel,-12,.6,-5,interiorGroup);box(3.5,.14,3.6,C.steel,-12,2.7,-5,interiorGroup);for(const x of [-12.9,-12,-11.1]){cylinder(.4,1.8,C.copper,x,1.65,-5,interiorGroup);for(let n=0;n<12;n++)cylinder(.44,.055,C.steel,x,.84+n*.14,-5,workshop.fine);}
    for(let n=0;n<5;n++){const z=-7.5+n*3;box(1.7,2.6,1.1,C.shell,-18,1.65,z,interiorGroup);door(-18,1.65,z+.6,1.6,2.5,interiorGroup);vent(-18,1,z+.71,1.2,.5,interiorGroup);}
    anchor('metal',[126,9.1,76]);anchor('panamaZn',[109,4,76]);LABELS3D.panamaZn.el.querySelector('.nm').textContent='电解锌 · 室内直流电源';
    INFO.metal.d='电积槽阵列位于封闭厂房内。西侧独立电气区展示整流变压器、整流及直流配电柜；通过正负母排连接槽区。';
    INFO.metal.p.push(['展示配置','24 个代表性电积槽 · 独立电气区']);INFO.metal.note+=' 几何与设备数量为展示配置，不用于推导产能。';
    INFO.panamaZn.d='位于电解锌车间内的整流与直流供电系统，通过正负极母排向电积槽供电。';
  }
  function station(){const {model,box,rod,cylinder,ring,door,vent,pad,rail,C}=T;const m=model('ais',38,-7),g=m.root;pad(0,0,62,50,g);rail(0,0,62,50,.4,m.fine);
    // Six primary bays: incoming, source connection, transformer feeders and bus tie.
    for(let bay=0;bay<6;bay++){const z=-20+bay*7.8;for(let phase=0;phase<3;phase++){const zz=z+(phase-1)*1.45;
      for(const x of [-4,2,8,14]){box(.75,.25,.65,C.steel,x,.6,zz,g);cylinder(.17,2.1,C.dark,x,1.8,zz,g);for(let j=0;j<9;j++)cylinder(.29,.095,C.white,x,.9+j*.21,zz,m.fine);}
      // Circuit breaker, CT, disconnector blade and surge arrester.
      shapeBreaker(2,zz,g,m.fine);ring(.4,.12,C.steel,8,3,zz,g,[0,Math.PI/2,0]);rod([-6,6+phase*1.2,zz],[-4,3,zz],.07,C.copper,g);rod([-4,3,zz],[-1,3.45,zz],.07,C.copper,g);rod([-1,3.45,zz],[2,3.45,zz],.07,C.copper,g);rod([2,3.45,zz],[8,3.45,zz],.07,C.copper,g);rod([8,3.45,zz],[14,3.45,zz],.07,C.copper,g);
      cylinder(.12,2.5,C.steel,18,1.8,zz,g);for(let j=0;j<9;j++)cylinder(.2,.1,C.white,18,.9+j*.24,zz,m.fine);rod([14,3.45,zz],[18,3.45,zz],.06,C.copper,g);
    }box(1,1.3,.65,C.shell,2,1.1,z+2.4,g);vent(2,1.1,z+2.78,.8,.7,m.fine);}
    for(const x of [-8,-6]){for(const z of [-21,0,21]){cylinder(.15,8.1,C.steel,x,4.4,z,g);for(let phase=0;phase<3;phase++)box(1,.15,1,C.white,x,5.9+phase*1.2,z,g);}for(let phase=0;phase<3;phase++)rod([x,6+phase*1.2,-22],[x,6+phase*1.2,22],.09,C.copper,g);}
    for(const z of [-11.25,-3,5.25])for(const dx of [-1.43,0,1.43])rod([-20+dx,5.3,z],[-8,6+(dx+1.43)/1.43*1.2,z+dx*.3],.065,C.copper,g);
    for(const z of [-20,18])for(const dz of [-1.45,0,1.45]){cylinder(.32,.5,C.steel,-11,.75,z+dz,g);cylinder(.18,2.1,C.dark,-11,2,z+dz,g);for(let n=0;n<10;n++)cylinder(.3,.08,C.white,-11,1+n*.21,z+dz,m.fine);rod([-11,3.2,z+dz],[-8,6+(dz+1.45)/1.45*1.2,z+dz],.06,C.copper,g);}
    // Secondary control building plus a 12-cabinet MV feeder room.
    box(12,4,6,C.shell,-18,2.4,20,g);box(12.5,.25,6.5,C.white,-18,4.55,20,g);door(-18,1.6,23.1,2.2,2.6,g);for(let x=-23;x<=-13;x+=2.5)box(1.7,.9,.1,C.glass,x,3.25,23.1,g);
    for(let n=0;n<12;n++){const x=-26+n*1.25;box(1.12,2.2,1,C.shell,x,1.45,14,g);door(x,1.45,14.55,1.05,2.05,g);}
    box(16,3.4,.16,C.shell,-19,2.1,12.9,g);box(.16,3.4,3.3,C.shell,-27,2.1,14.5,g);box(.16,3.4,3.3,C.shell,-11,2.1,14.5,g);box(16.4,.18,3.7,C.white,-19,3.85,14.5,g);
    INFO.substation.d='扩展的 AIS 站区展示三台主变、双母线、六个三相间隔，以及断路器、隔离开关、CT/VT、避雷器、二次控制楼和中压配电房。';INFO.substation.p=INFO.substation.p.map(p=>p[0]==='接线方式'?[p[0],'双母线（展示配置）']:p);INFO.substation.p.push(['展示拓扑','6 个 AIS 三相间隔 · 双母线 · 12 面中压柜']);INFO.substation.note='展示配置参考 AIS 一次设备组成；保留原模型容量，不代表已核实的工程设计。';
    function shapeBreaker(x,z,parent,fine){box(1.4,.6,.65,C.steel,x,2.6,z,parent);cylinder(.22,.6,C.white,x,3.25,z,parent);rod([x,1,z],[x,2.6,z],.07,C.dark,fine);}
  }
  function solar(){const {model,group,box,rod,pad,C}=T;const old=T.models.solar;old.root.visible=false;const m=model('solar',-128,73);
    for(const o of scene.children.slice()){if(!o.isMesh||!o.geometry)continue;if(o.position.x<-45&&o.position.x>-108&&o.position.z>=29&&o.position.z<53&&o.position.y<1.3&&o.geometry.type==='BoxGeometry')scene.remove(o);}
    const site=window.NZ_SOLAR_PLAN,tilt=site.cfg.tiltDeg*site.rad,yaw=(180-site.cfg.azimuthDeg)*site.rad;
    for(const panel of site.panels){
      const x=panel.x-m.x,z=panel.z-m.z;const p=group(m.fine,'PV cell and frame');p.position.set(x,.95,z);p.rotation.set(tilt,yaw,0,'YXZ');
      for(const xx of [-.95,.95])box(.04,.06,1.34,C.white,xx,.055,0,p);for(const zz of [-.65,.65])box(1.94,.06,.04,C.white,0,.055,zz,p);for(let j=1;j<6;j++)box(.014,.012,1.24,C.steel,-.95+j*1.9/6,.04,0,p);for(let j=1;j<4;j++)box(1.84,.012,.014,C.steel,0,.04,-.65+j*1.3/4,p);
      T.shape('box',[1.9,.065,1.3],C.blue,[x,.95,z],m.root,[tilt,yaw,0,'YXZ']);
      for(const dx of [-.65,.65])for(const dz of [-.45,.45]){
        const local=new THREE.Vector3(dx,-.035,dz).applyEuler(p.rotation);
        rod([x+local.x,.2,z+local.z],[x+local.x,.95+local.y,z+local.z],.04,C.steel,m.root);
      }
    }
    // Service cabinets are placed south of the last panel row by the v7 landscape.
    anchor('solar',[-128,5,73]);LABELS3D.solar.el.querySelector('.pr').textContent='400 MWp · 分区阵列 · '+site.panels.length+' 块代表性组件';
    INFO.solar.d='原有及左下角扩展分区的固定式朝南阵列，经南侧逆变器组、箱变及 35 kV 集电开关接入既有升压站；计量、继保和通信位于独立服务区。';INFO.solar.p[1]=['展示阵列',site.panels.length+' 块；避让风机基础与检修道路'];INFO.solar.p.push(['组件朝向','正南 · 展示倾角 24°'],['接入链路','组串逆变 → 箱变 → 35 kV 集电 → 35/220 kV 升压站']);INFO.solar.note='组件数量与占地为压缩展示。太阳校核使用可配置日期、经纬度和时区；发电量仍按原典型日照与云层模型核算。倾角为演示参数，未做场址发电优化。';
  }
  function apply(){
    const obsoletePoles=EDGES.filter(e=>['wind','solar'].includes(e.key)).flatMap(e=>e.poles||[]);
    for(const o of scene.children.slice()){if(!o.isMesh||!o.geometry)continue;const p=o.geometry.parameters;if(obsoletePoles.some(([x,z])=>o.position.x===x&&o.position.z===z)&&((o.geometry.type==='CylinderGeometry'&&p.height===9.6)||(o.geometry.type==='BoxGeometry'&&p.width===2.8&&p.height===.16)))scene.remove(o);}
    // Clear planting from the enlarged building footprints and solar rows.
    for(const o of scene.children.slice()){
      if(!o.isMesh||!o.geometry)continue;const x=o.position.x,z=o.position.z,p=o.geometry.parameters;
      const planting=o.geometry.type==='ConeGeometry'||o.geometry===bushG||
        (o.geometry.type==='SphereGeometry'&&p.radius>.65&&o.position.y<5)||
        (o.geometry.type==='CylinderGeometry'&&p.radiusTop<.16&&p.radiusBottom<.26&&p.height<3);
      if(planting&&((x>113&&x<160&&z>99&&z<124)||(x>161&&x<201&&z>66&&z<90)||(x>-174&&x<-79&&z>53&&z<102)))scene.remove(o);
    }
    const oldChildren=scene.children.slice();
    for(const [key,d] of Object.entries(plan)){const legacy=new THREE.Group();legacy.name='Scaled legacy '+key;legacy.userData.deviceKey=key;legacy.position.set(d.old[0],0,d.old[1]);scene.add(legacy);
      for(const o of oldChildren){if(o.parent!==scene||o.isPoints||(!o.isMesh&&!o.isGroup)||o.name.startsWith('Detailed')||(o.geometry&&o.geometry.type==='TubeGeometry')||o===ground)continue;const [w,h,dep]=bboxSize(o);if(w>35||dep>24||h>20)continue;
        if(Math.abs(o.position.x-d.old[0])<d.bounds[0]/2&&Math.abs(o.position.z-d.old[1])<d.bounds[1]/2){scene.remove(o);o.position.x-=d.old[0];o.position.z-=d.old[1];legacy.add(o);if(key==='logistics'&&o.isGroup)o.scale.set(1/d.scale[0],1/d.scale[1],1/d.scale[2]);}
      }
      legacy.position.set(d.at[0],0,d.at[1]);legacy.scale.set(...d.scale);if(T.models[key])transform(key,T.models[key]);
      if(key==='line'||key==='storage'||key==='factory')legacy.visible=false; // Native assets replace these retired samples.
      const l=LABELS3D[key];if(l&&key!=='panamaZn')anchor(key,[d.at[0],key==='factory'?10:key==='logistics'?9:key==='substation'?8:l.anc.y*d.scale[1],d.at[1]]);
    }
    // Entire exterior data-center rectifier installation and server samples removed.
    for(const o of scene.children.slice()){if(!o.isMesh||!o.geometry||o.geometry.type==='TubeGeometry')continue;const [w,h,d]=bboxSize(o);if((o.position.x>113&&o.position.x<119&&o.position.z>-17&&o.position.z<-4&&o.position.y<5&&w<4&&d<13)||(o.position.x>122&&o.position.x<146&&o.position.z>2&&o.position.z<4&&o.position.y<3&&w<2))scene.remove(o);}
    remove('panamaDc');
    // Rebuild turbines with wider spacing and coherent rotor/tower proportions.
    const wind=T.models.wind;wind.root.visible=false;
    for(const o of scene.children.slice()){if(o.isMesh&&o.geometry.type==='CylinderGeometry'&&o.position.x<-30&&o.position.z>=-27&&o.position.z<=27&&o.position.y>4&&o.position.y<5)scene.remove(o);}
    const wg=T.model('wind',-118,-24);
    const turbine=window.NZ_RENEWABLE_PLAN.turbine;
    TURB_POS.forEach((p,i)=>{const {x,z,y}=window.NZ_RENEWABLE_PLAN.sites[i];const g=rotors[i].parent;g.scale.setScalar(turbine.headScale);g.position.set(x,y+turbine.hubHeight,z);g.children[0].scale.setScalar(turbine.hubScale);T.shape('cyl',[.60,1.06,turbine.towerHeight],T.C.white,[x+118,y+turbine.towerHeight/2,z+24],wg.root);T.box(8,.35,8,T.C.shell,x+118,y+.2,z+24,wg.root);T.door(x+118,y+1.5,z+24+1,1,2.2,wg.fine);for(const h of [10.35,20.7,29])T.ring(.64,.025,T.C.steel,x+118,y+h,z+24,wg.fine);p[0]=x;p[1]=z;});
    anchor('wind',[-275,48,-190]);LABELS3D.wind.el.querySelector('.pr').textContent='100×6 MW · 12 台代表机组 · 平地 / 缓丘 / 远丘';
    INFO.wind.d='12 台代表风机分布于园区西侧平地、西北缓丘及远景丘陵。机组基础、检修道路和集电设施随地形布置；模型出力按既有 100 × 6 MW 配置核算。';
    INFO.wind.note+=' v7 风电图面为分布式展示，保留 12 个原有核算样本；地形和间距用于场景表达，非场址工程设计。';
    solar();T.compile();
    // Expanded exhibition base; data building stays fixed.
    ground.visible=false;ground.name='Retired flat ground';
    const terrainBounds=window.NZ_RENEWABLE_PLAN.bounds;
    for(const o of scene.children){if(o.isMesh&&o.geometry.type==='BoxGeometry'&&o.geometry.parameters.width===360&&o.geometry.parameters.depth===240){
      o.geometry.dispose();o.geometry=new THREE.BoxGeometry(terrainBounds.x1-terrainBounds.x0,1.75,terrainBounds.z1-terrainBounds.z0);
      // Only sides and bottom remain: the terrain is the sole top surface.
      const index=o.geometry.index.array,normals=o.geometry.attributes.normal,kept=[];
      for(let i=0;i<index.length;i+=3)if(normals.getY(index[i])<.5)kept.push(index[i],index[i+1],index[i+2]);
      o.geometry.setIndex(kept);o.geometry.clearGroups();
      o.position.set((terrainBounds.x0+terrainBounds.x1)/2,-.875,(terrainBounds.z0+terrainBounds.z1)/2);o.name='Continuous terrain plinth';o.castShadow=false;
    }}
    // Remove old tiny rectifier room roof samples outside the zinc enclosure.
    
    // New access routes stay outside the workshop and warehouse footprints.
    // Replace obsolete campus roads before batching: some cross the enlarged AIS
    // yard and warehouse. The environment layer builds the connected internal network.
    for(const o of scene.children.slice()){if(o.isMesh&&o.geometry.type==='PlaneGeometry'&&o.position.y===.03&&o.position.x>=-10)scene.remove(o);}
    for(const p of [[-26,-13,24,6],[-5,-48,200,5],[-192,-50,148,4],[-192,-2,148,4],[-50,-50,5,100]]){const mesh=road(...p);if(mesh&&mesh.material){mesh.material=mesh.material.clone();mesh.material.color.set('#ced9d8');}}
    routes();anchor('substation',[38,8,-7]);anchor('carport',[64,5.5,89]);anchor('panamaZn',[109,4,76]);
    // Legacy animations write world X; converted objects now require local X.
    TICKERS.push(()=>{if(socBar.parent.name==='Scaled legacy storage')socBar.position.x-=plan.storage.old[0];for(const b of beltBoxes)if(b.parent.name==='Scaled legacy factory')b.position.x-=plan.factory.old[0];});
  }
  function routes(){const changed={wind:[[-203,8,-24],[-23,8,-24],[30,8,-24]],solar:[[-70,8,73],[-23,8,73],[-23,8,12],[-23,8,-18],[30,8,-18]],trans:[[56,6,-18],[50,13.2,-39],[70,13.2,-39],[90,13.2,-39],[78,8.6,-10]],bus2tr:[[78,8.6,-10],[86,5,-10],[92,5,-10]],tr2dc:[[95,3,-10],[107,3,-10],[119,3,-10]],stg:[[54.8,1,48.5],[58.5,1,48.5],[58.5,1,52]],metalE:[[126,1,52],[126,1,66]],facE:[[181,1,52],[181,1,67]],panZnAc:[[109,1,52],[109,1,66],[109,1,76]],panZnDc:[[109,2.2,76],[116,2.2,76],[116,2.2,84],[134,2.2,84]]};
    for(const e of EDGES){let pts=changed[e.key];if(!pts)continue;
      if(e.key==='trans')pts=[[56,3.45,-19.2],[56,6,-19.2],...window.NZ_MULTI_PLAN.renewableExport.path];
      // The last point joins the existing southern AIS incoming CT/bus lead.
      if(e.key==='solar')pts=[[-81,.32,120],[-65,.32,120],[-65,.32,78],[-65,8,78],[-23,8,78],[-23,8,11],[27,8,11],[27,3.2,11]];
      if(['wind','solar'].includes(e.key)){const supports=[pts[0]];for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[2]-a[2])/20));for(let j=1;j<=n;j++)supports.push(a.map((v,k)=>v+(b[k]-v)*j/n));}pts=supports;e.poles=pts.filter(p=>p[1]>=7.9&&(e.key!=='solar'||p[0]<0)).map(p=>[p[0],p[2]]);for(const [x,z] of e.poles){cyl(.14,.22,7.8,0xa6b7b6,x,3.9,z);bx(2.8,.16,.16,0xa6b7b6,x,8,z);}}
      e.pts=e.sag&&e.key!=='solar'?expandSag(pts,e.sag):pts;e.seg=[];e.len=0;for(let i=0;i<e.pts.length-1;i++){const length=new THREE.Vector3(...e.pts[i]).distanceTo(new THREE.Vector3(...e.pts[i+1]));e.seg.push(length);e.len+=length;}e.parts=[];e.spawnAcc=0;
      if(e.visualTube){e.visualTube.geometry.dispose();const curve=new THREE.Curve();curve.getPoint=d=>new THREE.Vector3(...edgePoint(e,d));e.visualTube.geometry=new THREE.TubeGeometry(curve,Math.max(32,e.pts.length*2),.07,6,false);}
    }
  }
  function focus(key){if(key==='line'&&window.NZ_TOWERS)return window.NZ_TOWERS.focus();const product=window.NZ_WIND_PRODUCT&&window.NZ_WIND_PRODUCT.focus(key);if(product)return product;const multi=window.NZ_MULTI&&window.NZ_MULTI.focus(key);if(multi){if(key==='panamaZn')setMode('power');return multi;}if(window.NZ_RENEWABLES&&['wind','solar'].includes(key))return window.NZ_RENEWABLES.focus(key);const infra=window.NZ_INFRA.focus(key);if(infra)return infra;if(key==='panamaZn'){setMode('power');return {pos:[95,30,113],tgt:[111,3,76]};}if(key==='metal')return {pos:[162,39,120],tgt:[126,4,76]};if(key==='substation')return {pos:[82,53,73],tgt:[36,3,-7]};const d=plan[key];if(d)return {pos:[d.at[0]+d.view*.65,d.view*.55,d.at[1]+d.view],tgt:[d.at[0],4,d.at[1]]};return null;}
  function setMode(next){mode=next;const open=mode!=='closed';roof.visible=!open;cutaway.visible=!open;walls.visible=true;electricalRoom.visible=mode==='closed';interiorGroup.visible=open;const rectifier=T.models.panamaZn;rectifier.root.visible=open;const b=document.getElementById('zincToggle');if(b)b.textContent=open?'关闭车间':'打开车间';document.querySelectorAll('[data-zinc-view]').forEach(b=>b.classList.toggle('on',b.dataset.zincView===mode));if(active==='metal'||active==='panamaZn')anchor('panamaZn',window.NZ_MULTI_PLAN.movePoint('panamaZn',[109,open?4:9,76]));}
  function selection(key){active=key;if(key!=='metal'&&key!=='panamaZn')setMode('closed');const p=document.getElementById('zincControls');if(p)p.hidden=!['metal','panamaZn'].includes(key);if(key==='panamaZn')setMode('power');}
  function ready(api){const div=document.createElement('div');div.id='zincControls';div.hidden=true;div.innerHTML='<div class="detail-kicker">电解锌车间 · 室内观察</div><p>打开建筑，查看电积槽与独立电气区。</p><button id="zincToggle">打开车间</button><div class="detail-buttons"><button data-zinc-view="cells">电积槽阵列</button><button data-zinc-view="power">直流电源系统</button></div>';
    document.getElementById('detailControls').before(div);function view(which){api.cancelCamera();setMode(which);const power=which==='power';camera.position.set(...window.NZ_MULTI_PLAN.movePoint('metal',[power?96:153,which==='closed'?37:29,power?107:113]));controls.target.set(...window.NZ_MULTI_PLAN.movePoint('metal',[power?110:129,2,76]));controls.update();}
    document.getElementById('zincToggle').addEventListener('click',()=>{api.exitTour();view(mode==='closed'?'cells':'closed');});div.querySelectorAll('[data-zinc-view]').forEach(b=>b.addEventListener('click',()=>{api.exitTour();view(b.dataset.zincView);}));setMode('closed');
  }
  function filter(){const l=LABELS3D.panamaZn;if(l&&mode==='closed')l.el.classList.add('layer-hidden');}
  return {setup,zinc,station,apply,focus,selection,ready,filter,mode:()=>mode,toolkit:()=>T};
})();
