from pathlib import Path
root=Path(__file__).resolve().parent.parent
p=root/'src/campus-infrastructure.js'
s=p.read_text(encoding='utf-8')
start=s.index('  function standby(){');end=s.index('  function distribution()',start)
s=s[:start]+'''  function machineCylinder(g,x,y,z,r,length,col){T.shape('cyl',[r,r,length],col,[x,y,z],g,[0,0,Math.PI/2]);}
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
    rod([4.3,4.2,.85],[4.3,.55,2.3],.12,C.dark,g);duct('Gas switchgear exit',[[20,.84,8.5],[20,.84,8.5]],.8,g);
    g.add(gensetDot);gensetDot.position.set(-2,7,0);ports.genset=[204,.84,.5];
    label('genset',[184,17,-8],'数据中心备用燃气轮机','50 MW · 机组 / 发电机 / 进排气 / 辅助系统 / 专用馈线');
    INFO.genset.media='power';INFO.genset.d='数据楼备用电源站。机组展示压气机壳体、燃烧与透平段、联轴器及发电机，补充法兰螺栓、支座、润滑过滤与泵组、燃气调压阀组、进排气风道及检修平台。电力经配套变压器和专用电缆通道接入数据楼配电房。';
    INFO.genset.to='发电机 / 开关配电 → 数据楼 A/B 中压配电 → 关键负荷';INFO.genset.p.push(['观察方式','可打开罩壳；压气机 → 燃机 → 联轴器 → 发电机'],['辅助系统','进气 / 排气 / 润滑 / 燃气 / 控制 / 冷却'],['供电范围','50 MW 备用配置；参数沿用原模型']);
  }
''' +s[end:]
# Avoid drawing overlapping corridor lids on identical branches.
s=s.replace('ducts=[],terminals=[];','ducts=[],terminals=[],ductSegments=new Set();')
s=s.replace("if(dx+dz<.001)continue;const x=", "if(dx+dz<.001)continue;const seg=[a[0]+','+a[2],b[0]+','+b[2]].sort().join('|');if(ductSegments.has(seg))continue;ductSegments.add(seg);const x=")
s=s.replace("duct('HV industrial spine',hvIndustrial,1.2);", "duct('HV industrial spine',[[72,.84,-11],[72,.84,34.9]],1.2);")
s=s.replace("physicalWire('dataPrimary'+z,pts,", "physicalWire('dataPrimary'+z,pts.map(p=>[p[0],.54,p[2]]),")
s=s.replace("physicalWire('industrialPrimary'+z,pts,", "physicalWire('industrialPrimary'+z,pts.map(p=>[p[0],.54,p[2]]),")
# Machine inspection angle shows the full train instead of cropping the filter house.
s=s.replace('camera.position.set(208,24,27);controls.target.set(183,2,-8);','camera.position.set(214,27,26);controls.target.set(182,2.8,-8);')
p.write_text(s,encoding='utf-8')
print('v6 gas turbine and auxiliary systems refined.')
