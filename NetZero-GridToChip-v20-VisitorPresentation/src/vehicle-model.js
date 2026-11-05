/* Shared exterior vehicle parts: dimensions use scene units with real relative proportions, nose is +Z. */
(function(root,factory){const m=factory();if(typeof module==='object'&&module.exports)module.exports=m;if(root)root.NZ_VEHICLE_MODEL=m;})(typeof window!=='undefined'?window:null,function(){
'use strict';
const specs={model3:{title:'特斯拉 Model 3 · 外观示意',w:1.848,l:4.72,h:1.442,wb:2.875,r:.33,green:true},yu7:{title:'小米 YU7 · 外观示意',w:1.996,l:5,h:1.61,wb:3,r:.37,green:true},li:{title:'理想L系列 · 外观示意',w:2,l:5.22,h:1.8,wb:3.1,r:.40,green:true},ice:{title:'普通燃油轿车 · 外观示意',w:1.85,l:4.7,h:1.48,wb:2.8,r:.34,green:false},bus:{title:'园区电动大巴',w:2.55,l:11.8,h:3.4,wb:5.8,r:.49,green:true},fire:{title:'消防救援车',w:2.5,l:8.4,h:3.1,wb:4.9,r:.48,green:false},truck:{title:'物流厢式货车',w:2.5,l:10.4,h:3.8,wb:6,r:.48,green:false},tanker:{title:'化工区专用槽车',w:2.6,l:10,h:3.4,wb:5.9,r:.48,green:false}};
function create(kind){const c=specs[kind];if(!c)throw Error('Unknown vehicle '+kind);const parts=[];
 const add=(name,type,p,size,mat,tier='base',extra={})=>parts.push({name,type,p,size,mat,tier,...extra});
 const box=(n,p,size,mat='paint',tier)=>add(n,'box',p,size,mat,tier),cyl=(n,p,r,h,mat,axis=[0,1,0],tier)=>add(n,'cyl',p,[r,h],mat,tier,{axis}),rod=(n,a,b,r,mat='trim',tier='fine')=>add(n,'rod',a,[r],mat,tier,{b}),oval=(n,p,s,mat,tier)=>add(n,'oval',p,s,mat,tier);
 const W=c.w/2,L=c.l/2;
 box('underbody',[0,.38,0],[c.w*.84,.22,c.l*.86],'chassis');
 const profile=(n,zs,widths,lows,highs,mat)=>add(n,'loft',[0,0,0],[],mat,'base',{sections:zs.map((z,i)=>[z,widths[i],lows[i],highs[i]])});
 function wheel(x,z,index){const R=c.r;cyl('tyre '+index,[x,R,z],R,.23,'rubber',[1,0,0]);cyl('alloy wheel '+index,[x+Math.sign(x)*.125,R,z],R*.73,.028,'alloy',[1,0,0]);cyl('wheel centre '+index,[x+Math.sign(x)*.146,R,z],R*.18,.035,'chassis',[1,0,0]);add('rim bead '+index,'ring',[x+Math.sign(x)*.143,R,z],[R*.71,.022],'trim','fine',{axis:[1,0,0]});for(let j=0;j<5;j++){const a=j*Math.PI*2/5,xx=x+Math.sign(x)*.15;rod('wheel spoke '+index+' '+j,[xx,R+Math.cos(a)*R*.18,z+Math.sin(a)*R*.18],[xx,R+Math.cos(a)*R*.64,z+Math.sin(a)*R*.64],.018,'alloy');}}
 function axles(zs){let i=0;for(const z of zs)for(const x of [-W+.08,W-.08])wheel(x,z,i++);}
 function plate(z,y){box('plate mounting '+z,[0,y,z],[.55,.17,.045],'chassis');add('registration plate '+z,'plate',[0,y,z+Math.sign(z)*.026],[.48,.135],c.green?'greenplate':'plate','fine',{front:z>0});}
 function mirror(z,y){for(const s of [-1,1]){rod('mirror support '+s,[s*(W-.05),y-.06,z],[s*(W+.15),y-.04,z+.04],.025,'chassis','base');oval('mirror housing '+s,[s*(W+.18),y,z],[.19,.11,.14],'paint');box('mirror glass '+s,[s*(W+.185),y,z-.105],[.15,.065,.015],'glass','fine');}}
 if(['model3','yu7','li','ice'].includes(kind)){
  const isLi=kind==='li',bodyTop=isLi?1.05:kind==='yu7'?.99:.86;
  profile('sculpted body',[-L,-L*.93,-L*.65,-L*.23,L*.4,L*.77,L*.96,L],[W*.72,W*.94,W,W,W,W*.95,W*.8,W*.64],[.49,.40,.39,.39,.39,.40,.47,.51],[bodyTop*.83,bodyTop,bodyTop,bodyTop,bodyTop,bodyTop*.92,bodyTop*.77,bodyTop*.70],'paint');
  const zs=isLi?[-L*.85,-L*.69,-L*.05,L*.25,L*.50]:kind==='yu7'?[-L*.80,-L*.45,-L*.05,L*.21,L*.48]:[-L*.74,-L*.38,-L*.06,L*.19,L*.52],ws=(isLi?[.80,.85,.85,.82,.74]:[.69,.79,.81,.77,.72]).map(v=>v*W),tops=isLi?[bodyTop+.48,c.h-.03,c.h,c.h-.03,bodyTop+.10]:[bodyTop+.04,c.h-.06,c.h,c.h-.05,bodyTop+.06];
  profile('glazed cabin',zs,ws,zs.map(()=>bodyTop-.035),tops,'glass');
  profile('painted roof',zs.slice(1,4),ws.slice(1,4).map(w=>w*.91),tops.slice(1,4).map(y=>y-.035),tops.slice(1,4).map(y=>y+.006),isLi?'paint':'roof');
  for(const s of [-1,1]){
   box('rocker trim '+s,[s*(W-.055),.45,0],[.055,.10,c.l*.70],'chassis');
   rod('B pillar '+s,[s*W*.96,bodyTop,-.04],[s*ws[2],tops[2]-.025,zs[2]],.035,'chassis','base');
   rod('A pillar '+s,[s*ws[4],tops[4],zs[4]],[s*ws[3],tops[3],zs[3]],.035,'paint','base');
   rod('C pillar '+s,[s*ws[0],tops[0],zs[0]],[s*ws[1],tops[1],zs[1]],.045,'paint','base');
   for(const z of [-L*.52,.05,L*.51])rod('door split '+s+' '+z,[s*(W+.003),.53,z],[s*(W*.98),bodyTop,z],.008,'trim');
   for(const z of [-L*.25,L*.29]){box('flush door handle '+s+z,[s*(W+.012),bodyTop-.13,z],[.024,.035,.17],'trim','fine');}
   rod('shoulder crease '+s,[s*W*.97,bodyTop-.13,-L*.75],[s*W*.97,bodyTop-.13,L*.75],.008,'trim');
   box('front lamp '+s,[s*W*.56,bodyTop*.78,L*.958],[W*.60,.065,.055],'lamp');
   box('rear lamp '+s,[s*W*.59,bodyTop*.86,-L*.96],[W*.60,.07,.055],'redlamp');
   if(kind==='yu7')oval('YU7 headlamp surround '+s,[s*W*.63,bodyTop*.80,L*.944],[.13,.16,.055],'lamp');
  }
  if(isLi){box('continuous front light',[0,.96,L*.96],[c.w*.85,.055,.06],'lamp');box('rear light bar',[0,1.01,-L*.96],[c.w*.9,.06,.06],'redlamp');box('roof sensor',[0,c.h+.035,L*.22],[.32,.07,.18],'chassis','fine');}
  box('front lower intake',[0,.51,L*.95],[c.w*.60,.12,.04],'chassis');box('rear bumper insert',[0,.5,-L*.95],[c.w*.7,.10,.045],'chassis');
  axles([-c.wb/2,c.wb/2]);mirror(L*.40,bodyTop+.20);plate(L*.982,.55);plate(-L*.982,.58);
 }else if(kind==='bus'){
  profile('bus coach shell',[-L,-L+.18,L-.3,L],[W*.92,W,W,W*.90],[.57,.49,.49,.57],[3.02,3.13,3.13,2.91],'paint');
  box('front windscreen',[0,2.16,L+.04],[c.w*.83,1.25,.055],'glass');box('rear windscreen',[0,2.33,-L-.018],[c.w*.79,.8,.035],'glass');
  for(const s of [-1,1]){
   for(let j=0;j<8;j++){const z=-L+1.0+j*1.36;box('passenger window '+s+j,[s*(W+.008),2.27,z],[.035,1.03,1.25],'glass');}
   box('bus belt trim '+s,[s*(W+.012),1.67,0],[.04,.08,c.l-.4],'chassis');
   box('bus lower stripe '+s,[s*(W+.018),.90,0],[.04,.12,c.l-.6],'teal');
   for(const z of [-3.2,1.3]){box('passenger door '+s+z,[s*(W+.026),1.57,z],[.045,2.05,1.08],'glass');rod('door mullion '+s+z,[s*(W+.055),.6,z],[s*(W+.055),2.59,z],.018,'trim');}
   box('headlamp '+s,[s*.85,.91,L+.012],[.32,.14,.05],'lamp');box('taillight '+s,[s*.98,1.28,-L-.012],[.11,.65,.05],'redlamp');
   for(let j=0;j<8;j++)box('rear ventilation '+s+j,[s*(W+.015),1.28,-L+.55+j*.1],[.035,.45,.035],'trim','fine');
  }
  box('roof air conditioner',[0,3.24,-.6],[1.65,.32,2.35],'white');for(let j=0;j<8;j++)box('HVAC fins '+j,[0,3.412,-1.5+j*.23],[1.35,.02,.065],'trim','fine');
  axles([-c.wb/2,c.wb/2]);mirror(L-.25,2.5);plate(L+.03,.65);plate(-L-.03,.76);
 }else{
  const cabinZ=L-1.25,cabinH=kind==='fire'?2.3:2.65;
  box('truck chassis',[0,.75,-.2],[c.w*.79,.27,c.l-.5],'chassis');
  profile('cab shell',[L-2.55,L-2.4,L-.2,L],[W*.94,W,W*.93,W*.84],[.65,.60,.60,.75],[cabinH,cabinH+.12,cabinH+.08,cabinH-.2],'paint');
  box('cab windscreen',[0,cabinH-.52,L+.04],[c.w*.82,.77,.04],'glass');for(const s of [-1,1]){box('cab side glass '+s,[s*(W-.015),cabinH-.50,cabinZ],[.045,.70,1.33],'glass');box('cab handle '+s,[s*(W+.015),1.45,cabinZ-.4],[.035,.06,.23],'trim','fine');box('cab step '+s,[s*W,.55,cabinZ],[.32,.16,1.35],'alloy');box('headlights '+s,[s*.82,.93,L+.02],[.35,.16,.05],'lamp');}
  box('radiator grille',[0,1.19,L+.035],[c.w*.52,.43,.06],'chassis');for(let j=0;j<5;j++)box('grille slot '+j,[0,1.03+j*.07,L+.075],[c.w*.47,.025,.02],'alloy','fine');
  mirror(L-.75,cabinH-.35);axles([-L+1.1,-L+2.3,L-1.15]);plate(L+.04,.68);plate(-L+.02,.68);
  if(kind==='truck'){
   box('cargo body',[0,2.24,-1.25],[c.w*.98,2.85,c.l-3.0],'cargo');box('cargo roof',[0,3.70,-1.25],[c.w+.06,.14,c.l-2.9],'alloy');
   for(const s of [-1,1])for(let j=0;j<20;j++)box('cargo rib '+s+j,[s*(W+.008),2.26,-L+.45+j*(c.l-3.6)/19],[.035,2.6,.035],'trim','fine');
   for(const s of [-1,1]){box('rear cargo door '+s,[s*W*.48,2.18,-L+.05],[W*.93,2.67,.07],'white');rod('cargo door lock '+s,[s*W*.44,.95,-L-.008],[s*W*.44,3.4,-L-.008],.03,'alloy','base');}
  }else if(kind==='fire'){
   box('water and equipment body',[0,1.83,-1.2],[c.w*.96,2.12,c.l-3.1],'paint');for(const side of [-1,1])for(let j=0;j<3;j++){const z=-L+.9+j*1.35;box('equipment shutter '+side+j,[side*(W-.01),1.72,z],[.05,1.55,1.18],'alloy');for(let k=0;k<10;k++)box('shutter rib '+side+j+k,[side*(W+.025),1.08+k*.13,z],[.025,.025,1.15],'trim','fine');}
   for(const side of [-1,1]){box('reflective body stripe '+side,[side*(W+.04),.94,-.1],[.035,.11,c.l-.6],'white');rod('ladder rail '+side,[side*.43,3,-L+.3],[side*.43,3,L-2.6],.055,'alloy','base');}
   for(let j=0;j<12;j++)rod('ladder rung '+j,[-.43,3,-L+.45+j*.35],[.43,3,-L+.45+j*.35],.035,'alloy','base');
   cyl('hose reel',[0,2,-L+.06],.45,.15,'chassis',[0,0,1]);for(let j=0;j<4;j++)add('coiled hose '+j,'ring',[0,2,-L-.04-j*.015],[.18+j*.07,.045],'rubber','fine',{axis:[0,0,1]});
   for(const s of [-1,1]){box('beacon lens '+s,[s*.65,cabinH+.28,cabinZ],[.36,.16,.26],'redlamp');cyl('pump outlet '+s,[s*.76,1.2,-L+.03],.13,.2,'alloy',[0,0,1]);}
  }else{
   cyl('pressure tank',[0,2.2,-.8],.95,5.6,'tank',[0,0,1]);for(const z of [-3.6,2])oval('tank end cap '+z,[0,2.2,z],[.95,.95,.26],'tank');for(const z of [-2.8,.9]){box('tank saddle '+z,[0,1.08,z],[1.8,.26,.45],'chassis');add('tank band '+z,'ring',[0,2.2,z],[.965,.035],'alloy','base',{axis:[0,0,1]});}
   cyl('tank manway',[0,3.18,-.8],.3,.18,'alloy');for(const side of [-1,1])cyl('loading coupling '+side,[side*1.025,2.28,-.8],.10,.15,'teal',[1,0,0]);
  }
 }
 const port=!c.green?null:[-W-.025,kind==='bus'?1.12:.83,-L*.65];if(port){box('charge port surround',port,[.04,.18,.22],'chassis');box('charge port inlet',[port[0]-.023,port[1],port[2]],[.012,.11,.13],'teal','fine');}
 return {kind,spec:{...c},parts,port,plates:parts.filter(p=>p.type==='plate').length};
}
return {specs,create};
});
