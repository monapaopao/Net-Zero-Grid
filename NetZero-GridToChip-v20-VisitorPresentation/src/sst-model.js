/* Shared, renderer-free SST concept geometry. Display units; not a product CAD model. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.NZ_SST_MODEL=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const colors={green:0x35c98a,greenDark:0x178a66,greenLight:0x9ce7c5,shell:0xe5ece9,white:0xf5f7f2,steel:0x8ea6a1,alloy:0xbdcbc5,dark:0x2c4345,core:0x46565b,copper:0xbf9154,insulator:0xdacbb2,cool:0x478da1,board:0x287366,red:0xb47862,black:0x172e34};
 const dimensions={width:3.1,depth:2.26,height:4.24,front:1,min:[-1.55,0,-1.1],max:[1.55,4.24,1.16]};
 function create(options){
  options=options||{};const detail=options.detail==='simple'?'simple':'high',parts=[],links=[],ports={mv:[-1.55,.68,-.86],dc:[1.55,.68,-.86],control:[1.55,.68,.25],storage:[1.55,.68,-.35],coolIn:[.98,.68,-1.1],coolOut:[1.15,.68,-1.1]};
  let serial=0;
  const add=p=>{p.id='sst-'+(++serial);parts.push(p);return p;};
  function box(name,p,size,mat='steel',assembly='fixed',fine=false){if(fine&&detail==='simple')return;return add({name,type:'box',p,size,mat,assembly});}
  function cyl(name,p,r,h,mat='steel',assembly='fixed',axis=[0,1,0],fine=false){if(fine&&detail==='simple')return;return add({name,type:'cylinder',p,r,h,mat,assembly,axis});}
  function rod(name,a,b,r,mat='steel',assembly='fixed',fine=false){if(fine&&detail==='simple')return;return add({name,type:'rod',a,b,r,mat,assembly});}
  function ring(name,p,r,t,mat='steel',assembly='fixed',axis=[0,0,1],fine=false){if(fine&&detail==='simple')return;return add({name,type:'ring',p,r,t,mat,assembly,axis});}
  function bolt(name,p,axis=[0,1,0],assembly='fixed'){cyl(name,p,.026,.025,'alloy',assembly,axis,true);}
  function terminal(name,p,r=.045,mat='copper'){cyl(name+' insulated base',p,r*1.6,.07,'insulator','fixed',[0,0,1]);cyl(name+' contact',[p[0],p[1],p[2]+.06],r,.05,mat,'fixed',[0,0,1]);}
  function route(name,points,r,mat='cool'){
   for(let i=1;i<points.length;i++)rod(name,points[i-1],points[i],r,mat);
   for(const i of [0,points.length-1]){const j=i===0?1:i-1,delta=points[j].map((v,k)=>v-points[i][k]),len=Math.hypot(...delta);cyl(name+' end fitting',points[i],r*1.55,.055,'alloy','fixed',delta.map(v=>v/len));}
   links.push({name,points,r,mat,assembly:'fixed',endpoints:'connector-to-connector'});
  }
  function louvre(name,x,y,z,w,h,assembly='doors'){box(name+' recess',[x,y,z],[w,h,.035],'dark',assembly);const count=detail==='simple'?4:8;for(let n=0;n<count;n++)box(name+' folded blade',[x,y-h/2+(n+.5)*h/count,z+.025],[w-.04,.022,.055],'steel',assembly);}
  // Base, frame and rear bottom cable compartment remain fixed in every pose.
  box('Concrete footing',[0,.055,0],[3.1,.11,2.2],'shell');
  box('Steel bottom frame',[0,.19,0],[2.96,.16,2.06],'dark');
  for(const x of [-1.18,1.18]){box('Mounting rail',[x,.32,0],[.16,.12,1.96]);for(const z of [-.82,.82]){box('Isolation pad',[x,.255,z],[.29,.04,.3],'black');box('Anchor foot',[x,.125,z],[.38,.04,.35],'alloy');bolt('Anchor bolt',[x,.16,z]);}}
  box('Equipment floor',[0,.415,0],[2.85,.07,1.98],'steel');
  for(const x of [-1.4,1.4])for(const z of [-.94,.94])box('Frame upright',[x,2.23,z],[.085,3.58,.085],'steel');
  for(const y of [.46,3.98])for(const z of [-.94,.94])box('Frame transverse beam',[0,y,z],[2.88,.085,.085]);
  for(const y of [.46,3.98])for(const x of [-1.4,1.4])box('Frame longitudinal beam',[x,y,0],[.085,.085,1.94]);
  box('Rear fixed gland panel',[0,.71,-.96],[2.8,.49,.06],'steel');
  for(const x of [-1,0,1])bolt('Cable plate bolt',[x,.94,-.99],[0,0,1]);
  box('Grounding strip',[0,.51,.77],[2.6,.045,.065],'copper');
  for(const x of [-1.1,-.6,0,.6,1.1])bolt('Earth bond stud',[x,.545,.77]);
  // Shell lifts as an actual enclosure, leaving the equipment frame and ports behind.
  box('Left side skin',[-1.46,2.54,0],[.06,3.02,2.02],'shell','shell');
  box('Right side skin',[1.46,2.54,0],[.06,3.02,2.02],'shell','shell');
  box('Upper rear skin',[0,2.54,-1.005],[2.86,3.02,.055],'shell','shell');
  box('Roof weather cap',[0,4.08,0],[3.06,.12,2.16],'white','shell');
  for(const x of [-1.49,1.49])box('Roof drip fold',[x,3.99,0],[.055,.08,2.13],'steel','shell');
  for(const z of [-1.04,1.04])box('Roof transverse fold',[0,3.99,z],[2.98,.08,.055],'steel','shell');
  for(const x of [-1.23,1.23])for(const z of [-.76,.76]){ring('Lifting lug',[x,4.16,z],.055,.018,'steel','shell',[0,0,1],true);bolt('Roof bolt',[x,4.15,z],[0,1,0],'shell');}
  for(const x of [-1.497,1.497])for(const y of [1.35,2.1,2.85,3.6])box('Side folded stiffener',[x,y,0],[.025,.045,1.91],'steel','shell',true);
  // Doors move outwards along +z; controller/HMI stays physically on its door.
  for(const x of [-.713,.713]){
   box('Door folded steel panel',[x,2.23,1.015],[1.39,3.49,.07],x<0?'shell':'green','doors');
   for(const xx of [x-.67,x+.67])box('Door frame side',[xx,2.23,1.062],[.035,3.4,.025],'steel','doors');
   for(const yy of [.53,3.93])box('Door frame rail',[x,yy,1.062],[1.36,.04,.025],'steel','doors');
   for(const y of [1.05,2.22,3.4]){cyl('Door hinge sleeve',[x+Math.sign(x)*.69,y,1.08],.035,.15,'alloy','doors');cyl('Door hinge pin',[x+Math.sign(x)*.69,y,1.08],.013,.18,'dark','doors');}
   box('Door latch recess',[x-Math.sign(x)*.51,2.15,1.068],[.095,.32,.025],'dark','doors');
   rod('Door pull handle',[x-Math.sign(x)*.51,2.06,1.13],[x-Math.sign(x)*.51,2.25,1.13],.025,'alloy','doors');
   cyl('Door key cylinder',[x-Math.sign(x)*.51,1.92,1.09],.022,.026,'alloy','doors',[0,0,1],true);
   box('Door internal brace',[x,2.1,.96],[1.2,.045,.045],'steel','doors',true);
   louvre('Lower intake',x,.96,1.07,1.05,.48,'doors');
  }
  box('Door central seal',[0,2.23,1.065],[.025,3.4,.018],'dark','doors');
  box('SST name plate',[-.7,3.55,1.07],[.78,.25,.025],'green','doors');
  box('Name plate inset',[-.7,3.55,1.085],[.65,.12,.012],'greenLight','doors',true);
  box('Display bezel',[.73,3.2,1.08],[.68,.43,.04],'dark','doors');
  box('Display glass',[.73,3.2,1.105],[.56,.31,.018],'board','doors');
  for(let n=0;n<4;n++)box('Display readout stripe',[.62+n*.075,3.2,1.119],[.035,.12+n*.025,.006],'greenLight','doors',true);
  for(const x of [.51,.71,.91])cyl('Status lens',[x,2.78,1.095],.035,.025,x===.91?'red':'greenLight','doors',[0,0,1]);
  // Function zones are explicit, non-overlapping equipment envelopes.
  const zones=[
   {id:'mv',label:'中压接入与保护',min:[-1.31,.62,-.76],max:[-.8,3.55,.66]},
   {id:'cells',label:'模块化功率变换',min:[-.68,2.45,-.7],max:[.65,3.73,.7]},
   {id:'mft',label:'中频隔离变压器',min:[-.68,.68,-.72],max:[.65,2.2,.68]},
   {id:'dc',label:'直流输出与控制',min:[.79,.65,-.72],max:[1.29,3.68,.69]}
  ];
  for(const x of [-.74,.72])box('Vertical safety partition',[x,2.19,-.1],[.035,3.38,1.58],'steel');
  box('Central equipment shelf',[-.015,2.32,-.03],[1.41,.065,1.6],'steel');
  box('Rear module mounting plane',[0,2.24,-.79],[2.68,3.43,.035],'alloy');
  // MV connections: three bushings, protected contacts and sensors.
  for(let ph=0;ph<3;ph++){
   const y=1.15+ph*.76,x=-1.055;
   box('MV insulated terminal mount',[x,y,-.69],[.32,.44,.13],'insulator');
   cyl('MV insulated bushing',[x,y,-.37],.11,.5,'insulator','fixed',[0,0,1]);
   for(let r=0;r<4;r++)cyl('MV bushing shed',[x,y,-.55+r*.1],.15,.03,'white','fixed',[0,0,1],true);
   terminal('MV contact',[x,y,-.07],.05);
   box('MV disconnect contact',[x,y,.13],[.09,.11,.26],'copper');
   ring('MV current sensor',[x,y,.21],.102,.032,'dark','fixed',[0,0,1]);
   box('Protection module',[x,y+.23,.25],[.29,.12,.28],'dark');
   box('Phase barrier',[x,y+.35,-.03],[.44,.025,1.13],'white');
  }
  box('MV vertical feeder',[-1.2,2.13,-.6],[.055,2.55,.055],'copper');
  for(const y of [1.15,1.91,2.67])box('MV feeder connector',[-1.13,y,-.6],[.14,.055,.055],'copper');
  // Three plug-in power cells: capacitors, semiconductors and cold plates.
  for(let level=0;level<3;level++){
   const y=2.62+level*.37;
   for(const x of [-.61,.58])box('Power-cell guide',[x,y,-.03],[.045,.045,1.35],'dark');
   box('Power-cell cold plate',[-.015,y,-.06],[1.12,.055,1.22],'steel');
   box('Power-cell rear chassis',[-.015,y+.12,-.62],[1.15,.24,.07],'alloy');
   box('Power-cell front panel',[-.015,y+.12,.58],[1.16,.25,.055],'dark');
   for(const x of [-.49,.46])for(const dy of [-.08,.08])bolt('Power-cell face screw',[x,y+.12+dy,.62],[0,0,1]);
   for(let n=0;n<7;n++)box('Power-cell face ventilation slot',[-.31+n*.085,y+.12,.612],[.04,.08,.009],'black','fixed',true);
   cyl('Power-cell enable indicator',[.34,y+.12,.615],.02,.015,'greenLight','fixed',[0,0,1]);
   for(const x of [-.52,.49]){rod('Power-cell pull handle',[x,y+.06,.65],[x,y+.19,.65],.019,'alloy');box('Power-cell green latch',[x,y+.12,.62],[.065,.07,.03],'green');}
   for(const x of [-.4,-.16,.08]){
    cyl('DC link capacitor',[x,y+.17,-.27],.085,.21,'dark');
    for(const dx of [-.03,.03])cyl('Capacitor terminal',[x+dx,y+.29,-.27],.013,.03,'copper','fixed',[0,1,0],true);
    box('Capacitor bridge',[x,y+.31,-.27],[.1,.015,.025],'copper','fixed',true);
   }
   for(const x of [-.36,.04,.4]){
    box('Power semiconductor module',[x,y+.11,.17],[.25,.12,.27],'white');
    box('Module gate board',[x,y+.18,.17],[.22,.025,.22],'board','fixed',true);
    for(const dx of [-.08,.08])bolt('Semiconductor clamp bolt',[x+dx,y+.2,.17]);
   }
   terminal('Power-cell bus connector',[.48,y+.12,-.53],.028);
   for(const x of [-.58,.56])terminal('Cold-plate coupling',[x,y,.48],.025,'cool');
  }
  // A recognisable high-frequency isolated magnetic stage, two coils on a closed core.
  for(const x of [-.42,.39]){
   box('MFT saddle',[x,.68,-.06],[.3,.14,.95],'steel');
   box('MFT core limb',[x,1.39,-.06],[.16,1.26,.42],'core');
   for(const y of [.86,1.94])box('MFT winding end insulation',[x,y,-.06],[.54,.06,.88],'insulator');
   // Fine, separated turn bands reveal depth without claiming a product turn count.
   const turns=detail==='simple'?6:13;
   for(let n=0;n<turns;n++){
    const y=.93+n*.88/Math.max(1,turns-1);
    box('MFT winding front turn',[x,y,.385],[.46,.043,.065],'copper');
    box('MFT winding rear turn',[x,y,-.505],[.46,.043,.065],'copper');
    for(const dx of [-.24,.24])box('MFT winding side turn',[x+dx,y,-.06],[.06,.043,.89],'copper');
   }
   for(const z of [-.57,.45])box('MFT winding compression bar',[x,1.4,z],[.55,1.03,.045],'alloy');
   for(const z of [-.59,.47])for(const y of [.91,1.88])bolt('Winding tie bolt',[x,y,z],[0,0,1]);
   for(const y of [1.05,1.73])terminal('MFT winding lead',[x+.12,y,.58],.033);
  }
  for(const y of [.78,2.02])box('MFT closing core yoke',[-.015,y,-.06],[1.11,.15,.42],'core');
  for(const z of [-.29,.17])for(const y of [.78,2.02])box('MFT core clamp',[-.015,y,z],[1.15,.045,.045],'alloy','fixed',true);
  // DC lane contains protection, laminated parallel buses, current sensor and control shelf.
  for(const x of [.91,1.12]){
   box('DC insulated collector',[x,1.66,-.46],[.055,1.93,.06],x<1?'copper':'alloy');
   for(const y of [.81,1.66,2.5]){cyl('Busbar standoff',[x,y,-.64],.055,.23,'insulator','fixed',[0,0,1]);bolt('Busbar fixing bolt',[x,y,-.413],[0,0,1]);}
  }
  box('DC output protection',[1.005,1.15,.18],[.39,.64,.51],'dark');
  box('DC contactor face',[1.005,1.15,.445],[.29,.44,.035],'white');
  for(const y of [.97,1.34])terminal('DC protection terminal',[1.005,y,.49],.03);
  ring('DC output current sensor',[1.01,1.8,.15],.14,.04,'dark','fixed',[0,1,0]);
  rod('Output sensor conductor',[1.01,1.55,.15],[1.01,2.05,.15],.035,'copper');
  cyl('Precharge resistor',[1.025,2.14,.1],.085,.32,'insulator','fixed',[1,0,0]);
  box('Control module DIN rail',[1.02,3.28,-.52],[.43,.045,.06],'steel');
  box('Controller backplate',[1.02,3.24,-.43],[.43,.79,.06],'dark');
  box('Controller PCB',[1.02,3.23,-.38],[.38,.68,.025],'board');
  for(let n=0;n<3;n++){
   box('Controller processor',[1.02,3+n*.22,-.35],[.18,.13,.035],'black','fixed',true);
   for(const x of [.86,1.18])box('Controller terminal block',[x,3+n*.22,-.32],[.07,.15,.055],'alloy');
  }
  box('Communication interface',[1.025,3.62,.17],[.39,.1,.46],'dark');
  for(const x of [.91,1.04,1.17])terminal('Optical connector',[x,3.62,.41],.02,'green');
  box('Vertical control cable duct',[1.25,2.42,.58],[.055,2.18,.11],'shell');
  for(const y of [1.4,2.2,3])box('Cable duct lid latch',[1.25,y,.645],[.06,.035,.025],'steel','fixed',true);
  route('Communication interface harness',[[1.42,.68,.25],[1.25,.68,.25],[1.25,3.62,.25],[1.17,3.62,.41]],.015,'greenDark');
  // Rear liquid distribution, clipped to the frame; interfaces are real end fittings.
  for(const x of [-.66,.7]){
   route('Cooling riser',[[x,.68,-.7],[x,3.7,-.7]],.023,x<0?'cool':'greenDark');
   for(const y of [.8,1.8,2.8,3.65]){ring('Cooling pipe support collar',[x,y,-.7],.035,.009,'alloy','fixed',[0,1,0],true);box('Pipe frame bracket',[x,y,-.755],[.07,.035,.065],'steel','fixed',true);}
   for(let n=0;n<3;n++){
    const y=2.62+n*.37;
    const endX=x<0?-.58:.56;
    route('Cold plate coolant branch',[[x,y,-.7],[x,y,-.59],[endX,y,-.59],[endX,y,.48]],.018,x<0?'cool':'greenDark');
    ring('Branch quick coupling',[endX,y,.43],.03,.01,'alloy','fixed',[0,0,1],true);
   }
  }
  // Cooling pump and radiator sit on their own mounting feet, behind the magnetic stage.
  box('Coolant pump mounting bracket',[-.05,.51,-.69],[.52,.08,.23],'steel');
  cyl('Coolant pump motor',[-.1,.64,-.69],.09,.2,'cool','fixed',[1,0,0]);
  cyl('Coolant pump volute',[.055,.64,-.69],.1,.11,'steel','fixed',[1,0,0]);
  route('Cooling inlet to pump',[[.98,.68,-.86],[.98,.57,-.86],[.35,.57,-.86],[.35,.64,-.69],[.11,.64,-.69]],.018,'cool');
  route('Pump delivery manifold',[[-.2,.64,-.69],[-.66,.64,-.69],[-.66,.68,-.7]],.018,'cool');
  route('Cooling return to outlet',[[.7,.68,-.7],[1.15,.68,-.7],[1.15,.68,-.86]],.018,'greenDark');
  box('Upper radiator core',[0,3.78,-.06],[1.2,.14,1.33],'dark');
  for(let f=0;f<12;f++)box('Radiator fin',[-.55+f*.1,3.78,-.06],[.015,.18,1.25],'alloy','fixed',true);
  for(const x of [-.33,.31]){
   cyl('Fan shroud',[x,3.91,-.03],.25,.08,'dark');
   ring('Fan guard outer',[x,3.96,-.03],.24,.013,'alloy','fixed',[0,1,0]);
   for(const r of [.09,.16])ring('Fan guard inner',[x,3.965,-.03],r,.006,'steel','fixed',[0,1,0],true);
   cyl('Fan motor hub',[x,3.975,-.03],.055,.04,'steel');
   for(let b=0;b<5;b++){const a=b*Math.PI*2/5;rod('Fan blade',[x,3.966,-.03],[x+Math.cos(a)*.205,3.966,-.03+Math.sin(a)*.205],.027,'alloy','fixed',true);}
  }
  // Gland assemblies and terminal sockets identify every external connection.
  for(const [name,p]of Object.entries(ports)){
   const cool=name.indexOf('cool')===0,n=cool?[0,0,-1]:[Math.sign(p[0]),0,0],at=d=>p.map((v,i)=>v-n[i]*d);
   box(name+' connector bulkhead',at(.185),cool?[.17,.19,.12]:[.12,.19,.17],'steel');
   cyl(name+' port insulator',at(.085),name==='mv'?.07:.045,.11,'insulator','fixed',n);
   cyl(name+' port terminal',at(.02),.027,.04,cool?'cool':name==='control'?'green':'copper','fixed',n);
   rod(name+' internal terminal stub',at(.245),at(.13),.022,cool?'cool':'copper');
  }
  const functionalPath=['中压接入与保护','功率电子变换','中频隔离','直流输出与保护'];
  return {version:1,detail,colors,dimensions,parts,ports,zones,links,functionalPath,assemblies:{fixed:{move:[0,0,0]},doors:{move:[0,0,2.2]},shell:{move:[0,4.6,0]}},notes:['概念结构示意','外廓和部件比例为可读性展示单位','模块数量不能直接换算容量']};
 }
 function audit(data){
  const errors=[],warnings=[],finite=a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite);const ids=new Set();
  for(const p of data.parts){
   if(ids.has(p.id))errors.push('duplicate '+p.id);ids.add(p.id);
   if(!data.assemblies[p.assembly])errors.push('unknown assembly '+p.id);
   if(!Object.prototype.hasOwnProperty.call(data.colors,p.mat))errors.push('unknown material '+p.id);
   if(p.type==='rod'){if(!finite(p.a)||!finite(p.b)||!(p.r>0)||Math.hypot(...p.a.map((v,i)=>v-p.b[i]))<1e-8)errors.push('bad rod '+p.id);}
   else if(!finite(p.p))errors.push('bad coordinate '+p.id);
   if(p.type==='box'&&(!finite(p.size)||p.size.some(v=>v<=0)))errors.push('bad box '+p.id);
   if((p.type==='cylinder'||p.type==='ring')&&(!finite(p.axis)||Math.abs(Math.hypot(...p.axis)-1)>1e-8||!(p.r>0)))errors.push('bad round '+p.id);
   if(p.type==='cylinder'&&!(p.h>0))errors.push('bad cylinder '+p.id);
   if(p.type==='ring'&&(!(p.t>0)||p.t>=p.r))errors.push('bad ring '+p.id);
  }
  for(const [name,p]of Object.entries(data.ports))if(!finite(p)||Math.abs(p[0])>1.58||Math.abs(p[2])>1.2||p[1]<0||p[1]>4.2)errors.push('port outside envelope '+name);
  for(let i=0;i<data.zones.length;i++)for(let j=i+1;j<data.zones.length;j++){
   const a=data.zones[i],b=data.zones[j];if([0,1,2].every(k=>Math.min(a.max[k],b.max[k])-Math.max(a.min[k],b.min[k])>1e-6))errors.push('functional zone overlap '+a.id+'/'+b.id);
  }
  for(const l of data.links)if(l.points.length<2||l.points.some(p=>!finite(p)))errors.push('bad route '+l.name);
  if(data.parts.length<100)warnings.push('low detail descriptor count');
  return {passed:errors.length===0,errors,warnings,partCount:data.parts.length,materialCount:Object.keys(data.colors).length,assemblyCounts:data.parts.reduce((a,p)=>(a[p.assembly]=(a[p.assembly]||0)+1,a),{}),zoneCount:data.zones.length,routeCount:data.links.length,scope:'finite geometry, functional bay envelopes, explicit port bounds; not a complete solid-intersection or electrical-clearance proof'};
 }
 return {create,audit,colors,dimensions};
});
