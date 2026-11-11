/* v21.2 exterior fleet. Metres, Y up, nose +Z. No business/telemetry state. */
(function(root,factory){const m=factory();if(typeof module==='object'&&module.exports)module.exports=m;if(root)root.NZ_VEHICLE_MODEL=m;})(typeof window!=='undefined'?window:null,function(){
'use strict';
const specs={model3:{title:'特斯拉 Model 3 · 外观示意',w:1.848,l:4.72,h:1.442,wb:2.875,r:.33,green:true},yu7:{title:'小米 YU7 · 外观示意',w:1.996,l:5,h:1.61,wb:3,r:.37,green:true},li:{title:'理想L系列 · 外观示意',w:2,l:5.22,h:1.8,wb:3.1,r:.40,green:true},ice:{title:'普通燃油轿车 · 外观示意',w:1.85,l:4.7,h:1.48,wb:2.8,r:.34,green:false},bus:{title:'园区电动大巴',w:2.55,l:11.8,h:3.4,wb:5.8,r:.49,green:true},fire:{title:'消防救援车',w:2.5,l:8.4,h:3.1,wb:4.9,r:.48,green:false},truck:{title:'物流厢式货车',w:2.5,l:10.4,h:3.8,wb:6,r:.48,green:false},tanker:{title:'化工区专用槽车',w:2.6,l:10,h:3.4,wb:5.9,r:.48,green:false}};
function create(kind){
 const c=specs[kind];if(!c)throw Error('Unknown vehicle '+kind);
 const parts=[],W=c.w/2,L=c.l/2,heavy=!['model3','yu7','li','ice'].includes(kind);
 const add=(name,type,p,size,mat='paint',tier='base',extra={})=>parts.push({name,type,p,size,mat,tier,...extra});
 const box=(n,p,s,mat='paint',tier='base',rounded=false)=>add(n,rounded?'roundbox':'box',p,s,mat,tier);
 const cyl=(n,p,r,h,mat='alloy',axis=[0,1,0],tier='fine')=>add(n,'cyl',p,[r,h],mat,tier,{axis});
 const rod=(n,a,b,r=.009,mat='trim',tier='fine')=>add(n,'rod',a,[r],mat,tier,{b});
 const panel=(n,vertices,normal,mat='glass',tier='base')=>add(n,'panel',[0,0,0],[],mat,tier,{vertices,normal});
 const path=(n,points,r=.008,mat='trim',tier='fine')=>{for(let i=1;i<points.length;i++)rod(n+' '+i,points[i-1],points[i],r,mat,tier);};
 const ring=(n,p,r,t,mat='alloy',axis=[1,0,0],tier='fine')=>add(n,'ring',p,[r,t],mat,tier,{axis});
 const loft=(n,sections,mat='paint',extra={})=>add(n,'hull',[0,0,0],[],mat,'base',{sections,...extra});
 const axles=heavy&&kind!=='bus'?[-L+1.1,-L+2.3,L-1.15]:[-c.wb/2,c.wb/2];
 // Wheel geometry has a rounded shoulder and a recessed rim, not a flat cylinder cap.
 for(const z of axles)for(const side of [-1,1]){
  const x=side*(W-.105),R=c.r,id=side+':'+z,face=x+side*.124;
  add('shouldered tyre '+id,'tyre',[x,R,z],[R,.245],'rubber','base',{axis:[1,0,0]});
  cyl('recessed wheel barrel '+id,[face-side*.025,R,z],R*.70,.040,'chassis',[1,0,0],'base');
  ring('machined rim lip '+id,[face,R,z],R*.72,.013,'alloy',[1,0,0],'base');
  cyl('brake rotor '+id,[face-side*.012,R,z],R*.55,.012,'trim',[1,0,0]);
  cyl('wheel hub '+id,[face+side*.008,R,z],R*.18,.032,'alloy',[1,0,0],'base');
  for(let j=0;j<(heavy?6:5);j++){
   const a=j*Math.PI*2/(heavy?6:5),b=a+.20,xx=face+side*.005;
   panel('cast spoke '+id+':'+j,[[xx,R+Math.cos(a-.14)*R*.18,z+Math.sin(a-.14)*R*.18],[xx,R+Math.cos(a+.14)*R*.18,z+Math.sin(a+.14)*R*.18],[xx,R+Math.cos(b+.085)*R*.68,z+Math.sin(b+.085)*R*.68],[xx,R+Math.cos(b-.085)*R*.68,z+Math.sin(b-.085)*R*.68]],[side,0,0],'alloy');
  }
  ring('sidewall moulding '+id,[face-side*.008,R,z],R*.91,.004,'rubber');
  if(heavy)for(let j=0;j<6;j++){const a=j*Math.PI/3;cyl('wheel lug '+id+j,[face+side*.027,R+Math.cos(a)*R*.26,z+Math.sin(a)*R*.26],.018,.022,'alloy',[1,0,0]);}
 }
 box('recessed floorpan',[0,heavy?.62:.31,0],[c.w*.72,heavy?.19:.13,c.l*.78],'chassis');
 function plate(z,y){box('registration recess '+z,[0,y,z],[.54,.17,.035],'chassis');add('registration plate '+z,'plate',[0,y,z+Math.sign(z)*.020],[.48,.135],c.green?'greenplate':'plate','fine',{front:z>0});}
 function mirrors(z,y){for(const s of [-1,1]){
  rod('mirror stalk '+s,[s*(W-.02),y-.10,z-.04],[s*(W+.10),y-.04,z+.02],heavy?.026:.018,'chassis','base');
  box('mirror shell '+s,[s*(W+.16),y,z],[heavy?.23:.19,heavy?.29:.10,heavy?.15:.18],'paint','base',true);
  box('mirror insert '+s,[s*(W+.16),y,z-.091],[heavy?.18:.14,heavy?.23:.065,.012],'glass','fine');
 }}
 if(!heavy){
  const suv=kind==='li',fast=kind==='yu7',H=suv?1.08:fast?1.00:.92;
  const zs=[-L,-L*.94,-L*.70,-L*.34,L*.22,L*.56,L*.88,L],ws=[.72,.93,.99,1,1,.97,.88,.70].map(t=>t*W),tops=[H*.78,H*.96,H,H,H,H,H*.80,H*.70];
  const bodyAt=z=>{let i=0;while(i<zs.length-2&&z>zs[i+1])i++;const t=Math.max(0,Math.min(1,(z-zs[i])/(zs[i+1]-zs[i]))),e=t*t*(3-2*t),w=ws[i]+(ws[i+1]-ws[i])*e,hi=tops[i]+(tops[i+1]-tops[i])*e;let lo=.36;for(const az of axles){const r=c.r+.055,d=z-az;if(Math.abs(d)<r)lo=Math.max(lo,c.r+Math.sqrt(r*r-d*d));}return {w,hi,lo};};
  loft('wheel-cut sculpted body',zs.map((z,i)=>[z,ws[i],.36,tops[i]]),'paint',{arches:axles.map(z=>({z,r:c.r+.055,y:c.r})),crown:.045});
  for(const s of [-1,1]){
   // Thin open arcs follow the actual body cutout; no dark discs covering the tyres.
   for(const az of axles){const rr=c.r+.059,pts=[],start=Math.asin((.36-c.r)/rr);for(let j=0;j<=16;j++){const a=start+(Math.PI-2*start)*j/16,z=az+Math.cos(a)*rr;pts.push([s*(bodyAt(z).w+.002),c.r+Math.sin(a)*rr,z]);}path('wheel opening lip '+s+az,pts,suv?.018:.010,suv?'chassis':'paint','base');}
   box('rocker moulding '+s,[s*(W-.014),.38,0],[.035,.065,c.wb-2*c.r-.10],suv?'chassis':'paint','base',true);
  }
  // Distinct roof silhouettes: sedan fastback, low sports crossover, tall family SUV.
  const cabin=suv?[[-L*.81,W*.83,H+.05],[-L*.62,W*.83,c.h-.07],[-L*.15,W*.84,c.h],[L*.23,W*.80,c.h-.06],[L*.51,W*.76,H+.035]]:fast?[[-L*.81,W*.75,H+.02],[-L*.40,W*.79,c.h-.09],[-L*.08,W*.80,c.h],[L*.22,W*.76,c.h-.07],[L*.53,W*.73,H+.02]]:[[-L*.76,W*.74,H+.005],[-L*.37,W*.78,c.h-.07],[-L*.08,W*.80,c.h],[L*.20,W*.76,c.h-.06],[L*.53,W*.73,H+.01]];
  loft('glazed greenhouse',cabin.map(([z,w,y])=>[z,w,H-.01,y]),'glass',{crown:.025});
  const roof=cabin.slice(1,4);loft('roof crown',roof.map(([z,w,y])=>[z,w*.96,y-.025,y+.008]),suv||kind==='ice'?'paint':'roof',{crown:.025});
  const [rear,cRear,peak,cFront,front]=cabin;
  for(const s of [-1,1]){
   const sillZ0=rear[0],sillZ1=front[0],edge=(q)=>[s*q[1],q[2]+.007,q[0]];
   path('roof side rail '+s,[edge(rear),edge(cRear),edge(peak),edge(cFront),edge(front)],.021,'paint','base');
   path('window sill '+s,[[s*rear[1],H,rear[0]],[s*peak[1],H,peak[0]],[s*front[1],H,front[0]]],.012,'trim','base');
   const bz=-L*.075,btop=peak[2];panel('B pillar '+s,[[s*(peak[1]+.007),H,bz-.045],[s*(peak[1]+.007),H,bz+.045],[s*(peak[1]+.007),btop,bz+.045],[s*(peak[1]+.007),btop,bz-.045]],[s,0,0],'chassis');
   for(const z of [sillZ0+.10,bz,sillZ1-.055]){
    // Seams meet the sill/rocker edges instead of stopping on a bare face.
    const b=bodyAt(z),bevel=Math.min(.055,(b.hi-b.lo)*.20);
    path('door shutline '+s+z,[[s*(b.w-bevel),b.hi+.003,z],[s*(b.w+.003),b.hi-bevel,z],[s*(b.w+.003),b.lo+bevel,z],[s*(b.w-bevel),b.lo,z]],.0035,'chassis');
   }
   for(const z of [-L*.33,L*.23])box('flush handle '+s+z,[s*(bodyAt(z).w+.002),H-.115,z],[.018,.026,.16],kind==='ice'?'alloy':'trim','fine',true);
   // Front and rear lenses lie on the tapered end faces, inside the body envelope.
   box('swept headlight '+s,[s*W*.43,H*.63,L+.010],[W*.48,.048,.024],'lamp','base',true);
   box('rear lamp housing '+s,[s*W*.43,H*.76,-L-.010],[W*.48,.048,.024],'redlamp','base',true);
   box('lower corner intake '+s,[s*W*.63,.48,L*.91],[W*.20,.09,.035],'chassis','fine',true);
  }
  const hoodPoint=(f,z)=>{const b=bodyAt(z),x=b.w*f,r=Math.abs(f),rise=r<=.5?1-r*.5:.75*(b.w-.055-Math.abs(x))/(b.w-.055-b.w*.5);return [x,b.hi+.045*rise+.003,z];},hood=[];
  for(let j=0;j<=8;j++)hood.push(hoodPoint(-.60,L*(.54+.35*j/8)));
  for(let j=1;j<=8;j++)hood.push(hoodPoint(-.60+1.2*j/8,L*.89));
  for(let j=1;j<=8;j++)hood.push(hoodPoint(.60,L*(.89-.35*j/8)));
  for(let j=1;j<=8;j++)hood.push(hoodPoint(.60-1.2*j/8,L*.54));path('closed hood perimeter',hood,.0035,'trim');
  // Hood inset matches the sloping deck; two wipers have real roots on the cowl.
  for(const s of [-1,1])rod('windscreen wiper '+s,[s*.38,H+.035,front[0]-.02],[s*.20,H+.10,front[0]-.13],.009,'chassis');
  box('front lower grille',[0,.46,L+.009],[c.w*.56,.075,.018],'chassis','base',true);
  box('rear diffuser',[0,.43,-L-.009],[c.w*.60,.06,.018],'chassis','base',true);
  if(suv){box('front continuous light',[0,H*.65,L+.013],[c.w*.65,.024,.018],'lamp');box('rear continuous light',[0,H*.77,-L-.013],[c.w*.65,.025,.018],'redlamp');box('roof lidar base',[0,c.h+.022,L*.18],[.24,.045,.15],'chassis','fine',true);}
  if(fast)for(const s of [-1,1])box('vertical headlight blade '+s,[s*W*.73,H*.72,L*.91],[.05,.15,.035],'lamp','fine',true);
  mirrors(L*.40,H+.14);plate(L+.016,.55);plate(-L-.016,.55);
 }else if(kind==='bus'){
  loft('bus rounded wheel-cut shell',[[-L,W*.90,.54,2.97],[-L+.22,W,.43,3.15],[L-.35,W,.43,3.15],[L,W*.90,.54,2.96]],'paint',{arches:axles.map(z=>({z,r:c.r+.075,y:c.r})),crown:.025});
  // A continuous dark gasket with individual recessed panes and regular mullions.
  for(const s of [-1,1]){
   box('side glazing gasket '+s,[s*(W+.008),2.25,-.04],[.018,1.10,c.l-.65],'chassis');
   for(let j=0;j<8;j++){const z=-L+.96+j*1.39;box('bonded side pane '+s+j,[s*(W+.022),2.26,z],[.014,.97,1.30],'glass');}
   box('waist trim '+s,[s*(W+.02),1.65,0],[.025,.04,c.l-.55],'trim');
   box('service lower stripe '+s,[s*(W+.023),1.12,0],[.025,.09,c.l-.55],'teal');
   for(const z of [-4.15,.3,3.8]){path('luggage hatch '+s+z,[[s*(W+.025),.61,z-.58],[s*(W+.025),1.45,z-.58],[s*(W+.025),1.45,z+.58],[s*(W+.025),.61,z+.58]],.006,'trim');box('luggage latch '+s+z,[s*(W+.032),1.30,z],[.018,.03,.13],'trim','fine');}
   for(let j=0;j<8;j++)box('motor cooling louvre '+s+j,[s*(W+.026),1.35,-L+.32+j*.075],[.021,.35,.026],'chassis','fine');
   box('front lamp bezel '+s,[s*.84,.94,L+.008],[.34,.19,.035],'chassis','base',true);
   box('front lamp lens '+s,[s*.84,.95,L+.030],[.27,.09,.016],'lamp');
   box('rear lamp column '+s,[s*.94,1.18,-L*.967],[.12,.51,.04],'redlamp','base',true);
  }
  for(const z of [-2.8,4.65]){
   box('passenger door gasket '+z,[W+.035,1.55,z],[.026,2.03,1.05],'chassis');
   box('passenger door glazing '+z,[W+.052,1.64,z],[.012,1.75,.92],'glass');
   rod('door central stile '+z,[W+.064,.54,z],[W+.064,2.56,z],.014,'trim','base');
   box('door threshold '+z,[W+.055,.48,z],[.07,.06,1.08],'alloy');
  }
  panel('wraparound windscreen',[[-W*.86,1.55,L+.018],[W*.86,1.55,L+.018],[W*.83,2.83,L+.018],[-W*.83,2.83,L+.018]],[0,0,1],'glass');
  box('destination panel',[0,2.94,L+.010],[1.55,.14,.024],'chassis');box('destination display inset',[0,2.94,L+.027],[1.27,.065,.008],'teal','fine');
  box('rear glass',[0,2.35,-L-.013],[2.03,.85,.025],'glass');
  for(const s of [-1,1])rod('bus wiper '+s,[s*.55,1.53,L+.033],[s*.26,2.06,L+.033],.013,'chassis');
  box('roof HVAC base',[0,3.18,-.65],[1.70,.12,2.5],'trim','base',true);box('roof HVAC fairing',[0,3.29,-.65],[1.60,.22,2.35],'white','base',true);
  for(const z of [-1.3,.0]){cyl('HVAC fan guard '+z,[0,3.406,z],.38,.012,'chassis');ring('HVAC fan rim '+z,[0,3.418,z],.36,.014,'alloy',[0,1,0]);}
  for(let j=0;j<7;j++)box('HVAC intake rib '+j,[0,3.41,-.95+j*.09],[1.30,.013,.022],'trim','fine');
  mirrors(L-.32,2.59);plate(L+.025,.65);plate(-L-.025,.68);
 }else{
  const cabH=kind==='fire'?2.34:2.67,cz=L-1.27,cabBack=L-2.50;
  box('ladder chassis left',[-.67,.74,-.10],[.16,.24,c.l-.6],'chassis');box('ladder chassis right',[.67,.74,-.10],[.16,.24,c.l-.6],'chassis');
  loft('rounded cab shell',[[cabBack,W*.94,.62,cabH-.04],[cabBack+.17,W,.58,cabH+.09],[L-.22,W*.95,.58,cabH+.06],[L,W*.85,.70,cabH-.17]],'paint',{arches:[{z:L-1.15,r:c.r+.07,y:c.r}],crown:.035});
  panel('cab windscreen',[[-W*.78,cabH-.88,L+.019],[W*.78,cabH-.88,L+.019],[W*.74,cabH-.25,L+.019],[-W*.74,cabH-.25,L+.019]],[0,0,1],'glass');
  for(const s of [-1,1]){
   panel('cab side window '+s,[[s*(W+.018),cabH-.89,cabBack+.24],[s*(W+.018),cabH-.89,L-.40],[s*(W+.018),cabH-.22,L-.47],[s*(W+.018),cabH-.13,cabBack+.24]],[s,0,0],'glass');
   path('cab door perimeter '+s,[[s*(W+.016),.84,cabBack+.13],[s*(W+.016),cabH-.06,cabBack+.13],[s*(W*.95),cabH-.06,L-.28]],.006,'trim');
   box('door handle '+s,[s*(W+.018),cabH-1.02,cabBack+.46],[.022,.04,.18],'trim','fine',true);
   for(const y of [.40,.60])box('anti slip cab step '+s+y,[s*(W-.015),y,cabBack+.30],[.26,.07,.39],'alloy','base',true);
   box('cab lamp recess '+s,[s*.78,.96,L+.005],[.43,.23,.035],'chassis','base',true);box('cab headlight '+s,[s*.78,.99,L+.027],[.31,.12,.012],'lamp');
   box('cab amber marker '+s,[s*.99,1.13,L-.06],[.06,.07,.03],'amber','fine');
   for(const z of axles.slice(0,2))box('rear mudguard '+s+z,[s*(W-.1),1.03,z],[.29,.07,1.04],'chassis','base',true);
   const railStart=axles[1]+c.r+.13,railEnd=cabBack-.08;
   box('side underrun rail '+s,[s*(W-.08),.64,(railStart+railEnd)/2],[.07,.15,railEnd-railStart],'alloy','base',true);
  }
  box('lower cab grille',[0,1.20,L+.02],[1.22,.39,.026],'chassis','base',true);for(let j=0;j<5;j++)box('grille bar '+j,[0,1.05+j*.068,L+.04],[1.13,.018,.018],'trim','fine');
  for(const s of [-1,1])rod('cab wiper '+s,[s*.63,cabH-.89,L+.033],[s*.25,cabH-.58,L+.033],.012,'chassis');
  mirrors(L-.53,cabH-.34);plate(L+.04,.66);plate(-L+.01,.68);
  if(kind==='truck'){
   const front=cabBack-.20,rear=-L+.12,mid=(front+rear)/2,len=front-rear;
   box('cargo corner rounded body',[0,2.32,mid],[c.w*.96,2.70,len],'cargo','base',true);box('cargo roof drip cap',[0,3.70,mid],[c.w+.015,.075,len+.06],'white','base',true);
   for(const s of [-1,1]){
    box('cargo lower extrusion '+s,[s*(W-.015),1.015,mid],[.04,.09,len],'alloy');
    for(const z of [rear+.04,front-.04])box('cargo corner post '+s+z,[s*(W-.015),2.25,z],[.05,2.76,.055],'alloy');
    for(let j=0;j<18;j++)box('cargo pressed rib '+s+j,[s*(W-.015),2.26,rear+.16+j*(len-.32)/17],[.018,2.60,.018],'trim','fine');
    box('cargo rear door '+s,[s*W*.475,2.24,rear-.025],[W*.91,2.64,.025],'white');
    rod('rear locking bar '+s,[s*W*.47,.97,rear-.06],[s*W*.47,3.48,rear-.06],.022,'alloy','base');
    for(const y of [1.20,2.26,3.30]){box('rear hinge '+s+y,[s*(W-.08),y,rear-.052],[.13,.09,.035],'alloy','fine',true);}
    box('rear tail lamp '+s,[s*.91,.91,rear-.10],[.25,.11,.03],'redlamp');
   }
   box('rear impact bar',[0,.45,rear-.06],[2.28,.12,.12],'alloy','base',true);
  }else if(kind==='fire'){
   const front=cabBack-.10,rear=-L+.13,mid=(front+rear)/2,len=front-rear;
   loft('wheel-cut equipment body',[[rear,W*.94,.77,2.84],[rear+.10,W*.96,.77,2.89],[front-.10,W*.96,.77,2.89],[front,W*.94,.77,2.84]],'paint',{arches:axles.slice(0,2).map(z=>({z,r:c.r+.065,y:c.r}))});
   for(const s of [-1,1]){
    for(let j=0;j<3;j++){const z=rear+(j+.5)*len/3;box('shutter recess '+s+j,[s*(W-.012),1.75,z],[.025,1.56,len/3-.09],'chassis');box('roller shutter '+s+j,[s*(W+.004),1.75,z],[.018,1.47,len/3-.16],'alloy');for(let k=0;k<11;k++)box('shutter slat '+s+j+k,[s*(W+.016),1.06+k*.13,z],[.009,.014,len/3-.16],'trim','fine');box('shutter pull '+s+j,[s*(W+.032),1.10,z],[.024,.035,.22],'chassis','fine');}
    box('reflective side stripe '+s,[s*(W+.028),1.02,mid],[.018,.07,len],'white');
    rod('roof ladder rail '+s,[s*.40,2.99,rear+.18],[s*.40,2.99,front-.14],.038,'alloy','base');
    for(const z of [rear+.35,front-.35])box('ladder mount '+s+z,[s*.40,2.93,z],[.12,.12,.12],'chassis');
    box('beacon gasket '+s,[s*.64,cabH+.14,cz],[.40,.07,.24],'chassis','fine',true);box('beacon lens '+s,[s*.64,cabH+.23,cz],[.35,.12,.20],'redlamp','base',true);
    cyl('pump connector '+s,[s*.73,1.18,rear-.08],.12,.16,'alloy',[0,0,1]);
    box('rear marker '+s,[s*.96,.91,rear-.05],[.14,.28,.026],'redlamp');
   }
   for(let j=0;j<12;j++){const z=rear+.25+j*(len-.5)/11;rod('ladder rung '+j,[-.40,2.99,z],[.40,2.99,z],.023,'alloy','base');}
   cyl('hose drum backing',[0,1.96,rear-.025],.41,.055,'chassis',[0,0,1],'base');for(let j=0;j<4;j++)ring('hose winding '+j,[0,1.96,rear-.064],.15+j*.072,.032,'rubber',[0,0,1]);
  }else{
   // Shorten the tank before the cab bulkhead: the old tank entered the cab.
   const z0=-3.55,z1=cabBack-.27,mid=(z0+z1)/2,R=.94;
   add('rounded pressure vessel','vessel',[0,2.13,mid],[R,z1-z0],'tank','base',{axis:[0,0,1]});
   for(const z of [z0+.7,z1-.7]){
    box('tank cradle foot '+z,[0,.97,z],[1.70,.22,.30],'chassis');
    for(const s of [-1,1])box('saddle cheek '+s+z,[s*.67,1.275,z],[.22,.39,.30],'alloy');
    ring('retaining strap '+z,[0,2.13,z],R+.015,.022,'alloy',[0,0,1],'base');
   }
   box('tank walkway',[0,3.10,mid],[.49,.045,z1-z0-.55],'alloy','base',true);
   for(const z of [mid-.65,mid+.65]){cyl('manway neck '+z,[0,3.12,z],.24,.12,'alloy',[0,1,0],'base');cyl('manway cover '+z,[0,3.195,z],.28,.035,'tank',[0,1,0],'base');}
   for(const s of [-1,1]){
    cyl('side loading neck '+s,[s*.972,2.17,mid],.095,.09,'alloy',[1,0,0]);cyl('closed loading cap '+s,[s*1.026,2.17,mid],.11,.025,'teal',[1,0,0]);
    rod('valve guard '+s,[s*.85,1.49,mid-.36],[s*.85,1.49,mid+.36],.022,'alloy');
    box('rear lamp '+s,[s*.96,.90,-L+.08],[.24,.12,.04],'redlamp');
   }
   const ladderZ=y=>z0-.10+Math.max(0,y-2.15)*.43;
   for(const s of [-1,1])path('rear access ladder '+s,[[s*.24,1.0,ladderZ(1)],[s*.24,2.15,ladderZ(2.15)],[s*.24,3.10,ladderZ(3.10)]],.024,'alloy','base');
   for(let j=0;j<8;j++){const y=1.15+j*.26;rod('tank ladder rung '+j,[-.24,y,ladderZ(y)],[.24,y,ladderZ(y)],.018,'alloy');}
  }
 }
 // Keep the established local port coordinates and connection contract exactly.
 const port=!c.green?null:[-W-.025,kind==='bus'?1.12:.83,-L*.65];
 if(port){box('charge inlet gasket',port,[.04,.18,.22],'chassis');box('charge inlet face',[port[0]-.023,port[1],port[2]],[.012,.11,.13],'teal','fine');}
 return {kind,spec:{...c},parts,port,plates:2};
}
return {specs,create};
});
