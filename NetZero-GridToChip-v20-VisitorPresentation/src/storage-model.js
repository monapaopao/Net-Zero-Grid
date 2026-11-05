/* v18 Storage geometry source of truth. Coordinates are display units, not engineering dimensions. */
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;root.NZ_STORAGE_MODEL=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function create(){
 const origin=[35.5,0,39],site={x0:12,x1:58,z0:25.5,z1:53.2},parts=[],units=[],links=[],clearances=[];
 const colors={shell:0xdce7e2,white:0xf1f4ef,steel:0x829b97,dark:0x334c4d,teal:0x238e83,alloy:0xa6b8b3,blue:0x537e8d,copper:0xaa8756,red:0x98584d,ground:0xd2dcd5};
 function box(name,x,y,z,w,h,d,mat='shell',tier='base',assembly='fixed'){parts.push({name,type:'box',p:[x,y,z],size:[w,h,d],mat,tier,assembly});}
 function cyl(name,x,y,z,r,h,mat='steel',tier='high',assembly='fixed',axis=[0,1,0]){parts.push({name,type:'cyl',p:[x,y,z],r,h,mat,tier,assembly,axis});}
 function rod(name,a,b,r,mat='steel',tier='high',assembly='fixed'){parts.push({name,type:'rod',a,b,r,mat,tier,assembly});}
 function ring(name,x,y,z,r,t=.03,mat='steel',tier='high',assembly='fixed',axis=[0,1,0]){parts.push({name,type:'ring',p:[x,y,z],r,t,mat,tier,assembly,axis});}
 function panel(name,x,y,z,w,h,mat='white',assembly='fixed'){
  box(name+' door',x,y,z,w,h,.07,mat,'base',assembly);
  for(const side of [-1,1])box(name+' frame',x+side*(w/2+.035),y,z,.065,h+.1,.12,'steel','medium',assembly);
  for(const yy of [y-h/2-.035,y+h/2+.035])box(name+' frame rail',x,yy,z,w+.14,.065,.12,'steel','medium',assembly);
  box(name+' handle',x+w*.3,y,z+.06,.065,.33,.07,'dark','medium',assembly);
  for(const yy of [y-h*.3,y+h*.3])box(name+' hinge',x-w/2-.045,yy,z+.075,.11,.16,.11,'alloy','high',assembly);
  box(name+' lock',x+w*.3,y-.22,z+.07,.1,.08,.03,'steel','high',assembly);
 }
 function vent(name,x,y,z,w,h,assembly='fixed',tier='medium'){
  box(name+' recess',x,y,z,w,h,.04,'dark',tier,assembly);
  for(let j=0;j<6;j++)box(name+' louvre',x,y-h/2+(j+.5)*h/6,z+.035,w-.06,.035,.055,'alloy',tier,assembly);
 }
 box('Station slab',35,.1,39.25,46,.2,27.5,'ground');
 for(const x of [12.12,57.88])box('Site edge',x,.23,39.25,.24,.14,27.5,'steel');
 for(const z of [25.62,52.88])box('Site edge',35,.23,z,45.5,.14,.24,'steel');
 for(const z of [34.15,42.65,50.9]){box('Service aisle',35,.215,z,43,.03,2.45,'shell');for(const zz of [z-1.1,z+1.1])box('Aisle closed edge',35,.237,zz,42.7,.015,.05,'white');}
 const rows=[29.5,38,46.5],cols=[18.5,27,35.5,44];
 for(let row=0;row<3;row++)for(let col=0;col<4;col++){
  const x=cols[col],z=rows[row],id='B'+(row+1)+(col+1),hero=row===2&&col===2,shell=hero?'heroShell':'fixed',doors=hero?'heroDoors':'fixed';
  units.push({id,kind:'battery',x,z,w:8.05,d:4.5,h:4.5,hero});
  box(id+' concrete pad',x,.34,z,7.5,.26,4.1,'white');
  for(const zz of [z-1.25,z+1.25])box(id+' base rail',x,.55,zz,6.8,.17,.23,'steel');
  box(id+' floor',x,.7,z,6.8,.16,3.5,'steel');
  if(!hero)box(id+' battery compartment',x,2.2,z,6.7,2.95,3.36,'shell');
  else{
   box(id+' back',x,2.27,z-1.72,6.8,3.04,.1,'shell','base',shell);
   for(const dx of [-3.35,3.35])box(id+' side',x+dx,2.27,z,.1,3.04,3.5,'shell','base',shell);
  }
  box(id+' roof',x,3.88,z,7.02,.18,3.7,'white','base',shell);
  for(const zz of [z-1.8,z+1.8])box(id+' drip edge',x,3.77,zz,7,.1,.08,'steel','medium',shell);
  for(let r=-3;r<=3;r+=.4)box(id+' roof rib',x+r,3.99,z,.045,.045,3.5,'alloy','high',shell);
  for(const dx of [-3.4,3.4])for(const dz of [-1.75,1.75]){box(id+' corner post',x+dx,2.26,z+dz,.15,3.08,.15,'white','base',shell);box(id+' lifting corner',x+dx,3.94,z+dz,.24,.16,.22,'steel','medium',shell);cyl(id+' fixing bolt',x+dx,4.03,z+dz,.035,.035,'dark','high',shell);}
  for(let j=0;j<4;j++){
   const dx=-2.55+j*1.7;panel(id+' service '+j,x+dx,2.24,z+1.79,1.6,2.9,'white',doors);
   for(let rib=-3;rib<=3;rib++)box(id+' door rib',x+dx+rib*.18,2.22,z+1.835,.022,2.6,.03,'alloy','medium',doors);
   vent(id+' low grille',x+dx,1.05,z+1.86,1.25,.36,doors,'high');
  }
  box(id+' nameplate',x+.3,3.23,z+1.87,.62,.19,.03,'teal','medium',doors);
  box(id+' warning plate',x+2.83,3.16,z+1.87,.18,.18,.03,'copper','medium',doors);
  box(id+' service step',x,.45,z+2.05,5.7,.22,.5,'steel');
  cyl(id+' alarm lamp base',x+3.16,3.25,z+1.87,.085,.08,'steel','medium','fixed',[0,0,1]);
  cyl(id+' alarm lamp',x+3.16,3.25,z+1.925,.055,.04,'red','medium','fixed',[0,0,1]);
  box(id+' E stop',x+3.16,2.8,z+1.87,.15,.2,.06,'red','medium');
  box(id+' cooling cabinet',x+3.66,2,z,.65,2.36,2.25,'steel');
  vent(id+' cooling intake',x+3.66,1.75,z+1.14,.49,1.45,'fixed','medium');
  for(const yy of [2.95])for(const zz of [z-.55,z+.55]){
   cyl(id+' fan well',x+3.66,yy,zz,.245,.1,'dark','medium');ring(id+' fan guard',x+3.66,yy+.06,zz,.25,.025,'alloy','medium');cyl(id+' fan hub',x+3.66,yy+.08,zz,.06,.035,'steel','high');
   for(let blade=0;blade<4;blade++){const a=blade*Math.PI/2;rod(id+' fan blade',[x+3.66,yy+.09,zz],[x+3.66+Math.cos(a)*.2,yy+.09,zz+Math.sin(a)*.2],.025,'alloy','high');}
  }
  for(const dx of [-2.7,2.7]){box(id+' grounding lug',x+dx,.68,z+1.8,.14,.11,.08,'copper','high');cyl(id+' earth fastener',x+dx,.68,z+1.85,.03,.035,'steel','high','fixed',[0,0,1]);}
  if(hero){
   for(let rack=0;rack<4;rack++){
    const rx=x-2.58+rack*1.65;
    for(const xx of [rx-.64,rx+.64])for(const zz of [z-1.32,z+1.3])box('Rack upright',xx,2.2,zz,.075,2.85,.075,'steel');
    for(const zz of [z-1.32,z+1.3])box('Rack upper crossbeam',rx,3.62,zz,1.38,.075,.075,'steel','medium');
    for(const xx of [rx-.64,rx+.64])box('Rack top side rail',xx,3.62,z,.075,.075,2.7,'steel','medium');
    for(let level=0;level<6;level++){
     const yy=.95+level*.44;box('Module tray',rx,yy-.13,z,1.28,.05,2.6,'steel','medium');box('Battery module',rx,yy+.04,z,1.18,.3,2.42,'dark');
     box('Module face',rx,yy+.04,z+1.24,1.14,.27,.045,'blue','medium');
     for(const xx of [rx-.44,rx+.44])box('Module latch',xx,yy+.04,z+1.28,.065,.15,.05,'alloy','high');
     for(const s of [-1,1])box('Module terminal',rx+s*.28,yy+.08,z+1.29,.065,.065,.055,s===1?'copper':'steel','high');
    }
    for(const side of [-1,1]){rod('Rack coolant riser',[rx+side*.7,.8,z-1.4],[rx+side*.7,3.45,z-1.4],.035,'teal','medium');for(let l=0;l<6;l++){rod('Module cooling connection',[rx+side*.7,.99+l*.44,z-1.4],[rx+side*.5,.99+l*.44,z-1.4],.024,'teal','high');cyl('Module coolant socket',rx+side*.5,.99+l*.44,z-1.3,.045,.2,'steel','high','fixed',[0,0,1]);}}
   }
   for(const side of [-1,1]){rod('Cooling header',[x-3.28,3.45,z+side*.14-1.4],[x+3.28,3.45,z+side*.14-1.4],.045,'teal','medium');}
   for(const rx of [x-2.58,x-.93,x+.72,x+2.37])for(const dz of [-1.54,-1.26]){ring('Header support collar',rx,3.45,z+dz,.065,.012,'steel','high','fixed',[1,0,0]);rod('Header mounting bracket',[rx,3.51,z+dz],[rx,3.63,z-1.32],.024,'steel','high');}
   for(const dx of [-3.1,3.1])rod('DC collector bar',[x+dx,.9,z+1.4],[x+dx,3.4,z+1.4],.045,'copper','medium');
   box('BMS distribution box',x+2.64,3.45,z+1.38,.8,.35,.18,'shell','medium');
   rod('Fire manifold',[x-3.1,3.55,z-.5],[x+3.1,3.55,z-.5],.04,'red','medium');
   for(const dx of [-2.5,-.8,.8,2.5]){cyl('Fire nozzle',x+dx,3.47,z-.5,.055,.12,'steel','high');box('Temperature detector',x+dx,3.6,z+.6,.15,.08,.15,'white','high');}
   cyl('Fire medium cylinder',x-3.1,1.5,z-.9,.13,1.4,'red','medium');cyl('Bottle valve',x-3.1,2.25,z-.9,.06,.12,'steel','high');rod('Fire bottle coupling',[x-3.1,2.31,z-.9],[x-3.1,3.55,z-.9],.025,'red','high');rod('Fire inlet elbow',[x-3.1,3.55,z-.9],[x-3.1,3.55,z-.5],.025,'red','high');
  }
 }
 for(let row=0;row<3;row++){
  const z=rows[row];
  for(const dz of [-1.04,1.04]){const x=50.3,zz=z+dz;units.push({kind:'pcs',id:'PCS'+row+dz,x,z:zz,w:1.8,d:1.8,h:3.2});box('PCS concrete pad',x,.35,zz,2,.3,1.9,'white');box('PCS cabinet',x,1.85,zz,1.65,2.7,1.65,'shell');box('PCS weather cap',x,3.28,zz,1.83,.14,1.8,'white');panel('PCS',x,1.85,zz+.85,1.45,2.4);vent('PCS intake',x,1.1,zz+.92,1.15,.5);box('PCS control screen',x+.3,2.64,zz+.93,.36,.25,.04,'dark','medium');box('PCS display',x+.3,2.64,zz+.958,.27,.16,.02,'teal','high');}
  const x=54.8;units.push({kind:'stepup',id:'TR'+row,x,z,w:3.3,d:4.2,h:4.1});box('Step-up pad',x,.4,z,3.3,.4,4.2,'white');box('Step-up protective enclosure',x,1.92,z,2.85,2.65,3.6,'shell');box('Step-up cap',x,3.33,z,3.12,.18,3.84,'steel');
  panel('Step-up access',x,1.95,z+1.84,2.55,2.35);vent('Step-up lower intake',x,1.38,z+1.92,2.1,.72);vent('Step-up upper exhaust',x,2.52,z+1.92,2.1,.42);
  for(let ph=0;ph<3;ph++){cyl('HV base',x+(ph-1)*.72,3.55,z,.11,.25,'steel','medium');for(let shed=0;shed<4;shed++)cyl('HV insulator skirt',x+(ph-1)*.72,3.51+shed*.1,z,.17,.055,'white','high');cyl('HV terminal',x+(ph-1)*.72,3.93,z,.055,.17,'copper','medium');}
  // Covered trays terminate flush on connector boxes; each run has explicit endpoints.
  const zz=z-2.43;box('DC bridge tray',32.6,.6,zz,35.4,.18,.4,'steel');box('Bridge lid',32.6,.71,zz,35.5,.045,.46,'white','medium');
  for(const x0 of [16,24,32,40,48]){box('Tray support',x0,.43,zz,.16,.3,.16,'steel','medium');box('Tray foot',x0,.265,zz,.42,.035,.34,'alloy','high');}
  for(const x0 of cols){box('Battery branch duct',x0,.6,z-2.08,.32,.18,.7,'steel');box('Battery connector',x0,.67,z-1.76,.46,.32,.12,'dark','medium');links.push({id:'battery-dc',a:[x0,.6,zz],b:[x0,.6,z-1.73],endsOn:['tray','battery connector']});}
  box('PCS incoming riser',50.3,1.13,zz,.36,1.1,.36,'steel');box('PCS cable riser cap',50.3,1.73,zz,.5,.15,.5,'dark','medium');
  box('PCS-to-stepup covered duct',52.3,.62,z-1.13,3.4,.18,.36,'steel');links.push({id:'pcs-ac',a:[51.13,.62,z-1.13],b:[53.38,.62,z-1.13],endsOn:['PCS','stepup']});
 }
 box('Station power output connector',54.8,1,48.5,.6,.5,.4,'dark','medium');
 box('Station EMS plinth',52.8,.35,51.4,5.1,.3,1.6,'white');
 for(const x of [51.1,52.8,54.5]){box('EMS cabinet',x,1.7,51.4,1.5,2.4,1.2,'shell');panel('EMS',x,1.7,52.05,1.35,2.2);box('EMS screen',x+.25,2.4,52.12,.34,.24,.04,'teal','medium');}
 rod('EMS aerial',[54.7,2.95,51.4],[54.7,4.2,51.4],.025,'dark','high');
 box('Fire service pad',14,.35,50.4,2.1,.3,1.75,'white');box('Fire service cabinet',14,1.5,50.4,1.65,2,1.3,'white');panel('Fire equipment',14,1.5,51.08,1.5,1.85);box('Fire identification',14,1.95,51.15,.65,.19,.035,'red','medium');
 const out={origin,site,parts,units,links,colors,hero:{x:35.5,z:46.5,shellMove:[0,5.1,0],doorsMove:[0,0,2.25]},capacity:{mwh:300,mw:150,representativeBatteryContainers:12,pcsCabinets:6,stepupGroups:3},ports:{control:[52.8,2.4,52.15],power:[54.8,1,48.5]},clearances};
 return out;
}
function audit(data){const errors=[];const {site,units}=data;for(const u of units){if(u.x-u.w/2<site.x0||u.x+u.w/2>site.x1||u.z-u.d/2<site.z0||u.z+u.d/2>site.z1)errors.push(u.id+' out of site');}
 let minimumGap=Infinity;for(let i=0;i<units.length;i++)for(let j=i+1;j<units.length;j++){const a=units[i],b=units[j],dx=Math.abs(a.x-b.x)-(a.w+b.w)/2,dz=Math.abs(a.z-b.z)-(a.d+b.d)/2;if(dx<0&&dz<0)errors.push(a.id+' overlaps '+b.id);minimumGap=Math.min(minimumGap,Math.max(dx,dz));}
 for(const p of data.parts)if((p.p||p.a||[]).some(v=>!Number.isFinite(v))||(p.size||[]).some(v=>v<=0))errors.push(p.name+' invalid geometry');
 if(data.hero.z+1.9+data.hero.doorsMove[2]>site.z1)errors.push('Exploded doors cross road');
 for(const l of data.links)if(!l.endsOn||l.endsOn.length!==2)errors.push('Unterminated '+l.id);
 return {passed:errors.length===0,errors,parts:data.parts.length,minimumAssemblyGap:minimumGap,batteries:units.filter(u=>u.kind==='battery').length,pcs:units.filter(u=>u.kind==='pcs').length,stepup:units.filter(u=>u.kind==='stepup').length,note:'Native Three.js solids; clearance audits equipment envelopes, not manufacturer safety spacing.'};}
return {create,audit};});
