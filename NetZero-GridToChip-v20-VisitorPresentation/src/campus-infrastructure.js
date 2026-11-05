/* v6: independent SMR campus, data-centre standby generation, physical wiring. */
'use strict';
window.NZ_INFRA=(function(){
  let T,api,selected=null,gasRoof,gasFront,mvRoof,mvFront,gasOpen=false,mvOpen=false;
  const routes={},ports={},sites={},physical=[],ducts=[],terminals=[],ductSegments=new Set();
  function setup(t){T=t;}
  function anchor(key,p){const l=LABELS3D[key];if(l)l.anc.set(...p);const d=DEVICES.find(x=>x.key===key);if(d)d.p=p.slice();}
  function label(key,p,title,subtitle){if(LABELS3D[key]){anchor(key,p);LABELS3D[key].el.querySelector('.nm').textContent=title;const pr=LABELS3D[key].el.querySelector('.pr');if(pr)pr.textContent=subtitle;}else addLabel(key,p,title,subtitle,'');}
  function prepare(){
    for(const key of ['smr','genset'])if(T.models[key])scene.remove(T.models[key].root);
    const oldPoles=EDGES.find(e=>e.key==='smr').poles||[];
    for(const o of scene.children.slice()){
      if(!o.isMesh||!o.geometry||o===smrDot||o===gensetDot)continue;const p=o.geometry.parameters;
      const oldSmr=o.position.x>-82&&o.position.x<-60&&o.position.z>84&&o.position.z<96&&o.position.y<9&&['CylinderGeometry','SphereGeometry','BoxGeometry'].includes(o.geometry.type);
      const oldGas=o.position.x>119&&o.position.x<130&&o.position.z>28&&o.position.z<36&&o.position.y<8&&['CylinderGeometry','BoxGeometry'].includes(o.geometry.type);
      const feeder=oldPoles.some(([x,z])=>o.position.x===x&&o.position.z===z)&&((o.geometry.type==='CylinderGeometry'&&p.height===9.6)||(o.geometry.type==='BoxGeometry'&&p.width===2.8&&p.height===.16));
      if(oldSmr||oldGas||feeder)scene.remove(o);
    }
  }
  function hall(g,x,z,w,d,h,name){
    const {group,box,door,vent,fan,C}=T;const shell=group(g,name);shell.position.set(x,0,z);
    box(w,h,d,C.shell,0,h/2+.35,0,shell);box(w+.6,.24,d+.6,C.white,0,h+.48,0,shell);
    for(let xx=-w/2+1;xx<w/2;xx+=3){box(.14,h+.15,.2,C.white,xx,h/2+.4,d/2+.08,shell);box(1.8,.75,.1,C.glass,xx,h-1,d/2+.13,shell);}
    for(let xx=-w/2+1;xx<w/2;xx+=1.5)box(.04,.035,d-.3,C.steel,xx,h+.62,0,shell);
    for(const side of [-1,1]){for(let zz=-d/2+1;zz<d/2;zz+=2.5)box(.14,h,.15,C.white,side*(w/2+.09),h/2+.4,zz,shell);box(.13,.12,d,C.steel,side*(w/2+.1),2.8,0,shell);}
    vent(w*.31,2.2,d/2+.18,Math.min(3,w*.17),1.2,shell);for(let y=.6;y<h+.3;y+=.4)box(.65,.055,.1,C.steel,-w/2+.8,y,-d/2-.16,shell);for(const xx of [-w/2+.48,-w/2+1.12])box(.065,h+.1,.08,C.steel,xx,h/2+.4,-d/2-.16,shell);
    door(0,1.75,d/2+.16,Math.min(4,w/4),2.8,shell);box(5,.14,1.4,C.steel,0,3.4,d/2+.6,shell);
    for(const xx of [-w*.28,w*.28]){box(2,.7,1.8,C.shell,xx,h+.9,-d*.2,shell);fan(xx,h+1.32,-d*.2,.6,shell);vent(xx,h+.9,-d*.2+1,1.6,.45,shell);}
    return shell;
  }
  function transformer(g,x,z,s=1){
    const {group,box,cylinder,rod,ring,door,C}=T;const unit=group(g,'Transformer tank, radiator and bushings');unit.position.set(x,0,z);unit.scale.setScalar(s);
    box(3.2,2.6,2.8,C.shell,0,1.65,0,unit);box(3.6,.25,3.2,C.steel,0,.45,0,unit);box(3.5,.18,3.1,C.white,0,3,0,unit);
    for(const xx of [-2,2])for(let j=0;j<12;j++)box(.7,2.2,.095,C.steel,xx,1.6,-1.2+j*.22,unit);
    for(const xx of [-1,0,1]){cylinder(.13,.95,C.dark,xx,3.45,0,unit);for(let k=0;k<7;k++)cylinder(.25,.09,C.white,xx,3.05+k*.14,0,unit);cylinder(.075,.14,C.copper,xx,3.96,0,unit);}
    T.shape('cyl',[.4,.4,2.8],C.shell,[0,3.6,-1.2],unit,[0,0,Math.PI/2]);rod([1,3,0],[1,3.6,-1.2],.08,C.steel,unit);door(1.5,1.35,1.5,.8,1.2,unit);return unit;
  }
  function switchBay(g,x,z,y=4.5){
    const {box,cylinder,rod,C}=T;
    for(let phase=0;phase<3;phase++){const zz=z+(phase-1)*1.4;
      for(const dx of [-3,0,3]){cylinder(.16,2.1,C.steel,x+dx,1.5,zz,g);for(let n=0;n<8;n++)cylinder(.27,.09,C.white,x+dx,2+n*.17,zz,g);}
      box(1.2,.6,.8,C.steel,x,2.8,zz,g);rod([x-3,3.3,zz],[x,3.3,zz],.075,C.copper,g);rod([x,3.3,zz],[x+3,3.3,zz],.075,C.copper,g);
      cylinder(.13,3,C.dark,x+5,1.9,zz,g);for(let n=0;n<10;n++)cylinder(.23,.09,C.white,x+5,1+n*.24,zz,g);rod([x+3,3.3,zz],[x+5,3.5,zz],.07,C.copper,g);
    }
  }
  function fence(g,w,d,height=2.4,gate=null){const {box,C}=T;
    for(const z of [-d/2,d/2]){const gap=gate&&z===d/2,segments=gap?[[-w/2,gate[0]-gate[1]/2],[gate[0]+gate[1]/2,w/2]]:[[-w/2,w/2]];for(const [a,b]of segments){box(b-a,.09,.09,C.steel,(a+b)/2,height,z,g);box(b-a,.07,.07,C.steel,(a+b)/2,.75,z,g);for(let x=a;x<=b;x+=5)box(.11,height,.11,C.steel,x,height/2,z,g);}}
    for(const x of [-w/2,w/2]){box(.09,.09,d,C.steel,x,height,0,g);box(.07,.07,d,C.steel,x,.75,0,g);for(let z=-d/2;z<=d/2;z+=5)box(.11,height,.11,C.steel,x,height/2,z,g);}
  }
  function nuclear(){
    const {model,group,box,cylinder,rod,ring,fan,pad,door,rail,C}=T;const m=model('smr',280,-355),g=m.root;
    sites.smr={x:280,z:-355,w:106,d:74};pad(0,0,106,74,g);fence(g,104,72,2.4,[24,12]);
    // Architectural representation; no reactor core or safety-system design is inferred.
    const island=hall(g,-26,-6,24,22,9.6,'SMR nuclear island building');
    cylinder(6.2,6.2,C.shell,0,12.8,0,island);
    const dome=new THREE.Mesh(new THREE.SphereGeometry(6.2,28,16,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:C.white,roughness:.72,metalness:.08}));dome.position.set(0,15.9,0);dome.scale.y=.7;dome.castShadow=true;island.add(dome);
    for(let y=10.3;y<15.8;y+=1.7)ring(6.25,.045,C.steel,0,y,0,island);
    const turbine=hall(g,3,-7,25,18,7.2,'SMR turbine-generator hall');
    for(let n=0;n<9;n++)box(2.15,.12,1.9,C.glass,-10+n*2.5,7.88,-3,turbine);
    hall(g,-30,24,13,7,4.4,'SMR control and administration building');hall(g,-7,25,14,7,4.2,'SMR water treatment and auxiliary building');hall(g,35,25,12,7,4.2,'SMR electrical and maintenance building');
    // Closed-loop cooling banks and service pumps, visibly connected to turbine hall.
    for(let row=0;row<2;row++)for(let col=0;col<3;col++){const x=24+col*7,z=-20+row*13;box(5.8,3.3,8,C.shell,x,2,z,g);for(const dz of [-2.2,2.2])fan(x,3.8,z+dz,1.6,g);for(let j=0;j<10;j++)box(.055,2.4,7.5,C.steel,x-2.6+j*.57,1.8,z,g);pad(x,z,6.5,8.7,g);}
    for(const z of [-19,-6]){rod([16,1.6,z],[44,1.6,z],.17,C.blue,g);rod([16,2,z],[44,2,z],.17,C.teal,g);}
    for(const [y,col]of [[1.6,C.blue],[2,C.teal]]){rod([15.5,y,-12],[16,y,-19],.17,col,g);rod([15.5,y,-6],[16,y,-6],.17,col,g);rod([-7,y,21.5],[-7,y,19],.12,col,g);rod([-7,y,19],[16,y,19],.12,col,g);rod([16,y,19],[16,y,-6],.12,col,g);}
    for(const x of [-9,19]){cylinder(.8,2.6,C.shell,x,1.8,23,g);ring(.85,.08,C.steel,x,3.2,23,g);}
    // Process bridge ends at the two building facades, never floating between them.
    rod([-14,6,-7],[-9.5,6,-7],.22,C.steel,g);rod([-14,5.4,-6],[-9.5,5.4,-6],.16,C.teal,g);
    for(const x of [-13.5,-10]){box(.15,5.5,.15,C.steel,x,3,-6.5,g);box(1.3,.15,1.8,C.steel,x,5.8,-6.5,g);}
    pad(15,12,29,16,g);transformer(g,4,12,1.15);switchBay(g,16,9);switchBay(g,16,15);
    rod([3,1.1,2],[4,1.1,12],.2,C.copper,g);
    pad(4,12,7,6,g);for(const x of [.4,7.6])box(.16,3.4,6,C.white,x,2.05,12,g);
    for(const bay of [9,15])for(let phase=0;phase<3;phase++){const z=bay+(phase-1)*1.4;rod([4+(phase-1)*1.15,4.55,12],[13,3.3,z],.075,C.copper,g);rod([21,3.5,z],[27,7,12+(phase-1)*.7],.075,C.copper,g);}
    for(const z of [8,16]){box(.2,7,.2,C.steel,27,3.5,z,g);}box(.2,.2,9,C.steel,27,7,12,g);
    // Internal streets, entrance, steps and site sign.
    for(const z of [4,31])box(96,.025,4,0xd2ddd7,0,.365,z,g);box(4,.025,63,0xd2ddd7,-46,.365,0,g);box(4,.025,63,0xd2ddd7,47,.365,0,g);
    box(7,2.6,3.5,C.shell,37,1.65,35,g);door(37,1.6,36.8,1.3,2.4,g);box(11,.08,.1,C.teal,24,1.9,36,g);box(9,1.2,.18,C.white,22,3,36,g);
    for(let x=-42;x<=40;x+=8){cylinder(.05,4,C.steel,x,2,32,g);box(.6,.13,.25,C.white,x,4,32,g);}
    g.add(smrDot);smrDot.position.set(-26,21,-6);
    ports.smr=[307,7,-343];label('smr',[280,24,-355],'独立 SMR 核电园区','30 MWe · 核岛 / 汽轮机 / 冷却 / 升压 · 研究情景');
    INFO.smr.d='独立布置于片区东北侧，与化工分区保留示意隔离空间，包含核岛建筑、汽轮发电厂房、冷却设备、控制及水处理建筑和站内升压出线区。站内出线接园区高压母线，空间上与风光场分开。';INFO.smr.to='站内升压出线 → 220 kV 高压母线 → 数据楼 / 园区负荷';INFO.smr.p.push(['园区展示占地','106 × 74 场景单位'],['核岛建筑','24 × 22；最高约 20.3 场景单位']);INFO.smr.note+=' 外观与站区为通用概念模型，不对应指定反应堆型号或经审批的选址设计。';
  }
  function machineCylinder(g,x,y,z,r,length,col){T.shape('cyl',[r,r,length],col,[x,y,z],g,[0,0,Math.PI/2]);}
  function flange(g,x,y,z,r,boltCount=12){const {ring,shape,C}=T;
    ring(r,.075,C.steel,x,y,z,g,[0,Math.PI/2,0]);
    for(let n=0;n<boltCount;n++){const a=n*Math.PI*2/boltCount;shape('cyl',[.055,.055,.10],C.dark,[x+.04,y+(r-.08)*Math.cos(a),z+(r-.08)*Math.sin(a)],g,[0,0,Math.PI/2]);}
  }
  function nameplate(g,text,x,y,z,w=2.3){const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#355951';ctx.fillRect(0,0,512,128);ctx.fillStyle='#edf3ef';ctx.font='500 46px Segoe UI';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,64);const tex=new THREE.CanvasTexture(c);tex.encoding=THREE.sRGBEncoding;
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,w/4),new THREE.MeshBasicMaterial({map:tex}));mesh.position.set(x,y,z);mesh.name='Equipment plate '+text;g.add(mesh);
  }
  function valve(g,x,y,z){const {box,rod,ring,cylinder,C}=T;box(.42,.3,.34,C.steel,x,y,z,g);rod([x,y,z],[x,y+.55,z],.045,C.steel,g);ring(.24,.035,C.red,x,y+.57,z,g);cylinder(.055,.07,C.steel,x,y+.57,z,g);for(let n=0;n<3;n++){const a=n*Math.PI*2/3;rod([x,y+.6,z],[x+.2*Math.cos(a),y+.6,z+.2*Math.sin(a)],.022,C.steel,g);}}
  function standby(){
    const {model,group,box,cylinder,rod,ring,pad,door,vent,fan,C}=T;const m=model('genset',184,-8),g=m.root,f=m.fine;
    sites.genset={x:184,z:-8,w:46,d:26};pad(0,0,46,26,g);fence(g,45,25,1.8,[-17,6]);
    const body=group(g,'Gas turbine acoustic enclosure');gasRoof=group(body,'Removable gas turbine enclosure roof');gasFront=group(body,'Removable gas turbine enclosure front');
    box(22,5.7,.18,C.shell,-2,3.25,-5.5,body);for(const x of [-13,9])box(.18,5.7,11,C.shell,x,3.25,0,body);
    box(22,5.7,.18,C.shell,-2,3.25,5.5,gasFront);box(22.5,.24,11.5,C.white,-2,6.22,0,gasRoof);
    for(let x=-12.5;x<9;x+=1.05){box(.035,5.6,.04,C.steel,x,3.25,5.62,gasFront);box(.035,5.6,.04,C.steel,x,3.25,-5.61,body);box(.035,.03,11.25,C.steel,x,6.36,0,gasRoof);}
    for(const x of [-8,-2,4]){door(x,2.3,5.68,3.3,3.8,gasFront);box(.8,.55,.10,C.glass,x,3.35,5.8,gasFront);for(const y of [1.25,2.3,3.35])box(.10,.24,.16,C.steel,x-1.55,y,5.8,gasFront);vent(x,1.15,5.84,2.8,.5,gasFront);}
    for(const x of [-10,-5,0,5]){box(.12,5.9,.16,C.white,x,3.3,5.4,body);box(.15,.2,11,C.steel,x,6.1,0,body);}
    for(const x of [-7,3]){box(2.6,.45,2.6,C.shell,x,6.52,0,gasRoof);fan(x,6.81,0,.8,gasRoof);}
    nameplate(gasFront,'GT-01 / STANDBY',-2,4.95,5.73,3.7);
    // Bedplate, mounting feet and the independent turbine-generator machine train.
    box(21.2,.38,7.4,C.steel,-2,.64,0,g);for(let x=-11.5;x<8;x+=2.2){box(.35,.35,7.1,C.dark,x,.43,0,f);for(const z of [-3.2,3.2])cylinder(.10,.16,C.dark,x,.92,z,f);}
    for(const x of [-9,-6,-3,.4,2.8,5.7]){box(.95,1.0,2.3,C.steel,x,1.32,0,g);box(1.25,.16,2.7,C.white,x,.91,0,g);for(const z of [-1.08,1.08])cylinder(.10,.14,C.dark,x,1.93,z,f);}
    const compressor=group(g,'Refined compressor casing'),combustor=group(g,'Refined combustion casing'),turbine=group(g,'Refined turbine casing'),generator=group(g,'Refined generator and coupling');
    machineCylinder(compressor,-7,2.6,0,1.42,4.8,C.shell);for(const x of [-9.4,-8.1,-6.7,-5.45])flange(f,x,2.6,0,1.48,16);
    for(let n=0;n<8;n++){const a=n*Math.PI*2/8;rod([-9.25,2.6+1.42*Math.cos(a),1.42*Math.sin(a)],[-4.75,2.6+1.42*Math.cos(a),1.42*Math.sin(a)],.06,C.steel,f);}
    box(4.8,.12,.35,C.steel,-7,3.99,0,f);for(let x=-9;x<=-5;x+=.5){box(.08,.12,.18,C.dark,x,4.1,0,f);}
    machineCylinder(combustor,-3.2,2.6,0,1.35,2.6,C.shell);flange(f,-4.55,2.6,0,1.43,16);flange(f,-1.85,2.6,0,1.43,16);
    for(let n=0;n<6;n++){const a=n*Math.PI*2/6;const y=2.6+1.23*Math.cos(a),z=1.23*Math.sin(a);machineCylinder(f,-3.2,y,z,.27,1.65,C.steel);flange(f,-2.28,y,z,.3,6);rod([-3.2,y,z],[-3.2,2.6+1.72*Math.cos(a),1.72*Math.sin(a)],.045,C.copper,f);}
    ring(1.74,.055,C.copper,-3.2,2.6,0,f,[0,Math.PI/2,0]);
    machineCylinder(turbine,-.8,2.6,0,1.25,1.9,C.steel);for(const x of [-1.8,-.8,.15])flange(f,x,2.6,0,1.31,16);
    machineCylinder(generator,4.3,2.6,0,1.4,4.8,C.shell);for(const x of [1.9,3.1,5.5,6.7])flange(f,x,2.6,0,1.45,16);
    for(let n=0;n<10;n++){const a=n*Math.PI*2/10;rod([2,2.6+1.41*Math.cos(a),1.41*Math.sin(a)],[6.6,2.6+1.41*Math.cos(a),1.41*Math.sin(a)],.065,C.steel,f);}
    machineCylinder(generator,1.1,2.6,0,.38,1.3,C.dark);for(const x of [.55,1.3,1.7])flange(f,x,2.6,0,.48,8);box(1.6,.15,1.5,C.shell,1.1,3.28,0,g);for(const z of [-.7,.7])box(1.6,.8,.1,C.shell,1.1,2.91,z,g);
    box(2.2,.75,1.6,C.steel,4.3,4.18,0,g);box(2.35,.12,1.72,C.white,4.3,4.62,0,g);for(const x of [3.7,4.3,4.9]){rod([x,4.2,.85],[x,1.05,2.3],.075,C.dark,f);}
    nameplate(f,'COMPRESSOR',-7,2.9,1.45,2.6);nameplate(f,'GAS TURBINE',-2.5,2.9,1.75,2.5);nameplate(f,'GEN-01',4.3,2.9,1.44,1.9);
    // Lubrication skid, filters, pumps, control instruments and connected service pipes.
    const lube=group(g,'Lubrication skid and connected auxiliary pipes');box(4.8,1.1,1.9,C.shell,-7,1.35,-3.5,lube);box(5.2,.15,2.2,C.steel,-7,.77,-3.5,lube);
    for(const x of [-8.6,-7.3,-6]){cylinder(.28,1.2,C.white,x,2.55,-3.6,lube);ring(.3,.05,C.steel,x,3.15,-3.6,f);valve(f,x,2.65,-2.65);rod([x,2.65,-3.6],[x,2.65,-2.65],.06,C.teal,lube);}
    for(const x of [-8.4,-6.1]){machineCylinder(lube,x,1.2,-2.9,.25,.8,C.steel);machineCylinder(lube,x+.6,1.2,-2.9,.24,.5,C.dark);box(1.55,.16,.8,C.steel,x+.2,.97,-2.9,lube);}
    for(const z of [-2.45,-2.7]){rod([-9,1.45,z],[6,1.45,z],.055,C.teal,lube);for(const x of [-8.8,-.4,5.8])rod([x,1.45,z],[x,2.25,-1.1],.045,C.teal,lube);}
    for(const x of [-8,-.5,5.5]){box(.35,.55,.25,C.white,x,3.9,.8,f);cylinder(.13,.07,C.dark,x,4.23,.8,f);rod([x,3.9,.8],[x,3.4,.8],.025,C.dark,f);}
    nameplate(lube,'LUBE OIL',-7,1.6,-2.52,2.4);
    // Clear inspection walkway and removable enclosure remain independent of fine detail.
    box(20,.14,1.6,C.steel,-2,.97,3.5,g);for(let x=-11.5;x<8;x+=.28)box(.035,.025,1.52,C.dark,x,1.055,3.5,f);
    for(const x of [-11.7,7.5]){for(const yy of [1.7,2.15])box(.07,.07,1.6,C.steel,x,yy,3.5,f);for(const z of [2.75,4.25])box(.065,1.2,.065,C.steel,x,1.6,z,f);}
    for(let n=0;n<4;n++)box(2.1,.20,.36,C.steel,-10,.42+n*.16,5.1-n*.32,g);
    // Air filter structure, maintenance platform, bracing and flanged elbow.
    const intake=group(g,'Refined air intake filter house and duct');box(7,4.2,5,C.shell,-16,6,-1,intake);
    for(const x of [-18.9,-13.1]){box(.2,7.6,.2,C.steel,x,4,-2,intake);rod([x,.7,-2],[x,3.7,1.7],.08,C.steel,intake);}
    for(let n=0;n<8;n++){const x=-18.9+n*.83;vent(x,6,1.7,.58,3.2,f);box(.045,3.8,.12,C.white,x-.38,6,1.8,f);}
    for(const yy of [4.12,7.9])box(7.15,.12,.15,C.white,-16,yy,1.72,intake);
    box(8,.18,6.3,C.steel,-16,3.72,-.5,intake);T.rail(-16,-.5,8,6.3,3.75,f);nameplate(intake,'AIR INTAKE',-16,7.2,1.81,3);
    for(const x of [-20.1,-19.55])box(.06,4,.08,C.steel,x,2.1,2.6,f);for(let y=.5;y<4.1;y+=.32)box(.62,.055,.08,C.steel,-19.82,y,2.6,f);
    box(4.8,2.3,2.8,C.shell,-11.7,5,-1,intake);box(2.2,2.6,2.2,C.shell,-10.1,3.4,-1,intake);
    for(const x of [-13.8,-11.5,-9.55]){box(.12,2.6,3.15,C.steel,x,5,-1,f);box(.14,2.35,2.9,C.shell,x+.08,5,-1,f);for(const z of [-2.35,.35])for(const y of [4,5,6])machineCylinder(f,x+.15,y,z,.045,.10,C.dark);}
    // Exhaust path is separate from the generator electrical connection.
    const exhaust=group(g,'Refined exhaust duct silencer and stack');box(1.7,1.7,6.6,C.shell,-.8,3.1,-3.3,exhaust);box(12.8,1.7,1.7,C.shell,5.6,3.1,-6.5,exhaust);box(1.7,1.7,4.6,C.shell,12,3.1,-4.2,exhaust);
    for(let x=0;x<=12;x+=2.4){box(.12,1.95,1.95,C.steel,x,3.1,-6.5,f);box(.14,1.7,1.7,C.shell,x+.09,3.1,-6.5,f);box(.12,2.4,.12,C.steel,x,1.5,-6.5,exhaust);}
    box(4,4,4,C.shell,12,3,-2,exhaust);for(let x=10.3;x<=13.7;x+=.85)box(.06,3.9,.1,C.steel,x,3,.06,f);nameplate(exhaust,'EXHAUST',12,4.2,.09,2.7);
    cylinder(1,12,C.white,13,9,-2,exhaust);for(const y of [4,7,10,13,14.8])ring(1.035,.055,C.steel,13,y,-2,f);ring(1.1,.065,C.dark,13,15,-2,exhaust);T.rail(13,-2,3.4,3.4,12.8,f);
    for(const x of [14.3,14.9])box(.06,13.1,.08,C.steel,x,7,-2,f);for(let y=.65;y<13.6;y+=.36)box(.66,.06,.09,C.steel,14.6,y,-2,f);
    for(let y=4;y<=12;y+=2)ring(.6,.04,C.steel,14.6,y,-2,f);for(const x of [11.3,14.7]){box(.16,6,.16,C.steel,x,3.35,-2,exhaust);rod([x,.65,-2],[13,5.8,-2],.07,C.steel,f);}
    // External control building, fuel skid, cooler bank and compact switchgear.
    hall(g,-10,9,10,5,3.9,'Standby control building');for(let n=0;n<5;n++){const x=-13+n*1.2;box(1.05,2.5,.9,C.shell,x,1.6,8.8,g);door(x,1.6,9.3,.95,2.25,f);box(.38,.25,.08,C.dark,x,2.25,9.45,f);box(.3,.18,.03,C.teal,x,2.25,9.50,f);for(let j=0;j<3;j++)cylinder(.055,.06,j===0?C.red:C.teal,x-.22+j*.22,1.95,9.45,f);}
    const fuel=group(g,'Fuel conditioning skid with valves and instruments');pad(19,-8,5,5,fuel);
    for(const x of [18,20]){cylinder(.5,1.9,C.shell,x,1.5,-8,fuel);ring(.54,.07,C.steel,x,2.5,-8,f);for(let n=0;n<8;n++){const a=n*Math.PI/4;cylinder(.055,.08,C.dark,x+.44*Math.cos(a),2.57,-8+.44*Math.sin(a),f);}rod([x,2.5,-8],[x,2.5,-5],.075,C.copper,fuel);valve(f,x,2.5,-6.5);}
    rod([20,2.5,-5],[-3.2,2.5,-5],.075,C.copper,fuel);rod([-3.2,2.5,-5],[-3.2,2.5,-1.72],.075,C.copper,fuel);for(const x of [18.2,19.8]){box(.25,.65,.25,C.white,x,3.1,-7,f);rod([x,2.5,-7],[x,2.8,-7],.035,C.steel,f);}
    box(4.6,.45,2.6,C.steel,19,.65,-8,fuel);nameplate(fuel,'FUEL GAS',19,1.05,-6.59,2.8);
    for(let n=0;n<3;n++){const z=-1+n*3;box(2,1.2,2.2,C.shell,18,1.3,z,g);fan(18,1.96,z,.6,f);vent(18,1.3,z+1.17,1.65,.75,f);rod([17,1,z],[16.5,1,z],.06,C.teal,f);}
    transformer(g,5,8.6,.92);switchBay(g,15,8.5);
    for(let phase=0;phase<3;phase++){const z=8.5+(phase-1)*1.4,x=5+(phase-1)*.92;
      rod([x,3.65,8.6],[9.2,3.65,8.6],.075,C.copper,g);rod([9.2,3.65,8.6],[9.2,3.65,z],.075,C.copper,g);rod([9.2,3.65,z],[9.2,3.3,z],.075,C.copper,g);rod([9.2,3.3,z],[12,3.3,z],.075,C.copper,g);
      rod([20,3.5,z],[20,.65,z],.085,C.dark,g);
    }
    for(const z of [8.5-1.4,8.5,8.5+1.4])box(.2,.25,.3,C.steel,20,1.9,z,f);
    box(2,.4,4,C.shell,20,.55,8.5,g);duct('Gas generator output',[[4.3,.84,2.3],[7.5,.84,2.3],[7.5,.84,8.6],[5,.84,8.6]],.7,g);
    rod([4.3,4.2,.85],[4.3,.55,2.3],.12,C.dark,g);
    g.add(gensetDot);gensetDot.position.set(-2,7,0);ports.genset=[204,.84,.5];
    label('genset',[184,17,-8],'数据中心备用燃气轮机','50 MW · 机组 / 发电机 / 进排气 / 辅助系统 / 专用馈线');
    INFO.genset.media='power';INFO.genset.d='数据楼备用电源站。机组展示压气机壳体、燃烧与透平段、联轴器及发电机，补充法兰螺栓、支座、润滑过滤与泵组、燃气调压阀组、进排气风道及检修平台。电力经配套变压器和专用电缆通道接入数据楼配电房。';
    INFO.genset.to='发电机 / 开关配电 → 数据楼 A/B 中压配电 → 关键负荷';INFO.genset.p.push(['观察方式','可打开罩壳；压气机 → 燃机 → 联轴器 → 发电机'],['辅助系统','进气 / 排气 / 润滑 / 燃气 / 控制 / 冷却'],['供电范围','50 MW 备用配置；参数沿用原模型']);
  }
  function distribution(){const {box,cylinder,rod,pad,C}=T;const m=T.models.disttr;m.root.scale.setScalar(1.4);pad(0,0,10.7,21.5,m.root);
    for(const z of [-5.5,5.5])transformer(m.root,0,z,1);fence(m.root,10.4,21.2,1.2);anchor('disttr',[78,7.2,22]);INFO.disttr.d='三台代表性配电变压器经高压支路接园区母线，经中压开关区向 35 kV 柔性消纳母线供电。';
    for(let n=0;n<8;n++){box(1,2.3,.9,C.shell,-3.6+n*1.05,1.6,9.2,m.root);T.door(-3.6+n*1.05,1.6,9.75,.93,2.2,m.root);}
    INFO.stepdown.d='数据楼降压区以三台代表设备展示 2 用 1 备的空间关系。高压侧接 220 kV 母线，中压侧接独立配电房，经 A / B 两条馈线进入数据楼。';INFO.stepdown.note+=' 图面 3 台为代表性 2 用 1 备布局；运行容量沿用原模型。';
  }
  function mediumVoltage(){
    const {model,group,box,pad,door,vent,fan,C}=T;const m=model('dcfeed',110,-10),g=m.root;sites.dcfeed={x:110,z:-10,w:12,d:19};pad(0,0,12.6,20,g);
    mvRoof=group(g,'MV room removable roof');mvFront=group(g,'MV room removable front');box(12,4.8,.18,C.shell,0,2.75,-9.5,g);for(const x of [-6,6])box(.18,4.8,19,C.shell,x,2.75,0,g);box(12.4,.22,19.4,C.white,0,5.3,0,mvRoof);box(12,4.8,.18,C.shell,0,2.75,9.5,mvFront);door(0,1.9,9.66,2,3,mvFront);
    for(let side=0;side<2;side++)for(let n=0;n<6;n++){const x=-3.5+side*7,z=-7+n*2.8;box(2,2.8,2,C.shell,x,1.8,z,g);door(x,1.8,z+1.08,1.86,2.6,g);vent(x,1,z+1.19,1.55,.5,m.fine);box(.25,.2,.08,C.teal,x,2.5,z+1.25,m.fine);}
    for(const z of [-5,5]){box(9,.15,.3,C.copper,0,3.5,z,g);for(const x of [-3.5,3.5])box(.2,1.5,.2,C.copper,x,2.7,z,g);}
    for(const z of [-5,5]){box(8,.4,1.6,C.shell,0,5.63,z,mvRoof);fan(0,5.9,z,.65,mvRoof);}
    ports.normalA=[104,1.15,-15];ports.normalB=[104,1.15,-5];ports.roomGas=[116,1.15,-9];ports.dcA=[119,1.15,-15];ports.dcB=[119,1.15,-5];
    INFO.dcfeed={t:'数据楼 A/B 中压配电',media:'power',d:'独立中压配电房连接常用降压变和备用燃气电源，经 A/B 代表馈线接入 A1 数据楼。柜体在房内；可打开配电房查看开关与母线。',p:[['用途','常用 / 备用电源接入与 A/B 馈电'],['展示设备','两组开关柜与汇流母排'],['电压口径','10.5 kV 中压（沿用模型）']],from:'数据楼降压区 / 备用燃气轮机',to:'A1 数据楼中压受电 → 楼内供电系统',note:'连线展示供电拓扑；A/B 分流为展示分配，不代表已完成电气保护整定。'};
    label('dcfeed',[110,7,-10],'数据楼 A/B 中压配电','常用降压 / 燃机备用 → A1');
  }
  function physicalWire(key,pts,offsets=[0],color,phasePaths){
    if(key==='trans'){physical.push({key,pts:pts.map(p=>p.slice()),phaseCount:3,phasePaths:window.NZ_TOWERS.data.phasePaths});return window.NZ_TOWERS.wires();}
    const g=T.group(scene,'Physical connection '+key);g.userData.deviceKey=key==='smr'?'smr':key==='genset'?'genset':key==='bus2dist'?'disttr':'stepdown';const c=color||T.C.copper;
    const paths=phasePaths||offsets.map(dz=>pts.map(p=>[p[0],p[1],p[2]+dz]));
    for(const path of paths)for(let i=1;i<path.length;i++)T.rod(path[i-1],path[i],.08,c,g);physical.push({key,pts:pts.map(p=>p.slice()),phaseCount:paths.length,...(phasePaths?{phasePaths}:{} )});return g;
  }
  function duct(key,pts,width=1.1,g){
    g=g||T.models.powerConnections.root;const {box,C}=T;
    for(let n=1;n<pts.length;n++){const a=pts[n-1],b=pts[n],dx=Math.abs(b[0]-a[0]),dz=Math.abs(b[2]-a[2]);
      if(dx>.001&&dz>.001)throw Error('Cable corridor must use orthogonal bends: '+key);
      if(dx+dz<.001)continue;const seg=[a[0]+','+a[2],b[0]+','+b[2]].sort().join('|');if(ductSegments.has(seg))continue;ductSegments.add(seg);const x=(a[0]+b[0])/2,z=(a[2]+b[2])/2;
      box(dx||width,.32,dz||width,C.steel,x,.48,z,g);box(dx||width+.08,.10,dz||width+.08,C.white,x,.69,z,g);
      for(let d=2.5;d<dx+dz;d+=2.5)box(dx?.025:width,.015,dx?width:.025,C.steel,a[0]+Math.sign(b[0]-a[0])*d,.752,a[2]+Math.sign(b[2]-a[2])*d,g);
    }ducts.push({key,pts:pts.map(p=>p.slice()),width});
  }
  function primaryTerminal(key,x,z,height,spacing,g){const {rod,box,C}=T;
    box(spacing*2+1.2,.5,1.4,C.shell,x,.55,z-3,g);
    for(let phase=0;phase<3;phase++){const xx=x+(phase-1)*spacing;
      rod([xx,.65,z-3],[xx,height,z-3],.10,C.dark,g);rod([xx,height,z-3],[xx,height,z],.085,C.dark,g);
      box(.2,.18,.4,C.steel,xx,height-1.15,z-3,g);box(.15,height-1,.15,C.steel,xx,.6+(height-1)/2,z-3.2,g);
      terminals.push({key,phase,end:[xx,height,z]});
    }
  }
  function powerConnections(){
    const {rod,box,C}=T;const conn=T.model('powerConnections',0,0).root;conn.userData.deviceKey='bus';
    // High voltage, secondary circuits and compensation each have their own corridor.
    // Long conductors run inside covered ducts; only the short device terminations are exposed.
    const hvData=[[78,.84,-11],[86,.84,-11]],hvIndustrial=[[78,.84,-11],[72,.84,-11],[72,.84,34.9]];
    duct('HV common junction',[[72,.84,-11],[86,.84,-11]],1.3);
    duct('HV data spine',[[86,.84,-21.25],[86,.84,-4.75]],1.2);
    duct('HV industrial spine',[[72,.84,-11],[72,.84,34.9]],1.2);
    box(5.8,.65,2.2,C.shell,78,.55,-10.7,conn);
    for(let phase=0;phase<3;phase++){const x=78+(phase-1)*2.2,z=-11+(phase-1)*.2;
      rod([x,8.6,-10],[x,.55,-10],.09,C.dark,conn);rod([x,.55,-10],[x,.55,z],.09,C.dark,conn);rod([x,.55,z],[78,.55,z],.09,C.dark,conn);
    }
    for(const z of [-18.25,-10,-1.75]){
      const pts=[[86,.84,z-3],[92,.84,z-3]];duct('HV data branch '+z,pts,.9);
      physicalWire('dataPrimary'+z,pts.map(p=>[p[0],.54,p[2]]),[-.18,0,.18],C.dark);primaryTerminal('dataPrimary'+z,92,z,5.3,1.425,conn);
    }
    for(const z of [14.3,22,29.7]){
      const pts=[[72,.84,z-3],[78,.84,z-3]];duct('HV industrial branch '+z,pts,.9);
      physicalWire('industrialPrimary'+z,pts.map(p=>[p[0],.54,p[2]]),[-.18,0,.18],C.dark);primaryTerminal('industrialPrimary'+z,78,z,z===22?5.3:5.64,z===22?1.33:1.4,conn);
    }
    physicalWire('HV data spine',[[78,.54,-11],[86,.54,-11],[86,.54,-21.25]],[-.18,0,.18],C.dark);
    physicalWire('HV industrial spine',hvIndustrial.map(p=>[p[0],.54,p[2]]),[-.18,0,.18],C.dark);
    // Low-voltage sides leave the opposite side of the transformer banks.
    duct('MV industrial spine',[[84,.84,14.3],[84,.84,34.9],[78,.84,34.9]],1.1);
    for(const z of [14.3,22,29.7]){
      rod([81,2.5,z],[81,.54,z],.13,C.dark,conn);duct('MV industrial branch '+z,[[81,.84,z],[84,.84,z]],.8);
      physicalWire('industrialSecondary'+z,[[81,.54,z],[84,.54,z],[84,.54,34.9],[78,.54,34.9]],[-.18,0,.18],C.dark);
    }
    const feed=[[78,.84,34.9],[78,.84,37],[78,.84,52]];duct('Industrial feeder',feed,1.1);physicalWire('industrialFeed',feed.map(p=>[p[0],.54,p[2]]),[-.18,0,.18],C.dark);
    const svgRoute=[[78,.84,37],[97,.84,37],[97,.84,30],[99.6,.84,30]];
    duct('SVG/APF parallel branch',svgRoute,.75);physicalWire('svgShunt',svgRoute.map(p=>[p[0],.54,p[2]]),[-.15,0,.15],C.dark);routes.svgShunt=svgRoute;
    INFO.svgapf.d+=' SVG/APF 经独立沟道支路并联接入工业中压母线，设备与负荷不串联。';
    label('svgapf',[102,5.4,30],'SVG / APF 并联补偿','工业中压母线 → 并联治理支路');
    duct('MV data spine',[[100,.84,-18.25],[100,.84,-1.75]],1.1);
    for(const z of [-18.25,-10,-1.75]){const target=z<-8?-15:-5;
      rod([95,2.5,z],[95,.54,z],.13,C.dark,conn);duct('MV data branch '+z,[[95,.84,z],[100,.84,z]],.8);
      duct('MV data entry '+target,[[100,.84,target],[104,.84,target]],.9);
      physicalWire('tr2dc'+z,[[95,.54,z],[100,.54,z],[100,.54,target],[104,.54,target]],[-.18,0,.18],C.dark);
    }
    ports.normalA=[104,.84,-15];ports.normalB=[104,.84,-5];ports.roomGas=[116,.84,-9];ports.dcA=[119,.84,-15];ports.dcB=[119,.84,-5];ports.genset=[204,.84,.5];
    for(const [key,z]of [['dcA',-15],['dcB',-5]]){const pts=[[116,.84,z],[119,.84,z]];duct(key,pts,.8);physicalWire(key,pts.map(p=>[p[0],.54,p[2]]),[-.15,0,.15],C.dark);}
    const gasRoute=[ports.genset,[211,.84,.5],[211,.84,13],[115.5,.84,13],[115.5,.84,-9],ports.roomGas];
    duct('Standby dedicated feeder',gasRoute,.9);physicalWire('genset',gasRoute.map(p=>[p[0],.54,p[2]]),[-.18,0,.18],C.dark);
    const nuclearRoute=[ports.smr,[346,10,-343],[346,10,-290],[84,10,-290],[84,10,-58],[78,8.6,-10]];
    physicalWire('smr',nuclearRoute,[-.7,0,.7],0x8197b3);
    for(let phase=0;phase<3;phase++)rod([78,8.6,-10+(phase-1)*.7],[78+(phase-1)*2.2,8.6,-10],.08,0x8197b3,conn);
    const exportPlan=window.NZ_MULTI_PLAN.renewableExport,renewableRoute=exportPlan.path;
    physicalWire('trans',renewableRoute,[-.7,0,.7],C.copper,exportPlan.phasePaths);
    for(let phase=0;phase<3;phase++){const d=(phase-1)*.7,ctZ=-19.2+(phase-1)*1.45;if(d)rod([56,3.45,ctZ],[56+d,3.45,ctZ],.08,C.copper,conn);rod([56+d,3.45,ctZ],[56+d,6,ctZ],.08,C.copper,conn);rod([56+d,6,ctZ],[56+d,6,-18],.08,C.copper,conn);if(d)rod([78+d,8.6,-10],[78+(phase-1)*2.2,8.6,-10],.08,C.copper,conn);}
    for(const [x,y,z]of nuclearRoute.slice(1,-1)){for(const dx of [-1.3,1.3])box(.17,y,.17,C.steel,x+dx,y/2,z,conn);box(3.8,.2,.2,C.steel,x,y,z,conn);}
    ports.bus=[78,.84,-11];routes.genset=gasRoute;routes.smr=nuclearRoute;
    routes.bus2tr=[[78,8.6,-10],[78,.84,-10],[78,.84,-11],[86,.84,-11]];
    routes.bus2dist=[[78,.84,-11],[72,.84,-11],[72,.84,19],[78,.84,19],[78,5.3,19],[78,5.3,22]];
  }
  function setEdge(key,pts,pw,color){
    let e=EDGES.find(e=>e.key===key);if(!e){e={key,parts:[],spawnAcc:0,media:'power',partCap:64};EDGES.push(e);const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(PART_CAP*3),3));e.points=new THREE.Points(g,new THREE.PointsMaterial({color:color||T.C.copper,size:.58,transparent:true,opacity:.9,depthWrite:false}));e.points.frustumCulled=false;scene.add(e.points);e.visualTube=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshStandardMaterial({color:color||T.C.copper,transparent:true,opacity:.5,roughness:.65}));scene.add(e.visualTube);}
    e.pts=pts.map(p=>p.slice());e.sag=0;e.seg=[];e.len=0;for(let i=1;i<pts.length;i++){const l=new THREE.Vector3(...pts[i-1]).distanceTo(new THREE.Vector3(...pts[i]));e.seg.push(l);e.len+=l;}e.parts=[];e.spawnAcc=0;e.pw=pw;e.color=color||e.color||T.C.copper;
    e.points.material.color.setHex(e.color);e.visualTube.material.color.setHex(e.color);e.tubeColor=e.color;e.cssColor='#'+new THREE.Color(e.color).getHexString();
    e.visualTube.geometry.dispose();const curve=new THREE.Curve();curve.getPoint=d=>new THREE.Vector3(...edgePoint(e,d));e.visualTube.geometry=new THREE.TubeGeometry(curve,Math.max(40,pts.length*10),.09,6,false);routes[key]=pts.map(p=>p.slice());
  }
  const gasSupply=()=>Math.min(S.gensetMW,S.dcLoadMW);
  const normalSupply=()=>Math.max(0,S.dcLoadMW-gasSupply());
  function routeFlows(){
    setEdge('smr',routes.smr,()=>S.smr,0x8197b3);setEdge('genset',routes.genset,gasSupply,0xab8860);
    setEdge('bus2tr',routes.bus2tr,normalSupply);
    setEdge('hvDataA',[[86,.84,-11],[86,.84,-21.25],[92,.84,-21.25],[92,5.3,-21.25],[92,5.3,-18.25]],()=>normalSupply()/2);
    setEdge('hvDataB',[[86,.84,-11],[86,.84,-4.75],[92,.84,-4.75],[92,5.3,-4.75],[92,5.3,-1.75]],()=>normalSupply()/2);
    setEdge('tr2dc',[[95,2.5,-18.25],[95,.84,-18.25],[100,.84,-18.25],[100,.84,-15],ports.normalA],()=>normalSupply()/2);
    setEdge('tr2dcB',[[95,2.5,-1.75],[95,.84,-1.75],[100,.84,-1.75],[100,.84,-5],ports.normalB],()=>normalSupply()/2);
    setEdge('dcA',[[116,.84,-15],ports.dcA],()=>S.dcLoadMW/2);setEdge('dcB',[[116,.84,-5],ports.dcB],()=>S.dcLoadMW/2);
    setEdge('bus2dist',routes.bus2dist,()=>S.airLoadMW+S.sc+S.metal+S.factory+S.h2P-S.stP-S.fcMW-S.carportMW);
    setEdge('feedIn',[[78,.84,34.9],[78,.84,37],[78,.84,52]],()=>S.airLoadMW+S.sc+S.metal+S.factory+S.h2P-S.stP-S.fcMW-S.carportMW);
    // Compensation branch has no invented active-power flow; visible three-phase conductors carry its topology.
    setEdge('svgShunt',routes.svgShunt,()=>0,T.C.teal);
    EDGES.find(e=>e.key==='genset').media='power';
    setEdge('trans',[[56,3.45,-19.2],[56,6,-19.2],...window.NZ_MULTI_PLAN.renewableExport.path],()=>S.windMW+S.solarMW);
    INFO.bus.from='风光场经架空线 / 独立 SMR 出线 / 购电通道';INFO.substation.from='风电场 / 光伏场';
  }
  function apply(){
    nuclear();standby();distribution();mediumVoltage();powerConnections();routeFlows();T.compile();
    // The landscape owns the shared surface and boundary. Do not restore the v5 plane.
    for(const o of scene.children){if(o.isMesh&&o.geometry.type==='BoxGeometry'&&o.geometry.parameters.width===460&&o.geometry.parameters.depth===300){o.geometry.dispose();o.geometry=new THREE.BoxGeometry(460,1.6,370);o.position.z=20;}
      if(o.isMesh&&o.geometry&&o.position.x===200&&o.position.y<2.3){const p=o.geometry.parameters;if((o.geometry.type==='CylinderGeometry'&&p.radiusTop===.06&&p.height===2.2)||(o.geometry.type==='BoxGeometry'&&p.depth===170))o.position.x=218;}}
    for(const p of []){const r=road(...p);r.material.color.set('#ced9d8');}
    INFO.dc.from='共用常用电源 → A/B 中压配电 / 50 MW 备用燃气轮机（部分负荷保障）';INFO.dc.note+=' A/B 路由为配电示意，共用上游母线；未验证独立双电源、故障隔离或可靠性等级。区域储能不代替 UPS。';INFO.dc.p.find(p=>p[0]==='进线')[1]='10.5 kV 中压（沿用降压侧口径）';
    const originalLabels=updateLabels3D;
    updateLabels3D=function(){originalLabels();
      setLv('substation','风光汇集 '+(S.windMW+S.solarMW).toFixed(1)+' MW','#087d73');
      setLv('line','风光输送 '+(S.windMW+S.solarMW).toFixed(1)+' MW','#087d73');
      setLv('bus','风光 '+(S.windMW+S.solarMW).toFixed(1)+' · SMR '+S.smr.toFixed(1)+' · 购电 '+S.gridBuy.toFixed(1)+' MW','#087d73');
      setLv('stepdown','数据楼常用进线 '+normalSupply().toFixed(1)+' MW','#087d73');
      setLv('dcfeed','常用 '+normalSupply().toFixed(1)+' / 备用 '+gasSupply().toFixed(1)+' MW','#087d73');
    };
  }
  function focus(key){if(key==='smr')return {pos:[373,87,-252],tgt:[280,6,-355]};if(key==='genset')return {pos:[234,41,42],tgt:[184,4,-8]};if(key==='dcfeed')return {pos:[87,26,26],tgt:[110,2,-10]};if(key==='disttr')return {pos:[112,39,81],tgt:[78,3,22]};if(key==='stepdown')return {pos:[143,48,49],tgt:[92,4,-10]};if(key==='svgapf')return {pos:[137,31,72],tgt:[94,2,30]};return null;}
  function setGas(open){gasOpen=open;gasRoof.visible=!open;gasFront.visible=!open;const b=document.getElementById('gasCutaway');if(b)b.textContent=open?'关闭燃机罩壳':'打开燃机罩壳';}
  function setRoom(open){mvOpen=open;mvRoof.visible=!open;mvFront.visible=!open;const b=document.getElementById('mvCutaway');if(b)b.textContent=open?'关闭配电房':'打开配电房';}
  function selection(key){selected=key;if(key!=='genset')setGas(false);if(key!=='dcfeed')setRoom(false);const p=document.getElementById('infraControls');if(!p)return;p.hidden=!['smr','genset','stepdown','disttr','svgapf','bus','dcfeed','substation','dc'].includes(key);document.getElementById('gasCutaway').hidden=key!=='genset';document.getElementById('mvCutaway').hidden=key!=='dcfeed';
    document.getElementById('gasMachineView').hidden=key!=='genset';
    const nuclear=key==='smr',industrial=['disttr','svgapf'].includes(key);document.getElementById('infraPath').textContent=nuclear?'SMR 汽轮发电 → 站内升压 → 高压母线 → 园区受电':key==='svgapf'?'工业中压母线 → 专用并联支路 → SVG / APF 就地补偿':industrial?'220 kV 母线 → 配电变压器 → 中压开关 → 35 kV 消纳母线':'高压母线 → 降压区 → A/B 中压配电 → A1；燃机备用另接中压配电';
  }
  function ready(a){api=a;const p=document.createElement('div');p.id='infraControls';p.hidden=true;p.innerHTML='<div class="detail-kicker">供电关联</div><p id="infraPath"></p><div class="infra-links"><button data-infra-device="smr">SMR 园区</button><button data-infra-device="bus">高压母线</button><button data-infra-device="stepdown">数据楼降压</button><button data-infra-device="dcfeed">A/B 配电</button><button data-infra-device="genset">燃机备用</button><button data-infra-device="disttr">工业配电</button></div><button id="infraWide">查看供电关联全景</button><button id="gasCutaway" hidden>打开燃机罩壳</button><button id="gasMachineView" hidden>燃机与发电机近景</button><button id="mvCutaway" hidden>打开配电房</button><small id="infraLive"></small>';
    document.getElementById('zincControls').before(p);p.querySelectorAll('[data-infra-device]').forEach(b=>b.addEventListener('click',()=>{api.exitTour();api.focus(b.dataset.infraDevice);}));document.getElementById('infraWide').addEventListener('click',()=>{api.exitTour();api.cancelCamera();camera.position.set(selected==='smr'?405:350,selected==='smr'?167:210,selected==='smr'?-100:270);controls.target.set(selected==='smr'?230:132,3,selected==='smr'?-220:-2);controls.update();});document.getElementById('gasCutaway').addEventListener('click',()=>{api.exitTour();api.cancelCamera();setGas(!gasOpen);camera.position.set(214,27,26);controls.target.set(182,2.8,-8);controls.update();});document.getElementById('gasMachineView').addEventListener('click',()=>{api.exitTour();api.cancelCamera();setGas(true);camera.position.set(182,15,21);controls.target.set(181,2.5,-8);controls.update();});document.getElementById('mvCutaway').addEventListener('click',()=>{api.exitTour();api.cancelCamera();setRoom(!mvOpen);camera.position.set(91,23,16);controls.target.set(110,2,-10);controls.update();});selection(null);
  }
  function update(){const el=document.getElementById('infraLive');if(!el)return;el.textContent=selected==='smr'?'核电出力 '+S.smr.toFixed(1)+' MW · '+(S.smrEnabled?'研究情景启用':'研究情景关闭'):['disttr','svgapf'].includes(selected)?'工业母线并联治理 · PF '+S.pf.toFixed(3)+' · THD '+S.thd.toFixed(1)+'%' :'常用进线 '+normalSupply().toFixed(1)+' MW · 燃机备用 '+gasSupply().toFixed(1)+' MW · 数据楼 '+S.dcLoadMW.toFixed(1)+' MW';}
  function audit(){return {sites,ports,routes,physical,ducts,terminals,gasOpen,mvOpen,normalMW:normalSupply(),backupMW:gasSupply(),dcMW:S.dcLoadMW,smrPosition:T.models.smr.root.position.toArray(),gensetPosition:T.models.genset.root.position.toArray()};}
  return {setup,prepare,apply,focus,selection,ready,update,audit};
})();



