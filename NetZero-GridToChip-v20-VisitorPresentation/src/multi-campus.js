/* v9 spatial migration and per-campus presentation; energy kernel stays intact. */
'use strict';
window.NZ_MULTI=(function(){
  const P=window.NZ_MULTI_PLAN;let T,api,quality='standard',panel,lastPaint=0;
  const footprints=[],migrated=[],connections=[],fineGroups=[],reserveGroups=[];
  const totals={compute:0,chemical:0,factory:0,public:0,shared:0,total:0,residual:0};
  function anchor(key,p){const l=LABELS3D[key];if(l)l.anc.set(...p);const d=DEVICES.find(x=>x.key===key);if(d)d.p=p.slice();}
  function name(key,title,subtitle){const l=LABELS3D[key];if(!l)return;l.el.querySelector('.nm').textContent=title;if(subtitle){let pr=l.el.querySelector('.pr');if(!pr){pr=document.createElement('div');pr.className='pr';l.el.append(pr);}pr.textContent=subtitle;}}
  function label(key,p,title,subtitle){if(LABELS3D[key]){anchor(key,p);name(key,title,subtitle);}else addLabel(key,p,title,subtitle,'');}
  function fence(b,g,gate=b.gate){
    const {box,cylinder,C}=T;
    const seg=(a,c)=>{const len=Math.hypot(c[0]-a[0],c[1]-a[1]);const n=Math.ceil(len/8);for(let i=0;i<=n;i++){const x=a[0]+(c[0]-a[0])*i/n,z=a[1]+(c[1]-a[1])*i/n;cylinder(.075,2.2,C.steel,x,1.1,z,g);}for(const y of [.85,1.75])box(Math.abs(c[0]-a[0])||.075,.07,Math.abs(c[1]-a[1])||.075,C.steel,(a[0]+c[0])/2,y,(a[1]+c[1])/2,g);};
    const edge=b===P.sites.energy?82:b.x1;
    if(b===P.sites.compute){seg([b.x0,b.z0],[143,b.z0]);seg([157,b.z0],[edge,b.z0]);}
    else seg([b.x0,b.z0],[edge,b.z0]);
    if(b===P.sites.compute){seg([84,b.z0],[84,6]);seg([84,6],[88,6]);seg([88,6],[88,40]);seg([88,40],[84,40]);seg([84,40],[84,53]);seg([84,65],[84,b.z1]);}
    else if(b===P.sites.factory){seg([b.x0,b.z0],[b.x0,-69]);seg([b.x0,-50],[b.x0,14]);seg([b.x0,30],[b.x0,b.z1]);}
    else seg([b.x0,b.z0],[b.x0,b.z1]);
    if(b===P.sites.energy){seg([82,b.z0],[82,6]);seg([82,6],[87,6]);seg([87,6],[87,40]);seg([87,40],[82,40]);seg([82,40],[82,51]);}
    else if(b===P.sites.compute){seg([b.x1,b.z0],[b.x1,16]);seg([b.x1,30],[b.x1,b.z1]);}
    else seg([b.x1,b.z0],[b.x1,b.z1]);
    seg([b.x0,b.z1],[gate[0]-7,b.z1]);seg([gate[0]+7,b.z1],[edge,b.z1]);
    if(b===P.sites.compute)return; // Keep the existing data-centre gate, guardhouse and branded flag.
    for(const x of [gate[0]-7,gate[0]+7])box(.5,3.2,.5,C.white,x,1.6,b.z1,g);
    box(14,.22,.35,C.teal,gate[0],3.2,b.z1,g);box(3,2.6,3,C.shell,b===P.sites.factory?323:gate[0]+10,1.3,b.z1-3,g);
  }
  function plaque(g,x,y,z,text,w=8){
    const cv=document.createElement('canvas');cv.width=1024;cv.height=256;const c=cv.getContext('2d');
    c.fillStyle='#edf3ef';c.fillRect(0,0,1024,256);c.fillStyle='#315c55';c.textAlign='center';c.textBaseline='middle';c.font='bold 65px Microsoft YaHei, sans-serif';c.fillText(text,512,128,990);
    const tex=new THREE.CanvasTexture(cv);tex.encoding=THREE.sRGBEncoding;
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,w/4),new THREE.MeshStandardMaterial({map:tex,side:THREE.DoubleSide,roughness:.8}));mesh.position.set(x,y,z);g.add(mesh);
    return mesh;
  }
  function shell(f){
    const {model,box,door,vent,fan,pad,C}=T,m=model(f.key,f.x,f.z),g=m.root;
    if(!f.integrated&&(f.h>0||!f.kind))pad(0,0,f.w,f.d,g);footprints.push({...f,x0:f.x-f.w/2,x1:f.x+f.w/2,z0:f.z-f.d/2,z1:f.z+f.d/2});
    if(f.integrated){
      g.userData.integrated=true;g.userData.parentFacility='factory';
    }else if(f.h===0 && !f.kind){
      // A pad and boundary marks express reservation; no operating hall is invented.
      for(const z of [-f.d/2+.3,f.d/2-.3])box(f.w-.6,.025,.14,C.teal,0,.39,z,g);
      for(const x of [-f.w/2+.3,f.w/2-.3])box(.14,.025,f.d-.6,C.teal,x,.39,0,g);
      plaque(g,0,1.6,f.d/2-.3,f.name+' · 未投运',14);reserveGroups.push(g);
    }else if(f.h>0 && f.key!=='panamaSc2' && f.kind!=='maintenance' && !window.NZ_CHEMICAL.handles(f.key)){
      box(f.w-.8,f.h,f.d-.8,C.shell,0,f.h/2+.36,0,g);box(f.w,.22,f.d,C.white,0,f.h+.48,0,g);
      for(let x=-f.w/2+2;x<f.w/2-1;x+=4){door(x,1.65,f.d/2-.32,2.5,2.5,g);vent(x,f.h-.7,f.d/2-.22,2,.6,m.fine);}
      for(const x of [-f.w*.28,f.w*.28]){box(2.2,.7,1.6,C.white,x,f.h+.94,0,m.fine);fan(x,f.h+1.35,0,.65,m.fine);}
      plaque(g,0,f.h-.7,f.d/2-.12,f.name,Math.min(15,f.w-2));
    }
    const items=[['归属',P.sites[f.zone].name],['状态',f.status],['功率口径',f.zone==='compute'?'包含于现有数据中心辅助负荷；后备能力待配置':f.zone==='public'?'原 24 位充电站容量内分配；停车不另计负荷':'工艺配套参数待配置；不宣称已核算完整公用工程能耗']];
    INFO[f.key]={t:f.name,d:f.key==='ups'?'直流后备电池服务于楼内 HVDC；交流 UPS 仅限明确的辅助负荷。未核算备用时长或切换可靠性。':f.h===0&&!f.kind?'二期预留用地，未投运，不增加当前 IT 容量和能耗。':'分区配套设施示意；运行设施对应现有辅助负荷，尚未配置的工艺接口不代表完整工程能力。',from:P.sites[f.zone].name,to:'对应分区设备',p:items,note:'场景尺寸为压缩展示；容量、工艺和工程参数沿用既有模型或待配置。'};
    label(f.key,[f.x,f.h+3,f.z],f.name,f.status);
    LABELS3D[f.key].lv.textContent=f.status||'配套设施';
    const pick=DEVICES.find(d=>d.key===f.key);pick.p=[f.x,Math.max(2,f.h/2),f.z];pick.r=Math.max(4,Math.max(f.w,f.d)/4);
    fineGroups.push(m.fine);return m;
  }
  function route(key,pts,pw,color){
    let e=EDGES.find(x=>x.key===key);
    if(!e){e={key,parts:[],spawnAcc:0,partCap:64,media:'power'};const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(PART_CAP*3),3));e.points=new THREE.Points(geo,new THREE.PointsMaterial({size:.55,color:color||0xd89737,transparent:true,opacity:.8,depthWrite:false}));e.points.frustumCulled=false;scene.add(e.points);e.visualTube=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshStandardMaterial({color:color||0xd89737,transparent:true,opacity:.5,roughness:.7}));scene.add(e.visualTube);EDGES.push(e);}
    if(key==='fcGas')e.pipe=1;
    e.pts=pts.map(x=>x.slice());e.seg=[];e.len=0;e.sag=0;e.parts=[];e.spawnAcc=0;if(pw)e.pw=pw;
    for(let i=1;i<pts.length;i++){const l=new THREE.Vector3(...pts[i]).distanceTo(new THREE.Vector3(...pts[i-1]));e.seg.push(l);e.len+=l;}
    if(color){e.color=color;e.tubeColor=color;e.points.material.color.setHex(color);e.visualTube.material.color.setHex(color);}
    const curve=new THREE.Curve();curve.getPoint=d=>new THREE.Vector3(...edgePoint(e,d));e.visualTube.geometry.dispose();e.visualTube.geometry=new THREE.TubeGeometry(curve,Math.max(40,Math.ceil(e.len/2)),e.pipe?.11:.085,6,false);
    // Physical cable covers / supported process lines remain when flow visualization is off.
    const m=T.models.multiConnections||(T.models.multiConnections=T.model('multiConnections',0,0));
    for(let i=1;i<pts.length;i++){const a=pts[i-1].slice(),b=pts[i].slice();if(!e.pipe){a[1]=.035;b[1]=.035;}T.rod(a,b,e.pipe?.055:.025,color||T.C.dark,m.root);}
    connections.push({key,pts:e.pts,media:e.media});return e;
  }
  function move(){
    const models=T.models;
    for(const [key,d]of Object.entries(P.moves)){
      if(key==='smr')continue; // SMR is built at registry position by infrastructure.
      const m=models[key];if(m){m.root.position.x+=d[0];m.root.position.z+=d[1];m.x+=d[0];m.z+=d[1];migrated.push(key);}
      const legacy=scene.getObjectByName('Scaled legacy '+key);if(legacy){legacy.position.x+=d[0];legacy.position.z+=d[1];}
      const l=LABELS3D[key];if(l)anchor(key,P.movePoint(key,l.anc.toArray()));
    }
    const hydroLegacy=T.group(scene,'Migrated hydrogen legacy vessels');hydroLegacy.position.set(165,0,-240);
    for(const o of scene.children.slice()){
      if(o===hydroLegacy||o.isPoints||!o.isMesh||!o.geometry||o.geometry.type==='TubeGeometry'||o.name.startsWith('Detailed'))continue;
      if(o.position.x>=8&&o.position.x<=65&&o.position.z>=61&&o.position.z<=71){hydroLegacy.add(o);}
    }
    // Old campus fence and obsolete landscaping are removed before static batching.
    for(const o of scene.children.slice()){
      if(o.userData.retiredCampusFence){scene.remove(o);continue;}
      if(!o.isMesh||!o.geometry||o===ground||o===socBar||o===h2Liquid)continue;
      const p=o.geometry.parameters||{},plant=o.geometry.type==='ConeGeometry'||o.geometry===bushG||(o.geometry.type==='SphereGeometry'&&p.radius>.65&&o.position.y<5)||(o.geometry.type==='CylinderGeometry'&&p.radiusTop<.16&&p.radiusBottom<.26&&p.height<3);
      if(plant&&o.position.x>=0)scene.remove(o);
      if(o.geometry.type==='PlaneGeometry'&&o.position.x>=-10&&Math.abs(o.position.y-.03)<.001)scene.remove(o);
    }
    name('factory','智能制造与柔性用能区','20–100 MW · 计划 50 MW · 工艺待配置');
    name('logistics','IT 收货、检测与备件库','数据中心物流 · 运维维修');
    name('nh3','氨合成工艺区','现有氢氨模型 · 配套接口待配置');
    name('substation','共享能源升压枢纽','风光汇集 · 各园区独立馈线');
    name('fc','化工区氢燃料电池','2 MW · 氢源在本区 · 回发至共享母线');
    for(const key of ['factory','logistics','nh3','substation','fc'])INFO[key].t=LABELS3D[key].el.querySelector('.nm').textContent;
    INFO.factory.d='独立制造分区，保留原有 20–100 MW 柔性负荷、50 MW 计划与爬坡约束。实际工艺待配置；并非所有制造流程均可频繁调节。';
    INFO.factory.note+=' 单日余电不代表全年保障，计划待完成任务与购电按原内核核算。';
    INFO.logistics.d='原物流仓库调整为数据中心 IT 设备收货、检测、备件及维修空间，装卸通道与机房核心区分开。';
    INFO.logistics.from='服务器及 IT 设备供应';INFO.logistics.to='A1 数据楼 / 运维维修';
    INFO.fc.from='本区储氢';INFO.fc.to='本区受电开关 → 共享能源母线';
    INFO.nh3.note+=' 氮气供应、产品储运及水处理为待配置接口，未新增独立能耗或认证结论。';
    INFO.smr.note+=' 地理东北侧留有示意隔离空间；主导风向与外部风险未完成场址评估。';
  }
  function electrical(){
    const firstDC=T.models.panamaSc;firstDC.root.position.set(37,0,85);firstDC.x=37;firstDC.z=85;
    anchor('panamaSc',[37,5.4,85]);
    const servedAux=()=>Math.max(0,S.demandServedMW-S.dcLoadMW-S.sc-S.metal-S.factory-S.h2P);
    const chemicalAux=()=>Math.min(servedAux(),Math.max(0,S.nh3KgH*window.NZ_CONFIG.PLANT.ammoniaMWhPerT/1000));
    const chemicalNet=()=>S.metal+S.h2P+chemicalAux()-S.fcMW;
    route('feedOutW',[[78,.84,52],[83,.84,52],[83,.84,-151],[109,.84,-151]],chemicalNet);
    const port=P.factoryHall.ports;
    route('feedOut',[[78,.84,52],[83,.84,52],[83,.84,156],[231,.84,156],[231,.84,134],[260,.84,134],port.control],()=>S.factory);
    route('facE',[port.control,[260,.84,134],[319.5,.84,134],[319.5,.84,115.2],[304,.84,115.2],port.process],()=>S.factory);
    route('metalE',[[121,.84,-151],[126,.84,-151],[126,.84,-200],[128,.84,-200]],()=>S.metal);
    route('panZnAc',[[128,.84,-200],[128,.84,-219],[128,1,-225]],()=>S.metal);
    route('panZnDc',[[128,2.2,-225],[135,2.2,-225],[135,2.2,-217],[153,2.2,-217]],()=>S.metal);
    route('pem',[[121,.84,-151],[126,.84,-151],[126,.84,-190],[181,.84,-190],[181,.84,-176.2]],()=>S.h2P);
    route('nh3E',[[126,.84,-190],[215,.84,-190],[215,.84,-177]],chemicalAux);
    const fc=route('fc',[[225,.84,-175.2],[225,.84,-190],[126,.84,-190],[126,.84,-151],[121,.84,-151]],()=>S.fcMW,0xd89737);fc.media='power';
    for(const key of ['h2gas','h2use']){const e=EDGES.find(x=>x.key===key);route(key,window.NZ_CHEMICAL_PLAN.paths[key].pts,e.pw,0x398ad1);}
    const h2=route('fcGas',[[204.8,1.3,-174],[204.8,1.3,-184],[225,1.3,-184],[225,1.3,-174]],()=>S.fcMW*window.NZ_CONFIG.PLANT.fuelCellKgPerMWh/20,0x398ad1);h2.media='hydrogen';
    route('nh3',window.NZ_CHEMICAL_PLAN.paths.nh3.pts,()=>S.nh3KgH/40,0x8c78b5);
    // Storage shares the original common switch point; public charging has its own branch.
    route('stg',[[28,1,35],[28,1,52],[78,1,52]],()=>S.stP);
    route('scE',[[78,.84,52],[30,.84,52]],()=>S.sc);
    route('panScDc',[[37,1,87.4],[42,1,87.4],[42,1,84],[45,1,84]],()=>S.sc/2);
    route('scSecondAc',[[30,.84,52],[30,.84,109],[33.5,.84,109]],()=>S.sc/2);
    route('scSecondDc',[[40.5,1,109],[43,1,109],[43,1,112],[45,1,112]],()=>S.sc/2);
    route('panScAc',[[30,.84,52],[37,.84,52],[37,.84,82.6]],()=>S.sc/2);
  }
  function cooling(m){
    const {box,fan,rod,cylinder,C}=T,g=m.root;
    // Closed dry cooling banks, liquid-to-water exchange and an adjacent covered service manifold.
    for(let i=0;i<4;i++)for(const z of [-6,5]){const x=-10.5+i*7;box(5.6,1.2,4,C.steel,x,6.2,z,g);for(const dz of [-1,1])fan(x,6.87,z+dz,.85,g);}
    for(const z of [-6,5]){rod([-13,2,z],[13,2,z],.12,C.blue,g);rod([-13,2.5,z],[13,2.5,z],.12,C.teal,g);}
    for(const x of [-12,12])cylinder(.75,2.5,C.white,x,1.7,-9,g);
    const pipes=T.model('dcCoolingConnections',0,0).root;
    for(const [x,c]of [[151,T.C.blue],[153,T.C.teal]]){rod([145,2,70],[x,2,70],.1,c,pipes);rod([x,2,70],[x,2,10],.1,c,pipes);rod([x,2,10],[149,2,0],.1,c,pipes);}
  }
  function accessories(f,m){
    const {box,cylinder,rod,ring,fan,C}=T,g=m.root,details=m.fine;
    if(f.key==='nitrogen'){
      for(const x of [-5,0,5]){cylinder(.9,2.4,C.white,x,f.h+1.8,0,g);ring(.94,.05,C.steel,x,f.h+2.7,0,g);rod([x,f.h+2.9,0],[x,f.h+2.9,4],.08,C.blue,details);box(1.8,.45,1.8,C.steel,x,f.h+.8,0,g);}
      box(10,.3,1,C.steel,0,f.h+.8,4,g);rod([-5,f.h+2.9,4],[5,f.h+2.9,4],.08,C.blue,g);
      const pipes=T.model('Nitrogen service interface',0,0).root;rod([246,1.1,-168],[246,1.1,-163],.06,C.steel,pipes);rod([246,1.1,-163],[219,1.1,-163],.06,C.steel,pipes);rod([219,1.1,-163],[217,1.1,-174],.06,C.steel,pipes);
    }else if(f.key==='chemwater'){
      for(const x of [-7,7]){cylinder(2.5,1.4,C.shell,x,f.h+1.2,0,g);cylinder(2.6,.12,C.white,x,f.h+1.96,0,g);ring(2.65,.06,C.teal,x,f.h+2.08,0,details);}
      for(let i=0;i<4;i++)box(1.3,1.2,2,C.steel,-3+i*2,f.h+1.1,5,g);
      for(const x of [-7,7])rod([x,f.h+1.6,0],[x,f.h+1.6,5],.09,C.blue,g);rod([-7,f.h+1.6,5],[7,f.h+1.6,5],.09,C.blue,g);
    }else if(f.key==='ammoniastock'){
      for(const x of [-4,0,4]){box(2.7,1.1,2.8,C.white,x,f.h+1.1,-2,g);ring(.45,.04,C.teal,x,f.h+1.68,-2,details);}
      for(let x=-5;x<=5;x+=2){box(.13,2.3,.13,C.steel,x,1.55,f.d/2-.4,g);box(1.4,.2,1,C.steel,x,2.7,f.d/2-.5,details);}
    }else if(f.key==='firewater'){
      for(const x of [-4,4]){cylinder(2.1,1.8,C.white,x,f.h+1.4,0,g);ring(2.14,.04,C.steel,x,f.h+2.35,0,details);}box(4,.8,2,C.steel,0,f.h+1,0,g);
    }else if(f.key==='ups'){
      for(let x=-9;x<=9;x+=3){box(1.7,2.2,.15,C.dark,x,2.2,f.d/2-.12,g);for(let y=1.4;y<=3;y+=.4)box(1.35,.1,.17,C.blue,x,y,f.d/2-.02,details);}
    }else if(f.key==='noc'){
      for(let x=-8;x<=8;x+=4)for(const y of [2.2,4.6])box(2.6,1.3,.1,C.glass,x,y,f.d/2-.1,g);
      const paths=[[[149,.05,0],[157,.05,0],[157,.05,87],[171,.05,87],[171,.05,103],[172,.05,103]],[[119,.05,0],[100,.05,0],[100,.05,95],[171,.05,95],[171,.05,106],[172,.05,106]]];
      const fiber=T.model('Dual physical fibre paths',0,0).root;for(const pts of paths)for(let i=1;i<pts.length;i++)rod(pts[i-1],pts[i],.025,C.teal,fiber);
      INFO.noc.from='分开的光纤入园路径示意';INFO.noc.to='A1 网络接入';INFO.noc.note+=' 未建立通信运营商及网络可靠性模型。';
    }
  }
  // Loaded into NZ_MULTI by the one-off v10 migration. It uses the same instanced toolkit.
  const systemBoundaries={
    cooling:{campus:'集中冷源、泵组、水处理与主要散热',building:'CDU 隔离换热、液冷分配及空气侧末端；屋顶仅辅助风冷',meter:'包含于 dcFixedMW + dcAuxRatio × IT，未细分热力模型'},
    backup:{campus:'50 MW 燃气轮机，部分负荷保障；默认冷备用',building:'园区备用进线接口；不另建柴油机',dcBattery:'直流后备电池 → HVDC；备用时长待配置',acUPS:'仅控制、网络等明确辅助负荷；未配置容量'},
    network:{campus:'运营商入园、园区骨干与运维',building:'楼内交换、列间布线与机柜接入'},
    sample:{racks:24,ratedKW:1440,campusITMaxMW:300,method:'同一负载比例的代表性机房样本，样本功率不叠加园区账本'},
    review:'工程概念展示，非可施工设计；A/B 共用上游，故障隔离与可靠性等级未验证'
  };
  function completion(f,m){
    const {box,rod,cylinder,ring,door,vent,fan,C}=T,g=m.root;
    const kind=f.kind;
    if(kind==='maintenance'){
      box(26,5,12,C.shell,0,2.85,-5,g);box(26.6,.23,12.6,C.white,0,5.48,-5,g);
      for(const x of [-8,0,8]){door(x,2.05,1.12,5.6,3.3,g);box(6.2,.16,1.4,C.steel,x,3.9,1.6,g);}
      for(const x of [-11,11]){box(1.4,.9,.12,C.glass,x,4.45,1.17,g);vent(x,3.9,-11.08,1.4,.6,m.fine);}
      plaque(g,0,4.5,1.25,'设备检修与备件周转',17);
      for(const x of [-9,-3,3]){box(3.8,.025,5,C.steel,x,.4,7,g);box(.08,.025,5,C.white,x-1.9,.43,7,g);box(3.8,.025,.08,C.white,x,.43,9.5,g);}
      for(const x of [-9,-6]){box(2,.16,1.6,C.steel,x,.52,5,g);box(1.8,1.1,1.4,C.white,x,1.15,5,g);}
      // A small service van and clear east access distinguish this yard from bulk logistics.
      box(2.1,1.5,4,C.white,6,1.22,7,g);box(1.9,.55,1.4,C.glass,6,2.1,8,g);
      for(const x of [4.95,7.05])for(const z of [5.8,8.2])box(.22,.55,.65,C.dark,x,.66,z,g);
      box(4,.025,.16,C.teal,11,.43,7,g);
      INFO[f.key].d='原消防站地块改为数据中心设备检修、关键备件存放和装卸周转。网络接入与运维中心负责监控和管理，此处负责实物检修与备件周转；不作为废旧电池集中存放点。';
      INFO[f.key].from='数据中心设备与备件';INFO[f.key].to='A1 机房 / 后续扩建与设备更换';
    }else if(kind==='parking'){
      box(f.w,.05,f.d,C.steel,0,.13,0,g);
      for(let i=0;i<12;i++)for(const side of [-1,1]){
        const x=-22+i*4,z=side*4.4;
        box(.08,.025,4.5,C.white,x-1.8,.17,z,g);box(3.6,.025,.08,C.white,x,.17,side*6.7,g);
        box(1.5,.12,.14,C.dark,x,.23,side*5.8,g);

      }
      for(const x of [-18,0,18]){box(2,.02,.12,C.white,x,.18,0,g);box(.1,.02,1,C.white,x+.7,.18,0,g);}
      // Two reserved bays adjoining the pedestrian path; color and sign remain in every mode.
      box(7.5,.025,4.5,C.blue,-20,.175,-4.4,g);plaque(g,-20,1.8,-6,'无障碍停车',5);
      box(f.w,.03,.8,C.white,0,.17,6.4,g);
      plaque(g,0,2.1,8,'普通停车 · 混合停放',8);for(const x of [-3,3])box(.1,2.1,.1,C.steel,x,1.05,8,g);
      INFO.parking.d='独立露天普通停车区，新能源与传统燃油车混合停放；24 个展示车位，含 2 个无障碍车位。区内不布置充电终端，与北侧统一光伏顶棚的新能源充电站分开。';
    }else if(kind==='power'){
      if(f.key==='panamaSc2'){
        T.cabinet(f.key,f.x,f.z,3,3,4.4,true);m=T.models[f.key];fineGroups.push(m.fine);
        box(2.1,1.8,3,C.shell,-2.4,1.4,0,m.conversion);for(let z=-1;z<=1;z+=.3)box(.12,1.4,2,C.steel,-3.3,1.4,z*.5,m.fine);
        INFO[f.key].d='第二排专用集成直流电源：受电隔离变换、整流模块、直流输出保护和散热；可拆解观察。车辆侧输出随车辆协议调节，非数据中心 240 V DC 母线。';
        INFO[f.key].p.push(['服务范围','第二排 12 位；第一排使用原直流电源'],['合计上限','两排共 24 位 / 28.8 MW（原模型）']);
      }else{
        for(let x=-f.w/2+2;x<f.w/2;x+=2.7){box(1.9,2.5,1.3,C.dark,x,1.7,f.d/2-.7,g);box(.5,.25,.05,C.teal,x,2.3,f.d/2,m.fine);}
        for(const x of [-4,4])box(3,1.7,3,C.steel,x,f.h+1.4,-1,g);
      }
    }else if(kind==='warehouse'){
      for(let x=-f.w/2+3;x<f.w/2-2;x+=6){box(4,.3,1,C.steel,x,.6,f.d/2-.4,g);for(let dz=-1;dz<=1;dz++)box(1.6,.8,1.2,C.steel,x,.9,f.d/2-1.8-dz*1.4,g);}
      for(let x=-f.w/2+1;x<f.w/2;x+=3)box(.12,.02,2,C.white,x,.4,f.d/2-1,g);
      INFO[f.key].to=f.zone==='factory'?'制造主厂房 / 专用物流通道':'所属工艺区 / 专用物流通道';
    }else if(['process','liquid','scrubber','utility','fire'].includes(kind)){
      // Open process decks carry vessels, pumps, compressors and paired headers.
      for(let i=0;i<3;i++){
        const x=-f.w*.32+i*f.w*.32,y=f.h+.8;
        if(kind==='scrubber'){cylinder(.85,3.7,C.white,x,y+1.3,0,g);ring(.9,.06,C.teal,x,y+2.7,0,m.fine);rod([x,y+3.2,0],[x,y+3.2,2.8],.1,C.steel,g);}
        else if(kind==='process'||kind==='utility'){box(2.3,.6,2.2,C.steel,x,y,0,g);T.shape('cyl',[.6,.6,2.4],C.white,[x,y+1,0],g,[Math.PI/2,0,0]);box(.8,.8,1,C.teal,x,y+.5,2,g);}
        else {cylinder(.9,1.7,C.white,x,y+.6,0,g);ring(.95,.04,C.blue,x,y+1.5,0,m.fine);box(.8,.8,1.6,C.steel,x,y+.4,2,g);}
      }
      for(const [z,col]of [[-f.d*.3,C.blue],[f.d*.3,C.teal]])rod([-f.w*.4,f.h+1,z],[f.w*.4,f.h+1,z],.11,col,g);
    }else if(kind==='staging'||kind==='hazard'){
      box(f.w,.08,f.d,C.steel,0,.17,0,g);
      for(let x=-f.w/2+2;x<f.w/2-1;x+=5){box(.08,.02,f.d-2,C.white,x,.23,0,g);if(kind==='staging'){box(2,1.2,2,C.shell,x+1.5,.9,-f.d/2+3,g);box(2,.1,2,C.teal,x+1.5,1.55,-f.d/2+3,g);}}
      if(kind==='hazard'){
        for(const x of [-7,7]){cylinder(.09,3,C.steel,x,1.7,0,g);rod([x,3,0],[x+2,3,0],.12,C.teal,g);rod([x+2,3,0],[x+2,1.2,0],.1,C.teal,g);}
        for(const x of [-f.w/2+1,f.w/2-1])for(const z of [-f.d/2+1,f.d/2-1])cylinder(.15,1,C.steel,x,.7,z,g);
        plaque(g,0,2.4,-f.d/2+1,'氨产品专用装卸 · 示意',13);
      }else {plaque(g,0,1.6,-f.d/2+.8,f.name,Math.min(13,f.w));const tx=f.w>15?6:0;box(2.3,1.8,5,C.white,tx,1.2,2,g);box(2.3,1.5,1.7,C.teal,tx,1.05,5.2,g);for(const dx of [-1.15,1.15])for(const z of [.5,3.6,5.1])box(.2,.6,.8,C.dark,tx+dx,.5,z,g);}
    }else if(kind==='control'){
      for(let x=-f.w*.35;x<f.w*.4;x+=3)box(1.8,1.2,.1,C.glass,x,2.8,f.d/2-.15,g);
    }
  }
  function completeConnections(){
    const g=T.model('v10 process and support interfaces',0,0).root,{rod,box,C}=T;
    const link=(a,b,col=C.teal)=>{rod(a,b,.075,col,g);};
    for(const [a,b]of [
      [[145,.04,-242],[145,.04,-236.5]],
      [[174,.04,-241],[174,.04,-239]],[[174,.04,-239],[160,.04,-239]],[[160,.04,-239],[160,.04,-236.5]],
      [P.factoryHall.ports.utility,[308,1.4,114]],[[308,1.4,114],P.factoryHall.ports.process]])link(a,b);
    for(const pts of [
      [[115,.04,-157],[115,.04,-244]],
      [P.factoryHall.ports.control,[260,.04,134],[319.5,.04,134],[319.5,.04,115.2],[304,.04,115.2],P.factoryHall.ports.process],
      [[172,.05,66],[157,.05,66],[157,.05,12],[149,.05,12],[149,.05,0]],
      [[246,.05,-186],[246,.05,-190]]
    ])for(let i=1;i<pts.length;i++)link(pts[i-1],pts[i],C.dark);
    for(const key of ['chemicalfeed','factoryfeed']){const m=T.models[key];for(const x of [-3,3]){box(2,1.6,2,C.steel,x,4.4,-1,m.root);T.fan(x,5.3,-1,.6,m.fine);}}
    anchor('supercharge',[64,7.5,98]);anchor('carport',[64,6.5,100]);
    name('supercharge','新能源充电站','统一光伏顶棚 · 24 终端 · 大巴长车位');INFO.supercharge.t='新能源充电站';
    name('carport','充电站统一光伏顶棚','连续结构 · 中央采光带 · 原光伏配置');
    INFO.carport.t='充电站统一光伏顶棚';INFO.carport.d='两排新能源充电车位共用连续顶棚与结构，中间设置采光带和通行车道；光伏供本充电站就地使用。';INFO.carport.note='空间合并不增加光伏或充电容量，仍沿用既有 0.5 MWp 顶棚光伏参数。';
    name('panamaSc','新能源充电站北排直流电源','独立供电 · 可调车辆侧直流');INFO.panamaSc.t='新能源充电站北排直流电源';
    INFO.supercharge.d='两排充电车位集中布置于同一座连续光伏顶棚下，中间设通行车道与采光带，共 24 个终端，分别由两套直流电源供电。南侧露天普通停车区混合停放，保留传统燃油车车位。24个终端对应21个停车位置，含一个大巴长车位；容量及顶棚光伏核算保持原配置。';
    INFO.supercharge.from='公共服务区独立馈线 / 两套专用直流电源';INFO.supercharge.to='新能源车辆充电';
    INFO.panamaSc.d='第一排专用直流电源；车辆侧为协议适配的可调输出，与楼内 240 V DC 系统分开。';
    INFO.cooling.d=systemBoundaries.cooling.campus+'；通过设施侧供回管连接楼内 CDU。楼内 CDU 隔离设备侧循环，屋顶仅保留辅助风冷。';
    INFO.cooling.p.push(['园区 / 楼内分工','集中冷源与散热 / CDU、液冷分配和空气侧末端'],['工程待核验','热负荷、泵流量、换热温差、冗余及供电保障']);
    INFO.ups.from='数据中心辅助与后备配电';INFO.ups.to='楼内 HVDC 后备接口 / 明确的交流辅助负荷';
    INFO.ups.p.push(['计量边界','不等同于区域储能，不增加当前可用备用电量'],['待配置','直流电池容量、自治时长、切换、消防及交流辅助 UPS']);
    INFO.noc.d='运营商接入、园区骨干与运维中心，连接楼内交换、布线与机柜接入；分工不重复。';
    INFO.dc.p.push(['楼内样本','24 台 × 60 kW；代表性机房单元，非整栋楼容量'],['热力边界','园区集中冷站 → 楼内 CDU / 液冷末端'],['后备电源','直流后备电池接口；50 MW 燃机部分保障']);
    INFO.dc.note+=' 楼内负载比例同步园区；样本功率不再次计入总账。';
  }

  function fireStation(){
    const {model,box,rod,cylinder,door,vent,pad,C}=T,m=model('fireYard',150,-73),g=m.root;
    const b=P.sites.emergency;pad(0,0,64,52,g);
    const legacy=scene.getObjectByName('Scaled legacy fire');if(legacy)legacy.position.y=.35;
    // Existing garage, appliance and training tower move together; new wings complete the station.
    box(12,4.6,14,C.shell,-24,2.65,-7,g);box(12.5,.24,14.5,C.white,-24,5.08,-7,g);
    door(-24,1.9,.13,2,2.8,g);plaque(g,-24,3.9,.22,'值班通信 · 装备库',10);
    for(const x of [-27,-21]){box(2,.9,.1,C.glass,x,3,-14.08,g);vent(x,2.4,-14.16,1.5,.6,m.fine);}
    box(12,.04,8,C.steel,-8,.4,-20,g);
    for(const x of [-13,-8,-3])box(.1,.025,7,C.white,x,.44,-20,g);
    plaque(g,-8,1.2,-24,'训练场',5);
    box(52,.04,12,C.steel,1,.4,17,g);
    box(6,.045,40,C.steel,24,.405,-4,g);
    for(const z of [11,23])box(50,.025,.1,C.white,1,.44,z,g);
    for(const z of [13,18]){box(.12,.025,3,C.white,0,.45,z,g);box(2,.025,.12,C.white,0,.45,z+1.4,g);}
    const rail=(a,b)=>{const len=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.ceil(len/6);for(let i=0;i<=n;i++)cylinder(.065,1.9,C.steel,a[0]+(b[0]-a[0])*i/n,1.3,a[1]+(b[1]-a[1])*i/n,g);for(const y of [1,1.9])rod([a[0],y,a[1]],[b[0],y,b[1]],.04,C.steel,g);};
    rail([-32,-26],[18,-26]);rail([30,-26],[32,-26]);rail([-32,-26],[-32,26]);rail([32,-26],[32,26]);rail([-32,26],[-7,26]);rail([7,26],[32,26]);
    for(const x of [-7,7])box(.5,3.1,.5,C.white,x,1.9,26,g);
    box(14,.22,.3,C.red,0,3.4,26,g);plaque(g,0,3.95,26.22,'消防站',8);
    for(const x of [-29,29]){cylinder(.07,5,C.dark,x,2.9,20,g);box(1.2,.15,.5,C.white,x,5.45,20,g);}
    label('fire',[150,10.5,-76],'消防站','应急备勤');LABELS3D.fire.lv.textContent='应急备勤';
    INFO.fire={t:'消防站',media:'power',d:'位于数据中心、化工区与柔性制造区之间，设消防车库、值班通信与装备库、出车前场和小型训练场。南侧连接数据中心与制造区应急入口，北侧接化工区外侧道路；各园区原有消防水源与现场应急点保留。',from:'片区公共应急道路',to:'数据中心 / 化工区 / 柔性制造区',p:[['功能','消防备勤与跨园区应急支援'],['配套','车库、装备、通信、训练与出车前场'],['用电','沿用现有公辅负荷，不新增核算容量']],note:'示意布局，不标注未经核算的响应时限。'};
    const pick=DEVICES.find(d=>d.key==='fire');if(pick){pick.p=[150,4,-78];pick.r=12;}
    footprints.push({key:'fire',name:'消防站',zone:'emergency',...b});
  }

  function apply(){
    T=window.NZ_LAYOUT.toolkit();move();
    window.NZ_CHEMICAL.prepare(T);
    const perimeter=T.group(scene,'v9 Independent campus boundaries');
    for(const key of ['compute','chemical','factory','energy']){const b=P.sites[key];fence(b,perimeter);if(key!=='compute')plaque(perimeter,b.gate[0],2.7,b.z1+.2,b.name,12);}
    footprints.push({key:'factory',name:'智能制造主厂房',zone:'factory',...P.factoryHall.bounds});
    for(const f of P.facilities){const m=shell(f);if(f.integrated)continue;if(window.NZ_CHEMICAL.handles(f.key)){window.NZ_CHEMICAL.facility(f,m);continue;}if(f.key==='cooling')cooling(m);accessories(f,m);completion(f,m);}
    fireStation();
    electrical();completeConnections();window.NZ_CHEMICAL.complete(T);T.compile();fineGroups.forEach(g=>g.userData.qualityOnly=true);
    setQuality(S.quality);
  }
  function focus(key){
    if(key==='factorywaste')return {pos:[309,100,67],tgt:[244,3,-23]};
    if(key==='fire')return {pos:[214,48,-4],tgt:[150,3,-73]};
    if(key==='factory')return {pos:[365,120,200],tgt:[280,3,18]};
    if(key==='factoryraw')return {pos:[312,38,-21],tgt:[280,2,-65]};
    if(key==='factoryproduct')return {pos:[312,38,145],tgt:[280,2,101]};
    const chemical=window.NZ_CHEMICAL.focus(key);if(chemical)return chemical;
    const f=P.facilities.find(x=>x.key===key);if(f)return {pos:[f.x+f.w*1.1,Math.max(22,f.w*.9),f.z+f.d*2],tgt:[f.x,Math.max(1,f.h/2),f.z]};
    if(key==='supercharge')return {pos:[97,9,137],tgt:[64,1.5,98]};if(key==='carport')return {pos:[116,52,157],tgt:[60,2,108]};
    if(key==='panamaSc')return {pos:[60,30,114],tgt:[37,2,85]};
    if(P.moves[key]){const m=window.NZ_DETAIL.models[key];if(!m)return null;const size=key==='smr'?110:key==='metal'?55:key==='factory'?70:35;return {pos:[m.x+size*.8,size*.65,m.z+size],tgt:[m.x,key==='smr'?7:4,m.z]};}
    return null;
  }
  function ready(a){
    api=a;panel=document.createElement('div');panel.id='multiCampusControls';
    panel.innerHTML='<div class="detail-kicker">分园区实时用能 · 同一总账</div><div id="multiRows"></div><div class="multi-note" id="multiNote"></div><div class="multi-actions">'+['compute','chemical','nuclear','factory','energy'].map(k=>'<button data-campus="'+k+'">'+P.sites[k].name+'</button>').join('')+'<button data-campus="top">北向俯视</button></div>';
    document.getElementById('flexHud').after(panel);
    const north=document.createElement('button');north.className='iconbtn';north.id='btnNorthTop';north.textContent='北向俯视';north.addEventListener('click',()=>panel.querySelector('[data-campus="top"]').click());document.querySelector('.scene-tools').prepend(north);
    panel.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{api.exitTour();api.closeDrawer();api.cancelCamera();const key=b.dataset.campus;
      if(key==='top'){camera.position.set(-70,1300,-107.99);controls.target.set(-70,0,-108);}
      else{const site=P.sites[key],cx=(site.x0+site.x1)/2,cz=(site.z0+site.z1)/2,span=Math.max(site.x1-site.x0,site.z1-site.z0);camera.position.set(cx+span*.7,span*.75,cz+span);controls.target.set(cx,3,cz);}controls.update();}));
    update();
  }
  function update(){
    const aux=Math.max(0,S.demandServedMW-S.dcLoadMW-S.sc-S.metal-S.factory-S.h2P),chemicalAux=Math.min(aux,Math.max(0,S.nh3KgH*window.NZ_CONFIG.PLANT.ammoniaMWhPerT/1000));
    totals.compute=S.dcLoadMW;totals.chemical=S.metal+S.h2P+chemicalAux;totals.factory=S.factory;totals.public=S.sc;totals.shared=aux-chemicalAux;
    totals.total=totals.compute+totals.chemical+totals.factory+totals.public+totals.shared;totals.residual=totals.total-S.demandServedMW;
    if(!panel)return;
    const now=performance.now();if(now-lastPaint<250)return;lastPaint=now;
    document.getElementById('multiRows').innerHTML=[['数据中心',totals.compute],['化工与电冶金',totals.chemical],['智能制造',totals.factory],['公共充电',totals.public],['共享辅助',totals.shared],['负荷合计',totals.total]].map(([n,v])=>'<div class="multi-row"><span>'+n+'</span><b>'+v.toFixed(v<1?2:1)+' MW</b></div>').join('');
    document.getElementById('multiNote').textContent='制造计划 '+S.factoryPlanMW.toFixed(0)+' MW · 实际 '+S.factory.toFixed(1)+' MW · 待完成任务 '+S.debtFac.toFixed(1)+' MWh。配套电耗归属待核验；未核算分园区绿电比例。';
  }
  function setQuality(q){quality=q;fineGroups.forEach(g=>g.visible=q==='high');}
  function obstructions(){scene.updateMatrixWorld(true);return Object.entries(window.NZ_DETAIL.models).filter(([k,m])=>P.zoneFor[k]||P.facilities.some(f=>f.key===k)).map(([key,m])=>{const b=new THREE.Box3().setFromObject(m.root);return {key,kind:'设备',min:b.min.toArray(),max:b.max.toArray()};}).filter(b=>b.min.every(Number.isFinite));}
  function audit(){return {sites:P.sites,facilities:footprints,migrated,connections,quality,totals:{...totals},systems:systemBoundaries,charging:{rows:2,terminals:24,capacityMW:28.8,dcSupplies:2,parkingSpaces:24,chargingPositions:21,busBays:1,unifiedCanopy:true,layout:P.charging},factory:{actualMW:S.factory,planMW:S.factoryPlanMW,minimumMW:20,capacityMW:100,debtMWh:S.debtFac},obstructions:obstructions()};}
  return {apply,ready,update,setQuality,focus,audit,obstructions,connections:()=>connections};
})();
