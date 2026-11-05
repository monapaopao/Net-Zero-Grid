/* v15 chemical exhibition assets. All modelling uses existing device IDs and ledger boundaries. */
'use strict';
window.NZ_CHEMICAL=(function(){
  const P=window.NZ_CHEMICAL_PLAN,models={},ports=P.ports,inspection=[];
  let T,C,panel;const fine=[];
  const handles=key=>P.custom.includes(key);
  function meshSphere(g,x,y,z,rx,ry,rz,color){
    const mesh=new THREE.Mesh(sphereGeometry,material(color));mesh.position.set(x,y,z);mesh.scale.set(rx,ry,rz);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;
  }
  const sphereGeometry=new THREE.SphereGeometry(1,20,12),mats={};
  const material=c=>mats[c]||(mats[c]=new THREE.MeshStandardMaterial({color:c,metalness:.25,roughness:.55}));
  function pipe(g,pts,color=C.steel,r=.09){for(let i=1;i<pts.length;i++)T.rod(pts[i-1],pts[i],r,color,g);}
  function vertical(g,x,z,r,h,y=.65,color=C.white){
    T.cylinder(r,h,color,x,y+h/2,z,g);meshSphere(g,x,y,z,r,r*.45,r,color);meshSphere(g,x,y+h,z,r,r*.45,r,color);
    for(const dx of [-r*.65,r*.65])T.box(.28,y,.42,C.steel,x+dx,y/2,z,g);
  }
  function horizontal(g,x,y,z,r,len,axis='x',color=C.white){
    const xAxis=axis==='x';T.shape('cyl',[r,r,len],color,[x,y,z],g,xAxis?[0,0,Math.PI/2]:[Math.PI/2,0,0]);
    for(const d of [-len/2,len/2])meshSphere(g,x+(xAxis?d:0),y,z+(xAxis?0:d),xAxis?r*.55:r,r,xAxis?r:r*.55,color);
    for(const d of [-len*.3,len*.3])T.box(xAxis?.6:r*1.5,Math.max(.3,y-r),xAxis?r*1.5:.6,C.steel,x+(xAxis?d:0),(y-r)/2,z+(xAxis?0:d),g);
  }
  function valve(g,x,y,z,color=C.teal){T.box(.3,.32,.3,C.steel,x,y,z,g);T.rod([x,y,z],[x,y+.5,z],.045,C.steel,g);T.ring(.22,.04,color,x,y+.52,z,g);}
  function pump(g,x,z,color=C.teal,y=.65){
    T.box(2.4,.22,1.3,C.steel,x,y-.15,z,g);T.shape('cyl',[.4,.4,1.2],color,[x+.35,y+.45,z],g,[0,0,Math.PI/2]);T.cylinder(.45,.65,C.white,x-.55,y+.45,z,g);pipe(g,[[x-.55,y+.8,z],[x-.55,y+1.25,z+.6]],C.steel,.1);
  }
  function skid(g,x,z,w,d){T.pad(x,z,w,d,g);for(const zz of [z-d*.33,z+d*.33])T.box(w-.4,.25,.2,C.dark,x,.58,zz,g);}
  function frame(g,x,z,w,d,h,roof=false){
    for(const xx of [x-w/2,x+w/2])for(const zz of [z-d/2,z+d/2]){T.box(.18,h,.18,C.steel,xx,h/2+.4,zz,g);T.box(.8,.25,.8,C.white,xx,.4,zz,g);}
    for(const zz of [z-d/2,z+d/2])T.box(w+.3,.25,.22,C.steel,x,h+.4,zz,g);
    for(const xx of [x-w/2,x+w/2])T.box(.2,.25,d,C.steel,xx,h+.4,z,g);
    if(roof)T.box(w+.7,.15,d+.7,C.white,x,h+.6,z,g);
  }
  function deck(m,x,z,w,d,y){
    T.box(w,.18,d,C.steel,x,y,z,m.root);T.rail(x,z,w,d,y+.12,m.fine);
    for(const xx of [x-w/2+.2,x+w/2-.2])for(const zz of [z-d/2+.2,z+d/2-.2])T.box(.15,y,.15,C.steel,xx,y/2,zz,m.root);
  }
  function stairs(m,x,z,rise,count=12){
    const run=count*.32;for(let i=0;i<count;i++)T.box(1.1,.12,.36,C.steel,x,.5+(i+1)*rise/count,z-i*.32,m.root);
    for(const dx of [-.58,.58]){T.rod([x+dx,.4,z+.25],[x+dx,rise+.5,z-run+.25],.07,C.steel,m.root);T.rod([x+dx,1.45,z+.25],[x+dx,rise+1.45,z-run+.25],.04,C.steel,m.fine);}
  }
  function register(m){m.fine.userData.qualityOnly=true;fine.push(m.fine);models[m.root.userData.deviceKey]=m;return m;}
  function label(key,title,h,subtitle){
    const l=LABELS3D[key],m=T.models[key];if(l){l.anc.set(m.x,h,m.z);l.el.querySelector('.nm').textContent=title;if(subtitle)l.el.querySelector('.pr').textContent=subtitle;}
    const d=DEVICES.find(d=>d.key===key);if(d){d.p=[m.x,Math.min(4,h/2),m.z];d.r=Math.max(4,Math.min(8,h*.6));}
    if(INFO[key])INFO[key].t=title;
  }
  function describe(key,text,from,to,extra=[]){
    const info=INFO[key];info.d=text;info.from=from;info.to=to;
    info.p=info.p.filter(row=>!['展示配置','展示拓扑'].includes(row[0]));info.p.push(...extra);
    info.note='设备数量、结构尺寸为展示配置。'+P.boundaries.production+'；'+P.boundaries.auxiliaries+'。';
  }
  function prepare(toolkit){
    T=toolkit;C=T.C;
    const legacy=scene.getObjectByName('Migrated hydrogen legacy vessels');if(legacy)legacy.visible=false;
    for(const key of ['pem','h2tank','nh3']){
      const old=T.models[key];if(old)scene.remove(old.root);
      const legacy=scene.getObjectByName('Scaled legacy '+key);if(legacy)legacy.visible=false;
      const b=P.bays.find(b=>b.key===key),m=register(T.model(key,b.x,b.z));T.pad(0,0,b.w,b.d,m.root);
    }
    const pem=T.models.pem,g=pem.root;
    for(const x of [-4.3,0,4.3]){
      skid(g,x,0,3.8,4.6);frame(g,x,-.15,3.2,3.6,3.5);
      T.box(2.8,2.5,.16,C.shell,x,1.95,-1.6,g);T.box(2.8,.15,3.2,C.white,x,3.25,0,g);
      for(let i=0;i<11;i++)T.box(.14,1.65,1.55,i%2?C.white:C.steel,x-1.1+i*.22,1.8,0,pem.fine);
      T.box(2.6,1.75,.3,C.shell,x,1.65,1.6,g);T.vent(x,1.3,1.78,2.1,.6,pem.fine);
      vertical(g,x,-2.4,.36,2.1,.7);pipe(g,[[x,2.8,-2.4],[x,3.7,-2.4],[x,3.7,-1.6]],C.blue);
      valve(pem.fine,x,3.7,-2.1);T.box(.35,.22,.06,C.teal,x+.8,2.5,1.78,pem.fine);
    }
    pipe(g,[[-5.5,2.1,-2.5],[-5.5,3.7,-2.5],[4.3,3.7,-2.5]],C.blue,.11);
    label('pem','电解制氢装置',6.4,'电解模块 · 气液分离 · 原容量');
    describe('pem','模块化电解设备与气液分离器，原有直流供电从北侧进入；氢气经南侧支线进入纯化压缩，再送入储氢系统。','既有化工馈线 / 整流直流电源 / 纯水接口','氢气纯化与压缩',[['供水与冷却','沿用现有接口；详细能力待配置']]);
    const h=T.models.h2tank;
    for(const x of [-4,0,4]){vertical(h.root,x,0,1.1,4.3,.95);for(const y of [1.5,3.5,5.1])T.ring(1.12,.055,C.steel,x,y,0,h.fine);pipe(h.root,[[x,4.8,-.8],[x,5.6,-.8],[x,5.6,-2.2],[x,2.5,-2.2]],C.blue);valve(h.fine,x,2.5,-2.2);}
    pipe(h.root,[[-4.8,2.5,-2.2],[5.4,2.5,-2.2]],C.blue,.13);label('h2tank','高压气态储氢',7.5,'既有储氢账本 · 容器组示意');
    describe('h2tank','高压气态储氢容器组连接纯化压缩出口、合成氨供氢及既有燃料电池支线。展示容器数量不对应实际单罐容积。','氢气纯化与压缩','合成氨供氢 / 既有氢燃料电池');
    const n=T.models.nh3;
    frame(n.root,0,0,5.2,5.2,10.2);vertical(n.root,0,0,1.35,8.3,1.55);
    for(const y of [3.1,6.2,9.2]){deck(n,0,0,5.8,5.8,y);for(const x of [-1.6,1.6])T.ring(.23,.045,C.steel,x,y+.4,1.3,n.fine,[0,0,0]);}
    stairs(n,4.1,4.8,3,12);stairs(n,-4.1,1,3,12);
    for(let i=0;i<22;i++)T.box(.55,.055,.09,C.steel,-3.1,3.35+i*.29,-2.6,n.fine);
    for(const x of [-3.4,-2.8])T.box(.06,6.6,.08,C.steel,x,6.3,-2.6,n.root);
    pipe(n.root,[[-1.2,2.9,0],[-1.2,2.9,-1.4],[-1.2,8.5,-1.4]],C.teal,.13);pipe(n.root,[[1.2,7.8,0],[1.2,9.9,0],[0,9.9,0]],C.steel,.13);
    valve(n.fine,-1.2,2.9,0);valve(n.fine,1.2,7.8,0);label('nh3','氨合成工艺区',13.5,'反应 · 换热 · 冷却分离 · 循环返回');
    describe('nh3','合成气经过压缩和换热进入反应器。反应出口经热回收、冷却与气液分离后，氨产品送往储运；未反应气体经循环压缩返回合成回路。','储氢供氢 + 氮气供应净化','换热冷却分离 → 氨产品储运', [['循环返回','分离气 → 循环压缩 → 合成入口'],['展示边界','工艺连接示意；未新增循环量或热平衡计算']]);
  }
  function facility(f,m){
    register(m);const g=m.root;
    if(f.key==='h2purify'){
      skid(g,-3,0,9,8);frame(g,-3,0,9,8,5.4,false);
      for(const x of [-6,-3]){vertical(g,x,0,.85,3.5,.8);for(const y of [1.1,3.9])T.ring(.89,.05,C.steel,x,y,0,m.fine);}
      horizontal(g,0,1.5,1,.55,3.6,'z');pump(g,5.5,1,C.blue);T.box(3.5,1.8,2.3,C.steel,5.2,1.6,-2.4,g);
      for(let i=0;i<7;i++)T.box(.16,1.1,2.4,C.white,3.8+i*.4,1.8,-2.4,m.fine);
      pipe(g,[[0,2.2,4.5],[0,2.2,2],[-6,2.2,2],[-6,4.4,2],[-3,4.4,2],[-3,2.5,-3],[7,2.5,-3]],C.blue,.12);
      for(const x of [-6,-3,3])valve(m.fine,x,2.5,-3);stairs(m,7,3.8,1.2,5);
      describe(f.key,'双列纯化干燥容器、缓冲分离设备与压缩机撬组成可辨识的设备组；接收电解氢并连接储氢。','电解制氢装置','高压气态储氢');
    }else if(f.key==='nitrogen'){
      skid(g,-1,0,12,8);T.box(4.4,2.6,3.8,C.shell,-4.8,1.9,0,g);T.vent(-4.8,1.8,1.95,3.5,1.5,m.fine);
      for(const x of [-.8,1])for(const z of [-1.6,1.6])vertical(g,x,z,.53,3.5,.8);
      vertical(g,5,0,.88,4.6,.8);pipe(g,[[-2,3.9,-2.8],[3,3.9,-2.8],[6,3.9,-2.8],[6,2.6,-2.8]],C.steel,.11);
      for(const x of [-1,1,5])valve(m.fine,x,2.5,2.7);T.box(1.4,2.2,.9,C.shell,-2,1.6,3.1,g);
      describe(f.key,'供氮设备、净化模块与缓冲容器组成独立设备组，连接合成气入口。外形为模块化供氮示意，具体制氮技术和规模待配置。','空气 / 供氮接口','合成气压缩入口',[['工程状态','纯度、压力、技术路线及辅助电耗待确认']]);
    }else if(f.key==='nh3cycle'){
      skid(g,-4,0,8,6);frame(g,-4,0,8,6,4.2,true);
      T.box(3.3,1.6,2.3,C.steel,-4,1.6,0,g);T.shape('cyl',[.72,.72,2.5],C.teal,[-4,1.9,0],g,[0,0,Math.PI/2]);horizontal(g,-1,1.8,0,.6,2,'x');
      deck(m,4.5,-.2,6,6,1.3);horizontal(g,4.3,2.5,-1,.66,4.5,'x');horizontal(g,4.3,4.1,-1,.62,4.5,'x');
      for(const z of [-2.3,.4]){T.box(.17,4,.17,C.steel,3,2.4,z,g);T.box(.17,4,.17,C.steel,6,2.4,z,g);}
      pipe(g,[[-4.5,1.9,1.5],[-4.5,1.9,0],[-2,2.8,0],[3,2.5,-1],[4.3,3,1.5]],C.teal,.13);
      pipe(g,[[-4,2.6,-3],[-4,2.6,0]],C.steel,.12);pipe(g,[[4.3,5.1,1.5],[4.3,4.1,-1],[5.3,3.6,-1]],C.steel,.12);stairs(m,7.5,2.9,1.2,5);
      pipe(g,[[5.5,1.5,3],[5.5,1.5,1.2],[4.3,2.5,-1]],0x288e77,.09);pipe(g,[[4.3,4.1,-1],[6.4,2.2,1.2],[5.5,1.7,2.6]],0xd36b52,.09);
      describe(f.key,'开放式压缩机棚与双层换热平台，承担新鲜合成气压缩、未反应气循环返回和反应进出口换热的结构展示。','储氢供氢 / 氮气供应 / 分离回气','氨合成反应器',[['负荷边界','既有合成氨工段范围；压缩机和换热能力待配置']]);
    }else if(f.key==='nh3cool'){
      skid(g,0,0,15,7);for(const x of [-5,-1]){T.box(3.4,1,3.1,C.steel,x,2.4,-.3,g);T.fan(x,2.98,-.3,1.1,g);for(const dx of [-1.3,1.3])T.box(.13,1.6,.13,C.steel,x+dx,1.2,-.3,g);}
      vertical(g,5,1.5,.86,3.9,.8);T.ring(.91,.045,C.steel,5,3.9,1.5,m.fine);pump(g,5,-2.7);
      pipe(g,[[-5,2.1,0],[-1,2.1,0],[5,2.1,0],[5,1.8,1.5]],C.steel,.12);pipe(g,[[5.5,3.6,1.5],[5,3.6,1.5]],C.steel);valve(m.fine,5,1.8,1.5);
      pump(g,-6,2.7);pipe(g,[[-6,1.5,2.8],[-6,1.5,1],[-5,2.1,1]],0x288e77,.09);pipe(g,[[-1,2.1,1],[-1,1.7,3.2],[-6,1.7,3.2]],0xd36b52,.09);
      describe(f.key,'冷却器、产品冷凝接口、气液分离容器及产品泵组共同构成分离单元。液相去氨储运，气相返回循环压缩。','反应出口换热单元 / 冷却公用工程接口','液相 → 氨储运；气相 → 循环压缩',[['冷却边界','散热形式、制冷能力与热负荷待配置']]);
    }else if(f.key==='ammoniastock'){
      for(const x of [-3.5,3.5]){horizontal(g,x,2.45,-.7,1.3,8,'z');for(const z of [-3,1.5])T.ring(1.33,.055,C.steel,x,2.45,z,m.fine,[0,0,0]);pipe(g,[[x,3.65,-.7],[x,4.3,-.7],[x,4.3,-3.5]],C.steel);valve(m.fine,x,4.3,-3.5);}
      for(const x of [-6,6])pump(g,x,-5,C.teal,.6);
      pipe(g,[[-6,1.3,-5],[-3.5,1.3,-5],[-3.5,2.45,-4.7]],C.steel,.11);pipe(g,[[3.5,2.45,3.3],[5.2,2.45,3.3],[5.2,1.2,3.3],[5.2,1.2,-5],[6,1.2,-5]],C.steel,.11);pipe(g,[[5.45,1.85,-4.4],[6,1.4,-4.4],[6,1.4,5]],C.steel,.11);
      for(const x of [-7.5,7.5])for(const z of [-6.5,6.5])T.cylinder(.12,.9,C.steel,x,.7,z,g);
      describe(f.key,'卧式压力容器外形、鞍座、阀组与产品泵组成氨储运接口。储存方案为展示假设，具体温度、压力、容积及安全设施需据项目条件确定。','氨产品冷却与气液分离','氨产品专用装卸',[['储存形态','压力储存外形示意；不叠加低温罐或常压油罐'],['库存边界','未建立独立氨库存及槽车出库核算']]);
    }else if(f.key==='ammoniaload'){
      T.box(f.w,.08,f.d,C.steel,0,.17,0,g);frame(g,-5,-1,10,11,4.8,true);
      for(const x of [-10,0,11])T.box(.1,.025,12,C.white,x,.23,0,g);
      for(const x of [-8,-3]){const end=x===-8?-6.1:-3.9;T.cylinder(.1,2.6,C.steel,x,1.6,-4,g);pipe(g,[[x,2.9,-4],[end,2.9,-4],[end,2.5,-1]],C.teal,.1);valve(m.fine,x,2.4,-4);}
      T.box(2.8,1.9,1.2,C.white,0,1.3,-5.6,g);T.box(1.5,.6,.08,C.dark,0,1.8,-4.95,g);T.box(1,.3,.1,C.teal,0,1.8,-4.89,m.fine);
      pipe(g,[[0,2.5,-6.6],[-8,2.5,-6.6],[-8,2.5,-4]],C.steel,.12);
      // One parked display tanker, fully inside the loading bay. No dispatch/stock model is implied.
      const truck=T.group(g,'Stationary ammonia loading vehicle');truck.position.set(-5,0,-.2);
      T.box(2.5,.45,8.8,C.dark,0,.95,0,truck);horizontal(truck,0,2.25,-1,.95,5.6,'z');T.box(2.4,1.9,2.2,C.white,0,1.85,3.6,truck);T.box(2.1,.85,.08,C.glass,0,2.2,4.75,truck);
      for(const x of [-1.3,1.3])for(const z of [-3.5,1.2,3.9])T.shape('cyl',[.48,.48,.26],C.dark,[x,.7,z],truck,[0,0,Math.PI/2]);
      for(const x of [-11,11])for(const z of [-6,6])T.cylinder(.13,.9,C.steel,x,.7,z,g);
      for(let z=-4;z<=4;z+=2)T.box(1.5,.025,.12,C.white,10,.24,z,g);
      describe(f.key,'专用槽车停靠位、装卸臂、计量柜、防撞设施及产品接驳管线；车辆保持在作业区内。','氨储运产品泵组','外运槽车接口',[['状态','装卸作业示意；不表示实时出库'],['待配置','装卸能力、气相返回及应急处置方案']]);
    }
    label(f.key,f.name,Math.max(7.2,f.key==='ammoniastock'?7.8:6.8),f.key==='ammoniaload'?'专用槽车 · 计量接驳':f.key==='nh3cycle'?'压缩机棚 · 换热平台':f.key==='ammoniastock'?'压力储存外形 · 泵组接口':'设备组示意 · 参数待配置');
  }
  function complete(){
    const m=register(T.model('chemicalPipeRack',0,0)),g=m.root,r=P.rack;m.x=218;m.z=-185;
    g.userData.deviceKey='nh3';m.fine.userData.qualityOnly=true;
    for(const x of r.posts){
      for(const z of [r.z-r.width/2,r.z+r.width/2]){T.box(.8,.4,.8,C.white,x,.2,z,g);T.box(.22,r.top,.22,C.steel,x,r.top/2,z,g);}
      for(const y of [r.deck,r.top])T.box(.24,.22,r.width+.35,C.steel,x,y,r.z,g);
      for(const y of [6.1,6.5,6.7,7,7.4])T.rod([x,7.8,r.z],[x,y,r.z],.025,C.steel,m.fine);
    }
    for(const z of [r.z-r.width/2,r.z+r.width/2])for(const y of [r.deck,r.top])T.box(r.x1-r.x0,.2,.17,C.steel,(r.x1+r.x0)/2,y,z,g);
    for(const [a,b]of [[150,162],[174,186],[258,270],[270,282]])for(const z of [r.z-r.width/2,r.z+r.width/2]){T.rod([a,.7,z],[b,5.7,z],.055,C.steel,m.fine);T.rod([a,5.7,z],[b,.7,z],.055,C.steel,m.fine);}
    // Cable tray and a reserved service pipe use separate positions on the same structure.
    T.box(r.x1-r.x0,.18,.7,C.dark,(r.x1+r.x0)/2,6.05,-193.35,g);
    for(let x=151;x<286;x+=3)T.box(.07,.06,.7,C.steel,x,6.18,-193.35,m.fine);
    for(const z of [-191,-190.6]){pipe(g,[[150,6.3,z],[286,6.3,z]],z===-191?C.blue:C.teal,.08);for(const x of [150,286])T.shape('cyl',[.14,.14,.055],C.steel,[x,6.3,z],g,[0,0,Math.PI/2]);}
    const colors={nitrogen:C.steel,recycle:C.teal,loading:0x8c78b5,coolSupply:0x288e77,coolReturn:0xd36b52};
    for(const key of ['nitrogen','recycle','loading','coolSupply','coolReturn'])pipe(g,P.paths[key].pts,colors[key],.1);
    for(const [key,path]of Object.entries(P.paths)){
      for(let i=1;i<path.pts.length;i++){
        const a=path.pts[i-1],b=path.pts[i],len=new THREE.Vector3(...a).distanceTo(new THREE.Vector3(...b));if(len<8)continue;
        const pos=new THREE.Vector3(...a).lerp(new THREE.Vector3(...b),.55),dir=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).normalize(),rot=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dir));
        T.shape('cyl',[0,.23,.8],key==='nh3'||key==='loading'?0x8c78b5:key==='nitrogen'?C.steel:C.teal,pos.toArray(),m.fine,rot.toArray().slice(0,3));
      }
      inspection.push({key,...path});
    }
    // Short branch supports stay within process strips and outside the road carriageways.
    for(const [x,z,h]of [[155,-166,2],[166,-166,2],[171,-170,2],[194.2,-181,2.4],[204.4,-179.5,2.4],[256,-184,2.4],[257,-182.5,3.8],[264.5,-182.5,1.2],[286.5,-163,1.3],[276,-160,1.3]]){
      T.box(.5,.2,.5,C.white,x,.1,z,g);T.box(.12,h,.12,C.steel,x,h/2,z,g);T.box(.8,.12,.15,C.steel,x,h,z,g);
    }
    const ground=T.group(scene,'Chemical reserved service and inspection space');
    for(const reserve of P.reserves){
      const w=reserve.x1-reserve.x0,d=reserve.z1-reserve.z0,x=(reserve.x1+reserve.x0)/2,z=(reserve.z1+reserve.z0)/2;
      T.box(w,.035,d,C.shell,x,.045,z,ground);
      for(const zz of [reserve.z0,reserve.z1])T.box(w,.025,.08,C.steel,x,.075,zz,ground);
      if(reserve.key.endsWith('reserve'))for(let xx=reserve.x0+1;xx<reserve.x1;xx+=2)T.box(.06,.02,2,C.white,xx,.08,reserve.z1-1,ground);
    }
    // Keep load-carrying equipment, platforms and the process loop visible in every quality mode.
    for(const m of Object.values(models))m.fine.userData.qualityOnly=true;
    INFO.chemspares.p.push(['预留空间','装置南侧检修通道；公用工程位于北侧独立预留区']);
    INFO.chemfire.p.push(['本轮边界','保留既有消防设施与道路；能力及安全间距待深化']);
  }
  function focus(key){
    if(key==='nh3')return {pos:[268,50,-108],tgt:[218,4,-179]};
    if(key==='h2tank')return {pos:[221,21,-145],tgt:[199,2.7,-174]};
    if(key==='pem')return {pos:[201,22,-143],tgt:[181,2,-174]};
    return null;
  }
  function audit(){return {version:P.version,deviceKeys:['pem','h2tank','nh3',...P.custom],routes:inspection,reserves:P.reserves,rack:P.rack,bays:P.bays,boundaries:P.boundaries,detailGroups:fine.length,detailVisible:fine.filter(g=>g.visible).length,legacyHidden:scene.getObjectByName('Migrated hydrogen legacy vessels')?.visible===false};}
  function selection(key){if(panel)panel.hidden=!['pem','h2tank','nh3',...P.custom].includes(key);}
  function ready(api){
    panel=document.createElement('div');panel.id='chemicalProcessControls';panel.hidden=true;
    panel.innerHTML='<div class="detail-kicker">氢氨工艺观察</div><div class="detail-buttons"><button data-chemical-view="process">工艺全景</button><button data-chemical-view="cycle">合成与循环</button><button data-chemical-view="storage">储运装卸</button></div><small>按设备卡片查看连接与状态。管线箭头表示工艺方向。</small>';
    document.getElementById('detailControls').after(panel);
    const views={process:{pos:[312,112,-40],tgt:[219,3,-176]},cycle:{pos:[252,35,-139],tgt:[222,4,-181]},storage:{pos:[311,27,-135],tgt:[273,2,-169]}};
    panel.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{api.exitTour();api.cancelCamera();const v=views[button.dataset.chemicalView];camera.position.set(...v.pos);controls.target.set(...v.tgt);controls.update();}));
  }
  return {prepare,facility,complete,handles,focus,audit,ready,selection};
})();
