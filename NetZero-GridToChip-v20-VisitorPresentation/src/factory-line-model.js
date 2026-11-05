/* One representative ceramic-treated aluminium wire line. Display geometry only:
 * no process recipe, yield, throughput, energy intensity or electrical rating. */
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;root.NZ_FACTORY_LINE=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const TAU=Math.PI*2,EPS=1e-8,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i])),mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const CONFIG=Object.freeze({footprint:[36,19.8],height:7.5,wireY:3.2,wireZ:0,liquidY:3.48,tankWallTop:3.96,wireRadius:.028,payoutRadius:1.2,takeupRadius:1.2,displaySpeed:.6,traverseHalfSpan:.59,traverseCycleLength:9.6,roofLift:8,roofSlide:-4});
function roundedPath(points,radius=.26){
 const segments=[],rollers=[];let last=points[0].slice();
 const line=(a,b)=>{if(dist(a,b)>EPS)segments.push({kind:'line',a:a.slice(),b:b.slice(),length:dist(a,b)});};
 for(let i=1;i<points.length-1;i++){
  const a=points[i-1],b=points[i],c=points[i+1],l1=dist(a,b),l2=dist(b,c),u=b.map((v,j)=>(v-a[j])/l1),v=c.map((n,j)=>(n-b[j])/l2);
  const turn=Math.atan2(u[0]*v[1]-u[1]*v[0],u[0]*v[0]+u[1]*v[1]);
  if(Math.abs(turn)<EPS){line(last,b);last=b.slice();continue;}
  const r=Math.min(radius,Math.min(l1,l2)*.35/Math.tan(Math.abs(turn)/2)),trim=r*Math.tan(Math.abs(turn)/2),sign=Math.sign(turn);
  const start=b.map((n,j)=>n-u[j]*trim),end=b.map((n,j)=>n+v[j]*trim),center=[start[0]-u[1]*sign*r,start[1]+u[0]*sign*r,0],angle=Math.atan2(start[1]-center[1],start[0]-center[0]);
  line(last,start);const arc={kind:'arc',a:start,b:end,center,radius:r,angle,turn,length:Math.abs(turn)*r};segments.push(arc);rollers.push({id:'guide-'+i,center,radius:r,turn,segment:segments.length-1});last=end;
 }
 line(last,points[points.length-1]);return {segments,rollers};
}
function pointOn(s,t){if(s.kind==='line')return mix(s.a,s.b,t);const a=s.angle+s.turn*t;return [s.center[0]+Math.cos(a)*s.radius,s.center[1]+Math.sin(a)*s.radius,s.center[2]];}
function pathAt(data,traverse=0){return data.path.segments.map(segment=>({...segment,a:segment.a.slice(),b:segment.b.slice()}));}
function sample(segments,distance){const total=segments.reduce((n,s)=>n+s.length,0);let d=clamp(distance,0,total);for(const s of segments){if(d<=s.length+EPS)return pointOn(s,clamp(d/s.length,0,1));d-=s.length;}return segments[segments.length-1].b.slice();}
function create(){
 const parts=[],ports={},connections=[],baths=[],assemblies={fixed:[0,0,0],roof:[0,0,0],payoutRotor:[-13.5,2,0],takeupRotor:[13.5,2,0],takeupCarriage:[13.5,0,0],traverse:[12,3.2,0]},colors={floor:0xd9e0d9,white:0xf0f3eb,shell:0xd5e0d9,steel:0x718a84,alloy:0xb0bfb6,dark:0x2b4542,teal:0x237e70,wire:0xbbc7c4,ceramic:0xe0d8bb,water:0x749e91,glass:0x789d97,pv:0x263e51,copper:0xb2915b,red:0x9a5b50,yellow:0xbba77a};
 const put=(name,type,p,size,mat='steel',group='fixed',tier='standard',extra={})=>{parts.push({name,type,p,size,mat,group,tier,...extra});return parts[parts.length-1];};
 const box=(n,p,s,m='steel',g='fixed',t='standard')=>put(n,'box',p,s,m,g,t);
 const cyl=(n,p,r,h,m='steel',g='fixed',t='standard',axis=[0,1,0])=>put(n,'cyl',p,[r,h],m,g,t,{axis});
 const ring=(n,p,r,t=.025,m='alloy',g='fixed',tier='high',axis=[0,0,1])=>put(n,'ring',p,[r,t],m,g,tier,{axis});
 const rod=(n,a,b,r=.04,m='steel',g='fixed',t='standard')=>put(n,'rod',a,[r],m,g,t,{b});
 const bolt=(n,p,axis=[0,1,0],g='fixed',r=.045)=>cyl(n,p,r,.055,'dark',g,'high',axis);
 function cable(n,points,r=.026,m='dark',g='fixed'){put(n,'tube',points[0],[r],m,g,'standard',{points});connections.push({name:n,points,r,group:g});}
 function foot(n,x,z,w=.6,d=.6,y=.36){box(n+' pad',[x,y-.06,z],[w,.12,d],'alloy');cyl(n+' levelling screw',[x,y+.08,z],.065,.17,'steel');for(const dx of [-w*.32,w*.32])for(const dz of [-d*.32,d*.32])bolt(n+' anchor '+dx+' '+dz,[x+dx,y+.025,z+dz]);}
 function motor(n,p,g='fixed'){cyl(n+' body',p,.3,.72,'teal',g,'standard',[1,0,0]);for(let i=0;i<6;i++)cyl(n+' cooling rib '+i,[p[0]-.27+i*.11,p[1],p[2]],.33,.025,'steel',g,'high',[1,0,0]);box(n+' terminal',[p[0],p[1]+.34,p[2]],[.27,.16,.25],'dark',g);}
 function grille(n,x,y,z,w,h,g='fixed'){box(n+' shadow',[x,y,z],[w,h,.035],'dark',g);for(let j=0;j<7;j++)box(n+' louvre '+j,[x,y-h/2+(j+.5)*h/7,z+.04],[w-.04,.036,.06],'alloy',g,'high');}
 // One original-proportion workcell. The adapter owns the only hall, roof and PV.
 for(const z of [-2.7,2.75]){box('Drain channel '+z,[0,.375,z],[30,.025,.23],'dark');for(let j=0;j<50;j++)box('Drain grate '+z+' '+j,[-14.7+j*.6,.399,z],[.045,.022,.23],'alloy','fixed','high');}
 for(const z of [3.76,6.64])box('Cell operator aisle edge '+z,[0,.389,z],[33,.014,.06],'yellow');
 // Main machine bed, low cross members and real levelling feet.
 for(const z of [-.9,.9])box('Continuous machine bed '+z,[0,.65,z],[30.5,.28,.15],'steel');
 for(const x of [-14.8,-11,-8,-4,0,4,8,11,14.8]){box('Bed cross member '+x,[x,.65,0],[.14,.22,2.1],'alloy');for(const z of [-.9,.9])foot('Bed foot '+x+' '+z,x,z,.45,.45);}
 function reel(name,x,mat,group){
  const support=group==='takeupRotor'?'takeupCarriage':'fixed',p=[x,2,0];for(const z of [-1.16,1.16]){box(name+' pedestal '+z,[x,1.31,z],[.55,1.2,.30],'steel',support);box(name+' bearing shoe '+z,[x,1.94,z],[.65,.25,.35],'alloy',support);ring(name+' bearing '+z,[x,2,z],.22,.075,'alloy',support,'standard');for(const dx of [-.22,.22])bolt(name+' bearing fixing '+z+dx,[x+dx,2.09,z],[0,1,0],support);}
  rod(name+' spindle',[x,2,-1.45],[x,2,1.45],.125,'alloy',group);
  cyl(name+' hub',p,.58,1.6,'dark',group,'standard',[0,0,1]);cyl(name+' wound wire pack',p,CONFIG.payoutRadius-CONFIG.wireRadius,1.36,mat,group,'standard',[0,0,1]);
  for(const z of [-.83,.83]){cyl(name+' flange '+z,[x,2,z],1.37,.12,'steel',group,'standard',[0,0,1]);ring(name+' flange lip '+z,[x,2,z+Math.sign(z)*.065],1.32,.035,'alloy',group,'standard');ring(name+' hub collar '+z,[x,2,z+Math.sign(z)*.08],.27,.06,'alloy',group,'standard');for(let k=0;k<8;k++){const a=k*TAU/8;bolt(name+' flange bolt '+z+' '+k,[x+Math.cos(a)*.89,2+Math.sin(a)*.89,z+Math.sign(z)*.09],[0,0,1],group);rod(name+' flange spoke '+z+' '+k,[x+Math.cos(a)*.3,2+Math.sin(a)*.3,z+Math.sign(z)*.067],[x+Math.cos(a)*1.24,2+Math.sin(a)*1.24,z+Math.sign(z)*.067],.026,'alloy',group,'high');}}
  for(let j=0;j<24;j++)ring(name+' wire layer '+j,[x,2,-.65+j*1.3/23],CONFIG.payoutRadius-CONFIG.wireRadius-.014,.014,mat,group,'high');
  cyl(name+' shaft lock',[x,2,1.43], .2,.12,'dark',support,'standard',[0,0,1]);box(name+' brake housing',[x,2,-1.48],[.55,.6,.32],'teal',support);
  const terminalX=x+(x<0?1:-1);cable(name+' drive cable',[[x,2,-1.65],[x,.9,-1.65],[terminalX,.9,-1.65],[terminalX,.9,1.7]],.035,'dark',support);
 }
 reel('Aluminium payout',-13.5,'wire','payoutRotor');reel('Ceramic wire takeup',13.5,'ceramic','takeupRotor');
 const controlPoints=[-13.5,-10.7,-10,-9.25,-8.35,-1.95,-.35,5.25,7.8,9.2,10.6,12.23,13.5].map(x=>[x,CONFIG.wireY,CONFIG.wireZ]),path=roundedPath(controlPoints);
 // Contact rollers touch this straight strand; none forces a submerged detour.
 for(const [id,x,side,radius] of [['tension-entry',-10.7,1,.28],['tension-pressure',-10,-1,.28],['tension-exit',-9.25,1,.28],['traction-entry',7.8,1,.45],['traction-entry-pressure',7.8,-1,.45],['traction-exit',9.2,1,.45],['traction-exit-pressure',9.2,-1,.45]]){
  const center=[x,CONFIG.wireY-side*radius,0],group='roller-'+id,roller={id,center,radius,turn:-side,group,contact:[x,CONFIG.wireY,0]};
  path.rollers.push(roller);assemblies[group]=center.slice();
  cyl(id+' grooved roller',center,radius-CONFIG.wireRadius,.34,'alloy',group,'standard',[0,0,1]);
  for(const dz of [-.20,.20]){ring(id+' cheek '+dz,[x,center[1],dz],radius+.035,.025,'steel',group,'high');rod(id+' support '+dz,[x,.82,dz*2],[x,center[1],dz*2],.045,'steel');box(id+' bearing block '+dz,[x,center[1],dz*2],[.16,.16,.13],'dark');}
  rod(id+' axle',[x,center[1],-.5],[x,center[1],.5],.055,'steel');
 }
 // Tension station: straight contact rollers and two guide rods hold the sensor head.
 box('Tension station soleplate',[-10,1.05,0],[2.2,.18,2],'steel');
 for(const x of [-10.7,-9.25]){for(const z of [-.65,.65])rod('Tension guide post '+x+z,[x,1.14,z],[x,3.6,z],.055,'alloy');rod('Tension roll axle '+x,[x,2.92,-.7],[x,2.92,.7],.055);}
 box('Tension upper crossbar',[-10,3.55,0],[2,.12,1.5],'alloy');box('Tension load cell',[-10,3.37,.5],[.45,.2,.28],'teal');ring('Tension adjustment handwheel',[-10,3.8,.58],.18,.026,'alloy','fixed','high',[0,1,0]);rod('Tension adjustment stem',[-10,3.55,.58],[-10,3.8,.58],.045,'alloy');
 cable('Tension instrumentation',[[-10,3.37,.65],[-10,1.2,.65],[-10,.94,1.9],[-4,.94,1.9],[-4,1.4,4.425]],.021);
 function bath(n,x,w,liquid){
  const wallBottom=1.07,windowBottom=2.68,windowTop=3.58,top=CONFIG.tankWallTop,portHalf=.325;
  const bathData={name:n,x,width:w,wireY:CONFIG.wireY,liquidY:CONFIG.liquidY,wallTop:top,ports:[],windows:[]};baths.push(bathData);
  box(n+' base',[x,.98,0],[w,.18,2.2],'steel');box(n+' spill tray',[x,.85,0],[w+.35,.08,2.55],'dark');
  for(const z of [-1.03,1.03]){
   box(n+' lower sidewall '+z,[x,(wallBottom+windowBottom)/2,z],[w,windowBottom-wallBottom,.12],'shell');
   box(n+' upper side beam '+z,[x,(windowTop+top)/2,z],[w,top-windowTop,.12],'shell');
   box(n+' top rim '+z,[x,top+.05,z],[w+.1,.10,.18],'alloy');
   const glassName=n+' observation glass '+z;
   box(glassName,[x,(windowBottom+windowTop)/2,z+Math.sign(z)*.025],[w-.32,windowTop-windowBottom-.08,.035],'glass');
   bathData.windows.push({part:glassName,side:z,yMin:windowBottom,yMax:windowTop,xMin:x-w/2+.16,xMax:x+w/2-.16});
   for(const dx of [-w/2+.08,-w/6,w/6,w/2-.08]){
    box(n+' window mullion '+z+' '+dx,[x+dx,(windowBottom+windowTop)/2,z],[.09,windowTop-windowBottom,.14],'alloy');
    for(const yy of [windowBottom+.05,windowTop-.05])bolt(n+' window fixing '+z+' '+dx+' '+yy,[x+dx,yy,z+Math.sign(z)*.085],[0,0,1]);
   }
   for(const yy of [windowBottom,windowTop])box(n+' window sill '+z+' '+yy,[x,yy,z+Math.sign(z)*.01],[w,.06,.16],'alloy');
  }
  for(const sign of [-1,1]){
   const xx=x+sign*w/2,lo=CONFIG.wireY-portHalf,hi=CONFIG.wireY+portHalf,prefix=n+' '+(sign<0?'inlet':'outlet'),wallParts=[];
   const wall=(suffix,p,size)=>{const name=prefix+' wall '+suffix;wallParts.push(name);box(name,p,size,'shell');};
   // Four separate wall blocks surround an actual aperture. No solid cap crosses the wire.
   wall('below',[xx,(wallBottom+lo)/2,0],[.12,lo-wallBottom,2.06]);
   wall('above',[xx,(hi+top)/2,0],[.12,top-hi,2.06]);
   for(const side of [-1,1])wall('side '+side,[xx,CONFIG.wireY,side*(portHalf+1.03)/2],[.12,2*portHalf,1.03-portHalf]);
   box(prefix+' end rim',[xx,top+.05,0],[.18,.10,2.2],'alloy');
   const center=[xx,CONFIG.wireY,0];
   ring(prefix+' gland flange',center,.26,.035,'alloy','fixed','standard',[1,0,0]);
   ring(prefix+' annular seal',[xx+sign*.06,CONFIG.wireY,0],.18,.04,'dark','fixed','standard',[1,0,0]);
   ring(prefix+' ceramic guide',[xx+sign*.12,CONFIG.wireY,0],.115,.025,'ceramic','fixed','standard',[1,0,0]);
   for(let j=0;j<6;j++){const a=j*TAU/6;bolt(prefix+' gland fixing '+j,[xx+sign*.05,CONFIG.wireY+Math.cos(a)*.265,Math.sin(a)*.265],[1,0,0]);}
   const cx=xx+sign*.40;
   box(prefix+' collection cup bottom',[cx,2.73,0],[.60,.06,.85],'steel');
   for(const zz of [-.4,.4])box(prefix+' collection cup side '+zz,[cx,2.89,zz],[.60,.26,.05],'alloy');
   for(const dx of [-.28,.28])box(prefix+' collection cup end '+dx,[cx+dx,2.89,0],[.04,.26,.8],'alloy');
   const collection=[cx,2.70,-.31],returnAt=[xx,1.35,-1.1];
   cable(prefix+' collection return',[collection,[cx,1.35,-.31],[cx,1.35,-1.55],[xx,1.35,-1.55],returnAt],.045,'teal');
   ring(prefix+' return collar',returnAt,.075,.018,'alloy','fixed','standard',[0,0,1]);
   bathData.ports.push({name:prefix,center,axis:[1,0,0],clearRadius:.09,wallParts,collection,returnAt});
  }
  box(n+' liquid volume',[x,(1.08+CONFIG.liquidY)/2,0],[w-.16,CONFIG.liquidY-1.08,1.91],liquid);
  box(n+' liquid surface',[x,CONFIG.liquidY,0],[w-.16,.025,1.91],liquid);
  for(const xx of [x-w*.35,x+w*.35])for(const z of [-.85,.85])box(n+' leg '+xx+z,[xx,.79,z],[.12,.30,.12],'steel');
  for(const xx of [x-w*.34,x+w*.34])box(n+' removable cover '+xx,[xx,top+.11,-.79],[w*.25,.075,.38],'alloy');
  for(let j=0;j<=4;j++){const xx=x-w/2+j*w/4;box(n+' side rib '+j,[xx,1.86,-1.12],[.075,1.56,.065],'alloy');}
  box(n+' level gauge backing',[x+w*.37,2.24,1.12],[.16,.96,.05],'dark');
  box(n+' level gauge glass',[x+w*.37,2.24,1.16],[.08,.84,.025],'glass');
 }
 bath('Electrolyte treatment tank',-5.15,6.4,'water');bath('Wash tank',2.45,5.6,'water');
 // Conductive contact is a representative entry fixture; no voltage or chemistry is implied.
 box('Treatment contact saddle',[-7.91,3.07,0],[.32,.204,.52],'copper');box('Treatment shield rail',[-5.15,3.9,-.6],[6.1,.12,.12],'steel');
 for(const x of [-7.9,-2.4])rod('Extraction hood bracket '+x,[x,2.5,-1.25],[x,4.43,-1.25],.055);
 box('Extraction hood',[-5.15,4.45,-.7],[6,.16,1.35],'shell');cable('Hood extraction duct',[[-5.15,4.53,-.7],[-5.15,4.95,-.7],[-5.15,4.95,-9.57]],.18,'alloy');cyl('Extraction wall flange',[-5.15,4.95,-9.61],.28,.08,'alloy','fixed','standard',[0,0,1]);
 for(const z of [-3.4,-6.8]){rod('Duct support crossbar '+z,[-5.55,4.72,z],[-4.75,4.72,z],.045,'steel');for(const x of [-5.55,-4.75]){rod('Duct support upright '+x+z,[x,.6,z],[x,4.72,z],.03,'steel');foot('Duct stand '+x+z,x,z,.36,.36);}}
 for(const x of [.7,4.2]){rod('Wash spray manifold '+x,[x,3.83,-.77],[x,3.83,.77],.07,'alloy');for(const z of [-.6,0,.6])cyl('Wash nozzle '+x+z,[x,3.68,z],.045,.13,'steel');}
 // Pump/filter skid sits beside the baths, with all routes on the service side.
 box('Circulation skid',[-4.8,.55,-4.2],[5.4,.25,2.7],'steel');motor('Circulation motor',[-5.4,1.1,-4.3]);cyl('Pump volute',[-4.7,1.1,-4.3],.37,.34,'alloy','fixed','standard',[1,0,0]);box('Pump feet',[-4.95,.8,-4.3],[1.45,.15,.7],'alloy');
 cyl('Filter housing',[-3.4,1.4,-4.3],.37,1.25,'shell');cyl('Filter lid',[-3.4,2.07,-4.3],.42,.09,'alloy');for(let j=0;j<8;j++){const a=j*TAU/8;bolt('Filter cover bolt '+j,[-3.4+Math.cos(a)*.32,2.14,-4.3+Math.sin(a)*.32]);}
 ports.treatmentSupply=[-6.6,1.45,-1.1];ports.treatmentReturn=[-3.6,1.45,-1.1];ports.filterIn=[-3.4,1.2,-4.67];ports.filterOut=[-3.4,1.85,-3.93];ports.pumpIn=[-4.53,1.1,-4.3];ports.pumpOut=[-4.7,1.47,-4.3];
 cable('Electrolyte tank return',[ports.treatmentReturn,[-3.6,1.45,-2.9],[-2.6,1.45,-2.9],[-2.6,1.2,-4.67],ports.filterIn],.067,'teal');
 cable('Filtered suction',[ports.filterOut,[-4.05,1.85,-3.93],[-4.05,1.1,-3.93],[-4.05,1.1,-4.3],ports.pumpIn],.067,'alloy');
 cable('Treatment feed',[ports.pumpOut,[-4.7,2.5,-4.3],[-6.6,2.5,-4.3],[-6.6,2.5,-2.1],[-6.6,1.45,-2.1],ports.treatmentSupply],.067,'teal');
 box('Wash water service terminal',[5.8,1.2,-6],[.65,1.6,.4],'shell');
 for(const y of [.45,.9])cyl('Wash water terminal coupling '+y,[5.8,y,-5.76],.10,.08,'alloy','fixed','standard',[0,0,1]);
 cable('Wash fresh water',[[5.8,.9,-5.72],[5.8,.9,-2.0],[.7,.9,-2],[.7,3.83,-2],[.7,3.83,-.77]],.05,'alloy');
 cable('Wash second manifold',[[.7,3.83,-1.5],[4.2,3.83,-1.5],[4.2,3.83,-.77]],.05,'alloy');
 cable('Wash drain',[[2.45,1.12,-1.1],[2.45,1.12,-2.4],[5.8,1.12,-2.4],[5.8,.45,-2.4],[5.8,.45,-5.72]],.065,'steel');
 for(const x of [-6.6,-4.7]){cyl('Valve bonnet '+x,[x,2.6,-4.3],.11,.15,'steel');rod('Valve spindle '+x,[x,2.65,-4.3],[x,2.95,-4.3],.035);ring('Valve handwheel '+x,[x,2.99,-4.3],.18,.027,'alloy','fixed','high',[0,1,0]);}
 for(const x of [-6.6,-4.7,-2.6]){rod('Pipe support '+x,[x,.6,-3.0],[x,1.4,-3],.04);box('Pipe support pad '+x,[x,.55,-3],[.36,.10,.45],'alloy');}
 // Fixed straight guide and axially translating takeup: the strand never traverses.
 box('Traction drive soleplate',[8.4,.98,0],[3,.22,2.6],'steel');box('Traction reducer',[8.4,1.5,-1.1],[1.1,.9,.62],'shell');motor('Traction motor',[8.6,1.6,-1.8]);
 for(const x of [7.7,9.3])for(const z of [-.85,.85])rod('Traction guard post '+x+z,[x,1.1,z],[x,3.65,z],.045,'alloy');
 for(const z of [-.85,.85])rod('Traction guard rail '+z,[7.7,3.65,z],[9.3,3.65,z],.045,'alloy');
 for(const y of [2.78,3.6])rod('Traverse guide rail '+y,[12,y,-1.0],[12,y,1.0],.055,'alloy');rod('Traverse lead screw',[11.76,2.78,-1.0],[11.76,2.78,1.0],.042,'steel');
 for(const z of [-1.02,1.02]){box('Traverse end block '+z,[12,3.2,z],[.65,1.0,.16],'steel');rod('Traverse stand '+z,[12,.83,z],[12,2.7,z],.08,'steel');}
 for(const y of [2.93,3.47])box('Traverse carriage bearing '+y,[12,y,0],[.38,.20,.29],'teal','traverse');
 for(const z of [-.19,.19])box('Traverse carriage side bridge '+z,[12,3.2,z],[.38,.34,.09],'teal','traverse');
 ring('Traverse ceramic eyelet',[12.23,3.2,0],.10,.025,'ceramic','traverse','standard',[1,0,0]);
 for(const x of [12.7,14.3]){rod('Takeup fixed axial guide '+x,[x,.44,-2.35],[x,.44,2.35],.045,'alloy');for(const z of [-2.4,2.4])box('Takeup rail end '+x+' '+z,[x,.44,z],[.24,.18,.18],'steel');for(const z of [-1.1,1.1])box('Takeup sliding bearing '+x+' '+z,[x,.54,z],[.28,.10,.30],'teal','takeupCarriage');}
 box('Takeup moving support plate',[13.5,.65,0],[2.4,.12,3.7],'alloy','takeupCarriage');rod('Takeup axial lead screw',[13.5,.47,-2.35],[13.5,.47,2.35],.035,'steel');box('Takeup screw nut',[13.5,.56,0],[.24,.18,.24],'dark','takeupCarriage');
 box('Takeup motor soleplate',[14.7,1.0,-1.7],[1.6,.2,1.0],'alloy','takeupCarriage');motor('Takeup drive',[14.7,1.37,-1.7],'takeupCarriage');
 // PLC, HMI and closed cable tray. HMI has no invented numeric process readout.
 box('PLC plinth',[-3.7,.62,4.9],[2.3,.35,1.1],'steel');box('PLC enclosure',[-3.7,1.98,4.9],[2.12,2.38,.95],'shell');box('PLC front door',[-3.7,1.98,5.405],[1.98,2.2,.06],'white');box('PLC seam',[-3.2,1.98,5.45],[.028,2.15,.02],'steel');
 for(const y of [1.18,2.8])box('PLC hinge '+y,[-4.69,y,5.46],[.09,.23,.09],'alloy','fixed','high');box('PLC handle',[-2.94,2.12,5.48],[.06,.35,.06],'dark');grille('PLC cooling grille',-3.8,1.22,5.465,1.4,.4);
 rod('HMI pedestal',[-.8,.4,4.8],[-.8,2.68,4.8],.12,'steel');box('HMI mount',[-.8,.45,4.8],[.8,.13,.7],'alloy');box('HMI housing',[-.8,2.91,4.8],[1.4,.95,.23],'dark');box('HMI glass',[-.8,2.98,4.93],[1.12,.61,.035],'glass');
 for(let j=0;j<3;j++)box('HMI process status '+j,[-1.16+j*.35,3.05,4.956],[.21,.12,.012],'teal');for(const x of [-1.2,-.45])cyl('HMI button '+x,[x,2.63,4.96],.055,.035,'alloy','fixed','standard',[0,0,1]);cyl('HMI emergency stop',[-.75,2.63,4.98],.085,.06,'red','fixed','standard',[0,0,1]);
 rod('PLC stacklight stalk',[-2.85,3.18,4.9],[-2.85,3.58,4.9],.035);for(let j=0;j<3;j++)cyl('PLC stacklight '+j,[-2.85,3.58+j*.13,4.9],.08,.11,j===0?'teal':j===1?'yellow':'red');
 box('Service cable tray',[0,.9,2.1],[28,.16,.28],'steel');box('Service cable tray cover',[0,1.0,2.1],[28.1,.04,.31],'alloy','fixed','high');
 for(const x of [-12,-6,0,6,12]){box('Junction box '+x,[x,1.2,2.1],[.36,.30,.25],'shell');rod('Tray bracket '+x,[x,.45,2.1],[x,.81,2.1],.035);cable('Sensor lead '+x,[[x,1.3,.55],[x,1.1,.55],[x,1.1,1.7],[x,1.2,1.975]],.018);}
 cable('PLC field cable',[[-3.7,1.4,4.425],[-3.7,.75,4.425],[-3.7,.75,2.1],[-3.7,.9,2.1]],.047);cable('HMI data cable',[[-.8,2.6,4.68],[-.8,.7,4.68],[-2.6,.7,4.68],[-2.6,1.5,4.68],[-2.64,1.5,4.68]],.023);
 cable('Protective earth',[[-4.5,.78,4.9],[-4.5,.45,4.9],[-4.5,.45,1.1],[-5,.65,.975]],.026,'copper');
 // Staging is inside this existing hall, not new loads or extra plant capacity.
 for(const side of [-1,1]){const x=side*14.4,z=-6;box('Spool cradle '+side,[x,.59,z],[3,.22,2.1],'steel');for(const dx of [-1,1])box('Cradle chock '+side+dx,[x+dx,.83,z],[.2,.35,1.7],'alloy');cyl('Staged empty reel hub '+side,[x,1.26,z],.36,1.3,'dark','fixed','standard',[0,0,1]);for(const dz of [-.7,.7])cyl('Staged reel flange '+side+dz,[x,1.26,z+dz],.76,.10,'alloy','fixed','standard',[0,0,1]);for(const dz of [-1.35,1.35])box('Staging floor edge '+side+dz,[x,.39,z+dz],[3.2,.025,.055],'yellow');}
 box('Maintenance trolley deck',[7,.88,-6],[2.3,.12,1.3],'steel');for(const x of [6.15,7.85])for(const z of [-6.45,-5.55])cyl('Trolley caster '+x+z,[x,.64,z],.15,.12,'dark','fixed','high',[0,0,1]);for(const x of [6.0,8.0])rod('Trolley upright '+x,[x,.9,-6.5],[x,1.6,-6.5],.035);rod('Trolley handle',[6,1.6,-6.5],[8,1.6,-6.5],.035);box('Maintenance crate',[7,1.1,-6],[1.3,.36,.8],'shell');
 ports.lineFeed=[17.6,.94,2.1];cable('Workcell service feed',[ports.lineFeed,[14,.94,2.1]],.055,'dark');box('Workcell feed gland',[17.55,.94,2.1],[.16,.3,.36],'alloy');
 return {kind:'standalone-workcell',config:CONFIG,parts,colors,assemblies,ports,connections,baths,path,processOrder:['payout','guides-tension','electrolyte-treatment','wash','traction','traverse-takeup'],claims:'代表性连续线与尺寸示意；不由图示部件推算产量、能耗或工艺参数。'};
}
function state(){return {distance:0,roof:0,open:false,mode:'overview'};}
function pose(s,data){const z=Math.sin(s.distance/CONFIG.traverseCycleLength*TAU)*CONFIG.traverseHalfSpan;return {distance:s.distance,traverse:0,reelTraverse:z,movingTranslations:{takeupRotor:[0,0,z],takeupCarriage:[0,0,z]},payoutAngle:-s.distance/CONFIG.payoutRadius,takeupAngle:-s.distance/CONFIG.takeupRadius,rollerAngles:data?data.path.rollers.map(r=>({group:r.group,angle:Math.sign(r.turn)*s.distance/r.radius})):[],roof:[0,s.roof*CONFIG.roofLift,s.roof*CONFIG.roofSlide],path:data?pathAt(data):null};}
function advance(s,dt,options={}){const paused=options.paused||options.reducedMotion;if(!paused&&Number.isFinite(dt)&&dt>0){const step=Math.min(dt,.2);if(options.running!==false)s.distance+=step*CONFIG.displaySpeed;s.roof+=(Number(s.open)-s.roof)*(1-Math.exp(-step*3.6));if(Math.abs(s.roof-Number(s.open))<1e-5)s.roof=Number(s.open);}return s;}
function reset(s){Object.assign(s,state());return s;}
function audit(data=create()){
 const checks={},names=data.parts.map(p=>p.name),finite=v=>typeof v==='number'?Number.isFinite(v):Array.isArray(v)?v.every(finite):true,segments=pathAt(data);
 checks.uniqueParts=new Set(names).size===names.length;
 checks.finiteGeometry=data.parts.every(p=>finite(p.p)&&finite(p.size)&&finite(p.b||[])&&finite(p.points||[]));
 checks.purposefulDetail=data.parts.length>600;
 checks.singleContinuousWire=segments.every((s,i)=>!i||dist(segments[i-1].b,s.a)<EPS);
 checks.horizontalWire=segments.every(s=>s.kind==='line'&&s.a[1]===CONFIG.wireY&&s.b[1]===CONFIG.wireY&&s.a[2]===0&&s.b[2]===0);
 checks.guideTangency=data.path.rollers.every(r=>Math.abs(dist(r.contact,r.center)-r.radius)<EPS);
 checks.payoutTangent=dist(segments[0].a,[-13.5,3.2,0])<EPS;
 checks.takeupTangent=dist(segments[segments.length-1].b,[13.5,3.2,0])<EPS;
 checks.noDuplicatedHall=data.parts.every(p=>p.group!=='roof'&&!/Workshop floor|insulated wall|Steel column|PV /.test(p.name));
 checks.displayDimensions=data.parts.filter(p=>p.type==='box').every(p=>Math.abs(p.p[0])+p.size[0]/2<=18&&Math.abs(p.p[2])+p.size[2]/2<=9.9);
 checks.immersedStraightWire=data.baths.every(b=>b.liquidY>CONFIG.wireY+CONFIG.wireRadius&&b.wallTop>b.liquidY);
 checks.actualWallApertures=data.baths.every(b=>b.ports.every(port=>port.wallParts.length===4&&port.clearRadius>CONFIG.wireRadius&&port.wallParts.every(name=>{const p=data.parts.find(p=>p.name===name);return Math.abs(p.p[1]-CONFIG.wireY)>p.size[1]/2+CONFIG.wireRadius-EPS||Math.abs(p.p[2])>p.size[2]/2+CONFIG.wireRadius-EPS;})));
 checks.observationWindows=data.baths.every(b=>b.windows.length===2&&b.windows.every(w=>w.yMin<CONFIG.wireY&&w.yMax>CONFIG.wireY));
 checks.collectionReturns=data.baths.every(b=>b.ports.every(p=>data.connections.some(c=>c.name===p.name+' collection return'&&dist(c.points[0],p.collection)<EPS&&dist(c.points[c.points.length-1],p.returnAt)<EPS)));
 checks.processOrder=data.processOrder.join('>')==='payout>guides-tension>electrolyte-treatment>wash>traction>traverse-takeup';
 const s=state();s.open=true;advance(s,.1);const p=pose(s,data);
 checks.sharedMotion=Math.abs(-p.payoutAngle*CONFIG.payoutRadius-s.distance)<EPS&&Math.abs(-p.takeupAngle*CONFIG.takeupRadius-s.distance)<EPS;
 checks.fixedWireDuringWinding=p.traverse===0&&JSON.stringify(p.path)===JSON.stringify(pathAt(data))&&p.movingTranslations.takeupRotor[2]===p.movingTranslations.takeupCarriage[2];
 const pack=data.parts.find(p=>p.name==='Ceramic wire takeup wound wire pack'),screw=data.parts.find(p=>p.name==='Traverse lead screw');
 checks.takeupStrokeWithinWinding=pack&&CONFIG.traverseHalfSpan+CONFIG.wireRadius<pack.size[1]/2&&Math.abs(pack.p[1]+pack.size[0]+CONFIG.wireRadius-CONFIG.wireY)<EPS;
 checks.fixedGuideScrewClearsWire=screw&&Math.abs(screw.p[1]-CONFIG.wireY)>screw.size[0]+CONFIG.wireRadius;
 const before=JSON.stringify(s);advance(s,1,{paused:true});checks.pauseIsStill=before===JSON.stringify(s);advance(s,1,{reducedMotion:true});checks.reducedMotionIsStill=before===JSON.stringify(s);reset(s);checks.resetCloses=s.roof===0&&!s.open&&s.distance===0;
 return {passed:Object.values(checks).every(Boolean),checks,partCount:data.parts.length,wireLength:segments.reduce((n,s)=>n+s.length,0),guideCount:data.path.rollers.length,roofPVModules:0};
}
return {CONFIG,create,state,advance,pose,reset,roundedPath,pointOn,pathAt,sample,audit};
});
