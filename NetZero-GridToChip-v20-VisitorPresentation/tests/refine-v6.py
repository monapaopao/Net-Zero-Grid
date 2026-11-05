from pathlib import Path
root=Path(__file__).resolve().parent.parent
p=root/'src/campus-infrastructure.js'
s=p.read_text(encoding='utf-8-sig')
s=s.replace('/* v5:', '/* v6:')
s=s.replace('const routes={},ports={},sites={},physical=[];', 'const routes={},ports={},sites={},physical=[],ducts=[],terminals=[];')
start=s.index('  function powerConnections(){')
end=s.index('  function setEdge(',start)
s=s[:start]+'''  function duct(key,pts,width=1.1,g){
    g=g||T.models.powerConnections.root;const {box,C}=T;
    for(let n=1;n<pts.length;n++){const a=pts[n-1],b=pts[n],dx=Math.abs(b[0]-a[0]),dz=Math.abs(b[2]-a[2]);
      if(dx>.001&&dz>.001)throw Error('Cable corridor must use orthogonal bends: '+key);
      if(dx+dz<.001)continue;const x=(a[0]+b[0])/2,z=(a[2]+b[2])/2;
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
    duct('HV industrial spine',hvIndustrial,1.2);
    box(5.8,.65,2.2,C.shell,78,.55,-10.7,conn);
    for(let phase=0;phase<3;phase++){const x=78+(phase-1)*2.2,z=-11+(phase-1)*.2;
      rod([x,8.6,-10],[x,.55,-10],.09,C.dark,conn);rod([x,.55,-10],[x,.55,z],.09,C.dark,conn);rod([x,.55,z],[78,.55,z],.09,C.dark,conn);
    }
    for(const z of [-18.25,-10,-1.75]){
      const pts=[[86,.84,z-3],[92,.84,z-3]];duct('HV data branch '+z,pts,.9);
      physicalWire('dataPrimary'+z,pts,[-.18,0,.18],C.dark);primaryTerminal('dataPrimary'+z,92,z,5.3,1.425,conn);
    }
    for(const z of [14.3,22,29.7]){
      const pts=[[72,.84,z-3],[78,.84,z-3]];duct('HV industrial branch '+z,pts,.9);
      physicalWire('industrialPrimary'+z,pts,[-.18,0,.18],C.dark);primaryTerminal('industrialPrimary'+z,78,z,z===22?5.3:5.64,z===22?1.33:1.4,conn);
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
    const nuclearRoute=[ports.smr,[187,10,-58],[133,10,-58],[78,10,-58],[78,8.6,-10]];
    physicalWire('smr',nuclearRoute,[-.7,0,.7],0x8197b3);
    for(let phase=0;phase<3;phase++)rod([78,8.6,-10+(phase-1)*.7],[78+(phase-1)*2.2,8.6,-10],.08,0x8197b3,conn);
    const renewableRoute=[[56,6,-18],[50,13.2,-39],[70,13.2,-39],[90,13.2,-39],[78,8.6,-10]];
    physicalWire('trans',renewableRoute,[-.7,0,.7]);
    for(let phase=0;phase<3;phase++){rod([56,3.45,-19.2+(phase-1)*1.45],[56,6,-18+(phase-1)*.7],.08,C.copper,conn);rod([78,8.6,-10+(phase-1)*.7],[78+(phase-1)*2.2,8.6,-10],.08,C.copper,conn);}
    for(const [x,y,z]of nuclearRoute.slice(1,-1)){for(const dx of [-1.3,1.3])box(.17,y,.17,C.steel,x+dx,y/2,z,conn);box(3.8,.2,.2,C.steel,x,y,z,conn);}
    ports.bus=[78,.84,-11];routes.genset=gasRoute;routes.smr=nuclearRoute;
    routes.bus2tr=[[78,8.6,-10],[78,.84,-10],[78,.84,-11],[86,.84,-11]];
    routes.bus2dist=[[78,.84,-11],[72,.84,-11],[72,.84,19],[78,.84,19]];
  }
''' +s[end:]
s=s.replace("setEdge('bus2tr',[[75.8,8.6,-10],[86,7,-10],[92,5.3,-10]],normalSupply);","setEdge('bus2tr',routes.bus2tr,normalSupply);")
s=s.replace("[[95,2.5,-18.25],[100,2.5,-18.25],[100,1.15,-15],ports.normalA]","[[95,2.5,-18.25],[95,.84,-18.25],[100,.84,-18.25],[100,.84,-15],ports.normalA]")
s=s.replace("[[95,2.5,-1.75],[100,2.5,-1.75],[100,1.15,-5],ports.normalB]","[[95,2.5,-1.75],[95,.84,-1.75],[100,.84,-1.75],[100,.84,-5],ports.normalB]")
s=s.replace("[[116,1.15,-15],ports.dcA]","[[116,.84,-15],ports.dcA]").replace("[[116,1.15,-5],ports.dcB]","[[116,.84,-5],ports.dcB]")
s=s.replace("setEdge('bus2dist',[[75.8,8.6,-10],[67,7,22],[78,5.3,22]],","setEdge('bus2dist',routes.bus2dist,")
s=s.replace("[[78,1.4,34.9],[78,1.5,37],[78,1.5,52]]","[[78,.84,34.9],[78,.84,37],[78,.84,52]]")
s=s.replace('return {sites,ports,routes,physical,gasOpen,mvOpen,','return {sites,ports,routes,physical,ducts,terminals,gasOpen,mvOpen,')
p.write_text(s,encoding='utf-8')
cfg=root/'src/config.js'; cfg.write_text(cfg.read_text(encoding='utf-8').replace("'5.0.0'","'6.0.0'"),encoding='utf-8')
build=root/'build.cjs'; build.write_text(build.read_text(encoding='utf-8').replace('独立核电与备用供电 v5','线路整理与燃机精细化 v6'),encoding='utf-8')
print('v6 covered corridors and isolated device terminations written.')
