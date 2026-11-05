/* Anatomy craft adapted to native Three.js: one shared, inspectable physical model. */
(function(root,factory){const api=factory();if(typeof module!=='undefined')module.exports=api;root.NZ_TOWER_MODEL=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t),dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
function sagPath(points){const out=[points[0].slice()];for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],flat=Math.abs(a[1]-b[1])<1e-6,L=dist(a,b),n=flat?Math.max(4,Math.ceil(L/1.4)):1,sag=flat?Math.min(.48,L*.022):0;for(let j=1;j<=n;j++){const t=j/n,p=mix(a,b,t);p[1]-=4*sag*t*(1-t);out.push(p);}}return out;}
function create(plan){
 const parts=[],supports=[],attachments=[];let owner='';
 const put=(name,type,values,material='steel',tier='standard',role='structure')=>parts.push({name:owner+'/'+name,owner,type,material,tier,role,...values});
 const box=(name,p,size,material='steel',tier='standard',role='structure')=>put(name,'box',{p,size},material,tier,role);
 const beam=(name,a,b,r=.055,material='steel',tier='standard',role='structure',angle=false)=>put(name,angle?'angle':'rod',{a,b,r},material,tier,role);
 const ring=(name,p,r,t,axis=[0,1,0],tier='high')=>put(name,'ring',{p,r,t,axis},'alloy',tier,'fitting');
 function bolt(name,p,axis=[0,1,0],tier='high'){put(name,'bolt',{p,axis,r:.045,length:.075},'dark',tier,'bolt');}
 function insulator(name,top,end){
  const length=dist(top,end),axis=end.map((v,i)=>(v-top[i])/length);
  beam(name+'/core',mix(top,end,.09),mix(top,end,.89),.065,'insulator','compat','dielectric');
  for(let j=0;j<12;j++)put(name+'/shed-'+j,'shed',{p:mix(top,end,.14+j*.058),axis,r:j%2?.15:.18,length:.072},'ceramic','standard','dielectric');
  for(const [id,t]of [['upper',.045],['lower',.94]]){const p=mix(top,end,t);put(name+'/'+id+'-clevis','bolt',{p,axis,r:.09,length:length*.09},'alloy','compat','fitting');}
  attachments.push({owner,name,top,end,axis,length});
 }
 function clamp(name,p){
  box(name+'/saddle',[p[0],p[1]-.085,p[2]],[.34,.15,.25],'alloy','compat','fitting');
  for(const d of [-.1,.1])bolt(name+'/nut-'+d,[p[0]+d,p[1]+.045,p[2]]);
  ring(name+'/grading-ring',[p[0],p[1]+.17,p[2]],.24,.023,[0,1,0],'standard');
 }
 function footing(name,x,z,w=1.0,d=1.0){
  box(name+'/concrete',[x,.21,z],[w,.42,d],'concrete','compat','foundation');
  box(name+'/plate',[x,.455,z],[w*.7,.07,d*.7],'alloy','standard','foundation');
  for(const dx of [-w*.22,w*.22])for(const dz of [-d*.22,d*.22])bolt(name+'/anchor-'+dx+'-'+dz,[x+dx,.52,z+dz]);
 }
 function tower(x,z,index){
  owner='main-'+index;const corner=index!==1;supports.push({id:owner,x,z,type:corner?'angle-V':'suspension-I',height:17.4});
  const at=(dx,y,dz)=>[x+dx,y,z+dz],levels=[.5,2.5,4.5,6.5,8.5,10.5],cornerAt=(level,sx,sz)=>at(sx*(1.5-level*.18),levels[level],sz*(2.1-level*.27));
  for(const sx of [-1,1])for(const sz of [-1,1])footing('foot-'+sx+'-'+sz,x+sx*1.5,z+sz*2.1,1.05,1.05);
  for(let j=0;j<5;j++){
   const p=[cornerAt(j,-1,-1),cornerAt(j,1,-1),cornerAt(j,1,1),cornerAt(j,-1,1)],q=p.map((_,i)=>cornerAt(j+1,[-1,1,1,-1][i],[-1,-1,1,1][i]));
   for(let k=0;k<4;k++){
    beam('leg-'+j+'-'+k,p[k],q[k],.095,'steel','compat','structure',true);
    beam('frame-'+j+'-'+k,p[k],p[(k+1)%4],.047,'alloy','standard');
    const a=j%2?p[(k+1)%4]:p[k],b=j%2?q[k]:q[(k+1)%4];beam('brace-'+j+'-'+k,a,b,.041,'steel','standard');
    if(j%2===0){const plate=mix(p[k],q[k],.03);box('gusset-'+j+'-'+k,plate,[.22,.24,.10],'alloy','high');bolt('gusset-bolt-'+j+'-'+k,[plate[0],plate[1],plate[2]+.07],[0,0,1]);}
   }
  }
  for(const sx of [-1,1])for(const sz of [-1,1]){
   const base=cornerAt(5,sx,sz),tip=at(sx*1.65,15.05,sz*2.45);beam('head-outer-'+sx+'-'+sz,base,tip,.08,'steel','compat','structure',true);
   beam('head-inner-'+sx+'-'+sz,cornerAt(3,sx,sz),tip,.049,'alloy','standard');
  }
  // A real open tower head: conductors hang below the beam, above the steel body.
  for(const dx of [-1.85,1.85])for(const y of [15.05,15.7])beam('arm-chord-'+dx+'-'+y,at(dx,y,-2.5),at(dx,y,2.5),.065,'alloy','compat');
  for(let j=0;j<=6;j++){const dz=-2.5+j*5/6;for(const y of [15.05,15.7])beam('arm-tie-'+j+'-'+y,at(-1.85,y,dz),at(1.85,y,dz),.045,'steel','standard');if(j<6)for(const dx of [-1.85,1.85])beam('arm-web-'+j+'-'+dx,at(dx,15.05,dz),at(dx,15.7,dz+5/6),.035,'steel','standard');}
  for(const phase of [-1,0,1]){
   const end=at(corner?phase*.7*(index===2?-1:1):0,13.2,phase*.7);
   beam('hanging-rail-'+phase,at(-1.85,15.05,phase*.7),at(1.85,15.05,phase*.7),.055,'alloy','compat');
   for(const side of corner?[-1,1]:[0])insulator('phase-'+phase+'-'+side,at((corner?phase*.7*(index===2?-1:1):0)+side*.42,15.05,phase*.7),end);
   clamp('phase-'+phase,end);
  }
  // Ladder and identification plate attach to the front lattice, not the live line.
  for(const dx of [-.23,.23])beam('ladder-rail-'+dx,at(dx,.7,2.2),at(dx,9.6,.95),.025,'dark','high');
  for(let j=0;j<28;j++){const t=j/28,p=mix(at(0,.7,2.2),at(0,9.6,.95),t);beam('ladder-step-'+j,[p[0]-.23,p[1],p[2]],[p[0]+.23,p[1],p[2]],.023,'alloy','high');}
  for(const y of [2.5,6.5,8.5]){const zz=2.2-(y-.7)*1.25/8.9,frameZ=2.1-(y-.5)/2*.27;beam('ladder-mount-'+y,at(-.23,y,zz),at(-.23,y,frameZ),.022,'steel','high');beam('ladder-mount-r-'+y,at(.23,y,zz),at(.23,y,frameZ),.022,'steel','high');}
  box('identification-plate',at(0,2.5,1.91),[.62,.4,.055],'label','high');for(const dx of [-.23,.23])bolt('plate-rivet-'+dx,at(dx,2.5,1.96),[0,0,1]);
  beam('earth-mast',at(0,15.7,0),at(0,17.4,0),.055,'alloy','compat');box('earth-clamp',at(0,17.4,0),[.22,.13,.18],'alloy','standard','earth');
 }
 function gantry(x,z,index){
  owner='terminal-'+index;supports.push({id:owner,x,z,type:'terminal-gantry',height:17.4});const at=(dx,y,dz)=>[x+dx,y,z+dz];
  for(const side of [-1,1]){
   footing('base-'+side,x+side*3.2,z,1.6,1.6);
   for(const dx of [-.38,.38])for(const dz of [-.5,.5])beam('leg-'+side+'-'+dx+'-'+dz,at(side*3.2+dx,.5,dz),at(side*3.2+dx,15.05,dz),.065,'steel','compat','structure',true);
   for(let j=0;j<6;j++){const y=.5+j*14.55/6,yy=.5+(j+1)*14.55/6;
    for(const dz of [-.5,.5]){beam('panel-'+side+'-'+j+'-'+dz,at(side*3.2-.38,y,dz),at(side*3.2+.38,yy,dz),.033,'alloy','standard');beam('tie-'+side+'-'+j+'-'+dz,at(side*3.2-.38,y,dz),at(side*3.2+.38,y,dz),.04,'steel','standard');}
    for(const dx of [-.38,.38])beam('side-'+side+'-'+j+'-'+dx,at(side*3.2+dx,y,-.5),at(side*3.2+dx,yy,.5),.033,'steel','standard');
   }
  }
  for(const y of [15.05,15.7])for(const dz of [-.5,.5])beam('beam-chord-'+y+'-'+dz,at(-3.58,y,dz),at(3.58,y,dz),.065,'alloy','compat');
  for(let j=0;j<=6;j++){const dx=-3.58+j*7.16/6;for(const y of [15.05,15.7])beam('beam-tie-'+j+'-'+y,at(dx,y,-.5),at(dx,y,.5),.04,'steel','standard');if(j<6)for(const dz of [-.5,.5])beam('beam-web-'+j+'-'+dz,at(dx,15.05,dz),at(dx+7.16/6,15.7,dz),.035,'steel','standard');}
  for(const phase of [-1,0,1]){const dx=phase*.7,end=at(dx,13.2,0);beam('mount-'+phase,at(dx,15.05,-.5),at(dx,15.05,.5),.055,'alloy','compat');insulator('phase-'+phase,at(dx,15.05,0),end);clamp('phase-'+phase,end);}
  beam('earth-mast',at(0,15.7,0),at(0,17.4,0),.055,'alloy','compat');box('earth-clamp',at(0,17.4,0),[.22,.13,.18],'alloy','standard','earth');
 }
 plan.towers.forEach((p,i)=>tower(p.x,p.z,i));gantry(56,-18,0);gantry(78,-10,1);
 const path=sagPath(plan.path),phasePaths=[-.7,0,.7].map(d=>sagPath([[56+d,6,-18],[56+d,13.2,-18],[56+d,13.2,-40.5+d],[67,13.2,-40.5+d],[78-d,13.2,-40.5+d],[78-d,13.2,-10],[78-d,8.6,-10]])),earthPath=sagPath([[56,17.4,-18],...plan.towers.map(p=>[p.x,17.4,p.z]),[78,17.4,-10]]);
 return {parts,supports,attachments,path,phasePaths,earthPath,origin:[67,0,-40.5],units:'compressed exhibition coordinates',nominalVoltageKV:220};
}
return {create,sagPath,mix,dist};
});
